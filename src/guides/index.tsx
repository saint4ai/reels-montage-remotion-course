import React from 'react';
import {Folder, Still} from 'remotion';
import {Guide01, Guide02, Guide03, Guide04, Guide05, Guide06, GUIDE_H, GUIDE_W} from './GuideShots';

// Папка Guides в студии: шесть картинок для docs/guides/claude-desktop-sessions.md (Guide-01 … Guide-06, 1600×1100).
// Рендер каждой: SCALE=1 node scripts/stills.mjs Guide-01 0 → out/stills/Guide-01-0000.png → docs/guides/img/guide-01.png.
const GUIDES: [string, React.FC][] = [['Guide-01', Guide01], ['Guide-02', Guide02], ['Guide-03', Guide03], ['Guide-04', Guide04], ['Guide-05', Guide05], ['Guide-06', Guide06]];

export const GuideFolder: React.FC = () => (
  <Folder name="Guides">
    {GUIDES.map(([id, component]) => <Still key={id} id={id} component={component} width={GUIDE_W} height={GUIDE_H} />)}
  </Folder>
);
