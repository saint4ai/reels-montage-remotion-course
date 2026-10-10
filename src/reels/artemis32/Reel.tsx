import React from 'react';
import {AbsoluteFill, Img, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio, Video} from '@remotion/media';
import {Captions} from '../../montage/Captions';
import {E, k} from '../../montage/parts';
import {Bar, type Blob, BrandMask as Brand, Cap, type Cam, Check, Dot, Ico, LensBlobs, LensGrid, type LensMove, LensVignette, Lines,
  makeCamera, Place, PrintTitle, Ring, Switch, TONE, toScreen} from '../../kit/lens';
import {RecStub} from '../../kit/recStub';
import {WORDS32} from './words';

// Ролик 32 «Artemis» (автор курса, 28.09.2026): формат 40/60, стиль 14 «ЛИНЗА» — белый холст в клетку через «рыбий глаз»,
// стеклянные капсулы на слово. Новое: объёмный Android-телефон справа на переднем плане (CSS 3D с торцом), холст уходит
// под ним; на экране настоящая запись Android из репозитория google/artemis, смонтированная по нажатиям, касания пальца
// и «чтение» экрана рамками. Карта: patterns/reels/lens-artemis/DIRECTION.md.
export const FPS32 = 60;
export const END32 = 46.0;

// Запись спикера (вертикальная 9:16, в образце 1080×1920), голос и запись экрана телефона: положить в public/work/<slug>/ и вписать путь.
// null: заглушка вместо лица, тишина и неподвижный экран телефона (кадры из public/artemis32).
const REC: string | null = null; // 'work/<slug>/speaker-4k.mp4'
const VOICE: string | null = null; // 'work/<slug>/voice.wav'
const PHONE: string | null = null; // 'work/<slug>/phone.mp4' (запись Android, 8,7 с)

const W = 1440, H = 2560, TOP = 1240;
const BAND = {y: 1240, h: 1024, src: 640};
const SANS = 'SF Pro Display', SOYUZ = 'Soyuz Grotesk', MONO = 'JBM';
const INK = '#0E0F11', MINT = '#3DEDC3', MINT_D = '#0B9E7C', ORANGE = '#FF7A2F', PAPER = '#F7F8F6';
const lerp = (a: number, b: number, m: number) => a + (b - a) * m;
const cl = (v: number) => Math.max(0, Math.min(1, v));
const sp = (t: number, at: number, fps: number, damping = 16, stiffness = 140) =>
  t < at ? 0 : spring({frame: (t - at) * fps, fps, config: {damping, stiffness, mass: 1}});
const LW = (i: number) => WORDS32[i].start;

// ══════════ холст: станции и проезды камеры ══════════
const K = {
  a1: [0, 0], a2: [1500, -200], a3: [1500, 1100], a4: [0, 1250], a5: [-1400, 1100], a6: [-1400, -150], a7: [0, -1350], a8: [1400, -1500], a9: [1400, -2800],
} as const;
type KK = keyof typeof K;
const MOVES: LensMove<KK>[] = [
  {a: 7.0, b: 7.6, from: 'a1', to: 'a2', z: 0.86},     // «Называется Artemis»
  {a: 8.7, b: 9.3, from: 'a2', to: 'a3', z: 0.86},     // «Ты пишешь обычными словами»
  {a: 16.8, b: 17.35, from: 'a3', to: 'a4', z: 0.88},  // «Никаких скриптов»
  {a: 18.9, b: 19.45, from: 'a4', to: 'a5', z: 0.86},  // «В официальном рейтинге»
  {a: 23.4, b: 24.0, from: 'a5', to: 'a6', z: 0.86},   // «Описываешь баг»
  {a: 28.6, b: 29.2, from: 'a6', to: 'a7', z: 0.86},   // «Подключается»
  {a: 34.6, b: 35.2, from: 'a7', to: 'a8', z: 0.86},   // «Нужен телефон»
  {a: 38.25, b: 38.85, from: 'a8', to: 'a9', z: 0.86}, // «Скинь»
];
const camera = makeCamera(K, MOVES, 'a1');
const BLOBS: Blob[] = [
  {x: -150, y: 150, r: 520, c: '61,237,195', a: 0.42}, {x: 500, y: -250, r: 420, c: '255,122,47', a: 0.3},
  {x: 1400, y: -300, r: 560, c: '61,237,195', a: 0.4}, {x: 1300, y: 1000, r: 500, c: '255,122,47', a: 0.28}, {x: 1700, y: 1300, r: 520, c: '61,237,195', a: 0.4},
  {x: -200, y: 1150, r: 520, c: '61,237,195', a: 0.4}, {x: -1500, y: 900, r: 500, c: '61,237,195', a: 0.42}, {x: -1200, y: 1400, r: 420, c: '255,122,47', a: 0.26},
  {x: -1600, y: -300, r: 480, c: '255,122,47', a: 0.3}, {x: -1200, y: 100, r: 520, c: '61,237,195', a: 0.4}, {x: -250, y: -1250, r: 520, c: '61,237,195', a: 0.42},
  {x: 1200, y: -1350, r: 520, c: '61,237,195', a: 0.42}, {x: 1600, y: -1700, r: 420, c: '255,122,47', a: 0.26}, {x: 1250, y: -2700, r: 560, c: '61,237,195', a: 0.45},
];

