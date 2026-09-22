from __future__ import annotations

from pathlib import Path
from typing import Iterable, Sequence

from PIL import Image
from reportlab.lib.colors import HexColor, Color
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf" / "onai-automontage-remotion-guide.pdf"

PAGE_W, PAGE_H = A4
MARGIN = 52
PAPER = HexColor("#FAFAFA")
INK = HexColor("#0A0A0A")
MUTED = HexColor("#6A6A6A")
LINE = HexColor("#E5E5E5")
LIME = HexColor("#C7FF1A")
ORANGE = HexColor("#FF5C1A")
BLUE = HexColor("#1A8CFF")
SOFT = HexColor("#F3F3F0")

FONT_DIR = Path("/Users/miso/Library/Fonts")
FONTS = {
    "Display": FONT_DIR / "InterTight-ExtraBold.ttf",
    "Body": Path("/System/Library/Fonts/Supplemental/Arial.ttf"),
    "BodyMedium": Path("/System/Library/Fonts/Supplemental/Arial.ttf"),
    "BodyBold": Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
    "SerifItalic": Path("/System/Library/Fonts/Supplemental/Georgia Italic.ttf"),
    "Mono": FONT_DIR / "JetBrainsMono-Variable.ttf",
    "MonoBold": FONT_DIR / "JetBrainsMono-Variable.ttf",
}

for name, path in FONTS.items():
    if not path.exists():
        raise FileNotFoundError(path)
    pdfmetrics.registerFont(TTFont(name, str(path)))


def text_width(text: str, font: str, size: float) -> float:
    return pdfmetrics.stringWidth(text, font, size)


def wrap(text: str, font: str, size: float, width: float) -> list[str]:
    lines: list[str] = []
    for paragraph in text.split("\n"):
        if not paragraph:
            lines.append("")
            continue
        words = paragraph.split()
        current = ""
        for word in words:
            candidate = word if not current else f"{current} {word}"
            if text_width(candidate, font, size) <= width:
                current = candidate
            else:
                if current:
                    lines.append(current)
                current = word
        if current:
            lines.append(current)
    return lines


def draw_wrapped(
    c: Canvas,
    text: str,
    x: float,
    y: float,
    width: float,
    *,
    font: str = "Body",
    size: float = 12,
    leading: float | None = None,
    color=INK,
) -> float:
    leading = leading or size * 1.42
    c.setFont(font, size)
    c.setFillColor(color)
    for line in wrap(text, font, size, width):
        c.drawString(x, y, line)
        y -= leading
    return y


def draw_bullets(
    c: Canvas,
    items: Sequence[str],
    x: float,
    y: float,
    width: float,
    *,
    size: float = 11.5,
    gap: float = 9,
    accent=LIME,
) -> float:
    for item in items:
        c.setFillColor(accent)
        c.roundRect(x, y - size + 3, 9, 9, 2.5, stroke=0, fill=1)
        y = draw_wrapped(c, item, x + 19, y, width - 19, size=size, leading=size * 1.38)
        y -= gap
    return y


def draw_logo(c: Canvas, x: float, y: float, scale: float = 1.0) -> None:
    mark = ROOT / "tmp" / "pdfs" / "onai-mark.png"
    c.drawImage(str(mark), x, y, width=39 * scale, height=21 * scale, mask="auto")
    c.setFillColor(INK)
    c.setFont("Display", 14 * scale)
    c.drawString(x + 47 * scale, y + 4 * scale, "onAI Academy")


def page_header(c: Canvas, section: str, page: int) -> None:
    c.setFillColor(PAPER)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    draw_logo(c, MARGIN, PAGE_H - 42)
    c.setFont("Mono", 7.5)
    c.setFillColor(MUTED)
    c.drawRightString(PAGE_W - MARGIN, PAGE_H - 33, section.upper())
    c.setStrokeColor(LINE)
    c.setLineWidth(0.8)
    c.line(MARGIN, PAGE_H - 53, PAGE_W - MARGIN, PAGE_H - 53)
    c.setFont("Mono", 7.5)
    c.setFillColor(MUTED)
    c.drawRightString(PAGE_W - MARGIN, 27, f"{page:02d}")


def title(c: Canvas, text: str, y: float = PAGE_H - 105, size: float = 29, width: float | None = None) -> float:
    width = width or PAGE_W - 2 * MARGIN
    return draw_wrapped(c, text, MARGIN, y, width, font="Display", size=size, leading=size * 1.02)


