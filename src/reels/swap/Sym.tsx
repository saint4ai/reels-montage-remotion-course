import React from 'react';
import {AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio, Video} from '@remotion/media';
import RAW from './data/sw-words.json';
import {ISLA} from '../../kit/isla';
import {SpeakerStrip, STRIP} from '../../kit/strip';
import {
  BACK, blockAt, bump, Card, ClaudeIcon, cl, EIO, EXPO, Ico, isLight, k, lerp, Line, LogoTile, Plate, PlateAt, S, SymBackdrop, SymCanvas, SymScene,
  type Block, type Move, type Spot,
} from '../../kit/symbiosis';

// «Бесплатные замены Adobe, Figma и Notion» в стиле 16 СИМБИОЗ (patterns/styles/symbiosis/PATTERN.md).
// Хук сценой на чёрном листе: три подписки карточками ЛИСТ, на «бесплатная замена» на каждую ложится плашка «$0».
// Три замены — плиты КАНВАСА на одном столе: Stirling PDF → Penpot → AppFlowy, камера едет между ними со смазом.
// Claude — мятная вспышка, «скинь» — белый лист, призыв «ЗАМЕНА» — оранжевая вспышка. Карта: patterns/reels/symbiosis-swap/DIRECTION.md.
// Запись и голос ученика: положить в public/work/<slug>/ и вписать путь; null: заглушка вместо лица и тишина (звуки ролика остаются).
// Скриншоты Stirling PDF, Penpot и AppFlowy взяты со страниц этих открытых проектов; ролик-демо Penpot (PENPOT_DEMO) в курс не входит.
const REC: string | null = null; // 'work/<slug>/rec.mp4' (альбомная запись 1920×1080)
const VOICE: string | null = null; // 'work/<slug>/voice.wav'
const PENPOT_DEMO: string | null = null; // 'work/<slug>/penpot-demo.mp4': запись экрана Penpot, без неё в окне стоит скриншот
export const W = (RAW as {text: string; start: number}[]).map((w) => w.start);
const A = (p: string) => staticFile(`swap/${p}`);
const {INK, GREY, OR, MINT, MINT_INK, LIGHT, SF, CV} = S;
const VOL = 0.8;
export const SYM_END = 46.9;
export const SYM_FRAMES = Math.round(SYM_END * 60);

// ——— блоки и стыки ———
const B1 = W[16] - 0.2, B2 = W[92] - 0.25, B3 = W[101] - 0.12, B4 = W[108] - 0.16;
const BLOCKS: Block[] = [{at: 0, bg: 'night'}, {at: B1, bg: 'table', fx: 'whip'}, {at: B2, bg: 'mint', fx: 'bloom', x: 1000, y: 1150}, {at: B3, bg: 'paper', fx: 'whip'}, {at: B4, bg: 'ember', fx: 'bloom', x: 720, y: 1000}];
const CHECK = 'M5 12.5l4.5 4.5L19 7.5';

