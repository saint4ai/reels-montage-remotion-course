from __future__ import annotations

from copy import deepcopy
from pathlib import Path
from typing import Sequence

from PIL import Image
from reportlab.graphics import renderPDF
from reportlab.lib.colors import Color, HexColor
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas
from svglib.svglib import svg2rlg


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf" / "onai-automontage-remotion-guide.pdf"
LOGO_PATH = ROOT / "public" / "onai-platform-logo.svg"

PAGE_W, PAGE_H = A4
MARGIN = 36
CONTENT_W = PAGE_W - MARGIN * 2

PAPER = HexColor("#FAFAFA")
WHITE = HexColor("#FFFFFF")
INK = HexColor("#0A0A0A")
MUTED = HexColor("#626262")
LINE = HexColor("#DEDEDA")
SOFT = HexColor("#F0F0EC")
LIME = HexColor("#C7FF1A")
ORANGE = HexColor("#FF5C1A")
GREEN = HexColor("#00FFB3")
BLUE = HexColor("#1A8CFF")

FONT_DIR = Path("/Users/miso/Library/Fonts")
FONTS = {
    "Display": FONT_DIR / "Benzin-ExtraBold.ttf",
    "Section": FONT_DIR / "JetBrainsMono-Variable.ttf",
    "Body": Path("/System/Library/Fonts/Supplemental/Arial.ttf"),
    "BodyBold": Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
    "SerifItalic": Path("/System/Library/Fonts/Supplemental/Georgia Italic.ttf"),
    "Mono": FONT_DIR / "JetBrainsMono-Variable.ttf",
    "MonoBold": FONT_DIR / "JetBrainsMono-Variable.ttf",
}

for name, path in FONTS.items():
    if not path.exists():
        raise FileNotFoundError(path)
    pdfmetrics.registerFont(TTFont(name, str(path)))

LOGO_DRAWING = svg2rlg(str(LOGO_PATH))
if LOGO_DRAWING is None:
    raise RuntimeError(f"Cannot load SVG logo: {LOGO_PATH}")


def text_width(text: str, font: str, size: float) -> float:
    return pdfmetrics.stringWidth(text, font, size)


def wrap(text: str, font: str, size: float, width: float) -> list[str]:
    lines: list[str] = []
    for paragraph in text.split("\n"):
        if not paragraph:
            lines.append("")
            continue
        current = ""
        for word in paragraph.split():
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
    size: float = 15,
    leading: float | None = None,
    color=INK,
) -> float:
    leading = leading or size * 1.32
    c.setFont(font, size)
    c.setFillColor(color)
    for line in wrap(text, font, size, width):
        c.drawString(x, y, line)
        y -= leading
    return y


def draw_logo(c: Canvas, x: float, y: float, width: float) -> float:
    drawing = deepcopy(LOGO_DRAWING)
    scale = width / drawing.width
    height = drawing.height * scale
    drawing.scale(scale, scale)
    renderPDF.draw(drawing, c, x, y)
    return height


def draw_grid(c: Canvas) -> None:
    c.setFillColor(PAPER)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    c.setFillColor(HexColor("#EAEAE6"))
    for x in range(18, int(PAGE_W), 28):
        for y in range(18, int(PAGE_H), 28):
            c.circle(x, y, 0.55, stroke=0, fill=1)


def page_base(c: Canvas, page: int, section: str) -> None:
    draw_grid(c)
    draw_logo(c, MARGIN, PAGE_H - 60, 146)
    c.setFont("MonoBold", 8.5)
    c.setFillColor(MUTED)
    c.drawRightString(PAGE_W - MARGIN, PAGE_H - 38, section.upper())
    c.setStrokeColor(LINE)
    c.setLineWidth(1)
    c.line(MARGIN, PAGE_H - 70, PAGE_W - MARGIN, PAGE_H - 70)
    c.setFillColor(INK)
    c.rect(MARGIN, 29, 62, 3, stroke=0, fill=1)
    c.setFont("Mono", 8.5)
    c.setFillColor(MUTED)
    c.drawString(MARGIN + 76, 25, "ВАЙБ-КОДИНГ / REMOTION")
    c.drawRightString(PAGE_W - MARGIN, 25, f"{page:02d}")


def pill(c: Canvas, text: str, x: float, y: float, *, bg=INK, fg=WHITE, size: float = 9) -> float:
    c.setFont("MonoBold", size)
    width = text_width(text, "MonoBold", size) + 24
    c.setFillColor(bg)
    c.roundRect(x, y - 9, width, 24, 5, stroke=0, fill=1)
    c.setFillColor(fg)
    c.drawString(x + 12, y - 1.5, text)
    return width


def page_title(c: Canvas, section: str, heading: str, *, subtitle: str | None = None, accent=LIME) -> float:
    pill(c, section.upper(), MARGIN, PAGE_H - 103, bg=accent, fg=INK)
    y = draw_wrapped(
        c,
        heading,
        MARGIN,
        PAGE_H - 150,
        CONTENT_W,
        font="Display",
        size=33,
        leading=37,
    )
    if subtitle:
        y -= 9
        y = draw_wrapped(
            c,
            subtitle,
            MARGIN,
            y,
            CONTENT_W,
            font="Section",
            size=13.5,
            leading=19,
            color=MUTED,
        )
    return y - 24


