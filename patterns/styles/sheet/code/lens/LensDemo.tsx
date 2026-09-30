import {AbsoluteFill, Easing, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import RAW from './data/lens-words.json';
import {CV, CX, GREY, INK, ISLA, k, Logo, ORANGE, PAPER, Plate, Pointer, Row, SF, spr, Word} from '../tildify/TildifyDemo';

// Демо 12 с Apple LensVLM (27.09.2026) в стиле 14 ЛИСТ (patterns/styles/sheet/PATTERN.md): лист с сеткой, фраза SF Pro,
// акцент Coolvetica, оранжевая плашка с пружиной, рисованные стрелки, спикер в карточке 760×720 (низ y 2400).
// Цифры только из речи: «на 80% меньше токенов» (whisper сначала услышал «8%», перепроверено по отрывку), «договор на 100 страниц».
export const LENS_DEMO_FRAMES = Math.round(12.3 * 60);
const END = 12.3;
export const W = (RAW as {text: string; start: number}[]).map((w) => w.start);
export const CUT = [0, W[13] - 0.08, W[19] - 0.1, W[28] - 0.1, END];
export const MONO = 'SF Mono';

// Сцена 1: «Apple нашла способ, как в нейросети тратить на документы на 80% меньше токенов» — из десяти токенов остаются два
export const S1: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const cut = k(t, W[11] - 0.05, W[12] + 0.3, Easing.bezier(0.65, 0, 0.35, 1));
  return (
    <>
      <Logo src="lens/apple.svg" size={170} x={CX} y={505} p={spr(t, W[0] - 0.05, fps)} />
      <Row y={640} size={68}><Word t={t} at={W[0]}>Apple</Word> <Word t={t} at={W[1]}>нашла</Word> <Word t={t} at={W[2]}>способ</Word></Row>
      <Row y={725} size={56} weight={500}><Word t={t} at={W[3]}>как</Word> <Word t={t} at={W[4]}>в</Word> <Word t={t} at={W[5]}>нейросети</Word> <Word t={t} at={W[6]}>тратить</Word> <Word t={t} at={W[7]}>на</Word> <Word t={t} at={W[8]}>документы</Word></Row>
      <Plate t={t} at={W[9] - 0.05} text="на 80% меньше" y={885} size={110} fps={fps} />
      <Pointer t={t} at={W[10] - 0.1} d="M 250 1330 C 250 1210, 300 1130, 360 1080" head={[360, 1080, -42]} />
      <Pointer t={t} at={W[10] - 0.02} d="M 1190 1330 C 1190 1210, 1140 1130, 1080 1080" head={[1080, 1080, 222]} />
      <Row y={1075} size={60}><Word t={t} at={W[12]}>токенов</Word></Row>
      {/* полоска токенов: восемь из десяти гаснут и схлопываются */}
      <div style={{position: 'absolute', left: CX, top: 1190, transform: 'translateX(-50%)', display: 'flex', gap: 14, opacity: k(t, W[10], W[10] + 0.3)}}>
        {Array.from({length: 10}, (_, i) => {
          const gone = i >= 2 ? cut : 0;
          return <div key={i} style={{width: 58 * (1 - gone), height: 58, marginRight: gone > 0.98 ? -14 : 0, borderRadius: 14, background: i < 2 ? ORANGE : `rgba(17,19,22,${0.85 - 0.6 * gone})`,
            opacity: 1 - 0.7 * gone, transform: `scale(${1 - 0.4 * gone})`, boxShadow: i < 2 ? '0 8px 0 #C24F14' : undefined}} />;
        })}
      </div>
    </>
  );
};
// Сцена 2: «и выложила модель на Hugging Face» — карточка модели apple/LensVLM-9B, как превью Hugging Face
export const S2: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const a = CUT[1], card = spr(t, W[15] - 0.1, fps, 13, 160);
  return (
    <>
      <Row y={420} size={60}><Word t={t} at={W[13]}>и</Word> <Word t={t} at={W[14]}>выложила</Word> <Word t={t} at={W[15]}>модель</Word></Row>
      <div style={{position: 'absolute', left: CX - 432, top: 505, width: 864, textAlign: 'center', fontFamily: CV, fontSize: 104, lineHeight: 1, color: ORANGE}}>
        <Word t={t} at={W[16]}>на</Word> <Word t={t} at={W[17]}>Hugging Face</Word>
      </div>
      <div style={{position: 'absolute', left: CX - 400, top: 700, width: 800, height: 440, borderRadius: 34, overflow: 'hidden', background: '#0E0F12',
        opacity: Math.min(1, card * 2), transform: `translateY(${(1 - Math.min(1, card)) * 140}px) rotate(${-2 + 2 * (1 - Math.min(1, card))}deg) scale(${0.85 + 0.15 * card})`,
        boxShadow: '0 0 0 3px rgba(255,255,255,.95), 0 50px 90px rgba(17,19,22,.3)'}}>
        <div style={{position: 'absolute', left: -160, top: 180, width: 560, height: 560, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(255,122,47,.75), rgba(255,122,47,0))'}} />
        <div style={{position: 'absolute', left: 420, top: -140, width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(255,210,30,.28), rgba(255,210,30,0))'}} />
        <div style={{position: 'absolute', left: 50, top: 60, display: 'flex', alignItems: 'center', gap: 14}}>
          <Img src={staticFile('lens/apple.svg')} style={{width: 40, height: 40, filter: 'invert(1)'}} />
          <span style={{fontFamily: MONO, fontWeight: 600, fontSize: 40, color: '#E8EAED'}}>apple</span>
        </div>
        <div style={{position: 'absolute', left: 50, top: 130, fontFamily: MONO, fontWeight: 700, fontSize: 84, color: '#FFFFFF', letterSpacing: '-0.01em'}}>/LensVLM-9B</div>
        <div style={{position: 'absolute', left: 50, bottom: 50, display: 'flex', alignItems: 'center', gap: 14}}>
          <Img src={staticFile('lens/huggingface.svg')} style={{width: 54, height: 50}} />
          <span style={{fontFamily: MONO, fontWeight: 500, fontSize: 34, color: '#C9CDD1'}}>huggingface.co</span>
        </div>
      </div>
      <Logo src="lens/huggingface.svg" size={150} x={1030} y={1150} p={spr(t, W[17] - 0.05, fps)} />
      <Pointer t={t} at={W[17] + 0.05} d="M 330 1420 C 330 1320, 360 1240, 420 1175" head={[420, 1175, -48]} />
      {void a}
    </>
  );
};
// Сцена 3: «Сейчас ты кидаешь в нейросеть договор на 100 страниц» — файл падает в поле чата
export const S3: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const a = CUT[2], chat = spr(t, a, fps, 15, 140), drop = spr(t, W[21] - 0.05, fps, 11, 150), pages = k(t, W[26] - 0.1, W[27] + 0.3);
  return (
    <>
      <Row y={420} size={54}><Word t={t} at={W[19]}>Сейчас</Word> <Word t={t} at={W[20]}>ты</Word> <Word t={t} at={W[21]}>кидаешь</Word> <Word t={t} at={W[22]}>в</Word> <Word t={t} at={W[23]}>нейросеть</Word></Row>
      <div style={{position: 'absolute', left: CX - 432, top: 505, width: 864, textAlign: 'center', fontFamily: CV, fontSize: 76, lineHeight: 1, color: ORANGE}}>
        <Word t={t} at={W[24]}>договор</Word> <Word t={t} at={W[25]}>на</Word> <Word t={t} at={W[26]}>100 страниц</Word>
      </div>
      {/* окно чата с полем ввода */}
      <div style={{position: 'absolute', left: CX - 400, top: 700, width: 800, height: 700, borderRadius: 40, background: '#FFFFFF', opacity: Math.min(1, chat * 2),
        transform: `translateY(${(1 - Math.min(1, chat)) * 120}px)`, boxShadow: '0 0 0 2px rgba(17,19,22,.06), 0 40px 80px rgba(17,19,22,.16)'}}>
        {[0, 1, 2].map((i) => <div key={i} style={{position: 'absolute', left: i % 2 ? 300 : 50, top: 60 + i * 110, width: 450, height: 76, borderRadius: 38, background: i % 2 ? 'rgba(255,122,47,.16)' : '#F1F2F4'}} />)}
        <div style={{position: 'absolute', left: 40, right: 40, bottom: 40, height: 110, borderRadius: 55, border: '3px solid rgba(17,19,22,.12)', display: 'flex', alignItems: 'center', padding: '0 24px 0 40px',
          fontFamily: SF, fontSize: 38, color: '#9AA0A6'}}>
          <span style={{flex: 1}}>Спроси по документу…</span>
          <div style={{width: 70, height: 70, borderRadius: 35, background: INK, display: 'grid', placeItems: 'center'}}><svg width={34} height={34} viewBox="0 0 24 24"><path d="M12 19 V5 M6 11 L12 5 L18 11" stroke="#FFF" strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
        </div>
      </div>
      {/* файл договора: стопка листов летит в чат и ложится над полем ввода */}
      <div style={{position: 'absolute', left: CX - 250, top: interpolate(Math.min(1.02, drop), [0, 1], [380, 1000]), width: 500, height: 150, opacity: Math.min(1, drop * 3),
        transform: `rotate(${(1 - Math.min(1, drop)) * -10}deg)`}}>
        {[2, 1].map((j) => <div key={j} style={{position: 'absolute', left: j * 10, top: -j * 10, width: 500, height: 150, borderRadius: 26, background: '#FFFFFF', boxShadow: '0 0 0 2px rgba(17,19,22,.08)'}} />)}
        <div style={{position: 'absolute', inset: 0, borderRadius: 26, background: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 22, padding: '0 28px', boxShadow: '0 0 0 2px rgba(17,19,22,.1), 0 24px 40px rgba(17,19,22,.18)'}}>
          <div style={{width: 84, height: 100, borderRadius: 12, background: ORANGE, color: '#FFF', display: 'grid', placeItems: 'center', fontFamily: SF, fontWeight: 700, fontSize: 28}}>PDF</div>
          <div>
            <div style={{fontFamily: SF, fontWeight: 600, fontSize: 40, color: INK}}>Договор.pdf</div>
            <div style={{fontFamily: SF, fontSize: 32, color: GREY}}>{Math.round(100 * pages)} страниц</div>
          </div>
        </div>
      </div>
    </>
  );
};
// Сцена 4: «и она читает каждую строчку, даже если нужен всего один пункт» — полоса чтения бежит по всем строкам,
// потом всё гаснет, кроме одной строки, её выделение с ручками — «один пункт»
export const S4: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const a = CUT[3], page = spr(t, a - 0.05, fps, 14, 140), N = 14, scan = k(t, W[30] - 0.05, W[33], (v) => v), only = k(t, W[35] - 0.1, W[35] + 0.3), sel = k(t, W[37] - 0.1, W[37] + 0.2);
  const cur = Math.floor(scan * N), pick = 9;
  return (
    <>
      <Row y={420} size={60}>{t < W[33] - 0.05 ? <><Word t={t} at={W[28]}>и</Word> <Word t={t} at={W[29]}>она</Word> <Word t={t} at={W[30]}>читает</Word></> : <><Word t={t} at={W[33]}>даже</Word> <Word t={t} at={W[34]}>если</Word> <Word t={t} at={W[35]}>нужен</Word> <Word t={t} at={W[36]}>всего</Word></>}</Row>
      <div style={{position: 'absolute', left: CX - 432, top: 505, width: 864, textAlign: 'center', fontFamily: CV, fontSize: 104, lineHeight: 1, color: ORANGE}}>
        {t < W[33] - 0.05 ? <><Word t={t} at={W[31]}>каждую</Word> <Word t={t} at={W[32]}>строчку</Word></> : <><Word t={t} at={W[37]}>один</Word> <Word t={t} at={W[38]}>пункт</Word></>}
      </div>
      <div style={{position: 'absolute', left: CX - 330, top: 690, width: 660, height: 880, borderRadius: 18, background: '#FFFFFF', padding: '60px 56px',
        transform: `rotate(${-2 * Math.min(1, page)}deg) translateY(${(1 - Math.min(1, page)) * 200}px)`, opacity: Math.min(1, page * 2), boxShadow: '0 0 0 2px rgba(17,19,22,.06), 0 40px 80px rgba(17,19,22,.16)'}}>
        <div style={{fontFamily: SF, fontWeight: 700, fontSize: 36, color: INK, marginBottom: 30}}>ДОГОВОР</div>
        {Array.from({length: N}, (_, i) => {
          const read = scan > 0 && i <= cur, now = scan > 0 && scan < 1 && i === cur, w = [100, 92, 96, 70, 100, 88, 94, 60, 100, 90, 84, 97, 76, 64][i];
          const dim = i === pick ? 0 : only;
          return (
            <div key={i} style={{position: 'relative', height: 46, marginBottom: 6}}>
              {now ? <div style={{position: 'absolute', left: -14, right: -14, top: -4, bottom: -4, borderRadius: 8, background: 'rgba(255,122,47,.28)'}} /> : null}
              <div style={{position: 'absolute', left: 0, top: 16, height: 14, width: `${w}%`, borderRadius: 7, background: i === pick && sel > 0 ? INK : read ? 'rgba(17,19,22,.55)' : 'rgba(17,19,22,.16)', opacity: 1 - 0.75 * dim}} />
              {i === pick ? <>
                <div style={{position: 'absolute', left: -12, top: -6, height: 58, width: `calc(${sel * 100}% + 24px)`, background: 'rgba(255,122,47,.3)'}} />
                <div style={{position: 'absolute', left: -15, top: -24, width: 6, height: 82, background: ORANGE, opacity: sel > 0 ? 1 : 0}}><div style={{position: 'absolute', left: -9, top: -12, width: 24, height: 24, borderRadius: 12, background: ORANGE}} /></div>
                <div style={{position: 'absolute', left: `calc(${sel * 100}% + 9px)`, top: -6, width: 6, height: 82, background: ORANGE, opacity: sel > 0 ? 1 : 0}}><div style={{position: 'absolute', left: -9, bottom: -12, width: 24, height: 24, borderRadius: 12, background: ORANGE}} /></div>
              </> : null}
            </div>
          );
        })}
      </div>
      <Pointer t={t} at={W[37] + 0.1} d="M 1180 1500 C 1180 1400, 1130 1300, 1060 1260" head={[1060, 1260, 208]} />
    </>
  );
};

