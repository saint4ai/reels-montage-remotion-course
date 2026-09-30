import {AbsoluteFill, Easing, Img, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import RAW from './data/tildify-words.json';
import ISLA_RAW from '../doc/data/isla-sfx.json';

// Демо 10 с Tildify (27.09.2026) по референсу «белый редакционный лист» (reference/breakdowns/editorial-white-2026-09-27.md):
// один лист с сеткой на весь ролик, фраза гротеском SF Pro, одно слово-акцент Coolvetica, оранжевая плашка с пружиной,
// чёрные мазки-стрелки из углов, скобка-коннектор, выделение текста с ручками, настоящие интерфейсы крупно.
// Смена сцены — размытие старой и проявление новой на том же листе. Спикер — карточка Screen Studio внизу.
export const TILDIFY_DEMO_FRAMES = Math.round(10.4 * 60);
export const W = (RAW as {text: string; start: number}[]).map((w) => w.start);
export const CX = 720, INK = '#111316', ORANGE = '#FF7A2F', PAPER = '#F6F5F1', GREY = '#6B7078', SF = 'SF Pro Display', CV = 'Coolvetica';
const cl = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const k = (t: number, a: number, b: number, e = OUT) => interpolate(t, [a, b], [0, 1], {...cl, easing: e});
export const spr = (t: number, at: number, fps: number, damping = 12, stiffness = 170) => (t < at ? 0 : spring({frame: (t - at) * fps, fps, config: {damping, stiffness, mass: 1}}));
export const CUT = [0, W[11] - 0.1, W[22] - 0.04, W[27] - 0.06, 10.4];

// Слово проявляется из размытия с небольшим подъёмом (как в референсе «This is why»)
export const Word: React.FC<{t: number; at: number; children: React.ReactNode; style?: React.CSSProperties}> = ({t, at, children, style}) => {
  const p = k(t, at - 0.06, at + 0.3);
  return <span style={{display: 'inline-block', opacity: p, filter: p < 1 ? `blur(${(1 - p) * 12}px)` : undefined, transform: `translateY(${(1 - p) * 22}px)`, ...style}}>{children}</span>;
};
export const Row: React.FC<{y: number; size: number; weight?: number; color?: string; children: React.ReactNode}> = ({y, size, weight = 300, color = INK, children}) => (
  <div style={{position: 'absolute', left: CX - 432, top: y, width: 864, textAlign: 'center', fontFamily: SF, fontWeight: weight, fontSize: size, lineHeight: 1.15, color, wordSpacing: '0.04em'}}>{children}</div>
);
// Плашка: пружина масштаба и поворота, глубина — нижняя грань и тень
export const Plate: React.FC<{t: number; at: number; text: string; y: number; size: number; fps: number; r?: number}> = ({t, at, text, y, size, fps, r = -2}) => {
  const p = spr(t, at, fps, 11, 190);
  return (
    <div style={{position: 'absolute', left: CX, top: y, transform: `translateX(-50%) rotate(${r - 5 * (1 - Math.min(1, p))}deg) scale(${0.55 + 0.45 * p})`, opacity: Math.min(1, p * 2),
      width: 'max-content', padding: `${size * 0.1}px ${size * 0.28}px ${size * 0.04}px`, background: ORANGE, borderRadius: 18, fontFamily: CV, fontSize: size, lineHeight: 1, color: '#FFFFFF',
      boxShadow: `inset 0 3px 0 rgba(255,255,255,.35), 0 10px 0 #C24F14, 0 34px 50px rgba(120,45,0,.28)`}}>{text}</div>
  );
};
// Мазок-стрелка влетает из-за угла с размытием движения и дожимом
const Arrow: React.FC<{t: number; at: number; x: number; y: number; r: number; s?: number; fx: number; fy: number; fps: number}> = ({t, at, x, y, r, s = 1, fx, fy, fps}) => {
  const p = spr(t, at, fps, 13, 210);
  if (p <= 0) return null;
  return (
    <svg width={360 * s} height={360 * s} viewBox="0 0 100 100" style={{position: 'absolute', left: x + fx * (1 - p), top: y + fy * (1 - p), transform: `rotate(${r}deg)`,
      filter: `drop-shadow(0 14px 16px rgba(0,0,0,.28))${p < 0.9 ? ` blur(${(1 - p) * 10}px)` : ''}`}}>
      <path d="M 4 90 L 14 82 L 56 40 L 64 48 L 20 92 L 10 97 Z" fill={INK} />
      <path d="M 38 30 L 98 2 L 70 62 L 62 46 L 54 38 Z" fill={INK} />
    </svg>
  );
};
export const Logo: React.FC<{src: string; size: number; x: number; y: number; p: number}> = ({src, size, x, y, p}) => (
  <div style={{position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: size * 0.26, background: '#FFFFFF', display: 'grid', placeItems: 'center',
    opacity: Math.min(1, p * 2), transform: `scale(${0.5 + 0.5 * p}) translateY(${(1 - Math.min(1, p)) * 40}px)`, boxShadow: '0 2px 0 rgba(17,19,22,.06), 0 16px 30px rgba(17,19,22,.14)'}}>
    <Img src={staticFile(src)} style={{width: size * 0.62, height: size * 0.62, objectFit: 'contain'}} />
  </div>
);
export const typed = (s: string, t: number, a: number, b: number) => s.slice(0, Math.round(s.length * k(t, a, b, (v) => v)));

// Стрелка-маркер: жирный рукописный штрих рисуется к цели, наконечник раскрывается в конце (указывает на плашку)
export const Pointer: React.FC<{t: number; at: number; d: string; head: [number, number, number]}> = ({t, at, d, head}) => {
  const p = k(t, at, at + 0.3, Easing.bezier(0.45, 0, 0.2, 1)), h = k(t, at + 0.24, at + 0.38, Easing.bezier(0.2, 1.6, 0.4, 1));
  if (p <= 0) return null;
  const [hx, hy, ha] = head;
  return (
    <svg width={1440} height={1700} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', filter: 'drop-shadow(0 10px 10px rgba(17,19,22,.18))'}}>
      <path d={d} fill="none" stroke={INK} strokeWidth={16} strokeLinecap="round" pathLength={1} strokeDasharray={`${p} 1`} />
      <path d="M -44 -38 L 8 0 L -44 38" fill="none" stroke={INK} strokeWidth={16} strokeLinecap="round" strokeLinejoin="round"
        transform={`translate(${hx} ${hy}) rotate(${ha}) scale(${h})`} />
    </svg>
  );
};
// Сцена 1: «Сайт из Claude Code теперь переносится в Тильду за 5 шагов» — стрелки рисуются к плашке с двух сторон
export const S1: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const line = k(t, W[5], W[7] + 0.1, Easing.bezier(0.65, 0, 0.35, 1));
  return (
    <>
      <Logo src="tildify/claude.svg" size={170} x={CX - 170} y={505} p={spr(t, W[2] - 0.1, fps)} />
      <svg width={160} height={40} style={{position: 'absolute', left: CX - 80, top: 485}}>
        <path d="M8 20 H132 M116 6 L136 20 L116 34" stroke={INK} strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${line} 1`} />
      </svg>
      <Logo src="tildify/tilda-logo-a.svg" size={170} x={CX + 170} y={505} p={spr(t, W[7] - 0.1, fps)} />
      <Row y={640} size={68}><Word t={t} at={W[0]}>Сайт</Word> <Word t={t} at={W[1]}>из</Word> <Word t={t} at={W[2]}>Claude</Word> <Word t={t} at={W[3]}>Code</Word></Row>
      <Row y={725} size={76} weight={500}><Word t={t} at={W[5]}>переносится</Word> <Word t={t} at={W[6]}>в</Word> <Word t={t} at={W[7]}>Тильду</Word></Row>
      <div style={{position: 'absolute', left: CX - 150, top: 852, width: 300 * k(t, W[7], W[8]), height: 3, background: 'rgba(17,19,22,.25)'}} />
      <Plate t={t} at={W[8] - 0.04} text="за 5 шагов" y={895} size={176} fps={fps} />
      {/* стрелки указывают на плашку: слева снизу и справа снизу, рисуются после её появления */}
      <Pointer t={t} at={W[8] + 0.02} d="M 250 1380 C 250 1250, 300 1170, 360 1120" head={[360, 1120, -42]} />
      <Pointer t={t} at={W[8] + 0.1} d="M 1190 1380 C 1190 1250, 1140 1170, 1080 1120" head={[1080, 1120, 222]} />
      <Row y={1180} size={34} color={GREY}>{typed('без перевёрстки руками', t, W[10] + 0.1, W[11])}</Row>
    </>
  );
};
// Сцена 2 (как телефон с Gmail в референсе): большой тёмный телефон въезжает в наклоне, в поле редактора печатается
// «больше не надо перевёрстывать всё руками», затем «перевёрстывать всё руками» выделяется и стирается — это больше не нужно
export const S2: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const a = CUT[1], ph = spr(t, a - 0.02, fps, 15, 110);
  const keep = 'Больше не надо ', drop = 'перевёрстывать всё руками';
  const n1 = Math.round(keep.length * k(t, W[16] - 0.08, W[18] + 0.05, (v) => v)), n2 = Math.round(drop.length * k(t, W[19] - 0.05, W[20] + 0.1, (v) => v));
  const sel = k(t, W[21] + 0.22, W[21] + 0.34), del = k(t, W[21] + 0.4, W[21] + 0.48);
  const shown = del >= 1 ? '' : drop.slice(0, n2);
  const Row2: React.FC<{label: string; value: React.ReactNode}> = ({label, value}) => (
    <div style={{display: 'flex', alignItems: 'center', gap: 18, height: 78, borderBottom: '2px solid rgba(255,255,255,.08)', fontFamily: SF, fontSize: 30, color: '#8A9096'}}>
      <span style={{width: 110}}>{label}</span><span style={{display: 'flex', alignItems: 'center', gap: 12, color: '#E8EAED', fontWeight: 500}}>{value}</span>
    </div>
  );
  return (
    <>
      <Row y={390} size={60}><Word t={t} at={W[11]}>сразу</Word> <Word t={t} at={W[12]}>с</Word></Row>
      <div style={{position: 'absolute', left: CX - 432, top: 462, width: 864, textAlign: 'center', fontFamily: CV, fontSize: 92, lineHeight: 1, color: ORANGE}}><Word t={t} at={W[13]}>мобильной</Word> <Word t={t} at={W[14]}>версией</Word></div>
      <div style={{position: 'absolute', left: 350, top: 600, width: 720, height: 960, perspective: 2600}}>
        <div style={{position: 'absolute', inset: 0, borderRadius: 96, padding: 16, background: 'linear-gradient(135deg, #E9ECEF, #9AA1A8 45%, #F4F5F6 60%, #7E858C)',
          transform: `translateY(${(1 - Math.min(1, ph)) * 900}px) rotateX(${10 * (1 - ph) + 4}deg) rotateY(${-12 + 5 * ph}deg) rotateZ(${-4 + 2 * ph}deg)`, transformOrigin: '50% 80%',
          boxShadow: '0 70px 110px rgba(17,19,22,.35)'}}>
          <div style={{width: '100%', height: '100%', borderRadius: 82, background: '#0F1115', overflow: 'hidden', position: 'relative', padding: '96px 40px 0'}}>
            <div style={{position: 'absolute', left: '50%', top: 22, width: 170, height: 44, marginLeft: -85, borderRadius: 22, background: '#000'}} />
            <div style={{display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18}}>
              <div style={{width: 64, height: 64, borderRadius: 32, background: '#FFFFFF', display: 'grid', placeItems: 'center'}}><Img src={staticFile('tildify/tilda-logo-a.svg')} style={{width: 56, height: 56}} /></div>
              <span style={{fontFamily: SF, fontWeight: 600, fontSize: 34, color: '#FFFFFF'}}>Zero Block</span>
              <span style={{marginLeft: 'auto', fontFamily: SF, fontSize: 28, color: ORANGE, fontWeight: 600}}>360 px</span>
            </div>
            <Row2 label="Откуда" value={<><span style={{width: 40, height: 40, borderRadius: 10, background: '#FFFFFF', display: 'grid', placeItems: 'center'}}><Img src={staticFile('tildify/claude.svg')} style={{width: 28, height: 28}} /></span>Claude Code</>} />
            <Row2 label="Куда" value="Тильда" />
            <Row2 label="Экран" value="мобильный" />
            <div style={{marginTop: 34, height: 400, borderRadius: 30, border: '2px solid rgba(255,255,255,.18)', padding: '30px 30px', fontFamily: SF, fontSize: 44, lineHeight: 1.3, color: '#F2F3F5'}}>
              {keep.slice(0, n1)}
              <span style={{background: sel > 0 && del < 1 ? `rgba(255,122,47,${0.45 * sel})` : 'transparent', color: sel > 0 ? '#FFFFFF' : '#F2F3F5'}}>{shown}</span>
              <span style={{color: ORANGE, opacity: Math.floor(t * 3) % 2}}>|</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
// Сцена 3: «когда клиент хочет править сам» — выделение текста с ручками тянется слева направо
export const S3: React.FC<{t: number; fps: number}> = ({t}) => {
  const sel = k(t, W[23] - 0.05, W[24] + 0.2, Easing.bezier(0.45, 0, 0.25, 1));
  return (
    <>
      <Row y={640} size={64}><Word t={t} at={W[22]}>когда</Word></Row>
      <div style={{position: 'absolute', left: CX, top: 760, transform: 'translateX(-50%)', width: 'max-content', fontFamily: SF, fontWeight: 400, fontSize: 76, color: INK}}>
        <div style={{position: 'absolute', left: -14, top: -8, bottom: -8, width: `calc(${sel * 100}% + 28px)`, background: 'rgba(255,122,47,.26)'}} />
        <div style={{position: 'absolute', left: -17, top: -30, width: 6, height: 120, background: ORANGE, opacity: sel > 0 ? 1 : 0}}><div style={{position: 'absolute', left: -9, top: -12, width: 24, height: 24, borderRadius: 12, background: ORANGE}} /></div>
        <div style={{position: 'absolute', left: `calc(${sel * 100}% + 11px)`, top: -8, width: 6, height: 120, background: ORANGE, opacity: sel > 0 ? 1 : 0}}><div style={{position: 'absolute', left: -9, bottom: -12, width: 24, height: 24, borderRadius: 12, background: ORANGE}} /></div>
        <span style={{position: 'relative'}}><Word t={t} at={W[23]}>клиент</Word> <Word t={t} at={W[24]}>хочет</Word></span>
      </div>
      <div style={{position: 'absolute', left: CX, top: 900, transform: 'translateX(-50%)', width: 'max-content', fontFamily: CV, fontSize: 180, lineHeight: 1, color: INK}}>
        <Word t={t} at={W[25]}>править</Word> <Word t={t} at={W[26]} style={{color: ORANGE}}>сам</Word>
      </div>
    </>
  );
};
// Сцена 4: «Это расширение для Chrome — Tildify» — скобка-коннектор, настоящий попап Tildify, плашка Chrome
export const S4: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const a = CUT[3], draw = k(t, a + 0.05, a + 0.9, Easing.bezier(0.65, 0, 0.35, 1)), pop = spr(t, W[28] - 0.1, fps, 13, 150), pill = spr(t, W[30] - 0.08, fps);
  return (
    <>
      <svg width={1440} height={1700} style={{position: 'absolute', left: 0, top: 0}}>
        <path d="M 360 440 H 316 Q 300 440 300 456 V 1500 Q 300 1540 340 1540 H 540" fill="none" stroke={INK} strokeWidth={6} strokeLinecap="round" pathLength={1} strokeDasharray={`${draw} 1`} />
      </svg>
      <div style={{position: 'absolute', left: 300 - 38, top: 402, width: 76, height: 76, borderRadius: 38, background: INK, display: 'grid', placeItems: 'center', transform: `scale(${spr(t, a, fps)})`}}>
        <svg width={40} height={40} viewBox="0 0 24 24"><path d="M12 2 L21 7 V17 L12 22 L3 17 V7 Z M12 2 V12 M3 7 L12 12 L21 7" stroke="#FFFFFF" strokeWidth={1.8} fill="none" strokeLinejoin="round" /></svg>
      </div>
      <div style={{position: 'absolute', left: 390, top: 408, fontFamily: SF, fontWeight: 300, fontSize: 64, color: INK}}><Word t={t} at={W[27]}>Это</Word> <Word t={t} at={W[28]}>расширение</Word></div>
      <div style={{position: 'absolute', left: 390, top: 490, fontFamily: CV, fontSize: 150, lineHeight: 1, color: ORANGE}}><Word t={t} at={W[31] - 0.05}>Tildify</Word></div>
      <div style={{position: 'absolute', left: 560, top: 700, width: 520, height: 673, transform: `rotate(${2.5 + 6 * (1 - Math.min(1, pop))}deg) scale(${0.7 + 0.3 * pop})`, opacity: Math.min(1, pop * 2), borderRadius: 26,
        boxShadow: '0 0 0 2px rgba(17,19,22,.06), 0 50px 90px rgba(17,19,22,.22)'}}>
        <Img src={staticFile('tildify/popup.png')} style={{width: '100%', height: '100%', objectFit: 'cover', borderRadius: 26}} />
      </div>
      <div style={{position: 'absolute', left: 540 - 38, top: 1502, width: 76, height: 76, borderRadius: 38, background: '#FFFFFF', border: `6px solid ${INK}`, display: 'grid', placeItems: 'center', transform: `scale(${spr(t, a + 0.85, fps)})`}}>
        <svg width={34} height={34} viewBox="0 0 24 24"><path d="M5 3 L19 12 L12 13.5 L9 20 Z" fill={INK} /></svg>
      </div>
      <div style={{position: 'absolute', left: 640, top: 1400, display: 'flex', alignItems: 'center', gap: 18, padding: '16px 30px', background: '#FFFFFF', borderRadius: 60,
        boxShadow: '0 16px 30px rgba(17,19,22,.14)', opacity: Math.min(1, pill * 2), transform: `translateY(${(1 - Math.min(1, pill)) * 60}px) scale(${0.8 + 0.2 * pill})`}}>
        <Img src={staticFile('tildify/googlechrome.svg')} style={{width: 50, height: 50}} />
        <span style={{fontFamily: SF, fontWeight: 500, fontSize: 40, color: INK}}>для Chrome</span>
      </div>
      <Pointer t={t} at={W[28] + 0.15} d="M 400 1400 C 400 1290, 450 1200, 545 1150" head={[545, 1150, -28]} />
    </>
  );
};

export const ISLA = ISLA_RAW as Record<string, {onset: number; peak: number; dur: number}>;
type E = [number, string, number, boolean?, number?];   // …, длительность (печать обрезается по тексту)   // время, звук, громкость, ставить пиком
export const SFX: E[] = [
  [W[2] - 0.05, 'pop', 0.3], [W[7] - 0.05, 'pop', 0.3], [W[8] + 0.02, 'popup', 0.34], [W[10] - 0.1, 'sw-s6', 0.13, true], [W[10] + 0.1, 'type-b', 0.16],
  [CUT[1] + 0.12, 'sw-s1', 0.17, true], [W[16] - 0.08, 'type-a', 0.2, false, 0.5], [W[19] - 0.05, 'type-a', 0.2, false, 0.85], [W[21] + 0.4, 'crispy', 0.4],
  [CUT[2], 'sw-s4', 0.15, true], [W[23] - 0.05, 'b5', 0.3], [W[25], 'select', 0.3],
  [CUT[3], 'sw-s7', 0.15, true], [W[28] - 0.1, 'es-open', 0.32], [W[30] - 0.05, 'click4', 0.36], [W[31], 'chime', 0.32],
];

export const TildifyDemo: React.FC = () => {
  const frame = useCurrentFrame(), {fps} = useVideoConfig(), t = frame / fps;
  const seg = Math.max(0, CUT.findIndex((c, i) => t >= c && t < CUT[i + 1]));
  const Scene = [S1, S2, S3, S4][Math.min(3, seg)];
  // смена сцены: старая уходит в размытие, новая проявляется из него (лист остаётся)
  const edge = Math.min(...CUT.slice(1, -1).map((c) => Math.abs(t - c))), blur = interpolate(edge, [0, 0.16], [16, 0], cl), fade = interpolate(edge, [0, 0.16], [0.35, 1], cl);
  const push = interpolate(t, [CUT[seg], CUT[seg + 1] ?? 10.4], [1, 1.04], cl);
  return (
    <AbsoluteFill style={{background: PAPER}}>
      <AbsoluteFill style={{backgroundImage: 'linear-gradient(rgba(17,19,22,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(17,19,22,.045) 1px, transparent 1px)', backgroundSize: '48px 48px',
        backgroundPosition: `0 ${-t * 6}px`}} />
      <div style={{position: 'absolute', left: 520, top: -260 + Math.sin(t * 0.4) * 30, width: 900, height: 620, background: 'rgba(17,19,22,.035)', transform: 'rotate(28deg)'}} />
      <div style={{position: 'absolute', left: -320, top: 1320 - Math.sin(t * 0.4) * 30, width: 820, height: 560, background: 'rgba(17,19,22,.03)', transform: 'rotate(-32deg)'}} />
      <AbsoluteFill style={{transform: `scale(${push})`, transformOrigin: '720px 900px', filter: blur > 0.5 ? `blur(${blur}px)` : undefined, opacity: fade}}>
        <Scene t={t} fps={fps} />
      </AbsoluteFill>
      {/* спикер: карточка внизу, звук записи — из неё */}
      <div style={{position: 'absolute', left: CX - 380, top: 2400 - 720, width: 760, height: 720, borderRadius: 60, overflow: 'hidden', boxShadow: '0 0 0 4px rgba(255,255,255,.9), 0 40px 80px rgba(17,19,22,.25)'}}>
        <OffthreadVideo src={staticFile('tildify/tildify.mp4')} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 36%'}} />
      </div>
      {SFX.map(([at, c, v, pk, dd], i) => {
        const m = ISLA[c], from = Math.round((at - (pk ? m.peak : m.onset)) * fps);
        return <Sequence key={i} from={from} durationInFrames={Math.round((dd ?? (c.startsWith('type') ? 0.35 : m.dur)) * fps)} layout="none"><Audio src={staticFile(`sfx/isla/${c}.wav`)} volume={v} /></Sequence>;
      })}
    </AbsoluteFill>
  );
};
