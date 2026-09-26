import React from 'react';
import {AbsoluteFill, random, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio, Video} from '@remotion/media';
import {Captions} from '../../montage/Captions';
import {C, E, HAND, k, Logo, MONO, NUM, SANS} from '../../montage/parts';
import {FORMATS} from '../../formats';
import {FormatProvider} from '../../template/canvas';
import {Speaker} from '../../template/Speaker';
import {WORDS25} from './words';

// Ролик 25 «Opus 5.5 делает игры». Формат ролика 24 (спикер в карточке снизу, сцены сверху, кисть / размытие / сдвиг / наезд),
// но весь мир в космосе: у каждой сцены свой структурно разный космос (решение Александра 25.09: «космические фоны,
// переключать между играми»). Палитра только оранжевый, мятный, чёрный, белый. Карта: videos/reels-25-opus55-games/DIRECTION.md.
export const FPS25 = 60;
export const PREVIEW25 = 12;
export const END25 = 47.3;

const W = 1440, H = 2560;
const MINT = C.mint, ORANGE = C.orange, INK = '#15181B', SUB = '#5B6068', VOID = '#020403';

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
const sp = (t: number, at: number, fps: number, damping = 14, stiffness = 160) =>
  t < at ? 0 : spring({frame: (t - at) * fps, fps, config: {damping, stiffness, mass: 1}});
// Дрожание глитча: сильное в первые 0,4 с после at.
const jit = (t: number, at: number, amp = 14) => (t >= at && t < at + 0.4 ? Math.sin((t - at) * 90) * amp * (1 - (t - at) / 0.4) : 0);

// ——— Общие детали (как в ролике 24) ———
const Brush: React.FC<{d: string; p: number; q?: number; width: number; color?: string; glow?: number; opacity?: number}> =
  ({d, p, q = 0, width, color = MINT, glow = 0.5, opacity = 1}) => {
    if (p <= 0 || q >= 1) return null;
    return (
      <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none', opacity}}>
        <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" pathLength={1}
          strokeDasharray={`${Math.max(0, p - q)} 2`} strokeDashoffset={-q}
          style={{filter: glow ? `drop-shadow(0 0 ${Math.round(width * 0.6)}px ${rgba(color, glow)})` : undefined}} />
      </svg>
    );
  };

const WordLine: React.FC<{t: number; words: [string, number][]; x?: number; y: number; size: number; color?: string; weight?: number; family?: string; center?: boolean}> =
  ({t, words, x = 144, y, size, color = C.ink, weight = 800, family = SANS, center}) => (
    <div style={{position: 'absolute', left: center ? 0 : x, width: center ? W : undefined, top: y, display: 'flex', justifyContent: center ? 'center' : 'flex-start',
      gap: size * 0.26, fontFamily: family, fontWeight: weight, fontSize: size, lineHeight: 1.05, letterSpacing: '-0.035em', color, whiteSpace: 'nowrap',
      textShadow: '0 4px 0 rgba(0,0,0,.35), 0 18px 40px rgba(0,0,0,.45)'}}>
      {words.map(([w, at]) => {
        const a = k(t, at, at + 0.45);
        return <span key={w + at} style={{opacity: a, filter: a < 1 ? `blur(${(1 - a) * 14}px)` : undefined, transform: `translateY(${(1 - a) * 22}px)`, display: 'inline-block'}}>{w}</span>;
      })}
    </div>
  );

const Slab: React.FC<{x: number; y: number; w: number; h: number; r?: number; face: string; edge: string; style?: React.CSSProperties; children?: React.ReactNode}> =
  ({x, y, w, h, r = 40, face, edge, style, children}) => (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, ...style}}>
      <div style={{position: 'absolute', left: 0, top: 18, width: w, height: h, borderRadius: r, background: edge, boxShadow: '0 40px 90px rgba(0,0,0,.5)'}} />
      <div style={{position: 'absolute', left: 0, top: 0, width: w, height: h, borderRadius: r, background: face, overflow: 'hidden',
        boxShadow: 'inset 0 3px 0 rgba(255,255,255,.28), inset 0 -10px 24px rgba(0,0,0,.2), inset 0 0 0 1.5px rgba(255,255,255,.1)'}}>{children}</div>
    </div>
  );

// Мятная капсула факта; out — когда уйти.
const Pill: React.FC<{t: number; at: number; out?: number; label: string; size?: number; color?: string; ink?: string}> =
  ({t, at, out, label, size = 56, color = MINT, ink = C.mintInk}) => {
    const a = k(t, at, at + 0.4, E.pop), o = k(t, at, at + 0.15) * (out === undefined ? 1 : 1 - k(t, out, out + 0.2));
    if (o <= 0) return null;
    return (
      <div style={{display: 'inline-flex', alignItems: 'center', padding: `${size * 0.4}px ${size * 0.7}px`, borderRadius: 999, background: color,
        boxShadow: `0 0 44px ${rgba(color, 0.55)}, inset 0 3px 0 rgba(255,255,255,.5), 0 14px 30px rgba(0,0,0,.35)`, opacity: o, transform: `scale(${0.6 + 0.4 * a})`,
        fontFamily: SANS, fontWeight: 800, fontSize: size, lineHeight: 1, color: ink, whiteSpace: 'nowrap'}}>{label}</div>
    );
  };
const PillRow: React.FC<{y: number; children: React.ReactNode}> = ({y, children}) => (
  <div style={{position: 'absolute', left: 0, top: y, width: W, display: 'flex', justifyContent: 'center'}}>{children}</div>
);

// Белая капсула бренда с настоящим логотипом.
const WhiteChip: React.FC<{t: number; at: number; out?: number; logo: string; label: string; size?: number; style?: React.CSSProperties}> =
  ({t, at, out, logo, label, size = 52, style}) => {
    const a = sp(t, at, FPS25, 13, 170), o = Math.min(1, a * 1.6) * (out === undefined ? 1 : 1 - k(t, out, out + 0.25));
    if (o <= 0) return null;
    return (
      <div style={{display: 'inline-flex', alignItems: 'center', gap: size * 0.36, padding: `${size * 0.4}px ${size * 0.72}px ${size * 0.4}px ${size * 0.5}px`, borderRadius: 999,
        background: '#FFFFFF', boxShadow: '0 16px 40px rgba(0,0,0,.45), inset 0 -4px 0 rgba(0,0,0,.08)', opacity: o, transform: `translateY(${(1 - a) * 40}px) scale(${0.75 + 0.25 * a})`,
        fontFamily: SANS, fontWeight: 800, fontSize: size, lineHeight: 1, color: INK, whiteSpace: 'nowrap', ...style}}>
        <Logo name={logo} size={size * 1.15} />{label}
      </div>
    );
  };