type E = [number, string, number, boolean?, number?];
const SFX: E[] = [
  [W[0] - 0.05, 'pop', 0.3], [W[9] - 0.03, 'popup', 0.34], [W[11], 'crispy', 0.34],
  [CUT[1], 'sw-s6', 0.14, true], [W[15] - 0.1, 'es-open', 0.3], [W[17], 'pop', 0.3],
  [CUT[2], 'sw-s1', 0.14, true], [W[21] + 0.25, 'click4', 0.32], [W[26], 'count', 0.26],
  [CUT[3], 'sw-s7', 0.14, true], [W[30] - 0.05, 'type-a', 0.16, false, 1.3], [W[35] - 0.1, 'es-close', 0.26], [W[37] - 0.1, 'b5', 0.32], [W[38], 'chime', 0.3],
];
const SCENES = [S1, S2, S3, S4];
export const LensDemo: React.FC = () => {
  const frame = useCurrentFrame(), {fps} = useVideoConfig(), t = frame / fps;
  const seg = Math.max(0, CUT.findIndex((c, i) => t >= c && t < CUT[i + 1]));
  const Scene = SCENES[Math.min(3, seg)];
  const edge = Math.min(...CUT.slice(1, -1).map((c) => Math.abs(t - c))), blur = interpolate(edge, [0, 0.16], [16, 0], {extrapolateRight: 'clamp'}), fade = interpolate(edge, [0, 0.16], [0.35, 1], {extrapolateRight: 'clamp'});
  const push = interpolate(t, [CUT[seg], CUT[seg + 1] ?? END], [1, 1.035], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{background: PAPER}}>
      <AbsoluteFill style={{backgroundImage: 'linear-gradient(rgba(17,19,22,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(17,19,22,.045) 1px, transparent 1px)', backgroundSize: '48px 48px',
        backgroundPosition: `0 ${-t * 6}px`}} />
      <div style={{position: 'absolute', left: 520, top: -260 + Math.sin(t * 0.4) * 30, width: 900, height: 620, background: 'rgba(17,19,22,.035)', transform: 'rotate(28deg)'}} />
      <div style={{position: 'absolute', left: -320, top: 1320 - Math.sin(t * 0.4) * 30, width: 820, height: 560, background: 'rgba(17,19,22,.03)', transform: 'rotate(-32deg)'}} />
      <AbsoluteFill style={{transform: `scale(${push})`, transformOrigin: '720px 900px', filter: blur > 0.5 ? `blur(${blur}px)` : undefined, opacity: fade}}>
        <Scene t={t} fps={fps} />
      </AbsoluteFill>
      <div style={{position: 'absolute', left: CX - 380, top: 2400 - 720, width: 760, height: 720, borderRadius: 60, overflow: 'hidden', boxShadow: '0 0 0 4px rgba(255,255,255,.9), 0 40px 80px rgba(17,19,22,.25)'}}>
        <OffthreadVideo src={staticFile('lens/lens.mp4')} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 36%'}} />
      </div>
      {SFX.map(([at, c, v, pk, dd], i) => {
        const m = ISLA[c], from = Math.round((at - (pk ? m.peak : m.onset)) * fps);
        return <Sequence key={i} from={from} durationInFrames={Math.round((dd ?? (c.startsWith('type') ? 0.35 : m.dur)) * fps)} layout="none"><Audio src={staticFile(`sfx/isla/${c}.wav`)} volume={v} /></Sequence>;
      })}
    </AbsoluteFill>
  );
};
