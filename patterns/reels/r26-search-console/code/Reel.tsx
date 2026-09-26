import React from 'react';
import {AbsoluteFill, Img, random, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio, Video} from '@remotion/media';
import {Captions} from '../../montage/Captions';
import {C, E, k, Logo} from '../../montage/parts';
import {FORMATS} from '../../formats';
import {FormatProvider} from '../../template/canvas';
import {WORDS26} from './words';

// Ролик 26 «Search Console находит трендовые темы». Только голос, поэтому графика во весь кадр сверху донизу (правило
// Александра 25.09): смысловое x 144–1152 / y 300–1400, субтитры y 1467, низ 1540–1990 — настоящий футаж и скриншоты
// Google; справа рейка Instagram и снизу профиль — только фон. Стиль ORBIT + Сцены: хук и финал — сцены со сменой фона,
// схема — один орбитальный холст вокруг Search Console, камера летит по орбите. Шрифты Apple SF Pro и JetBrains Mono.
// Карта: videos/reels-26-search-console/DIRECTION.md.
export const FPS26 = 60;
export const PREVIEW26 = 12;
export const END26 = 34.4;

const W = 1440, H = 2560;
const DISP = 'SF Pro Display', SANS = 'SF Pro Text', MONO = 'JBM';
const CX = 648, LX = 144, CW = 1008, LOW = 1540;
const MINT = C.mint, ORANGE = C.orange, INK = '#15181B', DIM = '#A3A9AE';

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
const sp = (t: number, at: number, fps: number, damping = 14, stiffness = 160) =>
  t < at ? 0 : spring({frame: (t - at) * fps, fps, config: {damping, stiffness, mass: 1}});
const jit = (t: number, at: number, amp = 14) => (t >= at && t < at + 0.4 ? Math.sin((t - at) * 90) * amp * (1 - (t - at) / 0.4) : 0);
const lin = (v: number) => v;
const shadowTxt = '0 4px 0 rgba(0,0,0,.35), 0 18px 40px rgba(0,0,0,.45)';

// ——— Детали ———
const Brush: React.FC<{d: string; p: number; q?: number; width: number; color?: string; glow?: number}> = ({d, p, q = 0, width, color = MINT, glow = 0.5}) => {
  if (p <= 0 || q >= 1) return null;
  return (
    <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none'}}>
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" pathLength={1}
        strokeDasharray={`${Math.max(0, p - q)} 2`} strokeDashoffset={-q} style={{filter: glow ? `drop-shadow(0 0 ${Math.round(width * 0.6)}px ${rgba(color, glow)})` : undefined}} />
    </svg>
  );
};
// Строка по словам из размытия; центр по смысловой колонке (x 648), не по кадру — справа рейка Instagram.
const WordLine: React.FC<{t: number; words: [string, number][]; y: number; size: number; color?: string; weight?: number; family?: string}> =
  ({t, words, y, size, color = C.ink, weight = 700, family = DISP}) => (
    <div style={{position: 'absolute', left: 0, width: CX * 2, top: y, display: 'flex', justifyContent: 'center', gap: size * 0.26, fontFamily: family, fontWeight: weight, fontSize: size,
      lineHeight: 1.1, letterSpacing: '-0.02em', color, whiteSpace: 'nowrap', textShadow: shadowTxt}}>
      {words.map(([w, at]) => {
        const a = k(t, at, at + 0.45);
        return <span key={w + at} style={{opacity: a, filter: a < 1 ? `blur(${(1 - a) * 14}px)` : undefined, transform: `translateY(${(1 - a) * 22}px)`, display: 'inline-block'}}>{w}</span>;
      })}
    </div>
  );
const Slab: React.FC<{x: number; y: number; w: number; h: number; r?: number; face: string; edge: string; style?: React.CSSProperties; children?: React.ReactNode}> =
  ({x, y, w, h, r = 40, face, edge, style, children}) => (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, ...style}}>
      <div style={{position: 'absolute', left: 0, top: 16, width: w, height: h, borderRadius: r, background: edge, boxShadow: '0 40px 90px rgba(0,0,0,.5)'}} />
      <div style={{position: 'absolute', left: 0, top: 0, width: w, height: h, borderRadius: r, background: face, overflow: 'hidden',
        boxShadow: 'inset 0 3px 0 rgba(255,255,255,.28), inset 0 -10px 24px rgba(0,0,0,.2), inset 0 0 0 1.5px rgba(255,255,255,.1)'}}>{children}</div>
    </div>
  );
// Тёмное стекло ORBIT: полупрозрачное, блик по краю, торец снизу.
const Glass: React.FC<{x: number; y: number; w: number; h: number; r?: number; style?: React.CSSProperties; children?: React.ReactNode; blur?: boolean}> =
  ({x, y, w, h, r = 40, style, children, blur}) => (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, ...style}}>
      <div style={{position: 'absolute', left: 0, top: 14, width: w, height: h, borderRadius: r, background: 'rgba(0,0,0,.5)', boxShadow: '0 40px 90px rgba(0,0,0,.55)'}} />
      <div style={{position: 'absolute', inset: 0, borderRadius: r, background: 'linear-gradient(165deg, rgba(40,46,52,.72), rgba(16,19,22,.62) 55%, rgba(24,28,32,.66))', overflow: 'hidden',
        backdropFilter: blur ? 'blur(18px) saturate(1.3)' : undefined, WebkitBackdropFilter: blur ? 'blur(18px) saturate(1.3)' : undefined,
        boxShadow: 'inset 0 2px 0 rgba(255,255,255,.26), inset 0 0 0 1.5px rgba(255,255,255,.12), inset 0 -14px 30px rgba(0,0,0,.3)'}}>{children}</div>
    </div>
  );
const Pill: React.FC<{t: number; at: number; out?: number; label: string; size?: number; color?: string; ink?: string; family?: string}> =
  ({t, at, out, label, size = 52, color = MINT, ink = C.mintInk, family = SANS}) => {
    const a = k(t, at, at + 0.4, E.pop), o = k(t, at, at + 0.15) * (out === undefined ? 1 : 1 - k(t, out, out + 0.2));
    if (o <= 0) return null;
    return (
      <div style={{display: 'inline-flex', alignItems: 'center', padding: `${size * 0.42}px ${size * 0.72}px`, borderRadius: 999, background: color,
        boxShadow: `0 0 44px ${rgba(color, 0.55)}, inset 0 3px 0 rgba(255,255,255,.5), 0 14px 30px rgba(0,0,0,.35)`, opacity: o, transform: `scale(${0.6 + 0.4 * a})`,
        fontFamily: family, fontWeight: 700, fontSize: size, lineHeight: 1, color: ink, whiteSpace: 'nowrap'}}>{label}</div>
    );
  };
