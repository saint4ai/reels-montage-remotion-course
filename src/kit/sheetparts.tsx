import React, {useId} from 'react';
import {AbsoluteFill, Easing, interpolate, spring, staticFile} from 'remotion';
import {getLength} from '@remotion/paths';
import {useFontsReady} from './liquid/useAssetReady';
import {fontSpec, textWidth} from './liquid/words';

// Язык ЛИСТ (стиль 15) в виде маленьких общих деталей для СИМБИОЗА (kit/symbiosis.tsx): лист с сеткой пятном, оранжевая плашка
// на пружине, строка «фраза SF Pro light + слово Coolvetica оранжевым», размытие по скорости, значок Claude, курсор Claude,
// интерфейс Reels поверх ролика и пунктир маршрута. Полные примеры ЛИСТ лежат в patterns/styles/sheet/code.
// Привязка к 60 к/с: размытие слова считается по сдвигу за 1/60 с.
export const SF = 'SF Pro Display', CV = 'Coolvetica';
export const INK = '#111316', GREY = '#6B7078', OR = '#FF7A2F', PAPER = '#F6F5F1', NIGHT = '#0E0F11';
const cl = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const EXPO = Easing.bezier(0.16, 1, 0.3, 1), EIO = Easing.bezier(0.65, 0, 0.35, 1);
const k = (t: number, a: number, b: number, e = EXPO) => interpolate(t, [a, b], [0, 1], {...cl, easing: e});
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const hex = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const mix = (a: string, b: string, p: number) => { const x = hex(a), y = hex(b); return `rgb(${x.map((v, i) => Math.round(lerp(v, y[i], Math.min(1, Math.max(0, p))))).join(',')})`; };
const spr = (t: number, at: number, fps: number, damping = 11, stiffness = 190) => (t < at ? 0 : spring({frame: (t - at) * fps, fps, config: {damping, stiffness, mass: 1}}));
const DT = 1 / 60;

// ——— лист: тёплый белый или чёрный, сетка 56 px пятном вокруг блока, зерно, виньетка, тёплое пятно за главным предметом ———
export const Sheet: React.FC<{t: number; dark?: boolean; gy?: number}> = ({t, dark, gy = 900}) => {
  const id = useId().replace(/:/g, '');
  const line = dark ? 'rgba(255,255,255,.075)' : 'rgba(17,19,22,.085)';
  return (
    <AbsoluteFill style={{background: dark ? NIGHT : PAPER, overflow: 'hidden'}}>
      <svg width={1440} height={2560} style={{position: 'absolute', inset: 0}}>
        <defs>
          <pattern id={`g${id}`} width={56} height={56} patternUnits="userSpaceOnUse" patternTransform={`translate(0 ${-t * 10})`}><path d="M 56 0 L 0 0 0 56" fill="none" stroke={line} strokeWidth={2} /></pattern>
          <radialGradient id={`m${id}`} cx="50%" cy={`${(gy / 2560) * 100}%`} r="48%"><stop offset="0.35" stopColor="#fff" /><stop offset="1" stopColor="#000" /></radialGradient>
          <mask id={`mk${id}`}><rect width={1440} height={2560} fill={`url(#m${id})`} /></mask>
          <filter id={`n${id}`} x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={2} stitchTiles="stitch" />
            <feColorMatrix type="matrix" values={`0 0 0 0 ${dark ? 1 : 0.1}  0 0 0 0 ${dark ? 1 : 0.1}  0 0 0 0 ${dark ? 1 : 0.1}  0 0 0 0.5 -0.2`} /></filter>
          <radialGradient id={`v${id}`} cx="50%" cy="44%" r="72%"><stop offset="0.6" stopColor="#000" stopOpacity={0} /><stop offset="1" stopColor="#000" stopOpacity={dark ? 0.5 : 0.13} /></radialGradient>
        </defs>
        <rect width={1440} height={2560} fill={`url(#g${id})`} mask={`url(#mk${id})`} />
        <rect width={1440} height={2560} filter={`url(#n${id})`} opacity={dark ? 0.06 : 0.16} />
        <rect width={1440} height={2560} fill={`url(#v${id})`} />
      </svg>
      <div style={{position: 'absolute', left: 720 - 520, top: gy - 360 + Math.sin(t * 0.7) * 12, width: 1040, height: 720, borderRadius: '50%', filter: 'blur(80px)',
        background: `radial-gradient(ellipse, rgba(255,122,47,${dark ? 0.22 : 0.16}), rgba(255,122,47,0) 70%)`}} />
    </AbsoluteFill>
  );
};

