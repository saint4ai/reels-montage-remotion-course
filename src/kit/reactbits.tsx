import React, {useLayoutEffect, useRef} from 'react';
import {Easing, interpolate, random, useVideoConfig} from 'remotion';

// Переносы React Bits (reactbits.dev, MIT + Commons Clause) на покадровый Remotion, ролик «Трюки со ссылками GitHub»,
// 03.10.2026. Из компонента берём визуальный рецепт и параметры, время заменяем кадром: никаких CSS-анимаций,
// requestAnimationFrame, наведения и «появления в окне»; старт привязан к слову речи. Каталог и правила переноса:
// каталог React Bits (reactbits.dev). Тайминги по замерам Raylight (буква 30 мс, слово 80 мс, вход 400–800 мс, выход быстрее).
const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const RBE = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  io: Easing.bezier(0.65, 0, 0.35, 1),
  inExpo: Easing.bezier(0.7, 0, 0.84, 0),
  outExpo: Easing.bezier(0.16, 1, 0.3, 1),
  lock: Easing.bezier(0.34, 1.18, 0.64, 1),
};
export const rk = (t: number, a: number, b: number, e = RBE.out) => interpolate(t, [a, b], [0, 1], {...CL, easing: e});

// ——— BlurText / SplitText: буквы или слова из размытия с подъёмом, по очереди ———
export const BlurText: React.FC<{t: number; at: number; text: string; by?: 'letters' | 'words'; stagger?: number; dur?: number; blur?: number; dy?: number;
  out?: number; style?: React.CSSProperties}> = ({t, at, text, by = 'letters', stagger, dur = 0.5, blur = 14, dy = 26, out, style}) => {
  const st = stagger ?? (by === 'letters' ? 0.03 : 0.08);
  const parts = by === 'words' ? text.split(/(\s+)/) : [...text];
  const o = out !== undefined ? 1 - rk(t, out, out + 0.3, RBE.io) : 1;
  if (t < at - 0.01 || o <= 0) return null;
  let i = 0;
  return (
    <span style={{display: 'inline-block', whiteSpace: 'pre', opacity: o, ...style}}>
      {parts.map((p, j) => {
        if (/^\s+$/.test(p)) return <span key={j}>{p}</span>;
        const s = at + i++ * st, a = rk(t, s, s + dur);
        return <span key={j} style={{display: 'inline-block', opacity: a, transform: `translateY(${(1 - a) * dy}px)`, filter: a < 0.99 ? `blur(${(1 - a) * blur}px)` : undefined}}>{p}</span>;
      })}
    </span>
  );
};

// ——— DecryptedText / ScrambledText: слово перебирает случайные знаки и встаёт в новое слева направо ———
export const decryptAt = (t: number, at: number, from: string, to: string, dur = 0.55, chars = 'abcdefghijklmnopqrstuvwxyz', seed = 'dx') => {
  if (t < at) return {text: from, done: false, p: 0};
  if (t >= at + dur) return {text: to, done: true, p: 1};
  const p = (t - at) / dur;
  const len = Math.round(from.length + (to.length - from.length) * Math.min(1, p * 1.6));
  const rev = Math.floor(p * to.length);
  const tick = Math.floor(t * 30);
  let s = '';
  for (let i = 0; i < len; i++) s += i < rev ? to[i] : chars[Math.floor(random(`${seed}${i}-${tick}`) * chars.length)];
  return {text: s, done: false, p};
};

