// Проверка создания папки ролика в OneDrive во временных папках: npm run reel-folder:test
// Настоящий OneDrive владельца не трогается: корень всегда временный, переменные окружения и домашняя папка подменяются.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createFallback, createReelFolder, descriptionText, findOneDrive, main, nextNumber, parseArgs, safeName} from './reel-folder.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'reel-folder-test-'));

test('Windows: берётся OneDrive, затем OneDriveConsumer; несуществующий путь и рабочий OneDrive не берутся', () => {
  const a = tmp();
  const b = tmp();
  assert.equal(findOneDrive({platform: 'win32', env: {OneDrive: a, OneDriveConsumer: b}}), a);
  assert.equal(findOneDrive({platform: 'win32', env: {OneDrive: path.join(a, 'нет'), OneDriveConsumer: b}}), b);
  assert.equal(findOneDrive({platform: 'win32', env: {OneDriveCommercial: a}}), null);
  assert.equal(findOneDrive({platform: 'win32', env: {}}), null);
});

test('macOS: одна папка OneDrive-… берётся, при двух только личная, иначе null', () => {
  const home = tmp();
  const cloud = path.join(home, 'Library', 'CloudStorage');
  fs.mkdirSync(path.join(cloud, 'OneDrive-Personal'), {recursive: true});
  assert.equal(findOneDrive({platform: 'darwin', home}), path.join(cloud, 'OneDrive-Personal'));
  fs.mkdirSync(path.join(cloud, 'OneDrive-Firma'));
  assert.equal(findOneDrive({platform: 'darwin', home}), path.join(cloud, 'OneDrive-Personal'));
  fs.rmSync(path.join(cloud, 'OneDrive-Personal'), {recursive: true});
  fs.mkdirSync(path.join(cloud, 'OneDrive-Vtoraya'));
  assert.equal(findOneDrive({platform: 'darwin', home}), null);
  const empty = tmp();
  assert.equal(findOneDrive({platform: 'darwin', home: empty}), null);
  fs.mkdirSync(path.join(empty, 'OneDrive'));
  assert.equal(findOneDrive({platform: 'darwin', home: empty}), path.join(empty, 'OneDrive'));
});

test('название: недопустимые символы убираются, пустое название и точка в конце', () => {
  assert.equal(safeName('Claude: таблицы? "Да" | нет'), 'Claude таблицы Да нет');
  assert.equal(safeName('  Ролик...  '), 'Ролик');
  assert.throws(() => safeName(' ?? '), /название/);
  assert.equal(safeName('а'.repeat(200)).length, 80);
});

test('номер: следующий свободный, файлы и чужие имена не мешают', () => {
  assert.equal(nextNumber([]), '01');
  assert.equal(nextNumber(['01 Сайт', '02 ИИ', 'readme.txt', 'Без номера', '10 Десятый']), '11');
  assert.equal(nextNumber(['9 Девять']), '10');
});

test('папка ролика: структура, номер по соседям, описание обычным текстом', () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, 'Reels', '01 Старый ролик'), {recursive: true});
  fs.writeFileSync(path.join(root, 'Reels', '01 Старый ролик', 'важный.txt'), 'не трогать');
  const r = createReelFolder({root, title: 'Claude в таблицах', instagram: 'Таблица считает сама. #ии #таблицы', tiktok: 'Версия для TikTok'});
  assert.equal(r.folder, '02 Claude в таблицах');
  assert.ok(fs.statSync(path.join(r.dir, 'Раздаточный материал')).isDirectory());
  assert.ok(fs.statSync(path.join(r.dir, 'Запись')).isDirectory());
  assert.deepEqual(fs.readdirSync(path.join(r.dir, 'Запись')), []);
  const text = fs.readFileSync(path.join(r.dir, 'Claude в таблицах - описание.txt'), 'utf8');
  assert.equal(text, 'Instagram\nТаблица считает сама. #ии #таблицы\n\nTikTok\nВерсия для TikTok\n');
  assert.equal(fs.readFileSync(path.join(root, 'Reels', '01 Старый ролик', 'важный.txt'), 'utf8'), 'не трогать');
});

test('повторный запуск находит ту же папку, не плодит новую и не затирает описание', () => {
  const root = tmp();
  const a = createReelFolder({root, title: 'Мой ролик', instagram: 'первая подпись'});
  fs.writeFileSync(a.descriptionFile, 'владелец поправил подпись');
  fs.writeFileSync(path.join(a.recording, 'запись.mp4'), 'видео');
  const b = createReelFolder({root, title: 'мой ролик', instagram: 'другая подпись'});
  assert.equal(b.dir, a.dir);
  assert.equal(b.existed, true);
  assert.equal(b.wroteDescription, false);
  assert.equal(fs.readFileSync(a.descriptionFile, 'utf8'), 'владелец поправил подпись');
  assert.ok(fs.existsSync(path.join(a.recording, 'запись.mp4')));
  assert.equal(fs.readdirSync(path.join(root, 'Reels')).length, 1);
});

test('описание: одна подпись идёт в обе площадки, пустая подпись помечена', () => {
  assert.equal(descriptionText({instagram: 'текст'}), 'Instagram\nтекст\n\nTikTok\nтекст\n');
  assert.match(descriptionText({}), /Подпись пока не написана/);
});

test('без OneDrive: запасная папка work/<slug>/materials и код 3; без slug только подсказка', () => {
  const cwd = tmp();
  const log = [];
  assert.equal(main(['--title', 'Ролик', '--caption', 'подпись', '--slug', 'my-reel'], {env: {}, cwd, platform: 'win32', log: (s) => log.push(s)}), 3);
  assert.ok(fs.statSync(path.join(cwd, 'work', 'my-reel', 'materials')).isDirectory());
  assert.ok(fs.existsSync(path.join(cwd, 'work', 'my-reel', 'Ролик - описание.txt')));
  assert.match(log.join('\n'), /onedrive\.md/);
  const log2 = [];
  assert.equal(main(['--title', 'Ролик'], {env: {}, cwd: tmp(), platform: 'win32', log: (s) => log2.push(s)}), 3);
  assert.match(log2.join('\n'), /--slug/);
  assert.throws(() => createFallback({cwd, slug: '../плохо', title: 'x'}), /slug/);
});

test('основной сценарий через main с корнем OneDrive из переменной окружения', () => {
  const root = tmp();
  const log = [];
  assert.equal(main(['--title', 'Третий: ролик', '--caption', 'подпись'], {env: {OneDrive: root}, cwd: tmp(), platform: 'win32', log: (s) => log.push(s)}), 0);
  assert.ok(fs.existsSync(path.join(root, 'Reels', '01 Третий ролик', 'Запись')));
  assert.match(log.join('\n'), /Папка ролика создана/);
});

test('ошибки параметров: код 2', () => {
  const log = () => {};
  assert.equal(main([], {env: {}, cwd: tmp(), log}), 2);
  assert.equal(main(['--title'], {env: {}, cwd: tmp(), log}), 2);
  assert.equal(main(['--nope', 'x'], {env: {}, cwd: tmp(), log}), 2);
  assert.equal(main(['--title', 'А', '--root', path.join(tmp(), 'нет')], {env: {}, cwd: tmp(), log}), 2);
  assert.deepEqual(parseArgs(['--title', 'А', '--caption', 'Б']), {title: 'А', instagram: 'Б'});
});
