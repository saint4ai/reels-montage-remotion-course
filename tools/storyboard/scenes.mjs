// Сцены доски раскадровки: границы, привязка кадров и нарезка клипов из фильма доски.
// Общий код для build-board.mjs и board-from-frames.mjs. Нужен ffmpeg (только для cutScenes), npm-пакеты не нужны.
//
// Сцена это кусок ролика с видео-клипом: владелец смотрит, как работает анимация, и комментирует её целиком.
// В board.json: scenes: [{id: "С01", title, t0, t1, clip: "scenes/С01.mp4", poster: "scenes/С01.jpg", frames: ["К001", ...], phrase?}]
// (кириллическая «С» в id, как кириллическая «К» у кадров; frames это кадры, чьё начало t0 попало в [t0, t1) сцены).
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {decodeText, moveOver, cleanupOnExit} from './store.mjs';

const r2 = (x) => Math.round(x * 100) / 100;
const EPS = 0.001;
export const GLUE_BELOW = 1.5; // последний кусок короче этого приклеивается к предыдущему
export const MIN_SCENE = 0.2;  // сцена короче не даёт клипа: ffmpeg отдаёт пустой файл
export const MAX_SCENES = 300; // больше сцен на одной доске не листать; почти наверняка опечатка в --chunk или в scenes.json
// число из файла сцен: число или строка с числом; null, пустая строка и true раньше молча становились 0 и 1
const num = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);

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
    if (list.length > MAX_SCENES) throw new Error(`в файле сцен ${list.length} записей, а на доске не больше ${MAX_SCENES}: проверь файл`);
    let items = list.map((s, i) => {
      const t0 = num(s?.t0), t1 = num(s?.t1);
      if (!Number.isFinite(t0) || !Number.isFinite(t1)) throw new Error(`сцена №${i + 1} в файле сцен: нужны числа t0 и t1 (секунды)`);
      if (t0 < 0 || t1 <= t0) throw new Error(`сцена №${i + 1} в файле сцен: t0=${t0}, t1=${t1}. Нужно 0 ≤ t0 < t1`);
      // название одной строкой: перевод строки ломал вывод cli и заголовок карточки
      return {t0: r2(t0), t1: r2(t1), title: typeof s.title === 'string' ? s.title.replace(/\s+/g, ' ').trim().slice(0, 80) : ''};
    }).sort((a, b) => a.t0 - b.t0);
    // сцены за пределами ролика отбрасываются, выходящие за конец обрезаются по концу
    items = items.filter((s) => { if (s.t0 >= D - MIN_SCENE) { warnings.push(`сцена «${s.title || s.t0}» начинается после конца ролика (${r2(D)} с) или меньше чем за 0,2 с до него и не попала на доску`); return false; } return true; });
    for (const s of items) if (s.t1 > D) { warnings.push(`сцена «${s.title || s.t0}» заканчивалась на ${s.t1} с, обрезана по концу ролика (${r2(D)} с)`); s.t1 = r2(D); }
    if (!items.length) throw new Error('все сцены из файла лежат за пределами ролика');
    for (const s of items) if (s.t1 - s.t0 < MIN_SCENE) throw new Error(`сцена «${s.title || s.t0}» (${s.t0}–${s.t1} с) короче ${String(MIN_SCENE).replace(".", ",")} с: клип из неё не получится. Объедини её с соседней`);
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
  if (Math.ceil(D / step) > MAX_SCENES) throw new Error(`при --chunk ${step} с в ролике на ${r2(D)} с выйдет ${Math.ceil(D / step)} сцен, а на доске не больше ${MAX_SCENES}. Увеличь --chunk`);
  const pieces = [];
  for (let i = 0; i * step < D - 0.05; i++) pieces.push({t0: r2(i * step), t1: r2(Math.min(D, (i + 1) * step))});
  pieces.at(-1).t1 = r2(D); // последний кусок доходит до конца ролика (хвост короче 0,05 с раньше оставался за кадром)
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

