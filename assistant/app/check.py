"""Проверка настройки: `python -m app.check` печатает OK, FAIL или SKIP по каждому пункту.

Значения ключей не печатаются никогда: только имя пункта и причина. Код выхода 1, если есть FAIL.
    --offline    не ходить в интернет (только файлы и переменные)
    --send-test  отправить в чат заявок сообщение «Проверка связи» и, если задан LEADS_WEBHOOK_URL, тестовый запрос в Google Таблицу
                 (строка в Таблицу при этом не добавляется)"""

from __future__ import annotations

import argparse
import asyncio
import base64
import io
import tomllib
import wave
from pathlib import Path

import httpx

from app import console
from app import leads as leads_mod
from app.assistant import LEAD_TOOL
from app import keywords as kw_mod
from app.checks import LONG_DASH
from app.config import Config
from app.context import Ctx
from app.settings import Settings

PLACEHOLDER = "[[ЗАПОЛНИ"
KNOWLEDGE_LIMIT = 16000   # знаков: вся база идёт в каждый запрос к модели
MIN_PUBLIC_REPLIES = 5
MIN_SECRET_LEN = 16
# картинка 1x1 пиксель для проверки, что модель принимает изображения
TINY_PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==")

Item = tuple[str, str, str]  # (статус, пункт, пояснение)


def ok(name: str, detail: str = "") -> Item:
    return "OK", name, detail


def fail(name: str, detail: str) -> Item:
    return "FAIL", name, detail


def skip(name: str, detail: str) -> Item:
    return "SKIP", name, detail


def check_env(s: Settings) -> list[Item]:
    items = []
    for label, value, hint in (
        ("ZERNIO_API_KEY", s.zernio_api_key, "docs/guides/zernio.md"),
        ("OPENAI_API_KEY", s.openai_api_key, "docs/guides/openai.md"),
        ("OPENAI_MODEL", s.openai_model, "docs/guides/openai.md, какую модель взять"),
        ("TELEGRAM_BOT_TOKEN", s.telegram_bot_token, "docs/guides/telegram-bot.md"),
        ("TELEGRAM_LEAD_CHAT_ID", s.telegram_lead_chat_id, "docs/guides/telegram-bot.md"),
    ):
        items.append(ok(label) if value else fail(label, f"не задан, смотри {hint}"))
    secret = s.zernio_webhook_secret
    if not secret:
        items.append(fail("ZERNIO_WEBHOOK_SECRET", "не задан: придумай длинную случайную строку"))
    elif len(secret) < MIN_SECRET_LEN:
        items.append(fail("ZERNIO_WEBHOOK_SECRET", f"короче {MIN_SECRET_LEN} знаков"))
    else:
        items.append(ok("ZERNIO_WEBHOOK_SECRET"))
    items.append(ok("DOMAIN") if s.domain else skip("DOMAIN", "не задан; install.sh возьмёт <ip>.sslip.io"))
    if s.leads_webhook_url:
        apps_script = s.leads_webhook_url.startswith("https://script.google.com/")
        items.append(ok("LEADS_WEBHOOK_URL") if apps_script
                     else ok("LEADS_WEBHOOK_URL", "не адрес Apps Script: убедись, что приёмник понимает JSON (docs/guides/google-sheets-leads.md)"))
        if apps_script and not s.leads_webhook_secret:
            items.append(fail("LEADS_WEBHOOK_SECRET", "не задан: шаблон Apps Script без секрета строки не принимает, смотри docs/guides/google-sheets-leads.md"))
    else:
        items.append(skip("LEADS_WEBHOOK_URL", "не задан: заявки только в Telegram, Google Таблица необязательна"))
    return items


def _strings(node) -> list[str]:
    if isinstance(node, str):
        return [node]
    if isinstance(node, dict):
        return [x for v in node.values() for x in _strings(v)]
    if isinstance(node, list):
        return [x for v in node for x in _strings(v)]
    return []


