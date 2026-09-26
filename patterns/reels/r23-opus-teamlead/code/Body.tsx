import {interpolate} from 'remotion';
import {countTo, E, k, Mark} from '../../montage/parts';
import {springAt} from '../../styles/parts';
import {Capsule, CAP, T as HT, Z5} from './Hook';
import {EllipseMark, GREY, INK, KWords, MINT, ORANGE, Ring, type CamKey} from './kinetic';
import {Terminal, type TLine} from './Terminal';
import {at23} from './words23';

// Ролик 23, 10–63 с. Та же механика холста, что у хука: одна фраза — одна сцена, камера рывком едет между сценами.
// Цифры в кадре — только из прайса Anthropic ($20 / $10 / $5, «×4») и документации Claude Code (opusplan: plan → opus,
// execution → sonnet; opus = Opus 5.5, sonnet = Sonnet 5 в Anthropic API). «В 5 раз» — только в субтитрах (его речь).
export const B = {
  opusThinks: at23('opus', 2), thinks: at23('думает', 0), sonnetWrites: at23('sonnet', 0), writes: at23('пишет', 0),
  look: at23('смотрим'), prices: at23('цены'), million: at23('миллион'), tokens: at23('токенов'), answer: at23('ответа'),
  opusP: at23('opus', 3), twenty: at23('20'), sonnetP: at23('sonnet', 1), ten: at23('10'), haikuP: at23('haiku', 0), five: at23('5', 0),
  diff: at23('разница'), four: at23('4'), drive: at23('гоняешь'), opusJ: at23('opus', 4), every: at23('каждую'), line: at23('строчку'), code: at23('кода'),
  so: at23('поэтому', 1), scheme: at23('схема'), task: at23('задача'), add: at23('добавить'), site: at23('сайт'),
  first: at23('первым'), opusS: at23('opus', 5), decides: at23('решает'), files: at23('файлы'), touch: at23('трогать'), cuts: at23('режет'), steps: at23('шаги'),
  next: at23('дальше'), sonnetS: at23('sonnet', 2), writes2: at23('пишет', 1), routine: at23('рутину'), spec: at23('тз'),
  last: at23('последним'), haikuS: at23('haiku', 1), runs: at23('прогоняет'), tests: at23('тесты'), catches: at23('ловит'), broke: at23('сломалось'),
  literally: at23('то'), lead: at23('тимлид', 0), dev: at23('разработчик'), junior: at23('джун'),
  brain: at23('дорогой'), arch: at23('архитектура'), hard: at23('сложные'), final: at23('финальная'),
  limits: at23('лимиты', 2), melt: at23('тают', 1), slower: at23('медленнее'),
  pair: at23('opus', 8), bundle: at23('в связке'), command: at23('командой'), opusplan: at23('opusplan'),
  team: at23('команду'), agents: at23('агентами'), folder: at23('папку'), claude: at23('claude', 3), install: at23('поставит'), self: at23('сам'),
  write: at23('напиши'), comments: at23('комментариях'), word: at23('тимлид', 1), send: at23('скину'), skill: at23('скилл'), orch: at23('оркестрации'),
};
// центры сцен на холсте (продолжают хук: Z1…Z5)
const Z6 = {x: 3250, y: 3950}, Z7 = {x: 4900, y: 3950}, RING = {y: Z7.y + 820, xs: [Z7.x + 1150, Z7.x + 1750, Z7.x + 2350]};
const Z8 = {x: Z7.x + 1750, y: Z7.y + 2150}, Z9 = {x: Z8.x + 1750, y: Z8.y};
const ZO = {x: Z9.x, y: Z9.y + 1450}, ZS = {x: ZO.x - 900, y: ZO.y + 1450}, ZH = {x: ZO.x + 900, y: ZO.y + 1450};
const ORG = {o: {x: ZO.x, y: ZO.y + 1000}, s: {x: ZO.x - 520, y: ZO.y + 1600}, h: {x: ZO.x + 520, y: ZO.y + 1600}};
const ZL = {x: ZH.x + 1900, y: ORG.o.y - 200}, ZP = {x: ZL.x, y: ZL.y + 1450}, ZF = {x: ZP.x + 1750, y: ZP.y}, ZC = {x: ZF.x, y: ZF.y + 1450};
const W = (a: number, b: number) => [a, b] as const;
export const BODY_CAM: CamKey[] = [
  [B.opusThinks - 0.15, Z5.x, Z5.y, 1], [B.opusThinks + 0.2, Z6.x, Z6.y, 1],
  [B.look - 0.1, Z6.x, Z6.y, 1], [B.look + 0.25, Z7.x + 20, Z7.y + 40, 1],
  [B.opusP - 0.12, Z7.x + 20, Z7.y + 40, 1], [B.opusP + 0.22, RING.xs[0], RING.y + 80, 1.05],
  [B.sonnetP - 0.12, RING.xs[0], RING.y + 80, 1.05], [B.sonnetP + 0.2, RING.xs[1], RING.y + 80, 1.05],
  [B.haikuP - 0.12, RING.xs[1], RING.y + 80, 1.05], [B.haikuP + 0.2, RING.xs[2], RING.y + 80, 1.05],
  [B.diff - 0.12, RING.xs[2], RING.y + 80, 1.05], [B.diff + 0.4, RING.xs[1], RING.y - 50, 0.5],
  [B.drive - 0.12, RING.xs[1], RING.y - 50, 0.5], [B.drive + 0.25, Z8.x, Z8.y, 1],
  [B.so - 0.1, Z8.x, Z8.y, 1], [B.so + 0.25, Z9.x, Z9.y, 1],
  [B.first - 0.12, Z9.x, Z9.y, 1], [B.first + 0.25, ZO.x, ZO.y, 1],
  [B.next - 0.1, ZO.x, ZO.y, 1], [B.next + 0.25, ZS.x, ZS.y, 1],
  [B.last - 0.1, ZS.x, ZS.y, 1], [B.last + 0.25, ZH.x, ZH.y, 1],
  [B.literally - 0.1, ZH.x, ZH.y, 1], [B.literally + 0.5, ORG.o.x, ORG.o.y + 420, 0.62],
  [B.brain - 0.12, ORG.o.x, ORG.o.y + 420, 0.62], [B.brain + 0.35, ORG.o.x, ORG.o.y - 150, 1],
  [B.limits - 0.4, ORG.o.x, ORG.o.y - 150, 1], [B.limits - 0.05, ZL.x, ZL.y, 1],
  [B.pair - 0.12, ZL.x, ZL.y, 1], [B.pair + 0.22, ZP.x, ZP.y, 1],
  [B.team - 0.12, ZP.x, ZP.y, 1], [B.team + 0.22, ZF.x, ZF.y, 1],
  [B.write - 0.12, ZF.x, ZF.y, 1], [B.write + 0.25, ZC.x, ZC.y, 1],
];
export const BODY_WINDOWS = {
  s6: W(B.opusThinks - 0.4, B.look + 0.4), s7: W(B.look - 0.3, B.drive + 0.5), s8: W(B.drive - 0.3, B.so + 0.4), s9: W(B.so - 0.3, B.first + 0.4),
  st: W(B.first - 0.3, B.limits + 0.2), s15: W(B.limits - 0.6, B.pair + 0.4), s16: W(B.pair - 0.3, B.team + 0.4), s17: W(B.team - 0.3, B.write + 0.4), s18: W(B.write - 0.3, 99),
};