// ——— ShinyText: по тексту проходит блик (фон-градиент, обрезанный по буквам) ———
export const ShinyText: React.FC<{t: number; at?: number; speed?: number; base: string; shine?: string; children: React.ReactNode; style?: React.CSSProperties}> =
  ({t, at = 0, speed = 2.6, base, shine = '#FFFFFF', children, style}) => {
    const p = (((t - at) / speed) % 1 + 1) % 1;
    return (
      <span style={{backgroundImage: `linear-gradient(110deg, ${base} 0%, ${base} 38%, ${shine} 50%, ${base} 62%, ${base} 100%)`, backgroundSize: '250% 100%',
        backgroundPosition: `${(1 - p) * 150 - 25}% 0`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', ...style}}>{children}</span>
    );
  };

// ——— StarBorder: по кромке бегут два световых пятна навстречу друг другу ———
export const StarBorder: React.FC<{t: number; w: number; h: number; r: number; color: string; speed?: number; o?: number; thickness?: number}> =
  ({t, w, h, r, color, speed = 2.4, o = 1, thickness = 3}) => {
    const p = ((t / speed) % 1 + 1) % 1;
    const blob = (x: number, y: number) => <div style={{position: 'absolute', left: x - w * 0.35, top: y - h * 1.1, width: w * 0.7, height: h * 2.2, borderRadius: '50%',
      background: `radial-gradient(closest-side, ${color}, transparent 70%)`}} />;
    return (
      <div style={{position: 'absolute', inset: -thickness, borderRadius: r + thickness, overflow: 'hidden', opacity: o, pointerEvents: 'none',
        WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude', padding: thickness}}>
        {blob(-w * 0.2 + p * w * 1.4, 0)}
        {blob(w * 1.2 - p * w * 1.4, h)}
      </div>
    );
  };

// ——— ClickSpark: от точки клика разлетаются короткие штрихи ———
export const ClickSpark: React.FC<{t: number; at: number; x: number; y: number; color: string; n?: number; radius?: number; size?: number; dur?: number; width?: number}> =
  ({t, at, x, y, color, n = 8, radius = 70, size = 34, dur = 0.42, width = 6}) => {
    if (t < at || t > at + dur) return null;
    const p = rk(t, at, at + dur, RBE.out);
    return (
      <svg width={1440} height={2560} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none', overflow: 'visible'}}>
        {Array.from({length: n}, (_, i) => {
          const a = (Math.PI * 2 * i) / n, d = 18 + radius * p, l = size * (1 - p);
          return <line key={i} x1={x + Math.cos(a) * d} y1={y + Math.sin(a) * d} x2={x + Math.cos(a) * (d + l)} y2={y + Math.sin(a) * (d + l)}
            stroke={color} strokeWidth={width} strokeLinecap="round" opacity={1 - p * 0.6} />;
        })}
      </svg>
    );
  };

// ——— Dock (macOS): ряд иконок в стеклянной полке, активная увеличена, соседи чуть меньше; подпись над активной ———
export const Dock: React.FC<{t: number; items: React.ReactNode[]; labels: string[]; active: number | null; since: number; x: number; y: number; size?: number;
  dark?: boolean; o?: number}> = ({t, items, labels, active, since, x, y, size = 104, dark = true, o = 1}) => {
  if (o <= 0) return null;
  const m = rk(t, since, since + 0.45, RBE.out);
  const gap = size * 0.28;
  const scale = (i: number) => active === null ? 1 : 1 + (i === active ? 0.32 : Math.abs(i - active) === 1 ? 0.1 : 0) * m;
  const w = items.reduce<number>((a, _, i) => a + size * scale(i) + gap, gap);
  let cx = x - w / 2 + gap;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1440, height: 2560, opacity: o, pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: x - w / 2, top: y - size * 0.62, width: w, height: size * 1.24, borderRadius: size * 0.42,
        background: dark ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.62)', backdropFilter: 'blur(26px) saturate(1.6)',
        boxShadow: dark ? 'inset 0 1.5px 0 rgba(255,255,255,.22), inset 0 0 0 1.5px rgba(255,255,255,.1), 0 20px 50px rgba(0,0,0,.45)'
          : 'inset 0 1.5px 0 #FFFFFF, inset 0 0 0 1.5px rgba(255,255,255,.9), 0 18px 44px rgba(40,30,80,.14)'}} />
      {items.map((it, i) => {
        const s = scale(i), d = size * s, left = cx;
        cx += d + gap;
        return (
          <div key={i} style={{position: 'absolute', left, top: y + size * 0.5 - d - size * 0.05, width: d, height: d, display: 'grid', placeItems: 'center',
            filter: active !== null && i !== active ? 'saturate(.55)' : undefined, opacity: active !== null && i !== active ? 0.72 : 1}}>{it}
            {active === i ? <div style={{position: 'absolute', left: d / 2 - 6, top: d + size * 0.1, width: 12, height: 12, borderRadius: 6, background: dark ? '#FFFFFF' : '#141414', opacity: m}} /> : null}
          </div>
        );
      })}
      {active !== null && labels[active] ? (() => {
        let lx = x - w / 2 + gap;
        for (let i = 0; i < active; i++) lx += size * scale(i) + gap;
        lx += (size * scale(active)) / 2;
        return (
          <div style={{position: 'absolute', left: lx, top: y - size * 1.42, transform: `translate(-50%, ${(1 - m) * 14}px)`, opacity: m, padding: '12px 26px', borderRadius: 999,
            background: dark ? 'rgba(20,22,30,.82)' : 'rgba(255,255,255,.92)', boxShadow: '0 10px 26px rgba(0,0,0,.25)', fontFamily: 'SF Pro Display', fontWeight: 600, fontSize: 44,
            color: dark ? '#FFFFFF' : '#16131F', whiteSpace: 'nowrap'}}>{labels[active]}</div>
        );
      })() : null}
    </div>
  );
};

