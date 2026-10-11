"""Записывает значение в assistant/.env, не показывая его на экране и не вставляя в команду.

Как кладётся ключ (решение владельца курса, 11.10.2026): ученик вставляет ключ прямо в чат, агент записывает строку ИМЯ=значение
в assistant/.env инструментом правки файла и отвечает «записал». Этот скрипт нужен для другого:

    python deploy/set_env.py ZERNIO_WEBHOOK_SECRET --generate           секрет, который придумывает агент (создаёт .env из .env.example, если его нет)
    python deploy/set_env.py TELEGRAM_LEAD_CHAT_ID --value -1001234567890   обычное значение, не секрет (id чата, домен, имя модели)

И для ключа, который уже лежит у ученика в файле (старый способ):

    python deploy/set_env.py ZERNIO_API_KEY --service zernio --delete
    python deploy/set_env.py TELEGRAM_BOT_TOKEN --from-file "D:/Ключи/telegram-bot-key.txt" --delete

Откуда берётся значение (ровно одно из четырёх):
    --generate      длинная случайная строка (для секрета вебхука);
    --value         обычное значение, которое секретом не является (id чата, домен, имя модели);
    --service имя   файл Загрузки/<имя>-key.txt (если «Загрузки» не в домашней папке, например перенесены в OneDrive, добавь --downloads <путь к папке>).
                    Имена файлов: zernio-key.txt, openai-key.txt, openrouter-key.txt, telegram-bot-key.txt, server-key.txt,
                    google-sheets-key.txt (адрес веб-приложения Таблицы), elevenlabs-key.txt, higgsfield-key.txt (если ключ нужен);
    --from-file     любой другой файл.
С --delete файл с ключом удаляется после записи. На экран идёт только имя переменной и длина значения."""

from __future__ import annotations

import argparse
import os
import secrets
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# Имена файлов с ключами в «Загрузках» для старого способа (--service): <сервис>-key.txt. Новый ученик вставляет ключ в чат, файл ему не нужен
KNOWN_SERVICES = ("zernio", "openai", "openrouter", "telegram-bot", "server", "google-sheets", "elevenlabs", "higgsfield")


def read_secret_file(path: Path) -> str:
    """Ключ из файла без перевода строки и невидимых знаков. Пустой или многострочный файл это ошибка."""
    text = path.read_text(encoding="utf-8-sig").strip()
    if not text:
        raise ValueError(f"файл {path.name} пустой")
    if "\n" in text or "\r" in text:
        raise ValueError(f"в файле {path.name} больше одной строки: оставь только ключ")
    return text


def set_variable(env_path: Path, name: str, value: str) -> None:
    """Меняет строку ИМЯ=… в .env или добавляет её. Остальные строки и комментарии не трогает."""
    if not env_path.exists():
        example = env_path.with_name(".env.example")
        env_path.write_text(example.read_text(encoding="utf-8") if example.exists() else "", encoding="utf-8")
    lines = env_path.read_text(encoding="utf-8").splitlines()
    new_line = f"{name}={value}"
    for i, line in enumerate(lines):
        if line.split("=", 1)[0].strip() == name and not line.lstrip().startswith("#"):
            lines[i] = new_line
            break
    else:
        lines.append(new_line)
    env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    try:
        os.chmod(env_path, 0o600)
    except OSError:
        pass


def main(argv: list[str] | None = None, out=print) -> int:
    parser = argparse.ArgumentParser(description="Записать значение в .env, не показывая его")
    parser.add_argument("name", help="имя переменной, например ZERNIO_API_KEY")
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--service", help="короткое имя сервиса: читает Загрузки/<имя>-key.txt (старый способ: ключ уже лежит в файле)")
    source.add_argument("--from-file", help="путь к файлу со значением")
    source.add_argument("--generate", action="store_true", help="случайная строка из 64 знаков")
    source.add_argument("--value", help="значение, которое не секрет")
    parser.add_argument("--delete", action="store_true", help="удалить файл после записи")
    parser.add_argument("--env", default=str(ROOT / ".env"))
    parser.add_argument("--downloads", default=str(Path.home() / "Downloads"), help="папка загрузок")
    args = parser.parse_args(argv)

    if not args.name.replace("_", "").isalnum() or not args.name.isupper():
        out("ОШИБКА: имя переменной вида ZERNIO_API_KEY")
        return 1
    file_path: Path | None = None
    try:
        if args.service:
            file_path = Path(args.downloads) / f"{args.service}-key.txt"
        elif args.from_file:
            file_path = Path(args.from_file)
        if file_path is not None:
            if not file_path.is_file():
                names = ", ".join(f"{name}-key.txt" for name in KNOWN_SERVICES)
                hint = "" if args.from_file else " Если папка «Загрузки» лежит не в домашней папке (например, перенесена в OneDrive), добавь --downloads <путь к ней>."
                out(f"ОШИБКА: нет файла {file_path}. Режим --service нужен, только если ключ уже лежит в Загрузки/<сервис>-key.txt (имена: {names}). Новый ключ ученик вставляет в чат, а ты записываешь его в .env инструментом правки файла.{hint}")
                return 1
            value = read_secret_file(file_path)
        elif args.generate:
            value = secrets.token_hex(32)
        else:
            value = args.value.strip()
            if not value:
                out("ОШИБКА: пустое значение")
                return 1
    except (ValueError, OSError) as e:
        out(f"ОШИБКА: {e}")
        return 1

    set_variable(Path(args.env), args.name, value)
    out(f"{args.name} записан в {Path(args.env).name} ({len(value)} знаков)")
    if args.delete and file_path is not None:
        try:
            file_path.unlink()
            out(f"файл {file_path.name} удалён")
        except OSError:
            out(f"ПРЕДУПРЕЖДЕНИЕ: файл {file_path.name} не удалился, удали его вручную")
    return 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    raise SystemExit(main())
