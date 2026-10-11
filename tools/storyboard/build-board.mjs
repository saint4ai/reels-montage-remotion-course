// Собирает доску раскадровки из готового ролика: кадр каждые 2 секунды, фильм 720p для просмотра, board.json.
//   node tools/storyboard/build-board.mjs <проект> --video <ролик.mp4> [--words <слова.json>] [--title "Название"]
//        [--every 2] [--block 10] [--max <секунд>] [--scenes <scenes.json>] [--chunk 3] [--root <папка>] [--videos work] [--out <папка доски>]
//
//   <проект>     имя ролика (папка), например reel-01. Доска будет в <root>/work/<проект>/storyboard/
//   --video      готовый ролик, любой формат, который читает ffmpeg (вертикальный и горизонтальный)
//   --words      необязательно: JSON со словами речи и таймингами [["слово", начало_сек, конец_сек], ...];
//                слова попадают в «фразу» кадра, на котором начались
//   --title      название на доске (по умолчанию имя файла ролика)
//   --every      шаг кадров в секундах (по умолчанию 2)
//   --block      длина блока в секундах: блоки группируют кадры на доске (по умолчанию 10, 0 = один блок)
//   --max        взять только первые N секунд ролика
//   --scenes     границы сцен: JSON [{"t0": 0, "t1": 3.2, "title": "Хук"}, ...]; его пишет монтажёр по карте монтажа
//   --chunk      без --scenes сцены равными кусками по N секунд (по умолчанию 3; последний короче 1,5 с приклеивается к предыдущему)
//
// Пишет: board.json, film.mp4 (720p), frames/К001.jpg, К002.jpg, ..., scenes/С01.mp4 и С01.jpg (клип и постер каждой сцены).
// review.json (правки автора) не трогает,
// поэтому доску можно пересобрать по новой версии ролика: комментарии и сдвиги остаются привязаны к номерам кадров.
// Для композиции Remotion проще npm run board -- <композиция> (tools/storyboard/board-from-frames.mjs): он берёт кадры листа reviews/.
// Нужны только Node и ffmpeg (вместе с ним ставится ffprobe), npm-пакеты не нужны.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {planScenes, buildScenes, cutScenes, readScenesFile, sceneSummary, hasAudio} from './scenes.mjs';
import {readJsonFile, moveOver, cleanupOnExit, orphanReport, orphanLine, loadReview} from './store.mjs';