// Огромное слово с глитч-расслоением мятный / оранжевый.
const Big: React.FC<{t: number; at: number; text: string; y: number; size: number; color?: string; squeeze?: number; glow?: string}> =
  ({t, at, text, y, size, color = C.ink, squeeze = 0.84, glow}) => {
    const a = k(t, at, at + 0.35), g = jit(t, at);
    if (a <= 0) return null;
    return (
      <div style={{position: 'absolute', left: 0, width: W, top: y, textAlign: 'center', fontFamily: NUM, fontWeight: 900, fontSize: size, lineHeight: 1, letterSpacing: '-0.04em',
        color, opacity: a, transform: `scaleX(${squeeze}) translateX(${g}px)`, filter: a < 1 ? `blur(${(1 - a) * 16}px)` : undefined, whiteSpace: 'nowrap',
        textShadow: `${g * 0.7}px 0 0 ${rgba(MINT, 0.85)}, ${-g * 0.7}px 0 0 ${rgba(ORANGE, 0.85)}, 0 6px 0 rgba(0,0,0,.4), 0 0 70px ${glow ?? 'rgba(61,237,195,.25)'}`}}>{text}</div>
    );
  };

// ——— Космос: звёзды и свечения ———
const Stars: React.FC<{t: number; seed: string; n: number; vx?: number; vy?: number; r?: [number, number]; square?: boolean; grid?: number; color?: string; opacity?: number; maxY?: number}> =
  ({t, seed, n, vx = 0, vy = 0, r = [1.2, 3.6], square, grid = 0, color = '#FFFFFF', opacity = 1, maxY = H}) => {
    const items: React.ReactNode[] = [];
    for (let i = 0; i < n; i++) {
      const rr = r[0] + (r[1] - r[0]) * Math.pow(random(`${seed}r${i}`), 2.4);
      const depth = 0.35 + rr / r[1];
      let x = (((random(`${seed}x${i}`) * W + vx * t * depth) % W) + W) % W;
      let y = (((random(`${seed}y${i}`) * maxY + vy * t * depth) % maxY) + maxY) % maxY;
      const ph = random(`${seed}p${i}`) * 6.28, f = 0.6 + random(`${seed}f${i}`) * 1.8;
      let a = 0.5 + 0.5 * Math.sin(t * f * 2 + ph);
      if (grid) { x = Math.round(x / grid) * grid; y = Math.round(y / grid) * grid; a = a > 0.5 ? 1 : 0.35; }
      a *= opacity;
      items.push(square
        ? <rect key={i} x={x - rr} y={y - rr} width={rr * 2} height={rr * 2} fill={color} opacity={a} />
        : <circle key={i} cx={x} cy={y} r={rr} fill={color} opacity={a} />);
    }
    return <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>{items}</svg>;
  };
const Glow: React.FC<{x: number; y: number; w: number; h?: number; color: string; a: number; rot?: number}> = ({x, y, w, h = w, color, a, rot = 0}) => (
  <div style={{position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, borderRadius: '50%', transform: `rotate(${rot}deg)`,
    background: `radial-gradient(closest-side, ${rgba(color, a)}, ${rgba(color, a * 0.35)} 45%, ${rgba(color, 0)})`}} />
);
const Space: React.FC<{top?: string; bottom?: string; children: React.ReactNode}> = ({top = VOID, bottom = '#03110E', children}) => (
  <AbsoluteFill style={{background: `linear-gradient(180deg, ${top} 0%, ${bottom} 100%)`, overflow: 'hidden'}}>{children}</AbsoluteFill>
);
// Спиральные рукава из точек.
const Spiral: React.FC<{t: number; cx: number; cy: number; seed: string; n: number; arms: string[]; spin: number; b?: number; scale?: number; tilt?: number}> =
  ({t, cx, cy, seed, n, arms, spin, b = 0.28, scale = 60, tilt = 0.55}) => {
    const dots: React.ReactNode[] = [];
    for (let i = 0; i < n; i++) {
      const arm = i % arms.length, u = random(`${seed}u${i}`), th = u * 9 + (arm * Math.PI * 2) / arms.length + t * spin;
      const rr = scale * Math.exp(b * u * 9) * (0.9 + random(`${seed}j${i}`) * 0.25);
      const x = cx + Math.cos(th) * rr, y = cy + Math.sin(th) * rr * tilt;
      const s = 1.4 + random(`${seed}s${i}`) * 3.6, a = (0.35 + 0.65 * (1 - u)) * (0.6 + 0.4 * Math.sin(t * 3 + i));
      dots.push(<circle key={i} cx={x} cy={y} r={s} fill={arms[arm]} opacity={a} />);
    }
    return <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>{dots}</svg>;
  };

