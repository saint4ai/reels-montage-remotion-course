"""Проверка русского текста для голоса и публикации по справочнику references/humanize.md навыка onai-scriptolog.

Запуск: python -I -X utf8 .claude/skills/onai-scriptolog/scripts/humanize_check.py <файл> [--script]

Понимает четыре формата: work/<ролик>/SCRIPT.md (блок кода под «## Текст для суфлёра»), блоки «@@ Название»,
файл суфлёра с «## NN Название» и обычный текст.
ОШИБКИ: вступления-предусловия, длинное тире, штампы нейросети, призыв «пришлю ссылки». ПРЕДУПРЕЖДЕНИЯ: ниша в начале,
длинные фразы, хук длиннее 10 слов или вопросом, длина сценария вне 115–130 слов (с --script или если есть «Напиши «»).
Код выхода 1, если есть ошибки.
"""
import re
import sys

PREAMBLE = [
    r"знакомо", r"представь", r"бывало", r"было такое", r"узна[её]шь себя", r"наверняка", r"все мы знаем",
    r"каждый из нас", r"согласись", r"давай честно", r"теперь честно", r"скажу честно", r"ты не поверишь",
    r"держись крепче", r"а теперь внимание", r"вот в ч[её]м дело", r"дело в том, что", r"суть в том",
    r"секрет в том", r"давай разбер[её]мся", r"сейчас расскажу", r"работает так\.", r"как это работает\?",
]
SLOP = [
    r"помога(ет|ют)", r"позволя(ет|ют)", r"да[её]т возможность", r"являет(ся|ся)", r"осуществля",
    r"уникальн", r"инновацион", r"революцион", r"прорыв", r"меняет правила игры", r"магия",
    r"важно отметить", r"стоит отметить", r"в современном мире", r"в эпоху", r"таким образом", r"в итоге",
    r"не просто [^.?!]{1,40}, а ", r"не только [^.?!]{1,60}, но и ", r"эксперты (говорят|считают)", r"многие считают",
]
DASH = chr(0x2014)  # длинное тире
NICHE = r"салон|кофейн|застройщик|мастер(а|ов|ам)?\b|\bЖК\b|ресторан|барбершоп|Астан|Алмат"
WORD = r"[A-Za-zА-Яа-яЁёІіӘәҒғҚқҢңӨөҰұҮүҺһ0-9]+(?:[-’'][A-Za-zА-Яа-яЁёІіӘәҒғҚқҢңӨөҰұҮүҺһ0-9]+)*"


def blocks(text):
    # work/<ролик>/SCRIPT.md: проверяется только блок кода под «## Текст для суфлёра»
    m = re.search(r"^## Текст для суфлёра[^\n]*\n+```[^\n]*\n(.*?)\n```", text, re.M | re.S)
    if m:
        yield "сценарий", m.group(1).strip()
        return
    if "\n@@ " in "\n" + text:
        for b in ("\n" + text).split("\n@@ ")[1:]:
            title, _, body = b.partition("\n")
            yield title.strip(), body.strip()
    elif re.search(r"^## ", text, re.M):
        for b in re.split(r"^## ", text, flags=re.M)[1:]:
            title, _, body = b.partition("\n")
            body = "\n".join(l.rstrip() for l in body.split("\n") if l.strip() and l.strip() != DASH)
            yield title.strip(), body.strip()
    else:
        yield "текст", text.strip()


def check(title, body, script_mode):
    errors, warns = [], []
    flat = re.sub(r"\s+", " ", body)
    low = flat.lower()
    for p in PREAMBLE:
        for m in re.finditer(r"(?<![а-яё])" + p, low):
            errors.append(f"вступление «{flat[m.start():m.end()]}» в: …{flat[max(0, m.start()-30):m.end()+30]}…")
    for p in SLOP:
        for m in re.finditer(r"(?<![а-яё])" + p, low):
            errors.append(f"штамп «{flat[m.start():m.end()]}» в: …{flat[max(0, m.start()-30):m.end()+30]}…")
    if DASH in flat:
        errors.append(f"длинное тире «{DASH}»: {flat.count(DASH)} шт.")
    sents = [s for s in re.split(r"(?<=[.!?…])\s+(?=[«A-ZА-ЯЁІӘҒҚҢӨҰҮҺ0-9])", flat) if s]
    lens = [len(re.findall(WORD, s)) for s in sents]
    words = sum(lens)
    if sents:
        if lens[0] > 10:
            warns.append(f"хук {lens[0]} слов (норма до 10): {sents[0]}")
        if sents[0].rstrip().endswith("?"):
            warns.append(f"хук вопросом: {sents[0]}")
        for s in sents[:3]:
            if re.search(NICHE, s, re.I):
                warns.append(f"узкая ниша в начале: {s}")
        for s, n in zip(sents, lens):
            if n > 15:
                warns.append(f"фраза {n} слов (максимум 15): {s}")
        avg = words / len(sents)
        if avg > 10:
            warns.append(f"средняя фраза {avg:.1f} слова (норма до 10)")
    cta = re.search(r"Напиши «[^»]+»[^.]*\.", flat)
    if cta:
        if re.search(r"пришлю (все |тебе )?([а-я]+ )?ссылк", cta.group(0), re.I):
            errors.append(f"призыв обещает ссылки, а не инструкцию: {cta.group(0)}")
        elif "инструкцию, как" not in cta.group(0):
            warns.append(f"призыв без «пришлю инструкцию, как …»: {cta.group(0)}")
    if "!" in flat:
        warns.append("восклицательный знак в тексте для голоса")
    if (script_mode or "Напиши «" in flat) and not (115 <= words <= 130) and "Напиши в комментариях" not in flat:
        warns.append(f"длина {words} слов (норма 115–130)")
    return words, errors, warns


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    script_mode = "--script" in sys.argv
    if not args:
        print(__doc__)
        sys.exit(2)
    total_err = 0
    for path in args:
        text = open(path, encoding="utf-8").read()
        for title, body in blocks(text):
            words, errors, warns = check(title, body, script_mode)
            mark = "OK" if not errors else "ОШИБКИ"
            print(f"== {title}: {words} слов, {mark}")
            for e in errors:
                print("  ОШИБКА:", e)
            for w in warns:
                print("  внимание:", w)
            total_err += len(errors)
    print(f"Итого ошибок: {total_err}")
    sys.exit(1 if total_err else 0)


if __name__ == "__main__":
    main()
