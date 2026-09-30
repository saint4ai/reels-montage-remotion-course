import {AbsoluteFill, Easing, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import {CV, CX, INK, ISLA, k, ORANGE, SF, spr, typed, Word} from '../tildify/TildifyDemo';
import {Block, GridPatch, Kind, lineIn, Odometer, PAL, PlateIn, Row, S1, S2, S3, Sheet, W, WHITE} from './SeoDemo';

// Полный ролик OpenSEO (28.09.2026, 47,8 с) — стиль 14 ЛИСТ, правки v3: только белый и чёрный лист, 3–8 с на сцену, без мелких абзацев,
// блок заголовка уезжает вверх якорем, снизу выходит новый предмет. Первые 13 с — одобренный пример. «Samrush» = Semrush, «Cloud» = Claude.
export const SEO_FRAMES = Math.round(48.3 * 60);
const END = 48.3;
export const RC = [0, W[16] - 0.1, W[32] - 0.1, W[34] - 0.02, W[42] - 0.1, W[56] - 0.1, W[76] - 0.1, W[89] - 0.1, W[108] - 0.1, END];
const MINT = '#3DEDC3';

// Окно с официальным демо OpenSEO (1440×900): кадрируем и подменяем отрезок по смыслу
const Demo: React.FC<{t: number; fps: number; a: number; from: number; box: [number, number, number, number]; crop?: [number, number, number]; kind?: Kind}> = ({t, fps, a, from, box, crop = [0, 0, 1440], kind = 'white'}) => {
  const p = spr(t, a, fps, 14, 140), s = box[2] / crop[2];
  return (
    <div style={{position: 'absolute', left: box[0], top: box[1], width: box[2], height: box[3], borderRadius: 26, overflow: 'hidden', background: '#FFF', opacity: Math.min(1, p * 2),
      transform: `translateY(${(1 - Math.min(1, p)) * 140}px)`, boxShadow: kind === 'white' ? '0 0 0 3px rgba(17,19,22,.08), 0 40px 80px rgba(17,19,22,.18)' : '0 0 0 3px rgba(255,255,255,.9), 0 40px 80px rgba(0,0,0,.5)'}}>
      <Sequence from={Math.round(a * fps)} layout="none">
        <OffthreadVideo src={staticFile('seo/demo.mp4')} startFrom={Math.round(from * fps)} muted style={{position: 'absolute', left: -crop[0] * s, top: -crop[1] * s, width: 1440 * s, height: 900 * s, maxWidth: 'none'}} />
      </Sequence>
    </div>
  );
};
const Chip: React.FC<{t: number; at: number; fps: number; children: React.ReactNode; kind?: Kind}> = ({t, at, fps, children, kind = 'white'}) => {
  const p = spr(t, at - 0.08, fps, 12, 190), c = k(t, at + 0.05, at + 0.25);
  return (
    <div style={{display: 'inline-flex', alignItems: 'center', gap: 14, padding: '16px 26px', borderRadius: 40, background: kind === 'white' ? '#FFFFFF' : '#1C1D20', opacity: Math.min(1, p * 2),
      transform: `scale(${0.6 + 0.4 * Math.min(1.05, p)})`, boxShadow: kind === 'white' ? '0 0 0 2px rgba(17,19,22,.08), 0 14px 26px rgba(17,19,22,.1)' : '0 0 0 2px rgba(255,255,255,.12)',
      fontFamily: SF, fontWeight: 600, fontSize: 48, color: PAL[kind].ink, whiteSpace: 'nowrap'}}>
      <span style={{width: 52, height: 52, borderRadius: 26, background: c > 0 ? ORANGE : 'rgba(127,127,127,.25)', color: '#FFF', display: 'grid', placeItems: 'center', fontSize: 26, transform: `scale(${0.6 + 0.4 * c})`}}>✓</span>
      {children}
    </div>
  );
};
const LogoTile: React.FC<{src: string; size: number; p: number; dark?: boolean; cover?: boolean}> = ({src, size, p, dark, cover}) => (
  <div style={{width: size, height: size, borderRadius: size * 0.26, overflow: 'hidden', background: dark ? '#1C1D20' : '#FFFFFF', display: 'grid', placeItems: 'center', opacity: Math.min(1, p * 2),
    transform: `scale(${0.5 + 0.5 * Math.min(1.05, p)})`, boxShadow: '0 0 0 2px rgba(255,255,255,.12), 0 24px 44px rgba(0,0,0,.35)'}}>
    <Img src={staticFile(src)} style={cover ? {width: '100%', height: '100%'} : {width: size * 0.6, height: size * 0.6}} />
  </div>
);

// 4 (чёрный): «Semrush за такое берёт 140 баксов в месяц» — счётчик до $140
const S4: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const v = Math.min(140, 140 * k(t, W[37], W[38] + 0.35, Easing.bezier(0.3, 0.05, 0.2, 1)) + 0.0001), logo = spr(t, RC[3], fps);
  return (
    <>
      <GridPatch kind="black" cy={800} />
      <div style={{position: 'absolute', left: CX - 70, top: 400}}><LogoTile src="seo/semrush-color.svg" size={140} p={logo} /></div>
      <Row y={590} size={54} color={WHITE}><Word t={t} at={W[34]}>Semrush</Word> <Word t={t} at={W[35]}>за</Word> <Word t={t} at={W[36]}>такое</Word> <Word t={t} at={W[37]}>берёт</Word></Row>
      <div style={{position: 'absolute', left: 0, right: 0, top: 690, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, opacity: k(t, W[37] - 0.1, W[37] + 0.1)}}>
        <span style={{fontFamily: CV, fontSize: 200, color: v > 139.9 ? ORANGE : '#FFFFFF', lineHeight: 1}}>$</span>
        <div style={{filter: v > 139.9 ? 'drop-shadow(0 0 30px rgba(255,122,47,.6))' : undefined}}><OdoSmall value={v} color={v > 139.9 ? ORANGE : '#FFFFFF'} /></div>
      </div>
      <div style={{position: 'absolute', left: CX, top: 960, transform: 'translateX(-50%)'}}><PlateIn t={t} at={W[39] - 0.05} fps={fps} size={110}>в месяц</PlateIn></div>
    </>
  );
};
const OdoSmall: React.FC<{value: number; color: string}> = ({value, color}) => {
  const size = 200, cw = size * 0.6, h = size * 1.05;
  return (
    <div style={{display: 'flex'}}>
      {[2, 1, 0].map((place) => {
        const m = 10 ** place, pos = (Math.floor(value / m) % 10) + (place === 0 ? value % 1 : Math.min(1, Math.max(0, (value % m) - (m - 1))));
        return <div key={place} style={{width: cw, height: h, overflow: 'hidden', position: 'relative', opacity: value < m && place > 0 ? 0.2 : 1}}>
          <div style={{position: 'absolute', left: 0, top: -pos * h, width: cw}}>{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d, j) => <div key={j} style={{height: h, lineHeight: `${h}px`, textAlign: 'center', fontFamily: CV, fontSize: size, color}}>{d}</div>)}</div>
        </div>;
      })}
    </div>
  );
};
// 5 (белый): «Тут и подбор ключевых слов, и позиции сайта, и конкуренты, и ссылки, и аудит» — окно демо + галочки по словам
const S5: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const a = RC[4], seg = t < W[53] - 0.1 ? 0 : t < W[55] - 0.1 ? 1 : 2, from = [3, 9.5, 19][seg], at = [a + 0.05, W[53] - 0.1, W[55] - 0.1][seg];
  const items: [string, number][] = [['подбор ключевых слов', W[44]], ['позиции сайта', W[48]], ['конкуренты', W[51]], ['ссылки', W[53]], ['аудит сайта', W[55]]];
  return (
    <>
      <Demo key={seg} t={t} fps={fps} a={at} from={from} box={[CX - 432, 400, 864, 620]} crop={[90, 40, 1150]} />
      <div style={{position: 'absolute', left: CX - 432, top: 1070, width: 864, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 20}}>
        {items.map(([s, at2]) => <Chip key={s} t={t} at={at2} fps={fps}>{s}</Chip>)}
      </div>
    </>
  );
};
// 6 (чёрный, 8 с): «но самое главное — не цена. OpenSEO подключается к Claude, и он строит SEO-стратегию на живых данных поиска и не выдумывает»
const S6: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const up = k(t, W[62] - 0.2, W[62] + 0.4, Easing.bezier(0.65, 0, 0.35, 1)), wire = k(t, W[63], W[64], Easing.bezier(0.65, 0, 0.35, 1)), on = k(t, W[64], W[64] + 0.3);
  const real = spr(t, W[74] - 0.05, fps, 10, 200);
  return (
    <>
      <GridPatch kind="black" cy={760} />
      <div style={{position: 'absolute', inset: 0, transform: `scale(${1 - 0.22 * up})`, transformOrigin: '720px 460px'}}>
        <Block kind="black" top={460} t={t} rule={lineIn(t, W[58])}
          kicker={<><Word t={t} at={W[56]}>но</Word> <Word t={t} at={W[57]}>самое</Word> <Word t={t} at={W[58]}>главное</Word></>}
          plate={<PlateIn t={t} at={W[60] - 0.05} fps={fps} size={160}>не цена</PlateIn>} />
      </div>
      {/* OpenSEO ⇄ Claude */}
      <div style={{position: 'absolute', left: CX - 360, top: 770}}><LogoTile src="seo/openseo-icon.png" size={230} p={spr(t, W[62] - 0.1, fps)} dark cover /></div>
      <div style={{position: 'absolute', left: CX + 130, top: 770}}><LogoTile src="seo/claude.svg" size={230} p={spr(t, W[64] - 0.1, fps)} /></div>
      <svg width={1440} height={1700} style={{position: 'absolute', left: 0, top: 0}}>
        <path d="M 600 885 C 670 835, 770 935, 840 885" fill="none" stroke={on > 0 ? MINT : 'rgba(255,255,255,.4)'} strokeWidth={7} strokeDasharray="14 12" strokeDashoffset={-t * 60} pathLength={1} style={{strokeDasharray: `${wire} 1`}} />
      </svg>
      <div style={{position: 'absolute', left: CX, top: 1015, transform: `translateX(-50%) scale(${0.7 + 0.3 * on})`, opacity: on, padding: '8px 20px', borderRadius: 30, border: `2px solid ${MINT}`, color: MINT,
        fontFamily: SF, fontWeight: 600, fontSize: 32, whiteSpace: 'nowrap'}}>● подключено</div>
      <Row y={1080} size={50} color={WHITE}><Word t={t} at={W[66]}>он</Word> <Word t={t} at={W[67]}>строит</Word></Row>
      <div style={{position: 'absolute', left: CX - 432, top: 1140, width: 864, textAlign: 'center', fontFamily: CV, fontSize: 96, lineHeight: 1, color: ORANGE}}><Word t={t} at={W[68]}>SEO-стратегию</Word></div>
      <Demo t={t} fps={fps} a={W[70] - 0.1} from={4} box={[CX - 280, 1250, 560, 300]} crop={[300, 70, 900]} kind="black" />
      <div style={{position: 'absolute', left: CX + 110, top: 1470, transform: `translateX(-50%) rotate(${6 - 10 * (1 - Math.min(1, real))}deg) scale(${1.6 - 0.6 * Math.min(1, real)})`, opacity: Math.min(1, real * 2),
        padding: '14px 28px 8px', borderRadius: 16, background: MINT, fontFamily: CV, fontSize: 58, lineHeight: 1, color: '#05231D', whiteSpace: 'nowrap', boxShadow: '0 8px 0 #139C7C'}}>
        живые данные
      </div>
    </>
  );
};
// 7 (белый): «Спрашиваешь, почему конкурент выше меня в Google, и он идёт смотреть реальные цифры» — чат с Claude, вызовы OpenSEO
const S7: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const q = typed('Почему конкурент выше меня в Google?', t, W[77] - 0.1, W[82] + 0.3), ans = spr(t, W[84] - 0.1, fps, 13, 160);
  const calls: [string, number][] = [['ключевые слова', W[86]], ['обратные ссылки', W[86] + 0.35], ['позиции в выдаче', W[87]]];
  return (
    <>
      <Row y={400} size={54} color={INK}><Word t={t} at={W[76]}>Спрашиваешь</Word></Row>
      <div style={{position: 'absolute', left: CX - 432, top: 490, width: 864, height: 900, borderRadius: 40, background: '#FFFFFF', boxShadow: '0 0 0 2px rgba(17,19,22,.06), 0 40px 80px rgba(17,19,22,.14)',
        padding: '40px 40px', display: 'flex', flexDirection: 'column', gap: 26, opacity: k(t, RC[6], RC[6] + 0.25)}}>
        <div style={{alignSelf: 'flex-end', maxWidth: 640, padding: '22px 30px', borderRadius: 30, background: 'rgba(255,122,47,.14)', fontFamily: SF, fontSize: 42, lineHeight: 1.3, color: INK, minHeight: 60}}>
          {q}<span style={{color: ORANGE, opacity: q.length < 36 ? Math.floor(t * 3) % 2 : 0}}>|</span>
        </div>
        <div style={{display: 'flex', gap: 18, alignItems: 'flex-start', opacity: Math.min(1, ans * 2), transform: `translateY(${(1 - Math.min(1, ans)) * 40}px)`}}>
          <div style={{width: 72, height: 72, borderRadius: 20, background: '#F4F2EC', display: 'grid', placeItems: 'center', flex: 'none'}}><Img src={staticFile('seo/claude.svg')} style={{width: 46, height: 46}} /></div>
          <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
            <div style={{fontFamily: SF, fontSize: 38, color: INK}}><Word t={t} at={W[85]}>Иду</Word> <Word t={t} at={W[86]}>смотреть</Word> <Word t={t} at={W[86] + 0.2}>данные</Word></div>
            {calls.map(([s, at2]) => (
              <div key={s} style={{display: 'inline-flex', alignItems: 'center', gap: 14, alignSelf: 'flex-start', padding: '12px 20px', borderRadius: 18, background: '#0F1115', color: '#E8EAED', fontFamily: 'SF Mono', fontSize: 30,
                opacity: k(t, at2 - 0.05, at2 + 0.15), transform: `translateX(${(1 - k(t, at2 - 0.05, at2 + 0.25)) * -40}px)`}}>
                <Img src={staticFile('seo/openseo-icon.png')} style={{width: 36, height: 36, borderRadius: 8}} />openseo · {s}<span style={{color: MINT}}>✓</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{marginTop: 'auto', alignSelf: 'center'}}><PlateIn t={t} at={W[87] - 0.05} fps={fps} size={96}>реальные цифры</PlateIn></div>
      </div>
      <div style={{position: 'absolute', left: CX + 300, top: 400, opacity: k(t, W[82] - 0.1, W[82] + 0.2)}}><Img src={staticFile('seo/google.svg')} style={{width: 60, height: 60}} /></div>
    </>
  );
};
// 8 (чёрный): «Код открыт. Платишь только за данные, около 5 центов за запрос, или готовый сайт за 10 долларов в месяц» — две карточки цен
const S8: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const open = spr(t, W[89] - 0.05, fps, 12, 180), c1 = spr(t, W[91] - 0.1, fps, 13, 160), c2 = spr(t, W[100] - 0.1, fps, 13, 160);
  const Card: React.FC<{p: number; x: number; top: string; big: React.ReactNode; bottom: string; hot?: boolean}> = ({p, x, top, big, bottom, hot}) => (
    <div style={{position: 'absolute', left: x, top: 760, width: 400, height: 560, borderRadius: 36, background: hot ? ORANGE : '#1C1D20', padding: '44px 36px', display: 'flex', flexDirection: 'column', alignItems: 'center',
      opacity: Math.min(1, p * 2), transform: `translateY(${(1 - Math.min(1, p)) * 160}px) rotate(${hot ? 2 : -2}deg)`, boxShadow: hot ? '0 12px 0 #C24F14, 0 40px 70px rgba(0,0,0,.5)' : '0 0 0 2px rgba(255,255,255,.12), 0 40px 70px rgba(0,0,0,.5)'}}>
      <div style={{fontFamily: SF, fontWeight: 600, fontSize: 38, color: hot ? '#FFF' : '#C9CDD1', textAlign: 'center', lineHeight: 1.2}}>{top}</div>
      <div style={{marginTop: 'auto', marginBottom: 'auto', fontFamily: CV, fontSize: 190, lineHeight: 1, color: '#FFFFFF'}}>{big}</div>
      <div style={{fontFamily: SF, fontWeight: 500, fontSize: 38, color: hot ? '#FFF' : '#C9CDD1'}}>{bottom}</div>
    </div>
  );
  return (
    <>
      <GridPatch kind="black" cy={900} h={1100} />
      <div style={{position: 'absolute', left: CX, top: 420, transform: `translateX(-50%) scale(${0.6 + 0.4 * Math.min(1.05, open)})`, opacity: Math.min(1, open * 2), display: 'flex', alignItems: 'center', gap: 20,
        padding: '18px 34px', borderRadius: 26, background: '#21262D', boxShadow: '0 0 0 3px rgba(255,255,255,.15)', whiteSpace: 'nowrap'}}>
        <Img src={staticFile('seo/github.svg')} style={{width: 56, height: 56, filter: 'invert(1)'}} />
        <span style={{fontFamily: SF, fontWeight: 600, fontSize: 50, color: '#F0F6FC'}}>код открыт · MIT</span>
      </div>
      <Row y={600} size={54} color={WHITE}><Word t={t} at={W[91]}>Платишь</Word> <Word t={t} at={W[92]}>только</Word> <Word t={t} at={W[93]}>за</Word> <Word t={t} at={W[94]}>данные</Word></Row>
      <Card p={c1} x={CX - 420} top="свой доступ, только данные" big={<Word t={t} at={W[94]}>≈5¢</Word>} bottom="за запрос" />
      <Card p={c2} x={CX + 20} top="готовый сайт openseo.so" big={<Word t={t} at={W[104]}>$10</Word>} bottom="в месяц" hot />
      <Row y={1380} size={50} color={WHITE}><Word t={t} at={W[100]}>или</Word></Row>
    </>
  );
};
// 9 (белый): «Скинь это тому, кто платит за SEO. Напиши SEO в комментариях, пришлю ссылку, отдашь её Claude, он сам всё подключит»
const S9: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const b = W[115] + 0.15, up = k(t, b - 0.05, b + 0.2, Easing.bezier(0.65, 0, 0.35, 1));
  const word = typed('SEO', t, W[116] - 0.05, W[116] + 0.2), sent = k(t, W[117], W[117] + 0.2), link = spr(t, W[119] - 0.1, fps, 12, 180), cl = spr(t, W[123] - 0.1, fps, 12, 180), ok = k(t, W[127], W[127] + 0.3);
  return (
    <>
      <GridPatch kind="white" cy={760} />
      <div style={{position: 'absolute', inset: 0, opacity: 1 - Math.min(1, up * 2), transform: `translateY(${-80 * up}px)`}}>
        <Block kind="white" top={560} t={t} rule={lineIn(t, W[110])}
          kicker={<><Word t={t} at={W[108]}>Скинь</Word> <Word t={t} at={W[109]}>это</Word> <Word t={t} at={W[110]}>тому,</Word></>}
          lead={<><Word t={t} at={W[111]}>кто</Word> <Word t={t} at={W[112]}>платит</Word> <Word t={t} at={W[113]}>за</Word> <Word t={t} at={W[114]}>SEO</Word></>} />
      </div>
      <div style={{position: 'absolute', inset: 0, opacity: Math.max(0, up * 2 - 1)}}>
        <Row y={430} size={60} color={INK}><Word t={t} at={W[115] + 0.2}>Напиши</Word></Row>
        <div style={{position: 'absolute', left: CX - 390, top: 540 - sent * 30, width: 780, height: 170, borderRadius: 85, display: 'flex', alignItems: 'center', padding: '0 34px 0 60px', background: '#FFFFFF',
          boxShadow: '0 0 0 3px rgba(17,19,22,.08), 0 30px 60px rgba(17,19,22,.16)'}}>
          <span style={{flex: 1, fontFamily: CV, fontSize: 100, color: INK}}>{word}<span style={{color: ORANGE, opacity: sent > 0 ? 0 : Math.floor(t * 3) % 2}}>|</span></span>
          <div style={{width: 110, height: 110, borderRadius: 55, background: sent > 0 ? ORANGE : 'rgba(17,19,22,.15)', display: 'grid', placeItems: 'center'}}>
            <svg width={52} height={52} viewBox="0 0 24 24"><path d="M3 12 L20 4 L14 21 L11 13 Z" fill="#FFFFFF" /></svg>
          </div>
        </div>
        <Row y={760} size={48} color={PAL.white.grey}><Word t={t} at={W[117]}>в</Word> <Word t={t} at={W[118]}>комментариях</Word></Row>
        {/* ссылка → Claude → подключено */}
        <div style={{position: 'absolute', left: 0, right: 0, top: 900, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 26}}>
          <div style={{padding: '22px 36px', borderRadius: 50, background: ORANGE, color: '#FFF', fontFamily: SF, fontWeight: 600, fontSize: 46, opacity: Math.min(1, link * 2),
            transform: `scale(${0.6 + 0.4 * Math.min(1.05, link)})`, boxShadow: '0 10px 0 #C24F14'}}>ссылка</div>
          <svg width={90} height={40} style={{opacity: k(t, W[121], W[121] + 0.2)}}><path d="M6 20 H76 M60 6 L80 20 L60 34" stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <LogoTile src="seo/claude.svg" size={150} p={cl} />
        </div>
        <div style={{position: 'absolute', left: CX, top: 1130, transform: `translateX(-50%) scale(${0.7 + 0.3 * ok})`, opacity: ok, padding: '16px 34px', borderRadius: 40, background: '#1DB45A', color: '#FFF',
          fontFamily: SF, fontWeight: 600, fontSize: 44, whiteSpace: 'nowrap'}}>✓ Claude сам всё подключит</div>
      </div>
    </>
  );
};