// 1. Горизонт планеты: край планеты по диагонали с мятным свечением атмосферы.
const BgHorizon: React.FC<{t: number}> = ({t}) => (
  <Space bottom="#021410">
    <Stars t={t} seed="hz" n={190} vx={-7} />
    <Glow x={900} y={1180} w={2200} h={900} color={MINT} a={0.16} rot={-38} />
    <div style={{position: 'absolute', left: 1900 - 1700, top: 2500 - 1700 - t * 6, width: 3400, height: 3400, borderRadius: '50%',
      background: 'radial-gradient(circle at 28% 22%, #0C2E26 0%, #04120E 38%, #010403 70%)',
      boxShadow: `0 0 90px 26px ${rgba(MINT, 0.55)}, 0 0 260px 90px ${rgba(MINT, 0.18)}, inset 40px 40px 120px ${rgba(MINT, 0.4)}`}} />
  </Space>
);
// 2. Ядро галактики: яркий центр, пыль вращается рукавами.
const BgCore: React.FC<{t: number}> = ({t}) => (
  <Space bottom="#020807">
    <Stars t={t} seed="co" n={140} vy={4} />
    <Glow x={720} y={860} w={1700} h={640} color={ORANGE} a={0.14} rot={-16} />
    <Glow x={720} y={860} w={1200} h={560} color={MINT} a={0.34} rot={-16} />
    <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, transform: `rotate(-16deg)`, transformOrigin: '720px 860px'}}>
      <Spiral t={t} cx={720} cy={860} seed="core" n={560} arms={['#FFFFFF', MINT]} spin={0.12} scale={66} />
    </div>
    <Glow x={720} y={860} w={420} color="#FFFFFF" a={0.95} />
  </Space>
);
// 3. Огненная туманность: облака в оранжевом, искры поднимаются.
const BgEmber: React.FC<{t: number}> = ({t}) => {
  const embers: React.ReactNode[] = [];
  for (let i = 0; i < 80; i++) {
    const x0 = random(`em x${i}`) * W, v = 60 + random(`em v${i}`) * 140, s = 2 + random(`em s${i}`) * 5;
    const y = ((random(`em y${i}`) * H - t * v) % H + H) % H, x = x0 + Math.sin(t * 1.3 + i) * 24;
    const a = 0.4 + 0.6 * Math.abs(Math.sin(t * 5 + i * 1.7));
    embers.push(<circle key={i} cx={x} cy={y} r={s} fill={i % 3 ? ORANGE : '#FFD2A8'} opacity={a} style={{filter: `drop-shadow(0 0 ${s * 2}px ${rgba(ORANGE, 0.9)})`}} />);
  }
  return (
    <Space top="#070201" bottom="#240B02">
      <Stars t={t} seed="emb" n={60} opacity={0.5} />
      <Glow x={300 + Math.sin(t * 0.4) * 60} y={700} w={1500} h={900} color={ORANGE} a={0.34} rot={20} />
      <Glow x={1200} y={1300 + Math.cos(t * 0.3) * 50} w={1400} h={1000} color={ORANGE} a={0.26} rot={-30} />
      <Glow x={700} y={1050} w={900} h={600} color="#000000" a={0.55} rot={10} />
      <Glow x={900} y={420} w={700} h={420} color="#FFD2A8" a={0.12} />
      <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>{embers}</svg>
    </Space>
  );
};
// 4. Северное сияние: мятные ленты волнами над звёздами.
const BgAurora: React.FC<{t: number}> = ({t}) => {
  const band = (base: number, amp: number, f: number, w: number, ph: number, hgt: number, id: string, a: number) => {
    const pts: string[] = [];
    for (let i = 0; i <= 48; i++) { const x = -60 + (i / 48) * (W + 120); pts.push(`${x.toFixed(1)},${(base + amp * Math.sin(x * f + t * w + ph) + 40 * Math.sin(x * f * 2.3 + t * w * 1.7)).toFixed(1)}`); }
    const back = pts.slice().reverse().map((p) => { const [x, y] = p.split(',').map(Number); return `${x},${y + hgt}`; });
    return (
      <g key={id}>
        <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={MINT} stopOpacity={a} /><stop offset="0.35" stopColor={MINT} stopOpacity={a * 0.55} /><stop offset="1" stopColor={MINT} stopOpacity={0} /></linearGradient></defs>
        <polygon points={[...pts, ...back].join(' ')} fill={`url(#${id})`} />
      </g>
    );
  };
  return (
    <Space top="#010302" bottom="#031A14">
      <Stars t={t} seed="au" n={170} vx={3} />
      <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
        {band(420, 110, 0.0034, 0.7, 0, 520, 'au1', 0.55)}
        {band(640, 150, 0.0026, -0.5, 1.7, 620, 'au2', 0.4)}
        {band(900, 90, 0.0042, 0.9, 3.1, 420, 'au3', 0.28)}
      </svg>
      <Glow x={720} y={2300} w={2400} h={900} color={MINT} a={0.12} />
    </Space>
  );
};
// 5. Гиперпрыжок: звёзды вытягиваются лучами от центра.
const BgWarp: React.FC<{t: number}> = ({t}) => {
  const lines: React.ReactNode[] = [];
  const cx = 720, cy = 880;
  for (let i = 0; i < 190; i++) {
    const th = random(`wp a${i}`) * Math.PI * 2, spd = 0.35 + random(`wp s${i}`) * 0.5;
    const u = (random(`wp p${i}`) + t * spd) % 1, d = 60 + u * u * 2000, len = 12 + u * u * 520;
    const x1 = cx + Math.cos(th) * d, y1 = cy + Math.sin(th) * d, x2 = cx + Math.cos(th) * (d + len), y2 = cy + Math.sin(th) * (d + len);
    lines.push(<line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={i % 7 === 0 ? ORANGE : '#FFFFFF'} strokeWidth={1.5 + u * 4} strokeLinecap="round" opacity={0.15 + 0.85 * u} />);
  }
  return (
    <Space top="#010202" bottom="#020605">
      <Glow x={cx} y={cy} w={1300} h={1300} color={MINT} a={0.12} />
      <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>{lines}</svg>
      <Glow x={cx} y={cy} w={260} color="#FFFFFF" a={0.8} />
    </Space>
  );
};
// 6. Пиксельный космос: квадратные звёзды, пиксельная планета с кольцом.
const PixelPlanet: React.FC<{cx: number; cy: number; r: number; cell: number; base: string; dark: string; ring?: string; tt: number}> = ({cx, cy, r, cell, base, dark, ring, tt}) => {
  const cells: React.ReactNode[] = [];
  const ringCells = (front: boolean) => {
    if (!ring) return;
    for (let a = 0; a < 360; a += 4) {
      const rad = (a * Math.PI) / 180, x = Math.cos(rad) * r * 1.75, y = Math.sin(rad) * r * 0.42;
      if (front !== y > 0) continue;
      cells.push(<rect key={`g${front}${a}`} x={Math.round((cx + x) / cell) * cell} y={Math.round((cy + y - x * 0.2) / cell) * cell} width={cell} height={cell} fill={ring} opacity={0.9} />);
    }
  };
  ringCells(false);
  for (let gx = -r; gx <= r; gx += cell) for (let gy = -r; gy <= r; gy += cell) {
    if (gx * gx + gy * gy > r * r) continue;
    const lit = (-gx - gy) / (r * 1.4) + 0.35 + 0.08 * Math.sin(tt * 2 + gx * 0.05);
    cells.push(<rect key={`${gx}_${gy}`} x={cx + gx} y={cy + gy} width={cell} height={cell} fill={lit > 0.3 ? base : dark} />);
  }
  ringCells(true);
  return <>{cells}</>;
};
const BgPixel: React.FC<{t: number}> = ({t}) => (
  <Space top="#010302" bottom="#04100C">
    <Stars t={t} seed="px" n={150} square grid={12} r={[3, 7]} vx={-10} />
    <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
      <PixelPlanet cx={1120} cy={Math.round(700 + Math.sin(t * 1.2) * 12)} r={220} cell={22} base={MINT} dark="#127C63" ring={ORANGE} tt={t} />
      <PixelPlanet cx={250} cy={Math.round(1230 + Math.cos(t) * 10)} r={70} cell={14} base={ORANGE} dark="#9C3E0C" tt={t} />
    </svg>
  </Space>
);
// 7. Орбиты: наклонные кольца, по ним идут две планеты.
const BgOrbit: React.FC<{t: number}> = ({t}) => {
  const cx = 720, cy = 900, rs = [280, 430, 600, 780, 960];
  const planet = (rx: number, ang: number, r: number, color: string) => {
    const x = cx + Math.cos(ang) * rx, y = cy + Math.sin(ang) * rx * 0.32;
    return <circle cx={x} cy={y} r={r} fill={color} style={{filter: `drop-shadow(0 0 ${r}px ${rgba(color, 0.9)})`}} />;
  };
  return (
    <Space bottom="#03110E">
      <Stars t={t} seed="or" n={150} vy={-3} />
      <Glow x={cx} y={cy} w={900} h={500} color={MINT} a={0.22} rot={-16} />
      <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
        <g transform={`rotate(-16 ${cx} ${cy})`}>
          {rs.map((rx, i) => <ellipse key={rx} cx={cx} cy={cy} rx={rx} ry={rx * 0.32} fill="none" stroke={MINT} strokeWidth={3} opacity={0.34 - i * 0.05} />)}
          {planet(rs[1], t * 0.55, 22, MINT)}
          {planet(rs[3], t * 0.32 + 2.6, 18, ORANGE)}
          {planet(rs[4], -t * 0.2 + 1.1, 12, '#FFFFFF')}
        </g>
      </svg>
      <Glow x={cx} y={cy} w={200} color="#FFFFFF" a={0.85} />
    </Space>
  );
};
// 8. Рассвет над планетой: солнце выходит из-за края, лучи.
const BgSunrise: React.FC<{t: number}> = ({t}) => {
  const sy = 1360 - k(t, 41.6, 44.2, E.out) * 70;
  return (
    <Space top="#010202" bottom="#0D0603">
      <Stars t={t} seed="su" n={110} maxY={1300} />
      <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0, opacity: 0.5}}>
        {Array.from({length: 14}, (_, i) => {
          const a = (i / 14) * Math.PI * 2 + t * 0.05, a2 = a + 0.05;
          return <polygon key={i} points={`720,${sy} ${720 + Math.cos(a) * 2400},${sy + Math.sin(a) * 2400} ${720 + Math.cos(a2) * 2400},${sy + Math.sin(a2) * 2400}`} fill={ORANGE} opacity={0.12} />;
        })}
      </svg>
      <Glow x={720} y={sy} w={2600} h={800} color={ORANGE} a={0.3} />
      <Glow x={720} y={sy} w={900} h={460} color={ORANGE} a={0.75} />
      <div style={{position: 'absolute', left: 720 - 1500, top: sy + 40, width: 3000, height: 3000, borderRadius: '50%', background: 'radial-gradient(circle at 50% 8%, #1A0D06 0%, #070302 30%, #020101 60%)',
        boxShadow: `0 0 70px 20px ${rgba(ORANGE, 0.7)}, 0 0 220px 70px ${rgba(ORANGE, 0.25)}`}} />
      <Glow x={720} y={sy + 30} w={320} h={180} color="#FFFFFF" a={1} />
      <div style={{position: 'absolute', left: 0, top: sy + 24, width: W, height: 10, background: `linear-gradient(90deg, transparent, ${rgba('#FFFFFF', 0.9)}, transparent)`}} />
    </Space>
  );
};
// 9. Вихрь: два рукава мятный и оранжевый, в центре тёмная дыра с кольцом.
const BgSwirl: React.FC<{t: number}> = ({t}) => (
  <Space top="#010302" bottom="#020A08">
    <Stars t={t} seed="sw" n={110} vx={5} />
    <Glow x={720} y={860} w={1500} h={900} color={ORANGE} a={0.12} />
    <Spiral t={t} cx={720} cy={900} seed="swirl" n={520} arms={[MINT, ORANGE]} spin={0.5} b={0.3} scale={70} tilt={0.8} />
    <div style={{position: 'absolute', left: 720 - 170, top: 900 - 120, width: 340, height: 240, borderRadius: '50%', background: '#000',
      boxShadow: `0 0 0 6px ${rgba(MINT, 0.9)}, 0 0 60px 18px ${rgba(MINT, 0.6)}, 0 0 160px 60px ${rgba(ORANGE, 0.25)}`}} />
  </Space>
);

