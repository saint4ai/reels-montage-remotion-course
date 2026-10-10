// Доска раскадровки: локальный сервер без зависимостей.
//   node tools/storyboard/server.mjs [--port 4321] [--root <папка проекта>] [--videos work]  →  http://localhost:4321
// Доски лежат в <root>/work/<ролик>/storyboard/: board.json (кадры, собирает npm run board или build-board.mjs),
// review.json (правки автора и ответы агента: оценки, комментарии, сдвиги объектов), files/<кадр>/ (вложения: скриншоты, видео).
// По умолчанию root это текущая папка. Агент читает правки: node tools/storyboard/cli.mjs <ролик>.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(arg('--root', process.env.STORYBOARD_ROOT ?? process.cwd()));
const VIDEOS = path.join(ROOT, arg('--videos', 'work'));
const APP = path.join(HERE, 'app');
const PORT = Number(arg('--port', process.env.PORT ?? 4321));
// сервер слушает только этот компьютер: доска пишет файлы на диск, в сеть её выставлять не нужно
const HOST = arg('--host', '127.0.0.1');
const AUTHOR = 'Автор';
// Доска пишет файлы на диск, а агент потом читает комментарии как правки автора. Поэтому запросы принимаются только со страницы
// самой доски: чужой сайт в соседней вкладке не должен подсунуть комментарий (проверка Origin) или достучаться по чужому имени (проверка Host).
const LOCAL_NAMES = new Set(['localhost', '127.0.0.1', '[::1]']);
const hostOk = (v) => { try { return LOCAL_NAMES.has(new URL(`http://${v}`).hostname) || LOCAL_NAMES.has(`[${new URL(`http://${v}`).hostname}]`); } catch { return false; } };
const originOk = (v) => { try { return LOCAL_NAMES.has(new URL(v).hostname) || LOCAL_NAMES.has(`[${new URL(v).hostname}]`); } catch { return false; } };

const MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.md': 'text/markdown; charset=utf-8'};

const projects = () => fs.existsSync(VIDEOS) ? fs.readdirSync(VIDEOS).filter((p) => fs.existsSync(path.join(VIDEOS, p, 'storyboard', 'board.json'))) : [];
const dirOf = (p) => {
  if (!projects().includes(p)) throw Object.assign(new Error('нет такого проекта'), {code: 404});
  return path.join(VIDEOS, p, 'storyboard');
};
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
// запись атомарно + копия предыдущей версии (правки не теряются)
const writeJson = (f, data) => {
  if (fs.existsSync(f)) {
    const hist = path.join(path.dirname(f), 'history');
    fs.mkdirSync(hist, {recursive: true});
    fs.copyFileSync(f, path.join(hist, `${path.basename(f, '.json')}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`));
    const old = fs.readdirSync(hist).filter((n) => n.startsWith(path.basename(f, '.json'))).sort();
    for (const n of old.slice(0, Math.max(0, old.length - 60))) fs.unlinkSync(path.join(hist, n));
  }
  const tmp = `${f}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
  fs.renameSync(tmp, f);
};
const body = (req, limit = 600 * 1024 * 1024) => new Promise((res, rej) => {
  const chunks = []; let n = 0;
  req.on('data', (c) => { n += c.length; if (n > limit) { rej(new Error('слишком большой файл')); req.destroy(); } else chunks.push(c); });
  req.on('end', () => res(Buffer.concat(chunks)));
  req.on('error', rej);
});
const send = (res, code, data, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, {'Content-Type': type, 'Cache-Control': 'no-store'});
  res.end(typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data));
};
// файлы с поддержкой Range (видео перематывается)
const serveFile = (req, res, file) => {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, {error: 'нет файла'});
  const st = fs.statSync(file);
  const type = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m && m[1] ? Number(m[1]) : 0;
    const end = m && m[2] ? Number(m[2]) : st.size - 1;
    res.writeHead(206, {'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1});
    fs.createReadStream(file, {start, end}).pipe(res);
  } else {
    res.writeHead(200, {'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache'});
    fs.createReadStream(file).pipe(res);
  }
};
const safeJoin = (base, rel) => {
  const b = path.resolve(base), p = path.resolve(b, rel);
  if (p !== b && !p.startsWith(b + path.sep)) throw Object.assign(new Error('путь вне проекта'), {code: 403});
  return p;
};
const slug = (s) => s.normalize('NFC').replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/-+/g, '-').slice(0, 80) || 'file';

const now = () => new Date().toISOString();
const rid = () => Math.random().toString(36).slice(2, 9);
const mutate = (d, fn) => {
  const f = path.join(d, 'review.json');
  const cur = readJson(f, {frames: {}, general: [], updatedAt: null});
  cur.frames ??= {};
  fn(cur);
  cur.updatedAt = now();
  writeJson(f, cur);
  return cur;
};
const frameOf = (cur, id) => {
  const f = (cur.frames[id] ??= {status: null, note: '', comments: [], attachments: [], links: [], patterns: [], refs: [], moves: []});
  f.moves ??= []; // доски, собранные до появления сдвигов
  return f;
};
// Доли кадра 0..1 от левого верхнего угла. Мусор и NaN отбрасываем, выход за кадр прижимаем к краю.
const frac = (p) => {
  const x = Number(p?.x), y = Number(p?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw Object.assign(new Error('точка сдвига: нужны числа x и y (доли кадра)'), {code: 400});
  const r = (v) => Math.round(Math.min(1, Math.max(0, v)) * 10000) / 10000;
  return {x: r(x), y: r(y)};
};
// Размер объекта: множитель 0.1..5 (1.25 крупнее на четверть, 0.8 мельче); пусто или 1 значит «размер не менять»
const scaleOf = (v) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0.1 && n <= 5 && Math.abs(n - 1) > 1e-9 ? Math.round(n * 100) / 100 : null;
};
const applyOp = (cur, op, m) => {
  const fr = m.frame ? frameOf(cur, m.frame) : null;
  switch (op) {
    case 'frame': // скалярные поля кадра: status, note, patterns, refs, links
      for (const k of ['status', 'note', 'patterns', 'refs', 'links']) if (k in m.patch) fr[k] = m.patch[k];
      fr.updatedAt = now(); break;
    case 'comment':
      fr.comments.push({id: rid(), author: m.author || AUTHOR, text: String(m.text ?? '').slice(0, 8000), at: m.at ?? null, parent: m.parent ?? null, status: 'open', createdAt: now()});
      break;
    case 'comment-status': {
      const c = fr.comments.find((x) => x.id === m.id);
      if (c) { c.status = m.status; c.statusAt = now(); }
      break;
    }
    case 'comment-edit': {
      const c = fr.comments.find((x) => x.id === m.id);
      if (c) { c.text = String(m.text ?? '').slice(0, 8000); c.editedAt = now(); }
      break;
    }
    case 'attach':
      fr.attachments.push({id: rid(), path: m.path, name: m.name, kind: m.kind, label: m.label ?? '', author: m.author || AUTHOR, createdAt: now()});
      break;
    case 'attach-remove': {
      const a = fr.attachments.find((x) => x.id === m.id);
      if (a) a.removed = now(); // мягкое удаление: файл остаётся на диске
      break;
    }
    case 'move': // стрелка сдвига: от объекта к новому месту; координаты в долях кадра, подпись «что двигаем»
      fr.moves.push({id: rid(), from: frac(m.from), to: frac(m.to), label: String(m.label ?? '').trim().slice(0, 400), scale: scaleOf(m.scale),
        status: 'open', author: m.author || AUTHOR, createdAt: now()});
      break;
    case 'move-edit': {
      const v = fr.moves.find((x) => x.id === m.id);
      if (!v) throw Object.assign(new Error('нет такого сдвига'), {code: 404});
      if ('from' in m) v.from = frac(m.from);
      if ('to' in m) v.to = frac(m.to);
      if ('label' in m) v.label = String(m.label ?? '').trim().slice(0, 400);
      if ('scale' in m) v.scale = scaleOf(m.scale);
      v.editedAt = now();
      break;
    }
    case 'move-status': {
      const v = fr.moves.find((x) => x.id === m.id);
      if (v) { v.status = m.status === 'resolved' ? 'resolved' : 'open'; v.statusAt = now(); }
      break;
    }
    case 'move-remove': // стрелку можно удалить совсем; прежняя версия review.json лежит в history/
      fr.moves = fr.moves.filter((x) => x.id !== m.id);
      break;
    case 'general': // общие заметки к ролику
      (cur.general ??= []).push({id: rid(), author: m.author || AUTHOR, text: String(m.text ?? '').slice(0, 8000), status: 'open', createdAt: now()});
      break;
    default: throw Object.assign(new Error(`неизвестная операция ${op}`), {code: 404});
  }
};

const server = http.createServer(async (req, res) => {
  try {
    if (!hostOk(req.headers.host ?? '')) return send(res, 403, {error: 'чужое имя хоста'});
    if (req.method === 'POST' && req.headers.origin && !originOk(req.headers.origin)) return send(res, 403, {error: 'запрос с чужого сайта'});
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const q = Object.fromEntries(url.searchParams);
    if (url.pathname === '/api/projects') return send(res, 200, projects().map((p) => ({id: p, title: readJson(path.join(VIDEOS, p, 'storyboard', 'board.json'), {}).title ?? p})));
    if (url.pathname === '/api/board') {
      const d = dirOf(q.project);
      return send(res, 200, {board: readJson(path.join(d, 'board.json'), {}), review: readJson(path.join(d, 'review.json'), {frames: {}, patterns: [], refs: []})});
    }
    if (url.pathname.startsWith('/api/') && req.method === 'POST' && url.pathname !== '/api/upload') {
      // все правки это операции над review.json: сервер сливает их по полям и по id комментариев,
      // поэтому ответ агента и правка автора в одном кадре не затирают друг друга
      const d = dirOf(q.project);
      const msg = JSON.parse((await body(req, 5 * 1024 * 1024)).toString('utf8'));
      const op = url.pathname.slice(5);
      // кадр обязан быть в board.json: так в review.json не попадают чужие или служебные имена
      if (op !== 'general') {
        const frames = readJson(path.join(d, 'board.json'), {}).frames ?? [];
        if (!frames.some((f) => f.id === msg.frame)) throw Object.assign(new Error(`нет кадра «${msg.frame}»`), {code: 404});
      }
      const review = mutate(d, (cur) => applyOp(cur, op, msg));
      return send(res, 200, {ok: true, review});
    }
    if (url.pathname === '/api/upload' && req.method === 'POST') {
      const d = dirOf(q.project);
      const frame = slug(q.frame ?? 'общие');
      const name = `${Date.now().toString(36)}-${slug(q.name ?? 'вложение')}`;
      const dir = path.join(d, 'files', frame);
      fs.mkdirSync(dir, {recursive: true});
      fs.writeFileSync(path.join(dir, name), await body(req));
      return send(res, 200, {ok: true, path: `files/${frame}/${name}`});
    }
    if (url.pathname.startsWith('/p/')) {
      // /p/<проект>/<путь внутри storyboard>: картинки кадров, вложения, видео фильма
      const [, , project, ...rest] = url.pathname.split('/');
      return serveFile(req, res, safeJoin(dirOf(decodeURIComponent(project)), decodeURIComponent(rest.join('/'))));
    }
    const file = url.pathname === '/' ? path.join(APP, 'index.html') : safeJoin(APP, decodeURIComponent(url.pathname.slice(1)));
    return serveFile(req, res, file);
  } catch (e) {
    return send(res, [400, 403, 404].includes(e.code) ? e.code : 500, {error: String(e.message ?? e)});
  }
});
server.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `Порт ${PORT} занят: доска уже запущена или порт нужен другой (--port 4322).` : `Сервер не запустился: ${e.message}`);
  process.exit(1);
});
server.listen(PORT, HOST, () => console.log(`Доска раскадровки: http://localhost:${PORT}  (папка ${VIDEOS}, проекты: ${projects().join(', ') || 'нет'})`));
