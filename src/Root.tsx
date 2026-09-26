import './index.css';
import './fonts';
import {Composition, Folder} from 'remotion';
import {ConnectorsExample} from './scenes/ConnectorsExample';
import {FitTest} from './FitTest';
import {KIT_DURATION, SceneKitDemo} from './scenes/kit/SceneKitDemo';
import {SPREAD_DEMO_FRAMES, SpreadDemo} from './scenes/kit/SpreadDemo';
import {DURATION, FPS, H, W} from './theme';
import {calcTemplate, Template} from './template/Template';
import {calcStyle} from './styles/engine';
import {reelOf, STYLES} from './styles';
import {PROJECTS} from './projects';
import {REELS} from './reels';

// Студия курса. Папки: Projects — ролики на движке стилей, Reels — свои ролики по образцам, Styles — демо девяти стилей,
// Template — сценарный холст, Kit — демо блоков, QA — FitTest (обязан ПАДАТЬ: проверка, что qa-fit ловит переполнение).
const byStyle = Object.fromEntries(STYLES.map((s) => [s.id, s]));

export const Root: React.FC = () => (
  <>
    <Folder name="Projects">
      {PROJECTS.map(({id, style, project}) => {
        const s = byStyle[style];
        if (!s) throw new Error(`Неизвестный стиль ${style} у проекта ${id}`);
        const C = reelOf(s.def, project);
        return <Composition key={id} id={id} component={C} defaultProps={{format: 'reels' as const}} calculateMetadata={calcStyle}
          durationInFrames={60} fps={60} width={1440} height={2560} />;
      })}
    </Folder>
    <Folder name="Reels">
      {REELS.map(({id, component, fps, seconds}) => (
        <Composition key={id} id={id} component={component} durationInFrames={Math.round(seconds * fps)} fps={fps} width={1440} height={2560} />
      ))}
    </Folder>
    <Folder name="Styles">
      {STYLES.flatMap(({id, def, demo}) => {
        const C = reelOf(def, demo);
        return [
          <Composition key={`${id}-r`} id={`${id}-Reels`} component={C} defaultProps={{format: 'reels' as const}} calculateMetadata={calcStyle}
            durationInFrames={60} fps={60} width={1440} height={2560} />,
          <Composition key={`${id}-y`} id={`${id}-YouTube`} component={C} defaultProps={{format: 'youtube' as const}} calculateMetadata={calcStyle}
            durationInFrames={60} fps={60} width={2560} height={1440} />,
        ];
      })}
    </Folder>
    <Folder name="Template">
      <Composition id="Template-Reels" component={Template} defaultProps={{format: 'reels' as const}} calculateMetadata={calcTemplate}
        durationInFrames={60} fps={60} width={1440} height={2560} />
      <Composition id="Template-YouTube" component={Template} defaultProps={{format: 'youtube' as const}} calculateMetadata={calcTemplate}
        durationInFrames={60} fps={60} width={2560} height={1440} />
    </Folder>
    <Folder name="Kit">
      <Composition id="SceneKit" component={SceneKitDemo} durationInFrames={KIT_DURATION} fps={FPS} width={W} height={H} />
      <Composition id="ConnectorsRoute" component={ConnectorsExample} durationInFrames={DURATION} fps={FPS} width={W} height={H} />
      <Composition id="StackSpreadDemo" component={SpreadDemo} durationInFrames={SPREAD_DEMO_FRAMES} fps={30} width={W} height={H} />
    </Folder>
    <Folder name="QA">
      <Composition id="FitTest" component={FitTest} durationInFrames={1} fps={30} width={1000} height={400} />
    </Folder>
  </>
);
