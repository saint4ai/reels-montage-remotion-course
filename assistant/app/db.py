"""SQLite: один файл в томе Docker, без отдельного сервера базы.

Запросы маленькие и быстрые, поэтому обычный sqlite3 под замком. Режим WAL
нужен, чтобы резервная копия и работа сервиса не мешали друг другу."""

from __future__ import annotations

import sqlite3
import threading
from pathlib import Path

SCHEMA = """
create table if not exists events (
  id text primary key, kind text, received_at text);

create table if not exists contacts (
  id integer primary key autoincrement,
  platform text not null, user_id text not null,
  username text default '', name text default '',
  conversation_id text default '', account_id text default '',
  paused_until text, off integer default 0,
  offered integer default 0, lead_saved integer default 0,
  last_user_at text, last_assistant_at text, last_material_at text,
  reminded_at text, created_at text,
  unique (platform, user_id));

create table if not exists messages (
  id integer primary key autoincrement,
  contact_id integer not null, role text not null, body text not null,
  platform_message_id text, processed integer default 0, created_at text not null);
create unique index if not exists messages_platform_id
  on messages (platform_message_id) where platform_message_id is not null and platform_message_id != '';
create index if not exists messages_contact on messages (contact_id, id);

create table if not exists pending (
  contact_id integer primary key, first_at text not null, process_at text not null);

create table if not exists comments (
  comment_id text primary key, user_id text, keyword text, status text, created_at text);

create table if not exists material_log (
  id integer primary key autoincrement, platform text, user_id text, keyword text, sent_at text);

create table if not exists sent (
  message_id text primary key, created_at text);

create table if not exists limits (
  key text not null, day text not null, count integer not null default 0,
  primary key (key, day));

create table if not exists leads (
  id integer primary key autoincrement, contact_id integer,
  name text, need text, contact text, notified integer default 0, created_at text,
  sheet_sent integer default 0);

create table if not exists kv (
  key text primary key, value text);
"""


class DB:
    def __init__(self, path: str | Path):
        if str(path) != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(str(path), check_same_thread=False, isolation_level=None)
        self.conn.row_factory = sqlite3.Row
        self.lock = threading.RLock()
        with self.lock:
            self.conn.execute("pragma journal_mode = wal")
            self.conn.execute("pragma busy_timeout = 5000")
            self.conn.executescript(SCHEMA)
            self._migrate()

    def _migrate(self) -> None:
        """Базы, созданные до появления колонки, получают её при запуске. Данные не трогаются."""
        columns = {row["name"] for row in self.conn.execute("pragma table_info(leads)")}
        if "sheet_sent" not in columns:
            self.conn.execute("alter table leads add column sheet_sent integer default 0")

    def execute(self, sql: str, params: tuple | list = ()) -> sqlite3.Cursor:
        with self.lock:
            return self.conn.execute(sql, params)

    def one(self, sql: str, params: tuple | list = ()) -> sqlite3.Row | None:
        with self.lock:
            return self.conn.execute(sql, params).fetchone()

    def all(self, sql: str, params: tuple | list = ()) -> list[sqlite3.Row]:
        with self.lock:
            return self.conn.execute(sql, params).fetchall()

    def scalar(self, sql: str, params: tuple | list = ()):
        row = self.one(sql, params)
        return row[0] if row else None

    def kv_get(self, key: str, default: str = "") -> str:
        value = self.scalar("select value from kv where key = ?", (key,))
        return default if value is None else value

    def kv_set(self, key: str, value: str) -> None:
        self.execute("insert into kv (key, value) values (?, ?) on conflict(key) do update set value = excluded.value",
                     (key, value))

    def backup_to(self, target: str | Path) -> None:
        """Целостная копия работающей базы (встроенный backup SQLite)."""
        Path(target).parent.mkdir(parents=True, exist_ok=True)
        copy = sqlite3.connect(str(target))
        try:
            with self.lock:
                self.conn.backup(copy)
        finally:
            copy.close()

    def close(self) -> None:
        with self.lock:
            self.conn.close()
