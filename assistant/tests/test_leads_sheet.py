"""Заявка и Google Таблица (LEADS_WEBHOOK_URL): успех, ошибка, выключено. Telegram от Таблицы не зависит."""

import json
import logging
import sqlite3

import httpx

from app import check, handlers, leads, store
from app.context import Ctx
from app.db import DB
from app.settings import Settings
from tests.conftest import advance, make_settings, message_event, no_sleep

SHEET = "https://script.google.com/macros/s/AKtest-sheet-address/exec"
SHEET_SECRET = "sheet-secret-0123456789abcdef"
LEAD = {"name": "Анна", "need": "записаться на консультацию", "contact": "+7 701 000 00 00"}


def sheet_ctx(workdir, **over):
    values = dict(leads_webhook_url=SHEET, leads_webhook_secret=SHEET_SECRET)
    values.update(over)
    return Ctx.build(make_settings(workdir, **values), sleep=no_sleep)


async def ask(ctx, monkeypatch, message_id="m1"):
    await handlers.handle_event(ctx, message_event("Хочу записаться", message_id=message_id, username="anna_k"))
    advance(monkeypatch, seconds=30)
    await handlers.process_due(ctx)


def lead_row(ctx):
    return ctx.db.one("select * from leads")


async def test_lead_goes_to_the_sheet_and_to_telegram(workdir, net, monkeypatch):
    posted = []

    def sheet(request):
        posted.append(json.loads(request.content))
        return httpx.Response(200, json={"ok": True})

    net.router.post(SHEET).mock(side_effect=sheet)
    ctx = sheet_ctx(workdir)
    net.reply("Передал.", tool_calls=[{"name": "save_lead", "arguments": LEAD}])
    await ask(ctx, monkeypatch)
    assert len(posted) == 1
    row = posted[0]
    assert row["channel"] == "Instagram" and row["name"] == "Анна" and row["nick"] == "@anna_k"
    assert row["need"] == "записаться на консультацию" and row["contact"] == "+7 701 000 00 00"
    assert row["dialog"] == "https://ig.me/m/anna_k" and row["secret"] == SHEET_SECRET and row["time"]
    assert lead_row(ctx)["sheet_sent"] == 1 and lead_row(ctx)["notified"] == 1
    assert any("Новая заявка" in t for t in net.telegram_texts())
    ctx.db.close()


async def test_sheet_error_does_not_break_telegram(workdir, net, monkeypatch, caplog):
    caplog.set_level(logging.DEBUG)
    net.router.post(SHEET).mock(side_effect=httpx.ConnectError("нет сети"))
    ctx = sheet_ctx(workdir)
    net.reply("Передал.", tool_calls=[{"name": "save_lead", "arguments": LEAD}])
    await ask(ctx, monkeypatch)
    assert any("Новая заявка" in t for t in net.telegram_texts())
    assert lead_row(ctx)["notified"] == 1 and lead_row(ctx)["sheet_sent"] == 0
    assert "в Google Таблицу не ушла" in caplog.text
    # ни адрес, ни секрет Таблицы в журнал не попадают
    assert SHEET not in caplog.text and SHEET_SECRET not in caplog.text
    ctx.db.close()


async def test_sheet_answers_with_error_codes_and_script_errors(workdir, net, monkeypatch):
    ctx = sheet_ctx(workdir)
    contact = store.upsert_contact(ctx.db, "instagram", "u1", username="ivan")
    cases = [httpx.Response(500, text="oops"), httpx.Response(403, json={"ok": False}),
             httpx.Response(200, json={"ok": False, "error": "секрет не совпал"})]
    for answer in cases:
        net.router.post(SHEET).mock(return_value=answer)
        ok, why = await leads._post_sheet(ctx, {"time": "x"})
        assert ok is False and why
    net.router.post(SHEET).mock(return_value=httpx.Response(200, json={"ok": True}))
    assert (await leads._post_sheet(ctx, {"time": "x"}))[0] is True
    # ответ без JSON (страница Google) считается успехом: строка уже записана
    net.router.post(SHEET).mock(return_value=httpx.Response(200, text="<html>ok</html>"))
    assert (await leads._post_sheet(ctx, {"time": "x"}))[0] is True
    assert contact
    ctx.db.close()


async def test_apps_script_redirect_is_followed(workdir, net):
    ctx = sheet_ctx(workdir)
    net.router.post(SHEET).mock(return_value=httpx.Response(302, headers={"Location": "https://script.googleusercontent.com/echo?x=1"}))
    net.router.get("https://script.googleusercontent.com/echo?x=1").mock(return_value=httpx.Response(200, json={"ok": True}))
    assert await leads._post_sheet(ctx, {"time": "x"}) == (True, "")
    ctx.db.close()


