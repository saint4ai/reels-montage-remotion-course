import React from 'react';
import {AbsoluteFill, Img, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio, Video} from '@remotion/media';
import {linearTiming, TransitionSeries} from '@remotion/transitions';
import {Captions} from '../../montage/Captions';
import type {Word} from '../../montage/words';
import {RecStub} from '../../kit/recStub';
import {MONO} from '../../montage/parts';
import {blurThrough, whip} from '../../kit/presentations';
import {useFontsReady} from '../../kit/liquid/useAssetReady';
import {fontSpec, textWidth} from '../../kit/liquid/words';
import {E, Fit, k, lerp, SANS, springAt, Words} from '../../styles/parts';

// Общий набор для перемонтажа в стиле B ЭКСПЕРТ (09–10.10.2026, ролики sites4, recordly, r39). Язык стиля 13
// (src/styles/expert.tsx): платиновая доска сверху, номер раздела моно-шрифтом, крупный заголовок с полосой акцента,
// белые карточки с тонкой рамкой, настоящие снимки сервисов в окне браузера, запись спикера на нижней части кадра,
// субтитры тёмной плашкой над швом. Здесь свой Reel, а не движок StyleReel: запись альбомная 1920×1080 ставится по
// ширине кадра целиком (810 px высотой), голова не режется, доска растёт до верха записи. Вертикальная запись
// занимает нижнюю половину, как в движке. Карта сцен и тексты у каждого ролика свои (пример карты: patterns/reels/expert2-unlazy/DIRECTION.md).
export {E, k, lerp, MONO, SANS, springAt};

export const BW = 1440, BH = 2560;
export const ZX = 150, ZW = 1140;                       // графика в x 150…1290: Instagram срезает бока на 68…130 px
export const INK = '#111316', SUB = '#6B7078';
export const ORANGE = '#FF7A2F', MINT = '#3DEDC3', MINT_INK = '#05231D', RED = '#FF4B4B', CLAUDE = '#D97757';
export const SFX_GAIN = 0.37;

export const fmt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
export const typed = (s: string, t: number, a: number, b: number) => s.slice(0, Math.round(s.length * k(t, a, b, (v) => v)));
export const rise = (p: number, dy = 60): React.CSSProperties => ({opacity: Math.min(1, p * 1.6), transform: `translateY(${(1 - p) * dy}px) scale(${0.95 + 0.05 * p})`});
// затухающая пружина с перелётом (кнопки, перестановка списка)
export const wob = (t: number, at: number) => (t < at ? 0 : 1 - Math.exp(-7 * (t - at)) * Math.cos(14 * (t - at)));
export const pulse = (t: number, f = 3, a = 0.03) => 1 + Math.sin(t * f) * a;

// === запись и раскладка ===
export type Rec = {src: string | null; w: number; h: number; faceTop?: number}; // src null: заглушка вместо записи
export type Geo = {boardH: number; recTop: number; recH: number; ty: number; ly: number; zb: number; capY: number; land: boolean};
export const geoOf = (r: Rec): Geo => {
  const land = r.w > r.h;
  const recH = land ? Math.round((BW * r.h) / r.w) : BH / 2;          // 1920×1080 → 810 px по ширине кадра; вертикальная: нижняя половина
  const boardH = BH - recH;                                           // 1750 или 1280
  return {boardH, recTop: boardH, recH, ty: land ? 290 : 250, ly: land ? 205 : 170, zb: boardH - 200, capY: boardH - 105, land};
};
// Верх содержимого под заголовком из n строк кегля size
export const below = (g: Geo, n: number, size: number, gap = 70) => g.ty + n * size * 1.08 + gap;

