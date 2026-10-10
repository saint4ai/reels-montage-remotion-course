#!/usr/bin/env bash
# Выкладка правок на уже работающий сервер: новые кодовые слова, промпт, база знаний, код. База остаётся.
# Использование: bash deploy/update.sh <пользователь@адрес> [--env путь/к/.env] [--key путь/к/ключу_ssh] [--port 22] [--with-env]
# Без --with-env файл .env на сервере не трогается. С ним: .env с компьютера заменит серверный (например, новый ключ).
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

WITH_ENV=0
ARGS=()
for a in "$@"; do
  if [ "$a" = "--with-env" ]; then WITH_ENV=1; else ARGS+=("$a"); fi
done
parse_args "${ARGS[@]}"

remote "test -f $REMOTE_DIR/docker-compose.yml" || die "на сервере нет $REMOTE_DIR: сначала deploy/install.sh"
[ -f "$ENV_FILE" ] || [ "$WITH_ENV" -eq 0 ] || die "нет файла $ENV_FILE"

DOMAIN_VALUE=""
if [ -f "$ENV_FILE" ]; then
  DOMAIN_VALUE="$(resolve_domain)"
else
  # домен берём с сервера: значение в .env на сервере, на экран не выводим ничего лишнего
  DOMAIN_VALUE="$(remote "grep -E '^DOMAIN=' $REMOTE_DIR/.env | tail -n 1 | cut -d= -f2-" | tr -d '\r')"
fi
[ -n "$DOMAIN_VALUE" ] || die "не удалось определить домен"

upload_code
if [ "$WITH_ENV" -eq 1 ]; then upload_env "$DOMAIN_VALUE"; fi
start_stack
wait_healthy "$DOMAIN_VALUE"
say "Обновлено"