const Pill: React.FC<{x: number; y: number; label: string; fill?: string; ink?: string; outline?: boolean; size?: number; p: number; logo?: boolean}> =
  ({x, y, label, fill = MINT, ink = INK, outline, size = 56, p, logo}) => (
    <div style={{position: 'absolute', left: x, top: y, height: size * 1.9, padding: `0 ${size * 0.7}px`, borderRadius: size, display: 'flex', alignItems: 'center', gap: size * 0.3,
      background: outline ? '#FFFFFF' : fill, border: outline ? `4px solid ${INK}` : undefined, fontFamily: 'Manrope', fontWeight: 800, fontSize: size, color: ink,
      whiteSpace: 'nowrap', opacity: Math.min(1, p * 1.6), transform: `translate(-50%, -50%) scale(${0.6 + 0.4 * Math.min(1.05, p)})`,
      boxShadow: outline ? undefined : '0 16px 30px rgba(17,19,22,.12)'}}>
      {logo ? <Mark name="claude" size={size * 0.95} color={ink} /> : null}{label}
    </div>
  );

// Сота с моделью: шестигранник с тёмным торцом, знак Claude внутри, подпись рядом
const Hex: React.FC<{x: number; y: number; r: number; color: string; name: string; p: number; glow?: number; dim?: number; nameSide?: 'right' | 'below'; inkName?: string}> =
  ({x, y, r, color, name, p, glow = 0, dim = 0, nameSide = 'below', inkName = INK}) => {
    const pts = Array.from({length: 6}, (_, i) => { const a = Math.PI / 3 * i - Math.PI / 2; return `${r + r * Math.cos(a)},${r + r * Math.sin(a)}`; }).join(' ');
    const sc = 0.5 + 0.5 * Math.min(1.05, p);
    return (
      <div style={{position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, opacity: Math.min(1, p * 1.6) * (1 - dim), transform: `scale(${sc})`}}>
        <svg width={r * 2} height={r * 2 + 18} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', filter: glow > 0 ? `drop-shadow(0 0 ${50 * glow}px ${color})` : undefined}}>
          <polygon points={pts} transform="translate(0 16)" fill="#111316" opacity={0.85} />
          <polygon points={pts} fill={color} />
        </svg>
        <Mark name="claude" size={r * 0.8} color={color === INK ? '#FFFFFF' : '#FFFFFF'} style={{position: 'absolute', left: r * 0.6, top: r * 0.6}} />
        <div style={{position: 'absolute', left: nameSide === 'right' ? r * 2 + 40 : -300, top: nameSide === 'right' ? r - 60 : r * 2 + 40, width: nameSide === 'right' ? undefined : r * 2 + 600,
          textAlign: nameSide === 'right' ? 'left' : 'center', fontFamily: 'Inter Tight', fontWeight: 800, fontSize: 100, letterSpacing: '-0.035em', color: inkName, whiteSpace: 'nowrap'}}>{name}</div>
      </div>
    );
  };

// Сцена 6: «Opus думает, Sonnet пишет код» — строка документации Claude Code: plan → Opus, execution → Sonnet
const S6: React.FC<{t: number}> = ({t}) => {
  const {x, y} = Z6, head = springAt(t, B.opusThinks - 0.1);
  const row = (yy: number, label: string, at: number, capsule: 'opus' | 'sonnet', word: string, wordAt: number, col: string) => {
    const p = springAt(t, at), mark = k(t, wordAt - 0.1, wordAt + 0.35, E.inOut);
    return (
      <div style={{position: 'absolute', left: x - 470, top: yy, width: 1000, height: 130}}>
        <div style={{position: 'absolute', left: -20, top: 6, height: 118, width: 1000 * mark, borderRadius: 24, background: col, opacity: 0.22}} />
        <span style={{position: 'absolute', left: 0, top: 30, fontFamily: 'JBM', fontWeight: 700, fontSize: 60, color: GREY, opacity: Math.min(1, p * 1.5)}}>{label}</span>
        <span style={{position: 'absolute', left: 330, top: 22, fontFamily: 'Inter Tight', fontWeight: 800, fontSize: 70, color: INK, opacity: Math.min(1, p * 1.5)}}>→</span>
        <div style={{position: 'absolute', left: 420, top: 9, width: CAP.w, height: CAP.h, opacity: Math.min(1, p * 1.5), transform: `scale(${0.6 + 0.4 * Math.min(1.04, p)})`}}>
          {capsule === 'opus' ? <Capsule /> : (
            <div style={{position: 'absolute', inset: 0, borderRadius: CAP.h / 2, background: MINT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
              boxShadow: '0 6px 0 #1C9A7C, 0 22px 40px rgba(61,237,195,.35)'}}>
              <Mark name="claude" size={54} color="#05231D" /><span style={{fontFamily: 'Inter Tight', fontWeight: 800, fontSize: 62, color: '#05231D'}}>Sonnet</span>
            </div>
          )}
        </div>
        <span style={{position: 'absolute', left: 745, top: 22, fontFamily: 'Caveat', fontWeight: 600, fontSize: 80, color: col === ORANGE ? ORANGE : '#16B892',
          opacity: k(t, wordAt - 0.05, wordAt + 0.25)}}>{word}</span>
      </div>
    );
  };
  return (
    <>
      <div style={{position: 'absolute', left: x - 470, top: y - 340, height: 88, padding: '0 30px', borderRadius: 44, border: `4px solid ${INK}`, display: 'flex', alignItems: 'center', gap: 14,
        background: '#FFFFFF', opacity: Math.min(1, head * 1.5)}}>
        <Mark name="claude" size={48} /><span style={{fontFamily: 'Manrope', fontWeight: 800, fontSize: 46, color: INK, whiteSpace: 'nowrap'}}>docs · Model configuration</span>
      </div>
      <div style={{position: 'absolute', left: x - 470, top: y - 225, fontFamily: 'JBM', fontWeight: 800, fontSize: 118, color: INK, letterSpacing: '-0.02em', opacity: Math.min(1, head * 1.5)}}>opusplan</div>
      {row(y - 50, 'plan', B.opusThinks, 'opus', 'думает', B.thinks, ORANGE)}
      {row(y + 110, 'код', B.sonnetWrites, 'sonnet', 'пишет', B.writes, MINT)}
    </>
  );
};

