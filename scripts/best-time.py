"""Лучшее время выкладки по твоим роликам: средние по слотам из выгрузки статистики Zernio.

    python scripts/best-time.py work/_profile/post-stats.csv --tz Asia/Almaty --slots 12,20,23
    python scripts/best-time.py zernio-analytics.json --platform instagram --min-age-hours 48
    python scripts/best-time.py --selftest

Вход (один файл):
  * CSV с заголовком. Нужны столбцы: published_at (дата и время публикации, ISO, лучше с поясом или в UTC) и views.
    Необязательные: platform, post_id, reach, skip_rate (доля пропуска в первые 3 секунды, %), avg_watch_ms (среднее время просмотра, мс),
    saves, shares. Названия столбцов можно писать и по-zernio: publishedAt, reelsSkipRate, igReelsAvgWatchTime.
  * JSON: ответ GET /v1/analytics (объект с массивом posts) или просто массив постов. Метрики берутся из полей поста и из вложенного analytics.
    Точные имена полей списка в документации Zernio не показаны, поэтому имена ищутся по нескольким вариантам. Если слот не считается, открой JSON и сверь имена.

Слоты задаются часами начала по местному времени: `--slots 8,12,16,20,23` значит 08:00-11:59, 12:00-15:59, 16:00-19:59, 20:00-22:59, 23:00-07:59.
Сколько слотов брать: при ролике в день 3 слота на 2 недели (14 роликов, в слоте 4-5) или 5 слотов на 3 недели (21 ролик, в слоте 4-5).
5 слотов на 2 недели дают по 2-3 ролика на слот, а для сравнения нужно не меньше 3.
Местное время: `--tz Asia/Almaty` (нужен пакет tzdata на Windows) или `--utc-offset 5`. Казахстан сейчас UTC+5 круглый год.

Правило сравнения (рабочее правило курса, не закон статистики):
  * слот сравнивают, если в нём не меньше 3 роликов (`--min-posts`);
  * разница в медиане просмотров меньше 20% (`--tie`) считается ничьей;
  * при ничьей смотрят долю пропуска: меньше лучше.
Замер ролика берётся через 48 часов после выкладки: передай файл, где цифры сняты в этот срок. Фильтр `--min-age-hours` отбрасывает свежие ролики.
Скрипт ничего не отправляет в сеть, только читает файл."""

from __future__ import annotations

import argparse
import csv
import json
import statistics
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ALIASES = {
    "published_at": ("published_at", "publishedat", "published", "date", "posted_at", "scheduledfor"),
    "platform": ("platform",),
    "post_id": ("post_id", "postid", "id", "_id"),
    "views": ("views", "video_views", "plays"),
    "reach": ("reach",),
    "skip_rate": ("skip_rate", "skiprate", "reelsskiprate", "reels_skip_rate"),
    "avg_watch_ms": ("avg_watch_ms", "igreelsavgwatchtime", "ig_reels_avg_watch_time", "avgwatchtime"),
    "saves": ("saves",),
    "shares": ("shares",),
}


# Пояса без переходов на летнее время: считаются и без базы tzdata
FIXED_ZONES = {"Asia/Almaty": 5, "Asia/Astana": 5, "Asia/Tashkent": 5, "Europe/Moscow": 3}


def _norm(name: str) -> str:
    return "".join(ch for ch in str(name).lower() if ch.isalnum() or ch == "_")


def _flatten(item: dict) -> dict:
    """Метрики лежат то в самом посте, то в analytics/metrics: сводим в один плоский словарь."""
    flat = {}
    for key in ("metrics", "analytics"):
        if isinstance(item.get(key), dict):
            flat.update({_norm(k): v for k, v in item[key].items()})
    flat.update({_norm(k): v for k, v in item.items() if not isinstance(v, (dict, list))})
    return flat


def _num(value):
    if value is None or value == "":
        return None
    try:
        return float(str(value).replace(",", ".").replace("%", "").strip())
    except ValueError:
        return None


def _when(value) -> datetime | None:
    if not value:
        return None
    text = str(value).strip().replace("Z", "+00:00")
    try:
        moment = datetime.fromisoformat(text)
    except ValueError:
        return None
    return moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)


def read_posts(path: Path) -> list[dict]:
    raw = path.read_text(encoding="utf-8-sig")
    rows: list[dict]
    if path.suffix.lower() == ".json":
        data = json.loads(raw)
        if isinstance(data, dict):
            data = data.get("posts") or data.get("data") or []
        rows = [_flatten(item) for item in data if isinstance(item, dict)]
    else:
        rows = [{_norm(k): v for k, v in row.items()} for row in csv.DictReader(raw.splitlines())]
    posts = []
    for row in rows:
        post = {}
        for field, names in ALIASES.items():
            value = next((row[n] for n in names if n in row and row[n] not in (None, "")), None)
            post[field] = value
        post["when"] = _when(post["published_at"])
        for field in ("views", "reach", "skip_rate", "avg_watch_ms", "saves", "shares"):
            post[field] = _num(post[field])
        posts.append(post)
    return posts


