"""Клиенты внешних сервисов: Zernio и модель (Chat Completions, совместимые адреса)."""

import json

import httpx
import pytest
import respx

from app import zernio
from app.openai_client import OpenAI, parse_response
from tests.conftest import OPENAI, OPENAI_KEY, WEBHOOK_SECRET, ZERNIO, ZERNIO_KEY, no_sleep, sign

# ── подпись ──────────────────────────────────────────────────────────


def test_signature_variants():
    raw = b'{"a": 1}'
    good = sign(raw)
    assert zernio.signature_ok(raw, good, WEBHOOK_SECRET)
    assert zernio.signature_ok(raw, good.upper(), WEBHOOK_SECRET), "регистр hex не важен"
    assert zernio.signature_ok(raw, f"  {good}\n", WEBHOOK_SECRET)
    assert not zernio.signature_ok(raw + b" ", good, WEBHOOK_SECRET), "тело изменили"
    assert not zernio.signature_ok(raw, good, "другой-секрет-другой-секрет-1234")
    assert not zernio.signature_ok(raw, "", WEBHOOK_SECRET)
    assert not zernio.signature_ok(raw, None, WEBHOOK_SECRET)
    assert not zernio.signature_ok(raw, sign(raw, ""), ""), "пустой секрет не открывает дверь"


# ── Zernio ───────────────────────────────────────────────────────────

def client(sleeps=None):
    async def sleep(seconds):
        if sleeps is not None:
            sleeps.append(seconds)
    return zernio.Zernio(ZERNIO_KEY, ZERNIO, httpx.AsyncClient(), sleep=sleep)


async def test_send_message_request_shape_and_idempotency():
    with respx.mock as router:
        route = router.post(f"{ZERNIO}/inbox/conversations/c-1/messages").mock(
            return_value=httpx.Response(200, json={"success": True, "data": {"messageId": "mid-1"}}))
        a = await client().send_message("c-1", "acc-9", "Привет")
        b = await client().send_message("c-1", "acc-9", "Привет")
    request = route.calls[0].request
    assert json.loads(request.content) == {"accountId": "acc-9", "message": "Привет"}
    assert request.headers["authorization"] == f"Bearer {ZERNIO_KEY}"
    assert a.ok and a.message_id == "mid-1"
    assert route.calls[0].request.headers["idempotency-key"] != route.calls[1].request.headers["idempotency-key"]


async def test_comment_reply_uses_a_key_tied_to_the_comment():
    with respx.mock as router:
        route = router.post(f"{ZERNIO}/inbox/comments/post-1").mock(
            return_value=httpx.Response(200, json={"success": True, "data": {"commentId": "new-1"}}))
        await client().reply_comment("post-1", "c-5", "acc-9", "@ник Спасибо")
    request = route.calls[0].request
    assert json.loads(request.content) == {"accountId": "acc-9", "message": "@ник Спасибо", "commentId": "c-5"}
    assert request.headers["idempotency-key"] == "reply-c-5"


async def test_private_reply_path():
    with respx.mock as router:
        route = router.post(f"{ZERNIO}/inbox/comments/post-1/c-5/private-reply").mock(
            return_value=httpx.Response(200, json={"success": True}))
        result = await client().private_reply("post-1", "c-5", "acc-9", "Материал")
    assert result.ok and json.loads(route.calls[0].request.content) == {"accountId": "acc-9", "message": "Материал"}


async def test_client_errors_are_not_retried_and_hide_request_text():
    with respx.mock as router:
        route = router.post(f"{ZERNIO}/inbox/conversations/c/messages").mock(
            return_value=httpx.Response(403, json={"error": "Inbox addon required", "code": "feature_not_available"}))
        result = await client().send_message("c", "a", "секретный текст человека")
    assert route.call_count == 1 and not result.ok and result.status == 403
    assert "feature_not_available" in result.error and "секретный текст" not in result.error


