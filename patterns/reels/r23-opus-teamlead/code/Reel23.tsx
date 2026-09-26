import {AbsoluteFill, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import {Captions} from '../../montage/Captions';
import {B, BODY_CAM, BodyScenes} from './Body';
import {captionY, SpeakerHalf} from './hybrid';
import {HOOK_CAM, S1, S2, S3, S4, S5, T} from './Hook';
import {blurOf, camAt, MotionBlurDefs, PaperBg, worldTransform} from './kinetic';
import {at23, WORDS23} from './words23';

// Ролик 23 «Opus — начальник» целиком: стиль СЦЕНЫ на белом кинетическом холсте в верхней половине (референс 24.09),
// он — снизу во всю ширину (раскладка A «Шов»). Запись IMG_7881, 63,2 с, 60 fps. Звук: речь + SFX пака ×0,37 без приглушения.
export const REEL23_FRAMES = Math.round(63.2 * 60);
const SEAM = 1280, SFX_GAIN = 0.37;
const CAM = [...HOOK_CAM, ...BODY_CAM];
const BLOBS: [number, number, number][] = [[0, 0, 1500], [150, 1750, 1500], [1750, 1500, 1300], [1750, 2800, 1500], [3250, 2700, 1500], [3250, 4000, 1500], [4900, 4000, 1500],
  [6650, 4700, 1800], [6650, 6100, 1500], [8400, 6100, 1500], [8400, 7500, 1600], [7500, 8950, 1500], [9300, 8950, 1500], [8400, 8500, 1800], [11200, 8300, 1500], [11200, 9750, 1500],
  [12950, 9750, 1500], [12950, 11200, 1500]];
const RINGS: [number, number, number][] = [[-700, -400, 1600], [900, 900, 2000], [2600, 2100, 1800], [3900, 3200, 2200], [5600, 5000, 2400], [7600, 5400, 1800], [9600, 7000, 2200],
  [7200, 9800, 2000], [10400, 8900, 2200], [12200, 10500, 2400], [13800, 8600, 1800]];
const w = (a: number, b: number, t: number) => t > a && t < b;

const SFX: [number, string, number][] = [
  [0.02, 'zoom', 0.3], [at23('лимиты', 0) + 0.12, 'sub-hit', 0.34], [T.now - 0.14, 'whoosh-sharp', 0.3], [T.melt + 0.1, 'transform', 0.22],
  [T.so - 0.1, 'woosh-air', 0.3], [T.cc2 + 0.02, 'ui-glass', 0.22], [T.cc2 + 0.5, 'typing', 0.14], [T.opus - 0.02, 'ui-slide', 0.24], [T.write - 0.02, 'snap', 0.3], [T.write + 0.04, 'shimmer', 0.2],
  [T.opus2 - 0.14, 'whoosh-sharp2', 0.3], [T.opus2 + 0.05, 'ui-pop', 0.18], [T.boss + 0.02, 'switch', 0.26], [T.cc3 - 0.12, 'whoosh-sharp', 0.28], [T.official, 'typing', 0.18],
  [B.opusThinks - 0.17, 'woosh-air', 0.28], [B.thinks, 'ui-tap', 0.2], [B.writes, 'ui-tap', 0.2],
  [B.look - 0.12, 'whoosh-sharp2', 0.3], [B.million, 'shimmer', 0.14],
  [B.opusP - 0.14, 'whoosh-sharp', 0.26], [B.twenty, 'counter', 0.22], [B.sonnetP - 0.14, 'woosh-air', 0.24], [B.ten, 'counter', 0.22], [B.haikuP - 0.14, 'woosh-air', 0.24], [B.five, 'counter', 0.22],
  [B.diff - 0.12, 'whoosh-long', 0.24], [B.four, 'ui-seq', 0.2], [B.four + 0.4, 'flash', 0.22],
  [B.drive - 0.14, 'whoosh-sharp', 0.28], [B.opusJ, 'ui-click', 0.16], [B.opusJ + 0.3, 'ui-click', 0.14], [B.every, 'ui-click', 0.16], [B.line, 'ui-click', 0.14], [B.code, 'ui-click', 0.14],
  [B.so - 0.12, 'woosh-air', 0.28], [B.task, 'ui-pop', 0.2], [B.add, 'typing', 0.16],
  [B.first - 0.14, 'whoosh-sharp2', 0.28], [B.opusS, 'ui-pop', 0.2], [B.files, 'ui-tap', 0.18], [B.steps - 0.05, 'transform2', 0.24],
  [B.next - 0.12, 'whoosh-sharp', 0.28], [B.sonnetS, 'ui-pop', 0.2], [B.writes2, 'typing', 0.16], [B.routine, 'ui-soft', 0.2],
  [B.last - 0.12, 'woosh-air', 0.28], [B.haikuS, 'ui-pop', 0.2], [B.tests, 'ui-seq', 0.18], [B.catches, 'shake', 0.26], [B.broke, 'switch', 0.22],
  [B.literally - 0.1, 'whoosh-long3', 0.26], [B.lead, 'ui-pop', 0.22], [B.dev, 'ui-pop', 0.22], [B.junior, 'ui-pop', 0.22],
  [B.brain - 0.12, 'zoom', 0.26], [B.arch, 'ui-tap', 0.2], [B.hard, 'ui-tap', 0.2], [B.final, 'ui-tap', 0.2],
  [B.limits - 0.42, 'whoosh-sharp2', 0.28], [B.melt, 'transform', 0.2],
  [B.pair - 0.14, 'whoosh-sharp', 0.28], [B.bundle, 'rubber', 0.22], [B.command + 0.1, 'typing', 0.18], [B.opusplan + 0.6, 'ui-glass', 0.22],
  [B.team - 0.14, 'woosh-air', 0.28], [B.team + 0.1, 'ui-slide', 0.2], [B.folder, 'ui-soft', 0.22], [B.install, 'ui-click', 0.22], [B.self, 'shimmer', 0.22],
  [B.write - 0.14, 'whoosh-sharp2', 0.28], [B.word, 'typing', 0.18], [B.send, 'ui-pop', 0.22], [B.skill, 'riser', 0.2],
];

export const Reel23: React.FC = () => {
  const frame = useCurrentFrame(), {fps} = useVideoConfig(), t = frame / fps;
  const cam = camAt(t, CAM), mb = blurOf(t, CAM), blur = mb.x + mb.y > 0.8;
  return (
    <AbsoluteFill style={{background: '#0A0B0D'}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: 1440, height: SEAM, overflow: 'hidden'}}>
        <PaperBg cam={cam} w={1440} h={SEAM} blobs={BLOBS} rings={RINGS} />
        <MotionBlurDefs id="mb23" x={mb.x} y={mb.y} />
        <div style={{position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: worldTransform(cam), filter: blur ? 'url(#mb23)' : undefined}}>
          {w(-1, T.now + 0.9, t) ? <S1 t={t} /> : null}
          {w(T.now - 0.9, T.so + 1, t) ? <S2 t={t} /> : null}
          {w(T.so - 0.9, T.opus2 + 1, t) ? <S3 t={t} /> : null}
          {w(T.opus2 - 0.9, T.cc3 + 1, t) ? <S4 t={t} /> : null}
          {w(T.cc3 - 0.9, B.opusThinks + 0.6, t) ? <S5 t={t} /> : null}
          <BodyScenes t={t} />
        </div>
      </div>
      <SpeakerHalf v="A" seam={SEAM} src={{video: 'r23/speaker.mp4', headY: 0.46, audio: true, w: 2160, h: 3840}} />
      <Captions t={t} words={WORDS23} cx={720} cy={captionY(SEAM)} maxW={1100} size={53.3} />
      {SFX.map(([at, name, v], i) => (
        <Sequence key={i} from={Math.max(0, Math.round(at * fps))} durationInFrames={Math.round(2.5 * fps)} layout="none">
          <Audio src={staticFile(`sfx/${name}.wav`)} volume={v * SFX_GAIN} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
