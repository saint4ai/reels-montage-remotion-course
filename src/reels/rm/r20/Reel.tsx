import React from 'react';
import {Img, staticFile} from 'remotion';
import {StyleReel} from '../../../styles/engine';
import {ClickSpark, ShinyText, StarBorder} from '../../../kit/reactbits';
import WORDS_RAW from '../../../../public/rm/r20/words.json';
import META from '../../../../public/rm/r20/meta.json';
import {
  blk, Brand, buildWords, cardStyle, CheckBadge, Chip, Clips, Cursor, E, FitText, INK, k, makeStyle, MINT, MINT_DK, MINT_INK, MONO, MUTE, NUM, OR, RED, RING, Rise, SANS, Sfx, Tile, Title, useLive, Voice, Win,
} from '../expertBoardKit';
import type {Cue, Fix, RawWord, SceneProps} from '../expertBoardKit';

// Ролик 20 «Деньги: 4 бесплатных коннектора», перемонтаж 10.10.2026 в стиле B ЭКСПЕРТ. Карта: patterns/reels/expert2-money/DIRECTION.md.
// Запись на нижней половине, сверху платиновая доска: метка раздела, заголовок с полосой, окна браузера с настоящей записью Pipeboard,
// страницами GitHub и дашбордом Metabase, белые карточки интерфейсов без выдуманных результатов (скелетоны вместо чисел).
export const FPS_R20 = 60;
export const FRAMES_R20 = Math.round(META.dur * FPS_R20);
const RAW = WORDS_RAW as RawWord[];
const w0 = (i: number) => RAW[i].t0;   // начало слова с номером i в words.json
const P = (n: string) => `rm/r20/${n}`;
// Запись спикера (вертикальная 1080×1920, голос берётся из неё же) положить в public/work/<slug>/ и вписать путь; null: заглушка и тишина.
// PIPEBOARD_CLIP: запись экрана Pipeboard (public/rm/r20/pipeboard.mp4, в курс не входит); без неё в окне стоит плитка сервиса.
const REC: string | null = null; // 'work/<slug>/rec.mp4'
const PIPEBOARD_CLIP = false;

// Субтитры: числа цифрами, «Pipeboard» вместо «Pyboard», тире между «Первый» и названием убраны, кавычки-ёлочки.
const FIX: Record<number, Fix> = {4: '20', 42: '4', 49: '4', 175: '4', 63: null, 91: null, 110: null, 173: null, 64: 'Pipeboard.', 118: 'amoCRM', 144: 'сведёт', 157: 'отчёты,', 172: '«деньги»'};
const WORDS = buildWords(RAW, FIX);

// ——— мелочи интерфейсов ———
const Skel: React.FC<{w: number | string; h?: number; c?: string; r?: number; style?: React.CSSProperties}> = ({w, h = 22, c = '#E4E7EA', r = 11, style}) => (
  <span style={{display: 'block', width: w, height: h, borderRadius: r, background: c, flex: 'none', ...style}} />
);
// провод: линия рисуется за a…b
const Wire: React.FC<{t: number; a: number; b: number; d: string; color?: string; width?: number; dash?: string}> = ({t, a, b, d, color = OR, width = 8, dash}) => {
  const p = k(t, a, b, E.inOut);
  if (p <= 0) return null;
  return (
    <svg width={1440} height={1280} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none'}}>
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" pathLength={1} strokeDasharray={dash ?? `${p} 1`} opacity={dash ? p : 1} />
    </svg>
  );
};
const Person: React.FC<{size: number; fg?: string}> = ({size, fg = '#8A9096'}) => (
  <svg width={size} height={size} viewBox="0 0 40 40"><circle cx={20} cy={15} r={7.5} fill={fg} /><path d="M5 37 C5 27 12 23 20 23 C28 23 35 27 35 37 Z" fill={fg} /></svg>
);
const Plane: React.FC<{size: number; color?: string}> = ({size, color = OR}) => (
  <svg width={size} height={size} viewBox="0 0 24 24"><path d="M3 11.5 L21 3 L14 21 L11 13.5 Z M11 13.5 L21 3" fill={color} stroke={color} strokeWidth={1.2} strokeLinejoin="round" /></svg>
);
const Arrow: React.FC<{size: number; color?: string}> = ({size, color = MUTE}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{flex: 'none'}}><path d="M4 12 H19 M13 6 L19 12 L13 18" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const Dots3: React.FC<{items: number[]}> = ({items}) => (
  <span style={{display: 'flex', gap: 10}}>{items.map((o, i) => <span key={i} style={{width: 18, height: 18, borderRadius: '50%', background: MUTE, opacity: o}} />)}</span>
);
const dotsBar = (
  <>{['#FF6159', '#FFBD2E', '#28C941'].map((c) => <span key={c} style={{width: 18, height: 18, borderRadius: '50%', background: c, flex: 'none'}} />)}</>
);

// ——— 01 ХУК. «Ты платишь за Claude 20 долларов и используешь его как простой чат» ———
// «$20» огромно с кадра 0 и покачивается на живых часах, рядом плитка Claude, под ними окно «простого чата» с печатающими точками.
const S0: React.FC<SceneProps> = ({t}) => {
  const live = useLive();
  const bob = Math.sin(live * 3.2) * 8, tilt = Math.sin(live * 2.1) * 2.5;
  const dots = [0, 1, 2].map((i) => 0.35 + 0.65 * Math.max(0, Math.sin(live * 6.5 - i * 0.9)));
  return (
    <>
      <Rise t={t} at={0.25} x={150} y={300} w={760} dy={60}>
        <div style={{transform: `translateY(${bob}px)`}}>
          <FitText text="$20" maxW={740} size={400} family={NUM} weight={900} track={-0.05}
            render={<><span style={{color: OR}}>$</span><ShinyText t={live} base={INK} shine="#9AA0A8" speed={2.6}>20</ShinyText></>} />
          <div style={{marginTop: 8, height: 14, borderRadius: 5, background: OR, width: `${100 * k(t, 0.3, 0.9, E.out)}%`}} />
        </div>
      </Rise>
      <Rise t={t} at={0.4} x={1010} y={330} dy={60} dx={80}>
        <div style={{transform: `rotate(${tilt}deg)`}}><Tile name="claude" size={230} /></div>
      </Rise>
      <Chip t={t} at={w0(10)} x={1270} y={682} anchor="right" label="простой чат" tone="ink" mono size={43} />
      <Rise t={t} at={0.55} x={150} y={790} w={1140} h={280} dy={70}>
        <div style={{position: 'relative', width: 1140, height: 280}}>
        <div style={{...cardStyle(34), width: 1140, height: 280, overflow: 'hidden'}}>
          <div style={{height: 84, display: 'flex', alignItems: 'center', gap: 18, padding: '0 32px', boxSizing: 'border-box', background: '#F1F2F4'}}>
            <Brand name="claude" size={48} /><span style={{fontFamily: MONO, fontWeight: 700, fontSize: 43, color: INK}}>Claude</span>
          </div>
          <div style={{padding: '30px 36px', display: 'flex', alignItems: 'center', gap: 24}}>
            <div style={{padding: '0 34px', height: 96, borderRadius: 48, background: '#F1F2F4', display: 'flex', alignItems: 'center', fontFamily: SANS, fontWeight: 700, fontSize: 52, color: INK, whiteSpace: 'nowrap'}}>
              Привет! Чем могу помочь?
            </div>
            <div style={{height: 96, borderRadius: 48, background: '#F1F2F4', display: 'flex', alignItems: 'center', padding: '0 34px'}}><Dots3 items={dots} /></div>
          </div>
        </div>
        <StarBorder t={live} w={1140} h={280} r={34} color="#FFB07A" thickness={4} speed={2.6} />
        </div>
      </Rise>
    </>
  );
};

