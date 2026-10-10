import React from 'react';
import WORDS from '../../../../public/rm/r39/words.json';
import META from '../../../../public/rm/r39/meta.json';
import {Draw} from '../../../styles/parts';
import {
  capWords, Card, CheckIco, CLAUDE, CommentField, E, ExpertReel, fmt, INK, k, lerp, Mark, MINT, MINT_INK, MONO, ORANGE, Pic, Pill, RED, rise, SANS, Shot, springAt, SUB, T, Tick,
  Tile, Title, typed, ZW, ZX,
  type Cue, type RawWord, type Scn, type SceneP,
} from '../bExpert';

// Unlazy («Claude пишет «готово», а проверки не пройдены»), перемонтаж 10.10.2026 в стиле B ЭКСПЕРТ. Карта: patterns/reels/expert2-unlazy/DIRECTION.md.
// Запись вертикальная 1080×1920: нижняя половина кадра (1440×1280), окно записи от 22% высоты, голова целиком. Доска сверху 1280 px,
// графика в y 250–1080, субтитры на шве (центр y 1175). Официального видео работы Unlazy в материалах нет: алгоритм показан схемой,
// настоящие только карточка репозитория и факты из речи.
export const FPS = 60;
export const FRAMES = Math.floor(META.dur * FPS);
const RAW = WORDS as RawWord[];
const W = (i: number) => RAW[i].t0;
const A = (p: string) => `rm/r39/${p}`;
// Запись спикера (вертикальная 1080×1920, голос берётся из неё же) положить в public/work/<slug>/ и вписать путь в src; null: заглушка и тишина.
const REC = {src: null as string | null, w: 1080, h: 1920, faceTop: 0.22}; // src: 'work/<slug>/rec.mp4'

const CAPS = capWords(RAW, [
  ['cloud code', 'Claude Code'], ['семи', '7'], ['два пропущенных', '2 пропущенных'], ['три забытых', '3 забытых'], ['все установят', 'всё установят'], ['ее', 'её'],
]);

const AT = {
  work: W(14) - 0.2, forgot: W(34) - 0.2, audit: W(44) - 0.2, dev: W(55) - 0.2, checks: W(64) - 0.2, steps: W(76) - 0.2, list: W(82) - 0.2, compat: W(95) - 0.2, cta: W(101) - 0.2,
};
const LEVELS = 7;

// === 0. Хук, 0–6,7: огромное «Подтвердились» с кадра 0; Anthropic признала, что усилие Claude Code снижено ===
const S0: React.FC<SceneP> = ({t, g}) => {
  const lvl = Math.round(lerp(6, 3, k(t, W(6) - 0.1, W(7) + 0.3, E.inOut)));
  const ratio = lerp(0.85, 0.33, k(t, W(6) - 0.1, W(7) + 0.3, E.inOut));
  return (
    <>
      <Title t={t} at={-0.5} lines={['Подтвердились']} size={170} y={g.ty - 10} step={0.12} />
      <Pill p={springAt(t, W(1) - 0.1)} x={ZX} y={470} label="Anthropic" size={52} icon={<Mark src="brand/anthropic.svg" size={52} color={CLAUDE} />} />
      <Pill p={springAt(t, W(2) - 0.1)} x={ZX + 460} y={470} label="больше месяца" size={52} bg="#FFFFFF" />
      <Card x={ZX} y={600} w={ZW} h={340} p={springAt(t, 0.35)}>
        <div style={{position: 'absolute', left: 36, top: 28}}><Tile size={96}><Mark src="brand/claude.svg" size={60} color={CLAUDE} /></Tile></div>
        <T x={160} y={46} size={56}>Claude Code</T>
        <T x={1104 - 400} y={58} size={34} mono weight={700} color={SUB} w={400} align="right">усилие по умолчанию</T>
        <div style={{position: 'absolute', left: 36, top: 170, width: 1068, height: 18, borderRadius: 9, background: '#E3E5E8'}}>
          <div style={{width: `${ratio * 100}%`, height: '100%', borderRadius: 9, background: ORANGE}} />
          <div style={{position: 'absolute', left: `calc(${ratio * 100}% - 30px)`, top: -21, width: 60, height: 60, borderRadius: 30, background: '#FFFFFF', boxShadow: '0 0 0 3px rgba(17,19,22,.15), 0 8px 16px rgba(17,19,22,.25)'}} />
        </div>
        <div style={{position: 'absolute', left: 36, top: 240, width: 1068, display: 'flex', gap: 12}}>
          {Array.from({length: LEVELS}, (_, i) => {
            const p = k(t, 0.5 + i * 0.1, 0.8 + i * 0.1, E.pop);
            return <div key={i} style={{flex: 1, height: 64, borderRadius: 14, background: i < lvl ? INK : '#E3E5E8', opacity: Math.min(1, p * 2), transform: `translateY(${(1 - p) * 20}px)`}} />;
          })}
        </div>
      </Card>
      <Pill p={springAt(t, W(11) - 0.1)} x={ZX} y={975} label="сама признала" size={52} bg={MINT} ink={MINT_INK} icon={<CheckIco size={52} />} />
    </>
  );
};

