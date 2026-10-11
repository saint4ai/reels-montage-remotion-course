// Проверка сбора рилсов через Apify без сети и без ключа: npm run apify:test
// Поддельный fetch отвечает вместо Apify и сервера видео. Проверяем: разбор аккаунтов, порог и срок, что ключ идёт только в заголовок
// запросов к Apify (не в адрес, не на сервер видео, не в файлы и не в журнал), повтор при 429, понятная ошибка при 401, сухой запуск.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {buildInput, estimateUsd, fileNameFor, main, normalizeAccount, normalizeAccounts, parseArgs, parseEnv, readToken, selectReels, viewsOf} from './apify-reels.mjs';

const TOKEN = 'apify_api_SECRET123';
const NOW = new Date('2026-10-11T12:00:00');
const RUNS = 'https://api.apify.com/v2/actors/apify~instagram-reel-scraper/runs?maxTotalChargeUsd=1';

const json = (data, status = 200) => new Response(JSON.stringify(data), {status, headers: {'Content-Type': 'application/json'}});
const reel = (o) => ({productType: 'clips', ownerUsername: 'expert_one', timestamp: '2026-10-01T10:00:00.000Z', likesCount: 100, commentsCount: 5, videoDuration: 40, caption: 'подпись', ...o});
const ITEMS = [
  reel({shortCode: 'AAA', url: 'https://www.instagram.com/reel/AAA/', videoUrl: 'https://cdn.example/a.mp4', videoPlayCount: 120000, videoViewCount: 90000,
    likesCount: 5000, commentsCount: 40, videoDuration: 41.3, caption: 'Первая строка | с чертой\nвторая строка',
    latestComments: [{ownerUsername: 'secret_person', text: 'личный комментарий'}]}),
  reel({shortCode: 'BBB', url: 'https://www.instagram.com/reel/BBB/', videoUrl: 'https://cdn.example/b.mp4', videoPlayCount: 30000, likesCount: -1, timestamp: '2026-09-20T10:00:00.000Z'}),
  reel({shortCode: 'CCC', url: 'https://www.instagram.com/reel/CCC/', videoUrl: 'https://cdn.example/c.mp4', videoPlayCount: 10000}),
  reel({shortCode: 'DDD', url: 'https://www.instagram.com/reel/DDD/', videoUrl: 'https://cdn.example/d.mp4', videoPlayCount: 900000, timestamp: '2026-05-01T10:00:00.000Z'}),
  reel({shortCode: 'EEE', url: 'https://www.instagram.com/p/EEE/', videoPlayCount: 500000}),
  reel({shortCode: 'AAA', url: 'https://www.instagram.com/reel/AAA/', videoUrl: 'https://cdn.example/a2.mp4', videoPlayCount: 120000}),
  {error: 'no_items', errorDescription: 'Profile is private', url: 'https://www.instagram.com/closed/'},
];

// поддельная сеть: записывает запросы, отвечает как Apify
function fakeNet({postStatuses = [201], items = ITEMS, usage = 0.0123} = {}) {
  const calls = [];
  const statuses = [...postStatuses];
  const fetchImpl = async (url, opts = {}) => {
    calls.push({url: String(url), method: opts.method ?? 'GET', headers: opts.headers ?? {}, body: opts.body});
    const u = String(url);
    if (u.startsWith('https://api.apify.com/v2/actors/')) {
      const st = statuses.length > 1 ? statuses.shift() : statuses[0];
      return st === 201 ? json({data: {id: 'RUN1', status: 'READY', defaultDatasetId: 'DS1'}}, 201) : json({error: {message: 'x'}}, st);
    }
    if (u.startsWith('https://api.apify.com/v2/actor-runs/RUN1')) return json({data: {id: 'RUN1', status: 'SUCCEEDED', defaultDatasetId: 'DS1', usageTotalUsd: usage}});
    if (u.startsWith('https://api.apify.com/v2/datasets/DS1/items')) return json(items);
    if (u.startsWith('https://cdn.example/')) return new Response(Buffer.from('видео ' + u), {status: 200});
    return json({}, 404);
  };
  return {fetchImpl, calls};
}

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'apify-test-'));
const allFiles = (dir) => fs.readdirSync(dir, {recursive: true, withFileTypes: true}).filter((e) => e.isFile()).map((e) => path.join(e.parentPath ?? e.path, e.name));

test('аккаунты: ник, @ник, ссылки на профиль и вкладку рилсов; ссылки на посты отбрасываются', () => {
  assert.equal(normalizeAccount('@Expert_One'), 'expert_one');
  assert.equal(normalizeAccount('expert.two'), 'expert.two');
  assert.equal(normalizeAccount('https://www.instagram.com/expert_three/'), 'expert_three');
  assert.equal(normalizeAccount('instagram.com/expert_four/reels/?hl=ru'), 'expert_four');
  assert.equal(normalizeAccount('https://www.instagram.com/reel/AAA/'), null);
  assert.equal(normalizeAccount('https://www.instagram.com/p/AAA/'), null);
  assert.equal(normalizeAccount('https://example.com/user'), null);
  assert.equal(normalizeAccount('два слова'), null);
  const r = normalizeAccounts(['@a', 'A', 'b', 'https://www.instagram.com/reel/X/']);
  assert.deepEqual(r.accounts, ['a', 'b']);
  assert.equal(r.rejected.length, 1);
});

