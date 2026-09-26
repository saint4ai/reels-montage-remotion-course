import React from 'react';
import {AbsoluteFill, Img, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio, Video} from '@remotion/media';
import {Captions} from '../../montage/Captions';
import {E, k} from '../../montage/parts';
import {Backdrop, type BackdropKind} from '../../kit/backdrops';
import {END, WORDS} from './words';

// ШАБЛОН СВОЕГО РОЛИКА: формат «половина экрана эксперт + монтаж сверху», иногда эксперт сворачивается в окно в углу
// и анимация раскрывается на весь кадр (образец: patterns/reels/r29-jarvis-ironman). Копируется командой
// `npm run new -- <slug> custom`. Кадр 1440×2560, 60 fps; финал 2K, 4K по просьбе (`npm run render:4k`).
// Что менять под ролик: SPEAKER, VOICE, BLOCKS (смысловые блоки по карте монтажа), CHANGES (когда сворачиваться), SFX.
export const FPS = 60;
export const SECONDS = END;

const W = 1440, H = 2560;
const lerp = (a: number, b: number, m: number) => a + (b - a) * m;
const sp = (t: number, at: number, fps: number, damping = 12, stiffness = 170) =>
  t < at ? 0 : spring({frame: (t - at) * fps, fps, config: {damping, stiffness, mass: 1}});

// Запись спикера и голос: положить в public/work/<slug>/ и вписать пути. null — заглушка вместо лица, без звука.
const SPEAKER: string | null = null; // 'work/<slug>/speaker.mp4'
const VOICE: string | null = null; // 'work/<slug>/voice.wav'
// Точка лица в кадре записи (доли ширины и высоты): лицо не обрезается и не искажается при любом окне.
const FACE = {x: 0.5, y: 0.42};

// ——— режим: 0 — деление экрана, 1 — анимация на весь кадр, спикер в окне в углу ———
// Сворачивание ставить на смену смыслового блока, где нужна вся площадь (схема, живой интерфейс). 0,7 с.
const CHANGES: [number, number][] = [[4.7, 1], [10.9, 0]];
const modeAt = (t: number) => CHANGES.reduce((m, [c, v]) => lerp(m, v, k(t, c - 0.35, c + 0.35, E.inOut)), 0);

type Rect = {x: number; y: number; w: number; h: number; r: number};
const SPLIT: Rect = {x: 0, y: 1280, w: 1440, h: 1280, r: 0};
// Окно в углу: шире квадрата и мельче масштабом, чтобы голова и плечи были целиком. Справа рейка Instagram — угол левый.
const CORNER: Rect = {x: 70, y: 1548, w: 500, h: 450, r: 36};
const mix = (a: Rect, b: Rect, m: number): Rect => ({x: lerp(a.x, b.x, m), y: lerp(a.y, b.y, m), w: lerp(a.w, b.w, m), h: lerp(a.h, b.h, m), r: lerp(a.r, b.r, m)});

const Speaker: React.FC<{m: number}> = ({m}) => {
  const rc = mix(SPLIT, CORNER, m);
  // Равномерный масштаб (ширина видео lerp, высота по 9:16) — лицо никогда не сплющивается.
  const vw = lerp(1440, 540, m), vh = (vw * 16) / 9;
  const left = Math.min(0, Math.max(rc.w - vw, rc.w / 2 - FACE.x * vw));
  const top = Math.min(0, Math.max(rc.h - vh, lerp(560, 190, m) - FACE.y * vh));
  return (
    <div style={{position: 'absolute', left: rc.x, top: rc.y, width: rc.w, height: rc.h, borderRadius: rc.r, overflow: 'hidden', background: '#16181B',
      boxShadow: m > 0.5 ? '0 0 0 3px rgba(255,255,255,.9), 0 30px 60px rgba(0,0,0,.6)' : undefined}}>
      {SPEAKER ? (
        // maxWidth: 'none' обязателен: Tailwind ставит max-width 100%, и видео шире окна сжимается по ширине.
        <Video src={staticFile(SPEAKER)} volume={0} objectFit="cover" style={{position: 'absolute', left, top, width: vw, height: vh, maxWidth: 'none', maxHeight: 'none'}} />
      ) : (
        <Img src={staticFile('objects/mic.webp')} style={{position: 'absolute', left: rc.w / 2 - 120, top: rc.h / 2 - 140, width: 240, height: 240, objectFit: 'contain'}} />
      )}
    </div>
  );
};

// ——— смысловые блоки: у каждого свой фон (смена фона на каждом блоке, 5–7 в минуту) ———
type BlockProps = {t: number; fps: number};
const Big: React.FC<{text: string; size: number; color: string; y: number; at: number; t: number; fps: number}> = ({text, size, color, y, at, t, fps}) => {
  const a = sp(t, at, fps, 12, 190);
  return (
    <div style={{position: 'absolute', left: 144, width: 1008, top: y, textAlign: 'center', fontFamily: 'Inter Tight', fontWeight: 900, fontSize: size, lineHeight: 1.02,
      letterSpacing: '-0.035em', color, opacity: Math.min(1, a * 1.6), transform: `translateY(${(1 - a) * 40}px) scale(${0.9 + 0.1 * a})`,
      textShadow: '0 4px 0 rgba(0,0,0,.25), 0 18px 40px rgba(0,0,0,.35)'}}>{text}</div>
  );
};