// ——— Карточка игры: стекло 16:9 с настоящей записью, клипы сменяются по фразам ———
type Clip = {src: string; at: number; trim?: number};
const GameCard: React.FC<{t: number; fps: number; at: number; until: number; clips: Clip[]; y: number; label: string; by: string; chrome?: boolean}> =
  ({t, fps, at, until, clips, y, label, by, chrome}) => {
    const a = sp(t, at, fps, 15, 120);
    if (a <= 0) return null;
    const x = 144, w = 1152, bar = chrome ? 78 : 0, vh = Math.round((w - 24) * 9 / 16), h = vh + 24 + bar;
    return (
      <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: Math.min(1, a * 1.5), transform: `translateY(${(1 - a) * 160}px) scale(${0.9 + 0.1 * a})`}}>
        <div style={{position: 'absolute', left: 0, top: 18, width: w, height: h, borderRadius: 46, background: 'rgba(0,0,0,.55)', boxShadow: '0 50px 110px rgba(0,0,0,.6)'}} />
        <div style={{position: 'absolute', inset: 0, borderRadius: 46, background: 'linear-gradient(160deg, rgba(255,255,255,.22), rgba(255,255,255,.06) 40%, rgba(255,255,255,.12))',
          boxShadow: 'inset 0 2px 0 rgba(255,255,255,.5), inset 0 0 0 2px rgba(255,255,255,.22)'}}>
          {chrome ? (
            <div style={{position: 'absolute', left: 30, top: 22, right: 30, height: 44, display: 'flex', alignItems: 'center', gap: 14}}>
              {['#FF6159', '#FFBD2E', '#28C941'].map((c) => <span key={c} style={{width: 20, height: 20, borderRadius: '50%', background: c}} />)}
              <div style={{marginLeft: 16, flex: 1, height: 48, borderRadius: 24, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 22,
                fontFamily: SANS, fontWeight: 700, fontSize: 36, color: '#D7DBDD'}}>
                <svg width={26} height={30} viewBox="0 0 26 30"><rect x={3} y={13} width={20} height={15} rx={4} fill="#D7DBDD" /><path d="M 7 13 V 9 a 6 6 0 0 1 12 0 V 13" fill="none" stroke="#D7DBDD" strokeWidth={3.5} /></svg>
                {label}
              </div>
            </div>
          ) : null}
          <div style={{position: 'absolute', left: 12, top: 12 + bar, width: w - 24, height: vh, borderRadius: 34, overflow: 'hidden', background: '#000'}}>
            {clips.map((c, i) => {
              const to = i + 1 < clips.length ? clips[i + 1].at : until;
              const o = i === 0 ? 1 : k(t, c.at, c.at + 0.18);
              const zoom = 1.02 + 0.05 * k(t, c.at, to, (v) => v);
              return (
                <Sequence key={c.src + c.at} from={Math.round(c.at * fps)} durationInFrames={Math.max(1, Math.round((to - c.at + 0.3) * fps))}>
                  <AbsoluteFill style={{opacity: o, transform: `scale(${zoom})`}}>
                    <Video src={staticFile(`r25/${c.src}.mp4`)} muted trimBefore={Math.round((c.trim ?? 0) * fps)} objectFit="cover" style={{width: '100%', height: '100%'}} />
                  </AbsoluteFill>
                </Sequence>
              );
            })}
            <div style={{position: 'absolute', inset: 0, borderRadius: 34, boxShadow: 'inset 0 0 0 2px rgba(255,255,255,.12), inset 0 -90px 90px -60px rgba(0,0,0,.55)'}} />
            <div style={{position: 'absolute', right: 22, bottom: 20, padding: '10px 22px', borderRadius: 999, background: 'rgba(0,0,0,.55)', fontFamily: SANS, fontWeight: 700, fontSize: 44, color: '#E9ECEE'}}>{by}</div>
          </div>
        </div>
        {!chrome ? (
          <div style={{position: 'absolute', left: 40, top: -36, display: 'flex', alignItems: 'center', gap: 16, padding: '14px 30px 14px 22px', borderRadius: 999, background: '#0B0E0D',
            boxShadow: `0 10px 30px rgba(0,0,0,.5), inset 0 0 0 2px ${rgba(MINT, 0.45)}`, fontFamily: SANS, fontWeight: 800, fontSize: 46, color: C.ink}}>
            <span style={{width: 18, height: 18, borderRadius: '50%', background: MINT, boxShadow: `0 0 16px ${MINT}`}} />{label}
          </div>
        ) : null}
      </div>
    );
  };

