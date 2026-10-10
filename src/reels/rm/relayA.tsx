import React from 'react';
import {AbsoluteFill, Sequence, staticFile, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import {Glows, Orb} from '../../kit/relay';
import {RBE, rk} from '../../kit/reactbits';

// Общие блоки перемонтажа 09–10.10.2026 в стиле A «ЭСТАФЕТА 35%» (образец src/reels/ghtricks/Reel.tsx): мир по бренду сцены
// со сменой через шторку (цветовая вспышка кругом, хлыст, спуск сверху, ирис), уход сцены хлыстом, дорожка звуков ×0,37,
// слова записи в субтитры без дубля и кавычек-лапок. Графика в x 160–1280 (поля под обрезку Instagram), запись полосой 900 px
// собирает SpeakerStrip из src/kit/strip.tsx.

export type Fx = 'bloom' | 'whip' | 'drop' | 'iris';
export type ZoneDef = {at: number; base: string; orbs: Orb[]; dots?: string; light: boolean; acc: string; fx?: Fx; x?: number; y?: number; extra?: (t: number) => React.ReactNode};

// Какой мир сейчас (шторка переключает на новый после начала, текст субтитров меняет цвет, когда шторка уже закрыла кадр)
export const zoneIdx = (zs: ZoneDef[], t: number, lag = 0) => {
  let k = 0;
  zs.forEach((z, i) => { if (t >= z.at + lag) k = i; });
  return k;
};
const reveal = (fx: Fx, q: number, x: number, y: number) => {
  if (fx === 'bloom') return `circle(${q * 3000}px at ${x}px ${y}px)`;
  if (fx === 'iris') return `circle(${q * 3000}px at 720px 1100px)`;
  if (fx === 'drop') return `inset(0 0 ${(1 - q) * 100}% 0)`;
  const X = 125 - q * 150;
  return `polygon(${X}% 0, 100% 0, 100% 100%, ${X - 22}% 100%)`;
};
const ZoneLayer: React.FC<{z: ZoneDef; t: number; style?: React.CSSProperties}> = ({z, t, style}) => (
  <Glows t={t} base={z.base} orbs={z.orbs} dots={z.dots} style={style}>{z.extra ? z.extra(t) : null}</Glows>
);
export const ZoneBackdrop: React.FC<{t: number; zones: ZoneDef[]; dur?: number}> = ({t, zones, dur = 0.5}) => {
  const k = zoneIdx(zones, t);
  const nextIdx = k + 1 < zones.length && t >= zones[k + 1].at - 0.06 ? k + 1 : -1;
  // идёт шторка к следующему миру: ниже старый мир, поверх новый с вырезом
  if (nextIdx > 0) {
    const n = zones[nextIdx], q = rk(t, n.at - 0.06, n.at - 0.06 + dur, RBE.io);
    return (
      <>
        <ZoneLayer z={zones[k]} t={t} />
        <ZoneLayer z={n} t={t} style={{clipPath: reveal(n.fx ?? 'whip', q, n.x ?? 720, n.y ?? 1100)}} />
      </>
    );
  }
  // шторка закончилась в этом же кадре: новый мир уже наверху
  const prev = k > 0 && t < zones[k].at + dur ? k - 1 : -1;
  if (prev >= 0) {
    const z = zones[k], q = rk(t, z.at - 0.06, z.at - 0.06 + dur, RBE.io);
    return (
      <>
        <ZoneLayer z={zones[prev]} t={t} />
        <ZoneLayer z={z} t={t} style={{clipPath: reveal(z.fx ?? 'whip', q, z.x ?? 720, z.y ?? 1100)}} />
      </>
    );
  }
  return <ZoneLayer z={zones[k]} t={t} />;
};

// Сцена: появляется с a, к b уходит хлыстом / наездом / подъёмом; внутри каждый элемент входит сам от слова речи
export const SceneWrap: React.FC<{t: number; a: number; b: number; exit?: 'whip' | 'zoom' | 'rise'; children: React.ReactNode}> = ({t, a, b, exit = 'whip', children}) => {
  if (t < a - 0.02 || t > b + 0.5) return null;
  const x = rk(t, b - 0.2, b + 0.1, RBE.inExpo);
  const o = 1 - rk(t, b - 0.06, b + 0.12);
  const tf = exit === 'whip' ? `translateX(${-x * 1500}px)` : exit === 'zoom' ? `scale(${1 + x * 0.25})` : `translateY(${-x * 420}px)`;
  return (
    <AbsoluteFill style={{transform: tf, opacity: o, transformOrigin: '720px 1000px', filter: x > 0.02 ? `blur(${x * (exit === 'whip' ? 14 : 18)}px)` : undefined}}>{children}</AbsoluteFill>
  );
};

// Эффекты: [секунда, файл из public/sfx, громкость]; ×0,37 от исходных (правило автора курса)
export const SFX_GAIN = 0.37;
export const Sfx: React.FC<{cues: [number, string, number][]}> = ({cues}) => {
  const {fps} = useVideoConfig();
  return (
    <>
      {cues.map(([at, name, vol], i) => (
        <Sequence key={i} from={Math.max(0, Math.round(at * fps))} durationInFrames={Math.round(2 * fps)} layout="none">
          <Audio src={staticFile(`sfx/${name}.wav`)} volume={vol * SFX_GAIN} />
        </Sequence>
      ))}
    </>
  );
};

// Слова записи → строки субтитров: лапки в ёлочки, одиночное тире убираем, ASR-ошибки правит fix (слово → замена или null)
export type RawW = {w: string; t0: number; t1: number};
export const capWords = (raw: RawW[], fix: (r: RawW) => [string, number, number][] | null = () => null): [string, number, number][] => {
  const out: [string, number, number][] = [];
  raw.forEach((r) => {
    const f = fix(r);
    if (f) { out.push(...f); return; }
    if (/^[-–—]+$/.test(r.w)) return;
    out.push([r.w.replace(/^"/, '«').replace(/"([.,!?:;]*)$/, '»$1'), r.t0, r.t1]);
  });
  return out;
};

// Кусочно-линейное значение по ключам [[t, v], …] (без мёртвых зон: до первого и после последнего держится крайнее)
export const pw = (t: number, keys: [number, number][], smooth = false) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
      const u = (t - t0) / Math.max(1e-6, t1 - t0);
      return v0 + (v1 - v0) * (smooth ? u * u * (3 - 2 * u) : u);
    }
  }
  return keys[keys.length - 1][1];
};

