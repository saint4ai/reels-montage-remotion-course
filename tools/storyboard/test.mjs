// Проверка доски раскадровки без браузера: npm run board:test
// Собирает доску из поддельных кадров во временной папке, запускает сервер на свободном порту, ставит сдвиги операциями API,
// читает их агентским cli.mjs (доли и пиксели кадра 1440×2560) и закрывает. Chrome и рендер не нужны.
// Сцены: границы, привязка кадров, комментарии с моментом, референсы, Range и cli проверяются без ffmpeg; нарезка клипов из фильма идёт, только если ffmpeg есть (иначе эти два теста пропускаются).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import http from 'node:http';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {planScenes, buildScenes, cutScenes, readScenesFile} from './scenes.mjs';
import {mmss, mmssShort, findId, readJsonFile, withLock, orphanReport, BoardError} from './store.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NODE = process.execPath;
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'board-test-'));
const sheet = path.join(root, 'reviews', 'Demo-v001');
fs.mkdirSync(sheet, {recursive: true});
for (const n of ['K001', 'K002', 'K003']) fs.writeFileSync(path.join(sheet, `${n}.png`), 'не картинка, но для сборки доски хватит');
fs.writeFileSync(path.join(sheet, 'frames.json'), JSON.stringify({composition: 'Demo', fps: 60, durationInFrames: 360, width: 1440, height: 2560, step: 2,
  frames: [{n: 1, frame: 0, t: 0}, {n: 2, frame: 120, t: 2}, {n: 3, frame: 359, t: 5.98}]}));
fs.mkdirSync(path.join(root, 'work', 'Demo'), {recursive: true});
fs.writeFileSync(path.join(root, 'work', 'Demo', 'words.json'), JSON.stringify([{text: 'Привет', start: 0.2, end: 0.5}, {text: 'мир', start: 2.1, end: 2.4}]));

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const cli = (...args) => spawnSync(NODE, [path.join(HERE, 'cli.mjs'), 'Demo', ...args, '--root', root], {encoding: 'utf8'});
const board = () => JSON.parse(fs.readFileSync(path.join(root, 'work', 'Demo', 'storyboard', 'board.json'), 'utf8'));
const review = () => JSON.parse(fs.readFileSync(path.join(root, 'work', 'Demo', 'storyboard', 'review.json'), 'utf8'));

