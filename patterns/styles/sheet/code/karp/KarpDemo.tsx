import {AbsoluteFill, Easing, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import RAW from './data/karp-words.json';
import {CV, CX, INK, ISLA, k, ORANGE, SF, spr, Word} from '../tildify/TildifyDemo';
import {Block, GridPatch, Kind, lineIn, PlateIn, Row, Sheet, WHITE} from '../seo/SeoDemo';

// Демо 13 с «Правила Карпатого» (28.09.2026) — стиль 14 ЛИСТ по сохранённым нормам (memory layout-timing-rules): только белый и чёрный,
// длинные сцены с якорем, крупные акценты и иконки, спикер 760×720 с низом y 2350, всё появляется до смены сцены.
// Звёзды — GitHub API 28.09.2026: multica-ai/andrej-karpathy-skills 215 673 (в речи «215 тысяч»). «Карпатова» = Андрей Карпатый, «Cloud» = Claude.
export const KARP_DEMO_FRAMES = Math.round(13.3 * 60);
const END = 13.3;
export const W = (RAW as {text: string; start: number}[]).map((w) => w.start);
export const KC = [0, W[17] - 0.1, END];

export const Odo: React.FC<{value: number; digits: number; size: number; color: string}> = ({value, digits, size, color}) => {
  const cw = size * 0.6, h = size * 1.05;
  return (
    <div style={{display: 'flex', alignItems: 'center'}}>
      {Array.from({length: digits}, (_, i) => digits - 1 - i).map((place, i) => {
        const m = 10 ** place, pos = (Math.floor(value / m) % 10) + (place === 0 ? value % 1 : Math.min(1, Math.max(0, (value % m) - (m - 1))));
        return (
          <div key={place} style={{display: 'flex', alignItems: 'center'}}>
            {i > 0 && (digits - i) % 3 === 0 ? <div style={{width: size * 0.22}} /> : null}
            <div style={{width: cw, height: h, overflow: 'hidden', position: 'relative', opacity: value < m && place > 0 ? 0.22 : 1}}>
              <div style={{position: 'absolute', left: 0, top: -pos * h, width: cw, filter: place <= 1 && value < 0.99 * 10 ** (digits - 1) * 2 ? `blur(${4 - 2 * place}px)` : undefined}}>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d, j) => <div key={j} style={{height: h, lineHeight: `${h}px`, textAlign: 'center', fontFamily: CV, fontSize: size, color}}>{d}</div>)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
const Tile: React.FC<{src: string; size: number; p: number; dark?: boolean}> = ({src, size, p, dark}) => (
  <div style={{width: size, height: size, borderRadius: size * 0.26, background: dark ? '#1C1D20' : '#FFFFFF', display: 'grid', placeItems: 'center', opacity: Math.min(1, p * 2),
    transform: `scale(${0.5 + 0.5 * Math.min(1.05, p)})`, boxShadow: '0 0 0 2px rgba(17,19,22,.06), 0 24px 44px rgba(17,19,22,.18)'}}>
    <Img src={staticFile(src)} style={{width: size * 0.6, height: size * 0.6}} />
  </div>
);

// Сцена 1 (белый, 0–7 с): «Claude не тупой. Ему просто нужен этот скилл основателя OpenAI, который набрал 215 тысяч звёзд на GitHub»
// Claude + плашка «не тупой» → уменьшаются якорем; настоящая карточка репозитория GitHub; затем счётчик звёзд до 215 673
export const S1: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const shrink = k(t, W[3] - 0.1, W[3] + 0.4, Easing.bezier(0.65, 0, 0.35, 1)), card = spr(t, W[7] - 0.15, fps, 14, 150);
  const cs = k(t, W[10] - 0.15, W[10] + 0.35, Easing.bezier(0.65, 0, 0.35, 1)), odo = spr(t, W[10] - 0.05, fps, 14, 160);
  const v = Math.min(215673, 215673 * k(t, W[11], W[14] + 0.1, Easing.bezier(0.3, 0.05, 0.2, 1)) + 0.0001), done = v > 215670 ? k(t, W[14] + 0.1, W[14] + 0.4) : 0;
  return (
    <>
      <GridPatch kind="white" cy={800} h={1100} />
      <div style={{position: 'absolute', inset: 0, transform: `scale(${1 - 0.3 * shrink})`, transformOrigin: '720px 440px'}}>
        <div style={{position: 'absolute', left: CX - 110, top: 440}}><Tile src="karp/claude.svg" size={220} p={spr(t, W[0] - 0.1, fps)} /></div>
        <div style={{position: 'absolute', left: CX, top: 700, transform: 'translateX(-50%)'}}><PlateIn t={t} at={W[1] - 0.08} fps={fps} size={150}>не тупой</PlateIn></div>
      </div>
      <Row y={790} size={54} color={INK}><Word t={t} at={W[3]}>Ему</Word> <Word t={t} at={W[4]}>просто</Word> <Word t={t} at={W[5]}>нужен</Word> <Word t={t} at={W[6]}>этот</Word> <Word t={t} at={W[7]}>скилл</Word></Row>
      {/* настоящая карточка репозитория; на «который набрал» уменьшается и уступает место счётчику */}
      <div style={{position: 'absolute', left: CX - 432, top: 880, width: 864, height: 432, borderRadius: 28, overflow: 'hidden', opacity: Math.min(1, card * 2),
        transform: `translateY(${(1 - Math.min(1, card)) * 140}px) scale(${1 - 0.25 * cs})`, transformOrigin: '720px 0px', boxShadow: '0 0 0 2px rgba(17,19,22,.08), 0 30px 60px rgba(17,19,22,.16)'}}>
        <Img src={staticFile('karp/repo-card.png')} style={{width: '100%', height: '100%'}} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 1215, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: Math.min(1, odo * 2), transform: `translateY(${(1 - Math.min(1, odo)) * 120}px)`}}>
        <div style={{filter: `drop-shadow(0 0 ${30 * done}px rgba(255,122,47,.6))`}}><Odo value={v} digits={6} size={170} color={v > 215670 ? ORANGE : INK} /></div>
        <div style={{marginTop: 14, display: 'flex', alignItems: 'center', gap: 16, padding: '14px 30px', borderRadius: 24, background: '#21262D'}}>
          <Img src={staticFile('karp/github.svg')} style={{width: 48, height: 48, filter: 'invert(1)'}} />
          <svg width={44} height={44} viewBox="0 0 24 24"><path d="M12 2.5 L14.9 8.6 L21.5 9.3 L16.5 13.8 L17.9 20.4 L12 17 L6.1 20.4 L7.5 13.8 L2.5 9.3 L9.1 8.6 Z" fill="#E3B341" /></svg>
          <span style={{fontFamily: SF, fontWeight: 600, fontSize: 46, color: '#F0F6FC'}}>звёзд на GitHub</span>
        </div>
      </div>
    </>
  );
};
// Сцена 2 (чёрный, 7–13 с): «Его сделали по посту Андрея Карпатого, одного из основателей OpenAI, про ошибки Claude Code в коде»
// блок с именем, плашка «сооснователь OpenAI», окно с настоящим выступлением Карпатого (Sequoia AI Ascent 2026), стикер «ошибки Claude Code»
export const S2: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const win = spr(t, W[21] - 0.1, fps, 14, 140), sticker = spr(t, W[28] - 0.1, fps, 10, 200);
  return (
    <>
      <GridPatch kind="black" cy={760} />
      <Block kind="black" top={470} t={t} rule={lineIn(t, W[21])}
        kicker={<><Word t={t} at={W[17]}>Его</Word> <Word t={t} at={W[18]}>сделали</Word> <Word t={t} at={W[19]}>по</Word> <Word t={t} at={W[20]}>посту</Word></>}
        lead={<><Word t={t} at={W[21]}>Андрея</Word> <Word t={t} at={W[22]}>Карпатого</Word></>}
        plate={<PlateIn t={t} at={W[23] - 0.1} fps={fps} size={72}>
          <span style={{display: 'inline-flex', alignItems: 'center', gap: 18}}><Img src={staticFile('karp/openai.svg')} style={{width: 64, height: 64, filter: 'invert(1)'}} />сооснователь OpenAI</span></PlateIn>} />
      <div style={{position: 'absolute', left: CX - 432, top: 900, width: 864, height: 486, borderRadius: 28, overflow: 'hidden', background: '#000', opacity: Math.min(1, win * 2),
        transform: `translateY(${(1 - Math.min(1, win)) * 160}px)`, boxShadow: '0 0 0 3px rgba(255,255,255,.9), 0 40px 80px rgba(0,0,0,.5)'}}>
        <Sequence from={Math.round((W[21] - 0.1) * fps)} layout="none">
          <OffthreadVideo src={staticFile('karp/sequoia.mp4')} startFrom={Math.round(24 * fps)} muted style={{width: '100%', height: '100%', objectFit: 'cover'}} />
        </Sequence>
        <div style={{position: 'absolute', right: 20, top: 18, padding: '6px 14px', borderRadius: 10, background: 'rgba(0,0,0,.6)', fontFamily: SF, fontSize: 26, color: '#FFF'}}>Sequoia AI Ascent 2026</div>
      </div>
      <div style={{position: 'absolute', left: CX, top: 1330, transform: `translateX(-50%) rotate(${6 - 10 * (1 - Math.min(1, sticker))}deg) scale(${1.6 - 0.6 * Math.min(1, sticker)})`, opacity: Math.min(1, sticker * 2),
        display: 'flex', alignItems: 'center', gap: 16, padding: '16px 30px 12px', borderRadius: 18, background: '#FFFFFF', whiteSpace: 'nowrap', boxShadow: '0 10px 0 #9AA0A6, 0 30px 40px rgba(0,0,0,.4)'}}>
        <Img src={staticFile('karp/claude.svg')} style={{width: 56, height: 56}} />
        <span style={{fontFamily: CV, fontSize: 64, lineHeight: 1, color: INK}}>ошибки Claude Code</span>
      </div>
    </>
  );
};

const SCENES: [React.FC<{t: number; fps: number}>, Kind][] = [[S1, 'white'], [S2, 'black']];
type E = [number, string, number, boolean?, number?];
const SFX: E[] = [
  [W[0] - 0.05, 'pop', 0.3], [W[1] - 0.05, 'popup', 0.34], [W[7] - 0.1, 'es-open', 0.28], [W[11], 'count', 0.3], [W[13], 'count', 0.3], [W[14] + 0.1, 'confirm', 0.3],
  [KC[1], 'sw-s6', 0.14, true], [W[21] - 0.1, 'es-open', 0.28], [W[23] - 0.05, 'popup', 0.32], [W[28] - 0.05, 'hit2', 0.24],
];

export const KarpDemo: React.FC = () => {
  const frame = useCurrentFrame(), {fps} = useVideoConfig(), t = frame / fps;
  const seg = Math.max(0, KC.findIndex((c, i) => t >= c && t < KC[i + 1]));
  const [Scene, kind] = SCENES[Math.min(SCENES.length - 1, seg)];
  const edge = Math.min(...KC.slice(1, -1).map((c) => Math.abs(t - c))), blur = interpolate(edge, [0, 0.16], [16, 0], {extrapolateRight: 'clamp'}), fade = interpolate(edge, [0, 0.16], [0.35, 1], {extrapolateRight: 'clamp'});
  const push = interpolate(t, [KC[seg], KC[seg + 1] ?? END], [1, 1.035], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <AbsoluteFill style={{filter: blur > 0.5 ? `blur(${blur}px)` : undefined, opacity: fade}}>
        <Sheet kind={kind} t={t} />
        <AbsoluteFill style={{transform: `scale(${push})`, transformOrigin: '720px 900px'}}><Scene t={t} fps={fps} /></AbsoluteFill>
      </AbsoluteFill>
      <div style={{position: 'absolute', left: CX - 380, top: 2350 - 720, width: 760, height: 720, borderRadius: 60, overflow: 'hidden', boxShadow: `0 0 0 4px rgba(255,255,255,.9), 0 40px 80px rgba(0,0,0,.3)`}}>
        <OffthreadVideo src={staticFile('karp/karp.mp4')} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 36%'}} />
      </div>
      {SFX.map(([at, c, v, pk, dd], i) => {
        const m = ISLA[c], from = Math.round((at - (pk ? m.peak : m.onset)) * fps);
        return <Sequence key={i} from={from} durationInFrames={Math.round((dd ?? (c.startsWith('type') ? 0.35 : m.dur)) * fps)} layout="none"><Audio src={staticFile(`sfx/isla/${c}.wav`)} volume={v} /></Sequence>;
      })}
      {void WHITE}
    </AbsoluteFill>
  );
};
