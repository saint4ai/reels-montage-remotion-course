import React from 'react';
import {AbsoluteFill, Audio, Easing, Img, OffthreadVideo, Sequence, random, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import '../../kit/fonts';
import {clamp, inCubic, inOutCubic, lerp, outCubic, overshoot, swift} from './util';
import {Captions} from '../../kit/relay';
import {SpeakerCam} from '../../kit/speakercam';
import type {CamKey} from '../../kit/speakercam';
import {ClaudeGlass3D, JadeStar3D, Mushroom3D, PixelStar3D, Scarab3D} from './obj3d';
import WORDS from './words.json';
import {loadFont} from '@remotion/fonts';

loadFont({family: 'Noto Sans SC', url: staticFile('art31/NotoSansSC-800.woff'), weight: '800'});

// Стиль 17 МИРЫ (пример: рилс «Монтаж в стиле 35 художников»). Каждая мысль в своём художественном мире: миры рисует код
// навыка onai-art-motion (публичный репозиторий https://github.com/saint4ai/onai-art-motion, ставится по ссылке через Claude),
// сверху один 3D-предмет по смыслу (obj3d.tsx), крупное слово-герой языком мира. Спикер внизу в камере Screen Studio или кружком
// (kit/speakercam.tsx), субтитры одной строкой на y 1540 после хука. Всё функция секунды t.
//
// Чтобы получить готовый ролик, подставить:
//  REC и VOICE: запись и голос ученика (положить в public/work/<slug>/; null: заглушка вместо лица и тишина);
//  HAVE_WORLDS: кадры миров из навыка (видео public/art31/worlds/<id>.mp4 и стоп-кадры public/art31/worlds/<id>/t001.00.png,
//   как их получить, в patterns/styles/worlds/PATTERN.md); пока false, рисуются цветные заглушки миров;
//  HAVE_GRID и HAVE_MARIO: лист «35 стилей» (public/art31/grid35.jpg) и запись игры (public/art31/mario-choice.mp4); пока false,
//   рисуются заглушки.
const REC: string | null = null; // 'work/<slug>/rec.mp4', вертикальная запись 1080×1920
const VOICE: string | null = null; // 'work/<slug>/voice.wav'
const HAVE_WORLDS = false, HAVE_GRID = false, HAVE_MARIO = false;

export const UNB = 'Unbounded', MAN = 'Manrope', PIX = 'Handjet', HAND = 'Caveat', MONO = '"JetBrains Mono", monospace';
type Wd = {w: string; t0: number; t1: number};
const WD = WORDS as Wd[];
const norm = (s: string) => s.toLowerCase().replace(/[«»"“”.,!?:;—-]/g, '').replace(/ё/g, 'е');
// время первого слова, начинающегося с одного из префиксов, после момента after
export const wt = (pre: string | string[], after = 0, end = false): number => {
  const ps = (Array.isArray(pre) ? pre : [pre]).map(norm);
  const w = WD.find((x) => x.t0 >= after - 0.01 && ps.some((p) => norm(x.w).startsWith(p)));
  return w ? (end ? w.t1 : w.t0) : after;
};
// время слова перед найденным (фраза «Сам автор…»: «сам» есть и в конце прошлой фразы)
const wprev = (pre: string, after = 0): number => {
  const i = WD.findIndex((x) => x.t0 >= after - 0.01 && norm(x.w).startsWith(norm(pre)));
  return i > 0 ? WD[i - 1].t0 : after;
};
export const REC_END = 48.9;
export const DUR = REC_END;

const k = (t: number, a: number, d: number, e: (x: number) => number = swift) => e(clamp((t - a) / d));
const bump = (t: number, a: number, d: number) => { const u = (t - a) / d; return u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u); };

// ———— опорные моменты речи ————
const T = (() => {
  const mone = wt('моне'), bit = wt(['8', 'вось'], mone), kart = wt('картин'), kod = wt('код', kart), kit = wt('китай'), zv = wt('звезд', kit), dnya = wt('дня', zv);
  const vnutri = wt('внутри'), styles = wt(['стил', 'тридцать', '35'], vnutri), pesh = wt('пещер', vnutri), vg = wt('ван', pesh), ghib = wt(['гибл', 'ghibli'], vg), vapor = wt(['вейпор', 'vapor'], vg);
  const vse = wt('все', vapor), vg2 = wt('ван', vse), krut = wt('крут', vg2), mone2 = wt('моне', krut), ryab = wt('рябь', mone2);
  const daesh = wt('даеш'), ozv = wt('озвуч', daesh), kadr = wt('кадр', ozv), stil = wt('стил', kadr), video = wt('видео', stil);
  const avtor = wprev('автор', video), mario = wt(['марио', 'mario'], avtor), grib = wt('гриб', mario), podp = wt('подпис', grib), openai = wt(['open', 'оупен', 'опен'], podp), claude = wt(['claude', 'клод'], openai + 0.2), vibral = wt('выбрал', claude), vyros = wt('вырос', vibral);
  const navyk = wt('навык', vyros), kit2 = wt('китай', navyk), perev = wt('перев', kit2), rus = wt('русск', perev), rezhim = wt('режим', rus), kazh = wt('кажд', rezhim), mir = wt('мире', kazh);
  const skin = wt('скинь'), napishi = wt('напиши', skin), hud = wt('худож', napishi), ustan = wt('установ', hud);
  return {mone, bit, kart, kod, kit, zv, dnya, vnutri, styles, pesh, vg, ghib, vapor, vse, vg2, krut, mone2, ryab, daesh, ozv, kadr, stil, video, avtor, mario, grib, podp, openai, claude, vibral, vyros, navyk, kit2, perev, rus, rezhim, kazh, mir, skin, napishi, hud, ustan};
})();
export const TIMES = T;

// ———— общие детали ————
const Abs: React.FC<{x: number; y: number; w?: number; h?: number; style?: React.CSSProperties; children?: React.ReactNode}> = ({x, y, w, h, style, children}) => (
  <div style={{position: 'absolute', left: x, top: y, width: w, height: h, ...style}}>{children}</div>
);
const In: React.FC<{p: number; dy?: number; dx?: number; s0?: number; blur?: number; origin?: string; style?: React.CSSProperties; children?: React.ReactNode}> =
  ({p, dy = 40, dx = 0, s0 = 0.92, blur = 10, origin = '50% 50%', style, children}) => {
    if (p <= 0) return null;
    return (
      <div style={{position: 'absolute', inset: 0, opacity: clamp(p * 1.7), transformOrigin: origin, transform: `translate(${(1 - p) * dx}px, ${(1 - p) * dy}px) scale(${lerp(s0, 1, p)})`,
        filter: p < 1 && blur > 0 ? `blur(${(1 - p) * blur}px)` : undefined, ...style}}>{children}</div>
    );
  };
// зачёркивание по всей ширине слова-родителя (родитель position: relative, inline-block)
const Strike: React.FC<{p: number; y: number; color?: string}> = ({p, y, color = '#FF5A4A'}) => (
  p <= 0 ? null : <div style={{position: 'absolute', left: -12, top: y - 5, width: `calc((100% + 24px) * ${p.toFixed(4)})`, height: 10, borderRadius: 5, background: color, boxShadow: `0 0 18px ${color}`, transform: 'rotate(-2deg)', transformOrigin: '0 50%'}} />
);
// 3D-предмет в квадратном прозрачном холсте с центром (cx, cy)
const Obj: React.FC<{cx: number; cy: number; size: number; children: React.ReactNode; op?: number}> = ({cx, cy, size, children, op = 1}) => (
  <div style={{position: 'absolute', left: cx - size / 2, top: cy - size / 2, width: size, height: size, opacity: op, pointerEvents: 'none'}}>{children}</div>
);

// ———— плотность (правило автора курса 09.10.2026): на каждое слово что-то появляется, три слоя (крупный, средний,
// мелкий), элементы лесенкой с задержкой 30–80 мс, ничего не стоит дольше полсекунды (лёгкое парение), иконки по смыслу ————
const ICO: Record<string, string> = {
  star: 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z',
  brush: 'M14 4l6 6-8.5 8.5a3 3 0 0 1-4.2 0l-1.8-1.8a3 3 0 0 1 0-4.2z M4 20c1.5 0 3-.5 3-2',
  code: 'M8 7l-5 5 5 5 M16 7l5 5-5 5 M14 4l-4 16',
  play: 'M7 5v14l12-7z',
  mic: 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z M5 11a7 7 0 0 0 14 0 M12 18v3',
  film: 'M4 5h16v14H4z M8 5v14 M16 5v14 M4 9h4 M4 15h4 M16 9h4 M16 15h4',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M3 12h18 M12 3c3 3 3 15 0 18 M12 3c-3 3-3 15 0 18',
  send: 'M22 3 L10 14 M22 3 L15 21 L10 14 L3 9.5 Z',
  spark: 'M12 2v6 M12 16v6 M2 12h6 M16 12h6 M5 5l4 4 M15 15l4 4 M19 5l-4 4 M9 15l-4 4',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  layers: 'M12 3l9 5-9 5-9-5z M3 13l9 5 9-5',
  check: 'M5 12l5 5 9-10',
  wave: 'M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0',
  grid: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
};
type Pop = {at: number; x: number; y: number; t?: string; i?: string; s?: number; c?: string; bg?: string; out?: number};
const Pops: React.FC<{t: number; items: Pop[]; until: number; dark?: boolean}> = ({t, items, until, dark = true}) => (
  <>
    {items.map((it, n) => {
      const q = k(t, it.at, 0.32, overshoot) * (1 - k(t, (it.out ?? until) - 0.2, 0.2, (x) => x));
      if (q <= 0) return null;
      const s = it.s ?? 34, fl = Math.sin(t * 2.2 + n * 1.7) * 6;
      const fg = it.c ?? (dark ? '#F2F3F5' : '#1E1A16');
      return (
        <div key={n} style={{position: 'absolute', left: it.x, top: it.y + fl, transform: `translate(-50%, -50%) scale(${q})`, opacity: clamp(q * 2), display: 'flex', alignItems: 'center', gap: s * 0.35,
          padding: it.t ? `${s * 0.32}px ${s * 0.6}px ${s * 0.36}px` : `${s * 0.36}px`, borderRadius: 999, whiteSpace: 'nowrap',
          background: it.bg ?? (dark ? 'rgba(16,18,24,.62)' : 'rgba(255,255,255,.78)'), backdropFilter: 'blur(10px)', boxShadow: '0 10px 26px rgba(0,0,0,.28)',
          border: `1.5px solid ${dark ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.08)'}`}}>
          {it.i ? <svg width={s} height={s} viewBox="0 0 24 24" style={{overflow: 'visible', flex: 'none'}}><path d={ICO[it.i]} fill="none" stroke={fg} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
          {it.t ? <span style={{fontFamily: MAN, fontWeight: 800, fontSize: s, color: fg}}>{it.t}</span> : null}
        </div>
      );
    })}
  </>
);

// ———— мир: кадр движка 1920×1080 закрывает верх 1440×1760, медленный проезд камеры, низ уходит в тон мира ————
// Пока миры стоп-кадрами (раскадровка); после одобрения те же миры видео движка (stills → mp4, VIDEO_WORLDS).
const VIDEO_WORLDS: Record<string, boolean> = {'02_egypt': true, '28_monet': true, '14_8bit': true, '17_ink': true, '09_postimp': true, '12_bauhaus': true, '18_klimt': true};
const WH = 1760, WS = WH / 1080, WW = 1920 * WS;
type WEase = 'heavy' | 'sine' | 'step' | 'ink' | 'orbit' | 'axis' | 'gold';
// у каждого мира своя физика (ресёрч ChatGPT 09.10.2026): Египет тяжело, Моне синус, 8-бит ступенями, тушь ускорение и
// растекание, Ван Гог орбита, Баухаус строго по оси, Климт медленное золотое раскрытие
const WE: Record<WEase, (p: number) => number> = {
  heavy: Easing.bezier(0.7, 0, 0.3, 1), sine: (p) => p + 0.03 * Math.sin(p * Math.PI * 4), step: (p) => Math.floor(p * 12) / 12,
  ink: Easing.bezier(0.55, 0, 0.1, 1), orbit: inOutCubic, axis: (p) => p, gold: (p) => -(Math.cos(Math.PI * p) - 1) / 2,
};
// Заглушка мира, пока кадров навыка нет: цвета мира и медленный проезд света по p (0…1)
const LOOK: Record<string, {tone: string; a: string; b: string; light?: boolean}> = {
  '02_egypt': {tone: '#3A2A1A', a: 'rgba(224,171,56,.55)', b: 'rgba(42,88,168,.45)'},
  '28_monet': {tone: '#3E4E5A', a: 'rgba(127,167,201,.6)', b: 'rgba(242,182,198,.5)'},
  '14_8bit': {tone: '#151530', a: 'rgba(255,210,58,.45)', b: 'rgba(224,48,42,.45)'},
  '17_ink': {tone: '#E9E2D0', a: 'rgba(30,26,22,.35)', b: 'rgba(184,50,42,.3)', light: true},
  '09_postimp': {tone: '#1B2440', a: 'rgba(245,197,66,.55)', b: 'rgba(42,88,168,.6)'},
  '12_bauhaus': {tone: '#E9E2D0', a: 'rgba(224,48,42,.5)', b: 'rgba(42,88,168,.45)', light: true},
  '18_klimt': {tone: '#2A1E0E', a: 'rgba(232,184,74,.6)', b: 'rgba(120,70,10,.5)'},
};
const WorldArt: React.FC<{id: string; w: number; h: number; p?: number}> = ({id, w, h, p = 0}) => {
  const l = LOOK[id] ?? LOOK['02_egypt'];
  return <div style={{width: w, height: h, background: `radial-gradient(60% 45% at ${28 + 44 * p}% 36%, ${l.a}, rgba(0,0,0,0) 72%), radial-gradient(55% 40% at ${78 - 30 * p}% 72%, ${l.b}, rgba(0,0,0,0) 72%), ${l.tone}`}} />;
};
const World: React.FC<{id: string; t: number; a: number; d: number; fx?: [number, number]; z?: [number, number]; oy?: number; tone: string; still?: string; fps: number; ease?: WEase}> =
  ({id, t, a, d, fx = [0.4, 0.6], z = [1, 1.06], oy = 700, tone, still = 't001.00', fps, ease = 'orbit'}) => {
    const p = WE[ease](clamp((t - a) / Math.max(0.1, d)));
    const s = lerp(z[0], z[1], p), f = lerp(fx[0], fx[1], p);
    const x = -(WW - 1440) * f, roll = ease === 'orbit' ? Math.sin(t * 0.7) * 0.6 : 0;
    return (
      <AbsoluteFill style={{background: tone}}>
        {/* ниже кадра движка его зеркальное отражение (стоп-кадр, размытие только на картинке, не на видео) */}
        <div style={{position: 'absolute', left: 0, top: WH, width: 1440, height: 2560 - WH, overflow: 'hidden'}}>
          {HAVE_WORLDS ? <Img src={staticFile(`art31/worlds/${id}/${still}.png`)} style={{position: 'absolute', left: x, top: 0, width: WW, height: WH, maxWidth: 'none', transform: 'scaleY(-1)', transformOrigin: '50% 0', marginTop: WH, filter: 'blur(14px) brightness(.55)'}} /> : null}
          <div style={{position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${tone}55, ${tone}EE 70%)`}} />
        </div>
        <div style={{position: 'absolute', left: 0, top: 0, width: 1440, height: WH, overflow: 'hidden'}}>
          <div style={{position: 'absolute', left: x, top: 0, width: WW, height: WH, transformOrigin: `${-x + 720}px ${oy}px`, transform: `scale(${s}) rotate(${roll}deg)`}}>
            {!HAVE_WORLDS ? <WorldArt id={id} w={WW} h={WH} p={p} />
              : VIDEO_WORLDS[id]
                ? <Sequence from={Math.round(a * fps)} layout="none"><OffthreadVideo src={staticFile(`art31/worlds/${id}.mp4`)} muted style={{width: WW, height: WH}} /></Sequence>
                : <Img src={staticFile(`art31/worlds/${id}/${still}.png`)} style={{width: WW, height: WH}} />}
          </div>
          <div style={{position: 'absolute', left: 0, right: 0, top: WH - 160, height: 160, background: `linear-gradient(180deg, rgba(0,0,0,0), ${tone}AA)`}} />
          {!HAVE_WORLDS ? <div style={{position: 'absolute', left: 40, top: WH - 64, fontFamily: MONO, fontSize: 24, whiteSpace: 'nowrap', color: LOOK[id]?.light ? 'rgba(0,0,0,.4)' : 'rgba(255,255,255,.4)'}}>мир {id}: сюда встанет кадр из навыка onai-art-motion</div> : null}
        </div>
      </AbsoluteFill>
    );
  };
// плашка-ярлык мира: стиль и год, как подпись в музее (не речь)
const Plaque: React.FC<{t: number; at: number; name: string; year: string; dark?: boolean}> = ({t, at, name, year, dark}) => (
  <In p={k(t, at, 0.45)} dx={-40} dy={0}>
    <Abs x={160} y={300} style={{display: 'flex', alignItems: 'baseline', gap: 16, padding: '14px 26px 16px', borderRadius: 18, whiteSpace: 'nowrap',
      background: dark ? 'rgba(14,10,8,.72)' : 'rgba(255,250,238,.82)', boxShadow: '0 12px 30px rgba(0,0,0,.25)', backdropFilter: 'blur(10px)'}}>
      <span style={{fontFamily: MAN, fontWeight: 800, fontSize: 50, color: dark ? '#FBF3E4' : '#2A211C'}}>{name}</span>
      <span style={{fontFamily: MAN, fontWeight: 700, fontSize: 40, color: dark ? 'rgba(251,243,228,.7)' : 'rgba(42,33,28,.6)'}}>{year}</span>
    </Abs>
  </In>
);

// ———— переходы внутри хука: мазки Моне и пиксели 8-бит открывают следующий мир ————
const DabMask: React.FC<{p: number; id: string; children: React.ReactNode}> = ({p, id, children}) => {
  if (p <= 0) return null;
  if (p >= 1) return <>{children}</>;
  const dots = Array.from({length: 60}, (_, i) => ({x: random(`dx${id}${i}`) * 1440, y: random(`dy${id}${i}`) * 1800, d: random(`dd${id}${i}`) * 0.5}));
  return (
    <AbsoluteFill>
      <svg width={0} height={0} style={{position: 'absolute'}}>
        <defs><mask id={`m${id}`} maskUnits="userSpaceOnUse" x={0} y={0} width={1440} height={2560}>
          <rect x={0} y={0} width={1440} height={2560} fill="black" />
          {dots.map((o, i) => <ellipse key={i} cx={o.x} cy={o.y} rx={Math.max(0, (p * 1.6 - o.d) * 420)} ry={Math.max(0, (p * 1.6 - o.d) * 300)} fill="white" transform={`rotate(${o.d * 120} ${o.x} ${o.y})`} />)}
        </mask></defs>
      </svg>
      <AbsoluteFill style={{mask: `url(#m${id})`, WebkitMask: `url(#m${id})`}}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};
const PixMask: React.FC<{p: number; id: string; children: React.ReactNode}> = ({p, id, children}) => {
  if (p <= 0) return null;
  if (p >= 1) return <>{children}</>;
  const n = 12, m = 22, cw = 1440 / n, ch = 2560 / m;
  return (
    <AbsoluteFill>
      <svg width={0} height={0} style={{position: 'absolute'}}>
        <defs><mask id={`p${id}`} maskUnits="userSpaceOnUse" x={0} y={0} width={1440} height={2560}>
          {Array.from({length: n * m}, (_, i) => random(`px${id}${i}`) < p ? <rect key={i} x={(i % n) * cw} y={Math.floor(i / n) * ch} width={cw + 1} height={ch + 1} fill="white" /> : null)}
        </mask></defs>
      </svg>
      <AbsoluteFill style={{mask: `url(#p${id})`, WebkitMask: `url(#p${id})`}}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

// ———— 1. Хук: Египет → Моне → 8-бит на словах ————
// Камера (ресёрч ChatGPT): 0–0,8 с большая Screen Studio (спикер лично начинает), затем кружок справа сверху, на «Моне»
// горизонтальный овал слева, на «8-бит» скруглённый квадрат как аватар HUD. Плотность: слово мира, табы, мелкие иконки.
const Hook: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const tM = T.mone - 0.12, tB = T.bit - 0.12, end = T.kart;
  const pM = k(t, tM, 0.45, inOutCubic), pB = k(t, tB, 0.32, (x) => x);
  const word = (txt: string, style: React.CSSProperties, at: number, out: number) => {
    const q = k(t, at, 0.28, overshoot) * (1 - k(t, out - 0.08, 0.12, (x) => x));
    return q <= 0 ? null : (
      <Abs x={0} y={760} w={1440} style={{textAlign: 'center', opacity: clamp(q * 2), transform: `scale(${lerp(0.86, 1, q)})`}}>
        <div style={{display: 'inline-block', whiteSpace: 'nowrap', ...style}}>{txt}</div>
      </Abs>
    );
  };
  const chipUp = k(t, 0.8, 0.4, Easing.bezier(0.22, 1, 0.36, 1)), chipOut = k(t, tM - 0.3, 0.2, (x) => x);
  const tabs: [string, number][] = [['ФРЕСКА', 0], ['МОНЕ', tM], ['8-БИТ', tB]];
  const active = t >= tB ? 2 : t >= tM ? 1 : 0;
  return (
    <AbsoluteFill>
      <World id="02_egypt" t={t} a={0} d={end} fx={[0.12, 0.3]} tone="#3A2A1A" fps={fps} ease="heavy" />
      <DabMask p={pM} id="hm"><World id="28_monet" t={t} a={tM} d={end - tM} fx={[0.18, 0.3]} tone="#3E4E5A" fps={fps} ease="sine" /></DabMask>
      <PixMask p={pB} id="hb"><World id="14_8bit" t={t} a={tB} d={end - tB} fx={[0.3, 0.42]} tone="#151530" fps={fps} ease="step" /></PixMask>
      {/* с кадра 0 поверх большой карточки, затем уезжает наверх влево */}
      {chipOut < 1 ? (
        <div style={{position: 'absolute', left: lerp(720, 160, chipUp), top: lerp(1690, 430, chipUp), transform: `translateX(${lerp(-50, 0, chipUp)}%)`, opacity: 1 - chipOut,
          display: 'flex', alignItems: 'center', gap: 22, padding: '18px 36px 20px', borderRadius: 999, background: 'rgba(20,14,10,.8)', boxShadow: '0 16px 40px rgba(0,0,0,.4)', whiteSpace: 'nowrap'}}>
          <Img src={staticFile('brand/claude.svg')} style={{width: 64, height: 64}} />
          <span style={{fontFamily: MAN, fontWeight: 800, fontSize: 58, color: '#FBF3E4'}}>смонтировал Claude</span>
        </div>
      ) : null}
      {word('ФРЕСОК', {fontFamily: UNB, fontWeight: 700, fontSize: 190, letterSpacing: '0.04em', color: '#2A1810', padding: '10px 50px 24px', borderRadius: 30,
        background: 'linear-gradient(180deg, #F3D27A, #E0AB38 60%, #A8741C)', boxShadow: 'inset 0 0 0 6px #2A1810, inset 0 0 0 14px #E0AB38, inset 0 0 0 18px #2A58A8, 0 30px 70px rgba(0,0,0,.45)'}, 0.8, tM)}
      {word('Моне', {fontFamily: HAND, fontWeight: 600, fontSize: 300, lineHeight: 1, color: '#FFFFFF', textShadow: '0 0 0 #fff, 6px 8px 0 #7FA7C9, -5px -4px 0 #F2B6C6, 0 20px 50px rgba(30,50,80,.5)'}, tM + 0.15, tB)}
      {word('8-БИТ', {fontFamily: PIX, fontWeight: 800, fontSize: 280, lineHeight: 1, color: '#FFD23A', letterSpacing: '0.06em', textShadow: '10px 10px 0 #E0302A, 20px 20px 0 #151530'}, tB + 0.05, 99)}
      {/* средний слой: три таба мира, активный крупнее */}
      <In p={k(t, 0.9, 0.3, outCubic)} dy={20} blur={0}>
        <Abs x={0} y={1110} w={1440} style={{display: 'flex', justifyContent: 'center', gap: 18}}>
          {tabs.map(([s], i) => (
            <div key={s} style={{padding: '14px 30px 16px', borderRadius: 999, fontFamily: i === 2 ? PIX : MAN, fontWeight: 800, fontSize: i === 2 ? 46 : 38, whiteSpace: 'nowrap',
              color: active === i ? '#14100E' : 'rgba(255,255,255,.85)', background: active === i ? '#FFFFFF' : 'rgba(10,10,14,.55)', transform: `scale(${active === i ? 1.12 : 1})`,
              boxShadow: active === i ? '0 10px 30px rgba(0,0,0,.35)' : undefined, border: '1.5px solid rgba(255,255,255,.25)'}}>{s}</div>
          ))}
        </Abs>
      </In>
      {/* мелкий слой: иконки и подписи лесенкой */}
      <Pops t={t} until={end} items={[
        {at: 1.0, x: 300, y: 1420, t: '1350 до н. э.', s: 30, out: tM}, {at: 1.07, x: 1130, y: 1420, i: 'eye', s: 36, out: tM},
        {at: tM + 0.1, x: 290, y: 1420, i: 'brush', s: 36, out: tB}, {at: tM + 0.16, x: 1120, y: 1420, t: '1899', s: 30, out: tB},
        {at: tB + 0.05, x: 300, y: 1420, t: '1UP', s: 34, c: '#FFD23A', out: end}, {at: tB + 0.1, x: 1130, y: 1420, t: '×03', s: 34, out: end}, {at: tB + 0.15, x: 720, y: 1420, i: 'star', s: 36, c: '#FFD23A', out: end},
      ]} />
      {/* 3D-скарабей катит солнце по фреске */}
      <Obj cx={lerp(330, 1060, clamp((t - 0.8) / Math.max(0.5, tM - 0.8)))} cy={1260} size={460} op={(1 - pM) * k(t, 0.75, 0.2)}><Scarab3D t={t} size={460} k={k(t, 0.8, 0.5, outCubic)} /></Obj>
    </AbsoluteFill>
  );
};

// ———— 2. Рисует код, а не нейросеть ————
const CODE = [
  ['const', ' sky = brush.', 'swirl', '(cx, cy, r);'],
  ['paint', '.stroke(sky, ', "'#2a58a8'", ');'],
  ['for', ' (const s of stars) s.', 'spin', '(t);'],
  ['ripple', '(water, t * ', '0.8', ');'],
  ['scarab', '.roll(sun, ', 'path', ');'],
  ['film', '.render(', '30', ' fps);'],
];
// 3D-съёмка монитора (автор курса: «3D-ракурс сбоку, как в After Effects: экран подъезжает… как будто снимаешь монитор
// профессиональной камерой, на нём печатается код и происходит моушен»): монитор в перспективе, камера заходит сбоку
// и доезжает почти в фас, малая глубина резкости (боке, перевод фокуса на слово «КОД»), слева печатается код,
// справа по мазкам проявляется картина Ван Гога: код и есть кисть.
const STROKES = Array.from({length: 14}, (_, i) => ({
  d: `M ${-40 + random(`sx${i}`) * 80} ${30 + i * 52} C ${180 + random(`sa${i}`) * 120} ${10 + i * 52 + random(`sb${i}`) * 60}, ${360 + random(`sc${i}`) * 120} ${50 + i * 52 - random(`sd${i}`) * 60}, ${600} ${30 + i * 52 + random(`se${i}`) * 40}`,
  at: i * 0.07,
}));
const CodeScene: React.FC<{t: number; fps: number}> = ({t}) => {
  const a = T.kart - 0.15, p = clamp((t - a) / Math.max(0.5, T.kit - a));
  const cam = inOutCubic(p);
  const ry = lerp(-38, -8, cam), rx = lerp(10, 3, cam), tz = lerp(-220, 40, cam), tx = lerp(120, 0, cam);
  const cols = ['#C678DD', '#E5E5E5', '#61AFEF', '#98C379'];
  const reveal = k(t, T.kart + 0.5, Math.max(0.5, T.kod + 0.4 - (T.kart + 0.5)), (x) => x);
  const focus = k(t, T.kod - 0.15, 0.35, outCubic);
  const SW = 940, SH = 570;
  const chips: [string, number][] = [['Canvas 2D', 0], ['30 fps', 1], ['0 нейросетей', 2]];
  return (
    <AbsoluteFill style={{background: '#06070A'}}>
      {/* студия: боке-огни на дальнем плане */}
      {Array.from({length: 16}, (_, i) => {
        const c = ['#7B5CFF', '#3DA5F5', '#FF8A3D', '#F2F3F5'][i % 4], r = 60 + random(`br${i}`) * 140;
        return <div key={i} style={{position: 'absolute', left: random(`bx${i}`) * 1440 - r + Math.sin(t * 0.4 + i) * 30, top: 250 + random(`by${i}`) * 1300 - r, width: r * 2, height: r * 2, borderRadius: '50%',
          background: c, opacity: 0.1 + random(`bo${i}`) * 0.16, filter: `blur(${18 + random(`bb${i}`) * 20}px)`}} />;
      })}
      <div style={{position: 'absolute', inset: 0, perspective: 1600, perspectiveOrigin: '545px 900px'}}>
        <div style={{position: 'absolute', left: 545 - SW / 2 + tx, top: 650, width: SW, height: SH, transformStyle: 'preserve-3d', transform: `translateZ(${tz}px) rotateY(${ry}deg) rotateX(${rx}deg)`}}>
          {/* корпус и торец монитора */}
          <div style={{position: 'absolute', left: -24, top: -24, width: SW + 48, height: SH + 48, borderRadius: 34, background: 'linear-gradient(160deg, #2B2E35, #0E0F12)', boxShadow: '0 60px 140px rgba(0,0,0,.7), inset 0 0 0 2px rgba(255,255,255,.08)'}} />
          <div style={{position: 'absolute', left: SW + 24, top: -18, width: 40, height: SH + 36, background: 'linear-gradient(90deg, #15171B, #050506)', transformOrigin: '0 50%', transform: 'rotateY(90deg)'}} />
          {/* экран */}
          <div style={{position: 'absolute', inset: 0, borderRadius: 14, overflow: 'hidden', background: '#0D1015'}}>
            <div style={{position: 'absolute', left: 0, top: 0, width: 400, height: SH, background: '#11151B', borderRight: '2px solid rgba(255,255,255,.06)', overflow: 'hidden'}}>
              <div style={{height: 54, display: 'flex', alignItems: 'center', gap: 10, padding: '0 22px', background: 'rgba(255,255,255,.04)'}}>
                {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => <span key={c} style={{width: 14, height: 14, borderRadius: '50%', background: c}} />)}
                <span style={{marginLeft: 14, fontFamily: MONO, fontSize: 22, color: 'rgba(229,229,229,.55)'}}>vangogh.js</span>
              </div>
              {CODE.map((ln, i) => {
                const at = a + 0.25 + i * 0.2, shown = clamp((t - at) / 0.3), full = ln.join(''), n = Math.floor(full.length * shown);
                let used = 0;
                return (
                  <div key={i} style={{position: 'absolute', left: 16, top: 70 + i * 70, whiteSpace: 'pre', fontFamily: MONO, fontSize: 19, lineHeight: '34px'}}>
                    <span style={{color: 'rgba(229,229,229,.28)', marginRight: 16}}>{i + 1}</span>
                    {ln.map((seg, j) => { const vis = seg.slice(0, Math.max(0, n - used)); used += seg.length; return <span key={j} style={{color: cols[j]}}>{vis}</span>; })}
                    {shown > 0 && shown < 1 ? <span style={{display: 'inline-block', width: 12, height: 28, background: '#E5E5E5', verticalAlign: 'middle', marginLeft: 2}} /> : null}
                  </div>
                );
              })}
            </div>
            {/* холст: картина проявляется мазками по мере печати кода */}
            <div style={{position: 'absolute', left: 400, top: 0, width: SW - 400, height: SH, background: '#0B0E14', overflow: 'hidden'}}>
              <svg width={0} height={0} style={{position: 'absolute'}}><defs><mask id="cvm" maskUnits="userSpaceOnUse" x={0} y={0} width={620} height={700}>
                {STROKES.map((st, i) => { const q = clamp(reveal * 1.6 - st.at * 1.2); return q > 0 ? <path key={i} d={st.d} pathLength={1} stroke="white" strokeWidth={70} strokeLinecap="round" fill="none" strokeDasharray={`${q} 2`} /> : null; })}
              </mask></defs></svg>
              <div style={{position: 'absolute', inset: 0, mask: 'url(#cvm)', WebkitMask: 'url(#cvm)'}}>
                {HAVE_WORLDS
                  ? <Img src={staticFile('art31/worlds/09_postimp/t003.00.png')} style={{position: 'absolute', left: -150, top: -30, width: 1040, height: 585, maxWidth: 'none'}} />
                  : <div style={{position: 'absolute', left: -150, top: -30, width: 1040, height: 585}}><WorldArt id="09_postimp" w={1040} h={585} p={0.5} /></div>}
              </div>
            </div>
            {/* блик стекла едет вместе с камерой */}
            <div style={{position: 'absolute', inset: 0, background: `linear-gradient(115deg, rgba(255,255,255,0) ${20 + cam * 40}%, rgba(255,255,255,.10) ${30 + cam * 40}%, rgba(255,255,255,0) ${42 + cam * 40}%)`}} />
          </div>
          {/* ножка и подставка */}
          <div style={{position: 'absolute', left: SW / 2 - 50, top: SH + 24, width: 100, height: 170, background: 'linear-gradient(90deg, #1A1C21, #2C2F36, #15171B)'}} />
          <div style={{position: 'absolute', left: SW / 2 - 230, top: SH + 186, width: 460, height: 30, borderRadius: 16, background: 'linear-gradient(180deg, #2C2F36, #101114)', boxShadow: '0 30px 60px rgba(0,0,0,.7)'}} />
        </div>
      </div>
      {/* ярлыки мелкого слоя лесенкой */}
      {chips.map(([txt, i]) => {
        const q = k(t, a + 0.5 + i * 0.06, 0.3, outCubic);
        return q > 0 ? <div key={txt} style={{position: 'absolute', left: 660, top: 1250 + i * 72, opacity: q, transform: `translateY(${(1 - q) * 20}px)`, padding: '12px 24px 14px', borderRadius: 999,
          background: 'rgba(255,255,255,.07)', border: '1.5px solid rgba(255,255,255,.16)', fontFamily: MONO, fontSize: 30, color: '#E5E5E5', whiteSpace: 'nowrap'}}>{txt}</div> : null;
      })}
      {/* «КОД» на переднем плане: перевод фокуса */}
      <div style={{position: 'absolute', left: 100, top: 380, opacity: k(t, T.kart + 0.05, 0.25), whiteSpace: 'nowrap'}}>
        <div style={{position: 'relative', display: 'inline-block', fontFamily: UNB, fontWeight: 700, fontSize: 92, color: 'rgba(242,243,245,.8)'}}>НЕ НЕЙРОСЕТЬ
          <Strike p={k(t, wt('нейросеть', T.kart) + 0.15, 0.2, inOutCubic)} y={60} />
        </div>
      </div>
      <div style={{position: 'absolute', left: 100, top: 1230, opacity: clamp(focus * 1.4), filter: focus < 1 ? `blur(${(1 - focus) * 18}px)` : undefined, transform: `scale(${lerp(1.3, 1, focus)})`, transformOrigin: '0 50%'}}>
        <span style={{fontFamily: UNB, fontWeight: 700, fontSize: 180, lineHeight: 1, background: 'linear-gradient(90deg, #C678DD, #61AFEF 50%, #98C379)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent'}}>КОД</span>
      </div>
    </AbsoluteFill>
  );
};

// ———— 3. Тушь: китайский разработчик, 2 726 звёзд за 3 дня ————
// Камера: кружок справа сверху, с 9,2 с верхняя таблетка «нависает» над счётчиком; всё содержимое ниже y 740.
const Ink: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const a = T.kit, end = T.vnutri;
  const n = Math.round(lerp(0, 2726, k(t, T.kit + 0.6, T.zv + 0.3 - (T.kit + 0.6), outCubic)));
  const stamp = k(t, T.dnya - 0.15, 0.25, inCubic);
  return (
    <AbsoluteFill>
      <World id="17_ink" t={t} a={a} d={end - a} fx={[0.2, 0.42]} tone="#E9E2D0" fps={fps} ease="ink" />
      <Plaque t={t} at={a + 0.1} name="Китайская тушь" year="XIV век" />
      <In p={k(t, a + 0.15, 0.4, Easing.bezier(0.16, 1, 0.3, 1))} dy={60}>
        <Abs x={160} y={760} w={1120} h={380} style={{borderRadius: 30, background: 'rgba(252,249,240,.95)', boxShadow: 'inset 0 0 0 3px #1E1A16, 0 30px 80px rgba(40,30,20,.3)', padding: '34px 46px', boxSizing: 'border-box'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 20}}>
            <Img src={staticFile('brand/github.svg')} style={{width: 58, height: 58}} />
            <span style={{fontFamily: MAN, fontWeight: 700, fontSize: 42, color: '#57534E'}}>alchaincyf /</span>
            <span style={{fontFamily: MAN, fontWeight: 800, fontSize: 52, color: '#1E1A16'}}>huashu-art-motion</span>
          </div>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 24, marginTop: 34}}>
            <span style={{fontFamily: UNB, fontWeight: 700, fontSize: 150, lineHeight: 1, color: '#1E1A16', fontVariantNumeric: 'tabular-nums'}}>{n.toLocaleString('ru-RU').replace(/ /g, ' ')}</span>
            <span style={{fontFamily: MAN, fontWeight: 800, fontSize: 60, color: '#57534E', opacity: k(t, T.zv - 0.1, 0.25)}}>★ звёзд</span>
          </div>
        </Abs>
      </In>
      {/* красная печать «3 дня» */}
      {stamp > 0 ? (
        <div style={{position: 'absolute', left: 930, top: 1110, width: 280, height: 280, transform: `rotate(-8deg) scale(${lerp(2.2, 1, stamp)})`, opacity: clamp(stamp * 2),
          borderRadius: 26, background: '#B8322A', boxShadow: 'inset 0 0 0 10px #B8322A, inset 0 0 0 16px #F5E9D8, 0 12px 30px rgba(120,20,10,.35)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#F5E9D8'}}>
          <span style={{fontFamily: UNB, fontWeight: 700, fontSize: 112, lineHeight: 1}}>3</span>
          <span style={{fontFamily: MAN, fontWeight: 800, fontSize: 60, lineHeight: 1.1}}>дня</span>
        </div>
      ) : null}
      <Obj cx={330} cy={1300} size={420}><JadeStar3D t={t} size={420} k={k(t, T.zv - 0.3, 0.6, outCubic)} /></Obj>
      <Pops t={t} until={end + 0.2} dark={false} items={[
        {at: T.kit + 0.05, x: 260, y: 690, t: 'Китай', s: 32, c: '#B8322A', out: 9.1}, {at: wt('разраб', T.kit), x: 470, y: 690, i: 'code', s: 34, out: 9.1},
        {at: wt('выложил', T.kit), x: 650, y: 690, t: 'MIT', s: 30, out: 9.1}, {at: wt('выложил', T.kit) + 0.07, x: 850, y: 690, t: 'fork 283', s: 30, out: 9.1},
        ...[0, 1, 2, 3, 4].map((i): Pop => ({at: T.zv + i * 0.05, x: 560 + i * 70, y: 1185 + (i % 2) * 30, i: 'star', s: 30, c: '#C99A2E'})),
        {at: T.dnya - 0.1, x: 820, y: 1280, t: 'DAY 1', s: 28}, {at: T.dnya - 0.04, x: 820, y: 1340, t: 'DAY 2', s: 28}, {at: T.dnya + 0.03, x: 820, y: 1400, t: 'DAY 3', s: 28, c: '#B8322A'},
      ]} />
    </AbsoluteFill>
  );
};

// ———— 4. Внутри 35 стилей: стена плиток, камера летит вдоль ————
const GW = 2936, GH = 1940, tile = (c: number, r: number) => ({x: 10 + c * 489, y: 75 + r * 317, w: 478, h: 300});
// Лист «35 стилей» (public/art31/grid35.jpg, 6×6 плиток): без файла рисуется сетка цветных плиток
const GRID_TONES = ['#3A2A1A', '#3E4E5A', '#151530', '#E9E2D0', '#1B2440', '#2A1E0E', '#6B2D2A', '#1F4D4A', '#4A3A6A', '#7A5A2A', '#2A2F3A', '#5A3A4A'];
const Grid35: React.FC<{style: React.CSSProperties}> = ({style}) => HAVE_GRID ? <Img src={staticFile('art31/grid35.jpg')} style={style} /> : (
  <svg viewBox={`0 0 ${GW} ${GH}`} style={{...style, background: '#0E0B12'}}>
    {Array.from({length: 36}, (_, n) => { const b = tile(n % 6, Math.floor(n / 6)); return <rect key={n} x={b.x} y={b.y} width={b.w} height={b.h} rx={14} fill={GRID_TONES[n % GRID_TONES.length]} />; })}
  </svg>
);
const Styles35: React.FC<{t: number}> = ({t}) => {
  const a = T.vnutri, end = T.vse, p = clamp((t - a) / Math.max(0.5, end - a));
  const hits: [number, number, number][] = [[0, 0, T.pesh], [0, 2, T.vg], [0, 5, T.ghib], [2, 5, T.vapor]];
  // стена целиком, затем камера перелетает от плитки к плитке на словах: пещера → Ван Гог → Гибли → вейпорвейв
  const W0 = 1300, H0 = W0 * GH / GW, f = W0 / GW;
  const ctr = (c: number, r: number): [number, number] => { const b = tile(c, r); return [(b.x + b.w / 2) * f, (b.y + b.h / 2) * f]; };
  let F: [number, number] = [W0 / 2, H0 / 2];
  hits.forEach(([c, r, at]) => { const e = k(t, at - 0.25, 0.45, inOutCubic); const q = ctr(c, r); F = [lerp(F[0], q[0], e), lerp(F[1], q[1], e)]; });
  const Z = lerp(1, 2.1, k(t, hits[0][2] - 0.25, 0.5, inOutCubic));
  const cx = lerp(930, 720, k(t, 15.1, 0.4, inOutCubic)), cy = 990;
  return (
    <AbsoluteFill style={{background: '#141018'}}>
      <AbsoluteFill style={{backgroundImage: 'radial-gradient(ellipse 80% 45% at 50% 55%, rgba(227,170,90,.20), rgba(0,0,0,0))'}} />
      <div style={{position: 'absolute', left: 0, top: 560, width: 1440, height: 900, overflow: 'hidden', perspective: 1600, borderRadius: 0}}>
        <div style={{position: 'absolute', left: 0, top: -560, width: W0, height: H0, transformOrigin: '0 0', transformStyle: 'preserve-3d',
          transform: `translate(${cx - F[0] * Z}px, ${cy - F[1] * Z}px) scale(${Z}) rotateY(${lerp(-6, 6, p)}deg)`}}>
          <Grid35 style={{position: 'absolute', inset: 0, width: W0, height: H0, borderRadius: 12, boxShadow: '0 40px 120px rgba(0,0,0,.6)'}} />
          {hits.map(([c, r, at], i) => {
            const q = k(t, at - 0.05, 0.3, outCubic) * (1 - k(t, (hits[i + 1]?.[2] ?? end) - 0.25, 0.25, (x) => x));
            if (q <= 0) return null;
            const b = tile(c, r);
            return (
              <div key={i} style={{position: 'absolute', left: b.x * f, top: b.y * f, width: b.w * f, height: b.h * f, borderRadius: 8, overflow: 'hidden',
                boxShadow: `0 0 0 ${3 * q}px #F2CF86, 0 0 ${30 * q}px rgba(255,200,110,.8), 0 16px 30px rgba(0,0,0,.6)`, transform: `translateZ(${40 * q}px) scale(${1 + 0.12 * q})`}}>
                <Grid35 style={{position: 'absolute', left: -b.x * f, top: -b.y * f, width: W0, height: H0, maxWidth: 'none'}} />
              </div>
            );
          })}
        </div>
      </div>
      {/* мелкий слой: счётчик стилей по названным плиткам */}
      <Abs x={1150} y={1400} style={{fontFamily: MONO, fontSize: 34, fontWeight: 700, color: '#F2F3F5', opacity: k(t, T.pesh, 0.2), whiteSpace: 'nowrap'}}>
        {t >= T.vapor ? '33' : t >= T.ghib ? '31' : t >= T.vg ? '13' : '01'}<span style={{opacity: 0.5}}>/35</span>
      </Abs>
      <In p={k(t, T.styles - 0.1, 0.45, outCubic)} s0={0.7} dy={0}>
        <Abs x={0} y={330} w={1440} style={{textAlign: 'center', whiteSpace: 'nowrap'}}>
          <span style={{fontFamily: UNB, fontWeight: 700, fontSize: 200, lineHeight: 1, color: '#FFFFFF', textShadow: '8px 8px 0 #E0302A, 16px 16px 0 #F2C230, 24px 24px 0 #2A58A8'}}>35</span>
          <span style={{fontFamily: MAN, fontWeight: 800, fontSize: 84, color: '#FBF3E4', marginLeft: 26}}>стилей</span>
        </Abs>
      </In>
    </AbsoluteFill>
  );
};

// ———— 5. Всё двигается: Ван Гог крутится, у Моне рябь ————
// Камера: овал сверху (лицо как портрет в картине), с 20,75 с узкая таблетка справа; окно картины опущено к y ~1000.
const Moving: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const a = T.vse, b = T.mone2 - 0.1, end = T.daesh;
  const sw = k(t, b - 0.2, 0.5, inOutCubic);
  const kr = k(t, T.krut, 0.6, Easing.bezier(0.65, 0, 0.35, 1));
  const letters = Array.from('КРУТЯТСЯ');
  const ry = Array.from('РЯБЬ');
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transformOrigin: '720px 700px', transform: `scale(${1 + 0.5 * inCubic(clamp((t - (b - 0.6)) / 0.6))}) rotate(${-40 * inCubic(clamp((t - (b - 0.6)) / 0.6))}deg)`}}>
        <World id="09_postimp" t={t} a={a} d={b - a} fx={[0.13, 0.13]} z={[1.15, 1.9]} oy={640} tone="#1B2440" fps={fps} still="t003.00" ease="orbit" />
      </div>
      <Plaque t={t} at={a + 0.1} name="Ван Гог" year="1889" dark />
      {/* «крутятся»: слово идёт по орбите вокруг звезды */}
      {kr > 0 && t < b ? letters.map((ch, i) => {
        const ang = (i / letters.length) * Math.PI * 1.2 - Math.PI * 0.6 + kr * Math.PI * 1.2 + (t - T.krut) * 0.8, R = 250;
        return <div key={i} style={{position: 'absolute', left: 720 + Math.sin(ang) * R, top: 1060 - Math.cos(ang) * R, transform: `translate(-50%, -50%) rotate(${ang}rad)`, opacity: clamp(kr * 2),
          fontFamily: UNB, fontWeight: 700, fontSize: 84, color: '#F5C542', textShadow: '0 4px 14px rgba(0,0,0,.6)'}}>{ch}</div>;
      }) : null}
      {sw > 0 ? <AbsoluteFill style={{opacity: sw}}><World id="28_monet" t={t} a={b} d={end - b} fx={[0.15, 0.2]} z={[1.9, 1.3]} oy={600} tone="#3E4E5A" fps={fps} still="t003.00" ease="sine" /></AbsoluteFill> : null}
      {sw > 0.5 ? <Plaque t={t} at={b + 0.2} name="Моне" year="1899" /> : null}
      {/* «рябь»: буквы качаются синусом */}
      {t >= T.ryab - 0.05 ? (
        <Abs x={0} y={1230} w={1440} style={{textAlign: 'center', opacity: k(t, T.ryab - 0.05, 0.2)}}>
          {ry.map((ch, i) => <span key={i} style={{display: 'inline-block', fontFamily: HAND, fontWeight: 600, fontSize: 200, color: '#FFFFFF', transform: `translateY(${Math.sin(t * 7 - i * 0.9) * 22}px)`,
            textShadow: '6px 8px 0 #7FA7C9, 0 16px 40px rgba(20,40,70,.5)'}}>{ch}</span>)}
        </Abs>
      ) : null}
      <Pops t={t} until={end} items={[
        {at: T.vg2, x: 290, y: 1420, t: 'ω = 0,8', s: 30, out: b}, {at: T.krut + 0.05, x: 1140, y: 1420, i: 'spark', s: 34, c: '#F5C542', out: b},
        {at: T.ryab - 0.3, x: 280, y: 1430, t: 'sin(x + t)', s: 30}, {at: T.ryab - 0.24, x: 1150, y: 1430, i: 'wave', s: 34, c: '#7FA7C9'},
      ]} />
    </AbsoluteFill>
  );
};