const SCENES: [React.FC<{t: number; fps: number}>, Kind][] = [[S1, 'white'], [S2, 'black'], [S3, 'white'], [S4, 'black'], [S5, 'white'], [S6, 'black'], [S7, 'white'], [S8, 'black'], [S9, 'white']];
type E = [number, string, number, boolean?, number?];
const SFX: E[] = [
  [W[3] - 0.05, 'select', 0.26], [W[7] - 0.03, 'popup', 0.34], [W[9] - 0.1, 'sw-s7', 0.12, true], [W[9], 'es-open', 0.28], [W[12] - 0.05, 'crispy', 0.4], [W[13] - 0.03, 'hit2', 0.26],
  [RC[1], 'sw-s6', 0.14, true], [W[19] - 0.03, 'chime', 0.32], [W[23] - 0.1, 'sw-s4', 0.12, true], [W[25], 'count', 0.3], [W[27], 'count', 0.3], [W[29] + 0.1, 'confirm', 0.3], [W[30] - 0.1, 'pop', 0.3],
  [RC[2], 'sw-s1', 0.14, true], [W[33] - 0.05, 'popup', 0.34], [W[33] + 0.15, 'es-open', 0.3],
  [RC[3], 'sw-s5', 0.14, true], [W[37], 'count', 0.28], [W[39] - 0.03, 'popup', 0.32],
  [RC[4], 'sw-s7', 0.14, true], ...[W[44], W[48], W[51], W[53], W[55]].map((x, i) => [x + 0.05, ['b2', 'b5', 'b8', 'b3', 'b7'][i], 0.3] as E),
  [RC[5], 'sw-s4', 0.14, true], [W[60] - 0.03, 'popup', 0.34], [W[62] - 0.2, 'sw-s6', 0.12, true], [W[64], 'confirm', 0.28], [W[70] - 0.1, 'es-open', 0.28], [W[74] - 0.03, 'hit2', 0.24],
  [RC[6], 'sw-s1', 0.14, true], [W[77] - 0.1, 'type-a', 0.18, false, 1.6], [W[84] - 0.1, 'notif', 0.26], [W[86], 'b7', 0.3], [W[86] + 0.35, 'b7', 0.3], [W[87], 'b7', 0.3], [W[87] - 0.03, 'chime', 0.3],
  [RC[7], 'sw-s5', 0.14, true], [W[89] - 0.05, 'pop', 0.3], [W[91] - 0.1, 'es-open', 0.28], [W[96], 'click', 0.3], [W[100] - 0.1, 'es-open', 0.28], [W[104], 'chime', 0.3],
  [RC[8], 'sw-s6', 0.14, true], [W[115] + 0.15, 'sw-s7', 0.12, true], [W[116] - 0.05, 'type-a', 0.2, false, 0.3], [W[117], 'click', 0.32], [W[119] - 0.1, 'pop', 0.3], [W[123] - 0.1, 'pop', 0.3], [W[127], 'confirm', 0.32],
];

export const SeoReel: React.FC = () => {
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
        <OffthreadVideo src={staticFile('seo/seo.mp4')} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 36%'}} />
      </div>
      <AbsoluteFill style={{background: '#000', opacity: out}} />
      {SFX.map(([at, c, v, pk, dd], i) => {
        const m = ISLA[c], from = Math.round((at - (pk ? m.peak : m.onset)) * fps);
        return <Sequence key={i} from={from} durationInFrames={Math.round((dd ?? (c.startsWith('type') ? 0.35 : m.dur)) * fps)} layout="none"><Audio src={staticFile(`sfx/isla/${c}.wav`)} volume={v} /></Sequence>;
      })}
    </AbsoluteFill>
  );
};
