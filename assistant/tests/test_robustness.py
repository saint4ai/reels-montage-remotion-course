"""Мелочи, на которых ломаются живые запуски: порядок истории, чужие провайдеры, пульс циклов, уборка базы."""

import asyncio
import json

import httpx
import pytest
import respx

from app import clock, handlers, loops, store
from app.openai_client import OpenAI
from tests.conftest import OPENAI, OPENAI_KEY, advance, make_settings, message_event


def test_history_never_starts_with_an_assistant_reply(ctx):
    contact = store.upsert_contact(ctx.db, "instagram", "u1")
    store.add_message(ctx.db, contact["id"], "assistant", "[отправлен материал по слову «ПАПКА»]")
    store.add_message(ctx.db, contact["id"], "owner", "я сам написал")
    store.add_message(ctx.db, contact["id"], "user", "спасибо")
    store.add_message(ctx.db, contact["id"], "assistant", "Пожалуйста")
    history = store.history(ctx.db, contact["id"], 20)
    assert history == [{"role": "user", "content": "спасибо"}, {"role": "assistant", "content": "Пожалуйста"}]


def test_history_limit_keeps_the_latest(ctx):
    contact = store.upsert_contact(ctx.db, "instagram", "u1")
    for i in range(10):
        store.add_message(ctx.db, contact["id"], "user", f"вопрос {i}")
        store.add_message(ctx.db, contact["id"], "assistant", f"ответ {i}")
    history = store.history(ctx.db, contact["id"], 4)
    assert [m["content"] for m in history] == ["вопрос 8", "ответ 8", "вопрос 9", "ответ 9"][0:4]


async def test_any_400_with_reasoning_param_retries_without_it():
    client = OpenAI(OPENAI_KEY, "https://openrouter.ai/api/v1", "m", httpx.AsyncClient())
    with respx.mock as router:
        route = router.post("https://openrouter.ai/api/v1/chat/completions").mock(side_effect=[
            httpx.Response(400, json={"error": {"message": "Provider returned error"}}),
            httpx.Response(200, json={"choices": [{"message": {"content": "ок"}, "finish_reason": "stop"}]})])
        reply = await client.respond("с", [{"role": "user", "content": "п"}], reasoning_effort="none")
    assert reply.text == "ок" and "reasoning" in json.loads(route.calls[0].request.content)
    assert "reasoning" not in json.loads(route.calls[1].request.content)


async def test_a_real_400_without_reasoning_is_reported():
    client = OpenAI(OPENAI_KEY, OPENAI, "m", httpx.AsyncClient())
    with respx.mock as router:
        route = router.post(f"{OPENAI}/chat/completions").mock(
            return_value=httpx.Response(400, json={"error": {"message": "bad request", "code": "invalid"}}))
        reply = await client.respond("с", [{"role": "user", "content": "п"}])
    assert "400" in reply.error and route.call_count == 1


async def test_loop_heartbeat_continues_through_long_pauses(ctx, monkeypatch):
    sleeps = []

    async def fake_sleep(seconds):
        sleeps.append(seconds)

    monkeypatch.setattr(loops.asyncio, "sleep", fake_sleep)
    rounds = {"n": 0}

    async def step():
        rounds["n"] += 1
        if rounds["n"] == 2:
            raise asyncio.CancelledError

    with pytest.raises(asyncio.CancelledError):
        await loops._forever(ctx, "demo", step, 100)
    assert sleeps == [30, 30, 30, 10], "пауза 100 секунд спится кусками, пульс обновляется между ними"
    assert "demo" in ctx.beat


async def test_a_crashing_step_does_not_stop_the_loop(ctx, monkeypatch):
    async def fake_sleep(seconds):
        return None

    monkeypatch.setattr(loops.asyncio, "sleep", fake_sleep)
    rounds = {"n": 0}

    async def step():
        rounds["n"] += 1
        if rounds["n"] == 1:
            raise RuntimeError("сбой круга")
        if rounds["n"] == 3:
            raise asyncio.CancelledError

    with pytest.raises(asyncio.CancelledError):
        await loops._forever(ctx, "demo", step, 1)
    assert rounds["n"] == 3


def test_cleanup_removes_only_old_rows(ctx):
    old, fresh = clock.plus(hours=-24 * 40), clock.iso()
    ctx.db.execute("insert into material_log (platform, user_id, keyword, sent_at) values ('i','u','w',?)", (old,))
    ctx.db.execute("insert into material_log (platform, user_id, keyword, sent_at) values ('i','u','w',?)", (fresh,))
    ctx.db.execute("insert into comments (comment_id, created_at) values ('old', ?)", (old,))
    ctx.db.execute("insert into comments (comment_id, created_at) values ('new', ?)", (fresh,))
    ctx.db.execute("insert into events (id, received_at) values ('old', ?)", (old,))
    ctx.db.execute("insert into events (id, received_at) values ('new', ?)", (fresh,))
    store.forget_old(ctx.db)
    assert ctx.db.scalar("select count(*) from material_log") == 1
    assert [r[0] for r in ctx.db.all("select comment_id from comments")] == ["new"]
    assert [r[0] for r in ctx.db.all("select id from events")] == ["new"]


async def test_conversation_started_from_a_comment_continues_in_direct(ctx, net, monkeypatch):
    """Человек получил материал из комментария, а потом написал в директ: ассистент знает про материал."""
    from tests.conftest import comment_event

    await handlers.handle_event(ctx, comment_event("ПАПКА", user="user1", username="anna"))
    net.reply("Открой папку в Claude.")
    await handlers.handle_event(ctx, message_event("а что дальше делать?", message_id="d1", user="user1"))
    advance(monkeypatch, seconds=30)
    await handlers.process_due(ctx)
    system = net.model_requests[0]["messages"][0]["content"]
    assert "пришёл за материалом" in system
    assert ctx.db.scalar("select count(*) from contacts") == 1, "тот же человек, одна карточка"
    assert net.sent_to("/messages")[0]["json"]["message"] == "Открой папку в Claude."


async def test_unknown_event_and_broken_payload_do_not_crash(ctx, net):
    assert "пропущено" in await handlers.handle_event(ctx, {"event": "reaction.received"})
    result = await handlers.handle_event(ctx, {"event": "message.received", "message": None})
    assert "нет id" in result or "не обрабатывается" in result
    result = await handlers.handle_event(ctx, {"event": "comment.received", "comment": {"platform": "instagram"}})
    assert result
    assert net.sent == []


async def test_handler_exception_is_contained_and_owner_is_told(ctx, net, monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError("внутренний сбой")

    monkeypatch.setattr(handlers, "handle_comment", boom)
    from tests.conftest import comment_event

    result = await handlers.handle_event(ctx, comment_event("ПАПКА"))
    assert "ошибка RuntimeError" in result
    assert any("споткнулся" in t for t in net.telegram_texts())