const VALUE_OPTS = new Set(['--video', '--words', '--title', '--every', '--block', '--max', '--scenes', '--chunk', '--root', '--videos', '--out']);
const opts = {}, pos = [];
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (VALUE_OPTS.has(a)) opts[a] = process.argv[++i];
  else if (a.startsWith('--')) { console.error(`неизвестный параметр ${a}`); process.exit(1); }
  else pos.push(a);
}
const fail = (m) => { console.error(m); process.exit(1); };
const [project] = pos;
if (!project || !opts['--video']) fail('использование: node tools/storyboard/build-board.mjs <проект> --video <ролик.mp4> [--words <слова.json>] [--title "Название"] [--every 2] [--block 10] [--max <сек>] [--scenes scenes.json] [--chunk 3]');
if (/[\\/:*?"<>|]/.test(project) || project.startsWith('.')) fail('имя проекта без слэшей и спецзнаков, не с точки: например reel-01');
const VIDEO = path.resolve(opts['--video']);
if (!fs.existsSync(VIDEO)) fail(`нет файла ролика: ${VIDEO}`);
const ROOT = path.resolve(opts['--root'] ?? process.env.STORYBOARD_ROOT ?? process.cwd());
const OUT = path.resolve(opts['--out'] ?? path.join(ROOT, opts['--videos'] ?? 'work', project, 'storyboard'));
const EVERY = Number(opts['--every'] ?? 2), BLOCK = Number(opts['--block'] ?? 10), MAX = opts['--max'] != null ? Number(opts['--max']) : Infinity;
if (!(EVERY > 0) || !(BLOCK >= 0) || !(MAX > 0)) fail('--every и --max должны быть больше нуля, --block не меньше нуля');
const CHUNK = Number(opts['--chunk'] ?? 3);
if (!(CHUNK > 0)) fail('--chunk должен быть больше нуля (секунды)');

const run = (cmd, args, what) => {
  const r = spawnSync(cmd, args, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024});
  if (r.error?.code === 'ENOENT') fail(`не найден ${cmd}: установи ffmpeg (в нём есть и ffprobe) и запусти снова`);
  if (r.status !== 0) fail(`${what ?? cmd} не удалось:\n${(r.stderr || '').split('\n').slice(-8).join('\n')}`);
  return r.stdout;
};
const r2 = (x) => Math.round(x * 100) / 100;
const tc = (s) => { const m = Math.floor(s / 60), x = Math.floor(s - m * 60); return `${m}:${String(x).padStart(2, '0')}`; };

// размеры, частота и длительность ролика (с учётом поворота из метаданных телефона)
const info = JSON.parse(run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_streams', '-show_format', '-of', 'json', VIDEO], 'ffprobe'));
const vs = info.streams?.[0];
if (!vs) fail('в файле нет видеодорожки');
const rot = Math.abs(Number(vs.tags?.rotate ?? vs.side_data_list?.find((x) => x.rotation != null)?.rotation ?? 0)) % 180 === 90;
const W = rot ? vs.height : vs.width, H = rot ? vs.width : vs.height;
const fps = (() => { const [a, b] = String(vs.r_frame_rate ?? '30/1').split('/').map(Number); return b ? a / b : a || 30; })();
const full = Number(info.format?.duration ?? vs.duration);
if (!(full > 0)) fail('не удалось узнать длительность ролика');
const D = r2(Math.min(full, MAX));
const portrait = H > W;

// слова речи с таймингами (необязательно)
let words = [];
if (opts['--words']) {
  let raw;
  try { raw = readJsonFile(path.resolve(opts['--words']), undefined, 'файл слов'); if (raw === undefined) throw new Error('нет такого файла'); } catch (e) { fail(`файл слов не читается: ${e.message}`); }
  raw = Array.isArray(raw) ? raw : raw.words ?? [];
  words = raw.map((w) => (Array.isArray(w) ? {text: w[0], s: Number(w[1]), e: Number(w[2])} : {text: w.word ?? w.text, s: Number(w.start ?? w.s), e: Number(w.end ?? w.e)}))
    .filter((w) => w.text != null && Number.isFinite(w.s) && Number.isFinite(w.e));
  if (!words.length) fail('в файле слов нет ни одной записи вида ["слово", начало, конец]');
}

// кадры: каждые EVERY секунд; слишком короткий хвост присоединяется к последнему кадру
const starts = [];
for (let i = 0; i * EVERY < D - 0.05; i++) starts.push(r2(i * EVERY));
let frames = starts.map((t0, i) => ({t0, t1: r2(i + 1 < starts.length ? starts[i + 1] : D)}));
if (frames.length > 1 && frames.at(-1).t1 - frames.at(-1).t0 < EVERY * 0.3) { const last = frames.pop(); frames.at(-1).t1 = last.t1; }
const pad = String(frames.length).length > 3 ? String(frames.length).length : 3;
const inBlock = (t0) => (BLOCK > 0 ? Math.floor(t0 / BLOCK) : 0);
const blockName = (k) => (BLOCK > 0 ? `${tc(k * BLOCK)} – ${tc(Math.min(D, (k + 1) * BLOCK))}` : 'Ролик');
frames = frames.map((f, i) => {
  const last = i === frames.length - 1;
  const text = words.filter((w) => { const mid = (w.s + w.e) / 2; return mid >= f.t0 && (last ? mid <= f.t1 + 0.5 : mid < f.t1); }).map((w) => w.text).join(' ').trim();
  return {id: `К${String(i + 1).padStart(pad, '0')}`, block: blockName(inBlock(f.t0)), t0: f.t0, t1: f.t1,
    phrase: text || (words.length ? '(без речи)' : `Кадр на ${tc(f.t0)}`), img: `frames/К${String(i + 1).padStart(pad, '0')}.jpg`};
});
// сцены: границы из --scenes или равные куски; считаем до долгой нарезки, чтобы ошибка в файле сцен не стоила минут работы
let planned;
try { planned = planScenes({duration: D, file: opts['--scenes'] ? readScenesFile(opts['--scenes']) : null, chunk: CHUNK}); } catch (e) { fail(e.message); }
const scenes = buildScenes(planned.scenes, {frames, words});
for (const w of planned.warnings) console.warn(`  внимание: ${w}`);
const blocks = [];
for (const f of frames) { const b = blocks.at(-1); if (b && b.name === f.block) b.t1 = f.t1; else blocks.push({name: f.block, t0: f.t0, t1: f.t1}); }

fs.mkdirSync(path.join(OUT, 'frames'), {recursive: true});
console.log(`Ролик ${path.basename(VIDEO)}: ${W}x${H}, ${D} с${D < full ? ` (из ${r2(full)})` : ''}. Кадров: ${frames.length}, каждые ${EVERY} с.`);

// картинки кадров: из середины отрезка, 540 px по ширине для вертикального ролика, 960 для горизонтального
const thumb = portrait ? 'scale=540:-2' : 'scale=960:-2';
for (const [i, f] of frames.entries()) {
  run('ffmpeg', ['-v', 'error', '-y', '-ss', String(r2((f.t0 + f.t1) / 2)), '-i', VIDEO, '-frames:v', '1', '-vf', thumb, '-q:v', '3', path.join(OUT, f.img)], `кадр ${f.id}`);
  if ((i + 1) % 5 === 0 || i === frames.length - 1) console.log(`  кадры: ${i + 1} из ${frames.length}`);
}

// фильм для просмотра на доске: 720p по короткой стороне, ключевые кадры каждые 0,5 с (быстрая перемотка)
// Фильм и клипы сцен собираются рядом с прежними и подменяют их, только когда готово всё: оборванная сборка не оставляет полудоску.
console.log('  фильм 720p…');
const filmNew = path.join(OUT, 'film.new.mp4');
cleanupOnExit(filmNew);
run('ffmpeg', ['-v', 'error', '-y', '-i', VIDEO, '-t', String(D), '-vf', `${portrait ? 'scale=720:-2' : 'scale=-2:720'},fps=${Math.min(Math.round(fps), 30)}`,
  '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-g', '15', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-threads', '4', '-movflags', '+faststart', filmNew], 'фильм 720p');
const audio = hasAudio(run, filmNew);

// клипы сцен режутся из готового фильма доски (по одному ffmpeg на сцену)
console.log(`  сцены (${planned.source === 'file' ? 'из файла' : `по ${CHUNK} с`}): ${scenes.length}`);
try { cutScenes({film: filmNew, outDir: OUT, scenes, portrait, run}); } catch (e) { fail(e.message); }
moveOver(filmNew, path.join(OUT, 'film.mp4'));

const title = opts['--title'] ?? path.basename(VIDEO, path.extname(VIDEO));
const board = {title, duration: D, film: 'film.mp4', audio, width: W, height: H, aspect: Math.round((W / H) * 10000) / 10000, blocks, frames, scenes, patterns: [], refs: []};
const boardF = path.join(OUT, 'board.json');
const existed = fs.existsSync(boardF);
fs.writeFileSync(`${boardF}.tmp`, JSON.stringify(board, null, 1));
moveOver(`${boardF}.tmp`, boardF);
const mb = (fs.statSync(path.join(OUT, 'film.mp4')).size / 1048576).toFixed(1);
console.log(`Готово: ${OUT}
  ${existed ? 'board.json обновлён, review.json не тронут' : 'board.json создан'}; фильм ${mb} МБ.
  Сцены:
    ${sceneSummary(scenes)}
  Запуск доски: npm run board:open  →  http://localhost:4321`);
if (!audio) console.log('  В ролике нет звука: на доске кнопка «Звук» выключена.');
try {
  const lost = orphanReport(board, loadReview(OUT).review);
  if (lost.length) console.warn(`  внимание: правки к сценам и кадрам, которых в новой версии нет, остались в review.json, но на доске их не видно: ${orphanLine(lost)}. Агент увидит их командой npm run board:read -- ${project}.`);
} catch { /* review.json не читается: об этом скажет сервер */ }