// ——— плашка ЛИСТ: белое Coolvetica на оранжевом, наклон, пружина, нижняя грань и тень ———
export const Plate: React.FC<{t: number; at: number; text: string; size: number; fps: number; r?: number; style?: React.CSSProperties}> = ({t, at, text, size, fps, r = -2.5, style}) => {
  const p = spr(t, at, fps);
  return (
    <div style={{display: 'inline-block', transform: `rotate(${r - 6 * (1 - Math.min(1, p))}deg) scale(${0.5 + 0.5 * p})`, opacity: Math.min(1, p * 2), padding: `${size * 0.12}px ${size * 0.26}px ${size * 0.04}px`,
      background: OR, borderRadius: 18, fontFamily: CV, fontSize: size, lineHeight: 1, color: '#FFFFFF', whiteSpace: 'nowrap',
      boxShadow: 'inset 0 3px 0 rgba(255,255,255,.35), 0 10px 0 #C24F14, 0 34px 50px rgba(120,45,0,.28)', ...style}}>{text}</div>
  );
};

// ——— размытие по скорости: SVG-фильтр на HTML-элементе ———
export const Smear: React.FC<{b: number; children: React.ReactNode; style?: React.CSSProperties; vertical?: boolean}> = ({b, children, style, vertical}) => {
  const id = useId().replace(/:/g, '');
  return (
    <div style={{...style, filter: b > 0.4 ? `url(#${id})` : style?.filter}}>
      {b > 0.4 ? <svg width={0} height={0} style={{position: 'absolute'}}><filter id={id} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={vertical ? `0 ${b}` : `${b} 0`} /></filter></svg> : null}
      {children}
    </div>
  );
};

// ——— строка в шрифтах ЛИСТ: SF Pro light, слово-акцент Coolvetica оранжевым; слова влетают со смазом, строка перецентрируется ———
export type Wd = {txt: string; at: number; cv?: boolean};
const FLY_DX = 300, FLY_D = 0.24;
export const Line: React.FC<{t: number; words: Wd[]; y: number; size: number; dark?: boolean; out?: number; extra?: React.ReactNode; extraW?: number; extraAt?: number; outX?: number}> =
  ({t, words, y, size, dark, out = 0, extra, extraW = 0, extraAt = 99, outX = -280}) => {
    const fs = (w: Wd) => (w.cv ? size * 1.18 : size);
    // ширины слов меряются canvas после загрузки шрифтов: пока они грузятся, берётся грубая оценка
    const ready = useFontsReady([fontSpec(300, size, SF), fontSpec(400, size * 1.18, CV)]);
    const ws = words.map((w) => (ready
      ? textWidth(w.txt, fontSpec(w.cv ? 400 : 300, fs(w), w.cv ? CV : SF), fs(w), w.cv ? 0 : -0.02)
      : w.txt.length * fs(w) * 0.5));
    const sp = size * 0.28, grow = (i: number) => k(t, words[i].at, words[i].at + FLY_D + 0.08, EIO);
    const total = ws.reduce((s, w, i) => s + (w + (i ? sp : 0)) * grow(i), 0) + (extraW + sp) * k(t, extraAt, extraAt + 0.3, EIO);
    let x = 720 - total / 2;
    const base = dark ? '#F4F3EF' : INK;
    if (out >= 1) return null;
    return (
      <div style={{position: 'absolute', left: 0, top: y, width: 1440, height: size * 1.4}}>
        {words.map((w, i) => {
          const p = k(t, w.at, w.at + FLY_D), pp = k(t - DT, w.at, w.at + FLY_D), x0 = x + (i ? sp * grow(i) : 0);
          x += (ws[i] + (i ? sp : 0)) * grow(i);
          if (p <= 0) return null;
          const v = (p - pp) * FLY_DX, cool = k(t, w.at + 0.2, w.at + 0.55, EIO);
          return <Smear key={i} b={Math.min(40, v * 1.6) + out * 24} style={{position: 'absolute', left: x0 + (1 - p) * FLY_DX + out * outX, top: w.cv ? -size * 0.12 : 0, whiteSpace: 'nowrap',
            opacity: Math.min(1, p * 3) * (1 - out), fontFamily: w.cv ? CV : SF, fontWeight: w.cv ? 400 : 300, fontSize: fs(w), letterSpacing: w.cv ? 0 : `${-0.02 * size}px`,
            color: w.cv ? OR : mix(OR, base, cool)}}>{w.txt}</Smear>;
        })}
        {extra && out < 1 ? <div style={{position: 'absolute', left: x + sp, top: 0, transform: `translateX(${out * outX}px)`, opacity: 1 - out}}>{extra}</div> : null}
      </div>
    );
  };

