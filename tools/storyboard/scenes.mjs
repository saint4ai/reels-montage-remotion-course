// Сцены доски раскадровки: границы, привязка кадров и нарезка клипов из фильма доски.
// Общий код для build-board.mjs и board-from-frames.mjs. Нужен ffmpeg (только для cutScenes), npm-пакеты не нужны.
//
// Сцена это кусок ролика с видео-клипом: владелец смотрит, как работает анимация, и комментирует её целиком.
// В board.json: scenes: [{id: "С01", title, t0, t1, clip: "scenes/С01.mp4", poster: "scenes/С01.jpg", frames: ["К001", ...], phrase?}]
// (кириллическая «С» в id, как кириллическая «К» у кадров; frames это кадры, чьё начало t0 попало в [t0, t1) сцены).
import fs from 'node:fs';
import path from 'node:path';

const r2 = (x) => Math.round(x * 100) / 100;
const EPS = 0.001;
export const GLUE_BELOW = 1.5; // последний кусок короче этого приклеивается к предыдущему

// Границы сцен. Приоритет: file (содержимое scenes.json) > равные куски по chunk секунд.
//   file: [{ "t0": 0, "t1": 3.2, "title": "Хук" }, ...]  (или { "scenes": [...] })
// Возвращает { scenes: [{t0, t1, title}], source: 'file' | 'chunk', warnings: [] }. Ошибка в данных это исключение с понятным текстом.
export function planScenes({duration, file = null, chunk = 3}) {
  const D = Number(duration);
  if (!(D > 0)) throw new Error('не известна длительность ролика, сцены не построить');
  const warnings = [];
  if (file != null) {
    const list = Array.isArray(file) ? file : file?.scenes;
    if (!Array.isArray(list) || !list.length) throw new Error('в файле сцен нужен непустой список вида [{"t0": 0, "t1": 3, "title": "Хук"}, ...]');
    let items = list.map((s, i) => {
      const t0 = Number(s?.t0), t1 = Number(s?.t1);
      if (!Number.isFinite(t0) || !Number.isFinite(t1)) throw new Error(`сцена №${i + 1} в файле сцен: нужны числа t0 и t1 (секунды)`);
      if (t0 < 0 || t1 <= t0) throw new Error(`сцена №${i + 1} в файле сцен: t0=${t0}, t1=${t1}. Нужно 0 ≤ t0 < t1`);
      return {t0: r2(t0), t1: r2(t1), title: typeof s.title === 'string' ? s.title.trim().slice(0, 80) : ''};
    }).sort((a, b) => a.t0 - b.t0);
    // сцены за пределами ролика отбрасываются, выходящие за конец обрезаются по концу
    items = items.filter((s) => { if (s.t0 >= D - 0.05) { warnings.push(`сцена «${s.title || s.t0}» начинается после конца ролика (${r2(D)} с) и не попала на доску`); return false; } return true; });
    for (const s of items) if (s.t1 > D) { warnings.push(`сцена «${s.title || s.t0}» заканчивалась на ${s.t1} с, обрезана по концу ролика (${r2(D)} с)`); s.t1 = r2(D); }
    if (!items.length) throw new Error('все сцены из файла лежат за пределами ролика');
    for (let i = 1; i < items.length; i++) {
      const a = items[i - 1], b = items[i];
      if (b.t0 < a.t1 - 0.05) throw new Error(`сцены пересекаются: «${a.title || a.t0}» (${a.t0}–${a.t1} с) и «${b.title || b.t0}» (${b.t0}–${b.t1} с)`);
      if (b.t0 < a.t1) b.t0 = a.t1; // микро-нахлёст от округления
      else if (b.t0 - a.t1 > 0.05) warnings.push(`между сценами ${a.t1} и ${b.t0} с нет сцены: этот отрезок не будет на доске`);
    }
    if (items[0].t0 > 0.05) warnings.push(`первые ${items[0].t0} с ролика не покрыты сценами`);
    if (D - items.at(-1).t1 > 0.05) warnings.push(`последние ${r2(D - items.at(-1).t1)} с ролика не покрыты сценами`);
    return {scenes: items.map((s, i) => ({...s, title: s.title || `Сцена ${i + 1}`})), source: 'file', warnings};
  }
  const step = Number(chunk);
  if (!(step > 0)) throw new Error('--chunk должен быть больше нуля');
  const pieces = [];
  for (let i = 0; i * step < D - 0.05; i++) pieces.push({t0: r2(i * step), t1: r2(Math.min(D, (i + 1) * step))});
  if (pieces.length > 1 && pieces.at(-1).t1 - pieces.at(-1).t0 < GLUE_BELOW) { const last = pieces.pop(); pieces.at(-1).t1 = last.t1; }
  return {scenes: pieces.map((p, i) => ({...p, title: `Сцена ${i + 1}`})), source: 'chunk', warnings};
}

