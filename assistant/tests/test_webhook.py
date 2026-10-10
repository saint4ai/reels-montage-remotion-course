"""Вебхук Zernio: подпись, идемпотентность, быстрый ответ и работа в фоне."""

import json

from fastapi.testclient import TestClient

from app.main import create_app
from tests.conftest import WEBHOOK_SECRET, comment_event, message_event, sign


def post(client, payload, *, secret=WEBHOOK_SECRET, signature=None, headers=None):
    raw = json.dumps(payload, ensure_ascii=False).encode()
    sig = signature if signature is not None else (sign(raw, secret) if secret else "")
    h = {"Content-Type": "application/json", **(headers or {})}
    if sig:
        h["X-Zernio-Signature"] = sig
    return client.post("/webhooks/zernio", content=raw, headers=h)


def make_client(ctx):
    return TestClient(create_app(ctx=ctx, start_loops=False))


def test_valid_signature_is_accepted_and_processed(ctx, net):
    client = make_client(ctx)
    r = post(client, comment_event("ПАПКА"))
    assert r.status_code == 200 and r.json() == {"ok": True}
    # фоновая задача успела выдать материал
    assert len(net.sent_to("/private-reply")) == 1


def test_bad_signature_is_rejected(ctx, net):
    client = make_client(ctx)
    r = post(client, comment_event("ПАПКА"), signature="0" * 64)
    assert r.status_code == 403
    assert net.sent == []


def test_missing_signature_is_rejected(ctx, net):
    client = make_client(ctx)
    raw = json.dumps(comment_event()).encode()
    assert client.post("/webhooks/zernio", content=raw).status_code == 403
    assert net.sent == []


def test_signature_of_other_secret_is_rejected(ctx, net):
    client = make_client(ctx)
    assert post(client, comment_event(), secret="чужой-секрет-чужой-секрет-1234").status_code == 403


def test_empty_secret_never_lets_anything_in(workdir, net):
    from app.context import Ctx
    from tests.conftest import make_settings, no_sleep

    empty = Ctx.build(make_settings(workdir, zernio_webhook_secret=""), sleep=no_sleep)
    client = TestClient(create_app(ctx=empty, start_loops=False))
    raw = json.dumps(comment_event()).encode()
    # подпись, посчитанная от пустого секрета, тоже не проходит
    r = client.post("/webhooks/zernio", content=raw, headers={"X-Zernio-Signature": sign(raw, "")})
    assert r.status_code == 403 and net.sent == []


def test_repeated_event_id_is_processed_once(ctx, net):
    client = make_client(ctx)
    payload = comment_event("ПАПКА", event_id="same-event")
    assert post(client, payload).json() == {"ok": True}
    again = post(client, payload)
    assert again.status_code == 200 and again.json()["duplicate"] is True
    assert len(net.sent_to("/private-reply")) == 1


def test_event_id_from_header_is_used_for_dedupe(ctx, net):
    client = make_client(ctx)
    payload = comment_event("ПАПКА")
    payload.pop("id")
    headers = {"X-Zernio-Event-Id": "header-id-1"}
    post(client, payload, headers=headers)
    assert post(client, payload, headers=headers).json()["duplicate"] is True
    assert len(net.sent_to("/private-reply")) == 1


def test_test_event_gets_200_and_is_not_processed(ctx, net):
    client = make_client(ctx)
    r = post(client, {"id": "t1", "event": "webhook.test", "message": "тест", "timestamp": "2026-10-10T10:00:00Z"})
    assert r.status_code == 200 and net.sent == []
    flagged = comment_event("ПАПКА")
    flagged["test"] = True
    assert post(client, flagged).status_code == 200
    assert net.sent == []


def test_invalid_json_is_400(ctx, net):
    client = make_client(ctx)
    raw = "{не json".encode()
    r = client.post("/webhooks/zernio", content=raw, headers={"X-Zernio-Signature": sign(raw)})
    assert r.status_code == 400


def test_message_event_is_queued_not_answered_inside_request(ctx, net):
    """Ответ вебхука не ждёт модель: сообщение только встаёт в накопитель."""
    client = make_client(ctx)
    net.reply("Привет!")
    post(client, message_event("как дела?"))
    assert net.model_requests == []
    assert ctx.db.scalar("select count(*) from pending") == 1


def test_health_reports_status_without_secrets(ctx):
    client = make_client(ctx)
    body = client.get("/health").json()
    assert body["status"] == "ok" and body["telegram_configured"] is True
    text = json.dumps(body)
    for secret in ctx.settings.secrets():
        assert secret not in text


def test_unknown_paths_and_docs_are_closed(ctx):
    client = make_client(ctx)
    assert client.get("/docs").status_code == 404
    assert client.get("/openapi.json").status_code == 404
