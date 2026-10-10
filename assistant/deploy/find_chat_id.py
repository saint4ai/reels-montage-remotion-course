"""Показывает id чатов, которые писали боту (нужен TELEGRAM_LEAD_CHAT_ID). Токен берётся из .env и не печатается.

    python deploy/find_chat_id.py [--env assistant/.env]

Сначала открой бота в Telegram и нажми Start (для группы: добавь бота и напиши /start@имя_бота).
Команда читает последние обновления бота (getUpdates). Если для бота включён вебхук или уже работает
сервис ассистента с опросом кнопок, getUpdates не отдаст ничего: запускай до установки на сервер."""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx  # noqa: E402

from app.settings import Settings, parse_dotenv  # noqa: E402
from app.telegram import Telegram  # noqa: E402


def chats_from_updates(result: list[dict]) -> dict[int, str]:
    """{id чата: подпись}. Берём чаты из сообщений, нажатий кнопок и событий входа в группу."""
    found: dict[int, str] = {}
    for update in result:
        for key in ("message", "edited_message", "channel_post", "my_chat_member"):
            part = update.get(key) or (update.get("callback_query") or {}).get("message")
            chat = (part or {}).get("chat") if isinstance(part, dict) else None
            if not chat or "id" not in chat:
                continue
            kind = {"private": "личный чат", "group": "группа", "supergroup": "группа", "channel": "канал"}.get(
                chat.get("type"), chat.get("type") or "чат")
            title = chat.get("title") or " ".join(x for x in (chat.get("first_name"), chat.get("last_name")) if x) \
                or chat.get("username") or ""
            found[int(chat["id"])] = f"{kind} {title}".strip()
    return found


async def run(env_path: Path, out=print) -> int:
    settings = Settings.from_env(parse_dotenv(env_path))
    if not settings.telegram_bot_token:
        out("ОШИБКА: в .env нет TELEGRAM_BOT_TOKEN. Сначала: python deploy/set_env.py TELEGRAM_BOT_TOKEN --service telegram-bot --delete")
        return 1
    async with httpx.AsyncClient(timeout=30) as http:
        telegram = Telegram(settings.telegram_bot_token, "0", settings.telegram_api_base, http)
        reply = await telegram.call("getUpdates", {"timeout": 0, "limit": 100})
    if not reply.get("ok"):
        out("ОШИБКА: Telegram не ответил. Проверь токен и что у бота не включён вебхук.")
        return 1
    chats = chats_from_updates(reply.get("result") or [])
    if not chats:
        out("Пока ни одного чата. Открой бота в Telegram, нажми Start (в группе: /start@имя_бота) и запусти команду снова.")
        return 1
    for chat_id, label in chats.items():
        out(f"{chat_id}  {label}")
    return 0


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description="id чатов Telegram, которые писали боту")
    parser.add_argument("--env", default=str(Path(__file__).resolve().parent.parent / ".env"))
    args = parser.parse_args()
    raise SystemExit(asyncio.run(run(Path(args.env))))


if __name__ == "__main__":
    main()
