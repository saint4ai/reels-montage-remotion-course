import React, {useMemo} from 'react';
import {AbsoluteFill, interpolate, interpolateColors, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio, Video} from '@remotion/media';
import {buildLines, capsuleAt} from '../../montage/Captions';
import {E, k} from '../../montage/parts';
import {useFontsReady} from '../../kit/liquid/useAssetReady';
import {fontSpec, layoutLine} from '../../kit/liquid/words';
import {WORDS28} from './words';

// Ролик 28 «Тренд у заправки», версия 2 в стиле Apple (правка Александра 25.09.2026 после черновика 1: оранжевые
// буквы и референс на весь экран отклонены). Формат рефа: эксперт говорит → туториал → снова эксперт.
// Спикер (запись IMG_7904) в карточке, обрезан сверху и снизу; чужой тренд, а в конце его результат — вставкой 30%
// ширины слева; туториал в корпусе на 72% высоты, перемонтирован по опорным словам речи (tutorial-sync.mp4).
// Белый холст, плывущие мятные волны и облака; мятная клякса между блоками, перетекание карточки в карточку,
// пружина с перелётом, слова печатаются серым → чёрным, по ним скользит выделение как в iOS.
export const FPS28 = 60;
export const END28 = 66.35;

const W = 1440, H = 2560;
const DISP = 'SF Pro Display', SANS = 'SF Pro Text';
const MINT = '#3DEDC3', MINT_D = '#12B48C', INK = '#1D1D1F', GRAY = '#7C7C82';
const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
const lerp = (a: number, b: number, m: number) => a + (b - a) * m;
const sp = (t: number, at: number, fps: number, damping = 11, stiffness = 170) =>
  t < at ? 0 : spring({frame: (t - at) * fps, fps, config: {damping, stiffness, mass: 1}});

// Кадр записи 1080×1920: над головой пустая стена, внизу стол — показываем полосу 22…94% высоты.
const SPK = {src: 'r28/speaker.mp4', pos: '50% 79%'};

// Стыки по речи: T1 — клякса после «…за несколько минут», T2 — перетекание после «…и готово», CTA — «Пиши».
const T1 = 9.35, T2 = 51.6, CTA = 60.95, TUT0 = 8.9;

type Rect = {x: number; y: number; w: number; h: number; r: number};
const CARD: Rect = {x: 280, y: 600, w: 1080, h: 1380, r: 76};
const INS: Rect = {x: 70, y: 1170, w: 432, h: 768, r: 46};
// Корпус туториала по центру, на 10% крупнее первой раскладки (правка Александра 26.09.2026): 1144×2035, 79% высоты.
const DEV: Rect = {x: 148, y: 200, w: 1144, h: 2035, r: 90};
const mixRect = (a: Rect, b: Rect, m: number): Rect => ({x: lerp(a.x, b.x, m), y: lerp(a.y, b.y, m), w: lerp(a.w, b.w, m), h: lerp(a.h, b.h, m), r: lerp(a.r, b.r, m)});

