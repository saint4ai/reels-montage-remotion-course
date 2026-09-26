import {countTo, E, k, Mark} from '../../montage/parts';
import {springAt} from '../../styles/parts';
import {blurOf, camAt, EllipseMark, GREY, INK, KWords, MINT, MotionBlurDefs, ORANGE, PaperBg, Ring, worldTransform, type CamKey} from './kinetic';
import {PRICE} from './words';

// Б4 «Смотри на цены» в стиле СЦЕНЫ на белом кинетическом холсте (референс 24.09): камера отъезжает от огромного
// слова «цены», слова строки появляются по одному, рывком летит к трём кольцам-счётчикам — дуга растёт вместе с числом
// ровно на «двадцать / десять / пять». На «в четыре раза» — отъезд на все три кольца, у Opus по очереди вспыхивают
// четыре четверти (одна четверть = Haiku), встаёт «×4» и его обводит рисованный мятный овал.
// Цены — прайс Anthropic, снимок public/r23/shots/pricing.png (24.09.2026): за 1M токенов ответа $20 / $10 / $5.
const R = [
  {x: 1150, name: 'Opus 5.5', price: 20, color: ORANGE, say: PRICE.opus, grow: PRICE.twenty},
  {x: 1750, name: 'Sonnet 5', price: 10, color: MINT, say: PRICE.sonnet, grow: PRICE.ten},
  {x: 2350, name: 'Haiku 4.5', price: 5, color: INK, say: PRICE.haiku, grow: PRICE.five},
];
const RY = 820, D = 440, SW = 30;
const CAM: CamKey[] = [
  [0, 328, -15, 3.2], [0.12, 328, -15, 3.2], [0.95, 20, 40, 1], // «цены» читается с кадра 0, потом отъезд
  [2.15, 20, 40, 1], [2.55, R[0].x, 900, 1.05],               // рывок к Opus на «Opus»
  [3.75, R[0].x, 900, 1.05], [4.12, R[1].x, 900, 1.05],       // к Sonnet
  [4.85, R[1].x, 900, 1.05], [5.18, R[2].x, 900, 1.05],       // к Haiku
  [5.95, R[2].x, 900, 1.05], [6.45, 1750, 770, 0.5],          // отъезд на все три на «Разница»
  [7.75, 1750, 770, 0.5], [8.35, R[0].x, 880, 1.2],           // укол: наезд на Opus на «гоняешь Opus»
];
const BLOBS: [number, number, number][] = [[0, 0, 1400], [1150, 820, 1300], [2350, 700, 1300], [1750, 1350, 1700]];
const RINGS: [number, number, number][] = [[-520, -320, 1500], [2750, 260, 1800], [1500, 1600, 2300]];
const DOLLARS = [[-700, 150, 1.1], [-610, 230, 1.35], [-540, 120, 1.6], [560, 170, 1.2], [640, 240, 1.5], [720, 130, 1.3]];   // по бокам строки, не поверх букв

