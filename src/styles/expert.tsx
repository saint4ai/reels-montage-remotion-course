import {AbsoluteFill, Img, staticFile} from 'remotion';
import {blurThrough, whip} from '../kit/presentations';
import type {Box} from '../formats';
import type {BlockData, Shot} from '../template/blocks';
import type {SceneProps, StyleDef} from './engine';
import {E, Fit, k, LogoTile, SANS, scale, springAt, Words} from './parts';
import {SkinScene, type Skin} from './skinned';

// ЭКСПЕРТ — формат роликов 1, 2, 4, 5 (Composio, Fable/effort, коннекторы, Vercel): запись спикера на всю нижнюю половину
// рилса (в YouTube — правая половина), сверху платиновая доска. На доске номер раздела моно-шрифтом, крупный заголовок
// с полосой акцента, белые карточки с тонкой рамкой и продуктовая поверхность: у блока с shot — настоящий снимок сервиса
// в окне браузера, окно медленно прокручивается. Субтитры — тёмная плашка на шве, над записью.
const skin: Skin = {
  ink: '#111316', sub: '#6B7078', accent: '#FF7A2F', accent2: '#3DEDC3', bar: true, head: 112, tile: '#FFFFFF', flowWide: 1.5,
  // доска — половина кадра, низкая и широкая: масштаб по ширине, иначе всё содержимое ужимается до 75 %
  scale: (z) => z.w / 1280,
  panel: (r) => ({borderRadius: Math.min(r, 26), background: '#FFFFFF', boxShadow: '0 0 0 2px rgba(17,19,22,.07), 0 24px 48px rgba(17,19,22,.14)'}),
  row: (on) => ({background: on > 0 ? 'linear-gradient(90deg, rgba(61,237,195,.5), rgba(61,237,195,.16))' : 'transparent'}),
};

const board = (f: {w: number; h: number}): Box => f.h > f.w ? {x: 0, y: 0, w: f.w, h: f.h / 2} : {x: 0, y: 0, w: f.w / 2, h: f.h};
const zone = (f: {w: number; h: number}): Box => f.h > f.w ? {x: 90, y: 240, w: 1260, h: 820} : {x: 110, y: 170, w: 1060, h: 980};
const sectionOf = (b: BlockData, i: number) => `● ${b.label.split(' · ')[0] ?? String(i + 1).padStart(2, '0')} / ${(b.label.split(' · ')[1] ?? b.kind).toUpperCase()}`;
const titleOf = (b: BlockData) => b.kind === 'hook' ? b.lines.join(' ') : b.kind === 'stat' ? b.caption : b.kind === 'cta' ? b.note : b.title;

// Платиновая доска: свет от угла меняет цвет и сторону на каждом блоке, по доске медленно идёт диагональный блик.
const Background: StyleDef['Background'] = ({t, i, b, f}) => {
  const r = board(f), z = zone(f);
  const glow = ['255,122,47', '61,237,195', '255,255,255'][i % 3], alpha = [0.22, 0.26, 0.9][i % 3];
  const cx = [0.95, 0.05, 0.85][i % 3] * r.w + Math.sin(t * 0.4) * 40, cy = [0.05, 0.1, 0.95][i % 3] * r.h;
  const sheen = ((t * 0.06 + i * 0.3) % 1.6) - 0.3;
  return (
    <AbsoluteFill style={{background: '#0B0D10'}}>
      <div style={{position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h, overflow: 'hidden', background: 'linear-gradient(160deg, #F8F9FA 0%, #E7E9EC 100%)'}}>
        <div style={{position: 'absolute', left: cx - r.w * 0.7, top: cy - r.w * 0.7, width: r.w * 1.4, height: r.w * 1.4, borderRadius: '50%',
          background: `radial-gradient(closest-side, rgba(${glow},${alpha}), rgba(${glow},0))`}} />
        <div style={{position: 'absolute', left: -r.w * 0.5 + sheen * r.w, top: -r.h * 0.2, width: r.w * 0.5, height: r.h * 1.4, transform: 'rotate(18deg)',
          background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.55), rgba(255,255,255,0))'}} />
      </div>
      {b.kicker ? null : (
        <div style={{position: 'absolute', left: z.x + 20, top: z.y - 70, fontFamily: 'JBM', fontWeight: 700, fontSize: 36, letterSpacing: '.06em', color: '#7C8189',
          opacity: k(t, b.at, b.at + 0.3)}}>{sectionOf(b, i)}</div>
      )}
    </AbsoluteFill>
  );
};

