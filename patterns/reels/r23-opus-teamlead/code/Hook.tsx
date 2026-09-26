import {interpolate} from 'remotion';
import {E, k, Mark} from '../../montage/parts';
import {springAt} from '../../styles/parts';
import {blurOf, camAt, EllipseMark, GREY, INK, KWords, MINT, MotionBlurDefs, ORANGE, PaperBg, worldTransform, type CamKey} from './kinetic';
import {Terminal, type TLine} from './Terminal';
import {at23} from './words23';

// Ролик 23, 0–10 с — проба концепции на белом кинетическом холсте (паттерны референса 24.09: отъезд от огромного слова,
// слова по одному, рывки камеры с размытием, огромный циферблат, ряд людей с выделенным центром, печать с кареткой).
// Каждая сцена — одна фраза и один предмет; камера ездит между сценами по одному холсту.
export const T = {
  claude: at23('claude', 0), dropped: at23('уронили'), limits: at23('лимиты', 0), subs: at23('подписок'),
  now: at23('теперь'), limits2: at23('лимиты', 1), melt: at23('тают'), eyes: at23('глазах'),
  so: at23('поэтому'), cc2: at23('claude', 1), less: at23('меньше'), let: at23('пускаю'), opus: at23('opus', 0), write: at23('писать'), code: at23('код'),
  opus2: at23('opus', 1), cool: at23('крутой'), boss: at23('начальник'), cc3: at23('claude', 2), official: at23('официальный'), mode: at23('режим'),
};
// центры сцен на холсте
export const Z1 = {x: 0, y: 0}, Z2 = {x: 150, y: 1500}, Z3 = {x: 1750, y: 1500}, Z4 = {x: 1750, y: 2700}, Z5 = {x: 3250, y: 2700};
export const HOOK_CAM: CamKey[] = [
  [0, 15, -215, 1.12], [0.1, 15, -215, 1.12], [0.95, 0, 20, 1],   // «Claude Code» крупно, но целиком в безопасной зоне                 // «Claude Code» огромно с кадра 0 → отъезд
  [T.now - 0.12, 0, 20, 1], [T.now + 0.25, Z2.x, Z2.y, 1],                    // рывок вниз к циферблату лимита
  [T.so - 0.08, Z2.x, Z2.y, 1], [T.so + 0.3, Z3.x, Z3.y, 1],                  // рывок вправо к окну Claude Code
  [T.opus2 - 0.12, Z3.x, Z3.y, 1], [T.opus2 + 0.22, Z4.x, Z4.y, 1],              // рывок вниз к команде
  [T.cc3 - 0.1, Z4.x, Z4.y, 1], [T.cc3 + 0.25, Z5.x, Z5.y, 1],                   // рывок вправо к режиму
];
const BLOBS: [number, number, number][] = [[0, 0, 1500], [150, 1750, 1500], [1750, 1500, 1300], [1750, 2800, 1500], [3250, 2600, 1500]];
const RINGS: [number, number, number][] = [[-700, -400, 1600], [900, 900, 2000], [2600, 2100, 1800], [3900, 3200, 2200]];

// Человечек: голова + плечи, как иконки референса
export const Person: React.FC<{x: number; y: number; s: number; color: string}> = ({x, y, s, color}) => (
  <svg width={s} height={s} viewBox="0 0 100 100" style={{position: 'absolute', left: x - s / 2, top: y - s / 2, overflow: 'visible'}}>
    <circle cx={50} cy={30} r={20} fill={color} />
    <path d="M12 96 C12 66 28 56 50 56 C72 56 88 66 88 96 Z" fill={color} />
  </svg>
);
// Уголки выделения вокруг выбранного (референс: рамка вокруг центрального человека)
export const Brackets: React.FC<{x: number; y: number; w: number; h: number; p: number; color?: string}> = ({x, y, w, h, p, color = ORANGE}) => {
  const L = 44 * p, th = 8;
  const c = (l: number, tp: number, bl: string) => <div style={{position: 'absolute', left: l, top: tp, width: L, height: L, borderColor: color, borderStyle: 'solid', borderWidth: 0, ...Object.fromEntries(bl.split(' ').map((b) => [b, th]))}} />;
  return (
    <div style={{position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, opacity: p}}>
      {c(0, 0, 'borderTopWidth borderLeftWidth')}{c(w - L, 0, 'borderTopWidth borderRightWidth')}
      {c(0, h - L, 'borderBottomWidth borderLeftWidth')}{c(w - L, h - L, 'borderBottomWidth borderRightWidth')}
    </div>
  );
};

