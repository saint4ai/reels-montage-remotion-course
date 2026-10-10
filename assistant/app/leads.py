"""Заявка: сохранить, отправить владельцу в Telegram, поставить диалог на паузу.

Потерянная заявка это худшее, что может случиться: человек оставил контакт и ждёт. Поэтому заявка
сначала пишется в базу, потом уходит в Telegram, а если Telegram не ответил, отправка повторяется
каждую минуту, пока не дойдёт (retry_unsent)."""

from __future__ import annotations

import logging
import re

from app import clock, store
from app.context import Ctx
from app.telegram import keyboard

log = logging.getLogger("leads")

PLATFORM_NAMES = {"instagram": "Instagram", "whatsapp": "WhatsApp", "telegram": "Telegram"}
FIELD_LIMIT = 400


def _clean(value) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()[:FIELD_LIMIT]


def dialog_link(contact) -> str:
    """Ссылка, по которой владелец откроет диалог. Для WhatsApp это номер, для остальных ник."""
    platform, user, nick = contact["platform"], contact["user_id"], (contact["username"] or "").lstrip("@")
    if platform == "instagram" and nick:
        return f"https://ig.me/m/{nick}"
    if platform == "telegram" and nick:
        return f"https://t.me/{nick}"
    if platform == "whatsapp" and re.fullmatch(r"\d{7,15}", user or ""):
        return f"https://wa.me/{user}"
    return ""


def format_lead(contact, lead: dict, pause_hours: int) -> str:
    who = _clean(lead.get("name")) or _clean(contact["name"]) or "без имени"
    nick = f" (@{contact['username'].lstrip('@')})" if contact["username"] else ""
    link = dialog_link(contact)
    lines = [
        "Новая заявка",
        f"Кто: {who}{nick}, {PLATFORM_NAMES.get(contact['platform'], contact['platform'])}",
        f"Что нужно: {_clean(lead.get('need')) or 'не уточнил'}",
        f"Контакт: {_clean(lead.get('contact')) or 'не оставил, напиши в диалоге'}",
        f"Диалог: {link or 'ссылки нет, открой переписку в приложении'}",
        f"Ассистент в этом диалоге на паузе {pause_hours} ч.",
    ]
    return "\n".join(lines)


async def save_lead(ctx: Ctx, contact, args: dict) -> str:
    """Выполняет вызов модели save_lead. Возвращает короткий итог для журнала."""
    db, cfg = ctx.db, ctx.config.assistant()
    pause_hours = int(cfg["lead"]["pause_hours"])
    lead = {"name": _clean(args.get("name")), "need": _clean(args.get("need")), "contact": _clean(args.get("contact"))}
    if not any(lead.values()):
        return "пустая заявка, пропущена"

    # Модель может позвать инструмент дважды за один разговор: вторую заявку за сутки не создаём
    recent = db.one("select created_at from leads where contact_id = ? order by id desc limit 1", (contact["id"],))
    last = clock.parse(recent["created_at"]) if recent else None
    if last and (clock.now() - last).total_seconds() < 24 * 3600:
        return "заявка уже была сегодня"

    cur = db.execute("insert into leads (contact_id, name, need, contact, created_at) values (?, ?, ?, ?, ?)",
                     (contact["id"], lead["name"], lead["need"], lead["contact"], clock.iso()))
    db.execute("update contacts set lead_saved = 1 where id = ?", (contact["id"],))
    store.pause_until(db, contact["id"], clock.plus(hours=pause_hours))
    fresh = store.get_contact(db, contact["id"])
    sent = await ctx.telegram.send(format_lead(fresh, lead, pause_hours), keyboard(contact["id"]))
    if sent:
        db.execute("update leads set notified = 1 where id = ?", (cur.lastrowid,))
    log.info("заявка %s сохранена, Telegram: %s", cur.lastrowid, "доставлено" if sent else "повторим")
    return "заявка сохранена"


async def retry_unsent(ctx: Ctx) -> int:
    """Повторяет отправку заявок, которые не дошли до Telegram. Возвращает, сколько ушло."""
    if not ctx.telegram.configured:
        return 0
    pause_hours = int(ctx.config.assistant()["lead"]["pause_hours"])
    done = 0
    for row in ctx.db.all("select * from leads where notified = 0 order by id limit 10"):
        contact = store.get_contact(ctx.db, row["contact_id"])
        if not contact:
            continue
        lead = {"name": row["name"], "need": row["need"], "contact": row["contact"]}
        if await ctx.telegram.send(format_lead(contact, lead, pause_hours), keyboard(contact["id"])):
            ctx.db.execute("update leads set notified = 1 where id = ?", (row["id"],))
            done += 1
    return done
