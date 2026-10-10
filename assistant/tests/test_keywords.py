"""Кодовые слова: написание, режимы поиска, опечатки, личка и черновики."""

import pytest

from app import keywords as kw


@pytest.fixture
def words(workdir):
    return kw.load(workdir / "config" / "keywords.toml")


def found(text, words, **kwargs):
    hit = kw.find(text, words, **kwargs)
    return hit.word if hit else None


def test_word_in_any_case_and_with_noise(words):
    assert found("ПАПКА", words) == "ПАПКА"
    assert found("папка", words) == "ПАПКА"
    assert found("Хочу папка!!! 🔥", words) == "ПАПКА"


def test_variant_spelling(words):
    assert found("скинь папку", words) == "ПАПКА"


def test_layout_lookalikes_are_one_word(words):
    # «мср» кириллицей выглядит как mcp, но это другие байты
    assert found("мср", words) == "mcp"
    assert found("МСР", words) == "mcp"
    assert found("mcp", words) == "mcp"


def test_exact_mode_wants_the_whole_comment(words):
    assert found("сайт", words) == "сайт"
    assert found("Сайт!", words) == "сайт"
    assert found("мой сайт готов", words) is None
    assert found("сайты", words) is None


def test_word_mode_is_a_whole_token(words):
    folder = next(w for w in words if w.word == "ПАПКА")
    assert not kw.matches("папкаа", folder)          # другое слово, не вхождение
    assert not kw.matches("папкаааа", folder)
    assert found("папкаааа", words) is None          # и на опечатку это не похоже
    assert found("папка, пожалуйста", words) == "ПАПКА"


def test_stem_mode_finds_inside(workdir):
    path = workdir / "config" / "keywords.toml"
    path.write_text('[[keyword]]\nword = "папк"\nmatch = "stem"\nmessage = "x"\n', encoding="utf-8")
    words = kw.load(path)
    assert found("а где та папка?", words) == "папк"


def test_one_letter_typo_in_a_single_word(words):
    assert found("githib", words) == "github"
    assert found("Githab", words) == "github"
    assert found("гитхаб", words) == "гитхаб"
    assert found("папкв", words) == "ПАПКА"


def test_typo_needs_a_single_candidate(workdir):
    path = workdir / "config" / "keywords.toml"
    path.write_text('[[keyword]]\nword = "plain"\nmessage = "a"\n[[keyword]]\nword = "plane"\nmessage = "b"\n',
                    encoding="utf-8")
    words = kw.load(path)
    # plaie отличается от обоих слов одной буквой, выбирать наугад нельзя
    assert kw.similar("plaie", words) is None
    assert kw.similar("plaib", words).word == "plain"


def test_typo_not_for_short_words_or_phrases(words):
    assert found("мсп", words) is None
    assert found("githib пожалуйста", words) is None


def test_inactive_word_is_ignored(words):
    assert found("черновик", words) is None


def test_direct_mode_short_message_only(words):
    assert found("папка", words, direct=True) == "ПАПКА"
    assert found("скинь папку пж", words, direct=True) == "ПАПКА"
    assert found("а можно мне папку со стартовым набором пожалуйста", words, direct=True) is None


def test_direct_mode_skips_comments_only_words(words):
    assert found("ролик", words) == "ролик"
    assert found("ролик", words, direct=True) is None


def test_direct_mode_does_not_guess_typos(words):
    assert found("githib", words, direct=True) is None


def test_unfilled_placeholders_are_reported(workdir):
    path = workdir / "config" / "keywords.toml"
    path.write_text('[[keyword]]\nword = "один"\nmessage = "Держи [[ЗАПОЛНИ: что]]"\n'
                    '[[keyword]]\nword = "два"\nmessage = ""\n'
                    '[[keyword]]\nword = "три"\nactive = false\nmessage = "[[ЗАПОЛНИ: x]]"\n'
                    '[[keyword]]\nword = "четыре"\nmessage = "готово"\n', encoding="utf-8")
    assert kw.unfilled(kw.load(path)) == ["один", "два"]


def test_distance_handles_swap_and_edges():
    assert kw._distance("github", "gihtub") == 1
    assert kw._distance("abc", "abc") == 0
    assert kw._distance("abc", "abcdef") == 2