// ——— A: «Честно, мне уже страшно не только за кодеров, а за тех, кто разрабатывает игры» ———
const CODE = ['function build() {', '  const app = createApp();', '  return deploy(app);', '}'];
const Gamepad: React.FC<{size: number; t: number}> = ({size, t}) => {
  const blink = t > 5.15 ? 0.5 + 0.5 * Math.sin((t - 5.15) * 18) : 0;
  return (
    <svg width={size} height={size * 0.58} viewBox="0 0 600 348" style={{filter: `drop-shadow(0 0 40px ${rgba(ORANGE, 0.6)})`}}>
      <path d="M150 50 H450 C545 50 594 150 594 246 C594 312 552 342 508 332 C466 322 446 262 396 262 H204 C154 262 134 322 92 332 C48 342 6 312 6 246 C6 150 55 50 150 50 Z"
        fill="#101416" stroke={ORANGE} strokeWidth={8} />
      <rect x={118} y={128} width={34} height={104} rx={8} fill={C.ink} />
      <rect x={83} y={163} width={104} height={34} rx={8} fill={C.ink} />
      {[[452, 118, MINT], [498, 164, ORANGE], [406, 164, '#FFFFFF'], [452, 210, MINT]].map(([x, y, c], i) => (
        <circle key={i} cx={x as number} cy={y as number} r={24} fill={c as string} opacity={0.75 + 0.25 * (i % 2 ? blink : 1 - blink)} />
      ))}
      <rect x={262} y={140} width={30} height={16} rx={8} fill="#5E656C" /><rect x={308} y={140} width={30} height={16} rx={8} fill="#5E656C" />
    </svg>
  );
};
const SceneA: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const term = sp(t, 2.52, fps, 15, 140), away = k(t, 3.44, 3.95, E.inOut), pad = sp(t, 3.62, fps, 13, 120);
  const typed = Math.round(k(t, 2.6, 3.4, (v) => v) * CODE.join('').length);
  let left = typed;
  const shiver = t > 1.6 ? Math.sin(t * 40) * 2.5 : 0;
  return (
    <AbsoluteFill>
      <BgHorizon t={t} />
      <WordLine t={t} y={360} size={96} words={[['Честно,', 0.09], ['мне', 0.63], ['уже', 0.98]]} />
      <div style={{position: 'absolute', left: 0, top: 0, width: W, transform: `translateX(${shiver}px)`}}>
        <Big t={t} at={1.17} text="СТРАШНО" y={500} size={250} />
      </div>
      <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, opacity: 1 - away, transform: `translateX(${-away * 1300}px) rotate(${-away * 8}deg)`, transformOrigin: '720px 1050px'}}>
        <Slab x={144} y={840} w={1152} h={430} face="linear-gradient(180deg, #16191C, #0C0E10)" edge="#040505"
          style={{opacity: Math.min(1, term * 1.5), transform: `translateY(${(1 - term) * 120}px)`}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 14, padding: '30px 40px'}}>
            {['#FF6159', '#FFBD2E', '#28C941'].map((c) => <span key={c} style={{width: 20, height: 20, borderRadius: '50%', background: c}} />)}
            <span style={{marginLeft: 16, fontFamily: MONO, fontWeight: 600, fontSize: 44, color: '#8A9096'}}>app.ts</span>
          </div>
          <div style={{position: 'absolute', left: 60, top: 120, fontFamily: MONO, fontWeight: 600, fontSize: 52, lineHeight: 1.45, color: C.ink, whiteSpace: 'pre'}}>
            {CODE.map((line, i) => {
              const s = line.slice(0, Math.max(0, left)); left -= line.length;
              return <div key={i} style={{color: i === 0 || i === 3 ? MINT : C.ink}}>{s || ' '}</div>;
            })}
          </div>
        </Slab>
        <div style={{position: 'absolute', left: 184, top: 745, opacity: Math.min(1, term * 1.6)}}><Pill t={t} at={2.7} label="кодеры" size={50} /></div>
      </div>
      <div style={{position: 'absolute', left: 144, top: 840, width: 1152, height: 430, opacity: Math.min(1, pad * 1.5), transform: `translateX(${(1 - pad) * 1300}px) rotate(${(1 - pad) * 8}deg)`}}>
        <Slab x={0} y={0} w={1152} h={430} face="linear-gradient(180deg, #1B1410, #0E0B09)" edge="#050302">
          <div style={{position: 'absolute', left: 0, top: 0, width: 1152, height: 430, display: 'flex', alignItems: 'center', justifyContent: 'center'}}><Gamepad size={600} t={t} /></div>
        </Slab>
        <div style={{position: 'absolute', left: 40, top: -95}}><Pill t={t} at={4.19} label="геймдев" size={50} color={ORANGE} ink="#2A0E02" /></div>
      </div>
    </AbsoluteFill>
  );
};

// ——— B: «Anthropic Claude Opus 5.5 с первого промпта собрал» ———
const SceneB: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const card = sp(t, 5.94, fps, 12, 150);
  return (
    <AbsoluteFill>
      <BgCore t={t} />
      <PillRow y={360}><WhiteChip t={t} at={5.6} logo="anthropic" label="Anthropic" /></PillRow>
      <div style={{position: 'absolute', left: 720 - 150, top: 540, width: 300, height: 300, opacity: Math.min(1, card * 1.5), transform: `translateY(${(1 - card) * 120}px) rotate(${(1 - card) * -10}deg)`}}>
        <Slab x={0} y={0} w={300} h={300} r={70} face="linear-gradient(180deg, #FFFFFF, #EEF0ED)" edge="#9DA39F">
          <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}><Logo name="claude" size={190} /></div>
        </Slab>
      </div>
      <Big t={t} at={6.18} text="Opus 5.5" y={900} size={240} squeeze={0.9} />
      <PillRow y={1180}><Pill t={t} at={6.87} label="с первого промпта" size={60} /></PillRow>
    </AbsoluteFill>
  );
};

// ——— C: «клон Dark Souls на Unreal Engine, и это не демка, а шесть миров и 15 боссов» ———
const Counter: React.FC<{t: number; at: number; to: number; label: string; x: number; color: string}> = ({t, at, to, label, x, color}) => {
  const a = sp(t, at, FPS25, 12, 170);
  if (a <= 0) return null;
  return (
    <div style={{position: 'absolute', left: x, top: 1240, width: 520, display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 22,
      opacity: Math.min(1, a * 1.5), transform: `translateY(${(1 - a) * 60}px) scale(${0.8 + 0.2 * a})`}}>
      <span style={{fontFamily: NUM, fontWeight: 900, fontSize: 150, lineHeight: 1, color, textShadow: `0 0 50px ${rgba(color, 0.55)}, 0 6px 0 rgba(0,0,0,.4)`}}>{Math.round(to * k(t, at, at + 0.5))}</span>
      <span style={{fontFamily: SANS, fontWeight: 800, fontSize: 64, color: C.ink}}>{label}</span>
    </div>
  );
};
const SceneC: React.FC<{t: number; fps: number}> = ({t, fps}) => (
  <AbsoluteFill>
    <BgEmber t={t} />
    <div style={{position: 'absolute', left: 144, top: 330, fontFamily: HAND, fontWeight: 700, fontSize: 118, lineHeight: 1, color: ORANGE, opacity: k(t, 8.95, 9.35),
      transform: `translateY(${(1 - k(t, 8.95, 9.4)) * 30}px) rotate(-2deg)`, textShadow: '0 6px 0 rgba(0,0,0,.4)'}}>клон Dark Souls</div>
    <Brush d="M 150 470 C 400 490, 650 450, 930 468" p={k(t, 9.2, 9.8)} width={10} color={ORANGE} glow={0.8} />
    <GameCard t={t} fps={fps} at={8.95} until={14.9} y={560} label="The Ashen Gate" by="@The_Alex"
      clips={[{src: '01-darksouls-title', at: 8.95}, {src: '03-darksouls-battlements', at: 10.2, trim: 0.3}, {src: '04-darksouls-boss', at: 12.0, trim: 1.0}]} />
    <div style={{position: 'absolute', left: 144, top: 1262}}><WhiteChip t={t} at={10.0} out={11.85} logo="unrealengine" label="Unreal Engine" /></div>
    <Counter t={t} at={12.01} to={6} label="миров" x={170} color={MINT} />
    <Counter t={t} at={13.23} to={15} label="боссов" x={750} color={ORANGE} />
  </AbsoluteFill>
);

