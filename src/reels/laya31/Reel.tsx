import React from 'react';
import {AbsoluteFill, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio, Video} from '@remotion/media';
import {Captions} from '../../montage/Captions';
import {E, k} from '../../montage/parts';
import {Avatar, Bar, type Blob, BrandMask as Brand, Cap, type Cam, Check, Dot, glass, Ico, LensBlobs, LensGrid, type LensMove, LensVignette, Lines,
  makeCamera, Place, PrintTitle as Title, Ring, rise, Switch as Toggle, TONE, toScreen} from '../../kit/lens';
import {RecStub} from '../../kit/recStub';
import {WORDS31} from './words';

// Ролик 31 «Laya», v2 (автор курса, 27.09.2026): «в стиле Apple-презентации… капсулы, glassmorphism, белый фон с сеткой и
// эффектом рыбьего глаза, всё плавно анимировано, плавные переходы между кадрами». v1 с нарисованными предметами отклонён.
// Верх 60% — белый холст в клетку, по которому едет камера; холст и всё на нём проходят через линзу (центр без искажений,
// края сжаты и выгнуты). Главный элемент — стеклянная капсула, появляется ровно на своём слове. Низ 40% — спикер.
// Оранжевый только в кружках иконок и цветных пятнах, текст чёрный. Карта: patterns/reels/lens-laya/DIRECTION.md.
export const FPS31 = 60;
export const END31 = 48.0;

// Запись спикера (вертикальная 9:16, в образце 2160×3840) и голос: положить в public/work/<slug>/ и вписать путь. null: заглушка вместо лица и тишина.
const REC: string | null = null; // 'work/<slug>/speaker-4k.mp4'
const VOICE: string | null = null; // 'work/<slug>/voice.wav'

const W = 1440, H = 2560, TOP = 1240;
const BAND = {y: 1240, h: 1024, src: 640};
const SANS = 'SF Pro Display', SOYUZ = 'Soyuz Grotesk', MONO = 'JBM';
const INK = '#0E0F11', MINT = '#3DEDC3', MINT_D = '#0B9E7C', ORANGE = '#FF7A2F', PAPER = '#F7F8F6';
const lerp = (a: number, b: number, m: number) => a + (b - a) * m;
const cl = (v: number) => Math.max(0, Math.min(1, v));
const sp = (t: number, at: number, fps: number, damping = 16, stiffness = 140) =>
  t < at ? 0 : spring({frame: (t - at) * fps, fps, config: {damping, stiffness, mass: 1}});
const LW = (i: number) => WORDS31[i].start;
const count = (t: number, a: number, b: number, to: number, from = 0) => Math.round(from + (to - from) * k(t, a, b, E.out));

// ══════════ холст: станции и проезды камеры (механика — стиль 14 «ЛИНЗА», src/kit/lens.tsx) ══════════
const K = {
  k1a: [0, 0], k1b: [720, 0], k2: [2000, -150], k3: [3350, 0], k4: [3350, 1300], k5: [2000, 1450], k6: [650, 1300], k7: [650, 2600], k8: [2000, 2700],
} as const;
type KK = keyof typeof K;
// проезды камеры, каждый по фразе; z — лёгкий отъезд в середине пути
const MOVES: LensMove<KK>[] = [
  {a: 1.86, b: 3.15, from: 'k1a', to: 'k1b', z: 0.97},   // «её открытую альтернативу»
  {a: 6.15, b: 6.95, from: 'k1b', to: 'k2', z: 0.86},    // «Называется Лая»
  {a: 9.85, b: 10.6, from: 'k2', to: 'k3', z: 0.86},     // «а выбирает»
  {a: 16.7, b: 17.45, from: 'k3', to: 'k4', z: 0.86},    // «Никаких API»
  {a: 22.55, b: 23.3, from: 'k4', to: 'k5', z: 0.86},    // «Английская версия»
  {a: 30.35, b: 31.1, from: 'k5', to: 'k6', z: 0.86},    // «Честно»
  {a: 38.05, b: 38.8, from: 'k6', to: 'k7', z: 0.86},    // «Но если данные клиентов»
  {a: 42.75, b: 43.45, from: 'k7', to: 'k8', z: 0.86},   // «Напиши»
];
const camera = makeCamera(K, MOVES, 'k1a');
const BLOBS: Blob[] = [
] = [
  {x: 200, y: 150, r: 520, c: '61,237,195', a: 0.45}, {x: 900, y: -250, r: 420, c: '255,122,47', a: 0.28},
  {x: 1800, y: -50, r: 560, c: '61,237,195', a: 0.4}, {x: 3350, y: -300, r: 480, c: '255,122,47', a: 0.3}, {x: 3500, y: 250, r: 520, c: '61,237,195', a: 0.42},
  {x: 3200, y: 1300, r: 520, c: '61,237,195', a: 0.4}, {x: 3700, y: 1700, r: 420, c: '255,122,47', a: 0.26}, {x: 2100, y: 1450, r: 560, c: '61,237,195', a: 0.4},
  {x: 400, y: 1250, r: 460, c: '255,122,47', a: 0.28}, {x: 800, y: 1550, r: 520, c: '61,237,195', a: 0.4}, {x: 500, y: 2550, r: 560, c: '61,237,195', a: 0.45},
  {x: 2150, y: 2600, r: 520, c: '61,237,195', a: 0.42}, {x: 1800, y: 2950, r: 420, c: '255,122,47', a: 0.24},
];

