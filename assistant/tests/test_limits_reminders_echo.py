"""Лимиты ответов, одно напоминание, ручной ответ владельца."""

from datetime import timedelta

from app import clock, handlers, reminders, store
from tests.conftest import advance, echo_event, message_event


async def talk(ctx, monkeypatch, text="вопрос", message_id="m1", user="user1"):
    await handlers.handle_event(ctx, message_event(text, message_id=message_id, user=user))
    advance(monkeypatch, seconds=30)
    await handlers.process_due(ctx)


def write_config(workdir, text):
    (workdir / "config" / "assistant.toml").write_text(text, encoding="utf-8")


def build(workdir, **over):
    from app.context import Ctx
    from tests.conftest import make_settings, no_sleep

    return Ctx.build(make_settings(workdir, **over), sleep=no_sleep)


# ── лимиты ───────────────────────────────────────────────────────────

async def test_per_person_daily_limit(workdir, net, monkeypatch):
    write_config(workdir, "[limits]\nper_person_per_day = 2\n")
    ctx = build(workdir)
    for i in range(4):
        await talk(ctx, monkeypatch, f"вопрос {i}", f"m{i}")
    assert len(net.model_requests) == 2
    sent = [s["json"]["message"] for s in net.sent_to("/messages")]
    assert sent.count("Лимит сообщений ассистента на сегодня исчерпан. Продолжим завтра.") == 1, "уведомление одно за сутки"
    assert len(sent) == 3


async def test_limit_resets_next_day(workdir, net, monkeypatch):
    write_config(workdir, "[limits]\nper_person_per_day = 1\n")
    ctx = build(workdir)
    await talk(ctx, monkeypatch, "раз", "m1")
    await talk(ctx, monkeypatch, "два", "m2")
    assert len(net.model_requests) == 1
    advance(monkeypatch, hours=25)
    await talk(ctx, monkeypatch, "три", "m3")
    assert len(net.model_requests) == 2


async def test_limit_is_per_person(workdir, net, monkeypatch):
    write_config(workdir, "[limits]\nper_person_per_day = 1\n")
    ctx = build(workdir)
    await talk(ctx, monkeypatch, "раз", "m1", user="a")
    await talk(ctx, monkeypatch, "раз", "m2", user="b")
    assert len(net.model_requests) == 2


async def test_global_ceiling_silences_everyone_and_alerts_once(workdir, net, monkeypatch):
    write_config(workdir, "[limits]\nglobal_per_day = 2\n")
    ctx = build(workdir)
    for i in range(5):
        await talk(ctx, monkeypatch, f"вопрос {i}", f"m{i}", user=f"u{i}")
    assert len(net.model_requests) == 2
    alerts = [t for t in net.telegram_texts() if "суточного потолка" in t]
    assert len(alerts) == 1


async def test_material_limit_per_person_in_dm(workdir, net, monkeypatch):
    write_config(workdir, "[limits]\nmaterial_per_person_per_day = 2\n")
    ctx = build(workdir)
    for i in range(4):
        await handlers.handle_event(ctx, message_event("папка", message_id=f"w{i}"))
    assert len(net.sent_to("/messages")) == 2


# ── напоминание ──────────────────────────────────────────────────────

async def silent_after_answer(ctx, net, monkeypatch, hour_utc=10):
    """Человек спросил, ассистент ответил, человек замолчал. Время ставим на hour_utc часов."""
    from datetime import datetime, timezone

    start = datetime(2026, 10, 10, hour_utc, 0, tzinfo=timezone.utc)
    monkeypatch.setattr(clock, "now", lambda: start)
    await handlers.handle_event(ctx, message_event("расскажите про услуги", message_id="r1"))
    advance(monkeypatch, seconds=30)
    await handlers.process_due(ctx)
    return start


async def test_reminder_is_sent_once_after_silence(ctx, net, monkeypatch):
    await silent_after_answer(ctx, net, monkeypatch)
    advance(monkeypatch, hours=3)
    assert await reminders.run_once(ctx) == 0, "3 часа ещё рано"
    advance(monkeypatch, hours=1.5)
    assert await reminders.run_once(ctx) == 1
    texts = [s["json"]["message"] for s in net.sent_to("/messages")]
    assert len(texts) == 2 and texts[1] in ("Если остались вопросы, напиши, отвечу.", "Я на связи. Продолжим, когда будет удобно.",
                                            "Если что-то по материалу неясно, напиши сюда.", "Остались вопросы? Пиши, отвечу.",
                                            "На случай, если сообщение потерялось: если что-то неясно, пиши.")
    advance(monkeypatch, hours=5)
    assert await reminders.run_once(ctx) == 0, "второго напоминания не бывает"


async def test_no_reminder_after_a_lead_or_pause_or_when_person_replied(ctx, net, monkeypatch):
    await silent_after_answer(ctx, net, monkeypatch)
    cid = ctx.db.scalar("select id from contacts")
    ctx.db.execute("update contacts set lead_saved = 1 where id = ?", (cid,))
    advance(monkeypatch, hours=5)
    assert await reminders.run_once(ctx) == 0
    ctx.db.execute("update contacts set lead_saved = 0 where id = ?", (cid,))
    store.set_assistant(ctx.db, cid, False)
    assert await reminders.run_once(ctx) == 0
    store.set_assistant(ctx.db, cid, True)
    # человек успел ответить: последним писал он, напоминать не о чем
    ctx.db.execute("update contacts set last_user_at = ? where id = ?", (clock.iso(), cid))
    assert await reminders.run_once(ctx) == 0


