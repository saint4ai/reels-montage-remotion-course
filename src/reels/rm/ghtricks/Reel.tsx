import React from 'react';
import {Img, staticFile} from 'remotion';
import {E, k} from '../../../montage/parts';
import {Bar, BrandMask as Brand, Cap, type Cam, Check, Dot, glass, type LensMove, PrintTitle, TONE} from '../../../kit/lens';
import {countUp} from '../../../kit/reactbits';
import META from '../../../../public/rm/ghtricks/meta.json';
import {autoBlobs, Burst, type CurPt, IcoX, INK, lerp, LensReel, LowPlace, lowCamera, MINT, MINT_D, MONO, NumDot, Pointer, Shot, SANS, SOYUZ, sp, UrlCard} from '../lensLow';
import {T, TE, WORDS} from './words';

// «Трюки со ссылками GitHub», перемонтаж 10.10.2026 в стиле C ЛИНЗА (было: A ЭСТАФЕТА 35%). Карта: patterns/reels/lens-ghtricks/DIRECTION.md.
// Холст с линзой идёт на весь кадр, по нему едет камера между 12 станциями. Предмет-эстафета: адресная строка, в ней меняется одно слово
// (hub → diagram → ingest → deepwiki). Запись альбомная 1920×1080 стоит внизу карточкой, голова целиком.
export const FPS_RM_GH = 60;
export const DUR_RM_GH = META.dur;

const K = {
  s1: [0, 0], s2: [1500, -120], s3: [1500, 1230], s4: [0, 1300], s5: [-1450, 1250], s6: [-1450, -100],
  s7: [-1450, -1450], s8: [0, -1400], s9: [1450, -1450], s10: [1450, -2800], s11: [0, -2800], s12: [-1450, -2750],
} as const;
type KK = keyof typeof K;
// проезды камеры в паузах между фразами
const MOVES: LensMove<KK>[] = [
  {a: 3.95, b: 4.65, from: 's1', to: 's2', z: 0.86},    // «Открываешь чужой репозиторий»
  {a: 7.5, b: 8.15, from: 's2', to: 's3', z: 0.86},     // «Пишешь вместо hub»
  {a: 10.3, b: 10.95, from: 's3', to: 's4', z: 0.86},   // «GitDiagram рисует схему»
  {a: 14.55, b: 15.2, from: 's4', to: 's5', z: 0.88},   // «Кликаешь по блоку»
  {a: 16.95, b: 17.55, from: 's5', to: 's6', z: 0.88},  // «А ещё видео»
  {a: 20.25, b: 20.9, from: 's6', to: 's7', z: 0.86},   // «Второй трюк»
  {a: 22.95, b: 23.55, from: 's7', to: 's8', z: 0.86},  // «Git ingest собирает»
  {a: 27.9, b: 28.5, from: 's8', to: 's9', z: 0.86},    // «Вставляешь в Claude»
  {a: 33.0, b: 33.65, from: 's9', to: 's10', z: 0.86},  // «И третий»
  {a: 41.2, b: 41.8, from: 's10', to: 's11', z: 0.88},  // «Скинь это»
  {a: 43.45, b: 44.05, from: 's11', to: 's12', z: 0.9}, // «Напиши GitHub»
];
const camera = lowCamera(K, MOVES, 's1');
const ND = T('нарисуется');
const HOOK = ['github', 'gitdiagram', 'gitingest', 'deepwiki', 'gitdiagram'], HOOK_AT = [0.6, 1.3, 2.0, 2.75];
const BLOBS = autoBlobs(K);
const num = (s: string, size = 40, color = INK) => <span style={{fontFamily: SOYUZ, fontWeight: 700, fontSize: size, color}}>{s}</span>;

// хук: четыре знака сервисов под адресной строкой, активный совпадает с перебираемым словом; к «нарисуется схемой» уходят
const LOGO_ORDER = ['github', 'gitdiagram', 'gitingest', 'deepwiki'];
const HookLogos: React.FC<{t: number}> = ({t}) => {
  let word = HOOK[0];
  HOOK_AT.forEach((a, i) => { if (t >= a) word = HOOK[i + 1]; });
  const idx = LOGO_ORDER.indexOf(word), s = 112, o = 1 - k(t, ND - 0.35, ND - 0.05, E.inOut);
  if (o <= 0) return null;
  const logos = [
    <Dot key={0} tone="ink" s={s}><Brand name="github" w={58} /></Dot>,
    <Dot key={1} tone="white" s={s}><Img src={staticFile('brand/gitdiagram.png')} style={{width: 62, height: 62}} /></Dot>,
    <Dot key={2} tone="white" s={s}><Img src={staticFile('brand/gitingest.svg')} style={{width: 62, height: 62}} /></Dot>,
    <Dot key={3} tone="ink" s={s}><Brand name="deepwiki" w={58} /></Dot>,
  ];
  return (
    <div style={{display: 'flex', gap: 44, opacity: o, transform: `translateY(${(1 - o) * -20}px)`}}>
      {logos.map((l, i) => (
        <div key={i} style={{transform: `scale(${i === idx ? 1.2 : 0.92})`, borderRadius: s, opacity: i === idx ? 1 : 0.55, boxShadow: i === idx ? `0 0 0 5px ${MINT}, 0 0 34px rgba(61,237,195,.6)` : undefined}}>{l}</div>
      ))}
    </div>
  );
};

