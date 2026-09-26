import React from 'react';
import {AbsoluteFill, Img, interpolate, random, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Audio, Video} from '@remotion/media';
import {Captions} from '../../montage/Captions';
import {E, k} from '../../montage/parts';
import {Brackets, CodeRain, HUD, HudGrid, LockOn, MONO, ORB, Reactor, SANS, Telemetry, TriTunnel, Typed, WireLaptop, triPts} from '../../kit/hud';
import {VBANDS, VENV, VFPS} from './voice-env';
import {WORDS29} from './words';

// Ролик «Джарвис» — новый формат «Железный человек» (Александр, 26.09.2026). Карта: videos/reels-29-jarvis/DIRECTION.md.
// Половина экрана он (запись на красном фоне), половина HUD; трижды он сворачивается в квадрат в углу, анимация
// разворачивается на весь кадр, потом снова деление. Основа чёрно-белая, красный только акцентом. Реактор качается
// от его голоса (огибающая voice-env.ts). Шрифты: Orbitron (надписи HUD), JetBrains Mono (подписи), SF Pro (субтитры).
export const FPS29 = 60;
export const END29 = 51.1;

const W = 1440, H = 2560;
const lerp = (a: number, b: number, m: number) => a + (b - a) * m;
const cl = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const sp = (t: number, at: number, fps: number, damping = 12, stiffness = 170) =>
  t < at ? 0 : spring({frame: (t - at) * fps, fps, config: {damping, stiffness, mass: 1}});

// ——— голос ———
const vfi = (t: number) => Math.min(VENV.length - 1, Math.max(0, t * VFPS));
const venv = (t: number) => { const f = vfi(t), i = Math.floor(f), a = f - i; return ((VENV[i] ?? 0) * (1 - a) + (VENV[i + 1] ?? VENV[i] ?? 0) * a) / 100; };
const vbars = (t: number) => { const b = VBANDS[Math.round(vfi(t))] ?? VBANDS[VBANDS.length - 1]; return [...b, ...[...b].reverse()].map((v) => v / 100); };
// «Голос Джарвиса» (ответа в записи нет): ровный синтетический узор.
const synth = (t: number) => Array.from({length: 24}, (_, i) => Math.max(0, Math.min(1, (0.5 + 0.5 * Math.sin(t * 9 + i * 0.9) * Math.sin(t * 3.1 + i * 0.37)) * (0.55 + 0.45 * Math.sin(t * 5.3)))));

// ——— режим: 0 — деление экрана, 1 — анимация на весь кадр, он в квадрате в углу ———
const CHANGES: [number, number][] = [[8.3, 1], [14.85, 0], [22.95, 1], [34.6, 0], [43.15, 1], [46.65, 0]];
const modeAt = (t: number) => CHANGES.reduce((m, [c, v]) => lerp(m, v, k(t, c - 0.35, c + 0.35, E.inOut)), 0);

type Rect = {x: number; y: number; w: number; h: number; r: number};
const SPLIT: Rect = {x: 0, y: 1280, w: 1440, h: 1280, r: 0};
// Окно в углу шире и мельче масштабом (правка Александра 26.09: «по башке обрезал»): голова и плечи целиком.
const SQ: Rect = {x: 70, y: 1548, w: 500, h: 450, r: 36};
const mix = (a: Rect, b: Rect, m: number): Rect => ({x: lerp(a.x, b.x, m), y: lerp(a.y, b.y, m), w: lerp(a.w, b.w, m), h: lerp(a.h, b.h, m), r: lerp(a.r, b.r, m)});

const Speaker: React.FC<{t: number; m: number}> = ({t, m}) => {
  const rc = mix(SPLIT, SQ, m);
  // Равномерный масштаб: лицо не искажается. Точка лица в записи ≈ (0,47; 0,43).
  const vw = lerp(1440, 540, m), vh = (vw * 16) / 9, fx = lerp(0.5, 0.47, m);
  const left = Math.min(0, Math.max(rc.w - vw, rc.w / 2 - fx * vw)), top = Math.min(0, Math.max(rc.h - vh, lerp(560, 190, m) - 0.43 * vh));
  const seam = 1 - k(m, 0, 0.4), sq = k(m, 0.6, 1);
  return (
    <>
      <div style={{position: 'absolute', left: rc.x, top: rc.y, width: rc.w, height: rc.h, borderRadius: rc.r, overflow: 'hidden', background: '#200405',
        boxShadow: sq > 0 ? `0 0 0 3px rgba(243,244,242,${0.9 * sq}), 0 0 50px rgba(255,46,62,${0.45 * sq}), 0 30px 60px rgba(0,0,0,.6)` : undefined}}>
        <Video src={staticFile('jv/speaker-4k.mp4')} volume={0} objectFit="cover" style={{position: 'absolute', left, top, width: vw, height: vh, maxWidth: 'none', maxHeight: 'none'}} />
      </div>
      {seam > 0 ? (
        <div style={{position: 'absolute', left: 0, top: rc.y - 2, width: W, height: 60, opacity: seam}}>
          <div style={{position: 'absolute', left: 0, top: 0, width: W, height: 3, background: HUD.ink, boxShadow: '0 0 18px rgba(255,255,255,.6)'}} />
          {Array.from({length: 37}, (_, i) => (
            <div key={i} style={{position: 'absolute', left: i * 40, top: 3, width: 2, height: i % 6 === 0 ? 22 : 10, background: i % 6 === 0 ? HUD.red : HUD.ink, opacity: 0.8}} />
          ))}
          <div style={{position: 'absolute', left: 32, top: 30, fontFamily: MONO, fontWeight: 700, fontSize: 26, color: HUD.ink, letterSpacing: '0.12em', textShadow: '0 1px 6px #000'}}>
            <span style={{color: HUD.red, opacity: Math.floor(t * 2) % 2 ? 1 : 0.35}}>●</span> OPERATOR · LIVE
          </div>
          <div style={{position: 'absolute', right: 32, top: 30, fontFamily: MONO, fontWeight: 700, fontSize: 26, color: HUD.ink, letterSpacing: '0.12em', textShadow: '0 1px 6px #000'}}>CAM 01</div>
        </div>
      ) : null}
      {sq > 0 ? (
        <>
          <Brackets x={rc.x - 18} y={rc.y - 18} w={rc.w + 36} h={rc.h + 36} len={34} th={4} color={HUD.ink} opacity={sq} />
          <div style={{position: 'absolute', left: rc.x + 18, top: rc.y + 14, padding: '4px 12px', background: 'rgba(0,0,0,.55)', fontFamily: MONO, fontWeight: 700, fontSize: 26, color: HUD.ink, letterSpacing: '0.14em', opacity: sq}}>
            <span style={{color: HUD.red, opacity: Math.floor(t * 2) % 2 ? 1 : 0.35}}>●</span> LIVE
          </div>
        </>
      ) : null}
    </>
  );
};

