import React from 'react';
import {OffthreadVideo, staticFile} from 'remotion';
import {Video} from '@remotion/media';
import {RecStub} from './recStub';

// Полоса-створка для записи спикера внизу кадра (стиль ЭСТАФЕТА 35%, паттерн patterns/techniques/speaker-strip-35.md).
// Полоса 900 px (35% высоты кадра 2560), нижний край записи совпадает с кромкой кадра (пустоты внизу нет), скруглены только
// верхние углы, как у створки. Запись заполняет полосу без растягивания: по бокам срезается лишнее, лицо ставится по высоте.
// Новые ролики: <SpeakerStrip src=… srcW=… srcH=… h={STRIP.h35} inset={STRIP.insetIg} r={STRIP.rIg} />. Полоса уже кадра на 130 px
// с каждого бока, радиус 110. Причина: Instagram растягивает 9:16 до высоты экрана и срезает бока (по замеру скриншотов iPhone на
// вкладке Reels по 68 px с каждого бока кадра 1440, во весь экран по 130 px), поэтому угол во всю ширину там не виден совсем.
// Графика и субтитры живут в x 160…1280. Проверка до показа: ключевые кадры в трёх видах (исходник, срез 68 и 130 px с боков).
// Без h полоса берёт всю высоту записи (старый вид, нужен только для роликов, сданных до 03.10.2026).
export const STRIP = {x: 0, w: 1440, r: 56, rIg: 110, insetIg: 130, gx0: 160, gx1: 1280, frameH: 2560, h35: 900} as const;
export const stripH = (srcW: number, srcH: number) => Math.round((srcH * STRIP.w) / srcW);
export const stripTop = (srcW: number, srcH: number) => STRIP.frameH - stripH(srcW, srcH);

// Проба вида полосы на всём ролике без правки его кода: <StripLook.Provider value={{r, inset, faceY, zoom}}> поверх ролика
export type StripLookT = {r?: number; inset?: number; faceY?: number; zoom?: number; headTop?: number};
export const StripLook = React.createContext<StripLookT>({});

// Необязательный вариант «голова поверх края»: cut — та же запись с альфой (WebM VP9, силуэт вырезан отдельным инструментом
// вырезки фона, например RobustVideoMatting; в курс он не входит), cardTop — верх карточки в координатах кадра (ниже середины
// головы). Спикер стоит там же, где в обычной полосе 900 px; карточка с записью начинается ниже, а над её краем рисуется только
// вырезанный силуэт с мягкой тенью. Без cut всё работает как обычная полоса.
export const SpeakerStrip: React.FC<{src: string | null; srcW: number; srcH: number; shade?: number; rim?: string; style?: React.CSSProperties; h?: number; faceY?: number; zoom?: number; r?: number; inset?: number; headTop?: number; headroom?: number; faceX?: number;
  cut?: string; cardTop?: number}> =
  (props) => {
    const look = React.useContext(StripLook);
    const {src, srcW, srcH, shade = 0.45, rim = 'rgba(255,255,255,.34)', style, h: fixedH, cut} = props;
    const faceY = look.faceY ?? props.faceY ?? 0.38, zoom = look.zoom ?? props.zoom ?? 1, r = look.r ?? props.r ?? STRIP.r, inset = look.inset ?? props.inset ?? 0;
    const headTop = look.headTop ?? props.headTop, headroom = props.headroom ?? 80, faceX = props.faceX;
    // при фиксированной высоте запись заполняет полосу: масштаб по большей стороне, бока срезаются, по вертикали — по лицу
    // zoom > 1: спикер крупнее и выше внутри той же полосы (автор курса 03.10: «выше моё видео»), срезается низ кадра (стол, руки)
    const W = STRIP.w - 2 * inset, h = fixedH ?? stripH(srcW, srcH), sc = Math.max(W / srcW, h / srcH) * zoom, vw = srcW * sc, vh = srcH * sc;
    // headTop — доля высоты записи, где макушка в самом высоком моменте ролика (замер по кадрам); над ней headroom px полосы.
    // Автор курса 04.10.2026: «сильно сверху обрезаешь… голова обрезается» — при zoom 1.3 и faceY 0.55 срезались верхние 23% записи
    // faceX — доля ширины записи, где центр лица (спикер не по центру кадра); без него запись по центру
    const vx = faceX != null ? Math.min(0, Math.max(W - vw, W / 2 - vw * faceX)) : (W - vw) / 2, vy = Math.min(0, Math.max(h - vh, headTop != null ? headroom - vh * headTop : h * 0.42 - vh * faceY));
    const top = STRIP.frameH - h; // верх обычной полосы; запись всегда стоит от него
    const cardTop = cut ? props.cardTop ?? top : top, cardH = STRIP.frameH - cardTop, dy = top - cardTop;
    return (
      <>
        <div style={{position: 'absolute', left: STRIP.x + inset, top: cardTop, width: W, height: cardH, overflow: 'hidden', background: '#0A0B0E',
          borderRadius: `${r}px ${r}px 0 0`, boxShadow: `0 -26px 70px rgba(0,0,0,${shade})`, ...style}}>
          {/* maxWidth: 'none' обязателен: Tailwind иначе сжимает запись по ширине, и лицо сплющивается */}
          {src ? <Video src={staticFile(src)} muted style={{position: 'absolute', left: vx, top: vy + dy, width: vw, height: vh, maxWidth: 'none', maxHeight: 'none'}} /> : <RecStub />}
          {/* кромка створки: тонкий блик по верху, как у стекла, чтобы край читался на любом фоне */}
          <div style={{position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none',
            boxShadow: `inset 0 2px 0 ${rim}, inset 0 0 0 1.5px rgba(255,255,255,.07)`}} />
        </div>
        {cut && src ? (
          <>
            {/* над краем: обрезан по ширине карточки и по её верху, мягкая тень на фон (рисуется первым: тень уходит под силуэт внутри карточки, а не на лицо) */}
            <div style={{position: 'absolute', left: STRIP.x + inset, top: 0, width: W, height: cardTop, overflow: 'hidden', pointerEvents: 'none',
              filter: 'drop-shadow(0 18px 34px rgba(0,0,0,.32))'}}>
              <OffthreadVideo src={staticFile(cut)} muted transparent style={{position: 'absolute', left: vx, top: top + vy, width: vw, height: vh, maxWidth: 'none', maxHeight: 'none'}} />
            </div>
            {/* силуэт внутри карточки тем же источником, что и над краем: лицо целиком из вырезки, шва по краю нет */}
            <div style={{position: 'absolute', left: STRIP.x + inset, top: cardTop, width: W, height: cardH, overflow: 'hidden', borderRadius: `${r}px ${r}px 0 0`, pointerEvents: 'none'}}>
              <OffthreadVideo src={staticFile(cut)} muted transparent style={{position: 'absolute', left: vx, top: vy + dy, width: vw, height: vh, maxWidth: 'none', maxHeight: 'none'}} />
            </div>
          </>
        ) : null}
      </>
    );
  };
