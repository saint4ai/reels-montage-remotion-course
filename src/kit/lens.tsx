import React from 'react';
import {staticFile} from 'remotion';
import {E, k} from '../montage/parts';

// Стиль 14 «ЛИНЗА» (LENS). Утверждён автором курса 27.09.2026 на ролике «Laya».
// Белый холст в клетку, по которому плавно едет камера; холст, цветные пятна и все элементы проходят через линзу
// «рыбий глаз» (центр без искажений, края сжаты и выгнуты). Главный элемент — стеклянная капсула: кружок-иконка + слово +
// состояние (переключатель, кольцо процента, полоса, галочка), появляется ровно на своём слове. Эстетика Apple-презентации:
// чёрный SF Pro, печать заголовков по словам, мягкие пружины без перелёта. Паттерн: patterns/styles/lens/PATTERN.md.
// Образец: src/reels/laya31/Reel.tsx.

export const LENS_W = 1440;
export const LENS_INK = '#0E0F11', LENS_MINT = '#3DEDC3', LENS_MINT_D = '#0B9E7C', LENS_PAPER = '#F7F8F6';
const SANS = 'SF Pro Display', SOYUZ = 'Soyuz Grotesk';
const INK = LENS_INK, MINT = LENS_MINT, MINT_D = LENS_MINT_D, W = LENS_W;
const lerp = (a: number, b: number, m: number) => a + (b - a) * m;

// ══════════ камера по холсту ══════════
export type Cam = {x: number; y: number; z: number};
export type LensMove<K extends string> = {a: number; b: number; from: K; to: K; z: number};
// станции — центры в координатах холста; проезды — по фразам речи; z — лёгкий отъезд в середине пути (0,86 перелёт,
// 0,97 панорама); к камере добавлен медленный дрейф, чтобы холст жил и на месте
export const makeCamera = <K extends string>(stations: Record<K, readonly [number, number]>, moves: LensMove<K>[], start: K) => (t: number): Cam => {
  let pos: [number, number] = [stations[start][0], stations[start][1]], z = 1;
  for (const m of moves) {
    if (t >= m.b) { pos = [stations[m.to][0], stations[m.to][1]]; continue; }
    if (t > m.a) {
      const pl = (t - m.a) / (m.b - m.a), p = E.inOut(pl);
      pos = [lerp(stations[m.from][0], stations[m.to][0], p), lerp(stations[m.from][1], stations[m.to][1], p)];
      z = 1 - (1 - m.z) * Math.sin(Math.PI * pl);
    }
    break;
  }
  return {x: pos[0] + Math.sin(t * 0.35) * 14, y: pos[1] + Math.cos(t * 0.28) * 10, z};
};

