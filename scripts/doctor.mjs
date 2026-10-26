// Проверка рабочего места: npm run doctor. Всё должно быть OK до начала монтажа.
import {execFileSync} from 'node:child_process';
import {existsSync, readdirSync, statfsSync} from 'node:fs';

const checks = [];
// ok: без этого монтаж не начать (FAIL). advice: нужно чатам «Скрипты для Reels» и «Instagram AI-менеджер», монтаж идёт и без этого (WARN)
const ok = (cond, label, fix = '') => checks.push({cond, label, fix});
const advice = (cond, label, fix = '') => checks.push({cond, label, fix, soft: true});
const has = (cmd, args = ['-version']) => { try { execFileSync(cmd, args, {stdio: 'ignore'}); return true; } catch { return false; } };

// Версия Python как [major, minor] или null. На Windows настоящий Python зовётся python или py, на macOS и Linux python3.
// Заглушка Microsoft Store версии не печатает, поэтому она считается отсутствием Python.
const pythonVersion = () => {
  const variants = process.platform === 'win32'
    ? [['python', ['--version']], ['py', ['-3', '--version']]]
    : [['python3', ['--version']], ['python', ['--version']]];
  for (const [cmd, args] of variants) {
    try {
      const out = execFileSync(cmd, args, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
      const m = /Python (\d+)\.(\d+)/.exec(out);
      if (m) return [Number(m[1]), Number(m[2])];
    } catch { /* пробуем следующий вариант */ }
  }
  return null;
};

// Git Bash на Windows ищем по обычным местам установки: bash из System32 это заглушка WSL, она не годится
const gitBashFound = () => {
  if (process.platform !== 'win32') return has('bash', ['--version']);
  const roots = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA && `${process.env.LOCALAPPDATA}\\Programs`].filter(Boolean);
  return roots.some((root) => existsSync(`${root}\\Git\\bin\\bash.exe`));
};

const major = Number(process.versions.node.split('.')[0]);
ok(major >= 20, `Node.js ${process.versions.node} (нужен 20+)`, 'поставь Node.js 20+ с nodejs.org');
ok(existsSync('node_modules/remotion'), 'зависимости установлены', 'npm install');
ok(has('ffmpeg'), 'ffmpeg', 'Windows: winget install Gyan.FFmpeg; macOS: brew install ffmpeg (нет brew: .claude/skills/onai-montage/reference/01-setup.md); Linux: sudo apt install ffmpeg');
ok(has('ffprobe'), 'ffprobe', 'ставится вместе с ffmpeg');
ok(existsSync('src/index.ts') && existsSync('src/Root.tsx'), 'студия Remotion (src/index.ts)');
ok(existsSync('.claude/skills/onai-montage/SKILL.md'), 'навык агента .claude/skills/onai-montage/SKILL.md');
ok(existsSync('public/fonts') && readdirSync('public/fonts').length >= 10, 'шрифты public/fonts');
ok(existsSync('public/sfx') && readdirSync('public/sfx').filter((f) => f.endsWith('.wav')).length >= 20, 'звуки public/sfx');
// whisper.cpp качается при первой расшифровке, поэтому его отсутствие не ошибка: это только справка
ok(true, existsSync('.whisper') ? 'whisper.cpp уже скачан (.whisper)' : 'whisper.cpp скачается при первой расшифровке (~1,5 ГБ модель medium)');
ok(has('git', ['--version']), 'Git', 'Windows: winget install Git.Git; macOS: xcode-select --install');
const py = pythonVersion();
ok(py !== null && (py[0] > 3 || (py[0] === 3 && py[1] >= 11)),
  py ? `Python ${py[0]}.${py[1]} (нужен 3.11+: проверка сценария и ассистент в директе)` : 'Python (нужен 3.11+: проверка сценария и ассистент в директе)',
  'Windows: winget install Python.Python.3.13; macOS: brew install python (нет brew: .claude/skills/onai-montage/reference/01-setup.md)');
advice(gitBashFound(), process.platform === 'win32' ? 'Git Bash (установка ассистента на сервер)' : 'bash (установка ассистента на сервер)',
  'Windows: winget install Git.Git (Git Bash ставится вместе с ним); bash.exe из System32 это WSL, он не годится');
advice(has('ssh', ['-V']), 'ssh (установка ассистента на сервер)',
  'Windows: Параметры, Приложения, Дополнительные компоненты, OpenSSH-клиент; на macOS и Linux ssh уже есть');
try { const s = statfsSync('.'); const gb = (s.bavail * s.bsize) / 1e9; ok(gb > 8, `свободно на диске ${gb.toFixed(0)} ГБ (нужно от 8)`, 'освободи место: рендер и модель whisper занимают несколько ГБ'); } catch { /* старые Node */ }

let failed = false;
let warned = false;
for (const c of checks) {
  const mark = c.cond ? 'OK  ' : c.soft ? 'WARN' : 'FAIL';
  console.log(`${mark}  ${c.label}${!c.cond && c.fix ? `  →  ${c.fix}` : ''}`);
  if (!c.cond) { if (c.soft) warned = true; else failed = true; }
}
if (failed) { console.error('\nИсправь FAIL и запусти npm run doctor ещё раз.'); process.exit(1); }
if (warned) console.log('\nWARN не мешает монтажу: эти программы понадобятся, когда дойдёшь до установки ассистента на сервер.');
console.log('\nРабочее место готово. Дальше: npm run studio (просмотр) или npm run new -- <slug> <СТИЛЬ|custom>.');
