import {AbsoluteFill, Easing, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import {CV, CX, INK, ISLA, k, ORANGE, SF, spr, typed, Word} from '../tildify/TildifyDemo';
import {Block, GridPatch, Kind, lineIn, PAL, PlateIn, Row, Sheet, WHITE} from '../seo/SeoDemo';
import {Odo, S1, S2, W} from './KarpDemo';

// Полный ролик «Правила Карпатого» (28.09.2026, 46,2 с) — стиль 14 ЛИСТ по нормам memory layout-timing-rules.
// Первые 13 с — одобренный пример. Правила и их английские имена — из поста автора репозитория (скрин терминала Claude Code:
// think-before-coding, simplicity-first, surgical-changes, goal-driven). «800 → 70 строк» — из речи.
export const KARP_FRAMES = Math.round(46.7 * 60);
const END = 46.7;
export const RC = [0, W[17] - 0.1, W[33] - 0.1, W[53] - 0.1, W[90] - 0.1, W[107] + 0.05, END];
const MINT = '#3DEDC3';

// Сцена 3 (белый, 8 с): «Claude сам додумывает то, чего ты не говорил, лезет в код, который не понимает, и рапортует «готово», ничего не проверив»
// Claude в кругах, вокруг по одной всплывают три карточки-ошибки; внизу подпись с выключкой влево меняется по фразам
const S3: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const a = RC[2], fig = spr(t, a - 0.05, fps, 13, 140), ph = t < W[41] - 0.1 ? 0 : t < W[47] - 0.1 ? 1 : 2;
  const cards: [string, string, number, number, number, number][] = [
    ['Додумывает сам', 'то, о чём ты не просил', 505, 580, -5, W[35]], ['Лезет в чужой код', 'который не понимает', 935, 640, 4, W[41]], ['«Готово!»', 'ничего не проверив', 720, 1060, -3, W[49] - 0.2]];
  const cap: [React.ReactNode, React.ReactNode][] = [
    [<><Word t={t} at={W[33]}>Claude</Word> <Word t={t} at={W[34]}>сам</Word> <Word t={t} at={W[35]}>додумывает</Word></>, <><Word t={t} at={W[36]}>то, чего</Word> <Word t={t} at={W[38]}>ты не говорил</Word></>],
    [<><Word t={t} at={W[41]}>лезет</Word> <Word t={t} at={W[42]}>в код,</Word></>, <><Word t={t} at={W[44]}>который</Word> <Word t={t} at={W[45]}>не понимает</Word></>],
    [<><Word t={t} at={W[47]}>и рапортует</Word> <Word t={t} at={W[49]}>«готово»,</Word></>, <><Word t={t} at={W[50]}>ничего</Word> <Word t={t} at={W[51]}>не проверив</Word></>]];
  return (
    <>
      {[430, 310, 200].map((r, i) => <div key={i} style={{position: 'absolute', left: CX - r, top: 800 - r, width: r * 2, height: r * 2, borderRadius: '50%',
        background: `rgba(255,122,47,${[0.06, 0.08, 0.1][i]})`, transform: `scale(${0.6 + 0.4 * Math.min(1, fig)})`}} />)}
      <div style={{position: 'absolute', left: CX - 110, top: 690, width: 220, height: 220, borderRadius: 58, background: '#FFFFFF', display: 'grid', placeItems: 'center',
        transform: `scale(${Math.min(1.05, fig)}) rotate(${Math.sin(t * 3) * 3}deg)`, boxShadow: '0 30px 60px rgba(17,19,22,.18)'}}>
        <Img src={staticFile('karp/claude.svg')} style={{width: 140, height: 140}} />
      </div>
      {cards.map(([title, sub, x, y, r, at2], i) => {
        const p = spr(t, at2 - 0.1, fps, 12, 180);
        return (
          <div key={i} style={{position: 'absolute', left: x - 200, top: y - 72, width: 400, height: 144, borderRadius: 24, background: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 16,
            padding: '0 22px 0 28px', opacity: Math.min(1, p * 2), transform: `rotate(${r}deg) scale(${0.6 + 0.4 * Math.min(1.04, p)}) translateY(${(1 - Math.min(1, p)) * 50}px)`,
            boxShadow: '0 0 0 3px rgba(255,122,47,.4), 0 20px 40px rgba(17,19,22,.12)'}}>
            <div style={{flex: 1, textAlign: 'left'}}>
              <div style={{fontFamily: SF, fontWeight: 700, fontSize: 36, color: INK, lineHeight: 1.1}}>{title}</div>
              <div style={{fontFamily: SF, fontSize: 26, color: '#6B7078', marginTop: 8}}>{sub}</div>
            </div>
            <div style={{width: 76, height: 76, borderRadius: 20, background: ORANGE, display: 'grid', placeItems: 'center', color: '#FFF', fontFamily: SF, fontWeight: 800, fontSize: 44}}>✕</div>
          </div>
        );
      })}
      <div style={{position: 'absolute', left: 300, top: 1250, fontFamily: SF, fontWeight: 300, fontSize: 60, color: INK, whiteSpace: 'nowrap'}}>{cap[ph][0]}</div>
      <div style={{position: 'absolute', left: 300, top: 1330, fontFamily: CV, fontSize: 84, lineHeight: 1, color: ORANGE, whiteSpace: 'nowrap'}}>{cap[ph][1]}</div>
    </>
  );
};
// Сцена 4 (чёрный, 14 с): «Файл ставит четыре правила. Первое… Второе… Третье… Четвёртое…» — блок-якорь и список из четырёх строк
const RULES: [string, string, number][] = [
  ['Думай и спрашивай, если непонятно', 'think-before-coding', W[57]], ['Минимум кода под задачу', 'simplicity-first', W[65]],
  ['Меняй только то, что спросили', 'surgical-changes', W[73]], ['Договорись о «готово» и проверь', 'goal-driven', W[80]]];
