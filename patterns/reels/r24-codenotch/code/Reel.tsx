import {AbsoluteFill, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio, Video} from '@remotion/media';
import {Captions} from '../../montage/Captions';
import {C, E, HAND, k, Logo, MONO, NUM, SANS} from '../../montage/parts';
import {FORMATS} from '../../formats';
import {FormatProvider} from '../../template/canvas';
import {Speaker} from '../../template/Speaker';
import {WORDS24} from './words';

// Ролик 24 «Codenotch — остаток лимитов». Стиль — по референсу монтажа Александра (ролик про TurboQuant):
// светло-серые листы с толстой кистью, тёмно-зелёные зоны с подсветкой снизу и дугой, слова из размытия,
// крупные названия, факты в капсулах. Лайм референса заменён мятным (палитра 18.09). Спикер — карточка снизу.
// Сейчас собраны первые 12 с: «Забудь про вкладку usage…» → «…звуком, уведомлением и анимацией».
export const FPS24 = 60;
export const PREVIEW24 = 12;
export const END24 = 44.25;

const W = 1440, H = 2560;
const MINT = C.mint, INK = '#15181B', SUB = '#5B6068', PAPER = '#ECECE9';
const cl = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const A_END = 2.95, C_START = 6.02;
const LIGHT = (t: number) => t < A_END || t >= C_START;

// Пружина от секунды.
const sp = (t: number, at: number, fps: number, damping = 14, stiffness = 160) =>
  t < at ? 0 : spring({frame: (t - at) * fps, fps, config: {damping, stiffness, mass: 1}});

// Кисть: толстая мятная линия, которая рисуется (p) и стирается с начала (q).
const Brush: React.FC<{d: string; p: number; q?: number; width: number; color?: string; glow?: number; opacity?: number}> =
  ({d, p, q = 0, width, color = MINT, glow = 0.5, opacity = 1}) => {
    if (p <= 0 || q >= 1) return null;
    return (
      <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none', opacity}}>
        <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" pathLength={1}
          strokeDasharray={`${Math.max(0, p - q)} 2`} strokeDashoffset={-q}
          style={{filter: glow ? `drop-shadow(0 0 ${Math.round(width * 0.6)}px rgba(61,237,195,${glow}))` : undefined}} />
      </svg>
    );
  };

// Строка, где каждое слово проявляется из размытия в свою секунду речи.
const WordLine: React.FC<{t: number; words: [string, number][]; x: number; y: number; size: number; color?: string; weight?: number; family?: string; center?: boolean}> =
  ({t, words, x, y, size, color = INK, weight = 800, family = SANS, center}) => (
    <div style={{position: 'absolute', left: center ? 0 : x, width: center ? W : undefined, top: y, display: 'flex', justifyContent: center ? 'center' : 'flex-start',
      gap: size * 0.26, fontFamily: family, fontWeight: weight, fontSize: size, lineHeight: 1.05, letterSpacing: '-0.035em', color, whiteSpace: 'nowrap'}}>
      {words.map(([w, at]) => {
        const a = k(t, at, at + 0.45);
        return <span key={w + at} style={{opacity: a, filter: a < 1 ? `blur(${(1 - a) * 14}px)` : undefined, transform: `translateY(${(1 - a) * 22}px)`, display: 'inline-block'}}>{w}</span>;
      })}
    </div>
  );

// Плита с торцом и фаской (правило карточек ролика 22).
const Slab: React.FC<{x: number; y: number; w: number; h: number; r?: number; face: string; edge: string; style?: React.CSSProperties; children?: React.ReactNode}> =
  ({x, y, w, h, r = 40, face, edge, style, children}) => (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, ...style}}>
      <div style={{position: 'absolute', left: 0, top: 18, width: w, height: h, borderRadius: r, background: edge, boxShadow: '0 40px 80px rgba(0,0,0,.28)'}} />
      <div style={{position: 'absolute', left: 0, top: 0, width: w, height: h, borderRadius: r, background: face, overflow: 'hidden',
        boxShadow: 'inset 0 3px 0 rgba(255,255,255,.22), inset 0 -10px 24px rgba(0,0,0,.18), inset 0 0 0 1.5px rgba(255,255,255,.08)'}}>{children}</div>
    </div>
  );

// Капсула факта: мятная заливка, тёмный текст, мягкое свечение (капсулы референса).
const Pill: React.FC<{t: number; at: number; label: string; size?: number; icon?: React.ReactNode}> = ({t, at, label, size = 56, icon}) => {
  const a = k(t, at, at + 0.4, E.pop), o = k(t, at, at + 0.15);
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: size * 0.32, padding: `${size * 0.36}px ${size * 0.62}px`, borderRadius: 999, background: MINT,
      boxShadow: '0 0 40px rgba(61,237,195,.55), inset 0 3px 0 rgba(255,255,255,.5), 0 14px 30px rgba(5,35,29,.25)', opacity: o, transform: `scale(${0.6 + 0.4 * a})`,
      fontFamily: SANS, fontWeight: 800, fontSize: size, lineHeight: 1, color: C.mintInk, whiteSpace: 'nowrap'}}>{icon}{label}</div>
  );
};

// Кольцо лимита: дорожка и дуга; значения условные, без чисел — чисел в кадре только из источника.
const Ring: React.FC<{cx: number; cy: number; r: number; frac: number; color: string; logo: string; invert?: boolean; spin?: number}> = ({cx, cy, r, frac, color, logo, invert, spin = 0}) => (
  <>
    <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#2B2F33" strokeWidth={9} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={9} strokeLinecap="round" pathLength={1} strokeDasharray={`${frac} 1`}
        transform={`rotate(${-90 + spin} ${cx} ${cy})`} style={{filter: `drop-shadow(0 0 8px ${color}88)`}} />
    </svg>
    <Logo name={logo} size={r * 1.05} style={{position: 'absolute', left: cx - r * 0.525, top: cy - r * 0.525, filter: invert ? 'invert(1)' : undefined}} />
  </>
);