// Готовые сцены для board.json: id, ссылки на клип и постер, кадры (по началу кадра) и речь сцены (если есть слова).
//   frames: [{id, t0, t1}], words: [{text, s, e}]
export function buildScenes(planned, {frames = [], words = []}) {
  const pad = Math.max(2, String(planned.length).length);
  return planned.map((s, i) => {
    const id = `С${String(i + 1).padStart(pad, '0')}`;
    const last = i === planned.length - 1;
    const text = words.filter((w) => { const mid = (w.s + w.e) / 2; return mid >= s.t0 && (last ? mid <= s.t1 + 0.5 : mid < s.t1); }).map((w) => w.text).join(' ').trim();
    return {id, title: s.title, t0: s.t0, t1: s.t1, clip: `scenes/${id}.mp4`, poster: `scenes/${id}.jpg`,
      frames: frames.filter((f) => f.t0 >= s.t0 - EPS && f.t0 < s.t1 - EPS).map((f) => f.id), ...(text ? {phrase: text} : {})};
  });
}

// Один ffmpeg на сцену: клип (перекодирование, звук AAC оставлен) и постер из середины сцены.
// run(cmd, args, что) падает с понятным сообщением сам (как в сборщиках).
export function cutScenes({film, outDir, scenes, portrait, run}) {
  const dir = path.join(outDir, 'scenes');
  fs.mkdirSync(dir, {recursive: true});
  // клипы прошлой сборки не оставляем: границы сцен могли поменяться
  for (const n of fs.readdirSync(dir)) if (/\.(mp4|jpg)$/i.test(n)) fs.unlinkSync(path.join(dir, n));
  // ширина клипа 720 для вертикального ролика и 960 для горизонтального, но не больше ширины фильма (картинку не растягиваем)
  const clipScale = `scale='min(${portrait ? 720 : 960},iw)':-2`;
  const posterScale = `scale='min(${portrait ? 540 : 960},iw)':-2`;
  for (const [i, s] of scenes.entries()) {
    const dur = r2(s.t1 - s.t0), mid = r2(dur / 2);
    const clip = path.join(outDir, s.clip), poster = path.join(outDir, s.poster);
    run('ffmpeg', ['-v', 'error', '-y', '-ss', String(s.t0), '-t', String(dur), '-i', film,
      '-map', '0:v:0', '-map', '0:a:0?', '-vf', clipScale, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-g', '15', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', '-threads', '4', '-movflags', '+faststart', clip,
      '-map', '0:v:0', '-ss', String(mid), '-frames:v', '1', '-vf', posterScale, '-q:v', '3', poster], `сцена ${s.id}`);
    if (!fs.existsSync(clip) || fs.statSync(clip).size < 1000) throw new Error(`клип сцены ${s.id} пустой: фильм короче, чем сцена (${s.t0}–${s.t1} с)?`);
    if ((i + 1) % 5 === 0 || i === scenes.length - 1) console.log(`  сцены: ${i + 1} из ${scenes.length}`);
  }
  return scenes.length;
}

// Файл сцен из --scenes: читает и разбирает JSON
export function readScenesFile(file) {
  let raw;
  try { raw = fs.readFileSync(path.resolve(file), 'utf8').replace(/^﻿/, ''); } catch (e) { throw new Error(`файл сцен не читается: ${file}: ${e.message}`); }
  try { return JSON.parse(raw); } catch (e) { throw new Error(`файл сцен ${file} не разбирается как JSON: ${e.message}`); }
}

export const sceneSummary = (scenes) => scenes.map((s) => `${s.id} ${r2(s.t0)}–${r2(s.t1)} с «${s.title}» (кадров ${s.frames.length})`).join('\n    ');
