"""Модель: ответы, расшифровка голосовых, описание картинок.

Клиент говорит на Chat Completions: этот язык понимают OpenAI и любые совместимые адреса
(OpenRouter и другие), а Responses API есть не везде. Адрес и ключ задают OPENAI_BASE_URL и
OPENAI_API_KEY. Из России можно ходить через OpenRouter: OPENAI_BASE_URL=https://openrouter.ai/api/v1,
ключ OpenRouter, модель вида openai/<модель>.

Запрос ответа: POST {base}/chat/completions {model, messages, tools, max_completion_tokens}.
Ответ: choices[0].message.content и choices[0].message.tool_calls[].function.{name, arguments}.

Результат инструмента обратно в модель мы не отправляем: заявку код сохраняет сам, а если текста рядом
с вызовом не было, делается второй запрос с пометкой «заявка сохранена». Так не нужно возвращать
служебные поля рассуждающих моделей, и клиент одинаково работает у всех провайдеров.

Параметры, которые провайдеры понимают по-разному, клиент подбирает сам:
    · лимит ответа: max_completion_tokens у api.openai.com, max_tokens у остальных;
    · усилие рассуждения: reasoning_effort у OpenAI, reasoning.effort у остальных.
Если провайдер отвечает 400 «такого параметра нет», запрос повторяется без него или с другим именем."""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import re
from dataclasses import dataclass, field
from urllib.parse import urlparse

import httpx

log = logging.getLogger("openai")

RETRY_STATUSES = {429, 500, 502, 503, 504}


@dataclass
class ToolCall:
    name: str
    arguments: dict
    call_id: str = ""


@dataclass
class Reply:
    text: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    error: str = ""
    tokens_in: int = 0
    tokens_out: int = 0
    truncated: bool = False   # ответ оборвался на лимите токенов, текста нет


class OpenAI:
    def __init__(self, api_key: str, base: str, model: str, http: httpx.AsyncClient, *,
                 sleep=asyncio.sleep, attempts: int = 3):
        self.key, self.base, self.model, self.http = api_key, base.rstrip("/"), model, http
        self.sleep, self.attempts = sleep, attempts
        self.is_openai = urlparse(self.base).hostname == "api.openai.com"
        self.token_param = "max_completion_tokens" if self.is_openai else "max_tokens"
        self.drop_reasoning = False

    async def _post(self, path: str, **kwargs) -> tuple[httpx.Response | None, str, str]:
        """POST с повтором на временных сбоях. Возвращает (ответ, ошибка, текст ошибки провайдера)."""
        if not self.key:
            return None, "не задан OPENAI_API_KEY", ""
        error, detail = "запрос не выполнялся", ""
        for attempt in range(1, self.attempts + 1):
            try:
                r = await self.http.post(f"{self.base}{path}", headers={"Authorization": f"Bearer {self.key}"},
                                         timeout=90, **kwargs)
            except httpx.HTTPError as e:
                error = f"запрос к модели не прошёл: {type(e).__name__}"
            else:
                if r.status_code < 300:
                    return r, "", ""
                detail = _api_error(r)
                error = f"модель ответила {r.status_code}: {detail}"
                if r.status_code not in RETRY_STATUSES:
                    return None, error, detail
            if attempt < self.attempts:
                await self.sleep(2 * attempt)
        return None, error, detail

    def _body(self, model: str, instructions: str, messages: list[dict], tools, max_tokens: int,
              reasoning_effort: str) -> dict:
        body: dict = {"model": model, "messages": [{"role": "system", "content": instructions}, *messages],
                      self.token_param: max_tokens}
        if tools:
            body["tools"] = tools
        if reasoning_effort and not self.drop_reasoning:
            if self.is_openai:
                body["reasoning_effort"] = reasoning_effort
            else:
                body["reasoning"] = {"effort": reasoning_effort}
        return body

    async def respond(self, instructions: str, messages: list[dict], *, tools: list[dict] | None = None,
                      max_output_tokens: int = 1200, reasoning_effort: str = "", model: str = "") -> Reply:
        """messages: [{"role": "user" | "assistant", "content": "текст"}, ...]."""
        model = model or self.model
        if not model:
            return Reply(error="не задана OPENAI_MODEL (смотри docs/guides/openai.md)")
        r, error, detail = None, "", ""
        for _ in range(3):
            body = self._body(model, instructions, messages, tools, max_output_tokens, reasoning_effort)
            r, error, detail = await self._post("/chat/completions", json=body)
            if r is not None or "модель ответила 400" not in error:
                break
            low = detail.lower()
            # провайдер не знает параметр: меняем имя лимита токенов или убираем рассуждение и пробуем снова
            if "max_tokens" in low and self.token_param == "max_tokens":
                self.token_param = "max_completion_tokens"
            elif "max_completion_tokens" in low and self.token_param == "max_completion_tokens":
                self.token_param = "max_tokens"
            elif ("reasoning_effort" in body or "reasoning" in body) and not self.drop_reasoning:
                self.drop_reasoning = True
            else:
                break
        if r is None:
            return Reply(error=error)
        try:
            return parse_response(r.json())
        except ValueError:
            return Reply(error="модель вернула не JSON")

    async def transcribe(self, audio: bytes, filename: str, content_type: str, model: str) -> tuple[str, str]:
        """(текст голосового, ошибка). Нужен эндпоинт /audio/transcriptions: он есть у OpenAI, у части
        совместимых адресов его нет, тогда голосовые выключаются в config/assistant.toml."""
        r, error, _ = await self._post("/audio/transcriptions", data={"model": model},
                                       files={"file": (filename, audio, content_type or "application/octet-stream")})
        if r is None:
            log.warning("голосовое не расшифровано: %s", error)
            return "", error
        try:
            return str(r.json().get("text") or "").strip()[:2000], ""
        except ValueError:
            return "", "эндпоинт расшифровки вернул не JSON"

    async def describe_image(self, image: bytes, mime: str, model: str = "") -> tuple[str, str]:
        """(описание в 1-2 предложения, ошибка). Нужна модель с картинками на входе."""
        data_url = f"data:{mime or 'image/jpeg'};base64,{base64.b64encode(image).decode()}"
        content = [
            {"type": "text", "text": "Опиши, что на картинке, в одном-двух предложениях. Если это чек, "
                                     "скриншот оплаты или документ, так и скажи. Текст с картинки перепиши коротко."},
            {"type": "image_url", "image_url": {"url": data_url}},
        ]
        reply = await self.respond("Ты описываешь картинки коротко и по делу, на русском.",
                                   [{"role": "user", "content": content}], max_output_tokens=500, model=model)
        if reply.error:
            log.warning("картинка не описана: %s", reply.error)
        return reply.text.strip()[:500], reply.error


