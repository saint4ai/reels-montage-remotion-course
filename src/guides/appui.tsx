import React from 'react';
import {Easing, interpolate, useVideoConfig} from 'remotion';

// Общие детали векторных копий приложений: значки, подписи, рамки, камера по окну, курсор Windows, печать по символам.
// Окно рисуется в своих логических координатах (как на скриншоте), кадрирует его GuideShots или камера AppCam.
const CL = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const UIE = {io: Easing.bezier(0.65, 0, 0.35, 1), out: Easing.bezier(0.16, 1, 0.3, 1), in: Easing.bezier(0.7, 0, 0.84, 0), snap: Easing.bezier(0.2, 0.9, 0.1, 1)};
export const uk = (t: number, a: number, b: number, e = UIE.out) => interpolate(t, [a, b], [0, 1], {...CL, easing: e});

// --- Значок по пути (сетка 24×24, обводка как у Lucide) ---
export const Ico: React.FC<{d: string; s?: number; c?: string; w?: number; fill?: string; style?: React.CSSProperties}> = ({d, s = 16, c = '#73726C', w = 1.6, fill = 'none', style}) => (
  <svg width={s} height={s} viewBox="0 0 24 24" style={{flex: 'none', display: 'block', ...style}}>
    <path d={d} fill={fill} stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const IP = {
  menu: 'M4 6.5h16M4 12h16M4 17.5h10', panel: 'M4 5h16v14H4zM10 5v14', back: 'M19 12H5M11 6l-6 6 6 6', fwd: 'M5 12h14M13 6l6 6-6 6',
  chat: 'M7 5h9a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3h-4l-4 3v-3H7a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z', code: 'M9 8l-4 4 4 4M15 8l4 4-4 4M13.5 6l-3 12', plus: 'M12 5v14M5 12h14',
  folder: 'M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z',
  folderOpen: 'M3.5 17.5V7.5A1.5 1.5 0 0 1 5 6h4l2 2h7a1.5 1.5 0 0 1 1.5 1.5V11M3.5 17.5L6 11.8A1.5 1.5 0 0 1 7.4 11H20a1 1 0 0 1 .9 1.4l-2.4 5.8a1.5 1.5 0 0 1-1.4.8H5a1.5 1.5 0 0 1-1.5-1.5z',
  laptop: 'M5 6.5h14v9H5zM3 18.5h18', branch: 'M7 4.5v11M7 18.5a2 2 0 1 0 0 .01M17 6.5a2 2 0 1 0 0 .01M17 8.5c0 4-10 2.5-10 6.5',
  addFolder: 'M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5zM12 11v5M9.5 13.5h5',
  mic: 'M12 4a3 3 0 0 1 3 3v4a3 3 0 0 1-6 0V7a3 3 0 0 1 3-3zM6.5 11a5.5 5.5 0 0 0 11 0M12 16.5v3', chev: 'M7 10l5 5 5-5', chevR: 'M10 7l5 5-5 5',
  enter: 'M19 6v5a3 3 0 0 1-3 3H6M9.5 10.5L6 14l3.5 3.5', check: 'M5 12.5l4.2 4.2L19 7',
  clock: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 7.5V12l3 2', briefcase: 'M4 8h16v11H4zM9 8V6h6v2M4 13h16',
  tray: 'M4 7.5h16M5 7.5l1-3h12l1 3M4.5 7.5v11h15v-11', shapes: 'M7.5 4l3.5 6H4zM16.5 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM4.5 13.5h7v6h-7zM16.5 13.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  search: 'M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM20 20l-4.2-4.2', sliders: 'M6 4v16M12 4v16M18 4v16M4 15h4M10 9h4M16 13h4',
  close: 'M6 6l12 12M18 6L6 18', min: 'M6 12h12', max: 'M6 6h12v12H6z', arrowR: 'M5 12h14M13 6l6 6-6 6', bell: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5h4',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4', at: 'M16 12a4 4 0 1 1-1.2-2.9M16 9v4a2.5 2.5 0 0 0 5 0v-1a9 9 0 1 0-3.5 7.1', dots: 'M5 12h.01M12 12h.01M19 12h.01',
  home: 'M4 10.5L12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z', pages: 'M8 3.5h9l3 3v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2zM4 7v13a1 1 0 0 0 1 1h11',
  gitpr: 'M6 4.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM6 15.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM18 15.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM6 8.5v7M18 15.5V9a2 2 0 0 0-2-2h-4M14 5l-2 2 2 2',
  smile: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM9 14a4 4 0 0 0 6 0M9.5 10h.01M14.5 10h.01', bolt: 'M13 3L5 13.5h6l-1 7.5 8-10.5h-6z',
  refresh: 'M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5', gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7 7 0 0 1-2.1 1.2L14.7 21h-4l-.3-2.4a7 7 0 0 1-2.1-1.2l-1.9.7-2-3.4 1.6-1.2a7 7 0 0 1 0-3l-1.6-1.2 2-3.4 1.9.7a7 7 0 0 1 2.1-1.2L10.7 3h4l.3 2.4a7 7 0 0 1 2.1 1.2l1.9-.7 2 3.4-1.6 1.2a7 7 0 0 1 0 3z',
  filter: 'M4 7h16M7 12h10M10 17h4', grid: 'M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z', list: 'M8 6.5h12M8 12h12M8 17.5h12M4 6.5h.01M4 12h.01M4 17.5h.01',
  pin: 'M9 4h6l-1 5 3 3v2H7v-2l3-3zM12 14v6', trash: 'M5 7h14M10 7V5h4v2M6.5 7l1 12.5h9l1-12.5', image: 'M4.5 5h15v14h-15zM4.5 15.5l4-4 4 4 2.5-2.5 4.5 4.5M15 9.5h.01',
  page: 'M7 3.5h7l4 4V20.5H7zM10 11.5h5M10 15h5', sites: 'M4.5 4.5h6v6h-6zM16.5 4.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z',
  newPage: 'M7 3.5h7l4 4v5M7 3.5v17h6M17 15v6M14 18h6', tasks: 'M4 6.5l1.5 1.5L8 5.5M11 7h9M4 12.5l1.5 1.5L8 11.5M11 13h9M11 18h9', cube: 'M12 3.5l7.5 4.2v8.6L12 20.5l-7.5-4.2V7.7zM12 12l7.5-4.3M12 12v8.5M12 12L4.5 7.7',
  wave: 'M6 10v4M9 7v10M12 9v6M15 6v12M18 10v4', cap: 'M3 9.5L12 5l9 4.5-9 4.5zM7 11.5v4c3 2 7 2 10 0v-4', chart: 'M5 19.5V11M10 19.5V5M15 19.5v-6M20 19.5v-9',
  calendar: 'M5 6h14v14H5zM5 10h14M9 4v4M15 4v4', mail: 'M4 6h16v12H4zM4 7l8 6 8-6', sparkle: 'M12 4l1.8 5.2L19 11l-5.2 1.8L12 18l-1.8-5.2L5 11l5.2-1.8z',
};

// Текст с привязкой по центру строки (y: середина строки, как в окне)
export const Txt: React.FC<{x: number; y: number; s?: number; c?: string; w?: number; f: string; children: React.ReactNode; style?: React.CSSProperties; anchor?: 'left' | 'center' | 'right'}> =
  ({x, y, s = 14, c = '#1F1F1E', w = 400, f, children, style, anchor = 'left'}) => (
    <div style={{position: 'absolute', left: x, top: y - s * 0.66, fontFamily: f, fontSize: s, fontWeight: w, color: c, whiteSpace: 'nowrap', lineHeight: `${s * 1.32}px`,
      transform: anchor === 'center' ? 'translateX(-50%)' : anchor === 'right' ? 'translateX(-100%)' : undefined, ...style}}>{children}</div>
  );
export const Box: React.FC<{x: number; y: number; w: number; h: number; style?: React.CSSProperties; children?: React.ReactNode}> = ({x, y, w, h, style, children}) => (
  <div style={{position: 'absolute', left: x, top: y, width: w, height: h, boxSizing: 'border-box', ...style}}>{children}</div>
);
export const At: React.FC<{x: number; y: number; children: React.ReactNode; style?: React.CSSProperties}> = ({x, y, children, style}) => (
  <div style={{position: 'absolute', left: x, top: y, ...style}}>{children}</div>
);
// Значок по центру точки
export const IcoAt: React.FC<{x: number; y: number; d: string; s?: number; c?: string; w?: number; fill?: string}> = ({x, y, d, s = 16, c, w, fill}) => (
  <div style={{position: 'absolute', left: x - s / 2, top: y - s / 2}}><Ico d={d} s={s} c={c} w={w} fill={fill} /></div>
);

// --- Камера по окну: точка окна (x, y) ставится в центр сцены (cx, cy) с масштабом s и наклонами ---
export type CamKey = {at: number; x: number; y: number; s: number; rx?: number; ry?: number; rz?: number; dur?: number; e?: (v: number) => number};
export type CamPose = {x: number; y: number; s: number; rx: number; ry: number; rz: number};
export const camPose = (t: number, keys: CamKey[]): CamPose => {
  const k0 = keys[0];
  let p: CamPose = {x: k0.x, y: k0.y, s: k0.s, rx: k0.rx ?? 0, ry: k0.ry ?? 0, rz: k0.rz ?? 0};
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i], m = uk(t, k.at, k.at + (k.dur ?? 0.7), k.e ?? UIE.io);
    if (m <= 0) break;
    p = {x: p.x + (k.x - p.x) * m, y: p.y + (k.y - p.y) * m, s: Math.exp(Math.log(p.s) + (Math.log(k.s) - Math.log(p.s)) * m),
      rx: p.rx + ((k.rx ?? 0) - p.rx) * m, ry: p.ry + ((k.ry ?? 0) - p.ry) * m, rz: p.rz + ((k.rz ?? 0) - p.rz) * m};
  }
  return p;
};
// Точка окна → точка сцены (без учёта перспективы; для наклонов до 10° расхождение меньше 2%)
export const camProject = (pose: CamPose, x: number, y: number, cx = 720, cy = 1010): [number, number] => [cx + (x - pose.x) * pose.s, cy + (y - pose.y) * pose.s];

