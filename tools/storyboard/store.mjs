// Общие мелочи доски раскадровки для сервера, cli и сборщиков (npm-пакеты не нужны).
//   чтение JSON без молчаливой подмены пустыми данными (BOM, UTF-16 от PowerShell, файл занят, файл повреждён);
//   review.json: блокировка на время «прочитать, изменить, записать», копии в history/, восстановление из копии;
//   кириллические номера К001/С01 (агент и ученик часто печатают латинские K и C);
//   время «мин:сек,десятая» без «0:60».
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export class BoardError extends Error {
  constructor(message, code = 500) { super(message); this.code = code; }
}

export const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
export const rid = () => crypto.randomBytes(4).toString('hex');
export const nowIso = () => new Date().toISOString();

// ── чтение JSON ──
// PowerShell 5 пишет файлы в UTF-16 с BOM, Блокнот в UTF-8 с BOM: JSON.parse в обоих случаях падает на первом знаке.
export function decodeText(buf) {
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.subarray(2).toString('utf16le');
  if (buf[0] === 0xfe && buf[1] === 0xff) { const b = Buffer.from(buf.subarray(2)); b.swap16(); return b.toString('utf16le'); }
  const s = buf.toString('utf8');
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}
const BUSY = new Set(['EBUSY', 'EPERM', 'EACCES', 'EMFILE']);
function readBuf(file, what) {
  for (let i = 0; ; i++) {
    try { return fs.readFileSync(file); } catch (e) {
      if (e.code === 'ENOENT') return null;
      // антивирус, OneDrive или другая программа держит файл долю секунды: ждём, а не считаем файл пустым
      if (BUSY.has(e.code) && i < 5) { sleep(40 * (i + 1)); continue; }
      throw new BoardError(`${what} не читается (${e.code ?? e.message}). Файл занят другой программой? Повтори через секунду.`, 503);
    }
  }
}
// Нет файла это fallback. Файл есть, но не JSON или не объект: это ошибка с понятным текстом, а не пустые данные.
export function readJsonFile(file, fallback, what = path.basename(file)) {
  const buf = readBuf(file, what);
  if (buf == null) return fallback;
  let v;
  try { v = JSON.parse(decodeText(buf)); } catch (e) { throw new BoardError(`${what} повреждён и не разбирается как JSON: ${e.message}`, 500); }
  if (v === null || typeof v !== 'object') throw new BoardError(`${what} повреждён: внутри не объект JSON`, 500);
  return v;
}

// запись через временный файл и переименование; на Windows переименование иногда занято (антивирус), поэтому с повторами
export function writeFileAtomic(file, text) {
  const tmp = `${file}.${process.pid}-${rid()}.tmp`;
  fs.writeFileSync(tmp, text);
  for (let i = 0; ; i++) {
    try { fs.renameSync(tmp, file); return; } catch (e) {
      if (BUSY.has(e.code) && i < 8) { sleep(30 * (i + 1)); continue; }
      try { fs.unlinkSync(tmp); } catch { /* уже нет */ }
      throw e;
    }
  }
}

// ── review.json: блокировка, копии, восстановление ──
// Правки со страницы пишет сервер, ответы агента пишет cli.mjs: два процесса. Без блокировки оба читают файл, каждый дописывает своё
// и перезаписывает целиком, поэтому одна из правок пропадает. Замок это папка .review.lock (создание папки атомарно).
const LOCK_STALE_MS = 5000, LOCK_WAIT_MS = 8000; // зависший замок снимается раньше, чем ожидающий сдаётся
export function withLock(dir, fn, {waitMs = LOCK_WAIT_MS} = {}) {
  const lock = path.join(dir, '.review.lock');
  const t0 = Date.now();
  for (;;) {
    try { fs.mkdirSync(lock); break; } catch (e) {
      if (e.code !== 'EEXIST' && e.code !== 'EPERM' && e.code !== 'EACCES') throw e;
      try { if (Date.now() - fs.statSync(lock).mtimeMs > LOCK_STALE_MS) { fs.rmdirSync(lock); continue; } } catch { /* замок снял владелец */ }
      if (Date.now() - t0 > waitMs) throw new BoardError('review.json занят другой программой (замок .review.lock не снимается). Повтори через несколько секунд.', 503);
      sleep(10 + Math.floor(Math.random() * 25));
    }
  }
  try { return fn(); } finally { try { fs.rmdirSync(lock); } catch { /* уже снят */ } }
}