// === 1. Полчаса работает → пишет «Готово», а пропущено 2 шага и 3 детали, 6,7 ===
const S1: React.FC<SceneP> = ({t, g}) => {
  const at = AT.work, claim = t >= W(21);
  const mm = Math.round(30 * k(t, W(18) - 0.2, W(19) + 0.5, E.out));
  const timer = 1 - k(t, 9.3, 9.6);
  const rows: [string, number, boolean][] = [['Шаг 1 не сделан', 10.56, true], ['Шаг 2 не сделан', 10.95, true], ['Деталь 1 забыта', 12.04, false], ['Деталь 2 забыта', 12.3, false], ['Деталь 3 забыта', 12.56, false]];
  return (
    <>
      <Title t={t} at={at + 0.2} lines={['Полчаса работает']} size={130} y={g.ty} hideAt={W(21) - 0.35} />
      <Title t={t} at={W(21) - 0.3} lines={['Пишет «Готово»']} size={130} y={g.ty} />
      <Card x={ZX} y={450} w={ZW} h={620} p={springAt(t, at + 0.3)}>
        <div style={{position: 'absolute', left: 36, top: 28}}><Tile size={96}><Mark src="brand/claude.svg" size={60} color={CLAUDE} /></Tile></div>
        <T x={160} y={46} size={56}>Claude Code</T>
        <Pill p={claim ? springAt(t, W(21)) : springAt(t, at + 0.5)} x={1104} y={34} align="right" label={claim ? 'Готово' : 'работает…'} size={46} bg={claim ? MINT : '#F1F2F4'} ink={claim ? MINT_INK : SUB}
          icon={claim ? <CheckIco size={46} /> : undefined} />
        <T x={50} y={200} size={190} op={timer} style={{fontVariantNumeric: 'tabular-nums'}}>{String(mm).padStart(2, '0')}:00</T>
        {rows.map(([label, a, step], i) => {
          const p = k(t, a, a + 0.3);
          return (
            <div key={label} style={{position: 'absolute', left: 36, top: 160 + i * 70, width: 1068, height: 62, borderRadius: 16, background: step ? '#FFEFEF' : '#FFF4E6', display: 'flex', alignItems: 'center', gap: 22, padding: '0 22px',
              boxSizing: 'border-box', opacity: p, transform: `translateX(${(1 - p) * -40}px)`, fontFamily: SANS, fontWeight: 700, fontSize: 40, color: INK, whiteSpace: 'nowrap'}}>
              {step
                ? <svg width={40} height={40} viewBox="0 0 40 40" style={{flex: 'none'}}><rect x={3} y={3} width={34} height={34} rx={9} fill="none" stroke={RED} strokeWidth={4} /><path d="M12 20 H28" stroke={RED} strokeWidth={4.5} strokeLinecap="round" /></svg>
                : <span style={{width: 40, height: 40, flex: 'none', borderRadius: 20, background: ORANGE, color: '#FFFFFF', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 28}}>!</span>}
              {label}
            </div>
          );
        })}
        <Pill p={springAt(t, W(32) - 0.05)} x={570} y={518} align="center" label="не показалось" size={50} bg={INK} ink="#FFFFFF" />
      </Card>
    </>
  );
};