const S4: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const up = k(t, W[57] - 0.3, W[57] + 0.2, Easing.bezier(0.65, 0, 0.35, 1)), cur = RULES.filter((r) => t >= r[2] - 0.1).length - 1;
  return (
    <>
      <GridPatch kind="black" cy={760} />
      <div style={{position: 'absolute', inset: 0, transform: `scale(${1 - 0.25 * up})`, transformOrigin: '720px 470px'}}>
        <Block kind="black" top={470} t={t} rule={lineIn(t, W[54])}
          kicker={<><Word t={t} at={W[53]}>Файл</Word> <Word t={t} at={W[54]}>CLAUDE.md</Word> <Word t={t} at={W[54] + 0.2}>ставит</Word></>}
          plate={<PlateIn t={t} at={W[55] - 0.08} fps={fps} size={150}>4 правила</PlateIn>} />
      </div>
      <div style={{position: 'absolute', left: CX - 432, top: 790, width: 864, display: 'flex', flexDirection: 'column', gap: 22}}>
        {RULES.map(([txt, en, at2], i) => {
          const p = spr(t, at2 - 0.12, fps, 13, 170), on = i === cur;
          return (
            <div key={i} style={{display: 'flex', alignItems: 'center', gap: 26, padding: '22px 30px', borderRadius: 28, background: on ? '#1F2023' : 'rgba(255,255,255,.04)',
              boxShadow: on ? `0 0 0 3px ${ORANGE}` : '0 0 0 2px rgba(255,255,255,.08)', opacity: Math.min(1, p * 2) * (on ? 1 : 0.7), transform: `translateY(${(1 - Math.min(1, p)) * 80}px) scale(${on ? 1 : 0.97})`}}>
              <div style={{width: 96, height: 96, borderRadius: 48, background: on ? ORANGE : 'rgba(255,255,255,.12)', display: 'grid', placeItems: 'center', flex: 'none',
                fontFamily: CV, fontSize: 64, color: '#FFFFFF'}}>{i + 1}</div>
              <div style={{textAlign: 'left'}}>
                <div style={{fontFamily: SF, fontWeight: 600, fontSize: 42, color: WHITE, lineHeight: 1.15}}>{txt}</div>
                <div style={{fontFamily: 'SF Mono', fontSize: 28, color: on ? MINT : '#8A9096', marginTop: 8}}>{en}</div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};
// Сцена 5 (белый, 6 с): «Смешно, но Claude сначала написал этот файл на 800 строк, а потом сам ужал его до 70» — длинный файл сжимается
const S5: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const file = spr(t, RC[4] + 0.05, fps, 14, 150), squish = k(t, W[103] - 0.15, W[106], Easing.bezier(0.65, 0, 0.35, 1));
  const v = Math.max(70, t < W[103] - 0.15 ? 800 * k(t, W[97], W[99], Easing.bezier(0.3, 0.05, 0.2, 1)) : 800 - 730 * squish) + 0.0001;
  const H = 820 - 620 * squish;
  return (
    <>
      <GridPatch kind="white" cy={800} />
      <Row y={420} size={54} color={INK}><Word t={t} at={W[90]}>Смешно,</Word> <Word t={t} at={W[91]}>но</Word> <Word t={t} at={W[92]}>Claude</Word> <Word t={t} at={W[93]}>сначала</Word> <Word t={t} at={W[94]}>написал</Word></Row>
      {/* файл CLAUDE.md: высота = число строк */}
      <div style={{position: 'absolute', left: 320, top: 540, width: 380, height: H, borderRadius: 22, background: '#FFFFFF', overflow: 'hidden', opacity: Math.min(1, file * 2),
        transform: `translateY(${(1 - Math.min(1, file)) * 120}px) rotate(-2deg)`, boxShadow: '0 0 0 2px rgba(17,19,22,.08), 0 30px 60px rgba(17,19,22,.16)', padding: '26px 28px'}}>
        <div style={{fontFamily: 'SF Mono', fontWeight: 700, fontSize: 30, color: INK, marginBottom: 16}}>CLAUDE.md</div>
        {Array.from({length: 40}, (_, i) => <div key={i} style={{height: 10, marginBottom: 9, borderRadius: 5, width: `${[92, 70, 84, 60, 96, 76, 88, 52][i % 8]}%`, background: i % 5 === 0 ? 'rgba(255,122,47,.6)' : 'rgba(17,19,22,.16)'}} />)}
      </div>
      <div style={{position: 'absolute', left: 760, top: 640, width: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: k(t, W[97] - 0.1, W[97] + 0.2)}}>
        <Odo value={v} digits={3} size={170} color={squish > 0.98 ? ORANGE : INK} />
        <div style={{fontFamily: SF, fontWeight: 500, fontSize: 48, color: INK, marginTop: 6}}>строк</div>
      </div>
      <div style={{position: 'absolute', left: 960, top: 1000, transform: 'translateX(-50%)'}}><PlateIn t={t} at={W[103] - 0.05} fps={fps} size={84}>сам ужал</PlateIn></div>
    </>
  );
};
// Сцена 6 (чёрный): «Напиши слово «правила» в комментариях, пришлю ссылку, отдашь её Claude, он сам всё поставит»
const S6: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const word = typed('правила', t, W[109] - 0.05, W[109] + 0.4), sent = k(t, W[110], W[110] + 0.2), link = spr(t, W[112] - 0.1, fps, 12, 180), cl = spr(t, W[116] - 0.1, fps, 12, 180), ok = k(t, W[119], W[119] + 0.3);
  return (
    <>
      <GridPatch kind="black" cy={760} />
      <Row y={430} size={60} color={WHITE}><Word t={t} at={W[107] + 0.1}>Напиши</Word> <Word t={t} at={W[108]}>слово</Word></Row>
      <div style={{position: 'absolute', left: CX - 400, top: 540 - sent * 30, width: 800, height: 170, borderRadius: 85, display: 'flex', alignItems: 'center', padding: '0 34px 0 60px', background: '#FFFFFF',
        boxShadow: '0 30px 60px rgba(0,0,0,.4)'}}>
        <span style={{flex: 1, fontFamily: CV, fontSize: 100, color: INK}}>{word}<span style={{color: ORANGE, opacity: sent > 0 ? 0 : Math.floor(t * 3) % 2}}>|</span></span>
        <div style={{width: 110, height: 110, borderRadius: 55, background: sent > 0 ? ORANGE : 'rgba(17,19,22,.15)', display: 'grid', placeItems: 'center'}}>
          <svg width={52} height={52} viewBox="0 0 24 24"><path d="M3 12 L20 4 L14 21 L11 13 Z" fill="#FFFFFF" /></svg>
        </div>
      </div>
      <Row y={760} size={48} color={PAL.black.grey}><Word t={t} at={W[110]}>в</Word> <Word t={t} at={W[111]}>комментариях</Word></Row>
      <div style={{position: 'absolute', left: 0, right: 0, top: 900, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 26}}>
        <div style={{padding: '22px 36px', borderRadius: 50, background: ORANGE, color: '#FFF', fontFamily: SF, fontWeight: 600, fontSize: 46, opacity: Math.min(1, link * 2),
          transform: `scale(${0.6 + 0.4 * Math.min(1.05, link)})`, boxShadow: '0 10px 0 #C24F14'}}>ссылка</div>
        <svg width={90} height={40} style={{opacity: k(t, W[114], W[114] + 0.2)}}><path d="M6 20 H76 M60 6 L80 20 L60 34" stroke={WHITE} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <div style={{width: 160, height: 160, borderRadius: 42, background: '#FFFFFF', display: 'grid', placeItems: 'center', opacity: Math.min(1, cl * 2), transform: `scale(${0.5 + 0.5 * Math.min(1.05, cl)})`}}>
          <Img src={staticFile('karp/claude.svg')} style={{width: 100, height: 100}} />
        </div>
      </div>
      <div style={{position: 'absolute', left: CX, top: 1130, transform: `translateX(-50%) scale(${0.7 + 0.3 * ok})`, opacity: ok, padding: '16px 34px', borderRadius: 40, background: '#1DB45A', color: '#FFF',
        fontFamily: SF, fontWeight: 600, fontSize: 44, whiteSpace: 'nowrap'}}>✓ Claude сам всё поставит</div>
    </>
  );
};

// сцены 1–2 примера берём как есть
const SCENES: [React.FC<{t: number; fps: number}>, Kind][] = [[S1, 'white'], [S2, 'black'], [S3, 'white'], [S4, 'black'], [S5, 'white'], [S6, 'black']];
type E = [number, string, number, boolean?, number?];
const SFX: E[] = [
  [W[0] - 0.05, 'pop', 0.3], [W[1] - 0.05, 'popup', 0.34], [W[7] - 0.1, 'es-open', 0.28], [W[11], 'count', 0.3], [W[13], 'count', 0.3], [W[14] + 0.1, 'confirm', 0.3],
  [RC[1], 'sw-s6', 0.14, true], [W[21] - 0.1, 'es-open', 0.28], [W[23] - 0.05, 'popup', 0.32], [W[28] - 0.05, 'hit2', 0.24],
  [RC[2], 'sw-s1', 0.14, true], [W[35] - 0.1, 'click', 0.4], [W[41] - 0.1, 'click4', 0.4], [W[49] - 0.3, 'click', 0.4],
  [RC[3], 'sw-s7', 0.14, true], [W[55] - 0.05, 'popup', 0.34], ...[W[57], W[65], W[73], W[80]].map((x) => [x - 0.1, 'select', 0.3] as E),
  [RC[4], 'sw-s4', 0.14, true], [W[94] - 0.1, 'es-open', 0.28], [W[97], 'count', 0.28], [W[103] - 0.15, 'tr-b', 0.22, true], [W[106], 'confirm', 0.28],
  [RC[5], 'sw-s6', 0.14, true], [W[109] - 0.05, 'type-a', 0.2, false, 0.45], [W[110], 'click', 0.32], [W[112] - 0.1, 'pop', 0.3], [W[116] - 0.1, 'pop', 0.3], [W[119], 'confirm', 0.32],
];

export const KarpReel: React.FC = () => {
  const frame = useCurrentFrame(), {fps} = useVideoConfig(), t = frame / fps;
  const seg = Math.max(0, RC.findIndex((c, i) => t >= c && t < RC[i + 1]));
  const [Scene, kind] = SCENES[Math.min(SCENES.length - 1, seg)];
  const edge = Math.min(...RC.slice(1, -1).map((c) => Math.abs(t - c))), blur = interpolate(edge, [0, 0.16], [16, 0], {extrapolateRight: 'clamp'}), fade = interpolate(edge, [0, 0.16], [0.35, 1], {extrapolateRight: 'clamp'});
  const push = interpolate(t, [RC[seg], RC[seg + 1] ?? END], [1, 1.035], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}), out = k(t, END - 0.5, END - 0.05);
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <AbsoluteFill style={{filter: blur > 0.5 ? `blur(${blur}px)` : undefined, opacity: fade}}>
        <Sheet kind={kind} t={t} />
        <AbsoluteFill style={{transform: `scale(${push})`, transformOrigin: '720px 900px'}}><Scene t={t} fps={fps} /></AbsoluteFill>
      </AbsoluteFill>
      <div style={{position: 'absolute', left: CX - 380, top: 2350 - 720, width: 760, height: 720, borderRadius: 60, overflow: 'hidden', boxShadow: '0 0 0 4px rgba(255,255,255,.9), 0 40px 80px rgba(0,0,0,.3)'}}>
        <OffthreadVideo src={staticFile('karp/karp.mp4')} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 36%'}} />
      </div>
      <AbsoluteFill style={{background: '#000', opacity: out}} />
      {SFX.map(([at, c, v, pk, dd], i) => {
        const m = ISLA[c], from = Math.round((at - (pk ? m.peak : m.onset)) * fps);
        return <Sequence key={i} from={from} durationInFrames={Math.round((dd ?? (c.startsWith('type') ? 0.35 : m.dur)) * fps)} layout="none"><Audio src={staticFile(`sfx/isla/${c}.wav`)} volume={v} /></Sequence>;
      })}
    </AbsoluteFill>
  );
};
