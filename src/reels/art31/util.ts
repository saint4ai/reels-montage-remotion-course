import {Easing} from 'remotion';

// Время и кривые стиля 17 МИРЫ. Всё функция секунды t = frame / fps, без памяти о прошлом кадре.
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const outCubic = (x: number) => 1 - Math.pow(1 - x, 3);
export const inCubic = (x: number) => x * x * x;
export const inOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
// Кривая роста с перелётом (глава «КРИВЫЕ» в референсе neurofam): cubic-bezier(.34,1.56,.64,1).
export const overshoot = Easing.bezier(0.34, 1.56, 0.64, 1);
// Быстрый старт, долгий доводчик (входы слов в стиле ShinyText/BlurText из React Bits).
export const swift = Easing.bezier(0.16, 1, 0.3, 1);
