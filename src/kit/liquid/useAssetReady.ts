import {useEffect, useState} from 'react';
import {continueRender, delayRender} from 'remotion';

// Шрифты для замеров (canvas measureText): пока шрифт не загружен, canvas меряет запасным шрифтом,
// и капсула не совпадёт со словом. Хук держит рендер кадра, пока все шрифты из списка не станут доступны,
// и перерисовывает компонент после загрузки. Пример спецификации: '800 80px "Manrope"'.
// Гонка (ролик 21, стык 6,33 с): loadFont из @remotion/fonts добавляет FontFace в document.fonts только после загрузки,
// а document.fonts.load() на ещё не добавленное семейство сразу отдаёт пустой список — строка мерилась запасным
// шрифтом и слипалась в части кадров. Поэтому ждём, пока шрифт реально найдётся (faces > 0 и check()).
// Гонка 2 (ролик 33, 28.09.2026): у семейства несколько начертаний (SF Pro Display 400…900). Пока нужное (700) ещё не
// добавлено, load() и check() отвечают по ближайшему (800) — ширины мерились им, и в одном из 4 потоков рендера подложка
// субтитров была шире на каждом четвёртом кадре. Поэтому ждём FontFace именно этого веса в статусе loaded.
const weightOk = (faceWeight: string, w: number) => {
  const [a, b] = faceWeight.split(/\s+/).map(Number);
  return Number.isFinite(b) ? w >= a && w <= b : a === w || (faceWeight === 'normal' && w === 400) || (faceWeight === 'bold' && w === 700);
};
const exactFace = (spec: string) => {
  const m = spec.match(/^(\d+)\s+[\d.]+px\s+"?([^"]+)"?$/);
  if (!m) return true;
  const w = Number(m[1]), fam = m[2];
  for (const f of document.fonts) {
    if (f.family.replace(/["']/g, '') === fam && f.status === 'loaded' && weightOk(f.weight, w)) return true;
  }
  return false;
};
const waitFont = async (spec: string) => {
  for (let i = 0; i < 400; i++) {
    const faces = await document.fonts.load(spec);
    if (faces.length > 0 && document.fonts.check(spec) && exactFace(spec)) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  console.error(`[font] не загрузился точный вес: ${spec}`);
};

export const useFontsReady = (specs: string[]) => {
  const key = specs.join('|');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const handle = delayRender(`шрифты: ${key}`);
    let alive = true;
    Promise.all(specs.map(waitFont)).then(() => {
      if (alive) setReady(true);
      continueRender(handle);
    });
    return () => { alive = false; continueRender(handle); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return ready;
};
