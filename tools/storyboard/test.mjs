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
import {planScenes, buildScenes} from './scenes.mjs';

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
const call = (method, url, body, headers = {}) => new Promise((res, rej) => {
  const data = body == null ? null : JSON.stringify(body);
  const req = http.request({host: '127.0.0.1', port, path: url, method, agent: false, headers: {...(data ? {'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data)} : {}), ...headers}},
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
  assert.equal((await api('move', body, {Origin: `http://localhost:${port}`})).status, 200); // страница самой доски
  assert.equal((await api('move-remove', {frame: 'К001', id: review().frames['К001'].moves.at(-1).id})).status, 200);
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
const upload = (frame, name, data) => new Promise((res, rej) => {
  const req = http.request({host: '127.0.0.1', port, agent: false, method: 'POST', path: `/api/upload?project=Scn&frame=${encodeURIComponent(frame)}&name=${encodeURIComponent(name)}`, headers: {'Content-Length': data.length}},
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
  const up = await upload('С02', 'пример.mp4', Buffer.from('видео референса'));
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
  const exe = await upload('С02', 'вирус.exe', Buffer.from('MZ'));
  assert.equal((await bad(exe.json.path)).status, 400, 'формат только mp4, webm, mov, gif, png, jpg');
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
  // загрузка с «..» вместо имени сцены не уводит файл из files/
  const sneaky = await upload('..', 'x.png', Buffer.from('1'));
  assert.match(sneaky.json.path, /^files\/[^.][^/]*\/[^/]+$/);
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

test.after(() => { server?.kill(); fs.rmSync(root, {recursive: true, force: true}); });