// ——— хук: «Ты платишь за Adobe, Figma или Notion, а у каждого есть бесплатная замена с открытым кодом» ———
const SUBS: {logo: string; name: string; price: string; at: number}[] = [
  {logo: 'acrobat.svg', name: 'Acrobat Pro', price: '$19,99', at: W[3]}, {logo: 'figma.svg', name: 'Figma', price: '$16', at: W[4]}, {logo: 'notion.svg', name: 'Notion Plus', price: '$10', at: W[6]},
];
const Hook: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const strike = k(t, W[9] - 0.05, W[9] + 0.35, EIO), gh = k(t, W[14] - 0.1, W[14] + 0.25, BACK);
  return (
    <SymScene t={t} a={0} b={B1}>
      <Line t={t} y={360} size={92} dark words={[{txt: 'Ты', at: -0.34}, {txt: 'платишь', at: -0.3}, {txt: 'за', at: W[2]}]} />
      {SUBS.map((s, i) => { const p = k(t, s.at - 0.1, s.at + 0.25, BACK), zero = k(t, W[11] + i * 0.14, W[11] + 0.3 + i * 0.14, BACK);
        return <Card key={s.name} x={190 + i * 370} y={510 + (1 - p) * 60} w={320} h={400} style={{opacity: Math.min(1, p * 2), transform: `rotate(${(i - 1) * 2.5 * p}deg)`}}>
          <div style={{position: 'absolute', left: 0, right: 0, top: 40, display: 'flex', justifyContent: 'center'}}>
            <div style={{width: 130, height: 130, borderRadius: 32, background: s.logo === 'figma.svg' ? '#1E1E1E' : '#FFF', display: 'grid', placeItems: 'center', boxShadow: 'inset 0 0 0 2px rgba(17,19,22,.1)'}}>
              <Img src={A(s.logo)} style={{width: s.logo === 'acrobat.svg' ? 130 : 84, height: s.logo === 'acrobat.svg' ? 130 : 84, objectFit: 'contain'}} /></div></div>
          <div style={{position: 'absolute', left: 0, right: 0, top: 196, textAlign: 'center', fontFamily: SF, fontWeight: 600, fontSize: 44, color: INK}}>{s.name}</div>
          <div style={{position: 'absolute', left: 0, right: 0, top: 262, textAlign: 'center', fontFamily: CV, fontSize: 72, color: zero > 0.5 ? '#B9B7B1' : INK}}>
            <span style={{position: 'relative'}}>{s.price}<span style={{position: 'absolute', left: -10, right: -10, top: '52%', height: 9, borderRadius: 5, background: OR, transformOrigin: 'left', transform: `scaleX(${strike}) rotate(-4deg)`}} /></span>
            <span style={{fontFamily: SF, fontWeight: 300, fontSize: 40, color: GREY}}> /мес</span></div>
          {zero > 0 ? <div style={{position: 'absolute', right: 18, top: 18, transform: `scale(${0.4 + 0.6 * zero}) rotate(${lerp(-25, -8, zero)}deg)`, opacity: Math.min(1, zero * 2)}}>
            <Plate t={t} at={W[11] + i * 0.14} text="$0" size={70} fps={fps} r={0} /></div> : null}
        </Card>; })}
      <Line t={t} y={970} size={96} dark words={[{txt: 'бесплатная', at: W[11]}, {txt: 'замена', at: W[12], cv: true}]} />
      <div style={{position: 'absolute', left: 720, top: 1150, transform: `translateX(-50%) scale(${0.6 + 0.4 * gh})`, opacity: Math.min(1, gh * 2), height: 110, padding: '0 40px 0 18px', borderRadius: 55, background: '#FFF',
        display: 'flex', alignItems: 'center', gap: 18, fontFamily: SF, fontWeight: 600, fontSize: 52, color: INK, whiteSpace: 'nowrap', boxShadow: '0 10px 0 #000'}}>
        <div style={{width: 80, height: 80, borderRadius: 40, background: INK, display: 'grid', placeItems: 'center'}}><Img src={A('github.svg')} style={{width: 52, height: 52, filter: 'invert(1)'}} /></div>
        открытый код</div>
    </SymScene>
  );
};

