// Доска форматов для бизнеса: node scripts/business-board.mjs
// Ничего не рендерит: режет кадры из готовых листов patterns/reels/<ролик>/frames.jpg и склеивает в
// public/style-previews/business.jpg с подписями. Нужен только ffmpeg. Запускать из корня репозитория.
// Кадры взяты из роликов автора курса на технические темы: они показывают вид формата и стиля, а не нишу ученика.
// У форматов 6 и 7 образца кадра в курсе нет, на доске для них плитка-пояснение. Появится кадр: впиши его в TILES.
import {execFileSync} from 'node:child_process';
import {mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

process.chdir(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const OUT = 'out/business-board';
const FONT = 'public/fonts/SF-Pro-Display-Medium.otf';
const FONT_BOLD = 'public/fonts/SF-Pro-Display-Bold.otf';
const R = 'patterns/reels';

const TW = 270, TH = 480; // плитка с кадром (9:16)
const CW = 600, CH = 480; // ячейка: кадр слева, текст справа
const GAP = 40, TOP = 150;
const BG = '0x111316';

// crops: [файл листа, x, y, ширина, высота] в пикселях листа; несколько вырезок ставятся друг под другом.
// fit: 'pad' для кадров не 9:16: слайд ставится по центру плитки
const TILES = [
  {
    title: ['Рилс для бизнеса', 'по методу Сейнта'], meta: '45–50 с',
    body: ['Продать одной мыслью: хук', 'с числом, решение сразу,', 'кодовое слово в конце.'],
    example: ['Пример: «Никогда не пишите', 'в смете "по факту"»'],
    source: 'Кадр: ЭСТАФЕТА 35%',
    crops: [[`${R}/relay-ghtricks/frames.jpg`, 0, 30, 218, 388]],
  },
  {
    title: ['Познавательный', 'ролик'], meta: '40–60 с',
    body: ['Ответить на вопрос', 'покупателя. Собирает', 'сохранения и доверие.'],
    example: ['Пример: «Сколько служит', 'кровля?»'],
    source: 'Кадр: СИМБИОЗ',
    crops: [[`${R}/symbiosis-swap/frames.jpg`, 360, 0, 360, 640]],
  },
  {
    title: ['Экспертный', 'ролик'], meta: '40–60 с',
    body: ['Владелец или сотрудник', 'говорит в камеру, сверху', 'доска с фактами и карточками.'],
    example: ['Пример: как делается', 'работа, по шагам'],
    source: 'Кадр: ЭКСПЕРТ',
    crops: [[`${R}/expert2-money/frames.jpg`, 540, 480, 270, 240], [`${R}/expert2-money/frames.jpg`, 540, 720, 270, 240]],
  },
  {
    title: ['Рекламный', 'креатив'], meta: '15–30 с',
    body: ['Под платное продвижение.', 'Одна мысль, один призыв,', 'хук читается без звука.'],
    example: ['Пример: оффер с цифрой,', 'призыв: слово, звонок, сайт'],
    source: 'Кадр: ПОСТЕР (огромный заголовок)',
    crops: [[`${R}/r20-techno-poster/frames.jpg`, 0, 56, 360, 640]],
  },
  {
    title: ['Карусель'], meta: '5–10 слайдов',
    body: ['Подборка по услуге или', 'реклама товара в Instagram:', 'один слайд, одна мысль.'],
    example: ['Пример: «5 признаков, что', 'кровле нужен ремонт»'],
    source: 'Кадр: язык карточек ЛИСТ',
    crops: [[`${R}/sheet-tildify/frames.jpg`, 0, 0, 240, 272]], fit: 'pad',
  },
  {
    title: ['Ролик из съёмки', 'объекта'], meta: '30–40 с',
    body: ['Есть видео с объекта на', 'телефоне. Агент собирает', 'ролик: голос, подписи,', 'схема, кадр «после».'],
    example: ['Пример: бригада сняла', 'монтаж кровли'],
    source: 'Образца кадра в курсе нет',
    placeholder: ['Образца кадра', 'в курсе нет'],
  },
  {
    title: ['Видео о товаре', '16:9'], meta: '1–2 мин',
    body: ['Серия для YouTube и сайта', 'из материалов производителя.', 'Снимать ничего не нужно.'],
    example: ['Пример: по видео на каждую', 'модель товара дилера'],
    source: 'Образца кадра в курсе нет',
    placeholder: ['Образца кадра', 'в курсе нет'],
  },
];
const NOTE = [
  'Что на доске',
  'Кадры взяты из роликов автора курса',
  'на технические темы. Они показывают,',
  'как выглядит формат и стиль, а не твою',
  'нишу. У форматов 6 и 7 образца кадра',
  'в курсе нет: они описаны словами.',
];

mkdirSync(OUT, {recursive: true});
const ff = (...a) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...a]);
const text = (name, s) => { const p = `${OUT}/${name}.txt`; writeFileSync(p, s); return p; };
// drawtext читает строку из файла: кавычки, двоеточия и запятые экранировать не нужно
const draw = (name, s, x, y, size, color, font = FONT) =>
  `drawtext=fontfile='${font}':textfile='${text(name, s)}':fontcolor=${color}:fontsize=${size}:x=${x}:y=${y}:expansion=none`;