def check_files(s: Settings) -> list[Item]:
    items: list[Item] = []
    cfg = Config(s)

    def parse(name: str):
        path = s.config_dir / name
        if not path.is_file():
            items.append(fail(name, "файла нет"))
            return None
        try:
            with path.open("rb") as f:
                return tomllib.load(f)
        except tomllib.TOMLDecodeError as e:
            items.append(fail(name, f"не читается: {e}"))
            return None

    texts = parse("texts.toml")
    parse("assistant.toml")
    if texts is not None:
        replies = (texts.get("public_reply") or {}).get("templates") or []
        items.append(ok("texts.toml: публичные ответы", f"{len(replies)} вариантов") if len(replies) >= MIN_PUBLIC_REPLIES
                     else fail("texts.toml: публичные ответы", f"нужно не меньше {MIN_PUBLIC_REPLIES} вариантов, есть {len(replies)}"))
        dashed = [t for t in _strings(texts) if LONG_DASH in t]
        items.append(fail("texts.toml: длинное тире", f"в {len(dashed)} текстах") if dashed else ok("texts.toml: длинного тире нет"))

    keywords: list = []
    if parse("keywords.toml") is not None:
        try:
            keywords = cfg.keywords()
        except (KeyError, TypeError, ValueError) as e:
            items.append(fail("keywords.toml", f"ошибка в записи слова: {type(e).__name__}"))
        else:
            active = [k for k in keywords if k.active]
            items.append(ok("keywords.toml: активные слова", ", ".join(k.word for k in active)) if active
                         else fail("keywords.toml: активные слова", "нет ни одного: включи слово (active = true)"))
            empty = kw_mod.unfilled(keywords)
            items.append(fail("keywords.toml: заглушки", "не заполнены: " + ", ".join(empty)) if empty
                         else ok("keywords.toml: тексты материалов заполнены"))
            dashed = [k.word for k in keywords if LONG_DASH in k.message]
            items.append(fail("keywords.toml: длинное тире", "в словах: " + ", ".join(dashed)) if dashed
                         else ok("keywords.toml: длинного тире нет"))

    prompt_path = s.prompts_dir / "assistant.md"
    if not prompt_path.is_file():
        items.append(fail("prompts/assistant.md", "файла нет"))
    else:
        prompt = prompt_path.read_text(encoding="utf-8")
        if PLACEHOLDER in prompt:
            items.append(fail("prompts/assistant.md", f"остались заглушки {PLACEHOLDER}: …]]"))
        elif LONG_DASH in prompt:
            items.append(fail("prompts/assistant.md", "длинное тире: замени запятой или точкой"))
        else:
            items.append(ok("prompts/assistant.md"))

    files = sorted(s.knowledge_dir.glob("*.md")) if s.knowledge_dir.is_dir() else []
    if not files:
        items.append(fail("knowledge/", "нет файлов базы знаний"))
    else:
        left = [f.name for f in files if PLACEHOLDER in f.read_text(encoding="utf-8")]
        items.append(fail("knowledge/: заглушки", "остались в " + ", ".join(left)) if left else ok("knowledge/: заглушек нет"))
        dashed = [f.name for f in files if LONG_DASH in f.read_text(encoding="utf-8")]
        items.append(fail("knowledge/: длинное тире", "в " + ", ".join(dashed)) if dashed else ok("knowledge/: длинного тире нет"))
        size = len(cfg.knowledge())
        items.append(ok("knowledge/: размер", f"{size} знаков") if size <= KNOWLEDGE_LIMIT
                     else fail("knowledge/: размер", f"{size} знаков при пределе {KNOWLEDGE_LIMIT}: сократи, база идёт в каждый запрос"))
    return items


