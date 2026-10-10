#!/usr/bin/env python3
"""Замер референса: python scripts/ref-analyze.py work/_refs/<имя>/<файл>.mp4

Пишет рядом с роликом (или в --out):
  profile.json  числа: длительность, планы и склейки, движение, палитра, лицо и раскладка, речь, звук
  sheet.jpg     лист: кадр раз в секунду с подписью времени (оранжевая черта: в эту секунду сменилась сцена)
  hook.jpg      хук: кадры 0, 0,5 … 3 с крупнее
  shots/NNN.jpg средний кадр каждого плана

Работает на процессоре, видеокарта не нужна, Windows и macOS. Сам ничего не ставит: чего не хватает, скажет и покажет команду.
Необязательно: mediapipe с файлом модели (лицо точнее), librosa и флаг --beats (темп музыки), words.json рядом с роликом (темп речи).
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import shutil
import statistics
import subprocess
import sys
import tempfile
import time
import warnings
from pathlib import Path

warnings.filterwarnings('ignore')
try:  # консоль Windows не всегда в UTF-8
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = 1

# ---------- зависимости ----------
_missing: list[str] = []
try:
    import numpy as np
except ImportError:
    np = None
    _missing.append('numpy')
try:
    import cv2
except ImportError:
    cv2 = None
    _missing.append('opencv-python')
try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    Image = None
    _missing.append('Pillow')
try:
    import scenedetect  # noqa: F401
except ImportError:
    _missing.append('scenedetect')


def need_packages() -> None:
    """Если чего-то не хватает, печатаем понятную команду и выходим. Сами ничего не ставим."""
    if not _missing:
        return
    py = 'python' if os.name == 'nt' else 'python3'
    print(f'Не хватает пакетов: {", ".join(_missing)}.')
    print('Поставь одной командой из папки репозитория:')
    print(f'  {py} -m pip install -r scripts/ref-requirements.txt')
    sys.exit(3)


def need_ffmpeg() -> None:
    for tool in ('ffmpeg', 'ffprobe'):
        if not shutil.which(tool):
            print(f'Не найден {tool}. Windows: winget install ffmpeg; macOS: brew install ffmpeg. Потом npm run doctor.')
            sys.exit(3)


def lower_priority() -> None:
    """Анализ не должен вешать компьютер: понижаем приоритет себя и дочерних ffmpeg."""
    try:
        if os.name == 'nt':
            import ctypes
            ctypes.windll.kernel32.SetPriorityClass(ctypes.windll.kernel32.GetCurrentProcess(), 0x00004000)  # BELOW_NORMAL
        else:
            os.nice(5)
    except Exception:
        pass


# ---------- мелочи ----------
def fnum(x, d: int = 1) -> str:
    """Число с запятой, как пишем по-русски."""
    if x is None:
        return 'н/д'
    return f'{x:.{d}f}'.replace('.', ',')


def even(v: float) -> int:
    return max(2, int(round(v / 2.0)) * 2)


def pct(a: float, b: float) -> float:
    """Процентиль b (0…100) списка a."""
    if not a:
        return 0.0
    s = sorted(a)
    k = (len(s) - 1) * b / 100
    lo, hi = math.floor(k), math.ceil(k)
    return s[lo] + (s[hi] - s[lo]) * (k - lo)


def run(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess:
    r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
    if check and r.returncode != 0:
        tail = '\n'.join(r.stderr.strip().splitlines()[-6:])
        raise RuntimeError(f'{cmd[0]} завершился с ошибкой:\n{tail}')
    return r


def find_font(size: int):
    for p in (ROOT / 'public' / 'fonts' / 'Manrope-Variable.ttf',):
        try:
            return ImageFont.truetype(str(p), size)
        except Exception:
            continue
    try:
        return ImageFont.load_default(size=size)
    except Exception:
        return ImageFont.load_default()


# ---------- ffprobe и кадры ----------
def probe(path: Path) -> dict:
    r = run(['ffprobe', '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', str(path)])
    data = json.loads(r.stdout)
    v = next((s for s in data.get('streams', []) if s.get('codec_type') == 'video'), None)
    if not v:
        raise RuntimeError('в файле нет видеодорожки')
    w, h = int(v['width']), int(v['height'])
    rot = 0
    for sd in v.get('side_data_list') or []:
        if 'rotation' in sd:
            rot = int(float(sd['rotation']))
    rot = rot or int(float((v.get('tags') or {}).get('rotate', 0) or 0))
    if abs(rot) % 180 == 90:  # телефонная запись с поворотом: ffmpeg разворачивает кадр сам
        w, h = h, w
    num, _, den = (v.get('avg_frame_rate') or v.get('r_frame_rate') or '30/1').partition('/')
    fps = float(num) / float(den or 1) if float(den or 1) else 30.0
    fmt = data.get('format', {})
    duration = float(fmt.get('duration') or v.get('duration') or 0)
    br = fmt.get('bit_rate')
    return {
        'duration': duration, 'width': w, 'height': h, 'fps': fps, 'codec': v.get('codec_name'),
        'bitrate_mbps': round(int(br) / 1e6, 1) if br else None,
        'has_audio': any(s.get('codec_type') == 'audio' for s in data.get('streams', [])),
    }


def aspect_name(w: int, h: int) -> str:
    r = w / h
    for name, val in (('9:16', 9 / 16), ('4:5', 4 / 5), ('1:1', 1.0), ('16:9', 16 / 9), ('3:4', 3 / 4)):
        if abs(r - val) < 0.03:
            return name
    return f'{w}:{h}'


def long_side_size(w: int, h: int, long_side: int) -> tuple[int, int]:
    if h >= w:
        return even(long_side * w / h), long_side
    return long_side, even(long_side * h / w)


def grab(path: Path, t: float, out: Path, long_side: int = 960, q: int = 3, size: tuple[int, int] | None = None) -> bool:
    """Один кадр на секунде t в jpg."""
    w, h = size or (0, 0)
    if not size:
        info = probe(path)
        w, h = long_side_size(info['width'], info['height'], long_side)
    r = run(['ffmpeg', '-v', 'error', '-nostdin', '-threads', '4', '-ss', f'{max(t, 0):.3f}', '-i', str(path), '-frames:v', '1',
             '-vf', f'scale={w}:{h}:flags=area', '-q:v', str(q), '-y', str(out)], check=False)
    return r.returncode == 0 and out.exists()


def decode_streams(path: Path, info: dict, tmp: Path, look_step: int) -> tuple['np.ndarray', 'np.ndarray', tuple[int, int]]:
    """Одно чтение файла даёт два потока: серые кадры 10 в секунду для движения и цветные кадры для листа, палитры и лица."""
    mw = 160
    mh = even(mw * info['height'] / info['width'])
    lw, lh = long_side_size(info['width'], info['height'], 960)
    graph = (f'[0:v]split=2[a][b];[a]fps=10,scale={mw}:{mh}:flags=area,format=gray[ma];'
             f'[b]fps=1/{look_step},scale={lw}:{lh}:flags=area,format=rgb24[lb]')
    m_file, l_file = tmp / 'motion.gray', tmp / 'look.rgb'
    run(['ffmpeg', '-v', 'error', '-nostdin', '-threads', '4', '-i', str(path), '-filter_complex', graph,
         '-an', '-map', '[ma]', '-f', 'rawvideo', str(m_file), '-an', '-map', '[lb]', '-f', 'rawvideo', str(l_file)])
    m = np.fromfile(m_file, dtype=np.uint8)
    m = m[: (m.size // (mw * mh)) * mw * mh].reshape(-1, mh, mw)
    lk = np.fromfile(l_file, dtype=np.uint8)
    lk = lk[: (lk.size // (lw * lh * 3)) * lw * lh * 3].reshape(-1, lh, lw, 3)
    return m, lk, (lw, lh)


# ---------- планы и склейки ----------
def _seconds(tc) -> float:
    for name in ('seconds',):
        v = getattr(tc, name, None)
        if isinstance(v, (int, float)):
            return float(v)
    return float(tc.get_seconds())


def detect_shots(path: Path, fps: float, duration: float, threshold: float, tmp: Path) -> tuple[list[tuple[float, float]], bool]:
    """PySceneDetect, AdaptiveDetector. Возвращает (планы, детектор_сработал).
    Если OpenCV не открыл файл (кириллица в пути на Windows), пробуем копию с простым именем во временной папке."""
    from scenedetect import AdaptiveDetector, detect
    min_len = max(3, round(0.25 * fps))  # план короче 0,25 с склейкой не считаем

    def go(p: Path):
        try:
            return detect(str(p), AdaptiveDetector(adaptive_threshold=threshold, min_scene_len=min_len), start_in_scene=True), True
        except Exception:
            return [], False

    scenes, ok = go(path)
    if not ok:
        copy = tmp / f'ref_copy{path.suffix.lower()}'
        shutil.copyfile(path, copy)
        scenes, ok = go(copy)
    if not scenes:
        return [(0.0, duration)], ok
    out = [(_seconds(a), _seconds(b)) for a, b in scenes]
    out[0] = (0.0, out[0][1])
    out[-1] = (out[-1][0], max(out[-1][1], duration))
    return out, ok


def shots_block(shots: list[tuple[float, float]], duration: float) -> dict:
    durs = [b - a for a, b in shots]
    edges = [('до 0,5 с', 0, 0.5), ('0,5…1 с', 0.5, 1), ('1…2 с', 1, 2), ('2…4 с', 2, 4), ('4 с и дольше', 4, 1e9)]
    hist = {name: sum(1 for d in durs if lo <= d < hi) for name, lo, hi in edges}
    return {
        'count': len(shots),
        'per_minute': round(len(shots) / duration * 60, 1) if duration else 0,
        'median_s': round(statistics.median(durs), 2),
        'mean_s': round(sum(durs) / len(durs), 2),
        'p10_s': round(pct(durs, 10), 2), 'p90_s': round(pct(durs, 90), 2),
        'min_s': round(min(durs), 2), 'max_s': round(max(durs), 2),
        'histogram': hist,
        'hook_cuts': sum(1 for a, _ in shots[1:] if a < 3.0),
        'list': [{'n': i + 1, 'start': round(a, 2), 'end': round(b, 2)} for i, (a, b) in enumerate(shots)],
    }


def rhythm_block(shots: list[tuple[float, float]], motion: dict, duration: float) -> dict:
    """Смены сцены: склейки детектора плюс всплески движения (хлысты, смаз, переезды камеры, которые детектор не считает склейкой).
    Для роликов с камерой по холсту это настоящий ритм: «планов» там мало, а станций много."""
    times = sorted([a for a, _ in shots[1:]] + [s + 0.5 for s in motion.get('peaks_s', [])])
    merged: list[float] = []
    for t in times:
        if not merged or t - merged[-1] >= 1.0:
            merged.append(t)
    edges = [0.0] + merged + [duration]
    gaps = [b - a for a, b in zip(edges, edges[1:])]
    return {'count': len(merged), 'per_minute': round(len(merged) / duration * 60, 1) if duration else 0,
            'median_gap_s': round(statistics.median(gaps), 2), 'times': [round(t, 1) for t in merged]}


# ---------- движение ----------
def motion_block(gray: 'np.ndarray') -> dict:
    """Средняя разница соседних кадров (10 кадров в секунду), в процентах от максимума яркости. Склейка даёт всплеск."""
    if len(gray) < 2:
        return {'mean': 0, 'p90': 0, 'peak': 0, 'first3s_mean': 0, 'static_share': 1, 'peaks_s': [], 'per_second': []}
    d = np.abs(gray[1:].astype(np.int16) - gray[:-1].astype(np.int16)).mean(axis=(1, 2)) / 255 * 100
    secs = [float(d[i:i + 10].mean()) for i in range(0, len(d), 10)]
    limit = float(np.mean(secs) + 0.8 * np.std(secs))
    # секунды всплесков: склейки, хлысты и переезды камеры (локальные максимумы выше среднего на 0,8 разброса)
    peaks = [i for i, v in enumerate(secs) if v > limit and v >= 1.0 and v >= (secs[i - 1] if i else 0) and v >= (secs[i + 1] if i + 1 < len(secs) else 0)][:80]
    return {
        'mean': round(float(np.mean(secs)), 2), 'p90': round(pct(secs, 90), 2), 'peak': round(max(secs), 2),
        'first3s_mean': round(float(np.mean(secs[:3])), 2),
        'static_share': round(sum(1 for s in secs if s < 0.5) / len(secs), 2),
        'peaks_s': peaks,
        'per_second': [round(s, 2) for s in secs],
    }


# ---------- палитра и светлота ----------
def _luma(rgb: 'np.ndarray') -> 'np.ndarray':
    return (0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]) / 255


def _hsv(rgb: tuple[int, int, int]) -> tuple[float, float]:
    r, g, b = (c / 255 for c in rgb)
    mx, mn = max(r, g, b), min(r, g, b)
    return (0.0 if mx == 0 else (mx - mn) / mx), mx


def palette_block(frames: list['np.ndarray'], mask: tuple[float, float, float, float] | None = None) -> dict:
    """Палитра графики. mask (y0, y1, x0, x1 в долях кадра): область спикера, её пиксели не считаем, иначе стены и кресло за спиной засорят палитру."""
    small = []
    for f in frames:
        h, w = f.shape[:2]
        k = 96 / max(h, w)
        sm = cv2.resize(f, (max(1, int(w * k)), max(1, int(h * k))), interpolation=cv2.INTER_AREA)
        if mask:
            y0, y1, x0, x1 = mask
            keep = np.ones(sm.shape[:2], dtype=bool)
            keep[int(y0 * sm.shape[0]):int(math.ceil(y1 * sm.shape[0])), int(x0 * sm.shape[1]):int(math.ceil(x1 * sm.shape[1]))] = False
            sm = sm[keep]
        small.append(sm)
    masked = bool(mask)
    if mask and sum(len(x.reshape(-1, 3)) for x in small) < 500:  # маска съела почти весь кадр: считаем без неё
        return palette_block(frames, None)
    mosaic = np.concatenate([s.reshape(-1, 3) for s in small]).reshape(-1, 1, 3)
    img = Image.fromarray(mosaic.astype(np.uint8), 'RGB')
    q = img.quantize(colors=12, method=Image.Quantize.MEDIANCUT, kmeans=2)
    pal = q.getpalette()[:36]
    total = mosaic.shape[0]
    items = []
    for count, idx in q.getcolors():
        rgb = (pal[idx * 3], pal[idx * 3 + 1], pal[idx * 3 + 2])
        s, v = _hsv(rgb)
        items.append({'hex': '#%02X%02X%02X' % rgb, 'share': round(count / total, 3), 'saturation': round(s, 2), 'lightness': round(float(_luma(np.array(rgb, dtype=float))), 2)})
    items.sort(key=lambda c: -c['share'])
    top = items[:6]
    # светлота: медиана яркости всех пикселей и число смен «светлый / тёмный» по кадрам
    allpix = np.concatenate([s.reshape(-1, 3) for s in small]).astype(float)
    # акценты: насыщенные пиксели считаем отдельно, в общей палитре их съедает светлый или тёмный фон
    mx, mn = allpix.max(axis=1), allpix.min(axis=1)
    vivid = allpix[(mx > 90) & ((mx - mn) / np.maximum(mx, 1) > 0.3)]
    accents = []
    if len(vivid) >= 60:
        qa = Image.fromarray(vivid.astype(np.uint8).reshape(-1, 1, 3), 'RGB').quantize(colors=3, method=Image.Quantize.MEDIANCUT, kmeans=2)
        pa = qa.getpalette()[:9]
        for count, idx in sorted(qa.getcolors(), reverse=True):
            accents.append({'hex': '#%02X%02X%02X' % (pa[idx * 3], pa[idx * 3 + 1], pa[idx * 3 + 2]), 'share': round(count / len(allpix), 3)})
    accent = accents[0] if accents and accents[0]['share'] >= 0.004 else None
    bg = float(np.median(_luma(allpix)))
    per = [float(np.median(_luma(s.reshape(-1, 3).astype(float)))) for s in small]
    state, switches = None, 0
    for v in per:
        new = 'l' if v > 0.55 else 'd' if v < 0.4 else state
        if state and new and new != state:
            switches += 1
        state = new or state
    sat = float(np.mean([_hsv(tuple(int(x) for x in p))[0] for p in allpix[:: max(1, len(allpix) // 4000)]]))
    return {
        'colors': top, 'accent': accent, 'accents': accents, 'speaker_masked': masked, 'background_lightness': round(bg, 2),
        'background': 'светлый' if bg > 0.65 else 'тёмный' if bg < 0.35 else 'средний',
        'saturation_mean': round(sat, 2), 'light_dark_switches': switches,
    }


# ---------- лицо и раскладка ----------
LAYOUTS = {
    'full': 'лицо крупно, во весь кадр',
    'half': 'лицо внизу крупно: запись на нижней половине кадра',
    'strip_card': 'лицо внизу меньше: полоса или карточка спикера',
    'small_window': 'маленькое окно или кружок со спикером',
    'top_middle': 'лицо в середине или вверху кадра',
    'none': 'лица нет или его не нашли',
    'unknown': 'лицо не измерено: нет детектора (поставь opencv-python<5 или mediapipe), смотри лист кадров',
}


def _haar():
    if not hasattr(cv2, 'CascadeClassifier') or not hasattr(cv2, 'data'):
        return None  # OpenCV 5 без каскадов Haar
    path = Path(cv2.data.haarcascades) / 'haarcascade_frontalface_default.xml'
    casc = cv2.CascadeClassifier(str(path))
    if casc.empty():  # кириллица в пути пакета: читаем xml сами
        fs = cv2.FileStorage(path.read_text(encoding='utf-8'), cv2.FILE_STORAGE_READ | cv2.FILE_STORAGE_MEMORY)
        casc = cv2.CascadeClassifier()
        casc.read(fs.getFirstTopLevelNode())
    return casc


MP_MODEL = ROOT / 'work' / '_refs' / '.models' / 'blaze_face_short_range.tflite'


def _mediapipe_detector():
    """MediaPipe Tasks (mediapipe 0.10 и новее). Нужен файл модели blaze_face_short_range.tflite: в work/_refs/.models/ или путь в переменной REF_FACE_MODEL.
    Нет пакета или нет файла: возвращаем None, дальше работает Haar."""
    model = Path(os.environ.get('REF_FACE_MODEL') or MP_MODEL)
    if not model.is_file():
        return None
    try:
        import mediapipe as mp
        opts = mp.tasks.vision.FaceDetectorOptions(base_options=mp.tasks.BaseOptions(model_asset_path=str(model)), min_detection_confidence=0.5)
        det = mp.tasks.vision.FaceDetector.create_from_options(opts)

        def run_mp(rgb):
            h, w = rgb.shape[:2]
            res = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb)))
            return [((d.bounding_box.origin_x + d.bounding_box.width / 2) / w, (d.bounding_box.origin_y + d.bounding_box.height / 2) / h,
                     d.bounding_box.width / w, d.bounding_box.height / h) for d in res.detections]
        run_mp(np.zeros((64, 64, 3), dtype=np.uint8))  # пробный вызов: если интерфейс не тот, падаем сразу и берём Haar
        return run_mp
    except Exception:
        return None


def make_face_detector():
    """MediaPipe, если стоит пакет и лежит модель, иначе Haar из OpenCV. Возвращает (название, функция кадр, список (cx, cy, w, h) в долях кадра)."""
    mp_run = _mediapipe_detector()
    if mp_run:
        return 'mediapipe', mp_run
    casc = _haar()
    if casc is None:
        return 'нет', None

    def run_haar(rgb):
        h, w = rgb.shape[:2]
        gray = cv2.equalizeHist(cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY))
        m = int(0.045 * min(w, h))
        boxes = casc.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=6, minSize=(m, m))
        return [((x + bw / 2) / w, (y + bh / 2) / h, bw / w, bh / h) for x, y, bw, bh in boxes]
    return 'opencv-haar', run_haar


def classify_layout(cx: float, cy: float, w: float, h: float) -> str:
    if h >= 0.30 or w >= 0.5:
        return 'full'
    if cy >= 0.5:
        return 'half' if h >= 0.16 else 'strip_card' if h >= 0.09 else 'small_window'
    return 'top_middle'


def face_block(frames: list['np.ndarray']) -> dict:
    name, detect = make_face_detector()
    if detect is None:  # нет ни mediapipe, ни каскадов: лицо смотрит агент по листу кадров
        return {'engine': name, 'detect_rate': None, 'box_median': None, 'layout': 'unknown', 'layout_text': LAYOUTS['unknown'], 'free_above_head': None}
    boxes = []
    for f in frames:
        found = detect(f)
        if found:
            boxes.append(max(found, key=lambda b: b[2] * b[3]))
    rate = len(boxes) / len(frames) if frames else 0
    base = {'engine': name, 'detect_rate': round(rate, 2)}
    if rate < 0.2:
        return {**base, 'box_median': None, 'layout': 'none', 'layout_text': LAYOUTS['none'], 'free_above_head': None}
    cx, cy, w, h = (statistics.median(b[i] for b in boxes) for i in range(4))
    layout = classify_layout(cx, cy, w, h)
    top = cy - h / 2 - 0.3 * h  # макушка с волосами
    return {**base, 'box_median': {'cx': round(cx, 3), 'cy': round(cy, 3), 'w': round(w, 3), 'h': round(h, 3)},
            'layout': layout, 'layout_text': LAYOUTS[layout], 'free_above_head': round(max(0.0, top), 2)}


def speaker_mask(face: dict) -> tuple[float, float, float, float] | None:
    """Где в кадре спикер (по рамке лица), чтобы не считать его в палитре. Лицо во весь кадр и «лица нет»: без маски."""
    box, layout = face.get('box_median'), face.get('layout')
    if not box or layout in ('full', 'none', 'unknown'):
        return None
    cx, cy, w, h = box['cx'], box['cy'], box['w'], box['h']
    if layout in ('half', 'strip_card'):  # запись внизу на всю ширину: всё ниже макушки
        return (max(0.0, cy - h / 2 - 0.3 * h - 0.10), 1.0, 0.0, 1.0)
    k = 1.5 if layout == 'small_window' else 2.0  # кружок или рамка вокруг лица
    return (max(0.0, cy - 1.6 * h * k / 1.5), min(1.0, cy + 1.6 * h * k / 1.5), max(0.0, cx - 1.5 * w * k / 1.5), min(1.0, cx + 1.5 * w * k / 1.5))


# ---------- речь, звук, биты ----------
def speech_block(words_path: Path | None) -> dict | None:
    if not words_path or not words_path.exists():
        return None
    try:
        words = json.loads(words_path.read_text(encoding='utf-8'))
        words = [w for w in words if isinstance(w, dict) and 'start' in w and 'end' in w]
    except Exception:
        return None
    if len(words) < 3:
        return None
    span = max(words[-1]['end'] - words[0]['start'], 0.1)
    gaps = [b['start'] - a['end'] for a, b in zip(words, words[1:])]
    first = [w['text'] for w in words if w['start'] < 3.0]
    return {
        'words': len(words), 'words_per_second': round(len(words) / span, 2),
        'pauses_over_0_6s': sum(1 for g in gaps if g > 0.6),
        'first_words_at': round(words[0]['start'], 2), 'hook_text': ' '.join(first),
    }


def audio_block(path: Path, has_audio: bool) -> dict:
    if not has_audio:
        return {'has_audio': False}
    r = run(['ffmpeg', '-hide_banner', '-nostats', '-nostdin', '-v', 'info', '-i', str(path), '-vn', '-af', 'ebur128=peak=true:framelog=quiet',
             '-f', 'null', '-'], check=False)
    tail = r.stderr.split('Summary:')[-1]
    lufs = re.search(r'I:\s+(-?[\d.]+)\s+LUFS', tail)
    peak = re.search(r'Peak:\s+(-?[\d.]+)\s+dBFS', tail)
    return {'has_audio': True, 'loudness_lufs': float(lufs.group(1)) if lufs else None, 'true_peak_db': float(peak.group(1)) if peak else None}


def beats_block(path: Path, tmp: Path) -> dict | None:
    try:
        import librosa
    except ImportError:
        py = 'python' if os.name == 'nt' else 'python3'
        print(f'Для --beats нужен librosa: {py} -m pip install librosa (необязательный пакет). Биты пропущены.')
        return None
    wav = tmp / 'audio.wav'
    run(['ffmpeg', '-v', 'error', '-nostdin', '-i', str(path), '-vn', '-ac', '1', '-ar', '22050', '-y', str(wav)])
    y, sr = librosa.load(str(wav), sr=22050, mono=True)
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
    times = librosa.frames_to_time(beats, sr=sr)
    return {'tempo_bpm': round(float(np.atleast_1d(tempo)[0]), 1), 'beats': int(len(times)), 'first_beats_s': [round(float(t), 2) for t in times[:8]]}


# ---------- картинки ----------
def mark_text(img: 'Image.Image', text: str, xy: tuple[int, int], size: int, fill=(255, 255, 255)) -> None:
    ImageDraw.Draw(img).text(xy, text, font=find_font(size), fill=fill)


def build_sheet(frames: list['np.ndarray'], step: int, cut_seconds: set[int], out: Path, cols: int = 10, tw: int = 180) -> None:
    th = int(tw * frames[0].shape[0] / frames[0].shape[1])
    bar = 26
    rows = math.ceil(len(frames) / cols)
    sheet = Image.new('RGB', (cols * tw, rows * (th + bar)), (17, 19, 22))
    for i, f in enumerate(frames):
        x, y = (i % cols) * tw, (i // cols) * (th + bar)
        sheet.paste(Image.fromarray(f).resize((tw, th), Image.LANCZOS), (x, y + bar))
        t = i * step
        mark_text(sheet, f'{t} с', (x + 8, y + 3), 17)
        if any(s in cut_seconds for s in range(t, t + step)):
            ImageDraw.Draw(sheet).rectangle([x, y + bar - 4, x + tw - 2, y + bar - 1], fill=(255, 122, 47))
    if step > 1:
        mark_text(sheet, f'кадр раз в {step} с', (sheet.width - 190, 3), 17, (255, 122, 47))
    sheet.save(out, quality=88)


def build_hook(path: Path, info: dict, out: Path, tmp: Path) -> None:
    times = [t for t in (0, 0.5, 1, 1.5, 2, 2.5, 3) if t < info['duration']]
    w, h = long_side_size(info['width'], info['height'], 480)
    tiles = []
    for t in times:
        p = tmp / f'hook_{t}.jpg'
        if grab(path, t, p, size=(w, h)):
            tiles.append((t, Image.open(p).convert('RGB')))
    if not tiles:
        return
    bar = 30
    sheet = Image.new('RGB', (len(tiles) * w, h + bar), (17, 19, 22))
    for i, (t, im) in enumerate(tiles):
        sheet.paste(im, (i * w, bar))
        mark_text(sheet, f'{fnum(t)} с', (i * w + 8, 4), 20)
    sheet.save(out, quality=90)


def build_shots(path: Path, info: dict, shots: list[tuple[float, float]], out_dir: Path, limit: int) -> int:
    if limit <= 0:
        return 0
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob('*.jpg'):
        old.unlink()
    size = long_side_size(info['width'], info['height'], 960)
    idx = list(range(len(shots)))
    if len(idx) > limit:
        idx = [idx[round(i * (len(idx) - 1) / (limit - 1))] for i in range(limit)]
    n = 0
    for i in idx:
        a, b = shots[i]
        t = min(max(a + (b - a) / 2, a + 0.05), max(b - 0.05, a))
        if grab(path, t, out_dir / f'{i + 1:03d}.jpg', size=size):
            n += 1
    return n


# ---------- основное ----------
def analyze(path: Path, out_dir: Path, name: str, words_path: Path | None = None, beats: bool = False,
            threshold: float = 3.0, max_shots: int = 120, quiet: bool = False) -> dict:
    t0 = time.time()
    out_dir.mkdir(parents=True, exist_ok=True)
    info = probe(path)
    dur = info['duration']
    look_step = max(1, math.ceil(dur / 90))
    with tempfile.TemporaryDirectory(prefix='ref-') as td:
        tmp = Path(td)
        gray, look, _ = decode_streams(path, info, tmp, look_step)
        shots, detector_ok = detect_shots(path, info['fps'], dur, threshold, tmp)
        frames = [look[i] for i in range(len(look))]
        sblock = shots_block(shots, dur)
        face = face_block(frames)
        mblock = motion_block(gray)
        rhythm = rhythm_block(shots, mblock, dur)
        if not detector_ok:
            sblock['detector_failed'] = True
            print('Внимание: PySceneDetect не смог прочитать файл, планы не посчитаны (в профиле один план на весь ролик). Смотри лист кадров.')
        profile = {
            'schema': SCHEMA, 'name': name, 'source': path.name,
            'video': {'duration': round(dur, 2), 'width': info['width'], 'height': info['height'], 'aspect': aspect_name(info['width'], info['height']),
                      'fps': round(info['fps'], 2), 'codec': info['codec'], 'bitrate_mbps': info['bitrate_mbps']},
            'shots': sblock,
            'rhythm': rhythm,
            'motion': mblock,
            'palette': palette_block(frames, speaker_mask(face)),
            'face': face,
            'speech': speech_block(words_path),
            'audio': audio_block(path, info['has_audio']),
        }
        if beats:
            profile['audio']['beats'] = beats_block(path, tmp)
        cut_secs = {int(t) for t in rhythm['times']}
        build_sheet(frames, look_step, cut_secs, out_dir / 'sheet.jpg')
        build_hook(path, info, out_dir / 'hook.jpg', tmp)
        n_shots = build_shots(path, info, shots, out_dir / 'shots', max_shots)
    profile['files'] = {'sheet': 'sheet.jpg', 'hook': 'hook.jpg', 'shots_dir': 'shots', 'shots_saved': n_shots}
    profile['analyzer'] = {'seconds': round(time.time() - t0, 1), 'face_engine': profile['face']['engine'], 'sheet_step_s': look_step}
    write_json(out_dir / 'profile.json', profile)
    return profile


def write_json(path: Path, data: dict) -> None:
    text = json.dumps(data, ensure_ascii=False, indent=1)
    text = re.sub(r'\[\s+([-\d.,\s]+?)\s+\]', lambda m: '[' + re.sub(r'\s+', ' ', m.group(1)) + ']', text)  # числа в строку
    path.write_text(text + '\n', encoding='utf-8')


def print_summary(p: dict, out_dir: Path) -> None:
    v, s, m, pal, f, sp, a = p['video'], p['shots'], p['motion'], p['palette'], p['face'], p['speech'], p['audio']
    loud = f', {fnum(a["loudness_lufs"])} LUFS' if a.get('loudness_lufs') is not None else ''
    print(f'Референс {p["name"]} ({p["source"]})')
    print(f'  Кадр {v["width"]}x{v["height"]} ({v["aspect"]}), {fnum(v["fps"], 0)} к/с, {fnum(v["duration"])} с, '
          f'{"звук есть" + loud if a["has_audio"] else "без звука"}')
    print(f'  Планы: {s["count"]} ({fnum(s["per_minute"])} в минуту), медиана {fnum(s["median_s"], 2)} с, '
          f'10…90%: {fnum(s["p10_s"], 2)}…{fnum(s["p90_s"], 2)} с, склеек в первые 3 с: {s["hook_cuts"]}')
    print(f'  Смены сцены (склейки, хлысты, переезды камеры): {p["rhythm"]["count"]}, {fnum(p["rhythm"]["per_minute"])} в минуту, типичный промежуток {fnum(p["rhythm"]["median_gap_s"])} с')
    print(f'  Движение: среднее {fnum(m["mean"])}, пик {fnum(m["peak"])}, первые 3 с {fnum(m["first3s_mean"])}, статичных секунд {fnum(m["static_share"] * 100, 0)}%')
    print('  Палитра' + (' (без области спикера)' if pal.get('speaker_masked') else '') + ': ' + ', '.join(f'{c["hex"]} {fnum(c["share"] * 100, 0)}%' for c in pal['colors'][:5]) +
          (f'; акцент {pal["accent"]["hex"]}' if pal['accent'] else '') + f'; фон {pal["background"]} ({fnum(pal["background_lightness"], 2)})')
    box = f['box_median']
    if f['detect_rate'] is None:
        print(f'  Лицо: {f["layout_text"]}')
    else:
        print(f'  Лицо ({f["engine"]}): найдено в {fnum(f["detect_rate"] * 100, 0)}% кадров, {f["layout_text"]}' +
              (f', высота лица {fnum(box["h"] * 100, 0)}% кадра, над головой {fnum(f["free_above_head"] * 100, 0)}%' if box else ''))
    if sp:
        print(f'  Речь: {fnum(sp["words_per_second"])} слова в секунду, первые 3 с: «{sp["hook_text"]}»')
    else:
        print('  Речь: words.json рядом нет (npm run transcribe -- <ролик> <папка>/words.json), темп слов не считаем')
    if a.get('beats'):
        print(f'  Музыка: {fnum(a["beats"]["tempo_bpm"])} ударов в минуту')
    print(f'  Файлы в {out_dir}: profile.json, sheet.jpg, hook.jpg, shots/ ({p["files"]["shots_saved"]})')
    print(f'  Время замера: {fnum(p["analyzer"]["seconds"], 0)} с')


def main() -> None:
    ap = argparse.ArgumentParser(description='Замер референса: планы, движение, палитра, лицо, речь, звук.')
    ap.add_argument('video', help='ролик-референс, например work/_refs/<имя>/ref.mp4')
    ap.add_argument('--out', help='куда писать результат (по умолчанию рядом с роликом)')
    ap.add_argument('--name', help='имя референса (по умолчанию имя папки ролика)')
    ap.add_argument('--words', help='words.json с расшифровкой (по умолчанию words.json рядом с роликом)')
    ap.add_argument('--beats', action='store_true', help='посчитать темп музыки (нужен librosa)')
    ap.add_argument('--threshold', type=float, default=3.0, help='чувствительность склеек: меньше число, больше склеек (по умолчанию 3,0)')
    ap.add_argument('--max-shots', type=int, default=120, help='сколько кадров планов сохранить (по умолчанию 120)')
    args = ap.parse_args()

    need_packages()
    need_ffmpeg()
    path = Path(args.video).resolve()
    if not path.is_file():
        print(f'Файл не найден: {args.video}')
        sys.exit(2)
    lower_priority()
    out_dir = Path(args.out).resolve() if args.out else path.parent
    name = args.name or (path.parent.name if path.parent.name not in ('', '.') else path.stem)
    words = Path(args.words) if args.words else path.parent / 'words.json'
    print(f'Замеряю {path.name}, это занимает около минуты на ролик в 60 секунд…')
    try:
        profile = analyze(path, out_dir, name, words, args.beats, args.threshold, args.max_shots)
    except RuntimeError as e:
        print(f'Не получилось: {e}')
        sys.exit(1)
    print_summary(profile, out_dir)


if __name__ == '__main__':
    main()
