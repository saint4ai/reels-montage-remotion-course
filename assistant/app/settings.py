"""Настройки из окружения (.env на сервере). Значения ключей нигде не печатаются."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent

# Имена переменных, значения которых прячем в логах и в выводе проверок
SECRET_NAMES = ("ZERNIO_API_KEY", "ZERNIO_WEBHOOK_SECRET", "OPENAI_API_KEY", "TELEGRAM_BOT_TOKEN", "LEADS_WEBHOOK_URL", "LEADS_WEBHOOK_SECRET")


def parse_dotenv(path: Path) -> dict:
    """Читает файл вида ИМЯ=значение (строки с # пропускает). Нет файла: пустой словарь."""
    result: dict = {}
    if not Path(path).is_file():
        return result
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, _, value = line.partition("=")
        name, value = name.strip(), value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        result[name] = value
    return result


def load_dotenv(path: Path, environ: dict | None = None) -> None:
    """Подмешивает .env рядом с кодом, если он есть. Уже заданные переменные не перетирает.

    Нужно для локальных `python -m app.try` и `python -m app.check`. В Docker
    переменные приходят из env_file, и этот файл внутри образа не лежит."""
    environ = os.environ if environ is None else environ
    for name, value in parse_dotenv(path).items():
        environ.setdefault(name, value)


def _flag(value: str | None, default: bool) -> bool:
    if value is None or value == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "on", "да"}


@dataclass
class Settings:
    zernio_api_key: str = ""
    zernio_webhook_secret: str = ""
    zernio_api_base: str = "https://zernio.com/api/v1"
    openai_api_key: str = ""
    # Модель намеренно не задана по умолчанию: какую брать, написано в docs/guides/openai.md
    openai_model: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    telegram_bot_token: str = ""
    telegram_lead_chat_id: str = ""
    telegram_api_base: str = "https://api.telegram.org"
    domain: str = ""
    # Необязательно: каждая заявка ещё и строкой в Google Таблице (docs/guides/google-sheets-leads.md). Пусто: выключено
    leads_webhook_url: str = ""
    leads_webhook_secret: str = ""
    db_path: str = "/data/assistant.db"
    assistant_enabled: bool = True
    log_level: str = "INFO"
    config_dir: Path = field(default_factory=lambda: BASE / "config")
    prompts_dir: Path = field(default_factory=lambda: BASE / "prompts")
    knowledge_dir: Path = field(default_factory=lambda: BASE / "knowledge")

    @classmethod
    def from_env(cls, environ: dict | None = None, *, dotenv: bool = True) -> "Settings":
        if environ is None:
            if dotenv:
                load_dotenv(BASE / ".env")
            environ = os.environ
        get = lambda name, default="": (environ.get(name) or default).strip()
        return cls(
            zernio_api_key=get("ZERNIO_API_KEY"),
            zernio_webhook_secret=get("ZERNIO_WEBHOOK_SECRET"),
            zernio_api_base=get("ZERNIO_API_BASE", cls.zernio_api_base).rstrip("/"),
            openai_api_key=get("OPENAI_API_KEY"),
            openai_model=get("OPENAI_MODEL"),
            openai_base_url=get("OPENAI_BASE_URL", cls.openai_base_url).rstrip("/"),
            telegram_bot_token=get("TELEGRAM_BOT_TOKEN"),
            telegram_lead_chat_id=get("TELEGRAM_LEAD_CHAT_ID"),
            telegram_api_base=get("TELEGRAM_API_BASE", cls.telegram_api_base).rstrip("/"),
            domain=get("DOMAIN"),
            leads_webhook_url=get("LEADS_WEBHOOK_URL"),
            leads_webhook_secret=get("LEADS_WEBHOOK_SECRET"),
            db_path=get("DB_PATH", cls.db_path),
            assistant_enabled=_flag(environ.get("ASSISTANT_ENABLED"), True),
            log_level=get("LOG_LEVEL", "INFO").upper(),
        )

    @classmethod
    def from_file(cls, path: Path, environ: dict | None = None) -> "Settings":
        """Настройки из указанного .env. Переменные окружения сильнее файла (как у docker compose):
        так служебные скрипты можно направить на пробный адрес, не правя .env. Пустые значения файл не перебивают."""
        environ = os.environ if environ is None else environ
        merged = {**parse_dotenv(path), **{name: value for name, value in environ.items() if value}}
        return cls.from_env(merged)

    def secrets(self) -> list[str]:
        """Значения ключей, которые нельзя выводить. Короткие не берём: ложные срабатывания маски."""
        # адрес веб-приложения Таблицы тоже секрет: кто его знает, тот может дописывать строки
        values = (self.zernio_api_key, self.zernio_webhook_secret, self.openai_api_key, self.telegram_bot_token,
                  self.leads_webhook_url, self.leads_webhook_secret)
        return [v for v in values if len(v) >= 8]
