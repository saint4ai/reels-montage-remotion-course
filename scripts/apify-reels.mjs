// Сбор залетевших рилсов конкурентов через Apify (актёр apify/instagram-reel-scraper).
//   node scripts/apify-reels.mjs --accounts @ник1,@ник2,https://www.instagram.com/ник3/ [--min-views 25000] [--months 2]
//        [--limit 40] [--download 20] [--max-usd 1] [--out work/_refs] [--no-download] [--dry-run]
// Что делает: запускает актёра по списку профилей за последние N месяцев, оставляет рилсы с просмотрами не меньше порога,
// скачивает лучшие в work/_refs/<дата>/ и пишет index.md и index.json (ссылка, дата, просмотры, лайки, комментарии, длительность, подпись).
// Ключ: переменная APIFY_TOKEN из окружения или из файла .env в папке проекта. Ключ уходит только в заголовок Authorization
// запросов к api.apify.com, нигде не печатается и не пишется в файлы. Видео скачивается напрямую с адреса videoUrl без ключа:
// платная опция актёра includeDownloadedVideo (0,02 $ за мегабайт) не используется.
// Чужие ролики служат референсом: берём идею, не текст и не кадры (правило навыка onai-scriptolog).
import {createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {pathToFileURL} from 'node:url';

export const ACTOR = 'apify~instagram-reel-scraper';
export const API = 'https://api.apify.com/v2';
// Цены тарифа Free по публичной карточке актёра на 11.10.2026: 0,0026 $ за рилс и 0,001 $ за запуск.
export const PRICE = {reel: 0.0026, start: 0.001};
const DONE = new Set(['SUCCEEDED', 'FAILED', 'TIMED-OUT', 'ABORTED']);
const DEFAULTS = {minViews: 25000, months: 2, limit: 40, download: 20, maxUsd: 1, out: 'work/_refs'};

// ---------- чистые функции (их проверяет тест без сети) ----------

// KEY=VALUE построчно, кавычки по краям снимаются, комментарии # пропускаются
export function parseEnv(text) {
  const out = {};
  for (const line of String(text).split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

// ключ из окружения, иначе из .env в папке проекта; нет ключа: null
export function readToken({env = process.env, cwd = process.cwd()} = {}) {
  if (env.APIFY_TOKEN && env.APIFY_TOKEN.trim()) return env.APIFY_TOKEN.trim();
  const file = path.join(cwd, '.env');
  if (existsSync(file)) {
    const v = parseEnv(readFileSync(file, 'utf8')).APIFY_TOKEN;
    if (v && v.trim()) return v.trim();
  }
  return null;
}

// «@ник», «ник», ссылка на профиль или его вкладку рилсов -> ник; ссылка на отдельный пост или рилс -> null
export function normalizeAccount(raw) {
  let s = String(raw ?? '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s) || /^(www\.)?instagram\.com\//i.test(s)) {
    let u;
    try { u = new URL(/^https?:/i.test(s) ? s : `https://${s}`); } catch { return null; }
    if (!/(^|\.)instagram\.com$/i.test(u.hostname)) return null;
    const first = u.pathname.split('/').filter(Boolean)[0];
    if (!first || ['reel', 'reels', 'p', 'tv', 'explore', 'stories', 'accounts', 'direct'].includes(first.toLowerCase())) return null;
    s = first;
  }
  s = s.replace(/^@/, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(s) ? s.toLowerCase() : null;
}

export function normalizeAccounts(list) {
  const seen = new Set();
  const good = [];
  const bad = [];
  for (const raw of list) {
    const u = normalizeAccount(raw);
    if (!u) bad.push(String(raw));
    else if (!seen.has(u)) { seen.add(u); good.push(u); }
  }
  return {accounts: good, rejected: bad};
}

export function parseArgs(argv) {
  const o = {accounts: [], dryRun: false, noDownload: false, ...DEFAULTS};
  const need = (i, name) => {
    if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) throw new Error(`после ${name} нужно значение`);
    return argv[i + 1];
  };
  const num = (v, name, min, max) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${name}: число от ${min} до ${max}, получено «${v}»`);
    return n;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--accounts') { o.accounts.push(...need(i, a).split(/[\s,;]+/).filter(Boolean)); i++; }
    else if (a === '--min-views') { o.minViews = Math.round(num(need(i, a), a, 0, 1e9)); i++; }
    else if (a === '--months') { o.months = Math.round(num(need(i, a), a, 1, 24)); i++; }
    else if (a === '--limit') { o.limit = Math.round(num(need(i, a), a, 1, 200)); i++; }
    else if (a === '--download') { o.download = Math.round(num(need(i, a), a, 0, 100)); i++; }
    else if (a === '--max-usd') { o.maxUsd = num(need(i, a), a, 0.01, 50); i++; }
    else if (a === '--out') { o.out = need(i, a); i++; }
    else if (a === '--no-download') o.download = 0;
    else if (a === '--dry-run') o.dryRun = true;
    else throw new Error(`неизвестный параметр ${a}`);
  }
  return o;
}

export function buildInput({accounts, limit, months}) {
  return {username: accounts, resultsLimit: limit, onlyPostsNewerThan: `${months} months`, skipPinnedPosts: false};
}

export const estimateUsd = (accountCount, limit) => +(accountCount * limit * PRICE.reel + PRICE.start).toFixed(4);

export function cutoffDate(months, now = new Date()) {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

// «просмотры» рилса: число проигрываний, если актёр его дал, иначе число просмотров
export function viewsOf(item) {
  for (const k of ['videoPlayCount', 'videoViewCount']) if (Number.isFinite(item?.[k]) && item[k] >= 0) return item[k];
  return null;
}

// оставляет видео с адресом файла, не старше срока, от порога просмотров; без повторов; от большего к меньшему
export function selectReels(items, {minViews, since}) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    if (!it || typeof it.videoUrl !== 'string' || !it.videoUrl) continue;
    const v = viewsOf(it);
    if (v === null || v < minViews) continue;
    if (it.timestamp) {
      const t = Date.parse(it.timestamp);
      if (Number.isFinite(t) && t < since.getTime()) continue;
    }
    const key = it.shortCode || it.id || it.url;
    if (key) { if (seen.has(key)) continue; seen.add(key); }
    out.push(it);
  }
  return out.sort((a, b) => viewsOf(b) - viewsOf(a));
}

const safe = (s) => String(s ?? '').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
export const fileNameFor = (it) => `${safe(it.ownerUsername) || 'reel'}-${safe(it.shortCode || it.id) || 'x'}.mp4`;

const oneLine = (s, n) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return (t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t).replace(/\|/g, '/');
};
const fmt = (n) => (Number.isFinite(n) ? n.toLocaleString('ru-RU').replace(/[\u00a0\u202f]/g, ' ') : 'нет данных');
const fmtLikes = (n) => (n === -1 ? 'скрыто' : fmt(n));
const fmtDur = (s) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : 'нет данных');
const iso = (x) => (x ? String(x).slice(0, 10) : 'нет данных');

// запись для index.json: только нужные поля, без комментариев и данных людей из них
export function toRecord(it, file) {
  return {
    url: it.url ?? (it.shortCode ? `https://www.instagram.com/reel/${it.shortCode}/` : null),
    account: it.ownerUsername ?? null,
    date: iso(it.timestamp),
    views: viewsOf(it),
    likes: Number.isFinite(it.likesCount) ? it.likesCount : null,
    comments: Number.isFinite(it.commentsCount) ? it.commentsCount : null,
    durationSec: Number.isFinite(it.videoDuration) ? Math.round(it.videoDuration * 10) / 10 : null,
    caption: oneLine(it.caption, 400),
    file: file ?? null,
  };
}

export function renderIndex({records, params, stats}) {
  const lines = [
    `# Референсы: залетевшие рилсы конкурентов (${stats.date})`,
    '',
    `Аккаунты: ${params.accounts.map((a) => '@' + a).join(', ')}. Период: последние ${params.months} мес. Порог: от ${fmt(params.minViews)} просмотров.`,
    `Актёр Apify: apify/instagram-reel-scraper, запуск ${stats.runId ?? 'нет данных'}. Получено рилсов: ${stats.fetched}, прошли порог: ${stats.kept}, скачано: ${stats.downloaded}.`,
    `Расход запуска: ${stats.costUsd == null ? 'смотри в Apify, раздел Billing' : '$' + stats.costUsd.toFixed(4)}.`,
    '',
    'Чужие ролики только референс: берём идею и приём хука, не текст, не кадры и не голос.',
    '',
    '| № | Аккаунт | Дата | Просмотры | Лайки | Комментарии | Длительность | Подпись | Ссылка | Файл |',
    '|---|---|---|---|---|---|---|---|---|---|',
  ];
  records.forEach((r, i) => {
    lines.push(`| ${i + 1} | @${r.account ?? '?'} | ${r.date} | ${fmt(r.views)} | ${fmtLikes(r.likes)} | ${fmt(r.comments)} | ${fmtDur(r.durationSec)} | ${oneLine(r.caption, 140)} | ${r.url ?? ''} | ${r.file ?? 'не скачан'} |`);
  });
  if (stats.notes.length) lines.push('', 'Заметки:', ...stats.notes.map((n) => `- ${n}`));
  return lines.join('\n') + '\n';
}

// ---------- работа с API ----------

class ApifyError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function apifyCall({fetchImpl, token, method, url, body, sleep = wait, tries = 4}) {
  let delay = 500;
  for (let attempt = 1; ; attempt++) {
    const res = await fetchImpl(url, {
      method,
      headers: {Authorization: `Bearer ${token}`, ...(body ? {'Content-Type': 'application/json'} : {})},
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.ok) return res.json();
    // 429 и сбои сервера: ждём и повторяем (так советует документация Apify), остальное сразу ошибка
    if ((res.status === 429 || res.status >= 500) && attempt < tries) { await sleep(delay + Math.random() * delay); delay *= 2; continue; }
    const hint = {
      401: 'Apify не принял ключ. Проверь, что в .env строка APIFY_TOKEN=<ключ> без пробелов, или создай новый ключ в Settings, API & Integrations.',
      402: 'Бесплатные кредиты Apify на этот месяц закончились (или лимит расхода запуска исчерпан). Подожди следующего месяца или подними лимит.',
      403: 'У ключа нет прав на это действие.',
      404: 'Apify не нашёл актёра или запуск.',
      429: 'Apify просит не торопиться, повтори через минуту.',
    }[res.status] ?? 'Apify вернул ошибку.';
    throw new ApifyError(res.status, `${hint} (код ${res.status})`);
  }
}

export async function runActor({fetchImpl, token, input, maxUsd, log, sleep = wait, maxWaitMs = 20 * 60 * 1000}) {
  const started = (await apifyCall({fetchImpl, token, method: 'POST', url: `${API}/actors/${ACTOR}/runs?maxTotalChargeUsd=${maxUsd}`, body: input, sleep})).data;
  log(`Запуск ${started.id} начат, жду результат (до ${Math.round(maxWaitMs / 60000)} мин)...`);
  let run = started;
  const t0 = Date.now();
  while (!DONE.has(run.status)) {
    if (Date.now() - t0 > maxWaitMs) throw new Error('Apify работает слишком долго. Запуск остался в Apify, посмотри его в разделе Runs.');
    run = (await apifyCall({fetchImpl, token, method: 'GET', url: `${API}/actor-runs/${started.id}?waitForFinish=60`, sleep})).data;
  }
  let items = [];
  if (run.defaultDatasetId) {
    items = await apifyCall({fetchImpl, token, method: 'GET', url: `${API}/datasets/${run.defaultDatasetId}/items?clean=1&format=json`, sleep});
  }
  return {run, items: Array.isArray(items) ? items : []};
}

// скачивание файла без ключа Apify: адрес videoUrl ведёт на сервер Instagram
export async function downloadVideo({fetchImpl, url, dest}) {
  const res = await fetchImpl(url, {signal: AbortSignal.timeout(180000)});
  if (!res.ok || !res.body) throw new Error(`код ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

const todayLocal = (now) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
};

// ---------- сценарий целиком ----------

export async function main(argv, {env = process.env, cwd = process.cwd(), fetchImpl = globalThis.fetch, now = new Date(),
  log = console.log, sleep = wait} = {}) {
  let o;
  try { o = parseArgs(argv); } catch (e) { log(`Ошибка в параметрах: ${e.message}`); return 2; }
  const {accounts, rejected} = normalizeAccounts(o.accounts);
  if (rejected.length) log(`Не похоже на профиль Instagram, пропускаю: ${rejected.join(', ')}`);
  if (!accounts.length) { log('Нужен хотя бы один аккаунт: --accounts @ник1,@ник2'); return 2; }

  const input = buildInput({accounts, limit: o.limit, months: o.months});
  const est = estimateUsd(accounts.length, o.limit);
  const token = readToken({env, cwd});
  log(`Аккаунты: ${accounts.map((a) => '@' + a).join(', ')}. Период: ${o.months} мес. Порог: от ${o.minViews} просмотров.`);
  log(`Оценка расхода: до ${est} $ (не больше ${o.maxUsd} $ по лимиту запуска).`);
  if (o.dryRun) {
    log(`Сухой запуск, в сеть не хожу. Вход актёра: ${JSON.stringify(input)}`);
    log(token ? 'Ключ APIFY_TOKEN найден (значение не показываю).' : 'Ключа APIFY_TOKEN пока нет.');
    return 0;
  }
  if (!token) { log('Нет ключа Apify. Запиши его в файл .env строкой APIFY_TOKEN=<ключ> (инструкция docs/guides/apify.md).'); return 1; }

  let result;
  try {
    result = await runActor({fetchImpl, token, input, maxUsd: o.maxUsd, log, sleep});
  } catch (e) {
    log(`Не вышло: ${String(e.message).split(token).join('***')}`);
    return 1;
  }
  const {run, items} = result;
  const notes = [];
  if (run.status !== 'SUCCEEDED') notes.push(`Запуск закончился со статусом ${run.status}, результаты могут быть неполными.`);
  const errorItems = items.filter((x) => x && x.error);
  for (const x of errorItems.slice(0, 5)) notes.push(`Нет данных по ${x.url ?? x.inputUrl ?? 'одному из аккаунтов'}: ${oneLine(x.errorDescription ?? x.error, 120)}. Аккаунт может быть закрытым или названным неверно.`);
  const reels = items.filter((x) => x && !x.error);
  const kept = selectReels(reels, {minViews: o.minViews, since: cutoffDate(o.months, now)});

  const date = todayLocal(now);
  const dir = path.resolve(cwd, o.out, date);
  mkdirSync(dir, {recursive: true});
  const records = [];
  let downloaded = 0;
  for (const [i, it] of kept.entries()) {
    let file = null;
    if (i < o.download) {
      const name = fileNameFor(it);
      try {
        await downloadVideo({fetchImpl, url: it.videoUrl, dest: path.join(dir, name)});
        file = name;
        downloaded++;
        log(`Скачан ${name} (${fmt(viewsOf(it))} просмотров)`);
      } catch (e) {
        notes.push(`Не скачался ${it.url ?? name}: ${e.message}. Ссылка на видео живёт недолго, запусти сбор заново.`);
      }
    }
    records.push(toRecord(it, file));
  }
  const costUsd = Number.isFinite(run.usageTotalUsd) ? run.usageTotalUsd : null;
  const stats = {date, runId: run.id, fetched: reels.length, kept: kept.length, downloaded, costUsd, notes};
  writeFileSync(path.join(dir, 'index.md'), renderIndex({records, params: {...o, accounts}, stats}));
  writeFileSync(path.join(dir, 'index.json'), JSON.stringify({date, params: {accounts, months: o.months, minViews: o.minViews}, stats: {...stats, notes: undefined}, reels: records}, null, 1));
  log(`Готово: получено ${reels.length}, прошли порог ${kept.length}, скачано ${downloaded}. Расход: ${costUsd == null ? 'смотри в Apify, раздел Billing' : '$' + costUsd.toFixed(4)}.`);
  log(`Папка: ${path.relative(cwd, dir) || dir}. Список: index.md`);
  for (const n of notes) log(`Заметка: ${n}`);
  if (!kept.length) log(`Ни один рилс не прошёл порог ${o.minViews}. Попробуй порог ниже (--min-views 10000) или другие аккаунты.`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = await main(process.argv.slice(2)); // не process.exit: на Windows он ломает закрытие соединений fetch
}