// === 2. «Отличное замечание, я про это забыл», 13,72 ===
const REPLY = '«Отличное замечание, я про это забыл»';
const S2: React.FC<SceneP> = ({t, g}) => {
  const at = AT.forgot;
  const user = springAt(t, W(34) - 0.05), agent = springAt(t, W(36)), flag = springAt(t, 17.2);
  return (
    <>
      <Title t={t} at={at + 0.25} lines={['«Я про это забыл»']} size={130} y={g.ty} />
      <div style={{position: 'absolute', left: ZX + ZW - 720, top: 450, width: 720, height: 110, borderRadius: '36px 36px 10px 36px', background: ORANGE, display: 'flex', alignItems: 'center', padding: '0 36px', boxSizing: 'border-box',
        boxShadow: '0 20px 40px rgba(255,122,47,.3)', fontFamily: SANS, fontWeight: 700, fontSize: 48, color: '#FFFFFF', whiteSpace: 'nowrap', ...rise(user, 40)}}>Здесь пропущен шаг</div>
      <Card x={ZX} y={590} w={ZW} h={340} p={agent}>
        <div style={{position: 'absolute', left: 36, top: 28}}><Tile size={90}><Mark src="brand/claude.svg" size={56} color={CLAUDE} /></Tile></div>
        <T x={150} y={46} size={50}>Claude</T>
        <div style={{position: 'absolute', left: 36, top: 140, width: 1068, fontFamily: SANS, fontWeight: 700, fontSize: 60, lineHeight: 1.15, letterSpacing: '-0.02em', color: INK}}>
          {typed(REPLY, t, W(38), W(43) + 0.3)}<span style={{color: ORANGE, opacity: t < 17.6 ? Math.floor(t * 3) % 2 : 0}}>|</span>
        </div>
      </Card>
      <Pill p={flag} x={ZX} y={965} label="шаг не выполнен" size={52} bg="#FFE3E3" ink="#B01E1E"
        icon={<svg width={52} height={52} viewBox="0 0 40 40" style={{flex: 'none'}}><rect x={3} y={3} width={34} height={34} rx={9} fill="none" stroke={RED} strokeWidth={4} /><path d="M12 20 H28" stroke={RED} strokeWidth={4.5} strokeLinecap="round" /></svg>} />
    </>
  );
};

// === 3. Аудит AMD: почти 7 000 сессий, та же лень, 17,64 ===
const S3: React.FC<SceneP> = ({t, g}) => {
  const at = AT.audit;
  const n = 7000 * k(t, W(46), W(49) + 0.3, E.out);
  const hot = k(t, W(51), W(51) + 0.4);
  return (
    <>
      <Title t={t} at={at + 0.25} lines={['Аудит AMD']} size={150} y={g.ty} />
      <T x={ZX} y={450} size={220} style={{fontVariantNumeric: 'tabular-nums'}} op={k(t, W(46) - 0.2, W(46) + 0.1)}>≈ {fmt(n)}</T>
      <T x={ZX + 870} y={575} size={64} weight={700} color={SUB} op={k(t, W(50) - 0.2, W(50) + 0.2)}>сессий</T>
      <div style={{position: 'absolute', left: ZX + (ZW - 826) / 2, top: 740}}>
        {Array.from({length: 36}, (_, i) => {
          const c = i % 12, r = Math.floor(i / 12), p = k(t, at + 0.5 + c * 0.04 + r * 0.12, at + 0.95 + c * 0.04 + r * 0.12, E.pop), isHot = i % 7 === 0;
          return <div key={i} style={{position: 'absolute', left: c * 70, top: r * 70, width: 56, height: 56, borderRadius: 14, background: isHot && hot > 0.5 ? ORANGE : '#D6DAE0', opacity: Math.min(1, p * 2), transform: `translateY(${(1 - p) * 30}px)`}} />;
        })}
      </div>
      <Pill p={springAt(t, W(53))} x={ZX} y={980} label="та же лень" size={46} bg={ORANGE} ink="#FFFFFF" />
    </>
  );
};

