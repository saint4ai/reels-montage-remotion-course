import {Easing} from 'remotion';
import {E, k} from '../../montage/parts';

// Кинетический холст ролика 23 (стиль СЦЕНЫ в режиме канваса, референс Александра 24.09.2026 — белый холст,
// типографика по словам, камера летит между смыслами с размытием в движении, кольца-счётчики, соты, пилюли, обводка).
// Холст живёт в верхней половине кадра: точка фокуса камеры — центр смысловой зоны (x 144…1152, y 360…1080),
// а не центр кадра, потому что справа рейка кнопок Instagram.
export const FOCUS = {x: 648, y: 720};
export const PAPER = '#F6F7F6', INK = '#111316', GREY = '#8A9096', MINT = '#3DEDC3', MINT_DEEP = '#16B892', ORANGE = '#FF7A2F';

export type Cam = {cx: number; cy: number; s: number};
export type CamKey = [number, number, number, number];   // [секунда, x, y, масштаб]
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
// быстрый старт и мягкая посадка — как у переездов ролика 22, масштаб интерполируется в логарифме
const punch = Easing.bezier(0.16, 0.9, 0.22, 1);
export const camAt = (t: number, keys: CamKey[]): Cam => {
  if (t <= keys[0][0]) return {cx: keys[0][1], cy: keys[0][2], s: keys[0][3]};
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, x0, y0, s0] = keys[i], [t1, x1, y1, s1] = keys[i + 1];
    if (t < t1 && t1 > t0) {
      const p = punch(Math.min(1, Math.max(0, (t - t0) / (t1 - t0))));
      return {cx: lerp(x0, x1, p), cy: lerp(y0, y1, p), s: Math.exp(lerp(Math.log(s0), Math.log(s1), p))};
    }
  }
  const l = keys[keys.length - 1];
  return {cx: l[1], cy: l[2], s: l[3]};
};
export const worldTransform = (c: Cam) => `translate(${FOCUS.x - c.cx * c.s}px, ${FOCUS.y - c.cy * c.s}px) scale(${c.s})`;

// Размытие в движении: скорость камеры за кадр в пикселях экрана → направленное размытие по осям (SVG feGaussianBlur),
// рост масштаба → лёгкое общее размытие. На стоящей камере фильтра нет.
export const blurOf = (t: number, keys: CamKey[], fps = 60) => {
  const a = camAt(t, keys), b = camAt(t + 1 / fps, keys);
  const vx = Math.abs((b.cx - a.cx) * a.s), vy = Math.abs((b.cy - a.cy) * a.s), vz = Math.abs(Math.log(b.s / a.s)) * 480;
  return {x: Math.min(46, vx * 0.45 + vz), y: Math.min(46, vy * 0.45 + vz)};
};
export const MotionBlurDefs: React.FC<{id: string; x: number; y: number}> = ({id, x, y}) => (
  <svg width={0} height={0} style={{position: 'absolute'}}>
    <filter id={id} x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation={`${x.toFixed(2)} ${y.toFixed(2)}`} /></filter>
  </svg>
);

// Слова по одному: каждое поднимается из размытия; accent — слова в цвете акцента
export const KWords: React.FC<{t: number; words: [string, number][]; x: number; y: number; size: number; weight?: number; family?: string;
  color?: string; accent?: Record<string, string>; align?: 'center' | 'left'; italic?: string[]}> = ({t, words, x, y, size, weight = 800, family = 'Inter Tight',
  color = INK, accent = {}, align = 'center', italic = []}) => (
  <div style={{position: 'absolute', left: align === 'center' ? x - 3000 : x, top: y, width: align === 'center' ? 6000 : undefined, textAlign: align, whiteSpace: 'nowrap',
    fontFamily: family, fontWeight: weight, fontSize: size, lineHeight: 1.05, letterSpacing: '-0.035em', color}}>
    {words.map(([w, at], i) => {
      const a = k(t, at - 0.04, at + 0.3, E.out), key = w.replace(/[.,:!?—]/g, '');
      const it = italic.includes(key);
      return (
        <span key={i} style={{display: 'inline-block', marginRight: '0.24em', opacity: a, transform: `translateY(${(1 - a) * size * 0.35}px)`,
          filter: a < 1 ? `blur(${(1 - a) * 12}px)` : undefined, color: accent[key] ?? undefined,
          fontFamily: it ? 'Caveat' : undefined, fontWeight: it ? 600 : undefined, fontSize: it ? size * 1.12 : undefined}}>{w}</span>
      );
    })}
  </div>
);