// ——— Сцена A: «Забудь про вкладку usage в Claude или Codex» ———
const SceneA: React.FC<{t: number}> = ({t}) => {
  const typed = '/usage'.slice(0, Math.round(6 * k(t, 1.36, 1.66, (v) => v)));
  const strike = k(t, 2.42, 2.66, E.inOut);
  const fall = k(t, 2.7, 3.1, E.acc);
  return (
    <AbsoluteFill>
      <Brush d="M -80 1420 C 180 1330, 110 1080, 300 1020 S 560 1130, 470 900 S 150 560, 390 420 S 980 380, 1520 250" p={k(t, 0, 1.3, E.out)} width={46} glow={0.35} opacity={0.9} />
      <WordLine t={t} x={144} y={372} size={96} words={[['Забудь', 0.08], ['про', 0.53], ['вкладку', 0.77]]} />
      <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, transformOrigin: '720px 800px',
        transform: `translateY(${fall * 220}px) rotate(${fall * 7}deg)`, opacity: 1 - fall}}>
        <Slab x={144} y={560} w={1152} h={430} face="linear-gradient(180deg, #16191C, #0E1012)" edge="#050607"
          style={{opacity: k(t, 0.9, 1.25), transform: `translateY(${(1 - k(t, 0.9, 1.3)) * 60}px)`}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 16, padding: '34px 44px'}}>
            {['#FF6159', '#FFBD2E', '#28C941'].map((c) => <span key={c} style={{width: 22, height: 22, borderRadius: '50%', background: c}} />)}
            <span style={{marginLeft: 18, fontFamily: MONO, fontWeight: 600, fontSize: 44, color: '#8A9096'}}>claude</span>
          </div>
          <div style={{position: 'absolute', left: 64, top: 150, display: 'flex', alignItems: 'baseline', gap: 28, fontFamily: MONO, fontWeight: 700, fontSize: 176, color: MINT,
            textShadow: '0 0 40px rgba(61,237,195,.45)'}}>
            <span style={{color: '#5E656C', fontSize: 120}}>›</span>
            <span style={{position: 'relative'}}>
              {typed}<span style={{opacity: typed.length < 6 || Math.floor(t * 2.4) % 2 ? 1 : 0, color: MINT}}>▍</span>
              {strike > 0 ? <span style={{position: 'absolute', left: -12, top: '52%', height: 22, width: `${strike * 104}%`, borderRadius: 11, background: C.orange,
                boxShadow: '0 0 24px rgba(255,122,47,.7)'}} /> : null}
            </span>
          </div>
        </Slab>
        <div style={{position: 'absolute', left: 144, top: 1070, display: 'flex', gap: 28}}>
          {[{at: 1.66, logo: 'claude', label: 'Claude Code'}, {at: 2.3, logo: 'openai', label: 'Codex'}].map((p) => {
            const a = sp(t, p.at, FPS24);
            return (
              <div key={p.label} style={{display: 'flex', alignItems: 'center', gap: 20, padding: '24px 40px 24px 30px', borderRadius: 999, background: '#FFFFFF',
                boxShadow: '0 16px 36px rgba(0,0,0,.14), inset 0 -4px 0 rgba(0,0,0,.06)', opacity: Math.min(1, a * 1.5), transform: `translateY(${(1 - a) * 50}px) scale(${0.7 + 0.3 * a})`,
                fontFamily: SANS, fontWeight: 800, fontSize: 56, color: INK}}>
                <Logo name={p.logo} size={62} />{p.label}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ——— Сцена B: «эта бесплатная программа показывает остаток лимитов заранее» ———
const SceneB: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const icon = sp(t, 3.02, fps, 11, 150);
  const card = sp(t, 3.96, fps, 16, 120);
  const push = k(t, 4.4, 5.95, E.inOut);
  const glow = k(t, 4.58, 4.9) * (1 - 0.5 * k(t, 5.3, 5.9));
  const hand = k(t, 5.45, 5.85, E.out);
  return (
    <AbsoluteFill style={{background: 'linear-gradient(180deg, #03110E 0%, #052119 45%, #083A2F 100%)'}}>
      <div style={{position: 'absolute', left: -200, top: 1050, width: 1840, height: 900, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(61,237,195,.32), rgba(61,237,195,0))'}} />
      <Brush d="M -120 1520 C 280 1360, 520 1600, 820 1440 S 1300 1180, 1620 1300" p={k(t, 2.95, 4.2, E.out)} width={16} glow={0.9} />
      <Img src={staticFile('r24/codenotch-icon.png')} style={{position: 'absolute', left: 720 - 78, top: 250, width: 156, height: 156, borderRadius: 36,
        transform: `scale(${0.4 + 0.6 * icon})`, opacity: Math.min(1, icon * 1.6), boxShadow: '0 20px 50px rgba(0,0,0,.5), 0 0 60px rgba(61,237,195,.25)'}} />
      <WordLine t={t} center x={0} y={440} size={140} weight={700} family={NUM} color={C.ink} words={[['Codenotch', 3.04]]} />
      <WordLine t={t} center x={0} y={612} size={60} weight={600} color="#A9C9C0" words={[['бесплатная', 3.04], ['программа', 3.56]]} />
      <div style={{position: 'absolute', left: 170, top: 760, width: 1100, height: 620, borderRadius: 44, overflow: 'hidden', opacity: Math.min(1, card * 1.4),
        transform: `translateY(${(1 - card) * 160}px)`, boxShadow: '0 50px 100px rgba(0,0,0,.55), inset 0 0 0 2px rgba(255,255,255,.14)'}}>
        <div style={{position: 'absolute', left: 0, top: -250, width: 1100, height: 1100, transformOrigin: '1080px 560px', transform: `scale(${1 + 0.16 * push})`}}>
          <Sequence from={Math.round(3.9 * fps)} layout="none">
            <Video src={staticFile('r24/codenotch-demo.mp4')} muted trimBefore={Math.round(4.2 * fps)} style={{width: 1100, height: 1100}} />
          </Sequence>
        </div>
        <div style={{position: 'absolute', inset: 0, borderRadius: 44, boxShadow: `inset 0 0 0 ${4 * glow}px rgba(61,237,195,${0.9 * glow})`}} />
      </div>
      {hand > 0 ? (
        <div style={{position: 'absolute', left: 190, top: 690, transform: `rotate(-6deg) scale(${0.8 + 0.2 * hand})`, opacity: hand, fontFamily: HAND, fontWeight: 600, fontSize: 104,
          color: MINT, textShadow: '0 0 30px rgba(61,237,195,.6)'}}>заранее
          <svg width={330} height={40} style={{position: 'absolute', left: 0, top: 104, overflow: 'visible'}}>
            <path d="M 4 20 C 90 34, 200 4, 320 16" fill="none" stroke={MINT} strokeWidth={9} strokeLinecap="round" pathLength={1} strokeDasharray={`${k(t, 5.6, 5.95)} 1`} />
          </svg>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ——— Сцена C: «уведомляет о выполнении задачи в рабочих чатах. Приятным звуком, уведомлением и анимацией» ———
const SceneC: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const screen = sp(t, 6.1, fps, 16, 130);
  const done = k(t, 7.48, 7.7);
  const open = sp(t, 7.95, fps, 15, 140);
  const waves = t >= 9.22 ? ((t - 9.22) % 0.9) / 0.9 : -1;
  const bell = t >= 10.0 && t < 10.9 ? Math.sin((t - 10) * 28) * (1 - (t - 10) / 0.9) * 16 : 0;
  const spinA = t >= 11.1 ? interpolate(t, [11.1, 11.9], [0, 360], {...cl, easing: Easing.bezier(0.65, 0, 0.35, 1)}) : 0;
  const SX = 144, SY = 610, SW = 1152, SH = 600;
  const NX = SX + SW - 104, NY = SY + 70, NH = 440;
  return (
    <AbsoluteFill>
      <Brush d="M 1540 1500 C 1230 1600, 1260 1300, 1080 1330 S 820 1520, 900 1250 S 1180 980, 980 860 S 520 820, 300 1000 S -40 1180, -120 1100"
        p={k(t, 6.02, 7.4, E.out)} width={44} glow={0.35} opacity={0.85} />
      <WordLine t={t} x={144} y={352} size={96} words={[['уведомляет', 6.15]]} />
      <WordLine t={t} x={144} y={470} size={64} weight={700} color={SUB} words={[['о', 6.71], ['выполнении', 6.89], ['задачи', 7.48]]} />
      <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, opacity: Math.min(1, screen * 1.4), transform: `translateY(${(1 - screen) * 120}px)`}}>
        <Slab x={SX} y={SY} w={SW} h={SH} r={44} face="linear-gradient(135deg, #DDF8F0 0%, #F6F6F2 45%, #FFE3D2 100%)" edge="#BFC4C1">
          <div style={{position: 'absolute', left: 44, top: 60, width: 660, height: 470, borderRadius: 30, background: '#FFFFFF', boxShadow: '0 24px 50px rgba(0,0,0,.14), inset 0 0 0 1.5px rgba(0,0,0,.06)'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 18, padding: '30px 36px', borderBottom: '1.5px solid #ECEEEF', fontFamily: SANS, fontWeight: 800, fontSize: 46, color: INK}}>
              <Logo name="claude" size={52} />Claude Code
            </div>
            <div style={{position: 'absolute', left: 36, top: 140, padding: '22px 30px', borderRadius: 26, background: '#F1F3F4', fontFamily: SANS, fontWeight: 600, fontSize: 46, color: INK}}>
              Добавь оплату на сайт
            </div>
            <div style={{position: 'absolute', left: 36, top: 300, display: 'flex', alignItems: 'center', gap: 20, fontFamily: SANS, fontWeight: 800, fontSize: 50,
              color: done > 0.5 ? '#0FA37F' : SUB}}>
              {done < 0.5 ? (
                <svg width={52} height={52} style={{transform: `rotate(${t * 400}deg)`}}><circle cx={26} cy={26} r={20} fill="none" stroke="#C9CED2" strokeWidth={7} />
                  <circle cx={26} cy={26} r={20} fill="none" stroke={MINT} strokeWidth={7} strokeLinecap="round" pathLength={1} strokeDasharray="0.3 1" /></svg>
              ) : (
                <svg width={52} height={52} style={{transform: `scale(${0.6 + 0.4 * done})`}}><circle cx={26} cy={26} r={24} fill={MINT} />
                  <path d="M 15 27 L 23 35 L 38 18" fill="none" stroke={C.mintInk} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" /></svg>
              )}
              {done < 0.5 ? 'работает…' : 'задача готова'}
            </div>
          </div>
        </Slab>
        {/* чёлка у правого края экрана — по дизайну Codenotch: чёрная, кольца по одному на ИИ */}
        <div style={{position: 'absolute', left: NX, top: NY, width: 104, height: NH, background: '#050607', borderRadius: '52px 0 0 52px',
          boxShadow: '-10px 20px 40px rgba(0,0,0,.35)'}} />
        {open > 0.01 ? (
          <div style={{position: 'absolute', left: NX + 30 - 430 * open, top: NY + 8, width: 430 * open + 10, height: 150, borderRadius: 75, background: '#050607', overflow: 'hidden',
            boxShadow: '0 24px 50px rgba(0,0,0,.4)'}}>
            <div style={{position: 'absolute', left: 36, top: 0, height: 150, display: 'flex', alignItems: 'center', gap: 22, whiteSpace: 'nowrap', opacity: k(t, 8.1, 8.35)}}>
              <div style={{transform: `rotate(${bell}deg)`, transformOrigin: '50% 10%'}}>
                <svg width={60} height={60} viewBox="0 0 24 24"><path d="M12 3a6 6 0 0 0-6 6v4l-2 3h16l-2-3V9a6 6 0 0 0-6-6zm-2 15a2 2 0 0 0 4 0" fill="none" stroke={MINT} strokeWidth={2} strokeLinejoin="round" /></svg>
              </div>
              <div style={{fontFamily: SANS, fontWeight: 800, fontSize: 46, color: C.ink, lineHeight: 1.1}}>Claude<div style={{fontSize: 44, color: MINT}}>готово</div></div>
            </div>
          </div>
        ) : null}
        <Ring cx={NX + 56} cy={NY + 80} r={32} frac={0.72} color={C.orange} logo="claude" spin={spinA} />
        <Ring cx={NX + 56} cy={NY + 220} r={32} frac={0.34} color={MINT} logo="openai" invert spin={spinA} />
        <Ring cx={NX + 56} cy={NY + 360} r={32} frac={0.55} color="#F7F7F5" logo="cursor" invert spin={spinA} />
        {waves >= 0 && t < 10.4 ? [0, 0.33, 0.66].map((d) => {
          const w = (waves + d) % 1;
          return <div key={d} style={{position: 'absolute', left: NX + 56 - 60 - w * 140, top: NY + 80 - 60 - w * 140, width: 120 + w * 280, height: 120 + w * 280, borderRadius: '50%',
            border: `6px solid rgba(61,237,195,${0.8 * (1 - w)})`}} />;
        }) : null}
      </div>
      <div style={{position: 'absolute', left: 0, top: 1262, width: W, display: 'flex', justifyContent: 'center', gap: 26}}>
        <Pill t={t} at={9.22} label="звук" icon={<span style={{fontSize: 50}}>♪</span>} />
        <Pill t={t} at={10.0} label="уведомление" />
        <Pill t={t} at={11.1} label="анимация" />
      </div>
    </AbsoluteFill>
  );
};

// ——— Фоны зон: светлый лист и тёмно-зелёная зона со светящейся дугой (как в референсе) ———
const Paper: React.FC<{children: React.ReactNode}> = ({children}) => (
  <AbsoluteFill style={{background: 'radial-gradient(120% 80% at 50% 30%, #F7F7F4 0%, #ECECE9 55%, #D9DAD5 100%)'}}>{children}</AbsoluteFill>
);
const Dark: React.FC<{t: number; from: number; arc: string; children: React.ReactNode}> = ({t, from, arc, children}) => (
  <AbsoluteFill style={{background: 'linear-gradient(180deg, #03110E 0%, #052119 45%, #083A2F 100%)'}}>
    <div style={{position: 'absolute', left: -200, top: 1050, width: 1840, height: 900, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(61,237,195,.28), rgba(61,237,195,0))'}} />
    <Brush d={arc} p={k(t, from, from + 1.2, E.out)} width={16} glow={0.9} />
    {children}
  </AbsoluteFill>
);
const ARC1 = 'M -120 1520 C 280 1360, 520 1600, 820 1440 S 1300 1180, 1620 1300';
const ARC2 = 'M 1560 1480 C 1180 1330, 980 1560, 660 1430 S 180 1200, -140 1330';

// Белая карточка бренда (как карточки Samsung / Micron в референсе): настоящий логотип, название, подпись.
const BrandCard: React.FC<{t: number; at: number; x: number; y: number; logo: string; name: string; note: string}> = ({t, at, x, y, logo, name, note}) => {
  const a = sp(t, at, FPS24, 13, 150);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: 460, height: 560, opacity: Math.min(1, a * 1.6), transform: `translateY(${(1 - a) * 140}px) rotate(${(1 - a) * -6}deg)`}}>
      <Slab x={0} y={0} w={460} h={560} r={40} face="linear-gradient(180deg, #FFFFFF, #F1F2EF)" edge="#AEB3AF">
        <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26}}>
          <Logo name={logo} size={200} />
          <div style={{fontFamily: SANS, fontWeight: 800, fontSize: 72, color: INK, letterSpacing: '-0.02em'}}>{name}</div>
          <div style={{fontFamily: SANS, fontWeight: 600, fontSize: 44, color: SUB}}>{note}</div>
        </div>
      </Slab>
    </div>
  );
};

// ——— D: «Работает и на Mac, и на Windows» ———
const SceneD: React.FC<{t: number}> = ({t}) => (
  <Dark t={t} from={11.9} arc={ARC2}>
    <WordLine t={t} center x={0} y={400} size={92} color={C.ink} words={[['Работает', 11.96], ['и', 12.63], ['на', 12.71], ['Mac', 12.88], ['и', 13.08], ['Windows', 13.25]]} />
    <BrandCard t={t} at={12.88} x={200} y={640} logo="apple" name="Mac" note="macOS 15 и новее" />
    <BrandCard t={t} at={13.25} x={780} y={640} logo="windows" name="Windows" note="своя версия" />
  </Dark>
);

// ——— E: «На краю экрана висит маленькая чёрная чёлка» ———
const SceneE: React.FC<{t: number}> = ({t}) => {
  const a = sp(t, 13.8, FPS24, 16, 120), push = k(t, 14.2, 16.5, E.inOut), hand = k(t, 16.06, 16.4);
  return (
    <Paper>
      <Brush d="M -80 1380 C 220 1300, 160 1080, 360 1040 S 640 1160, 560 960 S 380 700, 700 560 S 1300 520, 1560 380" p={k(t, 13.72, 15.0)} width={44} glow={0.35} opacity={0.85} />
      <WordLine t={t} x={144} y={372} size={92} words={[['На', 13.72], ['краю', 14.06], ['экрана', 14.22]]} />
      <div style={{position: 'absolute', left: 170, top: 520, width: 1100, height: 860, borderRadius: 44, overflow: 'hidden', opacity: Math.min(1, a * 1.5),
        transform: `translateY(${(1 - a) * 140}px)`, boxShadow: '0 50px 100px rgba(0,0,0,.3), inset 0 0 0 2px rgba(255,255,255,.3)'}}>
        <Img src={staticFile('r24/codenotch-shot-1.jpg')} style={{position: 'absolute', left: -50, top: -170, width: 1200, height: 1200, maxWidth: 'none',
          transformOrigin: '560px 760px', transform: `scale(${1 + 0.22 * push})`}} />
      </div>
      {hand > 0 ? (
        <div style={{position: 'absolute', left: 700, top: 560, opacity: hand, transform: `rotate(-5deg) scale(${0.8 + 0.2 * hand})`, fontFamily: HAND, fontWeight: 600, fontSize: 120,
          color: C.orange, textShadow: '0 2px 0 rgba(255,255,255,.7)'}}>чёлка
          <svg width={260} height={260} style={{position: 'absolute', left: -150, top: 120, overflow: 'visible'}}>
            <path d="M 150 10 C 110 90, 40 110, 10 210 M 10 210 L 0 160 M 10 210 L 55 185" fill="none" stroke={C.orange} strokeWidth={10} strokeLinecap="round"
              pathLength={1} strokeDasharray={`${k(t, 16.15, 16.5)} 1`} />
          </svg>
        </div>
      ) : null}
    </Paper>
  );
};

// ——— F: «В ней кольца по одному на каждый ИИ: Claude, Codex, Cursor, Antigravity» ———
const SceneF: React.FC<{t: number}> = ({t}) => {
  const cx = 720, cy = 890, R1 = 340, R2 = 225;
  const spin = (t - 16.55) * 9;
  const orb = k(t, 16.6, 17.4, E.out);
  const items = [{at: 19.07, logo: 'claude', name: 'Claude', ang: -150}, {at: 19.49, logo: 'openai', name: 'Codex', ang: -30},
    {at: 20.04, logo: 'cursor', name: 'Cursor', ang: 30}, {at: 20.76, logo: 'antigravity', name: 'Antigravity', ang: 150}];
  return (
    <Dark t={t} from={16.55} arc={ARC1}>
      <WordLine t={t} center x={0} y={372} size={84} color={C.ink} words={[['кольца', 16.93], ['на', 18.11], ['каждый', 18.28], ['ИИ', 18.79]]} />
      <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
        <circle cx={cx} cy={cy} r={R1} fill="none" stroke="rgba(255,255,255,.35)" strokeWidth={3} pathLength={1} strokeDasharray={`${orb} 1`} transform={`rotate(-90 ${cx} ${cy})`} />
        <circle cx={cx} cy={cy} r={R2} fill="none" stroke="rgba(61,237,195,.55)" strokeWidth={3} pathLength={1} strokeDasharray={`${orb} 1`} transform={`rotate(90 ${cx} ${cy})`}
          style={{filter: 'drop-shadow(0 0 10px rgba(61,237,195,.6))'}} />
      </svg>
      <Img src={staticFile('r24/codenotch-icon.png')} style={{position: 'absolute', left: cx - 95, top: cy - 95, width: 190, height: 190, borderRadius: 44,
        transform: `scale(${0.5 + 0.5 * sp(t, 16.7, FPS24, 12, 140)})`, boxShadow: '0 0 80px rgba(61,237,195,.35), 0 24px 60px rgba(0,0,0,.5)'}} />
      {items.map((it) => {
        const a = sp(t, it.at, FPS24, 12, 150), ang = ((it.ang + spin) * Math.PI) / 180;
        const x = cx + Math.cos(ang) * R1, y = cy + Math.sin(ang) * R1;
        const flash = k(t, it.at, it.at + 0.1) * (1 - k(t, it.at + 0.1, it.at + 0.6));
        if (a <= 0.01) return null;
        return (
          <div key={it.name} style={{position: 'absolute', left: x - 80, top: y - 80, width: 160, opacity: Math.min(1, a * 1.8), transform: `scale(${0.4 + 0.6 * a})`}}>
            <div style={{width: 160, height: 160, borderRadius: '50%', background: '#FFFFFF', display: 'grid', placeItems: 'center',
              boxShadow: `0 0 ${20 + 60 * flash}px rgba(61,237,195,${0.4 + 0.5 * flash}), 0 20px 40px rgba(0,0,0,.45), inset 0 -6px 0 rgba(0,0,0,.08)`}}>
              <Logo name={it.logo} size={92} />
            </div>
            <div style={{position: 'absolute', left: -60, width: 280, top: 176, textAlign: 'center', fontFamily: SANS, fontWeight: 800, fontSize: 46, color: C.ink}}>{it.name}</div>
          </div>
        );
      })}
    </Dark>
  );
};

// ——— G: «Тратишь лимит — кольцо заполняется и меняет цвет» ———
const mixHex = (a: string, b: string, p: number) => {
  const h = (s: string, i: number) => parseInt(s.slice(1 + i * 2, 3 + i * 2), 16);
  return `rgb(${[0, 1, 2].map((i) => Math.round(h(a, i) + (h(b, i) - h(a, i)) * p)).join(',')})`;
};
const SceneG: React.FC<{t: number}> = ({t}) => {
  const fill = k(t, 22.3, 24.3, E.inOut), col = mixHex('#3DEDC3', '#FF7A2F', k(t, 23.3, 24.3, E.inOut));
  const cx = 720, cy = 880, R = 330;
  return (
    <Paper>
      <Brush d="M 1560 1300 C 1200 1420, 1000 1260, 760 1330 S 300 1440, -160 1300" p={k(t, 21.62, 22.9)} width={44} glow={0.35} opacity={0.85} />
      <WordLine t={t} x={144} y={372} size={92} words={[['Тратишь', 21.68], ['лимит', 22.14]]} />
      <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#D5D8D3" strokeWidth={64} />
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={col} strokeWidth={64} strokeLinecap="round" pathLength={1} strokeDasharray={`${Math.max(0.001, fill * 0.86)} 1`}
          transform={`rotate(-90 ${cx} ${cy})`} style={{filter: `drop-shadow(0 0 30px ${col})`}} />
      </svg>
      <div style={{position: 'absolute', left: cx - 150, top: cy - 150, width: 300, height: 300, borderRadius: '50%', background: '#FFFFFF', display: 'grid', placeItems: 'center',
        boxShadow: '0 30px 60px rgba(0,0,0,.18), inset 0 -8px 0 rgba(0,0,0,.06)'}}>
        <Logo name="claude" size={150} />
      </div>
    </Paper>
  );
};

// ——— H: «Наводишь на кольцо — видишь каждый лимит, дневной, недельный, и через сколько он обнулится» ———
// Настоящий кадр подсказки Codenotch (frame-124): «Current session / Resets in 51 min», «All models / Resets Thu 12:00 AM».
const SceneH: React.FC<{t: number}> = ({t}) => {
  const S = 1.69, OX = 150, OY = 400, CX = 170, CY = 500, CW = 1100, CH = 740;
  const at = (x: number, y: number) => ({x: CX + (x - OX) * S, y: CY + (y - OY) * S});
  const card = sp(t, 24.5, FPS24, 16, 120);
  const cur0 = at(420, 820), cur1 = at(737, 550), cm = k(t, 24.7, 25.4, E.inOut);
  const cx = cur0.x + (cur1.x - cur0.x) * cm, cy = cur0.y + (cur1.y - cur0.y) * cm;
  const row = (y0: number, y1: number, a: number, color: string) => {
    const p = at(186, y0), q = at(586, y1);
    return a > 0 ? <div style={{position: 'absolute', left: p.x, top: p.y, width: (q.x - p.x) * a, height: q.y - p.y, borderRadius: 18,
      boxShadow: `inset 0 0 0 6px ${color}, 0 0 30px ${color}`}} /> : null;
  };
  const e0 = at(448, 490), e1 = at(584, 520);
  return (
    <Dark t={t} from={24.42} arc={ARC1}>
      <WordLine t={t} x={144} y={372} size={84} color={C.ink} words={[['Наводишь', 24.47], ['на', 25.0], ['кольцо', 25.13]]} />
      <div style={{position: 'absolute', left: CX, top: CY, width: CW, height: CH, borderRadius: 44, overflow: 'hidden', opacity: Math.min(1, card * 1.5),
        transform: `translateY(${(1 - card) * 140}px)`, boxShadow: '0 50px 100px rgba(0,0,0,.55), inset 0 0 0 2px rgba(255,255,255,.14)'}}>
        <Img src={staticFile('r24/frame-124.jpg')} style={{position: 'absolute', left: -OX * S, top: -OY * S, width: 1400 * S, height: 1400 * S, maxWidth: 'none'}} />
      </div>
      {row(488, 566, k(t, 26.96, 27.3), MINT)}
      {row(574, 652, k(t, 27.47, 27.8), MINT)}
      {k(t, 28.5, 28.9) > 0 ? (
        <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
          <ellipse cx={(e0.x + e1.x) / 2} cy={(e0.y + e1.y) / 2} rx={(e1.x - e0.x) / 2 + 26} ry={(e1.y - e0.y) / 2 + 22} fill="none" stroke={C.orange} strokeWidth={8}
            pathLength={1} strokeDasharray={`${k(t, 28.5, 28.95)} 1`} transform={`rotate(-4 ${(e0.x + e1.x) / 2} ${(e0.y + e1.y) / 2})`} style={{filter: 'drop-shadow(0 0 14px rgba(255,122,47,.8))'}} />
        </svg>
      ) : null}
      {card > 0.3 ? (
        <svg width={64} height={64} viewBox="0 0 24 24" style={{position: 'absolute', left: cx, top: cy, filter: 'drop-shadow(0 4px 8px rgba(0,0,0,.5))'}}>
          <path d="M4 2 L4 19 L8.5 15 L11.5 22 L14 21 L11 14 L17 14 Z" fill="#FFFFFF" stroke="#111" strokeWidth={1.2} strokeLinejoin="round" />
        </svg>
      ) : null}
      <div style={{position: 'absolute', left: 0, top: 1262, width: W, display: 'flex', justifyContent: 'center', gap: 26}}>
        <Pill t={t} at={26.96} label="5 часов" />
        <Pill t={t} at={27.47} label="неделя" />
        <Pill t={t} at={28.5} label="сброс через…" />
      </div>
    </Dark>
  );
};

// ——— I: «А ещё видно, работает Claude или уже закончил и ждёт тебя» ———
// Работает — по дорожке кольца бежит светящаяся комета; закончил — кольцо смыкается мятным и выскакивает галочка;
// ждёт тебя — от кольца расходятся оранжевые волны (на Windows кольцо мигает, на Mac чёлка выезжает со звуком).
const SceneI: React.FC<{t: number}> = ({t}) => {
  const cx = 720, cy = 870, R = 250, IR = R - 62;
  const run = 1 - k(t, 32.2, 32.5), close = k(t, 32.36, 32.9, E.inOut), check = k(t, 32.7, 33.0, E.pop);
  const head = ((t - 30.1) * 0.62) % 1;
  const waves = t >= 33.12 ? [0, 0.33, 0.66].map((d) => ((t - 33.12) * 0.9 + d) % 1) : [];
  return (
    <Paper>
      <Brush d="M -160 640 C 140 600, 280 800, 200 960 S 60 1180, -160 1230" p={k(t, 30.08, 31.1)} width={44} glow={0.35} opacity={0.85} />
      <WordLine t={t} x={144} y={372} size={92} words={[['работает', 30.87], ['Claude', 31.58]]} />
      {waves.map((w, i) => <div key={i} style={{position: 'absolute', left: cx - R - 40 - w * 170, top: cy - R - 40 - w * 170, width: (R + 40 + w * 170) * 2, height: (R + 40 + w * 170) * 2,
        borderRadius: '50%', border: `8px solid rgba(255,122,47,${0.7 * (1 - w)})`}} />)}
      <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
        <defs>
          <linearGradient id="comet" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={MINT} stopOpacity="0" /><stop offset="1" stopColor={MINT} stopOpacity="1" /></linearGradient>
        </defs>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#D5D8D3" strokeWidth={44} />
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={C.orange} strokeWidth={44} strokeLinecap="round" pathLength={1} strokeDasharray="0.62 1"
          transform={`rotate(-90 ${cx} ${cy})`} style={{filter: `drop-shadow(0 0 ${18 + 24 * (waves.length ? 1 : 0)}px rgba(255,122,47,.6))`}} />
        <circle cx={cx} cy={cy} r={IR} fill="none" stroke="#E4E6E2" strokeWidth={16} />
        {run > 0 ? [0, 1, 2, 3, 4, 5].map((j) => (
          <circle key={j} cx={cx} cy={cy} r={IR} fill="none" stroke={MINT} strokeWidth={16} strokeLinecap="round" pathLength={1} strokeDasharray="0.035 1"
            transform={`rotate(${(head - j * 0.03) * 360 - 90} ${cx} ${cy})`} opacity={run * (1 - j * 0.16)} style={{filter: j === 0 ? 'drop-shadow(0 0 12px rgba(61,237,195,.9))' : undefined}} />
        )) : null}
        {close > 0 ? <circle cx={cx} cy={cy} r={IR} fill="none" stroke={MINT} strokeWidth={16} strokeLinecap="round" pathLength={1} strokeDasharray={`${close} 1`}
          transform={`rotate(-90 ${cx} ${cy})`} style={{filter: 'drop-shadow(0 0 12px rgba(61,237,195,.8))'}} /> : null}
      </svg>
      <div style={{position: 'absolute', left: cx - 120, top: cy - 120, width: 240, height: 240, borderRadius: '50%', background: '#FFFFFF', display: 'grid', placeItems: 'center',
        boxShadow: '0 30px 60px rgba(0,0,0,.18)'}}>
        {check < 0.05 ? <Logo name="claude" size={120} /> : (
          <svg width={150} height={150} style={{transform: `scale(${0.5 + 0.5 * check})`}}><circle cx={75} cy={75} r={70} fill={MINT} />
            <path d="M 44 78 L 67 101 L 108 55" fill="none" stroke={C.mintInk} strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" /></svg>
        )}
      </div>
      <div style={{position: 'absolute', left: 0, top: 1262, width: W, display: 'flex', justifyContent: 'center', gap: 26}}>
        <Pill t={t} at={30.87} label="работает" />
        <Pill t={t} at={32.36} label="закончил" />
        <Pill t={t} at={33.12} label="ждёт тебя" />
      </div>
    </Paper>
  );
};

// ——— J: «Вход берёт через программу, где ты уже залогинен. Отдельный аккаунт не нужен» ———
const SceneJ: React.FC<{t: number}> = ({t}) => {
  const apps = [{logo: 'claude', name: 'Claude Code', at: 34.3, ok: 36.06}, {logo: 'openai', name: 'Codex', at: 34.5, ok: 36.25}, {logo: 'cursor', name: 'Cursor', at: 34.7, ok: 36.44}];
  const form = sp(t, 36.79, FPS24, 16, 130), strike = k(t, 38.08, 38.4, E.inOut);
  return (
    <Dark t={t} from={33.74} arc={ARC2}>
      <WordLine t={t} x={144} y={372} size={72} color={C.ink} words={[['Вход', 33.79], ['берёт', 34.2], ['через', 34.42], ['программу', 34.78]]} />
      {apps.map((a, i) => {
        const s = sp(t, a.at, FPS24, 14, 150), ok = k(t, a.ok, a.ok + 0.3, E.pop);
        return (
          <div key={a.name} style={{position: 'absolute', left: 144 + i * 392, top: 520, width: 360, height: 300, opacity: Math.min(1, s * 1.6), transform: `translateY(${(1 - s) * 100}px)`}}>
            <Slab x={0} y={0} w={360} h={300} r={34} face="linear-gradient(180deg, #FFFFFF, #F1F2EF)" edge="#9DA39F">
              <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18}}>
                <Logo name={a.logo} size={110} />
                <div style={{fontFamily: SANS, fontWeight: 800, fontSize: 46, color: INK}}>{a.name}</div>
              </div>
            </Slab>
            {ok > 0 ? <div style={{position: 'absolute', right: -14, top: -22, width: 84, height: 84, borderRadius: '50%', background: MINT, display: 'grid', placeItems: 'center',
              transform: `scale(${ok})`, boxShadow: '0 0 30px rgba(61,237,195,.7)'}}>
              <svg width={48} height={48}><path d="M 10 25 L 20 35 L 38 13" fill="none" stroke={C.mintInk} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div> : null}
          </div>
        );
      })}
      <div style={{position: 'absolute', left: 270, top: 890, width: 900, height: 400, opacity: Math.min(1, form * 1.5), transform: `translateY(${(1 - form) * 120}px) rotate(${strike * -2}deg)`}}>
        <Slab x={0} y={0} w={900} h={400} r={36} face="linear-gradient(180deg, #FFFFFF, #F3F4F1)" edge="#9DA39F">
          <div style={{position: 'absolute', left: 50, top: 40, fontFamily: SANS, fontWeight: 800, fontSize: 60, color: INK}}>Создать аккаунт</div>
          {['Почта', 'Пароль'].map((f, i) => (
            <div key={f} style={{position: 'absolute', left: 50, top: 140 + i * 100, width: 800, height: 80, borderRadius: 20, background: '#EEF0EE', boxShadow: 'inset 0 0 0 2px #DADDDA',
              display: 'flex', alignItems: 'center', paddingLeft: 30, boxSizing: 'border-box', fontFamily: SANS, fontWeight: 600, fontSize: 44, color: '#9AA09C'}}>{f}</div>
          ))}
        </Slab>
      </div>
      <Brush d="M 230 1250 C 520 1150, 860 1060, 1210 900" p={strike} width={34} color={C.orange} glow={0} />
    </Dark>
  );
};

