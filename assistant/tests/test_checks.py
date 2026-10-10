"""Проверки ответа кодом: длина, тире, суммы, ссылки, обещания. Переписывание и заготовка."""

import pytest

from app import checks, handlers
from app.config import DEFAULTS, Config
from tests.conftest import advance, message_event

ALLOWED = ("Консультация: 9 990 ₸. Запись: https://example.com/book. "
           "Материалы: example.com/start.zip и https://example.com/mcp?utm=ig")
PROMISES = DEFAULTS["checks"]["promises"]
SLOP = DEFAULTS["checks"]["slop"]


def problems(answer, **kw):
    return checks.check_answer(answer, allowed=ALLOWED, max_chars=350, promises=PROMISES, slop=SLOP, **kw)


def test_good_answer_passes():
    assert problems("Консультация стоит 9 990 ₸, запись тут: https://example.com/book") == []


def test_empty_answer_is_a_problem():
    assert problems("   ") == ["пустой ответ"]


def test_length_limit():
    assert problems("а" * 350) == []
    assert any("слишком длинно" in p for p in problems("а" * 351))


def test_long_dash_is_a_problem():
    assert any("тире" in p for p in problems("Да " + chr(0x2014) + " конечно можно"))
    assert problems("Да, конечно можно") == []


def test_money_must_come_from_knowledge():
    assert any("суммы" in p for p in problems("Это стоит 5 000 ₸"))
    assert any("суммы" in p for p in problems("Всего $20 в месяц"))
    assert problems("Это стоит 9990 тенге") == []        # цифры те же, записаны по-другому
    assert problems("Это стоит 9 990 ₸.") == []
    assert problems("Нас 5 человек в команде") == []     # число без денег не трогаем


def test_links_must_come_from_knowledge():
    assert any("ссылки" in p for p in problems("Загляни на https://evil.example.org/pay"))
    assert any("ссылки" in p for p in problems("Сайт: pay-site.ru/pay"))
    assert problems("Запись: https://example.com/book") == []
    assert problems("Запись: example.com/book") == []                  # без https тоже тот же адрес
    assert problems("Запись: https://www.example.com/book/") == []
    assert problems("Подборка: https://example.com/mcp?utm=zz") == []  # метки не делают адрес чужим
    assert problems("Главная: https://example.com") == []               # главная разрешённого сайта


def test_email_is_not_mistaken_for_a_link():
    assert problems("Пиши на ivan@mail.ru") == []


def test_promises_and_slop():
    assert any("обещание" in p for p in problems("Гарантирую результат за неделю"))
    assert any("обещание" in p for p in problems("Результат 100% точно"))
    assert any("штампы" in p for p in problems("Не стесняйтесь спрашивать"))


def test_tidy_removes_markdown():
    assert checks.tidy("**Привет!**\n\n\n\n## Услуги\nТекст") == "Привет!\n\nУслуги\nТекст"
    assert checks.tidy("«Готово»") == "Готово"


def test_defaults_match_the_config_file():
    """assistant.toml и значения по умолчанию не должны расходиться."""
    import tomllib
    from pathlib import Path

    file = tomllib.loads((Path(__file__).resolve().parent.parent / "config" / "assistant.toml").read_text(encoding="utf-8"))
    assert file == DEFAULTS


# ── переписывание и заготовка в живом потоке ────────────────────────

async def reply_to(ctx, net, monkeypatch, text="Сколько стоит консультация?"):
    await handlers.handle_event(ctx, message_event(text, message_id=f"x{len(net.model_requests)}"))
    advance(monkeypatch, seconds=30)
    await handlers.process_due(ctx)


async def test_bad_answer_is_rewritten_once(ctx, net, monkeypatch):
    net.reply("Консультация стоит 5 000 ₸, гарантирую результат!")
    net.reply("Консультация стоит 9 990 ₸.")
    await reply_to(ctx, net, monkeypatch)
    assert len(net.model_requests) == 2
    assert net.sent_to("/messages")[0]["json"]["message"] == "Консультация стоит 9 990 ₸."
    note = net.model_requests[1]["messages"][0]["content"]
    assert "не прошёл проверку" in note and "суммы не из базы знаний" in note and "обещание результата" in note
    assert "Консультация стоит 5 000" in note, "модель видит свой прошлый ответ"
    assert "tools" not in net.model_requests[1], "при переписывании инструменты не нужны"


async def test_second_failure_sends_the_neutral_fallback(ctx, net, monkeypatch):
    net.reply("Стоит 5 000 ₸")
    net.reply("Стоит 7 000 ₸")
    await reply_to(ctx, net, monkeypatch)
    fallback = Config(ctx.settings).texts()["fallback"]["neutral"]
    assert net.sent_to("/messages")[0]["json"]["message"] == fallback
    assert len(net.model_requests) == 2


async def test_answer_with_long_dash_is_rewritten(ctx, net, monkeypatch):
    net.reply("Конечно " + chr(0x2014) + " приходите")
    net.reply("Конечно, приходите")
    await reply_to(ctx, net, monkeypatch, "можно прийти?")
    assert net.sent_to("/messages")[0]["json"]["message"] == "Конечно, приходите"


async def test_too_long_answer_is_rewritten(ctx, net, monkeypatch):
    net.reply("Очень длинный ответ. " * 30)
    net.reply("Коротко: да.")
    await reply_to(ctx, net, monkeypatch, "можно?")
    assert net.sent_to("/messages")[0]["json"]["message"] == "Коротко: да."


async def test_links_from_material_texts_are_allowed(ctx, net, monkeypatch):
    net.reply("Архив лежит тут: https://example.com/start.zip")
    await reply_to(ctx, net, monkeypatch, "где архив?")
    assert len(net.model_requests) == 1


async def test_markdown_is_cleaned_before_sending(ctx, net, monkeypatch):
    net.reply("**Да**, можно.")
    await reply_to(ctx, net, monkeypatch, "можно?")
    assert net.sent_to("/messages")[0]["json"]["message"] == "Да, можно."


def test_list_numbers_do_not_whitelist_small_prices():
    base = "Как запустить:\n1. Распакуй архив\n2. Открой папку\n3. Напиши сообщение\nЦена: 9 990 ₸ или $5 в месяц"
    assert checks.money_problems("Это стоит 2 ₸", base) != []
    assert checks.money_problems("Это стоит 5 $", base) == [], "сумма рядом с валютой в базе разрешена"
    assert checks.money_problems("Это стоит 9990 тенге", base) == []
