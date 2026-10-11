// Доска раскадровки: сверху сцены (клипы с комментариями, моментами и референсами анимации, см. scenes.js), ниже кадры ролика:
// видео фильма по сегменту кадра, оценки, ветки комментариев, сдвиги объектов стрелкой, вложения, паттерны.
// Все правки уходят на локальный сервер операциями (/api/frame, /api/comment, /api/move, /api/scene-* …) и пишутся в work/<ролик>/storyboard/review.json.
// Правило страницы: всё, что пришло с сервера или от автора (комментарии, заметки, названия, имена файлов), попадает в страницу только как текст
// (createTextNode и setAttribute), никогда как HTML; ссылки открываются, только если это http(s).
import {initScenes} from './scenes.js';
const $ = (s, el = document) => el.querySelector(s);
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
};
const S = {project: null, board: null, review: {frames: {}, scenes: {}}, version: null, sel: null, filter: 'all', loop: true, moveMode: false, pending: null,
  drafts: {}, replyOpen: new Set(), busy: new Set(), token: 0, pendingRender: false, panelSig: '', gridSig: '', ribbonSig: ''};
const store = {get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} }};
// 59,97 с это 1:00,0, а не «0:60,0»: сначала округляем до десятой
const tc = (s) => { const t = Math.round(Number(s) * 10) / 10; if (!Number.isFinite(t) || t < 0) return '0:00.0'; const m = Math.floor(t / 60); return `${m}:${(t - m * 60).toFixed(1).padStart(4, '0')}`; };
const media = (p) => (p ? `/p/${encodeURIComponent(S.project)}/${p.split('/').map(encodeURIComponent).join('/')}?v=${S.version ?? 0}` : '');
const fr = (id) => S.review.frames?.[id] ?? {status: null, note: '', comments: [], attachments: [], links: [], patterns: [], refs: [], moves: []};
// размер кадра композиции в пикселях (для подписей сдвигов): из board.json, по умолчанию 1440×2560
const FW = () => Number(S.board?.width) || 1440, FH = () => Number(S.board?.height) || 2560;
const openMoves = (r) => (r.moves ?? []).filter((m) => m.status !== 'resolved');
const openCmts = (r) => (r.comments ?? []).filter((c) => c.status !== 'resolved' && !c.parent);
const author = () => $('#author').value.trim() || 'Автор';
const toast = (t) => { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), t.length > 60 ? 5000 : 2200); };
const STATUS = {ok: 'Нравится', fix: 'Нужна правка', ask: 'Вопрос'};
const SCALES = [['', 'размер не менять'], ['1.25', 'крупнее ×1,25'], ['1.5', 'ещё крупнее ×1,5'], ['0.8', 'мельче ×0,8'], ['0.6', 'ещё мельче ×0,6']];
const ptxt = (p) => `(${Math.round(p.x * FW())}, ${Math.round(p.y * FH())})`;
const scaleTxt = (v) => (v ? `${v > 1 ? 'крупнее' : 'мельче'} ×${String(v).replace('.', ',')}` : '');
// ссылка кликабельна, только если это http(s): javascript: и data: из старых правок остаются просто текстом
const httpUrl = (u) => (/^https?:\/\//i.test(String(u ?? '')) ? String(u) : null);
const sceneList = () => S.board?.scenes ?? [];
const MAX_UPLOAD_MB = 300;
const MEDIA_EXT = ['.mp4', '.webm', '.mov', '.m4v', '.gif', '.png', '.jpg', '.jpeg', '.webp'];
const TYPE_EXT = {'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp', 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov'};
const extOf = (name) => (/\.[^.\\/]+$/.exec(name ?? '')?.[0] ?? '').toLowerCase();

// В поле стоит курсор и что-то набирается: страницу под ним не перерисовываем (фокус, выделение и набранное пропали бы)
function typingNow() {
  const a = document.activeElement;
  if (!a || !a.closest?.('#main')) return false;
  return a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'file', 'submit'].includes(a.type));
}
// Недописанный текст хранится по ключу и переживает перерисовку: ответ агента или правка из другого окна не стирают набранное
const draftKey = (k) => `${S.project}:${k}`;
const draftOf = (k) => S.drafts[draftKey(k)] ?? '';
const keepDraft = (el, k) => { el.value = draftOf(k); el.addEventListener('input', () => { S.drafts[draftKey(k)] = el.value; }); return el; };
const clearDraft = (k) => { delete S.drafts[draftKey(k)]; };
// Поля автосохранения (заметки): сохраняем через 0,6 с после ввода, сразу при уходе из поля и при закрытии страницы
const flushers = new Map(); // ключ поля -> сохранить сейчас; новое поле с тем же ключом заменяет старое
const flushAll = () => flushers.forEach((f) => f());
function autosave(el, save, key) {
  let tmr = null, dirty = false;
  const flush = () => { clearTimeout(tmr); tmr = null; if (!dirty) return; dirty = false; return save(el.value); };
  el.addEventListener('input', () => { dirty = true; clearTimeout(tmr); tmr = setTimeout(flush, 600); });
  el.addEventListener('blur', flush);
  flushers.set(key, flush);
  return flush;
}
// Недоступный сервер: плашка вверху, а не молчание. Данные на диске целы, страница сама оживёт, когда сервер вернётся.
let offline = false;
function setOffline(v) { offline = v; $('#offline').hidden = !v; }

async function api(path, body, {project = S.project} = {}) {
  const tok = S.token;
  let r;
  try {
    r = await fetch(`/api/${path}?project=${encodeURIComponent(project)}`, body ? {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body), keepalive: true} : undefined);
  } catch { setOffline(true); throw new Error('Нет связи с сервером доски. Запусти его снова (npm run board:open): сохранённые правки на месте, набранный текст останется в поле.'); }
  setOffline(false);
  let j = null;
  try { j = await r.json(); } catch { /* не JSON */ }
  if (!r.ok) throw new Error(j?.error || `Сервер ответил ${r.status}`);
  if (body && tok !== S.token) j.stale = true; // ответ пришёл уже после смены ролика: к новой доске он не относится
  return j;
}
// Загрузка файла на диск (вложение кадра, референс сцены). Размер и тип проверяются до отправки, ответ сервера читается с понятным текстом.
async function uploadFile(file, folder, name) {
  const ext = extOf(name) || TYPE_EXT[file.type] || '';
  if (!MEDIA_EXT.includes(ext)) throw new Error(`«${name || 'файл'}»: формат не подходит. Нужны mp4, webm, mov, gif, png, jpg, webp`);
  if (!file.size) throw new Error(`«${name || 'файл'}» пустой`);
  if (file.size > MAX_UPLOAD_MB * 1048576) throw new Error(`«${name}»: ${Math.round(file.size / 1048576)} МБ, а предел ${MAX_UPLOAD_MB} МБ. Сожми видео или добавь ссылкой.`);
  let r;
  try { r = await fetch(`/api/upload?project=${encodeURIComponent(S.project)}&frame=${encodeURIComponent(folder)}&name=${encodeURIComponent(name.includes('.') ? name : name + ext)}`, {method: 'POST', body: file}); } catch { setOffline(true); throw new Error('Нет связи с сервером доски, файл не загрузился. Запусти сервер снова и повтори.'); }
  let j = null;
  try { j = await r.json(); } catch { /* не JSON */ }
  if (!r.ok) throw new Error(j?.error || `не загрузилось (${r.status})`);
  return j.path;
}

