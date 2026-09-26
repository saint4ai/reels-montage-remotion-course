import {Img, random, staticFile} from 'remotion';
import {color} from '../ds';

// Единый холст с фонами под стекло: каждая зона — своя палитра, световые сферы, полосы света и 3D-объекты,
// чтобы стеклу было что размывать и преломлять. Зоны перетекают друг в друга при переезде камеры.
// objects — экранные координаты, когда камера стоит в этой зоне (cam); слой объектов едет медленнее камеры.
export type Zone = {x: number; y: number; cam: [number, number]; base: string; orbs: {dx: number; dy: number; r: number; c: string}[]; objects: {src: string; sx: number; sy: number; s: number; rot: number}[]};
export const ZONES: Zone[] = [
  // A — «$20 за калькулятор»: тёплая зона, оранжевый свет на чёрном, один объект — монета
  {x: 720, y: 760, cam: [0, 0], base: color.zoneEmber,
    orbs: [{dx: -420, dy: -320, r: 950, c: 'rgba(255,122,47,.42)'}, {dx: 520, dy: 300, r: 900, c: 'rgba(255,255,255,.07)'}, {dx: 0, dy: 760, r: 800, c: 'rgba(255,90,40,.18)'}],
    objects: [{src: 'obj/dollar.png', sx: 1200, sy: 330, s: 270, rot: 12}]},
  // B — «4 года опыта»: мятная зона, один объект — кубок
  {x: 720, y: 2520, cam: [0, 1600], base: color.zoneMint,
    orbs: [{dx: -480, dy: -220, r: 1000, c: 'rgba(61,237,195,.30)'}, {dx: 520, dy: 320, r: 900, c: 'rgba(61,237,195,.16)'}, {dx: 0, dy: -700, r: 700, c: 'rgba(255,255,255,.06)'}],
    objects: [{src: 'obj/trophy.png', sx: 1180, sy: 360, s: 290, rot: 10}]},
  // C — «4 подключения»: мята и оранжевый вместе на чёрном, один объект — звено связи
  {x: 2320, y: 2360, cam: [1600, 1600], base: color.zoneGraphite,
    orbs: [{dx: -520, dy: -340, r: 1000, c: 'rgba(61,237,195,.28)'}, {dx: 500, dy: 360, r: 1000, c: 'rgba(255,122,47,.26)'}, {dx: 100, dy: 820, r: 700, c: 'rgba(255,255,255,.05)'}],
    objects: [{src: 'obj/link.png', sx: 1240, sy: 250, s: 230, rot: -16}]},
];
const WORLD = {x: -1100, y: -1100, w: 5400, h: 5400};
const NOISE = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`;

export const WorldBackground: React.FC<{camX: number; camY: number}> = ({camX, camY}) => {
  const layers: string[] = [];
  for (const z of ZONES) {
    for (const o of z.orbs) layers.push(`radial-gradient(${o.r}px ${o.r}px at ${z.x + o.dx - WORLD.x}px ${z.y + o.dy - WORLD.y}px, ${o.c} 0%, transparent 70%)`);
    layers.push(`radial-gradient(1700px 1700px at ${z.x - WORLD.x}px ${z.y - WORLD.y}px, ${z.base} 0%, transparent 72%)`);
  }
  return (
    <div style={{position: 'absolute', left: WORLD.x, top: WORLD.y, width: WORLD.w, height: WORLD.h, translate: `${-camX}px ${-camY}px`, background: [...layers, color.ink].join(', ')}}>
      {/* полосы света по диагонали */}
      <div style={{position: 'absolute', inset: 0, opacity: 0.5, backgroundImage: 'repeating-linear-gradient(115deg, rgba(255,255,255,0) 0 420px, rgba(255,255,255,.035) 420px 470px, rgba(255,255,255,0) 470px 900px)'}} />
      <div style={{position: 'absolute', inset: 0, opacity: 0.06, backgroundImage: 'repeating-linear-gradient(0deg, #fff 0 2px, transparent 2px 96px), repeating-linear-gradient(90deg, #fff 0 2px, transparent 2px 96px)'}} />
      <div style={{position: 'absolute', inset: 0, opacity: 0.07, backgroundImage: NOISE, mixBlendMode: 'overlay'}} />
    </div>
  );
};

// 3D-объекты зон на дальнем плане: едут медленнее камеры, чуть размыты — стекло над ними их преломляет.
// 3dicons (obj/*.png) владелец отклонил 18.09.2026: не то качество и палитра. Остались только в сданном примере «Коннекторы»,
// в новых роликах этот слой не заполнять ими — предметы рисуются вектором в дизайн-системе или генерируются Codex под палитру.
export const FarObjects: React.FC<{camX: number; camY: number; t: number}> = ({camX, camY, t}) => {
  const k = 0.7;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 6000, height: 6000, translate: `${-camX * k}px ${-camY * k}px`}}>
      {ZONES.flatMap((z, zi) => z.objects.map((o, i) => {
        const bob = Math.sin(t * 0.9 + zi * 2 + i) * 14;
        const x = o.sx + z.cam[0] * k - o.s / 2, y = o.sy + z.cam[1] * k - o.s / 2 + bob;
        // Объекты зоны видны, только когда камера рядом с ней: соседние зоны не залезают в кадр.
        const dist = Math.hypot(camX - z.cam[0], camY - z.cam[1]);
        const op = dist < 500 ? 1 : dist > 1200 ? 0 : 1 - (dist - 500) / 700;
        if (op <= 0) return null;
        return <Img key={`${zi}-${i}`} src={staticFile(o.src)} style={{position: 'absolute', left: x, top: y, width: o.s, height: o.s, opacity: op,
          scale: String(0.85 + 0.15 * op), rotate: `${o.rot + Math.sin(t * 0.6 + i) * 3}deg`, filter: 'blur(1.5px) saturate(1.1)'}} />;
      }))}
    </div>
  );
};

export const NearLayer: React.FC<{camX: number; camY: number}> = ({camX, camY}) => (
  <div style={{position: 'absolute', left: 0, top: 0, width: 6000, height: 6000, translate: `${-camX * 1.25}px ${-camY * 1.25}px`}}>
    {Array.from({length: 60}).map((_, i) => {
      const x = random(`nx${i}`) * 3600 - 200, y = random(`ny${i}`) * 3600 - 200, s = 3 + random(`ns${i}`) * 6;
      return <div key={i} style={{position: 'absolute', left: x, top: y, width: s, height: s, borderRadius: '50%', background: 'rgba(255,255,255,.35)', filter: 'blur(1px)'}} />;
    })}
  </div>
);