const Row: React.FC<{y: number; children: React.ReactNode}> = ({y, children}) => (
  <div style={{position: 'absolute', left: 0, top: y, width: CX * 2, display: 'flex', justifyContent: 'center'}}>{children}</div>
);
const Pic: React.FC<{src: string; size: number; style?: React.CSSProperties}> = ({src, size, style}) => (
  <Img src={staticFile(src)} style={{width: size, height: size, objectFit: 'contain', maxWidth: 'none', ...style}} />
);
const SC = 'gsc2/search-console-color-1024.png', SHEETS = 'gsc2/google-sheets-color-1024.png';
const WhiteChip: React.FC<{t: number; at: number; logo?: string; pic?: string; label: string; size?: number}> = ({t, at, logo, pic, label, size = 50}) => {
  const a = sp(t, at, FPS26, 13, 170);
  if (a <= 0) return null;
  return (
    <div style={{display: 'inline-flex', alignItems: 'center', gap: size * 0.36, padding: `${size * 0.42}px ${size * 0.72}px ${size * 0.42}px ${size * 0.5}px`, borderRadius: 999,
      background: '#FFFFFF', boxShadow: '0 16px 40px rgba(0,0,0,.45), inset 0 -4px 0 rgba(0,0,0,.08)', opacity: Math.min(1, a * 1.6), transform: `translateY(${(1 - a) * 40}px) scale(${0.75 + 0.25 * a})`,
      fontFamily: SANS, fontWeight: 700, fontSize: size, lineHeight: 1, color: INK, whiteSpace: 'nowrap'}}>
      {pic ? <Pic src={pic} size={size * 1.2} /> : logo ? <Logo name={logo} size={size * 1.15} /> : null}{label}
    </div>
  );
};
const Big: React.FC<{t: number; at: number; text: string; y: number; size: number; color?: string; squeeze?: number}> = ({t, at, text, y, size, color = C.ink, squeeze = 0.9}) => {
  const a = k(t, at, at + 0.35), g = jit(t, at);
  if (a <= 0) return null;
  return (
    <div style={{position: 'absolute', left: 0, width: CX * 2, top: y, textAlign: 'center', fontFamily: DISP, fontWeight: 800, fontSize: size, lineHeight: 1, letterSpacing: '-0.035em',
      color, opacity: a, transform: `scaleX(${squeeze}) translateX(${g}px)`, filter: a < 1 ? `blur(${(1 - a) * 16}px)` : undefined, whiteSpace: 'nowrap',
      textShadow: `${g * 0.7}px 0 0 ${rgba(MINT, 0.85)}, ${-g * 0.7}px 0 0 ${rgba(ORANGE, 0.85)}, 0 6px 0 rgba(0,0,0,.4), 0 0 70px rgba(61,237,195,.22)`}}>{text}</div>
  );
};
const Mono: React.FC<{t: number; at: number; text: string; y: number; size: number; color?: string; dur?: number}> = ({t, at, text, y, size, color = MINT, dur = 0.8}) => {
  const n = Math.round(text.length * k(t, at, at + dur, lin));
  if (n <= 0) return null;
  return (
    <div style={{position: 'absolute', left: 0, width: CX * 2, top: y, textAlign: 'center', fontFamily: MONO, fontWeight: 600, fontSize: size, color, whiteSpace: 'pre', textShadow: shadowTxt}}>
      {text.slice(0, n)}<span style={{opacity: n < text.length ? 1 : 0}}>▍</span>
    </div>
  );
};
// Плывущий слой глубины: дальний медленнее, ближний быстрее (ORBIT — дрейф не прекращается).
const Drift: React.FC<{t: number; depth: number; ph: number; children: React.ReactNode; style?: React.CSSProperties}> = ({t, depth, ph, children, style}) => (
  <div style={{position: 'absolute', transform: `translate(${Math.sin(t * (0.35 + depth * 0.4) + ph) * 22 * depth}px, ${Math.cos(t * (0.3 + depth * 0.35) + ph * 1.3) * 16 * depth}px)`, ...style}}>{children}</div>
);
// Карточка настоящего футажа или скриншота в стеклянной рамке (появляется пружиной, дальше плывёт).
const Media: React.FC<{t: number; fps: number; at: number; x: number; y: number; w: number; h: number; src: string; video?: boolean; dur?: number; tilt?: number; depth?: number; label?: string; fit?: 'cover' | 'contain'; trim?: number}> =
  ({t, fps, at, x, y, w, h, src, video, dur = 6, tilt = 0, depth = 0.8, label, fit = 'cover', trim = 0}) => {
    const a = sp(t, at, fps, 14, 130);
    if (a <= 0) return null;
    return (
      <Drift t={t} depth={depth} ph={x * 0.013 + y * 0.007} style={{left: x, top: y}}>
        <div style={{width: w, height: h, padding: 9, borderRadius: 32, background: 'linear-gradient(160deg, rgba(255,255,255,.34), rgba(255,255,255,.1))',
          boxShadow: 'inset 0 2px 0 rgba(255,255,255,.5), 0 40px 90px rgba(0,0,0,.6)', opacity: Math.min(1, a * 1.5),
          transform: `translateY(${(1 - a) * 140}px) rotate(${tilt * (0.4 + 0.6 * a)}deg) scale(${0.86 + 0.14 * a})`}}>
          <div style={{position: 'relative', width: w - 18, height: h - 18, borderRadius: 24, overflow: 'hidden', background: '#F1F3F4'}}>
            {video ? (
              <Sequence from={Math.round(at * fps)} durationInFrames={Math.round(dur * fps)}>
                <AbsoluteFill><Video src={staticFile(src)} muted trimBefore={Math.round(trim * fps)} objectFit={fit} style={{width: w - 18, height: h - 18}} /></AbsoluteFill>
              </Sequence>
            ) : <Img src={staticFile(src)} style={{width: w - 18, height: h - 18, objectFit: fit, maxWidth: 'none'}} />}
          </div>
          {label ? <div style={{position: 'absolute', left: 26, top: -30, padding: '10px 22px', borderRadius: 999, background: '#0B0E0D', boxShadow: `inset 0 0 0 2px ${rgba(MINT, 0.45)}`,
            fontFamily: MONO, fontWeight: 600, fontSize: 36, color: C.ink, whiteSpace: 'nowrap'}}>{label}</div> : null}
        </div>
      </Drift>
    );
  };

// ——— Космос ———
const Stars: React.FC<{t: number; seed: string; n: number; vx?: number; vy?: number; ox?: number; oy?: number; r?: [number, number]}> =
  ({t, seed, n, vx = 0, vy = 0, ox = 0, oy = 0, r = [1.1, 3.4]}) => {
    const items: React.ReactNode[] = [];
    for (let i = 0; i < n; i++) {
      const rr = r[0] + (r[1] - r[0]) * Math.pow(random(`${seed}r${i}`), 2.4), depth = 0.35 + rr / r[1];
      const x = (((random(`${seed}x${i}`) * W + (vx * t - ox) * depth) % W) + W) % W, y = (((random(`${seed}y${i}`) * H + (vy * t - oy) * depth) % H) + H) % H;
      const a = 0.5 + 0.5 * Math.sin(t * (0.6 + random(`${seed}f${i}`) * 1.8) * 2 + random(`${seed}p${i}`) * 6.28);
      items.push(<circle key={i} cx={x} cy={y} r={rr} fill="#FFFFFF" opacity={a} />);
    }
    return <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>{items}</svg>;
  };
const Glow: React.FC<{x: number; y: number; w: number; h?: number; color: string; a: number; rot?: number}> = ({x, y, w, h = w, color, a, rot = 0}) => (
  <div style={{position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, borderRadius: '50%', transform: `rotate(${rot}deg)`,
    background: `radial-gradient(closest-side, ${rgba(color, a)}, ${rgba(color, a * 0.35)} 45%, ${rgba(color, 0)})`}} />
);
const Graphite: React.FC<{children?: React.ReactNode}> = ({children}) => (
  <AbsoluteFill style={{background: 'radial-gradient(120% 90% at 50% 20%, #151A1D 0%, #0A0D0F 55%, #040506 100%)', overflow: 'hidden'}}>{children}</AbsoluteFill>
);
const Planet: React.FC<{cx: number; cy: number; r: number; rim?: string; light?: number}> = ({cx, cy, r, rim = ORANGE, light = 0.55}) => (
  <div style={{position: 'absolute', left: cx - r, top: cy - r, width: r * 2, height: r * 2, borderRadius: '50%', background: 'radial-gradient(circle at 50% 18%, #1C2126 0%, #0A0C0E 42%, #040506 72%)',
    boxShadow: `0 0 70px 18px ${rgba(rim, light)}, 0 0 220px 70px ${rgba(rim, light * 0.3)}, inset 0 30px 80px ${rgba(rim, 0.25)}`}} />
);