// ——— CardSwap / Stack: стопка карточек в перспективе, передняя уходит назад по очереди ———
export const CardSwap: React.FC<{t: number; at: number; cards: React.ReactNode[]; swaps: number[]; w: number; h: number; x: number; y: number; dx?: number; dy?: number}> =
  ({t, at, cards, swaps, w, h, x, y, dx = 46, dy = -54}) => {
    const n = cards.length;
    const appear = rk(t, at, at + 0.6, RBE.out);
    if (appear <= 0) return null;
    const done = swaps.filter((s) => t >= s + 0.55).length;
    const cur = swaps.find((s) => t >= s && t < s + 0.55);
    const q = cur !== undefined ? rk(t, cur, cur + 0.55, RBE.io) : 0;
    const items = cards.map((c, i) => {
      const slot = (((i - done) % n) + n) % n; // 0 — передняя
      let px = slot * dx, py = slot * dy, z = -slot * 90, sc = 1 - slot * 0.04, o = 1 - slot * 0.12;
      if (cur !== undefined) {
        if (slot === 0) { py += q * 420 * (q < 0.5 ? 1 : 1 - (q - 0.5) * 2) + (q >= 0.5 ? (n - 1) * dy * (q - 0.5) * 2 : 0); px += q * (n - 1) * dx; z -= q * (n - 1) * 90; sc -= q * (n - 1) * 0.04; o -= q * 0.3; }
        else { px -= q * dx; py -= q * dy; z += q * 90; sc += q * 0.04; o += q * 0.12; }
      }
      return {c, slot: cur !== undefined && slot === 0 && q > 0.5 ? n : slot, px, py, z, sc, o, i};
    }).sort((a, b) => b.slot - a.slot);
    return (
      <div style={{position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, perspective: 1600, opacity: appear,
        transform: `translateY(${(1 - appear) * 80}px)`}}>
        {items.map((it) => (
          <div key={it.i} style={{position: 'absolute', inset: 0, transform: `translate3d(${it.px}px, ${it.py}px, ${it.z}px) rotateY(-14deg) rotateX(6deg) scale(${it.sc})`,
            opacity: Math.max(0, Math.min(1, it.o))}}>{it.c}</div>
        ))}
      </div>
    );
  };

// ——— Aurora (React Bits Backgrounds): шейдерное северное сияние, время = кадр/fps ———
const VERT = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
const FRAG = `precision highp float;
uniform float uTime; uniform vec2 uRes; uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform float uAmp; uniform float uBlend;
vec3 permute(vec3 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy)); vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1; i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0); m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0; vec3 h = abs(x) - 0.5; vec3 ox = floor(x + 0.5); vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw; return 130.0 * dot(m, g);
}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 ramp = uv.x < 0.5 ? mix(uC0, uC1, uv.x * 2.0) : mix(uC1, uC2, (uv.x - 0.5) * 2.0);
  float h = snoise(vec2(uv.x * 2.0 + uTime * 0.1, uTime * 0.25)) * 0.5 * uAmp;
  h = exp(h); h = (uv.y * 2.0 - h + 0.2);
  float intensity = 0.6 * h;
  float mid = 0.20;
  float a = smoothstep(mid - uBlend * 0.5, mid + uBlend * 0.5, intensity);
  gl_FragColor = vec4(ramp * intensity * a, a * intensity);
}`;
const hex3 = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
export const Aurora: React.FC<{t: number; colors: [string, string, string]; amp?: number; blend?: number; w?: number; h?: number; style?: React.CSSProperties}> =
  ({t, colors, amp = 1.0, blend = 0.5, w = 1440, h = 1100, style}) => {
    const ref = useRef<HTMLCanvasElement>(null);
    const gl = useRef<{g: WebGLRenderingContext; prog: WebGLProgram} | null>(null);
    const {fps} = useVideoConfig();
    void fps;
    useLayoutEffect(() => {
      const c = ref.current;
      if (!c) return;
      if (!gl.current) {
        const g = c.getContext('webgl', {premultipliedAlpha: true, alpha: true, preserveDrawingBuffer: true, antialias: false});
        if (!g) return;
        const sh = (type: number, src: string) => { const s = g.createShader(type)!; g.shaderSource(s, src); g.compileShader(s); return s; };
        const prog = g.createProgram()!;
        g.attachShader(prog, sh(g.VERTEX_SHADER, VERT)); g.attachShader(prog, sh(g.FRAGMENT_SHADER, FRAG)); g.linkProgram(prog); g.useProgram(prog);
        const buf = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, buf);
        g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW);
        const loc = g.getAttribLocation(prog, 'p'); g.enableVertexAttribArray(loc); g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
        g.enable(g.BLEND); g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
        gl.current = {g, prog};
      }
      const {g, prog} = gl.current;
      g.viewport(0, 0, c.width, c.height);
      g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT);
      const u = (n: string) => g.getUniformLocation(prog, n);
      g.uniform1f(u('uTime'), t); g.uniform2f(u('uRes'), c.width, c.height);
      g.uniform3fv(u('uC0'), hex3(colors[0])); g.uniform3fv(u('uC1'), hex3(colors[1])); g.uniform3fv(u('uC2'), hex3(colors[2]));
      g.uniform1f(u('uAmp'), amp); g.uniform1f(u('uBlend'), blend);
      g.drawArrays(g.TRIANGLES, 0, 3);
    });
    return <canvas ref={ref} width={Math.round(w / 2)} height={Math.round(h / 2)} style={{position: 'absolute', left: 0, top: 0, width: w, height: h, ...style}} />;
  };

// ——— AnimatedList: строки въезжают по очереди с масштабом ———
export const listAt = (t: number, at: number, i: number, step = 0.06, dur = 0.45) => rk(t, at + i * step, at + i * step + dur, RBE.out);

// ——— CountUp: число растёт к цели ———
export const countUp = (t: number, at: number, dur: number, to: number, from = 0) => Math.round(interpolate(t, [at, at + dur], [from, to], {...CL, easing: RBE.out}));
