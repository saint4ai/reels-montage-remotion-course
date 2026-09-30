import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';

// Раскадровка Tildify (27.09.2026): проба пары шрифтов Александра на трёх экспозициях ролика.
// Coolvetica — акцентное слово (роль курсивной антиквы референса «Feels Lucky»), SF Pro Display — весь остальной текст.
// Приёмы референса: светлый лист с тонкой сеткой, бледные косые плоскости, акцентное слово на цветной плашке с тенью,
// мелкий абзац под заголовком, скобка-коннектор с узлами, выделение текста с «ручками», чёрные мазки-стрелки по углам.
// Акцент — оранжевый ONai вместо синего референса (синий в палитре запрещён). Спикер — карточка внизу, как в правилах ONai.
const CX = 720, INK = '#111316', ORANGE = '#FF7A2F', PAPER = '#F6F5F1', GREY = '#6B7078';
const SF = 'SF Pro Display', CV = 'Coolvetica';

const Paper: React.FC = () => (
  <AbsoluteFill style={{background: PAPER}}>
    <AbsoluteFill style={{backgroundImage: 'linear-gradient(rgba(17,19,22,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(17,19,22,.045) 1px, transparent 1px)',
      backgroundSize: '48px 48px'}} />
    <div style={{position: 'absolute', left: 520, top: -260, width: 900, height: 620, background: 'rgba(17,19,22,.035)', transform: 'rotate(28deg)'}} />
    <div style={{position: 'absolute', left: -320, top: 1320, width: 820, height: 560, background: 'rgba(17,19,22,.03)', transform: 'rotate(-32deg)'}} />
  </AbsoluteFill>
);
// Чёрный мазок-стрелка (угловой акцент референса): жирный клин-наконечник и толстое древко с рваным хвостом, смаз движения
const Arrow: React.FC<{x: number; y: number; r: number; s?: number}> = ({x, y, r, s = 1}) => (
  <svg width={360 * s} height={360 * s} viewBox="0 0 100 100" style={{position: 'absolute', left: x, top: y, transform: `rotate(${r}deg)`, filter: 'drop-shadow(0 14px 16px rgba(0,0,0,.28))'}}>
    <path d="M 2 92 L 10 80 L 52 42 L 60 50 L 18 94 L 8 99 Z" fill={INK} opacity={0.35} transform="translate(-4 4)" />
    <path d="M 4 90 L 14 82 L 56 40 L 64 48 L 20 92 L 10 97 Z" fill={INK} />
    <path d="M 38 30 L 98 2 L 70 62 L 62 46 L 54 38 Z" fill={INK} />
  </svg>
);
// Акцентное слово на плашке: Coolvetica белым по оранжевому, лёгкий наклон, глубина — нижняя грань и тень
const Plate: React.FC<{text: string; y: number; size: number; r?: number}> = ({text, y, size, r = -2}) => (
  <div style={{position: 'absolute', left: CX, top: y, transform: `translateX(-50%) rotate(${r}deg)`, width: 'max-content', padding: `${size * 0.1}px ${size * 0.28}px ${size * 0.04}px`,
    background: ORANGE, borderRadius: 18, fontFamily: CV, fontSize: size, lineHeight: 1, color: '#FFFFFF', letterSpacing: '0.005em',
    boxShadow: `inset 0 3px 0 rgba(255,255,255,.35), 0 10px 0 #C24F14, 0 34px 50px rgba(120,45,0,.28)`}}>{text}</div>
);
const Line: React.FC<{y: number; size: number; weight?: number; color?: string; children: React.ReactNode; w?: number}> = ({y, size, weight = 300, color = INK, children, w = 864}) => (
  <div style={{position: 'absolute', left: CX - w / 2, top: y, width: w, textAlign: 'center', fontFamily: SF, fontWeight: weight, fontSize: size, lineHeight: 1.15, color}}>{children}</div>
);
// Спикер: карточка Screen Studio внизу (база 32% высоты, 1080-сетка ×4/3), граница 2520, радиус 64
const Speaker: React.FC = () => (
  <div style={{position: 'absolute', left: CX - 432, top: 2520 - 819, width: 864, height: 819, borderRadius: 64, overflow: 'hidden',
    boxShadow: '0 0 0 4px rgba(255,255,255,.9), 0 40px 80px rgba(17,19,22,.25)'}}>
    <Img src={staticFile('tildify/face.jpg')} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 38%'}} />
  </div>
);
const Logo: React.FC<{src: string; size: number; x: number; y: number}> = ({src, size, x, y}) => (
  <div style={{position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: size * 0.26, background: '#FFFFFF', display: 'grid', placeItems: 'center',
    boxShadow: '0 2px 0 rgba(17,19,22,.06), 0 16px 30px rgba(17,19,22,.14)'}}>
    <Img src={staticFile(src)} style={{width: size * 0.62, height: size * 0.62, objectFit: 'contain'}} />
  </div>
);

