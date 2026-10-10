"""Входящий директ: накопитель, ответ ассистента, вложения, выключатели."""

import httpx

from app import clock, handlers, intent, store
from app.config import DEFAULTS
from tests.conftest import OPENAI, ZERNIO_KEY, advance, message_event


def contact_id(ctx, user="user1", platform="instagram"):
    return ctx.db.scalar("select id from contacts where platform = ? and user_id = ?", (platform, user))


async def answer_all(ctx, monkeypatch=None):
    """Накопитель созрел: отвечаем всем, у кого вышел срок."""
    if monkeypatch is not None:
        advance(monkeypatch, seconds=30)
    return await handlers.process_due(ctx)


async def test_question_is_answered_through_the_buffer(ctx, net, monkeypatch):
    net.reply("Консультация стоит 9 990 ₸. Записаться можно тут: https://example.com/book")
    result = await handlers.handle_event(ctx, message_event("Сколько стоит консультация?"))
    assert "принято" in result
    assert net.model_requests == [], "ответ не готовится, пока накопитель не созрел"
    assert await handlers.process_due(ctx) == 0, "срок ещё не вышел"
    await answer_all(ctx, monkeypatch)
    sent = net.sent_to("/messages")
    assert len(sent) == 1 and sent[0]["json"]["message"].startswith("Консультация стоит 9 990")
    assert sent[0]["path"] == "/inbox/conversations/conv1/messages"
    # модель получила промпт ученика, правила, базу знаний и сообщение человека
    request = net.model_requests[0]
    system = request["messages"][0]["content"]
    assert "мастерской Тест" in system and "Жёсткие правила" in system and "9 990 ₸" in system
    assert request["messages"][-1] == {"role": "user", "content": "Сколько стоит консультация?"}
    assert request["model"] == "test-model"
    # ответ записан в историю
    assert ctx.db.scalar("select body from messages where role = 'assistant' order by id desc limit 1").startswith("Консультация")


async def test_several_messages_in_a_row_become_one_answer(ctx, net, monkeypatch):
    net.reply("Здравствуйте! Расскажу всё по порядку.")
    for i, text in enumerate(["привет", "а у вас есть услуги?", "и ещё вопрос"]):
        await handlers.handle_event(ctx, message_event(text, message_id=f"m{i}"))
    await answer_all(ctx, monkeypatch)
    assert len(net.model_requests) == 1
    assert len(net.sent_to("/messages")) == 1
    roles = [m["content"] for m in net.model_requests[0]["messages"][1:]]
    assert roles == ["привет", "а у вас есть услуги?", "и ещё вопрос"]


async def test_buffer_waits_at_most_max_seconds(ctx, net, monkeypatch):
    await handlers.handle_event(ctx, message_event("раз", message_id="m0"))
    advance(monkeypatch, seconds=10)
    await handlers.handle_event(ctx, message_event("два", message_id="m1"))
    advance(monkeypatch, seconds=9)
    await handlers.handle_event(ctx, message_event("три", message_id="m2"))   # 19 с от первого, срок сдвинулся бы на 21
    advance(monkeypatch, seconds=0.5)
    assert store.take_due(ctx.db) == [], "до 20 секунд ещё ждём"
    await handlers.handle_event(ctx, message_event("четыре", message_id="m3"))   # 19.5 с, срок упирается в потолок
    advance(monkeypatch, seconds=1)
    assert store.take_due(ctx.db), "потолок 20 секунд от первого сообщения сработал"


async def test_history_is_sent_to_the_model(ctx, net, monkeypatch):
    net.reply("Первый ответ.")
    net.reply("Второй ответ.")
    await handlers.handle_event(ctx, message_event("первый вопрос", message_id="m1"))
    await answer_all(ctx, monkeypatch)
    await handlers.handle_event(ctx, message_event("второй вопрос", message_id="m2"))
    await answer_all(ctx, monkeypatch)
    sent = [m["content"] for m in net.model_requests[1]["messages"][1:]]
    assert sent == ["первый вопрос", "Первый ответ.", "второй вопрос"]


async def test_long_phrase_with_keyword_goes_to_assistant_not_material(ctx, net, monkeypatch):
    net.reply("Расскажу подробнее.")
    await handlers.handle_event(ctx, message_event("а можно мне папку со стартовым набором пожалуйста"))
    await answer_all(ctx, monkeypatch)
    assert len(net.model_requests) == 1
    assert "Держи папку" not in net.sent_to("/messages")[0]["json"]["message"]


async def test_assistant_off_means_no_model_call_but_material_still_comes(workdir, net, monkeypatch):
    from app.context import Ctx
    from tests.conftest import make_settings, no_sleep

    off = Ctx.build(make_settings(workdir, assistant_enabled=False), sleep=no_sleep)
    await handlers.handle_event(off, message_event("сколько стоит?", message_id="a1"))
    assert store.take_due(off.db) == []
    await handlers.handle_event(off, message_event("папка", message_id="a2"))
    assert net.model_requests == []
    assert len(net.sent_to("/messages")) == 1


