// Картинки инструкций docs/guides/img/guide-0N.png из композиций Guide-01 … Guide-06 (папка Guides в студии).
// Одна сборка и один браузер на все картинки: node scripts/guides.mjs [Guide-01 …]. Полный размер 1600×1100.
import fs from 'node:fs';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import {enableTailwind} from '@remotion/tailwind-v4';

const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['Guide-01', 'Guide-02', 'Guide-03', 'Guide-04', 'Guide-05', 'Guide-06'];
const out = path.resolve('docs/guides/img');
fs.mkdirSync(out, {recursive: true});
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts'), webpackOverride: (c) => enableTailwind(c)});
const browser = await openBrowser('chrome');
for (const id of ids) {
  const composition = await selectComposition({serveUrl, id, puppeteerInstance: browser});
  const file = path.join(out, `${id.toLowerCase()}.png`);
  await renderStill({serveUrl, composition, frame: 0, scale: 1, puppeteerInstance: browser, output: file});
  console.log(`готово: ${path.relative(process.cwd(), file)}`);
}
await browser.close({silent: true});