// ——— общие детали ———
const Panel: React.FC<{t: number; at: number; x: number; y: number; w: number; h: number; label: string; children?: React.ReactNode; flash?: number}> =
  ({t, at, x, y, w, h, label, children, flash = 0}) => {
    const a = k(t, at, at + 0.35, E.out), b = k(t, at + 0.15, at + 0.45);
    if (t < at - 0.6) return null;
    const slot = t < at;
    return (
      <div style={{position: 'absolute', left: x, top: y, width: w, height: h}}>
        <Brackets x={0} y={0} w={w} h={h} len={30} th={3} color={HUD.ink} opacity={slot ? 0.35 * k(t, at - 0.6, at - 0.3) : 1} />
        {a > 0 ? (
          <div style={{position: 'absolute', inset: 0, background: 'rgba(12,12,13,.78)', border: `2px solid rgba(243,244,242,${0.35 + 0.5 * flash})`, transform: `scaleY(${a})`, transformOrigin: 'top',
            boxShadow: `0 0 ${40 * flash}px rgba(255,46,62,${0.6 * flash}), 0 24px 50px rgba(0,0,0,.55)`}}>
            <div style={{position: 'absolute', left: 24, top: 18, right: 24, display: 'flex', alignItems: 'center', gap: 14, fontFamily: MONO, fontWeight: 700, fontSize: 32, color: HUD.ink, letterSpacing: '0.06em', opacity: b}}>
              <span style={{width: 16, height: 16, background: HUD.red, boxShadow: `0 0 12px ${HUD.red}`}} />{label}
              <span style={{marginLeft: 'auto', fontSize: 24, opacity: 0.55}}>LIVE</span>
            </div>
            <div style={{position: 'absolute', left: 24, right: 24, top: 74, bottom: 18, opacity: b}}>{children}</div>
          </div>
        ) : null}
      </div>
    );
  };

// Одноцветные знаки (Claude, Anthropic, GitHub, Instagram) красятся маской: Claude — фирменный терракотовый, остальные белые.
const TINT: Record<string, string> = {claude: '#D97757'};
const Logo: React.FC<{name: string; size: number; style?: React.CSSProperties; white?: boolean}> = ({name, size, style, white}) => {
  const tint = TINT[name] ?? (white ? '#FFFFFF' : null);
  if (tint) {
    const url = `url(${staticFile(`brand/${name}.svg`)})`;
    return <div style={{width: size, height: size, flex: 'none', background: tint, WebkitMaskImage: url, maskImage: url, WebkitMaskSize: 'contain', maskSize: 'contain',
      WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskPosition: 'center', ...style}} />;
  }
  return <Img src={staticFile(`brand/${name}.svg`)} style={{width: size, height: size, objectFit: 'contain', ...style}} />;
};

const Title: React.FC<{y: number; size?: number; text?: string; opacity?: number}> = ({y, size = 64, text = 'J.A.R.V.I.S.', opacity = 1}) => (
  <div style={{position: 'absolute', left: 0, width: W, top: y, textAlign: 'center', fontFamily: ORB, fontWeight: 800, fontSize: size, letterSpacing: '0.3em', paddingLeft: '0.3em',
    color: HUD.ink, textShadow: '0 0 26px rgba(255,255,255,.35), 0 3px 0 rgba(0,0,0,.6)', opacity}}>{text}</div>
);

const Status: React.FC<{y: number; text: string; alert?: boolean; t: number}> = ({y, text, alert, t}) => (
  <div style={{position: 'absolute', left: 0, width: W, top: y, display: 'flex', justifyContent: 'center'}}>
    <div style={{display: 'flex', alignItems: 'center', gap: 16, padding: '10px 26px', fontFamily: MONO, fontWeight: 800, fontSize: 44, letterSpacing: '0.16em',
      color: '#FFFFFF', background: alert ? HUD.red : 'rgba(10,10,11,.7)', border: alert ? 'none' : '2px solid rgba(243,244,242,.5)', boxShadow: alert ? `0 0 40px ${HUD.red}` : undefined}}>
      <span style={{width: 18, height: 18, borderRadius: 9, background: alert ? '#FFFFFF' : HUD.red, opacity: Math.floor(t * 3) % 2 ? 1 : 0.4}} />{text}
    </div>
  </div>
);

