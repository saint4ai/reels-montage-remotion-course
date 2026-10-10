import React, {useMemo} from 'react';
import {AbsoluteFill, Img, random, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import {useAudioData, visualizeAudio} from '@remotion/media-utils';
import {useFontsReady} from '../../kit/liquid/useAssetReady';
import {fontSpec, textWidth} from '../../kit/liquid/words';
import {Dash, Mark, Pointer, caret, typed} from '../../kit/studio';
import {Aurora, BlurText, CardSwap, ClickSpark, countUp, decryptAt, listAt, RBE, rk, ShinyText, StarBorder} from '../../kit/reactbits';
import {SpeakerStrip, STRIP} from '../../kit/strip';
import {WORDS} from './words';

// ЭСТАФЕТА 35% (CHROMA RELAY + полоса записи 35% внизу), пример: «Трюки со ссылками GitHub».
// Запись спикера полосой-створкой внизу (src/kit/strip.tsx); по микрокадрам референса «5 плагинов Claude Code для видео»:
// ночной синий со свечениями и светлые сцены в цвете бренда, стеклянные плитки-цифры из размытия, док прогресса,
// объект-эстафета (адресная строка, в которой в каждом трюке меняется одно слово), переворот карточки, наклонная сетка с
// лупой; текстовые эффекты React Bits (src/kit/reactbits.tsx); ремесло Raylight: склейки на движении, решительный наезд,
// буква 30 мс, слово 80 мс, зерно и виньетка. Цвет мира идёт за брендом (CHROMA RELAY). Карта монтажа: patterns/reels/relay-ghtricks/DIRECTION.md.
// Запись и голос ученика: положить в public/work/<slug>/ и вписать путь; null: заглушка вместо лица, тишина и условные полосы голоса.
const REC: string | null = null; // 'work/<slug>/rec.mp4' (альбомная запись, ниже указаны её размеры)
const VOICE: string | null = null; // 'work/<slug>/voice.wav'
const REC_W = 1080, REC_H = 610;
export const FPS_GH = 60;
export const END_GH = 47.3;
const W = 1440;
const SF = 'SF Pro Display', MONO = 'JBM';
const A = (p: string) => staticFile(`ghtricks/${p}`);
const rgba = (hex: string, a: number) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
const mix = (a: number, b: number, p: number) => a + (b - a) * p;
type P = {t: number};

const T = {repo: 4.1, url: 7.86, enter: 10.13, gd: 10.5, reveal: 11.0, parts: 12.71, links: 13.71, click: 14.82, flip: 15.74, video: 17.16, play: 18.44,
  t2: 20.81, url2: 21.75, ing: 23.35, claude: 28.16, t3: 33.3, url3: 34.4, docs: 36.26, chat: 38.54, share: 41.46, cta: 43.9};

// ——— Зоны цвета: цвет идёт за брендом ———
type Zk = 'hook' | 'repo' | 'url' | 'gd' | 'video' | 'ingest' | 'claude' | 'deep' | 'share' | 'cta';
const ZONES: [number, Zk][] = [[0, 'hook'], [T.repo, 'repo'], [T.url, 'url'], [T.gd, 'gd'], [T.video, 'video'], [T.t2, 'ingest'], [T.claude, 'claude'],
  [T.t3, 'deep'], [T.share, 'share'], [T.cta, 'cta']];
const zoneAt = (t: number) => [...ZONES].reverse().find(([s]) => t >= s)![1];
const LIGHT: Record<Zk, boolean> = {hook: false, repo: false, url: false, gd: true, video: false, ingest: true, claude: true, deep: false, share: false, cta: false};
const ACC: Record<Zk, string> = {hook: '#60A5FA', repo: '#60A5FA', url: '#60A5FA', gd: '#9333EA', video: '#C4B5FD', ingest: '#F0506E', claude: '#D97757', deep: '#60A5FA',
  share: '#3DEDC3', cta: '#3DEDC3'};
type Orb = [number, number, number, string, number];
const BG: Record<Zk, {base: string; orbs: Orb[]; dots?: string}> = {
  hook: {base: '#050914', orbs: [[260, 760, 1000, '#1D4ED8', 0.55], [1240, 1500, 900, '#0EA5E9', 0.3], [700, 2300, 900, '#1E3A8A', 0.45]]},
  repo: {base: '#03060E', orbs: [[720, 1000, 820, '#3B82F6', 0.32], [180, 380, 700, '#1E40AF', 0.35]], dots: 'rgba(255,255,255,.07)'},
  url: {base: '#040713', orbs: [[720, 930, 950, '#2563EB', 0.4], [1300, 300, 700, '#7C3AED', 0.2], [300, 1700, 800, '#1E40AF', 0.3]]},
  gd: {base: '#F3EDFF', orbs: [[200, 520, 900, '#C084FC', 0.45], [1300, 1500, 900, '#A78BFA', 0.4], [720, 2300, 800, '#E9D5FF', 0.6]], dots: 'rgba(124,58,237,.16)'},
  video: {base: '#120A22', orbs: [[720, 1000, 950, '#7C3AED', 0.45], [200, 300, 700, '#C084FC', 0.22]]},
  ingest: {base: '#FFF9EF', orbs: [[150, 620, 820, '#FF6B7A', 0.3], [1300, 1400, 900, '#FFC480', 0.55]]},
  claude: {base: '#F6F2EA', orbs: [[1250, 520, 900, '#D97757', 0.28], [200, 1600, 820, '#F1C6A8', 0.45]]},
  deep: {base: '#040A18', orbs: [[720, 1300, 950, '#1D4ED8', 0.35]]},
  share: {base: '#06080A', orbs: [[720, 1000, 900, '#0F766E', 0.35], [1200, 420, 600, '#3DEDC3', 0.16]]},
  cta: {base: '#04100C', orbs: [[720, 1200, 950, '#10B981', 0.25]]},
};
const orbsCss = (orbs: Orb[], t: number) => orbs.map(([x, y, r, c, a], i) =>
  `radial-gradient(circle ${r}px at ${x + Math.sin(t * 0.6 + i * 1.7) * 95}px ${y + Math.cos(t * 0.5 + i * 2.1) * 80}px, ${rgba(c, a)}, ${rgba(c, 0)})`).join(', ');
const star4 = (cx: number, cy: number, r: number) => `M${cx} ${cy - r} Q${cx} ${cy} ${cx + r} ${cy} Q${cx} ${cy} ${cx} ${cy + r} Q${cx} ${cy} ${cx - r} ${cy} Q${cx} ${cy} ${cx} ${cy - r}Z`;
const Sparkles: React.FC<P> = ({t}) => (
  <svg width={W} height={2560} style={{position: 'absolute', left: 0, top: 0}}>
    {([[210, 700, 74, '#FF4D5E', 0], [1250, 860, 56, '#3DEB9A', 1], [1250, 1400, 42, '#FF4D5E', 2], [150, 1640, 50, '#3DEB9A', 3]] as const).map(([x, y, r, c, i]) => {
      const b = Math.sin(t * 1.6 + i * 1.3) * 10, k = 1 + Math.sin(t * 2.2 + i) * 0.06;
      return <path key={i} d={star4(x, y + b, r * k)} fill={c} stroke="#111111" strokeWidth={5} strokeLinejoin="round" />;
    })}
  </svg>
);
const ZoneBg: React.FC<{k: Zk; t: number; style?: React.CSSProperties}> = ({k, t, style}) => {
  const z = BG[k];
  return (
    <AbsoluteFill style={{background: z.base, ...style}}>
      <AbsoluteFill style={{backgroundImage: orbsCss(z.orbs, t)}} />
      {z.dots ? <AbsoluteFill style={{backgroundImage: `radial-gradient(${z.dots} 2.6px, transparent 3.2px)`, backgroundSize: '44px 44px', backgroundPosition: `${(t * 6) % 44}px 0`}} /> : null}
      {k === 'deep' ? <Aurora t={t} colors={['#1E3A8A', '#3B82F6', '#22D3EE']} amp={1.1} blend={0.55} h={1300} style={{opacity: 0.9}} /> : null}
      {k === 'cta' ? <Aurora t={t} colors={['#065F46', '#3DEDC3', '#A7F3D0']} amp={1.0} blend={0.5} h={1200} style={{opacity: 0.85}} /> : null}
      {k === 'ingest' ? <Sparkles t={t} /> : null}
    </AbsoluteFill>
  );
};
// Фон: зона по времени; на Enter лавандовый мир расцветает кругом из клавиши (вспышка цвета из референса)
const Backdrop: React.FC<P> = ({t}) => {
  const k = zoneAt(t);
  const bloom = rk(t, T.enter + 0.02, T.gd + 0.06, RBE.io);
  return (
    <>
      <ZoneBg k={k} t={t} />
      {t >= T.enter && t < T.gd ? <ZoneBg k="gd" t={t} style={{clipPath: `circle(${bloom * 2900}px at 720px 1250px)`}} /> : null}
    </>
  );
};

// ——— Стекло (жидкое): полупрозрачная подложка, размытие, обод и блик сверху слева ———
const glass = (dark: boolean, a?: number): React.CSSProperties => ({
  background: `rgba(255,255,255,${a ?? (dark ? 0.08 : 0.55)})`,
  backdropFilter: 'blur(28px) saturate(1.7)', WebkitBackdropFilter: 'blur(28px) saturate(1.7)',
  boxShadow: dark
    ? 'inset 0 2px 0 rgba(255,255,255,.3), inset 0 0 0 1.5px rgba(255,255,255,.12), inset 0 -12px 28px rgba(0,0,0,.22), 0 34px 90px rgba(0,0,0,.5)'
    : 'inset 0 2px 0 rgba(255,255,255,1), inset 0 0 0 1.5px rgba(255,255,255,.75), inset 0 -12px 28px rgba(90,60,140,.08), 0 30px 70px rgba(60,40,100,.18)',
});
const Sheen: React.FC = () => <div style={{position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', background: 'linear-gradient(155deg, rgba(255,255,255,.24), rgba(255,255,255,0) 40%)'}} />;

// ——— Значки ———
const Lock: React.FC<{s: number; c: string}> = ({s, c}) => (
  <svg width={s} height={s} viewBox="0 0 24 24" style={{flex: 'none'}}><rect x="5" y="10.5" width="14" height="10" rx="2.6" fill={c} /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke={c} strokeWidth="2.4" /></svg>
);
const Folder: React.FC<{s: number; c?: string}> = ({s, c = '#54AEFF'}) => (
  <svg width={s} height={s * 0.8} viewBox="0 0 20 16" style={{flex: 'none'}}><path d="M1 3.2C1 2 2 1 3.2 1h4.3l2 2.2h7.3C18 3.2 19 4.2 19 5.4v7.4c0 1.2-1 2.2-2.2 2.2H3.2C2 15 1 14 1 12.8z" fill={c} /></svg>
);
const FileIco: React.FC<{s: number; c?: string}> = ({s, c = '#9AA4B2'}) => (
  <svg width={s * 0.8} height={s} viewBox="0 0 16 20" style={{flex: 'none'}}><path d="M2.5 1h7l4.5 4.5v12a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 1 17.5v-15A1.5 1.5 0 0 1 2.5 1z" fill="none" stroke={c} strokeWidth="1.6" /><path d="M9.5 1v4.5H14" fill="none" stroke={c} strokeWidth="1.6" /></svg>
);
const StarIco: React.FC<{s: number}> = ({s}) => (
  <svg width={s} height={s} viewBox="0 0 24 24" style={{flex: 'none'}}><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill="#F5B301" /></svg>
);
const Plane: React.FC<{s: number; c: string}> = ({s, c}) => (
  <svg width={s} height={s} viewBox="0 0 24 24"><path d="M22 3L9.2 13.2M22 3l-7.2 18-3.6-7.8L3 9.6z" fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /></svg>
);
const ICON = {
  gd: (s: number) => <Img src={staticFile('brand/gitdiagram.png')} style={{width: s, height: s}} />,
  gi: (s: number) => <Img src={staticFile('brand/gitingest.svg')} style={{width: s, height: s}} />,
  dw: (s: number, c = '#1D4ED8') => <Mark name="deepwiki" size={s} color={c} />,
};

// ——— Хук: огромное «Одно слово» и гигантская адресная строка, в которой слово перебирается с кадра 0 (DecryptedText):
// hub → diagram → ingest → hub → diagram, мир на каждой смене вспыхивает цветом сервиса, на дальнем плане плывут размытые
// страницы трёх сервисов. На «нарисуется схемой» блок уходит вверх, под ним рисуется схема; с 3,85 с камера
// проваливается в корневой узел схемы (портал), из него выходит окно GitHub. Правка 03.10: «первый кадр скучный, слишком
// долго всё статично».
const HN: [number, number][] = [[720, 770], [330, 1020], [720, 1020], [1110, 1020], [330, 1260], [720, 1260], [1110, 1260]];
const HE: [number, number][] = [[0, 1], [0, 2], [0, 3], [1, 4], [2, 5], [3, 6]];
const HSW: {at: number; to: string; c: string; tint: string}[] = [
  {at: 0.5, to: 'diagram', c: '#C4B5FD', tint: '#7C3AED'}, {at: 1.12, to: 'ingest', c: '#FF8FA3', tint: '#F0506E'},
  {at: 1.77, to: 'hub', c: '#93C5FD', tint: '#2563EB'}, {at: 2.53, to: 'diagram', c: '#C4B5FD', tint: '#7C3AED'}];
const HOOK_DOF: [string, number, number, number, number][] = [['gh-page.png', -260, 330, -14, 0.5], ['gitdiagram-schema.png', 1010, 260, 12, 0.45],
  ['gitingest-home.png', -220, 1240, 10, 0.4], ['deepwiki-docs.png', 1000, 1200, -11, 0.42]];
const Hook: React.FC<P> = ({t}) => {
  const f1 = fontSpec(800, 100, SF);
  const ready = useFontsReady([f1]);
  if (!ready || t >= T.repo) return null;
  const tr = -0.035;
  const s1 = Math.min(240, (1180 / textWidth('Одно слово', f1, 100, tr)) * 100);
  const F1 = fontSpec(800, s1, SF);
  const w1 = textWidth('Одно слово', F1, s1, tr), wOdno = textWidth('Одно ', F1, s1, tr), wSlovo = textWidth('слово', F1, s1, tr);
  const top1 = 560, x1 = 720 - w1 / 2;
  const ub = {x: 100, y: top1 + s1 * 0.95 + 64, w: 1240, h: 240};
  const fs = 120, cw = fs * 0.6, lx = 170;
  let word = 'hub', col = '#93C5FD', tint = '#2563EB', at = -9, prev = 'hub';
  for (const s of HSW) if (t >= s.at) { prev = word; word = s.to; col = s.c; tint = s.tint; at = s.at; }
  const d = at < 0 ? {text: word} : decryptAt(t, at, prev, word, 0.34, 'abcdefghijklmnopqrstuvwxyz', `hk${at}`);
  const since = t - at, punch = since >= 0 && since < 0.3 ? Math.sin((since / 0.3) * Math.PI) : 0;
  const flash = at < 0 ? 0 : 1 - rk(t, at, at + 0.7);
  const cyBlock = (top1 + ub.y + ub.h) / 2;
  const m = rk(t, 2.95, 3.5, RBE.io);
  const settle = 1.06 - 0.06 * rk(t, 0, 0.9, RBE.out) + 0.02 * Math.min(1, t / 2.9);
  const pill = rk(t, 2.12, 2.45, RBE.lock);
  const glow = rk(t, 3.65, 3.8) * (1 - rk(t, 3.85, 4.1));
  const zt = rk(t, 3.85, 4.1, RBE.inExpo);
  const segW = Math.max(1, d.text.length) * cw;
  return (
    <AbsoluteFill style={{transformOrigin: '720px 770px', transform: `scale(${1 + 5 * zt})`, opacity: 1 - rk(t, 4.0, 4.1), filter: zt > 0.02 ? `blur(${zt * 14}px)` : undefined}}>
      <AbsoluteFill style={{background: `radial-gradient(circle 900px at 720px ${ub.y + ub.h / 2}px, ${rgba(tint, 0.55 * flash)}, ${rgba(tint, 0)})`}} />
      {HOOK_DOF.map(([src, l, tp, r, o], i) => (
        <Img key={i} src={A(src)} style={{position: 'absolute', left: l, top: tp - t * 26, width: 680, height: 470, objectFit: 'cover', objectPosition: 'top', borderRadius: 34,
          filter: 'blur(10px)', opacity: o, transform: `rotate(${r + Math.sin(t * 0.9 + i) * 2}deg)`, maxWidth: 'none'}} />
      ))}
      <div style={{position: 'absolute', inset: 0, transformOrigin: `720px ${cyBlock}px`, transform: `translateY(${-m * (cyBlock - 500)}px) scale(${settle * (1 - 0.5 * m)})`}}>
        {pill > 0 ? (
          <div style={{position: 'absolute', left: x1 + wOdno - 30, top: top1 - 12, width: wSlovo + 60, height: s1 * 0.95 + 24, borderRadius: 44, ...glass(true, 0.1),
            opacity: Math.min(1, pill * 1.4), transform: `scale(${0.94 + 0.06 * pill})`}}>
            <Sheen />
            <StarBorder t={t} w={wSlovo + 60} h={s1 * 0.95 + 24} r={44} color="#60A5FA" thickness={5} />
          </div>
        ) : null}
        <div style={{position: 'absolute', left: x1, top: top1, fontFamily: SF, fontWeight: 800, fontSize: s1, lineHeight: 0.95, letterSpacing: `${tr}em`, color: '#FFFFFF', whiteSpace: 'nowrap'}}>Одно слово</div>
        <div style={{position: 'absolute', left: ub.x, top: ub.y, width: ub.w, height: ub.h, borderRadius: 70, ...glass(true, 0.1), transform: `scale(${1 + 0.035 * punch})`}}>
          <Sheen />
          <div style={{position: 'absolute', left: 64, top: 84}}><Lock s={72} c="rgba(255,255,255,.6)" /></div>
          <div style={{position: 'absolute', left: lx + 3 * cw - 16, top: 46, width: segW + 32, height: fs * 1.24, borderRadius: 28, background: rgba(col, 0.22)}}>
            <StarBorder t={t} w={segW + 32} h={fs * 1.24} r={28} color={col} thickness={5} />
          </div>
          <div style={{position: 'absolute', left: lx, top: 52, fontFamily: MONO, fontWeight: 600, fontSize: fs, lineHeight: 1.1, color: '#F4F6FA', whiteSpace: 'pre'}}>
            git<span style={{color: col}}>{d.text}</span>.com
          </div>
        </div>
      </div>
      {HE.map(([a, b], j) => {
        const [xa, ya] = HN[a], [xb, yb] = HN[b];
        const d = `M${xa} ${ya + 56} C${xa} ${ya + 130} ${xb} ${yb - 130} ${xb} ${yb - 56}`;
        return <Dash key={j} d={d} p={rk(t, 3.12 + j * 0.07, 3.6 + j * 0.07, RBE.io)} color="#93C5FD" width={5} dash={14} flow={t * 60} />;
      })}
      {HN.map(([x, y], i) => {
        const p = listAt(t, 3.0, i, 0.08, 0.45);
        if (p <= 0) return null;
        const w = i === 0 ? 360 : 300, h = 112;
        return (
          <div key={i} style={{position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, borderRadius: 30, ...glass(true, 0.1),
            opacity: Math.min(1, p * 1.5), transform: `scale(${0.6 + 0.4 * p})`, display: 'flex', alignItems: 'center', gap: 22, padding: '0 30px', boxSizing: 'border-box'}}>
            <Sheen />
            <Folder s={52} c={i === 0 ? '#93C5FD' : '#54AEFF'} />
            <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
              <div style={{width: i === 0 ? 190 : 150, height: 14, borderRadius: 7, background: 'rgba(255,255,255,.55)'}} />
              <div style={{width: i === 0 ? 120 : 90, height: 14, borderRadius: 7, background: 'rgba(255,255,255,.25)'}} />
            </div>
            {glow > 0 ? <div style={{position: 'absolute', inset: -2, borderRadius: 32, boxShadow: `0 0 ${50 * glow}px rgba(96,165,250,${0.9 * glow}), inset 0 0 0 3px rgba(147,197,253,${glow})`}} /> : null}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ——— Рой папок: настоящие имена со страницы claude-code; ближние читаются, дальние в размытии (глубина резкости) ———
const NAMES: [string, boolean][] = [['.claude-plugin', true], ['.claude/commands', true], ['.devcontainer', true], ['.github', true], ['.vscode', true], ['Script', true],
  ['examples', true], ['mods', true], ['plugins', true], ['scripts', true], ['.gitattributes', false], ['.gitignore', false], ['CHANGELOG.md', false], ['CLAUDE.md', false],
  ['LICENSE.md', false], ['README.md', false], ['SECURITY.md', false], ['examples/gateway', true], ['gateway/aws', true], ['mods/types', true], ['mods/README.md', false], ['feed.xml', false]];
const NEAR: [number, number][] = [[300, 660], [740, 630], [1150, 690], [430, 830], [1000, 810], [260, 1000], [720, 975], [1190, 1015], [470, 1165], [990, 1160], [300, 1335], [1120, 1330]];
type Chip = {name: string; dir: boolean; x: number; y: number; d: 0 | 1 | 2; r: number; o: [number, number]};
const CHIPS: Chip[] = (() => {
  const out: Chip[] = [];
  for (let i = 0; i < 36; i++) {
    const d = (i < 12 ? 0 : i < 24 ? 1 : 2) as 0 | 1 | 2;
    const [x, y] = d === 0 ? NEAR[i] : [140 + random(`cx${i}`) * 1160, 600 + random(`cy${i}`) * 860];
    const [name, dir] = NAMES[(i * 7) % NAMES.length];
    out.push({name, dir, x, y, d, r: (random(`cr${i}`) - 0.5) * 10, o: [300 + random(`ox${i}`) * 160, 980 + (i % 12) * 38]});
  }
  return out.sort((a, b) => b.d - a.d);
})();
const LAYER = [{k: 1, blur: 0, a: 1}, {k: 0.78, blur: 2.5, a: 0.75}, {k: 0.6, blur: 7, a: 0.45}];
const ChipView: React.FC<{c: Chip; dark: boolean; lit?: number}> = ({c, dark, lit = 0}) => (
  <div style={{display: 'flex', alignItems: 'center', gap: 16, padding: '0 30px', height: 76, borderRadius: 38, ...glass(dark, dark ? 0.1 + lit * 0.12 : 0.7),
    fontFamily: MONO, fontWeight: 500, fontSize: 36, color: dark ? '#E6EDF3' : '#1F2328', whiteSpace: 'nowrap',
    outline: lit > 0 ? `3px solid rgba(147,197,253,${lit})` : undefined}}>
    {c.dir ? <Folder s={40} /> : <FileIco s={36} />}{c.name}
  </div>
);
const HOVER = [{at: 6.62, i: 3}, {at: 6.95, i: 4}, {at: 7.28, i: 8}, {at: 7.6, i: 6}];
const chipIdx = (n: number) => CHIPS.findIndex((c) => c.d === 0 && c.x === NEAR[n][0] && c.y === NEAR[n][1]);
const Swarm: React.FC<P> = ({t}) => {
  if (t < 5.4 || t > T.url + 0.6) return null;
  const push = rk(t, T.url, T.url + 0.55, RBE.inExpo);
  return (
    <AbsoluteFill>
      {CHIPS.map((c, i) => {
        const L = LAYER[c.d];
        const p = listAt(t, 5.52, i % 36, 0.028, 0.62);
        if (p <= 0) return null;
        let x = mix(c.o[0], c.x, p), y = mix(c.o[1], c.y, p) - Math.sin(p * Math.PI) * 120;
        x += (x - 745) * push * 1.6; y += (y - 642) * push * 1.6;
        const near = HOVER.find((h) => chipIdx(h.i) === CHIPS.indexOf(c) && t >= h.at - 0.08 && t < h.at + 0.3);
        const lit = near ? rk(t, near.at - 0.08, near.at + 0.05) * (1 - rk(t, near.at + 0.2, near.at + 0.3)) : 0;
        return (
          <div key={i} style={{position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) rotate(${c.r * (1 - push)}deg) scale(${L.k * (0.6 + 0.4 * p) * (1 + push * 1.2) * (1 + lit * 0.06)})`,
            opacity: Math.min(1, p * 2) * L.a * (1 - push), filter: L.blur ? `blur(${L.blur}px)` : undefined}}>
            <ChipView c={c} dark lit={lit} />
          </div>
        );
      })}
      <Pointer t={t} show={[6.4, T.url - 0.05]} ring="#60A5FA" pts={[{at: 6.4, x: 1040, y: 1400}, ...HOVER.map((h) => ({at: h.at, x: NEAR[h.i][0] + 40, y: NEAR[h.i][1] + 16}))]} />
    </AbsoluteFill>
  );
};

// ——— Окно GitHub: настоящая страница claude-code, 3D-подъём, потом наезд камеры в адресную строку ———
const GhWindow: React.FC<P> = ({t}) => {
  const a = rk(t, T.repo, T.repo + 0.8, RBE.out);
  const push = rk(t, T.url, T.url + 0.62, RBE.inExpo);
  const fade = 1 - rk(t, T.url + 0.22, T.url + 0.55);
  if (t < T.repo || fade <= 0) return null;
  const x = 120, y = 600, w = 1200, bar = 84, bodyH = 736;
  const dim = rk(t, 5.6, 6.2) * 0.42;
  const hl = rk(t, 4.66, 4.95, RBE.lock) * (1 - rk(t, 5.5, 5.8));
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: W, height: 2560, perspective: 2400, perspectiveOrigin: '720px 1000px'}}>
      <div style={{position: 'absolute', left: x, top: y, width: w, height: bar + bodyH, borderRadius: 28, overflow: 'hidden', background: '#0D1117',
        transformOrigin: `${745 - x}px ${642 - y}px`, transform: `translateY(${(1 - a) * 150}px) rotateX(${mix(28, 6, a) * (1 - push)}deg) rotateY(${-4 * (1 - push)}deg) scale(${(0.94 + 0.06 * a) * (1 + push * 1.7)})`,
        opacity: Math.min(1, a * 3) * fade, boxShadow: '0 40px 120px rgba(0,0,0,.6), 0 0 0 1.5px rgba(255,255,255,.08)', filter: push > 0.02 ? `blur(${push * 12}px)` : undefined}}>
        <div style={{position: 'absolute', left: 0, top: 0, width: w, height: bar, background: '#161B22', borderBottom: '1.5px solid rgba(255,255,255,.08)'}}>
          {['#FF5F57', '#FEBC2E', '#28C840'].map((c, i) => <div key={c} style={{position: 'absolute', left: 34 + i * 34, top: 32, width: 20, height: 20, borderRadius: 10, background: c}} />)}
          <div style={{position: 'absolute', left: 190, top: 18, width: 870, height: 48, borderRadius: 24, background: 'rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', gap: 14,
            padding: '0 22px', boxSizing: 'border-box'}}>
            <Lock s={26} c="rgba(240,246,252,.6)" />
            <span style={{fontFamily: MONO, fontSize: 28, color: 'rgba(240,246,252,.88)'}}>github.com/anthropics/claude-code</span>
          </div>
        </div>
        <Img src={A('gh-page.png')} style={{position: 'absolute', left: 0, top: bar, width: w, height: (w * 1000) / 1440, maxWidth: 'none'}} />
        {hl > 0 ? <div style={{position: 'absolute', left: 36, top: bar + 70, width: 212, height: 38, borderRadius: 10, border: '4px solid #2F81F7',
          boxShadow: '0 0 30px rgba(47,129,247,.7)', opacity: hl, transform: `scale(${0.9 + 0.1 * hl})`}} /> : null}
        {dim > 0 ? <div style={{position: 'absolute', inset: 0, background: `rgba(3,6,14,${dim})`}} /> : null}
      </div>
    </div>
  );
};

// ——— Адресная строка-эстафета: домен крупно, путь ниже; выделение с бегущей рамкой и перебор букв (React Bits) ———
type Swap = {pre: string; from: string; to: string; post: string; sel: number; swap: number; brand: string};
const UrlCard: React.FC<{t: number; dark: boolean; s: Swap; cx: number; cy: number; k?: number; o?: number}> = ({t, dark, s, cx, cy, k = 1, o = 1}) => {
  if (o <= 0) return null;
  const w = 1120, h = 290, fs = 96, cw = fs * 0.6, lx = 150;
  const d = decryptAt(t, s.swap, s.from, s.to, 0.5, 'abcdefghijklmnopqrstuvwxyz', `u${s.swap}`);
  const segX = lx + s.pre.length * cw, segW = Math.max(1, d.text.length) * cw;
  const sel = rk(t, s.sel, s.sel + 0.25, RBE.out) * (1 - rk(t, s.swap + 0.75, s.swap + 1.05));
  const ink = dark ? '#F4F6FA' : '#16131F';
  return (
    <div style={{position: 'absolute', left: cx - w / 2, top: cy - h / 2, width: w, height: h, borderRadius: 60, ...glass(dark, dark ? 0.09 : 0.62), opacity: o, transform: `scale(${k})`}}>
      <Sheen />
      <div style={{position: 'absolute', left: 58, top: 62}}><Lock s={60} c={dark ? 'rgba(255,255,255,.62)' : 'rgba(22,19,31,.5)'} /></div>
      {sel > 0 ? (
        <div style={{position: 'absolute', left: segX - 14, top: 38, width: segW + 28, height: fs * 1.2, borderRadius: 24, background: rgba(s.brand, dark ? 0.26 : 0.16), opacity: sel}}>
          <StarBorder t={t} w={segW + 28} h={fs * 1.2} r={24} color={s.brand} thickness={4} />
        </div>
      ) : null}
      <div style={{position: 'absolute', left: lx, top: 44, fontFamily: MONO, fontWeight: 600, fontSize: fs, lineHeight: 1.1, color: ink, whiteSpace: 'pre'}}>
        {s.pre}<span style={{color: t >= s.swap ? s.brand : ink}}>{d.text}</span>{s.post}
      </div>
      <div style={{position: 'absolute', left: lx, top: 182, fontFamily: MONO, fontWeight: 500, fontSize: 46, color: dark ? 'rgba(244,246,250,.55)' : 'rgba(22,19,31,.5)', whiteSpace: 'pre'}}>/anthropics/claude-code</div>
    </div>
  );
};
// Клавиша Enter: стеклянная, нажатие с искрами
const EnterKey: React.FC<P> = ({t}) => {
  const a = rk(t, 9.66, 10.05, RBE.out), out = rk(t, T.enter + 0.2, T.enter + 0.4, RBE.inExpo);
  if (a <= 0 || out >= 1) return null;
  const since = t - T.enter, press = since >= 0 && since < 0.2 ? Math.sin((since / 0.2) * Math.PI) : 0;
  return (
    <div style={{position: 'absolute', left: 720 - 170, top: 1250 - 85, width: 340, height: 170, borderRadius: 42, ...glass(true, 0.14 + press * 0.1),
      opacity: Math.min(1, a * 1.6) * (1 - out), transform: `translateY(${(1 - a) * 60 + press * 10}px) scale(${(0.94 + 0.06 * a) * (1 - press * 0.05)})`,
      display: 'grid', placeItems: 'center', fontFamily: SF, fontWeight: 600, fontSize: 60, color: '#FFFFFF'}}>
      <Sheen />
      <span>Enter ↵</span>
    </div>
  );
};

// ——— Строка героя: логотип сервиса буквами из размытия (BlurText) + звёзды счётчиком (CountUp) ———
const Lockup: React.FC<{t: number; at: number; out?: number; icon: React.ReactNode; a: string; b: string; bColor: string; ink: string; stars?: number; dark: boolean; y?: number}> =
  ({t, at, out = 99, icon, a, b, bColor, ink, stars, dark, y = 400}) => {
    const o = 1 - rk(t, out, out + 0.3, RBE.io);
    if (t < at - 0.01 || o <= 0) return null;
    const ic = rk(t, at, at + 0.5, RBE.lock);
    const n = stars ? countUp(t, at + 0.35, 0.9, stars) : 0;
    return (
      <div style={{position: 'absolute', left: 0, top: y, width: W, height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28, opacity: o}}>
        <div style={{transform: `scale(${0.6 + 0.4 * ic})`, opacity: Math.min(1, ic * 2)}}>{icon}</div>
        <div style={{fontFamily: SF, fontWeight: 700, fontSize: 92, letterSpacing: '-0.02em', whiteSpace: 'nowrap', lineHeight: 1}}>
          <BlurText t={t} at={at + 0.05} text={a} style={{color: ink}} />
          <BlurText t={t} at={at + 0.05 + a.length * 0.03} text={b} style={{color: bColor}} />
        </div>
        {stars ? (
          <div style={{position: 'relative', ...glass(dark, dark ? 0.1 : 0.6), borderRadius: 999, padding: '16px 32px', display: 'flex', alignItems: 'center', gap: 14,
            fontFamily: SF, fontWeight: 700, fontSize: 50, color: ink, opacity: rk(t, at + 0.3, at + 0.6), fontVariantNumeric: 'tabular-nums'}}>
            <StarIco s={46} />{(n / 10).toFixed(1).replace('.', ',')} тыс.
          </div>
        ) : null}
      </div>
    );
  };

// ——— Стеклянная плитка с цифрой из размытия (референс) ———
const NumTile: React.FC<{t: number; at: number; out: number; n: string; dark: boolean}> = ({t, at, out, n, dark}) => {
  const a = rk(t, at, at + 0.6, RBE.out), x = rk(t, out, out + 0.35, RBE.inExpo);
  if (a <= 0 || x >= 1) return null;
  const s = 400;
  return (
    <div style={{position: 'absolute', left: 720 - s / 2, top: 1000 - s / 2, width: s, height: s, borderRadius: 100, ...glass(dark, dark ? 0.1 : 0.5),
      opacity: Math.min(1, a * 1.5) * (1 - x), transform: `translateY(${-x * 520}px) scale(${(0.94 + 0.06 * a) * (1 - 0.5 * x)})`}}>
      <Sheen />
      <div style={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: SF, fontWeight: 800, fontSize: 300, lineHeight: 1,
        backgroundImage: dark ? 'linear-gradient(180deg,#FFFFFF,rgba(255,255,255,.5))' : 'linear-gradient(180deg,#1A1A1F,#5A5560)', WebkitBackgroundClip: 'text', backgroundClip: 'text',
        color: 'transparent', filter: a < 0.99 ? `blur(${(1 - a) * 34}px)` : undefined}}>{n}</div>
    </div>
  );
};
// Размытые наклонные карточки за плиткой (глубина резкости из референса)
const DofCards: React.FC<{t: number; at: number; out: number; src: string}> = ({t, at, out, src}) => {
  const a = rk(t, at, at + 0.7), x = rk(t, out, out + 0.4);
  if (a <= 0 || x >= 1) return null;
  return (
    <>
      {([[-330, 760, -16, 0.55], [1060, 820, 14, 0.5], [880, 1330, 9, 0.35]] as const).map(([l, tp, r, o], i) => (
        <Img key={i} src={src} style={{position: 'absolute', left: l, top: tp, width: 720, height: 500, objectFit: 'cover', borderRadius: 36, filter: 'blur(9px)',
          opacity: o * a * (1 - x), transform: `rotate(${r}deg) translateY(${Math.sin(t * 0.8 + i) * 14}px)`, maxWidth: 'none'}} />
      ))}
    </>
  );
};

// ——— GitDiagram: настоящая схема claude-code проявляется, группы и связи подсвечиваются, клик → переворот → файл ———
const SC = {sx: 140, sy: 190, sw: 1160, sh: 680, x: 100, y: 640, k: 1240 / 1160};
const sp = (sx: number, sy: number): [number, number] => [SC.x + (sx - SC.sx) * SC.k, SC.y + (sy - SC.sy) * SC.k];
const GROUPS: [number, number, number, number][] = [[150, 420, 512, 727], [547, 466, 902, 678], [932, 394, 1290, 727]];
const LINKS: [number, number, number, number][] = [[636, 306, 636, 500], [814, 306, 814, 500], [1200, 306, 1200, 520], [636, 553, 636, 607], [656, 660, 656, 813],
  [814, 553, 814, 813], [1110, 708, 1110, 813], [242, 508, 242, 563], [242, 602, 242, 656]];
const NODE: [number, number] = sp(636, 634);
const Schema: React.FC<P> = ({t}) => {
  if (t < T.gd || t > T.flip + 0.4) return null;
  const rev = rk(t, T.reveal, T.reveal + 0.9, RBE.io);
  const drift = 1 + 0.04 * rk(t, T.reveal, T.click, (x) => x);
  const push = rk(t, T.click, T.click + 0.7, RBE.io);
  const cam = drift * (1 + 0.75 * push);
  const flip = rk(t, T.flip, T.flip + 0.36, RBE.inExpo);
  const ent = rk(t, T.gd, T.gd + 0.55, RBE.out);
  const hgt = SC.sh * SC.k;
  const click = rk(t, 15.37, 15.5) * (1 - rk(t, T.flip, T.flip + 0.2));
  return (
    <div style={{position: 'absolute', inset: 0, perspective: 2200, perspectiveOrigin: '720px 1000px'}}>
      <div style={{position: 'absolute', inset: 0, transformOrigin: '720px 1000px', transform: `rotateY(${flip * 90}deg)`, opacity: 1 - rk(t, T.flip + 0.3, T.flip + 0.36)}}>
        <div style={{position: 'absolute', inset: 0, transformOrigin: `${NODE[0]}px ${NODE[1]}px`, transform: `scale(${cam})`}}>
          <div style={{position: 'absolute', left: SC.x, top: SC.y, width: SC.sw * SC.k, height: hgt, borderRadius: 40, overflow: 'hidden', background: '#F1E6FE',
            boxShadow: '0 40px 100px rgba(76,29,149,.22), inset 0 0 0 2px rgba(255,255,255,.8)', opacity: ent, transform: `translateY(${(1 - ent) * 60}px) scale(${0.94 + 0.06 * ent})`}}>
            <div style={{position: 'absolute', inset: 0, clipPath: `inset(0 0 ${(1 - rev) * 100}% 0)`}}>
              <Img src={A('gitdiagram-schema.png')} style={{position: 'absolute', left: -SC.sx * SC.k, top: -SC.sy * SC.k, width: 1440 * SC.k, height: 1000 * SC.k, maxWidth: 'none'}} />
            </div>
            {rev > 0 && rev < 1 ? <div style={{position: 'absolute', left: 0, top: rev * hgt - 3, width: SC.sw * SC.k, height: 6, background: '#A855F7', boxShadow: '0 0 34px 8px rgba(168,85,247,.6)'}} /> : null}
          </div>
          {GROUPS.map(([a, b, c, d], i) => {
            const p = rk(t, T.parts + i * 0.24, T.parts + i * 0.24 + 0.35, RBE.lock) * (1 - rk(t, T.click + 0.2, T.click + 0.5));
            if (p <= 0) return null;
            const [x1, y1] = sp(a, b), [x2, y2] = sp(c, d);
            return <div key={i} style={{position: 'absolute', left: x1 - 8, top: y1 - 8, width: x2 - x1 + 16, height: y2 - y1 + 16, borderRadius: 22, border: '5px solid #A855F7',
              background: 'rgba(168,85,247,.07)', boxShadow: '0 0 40px rgba(168,85,247,.45)', opacity: p, transform: `scale(${1.04 - 0.04 * p})`}} />;
          })}
          <svg width={W} height={2560} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
            {LINKS.map(([a, b, c, d], i) => {
              const [x1, y1] = sp(a, b), [x2, y2] = sp(c, d);
              const p = rk(t, T.links + i * 0.05, T.links + i * 0.05 + 0.35, RBE.io) * (1 - rk(t, T.click + 0.2, T.click + 0.5));
              if (p <= 0) return null;
              const q = ((t - T.links - i * 0.05) / 0.7) % 1;
              return (
                <g key={i} opacity={p}>
                  <line x1={x1} y1={y1} x2={mix(x1, x2, p)} y2={mix(y1, y2, p)} stroke="#A855F7" strokeWidth={5} strokeLinecap="round" />
                  <circle cx={mix(x1, x2, q)} cy={mix(y1, y2, q)} r={11} fill="#FFFFFF" stroke="#A855F7" strokeWidth={5} />
                </g>
              );
            })}
          </svg>
          {click > 0 ? <div style={{position: 'absolute', left: sp(566, 608)[0] - 8, top: sp(566, 608)[1] - 8, width: 140 * SC.k + 16, height: 52 * SC.k + 16, borderRadius: 12,
            border: '5px solid #9333EA', boxShadow: '0 0 40px rgba(147,51,234,.7)', opacity: click}} /> : null}
        </div>
      </div>
      <Pointer t={t} show={[T.click, T.flip]} ring="#A855F7" pts={[{at: T.click, x: 1060, y: 1360}, {at: 15.3, x: NODE[0] + 20, y: NODE[1] + 6}]} clicks={[15.37]} />
      <ClickSpark t={t} at={15.37} x={NODE[0]} y={NODE[1]} color="#9333EA" n={10} radius={90} />
    </div>
  );
};
// Файл после клика: вид файла GitHub, код скелетом (без выдуманного кода), нужная строка подсвечена
const FileCard: React.FC<P> = ({t}) => {
  const fin = rk(t, T.flip + 0.36, T.flip + 0.82, RBE.outExpo);
  const out = rk(t, T.video - 0.2, T.video + 0.04, RBE.inExpo);
  if (fin <= 0 || out >= 1) return null;
  const rows = 11;
  return (
    <div style={{position: 'absolute', inset: 0, perspective: 2200, perspectiveOrigin: '720px 1000px'}}>
      <div style={{position: 'absolute', left: 170, top: 620, width: 1100, height: 780, borderRadius: 36, background: '#FFFFFF', overflow: 'hidden',
        boxShadow: '0 40px 100px rgba(76,29,149,.25), inset 0 0 0 2px #E4DAF7', transformOrigin: '550px 360px',
        transform: `rotateY(${-90 + 90 * fin}deg) translateY(${-out * 1500}px)`}}>
        <div style={{height: 120, background: '#F6F8FA', borderBottom: '2px solid #D1D9E0', display: 'flex', alignItems: 'center', gap: 22, padding: '0 44px'}}>
          <FileIco s={50} c="#59636E" />
          <span style={{fontFamily: SF, fontWeight: 700, fontSize: 56, color: '#1F2328'}}>llm.py</span>
          <span style={{marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, fontFamily: SF, fontWeight: 500, fontSize: 40, color: '#59636E'}}>
            <span style={{width: 22, height: 22, borderRadius: 11, background: '#3572A5'}} />Python
          </span>
        </div>
        {Array.from({length: rows}, (_, i) => {
          const hot = i === 4;
          const segs = [0, 1, 2].map((j) => 60 + random(`fw${i}-${j}`) * 190);
          const cols = ['#CF222E', '#8250DF', '#0A3069', '#6E7781'];
          return (
            <div key={i} style={{position: 'absolute', left: 0, top: 150 + i * 56, width: 1100, height: 56, background: hot ? '#FFF8C5' : undefined, display: 'flex', alignItems: 'center', gap: 18,
              opacity: rk(t, T.flip + 0.5 + i * 0.04, T.flip + 0.8 + i * 0.04)}}>
              <span style={{width: 90, textAlign: 'right', fontFamily: MONO, fontSize: 32, color: '#8C959F'}}>{i + 1}</span>
              <span style={{width: (i % 4) * 36}} />
              {segs.map((wd, j) => <span key={j} style={{width: wd * (j === 2 && i % 3 === 0 ? 0 : 1), height: 20, borderRadius: 10, background: cols[(i + j) % 4], opacity: 0.75}} />)}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ——— Видео GitDiagram: плеер, нажатие ▶, полосы голоса пляшут от настоящего голоса ———
const VoiceBarsReal: React.FC<{t: number; frame: number; fps: number; x: number; y: number; w: number}> = ({t, frame, fps, x, y, w}) => {
  const audio = useAudioData(staticFile(VOICE as string));
  if (!audio) return null;
  const v = visualizeAudio({fps, frame, audioData: audio, numberOfSamples: 32});
  return <BarsView t={t} x={x} y={y} w={w} val={(i) => v[(i % 14) + 1]} />;
};
// без голоса полосы качаются условно, по синусам (детерминированно от времени)
const VoiceBarsFake: React.FC<{t: number; frame: number; fps: number; x: number; y: number; w: number}> = ({t, x, y, w}) =>
  <BarsView t={t} x={x} y={y} w={w} val={(i) => 0.05 + 0.05 * (1 + Math.sin(t * 9 + i * 1.7)) * (1 + Math.sin(t * 3.1 + i * 0.6)) / 2} />;
const VoiceBars = VOICE ? VoiceBarsReal : VoiceBarsFake;
const BarsView: React.FC<{t: number; x: number; y: number; w: number; val: (i: number) => number}> = ({t, x, y, w, val}) => {
  const n = 28, a = rk(t, 19.0, 19.35);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: 170, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', opacity: a}}>
      {Array.from({length: n}, (_, i) => {
        const hgt = 16 + Math.min(1, Math.sqrt(val(i)) * 2.2) * 150;
        return <div key={i} style={{width: w / n - 12, height: hgt, borderRadius: 10, background: 'linear-gradient(180deg,#FFFFFF,#C4B5FD)', boxShadow: '0 0 18px rgba(196,181,253,.6)'}} />;
      })}
    </div>
  );
};
const Player: React.FC<{t: number; frame: number; fps: number}> = ({t, frame, fps}) => {
  const a = rk(t, T.video + 0.04, T.video + 0.6, RBE.outExpo), out = t >= T.t2 ? 1 : 0;
  if (a <= 0 || out) return null;
  const played = rk(t, T.play + 0.05, T.play + 0.3);
  const k = 1200 / 745;
  const prog = t > T.play ? 0.06 + (t - T.play) * 0.05 : 0.0;
  const secs = countUp(t, 17.93, 0.6, 57);
  return (
    <>
      <div style={{position: 'absolute', left: 0, top: 400, width: W, display: 'flex', justifyContent: 'center', opacity: rk(t, 17.93, 18.2)}}>
        <div style={{...glass(true, 0.1), borderRadius: 999, padding: '18px 40px', display: 'flex', alignItems: 'center', gap: 18, fontFamily: SF, fontWeight: 700, fontSize: 64,
          color: '#FFFFFF', fontVariantNumeric: 'tabular-nums', position: 'relative'}}>
          <svg width={54} height={54} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="none" stroke="#C4B5FD" strokeWidth="2.4" /><path d="M12 7v5.2l3.4 2" fill="none" stroke="#C4B5FD" strokeWidth="2.4" strokeLinecap="round" /></svg>
          0:{String(secs).padStart(2, '0')}
        </div>
      </div>
      <div style={{position: 'absolute', left: 120, top: 640, width: 1200, height: 675, borderRadius: 40, overflow: 'hidden', background: '#1A1030',
        boxShadow: '0 50px 130px rgba(0,0,0,.6), 0 0 0 2px rgba(196,181,253,.35)', opacity: Math.min(1, a * 2), transform: `translateY(${(1 - a) * 900}px) scale(${0.94 + 0.06 * a})`}}>
        <Img src={A('gitdiagram-video-frame.jpg')} style={{position: 'absolute', left: 0, top: 0, width: 1200, height: 675, maxWidth: 'none', opacity: 1 - played}} />
        {played > 0 ? <Img src={A('gitdiagram-video.jpg')} style={{position: 'absolute', left: -20 * k, top: -152 * k, width: 800 * k, height: 600 * k, maxWidth: 'none', opacity: played}} /> : null}
        {played > 0 ? <div style={{position: 'absolute', left: 0, bottom: 0, width: 1200, height: 260, background: 'linear-gradient(180deg, rgba(18,10,34,0), rgba(18,10,34,.85))', opacity: rk(t, 19.0, 19.35)}} /> : null}
        <div style={{position: 'absolute', left: 50, bottom: 34, width: 1100, height: 10, borderRadius: 5, background: 'rgba(255,255,255,.25)'}}>
          <div style={{width: `${Math.min(1, prog) * 100}%`, height: '100%', borderRadius: 5, background: '#C4B5FD', boxShadow: '0 0 16px rgba(196,181,253,.8)'}} />
        </div>
      </div>
      {t > 18.9 ? <VoiceBars t={t} frame={frame} fps={fps} x={170} y={640 + 675 - 230} w={1100} /> : null}
      <Pointer t={t} show={[17.8, 18.95]} ring="#C4B5FD" pts={[{at: 17.8, x: 1040, y: 1320}, {at: 18.36, x: 724, y: 948}]} clicks={[T.play]} />
      <ClickSpark t={t} at={T.play} x={720} y={942} color="#C4B5FD" n={10} radius={100} />
    </>
  );
};

// ——— Gitingest: рой папок возвращается и слетается в один текстовый лист; дерево печатается; счётчики ———
const TREE = ['Directory structure:', '└── anthropics-claude-code/', '    ├── README.md', '    ├── CLAUDE.md', '    ├── LICENSE.md', '    ├── SECURITY.md', '    ├── examples/',
  '    │   ├── gateway/', '    │   │   └── aws/'];
const DOC = {x: 330, y: 800, w: 780, h: 600};
const Ingest: React.FC<P> = ({t}) => {
  if (t < T.ing - 0.2 || t > T.claude + 0.6) return null;
  const card = rk(t, 24.0, 24.45, RBE.lock);
  const fly = rk(t, T.claude, T.claude + 0.45, RBE.io);
  const dx = mix(DOC.x, 154, fly), dy = mix(DOC.y, 1060, fly), dk = 1 - 0.62 * fly;
  const filesN = countUp(t, 24.9, 1.1, 1510), tokN = countUp(t, 25.1, 1.1, 558);
  const stick = rk(t, 24.9, 25.25, RBE.lock) * (1 - rk(t, T.claude, T.claude + 0.2));
  return (
    <>
      {CHIPS.map((c, i) => {
        const p = listAt(t, 23.59, i, 0.035, 0.7);
        if (p <= 0 || p >= 1) return null;
        const sx = c.x + (c.x - 745) * 1.6, sy = c.y + (c.y - 642) * 1.6;
        const x = mix(sx, 720, p), y = mix(sy, DOC.y + 260, p);
        const L = LAYER[c.d];
        return (
          <div key={i} style={{position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) scale(${L.k * (1 - 0.8 * p)})`, opacity: L.a * (1 - p * p),
            filter: L.blur ? `blur(${L.blur}px)` : undefined}}>
            <ChipView c={c} dark={false} />
          </div>
        );
      })}
      {card > 0 ? (
        <div style={{position: 'absolute', left: dx, top: dy, width: DOC.w, height: DOC.h, transformOrigin: '0 0', transform: `scale(${(0.94 + 0.06 * card) * dk})`, opacity: Math.min(1, card * 1.6),
          background: '#FFF4DA', border: '5px solid #111111', borderRadius: 18, boxShadow: '12px 12px 0 #111111', overflow: 'hidden'}}>
          <div style={{position: 'absolute', left: 40, top: 34, fontFamily: MONO, fontSize: 32, lineHeight: '44px', color: '#111111', whiteSpace: 'pre'}}>
            {TREE.map((ln, i) => <div key={i} style={{opacity: rk(t, 25.83 + i * 0.08, 25.9 + i * 0.08)}}>{ln}</div>)}
          </div>
          <div style={{position: 'absolute', left: 40, top: 34 + 44 * 9 + 22, right: 40, opacity: rk(t, 26.86, 27.0)}}>
            <div style={{fontFamily: MONO, fontWeight: 700, fontSize: 32, color: '#111111'}}>FILE: README.md</div>
            {[620, 540, 660].map((wd, i) => <div key={i} style={{marginTop: 18, width: wd * rk(t, 26.95 + i * 0.12, 27.3 + i * 0.12), height: 18, borderRadius: 9, background: 'rgba(17,17,17,.28)'}} />)}
          </div>
        </div>
      ) : null}
      {stick > 0 ? (
        <>
          <div style={{position: 'absolute', left: 850, top: 760, transform: `rotate(4deg) scale(${0.7 + 0.3 * stick})`, opacity: stick, background: '#FFC480', border: '5px solid #111111',
            borderRadius: 16, boxShadow: '8px 8px 0 #111111', padding: '12px 28px', fontFamily: SF, fontWeight: 800, fontSize: 48, color: '#111111', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap'}}>
            {filesN.toLocaleString('ru-RU')} файлов
          </div>
          <div style={{position: 'absolute', left: 820, top: 1110, transform: `rotate(-4deg) scale(${0.7 + 0.3 * stick})`, opacity: stick, background: '#FFFFFF', border: '5px solid #111111',
            borderRadius: 16, boxShadow: '8px 8px 0 #111111', padding: '12px 28px', fontFamily: SF, fontWeight: 800, fontSize: 46, color: '#111111', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap'}}>
            {tokN} тыс. токенов
          </div>
        </>
      ) : null}
    </>
  );
};

// ——— Claude Desktop по слепку интерфейса: белое поле, рамка #C6C6C5, пиксельный краб на кромке ———
const CRAB = ['....XXXX', '.XXXXXXX', 'XXXXXXXX', 'XBXXXBXX', 'X.X..X.X'];
const Crab: React.FC<{x: number; y: number; px: number}> = ({x, y, px}) => (
  <svg width={8 * px + 40} height={5 * px} style={{position: 'absolute', left: x - 40, top: y, overflow: 'visible'}}>
    <line x1={4} y1={4.6 * px} x2={40} y2={3.4 * px} stroke="#9D9D9D" strokeWidth={4} strokeLinecap="round" />
    {CRAB.flatMap((row, r) => [...row].map((ch, c) => ch === '.' ? null : (
      <rect key={`${r}-${c}`} x={40 + c * px} y={r * px} width={px + 0.5} height={px + 0.5} fill={ch === 'B' ? '#1F1F1E' : '#D97757'} />
    )))}
  </svg>
);
const MSG = 'Объясни, как устроен проект';
const ClaudeScene: React.FC<P> = ({t}) => {
  if (t < T.claude || t >= T.t3) return null;
  const a = rk(t, T.claude, T.claude + 0.45, RBE.out);
  const att = rk(t, 28.55, 28.75, RBE.lock);
  const send = 30.25, sent = t >= send;
  const msg = t < send ? typed(t, 29.34, MSG, 34) : '';
  const bub = rk(t, send, send + 0.35, RBE.out), ans = rk(t, 30.45, 30.8);
  const one = rk(t, 30.32, 30.7, RBE.lock), thirty = rk(t, 31.53, 31.9, RBE.lock), strike = rk(t, 32.34, 32.67, RBE.io);
  const x = 120, y = 1030, w = 1200, h = 300;
  return (
    <>
      <div style={{position: 'absolute', left: 0, top: 400, width: W, display: 'flex', justifyContent: 'center', gap: 36}}>
        {one > 0 ? (
          <div style={{position: 'relative', ...glass(false, 0.7), borderRadius: 999, padding: '20px 40px', display: 'flex', alignItems: 'center', gap: 20, fontFamily: SF, fontWeight: 700,
            fontSize: 66, color: '#1F1F1E', opacity: one, transform: `scale(${0.9 + 0.1 * one})`}}>
            <svg width={60} height={60} viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#D97757" /><path d="M7 12.4l3.2 3.2L17.2 8.6" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            1 сообщение
          </div>
        ) : null}
        {thirty > 0 ? (
          <div style={{position: 'relative', ...glass(false, 0.5), borderRadius: 999, padding: '20px 40px', fontFamily: SF, fontWeight: 700, fontSize: 66, color: '#1F1F1E',
            opacity: thirty * (1 - 0.5 * strike), transform: `scale(${0.9 + 0.1 * thirty})`}}>
            30 минут
            <div style={{position: 'absolute', left: 30, top: '50%', width: `calc((100% - 60px) * ${strike})`, height: 9, borderRadius: 5, background: '#D97757', transform: 'rotate(-4deg)'}} />
          </div>
        ) : null}
      </div>
      {sent ? (
        <>
          <div style={{position: 'absolute', right: 120, top: 640, opacity: bub, transform: `translateY(${(1 - bub) * 40}px)`, background: '#F0F0EF', borderRadius: 30, padding: '24px 36px',
            fontFamily: SF, fontWeight: 500, fontSize: 46, color: '#1F1F1E', whiteSpace: 'nowrap'}}>{MSG}</div>
          <div style={{position: 'absolute', left: 120, top: 740, width: 1200, opacity: ans}}>
            <Mark name="claude" size={64} color="#D97757" />
            {[980, 760].map((wd, i) => <div key={i} style={{marginTop: i === 0 ? 22 : 18, width: wd * rk(t, 30.55 + i * 0.3, 31.0 + i * 0.3), height: 22, borderRadius: 11, background: 'rgba(31,31,30,.2)'}} />)}
          </div>
        </>
      ) : null}
      <div style={{position: 'absolute', left: x, top: y - 86, display: 'flex', gap: 14, opacity: a}}>
        {['Local', 'Мой проект', 'main', 'worktree'].map((s) => (
          <div key={s} style={{border: '2.5px solid #E2E2E1', borderRadius: 16, padding: '10px 22px', fontFamily: SF, fontWeight: 500, fontSize: 38, color: '#1F1F1E', background: '#FCFCFB'}}>{s}</div>
        ))}
      </div>
      <div style={{position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: 36, background: '#FFFFFF', border: '3px solid #C6C6C5', boxSizing: 'border-box',
        boxShadow: '0 24px 60px rgba(60,40,20,.10)', opacity: a, transform: `translateY(${(1 - a) * 50}px)`}}>
        {att > 0 && !sent ? (
          <div style={{position: 'absolute', left: 34, top: 30, height: 96, borderRadius: 20, background: '#F0F0EF', display: 'flex', alignItems: 'center', gap: 18, padding: '0 30px',
            transform: `scale(${0.8 + 0.2 * att})`, transformOrigin: '0 50%', opacity: att}}>
            <FileIco s={48} c="#73726C" />
            <span style={{fontFamily: SF, fontWeight: 600, fontSize: 40, color: '#1F1F1E'}}>claude-code.txt</span>
            <span style={{fontFamily: SF, fontWeight: 500, fontSize: 38, color: '#73726C'}}>558k</span>
          </div>
        ) : null}
        <div style={{position: 'absolute', left: 40, top: 170, fontFamily: SF, fontWeight: msg ? 500 : 400, fontSize: 46, color: msg ? '#1F1F1E' : '#9D9D9D', whiteSpace: 'pre'}}>
          {msg || 'Describe a task or ask a question'}
          {msg && t < send ? <span style={{opacity: caret(t), color: '#1F1F1E'}}>|</span> : null}
        </div>
        <div style={{position: 'absolute', right: 44, top: 168, fontFamily: SF, fontSize: 56, color: t >= send - 0.05 && t < send + 0.4 ? '#D97757' : '#9D9D9D'}}>↵</div>
        <Crab x={w - 150} y={-46} px={10} />
      </div>
      <div style={{position: 'absolute', left: x + 20, top: y + h + 22, width: w - 40, display: 'flex', alignItems: 'center', gap: 30, fontFamily: SF, fontWeight: 500, fontSize: 40, color: '#73726C', opacity: a}}>
        <span>+</span><span>Bypass permissions</span><span style={{marginLeft: 'auto'}}>Opus 5.5</span><span>Extra</span>
      </div>
      <ClickSpark t={t} at={send} x={x + w - 70} y={y + 205} color="#D97757" n={9} radius={80} />
    </>
  );
};

// ——— DeepWiki: документация наклонной стопкой, оглавление подсвечивается, поле чата выезжает из страницы ———
const PG = {x: 200, y: 690, w: 1040, k: 1040 / 1440};
const Q = 'Как всё работает?';
const DeepWiki: React.FC<P> = ({t}) => {
  if (t < T.docs - 0.05 || t > T.share + 0.15) return null;
  const a = rk(t, T.docs, T.docs + 0.7, RBE.out);
  const whip = rk(t, T.share - 0.1, T.share + 0.1, RBE.inExpo);
  const lift = rk(t, T.chat, T.chat + 0.6, RBE.io);
  const dim = lift * 0.55;
  const ph = 1000 * PG.k;
  const row = Math.floor((t - 37.42) / 0.05);
  const q = typed(t, 39.7, Q, 34);
  const sendAt = 40.5, ans = rk(t, 40.75, 41.1, RBE.out);
  const ci = {x: mix(PG.x + 336 * PG.k, 170, lift), y: mix(PG.y + 868 * PG.k, 1150, lift), w: mix(768 * PG.k, 1100, lift), h: mix(117 * PG.k, 150, lift)};
  return (
    <div style={{position: 'absolute', inset: 0, transform: `translateX(${-whip * 1500}px)`, filter: whip > 0.02 ? `blur(${whip * 18}px)` : undefined}}>
      <div style={{position: 'absolute', inset: 0, perspective: 2400, perspectiveOrigin: '720px 1100px'}}>
        {[2, 1, 0].map((i) => (
          <div key={i} style={{position: 'absolute', left: PG.x + i * 60, top: PG.y - i * 54, width: PG.w, height: ph, borderRadius: 30, overflow: 'hidden', background: '#F7F7F5',
            transform: `translateY(${(1 - a) * (500 + i * 120)}px) rotateY(${-14 - i * 4}deg) rotateX(6deg)`, opacity: Math.min(1, a * 2) * (i === 0 ? 1 : i === 1 ? 0.6 : 0.32),
            filter: i ? `blur(${i * 3.5}px) brightness(${1 - dim})` : dim > 0 ? `brightness(${1 - dim})` : undefined, boxShadow: '0 40px 110px rgba(0,0,0,.55)'}}>
            <Img src={A('deepwiki-docs.png')} style={{position: 'absolute', left: 0, top: 0, width: PG.w, height: ph, maxWidth: 'none'}} />
            {i === 0 && row >= 0 && row < 22 && t < T.chat + 0.3 ? (
              <div style={{position: 'absolute', left: 40 * PG.k, top: (145 + row * 36) * PG.k, width: 280 * PG.k, height: 32 * PG.k, borderRadius: 8, background: 'rgba(59,130,246,.28)',
                boxShadow: '0 0 0 2px rgba(59,130,246,.6)'}} />
            ) : null}
          </div>
        ))}
      </div>
      {lift > 0 ? (
        <div style={{position: 'absolute', left: ci.x, top: ci.y, width: ci.w, height: ci.h, borderRadius: 34 * lift + 8, background: 'rgba(255,255,255,.96)',
          boxShadow: `0 0 0 3px rgba(96,165,250,${0.4 + 0.5 * lift}), 0 0 60px rgba(59,130,246,${0.45 * lift}), 0 40px 90px rgba(0,0,0,.45)`, display: 'flex', alignItems: 'center',
          padding: `0 ${40 * lift}px`, boxSizing: 'border-box', gap: 24, overflow: 'hidden'}}>
          <span style={{fontFamily: SF, fontWeight: q ? 500 : 400, fontSize: 46 * lift + 14, color: q ? '#111827' : '#6B7280', whiteSpace: 'nowrap'}}>
            {q || 'Ask Devin about anthropics/claude-code'}{q && t < sendAt ? <span style={{opacity: caret(t)}}>|</span> : null}
          </span>
          <div style={{marginLeft: 'auto', width: 84, height: 84, borderRadius: 42, flex: 'none', background: t >= sendAt - 0.05 ? '#2563EB' : '#E5E7EB', display: 'grid', placeItems: 'center', opacity: lift}}>
            <svg width={44} height={44} viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke={t >= sendAt - 0.05 ? '#FFFFFF' : '#6B7280'} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        </div>
      ) : null}
      {ans > 0 ? (
        <div style={{position: 'absolute', left: 170, top: 880, width: 1100, height: 230, borderRadius: 40, ...glass(true, 0.12), opacity: ans, transform: `translateY(${(1 - ans) * 40}px)`}}>
          <Sheen />
          <div style={{position: 'absolute', left: 44, top: 40, display: 'flex', alignItems: 'center', gap: 22}}>
            {ICON.dw(58, '#93C5FD')}
            <span style={{fontFamily: SF, fontWeight: 700, fontSize: 52, color: '#FFFFFF'}}>Claude Code Overview</span>
          </div>
          {[900, 760].map((wd, i) => <div key={i} style={{position: 'absolute', left: 44, top: 136 + i * 40, width: wd * rk(t, 40.9 + i * 0.2, 41.3 + i * 0.2), height: 20, borderRadius: 10, background: 'rgba(255,255,255,.32)'}} />)}
        </div>
      ) : null}
      <ClickSpark t={t} at={sendAt} x={1270 - 82} y={1225} color="#60A5FA" n={10} radius={90} />
    </div>
  );
};

// ——— «Скинь тому, кто копается в чужом коде»: наклонная сетка карточек кода с лупой + самолётик ———
const CodeCard: React.FC<{i: number}> = ({i}) => (
  <div style={{width: 300, height: 190, borderRadius: 22, background: '#0F1419', boxShadow: 'inset 0 0 0 2px rgba(61,237,195,.18)', padding: '24px 22px', boxSizing: 'border-box'}}>
    {[0, 1, 2, 3, 4].map((r) => (
      <div key={r} style={{display: 'flex', gap: 10, marginBottom: 14, marginLeft: (r % 3) * 18}}>
        {[0, 1].map((j) => <div key={j} style={{width: 40 + random(`cc${i}-${r}-${j}`) * 90, height: 12, borderRadius: 6,
          background: ['#3DEDC3', '#7DD3FC', '#F9A8D4', '#E5E7EB'][(i + r + j) % 4], opacity: 0.7}} />)}
      </div>
    ))}
  </div>
);
const Grid4: React.FC<{t: number}> = ({t}) => (
  <div style={{position: 'absolute', left: 720 - 690, top: 1050 - 640, width: 1380, height: 1280, display: 'grid', gridTemplateColumns: 'repeat(4, 300px)', gap: 36,
    transform: `translateY(${-((t - T.share) * 40)}px)`}}>
    {Array.from({length: 20}, (_, i) => <CodeCard key={i} i={i} />)}
  </div>
);
const Share: React.FC<P> = ({t}) => {
  if (t < T.share - 0.05 || t >= T.cta) return null;
  const a = rk(t, T.share - 0.05, T.share + 0.25, RBE.outExpo);
  const plane = rk(t, 41.6, 42.75, RBE.io);
  const bez = (p: number): [number, number] => {
    const [x0, y0, x1, y1, x2, y2] = [160, 1460, 380, 560, 1240, 700];
    return [(1 - p) ** 2 * x0 + 2 * (1 - p) * p * x1 + p * p * x2, (1 - p) ** 2 * y0 + 2 * (1 - p) * p * y1 + p * p * y2];
  };
  const [px, py] = bez(plane), [qx, qy] = bez(Math.min(1, plane + 0.02));
  const ang = (Math.atan2(qy - py, qx - px) * 180) / Math.PI + 45;
  const lt = rk(t, 41.9, 43.6, (x) => x);
  const lx = mix(500, 930, lt), ly = mix(1180, 900, lt) + Math.sin(lt * Math.PI * 2) * 40, R = 190;
  const plane3d = 'perspective(2000px) rotateX(46deg) rotateZ(-28deg)';
  return (
    <div style={{position: 'absolute', inset: 0, transform: `translateX(${(1 - a) * 1500}px)`, filter: a < 0.98 ? `blur(${(1 - a) * 18}px)` : undefined}}>
      <div style={{position: 'absolute', inset: 0, transformOrigin: '720px 1050px', transform: plane3d}}><Grid4 t={t} /></div>
      <div style={{position: 'absolute', inset: 0, clipPath: `circle(${R}px at ${lx}px ${ly}px)`}}>
        <div style={{position: 'absolute', inset: 0, background: '#06080A'}} />
        <div style={{position: 'absolute', inset: 0, transformOrigin: `${lx}px ${ly}px`, transform: 'scale(1.45)'}}>
          <div style={{position: 'absolute', inset: 0, transformOrigin: '720px 1050px', transform: plane3d}}><Grid4 t={t} /></div>
        </div>
      </div>
      <div style={{position: 'absolute', left: lx - R, top: ly - R, width: R * 2, height: R * 2, borderRadius: '50%', border: '8px solid rgba(255,255,255,.9)',
        boxShadow: 'inset 0 0 40px rgba(61,237,195,.35), 0 20px 60px rgba(0,0,0,.6), 0 0 0 2px rgba(61,237,195,.5)', boxSizing: 'border-box'}}>
        <div style={{position: 'absolute', left: R * 1.62, top: R * 1.62, width: 150, height: 44, borderRadius: 22, background: 'linear-gradient(180deg,#E5E7EB,#9CA3AF)',
          transform: 'rotate(45deg)', transformOrigin: '0 50%', boxShadow: '0 10px 24px rgba(0,0,0,.5)'}} />
      </div>
      <Dash d="M160 1460 Q380 560 1240 700" p={plane} color="rgba(61,237,195,.8)" width={5} dash={16} />
      {plane > 0 && plane < 1 ? <div style={{position: 'absolute', left: px - 75, top: py - 75, transform: `rotate(${ang}deg)`, filter: 'drop-shadow(0 0 20px rgba(61,237,195,.7))'}}><Plane s={150} c="#FFFFFF" /></div> : null}
      {plane >= 1 ? <div style={{position: 'absolute', left: 1240 - 75, top: 700 - 75, transform: `rotate(45deg) scale(${1 - rk(t, 42.75, 43.0)})`}}><Plane s={150} c="#FFFFFF" /></div> : null}
    </div>
  );
};

// ——— Призыв: поле комментария, «GitHub» с бликом, стопка из пяти размытых трюков (CardSwap) ———
const BonusCard: React.FC<{n: number}> = ({n}) => (
  <div style={{position: 'absolute', inset: 0, borderRadius: 44, background: 'linear-gradient(160deg, rgba(18,40,34,.96), rgba(8,18,15,.96))',
    boxShadow: 'inset 0 2px 0 rgba(255,255,255,.18), inset 0 0 0 2px rgba(61,237,195,.35), 0 30px 80px rgba(0,0,0,.55)'}}>
    <div style={{position: 'absolute', left: 50, top: 50, width: 110, height: 110, borderRadius: 30, background: '#3DEDC3', display: 'grid', placeItems: 'center',
      fontFamily: SF, fontWeight: 800, fontSize: 70, color: '#05231D'}}>{n}</div>
    <div style={{position: 'absolute', left: 200, top: 62, filter: 'blur(14px)'}}>
      <div style={{width: 460, height: 40, borderRadius: 20, background: 'rgba(255,255,255,.8)'}} />
      <div style={{marginTop: 26, width: 340, height: 30, borderRadius: 15, background: 'rgba(255,255,255,.45)'}} />
    </div>
    <div style={{position: 'absolute', left: 50, top: 230, filter: 'blur(12px)'}}>
      {[680, 560].map((w, i) => <div key={i} style={{marginTop: i ? 22 : 0, width: w, height: 26, borderRadius: 13, background: 'rgba(255,255,255,.3)'}} />)}
    </div>
    <div style={{position: 'absolute', right: 50, top: 60}}><Lock s={84} c="rgba(61,237,195,.9)" /></div>
  </div>
);
const Cta: React.FC<P> = ({t}) => {
  if (t < T.cta) return null;
  const a = rk(t, T.cta, T.cta + 0.5, RBE.out);
  const word = typed(t, 44.28, 'GitHub', 22);
  const send = 44.9, popped = rk(t, send, send + 0.25, RBE.lock);
  const five = rk(t, 45.95, 46.3, RBE.lock);
  return (
    <>
      {five > 0 ? (
        <div style={{position: 'absolute', left: 0, top: 380, width: W, textAlign: 'center', fontFamily: SF, fontWeight: 800, fontSize: 170, lineHeight: 1, color: '#FFFFFF',
          textShadow: '0 0 60px rgba(61,237,195,.65)', opacity: five, transform: `scale(${0.8 + 0.2 * five})`}}>+5</div>
      ) : null}
      <div style={{position: 'absolute', left: 140, top: 640, width: 1160, height: 150, borderRadius: 75, ...glass(true, 0.1), opacity: a, transform: `translateY(${(1 - a) * 60}px)`,
        display: 'flex', alignItems: 'center', gap: 28, padding: '0 34px', boxSizing: 'border-box'}}>
        <Sheen />
        <div style={{width: 92, height: 92, borderRadius: 46, flex: 'none', background: 'linear-gradient(135deg,#3DEDC3,#0EA5E9)'}} />
        <div style={{fontFamily: SF, fontWeight: word ? 700 : 400, fontSize: word ? 70 : 50, color: word ? '#FFFFFF' : 'rgba(255,255,255,.5)', whiteSpace: 'nowrap',
          transform: `scale(${1 + 0.08 * Math.sin(popped * Math.PI)})`, transformOrigin: '0 50%'}}>
          {word ? <ShinyText t={t} at={44.6} speed={1.8} base="#FFFFFF" shine="#3DEDC3">{word}</ShinyText> : 'Добавьте комментарий…'}
          {word && t < send ? <span style={{opacity: caret(t)}}>|</span> : null}
        </div>
        <div style={{marginLeft: 'auto', width: 96, height: 96, borderRadius: 48, flex: 'none', background: t >= send - 0.05 ? '#3DEDC3' : 'rgba(255,255,255,.14)', display: 'grid', placeItems: 'center'}}>
          <svg width={48} height={48} viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke={t >= send - 0.05 ? '#05231D' : '#FFFFFF'} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      </div>
      <ClickSpark t={t} at={send} x={1300 - 34 - 48} y={715} color="#3DEDC3" n={10} radius={90} />
      <CardSwap t={t} at={45.47} cards={[1, 2, 3, 4, 5].map((n) => <BonusCard key={n} n={n} />)} swaps={[45.76, 46.0, 46.21, 46.53]} w={880} h={420} x={690} y={1200} />
    </>
  );
};

// ——— Субтитры: 53 px (40 на сетке 1080), светлые на тёмном и тёмные на светлом, произносимое слово подчёркнуто ———
type CapWord = {text: string; s: number; e: number; x: number; w: number; line: number};
type CapPage = {words: CapWord[]; s: number; e: number; widths: number[]};
const CAP = {size: 53, lh: 72, cy: 1530, maxW: 880, padX: 34, padY: 16};
const buildPages = (): CapPage[] => {
  const font = fontSpec(600, CAP.size, SF);
  const space = textWidth(' ', font, CAP.size);
  const pages: CapPage[] = [];
  let cur: {words: CapWord[]; lines: number[]} = {words: [], lines: [0]};
  const flush = () => { if (cur.words.length) pages.push({words: cur.words, s: 0, e: 0, widths: cur.lines}); cur = {words: [], lines: [0]}; };
  WORDS.forEach(([text, s, e]) => {
    const w = textWidth(text, font, CAP.size);
    let li = cur.lines.length - 1;
    if (cur.lines[li] > 0 && cur.lines[li] + space + w > CAP.maxW) {
      if (cur.lines.length >= 2) { flush(); li = 0; } else { cur.lines.push(0); li = 1; }
    }
    const x = cur.lines[li] > 0 ? cur.lines[li] + space : 0;
    cur.words.push({text, s, e, x, w, line: li});
    cur.lines[li] = x + w;
    if (/[.?!]$/.test(text)) flush();
  });
  flush();
  pages.forEach((p, i) => {
    p.s = p.words[0].s - 0.06;
    p.e = i + 1 < pages.length ? pages[i + 1].words[0].s - 0.06 : p.words[p.words.length - 1].e + 0.8;
  });
  return pages;
};
const Captions: React.FC<{t: number; light: boolean; accent: string}> = ({t, light, accent}) => {
  const ready = useFontsReady([fontSpec(600, CAP.size, SF)]);
  const pages = useMemo(() => (ready ? buildPages() : []), [ready]);
  if (!ready || t < 3.0) return null;
  const pg = pages.find((p) => t >= p.s && t < p.e);
  if (!pg) return null;
  const bw = Math.max(...pg.widths) + CAP.padX * 2, bh = pg.widths.length * CAP.lh + CAP.padY * 2;
  const a = rk(t, pg.s, pg.s + 0.16);
  const ink = light ? '#15171A' : '#F2F3F5';
  return (
    <div style={{position: 'absolute', left: 720 - bw / 2, top: CAP.cy - bh / 2, width: bw, height: bh, borderRadius: 30, opacity: a, transform: `translateY(${(1 - a) * 10}px)`,
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

// ——— Зерно и виньетка (Raylight: зерно 0,02–0,07) ———
const Finish: React.FC<{frame: number; light: boolean}> = ({frame, light}) => (
  <>
    <AbsoluteFill style={{background: `radial-gradient(ellipse 120% 90% at 50% 42%, rgba(0,0,0,0) 58%, rgba(${light ? '40,20,60,.16' : '0,0,0,.5'}) 100%)`, pointerEvents: 'none'}} />
    <AbsoluteFill style={{backgroundImage: `url(${staticFile('kit/grain.png')})`, backgroundSize: '512px 512px', backgroundPosition: `${Math.floor(random(`gx${frame}`) * 512)}px ${Math.floor(random(`gy${frame}`) * 512)}px`,
      opacity: light ? 0.05 : 0.07, mixBlendMode: 'overlay', pointerEvents: 'none'}} />
  </>
);

const SFX_GAIN = 0.37;
const SFX: [number, string, number][] = [
  [1.77, 'aamir-ui-pop', 0.18], [2.12, 'aamir-glass', 0.2], [2.98, 'woosh-air', 0.2], [3.1, 'ui-seq', 0.14], [3.65, 'shimmer', 0.14],
  [4.1, 'whoosh-sharp', 0.22], [4.68, 'aamir-select', 0.16], [5.52, 'ui-seq', 0.18], [5.55, 'whoosh', 0.14], [6.62, 'tick-soft', 0.18], [6.95, 'tick-soft', 0.18], [7.28, 'tick-soft', 0.18],
  [7.6, 'tick-soft', 0.18], [7.86, 'zoom', 0.22], [8.6, 'aamir-select', 0.18], [9.34, 'typing', 0.16], [9.7, 'aamir-ui-pop', 0.16], [10.13, 'aamir-crispy-click', 0.3], [10.15, 'flash', 0.14],
  [10.5, 'aamir-chime', 0.18], [10.9, 'counter', 0.14], [11.0, 'shimmer', 0.14], [12.71, 'aamir-ui-pop', 0.16], [12.95, 'aamir-ui-pop', 0.16], [13.19, 'aamir-ui-pop', 0.16],
  [13.71, 'shimmer', 0.12], [14.82, 'zoom', 0.18], [15.37, 'aamir-crispy-click', 0.28], [15.74, 'whoosh-sharp', 0.2], [16.4, 'aamir-confirm', 0.2],
  [17.16, 'woosh-air', 0.22], [17.93, 'counter', 0.16], [18.44, 'aamir-crispy-click', 0.28],
  [20.81, 'aamir-glass', 0.22], [20.83, 'sub-hit', 0.16], [21.75, 'woosh-air', 0.2], [22.12, 'aamir-select', 0.18], [22.79, 'typing', 0.16], [23.35, 'aamir-chime', 0.18],
  [23.6, 'whoosh', 0.16], [24.05, 'aamir-ui-pop', 0.16], [24.9, 'counter', 0.16], [25.83, 'typing', 0.14], [26.86, 'tick-soft', 0.16],
  [28.16, 'woosh-air', 0.22], [28.58, 'aamir-ui-pop', 0.18], [29.34, 'typing', 0.14], [30.25, 'aamir-crispy-click', 0.26], [30.5, 'aamir-notification', 0.18], [30.4, 'aamir-confirm', 0.18],
  [32.36, 'snap', 0.2], [33.3, 'aamir-glass', 0.22], [33.32, 'sub-hit', 0.16], [34.4, 'woosh-air', 0.2], [35.04, 'aamir-select', 0.18], [35.63, 'typing', 0.16],
  [36.26, 'whoosh', 0.18], [37.42, 'ui-seq', 0.14], [38.54, 'aamir-ui-pop', 0.18], [39.7, 'typing', 0.14], [40.5, 'aamir-crispy-click', 0.26], [40.78, 'aamir-notification', 0.18],
  [41.36, 'whoosh-sharp', 0.22], [41.6, 'woosh-air', 0.18], [43.9, 'woosh-air', 0.2], [44.28, 'typing', 0.14], [44.9, 'aamir-crispy-click', 0.26], [45.47, 'aamir-ui-pop', 0.18],
  [45.76, 'ui-slide', 0.16], [46.0, 'ui-slide', 0.16], [46.21, 'ui-slide', 0.16], [46.53, 'ui-slide', 0.16], [45.95, 'aamir-confirm', 0.18],
];

// Камера в покое не стоит: ровный дрейф до 1,035× внутри каждого смыслового отрезка, сброс прячется в склейке (Raylight: дрейф до 1,06×).
const DRIFT: [number, number][] = [[T.repo, T.gd], [T.gd, T.video], [T.video, T.t2], [T.t2, T.claude], [T.claude, T.t3], [T.t3, T.share], [T.share, T.cta], [T.cta, END_GH]];
const driftAt = (t: number) => { const s = DRIFT.find(([a, b]) => t >= a && t < b); return s ? 1 + (0.035 * (t - s[0])) / (s[1] - s[0]) : 1; };
export const ReelGhTricks: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const k = zoneAt(t), light = LIGHT[k];
  const urlDark: Swap = {pre: 'git', from: 'hub', to: 'diagram', post: '.com', sel: 8.6, swap: 9.34, brand: '#C4B5FD'};
  const urlIng: Swap = {pre: 'git', from: 'hub', to: 'ingest', post: '.com', sel: 22.12, swap: 22.79, brand: '#F0506E'};
  const urlDeep: Swap = {pre: '', from: 'github', to: 'deepwiki', post: '.com', sel: 35.04, swap: 35.63, brand: '#93C5FD'};
  const u1 = rk(t, 7.98, 8.55, RBE.outExpo), u1out = rk(t, T.enter + 0.12, T.enter + 0.36, RBE.inExpo);
  const u2 = rk(t, T.url2, T.url2 + 0.5, RBE.outExpo), u2up = rk(t, T.ing, T.ing + 0.5, RBE.io);
  const u3 = rk(t, T.url3, T.url3 + 0.5, RBE.outExpo), u3up = rk(t, T.docs, T.docs + 0.5, RBE.io);
  return (
    <AbsoluteFill style={{background: '#050914'}}>
      <Backdrop t={t} />
      <Hook t={t} />
      <div style={{position: 'absolute', inset: 0, transformOrigin: '720px 1000px', transform: `scale(${driftAt(t)})`}}>
      <GhWindow t={t} />
      <Swarm t={t} />
      {t >= 7.98 && u1out < 1 ? <UrlCard t={t} dark s={urlDark} cx={720} cy={930} k={(0.55 + 0.45 * u1) * (1 - 0.3 * u1out)} o={Math.min(1, u1 * 1.8) * (1 - u1out)} /> : null}
      <EnterKey t={t} />
      <ClickSpark t={t} at={T.enter} x={720} y={1250} color="#C4B5FD" n={12} radius={110} />
      <Lockup t={t} at={T.gd} out={T.video - 0.3} dark={false} icon={ICON.gd(112)} a="Git" b="Diagram" ink="#16131F" bColor="#9333EA" stars={178} />
      <Schema t={t} />
      <FileCard t={t} />
      {t >= T.video && t < T.t2 ? <Player t={t} frame={frame} fps={fps} /> : null}
      {t >= T.t2 && t < T.claude ? <DofCards t={t} at={T.t2} out={T.url2} src={A('gitingest-home.png')} /> : null}
      <NumTile t={t} at={T.t2} out={T.url2 - 0.3} n="2" dark={false} />
      {t >= T.url2 && t < T.ing + 0.4 ? <UrlCard t={t} dark={false} s={urlIng} cx={720} cy={mix(930, 760, u2up)} k={(0.9 + 0.1 * u2) * (1 - 0.15 * u2up)}
        o={Math.min(1, u2 * 1.8) * (1 - rk(t, T.ing + 0.1, T.ing + 0.4))} /> : null}
      <Lockup t={t} at={T.ing} out={T.claude - 0.1} dark={false} icon={ICON.gi(104)} a="Git" b="ingest" ink="#16131F" bColor="#F0506E" stars={158} y={380} />
      <Ingest t={t} />
      <ClaudeScene t={t} />
      {t >= T.t3 && t < T.docs ? <DofCards t={t} at={T.t3} out={T.url3} src={A('deepwiki-docs.png')} /> : null}
      <NumTile t={t} at={T.t3} out={T.url3 - 0.3} n="3" dark />
      <DeepWiki t={t} />
      {t >= T.url3 && t < T.share ? <UrlCard t={t} dark s={urlDeep} cx={720} cy={mix(930, 520, u3up)} k={(0.9 + 0.1 * u3) * (1 - 0.3 * u3up)}
        o={Math.min(1, u3 * 1.8) * (1 - rk(t, T.share - 0.15, T.share))} /> : null}
      <Share t={t} />
      <Cta t={t} />
      </div>
      <Finish frame={frame} light={light} />
      <Captions t={t} light={light} accent={ACC[k]} />
      <SpeakerStrip src={REC} srcW={REC_W} srcH={REC_H} h={STRIP.h35} inset={STRIP.insetIg} r={STRIP.rIg} shade={light ? 0.22 : 0.5} />
      {VOICE ? <Audio src={staticFile(VOICE)} /> : null}
      {SFX.map(([at, name, vol], i) => (
        <Sequence key={i} from={Math.max(0, Math.round(at * fps))} durationInFrames={Math.round(2 * fps)} layout="none">
          <Audio src={staticFile(`sfx/${name}.wav`)} volume={vol * SFX_GAIN} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
