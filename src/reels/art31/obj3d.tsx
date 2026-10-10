import React, {useLayoutEffect, useMemo} from 'react';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {toCreasedNormals} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {slab} from '../../kit/three';

// Рилс 31 «Монтаж в стиле 35 художников»: пять настоящих 3D-предметов по условиям из карты монтажа patterns/reels/worlds-art31/DIRECTION.md.
// Каждый предмет: прозрачный квадратный холст size×size CSS-px, перспективная камера fov 30 с лёгким облётом,
// студийное окружение и свет как в kit/three.tsx, мягкая контактная тень из радиальной текстуры.
// Всё считается только от t (секунды): без useFrame, clock и Math.random, кадры повторяются бит в бит.

type V3 = [number, number, number];
type Props = {t: number; size: number; k?: number; pitch?: number};

const FOV = 30;
const TAN_HALF = Math.tan((FOV * Math.PI) / 360);
const FILL = 0.7; // доля холста, которую занимает предмет
const PITCH = 0.15; // камера чуть сверху (по ТЗ угол по X -0.15)

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
// выезд с перелётом (easeOutBack): к 1 приходит сверху вниз, пик около 1.1
const outBack = (x: number) => { const u = clamp01(x) - 1; return 1 + 2.70158 * u * u * u + 1.70158 * u * u; };

// -------------------- основа: окружение, камера, свет, тень --------------------

// Студийное окружение для отражений (та же схема, что в kit/three.tsx): без него металл и стекло плоские.
const Studio: React.FC<{intensity: number}> = ({intensity}) => {
  const {gl, scene, invalidate} = useThree();
  useLayoutEffect(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = intensity;
    gl.toneMappingExposure = 0.95;
    invalidate();
    return () => { env.dispose(); pm.dispose(); };
  }, [gl, scene, intensity, invalidate]);
  return null;
};

// Камера считается от t снаружи и ставится прямо в рендере (как в epochfull/scenes3d.tsx): без часов и useFrame.
const Rig: React.FC<{pos: V3}> = ({pos}) => {
  const {camera, invalidate} = useThree();
  camera.position.set(pos[0], pos[1], pos[2]);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  useLayoutEffect(() => { invalidate(); });
  return null;
};

// Радиальная прозрачная текстура тени: плотное ядро контакта и длинный мягкий хвост.
const makeShadowTexture = () => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d')!;
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(0,0,0,0.95)');
  gr.addColorStop(0.25, 'rgba(0,0,0,0.62)');
  gr.addColorStop(0.6, 'rgba(0,0,0,0.2)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

// Контактная тень: круглая плоскость на полу (без shadow map). w по X, d по Z, o непрозрачность.
const ContactShadow: React.FC<{y: number; w: number; d: number; o: number; x?: number}> = ({y, w, d, o, x = 0}) => {
  const tex = useMemo(makeShadowTexture, []);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, y, 0]} scale={[w, d, 1]} renderOrder={-1}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={tex} color="#000000" transparent opacity={o} depthWrite={false} toneMapped={false} />
    </mesh>
  );
};

// Сцена предмета. Начало координат: центр предмета, камера смотрит в него.
// fit: наибольший размер предмета в мире, он занимает FILL холста; расстояние камеры выводится из fov.
// k: сила появления, масштаб 0.6→1 с перелётом (вокруг центра предмета) и прозрачность холста.
const Stage: React.FC<{t: number; size: number; k: number; pitch: number; fit: number; env: number; children: React.ReactNode}> =
  ({t, size, k, pitch, fit, env, children}) => {
    if (k <= 0) return <div style={{width: size, height: size}} />;
    const dist = fit / (FILL * 2 * TAN_HALF);
    const yaw = Math.sin(t * 0.6) * 0.25; // лёгкий облёт
    const pos: V3 = [Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist];
    const pop = 0.6 + 0.4 * outBack(k);
    return (
      <div style={{width: size, height: size, opacity: clamp01(k / 0.35), pointerEvents: 'none'}}>
        <ThreeCanvas width={size} height={size} camera={{fov: FOV, near: 0.1, far: 120, position: pos}}
          gl={{alpha: true, antialias: true, preserveDrawingBuffer: true}}>
          <Studio intensity={env} />
          <Rig pos={pos} />
          {/* свет как в kit/three.tsx: ключ сверху слева, тёплая подсветка снизу справа */}
          <directionalLight position={[-8, 9, 4.2]} intensity={2.4} />
          <directionalLight position={[7, -6, 3]} intensity={0.5} color="#FFB98A" />
          <ambientLight intensity={0.12} />
          <group scale={pop}>{children}</group>
        </ThreeCanvas>
      </div>
    );
  };