// ——— плиты КАНВАСА: три замены ———
const SPOTS: Spot[] = [{id: 'a', x: 720, y: 1000}, {id: 'b', x: 2320, y: 1500, dark: true}, {id: 'c', x: 2320, y: 3100}];
const MOVES: Move[] = [['a', 'b', W[48] - 0.3, W[48] + 0.7], ['b', 'c', W[70] - 0.3, W[70] + 0.7]];
const Head: React.FC<{n: string; logo: string; name: string; sub: string; subLogo: string; dark?: boolean; t: number; at: number}> = ({n, logo, name, sub, subLogo, dark, t, at}) => {
  const p = k(t, at - 0.15, at + 0.25, BACK), q = k(t, at + 0.35, at + 0.65);
  return (
    <>
      <div style={{position: 'absolute', left: 50, top: 40, fontFamily: CV, fontSize: 120, lineHeight: 1, color: OR, opacity: p}}>{n}</div>
      <div style={{position: 'absolute', left: 140, top: 44, transform: `scale(${0.6 + 0.4 * p}) rotate(${(1 - p) * -12}deg)`, opacity: Math.min(1, p * 2)}}><LogoTile src={A(logo)} s={120} /></div>
      <div style={{position: 'absolute', left: 290, top: 40, fontFamily: SF, fontWeight: 700, fontSize: 76, letterSpacing: '-0.02em', color: dark ? LIGHT : INK, opacity: q, transform: `translateX(${(1 - q) * 40}px)`}}>{name}</div>
      <div style={{position: 'absolute', left: 292, top: 128, display: 'flex', alignItems: 'center', gap: 12, fontFamily: SF, fontWeight: 400, fontSize: 44, color: dark ? '#A9ADB3' : GREY, opacity: k(t, at + 0.5, at + 0.8)}}>
        замена<Img src={A(subLogo)} style={{width: 44, height: 44, objectFit: 'contain', borderRadius: 10}} /></div>
    </>
  );
};
const ACTS: [string, string, number][] = [
  ['склеить', 'M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4M9 12h6', W[29]], ['разрезать', 'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12', W[30]],
  ['подписать', 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z', W[31]], ['сжать', 'M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7', W[32]],
  ['распознать текст', 'M4 7V4h16v3M9 20h6M12 4v16', W[33]], ['закрасить', 'M3 5h18v14H3zM7 10h10M7 14h6', W[36]],
];
const SlabA: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const stars = Math.round(interpolate(t, [W[21] - 0.1, W[23]], [0, 93], {...cl, easing: EXPO})), st = k(t, W[21] - 0.2, W[21] + 0.15, BACK);
  const ui = k(t, W[26] - 0.1, W[26] + 0.3, BACK), mine = k(t, W[40] - 0.1, W[40] + 0.3, BACK), fly = bump(t, W[41], 1.1), home = k(t, W[46] - 0.1, W[46] + 0.3, BACK);
  return (
    <>
      <Head n="1" logo="stirling.png" name="Stirling PDF" sub="замена" subLogo="acrobat.svg" t={t} at={W[16]} />
      <div style={{position: 'absolute', left: 50, top: 220, height: 96, padding: '0 30px 0 16px', borderRadius: 48, background: INK, display: 'flex', alignItems: 'center', gap: 16, fontFamily: SF, fontWeight: 600, fontSize: 48, color: '#FFF',
        opacity: Math.min(1, st * 2), transform: `scale(${0.6 + 0.4 * st})`, transformOrigin: 'left center'}}>
        <Img src={A('github.svg')} style={{width: 60, height: 60, filter: 'invert(1)'}} /><span style={{color: OR}}>★</span>{stars} тыс. звёзд</div>
      {/* настоящий интерфейс Stirling PDF */}
      <div style={{position: 'absolute', left: 50, top: 350 + (1 - ui) * 40, width: 900, height: 506, borderRadius: 28, overflow: 'hidden', border: `4px solid ${INK}`, boxShadow: '0 10px 0 rgba(17,19,22,.9)', opacity: Math.min(1, ui * 2)}}>
        <Img src={A('stirling-ui.png')} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'left top'}} />
        {/* «документы никуда не уходят, всё работает у тебя» */}
        {mine > 0 ? <div style={{position: 'absolute', inset: 0, background: 'rgba(17,19,22,.94)', opacity: Math.min(1, mine * 2)}}>
          <div style={{position: 'absolute', left: 0, right: 0, top: 40, textAlign: 'center', fontFamily: SF, fontWeight: 300, fontSize: 58, color: LIGHT}}>документы никуда не уходят</div>
          <div style={{position: 'absolute', left: 110, top: 200, opacity: 0.55}}><Ico d="M7 18a5 5 0 0 1-.5-10A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z" s={170} c="#9AA0A6" w={1.4} />
            <div style={{position: 'absolute', left: 40, top: 60, width: 90, height: 8, borderRadius: 4, background: OR, transform: 'rotate(-35deg)'}} /></div>
          <div style={{position: 'absolute', left: 420 - 160 * fly, top: 230 - 40 * fly, transform: `rotate(${-20 * fly}deg)`}}><Ico d="M14 3H6v18h12V7zM14 3v4h4M9 13h6M9 17h4" s={110} c="#FFF" w={1.6} /></div>
          <div style={{position: 'absolute', left: 600, top: 190, transform: `scale(${1 + 0.06 * home})`}}><Ico d="M4 5h16v11H4zM2 19h20" s={200} c={home > 0.5 ? OR : '#FFF'} w={1.5} /></div>
          <div style={{position: 'absolute', left: 560, width: 280, top: 400, textAlign: 'center', fontFamily: CV, fontSize: 64, color: OR, opacity: home}}>у тебя</div>
        </div> : null}
      </div>
      {/* наклейка «50+ инструментов» на угол окна */}
      <div style={{position: 'absolute', right: 30, top: 300}}>{t > W[26] - 0.2 ? <Plate t={t} at={W[26]} text="50+ инструментов" size={60} fps={fps} r={-4} /> : null}</div>
      {/* шесть действий загораются по речи */}
      {ACTS.map(([name, d, at], i) => { const p = k(t, W[29] - 0.3 + i * 0.05, W[29] + i * 0.05, BACK), on = k(t, at - 0.05, at + 0.2, BACK) > 0.5, col = i % 2, row = Math.floor(i / 2);
        return <div key={name} style={{position: 'absolute', left: 50 + col * 460, top: 890 + row * 92, width: 440, height: 76, borderRadius: 38, display: 'flex', alignItems: 'center', gap: 14, padding: '0 22px', boxSizing: 'border-box',
          background: on ? OR : '#F1F0EC', border: `3px solid ${on ? '#C24F14' : '#DDDBD5'}`, fontFamily: SF, fontWeight: 600, fontSize: 40, color: on ? '#FFF' : INK, opacity: Math.min(1, p * 2) * (1 - 0.6 * mine),
          transform: `scale(${(0.7 + 0.3 * p) * (1 + 0.06 * bump(t, at, 0.3))})`}}><Ico d={d} s={42} c={on ? '#FFF' : INK} w={2} />{name}</div>; })}
    </>
  );
};
const TEAM: [string, string, number, number][] = [['дизайнер', OR, 0, 0], ['разработчик', MINT, 1, 0.12], ['менеджер', '#FFFFFF', 2, 0.24]];
const SlabB: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const win = k(t, W[54] - 0.15, W[54] + 0.25, BACK), team = k(t, W[56] - 0.1, W[56] + 0.3), code = k(t, W[60] - 0.1, W[60] + 0.4, EIO), push = k(t, W[61], W[65], EIO);
  return (
    <>
      <Head n="2" logo="penpot.png" name="Penpot" sub="замена" subLogo="figma.svg" dark t={t} at={W[48]} />
      <div style={{position: 'absolute', left: 40, top: 240 + (1 - win) * 50, width: 920, height: 518, borderRadius: 28, overflow: 'hidden', border: '4px solid #3A3D42', boxShadow: '0 10px 0 #000', opacity: Math.min(1, win * 2), background: '#000'}}>
        {PENPOT_DEMO
          ? <Sequence from={Math.round((W[54] - 0.2) * 60)} layout="none"><Video src={staticFile(PENPOT_DEMO)} muted trimBefore={9 * 60} objectFit="cover" style={{position: 'absolute', inset: 0, width: '100%', height: '100%', maxWidth: 'none'}} /></Sequence>
          : <Img src={A('penpot-ui.jpg')} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', maxWidth: 'none'}} />}
        {/* разработчик забирает код: настоящий экран Penpot, наезд на панель CSS */}
        {code > 0 ? <div style={{position: 'absolute', inset: 0, opacity: code}}>
          <Img src={A('penpot-ui.jpg')} style={{position: 'absolute', width: 920 * lerp(1, 2.3, push), height: 518 * lerp(1, 2.3, push), left: -lerp(0, 0.83 * 920 * 2.3 - 460, push), top: -lerp(0, 0.534 * 518 * 2.3 - 259, push), maxWidth: 'none'}} /></div> : null}
        {/* курсоры команды */}
        {TEAM.map(([name, c, i, d]) => { const p = k(t, W[56] + d, W[56] + d + 0.3, BACK), x = 180 + i * 250 + Math.sin(t * 1.6 + i * 2) * 60, y = 140 + i * 90 + Math.cos(t * 1.3 + i) * 40;
          return <div key={name} style={{position: 'absolute', left: x, top: y, opacity: Math.min(1, p * 2) * team * (1 - code), transform: `scale(${0.6 + 0.4 * p})`}}>
            <svg width={50} height={60} viewBox="0 0 24 28"><path d="M2 2 L2 22 L7.5 17 L11 25 L14.5 23.5 L11 15.5 L18.5 15.5 Z" fill={c} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" /></svg>
            <div style={{position: 'absolute', left: 36, top: 44, height: 50, padding: '0 16px', borderRadius: 25, background: c, display: 'flex', alignItems: 'center', fontFamily: SF, fontWeight: 700, fontSize: 32, color: INK, whiteSpace: 'nowrap'}}>{name}</div>
          </div>; })}
      </div>
      {[['макеты', W[54]], ['прототипы', W[55]], ['вся команда', W[56]]].map(([w, at], i) => { const p = k(t, (at as number) - 0.05, (at as number) + 0.25, BACK);
        return <div key={w as string} style={{position: 'absolute', left: 40 + i * 310, top: 800, width: 290, height: 84, borderRadius: 42, background: '#24272B', border: '3px solid #3A3D42', display: 'grid', placeItems: 'center',
          fontFamily: SF, fontWeight: 600, fontSize: 42, color: LIGHT, opacity: Math.min(1, p * 2) * (1 - 0.5 * code), transform: `scale(${0.6 + 0.4 * p})`}}>{w as string}</div>; })}
      <div style={{position: 'absolute', left: 40, top: 930, fontFamily: SF, fontWeight: 300, fontSize: 60, color: LIGHT, opacity: k(t, W[60] - 0.05, W[60] + 0.25)}}>разработчик забирает</div>
      <div style={{position: 'absolute', left: 40, top: 1030, display: 'flex', gap: 24}}>
        {t > W[65] - 0.2 ? <Plate t={t} at={W[65]} text="CSS" size={80} fps={fps} r={-3} /> : null}
        {t > W[67] - 0.2 ? <Plate t={t} at={W[67]} text="HTML" size={80} fps={fps} r={2} /> : null}
      </div>
    </>
  );
};
// AppFlowy: четыре настоящих экрана из README (телефоны), чипы по речи, «всё в одном месте» → «на своём сервере»
const PHONES: [string, number][] = [['appflowy-2.png', 0], ['appflowy-2.png', 1], ['appflowy-3.png', 0], ['appflowy-1.png', 0]];
const PhoneCrop: React.FC<{src: string; i: number; w: number}> = ({src, i, w}) => {
  const sx = i ? 1310 : 231, sw = 536, sy = 50, sh = 1138, s = w / sw;
  return <div style={{position: 'relative', width: w, height: sh * s, overflow: 'hidden', borderRadius: w * 0.14}}>
    <Img src={A(src)} style={{position: 'absolute', left: -sx * s, top: -sy * s, width: 2080 * s, height: 1320 * s, maxWidth: 'none'}} /></div>;
};
const KINDS: [string, number][] = [['документы', W[76]], ['базы', W[77]], ['канбан', W[78]], ['календарь', W[80]]];
const SlabC: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const one = k(t, W[81] - 0.1, W[84] + 0.2, EIO), srv = k(t, W[88] - 0.1, W[88] + 0.3, BACK);
  return (
    <>
      <Head n="3" logo="appflowy.png" name="AppFlowy" sub="замена" subLogo="notion.svg" t={t} at={W[70]} />
      {PHONES.map(([src, i], j) => { const p = k(t, KINDS[j][1] - 0.15, KINDS[j][1] + 0.25, BACK), x = lerp(60 + j * 225, 400, one), y = lerp(250, 250 + j * 8, one), r = lerp((j - 1.5) * 4, (j - 1.5) * 6, one);
        return p > 0 ? <div key={j} style={{position: 'absolute', left: x, top: y + (1 - p) * 80, transform: `rotate(${r}deg) scale(${0.7 + 0.3 * p})`, opacity: Math.min(1, p * 2), filter: 'drop-shadow(0 10px 0 rgba(17,19,22,.85))'}}>
          <PhoneCrop src={src} i={i} w={200} /></div> : null; })}
      {KINDS.map(([name, at], j) => { const p = k(t, at - 0.05, at + 0.25, BACK);
        return <div key={name} style={{position: 'absolute', left: 60 + (j % 2) * 450, top: 720 + Math.floor(j / 2) * 96, width: 430, height: 80, borderRadius: 40, background: OR, display: 'grid', placeItems: 'center',
          fontFamily: SF, fontWeight: 600, fontSize: 44, color: '#FFF', boxShadow: '0 6px 0 #C24F14', opacity: Math.min(1, p * 2) * (1 - 0.4 * srv), transform: `scale(${0.6 + 0.4 * p})`}}>{name}</div>; })}
      <div style={{position: 'absolute', left: 0, right: 0, top: 940, textAlign: 'center', fontFamily: SF, fontWeight: 300, fontSize: 64, color: INK, opacity: k(t, W[81] - 0.05, W[81] + 0.25)}}>
        всё в <span style={{fontFamily: CV, fontSize: 76, color: OR}}>одном месте</span></div>
      {/* свой сервер */}
      <div style={{position: 'absolute', left: 250, top: 1040, display: 'flex', alignItems: 'center', gap: 22, opacity: Math.min(1, srv * 2), transform: `translateY(${(1 - srv) * 40}px)`}}>
        <div style={{width: 110, height: 110, borderRadius: 26, background: INK, display: 'grid', placeItems: 'center'}}><Ico d="M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01" s={70} c={OR} w={2} /></div>
        <span style={{fontFamily: SF, fontWeight: 600, fontSize: 54, color: INK}}>на своём сервере</span></div>
    </>
  );
};

