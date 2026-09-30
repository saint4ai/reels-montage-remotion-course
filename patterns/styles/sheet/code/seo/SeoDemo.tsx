import {AbsoluteFill, Easing, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import RAW from './data/seo-words.json';
import {CV, CX, INK, ISLA, k, ORANGE, SF, spr, Word} from '../tildify/TildifyDemo';

// Демо 13 с OpenSEO (28.09.2026) — стиль 14 ЛИСТ, но фоны другие (правка Александра): у каждого смыслового блока свой лист —
// графит с искрами («сгорел»), мятный, оранжевый, тёмно-мятный, чёрный с прожектором. Сетка, пара шрифтов SF Pro + Coolvetica,
// плашки с пружиной, рисованные стрелки и карточка спикера — как в ЛИСТЕ. Цифры из речи и источников: 21 тыс. звёзд (GitHub API 21 045),
// «продукт дня» Product Hunt (#1 Product of the Day, 19.07.2026). Расшифровка: «Samrush» = Semrush, «Cloud» = Claude.
export const SEO_DEMO_FRAMES = Math.round(13.3 * 60);
const END = 13.3;
export const W = (RAW as {text: string; start: number}[]).map((w) => w.start);
export const SC = [0, W[16] - 0.1, W[32] - 0.1, END];
export const WHITE = '#F2F3F5';

export type Kind = 'white' | 'black';
export const PAL = {white: {bg: '#F6F5F1', grid: 'rgba(17,19,22,.07)', plane: 'rgba(17,19,22,.035)', ink: INK, grey: '#6B7078', rule: 'rgba(17,19,22,.28)'},
  black: {bg: '#0E0F11', grid: 'rgba(255,255,255,.07)', plane: 'rgba(255,255,255,.03)', ink: WHITE, grey: '#8A9096', rule: 'rgba(255,255,255,.3)'}};
// Фон: только белый или чёрный лист (правка Александра 28.09) + бледные косые плоскости; сетка — только пятном вокруг текста, как в референсе
export const Sheet: React.FC<{kind: Kind; t: number}> = ({kind, t}) => (
  <AbsoluteFill style={{background: PAL[kind].bg}}>
    <div style={{position: 'absolute', left: 440, top: -300 + Math.sin(t * 0.4) * 30, width: 1000, height: 700, background: PAL[kind].plane, transform: 'rotate(28deg)'}} />
    <div style={{position: 'absolute', left: -380, top: 1380 - Math.sin(t * 0.4) * 30, width: 900, height: 600, background: PAL[kind].plane, transform: 'rotate(-32deg)'}} />
  </AbsoluteFill>
);
export const GridPatch: React.FC<{kind: Kind; cy: number; w?: number; h?: number}> = ({kind, cy, w = 1000, h = 900}) => (
  <div style={{position: 'absolute', left: CX - w / 2, top: cy - h / 2, width: w, height: h,
    backgroundImage: `linear-gradient(${PAL[kind].grid} 2px, transparent 2px), linear-gradient(90deg, ${PAL[kind].grid} 2px, transparent 2px)`, backgroundSize: '64px 64px', backgroundPosition: 'center',
    WebkitMaskImage: 'radial-gradient(closest-side, #000 45%, transparent 100%)', maskImage: 'radial-gradient(closest-side, #000 45%, transparent 100%)'}} />
);
// Текстовый блок как в референсе: одна колонка по центру, ровный ритм — малая строка, цветная строка, черта, плашка, мелкий абзац
export const Block: React.FC<{kind: Kind; top: number; kicker: React.ReactNode; lead?: React.ReactNode; rule?: number; plate?: React.ReactNode; para?: string; t: number; paraAt?: number; paraEnd?: number}> =
  ({kind, top, kicker, lead, rule = 0, plate, para, t, paraAt = 0, paraEnd = 0}) => {
    const shown = para ? para.slice(0, Math.round(para.length * k(t, paraAt, paraEnd, (v) => v))) : '';
    return (
      <div style={{position: 'absolute', left: CX - 432, top, width: 864, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'}}>
        <div style={{fontFamily: SF, fontWeight: 400, fontSize: 54, lineHeight: 1.1, color: PAL[kind].ink}}>{kicker}</div>
        {lead ? <div style={{fontFamily: SF, fontWeight: 600, fontSize: 84, lineHeight: 1.1, color: ORANGE, marginTop: 6, letterSpacing: '-0.01em'}}>{lead}</div> : null}
        <div style={{width: 560 * rule, height: 2, background: PAL[kind].rule, marginTop: 30, marginBottom: 34}} />
        <div style={{minHeight: 150, display: 'flex', alignItems: 'center'}}>{plate}</div>
        {para ? <div style={{marginTop: 40, width: 760, minHeight: 92, fontFamily: SF, fontWeight: 400, fontSize: 32, lineHeight: 1.4, color: PAL[kind].grey,
          WebkitMaskImage: 'linear-gradient(180deg, #000 55%, rgba(0,0,0,.25) 100%)', maskImage: 'linear-gradient(180deg, #000 55%, rgba(0,0,0,.25) 100%)'}}>{shown}</div> : null}
      </div>
    );
  };
// Плашка в потоке: Coolvetica на оранжевом, наклон, пружина, нижняя грань и тень
export const PlateIn: React.FC<{t: number; at: number; fps: number; size: number; bg?: string; fg?: string; edge?: string; children: React.ReactNode}> =
  ({t, at, fps, size, bg = ORANGE, fg = '#FFFFFF', edge = '#C24F14', children}) => {
    const p = spr(t, at, fps, 11, 190);
    return <div style={{transform: `rotate(${-2 - 5 * (1 - Math.min(1, p))}deg) scale(${0.55 + 0.45 * p})`, opacity: Math.min(1, p * 2), padding: `${size * 0.12}px ${size * 0.3}px ${size * 0.06}px`,
      background: bg, borderRadius: 20, fontFamily: CV, fontSize: size, lineHeight: 1, color: fg, whiteSpace: 'nowrap',
      boxShadow: `inset 0 3px 0 rgba(255,255,255,.3), 0 10px 0 ${edge}, 0 34px 50px rgba(0,0,0,.22)`}}>{children}</div>;
  };
export const Row: React.FC<{y: number; size: number; weight?: number; color: string; children: React.ReactNode}> = ({y, size, weight = 400, color, children}) => (
  <div style={{position: 'absolute', left: CX - 432, top: y, width: 864, textAlign: 'center', fontFamily: SF, fontWeight: weight, fontSize: size, lineHeight: 1.15, color}}>{children}</div>
);
export const lineIn = (t: number, a: number) => k(t, a - 0.05, a + 0.35, Easing.bezier(0.65, 0, 0.35, 1));

// Сцена 1 (белый, 0–6 с, без смены листа): «Короче, один разработчик так сгорел от цен на SEO-сервисы, что написал свою
// бесплатную замену Semrush» — блок заголовка отъезжает вверх, снизу выходит карточка Semrush, её перечёркивают и клеят стикер
export const S1: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const lift = k(t, W[9] - 0.15, W[9] + 0.45, Easing.bezier(0.65, 0, 0.35, 1)), card = spr(t, W[9] - 0.05, fps, 14, 150);
  const strike = k(t, W[12] - 0.05, W[12] + 0.3, Easing.bezier(0.65, 0, 0.35, 1)), sticker = spr(t, W[13] - 0.05, fps, 10, 200);
  return (
    <>
      <GridPatch kind="white" cy={820} h={1000} />
      <div style={{position: 'absolute', inset: 0, transform: `scale(${1 - 0.08 * lift})`, transformOrigin: '720px 520px'}}>
        <Block kind="white" top={520} t={t} rule={lineIn(t, W[5])}
          kicker={<><Word t={t} at={W[0]}>Короче,</Word> <Word t={t} at={W[1]}>один</Word> <Word t={t} at={W[2]}>разработчик</Word></>}
          lead={<><Word t={t} at={W[3]}>так</Word> <Word t={t} at={W[4]}>сгорел</Word> <Word t={t} at={W[5]}>от цен</Word></>}
          plate={<PlateIn t={t} at={W[7] - 0.05} fps={fps} size={104}>на SEO-сервисы</PlateIn>} />
      </div>
      <Row y={950} size={54} color={INK}><Word t={t} at={W[9]}>что</Word> <Word t={t} at={W[10]}>написал</Word> <Word t={t} at={W[11]}>свою</Word></Row>
      <div style={{position: 'absolute', left: CX - 330, top: 1040, width: 660, height: 230, borderRadius: 34, background: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 30, padding: '0 50px',
        opacity: Math.min(1, card * 2), transform: `translateY(${(1 - Math.min(1, card)) * 200}px) rotate(-2deg)`, boxShadow: '0 0 0 2px rgba(17,19,22,.06), 0 30px 60px rgba(17,19,22,.16)'}}>
        <Img src={staticFile('seo/semrush-color.svg')} style={{width: 120, height: 120}} />
        <div style={{textAlign: 'left'}}>
          <div style={{fontFamily: SF, fontWeight: 700, fontSize: 72, color: INK, lineHeight: 1}}>Semrush</div>
          <div style={{fontFamily: SF, fontWeight: 400, fontSize: 38, color: '#6B7078', marginTop: 10}}>платный SEO-сервис</div>
        </div>
        <div style={{position: 'absolute', left: -20, top: 104, height: 22, width: `calc((100% + 40px) * ${strike})`, borderRadius: 11, background: ORANGE, transform: 'rotate(-5deg)', transformOrigin: 'left'}} />
      </div>
      <div style={{position: 'absolute', left: CX + 70, top: 1235, transform: `translateX(-50%) rotate(${7 - 10 * (1 - Math.min(1, sticker))}deg) scale(${1.6 - 0.6 * Math.min(1, sticker)})`, opacity: Math.min(1, sticker * 2),
        padding: '16px 34px 10px', borderRadius: 18, background: INK, fontFamily: CV, fontSize: 72, lineHeight: 1, color: '#FFFFFF', whiteSpace: 'nowrap', boxShadow: '0 10px 0 #000, 0 30px 40px rgba(17,19,22,.3)'}}>
        бесплатная замена
      </div>
    </>
  );
};
// Барабан одометра: у каждого разряда полоса 0…9 крутится непрерывно, младшие разряды — быстрее и со смазом
export const Odometer: React.FC<{value: number; size: number; color: string}> = ({value, size, color}) => {
  const digits = 5, cw = size * 0.6, h = size * 1.05;
  const cols = Array.from({length: digits}, (_, i) => digits - 1 - i);   // разряд: 4 … 0
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 0}}>
      {cols.map((place, i) => {
        const m = 10 ** place, pos = (Math.floor(value / m) % 10) + (place === 0 ? value % 1 : Math.min(1, Math.max(0, (value % m) - (m - 1)))), speed = place <= 1 ? 1 : 0, lead = value < m && place > 0;
        return (
          <div key={place} style={{display: 'flex', alignItems: 'center'}}>
            {i === 2 ? <div style={{width: size * 0.22}} /> : null}
            <div style={{width: cw, height: h, overflow: 'hidden', position: 'relative', opacity: lead ? 0.25 : 1}}>
              <div style={{position: 'absolute', left: 0, top: -pos * h, width: cw, filter: speed && value < 20900 ? `blur(${3 + 3 * (1 - place)}px)` : undefined}}>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d, j) => <div key={j} style={{height: h, lineHeight: `${h}px`, textAlign: 'center', fontFamily: CV, fontSize: size, color}}>{d}</div>)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
// Сцена 2 (чёрный, 6–11,4 с, без смены листа): «Она стала продуктом дня на Product Hunt, а сейчас у неё 21 тысяча звёзд на GitHub»
// значок Product Hunt, затем он уезжает вверх якорем, снизу — крутящийся счётчик звёзд до 21 045 и кнопка Star
export const S2: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const up = k(t, W[23] - 0.15, W[23] + 0.45, Easing.bezier(0.65, 0, 0.35, 1)), odo = spr(t, W[23] + 0.05, fps, 14, 150);
  const v = Math.min(21045, 21045 * k(t, W[25], W[29] + 0.1, Easing.bezier(0.3, 0.05, 0.2, 1)) + 0.0001), btn = spr(t, W[30] - 0.15, fps, 12, 180), done = v > 21040 ? k(t, W[29] + 0.1, W[29] + 0.4) : 0;
  return (
    <>
      <GridPatch kind="black" cy={820} h={1100} />
      <div style={{position: 'absolute', inset: 0, transform: `translateY(${-40 * up}px) scale(${1 - 0.22 * up})`, transformOrigin: '720px 500px'}}>
        <Block kind="black" top={500} t={t} rule={lineIn(t, W[18])}
          kicker={<><Word t={t} at={W[16]}>Она</Word> <Word t={t} at={W[17]}>стала</Word></>}
          lead={<><Word t={t} at={W[18]}>продуктом</Word> <Word t={t} at={W[19]}>дня</Word></>}
          plate={<PlateIn t={t} at={W[19] - 0.05} fps={fps} size={60} bg="#FFFFFF" fg={INK} edge="#9AA0A6">
            <span style={{display: 'inline-flex', alignItems: 'center', gap: 20, fontFamily: SF, fontWeight: 800}}><Img src={staticFile('seo/producthunt-color.svg')} style={{width: 80, height: 80}} />#1 Product of the Day</span></PlateIn>} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 830, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: Math.min(1, odo * 2), transform: `translateY(${(1 - Math.min(1, odo)) * 160}px)`}}>
        <div style={{fontFamily: SF, fontWeight: 400, fontSize: 54, color: WHITE}}><Word t={t} at={W[23]}>а</Word> <Word t={t} at={W[24]}>сейчас</Word> <Word t={t} at={W[25]}>у</Word> <Word t={t} at={W[26]}>неё</Word></div>
        <div style={{marginTop: 20, filter: `drop-shadow(0 0 ${40 * done}px rgba(255,122,47,.7))`}}><Odometer value={v} size={230} color={v > 21040 ? ORANGE : '#FFFFFF'} /></div>
        <div style={{marginTop: 26, transform: `scale(${0.6 + 0.4 * Math.min(1.05, btn)})`, opacity: Math.min(1, btn * 2), display: 'flex', alignItems: 'center', gap: 20, padding: '20px 36px', borderRadius: 26,
          background: '#21262D', boxShadow: '0 0 0 3px rgba(255,255,255,.15), 0 30px 60px rgba(0,0,0,.5)'}}>
          <Img src={staticFile('seo/github.svg')} style={{width: 60, height: 60, filter: 'invert(1)'}} />
          <svg width={54} height={54} viewBox="0 0 24 24"><path d="M12 2.5 L14.9 8.6 L21.5 9.3 L16.5 13.8 L17.9 20.4 L12 17 L6.1 20.4 L7.5 13.8 L2.5 9.3 L9.1 8.6 Z" fill="#E3B341" /></svg>
          <span style={{fontFamily: SF, fontWeight: 600, fontSize: 54, color: '#F0F6FC'}}>звёзд на GitHub</span>
        </div>
      </div>
    </>
  );
};
// Сцена 3 (белый): «Называется OpenSEO» — иконка-ёлка, тёмная плашка названия, окно официального демо
export const S3: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const a = SC[2], icon = spr(t, a - 0.1, fps, 12, 150);
  return (
    <>
      <GridPatch kind="white" cy={700} />
      <div style={{position: 'absolute', left: CX - 120, top: 440, width: 240, height: 240, borderRadius: 56, overflow: 'hidden', opacity: Math.min(1, icon * 2),
        transform: `scale(${0.5 + 0.5 * Math.min(1.05, icon)})`, boxShadow: '0 30px 60px rgba(17,19,22,.25)'}}>
        <Img src={staticFile('seo/openseo-icon.png')} style={{width: '100%', height: '100%'}} />
      </div>
      <Block kind="white" top={700} t={t} rule={lineIn(t, W[32] + 0.3)}
        kicker={<Word t={t} at={W[32]}>Называется</Word>}
        plate={<PlateIn t={t} at={W[33] - 0.25} fps={fps} size={150} bg={INK} edge="#000">OpenSEO</PlateIn>} />
    </>
  );
};

const SCENES: [React.FC<{t: number; fps: number}>, Kind][] = [[S1, 'white'], [S2, 'black'], [S3, 'white']];
type E = [number, string, number, boolean?, number?];
const SFX: E[] = [
  [W[3] - 0.05, 'select', 0.26], [W[7] - 0.03, 'popup', 0.34],
  [W[9] - 0.1, 'sw-s7', 0.12, true], [W[9], 'es-open', 0.28], [W[12] - 0.05, 'crispy', 0.4], [W[13] - 0.03, 'hit2', 0.26],
  [SC[1], 'sw-s6', 0.14, true], [W[19] - 0.03, 'chime', 0.32], [W[23] - 0.1, 'sw-s4', 0.12, true], [W[25], 'count', 0.3], [W[27], 'count', 0.3], [W[29] + 0.1, 'confirm', 0.3], [W[30] - 0.1, 'pop', 0.3],
  [SC[2], 'sw-s1', 0.14, true], [W[33] - 0.05, 'popup', 0.34], [W[33] + 0.15, 'es-open', 0.3],
];

export const SeoDemo: React.FC = () => {
  const frame = useCurrentFrame(), {fps} = useVideoConfig(), t = frame / fps;
  const seg = Math.max(0, SC.findIndex((c, i) => t >= c && t < SC[i + 1]));
  const [Scene, kind] = SCENES[Math.min(SCENES.length - 1, seg)];
  const edge = Math.min(...SC.slice(1, -1).map((c) => Math.abs(t - c))), blur = interpolate(edge, [0, 0.16], [16, 0], {extrapolateRight: 'clamp'}), fade = interpolate(edge, [0, 0.16], [0.35, 1], {extrapolateRight: 'clamp'});
  const push = interpolate(t, [SC[seg], SC[seg + 1] ?? END], [1, 1.035], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <AbsoluteFill style={{filter: blur > 0.5 ? `blur(${blur}px)` : undefined, opacity: fade}}>
        <Sheet kind={kind} t={t} />
        <AbsoluteFill style={{transform: `scale(${push})`, transformOrigin: '720px 900px'}}><Scene t={t} fps={fps} /></AbsoluteFill>
      </AbsoluteFill>
      <div style={{position: 'absolute', left: CX - 380, top: 2400 - 720, width: 760, height: 720, borderRadius: 60, overflow: 'hidden', boxShadow: '0 0 0 4px rgba(255,255,255,.9), 0 40px 80px rgba(0,0,0,.3)'}}>
        <OffthreadVideo src={staticFile('seo/seo.mp4')} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 36%'}} />
      </div>
      {SFX.map(([at, c, v, pk, dd], i) => {
        const m = ISLA[c], from = Math.round((at - (pk ? m.peak : m.onset)) * fps);
        return <Sequence key={i} from={from} durationInFrames={Math.round((dd ?? (c.startsWith('type') ? 0.35 : m.dur)) * fps)} layout="none"><Audio src={staticFile(`sfx/isla/${c}.wav`)} volume={v} /></Sequence>;
      })}
    </AbsoluteFill>
  );
};
