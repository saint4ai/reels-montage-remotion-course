import type React from 'react';
import '../kit/fonts';
import {FPS as TPL_FPS, SECONDS as TPL_SECONDS, TemplateReel} from './_template/Reel';
import {END31, FPS31, Reel31} from './laya31/Reel';
import {END32, FPS32, Reel32} from './artemis32/Reel';
import {DUR_RM_GH, FPS_RM_GH, ReelRmGhtricks} from './rm/ghtricks/Reel';
import {END_GH, FPS_GH, ReelGhTricks} from './ghtricks/Reel';
import {SwapSym, SYM_END} from './swap/Sym';
import {Art31, DUR as ART31_DUR} from './art31/Art31';
import {FPS_R20, FRAMES_R20, ReelRM20} from './rm/r20/Reel';
import {FPS as FPS_R39, FRAMES as FRAMES_R39, ReelRMr39} from './rm/r39/Reel';

// Реестр своих роликов: код с нуля по образцам patterns/reels (когда формат не укладывается в движок стилей).
// Ролик живёт в src/reels/<slug>/Reel.tsx + words.ts и регистрируется здесь одной строкой.
// fps 60, кадр 1440×2560 (2K); финал 2K по умолчанию, 4K по просьбе (рендер с --scale=1.5).
// Ролики-образцы стилей 14–17 собраны без записи автора: вместо лица заглушка (студийный фон и микрофон), пути записи ученика
// вписываются в константы REC и VOICE в начале файла ролика. Описание каждого: patterns/reels/<имя>/README.md.
export type ReelEntry = {id: string; component: React.FC; fps: number; seconds: number};

export const REELS: ReelEntry[] = [
  {id: 'example-custom', component: TemplateReel, fps: TPL_FPS, seconds: TPL_SECONDS},
  // стиль 14 ЛИНЗА
  {id: 'Lens-Laya', component: Reel31, fps: FPS31, seconds: END31},
  {id: 'Lens-Artemis', component: Reel32, fps: FPS32, seconds: END32},
  {id: 'Lens-GhTricks', component: ReelRmGhtricks, fps: FPS_RM_GH, seconds: DUR_RM_GH},
  // ЭСТАФЕТА 35% (CHROMA RELAY + полоса записи 35% внизу)
  {id: 'Relay-GhTricks', component: ReelGhTricks, fps: FPS_GH, seconds: END_GH},
  // стиль 16 СИМБИОЗ
  {id: 'Symbiosis-Swap', component: SwapSym, fps: 60, seconds: SYM_END},
  // стиль 17 МИРЫ (камера спикера: Screen Studio и кружок)
  {id: 'Worlds-Art31', component: Art31, fps: 30, seconds: ART31_DUR},
  // стиль 13 ЭКСПЕРТ, вариант «доска» (перемонтажи 10.10.2026)
  {id: 'Expert2-Money', component: ReelRM20, fps: FPS_R20, seconds: FRAMES_R20 / FPS_R20},
  {id: 'Expert2-Unlazy', component: ReelRMr39, fps: FPS_R39, seconds: FRAMES_R39 / FPS_R39},
  // NEW-REEL (строка-метка, не удалять)
];