// ——— Claude: «Поставить их на сервер поможет Claude, это одна просьба» ———
const PROMPT = 'Поставь мне Stirling PDF на мой сервер';
const ClaudeScene: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const card = k(t, W[96] - 0.2, W[96] + 0.2, BACK), n = Math.round(PROMPT.length * interpolate(t, [W[97] - 0.1, W[99] - 0.1], [0, 1], cl)), press = bump(t, W[99] - 0.05, 0.2), sent = t > W[99] + 0.05;
  const ok = (i: number) => k(t, W[99] + 0.05 + i * 0.08, W[99] + 0.3 + i * 0.08, BACK);
  return (
    <SymScene t={t} a={B2} b={B3} exit="whip">
      <Line t={t} y={370} size={88} dark words={[{txt: 'Поставить', at: Math.max(W[92], B2 + 0.15)}, {txt: 'их', at: W[93]}, {txt: 'на', at: W[94]}, {txt: 'сервер', at: W[95]}]} />
      <Line t={t} y={480} size={88} dark words={[{txt: 'поможет', at: W[96]}, {txt: 'Claude', at: W[97], cv: true}]} />
      <Card x={190} y={640 + (1 - card) * 60} w={1060} h={360} style={{opacity: Math.min(1, card * 2)}}>
        <div style={{position: 'absolute', left: 36, top: 30, display: 'flex', alignItems: 'center', gap: 16, fontFamily: SF, fontWeight: 600, fontSize: 44, color: INK}}><ClaudeIcon s={70} />Claude</div>
        <div style={{position: 'absolute', left: 36, right: 36, top: 130, height: 120, borderRadius: 30, background: '#F1F0EC', display: 'flex', alignItems: 'center', padding: '0 26px', fontFamily: SF, fontWeight: 400, fontSize: 46, color: INK, whiteSpace: 'nowrap', overflow: 'hidden'}}>
          {PROMPT.slice(0, n)}<span style={{color: OR, opacity: sent ? 0 : Math.floor(t * 4) % 2 ? 1 : 0.2}}>|</span></div>
        <div style={{position: 'absolute', right: 36, bottom: 24, width: 84, height: 84, borderRadius: 42, background: sent ? MINT : OR, display: 'grid', placeItems: 'center', transform: `scale(${1 - 0.12 * press})`}}>
          <svg width={44} height={44} viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6" fill="none" stroke={sent ? MINT_INK : '#FFF'} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" /></svg></div>
      </Card>
      {['stirling.png', 'penpot.png', 'appflowy.png'].map((l, i) => { const p = ok(i);
        return <div key={l} style={{position: 'absolute', left: 300 + i * 320, top: 1080, opacity: Math.min(1, p * 2), transform: `scale(${0.6 + 0.4 * p})`}}>
          <LogoTile src={A(l)} s={150} />
          <div style={{position: 'absolute', right: -16, top: -16, width: 64, height: 64, borderRadius: 32, background: MINT, display: 'grid', placeItems: 'center', boxShadow: '0 6px 0 #1FA486'}}>
            <svg width={40} height={40} viewBox="0 0 24 24"><path d={CHECK} fill="none" stroke={MINT_INK} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" /></svg></div>
        </div>; })}
      <PlateAt t={t} at={W[99]} y={1300} text="одна просьба" size={90} fps={fps} r={-2} />
    </SymScene>
  );
};