def label(c: Canvas, text: str, x: float, y: float, *, bg=INK, fg=Color(1, 1, 1)) -> float:
    c.setFont("MonoBold", 7.5)
    w = text_width(text, "MonoBold", 7.5) + 20
    c.setFillColor(bg)
    c.roundRect(x, y - 8, w, 20, 3, stroke=0, fill=1)
    c.setFillColor(fg)
    c.drawString(x + 10, y - 1.5, text)
    return w


def card(c: Canvas, x: float, y: float, w: float, h: float, *, fill=SOFT, stroke=LINE, radius: float = 10) -> None:
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(0.8)
    c.roundRect(x, y, w, h, radius, stroke=1, fill=1)


def code_box(c: Canvas, lines: Sequence[str], x: float, y: float, w: float, *, size: float = 8.4) -> float:
    leading = size * 1.48
    wrapped: list[str] = []
    for line in lines:
        wrapped.extend(wrap(line, "Mono", size, w - 28) or [""])
    h = 24 + len(wrapped) * leading
    c.setFillColor(INK)
    c.roundRect(x, y - h, w, h, 9, stroke=0, fill=1)
    c.setFillColor(Color(1, 1, 1))
    c.setFont("Mono", size)
    ty = y - 18
    for line in wrapped:
        c.drawString(x + 14, ty, line)
        ty -= leading
    return y - h


def draw_image_fit(c: Canvas, path: Path, x: float, y: float, w: float, h: float) -> None:
    with Image.open(path) as image:
        iw, ih = image.size
    scale = min(w / iw, h / ih)
    dw, dh = iw * scale, ih * scale
    c.drawImage(str(path), x + (w - dw) / 2, y + (h - dh) / 2, width=dw, height=dh, mask="auto")


def link(c: Canvas, text: str, url: str, x: float, y: float, size: float = 9.5) -> None:
    c.setFont("BodyMedium", size)
    c.setFillColor(BLUE)
    c.drawString(x, y, text)
    w = text_width(text, "BodyMedium", size)
    c.setStrokeColor(BLUE)
    c.line(x, y - 2, x + w, y - 2)
    c.linkURL(url, (x, y - 4, x + w, y + size + 2), relative=0)


def section_page(c: Canvas, page: int, kicker: str, heading: str, note: str, accent=LIME) -> None:
    page_header(c, kicker, page)
    c.setFillColor(accent)
    c.rect(MARGIN, PAGE_H - 210, 8, 92, stroke=0, fill=1)
    draw_wrapped(c, heading, MARGIN + 28, PAGE_H - 126, PAGE_W - 2 * MARGIN - 28, font="Display", size=34, leading=35)
    draw_wrapped(c, note, MARGIN + 28, PAGE_H - 246, PAGE_W - 2 * MARGIN - 28, font="SerifItalic", size=20, leading=25, color=MUTED)


