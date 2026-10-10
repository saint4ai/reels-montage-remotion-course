// Картинки инструкций docs/guides/img/guide-0N.png из композиций Guide-01 … Guide-06 (папка Guides в студии).
// Одна сборка и один браузер на все картинки: node scripts/guides.mjs [Guide-01 …]. Полный размер 1600×1100.
import fs from 'node:fs';
import path from 'node:path';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import {withBundle} from './with-bundle.mjs';

const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['Guide-01', 'Guide-02', 'Guide-03', 'Guide-04', 'Guide-05', 'Guide-06'];
const out = path.resolve('docs/guides/img');
fs.mkdirSync(out, {recursive: true});
await withBundle('src/index.ts', async (serveUrl) => {
  const browser = await openBrowser('chrome');
  try {
    for (const id of ids) {
      const composition = await selectComposition({serveUrl, id, puppeteerInstance: browser});
      const file = path.join(out, `${id.toLowerCase()}.png`);
      await renderStill({serveUrl, composition, frame: 0, scale: 1, puppeteerInstance: browser, output: file});
      console.log(`готово: ${path.relative(process.cwd(), file)}`);
    }
  } finally {
    await browser.close({silent: true});
  }
});
