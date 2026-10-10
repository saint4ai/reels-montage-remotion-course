"""Скрипты deploy/: проверяем логику без настоящего сервера. ssh, scp и curl подменены заглушками."""

import os
import shutil
import subprocess
import tarfile
from pathlib import Path

import httpx
import pytest

from tests.conftest import OPENAI_KEY, ROOT, TG_TOKEN, WEBHOOK_SECRET, ZERNIO, ZERNIO_KEY

DEPLOY = ROOT / "deploy"


def find_bash():
    """Нужен настоящий bash (Git Bash на Windows). Системный bash.exe из WSL не годится."""
    candidates = [r"C:\Program Files\Git\bin\bash.exe", r"C:\Program Files\Git\usr\bin\bash.exe",
                  shutil.which("bash") or ""]
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            try:
                done = subprocess.run([candidate, "-c", "echo $BASH_VERSION"], capture_output=True, text=True, timeout=20)
            except (OSError, subprocess.SubprocessError):
                continue
            if done.returncode == 0 and done.stdout.strip():
                return candidate
    return None


BASH = find_bash()
pytestmark = pytest.mark.skipif(BASH is None, reason="нет bash")


def posix(path: Path) -> str:
    return path.as_posix()


def msys(path: Path) -> str:
    """Путь для Git Bash: C:/Users/x становится /c/Users/x. На Linux и macOS путь не меняется."""
    text = path.as_posix()
    if len(text) > 2 and text[1] == ":":
        return f"/{text[0].lower()}{text[2:]}"
    return text


STUB_SSH = r"""#!/usr/bin/env bash
echo "ssh $*" >> "$STUB_LOG/calls.txt"
if [[ "$*" == *"bash -s"* ]]; then cat > "$STUB_LOG/remote-prep.sh"; exit 0; fi
if [[ "$*" == *"tar xzf"* ]]; then cat > "$STUB_LOG/upload.tgz"; exit 0; fi
if [[ "$*" == *"docker inspect"* ]]; then echo healthy; exit 0; fi
if [[ "$*" == *"app.backup"* ]]; then echo "/data/backups/assistant-20261010-100000.db"; exit 0; fi
if [[ "$*" == *"exec -T app cat"* ]]; then printf 'DBDATA'; exit 0; fi
if [[ "$*" == *"grep -E '^DOMAIN='"* ]]; then echo "server.sslip.io"; exit 0; fi
exit 0
"""
STUB_SCP = r"""#!/usr/bin/env bash
echo "scp $*" >> "$STUB_LOG/calls.txt"
cp "${@: -2:1}" "$STUB_LOG/uploaded.env"
"""
STUB_CURL = r"""#!/usr/bin/env bash
echo "curl $*" >> "$STUB_LOG/calls.txt"
echo '{"status": "ok"}'
"""


@pytest.fixture
def stubs(tmp_path):
    bin_dir = tmp_path / "bin"
    log_dir = tmp_path / "log"
    bin_dir.mkdir()
    log_dir.mkdir()
    for name, body in (("ssh", STUB_SSH), ("scp", STUB_SCP), ("curl", STUB_CURL)):
        path = bin_dir / name
        path.write_text(body, encoding="utf-8", newline="\n")
        path.chmod(0o755)
    # настоящий ssh в тестах не запускается никогда: команды подменены переменными ASSISTANT_*
    env = dict(os.environ, STUB_LOG=msys(log_dir), ASSISTANT_SSH=msys(bin_dir / "ssh"),
               ASSISTANT_SCP=msys(bin_dir / "scp"), ASSISTANT_CURL=msys(bin_dir / "curl"))
    return env, log_dir


def run(script, args, env, cwd=None):
    return subprocess.run([BASH, posix(DEPLOY / script), *args], env=env, capture_output=True, text=True,
                          encoding="utf-8", timeout=120, cwd=cwd)


def write_env(path, **override):
    values = {"ZERNIO_API_KEY": ZERNIO_KEY, "ZERNIO_WEBHOOK_SECRET": WEBHOOK_SECRET, "OPENAI_API_KEY": OPENAI_KEY,
              "OPENAI_MODEL": "test-model", "TELEGRAM_BOT_TOKEN": TG_TOKEN, "TELEGRAM_LEAD_CHAT_ID": "-100500"}
    values.update(override)
    path.write_text("\n".join(f"{k}={v}" for k, v in values.items() if v is not None) + "\n", encoding="utf-8")
    return path