// Сцена 7: цены — строка, три кольца-счётчика на словах, отъезд, «разница ×4» с обводкой
const DOLLARS = [[-420, 330, 0], [-250, 350, 0.25], [-80, 320, 0.5], [120, 345, 0.1], [300, 330, 0.4], [450, 350, 0.2]];   // под строкой, в безопасной зоне
const RINGS = [
  {x: RING.xs[0], name: 'Opus 5.5', price: 20, color: ORANGE, say: 0, grow: 0},
  {x: RING.xs[1], name: 'Sonnet 5', price: 10, color: MINT, say: 0, grow: 0},
  {x: RING.xs[2], name: 'Haiku 4.5', price: 5, color: INK, say: 0, grow: 0},
];
RINGS[0].say = B.opusP; RINGS[0].grow = B.twenty; RINGS[1].say = B.sonnetP; RINGS[1].grow = B.ten; RINGS[2].say = B.haikuP; RINGS[2].grow = B.five;
const S7: React.FC<{t: number}> = ({t}) => {
  const {x, y} = Z7, headOut = 1 - k(t, B.opusP - 0.1, B.opusP + 0.2), out = 1 - k(t, B.drive - 0.1, B.drive + 0.2);
  return (
    <>
      <div style={{opacity: headOut}}>
        <KWords t={t} x={x} y={y - 80} size={124} words={[['Смотрим', B.look], ['на', B.look + 0.2], ['цены', B.prices]]} accent={{цены: ORANGE}} />
        <KWords t={t} x={x} y={y + 90} size={84} weight={700} color={GREY} words={[['1M', B.million], ['токенов', B.tokens], ['ответа', B.answer]]} accent={{'1M': INK}} />
        {DOLLARS.map(([dx, dy, d], i) => {
          const at = B.million + d, p = k(t, at, at + 1.1, E.out), o = Math.sin(Math.PI * Math.min(1, Math.max(0, (t - at) / 1.1)));
          return <div key={i} style={{position: 'absolute', left: x + dx, top: y + dy - p * 110, fontFamily: 'Inter Tight', fontWeight: 800, fontSize: 52, color: MINT, opacity: o}}>$</div>;
        })}
      </div>
      <div style={{opacity: out}}>
        {RINGS.map((r, i) => {
          const pop = springAt(t, r.say - 0.12), fill = (r.price / 20) * k(t, r.grow - 0.05, r.grow + 0.6, E.out);
          const land = r.grow + 0.55, hot = t > land ? Math.max(0, 1 - (t - land) / 0.8) : 0;
          const quarters = i === 0 ? [0, 1, 2, 3].map((q) => k(t, B.four - 0.1 + q * 0.14, B.four + 0.04 + q * 0.14)) : undefined;
          const hGlow = i === 2 ? k(t, B.four - 0.3, B.four - 0.1) * (1 - k(t, B.four + 0.6, B.four + 1.0)) : 0;
          return (
            <div key={i} style={{position: 'absolute', left: 0, top: 0, opacity: Math.min(1, pop * 1.5)}}>
              <div style={{position: 'absolute', left: r.x, top: RING.y, transform: `scale(${0.6 + 0.4 * Math.min(1.05, pop)})`}}>
                <Ring x={0} y={0} d={440} stroke={30} fill={fill} color={r.color} glow={hot + hGlow} quarters={quarters} />
                <div style={{position: 'absolute', left: -300, top: -95, width: 600, textAlign: 'center', fontFamily: 'Inter Tight', fontWeight: 800, fontSize: 158, lineHeight: 1.2,
                  letterSpacing: '-0.045em', color: INK}}>${countTo(t, r.grow - 0.05, r.grow + 0.6, r.price)}</div>
              </div>
              <div style={{position: 'absolute', left: r.x - 400, top: RING.y + 285, width: 800, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 22, opacity: k(t, r.say, r.say + 0.3)}}>
                <Mark name="claude" size={78} /><span style={{fontFamily: 'Manrope', fontWeight: 800, fontSize: 92, letterSpacing: '-0.03em', color: INK, whiteSpace: 'nowrap'}}>{r.name}</span>
              </div>
            </div>
          );
        })}
        <span style={{position: 'absolute', left: RING.xs[1] - 1450, top: RING.y - 490, width: 1400, textAlign: 'right', fontFamily: 'Inter Tight', fontWeight: 800, fontSize: 210,
          letterSpacing: '-0.04em', color: GREY, opacity: k(t, B.diff, B.diff + 0.3)}}>разница</span>
        <KWords t={t} x={RING.xs[1] + 10} y={RING.y - 490} size={210} align="left" words={[['×4', B.four + 0.05]]} />
        <EllipseMark t={t} a={B.four + 0.4} b={B.four + 0.85} x={RING.xs[1] + 140} y={RING.y - 370} w={420} h={290} width={12} />
        <div style={{position: 'absolute', left: RING.xs[1] - 800, top: RING.y + 430, width: 1600, textAlign: 'center', fontFamily: 'JBM', fontWeight: 600, fontSize: 88, color: GREY,
          whiteSpace: 'nowrap', opacity: k(t, B.diff, B.diff + 0.4)}}><span style={{color: MINT}}>●</span> platform.claude.com · Pricing</div>
      </div>
    </>
  );
};

