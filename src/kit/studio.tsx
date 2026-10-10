import React from 'react';
import {Easing, Img, interpolate, Sequence, spring, staticFile, useVideoConfig} from 'remotion';
import {Video} from '@remotion/media';
import {useFit} from '../ds';
import {useFontsReady} from './liquid/useAssetReady';
import {fontSpec, textWidth} from './liquid/words';

// Формат «Студия» (Screen Studio), ролик 35 v2, 30.09.2026: всё в кадре — окна на живых обоях. Окно macOS со
// скруглением и большой тенью, внутри камера плавно наезжает на нужное место исходника (ключи кадрирования),
// курсор ведётся дугой, клик — мятное кольцо. Вход окна — пружина с размытием по оси движения.
export const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const EZ = {out: Easing.bezier(0.16, 1, 0.3, 1), io: Easing.bezier(0.65, 0, 0.35, 1), pop: Easing.bezier(0.34, 1.56, 0.64, 1)};
export const ez = (t: number, a: number, b: number, e = EZ.out) => interpolate(t, [a, b], [0, 1], {...CL, easing: e});
export const sp = (t: number, at: number, fps: number, damping = 16, stiffness = 150) =>
  t < at ? 0 : spring({frame: (t - at) * fps, fps, config: {damping, stiffness, mass: 1}});
export const SF = 'SF Pro Display', SFT = 'SF Pro Text', MONO = 'JBM', BIG = 'Coolvetica', NUM = 'Soyuz Grotesk';
export const INK = '#111214', WHITE = '#F4F5F6', MINT = '#3DEDC3', MINT_INK = '#05231D', ORANGE = '#FF7A2F';
export const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

// Настоящий знак сервиса, перекрашенный маской (у файлов в public/brand нет своего цвета).
export const Mark: React.FC<{name: string; size: number; color?: string; style?: React.CSSProperties}> = ({name, size, color = INK, style}) => {
  const url = `url(${staticFile(`brand/${name}.svg`)})`;
  return <div style={{width: size, height: size, flex: 'none', background: color, WebkitMaskImage: url, maskImage: url, WebkitMaskSize: 'contain', maskSize: 'contain',
    WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskPosition: 'center', ...style}} />;
};
export const BRAND: Record<string, string> = {claude: '#D97757', openai: '#111214', github: '#111214', googlecalendar: '#1A73E8', instagram: '#111214'};

// Плитка-значок приложения: белая, скругление 26%, знак по центру.
export const Tile: React.FC<{name: string; size: number; dark?: boolean; glow?: string; style?: React.CSSProperties}> = ({name, size, dark, glow, style}) => (
  <div style={{width: size, height: size, borderRadius: size * 0.26, background: dark ? 'linear-gradient(160deg, #2A2D31, #111214)' : 'linear-gradient(160deg, #FFFFFF, #ECEEF0)',
    display: 'grid', placeItems: 'center', flex: 'none',
    boxShadow: `inset 0 2px 0 rgba(255,255,255,${dark ? 0.16 : 1}), inset 0 -4px 10px rgba(0,0,0,.12), 0 16px 40px rgba(0,0,0,.35)${glow ? `, 0 0 ${size * 0.5}px ${glow}` : ''}`, ...style}}>
    <Mark name={name} size={size * 0.56} color={dark ? '#FFFFFF' : BRAND[name] ?? INK} />
  </div>
);