// Сцена 1: «В Claude Code опять уронили лимиты подписок» — «лимиты» падает сверху с отскоком (буквально «уронили»)
export const S1: React.FC<{t: number}> = ({t}) => {
  const drop = springAt(t, T.limits - 0.05, 60, 9, 150), y = -380 * (1 - drop);
  return (
    <>
      <div style={{position: 'absolute', left: -430, top: -280, display: 'flex', alignItems: 'center', gap: 24}}>
        <Mark name="claude" size={110} />
        <span style={{fontFamily: 'Inter Tight', fontWeight: 800, fontSize: 124, letterSpacing: '-0.04em', color: INK, whiteSpace: 'nowrap'}}>Claude Code</span>
      </div>
      <KWords t={t} x={-430} y={-130} size={104} weight={700} color={GREY} align="left" words={[['опять', 0.6], ['уронили', T.dropped]]} />
      <div style={{position: 'absolute', left: -430, top: -10 + y, opacity: Math.min(1, drop * 3), fontFamily: 'Inter Tight', fontWeight: 900, fontSize: 196,
        letterSpacing: '-0.05em', color: ORANGE, whiteSpace: 'nowrap', transform: `rotate(${(1 - Math.min(1, drop)) * -6}deg)`}}>лимиты</div>
      <KWords t={t} x={-430} y={200} size={104} weight={700} color={INK} align="left" words={[['подписок', T.subs]]} />
    </>
  );
};

// Сцена 2: «Теперь лимиты тают на глазах» — огромная шкала лимита, дуга тает, стрелка падает к нулю (референс: циферблат)
export const S2: React.FC<{t: number}> = ({t}) => {
  const {x, y} = Z2, cx = x, cy = y + 300, R = 300;
  const melt = interpolate(t, [T.limits2, T.eyes + 0.35], [1, 0.07], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: E.inOut});
  const ang = Math.PI * (1 - melt), nx = cx + Math.cos(Math.PI - ang) * -1, hand = Math.PI - Math.PI * melt;
  const arcEnd = {x: cx - R * Math.cos(Math.PI * melt), y: cy - R * Math.sin(Math.PI * melt)};
  const flash = t > T.eyes + 0.3 ? Math.abs(Math.sin((t - T.eyes) * 14)) * (1 - k(t, T.eyes + 0.3, T.eyes + 1.0)) : 0;
  void nx;
  return (
    <>
      <KWords t={t} x={x} y={y - 350} size={108} words={[['лимиты', T.limits2], ['тают', T.melt]]} accent={{тают: ORANGE}} />
      <KWords t={t} x={x} y={y - 235} size={116} family="Caveat" weight={600} color={MINT} words={[['на', T.eyes - 0.1], ['глазах', T.eyes]]} />
      <svg width={1400} height={700} style={{position: 'absolute', left: cx - 700, top: cy - 640, overflow: 'visible'}}>
        <g transform={`translate(700 640)`}>
          {Array.from({length: 37}, (_, i) => {
            const a = Math.PI * (i / 36), long = i % 6 === 0, r1 = R + 30, r2 = R + (long ? 74 : 52);
            return <line key={i} x1={-Math.cos(a) * r1} y1={-Math.sin(a) * r1} x2={-Math.cos(a) * r2} y2={-Math.sin(a) * r2} stroke={long ? INK : '#C9CDCB'} strokeWidth={long ? 8 : 5} strokeLinecap="round" />;
          })}
          <path d={`M ${-R} 0 A ${R} ${R} 0 0 1 ${R} 0`} fill="none" stroke="#E2E5E3" strokeWidth={30} strokeLinecap="round" />
          <path d={`M ${-R} 0 A ${R} ${R} 0 0 1 ${arcEnd.x - cx} ${arcEnd.y - cy}`} fill="none" stroke={ORANGE} strokeWidth={30} strokeLinecap="round"
            style={{filter: `drop-shadow(0 0 ${18 + 40 * flash}px rgba(255,122,47,${0.45 + 0.5 * flash}))`}} />
          <g transform={`rotate(${(hand * 180) / Math.PI - 90})`}>
            <path d="M -12 0 L 0 -280 L 12 0 Z" fill={INK} />
            <path d="M -24 -170 L 0 -218 L 24 -170 L 0 -122 Z" fill="none" stroke={INK} strokeWidth={9} strokeLinejoin="round" />
          </g>
          <circle r={28} fill={INK} /><circle r={10} fill={MINT} />
        </g>
      </svg>
      <div style={{position: 'absolute', left: cx - 400, top: cy + 50, width: 800, textAlign: 'center', fontFamily: 'Manrope', fontWeight: 700, fontSize: 48, color: GREY, opacity: 0}}>лимит подписки</div>
    </>
  );
};