// Сцена 8: «А ты гоняешь Opus на каждую строчку кода» — строки кода копятся, у каждой метка Opus и улетающий «$»
const CODE = ['const cart = getCart()', 'const total = sum(cart)', 'if (!user) return', 'render(<Checkout />)', 'log("ok")', 'export default page'];
const S8: React.FC<{t: number}> = ({t}) => {
  const {x, y} = Z8, card = springAt(t, B.drive - 0.05), step = (B.code + 0.2 - B.opusJ) / CODE.length;
  return (
    <>
      <KWords t={t} x={x} y={y - 340} size={112} words={[['гоняешь', B.drive], ['Opus', B.opusJ]]} accent={{Opus: ORANGE}} />
      <KWords t={t} x={x} y={y - 215} size={112} family="Caveat" weight={600} color={ORANGE} words={[['на', B.every - 0.15], ['каждую', B.every], ['строчку', B.line]]} />
      <div style={{position: 'absolute', left: x - 430, top: y - 60, width: 860, height: 380, borderRadius: 30, background: '#FFFFFF', opacity: Math.min(1, card * 1.5),
        boxShadow: '0 0 0 3px rgba(17,19,22,.06), 0 40px 70px rgba(17,19,22,.14)', overflow: 'hidden'}}>
        {CODE.map((c, i) => {
          const at = B.opusJ + i * step, p = springAt(t, at, 60, 16, 200), vis = Math.min(1, p * 1.6), coin = k(t, at + 0.05, at + 0.8, E.out);
          const shift = 0;
          return t < at - 0.02 ? null : (
            <div key={i} style={{position: 'absolute', left: 30, top: 24 + i * 58 - shift, right: 30, height: 52, display: 'flex', alignItems: 'center', gap: 18, opacity: vis}}>
              <span style={{fontFamily: 'JBM', fontWeight: 600, fontSize: 42, color: INK, whiteSpace: 'nowrap', flex: 1}}>{c}</span>
              <span style={{height: 48, padding: '0 18px', borderRadius: 24, background: 'rgba(255,122,47,.16)', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Manrope', fontWeight: 800,
                fontSize: 36, color: ORANGE}}><Mark name="claude" size={30} color={ORANGE} />Opus</span>
              <span style={{position: 'absolute', right: 60, top: -coin * 90, fontFamily: 'Inter Tight', fontWeight: 900, fontSize: 48, color: ORANGE, opacity: Math.sin(Math.PI * coin)}}>−$</span>
            </div>
          );
        })}
      </div>
    </>
  );
};

// Сцена 9: «Поэтому схема такая. Задача — добавить оплату на сайт» — карточка задачи с картой оплаты
const TaskCard: React.FC<{t: number; x: number; y: number; p: number; typedFrom: number; typedTo: number; w?: number}> = ({t, x, y, p, typedFrom, typedTo, w = 900}) => {
  const text = 'добавить оплату на сайт', n = Math.round(text.length * k(t, typedFrom, typedTo, (v) => v));
  return (
    <div style={{position: 'absolute', left: x - w / 2, top: y, width: w, height: 250, borderRadius: 34, background: '#FFFFFF', opacity: Math.min(1, p * 1.5),
      transform: `translateY(${(1 - Math.min(1, p)) * 60}px) scale(${0.9 + 0.1 * Math.min(1, p)})`, boxShadow: `inset 10px 0 0 ${ORANGE}, 0 0 0 3px rgba(17,19,22,.06), 0 40px 70px rgba(17,19,22,.14)`}}>
      <svg width={170} height={120} viewBox="0 0 170 120" style={{position: 'absolute', left: 50, top: 65}}>
        <rect x={4} y={4} width={162} height={112} rx={16} fill={INK} /><rect x={4} y={28} width={162} height={20} fill={ORANGE} />
        <rect x={20} y={72} width={40} height={28} rx={6} fill={MINT} /><rect x={80} y={80} width={70} height={10} rx={5} fill="#5A6066" />
      </svg>
      <div style={{position: 'absolute', left: 260, top: 42, fontFamily: 'JBM', fontWeight: 700, fontSize: 44, color: GREY}}>ЗАДАЧА</div>
      <div style={{position: 'absolute', left: 260, top: 98, right: 30, fontFamily: 'Inter Tight', fontWeight: 800, fontSize: 54, lineHeight: 1.08, color: INK, letterSpacing: '-0.03em', whiteSpace: 'nowrap'}}>{text.slice(0, n)}</div>
    </div>
  );
};
const S9: React.FC<{t: number}> = ({t}) => (
  <>
    <KWords t={t} x={Z9.x} y={Z9.y - 330} size={120} words={[['схема', B.scheme], ['такая', B.scheme + 0.34]]} accent={{схема: ORANGE}} />
    <TaskCard t={t} x={Z9.x} y={Z9.y - 90} p={springAt(t, B.task - 0.05)} typedFrom={B.add - 0.05} typedTo={B.site + 0.3} w={1000} />
  </>
);

