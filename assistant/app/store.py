"""Запросы к базе: люди, сообщения, пауза, накопитель, лимиты."""

from __future__ import annotations

import sqlite3
from datetime import timedelta

from app import clock
from app.db import DB

Row = sqlite3.Row


# ── люди ────────────────────────────────────────────────────────────

def upsert_contact(db: DB, platform: str, user_id: str, *, username: str = "", name: str = "",
                   conversation_id: str = "", account_id: str = "") -> Row:
    """Создаёт человека или обновляет его ник, имя и маршрут ответа (пустые значения старое не стирают)."""
    db.execute("insert or ignore into contacts (platform, user_id, created_at) values (?, ?, ?)",
               (platform, user_id, clock.iso()))
    db.execute(
        "update contacts set username = coalesce(nullif(?, ''), username), name = coalesce(nullif(?, ''), name),"
        " conversation_id = coalesce(nullif(?, ''), conversation_id),"
        " account_id = coalesce(nullif(?, ''), account_id) where platform = ? and user_id = ?",
        (username, name, conversation_id, account_id, platform, user_id))
    return db.one("select * from contacts where platform = ? and user_id = ?", (platform, user_id))


def get_contact(db: DB, contact_id: int) -> Row | None:
    return db.one("select * from contacts where id = ?", (contact_id,))


def is_paused(contact: Row) -> bool:
    """Диалог выключен кнопкой или стоит на паузе (после заявки или ручного ответа владельца)."""
    if contact["off"]:
        return True
    until = clock.parse(contact["paused_until"])
    return bool(until and until > clock.now())


def pause_until(db: DB, contact_id: int, until_iso: str) -> None:
    """Пауза только удлиняется: ручной ответ не сокращает паузу после заявки."""
    db.execute("update contacts set paused_until = ? where id = ? and (paused_until is null or paused_until < ?)",
               (until_iso, contact_id, until_iso))


def set_assistant(db: DB, contact_id: int, on: bool) -> None:
    """Кнопки под заявкой. Включить: снять паузу и выключатель. Выключить: насовсем, пока не включат."""
    if on:
        db.execute("update contacts set off = 0, paused_until = null where id = ?", (contact_id,))
    else:
        db.execute("update contacts set off = 1 where id = ?", (contact_id,))


# ── сообщения ───────────────────────────────────────────────────────

def add_message(db: DB, contact_id: int, role: str, body: str, platform_message_id: str = "") -> int | None:
    """Кладёт сообщение в историю. Повтор того же platform_message_id возвращает None (дубль доставки)."""
    try:
        cur = db.execute(
            "insert into messages (contact_id, role, body, platform_message_id, processed, created_at)"
            " values (?, ?, ?, ?, ?, ?)",
            (contact_id, role, body, platform_message_id or None, 0 if role == "user" else 1, clock.iso()))
    except sqlite3.IntegrityError:
        return None
    return cur.lastrowid


def history(db: DB, contact_id: int, limit: int) -> list[dict]:
    """Последние сообщения диалога по порядку. Пометки владельца и системные в модель идут как ассистент.

    Разговор всегда начинается с реплики человека: часть провайдеров (Anthropic через OpenRouter)
    отклоняет запрос, где первым стоит ответ ассистента."""
    rows = db.all("select role, body from messages where contact_id = ? order by id desc limit ?", (contact_id, limit))
    result = [{"role": "user" if r["role"] == "user" else "assistant", "content": r["body"]} for r in reversed(rows)]
    while result and result[0]["role"] != "user":
        result.pop(0)
    return result


def unprocessed(db: DB, contact_id: int) -> list[Row]:
    return db.all("select id, body from messages where contact_id = ? and role = 'user' and processed = 0 order by id",
                  (contact_id,))


def mark_processed(db: DB, contact_id: int, upto_id: int) -> None:
    db.execute("update messages set processed = 1 where contact_id = ? and role = 'user' and id <= ?",
               (contact_id, upto_id))


# ── накопитель ответов ──────────────────────────────────────────────

def queue_reply(db: DB, contact_id: int, delay: float, max_wait: float) -> None:
    """Каждое новое сообщение сдвигает ответ на delay секунд, но не дальше max_wait от первого."""
    now = clock.now()
    row = db.one("select first_at from pending where contact_id = ?", (contact_id,))
    first = (clock.parse(row["first_at"]) if row else None) or now
    due = min(now + timedelta(seconds=delay), first + timedelta(seconds=max_wait))
    db.execute(
        "insert into pending (contact_id, first_at, process_at) values (?, ?, ?)"
        " on conflict(contact_id) do update set process_at = excluded.process_at",
        (contact_id, clock.iso(first), clock.iso(due)))


def take_due(db: DB, limit: int = 20) -> list[int]:
    """Забирает тех, чей срок вышел, и сразу удаляет из очереди."""
    rows = db.all("select contact_id from pending where process_at <= ? order by process_at limit ?",
                  (clock.iso(), limit))
    ids = [r["contact_id"] for r in rows]
    for cid in ids:
        db.execute("delete from pending where contact_id = ?", (cid,))
    return ids


# ── лимиты ──────────────────────────────────────────────────────────

def hit_limit(db: DB, key: str, cap: int) -> bool:
    """Засчитывает действие и говорит, можно ли оно: True пока в сутках не больше cap. Один запрос."""
    day = clock.today()
    with db.lock:
        row = db.one("select count from limits where key = ? and day = ?", (key, day))
        count = (row["count"] if row else 0) + 1
        if count > cap:
            return False
        db.execute("insert into limits (key, day, count) values (?, ?, ?)"
                   " on conflict(key, day) do update set count = excluded.count", (key, day, count))
    return True


def count_today(db: DB, key: str) -> int:
    return db.scalar("select count from limits where key = ? and day = ?", (key, clock.today())) or 0


def forget_old(db: DB, days: int = 7) -> None:
    """Чистка: старые счётчики, события и отметки об отправленных."""
    cutoff = clock.plus(hours=-24 * days)
    db.execute("delete from events where received_at < ?", (cutoff,))
    db.execute("delete from sent where created_at < ?", (cutoff,))
    db.execute("delete from material_log where sent_at < ?", (cutoff,))
    db.execute("delete from comments where created_at < ?", (clock.plus(hours=-24 * 30),))
    db.execute("delete from limits where day < ?", (cutoff[:10],))