// ——— D: «Дальше классический тест Minecraft. Час 37 минут работы модели, и игра идёт прямо в браузере. Автор пишет…» ———
const Timer: React.FC<{t: number; at: number}> = ({t, at}) => {
  const a = sp(t, at, FPS25, 13, 150), fill = k(t, at, at + 1.3, E.inOut), m = Math.round(97 * fill);
  if (a <= 0) return null;
  const R = 108;
  return (
    <div style={{position: 'absolute', left: 1296 - 290, top: 470, width: 290, height: 290, opacity: Math.min(1, a * 1.5), transform: `scale(${0.7 + 0.3 * a})`}}>
      <div style={{position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(3,12,10,.86)', boxShadow: `0 20px 50px rgba(0,0,0,.55), inset 0 2px 0 rgba(255,255,255,.2)`}} />
      <svg width={290} height={290} style={{position: 'absolute', left: 0, top: 0}}>
        <circle cx={145} cy={145} r={R} fill="none" stroke="#1F2A27" strokeWidth={14} />
        <circle cx={145} cy={145} r={R} fill="none" stroke={MINT} strokeWidth={14} strokeLinecap="round" pathLength={1} strokeDasharray={`${fill * 0.97} 1`}
          transform="rotate(-90 145 145)" style={{filter: `drop-shadow(0 0 10px ${rgba(MINT, 0.8)})`}} />
      </svg>
      <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: NUM, fontWeight: 900, color: C.ink, lineHeight: 1}}>
        <span style={{fontSize: 76}}>{Math.floor(m / 60)} ч</span>
        <span style={{fontSize: 52, color: MINT, marginTop: 6}}>{m % 60} мин</span>
      </div>
    </div>
  );
};
const SceneD: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const q = sp(t, 20.95, fps, 14, 140);
  return (
    <AbsoluteFill>
      <BgAurora t={t} />
      <WordLine t={t} y={360} size={100} words={[['Тест', 15.84], ['Minecraft', 16.11]]} />
      <GameCard t={t} fps={fps} at={15.0} until={24.1} y={520} label="Lumen Vale" by="@noahwachnik" chrome
        clips={[{src: '07-minecraft-title', at: 15.0}, {src: '08-minecraft-sunset', at: 18.0}, {src: '10-minecraft-island', at: 20.9}]} />
      <Timer t={t} at={16.62} />
      <PillRow y={1290}><Pill t={t} at={20.03} out={20.8} label="прямо в браузере" size={56} /></PillRow>
      {q > 0 ? (
        <div style={{position: 'absolute', left: 144, top: 1080, width: 1152, opacity: Math.min(1, q * 1.5), transform: `translateY(${(1 - q) * 90}px) rotate(${(1 - q) * 3}deg)`}}>
          <Slab x={0} y={0} w={1152} h={250} r={40} face="linear-gradient(180deg, #FFFFFF, #F2F3F0)" edge="#8E9591">
            <div style={{position: 'absolute', left: 44, top: 38, display: 'flex', alignItems: 'center', gap: 18, fontFamily: SANS, fontWeight: 700, fontSize: 44, color: SUB}}>
              <Logo name="x" size={44} />@noahwachnik
            </div>
            <div style={{position: 'absolute', left: 44, top: 118, fontFamily: SANS, fontWeight: 800, fontSize: 50, color: INK, whiteSpace: 'nowrap'}}>«Почти лучше настоящего Minecraft»</div>
          </Slab>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ——— E: «Авиасимулятор. Выбираешь самолёт, взлетаешь из кабины и садишься обратно на полосу» ———
const SceneE: React.FC<{t: number; fps: number}> = ({t, fps}) => (
  <AbsoluteFill>
    <BgWarp t={t} />
    <Big t={t} at={24.0} text="Авиасимулятор" y={360} size={150} squeeze={0.86} />
    <GameCard t={t} fps={fps} at={24.1} until={29.5} y={600} label="Flight Simulator" by="@The_Alex"
      clips={[{src: '14-flightsim-flight', at: 24.1}, {src: '12-flightsim-planes', at: 25.1}, {src: '13-flightsim-takeoff', at: 26.1, trim: 1.0}, {src: '15-flightsim-bank', at: 27.2}]} />
    <PillRow y={1290}><Pill t={t} at={25.1} out={25.95} label="выбор самолёта" /></PillRow>
    <PillRow y={1290}><Pill t={t} at={26.1} out={27.05} label="взлёт из кабины" /></PillRow>
    <PillRow y={1290}><Pill t={t} at={27.22} label="посадка на полосу" /></PillRow>
  </AbsoluteFill>
);

// ——— F: «А для фанатов Nintendo клон Mario Maker, где строишь свой уровень и сразу в нём играешь» ———
const SceneF: React.FC<{t: number; fps: number}> = ({t, fps}) => (
  <AbsoluteFill>
    <BgPixel t={t} />
    <div style={{position: 'absolute', left: 144, top: 350, display: 'flex', alignItems: 'center', gap: 30}}>
      {([['для', 29.34], ['фанатов', 29.66]] as [string, number][]).map(([w, at]) => {
        const a = k(t, at, at + 0.45);
        return <span key={w} style={{fontFamily: SANS, fontWeight: 800, fontSize: 84, lineHeight: 1.05, letterSpacing: '-0.035em', color: C.ink, opacity: a, filter: a < 1 ? `blur(${(1 - a) * 14}px)` : undefined,
          transform: `translateY(${(1 - a) * 22}px)`, textShadow: '0 4px 0 rgba(0,0,0,.35), 0 18px 40px rgba(0,0,0,.45)'}}>{w}</span>;
      })}
      <WhiteChip t={t} at={30.42} logo="nintendo" label="Nintendo" size={54} />
    </div>
    <WordLine t={t} y={486} size={108} words={[['Mario', 31.14], ['Maker', 31.41]]} />
    <GameCard t={t} fps={fps} at={30.9} until={35.3} y={660} label="Wonder Maker" by="@The_Alex"
      clips={[{src: '16-mariomaker-title', at: 30.9}, {src: '17-mariomaker-build', at: 32.15, trim: 0.5}, {src: '19-mariomaker-play', at: 33.74}]} />
    <PillRow y={1300}><Pill t={t} at={32.15} out={33.6} label="строишь уровень" /></PillRow>
    <PillRow y={1300}><Pill t={t} at={33.74} label="и сразу играешь" color={ORANGE} ink="#2A0E02" /></PillRow>
  </AbsoluteFill>
);

// ——— G: «И всё это модель, которая по тестам Anthropic обходит GPT-6 Astra и выходит в пять раз дешевле на задачу» ———
const ModelCard: React.FC<{t: number; at: number; x: number; logo: string; name: string; note: string; dark?: boolean; lift?: number; dim?: number}> =
  ({t, at, x, logo, name, note, dark, lift = 0, dim = 0}) => {
    const a = sp(t, at, FPS25, 13, 150);
    if (a <= 0) return null;
    return (
      <div style={{position: 'absolute', left: x, top: 500 - lift * 40, width: 540, height: 430, opacity: Math.min(1, a * 1.6) * (1 - dim * 0.45), transform: `translateY(${(1 - a) * 140}px)`}}>
        <Slab x={0} y={0} w={540} h={430} r={44} face={dark ? 'linear-gradient(180deg, #1A1E21, #0E1113)' : 'linear-gradient(180deg, #FFFFFF, #F0F2EF)'} edge={dark ? '#030404' : '#9DA39F'}>
          <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18}}>
            <Logo name={logo} size={150} style={{filter: dark ? 'invert(1)' : undefined}} />
            <div style={{fontFamily: SANS, fontWeight: 800, fontSize: 68, color: dark ? C.ink : INK, letterSpacing: '-0.02em'}}>{name}</div>
            <div style={{fontFamily: SANS, fontWeight: 700, fontSize: 48, color: dark ? '#9EA5A9' : SUB}}>{note}</div>
          </div>
        </Slab>
      </div>
    );
  };
const SceneG: React.FC<{t: number}> = ({t}) => {
  const win = k(t, 37.5, 37.9, E.out), dim = k(t, 38.5, 39.0);
  return (
    <AbsoluteFill>
      <BgOrbit t={t} />
      <PillRow y={360}><WhiteChip t={t} at={36.73} logo="anthropic" label="по тестам Anthropic" size={50} /></PillRow>
      <ModelCard t={t} at={35.55} x={144} logo="claude" name="Claude" note="Opus 5.5" lift={win} />
      <ModelCard t={t} at={38.08} x={756} logo="openai" name="GPT-6" note="Astra" dark dim={dim} />
      <div style={{position: 'absolute', left: 0, top: 660 - win * 20, width: W, display: 'flex', justifyContent: 'center'}}><Pill t={t} at={37.5} label="обходит ›" size={50} /></div>
      <Big t={t} at={39.43} text="в 5 раз" y={1000} size={210} color={MINT} squeeze={0.9} glow="rgba(61,237,195,.45)" />
      <WordLine t={t} center y={1225} size={70} words={[['дешевле', 40.06], ['на', 40.68], ['задачу', 40.87]]} />
    </AbsoluteFill>
  );
};

// ——— H: «И она уже есть в обычной подписке Claude» ———
const SceneH: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const a = sp(t, 42.63, fps, 13, 140), ok = k(t, 43.3, 43.6, E.pop);
  return (
    <AbsoluteFill>
      <BgSunrise t={t} />
      <WordLine t={t} center y={360} size={92} words={[['уже', 41.97], ['есть', 42.22], ['в', 42.55], ['подписке', 43.26]]} />
      {a > 0 ? (
        <div style={{position: 'absolute', left: 270, top: 560, width: 900, height: 420, opacity: Math.min(1, a * 1.5), transform: `translateY(${(1 - a) * 120}px)`}}>
          <Slab x={0} y={0} w={900} h={420} r={48} face="linear-gradient(180deg, #FFFFFF, #F1F2EF)" edge="#9DA39F">
            <div style={{position: 'absolute', left: 60, top: 70, display: 'flex', alignItems: 'center', gap: 30}}>
              <Logo name="claude" size={130} />
              <span style={{fontFamily: SANS, fontWeight: 800, fontSize: 104, color: INK, letterSpacing: '-0.03em'}}>Claude Pro</span>
            </div>
            <div style={{position: 'absolute', left: 60, top: 270, display: 'flex', alignItems: 'center', gap: 22, opacity: ok, transform: `scale(${0.8 + 0.2 * ok})`, transformOrigin: 'left center',
              fontFamily: SANS, fontWeight: 800, fontSize: 60, color: '#0FA37F'}}>
              <svg width={70} height={70}><circle cx={35} cy={35} r={33} fill={MINT} /><path d="M 20 36 L 31 47 L 51 24" fill="none" stroke={C.mintInk} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" /></svg>
              Opus 5.5 внутри
            </div>
          </Slab>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ——— I: «Здесь всё про вайбкодинг и автоматизацию, подписывайся» ———
const SceneI: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const btn = sp(t, 45.75, fps, 13, 160), mv = k(t, 45.8, 46.2, E.inOut), press = t > 46.25 && t < 46.45 ? 0.92 : 1, done = t > 46.4;
  const ring = k(t, 46.25, 46.9);
  return (
    <AbsoluteFill>
      <BgSwirl t={t} />
      <Big t={t} at={44.83} text="ВАЙБКОДИНГ" y={400} size={190} squeeze={0.8} />
      <Big t={t} at={45.5} text="И АВТОМАТИЗАЦИЯ" y={620} size={116} squeeze={0.8} color={MINT} />
      {btn > 0 ? (
        <div style={{position: 'absolute', left: 0, top: 1070, width: W, display: 'flex', justifyContent: 'center', opacity: Math.min(1, btn * 1.5), transform: `translateY(${(1 - btn) * 80}px)`}}>
          <div style={{position: 'relative', transform: `scale(${press})`}}>
            {ring > 0 && ring < 1 ? <div style={{position: 'absolute', left: '50%', top: '50%', width: 700 * (0.8 + ring * 0.6), height: 180 * (0.8 + ring * 0.9), transform: 'translate(-50%,-50%)', borderRadius: 999,
              border: `4px solid ${rgba(MINT, 1 - ring)}`}} /> : null}
            <div style={{display: 'flex', alignItems: 'center', gap: 22, padding: '40px 84px', borderRadius: 999, background: done ? '#FFFFFF' : MINT, fontFamily: SANS, fontWeight: 800, fontSize: 76,
              color: C.mintInk, boxShadow: `0 0 70px ${rgba(MINT, 0.55)}, inset 0 4px 0 rgba(255,255,255,.55), 0 20px 40px rgba(0,0,0,.4)`}}>
              {done ? <svg width={64} height={64}><circle cx={32} cy={32} r={30} fill={MINT} /><path d="M 18 33 L 28 43 L 46 22" fill="none" stroke={C.mintInk} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
              {done ? 'Вы подписаны' : 'Подписаться'}
            </div>
          </div>
        </div>
      ) : null}
      {btn > 0 ? (
        <svg width={70} height={90} viewBox="0 0 70 90" style={{position: 'absolute', left: 1180 - mv * 360, top: 1360 - mv * 200, filter: 'drop-shadow(0 8px 14px rgba(0,0,0,.5))'}}>
          <path d="M 6 4 L 6 70 L 22 55 L 34 84 L 46 78 L 34 50 L 56 50 Z" fill="#FFFFFF" stroke="#101214" strokeWidth={4} strokeLinejoin="round" />
        </svg>
      ) : null}
    </AbsoluteFill>
  );
};

// ——— Раскладка по времени: сцена и переход входа (причина — фраза речи) ———
type Tin = 'none' | 'brush' | 'blur' | 'whip' | 'zoom';
type Sc = {from: number; tin: Tin; render: (t: number, fps: number) => React.ReactNode};
const SCENES: Sc[] = [
  {from: 0, tin: 'none', render: (t, fps) => <SceneA t={t} fps={fps} />},
  {from: 5.45, tin: 'zoom', render: (t, fps) => <SceneB t={t} fps={fps} />},
  {from: 8.8, tin: 'brush', render: (t, fps) => <SceneC t={t} fps={fps} />},
  {from: 14.6, tin: 'whip', render: (t, fps) => <SceneD t={t} fps={fps} />},
  {from: 23.85, tin: 'blur', render: (t, fps) => <SceneE t={t} fps={fps} />},
  {from: 29.2, tin: 'zoom', render: (t, fps) => <SceneF t={t} fps={fps} />},
  {from: 35.0, tin: 'brush', render: (t) => <SceneG t={t} />},
  {from: 41.6, tin: 'whip', render: (t, fps) => <SceneH t={t} fps={fps} />},
  {from: 44.2, tin: 'zoom', render: (t, fps) => <SceneI t={t} fps={fps} />},
];
const ZIGZAG = 'M -260 300 L 1700 170 L -260 760 L 1700 630 L -260 1220 L 1700 1090 L -260 1680';

const Scenes: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  let i = 0;
  for (let j = 0; j < SCENES.length; j++) if (t >= SCENES[j].from) i = j;
  const next = SCENES[i + 1], cur = SCENES[i];
  const layers: React.ReactNode[] = [];
  const layer = (sc: Sc, style: React.CSSProperties, key: string) => <AbsoluteFill key={key} style={style}>{sc.render(t, fps)}</AbsoluteFill>;
  const b = next && next.from - t < 0.2 && (next.tin === 'whip' || next.tin === 'zoom') ? next : null;
  const into = cur.from > 0 && t - cur.from < 0.3 && (cur.tin === 'whip' || cur.tin === 'zoom') ? cur : null;
  const two = b ? {prev: cur, nxt: b} : into ? {prev: SCENES[i - 1], nxt: into} : null;
  if (two) {
    const at = two.nxt.from, p = k(t, at - 0.2, at + 0.3, E.inOut);
    if (two.nxt.tin === 'whip') {
      layers.push(layer(two.prev, {transform: `translateX(${-p * W}px)`, filter: `blur(${Math.sin(p * Math.PI) * 26}px)`}, 'p'));
      layers.push(layer(two.nxt, {transform: `translateX(${(1 - p) * W}px)`, filter: `blur(${Math.sin(p * Math.PI) * 26}px)`}, 'n'));
    } else {
      layers.push(layer(two.prev, {transform: `scale(${1 + p * 0.6})`, opacity: 1 - p}, 'p'));
      layers.push(layer(two.nxt, {transform: `scale(${0.86 + 0.14 * p})`, opacity: p}, 'n'));
    }
  } else {
    let f: string | undefined;
    if (next && next.tin === 'blur' && next.from - t < 0.18) f = `blur(${k(t, next.from - 0.18, next.from) * 24}px)`;
    if (cur.tin === 'blur' && t - cur.from < 0.24) f = `blur(${(1 - k(t, cur.from, cur.from + 0.24)) * 24}px)`;
    layers.push(layer(cur, {filter: f}, 'c'));
  }
  let brush: React.ReactNode = null, flash = 0;
  for (const sc of SCENES) {
    if (sc.tin === 'brush' && t > sc.from - 0.25 && t < sc.from + 0.35) brush = <Brush d={ZIGZAG} p={k(t, sc.from - 0.25, sc.from, E.inOut)} q={k(t, sc.from, sc.from + 0.33, E.inOut)} width={560} glow={0.4} />;
    if (sc.tin === 'blur') flash = Math.max(flash, k(t, sc.from - 0.18, sc.from, E.inOut) * (1 - k(t, sc.from, sc.from + 0.24, E.inOut)));
  }
  return <>{layers}{brush}{flash > 0 ? <AbsoluteFill style={{background: '#F4FFFB', opacity: flash * 0.9}} /> : null}</>;
};

// Звуки: свежие нарезки пака под этот ролик (public/sfx/r25), громкость ×0,37 от исходной (заметка sfx-quieter).
const SFX: [number, string, number][] = [
  [0.05, 'long-a', 0.12], [1.17, 'shiver', 0.24], [2.55, 'ui-02', 0.2], [2.62, 'type-a', 0.2], [2.72, 'ui-07', 0.2], [3.46, 'swoosh-b', 0.24], [3.95, 'ui-03', 0.22], [4.2, 'ui-09', 0.2],
  [5.2, 'warp-deep', 0.26], [5.62, 'ui-05', 0.2], [5.96, 'star-flash', 0.22], [6.2, 'morph-a', 0.24], [6.9, 'ui-08', 0.22],
  [8.55, 'swoosh-a', 0.28], [8.97, 'ui-06', 0.2], [9.25, 'rubber-b', 0.16], [10.02, 'ui-01', 0.22], [10.22, 'ui-04', 0.14], [12.02, 'count', 0.24], [13.25, 'count', 0.24],
  [14.42, 'swoosh-c', 0.28], [15.02, 'ui-02', 0.2], [16.12, 'ui-10', 0.2], [16.64, 'switch-b', 0.22], [18.02, 'ui-04', 0.14], [20.05, 'ui-07', 0.22], [20.97, 'ui-05', 0.22],
  [23.68, 'blur-out', 0.26], [23.9, 'long-b', 0.16], [24.02, 'zoom-low', 0.22], [25.12, 'ui-03', 0.22], [26.12, 'ui-08', 0.22], [27.24, 'ui-09', 0.22],
  [29.0, 'warp-deep', 0.24], [30.44, 'ui-06', 0.22], [30.92, 'rubber-b', 0.2], [32.17, 'ui-02', 0.22], [33.76, 'ui-10', 0.22],
  [34.75, 'swoosh-a', 0.28], [35.57, 'ui-01', 0.2], [36.75, 'ui-05', 0.2], [37.52, 'morph-a', 0.22], [38.1, 'ui-04', 0.2], [39.45, 'big-hit', 0.22], [40.08, 'ui-07', 0.18],
  [41.42, 'swoosh-c', 0.28], [42.65, 'star-flash', 0.22], [43.32, 'ui-03', 0.22],
  [44.02, 'warp-deep', 0.24], [44.85, 'shiver', 0.2], [45.52, 'morph-a', 0.2], [45.77, 'ui-06', 0.2], [46.26, 'switch-b', 0.26],
];
const SFX_GAIN = 0.37;

export const Reel25: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  return (
    <FormatProvider value={FORMATS.reels}>
      <AbsoluteFill style={{background: VOID}}>
        <Scenes t={t} fps={fps} />
        <Speaker t={t} video={{src: 'r25/speaker.mp4', w: 1080, h: 1920, headY: 820, muted: false}} />
        <Captions t={t} words={WORDS25} cx={720} cy={1467} maxW={920} size={53.3} frameW={W} frameH={H} light={false} />
        {SFX.map(([at, name, v], i) => (
          <Sequence key={i} from={Math.round(at * fps)} durationInFrames={Math.round(2.5 * fps)} layout="none">
            <Audio src={staticFile(`sfx/r25/${name}.wav`)} volume={v * SFX_GAIN} />
          </Sequence>
        ))}
      </AbsoluteFill>
    </FormatProvider>
  );
};
