#!/usr/bin/env bash
# Установка ассистента на чистый Ubuntu 24.04 по SSH. Повторный запуск безопасен: файлы обновляются, база остаётся.
# Использование: bash deploy/install.sh <пользователь@адрес> [--env путь/к/.env] [--key путь/к/ключу_ssh] [--port 22]
# Нужен вход без пароля по SSH-ключу и root (или пользователь с sudo без пароля).
# Что делает: ставит Docker, создаёт /opt/assistant, загружает файлы и .env, запускает, проверяет здоровье.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
parse_args "$@"

[ -f "$ENV_FILE" ] || die "нет файла $ENV_FILE: скопируй .env.example в .env и заполни"

# Обязательные переменные: проверяем, что заданы, значения не печатаем
missing=()
for name in ZERNIO_API_KEY ZERNIO_WEBHOOK_SECRET OPENAI_API_KEY OPENAI_MODEL TELEGRAM_BOT_TOKEN TELEGRAM_LEAD_CHAT_ID; do
  [ -n "$(env_value "$ENV_FILE" "$name")" ] || missing+=("$name")
done
[ ${#missing[@]} -eq 0 ] || die "в $ENV_FILE не заполнено: ${missing[*]}"

DOMAIN_VALUE="$(resolve_domain)"
say "Сервер: $HOST, домен: $DOMAIN_VALUE"

say "Готовлю сервер (Docker, папка, порты)"
remote 'bash -s' <<'REMOTE'
set -euo pipefail
if [ "$(id -u)" -ne 0 ]; then SUDO=sudo; else SUDO=""; fi
if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  $SUDO apt-get update -y
  $SUDO apt-get install -y docker.io docker-compose-v2 curl ca-certificates
  $SUDO systemctl enable --now docker
fi
$SUDO mkdir -p /opt/assistant
$SUDO chown "$(id -un)" /opt/assistant
if command -v ufw >/dev/null 2>&1 && $SUDO ufw status | grep -q "Status: active"; then
  $SUDO ufw allow 22/tcp >/dev/null
  $SUDO ufw allow 80/tcp >/dev/null
  $SUDO ufw allow 443/tcp >/dev/null
fi
docker compose version
REMOTE

upload_code
upload_env "$DOMAIN_VALUE"
start_stack
wait_healthy "$DOMAIN_VALUE"

say "Готово. Дальше: python deploy/register_webhook.py --env $ENV_FILE --domain $DOMAIN_VALUE --test"
