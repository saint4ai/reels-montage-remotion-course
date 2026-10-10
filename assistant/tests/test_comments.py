"""Комментарий с кодовым словом: публичный ответ с @ником и материал в директ."""

import httpx
import pytest

from app import handlers, texts
from app.config import Config
from tests.conftest import comment_event, message_event


async def test_keyword_comment_sends_material_then_public_reply(ctx, net):
    result = await handlers.handle_event(ctx, comment_event("ПАПКА", username="anna_k"))
    assert "отправлен" in result
    private = net.sent_to("/private-reply")
    public = [s for s in net.sent if s["path"] == "/inbox/comments/post1"]
    assert len(private) == 1 and len(public) == 1
    # материал уходит раньше публичного ответа: «отправил в директ» всегда правда
    assert net.sent.index(private[0]) < net.sent.index(public[0])
    assert private[0]["path"] == "/inbox/comments/post1/c1/private-reply"
    assert private[0]["json"]["accountId"] == "acc1"
    assert private[0]["json"]["message"].startswith("Держи папку со стартовым набором")
    assert "Как запустить:" in private[0]["json"]["message"] and "Нужно:" in private[0]["json"]["message"]
    assert public[0]["json"]["message"].startswith("@anna_k ")
    assert public[0]["json"]["commentId"] == "c1"
    assert public[0]["headers"]["authorization"] == "Bearer zernio-test-key-aaaaaaaaaaaa"


async def test_public_reply_is_one_of_ten_variants(ctx, net):
    variants = Config(ctx.settings).texts()["public_reply"]["templates"]
    assert len(variants) >= 10
    await handlers.handle_event(ctx, comment_event("ПАПКА", username="anna_k"))
    sent = [s for s in net.sent if s["path"] == "/inbox/comments/post1"][0]["json"]["message"]
    assert sent.removeprefix("@anna_k ") in variants


async def test_public_replies_vary(ctx, net):
    seen = []
    for i in range(12):
        await handlers.handle_event(ctx, comment_event("ПАПКА", comment_id=f"c{i}", user=f"u{i}", username=f"nick{i}"))
        seen.append([s for s in net.sent if s["path"] == "/inbox/comments/post1"][-1]["json"]["message"].split(" ", 1)[1])
    assert len(set(seen)) >= 5
    assert all(a != b for a, b in zip(seen, seen[1:])), "один и тот же ответ дважды подряд"


def test_pick_varied_never_repeats_twice_in_a_row():
    options = ["а", "б", "в", "г"]
    picks = [texts.pick_varied(options, "unit") for _ in range(200)]
    assert all(a != b for a, b in zip(picks, picks[1:]))
    assert set(picks) == set(options)


async def test_material_is_sent_even_when_assistant_is_off(workdir, net):
    from app.context import Ctx
    from tests.conftest import make_settings, no_sleep

    off = Ctx.build(make_settings(workdir, assistant_enabled=False), sleep=no_sleep)
    await handlers.handle_event(off, comment_event("ПАПКА"))
    assert len(net.sent_to("/private-reply")) == 1
    (workdir / "config" / "assistant.toml").write_text("[assistant]\nenabled = false\n", encoding="utf-8")
    on = Ctx.build(make_settings(workdir), sleep=no_sleep)
    await handlers.handle_event(on, comment_event("ПАПКА", comment_id="c2", user="u2"))
    assert len(net.sent_to("/private-reply")) == 2


async def test_typo_in_keyword_still_works(ctx, net):
    await handlers.handle_event(ctx, comment_event("githib", comment_id="c7"))
    assert "ссылки GitHub" in net.sent_to("/private-reply")[0]["json"]["message"]


async def test_comment_without_keyword_is_ignored(ctx, net):
    result = await handlers.handle_event(ctx, comment_event("Классное видео!"))
    assert net.sent == [] and "нет" in result


