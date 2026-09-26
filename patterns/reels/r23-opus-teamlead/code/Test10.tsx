import {AbsoluteFill, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import {Captions} from '../../montage/Captions';
import {captionY, SpeakerHalf} from './hybrid';
import {Hook} from './Hook';
import {at23, WORDS23} from './words23';

// Проба концепции ролика 23: первые 10 с записи IMG_7881, стиль СЦЕНЫ на белом кинетическом холсте сверху,
// он — снизу во всю ширину (раскладка A «Шов»). Звук: речь из записи + SFX пака ×0,37, без приглушения.
export const TEST10_FRAMES = 600;
const SEAM = 1280, SFX_GAIN = 0.37;
const SFX: [number, string, number][] = [
  [0.02, 'zoom', 0.3],                                  // отъезд от «Claude Code»
  [at23('лимиты', 0) + 0.12, 'sub-hit', 0.34],          // «лимиты» падает и ударяется
  [at23('теперь') - 0.14, 'whoosh-sharp', 0.3],         // рывок вниз
  [at23('тают') + 0.1, 'transform', 0.22],              // шкала тает
  [at23('поэтому') - 0.1, 'woosh-air', 0.3],            // рывок вправо
  [at23('claude', 1) + 0.02, 'ui-glass', 0.22],         // окно Claude Code
  [at23('opus', 0) - 0.02, 'ui-slide', 0.24],           // Opus едет к окну
  [at23('писать') - 0.02, 'snap', 0.3],                 // стеклянная капсула Opus бьётся о терминал
  [at23('писать') + 0.04, 'shimmer', 0.2],              // осколки
  [at23('opus', 1) - 0.14, 'whoosh-sharp2', 0.3],       // рывок вниз к команде
  [at23('opus', 1) + 0.05, 'ui-pop', 0.18],
  [at23('начальник') + 0.02, 'switch', 0.26],           // рамка выделения
  [at23('claude', 2) - 0.12, 'whoosh-sharp', 0.28],     // рывок вправо
  [at23('официальный'), 'typing', 0.2],                 // печать
];

export const Test10: React.FC = () => {
  const frame = useCurrentFrame(), {fps} = useVideoConfig(), t = frame / fps;
  return (
    <AbsoluteFill style={{background: '#0A0B0D'}}>
      <Hook t={t} w={1440} h={SEAM} />
      <SpeakerHalf v="A" seam={SEAM} src={{video: 'r23/speaker-10s.mp4', headY: 0.46, audio: true, w: 1440, h: 2560}} />
      <Captions t={t} words={WORDS23} cx={720} cy={captionY(SEAM)} maxW={1100} size={53.3} />
      {SFX.map(([at, name, v], i) => (
        <Sequence key={i} from={Math.max(0, Math.round(at * fps))} durationInFrames={Math.round(2.5 * fps)} layout="none">
          <Audio src={staticFile(`sfx/${name}.wav`)} volume={v * SFX_GAIN} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