// Кольцо-счётчик: серая дорожка, цветная дуга растёт вместе с числом; quarters — подсветка четвертей по очереди
export const Ring: React.FC<{x: number; y: number; d: number; stroke: number; fill: number; color: string; glow?: number; quarters?: number[]}> =
  ({x, y, d, stroke, fill, color, glow = 0, quarters}) => {
    const r = (d - stroke) / 2, c = 2 * Math.PI * r;
    return (
      <svg width={d} height={d} style={{position: 'absolute', left: x - d / 2, top: y - d / 2, overflow: 'visible',
        filter: glow > 0 ? `drop-shadow(0 0 ${30 * glow}px ${color})` : undefined}}>
        <circle cx={d / 2} cy={d / 2} r={r} fill="none" stroke="#E2E5E3" strokeWidth={stroke} />
        <circle cx={d / 2} cy={d / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${Math.max(0.001, fill) * c} ${c}`} transform={`rotate(-90 ${d / 2} ${d / 2})`} />
        {quarters?.map((q, i) => q > 0 ? (
          <circle key={i} cx={d / 2} cy={d / 2} r={r} fill="none" stroke="#FFFFFF" strokeWidth={stroke * 0.42} strokeLinecap="round" opacity={q}
            strokeDasharray={`${c / 4 - stroke * 0.9} ${c}`} strokeDashoffset={-(c / 4) * i - stroke * 0.45} transform={`rotate(-90 ${d / 2} ${d / 2})`} />
        ) : null)}
      </svg>
    );
  };

// Рисованный овал вокруг слова (маркерная обводка из референса): рисуется за a…b, чуть наклонён и не замкнут
export const EllipseMark: React.FC<{t: number; a: number; b: number; x: number; y: number; w: number; h: number; color?: string; width?: number}> =
  ({t, a, b, x, y, w, h, color = MINT, width = 10}) => {
    const p = k(t, a, b, Easing.bezier(0.65, 0, 0.35, 1));
    if (p <= 0) return null;
    const d = `M ${w * 0.62} ${h * 0.04} C ${w * 0.95} ${h * 0.02}, ${w * 1.04} ${h * 0.6}, ${w * 0.7} ${h * 0.94} C ${w * 0.45} ${h * 1.08}, ${w * 0.02} ${h * 0.92}, ${w * 0.02} ${h * 0.5}
      C ${w * 0.02} ${h * 0.12}, ${w * 0.36} ${h * -0.02}, ${w * 0.74} ${h * 0.1}`;
    return (
      <svg width={w} height={h} style={{position: 'absolute', left: x - w / 2, top: y - h / 2, overflow: 'visible', transform: 'rotate(-4deg)'}}>
        <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" pathLength={1} strokeDasharray={`${p} 1`}
          style={{filter: `drop-shadow(0 0 14px ${color}88)`}} />
      </svg>
    );
  };

// Белый холст: мягкие мятные пятна и большие бледные кольца живут в мире с параллаксом 0,6 — глубина при пролётах камеры
export const PaperBg: React.FC<{cam: Cam; w: number; h: number; blobs: [number, number, number][]; rings: [number, number, number][]}> = ({cam, w, h, blobs, rings}) => {
  const par = 0.6, tx = FOCUS.x - cam.cx * cam.s * par, ty = FOCUS.y - cam.cy * cam.s * par, s = Math.pow(cam.s, par);
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: w, height: h, overflow: 'hidden', background: PAPER}}>
      <div style={{position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${s})`}}>
        {blobs.map(([x, y, d], i) => <div key={`b${i}`} style={{position: 'absolute', left: x - d / 2, top: y - d / 2, width: d, height: d, borderRadius: '50%',
          background: 'radial-gradient(closest-side, rgba(61,237,195,.22), rgba(61,237,195,0))'}} />)}
        {rings.map(([x, y, d], i) => <div key={`r${i}`} style={{position: 'absolute', left: x - d / 2, top: y - d / 2, width: d, height: d, borderRadius: '50%',
          boxShadow: `inset 0 0 0 ${Math.max(6, d * 0.02)}px rgba(61,237,195,.16)`}} />)}
      </div>
    </div>
  );
};