let port, server;
// запрос с произвольными заголовками (fetch не даёт подменить Host, поэтому http.request)
// браузер держит соединение открытым (keep-alive): ответ на слишком большой запрос должен дойти и в этом случае
const KA = new http.Agent({keepAlive: true});
const call = (method, url, body, headers = {}, agent = false) => new Promise((res, rej) => {
  const data = body == null ? null : JSON.stringify(body);
  const req = http.request({host: '127.0.0.1', port, path: url, method, agent, headers: {...(data ? {'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data)} : {}), ...headers}},
    (r) => { const ch = []; r.on('data', (c) => ch.push(c)); r.on('end', () => { const t = Buffer.concat(ch).toString('utf8'); let j = null; try { j = JSON.parse(t); } catch { /* не json */ } res({status: r.statusCode, json: j}); }); });
  req.on('error', rej);
  if (data) req.write(data);
  req.end();
});
const api = (op, body, headers) => call('POST', `/api/${op}?project=Demo`, body, headers);

test('сборка доски из кадров листа', () => {
  const r = spawnSync(NODE, [path.join(HERE, 'board-from-frames.mjs'), 'Demo', '--root', root], {encoding: 'utf8'});
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const b = board();
  assert.deepEqual(b.frames.map((f) => f.id), ['К001', 'К002', 'К003']); // кириллическая К, как в правках ученика
  assert.equal(b.width, 1440); assert.equal(b.height, 2560); assert.equal(b.film, null);
  assert.equal(b.frames[1].t0, 2); assert.equal(b.frames[0].phrase, 'Привет'); assert.equal(b.frames[1].phrase, 'мир');
  assert.ok(fs.existsSync(path.join(root, 'work', 'Demo', 'storyboard', 'frames', 'К002.png')));
});

test('сервер стартует и отдаёт страницу и доску', async () => {
  port = await freePort();
  server = spawn(NODE, [path.join(HERE, 'server.mjs'), '--root', root, '--port', String(port)], {stdio: ['ignore', 'pipe', 'pipe']});
  await new Promise((res, rej) => { server.stdout.on('data', (d) => /localhost/.test(String(d)) && res()); server.on('exit', (c) => rej(new Error(`сервер вышел с кодом ${c}`))); setTimeout(() => rej(new Error('сервер не стартовал за 10 с')), 10000); });
  const page = await call('GET', '/');
  assert.equal(page.status, 200);
  const list = await call('GET', '/api/projects');
  assert.deepEqual(list.json, [{id: 'Demo', title: 'Demo'}]);
});

test('сдвиги: создание, правка, статус, удаление и защита от мусора', async () => {
  const ok = await api('move', {frame: 'К001', from: {x: 0.25, y: 0.4}, to: {x: 0.75, y: 0.2}, label: 'телефон', scale: '1.25', author: 'Тест'});
  assert.equal(ok.status, 200);
  const m = ok.json.review.frames['К001'].moves[0];
  assert.deepEqual([m.from, m.to, m.label, m.scale, m.status], [{x: 0.25, y: 0.4}, {x: 0.75, y: 0.2}, 'телефон', 1.25, 'open']);
  // выход за кадр прижимается, размер «1» и мусор значат «не менять»
  const clamp = await api('move', {frame: 'К002', from: {x: -3, y: 0.5}, to: {x: 7, y: 0.5}, label: '  заголовок  ', scale: 1});
  const c = clamp.json.review.frames['К002'].moves[0];
  assert.deepEqual([c.from.x, c.to.x, c.label, c.scale], [0, 1, 'заголовок', null]);
  // плохие данные не пишутся в review.json
  assert.equal((await api('move', {frame: 'К001', from: {x: 'a', y: 0}, to: {x: 1, y: 1}})).status, 400);
  assert.equal((await api('move', {frame: 'К999', from: {x: 0, y: 0}, to: {x: 1, y: 1}})).status, 404);
  assert.equal((await api('move', {frame: '__proto__', from: {x: 0, y: 0}, to: {x: 1, y: 1}})).status, 404);
  assert.equal(review().frames['К001'].moves.length, 1);
  // правка, статус, удаление
  const id = m.id;
  const edit = await api('move-edit', {frame: 'К001', id, to: {x: 0.5, y: 0.5}, label: 'телефон, левее', scale: '0.8'});
  assert.deepEqual([edit.json.review.frames['К001'].moves[0].to, edit.json.review.frames['К001'].moves[0].scale], [{x: 0.5, y: 0.5}, 0.8]);
  assert.equal((await api('move-status', {frame: 'К001', id, status: 'resolved'})).json.review.frames['К001'].moves[0].status, 'resolved');
  assert.equal((await api('move-status', {frame: 'К001', id, status: 'open'})).json.review.frames['К001'].moves[0].status, 'open');
  const extra = await api('move', {frame: 'К001', from: {x: 0.1, y: 0.1}, to: {x: 0.9, y: 0.9}, label: 'лишняя'});
  const extraId = extra.json.review.frames['К001'].moves[1].id;
  const gone = await api('move-remove', {frame: 'К001', id: extraId});
  assert.deepEqual(gone.json.review.frames['К001'].moves.map((x) => x.id), [id]);
});

test('чужой сайт и чужое имя хоста не пишут в доску', async () => {
  const body = {frame: 'К001', from: {x: 0, y: 0}, to: {x: 1, y: 1}, label: 'подсунуто'};
  assert.equal((await api('move', body, {Origin: 'https://evil.example'})).status, 403);
  assert.equal((await api('move', body, {Host: 'evil.example'})).status, 403);
  // страница самой доски: Origin совпадает с Host целиком, с портом (запрос от http.request идёт на 127.0.0.1)
  assert.equal((await api('move', body, {Origin: `http://127.0.0.1:${port}`})).status, 200);
  assert.equal((await api('move', body, {Origin: `http://localhost:${port}`, Host: `localhost:${port}`})).status, 200);
  assert.equal((await api('move', body, {'Sec-Fetch-Site': 'same-origin'})).status, 200);
  // другой локальный сервер на соседнем порту (чужой сайт на localhost:3001) тоже чужой
  assert.equal((await api('move', body, {Origin: 'http://localhost:3001'})).status, 403);
  assert.equal((await api('move', body, {Origin: `http://127.0.0.1:${port + 1}`})).status, 403);
  assert.equal((await api('move', body, {'Sec-Fetch-Site': 'same-site'})).status, 403);
  assert.equal((await api('move', body, {'Sec-Fetch-Site': 'cross-site'})).status, 403);
  assert.equal((await api('move', body, {Origin: 'null'})).status, 403, 'песочница и data: страницы шлют Origin: null');
  for (const mv of review().frames['К001'].moves.filter((x) => x.label === 'подсунуто')) assert.equal((await api('move-remove', {frame: 'К001', id: mv.id})).status, 200);
  assert.ok(!review().frames['К001'].moves.some((x) => x.label === 'подсунуто'));
});

test('cli: сдвиги в долях и в пикселях кадра 1440×2560, решение сдвига', () => {
  const out = cli().stdout;
  assert.match(out, /К001/);
  assert.match(out, /«телефон, левее»/);
  assert.match(out, /из \(360, 1024\) px = \(0\.25, 0\.4\) доли/);          // 0.25 × 1440, 0.4 × 2560
  assert.match(out, /в \(720, 1280\) px = \(0\.5, 0\.5\) доли/);              // правка сдвига: 0.5 × 1440, 0.5 × 2560
  assert.match(out, /сдвиг \+360 px по x, \+256 px по y \(кадр 1440×2560\)/);
  assert.match(out, /размер ×0\.8 \(мельче\)/);
  assert.match(out, /из \(0, 1280\) px = \(0\.0, 0\.5\) доли\s+→\s+в \(1440, 1280\)/); // К002: прижатые к краям точки
  const id = review().frames['К001'].moves[0].id;
  const res = cli('resolve', 'К001', id);
  assert.equal(res.status, 0, res.stdout);
  assert.equal(review().frames['К001'].moves[0].status, 'resolved');
  assert.ok(!cli().stdout.includes('«телефон, левее»'), 'решённый сдвиг по умолчанию скрыт');
  assert.match(cli('--all').stdout, /\[решено\]/);
  assert.notEqual(cli('resolve', 'К001', 'нетТакого').status, 0);
  assert.ok(fs.readdirSync(path.join(root, 'work', 'Demo', 'storyboard', 'history')).length > 0, 'прежние версии review.json сохраняются');
});

test('пересборка доски не трогает правки', () => {
  const before = fs.readFileSync(path.join(root, 'work', 'Demo', 'storyboard', 'review.json'), 'utf8');
  const r = spawnSync(NODE, [path.join(HERE, 'board-from-frames.mjs'), 'Demo', '--root', root], {encoding: 'utf8'});
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.readFileSync(path.join(root, 'work', 'Demo', 'storyboard', 'review.json'), 'utf8'), before);
});

// ──────────────────────────── сцены ────────────────────────────
// Границы и привязка кадров проверяются без ffmpeg; нарезка клипов и сборщики с фильмом идут только если ffmpeg есть (иначе пропуск).
const hasFfmpeg = spawnSync('ffmpeg', ['-version'], {encoding: 'utf8'}).status === 0;
const sceneRoot = (...p) => path.join(root, 'work', ...p);

test('сцены: равные куски по 3 с, короткий хвост приклеивается к предыдущей', () => {
  const ranges = (D, chunk) => planScenes({duration: D, chunk}).scenes.map((s) => [s.t0, s.t1]);
  assert.deepEqual(ranges(17, 3), [[0, 3], [3, 6], [6, 9], [9, 12], [12, 15], [15, 17]]);      // хвост 2 с: своя сцена
  assert.deepEqual(ranges(16.2, 3), [[0, 3], [3, 6], [6, 9], [9, 12], [12, 16.2]]);            // хвост 1,2 с короче 1,5: приклеен
  assert.deepEqual(ranges(10, 3), [[0, 3], [3, 6], [6, 10]]);
  assert.deepEqual(ranges(1, 3), [[0, 1]]);                                                       // ролик короче куска: одна сцена
  assert.deepEqual(ranges(10, 4), [[0, 4], [4, 8], [8, 10]]);
  assert.equal(planScenes({duration: 10}).scenes.length, 3, 'по умолчанию 3 с');
  assert.deepEqual(planScenes({duration: 7, chunk: 3}).scenes.map((s) => s.title), ['Сцена 1', 'Сцена 2']);
  assert.throws(() => planScenes({duration: 10, chunk: 0}), /--chunk/);
  assert.throws(() => planScenes({duration: 0}), /длительность/);
});

test('сцены: файл scenes.json сортируется, проверяется и обрезается по длине ролика', () => {
  const ok = planScenes({duration: 10, file: [{t0: 5, t1: 10, title: 'Итог'}, {t0: 0, t1: 5, title: ' Хук '}]});
  assert.equal(ok.source, 'file');
  assert.deepEqual(ok.scenes.map((s) => [s.t0, s.t1, s.title]), [[0, 5, 'Хук'], [5, 10, 'Итог']]);
  assert.deepEqual(ok.warnings, []);
  assert.equal(planScenes({duration: 10, file: {scenes: [{t0: 0, t1: 4}]}}).scenes[0].title, 'Сцена 1'); // и объект {scenes: [...]}, и пустое название
  const clip = planScenes({duration: 8, file: [{t0: 0, t1: 4}, {t0: 4, t1: 12}, {t0: 9, t1: 10}]});
  assert.deepEqual(clip.scenes.map((s) => [s.t0, s.t1]), [[0, 4], [4, 8]]);
  assert.equal(clip.warnings.length, 2, 'конец обрезан, сцена за пределами отброшена');
  assert.match(planScenes({duration: 10, file: [{t0: 0, t1: 3}, {t0: 5, t1: 10}]}).warnings.join(), /нет сцены/);
  assert.match(planScenes({duration: 10, file: [{t0: 1, t1: 10}]}).warnings.join(), /первые 1 с/);
  assert.throws(() => planScenes({duration: 10, file: [{t0: 0, t1: 5}, {t0: 4, t1: 8}]}), /пересека/);
  assert.throws(() => planScenes({duration: 10, file: [{t0: 3, t1: 3}]}), /t0 < t1/);
  assert.throws(() => planScenes({duration: 10, file: [{t0: 'a', t1: 3}]}), /нужны числа/);
  assert.throws(() => planScenes({duration: 10, file: []}), /непустой список/);
  assert.throws(() => planScenes({duration: 10, file: [{t0: 20, t1: 30}]}), /за пределами/);
});

test('сцены: кадры попадают в сцену по началу кадра, речь собирается по словам', () => {
  const frames = [0, 2, 4, 6, 8].map((t0, i) => ({id: `К00${i + 1}`, t0, t1: t0 + 2}));
  const words = [{text: 'Привет', s: 0.2, e: 0.5}, {text: 'мир', s: 3.1, e: 3.4}, {text: 'конец', s: 9.5, e: 9.9}];
  const sc = buildScenes(planScenes({duration: 10, chunk: 3}).scenes, {frames, words});
  assert.deepEqual(sc.map((s) => s.id), ['С01', 'С02', 'С03']);        // кириллическая «С»
  assert.deepEqual(sc.map((s) => s.frames), [['К001', 'К002'], ['К003'], ['К004', 'К005']]);
  assert.deepEqual([sc[0].clip, sc[0].poster], ['scenes/С01.mp4', 'scenes/С01.jpg']);
  assert.deepEqual(sc.map((s) => s.phrase), ['Привет', 'мир', 'конец']);
  assert.equal(buildScenes(planScenes({duration: 10, chunk: 3}).scenes, {frames}).every((s) => !('phrase' in s)), true, 'без слов поля речи нет');
  // граница ровно на кадре: кадр с t0=4 принадлежит сцене, которая начинается в 4
  const edge = buildScenes(planScenes({duration: 10, file: [{t0: 0, t1: 4}, {t0: 4, t1: 10}]}).scenes, {frames});
  assert.deepEqual(edge.map((s) => s.frames), [['К001', 'К002'], ['К003', 'К004', 'К005']]);
  // две цифры в номере, пока сцен меньше 100; три, когда их сто
  assert.equal(buildScenes(planScenes({duration: 300, chunk: 3}).scenes, {}).length, 100);
  assert.equal(buildScenes(planScenes({duration: 300, chunk: 3}).scenes, {})[99].id, 'С100');
  assert.equal(buildScenes(planScenes({duration: 300, chunk: 3}).scenes, {})[0].id, 'С001');
});

test('сцены: без фильма доска собирается без сцен и подсказывает, как получить черновик', () => {
  const r = spawnSync(NODE, [path.join(HERE, 'board-from-frames.mjs'), 'Demo', '--root', root, '--scenes', path.join(root, 'нет-такого.json')], {encoding: 'utf8'});
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(board().scenes, undefined);
  assert.match(r.stdout, /Сцен на доске нет/);
  assert.match(r.stdout, /npm run draft -- Demo/);
});

// ffmpeg: настоящий короткий фильм 10 с со звуком и сборщики, которые режут из него клипы
const film = path.join(root, 'film-src.mp4');
const ffprobe = (file, entry, ...more) => spawnSync('ffprobe', ['-v', 'error', ...more, '-show_entries', entry, '-of', 'default=nw=1:nk=1', file], {encoding: 'utf8'}).stdout.split('\r').join('').trim();
const listBy = (dir, ext) => fs.readdirSync(dir).filter((n) => n.endsWith(ext)).sort();
function framesSheet(name, n = 5) {
  const sheetDir = path.join(root, 'reviews', `${name}-v001`);
  fs.mkdirSync(sheetDir, {recursive: true});
  for (let i = 1; i <= n; i++) fs.writeFileSync(path.join(sheetDir, `K00${i}.png`), 'не картинка');
  fs.writeFileSync(path.join(sheetDir, 'frames.json'), JSON.stringify({composition: name, fps: 30, durationInFrames: 300, width: 1440, height: 2560, step: 2,
    frames: Array.from({length: n}, (_, i) => ({n: i + 1, frame: i * 60, t: i * 2}))}));
}
test('сцены: клипы и постеры по 3 с и по scenes.json (board-from-frames, ffmpeg)', {skip: !hasFfmpeg && 'нет ffmpeg'}, () => {
  const mk = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=360x640:rate=30:duration=10', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=10',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', film], {encoding: 'utf8'});
  assert.equal(mk.status, 0, mk.stderr);
  framesSheet('Real');
  const build = (...extra) => spawnSync(NODE, [path.join(HERE, 'board-from-frames.mjs'), 'Real', '--root', root, '--film', film, ...extra], {encoding: 'utf8'});
  const sdir = sceneRoot('Real', 'storyboard', 'scenes');
  const bd = () => JSON.parse(fs.readFileSync(sceneRoot('Real', 'storyboard', 'board.json'), 'utf8'));

  // 1) по умолчанию 3 с: 10 с = 3 + 3 + 4 (хвост 1 с приклеен)
  let r = build();
  assert.equal(r.status, 0, r.stderr + r.stdout);
  let sc = bd().scenes;
  assert.deepEqual(sc.map((s) => [s.id, s.t0, s.t1]), [['С01', 0, 3], ['С02', 3, 6], ['С03', 6, 10]]);
  assert.deepEqual(sc.map((s) => s.frames), [['К001', 'К002'], ['К003'], ['К004', 'К005']]);
  assert.deepEqual(listBy(sdir, '.mp4'), ['С01.mp4', 'С02.mp4', 'С03.mp4']);
  assert.deepEqual(listBy(sdir, '.jpg'), ['С01.jpg', 'С02.jpg', 'С03.jpg']);
  assert.ok(Math.abs(Number(ffprobe(path.join(sdir, 'С01.mp4'), 'format=duration')) - 3) < 0.35, 'длина клипа около 3 с');
  assert.ok(Math.abs(Number(ffprobe(path.join(sdir, 'С03.mp4'), 'format=duration')) - 4) < 0.35, 'длина последнего клипа около 4 с');
  assert.equal(ffprobe(path.join(sdir, 'С02.mp4'), 'stream=codec_name'), 'h264\naac', 'видео h264 и звук AAC оставлены');
  assert.equal(ffprobe(path.join(sdir, 'С02.mp4'), 'stream=width', '-select_streams', 'v:0'), '720', 'ширина 720 у вертикального клипа');
  assert.ok(fs.statSync(path.join(sdir, 'С01.jpg')).size > 1000, 'постер это настоящая картинка');

  // 2) правки автора не трогаются, а сцены перестраиваются по scenes.json: старые клипы удалены, новых ровно столько, сколько сцен
  const rev = sceneRoot('Real', 'storyboard', 'review.json');
  fs.writeFileSync(rev, JSON.stringify({frames: {}, scenes: {С01: {rating: 'fix', note: 'моя заметка', comments: [], refs: []}}}));
  const before = fs.readFileSync(rev, 'utf8');
  const file = path.join(root, 'сцены.json');
  fs.writeFileSync(file, JSON.stringify([{t0: 0, t1: 2.5, title: 'Хук'}, {t0: 2.5, t1: 5, title: 'Проблема'}, {t0: 5, t1: 7.5, title: 'Решение'}, {t0: 7.5, t1: 10, title: 'Призыв'}]));
  r = build('--scenes', file);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  sc = bd().scenes;
  assert.deepEqual(sc.map((s) => [s.id, s.title, s.t0, s.t1]), [['С01', 'Хук', 0, 2.5], ['С02', 'Проблема', 2.5, 5], ['С03', 'Решение', 5, 7.5], ['С04', 'Призыв', 7.5, 10]]);
  assert.deepEqual(sc.map((s) => s.frames), [['К001', 'К002'], ['К003'], ['К004'], ['К005']]);
  assert.equal(listBy(sdir, '.mp4').length, 4);
  assert.equal(listBy(sdir, '.jpg').length, 4);
  assert.ok(Math.abs(Number(ffprobe(path.join(sdir, 'С02.mp4'), 'format=duration')) - 2.5) < 0.35);
  assert.equal(fs.readFileSync(rev, 'utf8'), before, 'пересборка со сценами review.json не трогает');

  // 3) битый scenes.json не оставляет полдоски: сборка падает с понятным текстом, прежние сцены остаются
  fs.writeFileSync(file, JSON.stringify([{t0: 0, t1: 6}, {t0: 5, t1: 10}]));
  r = build('--scenes', file);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /пересека/);
  assert.equal(bd().scenes.length, 4);

  // 4) пересборка без фильма убирает фильм и клипы сцен (они из него), правки автора остаются
  r = spawnSync(NODE, [path.join(HERE, 'board-from-frames.mjs'), 'Real', '--root', root], {encoding: 'utf8'});
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(bd().scenes, undefined);
  assert.ok(!fs.existsSync(sdir) && !fs.existsSync(sceneRoot('Real', 'storyboard', 'film.mp4')));
  assert.equal(fs.readFileSync(rev, 'utf8'), before);
});

test('сцены: build-board.mjs режет сцены из любого видео (--chunk, --scenes)', {skip: !hasFfmpeg && 'нет ffmpeg'}, () => {
  const bb = (...extra) => spawnSync(NODE, [path.join(HERE, 'build-board.mjs'), 'FromVideo', '--video', film, '--root', root, '--title', 'Видео', ...extra], {encoding: 'utf8'});
  const sdir = sceneRoot('FromVideo', 'storyboard', 'scenes');
  const bd = () => JSON.parse(fs.readFileSync(sceneRoot('FromVideo', 'storyboard', 'board.json'), 'utf8'));
  let r = bb('--chunk', '4');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  let b = bd();
  assert.deepEqual(b.scenes.map((s) => [s.id, s.t0, s.t1]), [['С01', 0, 4], ['С02', 4, 8], ['С03', 8, 10]]);
  assert.deepEqual(b.scenes.map((s) => s.frames), [['К001', 'К002'], ['К003', 'К004'], ['К005']]);
  assert.equal(listBy(sdir, '.mp4').length, 3);
  assert.equal(listBy(sdir, '.jpg').length, 3);
  const file = path.join(root, 'сцены-2.json');
  fs.writeFileSync(file, JSON.stringify([{t0: 0, t1: 3, title: 'Хук'}, {t0: 3, t1: 10, title: 'Остальное'}]));
  r = bb('--scenes', file);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  b = bd();
  assert.deepEqual(b.scenes.map((s) => s.title), ['Хук', 'Остальное']);
  assert.equal(listBy(sdir, '.mp4').length, 2, 'клипы прошлой сборки убраны');
  assert.match(r.stdout, /С02 3–10 с «Остальное»/);
  fs.writeFileSync(file, '{не json');
  r = bb('--scenes', file);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /не разбирается как JSON/);
});

// ── сервер и cli: комментарии сцены, моменты, ответы, референсы ──
// Доска сцен собрана руками (с поддельными клипами), поэтому эти проверки идут и без ffmpeg.
const scnDir = sceneRoot('Scn', 'storyboard');
function makeScn() {
  fs.mkdirSync(path.join(scnDir, 'scenes'), {recursive: true});
  const frames = [0, 2, 4, 6, 8].map((t0, i) => ({id: `К00${i + 1}`, block: '0:00 – 0:10', t0, t1: t0 + 2, phrase: `кадр ${i + 1}`, img: `frames/К00${i + 1}.png`}));
  const scenes = buildScenes(planScenes({duration: 10, file: [{t0: 0, t1: 3, title: 'Хук'}, {t0: 3, t1: 6, title: 'Проблема'}, {t0: 6, t1: 10, title: 'Итог'}]}).scenes, {frames});
  fs.writeFileSync(path.join(scnDir, 'board.json'), JSON.stringify({title: 'Сцены', duration: 10, film: null, width: 1440, height: 2560, aspect: 0.5625, blocks: [], frames, scenes, patterns: [], refs: []}));
  for (const s of scenes) { fs.writeFileSync(path.join(scnDir, s.clip), Buffer.alloc(1000, 7)); fs.writeFileSync(path.join(scnDir, s.poster), 'jpg'); }
}
const apiS = (op, body, headers) => call('POST', `/api/${op}?project=Scn`, body, headers);
const reviewS = () => JSON.parse(fs.readFileSync(path.join(scnDir, 'review.json'), 'utf8'));
// запрос с сырым ответом: статус, заголовки и тело (для Range)
const rawGet = (url, headers = {}) => new Promise((res, rej) => {
  http.get({host: '127.0.0.1', port, path: url, headers, agent: false}, (r) => { const ch = []; r.on('data', (c) => ch.push(c)); r.on('end', () => res({status: r.statusCode, headers: r.headers, body: Buffer.concat(ch)})); }).on('error', rej);
});
// файл с правильным началом (загрузка проверяет, что внутри то, что сказано в расширении)
const MP4 = (extra = 20) => Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(extra, 1)]);
const PNG = () => Buffer.concat([Buffer.from([0x89]), Buffer.from('PNG\r\n\x1a\n'), Buffer.alloc(20, 2)]);
const upload = (frame, name, data, headers = {}, proj = 'Scn', prt = () => port) => new Promise((res, rej) => {
  const req = http.request({host: '127.0.0.1', port: prt(), agent: false, method: 'POST', path: `/api/upload?project=${proj}&frame=${encodeURIComponent(frame)}&name=${encodeURIComponent(name)}`, headers: {'Content-Length': data.length, ...headers}},
    (r) => { const ch = []; r.on('data', (c) => ch.push(c)); r.on('end', () => res({status: r.statusCode, json: JSON.parse(Buffer.concat(ch).toString('utf8'))})); });
  req.on('error', rej); req.end(data);
});