// Кодировщики клипов. Порядок авто-выбора: видеокарта (Mac, NVIDIA, Intel, AMD), иначе процессор.
// Качество близко к libx264 crf 26 (у amf режим cqp: qp_i и qp_p действуют только в нём). У videotoolbox два варианта: -q:v есть не везде (на Mac с Intel его нет), тогда берётся битрейт.
export const CPU_ENCODER = {id: 'cpu', codec: 'libx264', label: 'процессор (libx264)', args: ['-preset', 'veryfast', '-crf', '26', '-threads', '4']};
export const ENCODERS = [
  {id: 'videotoolbox', codec: 'h264_videotoolbox', label: 'видеокарта Mac (VideoToolbox)', args: ['-q:v', '60']},
  {id: 'videotoolbox', codec: 'h264_videotoolbox', label: 'видеокарта Mac (VideoToolbox)', args: ['-b:v', '3M']},
  {id: 'nvenc', codec: 'h264_nvenc', label: 'видеокарта NVIDIA (NVENC)', args: ['-preset', 'p4', '-rc', 'vbr', '-cq', '26', '-b:v', '0']},
  {id: 'qsv', codec: 'h264_qsv', label: 'видеокарта Intel (Quick Sync)', args: ['-global_quality', '26']},
  {id: 'amf', codec: 'h264_amf', label: 'видеокарта AMD (AMF)', args: ['-quality', 'balanced', '-rc', 'cqp', '-qp_i', '26', '-qp_p', '26']},
  CPU_ENCODER,
];
export const ENCODER_CHOICES = ['auto', 'cpu', 'nvenc', 'videotoolbox', 'qsv', 'amf'];
// общие параметры видео, кроме самого кодировщика
const COMMON_V = ['-g', '15', '-pix_fmt', 'yuv420p'];
const encoderArgs = (enc) => ['-c:v', enc.codec, ...enc.args, ...COMMON_V];

// Реальные источники для pickEncoder: список кодировщиков ffmpeg и пробное кодирование 0,5 с чёрного кадра в никуда.
export function ffmpegEncoderList() {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-encoders'], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
  return r.status === 0 ? String(r.stdout) : '';
}
export function probeEncoder(enc) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=320x240:d=0.5', ...encoderArgs(enc), '-f', 'null', '-'],
    {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000});
  return r.status === 0;
}

// Выбор кодировщика один раз за сборку. prefer: auto | cpu | nvenc | videotoolbox | qsv | amf.
// listing (текст `ffmpeg -encoders`) и probe(enc) → true/false подставляются в тесте; без них спрашивается настоящий ffmpeg.
// Кодировщик из списка проходит пробный прогон; упавший пропускается, берётся следующий по порядку. Явно названный, но
// недоступный кодировщик не ломает сборку: берётся процессор, пояснение остаётся в warnings.
// Возвращает {id, codec, label, args (полный набор видеопараметров), warnings}.
export function pickEncoder({prefer = 'auto', listing, probe = probeEncoder} = {}) {
  if (!ENCODER_CHOICES.includes(prefer)) throw new Error(`--encoder: «${prefer}». Допустимо: ${ENCODER_CHOICES.join(', ')}`);
  const warnings = [];
  const done = (enc) => ({id: enc.id, codec: enc.codec, label: enc.label, args: encoderArgs(enc), warnings});
  if (prefer === 'cpu') return done(CPU_ENCODER);
  const text = listing ?? ffmpegEncoderList();
  const listed = (enc) => new RegExp(`\\b${enc.codec}\\b`).test(text);
  for (const enc of ENCODERS.filter((e) => e.id !== 'cpu' && (prefer === 'auto' || e.id === prefer))) {
    if (!listed(enc)) continue;
    let ok = false;
    try { ok = probe(enc) === true; } catch { ok = false; }
    if (ok) return done(enc);
  }
  if (prefer !== 'auto') warnings.push(`кодировщик «${prefer}» недоступен на этом компьютере (его нет в ffmpeg или пробный прогон не прошёл), клипы режутся на процессоре`);
  return done(CPU_ENCODER);
}