// ——— глянцевая иконка Claude (скруглённый квадрат с бликом и ореолом) ———
export const ClaudeIcon: React.FC<{s: number; glow?: number}> = ({s, glow = 0}) => (
  <div style={{position: 'relative', width: s, height: s}}>
    {glow > 0 ? <div style={{position: 'absolute', left: -s * 0.9, top: -s * 0.9, width: s * 2.8, height: s * 2.8, borderRadius: '50%', filter: `blur(${s * 0.25}px)`, opacity: glow,
      background: 'radial-gradient(circle, rgba(217,119,87,.7), rgba(217,119,87,0) 65%)'}} /> : null}
    <div style={{position: 'absolute', inset: 0, borderRadius: s * 0.23, background: 'linear-gradient(160deg, #E8906F 0%, #D97757 45%, #B8583A 100%)',
      boxShadow: `0 ${s * 0.1}px ${s * 0.25}px rgba(150,60,30,.35), inset 0 ${s * 0.03}px 0 rgba(255,255,255,.45), inset 0 -${s * 0.04}px ${s * 0.08}px rgba(90,30,10,.25)`, overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: '-10%', right: '-10%', top: '-30%', height: '60%', borderRadius: '50%', background: 'linear-gradient(180deg, rgba(255,255,255,.35), rgba(255,255,255,0))'}} />
      <div style={{position: 'absolute', inset: s * 0.2, background: '#FFF7F2', WebkitMaskImage: `url(${staticFile('brand/claude.svg')})`, WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center'}} />
    </div>
  </div>
);
export const Ico: React.FC<{d: string; s: number; c: string; w?: number}> = ({d, s, c, w = 1.6}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;

// ——— курсор Claude с именем, как у совместной работы ———
export const ClaudeCursor: React.FC<{x: number; y: number; o: number; press: number; tag: number}> = ({x, y, o, press, tag}) => (o <= 0 ? null :
  <div style={{position: 'absolute', left: x, top: y, opacity: o}}>
    <svg width={64} height={76} viewBox="0 0 24 28" style={{transform: `scale(${1 - 0.15 * press})`, transformOrigin: '10% 8%', filter: 'drop-shadow(0 6px 10px rgba(0,0,0,.25))'}}>
      <path d="M2 2 L2 22 L7.5 17 L11 25 L14.5 23.5 L11 15.5 L18.5 15.5 Z" fill={OR} stroke="#FFF" strokeWidth={1.6} strokeLinejoin="round" /></svg>
    <div style={{position: 'absolute', left: 44, top: 58, height: 64, padding: '0 22px 0 10px', borderRadius: 32, background: OR, display: 'flex', alignItems: 'center', gap: 10,
      fontFamily: SF, fontWeight: 600, fontSize: 40, color: '#FFF', transformOrigin: 'left center', transform: `scale(${0.4 + 0.6 * tag})`, opacity: tag, whiteSpace: 'nowrap'}}>
      <div style={{width: 46, height: 46}}><ClaudeIcon s={46} /></div>Claude</div>
  </div>
);

// ——— интерфейс Instagram Reels поверх ролика: как настоящий рилс в ленте (handle: ник ученика, аватар рисуется кругом) ———
const IG_ICONS = {
  heart: 'M12 21s-7.5-4.6-9.6-9.2C1 8.6 3 5 6.6 5c2 0 3.4 1.1 4.2 2.4h.4C12 6.1 13.4 5 15.4 5 19 5 21 8.6 19.6 11.8 17.5 16.4 12 21 12 21z',
  comment: 'M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.2A8.5 8.5 0 1 1 21 12z',
  share: 'M22 3 2 10.5l7.5 3L13 21l9-18zM9.5 13.5 22 3',
  cam: 'M3 8a2 2 0 0 1 2-2h2.5l1.5-2h6l1.5 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
};
export const IgUI: React.FC<{w: number; likes: string; comments: string; shares: string; caption: string; handle?: string; o?: number}> = ({w, likes, comments, shares, caption, handle = 'your_nick', o = 1}) => {
  const u = w / 1000, sh = '0 2px 8px rgba(0,0,0,.45)';
  const Icon: React.FC<{d: string; fill?: boolean}> = ({d, fill}) => <svg width={84 * u} height={84 * u} viewBox="0 0 24 24" fill={fill ? '#FFF' : 'none'} stroke="#FFF" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{filter: `drop-shadow(${sh})`}}><path d={d} /></svg>;
  return (
    <div style={{position: 'absolute', inset: 0, opacity: o, fontFamily: SF, color: '#FFF', textShadow: sh, pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: '38%', background: 'linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,.55))'}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: '14%', background: 'linear-gradient(180deg, rgba(0,0,0,.35), rgba(0,0,0,0))'}} />
      <div style={{position: 'absolute', left: 50 * u, top: 50 * u, fontWeight: 700, fontSize: 64 * u}}>Reels</div>
      <div style={{position: 'absolute', right: 46 * u, top: 44 * u}}><Icon d={IG_ICONS.cam} /></div>
      <div style={{position: 'absolute', right: 34 * u, bottom: 230 * u, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 34 * u, fontWeight: 600, fontSize: 38 * u}}>
        {[[IG_ICONS.heart, likes], [IG_ICONS.comment, comments], [IG_ICONS.share, shares], [IG_ICONS.dots, '']].map(([d, n], i) => (
          <div key={i} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 * u}}><Icon d={d} />{n ? <span>{n}</span> : null}</div>))}
      </div>
      <div style={{position: 'absolute', left: 46 * u, right: 190 * u, bottom: 64 * u}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 22 * u}}>
          <div style={{width: 84 * u, height: 84 * u, borderRadius: '50%', padding: 5 * u, background: 'linear-gradient(45deg,#F9CE34,#EE2A7B,#6228D7)'}}>
            <div style={{width: '100%', height: '100%', borderRadius: '50%', border: `${3 * u}px solid #000`, background: 'linear-gradient(160deg, #3A3F44, #0E0F11)', display: 'grid', placeItems: 'center',
              fontWeight: 700, fontSize: 36 * u}}>{handle.slice(0, 1).toUpperCase()}</div></div>
          <span style={{fontWeight: 700, fontSize: 44 * u}}>{handle}</span>
          <span style={{border: `${3 * u}px solid rgba(255,255,255,.85)`, borderRadius: 18 * u, padding: `${6 * u}px ${20 * u}px`, fontWeight: 600, fontSize: 36 * u}}>Подписаться</span>
        </div>
        <div style={{marginTop: 22 * u, fontSize: 40 * u, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{caption}</div>
        <div style={{marginTop: 16 * u, fontSize: 34 * u, opacity: 0.9}}>♫ {handle} · оригинальный звук</div>
      </div>
    </div>
  );
};

// ——— пунктир маршрута, нарисованный до доли p (0…1) ———
const dashUpTo = (L: number, p: number) => {
  const vis = L * p, n = Math.floor(vis / 24), arr: number[] = [];
  for (let i = 0; i < n; i++) arr.push(2, 22);
  arr.push(0, L + 100);
  return arr.join(' ');
};
export const RouteDraw: React.FC<{d: string; p: number}> = ({d, p}) => {
  if (p <= 0) return null;
  return <path d={d} fill="none" stroke="rgba(17,19,22,.7)" strokeWidth={7} strokeLinecap="round" strokeDasharray={dashUpTo(getLength(d), p)} />;
};
