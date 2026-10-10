import React from 'react';
import {Easing, OffthreadVideo, staticFile} from 'remotion';
import {RecStub} from './recStub';

// Камера спикера, которая ездит по кадру вслед за анимацией (решение автора курса 09.10.2026: камера меняет положение
// в зависимости от анимации, а не точечно; бывает кружком, как в Telegram, и карточкой, как в Screen Studio, а таймлайн
// продолжается вокруг рамки). Навык: .claude/skills/onai-montage, стиль 17 МИРЫ (patterns/styles/worlds/PATTERN.md).
// Рамка задаётся ключами {at, m}: на каждом ключе рамка плавно перетекает в новую форму (позиция, размер, радиус),
// запись внутри всегда держит лицо в заданной точке рамки. Вокруг рамки тонкий таймлайн: прошедшая доля ролика идёт
// по периметру от верхней середины по часовой стрелке, рядом незаметная плашка «0:12 / 0:49».
// Запись — OffthreadVideo без 3D и без blur (иначе мерцает), рамка — обычный div с overflow hidden.

export type CamShape = {x: number; y: number; w: number; h: number; r: number; fy?: number; zoom?: number};
export type CamKey = {at: number; d?: number; m: CamShape};

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
// CAMERA_MOVE из ресёрча ChatGPT 09.10.2026: 18 кадров при 30 к/с, cubic-bezier(.33,1,.68,1); после переезда доводчик 1 → 1,025 → 1
const ease = Easing.bezier(0.33, 1, 0.68, 1);

// Формы для кадра 1440×2560 (низ кадра, графика сверху до y 1440, субтитры на 1540).
// Решение 09.10.2026: у камеры с лицом только две формы, Screen Studio (скруглённая карточка) и кружок. Высота рамки не меньше
// 0,8 ширины, голова целиком: широкие низкие таблетки, полосы, овалы и узкие боковые карточки срезали голову в первом ролике,
// поэтому в таблице их больше нет, а camGuard ниже не даёт собрать такую рамку.
export const CAM = {
  card: {x: 180, y: 1640, w: 1080, h: 864, r: 56, fy: 0.42, zoom: 1} as CamShape, // Screen Studio снизу: парящая карточка (хук, личное утверждение)
  studioTop: {x: 170, y: 380, w: 1100, h: 880, r: 56, fy: 0.45} as CamShape, // Screen Studio сверху: анимация и субтитры уходят вниз
  circleR: {x: 840, y: 1700, w: 540, h: 540, r: 270, fy: 0.5, zoom: 1.35} as CamShape, // кружок справа: предмет или 3D сверху с другой стороны
  circleL: {x: 60, y: 1700, w: 540, h: 540, r: 270, fy: 0.5, zoom: 1.35} as CamShape,
  circleC: {x: 390, y: 1640, w: 660, h: 660, r: 330, fy: 0.5, zoom: 1.25} as CamShape, // большой кружок по центру: прямое обращение, призыв
  circleTR: {x: 880, y: 400, w: 440, h: 440, r: 220, fy: 0.5} as CamShape, // кружок в верхнем правом углу: сцена главнее спикера
};

// Проверка ключей камеры до рендера: рамка с лицом не ниже 0,8 своей ширины (линейный переезд между двумя такими рамками
// тоже проходит). Вызывается в SpeakerCam; ошибка сразу, а не срезанная голова в готовом MP4.
export const camGuard = (keys: CamKey[]) => {
  keys.forEach((kk, i) => {
    if (kk.m.h < kk.m.w * 0.8 - 0.5) throw new Error(`Камера, ключ ${i} (${kk.at} с): рамка ${kk.m.w}×${kk.m.h} ниже 0,8 ширины, голова не поместится. Нужны карточка Screen Studio или кружок.`);
  });
};

// доводчик: после конца переезда рамка чуть «садится» (масштаб 1,025 и обратно за 10 кадров)
export const camSettle = (keys: CamKey[], t: number) => {
  let v = 0;
  for (let i = 1; i < keys.length; i++) { const d = keys[i].d ?? 0.6, e = keys[i].at + d / 2, u = (t - e) / 0.33; if (u > 0 && u < 1) v = Math.max(v, Math.sin(Math.PI * u)); }
  return 1 + 0.025 * v;
};
export const camAt = (keys: CamKey[], t: number): CamShape => {
  let cur = keys[0].m;
  for (let i = 1; i < keys.length; i++) {
    const kk = keys[i], d = kk.d ?? 0.6, u = ease(clamp((t - (kk.at - d / 2)) / d));
    if (u <= 0) break;
    const a = cur, b = kk.m;
    cur = {x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), w: lerp(a.w, b.w, u), h: lerp(a.h, b.h, u), r: lerp(a.r, b.r, u),
      fy: lerp(a.fy ?? 0.45, b.fy ?? 0.45, u), zoom: lerp(a.zoom ?? 1, b.zoom ?? 1, u)};
  }
  return cur;
};