// === 4. Разработчик сделал скилл → Unlazy, настоящая карточка репозитория, 22,24 ===
const S4: React.FC<SceneP> = ({t, g}) => {
  const at = AT.dev, sw = W(62) - 0.15;
  return (
    <>
      <Title t={t} at={at + 0.25} lines={['Скилл от разработчика']} size={112} y={g.ty} hideAt={sw} />
      <Title t={t} at={sw + 0.05} lines={['Unlazy']} size={170} y={g.ty - 10} />
      <Card x={ZX} y={470} w={ZW} h={340} p={springAt(t, W(56) - 0.1) * (1 - k(t, sw, sw + 0.25))} dy={50}>
        <div style={{position: 'absolute', left: 40, top: 40}}><Tile size={120} bg="#F1F2F4"><Mark src="brand/github.svg" size={80} color={INK} /></Tile></div>
        <T x={190} y={44} size={64}>Leonxlnx</T>
        <Pill p={springAt(t, W(57))} x={190} y={160} label="SKILL.md" size={44} bg="#F1F2F4" />
        <Pill p={springAt(t, W(61) - 0.15)} x={1104} y={200} align="right" label="лечит лень" size={50} bg={MINT} ink={MINT_INK} icon={<CheckIco size={50} />} />
      </Card>
      <Shot t={t} at={sw + 0.1} x={ZX} y={470} w={ZW} h={610} src={A('repo.png')} iw={1200} ih={600} url="github.com/Leonxlnx/unlazy" from={[0.5, 0]} to={[0.5, 0.2]} pa={sw + 0.8} pb={sw + 1.6} />
    </>
  );
};

// === 5. До начала работы агент записывает проверки, 26,46 ===
const S5: React.FC<SceneP> = ({t, g}) => {
  const at = AT.checks;
  const rows: [string, string, number][] = [['Результат', 'что должно получиться', W(66) - 0.1], ['Критерии', 'как это проверить', W(68) - 0.1], ['Проверки', 'что должно пройти', W(69) + 0.15]];
  return (
    <>
      <Title t={t} at={at + 0.25} lines={['Сначала проверки']} size={130} y={g.ty} />
      {rows.map(([title, hint, a], i) => (
        <Card key={title} x={ZX} y={450 + i * 166} w={ZW} h={150} p={springAt(t, a)} r={24}>
          <div style={{position: 'absolute', left: 36, top: 43}}><Tick size={64} on={0} /></div>
          <T x={140} y={26} size={60}>{title}</T>
          <T x={140} y={96} size={34} mono weight={700} color={SUB}>{hint}</T>
          <T x={1104 - 120} y={50} size={44} mono weight={700} color={ORANGE} w={120} align="right">0{i + 1}</T>
        </Card>
      ))}
      <Pill p={springAt(t, W(74) - 0.1)} x={ZX} y={965} label="так выглядит «готово»" size={52} bg={MINT} ink={MINT_INK} icon={<CheckIco size={52} />} />
    </>
  );
};

// === 6. Потом дробит задачу на маленькие шаги, 31,18 ===
const S6: React.FC<SceneP> = ({t, g}) => {
  const at = AT.steps;
  return (
    <>
      <Title t={t} at={at + 0.25} lines={['На маленькие шаги']} size={130} y={g.ty} />
      <Card x={720 - 260} y={450} w={520} h={110} p={springAt(t, at + 0.35)} r={24}>
        <T x={0} y={22} size={62} w={520} align="center">Задача</T>
      </Card>
      {[0, 1, 2].map((i) => <Draw key={i} t={t} a={W(78) - 0.35 + i * 0.1} b={W(78) + 0.2 + i * 0.1} d={`M720 560 V605 H${330 + i * 390} V650`} color={MINT} width={7} w={1440} h={1280} />)}
      {[0, 1, 2].map((i) => {
        const p = springAt(t, W(78) + 0.1 + i * 0.28);
        return (
          <Card key={i} x={ZX + i * 390} y={650} w={360} h={330} p={p} r={24}>
            <T x={0} y={26} size={38} mono weight={700} color={ORANGE} w={360} align="center">ШАГ 0{i + 1}</T>
            {[0, 1, 2].map((j) => {
              const q = k(t, W(80) + 0.25 + i * 0.25 + j * 0.12, W(80) + 0.6 + i * 0.25 + j * 0.12);
              return (
                <div key={j} style={{position: 'absolute', left: 36, top: 100 + j * 70, display: 'flex', alignItems: 'center', gap: 16, opacity: q, transform: `translateX(${(1 - q) * 20}px)`}}>
                  <Tick size={44} on={0} /><div style={{width: 200 - j * 30, height: 12, borderRadius: 6, background: '#D6DAE0'}} />
                </div>
              );
            })}
          </Card>
        );
      })}
    </>
  );
};