def parse_response(data: dict) -> Reply:
    reply = Reply()
    if not data.get("choices") and data.get("error"):
        # OpenRouter и похожие иногда отвечают 200 с ошибкой в теле
        err = data["error"] if isinstance(data["error"], dict) else {}
        reply.error = f"модель вернула ошибку: {str(err.get('message') or err.get('code') or '')[:160]}"
        return reply
    usage = data.get("usage") or {}
    reply.tokens_in = int(usage.get("prompt_tokens") or 0)
    reply.tokens_out = int(usage.get("completion_tokens") or 0)
    choice = (data.get("choices") or [{}])[0]
    message = choice.get("message") or {}
    content = message.get("content")
    if isinstance(content, list):
        content = "".join(p.get("text", "") for p in content if isinstance(p, dict))
    reply.text = str(content or "").strip()
    for call in message.get("tool_calls") or []:
        function = call.get("function") or {}
        try:
            args = json.loads(function.get("arguments") or "{}")
        except ValueError:
            args = {}
        reply.tool_calls.append(ToolCall(function.get("name") or "", args if isinstance(args, dict) else {},
                                         call.get("id") or ""))
    reply.truncated = choice.get("finish_reason") == "length" and not reply.text and not reply.tool_calls
    return reply


_KEY_LIKE = re.compile(r"\b(?:sk|or)-[A-Za-z0-9_*\-]{6,}")


def _api_error(r: httpx.Response) -> str:
    """Причина отказа от провайдера. Текст про неверный ключ заменяем: провайдеры пишут в нём часть ключа."""
    if r.status_code == 401:
        return "ключ не принят"
    try:
        err = r.json().get("error") or {}
    except (ValueError, AttributeError):
        return ""
    if not isinstance(err, dict):
        return _KEY_LIKE.sub("***", str(err))[:160]
    code = err.get("code") or err.get("type") or ""
    return _KEY_LIKE.sub("***", f"{code} {err.get('message') or ''}".strip())[:200]
