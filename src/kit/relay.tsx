import React, {useMemo} from 'react';
import {AbsoluteFill, Img, random, staticFile} from 'remotion';
import {useFontsReady} from './liquid/useAssetReady';
import {fontSpec, textWidth} from './liquid/words';
import {RBE, rk} from './reactbits';

// Общие блоки «эстафеты цвета» (CHROMA RELAY в духе референса «5 плагинов Claude Code для видео»), вынесены из ролика
// «Трюки со ссылками GitHub» 03.10.2026: жидкое стекло, свечения зоны, субтитры над полосой-створкой, зерно и виньетка,
// стеклянная плитка-цифра из размытия, размытые наклонные карточки (глубина резкости), значки, дрейф камеры.
export const W = 1440;
export const SF = 'SF Pro Display', MONO = 'JBM';
export const rgba = (hex: string, a: number) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
export const mix = (a: number, b: number, p: number) => a + (b - a) * p;

// ——— Жидкое стекло: полупрозрачная подложка, размытие, обод и блик сверху слева ———
export const glass = (dark: boolean, a?: number): React.CSSProperties => ({
  background: `rgba(255,255,255,${a ?? (dark ? 0.08 : 0.55)})`,
  backdropFilter: 'blur(28px) saturate(1.7)', WebkitBackdropFilter: 'blur(28px) saturate(1.7)',
  boxShadow: dark
    ? 'inset 0 2px 0 rgba(255,255,255,.3), inset 0 0 0 1.5px rgba(255,255,255,.12), inset 0 -12px 28px rgba(0,0,0,.22), 0 34px 90px rgba(0,0,0,.5)'
    : 'inset 0 2px 0 rgba(255,255,255,1), inset 0 0 0 1.5px rgba(255,255,255,.75), inset 0 -12px 28px rgba(90,60,140,.08), 0 30px 70px rgba(60,40,100,.18)',
});
export const Sheen: React.FC = () => <div style={{position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', background: 'linear-gradient(155deg, rgba(255,255,255,.24), rgba(255,255,255,0) 40%)'}} />;

// ——— Фон зоны: база, плывущие цветные свечения, необязательная точечная сетка ———
export type Orb = [number, number, number, string, number];
export const orbsCss = (orbs: Orb[], t: number) => orbs.map(([x, y, r, c, a], i) =>
  `radial-gradient(circle ${r}px at ${x + Math.sin(t * 0.6 + i * 1.7) * 95}px ${y + Math.cos(t * 0.5 + i * 2.1) * 80}px, ${rgba(c, a)}, ${rgba(c, 0)})`).join(', ');
export const Glows: React.FC<{t: number; base: string; orbs: Orb[]; dots?: string; style?: React.CSSProperties; children?: React.ReactNode}> = ({t, base, orbs, dots, style, children}) => (
  <AbsoluteFill style={{background: base, ...style}}>
    <AbsoluteFill style={{backgroundImage: orbsCss(orbs, t)}} />
    {dots ? <AbsoluteFill style={{backgroundImage: `radial-gradient(${dots} 2.6px, transparent 3.2px)`, backgroundSize: '44px 44px', backgroundPosition: `${(t * 6) % 44}px 0`}} /> : null}
    {children}
  </AbsoluteFill>
);

// ——— Зерно и виньетка (Raylight: зерно 0,02–0,07) ———
export const Finish: React.FC<{frame: number; light: boolean}> = ({frame, light}) => (
  <>
    <AbsoluteFill style={{background: `radial-gradient(ellipse 120% 90% at 50% 42%, rgba(0,0,0,0) 58%, rgba(${light ? '40,20,60,.16' : '0,0,0,.5'}) 100%)`, pointerEvents: 'none'}} />
    <AbsoluteFill style={{backgroundImage: `url(${staticFile('kit/grain.png')})`, backgroundSize: '512px 512px',
      backgroundPosition: `${Math.floor(random(`gx${frame}`) * 512)}px ${Math.floor(random(`gy${frame}`) * 512)}px`, opacity: light ? 0.05 : 0.07, mixBlendMode: 'overlay', pointerEvents: 'none'}} />
  </>
);

// ——— Субтитры: 53 px (40 на сетке 1080), светлые на тёмном и тёмные на светлом, произносимое слово подчёркнуто ———
type CapWord = {text: string; s: number; e: number; x: number; w: number; line: number};
type CapPage = {words: CapWord[]; s: number; e: number; widths: number[]};
// Автор курса 03.10.2026: «субтитры всегда в одну строчку». По умолчанию одна строка до 1180 px; lines=2 — старый вид.
const CAP = {size: 53, lh: 72, maxW: 880, maxW1: 1180, padX: 34, padY: 16};
const buildPages = (words: [string, number, number][], maxLines = 1, maxWIn?: number): CapPage[] => {
  const maxW = maxWIn ?? (maxLines === 1 ? CAP.maxW1 : CAP.maxW);
  const font = fontSpec(600, CAP.size, SF);
  const space = textWidth(' ', font, CAP.size);
  const pages: CapPage[] = [];
  let cur: {words: CapWord[]; lines: number[]} = {words: [], lines: [0]};
  const flush = () => { if (cur.words.length) pages.push({words: cur.words, s: 0, e: 0, widths: cur.lines}); cur = {words: [], lines: [0]}; };
  words.forEach(([text, s, e]) => {
    const w = textWidth(text, font, CAP.size);
    let li = cur.lines.length - 1;
    if (cur.lines[li] > 0 && cur.lines[li] + space + w > maxW) {
      if (cur.lines.length >= maxLines) { flush(); li = 0; } else { cur.lines.push(0); li = 1; }
    }
    const x = cur.lines[li] > 0 ? cur.lines[li] + space : 0;
    cur.words.push({text, s, e, x, w, line: li});
    cur.lines[li] = x + w;
    if (/[.?!]$/.test(text) || (maxLines === 1 && /[,:]$/.test(text) && cur.lines[0] > maxW * 0.45)) flush();
  });
  flush();
  pages.forEach((p, i) => {
    p.s = p.words[0].s - 0.06;
    p.e = i + 1 < pages.length ? pages[i + 1].words[0].s - 0.06 : p.words[p.words.length - 1].e + 0.8;
  });
  return pages;
};
// maxW — ширина строки без полей (05.10.2026: под обрезку Instagram подложка в x 160–1280, строка до 1050).
// maxLines — то же, что lines (так вызывают ролики партии 06.10: maxW={1040} maxLines={1}).
export const Captions: React.FC<{t: number; words: [string, number, number][]; light: boolean; accent: string; cy?: number; from?: number; lines?: number; maxLines?: number; maxW?: number}> =
  ({t, words, light, accent, cy = 1590, from = 3.0, lines, maxLines, maxW}) => {
    const ready = useFontsReady([fontSpec(600, CAP.size, SF)]);
    const L = maxLines ?? lines ?? 1;
    const pages = useMemo(() => (ready ? buildPages(words, L, maxW) : []), [ready, words, L, maxW]);
    if (!ready || t < from) return null;
    const pg = pages.find((p) => t >= p.s && t < p.e);
    if (!pg) return null;
    const bw = Math.max(...pg.widths) + CAP.padX * 2, bh = pg.widths.length * CAP.lh + CAP.padY * 2;
    const a = rk(t, pg.s, pg.s + 0.16);
    const ink = light ? '#15171A' : '#F2F3F5';
    return (
      <div style={{position: 'absolute', left: 720 - bw / 2, top: cy - bh / 2, width: bw, height: bh, borderRadius: 30, opacity: a, transform: `translateY(${(1 - a) * 10}px)`,
        background: light ? 'rgba(255,255,255,.68)' : 'rgba(8,10,18,.5)', backdropFilter: 'blur(20px) saturate(1.5)', WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
        boxShadow: light ? 'inset 0 1.5px 0 #FFFFFF, 0 14px 34px rgba(40,30,80,.12)' : 'inset 0 1.5px 0 rgba(255,255,255,.18), 0 16px 40px rgba(0,0,0,.35)'}}>
        {pg.words.map((w, i) => {
          const x = CAP.padX + (bw - CAP.padX * 2 - pg.widths[w.line]) / 2 + w.x, y = CAP.padY + w.line * CAP.lh;
          const next = pg.words[i + 1]?.s ?? pg.e;
          const said = t >= w.s - 0.02, now = said && t < next;
          return (
            <React.Fragment key={i}>
              <div style={{position: 'absolute', left: x, top: y, fontFamily: SF, fontWeight: 600, fontSize: CAP.size, lineHeight: `${CAP.lh}px`, color: ink, opacity: said ? 1 : 0.42, whiteSpace: 'pre'}}>{w.text}</div>
              {now ? <div style={{position: 'absolute', left: x, top: y + CAP.lh - 9, width: w.w * rk(t, w.s, w.s + 0.12), height: 6, borderRadius: 3, background: accent}} /> : null}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

// ——— Стеклянная плитка с цифрой из размытия (референс «5») ———
export const NumTile: React.FC<{t: number; at: number; out: number; n: string; dark: boolean; cy?: number; s?: number; fs?: number}> = ({t, at, out, n, dark, cy = 1000, s = 400, fs = 300}) => {
  const a = rk(t, at, at + 0.6, RBE.out), x = rk(t, out, out + 0.35, RBE.inExpo);
  if (a <= 0 || x >= 1) return null;
  return (
    <div style={{position: 'absolute', left: 720 - s / 2, top: cy - s / 2, width: s, height: s, borderRadius: s * 0.25, ...glass(dark, dark ? 0.1 : 0.5),
      opacity: Math.min(1, a * 1.5) * (1 - x), transform: `translateY(${-x * 520}px) scale(${(0.94 + 0.06 * a) * (1 - 0.5 * x)})`}}>
      <Sheen />
      <div style={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: SF, fontWeight: 800, fontSize: fs, lineHeight: 1,
        backgroundImage: dark ? 'linear-gradient(180deg,#FFFFFF,rgba(255,255,255,.5))' : 'linear-gradient(180deg,#1A1A1F,#5A5560)', WebkitBackgroundClip: 'text', backgroundClip: 'text',
        color: 'transparent', filter: a < 0.99 ? `blur(${(1 - a) * 34}px)` : undefined}}>{n}</div>
    </div>
  );
};
// ——— Размытые наклонные карточки на дальнем плане (глубина резкости) ———
export const DofCards: React.FC<{t: number; at: number; out: number; srcs: string[]; spots?: [number, number, number, number][]}> = ({t, at, out, srcs, spots}) => {
  const a = rk(t, at, at + 0.7), x = rk(t, out, out + 0.4);
  if (a <= 0 || x >= 1) return null;
  const S = spots ?? [[-330, 760, -16, 0.55], [1060, 820, 14, 0.5], [880, 1330, 9, 0.35], [-200, 1300, 10, 0.4]];
  return (
    <>
      {S.map(([l, tp, r, o], i) => srcs[i % srcs.length] ? (
        <Img key={i} src={srcs[i % srcs.length]} style={{position: 'absolute', left: l, top: tp - t * 20, width: 720, height: 500, objectFit: 'cover', objectPosition: 'top', borderRadius: 36,
          filter: 'blur(9px)', opacity: o * a * (1 - x), transform: `rotate(${r + Math.sin(t * 0.8 + i) * 2}deg)`, maxWidth: 'none'}} />
      ) : null)}
    </>
  );
};

// ——— Значки ———
export const Lock: React.FC<{s: number; c: string}> = ({s, c}) => (
  <svg width={s} height={s} viewBox="0 0 24 24" style={{flex: 'none'}}><rect x="5" y="10.5" width="14" height="10" rx="2.6" fill={c} /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke={c} strokeWidth="2.4" /></svg>
);
export const StarIco: React.FC<{s: number}> = ({s}) => (
  <svg width={s} height={s} viewBox="0 0 24 24" style={{flex: 'none'}}><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill="#F5B301" /></svg>
);
export const Plane: React.FC<{s: number; c: string}> = ({s, c}) => (
  <svg width={s} height={s} viewBox="0 0 24 24"><path d="M22 3L9.2 13.2M22 3l-7.2 18-3.6-7.8L3 9.6z" fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /></svg>
);
export const CheckCircle: React.FC<{s: number; bg: string; fg?: string}> = ({s, bg, fg = '#FFFFFF'}) => (
  <svg width={s} height={s} viewBox="0 0 24 24" style={{flex: 'none'}}><circle cx="12" cy="12" r="11" fill={bg} /><path d="M7 12.4l3.2 3.2L17.2 8.6" fill="none" stroke={fg} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

// ——— Дрейф камеры: ровно до 1,035× внутри каждого смыслового отрезка, сброс прячется в склейке (Raylight: до 1,06×) ———
export const driftAt = (t: number, segs: [number, number][], amount = 0.035) => {
  const s = segs.find(([a, b]) => t >= a && t < b);
  return s ? 1 + (amount * (t - s[0])) / (s[1] - s[0]) : 1;
};