// ——— Сцена 1: «Классная бесплатная фишка для тех, кто ведёт свой блог» ———
const LOGOS: [string, number, number, number, number, number][] = [
  ['instagram', 250, 1690, 210, 1.0, 1.84], ['tiktok', 520, 1860, 170, 0.6, 2.05], ['youtube', 820, 1680, 200, 0.85, 2.33], ['x', 1040, 1860, 160, 0.55, 2.66],
];
const SceneHook: React.FC<{t: number; fps: number}> = ({t, fps}) => (
  <Graphite>
    <Stars t={t} seed="h1" n={170} vx={-10} />
    <Glow x={1000} y={600} w={1400} h={1000} color={MINT} a={0.14} rot={30} />
    <Planet cx={-240 + Math.sin(t * 0.2) * 20} cy={2500} r={1300} />
    <Big t={t} at={0.48} text="БЕСПЛАТНАЯ" y={380} size={168} />
    <Big t={t} at={1.09} text="ФИШКА" y={560} size={260} color={ORANGE} />
    <Mono t={t} at={1.58} text="// для тех, кто ведёт блог" y={870} size={54} />
    {[0, 1, 2].map((i) => {
      const a = sp(t, 1.9 + i * 0.18, fps, 13, 140);
      if (a <= 0) return null;
      return (
        <Drift key={i} t={t} depth={0.5 + i * 0.25} ph={i * 2} style={{left: 214 + i * 300, top: 990}}>
          <div style={{width: 260, height: 380, borderRadius: 36, opacity: Math.min(1, a * 1.5), transform: `translateY(${(1 - a) * 120}px) rotate(${(i - 1) * 5}deg)`,
            background: 'linear-gradient(170deg, #2A3035, #111416)', boxShadow: `inset 0 2px 0 rgba(255,255,255,.25), inset 0 0 0 2px ${rgba(i === 1 ? ORANGE : MINT, 0.55)}, 0 30px 70px rgba(0,0,0,.6)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <svg width={80} height={90} viewBox="0 0 80 90"><path d="M 10 5 L 76 45 L 10 85 Z" fill={i === 1 ? ORANGE : MINT} style={{filter: `drop-shadow(0 0 16px ${rgba(i === 1 ? ORANGE : MINT, 0.7)})`}} /></svg>
          </div>
        </Drift>
      );
    })}
    {LOGOS.map(([logo, x, y, size, depth, at], i) => {
      const a = sp(t, at, fps, 12, 150);
      if (a <= 0) return null;
      return (
        <Drift key={logo} t={t} depth={depth} ph={i * 1.7} style={{left: x - size / 2, top: y - size / 2}}>
          <div style={{width: size, height: size, borderRadius: size * 0.28, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: Math.min(1, a * 1.5),
            transform: `scale(${0.5 + 0.5 * a}) rotate(${(1 - depth) * 12 - 5}deg)`, boxShadow: `0 ${24 * depth}px ${60 * depth}px rgba(0,0,0,.55), inset 0 -5px 0 rgba(0,0,0,.08)`}}>
            <Logo name={logo} size={size * 0.6} />
          </div>
        </Drift>
      );
    })}
  </Graphite>
);

// ——— Сцена 2: «Теперь Google Search Console может находить для тебя трендовые темы» ———
const ORBITS = [300, 430, 560];
const TOPICS = ['нейросети', 'Claude Code', 'вайбкодинг', 'ИИ-агенты', 'автоматизация', 'боты'];
const SceneSun: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const cx = CX, cy = 800, logo = sp(t, 3.61, fps, 12, 120), chipsIn = k(t, 5.68, 6.3);
  const chips = TOPICS.map((label, i) => {
    const orbit = ORBITS[i % 3], ang = t * (0.5 - (i % 3) * 0.1) + (i * Math.PI * 2) / TOPICS.length;
    return {label, x: cx + Math.cos(ang) * orbit, y: cy + Math.sin(ang) * orbit * 0.34, front: Math.sin(ang) > 0, i};
  });
  const chip = (c: (typeof chips)[number]) => {
    const a = k(t, 5.68 + c.i * 0.08, 5.68 + c.i * 0.08 + 0.4, E.pop);
    if (a <= 0) return null;
    return (
      <div key={c.label} style={{position: 'absolute', left: c.x, top: c.y, transform: `translate(-50%,-50%) scale(${(c.front ? 1 : 0.78) * (0.6 + 0.4 * a)})`, opacity: a * (c.front ? 1 : 0.6),
        display: 'flex', alignItems: 'center', gap: 12, padding: '14px 26px', borderRadius: 999, background: 'rgba(16,20,22,.82)', boxShadow: `inset 0 0 0 2px ${rgba(MINT, 0.5)}, 0 12px 30px rgba(0,0,0,.5)`,
        fontFamily: MONO, fontWeight: 600, fontSize: 40, color: C.ink, whiteSpace: 'nowrap'}}>
        <span style={{color: MINT}}>↑</span>{c.label}
      </div>
    );
  };
  return (
    <Graphite>
      <Stars t={t} seed="h2" n={150} vy={5} />
      <Glow x={cx} y={cy} w={1500} h={900} color={MINT} a={0.12} rot={-14} />
      <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
        {ORBITS.map((r, i) => <ellipse key={r} cx={cx} cy={cy} rx={r} ry={r * 0.34} fill="none" stroke={MINT} strokeWidth={3} opacity={0.35 - i * 0.07}
          strokeDasharray="10 16" strokeDashoffset={-t * 40 * (i + 1)} />)}
      </svg>
      {chipsIn > 0 ? chips.filter((c) => !c.front).map(chip) : null}
      <Glow x={cx} y={cy} w={560} color="#FFFFFF" a={0.22 * logo} />
      <div style={{position: 'absolute', left: cx - 150, top: cy - 150, width: 300, height: 300, opacity: Math.min(1, logo * 1.5), transform: `scale(${0.6 + 0.4 * logo}) rotate(${(1 - logo) * -20}deg)`}}>
        <Slab x={0} y={0} w={300} h={300} r={80} face="linear-gradient(180deg, #FFFFFF, #EEF0ED)" edge="#9DA39F">
          <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}><Pic src={SC} size={200} /></div>
        </Slab>
      </div>
      {chipsIn > 0 ? chips.filter((c) => c.front).map(chip) : null}
      <WordLine t={t} y={330} size={86} words={[['Google', 3.61], ['Search', 3.81], ['Console', 4.01]]} />
      <Big t={t} at={5.68} text="ТРЕНДОВЫЕ ТЕМЫ" y={1150} size={128} color={MINT} />
      <Media t={t} fps={fps} at={4.3} x={288} y={LOW} w={720} h={450} src="gsc2/tut-home.mp4" video dur={3.2} trim={1.2} tilt={-2} label="search.google.com" />
    </Graphite>
  );
};

// ——— Орбитальный холст: блоки на эллипсе вокруг Search Console, камера летит по орбите ———
// Блок: локальная ширина 1008, локальный y 0 = экранный 300 в покое; верх 0…1100 — смысл, низ 1240…1690 — футаж.
const OX = 2900, OY = 3100, RX = 2150, RY = 1850;
const ANG = [-150, -106, -62, -18, 34].map((d) => (d * Math.PI) / 180);
const BP = ANG.map((a) => ({x: OX + RX * Math.cos(a), y: OY + RY * Math.sin(a)}));
const MOVES: [number, number][] = [[9.72, 1], [13.1, 2], [15.52, 3], [21.42, 4]];
const MOVE = 0.7;
const flow = (v: number) => (v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2);
const camAt = (t: number) => {
  let from = 0, to = 0, p = 1;
  for (const [at, b] of MOVES) {
    if (t >= at + MOVE) { from = b; to = b; }
    else if (t >= at) { to = b; p = flow((t - at) / MOVE); break; }
    else break;
  }
  const a = ANG[from] + (ANG[to] - ANG[from]) * p;
  const s = 1 - 0.28 * Math.sin(Math.PI * (from === to ? 0 : p));
  return {x: OX + RX * Math.cos(a) + Math.sin(t * 0.5) * 10, y: OY + RY * Math.sin(a) + Math.cos(t * 0.4) * 8, s, a, idx: from + (to - from) * p};
};
const arcPath = (a0: number, a1: number) => {
  const pts: string[] = [];
  for (let i = 0; i <= 60; i++) { const a = a0 + ((a1 - a0) * i) / 60; pts.push(`${(OX + RX * Math.cos(a)).toFixed(1)},${(OY + RY * Math.sin(a)).toFixed(1)}`); }
  return 'M ' + pts.join(' L ');
};
// Экранная точка покоя блока: локальная (504, 580) → экран (648, 880).
const Block: React.FC<{i: number; children: React.ReactNode}> = ({i, children}) => (
  <div style={{position: 'absolute', left: BP[i].x - 504, top: BP[i].y - 580, width: CW, height: 1700}}>{children}</div>
);

// Блок 1: «Подключаешь Instagram, TikTok, YouTube или X» — спроектированное окно «Выберите тип ресурса».
const PLATFORMS: [string, string, number][] = [['instagram', 'Instagram', 8.03], ['tiktok', 'TikTok', 8.78], ['youtube', 'YouTube', 9.01], ['x', 'X', 9.49]];
const B1: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const m = sp(t, 7.2, fps, 15, 120);
  return (
    <Block i={0}>
      <div style={{position: 'absolute', left: 0, top: 0}}><WhiteChip t={t} at={7.25} pic={SC} label="Search Console" size={46} /></div>
      <Glass x={0} y={120} w={CW} h={720} r={48} blur style={{opacity: Math.min(1, m * 1.5), transform: `translateY(${(1 - m) * 100}px)`}}>
        <div style={{position: 'absolute', left: 52, top: 44, fontFamily: DISP, fontWeight: 700, fontSize: 60, color: C.ink}}>Выберите тип ресурса</div>
        <div style={{position: 'absolute', left: 52, top: 146, width: CW - 104, height: 78, borderRadius: 39, background: 'rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: SANS, fontWeight: 700, fontSize: 44, color: DIM}}>Добавить сайт</div>
        <div style={{position: 'absolute', left: 52, top: 250, width: CW - 104, display: 'flex', alignItems: 'center', gap: 20, fontFamily: MONO, fontWeight: 600, fontSize: 34, color: DIM}}>
          <div style={{flex: 1, height: 2, background: 'rgba(255,255,255,.14)'}} />новый<div style={{flex: 1, height: 2, background: 'rgba(255,255,255,.14)'}} />
        </div>
        {PLATFORMS.map(([logo, name, at], i) => {
          const on = k(t, at, at + 0.3, E.out), pop = k(t, at, at + 0.35, E.pop) * (1 - k(t, at + 0.35, at + 0.8));
          return (
            <div key={logo} style={{position: 'absolute', left: 52, top: 312 + i * 96, width: CW - 104, height: 80, borderRadius: 40, display: 'flex', alignItems: 'center', gap: 24, paddingLeft: 20,
              background: on > 0 ? `rgba(61,237,195,${0.12 * on})` : 'rgba(255,255,255,.04)', boxShadow: `inset 0 0 0 2px rgba(61,237,195,${0.6 * on})`}}>
              <div style={{width: 60, height: 60, borderRadius: 16, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${1 + pop * 0.35})`}}>
                <Logo name={logo} size={42} />
              </div>
              <span style={{fontFamily: SANS, fontWeight: 700, fontSize: 48, color: C.ink}}>{name}</span>
              <span style={{marginLeft: 'auto', marginRight: 34, fontFamily: MONO, fontWeight: 700, fontSize: 40, color: on > 0.5 ? MINT : '#7FB9AB'}}>{on > 0.5 ? '✓ добавлен' : 'добавить'}</span>
            </div>
          );
        })}
      </Glass>
      <Media t={t} fps={fps} at={8.03} x={0} y={1240} w={560} h={350} src="gsc2/tut-allow.mp4" video dur={4.5} tilt={-2} label="вход через Instagram" />
      <Media t={t} fps={fps} at={9.25} x={590} y={1270} w={418} h={310} src="gsc2/ref-added.mp4" video dur={3.4} tilt={3} depth={1} />
    </Block>
  );
};

