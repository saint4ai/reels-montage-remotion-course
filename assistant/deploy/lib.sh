#!/usr/bin/env bash
# Общие функции для install.sh, update.sh и backup.sh. Сам по себе не запускается.
# Нужны ssh, scp, tar и curl: в Git Bash на Windows, на macOS и в Linux они есть.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE_DIR="/opt/assistant"

# Команды можно подменить переменными окружения (так скрипты проверяются тестами без настоящего сервера)
SSH_BIN="${ASSISTANT_SSH:-ssh}"
SCP_BIN="${ASSISTANT_SCP:-scp}"
CURL_BIN="${ASSISTANT_CURL:-curl}"

HOST=""
ENV_FILE="$ROOT/.env"
SSH_PORT="22"
SSH_KEY=""
EXTRA_ARGS=()

die() { echo "ОШИБКА: $*" >&2; exit 1; }
say() { echo "== $*"; }

parse_args() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --env)  ENV_FILE="$2"; shift 2 ;;
      --key)  SSH_KEY="$2"; shift 2 ;;
      --port) SSH_PORT="$2"; shift 2 ;;
      -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
      -*) die "неизвестный параметр $1" ;;
      *)  if [ -z "$HOST" ]; then HOST="$1"; else EXTRA_ARGS+=("$1"); fi; shift ;;
    esac
  done
  [ -n "$HOST" ] || die "укажи сервер: пользователь@адрес (например root@203.0.113.10)"
  SSH_OPTS=(-p "$SSH_PORT" -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30 -o BatchMode=yes)
  SCP_OPTS=(-P "$SSH_PORT" -o StrictHostKeyChecking=accept-new -o BatchMode=yes)
  if [ -n "$SSH_KEY" ]; then
    SSH_OPTS+=(-i "$SSH_KEY"); SCP_OPTS+=(-i "$SSH_KEY")
  fi
}

remote() { "$SSH_BIN" "${SSH_OPTS[@]}" "$HOST" "$@"; }

# Значение переменной из .env без вывода на экран. Пусто, если переменной нет или она пустая
env_value() {
  local file="$1" name="$2"
  grep -E "^${name}=" "$file" 2>/dev/null | tail -n 1 | cut -d= -f2- | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//'
}

# Домен: из .env, а если там пусто, из IP сервера (адрес.sslip.io). Свой домен: DOMAIN в .env
resolve_domain() {
  local domain
  domain="$(env_value "$ENV_FILE" DOMAIN)"
  if [ -z "$domain" ]; then
    local addr="${HOST#*@}"
    if [[ "$addr" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      # 203.0.113.10 превращается в 203-0-113-10.sslip.io (один уровень имени, как в docs/guides/server-vps.md)
      domain="${addr//./-}.sslip.io"
    else
      die "в $ENV_FILE не задан DOMAIN, а адрес сервера не IP: впиши DOMAIN"
    fi
  fi
  echo "$domain"
}

upload_code() {
  say "Загружаю файлы в $REMOTE_DIR"
  remote "mkdir -p $REMOTE_DIR && cd $REMOTE_DIR && rm -rf app config prompts knowledge"
  (cd "$ROOT" && COPYFILE_DISABLE=1 tar czf - \
      --exclude='__pycache__' --exclude='*.pyc' \
      app config prompts knowledge Dockerfile docker-compose.yml Caddyfile requirements.txt .dockerignore) \
    | remote "tar xzf - -C $REMOTE_DIR"
}

# Отправляет .env на сервер (с DOMAIN, если в локальном его нет). Значения на экран не выводятся
upload_env() {
  local domain="$1" tmp
  tmp="$(mktemp)"
  chmod 600 "$tmp"
  cp "$ENV_FILE" "$tmp"
  if [ -z "$(env_value "$ENV_FILE" DOMAIN)" ]; then
    printf '\nDOMAIN=%s\n' "$domain" >> "$tmp"
  fi
  "$SCP_BIN" "${SCP_OPTS[@]}" -q "$tmp" "$HOST:$REMOTE_DIR/.env"
  rm -f "$tmp"
  remote "chmod 600 $REMOTE_DIR/.env"
}

start_stack() {
  say "Собираю и запускаю (первый раз это несколько минут)"
  remote "cd $REMOTE_DIR && docker compose up -d --build"
}

wait_healthy() {
  local domain="$1" i status
  say "Жду, пока ассистент ответит на проверку здоровья"
  for i in $(seq 1 30); do
    status="$(remote "cd $REMOTE_DIR && docker inspect --format '{{.State.Health.Status}}' \$(docker compose ps -q app)" 2>/dev/null || true)"
    [ "$status" = "healthy" ] && break
    sleep 5
  done
  if [ "$status" != "healthy" ]; then
    remote "cd $REMOTE_DIR && docker compose logs --tail 40 app" || true
    die "служба app не стала здоровой (статус: ${status:-неизвестен})"
  fi
  echo "app: здорова"
  say "Проверяю адрес снаружи: https://$domain/health (сертификат выпускается до минуты)"
  for i in $(seq 1 24); do
    if "$CURL_BIN" -fsS -m 10 "https://$domain/health" 2>/dev/null | grep -q '"status"'; then
      echo "снаружи отвечает: https://$domain/health"
      return 0
    fi
    sleep 5
  done
  remote "cd $REMOTE_DIR && docker compose logs --tail 40 caddy" || true
  die "https://$domain/health не отвечает: проверь, что порты 80 и 443 открыты и DOMAIN указывает на сервер"
}
