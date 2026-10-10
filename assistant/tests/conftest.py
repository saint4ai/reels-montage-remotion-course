"""Общие заготовки тестов. Настоящих запросов в интернет нет: все адреса подменяются через respx."""

from __future__ import annotations

import hashlib
import hmac
import json
import shutil
from pathlib import Path

import httpx
import pytest
import respx

from app import clock
from app.context import Ctx
from app.main import create_app
from app.settings import Settings

ROOT = Path(__file__).resolve().parent.parent

WEBHOOK_SECRET = "test-webhook-secret-0123456789abcdef"
ZERNIO_KEY = "zernio-test-key-aaaaaaaaaaaa"
OPENAI_KEY = "openai-test-key-bbbbbbbbbbbb"
TG_TOKEN = "123456789:TELEGRAM-test-token-cccccc"
CHAT = "-100500"
ZERNIO = "https://zernio.test/api/v1"
OPENAI = "https://openai.test/v1"
TG = "https://tg.test"

KEYWORDS = '''
[[keyword]]
word = "ПАПКА"
title = "папка"
variants = ["папку"]
message = """Держи папку со стартовым набором

https://example.com/start.zip

Как запустить:
1. Распакуй архив
2. Открой папку в Claude
3. Напиши первое сообщение
4. Следуй подсказкам

Нужно: подписка Claude"""

[[keyword]]
word = "сайт"
match = "exact"
message = "Держи шаблон сайта: https://example.com/site"

[[keyword]]
word = "mcp"
message = "Держи подборку MCP: https://example.com/mcp"

[[keyword]]
word = "github"
message = "Держи ссылки GitHub: https://example.com/gh"

[[keyword]]
word = "гитхаб"
message = "Держи ссылки по гитхабу: https://example.com/gh2"

[[keyword]]
word = "ролик"
comments_only = true
message = "Держи ролик: https://example.com/reel"

[[keyword]]
word = "черновик"
active = false
message = "Это черновик"
'''

PROMPT = "# Роль\nТы ассистент мастерской Тест. Отвечай на ты, коротко.\n"
KNOWLEDGE = """# Услуги
## Консультация
- Цена: 9 990 ₸
- Ссылка для записи: https://example.com/book
- Срок: один час
"""


@pytest.fixture
def workdir(tmp_path):
    """Копия конфигов проекта с тестовыми кодовыми словами, промптом и базой знаний."""
    for name in ("config", "prompts", "knowledge"):
        shutil.copytree(ROOT / name, tmp_path / name)
    (tmp_path / "config" / "keywords.toml").write_text(KEYWORDS, encoding="utf-8")
    (tmp_path / "prompts" / "assistant.md").write_text(PROMPT, encoding="utf-8")
    for old in (tmp_path / "knowledge").glob("*.md"):
        old.unlink()
    (tmp_path / "knowledge" / "01.md").write_text(KNOWLEDGE, encoding="utf-8")
    return tmp_path


def make_settings(workdir: Path, **over) -> Settings:
    values = dict(
        zernio_api_key=ZERNIO_KEY, zernio_webhook_secret=WEBHOOK_SECRET, zernio_api_base=ZERNIO,
        openai_api_key=OPENAI_KEY, openai_model="test-model", openai_base_url=OPENAI,
        telegram_bot_token=TG_TOKEN, telegram_lead_chat_id=CHAT, telegram_api_base=TG,
        domain="assistant.test", db_path=":memory:", assistant_enabled=True,
        config_dir=workdir / "config", prompts_dir=workdir / "prompts", knowledge_dir=workdir / "knowledge")
    values.update(over)
    return Settings(**values)


async def no_sleep(_seconds: float) -> None:
    return None


@pytest.fixture
def settings(workdir):
    return make_settings(workdir)


@pytest.fixture
def ctx(settings):
    context = Ctx.build(settings, sleep=no_sleep)
    yield context
    context.db.close()