// Окно масштабируется свойством zoom, а не transform: scale, так Chrome раскладывает текст и векторы сразу в нужном
// размере, и на наезде 3–4× интерфейс остаётся резким. Наклоны (rx, ry, rz), отдельной обёрткой вокруг центра кадра.
export const AppCam: React.FC<{t: number; keys?: CamKey[]; pose?: (t: number) => CamPose; w: number; h: number; cx?: number; cy?: number; persp?: number; blur?: boolean; o?: number;
  style?: React.CSSProperties; children: (pose: CamPose) => React.ReactNode}> = ({t, keys, pose, w, h, cx = 720, cy = 1010, persp = 2600, blur = true, o = 1, style, children}) => {
  const {fps} = useVideoConfig();
  const at = (tt: number) => (pose ? pose(tt) : camPose(tt, keys ?? [{at: 0, x: w / 2, y: h / 2, s: 1}]));
  const p = at(t), q = at(t - 1 / fps);
  // смаз по скорости: сдвиг якоря и скорость наезда за кадр
  const dx = Math.abs((p.x - q.x) * p.s), dy = Math.abs((p.y - q.y) * p.s), dz = Math.abs(Math.log(p.s / q.s)) * 900;
  // медленное слежение за кареткой не смазываем: порог 2,5 px за кадр, текст при печати остаётся резким
  const bx = Math.max(0, Math.min(26, dx * 0.3 + dz * 0.12) - 2.5), by = Math.max(0, Math.min(26, dy * 0.3 + dz * 0.12) - 2.5);
  const id = `cam-${Math.round(cx)}-${Math.round(cy)}-${w}`;
  const mb = blur && bx + by > 0.5;
  if (o <= 0) return null;
  const rot = p.rx || p.ry || p.rz ? `rotateX(${p.rx}deg) rotateY(${p.ry}deg) rotateZ(${p.rz}deg)` : undefined;
  return (
    <div style={{position: 'absolute', inset: 0, perspective: persp, perspectiveOrigin: `${cx}px ${cy}px`, opacity: o, ...style}}>
      {mb ? <svg width={0} height={0} style={{position: 'absolute'}}><filter id={id} x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation={`${bx.toFixed(2)} ${by.toFixed(2)}`} /></filter></svg> : null}
      <div style={{position: 'absolute', inset: 0, transformOrigin: `${cx}px ${cy}px`, transform: rot, filter: mb ? `url(#${id})` : undefined}}>
        <div style={{position: 'absolute', left: cx / p.s - p.x, top: cy / p.s - p.y, width: w, height: h, zoom: p.s} as React.CSSProperties}>
          {children(p)}
        </div>
      </div>
    </div>
  );
};

