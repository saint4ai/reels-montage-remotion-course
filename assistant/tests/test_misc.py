"""Резервная копия, журналы без секретов, файлы шаблона и поиск лишнего в тексте."""

import logging
import re
import sqlite3
import tomllib

import httpx

from app import backup, handlers, logs
from app.config import Config
from app.db import DB
from app.settings import Settings, load_dotenv, parse_dotenv
from tests.conftest import ROOT, TG_TOKEN, ZERNIO_KEY, comment_event, make_settings, message_event

TEXT_SUFFIXES = {".py", ".md", ".toml", ".yml", ".yaml", ".sh", ".example", ".txt", ".ini"}
TEXT_NAMES = {"Dockerfile", "Caddyfile", ".gitignore", ".dockerignore", ".env.example"}


def project_files():
    for path in ROOT.rglob("*"):
        parts = set(path.relative_to(ROOT).parts)
        if parts & {".venv", "__pycache__", ".pytest_cache", "backups", "data"} or not path.is_file():
            continue
        if path.suffix in TEXT_SUFFIXES or path.name in TEXT_NAMES:
            yield path


# ── резервная копия ──────────────────────────────────────────────────

def test_backup_makes_a_consistent_copy_and_keeps_the_last_14(tmp_path):
    source = tmp_path / "assistant.db"
    db = DB(source)
    db.execute("insert into contacts (platform, user_id, created_at) values ('instagram', 'u1', 'x')")
    db.close()
    for i in range(16):
        # метка времени в имени файла идёт до секунд: подменяем время, чтобы файлы различались
        target = tmp_path / "backups" / f"assistant-20260101-0000{i:02d}.db"
        target.parent.mkdir(exist_ok=True)
        target.write_bytes(b"old")
    result = backup.make_backup(str(source), tmp_path / "backups")
    assert sqlite3.connect(str(result)).execute("select user_id from contacts").fetchall() == [("u1",)]
    left = sorted((tmp_path / "backups").glob("assistant-*.db"))
    assert len(left) == 14 and result in left


def test_backup_works_while_the_service_holds_the_database(tmp_path):
    live = DB(tmp_path / "live.db")
    live.execute("insert into kv (key, value) values ('a', 'b')")
    result = backup.make_backup(str(tmp_path / "live.db"), tmp_path / "b")
    live.execute("insert into kv (key, value) values ('c', 'd')")
    assert sqlite3.connect(str(result)).execute("select count(*) from kv").fetchone() == (1,)
    live.close()


# ── журналы ──────────────────────────────────────────────────────────

def test_secret_filter_masks_keys_in_any_message():
    handler_records = []

    class Catch(logging.Handler):
        def emit(self, record):
            handler_records.append(record.getMessage())

    logger = logging.getLogger("unit-test-secret")
    handler = Catch()
    handler.addFilter(logs.SecretFilter([ZERNIO_KEY, TG_TOKEN]))
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.info("ошибка запроса к https://api.telegram.org/bot%s/getUpdates", TG_TOKEN)
    logger.info("ключ %s не подошёл", ZERNIO_KEY)
    logger.info("обычное сообщение")
    logger.removeHandler(handler)
    assert TG_TOKEN not in " ".join(handler_records) and ZERNIO_KEY not in " ".join(handler_records)
    assert handler_records[2] == "обычное сообщение"


def test_setup_quiets_httpx_and_secrets_are_short_listed():
    logs.setup(["секрет-для-теста"], "INFO")
    assert logging.getLogger("httpx").level == logging.WARNING
    assert Settings(zernio_api_key="short", openai_api_key="x" * 20).secrets() == ["x" * 20]


async def test_texts_of_people_never_reach_the_log(ctx, net, caplog, monkeypatch):
    caplog.set_level(logging.DEBUG)
    unique = "уникальная-фраза-клиента-7781"
    net.reply(f"Ответ про {unique}")
    await handlers.handle_event(ctx, message_event(f"вопрос {unique}", message_id="log1"))
    from tests.conftest import advance

    advance(monkeypatch, seconds=30)
    await handlers.process_due(ctx)
    await handlers.handle_event(ctx, comment_event(f"ПАПКА {unique}", comment_id="log2", user="u2"))
    assert unique not in caplog.text
    for secret in ctx.settings.secrets():
        assert secret not in caplog.text