// Блок со снимком сервиса: заголовок с полосой, под ним окно браузера со снимком; окно поднимается пружиной
// и медленно прокручивается вниз, у блока логотипов плитки ложатся поверх нижнего края окна.
const ShotScene: React.FC<SceneProps & {shot: Shot}> = ({t, b, zone: z, shot}) => {
  const s = skin.scale ? skin.scale(z) : scale(z), head = (skin.head ?? 96) * s, tx = z.x + 20 * s, tw = z.w - 40 * s, text = titleOf(b);
  const n = Math.ceil((text.length * head * 0.52) / tw), titleY = z.y + 10 * s;
  const top = titleY + head * 1.08 * n + 56 * s, ww = z.w, wh = z.y + z.h - top, bar = 64 * s;
  const a = springAt(t, b.at + 0.25), sc = ww / shot.w, imgH = shot.h * sc;
  const room = Math.max(0, imgH - (wh - bar)), scroll = Math.min(room, (shot.pan ?? 0.2) * imgH) * k(t, b.at + 1.0, b.at + 3.6, E.inOut);
  const tile = 150 * s;
  return (
    <>
      <Words t={t} at={b.at} text={text} size={head} color={skin.ink} x={tx} y={titleY} w={tw} family={SANS} />
      <div style={{position: 'absolute', left: tx, top: titleY + head * 1.08 * n + 4 * s, height: 12 * s, borderRadius: 4 * s, background: skin.accent,
        width: Math.min(tw, text.length * head * 0.5) * k(t, b.at + 0.35, b.at + 0.8, E.out)}} />
      <div style={{position: 'absolute', left: z.x, top, width: ww, height: wh, borderRadius: 28 * s, overflow: 'hidden', background: '#FFFFFF',
        boxShadow: '0 0 0 2px rgba(17,19,22,.08), 0 34px 70px rgba(17,19,22,.2)', opacity: Math.min(1, a * 1.6), transform: `translateY(${(1 - a) * 90}px) scale(${0.95 + 0.05 * a})`}}>
        <div style={{position: 'relative', zIndex: 1, height: bar, display: 'flex', alignItems: 'center', gap: 12 * s, padding: `0 ${22 * s}px`, background: '#F1F2F4',
          boxShadow: 'inset 0 -1px 0 rgba(17,19,22,.1)'}}>
          {['#FF6159', '#FFBD2E', '#28C941'].map((c) => <span key={c} style={{width: 18 * s, height: 18 * s, borderRadius: '50%', background: c, flex: 'none'}} />)}
          {shot.url ? (
            <Fit name={`url:${shot.url}`} style={{marginLeft: 16 * s, flex: 1, height: bar * 0.62, borderRadius: bar * 0.31, background: '#FFFFFF', display: 'flex', alignItems: 'center',
              padding: `0 ${22 * s}px`, boxSizing: 'border-box', overflow: 'hidden', whiteSpace: 'nowrap', fontFamily: 'JBM', fontWeight: 600, fontSize: 32 * s, lineHeight: 1, color: '#5E636B'}}>{shot.url}</Fit>
          ) : null}
        </div>
        <Img src={staticFile(shot.src)} style={{position: 'absolute', left: 0, top: bar - scroll, width: ww, height: imgH}} />
      </div>
      {b.kind === 'logos' ? (
        <div style={{position: 'absolute', left: z.x + z.w - b.logos.length * (tile + 20 * s) - 10 * s, top: top + wh - tile * 0.62, display: 'flex', gap: 20 * s}}>
          {b.logos.map((name, i) => {
            const p = springAt(t, b.at + 0.9 + i * 0.16);
            return <div key={name} style={{transform: `translateY(${(1 - p) * 70}px) scale(${0.6 + 0.4 * p})`, opacity: Math.min(1, p * 2)}}>
              <LogoTile name={name} size={tile} bg="#FFFFFF" shadow="0 0 0 2px rgba(17,19,22,.06), 0 18px 36px rgba(17,19,22,.22)" /></div>;
          })}
        </div>
      ) : null}
    </>
  );
};

export const EXPERT: StyleDef = {
  id: 'expert', speaker: 'half', Background,
  Scene: (p) => p.b.shot ? <ShotScene {...p} shot={p.b.shot} /> : <SkinScene {...p} skin={skin} />,
  zone: (f) => zone(f),
  // шов 1280: тёмная плашка стоит на доске над записью (в 1080-сетке — центр 868, как в роликах 1–5)
  captions: (f) => f.h > f.w ? {cx: 720, cy: 1157, maxW: 1100, size: 53.3} : {cx: 640, cy: 1300, maxW: 1000, size: 54},
  transition: (i) => (i % 2 ? blurThrough({color: '#EEF0F2'}) : whip({dir: 'left'})) as never,
  sfx: {move: 'ui-slide', pop: 'ui-pop', tick: 'ui-tap', count: 'counter'},
  // мягкая тень доски на верхнем крае записи
  Overlay: ({f}) => f.h > f.w
    ? <div style={{position: 'absolute', left: 0, top: f.h / 2, width: f.w, height: 40, background: 'linear-gradient(180deg, rgba(0,0,0,.28), rgba(0,0,0,0))'}} />
    : <div style={{position: 'absolute', left: f.w / 2, top: 0, width: 40, height: f.h, background: 'linear-gradient(90deg, rgba(0,0,0,.28), rgba(0,0,0,0))'}} />,
};

// Демо ЭКСПЕРТА: те же блоки, что у остальных стилей, только у блока «Стек» — снимок страницы GitHub в окне браузера.
export const expertDemo = <P extends {blocks: BlockData[]}>(p: P): P => ({...p, blocks: p.blocks.map((b) => b.id === 'stack'
  ? {...b, shot: {src: 'reels/money/gh-metabase-mcp.png', w: 2560, h: 4000, url: 'github.com/1luvc0d3/metabase-mcp', pan: 0.12}} : b)});
