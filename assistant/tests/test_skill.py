"""Навык автоматизатора ссылается на файлы и команды, которые действительно есть."""

import re

from tests.conftest import ROOT

REPO = ROOT.parent
SKILL_DIR = REPO / ".claude" / "skills" / "onai-automator"
SKILL = SKILL_DIR / "SKILL.md"


def skill_text() -> str:
    return SKILL.read_text(encoding="utf-8")


def test_skill_has_frontmatter_and_nine_sections():
    text = skill_text()
    assert text.startswith("---\nname: onai-automator\n")
    headings = re.findall(r"^## (\d)\. ", text, re.M)
    assert headings == [str(n) for n in range(1, 10)]


def test_skill_contains_the_required_rules():
    text = skill_text()
    assert "Если не хочешь делать это сам по моей инструкции, я могу сделать это за тебя: авторизуйся или зарегистрируйся" in text
    assert "в нужных\n> аккаунтах через мой браузер, дальше я пройду шаги сам." in text
    assert "пароль, оплату и копирование ключа делает сам ученик" in text
    assert "не больше 5 вопросов одним сообщением" in text
    assert "work/_profile/brief.md" in text and "прямо в чат" in text and "инструментом правки файла" in text
    assert "10 вопросов" in text or "десятью вопросами" in text
    assert text.count("**Ворота:**") >= 7
    for path in ("work/<ролик>/PUBLISH.md", "work/<ролик>/SCRIPT.md", "config/keywords.toml", "deploy/update.sh"):
        assert path in text


def test_every_mentioned_file_exists():
    text = skill_text() + (SKILL_DIR / "reference" / "messages.md").read_text(encoding="utf-8")
    for name in sorted(set(re.findall(r"(?:docs/guides/[\w-]+\.md|assistant/[\w/.-]+|deploy/[\w.]+|(?:\.claude/skills/[\w-]+/)?reference/[\w.-]+)", text))):
        name = name.rstrip(".")
        if name.endswith((".env", "/backups/")):   # эти файлы агент создаёт сам
            continue
        candidates = [REPO / name, ROOT / name, SKILL_DIR / name, ROOT / name.removeprefix("assistant/")]
        assert any(c.exists() for c in candidates), f"в навыке упомянут несуществующий файл: {name}"


def test_commands_in_the_skill_match_real_flags():
    text = skill_text()
    for command in ("python -m app.check", "python -m app.try", "deploy/set_env.py", "deploy/find_chat_id.py",
                    "deploy/register_webhook.py", "deploy/install.sh", "deploy/backup.sh"):
        assert command in text
    set_env = (ROOT / "deploy" / "set_env.py").read_text(encoding="utf-8")
    for flag in ("--service", "--delete", "--generate", "--value"):
        assert flag in set_env
    check = (ROOT / "app" / "check.py").read_text(encoding="utf-8")
    assert "--offline" in check


def test_team_prompt_points_to_the_skill():
    text = (REPO / "team" / "prompts" / "automator.md").read_text(encoding="utf-8")
    assert "Ты чат «Instagram AI-менеджер» этой папки" in text
    assert ".claude/skills/onai-automator/SKILL.md" in text and "раздела 1" in text
    assert 2 <= len([line for line in text.splitlines() if line.strip()]) <= 4


def test_skill_texts_have_no_long_dash_or_free_claude():
    dash = chr(0x2014)
    for path in [SKILL, *SKILL_DIR.rglob("*.md"), REPO / "team" / "prompts" / "automator.md"]:
        assert dash not in path.read_text(encoding="utf-8"), path