test('сцены: оценка, заметка, комментарий с моментом клипа и ответ', async () => {
  makeScn();
  assert.equal((await call('GET', '/api/board?project=Scn')).json.board.scenes.length, 3);
  assert.equal((await apiS('scene-rate', {scene: 'С01', rating: 'fix'})).json.review.scenes['С01'].rating, 'fix');
  assert.equal((await apiS('scene-rate', {scene: 'С01', rating: 'мусор'})).json.review.scenes['С01'].rating, null);
  assert.equal((await apiS('scene-rate', {scene: 'С01', rating: 'ok'})).json.review.scenes['С01'].rating, 'ok');
  assert.equal((await apiS('scene-note', {scene: 'С01', note: 'хук оставить'})).json.review.scenes['С01'].note, 'хук оставить');

  const c = await apiS('scene-comment', {scene: 'С02', text: '  Здесь неправильный текст  ', t: 4.2, tag: 'Текст', author: 'Автор Тест'});
  assert.equal(c.status, 200);
  const cm = c.json.review.scenes['С02'].comments[0];
  assert.deepEqual([cm.text, cm.t, cm.tag, cm.by, cm.status, cm.replies], ['Здесь неправильный текст', 4.2, 'Текст', 'Автор Тест', 'open', []]);
  assert.ok(cm.id && cm.at);
  // момент прижимается к границам сцены (С02 это 3–6 с), неизвестная тема отбрасывается, без момента t равен null
  const low = (await apiS('scene-comment', {scene: 'С02', text: 'раньше', t: 1, tag: 'выдумка'})).json.review.scenes['С02'].comments[1];
  assert.deepEqual([low.t, low.tag], [3, null]);
  assert.equal((await apiS('scene-comment', {scene: 'С02', text: 'позже', t: 99})).json.review.scenes['С02'].comments[2].t, 6);
  assert.equal((await apiS('scene-comment', {scene: 'С02', text: 'без момента'})).json.review.scenes['С02'].comments[3].t, null);
  assert.equal((await apiS('scene-comment', {scene: 'С02', text: '   '})).status, 400);
  // ответ лежит в replies комментария, а не рядом
  const rep = await apiS('scene-comment', {scene: 'С02', text: 'сделаю', parent: cm.id, author: 'Claude'});
  assert.deepEqual(rep.json.review.scenes['С02'].comments[0].replies.map((x) => [x.text, x.by]), [['сделаю', 'Claude']]);
  assert.equal(rep.json.review.scenes['С02'].comments.length, 4, 'ответ не стал отдельным комментарием');
  assert.equal((await apiS('scene-comment', {scene: 'С02', text: 'x', parent: 'нетТакого'})).status, 404);
  // статус
  assert.equal((await apiS('scene-comment-status', {scene: 'С02', id: cm.id, status: 'resolved'})).json.review.scenes['С02'].comments[0].status, 'resolved');
  assert.equal((await apiS('scene-comment-status', {scene: 'С02', id: cm.id, status: 'open'})).json.review.scenes['С02'].comments[0].status, 'open');
  assert.equal((await apiS('scene-comment-status', {scene: 'С02', id: 'нетТакого', status: 'resolved'})).status, 404);
});