// ХУК: первые 3 секунды — одна фраза-обещание огромным шрифтом, 4–6 слов, контраст, без мелких подписей.
// По данным 24 рилсов охват идёт за долей пролистываний в первые 3 с (меньше 40% — охват в разы выше).
// Кадр 0 уже полный (at < 0): Instagram показывает его до первого слова, пустой первый кадр запрещён.
const Hook: React.FC<BlockProps> = ({t, fps}) => (
  <AbsoluteFill><Backdrop kind="black" />
    <Big text="Монтаж" size={210} color="#FFFFFF" y={330} at={-0.6} t={t} fps={fps} />
    <Big text="без монтажёра" size={150} color="#FF7A2F" y={560} at={-0.45} t={t} fps={fps} />
  </AbsoluteFill>
);
const Point: React.FC<BlockProps> = ({t, fps}) => (
  <AbsoluteFill><Backdrop kind="graphite" />
    <Big text="Агент делает сам" size={110} color="#FFFFFF" y={420} at={4.9} t={t} fps={fps} />
    {['субтитры', 'графику', 'звук'].map((s, i) => (
      <Big key={s} text={`✓ ${s}`} size={90} color="#3DEDC3" y={680 + i * 150} at={5.6 + i * 0.5} t={t} fps={fps} />
    ))}
  </AbsoluteFill>
);
const Steps: React.FC<BlockProps> = ({t, fps}) => (
  <AbsoluteFill><Backdrop kind="white" />
    <Big text="Запись → расшифровка → карта → рендер" size={84} color="#101214" y={520} at={8.1} t={t} fps={fps} />
  </AbsoluteFill>
);
const Cta: React.FC<BlockProps> = ({t, fps}) => (
  <AbsoluteFill><Backdrop kind="mint" />
    <Big text="«монтаж»" size={170} color="#05231D" y={430} at={11.3} t={t} fps={fps} />
    <Big text="в комментариях" size={80} color="#05231D" y={640} at={11.6} t={t} fps={fps} />
  </AbsoluteFill>
);

// a, b — начало и конец блока (секунды речи). Стык ставится на слово, с которого начинается новая мысль.
const BLOCKS: {a: number; b: number; C: React.FC<BlockProps>; bg: BackdropKind}[] = [
  {a: 0, b: 4.7, C: Hook, bg: 'black'}, {a: 4.7, b: 8.0, C: Point, bg: 'graphite'}, {a: 8.0, b: 10.9, C: Steps, bg: 'white'}, {a: 10.9, b: END, C: Cta, bg: 'mint'},
];

// Звуки из public/sfx по смыслу действия (не по названию файла): вуш на стык, клик/pop на появление, confirm на успех.
// Громкость ×0,37 от исходной, эффекты тише голоса. Перед выбором послушать или проверить характер нарезки.
const SFX: [number, string, number][] = [[0, 'riser', 0.4], [4.4, 'whoosh-long', 0.4], [5.6, 'aamir-ui-pop', 0.35], [7.7, 'whoosh-big', 0.35], [10.6, 'whoosh-long', 0.4], [11.3, 'aamir-confirm', 0.35]];

export const TemplateReel: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const m = modeAt(t);
  return (
    <AbsoluteFill style={{background: '#000'}}>
      {BLOCKS.map((B, i) => {
        // Переход: новый блок проявляется за 0,35 с поверх старого (размытие + масштаб), старый уходит так же.
        const inP = i === 0 ? 1 : k(t, B.a - 0.2, B.a + 0.2, E.inOut), outP = i === BLOCKS.length - 1 ? 0 : k(t, B.b - 0.2, B.b + 0.2, E.inOut);
        if (t < B.a - 0.25 || t > B.b + 0.25) return null;
        return (
          <AbsoluteFill key={i} style={{opacity: inP * (1 - outP), filter: inP < 1 ? `blur(${(1 - inP) * 10}px)` : outP > 0 ? `blur(${outP * 10}px)` : undefined,
            transform: `scale(${1 + (1 - inP) * 0.06 - outP * 0.04})`}}>
            <B.C t={t} fps={fps} />
          </AbsoluteFill>
        );
      })}
      <Speaker m={m} />
      {/* Субтитры: 53,3 px в 2K, над швом при делении (1157) и ниже середины на весь кадр (1467); не на лице, не под окном. */}
      <Captions t={t} words={WORDS} cx={690} cy={lerp(1157, 1467, m)} maxW={900} family="Inter Tight" weight={700} />
      {VOICE ? <Audio src={staticFile(VOICE)} /> : null}
      {SFX.map(([at, name, v], i) => (
        <Sequence key={i} from={Math.round(at * fps)} durationInFrames={Math.round(2 * fps)} layout="none">
          <Audio src={staticFile(`sfx/${name}.wav`)} volume={v * 0.37} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