// ——— 02 ПОДКЛЮЧИ. «Хотя его можно подключить к рекламе, к Instagram и CRM, и он сам покажет, где ты теряешь деньги» ———
const SrcCard: React.FC<{t: number; at: number; x: number; y: number; w: number; logos: string[]; label: string}> = ({t, at, x, y, w, logos, label}) => (
  <Rise t={t} at={at} x={x} y={y} w={w} h={112} dy={30} dx={90}>
    <div style={{...cardStyle(56), width: w, height: 112, display: 'flex', alignItems: 'center', gap: 20, padding: '0 36px'}}>
      {logos.map((l) => <Brand key={l} name={l} size={66} />)}
      <span style={{fontFamily: SANS, fontWeight: 800, fontSize: 54, letterSpacing: '-0.02em', color: INK, whiteSpace: 'nowrap'}}>{label}</span>
    </div>
  </Rise>
);
const S1: React.FC<SceneProps> = ({t}) => {
  const hub = w0(12) + 0.1;
  const src: [number, number, number, string][] = [[w0(17), 640, 546, 'M370,670 C510,670 520,546 640,546'], [w0(19), 700, 676, 'M370,670 C520,670 560,676 700,676'], [w0(21), 760, 806, 'M370,670 C510,670 560,806 760,806']];
  const tag = (i: number) => k(t, w0(28) + i * 0.22, w0(28) + i * 0.22 + 0.3, E.pop);
  return (
    <>
      <Title t={t} at={w0(15)} lines={['Подключи']} size={120} />
      <Rise t={t} at={hub} x={150} y={560} dy={50}>
        <div style={{position: 'relative'}}>
          <Tile name="claude" size={220} />
          <span style={{position: 'absolute', left: -12, top: -12, right: -12, bottom: -12, borderRadius: 66, border: `4px solid ${OR}`, opacity: 0.55 + 0.45 * Math.sin(t * 6)}} />
        </div>
      </Rise>
      {src.map(([at, , , d], i) => <Wire key={i} t={t} a={at - 0.15} b={at + 0.3} d={d} />)}
      <SrcCard t={t} at={w0(17)} x={640} y={490} w={520} logos={['meta', 'googleads']} label="реклама" />
      <SrcCard t={t} at={w0(19)} x={700} y={620} w={520} logos={['instagram']} label="Instagram" />
      <SrcCard t={t} at={w0(21)} x={760} y={750} w={500} logos={['amocrm.png', 'bitrix24']} label="CRM" />
      <Rise t={t} at={w0(25)} x={150} y={910} w={1140} h={150} dy={70}>
        <div style={{...cardStyle(34), width: 1140, height: 150, display: 'flex', alignItems: 'center', gap: 28, padding: '0 36px'}}>
          <Brand name="claude" size={78} />
          <svg width={84} height={84} viewBox="0 0 24 24" style={{flex: 'none'}}><circle cx={10} cy={10} r={6.5} fill="none" stroke={INK} strokeWidth={2.4} /><path d="M15 15 L21 21" stroke={INK} strokeWidth={2.8} strokeLinecap="round" /></svg>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{display: 'grid', placeItems: 'center', width: i === 2 ? 200 : 160, height: 100, borderRadius: 26, background: '#FDECEC', color: RED, fontFamily: NUM, fontWeight: 900,
              fontSize: i === 2 ? 76 : 64, letterSpacing: '-0.02em', opacity: Math.min(1, tag(i) * 2), transform: `translateY(${(1 - tag(i)) * 40}px) scale(${0.7 + 0.3 * tag(i)})`}}>−$</span>
          ))}
        </div>
      </Rise>
    </>
  );
};

// ——— 03 СКИНЬ ЭТО. «Скинь это тому, у кого Claude до сих пор просто чат» ———
const S2: React.FC<SceneProps> = ({t}) => {
  const sel = k(t, w0(32), w0(32) + 0.3, E.pop), fly = k(t, 10.28, 10.95, E.inOut);
  return (
    <>
      <Title t={t} at={w0(30)} lines={['Скинь это']} size={190} />
      {[0, 1, 2, 3].map((i) => (
        <Rise key={i} t={t} at={9.5 + i * 0.1} x={190 + i * 210} y={600} dy={50}>
          <div style={{position: 'relative', width: 150, height: 150}}>
            <div style={{width: 150, height: 150, borderRadius: '50%', background: ['#E7E9EC', '#F3E6DB', '#DCEFE9', '#E4E4F1'][i], display: 'grid', placeItems: 'center', boxShadow: RING,
              outline: i === 2 && sel > 0 ? `${8 * Math.min(1, sel)}px solid ${OR}` : 'none'}}><Person size={96} /></div>
            {i === 2 && sel > 0 ? <div style={{position: 'absolute', right: -10, bottom: -6, transform: `scale(${sel})`}}><CheckBadge size={58} /></div> : null}
          </div>
        </Rise>
      ))}
      <Rise t={t} at={9.7} x={190} y={810} w={520} h={130} dy={60}>
        <div style={{width: 520, height: 130, borderRadius: 65, background: INK, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, fontFamily: SANS, fontWeight: 800,
          fontSize: 60, boxShadow: '0 18px 36px rgba(17,19,22,.28)', transform: `scale(${1 - 0.06 * (k(t, 10.18, 10.28) * (1 - k(t, 10.28, 10.4)))})`}}>
          <Plane size={56} color="#FFFFFF" />Отправить
        </div>
      </Rise>
      <Chip t={t} at={w0(39) - 0.1} x={760} y={832} label="просто чат" logo="claude" size={52} />
      {fly > 0 && fly < 1 ? (
        <div style={{position: 'absolute', left: 620 + 560 * fly, top: 820 - 330 * fly - 120 * Math.sin(fly * Math.PI), opacity: 1 - k(t, 10.8, 10.95), transform: `rotate(${-20 - 20 * fly}deg) scale(${1.2 - 0.4 * fly})`}}>
          <Plane size={96} />
        </div>
      ) : null}
      <Cursor t={t} pts={[[9.75, 1180, 1010], [10.12, 520, 900]]} press={[10.2]} />
    </>
  );
};