def build() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    c = Canvas(str(OUT), pagesize=A4, pageCompression=1)
    c.setTitle("Автомонтаж Reels с AI и Remotion - onAI Academy")
    c.setAuthor("onAI Academy")
    c.setSubject("Пошаговый гайд по работе с учебным Remotion-репозиторием")

    page = 1

    # 1. Cover
    c.setFillColor(PAPER)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    draw_logo(c, MARGIN, PAGE_H - 58, 1.25)
    label(c, "БОНУСНЫЙ МОДУЛЬ", MARGIN, PAGE_H - 118, bg=INK)
    draw_wrapped(c, "Автомонтаж Reels\nс AI и Remotion", MARGIN, PAGE_H - 190, PAGE_W - 2 * MARGIN, font="Display", size=45, leading=45)
    c.setFillColor(LIME)
    c.rect(MARGIN, PAGE_H - 330, 185, 11, stroke=0, fill=1)
    draw_wrapped(c, "От первого вопроса агенту до проверенного MP4", MARGIN, PAGE_H - 380, 360, font="SerifItalic", size=24, leading=28, color=MUTED)
    y = PAGE_H - 510
    for number, item in [("01", "Выбор темы и стиля"), ("02", "Сценарий и сборка в Remotion"), ("03", "Кадры, правки и финальный рендер")]:
        c.setFillColor(INK)
        c.setFont("MonoBold", 9)
        c.drawString(MARGIN, y, number)
        c.setFont("BodyMedium", 13)
        c.drawString(MARGIN + 43, y, item)
        c.setStrokeColor(LINE)
        c.line(MARGIN, y - 15, PAGE_W - MARGIN, y - 15)
        y -= 58
    c.setFont("Mono", 8)
    c.setFillColor(MUTED)
    c.drawString(MARGIN, 45, "onAI Academy · Вайб-кодинг · 2026")
    c.showPage()
    page += 1

    # 2. Outcome
    page_header(c, "Результат", page)
    y = title(c, "Что получится после прохождения") - 30
    y = draw_wrapped(c, "Вы не изучаете монтаж как отдельную профессию. Вы учитесь ставить задачу агенту и контролировать качество по понятным точкам.", MARGIN, y, PAGE_W - 2 * MARGIN, size=13.5, leading=19, color=MUTED) - 28
    items = [
        ("1", "Репозиторий", "Готовая Remotion-среда с четырьмя стилями и правилами для агента."),
        ("2", "Пошаговый процесс", "Интервью, референсы, исследование, сториборд, кадры, правки и рендер."),
        ("3", "Контроль качества", "Финальный MP4 появляется только после вашего одобрения статичных кадров."),
    ]
    for n, head, body in items:
        card(c, MARGIN, y - 100, PAGE_W - 2 * MARGIN, 92, fill=Color(1, 1, 1))
        c.setFillColor(LIME)
        c.roundRect(MARGIN + 16, y - 74, 46, 46, 9, stroke=0, fill=1)
        c.setFont("MonoBold", 12)
        c.setFillColor(INK)
        c.drawCentredString(MARGIN + 39, y - 56, n)
        c.setFont("BodyBold", 14)
        c.drawString(MARGIN + 82, y - 37, head)
        draw_wrapped(c, body, MARGIN + 82, y - 58, PAGE_W - 2 * MARGIN - 102, size=10.5, leading=14.5, color=MUTED)
        y -= 114
    c.showPage()
    page += 1

    # 3. Workflow
    page_header(c, "Карта процесса", page)
    y = title(c, "Восемь состояний работы") - 26
    states = [
        ("01", "INTAKE", "агент задаёт вопросы"),
        ("02", "STYLE", "вы выбираете стиль"),
        ("03", "RESEARCH", "факты и тема проверены"),
        ("04", "STORYBOARD", "сцены разложены по речи"),
        ("05", "BUILD", "композиция собрана"),
        ("06", "FRAMES", "кадры каждые 2 секунды"),
        ("07", "RENDER", "финальный MP4"),
        ("08", "QA", "проверка видео и звука"),
    ]
    for idx, (num, state, desc) in enumerate(states):
        row_y = y - idx * 57
        c.setFont("MonoBold", 9)
        c.setFillColor(ORANGE if idx in (0, 5) else MUTED)
        c.drawString(MARGIN, row_y, num)
        c.setFont("BodyBold", 12)
        c.setFillColor(INK)
        c.drawString(MARGIN + 44, row_y, state)
        c.setFont("Body", 10.5)
        c.setFillColor(MUTED)
        c.drawString(MARGIN + 166, row_y, desc)
        if idx < len(states) - 1:
            c.setStrokeColor(LINE)
            c.line(MARGIN + 44, row_y - 18, PAGE_W - MARGIN, row_y - 18)
    c.setFillColor(LIME)
    c.roundRect(MARGIN, 83, PAGE_W - 2 * MARGIN, 56, 8, stroke=0, fill=1)
    draw_wrapped(c, "Главный стоп: до одобрения кадров полный MP4 не создаётся.", MARGIN + 18, 116, PAGE_W - 2 * MARGIN - 36, font="BodyBold", size=12, leading=15)
    c.showPage()
    page += 1

    # 4. Clone
    page_header(c, "Старт", page)
    y = title(c, "Одна ссылка и одно сообщение") - 28
    draw_wrapped(c, "Отправьте агенту репозиторий. Его AGENTS.md уже содержит порядок вопросов, правила Remotion и точку остановки перед рендером.", MARGIN, y, PAGE_W - 2 * MARGIN, size=13, leading=18, color=MUTED)
    y -= 68
    y = code_box(c, [
        "Клонируй https://github.com/saint4ai/",
        "reels-montage-remotion-course.",
        "Прочитай AGENTS.md и проведи меня по процессу.",
        "Сначала задай вопросы и покажи четыре стиля.",
        "Не собирай финальный MP4 до моего одобрения кадров.",
    ], MARGIN, y, PAGE_W - 2 * MARGIN, size=9.2)
    link(c, "Открыть учебный репозиторий", "https://github.com/saint4ai/reels-montage-remotion-course", MARGIN, y - 36, 10.5)
    y -= 98
    label(c, "ВАЖНО", MARGIN, y, bg=ORANGE)
    draw_wrapped(c, "Если агент сразу начал писать код, остановите его и повторите: «Сначала интервью и выбор стиля». Это экономит больше времени, чем любые оптимизации рендера.", MARGIN, y - 36, PAGE_W - 2 * MARGIN, font="BodyMedium", size=12, leading=17)
    c.showPage()
    page += 1

    # 5. Questions
    page_header(c, "Интервью", page)
    y = title(c, "Восемь вопросов до монтажа") - 26
    questions = [
        "Что делаем: новый Reels, фрагмент YouTube, подкаст, запись экрана или ролик без спикера?",
        "Где исходник и сколько он длится?",
        "Какая тема и одно главное действие зрителя после просмотра?",
        "Какая площадка и целевая длительность?",
        "Язык речи и нужны ли субтитры?",
        "Какие 2-5 референсов нравятся и чем именно?",
        "Какие логотипы, цвета, шрифты и скриншоты обязательны?",
        "Какой стиль выбираем: PRISM, ORBIT, TRACE или PULSE?",
    ]
    y = draw_bullets(c, questions, MARGIN, y, PAGE_W - 2 * MARGIN, size=10.4, gap=6)
    c.setFont("SerifItalic", 18)
    c.setFillColor(MUTED)
    c.drawString(MARGIN, 62, "Отвечайте простыми словами. Технические решения принимает агент.")
    c.showPage()
    page += 1

    # 6. Sources
    page_header(c, "Исходник", page)
    y = title(c, "Что можно превратить в Reels") - 24
    rows = [
        ("YouTube", "Сначала выбрать 3 сильных фрагмента. Монтировать только выбранный."),
        ("Подкаст", "Найти законченную мысль, убрать повторы, сохранить естественную речь."),
        ("Talking head", "Синхронизировать графику с фразами, лицо держать в свободной зоне."),
        ("Запись экрана", "Показать действие крупно, не увеличивать случайные строки интерфейса."),
        ("Текст + озвучка", "Собрать визуальные сцены с нуля, но оставить одну мысль на сцену."),
        ("Скриншоты", "Задать порядок, акценты и понятные переходы между состояниями."),
    ]
    for name, desc in rows:
        card(c, MARGIN, y - 60, PAGE_W - 2 * MARGIN, 51, fill=Color(1, 1, 1), radius=7)
        c.setFont("BodyBold", 11.5)
        c.setFillColor(INK)
        c.drawString(MARGIN + 14, y - 31, name)
        draw_wrapped(c, desc, MARGIN + 124, y - 25, PAGE_W - 2 * MARGIN - 140, size=9.2, leading=12.5, color=MUTED)
        y -= 68
    c.showPage()
    page += 1

    # 7. Styles overview
    page_header(c, "Стили", page)
    title(c, "Сначала выберите визуальную механику")
    img = ROOT / "public" / "style-previews" / "four-styles.png"
    draw_image_fit(c, img, MARGIN, 76, PAGE_W - 2 * MARGIN, PAGE_H - 210)
    c.showPage()
    page += 1

    style_pages = [
        ("PRISM", "Светлый стеклянный интерфейс", "01-prism.png", LIME, ["Продуктовые разборы и автоматизация", "Контрол превращается в интерфейс", "Чистый фон, ясный результат", "Не перегружать стеклянными карточками"]),
        ("ORBIT", "Глубина, объекты и связи", "02-orbit.png", ORANGE, ["Системы, процессы и технологичные темы", "Объекты сохраняют глубину и связь", "Параллакс работает постоянно", "Космический фон сам по себе не делает ORBIT"]),
        ("TRACE", "Сетка и рисующаяся логика", "03-trace.png", LIME, ["Обучение, чеклисты и аудиты", "Линия показывает причинность", "Крупные числа и понятный прогресс", "Текст остаётся коротким и проверяемым"]),
        ("PULSE", "Голос и крупные предметы", "04-pulse.png", ORANGE, ["Энергичная речь и простые метафоры", "Крупный предмет отвечает на фразу", "Портрет работает как рассказчик", "Статус: экспериментальный стиль"]),
    ]
    for name, subtitle, filename, accent, bullets in style_pages:
        page_header(c, f"Стиль {name}", page)
        c.setFillColor(accent)
        c.rect(MARGIN, PAGE_H - 174, 8, 70, stroke=0, fill=1)
        draw_wrapped(c, name, MARGIN + 26, PAGE_H - 108, 250, font="Display", size=34, leading=35)
        draw_wrapped(c, subtitle, MARGIN + 26, PAGE_H - 151, 260, font="SerifItalic", size=18, leading=21, color=MUTED)
        draw_image_fit(c, ROOT / "public" / "style-previews" / filename, PAGE_W - MARGIN - 190, 96, 190, PAGE_H - 190)
        draw_bullets(c, bullets, MARGIN, PAGE_H - 250, PAGE_W - 2 * MARGIN - 215, size=11.2, gap=13, accent=accent)
        c.showPage()
        page += 1

    # 12. References
    section_page(c, page, "Референсы", "Как «дообучить» агента на стиле", "Для одного ролика fine-tuning не нужен. Нужен проверяемый профиль референсов.")
    y = PAGE_H - 330
    y = draw_bullets(c, [
        "Соберите 2-5 референсов: один по ритму, один по композиции, один по типографике.",
        "Для каждого укажите, что именно нравится: пауза, крупность, движение, цвет или роль спикера.",
        "Агент фиксирует темп, композицию, типографику, переходы, звук и правила «оставить / избегать».",
        "Попросите пересказать профиль пятью правилами до начала кода.",
        "Проверяйте усвоение по кадрам, а не по обещаниям в чате.",
    ], MARGIN + 28, y, PAGE_W - 2 * MARGIN - 28, size=11, gap=8)
    c.showPage()
    page += 1

    # 13. Reference prompt
    page_header(c, "Референсы", page)
    y = title(c, "Сообщение, которое работает") - 30
    y = code_box(c, [
        "Изучи приложенные референсы. Не копируй их буквально.",
        "Составь профиль: темп, композиция, типографика,",
        "переходы, звук, положение спикера, что оставить",
        "и чего избегать.",
        "Потом перескажи профиль пятью правилами",
        "и дождись моего подтверждения.",
    ], MARGIN, y, PAGE_W - 2 * MARGIN, size=9.3)
    y -= 40
    label(c, "ПЛОХО", MARGIN, y, bg=ORANGE)
    draw_wrapped(c, "«Сделай так же». Агент не понимает, что именно вы считаете ценным.", MARGIN, y - 32, PAGE_W - 2 * MARGIN, size=12, leading=17)
    y -= 94
    label(c, "ХОРОШО", MARGIN, y, bg=LIME, fg=INK)
    draw_wrapped(c, "«Нравится, как портрет остаётся в кадре, а схема перестраивается вокруг него. Нужен такой ритм, но наш светлый фон и наш шрифт».", MARGIN, y - 32, PAGE_W - 2 * MARGIN, size=12, leading=17)
    c.showPage()
    page += 1

    # 14. Research
    page_header(c, "Тема", page)
    y = title(c, "Research нужен не всегда") - 28
    draw_wrapped(c, "Если у вас есть готовый текст и проверенные факты, агент может сразу перейти к сториборду. Исследование нужно, когда тема актуальная, спорная или зависит от интерфейсов и цен.", MARGIN, y, PAGE_W - 2 * MARGIN, size=13, leading=19, color=MUTED)
    y -= 92
    y = draw_bullets(c, [
        "Проверить названия продуктов, функции, цены и даты по первичным источникам.",
        "Сформулировать одну главную мысль ролика.",
        "Выбрать 1-3 доказательства, которые реально войдут в кадр.",
        "Сохранить ссылки в work/<slug>/research.md.",
        "Не тащить в сценарий всё найденное. Ролик не является отчётом.",
    ], MARGIN, y, PAGE_W - 2 * MARGIN, size=11.3, gap=9)
    c.showPage()
    page += 1

    # 15. Script
    page_header(c, "Сценарий", page)
    y = title(c, "Каркас короткого ролика") - 28
    blocks = [
        ("0-3 сек", "Хук", "Проблема или обещание результата без вступления."),
        ("3-12 сек", "Контекст", "Что происходит и почему зрителю стоит досмотреть."),
        ("12-35 сек", "Механика", "Показ процесса через действия, объекты и реальные интерфейсы."),
        ("35-50 сек", "Результат", "Что изменилось после действия."),
        ("Финал", "CTA", "Одно понятное следующее действие."),
    ]
    for timing, head, desc in blocks:
        c.setFont("MonoBold", 8.5)
        c.setFillColor(ORANGE)
        c.drawString(MARGIN, y, timing)
        c.setFont("BodyBold", 12)
        c.setFillColor(INK)
        c.drawString(MARGIN + 82, y, head)
        y = draw_wrapped(c, desc, MARGIN + 172, y, PAGE_W - 2 * MARGIN - 172, size=10.5, leading=14.5, color=MUTED) - 18
        c.setStrokeColor(LINE)
        c.line(MARGIN, y + 7, PAGE_W - MARGIN, y + 7)
        y -= 13
    c.setFillColor(LIME)
    c.roundRect(MARGIN, 71, PAGE_W - 2 * MARGIN, 62, 9, stroke=0, fill=1)
    draw_wrapped(c, "Одна сцена - одна мысль. Движение должно объяснять смысл речи.", MARGIN + 17, 110, PAGE_W - 2 * MARGIN - 34, font="BodyBold", size=12, leading=16)
    c.showPage()
    page += 1

    # 16. Storyboard
    page_header(c, "Сториборд", page)
    y = title(c, "Что агент показывает до сборки") - 30
    y = draw_bullets(c, [
        "Точные границы каждой сцены по речи.",
        "Текст на экране и текст субтитров.",
        "Визуальную механику: появление, перестройка, сравнение, счётчик или демонстрация интерфейса.",
        "Источник каждого ассета и статус лицензии.",
        "Положение лица, графики и субтитров.",
        "Список недостающих файлов до начала тяжёлой работы.",
    ], MARGIN, y, PAGE_W - 2 * MARGIN, size=11.5, gap=9)
    draw_wrapped(
        c,
        "Исправить смысл в JSON быстрее, чем переделывать анимацию.",
        MARGIN,
        82,
        PAGE_W - 2 * MARGIN,
        font="SerifItalic",
        size=18,
        leading=22,
        color=MUTED,
    )
    c.showPage()
    page += 1

    # 17. Files
    page_header(c, "Файлы", page)
    y = title(c, "Куда положить исходники") - 24
    y = code_box(c, [
        "public/input/",
        "  source.mp4        исходное видео",
        "  voice.wav         отдельная озвучка",
        "  logo.svg          логотип",
        "  product-01.png    скриншот продукта",
        "  reference-01.jpg  референс",
        "",
        "project/project.json   тема, стиль, текст и тайминги",
        "work/<slug>/            бриф, research и storyboard",
    ], MARGIN, y, PAGE_W - 2 * MARGIN, size=9.1)
    y -= 35
    draw_bullets(c, [
        "Названия файлов - латиницей, без пробелов.",
        "Секреты и токены не кладите в public/ и не коммитьте.",
        "Оригиналы сохраняйте отдельно. Агент работает с копией.",
    ], MARGIN, y, PAGE_W - 2 * MARGIN, size=11, gap=8, accent=ORANGE)
    c.showPage()
    page += 1

    # 18. Install
    page_header(c, "Установка", page)
    y = title(c, "Четыре команды до предпросмотра") - 28
    y = code_box(c, [
        "git clone https://github.com/saint4ai/",
        "reels-montage-remotion-course.git",
        "cd reels-montage-remotion-course",
        "npm install",
        "npm run doctor",
        "npm run studio",
    ], MARGIN, y, PAGE_W - 2 * MARGIN, size=9.5)
    y -= 40
    draw_bullets(c, [
        "doctor проверяет Node.js, Remotion, ffmpeg и обязательные файлы.",
        "studio открывает интерактивный просмотр без полного рендера.",
        "Если что-то не установлено, агент объясняет и исправляет только этот пункт.",
    ], MARGIN, y, PAGE_W - 2 * MARGIN, size=11.2, gap=9)
    c.showPage()
    page += 1

    # 19. Studio
    page_header(c, "Remotion", page)
    y = title(c, "Что проверять в Studio") - 27
    y = draw_bullets(c, [
        "Сцены начинаются и заканчиваются на нужных словах.",
        "Заголовок читается без паузы и не переносится случайно.",
        "Портрет не прыгает между соседними сценами.",
        "Скриншот показывает действие, а не случайный участок интерфейса.",
        "Субтитры помещаются в две короткие строки.",
        "Начало и конец ролика выглядят осознанно.",
    ], MARGIN, y, PAGE_W - 2 * MARGIN, size=11.5, gap=11)
    c.setFillColor(SOFT)
    c.roundRect(MARGIN, 74, PAGE_W - 2 * MARGIN, 78, 10, stroke=0, fill=1)
    draw_wrapped(c, "Studio нужен для быстрой проверки. Он не заменяет кадры согласования и проверку финального MP4.", MARGIN + 18, 124, PAGE_W - 2 * MARGIN - 36, font="BodyMedium", size=12, leading=17)
    c.showPage()
    page += 1

    # 20. Frames
    page_header(c, "Согласование", page)
    y = title(c, "Кадры каждые 2 секунды") - 26
    y = code_box(c, [
        "npm run frames",
        "",
        "reviews/layout-v001/K001-0-00s.png",
        "reviews/layout-v001/K002-2-00s.png",
        "reviews/layout-v001/K003-4-00s.png",
        "reviews/layout-v001/manifest.json",
    ], MARGIN, y, PAGE_W - 2 * MARGIN, size=9.2)
    y -= 38
    draw_bullets(c, [
        "Агент показывает все кадры с номером и таймкодом.",
        "Статичная проверка не доказывает плавность движения и качество звука.",
        "Спорные переходы дополняются кадрами до, в середине и после движения.",
        "До явного одобрения статус работы: AWAITING_FRAME_APPROVAL.",
    ], MARGIN, y, PAGE_W - 2 * MARGIN, size=11, gap=8)
    c.showPage()
    page += 1

    # 21. Feedback
    page_header(c, "Правки", page)
    y = title(c, "Правка по номеру кадра") - 30
    y = code_box(c, [
        "К003: заголовок слишком мелкий.",
        "Увеличь и оставь больше воздуха.",
        "",
        "К006: замени абстрактную иконку",
        "на скриншот реального интерфейса.",
        "",
        "К009: лицо перекрывает подпись.",
        "Перенеси портрет в свободную левую зону.",
        "",
        "Покажи обновлённые кадры. MP4 пока не рендери.",
    ], MARGIN, y, PAGE_W - 2 * MARGIN, size=9.2)
    y -= 38
    draw_wrapped(c, "Нумерация отделяет вкус от общей фразы «что-то не так». Агент точно понимает, где искать дефект и какую часть не трогать.", MARGIN, y, PAGE_W - 2 * MARGIN, font="SerifItalic", size=19, leading=24, color=MUTED)
    c.showPage()
    page += 1

    # 22. Render
    page_header(c, "Рендер", page)
    y = title(c, "Финальный MP4 после одобрения") - 26
    y = code_box(c, [
        "Одобряю кадры версии layout-v003.",
        "Запускай финальный рендер, проверь видео и звук,",
        "затем дай путь к MP4 и краткий QA-отчёт.",
        "",
        "npm run render",
        "",
        "Результат: out/reel.mp4",
    ], MARGIN, y, PAGE_W - 2 * MARGIN, size=9.3)
    y -= 40
    label(c, "НЕ ЗАПУСКАТЬ РАНЬШЕ", MARGIN, y, bg=ORANGE)
    draw_wrapped(c, "Полный рендер до согласования тратит время и провоцирует правки уже закодированного видео.", MARGIN, y - 35, PAGE_W - 2 * MARGIN, font="BodyMedium", size=12, leading=17)
    c.showPage()
    page += 1

    # 23. QA
    page_header(c, "Проверка", page)
    y = title(c, "Финальный чеклист") - 24
    checks = [
        "1080x1920, корректная длительность и MP4 открывается на телефоне.",
        "Голос громче музыки и эффектов, нет клиппинга и обрезанных слов.",
        "Текст, лицо и интерфейс не выходят в опасные зоны Reels.",
        "Нет обрезанных объектов, чёрных кадров и скачков масштаба.",
        "Факты, названия и логотипы корректны.",
        "Финал совпадает с одобренной версией кадров.",
        "В FINAL-REPORT.md записаны источники и результаты проверки.",
    ]
    draw_bullets(c, checks, MARGIN, y, PAGE_W - 2 * MARGIN, size=11.2, gap=9)
    c.showPage()
    page += 1

    # 24. Mobile
    page_header(c, "Мобильный экран", page)
    y = title(c, "Кадр должен читаться на телефоне") - 28
    c.setStrokeColor(LINE)
    c.setLineWidth(1.4)
    c.roundRect(MARGIN, 135, 196, 480, 22, stroke=1, fill=0)
    c.setStrokeColor(ORANGE)
    c.setDash(4, 4)
    c.roundRect(MARGIN + 16, 190, 158, 368, 10, stroke=1, fill=0)
    c.setDash()
    c.setFont("MonoBold", 8)
    c.setFillColor(ORANGE)
    c.drawString(MARGIN + 33, 170, "SAFE CONTENT")
    right_x = MARGIN + 230
    draw_bullets(c, [
        "Не ставьте важный текст у правой рейки кнопок.",
        "Не прижимайте CTA к нижней подписи Reels.",
        "Лицо и субтитры должны иметь разные зоны.",
        "Проверяйте длинные слова и две строки на реальном размере.",
        "Смотрите финальный файл на телефоне, не только в Studio.",
    ], right_x, 592, PAGE_W - MARGIN - right_x, size=10.5, gap=11, accent=ORANGE)
    c.showPage()
    page += 1

    # 25. Pitfalls
    page_header(c, "Ошибки", page)
    y = title(c, "Пять причин дорогой переделки") - 26
    issues = [
        ("Сразу код", "Нет брифа и выбранного стиля."),
        ("Сделай как референс", "Непонятно, что именно нужно повторить."),
        ("Один шаблон", "Все сцены выглядят одинаково и не объясняют речь."),
        ("MP4 до кадров", "Правки приходят после тяжёлого рендера."),
        ("Только десктоп", "На телефоне текст и интерфейс перекрываются."),
    ]
    for head, body in issues:
        c.setFillColor(ORANGE)
        c.roundRect(MARGIN, y - 10, 10, 10, 2, stroke=0, fill=1)
        c.setFont("BodyBold", 12)
        c.setFillColor(INK)
        c.drawString(MARGIN + 22, y, head)
        c.setFont("Body", 10.5)
        c.setFillColor(MUTED)
        c.drawString(MARGIN + 170, y, body)
        c.setStrokeColor(LINE)
        c.line(MARGIN + 22, y - 19, PAGE_W - MARGIN, y - 19)
        y -= 66
    c.showPage()
    page += 1

    # 26. Prompt set
    page_header(c, "Шпаргалка", page)
    y = title(c, "Три сообщения на весь процесс") - 28
    prompts = [
        ("СТАРТ", "Прочитай AGENTS.md. Сначала интервью и выбор стиля. Финальный MP4 до одобрения кадров не создавай."),
        ("ПРАВКИ", "Исправь К003 и К006. Покажи обновлённые кадры. Остальные сцены не меняй."),
        ("ФИНАЛ", "Одобряю layout-v003. Запускай рендер и дай MP4 вместе с QA-отчётом."),
    ]
    for name, text in prompts:
        label(c, name, MARGIN, y, bg=LIME if name == "ФИНАЛ" else INK, fg=INK if name == "ФИНАЛ" else Color(1, 1, 1))
        y = draw_wrapped(c, text, MARGIN, y - 35, PAGE_W - 2 * MARGIN, font="BodyMedium", size=11.5, leading=16.5) - 31
        c.setStrokeColor(LINE)
        c.line(MARGIN, y + 12, PAGE_W - MARGIN, y + 12)
        y -= 16
    c.showPage()
    page += 1

    # 27. Finish
    c.setFillColor(PAPER)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    draw_logo(c, MARGIN, PAGE_H - 55, 1.15)
    label(c, "ГОТОВО К ПРАКТИКЕ", MARGIN, PAGE_H - 120, bg=LIME, fg=INK)
    draw_wrapped(c, "Следующий ролик начинается не с таймлайна. Он начинается с точного вопроса.", MARGIN, PAGE_H - 205, PAGE_W - 2 * MARGIN, font="Display", size=38, leading=39)
    draw_wrapped(c, "Клонируйте репозиторий, ответьте на интервью агента и согласуйте стиль. Дальше процесс уже разложен по файлам и контрольным точкам.", MARGIN, PAGE_H - 375, PAGE_W - 2 * MARGIN, font="SerifItalic", size=22, leading=28, color=MUTED)
    link(c, "github.com/saint4ai/reels-montage-remotion-course", "https://github.com/saint4ai/reels-montage-remotion-course", MARGIN, PAGE_H - 495, 10.5)
    c.setStrokeColor(LINE)
    c.line(MARGIN, 72, PAGE_W - MARGIN, 72)
    c.setFont("Mono", 8)
    c.setFillColor(MUTED)
    c.drawString(MARGIN, 48, "onAI Academy · Вайб-кодинг · Remotion")
    c.showPage()

    c.save()
    print(OUT)


if __name__ == "__main__":
    build()