// Гладкие нормали на скруглениях и фасках, но торцы (крайние плоскости по Z) остаются идеально плоскими:
// иначе общие вершины с фаской «вспучивают» большую плоскость и блики плывут. Геометрию подавать в крупных единицах:
// toCreasedNormals склеивает вершины с шагом 0.01.
const smoothKeepCaps = (g0: THREE.BufferGeometry, crease: number) => {
  const g = toCreasedNormals(g0, crease);
  g.computeBoundingBox();
  const {min, max} = g.boundingBox!;
  const pos = g.attributes.position, nor = g.attributes.normal;
  const eps = (max.z - min.z) * 1e-4;
  for (let f = 0; f + 2 < pos.count; f += 3) {
    for (const zc of [max.z, min.z]) {
      if (Math.abs(pos.getZ(f) - zc) < eps && Math.abs(pos.getZ(f + 1) - zc) < eps && Math.abs(pos.getZ(f + 2) - zc) < eps) {
        for (let i = 0; i < 3; i++) nor.setXYZ(f + i, 0, 0, zc === max.z ? 1 : -1);
      }
    }
  }
  nor.needsUpdate = true;
  return g;
};

// -------------------- воксели (грибы и звезда 8-бит) --------------------

type Vox = {x: number; y: number; z: number; c: string};

// Один InstancedMesh на весь предмет: цвет у каждого куба свой (instanceColor). Зазор 1.5% даёт видимый шов между кубами.
const voxelMesh = (cells: Vox[], u: number, mat: THREE.Material, colored = true) => {
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(u * 0.985, u * 0.985, u * 0.985), mat, cells.length);
  const m = new THREE.Matrix4();
  const col = new THREE.Color();
  cells.forEach((c, i) => {
    m.makeTranslation(c.x * u, c.y * u, c.z * u);
    im.setMatrixAt(i, m);
    if (colored) { col.set(c.c); im.setColorAt(i, col); }
  });
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.frustumCulled = false;
  return im;
};

// -------------------- 1. СКАРАБЕЙ: катит солнечный диск --------------------

// Жук идёт вдоль +X. Оси тела: x длина (1.35), y высота (0.55), z ширина (1), то есть 1 : 0.55 : 1.35 из ТЗ.
// Пол на y = 0. Размеры ног подобраны так, что лапы касаются пола.
const L1 = 0.72, L2 = 0.85;
const BODY_Y = 1.0, BODY_X = -0.3;
const DISC_X = 3.0, DISC_R = 0.9;
const SC_XC = 1.125, SC_YC = 0.85; // центр жука с диском: по длине (-1.65…3.9) и по высоте (0…1.8)
const limbAngle = (a: number) => Math.atan2(-Math.cos(a), -Math.sin(a)); // поворот цилиндра (ось Y) вдоль направления (cos a, -sin a)

const Leg: React.FC<{side: number; x: number; lean: number; i: number; t: number; mat: THREE.Material; geo: {femur: THREE.BufferGeometry; tibia: THREE.BufferGeometry; ball: THREE.BufferGeometry}}> =
  ({side, x, lean, i, t, mat, geo}) => {
    const ph = t * 8 + i; // шаг: sin(t*8 + i) из ТЗ, у каждой ноги своя фаза
    const a1 = 0.2, a2 = 1.15 + 0.22 * Math.cos(ph);
    const kx = Math.cos(a1) * L1, ky = -Math.sin(a1) * L1;
    return (
      <group position={[x, 0.92, side * 0.72]} rotation={[0, side * (lean + 0.32 * Math.sin(ph) - Math.PI / 2), 0]}>
        <group rotation={[0, 0, limbAngle(a1)]}><mesh geometry={geo.femur} material={mat} position={[0, L1 / 2, 0]} /></group>
        <mesh geometry={geo.ball} material={mat} position={[kx, ky, 0]} />
        <group position={[kx, ky, 0]}>
          <group rotation={[0, 0, limbAngle(a2)]}><mesh geometry={geo.tibia} material={mat} position={[0, L2 / 2, 0]} /></group>
          <mesh geometry={geo.ball} material={mat} position={[Math.cos(a2) * L2, -Math.sin(a2) * L2, 0]} scale={0.8} />
        </group>
      </group>
    );
  };

