"""Заявка: инструмент модели, сообщение в Telegram, пауза и кнопки владельца."""

import httpx

from app import handlers, leads, loops, store
from tests.conftest import CHAT, advance, message_event

LEAD = {"name": "Анна", "need": "записаться на консультацию", "contact": "+7 701 000 00 00"}


async def ask(ctx, net, monkeypatch, text="Хочу записаться на консультацию", message_id="m1"):
    await handlers.handle_event(ctx, message_event(text, message_id=message_id, username="anna_k"))
    advance(monkeypatch, seconds=30)
    await handlers.process_due(ctx)


def cid(ctx):
    return ctx.db.scalar("select id from contacts where user_id = 'user1'")


async def test_model_saves_a_lead_and_owner_gets_telegram(ctx, net, monkeypatch):
    net.reply("Передал заявку, с вами свяжутся.", tool_calls=[{"name": "save_lead", "arguments": LEAD}])
    await ask(ctx, net, monkeypatch)
    # заявка в базе
    row = ctx.db.one("select * from leads")
    assert row["name"] == "Анна" and row["need"] == "записаться на консультацию" and row["notified"] == 1
    # владелец получил сообщение с контактами, ссылкой на диалог и кнопками
    text = net.telegram_texts()[0]
    assert "Новая заявка" in text and "Анна (@anna_k), Instagram" in text
    assert "записаться на консультацию" in text and "+7 701 000 00 00" in text
    assert "https://ig.me/m/anna_k" in text and "на паузе 12 ч" in text
    message = [t for t in net.telegram if t["method"] == "sendMessage"][0]["json"]
    assert message["chat_id"] == CHAT
    buttons = message["reply_markup"]["inline_keyboard"][0]
    assert [b["text"] for b in buttons] == ["Включить ассистента", "Выключить"]
    assert buttons[0]["callback_data"] == f"on:{cid(ctx)}" and buttons[1]["callback_data"] == f"off:{cid(ctx)}"
    # человеку ушёл ответ модели
    assert net.sent_to("/messages")[0]["json"]["message"] == "Передал заявку, с вами свяжутся."
    assert chr(0x2014) not in text


async def test_after_a_lead_the_assistant_is_paused(ctx, net, monkeypatch):
    net.reply("Передал.", tool_calls=[{"name": "save_lead", "arguments": LEAD}])
    await ask(ctx, net, monkeypatch)
    before = len(net.model_requests)
    await ask(ctx, net, monkeypatch, "а скоро свяжутся?", "m2")
    assert len(net.model_requests) == before, "в диалоге с заявкой ассистент молчит"
    # через 12 часов пауза кончается
    advance(monkeypatch, hours=13)
    net.reply("Скоро.")
    await ask(ctx, net, monkeypatch, "алло?", "m3")
    assert len(net.model_requests) == before + 1


async def test_tool_call_without_text_makes_a_second_request(ctx, net, monkeypatch):
    net.reply("", tool_calls=[{"name": "save_lead", "arguments": LEAD}])
    net.reply("Передал заявку, с вами свяжутся.")
    await ask(ctx, net, monkeypatch)
    assert len(net.model_requests) == 2
    assert "Заявка уже сохранена" in net.model_requests[1]["messages"][0]["content"]
    assert net.sent_to("/messages")[0]["json"]["message"] == "Передал заявку, с вами свяжутся."


async def test_second_lead_the_same_day_is_not_duplicated(ctx, net, monkeypatch):
    net.reply("Ок.", tool_calls=[{"name": "save_lead", "arguments": LEAD}])
    await ask(ctx, net, monkeypatch)
    contact = store.get_contact(ctx.db, cid(ctx))
    again = await leads.save_lead(ctx, contact, LEAD)
    assert "уже была" in again
    assert ctx.db.scalar("select count(*) from leads") == 1
    assert len([t for t in net.telegram_texts() if "Новая заявка" in t]) == 1


async def test_empty_lead_is_ignored(ctx, net, monkeypatch):
    await handlers.handle_event(ctx, message_event("привет"))
    contact = store.get_contact(ctx.db, cid(ctx))
    assert "пустая" in await leads.save_lead(ctx, contact, {"name": "", "need": " ", "contact": ""})
    assert ctx.db.scalar("select count(*) from leads") == 0


