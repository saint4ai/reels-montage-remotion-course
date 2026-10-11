// Раздел «Сцены» доски раскадровки: клип каждой сцены, оценка, заметка, комментарии с отметкой момента и референсы анимации.
// Подключается из app.js (initScenes). Все правки уходят операциями /api/scene-* и пишутся в review.json → scenes[<id>].
// Видео не пересоздаются при правках: карточка перерисовывает только правую часть (.sc-body), плеер остаётся на месте.
export function initScenes(ctx) {
  const {S, $, h, api, media, toast, author, select} = ctx;
  const TAGS = ['Текст', 'Анимация', 'Тайминг', 'Звук', 'Другое'];
  const TAKES = ['Движение', 'Шрифт', 'Переход', 'Темп'];
  const RATING = {ok: 'Ок', fix: 'Править'};
  const REF_EXT = ['.mp4', '.webm', '.mov', '.m4v', '.gif', '.png', '.jpg', '.jpeg', '.webp'];
  const VIDEO_EXT = ['.mp4', '.webm', '.mov', '.m4v'];
  const TYPE_EXT = {'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp', 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov'};

  const scenes = () => S.board?.scenes ?? [];
  const sceneById = (id) => scenes().find((s) => s.id === id);
  const rv = (id) => S.review.scenes?.[id] ?? {rating: null, note: '', comments: [], refs: []};
  const cards = new Map();   // id -> {el, body, video, sig}
  const drafts = {};         // id -> черновики полей, чтобы перерисовка не стирала недописанное
  const draft = (id) => (drafts[id] ??= {text: '', tag: null, t: null, take: '', rt: '', url: '', reply: null});
  let hover = null;          // над какой карточкой сейчас мышь (сюда уйдёт Ctrl+V)

  // время: «0:03» для целых секунд, «0:04,2» с десятой; момент в комментарии всегда с десятой
  const split = (s) => { const m = Math.floor(s / 60); return [m, s - m * 60]; };
  const tcs = (s) => { const [m, x] = split(s); return Math.abs(x - Math.round(x)) < 0.05 ? `${m}:${String(Math.round(x)).padStart(2, '0')}` : `${m}:${x.toFixed(1).padStart(4, '0')}`.replace('.', ','); };
  const tcm = (s) => { const [m, x] = split(s); return `${m}:${x.toFixed(1).padStart(4, '0')}`.replace('.', ','); };
  const range = (sc) => `${tcs(sc.t0)}–${tcs(sc.t1)}`;
  const when = (iso) => new Date(iso).toLocaleString('ru', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'});
  const isAgent = (n) => /claude|агент|codex/i.test(n ?? '');
  const guard = (el) => { el.addEventListener('focus', () => (S.typing = true)); el.addEventListener('blur', () => (S.typing = false)); return el; };
  const extOf = (name) => (/\.[^.\\/]+$/.exec(name ?? '')?.[0] ?? '').toLowerCase();

  async function sop(name, payload, id) {
    const j = await api(name, {...payload, scene: id});
    S.review = j.review;
    repaint([id]);
    ctx.afterChange();
    return j;
  }
  const openCount = (id) => (rv(id).comments ?? []).filter((c) => c.status !== 'resolved').length;
  const sig = (id) => JSON.stringify(rv(id));

  // ── плеер: один элемент на карточку, живёт, пока доска открыта ──
  function playerEl(sc) {
    const v = h('video', {src: media(sc.clip), poster: sc.poster ? media(sc.poster) : null, controls: true, loop: true, playsinline: true, preload: 'none'});
    v.muted = true; // атрибут muted у созданного скриптом элемента звук не выключает
    v.addEventListener('play', () => { // играет один клип: чужие звуки не накладываются, декодер занят одним видео
      for (const [, c] of cards) if (c.video !== v) c.video.pause();
      $('#vid')?.pause();
    });
    return v;
  }
  function seek(id, abs, play = true) {
    const c = cards.get(id), sc = sceneById(id);
    if (!c || !sc) return;
    const local = Math.max(0, Math.min(sc.t1 - sc.t0, abs - sc.t0)), v = c.video;
    const go = () => { v.currentTime = local; if (play) v.play().catch(() => {}); };
    if (v.readyState >= 1) go();
    else { v.preload = 'auto'; v.addEventListener('loadedmetadata', go, {once: true}); v.load(); }
  }
  // клипы подгружаются, только когда карточка подъехала к экрану (иначе 30 сцен разом)
  let io = null;
  const watch = (el, v) => {
    if (typeof IntersectionObserver === 'undefined') return;
    io ??= new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      const vv = e.target.querySelector('video');
      if (vv && vv.preload === 'none') vv.preload = 'metadata';
      io.unobserve(e.target);
    }), {rootMargin: '500px 0px'}); // root не задан, то есть окно браузера: на ноутбуке прокручивается #main, на телефоне вся страница, обрезку родителем наблюдатель учитывает сам
    io.observe(el);
  };

  // ── карточка сцены ──
  function cardFor(sc) {
    const video = playerEl(sc);
    const snd = h('button', {class: 'btn sm', title: 'Включить или выключить звук клипа'}, '🔈 Звук');
    snd.onclick = () => { video.muted = !video.muted; };
    const sync = () => { snd.classList.toggle('on', !video.muted); snd.textContent = video.muted ? '🔈 Звук' : '🔊 Звук'; };
    video.addEventListener('volumechange', sync);
    const speeds = [[1, '1×'], [0.5, '0,5×']].map(([r, t]) => h('button', {class: `btn sm${r === 1 ? ' on' : ''}`, title: `Скорость ${t}`, onclick: () => { video.playbackRate = r; }}, t));
    video.addEventListener('ratechange', () => speeds.forEach((b, i) => b.classList.toggle('on', [1, 0.5][i] === video.playbackRate)));
    const media_ = h('div', {class: 'sc-media'}, h('div', {class: 'sc-player'}, video), h('div', {class: 'sc-ctrl'}, snd, h('span', {class: 'grp'}, speeds)));
    const body = h('div', {class: 'sc-body'});
    const el = h('article', {class: 'scene', id: `scene-${sc.id}`, 'data-id': sc.id}, media_, body);
    // перетащить файл референса прямо на карточку
    el.addEventListener('dragover', (e) => { if ([...(e.dataTransfer?.types ?? [])].includes('Files')) { e.preventDefault(); el.classList.add('over'); } });
    el.addEventListener('dragleave', (e) => { if (!el.contains(e.relatedTarget)) el.classList.remove('over'); });
    el.addEventListener('drop', (e) => { e.preventDefault(); el.classList.remove('over'); upRefs([...e.dataTransfer.files], sc.id); });
    cards.set(sc.id, {el, body, video, sig: ''});
    watch(el, video);
    fillBody(sc.id);
    return el;
  }

  function fillBody(id) {
    const c = cards.get(id), sc = sceneById(id);
    if (!c || !sc) return;
    const r = rv(id), d = draft(id);
    S.typing = false; // старые поля уходят из страницы, а blur при этом не приходит
    c.sig = sig(id);
    c.el.classList.remove('ok', 'fix', 'ask');
    if (r.rating) c.el.classList.add(r.rating);
    const body = c.body;
    body.replaceChildren();

    // заголовок и оценка
    const st = h('div', {class: 'status'});
    for (const [k, t] of Object.entries(RATING)) st.append(h('button', {class: `${k}${r.rating === k ? ' on' : ''}`, onclick: () => sop('scene-rate', {rating: r.rating === k ? null : k}, id)}, t));
    body.append(h('div', {class: 'sc-head'}, h('span', {class: 'sc-id'}, sc.id), h('h3', {class: 'sc-title'}, sc.title), h('span', {class: 'sc-time'}, range(sc)), st));
    if (sc.phrase) body.append(h('div', {class: 'sc-phrase'}, `«${sc.phrase}»`));
    if ((sc.frames ?? []).length) {
      const row = h('div', {class: 'sc-frames'}, 'Кадры:');
      for (const fid of sc.frames) {
        const fr = S.board.frames.find((f) => f.id === fid);
        row.append(h('button', {class: 'fchip', title: `Показать кадр ${fid} ниже`, onclick: () => gotoFrame(fid)}, fr?.img ? h('img', {src: media(fr.img), loading: 'lazy', alt: ''}) : null, fid));
      }
      body.append(row);
    }

    // заметка к сцене (сохраняется сама)
    const note = guard(h('textarea', {placeholder: 'Заметка к сцене: что оставить, что поменять…', rows: 2}));
    note.value = r.note ?? '';
    let tmr;
    note.addEventListener('input', () => {
      clearTimeout(tmr);
      tmr = setTimeout(() => api('scene-note', {scene: id, note: note.value}).then((j) => { S.review = j.review; c.sig = sig(id); }).catch((e) => toast(e.message)), 600);
    });
    body.append(note);

    // комментарии: ветка с ответами, у каждого можно отметить момент клипа
    const roots = r.comments ?? [];
    const thread = h('div', {class: 'thread'});
    for (const cm of roots) thread.append(commentEl(sc, cm, d));
    if (!roots.length) thread.append(h('span', {class: 'empty'}, 'Комментариев пока нет.'));
    body.append(h('div', {class: 'sc-sec'}, h('h4', {}, 'Комментарии', h('span', {class: 'n'}, roots.length || '')), thread, composeEl(sc, d)));

    // референсы анимации
    const live = (r.refs ?? []).filter((x) => !x.removed);
    const list = h('div', {class: 'refs'});
    for (const x of live) list.append(refEl(sc, x));
    body.append(h('div', {class: 'sc-sec'}, h('h4', {}, 'Референс анимации', h('span', {class: 'n'}, live.length || '')), live.length ? list : null, refForm(sc, d)));
  }

  function commentEl(sc, cm, d) {
    const id = sc.id, resolved = cm.status === 'resolved';
    const at = cm.t != null ? h('span', {class: 'at moment', title: 'Перемотать клип на этот момент', onclick: () => seek(id, cm.t)}, `на ${tcm(cm.t)}`) : null;
    const el = h('div', {class: `cmt${resolved ? ' resolved' : ''}`},
      h('div', {class: 'who'}, h('b', {class: isAgent(cm.by) ? 'agent' : null}, cm.by), h('span', {}, when(cm.at)), cm.tag ? h('span', {class: 'tagchip'}, cm.tag) : null, at, resolved ? h('span', {}, '· решено') : null),
      h('div', {class: 'txt'}, cm.text),
      h('div', {class: 'acts'},
        h('button', {onclick: () => { d.reply = {to: cm.id, text: ''}; fillBody(id); $(`#scene-${CSS.escape(id)} .replybox textarea`)?.focus(); }}, 'Ответить'),
        h('button', {onclick: () => sop('scene-comment-status', {id: cm.id, status: resolved ? 'open' : 'resolved'}, id)}, resolved ? 'Открыть снова' : 'Решено')));
    if ((cm.replies ?? []).length) {
      const rl = h('div', {class: 'replies'});
      for (const rp of cm.replies) rl.append(h('div', {class: 'rpl'}, h('div', {class: 'who'}, h('b', {class: isAgent(rp.by) ? 'agent' : null}, rp.by), h('span', {}, when(rp.at))), h('div', {class: 'txt'}, rp.text)));
      el.append(rl);
    }
    if (d.reply?.to === cm.id) {
      const ta = guard(h('textarea', {placeholder: 'Ответ… Ctrl+Enter: отправить', rows: 2}));
      ta.value = d.reply.text;
      ta.addEventListener('input', () => { d.reply.text = ta.value; });
      const send = async () => {
        const text = ta.value.trim();
        if (!text) return;
        d.reply = null;
        await sop('scene-comment', {text, parent: cm.id, author: author()}, id);
        toast('Ответ сохранён');
      };
      ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); });
      el.append(h('div', {class: 'compose replybox'}, ta, h('div', {class: 'row'}, h('button', {class: 'btn gold sm', onclick: send}, 'Ответить'), h('button', {class: 'btn sm', onclick: () => { d.reply = null; fillBody(id); }}, 'Отмена'))));
    }
    return el;
  }

  // форма нового комментария: текст, быстрая метка темы, «Отметить момент» (берёт время плеера)
  function composeEl(sc, d) {
    const id = sc.id;
    const ta = guard(h('textarea', {placeholder: 'Комментарий к сцене: здесь неправильный текст, здесь не нравится анимация… Ctrl+Enter: отправить', rows: 3}));
    ta.value = d.text;
    ta.addEventListener('input', () => { d.text = ta.value; });
    const chips = TAGS.map((t) => h('button', {class: `tag${d.tag === t ? ' on' : ''}`, title: 'О чём комментарий', onclick: () => { d.tag = d.tag === t ? null : t; paint(); }}, t));
    const moment = h('span', {class: 'moment-pill'});
    const paint = () => {
      chips.forEach((b, i) => b.classList.toggle('on', d.tag === TAGS[i]));
      moment.hidden = d.t == null;
      moment.replaceChildren(`на ${d.t != null ? tcm(d.t) : ''}`, h('button', {title: 'Убрать отметку', onclick: () => { d.t = null; paint(); }}, '×'));
    };
    const mark = () => {
      const v = cards.get(id)?.video;
      const t = sc.t0 + (v?.currentTime ?? 0);
      d.t = Math.round(Math.min(sc.t1, Math.max(sc.t0, t)) * 10) / 10;
      paint();
    };
    const send = async () => {
      const text = ta.value.trim();
      if (!text) { toast('Сначала напиши комментарий'); return; }
      const {t, tag} = d;
      d.text = ''; d.t = null; d.tag = null;
      await sop('scene-comment', {text, t, tag, author: author()}, id);
      toast('Комментарий сохранён');
    };
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); });
    paint();
    return h('div', {class: 'compose'}, ta,
      h('div', {class: 'tags'}, h('span', {class: 'lbl'}, 'Тема:'), chips),
      h('div', {class: 'row'}, h('button', {class: 'btn sm', title: 'Запомнить секунду, на которой сейчас стоит клип', onclick: mark}, '⏱ Отметить момент'), moment,
        h('span', {style: 'flex:1'}), h('button', {class: 'btn gold sm', onclick: send}, 'Отправить')));
  }

  // ── референсы анимации ──
  function shortUrl(u) {
    try { const x = new URL(u); return `${x.hostname.replace(/^www\./, '')}${x.pathname === '/' ? '' : x.pathname}`.slice(0, 60); } catch { return u.slice(0, 60); }
  }
  function refEl(sc, x) {
    const id = sc.id, resolved = x.status === 'resolved';
    let prev = null;
    if (x.kind === 'file') {
      const url = media(x.path), ext = extOf(x.path);
      prev = VIDEO_EXT.includes(ext) ? h('video', {src: url, controls: true, loop: true, playsinline: true, preload: 'metadata'}) : h('img', {src: url, loading: 'lazy', alt: x.name ?? '', title: 'Открыть крупно', onclick: () => window.open(url, '_blank')});
    }
    // ссылку открываем только если это http(s): остальное не превращаем в кликабельное
    const link = x.kind === 'url' ? (/^https?:\/\//i.test(x.url) ? h('a', {class: 'rlink', href: x.url, target: '_blank', rel: 'noopener noreferrer', title: x.url}, `🔗 ${shortUrl(x.url)}`) : h('span', {class: 'rlink'}, x.url)) : null;
    const take = guard(h('input', {class: 'take', placeholder: 'Что взять из референса'}));
    take.value = x.take ?? '';
    const sec = guard(h('input', {class: 'rsec', placeholder: 'секунда', title: 'Секунда в референсе, где нужное (необязательно): 4,4 или 1:20'}));
    sec.value = x.t != null ? String(x.t).replace('.', ',') : '';
    const save = (patch) => api('scene-ref-edit', {scene: id, id: x.id, ...patch}).then((j) => { S.review = j.review; cards.get(id).sig = sig(id); }).catch((e) => toast(e.message));
    take.addEventListener('change', () => save({take: take.value}));
    sec.addEventListener('change', () => save({t: sec.value}));
    take.addEventListener('keydown', (e) => { if (e.key === 'Enter') take.blur(); });
    return h('div', {class: `ref${resolved ? ' resolved' : ''}${link ? ' url' : ''}`}, prev ? h('div', {class: 'rmedia'}, prev) : null,
      h('div', {class: 'rinfo'}, link, h('span', {class: 'kind'}, `${x.kind === 'file' ? `Файл${x.name ? `: ${x.name}` : ''}` : 'Ссылка'} · ${x.by ?? ''} · ${when(x.at)}${resolved ? ' · решено' : ''}`),
        h('div', {class: 'row'}, take, sec),
        h('div', {class: 'row'},
          h('button', {class: 'lnk', onclick: () => sop('scene-ref-status', {id: x.id, status: resolved ? 'open' : 'resolved'}, id)}, resolved ? 'Открыть снова' : 'Решено'),
          h('button', {class: 'lnk', onclick: () => sop('scene-ref-remove', {id: x.id}, id)}, 'Убрать'))));
  }
  function refForm(sc, d) {
    const id = sc.id;
    const take = guard(h('input', {class: 'grow', placeholder: 'Что взять из референса'}));
    take.value = d.take;
    take.addEventListener('input', () => { d.take = take.value; });
    const rt = guard(h('input', {placeholder: 'секунда в референсе', style: 'width:160px', title: 'Секунда в референсе, где нужное: 4,4 или 1:20'}));
    rt.value = d.rt;
    rt.addEventListener('input', () => { d.rt = rt.value; });
    const quick = TAKES.map((t) => h('button', {class: 'tag', title: 'Добавить в поле «что взять»', onclick: () => { const have = take.value.split(/[,;]\s*/).filter(Boolean); if (!have.map((x) => x.toLowerCase()).includes(t.toLowerCase())) take.value = [...have, t.toLowerCase()].join(', '); d.take = take.value; }}, t));
    const url = guard(h('input', {class: 'grow', placeholder: 'Ссылка на референс: Instagram, YouTube, любая'}));
    url.value = d.url;
    url.addEventListener('input', () => { d.url = url.value; });
    const addUrl = async () => {
      if (!url.value.trim()) { toast('Вставь ссылку'); return; }
      const payload = {kind: 'url', url: url.value, take: take.value, t: rt.value, author: author()};
      try {
        d.url = ''; d.take = ''; d.rt = '';
        await sop('scene-ref', payload, id);
        toast('Референс добавлен');
      } catch (e) { d.url = payload.url; d.take = payload.take; d.rt = payload.t; fillBody(id); toast(e.message); }
    };
    url.addEventListener('keydown', (e) => { if (e.key === 'Enter') addUrl(); });
    const pick = h('input', {type: 'file', multiple: true, accept: REF_EXT.join(','), style: 'display:none', onchange: (e) => { upRefs([...e.target.files], id); e.target.value = ''; }});
    const drop = h('div', {class: 'drop'}, 'Перетащи сюда файл референса (mp4, webm, mov, gif, png, jpg), вставь из буфера (Ctrl+V) или ',
      h('a', {href: '#', onclick: (e) => { e.preventDefault(); pick.click(); }}, 'выбери файл'), pick);
    return h('div', {class: 'refform'},
      h('div', {class: 'row'}, take, rt), h('div', {class: 'tags'}, h('span', {class: 'lbl'}, 'Быстро:'), quick),
      h('div', {class: 'row'}, url, h('button', {class: 'btn sm', onclick: addUrl}, 'Добавить ссылку')), drop);
  }
  // загрузка файлов референса: сначала на диск (files/<сцена>/), потом запись в review.json
  async function upRefs(files, id) {
    const d = draft(id);
    let ok = 0;
    for (const file of files) {
      const ext = extOf(file.name) || TYPE_EXT[file.type] || '';
      if (!REF_EXT.includes(ext)) { toast(`«${file.name || 'файл'}»: формат не подходит. Нужны mp4, webm, mov, gif, png, jpg`); continue; }
      const name = file.name || `вставка${ext}`;
      toast(`Загружаю ${name}…`);
      try {
        const r = await fetch(`/api/upload?project=${encodeURIComponent(S.project)}&frame=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}`, {method: 'POST', body: file});
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'не загрузилось');
        await sop('scene-ref', {kind: 'file', path: j.path, name, take: d.take, t: d.rt, author: author()}, id);
        ok++;
      } catch (e) { toast(e.message); }
    }
    if (ok) { d.take = ''; d.rt = ''; fillBody(id); toast(ok > 1 ? `Референсов добавлено: ${ok}` : 'Референс добавлен: впиши, что из него взять'); }
  }

  // ── переходы между сценами и кадрами ──
  function gotoFrame(fid) {
    select(fid, {});
    setTimeout(() => $(`#card-${CSS.escape(fid)}`)?.scrollIntoView({block: 'center', behavior: 'smooth'}), 30);
  }
  function gotoScene(id) {
    if (!cards.has(id)) { S.filter = 'all'; ctx.refilter(); }
    $(`#scene-${CSS.escape(id)}`)?.scrollIntoView({block: 'start', behavior: 'smooth'});
  }
  const sceneOfFrame = (fid) => scenes().find((s) => (s.frames ?? []).includes(fid))?.id ?? null;

  // ── фильтры верхней панели действуют и на сцены ──
  function visible(sc) {
    const r = rv(sc.id);
    if (S.filter === 'fix') return r.rating === 'fix' || r.rating === 'ask';
    if (S.filter === 'cmt') return (r.comments ?? []).some((c) => c.status !== 'resolved');
    if (S.filter === 'ok') return r.rating === 'ok';
    if (S.filter === 'none') return !r.rating;
    return true;
  }

  // ── вся секция ──
  function paint() {
    const sec = $('#scenesSec'), list = scenes();
    sec.hidden = !list.length;
    $('#framesTitle').hidden = !list.length;
    sec.replaceChildren();
    for (const [, c] of cards) { c.video.pause(); c.video.removeAttribute('src'); c.video.load(); } // отпускаем старые плееры
    cards.clear();
    io?.disconnect();
    if (!list.length) return;
    const shown = list.filter(visible);
    sec.append(h('h2', {class: 'sec-title'}, 'Сцены', h('span', {}, `${shown.length === list.length ? list.length : `${shown.length} из ${list.length}`} · куски ролика по несколько секунд`)),
      h('p', {class: 'sec-hint'}, 'Смотри, как работает каждая сцена, и пиши прямо под ней: что не так в тексте, анимации, тайминге, звуке. Можно отметить момент клипа и приложить референс нужной анимации. Ниже те же куски по кадрам.'));
    const wrap = h('div', {class: 'scenes'});
    if (!shown.length) wrap.append(h('p', {class: 'empty'}, 'По этому фильтру сцен нет.'));
    for (const sc of shown) wrap.append(cardFor(sc));
    sec.append(wrap);
    sec.onpointerover = (e) => { hover = e.target.closest?.('.scene')?.dataset.id ?? null; };
    sec.onpointerleave = () => { hover = null; };
  }
  // после ответа сервера или правки с другого окна: перерисовываем только изменившиеся карточки
  function repaint(ids) {
    for (const id of ids) if (cards.has(id)) fillBody(id);
  }
  function refresh() {
    for (const [id, c] of cards) if (c.sig !== sig(id)) fillBody(id);
  }

  // Ctrl+V: файл из буфера уходит в референс той сцены, над которой мышь или в которой стоит курсор
  function paste(e) {
    const files = [...(e.clipboardData?.files ?? [])];
    if (!files.length || e.clipboardData.getData('text/plain')) return false;
    const id = document.activeElement?.closest?.('.scene')?.dataset.id ?? hover;
    if (!id || !cards.has(id)) return false;
    e.preventDefault();
    upRefs(files, id);
    return true;
  }

  // сводка правок по сценам для окна «Сводка правок»
  function summaryLines(all = false) {
    const L = [];
    for (const sc of scenes()) {
      const r = rv(sc.id);
      const cs = (r.comments ?? []).filter((c) => all || c.status !== 'resolved' || (c.replies ?? []).length), rs = (r.refs ?? []).filter((x) => !x.removed);
      if (!r.rating && !r.note && !cs.length && !rs.length) continue;
      L.push(`## ${sc.id} · ${range(sc)} · «${sc.title}»${r.rating ? ` · ${RATING[r.rating] ?? 'Вопрос'}` : ''}`);
      if (r.note) L.push(`Заметка: ${r.note}`);
      for (const c of cs) {
        L.push(`- ${c.status === 'resolved' ? '[решено] ' : ''}${c.by}${c.tag ? ` · ${c.tag}` : ''}${c.t != null ? ` · на ${tcm(c.t)}` : ''}: ${c.text}`);
        for (const rp of c.replies ?? []) L.push(`  - ${rp.by}: ${rp.text}`);
      }
      for (const x of rs) L.push(`- референс${x.status === 'resolved' ? ' [решено]' : ''}: ${x.kind === 'file' ? x.path : x.url}${x.take ? ` · взять: ${x.take}` : ''}${x.t != null ? ` · с ${String(x.t).replace('.', ',')} с` : ''}`);
      L.push('');
    }
    return L;
  }

  // при смене ролика черновики прошлого не переезжают в новый
  const reset = () => { for (const k of Object.keys(drafts)) delete drafts[k]; hover = null; };

  return {paint, reset, refresh, repaint, visible, paste, gotoScene, gotoFrame, sceneOfFrame, summaryLines, openCount, rv, range, tcs};
}