// ———— 6. Баухаус: озвучка → кадры → стиль → видео ————
// Камера: левая боковая карточка; справа конвейер 2×2 строгими осевыми движениями.
const Bauhaus: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const a = T.daesh, end = T.avtor;
  const steps: {at: number; label: string; c: string; shape: 'circle' | 'square' | 'tri' | 'bar'}[] = [
    {at: T.ozv, label: 'озвучка', c: '#E0302A', shape: 'circle'}, {at: T.kadr, label: 'кадры', c: '#F2C230', shape: 'square'},
    {at: T.stil, label: 'стиль', c: '#2A58A8', shape: 'tri'}, {at: T.video, label: 'видео', c: '#1E1A16', shape: 'bar'}];
  return (
    <AbsoluteFill>
      <World id="12_bauhaus" t={t} a={a} d={end - a} fx={[0.05, 0.3]} tone="#E9E2D0" fps={fps} ease="axis" />
      <Plaque t={t} at={a + 0.1} name="Баухаус" year="1923" />
      {steps.map((s, i) => {
        const p = k(t, s.at - 0.08, 0.3, Easing.bezier(0.16, 1, 0.3, 1)), x = 450 + (i % 2) * 420, y = 520 + Math.floor(i / 2) * 450;
        const dx = i % 2 === 0 ? -120 : 120;
        return (
          <In key={i} p={p} dx={dx} dy={0} s0={1} blur={0}>
            <div style={{position: 'absolute', left: x, top: y, width: 390, height: 420, borderRadius: 14, background: '#F7F1E3', boxShadow: 'inset 0 0 0 5px #1E1A16, 12px 12px 0 #1E1A16'}}>
              <div style={{position: 'absolute', left: 95, top: 34, width: 200, height: 200, display: 'grid', placeItems: 'center'}}>
                {s.shape === 'circle' ? <svg width={200} height={200} style={{overflow: 'visible'}}><circle cx={100} cy={100} r={92} fill={s.c} />{Array.from({length: 9}, (_, j) => <rect key={j} x={30 + j * 16} y={100 - (12 + 50 * Math.abs(Math.sin(t * 7 + j))) / 2} width={9} height={12 + 50 * Math.abs(Math.sin(t * 7 + j))} rx={4} fill="#F7F1E3" />)}</svg> : null}
                {s.shape === 'square' ? <div style={{width: 184, height: 184, background: s.c, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: 14, boxSizing: 'border-box'}}>{[0, 1, 2, 3].map((j) => <div key={j} style={{background: '#F7F1E3', opacity: k(t, s.at + 0.1 + j * 0.07, 0.15)}} />)}</div> : null}
                {s.shape === 'tri' ? <svg width={200} height={200}><polygon points="100,8 192,190 8,190" fill={s.c} /><circle cx={100} cy={132} r={30} fill="#F2C230" /></svg> : null}
                {s.shape === 'bar' ? <svg width={200} height={200}><rect x={4} y={60} width={192} height={80} fill={s.c} /><rect x={4} y={60} width={192 * k(t, s.at, 1.2, (x) => x)} height={80} fill="#E0302A" /><polygon points="80,75 80,125 125,100" fill="#F7F1E3" /></svg> : null}
              </div>
              <div style={{position: 'absolute', left: 0, right: 0, top: 262, textAlign: 'center', fontFamily: MAN, fontWeight: 800, fontSize: 50, color: '#1E1A16'}}>{s.label}</div>
              <div style={{position: 'absolute', left: 30, right: 30, top: 340, height: 10, background: s.c}} />
              <div style={{position: 'absolute', right: 26, top: 16, fontFamily: UNB, fontWeight: 700, fontSize: 46, color: s.c === '#1E1A16' ? '#E0302A' : s.c}}>{i + 1}</div>
            </div>
          </In>
        );
      })}
      {/* стрелки-трубы между модулями */}
      <svg width={1440} height={2560} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
        {[[840, 730, 870, 730, T.kadr], [1065, 940, 1065, 970, T.stil], [870, 1180, 840, 1180, T.video]].map(([x1, y1, x2, y2, at], i) => {
          const q = k(t, (at as number) - 0.15, 0.2, (x) => x);
          return q > 0 ? <line key={i} x1={x1} y1={y1} x2={lerp(x1 as number, x2 as number, q)} y2={lerp(y1 as number, y2 as number, q)} stroke="#1E1A16" strokeWidth={10} strokeLinecap="square" /> : null;
        })}
      </svg>
      <Pops t={t} until={end} dark={false} items={[
        {at: T.ozv + 0.1, x: 560, y: 1420, t: '00:49', s: 28}, {at: T.kadr + 0.1, x: 760, y: 1420, t: '#12 кадров', s: 28},
        {at: T.stil + 0.1, x: 990, y: 1420, i: 'grid', s: 30, c: '#2A58A8'}, {at: T.video + 0.1, x: 1150, y: 1420, i: 'check', s: 30, c: '#E0302A'},
      ]} />
    </AbsoluteFill>
  );
};