async def test_lost_telegram_is_retried_until_delivered(ctx, net, monkeypatch):
    net.telegram_override = lambda request: httpx.Response(500, json={"ok": False})
    net.reply("Передал.", tool_calls=[{"name": "save_lead", "arguments": LEAD}])
    await ask(ctx, net, monkeypatch)
    assert ctx.db.one("select notified from leads")["notified"] == 0, "заявка сохранена, но владельцу ещё не ушла"
    assert await leads.retry_unsent(ctx) == 0
    net.telegram_override = None
    assert await leads.retry_unsent(ctx) == 1
    assert ctx.db.one("select notified from leads")["notified"] == 1
    assert await leads.retry_unsent(ctx) == 0, "второй раз не отправляем"


async def test_lead_text_for_whatsapp_and_unknown_contact(ctx, net):
    cases = [("whatsapp", "77011234567", "", "https://wa.me/77011234567"),
             ("telegram", "555", "ivan_t", "https://t.me/ivan_t"),
             ("instagram", "777", "", "")]
    for platform, user, nick, link in cases:
        contact = store.upsert_contact(ctx.db, platform, user, username=nick)
        assert leads.dialog_link(contact) == link
    text = leads.format_lead(contact, {"need": "цена"}, 12)
    assert "не оставил, напиши в диалоге" in text and "ссылки нет" in text


# ── кнопки под заявкой ──────────────────────────────────────────────

async def test_buttons_switch_the_assistant_on_and_off(ctx, net, monkeypatch):
    net.reply("Передал.", tool_calls=[{"name": "save_lead", "arguments": LEAD}])
    await ask(ctx, net, monkeypatch)
    contact_id = cid(ctx)
    handle = lambda action, number: loops.button_action(ctx, action, number)

    await ctx.telegram.handle_update({"callback_query": {"id": "q1", "data": f"off:{contact_id}",
                                                         "message": {"chat": {"id": int(CHAT)}}}}, handle)
    assert store.get_contact(ctx.db, contact_id)["off"] == 1
    answers = [t for t in net.telegram if t["method"] == "answerCallbackQuery"]
    assert answers[-1]["json"]["text"] == "Ассистент в этом диалоге выключен"

    await ctx.telegram.handle_update({"callback_query": {"id": "q2", "data": f"on:{contact_id}",
                                                         "message": {"chat": {"id": int(CHAT)}}}}, handle)
    contact = store.get_contact(ctx.db, contact_id)
    assert contact["off"] == 0 and contact["paused_until"] is None and not store.is_paused(contact)


async def test_buttons_from_other_chats_are_ignored(ctx, net, monkeypatch):
    net.reply("Передал.", tool_calls=[{"name": "save_lead", "arguments": LEAD}])
    await ask(ctx, net, monkeypatch)
    contact_id = cid(ctx)
    handle = lambda action, number: loops.button_action(ctx, action, number)
    await ctx.telegram.handle_update({"callback_query": {"id": "q9", "data": f"on:{contact_id}",
                                                         "message": {"chat": {"id": 424242}}}}, handle)
    assert store.is_paused(store.get_contact(ctx.db, contact_id)), "чужой чат диалог не включил"
    # мусорные данные кнопки не ломают обработку
    await ctx.telegram.handle_update({"callback_query": {"id": "q10", "data": "что-то:не то",
                                                         "message": {"chat": {"id": int(CHAT)}}}}, handle)
    await ctx.telegram.handle_update({"message": {"text": "привет"}}, handle)


async def test_poll_once_reads_updates_and_moves_offset(ctx, net, monkeypatch):
    updates = {"ok": True, "result": [
        {"update_id": 41, "callback_query": {"id": "q", "data": "off:999", "message": {"chat": {"id": int(CHAT)}}}}]}
    sent = []

    def telegram(request):
        sent.append((request.url.path.rsplit("/", 1)[-1], request.content))
        return httpx.Response(200, json=updates if request.url.path.endswith("getUpdates") else {"ok": True})

    net.telegram_override = telegram
    offset, ok = await ctx.telegram.poll_once(0, lambda action, number: loops.button_action(ctx, action, number))
    assert offset == 42 and ok
    assert b"allowed_updates" in sent[0][1] and b"callback_query" in sent[0][1]


async def test_telegram_without_settings_does_not_crash(workdir, net):
    from app.context import Ctx
    from tests.conftest import make_settings, no_sleep

    bare = Ctx.build(make_settings(workdir, telegram_bot_token="", telegram_lead_chat_id=""), sleep=no_sleep)
    assert await bare.telegram.send("текст") is False
    assert await leads.retry_unsent(bare) == 0
    assert await bare.telegram.poll_once(5, None) == (5, False)
