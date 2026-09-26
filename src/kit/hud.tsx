import React from 'react';
import {interpolate, random} from 'remotion';

// HUD «Железного человека» (формат «Джарвис», 26.09.2026, по референсам Александра: MK33 HUD, красный рабочий стол
// Джарвиса, красный «матричный» дождь, треугольный неоновый туннель). Основа чёрно-белая, красный только акцентом:
// «не переигрывай с красным, нужен контраст и единый tone of voice». Всё векторное, свечение фильтрами SVG.
export const HUD = {
  bg: '#050506', ink: '#F3F4F2', dim: 'rgba(243,244,242,.5)', faint: 'rgba(243,244,242,.13)',
  red: '#FF2E3E', redD: '#B5121F', hot: '#FFF7F0', paper: '#F1F1EE', black: '#0A0A0B',
};
export const ORB = 'Orbitron', MONO = 'JBM', SANS = 'SF Pro Display';
const cl = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const kk = (t: number, a: number, b: number) => interpolate(t, [a, b], [0, 1], cl);

const pol = (cx: number, cy: number, r: number, deg: number) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];
export const arcPath = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const [x0, y0] = pol(cx, cy, r, a0), [x1, y1] = pol(cx, cy, r, a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};
// Равносторонний треугольник вершиной вниз (как реактор Mark VI), R — радиус описанной окружности.
export const triPts = (cx: number, cy: number, R: number, rot = 0) =>
  [90, 210, 330].map((a) => pol(cx, cy, R, a + rot).map((v) => v.toFixed(2)).join(',')).join(' ');

// ——— Сетка HUD: тонкие линии, каждая пятая ярче ———
export const HudGrid: React.FC<{w?: number; h?: number; step?: number; ox?: number; oy?: number; color?: string; opacity?: number; vignette?: boolean}> =
  ({w = 1440, h = 2560, step = 64, ox = 0, oy = 0, color = HUD.ink, opacity = 1, vignette = true}) => {
    const id = `hg${step}${Math.round(ox)}${Math.round(oy)}`;
    return (
      <svg width={w} height={h} style={{position: 'absolute', left: 0, top: 0, opacity}}>
        <defs>
          <pattern id={`${id}a`} width={step} height={step} patternUnits="userSpaceOnUse" x={ox % step} y={oy % step}>
            <path d={`M${step} 0 L0 0 0 ${step}`} fill="none" stroke={color} strokeOpacity={0.07} strokeWidth={1.2} />
          </pattern>
          <pattern id={`${id}b`} width={step * 5} height={step * 5} patternUnits="userSpaceOnUse" x={ox % (step * 5)} y={oy % (step * 5)}>
            <path d={`M${step * 5} 0 L0 0 0 ${step * 5}`} fill="none" stroke={color} strokeOpacity={0.14} strokeWidth={1.6} />
          </pattern>
          <radialGradient id={`${id}v`} cx="50%" cy="45%" r="75%">
            <stop offset="0.55" stopColor="#000" stopOpacity={0} /><stop offset="1" stopColor="#000" stopOpacity={0.85} />
          </radialGradient>
        </defs>
        <rect width={w} height={h} fill={`url(#${id}a)`} />
        <rect width={w} height={h} fill={`url(#${id}b)`} />
        {vignette ? <rect width={w} height={h} fill={`url(#${id}v)`} /> : null}
      </svg>
    );
  };

