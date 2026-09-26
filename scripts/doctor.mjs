// Проверка рабочего места: npm run doctor. Всё должно быть OK до начала монтажа.
import {execFileSync} from 'node:child_process';
import {existsSync, readdirSync, statfsSync} from 'node:fs';

const checks = [];
const ok = (cond, label, fix = '') => checks.push({cond, label, fix});
const has = (cmd, args = ['-version']) => { try { execFileSync(cmd, args, {stdio: 'ignore'}); return true; } catch { return false; } };

const major = Number(process.versions.node.split('.')[0]);
ok(major >= 20, `Node.js ${process.versions.node} (нужен 20+)`, 'поставь Node.js 20+ с nodejs.org');
ok(existsSync('node_modules/remotion'), 'зависимости установлены', 'npm install');
ok(has('ffmpeg'), 'ffmpeg', 'Windows: winget install ffmpeg; macOS: brew install ffmpeg; Linux: sudo apt install ffmpeg');
ok(has('ffprobe'), 'ffprobe', 'ставится вместе с ffmpeg');
ok(existsSync('src/index.ts') && existsSync('src/Root.tsx'), 'студия Remotion (src/index.ts)');
ok(existsSync('.claude/skills/onai-montage/SKILL.md'), 'навык агента .claude/skills/onai-montage/SKILL.md');
ok(existsSync('public/fonts') && readdirSync('public/fonts').length >= 10, 'шрифты public/fonts');
ok(existsSync('public/sfx') && readdirSync('public/sfx').filter((f) => f.endsWith('.wav')).length >= 20, 'звуки public/sfx');
ok(existsSync('.whisper') || true, existsSync('.whisper') ? 'whisper.cpp уже скачан (.whisper)' : 'whisper.cpp скачается при первой расшифровке (~1,5 ГБ модель medium)');
try { const s = statfsSync('.'); const gb = (s.bavail * s.bsize) / 1e9; ok(gb > 8, `свободно на диске ${gb.toFixed(0)} ГБ (нужно от 8)`, 'освободи место: рендер и модель whisper занимают несколько ГБ'); } catch { /* старые Node */ }

let failed = false;
for (const c of checks) {
  console.log(`${c.cond ? 'OK  ' : 'FAIL'}  ${c.label}${!c.cond && c.fix ? `  →  ${c.fix}` : ''}`);
  failed ||= !c.cond;
}
if (failed) { console.error('\nИсправь FAIL и запусти npm run doctor ещё раз.'); process.exit(1); }
console.log('\nРабочее место готово. Дальше: npm run studio (просмотр) или npm run new -- <slug> <СТИЛЬ|custom>.');
