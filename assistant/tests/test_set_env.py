"""deploy/set_env.py: ключи попадают в .env, но не на экран и не в команду."""

import importlib.util

import pytest

from tests.conftest import ROOT

spec = importlib.util.spec_from_file_location("set_env", ROOT / "deploy" / "set_env.py")
set_env = importlib.util.module_from_spec(spec)
spec.loader.exec_module(set_env)

KEY = "zernio-secret-key-value-1234567890"


def run(args, tmp_path):
    out = []
    code = set_env.main([*args, "--env", str(tmp_path / ".env"), "--downloads", str(tmp_path / "Downloads")], out=out.append)
    return code, "\n".join(out)


@pytest.fixture
def downloads(tmp_path):
    folder = tmp_path / "Downloads"
    folder.mkdir()
    return folder


def test_key_goes_from_file_to_env_and_file_is_deleted(tmp_path, downloads):
    (tmp_path / ".env.example").write_text("# комментарий\nZERNIO_API_KEY=\nOPENAI_MODEL=\n", encoding="utf-8")
    (downloads / "zernio-key.txt").write_text("﻿" + KEY + "\r\n", encoding="utf-8")
    code, out = run(["ZERNIO_API_KEY", "--service", "zernio", "--delete"], tmp_path)
    assert code == 0
    assert KEY not in out and "ZERNIO_API_KEY записан" in out and f"({len(KEY)} знаков)" in out and "удалён" in out
    assert (tmp_path / ".env").read_text(encoding="utf-8") == f"# комментарий\nZERNIO_API_KEY={KEY}\nOPENAI_MODEL=\n"
    assert not (downloads / "zernio-key.txt").exists()


def test_existing_value_is_replaced_not_duplicated(tmp_path, downloads):
    (tmp_path / ".env").write_text("A=1\nZERNIO_API_KEY=старый\n# ZERNIO_API_KEY=комментарий\nB=2\n", encoding="utf-8")
    (downloads / "zernio-key.txt").write_text(KEY, encoding="utf-8")
    run(["ZERNIO_API_KEY", "--service", "zernio"], tmp_path)
    text = (tmp_path / ".env").read_text(encoding="utf-8")
    assert text == f"A=1\nZERNIO_API_KEY={KEY}\n# ZERNIO_API_KEY=комментарий\nB=2\n"
    assert (downloads / "zernio-key.txt").exists(), "без --delete файл остаётся"


def test_missing_empty_and_multiline_files(tmp_path, downloads):
    code, out = run(["OPENAI_API_KEY", "--service", "openai"], tmp_path)
    assert code == 1 and "нет файла" in out
    (downloads / "openai-key.txt").write_text("  \n", encoding="utf-8")
    assert run(["OPENAI_API_KEY", "--service", "openai"], tmp_path)[0] == 1
    (downloads / "openai-key.txt").write_text("первая\nвторая", encoding="utf-8")
    code, out = run(["OPENAI_API_KEY", "--service", "openai"], tmp_path)
    assert code == 1 and "больше одной строки" in out and "первая" not in out
    assert not (tmp_path / ".env").exists() or "OPENAI_API_KEY=первая" not in (tmp_path / ".env").read_text(encoding="utf-8")


def test_generate_makes_a_long_random_secret(tmp_path):
    code, out = run(["ZERNIO_WEBHOOK_SECRET", "--generate"], tmp_path)
    assert code == 0 and "(64 знаков)" in out
    value = (tmp_path / ".env").read_text(encoding="utf-8").strip().split("=", 1)[1]
    assert len(value) == 64 and value not in out
    run(["ZERNIO_WEBHOOK_SECRET", "--generate"], tmp_path)
    assert (tmp_path / ".env").read_text(encoding="utf-8").strip().split("=", 1)[1] != value


def test_plain_value_and_bad_names(tmp_path):
    assert run(["TELEGRAM_LEAD_CHAT_ID", "--value", "-1001234567890"], tmp_path)[0] == 0
    assert "TELEGRAM_LEAD_CHAT_ID=-1001234567890" in (tmp_path / ".env").read_text(encoding="utf-8")
    assert run(["telegram_lead", "--value", "1"], tmp_path)[0] == 1
    assert run(["BAD NAME", "--value", "1"], tmp_path)[0] == 1
    assert run(["DOMAIN", "--value", "  "], tmp_path)[0] == 1