def calls(log_dir):
    file = log_dir / "calls.txt"
    return file.read_text(encoding="utf-8") if file.exists() else ""


def test_all_scripts_have_valid_syntax():
    for script in ("lib.sh", "install.sh", "update.sh", "backup.sh"):
        done = subprocess.run([BASH, "-n", posix(DEPLOY / script)], capture_output=True, text=True)
        assert done.returncode == 0, (script, done.stderr)


def test_install_needs_a_server_argument(stubs):
    env, log_dir = stubs
    done = run("install.sh", [], env)
    assert done.returncode != 0 and "укажи сервер" in done.stderr and calls(log_dir) == ""


def test_install_refuses_incomplete_env_and_prints_no_values(stubs, tmp_path):
    env, log_dir = stubs
    env_file = write_env(tmp_path / ".env", OPENAI_API_KEY="", TELEGRAM_LEAD_CHAT_ID=None)
    done = run("install.sh", ["root@1.2.3.4", "--env", posix(env_file)], env)
    assert done.returncode != 0
    assert "OPENAI_API_KEY" in done.stderr and "TELEGRAM_LEAD_CHAT_ID" in done.stderr
    assert calls(log_dir) == "", "до проверки .env на сервер не ходим"
    for secret in (ZERNIO_KEY, WEBHOOK_SECRET, TG_TOKEN):
        assert secret not in done.stdout + done.stderr


def test_install_full_flow(stubs, tmp_path):
    env, log_dir = stubs
    env_file = write_env(tmp_path / ".env")
    original = env_file.read_text(encoding="utf-8")
    done = run("install.sh", ["root@1.2.3.4", "--env", posix(env_file), "--key", "/home/u/.ssh/id_assistant"], env)
    assert done.returncode == 0, done.stderr + done.stdout
    out = done.stdout
    assert "домен: 1-2-3-4.sslip.io" in out and "app: здорова" in out and "снаружи отвечает" in out
    assert "register_webhook.py" in out
    for secret in (ZERNIO_KEY, WEBHOOK_SECRET, TG_TOKEN, OPENAI_KEY):
        assert secret not in out + done.stderr, "значения ключей на экран не выводятся"
    log = calls(log_dir)
    assert "-i /home/u/.ssh/id_assistant" in log and "root@1.2.3.4" in log and "BatchMode=yes" in log
    assert "docker compose up -d --build" in log
    assert "https://1-2-3-4.sslip.io/health" in log
    # подготовка сервера: Docker, папка, порты
    prep = (log_dir / "remote-prep.sh").read_text(encoding="utf-8")
    assert "docker-compose-v2" in prep and "/opt/assistant" in prep and "ufw allow 443/tcp" in prep
    # на сервер ушёл .env с добавленным доменом, а локальный файл не тронут
    uploaded = (log_dir / "uploaded.env").read_text(encoding="utf-8")
    assert "DOMAIN=1-2-3-4.sslip.io" in uploaded and f"ZERNIO_API_KEY={ZERNIO_KEY}" in uploaded
    assert env_file.read_text(encoding="utf-8") == original
    assert "chmod 600 /opt/assistant/.env" in log
    # архив с кодом: нужное внутри, секретов и мусора нет
    with tarfile.open(log_dir / "upload.tgz") as archive:
        names = archive.getnames()
    for must in ("app/main.py", "config/keywords.toml", "prompts/assistant.md", "knowledge/01-about.md",
                 "docker-compose.yml", "Caddyfile", "Dockerfile", "requirements.txt"):
        assert must in names, must
    assert not [n for n in names if n.startswith((".env", ".venv", "tests", "deploy")) or "__pycache__" in n]


def test_install_with_own_domain_does_not_touch_it(stubs, tmp_path):
    env, log_dir = stubs
    env_file = write_env(tmp_path / ".env", DOMAIN="bot.example.org")
    done = run("install.sh", ["deploy@bot.example.org", "--env", posix(env_file)], env)
    assert done.returncode == 0, done.stderr
    assert (log_dir / "uploaded.env").read_text(encoding="utf-8").count("DOMAIN=") == 1
    assert "https://bot.example.org/health" in calls(log_dir)