test('сцены: защита от чужих имён сцен, чужих сайтов и кадров вместо сцен', async () => {
  assert.equal((await apiS('scene-comment', {scene: 'С99', text: 'x'})).status, 404);
  assert.equal((await apiS('scene-comment', {scene: '__proto__', text: 'x'})).status, 404);
  assert.equal((await apiS('scene-comment', {text: 'без сцены'})).status, 404);
  assert.equal((await apiS('comment', {frame: 'С01', text: 'сцена не кадр'})).status, 404);
  assert.equal((await apiS('scene-bogus', {scene: 'С01'})).status, 404);
  assert.equal((await apiS('scene-comment', {scene: 'С01', text: 'подсунуто'}, {Origin: 'https://evil.example'})).status, 403);
  assert.equal((await apiS('scene-comment', {scene: 'С01', text: 'подсунуто'}, {Host: 'evil.example'})).status, 403);
  assert.ok(!JSON.stringify(reviewS()).includes('подсунуто'));
  assert.equal((await call('POST', '/api/scene-comment?project=Scn', null)).status, 400, 'пустое тело это не JSON');
  // кадровые операции по-прежнему работают рядом
  assert.equal((await apiS('comment', {frame: 'К001', text: 'кадр', at: 1})).status, 200);
});

test('сцены: референсы файлом и ссылкой, правка «что взять», проверка пути и ссылки', async () => {
  // файл: сначала загрузка в files/<сцена>/, потом запись
  const up = await upload('С02', 'пример.mp4', MP4());
  assert.equal(up.status, 200);
  assert.match(up.json.path, /^files\/С02\/[^/]+-пример\.mp4$/);
  assert.ok(fs.existsSync(path.join(scnDir, up.json.path)));
  const ok = await apiS('scene-ref', {scene: 'С02', kind: 'file', path: up.json.path, name: 'пример.mp4', take: ' движение и темп ', t: '1:20', author: 'Автор'});
  assert.equal(ok.status, 200);
  const ref = ok.json.review.scenes['С02'].refs[0];
  assert.deepEqual([ref.kind, ref.path, ref.take, ref.t, ref.status], ['file', up.json.path, 'движение и темп', 80, 'open']);
  // файл отдаётся с Range
  const part = await rawGet(`/p/Scn/${up.json.path.split('/').map(encodeURIComponent).join('/')}`, {Range: 'bytes=0-4'});
  assert.equal(part.status, 206);
  assert.equal(part.body.length, 5);
  assert.match(part.headers['content-range'], /^bytes 0-4\/\d+$/);
  // плохие пути, форматы, чужие папки и несуществующие файлы
  const bad = (p) => apiS('scene-ref', {scene: 'С02', kind: 'file', path: p, take: 'x'});
  assert.equal((await bad('files/С02/../../board.json')).status, 400);
  assert.equal((await bad('../board.json')).status, 400);
  assert.equal((await bad('board.json')).status, 400);
  assert.equal((await bad(up.json.path.replace('С02', 'С01'))).status, 400, 'файл чужой сцены не берём');
  assert.equal((await bad('files/С02/нет-такого.mp4')).status, 404);
  assert.equal((await bad('files/С02/x.exe')).status, 400, 'формат только mp4, webm, mov, gif, png, jpg');
  assert.equal((await bad('files/С02/x.html')).status, 400);
  // ссылки: https добавляется, опасные схемы отклоняются
  const u1 = await apiS('scene-ref', {scene: 'С02', kind: 'url', url: 'instagram.com/reel/abc123', take: 'шрифт', t: '4,4'});
  const r1 = u1.json.review.scenes['С02'].refs[1];
  assert.deepEqual([r1.kind, r1.url, r1.take, r1.t], ['url', 'https://instagram.com/reel/abc123', 'шрифт', 4.4]);
  assert.equal((await apiS('scene-ref', {scene: 'С02', kind: 'url', url: 'javascript:alert(1)'})).status, 400);
  assert.equal((await apiS('scene-ref', {scene: 'С02', kind: 'url', url: 'data:text/html,<script>1</script>'})).status, 400);
  assert.equal((await apiS('scene-ref', {scene: 'С02', kind: 'url', url: ''})).status, 400);
  assert.equal((await apiS('scene-ref', {scene: 'С02', kind: 'что-то'})).status, 400);
  assert.equal(reviewS().scenes['С02'].refs.length, 2, 'отклонённое в review.json не попало');
  // правка, статус, мягкое удаление
  const ed = await apiS('scene-ref-edit', {scene: 'С02', id: ref.id, take: 'переход', t: ''});
  assert.deepEqual([ed.json.review.scenes['С02'].refs[0].take, ed.json.review.scenes['С02'].refs[0].t], ['переход', null]);
  assert.equal((await apiS('scene-ref-status', {scene: 'С02', id: ref.id, status: 'resolved'})).json.review.scenes['С02'].refs[0].status, 'resolved');
  assert.ok((await apiS('scene-ref-remove', {scene: 'С02', id: r1.id})).json.review.scenes['С02'].refs[1].removed);
  assert.ok(fs.existsSync(path.join(scnDir, up.json.path)), 'файл референса остаётся на диске');
  assert.equal((await apiS('scene-ref-edit', {scene: 'С02', id: 'нетТакого', take: 'x'})).status, 404);
  // ещё один открытый референс, его увидит cli
  assert.equal((await apiS('scene-ref', {scene: 'С02', kind: 'url', url: 'https://www.youtube.com/shorts/xyz', take: 'темп', note: 'как в начале'})).status, 200);
});

test('сервер: клипы сцен отдаются с Range (перемотка), плохие диапазоны не роняют', async () => {
  const url = `/p/Scn/scenes/${encodeURIComponent('С01')}.mp4`;
  const full = await rawGet(url);
  assert.deepEqual([full.status, full.body.length, full.headers['accept-ranges']], [200, 1000, 'bytes']);
  assert.equal(full.headers['content-type'], 'video/mp4');
  const a = await rawGet(url, {Range: 'bytes=0-99'});
  assert.deepEqual([a.status, a.body.length, a.headers['content-range']], [206, 100, 'bytes 0-99/1000']);
  const b = await rawGet(url, {Range: 'bytes=900-'});
  assert.deepEqual([b.status, b.body.length, b.headers['content-range']], [206, 100, 'bytes 900-999/1000']);
  const c = await rawGet(url, {Range: 'bytes=-50'});
  assert.deepEqual([c.status, c.body.length, c.headers['content-range']], [206, 50, 'bytes 950-999/1000']);
  assert.equal((await rawGet(url, {Range: 'bytes=0-99999'})).body.length, 1000, 'конец за пределами файла прижимается');
  assert.equal((await rawGet(url, {Range: 'bytes=5000-'})).status, 416);
  assert.equal((await rawGet(url, {Range: 'bytes=abc'})).status, 200);
  assert.equal((await rawGet(`/p/Scn/scenes/${encodeURIComponent('С99')}.mp4`)).status, 404);
  assert.equal((await rawGet('/p/Scn/..%2F..%2Fpackage.json')).status, 403, 'выйти из папки доски нельзя');
  // загрузка с «..» вместо имени сцены не уводит файл из files/: такой сцены нет, файл не пишется
  for (const f of ['..', '../..', '/etc', 'C:\\Windows', '%']) assert.equal((await upload(f, 'x.png', PNG())).status, 404, `кадр «${f}»`);
  assert.ok(!fs.existsSync(path.join(scnDir, 'files', 'file')) && !fs.existsSync(path.join(scnDir, '..', 'files')));
});