test('параметры: значения по умолчанию, проверка чисел, ошибки', () => {
  const o = parseArgs(['--accounts', '@a,@b', '--accounts', 'c']);
  assert.deepEqual(o.accounts, ['@a', '@b', 'c']);
  assert.equal(o.minViews, 25000); assert.equal(o.months, 2); assert.equal(o.limit, 40); assert.equal(o.maxUsd, 1);
  assert.equal(parseArgs(['--min-views', '50000']).minViews, 50000);
  assert.equal(parseArgs(['--no-download']).download, 0);
  assert.throws(() => parseArgs(['--months', '0']), /months/);
  assert.throws(() => parseArgs(['--limit']), /значение/);
  assert.throws(() => parseArgs(['--nope']), /неизвестный/);
});

test('вход актёра и оценка расхода', () => {
  assert.deepEqual(buildInput({accounts: ['a', 'b'], limit: 40, months: 2}), {username: ['a', 'b'], resultsLimit: 40, onlyPostsNewerThan: '2 months', skipPinnedPosts: false});
  assert.equal(estimateUsd(3, 40), 0.313);
});

test('ключ: окружение главнее файла .env; без ключа null; кавычки и комментарии разбираются', () => {
  const dir = tmp();
  assert.equal(readToken({env: {}, cwd: dir}), null);
  fs.writeFileSync(path.join(dir, '.env'), `# комментарий\nOTHER=1\nAPIFY_TOKEN="${TOKEN}"\n`);
  assert.equal(readToken({env: {}, cwd: dir}), TOKEN);
  assert.equal(readToken({env: {APIFY_TOKEN: 'из_окружения'}, cwd: dir}), 'из_окружения');
  assert.deepEqual(parseEnv('A=1\n#B=2\nexport C = "x y"'), {A: '1', C: 'x y'});
});

test('отбор: порог, срок, дубли, рилс без видео, порядок по просмотрам', () => {
  const kept = selectReels(ITEMS.filter((x) => !x.error), {minViews: 25000, since: new Date('2026-08-11T00:00:00Z')});
  assert.deepEqual(kept.map((x) => x.shortCode), ['AAA', 'BBB']);
  assert.equal(viewsOf({videoViewCount: 7}), 7);
  assert.equal(viewsOf({videoPlayCount: 9, videoViewCount: 7}), 9);
  assert.equal(viewsOf({}), null);
  assert.equal(fileNameFor({ownerUsername: 'a/b', shortCode: 'X Y'}), 'a_b-X_Y.mp4');
});

test('полный запуск на поддельной сети: файлы, список, ключ только в заголовке Apify', async () => {
  const dir = tmp();
  const {fetchImpl, calls} = fakeNet();
  const log = [];
  const code = await main(['--accounts', '@expert_one,https://www.instagram.com/closed/'], {env: {APIFY_TOKEN: TOKEN}, cwd: dir, fetchImpl, now: NOW, log: (s) => log.push(s), sleep: async () => {}});
  assert.equal(code, 0, log.join('\n'));

  // запросы
  const apify = calls.filter((c) => c.url.startsWith('https://api.apify.com'));
  const cdn = calls.filter((c) => c.url.startsWith('https://cdn.example'));
  assert.equal(apify[0].method, 'POST');
  assert.equal(apify[0].url, RUNS);
  assert.deepEqual(JSON.parse(apify[0].body), {username: ['expert_one', 'closed'], resultsLimit: 40, onlyPostsNewerThan: '2 months', skipPinnedPosts: false});
  assert.ok(apify.some((c) => c.url.includes('waitForFinish=60')));
  for (const c of apify) {
    assert.equal(c.headers.Authorization, `Bearer ${TOKEN}`);
    assert.ok(!c.url.includes(TOKEN), 'ключ в адресе запроса');
  }
  assert.deepEqual(cdn.map((c) => c.url), ['https://cdn.example/a.mp4', 'https://cdn.example/b.mp4']);
  for (const c of cdn) assert.equal(c.headers.Authorization, undefined, 'ключ ушёл на сервер видео');

  // файлы
  const out = path.join(dir, 'work', '_refs', '2026-10-11');
  assert.ok(fs.existsSync(path.join(out, 'expert_one-AAA.mp4')));
  assert.ok(fs.existsSync(path.join(out, 'expert_one-BBB.mp4')));
  assert.ok(!fs.existsSync(path.join(out, 'expert_one-CCC.mp4')));
  const md = fs.readFileSync(path.join(out, 'index.md'), 'utf8');
  assert.match(md, /https:\/\/www\.instagram\.com\/reel\/AAA\//);
  assert.match(md, /120 000/);
  assert.match(md, /скрыто/); // лайки -1
  assert.match(md, /0:41/);
  assert.match(md, /Первая строка \/ с чертой вторая строка/); // чёрта | экранирована, перенос строки убран
  assert.match(md, /\$0\.0123/);
  assert.match(md, /Profile is private/);
  assert.ok(!md.includes('—'), 'длинное тире в списке');
  const idx = JSON.parse(fs.readFileSync(path.join(out, 'index.json'), 'utf8'));
  assert.equal(idx.reels.length, 2);
  assert.equal(idx.reels[0].views, 120000);

  // ключ и данные людей из комментариев нигде не оседают
  for (const f of allFiles(dir)) {
    const text = f.endsWith('.mp4') ? '' : fs.readFileSync(f, 'utf8');
    assert.ok(!text.includes(TOKEN), `ключ в файле ${f}`);
    assert.ok(!text.includes('secret_person'), `данные из комментариев в файле ${f}`);
  }
  assert.ok(!log.join('\n').includes(TOKEN), 'ключ в журнале');
});

test('ключ из .env, порог и число скачиваний из параметров', async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, '.env'), `APIFY_TOKEN=${TOKEN}\n`);
  const {fetchImpl, calls} = fakeNet();
  const code = await main(['--accounts', 'expert_one', '--min-views', '100000', '--download', '1'], {env: {}, cwd: dir, fetchImpl, now: NOW, log: () => {}, sleep: async () => {}});
  assert.equal(code, 0);
  assert.equal(calls.filter((c) => c.url.startsWith('https://cdn.example')).length, 1);
  const idx = JSON.parse(fs.readFileSync(path.join(dir, 'work', '_refs', '2026-10-11', 'index.json'), 'utf8'));
  assert.deepEqual(idx.reels.map((r) => r.url.split('/').at(-2)), ['AAA']);
});

