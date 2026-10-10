import React from 'react';
import {Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import {blurThrough, whip} from '../../kit/presentations';
import {useFontsReady} from '../../kit/liquid/useAssetReady';
import {fontSpec, textWidth} from '../../kit/liquid/words';
import {Mark, MONO} from '../../montage/parts';
import type {SceneProps, StyleDef} from '../../styles/engine';
import {EXPERT} from '../../styles/expert';
import {E, Fit, k, NUM, SANS, springAt, Words} from '../../styles/parts';
import type {BlockData} from '../../template/blocks';
import type {Word} from '../../template/demo';

// Общий набор для перемонтажей в стиле B ЭКСПЕРТ (рилсы r25 и r20, 10.10.2026): запись на нижней половине кадра,
// сверху платиновая доска. Движок и «кожа» берутся из src/styles/expert.tsx, здесь только то, чего в нём нет:
// свои сцены по id блока, крупные метки раздела с ползунком, окно браузера под клипы и снимки, плашки, курсор, звук.
// Доска — верхняя половина 1440×1280, зона сцены x 150–1290 (внутри безопасных полей Instagram), y 300–1080,
// субтитры стоят на шве (центр y 1157), поэтому всё содержимое сцен заканчивается до y 1085.
export const INK = '#111316', SUB = '#6B7078', MUTE = '#7C8189', OR = '#FF7A2F', MINT = '#3DEDC3', MINT_INK = '#05231D', MINT_DK = '#0FA37F', RED = '#E5484D';
export const RING = '0 0 0 2px rgba(17,19,22,.07), 0 24px 48px rgba(17,19,22,.14)';
export const Z = {x: 150, y: 300, w: 1140, h: 780};
export {E, k, NUM, SANS, MONO, springAt};

// ——— Звук: эффекты из public/sfx, громкость ×0,37 как в движке стилей ———
export type Cue = [number, string, number];
export const SFX_GAIN = 0.37;
export const Sfx: React.FC<{cues: Cue[]}> = ({cues}) => {
  const {fps} = useVideoConfig();
  return (
    <>
      {cues.map(([at, name, v], i) => (
        <Sequence key={i} from={Math.max(0, Math.round(at * fps))} durationInFrames={Math.round(2.5 * fps)} layout="none">
          <Audio src={staticFile(`sfx/${name}.wav`)} volume={v * SFX_GAIN} />
        </Sequence>
      ))}
    </>
  );
};

// Голос ролика: звук самой записи rec.mp4 (не audio.mp3, тот моно 16 кГц для распознавания). Видео спикера при этом без звука.
export const Voice: React.FC<{src: string | null}> = ({src}) => (src ? <Audio src={staticFile(src)} /> : null);

// ——— Слова записи → слова для субтитров: правки написания, числа цифрами, слияние слов ———
// Fix: строка — заменить текст, null — убрать слово, [текст, n] — слить слово с n следующими.
export type RawWord = {w: string; t0: number; t1: number};
export type Fix = string | null | [string, number];
export const buildWords = (raw: RawWord[], fixes: Record<number, Fix>): Word[] => {
  const out: Word[] = [];
  for (let i = 0; i < raw.length; i++) {
    const f = fixes[i];
    if (f === null) continue;
    if (Array.isArray(f)) { out.push({text: f[0], start: raw[i].t0, end: raw[i + f[1]].t1}); i += f[1]; continue; }
    out.push({text: f ?? raw[i].w, start: raw[i].t0, end: raw[i].t1});
  }
  return out;
};
// Блок-носитель: сцену рисует таблица сцен по id, вид блока здесь не важен.
export const blk = (id: string, at: number): BlockData => ({kind: 'logos', id, label: id, at, title: '', logos: []});

// Живые часы сцены: идут с первого кадра ролика, не зависят от замороженного времени первой сцены.
export const useLive = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  return f / fps;
};

