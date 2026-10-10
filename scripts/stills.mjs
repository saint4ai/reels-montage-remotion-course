// Кадры по номерам для проверки переходов: node scripts/stills.mjs <Composition> <кадр> [кадр …]
// По умолчанию четверть размера (для себя); SCALE=1.5 — полный 4K для показа владельцу. Один браузер на все кадры.
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import {withBundle} from './with-bundle.mjs';

const [id, ...frames] = process.argv.slice(2);
await withBundle(process.env.ENTRY ?? 'src/index.ts', async (serveUrl) => {
  const browser = await openBrowser('chrome');
  try {
    const composition = await selectComposition({serveUrl, id, puppeteerInstance: browser});
    for (const f of frames.map(Number)) {
      await renderStill({serveUrl, composition, frame: f, scale: Number(process.env.SCALE ?? 0.25), puppeteerInstance: browser, output: `out/stills/${id}-${String(f).padStart(4, '0')}.png`});
    }
  } finally {
    await browser.close({silent: true});
  }
});
console.log(`готово: ${frames.length} кадров в out/stills`);