// === 7. У каждого свой чек-лист, «готово» только когда все проверки пройдены, 33,64 ===
const S7: React.FC<SceneP> = ({t, g}) => {
  const at = AT.list;
  const ticks = [[36.3, 36.6, 36.9], [37.3, 37.6, 37.9], [38.3, 38.55, 38.8]];
  const done = ticks.flat().filter((a) => t > a).length;
  return (
    <>
      <Title t={t} at={at + 0.25} lines={['У каждого шага', 'свой чек-лист']} size={110} y={g.ty} />
      {ticks.map((row, i) => {
        const p = springAt(t, W(83) - 0.05 + i * 0.2), cnt = row.filter((a) => t > a).length;
        return (
          <Card key={i} x={ZX} y={570 + i * 124} w={ZW} h={110} p={p} r={24}>
            <T x={40} y={28} size={52}>Шаг {i + 1}</T>
            {row.map((a, j) => <div key={j} style={{position: 'absolute', left: 330 + j * 120, top: 25}}><Tick size={60} on={k(t, a, a + 0.3)} /></div>)}
            <T x={ZW - 180} y={30} size={48} mono weight={700} color={cnt === 3 ? '#0F8F72' : SUB} w={140} align="right">{cnt}/3</T>
          </Card>
        );
      })}
      <div style={{position: 'absolute', left: ZX, top: 950, width: ZW, height: 16, borderRadius: 8, background: '#D6DAE0', opacity: k(t, at + 0.8, at + 1.2)}}>
        <div style={{width: `${(done / 9) * 100}%`, height: '100%', borderRadius: 8, background: MINT}} />
      </div>
      <Pill p={springAt(t, W(94))} x={720} y={985} align="center" label="Готово" size={52} bg={MINT} ink={MINT_INK} icon={<CheckIco size={52} />} />
    </>
  );
};

// === 8. Работает в Claude Code и Codex, 39,64 ===
const S8: React.FC<SceneP> = ({t, g}) => {
  const at = AT.compat;
  const a = springAt(t, W(97) - 0.1), b = springAt(t, W(100) - 0.15);
  return (
    <>
      <Title t={t} at={at + 0.25} lines={['Claude Code и Codex']} size={130} y={g.ty} />
      <div style={{position: 'absolute', left: 720 - 330, top: 520, ...rise(a, 70)}}><Tile size={300}><Mark src="brand/claude.svg" size={190} color={CLAUDE} /></Tile></div>
      <div style={{position: 'absolute', left: 720 + 30, top: 520, ...rise(b, 70)}}><Tile size={300}><Mark src="brand/openai.svg" size={180} color={INK} /></Tile></div>
      <T x={720 - 330} y={850} size={50} w={300} align="center" op={Math.min(1, a * 2)}>Claude Code</T>
      <T x={720 + 30} y={850} size={50} w={300} align="center" op={Math.min(1, b * 2)}>Codex</T>
    </>
  );
};

// === 9. Призыв: «лень» → ссылка → Claude или Codex всё установят, 41,14 ===
const S9: React.FC<SceneP> = ({t, g}) => {
  const at = AT.cta;
  const a = springAt(t, W(107) - 0.2), b = springAt(t, W(109) - 0.1), c = springAt(t, W(111) - 0.1);
  return (
    <>
      <Title t={t} at={at + 0.25} lines={['Напиши «лень»', 'в комментариях']} size={112} y={g.ty} />
      <CommentField t={t} at={at + 0.4} x={ZX} y={570} w={ZW} h={150} word="лень" ta={W(102)} tb={W(102) + 0.4} send={W(104) + 0.15} />
      <Card x={ZX} y={745} w={ZW} h={140} p={springAt(t, W(106) - 0.2)} r={28}>
        <svg width={64} height={64} viewBox="0 0 24 24" fill="none" stroke={ORANGE} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{position: 'absolute', left: 40, top: 38}}><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" /><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" /></svg>
        <T x={140} y={38} size={58}>Ссылка на Unlazy</T>
      </Card>
      <Card x={ZX} y={905} w={ZW} h={165} p={a} r={28}>
        <div style={{position: 'absolute', left: 40, top: 32, ...rise(b, 30)}}><Tile size={100}><Mark src="brand/claude.svg" size={62} color={CLAUDE} /></Tile></div>
        <div style={{position: 'absolute', left: 170, top: 32, ...rise(c, 30)}}><Tile size={100}><Mark src="brand/openai.svg" size={60} color={INK} /></Tile></div>
        <T x={320} y={52} size={56}>сами установят</T>
        <div style={{position: 'absolute', right: 40, top: 40}}><Pill p={springAt(t, W(115))} x={0} y={0} align="right" label="Готово" size={44} bg={MINT} ink={MINT_INK} icon={<CheckIco size={44} />} /></div>
      </Card>
    </>
  );
};