// Один ffmpeg на сцену: клип (перекодирование кодировщиком из pickEncoder, по умолчанию процессор; звук AAC оставлен) и постер из середины сцены.
// run(cmd, args, что) падает с понятным сообщением сам (как в сборщиках).
// Всё режется во временную папку и подменяет прежние клипы только после того, как получились все сцены:
// оборванная нарезка (ffmpeg упал, закончилось место) не оставляет доску без клипов.
export function cutScenes({film, outDir, scenes, portrait, run, encoder = pickEncoder({prefer: 'cpu'})}) {
  const dir = path.join(outDir, 'scenes'), stage = path.join(outDir, '.scenes-new');
  fs.rmSync(stage, {recursive: true, force: true});
  fs.mkdirSync(stage, {recursive: true});
  cleanupOnExit(stage);
  // ширина клипа 720 для вертикального ролика и 960 для горизонтального, но не больше ширины фильма (картинку не растягиваем)
  const clipScale = `scale='min(${portrait ? 720 : 960},iw)':-2`;
  const posterScale = `scale='min(${portrait ? 540 : 960},iw)':-2`;
  try {
    for (const [i, s] of scenes.entries()) {
      const dur = r2(s.t1 - s.t0), mid = r2(dur / 2);
      const clip = path.join(stage, path.basename(s.clip)), poster = path.join(stage, path.basename(s.poster));
      run('ffmpeg', ['-v', 'error', '-y', '-ss', String(s.t0), '-t', String(dur), '-i', film,
        '-map', '0:v:0', '-map', '0:a:0?', '-vf', clipScale, ...encoder.args,
        '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', clip,
        '-map', '0:v:0', '-ss', String(mid), '-frames:v', '1', '-vf', posterScale, '-q:v', '3', poster], `сцена ${s.id}`);
      if (!fs.existsSync(clip) || fs.statSync(clip).size < 1000) throw new Error(`клип сцены ${s.id} пустой: фильм короче, чем сцена (${s.t0}–${s.t1} с)?`);
      if (!fs.existsSync(poster)) throw new Error(`постер сцены ${s.id} не получился: фильм короче, чем сцена (${s.t0}–${s.t1} с)?`);
      if ((i + 1) % 5 === 0 || i === scenes.length - 1) console.log(`  сцены: ${i + 1} из ${scenes.length}`);
    }
    // все сцены готовы: клипов прошлой сборки, которых больше нет в доске, не оставляем (границы сцен могли поменяться)
    fs.mkdirSync(dir, {recursive: true});
    const fresh = new Set(fs.readdirSync(stage));
    for (const n of fresh) moveOver(path.join(stage, n), path.join(dir, n));
    for (const n of fs.readdirSync(dir)) if (/\.(mp4|jpg)$/i.test(n) && !fresh.has(n)) fs.unlinkSync(path.join(dir, n)); // лишнее убираем после того, как новое на месте
  } finally { fs.rmSync(stage, {recursive: true, force: true}); }
  return scenes.length;
}

// Файл сцен из --scenes: читает и разбирает JSON (UTF-8 с BOM из Блокнота и UTF-16 из PowerShell тоже читаются)
export function readScenesFile(file) {
  let raw;
  try { raw = decodeText(fs.readFileSync(path.resolve(file))); } catch (e) { throw new Error(`файл сцен не читается: ${file}: ${e.message}`); }
  try { return JSON.parse(raw); } catch (e) { throw new Error(`файл сцен ${file} не разбирается как JSON: ${e.message}`); }
}

// Есть ли в файле звуковая дорожка (для кнопки «Звук» на странице)
export function hasAudio(run, file) {
  return String(run('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', file], 'ffprobe звука')).trim() !== '';
}

export const sceneSummary = (scenes) => scenes.map((s) => `${s.id} ${r2(s.t0)}–${r2(s.t1)} с «${s.title}» (кадров ${s.frames.length})`).join('\n    ');