// ——— Появление: пружина от секунды, подъём, лёгкий рост; out — растворение ———
export const Rise: React.FC<{t: number; at: number; x: number; y: number; w?: number; h?: number; dy?: number; anchor?: 'left' | 'center' | 'right'; out?: number;
  dx?: number; style?: React.CSSProperties; children?: React.ReactNode}> = ({t, at, x, y, w, h, dy = 70, dx = 0, anchor = 'left', out, style, children}) => {
  const a = springAt(t, at), o = out !== undefined ? 1 - k(t, out, out + 0.3, E.inOut) : 1;
  if (a <= 0 || o <= 0) return null;
  const tx = anchor === 'center' ? '-50%' : anchor === 'right' ? '-100%' : '0px';
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: Math.min(1, a * 1.6) * o,
      transform: `translate(${tx}, 0) translate(${(1 - a) * dx}px, ${(1 - a) * dy}px) scale(${0.94 + 0.06 * a})`, ...style}}>{children}</div>
  );
};

// Один ряд текста: кегль сам уменьшается, чтобы строка влезла в maxW (замер после загрузки шрифта).
export const FitText: React.FC<{text: string; maxW: number; size: number; family?: string; weight?: number; track?: number; color?: string;
  style?: React.CSSProperties; render?: React.ReactNode}> = ({text, maxW, size, family = SANS, weight = 800, track = -0.03, color = INK, style, render}) => {
  const spec = fontSpec(weight, size, family);
  const ready = useFontsReady([spec]);
  const w = ready ? textWidth(text, spec, size, track) : 0;
  const s = w > maxW ? size * (maxW / w) * 0.99 : size;
  return <div style={{fontFamily: family, fontWeight: weight, fontSize: s, letterSpacing: `${track}em`, lineHeight: 1.05, whiteSpace: 'nowrap', color, ...style}}>{render ?? text}</div>;
};

// ——— Заголовок ЭКСПЕРТА: слова поднимаются из размытия, под строками полоса акцента ———
export const Title: React.FC<{t: number; at: number; lines: string[]; size: number; x?: number; y?: number; w?: number; color?: string; bar?: boolean;
  accent?: string; barColor?: string; step?: number}> = ({t, at, lines, size, x = Z.x, y = Z.y, w = Z.w, color = INK, bar = true, accent, barColor = OR, step = 0.12}) => {
  const spec = fontSpec(800, size, SANS);
  const ready = useFontsReady([spec]);
  const widths = ready ? lines.map((l) => textWidth(l, spec, size, -0.035) + size * 0.26 * l.split(' ').length) : [0];
  const maxW = Math.max(...widths);
  const s = maxW > w ? size * (w / maxW) * 0.98 : size;
  const lh = s * 1.04;
  return (
    <>
      {lines.map((ln, i) => (
        <Words key={i} t={t} at={at + i * 0.2} text={ln} size={s} color={color} x={x} y={y + i * lh} w={w + 80} family={SANS} lineHeight={1} step={step}
          accent={accent} accentColor={OR} />
      ))}
      {bar ? <div style={{position: 'absolute', left: x, top: y + lines.length * lh + 6, height: 14, borderRadius: 5, background: barColor,
        width: Math.min(w, Math.max(...widths.map((v) => v * (s / size)))) * k(t, at + 0.35, at + 0.85, E.out)}} /> : null}
    </>
  );
};
export const titleH = (lines: number, size: number) => lines * size * 1.04 + 34;