export const Scarab3D: React.FC<Props> = ({t, size, k = 1, pitch = PITCH}) => {
  const m = useMemo(() => ({
    lapis: new THREE.MeshPhysicalMaterial({color: '#2A58A8', metalness: 0.3, roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.2}),
    lapisDark: new THREE.MeshPhysicalMaterial({color: '#1F4A94', metalness: 0.3, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.25}),
    gold: new THREE.MeshPhysicalMaterial({color: '#E0AB38', metalness: 1, roughness: 0.28}),
    disc: new THREE.MeshPhysicalMaterial({color: '#F3D27A', metalness: 1, roughness: 0.2, emissive: '#E0AB38', emissiveIntensity: 0.25}),
  }), []);
  const g = useMemo(() => {
    // шов надкрылий: тонкая золотая трубка по верхней линии эллипсоида, чуть приподнята над поверхностью
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const x = lerp(0.65, -1.58, i / 16);
      const yTop = BODY_Y + 0.55 * Math.sqrt(Math.max(0, 1 - Math.pow((x - BODY_X) / 1.35, 2)));
      pts.push(new THREE.Vector3(x, yTop + 0.01, 0));
    }
    const limb = (len: number, r0: number, r1: number) => new THREE.CylinderGeometry(r1, r0, len, 14);
    return {
      sphere: new THREE.SphereGeometry(1, 64, 48),
      seam: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 56, 0.026, 8, false),
      femur: limb(L1, 0.075, 0.05),
      tibia: limb(L2, 0.05, 0.032),
      ball: new THREE.SphereGeometry(0.08, 16, 12),
      cone: new THREE.ConeGeometry(0.05, 0.18, 12),
      ring: new THREE.TorusGeometry(DISC_R * 1.003, 0.028, 12, 64),
    };
  }, []);
  const bob = 0.03 * Math.abs(Math.sin(t * 8)); // жук подпрыгивает в такт шагам
  const legs = [0, 1, 2, 3, 4, 5].map((i) => ({i, side: i % 2 ? -1 : 1, row: Math.floor(i / 2)}));
  const ROW_X = [0.95, 0.1, -0.8], ROW_LEAN = [0.5, 0, -0.5];
  return (
    <Stage t={t} size={size} k={k} pitch={pitch} fit={5.4} env={0.85}>
      <group rotation={[0, 0.55, 0]}>
        <group position={[-SC_XC, -SC_YC, 0]}>
          <ContactShadow y={0.004} x={SC_XC} w={7} d={4} o={0.55} />
          <group position={[0, bob, 0]}>
            {/* надкрылья, шов, переднеспинка, голова */}
            <mesh geometry={g.sphere} material={m.lapis} position={[BODY_X, BODY_Y, 0]} scale={[1.35, 0.55, 1]} />
            <mesh geometry={g.seam} material={m.gold} />
            <mesh geometry={g.sphere} material={m.lapisDark} position={[1.02, 1.04, 0]} scale={[0.62, 0.43, 0.8]} />
            <mesh geometry={g.sphere} material={m.lapisDark} position={[1.58, 0.93, 0]} scale={[0.4, 0.27, 0.5]} />
            {[-0.17, 0, 0.17].map((z) => (
              <mesh key={z} geometry={g.cone} material={m.gold} position={[1.92, 0.9, z]} rotation={[0, 0, -Math.PI / 2]} />
            ))}
            {legs.map((l) => (
              <Leg key={l.i} side={l.side} x={ROW_X[l.row]} lean={ROW_LEAN[l.row]} i={l.i} t={t} mat={m.gold} geo={g} />
            ))}
          </group>
          {/* солнечный диск: катится по ходу жука, на нём золотые меридианы, чтобы вращение было видно */}
          <group position={[DISC_X, DISC_R, 0]} rotation={[0, 0, -t * 2]}>
            <mesh geometry={g.sphere} material={m.disc} scale={DISC_R} />
            {[0, 1, 2, 3].map((j) => (
              <group key={j} rotation={[0, 0, (j * Math.PI) / 4]}>
                <mesh geometry={g.ring} material={m.gold} rotation={[Math.PI / 2, 0, 0]} />
              </group>
            ))}
          </group>
        </group>
      </group>
    </Stage>
  );
};