// ———— 7. Супер Марио: выбор подписки, Claude, вырос ————
// Камера: широкая карточка сверху, с 30,7 с кружок справа сверху, с 33,15 с карточка снизу; телевизор в центре, движение ступенями.
const Mario: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const a = T.avtor, end = T.navyk, grow = k(t, T.vyros - 0.1, 0.5, (x) => x);
  const choose = k(t, T.claude - 0.05, 0.3, outCubic);
  const step = (v: number) => Math.round(v * 6) / 6; // пиксельная физика: значения меняются ступенями
  return (
    <AbsoluteFill>
      <World id="14_8bit" t={t} a={a} d={end - a} fx={[0.5, 0.65]} tone="#151530" fps={fps} ease="step" />
      <In p={step(k(t, a + 0.05, 0.4, (x) => x))} dy={80} blur={0}>
        <Abs x={200} y={760} w={1040} h={600} style={{background: '#1E1A16', borderRadius: 22, boxShadow: 'inset 0 0 0 8px #3A3A4A, 12px 12px 0 #000, 0 40px 90px rgba(0,0,0,.5)', padding: 24, boxSizing: 'border-box'}}>
          <div style={{position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: 6, background: '#5C94FC'}}>
            {HAVE_MARIO
              ? <Sequence from={Math.round(a * fps)} layout="none"><OffthreadVideo src={staticFile('art31/mario-choice.mp4')} muted style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover'}} /></Sequence>
              : <div style={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: PIX, fontWeight: 700, fontSize: 56, color: 'rgba(255,255,255,.7)'}}>здесь запись игры</div>}
          </div>
        </Abs>
      </In>
      {/* выбор крупно: OpenAI или Claude, поверх низа телевизора */}
      <In p={step(k(t, T.podp - 0.05, 0.3, (x) => x))} dy={30} blur={0}>
        <Abs x={250} y={1210} w={940} h={130} style={{background: '#000', boxShadow: 'inset 0 0 0 6px #F8F8F8', display: 'flex', alignItems: 'center', justifyContent: 'space-around', fontFamily: PIX, fontWeight: 700, fontSize: 78, color: '#F8F8F8'}}>
          <span style={{opacity: 1 - choose * 0.6}}>{choose < 0.5 ? '▶ ' : '  '}OpenAI</span>
          <span style={{color: choose > 0.5 ? '#FFD23A' : '#F8F8F8', transform: `scale(${1 + 0.15 * choose})`}}>{choose >= 0.5 ? '▶ ' : '  '}Claude</span>
        </Abs>
      </In>
      {/* HUD сверху, когда камера ушла в кружок */}
      <In p={step(k(t, 30.8, 0.2, (x) => x))} dy={0} blur={0} style={{opacity: 1 - k(t, 33.0, 0.15, (x) => x)}}>
        <Abs x={160} y={470} style={{display: 'flex', gap: 40, fontFamily: PIX, fontWeight: 700, fontSize: 64, color: '#FFFFFF', textShadow: '5px 5px 0 #000', whiteSpace: 'nowrap'}}>
          <span>P1 ×1</span><span style={{color: '#FFD23A'}}>★ {String(Math.floor(lerp(0, 1200, k(t, 30.8, 2, (x) => x)))).padStart(6, '0')}</span>
        </Abs>
      </In>
      <Obj cx={1170} cy={1180} size={320} op={k(t, T.grib - 0.1, 0.3)}><Mushroom3D t={step(t * 2) / 2} size={320} k={k(t, T.grib - 0.1, 0.5, outCubic)} grow={grow} /></Obj>
      <Obj cx={270} cy={1180} size={230} op={k(t, T.vyros - 0.2, 0.3)}><PixelStar3D t={t} size={230} k={k(t, T.vyros - 0.2, 0.4, outCubic)} /></Obj>
      {/* «вырос»: слово растёт 60% → 145% → 100% */}
      {t >= T.vyros - 0.05 ? (
        <Abs x={0} y={1365} w={1440} style={{textAlign: 'center', transform: `scale(${t < T.vyros + 0.2 ? lerp(0.6, 1.45, k(t, T.vyros - 0.05, 0.25, (x) => x)) : lerp(1.45, 1, k(t, T.vyros + 0.2, 0.2, (x) => x))})`, transformOrigin: '720px 40px'}}>
          <span style={{fontFamily: PIX, fontWeight: 800, fontSize: 90, color: '#FFD23A', textShadow: '6px 6px 0 #E0302A'}}>+1 UP</span>
        </Abs>
      ) : null}
      <Pops t={t} until={33.0} items={[
        {at: T.grib, x: 1160, y: 990, i: 'star', s: 30, c: '#FFD23A'},
      ]} />
    </AbsoluteFill>
  );
};

