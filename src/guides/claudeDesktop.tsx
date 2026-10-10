import React from 'react';
import {Img, staticFile} from 'remotion';
import {At, Box, IcoAt, IP, Txt, uk} from './appui';

// Настоящий знак сервиса из public/brand, перекрашенный маской (у файлов нет своего цвета).
export const Mark: React.FC<{name: string; size: number; color?: string; style?: React.CSSProperties}> = ({name, size, color = '#111214', style}) => {
  const url = `url(${staticFile(`brand/${name}.svg`)})`;
  return <div style={{width: size, height: size, flex: 'none', background: color, WebkitMaskImage: url, maskImage: url, WebkitMaskSize: 'contain', maskSize: 'contain',
    WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskPosition: 'center', ...style}} />;
};

// Claude Desktop (Windows, режим Code) вектором: окно в своих координатах 1240×980, как на скриншоте приложения.
// Картинки для docs/guides/claude-desktop-sessions.md рисует GuideShots.tsx: кадрирует окно и ставит оранжевые номера шагов.
// Есть только кнопки, которые видны в приложении: панель, чипы и поле ввода, меню папки, окно выбора папки Windows,
// Customize → Connectors. Названия сессий, папок и имя пользователя нейтральные (в репозиторий не попадают чужие данные).
export const CD = {
  W: 1240, H: 980,
  bg: '#FCFCFB', side: '#FBFBF9', row: '#EDECE8', rowHot: '#F2F1EE', rowPress: '#E4E3DE', card: '#F0F0EF', border: '#C6C6C5', line: '#E2E2E1', chipLine: '#E3E3E2',
  ink: '#1F1F1E', ink2: '#3D3D3A', grey: '#73726C', ph: '#8B8B88', link: '#2D5BA8', accent: '#D97757', dark: '#2C2C2A', blue: '#347ED8', ok: '#CAEAC7', okInk: '#3C8D3C',
  font: 'SF Pro Display', serif: 'Georgia, "Times New Roman", serif', win: '"Segoe UI", "SF Pro Display", sans-serif',
  // точки для камеры и курсора (центры, координаты окна)
  pt: {
    chips: [541, 881], chipFolder: [485, 881], input: [744, 923], inputText: [380, 923], welcome: [500, 67], mid: [744, 520],
    menu: [532, 766], menuOpen: [486, 847], menuFolder: [478, 766],
    dialog: [702, 521], dialogNew: [395, 336], dialogList: [560, 430], dialogSelect: [1000, 762], dialogField: [700, 732],
    side: [122, 120], sideNew: [52, 57], sideRoutines: [66, 137], sideCustomize: [70, 163],
    tabs: [470, 165], tabConnectors: [396, 165], topConnectors: [362, 554], badge: [421, 554],
    cardDrive: [507, 637], cardGmail: [968, 637], cardCalendar: [507, 754],
    plusDrive: [705, 613], plusGmail: [1163, 613], plusCalendar: [705, 730],
  } as Record<string, [number, number]>,
};
const C = CD;
type TP = Omit<React.ComponentProps<typeof Txt>, 'f'> & {f?: string};
const T: React.FC<TP> = (p) => <Txt {...p} f={p.f ?? C.font} />;