// карточка файла: на неё переворачивается блок схемы (клик по блоку → нужный файл)
const FileCard: React.FC<{t: number; at: number}> = ({t, at}) => {
  const rows = [{w: 0.5, c: MINT}, {w: 0.78, c: 'rgba(255,255,255,.35)'}, {w: 0.62, c: 'rgba(255,255,255,.35)'}, {w: 0.7, c: MINT}, {w: 0.44, c: 'rgba(255,255,255,.35)'}, {w: 0.66, c: 'rgba(255,255,255,.25)'}, {w: 0.52, c: 'rgba(255,255,255,.25)'}];
  return (
    <div style={{width: 788, height: 484, borderRadius: 34, boxSizing: 'border-box', padding: '30px 40px', background: 'linear-gradient(160deg, #2B3036, #0E0F11)',
      border: '2px solid rgba(255,255,255,.14)', boxShadow: '0 40px 90px rgba(14,15,17,.3)'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 16}}><IcoX name="file" s={54} c={MINT} /><span style={{fontFamily: MONO, fontWeight: 700, fontSize: 48, color: '#FFFFFF'}}>llm.py</span></div>
      <div style={{marginTop: 24, display: 'flex', flexDirection: 'column', gap: 14}}>
        {rows.map((r, i) => (
          <div key={i} style={{display: 'flex', alignItems: 'center', gap: 14, padding: '6px 10px', borderRadius: 10, opacity: k(t, at + i * 0.06, at + i * 0.06 + 0.2),
            background: i === 3 ? 'rgba(61,237,195,.22)' : undefined}}>
            <div style={{width: 34, height: 14, borderRadius: 7, background: 'rgba(255,255,255,.22)'}} />
            <div style={{width: r.w * 520, height: 18, borderRadius: 9, background: r.c}} />
          </div>
        ))}
      </div>
    </div>
  );
};

const FOLDERS = [
  {n: '.github', x: -410, y: -270, r: -5}, {n: 'examples', x: -430, y: -90, r: 4}, {n: 'plugins', x: -405, y: 90, r: -3}, {n: 'scripts', x: -430, y: 270, r: 5},
];
const GROUPS: {b: [number, number, number, number]; a: number; z: number}[] = [
  {b: [150, 421, 362, 306], a: T('каких'), z: T('каких') + 0.6}, {b: [547, 466, 355, 213], a: T('каких') + 0.6, z: T('как') + 0.0}, {b: [933, 394, 357, 333], a: T('как'), z: T('связаны') + 0.2},
];
const FLOW: [number, number, number][] = [[636, 306, 500], [814, 306, 500], [1200, 306, 520]];
const TREE = ['anthropics-claude-code/', '├── README.md', '├── CLAUDE.md', '├── LICENSE.md', '├── SECURITY.md', '├── examples/'];
const ARM = [0, 1, 2, 3, 4];