async def test_no_reminder_at_night(ctx, net, monkeypatch):
    # 17:00 UTC это 22:00 по Алматы (+5): ночь уже началась
    await silent_after_answer(ctx, net, monkeypatch, hour_utc=12)
    advance(monkeypatch, hours=5)          # 17:00 UTC
    assert await reminders.run_once(ctx) == 0
    advance(monkeypatch, hours=4.5)        # 21:30 UTC, уже 02:30 ночи, но до закрытия окна 22 часа далеко
    assert await reminders.run_once(ctx) == 0


async def test_morning_reminder_when_window_still_open(ctx, net, monkeypatch):
    await silent_after_answer(ctx, net, monkeypatch, hour_utc=14)     # 19:00 по Алматы
    advance(monkeypatch, hours=4.5)                                    # 23:30: ночь
    assert await reminders.run_once(ctx) == 0
    advance(monkeypatch, hours=10)                                     # 09:30 утра, прошло 14.5 часов: окно открыто
    assert await reminders.run_once(ctx) == 1


async def test_reminder_dropped_when_the_24h_window_is_closed(ctx, net, monkeypatch):
    await silent_after_answer(ctx, net, monkeypatch, hour_utc=14)
    advance(monkeypatch, hours=23)
    before = len(net.sent_to("/messages"))
    assert await reminders.run_once(ctx) == 0
    assert len(net.sent_to("/messages")) == before
    assert ctx.db.scalar("select reminded_at from contacts") is not None, "человека больше не проверяем"


async def test_reminder_switch(workdir, net, monkeypatch):
    write_config(workdir, "[reminder]\nenabled = false\n")
    ctx = build(workdir)
    await silent_after_answer(ctx, net, monkeypatch)
    advance(monkeypatch, hours=6)
    assert await reminders.run_once(ctx) == 0


def test_quiet_hours_cross_midnight():
    assert reminders.in_quiet_hours(23, 22, 9) and reminders.in_quiet_hours(3, 22, 9)
    assert not reminders.in_quiet_hours(9, 22, 9) and not reminders.in_quiet_hours(15, 22, 9)
    assert reminders.in_quiet_hours(2, 1, 5) and not reminders.in_quiet_hours(6, 1, 5)


async def test_no_reminder_to_someone_who_only_got_material(ctx, net, monkeypatch):
    await handlers.handle_event(ctx, message_event("папка", message_id="p1"))
    advance(monkeypatch, hours=6)
    assert await reminders.run_once(ctx) == 0


# ── ручной ответ владельца ───────────────────────────────────────────

async def test_owner_reply_pauses_the_assistant_for_an_hour(ctx, net, monkeypatch):
    await talk(ctx, monkeypatch, "здравствуйте", "m1")
    net.sent.clear()
    result = await handlers.handle_event(ctx, echo_event("Привет, это я, отвечу лично"))
    assert "на паузе" in result
    contact = ctx.db.one("select * from contacts")
    assert store.is_paused(contact)
    assert (clock.parse(contact["paused_until"]) - clock.now()) > timedelta(minutes=55)
    before = len(net.model_requests)
    await talk(ctx, monkeypatch, "а можно подробнее?", "m2")
    assert len(net.model_requests) == before
    assert ctx.db.scalar("select body from messages where role = 'owner'") == "Привет, это я, отвечу лично"
    advance(monkeypatch, hours=2)
    await talk(ctx, monkeypatch, "алло", "m3")
    assert len(net.model_requests) == before + 1


async def test_our_own_messages_do_not_pause_the_assistant(ctx, net, monkeypatch):
    await talk(ctx, monkeypatch, "здравствуйте", "m1")
    own_id = ctx.db.scalar("select message_id from sent limit 1")
    assert own_id
    result = await handlers.handle_event(ctx, echo_event("Ответ по умолчанию.", message_id=own_id))
    assert "наше сообщение" in result
    # эхо пришло раньше, чем мы запомнили id: узнаём по тексту нашего последнего ответа
    result = await handlers.handle_event(ctx, echo_event("Ответ по умолчанию.", message_id="неизвестный-id"))
    assert "совпал" in result
    assert not store.is_paused(ctx.db.one("select * from contacts"))


async def test_material_echo_does_not_pause(ctx, net, monkeypatch):
    await handlers.handle_event(ctx, message_event("папка", message_id="p1"))
    material = net.sent_to("/messages")[0]["json"]["message"]
    result = await handlers.handle_event(ctx, echo_event(material, message_id="чужой-id"))
    assert "совпал" in result
    assert not store.is_paused(ctx.db.one("select * from contacts"))


async def test_automation_echoes_are_ignored(ctx, net, monkeypatch):
    await talk(ctx, monkeypatch, "здравствуйте", "m1")
    for via in ("api", "workflow", "broadcast", "comment_automation"):
        result = await handlers.handle_event(ctx, echo_event("что-то", sent_via=via, message_id=f"e-{via}"))
        assert "не от человека" in result
    assert not store.is_paused(ctx.db.one("select * from contacts"))


async def test_echo_for_unknown_person_is_ignored(ctx, net):
    assert "нет в базе" in await handlers.handle_event(ctx, echo_event("привет", user="stranger"))


async def test_longer_owner_pause_is_not_shortened(ctx, net, monkeypatch):
    await talk(ctx, monkeypatch, "здравствуйте", "m1")
    cid = ctx.db.scalar("select id from contacts")
    store.pause_until(ctx.db, cid, clock.plus(hours=12))
    await handlers.handle_event(ctx, echo_event("я здесь"))
    left = clock.parse(store.get_contact(ctx.db, cid)["paused_until"]) - clock.now()
    assert left > timedelta(hours=11)