// ———— 8. Мир ONai: перевёл на русский, свой режим, каждая мысль в своём мире ————
// Камера: большая Screen Studio (авторство), с 38,5 с кружок слева, с 40,3 с боковая карточка справа; миры 2×2 слева.
const Onai: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const a = T.navyk, end = T.skin, flip = k(t, T.perev, 0.4, inOutCubic), split = k(t, T.kazh - 0.1, 0.6, outCubic);
  const worlds = [['02_egypt', 't001.00'], ['28_monet', 't001.00'], ['14_8bit', 't001.00'], ['18_klimt', 't001.00']];
  return (
    <AbsoluteFill style={{background: '#06120F'}}>
      <AbsoluteFill style={{backgroundImage: `radial-gradient(circle 700px at ${300 + Math.sin(t * 0.6) * 80}px 600px, rgba(61,237,195,.30), rgba(0,0,0,0)), radial-gradient(circle 650px at ${1150 + Math.cos(t * 0.5) * 70}px 1250px, rgba(255,122,47,.26), rgba(0,0,0,0))`}} />
      {/* тумблер языка внизу под камерой */}
      <In p={k(t, a + 0.1, 0.35)} dy={30}>
        <Abs x={0} y={1310} w={1440} style={{display: 'flex', justifyContent: 'center'}}>
          <div style={{position: 'relative', width: 700, height: 136, borderRadius: 999, background: 'rgba(255,255,255,.08)', boxShadow: 'inset 0 2px 0 rgba(255,255,255,.25), inset 0 0 0 2px rgba(255,255,255,.12)', backdropFilter: 'blur(20px)'}}>
            <div style={{position: 'absolute', top: 11, left: lerp(11, 355, flip), width: 334, height: 114, borderRadius: 999, background: flip > 0.5 ? '#3DEDC3' : '#FF7A2F', boxShadow: '0 10px 30px rgba(0,0,0,.35)'}} />
            <div style={{position: 'absolute', left: 11, top: 11, width: 334, height: 114, display: 'grid', placeItems: 'center', fontFamily: '"Noto Sans SC", sans-serif', fontWeight: 800, fontSize: 58, color: flip < 0.5 ? '#05231D' : 'rgba(255,255,255,.55)'}}>中文</div>
            <div style={{position: 'absolute', left: 355, top: 11, width: 334, height: 114, display: 'grid', placeItems: 'center', fontFamily: MAN, fontWeight: 800, fontSize: 54, color: flip >= 0.5 ? '#05231D' : 'rgba(255,255,255,.55)'}}>Русский</div>
          </div>
        </Abs>
      </In>
      <Obj cx={800} cy={860} size={640} op={k(t, 38.4, 0.3) * (1 - split)}><ClaudeGlass3D t={t} size={640} k={k(t, 38.4, 0.5, outCubic)} /></Obj>
      {/* каждая мысль в своём мире: 4 мира порталами слева, камера справа */}
      {split > 0 ? worlds.map(([id, st], i) => {
        const x = 110 + (i % 2) * 450, y = 470 + Math.floor(i / 2) * 400, q = clamp(split * 1.5 - i * 0.12);
        return (
          <div key={id} style={{position: 'absolute', left: x, top: y, width: 430, height: 380, borderRadius: 30, overflow: 'hidden', opacity: q, transform: `translateY(${(1 - q) * 60}px) scale(${lerp(0.9, 1, q)})`,
            boxShadow: '0 0 0 3px rgba(61,237,195,.55), 0 30px 70px rgba(0,0,0,.5)'}}>
            {HAVE_WORLDS ? <Img src={staticFile(`art31/worlds/${id}/${st}.png`)} style={{width: 676, height: 380, marginLeft: -120}} /> : <WorldArt id={id} w={676} h={380} p={0.4} />}
            <div style={{position: 'absolute', left: 16, top: 14, padding: '6px 14px', borderRadius: 999, background: 'rgba(0,0,0,.55)', fontFamily: MONO, fontSize: 26, color: '#FFFFFF'}}>0{i + 1}</div>
          </div>
        );
      }) : null}
      <Pops t={t} until={end} items={[
        {at: T.kit2, x: 330, y: 1250, t: 'ZH', s: 30, out: T.kazh - 0.1}, {at: T.perev + 0.1, x: 1110, y: 1250, t: 'RU', s: 30, c: '#3DEDC3', out: T.kazh - 0.1},
        {at: T.rezhim, x: 1100, y: 760, t: '+ режим рилсов', s: 32, c: '#3DEDC3', out: 40.25}, {at: T.rezhim + 0.07, x: 1100, y: 850, i: 'film', s: 34, out: 40.25},
      ]} />
    </AbsoluteFill>
  );
};