const Stations: React.FC<{t: number; fps: number; cam: Cam}> = ({t, fps, cam}) => {
  const P = (kk: KK, x: number, y: number, node: React.ReactNode, key: string, depth?: number) =>
    <LowPlace key={key} cam={cam} x={K[kk][0] + x} y={K[kk][1] + y} depth={depth}>{node}</LowPlace>;
  const S = (a: number, d = 16, s = 140) => sp(t, a - 0.08, fps, d, s);
  const Pp = (a: number) => sp(t, a - 0.08, fps, 11, 170);

  // --- s1: хук с кадра 0, «если заменить на GitHub одно слово, весь проект нарисуется схемой» ---
  const settle = 1 + 0.045 * (1 - k(t, 0, 0.7));
  const nd = ND;
  const kidA = [nd + 0.3, T('схемой'), T('схемой') + 0.22];
  const treeDraw = kidA.map((a) => k(t, a - 0.05, a + 0.4, E.inOut));
  // --- s2 ---
  const folderAt = T('сотня');
  const hund = countUp(t, folderAt, 0.7, 100);
  // --- s3 ---
  const enter = T('Enter');
  const pressEnter = k(t, enter - 0.04, enter + 0.1, E.out) * (1 - k(t, enter + 0.14, enter + 0.4));
  // --- s4 ---
  const star1 = countUp(t, T('Git'), 1.1, 178);
  const draw = k(t, T('рисует') - 0.1, T('схему') + 0.7, E.inOut);
  // --- s5 ---
  const flip = k(t, T('попадаешь') - 0.1, T('нужный') + 0.05, E.inOut);
  const ptsA: CurPt[] = [{t: T('Кликаешь') - 0.05, x: 640, y: 80}, {t: T('блоку') + 0.05, x: 196, y: 362}];
  const clickA = T('блоку') + 0.12;
  // --- s6 ---
  const playAt = T('минутное');
  const prog = k(t, playAt + 0.2, T('проект', 2) + 0.2, (v) => v);
  // --- s8 ---
  const star2 = countUp(t, T('Git', 1), 1.1, 158);
  const gather = k(t, T('весь', 1) - 0.1, T('1') + 0.2, E.inOut);
  const treeN = Math.round(TREE.length * k(t, T('структуру'), T('содержимое') - 0.1, (v) => v));
  const files = countUp(t, T('содержимое'), 0.7, 1510), tokens = countUp(t, T('содержимое') + 0.25, 0.7, 558);
  // --- s9 ---
  const think = k(t, T('понимает'), T('проект', 4) + 0.15, E.inOut);
  const strike = k(t, T('полчаса') + 0.05, T('полчаса') + 0.4, E.inOut);
  // --- s10 ---
  const tocRows = [0, 1, 2, 3, 4, 5];
  const typed = 'Как всё работает?', typedN = Math.round(typed.length * k(t, T('спросить'), T('работает') + 0.15, (v) => v));
  // --- s11 ---
  const flight = k(t, T('тому') - 0.1, T('копается') + 0.2, E.inOut);
  // --- s12 ---
  const word = 'GitHub', wn = Math.min(word.length, Math.floor(k(t, T('GitHub', 2) - 0.05, T('GitHub', 2) + 0.4, (v) => v) * (word.length + 0.99)));
  const fan = (i: number) => sp(t, T('пришлю') + i * 0.07, fps, 13, 150);

  return (
    <>
      {/* ═══ s1. «Мало кто знал, но если заменить на GitHub одно слово, то весь проект нарисуется схемой» ═══ */}
      {P('s1', 0, -440, <div style={{transform: `scale(${settle})`}}><PrintTitle t={t} size={176} words={[{s: 'Одно', at: -1}, {s: 'слово', at: -1}]} /></div>, 'h1')}
      {P('s1', 0, -150, <UrlCard t={t} a={1} start="github" hlFrom={0.1} size={104}
        swaps={HOOK_AT.map((at, i) => ({at, to: HOOK[i + 1]}))} />, 'u1')}
      {P('s1', 0, 140, <HookLogos t={t} />, 'logos')}
      {P('s1', 0, 195, (
        <div style={{position: 'relative', width: 1000, height: 360}}>
          <svg width={1000} height={360} style={{position: 'absolute', left: 0, top: 0}}>
            {[56, 180, 304].map((y, i) => (
              <path key={i} d={`M400 180 H458 V${y} H520`} fill="none" stroke={MINT_D} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${treeDraw[i]} 2`} />
            ))}
          </svg>
          <div style={{position: 'absolute', left: 200, top: 180, transform: 'translate(-50%,-50%)'}}>
            <Cap in="pop" a={Pp(nd)} h={112} dot={<Dot tone="ink" s={86}><Brand name="github" w={46} /></Dot>} label="claude-code" />
          </div>
          {[{y: 56, n: 'Telemetry', ic: 'bolt', tone: 'orange'}, {y: 180, n: 'Hook Plugins', ic: 'chip', tone: 'mint'}, {y: 304, n: 'Git Diff', ic: 'code', tone: 'ink'}].map((c, i) => (
            <div key={c.n} style={{position: 'absolute', left: 520, top: c.y, transform: 'translateY(-50%)'}}>
              <Cap in="left" a={Pp(kidA[i])} h={100} dot={<Dot tone={c.tone as 'orange' | 'mint' | 'ink'} s={76}><IcoX name={c.ic} s={40} c={c.tone === 'mint' ? '#05231D' : '#FFFFFF'} /></Dot>} label={c.n} />
            </div>
          ))}
        </div>
      ), 'tree')}

      {/* ═══ s2. «Открываешь чужой репозиторий, сотня папок и непонятно, с чего начинать» ═══ */}
      {P('s2', 0, -405, <Cap in="left" a={S(T('Открываешь'))} dot={<Dot tone="ink"><Brand name="github" w={56} /></Dot>} label="claude-code" right={num('149k ★', 44)} />, 'ghc')}
      {P('s2', 0, 10, (
        <Shot src="ghtricks/gh-page.png" nw={1440} nh={1000} w={860} a={S(T('репозиторий'))}>
          {(s) => (
            <div style={{position: 'absolute', left: 52 * s, top: 88 * s, width: 236 * s, height: 38 * s, borderRadius: 10, border: `4px solid ${MINT_D}`, boxShadow: `0 0 24px ${MINT}`,
              opacity: k(t, T('репозиторий') + 0.1, T('репозиторий') + 0.4)}} />
          )}
        </Shot>
      ), 'gh')}
      {FOLDERS.map((f, i) => P('s2', f.x, f.y, (
        <div style={{transform: `rotate(${f.r}deg) translateY(${Math.sin(t * 1.6 + i) * 6}px)`}}>
          <Cap in="pop" a={sp(t, folderAt + i * 0.09 - 0.08, fps, 11, 170)} h={104} dot={<Dot tone="grey" s={80}><IcoX name="folder" s={42} c="#5F6368" /></Dot>} label={f.n} />
        </div>
      ), `fo${i}`))}
      {P('s2', 0, 470, <Cap in="pop" a={Pp(folderAt)} h={140} dot={<Dot tone="mint" s={108}><IcoX name="folder" s={54} c="#05231D" /></Dot>} label={num(`${hund}+`, 84)} />, 'hund')}
      {[{x: 440, y: -230, s: 130, r: 12}, {x: 500, y: 20, s: 110, r: -10}, {x: 420, y: 250, s: 120, r: 8}].map((q, i) => P('s2', q.x, q.y, (
        <div style={{transform: `rotate(${q.r}deg) translateY(${Math.sin(t * 2 + i * 2) * 8}px)`}}>
          {sp(t, T('непонятно') + i * 0.12 - 0.08, fps, 10, 190) > 0 ? <div style={{transform: `scale(${sp(t, T('непонятно') + i * 0.12 - 0.08, fps, 10, 190)})`}}>
            <Dot tone="orange" s={q.s}><IcoX name="question" s={q.s * 0.55} c="#FFFFFF" w={3} /></Dot></div> : null}
        </div>
      ), `q${i}`))}

      {/* ═══ s3. «Пишешь вместо hub слово diagram, жмёшь Enter» ═══ */}
      {P('s3', 0, -400, <Cap in="drop" a={S(T('Пишешь'))} dot={<NumDot n={1} />} label="Трюк" />, 'n1')}
      {P('s3', 0, -85, <UrlCard t={t} a={S(T('Пишешь') + 0.05)} start="github" hlFrom={T('hub') - 0.05} swaps={[{at: T('diagram') - 0.1, to: 'gitdiagram', dur: 0.5}]} />, 'u3')}
      {P('s3', 0, 250, (
        <div style={{position: 'relative'}}>
          <div style={{...glass(150), minWidth: 460, justifyContent: 'center', gap: 26, transform: `scale(${1 - 0.07 * pressEnter})`, opacity: Math.min(1, S(T('жмешь')) * 1.8),
            background: pressEnter > 0.4 ? TONE.mint.bg : 'linear-gradient(180deg, rgba(255,255,255,.72), rgba(255,255,255,.42))'}}>
            <span style={{fontFamily: SANS, fontWeight: 700, fontSize: 66, color: pressEnter > 0.4 ? '#05231D' : INK}}>Enter</span>
            <IcoX name="enter" s={64} c={pressEnter > 0.4 ? '#05231D' : INK} w={2.6} />
          </div>
          <div style={{position: 'absolute', left: '50%', top: '50%'}}><Burst t={t} at={enter + 0.02} r={110} /></div>
        </div>
      ), 'enter')}

      {/* ═══ s4. «GitDiagram рисует схему: из каких частей проект и как они связаны» ═══ */}
      {P('s4', 0, -450, <Cap in="left" a={S(T('Git'))} dot={<Dot tone="white"><Img src={staticFile('brand/gitdiagram.png')} style={{width: 60, height: 60}} /></Dot>} label="GitDiagram" right={num(`${(star1 / 10).toFixed(1)}k ★`, 44)} />, 'gd')}
      {P('s4', 0, 10, (
        <Shot src="ghtricks/gitdiagram-schema.png" nw={1440} nh={1000} w={900} a={S(T('Git') + 0.2)} wipe={draw}>
          {(s) => (
            <>
              {draw < 1 ? <div style={{position: 'absolute', left: 0, right: 0, top: `${draw * 100}%`, height: 6, background: MINT, boxShadow: `0 0 26px ${MINT}`}} /> : null}
              {GROUPS.map((g, i) => {
                const on = k(t, g.a, g.a + 0.18) * (1 - k(t, g.z - 0.18, g.z));
                return on > 0 ? <div key={i} style={{position: 'absolute', left: g.b[0] * s, top: g.b[1] * s, width: g.b[2] * s, height: g.b[3] * s, borderRadius: 12, border: `4px solid ${MINT_D}`,
                  background: 'rgba(61,237,195,.16)', boxShadow: `0 0 28px rgba(61,237,195,${0.6 * on})`, opacity: on}} /> : null;
              })}
              {FLOW.map(([x, y0, y1], i) => {
                const p = (((t - T('связаны') + 0.1) * 1.4 + i * 0.3) % 1 + 1) % 1, v = k(t, T('связаны') - 0.1, T('связаны') + 0.1);
                return v > 0 ? <div key={i} style={{position: 'absolute', left: x * s - 8, top: lerp(y0, y1, p) * s - 8, width: 16, height: 16, borderRadius: 8, background: MINT, boxShadow: `0 0 16px ${MINT}`, opacity: v}} /> : null;
              })}
            </>
          )}
        </Shot>
      ), 'sch')}

      {/* ═══ s5. «Кликаешь по блоку и попадаешь в нужный файл» ═══ */}
      {P('s5', 0, 0, (
        <div style={{perspective: 1800, width: 788, height: 484, opacity: Math.min(1, S(T('Кликаешь')) * 1.8), transform: `scale(${0.9 + 0.1 * Math.min(1, S(T('Кликаешь')))})`}}>
          <div style={{position: 'relative', width: 788, height: 484, transformStyle: 'preserve-3d', transform: `rotateY(${flip * 180}deg)`}}>
            <div style={{position: 'absolute', inset: 0, backfaceVisibility: 'hidden'}}>
              <Shot src="ghtricks/gitdiagram-schema.png" nw={1440} nh={1000} w={760} a={1} crop={[547, 466, 355, 213]}>
                {(s) => {
                  const on = k(t, clickA, clickA + 0.2);
                  return (
                    <>
                      <div style={{position: 'absolute', left: 566 * s - 547 * s, top: 608 * s - 466 * s, width: 140 * s, height: 52 * s, borderRadius: 10, border: `4px solid ${MINT_D}`, background: 'rgba(61,237,195,.2)', boxShadow: `0 0 28px ${MINT}`, opacity: on}} />
                      <Pointer t={t} pts={ptsA} clicks={[clickA]} show={[ptsA[0].t, T('нужный')]} />
                    </>
                  );
                }}
              </Shot>
            </div>
            <div style={{position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)'}}><FileCard t={t} at={T('нужный') - 0.1} /></div>
          </div>
        </div>
      ), 'flip')}
      {P('s5', 0, -400, <Cap in="drop" a={S(T('блоку'))} dot={<Dot tone="ink"><IcoX name="cursor" s={46} c="#FFFFFF" /></Dot>} label="Клик" />, 'clk')}
      {P('s5', 0, 370, <Cap in="pop" a={Pp(T('файл'))} dot={<Dot tone="mint"><IcoX name="file" s={50} c="#05231D" /></Dot>} label="llm.py" right={<Check a={sp(t, T('файл') + 0.1, fps, 10, 200)} s={64} />} />, 'file')}

      {/* ═══ s6. «А ещё он делает минутное видео, где голосом объясняет проект» ═══ */}
      {P('s6', 0, -430, <Cap in="left" a={S(playAt)} dot={<Dot tone="orange"><IcoX name="play" s={46} c="#FFFFFF" w={2.6} /></Dot>} label="Видео" right={num('1 мин', 52)} />, 'vid')}
      {P('s6', 0, -50, (
        <Shot src="ghtricks/gitdiagram-video-frame.jpg" nw={1200} nh={675} w={860} a={S(T('еще'))}>
          {(s) => {
            const ring = 1 + 0.12 * Math.sin(t * 5), playing = k(t, playAt + 0.1, playAt + 0.35);
            return (
              <>
                <div style={{position: 'absolute', left: 598 * s - 80, top: 300 * s - 80, width: 160, height: 160, borderRadius: 80, border: `6px solid ${MINT}`, transform: `scale(${ring})`, opacity: 1 - playing, boxShadow: `0 0 30px ${MINT}`}} />
                <Burst t={t} at={playAt + 0.05} x={598 * s} y={300 * s} r={130} />
                <div style={{position: 'absolute', left: 0, bottom: 0, width: `${prog * 100}%`, height: 14, background: MINT, boxShadow: `0 0 16px ${MINT}`, opacity: playing}} />
              </>
            );
          }}
        </Shot>
      ), 'frame')}
      {P('s6', 0, 300, (
        <Cap in="rise" a={S(T('голосом'))} minW={720} dot={<Dot tone="mint"><IcoX name="mic" s={50} c="#05231D" /></Dot>} label="Голос"
          right={<div style={{display: 'flex', alignItems: 'center', gap: 8, height: 90}}>
            {Array.from({length: 11}, (_, i) => <div key={i} style={{width: 12, borderRadius: 6, background: MINT_D, height: 16 + 62 * Math.abs(Math.sin(t * 7 + i * 1.3) * Math.cos(t * 3 + i)) }} />)}
          </div>} />
      ), 'voice')}

      {/* ═══ s7. «Второй трюк: вместо hub пишешь ingest» ═══ */}
      {P('s7', 0, -330, <Cap in="drop" a={S(T('Второй'))} dot={<NumDot n={2} />} label="Трюк" />, 'n2')}
      {P('s7', 0, -20, <UrlCard t={t} a={S(T('Второй') + 0.1)} start="github" hlFrom={T('hub', 1) - 0.05} swaps={[{at: T('ingest') - 0.12, to: 'gitingest', dur: 0.5}]} />, 'u7')}
      {P('s7', 0, 300, <Cap in="pop" a={Pp(T('ingest') + 0.3)} dot={<Dot tone="white"><Img src={staticFile('brand/gitingest.svg')} style={{width: 56, height: 56}} /></Dot>} label="Gitingest" />, 'gi')}

      {/* ═══ s8. «Gitingest собирает весь проект в один текст: структуру папок и содержимое файлов» ═══ */}
      {P('s8', 0, -455, <Cap in="left" a={S(T('Git', 1))} dot={<Dot tone="white"><Img src={staticFile('brand/gitingest.svg')} style={{width: 60, height: 60}} /></Dot>} label="Gitingest" right={num(`${(star2 / 10).toFixed(1)}k ★`, 44)} />, 'gig')}
      {P('s8', 0, -150, <Shot src="ghtricks/gitingest-home.png" nw={993} nh={662} w={690} a={S(T('Git', 1) + 0.25)} />, 'gih')}
      {Array.from({length: 6}, (_, i) => {
        const side = i % 2 ? 1 : -1, row = Math.floor(i / 2);
        const x0 = side * (470 - row * 40), y0 = -250 + row * 170, x = lerp(x0, 0, gather), y = lerp(y0, 300, gather);
        const a = sp(t, T('собирает') + i * 0.08 - 0.08, fps, 12, 170);
        return a > 0 && gather < 1 ? P('s8', x, y, <div style={{transform: `scale(${(0.4 + 0.6 * a) * (1 - 0.5 * gather)})`, opacity: 1 - gather * 0.6}}><Dot tone="grey" s={96}><IcoX name="folder" s={48} c="#5F6368" /></Dot></div>, `sw${i}`) : null;
      })}
      {P('s8', 0, 290, (
        <div style={{...glass(300), borderRadius: 48, width: 740, height: 310, flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start', gap: 4, padding: '24px 36px', whiteSpace: 'pre',
          opacity: Math.min(1, sp(t, T('1') - 0.1, fps, 12, 170) * 1.8), transform: `scale(${0.85 + 0.15 * Math.min(1, sp(t, T('1') - 0.1, fps, 12, 170))})`}}>
          {TREE.slice(0, Math.max(0, treeN)).map((l, i) => <div key={i} style={{fontFamily: MONO, fontWeight: 600, fontSize: 43, color: i === 0 ? INK : 'rgba(14,15,17,.7)', lineHeight: 1.18}}>{l}</div>)}
        </div>
      ), 'sheet')}
      {P('s8', -240, 530, <Cap in="left" a={S(T('содержимое') - 0.05)} h={110} dot={<Dot tone="mint" s={84}><IcoX name="file" s={42} c="#05231D" /></Dot>} label={num(String(files).replace(/B(?=(d{3})+(?!d))/g, ' '), 56)} />, 'cnt1')}
      {P('s8', 250, 530, <Cap in="right" a={S(T('содержимое') + 0.2)} h={110} dot={<Dot tone="ink" s={84}><IcoX name="text" s={42} c="#FFFFFF" /></Dot>} label={num(`${tokens} тыс.`, 56)} />, 'cnt2')}

      {/* ═══ s9. «Вставляешь в Claude, и он понимает проект с первого сообщения, а не листает файлы полчаса» ═══ */}
      {P('s9', 0, -230, (
        <div style={{...glass(300), borderRadius: 64, width: 900, flexDirection: 'column', alignItems: 'flex-start', gap: 26, padding: '34px 40px', height: 'auto',
          opacity: Math.min(1, S(T('Вставляешь')) * 1.8), transform: `scale(${0.9 + 0.1 * Math.min(1, S(T('Вставляешь')))})`}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 22, width: '100%'}}>
            <div style={{position: 'relative', width: 104, height: 104}}>
              <svg width={104} height={104} viewBox="0 0 100 100" style={{position: 'absolute', left: 0, top: 0, opacity: think > 0 && think < 1 ? 1 : 0}}>
                <circle cx={50} cy={50} r={46} fill="none" stroke="rgba(14,15,17,.08)" strokeWidth={7} />
                <circle cx={50} cy={50} r={46} fill="none" stroke={MINT_D} strokeWidth={7} strokeLinecap="round" pathLength={1} strokeDasharray={`${think} 2`} transform="rotate(-90 50 50)" />
              </svg>
              <div style={{position: 'absolute', left: 4, top: 4}}><Dot tone="white" s={96}><Brand name="claude" w={58} color="#D97757" /></Dot></div>
            </div>
            <span style={{fontFamily: SANS, fontWeight: 600, fontSize: 60, color: INK, flex: 1}}>Claude</span>
            <Check a={sp(t, T('проект', 4) + 0.15, fps, 10, 200)} s={72} />
          </div>
          <div style={{transform: `translateX(${(1 - k(t, T('Вставляешь'), T('Вставляешь') + 0.5)) * -260}px)`, opacity: k(t, T('Вставляешь') - 0.05, T('Вставляешь') + 0.3),
            display: 'flex', alignItems: 'center', gap: 16, padding: '12px 26px 12px 18px', borderRadius: 24, background: 'rgba(14,15,17,.07)'}}>
            <IcoX name="doc" s={50} c={INK} /><span style={{fontFamily: MONO, fontWeight: 700, fontSize: 46, color: INK}}>claude-code.txt</span>
          </div>
        </div>
      ), 'comp')}
      {P('s9', 0, 40, <Cap in="left" a={S(T('сообщения'))} dot={<NumDot n={1} />} label="сообщение" right={<Check a={sp(t, T('сообщения') + 0.2, fps, 10, 200)} s={64} />} />, 'one')}
      {P('s9', 0, 215, <Cap in="right" a={S(T('листает'))} minW={700} dot={<Dot tone="grey"><IcoX name="folder" s={50} c="#5F6368" /></Dot>} label="файлы" right={<Bar p={((t - T('листает')) * 1.2) % 1} w={190} c="#9AA0A6" />} />, 'scr')}
      {P('s9', 0, 390, (
        <div style={{position: 'relative'}}>
          <Cap in="flip" a={S(T('полчаса'))} minW={700} dot={<Dot tone="grey"><IcoX name="hourglass" s={46} c="#5F6368" /></Dot>} label={<span style={{opacity: 1 - 0.5 * strike}}>30 минут</span>} dim={0} />
          <div style={{position: 'absolute', left: 150, top: '50%', height: 8, borderRadius: 4, width: 330 * strike, background: INK, transform: 'translateY(-50%)'}} />
        </div>
      ), 'half')}

      {/* ═══ s10. «Третий: меняешь GitHub на DeepWiki и получаешь документацию с чатом, где можно спросить, как всё работает» ═══ */}
      {P('s10', 0, -455, <Cap in="drop" a={S(T('третий'))} dot={<NumDot n={3} />} label="Трюк" />, 'n3')}
      {P('s10', 0, -255, <UrlCard t={t} a={S(T('меняешь'))} size={96} start="github" hlFrom={T('GitHub', 1) - 0.05} swaps={[{at: T('DeepWiki') - 0.1, to: 'deepwiki', dur: 0.55}]} />, 'u10')}
      {[{x: 48, y: 158, r: 4, o: 0.5, d: 0.0}, {x: -40, y: 168, r: -3, o: 0.35, d: 0.12}].map((p, i) => P('s10', p.x, p.y, (
        <div style={{opacity: p.o * k(t, T('документацию') - 0.1 + p.d, T('документацию') + 0.4 + p.d), transform: `rotate(${p.r}deg) scale(0.94)`}}>
          <Shot src="ghtricks/deepwiki-docs.png" nw={1440} nh={1000} w={780} a={1} blur={5} />
        </div>
      ), `pg${i}`))}
      {P('s10', 0, 150, (
        <Shot src="ghtricks/deepwiki-docs.png" nw={1440} nh={1000} w={780} a={S(T('получаешь'))}>
          {(s) => (
            <>
              {tocRows.map((i) => {
                const a = T('документацию') + 0.1 + i * 0.16, on = k(t, a, a + 0.15) * (1 - k(t, a + 0.3, a + 0.5));
                return on > 0 ? <div key={i} style={{position: 'absolute', left: 45 * s, top: (143 + 36 * i) * s, width: 271 * s, height: 32 * s, borderRadius: 8, background: 'rgba(61,237,195,.3)', border: `3px solid ${MINT_D}`, opacity: on}} /> : null;
              })}
            </>
          )}
        </Shot>
      ), 'wiki')}
      {P('s10', 0, 515, (
        <Cap in="drop" a={S(T('чатом'))} minW={880} h={130} dot={<Dot tone="ink" s={98}><Brand name="deepwiki" w={54} /></Dot>}
          label={<span style={{fontWeight: typedN ? 600 : 500, color: typedN ? INK : 'rgba(14,15,17,.4)'}}>{typedN ? typed.slice(0, typedN) : '|'}</span>}
          right={<div style={{transform: `scale(${sp(t, T('работает') + 0.1, fps, 10, 220)})`}}><Dot tone="mint" s={88}><IcoX name="plane" s={44} c="#05231D" /></Dot></div>} />
      ), 'chat')}

      {/* ═══ s11. «Скинь это тому, кто копается в чужом коде» ═══ */}
      {P('s11', 0, 0, (
        <div style={{position: 'relative', width: 1000, height: 560}}>
          <svg width={1000} height={560} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
            <path d="M500 205 C 690 235, 690 330, 500 365" fill="none" stroke={MINT_D} strokeWidth={5} strokeDasharray="4 14" strokeLinecap="round" strokeDashoffset={-t * 50} opacity={k(t, T('тому') - 0.2, T('тому') + 0.2)} />
          </svg>
          <div style={{position: 'absolute', left: 500, top: 110, transform: 'translate(-50%,-50%)'}}>
            <Cap in="left" a={S(T('Скинь'))} h={170} dot={<Dot tone="mint" s={128}><IcoX name="plane" s={62} c="#05231D" /></Dot>} label="Скинь" />
          </div>
          <div style={{position: 'absolute', left: 500, top: 460, transform: 'translate(-50%,-50%)'}}>
            <Cap in="right" a={S(T('копается'))} h={170} dot={<Dot tone="ink" s={128}><IcoX name="code" s={62} c="#FFFFFF" /></Dot>} label="чужой код" />
          </div>
          {flight > 0 && flight < 1 ? (() => {
            const u = flight * flight * (3 - 2 * flight), v = 1 - u;
            const fx = v * v * v * 500 + 3 * v * v * u * 690 + 3 * v * u * u * 690 + u * u * u * 500, fy = v * v * v * 205 + 3 * v * v * u * 235 + 3 * v * u * u * 330 + u * u * u * 365;
            return <div style={{position: 'absolute', left: fx, top: fy, transform: `translate(-50%,-50%) rotate(${54 + 160 * u}deg) scale(${1 - 0.25 * u})`}}><Dot tone="ink" s={96}><IcoX name="plane" s={52} c={MINT} /></Dot></div>;
          })() : null}
        </div>
      ), 'send')}

      {/* ═══ s12. «Напиши GitHub в комментариях, пришлю ещё 5 таких трюков» ═══ */}
      {P('s12', 0, -300, (
        <Cap in="pop" a={Pp(T('Напиши', 0) + 0.0)} h={170} minW={940} dot={<Dot tone="ink" s={116}><span style={{fontFamily: SANS, fontWeight: 700, fontSize: 44, color: '#FFFFFF'}}>@</span></Dot>}
          label={<span style={{fontWeight: wn ? 700 : 500, fontSize: wn ? 84 : 52, color: wn ? INK : 'rgba(14,15,17,.4)', letterSpacing: wn ? '0.01em' : 0}}>{wn ? word.slice(0, wn) : 'Комментарий…'}{wn && wn < word.length ? '|' : ''}</span>}
          right={<div style={{position: 'relative', transform: `scale(${sp(t, T('комментариях'), fps, 10, 220)})`}}><Dot tone="mint" s={100}><IcoX name="plane" s={48} c="#05231D" /></Dot>
            <div style={{position: 'absolute', left: '50%', top: '50%'}}><Burst t={t} at={T('комментариях') + 0.45} r={100} /></div></div>} />
      ), 'com')}
      {ARM.map((i) => P('s12', (i - 2) * 72, 170 + Math.abs(i - 2) * 18, (
        <div style={{transform: `rotate(${(i - 2) * 6}deg) scale(${fan(i)})`, opacity: Math.min(1, fan(i) * 1.8), filter: 'blur(5px)'}}>
          <div style={{...glass(190), width: 360, justifyContent: 'center', borderRadius: 48}}><Dot tone={i % 2 ? 'ink' : 'grey'} s={110}><IcoX name="lock" s={54} c={i % 2 ? '#FFFFFF' : '#5F6368'} /></Dot></div>
        </div>
      ), `fan${i}`, 0.5))}
      {P('s12', 0, 440, <Cap in="pop" a={Pp(T('5'))} h={160} dot={<Dot tone="mint" s={120}><span style={{fontFamily: SOYUZ, fontWeight: 700, fontSize: 82, color: '#05231D'}}>5</span></Dot>} label="трюков" />, 'five')}
    </>
  );
};

const SFX: [number, string, number][] = [
  [0, 'ui-soft', 0.25], [0.6, 'rev-whoosh', 0.22], [1.3, 'rev-whoosh', 0.22], [2.0, 'rev-whoosh', 0.22], [2.75, 'rev-whoosh', 0.25], [ND, 'aamir-ui-pop', 0.25], [ND + 0.3, 'aamir-ui-pop', 0.2], [T('схемой'), 'aamir-ui-pop', 0.2], [T('схемой') + 0.22, 'aamir-ui-pop', 0.2],
  [3.95, 'woosh-air', 0.35], [T('Открываешь'), 'aamir-ui-pop', 0.25], [T('репозиторий'), 'shimmer', 0.22], [T('сотня'), 'aamir-ui-pop', 0.25], [T('сотня') + 0.15, 'ui-seq', 0.2], [T('непонятно'), 'aamir-notification', 0.2],
  [7.5, 'woosh-air', 0.35], [T('Пишешь'), 'aamir-ui-pop', 0.22], [T('diagram') - 0.1, 'rev-whoosh', 0.25], [T('Enter'), 'aamir-click', 0.3],
  [10.3, 'woosh-air', 0.35], [T('Git'), 'aamir-ui-pop', 0.25], [T('рисует') - 0.1, 'shimmer', 0.25], [T('каких'), 'tick-soft', 0.2], [T('связаны'), 'ui-slide', 0.2],
  [14.55, 'woosh-air', 0.35], [T('Кликаешь'), 'aamir-ui-pop', 0.22], [T('блоку') + 0.12, 'aamir-click', 0.3], [T('попадаешь'), 'transform', 0.22], [T('файл') + 0.1, 'aamir-confirm', 0.25],
  [16.95, 'woosh-air', 0.35], [T('минутное'), 'aamir-ui-pop', 0.25], [T('минутное') + 0.05, 'tick-soft', 0.28], [T('голосом'), 'aamir-ui-pop', 0.22],
  [20.25, 'woosh-air', 0.35], [T('Второй'), 'aamir-ui-pop', 0.22], [T('ingest') - 0.12, 'rev-whoosh', 0.25], [T('ingest') + 0.3, 'aamir-ui-pop', 0.22],
  [22.95, 'woosh-air', 0.35], [T('Git', 1), 'aamir-ui-pop', 0.25], [T('собирает'), 'ui-seq', 0.2], [T('1'), 'aamir-ui-pop', 0.25], [T('структуру'), 'typing', 0.18], [T('содержимое'), 'counter', 0.25], [T('содержимое') + 0.25, 'counter', 0.22],
  [27.9, 'woosh-air', 0.35], [T('Вставляешь'), 'aamir-ui-pop', 0.25], [T('понимает'), 'ui-soft', 0.22], [T('проект', 4) + 0.15, 'aamir-confirm', 0.28], [T('сообщения'), 'aamir-ui-pop', 0.22], [T('полчаса'), 'switch', 0.22],
  [33.0, 'woosh-air', 0.35], [T('третий'), 'aamir-ui-pop', 0.22], [T('DeepWiki') - 0.1, 'rev-whoosh', 0.25], [T('получаешь'), 'shimmer', 0.22], [T('документацию'), 'ui-seq', 0.2], [T('чатом'), 'aamir-ui-pop', 0.22], [T('спросить'), 'typing', 0.18], [T('работает') + 0.1, 'aamir-click', 0.25],
  [41.2, 'woosh-air', 0.35], [T('Скинь'), 'aamir-ui-pop', 0.25], [T('тому'), 'whoosh', 0.2], [T('копается'), 'aamir-ui-pop', 0.22],
  [43.45, 'woosh-air', 0.35], [T('Напиши'), 'aamir-ui-pop', 0.22], [T('GitHub', 2), 'typing', 0.2], [T('комментариях') + 0.45, 'aamir-click', 0.28], [T('пришлю'), 'ui-seq', 0.22], [T('5'), 'aamir-confirm', 0.3],
];

// Запись спикера (альбомная 1920×1080, звук берётся из неё же) положить в public/work/<slug>/ и вписать путь; null: заглушка и тишина.
const REC: string | null = null; // 'work/<slug>/rec.mp4'
export const ReelRmGhtricks: React.FC = () => <LensReel id="ghtricks" rec={REC} words={WORDS} srcW={1912} srcH={1080} camera={camera} blobs={BLOBS} sfx={SFX} Stations={Stations} />;
void MINT; void TE;