// ——— «Скинь это тому, кто платит за подписки» ———
const Share: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const plane = k(t, W[101] - 0.1, W[101] + 0.3, BACK), suck = k(t, W[105] - 0.1, W[107] + 0.3, EIO), go = k(t, W[107] + 0.25, W[107] + 0.55, EIO);
  return (
    <SymScene t={t} a={B3} b={B4} exit="bloom">
      <Line t={t} y={380} size={92} words={[{txt: 'Скинь', at: Math.max(W[101], B3 + 0.12)}, {txt: 'это', at: W[102]}, {txt: 'тому,', at: W[103]}]} />
      <Line t={t} y={490} size={92} words={[{txt: 'кто', at: W[104]}, {txt: 'платит', at: W[105]}, {txt: 'за', at: W[106]}, {txt: 'подписки', at: W[107], cv: true}]} />
      {SUBS.map((s, i) => { const a = (-150 + i * 60) * Math.PI / 180, r = lerp(380, 0, suck), p = k(t, W[103] + i * 0.08, W[103] + 0.3 + i * 0.08, BACK);
        return <div key={s.name} style={{position: 'absolute', left: 720 + Math.cos(a) * r - 65, top: 1000 + Math.sin(a) * r * 0.8 - 65, opacity: Math.min(1, p * 2) * (1 - k(t, W[107] + 0.1, W[107] + 0.3)),
          transform: `scale(${(0.6 + 0.4 * p) * lerp(1, 0.3, suck)}) rotate(${suck * 90}deg)`}}>
          <div style={{width: 130, height: 130, borderRadius: 32, background: s.logo === 'figma.svg' ? '#1E1E1E' : '#FFF', display: 'grid', placeItems: 'center', border: `4px solid ${INK}`, boxShadow: '0 8px 0 rgba(17,19,22,.9)'}}>
            <Img src={A(s.logo)} style={{width: s.logo === 'acrobat.svg' ? 120 : 80, height: s.logo === 'acrobat.svg' ? 120 : 80, objectFit: 'contain'}} /></div></div>; })}
      <div style={{position: 'absolute', left: 720 - 120 + go * 500, top: 1000 - 120 - go * 420, width: 240, height: 240, borderRadius: 120, background: OR, display: 'grid', placeItems: 'center', opacity: Math.min(1, plane * 2) * (1 - go),
        transform: `scale(${(0.6 + 0.4 * plane) * (1 + 0.08 * bump(t, W[107], 0.3))}) rotate(${go * -20}deg)`, boxShadow: '0 12px 0 #C24F14, 0 40px 80px rgba(255,122,47,.3)'}}>
        <Ico d="M22 2 11 13M22 2l-7 20-4-9-9-4z" s={130} c="#FFF" w={1.8} /></div>
    </SymScene>
  );
};

