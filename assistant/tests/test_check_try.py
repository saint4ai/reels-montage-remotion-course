"""python -m app.check и python -m app.try."""

import subprocess
import sys

import httpx

from app import check, tryout
from tests.conftest import (CHAT, OPENAI, OPENAI_KEY, ROOT, TG, TG_TOKEN, WEBHOOK_SECRET, ZERNIO, ZERNIO_KEY,
                            make_settings)


def lines_of(output):
    return "\n".join(output)


async def run_check(settings, **kwargs):
    out = []
    code = await check.run(settings, out=out.append, **kwargs)
    return code, lines_of(out)


# ── check: файлы и переменные ────────────────────────────────────────

async def test_check_fails_on_unfilled_templates_of_the_course(monkeypatch):
    """Шаблон из репозитория курса: заглушки не заполнены, ключей нет. Проверка обязана это сказать."""
    for name in ("ZERNIO_API_KEY", "ZERNIO_WEBHOOK_SECRET", "OPENAI_API_KEY", "OPENAI_MODEL", "TELEGRAM_BOT_TOKEN",
                 "TELEGRAM_LEAD_CHAT_ID", "DOMAIN"):
        monkeypatch.delenv(name, raising=False)
    from app.settings import Settings

    settings = Settings.from_env({})
    code, out = await run_check(settings, offline=True)
    assert code == 1
    for must in ("FAIL ZERNIO_API_KEY", "FAIL OPENAI_MODEL", "FAIL TELEGRAM_BOT_TOKEN", "FAIL prompts/assistant.md",
                 "FAIL knowledge/: заглушки", "FAIL keywords.toml: активные слова"):
        assert must in out.replace("FAIL ", "FAIL ").replace("\n", "\n"), must


async def test_check_passes_for_a_filled_setup(workdir, net):
    settings = make_settings(workdir)
    code, out = await run_check(settings, offline=True)
    assert code == 0, out
    assert "OK   ZERNIO_API_KEY" in out and "FAIL" not in out and "Итог: всё в порядке" in out
    # в тестовых значениях ключей есть узнаваемые куски: ни один не должен попасть на экран
    for secret in settings.secrets():
        assert secret not in out


async def test_check_catches_dashes_and_short_secret(workdir):
    (workdir / "knowledge" / "01.md").write_text("Цена " + chr(0x2014) + " 5 000", encoding="utf-8")
    (workdir / "prompts" / "assistant.md").write_text("Роль " + chr(0x2014) + " ассистент", encoding="utf-8")
    code, out = await run_check(make_settings(workdir, zernio_webhook_secret="короткий"), offline=True)
    assert code == 1
    assert "FAIL knowledge/: длинное тире" in out and "FAIL prompts/assistant.md: длинное тире" in out
    assert "FAIL ZERNIO_WEBHOOK_SECRET: короче" in out


async def test_check_needs_enough_public_replies(workdir):
    (workdir / "config" / "texts.toml").write_text('[public_reply]\ntemplates = ["один", "два"]\n', encoding="utf-8")
    code, out = await run_check(make_settings(workdir), offline=True)
    assert code == 1 and "нужно не меньше 5 вариантов, есть 2" in out


# ── check: интернет ──────────────────────────────────────────────────

