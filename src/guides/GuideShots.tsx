import React from 'react';
import {AbsoluteFill} from 'remotion';
import {CD, ClaudeDesktop, ClaudeDesktopProps} from './claudeDesktop';

// Картинки для docs/guides/claude-desktop-sessions.md: фрагменты окна Claude Desktop (вектор claudeDesktop.tsx) с оранжевыми
// номерами шагов и стрелками. Статичные кадры 1600×1100 на белом фоне, подпись шага крупно сверху. Окно кадрируется по
// месту действия: `place` ставит прямоугольник окна на холст с масштабом s, `X`/`Y` переводят координаты окна в холст.
// Только кнопки, которые есть в приложении; названия нейтральные (папка «Мой контент-завод», пользователь Anna).
export const GUIDE_W = 1600, GUIDE_H = 1100;
const ORANGE = '#FF7A2F', ORANGE_HI = '#FF9A5C', INK = '#1B1B1A', GREY = '#6A6965', FONT = 'SF Pro Display';
const FOLDER = 'Мой контент-завод';
const R_BADGE = 30;

type Rect = [number, number, number, number];
type Place = {rect: Rect; s: number; left: number; top: number; w: number; h: number; X: (x: number) => number; Y: (y: number) => number; box: (r: Rect) => Rect};
// rect окна (x, y, ширина, высота) → холст: масштаб s, верхний край top, по горизонтали по центру (или left)
const place = (rect: Rect, s: number, top: number, left?: number): Place => {
  const w = rect[2] * s, h = rect[3] * s, l = left ?? Math.round((GUIDE_W - w) / 2);
  const X = (x: number) => l + (x - rect[0]) * s, Y = (y: number) => top + (y - rect[1]) * s;
  return {rect, s, left: l, top, w, h, X, Y, box: (r) => [X(r[0]), Y(r[1]), r[2] * s, r[3] * s]};
};

const Frag: React.FC<{p: Place; ui: ClaudeDesktopProps}> = ({p, ui}) => (
  <div style={{position: 'absolute', left: p.left, top: p.top, width: p.w, height: p.h, overflow: 'hidden', borderRadius: 20, background: CD.bg,
    boxShadow: '0 0 0 2px #DAD9D4, 0 22px 56px rgba(40,30,18,.16)'}}>
    <div style={{position: 'absolute', left: -p.rect[0] * p.s, top: -p.rect[1] * p.s, width: CD.W, height: CD.H, transform: `scale(${p.s})`, transformOrigin: '0 0'}}>
      <ClaudeDesktop radius={0} shadow={false} {...ui} />
    </div>
  </div>
);

// --- Разметка: кольцо вокруг места нажатия, номер, стрелка и подпись ---
type Step = {n: number; label: string; ring: Rect; badge: [number, number]; side?: 'r' | 'l'; pad?: number};
const arrowGeom = (b: [number, number], ring: Rect, pad: number) => {
  const x0 = ring[0] - pad, y0 = ring[1] - pad, x1 = ring[0] + ring[2] + pad, y1 = ring[1] + ring[3] + pad;
  const tx = Math.min(Math.max(b[0], x0), x1), ty = Math.min(Math.max(b[1], y0), y1);
  const dx = tx - b[0], dy = ty - b[1], len = Math.hypot(dx, dy);
  if (len < R_BADGE + 24) return null;
  const ux = dx / len, uy = dy / len;
  const sx = b[0] + ux * (R_BADGE + 8), sy = b[1] + uy * (R_BADGE + 8);
  const ex = tx - ux * 5, ey = ty - uy * 5;
  const l2 = Math.hypot(ex - sx, ey - sy), bend = l2 * 0.12;
  const cx = (sx + ex) / 2 - uy * bend, cy = (sy + ey) / 2 + ux * bend;
  const tl = Math.hypot(ex - cx, ey - cy) || 1, tux = (ex - cx) / tl, tuy = (ey - cy) / tl;
  const bx = ex - tux * 30, by = ey - tuy * 30;               // основание наконечника
  const hw = 15, px = -tuy, py = tux;
  return {path: `M${sx},${sy} Q${cx},${cy} ${bx},${by}`, head: `${ex},${ey} ${bx + px * hw},${by + py * hw} ${bx - px * hw},${by - py * hw}`};
};
const Marks: React.FC<{steps: Step[]}> = ({steps}) => (
  <>
    {steps.map((st) => {
      const pad = st.pad ?? 8;
      const [rx, ry, rw, rh] = st.ring;
      return (
        <div key={`r${st.n}`} style={{position: 'absolute', left: rx - pad, top: ry - pad, width: rw + pad * 2, height: rh + pad * 2, borderRadius: 16, boxSizing: 'border-box',
          border: `6px solid ${ORANGE}`, background: 'rgba(255,122,47,.10)', boxShadow: '0 0 0 6px rgba(255,122,47,.18)'}} />
      );
    })}
    <svg width={GUIDE_W} height={GUIDE_H} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
      {steps.map((st) => {
        const g = arrowGeom(st.badge, st.ring, st.pad ?? 8);
        return g ? (
          <g key={`a${st.n}`}>
            <path d={g.path} fill="none" stroke={ORANGE} strokeWidth={8} strokeLinecap="round" />
            <polygon points={g.head} fill={ORANGE} stroke={ORANGE} strokeWidth={3} strokeLinejoin="round" />
          </g>
        ) : null;
      })}
    </svg>
    {steps.map((st) => {
      const [bx, by] = st.badge, left = (st.side ?? 'r') === 'r';
      return (
        <React.Fragment key={`b${st.n}`}>
          <div style={{position: 'absolute', left: bx - R_BADGE, top: by - R_BADGE, width: R_BADGE * 2, height: R_BADGE * 2, borderRadius: '50%',
            background: `linear-gradient(160deg, ${ORANGE_HI}, ${ORANGE})`, color: INK, fontFamily: FONT, fontWeight: 800, fontSize: 38, display: 'grid', placeItems: 'center',
            boxShadow: '0 0 0 4px #FFFFFF, 0 8px 20px rgba(160,70,10,.35)'}}>{st.n}</div>
          <div style={{position: 'absolute', top: by, transform: 'translateY(-50%)', ...(left ? {left: bx + R_BADGE + 14} : {right: GUIDE_W - (bx - R_BADGE - 14)}),
            background: INK, color: '#FFFFFF', fontFamily: FONT, fontWeight: 600, fontSize: 34, lineHeight: 1, padding: '15px 26px', borderRadius: 18, whiteSpace: 'nowrap',
            boxShadow: '0 10px 26px rgba(20,14,8,.22)'}}>{st.label}</div>
        </React.Fragment>
      );
    })}
  </>
);

