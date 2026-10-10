"""Общий контекст сервиса: настройки, база, конфиги и клиенты внешних сервисов в одном объекте."""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field

import httpx

from app import clock
from app.config import Config
from app.db import DB
from app.openai_client import OpenAI
from app.settings import Settings
from app.telegram import Telegram
from app.zernio import Zernio

log = logging.getLogger("ctx")


@dataclass
class Ctx:
    settings: Settings
    db: DB
    config: Config
    http: httpx.AsyncClient
    zernio: Zernio
    openai: OpenAI
    telegram: Telegram
    sleep: object = asyncio.sleep
    beat: dict = field(default_factory=dict)  # когда каждый фоновый цикл делал последний круг

    @classmethod
    def build(cls, settings: Settings, *, db: DB | None = None, http: httpx.AsyncClient | None = None,
              sleep=asyncio.sleep) -> "Ctx":
        http = http or httpx.AsyncClient(timeout=20)
        return cls(
            settings=settings,
            db=db or DB(settings.db_path),
            config=Config(settings),
            http=http,
            zernio=Zernio(settings.zernio_api_key, settings.zernio_api_base, http, sleep=sleep),
            openai=OpenAI(settings.openai_api_key, settings.openai_base_url, settings.openai_model, http, sleep=sleep),
            telegram=Telegram(settings.telegram_bot_token, settings.telegram_lead_chat_id,
                              settings.telegram_api_base, http),
            sleep=sleep,
        )

    def heartbeat(self, name: str) -> None:
        self.beat[name] = time.time()

    def assistant_enabled(self) -> bool:
        """Ответы в директе: и переменная окружения, и config/assistant.toml должны разрешать."""
        return self.settings.assistant_enabled and bool(self.config.assistant()["assistant"]["enabled"])

    async def alert_once(self, key: str, text: str, hours: float = 6) -> bool:
        """Тревога владельцу в Telegram не чаще раза в `hours` часов на один ключ.
        Без этого сбой OpenAI засыпал бы чат сотней одинаковых сообщений."""
        last = clock.parse(self.db.kv_get(f"alert:{key}"))
        if last and (clock.now() - last).total_seconds() < hours * 3600:
            return False
        self.db.kv_set(f"alert:{key}", clock.iso())
        return await self.telegram.send(text)

    async def close(self) -> None:
        await self.http.aclose()
        self.db.close()
