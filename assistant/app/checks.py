"""Проверки ответа кодом, а не просьбой к модели. Ответ уходит человеку только после них.

Что проверяем:
    · длина (по умолчанию не больше 350 знаков);
    · длинное тире (в текстах людям его нет);
    · суммы денег и ссылки: только те, что есть в базе знаний и в материалах по словам;
    · обещания результата («гарантирую», «100%») и штампы ИИ из config/assistant.toml.

Не прошёл: ответ переписывается один раз с перечнем проблем, второй промах это нейтральная заготовка."""

from __future__ import annotations

import re

LONG_DASH = chr(0x2014)  # длинное тире; символом в файле не пишем, чтобы поиск по тексту его не находил

URL = re.compile(r"https?://[^\s<>\"'«»]+", re.IGNORECASE)
# Адрес без https: «site.ru/price». Почту не трогаем (перед доменом нет @)
BARE_URL = re.compile(
    r"(?<![\w@/.-])(?:[a-z0-9-]+\.)+(?:com|ru|kz|io|ai|so|co|app|dev|org|net|me|academy|shop|site|online|xyz|info|uz|kg|by)"
    r"(?:/[^\s<>\"'«»]*)?", re.IGNORECASE)
NUMBER = re.compile(r"\d{1,3}(?:[   ]\d{3})+|\d+(?:[.,]\d+)?")
MONEY = re.compile(
    r"\d[\d\s  .,]*\s*(?:₸|тг\b|тенге|руб|₽|\$|usd|долл|евро|€|сом\b|грн\b|тыс|млн)|(?:₸|\$|€|₽)\s?\d",
    re.IGNORECASE)
_MARKDOWN_BOLD = re.compile(r"(\*\*|__)(.+?)\1", re.S)
_MARKDOWN_HEAD = re.compile(r"^[ \t]{0,3}#{1,6}[ \t]*", re.M)


def digits(text: str) -> str:
    return re.sub(r"\D", "", text or "")


def url_key(url: str) -> str:
    """claude.ai/download и https://claude.ai/download это один адрес."""
    u = re.sub(r"^https?://", "", url.strip(), flags=re.IGNORECASE)
    u = re.sub(r"^www\.", "", u, flags=re.IGNORECASE)
    return u.rstrip(".,;:!?)»").rstrip("/").lower()


def _urls_in(text: str) -> list[str]:
    explicit = URL.findall(text or "")
    bare = BARE_URL.findall(URL.sub(" ", text or ""))
    return explicit + bare


def tidy(answer: str) -> str:
    """Убирает разметку Markdown: в мессенджерах звёздочки и решётки видны как есть."""
    text = _MARKDOWN_BOLD.sub(r"\2", answer or "")
    text = _MARKDOWN_HEAD.sub("", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip().strip("\"«»").strip()


def link_problems(answer: str, allowed: str) -> list[str]:
    """Ссылки из ответа, которых нет в базе знаний. Главная страница уже разрешённого сайта законна."""
    known = {url_key(u) for u in _urls_in(allowed)}
    known |= {url_key(re.split(r"[?#]", u, maxsplit=1)[0]) for u in _urls_in(allowed)}
    domains = {u.split("/")[0] for u in known}
    bad = []
    for url in _urls_in(answer):
        key = url_key(url)
        base = url_key(re.split(r"[?#]", url, maxsplit=1)[0])
        if key in known or base in known or ("/" not in key and key in domains):
            continue
        bad.append(url)
    return bad


def _amount(text: str) -> str:
    """Цифры первого числа в куске текста: «9 990 ₸» даёт 9990."""
    number = NUMBER.search(text)
    return digits(number.group(0)) if number else ""


def money_problems(answer: str, allowed: str) -> list[str]:
    """Суммы денег из ответа, которых нет в базе знаний (сравниваем по цифрам).

    Разрешёнными считаем числа от трёх цифр из базы (цены, номера) и любые числа рядом с валютой.
    Номера пунктов списка «1.», «2.» суммой не считаются, иначе «2 ₸» прошло бы проверку."""
    base = URL.sub(" ", allowed or "")
    known = {digits(m.group(0)) for m in NUMBER.finditer(base) if len(digits(m.group(0))) >= 3}
    known |= {_amount(base[m.start():m.end() + 12]) for m in MONEY.finditer(base)}
    plain = URL.sub(" ", answer or "")
    bad = []
    for m in MONEY.finditer(plain):
        if _amount(plain[m.start():m.end() + 12]) not in known:
            bad.append(m.group(0).strip())
    return bad


def check_answer(answer: str, *, allowed: str, max_chars: int = 350, promises: list[str] | None = None,
                 slop: list[str] | None = None) -> list[str]:
    """Список проблем. Пустой список: ответ можно отправлять."""
    problems: list[str] = []
    if not (answer or "").strip():
        return ["пустой ответ"]
    if len(answer) > max_chars:
        problems.append(f"слишком длинно: {len(answer)} знаков, нужно не больше {max_chars}")
    if LONG_DASH in answer:
        problems.append("длинное тире: замени запятой, точкой или двоеточием")
    links = link_problems(answer, allowed)
    if links:
        problems.append("ссылки не из базы знаний: " + ", ".join(links[:3]))
    money = money_problems(answer, allowed)
    if money:
        problems.append("суммы не из базы знаний: " + ", ".join(money[:3]))
    low = answer.lower()
    found = [p for p in promises or [] if p.lower() in low]
    if found:
        problems.append("обещание результата: " + ", ".join(found[:3]))
    stamps = [s for s in slop or [] if s.lower() in low]
    if stamps:
        problems.append("штампы: " + ", ".join(stamps[:3]))
    return problems
