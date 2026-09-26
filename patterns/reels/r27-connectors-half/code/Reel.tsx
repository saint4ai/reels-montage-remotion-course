import React from 'react';
import {AbsoluteFill, Img, random, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio, Video} from '@remotion/media';
import {Captions} from '../../montage/Captions';
import {E, k, Logo} from '../../montage/parts';
import {WORDS27} from './words';

// Ролик 27 «4 коннектора» v3 — пересборка ролика 4 на Remotion (решение Александра 25.09.2026): половина экрана он,
// половина монтаж; стиль PRISM (стеклянный элемент раскрывается в интерфейс), оранжевый + премиальный индиго (разовое
// исключение из палитры по его слову), шрифты SF Pro и JetBrains Mono. Сквозной якорь — панель «коннекторы Claude» на
// 4 ячейки, заполняется по ходу ролика. Карта: videos/reels-27-connectors-v3/DIRECTION.md.
export const FPS27 = 60;
export const PREVIEW27 = 12;
export const END27 = 68.1;

const W = 1440, H = 2560, SEAM = 1280;
const DISP = 'SF Pro Display', SANS = 'SF Pro Text', MONO = 'JBM';
const CX = 648, LX = 144, CW = 1008;
const OR = '#FF7A2F', OR2 = '#FFB27A', IND = '#5B4BFF', IND2 = '#8C80FF', INK = '#F4F2FF', DIM = '#A9A6C9', DARK = '#15131F';

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
const WordLine: React.FC<{t: number; words: [string, number][]; y: number; size: number; color?: string; weight?: number; family?: string}> =
  ({t, words, y, size, color = INK, weight = 700, family = DISP}) => (
    <div style={{position: 'absolute', left: 0, width: CX * 2, top: y, display: 'flex', justifyContent: 'center', gap: size * 0.26, fontFamily: family, fontWeight: weight, fontSize: size,
      lineHeight: 1.1, letterSpacing: '-0.02em', color, whiteSpace: 'nowrap', textShadow: shadowTxt}}>
      {words.map(([w, at]) => {
        const a = k(t, at, at + 0.45);
        return <span key={w + at} style={{opacity: a, filter: a < 1 ? `blur(${(1 - a) * 14}px)` : undefined, transform: `translateY(${(1 - a) * 22}px)`, display: 'inline-block'}}>{w}</span>;
      })}
    </div>
  );
const Big: React.FC<{t: number; at: number; text: string; y: number; size: number; color?: string; squeeze?: number}> = ({t, at, text, y, size, color = INK, squeeze = 0.9}) => {
  const a = k(t, at, at + 0.35), g = jit(t, at);
  if (a <= 0) return null;
  return (
    <div style={{position: 'absolute', left: 0, width: CX * 2, top: y, textAlign: 'center', fontFamily: DISP, fontWeight: 800, fontSize: size, lineHeight: 1, letterSpacing: '-0.035em',
      color, opacity: a, transform: `scaleX(${squeeze}) translateX(${g}px)`, filter: a < 1 ? `blur(${(1 - a) * 16}px)` : undefined, whiteSpace: 'nowrap',
      textShadow: `${g * 0.7}px 0 0 ${rgba(IND2, 0.9)}, ${-g * 0.7}px 0 0 ${rgba(OR, 0.9)}, 0 6px 0 rgba(0,0,0,.4), 0 0 70px ${rgba(color === OR ? OR : IND, 0.35)}`}}>{text}</div>
  );
};
// Стекло PRISM: полупрозрачная призма, радужно-индиговый блик по краю, торец снизу.
const Glass: React.FC<{x: number; y: number; w: number; h: number; r?: number; style?: React.CSSProperties; children?: React.ReactNode; tint?: string}> =
  ({x, y, w, h, r = 40, style, children, tint = IND}) => (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, ...style}}>
      <div style={{position: 'absolute', left: 0, top: 14, width: w, height: h, borderRadius: r, background: 'rgba(5,4,16,.6)', boxShadow: '0 40px 90px rgba(0,0,0,.55)'}} />
      <div style={{position: 'absolute', inset: 0, borderRadius: r, overflow: 'hidden',
        background: `linear-gradient(160deg, ${rgba(tint, 0.34)}, rgba(20,18,40,.72) 45%, rgba(14,12,30,.78) 70%, ${rgba(OR, 0.14)})`,
        boxShadow: `inset 0 2px 0 rgba(255,255,255,.34), inset 0 0 0 1.5px ${rgba(IND2, 0.35)}, inset 0 -16px 34px rgba(0,0,0,.35)`}}>
        <div style={{position: 'absolute', left: -w * 0.2, top: -h * 0.6, width: w * 0.7, height: h * 1.4, transform: 'rotate(18deg)', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.07), transparent)'}} />
        {children}
      </div>
    </div>
  );
const Pill: React.FC<{t: number; at: number; out?: number; label: string; size?: number; color?: string; ink?: string; family?: string}> =
  ({t, at, out, label, size = 50, color = OR, ink = '#2A0E02', family = SANS}) => {
    const a = k(t, at, at + 0.4, E.pop), o = k(t, at, at + 0.15) * (out === undefined ? 1 : 1 - k(t, out, out + 0.2));
    if (o <= 0) return null;
    return (
      <div style={{display: 'inline-flex', alignItems: 'center', padding: `${size * 0.42}px ${size * 0.72}px`, borderRadius: 999, background: color,
        boxShadow: `0 0 44px ${rgba(color, 0.5)}, inset 0 3px 0 rgba(255,255,255,.45), 0 14px 30px rgba(0,0,0,.35)`, opacity: o, transform: `scale(${0.6 + 0.4 * a})`,
        fontFamily: family, fontWeight: 700, fontSize: size, lineHeight: 1, color: ink, whiteSpace: 'nowrap'}}>{label}</div>
    );
  };
