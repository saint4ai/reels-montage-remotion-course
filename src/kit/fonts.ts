import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';

// Шрифты новых стилей (ЛИНЗА, ЭСТАФЕТА, СИМБИОЗ, МИРЫ), которых нет в общем src/fonts.ts.
// Имя файла fonts.ts не менять: в package.json его подхватывает sideEffects, иначе сборка выкинет загрузку шрифтов.
// Soyuz Grotesk Bold: цифры и капс в ЛИНЗЕ и ЭКСПЕРТЕ (кириллица есть). Unbounded: заголовки стиля МИРЫ (OFL, вариативный).
loadFont({family: 'Soyuz Grotesk', url: staticFile('fonts/SoyuzGrotesk-Bold.ttf'), weight: '700'});
loadFont({family: 'Unbounded', url: staticFile('fonts/Unbounded.woff2'), weight: '200 900', format: 'woff2'});