// ——— K: «Напиши в комментах слово «лимит», скину ссылку на это решение» ———
const SceneK: React.FC<{t: number}> = ({t}) => {
  const panel = sp(t, 38.6, FPS24, 16, 130);
  const typed = 'лимит'.slice(0, Math.round(5 * k(t, 40.12, 40.5, (v) => v)));
  const sent = k(t, 40.55, 40.8, E.pop), dm = sp(t, 40.94, FPS24, 15, 140);
  return (
    <Paper>
      <Brush d="M 1560 1380 C 1250 1520, 1200 1260, 1000 1300 S 640 1480, 320 1380 S -40 1280, -160 1340" p={k(t, 38.47, 39.7)} width={44} glow={0.35} opacity={0.85} />
      <div style={{position: 'absolute', left: 144, top: 372, display: 'flex', alignItems: 'baseline', gap: 26, fontFamily: SANS, fontWeight: 800, fontSize: 96, letterSpacing: '-0.035em', color: INK}}>
        <span style={{opacity: k(t, 38.52, 38.9)}}>Напиши</span>
        <span style={{position: 'relative', opacity: k(t, 40.12, 40.4)}}>
          <span style={{position: 'absolute', left: -14, right: -14, top: '46%', height: '46%', borderRadius: 12, background: MINT, transformOrigin: 'left', transform: `scaleX(${k(t, 40.2, 40.6)})`, zIndex: -1}} />
          «лимит»
        </span>
      </div>
      <div style={{position: 'absolute', left: 220, top: 520, width: 1000, height: 720, opacity: Math.min(1, panel * 1.5), transform: `translateY(${(1 - panel) * 120}px)`}}>
        <Slab x={0} y={0} w={1000} h={720} r={44} face="linear-gradient(180deg, #FFFFFF, #F6F7F4)" edge="#AEB3AF">
          <div style={{position: 'absolute', left: 50, top: 36, fontFamily: SANS, fontWeight: 800, fontSize: 52, color: INK}}>Комментарии</div>
          {[0, 1].map((i) => (
            <div key={i} style={{position: 'absolute', left: 50, top: 140 + i * 120, display: 'flex', alignItems: 'center', gap: 24}}>
              <div style={{width: 72, height: 72, borderRadius: '50%', background: i ? '#FFD9C4' : '#CFF7EC'}} />
              <div><div style={{width: 260 - i * 60, height: 22, borderRadius: 11, background: '#DDE0DC'}} /><div style={{width: 420 + i * 80, height: 22, borderRadius: 11, background: '#ECEEEB', marginTop: 14}} /></div>
            </div>
          ))}
          {sent > 0 ? (
            <div style={{position: 'absolute', left: 50, top: 400, display: 'flex', alignItems: 'center', gap: 24, opacity: sent, transform: `translateY(${(1 - sent) * 40}px)`}}>
              <div style={{width: 72, height: 72, borderRadius: '50%', background: MINT, display: 'grid', placeItems: 'center', fontFamily: SANS, fontWeight: 800, fontSize: 44, color: C.mintInk}}>ты</div>
              <div style={{fontFamily: SANS, fontWeight: 800, fontSize: 56, color: INK}}>лимит</div>
            </div>
          ) : null}
          <div style={{position: 'absolute', left: 40, bottom: 40, width: 920, height: 110, borderRadius: 55, background: '#F0F2EF', boxShadow: 'inset 0 0 0 2px #DDE0DC',
            display: 'flex', alignItems: 'center', padding: '0 40px', boxSizing: 'border-box', justifyContent: 'space-between'}}>
            <span style={{fontFamily: SANS, fontWeight: 700, fontSize: 50, color: typed ? INK : '#9AA09C'}}>{typed && sent < 0.5 ? typed : 'Добавьте комментарий…'}</span>
            <div style={{width: 70, height: 70, borderRadius: '50%', background: typed ? C.orange : '#C9CECA', display: 'grid', placeItems: 'center'}}>
              <svg width={34} height={34} viewBox="0 0 24 24"><path d="M3 12 L21 4 L14 21 L11 13 Z" fill="#FFFFFF" /></svg>
            </div>
          </div>
        </Slab>
        {dm > 0.01 ? (
          <div style={{position: 'absolute', left: 400 + (1 - dm) * 420, top: 126, width: 560, opacity: Math.min(1, dm * 1.6), transform: `scale(${0.85 + 0.15 * dm})`, transformOrigin: '100% 0%'}}>
            <Slab x={0} y={0} w={560} h={250} r={34} face="linear-gradient(180deg, #111416, #0B0D0F)" edge="#000">
              <div style={{position: 'absolute', left: 30, top: 22, fontFamily: SANS, fontWeight: 800, fontSize: 44, color: C.ink}}>Директ</div>
              <div style={{position: 'absolute', left: 26, top: 90, width: 508, height: 132, borderRadius: 24, background: '#1C2124', display: 'flex', alignItems: 'center', gap: 20, padding: '0 22px', boxSizing: 'border-box'}}>
                <Img src={staticFile('r24/codenotch-icon.png')} style={{width: 84, height: 84, borderRadius: 20}} />
                <div style={{fontFamily: SANS, fontWeight: 800, fontSize: 44, color: C.ink, lineHeight: 1.12}}>Codenotch<div style={{fontFamily: MONO, fontWeight: 600, fontSize: 43, color: MINT}}>github.com</div></div>
              </div>
            </Slab>
          </div>
        ) : null}
      </div>
    </Paper>
  );
};

