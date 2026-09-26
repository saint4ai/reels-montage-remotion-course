// Новый проект: npm run new -- <slug> <PRISM|ORBIT|TRACE|PULSE|GLASS|PORTRAIT|APPLE|PODCAST|EXPERT|custom>
// Создаёт work/<slug>/ (бриф, карта монтажа, пакет на выкладку), public/work/<slug>/ для записей
// и код ролика: src/projects/<slug>.ts (движок стилей) или src/reels/<slug>/ (свой ролик из шаблона), регистрирует его.
import {cpSync, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const [slug, styleArg] = process.argv.slice(2);
const STYLES = ['PRISM', 'ORBIT', 'TRACE', 'PULSE', 'GLASS', 'PORTRAIT', 'APPLE', 'PODCAST', 'EXPERT'];
if (!slug || !/^[a-z0-9][a-z0-9-]{1,40}$/.test(slug) || !styleArg) {
  console.error('Использование: npm run new -- <slug латиницей> <СТИЛЬ|custom>\nСтили: ' + STYLES.join(', ') + ', custom');
  process.exit(1);
}
const style = styleArg.toUpperCase();
if (style !== 'CUSTOM' && !STYLES.includes(style)) { console.error(`Неизвестный стиль ${styleArg}`); process.exit(1); }
const work = path.join('work', slug);
if (existsSync(work)) { console.error(`Проект уже есть: ${work}`); process.exit(1); }

mkdirSync(path.join(work), {recursive: true});
mkdirSync(path.join('public', 'work', slug), {recursive: true});
for (const f of ['brief.json', 'DIRECTION.md', 'PUBLISH.md', 'reference-profile.md']) cpSync(path.join('templates', f), path.join(work, f));
const camel = slug.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

if (style === 'CUSTOM') {
  const dir = path.join('src', 'reels', slug);
  cpSync(path.join('src', 'reels', '_template'), dir, {recursive: true});
  const reg = path.join('src', 'reels', 'index.ts');
  let s = readFileSync(reg, 'utf8');
  s = s.replace("import type React from 'react';\n", `import type React from 'react';\nimport {FPS as ${camel}Fps, SECONDS as ${camel}Sec, TemplateReel as ${camel}Reel} from './${slug}/Reel';\n`);
  s = s.replace('  // NEW-REEL', `  {id: '${slug}', component: ${camel}Reel, fps: ${camel}Fps, seconds: ${camel}Sec},\n  // NEW-REEL`);
  writeFileSync(reg, s);
  console.log(`Свой ролик: ${dir}/Reel.tsx (шаблон «половина экрана + окно в углу»), композиция «${slug}» в папке Reels.`);
} else {
  const file = path.join('src', 'projects', `${slug}.ts`);
  writeFileSync(file, `import type {ProjectData} from '../template/demo';
import {DEMO} from '../template/demo';

// Проект «${slug}» на движке стилей, стиль ${style}. Заполни по карте монтажа work/${slug}/DIRECTION.md:
// words — из расшифровки: npm run transcribe -- public/work/${slug}/voice.wav work/${slug}/words.json,
//   затем import words from '../../work/${slug}/words.json' и words в PROJECT,
// blocks — смысловые блоки (hook, list, stat, logos, flow, cta) с временем начала at по словам речи,
// speaker — {src: 'work/${slug}/speaker.mp4', w: 1440, h: 2560, headY: 1075 /* пиксель лица по высоте файла */}, plan — смены окна спикера по времени.
export const PROJECT: ProjectData = {...DEMO};
`);
  const reg = path.join('src', 'projects', 'index.ts');
  let s = readFileSync(reg, 'utf8');
  s = s.replace("import {DEMO} from '../template/demo';\n", `import {DEMO} from '../template/demo';\nimport {PROJECT as ${camel}} from './${slug}';\n`);
  s = s.replace('  // NEW-PROJECT', `  {id: '${slug}', style: '${style}', project: ${camel}},\n  // NEW-PROJECT`);
  writeFileSync(reg, s);
  console.log(`Проект на движке: ${file}, стиль ${style}, композиция «${slug}» в папке Projects.`);
}
console.log(`Материалы проекта: ${work}/ (бриф, карта монтажа, пакет на выкладку). Записи и картинки: public/work/${slug}/.`);
