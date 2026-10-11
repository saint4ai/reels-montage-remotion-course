// Доска раскадровки: сверху сцены (клипы с комментариями, моментами и референсами анимации, см. scenes.js), ниже кадры ролика:
// видео фильма по сегменту кадра, оценки, ветки комментариев, сдвиги объектов стрелкой, вложения, паттерны.
// Все правки уходят на локальный сервер операциями (/api/frame, /api/comment, /api/move, /api/scene-* …) и пишутся в work/<ролик>/storyboard/review.json.
import {initScenes} from './scenes.js';
const $ = (s, el = document) => el.querySelector(s);
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
};
const S = {project: null, board: null, review: {frames: {}}, sel: null, filter: 'all', loop: true, typing: false, moveMode: false, pending: null};
const store = {get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} }};
const tc = (s) => { const m = Math.floor(s / 60), x = s - m * 60; return `${m}:${x.toFixed(1).padStart(4, '0')}`; };
const media = (p) => (p ? `/p/${encodeURIComponent(S.project)}/${p.split('/').map(encodeURIComponent).join('/')}` : '');
const fr = (id) => S.review.frames?.[id] ?? {status: null, note: '', comments: [], attachments: [], links: [], patterns: [], refs: [], moves: []};
// размер кадра композиции в пикселях (для подписей сдвигов): из board.json, по умолчанию 1440×2560
const FW = () => Number(S.board?.width) || 1440, FH = () => Number(S.board?.height) || 2560;
const openMoves = (r) => (r.moves ?? []).filter((m) => m.status !== 'resolved');
const openCmts = (r) => (r.comments ?? []).filter((c) => c.status !== 'resolved' && !c.parent);
const author = () => $('#author').value.trim() || 'Автор';
const toast = (t) => { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), 1800); };
const STATUS = {ok: 'Нравится', fix: 'Нужна правка', ask: 'Вопрос'};
const SCALES = [['', 'размер не менять'], ['1.25', 'крупнее ×1,25'], ['1.5', 'ещё крупнее ×1,5'], ['0.8', 'мельче ×0,8'], ['0.6', 'ещё мельче ×0,6']];
const ptxt = (p) => `(${Math.round(p.x * FW())}, ${Math.round(p.y * FH())})`;
const scaleTxt = (v) => (v ? `${v > 1 ? 'крупнее' : 'мельче'} ×${String(v).replace('.', ',')}` : '');
// раздел «Сцены» живёт в scenes.js; доска без сцен (старая сборка) просто не показывает его
const scenesUI = initScenes({S, $, h, api, media, toast, author, select, afterChange: () => { renderStats(); renderRibbon(); }, refilter: () => { renderFilters(); scenesUI.paint(); renderGrid(); }});
const sceneList = () => S.board?.scenes ?? [];

async function api(path, body) {
  const r = await fetch(`/api/${path}?project=${encodeURIComponent(S.project)}`, body ? {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)} : undefined);
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
}
async function op(name, payload) {
  const j = await api(name, payload);
  S.review = j.review;
  renderStats(); renderRibbon(); renderGrid(true); renderPanel();
}