// ——— L: «Отдашь её Claude, и он сам всё установит» ———
const SceneL: React.FC<{t: number}> = ({t}) => {
  const g = (at: number) => (t >= at && t < at + 0.35 ? Math.sin((t - at) * 90) * 14 : 0);
  const bubble = sp(t, 42.9, FPS24, 15, 140), ok = k(t, 43.4, 43.7, E.pop);
  const word = (txt: string, at: number, y: number) => {
    const a = k(t, at, at + 0.3);
    return <div style={{position: 'absolute', left: 0, width: W, top: y, textAlign: 'center', fontFamily: NUM, fontWeight: 900, fontSize: 230, lineHeight: 1, letterSpacing: '-0.04em',
      color: C.ink, opacity: a, transform: `scaleX(0.8) translateX(${g(at)}px)`, filter: a < 1 ? `blur(${(1 - a) * 16}px)` : undefined,
      textShadow: `${g(at) * 0.6}px 0 0 rgba(61,237,195,.85), ${-g(at) * 0.6}px 0 0 rgba(255,122,47,.85), 0 0 60px rgba(61,237,195,.25)`}}>{txt}</div>;
  };
  return (
    <Dark t={t} from={42.1} arc={ARC1}>
      {word('ОТДАЙ', 42.15, 360)}
      {word('CLAUDE', 42.65, 590)}
      <div style={{position: 'absolute', left: 190, top: 900, width: 1060, opacity: Math.min(1, bubble * 1.5), transform: `translateY(${(1 - bubble) * 100}px)`}}>
        <Slab x={0} y={0} w={1060} h={330} r={40} face="linear-gradient(180deg, #FFFFFF, #F2F3F0)" edge="#8E9591">
          <div style={{position: 'absolute', left: 44, top: 34, display: 'flex', alignItems: 'center', gap: 18, fontFamily: SANS, fontWeight: 800, fontSize: 46, color: INK}}>
            <Logo name="claude" size={54} />Claude Code
          </div>
          <div style={{position: 'absolute', left: 44, top: 118, fontFamily: SANS, fontWeight: 600, fontSize: 46, color: INK}}>Поставь мне Codenotch</div>
          <div style={{position: 'absolute', left: 44, top: 206, display: 'flex', alignItems: 'center', gap: 18, opacity: ok, transform: `scale(${0.8 + 0.2 * ok})`, transformOrigin: 'left center',
            fontFamily: SANS, fontWeight: 800, fontSize: 52, color: '#0FA37F'}}>
            <svg width={60} height={60}><circle cx={30} cy={30} r={28} fill={MINT} /><path d="M 17 31 L 27 41 L 44 21" fill="none" stroke={C.mintInk} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" /></svg>
            установлено
          </div>
        </Slab>
      </div>
    </Dark>
  );
};

