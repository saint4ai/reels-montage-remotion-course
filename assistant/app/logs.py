"""Логи без секретов и без текстов людей.

Тексты сообщений код в журнал не пишет совсем: только идентификаторы и длину.
Маска ниже страхует на случай, если ключ попадёт в чужое сообщение об ошибке."""

import logging


class SecretFilter(logging.Filter):
    def __init__(self, secrets: list[str]):
        super().__init__()
        self.secrets = secrets

    def filter(self, record: logging.LogRecord) -> bool:
        if not self.secrets:
            return True
        text = record.getMessage()
        if any(s in text for s in self.secrets):
            for s in self.secrets:
                text = text.replace(s, "***")
            record.msg, record.args = text, None
        return True


def setup(secrets: list[str], level: str = "INFO") -> None:
    logging.basicConfig(level=getattr(logging, level, logging.INFO),
                        format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    for handler in logging.getLogger().handlers:
        for old in [f for f in handler.filters if isinstance(f, SecretFilter)]:
            handler.removeFilter(old)
        handler.addFilter(SecretFilter(secrets))
    # ⚠️ httpx на уровне INFO печатает полный адрес запроса, а в адресе Bot API лежит токен бота
    for noisy in ("httpx", "httpcore", "uvicorn.access"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