// Блок 2: «Google показывает, по каким запросам люди находят твои ролики».
const QUERIES: [string, number, number][] = [['как настроить claude code', 10.7, 0.92], ['бесплатные токены для ии', 11.12, 0.74], ['автоматизация директа', 11.65, 0.58], ['вайбкодинг с нуля', 12.1, 0.44]];
const B2: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const p = sp(t, 9.9, fps, 15, 120);
  return (
    <Block i={1}>
      <Glass x={0} y={40} w={CW} h={700} r={46} blur style={{opacity: Math.min(1, p * 1.5), transform: `translateY(${(1 - p) * 80}px)`}}>
        <div style={{position: 'absolute', left: 48, top: 42, display: 'flex', alignItems: 'center', gap: 20, fontFamily: DISP, fontWeight: 700, fontSize: 58, color: C.ink}}>
          <Pic src={SC} size={62} />Эффективность
        </div>
        <div style={{position: 'absolute', left: 48, right: 48, top: 150, display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontWeight: 600, fontSize: 34, color: DIM}}>
          <span>запросы → твои ролики</span><span>клики</span>
        </div>
        {QUERIES.map(([q, at, v], i) => {
          const n = Math.round(q.length * k(t, at, at + 0.45, lin)), bar = k(t, at + 0.1, at + 0.7);
          return (
            <div key={q} style={{position: 'absolute', left: 48, right: 48, top: 222 + i * 116, height: 96, display: 'flex', alignItems: 'center', borderTop: '1.5px solid rgba(255,255,255,.08)'}}>
              <span style={{fontFamily: MONO, fontWeight: 600, fontSize: 44, color: C.ink, whiteSpace: 'nowrap'}}>{q.slice(0, n)}<span style={{opacity: n > 0 && n < q.length ? 1 : 0, color: MINT}}>▍</span></span>
              <div style={{marginLeft: 'auto', width: 200, height: 22, borderRadius: 11, background: 'rgba(255,255,255,.08)'}}>
                <div style={{width: `${bar * v * 100}%`, height: '100%', borderRadius: 11, background: `linear-gradient(90deg, ${rgba(MINT, 0.5)}, ${MINT})`, boxShadow: `0 0 16px ${rgba(MINT, 0.6)}`}} />
              </div>
            </div>
          );
        })}
      </Glass>
      <Media t={t} fps={fps} at={11.91} x={0} y={1230} w={CW} h={458} src="gsc2/ref-content.mp4" video dur={4} tilt={-1.5} label="Ваш контент" />
    </Block>
  );
};

