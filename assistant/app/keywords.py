"""Кодовые слова: поиск в комментарии и в коротком сообщении директа.

Что ловим:
    · слово в любой раскладке и регистре, кириллицу, похожую на латиницу (mcp и мср);
    · варианты написания из `variants`;
    · опечатку в одну букву, если слово в комментарии одно и подходит ровно одно кодовое слово.

Три режима сравнения (`match` в config/keywords.toml):
    word  слово отдельным токеном: «хочу папка» находит «папка», «папкаа» нет. По умолчанию.
    exact весь комментарий равен слову (для обычных русских слов: «сайт», «защита»).
    stem  вхождение: основа «папк» находит «папку» и «скинь папку».
"""

from __future__ import annotations

import re
import tomllib
from dataclasses import dataclass
from pathlib import Path

WORD, EXACT, STEM = "word", "exact", "stem"

# Кириллица, неотличимая от латиницы на вид. Приводим обе стороны сравнения к латинице.
HOMOGLYPHS = str.maketrans({
    "а": "a", "в": "b", "е": "e", "к": "k", "м": "m", "н": "h",
    "о": "o", "р": "p", "с": "c", "т": "t", "у": "y", "х": "x",
})

# В личке кодовым словом считается только короткое сообщение: длиннее уже разговор
MAX_WORDS_IN_DIRECT = 3
# Опечатки ловим от этой длины слова: на коротких слишком много случайных совпадений
TYPO_MIN_LEN = 5


@dataclass(frozen=True)
class Keyword:
    word: str
    message: str
    variants: tuple[str, ...] = ()
    match: str = WORD
    active: bool = True
    comments_only: bool = False
    title: str = ""

    @property
    def spellings(self) -> list[str]:
        return [self.word, *self.variants]


def normalize(text: str) -> str:
    return (text or "").lower().replace("ё", "е").translate(HOMOGLYPHS)


def load(path: Path) -> list[Keyword]:
    with Path(path).open("rb") as f:
        data = tomllib.load(f)
    result = []
    for item in data.get("keyword", []):
        result.append(Keyword(
            word=str(item["word"]).strip(),
            message=str(item.get("message") or "").strip(),
            variants=tuple(str(v) for v in item.get("variants") or []),
            match=str(item.get("match") or WORD).strip().lower(),
            active=item.get("active", True) is not False,
            comments_only=item.get("comments_only", False) is True,
            title=str(item.get("title") or item["word"]),
        ))
    return result


def _edge_trimmed(text: str) -> str:
    return re.sub(r"^[^\w]+|[^\w]+$", "", normalize(text).strip(), flags=re.UNICODE)


def _matches_spelling(text: str, spelling: str, mode: str) -> bool:
    needle = normalize(spelling).strip()
    if not needle:
        return False
    if mode == STEM:
        return needle in normalize(text)
    if mode == EXACT:
        return re.sub(r"\s+", " ", _edge_trimmed(text)) == needle
    # границы по «не буква и не цифра»: \b не отделит «10» от «100»
    return re.search(rf"(?<!\w){re.escape(needle)}(?!\w)", normalize(text), flags=re.UNICODE) is not None


def matches(text: str, kw: Keyword) -> bool:
    return any(_matches_spelling(text, s, kw.match) for s in kw.spellings)


def _distance(a: str, b: str) -> int:
    """Расстояние Дамерау-Левенштейна (замена, пропуск, вставка, перестановка соседних)."""
    if abs(len(a) - len(b)) > 1:
        return 2
    before_prev: list[int] = []
    prev = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        cur = [i] + [0] * len(b)
        for j in range(1, len(b) + 1):
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] != b[j - 1]))
            if i > 1 and j > 1 and a[i - 1] == b[j - 2] and a[i - 2] == b[j - 1]:
                cur[j] = min(cur[j], before_prev[j - 2] + 1)
        before_prev, prev = prev, cur
    return prev[-1]


def similar(text: str, keywords: list[Keyword]) -> Keyword | None:
    """Кодовое слово с одной опечаткой или None. Только одиночное слово и только одно подходящее."""
    clean = _edge_trimmed(text)
    if len(clean) < TYPO_MIN_LEN or not re.fullmatch(r"[^\W\d_]+", clean, flags=re.UNICODE):
        return None
    found: dict[str, Keyword] = {}
    for kw in keywords:
        if not kw.active:
            continue
        for spelling in kw.spellings:
            target = normalize(spelling).strip()
            if (len(target) >= TYPO_MIN_LEN and re.fullmatch(r"[^\W\d_]+", target, flags=re.UNICODE)
                    and target != clean and _distance(clean, target) <= 1):
                found[kw.word] = kw
                break
    return next(iter(found.values())) if len(found) == 1 else None


def find(text: str, keywords: list[Keyword], *, direct: bool = False) -> Keyword | None:
    """Первое подходящее слово сверху вниз по конфигу. Порядок в файле задаёт приоритет.

    direct=True: личная переписка. Слова «только под роликом» пропускаем, длинные фразы
    не считаем кодовым словом, опечатки не ищем (там отвечает ассистент и сам поймёт)."""
    words = re.findall(r"\w+", normalize(text), flags=re.UNICODE)
    if direct and not 0 < len(words) <= MAX_WORDS_IN_DIRECT:
        return None
    for kw in keywords:
        if not kw.active or (direct and kw.comments_only):
            continue
        if matches(text, kw):
            return kw
    if not direct:
        return similar(text, keywords)
    return None


def unfilled(keywords: list[Keyword]) -> list[str]:
    """Активные слова, где остались заглушки [[ЗАПОЛНИ: …]] или нет текста материала."""
    return [kw.word for kw in keywords if kw.active and (not kw.message or "[[ЗАПОЛНИ" in kw.message)]