// ══════════ объёмный телефон на переднем плане ══════════
const PH = {x: 935, y: 660, w: 400, h: 820, r: 64, bez: 14};
const SW = PH.w - PH.bez * 2, SH = PH.h - PH.bez * 2;
// в стороны: на баннер и на рейтинг телефон уходит вправо
const aside = (t: number) => Math.max(k(t, 6.95, 7.45, E.inOut) * (1 - k(t, 8.7, 9.2, E.inOut)), k(t, 18.9, 19.4, E.inOut) * (1 - k(t, 23.35, 23.85, E.inOut)));
const TAPS: {t: number; x: number; y: number; to?: [number, number]}[] = [
  // клип phone.mp4 (8,7 с) с 10,6: касания на 0,07 / 2,27 / 3,2 / 5,87 с клипа
  {t: 10.67, x: 0.5, y: 0.72}, {t: 12.87, x: 0.5, y: 0.75, to: [0.5, 0.35]}, {t: 13.8, x: 0.32, y: 0.37}, {t: 16.47, x: 0.3, y: 0.44},
  // повтор бага ×2 с 25,15
  {t: 25.19, x: 0.5, y: 0.72}, {t: 26.29, x: 0.5, y: 0.75, to: [0.5, 0.35]}, {t: 26.75, x: 0.32, y: 0.37}, {t: 28.09, x: 0.3, y: 0.44},
];
const READ = [{y: 0.075, w: 0.4}, {y: 0.14, w: 0.3}, {y: 0.33, w: 0.62}, {y: 0.435, w: 0.5}, {y: 0.52, w: 0.66}];
const Screen: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const img = (src: string) => <Img src={staticFile(`artemis32/${src}`)} style={{position: 'absolute', inset: 0, width: SW, height: SH, objectFit: 'cover', maxWidth: 'none'}} />;
  const replay = t >= 25.15 && t < 29.5;
  return (
    <>
      {t < LW(9) ? <LockScreen t={t} /> : t < 10.6 ? img('phone-settings.png') : t < 19.28 ? null : !replay ? img('phone-end.png') : null}
      {PHONE ? (
        <>
          <Sequence from={Math.round(10.6 * fps)} durationInFrames={Math.round(8.7 * fps)} layout="none">
            <Video src={staticFile(PHONE)} volume={0} style={{position: 'absolute', inset: 0, width: SW, height: SH, objectFit: 'cover', maxWidth: 'none', maxHeight: 'none'}} />
          </Sequence>
          <Sequence from={Math.round(25.15 * fps)} durationInFrames={Math.round(4.35 * fps)} layout="none">
            <Video src={staticFile(PHONE)} volume={0} playbackRate={2} style={{position: 'absolute', inset: 0, width: SW, height: SH, objectFit: 'cover', maxWidth: 'none', maxHeight: 'none'}} />
          </Sequence>
        </>
      ) : (
        // без записи экрана: на месте клипа стоят кадры экрана телефона из public/artemis32
        t >= 10.6 && t < 19.3 ? img('phone-home.png') : replay ? img('phone-battery.png') : null
      )}
      {/* касания пальца: мятный круг, у свайпа — след */}
      <svg width={SW} height={SH} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        {TAPS.map((p, i) => {
          const d = t - p.t;
          if (d < -0.15 || d > 0.7) return null;
          const m = cl((d + 0.15) / 0.35), x = p.to ? lerp(p.x, p.to[0], cl(d / 0.35)) : p.x, y = p.to ? lerp(p.y, p.to[1], cl(d / 0.35)) : p.y;
          return (
            <g key={i} opacity={1 - cl((d - 0.35) / 0.35)}>
              {p.to ? <line x1={p.x * SW} y1={p.y * SH} x2={x * SW} y2={y * SH} stroke={MINT} strokeWidth={14} strokeLinecap="round" opacity={0.5} /> : null}
              <circle cx={x * SW} cy={y * SH} r={22 + 40 * m} fill="none" stroke={MINT} strokeWidth={5} opacity={1 - 0.6 * m} />
              <circle cx={x * SW} cy={y * SH} r={24} fill="rgba(61,237,195,.55)" stroke="#FFFFFF" strokeWidth={4} />
            </g>
          );
        })}
        {/* «читает, что там написано»: рамки по строкам экрана */}
        {READ.map((r, i) => {
          const a = k(t, LW(34) + i * 0.17, LW(34) + i * 0.17 + 0.15) * (1 - k(t, 16.0, 16.3));
          return a > 0 ? <rect key={i} x={0.06 * SW} y={(r.y - 0.03) * SH} width={r.w * SW} height={0.055 * SH} rx={10} fill="rgba(61,237,195,.12)" stroke={MINT_D} strokeWidth={4} opacity={a} /> : null;
        })}
      </svg>
      {replay ? (
        <div style={{position: 'absolute', left: 20, top: 60, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderRadius: 20, background: 'rgba(14,15,17,.75)'}}>
          <div style={{width: 18, height: 18, borderRadius: 9, background: ORANGE, opacity: Math.floor(t * 3) % 2 ? 1 : 0.35}} /><span style={{fontFamily: MONO, fontWeight: 700, fontSize: 24, color: '#FFFFFF'}}>REC ×2</span>
        </div>
      ) : null}
      {t > LW(111) - 0.1 ? (
        <div style={{position: 'absolute', inset: 0, background: `rgba(247,248,246,${0.8 * k(t, LW(111) - 0.1, LW(111) + 0.3)})`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <Check a={sp(t, LW(111), fps, 10, 190)} s={180} />
        </div>
      ) : null}
    </>
  );
};
// экран блокировки до «проходит приложение»: наш вектор (часы и знак Android), не чужой скриншот
const LockScreen: React.FC<{t: number}> = ({t}) => (
  <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(90% 60% at 30% 20%, #1FC9A1, #0B3A30 55%, #050807)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 120}}>
    <div style={{fontFamily: SANS, fontWeight: 300, fontSize: 120, color: '#FFFFFF', letterSpacing: '-0.03em', lineHeight: 1}}>09:41</div>
    <div style={{fontFamily: SANS, fontWeight: 500, fontSize: 26, color: 'rgba(255,255,255,.75)', marginTop: 10}}>Пн, 28 сентября</div>
    <div style={{marginTop: 300, opacity: 0.85 + 0.15 * Math.sin(t * 3)}}><Brand name="android" w={110} color={MINT} /></div>
  </div>
);
const Phone3D: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const a = aside(t), appear = sp(t, -0.2, fps, 18, 120);
  const ry = -16 + 5 * Math.sin(t * 0.5) - 32 * a, rx = 3 * Math.sin(t * 0.4) + 2;
  return (
    <div style={{position: 'absolute', left: PH.x - PH.w / 2 + a * 560, top: PH.y - PH.h / 2 + (1 - Math.min(1, appear)) * 200, width: PH.w, height: PH.h,
      transformStyle: 'preserve-3d', transform: `perspective(2200px) rotateY(${ry}deg) rotateX(${rx}deg)`, opacity: Math.min(1, appear * 2)}}>
      {/* торец: слои корпуса за экраном */}
      {Array.from({length: 11}, (_, i) => (
        <div key={i} style={{position: 'absolute', inset: 0, borderRadius: PH.r, background: i === 10 ? '#3A3F44' : '#23272B', transform: `translateZ(${-(i + 1) * 2.6}px)`}} />
      ))}
      <div style={{position: 'absolute', inset: 0, borderRadius: PH.r, background: 'linear-gradient(160deg, #3A3F44, #0E0F11)', padding: PH.bez, boxSizing: 'border-box',
        boxShadow: '0 60px 120px rgba(14,15,17,.28), 0 0 0 2px rgba(255,255,255,.18) inset'}}>
        <div style={{position: 'relative', width: SW, height: SH, borderRadius: PH.r - PH.bez, overflow: 'hidden', background: '#000'}}>
          <Screen t={t} fps={fps} />
          <div style={{position: 'absolute', left: SW / 2 - 12, top: 16, width: 24, height: 24, borderRadius: 12, background: '#0E0F11'}} />
        </div>
        <div style={{position: 'absolute', inset: 0, borderRadius: PH.r, background: 'linear-gradient(115deg, rgba(255,255,255,.22) 0%, rgba(255,255,255,0) 32%)', pointerEvents: 'none'}} />
      </div>
    </div>
  );
};
// пунктир от капсулы на холсте к телефону (телефон в кадре, капсула на холсте)
const Link: React.FC<{cam: Cam; t: number; wx: number; wy: number; at: number; phoneY?: number; until?: number}> = ({cam, t, wx, wy, at, phoneY = 0.45, until = 99}) => {
  const p = k(t, at, at + 0.45, E.inOut), fade = 1 - k(t, until - 0.1, until + 0.3);
  if (p <= 0 || fade <= 0) return null;
  const A = toScreen(cam, wx, wy), bx = PH.x - PH.w / 2 + aside(t) * 560 - 6, by = PH.y - PH.h / 2 + PH.h * phoneY;
  const mx = lerp(A.x, bx, 0.5);
  const d = `M${A.x} ${A.y} C ${mx} ${A.y}, ${mx} ${by}, ${lerp(A.x, bx, p)} ${lerp(A.y, by, p)}`;
  return (
    <svg width={W} height={TOP} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity: fade}}>
      <path d={d} fill="none" stroke={MINT_D} strokeWidth={5} strokeDasharray="4 14" strokeLinecap="round" strokeDashoffset={-t * 50} />
      {p >= 1 ? <circle cx={bx} cy={by} r={10 + 3 * Math.sin(t * 8)} fill={MINT} /> : null}
    </svg>
  );
};