test('cli: сначала сцены (момент, тема, референсы), потом кадры; reply и resolve для сцены', () => {
  const run = (...a) => spawnSync(NODE, [path.join(HERE, 'cli.mjs'), 'Scn', ...a, '--root', root], {encoding: 'utf8'});
  const out = run().stdout;
  assert.match(out, /# Сцены/);
  assert.ok(out.indexOf('# Сцены') < out.indexOf('# Кадры'), 'сцены раньше кадров');
  assert.ok(out.indexOf('## С02') < out.indexOf('## К001'));
  assert.match(out, /## С01 0:00–0:03 «Хук»\s+\[ОК\]/);
  assert.match(out, /кадры: К001, К002/);
  assert.match(out, /заметка: хук оставить/);
  assert.match(out, /Автор Тест · Текст · на 0:04,2 \(4\.2 с\): Здесь неправильный текст/);
  assert.match(out, /↳ \(\w+\) Claude: сделаю/);
  assert.match(out, /референс \(\w+\) ссылка https:\/\/www\.youtube\.com\/shorts\/xyz\s+взять: темп; заметка: как в начале/);
  assert.ok(!out.includes('instagram.com/reel/abc123'), 'убранный референс не печатается');
  assert.ok(!out.includes('пример.mp4'), 'решённый референс по умолчанию скрыт');
  assert.match(out, /## К001 [^\n]*\(сцена С01\)/, 'у кадра видно сцену');
  const all = run('--all').stdout;
  assert.match(all, /референс \(\w+\) файл work[\\/]Scn[\\/]storyboard[\\/]files[\\/]С02[\\/][^\n]*пример\.mp4 \[решено\]\s+взять: переход/);
  // reply и resolve принимают id сцены
  const cid = reviewS().scenes['С02'].comments[0].id;
  assert.equal(run('reply', 'С02', cid, 'готово, текст поправлен').status, 0);
  assert.deepEqual(reviewS().scenes['С02'].comments[0].replies.map((x) => x.by), ['Claude', 'Claude']);
  assert.match(run().stdout, /↳ \(\w+\) Claude: готово, текст поправлен/);
  assert.equal(run('resolve', 'С02', cid).status, 0);
  assert.equal(reviewS().scenes['С02'].comments[0].status, 'resolved');
  assert.ok(!run().stdout.includes('Здесь неправильный текст'), 'решённый комментарий по умолчанию скрыт');
  assert.match(run('--all').stdout, /\[решено\]: Здесь неправильный текст/);
  const ytId = reviewS().scenes['С02'].refs.find((x) => x.url?.includes('youtube')).id;
  assert.equal(run('resolve', 'С02', ytId).status, 0);
  assert.equal(reviewS().scenes['С02'].refs.find((x) => x.id === ytId).status, 'resolved');
  assert.equal(run('note', 'С03', 'агент: проверь концовку').status, 0);
  assert.equal(reviewS().scenes['С03'].comments[0].by, 'Claude');
  assert.match(run().stdout, /## С03[\s\S]*?- \(\w+\) Claude: агент: проверь концовку/);
  assert.notEqual(run('reply', 'С02', 'нетТакого', 'x').status, 0);
  assert.notEqual(run('resolve', 'С99', 'x').status, 0);
  assert.equal(run('resolve', 'К001', 'нетТакого').status, 1);
  // доска без сцен печатается как раньше: без заголовков «Сцены» и «Кадры»
  const old = cli().stdout;
  assert.ok(!old.includes('# Сцены') && !old.includes('# Кадры'));
});

// ──────────────────── проверка «злым тестировщиком», 11.10.2026: каждый тест закрывает найденную ошибку ────────────────────
// доска нужного вида во временной папке (поддельные клипы): board.json можно подменить текстом, с BOM или в UTF-16
function mkBoard(name, {boardText, bom = null} = {}) {
  const d = sceneRoot(name, 'storyboard');
  fs.mkdirSync(path.join(d, 'scenes'), {recursive: true});
  const frames = [0, 2, 4].map((t0, i) => ({id: `К00${i + 1}`, block: '0:00 – 0:10', t0, t1: t0 + 2, phrase: `кадр ${i + 1}`, img: `frames/К00${i + 1}.png`}));
  const scenes = buildScenes(planScenes({duration: 6, file: [{t0: 0, t1: 3, title: 'Раз'}, {t0: 3, t1: 6, title: 'Два'}]}).scenes, {frames});
  const text = boardText ?? JSON.stringify({title: name, duration: 6, film: null, width: 1440, height: 2560, aspect: 0.5625, blocks: [], frames, scenes, patterns: [], refs: []});
  fs.writeFileSync(path.join(d, 'board.json'), bom === 'utf8' ? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text)])
    : bom === 'utf16' ? Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]) : text);
  for (const s of scenes) { fs.writeFileSync(path.join(d, s.clip), Buffer.alloc(1000, 7)); fs.writeFileSync(path.join(d, s.poster), 'jpg'); }
  return d;
}
const callP = (proj, op, body) => call('POST', `/api/${op}?project=${proj}`, body);
const cliS = (...a) => spawnSync(NODE, [path.join(HERE, 'cli.mjs'), 'Scn', ...a, '--root', root], {encoding: 'utf8'});

