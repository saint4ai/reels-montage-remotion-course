import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {Captions} from '../../montage/Captions';
import {captionY, SpeakerHalf} from './hybrid';
import {PriceKinetic} from './PriceKinetic';
import {PRICE, PRICE_WORDS} from './words';

// Проба блока цен: стиль СЦЕНЫ на белом кинетическом холсте в верхней половине, он — снизу во всю ширину
// (раскладка A «Шов», выбрана 24.09 по кадру К5).
export const PRICE_FRAMES = Math.round(PRICE.dur * 60);
const SEAM = 1280;

export const PriceProbe: React.FC = () => {
  const frame = useCurrentFrame(), {fps} = useVideoConfig(), t = frame / fps;
  return (
    <AbsoluteFill style={{background: '#0A0B0D'}}>
      <PriceKinetic t={t} w={1440} h={SEAM} />
      <SpeakerHalf v="A" seam={SEAM} src={{still: 'r23/face-still.jpg', headY: 0.4}} />
      <Captions t={t} words={PRICE_WORDS} cx={720} cy={captionY(SEAM)} maxW={1100} size={53.3} />
    </AbsoluteFill>
  );
};
