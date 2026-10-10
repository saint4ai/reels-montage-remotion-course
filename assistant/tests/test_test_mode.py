"""Тестовый режим (TEST_SENDERS) и сухой режим (DRY_RUN): ассистент ученика не ответит клиентам, пока он сам не проверил."""

import logging

import httpx
import respx

from app import check, handlers, reminders
from app.context import Ctx
from app.settings import Settings, parse_senders
from tests.conftest import (OPENAI, advance, comment_event, echo_event, make_settings, message_event, no_sleep)

LEAD = {"name": "Анна", "need": "записаться", "contact": "+7 701 000 00 00"}
SECRET_TEXT = "мой личный вопрос про цену"


def build(workdir, **over):
    return Ctx.build(make_settings(workdir, **over), sleep=no_sleep)


# ── разбор настроек ──────────────────────────────────────────────────

def test_test_senders_are_parsed_from_env():
    assert parse_senders("@Anna_K, 12345 ;ivan") == {"anna_k", "12345", "ivan"}
    assert parse_senders("") == frozenset() and parse_senders(None) == frozenset()
    s = Settings.from_env({"TEST_SENDERS": "@Second_Acc", "DRY_RUN": "1"})
    assert s.test_senders == {"second_acc"} and s.dry_run
    assert Settings.from_env({}).dry_run is False and Settings.from_env({"DRY_RUN": "0"}).dry_run is False


def test_sender_allowed_by_nick_or_id():
    s = Settings(test_senders=parse_senders("second_acc, 777"))
    assert s.sender_allowed("999", "Second_Acc") and s.sender_allowed("777", "other")
    assert not s.sender_allowed("999", "other") and not s.sender_allowed("", None)
    assert Settings().sender_allowed("кто угодно"), "список пуст: обычная работа"


# ── тестовый режим ───────────────────────────────────────────────────

async def test_strangers_are_skipped_silently_in_test_mode(workdir, net, monkeypatch, caplog):
    ctx = build(workdir, test_senders=parse_senders("second_acc"))
    caplog.set_level(logging.INFO)
    # чужой комментарий с кодовым словом: ни материала, ни публичного ответа, в базе ничего
    assert "тестовый режим" in await handlers.handle_event(ctx, comment_event("ПАПКА", user="u9", username="stranger"))
    # чужой директ: и кодовое слово, и вопрос
    assert "тестовый режим" in await handlers.handle_event(ctx, message_event("ПАПКА", user="u9", username="stranger"))
    assert "тестовый режим" in await handlers.handle_event(
        ctx, message_event(SECRET_TEXT, user="u9", username="stranger", message_id="m2"))
    # ручной ответ владельца чужому человеку тоже не трогаем
    assert "тестовый режим" in await handlers.handle_event(ctx, echo_event(user="u9"))
    advance(monkeypatch, seconds=60)
    assert await handlers.process_due(ctx) == 0
    assert net.sent == [] and net.telegram == [] and net.model_requests == []
    assert ctx.db.scalar("select count(*) from contacts") == 0 and ctx.db.scalar("select count(*) from messages") == 0
    skips = [r.getMessage() for r in caplog.records if "пропущен, тестовый режим" in r.getMessage()]
    assert len(skips) == 4
    ctx.db.close()


async def test_test_sender_gets_answers_by_nick_and_by_id(workdir, net, monkeypatch):
    ctx = build(workdir, test_senders=parse_senders("@Second_Acc, u7"))
    # по нику (регистр и @ не важны)
    await handlers.handle_event(ctx, comment_event("ПАПКА", user="u1", username="second_acc"))
    assert len(net.sent_to("/private-reply")) == 1
    # по id отправителя
    net.reply("Консультация стоит 9 990 ₸.")
    await handlers.handle_event(ctx, message_event("Сколько стоит?", user="u7", username="no_match"))
    advance(monkeypatch, seconds=30)
    await handlers.process_due(ctx)
    assert any("9 990" in s["json"].get("message", "") for s in net.sent_to("/messages"))
    ctx.db.close()


async def test_queue_and_reminders_respect_test_mode(workdir, net, monkeypatch):
    """Человек написал до включения тестового режима: накопитель и напоминание его уже не трогают."""
    ctx = build(workdir)
    net.reply("Ответ ассистента.")
    await handlers.handle_event(ctx, message_event("вопрос", user="u9", username="stranger"))
    advance(monkeypatch, seconds=30)
    await handlers.process_due(ctx)
    assert len(net.sent_to("/messages")) == 1
    ctx.settings.test_senders = parse_senders("second_acc")
    advance(monkeypatch, hours=4)
    assert await reminders.run_once(ctx) == 0
    assert len(net.sent_to("/messages")) == 1
    ctx.db.close()


# ── сухой режим ──────────────────────────────────────────────────────