async def test_paused_and_switched_off_dialogs_stay_silent(ctx, net, monkeypatch):
    await handlers.handle_event(ctx, message_event("привет", message_id="m0"))
    await answer_all(ctx, monkeypatch)
    cid = contact_id(ctx)
    store.pause_until(ctx.db, cid, clock.plus(hours=1))
    before = len(net.model_requests)
    await handlers.handle_event(ctx, message_event("ты тут?", message_id="m1"))
    await answer_all(ctx, monkeypatch)
    assert len(net.model_requests) == before
    store.set_assistant(ctx.db, cid, False)
    advance(monkeypatch, hours=2)
    await handlers.handle_event(ctx, message_event("алло", message_id="m2"))
    await answer_all(ctx, monkeypatch)
    assert len(net.model_requests) == before
    # сообщения паузы не копятся: после включения ответ только на новое
    store.set_assistant(ctx.db, cid, True)
    net.reply("Здесь.")
    await handlers.handle_event(ctx, message_event("вернулся", message_id="m3"))
    await answer_all(ctx, monkeypatch)
    last = net.model_requests[-1]["messages"]
    assert last[-1]["content"] == "вернулся"


async def test_duplicate_delivery_is_ignored(ctx, net, monkeypatch):
    await handlers.handle_event(ctx, message_event("привет", message_id="same"))
    result = await handlers.handle_event(ctx, message_event("привет", message_id="same", event_id="other-event"))
    assert "дубль" in result
    await answer_all(ctx, monkeypatch)
    assert len(net.model_requests) == 1


async def test_skipped_events(ctx, net):
    assert "исходящее" in await handlers.handle_event(ctx, message_event("я сам", direction="outgoing"))
    assert "standby" in await handlers.handle_event(ctx, message_event("привет", metadata={"standby": True}, message_id="s1"))
    assert "не обрабатывается" in await handlers.handle_event(ctx, message_event("привет", platform="facebook", message_id="s2"))
    assert "пропущено" in await handlers.handle_event(ctx, {"event": "message.delivered"})
    assert ctx.db.scalar("select count(*) from pending") == 0


async def test_other_channels_are_answered_too(ctx, net, monkeypatch):
    net.reply("Здравствуйте, это WhatsApp.")
    await handlers.handle_event(ctx, message_event("добрый день", platform="whatsapp", user="77011234567", message_id="w1"))
    await answer_all(ctx, monkeypatch)
    assert "WhatsApp" in net.sent_to("/messages")[0]["json"]["message"]


async def test_voice_message_is_transcribed(ctx, net, monkeypatch):
    download = net.router.get("https://cdn.test/voice.m4a").mock(
        return_value=httpx.Response(200, content=b"audio-bytes", headers={"content-type": "audio/mp4"}))
    route = net.router.post(f"{OPENAI}/audio/transcriptions").mock(
        return_value=httpx.Response(200, json={"text": "сколько стоит консультация"}))
    net.reply("9 990 ₸.")
    event = message_event("", message_id="v1", attachments=[{"type": "audio", "url": "https://cdn.test/voice.m4a"}])
    await handlers.handle_event(ctx, event)
    await answer_all(ctx, monkeypatch)
    assert route.called and download.called
    assert net.model_requests[0]["messages"][-1]["content"] == "[голосовое] сколько стоит консультация"
    # ключ Zernio к чужому адресу вложения не уходит
    assert "authorization" not in download.calls[0].request.headers


async def test_voice_can_be_switched_off(workdir, net, monkeypatch):
    from app.context import Ctx
    from tests.conftest import make_settings, no_sleep

    (workdir / "config" / "assistant.toml").write_text("[voice]\nenabled = false\n", encoding="utf-8")
    ctx = Ctx.build(make_settings(workdir), sleep=no_sleep)
    route = net.router.post(url__regex=r".*/audio/transcriptions").mock(return_value=httpx.Response(200, json={"text": "x"}))
    await handlers.handle_event(ctx, message_event("", message_id="v2",
                                                   attachments=[{"type": "audio", "url": "https://cdn.test/v.m4a"}]))
    assert not route.called
    body = ctx.db.scalar("select body from messages where role = 'user' limit 1")
    assert body == "[вложение: audio]"


async def test_voice_failure_leaves_a_marker(ctx, net, monkeypatch):
    net.router.get("https://cdn.test/voice.m4a").mock(return_value=httpx.Response(404))
    await handlers.handle_event(ctx, message_event("", message_id="v3",
                                                   attachments=[{"type": "audio", "url": "https://cdn.test/voice.m4a"}]))
    assert ctx.db.scalar("select body from messages where role = 'user' limit 1") == \
        "[голосовое сообщение, расшифровать не удалось]"