// Блок 3: «И какие из этих тем растут прямо сейчас».
const TRENDS: [string, number][] = [['claude opus 5.5', 14.3], ['бесплатные токены', 14.55], ['ии-ассистент в директ', 14.8]];
const Spark: React.FC<{p: number; seed: number}> = ({p, seed}) => {
  const pts: string[] = [];
  for (let i = 0; i <= 20; i++) { const x = i * 11, y = 70 - (i / 20) ** 2.2 * 58 - Math.sin(i * 1.7 + seed) * 5; pts.push(`${x},${y.toFixed(1)}`); }
  return (
    <svg width={226} height={80} viewBox="0 0 226 80"><polyline points={pts.join(' ')} fill="none" stroke={MINT} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" pathLength={1}
      strokeDasharray={`${p} 1`} style={{filter: `drop-shadow(0 0 8px ${rgba(MINT, 0.7)})`}} /></svg>
  );
};
const B3: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const p = sp(t, 13.25, fps, 15, 120), tab = k(t, 14.1, 14.5, E.inOut);
  const tabs: [string, number, number][] = [['Наверх', 48, 124], ['Популярность растёт', 206, 330], ['Популярность снижается', 580, 380]];
  const ux = tabs[0][1] + (tabs[1][1] - tabs[0][1]) * tab, uw = tabs[0][2] + (tabs[1][2] - tabs[0][2]) * tab;
  return (
    <Block i={2}>
      <Glass x={0} y={40} w={CW} h={780} r={46} blur style={{opacity: Math.min(1, p * 1.5), transform: `translateY(${(1 - p) * 80}px)`}}>
        <div style={{position: 'absolute', left: 48, top: 38, fontFamily: DISP, fontWeight: 700, fontSize: 56, color: C.ink}}>Ваш контент</div>
        {tabs.map(([label, x], i) => (
          <div key={label} style={{position: 'absolute', left: x, top: 128, fontFamily: SANS, fontWeight: 700, fontSize: 32, color: (i === 1 ? tab : i === 0 ? 1 - tab : 0) > 0.5 ? MINT : DIM, whiteSpace: 'nowrap'}}>{label}</div>
        ))}
        <div style={{position: 'absolute', left: ux, top: 178, width: uw, height: 6, borderRadius: 3, background: MINT, boxShadow: `0 0 14px ${MINT}`}} />
        {TRENDS.map(([q, at], i) => {
          const a = k(t, at, at + 0.4);
          return (
            <div key={q} style={{position: 'absolute', left: 48, right: 48, top: 226 + i * 176, height: 156, display: 'flex', alignItems: 'center', gap: 20, borderTop: '1.5px solid rgba(255,255,255,.08)',
              opacity: a, transform: `translateX(${(1 - a) * 60}px)`}}>
              <span style={{fontFamily: MONO, fontWeight: 600, fontSize: 44, color: C.ink, whiteSpace: 'nowrap'}}>{q}</span>
              <div style={{marginLeft: 'auto'}}><Spark p={k(t, at + 0.1, at + 0.9)} seed={i} /></div>
              <div style={{width: 74, height: 74, borderRadius: '50%', background: MINT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: DISP, fontWeight: 800, fontSize: 46, color: C.mintInk,
                boxShadow: `0 0 30px ${rgba(MINT, 0.6)}`}}>↑</div>
            </div>
          );
        })}
      </Glass>
      <Media t={t} fps={fps} at={13.6} x={0} y={1250} w={CW} h={410} src="gsc2/query-group.png" fit="cover" tilt={1.5} label="Insights · группы запросов" />
    </Block>
  );
};

// Блок 4: «Есть даже фильтр за последние 24 часа. Сразу видно, какой ролик внезапно полетел из поиска».
const RANGES = ['24 часа', '7 дней', '28 дней', '3 мес.'];
const B4: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const p = sp(t, 15.6, fps, 15, 120), sel = t >= 17.55 ? 0 : 2, cur = k(t, 16.9, 17.45, E.inOut), tap = t > 17.45 && t < 17.65 ? 0.9 : 1;
  const draw = k(t, 16.2, 18.4, lin), spike = k(t, 19.96, 20.5, E.out);
  const pts: [number, number][] = [];
  for (let i = 0; i <= 38; i++) {
    const x = 40 + i * 24.5, base = 520 - Math.sin(i * 0.9) * 10 - Math.sin(i * 0.37) * 14;
    pts.push([x, base - Math.exp(-Math.pow((i - 31) / 2.2, 2)) * 340 * spike]);
  }
  const path = 'M ' + pts.map(([x, y]) => `${x},${y.toFixed(1)}`).join(' L ');
  const peak = pts[31], card = k(t, 20.0, 20.7, E.out);
  return (
    <Block i={3}>
      <div style={{position: 'absolute', left: 0, top: 10, display: 'flex', gap: 16, opacity: Math.min(1, p * 1.5)}}>
        {RANGES.map((r, i) => (
          <div key={r} style={{padding: '22px 28px', borderRadius: 999, fontFamily: MONO, fontWeight: 700, fontSize: 38, whiteSpace: 'nowrap', transform: `scale(${i === 0 ? tap : 1})`,
            background: i === sel ? MINT : 'rgba(22,26,30,.8)', color: i === sel ? C.mintInk : C.ink,
            boxShadow: i === sel ? `0 0 40px ${rgba(MINT, 0.55)}, inset 0 3px 0 rgba(255,255,255,.5)` : 'inset 0 0 0 2px rgba(255,255,255,.16), 0 14px 30px rgba(0,0,0,.4)'}}>{r}</div>
        ))}
      </div>
      <svg width={70} height={90} viewBox="0 0 70 90" style={{position: 'absolute', left: 560 - cur * 440, top: 250 - cur * 170, opacity: k(t, 16.6, 16.9) * (1 - k(t, 18.2, 18.5)), filter: 'drop-shadow(0 8px 14px rgba(0,0,0,.5))'}}>
        <path d="M 6 4 L 6 70 L 22 55 L 34 84 L 46 78 L 34 50 L 56 50 Z" fill="#FFFFFF" stroke="#101214" strokeWidth={4} strokeLinejoin="round" />
      </svg>
      <Glass x={0} y={170} w={CW} h={700} r={46} blur style={{opacity: Math.min(1, p * 1.5), transform: `translateY(${(1 - p) * 80}px)`}}>
        <div style={{position: 'absolute', left: 44, top: 34, fontFamily: DISP, fontWeight: 700, fontSize: 50, color: C.ink}}>Клики из Google за 24 часа</div>
        <svg width={CW} height={700} style={{position: 'absolute', left: 0, top: 0}}>
          {[190, 320, 450, 580].map((y) => <line key={y} x1={40} x2={CW - 40} y1={y} y2={y} stroke="rgba(255,255,255,.07)" strokeWidth={2} />)}
          <path d={path} fill="none" stroke={spike > 0 ? ORANGE : MINT} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${draw} 1`}
            style={{filter: `drop-shadow(0 0 12px ${rgba(spike > 0 ? ORANGE : MINT, 0.8)})`}} />
          {spike > 0 ? <circle cx={peak[0]} cy={peak[1]} r={14 + 10 * Math.sin(t * 9) ** 2} fill={ORANGE} style={{filter: `drop-shadow(0 0 24px ${ORANGE})`}} /> : null}
        </svg>
        {card > 0 ? (
          <div style={{position: 'absolute', left: peak[0] - 390, top: peak[1] - 50 + (1 - card) * 200, display: 'flex', alignItems: 'center', gap: 16, opacity: card}}>
            <div style={{width: 90, height: 150, borderRadius: 18, background: 'linear-gradient(180deg, #2A2F33, #121517)', boxShadow: `inset 0 0 0 3px ${ORANGE}, 0 14px 30px rgba(0,0,0,.5)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <svg width={40} height={46} viewBox="0 0 40 46"><path d="M 4 3 L 38 23 L 4 43 Z" fill="#FFFFFF" /></svg>
            </div>
            <Pill t={t} at={20.2} label="↑ полетел" size={46} color={ORANGE} ink="#2A0E02" />
          </div>
        ) : null}
      </Glass>
      <Media t={t} fps={fps} at={16.3} x={0} y={1250} w={620} h={388} src="gsc2/tut-report.mp4" video dur={6} tilt={-2} label="отчёт «Эффективность»" />
      <Media t={t} fps={fps} at={19.9} x={650} y={1240} w={358} h={368} src="gsc2/search-console-social-video-platforms.png" fit="cover" tilt={3} depth={1} />
    </Block>
  );
};

