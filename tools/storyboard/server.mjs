// Доска раскадровки: локальный сервер без зависимостей.
//   node tools/storyboard/server.mjs [--port 4321] [--root <папка проекта>] [--videos work]  →  http://localhost:4321
// Доски лежат в <root>/work/<ролик>/storyboard/: board.json (кадры, собирает npm run board или build-board.mjs),
// review.json (правки автора и ответы агента: оценки, комментарии, сдвиги объектов; по сценам: оценка, заметка, комментарии с моментом, референсы анимации),
// scenes/ (клипы и постеры сцен), files/<кадр или сцена>/ (вложения и референсы: скриншоты, видео, gif).
// По умолчанию root это текущая папка. Агент читает правки: node tools/storyboard/cli.mjs <ролик>.
// Предел загрузки файла 300 МБ (переменная STORYBOARD_MAX_UPLOAD_MB меняет его).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {pipeline, Transform} from 'node:stream';
import {pipeline as pipelineP} from 'node:stream/promises';
import {fileURLToPath} from 'node:url';
import {BoardError, readJsonFile, loadReview, mutateReview, findId, rid, nowIso, moveOver} from './store.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(arg('--root', process.env.STORYBOARD_ROOT ?? process.cwd()));
const VIDEOS = path.join(ROOT, arg('--videos', 'work'));
const APP = path.join(HERE, 'app');
const PORT = Number(arg('--port', process.env.PORT ?? 4321));
if (!Number.isInteger(PORT) || PORT < 0 || PORT > 65535) { console.error(`Порт «${arg('--port', process.env.PORT)}» не подходит: нужно целое число, например --port 4322.`); process.exit(1); }
// сервер слушает только этот компьютер: доска пишет файлы на диск, в сеть её выставлять не нужно
const HOST = arg('--host', '127.0.0.1');
const AUTHOR = 'Автор';
const MAX_UPLOAD = Math.round((Number(process.env.STORYBOARD_MAX_UPLOAD_MB) > 0 ? Number(process.env.STORYBOARD_MAX_UPLOAD_MB) : 300) * 1024 * 1024);
const MAX_JSON = 5 * 1024 * 1024;
const mb = (n) => (n / 1048576 >= 10 ? Math.round(n / 1048576) : Math.round(n / 104857.6) / 10);
// Доска пишет файлы на диск, а агент потом читает комментарии как правки автора. Поэтому запросы принимаются только со страницы
// самой доски: чужой сайт в соседней вкладке не должен подсунуть комментарий (проверка Origin и Sec-Fetch-Site)
// или достучаться по чужому имени (проверка Host). Другой локальный сервер на соседнем порту тоже чужой: Origin должен совпасть с Host целиком, с портом.
const LOCAL_NAMES = new Set(['localhost', '127.0.0.1', '[::1]']);
const hostOk = (v) => { try { return LOCAL_NAMES.has(new URL(`http://${v}`).hostname); } catch { return false; } };
const originOk = (origin, host) => { try { const o = new URL(origin); return hostOk(o.host) && o.host === new URL(`http://${host}`).host; } catch { return false; } };

const MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.md': 'text/markdown; charset=utf-8'};
// Содержимое доски (вложения, референсы) это чужие файлы. Даже если в files/ окажется html или svg со скриптом,
// песочница в заголовке не даст ему выполниться, а nosniff запрещает браузеру угадывать тип по содержимому.
const SEC = {'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'};
const CSP_APP = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; media-src 'self'; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";
const CSP_FILES = "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox";
// что можно загружать как вложение кадра и референс сцены
const MEDIA_EXT = new Set(['.mp4', '.webm', '.mov', '.m4v', '.gif', '.png', '.jpg', '.jpeg', '.webp']);
const EXT_HINT = 'mp4, webm, mov, m4v, gif, png, jpg, webp';
const VIDEO_EXT = new Set(['.mp4', '.webm', '.mov', '.m4v']);