// --- Курсор Windows: стрелка, над кнопкой рука; путь по точкам с дугой, клик, нажатие и волна ---
export type CurPt = {at: number; x: number; y: number; hand?: boolean};
const curPos = (t: number, pts: CurPt[], dur: number): [number, number, boolean] => {
  let x = pts[0].x, y = pts[0].y, hand = !!pts[0].hand;
  for (let i = 1; i < pts.length; i++) {
    const pt = pts[i], d = Math.min(dur, Math.max(0.2, (pt.at - pts[i - 1].at) * 0.85));
    const m = uk(t, pt.at - d, pt.at, UIE.io);
    if (m <= 0) break;
    const x0 = x, y0 = y, len = Math.hypot(pt.x - x0, pt.y - y0) || 1, bend = Math.sin(m * Math.PI) * len * 0.1;
    x = x0 + (pt.x - x0) * m + (-(pt.y - y0) / len) * bend;
    y = y0 + (pt.y - y0) * m + ((pt.x - x0) / len) * bend;
    if (m > 0.85) hand = !!pt.hand;
  }
  return [x, y, hand];
};
const ARROW = 'M1 1 L1 18.2 L5.2 14.2 L8 20.6 L10.6 19.5 L7.9 13.2 L13.6 13.2 Z';
const HAND = 'M7.2 2.2c0-.9.7-1.6 1.6-1.6s1.6.7 1.6 1.6v7.3c.1-.8.8-1.4 1.6-1.4s1.6.7 1.6 1.6v.8c.1-.8.8-1.3 1.6-1.3s1.6.7 1.6 1.6v.9c.1-.7.8-1.2 1.5-1.2.9 0 1.6.7 1.6 1.6v5.2c0 3.6-2.6 6.1-6.1 6.1h-2c-2 0-3.5-.9-4.7-2.5l-4-5.6c-.5-.7-.4-1.7.3-2.2.7-.5 1.7-.4 2.2.3l1.6 2.1z';
export const WinCursor: React.FC<{t: number; pts: CurPt[]; clicks?: number[]; show: [number, number]; scale?: number; size?: number; dur?: number; ring?: string;
  project?: (x: number, y: number) => [number, number]}> =
  ({t, pts, clicks = [], show, scale = 1, size = 26, dur = 0.5, ring = 'rgba(0,0,0,.22)', project}) => {
    if (t < show[0] || t > show[1]) return null;
    const [wx, wy, hand] = curPos(t, pts, dur);
    const [x, y] = project ? project(wx, wy) : [wx, wy];
    const o = Math.min(uk(t, show[0], show[0] + 0.12), 1 - uk(t, show[1] - 0.12, show[1]));
    const last = clicks.filter((c) => t >= c).pop();
    const since = last === undefined ? 9 : t - last;
    const press = since < 0.12 ? Math.sin((since / 0.12) * Math.PI) : 0;
    const r = uk(since, 0, 0.42, UIE.out);
    const k = 1 / scale;
    return (
      <div style={{position: 'absolute', left: x, top: y, pointerEvents: 'none', opacity: o, transform: `scale(${k})`, transformOrigin: '0 0', zIndex: 50}}>
        {since < 0.42 ? <div style={{position: 'absolute', left: -size * 1.2 * r, top: -size * 1.2 * r, width: size * 2.4 * r, height: size * 2.4 * r, borderRadius: '50%',
          background: ring, opacity: 0.9 * (1 - r)}} /> : null}
        <svg width={size} height={size * 1.25} viewBox="0 0 22 24" style={{position: 'absolute', left: hand ? -size * 0.36 : -size * 0.05, top: -size * 0.04, overflow: 'visible',
          transform: `scale(${1 - press * 0.12})`, transformOrigin: hand ? '36% 4%' : '5% 4%', filter: 'drop-shadow(0 1.5px 2px rgba(0,0,0,.35))'}}>
          <path d={hand ? HAND : ARROW} fill="#FFFFFF" stroke="#000000" strokeWidth={1.3} strokeLinejoin="round" />
          {hand ? <path d="M10.4 9.5v4M13.6 10.4v3.2M16.8 11.2v2.6" stroke="#000000" strokeWidth={0.9} strokeLinecap="round" /> : null}
        </svg>
      </div>
    );
  };

// Печать по символам: 25–35 знаков в секунду
export const typedAt = (t: number, at: number, text: string, cps = 30) => text.slice(0, Math.max(0, Math.min(text.length, Math.floor((t - at) * cps))));
export const caretOn = (t: number) => Math.floor(t * 1.9) % 2 === 0;
// Нажатие: «кнопка темнеет на 4–6% на 120 мс», доля затемнения к моменту t
export const pressAt = (t: number, at: number) => (t >= at && t < at + 0.12 ? Math.sin(((t - at) / 0.12) * Math.PI) : 0);