// знак Laya (настоящая геометрия): дуга рисуется, точки закручиваются и сходятся в одну
const LAYA_DOTS: [number, number, number, number][] = [
  [48.213, 42.609, 2.782, 0.929], [49.456, 33.958, 2.527, 0.894], [46.696, 26.535, 2.291, 0.852], [41.336, 21.918, 2.067, 0.803], [35.242, 20.694, 1.852, 0.749],
  [30.173, 22.422, 1.642, 0.691], [27.294, 25.889, 1.438, 0.628], [26.902, 29.558, 1.239, 0.562], [28.43, 32.075, 1.043, 0.493], [30.702, 32.69, 0.85, 0.42],
];
const LayaMark: React.FC<{size: number; color?: string; draw?: number; dots?: number}> = ({size, color = MINT_D, draw = 1, dots = 1}) => (
  <svg width={size} height={size} viewBox="0 0 64 64" style={{overflow: 'visible', flex: 'none'}}>
    <path d="M 22.141 13.458 A 21.0 21.0 0 1 0 42.500 50.187" fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" opacity={0.95} pathLength={1} strokeDasharray={`${draw} 2`} />
    {LAYA_DOTS.map(([x, y, r, o], i) => { const a = cl(dots * 11 - i); return a > 0 ? <circle key={i} cx={x} cy={y} r={r * (0.4 + 0.6 * a)} fill={color} opacity={o * a} /> : null; })}
    {dots * 11 - 10 > 0 ? <circle cx={32} cy={32} r={2.35 * cl(dots * 11 - 10)} fill={color} /> : null}
  </svg>
);