class Net:
    """Подменённый интернет: Zernio, модель и Telegram. Хранит все запросы для проверок."""

    def __init__(self, router: respx.MockRouter):
        self.router = router
        self.model_replies: list[httpx.Response | dict] = []
        self.model_requests: list[dict] = []
        self.sent = []          # (url path, json) исходящие в Zernio
        self.telegram: list[dict] = []
        self.zernio_status: dict[str, httpx.Response] = {}
        self.telegram_override = None   # функция запрос -> ответ, если тесту нужен особый Telegram

        router.route(method="POST", url__regex=rf"{ZERNIO}/inbox/.*").mock(side_effect=self._zernio)
        router.post(f"{OPENAI}/chat/completions").mock(side_effect=self._model)
        router.route(url__regex=rf"{TG}/bot.*").mock(side_effect=self._telegram)

    # ── Zernio ──
    def _zernio(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path.replace("/api/v1", "")
        body = json.loads(request.content or b"{}")
        self.sent.append({"path": path, "json": body, "headers": dict(request.headers)})
        for key, response in self.zernio_status.items():
            if key in path:
                # список ответов отдаётся по очереди, последний остаётся навсегда
                if isinstance(response, list):
                    return response.pop(0) if len(response) > 1 else response[0]
                return response
        return httpx.Response(200, json={"success": True, "data": {"messageId": f"sent-{len(self.sent)}"}})

    def sent_to(self, fragment: str) -> list[dict]:
        return [s for s in self.sent if fragment in s["path"]]

    # ── модель ──
    def reply(self, text: str = "", tool_calls: list[dict] | None = None, status: int = 200) -> None:
        message: dict = {"role": "assistant", "content": text}
        if tool_calls:
            message["tool_calls"] = [
                {"id": f"call_{i}", "type": "function",
                 "function": {"name": c["name"], "arguments": json.dumps(c["arguments"], ensure_ascii=False)}}
                for i, c in enumerate(tool_calls)]
        self.model_replies.append(httpx.Response(status, json={
            "choices": [{"index": 0, "message": message, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 100, "completion_tokens": 20}}))

    def _model(self, request: httpx.Request) -> httpx.Response:
        self.model_requests.append(json.loads(request.content))
        if self.model_replies:
            return self.model_replies.pop(0)
        return httpx.Response(200, json={"choices": [{"message": {"content": "Ответ по умолчанию."}, "finish_reason": "stop"}]})

    # ── Telegram ──
    def _telegram(self, request: httpx.Request) -> httpx.Response:
        if self.telegram_override:
            return self.telegram_override(request)
        method = request.url.path.rsplit("/", 1)[-1]
        body = json.loads(request.content or b"{}")
        self.telegram.append({"method": method, "json": body})
        return httpx.Response(200, json={"ok": True, "result": {}})

    def telegram_texts(self) -> list[str]:
        return [t["json"].get("text", "") for t in self.telegram if t["method"] == "sendMessage"]


@pytest.fixture
def net():
    with respx.mock(assert_all_called=False) as router:
        yield Net(router)


# ── сборщики событий Zernio ──────────────────────────────────────────

def message_event(text: str = "привет", *, user: str = "user1", platform: str = "instagram", message_id: str = "pm1",
                  event_id: str | None = None, username: str = "client_one", attachments=None, metadata=None,
                  direction: str = "incoming", conversation: str = "conv1", account: str = "acc1") -> dict:
    event = {
        "id": event_id or f"evt-{message_id}",
        "event": "message.received",
        "message": {"id": f"zm-{message_id}", "conversationId": conversation, "platform": platform,
                    "platformMessageId": message_id, "direction": direction, "text": text,
                    "attachments": attachments or [],
                    "sender": {"id": user, "name": "Клиент", "username": username}},
        "conversation": {"id": conversation, "platformConversationId": f"p-{conversation}",
                         "participantId": user, "participantUsername": username},
        "account": {"id": account, "accountId": account, "platform": platform, "username": "owner_acc"},
        "timestamp": "2026-10-10T10:00:00Z",
    }
    if metadata:
        event["metadata"] = metadata
    return event


def comment_event(text: str = "ПАПКА", *, comment_id: str = "c1", user: str = "user1", username: str = "client_one",
                  event_id: str | None = None, post: str = "post1", account: str = "acc1", **extra) -> dict:
    author = {"id": user, "username": username, "name": "Клиент"}
    author.update(extra.pop("author", {}))
    comment = {"id": comment_id, "postId": None, "platformPostId": post, "platform": "instagram", "text": text,
               "author": author, "createdAt": "2026-10-10T10:00:00Z", "isReply": False, "parentCommentId": None}
    comment.update(extra)
    return {"id": event_id or f"evt-{comment_id}", "event": "comment.received", "comment": comment,
            "post": {"id": None, "platformPostId": post, "content": None, "imageUrl": None, "permalink": None},
            "account": {"id": account, "accountId": account, "platform": "instagram", "username": "owner_acc"},
            "timestamp": "2026-10-10T10:00:00Z"}


def echo_event(text: str = "Привет, это я", *, user: str = "user1", message_id: str = "own1", sent_via=None,
               platform: str = "instagram") -> dict:
    return {"id": f"evt-{message_id}", "event": "message.sent",
            "message": {"id": f"zm-{message_id}", "conversationId": "conv1", "platform": platform,
                        "platformMessageId": message_id, "direction": "outgoing", "text": text,
                        "sentVia": sent_via},
            "conversation": {"id": "conv1", "participantId": user, "participantUsername": "client_one"},
            "account": {"id": "acc1", "accountId": "acc1", "platform": platform, "username": "owner_acc"},
            "timestamp": "2026-10-10T10:00:00Z"}


def sign(raw: bytes, secret: str = WEBHOOK_SECRET) -> str:
    return hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()


def advance(monkeypatch, seconds: float = 0, hours: float = 0) -> None:
    """Сдвигает часы на указанное время от текущих."""
    from datetime import timedelta
    base = clock.now()
    monkeypatch.setattr(clock, "now", lambda: base + timedelta(seconds=seconds, hours=hours))
