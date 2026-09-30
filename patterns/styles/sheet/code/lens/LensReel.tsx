import {AbsoluteFill, Easing, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import {CV, CX, GREY, INK, ISLA, k, Logo, ORANGE, PAPER, Plate, Pointer, Row, SF, spr, typed, Word} from '../tildify/TildifyDemo';
import {MONO, S1, S2, S3, S4, W} from './LensDemo';

// Полный ролик Apple LensVLM (27.09.2026, 41,9 с) в стиле 14 ЛИСТ. Первые 12 с — сцены примера.
// Сжатие страниц показано настоящими картинками из статьи Apple (arXiv 2605.07019, рис. 7: одна страница при 5×, 10×, 15×).
// «упаковывает в референс» — последнее слово в расшифровке сомнительно, поэтому в кадре его нет, только «выписывает главное из PDF».
export const LENS_FRAMES = Math.round(42.2 * 60);
const END = 42.2;
export const LC = [0, W[13] - 0.08, W[19] - 0.1, W[28] - 0.1, W[39] - 0.1, W[50] - 0.12, W[65] - 0.1, W[71] - 0.1, W[85] - 0.1, W[95] - 0.1, W[103] - 0.1, W[111] - 0.1, END];
const Accent: React.FC<{y?: number; size?: number; children: React.ReactNode}> = ({y = 505, size = 104, children}) => (
  <div style={{position: 'absolute', left: CX - 432, top: y, width: 864, textAlign: 'center', fontFamily: CV, fontSize: size, lineHeight: 1, color: ORANGE}}>{children}</div>
);
const Page: React.FC<{src: string; x: number; y: number; w: number; p: number; r?: number; glow?: number}> = ({src, x, y, w, p, r = 0, glow = 0}) => (
  <div style={{position: 'absolute', left: x - w / 2, top: y, width: w, padding: w * 0.04, borderRadius: 10, background: '#FFFFFF', opacity: Math.min(1, p * 2),
    transform: `translateY(${(1 - Math.min(1, p)) * 80}px) rotate(${r}deg) scale(${0.6 + 0.4 * Math.min(1.04, p)})`,
    boxShadow: `0 0 0 2px rgba(17,19,22,.08), 0 20px 40px rgba(17,19,22,.16), 0 0 0 ${10 * glow}px rgba(255,122,47,${0.35 * glow})`}}>
    <Img src={staticFile(src)} style={{width: '100%', display: 'block', imageRendering: 'auto'}} />
  </div>
);

// «Новая модель Apple LensVLM сжимает документ в маленькие картинки страниц» — страница уменьшается 5× → 10× → 15×, потом их сетка
const S5: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const a = LC[4], step = t < W[47] ? 0 : t < W[48] ? 1 : 2, grid = k(t, W[49] - 0.2, W[49] + 0.5);
  const size = [520, 340, 250][step], src = ['lens/p5.png', 'lens/p10.png', 'lens/p15.png'][step];
  return (
    <>
      <div style={{position: 'absolute', left: CX, top: 400, transform: 'translateX(-50%)', width: 'max-content', display: 'flex', alignItems: 'center', gap: 20}}>
        <Img src={staticFile('lens/apple.svg')} style={{width: 70, height: 70, opacity: k(t, W[41] - 0.1, W[41] + 0.2)}} />
        <span style={{fontFamily: CV, fontSize: 110, color: INK}}><Word t={t} at={W[41]}>LensVLM</Word></span>
      </div>
      <Row y={540} size={56}><Word t={t} at={W[44]}>сжимает</Word> <Word t={t} at={W[45]}>документ</Word> <Word t={t} at={W[46]}>в</Word></Row>
      <Accent y={615} size={84}><Word t={t} at={W[47]}>маленькие</Word> <Word t={t} at={W[48]}>картинки</Word></Accent>
      {grid < 0.05 ? <Page src={src} x={CX} y={760 + (520 - size) * 0.4} w={size} p={spr(t, a + 0.05, fps)} r={-2} /> : null}
      {grid > 0 ? Array.from({length: 12}, (_, i) => {
        const c = i % 4, r = Math.floor(i / 4), p = k(t, W[49] - 0.2 + i * 0.04, W[49] + 0.2 + i * 0.04, Easing.bezier(0.2, 1.4, 0.4, 1));
        return <Page key={i} src="lens/p15.png" x={CX - 300 + c * 200} y={760 + r * 250} w={150} p={p} r={((i * 5) % 7) - 3} />;
      }) : null}
      <div style={{position: 'absolute', left: CX, top: 1540, transform: 'translateX(-50%)', width: 'max-content', padding: '12px 30px', borderRadius: 40, background: INK, color: '#FFFFFF',
        fontFamily: SF, fontWeight: 600, fontSize: 38, opacity: k(t, W[47], W[47] + 0.3)}}>сжатие {['5×', '10×', '15×'][step]} · рисунок из статьи Apple</div>
    </>
  );
};
// «пролистывает их, как ты пролистываешь PDF, и полностью открывает только те страницы, где есть ответ»
const S6: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const a = LC[5], scroll = k(t, a + 0.1, W[57], Easing.bezier(0.45, 0, 0.25, 1)), open = spr(t, W[58] - 0.1, fps, 13, 150), ans = k(t, W[62], W[64] + 0.3);
  const X = (i: number) => CX - 380 + i * 170 - scroll * 520;
  return (
    <>
      <Row y={420} size={56}>{t < W[56] ? <><Word t={t} at={W[50]}>пролистывает</Word> <Word t={t} at={W[51]}>их</Word></> : <><Word t={t} at={W[57]}>полностью</Word> <Word t={t} at={W[58]}>открывает</Word> <Word t={t} at={W[59]}>только</Word></>}</Row>
      <Accent size={84}>{t < W[56] ? <><Word t={t} at={W[52]}>как</Word> <Word t={t} at={W[55]}>PDF</Word></> : <><Word t={t} at={W[61]}>страницы</Word> <Word t={t} at={W[62]}>с ответом</Word></>}</Accent>
      {/* лента миниатюр, как боковая панель PDF; линза едет по ней */}
      <div style={{position: 'absolute', left: 288, top: 690, width: 864, height: 250, overflow: 'hidden', borderRadius: 24, background: 'rgba(17,19,22,.04)'}}>
        {Array.from({length: 9}, (_, i) => <div key={i} style={{position: 'absolute', left: X(i) - 288 - 60, top: 30}}>
          <div style={{width: 120, padding: 5, borderRadius: 8, background: '#FFF', boxShadow: `0 0 0 ${i === 2 || i === 5 ? 4 * Math.min(1, open) : 1}px ${i === 2 || i === 5 ? ORANGE : 'rgba(17,19,22,.12)'}`}}>
            <Img src={staticFile('lens/p15.png')} style={{width: '100%', display: 'block'}} /></div>
          <div style={{textAlign: 'center', fontFamily: SF, fontSize: 30, color: GREY, marginTop: 6}}>{i + 1}</div>
        </div>)}
      </div>
      <svg width={120} height={120} viewBox="0 0 24 24" style={{position: 'absolute', left: CX - 60 + Math.sin(t * 3) * 30, top: 740, opacity: 1 - Math.min(1, open)}}>
        <circle cx={10} cy={10} r={7} fill="rgba(255,255,255,.35)" stroke={INK} strokeWidth={2.2} /><path d="M15 15 L21 21" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      </svg>
      {/* страницы 3 и 6 раскрываются полностью; на странице с ответом выделяется строка */}
      {[0, 1].map((j) => (
        <div key={j} style={{position: 'absolute', left: j ? 740 : 330, top: 990, width: 370, opacity: Math.min(1, open * 2),
          transform: `translateY(${(1 - Math.min(1, open)) * -200}px) scale(${0.4 + 0.6 * Math.min(1.03, open)}) rotate(${j ? 2 : -2}deg)`}}>
          <div style={{position: 'relative', padding: 14, borderRadius: 12, background: '#FFF', boxShadow: '0 30px 60px rgba(17,19,22,.18)'}}>
            <Img src={staticFile('lens/p5.png')} style={{width: '100%', display: 'block'}} />
            {j === 1 ? <div style={{position: 'absolute', left: 10, top: 118, height: 34, width: `${ans * 94}%`, background: 'rgba(255,122,47,.35)'}} /> : null}
          </div>
          <div style={{textAlign: 'center', fontFamily: SF, fontWeight: 600, fontSize: 34, color: INK, marginTop: 10}}>страница {j ? 6 : 3}</div>
        </div>
      ))}
      <Pointer t={t} at={W[64]} d="M 1200 1560 C 1200 1450, 1170 1330, 1110 1260" head={[1110, 1260, 225]} />
    </>
  );
};
// «Можешь использовать её для своих продуктов»
const S7: React.FC<{t: number; fps: number}> = ({t, fps}) => (
  <>
    <Row y={560} size={60}><Word t={t} at={W[65]}>Можешь</Word> <Word t={t} at={W[66]}>использовать</Word> <Word t={t} at={W[67]}>её</Word></Row>
    <Plate t={t} at={W[69] - 0.05} text="для своих продуктов" y={690} size={72} fps={fps} />
    <Pointer t={t} at={W[70]} d="M 260 1150 C 260 1040, 300 960, 360 910" head={[360, 910, -45]} />
    <Pointer t={t} at={W[70] + 0.08} d="M 1180 1150 C 1180 1040, 1140 960, 1080 910" head={[1080, 910, 222]} />
  </>
);
// «например, Telegram-бот за подписку, который выписывает контент из PDF и упаковывает…» — телефон с чатом бота
const S8: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const a = LC[7], ph = spr(t, a - 0.02, fps, 15, 110), pdf = spr(t, W[77] - 0.2, fps), rep = k(t, W[78], W[82] + 0.5, (v) => v), sub = spr(t, W[75] - 0.1, fps);
  const lines = ['• Стороны и предмет договора', '• Сроки и оплата', '• Ответственность сторон'];
  const Bubble: React.FC<{me?: boolean; children: React.ReactNode; p: number}> = ({me, children, p}) => (
    <div style={{alignSelf: me ? 'flex-end' : 'flex-start', maxWidth: 470, padding: '18px 24px', borderRadius: 26, background: me ? '#E3F7D2' : '#FFFFFF', fontFamily: SF, fontSize: 30, lineHeight: 1.35, color: INK,
      opacity: Math.min(1, p * 2), transform: `translateY(${(1 - Math.min(1, p)) * 40}px)`, boxShadow: '0 2px 0 rgba(17,19,22,.06)'}}>{children}</div>
  );
  return (
    <>
      <Row y={400} size={54}><Word t={t} at={W[71]}>например</Word></Row>
      <Accent y={470} size={100}><Word t={t} at={W[72]}>Telegram-бот</Word></Accent>
      <div style={{position: 'absolute', left: 370, top: 610, width: 620, height: 980, perspective: 2400}}>
        <div style={{position: 'absolute', inset: 0, borderRadius: 86, padding: 14, background: 'linear-gradient(135deg, #E9ECEF, #9AA1A8 45%, #F4F5F6 60%, #7E858C)',
          transform: `translateY(${(1 - Math.min(1, ph)) * 800}px) rotateY(${-10 + 5 * ph}deg) rotateZ(${-3 + 1.5 * ph}deg)`, boxShadow: '0 60px 100px rgba(17,19,22,.3)'}}>
          <div style={{width: '100%', height: '100%', borderRadius: 74, background: '#DCE6D2', overflow: 'hidden', display: 'flex', flexDirection: 'column'}}>
            <div style={{height: 150, background: '#FFFFFF', display: 'flex', alignItems: 'flex-end', gap: 16, padding: '0 34px 22px'}}>
              <Img src={staticFile('lens/telegram-color.svg')} style={{width: 64, height: 64}} />
              <div><div style={{fontFamily: SF, fontWeight: 700, fontSize: 32, color: INK}}>PDF-бот</div><div style={{fontFamily: SF, fontSize: 24, color: GREY}}>бот</div></div>
            </div>
            <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 16, padding: '28px 24px'}}>
              <Bubble me p={pdf}><span style={{display: 'inline-flex', alignItems: 'center', gap: 12}}><span style={{width: 50, height: 60, borderRadius: 8, background: ORANGE, color: '#FFF', fontSize: 18, fontWeight: 700, display: 'grid', placeItems: 'center'}}>PDF</span>Договор.pdf</span></Bubble>
              <Bubble p={k(t, W[77], W[77] + 0.3)}>{lines.map((l, i) => <div key={i}>{typed(l, t, W[78] + i * 0.5, W[78] + 0.45 + i * 0.5)}</div>)}{rep < 0 ? null : null}</Bubble>
            </div>
          </div>
        </div>
      </div>
      <div style={{position: 'absolute', left: 850, top: 640, transform: `rotate(6deg) scale(${0.6 + 0.4 * Math.min(1.05, sub)})`, opacity: Math.min(1, sub * 2), padding: '14px 26px', borderRadius: 40,
        background: ORANGE, color: '#FFF', fontFamily: SF, fontWeight: 700, fontSize: 36, boxShadow: '0 8px 0 #C24F14'}}>по подписке</div>
    </>
  );
};
// «Уверен, скоро такое будет и в Claude, и в ChatGPT»
const S9: React.FC<{t: number; fps: number}> = ({t, fps}) => (
  <>
    <Row y={430} size={60}><Word t={t} at={W[85]}>Уверен,</Word> <Word t={t} at={W[86]}>скоро</Word> <Word t={t} at={W[87]}>такое</Word> <Word t={t} at={W[88]}>будет</Word></Row>
    <Logo src="lens/claude.svg" size={220} x={CX - 180} y={760} p={spr(t, W[91] - 0.1, fps)} />
    <Logo src="lens/openai.svg" size={220} x={CX + 180} y={760} p={spr(t, W[94] - 0.1, fps)} />
    <Row y={900} size={52} weight={500}><Word t={t} at={W[91]}>Claude</Word>        <Word t={t} at={W[94]}>ChatGPT</Word></Row>
    <Plate t={t} at={W[86] - 0.05} text="скоро" y={1010} size={110} fps={fps} r={-3} />
  </>
);
// «а пока забирай и используй в своих проектах» — карточка модели и загрузка
const S10: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const card = spr(t, LC[9], fps, 13, 160), dl = k(t, W[97], W[99] + 0.5, Easing.bezier(0.45, 0, 0.25, 1));
  return (
    <>
      <Row y={420} size={60}><Word t={t} at={W[95]}>а</Word> <Word t={t} at={W[96]}>пока</Word></Row>
      <Accent size={84}><Word t={t} at={W[97]}>забирай</Word> <Word t={t} at={W[99]}>и используй</Word></Accent>
      <div style={{position: 'absolute', left: CX - 400, top: 690, width: 800, height: 440, borderRadius: 34, overflow: 'hidden', background: '#0E0F12', opacity: Math.min(1, card * 2),
        transform: `scale(${0.85 + 0.15 * Math.min(1, card)})`, boxShadow: '0 0 0 3px rgba(255,255,255,.95), 0 50px 90px rgba(17,19,22,.3)'}}>
        <div style={{position: 'absolute', left: -160, top: 180, width: 560, height: 560, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(255,122,47,.75), rgba(255,122,47,0))'}} />
        <div style={{position: 'absolute', left: 50, top: 60, display: 'flex', alignItems: 'center', gap: 14}}>
          <Img src={staticFile('lens/apple.svg')} style={{width: 40, height: 40, filter: 'invert(1)'}} /><span style={{fontFamily: MONO, fontWeight: 600, fontSize: 40, color: '#E8EAED'}}>apple</span>
        </div>
        <div style={{position: 'absolute', left: 50, top: 130, fontFamily: MONO, fontWeight: 700, fontSize: 84, color: '#FFFFFF'}}>/LensVLM-9B</div>
        <div style={{position: 'absolute', left: 50, right: 50, bottom: 50, height: 70, borderRadius: 35, background: 'rgba(255,255,255,.12)', overflow: 'hidden'}}>
          <div style={{width: `${dl * 100}%`, height: '100%', background: ORANGE}} />
          <div style={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: SF, fontWeight: 600, fontSize: 32, color: '#FFF'}}>{dl >= 1 ? '✓ скачано' : '↓ скачать модель'}</div>
        </div>
      </div>
      <Row y={1200} size={48} color={GREY}><Word t={t} at={W[100]}>в</Word> <Word t={t} at={W[101]}>своих</Word> <Word t={t} at={W[102]}>проектах</Word></Row>
    </>
  );
};
// «Скинь это тому, кто кормит нейросети толстыми PDF»
const S11: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const fly = k(t, W[103], W[106] + 0.2, Easing.bezier(0.45, 0, 0.2, 1)), px = interpolate(fly, [0, 1], [380, 960]), py = interpolate(fly, [0, 1], [1320, 1080]) - Math.sin(fly * Math.PI) * 160;
  const fat = spr(t, W[109] - 0.1, fps, 11, 160);
  return (
    <>
      <Row y={430} size={60}><Word t={t} at={W[103]}>Скинь</Word> <Word t={t} at={W[104]}>это</Word> <Word t={t} at={W[105]}>тому,</Word> <Word t={t} at={W[106]}>кто</Word> <Word t={t} at={W[107]}>кормит</Word></Row>
      <Accent y={515} size={100}><Word t={t} at={W[108]}>нейросети</Word></Accent>
      <Accent y={620} size={100}><Word t={t} at={W[109]}>толстыми PDF</Word></Accent>
      <svg width={1440} height={1700} style={{position: 'absolute', left: 0, top: 0}}>
        <path d="M 380 1320 Q 670 1000 960 1080" fill="none" stroke="rgba(17,19,22,.35)" strokeWidth={5} strokeDasharray="14 14" />
      </svg>
      <div style={{position: 'absolute', left: px - 60, top: py - 60, width: 120, height: 120, borderRadius: 60, background: INK, display: 'grid', placeItems: 'center', transform: `rotate(${-20 + 40 * fly}deg)`,
        opacity: k(t, W[103] - 0.1, W[103] + 0.1), boxShadow: '0 20px 40px rgba(17,19,22,.25)'}}>
        <svg width={60} height={60} viewBox="0 0 24 24"><path d="M3 12 L20 4 L14 21 L11 13 Z" fill="#FFFFFF" /></svg>
      </div>
      {/* толстая стопка PDF */}
      <div style={{position: 'absolute', left: 900, top: 1000, width: 230, transform: `scale(${0.5 + 0.5 * Math.min(1.05, fat)})`, opacity: Math.min(1, fat * 2)}}>
        {Array.from({length: 8}, (_, i) => <div key={i} style={{position: 'absolute', left: i * 3, top: -i * 12, width: 210, height: 270, borderRadius: 14, background: '#FFF', boxShadow: '0 0 0 2px rgba(17,19,22,.1)'}} />)}
        <div style={{position: 'absolute', left: 24, top: -84 + 60, width: 90, height: 60, borderRadius: 10, background: ORANGE, color: '#FFF', fontFamily: SF, fontWeight: 700, fontSize: 30, display: 'grid', placeItems: 'center'}}>PDF</div>
      </div>
    </>
  );
};
// «Напиши Apple в комментариях — пришлю ссылку на статью и на саму модель для скачивания»
const S12: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const word = typed('Apple', t, W[112] - 0.05, W[112] + 0.3), sent = k(t, W[113], W[113] + 0.2), p1 = spr(t, W[118] - 0.15, fps, 12, 180), p2 = spr(t, W[122] - 0.15, fps, 12, 180);
  return (
    <>
      <Row y={430} size={64}><Word t={t} at={W[111]}>Напиши</Word></Row>
      <div style={{position: 'absolute', left: CX - 390, top: 540 - sent * 30, width: 780, height: 170, borderRadius: 85, display: 'flex', alignItems: 'center', padding: '0 34px 0 60px', background: '#FFFFFF',
        boxShadow: '0 0 0 3px rgba(17,19,22,.08), 0 30px 60px rgba(17,19,22,.16)'}}>
        <span style={{flex: 1, fontFamily: CV, fontSize: 100, color: INK}}>{word}<span style={{color: ORANGE, opacity: sent > 0 ? 0 : Math.floor(t * 3) % 2}}>|</span></span>
        <div style={{width: 110, height: 110, borderRadius: 55, background: sent > 0 ? ORANGE : 'rgba(17,19,22,.15)', display: 'grid', placeItems: 'center'}}>
          <svg width={52} height={52} viewBox="0 0 24 24"><path d="M3 12 L20 4 L14 21 L11 13 Z" fill="#FFFFFF" /></svg>
        </div>
      </div>
      <Row y={760} size={48} color={GREY}><Word t={t} at={W[113]}>в</Word> <Word t={t} at={W[114]}>комментариях</Word></Row>
      <Row y={880} size={52}><Word t={t} at={W[115]}>пришлю</Word> <Word t={t} at={W[116]}>ссылку</Word></Row>
      {[['на статью', p1, 980], ['и на саму модель', p2, 1110]].map(([s, p, y], i) => (
        <div key={i} style={{position: 'absolute', left: CX, top: y as number, transform: `translateX(-50%) translateY(${(1 - Math.min(1, p as number)) * 100}px) scale(${0.7 + 0.3 * Math.min(1.04, p as number)})`,
          opacity: Math.min(1, (p as number) * 2), width: 'max-content', padding: '22px 44px', borderRadius: 60, background: i ? INK : ORANGE, color: '#FFFFFF', fontFamily: SF, fontWeight: 600, fontSize: 48,
          boxShadow: i ? '0 10px 0 #000, 0 30px 50px rgba(17,19,22,.25)' : '0 10px 0 #C24F14, 0 30px 50px rgba(120,45,0,.25)'}}>{s as string}</div>
      ))}
    </>
  );
};