const Row: React.FC<{y: number; children: React.ReactNode}> = ({y, children}) => (
  <div style={{position: 'absolute', left: 0, top: y, width: CX * 2, display: 'flex', justifyContent: 'center', gap: 18}}>{children}</div>
);
const Mark: React.FC<{name: string; size: number}> = ({name, size}) =>
  name === 'firecrawl' ? <Img src={staticFile('brand/firecrawl.png')} style={{width: size, height: size, objectFit: 'contain', maxWidth: 'none'}} /> : <Logo name={name} size={size} />;
const Tile: React.FC<{name: string; size: number; style?: React.CSSProperties; glow?: string}> = ({name, size, style, glow = IND}) => (
  <div style={{width: size, height: size, borderRadius: size * 0.27, background: name === 'composio' ? 'linear-gradient(180deg, #1E1B33, #0B0A18)' : 'linear-gradient(180deg, #FFFFFF, #ECEBF4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: `0 ${size * 0.12}px ${size * 0.3}px rgba(0,0,0,.5), 0 0 ${size * 0.35}px ${rgba(glow, 0.45)}, inset 0 -5px 0 rgba(0,0,0,.08)`, ...style}}>
    <Mark name={name === 'composio' ? 'composio-mark' : name} size={size * 0.6} />
  </div>
);
const LogoChip: React.FC<{t: number; at: number; name: string; label: string; n: number}> = ({t, at, name, label, n}) => {
  const a = sp(t, at, FPS27, 13, 160);
  if (a <= 0) return null;
  return (
    <div style={{position: 'absolute', left: 0, width: CX * 2, top: 300, display: 'flex', justifyContent: 'center', opacity: Math.min(1, a * 1.5), transform: `translateY(${(1 - a) * 40}px)`}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 22, padding: '16px 36px 16px 16px', borderRadius: 999, background: 'rgba(16,14,34,.85)',
        boxShadow: `inset 0 0 0 2px ${rgba(OR, 0.55)}, 0 16px 40px rgba(0,0,0,.5)`}}>
        <Tile name={name} size={84} glow={OR} />
        <span style={{fontFamily: MONO, fontWeight: 700, fontSize: 40, color: OR}}>{n}/4</span>
        <span style={{fontFamily: DISP, fontWeight: 800, fontSize: 64, color: INK}}>{label}</span>
      </div>
    </div>
  );
};
const Drift: React.FC<{t: number; depth: number; ph: number; children: React.ReactNode; style?: React.CSSProperties}> = ({t, depth, ph, children, style}) => (
  <div style={{position: 'absolute', transform: `translate(${Math.sin(t * (0.35 + depth * 0.4) + ph) * 18 * depth}px, ${Math.cos(t * (0.3 + depth * 0.35) + ph * 1.3) * 12 * depth}px)`, ...style}}>{children}</div>
);
const Screen: React.FC<{t: number; fps: number; clips: [string, number, number][]; x: number; y: number; w: number; h: number; at: number}> = ({t, fps, clips, x, y, w, h, at}) => {
  const a = sp(t, at, fps, 15, 130);
  if (a <= 0) return null;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: Math.min(1, a * 1.5), transform: `translateY(${(1 - a) * 120}px) scale(${0.9 + 0.1 * a})`}}>
      <Glass x={0} y={0} w={w} h={h} r={36}>
        <div style={{position: 'absolute', left: 12, top: 12, width: w - 24, height: h - 24, borderRadius: 26, overflow: 'hidden', background: '#FFFFFF'}}>
          {clips.map(([src, from, to], i) => (
            <Sequence key={src} from={Math.round(from * fps)} durationInFrames={Math.max(1, Math.round((to - from) * fps))}>
              <AbsoluteFill style={{opacity: i === 0 ? 1 : k(t, from, from + 0.15)}}>
                <Video src={staticFile(`r27/${src}.mp4`)} muted objectFit="cover" style={{width: w - 24, height: h - 24}} />
              </AbsoluteFill>
            </Sequence>
          ))}
        </div>
      </Glass>
    </div>
  );
};