// Блок 5: «Дальше выгружаешь отчёт, отдаёшь Claude, и он собирает из этих запросов темы для следующих роликов».
const IDEAS: [string, number][] = [['Claude Code для новичков', 24.67], ['Бесплатные токены для нейросетей', 25.3], ['Бот в директ без кода', 25.85]];
const B5: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const sh = sp(t, 21.94, fps, 13, 140), cl = sp(t, 23.55, fps, 13, 140);
  const fly = (i: number) => k(t, 23.75 + i * 0.12, 24.35 + i * 0.12, E.inOut);
  return (
    <Block i={4}>
      <div style={{position: 'absolute', left: 0, top: 0}}><Pill t={t} at={21.7} label="⤓ экспорт" size={44} family={MONO} /></div>
      <div style={{position: 'absolute', left: 0, top: 110, width: 480, height: 470, opacity: Math.min(1, sh * 1.5), transform: `translateY(${(1 - sh) * 100}px)`}}>
        <Slab x={0} y={0} w={480} h={470} r={40} face="linear-gradient(180deg, #FFFFFF, #F1F2EF)" edge="#9DA39F">
          <div style={{position: 'absolute', left: 34, top: 30, display: 'flex', alignItems: 'center', gap: 18, fontFamily: DISP, fontWeight: 700, fontSize: 50, color: INK}}><Pic src={SHEETS} size={84} />Таблицы</div>
          {[0, 1, 2, 3].map((r) => (
            <div key={r} style={{position: 'absolute', left: 34, right: 34, top: 160 + r * 70, height: 48, display: 'flex', gap: 12, opacity: k(t, 22.1 + r * 0.12, 22.3 + r * 0.12)}}>
              <div style={{flex: 3, borderRadius: 8, background: '#E3F2EA'}} /><div style={{flex: 1, borderRadius: 8, background: '#CFEBDD'}} />
            </div>
          ))}
        </Slab>
      </div>
      <div style={{position: 'absolute', left: 528, top: 110, width: 480, height: 470, opacity: Math.min(1, cl * 1.5), transform: `translateY(${(1 - cl) * 100}px)`}}>
        <Slab x={0} y={0} w={480} h={470} r={40} face="linear-gradient(180deg, #FFFFFF, #F1F2EF)" edge="#9DA39F">
          <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22}}>
            <Logo name="claude" size={160} style={{transform: `rotate(${t * 20}deg)`}} />
            <span style={{fontFamily: DISP, fontWeight: 700, fontSize: 66, color: INK}}>Claude</span>
          </div>
        </Slab>
      </div>
      {[0, 1, 2, 3].map((i) => {
        const f = fly(i);
        if (f <= 0 || f >= 1) return null;
        return <div key={i} style={{position: 'absolute', left: 280 + f * 540, top: 360 - Math.sin(f * Math.PI) * 230 + i * 18, width: 150, height: 30, borderRadius: 10, background: MINT,
          boxShadow: `0 0 20px ${rgba(MINT, 0.8)}`, opacity: 0.9}} />;
      })}
      {IDEAS.map(([idea, at], i) => {
        const a = sp(t, at, fps, 14, 150), n = Math.round(idea.length * k(t, at + 0.1, at + 0.55, lin));
        if (a <= 0) return null;
        return (
          <Glass key={idea} x={0} y={660 + i * 146} w={CW} h={124} r={34} style={{opacity: Math.min(1, a * 1.5), transform: `translateY(${(1 - a) * 60}px)`}}>
            <div style={{position: 'absolute', left: 30, top: 0, height: 124, display: 'flex', alignItems: 'center', gap: 22}}>
              <span style={{padding: '10px 20px', borderRadius: 999, background: MINT, fontFamily: MONO, fontWeight: 700, fontSize: 36, color: C.mintInk}}>тема {i + 1}</span>
              <span style={{fontFamily: SANS, fontWeight: 700, fontSize: 50, color: C.ink, whiteSpace: 'nowrap'}}>{idea.slice(0, n)}</span>
            </div>
          </Glass>
        );
      })}
      <Media t={t} fps={fps} at={21.9} x={120} y={1250} w={768} h={480} src="gsc2/compare-playlists.png" fit="cover" tilt={-1.5} label="выгрузка из Search Console" />
    </Block>
  );
};

const CanvasScene: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const cam = camAt(t), s = cam.s;
  const tx = CX - cam.x * s, ty = 880 - cam.y * s;
  const blocks = [B1, B2, B3, B4, B5];
  return (
    <Graphite>
      <Stars t={t} seed="cv" n={190} ox={cam.x * 0.25} oy={cam.y * 0.25} />
      <div style={{position: 'absolute', left: 0, top: 0, width: 6200, height: 6200, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${s})`}}>
        <Glow x={OX} y={OY} w={2800} h={2200} color={MINT} a={0.07} />
        <Glow x={BP[3].x} y={BP[3].y + 400} w={2000} h={1800} color={ORANGE} a={0.1} />
        <Glow x={BP[0].x} y={BP[0].y + 400} w={1900} h={1700} color={MINT} a={0.12} />
        <svg width={6200} height={6200} style={{position: 'absolute', left: 0, top: 0}}>
          {[0.45, 0.72, 1.3].map((f) => <ellipse key={f} cx={OX} cy={OY} rx={RX * f} ry={RY * f} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth={3} />)}
          {Array.from({length: 12}, (_, i) => { const a = (i / 12) * Math.PI * 2; return <line key={i} x1={OX} y1={OY} x2={OX + Math.cos(a) * RX * 1.4} y2={OY + Math.sin(a) * RY * 1.4} stroke="rgba(255,255,255,.04)" strokeWidth={3} />; })}
          <ellipse cx={OX} cy={OY} rx={RX} ry={RY} fill="none" stroke={rgba(MINT, 0.14)} strokeWidth={5} strokeDasharray="18 22" />
          <path d={arcPath(ANG[0] - 0.25, cam.a)} fill="none" stroke={MINT} strokeWidth={8} strokeDasharray="22 18" opacity={k(t, 7.1, 7.8)} style={{filter: `drop-shadow(0 0 12px ${rgba(MINT, 0.7)})`}} />
        </svg>
        <div style={{position: 'absolute', left: OX - 170, top: OY - 170, width: 340, height: 340, borderRadius: 90, background: '#FFFFFF', opacity: 0.55, boxShadow: `0 0 160px 40px ${rgba(MINT, 0.25)}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center'}}><Pic src={SC} size={230} /></div>
        {blocks.map((B, i) => {
          // соседний блок виден только в пролёте камеры (якорь), в покое гаснет — иначе его футаж лезет в кадр
          const vis = Math.max(0, Math.min(1, (1 - Math.abs(i - cam.idx)) / 0.4));
          return vis > 0 ? <div key={i} style={{opacity: vis}}><B t={t} fps={fps} /></div> : null;
        })}
      </div>
    </Graphite>
  );
};