const RecLayer: React.FC<{rec: Rec; g: Geo}> = ({rec, g}) => {
  const vh = g.land ? g.recH : Math.round((BW * rec.h) / rec.w);
  const top = g.land ? 0 : -Math.round(vh * (rec.faceTop ?? 0.22));   // вертикальная: окно от faceTop до faceTop + 50% высоты записи
  return (
    <>
      <div style={{position: 'absolute', left: 0, top: g.recTop, width: BW, height: g.recH, overflow: 'hidden', background: '#0B0D10'}}>
        {/* maxWidth: 'none' обязателен: Tailwind иначе сжимает запись по ширине */}
        {rec.src ? <Video src={staticFile(rec.src)} muted style={{position: 'absolute', left: 0, top, width: BW, height: vh, maxWidth: 'none', maxHeight: 'none'}} /> : <RecStub />}
      </div>
      <div style={{position: 'absolute', left: 0, top: g.recTop, width: BW, height: 40, background: 'linear-gradient(180deg, rgba(0,0,0,.28), rgba(0,0,0,0))', pointerEvents: 'none'}} />
    </>
  );
};

// === доска: платиновый свет от угла меняет цвет и сторону на каждой сцене, по доске идёт диагональный блик ===
const Board: React.FC<{t: number; i: number; at: number; g: Geo; label: string}> = ({t, i, at, g, label}) => {
  const w = BW, h = g.boardH;
  const glow = ['255,122,47', '61,237,195', '255,255,255'][i % 3], alpha = [0.22, 0.26, 0.9][i % 3];
  const cx = [0.95, 0.05, 0.85][i % 3] * w + Math.sin(t * 0.4) * 40, cy = [0.05, 0.1, 0.95][i % 3] * h;
  const sheen = ((t * 0.06 + i * 0.3) % 1.6) - 0.3;
  return (
    <AbsoluteFill style={{background: '#0B0D10'}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: w, height: h, overflow: 'hidden', background: 'linear-gradient(160deg, #F8F9FA 0%, #E7E9EC 100%)'}}>
        <div style={{position: 'absolute', left: cx - w * 0.7, top: cy - w * 0.7, width: w * 1.4, height: w * 1.4, borderRadius: '50%',
          background: `radial-gradient(closest-side, rgba(${glow},${alpha}), rgba(${glow},0))`}} />
        <div style={{position: 'absolute', left: -w * 0.5 + sheen * w, top: -h * 0.2, width: w * 0.5, height: h * 1.4, transform: 'rotate(18deg)',
          background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.55), rgba(255,255,255,0))'}} />
      </div>
      <div style={{position: 'absolute', left: ZX + 6, top: g.ly, fontFamily: MONO, fontWeight: 700, fontSize: 36, letterSpacing: '.06em', color: '#7C8189',
        opacity: k(t, at - 0.2, at + 0.3), whiteSpace: 'nowrap'}}>
        <span style={{color: ORANGE}}>●</span>{' '}{label}
      </div>
    </AbsoluteFill>
  );
};

// === заголовок: слова поднимаются из размытия, под ним растёт полоса акцента. Кегль сжимается, если строка шире зоны ===
export const Title: React.FC<{t: number; at: number; lines: string[]; size?: number; y: number; hideAt?: number; accent?: string; bar?: boolean; step?: number; color?: string}> =
  ({t, at, lines, size = 112, y, hideAt, accent, bar = true, step = 0.1, color = INK}) => {
    const font = fontSpec(800, size, SANS);
    const ready = useFontsReady([font]);
    if (!ready) return null;
    const widths = lines.map((l) => textWidth(l, font, size, -0.035));
    const wMax = Math.max(...widths);
    const fs = Math.min(size, (size * (ZW - 8)) / wMax);
    const op = hideAt === undefined ? 1 : 1 - k(t, hideAt, hideAt + 0.25, E.inOut);
    if (op <= 0) return null;
    return (
      <div style={{position: 'absolute', left: 0, top: 0, width: BW, height: BH, opacity: op, pointerEvents: 'none'}}>
        {lines.map((l, i) => (
          <Words key={i} t={t} at={at + i * 0.16} text={l} size={fs} color={color} x={ZX} y={y + i * fs * 1.08} w={ZW + 160} family={SANS} step={step} accent={accent} accentColor={ORANGE} />
        ))}
        {bar ? <div style={{position: 'absolute', left: ZX, top: y + lines.length * fs * 1.08 + 4, height: 12, borderRadius: 4, background: ORANGE,
          width: Math.max(260, (wMax * fs) / size) * k(t, at + 0.35, at + 0.8, E.out)}} /> : null}
      </div>
    );
  };