// ——— Знак сервиса: цветные svg как есть, у чёрных svg цвет задаётся маской, png через img ———
const MARKED: Record<string, string | undefined> = {claude: undefined, anthropic: INK, openai: INK, x: INK, unrealengine: INK, nintendo: '#E60012', instagram: undefined, bitrix24: '#2FC6F6'};
export const Brand: React.FC<{name: string; size: number; style?: React.CSSProperties}> = ({name, size, style}) => {
  if (name.endsWith('.png')) return <Img src={staticFile(`brand/${name}`)} style={{width: size, height: size, objectFit: 'contain', flex: 'none', ...style}} />;
  if (name in MARKED) return <Mark name={name} size={size} color={MARKED[name]} style={style} />;
  return <Img src={staticFile(`brand/${name}.svg`)} style={{width: size, height: size, objectFit: 'contain', flex: 'none', ...style}} />;
};
export const Tile: React.FC<{name: string; size: number; bg?: string; r?: number; pad?: number; style?: React.CSSProperties}> = ({name, size, bg = '#FFFFFF', r, pad = 0.22, style}) => (
  <div style={{width: size, height: size, borderRadius: r ?? size * 0.26, background: bg, display: 'grid', placeItems: 'center', flex: 'none', boxShadow: RING, ...style}}>
    <Brand name={name} size={size * (1 - pad * 2)} />
  </div>
);

// ——— Плашка по ширине текста: поля 0,6 кегля, текст не касается края ———
export type Tone = 'white' | 'ink' | 'orange' | 'mint';
const TONES: Record<Tone, {bg: string; ink: string; shadow: string}> = {
  white: {bg: '#FFFFFF', ink: INK, shadow: RING},
  ink: {bg: INK, ink: '#FFFFFF', shadow: '0 18px 36px rgba(17,19,22,.28)'},
  orange: {bg: OR, ink: '#2A0E02', shadow: '0 18px 36px rgba(255,122,47,.35)'},
  mint: {bg: MINT, ink: MINT_INK, shadow: '0 18px 36px rgba(61,237,195,.35)'},
};
export const Chip: React.FC<{t: number; at: number; x: number; y: number; label: string; size?: number; logo?: string; tone?: Tone; mono?: boolean; anchor?: 'left' | 'center' | 'right';
  out?: number; badge?: string; dy?: number; dx?: number; id?: string}> = ({t, at, x, y, label, size = 48, logo, tone = 'white', mono, anchor = 'left', out, badge, dy = 50, dx = 0, id}) => {
  const T = TONES[tone];
  return (
    <Rise t={t} at={at} x={x} y={y} anchor={anchor} out={out} dy={dy} dx={dx}>
      <Fit name={`chip:${id ?? label}`} style={{display: 'inline-flex', alignItems: 'center', gap: size * 0.32, height: size * 1.8, padding: `0 ${size * 0.62}px 0 ${badge || logo ? size * 0.52 : size * 0.62}px`,
        boxSizing: 'border-box', borderRadius: size * 0.9, background: T.bg, color: T.ink, boxShadow: T.shadow, whiteSpace: 'nowrap', fontFamily: mono ? MONO : SANS, fontWeight: 700,
        fontSize: size, letterSpacing: mono ? '0' : '-0.01em'}}>
        {badge ? <span style={{display: 'grid', placeItems: 'center', width: size * 1.12, height: size * 1.12, borderRadius: '50%', background: tone === 'ink' ? OR : INK, color: '#FFFFFF',
          fontFamily: NUM, fontWeight: 900, fontSize: size * 0.7, flex: 'none'}}>{badge}</span> : null}
        {logo ? <Brand name={logo} size={size * 1.12} /> : null}
        {label}
      </Fit>
    </Rise>
  );
};

