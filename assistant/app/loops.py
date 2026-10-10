"""Фоновые циклы сервиса: накопитель ответов, напоминания, кнопки Telegram, уборка."""

from __future__ import annotations

import asyncio
import logging

from app import handlers, leads, reminders, store
from app.context import Ctx

log = logging.getLogger("loops")


async def button_action(ctx: Ctx, action: str, contact_id: int) -> str:
    """Нажатие «Включить ассистента» или «Выключить» под заявкой."""
    if not store.get_contact(ctx.db, contact_id):
        return "Диалог не найден"
    store.set_assistant(ctx.db, contact_id, action == "on")
    return "Ассистент в этом диалоге включён" if action == "on" else "Ассистент в этом диалоге выключен"


async def _forever(ctx: Ctx, name: str, step, pause: float) -> None:
    """Запускает step() по кругу. Сбой одного круга пишется в журнал и цикл не останавливает."""
    while True:
        try:
            ctx.heartbeat(name)
            await step()
        except asyncio.CancelledError:
            raise
        except Exception as e:
            log.exception("цикл %s споткнулся: %s", name, type(e).__name__)
            await asyncio.sleep(5)
        # долгую паузу спим кусками, чтобы /health видел, что цикл жив
        left = pause
        while left > 0:
            chunk = min(left, 30)
            await asyncio.sleep(chunk)
            ctx.heartbeat(name)
            left -= chunk


async def dialog_loop(ctx: Ctx) -> None:
    await _forever(ctx, "dialogs", lambda: handlers.process_due(ctx), 0.5)


async def reminder_loop(ctx: Ctx) -> None:
    await _forever(ctx, "reminders", lambda: reminders.run_once(ctx), 60)


async def cleanup_loop(ctx: Ctx) -> None:
    async def step():
        store.forget_old(ctx.db)
    await _forever(ctx, "cleanup", step, 3600)


async def telegram_loop(ctx: Ctx) -> None:
    """Длинный опрос кнопок. Заодно повторяет отправку заявок, которые не дошли."""
    state = {"offset": int(ctx.db.kv_get("tg_offset", "0") or 0)}

    async def step():
        if not ctx.telegram.configured:
            await asyncio.sleep(60)
            return
        await leads.retry_unsent(ctx)
        handle = lambda action, contact_id: button_action(ctx, action, contact_id)
        state["offset"], ok = await ctx.telegram.poll_once(state["offset"], handle)
        ctx.db.kv_set("tg_offset", str(state["offset"]))
        if not ok:
            await asyncio.sleep(10)

    await _forever(ctx, "telegram", step, 0.2)