// ———— 9. Климт: золото, слово ХУДОЖНИК в поле комментария ————
// Камера: арка-таблетка сверху, с 45,25 с золотой медальон справа сверху, с 47,35 с карточка снизу.
const Klimt: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const a = T.skin, rot = Math.sin((t - a) * 0.8) * 10;
  const q = k(t, T.hud - 0.15, 0.5, outCubic);
  const mosaic = 'repeating-linear-gradient(45deg, rgba(255,255,255,.18) 0 6px, rgba(0,0,0,0) 6px 18px), repeating-linear-gradient(-45deg, rgba(120,70,10,.25) 0 5px, rgba(0,0,0,0) 5px 16px), linear-gradient(180deg, #FFF0B8, #E8B84A 45%, #A8741C)';
  const word = 'ХУДОЖНИК', typed = Math.min(word.length, Math.floor(k(t, T.napishi + 0.2, 0.7, (x) => x) * word.length));
  const cursor = Math.floor(t * 3) % 2 === 0;
  const card = k(t, wt('пришлю', T.hud) - 0.05, 0.35, Easing.bezier(0.34, 1.35, 0.64, 1));
  return (
    <AbsoluteFill>
      <World id="18_klimt" t={t} a={a} d={DUR - a} fx={[0.3, 0.5]} z={[1.05, 1.12]} tone="#2A1E0E" fps={fps} ease="gold" />
      <Plaque t={t} at={a + 0.1} name="Климт" year="1907" dark />
      {/* «скинь тому, кто монтирует»: самолётик и монтажные иконки */}
      <svg width={1440} height={2560} style={{position: 'absolute', inset: 0, overflow: 'visible', opacity: 1 - k(t, T.napishi, 0.3, (x) => x)}}>
        <g transform={`translate(${lerp(260, 1180, k(t, a + 0.15, 1.1, inOutCubic))} ${lerp(1000, 860, k(t, a + 0.15, 1.1, inOutCubic))}) rotate(-14)`}>
          <path d="M-80 -56 L90 0 L-80 56 L-46 0 Z" fill="#F2CF86" stroke="#2A1E0E" strokeWidth={6} strokeLinejoin="round" />
        </g>
      </svg>
      <Pops t={t} until={T.napishi - 0.05} items={[{at: wt('монтир', a), x: 470, y: 1120, i: 'film', s: 40}, {at: wt('монтир', a) + 0.06, x: 720, y: 1120, t: 'монтажёру', s: 38}, {at: wt('монтир', a) + 0.12, x: 970, y: 1120, i: 'send', s: 40}]} />
      {/* слово-призыв: тёмная подложка, золото внутри букв с тёмной обводкой */}
      <div style={{position: 'absolute', left: 100, top: 780, width: 1240, height: 420, borderRadius: '50%', opacity: clamp(q * 1.5), background: 'radial-gradient(ellipse at 50% 50%, rgba(20,12,4,.55), rgba(20,12,4,0) 70%)'}} />
      <div style={{position: 'absolute', left: 0, top: 830, width: 1440, perspective: 1200, opacity: clamp(q * 1.5)}}>
        <div style={{textAlign: 'center', transform: `rotateY(${rot}deg) scale(${lerp(0.7, 1, q)})`, transformStyle: 'preserve-3d'}}>
          <span style={{fontFamily: UNB, fontWeight: 700, fontSize: 132, lineHeight: 1.1, letterSpacing: '0.02em', backgroundImage: mosaic, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
            WebkitTextStroke: '5px #2A1608', paintOrder: 'stroke fill', filter: 'drop-shadow(0 8px 0 #3A2408) drop-shadow(0 30px 40px rgba(0,0,0,.55))'}}>ХУДОЖНИК</span>
        </div>
      </div>
      {/* поле комментария: слово печатается, кнопка отправки */}
      <In p={k(t, T.napishi - 0.05, 0.3, Easing.bezier(0.16, 1, 0.3, 1))} dy={40}>
        <Abs x={200} y={1080} w={1040} h={120} style={{borderRadius: 999, background: 'rgba(255,255,255,.94)', boxShadow: '0 20px 50px rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', padding: '0 20px 0 44px', boxSizing: 'border-box'}}>
          <span style={{fontFamily: MAN, fontWeight: 700, fontSize: 52, color: typed ? '#1E1A16' : 'rgba(30,26,22,.4)', whiteSpace: 'nowrap'}}>{typed ? word.slice(0, typed) : 'Добавьте комментарий…'}</span>
          {cursor ? <span style={{width: 4, height: 56, background: '#1E1A16', marginLeft: 6}} /> : null}
          <div style={{marginLeft: 'auto', width: 84, height: 84, borderRadius: '50%', background: typed === word.length ? '#E8B84A' : '#D9D4CC', display: 'grid', placeItems: 'center'}}>
            <svg width={40} height={40} viewBox="0 0 24 24"><path d={ICO.send} fill="none" stroke="#1E1A16" strokeWidth={2.2} strokeLinejoin="round" /></svg>
          </div>
        </Abs>
      </In>
      {/* «пришлю инструкцию»: карточка падает сверху */}
      {card > 0 ? (
        <Abs x={300} y={1240} w={840} h={150} style={{transform: `translateY(${(1 - card) * -120}px)`, opacity: clamp(card * 2), borderRadius: 28, background: 'rgba(20,14,8,.88)', boxShadow: 'inset 0 0 0 2px rgba(232,184,74,.7), 0 24px 60px rgba(0,0,0,.5)',
          display: 'flex', alignItems: 'center', gap: 26, padding: '0 36px', boxSizing: 'border-box'}}>
          <svg width={64} height={64} viewBox="0 0 24 24"><path d={ICO.check} fill="none" stroke="#E8B84A" strokeWidth={2.6} strokeLinecap="round" /></svg>
          <div>
            <div style={{fontFamily: MAN, fontWeight: 800, fontSize: 46, color: '#FBF3E4'}}>Инструкция в директ</div>
            <div style={{fontFamily: MONO, fontSize: 28, color: 'rgba(251,243,228,.7)'}}>как установить навык</div>
          </div>
        </Abs>
      ) : null}
    </AbsoluteFill>
  );
};

