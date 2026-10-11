// Собирает доску раскадровки из кадров композиции: npm run board -- <композиция> [параметры]
//   npm run board -- <композиция> [--project <ролик>] [--version 3] [--words <слова.json>] [--film <ролик.mp4>]
//                    [--title "Название"] [--block 10] [--step 2] [--size 1440x2560] [--scenes <scenes.json>] [--chunk 3] [--encoder auto]
//                    [--root <папка>] [--videos work]
//
// Берёт кадры К001, К002… из последнего листа reviews/<композиция>-vNNN/ (их рисует npm run frames) и кладёт доску в
// work/<ролик>/storyboard/: board.json, frames/К001.png…, film.mp4 (если есть черновик). Тайминги берёт из frames.json рядом
// с кадрами (его пишет npm run frames); у старых листов без него время считается по шагу --step (по умолчанию 2 с).
//   --project  имя ролика (папка work/<ролик>); по умолчанию id композиции без хвоста -Reels или -YouTube
//   --words    расшифровка по словам [{text, start, end}] (npm run transcribe); без неё ищется work/<ролик>/words.json,
//              а если и её нет, у кадра в подписи будет время вместо речи
//   --film     готовый ролик для просмотра сегментов на доске; по умолчанию out/<композиция>-draft.mp4, если он есть.
//              Копия 720p кладётся в доску (нужен ffmpeg). Нет фильма: на доске видны только кадры, и это нормально.
//   --scenes   границы сцен: JSON [{"t0": 0, "t1": 3.2, "title": "Хук"}, ...]; его пишет агент по карте монтажа.
//              Сцены это клипы из фильма: нужен фильм (--film или out/<композиция>-draft.mp4), без него доска собирается только с кадрами
//   --chunk    без --scenes сцены равными кусками по N секунд (по умолчанию 3; последний короче 1,5 с приклеивается к предыдущему)
//   --encoder  чем резать клипы сцен: auto (по умолчанию: видеокарта, если есть) | cpu | nvenc | videotoolbox | qsv | amf
// В доске появляются scenes/С01.mp4 и С01.jpg (клип и постер каждой сцены).
// review.json (оценки, комментарии, сдвиги) не трогается: доску можно пересобирать после каждой новой версии листа кадров.
// Нужны только Node и (для фильма) ffmpeg.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {planScenes, buildScenes, cutScenes, pickEncoder, ENCODER_CHOICES, readScenesFile, sceneSummary, hasAudio} from './scenes.mjs';
import {readJsonFile, moveOver, cleanupOnExit, orphanReport, orphanLine, loadReview} from './store.mjs';