// ——— Раскладка по времени: сцена, зона и переход входа (причина — фраза речи) ———
type Tin = 'none' | 'brush' | 'blur' | 'whip' | 'zoom';
type Sc = {from: number; light: boolean; tin: Tin; render: (t: number, fps: number) => React.ReactNode};
const SCENES: Sc[] = [
  {from: 0, light: true, tin: 'none', render: (t) => <Paper><SceneA t={t} /></Paper>},
  {from: 2.95, light: false, tin: 'brush', render: (t, fps) => <SceneB t={t} fps={fps} />},
  {from: 6.02, light: true, tin: 'blur', render: (t, fps) => <Paper><SceneC t={t} fps={fps} /></Paper>},
  {from: 11.9, light: false, tin: 'whip', render: (t) => <SceneD t={t} />},
  {from: 13.72, light: true, tin: 'zoom', render: (t) => <SceneE t={t} />},
  {from: 16.55, light: false, tin: 'brush', render: (t) => <SceneF t={t} />},
  {from: 21.62, light: true, tin: 'blur', render: (t) => <SceneG t={t} />},
  {from: 24.42, light: false, tin: 'whip', render: (t) => <SceneH t={t} />},
  {from: 30.08, light: true, tin: 'blur', render: (t) => <SceneI t={t} />},
  {from: 33.74, light: false, tin: 'brush', render: (t) => <SceneJ t={t} />},
  {from: 38.47, light: true, tin: 'whip', render: (t) => <SceneK t={t} />},
  {from: 42.1, light: false, tin: 'zoom', render: (t) => <SceneL t={t} />},
];
const ZIGZAG = 'M -260 300 L 1700 170 L -260 760 L 1700 630 L -260 1220 L 1700 1090 L -260 1680';

