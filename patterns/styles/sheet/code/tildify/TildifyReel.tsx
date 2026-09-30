import {AbsoluteFill, Easing, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import {CV, CX, GREY, INK, ISLA, k, Logo, ORANGE, PAPER, Plate, Pointer, Row, S1, S2, S3, S4, SF, SFX as SFX_DEMO, spr, typed, W, Word} from './TildifyDemo';

// Полный ролик Tildify (27.09.2026, 43,5 с) — референс «белый редакционный лист», шрифты Coolvetica + SF Pro.
// Первые 10 с — сцены демо (одобрены с правками). Дальше пять шагов переноса показаны НАСТОЯЩЕЙ записью экрана из официальной
// видеоинструкции Tildify (public/tildify/v01.mp4, 1920×970): кадрируем нужное место и ведём камеру к действию.
// Над записью — плашка «ШАГ n» и фраза из речи (SF + акцент Coolvetica), сверху полоска прогресса из пяти узлов.
export const TILDIFY_FRAMES = Math.round(43.9 * 60);
const END = 43.9;
export const TC = [0, W[11] - 0.1, W[22] - 0.04, W[27] - 0.06, W[32] - 0.1, W[40] - 0.1, W[46] - 0.08, W[60] - 0.1, W[70] - 0.1, W[76] - 0.08, W[79] - 0.1, W[91] - 0.1,
  W[101] - 0.1, W[109] - 0.1, END];
const SRC_W = 1920, SRC_H = 970;
type Box = [number, number, number, number];   // x, y, w, h в пикселях исходника
const lerpBox = (a: Box, b: Box, p: number): Box => a.map((v, i) => v + (b[i] - v) * p) as Box;

// Окно с записью экрана: кадрирование исходника, камера плавно едет от кадра a к кадру b; появление — подъём с пружиной
const Screen: React.FC<{t: number; a: number; fps: number; from: number; rate?: number; crop: Box; crop2?: Box; zoomAt?: [number, number]; card: Box; tilt?: number; children?: React.ReactNode}> =
  ({t, a, fps, from, rate = 1, crop, crop2, zoomAt, card, tilt = 0, children}) => {
    const p = spr(t, a, fps, 15, 130), z = crop2 && zoomAt ? k(t, zoomAt[0], zoomAt[1], Easing.bezier(0.65, 0, 0.35, 1)) : 0;
    const [cx, cy, cw] = crop2 ? lerpBox(crop, crop2, z) : crop, s = card[2] / cw;
    return (
      <div style={{position: 'absolute', left: card[0], top: card[1], width: card[2], height: card[3], borderRadius: 30, overflow: 'hidden', background: '#111',
        opacity: Math.min(1, p * 2), transform: `translateY(${(1 - Math.min(1, p)) * 160}px) rotate(${tilt}deg) scale(${0.92 + 0.08 * Math.min(1, p)})`,
        boxShadow: '0 0 0 3px rgba(255,255,255,.95), 0 0 0 5px rgba(17,19,22,.08), 0 50px 90px rgba(17,19,22,.25)'}}>
        <Sequence from={Math.round(a * fps)} layout="none">
          <OffthreadVideo src={staticFile('tildify/v01.mp4')} startFrom={Math.round(from * fps)} playbackRate={rate} muted
            style={{position: 'absolute', left: -cx * s, top: -cy * s, width: SRC_W * s, height: SRC_H * s, maxWidth: 'none'}} />
        </Sequence>
        {children}
      </div>
    );
  };
// Заголовок шага: плашка «ШАГ n», строка SF и акцент Coolvetica
const Head: React.FC<{t: number; fps: number; a: number; n: number; line: React.ReactNode; accent: React.ReactNode; size?: number}> = ({t, fps, a, n, line, accent, size = 96}) => {
  const b = spr(t, a, fps, 12, 200);
  return (
    <>
      <div style={{position: 'absolute', left: CX, top: 395, transform: `translateX(-50%) scale(${0.6 + 0.4 * Math.min(1.05, b)})`, opacity: Math.min(1, b * 2), width: 'max-content',
        padding: '10px 26px', borderRadius: 40, background: INK, color: '#FFFFFF', fontFamily: SF, fontWeight: 700, fontSize: 34, letterSpacing: '0.06em'}}>ШАГ {n}</div>
      <Row y={470} size={58}>{line}</Row>
      <div style={{position: 'absolute', left: CX - 432, top: 545, width: 864, textAlign: 'center', fontFamily: CV, fontSize: size, lineHeight: 1, color: ORANGE}}>{accent}</div>
    </>
  );
};
// Прогресс пяти шагов: узлы на линии, пройденные — чёрные, текущий — оранжевый (над заголовком шага)
const Progress: React.FC<{t: number; step: number}> = ({t, step}) => (
  <svg width={520} height={40} style={{position: 'absolute', left: CX - 260, top: 1590, opacity: k(t, TC[4], TC[4] + 0.3) * (1 - k(t, TC[10] - 0.2, TC[10]))}}>
    <line x1={20} y1={20} x2={500} y2={20} stroke="rgba(17,19,22,.2)" strokeWidth={4} />
    <line x1={20} y1={20} x2={20 + 120 * Math.max(0, step - 1)} y2={20} stroke={INK} strokeWidth={4} />
    {[0, 1, 2, 3, 4].map((i) => <circle key={i} cx={20 + i * 120} cy={20} r={i + 1 === step ? 14 : 10} fill={i + 1 === step ? ORANGE : i + 1 < step ? INK : '#FFFFFF'} stroke={INK} strokeWidth={i + 1 === step ? 0 : 3} />)}
  </svg>
);
const WIDE: Box = [288, 760, 864, 436], TALL: Box = [410, 705, 620, 800];

// Шаг 1: «Открываешь свой сайт в браузере, жмёшь на иконку» — камера едет к иконке расширения
const S5: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const a = TC[4];
  return (
    <>
      <Head t={t} fps={fps} a={a} n={1} line={<><Word t={t} at={W[32]}>Открываешь</Word> <Word t={t} at={W[33]}>свой</Word> <Word t={t} at={W[34]}>сайт</Word></>}
        accent={<><Word t={t} at={W[37]}>жмёшь</Word> <Word t={t} at={W[38]}>на</Word> <Word t={t} at={W[39]}>иконку</Word></>} />
      <Screen t={t} a={a} fps={fps} from={48.6} crop={[0, 0, 1920, 970]} crop2={[1240, 0, 680, 343]} zoomAt={[W[37] - 0.4, W[37] + 0.3]} card={WIDE} />
      <Pointer t={t} at={W[39] - 0.1} d="M 1060 1420 C 1060 1330, 1030 1270, 980 1225" head={[980, 1225, 225]} />
    </>
  );
};
// Шаг 2: «выбираешь, под какие экраны нужна версия» — настоящий попап, ширины переключаются на записи
const S6: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const a = TC[5];
  return (
    <>
      <Head t={t} fps={fps} a={a} n={2} line={<Word t={t} at={W[40]}>выбираешь, под какие</Word>} accent={<Word t={t} at={W[43]}>экраны нужна версия</Word>} size={80} />
      <Screen t={t} a={a} fps={fps} from={55.6} rate={1.1} crop={[1168, 60, 476, 614]} card={TALL} tilt={2} />
    </>
  );
};
// Шаг 3: «и кликаешь по блоку. Расширение снимает его под выбранную ширину и копирует код импорта» — три отрезка записи
const S7: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const a = TC[6], b1 = W[50] - 0.05, b2 = W[57] - 0.1, chip = spr(t, W[58] - 0.1, fps, 12, 200);
  return (
    <>
      <Head t={t} fps={fps} a={a} n={3} line={t < b1 ? <><Word t={t} at={W[47]}>кликаешь</Word> <Word t={t} at={W[48]}>по</Word></> : <><Word t={t} at={W[50]}>расширение</Word> <Word t={t} at={W[51]}>снимает</Word></>}
        accent={t < b1 ? <Word t={t} at={W[49]}>блоку</Word> : t < b2 ? <Word t={t} at={W[54]}>под выбранную ширину</Word> : <Word t={t} at={W[57]}>и копирует код</Word>} size={t < b1 ? 110 : t < b2 ? 74 : 96} />
      {t < b1 ? <Screen t={t} a={a} fps={fps} from={63.6} crop={[0, 0, 1920, 970]} crop2={[300, 60, 1100, 555]} zoomAt={[a + 0.2, a + 1.2]} card={WIDE} /> : null}
      {t >= b1 && t < b2 ? <Screen t={t} a={b1} fps={fps} from={70.2} crop={[0, 0, 1920, 970]} card={WIDE} /> : null}
      {t >= b2 ? <Screen t={t} a={b2} fps={fps} from={72.8} crop={[0, 0, 1920, 970]} crop2={[420, 0, 1000, 505]} zoomAt={[b2 + 0.2, b2 + 0.9]} card={WIDE} /> : null}
      {/* «код импорта скопирован» — плашка с галочкой и выделенным ID */}
      <div style={{position: 'absolute', left: CX, top: 1270, transform: `translateX(-50%) scale(${0.7 + 0.3 * Math.min(1.05, chip)})`, opacity: Math.min(1, chip * 2), width: 'max-content',
        display: 'flex', alignItems: 'center', gap: 20, padding: '20px 32px', borderRadius: 26, background: '#FFFFFF', boxShadow: '0 20px 40px rgba(17,19,22,.16)'}}>
        <span style={{width: 48, height: 48, borderRadius: 24, background: '#1DB45A', color: '#FFFFFF', display: 'grid', placeItems: 'center', fontFamily: SF, fontWeight: 700, fontSize: 30}}>✓</span>
        <span style={{fontFamily: SF, fontWeight: 500, fontSize: 40, color: INK}}>код импорта</span>
        <span style={{fontFamily: 'SF Mono', fontWeight: 600, fontSize: 34, color: INK, background: 'rgba(255,122,47,.26)', padding: '4px 10px'}}>{typed('eu1ew5113fqhi', t, W[58], W[59] + 0.3)}</span>
      </div>
    </>
  );
};
// Шаг 4: «Дальше в Тильде создаёшь пустой Zero Block, жмёшь ту же иконку»
const S8: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const a = TC[7];
  return (
    <>
      <Head t={t} fps={fps} a={a} n={4} line={<><Word t={t} at={W[62]}>в Тильде</Word> <Word t={t} at={W[63]}>создаёшь</Word> <Word t={t} at={W[64]}>пустой</Word></>} accent={<Word t={t} at={W[65]}>Zero Block</Word>} size={116} />
      <Screen t={t} a={a} fps={fps} from={83.9} crop={[0, 0, 1920, 970]} crop2={[0, 0, 760, 384]} zoomAt={[W[66] - 0.3, W[66] + 0.4]} card={WIDE} />
      <Pointer t={t} at={W[69] - 0.15} d="M 380 1420 C 380 1330, 400 1270, 440 1225" head={[440, 1225, -60]} />
      <Row y={1270} size={40} color={GREY}><Word t={t} at={W[66]}>жмёшь</Word> <Word t={t} at={W[67]}>ту же</Word> <Word t={t} at={W[69]}>иконку Tildify</Word></Row>
    </>
  );
};
// Шаг 5: «вставляешь код и блок на месте»
const S9: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const a = TC[8], b = W[73] - 0.1;
  return (
    <>
      <Head t={t} fps={fps} a={a} n={5} line={<><Word t={t} at={W[70]}>вставляешь</Word> <Word t={t} at={W[71]}>код</Word></>} accent={<><Word t={t} at={W[73]}>и блок</Word> <Word t={t} at={W[75]}>на месте</Word></>} size={110} />
      {t < b ? <Screen t={t} a={a} fps={fps} from={88.2} crop={[680, 180, 560, 722]} card={TALL} tilt={-1.5} /> : <Screen t={t} a={b} fps={fps} from={92.9} crop={[0, 0, 1920, 970]} card={WIDE} />}
    </>
  );
};
// «Все элементы редактируются» — запись редактора, рамки выделения поверх
const S10: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const a = TC[9];
  return (
    <>
      <Row y={430} size={64}><Word t={t} at={W[76]}>Все</Word> <Word t={t} at={W[77]}>элементы</Word></Row>
      <div style={{position: 'absolute', left: CX - 432, top: 515, width: 864, textAlign: 'center', fontFamily: CV, fontSize: 114, lineHeight: 1, color: ORANGE}}><Word t={t} at={W[78]}>редактируются</Word></div>
      <Screen t={t} a={a} fps={fps} from={95.4} crop={[250, 120, 1200, 606]} crop2={[420, 200, 900, 454]} zoomAt={[a + 0.3, TC[10]]} card={WIDE} />
    </>
  );
};
// «На этой неделе вышла третья версия. Теперь переносится и в новый Vibe Block»
const S11: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const vibe = spr(t, W[89] - 0.1, fps, 12, 180);
  return (
    <>
      <Row y={430} size={60}><Word t={t} at={W[79]}>на</Word> <Word t={t} at={W[80]}>этой</Word> <Word t={t} at={W[81]}>неделе</Word> <Word t={t} at={W[82]}>вышла</Word></Row>
      <div style={{position: 'absolute', left: CX, top: 520, transform: 'translateX(-50%)', width: 'max-content', display: 'flex', alignItems: 'baseline', gap: 26}}>
        <Word t={t} at={W[83]} style={{fontFamily: CV, fontSize: 150, color: INK}}>Tildify</Word>
      </div>
      <Plate t={t} at={W[84] - 0.05} text="3.0" y={700} size={220} fps={fps} r={-3} />
      <Row y={1010} size={56}><Word t={t} at={W[85]}>теперь</Word> <Word t={t} at={W[86]}>переносится</Word> <Word t={t} at={W[87]}>и в</Word> <Word t={t} at={W[89]}>новый</Word></Row>
      <div style={{position: 'absolute', left: CX, top: 1110, transform: `translateX(-50%) scale(${0.6 + 0.4 * Math.min(1.05, vibe)})`, opacity: Math.min(1, vibe * 2), width: 'max-content',
        display: 'flex', alignItems: 'center', gap: 24, padding: '22px 40px', borderRadius: 70, background: '#FFFFFF', boxShadow: '0 20px 40px rgba(17,19,22,.16)'}}>
        <Img src={staticFile('tildify/tilda-logo-a.svg')} style={{width: 84, height: 84}} />
        <span style={{fontFamily: CV, fontSize: 96, color: INK}}>Vibe Block</span>
      </div>
      <Pointer t={t} at={W[90]} d="M 330 1420 C 330 1330, 360 1250, 420 1200" head={[420, 1200, -45]} />
    </>
  );
};
// «Бесплатно 10 переносов в месяц. Безлимит за 5 баксов» — выделение с ручками и акцент Coolvetica
const S12: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const sel = k(t, W[91] - 0.05, W[95] + 0.2, Easing.bezier(0.45, 0, 0.25, 1));
  return (
    <>
      <div style={{position: 'absolute', left: CX, top: 520, transform: 'translateX(-50%)', width: 'max-content', fontFamily: SF, fontWeight: 400, fontSize: 52, color: INK}}>
        <div style={{position: 'absolute', left: -14, top: -8, bottom: -8, width: `calc(${sel * 100}% + 28px)`, background: 'rgba(255,122,47,.26)'}} />
        <div style={{position: 'absolute', left: -17, top: -26, width: 6, height: 110, background: ORANGE}}><div style={{position: 'absolute', left: -9, top: -12, width: 24, height: 24, borderRadius: 12, background: ORANGE}} /></div>
        <div style={{position: 'absolute', left: `calc(${sel * 100}% + 11px)`, top: -8, width: 6, height: 110, background: ORANGE}}><div style={{position: 'absolute', left: -9, bottom: -12, width: 24, height: 24, borderRadius: 12, background: ORANGE}} /></div>
        <span style={{position: 'relative'}}><Word t={t} at={W[91]}>Бесплатно</Word> <Word t={t} at={W[92]} style={{fontFamily: CV, fontSize: 66, color: ORANGE}}>10</Word> <Word t={t} at={W[93]}>переносов</Word> <Word t={t} at={W[95]}>в месяц</Word></span>
      </div>
      <Row y={720} size={60}><Word t={t} at={W[96]}>безлимит</Word></Row>
      <div style={{position: 'absolute', left: CX, top: 800, transform: 'translateX(-50%)', width: 'max-content', fontFamily: CV, fontSize: 250, lineHeight: 1, color: INK, textShadow: '0 8px 0 rgba(17,19,22,.12)'}}>
        <Word t={t} at={W[98]}>за</Word> <Word t={t} at={W[99]}>$5</Word>
      </div>
      <Plate t={t} at={W[100] - 0.05} text="в месяц" y={1075} size={110} fps={fps} r={-3} />
    </>
  );
};
// «Скинь это тому, кто делает сайты на Тильде» — самолётик отправки летит к адресату
const S13: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const fly = k(t, W[101], W[103] + 0.2, Easing.bezier(0.45, 0, 0.2, 1)), px = interpolate(fly, [0, 1], [380, 960]), py = interpolate(fly, [0, 1], [1260, 1000]) - Math.sin(fly * Math.PI) * 160;
  return (
    <>
      <Row y={430} size={64}><Word t={t} at={W[101]}>Скинь</Word> <Word t={t} at={W[102]}>это</Word> <Word t={t} at={W[103]}>тому,</Word></Row>
      <div style={{position: 'absolute', left: CX - 432, top: 520, width: 864, textAlign: 'center', fontFamily: CV, fontSize: 96, lineHeight: 1, color: ORANGE}}>
        <Word t={t} at={W[104]}>кто</Word> <Word t={t} at={W[105]}>делает</Word> <Word t={t} at={W[106]}>сайты</Word>
      </div>
      <div style={{position: 'absolute', left: CX - 432, top: 622, width: 864, textAlign: 'center', fontFamily: CV, fontSize: 96, lineHeight: 1, color: ORANGE}}>
        <Word t={t} at={W[107]}>на</Word> <Word t={t} at={W[108]}>Тильде</Word>
      </div>
      <svg width={1440} height={1700} style={{position: 'absolute', left: 0, top: 0}}>
        <path d={`M 380 1260 Q 670 ${1260 - 320} 960 1000`} fill="none" stroke="rgba(17,19,22,.35)" strokeWidth={5} strokeDasharray="14 14" pathLength={1} style={{strokeDasharray: `${fly} 1`}} />
      </svg>
      <div style={{position: 'absolute', left: px - 60, top: py - 60, width: 120, height: 120, borderRadius: 60, background: INK, display: 'grid', placeItems: 'center', opacity: k(t, W[101] - 0.1, W[101] + 0.1),
        transform: `rotate(${-20 + 40 * fly}deg)`, boxShadow: '0 20px 40px rgba(17,19,22,.25)'}}>
        <svg width={60} height={60} viewBox="0 0 24 24"><path d="M3 12 L20 4 L14 21 L11 13 Z" fill="#FFFFFF" /></svg>
      </div>
      <Logo src="tildify/tilda-logo-a.svg" size={180} x={1000} y={1000} p={spr(t, W[108] - 0.2, fps)} />
    </>
  );
};
// Призыв: «Напиши слово «тильда» в комментариях — пришлю ссылку и инструкцию»
const S14: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const word = typed('тильда', t, W[111] - 0.05, W[111] + 0.35), sent = k(t, W[112], W[112] + 0.2), pill = spr(t, W[114] - 0.1, fps, 12, 180), bye = k(t, END - 0.45, END - 0.05);
  return (
    <>
      <Row y={430} size={64}><Word t={t} at={W[109]}>Напиши</Word> <Word t={t} at={W[110]}>слово</Word></Row>
      <div style={{position: 'absolute', left: CX - 390, top: 580 - sent * 40, width: 780, height: 170, borderRadius: 85, display: 'flex', alignItems: 'center', padding: '0 34px 0 60px',
        background: '#FFFFFF', boxShadow: '0 0 0 3px rgba(17,19,22,.08), 0 30px 60px rgba(17,19,22,.16)'}}>
        <span style={{flex: 1, fontFamily: CV, fontSize: 100, color: INK}}>{word}<span style={{color: ORANGE, opacity: sent > 0 ? 0 : Math.floor(t * 3) % 2}}>|</span></span>
        <div style={{width: 110, height: 110, borderRadius: 55, background: sent > 0 ? ORANGE : 'rgba(17,19,22,.15)', display: 'grid', placeItems: 'center', transform: `scale(${1 + 0.2 * Math.sin(Math.PI * sent)})`}}>
          <svg width={52} height={52} viewBox="0 0 24 24"><path d="M3 12 L20 4 L14 21 L11 13 Z" fill="#FFFFFF" /></svg>
        </div>
      </div>
      <Row y={800} size={48} color={GREY}><Word t={t} at={W[112]}>в</Word> <Word t={t} at={W[113]}>комментариях</Word></Row>
      <div style={{position: 'absolute', left: CX, top: 930, transform: `translateX(-50%) translateY(${(1 - Math.min(1, pill)) * 120}px) scale(${0.7 + 0.3 * Math.min(1.04, pill)})`, opacity: Math.min(1, pill * 2),
        width: 'max-content', padding: '26px 46px', borderRadius: 70, background: ORANGE, color: '#FFFFFF', fontFamily: SF, fontWeight: 600, fontSize: 52,
        boxShadow: 'inset 0 3px 0 rgba(255,255,255,.35), 0 10px 0 #C24F14, 0 34px 50px rgba(120,45,0,.28)'}}>пришлю ссылку и инструкцию</div>
      <AbsoluteFill style={{background: PAPER, opacity: bye * 0}} />
    </>
  );
};

