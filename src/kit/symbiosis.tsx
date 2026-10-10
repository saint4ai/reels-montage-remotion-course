import React, {useId} from 'react';
import {AbsoluteFill, Easing, Img, interpolate} from 'remotion';
import {ClaudeCursor, ClaudeIcon, Ico, IgUI, Line, Plate, RouteDraw, Sheet, Smear} from './sheetparts';
import {Glows, type Orb} from './relay';

// СИМБИОЗ (автор курса 06.10.2026: «подними наши последние три скилла, которые нам зашли по монтажу, сделай симбиоз»).
// Три принятых монтажа: креатив 7 / 4 (Skyscanner × ЛИСТ), креатив 6 (СЦЕНЫ), креатив 5 (КАНВАС + ЛИСТ).
//  • ЛИСТ даёт язык: фраза SF Pro light, одно слово Coolvetica оранжевым, оранжевая плашка на пружине, белая карточка с
//    чёрной кромкой и жёсткой тенью, настоящие скриншоты и записи, iPhone с Instagram, курсор Claude. Субтитров нет.
//  • СЦЕНЫ дают ритм: фон меняется на каждом смысловом блоке (белый лист, чёрный лист, мятный, оранжевый), переход
//    выбирается по причине в речи: хлыст (дальше по списку), вспышка (результат, ИИ), влёт в окно (внутрь экрана или
//    предмета), уход в тёмное (проблема, страх).
//  • КАНВАС даёт пространство: перечисление (сервисы, шаги, репозитории) лежит плитами на одном столе далеко друг от друга,
//    камера едет ~1 с с мягким разгоном, мир смазывается по скорости, плиты притухают, пунктир рисуется заранее.
// Паспорт: patterns/styles/symbiosis/PATTERN.md.
export const S = {INK: '#111316', GREY: '#6B7078', OR: '#FF7A2F', MINT: '#3DEDC3', MINT_INK: '#05231D', PAPER: '#F6F5F1', LIGHT: '#F4F3EF', SF: 'SF Pro Display', CV: 'Coolvetica'};
export {Line, Plate, Sheet, ClaudeIcon, Ico, Smear, ClaudeCursor, IgUI};
export const cl = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const EXPO = Easing.bezier(0.16, 1, 0.3, 1), EIO = Easing.bezier(0.65, 0, 0.35, 1), BACK = Easing.bezier(0.34, 1.4, 0.64, 1), IN = Easing.bezier(0.5, 0, 0.9, 0.4), SMOOTH = Easing.bezier(0.45, 0, 0.15, 1);
export const k = (t: number, a: number, b: number, e = EXPO) => interpolate(t, [a, b], [0, 1], {...cl, easing: e});
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
export const bump = (t: number, a: number, d: number) => { const x = (t - a) / d; return x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x); };