// Экспозиция 1 — хук: «Сайт из Claude Code переносится в Тильду за 5 шагов»
const Hook: React.FC = () => (
  <>
    <Arrow x={1030} y={330} r={0} s={0.9} />
    <Arrow x={120} y={1320} r={180} s={0.8} />
    <Logo src="tildify/claude.svg" size={120} x={CX - 130} y={520} />
    <svg width={120} height={40} style={{position: 'absolute', left: CX - 60, top: 500}}><path d="M8 20 H100 M84 6 L104 20 L84 34" stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
    <Logo src="tildify/tilda-logo-a.svg" size={120} x={CX + 130} y={520} />
    <Line y={650} size={68}>Сайт из Claude Code</Line>
    <Line y={735} size={76} weight={500}>переносится в Тильду</Line>
    <div style={{position: 'absolute', left: CX - 150, top: 858, width: 300, height: 3, background: 'rgba(17,19,22,.25)'}} />
    <Plate text="за 5 шагов" y={900} size={176} />
    <Line y={1160} size={34} color={GREY} w={760}>сразу с мобильной версией, и больше не надо перевёрстывать всё руками</Line>
  </>
);

// Экспозиция 2 — шаг: «выбираешь, под какие экраны нужна версия» — скобка-коннектор, настоящий попап Tildify
const Step: React.FC = () => (
  <>
    <svg width={1440} height={1700} style={{position: 'absolute', left: 0, top: 0}}>
      <path d="M 350 470 H 316 Q 300 470 300 486 V 1520 Q 300 1560 340 1560 H 560" fill="none" stroke={INK} strokeWidth={6} strokeLinecap="round" />
    </svg>
    <div style={{position: 'absolute', left: 300 - 38, top: 432, width: 76, height: 76, borderRadius: 38, background: INK, color: '#FFFFFF', display: 'grid', placeItems: 'center',
      fontFamily: SF, fontWeight: 700, fontSize: 38}}>3</div>
    <div style={{position: 'absolute', left: 390, top: 440, fontFamily: SF, fontWeight: 300, fontSize: 64, color: INK}}>Выбираешь,</div>
    <div style={{position: 'absolute', left: 390, top: 520, fontFamily: CV, fontSize: 118, lineHeight: 1, color: ORANGE}}>под какие экраны</div>
    <div style={{position: 'absolute', left: 390, top: 650, width: 700, fontFamily: SF, fontWeight: 400, fontSize: 34, lineHeight: 1.3, color: GREY}}>
      Отмечаешь ширины, и расширение снимет блок сразу под них
    </div>
    <div style={{position: 'absolute', left: 520, top: 800, width: 560, height: 725, transform: 'rotate(2.5deg)', borderRadius: 26,
      boxShadow: '0 0 0 2px rgba(17,19,22,.06), 0 50px 90px rgba(17,19,22,.22)'}}>
      <Img src={staticFile('tildify/popup.png')} style={{width: '100%', height: '100%', objectFit: 'cover', borderRadius: 26}} />
      {/* кольцо вокруг ширин брейкпоинтов — куда смотреть */}
      <div style={{position: 'absolute', left: 52, top: 440, width: 440, height: 108, borderRadius: 26, border: `6px solid ${ORANGE}`, boxShadow: '0 0 0 10px rgba(255,122,47,.18)'}} />
    </div>
    <Arrow x={330} y={1150} r={0} s={0.6} />
    <div style={{position: 'absolute', left: 560 - 38, top: 1522, width: 76, height: 76, borderRadius: 38, background: '#FFFFFF', border: `6px solid ${INK}`, display: 'grid', placeItems: 'center'}}>
      <svg width={34} height={34} viewBox="0 0 24 24"><path d="M5 3 L19 12 L12 13.5 L9 20 Z" fill={INK} /></svg>
    </div>
  </>
);