test('загрузка: длинное имя, кириллица, тип, начало файла, пустой файл, неизвестный кадр', async () => {
  // имя из 100 букв обрезалось вместе с расширением, и файл потом не принимался как референс («формат не подходит»)
  const long = await upload('С01', `${'а'.repeat(100)}.mp4`, MP4());
  assert.equal(long.status, 200);
  assert.match(long.json.path, /^files\/С01\/[^/]+\.mp4$/);
  assert.ok(path.basename(long.json.path).length <= 80);
  assert.equal((await apiS('scene-ref', {scene: 'С01', kind: 'file', path: long.json.path, take: 'x'})).status, 200, 'файл с длинным именем берётся референсом');
  const ru = await upload('С01', 'мой ролик (1).MP4', MP4());
  assert.match(ru.json.path, /-мой-ролик-1\.mp4$/);
  const got = await rawGet(`/p/Scn/${ru.json.path.split('/').map(encodeURIComponent).join('/')}`);
  assert.deepEqual([got.status, got.body.length], [200, MP4().length], 'кириллица и пробелы в имени отдаются целиком');
  // .html и .svg раньше сохранялись и отдавались как страница со скриптом; .exe и «просто текст» сохранялись без проверки
  for (const n of ['вирус.exe', 'x.html', 'x.svg', 'x.js', 'без-расширения', '.png']) assert.equal((await upload('С01', n, Buffer.from('MZ....'))).status, 415, n);
  assert.equal((await upload('С01', 'пусто.png', Buffer.alloc(0))).status, 400);
  assert.equal((await upload('С01', 'это-текст.png', Buffer.from('просто текст, не картинка'))).status, 415);
  assert.equal((await upload('С01', 'mp4-под-видом.png', MP4())).status, 415);
  assert.equal((await upload('С01', 'настоящая.png', PNG())).status, 200);
  assert.match((await upload('C01', 'a.png', PNG())).json.path, /^files\/С01\//, 'латинская C01 узнаётся как С01');
  assert.equal((await upload('С77', 'a.png', PNG())).status, 404);
  assert.deepEqual(fs.readdirSync(path.join(scnDir, 'files', 'С01')).filter((n) => n.endsWith('.part')), [], 'недописанных файлов нет');
});

test('загрузка: 60 МБ проходит, слишком большой файл получает понятный отказ, оборванная загрузка не оставляет следов', async () => {
  const big = await upload('С01', 'большой.mp4', MP4(60 * 1024 * 1024));
  assert.equal(big.status, 200);
  assert.ok(fs.statSync(path.join(scnDir, big.json.path)).size > 60 * 1024 * 1024);
  fs.unlinkSync(path.join(scnDir, big.json.path));
  const dirС01 = path.join(scnDir, 'files', 'С01');
  // объявлен размер больше предела: отказ приходит сразу, соединение не рвётся, тело не ждём
  const declared = await new Promise((res, rej) => {
    const req = http.request({host: '127.0.0.1', port, agent: KA, method: 'POST', path: `/api/upload?project=Scn&frame=${encodeURIComponent('С01')}&name=big.mp4`, headers: {'Content-Length': 400 * 1024 * 1024}},
      (r) => { const ch = []; r.on('data', (c) => ch.push(c)); r.on('end', () => { res({status: r.statusCode, json: JSON.parse(Buffer.concat(ch).toString('utf8'))}); req.destroy(); }); });
    req.on('error', rej); req.write(MP4());
  });
  assert.equal(declared.status, 413);
  assert.match(declared.json.error, /400 МБ.*предел 300 МБ/);
  // клиент оборвал загрузку на середине: ответа не будет, но недописанного файла остаться не должно, сервер жив
  const before = fs.readdirSync(dirС01).length;
  await new Promise((res) => {
    const req = http.request({host: '127.0.0.1', port, agent: false, method: 'POST', path: `/api/upload?project=Scn&frame=${encodeURIComponent('С01')}&name=cut.mp4`, headers: {'Content-Length': 1000000}});
    req.on('error', () => {}); req.write(MP4(1000));
    setTimeout(() => { req.destroy(); setTimeout(res, 300); }, 150);
  });
  assert.equal(fs.readdirSync(dirС01).length, before, 'обрывок не остался');
  assert.equal((await call('GET', '/api/projects')).status, 200);
  // без Content-Length (chunked) предел действует тоже: второй сервер с пределом 1 МБ
  const port2 = await freePort();
  const server2 = spawn(NODE, [path.join(HERE, 'server.mjs'), '--root', root, '--port', String(port2)], {stdio: ['ignore', 'pipe', 'pipe'], env: {...process.env, STORYBOARD_MAX_UPLOAD_MB: '1'}});
  try {
    await new Promise((res, rej) => { server2.stdout.on('data', (d) => /localhost/.test(String(d)) && res()); server2.on('exit', (c) => rej(new Error(`сервер 2 вышел с кодом ${c}`))); setTimeout(() => rej(new Error('сервер 2 не стартовал')), 10000); });
    const chunked = await new Promise((res, rej) => {
      const req = http.request({host: '127.0.0.1', port: port2, agent: false, method: 'POST', path: `/api/upload?project=Scn&frame=${encodeURIComponent('С01')}&name=chunked.mp4`},
        (r) => { const ch = []; r.on('data', (c) => ch.push(c)); r.on('end', () => res({status: r.statusCode, json: JSON.parse(Buffer.concat(ch).toString('utf8'))})); });
      req.on('error', rej); req.write(MP4(1024 * 1024)); req.write(Buffer.alloc(2 * 1024 * 1024, 3)); req.end();
    });
    assert.equal(chunked.status, 413);
    assert.match(chunked.json.error, /предел 1 МБ/);
    assert.ok(!fs.readdirSync(dirС01).some((n) => n.includes('chunked')), 'лишнее на диск не записано');
    assert.equal((await upload('С01', 'мелкий.png', PNG(), {}, 'Scn', () => port2)).status, 200, 'файл меньше предела проходит');
  } finally { server2.kill(); }
});

test('кадры: оценка, ссылки, родитель комментария, вложения и время проверяются; ссылки и паттерны правятся по одной', async () => {
  assert.equal((await apiS('frame', {frame: 'К001'})).status, 400, 'без patch раньше было падение 500');
  assert.equal((await apiS('frame', {frame: 'К001', patch: {status: {a: 1}}})).status, 400);
  assert.equal((await apiS('frame', {frame: 'К001', patch: {секрет: 1}})).status, 400);
  assert.equal((await apiS('frame', {frame: 'К001', patch: {links: [{url: 'javascript:alert(1)'}]}})).status, 400, 'ссылка javascript: в кадре раньше сохранялась');
  assert.equal((await apiS('frame', {frame: 'К001', patch: {links: 'x'}})).status, 400);
  assert.equal((await apiS('frame', {frame: 'К001', patch: {status: 'fix', note: 'заметка'}})).json.review.frames['К001'].status, 'fix');
  // две вкладки добавляют по ссылке: обе остаются (раньше список заменялся целиком, и вторая ссылка стирала первую)
  await apiS('link-add', {frame: 'К001', url: 'instagram.com/p/1', label: 'раз'});
  const links = (await apiS('link-add', {frame: 'К001', url: 'https://youtu.be/2'})).json.review.frames['К001'].links;
  assert.deepEqual(links.map((l) => l.url), ['https://instagram.com/p/1', 'https://youtu.be/2']);
  assert.ok(links.every((l) => l.id));
  assert.equal((await apiS('link-add', {frame: 'К001', url: 'data:text/html,x'})).status, 400);
  assert.equal((await apiS('link-add', {frame: 'К001', url: 'x'.repeat(2001)})).status, 400);
  assert.equal((await apiS('link-remove', {frame: 'К001', id: links[0].id})).json.review.frames['К001'].links.length, 1);
  assert.equal((await apiS('link-remove', {frame: 'К001', id: 'нет'})).status, 404);
  assert.equal((await apiS('pattern-add', {frame: 'К001', code: 'P1'})).json.review.frames['К001'].patterns.length, 1);
  assert.equal((await apiS('pattern-add', {frame: 'К001', code: 'P1'})).json.review.frames['К001'].patterns.length, 1, 'повторный паттерн не дублируется');
  assert.deepEqual((await apiS('pattern-remove', {frame: 'К001', code: 'P1'})).json.review.frames['К001'].patterns, []);
  // комментарии: родитель, пустой текст, длина, время
  const root1 = (await apiS('comment', {frame: 'К002', text: 'корень', author: 'Автор', at: 2.5})).json.review.frames['К002'].comments.at(-1);
  assert.deepEqual([root1.at, root1.parent, root1.status], [2.5, null, 'open']);
  const reply = (await apiS('comment', {frame: 'К002', text: 'ответ', parent: root1.id})).json.review.frames['К002'].comments.at(-1);
  assert.equal(reply.parent, root1.id);
  assert.equal((await apiS('comment', {frame: 'К002', text: 'ответ на ответ', parent: reply.id})).json.review.frames['К002'].comments.at(-1).parent, root1.id, 'ответ на ответ ложится под корень, иначе его не видно');
  assert.equal((await apiS('comment', {frame: 'К002', text: 'x', parent: 'нет'})).status, 404, 'комментарий-сирота раньше принимался и нигде не показывался');
  assert.equal((await apiS('comment', {frame: 'К002', text: '  '})).status, 400);
  assert.equal((await apiS('comment', {frame: 'К002', text: 'x'.repeat(8001)})).status, 400, 'длинный текст раньше молча обрезался');
  assert.equal((await apiS('comment', {frame: 'К002', text: 'x'.repeat(8000)})).status, 200);
  assert.equal((await apiS('comment', {frame: 'К002', text: 'время', at: 'мусор'})).json.review.frames['К002'].comments.at(-1).at, null);
  assert.equal((await apiS('comment', {frame: 'К002', text: 'время', at: -4})).json.review.frames['К002'].comments.at(-1).at, null);
  assert.equal((await apiS('comment-status', {frame: 'К002', id: 'нет', status: 'resolved'})).status, 404);
  assert.equal((await apiS('comment', {frame: 'K002', text: 'латиницей'})).status, 200, 'латинская K002');
  assert.equal((await apiS('comment', {frame: 'К2', text: 'без нулей'})).status, 200, 'К2 это К002');
  // вложения: путь только из files/<кадр>/, тип по файлу, а не по запросу
  const up = await upload('К002', 'экран.png', PNG());
  const att = (await apiS('attach', {frame: 'К002', path: up.json.path, name: 'экран.png', kind: 'video'})).json.review.frames['К002'].attachments.at(-1);
  assert.equal(att.kind, 'image');
  for (const p of ['../../../../.env', 'files/К002/../../board.json', 'board.json', '/etc/passwd', `files/К001/${path.basename(up.json.path)}`, 'files/К002/нет.png', 'files/К002/x.exe', 'files/К002/.png']) {
    assert.ok([400, 404].includes((await apiS('attach', {frame: 'К002', path: p, name: 'x'})).status), p);
  }
  assert.equal((await apiS('attach-remove', {frame: 'К002', id: 'нет'})).status, 404);
  assert.ok((await apiS('attach-remove', {frame: 'К002', id: att.id})).json.review.frames['К002'].attachments.at(-1).removed);
  assert.equal((await apiS('move-status', {frame: 'К002', id: 'нет', status: 'resolved'})).status, 404);
  assert.equal((await apiS('move', {frame: 'К002', from: null, to: {x: 1, y: 1}})).status, 400);
});

test('пути: «..», абсолютный путь, обратные слэши, нулевой байт, чужой и несуществующий проект', async () => {
  // имя файла с путём внутри: от пути остаётся только имя, файл не выходит из files/<кадр>/
  const esc = await upload('С01', '../../../escape.png', PNG());
  assert.equal(esc.status, 200);
  assert.match(esc.json.path, /^files\/С01\/[^/]+-escape\.png$/);
  assert.ok(fs.existsSync(path.join(scnDir, esc.json.path)));
  assert.ok(!fs.existsSync(path.join(scnDir, 'escape.png')) && !fs.existsSync(path.join(root, 'escape.png')) && !fs.existsSync(path.join(root, 'work', 'escape.png')));
  const win = await upload('С01', 'C:\\Windows\\win.ini.png', PNG());
  assert.match(win.json.path, /^files\/С01\/[^/]+-win\.ini\.png$/);
  assert.equal((await upload('С01', '', PNG())).status, 415, 'пустое имя');
  assert.equal((await upload('С01', '   .png', PNG())).status, 415, 'имя из одних пробелов и расширения');
  // чтение: всё, что выходит из папки доски или ведёт в чужой проект, получает 4xx, а не 500 и не чужой файл
  for (const [u, want] of [['/p/Scn/..%2Fboard.json', 403], ['/p/Scn/..%5C..%5Cboard.json', 403], ['/p/Scn/%2e%2e%2f%2e%2e%2fpackage.json', 403],
    ['/p/Scn/C%3A%5CWindows%5Cwin.ini', 403], ['/p/Scn/%2FWindows%2Fwin.ini', 403], ['/p/Scn/board.json%00.png', 404], ['/p/нет-такого/board.json', 404], ['/p/Scn/', 404], ['/p/Scn/files', 404],
    ['/..%2Fserver.mjs', 403], ['/%5C..%5Cserver.mjs', 403]]) {
    const r = await rawGet(encodeURI(u).replace(/%25/g, '%'));
    assert.equal(r.status, want, `${u}: ${r.status}`);
    assert.ok(!r.body.toString('utf8').includes('"title"'), `${u}: чужое содержимое не отдано`);
  }
  assert.equal((await rawGet('/p/Scn/board.json')).status, 200, 'свои файлы доски по-прежнему отдаются');
  // запись: чужой проект и проект с «..» вместо имени
  for (const proj of ['..', 'нет-такого', '../Scn', 'Scn/..', '']) assert.equal((await call('POST', `/api/scene-note?project=${encodeURIComponent(proj)}`, {scene: 'С01', note: 'x'})).status, 404, `проект «${proj}»`);
});

test('адрес и тело запроса: неверное %-кодирование, огромный JSON, неизвестный адрес', async () => {
  for (const u of ['/p/Scn/%E0%A4%A', '/%E0%A4%A', '/p/%E0%A4%A/x']) assert.equal((await rawGet(u)).status, 400, `${u}: раньше 500`);
  assert.equal((await rawGet(encodeURI('/api/нет-такого'))).status, 404);
  // раньше соединение рвалось (ECONNRESET), и страница писала «Failed to fetch»
  const huge = await call('POST', '/api/scene-note?project=Scn', {scene: 'С01', note: 'x'.repeat(6 * 1024 * 1024)}, {}, KA);
  assert.equal(huge.status, 413);
  assert.match(huge.json.error, /предел 5 МБ/);
  assert.equal((await apiS('scene-note', {scene: 'С01', note: 'x'.repeat(8001)})).status, 400);
  assert.equal((await call('GET', '/api/projects')).status, 200, 'сервер жив');
  // перемотка видео обрывает запросы постоянно: оборванные запросы не роняют сервер и не держат файл
  await Promise.all(Array.from({length: 40}, () => new Promise((res) => {
    const req = http.get({host: '127.0.0.1', port, path: `/p/Scn/scenes/${encodeURIComponent('С01')}.mp4`, headers: {Range: 'bytes=0-'}, agent: false}, (r) => { r.once('data', () => { req.destroy(); res(); }); });
    req.on('error', () => res());
  })));
  assert.equal((await rawGet(`/p/Scn/scenes/${encodeURIComponent('С01')}.mp4`)).body.length, 1000);
  // заголовки безопасности: загруженные файлы не исполняются, страница не грузит ничего чужого
  const file = await rawGet(`/p/Scn/scenes/${encodeURIComponent('С01')}.mp4`);
  assert.match(file.headers['content-security-policy'], /sandbox/);
  assert.equal(file.headers['x-content-type-options'], 'nosniff');
  const page = await rawGet('/');
  assert.match(page.headers['content-security-policy'], /script-src 'self'/);
  assert.match(page.headers['content-security-policy'], /frame-ancestors 'none'/);
});

test('сервер: нечитаемый файл даёт ответ с ошибкой, а не обрыв и падение сервера', {skip: !(process.platform === 'win32' || (process.getuid && process.getuid() !== 0)) && 'файл нечем закрыть'}, async () => {
  const f = path.join(scnDir, 'frames', 'закрыт.png');
  fs.mkdirSync(path.dirname(f), {recursive: true});
  fs.writeFileSync(f, PNG());
  const user = os.userInfo().username;
  if (process.platform === 'win32') spawnSync('icacls', [f, '/deny', `${user}:(R,GR)`]); else fs.chmodSync(f, 0o000);
  try {
    const r = await rawGet(`/p/Scn/frames/${encodeURIComponent('закрыт.png')}`);
    assert.ok([403, 500, 503].includes(r.status), `статус ${r.status}`);
    assert.match(JSON.parse(r.body.toString('utf8')).error, /не открывается/);
  } finally { if (process.platform === 'win32') spawnSync('icacls', [f, '/remove:d', user]); else fs.chmodSync(f, 0o644); }
  assert.equal((await call('GET', '/api/projects')).status, 200, 'сервер жив (раньше падал с необработанной ошибкой потока)');
});

test('review.json повреждён: правки берутся из последней целой копии, повреждённый файл сохраняется рядом', async () => {
  const d = mkBoard('Brk');
  await callP('Brk', 'scene-comment', {scene: 'С01', text: 'первый'});
  await callP('Brk', 'scene-comment', {scene: 'С01', text: 'второй'});
  const f = path.join(d, 'review.json');
  const txt = fs.readFileSync(f, 'utf8');
  fs.writeFileSync(f, txt.slice(0, Math.floor(txt.length / 2))); // оборван посередине, как после сбоя синхронизации
  const view = await call('GET', '/api/board?project=Brk');
  assert.equal(view.status, 200);
  assert.match(view.json.warning, /повреждён/);
  assert.equal(view.json.review.scenes['С01'].comments.length, 2, 'страница показывает последнюю целую копию');
  const post = await callP('Brk', 'scene-comment', {scene: 'С01', text: 'третий'});
  assert.equal(post.status, 200);
  assert.deepEqual(post.json.review.scenes['С01'].comments.map((c) => c.text), ['первый', 'второй', 'третий'], 'раньше review.json затирался, остаток правок пропадал');
  assert.ok(fs.readdirSync(d).some((n) => /^review\.broken-.*\.json$/.test(n)), 'повреждённый файл сохранён рядом');
  assert.equal(JSON.parse(fs.readFileSync(f, 'utf8')).scenes['С01'].comments.length, 3);
  // целых копий нет совсем: начинаем с пустого, но мусор не удаляем
  const d2 = mkBoard('Brk2');
  fs.writeFileSync(path.join(d2, 'review.json'), 'это не json');
  assert.equal((await callP('Brk2', 'scene-comment', {scene: 'С01', text: 'после порчи'})).status, 200);
  assert.equal(fs.readFileSync(path.join(d2, fs.readdirSync(d2).find((n) => n.startsWith('review.broken-'))), 'utf8'), 'это не json');
  // board.json не подменяется пустотой: понятная ошибка вместо «доски без кадров»
  const d3 = mkBoard('Brk3', {boardText: '{не json'});
  const bad = await call('GET', '/api/board?project=Brk3');
  assert.equal(bad.status, 500);
  assert.match(bad.json.error, /board\.json повреждён/);
  assert.ok(fs.existsSync(path.join(d3, 'board.json')));
});

test('board.json и scenes.json из Блокнота (UTF-8 с BOM) и PowerShell (UTF-16) читаются', async () => {
  for (const [name, bom] of [['Bom8', 'utf8'], ['Bom16', 'utf16']]) {
    mkBoard(name, {bom});
    const g = await call('GET', `/api/board?project=${name}`);
    assert.equal(g.status, 200, name);
    assert.equal(g.json.board.frames.length, 3, `${name}: раньше доска открывалась пустой`);
  }
  const f8 = path.join(root, 'сцены-bom8.json'), f16 = path.join(root, 'сцены-bom16.json');
  const data = JSON.stringify([{t0: 0, t1: 3, title: 'Хук'}]);
  fs.writeFileSync(f8, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(data)]));
  fs.writeFileSync(f16, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(data, 'utf16le')]));
  assert.equal(readScenesFile(f8)[0].title, 'Хук');
  assert.equal(readScenesFile(f16)[0].title, 'Хук', 'UTF-16 раньше давал «не разбирается как JSON»');
  assert.equal(readJsonFile(path.join(root, 'нет.json'), 'запасное', 'x'), 'запасное'); // нет файла: fallback, а не ошибка
  fs.writeFileSync(path.join(root, 'null.json'), 'null');
  assert.throws(() => readJsonFile(path.join(root, 'null.json'), {}), BoardError);
});