// -------------------- 2. НЕФРИТОВАЯ ЗВЕЗДА (GitHub) --------------------

// Пятиконечная звезда: внешний радиус R, внутренний r, вершины скруглены квадратичными кривыми.
const starShape = (R = 1, r = 0.45, fo = 0.22, fi = 0.2) => {
  const n = 5;
  const pts: [number, number][] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / n;
    const rad = i % 2 ? r : R;
    pts.push([Math.cos(a) * rad, Math.sin(a) * rad]);
  }
  const s = new THREE.Shape();
  pts.forEach((p, i) => {
    const prev = pts[(i + pts.length - 1) % pts.length], next = pts[(i + 1) % pts.length];
    const f = i % 2 ? fi : fo;
    const a = [lerp(p[0], prev[0], f), lerp(p[1], prev[1], f)], b = [lerp(p[0], next[0], f), lerp(p[1], next[1], f)];
    if (i === 0) s.moveTo(a[0], a[1]); else s.lineTo(a[0], a[1]);
    s.quadraticCurveTo(p[0], p[1], b[0], b[1]);
  });
  s.closePath();
  return s;
};

export const JadeStar3D: React.FC<Props> = ({t, size, k = 1, pitch = PITCH}) => {
  const geo = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(starShape(), {depth: 0.32, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 8, curveSegments: 14});
    g.translate(0, -0.087, -0.16); // центр по толщине в нуле, габарит звезды по высоте (-0.84…1.01) центрируется по холсту
    g.scale(100, 100, 100);
    const smooth = smoothKeepCaps(g, 0.7); // гладкие скругления без граней, торцы плоские
    smooth.scale(0.01, 0.01, 0.01);
    return smooth;
  }, []);
  const m = useMemo(() => ({
    jade: new THREE.MeshPhysicalMaterial({
      color: '#3E9A73', transmission: 0.55, thickness: 0.8, roughness: 0.18, ior: 1.6,
      attenuationColor: new THREE.Color('#1F5C44'), attenuationDistance: 0.9, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.2,
    }),
    // тёмное ядро внутри: на прозрачном холсте у стекла нечего преломлять, ядро даёт глубину и свечение изнутри
    core: new THREE.MeshStandardMaterial({color: '#0F4A33', emissive: '#2FA67A', emissiveIntensity: 0.4, roughness: 0.5}),
  }), []);
  const bob = 0.06 * Math.sin(t * 1.8);
  const tilt: V3 = [0.2 + 0.08 * Math.sin(t * 1.3), t * 0.9, 0.1 * Math.sin(t * 0.8)];
  return (
    <Stage t={t} size={size} k={k} pitch={pitch} fit={2.0} env={0.8}>
      <ContactShadow y={-1.15} w={2.5} d={2.0} o={0.42 - 0.05 * Math.sin(t * 1.8)} />
      <group position={[0, bob, 0]} rotation={tilt}>
        <mesh geometry={geo} material={m.jade} />
        <mesh geometry={geo} material={m.core} scale={[0.6, 0.6, 0.55]} />
      </group>
    </Stage>
  );
};

// -------------------- 3. ГРИБ из вокселей (8-бит) --------------------

