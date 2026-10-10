"""Веб-сервис: приём вебхуков Zernio и проверка здоровья.

Запуск: uvicorn app.main:create_app --factory --host 0.0.0.0 --port 8000 (один процесс, workers=1)."""

from __future__ import annotations

import asyncio
import json
import logging
import sqlite3
import time
from contextlib import asynccontextmanager, suppress

from fastapi import BackgroundTasks, FastAPI, Request, Response

from app import clock, handlers, logs, loops
from app.context import Ctx
from app.settings import Settings
from app.zernio import signature_ok

log = logging.getLogger("main")

# Цикл молчит дольше этого: в /health будет degraded (его видят healthcheck Docker и python -m app.check)
STALE_SECONDS = 180


def create_app(settings: Settings | None = None, *, ctx: Ctx | None = None, start_loops: bool = True) -> FastAPI:
    settings = settings or (ctx.settings if ctx else Settings.from_env())
    logs.setup(settings.secrets(), settings.log_level)
    if not settings.zernio_webhook_secret:
        log.warning("ZERNIO_WEBHOOK_SECRET не задан: все вебхуки будут отклонены")
    ctx = ctx or Ctx.build(settings)
    close_on_exit = start_loops  # в тестах ресурсами владеет сам тест

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        tasks: list[asyncio.Task] = []
        if start_loops:
            for loop in (loops.dialog_loop, loops.reminder_loop, loops.telegram_loop, loops.cleanup_loop):
                tasks.append(asyncio.create_task(loop(ctx)))
        yield
        for task in tasks:
            task.cancel()
        for task in tasks:
            with suppress(asyncio.CancelledError):
                await task
        if close_on_exit:
            await ctx.close()

    # документацию выключаем: сервис смотрит в интернет через Caddy, схема наружу не нужна
    app = FastAPI(title="assistant", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
    app.state.ctx = ctx

    @app.get("/health")
    async def health() -> dict:
        ctx.db.scalar("select 1")
        now = time.time()
        ages = {name: int(now - beat) for name, beat in ctx.beat.items()}
        stale = [name for name, age in ages.items() if age > STALE_SECONDS]
        return {
            "status": "degraded" if stale else "ok",
            "stale": stale,
            "assistant_enabled": ctx.assistant_enabled(),
            "loops_seconds_since_last_round": ages,
            "telegram_configured": ctx.telegram.configured,
        }

    @app.post("/webhooks/zernio")
    async def zernio_webhook(request: Request, background: BackgroundTasks) -> Response:
        raw = await request.body()
        if not signature_ok(raw, request.headers.get("X-Zernio-Signature"), settings.zernio_webhook_secret):
            log.warning("подпись вебхука не сошлась, запрос отброшен")
            return Response("bad signature", status_code=403, media_type="text/plain")
        try:
            payload = json.loads(raw)
        except ValueError:
            return Response("bad json", status_code=400, media_type="text/plain")
        if not isinstance(payload, dict):
            return Response("bad json", status_code=400, media_type="text/plain")
        # проверочные события Zernio (кнопка Test и пример из панели) отвечаем 200 и не разбираем
        if payload.get("test") or payload.get("event") == "webhook.test":
            return Response('{"ok": true, "test": true}', media_type="application/json")

        # Zernio доставляет «минимум один раз»: повтор того же события отсекаем по id
        event_id = str(payload.get("id") or request.headers.get("X-Zernio-Event-Id") or "")
        if event_id:
            try:
                ctx.db.execute("insert into events (id, kind, received_at) values (?, ?, ?)",
                               (event_id, str(payload.get("event") or ""), clock.iso()))
            except sqlite3.IntegrityError:
                return Response('{"ok": true, "duplicate": true}', media_type="application/json")
        # Zernio ждёт ответ 5 секунд: отвечаем сразу, работаем в фоне
        background.add_task(handlers.handle_event, ctx, payload)
        return Response('{"ok": true}', media_type="application/json")

    return app