test('страница и агент пишут review.json одновременно: ни одна правка не пропадает', async () => {
  const N = 12;
  const runCli = (i) => new Promise((res) => { const p = spawn(NODE, [path.join(HERE, 'cli.mjs'), 'Scn', 'note', 'С03', `агент ${i}`, '--root', root], {stdio: 'ignore'}); p.on('exit', res); });
  const before = reviewS().scenes['С03']?.comments?.length ?? 0;
  const jobs = [];
  for (let i = 0; i < N; i++) {
    jobs.push(runCli(i));
    jobs.push(new Promise((r) => setTimeout(r, 30 + (i % 4) * 25)).then(() => apiS('scene-comment', {scene: 'С03', text: `страница ${i}`})));
  }
  const res = await Promise.all(jobs);
  assert.deepEqual(res.filter((x) => typeof x === 'number' && x !== 0), [], 'cli не падает');
  const cm = reviewS().scenes['С03'].comments;
  assert.equal(cm.length, before + 2 * N, 'раньше при 25 параллельных записях терялась почти половина');
  assert.equal(cm.filter((c) => c.by === 'Claude').length >= N, true);
  assert.ok(!fs.existsSync(path.join(scnDir, '.review.lock')), 'замок снят');
  assert.ok(!fs.readdirSync(scnDir).some((n) => n.endsWith('.tmp')));
});

test('замок review.json: чужой зависший замок снимается сам, живой замок не обходится', {timeout: 30000}, () => {
  const d = mkBoard('Lock');
  fs.mkdirSync(path.join(d, '.review.lock'));
  const old = new Date(Date.now() - 60000);
  fs.utimesSync(path.join(d, '.review.lock'), old, old);
  assert.equal(withLock(d, () => 'ok'), 'ok', 'замок старше 10 с (процесс упал) снимается');
  assert.ok(!fs.existsSync(path.join(d, '.review.lock')));
  assert.throws(() => withLock(d, () => withLock(d, () => 1, {waitMs: 300})), /занят/, 'вложенный захват при живом замке ждёт и сдаётся с понятной ошибкой');
});

test('время без «0:60», номера кадров и сцен латиницей и без нулей', () => {
  assert.equal(mmss(59.97), '1:00.0');
  assert.equal(mmss(119.96), '2:00.0');
  assert.equal(mmss(4.2), '0:04.2');
  assert.equal(mmss(75.04), '1:15.0');
  assert.equal(mmss(NaN), '0:00.0');
  assert.equal(mmss(-3), '0:00.0');
  assert.equal(mmssShort(59.97), '1:00');
  assert.equal(mmssShort(4.2), '0:04,2');
  assert.equal(mmssShort(3), '0:03');
  assert.equal(mmssShort(0), '0:00');
  const frames = ['К001', 'К002', 'К010'], sc = ['С01', 'С02'];
  assert.equal(findId(frames, 'K010'), 'К010');
  assert.equal(findId(frames, 'К2'), 'К002');
  assert.equal(findId(frames, 'k1'), 'К001');
  assert.equal(findId(frames, 'К001'), 'К001');
  assert.equal(findId(sc, 'C2'), 'С02');
  assert.equal(findId(sc, 'с1'), 'С01');
  for (const bad of ['С01', 'К0x', '', null, undefined, 'К99', 'abc']) assert.equal(findId(frames, bad), null, String(bad));
});

test('сцены: слишком короткие и слишком многочисленные, null и true вместо секунд, перевод строки в названии, конец ролика', () => {
  assert.throws(() => planScenes({duration: 10, file: [{t0: 1, t1: 1.05}]}), /короче 0,2 с/);
  assert.throws(() => planScenes({duration: 10, file: [{t0: null, t1: 3}]}), /нужны числа/);
  assert.throws(() => planScenes({duration: 10, file: [{t0: 0, t1: true}]}), /нужны числа/);
  assert.throws(() => planScenes({duration: 10, file: [{t0: '', t1: 3}]}), /нужны числа/);
  assert.throws(() => planScenes({duration: 10, file: [null]}), /нужны числа/);
  assert.equal(planScenes({duration: 10, file: [{t0: '0', t1: '3', title: 'Хук\n<b>x</b>\t  два'}]}).scenes[0].title, 'Хук <b>x</b> два', 'числа строкой допустимы, название одной строкой');
  assert.throws(() => planScenes({duration: 100, chunk: 0.1}), /не больше 300/);
  assert.equal(planScenes({duration: 900, chunk: 3}).scenes.length, 300);
  assert.throws(() => planScenes({duration: 903, chunk: 3}), /не больше 300/);
  assert.throws(() => planScenes({duration: 100, file: Array.from({length: 301}, (_, i) => ({t0: i * 0.3, t1: i * 0.3 + 0.25}))}), /не больше 300/);
  assert.equal(planScenes({duration: 3.04, chunk: 3}).scenes.at(-1).t1, 3.04, 'последняя сцена доходит до конца ролика');
  assert.deepEqual(planScenes({duration: 2, chunk: 3}).scenes.map((s) => [s.t0, s.t1]), [[0, 2]], 'ролик в 2 с это одна сцена');
  assert.equal(planScenes({duration: 180, chunk: 3}).scenes.length, 60, 'ролик в 3 минуты');
});

