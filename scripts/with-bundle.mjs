// Общая сборка Remotion для скриптов кадров (qa, frames, stills, guides, previews).
// bundle() копирует всю public/ (сотни МБ вместе с твоей записью) в папку remotion-webpack-bundle-* во временной папке
// и сам её не убирает: каждый запуск оставлял бы около 0,3 ГБ. withBundle убирает папку в finally, а также при Ctrl+C.
import path from 'node:path';
import {rmSync} from 'node:fs';
import {bundle} from '@remotion/bundler';
import {enableTailwind} from '@remotion/tailwind-v4';

// run(serveUrl) выполняется, пока сборка нужна; её результат возвращается. bundleFn подменяют только при проверке самого помощника.
export async function withBundle(entry, run, bundleFn = bundle) {
  const serveUrl = await bundleFn({entryPoint: path.resolve(entry), webpackOverride: (c) => enableTailwind(c)});
  const clean = () => {
    try { rmSync(serveUrl, {recursive: true, force: true}); } catch { /* файл занят: папку уберёт чистка временных файлов */ }
  };
  const onSignal = () => { clean(); process.exit(130); };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  try {
    return await run(serveUrl);
  } finally {
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
    clean();
  }
}
