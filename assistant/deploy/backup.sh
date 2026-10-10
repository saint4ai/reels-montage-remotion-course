#!/usr/bin/env bash
# Копия базы ассистента (люди, диалоги, заявки) с сервера на этот компьютер.
# Использование: bash deploy/backup.sh <пользователь@адрес> [папка_для_копий] [--key путь] [--port 22]
# Копия лежит в assistant/backups/ (эта папка не попадает в репозиторий). Кладёшь её в надёжное место.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
parse_args "$@"

DEST="${EXTRA_ARGS[0]:-$ROOT/backups}"
mkdir -p "$DEST"

say "Делаю копию внутри сервера"
IN_CONTAINER="$(remote "cd $REMOTE_DIR && docker compose exec -T app python -m app.backup" | tr -d '\r' | tail -n 1)"
[ -n "$IN_CONTAINER" ] || die "сервер не вернул путь к копии"

LOCAL="$DEST/$(basename "$IN_CONTAINER")"
say "Скачиваю в $LOCAL"
remote "cd $REMOTE_DIR && docker compose exec -T app cat '$IN_CONTAINER'" > "$LOCAL"
[ -s "$LOCAL" ] || die "скачанный файл пустой"
chmod 600 "$LOCAL" 2>/dev/null || true
say "Готово: $LOCAL"