// === карточки и мелкие детали ===
export const CARD = {borderRadius: 26, background: '#FFFFFF', boxShadow: '0 0 0 2px rgba(17,19,22,.07), 0 24px 48px rgba(17,19,22,.14)'} as const;
export const Card: React.FC<{x: number; y: number; w: number; h: number; p?: number; r?: number; dy?: number; clip?: boolean; style?: React.CSSProperties; children?: React.ReactNode}> =
  ({x, y, w, h, p = 1, r = 26, dy = 60, clip = true, style, children}) => (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, ...CARD, borderRadius: r, overflow: clip ? 'hidden' : 'visible', ...rise(p, dy), ...style}}>{children}</div>
  );

export const T: React.FC<{x: number; y: number; size: number; weight?: number; color?: string; mono?: boolean; w?: number; align?: 'left' | 'center' | 'right'; op?: number; style?: React.CSSProperties; children: React.ReactNode}> =
  ({x, y, size, weight = 800, color = INK, mono, w, align = 'left', op = 1, style, children}) => (
    <div style={{position: 'absolute', left: x, top: y, width: w, textAlign: align, fontFamily: mono ? MONO : SANS, fontWeight: weight, fontSize: size, lineHeight: 1.1, color, whiteSpace: 'nowrap', opacity: op,
      letterSpacing: mono ? '.02em' : '-0.02em', ...style}}>{children}</div>
  );

// Пилюля по ширине своего текста (замер после загрузки шрифта); p: пружина появления
export const Pill: React.FC<{p?: number; x: number; y: number; label: string; size?: number; bg?: string; ink?: string; icon?: React.ReactNode; iconW?: number; align?: 'left' | 'center' | 'right'; weight?: number; ring?: string}> =
  ({p = 1, x, y, label, size = 52, bg = '#FFFFFF', ink = INK, icon, iconW, align = 'left', weight = 800, ring}) => {
    const font = fontSpec(weight, size, SANS);
    const ready = useFontsReady([font]);
    if (!ready || p <= 0) return null;
    const pad = size * 0.7, h = size * 1.75, gap = icon ? size * 0.4 : 0, iw = icon ? iconW ?? size * 1.1 : 0;
    const w = textWidth(label, font, size) + pad * 2 + (icon ? iw + gap : 0);
    return (
      <div style={{position: 'absolute', left: align === 'center' ? x - w / 2 : align === 'right' ? x - w : x, top: y, width: w, height: h, borderRadius: h / 2, background: bg, color: ink, display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap, padding: `0 ${pad}px`, boxSizing: 'border-box', whiteSpace: 'nowrap', fontFamily: SANS, fontWeight: weight, fontSize: size, letterSpacing: '-0.01em',
        boxShadow: `${ring ? `0 0 0 3px ${ring}, ` : ''}0 0 0 2px rgba(17,19,22,.06), 0 14px 30px rgba(17,19,22,.16)`, opacity: Math.min(1, p * 2), transform: `scale(${0.7 + 0.3 * Math.min(1.1, p)})`}}>
        {icon}{label}
      </div>
    );
  };
export const pillW = (label: string, size = 52, weight = 800, icon = 0) => textWidth(label, fontSpec(weight, size, SANS), size) + size * 1.4 + (icon ? icon + size * 0.4 : 0);