async def test_sheet_is_off_when_address_is_empty(workdir, net, monkeypatch):
    route = net.router.post(SHEET).mock(return_value=httpx.Response(200, json={"ok": True}))
    ctx = Ctx.build(make_settings(workdir), sleep=no_sleep)   # адреса нет
    net.reply("Передал.", tool_calls=[{"name": "save_lead", "arguments": LEAD}])
    await ask(ctx, monkeypatch)
    assert not route.called
    assert lead_row(ctx)["notified"] == 1 and lead_row(ctx)["sheet_sent"] == 0
    assert await leads.retry_sheet(ctx) == 0 and not route.called
    assert any("Новая заявка" in t for t in net.telegram_texts())
    ctx.db.close()


async def test_failed_sheet_is_retried_once_a_minute(workdir, net, monkeypatch):
    answers = [httpx.Response(500)]
    calls = []

    def sheet(request):
        calls.append(json.loads(request.content))
        return answers[0]

    net.router.post(SHEET).mock(side_effect=sheet)
    ctx = sheet_ctx(workdir)
    net.reply("Передал.", tool_calls=[{"name": "save_lead", "arguments": LEAD}])
    await ask(ctx, monkeypatch)
    assert lead_row(ctx)["sheet_sent"] == 0 and len(calls) == 1
    # первый повтор сразу после сбоя: проходит, Таблица всё ещё не отвечает
    assert await leads.retry_sheet(ctx) == 0 and len(calls) == 2
    # в ту же минуту повторов нет
    assert await leads.retry_sheet(ctx) == 0 and len(calls) == 2
    answers[0] = httpx.Response(200, json={"ok": True})
    advance(monkeypatch, seconds=61)
    assert await leads.retry_sheet(ctx) == 1 and len(calls) == 3
    assert lead_row(ctx)["sheet_sent"] == 1
    # дошедшая заявка больше не повторяется
    advance(monkeypatch, seconds=130)
    assert await leads.retry_unsent(ctx) == 0 and len(calls) == 3
    ctx.db.close()


async def test_old_leads_are_not_resent_to_a_new_sheet(workdir, net, monkeypatch):
    route = net.router.post(SHEET).mock(return_value=httpx.Response(200, json={"ok": True}))
    ctx = sheet_ctx(workdir)
    contact = store.upsert_contact(ctx.db, "instagram", "u1", username="ivan")
    ctx.db.execute("insert into leads (contact_id, name, need, contact, notified, created_at) values (?, 'Иван', 'цена', '', 1, ?)",
                   (contact["id"], "2020-01-01T10:00:00.000000"))
    assert await leads.retry_sheet(ctx) == 0 and not route.called
    ctx.db.close()


def test_payload_has_safe_defaults():
    contact = {"platform": "whatsapp", "user_id": "77011234567", "username": "", "name": ""}
    row = leads.sheet_payload(contact, {"need": "цена"}, "2026-10-10T10:00:00.000000")
    assert row["name"] == "без имени" and row["nick"] == "" and row["contact"] == "не оставил"
    assert row["channel"] == "WhatsApp" and row["dialog"] == "https://wa.me/77011234567" and "secret" not in row


def test_old_database_gets_the_new_column(tmp_path):
    path = tmp_path / "old.db"
    conn = sqlite3.connect(path)
    conn.execute("create table leads (id integer primary key autoincrement, contact_id integer, name text, need text, contact text, notified integer default 0, created_at text)")
    conn.execute("insert into leads (contact_id, name, need, contact, created_at) values (1, 'А', 'б', 'в', 'г')")
    conn.commit()
    conn.close()
    db = DB(path)
    row = db.one("select sheet_sent from leads")
    assert row["sheet_sent"] == 0
    db.close()


async def test_check_warns_about_missing_secret_and_pings_the_sheet(workdir, net):
    # адрес Apps Script без секрета: шаблон строки не принимает, проверка говорит об этом
    out = []
    await check.run(make_settings(workdir, leads_webhook_url=SHEET), offline=True, out=out.append)
    text = "\n".join(out)
    assert "FAIL LEADS_WEBHOOK_SECRET" in text and SHEET not in text
    # выключено: пункт пропущен, не ошибка
    out.clear()
    code = await check.run(make_settings(workdir), offline=True, out=out.append)
    assert code == 0 and "SKIP LEADS_WEBHOOK_URL" in "\n".join(out)
    # живая проверка отправляет test-запрос и не просит строку
    ctx = sheet_ctx(workdir)
    seen = []
    net.router.post(SHEET).mock(side_effect=lambda r: (seen.append(json.loads(r.content)), httpx.Response(200, json={"ok": True, "test": True}))[1])
    assert await leads.ping_sheet(ctx) == (True, "")
    assert seen == [{"test": True, "secret": SHEET_SECRET}]
    ctx.db.close()


def test_settings_hide_sheet_values():
    values = Settings(leads_webhook_url=SHEET, leads_webhook_secret=SHEET_SECRET).secrets()
    assert SHEET in values and SHEET_SECRET in values