// ——— Реактор: треугольное ядро, кольца с засечками, сегменты, радар, кольцо эквалайзера по голосу ———
export const Reactor: React.FC<{cx: number; cy: number; r: number; t: number; boot?: number; energy?: number; bars?: number[]; cut?: number; id: string; opacity?: number}> =
  ({cx, cy, r, t, boot = 1, energy = 0.3, bars, cut = 0, id, opacity = 1}) => {
    const S = r * 3.4, o = S / 2; // локальные координаты: центр в (o, o)
    const b = (a: number, z: number) => kk(boot, a, z);
    const glow = 0.55 + 0.45 * energy;
    const segCol = cut > 0 ? `rgb(255,${Math.round(244 - 200 * cut)},${Math.round(242 - 190 * cut)})` : HUD.ink;
    const jit = cut > 0 ? (random(`rj${Math.floor(t * 30)}`) - 0.5) * r * 0.05 * cut : 0;
    const N = 72;
    return (
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} style={{position: 'absolute', left: cx - o + jit, top: cy - o, overflow: 'visible', opacity}}>
        <defs>
          <radialGradient id={`${id}h`}>
            <stop offset="0" stopColor="#FFFFFF" stopOpacity={0.5 * glow} />
            <stop offset="0.28" stopColor="#FFD9D4" stopOpacity={0.22 * glow} />
            <stop offset="0.55" stopColor={HUD.red} stopOpacity={0.1 * glow} />
            <stop offset="1" stopColor={HUD.red} stopOpacity={0} />
          </radialGradient>
          <radialGradient id={`${id}c`}>
            <stop offset="0" stopColor="#FFFFFF" /><stop offset="0.45" stopColor={HUD.hot} />
            <stop offset="0.8" stopColor="#FFC9C2" stopOpacity={0.85} /><stop offset="1" stopColor={HUD.red} stopOpacity={0.55} />
          </radialGradient>
          <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={HUD.red} stopOpacity={0} /><stop offset="1" stopColor={HUD.red} stopOpacity={0.55} />
          </linearGradient>
          <filter id={`${id}g`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={r * 0.035} result="b1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation={r * 0.1} result="b2" />
            <feMerge><feMergeNode in="b2" /><feMergeNode in="b1" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id={`${id}q`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={r * 0.012} result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <circle cx={o} cy={o} r={r * 1.7} fill={`url(#${id}h)`} opacity={b(0.35, 1)} />
        {/* кольцо эквалайзера */}
        {bars ? Array.from({length: N}, (_, i) => {
          const a = (i / N) * 360 - 90, v = bars[i % bars.length] * b(0.6, 1);
          const r0 = r * 1.2, r1 = r0 + r * 0.36 * v;
          const [x0, y0] = pol(o, o, r0, a), [x1, y1] = pol(o, o, r1, a);
          return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke={v > 0.72 ? HUD.red : HUD.ink} strokeOpacity={0.35 + 0.6 * v} strokeWidth={r * 0.02} strokeLinecap="round" />;
        }) : null}
        {/* засечки внешнего кольца */}
        <g transform={`rotate(${t * 5} ${o} ${o})`} opacity={b(0, 0.5)}>
          {Array.from({length: 120}, (_, i) => {
            const a = i * 3, long = i % 10 === 0;
            const [x0, y0] = pol(o, o, r * 1.03, a), [x1, y1] = pol(o, o, r * (long ? 1.13 : 1.08), a);
            return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke={long ? HUD.red : HUD.ink} strokeOpacity={long ? 0.9 : 0.5} strokeWidth={r * (long ? 0.012 : 0.006)} />;
          })}
        </g>
        <circle cx={o} cy={o} r={r * 0.98} fill="none" stroke={HUD.ink} strokeOpacity={0.35} strokeWidth={r * 0.006} pathLength={1} strokeDasharray={`${b(0, 0.6)} 1`} />
        {/* радар */}
        <g transform={`rotate(${t * 80} ${o} ${o})`} opacity={0.6 * b(0.4, 1)}>
          <path d={`M${o} ${o} L${pol(o, o, r * 0.97, -40).join(' ')} A${r * 0.97} ${r * 0.97} 0 0 1 ${pol(o, o, r * 0.97, 0).join(' ')} Z`} fill={`url(#${id}s)`} />
        </g>
        {/* сегменты */}
        <g transform={`rotate(${-t * 16 + cut * 40} ${o} ${o})`} filter={`url(#${id}q)`}>
          {[0, 120, 240].map((a0) => {
            const span = 96 * b(0.1, 0.7);
            const [ex, ey] = pol(o, o, r * 0.88, a0 + span);
            return (
              <g key={a0}>
                <path d={arcPath(o, o, r * 0.88, a0, a0 + Math.max(0.1, span))} fill="none" stroke={segCol} strokeWidth={r * 0.055} strokeLinecap="butt" />
                <circle cx={ex} cy={ey} r={r * 0.028} fill={HUD.red} opacity={b(0.6, 0.8)} />
              </g>
            );
          })}
        </g>
        <g transform={`rotate(${t * 34} ${o} ${o})`}>
          <circle cx={o} cy={o} r={r * 0.78} fill="none" stroke={HUD.ink} strokeOpacity={0.6} strokeWidth={r * 0.012} strokeDasharray={`${r * 0.05} ${r * 0.07}`} opacity={b(0.2, 0.7)} />
        </g>
        <circle cx={o} cy={o} r={r * 0.69} fill="none" stroke={HUD.ink} strokeOpacity={0.85} strokeWidth={r * 0.03} strokeDasharray={`${r * 0.3} ${r * 0.062}`}
          transform={`rotate(${-t * 8} ${o} ${o})`} opacity={b(0.25, 0.75)} />
        {/* треугольник и ядро */}
        <g filter={`url(#${id}g)`} opacity={b(0.35, 0.9)}>
          <polygon points={triPts(o, o, r * 0.56)} fill="none" stroke={HUD.ink} strokeWidth={r * 0.028} strokeLinejoin="round" pathLength={1} strokeDasharray={`${b(0.3, 0.8)} 1`} />
          <polygon points={triPts(o, o, r * 0.44)} fill={`url(#${id}c)`} opacity={(0.72 + 0.28 * energy) * b(0.55, 0.95)} />
          <circle cx={o} cy={o} r={r * (0.1 + 0.03 * energy)} fill="#FFFFFF" opacity={b(0.6, 0.9)} />
        </g>
      </svg>
    );
  };

// ——— Уголки прицела вокруг прямоугольника ———
export const Brackets: React.FC<{x: number; y: number; w: number; h: number; len?: number; th?: number; color?: string; opacity?: number}> =
  ({x, y, w, h, len = 36, th = 3, color = HUD.ink, opacity = 1}) => {
    const c = (px: number, py: number, dx: number, dy: number) => `M${px + dx * len} ${py} L${px} ${py} L${px} ${py + dy * len}`;
    return (
      <svg width={w + 20} height={h + 20} style={{position: 'absolute', left: x - 10, top: y - 10, overflow: 'visible', opacity}}>
        <g transform="translate(10 10)" fill="none" stroke={color} strokeWidth={th}>
          <path d={c(0, 0, 1, 1)} /><path d={c(w, 0, -1, 1)} /><path d={c(0, h, 1, -1)} /><path d={c(w, h, -1, -1)} />
        </g>
      </svg>
    );
  };

// Захват цели: уголки сжимаются к рамке с перелётом, вспышка, подпись справа.
export const LockOn: React.FC<{t: number; at: number; x: number; y: number; w: number; h: number; label?: string; size?: number; color?: string}> =
  ({t, at, x, y, w, h, label, size = 38, color = HUD.red}) => {
    if (t < at) return null;
    const p = kk(t, at, at + 0.3), e = 1 - Math.pow(1 - p, 3), pad = 70 * (1 - e) - 6 * Math.sin(p * Math.PI);
    const fl = 1 - kk(t, at + 0.3, at + 0.6);
    return (
      <>
        <Brackets x={x - 10 - pad} y={y - 10 - pad} w={w + 20 + pad * 2} h={h + 20 + pad * 2} len={28} th={4} color={color} opacity={Math.min(1, p * 2)} />
        <div style={{position: 'absolute', left: x - 10, top: y - 10, width: w + 20, height: h + 20, background: color, opacity: 0.18 * fl}} />
        {label ? (
          <div style={{position: 'absolute', left: x + w + 28, top: y + h / 2 - size * 0.75, height: size * 1.5, display: 'flex', alignItems: 'center', padding: `0 ${size * 0.45}px`,
            background: color, color: '#FFFFFF', fontFamily: MONO, fontWeight: 700, fontSize: size, whiteSpace: 'nowrap', opacity: kk(t, at + 0.2, at + 0.35),
            clipPath: `inset(0 ${100 - 100 * kk(t, at + 0.2, at + 0.45)}% 0 0)`, boxShadow: `0 0 30px ${color}`}}>{label}</div>
        ) : null}
      </>
    );
  };

// Печатная строка с блочным курсором.
export const Typed: React.FC<{t: number; at: number; text: string; cps?: number; style?: React.CSSProperties; cursor?: string}> = ({t, at, text, cps = 38, style, cursor = HUD.red}) => {
  if (t < at) return null;
  const n = Math.min(text.length, Math.floor((t - at) * cps));
  const blink = n < text.length || Math.floor(t * 2.5) % 2 === 0;
  return (
    <span style={{whiteSpace: 'pre', ...style}}>
      {text.slice(0, n)}
      <span style={{display: 'inline-block', width: '0.55em', height: '1em', verticalAlign: '-0.12em', marginLeft: 4, background: cursor, opacity: blink ? 1 : 0}} />
    </span>
  );
};

// Мелкая телеметрия: фактура по краям кадра, не для чтения.
export const Telemetry: React.FC<{t: number; x: number; y: number; rows?: number; cols?: number; seed: string; size?: number; opacity?: number; align?: 'left' | 'right'}> =
  ({t, x, y, rows = 5, cols = 3, seed, size = 22, opacity = 0.4, align = 'left'}) => {
    const tick = Math.floor(t * 7);
    return (
      <div style={{position: 'absolute', left: align === 'left' ? x : undefined, right: align === 'right' ? 1440 - x : undefined, top: y, fontFamily: MONO, fontSize: size, lineHeight: 1.35,
        color: HUD.ink, opacity, whiteSpace: 'pre', textAlign: align}}>
        {Array.from({length: rows}, (_, r) => Array.from({length: cols}, (_, c) => {
          const v = random(`${seed}${r}${c}${random(`${seed}${r}${c}`) > 0.6 ? tick : 0}`);
          return c === 0 ? `0x${Math.floor(v * 65535).toString(16).toUpperCase().padStart(4, '0')}` : (v * 100).toFixed(2).padStart(6, ' ');
        }).join('  ')).join('\n')}
      </div>
    );
  };

// Каркасный ноутбук (линии рисуются по progress); экран отдаётся детям.
export const WireLaptop: React.FC<{x: number; y: number; w: number; p: number; children?: React.ReactNode; color?: string}> = ({x, y, w, p, children, color = HUD.ink}) => {
  const h = w * 0.62, bw = w * 1.18, bh = w * 0.07, d = (a: number, b: number) => `${kk(p, a, b)} 1`;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h + bh}}>
      <div style={{position: 'absolute', left: w * 0.035, top: w * 0.035, width: w * 0.93, height: h - w * 0.07, overflow: 'hidden', borderRadius: 6, opacity: kk(p, 0.35, 0.7), background: '#000'}}>{children}</div>
      <svg width={bw} height={h + bh + 4} style={{position: 'absolute', left: -(bw - w) / 2, top: 0, overflow: 'visible'}}>
        <g fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" transform={`translate(${(bw - w) / 2} 0)`}>
          <rect x={0} y={0} width={w} height={h} rx={18} pathLength={1} strokeDasharray={d(0, 0.5)} />
          <rect x={w * 0.035} y={w * 0.035} width={w * 0.93} height={h - w * 0.07} rx={6} strokeOpacity={0.45} pathLength={1} strokeDasharray={d(0.15, 0.6)} />
          <path d={`M${-(bw - w) / 2} ${h + bh * 0.35} L${w + (bw - w) / 2} ${h + bh * 0.35} L${w + (bw - w) / 2 - 16} ${h + bh} L${-(bw - w) / 2 + 16} ${h + bh} Z`} pathLength={1} strokeDasharray={d(0.35, 0.8)} />
          <path d={`M${-(bw - w) / 2 + 20} ${h + bh * 0.35} L${-(bw - w) / 2 + 40} ${h} L${w + (bw - w) / 2 - 40} ${h} L${w + (bw - w) / 2 - 20} ${h + bh * 0.35}`} strokeOpacity={0.6} pathLength={1} strokeDasharray={d(0.5, 0.9)} />
          <line x1={w * 0.42} y1={h + bh * 0.62} x2={w * 0.58} y2={h + bh * 0.62} stroke={HUD.red} strokeWidth={4} opacity={kk(p, 0.85, 1)} />
        </g>
      </svg>
    </div>
  );
};

