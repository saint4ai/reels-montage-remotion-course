import type React from 'react';
import {FPS as TPL_FPS, SECONDS as TPL_SECONDS, TemplateReel} from './_template/Reel';

// Реестр своих роликов: код с нуля по образцам patterns/reels (когда формат не укладывается в движок стилей).
// Ролик живёт в src/reels/<slug>/Reel.tsx + words.ts и регистрируется здесь одной строкой.
// fps 60, кадр 1440×2560 (2K); финал 4K — рендер с --scale=1.5.
export type ReelEntry = {id: string; component: React.FC; fps: number; seconds: number};

export const REELS: ReelEntry[] = [
  {id: 'example-custom', component: TemplateReel, fps: TPL_FPS, seconds: TPL_SECONDS},
  // NEW-REEL (строка-метка, не удалять)
];