// Капсула по ширине текста; x — центр. Поля ≥ 0,7 кегля, проверка [fit] через useFit.
type ChipTone = 'white' | 'black' | 'mint' | 'glass' | 'orange';
const CHIP: Record<ChipTone, {bg: string; ink: string; sh: string}> = {
  white: {bg: 'linear-gradient(180deg, #FFFFFF, #EEF0F1)', ink: INK, sh: '0 14px 34px rgba(0,0,0,.28), inset 0 -3px 0 rgba(0,0,0,.06)'},
  black: {bg: 'linear-gradient(180deg, #25282C, #111214)', ink: '#FFFFFF', sh: '0 14px 34px rgba(0,0,0,.35), inset 0 2px 0 rgba(255,255,255,.14)'},
  mint: {bg: 'linear-gradient(180deg, #62F4D1, #3DEDC3)', ink: MINT_INK, sh: `0 0 44px ${rgba(MINT, 0.45)}, 0 14px 30px rgba(0,0,0,.3), inset 0 3px 0 rgba(255,255,255,.5)`},
  glass: {bg: 'rgba(22,24,28,.62)', ink: '#FFFFFF', sh: 'inset 0 1.5px 0 rgba(255,255,255,.22), inset 0 0 0 1.5px rgba(255,255,255,.1), 0 18px 40px rgba(0,0,0,.4)'},
  orange: {bg: 'linear-gradient(180deg, #FF914F, #FF7A2F)', ink: INK, sh: `0 0 40px ${rgba(ORANGE, 0.4)}, 0 14px 30px rgba(0,0,0,.3), inset 0 3px 0 rgba(255,255,255,.4)`},
};
export const Chip: React.FC<{name: string; x: number; y: number; p: number; label: React.ReactNode; size?: number; tone?: ChipTone; icon?: React.ReactNode;
  family?: string; weight?: number; o?: number; style?: React.CSSProperties}> = ({name, x, y, p, label, size = 59, tone = 'white', icon, family = SF, weight = 600, o = 1, style}) => {
  const ref = useFit(`chip:${name}`);
  if (p <= 0.001 || o <= 0) return null;
  const c = CHIP[tone];
  return (
    <div style={{position: 'absolute', left: x, top: y, transform: `translate(-50%, 0) scale(${0.6 + 0.4 * Math.min(1, p)})`, opacity: Math.min(1, p * 2) * o, transformOrigin: '50% 50%', ...style}}>
      <div ref={ref as never} style={{display: 'inline-flex', alignItems: 'center', gap: size * 0.34, height: size * 1.9, padding: `0 ${size * 0.72}px`, borderRadius: 999,
        background: c.bg, boxShadow: c.sh, backdropFilter: tone === 'glass' ? 'blur(18px)' : undefined, overflow: 'hidden', whiteSpace: 'nowrap',
        fontFamily: family, fontWeight: weight, fontSize: size, lineHeight: 1, color: c.ink, letterSpacing: '-0.01em'}}>
        {icon}{label}
      </div>
    </div>
  );
};

// Строка, вписанная по ширине: кегль подбирается так, чтобы текст занял ровно w (не больше max).
export const FitLine: React.FC<{text: string; x: number; y: number; w: number; max: number; family?: string; weight?: number; color?: string; track?: number;
  style?: React.CSSProperties; align?: 'center' | 'left'}> = ({text, x, y, w, max, family = BIG, weight = 400, color = INK, track = -0.02, style, align = 'center'}) => {
  const ready = useFontsReady([fontSpec(weight, 100, family)]);
  if (!ready) return null;
  const size = Math.min(max, (w / textWidth(text, fontSpec(weight, 100, family), 100, track)) * 100);
  return (
    <div style={{position: 'absolute', left: align === 'center' ? x - w / 2 : x, top: y, width: w, textAlign: align, fontFamily: family, fontWeight: weight, fontSize: size,
      lineHeight: 1, letterSpacing: `${track}em`, color, whiteSpace: 'nowrap', ...style}}>{text}</div>
  );
};

// ——— Окно macOS ———
export type WinProps = {t: number; fps: number; at: number; out?: number; x: number; y: number; w: number; h: number; title?: string; icon?: string;
  iconColor?: string; dark?: boolean; from?: 'down' | 'up' | 'left' | 'right' | 'pop'; bar?: number; body?: string; zoom?: number; z?: number;
  style?: React.CSSProperties; children?: React.ReactNode};