def local_zone(tz_name: str | None, offset: float | None):
    if offset is not None:
        return timezone(timedelta(hours=offset))
    if tz_name:
        try:
            from zoneinfo import ZoneInfo
            return ZoneInfo(tz_name)
        except Exception:  # на Windows нет базы поясов без пакета tzdata
            if tz_name in FIXED_ZONES:
                return timezone(timedelta(hours=FIXED_ZONES[tz_name]))
            print(f"Пояс {tz_name} не найден (на Windows поставь пакет tzdata: pip install tzdata, или задай --utc-offset <часы>). Считаю по UTC+5.", file=sys.stderr)
    return timezone(timedelta(hours=5))


def slot_of(hour: int, starts: list[int]) -> int:
    """Номер слота для часа: последний старт не позже часа, до первого старта идёт последний слот (через полночь)."""
    best = None
    for s in starts:
        if s <= hour:
            best = s
    return best if best is not None else starts[-1]


def slot_label(start: int, starts: list[int]) -> str:
    i = starts.index(start)
    end = starts[(i + 1) % len(starts)]
    return f"{start:02d}:00-{(end - 1) % 24:02d}:59"


def summarize(posts: list[dict], starts: list[int], zone, platform: str | None, min_age_hours: float, now: datetime) -> list[dict]:
    groups: dict[int, list[dict]] = {s: [] for s in starts}
    for p in posts:
        if p["when"] is None or p["views"] is None:
            continue
        if platform and (p["platform"] or "").lower() != platform.lower():
            continue
        if now - p["when"] < timedelta(hours=min_age_hours):
            continue
        groups[slot_of(p["when"].astimezone(zone).hour, starts)].append(p)

    def med(seq):
        seq = [x for x in seq if x is not None]
        return statistics.median(seq) if seq else None

    result = []
    for s in starts:
        g = groups[s]
        result.append({"start": s, "label": slot_label(s, starts), "n": len(g),
                       "views": med([p["views"] for p in g]), "skip": med([p["skip_rate"] for p in g]),
                       "watch": med([p["avg_watch_ms"] for p in g]),
                       "per1000": med([((p["saves"] or 0) + (p["shares"] or 0)) / p["reach"] * 1000 for p in g if p["reach"]])})
    return result


def verdict(rows: list[dict], min_posts: int, tie: float) -> str:
    ok = [r for r in rows if r["n"] >= min_posts and r["views"] is not None]
    if len(ok) < 2:
        return f"Мало данных: нужно хотя бы два слота, в каждом не меньше {min_posts} роликов. Выкладывай дальше и повтори замер. Схема: 3 слота на 2 недели или 5 слотов на 3 недели (по ролику в день, в слоте 4-5 роликов)."
    ok.sort(key=lambda r: r["views"], reverse=True)
    best, second = ok[0], ok[1]
    gap = (best["views"] - second["views"]) / best["views"] if best["views"] else 0
    if gap >= tie:
        return f"Лидер: {best['label']} (медиана просмотров {best['views']:.0f}, второй слот {second['label']} на {gap * 100:.0f}% ниже)."
    # ничья по просмотрам: смотрим долю пропуска среди слотов, чья медиана в пределах допуска
    close = [r for r in ok if (best["views"] - r["views"]) / best["views"] < tie and r["skip"] is not None]
    if len(close) >= 2:
        c = min(close, key=lambda r: r["skip"])
        return f"Просмотры почти равны (разница меньше {tie * 100:.0f}%). По доле пропуска впереди {c['label']} ({c['skip']:.0f}%). Это подсказка, не победа: повтори на новых роликах."
    return f"Ничья: разница в медиане просмотров меньше {tie * 100:.0f}%. Оставь оба слота и повтори замер на новых роликах."


def render(rows: list[dict], text: str, out=print, min_posts: int = 3) -> None:
    def f(v, fmt="{:.0f}"):
        return "-" if v is None else fmt.format(v)

    out(f"{'слот (местное время)':<22}{'роликов':>8}{'мед. просмотры':>16}{'мед. пропуск, %':>17}{'ср. просмотр, с':>17}{'сохр.+репост на 1000':>22}")
    for r in rows:
        mark = "  мало данных" if r["n"] < min_posts else ""
        out(f"{r['label']:<22}{r['n']:>8}{f(r['views']):>16}{f(r['skip']):>17}{f(r['watch'] / 1000 if r['watch'] is not None else None, '{:.1f}'):>17}{f(r['per1000'], '{:.1f}'):>22}{mark}")
    out("")
    out(text)