const Tag: React.FC<{x: number; y: number; text: string; hot?: boolean}> = ({x, y, text, hot}) => (
  <div style={{position: 'absolute', left: x, top: y, padding: '8px 22px', borderRadius: 999, fontFamily: FONT, fontWeight: 600, fontSize: 28, lineHeight: 1,
    background: hot ? ORANGE : '#ECEBE7', color: hot ? INK : '#55534E'}}>{text}</div>
);

const Shot: React.FC<{n: number; title: string; sub: string; children: React.ReactNode}> = ({n, title, sub, children}) => (
  <AbsoluteFill style={{background: '#FFFFFF', width: GUIDE_W, height: GUIDE_H}}>
    <div style={{position: 'absolute', left: 80, top: 46, height: 52, padding: '0 26px', borderRadius: 26, background: ORANGE, color: INK, fontFamily: FONT, fontWeight: 700,
      fontSize: 28, display: 'flex', alignItems: 'center', letterSpacing: '0.02em'}}>ШАГ {n}</div>
    <div style={{position: 'absolute', left: 80, top: 112, width: 1440, fontFamily: FONT, fontWeight: 700, fontSize: 64, lineHeight: 1.1, color: INK, letterSpacing: '-0.01em',
      whiteSpace: 'nowrap'}}>{title}</div>
    <div style={{position: 'absolute', left: 80, top: 198, width: 1440, fontFamily: FONT, fontWeight: 400, fontSize: 31, lineHeight: 1.2, color: GREY, whiteSpace: 'nowrap'}}>{sub}</div>
    {children}
  </AbsoluteFill>
);

// --- 1. Вкладка Code и кнопка New ---
export const Guide01: React.FC = () => {
  const p = place([0, 0, 760, 430], 1.75, 300);
  return (
    <Shot n={1} title="Вкладка Code, кнопка New" sub="Слева вверху переключатель Chat и Code, под ним кнопка New.">
      <Frag p={p} ui={{side: {active: 'new'}, user: 'Anna', plan: 'Pro'}} />
      <Marks steps={[
        {n: 1, label: 'Вкладка Code', ring: p.box([169, 7, 68, 24]), badge: [700, 333]},
        {n: 2, label: 'New: новый чат', ring: p.box([9, 44.5, 226, 25]), badge: [700, 560]},
      ]} />
    </Shot>
  );
};

// --- 2. Меню папки: выбрать ту же папку ---
export const Guide02: React.FC = () => {
  const p = place([330, 640, 800, 260], 1.8, 296);
  const recent = [FOLDER, 'Другой проект', 'Документы', 'Загрузки'];
  return (
    <Shot n={2} title="Выбери папку проекта" sub="Для каждого чата берём одну и ту же папку из списка Recent.">
      <Frag p={p} ui={{folder: 'Другой проект', menu: {p: 1, hover: FOLDER, recent}}} />
      <Marks steps={[
        {n: 1, label: 'Нажми на папку', ring: p.box([432, 869, 126, 24]), badge: [360, 890], pad: 7},
        {n: 2, label: 'Выбери свою папку', ring: p.box([435, 730.5, 194, 23]), badge: [900, 480], pad: 6},
        {n: 3, label: 'Нет в списке: Open folder…', ring: p.box([435, 835.5, 194, 23]), badge: [900, 668], pad: 6},
      ]} />
    </Shot>
  );
};