def _model_hint(error: str) -> str:
    low = error.lower()
    if "ключ не принят" in low or "401" in low:
        return "ключ не принят: проверь OPENAI_API_KEY и адрес OPENAI_BASE_URL"
    if "402" in low or "429" in low or "quota" in low or "credit" in low or "balance" in low:
        return "похоже, закончился баланс или лимит: " + error
    if "404" in low or "model" in low:
        return "проверь имя модели в OPENAI_MODEL (docs/guides/openai.md): " + error
    return error


async def check_model(ctx: Ctx) -> list[Item]:
    """Живой запрос к модели на несколько токенов: проверяет адрес, ключ, имя модели и баланс сразу.
    Заодно проверяет голос и картинки, если они включены: не все совместимые адреса их умеют."""
    cfg = ctx.config.assistant()
    where = ctx.settings.openai_base_url.split("//")[-1].split("/")[0]
    reply = await ctx.openai.respond(
        "Отвечай одним словом.", [{"role": "user", "content": "Проверка связи. Ответь: ок"}],
        max_output_tokens=300, reasoning_effort=str(cfg["assistant"].get("reasoning_effort") or ""))
    if reply.error:
        return [fail("Модель: запрос", _model_hint(reply.error))]
    items = [ok("Модель: ключ, имя и баланс", f"{where}, {ctx.settings.openai_model}")]
    # заявки сохраняются вызовом функции save_lead: модель без поддержки инструментов их не создаст
    tools = await ctx.openai.respond(
        "Отвечай одним словом.", [{"role": "user", "content": "Проверка связи. Ответь: ок"}], tools=[LEAD_TOOL],
        max_output_tokens=300, reasoning_effort=str(cfg["assistant"].get("reasoning_effort") or ""))
    items.append(ok("Модель: вызов функций (заявки)") if not tools.error else fail(
        "Модель: вызов функций (заявки)", f"{tools.error}. Нужна модель с поддержкой tools, смотри docs/guides/openai.md"))
    if cfg["voice"]["enabled"]:
        _, error = await ctx.openai.transcribe(silent_wav(), "check.wav", "audio/wav", cfg["voice"]["model"])
        items.append(ok("Модель: голосовые") if not error else fail(
            "Модель: голосовые", f"{error}. Если адрес не умеет расшифровку, поставь [voice] enabled = false "
                                 "в config/assistant.toml"))
    else:
        items.append(skip("Модель: голосовые", "выключены в config/assistant.toml"))
    if cfg["vision"]["enabled"]:
        _, error = await ctx.openai.describe_image(TINY_PNG, "image/png", cfg["vision"]["model"])
        items.append(ok("Модель: картинки") if not error else fail(
            "Модель: картинки", f"{error}. Если модель не принимает картинки, поставь [vision] enabled = false "
                                "в config/assistant.toml"))
    else:
        items.append(skip("Модель: картинки", "выключены в config/assistant.toml"))
    return items