// ——— 04 4 ГОДА. «Я 4 года внедряю ИИ в бизнес» ———
const S3: React.FC<SceneProps> = ({t}) => {
  const n = Math.round(4 * k(t, w0(42), w0(42) + 0.45, E.out));
  return (
    <>
      <Rise t={t} at={w0(41)} x={150} y={290} w={760} dy={70}>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 30}}>
          <span style={{fontFamily: NUM, fontWeight: 900, fontSize: 420, lineHeight: 0.85, letterSpacing: '-0.05em', color: INK, minWidth: 250}}>{n}</span>
          <span style={{fontFamily: SANS, fontWeight: 800, fontSize: 170, lineHeight: 1, letterSpacing: '-0.04em', color: INK}}>года</span>
        </div>
        <div style={{marginTop: 22, height: 14, borderRadius: 5, background: OR, width: `${100 * k(t, w0(43), w0(43) + 0.5, E.out)}%`}} />
      </Rise>
      {[0, 1, 2, 3].map((i) => (
        <Rise key={i} t={t} at={w0(42) + i * 0.14} x={900 + i * 90} y={880 - i * 80} dy={40}>
          <div style={{width: 110, height: 110, borderRadius: 28, background: i === 3 ? OR : '#FFFFFF', color: i === 3 ? '#FFFFFF' : OR, boxShadow: RING, display: 'grid', placeItems: 'center',
            fontFamily: NUM, fontWeight: 900, fontSize: 76}}>{i + 1}</div>
        </Rise>
      ))}
      <Chip t={t} at={w0(45)} x={150} y={780} label="ИИ" tone="ink" size={56} />
      <Chip t={t} at={w0(47)} x={260} y={900} label="бизнес" size={56} dx={-60} />
    </>
  );
};