// Курсор macOS (стрелка), положение задаёт сцена: x, y — острие; press 0…1 — сжатие при нажатии
export const Cursor: React.FC<{x: number; y: number; o?: number; press?: number}> = ({x, y, o = 1, press = 0}) => (
  <div style={{position: 'absolute', left: x, top: y, opacity: o, pointerEvents: 'none', zIndex: 20}}>
    <svg width={76} height={99} viewBox="0 0 24 31" style={{position: 'absolute', left: -7, top: -4, overflow: 'visible', transform: `scale(${1 - press * 0.16})`,
      transformOrigin: '10% 5%', filter: 'drop-shadow(0 6px 10px rgba(0,0,0,.35))'}}>
      <path d="M2 1.5 L2 24.5 L7.6 19.3 L11.3 28 L15.2 26.4 L11.6 17.9 L19.2 17.9 Z" fill="#FFFFFF" stroke="#0B0C0E" strokeWidth={1.6} strokeLinejoin="round" />
    </svg>
  </div>
);

// Линия, рисующаяся по ходу (p 0…1): тонкий мостик между предметами сцены
export const Link: React.FC<{d: string; p: number; color: string; w?: number; o?: number}> = ({d, p, color, w = 6, o = 1}) => {
  if (p <= 0) return null;
  return (
    <svg width={1440} height={2560} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none', opacity: o}}>
      <path d={d} pathLength={1} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeDasharray={`${p} 2`} />
    </svg>
  );
};

// Рывок: короткий всплеск 0→1→0 на промежутке (нажатие, удар)
export const pulse = (t: number, at: number, d = 0.3) => (t >= at && t < at + d ? Math.sin(((t - at) / d) * Math.PI) : 0);