def selftest() -> None:
    zone = timezone(timedelta(hours=5))
    now = datetime(2026, 11, 1, 12, tzinfo=timezone.utc)
    starts = [8, 12, 16, 20, 23]
    assert [slot_of(h, starts) for h in (7, 8, 11, 12, 19, 20, 22, 23, 0)] == [23, 8, 8, 12, 16, 20, 20, 23, 23]
    assert slot_label(23, starts) == "23:00-07:59" and slot_label(8, starts) == "08:00-11:59"
    rows = []
    # вечерний слот (20:00 по Алматы = 15:00 UTC) собирает больше просмотров, утренний (08:00 = 03:00 UTC) меньше
    for day, (utc_hour, views, skip) in enumerate([(15, 9000, 35)] * 4 + [(3, 3000, 55)] * 4 + [(7, 3100, 54)] * 3):
        when = datetime(2026, 10, 1 + day, utc_hour, tzinfo=timezone.utc).isoformat()
        rows.append({"publishedAt": when, "platform": "instagram", "analytics": {"views": views, "reach": views, "saves": 30, "shares": 20,
                                                                                  "reelsSkipRate": skip, "igReelsAvgWatchTime": 9000}})
    tmp = Path(__file__).with_name("_best_time_selftest.json")
    try:
        tmp.write_text(json.dumps({"posts": rows}), encoding="utf-8")
        posts = read_posts(tmp)
    finally:
        tmp.unlink(missing_ok=True)
    assert len(posts) == 11 and posts[0]["views"] == 9000 and posts[0]["skip_rate"] == 35 and posts[0]["avg_watch_ms"] == 9000
    table = summarize(posts, starts, zone, "instagram", 48, now)
    by = {r["start"]: r for r in table}
    assert by[20]["n"] == 4 and by[20]["views"] == 9000 and by[8]["n"] == 4 and by[12]["n"] == 3 and by[16]["n"] == 0
    assert round(by[20]["per1000"], 1) == round(50 / 9000 * 1000, 1)
    assert "Лидер: 20:00-22:59" in verdict(table, 3, 0.2)
    # ничья и нехватка данных
    tie = [dict(r, views=3000 if r["start"] in (8, 12) else None) for r in table]
    assert "Просмотры почти равны" in verdict([r for r in tie if r["views"]], 3, 0.2) or "Ничья" in verdict([r for r in tie if r["views"]], 3, 0.2)
    assert verdict(summarize(posts[:2], starts, zone, None, 48, now), 3, 0.2).startswith("Мало данных")
    # свежие ролики (моложе 48 часов) не считаются
    fresh = summarize(posts, starts, zone, "instagram", 48, datetime(2026, 10, 2, 12, tzinfo=timezone.utc))
    assert sum(r["n"] for r in fresh) < 11
    # CSV с названиями Zernio и запятой в числе
    csv_path = Path(__file__).with_name("_best_time_selftest.csv")
    try:
        csv_path.write_text("publishedAt,platform,views,reelsSkipRate\n2026-10-01T15:00:00Z,instagram,1000,\"40,5\"\n", encoding="utf-8")
        one = read_posts(csv_path)
    finally:
        csv_path.unlink(missing_ok=True)
    assert one[0]["skip_rate"] == 40.5 and one[0]["when"].hour == 15
    print("selftest: всё в порядке")


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description="Лучшее время выкладки по выгрузке статистики Zernio")
    ap.add_argument("file", nargs="?", help="CSV или JSON со статистикой постов")
    ap.add_argument("--tz", help="пояс аудитории, например Asia/Almaty")
    ap.add_argument("--utc-offset", type=float, help="сдвиг от UTC в часах, если --tz недоступен")
    ap.add_argument("--slots", default="8,12,16,20,23", help="часы начала слотов по местному времени, через запятую")
    ap.add_argument("--platform", help="только эта площадка: instagram, tiktok, youtube")
    ap.add_argument("--min-age-hours", type=float, default=48, help="не считать ролики моложе этого срока (по умолчанию 48)")
    ap.add_argument("--min-posts", type=int, default=3, help="сколько роликов нужно в слоте для сравнения")
    ap.add_argument("--tie", type=float, default=0.2, help="разница медиан просмотров, ниже которой ничья")
    ap.add_argument("--now", help="текущий момент ISO (для проверок), по умолчанию сейчас")
    ap.add_argument("--selftest", action="store_true", help="проверить сам скрипт на выдуманных данных")
    args = ap.parse_args()
    if args.selftest:
        selftest()
        return 0
    if not args.file:
        ap.error("укажи файл со статистикой")
    try:
        starts = sorted({int(x) % 24 for x in args.slots.split(",") if x.strip()})
    except ValueError:
        ap.error("--slots: часы через запятую, например 8,12,16,20,23")
    if len(starts) < 2:
        ap.error("--slots: нужно хотя бы два слота")
    path = Path(args.file)
    if not path.is_file():
        print(f"Нет файла {path}", file=sys.stderr)
        return 1
    posts = read_posts(path)
    if not any(p["when"] and p["views"] is not None for p in posts):
        print("В файле нет ни одного поста с датой и просмотрами. Проверь названия полей (published_at, views).", file=sys.stderr)
        return 1
    now = _when(args.now) if args.now else datetime.now(timezone.utc)
    zone = local_zone(args.tz, args.utc_offset)
    rows = summarize(posts, starts, zone, args.platform, args.min_age_hours, now)
    render(rows, verdict(rows, args.min_posts, args.tie), min_posts=args.min_posts)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
