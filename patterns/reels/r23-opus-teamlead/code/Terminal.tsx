import {Mark} from '../../montage/parts';

// Живой терминал Claude Code: шапка с моделью, строки инструментов «● Read / ● Update», дифф, спиннер «Thinking…»,
// поле ввода с кареткой. Каждая строка появляется в свою секунду и печатается посимвольно — виден процесс, а не картинка.
// Кегль моно-шрифта не меньше 42 px (минимум текста в кадре 2K), поэтому строки короткие.
export type TLine = {at: number; kind: 'user' | 'tool' | 'out' | 'add' | 'del' | 'think' | 'done' | 'cmd'; text: string; dur?: number};
const C = {bg: '#15171A', bar: '#1E2125', ink: '#E9ECEA', dim: '#8B9197', orange: '#FF7A2F', mint: '#3DEDC3', addBg: 'rgba(61,237,195,.14)', delBg: 'rgba(255,122,47,.14)'};
const SPIN = ['·', '✢', '✳', '✶', '✻', '✽'];

export const Terminal: React.FC<{t: number; x: number; y: number; w: number; h: number; lines: TLine[]; model?: string; size?: number; glow?: number; appear?: number;
  prompt?: {at: number; text: string}}> = ({t, x, y, w, h, lines, model = 'Opus 5.5', size = 42, glow = 0, appear = 1, prompt}) => {
  const lh = size * 1.45, shown = lines.filter((l) => t >= l.at);
  const room = Math.floor((h - 250) / lh), view = shown.slice(Math.max(0, shown.length - room));
  const typed = (l: TLine) => { const d = l.dur ?? Math.min(0.5, l.text.length * 0.025); return l.text.slice(0, Math.round(l.text.length * Math.min(1, (t - l.at) / d))); };
  const spin = SPIN[Math.floor(t * 12) % SPIN.length], caret = Math.floor(t * 2.4) % 2 === 0;
  const pr = prompt && t >= prompt.at ? prompt.text.slice(0, Math.round(prompt.text.length * Math.min(1, (t - prompt.at) / Math.max(0.3, prompt.text.length * 0.05)))) : '';
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: 30, background: C.bg, overflow: 'hidden', opacity: Math.min(1, appear * 1.4),
      transform: `translateY(${(1 - Math.min(1, appear)) * 60}px) scale(${0.92 + 0.08 * Math.min(1, appear)})`,
      boxShadow: `0 0 0 2px rgba(255,255,255,.06), 0 44px 80px rgba(17,19,22,.35), 0 0 ${70 * glow}px rgba(61,237,195,${0.8 * glow})`}}>
      <div style={{height: 64, background: C.bar, display: 'flex', alignItems: 'center', gap: 12, padding: '0 24px'}}>
        {['#FF6159', '#FFBD2E', '#28C941'].map((c) => <span key={c} style={{width: 18, height: 18, borderRadius: 9, background: c}} />)}
        <span style={{marginLeft: 14, fontFamily: 'JBM', fontWeight: 600, fontSize: 30, color: C.dim}}>~/shop — claude</span>
      </div>
      <div style={{margin: '22px 24px 0', padding: '14px 22px', borderRadius: 14, border: `3px solid ${C.orange}`, display: 'flex', alignItems: 'center', gap: 16}}>
        <Mark name="claude" size={size} />
        <span style={{fontFamily: 'JBM', fontWeight: 700, fontSize: size, color: C.ink, whiteSpace: 'nowrap'}}>Claude Code</span>
        <span style={{marginLeft: 'auto', fontFamily: 'JBM', fontWeight: 600, fontSize: size * 0.9, color: C.orange, whiteSpace: 'nowrap'}}>{model}</span>
      </div>
      <div style={{position: 'absolute', left: 30, top: 170, right: 30, fontFamily: 'JBM', fontSize: size, lineHeight: `${lh}px`, whiteSpace: 'nowrap'}}>
        {view.map((l, i) => {
          const last = i === view.length - 1;
          const col = l.kind === 'tool' ? C.ink : l.kind === 'add' ? C.mint : l.kind === 'del' ? C.orange : l.kind === 'think' ? C.orange : l.kind === 'done' ? C.mint : l.kind === 'user' ? C.ink : C.dim;
          const pre = l.kind === 'tool' ? '● ' : l.kind === 'add' ? '+ ' : l.kind === 'del' ? '− ' : l.kind === 'user' || l.kind === 'cmd' ? '> ' : l.kind === 'think' ? `${spin} ` : l.kind === 'done' ? '✓ ' : '  ⎿ ';
          return (
            <div key={i} style={{color: col, fontWeight: l.kind === 'tool' || l.kind === 'user' || l.kind === 'cmd' ? 700 : 500, borderRadius: 8, padding: '0 8px',
              background: l.kind === 'add' ? C.addBg : l.kind === 'del' ? C.delBg : undefined, opacity: l.kind === 'think' && !last ? 0 : 1, height: l.kind === 'think' && !last ? 0 : lh}}>
              {pre}{typed(l)}{last && l.kind !== 'think' && caret ? <span style={{color: C.mint}}>▌</span> : null}
            </div>
          );
        })}
      </div>
      <div style={{position: 'absolute', left: 24, right: 24, bottom: 22, height: 72, borderRadius: 14, border: '3px solid #3A3E44', display: 'flex', alignItems: 'center',
        padding: '0 20px', fontFamily: 'JBM', fontWeight: 600, fontSize: size * 0.9, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden'}}>
        <span style={{color: C.dim}}>&gt;&nbsp;</span>{pr}{prompt && t >= prompt.at && caret ? <span style={{color: C.mint}}>▌</span> : null}
      </div>
    </div>
  );
};