def test_install_wants_domain_when_host_is_not_an_ip(stubs, tmp_path):
    env, log_dir = stubs
    env_file = write_env(tmp_path / ".env")
    done = run("install.sh", ["root@myserver.example", "--env", posix(env_file)], env)
    assert done.returncode != 0 and "DOMAIN" in done.stderr
    assert "docker compose" not in calls(log_dir)


def test_update_pushes_code_only_by_default(stubs, tmp_path):
    env, log_dir = stubs
    env_file = write_env(tmp_path / ".env")
    done = run("update.sh", ["root@1.2.3.4", "--env", posix(env_file)], env)
    assert done.returncode == 0, done.stderr
    log = calls(log_dir)
    assert "tar xzf" in log and "docker compose up -d --build" in log
    assert "scp" not in log, ".env на сервере без --with-env не меняется"
    with_env = run("update.sh", ["root@1.2.3.4", "--env", posix(env_file), "--with-env"], env)
    assert with_env.returncode == 0 and "scp" in calls(log_dir)


def test_update_reads_domain_from_server_when_no_local_env(stubs, tmp_path):
    env, log_dir = stubs
    done = run("update.sh", ["root@1.2.3.4", "--env", posix(tmp_path / "нет.env")], env)
    assert done.returncode == 0, done.stderr + done.stdout
    assert "https://server.sslip.io/health" in calls(log_dir)


def test_backup_downloads_the_copy(stubs, tmp_path):
    env, log_dir = stubs
    done = run("backup.sh", ["root@1.2.3.4", str(tmp_path / "out").replace("\\", "/")], env)
    assert done.returncode == 0, done.stderr + done.stdout
    saved = tmp_path / "out" / "assistant-20261010-100000.db"
    assert saved.read_bytes() == b"DBDATA"


def test_register_webhook_script(tmp_path):
    """deploy/register_webhook.py: создаёт вебхук по домену из .env и не печатает секрет."""
    import asyncio
    import importlib.util
    import json

    import respx

    spec = importlib.util.spec_from_file_location("register_webhook", DEPLOY / "register_webhook.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    env_file = write_env(tmp_path / ".env", DOMAIN="a.test")
    lines = []
    with respx.mock as router:
        existing = httpx.Response(200, json={"webhooks": [{"_id": "w1", "url": "https://a.test/webhooks/zernio"}]})
        # список вебхуков: пусто при создании, потом вебхук уже есть (для теста и для второго запуска)
        router.get("https://zernio.com/api/v1/webhooks/settings").mock(
            side_effect=[httpx.Response(200, json={"webhooks": []}), existing, existing])
        create = router.post("https://zernio.com/api/v1/webhooks/settings").mock(
            return_value=httpx.Response(200, json={"success": True}))
        router.post("https://zernio.com/api/v1/webhooks/test").mock(return_value=httpx.Response(200, json={"success": True}))
        code = asyncio.run(module.run(env_file, "", True, out=lines.append))
        update = router.put("https://zernio.com/api/v1/webhooks/settings").mock(
            return_value=httpx.Response(200, json={"success": True}))
        asyncio.run(module.run(env_file, "", False, out=lines.append))
    assert code == 0 and create.call_count == 1 and update.call_count == 1
    assert json.loads(create.calls[0].request.content)["url"] == "https://a.test/webhooks/zernio"
    assert json.loads(update.calls[0].request.content)["webhookId"] == "w1"
    assert any("создан" in line for line in lines) and any("обновлён" in line for line in lines)
    assert all(WEBHOOK_SECRET not in line and ZERNIO_KEY not in line for line in lines)


def test_register_webhook_needs_domain_and_keys(tmp_path):
    import asyncio
    import importlib.util

    spec = importlib.util.spec_from_file_location("register_webhook2", DEPLOY / "register_webhook.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    lines = []
    assert asyncio.run(module.run(write_env(tmp_path / "a.env"), "", False, out=lines.append)) == 1
    assert "DOMAIN" in lines[-1]
    assert asyncio.run(module.run(write_env(tmp_path / "b.env", ZERNIO_API_KEY=""), "x.test", False, out=lines.append)) == 1