// Сцена 3: «Поэтому Claude Code я всё меньше пускаю Opus писать код» — живой терминал Claude Code сам пишет код
// (модель в статусе — Sonnet), плашка Opus едет к терминалу и отскакивает от его кромки
const S3_LINES = (): TLine[] => [
  {at: T.so + 0.2, kind: 'user', text: 'добавь оплату'},
  {at: T.so + 0.55, kind: 'think', text: 'Thinking…'},
  {at: T.cc2 + 0.45, kind: 'tool', text: 'Read(payments.ts)'},
  {at: T.cc2 + 0.7, kind: 'out', text: '42 строки'},
  {at: T.less - 0.05, kind: 'tool', text: 'Update(checkout.ts)'},
  {at: T.let - 0.05, kind: 'del', text: 'TODO: оплата'},
  {at: T.let + 0.15, kind: 'add', text: 'stripe.charge(order)'},
  {at: T.opus + 0.05, kind: 'add', text: 'await sendReceipt()'},
  {at: T.write + 0.25, kind: 'think', text: 'Coding…'},
];
// Стеклянная капсула Opus: матовое стекло, блик сверху, оранжевая искра и надпись
export const CAP = {w: 300, h: 112};
export const Capsule: React.FC<{clip?: string; crack?: number}> = ({clip, crack = 0}) => (
  <div style={{position: 'absolute', left: 0, top: 0, width: CAP.w, height: CAP.h, borderRadius: CAP.h / 2, clipPath: clip,
    background: 'linear-gradient(180deg, rgba(255,255,255,.72) 0%, rgba(255,236,224,.42) 55%, rgba(255,122,47,.28) 100%)',
    boxShadow: 'inset 0 0 0 3px rgba(255,255,255,.95), inset 0 -10px 22px rgba(255,122,47,.35), inset 0 8px 14px rgba(255,255,255,.9), 0 24px 40px rgba(255,122,47,.28)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14}}>
    <div style={{position: 'absolute', left: 34, top: 12, width: CAP.w - 68, height: 22, borderRadius: 11, background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.95), rgba(255,255,255,0))'}} />
    <Mark name="claude" size={54} color={ORANGE} />
    <span style={{fontFamily: 'Inter Tight', fontWeight: 800, fontSize: 62, color: ORANGE, letterSpacing: '-0.03em'}}>Opus</span>
    {crack > 0 ? (
      <svg width={CAP.w} height={CAP.h} style={{position: 'absolute', left: 0, top: 0}}>
        <path d="M300 56 L232 44 L196 70 L150 38 L112 64 L70 30 M232 44 L240 8 M196 70 L204 108 M150 38 L138 4 M112 64 L96 110" fill="none"
          stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" pathLength={1} strokeDasharray={`${crack} 1`} style={{filter: 'drop-shadow(0 0 6px rgba(255,122,47,.9))'}} />
      </svg>
    ) : null}
  </div>
);
// осколки: многоугольники внутри капсулы (в долях ширины/высоты) и их разлёт [vx, vy, поворот]
const SHARDS: [string, number, number, number][] = [
  ['0% 0%, 30% 0%, 22% 60%, 0% 100%', -520, -260, -220], ['30% 0%, 52% 0%, 40% 55%, 22% 60%', -380, -420, 160],
  ['52% 0%, 78% 0%, 66% 40%, 40% 55%', -240, -520, -140], ['78% 0%, 100% 0%, 100% 50%, 66% 40%', -120, -360, 260],
  ['0% 100%, 22% 60%, 38% 100%', -560, 120, 200], ['22% 60%, 40% 55%, 58% 100%, 38% 100%', -420, 260, -180],
  ['40% 55%, 66% 40%, 76% 100%, 58% 100%', -260, 340, 150], ['66% 40%, 100% 50%, 100% 100%, 76% 100%', -140, 220, -260],
];
export const S3: React.FC<{t: number}> = ({t}) => {
  const {x, y} = Z3, win = springAt(t, T.so + 0.02), hitAt = T.write, term = {x: x - 120, y: y - 190, w: 620, h: 480};
  const go = k(t, T.opus + 0.02, hitAt, E.acc), cx = x - 620 + go * 350, cy = y + 60;
  const hit = t > hitAt ? Math.max(0, 1 - (t - hitAt) / 0.45) : 0, cap = springAt(t, T.opus - 0.12), crack = k(t, hitAt - 0.06, hitAt + 0.02);
  const p = Math.max(0, t - hitAt - 0.03);
  return (
    <>
      <KWords t={t} x={x} y={y - 340} size={108} words={[['всё', T.so + 0.15], ['меньше', T.less], ['пускаю', T.let]]} accent={{меньше: ORANGE}} />
      <Terminal t={t} x={term.x} y={term.y} w={term.w} h={term.h} lines={S3_LINES()} model="Sonnet 5" appear={win}
        glow={hit} />
      {p <= 0 ? (
        <div style={{position: 'absolute', left: cx - CAP.w / 2, top: cy - CAP.h / 2, width: CAP.w, height: CAP.h, opacity: Math.min(1, cap * 1.5),
          transform: `scale(${0.7 + 0.3 * Math.min(1.04, cap)})`}}><Capsule crack={crack} /></div>
      ) : SHARDS.map(([poly, vx, vy, rot], i) => {
        const q = Math.min(1, p / 0.9), dx = vx * q, dy = vy * q * 0.8 + 900 * p * p, o = 1 - k(t, hitAt + 0.35, hitAt + 0.9);
        return <div key={i} style={{position: 'absolute', left: cx - CAP.w / 2, top: cy - CAP.h / 2, width: CAP.w, height: CAP.h, opacity: o,
          transform: `translate(${dx}px, ${dy}px) rotate(${rot * q}deg)`, transformOrigin: '50% 50%'}}><Capsule clip={`polygon(${poly})`} /></div>;
      })}
      {p > 0 && p < 0.25 ? <div style={{position: 'absolute', left: term.x - 90, top: cy - 90, width: 180, height: 180, borderRadius: '50%', opacity: 1 - p / 0.25,
        background: 'radial-gradient(closest-side, rgba(255,255,255,.95), rgba(255,122,47,.4), rgba(255,122,47,0))'}} /> : null}
      <KWords t={t} x={x - 560} y={y + 190} size={100} family="Caveat" weight={600} color={MINT} align="left" words={[['писать', T.write], ['код', T.code]]} />
    </>
  );
};

// Сцена 4: «Opus — это крутой начальник» — ряд людей, центральный чёрный в рамке выделения с меткой Opus (референс)
export const S4: React.FC<{t: number}> = ({t}) => {
  const {x, y} = Z4, row = [-2, -1, 0, 1, 2], boss = springAt(t, T.boss - 0.05);
  return (
    <>
      <KWords t={t} x={x} y={y - 340} size={108} words={[['Opus', T.opus2], ['—', T.opus2 + 0.2], ['это', T.opus2 + 0.34], ['крутой', T.cool]]} accent={{Opus: ORANGE}} />
      <KWords t={t} x={x} y={y - 225} size={132} family="Caveat" weight={600} color={MINT} words={[['начальник', T.boss]]} />
      {row.map((i) => {
        const p = springAt(t, T.opus2 - 0.05 + Math.abs(i) * 0.07), c = i === 0;
        const s = c ? 190 * (1 + 0.12 * Math.min(1, boss)) : 140, dim = c ? 0 : 0.35 * Math.min(1, boss);
        return <div key={i} style={{opacity: Math.min(1, p * 1.5) * (1 - dim)}}><Person x={x + i * 200} y={y + 110 - (c ? 12 : 0)} s={s * (0.6 + 0.4 * Math.min(1, p))} color={c ? INK : MINT} /></div>;
      })}
      <Brackets x={x} y={y + 95} w={270} h={260} p={Math.min(1, boss)} />
      <div style={{position: 'absolute', left: x - 110, top: y + 238, width: 220, height: 76, borderRadius: 38, background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 10, opacity: Math.min(1, boss), transform: `scale(${0.6 + 0.4 * Math.min(1, boss)})`}}>
        <Mark name="claude" size={40} color="#FFFFFF" /><span style={{fontFamily: 'Inter Tight', fontWeight: 800, fontSize: 46, color: '#FFFFFF'}}>Opus</span>
      </div>
    </>
  );
};

// Сцена 5: «В Claude Code под это есть официальный режим» — печать с кареткой, «официальный» обводится маркером
export const S5: React.FC<{t: number}> = ({t}) => {
  const {x, y} = Z5, l1 = 'официальный', l2 = 'режим';
  const n1 = Math.round(l1.length * k(t, T.official - 0.05, T.mode - 0.12, (v) => v)), n2 = Math.round(l2.length * k(t, T.mode - 0.05, T.mode + 0.3, (v) => v));
  const caret = Math.floor(t * 2.4) % 2 === 0 ? 1 : 0, doc = springAt(t, T.cc3), typ: React.CSSProperties = {position: 'absolute', left: x - 400, fontFamily: 'Inter Tight',
    fontWeight: 800, fontSize: 132, letterSpacing: '-0.04em', whiteSpace: 'nowrap', lineHeight: 1.05};
  const Caret = () => <span style={{display: 'inline-block', width: 10, height: 118, marginLeft: 8, verticalAlign: 'middle', background: MINT, opacity: caret}} />;
  return (
    <>
      <div style={{position: 'absolute', left: x - 400, top: y - 330, height: 92, padding: '0 32px', borderRadius: 46, border: `4px solid ${INK}`, display: 'flex', alignItems: 'center',
        gap: 16, opacity: Math.min(1, doc * 1.5), transform: `scale(${0.7 + 0.3 * Math.min(1, doc)})`, transformOrigin: 'left center', background: '#FFFFFF'}}>
        <Mark name="claude" size={50} /><span style={{fontFamily: 'Manrope', fontWeight: 800, fontSize: 50, color: INK, whiteSpace: 'nowrap'}}>Claude Code · docs</span>
      </div>
      <div style={{...typ, top: y - 170, color: INK}}>{l1.slice(0, n1)}{n2 === 0 && t > T.official - 0.1 ? <Caret /> : null}</div>
      <div style={{...typ, top: y - 20, color: ORANGE}}>{l2.slice(0, n2)}{n2 > 0 ? <Caret /> : null}</div>
      <EllipseMark t={t} a={T.mode + 0.3} b={T.mode + 0.75} x={x - 400 + 210} y={y + 50} w={520} h={220} color={MINT} />
    </>
  );
};

export const Hook: React.FC<{t: number; w: number; h: number}> = ({t, w, h}) => {
  const cam = camAt(t, HOOK_CAM), mb = blurOf(t, HOOK_CAM), blur = mb.x + mb.y > 0.8;
  const vis = (a: number, b: number) => (t > a - 0.6 && t < b + 0.6 ? 1 : 0);
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: w, height: h, overflow: 'hidden'}}>
      <PaperBg cam={cam} w={w} h={h} blobs={BLOBS} rings={RINGS} />
      <MotionBlurDefs id="mbHook" x={mb.x} y={mb.y} />
      <div style={{position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: worldTransform(cam), filter: blur ? 'url(#mbHook)' : undefined}}>
        {vis(0, T.now + 0.3) ? <S1 t={t} /> : null}
        {vis(T.now - 0.3, T.so + 0.4) ? <S2 t={t} /> : null}
        {vis(T.so - 0.3, T.opus2 + 0.4) ? <S3 t={t} /> : null}
        {vis(T.opus2 - 0.3, T.cc3 + 0.4) ? <S4 t={t} /> : null}
        {vis(T.cc3 - 0.3, 99) ? <S5 t={t} /> : null}
      </div>
    </div>
  );
};