async function boot() {
  const ps = await (await fetch('/api/projects')).json();
  const sel = $('#project');
  sel.innerHTML = '';
  for (const p of ps) sel.append(h('option', {value: p.id}, p.title));
  if (!ps.length) { $('#grid').append(h('p', {class: 'empty'}, 'Досок пока нет. Попроси Claude: «собери доску для моего ролика» (файл videos/<проект>/storyboard/board.json).')); return; }
  const want = new URLSearchParams(location.search).get('project') || store.get('sb-project', ps[0].id);
  sel.value = ps.some((p) => p.id === want) ? want : ps[0].id;
  sel.onchange = () => load(sel.value);
  $('#author').value = store.get('sb-author', 'Автор');
  $('#author').oninput = (e) => store.set('sb-author', e.target.value);
  $('#summaryBtn').onclick = openSummary;
  $('#helpBtn').onclick = openHelp;
  await load(sel.value);
  if (store.get('sb-help-seen', '') !== '1') { openHelp(); store.set('sb-help-seen', '1'); }
  setInterval(refresh, 4000);
  document.addEventListener('keydown', keys);
  document.addEventListener('paste', onPaste);
  // файл, брошенный мимо зоны сброса, не должен открываться вместо доски
  for (const ev of ['dragover', 'drop']) window.addEventListener(ev, (e) => { if ([...(e.dataTransfer?.types ?? [])].includes('Files')) e.preventDefault(); });
  // панель выбранного кадра держится у верхнего края, пока листаешь кадры: её высота равна высоте окна под лентой
  const main = $('#main');
  const setH = () => main.style.setProperty('--mainh', `${main.clientHeight}px`);
  new ResizeObserver(setH).observe(main); setH();
}
async function load(project) {
  S.project = project;
  store.set('sb-project', project);
  const j = await api('board');
  S.board = j.board; S.review = j.review;
  // формат кадра: board.aspect (ширина / высота), по умолчанию 16:9; вертикальные ролики (aspect < 1) получают свою раскладку
  const ar = Number(S.board.aspect) || (S.board.width && S.board.height ? S.board.width / S.board.height : 16 / 9);
  document.documentElement.style.setProperty('--ar', String(ar));
  document.body.classList.toggle('portrait', ar < 1);
  document.title = `${S.board.title ?? project} · раскадровка`;
  $('#title').textContent = S.board.title ?? project;
  S.sel = store.get(`sb-sel-${project}`, S.board.frames[0]?.id);
  renderFilters(); renderStats(); renderRibbon(); renderGrid(); renderPanel();
  scenesUI.reset();
  scenesUI.paint();
  $('#main').scrollTop = 0;
}
// подтягиваем ответы агента и правки с другого окна, пока автор не печатает
async function refresh() {
  if (S.typing || !S.project) return;
  try {
    const j = await api('board');
    if (j.review.updatedAt !== S.review.updatedAt) { S.review = j.review; renderStats(); renderRibbon(); renderGrid(true); renderPanel(true); scenesUI.refresh(); }
  } catch {}
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
    box.append(h('button', {class: `chip${S.filter === k ? ' on' : ''}`, onclick: () => { S.filter = k; renderFilters(); scenesUI.paint(); renderGrid(); }}, t));
  }
}
function renderStats() {
  const fs = S.board.frames, rs = fs.map((f) => fr(f.id));
  const open = rs.reduce((n, r) => n + openCmts(r).length, 0), mv = rs.reduce((n, r) => n + openMoves(r).length, 0);
  const sc = sceneList(), scOpen = sc.reduce((n, s) => n + scenesUI.openCount(s.id), 0);
  $('#stats').innerHTML = (sc.length ? `<span><b>${sc.length}</b> сцен</span><span><b>${scOpen}</b> комм. к сценам</span>` : '')
    + `<span><b>${fs.length}</b> кадров</span><span><b>${rs.filter((r) => r.status === 'ok').length}</b> нравится</span>`
    + `<span><b>${rs.filter((r) => r.status === 'fix').length}</b> правок</span><span><b>${open}</b> открытых комментариев</span><span><b>${mv}</b> сдвигов</span>`;
}
function renderRibbon() {
  const rb = $('#ribbon'), D = S.board.duration ?? S.board.frames.at(-1).t1;
  rb.innerHTML = '';
  rb.classList.toggle('has-scenes', sceneList().length > 0);
  const blocks = h('div', {class: 'blocks'}), segs = h('div', {class: 'segs'});
  for (const b of S.board.blocks ?? []) blocks.append(h('div', {class: 'blk', style: `left:${(b.t0 / D) * 100}%;width:${((b.t1 - b.t0) / D) * 100}%`}, b.name));
  // дорожка сцен: клик ведёт к карточке сцены
  const scn = h('div', {class: 'scn'});
  for (const sc of sceneList()) {
    const r = scenesUI.rv(sc.id), n = scenesUI.openCount(sc.id);
    scn.append(h('div', {class: 'sg', title: `${sc.id} · ${sc.title} · ${scenesUI.range(sc)}`, style: `left:${(sc.t0 / D) * 100}%;width:calc(${((sc.t1 - sc.t0) / D) * 100}% - 2px)`, onclick: () => scenesUI.gotoScene(sc.id)},
      sc.id, r.rating ? h('span', {class: `st ${r.rating}`}) : null, n ? h('span', {class: 'cnt'}, n) : null));
  }
  for (const f of S.board.frames) {
    const r = fr(f.id), n = openCmts(r).length + openMoves(r).length;
    segs.append(h('div', {class: `seg${f.id === S.sel ? ' sel' : ''}`, title: `${f.id} · ${f.phrase}`, style: `left:${(f.t0 / D) * 100}%;width:calc(${((f.t1 - f.t0) / D) * 100}% - 2px)`, onclick: () => select(f.id, true)},
      f.img ? h('img', {src: media(f.img), loading: 'lazy'}) : null, r.status ? h('span', {class: `st ${r.status}`}) : null, n ? h('span', {class: 'cnt'}, n) : null));
  }
  rb.append(...[blocks, sceneList().length ? scn : null, segs, h('div', {class: 'head', id: 'head', style: 'display:none'})].filter(Boolean)); // append(null) дописал бы слово «null»
}
function renderGrid(keepScroll) {
  const g = $('#grid'), sc = $('#main'), top = sc.scrollTop; // прокручивается вся страница, а не сетка
  g.innerHTML = '';
  const fs = visible();
  if (!fs.length) g.append(h('p', {class: 'empty'}, 'По этому фильтру кадров нет.'));
  const byBlock = [];
  for (const f of fs) { const last = byBlock.at(-1); if (last && last.name === f.block) last.frames.push(f); else byBlock.push({name: f.block, frames: [f]}); }
  for (const b of byBlock) {
    const cards = h('div', {class: 'cards'});
    for (const f of b.frames) {
      const r = fr(f.id), n = openCmts(r).length, a = (r.attachments ?? []).filter((x) => !x.removed).length, mvN = openMoves(r).length, sid = scenesUI.sceneOfFrame(f.id);
      cards.append(h('div', {class: `card${f.id === S.sel ? ' sel' : ''}`, id: `card-${f.id}`, onclick: () => select(f.id, {toPanel: true})},
        h('div', {class: 'thumb'}, f.img ? h('img', {src: media(f.img), loading: 'lazy'}) : null, h('span', {class: 'id'}, f.id),
          sid ? h('span', {class: 'scb', title: `Кадр из сцены ${sid}: перейти к сцене`, onclick: (e) => { e.stopPropagation(); scenesUI.gotoScene(sid); }}, sid) : null,
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
  document.querySelectorAll('.card.sel, .seg.sel').forEach((el) => el.classList.remove('sel'));
  $(`#card-${CSS.escape(id)}`)?.classList.add('sel');
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
  if (play) v.play().catch(() => {});
}

let FILM = null;
function filmEl() {
  if (FILM && FILM.dataset.src === media(S.board.film)) return FILM;
  FILM = h('video', {id: 'vid', src: media(S.board.film), preload: 'auto', playsinline: true});
  FILM.dataset.src = media(S.board.film);
  FILM.addEventListener('timeupdate', () => {
    const ff = cur();
    const t = FILM.currentTime;
    const pt = $('#ptime');
    if (pt) pt.textContent = `${tc(t)} / сегмент ${tc(ff.t0)}–${tc(ff.t1)}`;
    const D = S.board.duration ?? 1, head = $('#head');
    if (head) { head.style.display = 'block'; head.style.left = `calc(18px + (100% - 36px) * ${t / D})`; }
    if (t > ff.t1 && !FILM.paused) { if (S.loop) FILM.currentTime = ff.t0 + 0.02; else FILM.pause(); }
  });
  return FILM;
}
function renderPanel(soft) {
  const p = $('#panel'), f = cur();
  if (!f) return;
  const r = fr(f.id);
  // при фоновом обновлении не трогаем видео и поле заметки, если они в работе
  const v0 = $('#vid');
  const keepTime = soft && v0 ? v0.currentTime : null;
  const wasPlaying = soft && v0 && !v0.paused;
  p.innerHTML = '';
  const body = h('div', {class: `pbody${S.moveMode ? ' moving' : ''}`});
  const i = S.board.frames.indexOf(f);
  const sid = scenesUI.sceneOfFrame(f.id);
  body.append(h('div', {class: 'phead'}, h('h1', {}, f.id), h('span', {class: 'tc'}, `${tc(f.t0)} – ${tc(f.t1)} · ${f.block}`),
    sid ? h('button', {class: 'scb', title: 'Перейти к сцене, в которую входит кадр', onclick: () => scenesUI.gotoScene(sid)}, `сцена ${sid}`) : null,
    h('div', {class: 'nav'}, h('button', {class: 'btn sm', onclick: () => i > 0 && select(S.board.frames[i - 1].id, true), title: '←'}, '←'),
      h('button', {class: 'btn sm', onclick: () => i < S.board.frames.length - 1 && select(S.board.frames[i + 1].id, true), title: '→'}, '→'))));
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
  } else if (f.img) player.append(h('img', {src: media(f.img)}));
  const ptop = h('div', {class: 'ptop'}), pl = h('div', {class: 'pl'}), pr = h('div', {class: 'pr'});
  pl.append(player);
  if (f.img) pl.append(h('div', {class: 'pctrl'},
    h('button', {class: `btn sm${S.moveMode ? ' gold' : ''}`, title: 'Показать картинку кадра и поставить стрелку: что и куда подвинуть', onclick: () => { S.moveMode = !S.moveMode; S.pending = null; renderPanel(); }}, '↔ Сдвиг объектов'),
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
  for (const [k, t] of Object.entries(STATUS)) st.append(h('button', {class: `${k}${r.status === k ? ' on' : ''}`, onclick: () => op('frame', {frame: f.id, patch: {status: r.status === k ? null : k}})}, t));
  const note = h('textarea', {placeholder: 'Заметка к кадру: что поменять, что оставить…'});
  note.value = r.note ?? '';
  let tmr;
  note.addEventListener('focus', () => (S.typing = true));
  note.addEventListener('blur', () => { S.typing = false; });
  note.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(() => api('frame', {frame: f.id, patch: {note: note.value}}).then((j) => { S.review = j.review; $('#noteSaved').textContent = 'сохранено'; }), 600); });
  body.append(h('div', {class: 'sec'}, h('h3', {}, 'Оценка'), st, note, h('span', {class: 'saved', id: 'noteSaved'}, r.updatedAt ? `изменено ${new Date(r.updatedAt).toLocaleString('ru')}` : '')));

  // ветка комментариев
  const roots = (r.comments ?? []).filter((c) => !c.parent);
  const thread = h('div', {class: 'thread'});
  const cmtEl = (c, reply) => h('div', {class: `cmt${reply ? ' reply' : ''}${c.status === 'resolved' ? ' resolved' : ''}`},
    h('div', {class: 'who'}, h('b', {class: /claude|агент|codex/i.test(c.author) ? 'agent' : null}, c.author), h('span', {}, new Date(c.createdAt).toLocaleString('ru', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'})),
      c.at != null ? h('span', {class: 'at', title: 'Перейти к моменту', onclick: () => { const v = $('#vid'); if (v) { v.currentTime = c.at; v.play().catch(() => {}); } }}, `⏱ ${tc(c.at)}`) : null,
      c.status === 'resolved' ? h('span', {}, '· решено') : null),
    h('div', {class: 'txt'}, c.text),
    h('div', {class: 'acts'},
      !reply ? h('button', {onclick: (e) => openReply(e.target, c)}, 'Ответить') : null,
      h('button', {onclick: () => op('comment-status', {frame: f.id, id: c.id, status: c.status === 'resolved' ? 'open' : 'resolved'})}, c.status === 'resolved' ? 'Открыть снова' : 'Решено')));
  for (const c of roots) {
    thread.append(cmtEl(c, false));
    for (const rp of (r.comments ?? []).filter((x) => x.parent === c.id)) thread.append(cmtEl(rp, true));
  }
  if (!roots.length) thread.append(h('span', {class: 'empty'}, 'Комментариев пока нет.'));
  const ta = h('textarea', {placeholder: 'Комментарий к кадру. Ctrl+Enter: отправить'});
  ta.addEventListener('focus', () => (S.typing = true));
  ta.addEventListener('blur', () => (S.typing = false));
  const withTime = h('input', {type: 'checkbox', checked: true});
  const sendC = () => {
    const text = ta.value.trim(); if (!text) return;
    const v = $('#vid');
    op('comment', {frame: f.id, text, author: author(), at: withTime.checked && v ? Math.round(v.currentTime * 100) / 100 : null}).then(() => toast('Комментарий сохранён'));
  };
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendC(); });
  body.append(h('div', {class: 'sec'}, h('h3', {}, 'Комментарии', h('span', {class: 'n'}, roots.length || '')), thread,
    h('div', {class: 'compose'}, ta, h('div', {class: 'row'}, h('button', {class: 'btn gold sm', onclick: sendC}, 'Отправить'), h('label', {}, withTime, 'привязать к моменту видео')))));

  // вложения: скриншоты и видео эффектов
  const atts = h('div', {class: 'atts'});
  for (const a of (r.attachments ?? []).filter((x) => !x.removed)) {
    const url = media(a.path);
    atts.append(h('div', {class: 'att', title: a.name},
      a.kind === 'video' ? h('video', {src: url, muted: true, loop: true, playsinline: true, onmouseenter: (e) => e.target.play(), onmouseleave: (e) => e.target.pause()}) : h('img', {src: url, onclick: () => window.open(url, '_blank')}),
      h('span', {class: 'lbl'}, a.label || a.name), h('button', {class: 'x', title: 'Убрать', onclick: () => op('attach-remove', {frame: f.id, id: a.id})}, '×')));
  }
  const pick = h('input', {type: 'file', multiple: true, accept: 'image/*,video/*', style: 'display:none', onchange: (e) => upFiles([...e.target.files], f.id)});
  const drop = h('div', {class: 'drop'}, 'Перетащи сюда скриншоты или видео эффектов, вставь из буфера (Ctrl+V) или ', h('a', {href: '#', onclick: (e) => { e.preventDefault(); pick.click(); }}, 'выбери файлы'), pick);
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); upFiles([...e.dataTransfer.files], f.id); });
  body.append(h('div', {class: 'sec'}, h('h3', {}, 'Вложения', h('span', {class: 'n'}, atts.children.length || '')), atts.children.length ? atts : null, drop));

  // ссылки
  const links = h('div', {class: 'links'});
  for (const [k, l] of (r.links ?? []).entries()) links.append(h('div', {class: 'pill'}, h('a', {href: l.url, target: '_blank', rel: 'noopener'}, l.label || l.url),
    h('button', {onclick: () => op('frame', {frame: f.id, patch: {links: r.links.filter((_, j) => j !== k)}})}, '×')));
  const lu = h('input', {placeholder: 'https://… ссылка на референс'}), ll = h('input', {placeholder: 'подпись'});
  body.append(h('div', {class: 'sec'}, h('h3', {}, 'Ссылки'), links, h('div', {class: 'compose'}, h('div', {class: 'row'}, lu, ll,
    h('button', {class: 'btn sm', onclick: () => lu.value.trim() && op('frame', {frame: f.id, patch: {links: [...(r.links ?? []), {url: lu.value.trim(), label: ll.value.trim()}]}})}, 'Добавить')))));

  // паттерны и референсы
  const pp = h('div', {class: 'pills'});
  for (const code of r.patterns ?? []) {
    const pt = (S.board.patterns ?? []).find((x) => x.code === code);
    pp.append(h('span', {class: 'pill', title: pt?.how ?? ''}, pt?.img ? h('img', {src: media(pt.img)}) : null, `${code} ${pt?.name ?? ''}`,
      h('button', {onclick: () => op('frame', {frame: f.id, patch: {patterns: r.patterns.filter((x) => x !== code)}})}, '×')));
  }
  const rp = h('div', {class: 'pills'});
  for (const [k, rf] of (r.refs ?? []).entries()) {
    const R = (S.board.refs ?? []).find((x) => x.id === rf.id);
    rp.append(h('span', {class: 'pill'}, R?.img ? h('img', {src: media(R.img)}) : null, `${rf.id}${rf.time ? ` · ${rf.time}` : ''}${rf.note ? ` · ${rf.note}` : ''}`,
      h('button', {onclick: () => op('frame', {frame: f.id, patch: {refs: r.refs.filter((_, j) => j !== k)}})}, '×')));
  }
  // паттерны и референсы необязательны: блоки видны, только если они есть в board.json (patterns[], refs[]) или уже выбраны в кадре
  if ((S.board.patterns ?? []).length || (r.patterns ?? []).length) body.append(h('div', {class: 'sec'}, h('h3', {}, 'Паттерны монтажа', h('span', {class: 'n'}, (r.patterns ?? []).length || '')), pp,
    (S.board.patterns ?? []).length ? h('div', {class: 'row'}, h('button', {class: 'btn sm', onclick: () => openPatterns(f.id)}, '+ Паттерн')) : null));
  if ((S.board.refs ?? []).length || (r.refs ?? []).length) {
    const refSel = h('select', {}, ...(S.board.refs ?? []).map((R) => h('option', {value: R.id}, `${R.id} · ${R.title}`)));
    const refT = h('input', {placeholder: 'время, напр. 4,4–4,6 с', style: 'width:150px'}), refN = h('input', {placeholder: 'что взять'});
    body.append(h('div', {class: 'sec'}, h('h3', {}, 'Референсы'), rp, (S.board.refs ?? []).length ? h('div', {class: 'compose'}, h('div', {class: 'row'}, refSel, refT, refN,
      h('button', {class: 'btn sm', onclick: () => op('frame', {frame: f.id, patch: {refs: [...(r.refs ?? []), {id: refSel.value, time: refT.value.trim(), note: refN.value.trim()}]}})}, 'Добавить'))) : null));
  }
  p.append(body);
}
// ── сдвиги объектов: стрелка от объекта к новому месту, координаты в долях кадра (0..1 от левого верхнего угла) ──
const SVGNS = 'http://www.w3.org/2000/svg';
const svgEl = (name, attrs = {}) => { const e = document.createElementNS(SVGNS, name); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
// кадр-картинка со стрелками; drawing = режим «Сдвиг»: по картинке можно тянуть мышкой новую стрелку
function stageEl(f, r, drawing) {
  const stage = h('div', {class: `stage${drawing ? ' draw' : ''}`}, h('img', {src: media(f.img), draggable: 'false'}));
  const svg = svgEl('svg', {class: 'mvsvg'});
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
      h('button', {class: 'lnk', onclick: () => op('move-status', {frame: f.id, id: m.id, status: done ? 'open' : 'resolved'})}, done ? 'Открыть снова' : 'Решено'),
      h('button', {class: 'lnk', onclick: () => op('move-remove', {frame: f.id, id: m.id})}, 'Удалить')));
  });
  let form = null;
  if (S.pending?.frame === f.id) {
    const label = h('input', {placeholder: 'Что двигаем: например, телефон или заголовок', style: 'flex:1;min-width:200px'});
    const size = h('select', {}, ...SCALES.map(([v, t]) => h('option', {value: v}, t)));
    label.addEventListener('focus', () => (S.typing = true));
    label.addEventListener('blur', () => (S.typing = false));
    const save = () => {
      const p = S.pending;
      S.pending = null; S.typing = false;
      op('move', {frame: p.frame, from: p.from, to: p.to, label: label.value, scale: size.value || null, author: author()}).then(() => toast('Стрелка сохранена'));
    };
    label.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    form = h('div', {class: 'compose mvform'}, h('div', {class: 'phrase small'}, `Новая стрелка: из ${ptxt(S.pending.from)} в ${ptxt(S.pending.to)} px`),
      h('div', {class: 'row'}, label, size),
      h('div', {class: 'row'}, h('button', {class: 'btn gold sm', onclick: save}, 'Сохранить стрелку'),
        h('button', {class: 'btn sm', onclick: () => { S.pending = null; S.typing = false; renderPanel(); }}, 'Отмена')));
    setTimeout(() => label.focus(), 0);
  }
  const hintText = S.moveMode ? 'Протяни стрелку по кадру: от объекта к тому месту, куда его нужно поставить.' : 'Нажми «↔ Сдвиг объектов» под кадром и протяни стрелку от объекта к новому месту.';
  return h('div', {class: 'sec mvsec'}, h('h3', {}, 'Сдвиги объектов', h('span', {class: 'n'}, (r.moves ?? []).length || '')), form,
    list.children.length ? list : (form ? null : h('span', {class: 'empty'}, hintText)));
}
function openReply(btn, c) {
  const f = cur();
  const box = btn.closest('.cmt');
  if (box.nextSibling?.classList?.contains('compose')) return;
  const ta = h('textarea', {placeholder: 'Ответ…'});
  ta.addEventListener('focus', () => (S.typing = true));
  ta.addEventListener('blur', () => (S.typing = false));
  const send = () => ta.value.trim() && op('comment', {frame: f.id, text: ta.value.trim(), author: author(), parent: c.id});
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); });
  box.after(h('div', {class: 'compose', style: 'margin-left:22px'}, ta, h('div', {class: 'row'}, h('button', {class: 'btn gold sm', onclick: send}, 'Ответить'))));
  ta.focus();
}
async function upFiles(files, frame) {
  for (const file of files) {
    const kind = file.type.startsWith('video') ? 'video' : 'image';
    const r = await fetch(`/api/upload?project=${encodeURIComponent(S.project)}&frame=${encodeURIComponent(frame)}&name=${encodeURIComponent(file.name || `вставка.${kind === 'video' ? 'mp4' : 'png'}`)}`, {method: 'POST', body: file});
    const j = await r.json();
    if (!r.ok) { toast(j.error || 'не загрузилось'); continue; }
    await op('attach', {frame, path: j.path, name: file.name || 'из буфера', kind, author: author()});
  }
  toast(files.length > 1 ? `Загружено ${files.length}` : 'Вложение сохранено');
}
function onPaste(e) {
  if (scenesUI.paste(e)) return; // файл из буфера над карточкой сцены это референс этой сцены
  if (!S.sel || /textarea|input/i.test(document.activeElement?.tagName ?? '')) return;
  const files = [...(e.clipboardData?.files ?? [])];
  if (files.length) { e.preventDefault(); upFiles(files, S.sel); }
}
function keys(e) {
  if (/textarea|input|select/i.test(document.activeElement?.tagName ?? '')) return;
  if (document.activeElement?.closest?.('.scene')) return; // пробел и стрелки у плеера сцены его собственные
  const i = S.board.frames.findIndex((f) => f.id === S.sel);
  if (e.key === 'ArrowRight' && i < S.board.frames.length - 1) { select(S.board.frames[i + 1].id, true); e.preventDefault(); }
  if (e.key === 'ArrowLeft' && i > 0) { select(S.board.frames[i - 1].id, true); e.preventDefault(); }
  if (e.key === ' ') { const v = $('#vid'); if (v) { v.paused ? playSeg(true) : v.pause(); e.preventDefault(); } }
  if (e.key === 'Escape') { closeModal(); if (S.pending) { S.pending = null; renderPanel(); } }
}