// ——— Окно браузера: бар с точками и адресом, содержимое прижато под баром; поднимается пружиной ———
export const WIN_BAR = 80;
export const Win: React.FC<{t: number; at: number; x: number; y: number; w: number; h: number; url?: string; lock?: boolean; name: string; dy?: number; dx?: number;
  out?: number; children?: React.ReactNode}> = ({t, at, x, y, w, h, url, lock, name, dy = 90, dx = 0, out, children}) => (
  <Rise t={t} at={at} x={x} y={y} w={w} h={h} dy={dy} dx={dx} out={out}>
    <div style={{position: 'relative', width: w, height: h, borderRadius: 30, overflow: 'hidden', background: '#FFFFFF', boxShadow: '0 0 0 2px rgba(17,19,22,.08), 0 34px 70px rgba(17,19,22,.2)'}}>
      <div style={{height: WIN_BAR, display: 'flex', alignItems: 'center', gap: 14, padding: '0 24px', boxSizing: 'border-box', background: '#F1F2F4', boxShadow: 'inset 0 -1px 0 rgba(17,19,22,.1)'}}>
        {['#FF6159', '#FFBD2E', '#28C941'].map((c) => <span key={c} style={{width: 18, height: 18, borderRadius: '50%', background: c, flex: 'none'}} />)}
        {url ? (
          <Fit name={`url:${name}`} style={{marginLeft: 12, flex: 1, minWidth: 0, height: 56, borderRadius: 28, background: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 12, padding: '0 24px',
            boxSizing: 'border-box', overflow: 'hidden', whiteSpace: 'nowrap', fontFamily: MONO, fontWeight: 600, fontSize: 43, lineHeight: 1, color: '#5E636B'}}>
            {lock ? <svg width={30} height={34} viewBox="0 0 26 30" style={{flex: 'none'}}><rect x={3} y={13} width={20} height={15} rx={4} fill="#5E636B" /><path d="M 7 13 V 9 a 6 6 0 0 1 12 0 V 13" fill="none" stroke="#5E636B" strokeWidth={3.5} /></svg> : null}
            {url}
          </Fit>
        ) : null}
      </div>
      <div style={{position: 'absolute', left: 0, top: WIN_BAR, width: w, height: h - WIN_BAR, overflow: 'hidden', background: '#0B0D10'}}>{children}</div>
    </div>
  </Rise>
);

// Клипы в окне: по очереди, от секунды at до to; trim — с какой секунды клипа начинать; scene — секунда начала сцены (кадр 0 её Sequence).
export type ClipSpec = {src: string; at: number; to: number; trim?: number};
export const Clips: React.FC<{t: number; scene: number; clips: ClipSpec[]; pos?: string}> = ({t, scene, clips, pos = '50% 45%'}) => {
  const {fps} = useVideoConfig();
  return (
    <>
      {clips.map((c, i) => {
        const o = i === 0 ? 1 : k(t, c.at, c.at + 0.16);
        const zoom = 1.02 + 0.05 * k(t, c.at, c.to, (v) => v);
        return (
          <Sequence key={c.src + c.at} from={Math.round((c.at - scene) * fps)} durationInFrames={Math.max(1, Math.round((c.to - c.at + 0.3) * fps))} layout="none">
            <div style={{position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', opacity: o, transform: `scale(${zoom})`}}>
              {/* OffthreadVideo: у Video из @remotion/media тайм-аут декодера на клипах 1080p 60 к/с (r25, 09.10.2026) */}
              <OffthreadVideo src={staticFile(c.src)} muted startFrom={Math.round((c.trim ?? 0) * fps)} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: pos}} />
            </div>
          </Sequence>
        );
      })}
    </>
  );
};

// ——— Курсор: ключи [секунда, x, y], нажатия по секундам; кольцо расходится от места нажатия ———
export const Cursor: React.FC<{t: number; pts: [number, number, number][]; press?: number[]; size?: number}> = ({t, pts, press = [], size = 1}) => {
  const first = pts[0][0];
  if (t < first - 0.25) return null;
  let x = pts[0][1], y = pts[0][2];
  for (let i = 1; i < pts.length; i++) {
    const [t0, x0, y0] = pts[i - 1], [t1, x1, y1] = pts[i];
    if (t >= t0) { const p = k(t, t0, t1, E.inOut); x = x0 + (x1 - x0) * p; y = y0 + (y1 - y0) * p; }
  }
  const a = k(t, first - 0.25, first), dip = press.some((p) => t > p && t < p + 0.16) ? 0.86 : 1;
  return (
    <>
      {press.map((p) => {
        const r = k(t, p, p + 0.5, E.out);
        return r > 0 && r < 1 ? <div key={p} style={{position: 'absolute', left: x - 70 * r - 6, top: y - 70 * r - 6, width: 140 * r + 12, height: 140 * r + 12, borderRadius: '50%',
          border: `5px solid ${OR}`, opacity: 1 - r}} /> : null;
      })}
      <svg width={70 * size} height={90 * size} viewBox="0 0 70 90" style={{position: 'absolute', left: x, top: y, opacity: a, transform: `scale(${dip})`, transformOrigin: '8px 6px',
        filter: 'drop-shadow(0 8px 14px rgba(0,0,0,.4))'}}>
        <path d="M 6 4 L 6 70 L 22 55 L 34 84 L 46 78 L 34 50 L 56 50 Z" fill="#FFFFFF" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
      </svg>
    </>
  );
};