// ——— 1. Хук 0–6,25: реактор загружается, камера отъезжает — он внутри ноутбука; чип «подписка Claude» ———
const Hook: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const lap = k(t, 2.3, 3.4, E.inOut);
  const chip = sp(t, 4.8, fps, 11, 180);
  return (
    <AbsoluteFill style={{background: HUD.bg}}>
      <HudGrid />
      <Telemetry t={t} x={44} y={420} seed="h1" />
      <Telemetry t={t} x={1396} y={420} seed="h2" align="right" />
      <Title y={190} />
      <div style={{position: 'absolute', left: 0, width: W, top: 276, textAlign: 'center', fontFamily: MONO, fontWeight: 700, fontSize: 32, letterSpacing: '0.2em', color: HUD.dim}}>
        {t < 1.7 ? <Typed t={t} at={0} text="INITIATING SYSTEM" cps={16} /> : <span><span style={{color: HUD.red}}>●</span> SYSTEM ONLINE</span>}
      </div>
      <WireLaptop x={360} y={420} w={720} p={k(t, 2.3, 3.6)} />
      {/* Настоящая загрузка J.A.R.V.I.S. (съёмка интерфейса проекта, public/jv/ui-boot.mp4): крупно, потом уезжает в экран ноутбука */}
      {(() => {
        const r = {x: lerp(0, 385, lap), y: lerp(250, 445, lap), w: lerp(1440, 670, lap), h: lerp(840, 396, lap)};
        const vw = Math.max(r.w, (r.h * 1440) / 1180) * lerp(1.35, 1, lap), vh = (vw * 1180) / 1440;
        return (
          <div style={{position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h, overflow: 'hidden', mixBlendMode: 'screen', borderRadius: lerp(0, 6, lap)}}>
            <Sequence layout="none">
              <Video src={staticFile('jv/ui-boot.mp4')} trimBefore={Math.round(2.9 * fps)} volume={0}
                style={{position: 'absolute', left: r.w / 2 - vw / 2, top: r.h / 2 - vh / 2, width: vw, height: vh, maxWidth: 'none', maxHeight: 'none'}} />
            </Sequence>
          </div>
        );
      })()}
      {chip > 0 ? (
        <div style={{position: 'absolute', left: 0, width: W, top: 968, display: 'flex', justifyContent: 'center', opacity: Math.min(1, chip * 1.5), transform: `translateY(${(1 - chip) * 30}px) scale(${0.85 + 0.15 * chip})`}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 20, padding: '14px 34px 14px 20px', background: 'rgba(12,12,13,.85)', border: '2px solid rgba(243,244,242,.8)',
            boxShadow: '0 0 30px rgba(255,255,255,.12), 0 20px 40px rgba(0,0,0,.6)'}}>
            <Logo name="claude" size={60} />
            <span style={{fontFamily: SANS, fontWeight: 700, fontSize: 46, color: '#FFFFFF'}}>только подписка Claude</span>
            <span style={{fontFamily: MONO, fontWeight: 800, fontSize: 34, color: '#FFFFFF', background: HUD.red, padding: '4px 12px', opacity: k(t, 5.72, 5.9)}}>✓</span>
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ——— 2. GitHub 6,25–8,3: страница репозитория, наезд на «About», захват MIT / звёзд / форков ———
const GH = {x: 144, y: 250, w: 1008, h: 800};
const Github: React.FC<{t: number}> = ({t}) => {
  const z = k(t, 6.35, 6.85, E.inOut);
  const s = lerp(GH.w / 1440, 2.67, z), tx = lerp(0, 504 - 1201 * 2.67, z), ty = lerp((GH.h - 630) / 2, 400 - 346 * 2.67, z);
  const map = (x: number, y: number, w: number, h: number) => ({x: GH.x + tx + x * s, y: GH.y + ty + y * s, w: w * s, h: h * s});
  const mit = map(1052, 330, 104, 26), st = map(1052, 388, 92, 26), fk = map(1052, 446, 84, 26);
  const scan = ((t - 6.25) * 0.9) % 1;
  return (
    <AbsoluteFill style={{background: '#0B0B0C'}}>
      <HudGrid opacity={0.7} />
      <div style={{position: 'absolute', left: 0, top: scan * 1280 - 200, width: W, height: 200, background: 'linear-gradient(180deg, rgba(255,46,62,0), rgba(255,46,62,.14) 70%, rgba(255,46,62,0))'}} />
      <div style={{position: 'absolute', left: GH.x, top: 170, display: 'flex', alignItems: 'center', gap: 16, fontFamily: MONO, fontWeight: 700, fontSize: 34, color: HUD.ink}}>
        <Logo name="github" size={50} white /> github.com/adewaskar/jarvis
      </div>
      <div style={{position: 'absolute', left: GH.x, top: GH.y, width: GH.w, height: GH.h, overflow: 'hidden', background: '#0D1117', border: '2px solid rgba(243,244,242,.35)'}}>
        <Img src={staticFile('jv/gh-top.png')} style={{position: 'absolute', left: tx, top: ty, width: 1440 * s, height: 900 * s, maxWidth: 'none', maxHeight: 'none'}} />
        <div style={{position: 'absolute', left: 0, top: (((t - 6.25) * 1.4) % 1) * GH.h, width: GH.w, height: 3, background: HUD.ink, opacity: 0.5, boxShadow: '0 0 16px #fff'}} />
      </div>
      <Brackets x={GH.x - 16} y={GH.y - 16} w={GH.w + 32} h={GH.h + 32} len={44} th={4} />
      <LockOn t={t} at={6.85} {...mit} label="MIT · БЕСПЛАТНО" />
      <LockOn t={t} at={7.3} {...st} label="★ 223" />
      <LockOn t={t} at={7.62} {...fk} label="99 ФОРКОВ" />
    </AbsoluteFill>
  );
};

// ——— 3. Ядро 8,3–14,85, весь кадр: вспышка, «Эй, Джарвис» — слушает, отвечает, перебили на полуслове ———
const CUT = 12.63;
const Core: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const reply = t >= 10.9 && t < CUT;
  const cut = t >= CUT ? 1 - k(t, CUT, CUT + 0.7) : 0;
  const ign = k(t, 8.2, 8.9) * (1 - k(t, 8.9, 9.8));
  const status = t < 9.72 ? ['ONLINE', false] : t < 10.9 ? ['LISTENING', false] : t < CUT ? ['RESPONDING', false] : t < CUT + 0.9 ? ['INTERRUPTED', true] : ['LISTENING', false];
  const bub = sp(t, 10.2, fps, 11, 190), bubOut = k(t, 11.6, 11.9);
  return (
    <AbsoluteFill style={{background: HUD.bg}}>
      <TriTunnel t={t} cx={720} cy={900} speed={0.12} opacity={0.55} />
      <HudGrid opacity={0.6} />
      <Telemetry t={t} x={44} y={1180} seed="c1" rows={6} />
      <Telemetry t={t} x={1396} y={420} seed="c2" rows={6} align="right" />
      <Title y={196} size={60} />
      <Status y={292} text={status[0] as string} alert={status[1] as boolean} t={t} />
      {/* Настоящий интерфейс проекта (public/jv/ui-talk.mp4, кадр 0 = 6,7 с ролика): спит → просыпается → слушает → говорит → перебили */}
      <div style={{position: 'absolute', left: 0, top: 330, width: W, height: 1130, overflow: 'hidden', mixBlendMode: 'screen',
        transform: cut > 0.3 ? `translate(${(random(`cj${Math.floor(t * 30)}`) - 0.5) * 40 * cut}px, 0)` : undefined}}>
        <Sequence from={Math.round(6.7 * fps)} layout="none">
          <Video src={staticFile('jv/ui-talk.mp4')} volume={0} style={{position: 'absolute', left: 0, top: -50, width: 1440, height: 1180, maxWidth: 'none', maxHeight: 'none'}} />
        </Sequence>
      </div>
      {ign > 0 ? <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 35%, rgba(255,255,255,.55), rgba(255,46,62,.12) 40%, rgba(0,0,0,0) 70%)', opacity: ign}} /> : null}
      {cut > 0 ? <div style={{position: 'absolute', inset: 0, background: HUD.red, opacity: 0.22 * Math.pow(cut, 2)}} /> : null}
      {bub > 0 && bubOut < 1 ? (
        <div style={{position: 'absolute', left: 150, top: 430, opacity: Math.min(1, bub * 1.5) * (1 - bubOut), transform: `translateX(${(1 - bub) * -40}px)`}}>
          <div style={{fontFamily: MONO, fontWeight: 700, fontSize: 28, color: HUD.dim, letterSpacing: '0.16em', marginBottom: 8}}>VOICE IN</div>
          <div style={{padding: '16px 30px', background: 'rgba(10,10,11,.82)', borderLeft: `8px solid ${HUD.red}`, fontFamily: SANS, fontWeight: 700, fontSize: 54, color: '#FFFFFF',
            boxShadow: '0 20px 40px rgba(0,0,0,.6)'}}>«Эй, Джарвис»</div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ——— 4. Мозг 14,85–22,95, холст с камерой: компьютер → Claude Code → серверы Anthropic ———
type Cam = [number, number, number, number];
const CAMS: Cam[] = [[14.85, 0, 0, 1], [15.45, 0, 0, 1], [16.1, 1150, 0, 1], [18.4, 1150, 0, 1], [19.15, 2300, 0, 1], [20.95, 2300, 0, 1], [21.7, 1150, 40, 0.46]];
const camAt = (t: number) => {
  for (let i = 0; i < CAMS.length - 1; i++) {
    const [a, x0, y0, s0] = CAMS[i], [b, x1, y1, s1] = CAMS[i + 1];
    if (t <= b) {
      const p = k(t, a, b, E.inOut), dip = x0 !== x1 && s0 === s1 ? 1 - 0.14 * Math.sin(p * Math.PI) : 1;
      return {x: lerp(x0, x1, p), y: lerp(y0, y1, p), s: lerp(s0, s1, p) * dip};
    }
  }
  const [, x, y, s] = CAMS[CAMS.length - 1];
  return {x, y, s};
};
const Brain: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const cam = camAt(t);
  const c1 = k(t, 15.3, 16.0), c2 = k(t, 18.4, 19.1);
  const key = sp(t, 16.98, fps, 11, 180), strike = k(t, 17.55, 17.85, E.inOut);
  const meter = sp(t, 21.8, fps, 12, 170);
  const pulse = (p: number, a: number, b: number) => (p > 0.99 ? [0, 0.33, 0.66].map((o) => lerp(a, b, ((t * 0.9 + o) % 1))) : []);
  return (
    <AbsoluteFill style={{background: HUD.bg, overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: 0, height: 0, transform: `translate(${720 - cam.x * cam.s}px, ${640 - cam.y * cam.s}px) scale(${cam.s})`, transformOrigin: '0 0'}}>
        <svg width={5400} height={2600} style={{position: 'absolute', left: -1500, top: -1300}}>
          <defs>
            <pattern id="bdot" width={48} height={48} patternUnits="userSpaceOnUse"><circle cx={2} cy={2} r={2.2} fill={HUD.ink} fillOpacity={0.16} /></pattern>
          </defs>
          <rect width={5400} height={2600} fill="url(#bdot)" />
          <g transform="translate(1500 1300)">
            <line x1={340} y1={0} x2={lerp(340, 820, c1)} y2={0} stroke={HUD.ink} strokeWidth={4} strokeDasharray="18 14" strokeOpacity={0.8} />
            <line x1={1480} y1={0} x2={lerp(1480, 2040, c2)} y2={0} stroke={HUD.ink} strokeWidth={4} strokeDasharray="18 14" strokeOpacity={0.8} />
            {pulse(c1, 340, 820).map((x, i) => <circle key={`a${i}`} cx={x} cy={0} r={10} fill={HUD.red} />)}
            {pulse(c2, 1480, 2040).map((x, i) => <circle key={`b${i}`} cx={x} cy={0} r={10} fill={HUD.red} />)}
          </g>
        </svg>
        {/* узел 1: твой компьютер */}
        <WireLaptop x={-330} y={-250} w={660} p={k(t, 14.7, 15.3)}>
          <div style={{position: 'absolute', inset: 0, background: '#000'}} />
          {/* настоящий интерфейс проекта на экране ноутбука */}
          <Sequence from={Math.round(14.7 * fps)} layout="none">
            <Video src={staticFile('jv/ui-talk.mp4')} trimBefore={Math.round(1.5 * fps)} playbackRate={0.85} volume={0}
              style={{position: 'absolute', left: -40, top: -150, width: 694, height: 569, maxWidth: 'none', maxHeight: 'none'}} />
          </Sequence>
        </WireLaptop>
        <div style={{position: 'absolute', left: -330, top: 230, width: 660, textAlign: 'center', fontFamily: SANS, fontWeight: 700, fontSize: 48, color: HUD.ink}}>твой компьютер</div>
        {meter > 0 ? (
          <div style={{position: 'absolute', left: -420, top: 330, width: 840, opacity: Math.min(1, meter * 1.5), transform: `scale(${0.8 + 0.2 * meter})`}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 24, fontFamily: MONO, fontWeight: 800, fontSize: 96, color: '#FFFFFF'}}>
              НАГРУЗКА
              <div style={{display: 'flex', gap: 10}}>{Array.from({length: 8}, (_, i) => <div key={i} style={{width: 34, height: 90, background: i < 2 ? '#FFFFFF' : 'rgba(243,244,242,.18)'}} />)}</div>
              <span style={{color: '#FFFFFF', background: HUD.red, padding: '0 18px'}}>✓</span>
            </div>
          </div>
        ) : null}
        {/* узел 2: Claude Code — мозг */}
        <div style={{position: 'absolute', left: 1150 - 330, top: -230, width: 660, height: 460, background: '#0C0C0D', border: '3px solid rgba(243,244,242,.85)', borderRadius: 20,
          boxShadow: '0 0 60px rgba(255,255,255,.08), 0 30px 60px rgba(0,0,0,.6)'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 16, padding: '20px 26px', borderBottom: '2px solid rgba(243,244,242,.25)'}}>
            <Logo name="claude" size={52} />
            <span style={{fontFamily: SANS, fontWeight: 700, fontSize: 46, color: '#FFFFFF'}}>Claude Code</span>
          </div>
          <div style={{padding: '22px 28px', fontFamily: MONO, fontSize: 36, lineHeight: 1.6, color: HUD.ink}}>
            <div><Typed t={t} at={15.9} text="› hey jarvis" cps={24} /></div>
            {t > 16.6 ? <div style={{opacity: 0.7}}>● думаю…</div> : null}
            {t > 17.2 ? <div><span style={{color: HUD.red}}>✓</span> ответ готов</div> : null}
          </div>
        </div>
        <div style={{position: 'absolute', left: 1150 - 330, top: -320, fontFamily: MONO, fontWeight: 800, fontSize: 40, color: '#FFFFFF', background: HUD.red, padding: '4px 18px',
          opacity: k(t, 15.9, 16.2)}}>МОЗГ</div>
        {key > 0 ? (
          <div style={{position: 'absolute', left: 1150 - 260, top: 290, width: 520, height: 100, display: 'flex', alignItems: 'center', gap: 20, padding: '0 28px',
            background: 'rgba(12,12,13,.9)', border: '2px solid rgba(243,244,242,.6)', opacity: Math.min(1, key * 1.5) * (1 - 0.45 * strike), transform: `translateY(${(1 - key) * 30}px)`}}>
            <svg width={60} height={36} viewBox="0 0 60 36"><circle cx={16} cy={18} r={12} fill="none" stroke="#FFF" strokeWidth={5} /><path d="M28 18 H56 M48 18 V30 M40 18 V27" stroke="#FFF" strokeWidth={5} fill="none" /></svg>
            <span style={{fontFamily: SANS, fontWeight: 700, fontSize: 48, color: '#FFFFFF'}}>API-ключ</span>
            <div style={{position: 'absolute', left: -20, top: 46, height: 8, width: 560 * strike, background: HUD.red, transform: 'rotate(-8deg)', transformOrigin: 'left', boxShadow: `0 0 20px ${HUD.red}`}} />
          </div>
        ) : null}
        {strike > 0.5 ? <div style={{position: 'absolute', left: 1150 + 290, top: 318, fontFamily: MONO, fontWeight: 800, fontSize: 40, color: HUD.red, whiteSpace: 'nowrap', opacity: k(t, 17.8, 18.0)}}>НЕ НУЖЕН</div> : null}
        {/* узел 3: серверы Anthropic */}
        <div style={{position: 'absolute', left: 2300 - 260, top: -250, width: 520}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 26}}>
            <Logo name="anthropic" size={70} white />
            <span style={{fontFamily: SANS, fontWeight: 700, fontSize: 52, color: '#FFFFFF'}}>Anthropic</span>
          </div>
          {[0, 1, 2].map((r) => (
            <div key={r} style={{height: 96, marginBottom: 14, border: '3px solid rgba(243,244,242,.8)', background: '#0C0C0D', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 14}}>
              {Array.from({length: 6}, (_, i) => <div key={i} style={{width: 16, height: 16, borderRadius: 8, background: random(`led${r}${i}${Math.floor(t * 6)}`) > 0.45 ? (i === 0 ? HUD.red : '#FFFFFF') : 'rgba(243,244,242,.2)'}} />)}
              <div style={{marginLeft: 'auto', width: 170, height: 10, background: 'rgba(243,244,242,.25)'}} />
            </div>
          ))}
          <div style={{textAlign: 'center', fontFamily: SANS, fontWeight: 700, fontSize: 48, color: HUD.ink, marginTop: 14}}>модель на их серверах</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ——— 5. Рабочий стол Джарвиса 22,95–34,6, весь кадр: панели задач вокруг реактора ———
const DR = {x: 648, y: 860};
const PANELS = [
  {id: 'news', at: 25.68, x: 144, y: 300, w: 470, h: 300, label: 'ИИ · 7 ДНЕЙ', ax: 614, ay: 600},
  {id: 'sales', at: 27.68, x: 682, y: 300, w: 470, h: 300, label: 'ПРОДАЖИ', ax: 682, ay: 600},
  {id: 'ads', at: 29.81, x: 144, y: 1110, w: 470, h: 290, label: 'РЕКЛАМА', ax: 614, ay: 1110},
  {id: 'blog', at: 31.3, x: 682, y: 1110, w: 470, h: 290, label: 'БЛОГ', ax: 682, ay: 1110},
];
const Desk: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const sweep = k(t, 32.3, 33.4, E.inOut), all = t > 32.3 ? 0.5 + 0.5 * Math.sin((t - 32.3) * 8) : 0;
  return (
    <AbsoluteFill style={{background: HUD.bg}}>
      <CodeRain t={t} opacity={0.13} />
      <HudGrid opacity={0.7} />
      <Title y={196} size={44} text="J.A.R.V.I.S. · ONLINE" />
      <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
        {PANELS.map((p) => {
          const d = k(t, p.at, p.at + 0.3);
          if (d <= 0) return null;
          const ex = lerp(DR.x, p.ax, d), ey = lerp(DR.y, p.ay, d);
          return (
            <g key={p.id}>
              <line x1={DR.x} y1={DR.y} x2={ex} y2={ey} stroke={HUD.ink} strokeOpacity={0.5} strokeWidth={3} strokeDasharray="12 10" />
              {d >= 1 ? [0, 0.5].map((o) => { const q = (t * 1.2 + o) % 1; return <circle key={o} cx={lerp(DR.x, p.ax, q)} cy={lerp(DR.y, p.ay, q)} r={8} fill={HUD.red} />; }) : null}
            </g>
          );
        })}
      </svg>
      <Reactor id="dk" cx={DR.x} cy={DR.y} r={140} t={t} boot={interpolate(t, [22.8, 24.0], [0.3, 1], cl)} energy={Math.min(1, 0.5 + 0.5 * venv(t) + 0.3 * all)} bars={vbars(t)} />
      <Panel t={t} {...PANELS[0]} flash={all}>
        {['новые модели', 'агенты и MCP', 'open source'].map((s, i) => (
          <div key={s} style={{fontFamily: SANS, fontWeight: 600, fontSize: 40, color: '#FFFFFF', lineHeight: '64px', opacity: k(t, 26.0 + i * 0.3, 26.2 + i * 0.3)}}>
            <span style={{color: HUD.red, marginRight: 14}}>▸</span>{s}
          </div>
        ))}
      </Panel>
      <Panel t={t} {...PANELS[1]} flash={all}>
        <svg width={422} height={190} style={{position: 'absolute', left: 0, top: 6}}>
          {Array.from({length: 8}, (_, i) => {
            const hgt = (40 + i * 18 + (i % 3) * 14) * sp(t, 27.9 + i * 0.07, fps, 13, 160);
            return <rect key={i} x={8 + i * 51} y={186 - hgt} width={36} height={hgt} fill={i === 7 ? HUD.red : '#FFFFFF'} fillOpacity={i === 7 ? 1 : 0.85} />;
          })}
          <polyline points={Array.from({length: 8}, (_, i) => `${26 + i * 51},${150 - i * 18 - (i % 3) * 10}`).join(' ')} fill="none" stroke={HUD.red} strokeWidth={4} pathLength={1} strokeDasharray={`${k(t, 28.3, 29.0)} 1`} />
        </svg>
      </Panel>
      <Panel t={t} {...PANELS[2]} flash={all}>
        {['аудитории', 'креативы', 'бюджет'].map((s, i) => {
          const on = k(t, 30.1 + i * 0.28, 30.3 + i * 0.28);
          return (
            <div key={s} style={{display: 'flex', alignItems: 'center', height: 62, fontFamily: SANS, fontWeight: 600, fontSize: 40, color: '#FFFFFF'}}>
              {s}
              <div style={{marginLeft: 'auto', width: 76, height: 40, borderRadius: 20, background: on > 0.5 ? HUD.red : 'rgba(243,244,242,.2)', position: 'relative'}}>
                <div style={{position: 'absolute', top: 5, left: 5 + 36 * on, width: 30, height: 30, borderRadius: 15, background: '#FFFFFF'}} />
              </div>
            </div>
          );
        })}
      </Panel>
      <Panel t={t} {...PANELS[3]} flash={all}>
        <div style={{display: 'flex', gap: 20}}>
          <div style={{width: 150, height: 150, background: 'linear-gradient(135deg, #2A2A2D, #0E0E10)', border: '2px solid rgba(243,244,242,.4)', position: 'relative', flex: 'none'}}>
            <svg width={150} height={150} style={{position: 'absolute', left: 0, top: 0}}><polygon points={triPts(75, 70, 40)} fill="none" stroke={HUD.ink} strokeWidth={4} /></svg>
          </div>
          <div style={{flex: 1}}>
            {[1, 0.8, 0.6].map((w, i) => <div key={i} style={{height: 16, width: `${w * 100 * k(t, 31.5 + i * 0.15, 31.8 + i * 0.15)}%`, background: 'rgba(243,244,242,.45)', marginBottom: 16}} />)}
            <div style={{display: 'inline-block', marginTop: 6, padding: '4px 14px', border: `2px solid ${HUD.red}`, color: '#FFFFFF', fontFamily: MONO, fontWeight: 800, fontSize: 30,
              opacity: k(t, 31.9, 32.1)}}>ПОСТ ГОТОВ</div>
          </div>
        </div>
      </Panel>
      {sweep > 0 && sweep < 1 ? <div style={{position: 'absolute', left: 0, top: sweep * 1480 + 180, width: W, height: 4, background: '#FFFFFF', boxShadow: `0 0 30px #fff, 0 0 60px ${HUD.red}`}} /> : null}
    </AbsoluteFill>
  );
};

// ——— 6. Утренний разбор 34,6–39,65: почта и календарь выходят на орбиту реактора, карточка разбора ———
const Brief: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const RC = {x: 380, y: 640};
  const orb = (name: string, at: number, ph: number) => {
    const a = sp(t, at, fps, 13, 120);
    if (a <= 0) return null;
    const ang = ph + (t - at) * 55, rx = 230, ry = 95;
    const x = RC.x + rx * Math.cos((ang * Math.PI) / 180), y = RC.y + ry * Math.sin((ang * Math.PI) / 180), d = 0.82 + 0.25 * Math.sin((ang * Math.PI) / 180);
    const fx = lerp(1300, x, a), fy = lerp(300, y, a);
    return (
      <div key={name} style={{position: 'absolute', left: fx - 44, top: fy - 44, width: 88, height: 88, borderRadius: 22, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: `scale(${d})`, zIndex: Math.sin((ang * Math.PI) / 180) > 0 ? 3 : 1, boxShadow: '0 0 30px rgba(255,255,255,.25), 0 14px 30px rgba(0,0,0,.6)'}}>
        <Logo name={name} size={60} />
      </div>
    );
  };
  const rows: [string | null, string, number][] = [['gmail', '3 письма ждут', 37.1], ['googlecalendar', 'созвон в 11:00', 37.5], [null, 'план на день', 37.9]];
  return (
    <AbsoluteFill style={{background: HUD.bg}}>
      <div style={{position: 'absolute', left: -300, top: 700, width: 2040, height: 1200, background: 'radial-gradient(closest-side, rgba(255,46,62,.16), rgba(255,46,62,0))'}} />
      <HudGrid opacity={0.5} />
      <svg width={W} height={1280} style={{position: 'absolute', left: 0, top: 0}}>
        {[280, 380, 480].map((r, i) => <ellipse key={r} cx={RC.x} cy={RC.y} rx={r} ry={r * 0.41} fill="none" stroke={HUD.ink} strokeOpacity={0.12 + i * 0.04} strokeWidth={2} strokeDasharray={i === 1 ? '10 12' : undefined} />)}
      </svg>
      <div style={{position: 'absolute', inset: 0, zIndex: 2}}>
        <Reactor id="bf" cx={RC.x} cy={RC.y} r={120} t={t} energy={0.5 + 0.5 * venv(t)} bars={vbars(t)} />
      </div>
      <div style={{position: 'absolute', inset: 0}}>{orb('gmail', 35.3, 200)}{orb('googlecalendar', 35.74, 20)}</div>
      <div style={{position: 'absolute', left: RC.x - 150, top: 880, width: 300, textAlign: 'center', fontFamily: SANS, fontWeight: 600, fontSize: 40, color: '#FFFFFF',
        border: '2px dashed rgba(243,244,242,.6)', padding: '8px 0', opacity: k(t, 35.0, 35.3)}}>подключишь</div>
      <Panel t={t} at={36.45} x={660} y={300} w={492} h={620} label="08:00 · РАЗБОР">
        {rows.map(([logo, s, at]) => (
          <div key={s} style={{display: 'flex', alignItems: 'center', gap: 16, height: 86, opacity: k(t, at, at + 0.2), transform: `translateX(${(1 - k(t, at, at + 0.25, E.out)) * 30}px)`}}>
            {logo ? <div style={{width: 54, height: 54, borderRadius: 12, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><Logo name={logo} size={38} /></div>
              : <div style={{width: 54, height: 54, border: `3px solid ${HUD.red}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontFamily: MONO, fontWeight: 800, fontSize: 30}}>✓</div>}
            <span style={{fontFamily: SANS, fontWeight: 600, fontSize: 40, color: '#FFFFFF'}}>{s}</span>
          </div>
        ))}
        {t > 38.6 ? (
          <div style={{position: 'absolute', left: 0, right: 0, bottom: 10, height: 110, display: 'flex', alignItems: 'center', gap: 8}}>
            <span style={{fontFamily: MONO, fontWeight: 800, fontSize: 30, color: HUD.red, marginRight: 8}}>▶</span>
            {synth(t).concat(synth(t + 0.3)).slice(0, 30).map((v, i) => <div key={i} style={{width: 8, height: 12 + 80 * v * k(t, 38.6, 38.9), background: '#FFFFFF', opacity: 0.85}} />)}
          </div>
        ) : null}
      </Panel>
    </AbsoluteFill>
  );
};

// ——— 7. Доступ 39,65–43,15, белая зона: только чтение, отправка по твоему разрешению ———
const LockIcon: React.FC<{open: number; color: string; size?: number}> = ({open, color, size = 44}) => (
  <svg width={size} height={size * 1.1} viewBox="0 0 40 44">
    <path d={`M11 20 V13 a9 9 0 0 1 18 0 V${lerp(20, 12, open)}`} fill="none" stroke={color} strokeWidth={4.5} transform={`translate(0 ${-5 * open})`} />
    <rect x={6} y={19} width={28} height={22} rx={4} fill={color} />
  </svg>
);
const Locks: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const dlg = sp(t, 41.6, fps, 12, 180), dlgOut = k(t, 42.75, 43.0);
  const click = k(t, 42.45, 42.55) * (1 - k(t, 42.55, 42.7));
  const open = k(t, 42.8, 43.05, E.out);
  const rows: [string, boolean, number][] = [['читать почту', true, 39.75], ['читать календарь', true, 39.95], ['отправлять', false, 40.1], ['удалять', false, 40.5]];
  const cur = {x: lerp(1180, 935, k(t, 41.9, 42.4, E.inOut)), y: lerp(1180, 985, k(t, 41.9, 42.4, E.inOut))};
  return (
    <AbsoluteFill style={{background: HUD.paper}}>
      <HudGrid color="#000" opacity={0.55} vignette={false} />
      <div style={{position: 'absolute', left: 190, top: 300, width: 920, height: 520, background: '#FFFFFF', border: '3px solid #0A0A0B', boxShadow: '0 30px 60px rgba(0,0,0,.18)'}}>
        <div style={{display: 'flex', alignItems: 'center', padding: '22px 30px', borderBottom: '2px solid rgba(10,10,11,.2)'}}>
          <span style={{fontFamily: MONO, fontWeight: 800, fontSize: 36, color: '#0A0A0B', letterSpacing: '0.08em'}}>ДОСТУП</span>
          <span style={{marginLeft: 'auto', fontFamily: SANS, fontWeight: 700, fontSize: 40, color: '#0A0A0B', marginRight: 18}}>только чтение</span>
          <div style={{width: 90, height: 48, borderRadius: 24, background: '#0A0A0B', position: 'relative'}}>
            <div style={{position: 'absolute', top: 6, left: 48, width: 36, height: 36, borderRadius: 18, background: HUD.red}} />
          </div>
        </div>
        {rows.map(([s, ok, at], i) => {
          const isSend = s === 'отправлять';
          return (
            <div key={s} style={{display: 'flex', alignItems: 'center', height: 100, padding: '0 30px', borderBottom: i < 3 ? '2px solid rgba(10,10,11,.08)' : undefined, opacity: k(t, at, at + 0.2),
              transform: `translateX(${(1 - k(t, at, at + 0.25, E.out)) * -30}px)`}}>
              <span style={{fontFamily: SANS, fontWeight: 600, fontSize: 48, color: '#0A0A0B'}}>{s}</span>
              <div style={{marginLeft: 'auto'}}>
                {ok || (isSend && open > 0.6) ? <span style={{fontFamily: MONO, fontWeight: 800, fontSize: 48, color: '#0A0A0B'}}>✓</span>
                  : <LockIcon open={isSend ? open : 0} color={HUD.red} />}
              </div>
            </div>
          );
        })}
      </div>
      {dlg > 0 && dlgOut < 1 ? (
        <div style={{position: 'absolute', left: 330, top: 850, width: 780, height: 220, background: '#0A0A0B', opacity: Math.min(1, dlg * 1.5) * (1 - dlgOut),
          transform: `translateY(${(1 - dlg) * 40}px) scale(${0.92 + 0.08 * dlg})`, boxShadow: '0 30px 60px rgba(0,0,0,.35)'}}>
          <div style={{padding: '26px 34px', fontFamily: SANS, fontWeight: 700, fontSize: 46, color: '#FFFFFF'}}>Отправить письмо?</div>
          <div style={{position: 'absolute', right: 34, bottom: 28, display: 'flex', gap: 20}}>
            <div style={{padding: '10px 30px', border: '2px solid rgba(255,255,255,.6)', fontFamily: SANS, fontWeight: 700, fontSize: 38, color: '#FFFFFF'}}>Нет</div>
            <div style={{padding: '10px 30px', background: HUD.red, fontFamily: SANS, fontWeight: 700, fontSize: 38, color: '#FFFFFF', transform: `scale(${1 - 0.08 * click})`}}>Разрешить</div>
          </div>
        </div>
      ) : null}
      {t > 41.8 && t < 43.0 ? (
        <svg width={48} height={60} style={{position: 'absolute', left: cur.x, top: cur.y}} viewBox="0 0 24 30">
          <path d="M2 2 L2 24 L8 18 L12 28 L16 26 L12 17 L20 17 Z" fill="#FFFFFF" stroke="#0A0A0B" strokeWidth={2} strokeLinejoin="round" />
        </svg>
      ) : null}
    </AbsoluteFill>
  );
};

// ——— 8. Поделись 43,15–46,65, весь кадр: туннель треугольников, самолётик другу, мечта детства — реактор ———
const Share: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const btn = sp(t, 43.3, fps, 11, 170), fly = k(t, 43.65, 44.15, E.inOut), gone = k(t, 44.5, 44.8);
  const px = lerp(720, 1010, fly), py = lerp(820, 470, fly) - Math.sin(fly * Math.PI) * 120;
  const dream = k(t, 44.6, 45.4, E.out);
  return (
    <AbsoluteFill style={{background: HUD.bg}}>
      <TriTunnel t={t} cx={720} cy={900} speed={0.45} opacity={0.9} spin={20} />
      <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 36%, rgba(0,0,0,0) 30%, rgba(0,0,0,.75) 80%)'}} />
      <div style={{position: 'absolute', left: 0, width: W, top: 250, textAlign: 'center', fontFamily: MONO, fontWeight: 800, fontSize: 44, letterSpacing: '0.16em', color: '#FFFFFF',
        opacity: k(t, 43.4, 43.7) * (1 - gone)}}>ОТПРАВЬ ДРУГУ</div>
      {btn > 0 && gone < 1 ? (
        <div style={{opacity: 1 - gone}}>
          <div style={{position: 'absolute', left: 720 - 150, top: 820 - 150, width: 300, height: 300, borderRadius: 150, border: '4px solid #FFFFFF', transform: `scale(${btn})`,
            boxShadow: '0 0 40px rgba(255,255,255,.25)'}} />
          <svg width={150} height={150} viewBox="0 0 24 24" style={{position: 'absolute', left: px - 75, top: py - 75, transform: `rotate(${fly * 20}deg) scale(${btn * (1 - 0.35 * fly)})`}}>
            <path d="M22 2 L11 13 M22 2 L15 22 L11 13 L2 9 Z" fill="none" stroke="#FFFFFF" strokeWidth={1.8} strokeLinejoin="round" />
          </svg>
          <div style={{position: 'absolute', left: 1010 - 90, top: 470 - 90, width: 180, height: 180, borderRadius: 90, border: `4px solid ${fly >= 1 ? HUD.red : 'rgba(243,244,242,.6)'}`,
            opacity: k(t, 43.5, 43.8), background: 'rgba(12,12,13,.8)', boxShadow: fly >= 1 ? `0 0 40px ${HUD.red}` : undefined, overflow: 'hidden'}}>
            <svg width={180} height={180}><circle cx={90} cy={72} r={30} fill="rgba(243,244,242,.75)" /><ellipse cx={90} cy={160} rx={58} ry={46} fill="rgba(243,244,242,.75)" /></svg>
          </div>
          {fly >= 1 ? <div style={{position: 'absolute', left: 1010 - 150, top: 580, width: 300, textAlign: 'center', fontFamily: MONO, fontWeight: 800, fontSize: 36, color: '#FFFFFF'}}>✓ ОТПРАВЛЕНО</div> : null}
        </div>
      ) : null}
      {dream > 0 ? (
        <>
          <Reactor id="sh" cx={720} cy={880} r={lerp(120, 290, dream)} t={t} boot={lerp(0.4, 1, dream)} energy={0.6 + 0.4 * venv(t)} bars={vbars(t)} opacity={dream} />
          <Title y={230} size={64} opacity={dream} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};

// ——— 9. Призыв 46,65–51,1: комментарий «ДЖАРВИС» → ссылка → Claude Code сам ставит ———
const Cta: React.FC<{t: number; fps: number}> = ({t, fps}) => {
  const c1 = sp(t, 46.75, fps, 12, 180), c2 = sp(t, 48.09, fps, 12, 180), c3 = sp(t, 48.85, fps, 12, 170);
  const done = t > 50.3;
  return (
    <AbsoluteFill style={{background: HUD.bg}}>
      <HudGrid />
      <Telemetry t={t} x={1396} y={200} seed="ct" rows={3} align="right" />
      {c1 > 0 ? (
        <div style={{position: 'absolute', left: 170, top: 250, width: 940, display: 'flex', alignItems: 'center', gap: 22, padding: '22px 28px', background: 'rgba(14,14,15,.9)',
          border: '2px solid rgba(243,244,242,.5)', opacity: Math.min(1, c1 * 1.5), transform: `translateY(${(1 - c1) * -30}px)`}}>
          <Logo name="instagram" size={64} white />
          <div>
            <div style={{fontFamily: MONO, fontWeight: 700, fontSize: 28, color: HUD.dim, letterSpacing: '0.1em'}}>КОММЕНТАРИЙ</div>
            <div style={{fontFamily: SANS, fontWeight: 800, fontSize: 62, color: '#FFFFFF'}}><Typed t={t} at={46.99} text="ДЖАРВИС" cps={20} /></div>
          </div>
        </div>
      ) : null}
      {c2 > 0 ? (
        <div style={{position: 'absolute', left: 330, top: 450, width: 780, display: 'flex', alignItems: 'center', gap: 18, padding: '18px 26px', background: HUD.red,
          opacity: Math.min(1, c2 * 1.5), transform: `translateX(${(1 - c2) * 60}px)`, boxShadow: `0 0 40px rgba(255,46,62,.5)`}}>
          <Logo name="github" size={48} white />
          <span style={{fontFamily: MONO, fontWeight: 700, fontSize: 34, color: '#FFFFFF'}}>github.com/adewaskar/jarvis</span>
        </div>
      ) : null}
      {c3 > 0 ? (
        <div style={{position: 'absolute', left: 170, top: 610, width: 940, height: 440, background: '#0C0C0D', border: '3px solid rgba(243,244,242,.85)', borderRadius: 18,
          opacity: Math.min(1, c3 * 1.5), transform: `translateY(${(1 - c3) * 50}px) scale(${0.92 + 0.08 * c3})`, boxShadow: '0 30px 60px rgba(0,0,0,.6)'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 16, padding: '18px 26px', borderBottom: '2px solid rgba(243,244,242,.25)'}}>
            <Logo name="claude" size={48} />
            <span style={{fontFamily: SANS, fontWeight: 700, fontSize: 44, color: '#FFFFFF'}}>Claude Code</span>
          </div>
          <div style={{padding: '20px 28px', fontFamily: MONO, fontSize: 36, lineHeight: 1.55, color: HUD.ink}}>
            <div><Typed t={t} at={49.0} text="› установи это" cps={26} /></div>
            {t > 49.55 ? <div style={{opacity: 0.8}}>  github.com/adewaskar/jarvis</div> : null}
            {t > 49.9 ? <div style={{opacity: 0.7}}>● ставлю зависимости…</div> : null}
            {done ? <div style={{color: '#FFFFFF', fontWeight: 800}}><span style={{color: HUD.red}}>✓</span> J.A.R.V.I.S. установлен</div> : null}
          </div>
          <Reactor id="ct" cx={860} cy={70} r={40} t={t} boot={done ? 1 : 0.3} energy={done ? 1 : 0.2} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ——— сборка и переходы ———
type Tr = 'glitch' | 'iris' | 'scan';
const BLOCKS: {a: number; b: number; C: React.FC<{t: number; fps: number}>; iris?: [number, number]}[] = [
  {a: 0, b: 6.25, C: Hook}, {a: 6.25, b: 8.3, C: Github}, {a: 8.3, b: 14.85, C: Core, iris: [720, 900]}, {a: 14.85, b: 22.95, C: Brain},
  {a: 22.95, b: 34.6, C: Desk, iris: [648, 860]}, {a: 34.6, b: 39.65, C: Brief}, {a: 39.65, b: 43.15, C: Locks}, {a: 43.15, b: 46.65, C: Share, iris: [720, 900]}, {a: 46.65, b: END29, C: Cta},
];
const TR: Tr[] = ['glitch', 'iris', 'scan', 'iris', 'scan', 'glitch', 'iris', 'scan'];

const blockStyle = (t: number, i: number): React.CSSProperties | null => {
  const B = BLOCKS[i], inTr = i > 0 ? TR[i - 1] : null, outTr = i < TR.length ? TR[i] : null;
  const st: React.CSSProperties = {};
  if (inTr) {
    const c = B.a;
    if (inTr === 'iris') { if (t < c - 0.3) return null; const R = interpolate(t, [c - 0.3, c + 0.4], [0, 3400], {...cl, easing: E.inOut}); const [x, y] = B.iris ?? [720, 900];
      if (R < 3400) st.clipPath = `polygon(${[90, 210, 330].map((a) => `${x + R * Math.cos((a * Math.PI) / 180)}px ${y + R * Math.sin((a * Math.PI) / 180)}px`).join(',')})`; }
    if (inTr === 'scan') { if (t < c - 0.3) return null; const q = k(t, c - 0.3, c + 0.3, E.inOut); if (q < 1) st.clipPath = `inset(0 0 ${100 - q * 100}% 0)`; }
    if (inTr === 'glitch' && t < c) return null;
  }
  if (outTr) {
    const c = B.b;
    if (outTr === 'iris') { if (t > c + 0.3) return null; const p = k(t, c - 0.3, c + 0.3); if (p > 0) { st.transform = `scale(${1 + 0.12 * p})`; st.filter = `blur(${p * 8}px)`; st.opacity = 1 - p; } }
    if (outTr === 'scan') { if (t > c + 0.15) return null; const p = k(t, c - 0.3, c + 0.15); if (p > 0) { st.transform = `translateY(${-50 * p}px)`; st.filter = `blur(${p * 6}px)`; st.opacity = 1 - p; } }
    if (outTr === 'glitch' && t >= c) return null;
  }
  return st;
};

const Glitch: React.FC<{t: number}> = ({t}) => {
  const hits = [6.25, 39.65].map((c) => 1 - Math.min(1, Math.abs(t - c) / 0.16)).filter((g) => g > 0);
  if (!hits.length) return null;
  const g = hits[0], f = Math.floor(t * 60);
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: W, height: 1280, overflow: 'hidden', pointerEvents: 'none'}}>
      {Array.from({length: 9}, (_, i) => {
        const y = random(`gy${f}${i}`) * 1280, h = 6 + random(`gh${f}${i}`) * 60;
        return <div key={i} style={{position: 'absolute', left: (random(`gx${f}${i}`) - 0.5) * 200 * g, top: y, width: W, height: h, background: i % 3 === 0 ? HUD.red : '#FFFFFF', opacity: 0.55 * g * random(`go${f}${i}`)}} />;
      })}
    </div>
  );
};

const IrisEdge: React.FC<{t: number}> = ({t}) => {
  const i = BLOCKS.findIndex((B, j) => j > 0 && TR[j - 1] === 'iris' && t >= B.a - 0.3 && t <= B.a + 0.4);
  if (i < 0) return null;
  const B = BLOCKS[i], R = interpolate(t, [B.a - 0.3, B.a + 0.4], [0, 3400], {...cl, easing: E.inOut}), [x, y] = B.iris ?? [720, 900];
  return (
    <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
      <polygon points={triPts(x, y, R)} fill="none" stroke="#FFFFFF" strokeWidth={10} strokeLinejoin="round" style={{filter: `drop-shadow(0 0 18px ${HUD.red})`}} />
      <polygon points={triPts(x, y, R * 0.94)} fill="none" stroke={HUD.red} strokeWidth={5} strokeLinejoin="round" />
    </svg>
  );
};

const ScanEdge: React.FC<{t: number}> = ({t}) => {
  const i = BLOCKS.findIndex((B, j) => j > 0 && TR[j - 1] === 'scan' && t >= B.a - 0.3 && t <= B.a + 0.3);
  if (i < 0) return null;
  const q = k(t, BLOCKS[i].a - 0.3, BLOCKS[i].a + 0.3, E.inOut);
  return <div style={{position: 'absolute', left: 0, top: q * H - 3, width: W, height: 6, background: '#FFFFFF', boxShadow: `0 0 30px #fff, 0 -20px 60px ${HUD.red}`}} />;
};

// Звуки по смыслу действия (правка Александра 26.09.2026: трескучие «дрожание», «блюр выход», «трансформация» и
// «механический зум» звучали как бьющееся стекло — убраны). Пак onai-apple-pack: вуши, печать, переключатель, счётчик,
// выспышка, нарастающий гул запуска (развёрнутый DA Whoosh). Новый пак SFX (AAMIR.VFX): Select / Crispy Click — захват
// цели, UI pop — появление карточки, Notification — диалог и входящее, Confirm — «разрешено» и «установлен», Chime —
// «система в сети» и пробуждение. Glass из нового пака не берётся. Громкость ×0,37 от исходной.
const SFX: [number, string, number][] = [
  [0, 'rise', 0.45], [0.1, 'type', 0.22], [0.9, 'chime', 0.3], [2.35, 'switch', 0.3], [4.8, 'pop', 0.35],
  [6.15, 'whip-a', 0.4], [6.85, 'select', 0.35], [7.3, 'crispy', 0.35], [7.62, 'select', 0.3],
  [7.95, 'whoosh', 0.45], [8.3, 'flash', 0.35], [10.3, 'chime', 0.3], [CUT, 'switch', 0.45],
  [14.5, 'whip-a', 0.4], [15.45, 'whip-b', 0.22], [16.98, 'pop', 0.35], [17.55, 'crispy', 0.35], [18.4, 'whip-b', 0.22], [20.95, 'whip-b', 0.22], [21.8, 'counter', 0.35],
  [22.6, 'whoosh', 0.45], [23.1, 'confirm', 0.3], [25.68, 'notif', 0.28], [27.68, 'select', 0.3], [27.9, 'counter', 0.3], [29.81, 'switch', 0.3], [31.3, 'pop', 0.35], [32.3, 'whip-b', 0.25],
  [34.3, 'whip-a', 0.4], [35.3, 'pop', 0.35], [35.74, 'pop', 0.35], [36.45, 'type', 0.25],
  [39.55, 'whip-a', 0.4], [40.1, 'crispy', 0.3], [41.6, 'notif', 0.3], [42.5, 'confirm', 0.35],
  [42.8, 'whoosh', 0.45], [43.65, 'whip-b', 0.4], [44.15, 'notif', 0.25], [44.6, 'rise', 0.35],
  [46.3, 'whip-a', 0.4], [46.99, 'type', 0.25], [48.09, 'notif', 0.28], [48.85, 'pop', 0.35], [49.0, 'type', 0.22], [50.3, 'confirm', 0.35],
];

export const Reel29: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const m = modeAt(t);
  const shake = BLOCKS.some((B, j) => j > 0 && TR[j - 1] === 'glitch' && Math.abs(t - B.a) < 0.16) ? (random(`sh${frame}`) - 0.5) * 24 : 0;
  return (
    <AbsoluteFill style={{background: HUD.bg}}>
      <div style={{position: 'absolute', inset: 0, transform: shake ? `translateX(${shake}px)` : undefined}}>
        {BLOCKS.map((B, i) => {
          if (t < B.a - 0.6 || t > B.b + 0.6) return null;
          const st = blockStyle(t, i);
          if (!st) return null;
          return <div key={i} style={{position: 'absolute', inset: 0, overflow: 'hidden', ...st}}><B.C t={t} fps={fps} /></div>;
        })}
      </div>
      <IrisEdge t={t} />
      <ScanEdge t={t} />
      <Glitch t={t} />
      <Speaker t={t} m={m} />
      <Captions t={t} words={WORDS29} cx={690} cy={lerp(1157, 1467, m)} maxW={900} family={SANS} weight={700} accent={HUD.red} />
      <Audio src={staticFile('jv/voice.wav')} />
      {SFX.map(([at, name, v], i) => (
        <Sequence key={i} from={Math.round(at * fps)} durationInFrames={Math.round(2 * fps)} layout="none">
          <Audio src={staticFile(`sfx/r29/${name}.wav`)} volume={v * 0.37} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