export const emptyReview = () => ({frames: {}, scenes: {}, general: [], updatedAt: null, rev: 0});
const HIST_KEEP = 60;
// Копия записанной версии в history/: последняя копия всегда равна текущему файлу, поэтому порча review.json снаружи не стоит ни одной правки.
function snapshot(dir, text, rev) {
  try {
    const hist = path.join(dir, 'history');
    fs.mkdirSync(hist, {recursive: true});
    fs.writeFileSync(path.join(hist, `review-${nowIso().replace(/[:.]/g, '-')}-${String(rev).padStart(6, '0')}.json`), text);
    const old = fs.readdirSync(hist).filter((n) => /^review-.*\.json$/.test(n)).sort();
    for (const n of old.slice(0, Math.max(0, old.length - HIST_KEEP))) { try { fs.unlinkSync(path.join(hist, n)); } catch { /* занят */ } }
  } catch { /* копия не получилась (нет места): сама правка важнее */ }
}
// Самая свежая целая копия из history/ (после неё лежит повреждённый файл)
function lastGoodSnapshot(dir) {
  const hist = path.join(dir, 'history');
  if (!fs.existsSync(hist)) return null;
  for (const n of fs.readdirSync(hist).filter((x) => /^review-.*\.json$/.test(x)).sort().reverse()) {
    try { const v = JSON.parse(decodeText(fs.readFileSync(path.join(hist, n)))); if (v && typeof v === 'object') return {review: v, name: n}; } catch { /* битая копия */ }
  }
  return null;
}
const normalize = (r) => { r.frames ??= {}; r.scenes ??= {}; r.general ??= []; return r; };

// Читает review.json. Если файл повреждён, правки не теряются: берётся последняя целая копия из history/ (или пусто, если копий нет),
// а сам повреждённый файл сохраняется рядом как review.broken-<время>.json. Возвращает {review, repaired?: текст для человека}.
export function loadReview(dir, {repair = false} = {}) {
  const file = path.join(dir, 'review.json');
  try { return {review: normalize(readJsonFile(file, emptyReview(), 'review.json'))}; } catch (e) {
    if (!(e instanceof BoardError) || e.code !== 500) throw e; // занят (503) это не порча: ждём, ничего не подменяем
    const snap = lastGoodSnapshot(dir);
    const review = normalize(snap?.review ?? emptyReview());
    let note = `review.json был повреждён: ${snap ? `взята последняя целая копия ${snap.name}` : 'целых копий не нашлось, начато с пустых правок'}.`;
    if (repair) {
      const aside = path.join(dir, `review.broken-${nowIso().replace(/[:.]/g, '-')}.json`);
      try { fs.renameSync(file, aside); note += ` Повреждённый файл сохранён: ${path.basename(aside)}.`; } catch { /* файл мог исчезнуть */ }
      writeFileAtomic(file, JSON.stringify(review, null, 1));
    }
    return {review, repaired: note};
  }
}
// «Прочитать, изменить, записать» под замком, с копией записанной версии. fn меняет review на месте. Возвращает новый review.
export function mutateReview(dir, fn) {
  return withLock(dir, () => {
    const {review: cur, repaired} = loadReview(dir, {repair: true});
    if (repaired) console.warn(repaired);
    fn(cur);
    cur.updatedAt = nowIso();
    cur.rev = (Number(cur.rev) || 0) + 1; // страница по номеру отличает свежий ответ от запоздавшего
    const text = JSON.stringify(cur, null, 1);
    writeFileAtomic(path.join(dir, 'review.json'), text);
    snapshot(dir, text, cur.rev);
    return cur;
  });
}