// ——— 05 ЧЕТЫРЕ КОННЕКТОРА. «Вот 4 бесплатных коннектора, которые дают Claude всю твою воронку от рекламы до оплаты» ———
const Conn: React.FC<{t: number; at: number; x: number; y: number; logos: string[]; label: string}> = ({t, at, x, y, logos, label}) => {
  const bd = k(t, at + 0.3, at + 0.6, E.pop);
  return (
    <Rise t={t} at={at} x={x} y={y} w={550} h={150} dy={50}>
      <div style={{...cardStyle(34), width: 550, height: 150, display: 'flex', alignItems: 'center', gap: 22, padding: '0 30px'}}>
        {logos.map((l) => <Brand key={l} name={l} size={logos.length > 1 ? 74 : 100} />)}
        <span style={{fontFamily: SANS, fontWeight: 800, fontSize: 54, letterSpacing: '-0.03em', color: INK, whiteSpace: 'nowrap'}}>{label}</span>
      </div>
      <span style={{position: 'absolute', right: -14, top: -26, padding: '4px 22px', borderRadius: 30, background: OR, color: '#2A0E02', fontFamily: NUM, fontWeight: 900, fontSize: 52,
        opacity: Math.min(1, bd * 2), transform: `scale(${0.5 + 0.5 * bd}) rotate(4deg)`}}>$0</span>
    </Rise>
  );
};
const S4: React.FC<SceneProps> = ({t}) => {
  const stages = [['реклама', w0(59)], ['заявки', 18.45], ['сделки', 18.65], ['оплата', w0(61)]] as [string, number][];
  return (
    <>
      <Title t={t} at={w0(49)} lines={['4 бесплатных', 'коннектора']} size={110} />
      <Conn t={t} at={w0(51)} x={150} y={600} logos={['pipeboard.png']} label="Pipeboard" />
      <Conn t={t} at={w0(51) + 0.22} x={740} y={600} logos={['zernio.png']} label="Zernio" />
      <Conn t={t} at={w0(51) + 0.44} x={150} y={790} logos={['amocrm.png', 'bitrix24']} label="MCP" />
      <Conn t={t} at={w0(51) + 0.66} x={740} y={790} logos={['metabase']} label="Metabase" />
      <div style={{position: 'absolute', left: 150, top: 982, width: 1140, display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        {stages.map(([lb, at], i) => {
          const a = k(t, at, at + 0.3, E.pop), ar = k(t, at - 0.2, at + 0.1);
          return (
            <div key={lb} style={{display: 'flex', alignItems: 'center', gap: 22}}>
              {i > 0 ? <div style={{opacity: ar}}><Arrow size={44} color={OR} /></div> : null}
              <span style={{display: 'inline-flex', alignItems: 'center', height: 77, padding: '0 27px', borderRadius: 39, fontFamily: MONO, fontWeight: 700, fontSize: 43, whiteSpace: 'nowrap',
                background: i === 3 ? INK : '#FFFFFF', color: i === 3 ? '#FFFFFF' : INK, boxShadow: RING, opacity: Math.min(1, a * 2), transform: `scale(${0.7 + 0.3 * a})`}}>{lb}</span>
            </div>
          );
        })}
      </div>
    </>
  );
};

// ——— 06 PIPEBOARD. «Первый Pipeboard. Реклама в Meta, Google, LinkedIn и TikTok» ———
const S5: React.FC<SceneProps> = ({t, b}) => {
  const logos = [['meta', w0(67)], ['googleads', w0(68)], ['linkedin', w0(69)], ['tiktok', w0(71)]] as [string, number][];
  return (
    <>
      <Title t={t} at={w0(64) - 0.05} lines={['Pipeboard']} size={140} />
      <Win t={t} at={w0(62)} x={150} y={490} w={1140} h={590} url="Pipeboard" name="pipe">
        {PIPEBOARD_CLIP
          ? <Clips t={t} scene={b.at} pos="50% 30%" clips={[{src: P('pipeboard.mp4'), at: w0(62), to: 23.7, trim: 2.6}]} />
          : <div style={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: '#F3F4F6'}}><Tile name="pipeboard.png" size={220} /></div>}
      </Win>
      <Chip t={t} at={w0(65)} x={190} y={968} label="реклама" tone="ink" size={48} />
      {logos.map(([name, at], i) => (
        <Rise key={name} t={t} at={at - 0.05} x={640 + i * 160} y={950} dy={70}><Tile name={name} size={120} r={30} /></Rise>
      ))}
    </>
  );
};

// ——— 07 ТАБЛИЦА КАМПАНИЙ. «Claude видит бюджеты, креативы и цену заявки. Говорит, какую рекламу отключить и сам запускает новые тесты. Таргетологи, сорри» ———
const COLS: [string, number, number][] = [['бюджет', 370, 24.36], ['креатив', 560, 24.92], ['цена заявки', 790, 25.7]];
const THUMBS = ['linear-gradient(135deg, #FFD9C2, #FFB48A)', 'linear-gradient(135deg, #CFF5EA, #8BE3CB)', 'linear-gradient(135deg, #E4E6F7, #B9BDEB)', 'linear-gradient(135deg, #FFF0C2, #F7D96E)'];
const S6: React.FC<SceneProps> = ({t}) => {
  const bad = 2, off = k(t, w0(82), w0(82) + 0.3, E.inOut), dim = 1 - 0.55 * k(t, w0(88), w0(88) + 0.3);
  return (
    <>
      <Title t={t} at={w0(72) - 0.05} lines={['Claude видит']} size={110} />
      <Rise t={t} at={w0(72)} x={150} y={470} w={1140} h={580} dy={80}>
        <div style={{...cardStyle(34), width: 1140, height: 580, position: 'relative', overflow: 'hidden', opacity: dim}}>
          {COLS.map(([lb, x, at]) => {
            const a = k(t, at, at + 0.3), glow = a * (1 - k(t, at + 0.9, at + 1.4));
            return (
              <div key={lb}>
                <div style={{position: 'absolute', left: x - 18, top: 0, width: lb === 'цена заявки' ? 320 : 190, height: 580, background: `rgba(61,237,195,${0.14 * glow})`}} />
                <span style={{position: 'absolute', left: x, top: 20, fontFamily: MONO, fontWeight: 700, fontSize: 43, color: MUTE, opacity: a, whiteSpace: 'nowrap'}}>{lb}</span>
              </div>
            );
          })}
          {Array.from({length: 6}, (_, i) => {
            const isNew = i >= 4, at = isNew ? (i === 4 ? w0(86) : w0(87)) : w0(74) + i * 0.25;
            const a = k(t, at, at + 0.4, E.out), isBad = i === bad;
            const y = 84 + i * 76;
            return (
              <div key={i} style={{position: 'absolute', left: 0, top: y, width: 1140, height: 76, opacity: a * (isBad ? 1 - 0.55 * off : 1), transform: `translateY(${(1 - a) * 26}px)`,
                background: isNew ? 'rgba(61,237,195,.18)' : 'transparent', boxShadow: isBad && off > 0 ? `inset 6px 0 0 ${RED}` : undefined}}>
                <span style={{position: 'absolute', left: 36, top: 27, width: 22, height: 22, borderRadius: '50%', background: isBad && t > w0(81) ? RED : isNew ? MINT : '#28C941'}} />
                {isNew
                  ? <span style={{position: 'absolute', left: 80, top: 8, height: 60, display: 'flex', alignItems: 'center', padding: '0 24px', borderRadius: 30, background: MINT, color: MINT_INK, fontFamily: MONO, fontWeight: 700, fontSize: 43}}>тест</span>
                  : <Skel w={[240, 200, 260, 220][i % 4]} h={24} style={{position: 'absolute', left: 80, top: 26}} />}
                <Skel w={130} h={24} style={{position: 'absolute', left: 370, top: 26}} />
                <span style={{position: 'absolute', left: 560, top: 11, width: 90, height: 54, borderRadius: 12, background: THUMBS[i % 4]}} />
                <Skel w={150} h={24} style={{position: 'absolute', left: 790, top: 26}} />
                <span style={{position: 'absolute', left: 1030, top: 15, width: 84, height: 46, borderRadius: 23, background: isBad && off > 0.5 ? '#C5C9CF' : MINT}}>
                  <span style={{position: 'absolute', top: 5, left: isBad ? 5 + 38 * (1 - off) : 43, width: 36, height: 36, borderRadius: '50%', background: '#FFFFFF', boxShadow: '0 2px 6px rgba(17,19,22,.25)'}} />
                </span>
                {isBad && off > 0 ? <span style={{position: 'absolute', left: 76, top: 37, height: 5, borderRadius: 3, background: RED, width: 280 * off}} /> : null}
              </div>
            );
          })}
        </div>
      </Rise>
      <Rise t={t} at={w0(88)} x={170} y={640} w={1000} h={290} dy={0} style={{transform: 'rotate(-4deg)'}}>
        {(() => {
          const slam = k(t, w0(88), w0(88) + 0.3, E.pop), sorry = k(t, w0(89), w0(89) + 0.3, E.pop);
          return (
            <div style={{width: 1000, height: 290, borderRadius: 34, background: INK, color: '#FFFFFF', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 6,
              transform: `scale(${1.5 - 0.5 * slam})`, boxShadow: '0 36px 70px rgba(17,19,22,.4)', whiteSpace: 'nowrap'}}>
              <span style={{fontFamily: SANS, fontWeight: 800, fontSize: 84, letterSpacing: '-0.03em'}}>ТАРГЕТОЛОГИ,</span>
              <span style={{fontFamily: NUM, fontWeight: 900, fontSize: 130, letterSpacing: '-0.03em', color: OR, opacity: sorry, transform: `scale(${0.7 + 0.3 * sorry})`}}>СОРРИ</span>
            </div>
          );
        })()}
      </Rise>
    </>
  );
};

// ——— 08 ZERNIO. «Второй Zernio. Директ, комментарии в WhatsApp и Telegram» ———
const Chan: React.FC<{t: number; at: number; x: number; y: number; icon: React.ReactNode; label: string}> = ({t, at, x, y, icon, label}) => (
  <Rise t={t} at={at} x={x} y={y} w={550} h={190} dy={60}>
    <div style={{...cardStyle(34), width: 550, height: 190, display: 'flex', alignItems: 'center', gap: 22, padding: '0 30px'}}>
      {icon}
      <span style={{fontFamily: SANS, fontWeight: 800, fontSize: 50, letterSpacing: '-0.03em', color: INK, whiteSpace: 'nowrap'}}>{label}</span>
    </div>
  </Rise>
);
const S7: React.FC<SceneProps> = ({t}) => (
  <>
    <Title t={t} at={w0(92) - 0.05} lines={['Zernio']} size={140} />
    <Rise t={t} at={w0(90) + 0.2} x={1090} y={300} dy={50} dx={60}><Tile name="zernio.png" size={200} /></Rise>
    <Chan t={t} at={w0(93)} x={150} y={520} icon={<Brand name="instagram" size={110} />} label="Директ" />
    <Chan t={t} at={w0(94)} x={740} y={520} icon={<svg width={110} height={110} viewBox="0 0 24 24" style={{flex: 'none'}}><path d="M3 4h18v12H9l-5 4v-4H3z" fill={INK} /></svg>} label="Комментарии" />
    <Chan t={t} at={w0(96)} x={150} y={740} icon={<Brand name="whatsapp" size={110} />} label="WhatsApp" />
    <Chan t={t} at={w0(98)} x={740} y={740} icon={<Brand name="telegram" size={110} />} label="Telegram" />
  </>
);

// ——— 09 ЗАЯВКИ. «Claude отвечает клиентам и собирает заявки, пока ты занят другим» ———
const REPLY = 'Добрый день! Пришлю цены и запишу вас.';
const S8: React.FC<SceneProps> = ({t}) => {
  const typed = Math.round(REPLY.length * k(t, w0(100), w0(100) + 1.0, (v) => v));
  const leads = [w0(103) + 0.05, w0(104) + 0.05, w0(104) + 0.4];
  const count = leads.filter((a) => t >= a).length, pop = Math.max(0, ...leads.map((a) => k(t, a, a + 0.12) * (1 - k(t, a + 0.12, a + 0.4))));
  return (
    <>
      <Rise t={t} at={w0(99)} x={150} y={330} w={700} h={700} dy={80}>
        <div style={{...cardStyle(34), width: 700, height: 700, overflow: 'hidden'}}>
          <div style={{height: 84, display: 'flex', alignItems: 'center', gap: 18, padding: '0 32px', boxSizing: 'border-box', background: '#F1F2F4'}}>
            <Brand name="instagram" size={48} /><span style={{fontFamily: MONO, fontWeight: 700, fontSize: 43, color: INK}}>Директ</span>
          </div>
          <div style={{padding: '30px 32px', display: 'flex', flexDirection: 'column', gap: 26}}>
            <div style={{width: 400, padding: '26px 30px', borderRadius: 30, background: '#F1F2F4', display: 'flex', flexDirection: 'column', gap: 16}}><Skel w={320} h={22} c="#D5D9DE" /><Skel w={220} h={22} c="#D5D9DE" /></div>
            {t >= w0(100) ? (
              <div style={{alignSelf: 'flex-end', width: 580, padding: '22px 28px', borderRadius: 30, background: INK, color: '#FFFFFF', boxSizing: 'border-box'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12}}><Brand name="claude" size={44} style={{borderRadius: 12}} /><span style={{fontFamily: MONO, fontWeight: 700, fontSize: 43, color: MINT}}>Claude</span></div>
                <div style={{fontFamily: SANS, fontWeight: 700, fontSize: 44, lineHeight: 1.3, minHeight: 172}}>{REPLY.slice(0, typed)}</div>
              </div>
            ) : null}
          </div>
        </div>
      </Rise>
      <Rise t={t} at={w0(103)} x={890} y={330} w={400} h={560} dy={80}>
        <div style={{...cardStyle(34), width: 400, height: 560, position: 'relative'}}>
          <span style={{position: 'absolute', left: 30, top: 24, fontFamily: MONO, fontWeight: 700, fontSize: 43, color: MUTE}}>заявки</span>
          <span style={{position: 'absolute', left: 30, top: 64, fontFamily: NUM, fontWeight: 900, fontSize: 250, lineHeight: 1, letterSpacing: '-0.04em', color: OR, transform: `scale(${1 + 0.12 * pop})`, transformOrigin: 'left center'}}>{count}</span>
          {[0, 1, 2].map((i) => {
            const a = k(t, leads[i], leads[i] + 0.3, E.out);
            return (
              <div key={i} style={{position: 'absolute', left: 30, top: 340 + i * 68, width: 340, height: 56, borderRadius: 28, background: '#F1F2F4', display: 'flex', alignItems: 'center', gap: 14, padding: '0 14px',
                opacity: a, transform: `translateX(${(1 - a) * 40}px)`}}>
                <span style={{width: 34, height: 34, borderRadius: '50%', background: MINT, flex: 'none'}} /><Skel w={190} h={18} c="#D5D9DE" />
              </div>
            );
          })}
        </div>
      </Rise>
      <Chip t={t} at={w0(107)} x={890} y={930} label="ты занят" size={48} />
    </>
  );
};

// ——— 10 MCP-СЕРВЕРЫ. «Третий бесплатные MCP серверы с открытым кодом для amoCRM и Bitrix» ———
const S9: React.FC<SceneProps> = ({t}) => {
  const scroll = 330 * k(t, 40.9, 43.1, E.inOut), reveal = k(t, w0(120), w0(120) + 0.5, E.inOut);
  const url = t < w0(120) ? 'github.com/cAIborg-ai/amocrm-mcp' : 'github.com/kartochka/bitrix24-mcp';
  return (
    <>
      <Title t={t} at={w0(112)} lines={['MCP-серверы']} size={130} />
      <Chip t={t} at={w0(111)} x={1110} y={338} label="$0" tone="orange" size={56} />
      <Win t={t} at={w0(109)} x={150} y={480} w={1140} h={600} url={url} lock name="mcp">
        <Img src={staticFile(P('gh-amocrm-mcp.png'))} style={{position: 'absolute', left: 0, top: -scroll, width: 1140, height: 1781}} />
        <div style={{position: 'absolute', left: 0, top: 0, width: 1140, height: 520, clipPath: `inset(0 0 0 ${(1 - reveal) * 100}%)`}}>
          <Img src={staticFile(P('gh-bitrix24-mcp.png'))} style={{position: 'absolute', left: 0, top: -330, width: 1140, height: 1781}} />
        </div>
      </Win>
      <Chip t={t} at={w0(116)} x={1270} y={566} anchor="right" label="открытый код" tone="mint" size={48} />
      <Chip t={t} at={w0(118)} x={190} y={566} label="amoCRM" logo="amocrm.png" size={48} dx={-60} />
      <Chip t={t} at={w0(120)} x={250} y={676} label="Bitrix24" logo="bitrix24" size={48} dx={-60} />
    </>
  );
};

// ——— 11 СДЕЛКИ. «Ставишь к своей CRM и Claude видит сделки, воронку, на каком этапе застревают клиенты и у какого менеджера» ———
const STAGES = ['заявка', 'встреча', 'договор', 'оплата'], PER = [3, 3, 2, 1], FUN = [100, 78, 56, 34];
const S10: React.FC<SceneProps> = ({t}) => {
  const stuck = k(t, w0(133), w0(133) + 0.35, E.pop), mgr = k(t, w0(138) - 0.1, w0(138) + 0.3, E.pop);
  return (
    <>
      <Title t={t} at={w0(123) - 0.05} lines={['Своя CRM']} size={120} />
      <Rise t={t} at={w0(124)} x={800} y={318} dy={40}><Tile name="amocrm.png" size={110} r={28} /></Rise>
      <Rise t={t} at={w0(124) + 0.15} x={925} y={318} dy={40}><Tile name="bitrix24" size={110} r={28} /></Rise>
      <Wire t={t} a={w0(126)} b={w0(126) + 0.4} d="M1050,373 L1130,373" width={7} />
      <Rise t={t} at={w0(126)} x={1140} y={313} dy={40} dx={50}><Tile name="claude" size={120} r={30} /></Rise>
      <Rise t={t} at={w0(121)} x={150} y={480} w={1140} h={590} dy={80}>
        <div style={{...cardStyle(34), width: 1140, height: 590, position: 'relative', overflow: 'hidden'}}>
          {STAGES.map((st, c) => {
            const x = 40 + c * 270, bad = c === 1;
            return (
              <div key={st} style={{position: 'absolute', left: x, top: 0, width: 250, height: 590}}>
                {bad && stuck > 0 ? <div style={{position: 'absolute', left: -10, top: 12, width: 270, height: 540, borderRadius: 24, border: `5px dashed ${RED}`, opacity: Math.min(1, stuck)}} /> : null}
                <span style={{position: 'absolute', left: 6, top: 26, fontFamily: MONO, fontWeight: 700, fontSize: 43, color: bad && stuck > 0.5 ? RED : INK, whiteSpace: 'nowrap'}}>{st}</span>
                <span style={{position: 'absolute', left: 6, top: 92, height: 16, borderRadius: 8, background: MINT, width: 238 * (FUN[c] / 100) * k(t, w0(129) + c * 0.1, w0(129) + c * 0.1 + 0.5, E.out)}} />
                {Array.from({length: PER[c]}, (_, r) => {
                  const a = k(t, w0(128) + c * 0.18 + r * 0.1, w0(128) + c * 0.18 + r * 0.1 + 0.4, E.out), isMgr = c === 1 && r === 1;
                  return (
                    <div key={r} style={{position: 'absolute', left: 6, top: 132 + r * 122, width: 238, height: 108, borderRadius: 22, background: '#F6F7F8', boxShadow: '0 0 0 2px rgba(17,19,22,.06)', display: 'flex', alignItems: 'center',
                      gap: 14, padding: '0 16px', boxSizing: 'border-box', opacity: a, transform: `translateY(${(1 - a) * 30}px)`}}>
                      <span style={{width: 56, height: 56, borderRadius: '50%', background: '#E1E4E8', display: 'grid', placeItems: 'center', flex: 'none',
                        outline: isMgr && mgr > 0 ? `${6 * Math.min(1, mgr)}px solid ${OR}` : 'none'}}><Person size={38} fg={isMgr && mgr > 0 ? OR : '#8A9096'} /></span>
                      <span style={{display: 'flex', flexDirection: 'column', gap: 12}}><Skel w={110} h={18} c="#D5D9DE" /><Skel w={70} h={18} c="#E4E7EA" /></span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </Rise>
      <Wire t={t} a={w0(138) - 0.1} b={w0(138) + 0.3} d="M504,800 C540,850 570,880 610,900" width={6} />
      <Chip t={t} at={w0(138)} x={620} y={868} label="менеджер" size={48} />
      <Chip t={t} at={w0(133) + 0.1} x={460} y={985} label="застряли" tone="ink" size={43} />
    </>
  );
};

// ——— 12 СВОДКА. «А теперь финальный коннектор, который сведёт все показатели воедино» ———
const bez = (p: number, a: [number, number], b: [number, number], c: [number, number], d: [number, number]): [number, number] => {
  const u = 1 - p;
  return [u * u * u * a[0] + 3 * u * u * p * b[0] + 3 * u * p * p * c[0] + p * p * p * d[0], u * u * u * a[1] + 3 * u * u * p * b[1] + 3 * u * p * p * c[1] + p * p * p * d[1]];
};
const S11: React.FC<SceneProps> = ({t}) => {
  const tiles: [string, number][] = [['pipeboard.png', 300], ['zernio.png', 720], ['amocrm.png', 1140]];
  const land = k(t, 54.0, 54.35, E.pop), done = k(t, w0(147), w0(147) + 0.3);
  return (
    <>
      <Title t={t} at={w0(141)} lines={['Финальный']} size={110} />
      {tiles.map(([n, cx], i) => (
        <Rise key={n} t={t} at={w0(140) + i * 0.18} x={cx - 85} y={480} dy={50}>
          <div style={{position: 'relative'}}>
            <Tile name={n} size={170} />
            {i === 2 ? <div style={{position: 'absolute', right: -22, bottom: -22}}><Tile name="bitrix24" size={80} r={22} /></div> : null}
          </div>
        </Rise>
      ))}
      {tiles.map(([, cx], i) => {
        const d = `M${cx},650 C${cx},725 720,725 720,800`;
        const p = k(t, w0(146) + i * 0.1, 54.3, E.inOut), dot = bez(p, [cx, 650], [cx, 725], [720, 725], [720, 800]);
        return (
          <div key={i}>
            <Wire t={t} a={w0(144)} b={w0(144) + 0.6} d={d} color={MINT_DK} width={7} />
            {p > 0 && p < 1 ? <span style={{position: 'absolute', left: dot[0] - 16, top: dot[1] - 16, width: 32, height: 32, borderRadius: '50%', background: OR, boxShadow: '0 0 0 6px rgba(255,122,47,.25)'}} /> : null}
          </div>
        );
      })}
      <div style={{position: 'absolute', left: 595, top: 800, width: 250, height: 250, borderRadius: 66, border: `5px dashed ${MUTE}`, opacity: k(t, w0(144), w0(144) + 0.3) * (1 - land), boxSizing: 'border-box'}} />
      <Rise t={t} at={54.0} x={595} y={800} dy={30}>
        <div style={{transform: `scale(${1 + 0.06 * done * (1 - k(t, w0(147) + 0.3, w0(147) + 0.7))})`}}><Tile name="metabase" size={250} /></div>
      </Rise>
      <ClickSpark t={t} at={w0(147)} x={720} y={925} color={MINT_DK} n={10} radius={190} size={46} />
    </>
  );
};

// ——— 13 METABASE. «Это Metabase, дашборд из Power BI» ———
const S12: React.FC<SceneProps> = ({t}) => {
  const pan = 107 * k(t, 56.0, 57.6, E.inOut);
  return (
    <>
      <Rise t={t} at={w0(148)} x={150} y={300} dy={50}><Tile name="metabase" size={150} r={36} /></Rise>
      <Title t={t} at={w0(149)} lines={['Metabase']} size={130} x={330} y={310} w={620} />
      <Chip t={t} at={w0(152)} x={1290} y={338} anchor="right" label="Power BI" logo="powerbi" size={44} />
      <Win t={t} at={w0(150)} x={150} y={490} w={1140} h={590} url="Metabase" name="meta">
        <Img src={staticFile(P('metabase-dashboard.png'))} style={{position: 'absolute', left: 0, top: -pan, width: 1140, height: 627}} />
      </Win>
    </>
  );
};

// ——— 14 ЗАПРОСЫ. «Claude сам собирает отчёты, окупаемость рекламы, воронки по источникам, какие клиенты приносят больше всего денег» ———
// Камера идёт по настоящему дашборду Metabase: ключ [секунда начала переезда, x, y, ширина кадра] в пикселях снимка 2510×1380.
const IW = 2510, CAM: [number, number, number, number][] = [[0, 0, 0, 2510], [58.6, 20, 20, 1700], [59.06, 20, 540, 1700], [60.14, 560, 40, 1100], [61.5, 1688, 130, 822]];
const camAt = (t: number) => {
  let c = CAM[0].slice(1) as number[];
  for (let i = 1; i < CAM.length; i++) {
    if (t >= CAM[i][0]) { const p = k(t, CAM[i][0], CAM[i][0] + 0.55, E.inOut), a = CAM[i - 1]; c = [a[1] + (CAM[i][1] - a[1]) * p, a[2] + (CAM[i][2] - a[2]) * p, a[3] + (CAM[i][3] - a[3]) * p]; }
  }
  return c;
};
const S13: React.FC<SceneProps> = ({t}) => {
  const [cx, cy, cw] = camAt(t), sc = 1140 / cw;
  const chips: [string, number, number][] = [['отчёты', w0(157), w0(158)], ['окупаемость рекламы', w0(158), w0(160)], ['воронки по источникам', w0(160), w0(163)], ['кто приносит деньги', w0(163), 99]];
  return (
    <>
      <Title t={t} at={w0(155)} lines={['Claude собирает']} size={100} />
      <Win t={t} at={w0(154)} x={150} y={450} w={1140} h={620} url="Metabase" name="ask">
        <Img src={staticFile(P('metabase-dashboard.png'))} style={{position: 'absolute', left: -cx * sc, top: -cy * sc, width: IW * sc, height: 1380 * sc, maxWidth: 'none'}} />
      </Win>
      {chips.map(([lb, at, out]) => <Chip key={lb} t={t} at={at} out={out} x={180} y={566} label={lb} tone="orange" size={48} id={`ask:${lb}`} />)}
      <ClickSpark t={t} at={w0(168)} x={1000} y={620} color={OR} n={9} radius={110} size={40} />
    </>
  );
};

// ——— 15 ПРИЗЫВ. «Напиши в комментариях «деньги», все 4 коннектора со ссылками и инструкцией пришлю в директ» ———
const S14: React.FC<SceneProps> = ({t}) => {
  const word = 'деньги', typed = Math.round(word.length * k(t, w0(172), w0(172) + 0.45, (v) => v)), posted = k(t, w0(172) + 0.55, w0(172) + 0.85, E.pop);
  const fly = k(t, w0(183) - 0.1, w0(183) + 0.5, E.inOut);
  return (
    <>
      <Title t={t} at={w0(169)} lines={['Напиши']} size={110} />
      <Rise t={t} at={w0(171)} x={150} y={470} w={1140} h={130} dy={60}>
        <div style={{...cardStyle(65), width: 1140, height: 130, display: 'flex', alignItems: 'center', gap: 20, padding: '0 40px', boxSizing: 'border-box', position: 'relative'}}>
          <span style={{fontFamily: SANS, fontWeight: 700, fontSize: 56, color: typed ? INK : '#9AA0A8', flex: 1, whiteSpace: 'nowrap'}}>
            {typed ? `«${word.slice(0, typed)}${typed === word.length ? '»' : ''}` : 'Добавить комментарий…'}
          </span>
          <span style={{display: 'grid', placeItems: 'center', width: 88, height: 88, borderRadius: '50%', background: posted > 0 ? MINT : '#E4E7EA', transform: `scale(${1 + 0.1 * posted * (1 - k(t, w0(172) + 0.85, w0(172) + 1.1))})`}}>
            <svg width={44} height={44} viewBox="0 0 24 24"><path d="M12 19 V5 M5 12 L12 5 L19 12" fill="none" stroke={posted > 0 ? MINT_INK : '#FFFFFF'} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        </div>
      </Rise>
      <Rise t={t} at={w0(174)} x={150} y={650} w={1140} h={410} dy={80}>
        <div style={{...cardStyle(36), width: 1140, height: 410, position: 'relative', overflow: 'hidden'}}>
          <div style={{height: 84, display: 'flex', alignItems: 'center', gap: 18, padding: '0 36px', boxSizing: 'border-box', background: '#F1F2F4'}}>
            <Brand name="instagram" size={48} /><span style={{fontFamily: MONO, fontWeight: 700, fontSize: 43, color: INK}}>Директ</span>
          </div>
        </div>
      </Rise>
      {['pipeboard.png', 'zernio.png', 'amocrm.png', 'metabase'].map((n, i) => (
        <Rise key={n} t={t} at={w0(175) + i * 0.16} x={190 + i * 175} y={790} dy={60}><Tile name={n} size={160} r={38} /></Rise>
      ))}
      <Chip t={t} at={w0(178)} x={190} y={970} label="ссылки" tone="ink" size={43} />
      <Chip t={t} at={w0(180)} x={470} y={970} label="инструкция" size={43} />
      {fly > 0 && fly < 1 ? (
        <div style={{position: 'absolute', left: 1030 - 120 * fly, top: 520 + 250 * fly, opacity: 1 - 0.4 * fly, transform: `rotate(${20 + 50 * fly}deg) scale(${1.1 - 0.3 * fly})`}}><Plane size={90} /></div>
      ) : null}
      <Rise t={t} at={w0(183)} x={1290} y={790} anchor="right" dy={0}>
        <div style={{display: 'flex', alignItems: 'center', gap: 16, height: 120, padding: '0 36px', borderRadius: 60, background: MINT, color: MINT_INK, fontFamily: SANS, fontWeight: 800, fontSize: 52, whiteSpace: 'nowrap', boxShadow: '0 18px 36px rgba(61,237,195,.35)'}}>
          <CheckBadge size={56} bg="#FFFFFF" p={k(t, w0(183) + 0.1, w0(183) + 0.5)} />в директ
        </div>
      </Rise>
      <ClickSpark t={t} at={w0(172) + 0.55} x={1190} y={535} color={OR} n={9} radius={90} size={36} />
    </>
  );
};

const SCENES: Record<string, React.FC<SceneProps>> = {hook: S0, plug: S1, send: S2, years: S3, four: S4, pipe: S5, ads: S6, zern: S7, chat: S8, mcp: S9, deals: S10, merge: S11, meta: S12, ask: S13, cta: S14};
const LABELS: Record<string, string> = {hook: 'ЧАТ ЗА $20', plug: 'ПОДКЛЮЧИ', send: 'СКИНЬ', years: '4 ГОДА', four: 'КОННЕКТОРЫ', pipe: '01 PIPEBOARD', ads: 'РЕКЛАМА', zern: '02 ZERNIO', chat: 'ЗАЯВКИ', mcp: '03 MCP', deals: 'СДЕЛКИ', merge: 'СВОДКА', meta: '04 METABASE', ask: 'ОТЧЁТЫ', cta: 'ДЕНЬГИ'};
const STYLE = makeStyle(SCENES, LABELS, ['left', 'up', 'right']);

const PROJECT = {
  duration: META.dur, words: WORDS, sfx: false,
  blocks: [blk('hook', 0), blk('plug', 3.4), blk('send', 9.1), blk('years', 12.2), blk('four', 14.1), blk('pipe', 19.45), blk('ads', 23.6), blk('zern', 31.5), blk('chat', 35.3), blk('mcp', 39.05),
    blk('deals', 43.8), blk('merge', 50.65), blk('meta', 55.1), blk('ask', 57.65), blk('cta', 64.0)],
  speaker: REC ? {src: REC, muted: true, w: 1080, h: 1920, headY: 886} : undefined,
};

// Звуки: эффекты из public/sfx ×0,37 (внутри Sfx). Привязаны к словам, стыкам, нажатиям и счётчикам.
const CUES: Cue[] = [
  [0.05, 'sub-hit', 0.2], [0.45, 'ui-pop', 0.2], [w0(10), 'ui-tap', 0.2],
  [3.35, 'whoosh', 0.26], [w0(15), 'ui-glass', 0.2], [w0(17), 'ui-pop', 0.2], [w0(19), 'ui-pop', 0.2], [w0(21), 'ui-pop', 0.2], [w0(25), 'transform', 0.2], [w0(28), 'snap', 0.2], [w0(28) + 0.22, 'snap', 0.2], [w0(29), 'snap', 0.2],
  [9.05, 'whoosh-sharp', 0.26], [w0(30), 'ui-slide', 0.2], [w0(32), 'ui-pop', 0.2], [10.2, 'ui-click', 0.22], [10.3, 'whoosh', 0.18], [w0(39), 'ui-glass', 0.18],
  [12.15, 'blur', 0.26], [w0(42), 'counter', 0.2], [w0(45), 'ui-tap', 0.2], [w0(47), 'ui-pop', 0.2],
  [14.05, 'whoosh', 0.26], [w0(49), 'ui-slide', 0.2], [w0(51), 'ui-pop', 0.2], [w0(51) + 0.22, 'ui-pop', 0.2], [w0(51) + 0.44, 'ui-pop', 0.2], [w0(51) + 0.66, 'ui-pop', 0.2], [w0(59), 'tick-soft', 0.2], [w0(61), 'ding', 0.2],
  [19.4, 'zoom', 0.26], [w0(62), 'ui-slide', 0.2], [w0(64), 'ui-glass', 0.2], [w0(67), 'ui-pop', 0.18], [w0(68), 'ui-pop', 0.18], [w0(69), 'ui-pop', 0.18], [w0(71), 'ui-pop', 0.18],
  [23.55, 'whoosh-sharp', 0.26], [w0(74), 'ui-tap', 0.2], [w0(75), 'ui-tap', 0.2], [w0(77), 'ui-tap', 0.2], [w0(82), 'switch', 0.24], [w0(86), 'ui-pop', 0.2], [w0(87), 'ui-pop', 0.2], [w0(88), 'sub-hit', 0.26], [w0(89), 'snap', 0.22],
  [31.45, 'whoosh', 0.26], [w0(92), 'ui-glass', 0.2], [w0(93), 'ui-pop', 0.2], [w0(94), 'ui-pop', 0.2], [w0(96), 'ui-pop', 0.2], [w0(98), 'ui-pop', 0.2],
  [35.25, 'blur', 0.26], [w0(100), 'typing', 0.16], [w0(103), 'counter', 0.2], [w0(104), 'counter', 0.2], [w0(107), 'ui-glass', 0.2],
  [39.0, 'whoosh-sharp', 0.26], [w0(111), 'ui-pop', 0.2], [w0(112), 'ui-slide', 0.2], [w0(116), 'ui-tap', 0.2], [w0(118), 'ui-pop', 0.2], [w0(120), 'ui-pop', 0.2],
  [43.75, 'whoosh', 0.26], [w0(128), 'ui-slide', 0.2], [w0(129), 'ui-soft', 0.2], [w0(133), 'switch', 0.22], [w0(138), 'ui-glass', 0.22],
  [50.6, 'zoom', 0.26], [w0(141), 'ui-slide', 0.2], [w0(142), 'ui-pop', 0.18], [w0(144), 'riser', 0.16], [w0(147), 'flash', 0.22],
  [55.05, 'blur', 0.26], [w0(149), 'ui-glass', 0.2], [w0(152), 'ui-pop', 0.2],
  [57.6, 'whoosh', 0.26], [w0(157), 'ui-tap', 0.2], [w0(158), 'ui-tap', 0.2], [w0(160), 'ui-tap', 0.2], [w0(163), 'ui-tap', 0.2], [w0(168), 'ding', 0.2],
  [63.95, 'whoosh-sharp', 0.26], [w0(171), 'ui-slide', 0.18], [w0(172), 'typing', 0.2], [w0(172) + 0.55, 'ui-click', 0.22], [w0(175), 'ui-pop', 0.18], [w0(175) + 0.16, 'ui-pop', 0.18], [w0(175) + 0.32, 'ui-pop', 0.18], [w0(175) + 0.48, 'ui-pop', 0.18],
  [w0(180), 'ui-glass', 0.2], [w0(183), 'ding', 0.24],
];

export const ReelRM20: React.FC = () => (
  <>
    <StyleReel format="reels" style={STYLE} project={PROJECT} />
    <Voice src={REC} />
    <Sfx cues={CUES} />
  </>
);