// ══════════ станции на холсте ══════════
const Stations: React.FC<{t: number; fps: number; cam: Cam}> = ({t, fps, cam}) => {
  const P = (kk: KK, x: number, y: number, node: React.ReactNode, key: string) => <Place key={key} cam={cam} x={K[kk][0] + x} y={K[kk][1] + y}>{node}</Place>;
  const S = (a: number, d = 16, s = 140) => sp(t, a - 0.08, fps, d, s);
  const Pp = (a: number) => sp(t, a - 0.08, fps, 11, 170);
  const C = 'M'; void C;
  const typed = (s: string, a: number, b: number) => s.slice(0, Math.round(s.length * k(t, a, b, (v) => v)));
  const stepDone = [10.7, 13.8, 16.5].map((x) => sp(t, x + 0.2, fps, 10, 200));
  const drop = (a: number) => cl((t - a) / 0.6);
  const stars = Math.round(10000 * k(t, LW(76), LW(79) + 0.2, E.out));
  const ring99 = k(t, LW(53) - 0.1, LW(53) + 0.6, E.out);
  const flyLogs = k(t, LW(65) - 0.2, LW(65) + 0.35, E.inOut), flyShots = k(t, LW(67) - 0.15, LW(67) + 0.4, E.inOut);
  const cta = Math.min(7, Math.floor(k(t, LW(100) - 0.05, LW(100) + 0.35, (v) => v) * 7.99));
  const linkFly = k(t, LW(104) - 0.1, LW(107), E.inOut);
  return (
    <>
      {/* a1. «Тестировщики, сорри. Google… Claude… на настоящем телефоне, как человек» */}
      {P('a1', -180, -445, <PrintTitle t={t} size={132} words={[{s: 'Тестировщики,', at: -1}]} />, 't1')}
      {P('a1', -385, -300, <PrintTitle t={t} size={132} words={[{s: 'сорри.', at: -1}]} />, 't2')}
      {P('a1', -330, -110, <Cap in="left" a={S(LW(2))} dot={<Dot tone="white"><Img src={staticFile('brand/google-g.png')} style={{width: 56, height: 56}} /></Dot>} label="Google" />, 'g')}
      {P('a1', -330, 70, <Cap in="left" a={S(LW(7))} dot={<Dot tone="white"><Brand name="claude" w={60} color="#D97757" /></Dot>} label="Claude" />, 'c')}
      {P('a1', -330, 250, <Cap in="pop" a={Pp(LW(14))} dot={<Dot tone="mint"><Ico name="user" s={50} c="#05231D" /></Dot>} label="как человек" />, 'h')}
      <Link cam={cam} t={t} wx={K.a1[0] - 330 + 220} wy={K.a1[1] + 70} at={LW(9)} until={7.0} />

      {/* a2. «Называется Artemis»: настоящий баннер */}
      {P('a2', 0, -60, (
        <div style={{...{opacity: Math.min(1, S(LW(16)) * 1.8)}, transform: `perspective(1400px) rotateX(${(1 - Math.min(1, S(LW(16)))) * -60}deg)`, padding: 18, borderRadius: 40,
          background: 'linear-gradient(180deg, rgba(255,255,255,.7), rgba(255,255,255,.4))', border: '2px solid #FFFFFF', boxShadow: '0 40px 90px rgba(14,15,17,.16)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)'}}>
          <Img src={staticFile('artemis32/artemis-banner.png')} style={{width: 1150, height: 243, borderRadius: 26, display: 'block', maxWidth: 'none', filter: `brightness(${0.7 + 0.3 * k(t, LW(17) - 0.1, LW(17) + 0.3)})`}} />
        </div>
      ), 'ban')}
      
      {/* a3. шаги обычными словами + агент */}
      {[{s: 'Открой приложение', a: LW(22)}, {s: 'Найди заказ', a: LW(24)}, {s: 'Проверь оплату', a: LW(26)}].map((st, i) => P('a3', -300, -410 + i * 165, (
        <Cap in="right" a={S(st.a - 0.1)} minW={560} dot={<Dot tone={stepDone[i] > 0.5 ? 'mint' : 'grey'}><span style={{fontFamily: SOYUZ, fontWeight: 700, fontSize: 44, color: stepDone[i] > 0.5 ? '#05231D' : '#5F6368'}}>{i + 1}</span></Dot>}
          label={typed(st.s, st.a - 0.05, st.a + 0.35)} right={<Check a={stepDone[i]} s={60} />} />
      ), `st${i}`))}
      {P('a3', -300, 120, <Cap in="pop" a={Pp(LW(29))} dot={<Dot tone="ink"><Brand name="android" w={54} color={MINT} /></Dot>} label="Агент"
        right={<div style={{display: 'flex', gap: 10}}>{[0, 1, 2].map((i) => <div key={i} style={{width: 16, height: 16, borderRadius: 8, background: MINT_D, opacity: 0.3 + 0.7 * ((Math.sin(t * 8 - i) + 1) / 2)}} />)}</div>} />, 'ag')}
      <Link cam={cam} t={t} wx={K.a3[0] - 300 + 200} wy={K.a3[1] + 120} at={LW(31) - 0.3} phoneY={0.4} until={16.8} />

      {/* a4. «Никаких скриптов под каждую кнопку» */}
      {['tap("#buy")', 'find("#order")', 'assert("#paid")'].map((c, i) => {
        const dr = drop(LW(42) + i * 0.2);
        return P('a4', -300, -400 + i * 150 + dr * dr * 700, (
          <div style={{opacity: 1 - cl((dr - 0.4) / 0.6), transform: `rotate(${dr * (i % 2 ? 18 : -14)}deg)`}}>
            <Cap in="pop" a={Pp(LW(41) + i * 0.06)} h={110} dot={<Dot tone="grey" s={80}><Ico name="code" s={42} c="#5F6368" /></Dot>} label={<span style={{fontFamily: MONO, fontSize: 40}}>{c}</span>} />
          </div>
        ), `code${i}`);
      })}
      {P('a4', -300, 120, <Cap in="rise" a={S(LW(43))} dot={<Dot tone="ink"><Ico name="code" s={48} c="#FFFFFF" /></Dot>} label="Скрипты" dim={k(t, LW(45), LW(45) + 0.3)}
        right={<Switch on={1 - k(t, LW(45) - 0.1, LW(45) + 0.25, E.inOut)} />} />, 'scr')}

      {/* a5. настоящий рейтинг AndroidWorld, строка ARTEMIS светится */}
      {P('a5', 0, -70, (
        <div style={{opacity: Math.min(1, S(LW(47)) * 1.8), transform: `scale(${0.9 + 0.1 * Math.min(1, S(LW(47)))})`, padding: 16, borderRadius: 36, position: 'relative',
          background: 'linear-gradient(180deg, rgba(255,255,255,.75), rgba(255,255,255,.45))', border: '2px solid #FFFFFF', boxShadow: '0 40px 90px rgba(14,15,17,.16)'}}>
          <Img src={staticFile('artemis32/androidworld_leaderboard.png')} style={{width: 1120, height: 585, borderRadius: 22, display: 'block', maxWidth: 'none'}} />
          <div style={{position: 'absolute', left: 16 + 1120 * 0.015, top: 16 + 585 * 0.148, width: 1120 * 0.97, height: 585 * 0.06, borderRadius: 14, border: `4px solid ${MINT_D}`,
            boxShadow: `0 0 30px ${MINT}, inset 0 0 20px rgba(61,237,195,.35)`, opacity: k(t, LW(53) - 0.1, LW(53) + 0.25)}} />
        </div>
      ), 'lb')}
      {P('a5', -300, 360, <Cap in="left" a={S(LW(49))} dot={<Ring p={ring99} pct={99} s={100} />} label="AndroidWorld" />, 'aw')}

      {/* a6. «Описываешь баг словами, Claude воспроизводит… логи и скриншоты» */}
      {P('a6', -300, -400, <Cap in="drop" a={S(LW(56))} minW={560} dot={<Dot tone="orange"><Ico name="bug" s={50} c="#FFFFFF" /></Dot>} label="Баг"
        right={<div style={{width: 230 * k(t, LW(56), LW(57) + 0.4), overflow: 'hidden'}}><Lines w={230} /></div>} />, 'bug')}
      {P('a6', -300, -230, <Cap in="rise" a={S(LW(59))} h={110} dot={<Dot tone="white" s={80}><Brand name="claude" w={46} color="#D97757" /></Dot>} label={<span style={{fontSize: 44}}>повторяет на телефоне</span>} />, 'rep')}
      {flyLogs > 0 ? (() => {
        const from = {x: PH.x - 60, y: PH.y - 120}, to = toScreen(cam, K.a6[0] - 300, K.a6[1] - 20);
        return (
          <div style={{position: 'absolute', left: lerp(from.x, to.x, flyLogs), top: lerp(from.y, to.y, flyLogs) - Math.sin(Math.PI * flyLogs) * 80, transform: `translate(-50%,-50%) scale(${lerp(0.4, to.s, flyLogs)})`}}>
            <div style={{width: 540, padding: '24px 30px', borderRadius: 32, background: 'rgba(14,15,17,.9)', boxShadow: '0 30px 60px rgba(14,15,17,.3)', fontFamily: MONO, fontWeight: 700, fontSize: 30, color: '#C4FFF1', lineHeight: 1.55}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, color: '#FFFFFF', fontFamily: SANS, fontSize: 36}}><Ico name="logs" s={40} c={MINT} />Логи</div>
              {['tap  Settings', 'swipe  up', 'tap  Battery', 'tap  Battery Saver'].map((l, i) => <div key={i} style={{opacity: cl((t - LW(65) - 0.2 - i * 0.15) / 0.2)}}>{`> ${l}`}</div>)}
            </div>
          </div>
        );
      })() : null}
      {flyShots > 0 ? (() => {
        const from = {x: PH.x - 60, y: PH.y + 60}, to = toScreen(cam, K.a6[0] - 300, K.a6[1] + 300);
        return (
          <div style={{position: 'absolute', left: lerp(from.x, to.x, flyShots), top: lerp(from.y, to.y, flyShots) - Math.sin(Math.PI * flyShots) * 80, transform: `translate(-50%,-50%) scale(${lerp(0.4, to.s, flyShots)})`,
            display: 'flex', gap: 18}}>
            {['phone-home.png', 'phone-battery.png', 'phone-end.png'].map((f, i) => (
              <Img key={f} src={staticFile(`artemis32/${f}`)} style={{width: 150, height: 334, borderRadius: 22, border: '4px solid #FFFFFF', boxShadow: '0 20px 40px rgba(14,15,17,.25)', transform: `rotate(${(i - 1) * 6}deg) translateY(${Math.abs(i - 1) * 16}px)`, maxWidth: 'none'}} />
            ))}
          </div>
        );
      })() : null}

      {/* a7. «Подключается Claude Code и Codex. Открытый код от Google, почти 10 000 звёзд» */}
      {P('a7', -300, -410, <Cap in="left" a={S(LW(69))} dot={<Dot tone="white"><Brand name="claude" w={60} color="#D97757" /></Dot>} label="Claude Code" />, 'cc')}
      {P('a7', -300, -250, <Cap in="left" a={S(LW(71))} dot={<Dot tone="ink"><Brand name="openai" w={52} /></Dot>} label="Codex" />, 'cx')}
      <Link cam={cam} t={t} wx={K.a7[0] - 300 + 250} wy={K.a7[1] - 410} at={LW(69) + 0.2} phoneY={0.3} until={34.6} />
      <Link cam={cam} t={t} wx={K.a7[0] - 300 + 190} wy={K.a7[1] - 250} at={LW(71) + 0.2} phoneY={0.42} until={34.6} />
      {P('a7', -300, -60, <Cap in="flip" a={S(LW(72))} dot={<Dot tone="ink"><Brand name="github" w={54} /></Dot>} label="Открытый код"
        right={<div style={{transform: `scale(${sp(t, LW(75) - 0.1, fps, 10, 190)})`}}><Dot tone="white" s={70}><Img src={staticFile('brand/google-g.png')} style={{width: 40, height: 40}} /></Dot></div>} />, 'oss')}
      {P('a7', -300, 150, <Cap in="pop" a={Pp(LW(76))} h={150} dot={<Dot tone="mint" s={110}><Ico name="star" s={56} c="#05231D" /></Dot>}
        label={<span style={{fontFamily: SOYUZ, fontSize: 88, letterSpacing: '0.01em'}}>{stars.toLocaleString('ru-RU')}+</span>} />, 'stars')}

      {/* a8. «Нужен телефон с включённой отладкой или симулятор и ключ модели» */}
      {P('a8', -300, -380, <Cap in="right" a={S(LW(84))} minW={600} dot={<Dot tone="mint"><Ico name="phone" s={50} c="#05231D" /></Dot>} label="Отладка по USB"
        right={<Switch on={k(t, LW(87) - 0.1, LW(87) + 0.25, E.inOut)} />} />, 'usb')}
      {P('a8', -300, -210, <Cap in="right" a={S(LW(89))} minW={600} dot={<Dot tone="grey"><Ico name="laptop" s={50} c="#5F6368" /></Dot>} label="или симулятор" />, 'emu')}
      {P('a8', -300, -40, <Cap in="right" a={S(LW(91))} minW={600} dot={<Dot tone="ink"><Ico name="key" s={50} c="#FFFFFF" /></Dot>} label="Ключ модели" right={<Check a={sp(t, LW(92) + 0.1, fps, 10, 200)} s={62} />} />, 'key')}

      {/* a9. призыв */}
      {P('a9', -300, -420, <Cap in="left" a={S(LW(93))} dot={<Dot tone="mint"><Ico name="plane" s={48} c="#05231D" /></Dot>} label="тестировщику" />, 'share')}
      {P('a9', -270, -230, <Cap in="pop" a={Pp(LW(99))} h={150} minW={640} dot={<Dot tone="ink" s={110}><span style={{fontFamily: SANS, fontWeight: 700, fontSize: 44, color: '#FFFFFF'}}>@</span></Dot>}
        label={<span style={{fontWeight: cta ? 700 : 500, fontSize: cta ? 70 : 50, color: cta ? INK : 'rgba(14,15,17,.4)'}}>{cta ? 'ANDROID'.slice(0, cta) : 'Комментарий…'}</span>}
        right={<div style={{transform: `scale(${sp(t, LW(102), fps, 10, 220)})`}}><Dot tone="mint" s={96}><Ico name="plane" s={46} c="#05231D" /></Dot></div>} />, 'com')}
      {sp(t, LW(104) - 0.1, fps) > 0 && linkFly < 1 ? (
        <Place cam={cam} x={K.a9[0] + lerp(-300, -300, linkFly)} y={K.a9[1] + lerp(-40, 160, linkFly) - Math.sin(Math.PI * linkFly) * 60}>
          <div style={{transform: `scale(${1 - 0.4 * linkFly})`, opacity: 1 - cl((linkFly - 0.8) / 0.2)}}><Cap a={sp(t, LW(104) - 0.1, fps)} h={100} dot={<Dot tone="ink" s={76}><Ico name="link" s={42} c="#FFFFFF" /></Dot>} label="Ссылка" /></div>
        </Place>
      ) : null}
      {P('a9', -300, 170, <Cap in="pop" a={Pp(LW(107))} h={150} minW={520} dot={<Dot tone="white" s={112}><Brand name="claude" w={70} color="#D97757" /></Dot>} label="Claude" right={<Check a={sp(t, LW(111), fps, 10, 200)} s={70} />} />, 'cl')}
      <Link cam={cam} t={t} wx={K.a9[0] - 300 + 230} wy={K.a9[1] + 170} at={LW(109)} phoneY={0.5} />
    </>
  );
};