// ── номера ──
// Кадры называются К001 (кириллическая К), сцены С01 (кириллическая С). Агент печатает латиницей K001 / C01 или без нулей (К5, С1):
// сообщение «нет такого кадра» при этом показывает похожий на вид список и сбивает с толку. Находим кадр по букве и числу.
const LAT = {C: 'С', c: 'С', K: 'К', k: 'К', С: 'С', с: 'С', К: 'К', к: 'К'};
export function findId(ids, v) {
  const s = String(v ?? '').trim();
  if (ids.includes(s)) return s;
  const m = /^([CcKkСсКк])\s*0*(\d+)$/.exec(s);
  if (!m) return null;
  const letter = LAT[m[1]], num = Number(m[2]);
  return ids.find((id) => id[0] === letter && /^\d+$/.test(id.slice(1)) && Number(id.slice(1)) === num) ?? null;
}

// ── время ──
// 59,97 с это 1:00,0, а не «0:60,0»: сначала округляем до десятой, потом делим на минуты
const tenth = (s) => { const t = Math.round(Number(s) * 10) / 10; return Number.isFinite(t) && t >= 0 ? t : 0; };
export const mmss = (s) => { const t = tenth(s), m = Math.floor(t / 60); return `${m}:${(t - m * 60).toFixed(1).padStart(4, '0')}`; };
// целые секунды без десятой («0:03»), иначе с десятой и запятой («0:04,2»)
export const mmssShort = (s) => {
  const t = tenth(s), m = Math.floor(t / 60), x = t - m * 60;
  return Math.abs(x - Math.round(x)) < 0.05 ? `${m}:${String(Math.round(x)).padStart(2, '0')}` : `${m}:${x.toFixed(1).padStart(4, '0')}`.replace('.', ',');
};

// ── файлы ──
// заменить файл новым: на Windows переименование поверх файла, который сейчас читает сервер или антивирус, иногда отказывает, тогда повторяем
export function moveOver(src, dest) {
  for (let i = 0; ; i++) {
    try { fs.renameSync(src, dest); return; } catch (e) {
      if (BUSY.has(e.code) && i < 8) { sleep(30 * (i + 1)); continue; }
      throw e;
    }
  }
}
// временные файлы сборки убираем, даже если сборка оборвалась (process.exit из fail пропускает finally)
const tmpPaths = new Set();
let exitHooked = false;
export function cleanupOnExit(p) {
  tmpPaths.add(p);
  if (!exitHooked) { exitHooked = true; process.on('exit', () => { for (const t of tmpPaths) { try { fs.rmSync(t, {recursive: true, force: true}); } catch { /* занят */ } } }); }
}

// ── правки, у которых больше нет кадра или сцены ──
// Пересборка может дать меньше сцен или кадров, чем было. Правки к ушедшим номерам остаются в review.json, но ни на странице,
// ни в обычной сводке их нет. Эта сводка нужна сборщикам (предупредить) и cli (показать агенту).
export function orphanReport(board, review) {
  const frameIds = new Set((board.frames ?? []).map((f) => f.id)), sceneIds = new Set((board.scenes ?? []).map((s) => s.id));
  const weight = (r) => (r.status || r.rating ? 1 : 0) + (r.note ? 1 : 0) + (r.comments ?? []).length + (r.moves ?? []).length
    + (r.attachments ?? []).filter((a) => !a.removed).length + (r.refs ?? []).filter((x) => !x.removed).length + (r.links ?? []).length;
  const out = [];
  for (const [id, r] of Object.entries(review.frames ?? {})) if (!frameIds.has(id) && weight(r)) out.push({kind: 'frame', id, weight: weight(r), r});
  for (const [id, r] of Object.entries(review.scenes ?? {})) if (!sceneIds.has(id) && weight(r)) out.push({kind: 'scene', id, weight: weight(r), r});
  return out;
}
export const orphanLine = (list) => list.map((o) => `${o.id} (${o.weight})`).join(', ');
