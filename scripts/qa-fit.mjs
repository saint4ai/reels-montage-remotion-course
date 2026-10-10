// Проверка контейнеров: каждые 0,5 с ролика рендерит кадр в режиме qa и собирает сообщения [fit] из браузера.
// Код выхода 1, если хоть один контейнер переполнен или прижат к краю.
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import {withBundle} from './with-bundle.mjs';

const id = process.argv[2] ?? 'ConnectorsRoute';
const inputProps = {qa: true};

// сборка живёт только внутри withBundle: папка во временной памяти убирается в finally, даже если проверка упала
const failed = await withBundle(process.env.ENTRY ?? 'src/index.ts', async (serveUrl) => {
  const browser = await openBrowser('chrome');
  try {
    const composition = await selectComposition({serveUrl, id, inputProps, puppeteerInstance: browser});
    const step = Math.max(1, Math.round(composition.fps * 0.5));
    const found = new Map();
    for (let frame = 0; frame < composition.durationInFrames; frame += step) {
      await renderStill({serveUrl, composition, frame, inputProps, scale: 0.25, puppeteerInstance: browser,
        output: `out/qa/${id}-${String(frame).padStart(4, '0')}.png`,
        onBrowserLog: (log) => {
          if (!log.text.includes('[fit]')) return;
          const key = log.text.split(':')[0] + ':' + log.text.split(':')[1];
          if (!found.has(key)) found.set(key, {first: frame, text: log.text});
        }});
    }
    const frames = Math.ceil(composition.durationInFrames / step);
    // длительность композиции видна сразу: если она не совпадает с записью, проверен не весь ролик
    const seconds = (composition.durationInFrames / composition.fps).toFixed(1);
    if (found.size) {
      console.log(`FIT FAIL ${id}: ${found.size} контейнер(ов), проверено кадров ${frames} (композиция ${seconds} с)`);
      for (const [, v] of found) console.log(`  кадр ${v.first}: ${v.text}`);
      return true;
    }
    console.log(`FIT PASS ${id}: проверено кадров ${frames}, композиция ${seconds} с, переполнений и прижатых полей нет`);
    return false;
  } finally {
    await browser.close({silent: true});
  }
});
if (failed) process.exitCode = 1;