const winPose = (t: number, fps: number, at: number, from: WinProps['from']) => {
  const p = sp(t, at, fps, 17, 150);
  const d = 1 - p;
  const off = {down: [0, 520], up: [0, -520], left: [-900, 0], right: [900, 0], pop: [0, 60]}[from ?? 'down'];
  return {p, dx: off[0] * d, dy: off[1] * d, s: from === 'pop' ? 0.82 + 0.18 * p : 0.94 + 0.06 * p};
};
export const Win: React.FC<WinProps> = ({t, fps, at, out, x, y, w, h, title, icon, iconColor, dark = true, from = 'down', bar = 92, body, zoom = 1, style, children}) => {
  if (t < at - 0.02) return null;
  const a = winPose(t, fps, at, from), b = winPose(t - 1 / fps, fps, at, from);
  const q = out !== undefined ? ez(t, out, out + 0.4, EZ.io) : 0;
  if (q >= 1) return null;
  // размытие по оси движения — скорость за кадр, как motion blur в Screen Studio
  const vx = Math.abs(a.dx - b.dx), vy = Math.abs(a.dy - b.dy);
  const bx = Math.min(40, vx * 0.5), by = Math.min(40, vy * 0.5);
  const id = `mb-${Math.round(x)}-${Math.round(y)}-${Math.round(at * 100)}`;
  const blur = bx + by > 0.6;
  const chrome = dark ? 'linear-gradient(180deg, #2B2E33, #202226)' : 'linear-gradient(180deg, #F7F7F8, #ECEDEF)';
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: Math.min(1, a.p * 2.2) * (1 - q),
      transform: `translate(${a.dx}px, ${a.dy - q * 60}px) scale(${a.s * zoom * (1 - q * 0.08)})`, transformOrigin: '50% 50%',
      filter: blur ? `url(#${id})` : q > 0 ? `blur(${q * 14}px)` : undefined, ...style}}>
      {blur ? <svg width={0} height={0} style={{position: 'absolute'}}><filter id={id} x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation={`${bx} ${by}`} /></filter></svg> : null}
      <div style={{position: 'absolute', inset: 0, borderRadius: 38, overflow: 'hidden', background: body ?? (dark ? '#141517' : '#FFFFFF'),
        boxShadow: `${dark ? 'inset 0 0 0 1.5px rgba(255,255,255,.12)' : 'inset 0 0 0 1.5px rgba(0,0,0,.08)'}, 0 3px 6px rgba(0,0,0,.18), 0 26px 52px rgba(0,0,0,.30), 0 70px 140px rgba(0,0,0,.32)`}}>
        <div style={{position: 'absolute', left: 0, top: 0, width: w, height: bar, background: chrome, display: 'flex', alignItems: 'center', padding: '0 30px',
          boxShadow: dark ? 'inset 0 -1.5px 0 rgba(0,0,0,.45)' : 'inset 0 -1.5px 0 rgba(0,0,0,.08)', zIndex: 2}}>
          {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => <span key={c} style={{width: 24, height: 24, borderRadius: '50%', background: c, marginRight: 14, flex: 'none',
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.18)'}} />)}
          {title ? (
            <div style={{position: 'absolute', left: 150, right: 150, top: 0, height: bar, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
              fontFamily: SF, fontWeight: 600, fontSize: 44, color: dark ? '#E7E9EB' : '#2A2C30', whiteSpace: 'nowrap', overflow: 'hidden'}}>
              {icon ? <Mark name={icon} size={46} color={iconColor ?? (dark ? '#FFFFFF' : BRAND[icon] ?? INK)} /> : null}{title}
            </div>
          ) : null}
        </div>
        <div style={{position: 'absolute', left: 0, top: bar, width: w, height: h - bar, overflow: 'hidden'}}>{children}</div>
      </div>
    </div>
  );
};

// ——— Камера Screen Studio внутри окна: ключи кадрирования по исходнику (центр и ширина кадра, пиксели исходника) ———
export type Cam = {at: number; cx: number; cy: number; w: number; dur?: number};
export const camAt = (t: number, keys: Cam[]) => {
  let {cx, cy, w} = keys[0];
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i], m = ez(t, k.at, k.at + (k.dur ?? 0.9), EZ.io);
    if (m <= 0) break;
    // ширина — в логарифме, чтобы наезд шёл равномерно, как зум Screen Studio
    cx += (k.cx - cx) * m; cy += (k.cy - cy) * m; w = Math.exp(Math.log(w) + (Math.log(k.w) - Math.log(w)) * m);
  }
  return {cx, cy, w};
};
export const Shot: React.FC<{t: number; bw: number; bh: number; src: string; sw: number; sh: number; keys: Cam[]; video?: {from: number; trim: number; rate?: number};
  children?: React.ReactNode}> = ({t, bw, bh, src, sw, sh, keys, video, children}) => {
  const {fps} = useVideoConfig();
  const c = camAt(t, keys);
  const s = bw / c.w;
  const left = bw / 2 - c.cx * s, top = bh / 2 - c.cy * s;
  const media: React.CSSProperties = {position: 'absolute', left: 0, top: 0, width: sw * s, height: sh * s, maxWidth: 'none', maxHeight: 'none'};
  return (
    <div style={{position: 'absolute', left, top, width: sw * s, height: sh * s}}>
      {video ? (
        <Sequence from={Math.round(video.from * fps)} layout="none">
          <Video src={staticFile(src)} muted trimBefore={Math.round(video.trim * fps)} playbackRate={video.rate ?? 1} style={media} />
        </Sequence>
      ) : <Img src={staticFile(src)} style={media} />}
      {/* пометки поверх исходника в его пикселях */}
      {children ? <div style={{position: 'absolute', left: 0, top: 0, width: sw, height: sh, transform: `scale(${s})`, transformOrigin: '0 0'}}>{children}</div> : null}
    </div>
  );
};