const Scenes: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  let i = 0;
  for (let j = 0; j < SCENES.length; j++) if (t >= SCENES[j].from) i = j;
  const next = SCENES[i + 1];
  const cur = SCENES[i];
  const layers: React.ReactNode[] = [];
  const layer = (sc: Sc, style: React.CSSProperties, key: string) => <AbsoluteFill key={key} style={style}>{sc.render(t, fps)}</AbsoluteFill>;
  // переход, который уже начался до смены (whip / zoom рисуют обе сцены сразу)
  const b = next && next.from - t < 0.2 && (next.tin === 'whip' || next.tin === 'zoom') ? next : null;
  const into = cur.from > 0 && t - cur.from < 0.3 && (cur.tin === 'whip' || cur.tin === 'zoom') ? cur : null;
  const two = b ? {prev: cur, nxt: b} : into ? {prev: SCENES[i - 1], nxt: into} : null;
  if (two) {
    const at = two.nxt.from, p = k(t, at - 0.2, at + 0.3, E.inOut);
    if (two.nxt.tin === 'whip') {
      layers.push(layer(two.prev, {transform: `translateX(${-p * W}px)`, filter: `blur(${Math.sin(p * Math.PI) * 26}px)`}, 'p'));
      layers.push(layer(two.nxt, {transform: `translateX(${(1 - p) * W}px)`, filter: `blur(${Math.sin(p * Math.PI) * 26}px)`}, 'n'));
    } else {
      layers.push(layer(two.prev, {transform: `scale(${1 + p * 0.5})`, opacity: 1 - p}, 'p'));
      layers.push(layer(two.nxt, {transform: `scale(${0.88 + 0.12 * p})`, opacity: p}, 'n'));
    }
  } else {
    let f: string | undefined;
    if (next && next.tin === 'blur' && next.from - t < 0.18) f = `blur(${k(t, next.from - 0.18, next.from) * 24}px)`;
    if (cur.tin === 'blur' && t - cur.from < 0.24) f = `blur(${(1 - k(t, cur.from, cur.from + 0.24)) * 24}px)`;
    layers.push(layer(cur, {filter: f}, 'c'));
  }
  // кисть и вспышка поверх смены
  let brush: React.ReactNode = null, flash = 0;
  for (const sc of SCENES) {
    if (sc.tin === 'brush' && t > sc.from - 0.25 && t < sc.from + 0.35) brush = <Brush d={ZIGZAG} p={k(t, sc.from - 0.25, sc.from, E.inOut)} q={k(t, sc.from, sc.from + 0.33, E.inOut)} width={560} glow={0.4} />;
    if (sc.tin === 'blur') flash = Math.max(flash, k(t, sc.from - 0.18, sc.from, E.inOut) * (1 - k(t, sc.from, sc.from + 0.24, E.inOut)));
  }
  return <>{layers}{brush}{flash > 0 ? <AbsoluteFill style={{background: '#F4FFFB', opacity: flash * 0.92}} /> : null}</>;
};
const lightAt = (t: number) => {
  let l = true;
  for (const sc of SCENES) if (t >= sc.from) l = sc.light;
  return l;
};

