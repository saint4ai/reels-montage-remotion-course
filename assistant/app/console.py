"""Вывод в консоль всегда в UTF-8: на Windows по умолчанию кириллица в трубе превращается в мусор."""

import sys


def utf8() -> None:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass
