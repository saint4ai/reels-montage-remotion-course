// Озвучка сценария голосом ElevenLabs для роликов без лица.
//   npm run voice -- <ролик> [--voice <id>] [--model eleven_v4] [--lang ru] [--pause 0.3] [--redo 3,5] [--fresh]
//        [--text файл.txt] [--no-check] [--dry-run] [--force]
//   npm run voice -- --list [--search слово] [--lang ru]     голоса аккаунта (id, имя, язык)
// Что делает: берёт текст для суфлёра из work/<ролик>/SCRIPT.md (раздел «Текст для суфлёра»), режет на фразы, озвучивает каждую
// запросом POST /v1/text-to-speech/{голос}/with-timestamps (модель eleven_v4, язык ru, нормализация чисел on, соседние фразы как
// previous_text и next_text), режет звук только в паузах, склеивает с паузой между фразами и пишет:
//   public/work/<ролик>/voice.wav   озвучка 48 кГц, моно (в Reel.tsx это VOICE = 'work/<ролик>/voice.wav')
//   work/<ролик>/words.json         слова с временем, формат [{text, start, end}] как у npm run transcribe
// Подписи берутся из текста сценария (цифры остаются цифрами), время из ответа ElevenLabs.
// Кэш фраз в work/<ролик>/.voice-cache: повторный запуск и запуск после правки одной фразы тратят кредиты только на изменённую.
// Проверка: готовая озвучка распознаётся ElevenLabs Scribe, расхождения с текстом (числа, названия) печатаются списком.
// Ключ: ELEVENLABS_API_KEY из окружения или из файла .env в папке проекта. Ключ уходит только в заголовок xi-api-key
// запросов к api.elevenlabs.io, нигде не печатается и не пишется в файлы.
// Звук mp3 раскодирует ffmpeg (он нужен курсу и так, npm run doctor его проверяет).
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseEnv} from './apify-reels.mjs';

export const API = 'https://api.elevenlabs.io';
export const MODEL = 'eleven_v4';
export const FALLBACK_MODEL = 'eleven_multilingual_v2';
export const STT_MODEL = 'scribe_v2';
export const STT_FALLBACK = 'scribe_v1';
export const SR = 48000;
// запас до первой буквы и после последней, мягкие края и пауза между фразами (секунды): числа сверены на рабочей озвучке автора курса
export const CUT = {head: 0.07, tail: 0.28, fade: 0.015, pause: 0.30};
// у eleven_v4 есть только stability и similarity_boost (без style и speed)
export const SETTINGS = {stability: 0.5, similarity_boost: 0.75};
const OUTPUT_FORMAT = 'mp3_44100_128'; // 192 кбит/с только с тарифа Creator, 128 открыт всем
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const sha1 = (data) => createHash('sha1').update(data).digest('hex');
const ru1 = (n) => n.toFixed(1).replace('.', ',');

// ---------- ключ, настройки, текст ----------

export function readKey({env = process.env, cwd = process.cwd()} = {}) {
  if (env.ELEVENLABS_API_KEY && env.ELEVENLABS_API_KEY.trim()) return env.ELEVENLABS_API_KEY.trim();
  const file = path.join(cwd, '.env');
  if (existsSync(file)) {
    const v = parseEnv(readFileSync(file, 'utf8')).ELEVENLABS_API_KEY;
    if (v && v.trim()) return v.trim();
  }
  return null;
}

const scrub = (s, key) => (key ? String(s).split(key).join('***') : String(s));

// ID голоса из анкеты work/_profile/brief.md: строка «ID голоса: <20 знаков>»
export function briefVoice(md) {
  const m = /ID голоса[^:\n]*:\s*`?([A-Za-z0-9]{10,40})`?(?![\p{L}\p{N}])/u.exec(String(md ?? ''));
  return m ? m[1] : null;
}

// язык озвучки из анкеты: строка «Язык озвучки: ru»
export function briefLang(md) {
  const m = /Язык озвучки[^:\n]*:\s*`?([A-Za-z]{2,3})(?![\p{L}\p{N}])/u.exec(String(md ?? ''));
  return m ? m[1].toLowerCase() : null;
}

// Текст для суфлёра из SCRIPT.md: первый блок кода под заголовком «Текст для суфлёра», без блока кода весь раздел до следующего заголовка.
// null: раздела нет. Шаблон с угловыми скобками (текст ещё не написан) возвращается как есть, его отсекает main.
export function extractScriptText(md) {
  const lines = String(md ?? '').replace(/\r/g, '').split('\n');
  const h = lines.findIndex((l) => /^#{1,6}\s*Текст для суфл[её]ра/iu.test(l));
  if (h < 0) return null;
  const plain = [];
  const fenced = [];
  let fence = null;
  let found = false;
  for (let i = h + 1; i < lines.length; i++) {
    const l = lines[i];
    if (fence) {
      if (new RegExp(`^\s*${fence[0]}{${fence.length},}\s*$`).test(l)) break;
      fenced.push(l);
      continue;
    }
    if (/^#{1,6}\s/.test(l)) break;
    const f = /^\s*(`{3,}|~{3,})/.exec(l);
    if (f) { fence = f[1]; found = true; continue; }
    plain.push(l);
  }
  return cleanText((found ? fenced : plain).join('\n'));
}

// убирает разметку Markdown, невидимые знаки и лишние пробелы; переносы строк сохраняются
export function cleanText(s) {
  return String(s)
    .replace(/[\u200b\u200c\u200d\ufeff]/g, '')
    .replace(/(\*\*|__|`)/g, '')
    .replace(/^[ \t]*>[ \t]?/gm, '')
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .trim();
}

// Фразы для озвучки: предложения. Пустая строка делит абзацы, одиночный перенос строки считается пробелом.
// Часть предложения с маленькой буквы (после «т. д.», многоточия) прилипает к предыдущей.
export function splitPhrases(text) {
  const out = [];
  for (const block of String(text).replace(/\r/g, '').split(/\n\s*\n/)) {
    const flat = block.split('\n').map((l) => l.trim()).filter(Boolean).join(' ');
    if (!flat) continue;
    const parts = flat.split(/(?<=[.!?\u2026]+["\u00bb\u201d')\]]*)\s+/u).map((p) => p.trim()).filter(Boolean);
    const merged = [];
    for (const p of parts) {
      if (merged.length && (/^\p{Ll}/u.test(p) || !/[\p{L}\p{N}]/u.test(p))) merged[merged.length - 1] += ` ${p}`;
      else merged.push(p);
    }
    out.push(...merged);
  }
  return out;
}

export function parseArgs(argv) {
  const o = {slug: null, voice: null, model: MODEL, lang: null, pause: CUT.pause, redo: [], text: null, fresh: false, check: true,
    dryRun: false, force: false, list: false, search: null, help: false};
  const need = (i, name) => {
    if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) throw new Error(`после ${name} нужно значение`);
    return argv[i + 1];
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--voice') {
      o.voice = need(i, a); i++;
      if (!/^[A-Za-z0-9]{10,40}$/.test(o.voice)) throw new Error('ID голоса это 20 букв и цифр без пробелов; список голосов: npm run voice -- --list');
    } else if (a === '--model') {
      o.model = need(i, a); i++;
      if (!/^[a-z0-9_]{3,40}$/.test(o.model)) throw new Error(`модель «${o.model}» не похожа на ID вроде eleven_v4`);
    } else if (a === '--lang') {
      o.lang = need(i, a).toLowerCase(); i++;
      if (!/^[a-z]{2,3}$/.test(o.lang)) throw new Error('язык это код из двух букв, например ru или en');
    } else if (a === '--pause') {
      const n = Number(need(i, a)); i++;
      if (!Number.isFinite(n) || n < 0 || n > 3) throw new Error('--pause: секунды от 0 до 3');
      o.pause = n;
    } else if (a === '--redo') {
      o.redo = need(i, a).split(/[\s,;]+/).filter(Boolean).map(Number); i++;
      if (!o.redo.length || o.redo.some((n) => !Number.isInteger(n) || n < 1)) throw new Error('--redo: номера фраз с единицы, например 3,5');
    } else if (a === '--text') { o.text = need(i, a); i++; }
    else if (a === '--search') { o.search = need(i, a); i++; }
    else if (a === '--fresh') o.fresh = true;
    else if (a === '--no-check') o.check = false;
    else if (a === '--dry-run') o.dryRun = true;
    else if (a === '--force') o.force = true;
    else if (a === '--list') o.list = true;
    else if (a === '--help' || a === '-h') o.help = true;
    else if (a.startsWith('--')) throw new Error(`неизвестный параметр ${a}`);
    else if (!o.slug) o.slug = a;
    else throw new Error(`лишний аргумент «${a}»`);
  }
  if (o.slug && (o.slug !== path.basename(o.slug) || o.slug.startsWith('.'))) throw new Error('имя ролика это имя папки в work/, без путей');
  return o;
}

const USAGE = `Озвучка сценария голосом ElevenLabs.
  npm run voice -- <ролик>               озвучить work/<ролик>/SCRIPT.md
  npm run voice -- <ролик> --dry-run     только показать фразы и число знаков, без сети
  npm run voice -- <ролик> --redo 3,5    заново озвучить фразы 3 и 5 (остальные из кэша)
  npm run voice -- --list                голоса аккаунта (id, имя, язык)
Параметры: --voice <id>, --model eleven_v4, --lang ru, --pause 0.3, --fresh (всё заново), --text файл.txt, --no-check, --force.
Ключ: ELEVENLABS_API_KEY в файле .env. Инструкция: docs/guides/elevenlabs.md`;

// ---------- звук: фразы в одну дорожку ----------

function splitWords(al) {
  const ch = al.characters ?? [];
  const st = al.character_start_times_seconds ?? [];
  const en = al.character_end_times_seconds ?? [];
  const words = [];
  let w = '';
  let t0 = 0;
  let t1 = 0;
  for (let i = 0; i < ch.length; i++) {
    if (/^\s*$/.test(ch[i])) {
      if (w) { words.push({text: w, start: t0, end: t1}); w = ''; }
      continue;
    }
    if (!w) t0 = st[i];
    w += ch[i];
    t1 = en[i];
  }
  if (w) words.push({text: w, start: t0, end: t1});
  return words;
}

const core = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

// Слова фразы с временем из ответа ElevenLabs. alignment это текст запроса, normalized_alignment это то, что произнесено
// («20» как «двадцать»). Пока буквы и цифры alignment совпадают с фразой, берём его: подписи остаются как в сценарии.
// Иначе берём произнесённый вариант; если число слов то же, подписи всё равно из сценария, а время из произнесённого.
export function alignmentWords(res, phrase) {
  const orig = res.alignment;
  const norm = res.normalized_alignment;
  const own = phrase.split(/\s+/).filter(Boolean);
  const keepText = (words) => (words.length === own.length ? words.map((w, i) => ({...w, text: own[i]})) : words);
  if (orig?.characters?.length && core(orig.characters.join('')) === core(phrase)) return {words: keepText(splitWords(orig)), source: 'text'};
  if (norm?.characters?.length) {
    const words = splitWords(norm);
    return {words: keepText(words), source: words.length === own.length ? 'text' : 'spoken'};
  }
  if (orig?.characters?.length) return {words: keepText(splitWords(orig)), source: 'text'};
  throw new Error('ElevenLabs не вернул тайминги слов');
}

// Склейка. items: [{samples: Float32Array (mono, sr), words: [{text, start, end}] в секундах звука фразы}].
// Каждая фраза режется от (первая буква минус head) до (последняя буква плюс tail), края гасятся за fade, между фразами тишина pause.
export function assemble(items, {sr = SR, head = CUT.head, tail = CUT.tail, fade = CUT.fade, pause = CUT.pause} = {}) {
  const segs = [];
  const words = [];
  const wordPhrase = [];
  const phrases = [];
  let cur = 0;
  const pauseN = Math.round(pause * sr);
  items.forEach((it, i) => {
    const total = it.samples.length / sr;
    const first = it.words.length ? it.words[0].start : 0;
    const last = it.words.length ? it.words[it.words.length - 1].end : total;
    let a = Math.floor(Math.max(0, first - head) * sr);
    let b = Math.floor(Math.min(total, last + tail) * sr);
    if (b <= a) { a = 0; b = it.samples.length; }
    const seg = it.samples.slice(a, b);
    const f = Math.min(Math.round(fade * sr), Math.floor(seg.length / 2));
    for (let k = 0; k < f; k++) { const g = k / f; seg[k] *= g; seg[seg.length - 1 - k] *= g; }
    if (i) { segs.push(new Float32Array(pauseN)); cur += pauseN; }
    const base = cur / sr - a / sr;
    for (const w of it.words) { words.push({text: w.text, start: base + w.start, end: base + w.end}); wordPhrase.push(i); }
    phrases.push({start: cur / sr, end: (cur + seg.length) / sr});
    segs.push(seg);
    cur += seg.length;
  });
  const samples = new Float32Array(cur);
  let at = 0;
  for (const s of segs) { samples.set(s, at); at += s.length; }
  const r2 = (x) => +x.toFixed(2);
  const out = words.map((w) => ({text: w.text, start: r2(Math.max(0, w.start)), end: r2(Math.max(w.end, w.start + 0.05))}));
  return {samples, words: out, wordPhrase, phrases};
}

// WAV 16 бит, моно
export function encodeWav(samples, sr = SR) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  return buf;
}

export const hasFfmpeg = () => spawnSync('ffmpeg', ['-version'], {stdio: 'ignore'}).status === 0;

// mp3 из ответа ElevenLabs в Float32 моно через ffmpeg
export function decodeWithFfmpeg(buf, sr = SR) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-ac', '1', '-ar', String(sr), '-f', 'f32le', 'pipe:1'], {input: buf, maxBuffer: 1 << 29});
  if (r.error) throw new Error(r.error.code === 'ENOENT' ? 'ffmpeg не найден. Запусти npm run doctor и поставь ffmpeg.' : r.error.message);
  if (r.status !== 0) throw new Error(`ffmpeg не прочитал звук: ${String(r.stderr).slice(0, 200)}`);
  const out = r.stdout;
  return new Float32Array(out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength - (out.byteLength % 4)));
}

// ---------- проверка распознаванием ----------

export const tokenize = (s) => String(s).toLowerCase().replace(/ё/g, 'е').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const isNumber = (t) => /^\p{N}+$/u.test(t);

// Выравнивание слов сценария и распознанных слов (расстояние Левенштейна). Возвращает расхождения:
// {exp: [слова сценария], got: [услышанное], at: номер первого слова сценария, number: среди них есть число}
export function diffTokens(exp, got) {
  const n = exp.length;
  const m = got.length;
  const d = Array.from({length: n + 1}, () => new Uint32Array(m + 1));
  for (let i = 0; i <= n; i++) d[i][0] = i;
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) d[i][j] = Math.min(d[i - 1][j - 1] + (exp[i - 1] === got[j - 1] ? 0 : 1), d[i - 1][j] + 1, d[i][j - 1] + 1);
  }
  const ops = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (exp[i - 1] === got[j - 1] ? 0 : 1)) { ops.push(exp[i - 1] === got[j - 1] ? ['=', i - 1, j - 1] : ['s', i - 1, j - 1]); i--; j--; }
    else if (i > 0 && d[i][j] === d[i - 1][j] + 1) { ops.push(['d', i - 1, -1]); i--; }
    else { ops.push(['i', -1, j - 1]); j--; }
  }
  ops.reverse();
  const groups = [];
  let g = null;
  let lastExp = 0;
  for (const [op, ei, gj] of ops) {
    if (op === '=') { g = null; lastExp = ei + 1; continue; }
    if (!g) { g = {exp: [], got: [], at: ei >= 0 ? ei : lastExp}; groups.push(g); }
    if (ei >= 0) g.exp.push(exp[ei]);
    if (gj >= 0) g.got.push(got[gj]);
    if (ei >= 0) lastExp = ei + 1;
  }
  // рядом стоящие замены «слово на слово» (число слов одинаково) разбираем по парам: число и название не склеиваются в одну запись
  const split = groups.flatMap((x) => (x.exp.length === x.got.length && x.exp.length > 1 ? x.exp.map((e, k) => ({exp: [e], got: [x.got[k]], at: x.at + k})) : [x]));
  return split
    .filter((x) => x.exp.join('') !== x.got.join(''))
    .map((x) => ({...x, number: x.exp.some(isNumber)}));
}

// Расхождения озвучки с текстом по словам из words.json. wordPhrase: номер фразы каждого слова.
export function compareSpeech(words, wordPhrase, recognized) {
  const exp = [];
  const origin = [];
  words.forEach((w, wi) => { for (const t of tokenize(w.text)) { exp.push(t); origin.push(wi); } });
  return diffTokens(exp, tokenize(recognized)).map((x) => {
    const wi = origin[Math.min(x.at, origin.length - 1)] ?? 0;
    return {...x, phrase: (wordPhrase[wi] ?? 0) + 1, time: words[wi]?.start ?? 0};
  });
}

export function formatDiff(diffs, limit = 25) {
  const lines = diffs.slice(0, limit).map((x) => {
    const said = x.got.length ? `«${x.got.join(' ')}»` : 'ничего';
    const was = x.exp.length ? `«${x.exp.join(' ')}»` : 'ничего';
    return `  фраза ${x.phrase} (${ru1(x.time)} с)${x.number ? ', число' : ''}: в тексте ${was}, услышано ${said}`;
  });
  if (diffs.length > limit) lines.push(`  ...и ещё ${diffs.length - limit}`);
  return lines;
}

// ---------- запросы к ElevenLabs ----------

export class ElevenError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

async function toError(res) {
  let detail;
  try { const j = JSON.parse(await res.text()); detail = j?.detail ?? j; } catch { detail = null; }
  let code = '';
  let message = '';
  if (typeof detail === 'string') message = detail;
  else if (Array.isArray(detail)) message = detail.map((d) => d?.msg ?? '').filter(Boolean).join('; ');
  else if (detail && typeof detail === 'object') { code = String(detail.status ?? detail.code ?? ''); message = String(detail.message ?? ''); }
  return new ElevenError(res.status, code, message.slice(0, 300));
}

// Запрос с повтором при 429 и сбоях сервера. Ключ только в заголовке.
export async function call(fetchImpl, key, url, init = {}, {sleep = wait, tries = 4} = {}) {
  let delay = 600;
  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await fetchImpl(url, {...init, headers: {'xi-api-key': key, ...(init.headers ?? {})}, signal: AbortSignal.timeout(180000)});
    } catch (e) {
      if (attempt < tries) { await sleep(delay); delay *= 2; continue; }
      throw new ElevenError(0, 'network', `нет связи с ElevenLabs (${e.cause?.code ?? e.name})`);
    }
    if (res.ok) return res;
    if ((res.status === 429 || res.status >= 500) && attempt < tries) { await sleep(delay + Math.random() * delay); delay *= 2; continue; }
    throw await toError(res);
  }
}

// Понятное объяснение ошибки для ученика. Текст ответа сервера ключа не содержит.
export function explain(e, {key} = {}) {
  const msg = scrub(e.message, key);
  const tail = msg ? ` Ответ ElevenLabs: ${msg}` : '';
  if (e.code === 'network') return `${msg}. Проверь интернет и повтори команду.`;
  if (e.code === 'paid_plan_required' || /paid.?plan|library voice|free.?tier|not available for free/i.test(msg)) {
    return `Этот голос недоступен на бесплатном тарифе через API. Возьми голос из списка (npm run voice -- --list) или оформи платный тариф.${tail}`;
  }
  if (e.code === 'quota_exceeded' || e.status === 402) {
    return `Кредиты ElevenLabs на этот период закончились. Подожди обновления лимита или поменяй тариф.${tail}`;
  }
  if (e.code === 'missing_permissions' || (e.status === 403 && /permission/i.test(msg))) {
    return `У ключа не хватает прав. В настройках ключа (elevenlabs.io, Developers, API Keys) включи Text to Speech, Speech to Text и Voices: Read, либо создай ключ без ограничений.${tail}`;
  }
  if (e.status === 401 || e.code === 'invalid_api_key') {
    return `ElevenLabs не принял ключ. Проверь строку ELEVENLABS_API_KEY= в файле .env (без пробелов и кавычек) или создай новый ключ.${tail}`;
  }
  if (e.code === 'voice_not_found' || e.status === 404) {
    return `Голос не найден. Проверь ID голоса: список голосов аккаунта npm run voice -- --list, голос из библиотеки сначала добавь в My Voices.${tail}`;
  }
  if (e.status === 429) return `ElevenLabs просит не торопиться (слишком много запросов). Повтори через минуту.${tail}`;
  return `ElevenLabs вернул ошибку (код ${e.status}).${tail}`;
}

// ошибка из-за самой модели: её нет на тарифе или аккаунте
export function isModelProblem(e) {
  if (!(e instanceof ElevenError)) return false;
  if (![400, 403, 404, 422].includes(e.status)) return false;
  if (e.code === 'missing_permissions' || e.code === 'voice_not_found' || e.code === 'invalid_api_key') return false;
  return /model/i.test(`${e.code} ${e.message}`);
}

export function ttsBody({text, model, lang, previous, next}) {
  const body = {text, model_id: model, voice_settings: SETTINGS, apply_text_normalization: 'on'};
  if (model !== FALLBACK_MODEL) body.language_code = lang; // у eleven_multilingual_v2 языка в запросе нет, он определяет его по тексту
  if (previous) body.previous_text = previous.slice(-400);
  if (next) body.next_text = next.slice(0, 400);
  return body;
}

export async function ttsPhrase({fetchImpl, key, voice, body, sleep}) {
  const url = `${API}/v1/text-to-speech/${voice}/with-timestamps?output_format=${OUTPUT_FORMAT}`;
  const res = await call(fetchImpl, key, url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)}, {sleep});
  const j = await res.json();
  if (!j?.audio_base64) throw new Error('ElevenLabs не вернул звук');
  return {data: {audio_base64: j.audio_base64, alignment: j.alignment ?? null, normalized_alignment: j.normalized_alignment ?? null},
    chars: Number(res.headers?.get?.('x-character-count')) || 0};
}

// Кэш фразы живёт, пока не меняются голос, модель, язык, настройки и сам текст фразы. Соседние фразы в ключ не входят,
// чтобы правка одной фразы не заставляла тратить кредиты на соседние.
export const cacheKey = ({voice, model, lang, text}) =>
  sha1(JSON.stringify(['v1', voice, model, model === FALLBACK_MODEL ? null : lang, SETTINGS, OUTPUT_FORMAT, 'on', text])).slice(0, 20);

export async function listVoices({fetchImpl, key, search, lang, sleep}) {
  const voices = [];
  let token = null;
  for (let page = 0; page < 5; page++) {
    const q = new URLSearchParams({page_size: '100'});
    if (search) q.set('search', search);
    if (lang) q.set('language', lang);
    if (token) q.set('next_page_token', token);
    const res = await call(fetchImpl, key, `${API}/v2/voices?${q}`, {method: 'GET'}, {sleep});
    const j = await res.json();
    voices.push(...(j.voices ?? []));
    if (!j.has_more || !j.next_page_token) break;
    token = j.next_page_token;
  }
  return voices;
}

const voiceLine = (v) => {
  const lb = v.labels ?? {};
  const langs = [...new Set((v.verified_languages ?? []).map((x) => x.language).filter(Boolean))];
  const info = [lb.gender, lb.age, lb.accent, lb.descriptive, lb.use_case, langs.length ? `языки: ${langs.join(' ')}` : lb.language ? `язык: ${lb.language}` : '']
    .filter(Boolean).join(', ');
  return `${v.voice_id}  ${v.name}${v.category ? ` [${v.category}]` : ''}${info ? `  ${info}` : ''}`;
};

// расход тарифа: нужен ключу с правом читать пользователя; нет права, ответ странный или нет сети: просто молчим
async function usage({fetchImpl, key, sleep}) {
  try {
    const res = await call(fetchImpl, key, `${API}/v1/user/subscription`, {method: 'GET'}, {sleep, tries: 1});
    const j = await res.json();
    if (Number.isFinite(j.character_count) && Number.isFinite(j.character_limit)) return {used: j.character_count, limit: j.character_limit, tier: j.tier ?? null};
  } catch { /* не критично */ }
  return null;
}

async function recognize({fetchImpl, key, wav, lang, sleep}) {
  for (const model of [STT_MODEL, STT_FALLBACK]) {
    const form = new FormData();
    form.append('model_id', model);
    form.append('language_code', lang);
    form.append('tag_audio_events', 'false');
    form.append('file', new Blob([wav], {type: 'audio/wav'}), 'voice.wav');
    try {
      const res = await call(fetchImpl, key, `${API}/v1/speech-to-text`, {method: 'POST', body: form}, {sleep});
      return String((await res.json()).text ?? '');
    } catch (e) {
      if (model === STT_MODEL && e instanceof ElevenError && [400, 404, 422].includes(e.status) && /model/i.test(`${e.code} ${e.message}`)) continue;
      throw e;
    }
  }
  return '';
}

// ---------- сценарий целиком ----------

const readIf = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : '');

// выходные файлы запоминаются по хэшу: чужую запись (voice.wav самого ученика) и правленный вручную words.json скрипт не затирает
function foreignOutputs(files, metaFile) {
  let meta = {};
  try { meta = JSON.parse(readIf(metaFile) || '{}'); } catch { meta = {}; }
  return files.filter((f) => existsSync(f.path) && meta[f.name] !== sha1(readFileSync(f.path)));
}

export async function main(argv, {env = process.env, cwd = process.cwd(), fetchImpl = globalThis.fetch, decode = decodeWithFfmpeg,
  log = console.log, sleep = wait} = {}) {
  let o;
  try { o = parseArgs(argv); } catch (e) { log(`Ошибка в параметрах: ${e.message}`); return 2; }
  if (o.help || (!o.slug && !o.list)) { log(USAGE); return o.help ? 0 : 2; }
  const key = readKey({env, cwd});

  if (o.list) {
    if (!key) { log('Нет ключа ElevenLabs. Запиши его в файл .env строкой ELEVENLABS_API_KEY=<ключ> (инструкция docs/guides/elevenlabs.md).'); return 1; }
    try {
      const voices = await listVoices({fetchImpl, key, search: o.search, lang: o.lang, sleep});
      if (!voices.length) log('Голосов не нашлось. Попробуй без --search или выбери голос в библиотеке на elevenlabs.io (docs/guides/elevenlabs.md, раздел про голос).');
      for (const v of voices) { log(voiceLine(v)); if (v.preview_url) log(`    образец: ${v.preview_url}`); }
      if (voices.length) log(`Голосов: ${voices.length}. Нужный ID подставь в --voice или впиши в work/_profile/brief.md строкой «ID голоса: <id>».`);
      return 0;
    } catch (e) {
      if (e instanceof ElevenError && (e.code === 'missing_permissions' || e.status === 401 || e.status === 403) && e.code !== 'invalid_api_key') {
        log('Ключу не хватает права читать голоса (Voices: Read). Два пути.');
        log('1) В настройках ключа (elevenlabs.io, Developers, API Keys) включи Voices: Read или создай ключ без ограничений.');
        log('2) Выбери голос на сайте: Voices, Explore, нужный голос, добавь в My Voices, меню «три точки», Copy voice ID. Этот ID подставь в --voice.');
        log(`Ответ ElevenLabs: ${scrub(e.message, key) || `код ${e.status}`}`);
      } else log(explain(e, {key}));
      return 1;
    }
  }

  // --- текст ---
  const P = {
    script: path.join(cwd, 'work', o.slug, 'SCRIPT.md'),
    words: path.join(cwd, 'work', o.slug, 'words.json'),
    cache: path.join(cwd, 'work', o.slug, '.voice-cache'),
    wav: path.join(cwd, 'public', 'work', o.slug, 'voice.wav'),
    brief: path.join(cwd, 'work', '_profile', 'brief.md'),
    briefJson: path.join(cwd, 'work', o.slug, 'brief.json'),
  };
  let text;
  if (o.text) {
    if (!existsSync(path.resolve(cwd, o.text))) { log(`Файла с текстом нет: ${o.text}`); return 1; }
    text = cleanText(readFileSync(path.resolve(cwd, o.text), 'utf8'));
  } else {
    if (!existsSync(P.script)) { log(`Нет сценария: work/${o.slug}/SCRIPT.md. Его пишет Скриптолог, или передай текст файлом: --text файл.txt`); return 1; }
    text = extractScriptText(readFileSync(P.script, 'utf8'));
    if (text === null) { log(`В work/${o.slug}/SCRIPT.md нет раздела «Текст для суфлёра». Добавь его или передай текст файлом: --text файл.txt`); return 1; }
  }
  if (!text || /^<[^>]*>$/s.test(text) || /<Весь текст/.test(text)) { log(`В work/${o.slug}/SCRIPT.md текст ещё не написан (стоит шаблон). Сначала сценарий.`); return 1; }
  const phrases = splitPhrases(text);
  if (!phrases.length) { log('В тексте нет ни одной фразы.'); return 1; }

  // --- голос, язык, модель ---
  const briefMd = readIf(P.brief);
  let briefJsonLang = null;
  try { const l = JSON.parse(readIf(P.briefJson) || '{}').language; if (typeof l === 'string' && /^[a-z]{2,3}$/i.test(l)) briefJsonLang = l.toLowerCase(); } catch { /* битый brief.json не мешает */ }
  const voice = o.voice ?? briefVoice(briefMd);
  const lang = o.lang ?? briefJsonLang ?? briefLang(briefMd) ?? 'ru';
  const chars = phrases.reduce((s, p) => s + p.length, 0);
  const words = text.split(/\s+/).filter(Boolean).length;

  log(`Ролик ${o.slug}: ${phrases.length} фраз, ${words} слов, ${chars} знаков. Модель ${o.model}, язык ${lang}${voice ? `, голос ${voice}` : ''}.`);
  if (o.dryRun) {
    phrases.forEach((p, i) => log(`  ${i + 1}. ${p}`));
    log(voice ? 'Сухой запуск: в сеть не хожу, кредиты не трачу.' : 'Сухой запуск. Голос пока не выбран: --voice <id> или строка «ID голоса» в work/_profile/brief.md (npm run voice -- --list).');
    log(key ? 'Ключ ELEVENLABS_API_KEY найден (значение не показываю).' : 'Ключа ELEVENLABS_API_KEY пока нет.');
    return 0;
  }
  if (!key) { log('Нет ключа ElevenLabs. Запиши его в файл .env строкой ELEVENLABS_API_KEY=<ключ> (инструкция docs/guides/elevenlabs.md).'); return 1; }
  if (!voice) { log('Не выбран голос. Укажи --voice <id> или впиши строку «ID голоса: <id>» в work/_profile/brief.md. Список голосов аккаунта: npm run voice -- --list'); return 1; }

  const metaFile = path.join(P.cache, 'outputs.json');
  const foreign = o.force ? [] : foreignOutputs([{name: 'voice.wav', path: P.wav}, {name: 'words.json', path: P.words}], metaFile);
  if (foreign.length) {
    log(`Файл уже есть и сделан не этим скриптом (или правился вручную): ${foreign.map((f) => path.relative(cwd, f.path)).join(', ')}.`);
    log('Это может быть твоя запись голоса. Сохрани копию в другое место и запусти команду с --force, чтобы заменить файл озвучкой.');
    return 1;
  }

  if (decode === decodeWithFfmpeg && !hasFfmpeg()) { log('ffmpeg не найден: без него звук не раскодировать. Запусти npm run doctor и поставь ffmpeg.'); return 1; }

  mkdirSync(P.cache, {recursive: true});
  const redo = new Set(o.redo.map((n) => n - 1));
  const bad = o.redo.filter((n) => n > phrases.length);
  if (bad.length) { log(`В тексте ${phrases.length} фраз, а в --redo есть ${bad.join(', ')}.`); return 2; }

  // --- озвучка по фразам ---
  let model = o.model;
  let charsBilled = 0;
  let saved = 0;
  const synth = async (m) => {
    const out = [];
    const fresh = (i) => o.fresh || redo.has(i);
    const cacheOf = (i) => path.join(P.cache, `${cacheKey({voice, model: m, lang, text: phrases[i]})}.json`);
    const todo = phrases.map((p, i) => i).filter((i) => fresh(i) || !existsSync(cacheOf(i)));
    log(`Нужно озвучить ${todo.length} из ${phrases.length} фраз (${todo.reduce((s, i) => s + phrases[i].length, 0)} знаков), остальные из кэша.`);
    if (todo.length) {
      const u = await usage({fetchImpl, key, sleep});
      if (u) log(`Тариф${u.tier ? ` ${u.tier}` : ''}: израсходовано ${u.used} из ${u.limit} знаков за период.`);
    }
    for (let i = 0; i < phrases.length; i++) {
      const file = cacheOf(i);
      if (!fresh(i) && existsSync(file)) {
        try { out.push(JSON.parse(readFileSync(file, 'utf8'))); log(`Фраза ${i + 1} из ${phrases.length}: из кэша`); continue; } catch { /* битый кэш: озвучим заново */ }
      }
      const body = ttsBody({text: phrases[i], model: m, lang, previous: phrases[i - 1], next: phrases[i + 1]});
      const r = await ttsPhrase({fetchImpl, key, voice, body, sleep});
      writeFileSync(file, JSON.stringify(r.data));
      saved++;
      charsBilled += r.chars;
      out.push(r.data);
      log(`Фраза ${i + 1} из ${phrases.length}: озвучена (${phrases[i].length} знаков)`);
    }
    return out;
  };
  let results;
  for (;;) {
    try { results = await synth(model); break; } catch (e) {
      if (isModelProblem(e) && model !== FALLBACK_MODEL) {
        log(`Модель ${model} недоступна на этом тарифе или аккаунте${e.message ? ` (${scrub(e.message, key).slice(0, 160)})` : ''}. Перехожу на ${FALLBACK_MODEL}: язык она определяет по тексту сама.`);
        model = FALLBACK_MODEL;
        continue;
      }
      log(e instanceof ElevenError ? explain(e, {key}) : `Не вышло: ${scrub(e.message, key)}`);
      if (saved) log('Озвученные фразы сохранены, повтор команды не потратит их заново.');
      return 1;
    }
  }

  // --- склейка и запись ---
  let built;
  const sources = [];
  try {
    const items = results.map((r, i) => {
      const w = alignmentWords(r, phrases[i]);
      sources.push(w.source);
      return {samples: decode(Buffer.from(r.audio_base64, 'base64'), SR), words: w.words};
    });
    built = assemble(items, {pause: o.pause});
  } catch (e) { log(`Не удалось собрать звук: ${scrub(e.message, key)}`); return 1; }
  const wav = encodeWav(built.samples, SR);
  const json = JSON.stringify(built.words, null, 1);
  mkdirSync(path.dirname(P.wav), {recursive: true});
  mkdirSync(path.dirname(P.words), {recursive: true});
  writeFileSync(P.wav, wav);
  writeFileSync(P.words, json);
  writeFileSync(metaFile, JSON.stringify({'voice.wav': sha1(wav), 'words.json': sha1(json)}));
  const dur = built.samples.length / SR;
  const end = built.words.length ? built.words[built.words.length - 1].end : dur;
  log(`Готово: ${path.relative(cwd, P.wav)} (${ru1(dur)} с, ${phrases.length} фраз) и ${path.relative(cwd, P.words)} (${built.words.length} слов).`);
  log(`Модель ${model}, голос ${voice}, язык ${model === FALLBACK_MODEL ? 'по тексту' : lang}.${charsBilled ? ` ElevenLabs отчитался о ${charsBilled} знаках.` : ''}`);
  log(`Дальше: в проекте VOICE = 'work/${o.slug}/voice.wav', слова из work/${o.slug}/words.json, duration ролика не меньше ${ru1(end + 0.3)} с (конец речи ${ru1(end)} с плюс 0,3).`);
  if (sources.includes('spoken')) log('Заметка: у части фраз число слов в подписях не совпало с текстом, там подписи взяты из произнесённого (числа словами). Проверь написание в words.json.');
  if (model === FALLBACK_MODEL) log('Заметка: озвучка сделана запасной моделью. Цифры и имена послушай особенно внимательно.');

  // --- проверка распознаванием ---
  if (o.check) {
    try {
      const heard = await recognize({fetchImpl, key, wav, lang, sleep});
      const diffs = compareSpeech(built.words, built.wordPhrase, heard);
      if (!diffs.length) log('Проверка распознаванием (ElevenLabs Scribe): расхождений с текстом нет.');
      else {
        log(`Проверка распознаванием (ElevenLabs Scribe): расхождений ${diffs.length}. Ниже что написано в сценарии и что услышал Scribe.`);
        log('Слово или число, которое Scribe записал иначе, не всегда ошибка озвучки: послушай эти места. Фразу можно озвучить заново (--redo <номер>).');
        for (const l of formatDiff(diffs)) log(l);
      }
    } catch (e) {
      if (e instanceof ElevenError && (e.code === 'missing_permissions' || e.status === 401 || e.status === 403)) {
        log('Проверка распознаванием пропущена: ключу не хватает права Speech to Text. Включи его в настройках ключа или создай ключ без ограничений. Озвучка готова и без проверки.');
      } else log(`Проверка распознаванием пропущена: ${e instanceof ElevenError ? explain(e, {key}) : scrub(e.message, key)}`);
    }
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = await main(process.argv.slice(2)); // не process.exit: на Windows он ломает закрытие соединений fetch
}