// ——— призыв: «Напиши ЗАМЕНА в комментариях, пришлю все три ссылки и инструкцию по установке» ———
const WORD = 'ЗАМЕНА';
const Cta: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const bar = k(t, B4 + 0.1, B4 + 0.45, BACK), n = Math.round(WORD.length * interpolate(t, [W[109] - 0.05, W[109] + 0.35], [0, 1], cl)), send = bump(t, W[111], 0.2), sent = t > W[111] + 0.1;
  return (
    <div style={{position: 'absolute', inset: 0, transform: `scale(${1 + 0.03 * k(t, B4, SYM_END, (v) => v)})`, transformOrigin: '720px 900px'}}>
      <Line t={t} y={370} size={92} dark words={[{txt: 'Напиши', at: Math.max(W[108], B4 + 0.12)}]} />
      <div style={{position: 'absolute', left: 720, top: 490, transform: 'translateX(-50%)'}}>{t > W[109] - 0.2 ? <Plate t={t} at={W[109]} text="ЗАМЕНА" size={150} fps={fps} r={-3} /> : null}</div>
      <Line t={t} y={710} size={72} dark words={[{txt: 'в', at: W[110]}, {txt: 'комментариях', at: W[111]}]} />
      {/* поле комментария Instagram */}
      <div style={{position: 'absolute', left: 190, width: 1060, top: 830, height: 130, borderRadius: 65, background: '#FFF', display: 'flex', alignItems: 'center', gap: 22, padding: '0 20px 0 26px', boxSizing: 'border-box',
        opacity: Math.min(1, bar * 2), transform: `translateY(${(1 - bar) * 40}px)`, boxShadow: '0 10px 0 rgba(0,0,0,.35)'}}>
        <div style={{width: 84, height: 84, borderRadius: 42, background: 'linear-gradient(160deg, #3A3F44, #0E0F11)'}} />
        <div style={{flex: 1, fontFamily: SF, fontWeight: 600, fontSize: 56, color: n ? INK : '#A9A7A1', letterSpacing: '0.04em'}}>{n ? WORD.slice(0, n) : 'Добавьте комментарий…'}</div>
        <div style={{width: 96, height: 96, borderRadius: 48, background: sent ? INK : OR, display: 'grid', placeItems: 'center', transform: `scale(${1 - 0.12 * send})`}}>
          <svg width={50} height={50} viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6" fill="none" stroke="#FFF" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" /></svg></div>
      </div>
      {/* пришлю: три ссылки и инструкция */}
      {[['stirling.png', 'Stirling PDF'], ['penpot.png', 'Penpot'], ['appflowy.png', 'AppFlowy'], ['', 'инструкция']].map(([l, name], i) => {
        const at = i < 3 ? W[113] + i * 0.15 : W[117], p = k(t, at - 0.1, at + 0.25, BACK);
        return <Card key={name} x={190 + (i % 2) * 540} y={1010 + Math.floor(i / 2) * 150} w={520} h={130} style={{opacity: Math.min(1, p * 2), transform: `translateY(${(1 - p) * 40}px) scale(${0.7 + 0.3 * p})`}}>
          <div style={{position: 'absolute', left: 18, top: 15}}>{l ? <LogoTile src={A(l)} s={92} /> : <div style={{width: 92, height: 92, borderRadius: 24, background: OR, display: 'grid', placeItems: 'center'}}><Ico d="M14 3H6v18h12V7zM14 3v4h4M9 12h6M9 16h6" s={58} c="#FFF" w={2} /></div>}</div>
          <div style={{position: 'absolute', left: 134, top: 38, fontFamily: SF, fontWeight: 600, fontSize: 46, color: INK}}>{name}</div>
        </Card>; })}
    </div>
  );
};

