"""Записывает значение в assistant/.env, не показывая его на экране и не вставляя в команду.

    python deploy/set_env.py ZERNIO_API_KEY --service zernio --delete
    python deploy/set_env.py TELEGRAM_BOT_TOKEN --from-file "C:/Users/Анна/Downloads/telegram-bot-key.txt" --delete
    python deploy/set_env.py ZERNIO_WEBHOOK_SECRET --generate
    python deploy/set_env.py TELEGRAM_LEAD_CHAT_ID --value -1001234567890

Откуда берётся значение (ровно одно из трёх):
    --service имя   файл Загрузки/<имя>-key.txt (ученик сохраняет ключ туда, в чат ключ не вставляется);
    --from-file     любой другой файл;
    --generate      длинная случайная строка (для секрета вебхука);
    --value         обычное значение, которое секретом не является (id чата, домен, имя модели).
С --delete файл с ключом удаляется после записи. На экран идёт только имя переменной и длина значения."""

from __future__ import annotations

import argparse
import os
import secrets
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


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
    source.add_argument("--service", help="короткое имя сервиса: читает Загрузки/<имя>-key.txt")
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
                out(f"ОШИБКА: нет файла {file_path}. Ученик сохраняет ключ в Загрузки/<сервис>-key.txt")
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
