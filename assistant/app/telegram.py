"""Telegram: заявки владельцу и кнопки «Включить ассистента» / «Выключить» под ними.

Один бот и один чат (TELEGRAM_LEAD_CHAT_ID). Кнопки слушаем длинным опросом getUpdates
и принимаем нажатия только из этого чата: чужой человек, нашедший бота, ничего не включит."""

from __future__ import annotations

import logging

import httpx

log = logging.getLogger("telegram")

ACTIONS = {"on": "Ассистент в этом диалоге включён", "off": "Ассистент в этом диалоге выключен"}


def keyboard(contact_id: int) -> dict:
    return {"inline_keyboard": [[
        {"text": "Включить ассистента", "callback_data": f"on:{contact_id}"},
        {"text": "Выключить", "callback_data": f"off:{contact_id}"},
    ]]}


class Telegram:
    def __init__(self, token: str, chat_id: str, base: str, http: httpx.AsyncClient, *, dry_run: bool = False):
        self.token, self.chat_id, self.base, self.http = token, str(chat_id), base.rstrip("/"), http
        self.dry_run = dry_run

    @property
    def configured(self) -> bool:
        return bool(self.token and self.chat_id)

    async def call(self, method: str, payload: dict, *, timeout: float = 20) -> dict:
        """Метод Bot API. Сбой сети превращается в {"ok": False}: заявку это не должно ронять."""
        try:
            r = await self.http.post(f"{self.base}/bot{self.token}/{method}", json=payload, timeout=timeout)
            body = r.json()
            return body if isinstance(body, dict) else {"ok": False}
        except (httpx.HTTPError, ValueError) as e:
            # токен сидит в адресе запроса, поэтому в журнал идёт только тип ошибки
            log.warning("Telegram %s не прошёл: %s", method, type(e).__name__)
            return {"ok": False, "description": type(e).__name__}

    async def send(self, text: str, reply_markup: dict | None = None) -> bool:
        if not self.configured:
            log.error("Telegram не настроен: сообщение владельцу не доставлено")
            return False
        if self.dry_run:
            # в журнал только первая строка («Новая заявка»): дальше идут слова клиента
            first = text.strip().splitlines()[0] if text.strip() else ""
            logging.getLogger("dryrun").info("DRY_RUN, не отправлено: Telegram владельцу, «%s»", first[:80])
            return True
        payload = {"chat_id": self.chat_id, "text": text, "disable_web_page_preview": True}
        if reply_markup:
            payload["reply_markup"] = reply_markup
        result = await self.call("sendMessage", payload)
        if not result.get("ok"):
            log.error("Telegram отказал: %s", str(result.get("description", ""))[:120])
        return bool(result.get("ok"))

    async def get_me(self) -> dict:
        return await self.call("getMe", {})

    # ── кнопки под заявками ──────────────────────────────────────
    async def poll_once(self, offset: int, handle) -> tuple[int, bool]:
        """Один круг длинного опроса. handle(action, contact_id) возвращает подпись для ответа на нажатие.
        Возвращает (новый offset, удался ли запрос)."""
        if not self.configured:
            return offset, False
        result = await self.call("getUpdates", {"offset": offset, "timeout": 25,
                                                "allowed_updates": ["callback_query"]}, timeout=40)
        for update in result.get("result") or []:
            offset = max(offset, int(update.get("update_id", 0)) + 1)
            await self.handle_update(update, handle)
        return offset, bool(result.get("ok"))

    async def handle_update(self, update: dict, handle) -> None:
        cb = update.get("callback_query")
        if not cb:
            return
        chat = str(((cb.get("message") or {}).get("chat") or {}).get("id", ""))
        if chat != self.chat_id:
            log.warning("нажатие кнопки не из чата заявок, пропущено")
            return
        action, _, raw_id = str(cb.get("data") or "").partition(":")
        if action not in ACTIONS or not raw_id.isdigit():
            await self.call("answerCallbackQuery", {"callback_query_id": cb.get("id")})
            return
        label = await handle(action, int(raw_id))
        await self.call("answerCallbackQuery", {"callback_query_id": cb.get("id"), "text": label or ACTIONS[action]})