test('429: ждёт и повторяет, потом всё проходит', async () => {
  const dir = tmp();
  const {fetchImpl, calls} = fakeNet({postStatuses: [429, 429, 201]});
  let slept = 0;
  const code = await main(['--accounts', 'expert_one', '--no-download'], {env: {APIFY_TOKEN: TOKEN}, cwd: dir, fetchImpl, now: NOW, log: () => {}, sleep: async () => { slept++; }});
  assert.equal(code, 0);
  assert.equal(slept, 2);
  assert.equal(calls.filter((c) => c.method === 'POST').length, 3);
  assert.equal(calls.filter((c) => c.url.startsWith('https://cdn.example')).length, 0);
});

test('401: понятное сообщение, код 1, ключ не показан', async () => {
  const dir = tmp();
  const {fetchImpl} = fakeNet({postStatuses: [401]});
  const log = [];
  const code = await main(['--accounts', 'expert_one'], {env: {APIFY_TOKEN: TOKEN}, cwd: dir, fetchImpl, now: NOW, log: (s) => log.push(s), sleep: async () => {}});
  assert.equal(code, 1);
  assert.match(log.join('\n'), /не принял ключ/);
  assert.ok(!log.join('\n').includes(TOKEN));
});

test('402: сообщение про закончившиеся кредиты', async () => {
  const dir = tmp();
  const {fetchImpl} = fakeNet({postStatuses: [402]});
  const log = [];
  assert.equal(await main(['--accounts', 'expert_one'], {env: {APIFY_TOKEN: TOKEN}, cwd: dir, fetchImpl, now: NOW, log: (s) => log.push(s), sleep: async () => {}}), 1);
  assert.match(log.join('\n'), /кредиты Apify/);
});

test('сухой запуск не ходит в сеть; без ключа обычный запуск говорит, куда его записать', async () => {
  const dir = tmp();
  let called = 0;
  const fetchImpl = async () => { called++; return json({}); };
  const log = [];
  assert.equal(await main(['--accounts', '@a,@b,@c', '--dry-run'], {env: {}, cwd: dir, fetchImpl, now: NOW, log: (s) => log.push(s)}), 0);
  assert.equal(called, 0);
  assert.match(log.join('\n'), /Оценка расхода: до 0\.313/);
  const log2 = [];
  assert.equal(await main(['--accounts', '@a'], {env: {}, cwd: dir, fetchImpl, now: NOW, log: (s) => log2.push(s)}), 1);
  assert.match(log2.join('\n'), /\.env/);
  assert.equal(called, 0);
});

test('ошибки параметров: код 2', async () => {
  assert.equal(await main(['--months', '99'], {env: {}, cwd: tmp(), log: () => {}}), 2);
  assert.equal(await main([], {env: {}, cwd: tmp(), log: () => {}}), 2);
  assert.equal(await main(['--accounts', 'https://www.instagram.com/reel/AAA/'], {env: {}, cwd: tmp(), log: () => {}}), 2);
});