const bad = (msg, code = 400) => new BoardError(msg, code);
const safeDecode = (s) => { try { return decodeURIComponent(s); } catch { throw bad('в адресе неверное %-кодирование', 400); } };
const projects = () => fs.existsSync(VIDEOS) ? fs.readdirSync(VIDEOS).filter((p) => fs.existsSync(path.join(VIDEOS, p, 'storyboard', 'board.json'))) : [];
const dirOf = (p) => {
  if (!projects().includes(p)) throw bad('нет такого проекта', 404);
  return path.join(VIDEOS, p, 'storyboard');
};
const boardOf = (d) => readJsonFile(path.join(d, 'board.json'), {}, 'board.json');

const send = (res, code, data, type = 'application/json; charset=utf-8', extra = {}) => {
  if (res.headersSent) return res.destroy();
  res.writeHead(code, {'Content-Type': type, 'Cache-Control': 'no-store', ...SEC, ...extra});
  res.end(typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data));
};
// Тело запроса. Слишком большое тело не рвёт соединение: клиент должен получить понятный ответ, а не «Failed to fetch».
// Если размер объявлен заранее, отказ уходит сразу, остаток тела Node сам выбросит после ответа.
const tooBig = (n, limit, what) => bad(`${what} ${mb(n)} МБ, а предел ${mb(limit)} МБ`, 413);
const body = (req, limit = MAX_JSON, what = 'Запрос') => new Promise((res, rej) => {
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > limit) return rej(tooBig(declared, limit, what));
  const chunks = []; let n = 0, over = false;
  req.on('data', (c) => { n += c.length; if (over) return; if (n > limit) { over = true; chunks.length = 0; } else chunks.push(c); });
  req.on('end', () => (over ? rej(tooBig(n, limit, what)) : res(Buffer.concat(chunks))));
  req.on('error', () => rej(bad('соединение оборвалось, запрос не получен целиком', 400)));
  req.on('close', () => { if (!req.complete) rej(bad('соединение оборвалось, запрос не получен целиком', 400)); });
});