export const CheckBadge: React.FC<{size: number; p?: number; bg?: string; ink?: string}> = ({size, p = 1, bg = MINT, ink = MINT_INK}) => (
  <svg width={size} height={size} viewBox="0 0 40 40" style={{flex: 'none', overflow: 'visible'}}>
    <circle cx={20} cy={20} r={19} fill={bg} />
    <path d="M11 21 L18 28 L30 13" fill="none" stroke={ink} strokeWidth={4.4} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${p} 1`} />
  </svg>
);

// Белая карточка с рамкой и тенью (материал кожи ЭКСПЕРТА)
export const cardStyle = (r = 30): React.CSSProperties => ({borderRadius: r, background: '#FFFFFF', boxShadow: RING, boxSizing: 'border-box'});

// ——— Метка раздела: «● 03 / ПОДПИСЬ» крупным моно, справа ползунок — по точке на блок ———
const SectionLabel: React.FC<{t: number; b: BlockData; i: number; n: number; label: string}> = ({t, b, i, n, label}) => {
  const a = k(t, b.at + 0.15, b.at + 0.5, E.out);
  return (
    <>
      <div style={{position: 'absolute', left: 170, top: 224, fontFamily: MONO, fontWeight: 700, fontSize: 44, letterSpacing: '.06em', lineHeight: 1.3, color: MUTE, whiteSpace: 'nowrap',
        opacity: a, transform: `translateX(${(1 - a) * -30}px)`}}>
        <span style={{color: OR}}>●</span> {String(i + 1).padStart(2, '0')} / {label}
      </div>
      <div style={{position: 'absolute', right: 170, top: 246, display: 'flex', alignItems: 'center', gap: 10, opacity: a}}>
        {Array.from({length: n}, (_, j) => (
          <span key={j} style={{width: j === i ? 38 : 14, height: 14, borderRadius: 7, background: j < i ? INK : j === i ? OR : '#C5C9CF'}} />
        ))}
      </div>
    </>
  );
};

// ——— Сборка стиля: ЭКСПЕРТ из движка + свои сцены по id блока, свои метки разделов и стыки ———
export const makeStyle = (scenes: Record<string, React.FC<SceneProps>>, labels: Record<string, string>, whipDirs: ('left' | 'right' | 'up' | 'down')[] = ['left', 'up', 'right']): StyleDef => {
  const Background: StyleDef['Background'] = ({t, i, b, f, project}) => (
    <>
      {/* kicker заглушает мелкую метку раздела движка: рисуем свою, крупнее */}
      <EXPERT.Background t={t} i={i} b={{...b, kicker: ' '}} f={f} project={project} />
      <SectionLabel t={t} b={b} i={i} n={project.blocks.length} label={labels[b.id] ?? b.id} />
    </>
  );
  const Scene: React.FC<SceneProps> = (p) => {
    const C = scenes[p.b.id];
    return C ? <C {...p} /> : <EXPERT.Scene {...p} />;
  };
  return {
    ...EXPERT, zone: () => Z, Background, Scene,
    // чередуем размытие через платину и рывок; направление рывка меняется, чтобы стыки не повторялись
    transition: (i) => (i % 2 ? whip({dir: whipDirs[Math.floor(i / 2) % whipDirs.length]}) : blurThrough({color: '#EEF0F2'})) as never,
  };
};
export type {SceneProps};