const SCENES = [S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12];
type E = [number, string, number, boolean?, number?];
const SFX: E[] = [
  [W[0] - 0.05, 'pop', 0.3], [W[9] - 0.03, 'popup', 0.34], [W[11], 'crispy', 0.34],
  [LC[1], 'sw-s6', 0.14, true], [W[15] - 0.1, 'es-open', 0.3], [W[17], 'pop', 0.3],
  [LC[2], 'sw-s1', 0.14, true], [W[21] + 0.25, 'click4', 0.32], [W[26], 'count', 0.26],
  [LC[3], 'sw-s7', 0.14, true], [W[30] - 0.05, 'type-a', 0.16, false, 1.3], [W[35] - 0.1, 'es-close', 0.26], [W[37] - 0.1, 'b5', 0.32], [W[38], 'chime', 0.3],
  [LC[4], 'sw-s4', 0.14, true], [W[41], 'pop', 0.3], [W[47], 'tr-b', 0.22, true], [W[48], 'tr-a', 0.2, true], [W[49] - 0.1, 'ab6', 0.28],
  [LC[5], 'sw-s5', 0.14, true], [W[50], 'sw-s7', 0.12, true], [W[58] - 0.05, 'es-open', 0.32], [W[64], 'chime', 0.3],
  [LC[6], 'sw-s6', 0.14, true], [W[69] - 0.03, 'popup', 0.34],
  [LC[7], 'sw-s1', 0.14, true], [W[75] - 0.1, 'pop', 0.3], [W[77] - 0.15, 'notif', 0.28], [W[78], 'type-a', 0.16, false, 1.4],
  [LC[8], 'sw-s4', 0.14, true], [W[86] - 0.03, 'popup', 0.32], [W[91] - 0.08, 'click', 0.3], [W[94] - 0.08, 'click4', 0.3],
  [LC[9], 'sw-s7', 0.14, true], [W[97], 'count', 0.24], [W[99] + 0.5, 'confirm', 0.3],
  [LC[10], 'sw-s5', 0.14, true], [W[103], 'sw-s6', 0.12, true], [W[109] - 0.05, 'hit3', 0.24],
  [LC[11], 'sw-s1', 0.14, true], [W[112] - 0.05, 'type-a', 0.2, false, 0.35], [W[113], 'click', 0.32], [W[118] - 0.1, 'pop', 0.3], [W[122] - 0.1, 'chime', 0.3],
];

