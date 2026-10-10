// Проверка доски раскадровки без браузера: npm run board:test
// Собирает доску из поддельных кадров во временной папке, запускает сервер на свободном порту, ставит сдвиги операциями API,
// читает их агентским cli.mjs (доли и пиксели кадра 1440×2560) и закрывает. Chrome, ffmpeg и рендер не нужны.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import http from 'node:http';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

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
  const req = http.request({host: '127.0.0.1', port, path: url, method, headers: {...(data ? {'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data)} : {}), ...headers}},
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

test.after(() => { server?.kill(); fs.rmSync(root, {recursive: true, force: true}); });