async def test_telegram_failure_does_not_log_the_token(ctx, net, caplog):
    caplog.set_level(logging.DEBUG)
    net.telegram_override = lambda request: (_ for _ in ()).throw(httpx.ConnectError(f"сбой {request.url}"))
    assert await ctx.telegram.send("текст") is False
    assert TG_TOKEN not in caplog.text


# ── .env ─────────────────────────────────────────────────────────────

def test_dotenv_parsing(tmp_path):
    path = tmp_path / ".env"
    path.write_text('# комментарий\nA=1\nB = "два слова"\nC=\nбезравно\nD=x=y\n', encoding="utf-8")
    assert parse_dotenv(path) == {"A": "1", "B": "два слова", "C": "", "D": "x=y"}
    env = {"A": "уже-задано"}
    load_dotenv(path, env)
    assert env["A"] == "уже-задано" and env["B"] == "два слова"
    assert parse_dotenv(tmp_path / "нет.env") == {}


def test_settings_from_env_mapping():
    s = Settings.from_env({"ZERNIO_API_KEY": " k ", "OPENAI_BASE_URL": "https://openrouter.ai/api/v1/",
                           "ASSISTANT_ENABLED": "0", "TELEGRAM_LEAD_CHAT_ID": "-100"})
    assert s.zernio_api_key == "k" and s.openai_base_url == "https://openrouter.ai/api/v1"
    assert s.assistant_enabled is False and s.telegram_lead_chat_id == "-100"
    assert Settings.from_env({}).assistant_enabled is True


def test_settings_from_file_lets_environment_win(tmp_path):
    """Служебные скрипты читают указанный .env, но переменные окружения сильнее: так их можно направить на пробный адрес."""
    path = tmp_path / ".env"
    path.write_text("ZERNIO_API_KEY=из-файла\nZERNIO_API_BASE=https://zernio.com/api/v1\nDOMAIN=a.test\n", encoding="utf-8")
    s = Settings.from_file(path, {"ZERNIO_API_BASE": "http://127.0.0.1:9/api/v1/", "DOMAIN": "", "PATH": "x"})
    assert s.zernio_api_key == "из-файла" and s.zernio_api_base == "http://127.0.0.1:9/api/v1"
    assert s.domain == "a.test"   # пустое значение в окружении файл не перебивает
    assert Settings.from_file(tmp_path / "нет.env", {}).zernio_api_key == ""


# ── файлы шаблона ────────────────────────────────────────────────────

def test_public_replies_ten_variants_without_long_dash():
    texts = tomllib.loads((ROOT / "config" / "texts.toml").read_text(encoding="utf-8"))
    replies = texts["public_reply"]["templates"]
    assert len(replies) >= 10 and len(set(replies)) == len(replies)
    assert all(not r.startswith("@") for r in replies), "@ник добавляет код"


def test_no_long_dash_anywhere_in_the_template():
    dash = chr(0x2014)
    bad = [str(p.relative_to(ROOT)) for p in project_files() if dash in p.read_text(encoding="utf-8")]
    assert bad == []


def test_templates_must_be_filled_before_use():
    """Промпт и база знаний в шаблоне с заглушками: python -m app.check не даст запустить, пока их не заполнят."""
    marker = "[[ЗАПОЛНИ:"
    assert marker in (ROOT / "prompts" / "assistant.md").read_text(encoding="utf-8")
    files = sorted((ROOT / "knowledge").glob("*.md"))
    assert [f.name for f in files] == ["01-about.md", "02-services.md", "03-faq.md", "04-materials.md", "05-how-to-book.md"]
    assert all(marker in f.read_text(encoding="utf-8") for f in files)
    keyword = tomllib.loads((ROOT / "config" / "keywords.toml").read_text(encoding="utf-8"))["keyword"][0]
    assert keyword["active"] is False and marker in keyword["message"]
    for step in ("Держи", "Как запустить:", "1.", "2.", "3.", "4.", "Нужно:"):
        assert step in keyword["message"]