// ══════════ линза «рыбий глаз» ══════════
// k = 1/√(1 + A·(r/R)²): центр без искажений, к краям сжатие; функция монотонная, заполняет углы кадра.
// Центр линзы — центр зоны моушна (для формата 40/60: 720, 600 при высоте зоны 1240).
export const LENS = {cx: 720, cy: 600, r: 1000, a: 0.85};
const lensK = (fx: number, fy: number) => 1 / Math.sqrt(1 + LENS.a * ((fx * fx + fy * fy) / (LENS.r * LENS.r)));
export const toScreen = (cam: Cam, wx: number, wy: number) => {
  const fx = (wx - cam.x) * cam.z, fy = (wy - cam.y) * cam.z, kk = lensK(fx, fy);
  return {x: LENS.cx + fx * kk, y: LENS.cy + fy * kk, s: kk * cam.z};
};
// любой элемент на холсте: центр в точке холста, масштаб по линзе
// depth — объём: элемент чуть поворачивается по кривизне линзы, как на поверхности шара (0 — плоско)
export const Place: React.FC<{cam: Cam; x: number; y: number; h?: number; depth?: number; children: React.ReactNode}> = ({cam, x, y, h = 1240, depth = 1, children}) => {
  const p = toScreen(cam, x, y);
  if (p.x < -900 || p.x > W + 900 || p.y < -800 || p.y > h + 800) return null;
  const ry = ((p.x - LENS.cx) / LENS.cx) * 16 * depth, rx = -((p.y - LENS.cy) / LENS.cy) * 10 * depth;
  return <div style={{position: 'absolute', left: p.x, top: p.y, transform: `translate(-50%, -50%) perspective(1800px) rotateY(${ry}deg) rotateX(${rx}deg) scale(${p.s})`}}>{children}</div>;
};
// сетка 90 px, каждая четвёртая линия темнее; линии строятся точками через линзу, поэтому выгибаются
export const LensGrid: React.FC<{cam: Cam; h?: number; cell?: number}> = ({cam, h = 1240, cell = 90}) => {
  const M = 2300 / cam.z, minor: string[] = [], major: string[] = [];
  const pt = (wx: number, wy: number) => { const p = toScreen(cam, wx, wy); return `${p.x.toFixed(1)} ${p.y.toFixed(1)}`; };
  const x0 = Math.floor((cam.x - M) / cell) * cell, x1 = cam.x + M, y0 = Math.floor((cam.y - M) / cell) * cell, y1 = cam.y + M;
  for (let gx = x0; gx <= x1; gx += cell) {
    const s: string[] = [];
    for (let wy = y0; wy <= y1; wy += 70) s.push(pt(gx, wy));
    (Math.round(gx / cell) % 4 === 0 ? major : minor).push(`M${s.join(' L')}`);
  }
  for (let gy = y0; gy <= y1; gy += cell) {
    const s: string[] = [];
    for (let wx = x0; wx <= x1; wx += 70) s.push(pt(wx, gy));
    (Math.round(gy / cell) % 4 === 0 ? major : minor).push(`M${s.join(' L')}`);
  }
  return (
    <svg width={W} height={h} style={{position: 'absolute', left: 0, top: 0}}>
      <path d={minor.join(' ')} fill="none" stroke="rgba(14,15,17,.065)" strokeWidth={2} />
      <path d={major.join(' ')} fill="none" stroke="rgba(14,15,17,.11)" strokeWidth={2.4} />
    </svg>
  );
};
// цветные пятна на холсте (мята и оранжевый): за стеклом им есть что размывать; ставить 1–2 у каждой станции
export type Blob = {x: number; y: number; r: number; c: string; a: number};
export const LensBlobs: React.FC<{cam: Cam; t: number; blobs: Blob[]}> = ({cam, t, blobs}) => (
  <>
    {blobs.map((b, i) => (
      <Place key={i} cam={cam} x={b.x + Math.sin(t * 0.4 + i) * 60} y={b.y + Math.cos(t * 0.33 + i * 1.7) * 50}>
        <div style={{width: b.r * 2, height: b.r * 2, borderRadius: '50%', background: `radial-gradient(closest-side, rgba(${b.c},${b.a}), rgba(${b.c},${b.a * 0.35}) 55%, rgba(${b.c},0))`}} />
      </Place>
    ))}
  </>
);
// виньетка линзы: края чуть темнее
export const LensVignette: React.FC = () => (
  <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(75% 70% at 50% 48%, rgba(255,255,255,0) 60%, rgba(14,15,17,.07) 100%)', pointerEvents: 'none'}} />
);

