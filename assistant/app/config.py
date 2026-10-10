"""Конфиги, промпт и база знаний. Файлы перечитываются, когда меняется время их правки,
поэтому новое кодовое слово или правка промпта работают без перезапуска."""

from __future__ import annotations

import copy
import tomllib
from pathlib import Path

from app import keywords as kw_mod
from app.settings import Settings

# Значения по умолчанию: ученик правит только то, что хочет изменить, в config/assistant.toml
DEFAULTS: dict = {
    "assistant": {
        "enabled": True,          # общий выключатель ответов в директе; материал по слову уходит всегда
        "max_chars": 350,         # длина одного ответа
        "history_messages": 20,   # сколько последних сообщений диалога видит модель
        "buffer_seconds": 2,      # несколько сообщений подряд склеиваются в один ответ
        "buffer_max_seconds": 20, # дольше этого с первого сообщения не ждём
        "max_output_tokens": 1200,
        "reasoning_effort": "none", # gpt-6-luna с вызовом функций в Chat Completions требует none
    },
    "channels": {
        "comments": ["instagram"],                       # где ловим кодовые слова под постами
        "direct": ["instagram", "whatsapp", "telegram"], # где отвечает ассистент
    },
    "limits": {
        "per_person_per_day": 30,   # ответов ассистента одному человеку в сутки
        "global_per_day": 500,      # потолок ответов в сутки на всех
        "material_per_person_per_day": 5,  # выдач материала в личке одному человеку в сутки
    },
    "lead": {"pause_hours": 12},
    "owner": {"reply_pause_minutes": 60, "echo_wait_seconds": 3},
    "reminder": {
        "enabled": True,
        "after_hours": 4,      # через сколько молчания напомнить
        "window_hours": 22,    # окно Meta 24 часа, берём с запасом
        "quiet_from": 22,      # ночью не пишем (по местному времени ниже)
        "quiet_to": 9,
        "tz_offset_hours": 5,
    },
    "voice": {"enabled": True, "model": "gpt-4o-mini-transcribe", "max_mb": 20},
    "vision": {"enabled": True, "model": "", "max_mb": 10},  # пусто: та же модель, что для ответов
    "checks": {
        "promises": [
            "гарантирую", "гарантируем", "гарантия", "гарантированно", "100%", "сто процентов",
            "точно получится", "точно получишь", "точно получите", "обязательно заработ",
            "вернём деньги", "верну деньги", "без риска", "быстро разбогат",
        ],
        "slop": [
            "не стесняйтесь", "не стесняйся", "надеюсь, это поможет", "буду рад помочь",
            "в современном мире", "уникальн", "инновацион", "революцион",
        ],
    },
    "intent": {
        "service": [
            "сколько стоит", "цена", "цены", "стоимость", "прайс", "тариф", "услуг", "заказать", "заказ ",
            "под ключ", "сделайте", "сделаешь", "сделаете", "записаться", "запись", "консультац",
            "разработ", "купить", "оплат", "хочу работать", "ваши условия",
        ],
        "material": [
            "не получается", "не работает", "не открывается", "ссылка", "ссылку", "как установить",
            "как запустить", "установ", "не пришло", "не пришёл", "где материал", "не могу скачать",
            "скачать", "ошибка", "не пошло", "застрял",
        ],
    },
}


def _merge(base: dict, extra: dict) -> dict:
    result = copy.deepcopy(base)
    for key, value in extra.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = _merge(result[key], value)
        else:
            result[key] = value
    return result


class Config:
    def __init__(self, settings: Settings):
        self.s = settings
        self._cache: dict[str, tuple[float, object]] = {}

    def _cached(self, path: Path, loader):
        try:
            stamp = path.stat().st_mtime_ns
        except FileNotFoundError:
            stamp = -1
        key = str(path)
        hit = self._cache.get(key)
        if hit and hit[0] == stamp:
            return hit[1]
        value = loader(path) if stamp != -1 else None
        self._cache[key] = (stamp, value)
        return value

    def _toml(self, name: str) -> dict:
        def load(path: Path) -> dict:
            with path.open("rb") as f:
                return tomllib.load(f)
        return self._cached(self.s.config_dir / name, load) or {}

    # ── файлы config/ ────────────────────────────────────────────
    def assistant(self) -> dict:
        return _merge(DEFAULTS, self._toml("assistant.toml"))

    def texts(self) -> dict:
        return self._toml("texts.toml")

    def keywords(self) -> list[kw_mod.Keyword]:
        return self._cached(self.s.config_dir / "keywords.toml", kw_mod.load) or []

    # ── промпт и база знаний ─────────────────────────────────────
    def prompt(self) -> str:
        return self._cached(self.s.prompts_dir / "assistant.md", lambda p: p.read_text(encoding="utf-8")) or ""

    def knowledge(self) -> str:
        """Все knowledge/*.md одним текстом. Папка перечитывается по самому свежему файлу."""
        files = sorted(self.s.knowledge_dir.glob("*.md")) if self.s.knowledge_dir.is_dir() else []
        stamp = max((f.stat().st_mtime_ns for f in files), default=0) + len(files)
        hit = self._cache.get("knowledge")
        if hit and hit[0] == stamp:
            return hit[1]
        parts = [f"## Файл {f.name}\n{f.read_text(encoding='utf-8').strip()}" for f in files]
        text = "\n\n".join(parts)
        self._cache["knowledge"] = (stamp, text)
        return text

    def material_texts(self) -> str:
        """Тексты материалов активных кодовых слов: ассистент должен знать, что человек получил."""
        return "\n\n".join(f"Слово «{k.word}»:\n{k.message}" for k in self.keywords() if k.active and k.message)

    def allowed_text(self) -> str:
        """Всё, из чего можно брать суммы и ссылки в ответе."""
        return "\n\n".join(x for x in (self.knowledge(), self.material_texts()) if x)
