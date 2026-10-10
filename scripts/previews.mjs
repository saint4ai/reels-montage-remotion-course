// Доска стилей для брифинга: node scripts/previews.mjs
// Рендерит по кадру из образца каждого стиля и склеивает в public/style-previews/styles.jpg с подписями.
// Первыми идут три стиля, которые у автора курса набирают больше всего просмотров (пометка ТОП), затем новые, затем стили движка.
// Вместо лица в образцах стоит заглушка (студийный фон и микрофон): туда встанет запись ученика.
import {execFileSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import {withBundle} from './with-bundle.mjs';

// [подпись, композиция, секунда]
const TILES = [
  ['ЭСТАФЕТА · ТОП', 'Relay-GhTricks', 8.5],
  ['13 ЭКСПЕРТ · ТОП', 'Expert2-Unlazy', 20],
  ['14 ЛИНЗА · ТОП', 'Lens-Artemis', 12],
  ['16 СИМБИОЗ', 'Symbiosis-Swap', 9],
  ['17 МИРЫ', 'Worlds-Art31', 11],
  ['5 PRISM', 'PRISM-Reels', 5],
  ['6 ORBIT', 'ORBIT-Reels', 5],
  ['7 TRACE', 'TRACE-Reels', 5],
  ['8 PULSE', 'PULSE-Reels', 5],
  ['9 СТЕКЛО', 'GLASS-Reels', 5],
  ['10 ПОРТРЕТ', 'PORTRAIT-Reels', 5],
  ['11 APPLE', 'APPLE-Reels', 5],
  ['12 ПОДКАСТ', 'PODCAST-Reels', 5],
];
// node scripts/previews.mjs <id …> перерисовать только эти кадры; --compose только склеить уже снятые
const compose = process.argv.includes('--compose');
const only = process.argv.slice(2).filter((a) => a !== '--compose');
mkdirSync('out/previews', {recursive: true});
const files = TILES.map(([label, id]) => [label, `out/previews/${id}.png`]);
if (!compose) {
  // сборка и браузер живут только внутри withBundle: временная папка убирается в finally
  await withBundle('src/index.ts', async (serveUrl) => {
    const browser = await openBrowser('chrome');
    try {
      for (const [, id, sec] of TILES) {
        if (only.length && !only.includes(id)) continue;
        const composition = await selectComposition({serveUrl, id, puppeteerInstance: browser});
        const frame = Math.min(composition.durationInFrames - 1, Math.round(sec * composition.fps));
        await renderStill({serveUrl, composition, frame, scale: 360 / composition.width, puppeteerInstance: browser, output: `out/previews/${id}.png`});
        console.log(`кадр: ${id} ${sec} с`);
      }
    } finally {
      await browser.close({silent: true});
    }
  });
}
if (only.length && !compose) process.exit(0);
// путь к шрифту относительный: на Windows ffmpeg не открывает абсолютный путь с диском и кириллицей в drawtext
const font = 'public/fonts/Manrope-Variable.ttf';
const args = [], parts = [];
files.forEach(([label, f], i) => {
  args.push('-i', f);
  parts.push(`[${i}:v]scale=360:640,pad=360:700:0:60:color=0x111316,drawtext=fontfile='${font}':text='${label}':fontcolor=white:fontsize=26:x=12:y=16[c${i}]`);
});
const cols = 5, term = (n, v) => (n === 0 ? '0' : Array(n).fill(v).join('+'));
const lay = files.map((_, i) => `${term(i % cols, 'w0')}_${term(Math.floor(i / cols), 'h0')}`).join('|');
execFileSync('ffmpeg', ['-v', 'error', '-y', ...args, '-filter_complex', `${parts.join(';')};${files.map((_, i) => `[c${i}]`).join('')}xstack=inputs=${files.length}:layout=${lay}:fill=0x111316[o]`, '-map', '[o]', '-q:v', '3', 'public/style-previews/styles.jpg']);
console.log('готово: public/style-previews/styles.jpg');