type E = [number, string, number, boolean?, number?];
const SFX: E[] = [
  [0.02, 'pop', 0.07], [W[3], 'pop', 0.07], [W[4], 'pop', 0.07], [W[6], 'pop', 0.07], [W[9], 'crispy', 0.07], [W[11], 'click4', 0.07], [W[11] + 0.14, 'click4', 0.07], [W[11] + 0.28, 'click4', 0.07], [W[14], 'select', 0.06],
  [B1, 'sw-s4', 0.08], [W[16], 'glass', 0.05], [W[21], 'counter', 0.07], [W[26], 'pop', 0.09], ...ACTS.map(([, , at]) => [at, 'click4', 0.05] as E), [W[40], 'popup', 0.06], [W[46], 'confirm', 0.06],
  [MOVES[0][2] + 0.05, 'sw-s1', 0.07], [W[48], 'glass', 0.05], [W[54], 'pop', 0.06], [W[56], 'select', 0.06], [W[65], 'pop', 0.09], [W[67], 'pop', 0.09],
  [MOVES[1][2] + 0.05, 'sw-s1', 0.07], [W[70], 'glass', 0.05], [W[76], 'click4', 0.05], [W[77], 'click4', 0.05], [W[78], 'click4', 0.05], [W[80], 'click4', 0.05], [W[88], 'confirm', 0.06],
  [B2, 'sw-s5', 0.07], [W[97], 'type-a', 0.05, false, 1.6], [W[99], 'click', 0.1], [W[100], 'chime', 0.07],
  [B3, 'sw-s4', 0.08], [W[105], 'sw-s1', 0.05], [W[107] + 0.25, 'notif', 0.06],
  [B4, 'sw-s5', 0.07], [W[109], 'pop', 0.11], [W[111], 'click', 0.1], [W[113], 'pop', 0.06], [W[117], 'confirm', 0.06],
];