// ══════════ стекло и капсулы ══════════
export const LENS_ICON: Record<string, string> = {
  mail: 'M3 6h18v12H3z M3 6l9 7 9-7', shield: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z', bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  user: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7', down: 'M12 3v12 M6.5 10.5L12 16l5.5-5.5 M5 20h14',
  unlock: 'M6 11h12v10H6z M8.5 11V8a3.5 3.5 0 0 1 6.8-1.2', lock: 'M6 11h12v10H6z M8.5 11V8a3.5 3.5 0 0 1 7 0v3', key: 'M8 14a4 4 0 1 1 3.9-4.9L21 9v3.5h-2.5V15H16v-2.2l-4.2.1A4 4 0 0 1 8 14z',
  card: 'M3 6h18v12H3z M3 10h18 M6 15h4', box: 'M3 8l9-4 9 4v9l-9 4-9-4z M3 8l9 4 9-4 M12 12v9', briefcase: 'M3 8h18v12H3z M8 8V5h8v3 M3 13h18',
  chip: 'M7 7h10v10H7z M9.5 3v4 M14.5 3v4 M9.5 17v4 M14.5 17v4 M3 9.5h4 M3 14.5h4 M17 9.5h4 M17 14.5h4', globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M3 12h18 M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9 M12 3c-2.5 2.6-3.8 5.6-3.8 9s1.3 6.4 3.8 9',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 11v6 M12 7.5v.5', target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z M12 11.5v1',
  check: 'M4.5 12.5l5 5L19.5 7', cloud: 'M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 9.1 4.5 4.5 0 0 0 7 18z', laptop: 'M5 5h14v10H5z M2.5 18.5h19l-1.5-3.5H4z',
  link: 'M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2 M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2',
  plane: 'M21.5 2.5 L2.5 9.8 L10.2 13.3 L13.7 21 Z M21.5 2.5 L10.2 13.3',
  bug: 'M8 9h8v6a4 4 0 0 1-8 0z M12 9V7 M9.5 6.5a2.5 2.5 0 0 1 5 0 M4 11h4 M16 11h4 M4 17l4-2 M20 17l-4-2 M5 5l3 3 M19 5l-3 3',
  code: 'M8 7l-5 5 5 5 M16 7l5 5-5 5 M14 4l-4 16', phone: 'M7 2.5h10v19H7z M11 18.5h2', star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  logs: 'M5 4h14v16H5z M8 8h8 M8 12h8 M8 16h5', image: 'M4 5h16v14H4z M4 16l5-5 4 4 3-3 4 4 M15.5 9a1 1 0 1 0 0 .1', hourglass: 'M6 3h12 M6 21h12 M7 3c0 5 5 6 5 9s-5 4-5 9 M17 3c0 5-5 6-5 9s5 4 5 9', text: 'M5 6V4h14v2 M12 4v16 M9 20h6',
};
export const Ico: React.FC<{name: string; s: number; c: string; w?: number}> = ({name, s, c, w = 2.2}) => (
  <svg width={s} height={s} viewBox="0 0 24 24" style={{flex: 'none', overflow: 'visible'}}><path d={LENS_ICON[name]} fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" /></svg>
);
// настоящий логотип из public/brand, одноцветный через маску
export const BrandMask: React.FC<{name: string; w: number; color?: string}> = ({name, w, color = '#FFFFFF'}) => {
  const url = `url(${staticFile(`brand/${name}.svg`)})`;
  return <div style={{width: w, height: w, background: color, WebkitMaskImage: url, maskImage: url, WebkitMaskSize: 'contain', maskSize: 'contain',
    WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskPosition: 'center', flex: 'none'}} />;
};
export type Tone = 'mint' | 'orange' | 'ink' | 'grey' | 'white';
export const TONE: Record<Tone, {bg: string; fg: string; glow: string}> = {
  mint: {bg: 'linear-gradient(160deg, #9FFAE6, #3DEDC3 60%, #1FC9A1)', fg: '#05231D', glow: 'rgba(61,237,195,.55)'},
  orange: {bg: 'linear-gradient(160deg, #FFC49E, #FF8A45 60%, #F26A1F)', fg: '#FFFFFF', glow: 'rgba(255,122,47,.45)'},
  ink: {bg: 'linear-gradient(160deg, #3A3F44, #0E0F11)', fg: '#FFFFFF', glow: 'rgba(14,15,17,.25)'},
  grey: {bg: 'linear-gradient(160deg, #F4F5F6, #D9DDE0)', fg: '#5F6368', glow: 'rgba(14,15,17,.10)'},
  white: {bg: 'linear-gradient(160deg, #FFFFFF, #F1F2F3)', fg: INK, glow: 'rgba(14,15,17,.12)'},
};
// кружок-иконка капсулы; оранжевый допустим только здесь и в пятнах, текст оранжевым не красим
export const Dot: React.FC<{tone: Tone; s?: number; children: React.ReactNode}> = ({tone, s = 100, children}) => (
  <div style={{width: s, height: s, borderRadius: s / 2, background: TONE[tone].bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
    boxShadow: `0 6px 18px ${TONE[tone].glow}, inset 0 2px 0 rgba(255,255,255,.55), inset 0 -2px 4px rgba(0,0,0,.08)`}}>{children}</div>
);
export const glass = (h: number): React.CSSProperties => ({
  height: h, borderRadius: h / 2, display: 'inline-flex', alignItems: 'center', gap: h * 0.2, padding: `0 ${h * 0.36}px 0 ${h * 0.13}px`, boxSizing: 'border-box', whiteSpace: 'nowrap',
  background: 'linear-gradient(180deg, rgba(255,255,255,.72), rgba(255,255,255,.42))', border: '2px solid rgba(255,255,255,.95)',
  backdropFilter: 'blur(26px) saturate(1.8)', WebkitBackdropFilter: 'blur(26px) saturate(1.8)',
  boxShadow: '0 24px 60px rgba(14,15,17,.10), 0 3px 10px rgba(14,15,17,.06), inset 0 2px 0 rgba(255,255,255,1), inset 0 -10px 24px rgba(255,255,255,.35)',
});
// появление: пружина без перелёта + подъём + размытие
export const rise = (a: number): React.CSSProperties => ({opacity: Math.min(1, a * 1.8), transform: `translateY(${(1 - Math.min(1, a)) * 60}px) scale(${0.8 + 0.2 * a})`,
  filter: a < 0.98 ? `blur(${(1 - Math.min(1, a)) * 14}px)` : undefined});