async def test_server_errors_are_retried_with_pauses():
    sleeps = []
    with respx.mock as router:
        route = router.post(f"{ZERNIO}/inbox/conversations/c/messages").mock(side_effect=[
            httpx.Response(502), httpx.ConnectError("нет сети"), httpx.Response(200, json={"success": True})])
        result = await client(sleeps).send_message("c", "a", "x")
    assert result.ok and route.call_count == 3 and len(sleeps) == 2


async def test_gives_up_after_three_attempts():
    with respx.mock as router:
        route = router.post(f"{ZERNIO}/inbox/conversations/c/messages").mock(return_value=httpx.Response(503))
        result = await client().send_message("c", "a", "x")
    assert not result.ok and route.call_count == 3


async def test_no_key_means_no_request():
    with respx.mock as router:
        route = router.post(f"{ZERNIO}/inbox/conversations/c/messages")
        result = await zernio.Zernio("", ZERNIO, httpx.AsyncClient()).send_message("c", "a", "x")
    assert not result.ok and "ZERNIO_API_KEY" in result.error and not route.called


async def test_webhook_is_created_when_missing():
    with respx.mock as router:
        router.get(f"{ZERNIO}/webhooks/settings").mock(return_value=httpx.Response(200, json={"webhooks": []}))
        create = router.post(f"{ZERNIO}/webhooks/settings").mock(
            return_value=httpx.Response(200, json={"success": True, "webhook": {"_id": "w1"}}))
        message = await client().upsert_webhook("https://a.test/webhooks/zernio", WEBHOOK_SECRET)
    body = json.loads(create.calls[0].request.content)
    assert body == {"name": "assistant", "url": "https://a.test/webhooks/zernio", "secret": WEBHOOK_SECRET,
                    "events": ["message.received", "message.sent", "comment.received"], "isActive": True}
    assert message == "вебхук создан: https://a.test/webhooks/zernio"
    assert WEBHOOK_SECRET not in message


async def test_existing_webhook_is_updated_by_webhook_id():
    with respx.mock as router:
        router.get(f"{ZERNIO}/webhooks/settings").mock(return_value=httpx.Response(200, json={"webhooks": [
            {"_id": "w7", "name": "старый", "url": "https://old.test/webhooks/zernio", "events": ["post.failed"]},
            {"_id": "w8", "name": "assistant", "url": "https://other.test/x", "events": []}]}))
        update = router.put(f"{ZERNIO}/webhooks/settings").mock(
            return_value=httpx.Response(200, json={"success": True, "webhook": {"_id": "w8"}}))
        message = await client().upsert_webhook("https://a.test/webhooks/zernio", WEBHOOK_SECRET)
    body = json.loads(update.calls[0].request.content)
    assert body["webhookId"] == "w8" and body["url"] == "https://a.test/webhooks/zernio" and body["isActive"] is True
    assert message.startswith("вебхук обновлён")


async def test_webhook_failure_does_not_print_secret():
    with respx.mock as router:
        router.get(f"{ZERNIO}/webhooks/settings").mock(return_value=httpx.Response(200, json={"webhooks": []}))
        router.post(f"{ZERNIO}/webhooks/settings").mock(
            return_value=httpx.Response(403, json={"error": f"нет прав, секрет {WEBHOOK_SECRET}", "code": "forbidden"}))
        message = await client().upsert_webhook("https://a.test/w", WEBHOOK_SECRET)
    assert message.startswith("ошибка вебхука")


async def test_webhook_test_call():
    with respx.mock as router:
        router.get(f"{ZERNIO}/webhooks/settings").mock(return_value=httpx.Response(200, json={"webhooks": [
            {"_id": "w1", "url": "https://a.test/webhooks/zernio"}]}))
        test = router.post(f"{ZERNIO}/webhooks/test").mock(return_value=httpx.Response(200, json={"success": True}))
        assert (await client().test_webhook("https://a.test/webhooks/zernio")).startswith("тестовое")
        assert json.loads(test.calls[0].request.content) == {"webhookId": "w1"}
        assert "не найден" in await client().test_webhook("https://nobody.test/x")


