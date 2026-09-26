// Рендер с выравниванием громкости: npm run draft|render|render:4k -- <композиция>
//   draft — 720p 10 Мбит/с, показать владельцу; final — 2K 1440×2560 48 Мбит/с (по умолчанию);
//   4k — 2160×3840 80 Мбит/с, только по просьбе владельца (рендер ~1,7× дольше).
// Финал запускать ТОЛЬКО после одобрения кадров и черновика. Результат: out/<id>-<режим>.mp4, громкость −14 LUFS.
import {execFileSync, spawnSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';

const [mode, id] = process.argv.slice(2);
const MODES = {draft: {scale: 0.5, bitrate: '10M'}, final: {scale: 1, bitrate: '48M'}, '4k': {scale: 1.5, bitrate: '80M'}};
if (!MODES[mode] || !id) { console.error('Использование: npm run draft|render|render:4k -- <композиция>'); process.exit(1); }
const {scale, bitrate} = MODES[mode];
mkdirSync('out', {recursive: true});
const raw = `out/${id}-${mode}-raw.mp4`, fin = `out/${id}-${mode}.mp4`;
const t0 = Date.now();
const r = spawnSync('npx', ['remotion', 'render', 'src/index.ts', id, raw, `--scale=${scale}`, `--video-bitrate=${bitrate}`, '--concurrency=2', '--log=error'], {stdio: 'inherit'});
if (r.status !== 0) { console.error('Рендер упал: смотри ошибку выше.'); process.exit(r.status ?? 1); }
console.log(`Рендер ${((Date.now() - t0) / 60000).toFixed(1)} мин. Громкость → −14 LUFS…`);
execFileSync('bash', ['scripts/master.sh', raw, fin], {stdio: 'inherit'});
const black = spawnSync('ffmpeg', ['-v', 'info', '-i', fin, '-vf', 'scale=360:-2,blackdetect=d=0.1:pix_th=0.04', '-an', '-f', 'null', '-'], {encoding: 'utf8'});
const n = (black.stderr.match(/black_start/g) || []).length;
console.log(n ? `ВНИМАНИЕ: чёрных отрезков ${n} — проверь стыки.` : 'Чёрных кадров нет.');
console.log(`Готово: ${fin}`);