def mock_everything(router, *, voice=True, vision=True, zernio_status=200, model_status=200):
    accounts = {"accounts": [{"platform": "instagram"}, {"platform": "telegram"}]}
    router.get(f"{ZERNIO}/accounts").mock(return_value=httpx.Response(zernio_status, json=accounts))
    router.get(f"{ZERNIO}/webhooks/settings").mock(return_value=httpx.Response(200, json={"webhooks": [
        {"_id": "w", "url": "https://assistant.test/webhooks/zernio", "isActive": True}]}))
    def chat(request):
        if model_status != 200:
            return httpx.Response(model_status, json={"error": {"message": "нет", "code": model_status}})
        if b"image_url" in request.content and not vision:
            return httpx.Response(400, json={"error": {"message": "image input is not supported"}})
        return httpx.Response(200, json={"choices": [{"message": {"content": "ок"}, "finish_reason": "stop"}]})

    router.post(f"{OPENAI}/chat/completions").mock(side_effect=chat)
    router.post(f"{OPENAI}/audio/transcriptions").mock(return_value=httpx.Response(
        200 if voice else 404, json={"text": ""} if voice else {"error": {"message": "not found"}}))
    router.post(url__regex=rf"{TG}/bot.*/getMe").mock(return_value=httpx.Response(200, json={"ok": True, "result": {}}))
    router.post(url__regex=rf"{TG}/bot.*/getChat").mock(return_value=httpx.Response(200, json={"ok": True, "result": {}}))
    router.post(url__regex=rf"{TG}/bot.*/sendMessage").mock(return_value=httpx.Response(200, json={"ok": True}))
    router.get("https://assistant.test/health").mock(return_value=httpx.Response(200, json={"status": "ok"}))


async def test_online_check_all_green(workdir):
    import respx

    with respx.mock as router:
        mock_everything(router)
        code, out = await run_check(make_settings(workdir), send_test=True)
    assert code == 0, out
    for ok_line in ("OK   Zernio: ключ принят: аккаунты: instagram, telegram", "OK   Zernio: вебхук",
                    "OK   Модель: ключ, имя и баланс", "OK   Модель: вызов функций (заявки)", "OK   Модель: голосовые", "OK   Модель: картинки",
                    "OK   Telegram: бот отвечает", "OK   Telegram: чат заявок виден боту",
                    "OK   Telegram: тестовое сообщение", "OK   Сервер: /health"):
        assert ok_line in out, ok_line
    for secret in (ZERNIO_KEY, OPENAI_KEY, TG_TOKEN, WEBHOOK_SECRET):
        assert secret not in out


async def test_online_check_reports_bad_keys_without_printing_them(workdir):
    import respx

    with respx.mock as router:
        mock_everything(router, zernio_status=401, model_status=401)
        code, out = await run_check(make_settings(workdir))
    assert code == 1
    assert "FAIL Zernio: ключ: не принят (401)" in out
    assert "FAIL Модель: запрос: ключ не принят" in out
    for secret in (ZERNIO_KEY, OPENAI_KEY, TG_TOKEN, WEBHOOK_SECRET):
        assert secret not in out


async def test_online_check_tells_when_the_endpoint_has_no_voice(workdir):
    """Совместимый адрес без /audio/transcriptions: подсказка выключить голосовые."""
    import respx

    with respx.mock as router:
        mock_everything(router, voice=False)
        code, out = await run_check(make_settings(workdir))
    assert code == 1
    assert "FAIL Модель: голосовые" in out and "[voice] enabled = false" in out
    # выключили, и пункт больше не мешает
    (workdir / "config" / "assistant.toml").write_text("[voice]\nenabled = false\n", encoding="utf-8")
    with respx.mock as router:
        mock_everything(router, voice=False)
        code, out = await run_check(make_settings(workdir))
    assert code == 0, out
    assert "SKIP Модель: голосовые" in out


async def test_online_check_tells_when_the_model_has_no_pictures(workdir):
    import respx

    with respx.mock as router:
        mock_everything(router, vision=False)
        code, out = await run_check(make_settings(workdir))
    assert code == 1 and "FAIL Модель: картинки" in out and "[vision] enabled = false" in out


async def test_online_check_flags_missing_webhook_and_balance(workdir):
    import respx

    with respx.mock as router:
        mock_everything(router)
        router.get(f"{ZERNIO}/webhooks/settings").mock(return_value=httpx.Response(200, json={"webhooks": []}))
        router.post(f"{OPENAI}/chat/completions").mock(return_value=httpx.Response(
            402, json={"error": {"message": "Insufficient credits", "code": 402}}))
        code, out = await run_check(make_settings(workdir))
    assert code == 1
    assert "FAIL Zernio: вебхук: не зарегистрирован" in out
    assert "FAIL Модель: запрос: похоже, закончился баланс" in out


