"""Регистрирует (или обновляет) вебхук Zernio на https://<DOMAIN>/webhooks/zernio.

    python deploy/register_webhook.py --env assistant/.env [--domain 203-0-113-10.sslip.io] [--test]

Ключ и секрет берутся из .env и на экран не выводятся. Повторный запуск безопасен: найдёт вебхук
по адресу или имени и обновит его (событие, секрет, включён). С --test Zernio присылает проверочное
событие, и сервис должен ответить на него 200."""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx  # noqa: E402

from app.settings import Settings, parse_dotenv  # noqa: E402
from app.zernio import Zernio  # noqa: E402


async def run(env_path: Path, domain: str, test: bool, out=print) -> int:
    settings = Settings.from_env(parse_dotenv(env_path))
    domain = domain or settings.domain
    if not domain:
        out("ОШИБКА: укажи --domain или DOMAIN в .env")
        return 1
    if not settings.zernio_api_key or not settings.zernio_webhook_secret:
        out("ОШИБКА: в .env нет ZERNIO_API_KEY или ZERNIO_WEBHOOK_SECRET")
        return 1
    url = f"https://{domain}/webhooks/zernio"
    async with httpx.AsyncClient(timeout=20) as http:
        zernio = Zernio(settings.zernio_api_key, settings.zernio_api_base, http)
        message = await zernio.upsert_webhook(url, settings.zernio_webhook_secret)
        out(message)
        if message.startswith("ошибка"):
            return 1
        if test:
            result = await zernio.test_webhook(url)
            out(result)
            if not result.startswith("тестовое"):
                return 1
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Регистрация вебхука Zernio")
    parser.add_argument("--env", default=str(Path(__file__).resolve().parent.parent / ".env"))
    parser.add_argument("--domain", default="")
    parser.add_argument("--test", action="store_true", help="после регистрации отправить проверочное событие")
    args = parser.parse_args()
    raise SystemExit(asyncio.run(run(Path(args.env), args.domain, args.test)))


if __name__ == "__main__":
    main()
