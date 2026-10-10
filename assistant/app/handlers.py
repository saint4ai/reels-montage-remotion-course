"""Разбор событий Zernio: комментарии, входящий директ, ручной ответ владельца.

Главное правило: материал по кодовому слову уходит всегда, даже если ассистент выключен.
Ассистент (ответы на вопросы) подчиняется выключателям, паузе и лимитам."""

from __future__ import annotations

import logging
import sqlite3

from app import assistant as brain
from app import clock, keywords, leads, store, texts
from app.context import Ctx

log = logging.getLogger("handlers")

MAX_RETRIES = 3
RETRY_DELAY = 30


# ── вход ────────────────────────────────────────────────────────────

async def handle_event(ctx: Ctx, payload: dict) -> str:
    """Один разобранный вебхук. Возвращает короткий итог для журнала. Тексты людей в журнал не идут."""
    kind = payload.get("event") or ""
    try:
        if kind == "comment.received":
            return await handle_comment(ctx, payload)
        if kind == "message.received":
            return await handle_message(ctx, payload)
        if kind == "message.sent":
            return await handle_echo(ctx, payload)
        return f"событие {kind or 'без имени'} пропущено"
    except Exception as e:  # одно сломанное событие не должно ронять службу
        log.exception("событие %s не разобрано: %s", kind, type(e).__name__)
        await ctx.alert_once("handler", "Ассистент споткнулся на входящем событии. Подробности в журнале сервера "
                                        "(docker compose logs app).")
        return f"ошибка {type(e).__name__}"


# ── комментарии ─────────────────────────────────────────────────────

async def handle_comment(ctx: Ctx, payload: dict) -> str:
    c, account = payload.get("comment") or {}, payload.get("account") or {}
    cfg, texts_cfg = ctx.config.assistant(), ctx.config.texts()
    platform = c.get("platform") or ""
    if platform not in cfg["channels"]["comments"]:
        return f"комментарии {platform or '?'} не обрабатываются"
    author = c.get("author") or {}
    if author.get("isOwnAccount") or c.get("isReply") or c.get("parentCommentId"):
        return "свой комментарий или ветка ответов, пропуск"
    if author.get("username") and author.get("username") == account.get("username"):
        return "комментарий самого аккаунта, пропуск"

    comment_id, post_id = str(c.get("id") or ""), str(c.get("platformPostId") or "")
    account_id = str(account.get("accountId") or account.get("id") or "")
    user_id = str(author.get("id") or "")
    if ctx.test_skip("комментарий", platform, user_id, author.get("username")):
        return "пропущен, тестовый режим"
    keyword = keywords.find(c.get("text") or "", ctx.config.keywords())
    if not keyword or not comment_id or not post_id or not account_id:
        return "кодового слова нет"

    # один комментарий, одна выдача, даже если событие пришло повторно под другим id
    try:
        ctx.db.execute("insert into comments (comment_id, user_id, keyword, status, created_at) values (?, ?, ?, ?, ?)",
                       (comment_id, user_id, keyword.word, "work", clock.iso()))
    except sqlite3.IntegrityError:
        return "комментарий уже обработан"
    # тому же человеку то же слово второй раз за сутки не шлём: это выглядит как рассылка
    if _material_sent_recently(ctx, platform, user_id, keyword.word):
        _set_status(ctx, comment_id, "skipped")
        return "материал по этому слову человеку уже уходил сегодня"

    private = await ctx.zernio.private_reply(post_id, comment_id, account_id, keyword.message)
    if not private.ok:
        _set_status(ctx, comment_id, "failed")
        await ctx.alert_once(
            "private_reply",
            f"Материал по слову «{keyword.word}» не ушёл человеку из комментария: {private.error}. "
            "Если ошибка про 7 дней или уже использованный ответ, комментарий слишком старый.")
        return f"личный ответ не прошёл: {private.error}"
    _set_status(ctx, comment_id, "sent")
    ctx.db.execute("insert into material_log (platform, user_id, keyword, sent_at) values (?, ?, ?, ?)",
                   (platform, user_id, keyword.word, clock.iso()))
    if user_id:
        contact = store.upsert_contact(ctx.db, platform, user_id, username=author.get("username") or "",
                                       name=author.get("name") or "", account_id=account_id)
        ctx.db.execute("update contacts set last_material_at = ? where id = ?", (clock.iso(), contact["id"]))
        store.add_message(ctx.db, contact["id"], "assistant", f"[отправлен материал по слову «{keyword.word}»]")

    # публичный ответ только после того, как материал ушёл: иначе «отправил в директ» было бы неправдой
    variants = (texts_cfg.get("public_reply") or {}).get("templates") or []
    if variants:
        public_text = texts.with_mention(author.get("username"), texts.pick_varied(variants, "public"))
        public = await ctx.zernio.reply_comment(post_id, comment_id, account_id, public_text)
        if not public.ok:
            log.warning("публичный ответ под комментарием %s не прошёл: %s", comment_id, public.error)
    return f"материал по слову «{keyword.word}» отправлен"