// контур скруглённого прямоугольника от верхней середины по часовой стрелке (для кружка w = h, r = w/2)
const rrPath = (x: number, y: number, w: number, h: number, r: number) => {
  const rr = Math.max(0.01, Math.min(r, w / 2, h / 2)), x1 = x + w, y1 = y + h, cx = x + w / 2;
  return `M ${cx} ${y} H ${x1 - rr} A ${rr} ${rr} 0 0 1 ${x1} ${y + rr} V ${y1 - rr} A ${rr} ${rr} 0 0 1 ${x1 - rr} ${y1} H ${x + rr} A ${rr} ${rr} 0 0 1 ${x} ${y1 - rr} V ${y + rr} A ${rr} ${rr} 0 0 1 ${x + rr} ${y} Z`;
};
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export const SpeakerCam: React.FC<{t: number; keys: CamKey[]; src: string | null; srcW: number; srcH: number; faceX?: number; faceY?: number; total: number;
  accent?: string; rim?: string; gap?: number; label?: boolean; scale?: number; headPx?: number}> =
  ({t, keys, src, srcW, srcH, faceX = 0.5, faceY = 0.34, total, accent = 'rgba(255,255,255,.92)', rim = 'rgba(255,255,255,.22)', gap = 14, label = true, scale, headPx = 440}) => {
    camGuard(keys);
    const m = camAt(keys, t), settle = camSettle(keys, t);
    // масштаб: рамка закрыта записью без пустот, а голова (headPx в записи) занимает не больше ~55% меньшей стороны рамки,
    // чтобы в маленьком кружке и узкой карточке была видна голова целиком (кадр 09.10: при одном масштабе в кружке был один лоб)
    const zoom = m.zoom ?? 1, cover = Math.max(m.w / srcW, m.h / srcH);
    const sc = scale ?? Math.max(cover, Math.min(cover * zoom, (0.55 * Math.min(m.w, m.h)) / headPx)), vw = srcW * sc, vh = srcH * sc;
    // лицо (faceX, faceY доли записи) в точке (середина, fy) рамки, без пустых краёв
    const fit = (box: number, v: number, want: number) => (v <= box ? (box - v) / 2 : Math.min(0, Math.max(box - v, want)));
    const vx = fit(m.w, vw, m.w / 2 - vw * faceX), vy = fit(m.h, vh, m.h * (m.fy ?? 0.45) - vh * faceY);
    const p = clamp(t / Math.max(0.1, total));
    const g = gap, P = rrPath(m.x - g, m.y - g, m.w + 2 * g, m.h + 2 * g, m.r + g);
    const round = m.r >= Math.min(m.w, m.h) / 2 - 1;
    // цифры времени на нижней кромке рамки: у кружка в точках на 7 и 5 часов (как у видеосообщения), у карточки у нижних углов
    const lx0 = round ? m.x + m.w * 0.16 : m.x + 70, lx1 = round ? m.x + m.w * 0.84 : m.x + m.w - 70, ly = round ? m.y + m.h * 0.86 : m.y + m.h - 48;
    return (
      <>
        <div style={{position: 'absolute', left: m.x, top: m.y, width: m.w, height: m.h, borderRadius: m.r, overflow: 'hidden', background: '#0A0B0E', transform: `scale(${settle})`,
          boxShadow: `0 30px 80px rgba(0,0,0,.45), inset 0 0 0 1.5px ${rim}`}}>
          {src ? <OffthreadVideo src={staticFile(src)} muted style={{position: 'absolute', left: vx, top: vy, width: vw, height: vh, maxWidth: 'none', maxHeight: 'none'}} /> : <RecStub />}
          <div style={{position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', boxShadow: `inset 0 2px 0 ${rim}`}} />
        </div>
        <svg width={1440} height={2560} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none'}}>
          <path d={P} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth={3} />
          <path d={P} pathLength={1} fill="none" stroke={accent} strokeWidth={3.5} strokeLinecap="round" strokeDasharray={`${p} 2`} style={{filter: "drop-shadow(0 0 6px rgba(255,255,255,.35))"}} />
        </svg>
        {label ? (
          <>
            {/* как у видеосообщения: слева снизу сколько прошло, справа снизу длина ролика, мелко и без плашки */}
            <div style={{position: 'absolute', left: lx0, top: ly, fontFamily: '"JetBrains Mono", monospace', fontSize: 26, fontWeight: 600, color: 'rgba(255,255,255,.85)',
              textShadow: '0 1px 6px rgba(0,0,0,.7)', whiteSpace: 'nowrap', transform: 'translateX(-50%)'}}>{mmss(t)}</div>
            <div style={{position: 'absolute', left: lx1, top: ly, fontFamily: '"JetBrains Mono", monospace', fontSize: 26, fontWeight: 600, color: 'rgba(255,255,255,.85)',
              textShadow: '0 1px 6px rgba(0,0,0,.7)', whiteSpace: 'nowrap', transform: 'translateX(-50%)'}}>{mmss(total)}</div>
          </>
        ) : null}
      </>
    );
  };