// Высота 12 кубов: ножка 6 слоёв (y 0…5), шляпка-полусфера 6 слоёв (y 6…11). Ребро куба u = 1/12 высоты.
const MU = 1 / 12;
const CAP_R2 = 5.6 * 5.6;
const inCap = (x: number, j: number, z: number) => j >= 0 && j <= 5 && x * x + z * z + (j + 0.5) * (j + 0.5) <= CAP_R2;
const mushroomCells = (): Vox[] => {
  const RED = '#E0302A', WHITE = '#F8F8F8', BEIGE = '#F2D3A0', BLACK = '#111111';
  const out: Vox[] = [];
  // ножка: круглое сечение из кубов, два чёрных глаза в два куба высотой на передней грани
  for (let y = 0; y < 6; y++) for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) {
    if (x * x + z * z > 6.5) continue;
    const eye = z === 2 && (x === -1 || x === 1) && (y === 3 || y === 4);
    out.push({x, y, z, c: eye ? BLACK : BEIGE});
  }
  // белые пятна: куб шляпки, видимый снаружи и близкий к центру пятна, белый
  const spots: {d: V3; r: number}[] = [
    {d: [0, 1, 0], r: 1.45}, {d: [-0.6, 0.45, 0.66], r: 2.0}, {d: [0.6, 0.45, 0.66], r: 2.0},
    {d: [-0.98, 0.3, -0.1], r: 1.9}, {d: [0.98, 0.3, -0.1], r: 1.9}, {d: [0, 0.4, -1], r: 2.2},
  ].map((s) => { const l = Math.hypot(...(s.d as V3)); return {d: s.d.map((v) => (v / l) * 5.8) as V3, r: s.r}; });
  for (let j = 0; j <= 5; j++) for (let x = -5; x <= 5; x++) for (let z = -5; z <= 5; z++) {
    if (!inCap(x, j, z)) continue;
    const open = j > 0 && (!inCap(x, j + 1, z) || !inCap(x + 1, j, z) || !inCap(x - 1, j, z) || !inCap(x, j, z + 1) || !inCap(x, j, z - 1));
    const white = open && spots.some((s) => Math.hypot(x - s.d[0], j + 0.5 - s.d[1], z - s.d[2]) <= s.r);
    out.push({x, y: 6 + j, z, c: white ? WHITE : RED});
  }
  return out.map((c) => ({...c, y: c.y + 0.5})); // центр куба на половине слоя
};

export const Mushroom3D: React.FC<Props & {grow?: number}> = ({t, size, k = 1, pitch = PITCH, grow = 0}) => {
  const vox = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({color: '#FFFFFF', roughness: 0.55, metalness: 0, flatShading: true});
    return voxelMesh(mushroomCells(), MU, mat);
  }, []);
  const FLOOR = -0.62; // пол относительно центра холста: гриб растёт вверх от него
  const s = lerp(0.7, 1.25, outBack(grow)); // «выбрал Claude и вырос»: 0.7 → 1.25 с перелётом
  const hopN = Math.abs(Math.sin(t * 4));
  const hop = hopN * 0.15; // подскок abs(sin(t*4))*0.15
  const sy = 1 + 0.06 * (hopN - 0.4); // у земли сплющивается, в воздухе вытягивается
  const sxz = 1 / Math.sqrt(sy);
  return (
    <Stage t={t} size={size} k={k} pitch={pitch} fit={1.4} env={0.5}>
      <ContactShadow y={FLOOR + 0.003} w={1.05 * s * (1 - 0.3 * hopN)} d={0.95 * s * (1 - 0.3 * hopN)} o={0.55 - 0.2 * hopN} />
      <group position={[0, FLOOR + hop, 0]}>
        <group rotation={[0, Math.sin(t * 1.4) * 0.3, Math.sin(t * 2.6) * 0.05]} scale={[s * sxz, s * sy, s * sxz]}>
          <primitive object={vox} />
        </group>
      </group>
    </Stage>
  );
};

// -------------------- 4. ЗВЕЗДА-БОНУС из вокселей (8-бит) --------------------

