"""Заявка: сохранить, отправить владельцу в Telegram, поставить диалог на паузу.

Потерянная заявка это худшее, что может случиться: человек оставил контакт и ждёт. Поэтому заявка
сначала пишется в базу, потом уходит в Telegram, а если Telegram не ответил, отправка повторяется
каждую минуту, пока не дойдёт (retry_unsent).

Необязательная копия в Google Таблицу (LEADS_WEBHOOK_URL): та же заявка отправляется POST-запросом на веб-приложение Apps Script.
Таблица не главное: её сбой пишется в журнал, а Telegram и сама заявка от него не зависят."""

from __future__ import annotations

import logging
import re
from datetime import timedelta

import httpx

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


def sheet_payload(contact, lead: dict, created_at: str, secret: str = "") -> dict:
    """Строка для Google Таблицы: те же поля, что в сообщении Telegram. Время в UTC (ISO), Таблица сама переведёт в свой пояс."""
    nick = f"@{contact['username'].lstrip('@')}" if contact["username"] else ""
    payload = {
        "time": created_at,
        "channel": PLATFORM_NAMES.get(contact["platform"], contact["platform"]),
        "name": _clean(lead.get("name")) or _clean(contact["name"]) or nick or "без имени",
        "nick": nick,
        "need": _clean(lead.get("need")) or "не уточнил",
        "contact": _clean(lead.get("contact")) or "не оставил",
        "dialog": dialog_link(contact),
    }
    if secret:
        payload["secret"] = secret
    return payload


async def _post_sheet(ctx: Ctx, payload: dict) -> tuple[bool, str]:
    """Один запрос на веб-приложение Apps Script. Возвращает (удалось, причина). Адрес в журнал не пишем: в нём секрет."""
    if ctx.settings.dry_run:
        log.info("DRY_RUN, не отправлено: строка в Google Таблицу")
        return True, ""
    try:
        # Apps Script отвечает на POST перенаправлением на страницу с ответом: идём за ним
        r = await ctx.http.post(ctx.settings.leads_webhook_url, json=payload, follow_redirects=True, timeout=15)
    except httpx.HTTPError as e:
        return False, type(e).__name__
    if r.status_code >= 400:
        return False, f"ответ {r.status_code}"
    try:
        body = r.json()
    except ValueError:
        return True, "ответ без JSON"
    if isinstance(body, dict) and body.get("ok") is False:
        return False, str(body.get("error") or "таблица отказала")[:80]
    return True, ""


async def send_to_sheet(ctx: Ctx, lead_id: int, contact, lead: dict, created_at: str) -> bool:
    """Копия заявки в Google Таблицу. Выключена (адрес пуст): ничего не делает. Любая ошибка остаётся внутри."""
    if not ctx.settings.leads_webhook_url:
        return False
    try:
        ok, why = await _post_sheet(ctx, sheet_payload(contact, lead, created_at, ctx.settings.leads_webhook_secret))
    except Exception as e:  # заявка важнее таблицы: что бы ни случилось, наружу это не выходит
        ok, why = False, type(e).__name__
    if ok:
        ctx.db.execute("update leads set sheet_sent = 1 where id = ?", (lead_id,))
    else:
        log.warning("заявка %s в Google Таблицу не ушла (%s), повторим", lead_id, why)
    return ok


async def ping_sheet(ctx: Ctx) -> tuple[bool, str]:
    """Проверочный запрос для `python -m app.check --send-test`: Таблица проверяет секрет и не добавляет строку."""
    payload = {"test": True}
    if ctx.settings.leads_webhook_secret:
        payload["secret"] = ctx.settings.leads_webhook_secret
    return await _post_sheet(ctx, payload)


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
    # Таблица после Telegram и отдельно от него: её сбой владельцу заявку не отменяет
    created = db.scalar("select created_at from leads where id = ?", (cur.lastrowid,))
    await send_to_sheet(ctx, cur.lastrowid, fresh, lead, created)
    return "заявка сохранена"


async def retry_sheet(ctx: Ctx) -> int:
    """Повторяет отправку в Таблицу для заявок последних суток, которые туда не дошли. Не чаще раза в минуту. Возвращает, сколько ушло."""
    if not ctx.settings.leads_webhook_url:
        return 0
    last = clock.parse(ctx.db.kv_get("sheet_retry_at"))
    if last and (clock.now() - last).total_seconds() < 60:
        return 0
    ctx.db.kv_set("sheet_retry_at", clock.iso())
    since = clock.iso(clock.now() - timedelta(hours=24))
    done = 0
    for row in ctx.db.all("select * from leads where sheet_sent = 0 and created_at > ? order by id limit 10", (since,)):
        contact = store.get_contact(ctx.db, row["contact_id"])
        if not contact or not ctx.settings.sender_allowed(contact["user_id"], contact["username"]):
            continue
        lead = {"name": row["name"], "need": row["need"], "contact": row["contact"]}
        if await send_to_sheet(ctx, row["id"], contact, lead, row["created_at"]):
            done += 1
    return done


async def retry_unsent(ctx: Ctx) -> int:
    """Повторяет отправку заявок, которые не дошли до Telegram (и до Таблицы). Возвращает, сколько ушло в Telegram."""
    await retry_sheet(ctx)
    if not ctx.telegram.configured:
        return 0
    pause_hours = int(ctx.config.assistant()["lead"]["pause_hours"])
    done = 0
    for row in ctx.db.all("select * from leads where notified = 0 order by id limit 10"):
        contact = store.get_contact(ctx.db, row["contact_id"])
        if not contact or not ctx.settings.sender_allowed(contact["user_id"], contact["username"]):
            continue
        lead = {"name": row["name"], "need": row["need"], "contact": row["contact"]}
        if await ctx.telegram.send(format_lead(contact, lead, pause_hours), keyboard(contact["id"])):
            ctx.db.execute("update leads set notified = 1 where id = ?", (row["id"],))
            done += 1
    return done
