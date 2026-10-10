"""Одно напоминание человеку, который замолчал после ответа ассистента.

Условия (все сразу):
    · последним писал ассистент, человек молчит не меньше after_hours часов;
    · окно Meta 24 часа ещё открыто (считаем с запасом, window_hours) и сейчас не ночь;
    · заявки нет, диалог не на паузе и не выключен кнопкой;
    · напоминание одно на человека, второго не бывает.

Текст берётся из config/texts.toml, раздел [reminder]: без запроса к модели и без обещаний."""

from __future__ import annotations

import logging
from datetime import timedelta

from app import clock, store, texts
from app.context import Ctx
from app.handlers import send_text

log = logging.getLogger("reminders")


def in_quiet_hours(hour: int, start: int, end: int) -> bool:
    """Ночь может переходить через полночь: с 22 до 9."""
    return start <= hour or hour < end if start > end else start <= hour < end


async def run_once(ctx: Ctx) -> int:
    cfg = ctx.config.assistant()
    r = cfg["reminder"]
    templates = (ctx.config.texts().get("reminder") or {}).get("templates") or []
    if not r["enabled"] or not templates or not ctx.assistant_enabled():
        return 0
    now = clock.now()
    local_hour = (now + timedelta(hours=float(r["tz_offset_hours"]))).hour
    quiet = in_quiet_hours(local_hour, int(r["quiet_from"]), int(r["quiet_to"]))
    sent = 0
    rows = ctx.db.all(
        "select * from contacts where last_assistant_at is not null and reminded_at is null and lead_saved = 0"
        " and off = 0 and (last_user_at is null or last_assistant_at > last_user_at)")
    for contact in rows:
        if store.is_paused(contact) or not contact["conversation_id"]:
            continue
        silent = now - clock.parse(contact["last_assistant_at"])
        if silent < timedelta(hours=float(r["after_hours"])):
            continue
        last_user = clock.parse(contact["last_user_at"])
        if not last_user or now - last_user > timedelta(hours=float(r["window_hours"])):
            # окно закрылось, писать уже нельзя: отмечаем, чтобы не проверять человека снова и снова
            ctx.db.execute("update contacts set reminded_at = ? where id = ?", (clock.iso(), contact["id"]))
            continue
        if quiet:
            continue
        text = texts.pick_varied(templates, "reminder")
        result = await send_text(ctx, contact, text)
        if not result.ok:
            log.warning("напоминание человеку %s не ушло: %s", contact["id"], result.error)
            continue
        store.add_message(ctx.db, contact["id"], "assistant", text)
        ctx.db.execute("update contacts set reminded_at = ?, last_assistant_at = ? where id = ?",
                       (clock.iso(), clock.iso(), contact["id"]))
        sent += 1
    return sent