// Станции: Opus → Sonnet → Haiku; при «то есть буквально» соты съезжаются в оргструктуру, детали гаснут
const StepPill: React.FC<{x: number; y: number; label: string; p: number}> = ({x, y, label, p}) => (
  <Pill x={x} y={y} label={label} fill={ORANGE} ink="#FFFFFF" size={48} p={p} />
);
const Stations: React.FC<{t: number}> = ({t}) => {
  const fold = springAt(t, B.literally + 0.05, 60, 16, 120), detail = 1 - k(t, B.literally - 0.1, B.literally + 0.25);
  const brain = k(t, B.brain, B.brain + 0.4), lim = 1 - k(t, B.limits - 0.4, B.limits - 0.1);
  const mv = (a: {x: number; y: number}, b: {x: number; y: number}) => ({x: a.x + (b.x - a.x) * Math.min(1, fold), y: a.y + (b.y - a.y) * Math.min(1, fold)});
  const po = mv({x: ZO.x - 300, y: ZO.y - 20}, ORG.o), ps = mv({x: ZS.x - 300, y: ZS.y - 20}, ORG.s), ph = mv({x: ZH.x - 300, y: ZH.y - 20}, ORG.h);
  const line = (a: {x: number; y: number}, b: {x: number; y: number}, p: number) => p <= 0 ? null : (
    <svg width={10} height={10} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
      <path d={`M ${a.x} ${a.y + 140} L ${a.x} ${(a.y + b.y) / 2 + 60} L ${b.x} ${(a.y + b.y) / 2 + 60} L ${b.x} ${b.y - 150}`} fill="none" stroke={INK} strokeWidth={7}
        strokeLinecap="round" pathLength={1} strokeDasharray={`${p} 1`} />
    </svg>
  );
  const lp = k(t, B.literally + 0.35, B.literally + 0.9, E.inOut) * lim * (1 - brain);
  // Opus: файлы и шаги
  const FILES = ['payments.ts', 'checkout.ts', 'styles.css', 'api/pay.ts'], hot = [0, 1, 3];
  const S_LINES: TLine[] = [
    {at: B.sonnetS - 0.05, kind: 'user', text: 'ТЗ от Opus: 3 шага'},
    {at: B.writes2 - 0.05, kind: 'tool', text: 'Write(payments.ts)'},
    {at: B.writes2 + 0.25, kind: 'add', text: 'export async function pay'},
    {at: B.writes2 + 0.6, kind: 'tool', text: 'Write(checkout.ts)'},
    {at: B.routine - 0.1, kind: 'add', text: '<PayButton />'},
    {at: B.routine + 0.25, kind: 'tool', text: 'Update(routes.ts)'},
    {at: B.spec, kind: 'think', text: 'Coding…'},
  ];
  const TESTS = ['pay() создаёт платёж', 'кнопка оплаты', 'чек на почту', 'возврат денег'];
  return (
    <>
      {line(po, ps, lp)}{line(po, ph, lp)}
      {/* заголовки станций */}
      <div style={{opacity: detail}}>
        <KWords t={t} x={ZO.x - 470} y={ZO.y - 340} size={96} align="left" words={[['01', B.first + 0.1], ['Opus', B.first + 0.25], ['думает', B.opusS + 0.32]]} accent={{'01': ORANGE, Opus: ORANGE}} />
        <KWords t={t} x={ZS.x - 470} y={ZS.y - 340} size={96} align="left" words={[['02', B.sonnetS - 0.1], ['Sonnet', B.sonnetS], ['пишет', B.writes2]]} accent={{'02': '#16B892', Sonnet: '#16B892'}} />
        <KWords t={t} x={ZH.x - 470} y={ZH.y - 340} size={96} align="left" words={[['03', B.haikuS - 0.1], ['Haiku', B.haikuS], ['проверяет', B.runs]]} accent={{'03': GREY}} />
        {/* Opus: какие файлы трогать */}
        <div style={{position: 'absolute', left: ZO.x - 40, top: ZO.y - 190, width: 520, height: 330, borderRadius: 28, background: '#FFFFFF', opacity: Math.min(1, springAt(t, B.decides - 0.1) * 1.5) * (1 - k(t, B.cuts - 0.1, B.cuts + 0.2)),
          boxShadow: '0 0 0 3px rgba(17,19,22,.06), 0 30px 60px rgba(17,19,22,.12)'}}>
          {FILES.map((f, i) => {
            const on = hot.includes(i) ? k(t, B.files + i * 0.12, B.files + 0.25 + i * 0.12) : 0;
            return <div key={f} style={{position: 'absolute', left: 24, top: 22 + i * 74, right: 24, height: 64, borderRadius: 16, display: 'flex', alignItems: 'center', gap: 14, padding: '0 18px',
              background: `rgba(255,122,47,${0.18 * on})`, fontFamily: 'JBM', fontWeight: 600, fontSize: 42, color: on > 0.5 ? INK : GREY}}>
              <span style={{color: on > 0.5 ? ORANGE : '#C9CDCB'}}>{on > 0.5 ? '✓' : '·'}</span>{f}</div>;
          })}
        </div>
        {/* Opus режет задачу на шаги */}
        {['1 · API', '2 · интерфейс', '3 · тесты'].map((s, i) => <StepPill key={s} x={ZO.x + 220} y={ZO.y - 120 + i * 125} label={s} p={springAt(t, B.cuts + 0.1 + i * 0.25)} />)}
        {/* Sonnet: терминал и рутина */}
        <Terminal t={t} x={ZS.x - 40} y={ZS.y - 210} w={540} h={430} lines={S_LINES} model="Sonnet 5" size={40} appear={springAt(t, B.sonnetS - 0.1)} />
        {['миграции', 'стили', 'роуты'].map((s, i) => <Pill key={s} x={ZS.x - 380 + i * 250} y={ZS.y + 310} label={s} outline={i === 1} size={40}
          p={springAt(t, B.routine - 0.05 + i * 0.12)} />)}
        {/* Haiku: тесты, один ловит поломку */}
        <div style={{position: 'absolute', left: ZH.x - 40, top: ZH.y - 190, width: 540, height: 360, borderRadius: 28, background: '#FFFFFF', opacity: Math.min(1, springAt(t, B.haikuS - 0.1) * 1.5),
          boxShadow: '0 0 0 3px rgba(17,19,22,.06), 0 30px 60px rgba(17,19,22,.12)'}}>
          {TESTS.map((s, i) => {
            const ok = k(t, B.tests - 0.2 + i * 0.16, B.tests + i * 0.16), bad = i === 3 ? k(t, B.catches - 0.05, B.catches + 0.15) : 0;
            const shake = i === 3 && t > B.catches && t < B.catches + 0.5 ? Math.sin((t - B.catches) * 60) * 8 * (1 - (t - B.catches) / 0.5) : 0;
            return <div key={s} style={{position: 'absolute', left: 22, top: 22 + i * 82, right: 22, height: 70, borderRadius: 16, display: 'flex', alignItems: 'center', gap: 14, padding: '0 16px',
              transform: `translateX(${shake}px)`, background: bad > 0 ? `rgba(255,122,47,${0.25 * bad})` : `rgba(61,237,195,${0.2 * ok})`, fontFamily: 'Manrope', fontWeight: 700, fontSize: 42,
              color: INK, whiteSpace: 'nowrap'}}>
              <span style={{width: 44, textAlign: 'center', fontWeight: 900, color: bad > 0.5 ? ORANGE : ok > 0.5 ? '#16B892' : '#C9CDCB'}}>{bad > 0.5 ? '✕' : ok > 0.5 ? '✓' : '·'}</span>{s}</div>;
          })}
        </div>
        <Pill x={ZH.x + 230} y={ZH.y + 250} label="→ назад Sonnet" fill={ORANGE} ink="#FFFFFF" size={44} p={springAt(t, B.broke)} />
      </div>
      {/* соты */}
      <Hex x={po.x} y={po.y} r={130} color={ORANGE} name="Opus" p={springAt(t, B.first + 0.05)} glow={brain * (0.6 + 0.4 * Math.sin(t * 5))} nameSide={fold > 0.5 ? 'right' : 'below'} />
      <Hex x={ps.x} y={ps.y} r={130} color={MINT} name="Sonnet" p={springAt(t, B.sonnetS - 0.1)} dim={0.6 * brain} nameSide={fold > 0.5 ? 'right' : 'below'} />
      <Hex x={ph.x} y={ph.y} r={130} color={INK} name="Haiku" p={springAt(t, B.haikuS - 0.1)} dim={0.6 * brain} nameSide={fold > 0.5 ? 'right' : 'below'} />
      {/* роли */}
      <div style={{opacity: lim * (1 - 0.95 * brain)}}>
        <Pill x={ORG.o.x - 420} y={ORG.o.y} label="тимлид" fill={ORANGE} ink="#FFFFFF" size={80} p={springAt(t, B.lead)} />
        <Pill x={ORG.s.x} y={ORG.s.y + 330} label="разработчик" fill={MINT} ink="#05231D" size={80} p={springAt(t, B.dev)} />
        <Pill x={ORG.h.x} y={ORG.h.y + 330} label="джун" outline size={80} p={springAt(t, B.junior)} />
      </div>
      {/* дорогой мозг: пилюли вокруг Opus */}
      <div style={{opacity: lim}}>
        <KWords t={t} x={ORG.o.x} y={ORG.o.y - 505} size={108} words={[['Дорогой', B.brain], ['мозг', B.brain + 0.26]]} accent={{мозг: ORANGE}} />
        <KWords t={t} x={ORG.o.x} y={ORG.o.y - 385} size={58} weight={700} color={GREY} words={[['только', B.brain + 0.5], ['там,', B.brain + 0.9], ['где', B.brain + 1.1], ['без', B.brain + 1.3], ['него', B.brain + 1.5], ['никак', B.brain + 1.7]]} />
        <Pill x={ORG.o.x - 250} y={ORG.o.y - 270} label="архитектура" fill={ORANGE} ink="#FFFFFF" size={44} p={springAt(t, B.arch)} />
        <Pill x={ORG.o.x + 240} y={ORG.o.y - 270} label="сложные решения" outline size={44} p={springAt(t, B.hard)} />
        <Pill x={ORG.o.x} y={ORG.o.y - 178} label="финальная проверка" fill={ORANGE} ink="#FFFFFF" size={44} p={springAt(t, B.final)} />
      </div>
    </>
  );
};

