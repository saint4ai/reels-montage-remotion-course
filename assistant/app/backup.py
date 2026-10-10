"""Копия базы SQLite: `python -m app.backup [папка]`. Хранит 14 последних копий, старые удаляет."""

from __future__ import annotations

import sys
from pathlib import Path

from app import clock
from app.db import DB
from app.settings import Settings

KEEP = 14


def make_backup(db_path: str, target_dir: str | Path) -> Path:
    target_dir = Path(target_dir)
    stamp = clock.now().strftime("%Y%m%d-%H%M%S")
    target = target_dir / f"assistant-{stamp}.db"
    db = DB(db_path)
    try:
        db.backup_to(target)
    finally:
        db.close()
    for old in sorted(target_dir.glob("assistant-*.db"))[:-KEEP]:
        old.unlink()
    return target


def main() -> None:
    settings = Settings.from_env()
    folder = sys.argv[1] if len(sys.argv) > 1 else str(Path(settings.db_path).parent / "backups")
    print(make_backup(settings.db_path, folder))


if __name__ == "__main__":
    main()