async def test_picture_is_described(ctx, net, monkeypatch):
    net.router.get("https://cdn.test/pic.jpg").mock(
        return_value=httpx.Response(200, content=b"\xff\xd8\xff", headers={"content-type": "image/jpeg"}))
    net.reply("Скриншот оплаты, сумма 9 990 ₸")   # ответ на запрос описания картинки
    net.reply("Спасибо, вижу оплату.")
    await handlers.handle_event(ctx, message_event("вот", message_id="p1",
                                                   attachments=[{"type": "image", "url": "https://cdn.test/pic.jpg"}]))
    body = ctx.db.scalar("select body from messages where role = 'user' limit 1")
    assert body == "вот\n[картинка] Скриншот оплаты, сумма 9 990 ₸"
    parts = net.model_requests[0]["messages"][1]["content"]
    assert parts[1]["type"] == "image_url" and parts[1]["image_url"]["url"].startswith("data:image/jpeg;base64,")


async def test_zernio_attachment_download_carries_the_key(ctx, net):
    route = net.router.get("https://zernio.test/api/v1/whatsapp/media/abc").mock(
        return_value=httpx.Response(200, content=b"x", headers={"content-type": "audio/ogg"}))
    data, mime = await ctx.zernio.download("https://zernio.test/api/v1/whatsapp/media/abc", 1000)
    assert data == b"x" and route.calls[0].request.headers["authorization"] == "Bearer zernio-test-key-aaaaaaaaaaaa"
    other = net.router.get("https://cdn.test/o.jpg").mock(return_value=httpx.Response(200, content=b"y"))
    await ctx.zernio.download("https://cdn.test/o.jpg", 1000)
    assert "authorization" not in other.calls[0].request.headers


async def test_model_failure_retries_then_alerts_owner(ctx, net, monkeypatch):
    for _ in range(3):
        net.reply(status=500)
    for _ in range(6):
        net.reply(status=500)
    await handlers.handle_event(ctx, message_event("привет", message_id="f1"))
    await answer_all(ctx, monkeypatch)
    assert net.sent_to("/messages") == [], "человеку ничего не отправили"
    assert any("Ассистент не может ответить" in t for t in net.telegram_texts())
    assert ctx.db.scalar("select count(*) from pending") == 1, "повтор запланирован"


# ── «лёгкий РОП»: намерение человека ────────────────────────────────

WORDS = DEFAULTS["intent"]


def test_intent_service_material_question():
    d = intent.detect
    assert d("Сколько стоит консультация?", recent_material=False, words=WORDS) == intent.SERVICE
    assert d("хочу заказать сайт под ключ", recent_material=False, words=WORDS) == intent.SERVICE
    assert d("не получается открыть ссылку", recent_material=False, words=WORDS) == intent.MATERIAL
    assert d("а что дальше?", recent_material=True, words=WORDS) == intent.MATERIAL
    assert d("как работает ваш подход к обучению и чем он отличается от других", recent_material=True,
             words=WORDS) == intent.QUESTION
    assert d("расскажите о себе", recent_material=False, words=WORDS) == intent.QUESTION
    # цена важнее недавнего материала
    assert d("сколько стоит?", recent_material=True, words=WORDS) == intent.SERVICE


async def test_instruction_does_not_push_sales_to_someone_who_came_for_material(ctx, net, monkeypatch):
    net.reply("Открой папку в Claude.")
    await handlers.handle_event(ctx, message_event("папка", message_id="m1"))
    await handlers.handle_event(ctx, message_event("а что дальше делать?", message_id="m2"))
    await answer_all(ctx, monkeypatch)
    system = net.model_requests[0]["messages"][0]["content"]
    assert "пришёл за материалом" in system and "не предлагай" in system
    assert "Один раз, мягко, предложи" not in system


async def test_service_is_offered_once(ctx, net, monkeypatch):
    net.reply("Консультация стоит 9 990 ₸. Хотите записаться?")
    net.reply("Час работы. Ссылка: https://example.com/book")
    await handlers.handle_event(ctx, message_event("сколько стоит консультация", message_id="m1"))
    await answer_all(ctx, monkeypatch)
    await handlers.handle_event(ctx, message_event("а сколько длится", message_id="m2"))
    # «сколько длится» без слов про услуги: проверим явно вопросом про цену
    await handlers.handle_event(ctx, message_event("и сколько стоит ещё раз", message_id="m3"))
    await answer_all(ctx, monkeypatch)
    first, second = (r["messages"][0]["content"] for r in net.model_requests[:2])
    assert "Один раз, мягко, предложи" in first
    assert "второй раз не предлагай" in second