def _material_sent_recently(ctx: Ctx, platform: str, user_id: str, word: str) -> bool:
    if not user_id:
        return False
    since = clock.plus(hours=-24)
    return bool(ctx.db.one("select 1 from material_log where platform = ? and user_id = ? and keyword = ?"
                           " and sent_at > ?", (platform, user_id, word, since)))


def _set_status(ctx: Ctx, comment_id: str, status: str) -> None:
    ctx.db.execute("update comments set status = ? where comment_id = ?", (status, comment_id))


# ── входящий директ ─────────────────────────────────────────────────

async def handle_message(ctx: Ctx, payload: dict) -> str:
    m, conv, account = payload.get("message") or {}, payload.get("conversation") or {}, payload.get("account") or {}
    cfg = ctx.config.assistant()
    platform = m.get("platform") or ""
    if platform not in cfg["channels"]["direct"]:
        return f"директ {platform or '?'} не обрабатывается"
    if m.get("direction") == "outgoing":
        return "исходящее под видом входящего, пропуск"
    if (payload.get("metadata") or {}).get("standby"):
        return "диалог ведёт другое приложение (standby), пропуск"

    sender = m.get("sender") or {}
    user_id = str(sender.get("id") or conv.get("participantId") or "")
    if not user_id:
        return "нет id отправителя"
    if ctx.test_skip("директ", platform, user_id, sender.get("username") or conv.get("participantUsername")):
        return "пропущен, тестовый режим"
    contact = store.upsert_contact(
        ctx.db, platform, user_id,
        username=sender.get("username") or conv.get("participantUsername") or "",
        name=sender.get("name") or conv.get("participantName") or "",
        conversation_id=str(m.get("conversationId") or conv.get("id") or ""),
        account_id=str(account.get("accountId") or account.get("id") or ""))

    typed = (m.get("text") or "").strip()
    body = await message_body(ctx, m, typed)
    if not body:
        return "пустое сообщение"
    message_id = store.add_message(ctx.db, contact["id"], "user", body,
                                   f"{platform}:{m.get('platformMessageId') or m.get('id') or ''}")
    if message_id is None:
        return "дубль доставки, пропуск"
    ctx.db.execute("update contacts set last_user_at = ? where id = ?", (clock.iso(), contact["id"]))

    # кодовое слово в личке: материал уходит всегда
    keyword = keywords.find(typed, ctx.config.keywords(), direct=True) if typed else None
    if keyword:
        store.mark_processed(ctx.db, contact["id"], message_id)
        cap = int(cfg["limits"]["material_per_person_per_day"])
        if not store.hit_limit(ctx.db, f"material:{contact['id']}", cap):
            return "лимит выдач материала этому человеку на сегодня"
        sent = await send_text(ctx, contact, keyword.message)
        if sent.ok:
            ctx.db.execute("update contacts set last_material_at = ? where id = ?", (clock.iso(), contact["id"]))
            ctx.db.execute("insert into material_log (platform, user_id, keyword, sent_at) values (?, ?, ?, ?)",
                           (platform, user_id, keyword.word, clock.iso()))
            store.add_message(ctx.db, contact["id"], "assistant", f"[отправлен материал по слову «{keyword.word}»]")
            return f"материал по слову «{keyword.word}» отправлен в директ"
        await ctx.alert_once("material_dm", f"Материал по слову «{keyword.word}» не ушёл в директ: {sent.error}")
        return f"материал не ушёл: {sent.error}"

    if not ctx.assistant_enabled():
        store.mark_processed(ctx.db, contact["id"], message_id)
        return "ассистент выключен"
    if store.is_paused(contact):
        store.mark_processed(ctx.db, contact["id"], message_id)
        return "диалог на паузе или выключен"
    a = cfg["assistant"]
    store.queue_reply(ctx.db, contact["id"], float(a["buffer_seconds"]), float(a["buffer_max_seconds"]))
    return "сообщение принято, ответ готовится"