// окна: паттерны и сводка правок
const closeModal = () => { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; };
function modal(title, content, extra) {
  const m = $('#modal');
  m.innerHTML = '';
  m.append(h('div', {class: 'mbox'}, h('div', {class: 'mhead'}, h('h2', {}, title), extra ?? null, h('button', {class: 'btn sm', onclick: closeModal}, 'Закрыть')), h('div', {class: 'mbody'}, content)));
  m.hidden = false;
  m.onclick = (e) => e.target === m && closeModal();
}
function openPatterns(frame) {
  const r = fr(frame), chosen = new Set(r.patterns ?? []);
  const q = h('input', {placeholder: 'поиск: портал, стаккато, счётчик…', style: 'width:280px'});
  const grid = h('div', {class: 'pgrid'});
  const draw = () => {
    grid.innerHTML = '';
    const s = q.value.trim().toLowerCase();
    for (const pt of S.board.patterns ?? []) {
      if (s && !`${pt.code} ${pt.name} ${pt.how ?? ''} ${pt.where ?? ''}`.toLowerCase().includes(s)) continue;
      grid.append(h('button', {class: `pcard${chosen.has(pt.code) ? ' on' : ''}`, onclick: () => { chosen.has(pt.code) ? chosen.delete(pt.code) : chosen.add(pt.code); draw(); }},
        pt.img ? h('img', {src: media(pt.img), loading: 'lazy'}) : null, h('span', {class: 'pt'}, h('b', {}, `${pt.code} · ${pt.name}`), h('span', {}, pt.how ?? ''), h('span', {}, pt.where ?? ''))));
    }
  };
  q.oninput = draw; draw();
  modal('Паттерны монтажа', grid, h('div', {class: 'row', style: 'display:flex;gap:8px'}, q,
    h('button', {class: 'btn gold sm', onclick: () => { op('frame', {frame, patch: {patterns: [...chosen]}}); closeModal(); }}, 'Готово')));
}
function openHelp() {
  const step = (n, t, d) => h('div', {style: 'display:flex;gap:14px;align-items:flex-start'}, h('span', {style: 'flex:none;width:34px;height:34px;border-radius:50%;background:var(--gold);color:#2A211C;display:grid;place-items:center;font:700 15px var(--head)'}, n),
    h('div', {}, h('b', {style: 'font-size:15px'}, t), h('div', {style: 'color:var(--muted);margin-top:3px'}, d)));
  modal('Как работать с доской', h('div', {style: 'display:flex;flex-direction:column;gap:16px;max-width:760px'},
    sceneList().length ? step('С', 'Сначала сцены', 'Сверху куски ролика по несколько секунд: нажми ▶ и смотри, как работает анимация (звук включается кнопкой «Звук», скорость 0,5× замедляет). Под клипом пиши, что не так: «Текст», «Анимация», «Тайминг», «Звук». Кнопка «⏱ Отметить момент» запоминает секунду, на которой стоит клип, а клик по метке в комментарии перематывает клип. Референс нужной анимации перетащи на карточку сцены, вставь из буфера (Ctrl+V) или добавь ссылкой, и напиши, что из него взять: движение, шрифт, переход, темп.') : null,
    step(1, sceneList().length ? 'Потом кадры: выбери кадр' : 'Выбери кадр', 'Кликни карточку или отрезок на ленте сверху. Справа фильм проиграет ровно этот кадр (кнопка «▶ Сегмент», стрелки ← → листают кадры).'),
    step(2, 'Оцени', '«Нравится», «Нужна правка» или «Вопрос». Цвет оценки виден на карточке и на ленте.'),
    step(3, 'Напиши комментарий', 'Что поменять. Галочка «привязать к моменту» запоминает секунду видео: Claude увидит, о каком месте речь.'),
    step(4, 'Покажи, как надо', 'Перетащи скриншот или видео эффекта в блок «Вложения» или вставь из буфера (Ctrl+V). Можно добавить ссылку. Если в доске есть паттерны и референсы, их тоже можно прикрепить.'),
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
  return L.join('\n');
}
function openSummary() {
  const md = summaryMd();
  modal('Сводка правок', h('pre', {class: 'md'}, md), h('button', {class: 'btn gold sm', onclick: () => navigator.clipboard.writeText(md).then(() => toast('Скопировано'), () => toast('Выдели текст и скопируй'))}, 'Скопировать'));
}
boot();