test('сцены: нарезка идёт во временную папку, оборванная сборка не трогает прежние клипы', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'cut-'));
  const dir = path.join(out, 'scenes');
  fs.mkdirSync(dir);
  for (const n of ['С01.mp4', 'С01.jpg', 'С02.mp4', 'С02.jpg', 'С03.mp4', 'С03.jpg']) fs.writeFileSync(path.join(dir, n), 'старый');
  const sc = [{id: 'С01', t0: 0, t1: 3, clip: 'scenes/С01.mp4', poster: 'scenes/С01.jpg'}, {id: 'С02', t0: 3, t1: 6, clip: 'scenes/С02.mp4', poster: 'scenes/С02.jpg'}];
  const fake = (failOn) => (cmd, args, what) => {
    if (what === failOn) throw new Error('ffmpeg упал');
    for (const a of args.filter((x) => x.includes('.scenes-new'))) fs.writeFileSync(a, Buffer.alloc(2000, 5));
  };
  assert.throws(() => cutScenes({film: 'f.mp4', outDir: out, scenes: sc, portrait: true, run: fake('сцена С02')}), /ffmpeg упал/);
  assert.deepEqual(fs.readdirSync(dir).sort(), ['С01.jpg', 'С01.mp4', 'С02.jpg', 'С02.mp4', 'С03.jpg', 'С03.mp4'], 'прежние клипы на месте');
  assert.equal(fs.readFileSync(path.join(dir, 'С01.mp4'), 'utf8'), 'старый', 'и не перезаписаны наполовину');
  assert.ok(!fs.existsSync(path.join(out, '.scenes-new')), 'временная папка убрана');
  cutScenes({film: 'f.mp4', outDir: out, scenes: sc, portrait: true, run: fake(null)});
  assert.deepEqual(fs.readdirSync(dir).sort(), ['С01.jpg', 'С01.mp4', 'С02.jpg', 'С02.mp4'], 'после успеха лишние клипы убраны');
  assert.equal(fs.statSync(path.join(dir, 'С02.mp4')).size, 2000, 'клипы новые');
  // ffmpeg «отработал», но клип пустой: это ошибка, а не молчаливая пустая доска
  assert.throws(() => cutScenes({film: 'f.mp4', outDir: out, scenes: sc, portrait: true, run: () => {}}), /пустой/);
  assert.equal(fs.statSync(path.join(dir, 'С02.mp4')).size, 2000);
  fs.rmSync(out, {recursive: true, force: true});
});

test('сборка: слова из файла с BOM, имя ролика, K001 и К001 вместе', () => {
  const build = (...extra) => spawnSync(NODE, [path.join(HERE, 'board-from-frames.mjs'), 'Demo', '--root', root, ...extra], {encoding: 'utf8'});
  const w = path.join(root, 'слова-bom.json');
  fs.writeFileSync(w, '\ufeff' + JSON.stringify([{text: 'Слово', start: 0.2, end: 0.5}]));
  const r = build('--words', w);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(board().frames[0].phrase, 'Слово', 'слова с BOM раньше не читались');
  for (const bad of ['..', '.скрытый', 'a:b', 'a/b']) assert.notEqual(build('--project', bad).status, 0, `имя «${bad}»`);
  const dup = path.join(root, 'reviews', 'Dup-v001');
  fs.mkdirSync(dup, {recursive: true});
  for (const n of ['K001', 'К001', 'K002']) fs.writeFileSync(path.join(dup, `${n}.png`), 'x');
  const d = spawnSync(NODE, [path.join(HERE, 'board-from-frames.mjs'), 'Dup', '--root', root], {encoding: 'utf8'});
  assert.equal(d.status, 0, d.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(sceneRoot('Dup', 'storyboard', 'board.json'), 'utf8')).frames.map((f) => f.id), ['К001', 'К002'], 'дубль кадра убран');
});

test('cli: латинские номера, номера без нулей, ответ на ответ, многострочный текст, лишнее слово команды', () => {
  assert.equal(cliS('note', 'C02', 'латиницей').status, 0);
  assert.equal(reviewS().scenes['С02'].comments.at(-1).text, 'латиницей', 'раньше «нет кадра или сцены C02» при списке, неотличимом на вид');
  assert.equal(cliS('note', 'K003', 'кадр латиницей').status, 0);
  assert.equal(cliS('note', 'К3', 'кадр без нулей').status, 0);
  assert.equal(cliS('note', 'с1', 'сцена строчной').status, 0);
  assert.deepEqual(reviewS().frames['К003'].comments.filter((c) => c.author === 'Claude').map((c) => c.text).slice(-2), ['кадр латиницей', 'кадр без нулей']);
  const root1 = reviewS().frames['К001'].comments.find((c) => !c.parent);
  assert.equal(cliS('reply', 'K001', root1.id, 'первый ответ').status, 0);
  const rep = reviewS().frames['К001'].comments.at(-1);
  assert.equal(cliS('reply', 'К001', rep.id, 'ответ на ответ').status, 0);
  assert.equal(reviewS().frames['К001'].comments.at(-1).parent, root1.id, 'ответ на ответ под корнем (иначе страница его не показывает)');
  const multi = 'строка\n## К001 подделка заголовка\n- (x) Автор: ложный комментарий';
  return apiS('scene-comment', {scene: 'С03', text: multi}).then(() => {
    const out = cliS().stdout;
    assert.ok(!/^## К001 подделка/m.test(out) && !/^- \(x\)/m.test(out), 'продолжение многострочного текста с отступом, заголовок не подделать');
    assert.match(out, /^ {6}## К001 подделка заголовка/m);
    assert.notEqual(cliS('repy', 'С01').status, 0, 'неизвестная команда не печатает сводку молча');
    assert.match(cliS('repy', 'С01').stdout, /неизвестная команда/);
  });
});

test('служебные имена вместо кадра не добираются до Object.prototype (общие заметки, кадр __proto__)', async () => {
  const d = mkBoard('Proto');
  for (const frame of ['__proto__', 'constructor', 'prototype']) {
    const r = await callP('Proto', 'general', {frame, text: 'общая заметка'});
    assert.equal(r.status, 200, `general с frame «${frame}»: поле frame в общих заметках не читается`);
    assert.equal((await callP('Proto', 'comment', {frame, text: 'x'})).status, 404, `кадра «${frame}» нет`);
  }
  // раньше после такого запроса новые кадры делили один массив комментариев на всех, и комментарии молча терялись
  const c = await callP('Proto', 'comment', {frame: 'К002', text: 'после проверки прототипа'});
  assert.equal(c.status, 200);
  const saved = JSON.parse(fs.readFileSync(path.join(d, 'review.json'), 'utf8'));
  assert.deepEqual(saved.frames['К002'].comments.map((x) => x.text), ['после проверки прототипа']);
  assert.equal(saved.general.length, 3);
  assert.equal(({}).comments, undefined, 'в тестовом процессе прототип чист');
  // сводка агента: сдвиги, референсы и вложения исчезнувших кадров и сцен тоже печатаются
  fs.writeFileSync(path.join(d, 'review.json'), JSON.stringify({frames: {К077: {status: null, note: '', comments: [], moves: [{id: 'm1', from: {x: 0.1, y: 0.2}, to: {x: 0.5, y: 0.6}, label: 'телефон ушедшего кадра', scale: null, status: 'open'}],
    attachments: [{id: 'a1', path: 'files/К077/экран.png', label: 'скрин'}], links: [{url: 'https://example.com/x', label: 'образец'}]},
  }, scenes: {С44: {rating: null, note: '', comments: [], refs: [{id: 'r1', kind: 'url', url: 'https://youtu.be/abc', take: 'темп ушедшей сцены', status: 'open'}]}}, updatedAt: 'x', rev: 5}));
  const out = spawnSync(NODE, [path.join(HERE, 'cli.mjs'), 'Proto', '--root', root], {encoding: 'utf8'}).stdout;
  assert.match(out, /## К077 \(кадра в новой версии нет\)/);
  assert.match(out, /«телефон ушедшего кадра»/);
  assert.match(out, /📎 .*экран\.png/);
  assert.match(out, /ссылка: https:\/\/example\.com\/x/);
  assert.match(out, /## С44 \(сцены в новой версии нет\)/);
  assert.match(out, /взять: темп ушедшей сцены/);
});

test('сцены: сцена в последних 0,2 с ролика отбрасывается с предупреждением, а не роняет сборку', () => {
  const p = planScenes({duration: 8, file: [{t0: 0, t1: 4}, {t0: 4, t1: 7.9}, {t0: 7.9, t1: 9}]});
  assert.deepEqual(p.scenes.map((s) => [s.t0, s.t1]), [[0, 4], [4, 7.9]]);
  assert.match(p.warnings.join(' '), /меньше чем за 0,2 с до него/);
  assert.equal(planScenes({duration: 8, file: [{t0: 0, t1: 7.85}, {t0: 7.85, t1: 7.95}]}).scenes.length, 1);
});

test('cli: правки к сценам и кадрам, которых после пересборки нет, выводятся отдельным разделом', () => {
  const d = mkBoard('Orph');
  fs.writeFileSync(path.join(d, 'review.json'), JSON.stringify({frames: {К099: {status: 'fix', note: '', comments: [{id: 'c1', author: 'Автор', text: 'про исчезнувший кадр', status: 'open', createdAt: '2026-10-11T10:00:00Z'}]}},
    scenes: {С09: {rating: 'fix', note: 'заметка к исчезнувшей', comments: [{id: 'c2', t: 40, tag: 'Текст', text: 'про исчезнувшую сцену', by: 'Автор', at: '2026-10-11T10:00:00Z', status: 'open', replies: []}], refs: []}}, updatedAt: 'x'}));
  const out = spawnSync(NODE, [path.join(HERE, 'cli.mjs'), 'Orph', '--root', root], {encoding: 'utf8'}).stdout;
  assert.match(out, /# Правки к тому, чего больше нет на доске/);
  assert.match(out, /## С09 \(сцены в новой версии нет\)\s+\[ПРАВИТЬ\]/);
  assert.match(out, /про исчезнувшую сцену/);
  assert.match(out, /## К099 \(кадра в новой версии нет\)/);
  assert.match(out, /про исчезнувший кадр/);
  const lost = orphanReport(JSON.parse(fs.readFileSync(path.join(d, 'board.json'), 'utf8')), JSON.parse(fs.readFileSync(path.join(d, 'review.json'), 'utf8')));
  assert.deepEqual(lost.map((o) => o.id).sort(), ['К099', 'С09']);
});

test.after(() => { server?.kill(); fs.rmSync(root, {recursive: true, force: true}); });
