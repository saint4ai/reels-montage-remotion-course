// Мастеринг звука после рендера: Remotion громкость не выравнивает. Два прохода loudnorm до −14 LUFS / ≤ −1 dBTP,
// видео копируется без перекодирования. Печатает размер, битрейт и итоговую громкость. Работает на Windows, macOS, Linux.
//   node scripts/master.mjs <raw.mp4> <final.mp4>
import {spawnSync} from 'node:child_process';

const [raw, out] = process.argv.slice(2);
if (!raw || !out) { console.error('Использование: node scripts/master.mjs <raw.mp4> <final.mp4>'); process.exit(1); }
const ff = (args) => spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args], {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});

// проход 1: замер
const m = ff(['-threads', '4', '-i', raw, '-vn', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-']);
const txt = m.stderr || '';
const json = txt.slice(txt.lastIndexOf('{'), txt.lastIndexOf('}') + 1);
let L;
try { L = JSON.parse(json); } catch { console.error('Не удалось замерить громкость. Есть ли звук в файле?\n' + txt.slice(-600)); process.exit(1); }

// проход 2: выравнивание, видео копируется
const af = `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${L.input_i}:measured_TP=${L.input_tp}:measured_LRA=${L.input_lra}:measured_thresh=${L.input_thresh}:offset=${L.target_offset}:linear=true`;
const r = ff(['-loglevel', 'error', '-y', '-threads', '4', '-i', raw, '-map', '0:v:0', '-map', '0:a:0', '-c:v', 'copy', '-af', af,
  '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', out]);
if (r.status !== 0) { console.error('Ошибка ffmpeg:\n' + (r.stderr || '').slice(-600)); process.exit(r.status ?? 1); }

// итог: размер, кадр, битрейт, громкость
const p = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,bit_rate',
  '-show_entries', 'format=duration,size', '-of', 'default=nw=1', out], {encoding: 'utf8'});
console.log((p.stdout || '').trim());
const e = ff(['-i', out, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
const lines = (e.stderr || '').split('\n').filter((l) => /^\s+(I:|Peak:)/.test(l)).slice(-2);
console.log(lines.map((l) => l.trim()).join('\n'));
