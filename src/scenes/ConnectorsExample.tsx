import {AbsoluteFill, Easing, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import {bevel, color, DepthText, elevation, Panel, Pill, textDepth, type} from '../ds';
import {T} from '../theme';
import {DashedPath} from '../components/DashedPath';
import {SpeakerCard} from '../components/SpeakerCard';
import {Captions} from '../components/Captions';
import {FarObjects, NearLayer, WorldBackground} from './World';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const inOut = Easing.bezier(0.65, 0, 0.35, 1);
const out = Easing.bezier(0.16, 1, 0.3, 1);
const CAM = {A: [0, 0], B: [0, 1600], C: [1600, 1600]};

const Calculator: React.FC = () => (
  <div style={{width: 320, height: 440, borderRadius: 46, padding: 28, boxSizing: 'border-box',
    background: 'linear-gradient(160deg,#343943 0%,#1B1E24 60%,#121418 100%)', boxShadow: `${bevel}, ${elevation[3]}`, border: '2px solid rgba(255,255,255,.12)'}}>
    <div style={{height: 98, borderRadius: 20, background: 'linear-gradient(180deg,#050608,#0D1014)', boxShadow: 'inset 0 4px 10px rgba(0,0,0,.8)',
      color: color.text, fontFamily: 'JBM', fontWeight: 600, fontSize: 60, lineHeight: '98px', textAlign: 'right', padding: '0 20px', textShadow: '0 0 18px rgba(255,255,255,.25)'}}>20.00</div>
    <div style={{display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginTop: 22}}>
      {Array.from({length: 16}).map((_, i) => (
        <div key={i} style={{height: 52, borderRadius: 16, background: i % 4 === 3 ? 'linear-gradient(180deg,#FFB070,#FF7A2A)' : 'linear-gradient(180deg,#434953,#2E333B)',
          boxShadow: 'inset 0 2px 0 rgba(255,255,255,.22), 0 5px 0 #15171B'}} />
      ))}
    </div>
  </div>
);

export const ConnectorsExample: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const s = (sec: number) => Math.round(sec * fps);
  const pop = (sec: number, damping = 14) => spring({frame: frame - s(sec), fps, config: {damping, stiffness: 140, mass: 0.9}});
  const fade = (a: number, b: number) => interpolate(t, [a, b], [0, 1], {...clamp, easing: out});

  // Камера по единому холсту: вниз к B, вправо к C. Наклон и размытие только в движении.
  const pAB = interpolate(t, [T.aToB, T.aToB + 0.9], [0, 1], {...clamp, easing: inOut});
  const pBC = interpolate(t, [T.bToC, T.bToC + 0.9], [0, 1], {...clamp, easing: inOut});
  const camX = CAM.A[0] + (CAM.B[0] - CAM.A[0]) * pAB + (CAM.C[0] - CAM.B[0]) * pBC;
  const camY = CAM.A[1] + (CAM.B[1] - CAM.A[1]) * pAB + (CAM.C[1] - CAM.B[1]) * pBC;
  const tiltX = 7 * Math.sin(Math.PI * pAB);
  const tiltY = -6 * Math.sin(Math.PI * pBC);

  const claudeIn = pop(0.3);
  const zeroIn = pop(1.4, 11);
  const dollars = Math.round(interpolate(t, [2.65, 3.45], [0, 20], {...clamp, easing: out}));
  const sumIn = fade(2.6, 2.9);
  const perIn = fade(3.52, 3.8);
  const calcIn = pop(4.58, 12);
  const cardIn = pop(5.55, 16);
  const hubIn = pop(7.3);
  const rows = [
    {label: 'Perplexity', icon: 'brand/perplexity.svg', y: 700},
    {label: 'Firecrawl', icon: 'brand/firecrawl.png', y: 870},
    {label: 'Playwright', icon: 'brand/playwright.svg', y: 1040},
    {label: 'Composio', icon: 'brand/composio.svg', iconBg: '#0B0D10', y: 1210},
  ];
  const trunk = interpolate(t, [7.35, 8.6], [0, 1], {...clamp, easing: out});
  const chatIn = fade(9.6, 9.85);
  const work = fade(T.work, T.work + 0.3);

  return (
    <AbsoluteFill className="dark" data-theme="dark" style={{background: color.ink, perspective: 2600, perspectiveOrigin: '50% 30%'}}>
      <div style={{position: 'absolute', inset: 0, rotate: `${tiltY !== 0 ? `y ${tiltY}deg` : `x ${tiltX}deg`}`, transformOrigin: '50% 30%'}}>
        <WorldBackground camX={camX} camY={camY} />
        <FarObjects camX={camX} camY={camY} t={t} />

        {/* Содержимое холста: без маски, прозрачности и фильтров у предков — иначе стекло не видит фон */}
        <div>
          <div style={{position: 'absolute', left: 0, top: 0, width: 3200, height: 3400, translate: `${-camX}px ${-camY}px`}}>
            <DashedPath id="route-ab" d="M 720 1330 L 720 2050" progress={interpolate(t, [T.aToB - 0.1, T.aToB + 0.8], [0, 1], clamp)} w={10} h={10} />
            <DashedPath id="route-bc" d="M 1170 2520 C 1480 2520, 1860 2020, 2320 1980" progress={interpolate(t, [T.bToC - 0.1, T.bToC + 0.8], [0, 1], clamp)} w={10} h={10} />

            {/* A */}
            <div style={{position: 'absolute', left: 720, top: 430, translate: `-50% ${(1 - claudeIn) * 160}px`, opacity: claudeIn, scale: String(0.9 + 0.1 * claudeIn)}}>
              <Pill label="Claude" icon="brand/claude.svg" level={3} />
            </div>
            <div style={{position: 'absolute', left: 720, top: 600, translate: '-50% 0', opacity: zeroIn, scale: String(zeroIn)}}>
              <Pill label="0 коннекторов" tone="danger" material="solid" />
            </div>
            <div style={{position: 'absolute', left: 90, top: 820, opacity: sumIn, display: 'flex', alignItems: 'baseline', gap: 18}}>
              <DepthText size={type.figure} family="JBM">${dollars}</DepthText>
              <span style={{opacity: perIn, fontFamily: 'Manrope', fontWeight: 600, fontSize: 70, color: color.dim, textShadow: textDepth}}>/мес</span>
            </div>
            <div style={{position: 'absolute', left: 790, top: 780, opacity: calcIn > 0.01 ? 1 : 0, translate: `0 ${(1 - calcIn) * 700}px`, rotate: `${(1 - calcIn) * 8}deg`}}>
              <Calculator />
            </div>

            {/* B */}
            <div style={{position: 'absolute', left: 720, top: 2080, translate: `-50% ${(1 - cardIn) * 140}px`, opacity: cardIn, filter: `blur(${(1 - cardIn) * 10}px)`}}>
              <Panel name="4 года" width={900} material="frosted">
                <DepthText size={type.headline} tone="mint">4 года</DepthText>
                <div style={{fontFamily: 'Manrope', fontWeight: 600, fontSize: 64, lineHeight: 1.25, color: color.text, textShadow: textDepth}}>внедряю AI в бизнес</div>
              </Panel>
            </div>

            {/* C: ствол карты и четыре ветки */}
            <div style={{position: 'absolute', left: 1600, top: 1600, width: 1440, height: 1480}}>
              <DashedPath id="trunk" d="M 720 600 C 720 660, 140 620, 140 720 L 140 1210" progress={trunk} w={10} h={10} />
              {rows.map((r, i) => (
                <DashedPath key={r.label} id={`tick${i}`} d={`M 140 ${r.y} L 200 ${r.y}`} progress={interpolate(t, [7.7 + i * 0.25, 7.9 + i * 0.25], [0, 1], clamp)} w={10} h={10} />
              ))}
              <div style={{position: 'absolute', left: 720, top: 380, translate: '-50% -50%', opacity: hubIn, scale: String(0.85 + 0.15 * hubIn)}}>
                <Pill label="Claude" icon="brand/claude.svg" tone={work > 0.5 ? 'mint' : 'default'} level={3} />
              </div>
              <div style={{position: 'absolute', left: 720, top: 530, translate: '-50% -50%', opacity: chatIn}}>
                <Pill label={work > 0.5 ? '✓ работает' : 'болтает…'} tone={work > 0.5 ? 'ok' : 'default'} material={work > 0.5 ? 'solid' : 'frosted'} size={60} level={1} />
              </div>
              {rows.map((r, i) => {
                const inn = pop(7.8 + i * 0.25, 13);
                const badge = pop(T.badges + 0.3 + i * 0.17, 10);
                return (
                  <div key={r.label} style={{position: 'absolute', left: 200, top: r.y, translate: `${(1 - inn) * -80}px -50%`, opacity: inn,
                    display: 'flex', alignItems: 'center', gap: 28}}>
                    <Pill label={r.label} icon={r.icon} iconBg={r.iconBg} ringOverride={work > 0.5 ? color.mint : undefined} />
                    <div style={{scale: String(badge), opacity: badge}}><Pill label="1 мин" tone="mint" size={60} level={1} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <NearLayer camX={camX} camY={camY} />
      </div>

      <Captions />
      <SpeakerCard />

      {/* Звук: только пак onai-apple-pack */}
      <Sequence from={s(2.62)}><Audio src={staticFile('sfx/counter.wav')} volume={0.35} /></Sequence>
      <Sequence from={s(4.55)}><Audio src={staticFile('sfx/rubber.wav')} volume={0.4} /></Sequence>
      <Sequence from={s(T.aToB - 0.08)}><Audio src={staticFile('sfx/whoosh.wav')} volume={0.3} /></Sequence>
      <Sequence from={s(T.bToC - 0.08)}><Audio src={staticFile('sfx/whoosh.wav')} volume={0.3} /></Sequence>
      <Sequence from={s(T.work)}><Audio src={staticFile('sfx/transform.wav')} volume={0.4} /></Sequence>
      <Sequence from={s(T.badges + 0.3)}><Audio src={staticFile('sfx/switch.wav')} volume={0.3} /></Sequence>
    </AbsoluteFill>
  );
};
