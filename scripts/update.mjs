// Обновление курса с GitHub: npm run update
// Работа владельца не трогается: неотслеживаемые файлы git не берёт, правки отслеживаемых сохраняет автостэш.
// Ничего не удаляет: не справился сам — выходит с подсказкой агенту, без reset и checkout.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const IS_WIN = process.platform === 'win32';
const NPM = IS_WIN ? 'npm.cmd' : 'npm';

function git(cwd, args, timeout = 60_000) {
  const r = spawnSync('git', args, {cwd, encoding: 'utf8', timeout});
  return {ok: r.status === 0, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim()};
}

function shortReason(text) {
  const line = text.split('\n').map((s) => s.trim()).find(Boolean);
  return (line || 'неизвестная ошибка git').slice(0, 160);
}

function npmInstall(cwd, log) {
  const r = spawnSync(NPM, ['install'], {cwd, encoding: 'utf8', shell: IS_WIN, timeout: 600_000});
  if (r.status !== 0) {
    log(`npm install не прошёл: ${shortReason(`${r.stderr ?? ''}\n${r.stdout ?? ''}`)}`);
    return false;
  }
  return true;
}

export function run(cwd, log = () => {}) {
  if (!fs.existsSync(path.join(cwd, '.git'))) {
    log('Это не папка курса, обновление пропущено');
    return 0;
  }
  const remote = git(cwd, ['remote', 'get-url', 'origin']);
  if (!remote.ok || !remote.out) {
    log('Это не папка курса, обновление пропущено');
    return 0;
  }
  const fetch = git(cwd, ['fetch', 'origin'], 20_000);
  if (!fetch.ok) {
    log('Нет связи с GitHub, обновление пропущено. Работать можно дальше');
    return 0;
  }
  const head = git(cwd, ['rev-parse', 'HEAD']);
  const upstream = git(cwd, ['rev-parse', 'origin/main']);
  if (!head.ok || !upstream.ok) {
    log('Нет связи с GitHub, обновление пропущено. Работать можно дальше');
    return 0;
  }
  if (head.out === upstream.out || git(cwd, ['merge-base', '--is-ancestor', 'origin/main', 'HEAD']).ok) {
    log('Обновлений нет');
    return 0;
  }
  const oldHead = head.out;
  const pull = git(cwd, ['pull', '--ff-only', '--autostash', 'origin', 'main'], 300_000);
  if (!pull.ok) {
    log(`Не получилось обновить автоматически: ${shortReason(pull.err)}`);
    log('Агент: сохрани изменения владельца (git stash list, git status), затем обнови вручную и верни их; владельцу скажи одной фразой, что обновляешь курс');
    return 1;
  }
  const newHead = git(cwd, ['rev-parse', 'HEAD']).out;
  const changed = git(cwd, ['diff', '--name-only', `${oldHead}..${newHead}`]).out.split('\n').filter(Boolean);
  if (changed.includes('package.json') || changed.includes('package-lock.json')) {
    log('Обновились зависимости, ставлю пакеты…');
    if (!npmInstall(cwd, log)) return 1;
  }
  const count = git(cwd, ['rev-list', '--count', `${oldHead}..${newHead}`]).out || '?';
  log(`Курс обновлён: ${count} изменений`);
  const subjects = git(cwd, ['log', '--format=%s', `${oldHead}..${newHead}`]).out.split('\n').filter(Boolean);
  for (const s of subjects.slice(0, 10)) log(s);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(run(process.cwd(), (s) => console.log(s)));
}