// ——— Фон: холст, шёлковые ленты-волны и облака; у каждого смыслового блока своё настроение ———
type Rib = {y: number; slope: number; A: number; L: number; w: number; ph: number; th: number; c: string; a: number};
const MOODS: {bg: string; ribs: Rib[]; clouds: number; cloudA: number}[] = [
  {bg: 'linear-gradient(180deg, #FFFFFF 0%, #F4FBF8 45%, #D8F5EB 100%)', clouds: 4, cloudA: 0.9, ribs: [
    {y: 250, slope: 0.1, A: 60, L: 1900, w: 0.35, ph: 0.8, th: 150, c: MINT, a: 0.2},
    {y: 2060, slope: -0.08, A: 90, L: 1700, w: 0.5, ph: 0, th: 260, c: MINT, a: 0.34},
    {y: 2220, slope: 0.06, A: 120, L: 2100, w: -0.4, ph: 1.7, th: 330, c: MINT, a: 0.44},
    {y: 2400, slope: -0.04, A: 80, L: 1500, w: 0.6, ph: 3.1, th: 300, c: MINT_D, a: 0.36},
  ]},
  {bg: 'linear-gradient(170deg, #F6F8F7 0%, #E7EFEC 60%, #DCEAE5 100%)', clouds: 6, cloudA: 1, ribs: [
    {y: 420, slope: 0.4, A: 70, L: 1500, w: -0.5, ph: 5.2, th: 170, c: '#FFFFFF', a: 0.95},
    {y: 900, slope: 0.35, A: 110, L: 1800, w: 0.45, ph: 0.3, th: 300, c: MINT, a: 0.3},
    {y: 1500, slope: 0.3, A: 140, L: 2200, w: -0.35, ph: 2.1, th: 380, c: MINT, a: 0.28},
    {y: 2150, slope: 0.25, A: 90, L: 1600, w: 0.55, ph: 4.0, th: 260, c: MINT_D, a: 0.3},
  ]},
  {bg: 'radial-gradient(120% 80% at 30% 18%, #FFFFFF 0%, #F0FBF7 50%, #CDF2E4 100%)', clouds: 3, cloudA: 0.9, ribs: [
    {y: 430, slope: -0.15, A: 150, L: 2000, w: 0.4, ph: 1, th: 300, c: MINT, a: 0.34},
    {y: 1300, slope: 0.22, A: 60, L: 1400, w: 0.3, ph: 0.2, th: 16, c: INK, a: 0.14},
    {y: 2100, slope: -0.2, A: 170, L: 2300, w: -0.45, ph: 2.5, th: 420, c: MINT, a: 0.44},
    {y: 2380, slope: 0.1, A: 100, L: 1700, w: 0.5, ph: 4.4, th: 260, c: MINT_D, a: 0.34},
  ]},
];

const ribbon = (r: Rib, t: number) => {
  const N = 56, top: string[] = [], bot: string[] = [];
  for (let i = 0; i <= N; i++) {
    const x = -120 + ((W + 240) * i) / N;
    const yc = r.y + r.slope * (x - W / 2) + r.A * Math.sin((2 * Math.PI * x) / r.L + r.w * t + r.ph)
      + r.A * 0.35 * Math.sin((2 * Math.PI * x) / (r.L * 0.55) - r.w * 1.3 * t + r.ph * 2);
    const th = r.th * (0.6 + 0.4 * Math.sin((2 * Math.PI * x) / (r.L * 1.3) + r.w * 0.7 * t + r.ph));
    top.push(`${x.toFixed(1)},${(yc - th / 2).toFixed(1)}`);
    bot.push(`${x.toFixed(1)},${(yc + th / 2).toFixed(1)}`);
  }
  const edge = `M${top.join(' L')}`;
  return {edge, fill: `${edge} L${bot.reverse().join(' L')} Z`};
};