// Звуки: действие → тембр; громкость ×0,37 от исходной (заметка sfx-quieter). Тембры свежие относительно ролика 22.
const SFX: [number, string, number][] = [
  [0.1, 'woosh-air', 0.2], [1.36, 'typing', 0.22], [1.7, 'ui-click', 0.2], [2.32, 'ui-click', 0.2], [2.44, 'snap', 0.24],
  [2.72, 'whoosh-sharp', 0.3], [3.04, 'ui-glass', 0.22], [3.96, 'whoosh-long', 0.18], [4.6, 'shimmer', 0.2], [5.47, 'ui-soft', 0.2],
  [5.86, 'blur', 0.26], [6.12, 'ui-slide', 0.18], [7.5, 'ui-pop', 0.22], [7.96, 'transform', 0.22], [9.24, 'ui-glass', 0.26],
  [10.02, 'ui-tap', 0.22], [11.12, 'switch', 0.22],
  [11.72, 'whoosh-sharp2', 0.28], [12.9, 'ui-pop', 0.22], [13.27, 'ui-pop', 0.22],
  [13.55, 'zoom', 0.26], [16.1, 'ui-soft', 0.2],
  [16.32, 'whoosh-sharp', 0.28], [19.08, 'ui-glass', 0.2], [19.5, 'ui-glass', 0.2], [20.05, 'ui-glass', 0.2], [20.78, 'ui-glass', 0.22],
  [21.46, 'blur', 0.24], [22.3, 'riser', 0.16], [23.75, 'transform2', 0.2],
  [24.22, 'whoosh-sharp2', 0.28], [25.3, 'ui-click', 0.22], [26.98, 'ui-tap', 0.2], [27.5, 'ui-tap', 0.2], [28.52, 'shimmer', 0.2],
  [29.92, 'blur', 0.24], [30.9, 'ui-seq', 0.18], [32.38, 'ui-pop', 0.22], [33.14, 'rubber', 0.2],
  [33.5, 'whoosh-sharp', 0.28], [36.08, 'tick-soft', 0.2], [36.27, 'tick-soft', 0.2], [36.46, 'tick-soft', 0.2], [36.8, 'ui-slide', 0.18], [38.1, 'snap', 0.26],
  [38.28, 'whoosh-sharp2', 0.28], [40.14, 'typing', 0.2], [40.56, 'ui-click', 0.22], [40.96, 'ui-glass', 0.24],
  [41.9, 'zoom-deep', 0.24], [42.16, 'flash', 0.2], [42.66, 'flash', 0.2], [43.42, 'sub-hit', 0.2],
];
const SFX_GAIN = 0.37;

export const Reel24: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const pin = k(t, 40.6, 41.0, E.pop);
  return (
    <FormatProvider value={FORMATS.reels}>
      <AbsoluteFill style={{background: PAPER}}>
        <Scenes t={t} fps={fps} />
        <Speaker t={t} video={{src: 'r24/speaker.mp4', w: 1080, h: 1920, headY: 900, muted: false}} />
        <Captions t={t} words={WORDS24} cx={720} cy={1467} maxW={920} size={53.3} frameW={W} frameH={H} light={lightAt(t)} />
        {pin > 0 && t >= 42.1 ? (
          <div style={{position: 'absolute', left: 0, top: 1262, width: W, display: 'flex', justifyContent: 'center'}}>
            <Pill t={t} at={42.3} label="напиши «лимит» в комментариях" size={52} />
          </div>
        ) : null}
        {SFX.map(([at, name, v], i) => (
          <Sequence key={i} from={Math.round(at * fps)} durationInFrames={Math.round(2.5 * fps)} layout="none">
            <Audio src={staticFile(`sfx/${name}.wav`)} volume={v * SFX_GAIN} />
          </Sequence>
        ))}
      </AbsoluteFill>
    </FormatProvider>
  );
};
