"""Пробный ответ ассистента без отправки: так настраивают промпт и базу знаний.

    python -m app.try "сколько стоит?" "как записаться?"          каждый вопрос отдельно
    python -m app.try --dialog "привет" "а что по цене?"          вопросы как один разговор

Ничего не уходит людям и в Telegram, заявка только печатается. Нужны OPENAI_API_KEY и OPENAI_MODEL."""

from __future__ import annotations

import argparse
import asyncio

from app import assistant as brain
from app import console, store
from app.context import Ctx
from app.settings import Settings


async def run(questions: list[str], *, dialog: bool = False, settings: Settings | None = None, out=print) -> int:
    settings = settings or Settings.from_env()
    settings.db_path = ":memory:"
    ctx = Ctx.build(settings)
    code = 0
    try:
        contact = store.upsert_contact(ctx.db, "instagram", "try-user", username="try_user", name="")
        history: list[dict] = []
        for question in questions:
            if not dialog:
                history = []
            history.append({"role": "user", "content": question})

            async def on_lead(args: dict) -> str:
                out(f"   [заявка была бы сохранена: {args}]")
                return "заявка сохранена"

            fresh = store.get_contact(ctx.db, contact["id"])
            answer = await brain.generate(ctx, fresh, question, history, on_lead=on_lead)
            out(f"\nВопрос: {question}")
            if answer.error:
                out(f"ОШИБКА: {answer.error}")
                code = 1
                continue
            out(f"Намерение: {answer.intent}")
            out(f"Ответ ({len(answer.text)} знаков): {answer.text}")
            if answer.fallback:
                out("ЗАГОТОВКА: ответ модели не прошёл проверки: " + "; ".join(answer.problems))
            else:
                out("Проверки: OK")
            history.append({"role": "assistant", "content": answer.text})
            if not answer.fallback:
                brain.mark_offered(ctx, contact["id"], answer.intent)
    finally:
        await ctx.close()
    return code


def main() -> None:
    console.utf8()
    parser = argparse.ArgumentParser(description="Пробный ответ ассистента без отправки")
    parser.add_argument("questions", nargs="+", help="вопрос человека")
    parser.add_argument("--dialog", action="store_true", help="считать вопросы одним разговором")
    args = parser.parse_args()
    raise SystemExit(asyncio.run(run(args.questions, dialog=args.dialog)))
