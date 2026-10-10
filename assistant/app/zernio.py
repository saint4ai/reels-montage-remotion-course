"""Клиент Zernio: один сервис для директа и комментариев Instagram, WhatsApp и Telegram.

Адреса и поля сверены с https://docs.zernio.com/llms-full.txt и https://zernio.com/openapi.yaml
(версия API 1.250.0, проверено 10.10.2026):

    отправить в беседу   POST {base}/inbox/conversations/{conversationId}/messages  {accountId, message}
    публичный ответ      POST {base}/inbox/comments/{postId}  {accountId, message, commentId}
    личный ответ         POST {base}/inbox/comments/{postId}/{commentId}/private-reply  {accountId, message}
    вебхуки              GET/POST/PUT {base}/webhooks/settings, POST {base}/webhooks/test
    подпись вебхука      заголовок X-Zernio-Signature = hex HMAC-SHA256 сырого тела ключом secret
    id события           поле id в теле и заголовок X-Zernio-Event-Id (одинаковый при повторах)

Расхождения с боевым ботом автора, где документации верим больше:
    · обновление вебхука: PUT с полем webhookId (старое _id принимается, но помечено устаревшим);
    · комментарий приходит в поле comment (author, platformPostId), а не в формате Meta;
    · личный ответ на комментарий можно отправить один раз и в течение 7 дней.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import logging
import uuid
from dataclasses import dataclass

import httpx

log = logging.getLogger("zernio")

WEBHOOK_NAME = "assistant"
EVENTS = ["message.received", "message.sent", "comment.received"]
RETRY_STATUSES = {429, 500, 502, 503, 504}


@dataclass
class Result:
    ok: bool
    status: int = 0
    message_id: str = ""
    error: str = ""
    # личный ответ на комментарий уже использован: повторять нельзя
    consumed: bool = False
    data: dict | None = None


def signature_ok(raw: bytes, signature: str | None, secret: str) -> bool:
    """Подпись Zernio: hex HMAC-SHA256 от сырого тела. Пустой секрет это отказ, а не пропуск."""
    if not secret or not signature:
        return False
    expected = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature.strip().lower())


class Zernio:
    def __init__(self, api_key: str, base: str, http: httpx.AsyncClient, *, sleep=asyncio.sleep, attempts: int = 3):
        self.key, self.base, self.http, self.sleep, self.attempts = api_key, base.rstrip("/"), http, sleep, attempts

    def _headers(self, extra: dict | None = None) -> dict:
        return {"Authorization": f"Bearer {self.key}", **(extra or {})}

    async def _call(self, method: str, path: str, *, json: dict | None = None, params: dict | None = None,
                    headers: dict | None = None) -> Result:
        """Запрос с повтором на временных сбоях (сеть, 429, 5xx). Ключ идемпотентности защищает от дубля."""
        if not self.key:
            return Result(False, error="не задан ZERNIO_API_KEY")
        last = Result(False, error="запрос не выполнялся")
        for attempt in range(1, self.attempts + 1):
            try:
                r = await self.http.request(method, f"{self.base}{path}", json=json, params=params,
                                            headers=self._headers(headers))
            except httpx.HTTPError as e:
                last = Result(False, error=f"запрос к Zernio не прошёл: {type(e).__name__}")
            else:
                data = _json(r)
                if 200 <= r.status_code < 300:
                    ids = (data.get("data") or {}) if isinstance(data, dict) else {}
                    return Result(True, r.status_code,
                                  message_id=str(ids.get("messageId") or ids.get("commentId") or ""),
                                  data=data if isinstance(data, dict) else None)
                details = (data.get("details") or {}) if isinstance(data, dict) else {}
                consumed = bool(details.get("privateReplyConsumed"))
                # в текст ошибки не берём тело запроса: в нём сообщение человеку
                last = Result(False, r.status_code, error=_error_text(r.status_code, data), consumed=consumed)
                if r.status_code not in RETRY_STATUSES:
                    return last
                if r.status_code == 429:
                    await self.sleep(min(_retry_after(r), 30))
                    continue
            if attempt < self.attempts:
                await self.sleep(min(2 ** attempt, 10))
        return last

    # ── отправка ─────────────────────────────────────────────────
    async def send_message(self, conversation_id: str, account_id: str, text: str) -> Result:
        key = str(uuid.uuid4())
        return await self._call("POST", f"/inbox/conversations/{conversation_id}/messages",
                                json={"accountId": account_id, "message": text},
                                headers={"Idempotency-Key": key})

    async def reply_comment(self, post_id: str, comment_id: str, account_id: str, text: str) -> Result:
        """Публичный ответ под комментарием. Ключ привязан к комментарию: повтор не создаст второй."""
        return await self._call("POST", f"/inbox/comments/{post_id}",
                                json={"accountId": account_id, "message": text, "commentId": comment_id},
                                headers={"Idempotency-Key": f"reply-{comment_id}"})

    async def private_reply(self, post_id: str, comment_id: str, account_id: str, text: str) -> Result:
        """Личное сообщение автору комментария. Только простой текст: кнопки неподписанным Instagram не отдаёт."""
        return await self._call("POST", f"/inbox/comments/{post_id}/{comment_id}/private-reply",
                                json={"accountId": account_id, "message": text})

    # ── вложения ─────────────────────────────────────────────────
    async def download(self, url: str, max_bytes: int) -> tuple[bytes, str]:
        """Файл из вложения: (байты, тип) или (b"", причина). К адресам Zernio добавляем ключ (WhatsApp)."""
        headers = self._headers() if url.startswith(self.base.rsplit("/api", 1)[0]) else {}
        try:
            r = await self.http.get(url, headers=headers, follow_redirects=True)
        except httpx.HTTPError as e:
            return b"", f"не скачалось: {type(e).__name__}"
        if r.status_code != 200:
            return b"", f"ответ {r.status_code}"
        if not r.content:
            return b"", "пустой файл"
        if len(r.content) > max_bytes:
            return b"", f"файл {len(r.content)} байт, больше предела"
        return r.content, r.headers.get("content-type", "")

    # ── вебхуки ──────────────────────────────────────────────────
    async def list_webhooks(self) -> list[dict]:
        r = await self._call("GET", "/webhooks/settings")
        return list((r.data or {}).get("webhooks") or []) if r.ok else []

    async def upsert_webhook(self, url: str, secret: str) -> str:
        """Создать вебхук или обновить существующий (по адресу или имени). Секрет в вывод не попадает."""
        existing = next((w for w in await self.list_webhooks()
                         if w.get("url") == url or w.get("name") == WEBHOOK_NAME), None)
        body = {"name": WEBHOOK_NAME, "url": url, "secret": secret, "events": EVENTS, "isActive": True}
        if existing:
            body["webhookId"] = existing.get("_id") or existing.get("id")
            r = await self._call("PUT", "/webhooks/settings", json=body)
            verb = "обновлён"
        else:
            r = await self._call("POST", "/webhooks/settings", json=body)
            verb = "создан"
        return f"вебхук {verb}: {url}" if r.ok else f"ошибка вебхука: {r.error}"

    async def test_webhook(self, url: str) -> str:
        found = next((w for w in await self.list_webhooks() if w.get("url") == url), None)
        if not found:
            return "вебхук с таким адресом не найден"
        r = await self._call("POST", "/webhooks/test", json={"webhookId": found.get("_id") or found.get("id")})
        return "тестовое событие доставлено" if r.ok else f"тест не прошёл: {r.error}"

    async def accounts(self) -> Result:
        return await self._call("GET", "/accounts")


def _json(r: httpx.Response):
    try:
        return r.json()
    except ValueError:
        return {}


def _retry_after(r: httpx.Response) -> float:
    try:
        return max(float(r.headers.get("Retry-After", "2")), 1.0)
    except ValueError:
        return 2.0


def _error_text(status: int, data) -> str:
    if isinstance(data, dict):
        code = data.get("code") or ""
        message = data.get("error") or data.get("message") or ""
        return f"Zernio ответил {status} {code} {str(message)[:160]}".strip()
    return f"Zernio ответил {status}"
