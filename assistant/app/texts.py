"""Тексты ответов людям: выбор вариантов вразнобой и отметка @ника.

Instagram режет страницы, которые одинаково отвечают на сотни комментариев,
поэтому вариантов в config/texts.toml много, а подряд один и тот же не выдаётся."""

from __future__ import annotations

import random
import re

_last: dict[str, str] = {}
_NICK = re.compile(r"^[A-Za-z0-9._]{1,30}$")


def pick_varied(templates: list[str], key: str = "default") -> str:
    """Случайный вариант, но не тот же, что в прошлый раз."""
    if not templates:
        raise ValueError("нет ни одного варианта текста")
    if len(templates) == 1:
        return templates[0]
    choices = [t for t in templates if t != _last.get(key)]
    picked = random.choice(choices)
    _last[key] = picked
    return picked


def with_mention(username: str | None, text: str) -> str:
    """Публичный ответ начинается с @ника: человеку приходит уведомление, что ему ответили."""
    nick = (username or "").strip().lstrip("@")
    if not _NICK.match(nick) or text.lstrip().startswith("@"):
        return text
    return f"@{nick} {text}"