// --- Верхняя строка: меню, панель, назад/вперёд, переключатель Chat | Code, What's new, кнопки окна ---
const TopBar: React.FC<{whatsNew?: boolean}> = ({whatsNew = true}) => (
  <>
    <IcoAt x={27} y={19} d={IP.menu} s={17} c="#3B3B39" />
    <IcoAt x={59} y={19} d={IP.panel} s={16} c="#3B3B39" />
    <IcoAt x={91} y={19} d={IP.back} s={16} c="#3B3B39" w={1.8} />
    <IcoAt x={121} y={19} d={IP.fwd} s={16} c="#B4B3AE" w={1.8} />
    <Box x={169} y={7} w={68} h={24} style={{borderRadius: 8, background: '#EFEFED'}}>
      <IcoAt x={17} y={12} d={IP.chat} s={15} c="#8B8B88" />
      <Box x={35} y={1} w={32} h={22} style={{borderRadius: 7, background: '#FFFFFF', boxShadow: '0 0 0 1px rgba(0,0,0,.05)'}}><IcoAt x={16} y={11} d={IP.code} s={15} c={C.ink} w={1.8} /></Box>
    </Box>
    {whatsNew ? <T x={1045} y={19} s={13.5} c={C.link} anchor="center">What's new</T> : null}
    <IcoAt x={1127} y={19} d={IP.min} s={13} c="#3B3B39" w={1.3} />
    <IcoAt x={1172} y={19} d={IP.max} s={12} c="#3B3B39" w={1.3} />
    <IcoAt x={1218} y={19} d={IP.close} s={13} c="#3B3B39" w={1.3} />
  </>
);

// --- Панель слева. По умолчанию, свежая установка (без закреплённых и папок): «пустое окно» из сценария ---
export type SideGroup = [string, string[]];
const Bullet: React.FC<{y: number}> = ({y}) => <div style={{position: 'absolute', left: 20, top: y - 3.5, width: 7, height: 7, borderRadius: 4, border: '1.3px solid #B9B8B3', boxSizing: 'border-box'}} />;
const Sidebar: React.FC<{active: 'new' | 'customize' | 'routines' | null; hot?: string | null; press?: number; pinned?: string[]; groups?: SideGroup[]; newGroup?: number;
  user?: string; plan?: string}> =
  ({active, hot, press = 0, pinned = [], groups = [], newGroup = 1, user = 'Anna', plan = 'Pro'}) => {
    const rows: [string, number, string, string][] = [['new', 57, IP.plus, 'New'], ['projects', 84, IP.tray, 'Projects'], ['artifacts', 110, IP.shapes, 'Artifacts'],
      ['routines', 137, IP.clock, 'Routines'], ['customize', 163, IP.briefcase, 'Customize']];
    let y = pinned.length ? 281 + pinned.length * 27.5 + 18 : 254;
    return (
      <>
        <Box x={0} y={0} w={245} h={C.H} style={{background: C.side, borderRight: `1px solid ${C.line}`}} />
        {rows.map(([k, ry, ico, label]) => {
          const on = active === k, h = hot === k;
          return (
            <React.Fragment key={k}>
              {on || h ? <Box x={9} y={ry - 12.5} w={226} h={25} style={{borderRadius: 7, background: h && press > 0 ? C.rowPress : on ? C.row : C.rowHot}} /> : null}
              {k === 'new' && !on ? <div style={{position: 'absolute', left: 15, top: ry - 8, width: 16, height: 16, borderRadius: 8, background: '#E6E5E1'}} /> : null}
              <IcoAt x={23} y={ry} d={ico} s={k === 'new' ? 13 : 15} c={on ? C.ink : '#5A5955'} w={k === 'new' ? 2 : 1.5} />
              <T x={39} y={ry} s={14.6} c={on || h ? C.ink : '#5A5955'}>{label}</T>
              {k === 'projects' ? <Box x={99} y={77} w={28} h={14} style={{borderRadius: 4, background: C.row}}><T x={14} y={7} s={10} c="#60625D" anchor="center" w={500}>Beta</T></Box> : null}
            </React.Fragment>
          );
        })}
        <T x={15} y={210} s={13.4} c={C.grey}>Routines</T><IcoAt x={75} y={210} d={IP.chevR} s={11} c={C.grey} />
        {pinned.length ? <T x={15} y={254} s={13.4} c={C.grey}>Pinned</T> : null}
        {pinned.map((p, i) => (
          <React.Fragment key={p}><Bullet y={281 + i * 27.5} /><T x={39} y={281 + i * 27.5} s={14.4} c="#3D3D3A">{p}</T></React.Fragment>
        ))}
        {groups.map(([g, items], gi) => {
          const gy = y; y += 26 + items.length * 27.5 + 12;
          const a = gi === groups.length - 1 ? newGroup : 1;
          return (
            <div key={g} style={{position: 'absolute', left: 0, top: 0, opacity: a, transform: `translateY(${(1 - a) * 10}px)`}}>
              <T x={15} y={gy} s={13.4} c={C.grey}>{g}</T>
              <IcoAt x={222} y={gy} d={IP.plus} s={13} c={C.grey} />
              {items.map((it, i) => (
                <React.Fragment key={it}><Bullet y={gy + 27 + i * 27.5} /><T x={39} y={gy + 27 + i * 27.5} s={14.4} c="#3D3D3A" style={{maxWidth: 196, overflow: 'hidden'}}>{it}</T></React.Fragment>
              ))}
            </div>
          );
        })}
        <div style={{position: 'absolute', left: 15, top: 947, width: 16, height: 16, borderRadius: 8, background: '#E8E6DF', display: 'grid', placeItems: 'center',
          fontFamily: C.font, fontSize: 9, fontWeight: 600, color: C.ink}}>{user.slice(0, 1)}</div>
        <T x={39} y={955} s={14} c={C.ink}>{user} <span style={{color: C.grey, fontSize: 11}}>· {plan}</span></T>
        <IcoAt x={157} y={955} d={IP.chev} s={12} c={C.grey} />
        <IcoAt x={224} y={955} d={IP.sparkle} s={13} c="#B4B3AE" />
      </>
    );
  };

// --- Чипы над полем, поле ввода, краб, строка под полем ---
const Crab: React.FC<{x: number; y: number; px?: number}> = ({x, y, px = 3.4}) => {
  const rows = ['.XXXXXX.', 'XXXXXXXX', 'XBXXXXBX', 'XXXXXXXX', '.X.X.X.X'];
  return (
    <svg width={8 * px + 18} height={5 * px + 2} style={{position: 'absolute', left: x - 18, top: y, overflow: 'visible'}}>
      <line x1={2} y1={4.2 * px} x2={18} y2={2.6 * px} stroke="#A9A9A6" strokeWidth={1.6} strokeLinecap="round" />
      {rows.flatMap((r, ri) => [...r].map((ch, ci) => ch === '.' ? null : <rect key={`${ri}-${ci}`} x={18 + ci * px} y={ri * px} width={px + 0.35} height={px + 0.35} fill={ch === 'B' ? '#2A1A14' : '#CE6E52'} />))}
    </svg>
  );
};
const Chip: React.FC<{x: number; w: number; children: React.ReactNode; on?: boolean; glow?: number; hot?: boolean; y?: number}> = ({x, w, children, on, glow = 0, hot, y = 869}) => (
  <Box x={x} y={y} w={w} h={24} style={{borderRadius: 6, border: `1px solid ${C.chipLine}`, background: on ? '#E6E6E5' : hot ? '#F1F1EF' : C.bg,
    boxShadow: glow > 0 ? `0 0 0 ${2.5 * glow}px rgba(217,119,87,${0.85 * glow}), 0 0 ${16 * glow}px rgba(217,119,87,${0.55 * glow})` : undefined}}>{children}</Box>
);
export const folderChipW = (folder: string) => Math.round(37 + folder.length * 6.85);
export type InputState = {text?: string; caret?: boolean; focus?: boolean; sendHot?: boolean; height?: number};
const InputArea: React.FC<{folder: string; folderOn?: boolean; folderHot?: boolean; folderGlow?: number; folderLabel?: React.ReactNode; input?: InputState; worktree?: boolean}> =
  ({folder, folderOn, folderHot, folderGlow = 0, folderLabel, input = {}, worktree = true}) => {
    const fw = folderChipW(folder), g = 432 + fw + 6, h = input.height ?? 40, cy = 869 - (h - 40);  // чипы поднимаются вместе с полем, когда оно растёт
    return (
      <>
        <Chip x={360} w={66} y={cy}><IcoAt x={14} y={12} d={IP.laptop} s={15} c="#4A4A46" /><T x={28} y={12} s={13.5}>Local</T></Chip>
        <Chip x={432} w={fw} y={cy} on={folderOn} hot={folderHot} glow={folderGlow}><IcoAt x={13} y={12} d={IP.folder} s={15} c="#4A4A46" /><T x={27} y={12} s={13.5}>{folderLabel ?? folder}</T></Chip>
        <Chip x={g} w={147} y={cy}>
          <IcoAt x={13} y={12} d={IP.branch} s={15} c="#4A4A46" /><T x={28} y={12} s={13.5}>main</T>
          <div style={{position: 'absolute', left: 63, top: 6, width: 1, height: 12, background: C.chipLine}} />
          {worktree
            ? <Box x={68} y={5} w={13} h={13} style={{borderRadius: 3, background: '#2F7CF6'}}><IcoAt x={6.5} y={6.5} d={IP.check} s={11} c="#FFFFFF" w={3} /></Box>
            : <Box x={68} y={5} w={13} h={13} style={{borderRadius: 3, background: '#FFFFFF', border: '1.3px solid #A9A9A6'}} />}
          <T x={85} y={12} s={13.5}>worktree</T>
        </Chip>
        <Chip x={g + 154} w={26} y={cy}><IcoAt x={12.5} y={12} d={IP.addFolder} s={15} c="#4A4A46" /></Chip>
        <Crab x={1088} y={881 - (h - 40)} />
        <Box x={359} y={943 - h} w={769} h={h} style={{borderRadius: 12, border: `1px solid ${input.focus ? '#B9B9B7' : '#CFCFCE'}`, background: '#FFFFFF', boxShadow: '0 1px 2px rgba(0,0,0,.04)'}}>
          <div style={{position: 'absolute', left: 12, top: 10, width: 712, fontFamily: C.font, fontSize: 15.5, lineHeight: '21px', color: input.text ? C.ink : C.ph, whiteSpace: 'pre-wrap'}}>
            {input.caret && !input.text ? <span style={{display: 'inline-block', width: 1.3, height: 17, background: C.ink, marginRight: 1, verticalAlign: '-3px'}} /> : null}
            {input.text || 'Describe a task or ask a question'}
            {input.caret && input.text ? <span style={{display: 'inline-block', width: 1.3, height: 17, background: C.ink, marginLeft: 1, verticalAlign: '-3px'}} /> : null}
          </div>
          <IcoAt x={748} y={h - 20} d={IP.enter} s={14} c={input.sendHot ? C.accent : '#A3A3A0'} w={input.sendHot ? 2.2 : 1.6} />
        </Box>
        <IcoAt x={376} y={959} d={IP.plus} s={14} c="#6B6B67" />
        <IcoAt x={396} y={959} d={IP.mic} s={14} c="#6B6B67" />
        <IcoAt x={416} y={959} d={IP.chev} s={12} c="#6B6B67" />
        <T x={432} y={959} s={13.3} c={C.ink2}>Bypass permissions</T>
        <T x={992} y={959} s={13} c={C.ink}>Opus 5.5</T>
        <T x={1057} y={959} s={13} c={C.ink}>Extra</T>
        <div style={{position: 'absolute', left: 1102, top: 953, width: 12, height: 12, borderRadius: 6, border: '1.4px solid #C6C6C5', boxSizing: 'border-box'}} />
      </>
    );
  };

// --- Меню папки (02): вверх от чипа, появление 140 мс от точки привязки ---
export const MENU_RECENT = ['Рабочий стол', 'Мой проект', 'Документы', 'Загрузки'];
const FolderMenu: React.FC<{p: number; hover: string | null; current: string; recent?: string[]; press?: number}> = ({p, hover, current, recent = MENU_RECENT, press = 0}) => {
  if (p <= 0) return null;
  const items: [string, number][] = [['No folder', 686], ...recent.map((r, i) => [r, 742 + i * 24] as [string, number]), ['Open folder…', 847]];
  return (
    <Box x={431} y={670} w={202} h={192} style={{borderRadius: 9, background: '#FFFFFF', boxShadow: '0 6px 22px rgba(0,0,0,.12), 0 0 0 1px rgba(0,0,0,.07)',
      transformOrigin: '30% 100%', transform: `scale(${0.98 + 0.02 * p})`, opacity: p}}>
      <div style={{position: 'absolute', left: -431, top: -670}}>
        <div style={{position: 'absolute', left: 443, top: 702, width: 178, height: 1, background: '#E6E6E6'}} />
        <T x={443} y={718} s={12} c={C.grey}>Recent</T>
        <div style={{position: 'absolute', left: 443, top: 830, width: 178, height: 1, background: '#E6E6E6'}} />
        {items.map(([m, y]) => (
          <React.Fragment key={m}>
            {hover === m ? <Box x={435} y={y - 11.5} w={194} h={23} style={{borderRadius: 6, background: press > 0 ? '#E8E7E3' : '#F1F0EC'}} /> : null}
            <T x={443} y={y} s={14.4} c={C.ink}>{m}</T>
            {m === current ? <IcoAt x={617} y={y} d={IP.check} s={13} c={C.blue} w={2} /> : null}
          </React.Fragment>
        ))}
      </div>
    </Box>
  );
};

// --- Окно выбора папки Windows (08): не затемняет приложение, шрифт Segoe UI ---
export const DIALOG_TREE: [string, number, number, string][] = [
  ['Быстрый доступ', 124, 45, 'star'], ['Рабочий стол', 148, 53, 'desk'], ['Загрузки', 172, 53, 'down'], ['Документы', 196, 53, 'doc'], ['Изображения', 220, 53, 'img'],
  ['Музыка', 244, 53, 'f'], ['Видео', 268, 53, 'f'], ['Этот компьютер', 300, 45, 'pc'], ['Сеть', 332, 45, 'net'],
];
export const DIALOG_ROWS: [string, string][] = [['Документы', '28.09.2026 10:14'], ['Отчёты', '30.09.2026 18:02'], ['Работа', '01.10.2026 09:31'], ['Скриншоты', '02.10.2026 21:47'],
  ['Учёба', '24.09.2026 16:20'], ['Фото', '27.09.2026 12:05'], ['Черновики', '30.09.2026 11:52'], ['Шаблоны', '19.09.2026 15:38']];
export const WinFolder: React.FC<{x: number; y: number; s?: number}> = ({x, y, s = 16}) => (
  <svg width={s} height={s * 0.8} viewBox="0 0 20 16" style={{position: 'absolute', left: x - s / 2, top: y - s * 0.4}}>
    <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1H7l2 2h8.5A1.5 1.5 0 0 1 19 4.5v9A1.5 1.5 0 0 1 17.5 15h-15A1.5 1.5 0 0 1 1 13.5z" fill="#F8D775" stroke="#E0A92E" strokeWidth={0.8} />
    <path d="M1 5.5h18" stroke="#E9B949" strokeWidth={0.8} />
  </svg>
);
export type DialogState = {p: number; rows?: [string, string][]; newRow?: string | null; newSel?: boolean; editing?: boolean; selected?: string | null; newHot?: boolean; selectHot?: boolean; selectPress?: number; field?: string};
const D: React.FC<{x: number; y: number; s?: number; c?: string; w?: number; children: React.ReactNode; anchor?: 'left' | 'center'}> = ({x, y, s = 12, c = '#000000', w = 400, children, anchor}) =>
  <Txt x={x} y={y} s={s} c={c} w={w} f={C.win} anchor={anchor}>{children}</Txt>;
const FolderDialog: React.FC<DialogState> = ({p, rows = DIALOG_ROWS, newRow = null, newSel, editing, selected = null, newHot, selectHot, selectPress = 0, field}) => {
  if (p <= 0) return null;
  const W = 946, H = 532;
  const list = newRow !== null && editing ? [...rows, [newRow, '03.10.2026 19:20'] as [string, string]] : rows;
  return (
    <Box x={229} y={255} w={W} h={H} style={{background: '#FFFFFF', border: '1px solid #8C8C8C', boxShadow: '0 8px 30px rgba(0,0,0,.28)', opacity: p,
      transform: `scale(${0.98 + 0.02 * p})`, transformOrigin: '50% 50%'}}>
      <Mark name="claude" size={13} color={C.accent} style={{position: 'absolute', left: 10, top: 9}} />
      <D x={30} y={15}>Select folder for local session</D>
      <IcoAt x={929} y={15} d={IP.close} s={13} c="#000000" w={1.2} />
      <IcoAt x={20} y={47} d={IP.back} s={14} c="#4D4D4D" w={1.5} />
      <IcoAt x={49} y={47} d={IP.fwd} s={14} c="#BDBDBD" w={1.5} />
      <IcoAt x={72} y={47} d={IP.chev} s={10} c="#4D4D4D" />
      <IcoAt x={93} y={47} d="M12 19V5M6 11l6-6 6 6" s={14} c="#4D4D4D" w={1.5} />
      <Box x={108} y={35} w={609} h={24} style={{border: '1px solid #D9D9D9'}}>
        <Box x={6} y={5} w={16} h={13} style={{background: '#1E90E8', borderRadius: 1}} />
        <D x={28} y={12} c="#4D4D4D">›</D><D x={38} y={12}>Этот компьютер</D><D x={140} y={12} c="#4D4D4D">›</D><D x={152} y={12}>Рабочий стол</D><D x={235} y={12} c="#4D4D4D">›</D>
        <IcoAt x={580} y={12} d={IP.chev} s={10} c="#4D4D4D" />
      </Box>
      <Box x={699} y={35} w={18} h={24} style={{border: '1px solid #D9D9D9', borderLeft: 'none'}}><IcoAt x={9} y={12} d={IP.refresh} s={11} c="#4D4D4D" w={1.6} /></Box>
      <Box x={732} y={36} w={200} h={22} style={{border: '1px solid #D9D9D9'}}><D x={8} y={11} c="#6D6D6D">Поиск в: Рабочий стол</D><IcoAt x={186} y={11} d={IP.search} s={12} c="#4D4D4D" /></Box>
      <D x={19} y={81}>Упорядочить ▾</D>
      <Box x={127} y={70} w={80} h={22} style={{background: newHot ? '#E5F3FF' : 'transparent', border: newHot ? '1px solid #CCE8FF' : '1px solid transparent'}}><D x={8} y={11}>Новая папка</D></Box>
      <IcoAt x={860} y={81} d={IP.list} s={14} c="#4D4D4D" /><IcoAt x={880} y={81} d={IP.chev} s={10} c="#4D4D4D" />
      <div style={{position: 'absolute', left: 914, top: 73, width: 16, height: 16, borderRadius: 8, background: '#1E6FD9', color: '#FFF', fontFamily: C.win, fontSize: 11, fontWeight: 700,
        display: 'grid', placeItems: 'center'}}>?</div>
      <Box x={0} y={95} w={157} h={361} style={{borderRight: '1px solid #EDEDED'}}>
        {DIALOG_TREE.map(([n, y, x, kind]) => (
          <React.Fragment key={n}>
            {n === 'Рабочий стол' ? <Box x={2} y={y - 95 - 11} w={139} h={22} style={{background: '#CCE8FF'}} /> : null}
            {kind === 'f' ? <WinFolder x={x - 13} y={y - 95} s={15} /> : kind === 'star' ? (
              <svg width={13} height={12} viewBox="0 0 24 24" style={{position: 'absolute', left: x - 20, top: y - 95 - 6}}><path d="M12 2l3 6.5 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21l1.4-7L2 9.3l7-.8z" fill="#1C8BE8" /></svg>
            ) : <div style={{position: 'absolute', left: x - 20, top: y - 95 - 6, width: 13, height: 12, borderRadius: 2, background: kind === 'pc' ? '#5AA9E6' : '#1C8BE8'}} />}
            <D x={x} y={y - 95}>{n}</D>
          </React.Fragment>
        ))}
        <Box x={141} y={0} w={15} h={361} style={{background: '#F0F0F0'}}><Box x={3} y={18} w={9} h={190} style={{background: '#C2C2C2'}} /></Box>
      </Box>
      <D x={179} y={109} c="#4C607A">Имя</D><D x={439} y={109} c="#4C607A">Дата изменения</D><D x={583} y={109} c="#4C607A">Тип</D><D x={703} y={109} c="#4C607A">Размер</D>
      {[432, 576, 696, 776].map((x) => <div key={x} style={{position: 'absolute', left: x, top: 99, width: 1, height: 20, background: '#E5E5E5'}} />)}
      {list.map(([name, date], i) => {
        const y = 138 + i * 21, isNew = newRow !== null && editing && i === list.length - 1, sel = isNew || selected === name;
        return (
          <React.Fragment key={`${name}-${i}`}>
            {sel ? <Box x={166} y={y - 10} w={600} h={21} style={{background: '#CCE8FF', border: '1px solid #99D1FF'}} /> : null}
            <WinFolder x={187} y={y} />
            {isNew ? (
              <Box x={196} y={y - 9} w={Math.max(70, name.length * 7.5 + 12)} h={19} style={{background: '#FFFFFF', border: '1px solid #0078D7'}}>
                {newSel ? <D x={3} y={9}><span style={{background: '#0078D7', color: '#FFFFFF'}}>{name}</span></D>
                  : <D x={3} y={9}>{name}<span style={{display: 'inline-block', width: 1, height: 13, background: '#000', marginLeft: 1, verticalAlign: '-2px'}} /></D>}
              </Box>
            ) : <D x={199} y={y}>{name}</D>}
            <D x={439} y={y} c="#6D6D6D">{date}</D>
            <D x={583} y={y} c="#6D6D6D">Папка с файлами</D>
          </React.Fragment>
        );
      })}
      <div style={{position: 'absolute', left: 0, top: 456, width: W - 2, height: 1, background: '#F0F0F0'}} />
      <D x={131} y={477}>Папка:</D>
      <Box x={173} y={466} w={755} h={22} style={{border: '1px solid #7A7A7A'}}><D x={6} y={11}>{field ?? 'Рабочий стол'}</D></Box>
      <Box x={717} y={496} w={109} h={23} style={{background: selectPress > 0 ? '#CCE4F7' : selectHot ? '#E5F1FB' : '#E1E1E1', border: `2px solid ${selectHot ? '#005499' : '#0078D7'}`}}>
        <D x={52.5} y={10.5} anchor="center">Выбор папки</D>
      </Box>
      <Box x={841} y={496} w={86} h={23} style={{background: '#E1E1E1', border: '1px solid #ADADAD'}}><D x={42} y={11} anchor="center">Отмена</D></Box>
    </Box>
  );
};

// --- Customize → Connectors (03): страница справа от панели ---
type Conn = {key: string; name: string; desc: string; by: string; logo: React.ReactNode; lines?: number};
const L = (f: string, s = 30) => <Img src={staticFile(`interfaces/logos/${f}`)} style={{width: s, height: s, objectFit: 'contain', maxWidth: 'none'}} />;
export const MsLogo: React.FC<{s?: number}> = ({s = 30}) => (<svg width={s} height={s} viewBox="0 0 22 22"><rect x="1" y="1" width="9.5" height="9.5" fill="#F25022" /><rect x="11.5" y="1" width="9.5" height="9.5" fill="#7FBA00" /><rect x="1" y="11.5" width="9.5" height="9.5" fill="#00A4EF" /><rect x="11.5" y="11.5" width="9.5" height="9.5" fill="#FFB900" /></svg>);
export const CONNECTORS: Conn[] = [
  {key: 'drive', name: 'Google Drive', desc: 'Search, read, and upload files instantly', by: 'by Google', logo: L('gdrive.svg')},
  {key: 'gmail', name: 'Gmail', desc: 'Draft replies, summarize threads, & search your inbox', by: 'by Google', logo: L('gmail.svg'), lines: 2},
  {key: 'calendar', name: 'Google Calendar', desc: 'Manage your schedule and coordinate meetings effortlessly', by: 'by Google', logo: L('gcal.svg'), lines: 2},
  {key: 'canva', name: 'Canva', desc: 'Search, create, autofill, and export Canva designs', by: 'by Canva', logo: <Img src={staticFile('interfaces/logos/canva.png')} style={{width: 32, height: 32, borderRadius: 8, maxWidth: 'none'}} />},
  {key: 'm365', name: 'Microsoft 365', desc: "Access your company's SharePoint, Outlook, and Teams directly in Claude", by: 'by Anthropic', logo: <MsLogo />, lines: 2},
  {key: 'notion', name: 'Notion', desc: 'Connect your Notion workspace to search, update, and power workflows across tools', by: 'by Notion', logo: <Mark name="notion" size={30} color="#111111" />, lines: 2},
  {key: 'figma', name: 'Figma', desc: 'Generate diagrams and better code from Figma context', by: 'by Figma', logo: L('figma.svg', 26)},
  {key: 'slack', name: 'Slack', desc: 'Send messages, create canvases, and fetch Slack data', by: 'by Slack', logo: L('slack.svg', 28)},
];
export const cardRect = (i: number): [number, number, number, number] => [i % 2 === 0 ? 286 : 745, 585 + Math.floor(i / 2) * 117, i % 2 === 0 ? 442 : 446, 105];
export type ConnState = {p: number; tab?: number; tabHot?: boolean; cards?: number; on?: Record<string, number>; hot?: string | null; scroll?: number};
const Customize: React.FC<ConnState> = ({p, tab = 1, tabHot, cards = 1, on = {}, hot = null, scroll = 0}) => {
  if (p <= 0) return null;
  return (
    <div style={{position: 'absolute', left: 246, top: 0, width: C.W - 246, height: C.H, background: C.bg, overflow: 'hidden', opacity: Math.min(1, p * 1.4),
      transformOrigin: '0 50%', transform: p < 1 ? `perspective(1800px) rotateY(${(1 - p) * -62}deg)` : undefined}}>
      <div style={{position: 'absolute', left: -246, top: -scroll, width: C.W, height: 1400}}>
        <T x={287} y={109} s={27} f={C.serif} c={C.ink}>Customize</T>
        <T x={298} y={165} s={14} c={C.grey}>Skills</T>
        {tab >= 1 || tabHot ? <Box x={346} y={150} w={100} h={30} style={{borderRadius: 8, background: tab >= 1 ? C.card : '#F5F5F3'}} /> : null}
        <T x={357} y={165} s={14} c={tab >= 1 ? C.ink : C.grey} w={tab >= 1 ? 500 : 400}>Connectors</T>
        <T x={460} y={165} s={14} c={C.grey}>Plugins</T>
        <div style={{position: 'absolute', left: 536, top: 155, width: 1, height: 20, background: C.line}} />
        <Box x={552} y={150} w={144} h={30} style={{borderRadius: 8, background: C.card}}>
          <T x={14} y={15} s={14} c={C.grey}>Yours</T>
          <Box x={62} y={2} w={80} h={26} style={{borderRadius: 7, background: '#FFFFFF', border: `1px solid ${C.line}`}}><T x={12} y={12.5} s={14} c={C.ink}>Discover</T></Box>
        </Box>
        <Box x={796} y={149} w={255} h={32} style={{borderRadius: 8, border: `1px solid ${C.line}`, background: '#FEFEFD'}}>
          <IcoAt x={19} y={16} d={IP.search} s={14} c={C.grey} /><T x={35} y={16} s={14} c={C.ph}>Search connectors</T>
        </Box>
        <IcoAt x={1076} y={165} d={IP.sliders} s={16} c="#4A4A46" />
        <Box x={1100} y={150} w={90} h={31} style={{borderRadius: 8, background: C.dark}}>
          <IcoAt x={17} y={15.5} d={IP.plus} s={14} c="#FFFFFF" w={2} /><T x={32} y={15.5} s={14} c="#FFFFFF" w={600}>Add</T><IcoAt x={71} y={15.5} d={IP.chev} s={11} c="#FFFFFF" w={2} />
        </Box>
        <Box x={286} y={210} w={905} h={279} style={{borderRadius: 16, border: `1px solid ${C.line}`, background: 'linear-gradient(180deg, #FCFCFB 0%, #EEF2F0 45%, #BFD3CC 100%)'}}>
          <T x={452} y={32} s={11} c={C.grey} anchor="center" style={{letterSpacing: '0.08em'}}>CURATED BY ANTHROPIC</T>
          <T x={452} y={59} s={24} c={C.ink} f={C.serif} anchor="center">Claude for design</T>
          <T x={452} y={87} s={14} c={C.ink2} anchor="center">Sketch, diagram, and iterate with your creative tools.</T>
          {([[262, 145, 42, <Img key="c" src={staticFile('interfaces/logos/canva.png')} style={{width: 30, height: 30, borderRadius: 7, maxWidth: 'none'}} />], [332, 165, 50, L('figma.svg', 24)],
            [414, 153, 66, L('adobe.svg', 42)], [493, 169, 44, <div key="m" style={{width: 26, height: 26, borderRadius: 6, background: '#FFD02F'}} />],
            [566, 148, 54, <div key="p" style={{width: 34, height: 34, borderRadius: 8, background: '#E8336E'}} />], [640, 162, 48, <div key="t" style={{fontFamily: C.font, fontSize: 30, fontWeight: 800, color: '#111'}}>;</div>]] as [number, number, number, React.ReactNode][])
            .map(([cx, cy, s, el], i) => (
              <Box key={i} x={cx - s / 2} y={cy - s / 2} w={s} h={s} style={{borderRadius: s * 0.18, background: '#FFFFFF', boxShadow: '0 2px 6px rgba(0,0,0,.08)', display: 'grid', placeItems: 'center'}}>{el}</Box>
            ))}
          {[32, 872].map((x) => (
            <div key={x} style={{position: 'absolute', left: x - 20, top: 119, width: 40, height: 40, borderRadius: 20, background: 'rgba(255,255,255,.85)'}}>
              <IcoAt x={20} y={20} d={x < 100 ? 'M14 6l-6 6 6 6' : 'M10 6l6 6-6 6'} s={16} c={C.ink} />
            </div>
          ))}
          <Box x={409} y={215} w={86} h={39} style={{borderRadius: 8, background: 'rgba(255,255,255,.7)', border: '1px solid rgba(0,0,0,.06)'}}><T x={43} y={19.5} s={14.5} w={600} anchor="center">Explore</T></Box>
        </Box>
        <Box x={707} y={506} w={31} h={6} style={{borderRadius: 3, background: C.ink}} />
        <div style={{position: 'absolute', left: 748, top: 506, width: 6, height: 6, borderRadius: 3, background: '#C9C9C7'}} />
        <div style={{position: 'absolute', left: 764, top: 506, width: 6, height: 6, borderRadius: 3, background: '#C9C9C7'}} />
        <T x={286} y={554} s={15.5} w={600}>Top connectors</T>
        <Box x={403} y={546} w={37} h={16} style={{borderRadius: 5, background: C.card}}><T x={18.5} y={8} s={11} c="#60625D" anchor="center">4049</T></Box>
        <T x={1113} y={554} s={14} c={C.ink}>Show all</T><IcoAt x={1181} y={554} d={IP.arrowR} s={14} c={C.ink} />
        {CONNECTORS.map((c, i) => {
          const [x, y, w, h] = cardRect(i);
          const q = Math.min(1, Math.max(0, cards * 8 - i));
          const v = on[c.key] ?? 0;
          const descH = (c.lines ?? 1) * 17;
          return (
            <Box key={c.key} x={x} y={y + (1 - q) * 18} w={w} h={h} style={{borderRadius: 12, border: `1px solid ${C.line}`, background: hot === c.key ? '#FAFAF8' : C.bg, opacity: q}}>
              <Box x={13} y={13} w={48} h={48} style={{borderRadius: 10, border: `1px solid ${C.line}`, background: '#FFFFFF', display: 'grid', placeItems: 'center'}}>{c.logo}</Box>
              <T x={74} y={23} s={15.4} w={600}>{c.name}<svg width={14} height={14} viewBox="0 0 24 24" style={{display: 'inline-block', marginLeft: 7, verticalAlign: '-1px'}}><path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8.5 12.2l2.4 2.4 4.6-4.8" fill="none" stroke="#8B8B88" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></svg></T>
              <div style={{position: 'absolute', left: 74, top: 36, width: w - 154 + (c.key === 'canva' ? 34 : 0), fontFamily: C.font, fontSize: 14.7, lineHeight: '17px', color: C.ink2}}>{c.desc}</div>
              <T x={74} y={45 + descH + 4} s={14.4} c={C.grey}>{c.by}</T>
              <Box x={404} y={14} w={28} h={28} style={{borderRadius: 7, border: v > 0.5 ? 'none' : `1px solid ${C.border}`, background: v > 0.5 ? C.ok : hot === c.key ? '#F1F1EF' : '#FFFFFF',
                transform: `scale(${1 + 0.18 * Math.sin(Math.min(1, v) * Math.PI)})`}}>
                <IcoAt x={14} y={14} d={v > 0.5 ? IP.check : IP.plus} s={v > 0.5 ? 16 : 15} c={v > 0.5 ? C.okInk : C.ink} w={v > 0.5 ? 2.2 : 1.6} />
              </Box>
            </Box>
          );
        })}
      </div>
    </div>
  );
};

// --- Главная Code (01/07): списки «Sessions» и «Projects» с нейтральными названиями ---
export type HomeSession = {title: string; desc: string; repo: string; ago: string};
export const CodeHomeLists: React.FC<{sessions: HomeSession[]; project?: {title: string; ago: string}; o?: number}> = ({sessions, project, o = 1}) => (
  <div style={{position: 'absolute', left: 0, top: 0, opacity: o}}>
    <T x={369} y={136} s={14.4} c={C.ink} w={500}>Sessions</T>
    {sessions.map((s, i) => {
      const y = 155 + i * 44;
      return (
        <Box key={s.title} x={370} y={y} w={747} h={38} style={{borderRadius: 8, background: C.card}}>
          <div style={{position: 'absolute', left: 9, top: 17, width: 5, height: 5, borderRadius: 3, background: '#F5A524'}} />
          <T x={19} y={19} s={13.4} c={C.ink}>Needs input</T>
          <T x={97} y={19} s={13.4} c={C.ink} w={600}>{s.title}</T>
          <T x={97 + s.title.length * 7.6 + 10} y={19} s={13.4} c={C.grey} style={{maxWidth: 380 - s.title.length * 7.6, overflow: 'hidden', textOverflow: 'ellipsis'}}>{s.desc}</T>
          <T x={498} y={19} s={12.8} c={C.grey}>{s.repo}</T>
          <T x={688} y={19} s={12.8} c={C.grey} anchor="right">{s.ago}</T>
          <IcoAt x={701} y={19} d={IP.chevR} s={13} c="#6B6B67" />
        </Box>
      );
    })}
    {project ? (
      <>
        <T x={369} y={287} s={14.4} c={C.ink} w={500}>Projects</T>
        <Box x={370} y={305} w={747} h={36} style={{borderRadius: 8, background: C.card}}>
          <div style={{position: 'absolute', left: 9, top: 16, width: 5, height: 5, borderRadius: 3, background: '#B9B8B3'}} />
          <T x={28} y={18} s={13.4} c={C.ink} w={600}>{project.title}</T>
          <div style={{position: 'absolute', left: 188, top: 16, width: 5, height: 5, borderRadius: 3, background: '#F5A524'}} />
          <T x={198} y={18} s={13} c="#C47F12">Needs input 1</T>
          <div style={{position: 'absolute', left: 291, top: 16, width: 5, height: 5, borderRadius: 3, background: C.blue}} />
          <T x={301} y={18} s={13} c={C.blue}>Ready for review 1</T>
          <T x={720} y={18} s={12.8} c={C.grey} anchor="right">{project.ago}</T>
          <IcoAt x={733} y={18} d={IP.chevR} s={13} c="#6B6B67" />
        </Box>
      </>
    ) : null}
  </div>
);

// --- Меню модели (07): над чипом «Opus 5.5», появление 140 мс от правого нижнего угла ---
export const MODELS: [string, string][] = [['Opus 5.5', ''], ['Fable 5.1', '2'], ['Sonnet 5.5', '3'], ['Haiku 4.5', '4']];
export const ModelMenu: React.FC<{p: number; hover?: string | null; press?: number; current?: string}> = ({p, hover = null, press = 0, current = 'Opus 5.5'}) => {
  if (p <= 0) return null;
  const ys = [822.5, 846.7, 870.5, 894.5];
  return (
    <>
      <Box x={985} y={949} w={60} h={20} style={{borderRadius: 5, background: '#E9E9E8'}} />
      <T x={992} y={959} s={13} c={C.ink}>Opus 5.5</T>
      <Box x={918} y={806} w={128} h={137} style={{borderRadius: 10, background: '#FFFFFF', boxShadow: '0 6px 22px rgba(0,0,0,.12), 0 0 0 1px rgba(0,0,0,.07)',
        transformOrigin: '90% 100%', transform: `scale(${0.98 + 0.02 * p})`, opacity: p}}>
        <div style={{position: 'absolute', left: -918, top: -806}}>
          {MODELS.map(([m, key], i) => (
            <React.Fragment key={m}>
              {hover === m ? <Box x={922} y={ys[i] - 11.5} w={120} h={23} style={{borderRadius: 6, background: press > 0 ? '#E8E7E3' : '#F1F0EC'}} /> : null}
              <T x={930} y={ys[i]} s={14.4} c={C.ink}>{m}</T>
              {m === current ? <IcoAt x={1030} y={ys[i]} d={IP.check} s={13} c={C.blue} w={2} /> : <T x={1034} y={ys[i]} s={13.5} c="#9C9B97" anchor="right">{key}</T>}
            </React.Fragment>
          ))}
          <div style={{position: 'absolute', left: 930, top: 910, width: 104, height: 1, background: '#E6E6E6'}} />
          <T x={930} y={927} s={14.4} c={C.ink}>More models</T>
          <IcoAt x={1029} y={927} d={IP.chevR} s={12} c="#8B8B88" />
        </div>
      </Box>
    </>
  );
};

// --- Усилие (06): над чипом «Extra»; бегунок на четвёртой из шести отметок, под второй «Recommended» ---
export const EFFORT_X = [896.5, 931.5, 965.5, 1001, 1034, 1069.5];
export const EffortPopover: React.FC<{p: number; pos?: number; label?: string; knobPress?: number}> = ({p, pos = 3, label = 'Extra', knobPress = 0}) => {
  if (p <= 0) return null;
  const kx = EFFORT_X[0] + (EFFORT_X[5] - EFFORT_X[0]) * (pos / 5);
  return (
    <>
      <Box x={1050} y={949} w={44} h={20} style={{borderRadius: 5, background: '#E0E0DF'}} />
      <T x={1057} y={959} s={13} c={C.ink}>Extra</T>
      <Box x={873} y={811} w={221} h={133} style={{borderRadius: 10, background: '#FFFFFF', boxShadow: '0 6px 22px rgba(0,0,0,.12), 0 0 0 1px rgba(0,0,0,.07)',
        transformOrigin: '80% 100%', transform: `scale(${0.98 + 0.02 * p})`, opacity: p}}>
        <div style={{position: 'absolute', left: -873, top: -811}}>
          <T x={885} y={833} s={14.4} c="#8B8B88">Effort</T>
          <T x={929.5} y={833} s={14.4} c={C.ink}>{label}</T>
          <div style={{position: 'absolute', left: 1067, top: 827, width: 12, height: 12, borderRadius: 6, border: '1.3px solid #8B8B88', boxSizing: 'border-box', fontFamily: C.font,
            fontSize: 8.5, fontWeight: 600, color: '#8B8B88', display: 'grid', placeItems: 'center'}}>?</div>
          <T x={885} y={871} s={14} c="#8B8B88">Faster</T>
          <T x={1080.5} y={871} s={14} c="#8B8B88" anchor="right">Smarter</T>
          <Box x={885} y={888} w={196} h={20} style={{borderRadius: 10, background: '#E5E5E4', overflow: 'hidden'}}>
            <div style={{position: 'absolute', left: 0, top: 0, width: kx - 885, height: 20, background: '#BEBEBD'}} />
          </Box>
          {EFFORT_X.map((x, i) => (i === 1
            ? <div key={i} style={{position: 'absolute', left: x - 1, top: 893.5, width: 2, height: 9, borderRadius: 1, background: '#8F8F8D'}} />
            : <div key={i} style={{position: 'absolute', left: x - 1.5, top: 896.5, width: 3, height: 3, borderRadius: 2, background: x < kx ? '#8F8F8D' : '#A9A9A7'}} />))}
          <Box x={kx - 8} y={887.5} w={16} h={21} style={{borderRadius: 8, background: '#FFFFFF', boxShadow: `0 1px 3px rgba(0,0,0,.25), 0 0 0 ${4 * knobPress}px rgba(52,126,216,${0.25 * knobPress})`,
            transform: `scale(${1 + 0.12 * knobPress})`}} />
          <T x={939.5} y={924} s={13.4} c="#8B8B88" anchor="center">Recommended</T>
        </div>
      </Box>
    </>
  );
};

// --- Сессия после отправки (собрана из токенов окна: карточка сообщения, звёздочка, строки инструментов) ---
export type ToolRow = {at: number; tool: string; arg: string};
export const ClaudeSession: React.FC<{t: number; prompt: string; title?: string; start: number; tools: ToolRow[]; doneAt: number; reply: string; replyAt: number;
  link?: {at: number; host: string; label?: string; glow?: number}}> = ({t, prompt, title = 'Новая сессия', start, tools, doneAt, reply, replyAt, link}) => {
  const k = uk(t, start, start + 0.3);
  if (k <= 0) return null;
  const working = t < doneAt;
  return (
    <div style={{position: 'absolute', left: 246, top: 38, width: C.W - 246, height: 818, background: C.bg, opacity: Math.min(1, k * 1.6)}}>
      <div style={{position: 'absolute', left: -246, top: -38}}>
        <At x={360} y={56}><Mark name="claude" size={22} color={C.accent} /></At>
        <T x={388} y={67} s={20} c={C.ink}>{title}</T>
        {/* сообщение пользователя вылетает из поля ввода */}
        <Box x={1117 - Math.min(560, prompt.length * 7.3 + 34)} y={110 + (1 - k) * 640} w={Math.min(560, prompt.length * 7.3 + 34)} h={prompt.length * 7.3 + 34 > 560 ? 62 : 42}
          style={{borderRadius: 12, background: C.card, padding: '10px 16px', fontFamily: C.font, fontSize: 15.5, lineHeight: '21px', color: C.ink, whiteSpace: 'normal'}}>{prompt}</Box>
        <At x={370} y={204} style={{transform: working ? `rotate(${(t - start) * 220}deg)` : undefined, transformOrigin: '11px 11px'}}><Mark name="claude" size={22} color={C.accent} /></At>
        <T x={402} y={215} s={15.5} c={working ? C.grey : C.ink}>{working ? 'Собираю сайт…' : 'Готово'}</T>
        {tools.map((r, i) => {
          const a = uk(t, r.at, r.at + 0.16);
          if (a <= 0) return null;
          const ok = t >= r.at + 0.14;
          return (
            <div key={i} style={{position: 'absolute', left: 0, top: 0, opacity: a, transform: `translateY(${(1 - a) * 8}px)`}}>
              <Box x={402} y={240 + i * 34} w={14} h={14} style={{borderRadius: 7, background: ok ? C.ok : '#EDECE8'}}>{ok ? <IcoAt x={7} y={7} d={IP.check} s={10} c={C.okInk} w={2.6} /> : null}</Box>
              <T x={426} y={247 + i * 34} s={14.5} c={C.ink} w={600} f='"JetBrains Mono", Consolas, monospace'>{r.tool}</T>
              <T x={426 + r.tool.length * 9.2 + 10} y={247 + i * 34} s={14.5} c={C.grey} f='"JetBrains Mono", Consolas, monospace'>{r.arg}</T>
            </div>
          );
        })}
        {t >= replyAt ? (
          <div style={{position: 'absolute', left: 0, top: 0, opacity: uk(t, replyAt, replyAt + 0.2), transform: `translateY(${(1 - uk(t, replyAt, replyAt + 0.25)) * 10}px)`}}>
            <T x={402} y={262 + tools.length * 34 + 22} s={21} c={C.ink} w={600}>{reply}</T>
          </div>
        ) : null}
        {link && t >= link.at ? (() => {
          const a = uk(t, link.at, link.at + 0.22), y = 262 + tools.length * 34 + 62;
          return (
            <Box x={402} y={y + (1 - a) * 12} w={420} h={64} style={{borderRadius: 12, background: '#FFFFFF', border: `1px solid ${C.line}`, opacity: a,
              boxShadow: (link.glow ?? 0) > 0 ? `0 0 0 ${3 * (link.glow ?? 0)}px rgba(217,119,87,${0.6 * (link.glow ?? 0)}), 0 8px 24px rgba(0,0,0,.08)` : '0 2px 6px rgba(0,0,0,.05)'}}>
              <Box x={14} y={14} w={36} h={36} style={{borderRadius: 9, background: '#14100E', display: 'grid', placeItems: 'center'}}>
                <svg width={22} height={12} viewBox="0 0 44 24"><rect x={1.5} y={1.5} width={41} height={21} rx={10.5} fill="none" stroke="#E3C07B" strokeWidth={3} /><circle cx={12} cy={12} r={6} fill="#E3C07B" /></svg>
              </Box>
              <T x={64} y={24} s={15.5} c={C.ink} w={600}>{link.host}</T>
              <T x={64} y={44} s={13.5} c={C.grey}>{link.label ?? 'Сайт готов · открыть в браузере'}</T>
              <IcoAt x={396} y={32} d="M7 17L17 7M9 7h8v8" s={16} c={C.blue} w={2} />
            </Box>
          );
        })() : null}
      </div>
    </div>
  );
};

export type ClaudeDesktopProps = {
  side?: {active?: 'new' | 'customize' | 'routines' | null; hot?: string | null; press?: number; pinned?: string[]; groups?: SideGroup[]; newGroup?: number};
  folder?: string; folderLabel?: React.ReactNode; folderOn?: boolean; folderHot?: boolean; folderGlow?: number;
  menu?: {p: number; hover?: string | null; press?: number; recent?: string[]};
  dialog?: DialogState; input?: InputState; welcome?: string; customize?: ConnState; homeO?: number; radius?: number; shadow?: boolean;
  user?: string; plan?: string; worktree?: boolean;
};
export const ClaudeDesktop: React.FC<ClaudeDesktopProps> = (p) => {
  const cz = p.customize?.p ?? 0;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: C.W, height: C.H, background: C.bg, borderRadius: p.radius ?? 10, overflow: 'hidden',
      boxShadow: p.shadow === false ? undefined : '0 40px 120px rgba(20,14,8,.32), 0 0 0 1px rgba(0,0,0,.09)'}}>
      <Sidebar active={p.side?.active ?? (cz >= 1 ? 'customize' : 'new')} hot={p.side?.hot} press={p.side?.press} pinned={p.side?.pinned} groups={p.side?.groups} newGroup={p.side?.newGroup} user={p.user} plan={p.plan} />
      <TopBar whatsNew={cz < 1} />
      {cz < 1 ? (
        <div style={{opacity: p.homeO ?? 1}}>
          <At x={360} y={56}><Mark name="claude" size={22} color={C.accent} /></At>
          <T x={388} y={67} s={22.3} c={C.ink}>{p.welcome ?? `Welcome back, ${p.user ?? 'Anna'}`}</T>
          <InputArea folder={p.folder ?? 'Мой проект'} folderLabel={p.folderLabel} folderOn={p.folderOn ?? (p.menu?.p ?? 0) > 0.5} folderHot={p.folderHot} folderGlow={p.folderGlow} input={p.input} worktree={p.worktree} />
          <FolderMenu p={p.menu?.p ?? 0} hover={p.menu?.hover ?? null} press={p.menu?.press} current={p.folder ?? 'Мой проект'} recent={p.menu?.recent} />
        </div>
      ) : null}
      <Customize {...(p.customize ?? {p: 0})} />
      {p.dialog ? <FolderDialog {...p.dialog} /> : null}
    </div>
  );
};