export const SwapSym: React.FC = () => {
  const frame = useCurrentFrame(), {fps} = useVideoConfig(), t = frame / fps, fin = k(t, SYM_END - 0.25, SYM_END - 0.02, (v) => v);
  const light = isLight(blockAt(BLOCKS, t).bg);
  return (
    <AbsoluteFill style={{background: '#0B0C0E'}}>
      <SymBackdrop t={t} blocks={BLOCKS} />
      <Hook t={t} fps={fps} />
      <SymCanvas t={t} a={B1} b={B2} spots={SPOTS} moves={MOVES} exit="bloom"
        render={(id) => (id === 'a' ? <SlabA t={t} fps={fps} /> : id === 'b' ? <SlabB t={t} fps={fps} /> : <SlabC t={t} fps={fps} />)} />
      <ClaudeScene t={t} fps={fps} />
      <Share t={t} fps={fps} />
      {t > B4 - 0.05 ? <Cta t={t} fps={fps} /> : null}
      <SpeakerStrip src={REC} srcW={1920} srcH={1080} h={STRIP.h35} inset={STRIP.insetIg} zoom={1.3} r={STRIP.rIg} headTop={0.2} shade={light ? 0.22 : 0.5} />
      <AbsoluteFill style={{background: '#000', opacity: fin}} />
      {VOICE ? <Audio src={staticFile(VOICE)} /> : null}
      {SFX.map(([a, c, v, pk, dd], i) => {
        const m = ISLA[c], from = Math.max(0, Math.round((a - (pk ? m.peak : m.onset)) * fps));
        return <Sequence key={i} from={from} durationInFrames={Math.round((dd ?? (c.startsWith('type') ? 0.35 : m.dur)) * fps)} layout="none"><Audio src={staticFile(`sfx/isla/${c}.wav`)} volume={v * VOL} /></Sequence>;
      })}
    </AbsoluteFill>
  );
};