// Новые данные правок. Берём только более свежие (ответ запоздавшего опроса не откатывает правку, которую автор только что сделал).
// Пока в поле идёт набор, данные запоминаются, а страница перерисуется сразу после ухода из поля.
const newer = (a, b) => {
  if (!a) return false;
  if (Number.isFinite(a.rev) && Number.isFinite(b?.rev)) return a.rev > b.rev || (a.rev !== b.rev && (a.updatedAt ?? '') > (b.updatedAt ?? '')); // нумерация могла начаться заново: тогда смотрим на время
  return (a.updatedAt ?? null) !== (b?.updatedAt ?? null);
};
// Перерисовка безопасна к повторам: у панели, сетки, ленты и каждой карточки сцены своя подпись данных, неизменившееся не трогается.
// Поэтому после каждого ответа сервера и каждого опроса вызывается renderAll даже когда номер правок тот же: карточка,
// которая изменилась в чужой записи, пришедшей вместе с нашим ответом, иначе осталась бы старой.
function applyReview(next, {own = false} = {}) {
  if (next && newer(next, S.review)) S.review = next;
  if (!own && typingNow()) { S.pendingRender = true; return; }
  renderAll();
}
// сохранить свежие данные, не перерисовывая страницу (автосохранение заметки: поле, в котором печатают, трогать нельзя)
const quiet = (j) => { if (!j.stale && j.review && newer(j.review, S.review)) S.review = j.review; };
function renderAll() {
  S.pendingRender = false;
  renderStats(); renderRibbon(); renderGrid(true); renderPanel({soft: true}); scenesUI.refresh();
}
async function op(name, payload, beforeRender) {
  const j = await api(name, payload);
  if (j.stale) return j;
  beforeRender?.(j);
  applyReview(j.review, {own: true});
  return j;
}
// раздел «Сцены» живёт в scenes.js; доска без сцен (старая сборка) просто не показывает его
const scenesUI = initScenes({S, $, h, api, media, toast, author, select, uploadFile, autosave, httpUrl, extOf, MEDIA_EXT, TYPE_EXT, quiet,
  flush: (key) => flushers.get(key)?.(),
  commit: (j) => { if (!j.stale) applyReview(j.review, {own: true}); }, pauseFilm: () => FILM?.pause(), refilter: () => { renderFilters(); scenesUI.paint(); renderGrid(); }});

async function boot() {
  let ps;
  try { ps = await (await fetch('/api/projects')).json(); } catch { setOffline(true); $('#grid').append(h('p', {class: 'empty'}, 'Сервер доски не отвечает. Запусти его: npm run board:open.')); setInterval(() => fetch('/api/projects').then(() => location.reload(), () => {}), 4000); return; }
  const sel = $('#project');
  sel.innerHTML = '';
  for (const p of ps) sel.append(h('option', {value: p.id}, p.title));
  if (!ps.length) { $('#grid').append(h('p', {class: 'empty'}, 'Досок пока нет. Попроси Claude: «собери доску для моего ролика» (файл videos/<проект>/storyboard/board.json).')); return; }
  const want = new URLSearchParams(location.search).get('project') || store.get('sb-project', ps[0].id);
  sel.value = ps.some((p) => p.id === want) ? want : ps[0].id;
  sel.onchange = () => load(sel.value).catch((e) => toast(e.message));
  $('#author').value = store.get('sb-author', 'Автор');
  $('#author').oninput = (e) => store.set('sb-author', e.target.value);
  $('#summaryBtn').onclick = openSummary;
  $('#helpBtn').onclick = openHelp;
  try { await load(sel.value); } catch (e) { $('#grid').append(h('p', {class: 'empty'}, `Доска не открылась: ${e.message}`)); toast(e.message); }
  if (store.get('sb-help-seen', '') !== '1') { openHelp(); store.set('sb-help-seen', '1'); }
  setInterval(refresh, 4000);
  document.addEventListener('keydown', keys);
  document.addEventListener('paste', onPaste);
  // после ухода из поля показываем то, что пришло, пока шёл набор
  document.addEventListener('focusout', () => setTimeout(() => { if (S.pendingRender && !typingNow()) renderAll(); }, 0));
  // закрытие вкладки: недосохранённая заметка уходит на сервер (keepalive доводит запрос после закрытия)
  window.addEventListener('pagehide', flushAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushAll(); });
  window.addEventListener('unhandledrejection', (e) => { toast(e.reason?.message || 'Что-то пошло не так'); e.preventDefault(); });
  // файл, брошенный мимо зоны сброса, не должен открываться вместо доски
  for (const ev of ['dragover', 'drop']) window.addEventListener(ev, (e) => { if ([...(e.dataTransfer?.types ?? [])].includes('Files')) e.preventDefault(); });
  // панель выбранного кадра держится у верхнего края, пока листаешь кадры: её высота равна высоте окна под лентой
  const main = $('#main');
  const setH = () => main.style.setProperty('--mainh', `${main.clientHeight}px`);
  new ResizeObserver(setH).observe(main); setH();
}
function adoptBoard(j, project) {
  S.project = project;
  S.board = j.board; S.review = j.review; S.version = j.version;
  S.board.frames ??= [];
  // формат кадра: board.aspect (ширина / высота), по умолчанию 16:9; вертикальные ролики (aspect < 1) получают свою раскладку
  const ar = Number(S.board.aspect) || (S.board.width && S.board.height ? S.board.width / S.board.height : 16 / 9);
  document.documentElement.style.setProperty('--ar', String(ar));
  document.body.classList.toggle('portrait', ar < 1);
  document.title = `${S.board.title ?? project} · ${BRAND_TITLE}`;
  if (!S.board.frames.some((f) => f.id === S.sel)) S.sel = S.board.frames[0]?.id ?? null;
  if (j.warning) toast(j.warning);
}
const BRAND_TITLE = document.title;
async function load(project) {
  flushAll(); flushers.clear(); // недосохранённая заметка прошлого ролика уходит на сервер до смены проекта
  const my = ++S.token;
  const j = await api('board', null, {project});
  if (my !== S.token) return; // пока грузилась эта доска, выбрали другую
  S.sel = store.get(`sb-sel-${project}`, null);
  adoptBoard(j, project);
  store.set('sb-project', project);
  S.replyOpen.clear(); S.pending = null; S.moveMode = false;
  S.panelSig = S.gridSig = S.ribbonSig = '';
  renderFilters(); renderStats(); renderRibbon(); renderGrid(); renderPanel();
  scenesUI.reset();
  scenesUI.paint();
  $('#main').scrollTop = 0;
}
// подтягиваем ответы агента и правки с другого окна; доску, пересобранную пока страница открыта, перечитываем целиком
async function refresh() {
  if (!S.project) return;
  const my = S.token, project = S.project;
  try {
    const j = await api('board', null, {project});
    if (my !== S.token || project !== S.project) return; // пока ждали ответ, выбрали другой ролик
    if (j.version !== S.version) {
      if (typingNow()) return; // пересборку покажем, когда автор отойдёт от поля
      const keepSel = S.sel;
      adoptBoard(j, project);
      if (S.board.frames.some((f) => f.id === keepSel)) S.sel = keepSel;
      S.panelSig = S.gridSig = S.ribbonSig = '';
      renderFilters(); renderStats(); renderRibbon(); renderGrid(true); renderPanel(); scenesUI.paint();
      toast('Доску пересобрали: клипы и кадры обновлены');
      return;
    }
    applyReview(j.review);
  } catch { /* связь вернётся сама: плашка уже показана */ }
}