def test_env_example_has_names_only():
    values = {}
    for line in (ROOT / ".env.example").read_text(encoding="utf-8").splitlines():
        if line and not line.startswith("#") and "=" in line:
            name, _, value = line.partition("=")
            values[name] = value
    secret_names = ["ZERNIO_API_KEY", "ZERNIO_WEBHOOK_SECRET", "OPENAI_API_KEY", "OPENAI_MODEL", "TELEGRAM_BOT_TOKEN",
                    "TELEGRAM_LEAD_CHAT_ID", "DOMAIN"]
    assert all(values[n] == "" for n in secret_names)
    text = (ROOT / ".env.example").read_text(encoding="utf-8")
    for hint in ("docs/guides/zernio.md", "docs/guides/openai.md", "docs/guides/telegram-bot.md",
                 "docs/guides/server-vps.md", "openrouter.ai/api/v1", "sslip.io"):
        assert hint in text


def test_no_owner_secrets_or_personal_data_in_the_template():
    """В репозиторий курса не должны попасть адреса, ники и имена из боевой системы автора."""
    needles = ["188." + "137", "onai." + "academy", "saint" + "4ai", "smm" + "mc", "s" + "k_", "moderator" + "onai",
               "Om" + "ni", "Alex" + "ander", "Алекс" + "андр", "онай", "ig." + "onai"]
    hits = []
    for path in project_files():
        if path.name == "test_misc.py":
            continue
        text = path.read_text(encoding="utf-8")
        hits += [f"{path.relative_to(ROOT)}: {n}" for n in needles if n.lower() in text.lower()]
    assert hits == []


def test_compose_and_dockerfile_basics():
    compose = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")
    for must in ("  app:", "  caddy:", "env_file: .env", "data:/data", "${DOMAIN", "restart: unless-stopped"):
        assert must in compose
    assert "postgres" not in compose.lower()
    docker = (ROOT / "Dockerfile").read_text(encoding="utf-8")
    assert "python:3.12" in docker and "--factory" in docker and "--workers" in docker and "USER assistant" in docker
    caddy = (ROOT / "Caddyfile").read_text(encoding="utf-8")
    assert "{$DOMAIN}" in caddy and "reverse_proxy app:8000" in caddy
    assert (ROOT / ".gitignore").read_text(encoding="utf-8").count(".env") >= 1
    assert re.search(r"^\.venv/", (ROOT / ".gitignore").read_text(encoding="utf-8"), re.M)


def test_requirements_are_pinned():
    for name in ("requirements.txt", "requirements-dev.txt"):
        for line in (ROOT / name).read_text(encoding="utf-8").splitlines():
            if line and not line.startswith(("-r", "#")):
                assert "==" in line, f"{name}: версия не закреплена: {line}"


def test_knowledge_loader_joins_all_files(workdir):
    (workdir / "knowledge" / "02.md").write_text("Второй файл", encoding="utf-8")
    text = Config(make_settings(workdir)).knowledge()
    assert "## Файл 01.md" in text and "## Файл 02.md" in text and "9 990" in text


def test_config_reloads_when_files_change(workdir):
    import os

    config = Config(make_settings(workdir))
    assert config.prompt().startswith("# Роль")
    path = workdir / "prompts" / "assistant.md"
    path.write_text("# Новая роль", encoding="utf-8")
    stat = path.stat()
    os.utime(path, ns=(stat.st_atime_ns, stat.st_mtime_ns + 10_000_000))
    assert config.prompt() == "# Новая роль"
    (workdir / "config" / "keywords.toml").write_text('[[keyword]]\nword = "новое"\nmessage = "м"\n', encoding="utf-8")
    assert [k.word for k in config.keywords()] == ["новое"]