// ══════════ содержимое станций (координаты станции + местные) ══════════
const Stations: React.FC<{t: number; fps: number; cam: Cam}> = ({t, fps, cam}) => {
  const at = (kk: KK, x: number, y: number) => ({x: K[kk][0] + x, y: K[kk][1] + y});
  const P: React.FC<{kk: KK; x: number; y: number; children: React.ReactNode}> = ({kk, x, y, children}) => { const q = at(kk, x, y); return <Place cam={cam} x={q.x} y={q.y}>{children}</Place>; };
  const S = (a: number, d = 16, s = 140) => sp(t, a - 0.08, fps, d, s);

  // 1a. хук: очередь за Jev (всё на месте с кадра 0)
  const queueShift = (t * 18) % 130;
  // 1b. открытая альтернатива, скачать, бесплатно
  const dl = k(t, LW(11), LW(14) + 0.3, E.inOut);
  // 2. знак и имя, маленькая модель, текст ↔ решение
  const markDraw = k(t, 6.55, 7.05, E.inOut), markDots = k(t, 6.95, LW(18) + 0.2, E.out), sizes = S(LW(19)) * (1 - k(t, LW(23) - 0.3, LW(23) - 0.05));
  const txtOff = k(t, LW(24), LW(25) + 0.2, E.inOut), decOn = k(t, LW(27) - 0.05, LW(27) + 0.3, E.inOut);
  // 3. развилки
  const prob = k(t, LW(40) - 0.05, LW(42) + 0.35, E.out), pick = k(t, LW(37) - 0.1, LW(37) + 0.3, E.inOut);
  // 5. числа
  const params = count(t, LW(58) - 0.05, LW(60), 421);
  // 6. честно
  const ex = [0, 1, 2].map((i) => k(t, LW(77) + i * 0.45, LW(77) + i * 0.45 + 0.55, E.inOut));
  const acc = 0.5 * k(t, LW(73) - 0.1, LW(74) + 0.2, E.inOut) + ex.reduce((s, e) => s + 0.12 * e, 0);
  // 7. локально
  const arrow = k(t, LW(95) - 0.1, LW(95) + 0.35, E.inOut), block = k(t, LW(96) - 0.05, LW(96) + 0.25, E.out);
  // 8. призыв
  const typed = Math.min(3, Math.floor(k(t, LW(102) - 0.05, LW(102) + 0.25, (v) => v) * 3.99)), flyL = k(t, LW(107) - 0.1, LW(109) + 0.05, E.inOut);
  const inst = k(t, LW(111) - 0.1, LW(113) + 0.45, E.inOut);

  return (
    <>
      {/* ——— 1a. «Пока все стоят в очереди за Jev» ——— */}
      <P kk="k1a" x={0} y={-430}><Title t={t} size={190} words={[{s: 'Очередь', at: -1}, {s: 'за', at: -1}, {s: 'Jev', at: -1}]} /></P>
      <P kk="k1a" x={0} y={-220}><Cap a={1} h={150} dot={<Dot tone="ink" s={112}><Brand name="typesafe" w={54} /></Dot>} label="Jev"
        right={<div style={{...glass(76), gap: 12, padding: '0 22px 0 12px', background: 'rgba(14,15,17,.06)', border: 'none', boxShadow: 'none', backdropFilter: 'none'}}><Ico name="hourglass" s={40} c="#5F6368" /><span style={{fontFamily: SANS, fontWeight: 600, fontSize: 34, color: '#5F6368'}}>ожидание</span></div>} /></P>
      {[0, 1, 2, 3].map((i) => (
        <P key={i} kk="k1a" x={0} y={-30 + i * 150 - queueShift * 0.15}>
          <div style={{opacity: 1 - i * 0.2}}><Cap a={1} h={120} minW={640} dot={<Avatar c={['#F4B400', '#34A853', '#EA4335', '#8E8E93'][i]} l={'АМКД'[i]} s={90} />} label={<Lines w={250} />}
            right={<span style={{fontFamily: SOYUZ, fontWeight: 700, fontSize: 40, color: '#8E8E93'}}>#{(i + 2) * 1287}</span>} /></div>
        </P>
      ))}
      {/* ——— 1b. «её открытую альтернативу можно скачать… бесплатно» ——— */}
      <P kk="k1b" x={40} y={-330}><Cap in="left" a={S(LW(8))} dot={<Dot tone="mint"><Ico name="unlock" s={48} c="#05231D" /></Dot>} label="Открытая модель" /></P>
      <P kk="k1b" x={-20} y={-130}><Cap in="right" a={S(LW(9) + 0.1)} dot={<Dot tone="ink"><Brand name="github" w={50} /></Dot>} label="GitHub" right={<span style={{fontFamily: SOYUZ, fontWeight: 700, fontSize: 46, color: INK}}>26k ★</span>} /></P>
      <P kk="k1b" x={30} y={75}><Cap in="left" a={S(LW(11))} minW={660} dot={<Dot tone="mint"><Ico name="down" s={48} c="#05231D" /></Dot>} label="Скачать"
        right={dl < 1 ? <Bar p={dl} w={170} /> : <Check a={sp(t, LW(14) + 0.3, fps, 10, 200)} s={64} />} /></P>
      <P kk="k1b" x={-10} y={285}><Cap in="pop" a={sp(t, LW(16) - 0.08, fps, 11, 170)} dot={<Dot tone="white"><span style={{fontFamily: SOYUZ, fontWeight: 700, fontSize: 44, color: INK}}>$</span></Dot>} label="Бесплатно"
        right={<span style={{fontFamily: SOYUZ, fontWeight: 700, fontSize: 64, color: MINT_D}}>$0</span>} /></P>

      {/* ——— 2. «Называется Лая. Это маленькая модель, которая не пишет текст, а выбирает» ——— */}
      <P kk="k2" x={-110} y={-300}>
        <div style={{display: 'flex', alignItems: 'center', gap: 40}}>
          <LayaMark size={280} draw={markDraw} dots={markDots} />
          <div style={{opacity: k(t, LW(18) - 0.1, LW(18) + 0.25), transform: `translateX(${(1 - k(t, LW(18) - 0.1, LW(18) + 0.3, E.out)) * 40}px)`}}>
            <div style={{fontFamily: SANS, fontWeight: 600, fontSize: 240, color: INK, letterSpacing: '-0.03em', lineHeight: 1}}>laya</div>
          </div>
        </div>
      </P>
      <P kk="k2" x={0} y={-70}><Cap in="flip" a={S(LW(18) + 0.35)} h={100} label={<span style={{letterSpacing: '0.16em', fontSize: 36, color: '#5F6368'}}>DECISIONS, NOT TEXT</span>} dot={<Dot tone="mint" s={66}><LayaMark size={40} color="#05231D" /></Dot>} /></P>
      {sizes > 0 ? (
        <>
          <P kk="k2" x={-190} y={250}><div style={{...rise(sizes), width: 420, height: 420, borderRadius: 210, background: 'rgba(255,255,255,.5)', border: '2px solid rgba(255,255,255,.95)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 24px 60px rgba(14,15,17,.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontWeight: 700, fontSize: 90, color: 'rgba(14,15,17,.35)'}}>LLM</div></P>
          <P kk="k2" x={170} y={330}><div style={{...rise(S(LW(20))), width: 130, height: 130, borderRadius: 65, background: TONE.mint.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 10px 30px ${TONE.mint.glow}`}}>
            <LayaMark size={84} color="#05231D" /></div></P>
        </>
      ) : null}
      <P kk="k2" x={0} y={170}><Cap in="right" a={S(LW(23))} minW={640} dot={<Dot tone="grey"><Ico name="text" s={46} c="#5F6368" /></Dot>} label="Текст" dim={txtOff} right={<Toggle on={1 - txtOff} />} /></P>
      <P kk="k2" x={0} y={360}><Cap in="right" a={S(LW(26))} minW={640} dot={<Dot tone="mint"><Ico name="check" s={48} c="#05231D" w={3} /></Dot>} label="Решение" right={<Toggle on={decOn} />} /></P>

      {/* ——— 3. «спам или нет, срочно или нет, какому менеджеру… вероятность» ——— */}
      <P kk="k3" x={0} y={-430}><Cap in="drop" a={S(10.25)} dot={<Dot tone="orange"><Ico name="mail" s={46} c="#FFFFFF" /></Dot>} label="Новая заявка" right={<Lines w={150} />} /></P>
      <svg width={W} height={TOP} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        {[{y: -210, a: LW(28)}, {y: 20, a: LW(32)}, {y: 250, a: LW(35)}].map((r, i) => {
          const p = k(t, r.a - 0.3, r.a, E.inOut);
          if (p <= 0) return null;
          const A = toScreen(cam, K.k3[0] - 380, K.k3[1] - 360), B = toScreen(cam, K.k3[0] - 380, K.k3[1] + r.y), C = toScreen(cam, K.k3[0] - 350, K.k3[1] + r.y);
          return <path key={i} d={`M${A.x} ${A.y} L${lerp(A.x, B.x, p)} ${lerp(A.y, B.y, p)} L${lerp(B.x, C.x, p)} ${lerp(B.y, C.y, p)}`} fill="none" stroke={MINT_D} strokeWidth={5} strokeDasharray="4 14" strokeLinecap="round" strokeDashoffset={-t * 40} />;
        })}
      </svg>
      <P kk="k3" x={30} y={-210}><Cap in="flip" a={S(LW(28))} h={156} minW={740} dot={<Dot tone="ink"><Ico name="shield" s={46} c="#FFFFFF" /></Dot>} label="Спам"
        right={<div style={{display: 'flex', alignItems: 'center', gap: 20}}><Toggle on={1 - k(t, LW(31) - 0.1, LW(31) + 0.2, E.inOut)} />{prob > 0 ? <Ring p={prob} pct={97} /> : null}</div>} /></P>
      <P kk="k3" x={30} y={20}><Cap in="flip" a={S(LW(32))} h={156} minW={740} dot={<Dot tone="orange"><Ico name="bolt" s={46} c="#FFFFFF" /></Dot>} label="Срочно"
        right={<div style={{display: 'flex', alignItems: 'center', gap: 20}}><Toggle on={k(t, LW(34) - 0.1, LW(34) + 0.2, E.inOut)} />{prob > 0 ? <Ring p={prob} pct={84} /> : null}</div>} /></P>
      <P kk="k3" x={30} y={250}><Cap in="flip" a={S(LW(35))} h={156} minW={740} dot={<Dot tone="mint"><Ico name="user" s={46} c="#05231D" /></Dot>} label="Кому"
        right={<div style={{display: 'flex', alignItems: 'center', gap: 12}}>
          {['А', 'М', 'К'].map((l, j) => <div key={l} style={{opacity: j === 1 ? 1 : 1 - 0.65 * pick, transform: `scale(${j === 1 ? 1 + 0.18 * pick : 1})`, borderRadius: 40, boxShadow: j === 1 ? `0 0 0 ${5 * pick}px ${MINT}` : undefined}}>
            <Avatar c={['#F4B400', MINT_D, '#8E8E93'][j]} l={l} s={62} /></div>)}
          {prob > 0 ? <div style={{marginLeft: 8}}><Ring p={prob} pct={91} /></div> : null}
        </div>} /></P>

      {/* ——— 4. «Никаких API и подписок, веса открыты, лицензия разрешает бизнес, ставится одной командой» ——— */}
      <P kk="k4" x={-255} y={-390}><Cap in="pop" a={sp(t, LW(43) - 0.08, fps, 11, 170)} h={120} dot={<Dot tone="grey"><Ico name="key" s={46} c="#5F6368" /></Dot>} label="API-ключ" dim={k(t, LW(44), LW(44) + 0.3)} right={<Toggle on={1 - k(t, LW(44) - 0.05, LW(44) + 0.25, E.inOut)} s={0.85} />} /></P>
      <P kk="k4" x={255} y={-390}><Cap in="pop" a={sp(t, LW(43) + 0.02, fps, 11, 170)} h={120} dot={<Dot tone="grey"><Ico name="card" s={46} c="#5F6368" /></Dot>} label="Подписка" dim={k(t, LW(46), LW(46) + 0.3)} right={<Toggle on={1 - k(t, LW(46) - 0.05, LW(46) + 0.25, E.inOut)} s={0.85} />} /></P>
      <P kk="k4" x={0} y={-180}><Cap in="left" a={S(LW(47))} minW={660} dot={<Dot tone="mint"><Ico name="box" s={46} c="#05231D" /></Dot>} label="Веса открыты" right={<Check a={sp(t, LW(48), fps, 10, 200)} s={60} />} /></P>
      <P kk="k4" x={0} y={20}><Cap in="right" a={S(LW(49))} minW={660} dot={<Dot tone="ink"><Ico name="briefcase" s={46} c="#FFFFFF" /></Dot>} label="Apache 2.0" right={<Check a={sp(t, LW(51), fps, 10, 200)} s={60} />} /></P>
      <P kk="k4" x={0} y={240}><Cap a={S(LW(52))} h={160} minW={900} dot={<Dot tone="white" s={120}><Brand name="claude" w={62} color="#D97757" /></Dot>}
        label={<span style={{fontFamily: MONO, fontWeight: 700, fontSize: 50}}>{'pip install laya'.slice(0, Math.round(16 * k(t, LW(52) + 0.1, LW(53) + 0.3, (v) => v)))}</span>}
        right={<Check a={sp(t, LW(54), fps, 10, 200)} s={76} />} /></P>

      {/* ——— 5. «421 миллион параметров, 40 мс на видеокарте, мультиязычная ещё быстрее» ——— */}
      <P kk="k5" x={-320} y={-440}><Cap a={S(LW(55))} h={104} dot={<Dot tone="mint" s={80}><span style={{fontFamily: SANS, fontWeight: 800, fontSize: 28, color: '#05231D'}}>EN</span></Dot>} label="English" /></P>
      <P kk="k5" x={0} y={-220}>
        <div style={{...rise(S(LW(58) - 0.1)), display: 'flex', alignItems: 'baseline', gap: 26, fontFamily: SANS, fontWeight: 700, letterSpacing: '-0.04em', color: INK}}>
          <span style={{fontSize: 280, lineHeight: 1}}>{params}</span><span style={{fontSize: 120, color: 'rgba(14,15,17,.55)'}}>млн</span>
        </div>
      </P>
      <P kk="k5" x={0} y={80}><Cap in="left" a={S(LW(61))} minW={840} dot={<Dot tone="ink"><Ico name="chip" s={48} c="#FFFFFF" /></Dot>} label="Видеокарта"
        right={<div style={{display: 'flex', alignItems: 'center', gap: 18}}><Bar p={k(t, LW(65) - 0.1, LW(65) + 0.3, E.out) * 0.97} w={150} c={INK} /><span style={{fontFamily: SOYUZ, fontWeight: 700, fontSize: 58, color: INK, opacity: k(t, LW(65) - 0.1, LW(65) + 0.2)}}>40 мс</span></div>} /></P>
      <P kk="k5" x={0} y={290}><Cap in="right" a={S(LW(67))} minW={840} dot={<Dot tone="mint"><Ico name="globe" s={48} c="#05231D" /></Dot>} label="100+ языков"
        right={<div style={{display: 'flex', alignItems: 'center', gap: 18}}><Bar p={k(t, LW(68) - 0.1, LW(68) + 0.3, E.out) * 0.8} w={150} /><span style={{fontFamily: SOYUZ, fontWeight: 700, fontSize: 58, color: MINT_D, opacity: k(t, LW(68) - 0.1, LW(68) + 0.2)}}>33 мс</span></div>} /></P>

      {/* ——— 6. «Честно: из коробки точность средняя, дообучить на своих примерах… Jev пока сильнее» ——— */}
      <P kk="k6" x={0} y={-450}><Cap a={S(LW(70))} h={104} dot={<Dot tone="grey" s={80}><Ico name="info" s={40} c="#5F6368" /></Dot>} label="Честно" /></P>
      <P kk="k6" x={0} y={-270}><Cap in="flip" a={S(LW(72))} h={150} minW={900} dot={<Dot tone="ink" s={112}><Ico name="target" s={54} c="#FFFFFF" /></Dot>} label="Точность"
        right={<div style={{position: 'relative', width: 330, height: 30}}>
          <div style={{position: 'absolute', left: 0, top: 9, width: 330, height: 12, borderRadius: 6, background: 'rgba(14,15,17,.1)'}} />
          <div style={{position: 'absolute', left: 0, top: 9, width: 330 * acc, height: 12, borderRadius: 6, background: acc > 0.7 ? MINT : '#9AA0A6', boxShadow: acc > 0.7 ? `0 0 12px ${MINT}` : undefined}} />
          <div style={{position: 'absolute', left: 330 * acc - 22, top: -7, width: 44, height: 44, borderRadius: 22, background: '#FFFFFF', boxShadow: '0 4px 12px rgba(0,0,0,.25)'}} />
        </div>} /></P>
      {ex.map((e, i) => (e > 0 && e < 1 ? (
        <Place key={i} cam={cam} x={lerp(K.k6[0] - 560 + i * 60, K.k6[0] + 150, e)} y={lerp(K.k6[1] - 40 + i * 110, K.k6[1] - 270, e) - Math.sin(Math.PI * e) * 120}>
          <div style={{transform: `scale(${1 - 0.5 * e})`, opacity: 1 - cl((e - 0.8) / 0.2)}}><Cap a={1} h={96} dot={<Dot tone="mint" s={70}><Ico name="check" s={40} c="#05231D" w={3} /></Dot>} label="пример" /></div>
        </Place>
      ) : null))}
      {Array.from({length: 15}, (_, i) => {
        const a = sp(t, LW(85) - 0.1 + i * 0.05, fps, 14, 170), c = i % 5, r = Math.floor(i / 5);
        return a > 0 ? <P key={i} kk="k6" x={-400 + c * 200} y={-30 + r * 110}><div style={{...glass(80), ...rise(a), padding: '0 26px 0 12px', gap: 14}}>
          <div style={{width: 50, height: 50, borderRadius: 25, background: [TONE.mint.bg, TONE.orange.bg, TONE.grey.bg][(i * 7) % 3]}} /><div style={{width: 70, height: 14, borderRadius: 7, background: 'rgba(14,15,17,.2)'}} /></div></P> : null;
      })}
      <P kk="k6" x={0} y={300}><Cap in="left" a={S(LW(87))} minW={900} dot={<Dot tone="ink"><Brand name="typesafe" w={48} /></Dot>} label="Jev"
        right={<Bar p={0.9 * k(t, LW(87), LW(89) + 0.2, E.out)} w={420} c={INK} />} /></P>
      <P kk="k6" x={0} y={460}><Cap in="left" a={S(LW(87) + 0.12)} minW={900} dot={<Dot tone="mint"><LayaMark size={52} color="#05231D" /></Dot>} label="Laya"
        right={<Bar p={0.62 * k(t, LW(87) + 0.1, LW(89) + 0.3, E.out)} w={420} />} /></P>

      {/* ——— 7. «если данные клиентов нельзя отдавать наружу, это твой локальный вариант» ——— */}
      <P kk="k7" x={-60} y={-70}>
        <div style={{...rise(S(LW(90))), width: 900, height: 620, borderRadius: 70, background: 'linear-gradient(180deg, rgba(255,255,255,.55), rgba(255,255,255,.3))', border: '2px solid rgba(255,255,255,.95)',
          backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', boxShadow: '0 30px 80px rgba(14,15,17,.12), inset 0 2px 0 #FFFFFF', position: 'relative'}}>
          <div style={{position: 'absolute', left: 36, top: 30}}><Dot tone="ink" s={86}><Ico name="laptop" s={50} c="#FFFFFF" /></Dot></div>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{position: 'absolute', left: 160, top: 160 + i * 145}}>
              <Cap in="drop" a={S(LW(92) + i * 0.12)} h={118} minW={620} dot={<Avatar c={['#F4B400', '#34A853', '#EA4335'][i]} l={'ОВП'[i]} s={76} />} label={<Lines w={260} />} /></div>
          ))}
        </div>
      </P>
      <P kk="k7" x={330} y={-470}><Cap in="right" a={S(LW(94))} h={100} dot={<Dot tone="grey" s={76}><Ico name="cloud" s={44} c="#5F6368" /></Dot>} label="Облако" dim={block} /></P>
      {arrow > 0 ? (() => {
        const A = toScreen(cam, K.k7[0] + 280, K.k7[1] - 360), B = toScreen(cam, K.k7[0] + 330, K.k7[1] - 420), len = arrow * (1 - 0.6 * block);
        return <svg width={W} height={TOP} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
          <path d={`M${A.x} ${A.y} L${lerp(A.x, B.x, len)} ${lerp(A.y, B.y, len)}`} stroke={block > 0 ? '#C4C7C5' : INK} strokeWidth={6} strokeDasharray="4 14" strokeLinecap="round" fill="none" />
        </svg>;
      })() : null}
      <P kk="k7" x={280} y={-360}>{block > 0 ? <div style={{transform: `scale(${sp(t, LW(96) - 0.05, fps, 9, 220)})`}}><Dot tone="mint" s={100}><Ico name="lock" s={54} c="#05231D" /></Dot></div> : null}</P>
      <P kk="k7" x={0} y={400}><Cap in="pop" a={sp(t, LW(99) - 0.08, fps, 11, 170)} h={140} dot={<Dot tone="mint" s={96}><LayaMark size={58} color="#05231D" /></Dot>} label="Локально" right={<Check a={sp(t, LW(100), fps, 10, 200)} s={70} />} /></P>

      {/* ——— 8. «Напиши „Лая“ в комментариях, пришлю ссылку, отдашь её Claude, он сам всё установит» ——— */}
      <P kk="k8" x={0} y={-340}><Cap a={S(LW(101))} h={170} minW={920} dot={<Dot tone="ink" s={116}><Ico name="mail" s={0} c="#FFF" /><span style={{fontFamily: SANS, fontWeight: 700, fontSize: 40, color: '#FFFFFF'}}>@</span></Dot>}
        label={<span style={{fontWeight: typed ? 700 : 500, fontSize: typed ? 84 : 52, color: typed ? INK : 'rgba(14,15,17,.4)', letterSpacing: typed ? '0.02em' : 0}}>{typed ? 'ЛАЯ'.slice(0, typed) : 'Комментарий…'}{typed && typed < 3 ? '|' : ''}</span>}
        right={<div style={{transform: `scale(${sp(t, LW(104) - 0.05, fps, 10, 220)})`}}><Dot tone="mint" s={100}><Ico name="plane" s={48} c="#05231D" /></Dot></div>} /></P>
      {sp(t, LW(106) - 0.1, fps) > 0 && flyL < 1 ? (
        <Place cam={cam} x={K.k8[0] + lerp(-180, 0, flyL)} y={K.k8[1] + lerp(-110, 150, flyL) - Math.sin(Math.PI * flyL) * 120}>
          <div style={{transform: `scale(${1 - 0.5 * flyL})`, opacity: 1 - cl((flyL - 0.8) / 0.2)}}><Cap a={sp(t, LW(106) - 0.1, fps)} h={100} dot={<Dot tone="ink" s={76}><Ico name="link" s={42} c="#FFFFFF" /></Dot>} label="Ссылка" /></div>
        </Place>
      ) : null}
      <P kk="k8" x={0} y={150}><Cap in="pop" a={sp(t, LW(107) - 0.08, fps, 11, 170)} h={160} minW={700} dot={<Dot tone="white" s={110}><Brand name="claude" w={70} color="#D97757" /></Dot>} label="Claude"
        right={<div style={{position: 'relative', width: 100, height: 100}}>
          <svg width={100} height={100} viewBox="0 0 100 100" style={{position: 'absolute'}}><circle cx={50} cy={50} r={42} fill="none" stroke="rgba(14,15,17,.08)" strokeWidth={10} />
            <circle cx={50} cy={50} r={42} fill="none" stroke={MINT_D} strokeWidth={10} strokeLinecap="round" pathLength={1} strokeDasharray={`${inst} 2`} transform="rotate(-90 50 50)" /></svg>
          <div style={{position: 'absolute', left: 15, top: 15}}><Check a={sp(t, LW(113) + 0.4, fps, 10, 200)} s={70} /></div>
        </div>} /></P>
      <P kk="k8" x={0} y={400}><div style={{...rise(S(LW(113) + 0.3)), display: 'flex', alignItems: 'center', gap: 28}}><LayaMark size={140} /><span style={{fontFamily: SANS, fontWeight: 600, fontSize: 124, color: INK, letterSpacing: '-0.03em'}}>laya</span></div></P>
    </>
  );
};

// ——— спикер: полоса 40% во всю ширину ———
const SpeakerBand: React.FC = () => (
  <>
    <div style={{position: 'absolute', left: 0, top: BAND.y, width: W, height: BAND.h, overflow: 'hidden', background: '#16181A'}}>
      {REC ? <Video src={staticFile(REC)} volume={0} style={{position: 'absolute', left: 0, top: -BAND.src, width: W, height: H, maxWidth: 'none', maxHeight: 'none'}} /> : <RecStub />}
      <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,.28) 0%, rgba(0,0,0,0) 12%, rgba(0,0,0,0) 82%, rgba(0,0,0,.4) 100%)'}} />
    </div>
    <div style={{position: 'absolute', left: 0, top: BAND.y - 2, width: W, height: 4, background: MINT, boxShadow: `0 0 16px ${MINT}`}} />
  </>
);

const SFX: [number, string, number][] = [
  [0, 'ui-soft', 0.25], [1.86, 'woosh-air', 0.3], [LW(8), 'aamir-ui-pop', 0.28], [LW(9) + 0.1, 'aamir-ui-pop', 0.25], [LW(11), 'aamir-ui-pop', 0.28], [LW(14) + 0.3, 'aamir-confirm', 0.28], [LW(16), 'aamir-ui-pop', 0.28],
  [6.15, 'woosh-air', 0.35], [6.6, 'shimmer', 0.25], [LW(18), 'aamir-chime', 0.28], [LW(19), 'ui-soft', 0.22], [LW(23), 'aamir-ui-pop', 0.25], [LW(24), 'switch', 0.25], [LW(26), 'aamir-ui-pop', 0.25], [LW(27), 'switch', 0.28],
  [9.85, 'woosh-air', 0.35], [10.25, 'aamir-notification', 0.25], [LW(28), 'aamir-ui-pop', 0.25], [LW(31) - 0.1, 'switch', 0.25], [LW(32), 'aamir-ui-pop', 0.25], [LW(34) - 0.1, 'switch', 0.25],
  [LW(35), 'aamir-ui-pop', 0.25], [LW(37) - 0.1, 'aamir-select', 0.28], [LW(40), 'counter', 0.25],
  [16.7, 'woosh-air', 0.35], [LW(43), 'aamir-ui-pop', 0.25], [LW(44), 'switch', 0.25], [LW(46), 'switch', 0.25], [LW(47), 'aamir-ui-pop', 0.25], [LW(49), 'aamir-ui-pop', 0.25], [LW(52), 'aamir-ui-pop', 0.25], [LW(52) + 0.1, 'typing', 0.18], [LW(54), 'aamir-confirm', 0.3],
  [22.55, 'woosh-air', 0.35], [LW(55), 'aamir-ui-pop', 0.22], [LW(58), 'counter', 0.28], [LW(61), 'aamir-ui-pop', 0.25], [LW(65), 'tick-soft', 0.28], [LW(67), 'aamir-ui-pop', 0.25], [LW(68), 'tick-soft', 0.28],
  [30.35, 'woosh-air', 0.35], [LW(70), 'aamir-ui-pop', 0.22], [LW(72), 'aamir-ui-pop', 0.25], [LW(77), 'pop-warm', 0.2], [LW(77) + 0.45, 'pop-warm', 0.2], [LW(77) + 0.9, 'pop-warm', 0.2], [LW(85), 'ui-seq', 0.2], [LW(87), 'aamir-ui-pop', 0.25],
  [38.05, 'woosh-air', 0.35], [LW(90), 'ui-soft', 0.22], [LW(92), 'aamir-ui-pop', 0.22], [LW(94), 'aamir-ui-pop', 0.22], [LW(96) - 0.05, 'aamir-click', 0.28], [LW(99), 'aamir-ui-pop', 0.25], [LW(100), 'aamir-confirm', 0.28],
  [42.75, 'woosh-air', 0.35], [LW(101), 'aamir-ui-pop', 0.25], [LW(102) - 0.05, 'typing', 0.2], [LW(104), 'aamir-ui-pop', 0.25], [LW(106), 'whoosh', 0.2], [LW(107), 'aamir-ui-pop', 0.25], [LW(113) + 0.4, 'aamir-confirm', 0.3], [LW(113) + 0.3, 'aamir-chime', 0.25],
];

export const Reel31: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const cam = camera(t);
  return (
    <AbsoluteFill style={{background: PAPER}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: W, height: TOP, overflow: 'hidden', background: PAPER}}>
        <LensBlobs cam={cam} t={t} blobs={BLOBS} />
        <LensGrid cam={cam} />
        <Stations t={t} fps={fps} cam={cam} />
        <LensVignette />
      </div>
      {/* полоса под спикером (под ником Instagram): та же бумага в клетку */}
      <div style={{position: 'absolute', left: 0, top: BAND.y + BAND.h, width: W, height: H - BAND.y - BAND.h, background: PAPER,
        backgroundImage: 'linear-gradient(rgba(14,15,17,.065) 2px, transparent 2px), linear-gradient(90deg, rgba(14,15,17,.065) 2px, transparent 2px)', backgroundSize: '90px 90px',
        backgroundPosition: `${-cam.x % 90}px ${-cam.y % 90}px`}} />
      <SpeakerBand />
      <Captions t={t} words={WORDS31} cx={680} cy={1170} maxW={880} family={SANS} weight={700} accent={MINT_D} light />
      {VOICE ? <Audio src={staticFile(VOICE)} /> : null}
      {SFX.map(([at, name, v], i) => (
        <Sequence key={i} from={Math.max(0, Math.round(at * fps))} durationInFrames={Math.round(2 * fps)} layout="none">
          <Audio src={staticFile(`sfx/${name}.wav`)} volume={v * 0.37} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