// Экспозиция 3 — цена: выделение текста с ручками + акцент Coolvetica
const Price: React.FC = () => (
  <>
    <Arrow x={150} y={860} r={180} s={0.55} />
    <div style={{position: 'absolute', left: CX, top: 520, transform: 'translateX(-50%)', width: 'max-content', padding: '6px 18px', background: 'rgba(255,122,47,.26)',
      fontFamily: SF, fontWeight: 400, fontSize: 60, color: INK}}>
      Бесплатно <span style={{fontFamily: CV, fontSize: 74, color: ORANGE}}>10</span> переносов в месяц
      <div style={{position: 'absolute', left: -3, top: -18, width: 6, height: 104, background: ORANGE}}><div style={{position: 'absolute', left: -9, top: -12, width: 24, height: 24, borderRadius: 12, background: ORANGE}} /></div>
      <div style={{position: 'absolute', right: -3, top: 0, width: 6, height: 104, background: ORANGE}}><div style={{position: 'absolute', left: -9, bottom: -12, width: 24, height: 24, borderRadius: 12, background: ORANGE}} /></div>
    </div>
    <Line y={720} size={60}>а без лимита</Line>
    <div style={{position: 'absolute', left: CX, top: 800, transform: 'translateX(-50%)', width: 'max-content', fontFamily: CV, fontSize: 250, lineHeight: 1, color: INK,
      textShadow: '0 8px 0 rgba(17,19,22,.12)'}}>за $5</div>
    <Plate text="в месяц" y={1075} size={110} r={-3} />
    <div style={{position: 'absolute', left: CX, top: 1320, transform: 'translateX(-50%)', width: 'max-content', display: 'flex', alignItems: 'center', gap: 22, padding: '18px 34px',
      background: '#FFFFFF', borderRadius: 60, boxShadow: '0 16px 30px rgba(17,19,22,.12)'}}>
      <Img src={staticFile('tildify/googlechrome.svg')} style={{width: 54, height: 54}} />
      <span style={{fontFamily: SF, fontWeight: 500, fontSize: 40, color: INK}}>Tildify 3.0 · теперь и в Vibe Block</span>
    </div>
  </>
);

export const TildifyBoard: React.FC = () => {
  const f = useCurrentFrame();
  const S = [Hook, Step, Price][Math.min(2, f)];
  return (
    <AbsoluteFill>
      <Paper />
      <S />
      <Speaker />
    </AbsoluteFill>
  );
};

// Лист сравнения четырёх шрифтов из папки Александра на одной фразе
export const FontSheet: React.FC = () => {
  const rows: [string, string, number][] = [['Coolvetica', 'Coolvetica', 400], ['SF Pro Display', 'SF Pro Display', 500], ['Helvetica', 'Helvetica Neue ONai', 700], ['Montserrat', 'Montserrat', 700]];
  return (
    <AbsoluteFill style={{background: PAPER, padding: 110}}>
      {rows.map(([name, fam, w], i) => (
        <div key={name} style={{marginBottom: 70}}>
          <div style={{fontFamily: SF, fontWeight: 500, fontSize: 30, color: GREY, letterSpacing: '0.08em', textTransform: 'uppercase'}}>{name}</div>
          <div style={{fontFamily: fam, fontWeight: w, fontSize: 104, lineHeight: 1.05, color: i === 0 ? ORANGE : INK}}>Сайт в Тильду за 5 шагов</div>
          <div style={{fontFamily: fam, fontWeight: 400, fontSize: 40, color: INK, marginTop: 10}}>Бесплатно 10 переносов в месяц, безлимит за $5</div>
        </div>
      ))}
    </AbsoluteFill>
  );
};
