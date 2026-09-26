import {Easing, Img, interpolate, staticFile} from 'remotion';
import {Video} from '@remotion/media';
import type {Box} from '../../formats';

// Гибрид «СЦЕНЫ + половина» (выбор Александра 24.09.2026): сверху сцены со сменой фона по блокам, снизу он сам.
// Три раскладки на выбор:
//   A «Шов»     — запись на всю ширину нижней половины, шов на 1280, субтитры тёмной плашкой над швом (как ролики 1, 2, 4, 5);
//   B «Окно»    — та же половина, но запись в стеклянном окне со скруглением и полями, доска видна вокруг;
//   C «Дыхание» — шов ездит по смыслу: 60/40 на показе экрана, 50/50 обычно, 40/60 на прямом обращении к зрителю.
// Числа — в 2K (1440×2560). Смысловая зона графики: x 144…1152 (справа рейка Instagram), сверху от 360 (интерфейс площадки).
export type Variant = 'A' | 'B' | 'C';
export type Split = 'screen' | 'half' | 'talk';
export const W = 1440, H = 2560;
const SEAM: Record<Split, number> = {screen: 1536, half: 1280, talk: 1024};
const ease = Easing.bezier(0.65, 0, 0.35, 1);   // power3.inOut, как у карточки спикера

// План пропорций для «Дыхания»: [секунда, пропорция]; переход 0,6 с
export type SplitPlan = [number, Split][];
export const seamAt = (v: Variant, t: number, plan: SplitPlan): number => {
  if (v !== 'C') return SEAM.half;
  let y = SEAM[plan[0][1]];
  for (let i = 1; i < plan.length; i++) {
    const [at, s] = plan[i];
    y += (SEAM[s] - y) * interpolate(t, [at, at + 0.6], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease});
  }
  return y;
};

// Зона графики над швом: сверху — ниже интерфейса площадки, снизу — над плашкой субтитров
export const zoneOf = (seam: number): Box => ({x: 144, y: 380, w: 1008, h: seam - 220 - 380});
export const captionY = (seam: number) => seam - 123;   // 1157 при шве 1280 — как в роликах 1–5
export const boardBox = (v: Variant, seam: number): Box => v === 'B' ? {x: 0, y: 0, w: W, h: H} : {x: 0, y: 0, w: W, h: seam};

// Запись спикера. Пока записи нет — кадр лица из прошлого ролика (reference/style-previews/layout-2026-09-18).
export type SpeakerSrc = {video?: string; still?: string; headY?: number; audio?: boolean; w?: number; h?: number};
const Face: React.FC<{box: Box; src: SpeakerSrc; radius: number}> = ({box, src, radius}) => {
  // запись «по заполнению» вручную: Video из @remotion/media вписывает кадр целиком, поэтому размер и сдвиг считаем сами —
  // центр головы (headY — доля высоты кадра записи) ставим на 45 % высоты окна
  const vw0 = src.w ?? 1440, vh0 = src.h ?? 2560, sc = Math.max(box.w / vw0, box.h / vh0), vw = vw0 * sc, vh = vh0 * sc;
  const top = Math.min(0, Math.max(box.h - vh, box.h * 0.45 - (src.headY ?? 0.45) * vh));
  const media: React.CSSProperties = {position: 'absolute', left: (box.w - vw) / 2, top, width: vw, height: vh};
  return (
    <div style={{position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, borderRadius: radius, overflow: 'hidden', background: '#14171A'}}>
      {src.video ? <Video src={staticFile(src.video)} muted={!src.audio} style={media} /> : src.still ? <Img src={staticFile(src.still)} style={{...media, objectFit: 'cover'}} /> : null}
    </div>
  );
};

export const SpeakerHalf: React.FC<{v: Variant; seam: number; src: SpeakerSrc}> = ({v, seam, src}) => {
  if (v === 'B') {
    // окно: поля 44, скругление 64, стеклянная рама 14 px с бликом сверху; доска продолжается вокруг окна
    const m = 44, top = seam + 36, box = {x: m, y: top, w: W - m * 2, h: H - top - m};
    return (
      <>
        <div style={{position: 'absolute', left: box.x - 14, top: box.y - 14, width: box.w + 28, height: box.h + 28, borderRadius: 78,
          background: 'linear-gradient(180deg, rgba(255,255,255,.22), rgba(255,255,255,.06))', backdropFilter: 'blur(24px)',
          boxShadow: 'inset 0 2px 0 rgba(255,255,255,.45), inset 0 0 0 2px rgba(255,255,255,.14), 0 50px 90px rgba(0,0,0,.55)'}} />
        <Face box={box} src={src} radius={64} />
        <div style={{position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, borderRadius: 64, pointerEvents: 'none',
          boxShadow: 'inset 0 0 0 2px rgba(255,255,255,.18), inset 0 30px 60px rgba(0,0,0,.25)'}} />
      </>
    );
  }
  // A и C: запись во всю ширину ниже шва, мягкая тень доски на верхнем крае записи
  return (
    <>
      <Face box={{x: 0, y: seam, w: W, h: H - seam}} src={src} radius={0} />
      <div style={{position: 'absolute', left: 0, top: seam, width: W, height: 44, background: 'linear-gradient(180deg, rgba(0,0,0,.34), rgba(0,0,0,0))'}} />
    </>
  );
};