const STAR_ROWS = [
  '......X......',
  '.....XXX.....',
  '.....XXX.....',
  '....XXXXX....',
  'XXXXXXXXXXXXX',
  '.XXXXXXXXXXX.',
  '..XXXXXXXXX..',
  '...XXXXXXX...',
  '...XXXXXXX...',
  '..XXXX.XXXX..',
  '..XXX...XXX..',
  '.XXX.....XXX.',
  '.XX.......XX.',
];
const PU = 2 / 13; // ребро куба: звезда шириной 2
const isEye = (col: number, row: number) => (col === 5 || col === 7) && (row === 6 || row === 7);
const starCells = (): {body: Vox[]; eyes: Vox[]} => {
  const body: Vox[] = [], eyes: Vox[] = [];
  STAR_ROWS.forEach((line, row) => line.split('').forEach((ch, col) => {
    if (ch !== 'X') return;
    for (const z of [-1, 0, 1]) {
      const cell = {x: col - 6, y: 6 - row, z, c: '#FFD23A'};
      if (isEye(col, row) && z !== 0) eyes.push({...cell, c: '#0B0B0B'}); // глаза на передней и задней грани
      else body.push(cell);
    }
  }));
  return {body, eyes};
};

export const PixelStar3D: React.FC<Props> = ({t, size, k = 1, pitch = PITCH}) => {
  const o = useMemo(() => {
    const {body, eyes} = starCells();
    const mat = new THREE.MeshStandardMaterial({color: '#FFD23A', roughness: 0.55, flatShading: true, emissive: '#FFB300', emissiveIntensity: 0.3});
    const eyeMat = new THREE.MeshStandardMaterial({color: '#0B0B0B', roughness: 0.5, flatShading: true});
    return {mat, star: voxelMesh(body, PU, mat, false), eyes: voxelMesh(eyes, PU, eyeMat, false)};
  }, []);
  o.mat.emissiveIntensity = 0.12 + 0.38 * (0.5 + 0.5 * Math.sin(t * 10)); // вспышка по sin(t*10)
  return (
    <Stage t={t} size={size} k={k} pitch={pitch} fit={2.25} env={0.5}>
      <ContactShadow y={-1.3} w={2.0} d={1.9} o={0.36} />
      <group position={[0, 0.05 * Math.sin(t * 3), 0]} rotation={[0.08, t * 3, 0]}>
        <primitive object={o.star} />
        <primitive object={o.eyes} />
      </group>
    </Stage>
  );
};

// -------------------- 5. СТЕКЛЯННАЯ ПЛИТА со знаком Claude (ONai) --------------------

// Луч знака: сужающийся прямоугольник со скруглённым концом. len 1 = самый длинный луч.
const RAY = 0.6;
const rayGeo = (len: number) => {
  const L = len * RAY, wb = 0.075, wt = 0.04;
  const s = new THREE.Shape();
  s.moveTo(0, -wb);
  s.lineTo(L - wt, -wt);
  s.absarc(L - wt, 0, wt, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(0, wb);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {depth: 0.12, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 10});
  g.translate(0, 0, -0.06);
  return g;
};

export const ClaudeGlass3D: React.FC<Props> = ({t, size, k = 1, pitch = PITCH}) => {
  const g = useMemo(() => {
    // slab() из kit считает в CSS-px (минимальный радиус 0.5), поэтому строим в «пикселях» 160×160 и сжимаем в 100 раз
    const plate = slab(160, 160, 32, 35, 8); // 1.6×1.6, радиус 0.32, глубина 0.35, фаска 0.08
    plate.translate(0, 0, -17.5);
    const smooth = smoothKeepCaps(plate, 0.7);
    smooth.scale(0.01, 0.01, 0.01);
    return {plate: smooth, long: rayGeo(1), short: rayGeo(0.82)};
  }, []);
  const m = useMemo(() => ({
    glass: new THREE.MeshPhysicalMaterial({
      color: '#FFFFFF', transmission: 1, thickness: 1.2, roughness: 0.06, ior: 1.5,
      attenuationColor: new THREE.Color('#3DEDC3'), attenuationDistance: 2, envMapIntensity: 1.3,
    }),
    mark: new THREE.MeshPhysicalMaterial({color: '#D97757', metalness: 0.1, roughness: 0.4, emissive: '#D97757', emissiveIntensity: 0.12}),
  }), []);
  const rot: V3 = [0.05 * Math.sin(t * 0.9), Math.sin(t * 0.7) * 0.5, 0];
  return (
    <Stage t={t} size={size} k={k} pitch={pitch} fit={1.75} env={0.9}>
      <ContactShadow y={-1.0} w={2.3} d={1.4} o={0.4} />
      {/* скользящий блик: точечный свет ходит поперёк плиты */}
      <pointLight position={[Math.sin(t * 1.2) * 2.4, 1.2 + 0.6 * Math.sin(t * 0.9), 2.4]} intensity={18} decay={2} color="#FFFFFF" />
      <group position={[0, 0.04 * Math.sin(t * 1.5), 0]} rotation={rot}>
        <mesh geometry={g.plate} material={m.glass} />
        {Array.from({length: 12}, (_, i) => (
          <mesh key={i} geometry={i % 2 ? g.short : g.long} material={m.mark} rotation={[0, 0, (i * Math.PI) / 6]} position={[0, 0, (i % 2) * 0.003]} />
        ))}
      </group>
    </Stage>
  );
};