async def message_body(ctx: Ctx, m: dict, typed: str) -> str:
    """Текст сообщения: свой текст плюс расшифровка голосового и описание картинки."""
    cfg = ctx.config.assistant()
    parts = [typed] if typed else []
    for att in m.get("attachments") or []:
        kind, original, url = att.get("type") or "", att.get("originalType") or "", att.get("url") or ""
        if kind == "audio" and cfg["voice"]["enabled"] and url:
            audio, mime = await ctx.zernio.download(url, int(cfg["voice"]["max_mb"]) * 1024 * 1024)
            heard = (await ctx.openai.transcribe(audio, "voice.m4a", mime, cfg["voice"]["model"]))[0] if audio else ""
            parts.append(f"[голосовое] {heard}" if heard else "[голосовое сообщение, расшифровать не удалось]")
        elif kind == "image" and cfg["vision"]["enabled"] and url:
            image, mime = await ctx.zernio.download(url, int(cfg["vision"]["max_mb"]) * 1024 * 1024)
            seen = (await ctx.openai.describe_image(image, mime.split(";")[0], cfg["vision"]["model"]))[0] if image else ""
            parts.append(f"[картинка] {seen}" if seen else "[прислал картинку]")
        elif kind == "share" or original in {"story_mention", "ig_post", "ig_reel"}:
            parts.append("[прислал публикацию или сторис]")
        elif kind:
            parts.append(f"[вложение: {kind}]")
    return "\n".join(parts).strip()


# ── ручной ответ владельца ──────────────────────────────────────────

async def handle_echo(ctx: Ctx, payload: dict) -> str:
    """Владелец сам ответил человеку из приложения: ассистент молчит, чтобы не говорить поверх."""
    m, conv = payload.get("message") or {}, payload.get("conversation") or {}
    cfg = ctx.config.assistant()
    platform = m.get("platform") or ""
    if platform not in cfg["channels"]["direct"] or m.get("sentVia") not in (None, "human"):
        return "исходящее не от человека, пропуск"
    # наше собственное сообщение возвращается эхом, иногда раньше, чем мы запомнили его id
    if ctx.test_skip("ответ владельца", platform, conv.get("participantId"), conv.get("participantUsername")):
        return "пропущен, тестовый режим"
    await ctx.sleep(float(cfg["owner"]["echo_wait_seconds"]))
    platform_id = str(m.get("platformMessageId") or m.get("id") or "")
    if platform_id and ctx.db.one("select 1 from sent where message_id = ?", (platform_id,)):
        return "это наше сообщение, пропуск"
    contact = ctx.db.one("select * from contacts where platform = ? and user_id = ?",
                         (platform, str(conv.get("participantId") or "")))
    if not contact:
        return "человека нет в базе, пропуск"
    text = (m.get("text") or "").strip()
    if _is_ours(ctx, contact["id"], text):
        return "текст совпал с нашим сообщением, пропуск"
    store.pause_until(ctx.db, contact["id"], clock.plus(minutes=float(cfg["owner"]["reply_pause_minutes"])))
    store.add_message(ctx.db, contact["id"], "owner", text or "[сообщение владельца]")
    return "владелец ответил сам, ассистент на паузе"


def _is_ours(ctx: Ctx, contact_id: int, text: str) -> bool:
    if not text:
        return False
    if any(k.message.strip() == text for k in ctx.config.keywords()):
        return True
    rows = ctx.db.all("select body from messages where contact_id = ? and role = 'assistant' order by id desc limit 5",
                      (contact_id,))
    return any(r["body"].strip() == text for r in rows)


# ── отправка и ответ ассистента ─────────────────────────────────────

async def send_text(ctx: Ctx, contact, text: str):
    result = await ctx.zernio.send_message(contact["conversation_id"], contact["account_id"], text)
    if result.ok and result.message_id:
        ctx.db.execute("insert or ignore into sent (message_id, created_at) values (?, ?)",
                       (result.message_id, clock.iso()))
    return result


