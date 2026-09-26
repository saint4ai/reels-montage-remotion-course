import type {StyleDef, StyleProps} from './engine';
import {StyleReel} from './engine';
import {PRISM} from './prism';
import {ORBIT} from './orbit';
import {TRACE} from './trace';
import {PULSE} from './pulse';
import {GLASS} from './glass';
import {PORTRAIT} from './portrait';
import {APPLE} from './apple';
import {PODCAST} from './podcast';
import {EXPERT, expertDemo} from './expert';
import {DEMO, type ProjectData} from '../template/demo';

// Реестр стилей режима «сцены» (паттерны 5–13 каталога patterns/README.md, перенесённые на Remotion).
// demo — свои демо-данные стиля, если ему нужно то, чего нет в общем демо (у ЭКСПЕРТА — снимок сервиса).
export const STYLES: {id: string; def: StyleDef; demo?: ProjectData}[] = [
  {id: 'PRISM', def: PRISM},
  {id: 'ORBIT', def: ORBIT},
  {id: 'TRACE', def: TRACE},
  {id: 'PULSE', def: PULSE},
  {id: 'GLASS', def: GLASS},
  {id: 'PORTRAIT', def: PORTRAIT},
  {id: 'APPLE', def: APPLE},
  {id: 'PODCAST', def: PODCAST},
  {id: 'EXPERT', def: EXPERT, demo: expertDemo(DEMO)},
];
export const reelOf = (def: StyleDef, demo?: ProjectData): React.FC<StyleProps> => (p) => <StyleReel {...p} project={p.project ?? demo} style={def} />;