export const LensReel: React.FC = () => {
  const frame = useCurrentFrame(), {fps} = useVideoConfig(), t = frame / fps;
  const seg = Math.max(0, LC.findIndex((c, i) => t >= c && t < LC[i + 1]));
  const Scene = SCENES[Math.min(SCENES.length - 1, seg)];
  const edge = Math.min(...LC.slice(1, -1).map((c) => Math.abs(t - c))), blur = interpolate(edge, [0, 0.16], [16, 0], {extrapolateRight: 'clamp'}), fade = interpolate(edge, [0, 0.16], [0.35, 1], {extrapolateRight: 'clamp'});
  const push = interpolate(t, [LC[seg], LC[seg + 1] ?? END], [1, 1.035], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}), out = k(t, END - 0.5, END - 0.05);
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
      <AbsoluteFill style={{background: '#000', opacity: out}} />
      {SFX.map(([at, c, v, pk, dd], i) => {
        const m = ISLA[c], from = Math.round((at - (pk ? m.peak : m.onset)) * fps);
        return <Sequence key={i} from={from} durationInFrames={Math.round((dd ?? (c.startsWith('type') ? 0.35 : m.dur)) * fps)} layout="none"><Audio src={staticFile(`sfx/isla/${c}.wav`)} volume={v} /></Sequence>;
      })}
    </AbsoluteFill>
  );
};