const Waves: React.FC<{t: number; mood: number; opacity?: number}> = ({t, mood, opacity = 1}) => {
  const m = MOODS[mood];
  return (
    <AbsoluteFill style={{background: m.bg, overflow: 'hidden', opacity}}>
      {Array.from({length: m.clouds}, (_, i) => {
        const cw = 560 + ((i * 173) % 380), ch = cw * 0.38, v = 9 + ((i * 7) % 11);
        const x = ((((i * 397) % 1700) + t * v) % (W + cw + 200)) - cw - 100;
        const y = 180 + ((i * 541) % 2100) + Math.sin(t * 0.3 + i) * 20;
        return (
          <div key={i} style={{position: 'absolute', left: x, top: y, width: cw, height: ch}}>
            <div style={{position: 'absolute', left: 0, top: ch * 0.18, width: cw, height: ch, borderRadius: '50%',
              background: `radial-gradient(closest-side, rgba(120,170,158,${0.16 * m.cloudA}), rgba(120,170,158,0))`}} />
            <div style={{position: 'absolute', inset: 0, borderRadius: '50%', background: `radial-gradient(closest-side, rgba(255,255,255,${m.cloudA}), rgba(255,255,255,0))`}} />
            <div style={{position: 'absolute', left: cw * 0.22, top: -ch * 0.25, width: cw * 0.5, height: ch * 0.9, borderRadius: '50%',
              background: `radial-gradient(closest-side, rgba(255,255,255,${m.cloudA}), rgba(255,255,255,0))`}} />
          </div>
        );
      })}
      <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
        <defs>
          {m.ribs.map((r, i) => (
            <linearGradient key={i} id={`rg${mood}-${i}`} x1="0" y1="0" x2="1" y2="0.3">
              <stop offset="0" stopColor={r.c} stopOpacity={r.a * 0.25} />
              <stop offset="0.5" stopColor={r.c} stopOpacity={r.a} />
              <stop offset="1" stopColor={r.c} stopOpacity={r.a * 0.3} />
            </linearGradient>
          ))}
        </defs>
        {m.ribs.map((r, i) => {
          const p = ribbon(r, t);
          return (
            <g key={i}>
              <path d={p.fill} fill={`url(#rg${mood}-${i})`} />
              {r.th > 40 ? <path d={p.edge} fill="none" stroke="#FFFFFF" strokeOpacity={0.85} strokeWidth={3} /> : null}
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

// ——— Мятная клякса: волна поднимается снизу, закрывает кадр и уходит вверх ———
const Liquid: React.FC<{t: number; at: number}> = ({t, at}) => {
  const a = at - 0.55, b = at + 0.55;
  if (t < a || t > b) return null;
  const p = interpolate(t, [a, b], [0, 1], {easing: E.inOut, extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const layer = (lag: number, fillA: string, fillB: string, id: string) => {
    const q = Math.min(1, Math.max(0, p - lag) / (1 - lag));
    const top = q < 0.5 ? lerp(H + 80, -300, q / 0.5) : -300;
    const bottom = q < 0.5 ? H + 500 : lerp(H + 500, -260, (q - 0.5) / 0.5);
    const edge = (y0: number, sgn: number) => {
      const pts: string[] = [];
      for (let i = 0; i <= 40; i++) {
        const x = -60 + ((W + 120) * i) / 40;
        pts.push(`${x.toFixed(1)},${(y0 + sgn * (70 * Math.sin((x / W) * Math.PI * 2 + t * 5) + 50 * Math.sin((x / W) * Math.PI * 3.3 - t * 3.4))).toFixed(1)}`);
      }
      return pts;
    };
    const tp = edge(top, 1), bp = edge(bottom, -1).reverse();
    return (
      <g key={id}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={fillA} /><stop offset="1" stopColor={fillB} />
          </linearGradient>
        </defs>
        <path d={`M${tp.join(' L')} L${bp.join(' L')} Z`} fill={`url(#${id})`} />
        <path d={`M${tp.join(' L')}`} fill="none" stroke="#FFFFFF" strokeOpacity={0.9} strokeWidth={5} />
      </g>
    );
  };
  return (
    <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
      {layer(0, '#BFF8E8', '#E9FDF7', 'lq0')}
      {layer(0.07, MINT, '#9FF3DC', 'lq1')}
    </svg>
  );
};

// ——— Карточки ———
const Squircle: React.FC<{rc: Rect; rim?: number; rimColor?: string; glow?: number; style?: React.CSSProperties; children: React.ReactNode}> =
  ({rc, rim = 10, rimColor = '#FFFFFF', glow = 0, style, children}) => (
    <div style={{position: 'absolute', left: rc.x, top: rc.y, width: rc.w, height: rc.h, ...style}}>
      {glow > 0 ? <div style={{position: 'absolute', inset: -170, borderRadius: '50%', background: `radial-gradient(closest-side, ${rgba(MINT, 0.42 * glow)}, ${rgba(MINT, 0)})`}} /> : null}
      <div style={{position: 'absolute', inset: 0, borderRadius: rc.r, background: rimColor,
        boxShadow: '0 40px 90px rgba(20,48,40,.22), 0 10px 24px rgba(20,48,40,.12), inset 0 1px 0 rgba(255,255,255,.9)'}} />
      <div style={{position: 'absolute', inset: rim, borderRadius: Math.max(8, rc.r - rim), overflow: 'hidden', background: '#0E1011'}}>{children}</div>
    </div>
  );

const Pill: React.FC<{text: string; size?: number; dark?: boolean; num?: number; style?: React.CSSProperties}> = ({text, size = 44, dark = true, num, style}) => (
  <div style={{display: 'inline-flex', alignItems: 'center', gap: 18, padding: num !== undefined ? `14px ${size * 0.75}px 14px 14px` : `${size * 0.36}px ${size * 0.75}px`, borderRadius: 999,
    background: dark ? INK : 'rgba(255,255,255,.66)', backdropFilter: dark ? undefined : 'blur(24px) saturate(1.6)',
    boxShadow: dark ? '0 18px 40px rgba(20,48,40,.28), 0 4px 10px rgba(20,48,40,.18), inset 0 1px 0 rgba(255,255,255,.18)'
      : '0 16px 36px rgba(20,48,40,.16), 0 3px 8px rgba(20,48,40,.10), inset 0 1px 0 rgba(255,255,255,.95), inset 0 0 0 1.5px rgba(255,255,255,.7)',
    whiteSpace: 'nowrap', ...style}}>
    {num !== undefined ? <span style={{width: size * 1.45, height: size * 1.45, borderRadius: '50%', background: MINT, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: DISP, fontWeight: 800, fontSize: size * 0.8, color: '#05231D', boxShadow: `0 0 24px ${rgba(MINT, 0.5)}`}}>{num}</span> : null}
    <span style={{fontFamily: SANS, fontWeight: 700, fontSize: size, lineHeight: 1.15, color: dark ? '#FFFFFF' : INK}}>{text}</span>
  </div>
);

// Вставка 30% ширины у левого края: пружина слева, лёгкий наклон и покачивание.
// Звук вставок на 50% от исходного (правка Александра 26.09.2026), вход 0,25 с, выход вместе с уездом вставки или концом ролика.
const Insert: React.FC<{t: number; fps: number; at: number; out?: number; src: string; trim: number; label: string}> = ({t, fps, at, out, src, trim, label}) => {
  const a = sp(t, at, fps, 12, 150), o = out ? k(t, out, out + 0.4, E.inOut) : 0;
  if (a <= 0 || o >= 1) return null;
  const x = (1 - a) * -560 - o * 620, rot = -3 + Math.sin(t * 0.8) * 0.8 + (1 - a) * -6;
  const la = sp(t, at + 0.25, fps, 10, 190);
  return (
    <div style={{position: 'absolute', left: INS.x, top: INS.y, width: INS.w, height: INS.h, transform: `translate(${x}px, ${Math.sin(t * 0.9) * 8}px) rotate(${rot}deg)`, opacity: 1 - o}}>
      <Squircle rc={{...INS, x: 0, y: 0}} rim={9}>
        <Sequence from={Math.round(at * fps)} layout="none">
          <Video src={staticFile(`r28/${src}`)} trimBefore={Math.round(trim * fps)} objectFit="cover" style={{width: '100%', height: '100%'}}
            volume={(f) => { const tt = at + f / fps; return 0.5 * k(tt, at, at + 0.25) * (1 - k(tt, out ?? END28 - 0.5, (out ?? END28 - 0.5) + 0.4)); }} />
        </Sequence>
      </Squircle>
      <div style={{position: 'absolute', left: 18, top: -40, transform: `scale(${la})`, transformOrigin: 'left center'}}><Pill text={label} size={44} /></div>
    </div>
  );
};

// ——— Субтитры Apple: белое стекло, слова печатаются серым → чёрным, по словам скользит выделение как в iOS ———
const CAP = 54, CAPW = 700;
const AppleCaptions: React.FC<{t: number; cx: number; cy: number; maxW: number; vis: number}> = ({t, cx, cy, maxW, vis}) => {
  const ready = useFontsReady([fontSpec(CAPW, CAP, DISP)]);
  const lines = useMemo(() => (ready ? buildLines(WORDS28, maxW, CAP, DISP, CAPW) : []), [ready, maxW]);
  if (!lines.length || vis <= 0) return null;
  const li = lines.findIndex((l) => t >= l.from && t < l.to);
  if (li < 0) return null;
  const line = lines[li], PADX = 50, PADY = 22;
  const {w, textIn, prev} = capsuleAt(lines, li, t, PADX);
  const h = CAP * 1.22 + PADY * 2;
  const appear = prev ? 1 : k(t, line.from, line.from + 0.22, E.out);
  const contNext = !!lines[li + 1] && Math.abs(lines[li + 1].from - line.to) < 0.02;
  const fadeOut = contNext ? 1 : 1 - k(t, line.to - 0.16, line.to);
  const pop = 0.9 + 0.1 * sp(t, line.from, 60, 10, 200);
  const boxes = layoutLine(line.ids.map((i) => WORDS28[i].text), {family: DISP, weight: CAPW, size: CAP, x: cx, y: cy - (CAP * 1.22) / 2, align: 'center', lineHeight: 1.22});
  let j = -1;
  line.ids.forEach((id, i) => { if (t >= WORDS28[id].start - 0.03) j = i; });
  let sel: {x: number; w: number; y: number; h: number; on: number} | null = null;
  if (j >= 0) {
    const bj = boxes[j], bp = j > 0 ? boxes[j - 1] : bj, st = WORDS28[line.ids[j]].start;
    const s = k(t, st - 0.03, st + 0.1, E.inOut);
    sel = {x: lerp(bp.x, bj.x, s) - 8, w: lerp(bp.w, bj.w, s) + 16, y: bj.y + bj.h * 0.06, h: bj.h * 0.9, on: j > 0 ? 1 : s};
  }
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, pointerEvents: 'none', opacity: vis * appear * fadeOut,
      transformOrigin: `${cx}px ${cy}px`, transform: `scale(${pop})`}}>
      <div style={{position: 'absolute', left: cx - w / 2, top: cy - h / 2, width: w, height: h, borderRadius: h / 2, background: 'rgba(255,255,255,.64)',
        backdropFilter: 'blur(26px) saturate(1.7)', WebkitBackdropFilter: 'blur(26px) saturate(1.7)',
        boxShadow: '0 18px 44px rgba(20,48,40,.18), 0 4px 10px rgba(20,48,40,.10), inset 0 1px 0 rgba(255,255,255,.95), inset 0 0 0 1.5px rgba(255,255,255,.75)'}} />
      {sel ? (
        <div style={{position: 'absolute', left: sel.x, top: sel.y, width: sel.w, height: sel.h, transform: `scaleX(${sel.on})`, transformOrigin: 'left center', opacity: textIn}}>
          <div style={{position: 'absolute', inset: 0, borderRadius: 8, background: rgba(MINT, 0.45)}} />
          <div style={{position: 'absolute', left: -2, top: 0, width: 4, height: '100%', borderRadius: 2, background: MINT_D}} />
          <div style={{position: 'absolute', left: -9, top: -14, width: 18, height: 18, borderRadius: '50%', background: MINT_D}} />
          <div style={{position: 'absolute', right: -2, top: 0, width: 4, height: '100%', borderRadius: 2, background: MINT_D}} />
          <div style={{position: 'absolute', right: -9, bottom: -14, width: 18, height: 18, borderRadius: '50%', background: MINT_D}} />
        </div>
      ) : null}
      {boxes.map((b, i) => {
        const wd = WORDS28[line.ids[i]];
        const c = interpolateColors(t, [wd.start - 0.05, wd.start + 0.05], [GRAY, INK]);
        return (
          <span key={line.ids[i]} style={{position: 'absolute', left: b.x, top: b.y, height: b.h, lineHeight: `${b.h}px`, whiteSpace: 'nowrap', fontFamily: DISP, fontWeight: CAPW,
            fontSize: CAP, color: c, opacity: textIn, filter: textIn < 1 ? `blur(${(1 - textIn) * 6}px)` : undefined, transform: `translateY(${(1 - textIn) * 8}px)`,
            textShadow: '0 1px 0 rgba(255,255,255,.9), 0 6px 14px rgba(20,48,40,.12)'}}>{b.text}</span>
        );
      })}
    </div>
  );
};

// Шаги туториала по опорным словам речи.
const STEPS: [number, number, string][] = [
  [9.9, 16.35, 'шаблон «Тренд у заправки»'], [16.42, 20.4, 'промпт из канала'], [20.46, 29.3, 'AI Картинка → карточка'], [29.38, 32.15, 'скачиваем три карточки'],
  [32.2, 37.9, 'шаблон → 3 карточки → создать'], [37.98, 40.15, 'скачиваем видео'], [40.19, 49.4, 'CapCut: звук + наложение'], [49.45, 51.25, 'экспорт'],
];
// Звуки: свежие нарезки пака (public/sfx/r28), громкость ×0,37 от исходной.
const SFX: [number, string, number][] = [
  [0.45, 'bounce', 0.4], [T1 - 0.6, 'wave', 0.4], [T1 - 0.1, 'blur', 0.25],
  ...STEPS.map(([a], i): [number, string, number] => [a, `ui-${(i % 6) + 1}`, 0.3]),
  [T2 - 0.35, 'morph', 0.35], [T2 + 0.3, 'bounce', 0.4], [CTA, 'flash', 0.3], [CTA + 0.3, 'ui-3', 0.3],
];

export const Reel28: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;

  // Перетекание корпуса туториала в карточку спикера.
  const mm = k(t, T2 - 0.35, T2 + 0.35, E.inOut);
  const morphing = t >= T2 - 0.35 && t <= T2 + 0.35;
  // Спикер в начале: вход пружиной, перед кляксой уменьшается и размывается.
  const enter = 0.88 + Math.min(1, sp(t, 0, fps, 12, 170)) * 0.12;
  const leave = k(t, T1 - 0.5, T1 - 0.05, E.inOut);
  const devIn = sp(t, T1 - 0.05, fps, 13, 140);
  const float = Math.sin(t * 0.7) * 6;

  const showSpk = t < T1 || t >= T2 - 0.35;
  const spkRect = morphing ? mixRect(DEV, CARD, mm) : CARD;
  const spkScale = t < T1 ? enter * (1 - 0.1 * leave) : 1;
  const spkBlur = t < T1 ? leave * 12 : morphing ? (1 - mm) * 14 : 0;
  const spkOp = t < T1 ? 1 - leave * 0.3 : morphing ? mm : 1;
  const showDev = t >= T1 - 0.05 && t <= T2 + 0.35;
  const devRect = morphing ? mixRect(DEV, CARD, mm) : DEV;
  const tutOp = morphing ? 1 - k(t, T2 - 0.35, T2 + 0.2, E.inOut) : 1;

  // Субтитры весь ролик на одной высоте над карточкой: в туториале так закрыта шапка бота, а не кнопки и картинки.
  const capPos = {cx: 720, cy: 470, maxW: 1150};
  const capVis = t >= CTA ? 0 : t < T1 ? 1 - k(t, T1 - 0.5, T1 - 0.3)
    : t < T2 ? k(t, T1 + 0.35, T1 + 0.55) * (1 - k(t, T2 - 0.25, T2 - 0.1)) : k(t, T2 + 0.1, T2 + 0.3);
  const cta = sp(t, CTA, fps, 10, 170), cta2 = sp(t, CTA + 0.3, fps, 10, 170);

  return (
    <AbsoluteFill style={{background: '#FFFFFF'}}>
      {t < T1 ? <Waves t={t} mood={0} /> : t < T2 - 0.35 ? <Waves t={t} mood={1} /> : (
        <>
          <Waves t={t} mood={2} />
          {t < T2 + 0.35 ? <Waves t={t} mood={1} opacity={1 - mm} /> : null}
        </>
      )}

      {/* Эксперт: карточка обрезана сверху и снизу, за ней мягкое мятное свечение */}
      {showSpk ? (
        <Squircle rc={spkRect} glow={1} style={{opacity: spkOp, filter: spkBlur > 0.2 ? `blur(${spkBlur}px)` : undefined,
          transform: `translateY(${float}px) scale(${spkScale})`, transformOrigin: 'center center'}}>
          <Video src={staticFile(SPK.src)} volume={0} objectFit="cover" style={{width: '100%', height: '100%', objectPosition: SPK.pos}} />
        </Squircle>
      ) : null}

      {/* Туториал в корпусе на 72% высоты */}
      {showDev ? (
        <Squircle rc={devRect} rim={20} rimColor={morphing ? interpolateColors(mm, [0, 1], [INK, '#FFFFFF']) : INK} glow={0.8}
          style={{opacity: morphing ? Math.max(tutOp, 0.001) : 1, transform: `translateY(${float + (1 - devIn) * 120}px) scale(${0.94 + 0.06 * devIn})`, transformOrigin: 'center center',
            filter: morphing && mm > 0.02 ? `blur(${mm * 14}px)` : undefined}}>
          <Sequence from={Math.round(TUT0 * fps)} layout="none">
            <Video src={staticFile('r28/tutorial-sync.mp4')} volume={0} objectFit="cover" style={{width: '100%', height: '100%'}} />
          </Sequence>
        </Squircle>
      ) : null}

      {/* Вставки слева: чужой тренд, пока эксперт рассказывает; в конце результат Александра */}
      <Insert t={t} fps={fps} at={0.45} out={T1 - 0.75} src="IMG_7225.mp4" trim={0} label="тренд у заправки" />
      <Insert t={t} fps={fps} at={T2 + 0.3} src="IMG_7903.mp4" trim={5.5} label="мой результат" />

      {STEPS.map(([a, b, label], i) => {
        const s = sp(t, a, fps, 10, 190), o = 1 - k(t, b - 0.18, b);
        if (s <= 0 || o <= 0) return null;
        return (
          <div key={label} style={{position: 'absolute', left: 188, top: 176, opacity: Math.min(1, s * 1.6) * o,
            transform: `translateY(${(1 - s) * -40}px) scale(${(0.8 + 0.2 * s) * (0.9 + 0.1 * o)})`, transformOrigin: 'left center'}}>
            <Pill text={label} num={i + 1} size={44} />
          </div>
        );
      })}

      <AppleCaptions t={t} vis={Math.max(0, Math.min(1, capVis))} {...capPos} />

      {/* Призыв: чёрная пилюля, слово «тренд» выделено как в iOS; ниже скидка */}
      {cta > 0 ? (
        <div style={{position: 'absolute', left: 0, width: W, top: 400, display: 'flex', justifyContent: 'center', opacity: Math.min(1, cta * 1.6),
          transform: `translateY(${(1 - cta) * -50}px) scale(${0.85 + 0.15 * cta})`}}>
          <div style={{display: 'inline-flex', alignItems: 'center', gap: 16, padding: '26px 52px', borderRadius: 999, background: INK,
            boxShadow: '0 24px 60px rgba(20,48,40,.3), 0 6px 14px rgba(20,48,40,.2), inset 0 1px 0 rgba(255,255,255,.2)', whiteSpace: 'nowrap',
            fontFamily: DISP, fontWeight: 700, fontSize: 60, color: '#FFFFFF'}}>
            Пиши
            <span style={{position: 'relative', padding: '0 10px'}}>
              <span style={{position: 'absolute', inset: '6px 0', borderRadius: 8, background: rgba(MINT, 0.55), transform: `scaleX(${k(t, CTA + 0.35, CTA + 0.6, E.inOut)})`, transformOrigin: 'left center'}} />
              <span style={{position: 'relative'}}>«тренд»</span>
            </span>
            в комментариях
          </div>
        </div>
      ) : null}
      {cta2 > 0 ? (
        <div style={{position: 'absolute', left: 0, width: W, top: 560, display: 'flex', justifyContent: 'center', opacity: Math.min(1, cta2 * 1.6),
          transform: `translateY(${(1 - cta2) * -30}px) scale(${0.85 + 0.15 * cta2})`}}>
          <Pill text="ссылка на бота со скидкой 20%" dark={false} size={46} />
        </div>
      ) : null}

      <Liquid t={t} at={T1} />

      <Audio src={staticFile('r28/voice.wav')} />
      {SFX.map(([at, name, v], i) => (
        <Sequence key={i} from={Math.round(at * fps)} durationInFrames={Math.round(2 * fps)} layout="none">
          <Audio src={staticFile(`sfx/r28/${name}.wav`)} volume={v * 0.37} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