// Туннель из треугольников: рамки летят на зрителя; каждая третья красная.
export const TriTunnel: React.FC<{t: number; cx: number; cy: number; speed?: number; opacity?: number; n?: number; w?: number; h?: number; spin?: number}> =
  ({t, cx, cy, speed = 0.25, opacity = 1, n = 16, w = 1440, h = 2560, spin = 8}) => (
    <svg width={w} height={h} style={{position: 'absolute', left: 0, top: 0, opacity}}>
      {Array.from({length: n}, (_, i) => {
        const z = (((i / n) + t * speed) % 1 + 1) % 1, R = 18 * Math.pow(140, z), a = Math.min(1, z * 3) * (1 - kk(z, 0.8, 1));
        const red = i % 3 === 0;
        return <polygon key={i} points={triPts(cx, cy, R, z * spin)} fill="none" stroke={red ? HUD.red : HUD.ink} strokeOpacity={a * (red ? 0.85 : 0.35)} strokeWidth={red ? 3 + z * 6 : 1.5 + z * 2} strokeLinejoin="round" />;
      })}
    </svg>
  );

// Красный «матричный» дождь: колонки знаков падают, голова колонки ярче.
export const CodeRain: React.FC<{t: number; w?: number; h?: number; cols?: number; opacity?: number; size?: number; color?: string}> =
  ({t, w = 1440, h = 2560, cols = 22, opacity = 0.2, size = 34, color = HUD.red}) => {
    const CH = '01ABCDEF0123456789JARVIS<>/{}[]#%';
    return (
      <svg width={w} height={h} style={{position: 'absolute', left: 0, top: 0, opacity}}>
        {Array.from({length: cols}, (_, c) => {
          const x = (c + 0.5) * (w / cols), v = 120 + random(`cv${c}`) * 220, len = 8 + Math.floor(random(`cl${c}`) * 14);
          const head = ((random(`co${c}`) * (h + 800) + t * v) % (h + 800)) - 400;
          return Array.from({length: len}, (_, j) => {
            const y = head - j * size * 1.15;
            if (y < -size || y > h + size) return null;
            const g = CH[Math.floor(random(`cg${c}${j}${Math.floor(t * 6 + j)}`) * CH.length)];
            return <text key={`${c}-${j}`} x={x} y={y} fill={j === 0 ? '#FFD7D2' : color} fillOpacity={j === 0 ? 1 : Math.max(0.1, 1 - j / len)} fontFamily={MONO} fontSize={size} textAnchor="middle">{g}</text>;
          });
        })}
      </svg>
    );
  };