def panel(
    c: Canvas,
    x: float,
    y: float,
    w: float,
    h: float,
    *,
    fill=WHITE,
    stroke=LINE,
    radius: float = 12,
    line_width: float = 1.1,
) -> None:
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(line_width)
    c.roundRect(x, y, w, h, radius, stroke=1, fill=1)


def accent_number(c: Canvas, number: str, x: float, y: float, *, accent=LIME, size: float = 12) -> None:
    c.setFillColor(accent)
    c.roundRect(x, y, 42, 42, 9, stroke=0, fill=1)
    c.setFont("MonoBold", size)
    c.setFillColor(INK)
    c.drawCentredString(x + 21, y + 14, number)


def card_text(
    c: Canvas,
    x: float,
    y: float,
    w: float,
    h: float,
    head: str,
    body: str,
    *,
    number: str | None = None,
    accent=LIME,
    body_size: float = 13.5,
) -> None:
    panel(c, x, y, w, h)
    text_x = x + 18
    if number:
        accent_number(c, number, x + 18, y + h - 58, accent=accent)
        text_x = x + 76
    c.setFont("Section", 13.5)
    c.setFillColor(INK)
    c.drawString(text_x, y + h - 34, head)
    draw_wrapped(
        c,
        body,
        text_x,
        y + h - 61,
        w - (text_x - x) - 18,
        size=body_size,
        leading=body_size * 1.32,
        color=MUTED,
    )


def code_box(c: Canvas, lines: Sequence[str], x: float, top: float, w: float, h: float, *, size: float = 11.2) -> None:
    panel(c, x, top - h, w, h, fill=INK, stroke=INK, radius=14)
    c.setFillColor(GREEN)
    c.circle(x + 23, top - 23, 4, stroke=0, fill=1)
    c.setFillColor(ORANGE)
    c.circle(x + 38, top - 23, 4, stroke=0, fill=1)
    c.setFillColor(LIME)
    c.circle(x + 53, top - 23, 4, stroke=0, fill=1)
    y = top - 55
    for raw in lines:
        wrapped = wrap(raw, "Mono", size, w - 40) or [""]
        for line in wrapped:
            c.setFont("Mono", size)
            c.setFillColor(WHITE)
            c.drawString(x + 20, y, line)
            y -= size * 1.52


def draw_image_fit(c: Canvas, path: Path, x: float, y: float, w: float, h: float) -> None:
    with Image.open(path) as image:
        iw, ih = image.size
    scale = min(w / iw, h / ih)
    dw, dh = iw * scale, ih * scale
    c.drawImage(str(path), x + (w - dw) / 2, y + (h - dh) / 2, width=dw, height=dh, mask="auto")


def linked_text(c: Canvas, text: str, url: str, x: float, y: float, *, size: float = 13) -> None:
    c.setFont("BodyBold", size)
    c.setFillColor(BLUE)
    c.drawString(x, y, text)
    width = text_width(text, "BodyBold", size)
    c.setStrokeColor(BLUE)
    c.setLineWidth(1)
    c.line(x, y - 3, x + width, y - 3)
    c.linkURL(url, (x, y - 5, x + width, y + size + 3), relative=0)


def rows(
    c: Canvas,
    items: Sequence[str],
    top: float,
    bottom: float,
    *,
    accent=LIME,
    columns: int = 1,
    size: float = 14,
) -> None:
    gap = 12
    col_w = (CONTENT_W - gap * (columns - 1)) / columns
    row_count = (len(items) + columns - 1) // columns
    row_h = (top - bottom - gap * (row_count - 1)) / row_count
    for idx, item in enumerate(items):
        col = idx % columns
        row = idx // columns
        x = MARGIN + col * (col_w + gap)
        y = top - (row + 1) * row_h - row * gap
        panel(c, x, y, col_w, row_h)
        c.setFillColor(accent)
        c.roundRect(x + 16, y + row_h - 38, 15, 15, 4, stroke=0, fill=1)
        draw_wrapped(c, item, x + 43, y + row_h - 24, col_w - 59, font="BodyBold", size=size, leading=size * 1.27)


def detail_rows(
    c: Canvas,
    items: Sequence[tuple[str, str]],
    top: float,
    bottom: float,
    *,
    accent=LIME,
    columns: int = 2,
) -> None:
    gap = 12
    col_w = (CONTENT_W - gap * (columns - 1)) / columns
    row_count = (len(items) + columns - 1) // columns
    row_h = (top - bottom - gap * (row_count - 1)) / row_count
    for idx, (head, body) in enumerate(items):
        col = idx % columns
        row = idx // columns
        x = MARGIN + col * (col_w + gap)
        y = top - (row + 1) * row_h - row * gap
        panel(c, x, y, col_w, row_h)
        c.setFillColor(accent)
        c.roundRect(x + 16, y + row_h - 38, 15, 15, 4, stroke=0, fill=1)
        head_y = draw_wrapped(c, head, x + 43, y + row_h - 24, col_w - 59, font="Section", size=11.5, leading=15)
        draw_wrapped(c, body, x + 43, head_y - 8, col_w - 59, size=11.2, leading=14.5, color=MUTED)


def finish_page(c: Canvas) -> None:
    c.showPage()