// ——— Курсор macOS: путь по точкам с дугой, клик — сжатие и мятное кольцо, необязательная табличка ———
export type Pt = {at: number; x: number; y: number};
export const glide = (t: number, pts: Pt[], dur = 0.55): [number, number] => {
  let x = pts[0].x, y = pts[0].y;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i], m = ez(t, p.at - dur, p.at, EZ.io);
    if (m <= 0) break;
    const x0 = x, y0 = y;
    // дуга: смещение по нормали, максимум в середине пути
    const len = Math.hypot(p.x - x0, p.y - y0) || 1, bend = Math.sin(m * Math.PI) * len * 0.12;
    x = x0 + (p.x - x0) * m + (-(p.y - y0) / len) * bend;
    y = y0 + (p.y - y0) * m + ((p.x - x0) / len) * bend;
  }
  return [x, y];
};
export const Pointer: React.FC<{t: number; pts: Pt[]; clicks?: number[]; show: [number, number]; tag?: React.ReactNode; size?: number; ring?: string}> =
  ({t, pts, clicks = [], show, tag, size = 76, ring = MINT}) => {
    if (t < show[0] || t > show[1]) return null;
    const [x, y] = glide(t, pts);
    const o = Math.min(ez(t, show[0], show[0] + 0.15), 1 - ez(t, show[1] - 0.15, show[1]));
    const last = clicks.filter((c) => t >= c).pop();
    const since = last === undefined ? 9 : t - last;
    const press = since < 0.14 ? Math.sin((since / 0.14) * Math.PI) : 0;
    const r = interpolate(since, [0, 0.4], [0, 1], CL);
    return (
      <div style={{position: 'absolute', left: x, top: y, opacity: o, pointerEvents: 'none', zIndex: 20}}>
        {since < 0.4 ? <div style={{position: 'absolute', left: -70 * r, top: -70 * r, width: 140 * r, height: 140 * r, borderRadius: '50%',
          border: `6px solid ${ring}`, opacity: 1 - r, boxShadow: `0 0 24px ${rgba(ring, 0.6)}`}} /> : null}
        <svg width={size} height={size * 1.3} viewBox="0 0 24 31" style={{position: 'absolute', left: -size * 0.1, top: -size * 0.05, overflow: 'visible',
          transform: `scale(${1 - press * 0.16})`, transformOrigin: '10% 5%', filter: 'drop-shadow(0 6px 10px rgba(0,0,0,.35))'}}>
          <path d="M2 1.5 L2 24.5 L7.6 19.3 L11.3 28 L15.2 26.4 L11.6 17.9 L19.2 17.9 Z" fill="#FFFFFF" stroke="#0B0C0E" strokeWidth={1.6} strokeLinejoin="round" />
        </svg>
        {tag ? <div style={{position: 'absolute', left: size * 0.7, top: size * 1.05}}>{tag}</div> : null}
      </div>
    );
  };

// Строки текста в окне с проверкой [fit]: не шире окна, поля не меньше половины кегля.
export const Lines: React.FC<{name: string; x: number; y: number; w: number; size: number; lh?: number; family?: string; color?: string; children: React.ReactNode;
  style?: React.CSSProperties}> = ({name, x, y, w, size, lh = 1.5, family = MONO, color = '#E6E8EA', children, style}) => {
  const ref = useFit(`lines:${name}`);
  return (
    <div ref={ref as never} style={{position: 'absolute', left: x, top: y, width: w, padding: `0 ${size * 0.6}px`, overflow: 'hidden', fontFamily: family, fontSize: size,
      lineHeight: lh, color, whiteSpace: 'pre', boxSizing: 'border-box', ...style}}>{children}</div>
  );
};

// Печать: сколько символов строки видно к моменту t (cps — символов в секунду).
export const typed = (t: number, at: number, text: string, cps = 30) => text.slice(0, Math.max(0, Math.floor((t - at) * cps)));
export const caret = (t: number) => (Math.floor(t * 2.4) % 2 === 0 ? 1 : 0);

// Пунктир, рисующийся по ходу (схема): p — доля пути.
export const Dash: React.FC<{d: string; p: number; color?: string; width?: number; dash?: number; o?: number; flow?: number}> = ({d, p, color = INK, width = 6, dash = 18, o = 1, flow = 0}) => {
  if (p <= 0) return null;
  return (
    <svg width={1440} height={2560} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none', opacity: o}}>
      <defs><mask id={`dm-${d.length}-${Math.round(dash)}`}><path d={d} fill="none" stroke="#fff" strokeWidth={width + 6} pathLength={1} strokeDasharray={`${p} 2`} /></mask></defs>
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray={`${dash} ${dash * 0.9}`} strokeDashoffset={-flow}
        mask={`url(#dm-${d.length}-${Math.round(dash)})`} />
    </svg>
  );
};