// ——— фон по блокам ———
export type Bg = 'paper' | 'night' | 'mint' | 'ember' | 'table';
export type Fx = 'whip' | 'bloom' | 'portal' | 'lift';
export type Win = {x: number; y: number; w: number; h: number; r: number};
export type Block = {at: number; bg: Bg; fx?: Fx; x?: number; y?: number; win?: Win};
export const FX_D: Record<Fx, number> = {whip: 0.3, bloom: 0.45, portal: 0.5, lift: 0.5};
export const isLight = (bg: Bg) => bg === 'paper' || bg === 'table';
const ORBS: Record<'mint' | 'ember', Orb[]> = {
  mint: [[720, 900, 820, S.MINT, 0.42], [240, 1400, 520, '#0F5E4D', 0.7], [1220, 420, 420, S.MINT, 0.22]],
  ember: [[720, 620, 780, S.OR, 0.42], [260, 1300, 520, '#A8431A', 0.5], [1200, 1200, 460, S.OR, 0.2]],
};
const BgLayer: React.FC<{t: number; bg: Bg}> = ({t, bg}) => {
  if (bg === 'paper') return <Sheet t={t} gy={1050} />;
  if (bg === 'night') return <Sheet t={t} dark gy={1000} />;
  if (bg === 'table') return <AbsoluteFill style={{background: '#FBFBF9'}} />;
  return <Glows t={t} base={bg === 'mint' ? '#04191A' : '#1A0B04'} orbs={ORBS[bg]} />;
};
export const blockAt = (blocks: Block[], t: number) => { let i = 0; blocks.forEach((b, j) => { if (t >= b.at + FX_D[b.fx ?? 'whip'] * 0.5) i = j; }); return blocks[i]; };
export const SymBackdrop: React.FC<{t: number; blocks: Block[]}> = ({t, blocks}) => {
  let cur = 0;
  blocks.forEach((b, j) => { if (t >= b.at) cur = j; });
  const b = blocks[cur], fx = b.fx ?? 'whip', p = cur === 0 ? 1 : k(t, b.at, b.at + FX_D[fx], EIO);
  const prev = cur > 0 && p < 1 ? blocks[cur - 1] : null;
  let style: React.CSSProperties = {};
  if (fx === 'whip') style = {WebkitMaskImage: `linear-gradient(90deg, transparent ${(1 - p) * 140 - 30}%, #000 ${(1 - p) * 140}%)`};
  if (fx === 'bloom') { const R = 3000 * p; style = {WebkitMaskImage: `radial-gradient(circle at ${b.x ?? 720}px ${b.y ?? 1000}px, #000 ${R}px, transparent ${R + 260}px)`}; }
  if (fx === 'portal' && b.win) { const w = b.win, cx = w.x + w.w / 2, cy = w.y + w.h / 2, cover = Math.max((Math.max(cx, 1440 - cx) * 2) / w.w, (Math.max(cy, 2560 - cy) * 2) / w.h) * 1.08, s = 1 + (cover - 1) * p;
    const L = cx - (w.w / 2) * s, T = cy - (w.h / 2) * s; style = p >= 0.999 ? {} : {clipPath: `inset(${T}px ${1440 - (L + w.w * s)}px ${2560 - (T + w.h * s)}px ${L}px round ${w.r * s}px)`}; }
  if (fx === 'lift') style = {opacity: k(t, b.at + 0.22, b.at + FX_D.lift, EXPO)};
  return (
    <AbsoluteFill>
      {prev ? <BgLayer t={t} bg={prev.bg} /> : null}
      {prev && fx === 'lift' ? <AbsoluteFill style={{background: '#08090A', opacity: Math.sin(Math.PI * Math.min(1, p * 1.2))}} /> : null}
      <AbsoluteFill style={style}><BgLayer t={t} bg={b.bg} /></AbsoluteFill>
      {prev && fx === 'bloom' ? <AbsoluteFill style={{mixBlendMode: 'screen', opacity: Math.sin(Math.PI * p) * 0.8,
        background: `radial-gradient(${600 + p * 1600}px ${600 + p * 1600}px at ${b.x ?? 720}px ${b.y ?? 1000}px, ${b.bg === 'ember' ? S.OR : S.MINT}, ${b.bg === 'ember' ? S.OR : S.MINT}00 70%)`}} /> : null}
    </AbsoluteFill>
  );
};

// ——— содержимое блока: живёт от a до b, уходит своим переходом (тот же, что у следующего фона) ———
export const SymScene: React.FC<{t: number; a: number; b: number; exit?: Fx; x?: number; y?: number; push?: number; children: React.ReactNode}> =
  ({t, a, b, exit = 'whip', x = 720, y = 1000, push = 0.03, children}) => {
    if (t < a - 0.05 || t > b + FX_D[exit] + 0.05) return null;
    const out = k(t, b - 0.02, b + FX_D[exit] * 0.8, IN), ps = 1 + push * k(t, a, b, (v) => v);
    let tf = `scale(${ps})`, o = 1 - out, f = out > 0.02 ? `blur(${out * 30}px)` : undefined, origin = '720px 1000px';
    if (exit === 'whip') tf = `translateX(${-out * 700}px) scale(${ps})`;
    if (exit === 'portal') { tf = `scale(${ps * (1 + out * 6)})`; origin = `${x}px ${y}px`; o = 1 - k(t, b + FX_D.portal * 0.4, b + FX_D.portal * 0.8); f = out > 0.02 ? `blur(${out * 14}px)` : undefined; }
    if (exit === 'lift') tf = `translateY(${-out * 520}px) scale(${ps})`;
    if (exit === 'bloom') tf = `scale(${ps * (1 + 0.1 * out)})`;
    return <div style={{position: 'absolute', inset: 0, transform: tf, transformOrigin: origin, opacity: o, filter: f}}>{children}</div>;
  };