def test_from_file_with_explicit_path(tmp_path):
    path = tmp_path / "любой.txt"
    path.write_text(KEY, encoding="utf-8")
    code, out = run(["OPENAI_API_KEY", "--from-file", str(path), "--delete"], tmp_path)
    assert code == 0 and not path.exists() and KEY not in out


# ── deploy/find_chat_id.py ───────────────────────────────────────────

def load_finder():
    finder_spec = importlib.util.spec_from_file_location("find_chat_id", ROOT / "deploy" / "find_chat_id.py")
    module = importlib.util.module_from_spec(finder_spec)
    finder_spec.loader.exec_module(module)
    return module


def test_chats_are_found_in_messages_buttons_and_group_events():
    finder = load_finder()
    found = finder.chats_from_updates([
        {"update_id": 1, "message": {"chat": {"id": 111, "type": "private", "first_name": "Анна"}, "text": "/start"}},
        {"update_id": 2, "my_chat_member": {"chat": {"id": -100222, "type": "supergroup", "title": "Заявки"}}},
        {"update_id": 3, "callback_query": {"message": {"chat": {"id": 333, "type": "private", "username": "ivan"}}}},
        {"update_id": 4, "poll": {}},
    ])
    assert found == {111: "личный чат Анна", -100222: "группа Заявки", 333: "личный чат ivan"}


async def test_find_chat_id_prints_ids_but_not_the_token(tmp_path):
    import httpx
    import respx

    from tests.conftest import TG, TG_TOKEN

    finder = load_finder()
    env = tmp_path / ".env"
    env.write_text(f"TELEGRAM_BOT_TOKEN={TG_TOKEN}\nTELEGRAM_API_BASE={TG}\n", encoding="utf-8")
    lines = []
    with respx.mock as router:
        router.post(url__regex=rf"{TG}/bot.*/getUpdates").mock(return_value=httpx.Response(200, json={"ok": True, "result": [
            {"update_id": 5, "message": {"chat": {"id": 777, "type": "private", "first_name": "Мария"}}}]}))
        code = await finder.run(env, out=lines.append)
        assert code == 0 and lines == ["777  личный чат Мария"]
        router.post(url__regex=rf"{TG}/bot.*/getUpdates").mock(return_value=httpx.Response(200, json={"ok": True, "result": []}))
        lines.clear()
        assert await finder.run(env, out=lines.append) == 1 and "Start" in lines[0]
    assert all(TG_TOKEN not in line for line in lines)
    no_token = tmp_path / "empty.env"
    no_token.write_text("", encoding="utf-8")
    lines.clear()
    assert await finder.run(no_token, out=lines.append) == 1 and "TELEGRAM_BOT_TOKEN" in lines[0]


@pytest.mark.parametrize("service", set_env.KNOWN_SERVICES)
def test_every_known_service_reads_its_own_key_file(tmp_path, downloads, service):
    (downloads / f"{service}-key.txt").write_text(KEY, encoding="utf-8")
    code, out = run(["SOME_KEY", "--service", service, "--delete"], tmp_path)
    assert code == 0 and KEY not in out
    assert not (downloads / f"{service}-key.txt").exists()


def test_missing_file_message_lists_all_key_file_names(tmp_path, downloads):
    code, out = run(["OPENAI_API_KEY", "--service", "openai"], tmp_path)
    assert code == 1
    for service in set_env.KNOWN_SERVICES:
        assert f"{service}-key.txt" in out


def test_course_documents_name_every_key_file():
    """Список имён файлов ключей один на скрипт, сценарий курса и навык автоматизатора."""
    docs = [ROOT.parent / "docs" / "SCENARIO.md", ROOT.parent / ".claude" / "skills" / "onai-automator" / "SKILL.md",
            ROOT.parent / "docs" / "guides" / "claude-desktop.md"]
    for doc in docs:
        text = doc.read_text(encoding="utf-8")
        missing = [f"{s}-key.txt" for s in set_env.KNOWN_SERVICES if f"{s}-key.txt" not in text]
        assert not missing, f"{doc.name}: нет имён {missing}"