// Знак сервиса, окрашенный маской (у SVG-знаков из brand/ нет фирменной заливки)
export const Mark: React.FC<{src: string; size: number; color: string; style?: React.CSSProperties}> = ({src, size, color, style}) => {
  const u = `url(${staticFile(src)})`;
  return <div style={{width: size, height: size, flex: 'none', background: color, WebkitMaskImage: u, maskImage: u, WebkitMaskSize: 'contain', maskSize: 'contain', WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskPosition: 'center', ...style}} />;
};
// Белая плитка со знаком внутри
export const Tile: React.FC<{size: number; bg?: string; style?: React.CSSProperties; children?: React.ReactNode; r?: number}> = ({size, bg = '#FFFFFF', style, children, r}) => (
  <div style={{width: size, height: size, borderRadius: r ?? size * 0.26, background: bg, display: 'grid', placeItems: 'center', flex: 'none', overflow: 'hidden',
    boxShadow: '0 0 0 2px rgba(17,19,22,.06), 0 18px 36px rgba(17,19,22,.2)', ...style}}>{children}</div>
);
export const Pic: React.FC<{src: string; w: number; h?: number; style?: React.CSSProperties}> = ({src, w, h, style}) => (
  <Img src={staticFile(src)} style={{width: w, height: h ?? w, objectFit: 'contain', maxWidth: 'none', maxHeight: 'none', ...style}} />
);