// файлы с поддержкой Range (видео перематывается). Файл сначала открывается, и только потом уходят заголовки:
// нечитаемый файл (занят, нет прав) даёт понятный ответ, а не оборванное соединение.
const serveFile = (req, res, file, extra = {}) => {
  let st, fd;
  try { st = fs.statSync(file); } catch { return send(res, 404, {error: 'нет файла'}); }
  if (!st.isFile()) return send(res, 404, {error: 'нет файла'});
  try { fd = fs.openSync(file, 'r'); } catch (e) {
    return send(res, ['EBUSY', 'EMFILE'].includes(e.code) ? 503 : ['EPERM', 'EACCES'].includes(e.code) ? 403 : 500, {error: `файл не открывается (${e.code}): ${path.basename(file)}`});
  }
  const type = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
  const range = req.headers.range;
  const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
  let start = 0, end = st.size - 1, code = 200;
  if (m && (m[1] || m[2])) {
    // «bytes=-500» это последние 500 байт; конец за пределами файла прижимается к концу; клипы сцен перематываются именно через Range
    start = m[1] ? Number(m[1]) : Math.max(0, st.size - Number(m[2]));
    end = m[1] && m[2] ? Math.min(Number(m[2]), st.size - 1) : st.size - 1;
    if (start >= st.size || start > end) {
      fs.closeSync(fd);
      res.writeHead(416, {'Content-Range': `bytes */${st.size}`, ...SEC});
      return res.end();
    }
    code = 206;
  }
  const head = {'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': st.size ? end - start + 1 : 0, 'Cache-Control': 'no-cache', ...SEC, ...extra,
    ...(code === 206 ? {'Content-Range': `bytes ${start}-${end}/${st.size}`} : {})};
  res.writeHead(code, head);
  if (req.method === 'HEAD' || !st.size) { fs.closeSync(fd); return res.end(); }
  // pipeline закрывает файл и при обрыве клиента (перемотка видео обрывает запросы постоянно), без него дескрипторы копились бы до исчерпания
  pipeline(fs.createReadStream(null, {fd, start, end}), res, (err) => { if (err && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') { console.error(`чтение ${path.basename(file)}: ${err.message}`); res.destroy(); } });
};
const safeJoin = (base, rel) => {
  const b = path.resolve(base), p = path.resolve(b, rel);
  if (p !== b && !p.startsWith(b + path.sep)) throw bad('путь вне проекта', 403);
  return p;
};
// Безопасное имя: буквы, цифры, точка, дефис. Расширение всегда сохраняется (длинное имя обрезается, а не расширение).
const slug = (s, max = 80) => String(s).normalize('NFC').replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/-+/g, '-').replace(/^[.-]+/, '').slice(0, max).replace(/[. -]+$/, '') || 'file';
const splitName = (name) => {
  const base = String(name ?? '').split(/[\\/]/).pop().trim();
  const ext = path.extname(base).toLowerCase();
  return {stem: base.slice(0, base.length - ext.length), ext: /^\.[a-z0-9]{1,5}$/.test(ext) ? ext : ''};
};
// Начало файла должно совпадать с заявленным типом: .exe, текст или обрезок под видом png отсекаются сразу
const sniff = (b, ext) => {
  const at = (i, s) => b.length >= i + s.length && b.subarray(i, i + s.length).toString('latin1') === s;
  switch (ext) {
    case '.png': return b.length >= 4 && b[0] === 0x89 && at(1, 'PNG');
    case '.jpg': case '.jpeg': return b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case '.gif': return at(0, 'GIF8');
    case '.webp': return at(0, 'RIFF') && at(8, 'WEBP');
    case '.webm': return b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3;
    case '.mp4': case '.m4v': case '.mov': return ['ftyp', 'moov', 'mdat', 'wide', 'free', 'skip', 'pnot'].some((t) => at(4, t));
    default: return false;
  }
};

const rv = (v) => String(v ?? '');
const byOf = (m) => rv(m.author).trim().slice(0, 60) || AUTHOR;
// Текст с пределом: молчаливо обрезать нельзя (автор потеряет конец комментария), поэтому длиннее предела это ошибка
const textOf = (v, max, what, required = false) => {
  const s = rv(v).trim();
  if (required && !s) throw bad(`пустой ${what}`);
  if (s.length > max) throw bad(`${what} длиннее ${max} знаков (сейчас ${s.length}): раздели на два`);
  return s;
};
const frac = (p) => {
  const x = Number(p?.x), y = Number(p?.y);
  if (p == null || p.x == null || p.y == null || !Number.isFinite(x) || !Number.isFinite(y)) throw bad('точка сдвига: нужны числа x и y (доли кадра)');
  const r = (v) => Math.round(Math.min(1, Math.max(0, v)) * 10000) / 10000;
  return {x: r(x), y: r(y)};
};
// Размер объекта: множитель 0.1..5 (1.25 крупнее на четверть, 0.8 мельче); пусто или 1 значит «размер не менять»
const scaleOf = (v) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0.1 && n <= 5 && Math.abs(n - 1) > 1e-9 ? Math.round(n * 100) / 100 : null;
};
// секунды: число, «4,4», «4,4 с» или «1:20»; пусто значит «не задано», мусор в строгом режиме это ошибка с подсказкой
const secOf = (v, strict = false) => {
  if (v == null) return null;
  const s = String(v).trim().replace(',', '.').replace(/\s*(?:сек\.?|с\.?|s)$/i, '').trim();
  if (s === '') return null;
  const mm = /^(\d+):(\d{1,2}(?:\.\d+)?)$/.exec(s);
  const n = mm ? (Number(mm[2]) < 60 ? Number(mm[1]) * 60 + Number(mm[2]) : NaN) : /^(?:\d+(?:\.\d+)?|\.\d+)$/.test(s) ? Number(s) : NaN;
  if (Number.isFinite(n) && n >= 0) return Math.round(n * 100) / 100;
  if (strict) throw bad(`секунда «${rv(v).slice(0, 20)}» не разобрана: напиши 4,4 или 1:20`);
  return null;
};
// ссылка на референс: Instagram, YouTube, любая; только http и https (в ссылке не должно быть javascript: и подобного)
const urlOf = (v) => {
  let t = rv(v).trim();
  if (!t) throw bad('пустая ссылка');
  if (t.length > 2000) throw bad(`ссылка длиннее 2000 знаков (сейчас ${t.length})`);
  if (!/^[a-z][a-z0-9+.-]*:/i.test(t)) t = `https://${t}`;
  let u;
  try { u = new URL(t); } catch { throw bad('ссылка не похожа на адрес'); }
  if (!['http:', 'https:'].includes(u.protocol) || !u.hostname) throw bad('ссылка должна начинаться с http:// или https://');
  return u.href;
};
// файл обязан лежать в files/<кадр или сцена>/ и уже быть загружен (/api/upload)
const uploadedFile = (dir, rel, folder) => {
  const parts = rv(rel).split('/');
  if (parts.length !== 3 || parts[0] !== 'files' || parts[1] !== folder || !parts[2] || parts[2].startsWith('.')) throw bad(`файл должен лежать в files/${folder}/`);
  if (!MEDIA_EXT.has(path.extname(parts[2]).toLowerCase())) throw bad(`формат файла: ${EXT_HINT}`);
  if (!fs.existsSync(safeJoin(dir, rel))) throw bad('файл не загружен', 404);
  return rel;
};

// ── сцены: оценка, заметка, комментарии с моментом клипа, референсы анимации ──
// review.json: scenes[<id>] = {rating, note, comments: [{id, t, tag, text, by, at, status, replies: [{id, text, by, at}]}],
//                              refs: [{id, kind: 'file'|'url', path?, url?, t?, take, note?, at, status}]}
const SCENE_TAGS = ['Текст', 'Анимация', 'Тайминг', 'Звук', 'Другое'];
const ownKey = (id) => { if (['__proto__', 'constructor', 'prototype'].includes(id)) throw bad(`имя «${id}» занято`); return id; };
const sceneOf = (cur, id) => {
  const s = (cur.scenes[ownKey(id)] ??= {rating: null, note: '', comments: [], refs: []});
  s.comments ??= []; s.refs ??= [];
  return s;
};
// момент клипа это абсолютная секунда ролика: прижимаем к границам сцены
const momentOf = (v, sc) => { const n = secOf(v); return n == null ? null : Math.round(Math.min(sc.t1, Math.max(sc.t0, n)) * 100) / 100; };
const applyScene = (cur, op, m, {dir, scene}) => {
  const sc = sceneOf(cur, scene.id);
  const refOf = (id) => sc.refs.find((x) => x.id === id) ?? (() => { throw bad('нет такого референса', 404); })();
  switch (op) {
    case 'scene-rate': sc.rating = ['ok', 'fix', 'ask'].includes(m.rating) ? m.rating : null; sc.updatedAt = nowIso(); break;
    case 'scene-note': sc.note = textOf(m.note, 8000, 'заметка'); sc.updatedAt = nowIso(); break;
    case 'scene-comment': {
      const text = textOf(m.text, 8000, 'комментарий', true);
      if (m.parent) { // ответ: лежит в replies корневого комментария
        const c = sc.comments.find((x) => x.id === m.parent);
        if (!c) throw bad('нет комментария, на который отвечают', 404);
        (c.replies ??= []).push({id: rid(), text, by: byOf(m), at: nowIso()});
      } else {
        sc.comments.push({id: rid(), t: momentOf(m.t, scene), tag: SCENE_TAGS.includes(m.tag) ? m.tag : null, text, by: byOf(m), at: nowIso(), status: 'open', replies: []});
      }
      break;
    }
    case 'scene-comment-status': {
      const c = sc.comments.find((x) => x.id === m.id);
      if (!c) throw bad('нет такого комментария', 404);
      c.status = m.status === 'resolved' ? 'resolved' : 'open'; c.statusAt = nowIso();
      break;
    }
    case 'scene-ref': {
      const kind = m.kind === 'file' ? 'file' : m.kind === 'url' ? 'url' : null;
      if (!kind) throw bad('референс бывает файлом (kind: file) или ссылкой (kind: url)');
      const ref = {id: rid(), kind, ...(kind === 'file' ? {path: uploadedFile(dir, m.path, slug(scene.id)), name: rv(m.name).slice(0, 200)} : {url: urlOf(m.url)}),
        t: secOf(m.t, true), take: textOf(m.take, 400, '«что взять»'), note: textOf(m.note, 2000, 'заметка к референсу'), by: byOf(m), at: nowIso(), status: 'open'};
      sc.refs.push(ref);
      break;
    }
    case 'scene-ref-edit': { // «что взять», секунда в референсе и заметка правятся прямо в карточке
      const r = refOf(m.id);
      if ('take' in m) r.take = textOf(m.take, 400, '«что взять»');
      if ('t' in m) r.t = secOf(m.t, true);
      if ('note' in m) r.note = textOf(m.note, 2000, 'заметка к референсу');
      r.editedAt = nowIso();
      break;
    }
    case 'scene-ref-status': { const r = refOf(m.id); r.status = m.status === 'resolved' ? 'resolved' : 'open'; r.statusAt = nowIso(); break; }
    case 'scene-ref-remove': refOf(m.id).removed = nowIso(); break; // мягкое удаление: файл остаётся на диске
    default: throw bad(`неизвестная операция ${op}`, 404);
  }
};

// ── кадры ──
const FRAME_LISTS = ['comments', 'attachments', 'links', 'patterns', 'refs', 'moves'];
const frameOf = (cur, id) => {
  const f = (cur.frames[ownKey(id)] ??= {status: null, note: ''});
  f.status ??= null; f.note ??= '';
  for (const k of FRAME_LISTS) f[k] ??= []; // доски, собранные до появления сдвигов, вложений и т.д.
  return f;
};
const listOf = (v, what) => { if (!Array.isArray(v)) throw bad(`${what}: нужен список`); if (v.length > 200) throw bad(`${what}: не больше 200 записей`); return v; };
const linkOf = (l) => ({id: rv(l?.id).slice(0, 20) || rid(), url: urlOf(l?.url), label: textOf(l?.label, 200, 'подпись ссылки')});
const frameRefOf = (r) => ({uid: rv(r?.uid).slice(0, 20) || rid(), id: textOf(r?.id, 60, 'номер референса', true), time: textOf(r?.time, 60, 'время'), note: textOf(r?.note, 400, '«что взять»')});
const applyFrame = (cur, op, m, ctx) => {
  // общие заметки к кадру не относятся: поле frame в них не читаем (раньше frame: "__proto__" добирался до Object.prototype)
  const fr = op === 'general' ? null : frameOf(cur, m.frame);
  const find = (list, id, what) => list.find((x) => x.id === id) ?? (() => { throw bad(`нет такого ${what}`, 404); })();
  switch (op) {
    case 'frame': // поля кадра целиком: status, note, patterns, refs, links (по одной записи списки правят link-add, pattern-add и ref-add)
      if (!m.patch || typeof m.patch !== 'object' || Array.isArray(m.patch)) throw bad('нужен patch: объект с полями status, note, patterns, refs, links');
      for (const [k, v] of Object.entries(m.patch)) {
        if (k === 'status') { if (v !== null && !['ok', 'fix', 'ask'].includes(v)) throw bad('оценка кадра: ok, fix, ask или null'); fr.status = v; }
        else if (k === 'note') fr.note = textOf(v, 8000, 'заметка');
        else if (k === 'patterns') fr.patterns = listOf(v, 'паттерны').map((x) => textOf(x, 60, 'код паттерна', true));
        else if (k === 'links') fr.links = listOf(v, 'ссылки').map(linkOf);
        else if (k === 'refs') fr.refs = listOf(v, 'референсы').map(frameRefOf);
        else throw bad(`поле «${k}» через frame менять нельзя`);
      }
      fr.updatedAt = nowIso(); break;
    case 'link-add': fr.links.push(linkOf({url: m.url, label: m.label, id: null})); break;
    case 'link-remove': { // по id; у ссылок старых досок id нет, тогда по адресу и подписи
      const i = fr.links.findIndex((l) => (m.id ? l.id === m.id : l.url === m.url && (l.label ?? '') === (m.label ?? '')));
      if (i < 0) throw bad('нет такой ссылки', 404);
      fr.links.splice(i, 1); break;
    }
    case 'pattern-add': { const c = textOf(m.code, 60, 'код паттерна', true); if (!fr.patterns.includes(c)) fr.patterns.push(c); break; }
    case 'pattern-remove': fr.patterns = fr.patterns.filter((x) => x !== m.code); break;
    case 'ref-add': fr.refs.push(frameRefOf({id: m.ref, time: m.time, note: m.note})); break;
    case 'ref-remove': {
      const i = fr.refs.findIndex((r) => (m.uid ? r.uid === m.uid : r.id === m.ref && (r.time ?? '') === (m.time ?? '') && (r.note ?? '') === (m.note ?? '')));
      if (i < 0) throw bad('нет такого референса', 404);
      fr.refs.splice(i, 1); break;
    }
    case 'comment': {
      const text = textOf(m.text, 8000, 'комментарий', true);
      let parent = null;
      if (m.parent != null && m.parent !== '') { // ответ всегда лежит под корневым комментарием
        const p = fr.comments.find((x) => x.id === m.parent);
        if (!p) throw bad('нет комментария, на который отвечают', 404);
        parent = p.parent ?? p.id;
      }
      const at = m.at == null || m.at === '' || !Number.isFinite(Number(m.at)) || Number(m.at) < 0 ? null : Math.round(Number(m.at) * 100) / 100;
      fr.comments.push({id: rid(), author: byOf(m), text, at, parent, status: 'open', createdAt: nowIso()});
      break;
    }
    case 'comment-status': {
      const c = find(fr.comments, m.id, 'комментария');
      c.status = m.status === 'resolved' ? 'resolved' : 'open'; c.statusAt = nowIso();
      break;
    }
    case 'comment-edit': {
      const c = find(fr.comments, m.id, 'комментария');
      c.text = textOf(m.text, 8000, 'комментарий', true); c.editedAt = nowIso();
      break;
    }
    case 'attach': { // файл уже загружен через /api/upload: имя, тип и путь проверяются, а не берутся на веру
      const rel = uploadedFile(ctx.dir, m.path, slug(m.frame));
      fr.attachments.push({id: rid(), path: rel, name: rv(m.name).slice(0, 200) || path.basename(rel), kind: VIDEO_EXT.has(path.extname(rel).toLowerCase()) ? 'video' : 'image',
        label: textOf(m.label, 200, 'подпись'), author: byOf(m), createdAt: nowIso()});
      break;
    }
    case 'attach-remove': {
      const a = find(fr.attachments, m.id, 'вложения');
      a.removed = nowIso(); // мягкое удаление: файл остаётся на диске
      break;
    }
    case 'move': // стрелка сдвига: от объекта к новому месту; координаты в долях кадра, подпись «что двигаем»
      fr.moves.push({id: rid(), from: frac(m.from), to: frac(m.to), label: textOf(m.label, 400, 'подпись сдвига'), scale: scaleOf(m.scale),
        status: 'open', author: byOf(m), createdAt: nowIso()});
      break;
    case 'move-edit': {
      const v = find(fr.moves, m.id, 'сдвига');
      if ('from' in m) v.from = frac(m.from);
      if ('to' in m) v.to = frac(m.to);
      if ('label' in m) v.label = textOf(m.label, 400, 'подпись сдвига');
      if ('scale' in m) v.scale = scaleOf(m.scale);
      v.editedAt = nowIso();
      break;
    }
    case 'move-status': {
      const v = find(fr.moves, m.id, 'сдвига');
      v.status = m.status === 'resolved' ? 'resolved' : 'open'; v.statusAt = nowIso();
      break;
    }
    case 'move-remove': // стрелку можно удалить совсем; прежняя версия review.json лежит в history/
      fr.moves = fr.moves.filter((x) => x.id !== m.id);
      break;
    case 'general': // общие заметки к ролику
      (cur.general ??= []).push({id: rid(), author: byOf(m), text: textOf(m.text, 8000, 'заметка', true), status: 'open', createdAt: nowIso()});
      break;
    default: throw bad(`неизвестная операция ${op}`, 404);
  }
};
const applyOp = (cur, op, m, ctx = {}) => (op.startsWith('scene-') ? applyScene(cur, op, m, ctx) : applyFrame(cur, op, m, ctx));

// Загрузка файла: тело запроса пишется на диск потоком (в память целиком файл не читается), с проверкой типа, начала файла и размера.
async function upload(req, q, d) {
  const board = boardOf(d);
  const ids = [...(board.frames ?? []).map((f) => f.id), ...(board.scenes ?? []).map((s) => s.id)];
  const target = q.frame ? (findId(ids, q.frame) ?? (q.frame === 'общие' ? 'общие' : null)) : 'общие';
  if (!target) throw bad(`нет кадра или сцены «${rv(q.frame).slice(0, 30)}»`, 404);
  const {stem, ext} = splitName(q.name);
  if (!MEDIA_EXT.has(ext)) throw bad(`формат ${ext || 'без расширения'} не подходит. Нужны: ${EXT_HINT}.`, 415);
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > MAX_UPLOAD) throw tooBig(declared, MAX_UPLOAD, 'Файл');
  const folder = slug(target), dir = path.join(d, 'files', folder);
  fs.mkdirSync(dir, {recursive: true});
  const name = `${Date.now().toString(36)}${rid().slice(0, 3)}-${slug(stem, 60)}${ext}`;
  const dest = path.join(dir, name), part = `${dest}.part`;
  let n = 0, over = false, head = Buffer.alloc(0);
  const counter = new Transform({transform(chunk, _e, cb) {
    n += chunk.length;
    if (head.length < 16) head = Buffer.concat([head, chunk.subarray(0, 16 - head.length)]);
    if (n > MAX_UPLOAD) { over = true; return cb(); } // лишнее выбрасываем, но читаем до конца: ответ дойдёт до страницы
    cb(null, chunk);
  }});
  const drop = () => { try { fs.unlinkSync(part); } catch { /* не успел создаться */ } };
  try { await pipelineP(req, counter, fs.createWriteStream(part, {flags: 'wx'})); } catch (e) {
    drop();
    if (e.code === 'ENOSPC') throw bad('на диске нет места', 507);
    if (e.code === 'ERR_STREAM_PREMATURE_CLOSE' || e.code === 'ECONNRESET' || e.code === 'ABORT_ERR') throw bad('загрузка оборвалась, файл сохранён не целиком', 400);
    throw bad(`файл не удалось сохранить (${e.code ?? e.message})`, 500);
  }
  if (over) { drop(); throw tooBig(n, MAX_UPLOAD, 'Файл'); }
  if (n === 0) { drop(); throw bad('файл пустой'); }
  if (!sniff(head, ext)) { drop(); throw bad(`«${rv(q.name).slice(0, 60)}» не похож на ${ext.slice(1)}: внутри другие данные. Проверь, что выбран нужный файл.`, 415); }
  try { moveOver(part, dest); } catch (e) { drop(); throw bad(`файл не удалось сохранить (${e.code ?? e.message}): его держит другая программа, повтори через секунду`, 503); }
  return {ok: true, path: `files/${folder}/${name}`, size: n};
}