// разные входы, чтобы станции не повторяли друг друга (автор курса 27.09: «чуть стили анимаций меняй»)
export type Enter = 'rise' | 'left' | 'right' | 'flip' | 'pop' | 'drop';
export const enter = (mode: Enter, a: number): React.CSSProperties => {
  const c = Math.min(1, a), blur = c < 0.98 ? `blur(${(1 - c) * 12}px)` : undefined, op = Math.min(1, a * 1.8);
  if (mode === 'left' || mode === 'right') return {opacity: op, filter: blur, transform: `translateX(${(mode === 'left' ? -1 : 1) * (1 - c) * 180}px) scale(${0.9 + 0.1 * c})`};
  if (mode === 'flip') return {opacity: op, filter: blur, transformOrigin: '50% 0%', transform: `perspective(900px) rotateX(${(1 - c) * -85}deg)`};
  if (mode === 'pop') return {opacity: op, filter: blur, transform: `scale(${0.45 + 0.55 * a})`};
  if (mode === 'drop') return {opacity: op, filter: blur, transform: `translateY(${-(1 - c) * 140}px) rotate(${(1 - c) * -4}deg)`};
  return rise(a);
};
export const Cap: React.FC<{a: number; dot?: React.ReactNode; label?: React.ReactNode; right?: React.ReactNode; h?: number; minW?: number; dim?: number; in?: Enter}> =
  ({a, dot, label, right, h = 140, minW, dim = 0, in: mode = 'rise'}) => (a <= 0 ? null : (
  <div style={{...glass(h), ...enter(mode, a), minWidth: minW}}>
    {dot}
    {label !== undefined ? <span style={{fontFamily: SANS, fontWeight: 600, fontSize: h * 0.42, color: INK, letterSpacing: '-0.01em', opacity: 1 - 0.55 * dim, flex: 1}}>{label}</span> : null}
    {right}
  </div>
));
// состояния внутри капсулы
export const Switch: React.FC<{on: number; s?: number}> = ({on, s = 1}) => (
  <div style={{position: 'relative', width: 128 * s, height: 74 * s, borderRadius: 37 * s, flex: 'none', background: `rgba(${Math.round(lerp(210, 61, on))},${Math.round(lerp(214, 237, on))},${Math.round(lerp(218, 195, on))},1)`,
    boxShadow: 'inset 0 2px 6px rgba(0,0,0,.12)'}}>
    <div style={{position: 'absolute', top: 5 * s, left: lerp(5, 59, on) * s, width: 64 * s, height: 64 * s, borderRadius: 32 * s, background: '#FFFFFF', boxShadow: '0 4px 10px rgba(0,0,0,.22)'}} />
  </div>
);
export const Ring: React.FC<{p: number; pct: number; s?: number}> = ({p, pct, s = 96}) => (
  <div style={{position: 'relative', width: s, height: s, flex: 'none'}}>
    <svg width={s} height={s} viewBox="0 0 100 100" style={{position: 'absolute', left: 0, top: 0}}>
      <circle cx={50} cy={50} r={42} fill="none" stroke="rgba(14,15,17,.08)" strokeWidth={10} />
      <circle cx={50} cy={50} r={42} fill="none" stroke={MINT_D} strokeWidth={10} strokeLinecap="round" pathLength={1} strokeDasharray={`${(pct / 100) * p} 2`} transform="rotate(-90 50 50)" />
    </svg>
    <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SOYUZ, fontWeight: 700, fontSize: s * 0.3, color: INK}}>{Math.round(pct * p)}</div>
  </div>
);
export const Bar: React.FC<{p: number; w: number; c?: string}> = ({p, w, c = MINT}) => (
  <div style={{width: w, height: 16, borderRadius: 8, background: 'rgba(14,15,17,.08)', flex: 'none'}}><div style={{width: `${p * 100}%`, height: '100%', borderRadius: 8, background: c, boxShadow: `0 0 12px ${c}`}} /></div>
);
export const Check: React.FC<{a: number; s?: number}> = ({a, s = 70}) => (a <= 0 ? null : <div style={{transform: `scale(${a})`}}><Dot tone="mint" s={s}><Ico name="check" s={s * 0.55} c="#05231D" w={3} /></Dot></div>);
// заголовок печатается по словам, как у Apple: слово приходит серым и темнеет
export const PrintTitle: React.FC<{words: {s: string; at: number}[]; t: number; size: number; weight?: number}> = ({words, t, size, weight = 700}) => (
  <div style={{display: 'flex', gap: size * 0.26, whiteSpace: 'nowrap', fontFamily: SANS, fontWeight: weight, fontSize: size, letterSpacing: '-0.035em', lineHeight: 1}}>
    {words.map((w, i) => {
      const a = k(t, w.at - 0.1, w.at + 0.15, E.out), ink = k(t, w.at + 0.05, w.at + 0.45);
      return <span key={i} style={{opacity: a, transform: `translateY(${(1 - a) * 30}px)`, filter: a < 1 ? `blur(${(1 - a) * 10}px)` : undefined,
        color: `rgba(14,15,17,${0.28 + 0.72 * ink})`, display: 'inline-block'}}>{w.s}</span>;
    })}
  </div>
);
export const Avatar: React.FC<{c: string; l: string; s?: number}> = ({c, l, s = 70}) => (
  <div style={{width: s, height: s, borderRadius: s / 2, background: c, color: '#FFFFFF', fontFamily: SANS, fontWeight: 700, fontSize: s * 0.44, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
    boxShadow: 'inset 0 2px 0 rgba(255,255,255,.4)'}}>{l}</div>
);
// «строки текста» внутри карточки, когда сам текст не нужен
export const Lines: React.FC<{w: number; o?: number}> = ({w, o = 1}) => (
  <div style={{display: 'flex', flexDirection: 'column', gap: 12, opacity: o, flex: 'none'}}>
    <div style={{width: w, height: 14, borderRadius: 7, background: 'rgba(14,15,17,.28)'}} /><div style={{width: w * 0.65, height: 12, borderRadius: 6, background: 'rgba(14,15,17,.14)'}} />
  </div>
);
