// Папка ролика в OneDrive для чата «Скрипты для Reels»:
//   node scripts/reel-folder.mjs --title "Название ролика" --caption "Подпись под видео" [--tiktok "Другая подпись для TikTok"] [--slug google-tables] [--root <папка OneDrive>]
// Создаёт <OneDrive>/Reels/<номер> <название>/ с подпапками «Раздаточный материал» и «Запись» и файлом «<название> - описание.txt».
// Путь OneDrive находит сам: Windows переменные OneDrive и OneDriveConsumer, macOS папка ~/Library/CloudStorage/OneDrive-*.
// Рабочий OneDrive (OneDriveCommercial, OneDrive-<фирма>) не берётся. Повторный запуск с тем же названием ничего не затирает.
// OneDrive не найден: с --slug создаёт work/<slug>/materials/ и описание в work/<slug>/, код выхода 3.
import {existsSync, mkdirSync, readdirSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const MATERIALS = 'Раздаточный материал';
const RECORDING = 'Запись';

// путь к личному OneDrive или null
export function findOneDrive({env = process.env, platform = process.platform, home = os.homedir(), exists = existsSync, readdir = readdirSync} = {}) {
  if (platform === 'win32') {
    for (const k of ['OneDrive', 'OneDriveConsumer']) if (env[k] && exists(env[k])) return env[k];
    return null;
  }
  if (platform === 'darwin') {
    const cloud = path.join(home, 'Library', 'CloudStorage');
    if (exists(cloud)) {
      const dirs = readdir(cloud).filter((n) => /^OneDrive-/i.test(n));
      if (dirs.length === 1) return path.join(cloud, dirs[0]);
      // у владельца может быть рабочий и личный: берём только личный, иначе пусть решает человек
      const personal = dirs.find((n) => /^OneDrive-Personal$/i.test(n));
      if (personal) return path.join(cloud, personal);
      if (dirs.length > 1) return null;
    }
    const old = path.join(home, 'OneDrive');
    return exists(old) ? old : null;
  }
  const lin = path.join(home, 'OneDrive');
  return exists(lin) ? lin : null;
}

// имя папки без символов, которые OneDrive не принимает, и без точки или пробела в конце
export function safeName(title) {
  const s = String(title ?? '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 80).trim();
  if (!s) throw new Error('нужно название ролика (--title)');
  return s;
}

// следующий свободный двузначный номер по именам вида «NN Название»
export function nextNumber(names) {
  let max = 0;
  for (const n of names) {
    const m = /^(\d{1,3})\s/.exec(n);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return String(max + 1).padStart(2, '0');
}

export function descriptionText({instagram, tiktok}) {
  const ig = String(instagram ?? '').trim();
  const tt = String(tiktok ?? '').trim() || ig;
  return `Instagram\n${ig || 'Подпись пока не написана.'}\n\nTikTok\n${tt || 'Подпись пока не написана.'}\n`;
}

// создаёт папку ролика (или находит уже созданную по названию), существующие файлы не трогает
export function createReelFolder({root, title, instagram, tiktok}) {
  const name = safeName(title);
  const reels = path.join(root, 'Reels');
  mkdirSync(reels, {recursive: true});
  const entries = readdirSync(reels, {withFileTypes: true}).filter((e) => e.isDirectory()).map((e) => e.name);
  const same = entries.find((n) => n.replace(/^\d+\s+/, '').toLowerCase() === name.toLowerCase());
  const folder = same ?? `${nextNumber(entries)} ${name}`;
  const dir = path.join(reels, folder);
  mkdirSync(path.join(dir, MATERIALS), {recursive: true});
  mkdirSync(path.join(dir, RECORDING), {recursive: true});
  const file = path.join(dir, `${name} - описание.txt`);
  const wrote = !existsSync(file);
  if (wrote) writeFileSync(file, descriptionText({instagram, tiktok}));
  return {dir, folder, materials: path.join(dir, MATERIALS), recording: path.join(dir, RECORDING), descriptionFile: file, existed: Boolean(same), wroteDescription: wrote};
}

// запасной вариант без OneDrive: материалы в work/<slug>/materials/, описание в work/<slug>/
export function createFallback({cwd, slug, title, instagram, tiktok}) {
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(slug ?? '')) throw new Error('для запасного варианта нужен --slug латиницей: строчные буквы, цифры, дефис');
  const name = safeName(title);
  const dir = path.join(cwd, 'work', slug);
  const materials = path.join(dir, 'materials');
  mkdirSync(materials, {recursive: true});
  const file = path.join(dir, `${name} - описание.txt`);
  const wrote = !existsSync(file);
  if (wrote) writeFileSync(file, descriptionText({instagram, tiktok}));
  return {dir, materials, descriptionFile: file, wroteDescription: wrote};
}

export function parseArgs(argv) {
  const o = {};
  const map = {'--title': 'title', '--caption': 'instagram', '--instagram': 'instagram', '--tiktok': 'tiktok', '--slug': 'slug', '--root': 'root'};
  for (let i = 0; i < argv.length; i++) {
    const key = map[argv[i]];
    if (!key) throw new Error(`неизвестный параметр ${argv[i]}`);
    if (i + 1 >= argv.length) throw new Error(`после ${argv[i]} нужно значение`);
    o[key] = argv[++i];
  }
  return o;
}

export function main(argv, {env = process.env, cwd = process.cwd(), platform = process.platform, home = os.homedir(), log = console.log} = {}) {
  let o;
  try { o = parseArgs(argv); safeName(o.title); } catch (e) { log(`Ошибка: ${e.message}`); return 2; }
  const root = o.root ?? findOneDrive({env, platform, home});
  if (root) {
    if (!existsSync(root)) { log(`Папка ${root} не найдена.`); return 2; }
    const r = createReelFolder({root, title: o.title, instagram: o.instagram, tiktok: o.tiktok});
    log(`${r.existed ? 'Папка ролика уже была' : 'Папка ролика создана'}: ${r.dir}`);
    log(`Материалы: ${r.materials}`);
    log(`Запись (для владельца): ${r.recording}`);
    log(`Описание: ${r.descriptionFile}${r.wroteDescription ? '' : ' (уже было, не трогаю)'}`);
    return 0;
  }
  log('OneDrive не найден (нет переменной OneDrive на Windows или папки OneDrive-… на Mac). Инструкция для владельца: docs/guides/onedrive.md');
  if (!o.slug) { log('Передай --slug <латиницей>, чтобы пока работать в work/<slug>/.'); return 3; }
  const f = createFallback({cwd, slug: o.slug, title: o.title, instagram: o.instagram, tiktok: o.tiktok});
  log(`Работаем без OneDrive. Материалы: ${f.materials}`);
  log(`Описание: ${f.descriptionFile}${f.wroteDescription ? '' : ' (уже было, не трогаю)'}`);
  return 3;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
