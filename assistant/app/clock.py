"""Время в одном месте: тесты подменяют now(), остальной код не трогает часы напрямую."""

from datetime import datetime, timedelta, timezone

FMT = "%Y-%m-%dT%H:%M:%S.%f"


def now() -> datetime:
    return datetime.now(timezone.utc)


def iso(moment: datetime | None = None) -> str:
    """UTC-строка фиксированной длины: такие строки в SQLite сравниваются как время."""
    return (moment or now()).astimezone(timezone.utc).strftime(FMT)


def parse(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.strptime(value, FMT).replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def plus(seconds: float = 0, *, minutes: float = 0, hours: float = 0) -> str:
    return iso(now() + timedelta(seconds=seconds, minutes=minutes, hours=hours))


def today() -> str:
    return now().strftime("%Y-%m-%d")