// -------------------- что сделано --------------------
// Пять компонентов: Scarab3D, JadeStar3D, Mushroom3D (доп. проп grow), PixelStar3D, ClaudeGlass3D.
// Общие пропы: t (секунды), size (сторона холста, CSS-px), k (появление 0…1, по умолчанию 1), pitch (подъём камеры, по умолчанию 0.15).
// Холст прозрачный, камера перспективная fov 30, облёт yaw = sin(t*0.6)*0.25, всё от t, без useFrame, clock и Math.random.
// Предмет в центре холста, масштаб k считается вокруг центра предмета. Камера подбирается так, чтобы предмет занимал FILL = 0.7 стороны.
//
// Размеры предмета в холсте (доля стороны, замер проекцией вершин камерой по t = 0…20 с, без учёта выезда k):
//   Scarab3D     ширина 62…72% (в среднем 68%), высота 30…34%, дальний край 83% полуширины. Жук с диском идёт вправо и от камеры.
//   JadeStar3D   высота 64…72% (в среднем 70%), ширина 20% (ребром) …71% (лицом), дальний край 82%.
//   Mushroom3D   grow 0: высота 38% (масштаб 0.7); grow 1: высота 65…70% (масштаб 1.25); пик перелёта 73%, дальний край 91% (с выездом k до 95%).
//   PixelStar3D  высота 64…73% (в среднем 70%), ширина 17% (ребром) …66% (лицом), дальний край 85%.
//   ClaudeGlass3D ширина 62…68%, высота 66…70%, дальний край 77%.
// Вокселей: гриб 504 (белых 44, глаз 4), звезда 249 (глаз 8).
//
// Отступления и решения по ТЗ:
//  1. Скарабей идёт вдоль +X (в ТЗ длинная ось была Z): иначе вращение диска rotation.z = -t*2 катило бы его боком.
//  2. Шов надкрылий: золотая трубка (TubeGeometry) по верхней линии эллипсоида, прямой цилиндр утонул бы в теле.
//  3. Диску добавлены 4 золотых меридиана: на гладком шаре вращение не видно.
//  4. В нефритовую звезду добавлено тёмное ядро с лёгким свечением: на прозрачном холсте стеклу нечего преломлять
//     (three кладёт под прозрачность белый фон с альфой 0.5), ядро даёт глубину и не даёт звезде стать молочной.
//  5. slab() из kit считает в CSS-px (радиус не меньше 0.5), поэтому плита строится как slab(160, 160, 32, 35, 8) и сжимается в 100 раз:
//     получаются 1.6×1.6, радиус 0.32, глубина 0.35, фаска 0.08 ровно по ТЗ.
//  6. Нормали скруглений и фасок сглажены (toCreasedNormals), торцы звезды и плиты оставлены плоскими.
//  7. Mushroom3D: grow по умолчанию 0 (маленький гриб 0.7), выросший 1.25; перелёт grow считается внутри (outBack), снаружи подавать линейно.
//  8. Не проверено глазами (рендеры запрещены): стекло и нефрит на прозрачном холсте. Если стекло молочное, поднять env у ClaudeGlass3D
//     или уменьшить transmission; блик ClaudeGlass3D задаётся pointLight, его intensity 18.