# ── модель ───────────────────────────────────────────────────────────

OFFICIAL = "https://api.openai.com/v1"   # у адреса OpenAI свои имена параметров, у остальных общие


def model(base=OPENAI, sleeps=None):
    async def sleep(seconds):
        if sleeps is not None:
            sleeps.append(seconds)
    return OpenAI(OPENAI_KEY, base, "m-1", httpx.AsyncClient(), sleep=sleep)


def completion(text="Привет", tool_calls=None, finish="stop"):
    message = {"role": "assistant", "content": text}
    if tool_calls:
        message["tool_calls"] = tool_calls
    return {"choices": [{"message": message, "finish_reason": finish}], "usage": {"prompt_tokens": 7, "completion_tokens": 3}}


def test_parse_plain_and_tool_reply():
    reply = parse_response(completion("Готово", [{"id": "c1", "type": "function",
                                                  "function": {"name": "save_lead", "arguments": '{"need": "цена"}'}}]))
    assert reply.text == "Готово" and reply.tool_calls[0].name == "save_lead"
    assert reply.tool_calls[0].arguments == {"need": "цена"} and reply.tokens_in == 7 and reply.tokens_out == 3


def test_parse_broken_arguments_and_list_content():
    reply = parse_response(completion([{"type": "text", "text": "часть 1 "}, {"type": "text", "text": "часть 2"}],
                                      [{"id": "c", "function": {"name": "x", "arguments": "не json"}}]))
    assert reply.text == "часть 1 часть 2" and reply.tool_calls[0].arguments == {}


def test_parse_truncated_and_body_errors():
    assert parse_response(completion("", finish="length")).truncated
    error = parse_response({"error": {"message": "upstream down", "code": 502}})
    assert "upstream down" in error.error


async def test_openai_host_request_shape():
    with respx.mock as router:
        route = router.post(f"{OFFICIAL}/chat/completions").mock(return_value=httpx.Response(200, json=completion()))
        await model(OFFICIAL).respond("система", [{"role": "user", "content": "привет"}], tools=[{"type": "function"}],
                              max_output_tokens=500, reasoning_effort="none")
    body = json.loads(route.calls[0].request.content)
    assert body["messages"][0] == {"role": "system", "content": "система"}
    assert body["max_completion_tokens"] == 500 and "max_tokens" not in body
    assert body["reasoning_effort"] == "none" and "reasoning" not in body
    assert body["model"] == "m-1" and body["tools"] == [{"type": "function"}]
    assert route.calls[0].request.headers["authorization"] == f"Bearer {OPENAI_KEY}"


async def test_other_hosts_get_their_own_parameter_names():
    base = "https://openrouter.ai/api/v1"
    with respx.mock as router:
        route = router.post(f"{base}/chat/completions").mock(return_value=httpx.Response(200, json=completion()))
        await model(base).respond("с", [{"role": "user", "content": "п"}], max_output_tokens=300, reasoning_effort="none")
    body = json.loads(route.calls[0].request.content)
    assert body["max_tokens"] == 300 and "max_completion_tokens" not in body
    assert body["reasoning"] == {"effort": "none"} and "reasoning_effort" not in body


async def test_unsupported_reasoning_parameter_is_dropped_and_remembered():
    client_ = model(OFFICIAL)
    with respx.mock as router:
        route = router.post(f"{OFFICIAL}/chat/completions").mock(side_effect=[
            httpx.Response(400, json={"error": {"message": "Unrecognized request argument supplied: reasoning_effort"}}),
            httpx.Response(200, json=completion("ок")),
            httpx.Response(200, json=completion("ещё раз"))])
        first = await client_.respond("с", [{"role": "user", "content": "п"}], reasoning_effort="none")
        second = await client_.respond("с", [{"role": "user", "content": "п"}], reasoning_effort="none")
    assert first.text == "ок" and second.text == "ещё раз"
    bodies = [json.loads(c.request.content) for c in route.calls]
    assert "reasoning_effort" in bodies[0] and "reasoning_effort" not in bodies[1] and "reasoning_effort" not in bodies[2]


