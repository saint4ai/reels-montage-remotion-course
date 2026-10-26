// Проверка обновления курса во временных репозиториях, без сети: node --test scripts/update.test.mjs
// Поднимается bare-репозиторий «origin», из него клонируется «ученик»; сеть и настоящий remote не трогаются,
// npm install в тесте не запускается (в тестовом репозитории package.json не меняется).
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'update.mjs');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'update-test-'));

function sh(cwd, ...args) {
  return execFileSync('git', args, {cwd, encoding: 'utf8'});
}

// bare «origin» с веткой main, коммит-посев, клон «ученика»
function makeCourse(base) {
  const origin = path.join(base, 'origin.git');
  const seed = path.join(base, 'seed');
  const student = path.join(base, 'student');
  fs.mkdirSync(origin, {recursive: true});
  fs.mkdirSync(seed);
  sh(origin, 'init', '--bare', '--initial-branch=main');
  sh(seed, 'init', '--initial-branch=main');
  sh(seed, 'config', 'user.email', 'test@example.com');
  sh(seed, 'config', 'user.name', 'test');
  fs.writeFileSync(path.join(seed, 'README.md'), '# Курс\n');
  sh(seed, 'add', '.');
  sh(seed, 'commit', '-m', 'Первый коммит');
  sh(seed, 'remote', 'add', 'origin', origin);
  sh(seed, 'push', '-u', 'origin', 'main');
  sh(base, 'clone', origin, student);
  sh(student, 'config', 'user.email', 'test@example.com');
  sh(student, 'config', 'user.name', 'test');
  return {origin, seed, student};
}

function pushCommit(seed, file, message) {
  fs.writeFileSync(path.join(seed, file), 'новое содержимое\n');
  sh(seed, 'add', '.');
  sh(seed, 'commit', '-m', message);
  sh(seed, 'push', 'origin', 'main');
}

const update = (cwd) => spawnSync(process.execPath, [SCRIPT], {cwd, encoding: 'utf8'});

test('обновление подтягивается с темой коммита, повторный запуск видит «Обновлений нет»', () => {
  const base = tmp();
  const {origin, seed, student} = makeCourse(base);
  pushCommit(seed, 'LESSON.md', 'Новый урок про раскадровку');
  const first = update(student);
  assert.equal(first.status, 0, `${first.stdout}\n${first.stderr}`);
  assert.match(first.stdout, /Курс обновлён: 1 изменений/);
  assert.match(first.stdout, /Новый урок про раскадровку/);
  assert.ok(fs.existsSync(path.join(student, 'LESSON.md')));
  const second = update(student);
  assert.equal(second.status, 0, `${second.stdout}\n${second.stderr}`);
  assert.match(second.stdout, /Обновлений нет/);
});

test('правка отслеживаемого файла и файл в work/ переживают обновление', () => {
  const base = tmp();
  const {origin, seed, student} = makeCourse(base);
  pushCommit(seed, 'GUIDE.md', 'Новый гайд');
  fs.writeFileSync(path.join(student, 'README.md'), '# Курс\n\nвладелец поправил\n');
  fs.mkdirSync(path.join(student, 'work'), {recursive: true});
  fs.writeFileSync(path.join(student, 'work', 'brief.md'), 'профиль владельца');
  const r = update(student);
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /Курс обновлён/);
  assert.equal(fs.readFileSync(path.join(student, 'README.md'), 'utf8'), '# Курс\n\nвладелец поправил\n');
  assert.equal(fs.readFileSync(path.join(student, 'work', 'brief.md'), 'utf8'), 'профиль владельца');
  assert.ok(fs.existsSync(path.join(student, 'GUIDE.md')));
});

test('remote на несуществующий путь: выход 0 и «Нет связи с GitHub»', () => {
  const base = tmp();
  const {student} = makeCourse(base);
  sh(student, 'remote', 'set-url', 'origin', path.join(base, 'нет-такого-репозитория'));
  const r = update(student);
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  assert.match(`${r.stdout}\n${r.stderr}`, /Нет связи с GitHub/);
  assert.match(`${r.stdout}\n${r.stderr}`, /обновление пропущено/);
});

test('не git-папка: выход 0 и «Это не папка курса»', () => {
  const r = update(tmp());
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  assert.match(`${r.stdout}\n${r.stderr}`, /Это не папка курса/);
});
