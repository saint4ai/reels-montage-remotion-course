#!/usr/bin/env python3
"""Сверка нашего результата с референсом.

  python scripts/ref-compare.py work/_refs/<имя>/profile.json <наш ролик.mp4 | папка кадров> [--out папка] [--words words.json]

Считает те же замеры на нашем ролике (mp4) или по кадрам из npm run frames (папка с K001.png …), печатает таблицу
«референс | наш | отличие | оценка» с подсказкой, что крутить, и пишет в --out (по умолчанию рядом с profile.json):
  compare.md    та же таблица для STYLE.md
  compare.json  числа сверки
  compare.jpg   лист «референс | наш» рядом: хук 0…3 с и ролик целиком
  our/          замеры нашего ролика (profile.json, sheet.jpg …)
По папке кадров (шаг 2 с) склейки, движение и звук не измерить: сверяются палитра, светлота и раскладка лица.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import math
import sys
from pathlib import Path

# те же замеры, что у референса: берём функции из ref-analyze.py
_spec = importlib.util.spec_from_file_location('ref_analyze', Path(__file__).with_name('ref-analyze.py'))
ra = importlib.util.module_from_spec(_spec)
sys.modules['ref_analyze'] = ra
_spec.loader.exec_module(ra)
np, cv2, Image, ImageDraw = ra.np, ra.cv2, ra.Image, getattr(ra, 'ImageDraw', None)

LEVEL = {0: 'ок', 1: 'заметно', 2: 'сильно'}
SHORT = {'full': 'во весь кадр', 'half': 'нижняя половина', 'strip_card': 'полоса или карточка', 'small_window': 'окно или кружок',
         'top_middle': 'середина или верх', 'none': 'лица нет', 'unknown': 'не измерено'}
FORMAT_OF = {  # раскладка лица → формат из reference/03-formats-styles.md
    'full': 'лицо во весь кадр (формат 3, карточка спикера, или ролик почти без графики)',
    'half': 'формат 1, половина экрана',
    'strip_card': 'формат 7 (полоса 35%) или формат 4 (карточка Screen Studio)',
    'small_window': 'формат 8 (камера по кадру, кружок) или формат 2 (окно в углу)',
    'top_middle': 'лицо сверху или в середине: графика ниже или рядом',
    'none': 'формат 5, без лица',
}


# ---------- цвет ----------
def rgb2lab(hexcolor: str) -> tuple[float, float, float]:
    r, g, b = (int(hexcolor[i:i + 2], 16) / 255 for i in (1, 3, 5))
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in (r, g, b)]
    x = (0.4124 * lin[0] + 0.3576 * lin[1] + 0.1805 * lin[2]) / 0.95047
    y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
    z = (0.0193 * lin[0] + 0.1192 * lin[1] + 0.9505 * lin[2]) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    fx, fy, fz = f(x), f(y), f(z)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


def delta_e(a: str, b: str) -> float:
    la, lb = rgb2lab(a), rgb2lab(b)
    return math.dist(la, lb)


def palette_delta(ref: list[dict], our: list[dict]) -> float:
    """Средняя по долям площади ΔE76 до ближайшего цвета другой палитры, в обе стороны."""
    def one(src, dst):
        tot = sum(c['share'] for c in src) or 1
        return sum(c['share'] * min(delta_e(c['hex'], d['hex']) for d in dst) for c in src) / tot
    return (one(ref, our) + one(our, ref)) / 2


# ---------- наши замеры ----------
IMG_EXT = {'.png', '.jpg', '.jpeg', '.webp'}


def frames_in(folder: Path) -> list[Path]:
    return sorted(p for p in folder.iterdir() if p.suffix.lower() in IMG_EXT and p.is_file())


def analyze_folder(folder: Path, name: str) -> dict:
    files = frames_in(folder)
    if len(files) < 3:
        raise RuntimeError('в папке меньше трёх кадров: сначала npm run frames -- <композиция>')
    frames = []
    for p in files:
        im = Image.open(p).convert('RGB')
        k = 960 / max(im.size)
        frames.append(np.asarray(im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.LANCZOS)))
    face = ra.face_block(frames)
    return {'schema': ra.SCHEMA, 'name': name, 'source': folder.name, 'video': {'frames': len(files)}, 'shots': None, 'motion': None,
            'palette': ra.palette_block(frames, ra.speaker_mask(face)), 'face': face, 'speech': None, 'audio': None}


# ---------- таблица ----------
def g(d, *keys):
    for k in keys:
        if not isinstance(d, dict) or d.get(k) is None:
            return None
        d = d[k]
    return d


def lvl_rel(ref, our, ok, notable):
    if ref in (None, 0) or our is None:
        return None
    r = abs(our - ref) / abs(ref)
    return 0 if r < ok else 1 if r < notable else 2


def lvl_abs(ref, our, ok, notable):
    if ref is None or our is None:
        return None
    r = abs(our - ref)
    return 0 if r < ok else 1 if r < notable else 2


def rel_text(ref, our, d=1):
    if ref in (None, 0) or our is None:
        return ''
    r = (our - ref) / abs(ref) * 100
    return f'{ra.fnum(r, 0)}%' if r < 0 else f'+{ra.fnum(r, 0)}%'


def build_rows(R: dict, O: dict) -> list[dict]:
    rows: list[dict] = []

    def add(label, ref, our, level, diff='', hint='', fmt=None):
        f = fmt or (lambda x: ra.fnum(x) if isinstance(x, (int, float)) else (x if x is not None else 'н/д'))
        rows.append({'label': label, 'ref': f(ref), 'our': f(our), 'diff': diff, 'level': level, 'hint': hint if level else ''})

    def reliable(P):  # детектор склеек не видит хлысты, смаз и камеру по холсту: если смен сцены заметно больше склеек, плану не верим
        sc, rc = g(P, 'shots', 'count'), g(P, 'rhythm', 'count')
        return sc is None or rc is None or sc * 1.5 >= rc
    plans_ok = reliable(R) and reliable(O)
    tag = 'склейки' if plans_ok else 'склейки, справочно'
    ppm = (g(R, 'shots', 'per_minute'), g(O, 'shots', 'per_minute'))
    lv = lvl_rel(*ppm, 0.25, 0.5) if plans_ok else None
    add(f'Планов в минуту ({tag})', *ppm, lv, rel_text(*ppm),
        'у референса планы чаще: режь блоки короче, стык на каждую новую мысль' if (ppm[1] or 0) < (ppm[0] or 0)
        else 'наш монтаж дробнее: объедини соседние блоки, одна мысль на сцену')
    rh = (g(R, 'rhythm', 'per_minute'), g(O, 'rhythm', 'per_minute'))
    add('Смен сцены в минуту (с хлыстами и камерой)', *rh, lvl_rel(*rh, 0.25, 0.5), rel_text(*rh),
        'у референса сцены меняются чаще: режь блоки короче, ставь стык или переезд камеры на каждую мысль' if (rh[1] or 0) < (rh[0] or 0)
        else 'у нас сцены меняются чаще: объедини блоки, одна мысль на сцену')
    rg = (g(R, 'rhythm', 'median_gap_s'), g(O, 'rhythm', 'median_gap_s'))
    add('Типичный промежуток между сменами, с', *rg, lvl_rel(*rg, 0.25, 0.5), rel_text(*rg),
        'у референса смены чаще: меняй картинку раньше, не жди конца фразы' if (rg[1] or 0) > (rg[0] or 0)
        else 'у референса сцена держится дольше: дай ей задержаться', fmt=lambda x: ra.fnum(x, 2))
    med = (g(R, 'shots', 'median_s'), g(O, 'shots', 'median_s'))
    add(f'Медиана плана ({tag}), с', *med, lvl_rel(*med, 0.25, 0.5) if plans_ok else None, rel_text(*med),
        'план у референса короче: меняй картинку раньше, не жди конца фразы' if (med[1] or 0) > (med[0] or 0)
        else 'план у референса длиннее: дай сцене задержаться, убери лишние стыки', fmt=lambda x: ra.fnum(x, 2))
    hc = (g(R, 'shots', 'hook_cuts'), g(O, 'shots', 'hook_cuts'))
    add('Склеек в первые 3 с', *hc, lvl_abs(*hc, 2, 3), '' if None in hc else ('0' if hc[1] == hc[0] else f'{hc[1] - hc[0]:+d}'),
        'хук у референса спокойнее: одна сцена до 3-й секунды' if (hc[1] or 0) > (hc[0] or 0)
        else 'хук у референса быстрее: добавь смену кадра внутри первых 3 с', fmt=lambda x: str(x) if x is not None else 'н/д')
    mm = (g(R, 'motion', 'mean'), g(O, 'motion', 'mean'))
    add('Движение, среднее', *mm, lvl_rel(*mm, 0.3, 0.6), rel_text(*mm),
        'у референса в кадре больше движения: камера, параллакс, кинетика текста' if (mm[1] or 0) < (mm[0] or 0)
        else 'у нас суетливее: оставь одно главное движение за раз')
    m3 = (g(R, 'motion', 'first3s_mean'), g(O, 'motion', 'first3s_mean'))
    add('Движение, первые 3 с', *m3, lvl_rel(*m3, 0.3, 0.6), rel_text(*m3),
        'хук у референса живее: быстрее въезд слов, движение с кадра 0' if (m3[1] or 0) < (m3[0] or 0)
        else 'хук у нас резче, чем у референса: смягчи въезды')
    rp, op = g(R, 'palette', 'colors'), g(O, 'palette', 'colors')
    de = palette_delta(rp, op) if rp and op else None
    pal_level = None if de is None else (0 if de < 12 else 1 if de < 25 else 2)
    rows.append({'label': 'Палитра (расстояние цветов ΔE)', 'ref': '-' if de is not None else 'н/д', 'our': '-' if de is not None else 'н/д',
                 'diff': f'ΔE {ra.fnum(de, 0)}' if de is not None else '', 'level': pal_level, 'hint': 'цвета расходятся: возьми фон и акцент из palette.colors референса' if pal_level else ''})
    ar, ao = g(R, 'palette', 'accent', 'hex'), g(O, 'palette', 'accent', 'hex')
    dea = delta_e(ar, ao) if ar and ao else None
    acc_level = None if dea is None else (0 if dea < 15 else 1 if dea < 30 else 2)
    rows.append({'label': 'Акцентный цвет', 'ref': ar or 'нет', 'our': ao or 'нет', 'diff': f'ΔE {ra.fnum(dea, 0)}' if dea is not None else '',
                 'level': acc_level, 'hint': f'акцент у референса {ar}: возьми его для плашек, подчёркиваний и главного предмета' if acc_level else ''})
    bg = (g(R, 'palette', 'background_lightness'), g(O, 'palette', 'background_lightness'))
    add('Светлота фона (0…1)', *bg, lvl_abs(*bg, 0.15, 0.3), '' if None in bg else f'{bg[1] - bg[0]:+.2f}'.replace('.', ','),
        'фон у референса светлее: светлые сцены' if (bg[1] or 0) < (bg[0] or 0) else 'фон у референса темнее: тёмные сцены', fmt=lambda x: ra.fnum(x, 2))
    sa = (g(R, 'palette', 'saturation_mean'), g(O, 'palette', 'saturation_mean'))
    add('Насыщенность цвета (0…1)', *sa, lvl_abs(*sa, 0.12, 0.25), '' if None in sa else f'{sa[1] - sa[0]:+.2f}'.replace('.', ','),
        'у референса цвета спокойнее: приглуши заливки' if (sa[1] or 0) > (sa[0] or 0) else 'у референса цвета ярче: добавь насыщенный акцент', fmt=lambda x: ra.fnum(x, 2))
    lr, lo = g(R, 'face', 'layout'), g(O, 'face', 'layout')
    lvl = None if lr in (None, 'unknown') or lo in (None, 'unknown') else (0 if lr == lo else 2)
    add('Раскладка лица', SHORT.get(lr), SHORT.get(lo), lvl, '' if lvl is None else ('одинаково' if lvl == 0 else 'другая'),
        f'у референса: {FORMAT_OF.get(lr, "")}')
    fh = (g(R, 'face', 'box_median', 'h'), g(O, 'face', 'box_median', 'h'))
    add('Высота лица, доля кадра', *fh, lvl_abs(*fh, 0.05, 0.1), '' if None in fh else f'{fh[1] - fh[0]:+.2f}'.replace('.', ','),
        'лицо у референса крупнее: увеличь окно спикера' if (fh[1] or 0) < (fh[0] or 0) else 'лицо у референса мельче: уменьши окно, отдай место графике', fmt=lambda x: ra.fnum(x, 2))
    fa = (g(R, 'face', 'free_above_head'), g(O, 'face', 'free_above_head'))
    add('Над головой свободно, доля кадра', *fa, lvl_abs(*fa, 0.1, 0.2), '' if None in fa else f'{fa[1] - fa[0]:+.2f}'.replace('.', ','),
        'у референса графике отдано больше места: подними границу спикера' if (fa[1] or 0) < (fa[0] or 0) else 'у референса графике места меньше: опусти границу', fmt=lambda x: ra.fnum(x, 2))
    sp = (g(R, 'speech', 'words_per_second'), g(O, 'speech', 'words_per_second'))
    add('Темп речи, слов в секунду', *sp, lvl_rel(*sp, 0.3, 0.6), rel_text(*sp),
        'темп речи это запись, а не стиль: учитывай, только если записи близки по жанру')
    ld = (g(R, 'audio', 'loudness_lufs'), g(O, 'audio', 'loudness_lufs'))
    add('Громкость, LUFS', *ld, lvl_abs(*ld, 2, 4), '' if None in ld else f'{ld[1] - ld[0]:+.1f}'.replace('.', ','),
        'громкость выровняй до −14 LUFS: npm run master', fmt=lambda x: ra.fnum(x))
    return rows


def table_text(rows: list[dict]) -> str:
    head = ['Замер', 'Референс', 'Наш', 'Отличие', 'Оценка']
    body = [[r['label'], str(r['ref']), str(r['our']), r['diff'], LEVEL[r['level']] if r['level'] is not None else ('справочно' if 'справочно' in r['label'] else 'н/д')] for r in rows]
    w = [max(len(x[i]) for x in [head] + body) for i in range(5)]
    w[1] = min(w[1], 44)
    w[2] = min(w[2], 44)
    line = lambda c: '  '.join(c[i][:w[i]].ljust(w[i]) for i in range(5))
    return '\n'.join([line(head), line(['-' * x for x in w])] + [line(b) for b in body])


def table_md(rows: list[dict]) -> str:
    out = ['| Замер | Референс | Наш | Отличие | Оценка |', '|---|---|---|---|---|']
    for r in rows:
        out.append(f'| {r["label"]} | {r["ref"]} | {r["our"]} | {r["diff"]} | {LEVEL[r["level"]] if r["level"] is not None else ("справочно" if "справочно" in r["label"] else "н/д")} |')
    return '\n'.join(out)


# ---------- лист «референс | наш» ----------
def sheet_pair(ref_video: Path | None, our_src: Path, our_is_dir: bool, ref_prof: dict, out: Path) -> bool:
    if not ref_video or not ref_video.exists():
        return False
    tw = 150
    import tempfile
    with tempfile.TemporaryDirectory(prefix='cmp-') as td:
        tmp = Path(td)
        rdur = ref_prof['video']['duration']
        rinfo = ra.probe(ref_video)
        rsize = ra.long_side_size(rinfo['width'], rinfo['height'], 480)
        hook_t = [0.0, 1.0, 2.0, 3.0]
        whole_t = [rdur * (i + 0.5) / 8 for i in range(8)]

        def ref_frame(t, name):
            p = tmp / f'r_{name}.jpg'
            return Image.open(p).convert('RGB') if ra.grab(ref_video, min(t, rdur - 0.05), p, size=rsize) else None

        ref_tiles = [(t, ref_frame(t, f'h{i}')) for i, t in enumerate(hook_t)] + [(t, ref_frame(t, f'w{i}')) for i, t in enumerate(whole_t)]
        if our_is_dir:
            files = frames_in(our_src)
            idx = [0, min(1, len(files) - 1), min(2, len(files) - 1), min(3, len(files) - 1)] + [round((i + 0.5) / 8 * len(files) - 0.5) for i in range(8)]
            our_tiles = [(None, Image.open(files[max(0, min(len(files) - 1, j))]).convert('RGB')) for j in idx]
        else:
            oinfo = ra.probe(our_src)
            odur = oinfo['duration']
            osize = ra.long_side_size(oinfo['width'], oinfo['height'], 480)
            times = hook_t + [odur * (i + 0.5) / 8 for i in range(8)]
            our_tiles = []
            for i, t in enumerate(times):
                p = tmp / f'o_{i}.jpg'
                our_tiles.append((t, Image.open(p).convert('RGB') if ra.grab(our_src, min(t, odur - 0.05), p, size=osize) else None))
        th = max((im.height * tw // im.width) for _, im in ref_tiles + our_tiles if im) if any(im for _, im in ref_tiles + our_tiles) else 267
        bar, left, gap = 28, 136, 24
        width = left + 12 * tw + gap
        sheet = Image.new('RGB', (width, 2 * (th + bar) + 44), (17, 19, 22))
        ra.mark_text(sheet, 'Хук 0…3 с', (left + 6, 8), 20, (255, 122, 47))
        ra.mark_text(sheet, 'Весь ролик, восемь точек равными долями', (left + 4 * tw + gap + 6, 8), 20, (255, 122, 47))
        for row, (label, tiles) in enumerate((('референс', ref_tiles), ('наш', our_tiles))):
            y = 44 + row * (th + bar)
            ra.mark_text(sheet, label, (10, y + bar + th // 2 - 12), 22)
            for i, (t, im) in enumerate(tiles):
                x = left + i * tw + (gap if i >= 4 else 0)
                if im is not None:
                    sheet.paste(im.resize((tw, im.height * tw // im.width), Image.LANCZOS), (x, y + bar))
                if t is not None:
                    ra.mark_text(sheet, f'{ra.fnum(t)} с', (x + 6, y + 3), 17)
        sheet.save(out, quality=88)
    return True


# ---------- основное ----------
def main() -> None:
    ap = argparse.ArgumentParser(description='Сверка нашего ролика с референсом.')
    ap.add_argument('profile', help='profile.json референса (после ref-analyze.py)')
    ap.add_argument('ours', help='наш mp4 или папка с кадрами (reviews/<композиция>-vNNN)')
    ap.add_argument('--out', help='куда писать результат сверки (по умолчанию папка profile.json)')
    ap.add_argument('--words', help='words.json нашего ролика, если нужен темп речи')
    ap.add_argument('--threshold', type=float, default=3.0, help='чувствительность склеек, как у ref-analyze.py')
    args = ap.parse_args()

    ra.need_packages()
    ra.need_ffmpeg()
    pj = Path(args.profile).resolve()
    if not pj.is_file():
        print(f'Нет profile.json: {args.profile}. Сначала python scripts/ref-analyze.py <ролик-референс>')
        sys.exit(2)
    ref = json.loads(pj.read_text(encoding='utf-8'))
    ours = Path(args.ours).resolve()
    if not ours.exists():
        print(f'Не найдено: {args.ours}')
        sys.exit(2)
    out = Path(args.out).resolve() if args.out else pj.parent
    out.mkdir(parents=True, exist_ok=True)
    ra.lower_priority()
    is_dir = ours.is_dir()
    print(f'Сверяю {ours.name} с референсом {ref.get("name")}…')
    try:
        if is_dir:
            our = analyze_folder(ours, 'наш')
        else:
            our = ra.analyze(ours, out / 'our', 'наш', Path(args.words) if args.words else None, False, args.threshold, 0)
    except RuntimeError as e:
        print(f'Не получилось: {e}')
        sys.exit(1)

    rows = build_rows(ref, our)
    text = table_text(rows)
    print('\n' + text)
    worst = sorted((r for r in rows if r['level']), key=lambda r: (-r['level'], rows.index(r)))[:4]
    print('\nЧто крутить в первую очередь:' if worst else '\nЗаметных расхождений нет.')
    for r in worst:
        print(f'  [{LEVEL[r["level"]]}] {r["label"]}: {r["hint"]}')
    if is_dir:
        print('\nПо кадрам склейки, движение и звук не измерены. Для полной сверки собери черновик 720p (npm run draft) и сверь mp4.')

    md = ['# Сверка с референсом', '', f'Референс: {ref.get("name")} ({ref.get("source")}). Наш: {ours.name}.', '', table_md(rows), '']
    if worst:
        md += ['## Что крутить', ''] + [f'- {r["label"]} ({LEVEL[r["level"]]}): {r["hint"]}' for r in worst]
    (out / 'compare.md').write_text('\n'.join(md) + '\n', encoding='utf-8')
    ra.write_json(out / 'compare.json', {'reference': ref.get('name'), 'ours': ours.name, 'rows': rows})
    ref_video = pj.parent / str(ref.get('source', ''))
    made = sheet_pair(ref_video, ours, is_dir, ref, out / 'compare.jpg')
    print(f'\nФайлы в {out}: compare.md, compare.json' + (', compare.jpg' if made else ''))
    if not made:
        print('compare.jpg не собран: ролик-референс должен лежать рядом с profile.json.')


if __name__ == '__main__':
    main()
