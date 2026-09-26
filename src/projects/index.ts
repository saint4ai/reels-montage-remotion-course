import type {ProjectData} from '../template/demo';
import {DEMO} from '../template/demo';

// Реестр проектов на движке стилей: ролик = данные (слова из расшифровки + смысловые блоки) + выбранный стиль.
// Новый проект создаёт `npm run new -- <slug> <STYLE>`: он кладёт src/projects/<slug>.ts и дописывает строку сюда.
// id композиции = slug; стиль — один из STYLES (PRISM, ORBIT, TRACE, PULSE, GLASS, PORTRAIT, APPLE, PODCAST, EXPERT).
export type ProjectEntry = {id: string; style: string; project: ProjectData};

export const PROJECTS: ProjectEntry[] = [
  {id: 'example-prism', style: 'PRISM', project: DEMO},
  // NEW-PROJECT (строка-метка для npm run new, не удалять)
];