// ——— Фоны: индиго и оранжевый, у каждого блока своя структура ———
const Stars: React.FC<{t: number; seed: string; n: number; vx?: number; vy?: number; color?: string}> = ({t, seed, n, vx = 0, vy = 0, color = '#FFFFFF'}) => {
  const items: React.ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const rr = 1 + 2.4 * Math.pow(random(`${seed}r${i}`), 2.4), d = 0.4 + rr / 3.4;
    const x = (((random(`${seed}x${i}`) * W + vx * t * d) % W) + W) % W, y = (((random(`${seed}y${i}`) * SEAM + vy * t * d) % SEAM) + SEAM) % SEAM;
    items.push(<circle key={i} cx={x} cy={y} r={rr} fill={color} opacity={0.3 + 0.5 * (0.5 + 0.5 * Math.sin(t * 2 + i))} />);
  }
  return <svg width={W} height={SEAM} style={{position: 'absolute', left: 0, top: 0}}>{items}</svg>;
};
const Glow: React.FC<{x: number; y: number; w: number; h?: number; color: string; a: number; rot?: number}> = ({x, y, w, h = w, color, a, rot = 0}) => (
  <div style={{position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, borderRadius: '50%', transform: `rotate(${rot}deg)`,
    background: `radial-gradient(closest-side, ${rgba(color, a)}, ${rgba(color, a * 0.35)} 45%, ${rgba(color, 0)})`}} />
);
const Base: React.FC<{top?: string; bottom?: string; children?: React.ReactNode}> = ({top = '#07061A', bottom = '#1A1450', children}) => (
  <AbsoluteFill style={{background: `linear-gradient(180deg, ${top} 0%, ${bottom} 100%)`, overflow: 'hidden'}}>{children}</AbsoluteFill>
);
// 0. Горизонт: оранжевый свет поднимается от шва.
const BgHorizon: React.FC<{t: number}> = ({t}) => (
  <Base><Stars t={t} seed="a" n={90} vx={-6} /><Glow x={CX} y={SEAM} w={2200} h={700} color={OR} a={0.42} /><Glow x={1100} y={380} w={1000} h={700} color={IND} a={0.3} /></Base>
);
// 1. Перспективная сетка и четыре столба света (кристалл PRISM).
const BgGrid: React.FC<{t: number}> = ({t}) => {
  const lines: React.ReactNode[] = [];
  for (let i = -12; i <= 12; i++) lines.push(<line key={`v${i}`} x1={CX + i * 40} y1={760} x2={CX + i * 260} y2={SEAM} stroke={rgba(IND2, 0.35)} strokeWidth={2} />);
  for (let j = 0; j < 9; j++) { const y = 760 + Math.pow((j + ((t * 0.6) % 1)) / 9, 2) * 520; lines.push(<line key={`h${j}`} x1={0} x2={W} y1={y} y2={y} stroke={rgba(IND2, 0.28)} strokeWidth={2} />); }
  return (
    <Base top="#060516" bottom="#141046">
      <svg width={W} height={SEAM} style={{position: 'absolute', left: 0, top: 0}}>{lines}</svg>
      {[0, 1, 2, 3].map((i) => <div key={i} style={{position: 'absolute', left: 250 + i * 270, top: 0, width: 90, height: 900, background: `linear-gradient(180deg, transparent, ${rgba(i % 2 ? OR : IND2, 0.16)}, transparent)`,
        filter: 'blur(10px)', opacity: 0.6 + 0.4 * Math.sin(t * 1.5 + i)}} />)}
      <Glow x={CX} y={700} w={1400} h={500} color={IND} a={0.3} />
    </Base>
  );
};
// 2. Свет окна: мягкий прямоугольный засвет.
const BgWindow: React.FC<{t: number}> = ({t}) => (
  <Base top="#08071C" bottom="#1C1650"><Stars t={t} seed="w" n={60} vy={4} /><Glow x={CX} y={700} w={1500} h={1000} color={IND2} a={0.26} /><Glow x={250} y={1150} w={900} h={400} color={OR} a={0.2} /></Base>
);
// 3. Луч поиска (Perplexity): прожектор вращается из-за края.
const BgBeam: React.FC<{t: number}> = ({t}) => (
  <Base top="#050414" bottom="#16114A">
    <Stars t={t} seed="b" n={80} vx={5} />
    <div style={{position: 'absolute', left: -600, top: -900, width: 2600, height: 2600, transformOrigin: '1300px 1300px', transform: `rotate(${-20 + Math.sin(t * 0.5) * 18}deg)`,
      background: `conic-gradient(from 150deg at 50% 50%, transparent 0deg, ${rgba(IND2, 0.2)} 12deg, transparent 28deg)`}} />
    <Glow x={1250} y={250} w={700} color={IND2} a={0.3} />
  </Base>
);
// 4. Жар (Firecrawl): оранжевые облака и искры.
const BgHeat: React.FC<{t: number}> = ({t}) => {
  const sparks: React.ReactNode[] = [];
  for (let i = 0; i < 60; i++) {
    const v = 50 + random(`hs${i}`) * 120, y = ((random(`hy${i}`) * SEAM - t * v) % SEAM + SEAM) % SEAM, x = random(`hx${i}`) * W + Math.sin(t + i) * 20, s = 1.5 + random(`hr${i}`) * 4;
    sparks.push(<circle key={i} cx={x} cy={y} r={s} fill={i % 3 ? OR : OR2} opacity={0.4 + 0.6 * Math.abs(Math.sin(t * 5 + i))} />);
  }
  return (
    <Base top="#0D0508" bottom="#2A0F14">
      <Glow x={300 + Math.sin(t * 0.4) * 60} y={900} w={1500} h={900} color={OR} a={0.34} rot={15} />
      <Glow x={1150} y={350} w={1100} h={800} color={IND} a={0.22} rot={-20} />
      <svg width={W} height={SEAM} style={{position: 'absolute', left: 0, top: 0}}>{sparks}</svg>
    </Base>
  );
};
// 5. Сканирование (Playwright): горизонтальные строки бегут вниз.
const BgScan: React.FC<{t: number}> = ({t}) => (
  <Base top="#060518" bottom="#171248">
    {Array.from({length: 26}, (_, i) => <div key={i} style={{position: 'absolute', left: 0, width: W, top: ((i * 52 + t * 90) % 1352) - 60, height: 2, background: rgba(IND2, 0.12)}} />)}
    <div style={{position: 'absolute', left: 0, width: W, top: ((t * 420) % 1500) - 100, height: 90, background: `linear-gradient(180deg, transparent, ${rgba(OR, 0.18)}, transparent)`}} />
    <Glow x={CX} y={650} w={1400} h={900} color={IND} a={0.24} />
  </Base>
);
// 6. Созвездие-хаб (Composio): тонкие орбиты и узлы.
const BgHub: React.FC<{t: number}> = ({t}) => (
  <Base top="#050416" bottom="#130F42">
    <Stars t={t} seed="h" n={110} vx={-4} />
    <svg width={W} height={SEAM} style={{position: 'absolute', left: 0, top: 0}}>
      {[260, 400, 560, 720].map((r, i) => <ellipse key={r} cx={CX} cy={700} rx={r} ry={r * 0.42} fill="none" stroke={rgba(i % 2 ? OR : IND2, 0.22)} strokeWidth={2} strokeDasharray="8 14" strokeDashoffset={-t * 30 * (i + 1)} />)}
    </svg>
    <Glow x={CX} y={700} w={1300} h={800} color={IND} a={0.3} />
  </Base>
);
// 7. Финал: индиго перетекает в оранжевое сияние.
const BgBloom: React.FC<{t: number}> = ({t}) => (
  <Base top="#0A0820" bottom="#2B1330">
    <Stars t={t} seed="f" n={90} vy={-6} />
    <Glow x={CX + Math.sin(t) * 60} y={900} w={1800} h={1000} color={OR} a={0.32} />
    <Glow x={CX} y={350} w={1400} h={700} color={IND} a={0.32} />
  </Base>
);