def build() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    c = Canvas(str(OUT), pagesize=A4, pageCompression=1)
    c.setTitle("Автомонтаж Reels с AI и Remotion - onAI Academy")
    c.setAuthor("onAI Academy")
    c.setSubject("Пошаговый гайд по работе с учебным Remotion-репозиторием")

    page = 1

    # 01. Cover
    draw_grid(c)
    draw_logo(c, MARGIN, PAGE_H - 104, 250)
    pill(c, "МОДУЛЬ 10", MARGIN, PAGE_H - 143, bg=INK)
    draw_wrapped(c, "Автомонтаж\nReels с AI\nи Remotion", MARGIN, PAGE_H - 205, CONTENT_W, font="Display", size=43, leading=49)
    c.setFillColor(LIME)
    c.rect(MARGIN, 407, 280, 14, stroke=0, fill=1)
    draw_wrapped(c, "От точного брифа до готового вертикального видео", MARGIN, 365, CONTENT_W - 60, font="SerifItalic", size=25, leading=30, color=MUTED)
    steps = [("01", "выбрать стиль"), ("02", "собрать кадры"), ("03", "одобрить рендер")]
    card_w = (CONTENT_W - 20) / 3
    for idx, (num, label_text) in enumerate(steps):
        x = MARGIN + idx * (card_w + 10)
        panel(c, x, 92, card_w, 150, fill=WHITE, stroke=INK, radius=12, line_width=1.5)
        c.setFont("Display", 31)
        c.setFillColor(ORANGE if idx == 1 else INK)
        c.drawString(x + 16, 184, num)
        draw_wrapped(c, label_text, x + 16, 142, card_w - 32, font="BodyBold", size=14, leading=18)
    c.setFont("Mono", 9)
    c.setFillColor(MUTED)
    c.drawString(MARGIN, 46, "onAI Academy / 2026")
    finish_page(c)
    page += 1

    # 02. Result
    page_base(c, page, "Результат")
    y = page_title(c, "После прохождения", "Не монтажёр. Режиссёр AI-агента.", subtitle="Вы управляете смыслом и качеством, а код и рендер выполняет агент.")
    cards = [
        ("01", "Готовая среда", "Remotion-проект с восемью стилями, проверкой окружения и понятной структурой файлов."),
        ("02", "Повторяемый процесс", "Интервью, референсы, research, сториборд, сборка, кадры, правки и только потом MP4."),
        ("03", "Контроль качества", "Каждая правка привязана к номеру кадра. Финал совпадает с одобренной версией."),
    ]
    h = 145
    for idx, (num, head, body) in enumerate(cards):
        card_text(c, MARGIN, y - h, CONTENT_W, h, head, body, number=num, accent=LIME if idx != 1 else ORANGE, body_size=15)
        y -= h + 14
    finish_page(c)
    page += 1

    # 03. Workflow
    page_base(c, page, "Карта процесса")
    y = page_title(c, "8 состояний", "Агент не прыгает к коду. Он проходит процесс по контрольным точкам.")
    states = [
        ("01", "INTAKE", "вопросы"), ("02", "STYLE", "выбор языка"),
        ("03", "RESEARCH", "проверка фактов"), ("04", "STORYBOARD", "сцены по речи"),
        ("05", "BUILD", "сборка"), ("06", "FRAMES", "кадры на ревью"),
        ("07", "RENDER", "финальный MP4"), ("08", "QA", "видео и звук"),
    ]
    gap = 12
    col_w = (CONTENT_W - gap) / 2
    card_h = 105
    for idx, (num, head, desc) in enumerate(states):
        col, row = idx % 2, idx // 2
        x = MARGIN + col * (col_w + gap)
        cy = y - (row + 1) * card_h - row * gap
        accent = ORANGE if num in ("01", "06") else LIME
        panel(c, x, cy, col_w, card_h, fill=WHITE)
        accent_number(c, num, x + 15, cy + card_h - 57, accent=accent, size=10)
        c.setFont("Section", 12.5)
        c.setFillColor(INK)
        c.drawString(x + 70, cy + card_h - 31, head)
        c.setFont("Body", 13.5)
        c.setFillColor(MUTED)
        c.drawString(x + 70, cy + card_h - 57, desc)
    c.setFillColor(INK)
    c.roundRect(MARGIN, 60, CONTENT_W, 70, 12, stroke=0, fill=1)
    c.setFillColor(LIME)
    c.rect(MARGIN, 60, 10, 70, stroke=0, fill=1)
    draw_wrapped(c, "СТОП: полный MP4 создаётся только после явного одобрения кадров.", MARGIN + 28, 103, CONTENT_W - 48, font="BodyBold", size=15, leading=20, color=WHITE)
    finish_page(c)
    page += 1

    # 04. Clone
    page_base(c, page, "Старт")
    y = page_title(c, "Одна ссылка. Одно сообщение.", "AGENTS.md уже знает порядок вопросов и точку остановки перед рендером.")
    code_box(c, [
        "Клонируй репозиторий:",
        "github.com/saint4ai/reels-montage-remotion-course",
        "",
        "Прочитай AGENTS.md и проведи меня по процессу.",
        "Сначала задай вопросы и покажи восемь стилей.",
        "Не создавай MP4 до моего одобрения кадров.",
    ], MARGIN, y, CONTENT_W, 285, size=11.3)
    linked_text(c, "Открыть учебный репозиторий", "https://github.com/saint4ai/reels-montage-remotion-course", MARGIN, y - 325, size=14)
    panel(c, MARGIN, 64, CONTENT_W, 120, fill=ORANGE, stroke=ORANGE)
    pill(c, "ЕСЛИ АГЕНТ ПИШЕТ КОД", MARGIN + 18, 151, bg=INK)
    draw_wrapped(c, "Остановите: «Сначала интервью и выбор стиля». Эта фраза экономит часы переделки.", MARGIN + 18, 116, CONTENT_W - 36, font="BodyBold", size=16, leading=21, color=WHITE)
    finish_page(c)
    page += 1

    # 05. Interview
    page_base(c, page, "Интервью")
    y = page_title(c, "8 вопросов до монтажа", "Отвечайте простыми словами. Технические решения принимает агент.")
    questions = [
        "Что делаем: Reels, YouTube-фрагмент, подкаст, экран или ролик без спикера?",
        "Где исходник и сколько он длится?",
        "Какая тема и одно действие зрителя после просмотра?",
        "Какая площадка и целевая длительность?",
        "Язык речи и нужны ли субтитры?",
        "Какие 2-5 референсов нравятся и чем именно?",
        "Какие логотипы, цвета, шрифты и скриншоты обязательны?",
        "Какой стиль из восьми подходит задаче? Покажи общую доску и предложи два варианта.",
    ]
    gap = 10
    col_w = (CONTENT_W - gap) / 2
    card_h = 113
    for idx, question in enumerate(questions):
        col, row = idx % 2, idx // 2
        x = MARGIN + col * (col_w + gap)
        cy = y - (row + 1) * card_h - row * gap
        panel(c, x, cy, col_w, card_h)
        c.setFont("MonoBold", 9)
        c.setFillColor(ORANGE if idx in (0, 7) else MUTED)
        c.drawString(x + 16, cy + card_h - 25, f"0{idx + 1}")
        draw_wrapped(c, question, x + 16, cy + card_h - 52, col_w - 32, font="BodyBold", size=13.2, leading=16.5)
    finish_page(c)
    page += 1

    # 06. Source types
    page_base(c, page, "Исходник")
    y = page_title(c, "Из чего можно собрать Reels", "Сначала определить тип исходника. Потом выбирать механику монтажа.")
    source_cards = [
        ("YOUTUBE", "Выбрать 3 сильных фрагмента и монтировать только одобренный."),
        ("ПОДКАСТ", "Найти законченную мысль, убрать повторы, сохранить естественную речь."),
        ("TALKING HEAD", "Синхронизировать графику с фразами и держать лицо в свободной зоне."),
        ("ЗАПИСЬ ЭКРАНА", "Показывать действие крупно, без случайных увеличений интерфейса."),
        ("ТЕКСТ + ГОЛОС", "Собрать сцены с нуля, оставляя одну мысль на сцену."),
        ("СКРИНШОТЫ", "Задать порядок, акценты и переходы между состояниями."),
    ]
    gap = 12
    col_w = (CONTENT_W - gap) / 2
    card_h = 150
    for idx, (head, body) in enumerate(source_cards):
        col, row = idx % 2, idx // 2
        x = MARGIN + col * (col_w + gap)
        cy = y - (row + 1) * card_h - row * gap
        panel(c, x, cy, col_w, card_h, fill=WHITE, stroke=INK if idx == 0 else LINE)
        pill(c, head, x + 16, cy + card_h - 33, bg=LIME if idx % 2 == 0 else ORANGE, fg=INK)
        draw_wrapped(c, body, x + 16, cy + card_h - 76, col_w - 32, font="BodyBold", size=14.2, leading=18)
    finish_page(c)
    page += 1

    # 07. Styles overview
    page_base(c, page, "Стили")
    y = page_title(c, "Выберите визуальную механику", "Не «сделай красиво», а конкретный язык движения и композиции.")
    panel(c, MARGIN, 58, CONTENT_W, y - 70, fill=INK, stroke=INK, radius=15)
    draw_image_fit(c, ROOT / "public" / "style-previews" / "eight-styles.png", MARGIN + 18, 74, CONTENT_W - 36, y - 102)
    finish_page(c)
    page += 1

    # 08-15. Style pages
    style_pages = [
        ("PRISM", "Светлый интерфейс", "01-prism.png", LIME, "ПРОДУКТ / АВТОМАТИЗАЦИЯ", ["Контент превращается в интерфейс", "Чистый фон и ясный результат", "Стекло только там, где оно помогает", "Лучше для продуктовых разборов"]),
        ("ORBIT", "Глубина и связи", "02-orbit.png", ORANGE, "СИСТЕМЫ / ТЕХНОЛОГИИ", ["Объекты сохраняют глубину", "Параллакс работает постоянно", "Связи важнее декора", "Космос сам по себе не делает ORBIT"]),
        ("TRACE", "Сетка и логика", "03-trace.png", LIME, "ОБУЧЕНИЕ / АУДИТ", ["Линия показывает причинность", "Крупные числа и прогресс", "Короткий проверяемый текст", "Лучше для чеклистов и инструкций"]),
        ("PULSE", "Голос и предмет", "04-pulse.png", ORANGE, "ЭНЕРГИЯ / МЕТАФОРА", ["Крупный предмет отвечает на фразу", "Портрет работает как рассказчик", "Ритм строится вокруг голоса", "Статус: экспериментальный стиль"]),
        ("EXPERT GLASS", "Спикер и платиновое стекло", "05-expert-glass.png", ORANGE, "ЭКСПЕРТ / ПРОДАЖИ", ["Портрет постоянно виден в отдельном окне", "Стекло имеет кромку, плотность и свет", "Крупные схемы живут в safe-зоне", "Фоны меняются по смысловым главам"]),
        ("SQUARE", "Квадраты и жёсткий ритм", "06-square.png", LIME, "LISTICLE / РЕКЛАМА", ["Dot-grid держит модульную композицию", "Benzin работает в крупном H1", "Квадраты отделяют тезисы", "Лайм и оранжевый кодируют смысл"]),
        ("APPLE DEF", "Продуктовая глубина", "07-apple-def.png", BLUE, "ЗАПУСК / ТЕХНОЛОГИЯ", ["Один световой объект ведёт сцену", "Много отрицательного пространства", "Медленный controlled reveal", "Не подменять обычным градиентом"]),
        ("PODCAST", "Лицо, цитата и waveform", "08-podcast.png", ORANGE, "ИНТЕРВЬЮ / ПОДКАСТ", ["Сначала выбирается законченная мысль", "Крупная цитата не дублирует субтитры", "Лицо получает отдельную safe-зону", "B-roll появляется только по смыслу"]),
    ]
    for name, subtitle, filename, accent, use_for, bullets in style_pages:
        page_base(c, page, f"Стиль {name}")
        pill(c, use_for, MARGIN, PAGE_H - 103, bg=accent, fg=INK)
        draw_wrapped(c, name, MARGIN, PAGE_H - 155, 255, font="Display", size=35, leading=40)
        draw_wrapped(c, subtitle, MARGIN, PAGE_H - 207, 255, font="Section", size=12.5, leading=17, color=MUTED)
        panel(c, MARGIN, 73, 230, 505, fill=INK, stroke=INK, radius=15)
        draw_image_fit(c, ROOT / "public" / "style-previews" / filename, MARGIN + 13, 86, 204, 479)
        right_x = MARGIN + 248
        right_w = CONTENT_W - 248
        card_h = 111
        for idx, item in enumerate(bullets):
            cy = 73 + (3 - idx) * (card_h + 12)
            panel(c, right_x, cy, right_w, card_h, fill=WHITE)
            c.setFillColor(accent)
            c.rect(right_x, cy, 8, card_h, stroke=0, fill=1)
            c.setFont("MonoBold", 9)
            c.setFillColor(MUTED)
            c.drawString(right_x + 22, cy + card_h - 25, f"0{idx + 1}")
            draw_wrapped(c, item, right_x + 22, cy + card_h - 52, right_w - 40, font="BodyBold", size=14, leading=18)
        finish_page(c)
        page += 1

    # 12. Reference profile
    page_base(c, page, "Референсы")
    y = page_title(c, "Как «дообучить» агента", "Fine-tuning не нужен. Нужен проверяемый профиль референсов.", accent=ORANGE)
    reference_steps = [
        "Соберите 2-5 референсов: ритм, композиция, типографика.",
        "Для каждого укажите, что нравится: пауза, крупность, движение, цвет или роль спикера.",
        "Агент фиксирует темп, переходы, звук и правила «оставить / избегать».",
        "Попросите пересказать профиль пятью правилами до кода.",
        "Проверяйте усвоение по кадрам, а не по обещаниям в чате.",
    ]
    rows(c, reference_steps, y, 83, accent=ORANGE, columns=1, size=14.5)
    finish_page(c)
    page += 1

    # 13. Reference prompt
    page_base(c, page, "Референсы")
    y = page_title(c, "Промпт для разбора стиля", "Он отделяет механику референса от буквального копирования.")
    code_box(c, [
        "Изучи приложенные референсы. Не копируй буквально.",
        "Составь профиль: темп, композиция, типографика,",
        "переходы, звук, положение спикера, что оставить",
        "и чего избегать.",
        "Перескажи профиль пятью правилами и дождись",
        "моего подтверждения.",
    ], MARGIN, y, CONTENT_W, 270, size=11.1)
    compare_y = 72
    compare_h = 145
    col_w = (CONTENT_W - 12) / 2
    card_text(c, MARGIN, compare_y, col_w, compare_h, "ПЛОХО", "«Сделай так же». Непонятно, что именно ценно.", accent=ORANGE, body_size=14.5)
    card_text(c, MARGIN + col_w + 12, compare_y, col_w, compare_h, "ХОРОШО", "«Сохрани ритм и роль портрета, но используй наш светлый фон». ", accent=LIME, body_size=14.5)
    finish_page(c)
    page += 1

    # 14. Research
    page_base(c, page, "Тема")
    y = page_title(c, "Когда нужен research", "Исследование должно укрепить одну мысль, а не превратить Reels в отчёт.")
    col_w = (CONTENT_W - 12) / 2
    card_text(c, MARGIN, y - 175, col_w, 175, "НУЖЕН", "Тема актуальная, спорная, зависит от цен, функций, интерфейсов или свежих данных.", number="YES", accent=LIME, body_size=14)
    card_text(c, MARGIN + col_w + 12, y - 175, col_w, 175, "НЕ НУЖЕН", "Есть готовый текст, проверенные факты и понятный тезис. Можно идти к сториборду.", number="NO", accent=ORANGE, body_size=14)
    checklist = [
        ("Первичные источники", "Документация, сайт продукта или официальный аккаунт."),
        ("Одна главная мысль", "Фраза, которую зритель сможет повторить после ролика."),
        ("1-3 доказательства", "Только факты, которые реально появятся в кадре."),
        ("Ссылки в research.md", "Каждый проверяемый тезис сохраняется вместе с источником."),
    ]
    detail_rows(c, checklist, y - 197, 71, accent=LIME, columns=2)
    finish_page(c)
    page += 1

    # 15. Script
    page_base(c, page, "Сценарий")
    y = page_title(c, "Каркас короткого ролика", "Каждый блок выполняет одну функцию и двигает зрителя вперёд.")
    script_blocks = [
        ("0-3 СЕК", "ХУК", "Проблема или обещание результата без вступления."),
        ("3-12 СЕК", "КОНТЕКСТ", "Что происходит и почему стоит досмотреть."),
        ("12-35 СЕК", "МЕХАНИКА", "Процесс через действия, объекты и интерфейсы."),
        ("35-50 СЕК", "РЕЗУЛЬТАТ", "Что изменилось после действия."),
        ("ФИНАЛ", "CTA", "Одно понятное следующее действие."),
    ]
    row_h = 91
    for idx, (timing, head, desc) in enumerate(script_blocks):
        cy = y - (idx + 1) * row_h - idx * 10
        panel(c, MARGIN, cy, CONTENT_W, row_h, fill=WHITE, stroke=INK if idx == 0 else LINE)
        pill(c, timing, MARGIN + 14, cy + row_h - 31, bg=ORANGE if idx in (0, 4) else INK)
        c.setFont("Section", 12.5)
        c.setFillColor(INK)
        c.drawString(MARGIN + 135, cy + row_h - 28, head)
        draw_wrapped(c, desc, MARGIN + 135, cy + row_h - 56, CONTENT_W - 157, size=13.5, leading=17, color=MUTED)
    finish_page(c)
    page += 1

    # 16. Storyboard
    page_base(c, page, "Сториборд")
    y = page_title(c, "Что согласовать до сборки", "Смысл в JSON исправляется быстрее, чем уже закодированная анимация.")
    storyboard_items = [
        ("Границы сцен по речи", "Начало и конец привязаны к конкретным словам."),
        ("Текст на экране", "Короткая формулировка и отдельный текст субтитров."),
        ("Механика движения", "Появление, перестройка, сравнение или демонстрация."),
        ("Источники ассетов", "Путь к файлу, автор и статус лицензии."),
        ("Зоны лица и субтитров", "Элементы не конкурируют и не перекрывают интерфейс."),
        ("Недостающие файлы", "Список запрашивается до тяжёлой сборки."),
    ]
    detail_rows(c, storyboard_items, y, 82, accent=LIME, columns=2)
    finish_page(c)
    page += 1

    # 17. Files
    page_base(c, page, "Файлы")
    y = page_title(c, "Структура без хаоса", "Исходники, решения и результаты лежат в предсказуемых местах.")
    code_box(c, [
        "public/input/",
        "  source.mp4       исходное видео",
        "  voice.wav        отдельная озвучка",
        "  logo.svg         логотип",
        "  product-01.png   скриншот продукта",
        "  reference-01.jpg референс",
        "",
        "project/project.json  тема, стиль, текст, тайминги",
        "work/<slug>/           brief, research, storyboard",
    ], MARGIN, y, CONTENT_W, 310, size=10.8)
    rules_y = 70
    rules = ["Латиница без пробелов", "Секреты не в public/", "Оригиналы отдельно"]
    card_w = (CONTENT_W - 20) / 3
    for idx, rule in enumerate(rules):
        x = MARGIN + idx * (card_w + 10)
        panel(c, x, rules_y, card_w, 118, fill=LIME if idx == 0 else WHITE, stroke=INK)
        c.setFont("MonoBold", 10)
        c.setFillColor(INK)
        c.drawString(x + 14, rules_y + 87, f"0{idx + 1}")
        draw_wrapped(c, rule, x + 14, rules_y + 56, card_w - 28, font="BodyBold", size=14, leading=18)
    finish_page(c)
    page += 1

    # 18. Install
    page_base(c, page, "Установка")
    y = page_title(c, "4 шага до Studio", "Агент проверяет окружение до того, как начинает собирать ролик.")
    install_steps = [
        ("01", "КЛОНИРОВАТЬ", "git clone ...remotion-course.git"),
        ("02", "УСТАНОВИТЬ", "npm install"),
        ("03", "ПРОВЕРИТЬ", "npm run doctor"),
        ("04", "ОТКРЫТЬ", "npm run studio"),
    ]
    card_h = 114
    for idx, (num, head, command) in enumerate(install_steps):
        cy = y - (idx + 1) * card_h - idx * 12
        panel(c, MARGIN, cy, CONTENT_W, card_h, fill=INK if idx == 3 else WHITE, stroke=INK)
        accent_number(c, num, MARGIN + 18, cy + 36, accent=LIME if idx != 2 else ORANGE)
        c.setFont("Section", 13)
        c.setFillColor(WHITE if idx == 3 else INK)
        c.drawString(MARGIN + 82, cy + 70, head)
        c.setFont("Mono", 12)
        c.setFillColor(GREEN if idx == 3 else MUTED)
        c.drawString(MARGIN + 82, cy + 39, command)
    finish_page(c)
    page += 1

    # 19. Studio
    page_base(c, page, "Remotion Studio")
    y = page_title(c, "Что смотреть в предпросмотре", "Studio ускоряет проверку, но не заменяет кадры согласования.")
    studio_checks = [
        ("Сцены попадают в нужные слова", "Смена кадра поддерживает смысл фразы."),
        ("Заголовок читается сразу", "Нет случайного переноса или мелкого кегля."),
        ("Портрет не прыгает", "Масштаб и позиция связаны между сценами."),
        ("Скриншот показывает действие", "В кадре виден нужный элемент интерфейса."),
        ("Субтитры не длиннее 2 строк", "Фраза читается без остановки видео."),
        ("Начало и финал осознанны", "Нет чёрного кадра или случайной обрезки."),
    ]
    detail_rows(c, studio_checks, y, 82, accent=ORANGE, columns=2)
    finish_page(c)
    page += 1

    # 20. Frames
    page_base(c, page, "Согласование")
    y = page_title(c, "Кадры каждые 2 секунды", "Сначала дешёвая статичная проверка. Потом дорогой полный рендер.")
    code_box(c, [
        "npm run frames",
        "",
        "reviews/layout-v001/K001-0-00s.png",
        "reviews/layout-v001/K002-2-00s.png",
        "reviews/layout-v001/K003-4-00s.png",
        "reviews/layout-v001/manifest.json",
    ], MARGIN, y, CONTENT_W, 235, size=11.2)
    principles = [
        "Номер + таймкод", "Все кадры одним набором", "Спорные переходы - тремя фазами", "Статус: AWAITING_FRAME_APPROVAL",
    ]
    rows(c, principles, y - 255, 70, accent=LIME, columns=2, size=13.8)
    finish_page(c)
    page += 1

    # 21. Feedback
    page_base(c, page, "Правки")
    y = page_title(c, "Правьте по номеру кадра", "Так вкус превращается в конкретное техническое действие.")
    code_box(c, [
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
    ], MARGIN, y, CONTENT_W, 335, size=10.7)
    panel(c, MARGIN, 72, CONTENT_W, 120, fill=LIME, stroke=INK)
    draw_wrapped(c, "Нумерация отделяет точную правку от фразы «что-то не так».", MARGIN + 20, 142, CONTENT_W - 40, font="SerifItalic", size=21, leading=26, color=INK)
    finish_page(c)
    page += 1

    # 22. Render
    page_base(c, page, "Рендер")
    y = page_title(c, "MP4 только после одобрения", "Команда запускается после точной фразы о принятой версии кадров.")
    panel(c, MARGIN, y - 145, CONTENT_W, 145, fill=LIME, stroke=INK, line_width=1.4)
    pill(c, "ОДОБРЕНО", MARGIN + 18, y - 34, bg=INK)
    draw_wrapped(c, "«Одобряю кадры версии layout-v003. Запускай финальный рендер и QA». ", MARGIN + 18, y - 72, CONTENT_W - 36, font="BodyBold", size=16, leading=21)
    code_box(c, ["npm run render", "", "Результат: out/reel.mp4"], MARGIN, y - 173, CONTENT_W, 150, size=12)
    panel(c, MARGIN, 73, CONTENT_W, 117, fill=ORANGE, stroke=ORANGE)
    pill(c, "НЕ РАНЬШЕ", MARGIN + 18, 157, bg=INK)
    draw_wrapped(c, "Рендер до согласования тратит время и делает каждую правку дороже.", MARGIN + 18, 120, CONTENT_W - 36, font="BodyBold", size=15.5, leading=20, color=WHITE)
    finish_page(c)
    page += 1

    # 23. QA
    page_base(c, page, "Проверка")
    y = page_title(c, "Финальный QA", "Видео готово только тогда, когда проходит все семь пунктов.")
    qa = [
        ("1080x1920, длительность верная", "Проверены метаданные и последний кадр."),
        ("MP4 открывается на телефоне", "Просмотрен целиком в мобильном плеере."),
        ("Голос громче музыки", "Речь понятна без наушников."),
        ("Нет клиппинга и обрезанных слов", "Начало и конец фраз звучат полностью."),
        ("Текст и лицо в safe zone", "Интерфейс Reels ничего не закрывает."),
        ("Нет чёрных кадров и скачков", "Переходы просмотрены в реальном времени."),
        ("Финал совпадает с кадрами", "Нет несогласованных изменений после ревью."),
        ("Источники в FINAL-REPORT.md", "Ссылки и результаты проверки сохранены."),
    ]
    detail_rows(c, qa, y, 75, accent=LIME, columns=2)
    finish_page(c)
    page += 1

    # 24. Mobile
    page_base(c, page, "Мобильный экран")
    y = page_title(c, "Кадр читается на телефоне", "Проверяйте реальный размер, а не только большое окно Studio.")
    phone_x, phone_y, phone_w, phone_h = MARGIN, 78, 218, 475
    c.setFillColor(WHITE)
    c.setStrokeColor(INK)
    c.setLineWidth(2)
    c.roundRect(phone_x, phone_y, phone_w, phone_h, 28, stroke=1, fill=1)
    c.setStrokeColor(ORANGE)
    c.setLineWidth(2)
    c.setDash(6, 5)
    c.roundRect(phone_x + 18, phone_y + 58, phone_w - 36, phone_h - 118, 13, stroke=1, fill=0)
    c.setDash()
    pill(c, "SAFE CONTENT", phone_x + 39, phone_y + 36, bg=ORANGE)
    right_x = MARGIN + 240
    checks = [
        "Не ставить текст у правой рейки кнопок.",
        "Не прижимать CTA к нижней подписи.",
        "Развести лицо и субтитры по зонам.",
        "Проверить длинные слова и 2 строки.",
        "Посмотреть финальный файл на телефоне.",
    ]
    top = phone_y + phone_h
    card_h = 82
    for idx, item in enumerate(checks):
        cy = top - (idx + 1) * card_h - idx * 12
        panel(c, right_x, cy, PAGE_W - MARGIN - right_x, card_h, fill=WHITE)
        c.setFillColor(ORANGE)
        c.roundRect(right_x + 14, cy + card_h - 31, 14, 14, 4, stroke=0, fill=1)
        draw_wrapped(c, item, right_x + 40, cy + card_h - 21, PAGE_W - MARGIN - right_x - 54, font="BodyBold", size=12.5, leading=16)
    finish_page(c)
    page += 1

    # 25. Pitfalls
    page_base(c, page, "Ошибки")
    y = page_title(c, "5 причин дорогой переделки", "У каждой ошибки есть понятный момент, где её можно остановить.", accent=ORANGE)
    issues = [
        ("СРАЗУ КОД", "Нет брифа и выбранного стиля."),
        ("КАК РЕФЕРЕНС", "Непонятно, что именно нужно повторить."),
        ("ОДИН ШАБЛОН", "Сцены одинаковы и не объясняют речь."),
        ("MP4 ДО КАДРОВ", "Правки приходят после тяжёлого рендера."),
        ("ТОЛЬКО ДЕСКТОП", "На телефоне элементы перекрываются."),
    ]
    row_h = 86
    for idx, (head, body) in enumerate(issues):
        cy = y - (idx + 1) * row_h - idx * 8
        panel(c, MARGIN, cy, CONTENT_W, row_h, fill=WHITE, stroke=ORANGE if idx in (0, 3) else LINE)
        pill(c, f"0{idx + 1}", MARGIN + 15, cy + row_h - 31, bg=ORANGE, fg=WHITE)
        c.setFont("Section", 12.5)
        c.setFillColor(INK)
        c.drawString(MARGIN + 78, cy + row_h - 27, head)
        c.setFont("Body", 14)
        c.setFillColor(MUTED)
        c.drawString(MARGIN + 78, cy + 30, body)
    finish_page(c)
    page += 1

    # 26. Prompts
    page_base(c, page, "Шпаргалка")
    y = page_title(c, "3 сообщения на весь процесс", "Сохраните их. Этого достаточно, чтобы удержать агента в правильном пайплайне.")
    prompts = [
        ("СТАРТ", "Прочитай AGENTS.md. Сначала интервью и выбор стиля. MP4 до одобрения кадров не создавай."),
        ("ПРАВКИ", "Исправь К003 и К006. Покажи обновлённые кадры. Остальные сцены не меняй."),
        ("ФИНАЛ", "Одобряю layout-v003. Запускай рендер и дай MP4 вместе с QA-отчётом."),
    ]
    card_h = 142
    for idx, (head, body) in enumerate(prompts):
        cy = y - (idx + 1) * card_h - idx * 14
        fill = LIME if idx == 2 else WHITE
        panel(c, MARGIN, cy, CONTENT_W, card_h, fill=fill, stroke=INK, line_width=1.4)
        pill(c, head, MARGIN + 18, cy + card_h - 34, bg=INK)
        draw_wrapped(c, body, MARGIN + 18, cy + card_h - 75, CONTENT_W - 36, font="BodyBold", size=15.5, leading=21)
    finish_page(c)
    page += 1

    # 27. Finish
    draw_grid(c)
    draw_logo(c, MARGIN, PAGE_H - 111, 280)
    pill(c, "ГОТОВО К ПРАКТИКЕ", MARGIN, PAGE_H - 150, bg=LIME, fg=INK)
    draw_wrapped(c, "Следующий ролик начинается не с таймлайна.", MARGIN, PAGE_H - 220, CONTENT_W, font="Display", size=48, leading=47)
    c.setFillColor(ORANGE)
    c.rect(MARGIN, 460, CONTENT_W, 14, stroke=0, fill=1)
    draw_wrapped(c, "Он начинается с точного вопроса.", MARGIN, 425, CONTENT_W, font="SerifItalic", size=31, leading=36, color=MUTED)
    panel(c, MARGIN, 160, CONTENT_W, 180, fill=INK, stroke=INK, radius=16)
    pill(c, "01 / CLONE", MARGIN + 20, 301, bg=GREEN, fg=INK)
    draw_wrapped(c, "Клонируйте репозиторий, ответьте на интервью агента и согласуйте стиль.", MARGIN + 20, 260, CONTENT_W - 40, font="BodyBold", size=17, leading=23, color=WHITE)
    linked_text(c, "github.com/saint4ai/reels-montage-remotion-course", "https://github.com/saint4ai/reels-montage-remotion-course", MARGIN + 20, 188, size=12.5)
    c.setFont("Mono", 9)
    c.setFillColor(MUTED)
    c.drawString(MARGIN, 65, "onAI Academy / Вайб-кодинг / Remotion")
    finish_page(c)

    c.save()
    print(OUT)


if __name__ == "__main__":
    build()