// ——— карточка ЛИСТ и плашка по центру ———
export const Card: React.FC<{x: number; y: number; w: number; h: number; dark?: boolean; style?: React.CSSProperties; children?: React.ReactNode}> = ({x, y, w, h, dark, style, children}) => (
  <div style={{position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: 36, background: dark ? '#1A1C1F' : '#FFFFFF', border: `4px solid ${dark ? '#3A3D42' : S.INK}`,
    boxShadow: dark ? '0 12px 0 #000, 0 36px 70px rgba(0,0,0,.4)' : '0 12px 0 rgba(17,19,22,.9), 0 36px 70px rgba(17,19,22,.14)', overflow: 'hidden', ...style}}>{children}</div>
);
export const PlateAt: React.FC<{t: number; at: number; y: number; text: string; size: number; fps: number; r?: number; x?: number}> = ({t, at, y, text, size, fps, r, x = 720}) =>
  t > at - 0.2 ? <div style={{position: 'absolute', left: x, top: y, transform: 'translateX(-50%)'}}><Plate t={t} at={at} text={text} size={size} fps={fps} r={r} /></div> : null;
// логотип сервиса на белой плитке (настоящий файл из public/brand или из материалов ролика)
export const LogoTile: React.FC<{src: string; s: number; bg?: string; style?: React.CSSProperties}> = ({src, s, bg = '#FFF', style}) => (
  <div style={{width: s, height: s, borderRadius: s * 0.26, background: bg, display: 'grid', placeItems: 'center', boxShadow: `0 ${s * 0.06}px 0 rgba(17,19,22,.85), 0 ${s * 0.15}px ${s * 0.3}px rgba(17,19,22,.18)`,
    border: `${Math.max(3, s * 0.025)}px solid ${S.INK}`, ...style}}>
    <Img src={src} style={{width: s * 0.62, height: s * 0.62, objectFit: 'contain'}} /></div>
);

