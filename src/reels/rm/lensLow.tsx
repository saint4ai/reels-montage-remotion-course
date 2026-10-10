import React from 'react';
import {AbsoluteFill, Img, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import {Captions} from '../../montage/Captions';
import {E, k} from '../../montage/parts';
import type {Word} from '../../montage/words';
import {decryptAt} from '../../kit/reactbits';
import {type Blob, type Cam, Dot, enter, type Enter, Ico, LENS_ICON, LensBlobs, LensGrid, type LensMove, LensVignette, makeCamera, Place} from '../../kit/lens';
import {SpeakerStrip, STRIP} from '../../kit/strip';

// ЛИНЗА с альбомной записью (перемонтаж 10.10.2026, ролики ghtricks, agentation, hour). Тот же холст, линза и стеклянные капсулы,
// что в laya31 и artemis32 (src/kit/lens.tsx), но запись спикера альбомная 1920×1080: она стоит внизу карточкой-полосой 900 px
// (35% высоты, SpeakerStrip: запись по высоте целиком, лицо не срезается сверху, бока симметрично, отступ 130 и радиус 110 от
// обрезки Instagram), а холст с линзой идёт на весь кадр под ней. Центр линзы остался на (720, 600), сцены сдвинуты камерой вниз
// на CAM_DY, чтобы капсулы стояли в зоне y 370…1300 между верхней панелью Instagram и субтитрами (cy 1540).
export const W = 1440, H = 2560;
export const INK = '#0E0F11', MINT = '#3DEDC3', MINT_D = '#0B9E7C', ORANGE = '#FF7A2F', PAPER = '#F7F8F6';
export const SANS = 'SF Pro Display', SOYUZ = 'Soyuz Grotesk', MONO = 'JBM';
export const CARD_TOP = H - STRIP.h35;
export const CAPTION_CY = 1540;
export const CAM_DY = 225;
export const lerp = (a: number, b: number, m: number) => a + (b - a) * m;
export const cl = (v: number) => Math.max(0, Math.min(1, v));
export const sp = (t: number, at: number, fps: number, damping = 16, stiffness = 140) =>
  t < at ? 0 : spring({frame: (t - at) * fps, fps, config: {damping, stiffness, mass: 1}});

// ══════════ слова записи ══════════
export type RawWord = {w: string; t0: number; t1: number};
// Слова whisper: правки только написания (Claude, ё, числа цифрами), одиночные дефисы убраны. Пустая замена приклеивает слово к предыдущему.
export const buildWords = (raw: RawWord[], fix: Record<string, string> = {}): Word[] => {
  const out: Word[] = [];
  for (const r of raw) {
    if (r.w === '-' || r.w === String.fromCharCode(0x2014)) continue;
    const text = Object.prototype.hasOwnProperty.call(fix, r.w) ? fix[r.w] : r.w;
    if (text === '') { if (out.length) out[out.length - 1].end = Math.max(out[out.length - 1].end, r.t1); continue; }
    out.push({text, start: r.t0, end: Math.max(r.t1, r.t0 + 0.08)});
  }
  return out;
};
const norm = (s: string) => s.toLowerCase().replace(/[.,:;!?«»"'()]/g, '').replace(/ё/g, 'е');
// T('слово', n): начало n-го (с нуля) слова речи; TE - его конец. Нет слова - ошибка сразу, а не молчаливый сдвиг.
export const makeT = (words: Word[]) => {
  const find = (w: string, n: number) => {
    const q = norm(w);
    let c = 0;
    for (const x of words) if (norm(x.text) === q) { if (c === n) return x; c++; }
    throw new Error(`слово «${w}» (${n}) не найдено в речи`);
  };
  return {T: (w: string, n = 0) => find(w, n).start, TE: (w: string, n = 0) => find(w, n).end};
};

// ══════════ камера и фон ══════════
export const lowCamera = <K extends string>(stations: Record<K, readonly [number, number]>, moves: LensMove<K>[], start: K) => {
  const base = makeCamera(stations, moves, start);
  return (t: number): Cam => { const c = base(t); return {...c, y: c.y - CAM_DY}; };
};
// по два пятна у станции: мята и оранжевый по очереди, чтобы за стеклом было что размывать
export const autoBlobs = (stations: Record<string, readonly [number, number]>): Blob[] => {
  const out: Blob[] = [];
  Object.values(stations).forEach(([x, y], i) => {
    out.push({x: x - 180 + (i % 2) * 120, y: y + 120, r: 520, c: '61,237,195', a: 0.42});
    out.push({x: x + 420 - (i % 3) * 140, y: y - 260 + (i % 2) * 120, r: 420, c: '255,122,47', a: i % 2 ? 0.28 : 0.24});
  });
  return out;
};
export const LowPlace: React.FC<{cam: Cam; x: number; y: number; depth?: number; children: React.ReactNode}> = ({cam, x, y, depth = 0.8, children}) =>
  <Place cam={cam} x={x} y={y} h={H} depth={depth}>{children}</Place>;
export const Stage: React.FC<{cam: Cam; t: number; blobs: Blob[]; children: React.ReactNode}> = ({cam, t, blobs, children}) => (
  <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, overflow: 'hidden', background: PAPER}}>
    <LensBlobs cam={cam} t={t} blobs={blobs} />
    <LensGrid cam={cam} h={H} />
    {children}
    <LensVignette />
  </div>
);

// ══════════ иконки сверх набора ЛИНЗЫ ══════════
const X_ICON: Record<string, string> = {
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', file: 'M6 3h8l4 4v14H6z M14 3v4h4',
  question: 'M9 9a3 3 0 1 1 4.5 2.6c-1 .6-1.5 1.2-1.5 2.4 M12 17.5v.5', play: 'M8 5v14l11-7z',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z M6 11a6 6 0 0 0 12 0 M12 17v4', search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M16.5 16.5L21 21',
  copy: 'M9 9h11v11H9z M5 15V4h11', doc: 'M6 3h12v18H6z M9 8h6 M9 12h6 M9 16h4', chat: 'M4 5h16v11H9l-5 4z', cursor: 'M5 3l14 7-6 2-2 6z',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v5l3 2', sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M19 5l-2 2 M7 17l-2 2',
  calendar: 'M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4', enter: 'M20 5v8H6 M10 9l-4 4 4 4', plus: 'M12 5v14 M5 12h14', x: 'M6 6l12 12 M18 6L6 18',
  bell: 'M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z M10 21h4', sparkle: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z', pencil: 'M4 20l1-5L16 4l4 4L9 19z M14 6l4 4',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', trash: 'M5 7h14 M9 7V4h6v3 M7 7l1 13h8l1-13',
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M19 5l-2 2 M7 17l-2 2', pause: 'M8 5v14 M16 5v14',
  layout: 'M4 5h16v14H4z M4 10h16 M10 10v9', route: 'M6 5a2 2 0 1 0 0 .1 M18 19a2 2 0 1 0 0 .1 M6 7v4a4 4 0 0 0 4 4h4a4 4 0 0 1 4 4', arrowup: 'M12 19V5 M6 11l6-6 6 6',
  user2: 'M9 8a3 3 0 1 0 0 .1 M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6 M17 9a2.5 2.5 0 1 0 0 .1 M16 14c3 0 5 2 5 5', listplus: 'M4 6h12 M4 12h8 M4 18h8 M18 12v8 M14 16h8', plug: 'M9 3v5 M15 3v5 M6 8h12v4a6 6 0 0 1-12 0z M12 18v3', addfolder: 'M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M12 11v6 M9 14h6',
};
export const IcoX: React.FC<{name: string; s: number; c: string; w?: number}> = ({name, s, c, w = 2.2}) => (
  <svg width={s} height={s} viewBox="0 0 24 24" style={{flex: 'none', overflow: 'visible'}}>
    <path d={X_ICON[name] ?? LENS_ICON[name] ?? ''} fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const hasIco = (name: string) => !!(X_ICON[name] || LENS_ICON[name]);
void Ico;

// ══════════ снимок в стеклянной раме ══════════
export const Shot: React.FC<{src: string; nw: number; nh: number; w: number; a: number; mode?: Enter; crop?: [number, number, number, number]; pad?: number; r?: number;
  wipe?: number; children?: (s: number) => React.ReactNode; style?: React.CSSProperties; blur?: number}> =
  ({src, nw, nh, w, a, mode = 'rise', crop, pad = 14, r = 34, wipe = 1, children, style, blur = 0}) => {
    if (a <= 0) return null;
    const [cx, cy, cw, ch] = crop ?? [0, 0, nw, nh];
    const s = w / cw, h = ch * s;
    return (
      <div style={{...enter(mode, a), padding: pad, borderRadius: r, background: 'linear-gradient(180deg, rgba(255,255,255,.75), rgba(255,255,255,.45))', border: '2px solid #FFFFFF',
        boxShadow: '0 40px 90px rgba(14,15,17,.16), inset 0 2px 0 #FFFFFF', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', ...style}}>
        <div style={{position: 'relative', width: w, height: h, borderRadius: r - pad, overflow: 'hidden', clipPath: wipe < 1 ? `inset(0 0 ${(1 - wipe) * 100}% 0)` : undefined,
          filter: blur > 0 ? `blur(${blur}px)` : undefined}}>
          <Img src={staticFile(src)} style={{position: 'absolute', left: -cx * s, top: -cy * s, width: nw * s, height: nh * s, maxWidth: 'none'}} />
          {children ? children(s) : null}
        </div>
      </div>
    );
  };

// ══════════ адресная строка: предмет-эстафета перебора слов ══════════
// Домен крупно, путь мелко; меняемая часть домена перебирает знаки (DecryptedText React Bits) и встаёт в новое слово.
// words: стартовое слово домена и цепочка замен; hlFrom - с какого момента подсветить будущую замену мятным.
export const UrlCard: React.FC<{t: number; a: number; mode?: Enter; start: string; swaps: {at: number; to: string; dur?: number}[]; hlFrom?: number; tld?: string; path?: string; size?: number;
  tone?: 'glass' | 'ink'}> = ({t, a, mode = 'rise', start, swaps, hlFrom, tld = '.com', path = '/anthropics/claude-code', size = 104, tone = 'glass'}) => {
  if (a <= 0) return null;
  let prev = start, cur = start, last: {at: number; to: string; dur?: number} | null = null;
  for (const s of swaps) { if (t >= s.at) { prev = cur; cur = s.to; last = s; } else break; }
  let pre = '', shown = cur, done = true, p = 1;
  if (last) {
    let n = 0;
    while (n < prev.length && n < cur.length && prev[n] === cur[n]) n++;
    pre = cur.slice(0, n);
    const d = decryptAt(t, last.at, prev.slice(n), cur.slice(n), last.dur ?? 0.5, 'abcdefghijklmnopqrstuvwxyz', 'url');
    shown = d.text; done = d.done; p = d.p;
  }
  const next = swaps.find((s) => s.at > t);
  // подсветка будущей замены включается, пока прошлая замена закончила перебор
  const hlOn = done && !!next && hlFrom !== undefined && t >= hlFrom;
  const hl = hlOn ? k(t, hlFrom as number, (hlFrom as number) + 0.25) : last ? 1 - k(t, last.at + (last.dur ?? 0.5), last.at + (last.dur ?? 0.5) + 0.7, E.inOut) : 0;
  const fg = tone === 'ink' ? '#FFFFFF' : INK;
  // при подсветке будущей замены подсвечивается хвост текущего слова после общего начала со следующим
  let hlStart = pre.length;
  if (hlOn && next) { let n = 0; while (n < cur.length && n < next.to.length && cur[n] === next.to[n]) n++; hlStart = n; }
  const word = hlOn ? cur : pre + shown;
  const head = word.slice(0, hlStart), tail = word.slice(hlStart);
  const pulse = 1 + (p < 1 ? 0.03 * Math.sin(p * Math.PI) : 0);
  return (
    <div style={{display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, padding: `${size * 0.34}px ${size * 0.54}px`, borderRadius: size * 0.7, boxSizing: 'border-box',
      ...(tone === 'ink' ? {background: 'linear-gradient(160deg, #3A3F44, #0E0F11)', boxShadow: '0 30px 70px rgba(14,15,17,.3)'}
        : {background: 'linear-gradient(180deg, rgba(255,255,255,.78), rgba(255,255,255,.46))', border: '2px solid rgba(255,255,255,.95)', backdropFilter: 'blur(26px) saturate(1.8)', WebkitBackdropFilter: 'blur(26px) saturate(1.8)',
          boxShadow: '0 24px 60px rgba(14,15,17,.12), 0 3px 10px rgba(14,15,17,.06), inset 0 2px 0 #FFFFFF'}), ...enter(mode, a)}}>
      <div style={{display: 'flex', alignItems: 'baseline', fontFamily: MONO, fontWeight: 700, fontSize: size, letterSpacing: '-0.04em', lineHeight: 1.05, whiteSpace: 'nowrap', color: fg, transform: `scale(${pulse})`, transformOrigin: '0 50%'}}>
        <span>{head}</span>
        <span style={{position: 'relative', color: tone === 'ink' ? MINT : fg}}>
          <span style={{position: 'absolute', left: -size * 0.06, right: -size * 0.06, top: size * 0.06, bottom: -size * 0.04, borderRadius: size * 0.2, background: `rgba(61,237,195,${0.55 * hl})`,
            boxShadow: hl > 0 ? `0 0 ${24 * hl}px rgba(61,237,195,${0.6 * hl})` : undefined}} />
          <span style={{position: 'relative', color: hl > 0.5 && tone !== 'ink' ? '#05231D' : undefined}}>{tail}</span>
        </span>
        <span style={{opacity: done || tail ? 1 : 0.4}}>{tld}</span>
      </div>
      <div style={{fontFamily: MONO, fontWeight: 500, fontSize: size * 0.38, color: tone === 'ink' ? 'rgba(255,255,255,.55)' : 'rgba(14,15,17,.5)', letterSpacing: '-0.02em'}}>{path}</div>
    </div>
  );
};

// ══════════ курсор и клик внутри предмета (координаты в пикселях предмета) ══════════
export type CurPt = {t: number; x: number; y: number};
export const curPos = (t: number, pts: CurPt[]): {x: number; y: number} => {
  if (t <= pts[0].t) return {x: pts[0].x, y: pts[0].y};
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i].t) {
      const m = k(t, pts[i - 1].t, pts[i].t, E.inOut), a = pts[i - 1], b = pts[i];
      const bend = Math.sin(Math.PI * m) * 0.08 * (b.y - a.y);
      return {x: lerp(a.x, b.x, m) + bend, y: lerp(a.y, b.y, m)};
    }
  }
  const l = pts[pts.length - 1];
  return {x: l.x, y: l.y};
};
export const Pointer: React.FC<{t: number; pts: CurPt[]; clicks?: number[]; s?: number; show?: [number, number]}> = ({t, pts, clicks = [], s = 90, show}) => {
  const vis = show ? k(t, show[0], show[0] + 0.2) * (1 - k(t, show[1] - 0.2, show[1])) : k(t, pts[0].t - 0.2, pts[0].t + 0.1);
  if (vis <= 0) return null;
  const {x, y} = curPos(t, pts);
  const last = clicks.filter((c) => t >= c).pop();
  const since = last === undefined ? 9 : t - last, press = since < 0.18 ? Math.sin((since / 0.18) * Math.PI) : 0;
  return (
    <div style={{position: 'absolute', left: x, top: y, opacity: vis, pointerEvents: 'none', zIndex: 5}}>
      {clicks.map((c, i) => <Burst key={i} t={t} at={c} r={s * 0.8} />)}
      <svg width={s} height={s * 1.3} viewBox="0 0 24 31" style={{position: 'absolute', left: -s * 0.12, top: -s * 0.06, transform: `scale(${1 - press * 0.16})`, transformOrigin: '10% 5%',
        filter: 'drop-shadow(0 6px 10px rgba(0,0,0,.3))', overflow: 'visible'}}>
        <path d="M2 1.5 L2 24.5 L7.6 19.3 L11.3 28 L15.2 26.4 L11.6 17.9 L19.2 17.9 Z" fill="#FFFFFF" stroke="#0B0C0E" strokeWidth={1.7} strokeLinejoin="round" />
      </svg>
    </div>
  );
};
// клик: мятное кольцо и восемь коротких штрихов (ClickSpark React Bits, покадрово)
export const Burst: React.FC<{t: number; at: number; r?: number; x?: number; y?: number; color?: string}> = ({t, at, r = 70, x = 0, y = 0, color = MINT_D}) => {
  if (t < at || t > at + 0.5) return null;
  const p = k(t, at, at + 0.5, E.out);
  return (
    <svg width={1} height={1} style={{position: 'absolute', left: x, top: y, overflow: 'visible', pointerEvents: 'none'}}>
      <circle cx={0} cy={0} r={r * p} fill="none" stroke={color} strokeWidth={6} opacity={1 - p} />
      {Array.from({length: 8}, (_, i) => {
        const ang = (Math.PI * 2 * i) / 8 + 0.3, d = 16 + r * 0.9 * p, l = 26 * (1 - p);
        return <line key={i} x1={Math.cos(ang) * d} y1={Math.sin(ang) * d} x2={Math.cos(ang) * (d + l)} y2={Math.sin(ang) * (d + l)} stroke={color} strokeWidth={5} strokeLinecap="round" opacity={1 - p * 0.6} />;
      })}
    </svg>
  );
};

// ══════════ мелкие общие детали ══════════
// плитка «Трюк N»: цифра в кружке и слово
export const NumDot: React.FC<{n: string | number; tone?: 'mint' | 'ink' | 'orange'; s?: number}> = ({n, tone = 'mint', s = 100}) => (
  <Dot tone={tone} s={s}><span style={{fontFamily: SOYUZ, fontWeight: 700, fontSize: s * 0.46, color: tone === 'mint' ? '#05231D' : '#FFFFFF'}}>{n}</span></Dot>
);
// пунктир между двумя точками экрана-зоны; длина p от 0 до 1
export const Dash: React.FC<{x1: number; y1: number; x2: number; y2: number; p: number; t: number; color?: string; w?: number; bend?: number}> = ({x1, y1, x2, y2, p, t, color = MINT_D, w = 5, bend = 0}) => {
  if (p <= 0) return null;
  const mx = (x1 + x2) / 2 + bend, my = (y1 + y2) / 2;
  const ex = lerp(x1, x2, p), ey = lerp(y1, y2, p);
  return (
    <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none'}}>
      <path d={`M${x1} ${y1} Q ${lerp(x1, mx, p)} ${lerp(y1, my, p)} ${ex} ${ey}`} fill="none" stroke={color} strokeWidth={w} strokeDasharray="4 14" strokeLinecap="round" strokeDashoffset={-t * 50} />
    </svg>
  );
};

// ══════════ звук: эффекты из public/sfx ×0,37 ══════════
export const Sfx: React.FC<{list: [number, string, number][]; fps: number}> = ({list, fps}) => (
  <>
    {list.map(([at, name, v], i) => (
      <Sequence key={i} from={Math.max(0, Math.round(at * fps))} durationInFrames={Math.round(2 * fps)} layout="none">
        <Audio src={staticFile(`sfx/${name}.wav`)} volume={v * 0.37} />
      </Sequence>
    ))}
  </>
);

// ══════════ каркас ролика: холст с линзой на весь кадр, субтитры, карточка с записью, голос и звук ══════════
export const LensReel: React.FC<{id: string; rec?: string | null; words: Word[]; srcW: number; srcH: number; camera: (t: number) => Cam; blobs: Blob[]; sfx: [number, string, number][];
  Stations: React.FC<{t: number; fps: number; cam: Cam}>}> = ({rec = null, words, srcW, srcH, camera, blobs, sfx, Stations}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const cam = camera(t);
  return (
    <AbsoluteFill style={{background: PAPER}}>
      <Stage cam={cam} t={t} blobs={blobs}>
        {/* станции холста только над строкой субтитров: соседние станции не копятся внизу у субтитров и карточки */}
        <div style={{position: 'absolute', inset: 0, WebkitMaskImage: 'linear-gradient(180deg, #000 0px, #000 1360px, transparent 1470px)', maskImage: 'linear-gradient(180deg, #000 0px, #000 1360px, transparent 1470px)'}}>
          <Stations t={t} fps={fps} cam={cam} />
        </div>
      </Stage>
      <Captions t={t} words={words} cx={720} cy={CAPTION_CY} maxW={960} family={SANS} weight={700} accent={MINT_D} light />
      {/* запись целиком по высоте (zoom 1: верх и низ кадра на месте, голова не срезается), мятная кромка по контуру карточки */}
      <SpeakerStrip src={rec} srcW={srcW} srcH={srcH} h={STRIP.h35} inset={STRIP.insetIg} r={STRIP.rIg} zoom={1} shade={0.2}
        style={{boxShadow: `0 -26px 70px rgba(14,15,17,.2), 0 0 0 4px ${MINT}, 0 0 34px rgba(61,237,195,.5)`}} />
      {/* голос из самой записи (audio.mp3 моно 16 кГц, он только для распознавания); карточка выше немая */}
      {rec ? <Audio src={staticFile(rec)} /> : null}
      <Sfx list={sfx} fps={fps} />
    </AbsoluteFill>
  );
};