async def test_own_comments_and_replies_are_ignored(ctx, net):
    await handlers.handle_event(ctx, comment_event("ПАПКА", comment_id="a", author={"isOwnAccount": True}))
    await handlers.handle_event(ctx, comment_event("ПАПКА", comment_id="b", isReply=True, parentCommentId="p"))
    await handlers.handle_event(ctx, comment_event("ПАПКА", comment_id="c", username="owner_acc"))
    assert net.sent == []


async def test_comment_on_unsupported_platform_is_ignored(ctx, net):
    event = comment_event("ПАПКА")
    event["comment"]["platform"] = "youtube"
    await handlers.handle_event(ctx, event)
    assert net.sent == []


async def test_same_comment_twice_gives_one_material(ctx, net):
    await handlers.handle_event(ctx, comment_event("ПАПКА", event_id="e1"))
    result = await handlers.handle_event(ctx, comment_event("ПАПКА", event_id="e2"))
    assert "уже обработан" in result
    assert len(net.sent_to("/private-reply")) == 1


async def test_same_person_same_word_twice_a_day_gets_material_once(ctx, net):
    await handlers.handle_event(ctx, comment_event("ПАПКА", comment_id="c1"))
    result = await handlers.handle_event(ctx, comment_event("ПАПКА", comment_id="c2"))
    assert "уже уходил" in result
    assert len(net.sent_to("/private-reply")) == 1
    # другое слово тому же человеку уходит
    await handlers.handle_event(ctx, comment_event("mcp", comment_id="c3"))
    assert len(net.sent_to("/private-reply")) == 2


async def test_failed_private_reply_means_no_public_reply_and_owner_is_told(ctx, net):
    net.zernio_status["/private-reply"] = httpx.Response(
        400, json={"error": "too old", "code": "platform_api_error", "details": {"privateReplyConsumed": True}})
    result = await handlers.handle_event(ctx, comment_event("ПАПКА"))
    assert "не прошёл" in result
    assert [s for s in net.sent if s["path"] == "/inbox/comments/post1"] == []
    assert len(net.sent_to("/private-reply")) == 1, "использованный личный ответ повторять нельзя"
    assert any("не ушёл человеку" in t for t in net.telegram_texts())
    # вторая такая же ошибка не засыпает владельца
    await handlers.handle_event(ctx, comment_event("ПАПКА", comment_id="c9", user="u9"))
    assert len([t for t in net.telegram_texts() if "не ушёл человеку" in t]) == 1


async def test_temporary_zernio_failure_is_retried(ctx, net):
    net.zernio_status["/private-reply"] = [httpx.Response(503, json={"error": "busy"}),
                                           httpx.Response(200, json={"success": True, "data": {"messageId": "x"}})]
    await handlers.handle_event(ctx, comment_event("ПАПКА"))
    assert len(net.sent_to("/private-reply")) == 2, "первая попытка 503, вторая прошла"
    assert any(s["path"] == "/inbox/comments/post1" for s in net.sent), "после повтора публичный ответ ушёл"


async def test_rate_limited_zernio_waits_and_retries(ctx, net):
    net.zernio_status["/private-reply"] = [httpx.Response(429, headers={"Retry-After": "1"}, json={"error": "slow"}),
                                           httpx.Response(200, json={"success": True, "data": {}})]
    result = await handlers.handle_event(ctx, comment_event("ПАПКА"))
    assert "отправлен" in result


async def test_inactive_word_and_comments_only_flags(ctx, net):
    await handlers.handle_event(ctx, comment_event("черновик", comment_id="x1"))
    assert net.sent == []
    await handlers.handle_event(ctx, comment_event("ролик", comment_id="x2"))
    assert len(net.sent_to("/private-reply")) == 1


async def test_dm_with_word_gets_material_in_conversation(ctx, net):
    result = await handlers.handle_event(ctx, message_event("папка", message_id="m1"))
    assert "отправлен в директ" in result
    sent = net.sent_to("/messages")[0]
    assert sent["path"] == "/inbox/conversations/conv1/messages"
    assert sent["json"]["accountId"] == "acc1"
    assert sent["json"]["message"].startswith("Держи папку")
    assert sent["headers"]["idempotency-key"]
    assert net.model_requests == []