def test_silent_wav_is_a_real_wav():
    import io
    import wave

    with wave.open(io.BytesIO(check.silent_wav(0.5))) as w:
        assert w.getnchannels() == 1 and w.getframerate() == 8000 and w.getnframes() == 4000


# ── try ──────────────────────────────────────────────────────────────

async def test_try_prints_the_answer_and_sends_nothing(workdir, net):
    net.reply("Консультация стоит 9 990 ₸.")
    out = []
    code = await tryout.run(["Сколько стоит консультация?"], settings=make_settings(workdir), out=out.append)
    text = lines_of(out)
    assert code == 0
    assert "Вопрос: Сколько стоит консультация?" in text and "Намерение: service" in text
    answer = "Консультация стоит 9 990 ₸."
    assert f"Ответ ({len(answer)} знаков): {answer}" in text and "Проверки: OK" in text
    assert net.sent == [] and net.telegram == [], "пробный ответ никому не отправляется"


async def test_try_shows_fallback_and_lead_without_saving(workdir, net):
    net.reply("Стоит 1 ₸. Гарантирую!", tool_calls=[{"name": "save_lead", "arguments": {"need": "цена"}}])
    net.reply("Стоит 2 ₸")
    out = []
    await tryout.run(["Хочу записаться"], settings=make_settings(workdir), out=out.append)
    text = lines_of(out)
    assert "заявка была бы сохранена" in text and "ЗАГОТОВКА" in text
    assert net.telegram == [] and net.sent == []


async def test_try_dialog_mode_keeps_history_and_plain_mode_does_not(workdir, net):
    net.reply("Здравствуйте!")
    net.reply("Рады помочь.")
    await tryout.run(["привет", "а что умеете?"], settings=make_settings(workdir), dialog=True, out=lambda s: None)
    second = net.model_requests[1]["messages"][1:]
    assert [m["content"] for m in second] == ["привет", "Здравствуйте!", "а что умеете?"]
    net.model_requests.clear()
    net.reply("Раз.")
    net.reply("Два.")
    await tryout.run(["привет", "а что умеете?"], settings=make_settings(workdir), out=lambda s: None)
    assert [m["content"] for m in net.model_requests[1]["messages"][1:]] == ["а что умеете?"]


async def test_try_reports_model_errors(workdir, net):
    net.reply(status=401)
    out = []
    code = await tryout.run(["привет"], settings=make_settings(workdir), out=out.append)
    assert code == 1 and "ОШИБКА" in lines_of(out) and OPENAI_KEY not in lines_of(out)


def test_python_m_app_try_is_runnable():
    """try это служебное слово Python: убеждаемся, что `python -m app.try` всё-таки запускается."""
    done = subprocess.run([sys.executable, "-m", "app.try", "--help"], cwd=ROOT, capture_output=True, text=True,
                          encoding="utf-8", timeout=60)
    assert done.returncode == 0 and "--dialog" in done.stdout


def test_python_m_app_check_is_runnable():
    done = subprocess.run([sys.executable, "-m", "app.check", "--help"], cwd=ROOT, capture_output=True, text=True,
                          encoding="utf-8", timeout=60)
    assert done.returncode == 0 and "--offline" in done.stdout


async def test_online_check_fails_when_the_model_cannot_call_functions(workdir):
    import json

    import respx

    with respx.mock as router:
        mock_everything(router)

        def chat(request):
            if "tools" in json.loads(request.content):
                return httpx.Response(404, json={"error": {"message": "No endpoints support tool use", "code": 404}})
            return httpx.Response(200, json={"choices": [{"message": {"content": "ок"}, "finish_reason": "stop"}]})

        router.post(f"{OPENAI}/chat/completions").mock(side_effect=chat)
        code, out = await run_check(make_settings(workdir))
    assert code == 1 and "FAIL Модель: вызов функций (заявки)" in out and "поддержкой tools" in out
    assert "OK   Модель: ключ, имя и баланс" in out