// 1. плитки 270x480
TILES.forEach((t, i) => {
  const out = `${OUT}/tile${i + 1}.png`;
  if (t.placeholder) {
    const lines = t.placeholder.map((s, k) => draw(`ph${i}_${k}`, s, `(w-text_w)/2`, 200 + k * 34, 24, 'white'));
    ff('-f', 'lavfi', '-i', `color=c=0x1b1e22:s=${TW}x${TH}`, '-vf', lines.join(','), '-frames:v', '1', out);
    return;
  }
  const args = [], parts = [];
  t.crops.forEach(([file, x, y, w, h], k) => {
    args.push('-i', file);
    parts.push(`[${k}:v]crop=${w}:${h}:${x}:${y},scale=${TW}:-2:flags=lanczos[c${k}]`);
  });
  const stack = t.crops.length > 1 ? `${t.crops.map((_, k) => `[c${k}]`).join('')}vstack=inputs=${t.crops.length}[s]` : '[c0]null[s]';
  const pad = t.fit === 'pad' ? `[s]pad=${TW}:${TH}:0:(${TH}-ih)/2:color=0x1b1e22[o]` : `[s]crop=${TW}:${TH}:0:0[o]`;
  ff(...args, '-filter_complex', `${parts.join(';')};${stack};${pad}`, '-map', '[o]', '-frames:v', '1', out);
});

// 2. общая доска: 2 колонки по 4 ячейки, в восьмой пояснение
const W = GAP + 2 * CW + GAP + GAP, H = TOP + 4 * CH + 3 * GAP + GAP;
const args = ['-f', 'lavfi', '-i', `color=c=${BG}:s=${W}x${H}`];
TILES.forEach((_, i) => args.push('-i', `${OUT}/tile${i + 1}.png`));
const tx = [];
const cell = (i) => ({x: GAP + (i % 2) * (CW + GAP), y: TOP + Math.floor(i / 2) * (CH + GAP)});
TILES.forEach((t, i) => {
  const {x, y} = cell(i), lx = x + TW + 24;
  let ty = y + 4;
  tx.push(draw(`n${i}`, String(i + 1), lx, ty, 30, '0xFF7A33', FONT_BOLD));
  t.title.forEach((s, k) => { tx.push(draw(`t${i}_${k}`, s, lx + 34, ty, 30, 'white', FONT_BOLD)); ty += 38; });
  ty += 2;
  tx.push(draw(`m${i}`, t.meta, lx + 34, ty, 21, '0xFF7A33')); ty += 44;
  t.body.forEach((s, k) => { tx.push(draw(`b${i}_${k}`, s, lx, ty, 21, 'white')); ty += 30; });
  ty += 16;
  t.example.forEach((s, k) => { tx.push(draw(`e${i}_${k}`, s, lx, ty, 19, '0xB5BAC0')); ty += 28; });
  tx.push(draw(`s${i}`, t.source, lx, y + CH - 30, 16, '0x7E848B'));
});
// пояснение в восьмой ячейке
{
  const {x, y} = cell(7);
  NOTE.forEach((s, k) => tx.push(draw(`o${k}`, s, x, y + 20 + k * 32, k === 0 ? 30 : 21, k === 0 ? 'white' : '0xB5BAC0', k === 0 ? FONT_BOLD : FONT)));
}
tx.push(draw('h1', 'ФОРМАТЫ ДЛЯ БИЗНЕСА', GAP, 44, 44, 'white', FONT_BOLD));
tx.push(draw('h2', 'Семь готовых форматов. Выбери один под свою задачу.', GAP, 104, 22, '0xB5BAC0'));
const filters = [];
let prev = '[0:v]';
TILES.forEach((_, i) => {
  const {x, y} = cell(i);
  filters.push(`${prev}[${i + 1}:v]overlay=${x}:${y}[b${i}]`);
  prev = `[b${i}]`;
});
filters.push(`${prev}${tx.join(',')}[o]`);
ff(...args, '-filter_complex', filters.join(';'), '-map', '[o]', '-frames:v', '1', '-q:v', '3', 'public/style-previews/business.jpg');
rmSync(OUT, {recursive: true, force: true});
console.log('готово: public/style-previews/business.jpg');