// --- 3. Галочка worktree снята ---
export const Guide03: React.FC = () => {
  const rect: Rect = [352, 860, 430, 42];
  const a = place(rect, 3, 350), b = place(rect, 3, 660);
  return (
    <Shot n={3} title="Сними галочку worktree" sub="Тогда все три чата работают в одной папке и видят одни и те же файлы.">
      <Tag x={a.left} y={a.top - 56} text="Так выглядит по умолчанию" />
      <Frag p={a} ui={{folder: FOLDER, worktree: true}} />
      <Tag x={b.left} y={b.top - 56} text="Так должно быть" hot />
      <Frag p={b} ui={{folder: FOLDER, worktree: false}} />
      <Marks steps={[{n: 1, label: 'Сними галочку worktree', ring: b.box([656, 870, 80, 22]), badge: [1190, 900], side: 'l'}]} />
    </Shot>
  );
};

// --- 4. Первое сообщение роли ---
// Те же три строки лежат в team/prompts/scriptolog.md
export const FIRST_MESSAGE = 'Ты Скриптолог этой папки.\nПрочитай .claude/skills/onai-scriptolog/SKILL.md и начни с раздела 1.\nПрофиль: work/_profile/brief.md и refs.md, не переспрашивай.';
export const Guide04: React.FC = () => {
  const p = place([340, 820, 800, 128], 1.8, 330);
  return (
    <Shot n={4} title="Вставь первое сообщение" sub="Оно задаёт роль чата. Текст для каждой роли лежит в папке team/prompts.">
      <Frag p={p} ui={{folder: FOLDER, worktree: false, input: {text: FIRST_MESSAGE, caret: true, focus: true, sendHot: true, height: 82}}} />
      <Marks steps={[
        {n: 1, label: 'Вставь первое сообщение', ring: p.box([359, 861, 769, 82]), badge: [480, 700], pad: 6},
        {n: 2, label: 'Нажми Enter', ring: p.box([1093, 909, 28, 28]), badge: [1290, 840], side: 'l', pad: 6},
      ]} />
    </Shot>
  );
};

// --- 5. Три чата в одной папке ---
export const Guide05: React.FC = () => {
  const p = place([0, 190, 330, 200], 2.6, 330, 80);
  const rows = ['Монтажёр', 'Скриптолог', 'Instagram-автоматизатор'];
  return (
    <Shot n={5} title="Три чата в одной папке" sub="Скриптолог, Монтажёр и Instagram-автоматизатор лежат в списке слева.">
      <Frag p={p} ui={{side: {active: null, groups: [[FOLDER, rows]]}, user: 'Anna', plan: 'Pro'}} />
      <Marks steps={[
        {n: 1, label: 'Монтаж роликов', ring: p.box([9, 268.5, 226, 25]), badge: [1030, 566], pad: 4},
        {n: 2, label: 'Сценарии', ring: p.box([9, 296, 226, 25]), badge: [1030, 638], pad: 4},
        {n: 3, label: 'Ассистент и выкладка', ring: p.box([9, 323.5, 226, 25]), badge: [1030, 710], pad: 4},
      ]} />
    </Shot>
  );
};

// --- 6. Customize → Connectors → Add ---
export const Guide06: React.FC = () => {
  // кадр без обрезанного заголовка «Customize» сверху и без половины вкладки Plugins справа
  const a = place([0, 124, 452, 76], 3, 300), b = place([790, 138, 420, 55], 3, 770);
  const ui: ClaudeDesktopProps = {side: {active: 'customize'}, customize: {p: 1, tab: 1, cards: 1}, user: 'Anna', plan: 'Pro'};
  return (
    <Shot n={6} title="Подключи сервисы в Connectors" sub="Сервисы, которые нужны чату, подключаются здесь.">
      <Frag p={a} ui={ui} />
      <Frag p={b} ui={ui} />
      <Marks steps={[
        {n: 1, label: 'Открой Customize', ring: a.box([9, 150.5, 226, 25]), badge: [300, 660]},
        {n: 2, label: 'Вкладка Connectors', ring: a.box([346, 150, 100, 30]), badge: [1290, 660], side: 'l'},
        {n: 3, label: 'Add: свой коннектор', ring: b.box([1100, 149, 90, 32]), badge: [1235, 1010], side: 'l'},
      ]} />
    </Shot>
  );
};