const VALUE_OPTS = new Set(['--project', '--version', '--words', '--film', '--title', '--block', '--step', '--size', '--scenes', '--chunk', '--encoder', '--root', '--videos']);
const opts = {}, pos = [];
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (VALUE_OPTS.has(a)) opts[a] = process.argv[++i];
  else if (a.startsWith('--')) { console.error(`неизвестный параметр ${a}`); process.exit(1); }
  else pos.push(a);
}
const fail = (m) => { console.error(m); process.exit(1); };
const [comp] = pos;
if (!comp) fail('использование: npm run board -- <композиция> [--project <ролик>] [--version N] [--words слова.json] [--film ролик.mp4] [--title "Название"] [--scenes scenes.json] [--chunk 3]');
const ROOT = path.resolve(opts['--root'] ?? process.env.STORYBOARD_ROOT ?? process.cwd());
const project = opts['--project'] ?? comp.replace(/-(Reels|YouTube)$/, '');
if (/[\\/:*?"<>|]/.test(project) || project.startsWith('.')) fail('имя ролика без слэшей и спецзнаков, не с точки: например reel-01');
const BLOCK = Number(opts['--block'] ?? 10), STEP = Number(opts['--step'] ?? 2);
if (!(BLOCK >= 0) || !(STEP > 0)) fail('--block не меньше нуля, --step больше нуля');
const CHUNK = Number(opts['--chunk'] ?? 3);
if (!(CHUNK > 0)) fail('--chunk должен быть больше нуля (секунды)');
if (opts['--encoder'] != null && !ENCODER_CHOICES.includes(opts['--encoder'])) fail(`--encoder: «${opts['--encoder']}». Допустимо: ${ENCODER_CHOICES.join(', ')}`);
const r2 = (x) => Math.round(x * 100) / 100;
const tc = (s) => { const m = Math.floor(s / 60), x = Math.floor(s - m * 60); return `${m}:${String(x).padStart(2, '0')}`; };

// какой лист кадров брать: указанный или самый новый
const reviews = path.join(ROOT, 'reviews');
const versions = fs.existsSync(reviews)
  ? fs.readdirSync(reviews).filter((d) => d.startsWith(`${comp}-v`) && /^\d+$/.test(d.slice(comp.length + 2))).map((d) => Number(d.slice(comp.length + 2))).sort((a, b) => a - b)
  : [];
const ver = opts['--version'] != null ? Number(opts['--version']) : versions.at(-1);
if (!ver || !versions.includes(ver)) fail(`нет листа кадров для «${comp}»${versions.length ? ` версии ${ver}. Есть: ${versions.join(', ')}` : ''}. Сначала запусти: npm run frames -- ${comp}`);
const srcDir = path.join(reviews, `${comp}-v${String(ver).padStart(3, '0')}`);
// кадры лежат как K001.png (латиница) или К001.png (кириллица); номер берём из имени
const files = [...new Map(fs.readdirSync(srcDir).map((n) => ({n, m: /^[KК](\d+)\.(png|jpe?g)$/i.exec(n)})).filter((x) => x.m)
  .map((x) => ({name: x.n, num: Number(x.m[1]), ext: x.m[2].toLowerCase()})).sort((a, b) => a.num - b.num || a.name.localeCompare(b.name)).map((f) => [f.num, f])).values()]; // K001.png и К001.png вместе: кадр один
if (!files.length) fail(`в ${srcDir} нет кадров K001.png… Запусти: npm run frames -- ${comp}`);

// тайминги: frames.json пишет npm run frames; без него время по шагу
let manifest = null;
const mf = path.join(srcDir, 'frames.json');
if (fs.existsSync(mf)) { try { manifest = JSON.parse(fs.readFileSync(mf, 'utf8')); } catch { /* битый файл: считаем по шагу */ } }
const sizeOpt = (opts['--size'] ?? '').match(/^(\d+)x(\d+)$/);
const W = Number(sizeOpt?.[1] ?? manifest?.width ?? 1440), H = Number(sizeOpt?.[2] ?? manifest?.height ?? 2560);
const times = files.map((f, i) => {
  const hit = manifest?.frames?.find((x) => Number(x.n) === f.num);
  return hit && Number.isFinite(Number(hit.t)) ? r2(Number(hit.t)) : r2(i * STEP);
});
let D = Number(manifest?.durationInFrames && manifest?.fps ? manifest.durationInFrames / manifest.fps : NaN);

// расшифровка речи (необязательно)
const wordsPath = opts['--words'] ? path.resolve(opts['--words']) : [path.join(ROOT, 'work', project, 'words.json')].find((p) => fs.existsSync(p));
let words = [];
if (wordsPath) {
  try {
    const raw = readJsonFile(wordsPath, undefined, 'файл слов');
    if (raw === undefined) throw new Error('нет такого файла');
    words = (Array.isArray(raw) ? raw : raw.words ?? []).map((w) => (Array.isArray(w) ? {text: w[0], s: Number(w[1]), e: Number(w[2])} : {text: w.text ?? w.word, s: Number(w.start ?? w.s), e: Number(w.end ?? w.e)}))
      .filter((w) => w.text != null && Number.isFinite(w.s) && Number.isFinite(w.e));
  } catch (e) { fail(`файл слов не читается: ${wordsPath}: ${e.message}`); }
}

// фильм для просмотра сегментов (необязательно)
const filmSrc = opts['--film'] ? path.resolve(opts['--film']) : path.join(ROOT, 'out', `${comp}-draft.mp4`);
const hasFilm = fs.existsSync(filmSrc);
if (opts['--film'] && !hasFilm) fail(`нет файла ролика: ${filmSrc}`);
const run = (cmd, args, what) => {
  const r = spawnSync(cmd, args, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024});
  if (r.error?.code === 'ENOENT') fail(`не найден ${cmd}: установи ffmpeg (в нём есть и ffprobe) и запусти снова`);
  if (r.status !== 0) fail(`${what ?? cmd} не удалось:\n${(r.stderr || '').split('\n').slice(-8).join('\n')}`);
  return r.stdout;
};
if (hasFilm && !Number.isFinite(D)) {
  const info = JSON.parse(run('ffprobe', ['-v', 'error', '-show_format', '-of', 'json', filmSrc], 'ffprobe'));
  D = Number(info.format?.duration);
}
if (!Number.isFinite(D) || !(D > 0)) D = r2(times.at(-1) + STEP); // длительность неизвестна: хвост последнего кадра берём шагом

const pad = Math.max(3, String(files.length).length);
const idOf = (num) => `К${String(num).padStart(pad, '0')}`;
const inBlock = (t0) => (BLOCK > 0 ? Math.floor(t0 / BLOCK) : 0);
const blockName = (k) => (BLOCK > 0 ? `${tc(k * BLOCK)} – ${tc(Math.min(D, (k + 1) * BLOCK))}` : 'Ролик');
const frames = files.map((f, i) => {
  const t0 = times[i], t1 = r2(Math.max(t0 + 0.1, i + 1 < files.length ? times[i + 1] : D));
  const last = i === files.length - 1;
  const text = words.filter((w) => { const mid = (w.s + w.e) / 2; return mid >= t0 && (last ? mid <= t1 + 0.5 : mid < t1); }).map((w) => w.text).join(' ').trim();
  return {id: idOf(f.num), block: blockName(inBlock(t0)), t0, t1, img: `frames/${idOf(f.num)}.${f.ext}`,
    phrase: text || (words.length ? '(без речи)' : `Кадр на ${tc(t0)}`)};
});
// сцены (нужен фильм): границы из --scenes или равные куски; считаем до записи, чтобы ошибка в файле сцен не оставила половину доски
let planned = null, scenes = null;
if (hasFilm) {
  try { planned = planScenes({duration: D, file: opts['--scenes'] ? readScenesFile(opts['--scenes']) : null, chunk: CHUNK}); } catch (e) { fail(e.message); }
  scenes = buildScenes(planned.scenes, {frames, words});
  for (const w of planned.warnings) console.warn(`  внимание: ${w}`);
}
const blocks = [];
for (const f of frames) { const b = blocks.at(-1); if (b && b.name === f.block) b.t1 = f.t1; else blocks.push({name: f.block, t0: f.t0, t1: f.t1}); }

// запись: кадры копируются в доску, чтобы она не зависела от reviews/ (там лежит только последний лист)
const OUT = path.join(ROOT, opts['--videos'] ?? 'work', project, 'storyboard');
fs.mkdirSync(path.join(OUT, 'frames'), {recursive: true});
for (const [i, f] of files.entries()) fs.copyFileSync(path.join(srcDir, f.name), path.join(OUT, frames[i].img));
let film = null, audio = false;
if (hasFilm) {
  // Фильм и клипы сцен собираются рядом с прежними и подменяют их, только когда готово всё: оборванная сборка не оставляет полудоску.
  console.log('  фильм 720p для просмотра сегментов…');
  const filmNew = path.join(OUT, 'film.new.mp4');
  cleanupOnExit(filmNew);
  run('ffmpeg', ['-v', 'error', '-y', '-i', filmSrc, '-vf', `${H > W ? 'scale=720:-2' : 'scale=-2:720'},fps=30`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-g', '15', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-threads', '4', '-movflags', '+faststart', filmNew], 'фильм 720p');
  audio = hasAudio(run, filmNew);
  console.log(`  сцены (${planned.source === 'file' ? 'из файла' : `по ${CHUNK} с`}): ${scenes.length}`);
  const encoder = (() => { try { return pickEncoder({prefer: opts['--encoder'] ?? 'auto'}); } catch (e) { return fail(e.message); } })();
  for (const w of encoder.warnings) console.warn(`  внимание: ${w}`);
  console.log(`  клипы режутся: ${encoder.label}`);
  try { cutScenes({film: filmNew, outDir: OUT, scenes, portrait: H > W, run, encoder}); } catch (e) { fail(e.message); }
  moveOver(filmNew, path.join(OUT, 'film.mp4'));
  film = 'film.mp4';
} else {
  // старый фильм от прошлой сборки не оставляем: он мог остаться от другой версии ролика
  try { fs.unlinkSync(path.join(OUT, 'film.mp4')); } catch { /* его и не было */ }
  fs.rmSync(path.join(OUT, 'scenes'), {recursive: true, force: true}); // и клипы сцен из него
}
const board = {title: opts['--title'] ?? comp, composition: comp, sheet: `${comp}-v${String(ver).padStart(3, '0')}`, duration: r2(D), film, ...(film ? {audio} : {}), width: W, height: H,
  aspect: Math.round((W / H) * 10000) / 10000, blocks, frames, ...(scenes ? {scenes} : {}), patterns: [], refs: []};
const boardF = path.join(OUT, 'board.json');
const existed = fs.existsSync(boardF);
fs.writeFileSync(`${boardF}.tmp`, JSON.stringify(board, null, 1));
moveOver(`${boardF}.tmp`, boardF);
console.log(`Доска «${board.title}»: ${frames.length} кадров из листа ${board.sheet}, ${W}×${H}, ${board.duration} с${manifest ? '' : ' (тайминги по шагу ' + STEP + ' с: у листа нет frames.json)'}.`);
console.log(`  ${existed ? 'board.json обновлён, review.json не тронут' : 'board.json создан'}; ${film ? 'фильм 720p в доске' : 'фильма нет'}; речь: ${words.length ? 'есть' : 'нет'}.`);
if (scenes) console.log(`  Сцены:
    ${sceneSummary(scenes)}`);
else console.log(`  Сцен на доске нет: клипам нужен фильм. Сделай черновик: npm run draft -- ${comp} (файл out/${comp}-draft.mp4), потом снова: npm run board -- ${comp} [--scenes scenes.json | --chunk 3]`);
if (film && !audio) console.log('  В ролике нет звука: на доске кнопка «Звук» выключена.');
try {
  const lost = orphanReport(board, loadReview(OUT).review);
  if (lost.length) console.warn(`  внимание: правки к сценам и кадрам, которых в новой версии нет, остались в review.json, но на доске их не видно: ${orphanLine(lost)}. Агент увидит их командой npm run board:read -- ${project}.`);
} catch { /* review.json не читается: об этом скажет сервер */ }
console.log(`  Папка: ${OUT}\n  Открыть доску: npm run board:open  →  http://localhost:4321`);