export const PriceKinetic: React.FC<{t: number; w: number; h: number}> = ({t, w, h}) => {
  const cam = camAt(t, CAM), mb = blurOf(t, CAM), blur = mb.x + mb.y > 0.8;
  const headOut = 1 - k(t, 2.2, 2.5);
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: w, height: h, overflow: 'hidden'}}>
      <PaperBg cam={cam} w={w} h={h} blobs={BLOBS} rings={RINGS} />
      <MotionBlurDefs id="mbPrice" x={mb.x} y={mb.y} />
      <div style={{position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: worldTransform(cam), filter: blur ? 'url(#mbPrice)' : undefined}}>
        {/* строка «Смотри на цены / 1M токенов ответа» — видна с первого кадра огромным словом «цены» */}
        <div style={{opacity: headOut}}>
          <KWords t={t} x={0} y={-80} size={124} words={[['Смотри', 0], ['на', 0], ['цены', 0]]} accent={{цены: ORANGE}} />
          <KWords t={t} x={0} y={90} size={84} weight={700} color={GREY} words={[['1M', PRICE.head], ['токенов', PRICE.head + 0.4], ['ответа', PRICE.head + 0.8]]} accent={{'1M': INK}} />
          {DOLLARS.map(([x, y, at], i) => {
            const p = k(t, at, at + 1.1, E.out), o = Math.sin(Math.PI * Math.min(1, Math.max(0, (t - at) / 1.1)));
            return <div key={i} style={{position: 'absolute', left: x, top: y + 60 - p * 170, fontFamily: 'Inter Tight', fontWeight: 800, fontSize: 48, color: MINT, opacity: o}}>$</div>;
          })}
        </div>
        {R.map((r, i) => {
          const pop = springAt(t, r.say - 0.12), fill = (r.price / 20) * k(t, r.grow - 0.05, r.grow + 0.6, E.out);
          const land = r.grow + 0.55, hot = t > land ? Math.max(0, 1 - (t - land) / 0.8) : 0;
          const quarters = i === 0 ? [0, 1, 2, 3].map((q) => k(t, PRICE.four - 0.08 + q * 0.16, PRICE.four + 0.06 + q * 0.16) * (1 - k(t, PRICE.jab, PRICE.jab + 0.4))) : undefined;
          const jab = i === 0 ? k(t, PRICE.jab + 0.55, PRICE.jab + 0.9) : 0, haikuGlow = i === 2 ? k(t, PRICE.four - 0.2, PRICE.four) * (1 - k(t, PRICE.four + 0.9, PRICE.four + 1.3)) : 0;
          return (
            <div key={i} style={{position: 'absolute', left: 0, top: 0, opacity: Math.min(1, pop * 1.5)}}>
              <div style={{position: 'absolute', left: r.x, top: RY, transform: `scale(${0.6 + 0.4 * Math.min(1.05, pop)})`}}>
                <Ring x={0} y={0} d={D} stroke={SW} fill={fill} color={r.color} glow={hot + jab + haikuGlow} quarters={quarters} />
                <div style={{position: 'absolute', left: -300, top: -95, width: 600, textAlign: 'center', fontFamily: 'Inter Tight', fontWeight: 800, fontSize: 158,
                  lineHeight: 1.2, letterSpacing: '-0.045em', color: INK}}>${countTo(t, r.grow - 0.05, r.grow + 0.6, r.price)}</div>
              </div>
              <div style={{position: 'absolute', left: r.x - 400, top: RY + 285, width: 800, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 22,
                opacity: k(t, r.say, r.say + 0.3)}}>
                <Mark name="claude" size={78} />
                <span style={{fontFamily: 'Manrope', fontWeight: 800, fontSize: 92, letterSpacing: '-0.03em', color: INK, whiteSpace: 'nowrap'}}>{r.name}</span>
              </div>
            </div>
          );
        })}
        {/* «разница ×4» над кольцами и рисованная обводка «×4» */}
        <div style={{position: 'absolute', left: 0, top: 0, opacity: 1 - k(t, PRICE.jab + 0.2, PRICE.jab + 0.6)}}>
          <div style={{position: 'absolute', left: 1700 - 1400, top: 330, width: 1400, textAlign: 'right'}}>
            <span style={{fontFamily: 'Inter Tight', fontWeight: 800, fontSize: 210, letterSpacing: '-0.04em', color: GREY, whiteSpace: 'nowrap',
              opacity: k(t, PRICE.four - 0.6, PRICE.four - 0.3), filter: `blur(${(1 - k(t, PRICE.four - 0.6, PRICE.four - 0.3)) * 12}px)`}}>разница</span>
          </div>
          <KWords t={t} x={1760} y={330} size={210} align="left" words={[['×4', PRICE.four + 0.1]]} />
          <EllipseMark t={t} a={PRICE.four + 0.45} b={PRICE.four + 0.95} x={1890} y={450} w={420} h={290} width={12} />
        </div>
        <div style={{position: 'absolute', left: 1750 - 800, top: 1250, width: 1600, textAlign: 'center', fontFamily: 'JBM', fontWeight: 600, fontSize: 88, color: GREY,
          whiteSpace: 'nowrap', opacity: k(t, 5.9, 6.3) * (1 - k(t, PRICE.jab + 0.2, PRICE.jab + 0.6))}}>
          <span style={{color: MINT}}>●</span> platform.claude.com · Pricing
        </div>
      </div>
    </div>
  );
};