def silent_wav(seconds: float = 1.0) -> bytes:
    """Секунда тишины в WAV: проверочный файл для эндпоинта расшифровки."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(8000)
        w.writeframes(bytes(2) * int(8000 * seconds))
    return buf.getvalue()


async def check_online(ctx: Ctx, send_test: bool) -> list[Item]:
    s, items = ctx.settings, []

    if s.zernio_api_key:
        r = await ctx.zernio.accounts()
        if r.ok:
            accounts = (r.data or {}).get("accounts") if isinstance(r.data, dict) else None
            names = sorted({str(a.get("platform")) for a in accounts or [] if isinstance(a, dict)})
            items.append(ok("Zernio: ключ принят", "аккаунты: " + (", ".join(names) or "пока нет")))
            if not names:
                items.append(fail("Zernio: подключённые аккаунты", "подключи Instagram в кабинете Zernio"))
        elif r.status == 401:
            items.append(fail("Zernio: ключ", "не принят (401)"))
        elif r.status == 403:
            items.append(fail("Zernio: доступ", "закрыт (403): у ключа должны быть права read-write и группы "
                                                "messages и webhooks, смотри docs/guides/zernio.md"))
        else:
            items.append(fail("Zernio", r.error))
        if s.domain and s.zernio_webhook_secret:
            hooks = await ctx.zernio.list_webhooks()
            url = f"https://{s.domain}/webhooks/zernio"
            mine = next((w for w in hooks if w.get("url") == url), None)
            if mine and mine.get("isActive", True):
                items.append(ok("Zernio: вебхук", url))
            else:
                items.append(fail("Zernio: вебхук", "не зарегистрирован, запусти deploy/register_webhook.py"))
    else:
        items.append(skip("Zernio: проверка ключа", "нет ZERNIO_API_KEY"))

    if s.openai_api_key and s.openai_model:
        items += await check_model(ctx)
    else:
        items.append(skip("Модель: проверка", "нет OPENAI_API_KEY или OPENAI_MODEL"))

    if ctx.telegram.configured:
        me = await ctx.telegram.get_me()
        items.append(ok("Telegram: бот отвечает") if me.get("ok") else fail("Telegram: токен", "бот не ответил"))
        chat = await ctx.telegram.call("getChat", {"chat_id": ctx.telegram.chat_id})
        items.append(ok("Telegram: чат заявок виден боту") if chat.get("ok")
                     else fail("Telegram: чат заявок", "бот не видит чат: напиши ему /start или добавь в группу"))
        if send_test:
            sent = await ctx.telegram.send("Проверка связи: ассистент на связи.")
            items.append(ok("Telegram: тестовое сообщение") if sent else fail("Telegram: тестовое сообщение", "не отправилось"))
    else:
        items.append(skip("Telegram: проверка", "нет токена или id чата"))

    if s.leads_webhook_url:
        if send_test:
            good, why = await leads_mod.ping_sheet(ctx)
            items.append(ok("Google Таблица: тестовый запрос принят") if good else fail(
                "Google Таблица", f"тестовый запрос не прошёл ({why}): проверь адрес и секрет, docs/guides/google-sheets-leads.md"))
        else:
            items.append(skip("Google Таблица: живая проверка", "запусти с --send-test"))

    if s.domain:
        try:
            r = await ctx.http.get(f"https://{s.domain}/health")
            items.append(ok("Сервер: /health", s.domain) if r.status_code == 200
                         else fail("Сервер: /health", f"ответ {r.status_code}"))
        except httpx.HTTPError as e:
            items.append(fail("Сервер: /health", f"не достучались: {type(e).__name__}"))
    else:
        items.append(skip("Сервер: /health", "DOMAIN не задан"))
    return items


async def run(settings: Settings | None = None, *, offline: bool = False, send_test: bool = False, out=print) -> int:
    settings = settings or Settings.from_env()
    items = check_env(settings) + check_files(settings)
    if not offline:
        settings.db_path = ":memory:"
        # одна попытка и короткое ожидание соединения: при недоступном сервисе ответ сразу, а не через минуту
        ctx = Ctx.build(settings, attempts=1, timeout=httpx.Timeout(20, connect=5))
        try:
            items += await check_online(ctx, send_test)
        finally:
            await ctx.close()
    for status, name, detail in items:
        out(f"{status:<5}{name}" + (f": {detail}" if detail else ""))
    bad = sum(1 for status, _, _ in items if status == "FAIL")
    out(f"\nИтог: {'всё в порядке' if not bad else f'{bad} пунктов не прошли'}")
    return 1 if bad else 0


def main() -> None:
    console.utf8()
    parser = argparse.ArgumentParser(description="Проверка конфигов и ключей ассистента")
    parser.add_argument("--offline", action="store_true", help="без запросов в интернет")
    parser.add_argument("--send-test", action="store_true", help="отправить тестовое сообщение в Telegram")
    args = parser.parse_args()
    raise SystemExit(asyncio.run(run(offline=args.offline, send_test=args.send_test)))


if __name__ == "__main__":
    main()