// ———— монтажный лист ————
type Ex = 'push' | 'flash' | 'whip' | 'fade' | 'focus' | 'cut' | 'ink' | 'blot';
type Shot = {a: number; b: number; ex: Ex; d: number; ox?: number; oy?: number; acc: string; R: React.FC<{t: number; fps: number}>};
const SHOTS: Shot[] = [
  {a: 0, b: T.kart, ex: 'flash', d: 0.25, acc: '#3D8BFF', R: Hook}, // лазурит фрески
  {a: T.kart, b: T.kit, ex: 'blot', d: 0.5, ox: 480, oy: 1100, acc: '#C678DD', R: CodeScene}, // капля туши из «;» растекается в китайский мир // // наезд в окно кода, где строки стали краской // код стекает: растекание туши в следующий мир
  {a: T.kit, b: T.vnutri, ex: 'push', d: 0.4, ox: 720, oy: 700, acc: '#D8342A', R: Ink}, // киноварь печати
  {a: T.vnutri, b: T.vse, ex: 'push', d: 0.4, ox: 720, oy: 990, acc: '#F2F3F5', R: Styles35}, // наезд в последнюю плитку
  {a: T.vse, b: T.daesh, ex: 'whip', d: 0.3, acc: '#F5C542', R: Moving}, // жёлтые звёзды Ван Гога
  {a: T.daesh, b: T.avtor, ex: 'flash', d: 0.25, acc: '#E0302A', R: Bauhaus},
  {a: T.avtor, b: T.navyk, ex: 'fade', d: 0.35, acc: '#FFD23A', R: Mario}, // видео Марио: без размытия
  {a: T.navyk, b: T.skin, ex: 'focus', d: 0.4, acc: '#3DEDC3', R: Onai},
  {a: T.skin, b: 99, ex: 'cut', d: 0, acc: '#E8B84A', R: Klimt}, // золото Климта (стиль мира, не бренд-код)
];
const exitStyle = (s: Shot, t: number): React.CSSProperties | null => {
  const u = clamp((t - (s.b - s.d / 2)) / Math.max(0.01, s.d));
  if (u <= 0) return {};
  if (u >= 1) return null;
  switch (s.ex) {
    case 'push': { const e = inCubic(u); return {transformOrigin: `${s.ox}px ${s.oy}px`, transform: `scale(${1 + 1.6 * e})`, opacity: 1 - clamp((u - 0.35) / 0.65), filter: `blur(${e * 14}px)`}; }
    case 'whip': { const e = inCubic(u); return {transform: `translateX(${-1500 * e}px)`, filter: `blur(${e * 18}px)`}; }
    case 'focus': return {opacity: 1 - inOutCubic(u), filter: `blur(${u * 26}px)`};
    case 'fade': return {opacity: 1 - inOutCubic(u)};
    case 'ink': return {WebkitMaskImage: `radial-gradient(circle at 50% 40%, rgba(0,0,0,0) ${u * 120 - 20}%, #000 ${u * 120}%)`, maskImage: `radial-gradient(circle at 50% 40%, rgba(0,0,0,0) ${u * 120 - 20}%, #000 ${u * 120}%)`};
    case 'flash': case 'blot': return u < 0.5 ? {} : null;
    default: return null;
  }
};
const enterStyle = (prev: Shot | undefined, t: number, a: number): React.CSSProperties => {
  if (!prev || prev.d <= 0) return {};
  const u = clamp((t - (a - prev.d / 2)) / prev.d);
  if (prev.ex === 'whip') { const e = outCubic(u); return {transform: `translateX(${1500 * (1 - e)}px)`, filter: u < 1 ? `blur(${(1 - e) * 18}px)` : undefined}; }
  if (prev.ex === 'flash' || prev.ex === 'cut' || prev.ex === 'ink' || prev.ex === 'blot') return {};
  const e = swift(clamp((t - (a - prev.d / 2)) / 0.7));
  return {transformOrigin: '720px 900px', transform: `scale(${lerp(0.94, 1, e)})`};
};
// камера спикера: режиссура из ресёрча ChatGPT (разбор режиссуры камеры, patterns/techniques/speaker-cam.md); нижние
// карточки опущены под строку субтитров (y 1640). Вид спикера один во всех формах (scale), меняются форма и место.
const C = (x: number, y: number, w: number, h: number, r: number, fy = 0.5) => ({x, y, w, h, r, fy});
// Решение автора курса 09.10.2026: только две формы, карточка Screen Studio (высота не меньше 0,8 ширины) и кружок; голова целиком
// в каждом ключе. Проверку делает camGuard в SpeakerCam, таблица форм лежит в kit/speakercam.tsx.
const SS_BIG = C(120, 390, 1200, 1260, 56, 0.42), SS_MID = C(170, 410, 1100, 880, 52, 0.42), SS_LOW = C(370, 1650, 700, 560, 48, 0.45);
const ring = (x: number, y: number, d = 300) => C(x, y, d, d, d / 2);
const CAM_KEYS: CamKey[] = [
  {at: 0, m: SS_BIG}, // спикер лично начинает хук
  {at: 0.8, d: 0.33, m: ring(1040, 400, 290)}, // освободить Египет
  {at: T.mone - 0.05, d: 0.4, m: ring(90, 420, 300)}, // Моне раскрывается справа
  {at: T.bit, d: 0.27, m: ring(1030, 400, 300)}, // аватар в 8-бит HUD
  {at: T.kart, d: 0.47, m: ring(1040, 440, 300)}, // слева 3D-монитор
  {at: 9.2, d: 0.43, m: ring(110, 400, 300)}, // кружок перелетает влево, счётчик в центре
  {at: T.vnutri, d: 0.5, m: ring(90, 430, 320)}, // стена справа
  {at: 15.25, d: 0.33, m: ring(1050, 400, 300)}, // уезжает перед пролётом по плиткам
  {at: T.vse, d: 0.4, m: ring(570, 390, 300)}, // портрет над картиной
  {at: 20.75, d: 0.37, m: ring(1050, 520, 300)}, // справа, слева вода Моне
  {at: T.daesh, d: 0.47, m: ring(90, 440, 330)}, // слева, справа конвейер
  {at: T.avtor, d: 0.47, m: ring(570, 410, 320)}, // над телевизором Марио
  {at: 30.7, d: 0.33, m: ring(1040, 420, 290)}, // HUD слева
  {at: 33.15, d: 0.5, m: SS_LOW}, // Screen Studio снизу, выбор выше
  {at: T.navyk, d: 0.47, m: SS_MID}, // Screen Studio: авторство
  {at: 38.5, d: 0.33, m: ring(100, 430, 290)}, // справа русский режим
  {at: 40.3, d: 0.47, m: ring(1040, 450, 300)}, // слева миры
  {at: T.skin, d: 0.43, m: ring(570, 400, 300)}, // портрет в мире Климта
  {at: 45.25, d: 0.33, m: ring(1040, 410, 290)}, // центр под «ХУДОЖНИК»
  {at: 47.35, d: 0.47, m: SS_LOW}, // Screen Studio снизу, слово сверху
];
const BLOTS = SHOTS.filter((s) => s.ex === 'blot');
const FLASHES = SHOTS.filter((s) => s.ex === 'flash').map((s) => s.b);