// ——— КАНВАС: плиты на одном столе, камера едет между ними ———
export type Spot = {id: string; x: number; y: number; dark?: boolean};
export type Move = [string, string, number, number];
export const CARD = {w: 1000, h: 1180};
export const camOf = (t: number, spots: Spot[], moves: Move[]) => {
  const P = Object.fromEntries(spots.map((s) => [s.id, [s.x, s.y]]));
  let [x, y] = P[moves[0]?.[0] ?? spots[0].id], z = 1, move = 0;
  const arrive: Record<string, number> = {[spots[0].id]: -1};
  for (const [f, to, s, e] of moves) {
    const q = k(t, s, e, SMOOTH), [fx, fy] = P[f], [tx, ty] = P[to];
    if (t >= s) { x = lerp(fx, tx, q); y = lerp(fy, ty, q); z = 1 - 0.14 * Math.sin(q * Math.PI); move = Math.max(move, Math.sin(q * Math.PI)); }
    arrive[to] = e;
  }
  return {x, y, z, move, arrive};
};
const routeOf = (a: Spot, b: Spot) => {
  const hw = CARD.w / 2, hh = CARD.h / 2;
  if (Math.abs(b.y - a.y) < 700) { const dir = b.x > a.x ? 1 : -1; return `M ${a.x + dir * (hw - 40)} ${a.y + 200} C ${a.x + dir * (hw + 340)} ${a.y + 200}, ${b.x - dir * (hw + 380)} ${b.y - 120}, ${b.x - dir * (hw - 20)} ${b.y - 120}`; }
  const dir = b.y > a.y ? 1 : -1;
  return `M ${a.x + 100} ${a.y + dir * (hh - 40)} C ${a.x + 280} ${a.y + dir * (hh + 180)}, ${b.x - 160} ${b.y - dir * (hh + 180)}, ${b.x} ${b.y - dir * (hh - 30)}`;
};
const MotionBlur: React.FC<{bx: number; by: number; children: React.ReactNode}> = ({bx, by, children}) => {
  const id = useId().replace(/:/g, '');
  const on = bx > 0.4 || by > 0.4;
  return (
    <AbsoluteFill style={{filter: on ? `url(#${id})` : undefined}}>
      {on ? <svg width={0} height={0} style={{position: 'absolute'}}><filter id={id} x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation={`${bx} ${by}`} /></filter></svg> : null}
      {children}
    </AbsoluteFill>
  );
};
const Slab: React.FC<{s: Spot; t: number; arrive: number; children: React.ReactNode}> = ({s, t, arrive, children}) => {
  const glow = t >= arrive ? 1 - k(t, arrive, arrive + 0.8) : 0, hit = t >= arrive ? Math.sin(k(t, arrive, arrive + 0.35) * Math.PI) : 0;
  return (
    <div style={{position: 'absolute', left: s.x - CARD.w / 2, top: s.y - CARD.h / 2, width: CARD.w, height: CARD.h, borderRadius: 48, overflow: 'hidden', background: s.dark ? '#111316' : '#FFFFFF',
      transform: `scale(${1 + 0.012 * hit})`, boxShadow: `0 0 0 2px rgba(17,19,22,.08), 0 0 0 ${8 * glow}px rgba(255,122,47,${0.55 * glow}), 0 14px 0 ${s.dark ? '#000' : '#E2E1DC'}, 0 40px 80px rgba(17,19,22,.16)`}}>
      <div style={{position: 'absolute', inset: 0, backgroundImage: `radial-gradient(${s.dark ? 'rgba(255,255,255,.08)' : 'rgba(17,19,22,.09)'} 2px, transparent 2px)`, backgroundSize: '36px 36px'}} />
      {children}
    </div>
  );
};
const DT = 1 / 60;
// Плиты ЛИСТ размером 1000×1180 (x 220–1220 на экране), центр камеры на y 980 экрана: плита y 390–1570 над полосой спикера.
// render(id) рисует содержимое плиты в её координатах (0…1000, 0…1180).
export const SymCanvas: React.FC<{t: number; a: number; b: number; spots: Spot[]; moves: Move[]; exit?: Fx; render: (id: string, arrive: number) => React.ReactNode}> =
  ({t, a, b, spots, moves, exit = 'whip', render}) => {
    if (t < a - 0.05 || t > b + FX_D[exit] + 0.05) return null;
    const c = camOf(t, spots, moves), c0 = camOf(t - DT, spots, moves);
    const bx = Math.min(36, Math.abs(c.x - c0.x) * c.z * 0.55), by = Math.min(36, Math.abs(c.y - c0.y) * c.z * 0.55), dim = 1 - 0.35 * c.move;
    const near = (s: Spot) => Math.abs(s.x - c.x) < 1900 && Math.abs(s.y - c.y) < 2300;
    const inn = k(t, a + 0.04, a + 0.42, EIO), g = 56 * c.z;
    return (
      <SymScene t={t} a={a} b={b} exit={exit} push={0}>
        {/* вход: стол въезжает справа вместе с хлыстом фона, со смазом по ходу */}
        <div style={{position: 'absolute', inset: 0, opacity: Math.min(1, inn * 1.6), transform: `translateX(${(1 - inn) * 900}px)`, filter: inn < 0.98 ? `blur(${(1 - inn) * 26}px)` : undefined}}>
        {/* клетка стола едет вместе с камерой */}
        <MotionBlur bx={bx * 0.6} by={by * 0.6}>
          <AbsoluteFill style={{opacity: inn, backgroundImage: 'linear-gradient(rgba(17,19,22,.08) 2px, transparent 2px), linear-gradient(90deg, rgba(17,19,22,.08) 2px, transparent 2px)',
            backgroundSize: `${g}px ${g}px`, backgroundPosition: `${720 - c.x * c.z}px ${980 - c.y * c.z}px`}} />
        </MotionBlur>
        <MotionBlur bx={bx} by={by}>
          <div style={{position: 'absolute', inset: 0, transform: `translate(${720 - c.x * c.z}px, ${980 - c.y * c.z}px) scale(${c.z})`, transformOrigin: '0 0'}}>
            <svg width={10} height={10} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
              {moves.map(([f, to, s], i) => { const A = spots.find((x) => x.id === f)!, B = spots.find((x) => x.id === to)!, p = k(t, s - 0.45, s + 0.05, Easing.bezier(0.45, 0, 0.3, 1));
                return <RouteDraw key={i} d={routeOf(A, B)} p={p} />; })}
            </svg>
            <div style={{opacity: dim}}>
              {spots.map((s) => (near(s) ? <Slab key={s.id} s={s} t={t} arrive={c.arrive[s.id] ?? 99}>{render(s.id, c.arrive[s.id] ?? 0)}</Slab> : null))}
            </div>
          </div>
        </MotionBlur>
        </div>
      </SymScene>
    );
  };