// ——— спикер: полоса 40% ———
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
  [0, 'ui-soft', 0.25], [LW(2), 'aamir-ui-pop', 0.25], [LW(7), 'aamir-ui-pop', 0.25], [LW(9), 'ui-slide', 0.2], [LW(14), 'aamir-ui-pop', 0.25],
  [7.0, 'woosh-air', 0.35], [LW(16), 'shimmer', 0.25], [LW(17), 'aamir-chime', 0.28],
  [8.7, 'woosh-air', 0.35], [LW(22), 'typing', 0.18], [LW(24), 'typing', 0.18], [LW(26), 'typing', 0.18], [10.67, 'tick-soft', 0.3], [12.87, 'ui-slide', 0.2], [13.8, 'tick-soft', 0.3],
  [LW(34), 'ui-seq', 0.18], [16.47, 'tick-soft', 0.3], [10.9, 'aamir-confirm', 0.2], [14.0, 'aamir-confirm', 0.2], [16.7, 'aamir-confirm', 0.22],
  [16.8, 'woosh-air', 0.3], [LW(41), 'aamir-ui-pop', 0.22], [LW(42), 'rev-whoosh', 0.2], [LW(45) - 0.1, 'switch', 0.28],
  [18.9, 'woosh-air', 0.35], [LW(47), 'aamir-ui-pop', 0.25], [LW(53) - 0.1, 'counter', 0.28], [LW(53) + 0.2, 'aamir-chime', 0.25],
  [23.4, 'woosh-air', 0.35], [LW(56), 'aamir-notification', 0.22], [LW(59), 'aamir-ui-pop', 0.22], [25.15, 'rev-whoosh', 0.25], [LW(65) - 0.2, 'whoosh', 0.2], [LW(67) - 0.15, 'whoosh', 0.2],
  [28.6, 'woosh-air', 0.35], [LW(69), 'aamir-ui-pop', 0.25], [LW(71), 'aamir-ui-pop', 0.25], [LW(72), 'aamir-ui-pop', 0.22], [LW(76), 'counter', 0.28],
  [34.6, 'woosh-air', 0.35], [LW(84), 'aamir-ui-pop', 0.22], [LW(87) - 0.1, 'switch', 0.28], [LW(89), 'aamir-ui-pop', 0.22], [LW(92) + 0.1, 'aamir-confirm', 0.25],
  [38.25, 'woosh-air', 0.35], [LW(93), 'aamir-ui-pop', 0.22], [LW(99), 'aamir-ui-pop', 0.22], [LW(100) - 0.05, 'typing', 0.2], [LW(102), 'aamir-ui-pop', 0.25], [LW(104), 'whoosh', 0.2],
  [LW(107), 'aamir-ui-pop', 0.25], [LW(109), 'ui-slide', 0.2], [LW(111), 'aamir-confirm', 0.3],
];

export const Reel32: React.FC = () => {
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
        <Phone3D t={t} fps={fps} />
      </div>
      <div style={{position: 'absolute', left: 0, top: BAND.y + BAND.h, width: W, height: H - BAND.y - BAND.h, background: PAPER,
        backgroundImage: 'linear-gradient(rgba(14,15,17,.065) 2px, transparent 2px), linear-gradient(90deg, rgba(14,15,17,.065) 2px, transparent 2px)', backgroundSize: '90px 90px',
        backgroundPosition: `${-cam.x % 90}px ${-cam.y % 90}px`}} />
      <SpeakerBand />
      <Captions t={t} words={WORDS32} cx={680} cy={1170} maxW={880} family={SANS} weight={700} accent={MINT_D} light />
      {VOICE ? <Audio src={staticFile(VOICE)} /> : null}
      {SFX.map(([at, name, v], i) => (
        <Sequence key={i} from={Math.max(0, Math.round(at * fps))} durationInFrames={Math.round(2 * fps)} layout="none">
          <Audio src={staticFile(`sfx/${name}.wav`)} volume={v * 0.37} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