// ———— субтитры: числа цифрами ————
const CAPW: [string, number, number][] = (() => {
  const out: [string, number, number][] = [];
  const pairs: [string, string, string][] = [['тридцать', 'пять', '35'], ['три', 'тысячи', '3 тысячи'], ['три', 'дня', '3 дня']];
  for (let i = 0; i < WD.length; i++) {
    if (/^[—–-]+$/.test(WD[i].w)) continue; // длинное тире Scribe в субтитры не идёт
    const a = norm(WD[i].w), b = WD[i + 1] ? norm(WD[i + 1].w) : '';
    const m = pairs.find(([x, y]) => a === x && b === y);
    if (m) { const tail = WD[i + 1].w.match(/[.,!?:]+$/)?.[0] ?? ''; out.push([m[2] + tail, WD[i].t0, WD[i + 1].t1]); i++; continue; }
    out.push([WD[i].w.replace(/^восьмибитной/i, '8-битной'), WD[i].t0, WD[i].t1]);
  }
  return out;
})();

// ———— звук ————
type Cue = [number, string, number];
const SFX_GAIN = 0.37;
const CUES: Cue[] = [
  [0.0, 'sub-hit', 0.5], [0.15, 'ui-pop', 0.35], [T.mone - 0.12, 'shimmer', 0.45], [T.bit - 0.12, 'aamir-crispy-click', 0.5],
  [T.kart - 0.15, 'flash', 0.45], [T.kart + 0.1, 'typing', 0.3], [T.kod - 0.05, 'sub-hit', 0.45], [T.kod + 0.3, 'transform', 0.4],
  [T.kit - 0.25, 'woosh-air', 0.4], [T.kit + 0.15, 'ui-slide', 0.35], [T.zv - 0.5, 'counter', 0.45], [T.dnya - 0.15, 'snap', 0.55],
  [T.vnutri - 0.2, 'zoom-deep', 0.45], [T.styles - 0.1, 'sub-hit', 0.4], [T.pesh, 'ui-tap', 0.35], [T.vg, 'ui-tap', 0.35], [T.ghib, 'ui-tap', 0.35], [T.vapor, 'ui-tap', 0.35],
  [T.vse - 0.15, 'whoosh-sharp', 0.45], [T.mone2 - 0.4, 'whoosh-long', 0.35], [T.daesh - 0.15, 'flash', 0.45],
  [T.ozv, 'ui-pop', 0.4], [T.kadr, 'ui-pop', 0.4], [T.stil, 'ui-pop', 0.4], [T.video, 'ding', 0.4],
  [T.avtor - 0.15, 'whoosh', 0.35], [T.podp, 'aamir-select', 0.45], [T.claude, 'aamir-confirm', 0.5], [T.vyros - 0.1, 'riser', 0.35], [T.vyros, 'aamir-chime', 0.5],
  [T.navyk - 0.2, 'blur', 0.4], [T.perev, 'switch', 0.5], [T.kazh - 0.1, 'shimmer', 0.4],
  [T.skin - 0.05, 'whoosh', 0.4], [T.hud - 0.15, 'sub-hit', 0.5], [T.hud, 'shimmer', 0.45],
  [T.napishi + 0.2, 'typing', 0.3], [wt('пришлю', T.hud) - 0.05, 'aamir-notification', 0.45], [T.kit - 0.22, 'transform2', 0.4],
  ...CAM_KEYS.slice(1).map((c): Cue => [c.at - (c.d ?? 0.6) / 2, 'woosh-air', 0.16]),
];