// ——— Сквозной якорь: панель «коннекторы Claude» на 4 ячейки ———
const CONNECTORS: [string, number][] = [['perplexity', 14.89], ['firecrawl', 26.02], ['playwright', 37.37], ['composio', 45.71]];
const SlotPanel: React.FC<{t: number; x: number; y: number; cell: number; open?: number}> = ({t, x, y, cell, open = 1}) => {
  const gap = cell * 0.18, w = cell * 4 + gap * 3 + cell * 0.5;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w * open + cell * 1.4 * (1 - open), height: cell * 1.5}}>
      <Glass x={0} y={0} w={w * open + cell * 1.4 * (1 - open)} h={cell * 1.5} r={cell * 0.4}>
        <div style={{position: 'absolute', left: cell * 0.25, top: cell * 0.25, display: 'flex', gap}}>
          {CONNECTORS.map(([name, at], i) => {
            const f = sp(t, at, FPS27, 12, 170), show = open > 0.2 + i * 0.18 ? 1 : 0;
            return (
              <div key={name} style={{width: cell, height: cell, borderRadius: cell * 0.26, opacity: show, background: f > 0 ? 'transparent' : 'rgba(255,255,255,.06)',
                boxShadow: f > 0 ? 'none' : `inset 0 0 0 2px ${rgba(IND2, 0.35)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative'}}>
                {f > 0 ? <Tile name={name} size={cell} glow={OR} style={{transform: `scale(${0.4 + 0.6 * f})`}} /> : <span style={{fontFamily: MONO, fontWeight: 700, fontSize: cell * 0.36, color: DIM}}>{i + 1}</span>}
              </div>
            );
          })}
        </div>
      </Glass>
    </div>
  );
};
const Corner: React.FC<{t: number}> = ({t}) => <SlotPanel t={t} x={LX} y={170} cell={64} />;

// ——— Сцены ———
// 0. «Если у твоего Claude нет ни одного коннектора, ты платишь 20 долларов в месяц за очень умный калькулятор»
const SceneHook: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const tile = sp(t, 0.25, fps, 13, 140), morph = k(t, 4.4, 4.9, E.inOut), tag = sp(t, 2.65, fps, 12, 170);
  return (
    <AbsoluteFill>
      <BgHorizon t={t} />
      <WordLine t={t} y={300} size={78} words={[['ни', 0.96], ['одного', 1.1], ['коннектора', 1.4]]} />
      <div style={{position: 'absolute', left: CX - 190, top: 440, width: 380, height: 380, opacity: Math.min(1, tile * 1.5), transform: `scale(${0.7 + 0.3 * tile})`}}>
        <Glass x={0} y={0} w={380} h={380} r={90}>
          <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 1 - morph, transform: `scale(${1 - morph * 0.3})`}}>
            <div style={{width: 220, height: 220, borderRadius: 60, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><Logo name="claude" size={150} /></div>
          </div>
          <div style={{position: 'absolute', left: 60, top: 50, width: 260, height: 280, opacity: morph, transform: `scale(${0.7 + 0.3 * morph})`}}>
            <div style={{height: 70, borderRadius: 16, background: '#0B0A1E', boxShadow: `inset 0 0 0 2px ${rgba(OR, 0.5)}`, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 18,
              fontFamily: MONO, fontWeight: 700, fontSize: 46, color: OR}}>2+2</div>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 16}}>
              {Array.from({length: 12}, (_, i) => <div key={i} style={{height: 46, borderRadius: 12, background: i % 4 === 3 ? OR : 'rgba(255,255,255,.14)'}} />)}
            </div>
          </div>
        </Glass>
      </div>
      <div style={{position: 'absolute', left: 0, width: CX * 2, top: 856, display: 'flex', justifyContent: 'center', opacity: Math.min(1, tag * 1.5), transform: `translateY(${(1 - tag) * 40}px)`}}>
        <span style={{fontFamily: MONO, fontWeight: 700, fontSize: 46, color: DIM}}>0 коннекторов · </span>
        <span style={{marginLeft: 14, fontFamily: MONO, fontWeight: 700, fontSize: 46, color: OR}}>$20/мес</span>
      </div>
      <Big t={t} at={4.58} text="= калькулятор" y={950} size={104} color={OR} />
    </AbsoluteFill>
  );
};
// 1. «Я 4 года внедряю AI в бизнес, в год 4 подключения… перестаёт болтать и начинает работать. Каждая ставится за минуту»
const ScenePromise: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const open = k(t, 7.38, 8.1, E.inOut), strike = k(t, 9.66, 9.95, E.inOut);
  return (
    <AbsoluteFill>
      <BgGrid t={t} />
      <Row y={300}><Pill t={t} at={5.52} label="4 года внедряю ИИ в бизнес" size={44} color={IND} ink={INK} family={MONO} /></Row>
      <WordLine t={t} y={420} size={92} words={[['4', 7.38], ['подключения', 7.62]]} />
      <SlotPanel t={t} x={CX - (64 * 4 * 2.1 + 64 * 2.1 * 0.18 * 3 + 64 * 2.1 * 0.5) / 2} y={570} cell={134} open={open} />
      <div style={{position: 'absolute', left: 0, width: CX * 2, top: 820, display: 'flex', justifyContent: 'center', gap: 40, fontFamily: DISP, fontWeight: 800, fontSize: 76}}>
        <span style={{position: 'relative', color: DIM, opacity: k(t, 9.16, 9.5)}}>болтать
          <span style={{position: 'absolute', left: -8, top: '52%', height: 10, width: `${strike * 110}%`, borderRadius: 5, background: OR}} /></span>
        <span style={{color: OR, opacity: k(t, 10.06, 10.4), textShadow: `0 0 40px ${rgba(OR, 0.5)}`}}>→ работать</span>
      </div>
      <Row y={960}><Pill t={t} at={11.68} label="⏱ каждая за минуту" size={46} family={MONO} /></Row>
    </AbsoluteFill>
  );
};
// 2. «Настройки, коннектор, добавить»
const ScenePath: React.FC<{t: number; fps: number}> = ({t, fps}) => (
  <AbsoluteFill>
    <BgWindow t={t} />
    <Row y={290}>
      <Pill t={t} at={12.82} label="Настройки" size={40} color={IND} ink={INK} />
      <Pill t={t} at={13.35} label="› Коннекторы" size={40} color={IND} ink={INK} />
      <Pill t={t} at={13.9} label="› Добавить" size={40} />
    </Row>
    <Screen t={t} fps={fps} at={12.8} x={CX - 380} y={410} w={760} h={676} clips={[['scr-1-path', 12.8, 14.8]]} />
  </AbsoluteFill>
);
// 3. Perplexity
const ScenePerplexity: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const url = 'https://api.perplexity.ai/mcp', n = Math.round(url.length * k(t, 16.3, 17.3, lin)), stamp = k(t, 24.88, 25.1, E.pop);
  const chips: [string, number][] = [['цены конкурентов', 19.61], ['исследования', 20.64], ['новости', 21.45], ['все источники', 22.1]];
  return (
    <AbsoluteFill>
      <BgBeam t={t} />
      <Corner t={t} />
      <LogoChip t={t} at={14.89} name="perplexity" label="Perplexity" n={1} />
      <Screen t={t} fps={fps} at={15.1} x={LX} y={440} w={560} h={498} clips={[['scr-2a-dialog', 15.1, 16.9], ['scr-2b-url', 16.9, 19.4], ['scr-3-auth', 19.4, 21.4], ['scr-3-ok', 21.4, 25.8]]} />
      <div style={{position: 'absolute', left: LX, top: 960, fontFamily: MONO, fontWeight: 700, fontSize: 38, color: OR2, whiteSpace: 'nowrap', opacity: n > 0 ? 1 : 0}}>{url.slice(0, n)}</div>
      {chips.map(([c, at], i) => {
        const a = sp(t, at, fps, 13, 170);
        if (a <= 0) return null;
        return (
          <div key={c} style={{position: 'absolute', left: 740, top: 450 + i * 118, opacity: Math.min(1, a * 1.5), transform: `translateX(${(1 - a) * 80}px)`}}>
            <Glass x={0} y={0} w={412} h={96} r={30}>
              <div style={{position: 'absolute', left: 24, top: 0, height: 96, display: 'flex', alignItems: 'center', gap: 12, fontFamily: SANS, fontWeight: 700, fontSize: 33, color: INK, whiteSpace: 'nowrap'}}>
                <span style={{color: OR}}>●</span>{c}
              </div>
            </Glass>
          </div>
        );
      })}
      {stamp > 0 ? (
        <div style={{position: 'absolute', left: LX + 90, top: 610, padding: '18px 40px', border: `8px solid ${OR}`, borderRadius: 24, transform: `rotate(-10deg) scale(${1.6 - 0.6 * stamp})`, opacity: stamp,
          fontFamily: DISP, fontWeight: 800, fontSize: 90, color: OR, background: 'rgba(20,6,2,.75)', letterSpacing: '0.04em'}}>БЕЗ НЕГО ВРЁТ</div>
      ) : null}
    </AbsoluteFill>
  );
};
// 4. Firecrawl
const FIRE: [string, number][] = [['офферы', 29.44], ['цены', 29.8], ['структура', 30.16], ['тексты', 30.82]];
const SceneFirecrawl: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const url = 'https://сайт-конкурента.ru', n = Math.round(url.length * k(t, 27.09, 27.9, lin)), bar = sp(t, 26.9, fps, 14, 140);
  return (
    <AbsoluteFill>
      <BgHeat t={t} />
      <Corner t={t} />
      <LogoChip t={t} at={26.02} name="firecrawl" label="Firecrawl" n={2} />
      <div style={{position: 'absolute', left: LX, top: 440, opacity: Math.min(1, bar * 1.5), transform: `translateY(${(1 - bar) * 60}px)`}}>
        <Glass x={0} y={0} w={CW} h={110} r={55} tint={OR}>
          <div style={{position: 'absolute', left: 40, top: 0, height: 110, display: 'flex', alignItems: 'center', gap: 16, fontFamily: MONO, fontWeight: 700, fontSize: 42, color: INK, whiteSpace: 'nowrap'}}>
            <span style={{color: OR}}>⌕</span>{url.slice(0, n)}<span style={{opacity: n < url.length ? 1 : 0, color: OR}}>▍</span>
          </div>
        </Glass>
      </div>
      {FIRE.map(([c, at], i) => {
        const a = sp(t, at, fps, 12, 170), col = i % 2, row = Math.floor(i / 2);
        if (a <= 0) return null;
        return (
          <div key={c} style={{position: 'absolute', left: LX + col * 520, top: 600 + row * 200, opacity: Math.min(1, a * 1.5), transform: `translateY(${(1 - a) * -120}px) scale(${0.7 + 0.3 * a})`}}>
            <Glass x={0} y={0} w={488} h={172} r={34} tint={OR}>
              <div style={{position: 'absolute', left: 30, top: 26, fontFamily: MONO, fontWeight: 700, fontSize: 32, color: OR2}}>0{i + 1}</div>
              <div style={{position: 'absolute', left: 30, top: 74, fontFamily: DISP, fontWeight: 800, fontSize: 60, color: INK}}>{c}</div>
            </Glass>
          </div>
        );
      })}
      <Row y={1000}>
        <Pill t={t} at={33.14} out={34.3} label="⏱ сайт конкурента за минуты" size={42} family={MONO} />
      </Row>
      <Row y={1000}><Pill t={t} at={34.59} label="законно? да ✓" size={46} color={IND} ink={INK} /></Row>
    </AbsoluteFill>
  );
};
// 5. Playwright
const ScenePlaywright: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const win = sp(t, 38.45, fps, 14, 130), cx = k(t, 39.2, 39.5, E.inOut), fill1 = k(t, 39.93, 40.4, lin), fill2 = k(t, 40.4, 40.86, lin), send = k(t, 41.08, 41.3), face = sp(t, 42.36, fps, 12, 160);
  const cur = t < 39.5 ? [900, 900] : t < 40.9 ? [640, 760] : [520, 960];
  return (
    <AbsoluteFill>
      <BgScan t={t} />
      <Corner t={t} />
      <LogoChip t={t} at={37.37} name="playwright" label="Playwright" n={3} />
      <div style={{position: 'absolute', left: LX, top: 480, opacity: Math.min(1, win * 1.5), transform: `translateY(${(1 - win) * 100}px) scale(${0.9 + 0.1 * win})`}}>
        <Glass x={0} y={0} w={CW} h={600} r={36}>
          <div style={{position: 'absolute', left: 30, top: 24, display: 'flex', alignItems: 'center', gap: 12}}>
            {['#FF6159', '#FFBD2E', '#28C941'].map((c) => <span key={c} style={{width: 18, height: 18, borderRadius: '50%', background: c}} />)}
            <div style={{marginLeft: 14, width: 700, height: 50, borderRadius: 25, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', paddingLeft: 22, fontFamily: MONO, fontWeight: 600, fontSize: 32, color: DIM}}>твой-сайт.ru/заявка</div>
          </div>
          <div style={{position: 'absolute', left: 60, top: 130, fontFamily: DISP, fontWeight: 800, fontSize: 54, color: INK}}>Оставить заявку</div>
          {[['Имя', 'Анна', fill1], ['Телефон', '+7 777 123 45 67', fill2]].map(([label, val, f], i) => (
            <div key={label as string} style={{position: 'absolute', left: 60, top: 230 + i * 130, width: 880, height: 100, borderRadius: 22, background: 'rgba(255,255,255,.08)',
              boxShadow: `inset 0 0 0 2px ${rgba((f as number) > 0 ? OR : IND2, 0.5)}`, display: 'flex', alignItems: 'center', paddingLeft: 28, fontFamily: SANS, fontWeight: 700, fontSize: 42}}>
              <span style={{color: DIM, width: 230}}>{label as string}</span>
              <span style={{color: INK}}>{(val as string).slice(0, Math.round((val as string).length * (f as number)))}</span>
            </div>
          ))}
          <div style={{position: 'absolute', left: 60, top: 500, width: 880, height: 96, borderRadius: 48, background: send > 0 ? OR : rgba(OR, 0.35), display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: SANS, fontWeight: 800, fontSize: 44, color: '#2A0E02', transform: `scale(${t > 41.1 && t < 41.3 ? 0.96 : 1})`}}>{send > 0 ? '✓ Отправлено' : 'Отправить'}</div>
        </Glass>
        {win > 0.5 ? (
          <svg width={60} height={78} viewBox="0 0 70 90" style={{position: 'absolute', left: cur[0] + (1 - cx) * 0, top: cur[1] - 480, filter: 'drop-shadow(0 8px 14px rgba(0,0,0,.5))'}}>
            <path d="M 6 4 L 6 70 L 22 55 L 34 84 L 46 78 L 34 50 L 56 50 Z" fill="#FFFFFF" stroke="#101214" strokeWidth={4} strokeLinejoin="round" />
          </svg>
        ) : null}
      </div>
      {face > 0 ? (
        <div style={{position: 'absolute', left: 982, top: 280, opacity: Math.min(1, face * 1.5), transform: `scale(${0.6 + 0.4 * face})`}}>
          <Glass x={0} y={0} w={170} h={170} r={44} tint={OR}>
            <svg width={170} height={170} viewBox="0 0 100 100" style={{position: 'absolute', left: 0, top: 0}}>
              <path d="M 22 36 V 26 a 4 4 0 0 1 4 -4 H 36 M 64 22 H 74 a 4 4 0 0 1 4 4 V 36 M 78 64 V 74 a 4 4 0 0 1 -4 4 H 64 M 36 78 H 26 a 4 4 0 0 1 -4 -4 V 64" fill="none" stroke={OR} strokeWidth={4} strokeLinecap="round" />
              <circle cx={40} cy={44} r={3} fill={INK} /><circle cx={60} cy={44} r={3} fill={INK} /><path d="M 40 60 Q 50 68 60 60" fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />
            </svg>
          </Glass>
        </div>
      ) : null}
      <Row y={1000}><Pill t={t} at={43.54} label="тестировщики, сори" size={44} /></Row>
    </AbsoluteFill>
  );
};
// 6. Composio
const APPS: [string, string, number][] = [['notion', 'Notion', 49.07], ['instagram', 'Instagram', 49.63], ['tiktok', 'TikTok', 50.4], ['youtube', 'YouTube', 51.0], ['gmail', 'Почта', 51.3],
  ['googlecalendar', 'Календарь', 51.68], ['crm', 'CRM', 52.18]];
const ACTIONS: [string, number][] = [['ставит задачи', 54.53], ['пишет письма', 55.44], ['двигает сделки', 56.22]];
const SceneComposio: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const hub = sp(t, 45.9, fps, 12, 130), merge = k(t, 58.35, 59.6, E.inOut), cx = CX, cy = 650;
  return (
    <AbsoluteFill>
      <BgHub t={t} />
      <Corner t={t} />
      <LogoChip t={t} at={45.71} name="composio" label="Composio" n={4} />
      <Row y={420}><Pill t={t} at={46.44} out={48.8} label="👑 главный коннектор" size={42} color={IND} ink={INK} /></Row>
      {APPS.map(([name, label, at], i) => {
        const a = sp(t, at, fps, 12, 170);
        if (a <= 0) return null;
        const ang = (i / APPS.length) * Math.PI * 2 - Math.PI / 2 + t * 0.15, r = 380 * (1 - merge);
        const x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r * 0.45;
        return (
          <div key={name} style={{position: 'absolute', left: x - 60, top: y - 60, opacity: Math.min(1, a * 1.5) * (1 - merge * 0.9), transform: `scale(${0.5 + 0.5 * a})`}}>
            {name === 'crm' ? (
              <div style={{width: 120, height: 120, borderRadius: 32, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: DISP, fontWeight: 800, fontSize: 40, color: DARK,
                boxShadow: `0 14px 36px rgba(0,0,0,.5), 0 0 40px ${rgba(IND, 0.45)}`}}>CRM</div>
            ) : <Tile name={name} size={120} />}
            <div style={{position: 'absolute', left: -40, top: 128, width: 200, textAlign: 'center', fontFamily: SANS, fontWeight: 700, fontSize: 30, color: DIM}}>{label}</div>
          </div>
        );
      })}
      <div style={{position: 'absolute', left: cx - 110, top: cy - 110, opacity: Math.min(1, hub * 1.5), transform: `scale(${(0.6 + 0.4 * hub) * (1 + merge * 0.15)})`}}>
        <Tile name={merge > 0.5 ? 'claude' : 'composio'} size={220} glow={OR} />
      </div>
      <Big t={t} at={52.84} text="300+ приложений" y={1000} size={84} color={OR} />
      {ACTIONS.map(([a, at], i) => {
        const f = k(t, at, at + 0.9, E.inOut);
        if (f <= 0 || f >= 1 || t > 58.3) return null;
        return <div key={a} style={{position: 'absolute', left: 1000 - f * 350, top: 470 + i * 90 + f * (cy - 470 - i * 90), padding: '14px 26px', borderRadius: 999, background: OR, fontFamily: MONO, fontWeight: 700,
          fontSize: 36, color: '#2A0E02', opacity: 1 - f * 0.6, whiteSpace: 'nowrap', transform: `scale(${1 - f * 0.4})`}}>{a}</div>;
      })}
    </AbsoluteFill>
  );
};
// 7. «Половина AI-экспертов не знают, что такое коннектор. Теперь знаешь ты. Напиши MCP…»
const SceneCta: React.FC<{t: number; fps: number}> = ({t, fps}) => (
  <AbsoluteFill>
    <BgBloom t={t} />
    <WordLine t={t} y={300} size={70} words={[['что', 63.16], ['такое', 63.35], ['коннектор?', 63.71]]} color={DIM} />
    <Big t={t} at={64.71} text="ТЕПЕРЬ ЗНАЕШЬ" y={420} size={130} />
    <Big t={t} at={65.38} text="ТЫ" y={560} size={160} color={OR} />
    <SlotPanel t={t} x={CX - (100 * 4 + 100 * 0.18 * 3 + 50) / 2} y={760} cell={100} />
    <Row y={960}><Pill t={t} at={65.7} label="напиши «MCP» в комментариях" size={48} /></Row>
  </AbsoluteFill>
);

// ——— Раскладка по времени ———
type Tin = 'none' | 'blur' | 'whip' | 'zoom' | 'shard';
type Sc = {from: number; tin: Tin; render: (t: number, fps: number) => React.ReactNode};
const SCENES: Sc[] = [
  {from: 0, tin: 'none', render: (t, fps) => <SceneHook t={t} fps={fps} />},
  {from: 5.25, tin: 'shard', render: (t, fps) => <ScenePromise t={t} fps={fps} />},
  {from: 12.72, tin: 'blur', render: (t, fps) => <ScenePath t={t} fps={fps} />},
  {from: 14.6, tin: 'zoom', render: (t, fps) => <ScenePerplexity t={t} fps={fps} />},
  {from: 25.68, tin: 'whip', render: (t, fps) => <SceneFirecrawl t={t} fps={fps} />},
  {from: 37.0, tin: 'shard', render: (t, fps) => <ScenePlaywright t={t} fps={fps} />},
  {from: 45.12, tin: 'zoom', render: (t, fps) => <SceneComposio t={t} fps={fps} />},
  {from: 60.95, tin: 'blur', render: (t, fps) => <SceneCta t={t} fps={fps} />},
];
// Переход «грань призмы»: диагональная индиго-оранжевая грань проходит через верхнюю половину.
const Shard: React.FC<{p: number}> = ({p}) => (
  <div style={{position: 'absolute', left: 0, top: 0, width: W, height: SEAM, overflow: 'hidden', pointerEvents: 'none'}}>
    <div style={{position: 'absolute', left: -1800 + p * 3600, top: -400, width: 900, height: 2100, transform: 'rotate(22deg)',
      background: `linear-gradient(90deg, transparent, ${rgba(IND, 0.9)} 30%, ${rgba(OR, 0.95)} 55%, ${rgba(IND2, 0.9)} 75%, transparent)`, filter: 'blur(6px)'}} />
  </div>
);
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
      layers.push(layer(two.prev, {transform: `scale(${1 + p * 0.6})`, transformOrigin: `${CX}px 700px`, opacity: 1 - p}, 'p'));
      layers.push(layer(two.nxt, {transform: `scale(${0.86 + 0.14 * p})`, transformOrigin: `${CX}px 700px`, opacity: p}, 'n'));
    }
  } else {
    let f: string | undefined;
    if (next && next.tin === 'blur' && next.from - t < 0.18) f = `blur(${k(t, next.from - 0.18, next.from) * 24}px)`;
    if (cur.tin === 'blur' && t - cur.from < 0.24) f = `blur(${(1 - k(t, cur.from, cur.from + 0.24)) * 24}px)`;
    layers.push(layer(cur, {filter: f}, 'c'));
  }
  let shard: React.ReactNode = null, flash = 0;
  for (const sc of SCENES) {
    if (sc.tin === 'shard' && t > sc.from - 0.3 && t < sc.from + 0.3) shard = <Shard p={k(t, sc.from - 0.3, sc.from + 0.3, E.inOut)} />;
    if (sc.tin === 'blur') flash = Math.max(flash, k(t, sc.from - 0.18, sc.from, E.inOut) * (1 - k(t, sc.from, sc.from + 0.24, E.inOut)));
  }
  return <>{layers}{shard}{flash > 0 ? <div style={{position: 'absolute', left: 0, top: 0, width: W, height: SEAM, background: '#F2EEFF', opacity: flash * 0.85}} /> : null}</>;
};

// ——— Спикер: вся нижняя половина, лицо на ~1860 ———
const SpeakerHalf: React.FC = () => {
  const s = W / 1080, vh = 1920 * s, top = -620;
  return (
    <div style={{position: 'absolute', left: 0, top: SEAM, width: W, height: H - SEAM, overflow: 'hidden', background: '#000'}}>
      <Video src={staticFile('r27/speaker.mp4')} style={{position: 'absolute', left: 0, top, width: W, height: vh}} />
      <div style={{position: 'absolute', left: 0, top: 0, width: W, height: 160, background: 'linear-gradient(180deg, rgba(10,8,30,.75), transparent)'}} />
    </div>
  );
};

const SFX: [number, string, number][] = [
  [0.1, 'long-e', 0.14], [0.3, 'ui-01', 0.2], [1.12, 'ui-02', 0.16], [2.66, 'rubber-d', 0.2], [4.42, 'morph-c', 0.24], [4.6, 'shiver-c', 0.2],
  [4.98, 'swoosh-f', 0.28], [5.54, 'ui-03', 0.18], [7.4, 'switch-d', 0.2], [7.7, 'ui-04', 0.16], [9.68, 'zoom-c', 0.2], [10.08, 'flash-c', 0.2], [11.7, 'count-c', 0.2],
  [12.55, 'blur-c', 0.24], [12.84, 'ui-05', 0.18], [13.37, 'ui-06', 0.18], [13.92, 'ui-07', 0.2],
  [14.42, 'long-f', 0.2], [14.9, 'rubber-d', 0.2], [16.3, 'type-c', 0.16], [19.63, 'ui-01', 0.16], [20.66, 'ui-02', 0.16], [21.47, 'ui-03', 0.16], [22.12, 'ui-04', 0.16], [24.9, 'big-b', 0.22],
  [25.48, 'swoosh-g', 0.28], [26.04, 'rubber-d', 0.2], [27.1, 'type-c', 0.16], [29.46, 'ui-05', 0.18], [29.82, 'ui-06', 0.18], [30.18, 'ui-07', 0.18], [30.84, 'ui-01', 0.18], [33.16, 'count-c', 0.18], [34.61, 'switch-d', 0.2],
  [36.72, 'swoosh-f', 0.26], [37.39, 'rubber-d', 0.2], [38.47, 'ui-02', 0.18], [39.45, 'ui-03', 0.2], [39.95, 'type-c', 0.16], [41.1, 'ui-04', 0.22], [42.38, 'flash-c', 0.2], [43.56, 'ui-05', 0.2],
  [44.94, 'long-e', 0.2], [45.73, 'rubber-d', 0.2], [46.46, 'ui-06', 0.18], [49.09, 'ui-07', 0.16], [49.65, 'ui-01', 0.16], [50.42, 'ui-02', 0.16], [51.02, 'ui-03', 0.16], [51.32, 'ui-04', 0.16],
  [51.7, 'ui-05', 0.16], [52.2, 'ui-06', 0.16], [52.86, 'big-b', 0.2], [54.55, 'swoosh-g', 0.14], [55.46, 'swoosh-g', 0.14], [56.24, 'swoosh-g', 0.14], [58.4, 'morph-c', 0.22],
  [60.72, 'blur-c', 0.24], [64.73, 'flash-c', 0.22], [65.4, 'shiver-c', 0.2], [65.72, 'switch-d', 0.24],
];
const SFX_GAIN = 0.37;

export const Reel27: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  return (
    <AbsoluteFill style={{background: '#07061A'}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: W, height: SEAM, overflow: 'hidden'}}><Scenes t={t} fps={fps} /></div>
      <SpeakerHalf />
      <div style={{position: 'absolute', left: 0, top: SEAM - 3, width: W, height: 6, background: `linear-gradient(90deg, ${IND}, ${OR}, ${IND2})`, boxShadow: `0 0 30px ${rgba(OR, 0.6)}`}} />
      <Captions t={t} words={WORDS27} cx={CX} cy={1157} maxW={960} size={53.3} frameW={W} frameH={H} light={false} family={SANS} weight={700} />
      {SFX.map(([at, name, v], i) => (
        <Sequence key={i} from={Math.round(at * fps)} durationInFrames={Math.round(2.5 * fps)} layout="none">
          <Audio src={staticFile(`sfx/r27/${name}.wav`)} volume={v * SFX_GAIN} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