async def test_dry_run_sends_nothing_but_keeps_state(workdir, net, monkeypatch, caplog):
    ctx = build(workdir, dry_run=True)
    caplog.set_level(logging.INFO)
    net.reply("Передал заявку, с вами свяжутся.", tool_calls=[{"name": "save_lead", "arguments": LEAD}])
    await handlers.handle_event(ctx, comment_event("ПАПКА", user="u1", username="anna_k"))
    await handlers.handle_event(ctx, message_event("Хочу записаться", user="u2", username="ivan"))
    advance(monkeypatch, seconds=30)
    await handlers.process_due(ctx)
    # наружу ничего: ни Zernio, ни Telegram; модель при этом ответила
    assert net.sent == [] and net.telegram == []
    assert len(net.model_requests) == 1
    # состояние как при отправке: материал отмечен, заявка сохранена и считается доставленной, диалог на паузе
    assert ctx.db.scalar("select status from comments where comment_id = 'c1'") == "sent"
    assert ctx.db.scalar("select count(*) from material_log") == 1
    lead = ctx.db.one("select * from leads")
    assert lead and lead["notified"] == 1
    assert ctx.db.one("select * from contacts where user_id = 'u2'")["paused_until"]
    assert ctx.db.scalar("select count(*) from messages where role = 'assistant'") >= 2
    # в журнале видно, что ушло бы: канал, кому, начало текста не длиннее 80 знаков
    lines = [r.getMessage() for r in caplog.records if r.name == "dryrun"]
    assert any("личный ответ на комментарий" in l and "Держи папку" in l for l in lines)
    assert any("публичный ответ" in l for l in lines)
    assert any("директ" in l and "Передал заявку" in l for l in lines)
    assert any("Telegram владельцу" in l and "Новая заявка" in l for l in lines)
    assert all(len(l.split("«", 1)[-1]) <= 82 for l in lines)
    ctx.db.close()


async def test_dry_run_does_not_touch_http_at_all(workdir, monkeypatch):
    """Маршрут только у модели: запрос в Zernio, Telegram или Таблицу упал бы. Звать можно только OpenAI."""
    with respx.mock(assert_all_called=False) as router:
        model = router.post(f"{OPENAI}/chat/completions").mock(return_value=httpx.Response(200, json={
            "choices": [{"message": {"content": "Консультация стоит 9 990 ₸."}, "finish_reason": "stop"}]}))
        ctx = build(workdir, dry_run=True, leads_webhook_url="https://script.google.com/macros/s/x/exec",
                    leads_webhook_secret="s" * 16)
        assert "отправлен" in await handlers.handle_event(ctx, comment_event("ПАПКА", username="anna_k"))
        await handlers.handle_event(ctx, message_event("Сколько стоит?", user="u2"))
        advance(monkeypatch, seconds=30)
        await handlers.process_due(ctx)
        assert model.called
        assert {call.request.url.host for call in router.calls} == {"openai.test"}
        assert ctx.db.scalar("select count(*) from messages where role = 'assistant'") >= 2
        ctx.db.close()


async def test_dry_run_clients_return_ok_without_ids(workdir, net):
    ctx = build(workdir, dry_run=True)
    result = await ctx.zernio.send_message("conv1", "acc1", "Привет")
    assert result.ok and result.message_id == "", "id пустой: в таблицу «наших» сообщений он не попадает"
    assert (await ctx.zernio.reply_comment("p", "c", "acc1", "x")).ok
    assert (await ctx.zernio.private_reply("p", "c", "acc1", "x")).ok
    assert await ctx.telegram.send("Заявка") is True
    assert net.sent == [] and net.telegram == []
    ctx.db.close()


# ── журнал без текстов людей ─────────────────────────────────────────

async def test_journal_has_no_people_texts_in_test_mode(workdir, net, caplog):
    ctx = build(workdir, test_senders=parse_senders("second_acc"))
    caplog.set_level(logging.DEBUG)
    await handlers.handle_event(ctx, message_event(SECRET_TEXT, user="u9", username="stranger"))
    await handlers.handle_event(ctx, comment_event(SECRET_TEXT + " ПАПКА", user="u9", username="stranger"))
    text = "\n".join(r.getMessage() for r in caplog.records)
    assert "пропущен, тестовый режим" in text
    assert SECRET_TEXT not in text and "ПАПКА" not in text
    ctx.db.close()


# ── python -m app.check ──────────────────────────────────────────────

async def run_check(settings, **kwargs):
    out = []
    code = await check.run(settings, out=out.append, **kwargs)
    return code, "\n".join(out)


async def test_check_reports_modes(workdir):
    code, out = await run_check(make_settings(workdir, test_senders=parse_senders("a, b"), dry_run=True), offline=True)
    assert code == 0, out
    assert "OK   Тестовый режим (TEST_SENDERS): включён, отправителей: 2" in out
    assert "OK   Сухой режим (DRY_RUN): включён" in out and "Боевой режим" not in out


async def test_check_warns_in_live_mode_but_does_not_fail(workdir):
    code, out = await run_check(make_settings(workdir), offline=True)
    assert code == 0, out
    assert "SKIP Тестовый режим (TEST_SENDERS): выключен" in out and "SKIP Сухой режим (DRY_RUN): выключен" in out
    assert "WARN Боевой режим" in out


async def test_check_one_mode_is_enough_for_no_warning(workdir):
    _, out = await run_check(make_settings(workdir, dry_run=True), offline=True)
    assert "WARN" not in out
    _, out = await run_check(make_settings(workdir, test_senders=parse_senders("a")), offline=True)
    assert "WARN" not in out