const server = http.createServer(async (req, res) => {
  try {
    if (!hostOk(req.headers.host ?? '')) return send(res, 403, {error: 'чужое имя хоста'});
    if (req.method === 'POST') {
      const site = req.headers['sec-fetch-site'];
      if ((req.headers.origin && !originOk(req.headers.origin, req.headers.host)) || (site && !['same-origin', 'none'].includes(site))) return send(res, 403, {error: 'запрос с чужого сайта'});
    }
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const q = Object.fromEntries(url.searchParams);
    if (url.pathname === '/api/projects') return send(res, 200, projects().map((p) => ({id: p, title: (() => { try { return boardOf(path.join(VIDEOS, p, 'storyboard')).title; } catch { return null; } })() ?? p})));
    if (url.pathname === '/api/board') {
      const d = dirOf(q.project);
      const {review, repaired} = loadReview(d);
      // version = время записи board.json: меняется при пересборке доски, и открытая страница перечитывает кадры и клипы (адреса клипов получают ?v=version)
      return send(res, 200, {board: boardOf(d), version: Math.floor(fs.statSync(path.join(d, 'board.json')).mtimeMs), review, ...(repaired ? {warning: repaired} : {})});
    }
    if (url.pathname === '/api/upload' && req.method === 'POST') return send(res, 200, await upload(req, q, dirOf(q.project)));
    if (url.pathname.startsWith('/api/') && req.method === 'POST') {
      // все правки это операции над review.json: сервер сливает их по полям и по id комментариев под замком,
      // поэтому ответ агента и правка автора в одном кадре не затирают друг друга
      const d = dirOf(q.project);
      let msg;
      try { msg = JSON.parse((await body(req)).toString('utf8')); } catch (e) { throw e instanceof BoardError ? e : bad('тело запроса не JSON'); }
      if (msg === null || typeof msg !== 'object' || Array.isArray(msg)) throw bad('тело запроса не объект');
      const op = url.pathname.slice(5);
      const ctx = {dir: d};
      // кадр или сцена обязаны быть в board.json: так в review.json не попадают чужие или служебные имена.
      // Латинские K001 и C01 и номера без нулей (К5) узнаются как К005 и С01.
      const board = boardOf(d);
      if (op.startsWith('scene-')) {
        const id = findId((board.scenes ?? []).map((s) => s.id), msg.scene);
        ctx.scene = (board.scenes ?? []).find((s) => s.id === id);
        if (!ctx.scene) throw bad(`нет сцены «${rv(msg.scene).slice(0, 30)}»`, 404);
      } else if (op !== 'general') {
        const id = findId((board.frames ?? []).map((f) => f.id), msg.frame);
        if (!id) throw bad(`нет кадра «${rv(msg.frame).slice(0, 30)}»`, 404);
        msg.frame = id;
      }
      return send(res, 200, {ok: true, review: mutateReview(d, (cur) => applyOp(cur, op, msg, ctx))});
    }
    if (url.pathname.startsWith('/p/')) {
      // /p/<проект>/<путь внутри storyboard>: картинки кадров, вложения, видео фильма
      const [, , project, ...rest] = url.pathname.split('/');
      return serveFile(req, res, safeJoin(dirOf(safeDecode(project)), safeDecode(rest.join('/'))), {'Content-Security-Policy': CSP_FILES});
    }
    if (url.pathname.startsWith('/api/')) return send(res, 404, {error: 'нет такого адреса'});
    const file = url.pathname === '/' ? path.join(APP, 'index.html') : safeJoin(APP, safeDecode(url.pathname.slice(1)));
    return serveFile(req, res, file, {'Content-Security-Policy': CSP_APP});
  } catch (e) {
    const code = Number.isInteger(e.code) && e.code >= 400 && e.code < 600 ? e.code : e.code === 'ERR_INVALID_URL' ? 400 : 500;
    if (code === 500) console.error(`${req.method} ${req.url}: ${e.stack ?? e}`);
    return send(res, code, {error: String(e.message ?? e)});
  }
});
server.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `Порт ${PORT} занят: доска уже запущена или порт нужен другой (--port 4322).` : `Сервер не запустился: ${e.message}`);
  process.exit(1);
});
server.listen(PORT, HOST, () => console.log(`Доска раскадровки: http://localhost:${server.address().port}  (папка ${VIDEOS}, проекты: ${projects().join(', ') || 'нет'})`));