const visible = () => S.board.frames.filter((f) => {
  const r = fr(f.id);
  if (S.filter === 'fix') return r.status === 'fix' || r.status === 'ask';
  if (S.filter === 'cmt') return (r.comments ?? []).some((c) => c.status !== 'resolved') || openMoves(r).length > 0;
  if (S.filter === 'ok') return r.status === 'ok';
  if (S.filter === 'none') return !r.status;
  return true;
});
function renderFilters() {
  const box = $('#filters');
  box.innerHTML = '';
  for (const [k, t] of [['all', 'Все'], ['none', 'Без оценки'], ['fix', 'Правки и вопросы'], ['cmt', 'Открытые комментарии'], ['ok', 'Нравится']]) {
    box.append(h('button', {class: `chip${S.filter === k ? ' on' : ''}`, 'aria-pressed': S.filter === k ? 'true' : 'false', onclick: () => { S.filter = k; renderFilters(); scenesUI.paint(); renderGrid(); }}, t));
  }
}
// правки к кадрам и сценам, которых после пересборки нет: на странице их не видно, поэтому считаем и показываем числом
function orphanCount() {
  const ids = new Set([...S.board.frames.map((f) => f.id), ...sceneList().map((s) => s.id)]);
  let n = 0;
  for (const [id, r] of [...Object.entries(S.review.frames ?? {}), ...Object.entries(S.review.scenes ?? {})]) {
    if (!ids.has(id)) n += (r.comments ?? []).filter((c) => c.status !== 'resolved').length + (r.moves ?? []).filter((m) => m.status !== 'resolved').length;
  }
  return n;
}
function renderStats() {
  const fs = S.board.frames, rs = fs.map((f) => fr(f.id));
  const open = rs.reduce((n, r) => n + openCmts(r).length, 0), mv = rs.reduce((n, r) => n + openMoves(r).length, 0);
  const sc = sceneList(), scOpen = sc.reduce((n, s) => n + scenesUI.openCount(s.id), 0), lost = orphanCount();
  const box = $('#stats');
  box.replaceChildren();
  const stat = (n, t, cls, title) => box.append(h('span', {class: cls ?? null, title: title ?? null}, h('b', {}, n), ` ${t}`));
  if (sc.length) { stat(sc.length, 'сцен'); stat(scOpen, 'комм. к сценам'); }
  stat(fs.length, 'кадров'); stat(rs.filter((r) => r.status === 'ok').length, 'нравится'); stat(rs.filter((r) => r.status === 'fix').length, 'правок');
  stat(open, 'открытых комментариев'); stat(mv, 'сдвигов');
  if (lost) stat(lost, 'к удалённым кадрам и сценам', 'warn', 'Эти правки остались в файле, но кадров и сцен с такими номерами в новой версии ролика нет. Агент увидит их командой board:read.');
}
function renderRibbon() {
  const sig = JSON.stringify([S.sel, S.version, sceneList().map((s) => [s.id, scenesUI.rv(s.id).rating, scenesUI.openCount(s.id)]), S.board.frames.map((f) => { const r = fr(f.id); return [f.id, r.status, openCmts(r).length + openMoves(r).length]; })]);
  if (sig === S.ribbonSig) return;
  S.ribbonSig = sig;
  const rb = $('#ribbon'), D = S.board.duration ?? S.board.frames.at(-1)?.t1 ?? 1;
  rb.innerHTML = '';
  rb.classList.toggle('has-scenes', sceneList().length > 0);
  const blocks = h('div', {class: 'blocks'}), segs = h('div', {class: 'segs'});
  for (const b of S.board.blocks ?? []) blocks.append(h('div', {class: 'blk', style: `left:${(b.t0 / D) * 100}%;width:${((b.t1 - b.t0) / D) * 100}%`}, b.name));
  const press = (fn) => (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };
  // дорожка сцен: клик ведёт к карточке сцены
  const scn = h('div', {class: 'scn'});
  for (const sc of sceneList()) {
    const r = scenesUI.rv(sc.id), n = scenesUI.openCount(sc.id), go = () => scenesUI.gotoScene(sc.id);
    scn.append(h('div', {class: 'sg', role: 'button', tabindex: '0', 'aria-label': `Сцена ${sc.id}: ${sc.title}, ${scenesUI.range(sc)}${n ? `, открытых комментариев ${n}` : ''}`, title: `${sc.id} · ${sc.title} · ${scenesUI.range(sc)}`,
      style: `left:${(sc.t0 / D) * 100}%;width:calc(${((sc.t1 - sc.t0) / D) * 100}% - 2px)`, onclick: go, onkeydown: press(go)},
      sc.id, r.rating ? h('span', {class: `st ${r.rating}`}) : null, n ? h('span', {class: 'cnt'}, n) : null));
  }
  for (const f of S.board.frames) {
    const r = fr(f.id), n = openCmts(r).length + openMoves(r).length, go = () => select(f.id, true);
    segs.append(h('div', {class: `seg${f.id === S.sel ? ' sel' : ''}`, role: 'button', tabindex: '0', 'aria-label': `Кадр ${f.id}: ${f.phrase ?? ''}`, title: `${f.id} · ${f.phrase}`, style: `left:${(f.t0 / D) * 100}%;width:calc(${((f.t1 - f.t0) / D) * 100}% - 2px)`, onclick: go, onkeydown: press(go)},
      f.img ? h('img', {src: media(f.img), loading: 'lazy', alt: ''}) : null, r.status ? h('span', {class: `st ${r.status}`}) : null, n ? h('span', {class: 'cnt'}, n) : null));
  }
  rb.append(...[blocks, sceneList().length ? scn : null, segs, h('div', {class: 'head', id: 'head', style: 'display:none'})].filter(Boolean)); // append(null) дописал бы слово «null»
}
function renderGrid(keepScroll) {
  const fs = visible();
  const sig = JSON.stringify([S.filter, S.version, fs.map((f) => { const r = fr(f.id); return [f.id, r.status, openCmts(r).length, openMoves(r).length, (r.attachments ?? []).filter((x) => !x.removed).length, (r.patterns ?? []).length, scenesUI.sceneOfFrame(f.id)]; })]);
  if (sig === S.gridSig) return;
  S.gridSig = sig;
  const g = $('#grid'), sc = $('#main'), top = sc.scrollTop; // прокручивается вся страница, а не сетка
  g.innerHTML = '';
  if (!fs.length) g.append(h('p', {class: 'empty'}, 'По этому фильтру кадров нет.'));
  const byBlock = [];
  for (const f of fs) { const last = byBlock.at(-1); if (last && last.name === f.block) last.frames.push(f); else byBlock.push({name: f.block, frames: [f]}); }
  for (const b of byBlock) {
    const cards = h('div', {class: 'cards'});
    for (const f of b.frames) {
      const r = fr(f.id), n = openCmts(r).length, a = (r.attachments ?? []).filter((x) => !x.removed).length, mvN = openMoves(r).length, sid = scenesUI.sceneOfFrame(f.id);
      const pick = () => select(f.id, {toPanel: true});
      cards.append(h('div', {class: `card${f.id === S.sel ? ' sel' : ''}`, id: `card-${f.id}`, role: 'button', tabindex: '0', 'aria-current': f.id === S.sel ? 'true' : null,
        'aria-label': `Кадр ${f.id}, ${tc(f.t0)}: ${f.phrase ?? ''}${r.status ? `, оценка: ${STATUS[r.status]}` : ''}${n ? `, открытых комментариев ${n}` : ''}`,
        onclick: pick, onkeydown: (e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pick(); } }},
        h('div', {class: 'thumb'}, f.img ? h('img', {src: media(f.img), loading: 'lazy', alt: ''}) : null, h('span', {class: 'id'}, f.id),
          sid ? h('button', {class: 'scb', title: `Кадр из сцены ${sid}: перейти к сцене`, 'aria-label': `Перейти к сцене ${sid}`, onclick: (e) => { e.stopPropagation(); scenesUI.gotoScene(sid); }}, sid) : null,
          h('span', {class: 'badges'}, n ? h('span', {class: 'badge hot'}, `💬 ${n}`) : null, mvN ? h('span', {class: 'badge hot'}, `↔ ${mvN}`) : null, a ? h('span', {class: 'badge'}, `📎 ${a}`) : null, (r.patterns ?? []).length ? h('span', {class: 'badge'}, `✦ ${r.patterns.length}`) : null),
          r.status ? h('span', {class: `st ${r.status}`}) : null),
        h('div', {class: 'meta'}, h('span', {class: 'tc'}, `${tc(f.t0)} – ${tc(f.t1)}`), h('span', {class: 'ph'}, f.phrase))));
    }
    g.append(h('div', {class: 'block'}, h('h2', {}, b.name, h('span', {}, `${b.frames.length} кадр.`)), cards));
  }
  if (keepScroll) sc.scrollTop = top;
}
// opts.toPanel: на узком экране панель кадра стоит под сеткой, клик по кадру ведёт к ней
function select(id, opts = {}) {
  S.sel = id;
  store.set(`sb-sel-${S.project}`, id);
  document.querySelectorAll('.card.sel, .seg.sel').forEach((el) => { el.classList.remove('sel'); el.removeAttribute('aria-current'); });
  const card = $(`#card-${CSS.escape(id)}`);
  card?.classList.add('sel'); card?.setAttribute('aria-current', 'true');
  renderRibbon();
  renderPanel();
  if (opts.toPanel && matchMedia('(max-width: 1100px)').matches) $('#panel').scrollIntoView({block: 'start', behavior: 'smooth'});
  else if (!opts.toPanel) $(`#card-${CSS.escape(id)}`)?.scrollIntoView({block: 'nearest', behavior: 'smooth'});
}
const cur = () => S.board.frames.find((f) => f.id === S.sel) ?? S.board.frames[0];
function playSeg(play = true) {
  const v = $('#vid'), f = cur();
  if (!v) return;
  v.currentTime = f.t0 + 0.02;
  if (play) { scenesUI.pauseAll(); v.play().catch(() => {}); }
}

