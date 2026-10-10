// Рендер с выравниванием громкости: npm run draft|render|render:4k -- <композиция>
//   draft — 720p 10 Мбит/с, показать владельцу; final — 2K 1440×2560 (по умолчанию);
//   4k — 2160×3840, только по просьбе владельца (рендер ~1,7× дольше).
// Битрейт финала и 4K: меньшее из 46 Мбит/с и 2240 / длительность в секундах, чтобы файл был до 300 МБ (лимит автовыкладки).
// Финал запускать ТОЛЬКО после одобрения кадров и черновика. Результат: out/<id>-<режим>.mp4, громкость −14 LUFS.
import {execFileSync, spawnSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';

const [mode, id] = process.argv.slice(2);
const MODES = {draft: {scale: 0.5}, final: {scale: 1}, '4k': {scale: 1.5}};
if (!MODES[mode] || !id) { console.error('Использование: npm run draft|render|render:4k -- <композиция>'); process.exit(1); }
const {scale} = MODES[mode];
// длительность композиции из списка студии: строка вида «<id> 60 1440x2560 2880 (48.00 sec)»
const list = spawnSync('npx', ['remotion', 'compositions', 'src/index.ts'], {encoding: 'utf8', shell: process.platform === 'win32'});
const row = (list.stdout || '').split('\n').find((l) => l.trim().split(/\s+/)[0] === id);
const sec = Number(row?.match(/\(([\d.]+) sec\)/)?.[1]);
if (!sec) { console.error(`Не нашёл композицию ${id} в списке студии (npx remotion compositions src/index.ts).`); process.exit(1); }
const bitrate = mode === 'draft' ? '10M' : `${Math.min(46, Math.floor(2240 / sec))}M`;
console.log(`${id}: ${sec} с, битрейт ${bitrate}`);
mkdirSync('out', {recursive: true});
const raw = `out/${id}-${mode}-raw.mp4`, fin = `out/${id}-${mode}.mp4`;
const t0 = Date.now();
const r = spawnSync('npx', ['remotion', 'render', 'src/index.ts', id, raw, `--scale=${scale}`, `--video-bitrate=${bitrate}`, '--concurrency=2', '--log=error'], {stdio: 'inherit', shell: process.platform === 'win32'});
if (r.status !== 0) { console.error('Рендер упал: смотри ошибку выше.'); process.exit(r.status ?? 1); }
console.log(`Рендер ${((Date.now() - t0) / 60000).toFixed(1)} мин. Громкость → −14 LUFS…`);
execFileSync(process.execPath, ['scripts/master.mjs', raw, fin], {stdio: 'inherit'});
const black = spawnSync('ffmpeg', ['-v', 'info', '-i', fin, '-vf', 'scale=360:-2,blackdetect=d=0.1:pix_th=0.04', '-an', '-f', 'null', '-'], {encoding: 'utf8'});
const n = (black.stderr.match(/black_start/g) || []).length;
console.log(n ? `ВНИМАНИЕ: чёрных отрезков ${n} — проверь стыки.` : 'Чёрных кадров нет.');
console.log(`Готово: ${fin}`);