// Сцена 15: «А лимиты тают в 5 раз медленнее» — две шкалы: всё на Opus тает быстро, команда — медленно (без цифр)
const Gauge: React.FC<{x: number; y: number; r: number; v: number; color: string; label: string}> = ({x, y, r, v, color, label}) => {
  const end = {x: -r * Math.cos(Math.PI * v), y: -r * Math.sin(Math.PI * v)}, hand = Math.PI * v;
  return (
    <div style={{position: 'absolute', left: x, top: y}}>
      <svg width={10} height={10} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        <path d={`M ${-r} 0 A ${r} ${r} 0 0 1 ${r} 0`} fill="none" stroke="#E2E5E3" strokeWidth={26} strokeLinecap="round" />
        {v > 0.005 ? <path d={`M ${-r} 0 A ${r} ${r} 0 0 1 ${end.x} ${end.y}`} fill="none" stroke={color} strokeWidth={26} strokeLinecap="round" /> : null}
        <g transform={`rotate(${(hand * 180) / Math.PI - 90})`}><path d={`M -10 0 L 0 ${-r + 30} L 10 0 Z`} fill={INK} /></g>
        <circle r={22} fill={INK} />
      </svg>
      <div style={{position: 'absolute', left: -300, top: 50, width: 600, textAlign: 'center', fontFamily: 'Manrope', fontWeight: 800, fontSize: 56, color: INK, whiteSpace: 'nowrap'}}>{label}</div>
    </div>
  );
};
const S15: React.FC<{t: number}> = ({t}) => {
  const {x, y} = ZL, fast = interpolate(t, [B.melt - 0.1, B.melt + 0.9], [1, 0.06], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const slow = interpolate(t, [B.melt - 0.1, B.pair + 0.3], [1, 0.8], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <>
      <KWords t={t} x={x} y={y - 340} size={112} words={[['лимиты', B.limits], ['тают', B.melt]]} accent={{тают: ORANGE}} />
      <KWords t={t} x={x} y={y - 215} size={124} family="Caveat" weight={600} color="#16B892" words={[['медленнее', B.slower]]} />
      <Gauge x={x - 270} y={y + 180} r={200} v={fast} color={ORANGE} label="всё на Opus" />
      <Gauge x={x + 270} y={y + 180} r={200} v={slow} color={MINT} label="команда" />
    </>
  );
};

// Сцена 16: «Opus и Sonnet в связке включаются одной командой — opusplan»
const S16: React.FC<{t: number}> = ({t}) => {
  const {x, y} = ZP, join = k(t, B.bundle - 0.1, B.bundle + 0.3, E.inOut), a = springAt(t, B.pair - 0.1), b = springAt(t, B.pair + 0.45);
  const term = springAt(t, B.command - 0.35);
  const lines: TLine[] = [{at: B.opusplan + 0.6, kind: 'done', text: 'plan → Opus 5.5'}, {at: B.opusplan + 0.85, kind: 'done', text: 'код → Sonnet 5'}];
  return (
    <>
      <div style={{position: 'absolute', left: x - 330 - CAP.w / 2 + 110 * join, top: y - 330, width: CAP.w, height: CAP.h, opacity: Math.min(1, a * 1.5), transform: `scale(${0.6 + 0.4 * Math.min(1, a)})`}}><Capsule /></div>
      <div style={{position: 'absolute', left: x + 330 - CAP.w / 2 - 110 * join, top: y - 330, width: CAP.w, height: CAP.h, borderRadius: CAP.h / 2, background: MINT, display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: 14, opacity: Math.min(1, b * 1.5), transform: `scale(${0.6 + 0.4 * Math.min(1, b)})`, boxShadow: '0 6px 0 #1C9A7C, 0 22px 40px rgba(61,237,195,.35)'}}>
        <Mark name="claude" size={54} color="#05231D" /><span style={{fontFamily: 'Inter Tight', fontWeight: 800, fontSize: 62, color: '#05231D'}}>Sonnet</span>
      </div>
      <div style={{position: 'absolute', left: x - 40, top: y - 318, width: 80, height: 80, borderRadius: 40, background: INK, color: '#FFFFFF', display: 'grid', placeItems: 'center',
        fontFamily: 'Inter Tight', fontWeight: 900, fontSize: 60, opacity: join, transform: `scale(${0.5 + 0.5 * join})`}}>+</div>
      <Terminal t={t} x={x - 380} y={y - 170} w={760} h={440} lines={lines} model="opusplan" appear={term} prompt={{at: B.command + 0.1, text: '/model opusplan'}} />
    </>
  );
};

// Сцена 17: «Всю команду с агентами я собрал в готовую папку — Claude поставит её сам»
const FILES17 = [{f: 'architect.md', m: 'Opus', c: ORANGE}, {f: 'coder.md', m: 'Sonnet', c: MINT}, {f: 'checker.md', m: 'Haiku', c: INK}];
const S17: React.FC<{t: number}> = ({t}) => {
  const {x, y} = ZF, box = springAt(t, B.team - 0.1), fx = x - 250, fy = y + 20, done = k(t, B.self - 0.2, B.self + 0.1);
  const cur = k(t, B.claude - 0.1, B.install, E.inOut), press = t > B.install && t < B.install + 0.2 ? 1 : 0;
  return (
    <>
      <KWords t={t} x={x} y={y - 340} size={112} words={[['вся', B.team - 0.15], ['команда', B.team]]} accent={{команда: ORANGE}} />
      <svg width={460} height={360} viewBox="0 0 460 360" style={{position: 'absolute', left: fx - 230, top: fy - 150, opacity: Math.min(1, box * 1.5), transform: `scale(${0.6 + 0.4 * Math.min(1.04, box)})`,
        filter: `drop-shadow(0 30px 40px rgba(22,184,146,.3)) drop-shadow(0 0 ${40 * done}px rgba(61,237,195,.9))`}}>
        <path d="M20 60 Q20 30 50 30 L170 30 Q190 30 200 50 L215 72 L410 72 Q440 72 440 102 L440 320 Q440 346 410 346 L50 346 Q20 346 20 316 Z" fill="#16B892" />
        <path d="M20 118 Q20 96 44 96 L416 96 Q440 96 440 120 L440 320 Q440 346 410 346 L50 346 Q20 346 20 316 Z" fill={MINT} />
      </svg>
      <div style={{position: 'absolute', left: fx - 200, top: fy + 60, width: 400, textAlign: 'center', fontFamily: 'JBM', fontWeight: 800, fontSize: 50, color: '#05231D', opacity: k(t, B.folder - 0.1, B.folder + 0.2)}}>opus-team/</div>
      {FILES17.map((f, i) => {
        const at = B.team + 0.05 + i * 0.22, p = k(t, at, at + 0.55, E.inOut), inside = k(t, B.folder - 0.2, B.folder + 0.15);
        const sx = x + 250, sy = y - 170 + i * 115, ex = fx, ey = fy - 40;
        const px = sx + (ex - sx) * inside, py = sy + (ey - sy) * inside;
        return <div key={f.f} style={{position: 'absolute', left: px - 190, top: py - 45, width: 380, height: 90, borderRadius: 20, background: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 14, padding: '0 20px',
          boxShadow: `inset 8px 0 0 ${f.c}, 0 18px 34px rgba(17,19,22,.14)`, opacity: Math.min(1, p * 2) * (1 - inside * 0.9), transform: `scale(${(0.7 + 0.3 * p) * (1 - 0.5 * inside)})`,
          fontFamily: 'JBM', fontWeight: 700, fontSize: 42, color: INK, whiteSpace: 'nowrap'}}>{f.f}<span style={{marginLeft: 'auto', fontFamily: 'Manrope', fontSize: 38, color: f.c === INK ? GREY : f.c}}>{f.m}</span></div>;
      })}
      {/* курсор Claude нажимает на папку, папка ставится */}
      <div style={{position: 'absolute', left: x + 420 + (fx + 60 - x - 420) * cur, top: y + 260 + (fy - y - 260 + 40) * cur, opacity: k(t, B.claude - 0.2, B.claude), transform: `scale(${press ? 0.86 : 1})`}}>
        <svg width={70} height={84} viewBox="0 0 24 28"><path d="M2 2 L2 22 L7.5 17 L11 26 L14.5 24.5 L11 16 L18 16 Z" fill={INK} stroke="#FFFFFF" strokeWidth={1.6} strokeLinejoin="round" /></svg>
        <div style={{position: 'absolute', left: 60, top: 60, height: 60, padding: '0 18px', borderRadius: 30, background: ORANGE, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Manrope',
          fontWeight: 800, fontSize: 40, color: '#FFFFFF', whiteSpace: 'nowrap'}}><Mark name="claude" size={34} color="#FFFFFF" />Claude</div>
      </div>
      <Pill x={fx} y={fy + 240} label="✓ установлено" fill={MINT} ink="#05231D" size={48} p={springAt(t, B.self - 0.1)} />
    </>
  );
};

// Сцена 18: «Напиши в комментариях слово «тимлид» — скину скилл по оркестрации агентов»
const S18: React.FC<{t: number}> = ({t}) => {
  const {x, y} = ZC, sheet = springAt(t, B.write - 0.05), word = 'тимлид', n = Math.round(word.length * k(t, B.word - 0.05, B.word + 0.3, (v) => v));
  const posted = springAt(t, B.send - 0.05), dm = springAt(t, B.skill - 0.05);
  return (
    <>
      <Pill x={x} y={y - 300} label="напиши «тимлид» в комментариях" fill={INK} ink="#FFFFFF" size={50} p={springAt(t, B.write)} />
      <div style={{position: 'absolute', left: x - 470, top: y - 190, width: 560, height: 470, borderRadius: 36, background: '#FFFFFF', opacity: Math.min(1, sheet * 1.5),
        transform: `translateY(${(1 - Math.min(1, sheet)) * 120}px)`, boxShadow: '0 0 0 3px rgba(17,19,22,.06), 0 40px 70px rgba(17,19,22,.14)'}}>
        <div style={{position: 'absolute', left: 0, right: 0, top: 22, textAlign: 'center', fontFamily: 'Manrope', fontWeight: 800, fontSize: 44, color: INK}}>Комментарии</div>
        <div style={{position: 'absolute', left: 30, top: 110, display: 'flex', alignItems: 'center', gap: 16, opacity: Math.min(1, posted * 1.5), transform: `translateY(${(1 - Math.min(1, posted)) * 40}px)`}}>
          <div style={{width: 64, height: 64, borderRadius: 32, background: `linear-gradient(135deg, ${ORANGE}, ${MINT})`}} />
          <span style={{position: 'relative', fontFamily: 'Manrope', fontWeight: 800, fontSize: 48, color: INK, padding: '0 10px'}}>
            <span style={{position: 'absolute', left: 0, top: 6, bottom: 2, borderRadius: 12, background: 'rgba(255,122,47,.28)', width: `${100 * k(t, B.send + 0.15, B.send + 0.5, E.inOut)}%`}} />
            <span style={{position: 'relative'}}>тимлид</span>
          </span>
        </div>
        <div style={{position: 'absolute', left: 24, right: 24, bottom: 26, height: 96, borderRadius: 48, border: `4px solid ${t > B.word - 0.1 ? ORANGE : '#D9DDDB'}`, display: 'flex', alignItems: 'center',
          padding: '0 30px', fontFamily: 'Manrope', fontWeight: 700, fontSize: 42, color: INK, whiteSpace: 'nowrap', overflow: 'hidden'}}>
          {posted > 0.3 ? <span style={{color: GREY}}>Комментарий…</span> : <>{word.slice(0, n)}{t > B.word - 0.1 && Math.floor(t * 2.4) % 2 === 0 ? <span style={{color: ORANGE}}>|</span> : null}</>}
        </div>
      </div>
      {/* директ: скилл по оркестрации агентов */}
      <div style={{position: 'absolute', left: x + 100, top: y - 120, width: 400, borderRadius: 32, background: INK, padding: 26, opacity: Math.min(1, dm * 1.5),
        transform: `translateX(${(1 - Math.min(1, dm)) * 120}px) scale(${0.8 + 0.2 * Math.min(1, dm)})`, boxShadow: '0 30px 60px rgba(17,19,22,.25)'}}>
        <div style={{fontFamily: 'Manrope', fontWeight: 700, fontSize: 40, color: '#8B9197'}}>Директ</div>
        <div style={{marginTop: 12, fontFamily: 'Manrope', fontWeight: 800, fontSize: 46, lineHeight: 1.15, color: '#FFFFFF'}}>скилл по оркестрации агентов</div>
        <div style={{marginTop: 18, height: 84, borderRadius: 20, background: MINT, display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', fontFamily: 'JBM', fontWeight: 800, fontSize: 40,
          color: '#05231D', opacity: k(t, B.orch, B.orch + 0.3)}}>📁 opus-team</div>
      </div>
    </>
  );
};

export const BodyScenes: React.FC<{t: number}> = ({t}) => {
  const v = (w: readonly [number, number]) => t > w[0] && t < w[1];
  const Wn = BODY_WINDOWS;
  return (
    <>
      {v(Wn.s6) ? <S6 t={t} /> : null}
      {v(Wn.s7) ? <S7 t={t} /> : null}
      {v(Wn.s8) ? <S8 t={t} /> : null}
      {v(Wn.s9) ? <S9 t={t} /> : null}
      {v(Wn.st) ? <Stations t={t} /> : null}
      {v(Wn.s15) ? <S15 t={t} /> : null}
      {v(Wn.s16) ? <S16 t={t} /> : null}
      {v(Wn.s17) ? <S17 t={t} /> : null}
      {v(Wn.s18) ? <S18 t={t} /> : null}
    </>
  );
};
void HT;