let FILM = null;
function filmEl() {
  const src = media(S.board.film);
  if (FILM && FILM.dataset.src === src) return FILM;
  FILM = h('video', {id: 'vid', src, preload: 'auto', playsinline: true, 'aria-label': 'Фильм ролика: сегмент выбранного кадра'});
  FILM.dataset.src = src;
  FILM.addEventListener('play', () => scenesUI.pauseAll()); // фильм и клипы сцен не играют одновременно
  FILM.addEventListener('timeupdate', () => {
    const ff = cur();
    const t = FILM.currentTime;
    const pt = $('#ptime');
    if (pt) pt.textContent = `${tc(t)} / сегмент ${tc(ff.t0)}–${tc(ff.t1)}`;
    const D = S.board.duration ?? 1, head = $('#head');
    if (head) { head.style.display = 'block'; head.style.left = `calc(18px + (100% - 36px) * ${t / D})`; }
    if (t >= ff.t1 - 0.02 && !FILM.paused) { if (S.loop) FILM.currentTime = ff.t0 + 0.02; else FILM.pause(); }
  });
  // последний кадр ролика: фильм доходит до конца раньше, чем сработает проверка границы
  FILM.addEventListener('ended', () => { if (S.loop) { FILM.currentTime = cur().t0 + 0.02; FILM.play().catch(() => {}); } });
  return FILM;
}
function renderPanel({soft = false, force = false} = {}) {
  const p = $('#panel'), f = cur();
  if (!f) { p.replaceChildren(h('p', {class: 'empty', style: 'padding:16px'}, 'На доске нет кадров.')); return; }
  const r = fr(f.id);
  // перерисовываем только когда поменялось то, что видно в панели; иначе кнопка, на которую нажали, теряла бы фокус
  const sig = JSON.stringify([f.id, r, S.moveMode, S.pending, [...S.replyOpen], S.version]);
  if (soft && !force && sig === S.panelSig) return;
  const sameFrame = S.panelSig.startsWith(`["${f.id}"`);
  S.panelSig = sig;
  flushAll(); // недосохранённая заметка уходит на сервер до того, как поле исчезнет
  // при фоновом обновлении не трогаем видео, если оно играет; позицию прокрутки панели сохраняем
  const v0 = $('#vid');
  const keepTime = soft && v0 ? v0.currentTime : null;
  const wasPlaying = soft && v0 && !v0.paused;
  const scrollTop = sameFrame ? p.scrollTop : 0;
  p.innerHTML = '';
  const body = h('div', {class: `pbody${S.moveMode ? ' moving' : ''}`});
  const i = S.board.frames.indexOf(f);
  const sid = scenesUI.sceneOfFrame(f.id);
  body.append(h('div', {class: 'phead'}, h('h1', {}, f.id), h('span', {class: 'tc'}, `${tc(f.t0)} – ${tc(f.t1)} · ${f.block}`),
    sid ? h('button', {class: 'scb', title: 'Перейти к сцене, в которую входит кадр', onclick: () => scenesUI.gotoScene(sid)}, `сцена ${sid}`) : null,
    h('div', {class: 'nav'}, h('button', {class: 'btn sm', onclick: () => i > 0 && select(S.board.frames[i - 1].id, true), title: 'Предыдущий кадр (←)', 'aria-label': 'Предыдущий кадр'}, '←'),
      h('button', {class: 'btn sm', onclick: () => i < S.board.frames.length - 1 && select(S.board.frames[i + 1].id, true), title: 'Следующий кадр (→)', 'aria-label': 'Следующий кадр'}, '→'))));
  // плеер: один элемент видео на всю сессию: при смене кадра только перемотка, фильм не перезагружается.
  // В режиме «Сдвиг» (и когда фильма нет) вместо видео стоит картинка кадра со стрелками: по ней тянут новую стрелку.
  const player = h('div', {class: 'player'});
  const stillMode = !!f.img && (S.moveMode || !S.board.film);
  if (stillMode) {
    player.append(stageEl(f, r, S.moveMode));
  } else if (S.board.film) {
    const vid = filmEl();
    player.append(vid);
    if (!soft) { if (vid.readyState >= 1) vid.currentTime = f.t0 + 0.02; else vid.addEventListener('loadedmetadata', () => (vid.currentTime = cur().t0 + 0.02), {once: true}); }
    else if (keepTime != null && wasPlaying) vid.play().catch(() => {});
  } else if (f.img) player.append(h('img', {src: media(f.img), alt: `Кадр ${f.id}`}));
  const ptop = h('div', {class: 'ptop'}), pl = h('div', {class: 'pl'}), pr = h('div', {class: 'pr'});
  pl.append(player);
  if (f.img) pl.append(h('div', {class: 'pctrl'},
    h('button', {class: `btn sm${S.moveMode ? ' gold' : ''}`, 'aria-pressed': S.moveMode ? 'true' : 'false', title: 'Показать картинку кадра и поставить стрелку: что и куда подвинуть', onclick: () => { S.moveMode = !S.moveMode; S.pending = null; renderPanel(); }}, '↔ Сдвиг объектов'),
    S.moveMode ? h('span', {class: 'hint'}, 'Нажми на объект и тяни к новому месту') : null));
  if (S.board.film && !stillMode) pr.append(h('div', {class: 'pctrl'},
    h('button', {class: 'btn gold sm', onclick: () => playSeg(true)}, '▶ Сегмент'),
    h('button', {class: 'btn sm', onclick: () => { const v = $('#vid'); v.paused ? v.play() : v.pause(); }}, 'Пауза / дальше'),
    h('label', {class: 'pctrl'}, h('input', {type: 'checkbox', checked: S.loop, onchange: (e) => (S.loop = e.target.checked)}), 'по кругу'),
    h('span', {class: 'time', id: 'ptime'}, '')));
  pr.append(h('div', {class: 'phrase'}, `«${f.phrase}»`));
  const kv = h('dl', {class: 'kv'});
  const row = (k, v) => v && kv.append(h('dt', {}, k), h('dd', {}, v));
  row('Что в кадре', f.see); row('Движение', f.motion);
  if (f.transition) row('Переход →', h('span', {}, h('b', {}, f.transition.type), f.transition.dur ? ` · ${f.transition.dur}` : '', f.transition.why ? ` · ${f.transition.why}` : ''));
  row('Звук', f.sound); row('Вставки', (f.inserts ?? []).map((x) => `${x.what}: ${x.src}`).join('; ')); row('Текст в кадре', f.text);
  if (kv.children.length) pr.append(kv);
  ptop.append(pl, pr);
  body.append(ptop);
  body.append(movesSection(f, r));

  // оценка и заметка
  const st = h('div', {class: 'status'});
  for (const [k, t] of Object.entries(STATUS)) st.append(h('button', {class: `${k}${r.status === k ? ' on' : ''}`, 'aria-pressed': r.status === k ? 'true' : 'false', onclick: () => op('frame', {frame: f.id, patch: {status: r.status === k ? null : k}}).catch((e) => toast(e.message))}, t));
  const note = h('textarea', {placeholder: 'Заметка к кадру: что поменять, что оставить…', 'aria-label': 'Заметка к кадру', maxlength: '8000'});
  note.value = r.note ?? '';
  autosave(note, (text) => api('frame', {frame: f.id, patch: {note: text}}).then((j) => { quiet(j); const ns = $('#noteSaved'); if (ns) ns.textContent = 'сохранено'; }).catch((e) => toast(e.message)), 'frame-note');
  body.append(h('div', {class: 'sec'}, h('h3', {}, 'Оценка'), st, note, h('span', {class: 'saved', id: 'noteSaved'}, r.updatedAt ? `изменено ${new Date(r.updatedAt).toLocaleString('ru')}` : '')));

  // ветка комментариев
  const roots = (r.comments ?? []).filter((c) => !c.parent);
  const thread = h('div', {class: 'thread'});
  const cmtEl = (c, reply) => {
    const rkey = `${f.id}:${c.id}`;
    const el = h('div', {class: `cmt${reply ? ' reply' : ''}${c.status === 'resolved' ? ' resolved' : ''}`},
      h('div', {class: 'who'}, h('b', {class: /claude|агент|codex/i.test(c.author) ? 'agent' : null}, c.author), h('span', {}, c.createdAt ? new Date(c.createdAt).toLocaleString('ru', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}) : ''),
        c.at != null ? h('button', {class: 'at', title: 'Перейти к моменту', onclick: () => { const v = $('#vid'); if (v) { v.currentTime = c.at; scenesUI.pauseAll(); v.play().catch(() => {}); } }}, `⏱ ${tc(c.at)}`) : null,
        c.status === 'resolved' ? h('span', {}, '· решено') : null),
      h('div', {class: 'txt'}, c.text),
      h('div', {class: 'acts'},
        !reply ? h('button', {onclick: () => { S.replyOpen.has(rkey) ? S.replyOpen.delete(rkey) : S.replyOpen.add(rkey); renderPanel({force: true}); $(`[data-reply="${CSS.escape(rkey)}"] textarea`)?.focus(); }}, 'Ответить') : null,
        h('button', {onclick: () => op('comment-status', {frame: f.id, id: c.id, status: c.status === 'resolved' ? 'open' : 'resolved'}).catch((e) => toast(e.message))}, c.status === 'resolved' ? 'Открыть снова' : 'Решено')));
    return el;
  };
  for (const c of roots) {
    thread.append(cmtEl(c, false));
    for (const rp of (r.comments ?? []).filter((x) => x.parent === c.id)) thread.append(cmtEl(rp, true));
    const rkey = `${f.id}:${c.id}`;
    if (S.replyOpen.has(rkey)) thread.append(replyBox(f, c, rkey));
  }
  if (!roots.length) thread.append(h('span', {class: 'empty'}, 'Комментариев пока нет.'));
  const ta = keepDraft(h('textarea', {placeholder: 'Комментарий к кадру. Ctrl+Enter: отправить', 'aria-label': 'Новый комментарий к кадру', maxlength: '8000'}), `cmt:${f.id}`);
  const withTime = h('input', {type: 'checkbox', checked: true});
  const sendKey = `cmt:${f.id}`;
  const sendC = async () => {
    const text = ta.value.trim();
    if (!text || S.busy.has(sendKey)) return;
    S.busy.add(sendKey); sendBtn.disabled = true;
    const v = $('#vid');
    try {
      await op('comment', {frame: f.id, text, author: author(), at: withTime.checked && v ? Math.round(v.currentTime * 100) / 100 : null}, () => clearDraft(sendKey));
      toast('Комментарий сохранён');
      $('#panel .compose:not([data-reply]) > textarea')?.focus();
    } catch (e) { toast(e.message); } finally { S.busy.delete(sendKey); sendBtn.disabled = false; }
  };
  const sendBtn = h('button', {class: 'btn gold sm', onclick: sendC}, 'Отправить');
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendC(); } });
  body.append(h('div', {class: 'sec'}, h('h3', {}, 'Комментарии', h('span', {class: 'n'}, roots.length || '')), thread,
    h('div', {class: 'compose'}, ta, h('div', {class: 'row'}, sendBtn, h('label', {}, withTime, 'привязать к моменту видео')))));

  // вложения: скриншоты и видео эффектов
  const atts = h('div', {class: 'atts'});
  for (const a of (r.attachments ?? []).filter((x) => !x.removed)) {
    const url = media(a.path);
    atts.append(h('div', {class: 'att', title: a.name},
      a.kind === 'video' ? h('video', {src: url, muted: true, loop: true, playsinline: true, preload: 'metadata', 'aria-label': a.label || a.name, onmouseenter: (e) => e.target.play().catch(() => {}), onmouseleave: (e) => e.target.pause()})
        : h('img', {src: url, alt: a.label || a.name || 'Вложение', tabindex: '0', onclick: () => window.open(url, '_blank', 'noopener'), onkeydown: (e) => { if (e.key === 'Enter') window.open(url, '_blank', 'noopener'); }}),
      h('span', {class: 'lbl'}, a.label || a.name), h('button', {class: 'x', title: 'Убрать вложение', 'aria-label': `Убрать вложение ${a.label || a.name || ''}`, onclick: () => op('attach-remove', {frame: f.id, id: a.id}).catch((e) => toast(e.message))}, '×')));
  }
  const pick = h('input', {type: 'file', multiple: true, accept: 'image/*,video/*', style: 'display:none', onchange: (e) => { upFiles([...e.target.files], f.id); e.target.value = ''; }});
  const drop = h('div', {class: 'drop'}, 'Перетащи сюда скриншоты или видео эффектов, вставь из буфера (Ctrl+V) или ', h('a', {href: '#', onclick: (e) => { e.preventDefault(); pick.click(); }}, 'выбери файлы'), pick);
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); upFiles([...e.dataTransfer.files], f.id); });
  body.append(h('div', {class: 'sec'}, h('h3', {}, 'Вложения', h('span', {class: 'n'}, atts.children.length || '')), atts.children.length ? atts : null, drop));

  // ссылки: добавляются и убираются по одной, поэтому две вкладки не затирают ссылки друг друга
  const links = h('div', {class: 'links'});
  for (const l of r.links ?? []) {
    const href = httpUrl(l.url);
    links.append(h('div', {class: 'pill'}, href ? h('a', {href, target: '_blank', rel: 'noopener noreferrer'}, l.label || l.url) : h('span', {title: 'Не http-ссылка: не открывается'}, l.label || l.url),
      h('button', {title: 'Убрать ссылку', 'aria-label': `Убрать ссылку ${l.label || l.url}`, onclick: () => op('link-remove', l.id ? {frame: f.id, id: l.id} : {frame: f.id, url: l.url, label: l.label ?? ''}).catch((e) => toast(e.message))}, '×')));
  }
  const lu = keepDraft(h('input', {placeholder: 'https://… ссылка на референс', 'aria-label': 'Ссылка на референс'}), `link:${f.id}`), ll = keepDraft(h('input', {placeholder: 'подпись', 'aria-label': 'Подпись ссылки'}), `linklabel:${f.id}`);
  const addLink = async () => {
    if (!lu.value.trim()) return;
    try { await op('link-add', {frame: f.id, url: lu.value.trim(), label: ll.value.trim()}, () => { clearDraft(`link:${f.id}`); clearDraft(`linklabel:${f.id}`); }); toast('Ссылка добавлена'); } catch (e) { toast(e.message); }
  };
  lu.addEventListener('keydown', (e) => { if (e.key === 'Enter') addLink(); });
  body.append(h('div', {class: 'sec'}, h('h3', {}, 'Ссылки'), links, h('div', {class: 'compose'}, h('div', {class: 'row'}, lu, ll, h('button', {class: 'btn sm', onclick: addLink}, 'Добавить')))));

  // паттерны и референсы
  const pp = h('div', {class: 'pills'});
  for (const code of r.patterns ?? []) {
    const pt = (S.board.patterns ?? []).find((x) => x.code === code);
    pp.append(h('span', {class: 'pill', title: pt?.how ?? ''}, pt?.img ? h('img', {src: media(pt.img), alt: ''}) : null, `${code} ${pt?.name ?? ''}`,
      h('button', {'aria-label': `Убрать паттерн ${code}`, title: 'Убрать паттерн', onclick: () => op('pattern-remove', {frame: f.id, code}).catch((e) => toast(e.message))}, '×')));
  }
  const rp = h('div', {class: 'pills'});
  for (const rf of r.refs ?? []) {
    const R = (S.board.refs ?? []).find((x) => x.id === rf.id);
    rp.append(h('span', {class: 'pill'}, R?.img ? h('img', {src: media(R.img), alt: ''}) : null, `${rf.id}${rf.time ? ` · ${rf.time}` : ''}${rf.note ? ` · ${rf.note}` : ''}`,
      h('button', {'aria-label': `Убрать референс ${rf.id}`, title: 'Убрать референс', onclick: () => op('ref-remove', rf.uid ? {frame: f.id, uid: rf.uid} : {frame: f.id, ref: rf.id, time: rf.time ?? '', note: rf.note ?? ''}).catch((e) => toast(e.message))}, '×')));
  }
  // паттерны и референсы необязательны: блоки видны, только если они есть в board.json (patterns[], refs[]) или уже выбраны в кадре
  if ((S.board.patterns ?? []).length || (r.patterns ?? []).length) body.append(h('div', {class: 'sec'}, h('h3', {}, 'Паттерны монтажа', h('span', {class: 'n'}, (r.patterns ?? []).length || '')), pp,
    (S.board.patterns ?? []).length ? h('div', {class: 'row'}, h('button', {class: 'btn sm', onclick: () => openPatterns(f.id)}, '+ Паттерн')) : null));
  if ((S.board.refs ?? []).length || (r.refs ?? []).length) {
    const refSel = h('select', {'aria-label': 'Референс'}, ...(S.board.refs ?? []).map((R) => h('option', {value: R.id}, `${R.id} · ${R.title}`)));
    const refT = h('input', {placeholder: 'время, напр. 4,4–4,6 с', style: 'width:150px', 'aria-label': 'Время в референсе'}), refN = h('input', {placeholder: 'что взять', 'aria-label': 'Что взять'});
    body.append(h('div', {class: 'sec'}, h('h3', {}, 'Референсы'), rp, (S.board.refs ?? []).length ? h('div', {class: 'compose'}, h('div', {class: 'row'}, refSel, refT, refN,
      h('button', {class: 'btn sm', onclick: () => op('ref-add', {frame: f.id, ref: refSel.value, time: refT.value.trim(), note: refN.value.trim()}).catch((e) => toast(e.message))}, 'Добавить'))) : null));
  }
  p.append(body);
  p.scrollTop = scrollTop;
}
// поле ответа на комментарий; черновик живёт в S.drafts, поэтому перерисовка его не стирает
function replyBox(f, c, rkey) {
  const ta = keepDraft(h('textarea', {placeholder: 'Ответ… Ctrl+Enter: отправить', 'aria-label': 'Ответ на комментарий', maxlength: '8000'}), `reply:${rkey}`);
  const key = `reply:${rkey}`;
  const send = async () => {
    const text = ta.value.trim();
    if (!text || S.busy.has(key)) return;
    S.busy.add(key);
    try { await op('comment', {frame: f.id, text, author: author(), parent: c.id}, () => { clearDraft(key); S.replyOpen.delete(rkey); }); toast('Ответ сохранён'); } catch (e) { toast(e.message); } finally { S.busy.delete(key); }
  };
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } });
  return h('div', {class: 'compose', 'data-reply': rkey, style: 'margin-left:22px'}, ta, h('div', {class: 'row'}, h('button', {class: 'btn gold sm', onclick: send}, 'Ответить'),
    h('button', {class: 'btn sm', onclick: () => { S.replyOpen.delete(rkey); renderPanel({force: true}); }}, 'Отмена')));
}
// ── сдвиги объектов: стрелка от объекта к новому месту, координаты в долях кадра (0..1 от левого верхнего угла) ──
const SVGNS = 'http://www.w3.org/2000/svg';
const svgEl = (name, attrs = {}) => { const e = document.createElementNS(SVGNS, name); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
// кадр-картинка со стрелками; drawing = режим «Сдвиг»: по картинке можно тянуть мышкой новую стрелку
function stageEl(f, r, drawing) {
  const stage = h('div', {class: `stage${drawing ? ' draw' : ''}`}, h('img', {src: media(f.img), draggable: 'false', alt: `Кадр ${f.id}`}));
  const svg = svgEl('svg', {class: 'mvsvg', 'aria-hidden': 'true'});
  stage.append(svg);
  let drag = null;
  const arrow = (a, b, o) => {
    const x1 = a.x * stage.clientWidth, y1 = a.y * stage.clientHeight, x2 = b.x * stage.clientWidth, y2 = b.y * stage.clientHeight;
    const ang = Math.atan2(y2 - y1, x2 - x1), L = o.head ?? 15;
    const hx = (k) => x2 - L * Math.cos(ang + k), hy = (k) => y2 - L * Math.sin(ang + k);
    const head = `${x2},${y2} ${hx(0.42)},${hy(0.42)} ${hx(-0.42)},${hy(-0.42)}`;
    const ex = x2 - 0.7 * L * Math.cos(ang), ey = y2 - 0.7 * L * Math.sin(ang);
    const g = svgEl('g', {class: o.cls ?? ''});
    if (o.title) { const t = svgEl('title'); t.textContent = o.title; g.append(t); }
    const dash = o.dash ? {'stroke-dasharray': '2 9'} : {};
    // тёмная подложка под светлой линией: стрелка читается и на светлом, и на тёмном кадре
    g.append(svgEl('line', {x1, y1, x2: ex, y2: ey, stroke: 'rgba(12,9,7,.85)', 'stroke-width': 7, 'stroke-linecap': 'round', ...dash}));
    g.append(svgEl('polygon', {points: head, fill: 'rgba(12,9,7,.85)', stroke: 'rgba(12,9,7,.85)', 'stroke-width': 4, 'stroke-linejoin': 'round'}));
    g.append(svgEl('line', {x1, y1, x2: ex, y2: ey, stroke: o.color, 'stroke-width': 3, 'stroke-linecap': 'round', ...dash}));
    g.append(svgEl('polygon', {points: head, fill: o.color}));
    if (o.n != null) {
      g.append(svgEl('circle', {cx: x1, cy: y1, r: 11, fill: o.color, stroke: 'rgba(12,9,7,.85)', 'stroke-width': 2}));
      const t = svgEl('text', {x: x1, y: y1 + 4, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 800, fill: '#2A211C'});
      t.textContent = String(o.n);
      g.append(t);
    }
    if (o.tag) {
      const t = svgEl('text', {x: x2 + 8, y: y2 - 8, 'font-size': 12, 'font-weight': 800, fill: o.color, stroke: 'rgba(12,9,7,.9)', 'stroke-width': 3, 'paint-order': 'stroke'});
      t.textContent = o.tag;
      g.append(t);
    }
    svg.append(g);
  };
  const paint = () => {
    const w = stage.clientWidth, hh = stage.clientHeight;
    if (!w || !hh) return;
    svg.setAttribute('viewBox', `0 0 ${w} ${hh}`); svg.setAttribute('width', w); svg.setAttribute('height', hh);
    svg.replaceChildren();
    (r.moves ?? []).forEach((m, k) => arrow(m.from, m.to, {n: k + 1, color: m.status === 'resolved' ? 'rgba(251,243,228,.5)' : '#FFD58A', cls: m.status === 'resolved' ? 'done' : '',
      title: `${k + 1}. ${m.label || 'без подписи'}`, tag: scaleTxt(m.scale)}));
    if (S.pending?.frame === f.id) arrow(S.pending.from, S.pending.to, {color: '#8FB4E8', dash: true, head: 17});
    if (drag) arrow(drag.from, drag.to, {color: '#FFD58A', dash: true, head: 17});
  };
  new ResizeObserver(paint).observe(stage);
  stage.querySelector('img').addEventListener('load', paint);
  if (drawing) {
    const pt = (e) => { const b = stage.getBoundingClientRect(); return {x: Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)), y: Math.min(1, Math.max(0, (e.clientY - b.top) / b.height))}; };
    stage.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      stage.setPointerCapture(e.pointerId);
      const p = pt(e);
      drag = {from: p, to: p};
      paint();
    });
    stage.addEventListener('pointermove', (e) => { if (drag) { drag.to = pt(e); paint(); } });
    stage.addEventListener('pointerup', (e) => {
      if (!drag) return;
      const {from} = drag, to = pt(e);
      drag = null;
      // короче 40 px кадра композиции считаем случайным кликом
      if (Math.hypot((to.x - from.x) * FW(), (to.y - from.y) * FH()) < 40) { paint(); toast('Стрелка слишком короткая: потяни от объекта к новому месту'); return; }
      S.pending = {frame: f.id, from, to};
      renderPanel();
    });
    stage.addEventListener('pointercancel', () => { drag = null; paint(); });
  }
  return stage;
}
// блок «Сдвиги объектов» под плеером: форма новой стрелки (подпись и размер) и список стрелок кадра
function movesSection(f, r) {
  const list = h('div', {class: 'mvlist'});
  (r.moves ?? []).forEach((m, k) => {
    const done = m.status === 'resolved';
    list.append(h('div', {class: `mv${done ? ' resolved' : ''}`},
      h('span', {class: 'num'}, k + 1),
      h('div', {class: 'mvtxt'}, h('b', {}, m.label || 'без подписи'),
        h('span', {}, `из ${ptxt(m.from)} в ${ptxt(m.to)} px${m.scale ? ` · ${scaleTxt(m.scale)}` : ''}${done ? ' · решено' : ''}`)),
      h('button', {class: 'lnk', onclick: () => op('move-status', {frame: f.id, id: m.id, status: done ? 'open' : 'resolved'}).catch((e) => toast(e.message))}, done ? 'Открыть снова' : 'Решено'),
      h('button', {class: 'lnk', 'aria-label': `Удалить сдвиг ${k + 1}`, onclick: () => op('move-remove', {frame: f.id, id: m.id}).catch((e) => toast(e.message))}, 'Удалить')));
  });
  let form = null;
  if (S.pending?.frame === f.id) {
    const label = keepDraft(h('input', {placeholder: 'Что двигаем: например, телефон или заголовок', 'aria-label': 'Что двигаем', style: 'flex:1;min-width:200px', maxlength: '400'}), `move:${f.id}`);
    const size = h('select', {'aria-label': 'Размер объекта'}, ...SCALES.map(([v, t]) => h('option', {value: v}, t)));
    size.value = S.pending.scale ?? '';
    size.addEventListener('change', () => { if (S.pending) S.pending.scale = size.value; });
    const save = async () => {
      const p = S.pending;
      if (!p || S.busy.has('move')) return;
      S.busy.add('move');
      try {
        await op('move', {frame: p.frame, from: p.from, to: p.to, label: label.value, scale: size.value || null, author: author()}, () => { S.pending = null; clearDraft(`move:${f.id}`); });
        toast('Стрелка сохранена');
      } catch (e) { toast(e.message); } finally { S.busy.delete('move'); }
    };
    label.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    form = h('div', {class: 'compose mvform'}, h('div', {class: 'phrase small'}, `Новая стрелка: из ${ptxt(S.pending.from)} в ${ptxt(S.pending.to)} px`),
      h('div', {class: 'row'}, label, size),
      h('div', {class: 'row'}, h('button', {class: 'btn gold sm', onclick: save}, 'Сохранить стрелку'),
        h('button', {class: 'btn sm', onclick: () => { S.pending = null; renderPanel(); }}, 'Отмена')));
    setTimeout(() => label.focus(), 0);
  }
  const hintText = S.moveMode ? 'Протяни стрелку по кадру: от объекта к тому месту, куда его нужно поставить.' : 'Нажми «↔ Сдвиг объектов» под кадром и протяни стрелку от объекта к новому месту.';
  return h('div', {class: 'sec mvsec'}, h('h3', {}, 'Сдвиги объектов', h('span', {class: 'n'}, (r.moves ?? []).length || '')), form,
    list.children.length ? list : (form ? null : h('span', {class: 'empty'}, hintText)));
}
async function upFiles(files, frame) {
  let ok = 0;
  const tok = S.token; // ролик сменили посреди загрузки: остальные файлы не должны уйти в чужую доску
  for (const file of files) {
    if (tok !== S.token) break;
    const name = file.name || `вставка${TYPE_EXT[file.type] ?? '.png'}`;
    try {
      toast(`Загружаю ${name}…`);
      const path = await uploadFile(file, frame, name);
      if (tok !== S.token) break;
      await op('attach', {frame, path, name, author: author()});
      ok++;
    } catch (e) { toast(e.message); }
  }
  if (ok) toast(ok > 1 ? `Загружено ${ok}` : 'Вложение сохранено');
}
function onPaste(e) {
  if (!S.board) return;
  if (scenesUI.paste(e)) return; // файл из буфера над карточкой сцены это референс этой сцены
  if (!S.sel || /textarea|input/i.test(document.activeElement?.tagName ?? '')) return;
  const files = [...(e.clipboardData?.files ?? [])];
  if (files.length) { e.preventDefault(); upFiles(files, S.sel); }
}
// Клавиши листания живут только там, где они не отнимают родные: пробел и Enter на кнопке нажимают кнопку, стрелки в поле двигают курсор,
// под открытым окном страница не листается, с Ctrl, Alt и Cmd клавиши остаются браузеру.
function keys(e) {
  if (!S.board) return;
  const modalOpen = !$('#modal').hidden;
  if (e.key === 'Escape') {
    if (modalOpen) { closeModal(); e.preventDefault(); return; }
    if (S.pending) { S.pending = null; renderPanel(); }
    return;
  }
  if (modalOpen || e.ctrlKey || e.metaKey || e.altKey) return;
  const a = document.activeElement;
  if (/^(textarea|input|select|video|audio)$/i.test(a?.tagName ?? '') || a?.isContentEditable) return;
  if (a?.closest?.('.scene')) return; // пробел и стрелки у плеера сцены его собственные
  const control = /^(button|a|summary)$/i.test(a?.tagName ?? '') || a?.getAttribute?.('role') === 'button';
  const i = S.board.frames.findIndex((f) => f.id === S.sel);
  if (e.key === 'ArrowRight' && i < S.board.frames.length - 1) { select(S.board.frames[i + 1].id, true); e.preventDefault(); }
  if (e.key === 'ArrowLeft' && i > 0) { select(S.board.frames[i - 1].id, true); e.preventDefault(); }
  if (e.key === ' ' && !control) { const v = $('#vid'); if (v) { v.paused ? playSeg(true) : v.pause(); e.preventDefault(); } }
}