export const Art31: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const live = SHOTS.map((s, i) => ({s, i})).filter(({s, i}) => t >= s.a - (SHOTS[i - 1]?.d ?? 0) / 2 && exitStyle(s, t) !== null);
  const flash = Math.max(0, ...FLASHES.map((b) => bump(t, b - 0.18, 0.36)));
  const si = Math.max(0, SHOTS.findIndex((s) => t >= s.a && t < s.b));
  const accent = SHOTS[si].acc;
  return (
    <AbsoluteFill style={{background: '#100C0A'}}>
      {live.slice().reverse().map(({s, i}) => {
        const R = s.R;
        return <AbsoluteFill key={i} style={{...enterStyle(SHOTS[i - 1], t, s.a), ...(exitStyle(s, t) ?? {})}}><R t={t} fps={fps} /></AbsoluteFill>;
      })}
      {flash > 0 ? <AbsoluteFill style={{background: '#FFFFFF', opacity: flash * 0.9}} /> : null}
      {BLOTS.map((b, i) => {
        const g = k(t, b.b - 0.22, 0.24, Easing.bezier(0.55, 0, 0.1, 1)), o = 1 - k(t, b.b + 0.05, 0.3, (x) => x);
        if (g <= 0 || o <= 0) return null;
        return (
          <svg key={i} width={1440} height={2560} style={{position: 'absolute', inset: 0, opacity: o}}>
            <g transform={`translate(${b.ox} ${b.oy}) scale(${g * 9})`}>
              {[[0, 0, 160], [120, -60, 90], [-110, 70, 100], [60, 130, 70], [-140, -90, 60], [170, 90, 50]].map(([x, y, r], j) => <circle key={j} cx={x} cy={y} r={r} fill="#0B0A09" />)}
            </g>
          </svg>
        );
      })}
      <AbsoluteFill style={{pointerEvents: 'none', background: 'radial-gradient(ellipse 120% 90% at 50% 40%, rgba(0,0,0,0) 58%, rgba(0,0,0,.4) 100%)'}} />
      <AbsoluteFill style={{pointerEvents: 'none', backgroundImage: `url(${staticFile('kit/grain.png')})`, backgroundSize: '512px 512px', mixBlendMode: 'overlay', opacity: 0.05,
        backgroundPosition: `${Math.floor(random(`gx${frame}`) * 512)}px ${Math.floor(random(`gy${frame}`) * 512)}px`}} />
      <Captions t={t} words={CAPW} light={false} accent={accent} cy={1540} from={T.kart - 0.05} maxW={1040} maxLines={1} />
      <SpeakerCam t={t} keys={CAM_KEYS} src={REC} srcW={1080} srcH={1920} faceX={0.47} faceY={0.36} total={DUR} gap={8} />
      {VOICE || REC ? <Audio src={staticFile((VOICE ?? REC) as string)} /> : null}
      {CUES.filter(([at]) => at >= 0).map(([at, name, vol], i) => (
        <Sequence key={i} from={Math.round(at * fps)} durationInFrames={Math.round(6 * fps)} layout="none">
          <Audio src={staticFile(`sfx/${name}.wav`)} volume={vol * SFX_GAIN} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
