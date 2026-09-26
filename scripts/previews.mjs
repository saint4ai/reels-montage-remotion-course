// Доска стилей движка: node scripts/previews.mjs [секунда=5]
// Рендерит <СТИЛЬ>-Reels на одной секунде демо и склеивает в public/style-previews/styles.jpg с подписями.
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {bundle} from '@remotion/bundler';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import {enableTailwind} from '@remotion/tailwind-v4';

const sec = Number(process.argv[2] ?? 5);
const IDS = ['PRISM', 'ORBIT', 'TRACE', 'PULSE', 'GLASS', 'PORTRAIT', 'APPLE', 'PODCAST', 'EXPERT'];
mkdirSync('out/previews', {recursive: true});
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts'), webpackOverride: (c) => enableTailwind(c)});
const browser = await openBrowser('chrome');
const files = [];
for (const id of IDS) {
  const composition = await selectComposition({serveUrl, id: `${id}-Reels`, puppeteerInstance: browser});
  const out = `out/previews/${id}.png`;
  await renderStill({serveUrl, composition, frame: Math.min(composition.durationInFrames - 1, Math.round(sec * composition.fps)), scale: 0.25, puppeteerInstance: browser, output: out});
  files.push([id, out]);
}
await browser.close({silent: true});
const font = path.resolve('public/fonts/Manrope-Variable.ttf');
const args = [], parts = [];
files.forEach(([id, f], i) => { args.push('-i', f); parts.push(`[${i}:v]scale=360:640,pad=360:700:0:60:color=0x111316,drawtext=fontfile=${font}:text='${i + 1} ${id}':fontcolor=white:fontsize=26:x=12:y=16[c${i}]`); });
const cols = 5, term = (n, v) => (n === 0 ? '0' : Array(n).fill(v).join('+'));
const lay = files.map((_, i) => `${term(i % cols, 'w0')}_${term(Math.floor(i / cols), 'h0')}`).join('|');
execFileSync('ffmpeg', ['-v', 'error', '-y', ...args, '-filter_complex', `${parts.join(';')};${files.map((_, i) => `[c${i}]`).join('')}xstack=inputs=${files.length}:layout=${lay}:fill=0x111316[o]`, '-map', '[o]', '-q:v', '3', 'public/style-previews/styles.jpg']);
console.log('готово: public/style-previews/styles.jpg');