// окна: паттерны и сводка правок. Окно перехватывает Tab, закрывается по Escape и возвращает фокус туда, откуда открыто.
let lastFocus = null;
const closeModal = () => { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; m.onkeydown = null; lastFocus?.focus?.(); lastFocus = null; };
function modal(title, content, extra) {
  const m = $('#modal');
  if (m.hidden) lastFocus = document.activeElement;
  m.innerHTML = '';
  const id = 'mtitle';
  const box = h('div', {class: 'mbox', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': id, tabindex: '-1'},
    h('div', {class: 'mhead'}, h('h2', {id}, title), extra ?? null, h('button', {class: 'btn sm', onclick: closeModal}, 'Закрыть')), h('div', {class: 'mbody'}, content));
  m.append(box);
  m.hidden = false;
  m.onclick = (e) => e.target === m && closeModal();
  m.onkeydown = (e) => {
    if (e.key !== 'Tab') return;
    const f = [...box.querySelectorAll('a[href], button:not([disabled]), input:not([type=hidden]), select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f.at(-1);
    if (e.shiftKey && (document.activeElement === first || document.activeElement === box)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  (box.querySelector('.mhead .btn') ?? box).focus();
}
function openPatterns(frame) {
  const r = fr(frame), chosen = new Set(r.patterns ?? []);
  const q = h('input', {placeholder: 'поиск: портал, стаккато, счётчик…', 'aria-label': 'Поиск паттерна', style: 'width:280px'});
  const grid = h('div', {class: 'pgrid'});
  const draw = () => {
    grid.innerHTML = '';
    const s = q.value.trim().toLowerCase();
    for (const pt of S.board.patterns ?? []) {
      if (s && !`${pt.code} ${pt.name} ${pt.how ?? ''} ${pt.where ?? ''}`.toLowerCase().includes(s)) continue;
      grid.append(h('button', {class: `pcard${chosen.has(pt.code) ? ' on' : ''}`, 'aria-pressed': chosen.has(pt.code) ? 'true' : 'false', onclick: () => { chosen.has(pt.code) ? chosen.delete(pt.code) : chosen.add(pt.code); draw(); }},
        pt.img ? h('img', {src: media(pt.img), loading: 'lazy', alt: ''}) : null, h('span', {class: 'pt'}, h('b', {}, `${pt.code} · ${pt.name}`), h('span', {}, pt.how ?? ''), h('span', {}, pt.where ?? ''))));
    }
  };
  q.oninput = draw; draw();
  modal('Паттерны монтажа', grid, h('div', {class: 'row', style: 'display:flex;gap:8px'}, q,
    h('button', {class: 'btn gold sm', onclick: async () => {
      const had = new Set(r.patterns ?? []);
      closeModal();
      try {
        for (const c of chosen) if (!had.has(c)) await op('pattern-add', {frame, code: c});
        for (const c of had) if (!chosen.has(c)) await op('pattern-remove', {frame, code: c});
      } catch (e) { toast(e.message); }
    }}, 'Готово')));
}
function openHelp() {
  const step = (n, t, d) => h('div', {style: 'display:flex;gap:14px;align-items:flex-start'}, h('span', {style: 'flex:none;width:34px;height:34px;border-radius:50%;background:var(--gold);color:#2A211C;display:grid;place-items:center;font:700 15px var(--head)'}, n),
    h('div', {}, h('b', {style: 'font-size:15px'}, t), h('div', {style: 'color:var(--muted);margin-top:3px'}, d)));
  modal('Как работать с доской', h('div', {style: 'display:flex;flex-direction:column;gap:16px;max-width:760px'},
    sceneList().length ? step('С', 'Сначала сцены', 'Сверху куски ролика по несколько секунд: нажми ▶ и смотри, как работает анимация (звук включается кнопкой «Звук», скорость 0,5× замедляет). Под клипом пиши, что не так: «Текст», «Анимация», «Тайминг», «Звук». Кнопка «⏱ Отметить момент» запоминает секунду, на которой стоит клип, а клик по метке в комментарии перематывает клип. Референс нужной анимации перетащи на карточку сцены, вставь из буфера (Ctrl+V) или добавь ссылкой, и напиши, что из него взять: движение, шрифт, переход, темп.') : null,
    step(1, sceneList().length ? 'Потом кадры: выбери кадр' : 'Выбери кадр', 'Кликни карточку или отрезок на ленте сверху. Справа фильм проиграет ровно этот кадр (кнопка «▶ Сегмент», стрелки ← → листают кадры).'),
    step(2, 'Оцени', '«Нравится», «Нужна правка» или «Вопрос». Цвет оценки виден на карточке и на ленте.'),
    step(3, 'Напиши комментарий', 'Что поменять. Галочка «привязать к моменту» запоминает секунду видео: Claude увидит, о каком месте речь. Ctrl+Enter отправляет.'),
    step(4, 'Покажи, как надо', 'Перетащи скриншот или видео эффекта в блок «Вложения» или вставь из буфера (Ctrl+V). Файл до 300 МБ. Можно добавить ссылку. Если в доске есть паттерны и референсы, их тоже можно прикрепить.'),
    step(5, 'Подвинь объект стрелкой', 'Нажми «↔ Сдвиг объектов» под кадром, протяни стрелку от объекта к новому месту, напиши подпись (что двигаем) и при желании «крупнее» или «мельче». Стрелок может быть несколько, любую можно удалить.'),
    step(6, 'Напиши Claude «оставил комментарии»', 'Он прочитает все правки и сдвиги (в пикселях кадра), переделает монтаж и ответит в тех же ветках. Ответы появятся на доске сами, ничего обновлять не нужно.'),
    h('div', {style: 'color:var(--dim);font-size:12.5px'}, 'Фильтры сверху показывают кадры без оценки, с правками и с открытыми комментариями. «Сводка правок» собирает всё в текст.')));
}
function summaryMd() {
  const L = [`# Правки: ${S.board.title}`, '', `Обновлено ${new Date(S.review.updatedAt ?? Date.now()).toLocaleString('ru')}`, ''];
  const sl = scenesUI.summaryLines();
  if (sl.length) L.push('# Сцены', '', ...sl, '# Кадры', '');
  for (const f of S.board.frames) {
    const r = fr(f.id);
    const cs = (r.comments ?? []);
    const live = r.status || r.note || cs.length || (r.moves ?? []).length || (r.attachments ?? []).some((a) => !a.removed) || (r.patterns ?? []).length || (r.refs ?? []).length || (r.links ?? []).length;
    if (!live) continue;
    L.push(`## ${f.id} · ${tc(f.t0)}–${tc(f.t1)} · «${f.phrase}»${r.status ? ` · ${STATUS[r.status]}` : ''}`);
    if (r.note) L.push(`Заметка: ${r.note}`);
    for (const c of cs.filter((x) => !x.parent)) {
      L.push(`- ${c.status === 'resolved' ? '[решено] ' : ''}${c.author}${c.at != null ? ` (⏱ ${tc(c.at)})` : ''}: ${c.text}`);
      for (const rp of cs.filter((x) => x.parent === c.id)) L.push(`  - ${rp.author}: ${rp.text}`);
    }
    for (const [k, m] of (r.moves ?? []).entries()) L.push(`- сдвиг ${k + 1}${m.status === 'resolved' ? ' [решено]' : ''}: «${m.label || 'без подписи'}» из ${ptxt(m.from)} в ${ptxt(m.to)} px${m.scale ? `, ${scaleTxt(m.scale)}` : ''}`);
    const at = (r.attachments ?? []).filter((a) => !a.removed);
    if (at.length) L.push(`Вложения: ${at.map((a) => a.path).join(', ')}`);
    if ((r.patterns ?? []).length) L.push(`Паттерны: ${r.patterns.join(', ')}`);
    if ((r.refs ?? []).length) L.push(`Референсы: ${r.refs.map((x) => `${x.id} ${x.time ?? ''} ${x.note ?? ''}`.trim()).join('; ')}`);
    if ((r.links ?? []).length) L.push(`Ссылки: ${r.links.map((x) => x.url).join(', ')}`);
    L.push('');
  }
  const lost = orphanCount();
  if (lost) L.push(`Внимание: ещё ${lost} открытых правок относятся к кадрам и сценам, которых в этой версии ролика нет. Они сохранены в файле, агент увидит их командой board:read.`, '');
  return L.join('\n');
}
function openSummary() {
  const md = summaryMd();
  modal('Сводка правок', h('pre', {class: 'md'}, md), h('button', {class: 'btn gold sm', onclick: () => navigator.clipboard.writeText(md).then(() => toast('Скопировано'), () => toast('Выдели текст и скопируй'))}, 'Скопировать'));
}
boot();