export const Tick: React.FC<{size: number; on: number; color?: string; off?: string}> = ({size, on, color = MINT, off = '#B4BAC2'}) => (
  <svg width={size} height={size} viewBox="0 0 40 40" style={{flex: 'none', overflow: 'visible'}}>
    <rect x={2} y={2} width={36} height={36} rx={10} fill={on > 0 ? color : 'none'} stroke={on > 0 ? color : off} strokeWidth={3.5} />
    <path d="M10 21 L17 28 L31 12" fill="none" stroke={MINT_INK} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${Math.min(1, on)} 1`} opacity={on > 0 ? 1 : 0} />
  </svg>
);
export const Plane: React.FC<{size: number; color?: string}> = ({size, color = '#FFFFFF'}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"><path d="M22 3 L9.2 10.1 M22 3 L15 21 L11.2 13.8 L3 10 Z" /></svg>
);
export const Cursor: React.FC<{x: number; y: number; op?: number; press?: number}> = ({x, y, op = 1, press = 0}) => (
  <div style={{position: 'absolute', left: x, top: y, width: 0, height: 0, opacity: op, pointerEvents: 'none'}}>
    {press > 0 ? <div style={{position: 'absolute', left: -50, top: -50, width: 100, height: 100, borderRadius: '50%', border: `5px solid ${ORANGE}`, opacity: 1 - press, transform: `scale(${0.3 + press * 0.9})`}} /> : null}
    <svg width={60} height={72} viewBox="0 0 34 46" style={{position: 'absolute', left: -4, top: -2, transform: `scale(${1 - 0.1 * Math.sin(Math.PI * Math.min(1, press))})`, filter: 'drop-shadow(0 6px 8px rgba(0,0,0,.3))'}}>
      <path d="M4 2 L4 38 L13 30 L19 44 L26 41 L20 27 L32 27 Z" fill={INK} stroke="#FFFFFF" strokeWidth={2.5} strokeLinejoin="round" />
    </svg>
  </div>
);

export const CheckIco: React.FC<{size: number; color?: string}> = ({size, color = MINT_INK}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3.4} strokeLinejoin="round" strokeLinecap="round" style={{flex: 'none'}}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
export const StarIco: React.FC<{size: number}> = ({size}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{flex: 'none'}}><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill="#F5B301" /></svg>
);
export const CopyIco: React.FC<{size: number; color?: string}> = ({size, color = INK}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round"><path d="M8 8 H19 V19 H8 Z M5 16 V5 H16" /></svg>
);

// Поле комментария с кодовым словом: слово печатается ta…tb, после send кнопка отправки оранжевая, каретка гаснет
export const CommentField: React.FC<{t: number; at: number; x: number; y: number; w: number; h?: number; word: string; ta: number; tb: number; send: number}> =
  ({t, at, x, y, w, h = 170, word, ta, tb, send}) => {
    const p = springAt(t, at), s = typed(word, t, ta, tb), sent = t >= send;
    return (
      <Card x={x} y={y} w={w} h={h} p={p} r={h / 2} dy={50}>
        <div style={{position: 'absolute', left: h * 0.2, top: h * 0.2, width: h * 0.6, height: h * 0.6, borderRadius: '50%', background: 'linear-gradient(140deg, #FFB37A, #FF7A2F)'}} />
        <div style={{position: 'absolute', left: h * 1.0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontFamily: SANS, fontWeight: s ? 800 : 500, fontSize: s ? h * 0.42 : h * 0.3,
          color: s ? INK : '#9AA0A8', whiteSpace: 'nowrap', letterSpacing: '-0.02em'}}>
          {s || 'Добавьте комментарий…'}
          {!sent && t > ta - 0.3 ? <span style={{color: ORANGE, marginLeft: 6, opacity: Math.floor(t * 3) % 2}}>|</span> : null}
        </div>
        <div style={{position: 'absolute', right: h * 0.17, top: h * 0.17, width: h * 0.66, height: h * 0.66, borderRadius: '50%', background: sent ? ORANGE : '#E3E5E8', display: 'grid', placeItems: 'center',
          transform: `scale(${1 + 0.15 * Math.sin(Math.PI * k(t, send, send + 0.3))})`}}>
          <Plane size={h * 0.32} color={sent ? '#FFFFFF' : '#9AA0A8'} />
        </div>
      </Card>
    );
  };

// === окно браузера с настоящим снимком сервиса: появляется пружиной, картинка медленно ездит (from → to, доли свободного хода) ===
export const Shot: React.FC<{t: number; at: number; x: number; y: number; w: number; h: number; src: string; iw: number; ih: number; url?: string; zoom?: number;
  from?: [number, number]; to?: [number, number]; pa?: number; pb?: number; out?: number; children?: React.ReactNode}> =
  ({t, at, x, y, w, h, src, iw, ih, url, zoom = 1, from = [0.5, 0], to = [0.5, 0.3], pa, pb, out, children}) => {
    const p = springAt(t, at), bar = 64, body = h - bar;
    const imgW = w * zoom, imgH = (ih * imgW) / iw;
    const q = k(t, pa ?? at + 0.8, pb ?? at + 3.4, E.inOut);
    const px = lerp(from[0], to[0], q), py = lerp(from[1], to[1], q);
    const o = out === undefined ? 1 : 1 - k(t, out, out + 0.25, E.inOut);
    if (p <= 0 || o <= 0) return null;
    return (
      <div style={{position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: 28, overflow: 'hidden', background: '#FFFFFF', boxShadow: '0 0 0 2px rgba(17,19,22,.08), 0 34px 70px rgba(17,19,22,.2)',
        ...rise(p, 90), opacity: Math.min(1, p * 1.6) * o}}>
        <Img src={staticFile(src)} style={{position: 'absolute', left: -(imgW - w) * px, top: bar - Math.max(0, imgH - body) * py, width: imgW, height: imgH, maxWidth: 'none', maxHeight: 'none'}} />
        <div style={{position: 'absolute', left: 0, top: 0, width: w, height: bar, zIndex: 1, display: 'flex', alignItems: 'center', gap: 12, padding: '0 22px', boxSizing: 'border-box', background: '#F1F2F4',
          boxShadow: 'inset 0 -1px 0 rgba(17,19,22,.1)'}}>
          {['#FF6159', '#FFBD2E', '#28C941'].map((c) => <span key={c} style={{width: 18, height: 18, borderRadius: '50%', background: c, flex: 'none'}} />)}
          {url ? (
            <Fit name={`url:${url}`} style={{marginLeft: 16, flex: 1, height: bar * 0.62, borderRadius: bar * 0.31, background: '#FFFFFF', display: 'flex', alignItems: 'center', padding: '0 22px', boxSizing: 'border-box',
              overflow: 'hidden', whiteSpace: 'nowrap', fontFamily: MONO, fontWeight: 600, fontSize: 32, lineHeight: 1, color: '#5E636B'}}>{url}</Fit>
          ) : null}
        </div>
        <div style={{position: 'absolute', left: 0, top: bar, width: w, height: body, overflow: 'hidden'}}>{children}</div>
      </div>
    );
  };

// === слова записи: тайминги из words.json, правки написания только для субтитров ===
export type RawWord = {w: string; t0: number; t1: number};
const core = (s: string) => s.toLowerCase().replace(/[.,!?:;"«»]/g, '');
const quotes = (s: string) => s.replace(/^"/, '«').replace(/"(?=[.,!?:;]*$)/, '»');
// rules: [«слова записи через пробел в нижнем регистре», «замена через пробел»]; тайминг делится поровну, знаки препинания и кавычки сохраняются
export const capWords = (raw: RawWord[], rules: [string, string][] = []): Word[] => {
  const out: Word[] = [];
  for (let i = 0; i < raw.length;) {
    let hit = false;
    for (const [from, to] of rules) {
      const f = from.split(' ');
      if (f.every((x, j) => raw[i + j] && core(raw[i + j].w) === x)) {
        const a = raw[i], b = raw[i + f.length - 1];
        const lead = a.w.match(/^["«]*/)![0], trail = b.w.match(/["»]*[.,!?:;]*$/)![0];
        const toks = to.split(' '), span = (b.t1 - a.t0) / toks.length;
        toks.forEach((tk, j) => out.push({text: quotes((j === 0 ? lead : '') + tk + (j === toks.length - 1 ? trail : '')), start: a.t0 + span * j, end: a.t0 + span * (j + 1)}));
        i += f.length;
        hit = true;
        break;
      }
    }
    if (!hit) { out.push({text: quotes(raw[i].w), start: raw[i].t0, end: raw[i].t1}); i++; }
  }
  return out;
};

// === сборка ролика ===
export type Tr = 'blur' | 'whipL' | 'whipR';
export type SceneP = {t: number; g: Geo};
export type Scn = {at: number; label: string; C: React.FC<SceneP>; tr?: Tr};
export type Cue = [number, string, number];
const TRANS = 0.5;
const presentation = (tr: Tr) => (tr === 'blur' ? blurThrough({color: '#EEF0F2'}) : whip({dir: tr === 'whipL' ? 'left' : 'right'})) as never;

const Shell: React.FC<{s: Scn; i: number; g: Geo; start: number}> = ({s, i, g, start}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = start + frame / fps;
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <Board t={t} i={i} at={s.at} g={g} label={s.label} />
      <s.C t={t} g={g} />
    </AbsoluteFill>
  );
};

export const ExpertReel: React.FC<{rec: Rec; dur: number; scenes: Scn[]; words: Word[]; cues: Cue[]}> = ({rec, dur, scenes, words, cues}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps, g = geoOf(rec), TF = Math.round(TRANS * fps);
  const seq: Tr[] = ['blur', 'whipL', 'blur', 'whipR'];
  const all: Cue[] = [...scenes.slice(1).map((s): Cue => [s.at - 0.05, 'ui-slide', 0.24]), ...cues];
  return (
    <AbsoluteFill style={{background: '#0B0D10'}}>
      <TransitionSeries>
        {scenes.flatMap((s, i) => {
          const start = i === 0 ? 0 : s.at;
          const end = i < scenes.length - 1 ? scenes[i + 1].at + TRANS : dur;
          const el = (
            <TransitionSeries.Sequence key={`s${i}`} durationInFrames={Math.max(TF + 1, Math.round((end - start) * fps))}>
              <Shell s={s} i={i} g={g} start={start} />
            </TransitionSeries.Sequence>
          );
          return i === 0 ? [el] : [<TransitionSeries.Transition key={`t${i}`} presentation={presentation(s.tr ?? seq[(i - 1) % 4])} timing={linearTiming({durationInFrames: TF})} />, el];
        })}
      </TransitionSeries>
      <RecLayer rec={rec} g={g} />
      {/* голос берём из самой записи rm/<id>/rec.mp4 (audio.mp3 моно 16 кГц, только для распознавания), картинка записи без звука */}
      {rec.src ? <Audio src={staticFile(rec.src)} /> : null}
      <Captions t={t} words={words} cx={BW / 2} cy={g.capY} maxW={1100} size={53.3} frameW={BW} frameH={BH} />
      {all.map(([at, name, v], i) => (
        <Sequence key={i} from={Math.max(0, Math.round(at * fps))} durationInFrames={Math.round(2.5 * fps)} layout="none">
          <Audio src={staticFile(`sfx/${name}.wav`)} volume={v * SFX_GAIN} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