const SCENES: Scn[] = [
  {at: 0, label: '00 / ПОДТВЕРДИЛИСЬ', C: S0},
  {at: AT.work, label: '01 / ГОТОВО', C: S1},
  {at: AT.forgot, label: '02 / ЗАБЫЛ', C: S2},
  {at: AT.audit, label: '03 / АУДИТ', C: S3},
  {at: AT.dev, label: '04 / СКИЛЛ', C: S4},
  {at: AT.checks, label: '05 / ПРОВЕРКИ', C: S5},
  {at: AT.steps, label: '06 / ШАГИ', C: S6},
  {at: AT.list, label: '07 / ЧЕК-ЛИСТ', C: S7},
  {at: AT.compat, label: '08 / СРЕДЫ', C: S8},
  {at: AT.cta, label: '09 / ПРИЗЫВ', C: S9},
];

const CUES: Cue[] = [
  [0.1, 'ui-pop', 0.18], [W(1) - 0.1, 'ui-pop', 0.18], [W(2) - 0.1, 'ui-pop', 0.18], [W(6), 'ui-slide', 0.24], [W(11) - 0.1, 'ui-glass', 0.22],
  [W(18), 'counter', 0.18], [W(21), 'ui-glass', 0.22], [10.56, 'ui-tap', 0.2], [10.95, 'ui-tap', 0.2], [12.04, 'ui-tap', 0.2], [12.3, 'ui-tap', 0.2], [12.56, 'ui-tap', 0.2], [W(32) - 0.05, 'snap', 0.24],
  [W(34) - 0.05, 'ui-pop', 0.18], [W(36), 'ui-pop', 0.18], [W(38), 'typing', 0.16], [17.2, 'ui-glass', 0.22],
  [W(46), 'counter', 0.18], [W(51), 'ui-tap', 0.2], [W(53), 'ui-pop', 0.18],
  [W(56) - 0.1, 'ui-pop', 0.18], [W(61) - 0.15, 'ui-glass', 0.22], [W(62) - 0.1, 'ui-slide', 0.24],
  [W(66) - 0.1, 'ui-tap', 0.2], [W(68) - 0.1, 'ui-tap', 0.2], [W(69) + 0.15, 'ui-tap', 0.2], [W(74) - 0.1, 'ui-glass', 0.22],
  [W(78) + 0.1, 'ui-pop', 0.18], [W(78) + 0.38, 'ui-pop', 0.18], [W(78) + 0.66, 'ui-pop', 0.18],
  [36.3, 'ui-tap', 0.2], [36.9, 'ui-tap', 0.2], [37.6, 'ui-tap', 0.2], [38.3, 'ui-tap', 0.2], [38.8, 'ui-tap', 0.2], [W(94), 'ui-glass', 0.22],
  [W(97) - 0.1, 'ui-pop', 0.18], [W(100) - 0.15, 'ui-pop', 0.18],
  [W(102), 'typing', 0.16], [W(104) + 0.15, 'ui-glass', 0.22], [W(106) - 0.2, 'ui-pop', 0.18], [W(109) - 0.1, 'ui-pop', 0.18], [W(111) - 0.1, 'ui-pop', 0.18], [W(115), 'ui-glass', 0.22],
];

export const ReelRMr39: React.FC = () => <ExpertReel rec={REC} dur={META.dur} scenes={SCENES} words={CAPS} cues={CUES} />;