const SCENES = [S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14];
type E = [number, string, number, boolean?, number?];
const SFX: E[] = [
  ...(SFX_DEMO as E[]).filter((e) => e[0] < TC[4] - 0.2),
  // шаг 1: смена сцены, клик по иконке
  [TC[4], 'sw-s4', 0.14, true], [W[39] - 0.05, 'click', 0.32],
  // шаг 2: свист, щелчки выбора ширин (на записи)
  [TC[5], 'sw-s7', 0.14, true], [W[43], 'b2', 0.3], [W[45], 'b5', 0.3],
  // шаг 3: клик по блоку, снимок (трансформация), код скопирован
  [TC[6], 'sw-s1', 0.14, true], [W[47] + 0.1, 'click4', 0.32], [W[51], 'tr-b', 0.22, true], [W[58] - 0.1, 'notif', 0.3],
  // шаг 4 и 5: свист, клик по иконке, вставка, блок на месте — успех
  [TC[7], 'sw-s6', 0.14, true], [W[69], 'click', 0.3], [TC[8], 'sw-s5', 0.14, true], [W[70] + 0.3, 'crispy', 0.36], [W[73], 'confirm', 0.3],
  // редактируются, 3.0, Vibe Block
  [TC[9], 'sw-s4', 0.13, true], [W[78], 'select', 0.3], [TC[10], 'sw-s7', 0.14, true], [W[84] - 0.02, 'popup', 0.34], [W[89], 'pop', 0.3],
  // цена: «10» — дзинь, $5 — щелчок, плашка
  [TC[11], 'sw-s1', 0.14, true], [W[92], 'chime', 0.32], [W[99], 'click4', 0.3], [W[100] - 0.02, 'popup', 0.32],
  // отправка и призыв
  [TC[12], 'sw-s6', 0.14, true], [W[101], 'sw-s7', 0.12, true], [W[108], 'pop', 0.3], [TC[13], 'sw-s5', 0.14, true], [W[111] - 0.05, 'type-a', 0.2, false, 0.4],
  [W[112], 'click', 0.32], [W[114] - 0.05, 'chime', 0.3],
];