async def test_token_parameter_name_is_switched_on_400():
    client_ = model(OFFICIAL)
    with respx.mock as router:
        route = router.post(f"{OFFICIAL}/chat/completions").mock(side_effect=[
            httpx.Response(400, json={"error": {"message": "max_completion_tokens is not supported with this model"}}),
            httpx.Response(200, json=completion("ок"))])
        reply = await client_.respond("с", [{"role": "user", "content": "п"}], max_output_tokens=100)
    assert reply.text == "ок"
    assert "max_completion_tokens" in json.loads(route.calls[0].request.content)
    assert "max_tokens" in json.loads(route.calls[1].request.content)


async def test_rate_limit_and_server_errors_are_retried():
    sleeps = []
    with respx.mock as router:
        route = router.post(f"{OPENAI}/chat/completions").mock(side_effect=[
            httpx.Response(429, json={"error": {"code": "rate_limit"}}), httpx.Response(500),
            httpx.Response(200, json=completion("ок"))])
        reply = await model(sleeps=sleeps).respond("с", [{"role": "user", "content": "п"}])
    assert reply.text == "ок" and route.call_count == 3 and sleeps == [2, 4]


async def test_bad_key_error_never_contains_the_key():
    with respx.mock as router:
        router.post(f"{OPENAI}/chat/completions").mock(return_value=httpx.Response(
            401, json={"error": {"message": f"Incorrect API key provided: {OPENAI_KEY}. sk-proj-abc123456789"}}))
        reply = await model().respond("с", [{"role": "user", "content": "п"}])
    assert "ключ не принят" in reply.error and OPENAI_KEY not in reply.error and "sk-proj" not in reply.error


async def test_key_like_text_in_other_errors_is_masked():
    with respx.mock as router:
        router.post(f"{OPENAI}/chat/completions").mock(return_value=httpx.Response(
            404, json={"error": {"message": "The model does not exist for sk-live-abcdef123456", "code": "model_not_found"}}))
        reply = await model().respond("с", [{"role": "user", "content": "п"}])
    assert "model_not_found" in reply.error and "sk-live" not in reply.error and "***" in reply.error


async def test_missing_model_or_key():
    assert "OPENAI_MODEL" in (await OpenAI(OPENAI_KEY, OPENAI, "", httpx.AsyncClient()).respond("с", [])).error
    assert "OPENAI_API_KEY" in (await OpenAI("", OPENAI, "m", httpx.AsyncClient()).respond("с", [])).error


async def test_transcribe_and_describe_return_errors_instead_of_raising():
    with respx.mock as router:
        router.post(f"{OPENAI}/audio/transcriptions").mock(return_value=httpx.Response(404, json={"error": {"message": "no"}}))
        text, error = await model().transcribe(b"abc", "v.wav", "audio/wav", "whisper-1")
        assert text == "" and "404" in error
        router.post(f"{OPENAI}/chat/completions").mock(return_value=httpx.Response(
            400, json={"error": {"message": "image input is not supported"}}))
        text, error = await model().describe_image(b"\x89PNG", "image/png")
        assert text == "" and "400" in error


async def test_describe_sends_a_data_url():
    with respx.mock as router:
        route = router.post(f"{OPENAI}/chat/completions").mock(return_value=httpx.Response(200, json=completion("Чек")))
        text, error = await model().describe_image(b"abc", "image/png")
    part = json.loads(route.calls[0].request.content)["messages"][1]["content"][1]
    assert part["image_url"]["url"].startswith("data:image/png;base64,") and text == "Чек" and error == ""