// ——— Сцена: «Снимаешь то, что от тебя реально ждут» — край планеты, ролики в выдаче Google, рамка с REC ———
const SceneShoot: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const f = sp(t, 27.35, fps, 14, 130), rec = Math.floor(t * 2.5) % 2;
  return (
    <Graphite>
      <Stars t={t} seed="sh" n={140} vx={6} />
      <Planet cx={CX} cy={1300 + 1760} r={1760} light={0.75} />
      <Glow x={CX} y={1290} w={2400} h={500} color={ORANGE} a={0.26} />
      <WordLine t={t} y={330} size={90} words={[['Снимаешь', 27.29], ['то,', 27.91], ['что', 28.08]]} />
      <Big t={t} at={28.46} text="ОТ ТЕБЯ" y={470} size={160} />
      <Big t={t} at={28.77} text="РЕАЛЬНО ЖДУТ" y={650} size={150} color={MINT} squeeze={0.86} />
      <Media t={t} fps={fps} at={27.5} x={LX} y={LOW - 30} w={300} h={375} src="gsc2/short-videos.png" fit="cover" tilt={-4} depth={0.6} />
      <Media t={t} fps={fps} at={27.7} x={LX + CW - 300} y={LOW - 30} w={300} h={375} src="gsc2/latest-posts.png" fit="cover" tilt={4} depth={0.6} />
      <div style={{position: 'absolute', left: CX - 190, top: 900, opacity: Math.min(1, f * 1.5), transform: `translateY(${(1 - f) * 140}px)`}}>
        <Drift t={t} depth={0.9} ph={1}>
          <Glass x={0} y={0} w={380} h={460} r={44}>
            <div style={{position: 'absolute', left: 26, top: 24, display: 'flex', alignItems: 'center', gap: 12, fontFamily: MONO, fontWeight: 700, fontSize: 42, color: C.ink}}>
              <span style={{width: 26, height: 26, borderRadius: '50%', background: ORANGE, opacity: rec ? 1 : 0.35, boxShadow: `0 0 16px ${ORANGE}`}} />REC
            </div>
            <div style={{position: 'absolute', left: 140, top: 170}}>
              <svg width={110} height={120} viewBox="0 0 100 110"><path d="M 12 6 L 94 55 L 12 104 Z" fill={MINT} style={{filter: `drop-shadow(0 0 20px ${rgba(MINT, 0.7)})`}} /></svg>
            </div>
          </Glass>
        </Drift>
      </div>
    </Graphite>
  );
};
// ——— «Работает во всех странах» — каркасный глобус; снизу официальный экран добавления ресурса ———
const SceneGlobe: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const cx = CX, cy = 830, R = 360, rot = t * 0.8;
  const pins = Array.from({length: 14}, (_, i) => ({lat: (random(`gl${i}`) - 0.5) * 2.4, lon: random(`gn${i}`) * Math.PI * 2, at: 29.9 + i * 0.08}));
  return (
    <Graphite>
      <Stars t={t} seed="gb" n={150} vy={-5} />
      <Glow x={cx} y={cy} w={1300} h={1300} color={MINT} a={0.14} />
      <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
        {[1.25, 1.5].map((f, i) => <ellipse key={f} cx={cx} cy={cy} rx={R * f} ry={R * f * 0.3} fill="none" stroke={ORANGE} strokeWidth={3} opacity={0.35 - i * 0.12} transform={`rotate(-18 ${cx} ${cy})`} />)}
        <circle cx={cx} cy={cy} r={R} fill="rgba(10,14,16,.85)" stroke={MINT} strokeWidth={4} />
        {Array.from({length: 8}, (_, i) => { const ph = rot + (i / 8) * Math.PI; return <ellipse key={`m${i}`} cx={cx} cy={cy} rx={Math.abs(Math.cos(ph)) * R} ry={R} fill="none" stroke={MINT} strokeWidth={2} opacity={0.35} />; })}
        {[-0.6, -0.3, 0, 0.3, 0.6].map((l) => <ellipse key={`p${l}`} cx={cx} cy={cy + Math.sin(l * 1.4) * R} rx={Math.cos(l * 1.4) * R} ry={Math.cos(l * 1.4) * R * 0.12} fill="none" stroke={MINT} strokeWidth={2} opacity={0.3} />)}
        {pins.map((p, i) => {
          const lon = p.lon + rot;
          if (Math.cos(p.lat) * Math.cos(lon) < 0) return null;
          const x = cx + Math.cos(p.lat) * Math.sin(lon) * R, y = cy - Math.sin(p.lat) * R * 0.92, a = k(t, p.at, p.at + 0.3);
          return <circle key={i} cx={x} cy={y} r={12 * a} fill={i % 3 ? MINT : ORANGE} style={{filter: `drop-shadow(0 0 12px ${i % 3 ? MINT : ORANGE})`}} />;
        })}
      </svg>
      <WordLine t={t} y={300} size={96} words={[['во', 30.33], ['всех', 30.43], ['странах', 30.74]]} />
      <Mono t={t} at={30.4} text="с 29.07.2026 для всех" y={1260} size={48} />
      <Media t={t} fps={fps} at={29.85} x={LX + 84} y={LOW} w={840} h={560} src="gsc2/search-console-platform-property.png" fit="cover" tilt={-1.5} />
    </Graphite>
  );
};
// ——— «Напиши «поиск», скину ссылку и промпт для Claude» — радар, комментарий → директ ———
const CTA_TILES: [string, number, number, number, number][] = [['sc', 360, 1800, 230, 31.5], ['claude', 648, 1720, 250, 31.7], ['instagram', 936, 1800, 230, 31.9]];
const SceneCta: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const cx = CX, cy = 1000, box = sp(t, 31.25, fps, 14, 140), typed = 'поиск'.slice(0, Math.round(5 * k(t, 31.62, 31.98, lin))), dm = sp(t, 32.1, fps, 13, 140);
  return (
    <Graphite>
      <Stars t={t} seed="rd" n={120} />
      <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
        {[220, 420, 620, 820, 1020].map((r) => <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke={rgba(MINT, 0.14)} strokeWidth={3} />)}
        <line x1={cx - 1100} x2={cx + 1100} y1={cy} y2={cy} stroke={rgba(MINT, 0.08)} strokeWidth={2} /><line x1={cx} x2={cx} y1={cy - 1100} y2={cy + 1100} stroke={rgba(MINT, 0.08)} strokeWidth={2} />
      </svg>
      <div style={{position: 'absolute', left: cx - 1100, top: cy - 1100, width: 2200, height: 2200, borderRadius: '50%', transform: `rotate(${t * 140}deg)`,
        background: `conic-gradient(from 0deg, ${rgba(MINT, 0.3)}, ${rgba(MINT, 0)} 40deg, transparent 360deg)`}} />
      <div style={{position: 'absolute', left: LX, top: 360, width: CW, height: 190, opacity: Math.min(1, box * 1.5), transform: `translateY(${(1 - box) * 80}px)`}}>
        <Slab x={0} y={0} w={CW} h={190} r={46} face="linear-gradient(180deg, #FFFFFF, #F2F3F0)" edge="#8E9591">
          <div style={{position: 'absolute', left: 40, top: 0, height: 190, display: 'flex', alignItems: 'center', gap: 26}}>
            <Logo name="instagram" size={70} />
            <span style={{fontFamily: SANS, fontWeight: 700, fontSize: 58, color: typed ? INK : '#9AA0A6'}}>{typed || 'Добавьте комментарий…'}</span>
          </div>
          <div style={{position: 'absolute', right: 40, top: 55, width: 80, height: 80, borderRadius: '50%', background: typed.length === 5 ? MINT : '#E3E6E4', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <svg width={40} height={40} viewBox="0 0 40 40"><path d="M 6 20 L 34 6 L 26 34 L 20 22 Z" fill={C.mintInk} /></svg>
          </div>
        </Slab>
      </div>
      {dm > 0 ? (
        <div style={{position: 'absolute', left: LX, top: 660, width: CW, opacity: Math.min(1, dm * 1.5), transform: `translateY(${(1 - dm) * 120}px)`}}>
          <Glass x={0} y={0} w={CW} h={440} r={46}>
            <div style={{position: 'absolute', left: 40, top: 36, fontFamily: MONO, fontWeight: 600, fontSize: 38, color: DIM}}>директ</div>
            <div style={{position: 'absolute', left: 40, top: 110, display: 'flex', alignItems: 'center', gap: 22, opacity: k(t, 32.28, 32.6)}}>
              <div style={{width: 96, height: 96, borderRadius: 26, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><Pic src={SC} size={68} /></div>
              <span style={{fontFamily: SANS, fontWeight: 700, fontSize: 52, color: C.ink}}>ссылка на Search Console</span>
            </div>
            <div style={{position: 'absolute', left: 40, top: 262, display: 'flex', alignItems: 'center', gap: 22, opacity: k(t, 33.11, 33.4)}}>
              <div style={{width: 96, height: 96, borderRadius: 26, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><Logo name="claude" size={62} /></div>
              <span style={{fontFamily: SANS, fontWeight: 700, fontSize: 52, color: C.ink}}>промпт для Claude</span>
            </div>
          </Glass>
        </div>
      ) : null}
      <Row y={1200}><Pill t={t} at={31.3} label="напиши «поиск» в комментариях" size={50} /></Row>
      {CTA_TILES.map(([name, x, y, sz, at], i) => {
        const a = sp(t, at, fps, 12, 150);
        if (a <= 0) return null;
        return (
          <Drift key={name} t={t} depth={0.6 + i * 0.2} ph={i * 1.9} style={{left: x - sz / 2, top: y - sz / 2}}>
            <div style={{width: sz, height: sz, borderRadius: sz * 0.28, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: Math.min(1, a * 1.5),
              transform: `scale(${0.5 + 0.5 * a})`, boxShadow: '0 30px 70px rgba(0,0,0,.55), inset 0 -5px 0 rgba(0,0,0,.08)'}}>
              {name === 'sc' ? <Pic src={SC} size={sz * 0.66} /> : <Logo name={name} size={sz * 0.6} />}
            </div>
          </Drift>
        );
      })}
    </Graphite>
  );
};

// ——— Раскладка по времени ———
type Tin = 'none' | 'brush' | 'blur' | 'whip' | 'zoom';
type Sc = {from: number; tin: Tin; render: (t: number, fps: number) => React.ReactNode};
const SCENES: Sc[] = [
  {from: 0, tin: 'none', render: (t, fps) => <SceneHook t={t} fps={fps} />},
  {from: 3.2, tin: 'brush', render: (t, fps) => <SceneSun t={t} fps={fps} />},
  {from: 7.08, tin: 'zoom', render: (t, fps) => <CanvasScene t={t} fps={fps} />},
  {from: 27.2, tin: 'blur', render: (t, fps) => <SceneShoot t={t} fps={fps} />},
  {from: 29.72, tin: 'zoom', render: (t, fps) => <SceneGlobe t={t} fps={fps} />},
  {from: 31.15, tin: 'whip', render: (t, fps) => <SceneCta t={t} fps={fps} />},
];
const ZIGZAG = 'M -260 300 L 1700 170 L -260 760 L 1700 630 L -260 1220 L 1700 1090 L -260 1680 L 1700 1550 L -260 2140 L 1700 2010 L -260 2600';
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
      layers.push(layer(two.prev, {transform: `scale(${1 + p * 0.7})`, transformOrigin: `${CX}px 880px`, opacity: 1 - p}, 'p'));
      layers.push(layer(two.nxt, {transform: `scale(${0.86 + 0.14 * p})`, transformOrigin: `${CX}px 880px`, opacity: p}, 'n'));
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

// Звуки: свежие нарезки пака под этот ролик (public/sfx/r26), ×0,37 (заметка sfx-quieter).
const SFX: [number, string, number][] = [
  [0.05, 'air', 0.16], [0.5, 'flash-b', 0.2], [1.1, 'shiver-b', 0.22], [1.6, 'type-b', 0.14], [1.84, 'ui-01', 0.18], [2.05, 'ui-02', 0.16], [2.33, 'ui-03', 0.16], [2.66, 'ui-04', 0.16],
  [2.95, 'swoosh-d', 0.28], [3.62, 'rubber-c', 0.2], [4.32, 'ui-05', 0.16], [5.7, 'morph-b', 0.22],
  [6.9, 'long-c', 0.22], [7.26, 'ui-01', 0.2], [8.05, 'ui-02', 0.2], [8.8, 'ui-03', 0.2], [9.03, 'ui-04', 0.2], [9.27, 'switch-c', 0.18], [9.5, 'ui-05', 0.2],
  [9.72, 'long-d', 0.18], [10.72, 'type-b', 0.16], [11.93, 'ui-01', 0.2], [13.1, 'swoosh-e', 0.2], [13.62, 'ui-05', 0.14], [14.12, 'switch-c', 0.2], [14.32, 'ui-02', 0.16], [14.57, 'ui-03', 0.16], [14.82, 'ui-04', 0.16],
  [15.52, 'long-c', 0.18], [16.32, 'ui-01', 0.14], [17.47, 'ui-05', 0.24], [19.92, 'ui-02', 0.14], [19.97, 'zoom-b', 0.26], [20.22, 'flash-b', 0.2],
  [21.42, 'long-d', 0.18], [21.72, 'ui-01', 0.2], [22.12, 'count-b', 0.18], [23.57, 'rubber-c', 0.2], [23.8, 'swoosh-d', 0.16], [24.7, 'type-b', 0.16], [25.32, 'ui-02', 0.18], [25.87, 'ui-03', 0.18],
  [27.02, 'blur-b', 0.26], [27.4, 'ui-04', 0.2], [28.48, 'morph-b', 0.2], [28.78, 'flash-b', 0.18],
  [29.52, 'zoom-b', 0.24], [29.95, 'ui-05', 0.16], [30.95, 'swoosh-e', 0.28], [31.3, 'ui-01', 0.2], [31.64, 'type-b', 0.2], [32.0, 'switch-c', 0.22], [32.3, 'ui-02', 0.2], [33.13, 'ui-03', 0.2],
];
const SFX_GAIN = 0.37;

export const Reel26: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  return (
    <FormatProvider value={FORMATS.reels}>
      <AbsoluteFill style={{background: '#040506'}}>
        <Scenes t={t} fps={fps} />
        <Captions t={t} words={WORDS26} cx={CX} cy={1467} maxW={880} size={53.3} frameW={W} frameH={H} light={false} family={SANS} weight={700} />
        <Audio src={staticFile('gsc2/voice.wav')} />
        {SFX.map(([at, name, v], i) => (
          <Sequence key={i} from={Math.round(at * fps)} durationInFrames={Math.round(2.5 * fps)} layout="none">
            <Audio src={staticFile(`sfx/r26/${name}.wav`)} volume={v * SFX_GAIN} />
          </Sequence>
        ))}
      </AbsoluteFill>
    </FormatProvider>
  );
};
