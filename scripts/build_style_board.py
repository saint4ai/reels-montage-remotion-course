from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
PREVIEWS = ROOT / "public" / "style-previews"
FONT_DIR = Path("/Users/miso/Library/Fonts")

STYLES = [
    ("PRISM", "ПРОДУКТ / UI", "01-prism.png", "prism"),
    ("ORBIT", "СИСТЕМЫ / СВЯЗИ", "02-orbit.png", "orbit"),
    ("TRACE", "ОБУЧЕНИЕ / ЛОГИКА", "03-trace.png", "trace"),
    ("PULSE", "ГОЛОС / МЕТАФОРА", "04-pulse.png", "pulse"),
    ("EXPERT GLASS", "ЭКСПЕРТ / ПРОДАЖИ", "05-expert-glass.png", "expert-glass"),
    ("SQUARE", "LISTICLE / РЕКЛАМА", "06-square.png", "square"),
    ("APPLE DEF", "ЗАПУСК / ТЕХНОЛОГИЯ", "07-apple-def.png", "apple-def"),
    ("PODCAST", "ИНТЕРВЬЮ / НАРЕЗКА", "08-podcast.png", "podcast"),
]


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_DIR / name), size)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build() -> None:
    width, height = 1032, 1928
    image = Image.new("RGB", (width, height), "#090909")
    draw = ImageDraw.Draw(image)
    display = font("Benzin-ExtraBold.ttf", 44)
    display_small = font("Benzin-Bold.ttf", 25)
    mono = font("JetBrainsMono-Bold.otf", 16)
    mono_small = font("JetBrainsMono-Medium.otf", 13)

    draw.text((40, 34), "8 СТИЛЕЙ МОНТАЖА", font=display, fill="#FAFAFA")
    draw.text((42, 94), "REMOTION / ONAI ACADEMY", font=mono, fill="#00FFB3")

    cell_w, cell_h = 472, 424
    start_y = 150
    gap_x, gap_y = 16, 20
    accents = ["#C7FF1A", "#FF5C1A"]

    for index, (name, use_for, filename, _slug) in enumerate(STYLES):
        col, row = index % 2, index // 2
        x = 36 + col * (cell_w + gap_x)
        y = start_y + row * (cell_h + gap_y)
        accent = accents[index % 2]
        draw.rounded_rectangle((x, y, x + cell_w, y + cell_h), radius=20, fill="#111111", outline="#343434", width=2)
        draw.rectangle((x, y, x + 8, y + cell_h), fill=accent)

        with Image.open(PREVIEWS / filename) as frame:
            thumb = frame.convert("RGB")
            thumb.thumbnail((190, 338), Image.Resampling.LANCZOS)
            tx = x + 22
            ty = y + 58
            image.paste(thumb, (tx, ty))
            draw.rounded_rectangle((tx - 1, ty - 1, tx + thumb.width + 1, ty + thumb.height + 1), radius=8, outline="#5A5A5A", width=2)

        text_x = x + 232
        draw.text((text_x, y + 58), f"0{index + 1}", font=mono_small, fill=accent)
        name_lines = [name] if len(name) < 11 else name.split(" ", 1)
        name_y = y + 96
        for line in name_lines:
            draw.text((text_x, name_y), line, font=display_small, fill="#FAFAFA")
            name_y += 35
        draw.multiline_text((text_x, name_y + 18), use_for.replace(" / ", "\n"), font=mono, fill="#A8A8A8", spacing=8)
        draw.text((text_x, y + cell_h - 42), "ВЫБРАТЬ ДО СБОРКИ", font=mono_small, fill="#707070")

    board = PREVIEWS / "eight-styles.png"
    image.save(board, quality=95)

    manifest = {
        "kind": "remotion-style-previews",
        "selection": "static images rendered from the eight Remotion compositions",
        "board": board.name,
        "boardSHA256": sha256(board),
        "items": [
            {
                "concept": name,
                "slug": slug,
                "frame": filename,
                "frameSHA256": sha256(PREVIEWS / filename),
            }
            for name, _use_for, filename, slug in STYLES
        ],
    }
    (PREVIEWS / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(board)


if __name__ == "__main__":
    build()
