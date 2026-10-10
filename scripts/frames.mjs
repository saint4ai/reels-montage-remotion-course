// Кадры на согласование: npm run frames -- <композиция> [шаг_секунд=2]
// Рендерит кадр каждые 2 с и последний, называет К001, К002… с таймкодом, собирает лист reviews/<id>-vNNN/sheet.jpg.
// Показывать владельцу ВСЕ кадры листа и ждать одобрения; правки — по номерам К. Новая версия — новая папка vNNN.
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readdirSync, writeFileSync} from 'node:fs';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import {withBundle} from './with-bundle.mjs';

const [id, stepArg] = process.argv.slice(2);
if (!id) { console.error('Использование: npm run frames -- <композиция> [шаг_секунд]'); process.exit(1); }
const step = Number(stepArg ?? 2);
mkdirSync('reviews', {recursive: true});
const prev = readdirSync('reviews').filter((d) => d.startsWith(`${id}-v`)).map((d) => Number(d.slice(id.length + 2))).filter(Boolean);
const ver = String((prev.length ? Math.max(...prev) : 0) + 1).padStart(3, '0');
const dir = path.join('reviews', `${id}-v${ver}`);
mkdirSync(dir, {recursive: true});

// файлы кадров называются K001.png (латиница: безопасно для ffmpeg на любой системе), подпись на листе кириллицей: К001, как во всех правках
const num = (i) => String(i + 1).padStart(3, '0');
// сборка живёт только внутри withBundle: временная папка (около 0,3 ГБ) убирается в finally
const {fps, durationInFrames, width, height, frames, files} = await withBundle('src/index.ts', async (serveUrl) => {
  const browser = await openBrowser('chrome');
  try {
    const composition = await selectComposition({serveUrl, id, puppeteerInstance: browser});
    const {fps, durationInFrames} = composition;
    const frames = [];
    for (let s = 0; s * fps < durationInFrames - 1; s += step) frames.push(Math.round(s * fps));
    frames.push(durationInFrames - 1);
    const files = [];
    for (const [i, f] of frames.entries()) {
      const out = path.join(dir, `K${num(i)}.png`);
      await renderStill({serveUrl, composition, frame: f, scale: 0.35, puppeteerInstance: browser, output: out});
      files.push({out, label: `К${num(i)}  ${(f / fps).toFixed(1)} с`});
    }
    return {fps, durationInFrames, width: composition.width, height: composition.height, frames, files};
  } finally {
    await browser.close({silent: true});
  }
});
// время каждого кадра рядом с картинками: по нему доска раскадровки (npm run board) подписывает кадры секундами
writeFileSync(path.join(dir, 'frames.json'), JSON.stringify({composition: id, fps, durationInFrames, width, height, step,
  frames: frames.map((f, i) => ({n: i + 1, frame: f, t: Math.round((f / fps) * 100) / 100}))}, null, 1));

// путь к шрифту относительный: на Windows ffmpeg не открывает абсолютный путь с диском в drawtext
const font = 'public/fonts/Manrope-Variable.ttf';
const cols = 6, cw = 300;
const args = [], parts = [];
files.forEach(({out, label}, i) => {
  args.push('-i', out);
  parts.push(`[${i}:v]scale=${cw}:-2,pad=iw:ih+48:0:48:color=0x111316,drawtext=fontfile=${font}:text='${label}':fontcolor=white:fontsize=26:x=10:y=10[c${i}]`);
});
const term = (n, v) => (n === 0 ? '0' : Array(n).fill(v).join('+'));
const lay = files.map((_, i) => `${term(i % cols, 'w0')}_${term(Math.floor(i / cols), 'h0')}`);
const filter = files.length === 1 ? `${parts[0]};[c0]copy[o]` : `${parts.join(';')};${files.map((_, i) => `[c${i}]`).join('')}xstack=inputs=${files.length}:layout=${lay.join('|')}:fill=0x000000[o]`;
execFileSync('ffmpeg', ['-v', 'error', '-y', ...args, '-filter_complex', filter, '-map', '[o]', '-q:v', '3', path.join(dir, 'sheet.jpg')]);
// длительность композиции печатаем: она должна совпадать с длиной записи, иначе лист покрывает не весь ролик
console.log(`Композиция ${id}: ${(durationInFrames / fps).toFixed(1)} с, ${fps} к/с. Кадров: ${files.length} (каждые ${step} с + последний). Лист: ${path.join(dir, 'sheet.jpg')}. Статус: AWAITING_FRAME_APPROVAL.`);
if (!existsSync(path.join(dir, 'sheet.jpg'))) process.exit(1);