async def reply_to_contact(ctx: Ctx, contact_id: int) -> str:
    """Ответ на накопленные сообщения человека. Вызывается, когда накопитель созрел."""
    cfg = ctx.config.assistant()
    contact = store.get_contact(ctx.db, contact_id)
    rows = store.unprocessed(ctx.db, contact_id) if contact else []
    if not rows:
        return "отвечать не на что"
    last_id = rows[-1]["id"]
    # список тестовых отправителей могли включить, пока сообщения ждали в накопителе
    if ctx.test_skip("ответ ассистента", contact["platform"], contact["user_id"], contact["username"]):
        store.mark_processed(ctx.db, contact_id, last_id)
        return "пропущен, тестовый режим"
    if not ctx.assistant_enabled() or store.is_paused(contact):
        store.mark_processed(ctx.db, contact_id, last_id)
        return "ассистент выключен или диалог на паузе"

    lim = cfg["limits"]
    if not store.hit_limit(ctx.db, f"person:{contact_id}", int(lim["per_person_per_day"])):
        store.mark_processed(ctx.db, contact_id, last_id)
        # человеку один раз за сутки объясняем, остальные сообщения молча
        if not ctx.db.kv_get(f"limit_notice:{contact_id}:{clock.today()}"):
            ctx.db.kv_set(f"limit_notice:{contact_id}:{clock.today()}", "1")
            notice = str((ctx.config.texts().get("limits") or {}).get("person_notice") or "")
            if notice:
                await send_text(ctx, contact, notice)
        return "лимит ответов этому человеку на сегодня"
    if not store.hit_limit(ctx.db, "global", int(lim["global_per_day"])):
        store.mark_processed(ctx.db, contact_id, last_id)
        await ctx.alert_once("global_limit", "Ассистент достиг суточного потолка ответов и до завтра молчит. "
                                             "Потолок меняется в config/assistant.toml, раздел [limits].", hours=20)
        return "общий потолок ответов на сегодня"

    async def on_lead(args: dict) -> str:
        return await leads.save_lead(ctx, store.get_contact(ctx.db, contact_id), args)

    answer = None
    for attempt in (1, 2):
        text = "\n".join(r["body"] for r in rows)
        history = store.history(ctx.db, contact_id, int(cfg["assistant"]["history_messages"]))
        answer = await brain.generate(ctx, store.get_contact(ctx.db, contact_id), text, history, on_lead=on_lead)
        if answer.error:
            break
        # пока модель думала, человек дописал: черновик отбрасываем и отвечаем на всё сразу
        newer = [r for r in store.unprocessed(ctx.db, contact_id) if r["id"] > last_id]
        if newer and attempt == 1:
            rows = store.unprocessed(ctx.db, contact_id)
            last_id = rows[-1]["id"]
            continue
        break

    if answer.error:
        return await _model_failed(ctx, contact_id, last_id, answer.error)

    ctx.db.kv_set(f"retry:{contact_id}", "0")
    store.mark_processed(ctx.db, contact_id, last_id)
    if answer.fallback:
        log.warning("ответ не прошёл проверки дважды, ушла заготовка: %s", "; ".join(answer.problems))
    fresh = store.get_contact(ctx.db, contact_id)
    sent = await send_text(ctx, fresh, answer.text)
    if not sent.ok:
        await ctx.alert_once("send_failed", f"Ответ ассистента не ушёл человеку: {sent.error}")
        return f"ответ не отправлен: {sent.error}"
    store.add_message(ctx.db, contact_id, "assistant", answer.text)
    ctx.db.execute("update contacts set last_assistant_at = ? where id = ?", (clock.iso(), contact_id))
    if not answer.fallback:
        brain.mark_offered(ctx, contact_id, answer.intent)
    return "ответ отправлен" + (" (заготовка)" if answer.fallback else "")


async def _model_failed(ctx: Ctx, contact_id: int, last_id: int, error: str) -> str:
    """OpenAI не ответил: пробуем ещё раз через полминуты, потом сдаёмся и зовём владельца."""
    tries = int(ctx.db.kv_get(f"retry:{contact_id}", "0") or 0) + 1
    ctx.db.kv_set(f"retry:{contact_id}", str(tries))
    await ctx.alert_once("openai", f"Ассистент не может ответить: {error}. Проверь ключ и баланс OpenAI "
                                   "(docs/guides/openai.md).")
    if tries < MAX_RETRIES:
        store.queue_reply(ctx.db, contact_id, RETRY_DELAY, RETRY_DELAY)
        return f"модель недоступна, повтор через {RETRY_DELAY} с"
    store.mark_processed(ctx.db, contact_id, last_id)
    ctx.db.kv_set(f"retry:{contact_id}", "0")
    return "модель недоступна, сообщение оставлено владельцу"


async def process_due(ctx: Ctx) -> int:
    """Один круг накопителя: отвечает тем, у кого вышел срок. Возвращает, сколько диалогов разобрано."""
    ids = store.take_due(ctx.db)
    for contact_id in ids:
        try:
            await reply_to_contact(ctx, contact_id)
        except Exception as e:
            log.exception("диалог %s не обработан: %s", contact_id, type(e).__name__)
    return len(ids)