export const TildifyReel: React.FC = () => {
  const frame = useCurrentFrame(), {fps} = useVideoConfig(), t = frame / fps;
  const seg = Math.max(0, TC.findIndex((c, i) => t >= c && t < TC[i + 1]));
  const Scene = SCENES[Math.min(SCENES.length - 1, seg)];
  const edge = Math.min(...TC.slice(1, -1).map((c) => Math.abs(t - c))), blur = interpolate(edge, [0, 0.16], [16, 0], {extrapolateRight: 'clamp'}), fade = interpolate(edge, [0, 0.16], [0.35, 1], {extrapolateRight: 'clamp'});
  const push = interpolate(t, [TC[seg], TC[seg + 1] ?? END], [1, 1.035], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const step = seg >= 4 && seg <= 8 ? seg - 3 : 0, out = k(t, END - 0.5, END - 0.05);
  return (
    <AbsoluteFill style={{background: PAPER}}>
      <AbsoluteFill style={{backgroundImage: 'linear-gradient(rgba(17,19,22,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(17,19,22,.045) 1px, transparent 1px)', backgroundSize: '48px 48px',
        backgroundPosition: `0 ${-t * 6}px`}} />
      <div style={{position: 'absolute', left: 520, top: -260 + Math.sin(t * 0.4) * 30, width: 900, height: 620, background: 'rgba(17,19,22,.035)', transform: 'rotate(28deg)'}} />
      <div style={{position: 'absolute', left: -320, top: 1320 - Math.sin(t * 0.4) * 30, width: 820, height: 560, background: 'rgba(17,19,22,.03)', transform: 'rotate(-32deg)'}} />
      <AbsoluteFill style={{transform: `scale(${push})`, transformOrigin: '720px 900px', filter: blur > 0.5 ? `blur(${blur}px)` : undefined, opacity: fade}}>
        <Scene t={t} fps={fps} />
      </AbsoluteFill>
      {step ? <Progress t={t} step={step} /> : null}
      <div style={{position: 'absolute', left: CX - 380, top: 2400 - 720, width: 760, height: 720, borderRadius: 60, overflow: 'hidden', boxShadow: '0 0 0 4px rgba(255,255,255,.9), 0 40px 80px rgba(17,19,22,.25)'}}>
        <OffthreadVideo src={staticFile('tildify/tildify.mp4')} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 36%'}} />
      </div>
      <AbsoluteFill style={{background: '#000', opacity: out}} />
      {SFX.map(([at, c, v, pk, dd], i) => {
        const m = ISLA[c], from = Math.round((at - (pk ? m.peak : m.onset)) * fps);
        return <Sequence key={i} from={from} durationInFrames={Math.round((dd ?? (c.startsWith('type') ? 0.35 : m.dur)) * fps)} layout="none"><Audio src={staticFile(`sfx/isla/${c}.wav`)} volume={v} /></Sequence>;
      })}
    </AbsoluteFill>
  );
};
