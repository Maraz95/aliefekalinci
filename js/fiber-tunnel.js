/* =========================================================
   FIBER OPTIC TUNNEL — Hero ile tünel tek bir Three.js sahnesi
   ---------------------------------------------------------
   Fikir:
   1) Sayfanın arkasında SABİT tek bir tuval var (#fiberStage).
      Hero ve tünel bölümü bu sahnenin önünde, şeffaf zeminle durur.
   2) Fiber hatları, kimlik kartının etrafındaki parçacık halkasından
      başlar (önce noktalı, sonra kesintisiz çizgiye dönüşür), kartın
      arkasından geçer, ekranın altındaki tünel ağzına iner ve tünelin
      duvarlarındaki kablo kanallarında sonsuza kadar devam eder.
      Yani Hero'daki hatlar ile tüneldeki hatlar AYNI eğrilerdir.
   3) Kamera:
      - Hero kaydırılırken kart ile aynı hızda aşağı iner. Böylece kartın
        derinliğindeki noktalar ekranda kartla birlikte kayar ve hatlar
        kartın arkasından kopmaz (daha uzaktakiler paralaksla yavaş kayar).
      - Hero bitince tünel ağzının tam karşısındadır; tünel bölümü
        kaydırıldıkça tünelin içine doğru ilerler.
   4) Işık akışı hat boyunca shader'da hesaplanır (doku/geometri değişmez).
   Bağımlılık: Three.js (importmap). GSAP varsa giriş animasyonunda kullanılır.
   ========================================================= */
import * as THREE from 'three';

const canvas = document.getElementById('fiberStage');
const hero = document.getElementById('hero');
const tunnel = document.getElementById('tunnel');

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const lowPower = window.matchMedia('(hover: none) and (pointer: coarse)').matches || window.innerWidth < 700;

/* ---------- Sahne ölçüleri (dünya birimi ≈ metre) ---------- */
const FOV = 40;
const CARD_DEPTH = 6;          // kartın "durduğu" derinlik: hatlar buradan başlar
const MOUTH_DEPTH = 10.5;      // tünel ağzının (cephenin) derinliği
const R = 2.0;                 // tünel kemerinin iç yarıçapı
const FLOOR = -1.6;            // zemin, tünel eksenine göre
const SPRING = 0.25;           // kemerin başladığı yükseklik (eksene göre)
const RIB_T = 0.22;            // kemer kaburgasının kalınlığı
const RIB_GAP = lowPower ? 3.4 : 2.8;  // kaburgalar arası mesafe
const LENGTH = 78;             // tünel uzunluğu
const PARALLAX = 0.35;         // animations.js: .hero__stage kaydırmanın %35'i kadar geri kalır
const FIBERS = lowPower ? 38 : 72;
const SAMPLES = lowPower ? 68 : 116;

const visH = (d) => 2 * d * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
// Gizli sekmede/önizlemede pencere 0 boyutlu olabilir: hesaplar NaN üretmesin
const viewW = () => Math.max(1, window.innerWidth);
const viewH = () => Math.max(1, window.innerHeight);

/* ---------------------------------------------------------
   Kemer profili: sol alt köşe → sol duvar → kemer → sağ duvar → sağ alt köşe
   s ∈ [0,1], inset = içeri doğru mesafe. Eksene göre (x, y) döner.
   --------------------------------------------------------- */
function profilePoint(s, inset, r = R) {
  const wall = SPRING - FLOOR;
  const arc = Math.PI * r;
  const total = 2 * wall + arc;
  let d = s * total;
  if (d < wall) return new THREE.Vector2(-r + inset, FLOOR + d);
  d -= wall;
  if (d < arc) {
    const a = Math.PI - (d / arc) * Math.PI;           // π → 0 (soldan sağa, tepeden geçerek)
    return new THREE.Vector2(Math.cos(a) * (r - inset), SPRING + Math.sin(a) * (r - inset));
  }
  d -= arc;
  return new THREE.Vector2(r - inset, SPRING + wall - d);
}

function archShape(r, withHole, holeR) {
  const s = new THREE.Shape();
  s.moveTo(-r, FLOOR);
  s.lineTo(-r, SPRING);
  s.absarc(0, SPRING, r, Math.PI, 0, true);
  s.lineTo(r, FLOOR);
  s.lineTo(-r, FLOOR);
  if (withHole) {
    const h = new THREE.Path();
    h.moveTo(-holeR, FLOOR);
    h.lineTo(holeR, FLOOR);
    h.lineTo(holeR, SPRING);
    h.absarc(0, SPRING, holeR, 0, Math.PI, false);
    h.lineTo(-holeR, FLOOR);
    s.holes.push(h);
  }
  return s;
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------------------------------------------------
   Fiber çizgisi: her hat ekran uzayında sabit piksel genişliğinde bir şerit.
   Böylece hem yakında hem sonsuzda "ince" kalır (WebGL çizgileri 1px ile sınırlı).
   --------------------------------------------------------- */
const FIBER_VERTEX = /* glsl */ `
attribute vec3 nextPos;
attribute float side;
attribute float u;
attribute float dist;
attribute float seed;
uniform vec2 uResolution;
uniform float uWidth;
varying float vU;
varying float vDist;
varying float vSeed;
varying float vSide;
varying float vDepth;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec4 mvN = modelViewMatrix * vec4(nextPos, 1.0);
  vDepth = -mv.z;
  vU = u; vDist = dist; vSeed = seed; vSide = side;
  vec4 c = projectionMatrix * mv;
  // Kameranın arkasındaki noktalar: kırpılsın (görüş alanına uzun şeritler çizmesin)
  if (mv.z > -0.06 || mvN.z > -0.06) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
  vec4 cN = projectionMatrix * mvN;
  vec2 dir = (cN.xy / cN.w - c.xy / c.w) * uResolution;
  float len = length(dir);
  dir = len > 1e-5 ? dir / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  c.xy += nrm * (uWidth / uResolution) * side * c.w;
  gl_Position = c;
}`;

const FIBER_FRAGMENT = /* glsl */ `
uniform float uFlow;       // zamanla (ve kaydırma/buton hızıyla) artan akış fazı
uniform float uReveal;     // 0 → 1: hatlar halkadan tünele doğru uzar
uniform float uAlpha;
uniform float uHalo;       // 1 = geniş, yumuşak hale geçişi
uniform float uSurge;      // 0 → 1: "Projeler" hover enerji hızlanması
uniform vec3 uDeep;
uniform vec3 uCyan;
uniform vec3 uWhite;
varying float vU;
varying float vDist;
varying float vSeed;
varying float vSide;
varying float vDepth;
void main() {
  if (vU > uReveal) discard;
  float edge = 1.0 - abs(vSide);
  float profile = uHalo > 0.5 ? edge * edge * edge : smoothstep(0.0, 0.7, edge);

  // Parçacıktan fibere: hattın ilk ~1.5 birimi noktalıdır, sonra kesintisiz olur
  float solid = smoothstep(0.5, 1.8, vDist);
  float dots = step(0.58, fract(vDist * 8.0 + vSeed * 5.0));
  float body = mix(dots, 1.0, solid) * smoothstep(0.0, 0.3, vDist);

  // Hat boyunca tünele doğru akan keskin ışık darbeleri (kuyruklu) + enerji hızlanmasında ikincil darbe
  float ph = fract(vDist * 0.092 - uFlow * (0.58 + 0.92 * vSeed) + vSeed * 13.0);
  float pulse = smoothstep(0.0, 0.012, ph) * (1.0 - smoothstep(0.012, 0.17 + uSurge * 0.08, ph));
  float ph2 = fract(vDist * 0.165 - uFlow * (1.12 + 0.82 * vSeed) + vSeed * 7.3);
  float surgePulse = smoothstep(0.0, 0.012, ph2) * (1.0 - smoothstep(0.012, 0.14, ph2)) * (0.22 + uSurge * 0.95);
  float pTot = min(1.45, pulse + surgePulse * 0.78);

  // Derinliğe göre soğuk deniz mavisinden sıcak bronz-altına sinematik geçiş
  float depthWarm = smoothstep(4.0, 38.0, vDepth);
  vec3 col = mix(uDeep, uCyan, clamp(0.38 + 0.56 * vSeed + depthWarm * 0.16 + uSurge * 0.20, 0.0, 1.0));
  col = mix(col, uWhite, clamp(pTot * 0.95 + uSurge * 0.14, 0.0, 1.0));
  float a = (0.36 + 0.24 * vSeed + uSurge * 0.16 + pTot * (2.75 + uSurge * 1.15)) * body * profile;

  // Uzaklık: derinlikte parlamasını korur → karanlık atmosferde tünel ışıl ışıl öne çıkar
  a *= mix(0.48, 1.0, exp(-vDepth * 0.020));
  a *= smoothstep(0.15, 1.0, vDepth);

  // Uzayan ucun parlak başı
  float tip = (1.0 - smoothstep(0.0, 0.015, uReveal - vU)) * step(uReveal, 0.999);
  col = mix(col, uWhite, tip);
  a += tip * body * profile * 1.15;

  gl_FragColor = vec4(col, a * uAlpha);
}`;

function fiberMaterial(width, alpha, halo, resolution) {
  return new THREE.ShaderMaterial({
    vertexShader: FIBER_VERTEX,
    fragmentShader: FIBER_FRAGMENT,
    uniforms: {
      uResolution: { value: resolution },
      uWidth: { value: width },
      uFlow: { value: 0 },
      uReveal: { value: reduce ? 1 : 0 },
      uAlpha: { value: alpha },
      uHalo: { value: halo ? 1 : 0 },
      uSurge: { value: 0 },
      uDeep: { value: new THREE.Color('#2478B8') },
      uCyan: { value: new THREE.Color('#D89B54') },
      uWhite: { value: new THREE.Color('#FFF6E5') },
    },
    transparent: true,
    depthWrite: false,
    // Şerit üçgenlerinin yönü hattın gidişine göre değişir: iki yüzü de çizilmeli
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

/* Hat noktalarını (Vector3 dizileri) tek bir şerit geometrisine çevirir. */
function ribbonGeometry(lines) {
  let verts = 0, idx = 0;
  for (const l of lines) { verts += l.pts.length * 2; idx += (l.pts.length - 1) * 6; }
  const pos = new Float32Array(verts * 3);
  const next = new Float32Array(verts * 3);
  const side = new Float32Array(verts);
  const uArr = new Float32Array(verts);
  const dist = new Float32Array(verts);
  const seed = new Float32Array(verts);
  const index = new Uint32Array(idx);
  let v = 0, k = 0;
  for (const l of lines) {
    const p = l.pts;
    const n = p.length;
    let acc = l.distStart || 0;
    for (let i = 0; i < n; i++) {
      if (i > 0) acc += p[i].distanceTo(p[i - 1]);
      const nx = i < n - 1 ? p[i + 1] : p[i].clone().multiplyScalar(2).sub(p[i - 1]);
      for (const sd of [-1, 1]) {
        pos.set([p[i].x, p[i].y, p[i].z], v * 3);
        next.set([nx.x, nx.y, nx.z], v * 3);
        side[v] = sd;
        uArr[v] = (l.uStart || 0) + (i / (n - 1)) * (l.uSpan || 1);
        dist[v] = acc;
        seed[v] = l.seed;
        v++;
      }
      if (i < n - 1) {
        const a = v - 2;
        index.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], k);
        k += 6;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('nextPos', new THREE.BufferAttribute(next, 3));
  g.setAttribute('side', new THREE.BufferAttribute(side, 1));
  g.setAttribute('u', new THREE.BufferAttribute(uArr, 1));
  g.setAttribute('dist', new THREE.BufferAttribute(dist, 1));
  g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  return g;
}

/* Sonsuzdaki parlak derinlik noktası için yumuşak radyal doku */
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,248,232,1)');
  grd.addColorStop(0.16, 'rgba(232,184,118,.82)');
  grd.addColorStop(0.45, 'rgba(138,104,69,.32)');
  grd.addColorStop(0.75, 'rgba(26,92,142,.12)');
  grd.addColorStop(1, 'rgba(5,8,13,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------------------------------------------------------
   Kurulum
   --------------------------------------------------------- */
function init() {
  if (!canvas || !hero || !tunnel) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPower, alpha: false, powerPreference: 'high-performance' });
  } catch (e) {
    canvas.style.display = 'none';
    document.documentElement.classList.add('no-fiber');
    return;
  }
  const dpr = Math.min(window.devicePixelRatio || 1, lowPower ? 1.0 : 1.35);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const BG = new THREE.Color('#04070C');
  renderer.setClearColor(BG, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(BG, 0.022);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 220);
  const resolution = new THREE.Vector2(1, 1);

  // Ölçü önbelleği: her karede offsetTop/offsetHeight okuyarak layout reflow tetikleme
  const metrics = { ih: viewH(), heroH: Math.max(1, hero.offsetHeight), tTop: tunnel.offsetTop, span: 1, tunnelEnd: 1 };
  function measureDom() {
    metrics.ih = viewH();
    metrics.heroH = Math.max(1, hero.offsetHeight);
    metrics.tTop = tunnel.offsetTop;
    metrics.span = Math.max(1, tunnel.offsetHeight - metrics.ih);
    metrics.tunnelEnd = metrics.tTop + metrics.span;
  }
  measureDom();

  // Tünel ekseninin yüksekliği: Hero bitince kameranın ineceği yer.
  const heroRatio = () => metrics.heroH / metrics.ih;
  let axisY = -(1 - PARALLAX) * heroRatio() * visH(CARD_DEPTH);

  const world = new THREE.Group();      // tüm mimari bu grubun içinde; y = axisY
  scene.add(world);

  /* ---------- Malzemeler: hızlı GPU shader'lı koyu metalik kaburgalar ---------- */
  const concrete = new THREE.MeshPhongMaterial({ color: '#141A22', specular: '#566A80', shininess: 42 });
  const skin = new THREE.MeshBasicMaterial({ color: '#03060A', side: THREE.DoubleSide });
  // Zemin: koyu parlak obsidyen yansıma yüzeyi
  const floorMat = new THREE.MeshPhongMaterial({ color: '#05090F', specular: '#3A5068', shininess: 68, depthWrite: false });

  /* ---------- Karanlık atmosfer tozu (boşlukta yavaşça süzülen ince ışık parçacıkları) ---------- */
  const dustCount = lowPower ? 44 : 110;
  const dustPos = new Float32Array(dustCount * 3);
  const dustSeed = new Float32Array(dustCount * 3);
  const dustRand = mulberry32(42);
  for (let i = 0; i < dustCount; i++) {
    const rad = 2.6 + dustRand() * 14;
    const ang = dustRand() * Math.PI * 2;
    dustPos[i * 3]     = Math.cos(ang) * rad;
    dustPos[i * 3 + 1] = (dustRand() - 0.35) * 14;
    dustPos[i * 3 + 2] = 2 - dustRand() * (LENGTH + MOUTH_DEPTH + 10);
    dustSeed.set([dustRand() * 6.283, 0.4 + dustRand() * 1.4, dustRand()], i * 3);
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(dustSeed, 3));
  const dustMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uDpr: { value: dpr } },
    vertexShader: /* glsl */`
      attribute vec3 aSeed;
      uniform float uTime, uDpr;
      varying float vA, vMix;
      void main(){
        vec3 p = position;
        p.x += sin(uTime * 0.25 * aSeed.y + aSeed.x) * 0.35;
        p.y += cos(uTime * 0.20 * aSeed.y + aSeed.x * 1.3) * 0.35;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float depthFade = smoothstep(1.5, 6.0, -mv.z) * exp(-max(0.0, -mv.z) * 0.025);
        vA = (0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * aSeed.y + aSeed.x))) * depthFade;
        vMix = aSeed.z;
        gl_PointSize = clamp((1.8 + aSeed.z * 2.8) * uDpr * (10.0 / max(2.0, -mv.z)), 1.2, 6.5);
      }`,
    fragmentShader: /* glsl */`
      varying float vA, vMix;
      void main(){
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c) * 2.0;
        if (d > 1.0) discard;
        vec3 col = mix(vec3(0.22, 0.58, 0.85), vec3(0.95, 0.78, 0.52), vMix);
        gl_FragColor = vec4(col, exp(-d * d * 4.5) * vA * 0.55);
      }`
  });
  const atmoDust = new THREE.Points(dustGeo, dustMat);
  atmoDust.frustumCulled = false;
  world.add(atmoDust);

  /* ---------- Mimari: kemer kaburgaları + parlayan iç ışık şeritleri ---------- */
  const ribCount = Math.ceil(LENGTH / RIB_GAP);
  const ribGeo = new THREE.ExtrudeGeometry(archShape(R + RIB_T, true, R), {
    depth: 0.26, bevelEnabled: false, curveSegments: lowPower ? 14 : 20,
  });
  ribGeo.translate(0, 0, -0.26);
  const ribs = new THREE.InstancedMesh(ribGeo, concrete, ribCount);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < ribCount; i++) {
    m4.makeTranslation(0, 0, -MOUTH_DEPTH - i * RIB_GAP);
    ribs.setMatrixAt(i, m4);
  }
  world.add(ribs);

  // Parlayan iç kemer ışık hatları: her 2. kaburgada tüneli derinlik boyunca parlatan sıcak bronz/altın şerit
  let ringMat, mouthRingMat, mouthHaloMat;
  {
    const archPts = [];
    for (let i = 0; i <= 32; i++) {
      const p = profilePoint(i / 32, 0.025, R);
      archPts.push(new THREE.Vector3(p.x, p.y, 0));
    }
    const archCurve = new THREE.CatmullRomCurve3(archPts);
    const ringGeo = new THREE.TubeGeometry(archCurve, 32, 0.018, 5, false);
    ringMat = new THREE.MeshBasicMaterial({
      color: '#E5B272', transparent: true, opacity: 0.52, blending: THREE.AdditiveBlending, depthWrite: false
    });
    const litCount = Math.ceil(ribCount / 2);
    const litRings = new THREE.InstancedMesh(ringGeo, ringMat, litCount);
    for (let i = 0; i < litCount; i++) {
      m4.makeTranslation(0, 0, -MOUTH_DEPTH - (i * 2) * RIB_GAP - 0.06);
      litRings.setMatrixAt(i, m4);
    }
    world.add(litRings);

    // Tünel ağzı (portal girişi) parlak ışık çerçevesi — karanlık atmosferde kapıyı öne çıkarır
    const mouthRingGeo = new THREE.TubeGeometry(archCurve, 40, 0.042, 6, false);
    mouthRingMat = new THREE.MeshBasicMaterial({
      color: '#FFF2D8', transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending, depthWrite: false
    });
    const mouthRing = new THREE.Mesh(mouthRingGeo, mouthRingMat);
    mouthRing.position.z = -MOUTH_DEPTH + 0.06;
    world.add(mouthRing);

    const mouthHaloGeo = new THREE.TubeGeometry(archCurve, 40, 0.14, 6, false);
    mouthHaloMat = new THREE.MeshBasicMaterial({
      color: '#C88D48', transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false
    });
    const mouthHalo = new THREE.Mesh(mouthHaloGeo, mouthHaloMat);
    mouthHalo.position.z = -MOUTH_DEPTH + 0.06;
    world.add(mouthHalo);
  }

  // Ağız: daha kalın ve derin bir portal kaburgası
  const portalGeo = new THREE.ExtrudeGeometry(archShape(R + RIB_T * 2.2, true, R), {
    depth: 0.9, bevelEnabled: false, curveSegments: lowPower ? 18 : 26,
  });
  portalGeo.translate(0, 0, -MOUTH_DEPTH + 0.05);
  world.add(new THREE.Mesh(portalGeo, concrete));

  // Kaburgaların arkasındaki tünel derisi: profil boyunca süpürülmüş yüzey
  {
    const prof = 64;
    const segs = 6;
    const pos = [];
    const idx = [];
    for (let j = 0; j <= segs; j++) {
      const z = -MOUTH_DEPTH - (j / segs) * LENGTH;
      for (let i = 0; i <= prof; i++) {
        const p = profilePoint(i / prof, -RIB_T * 0.6);
        pos.push(p.x, p.y, z);
      }
    }
    for (let j = 0; j < segs; j++) {
      for (let i = 0; i < prof; i++) {
        const a = j * (prof + 1) + i, b = a + prof + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    world.add(new THREE.Mesh(g, skin));
  }

  // Not: Eski dev düz cephe duvarı (facade) kaldırıldı — tünel karanlık atmosferin içinde özgürce parlayarak öne çıkar.

  // Zemin: yalnızca tünelin içi ve yakın girişi boyunca yansıtıcı koyu şerit
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(R * 2.4, LENGTH + 6), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, FLOOR, -MOUTH_DEPTH - LENGTH / 2 + 2);
  floor.renderOrder = -1;
  world.add(floor);

  // Sonsuzdaki parlak derinlik çekirdeği + giriş atmosfer halesi
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color: '#FFF2D8', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  glow.scale.set(9.5, 9.5, 1);
  glow.position.set(0, SPRING * 0.5, -MOUTH_DEPTH - LENGTH + 1);
  world.add(glow);

  const mouthGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color: '#C88D48', transparent: true, opacity: 0.38, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  mouthGlow.scale.set(11, 9, 1);
  mouthGlow.position.set(0, SPRING * 0.35, -MOUTH_DEPTH - 1.5);
  world.add(mouthGlow);

  const endCap = new THREE.Mesh(new THREE.CircleGeometry(R * 3, 32), new THREE.MeshBasicMaterial({ color: BG }));
  endCap.position.set(0, 0, -MOUTH_DEPTH - LENGTH - 0.5);
  world.add(endCap);

  /* ---------- Işıklar: karanlık atmosferde tünel kaburgalarını güçlü parlatan ışıklar ---------- */
  scene.add(new THREE.HemisphereLight('#246B9E', '#020408', 0.45));
  const lights = [
    { l: new THREE.PointLight('#F2CFA0', 46, 15, 1.5), base: 46, off: new THREE.Vector3(-1.1, 1.4, -3.2) },
    { l: new THREE.PointLight('#2D89C8', 38, 16, 1.5), base: 38, off: new THREE.Vector3(1.2, 1.1, -8.5) },
    { l: new THREE.PointLight('#E2A968', 36, 18, 1.5), base: 36, off: new THREE.Vector3(-0.5, 1.8, -16) },
  ];
  lights.forEach(({ l }) => scene.add(l));

  /* ---------- Fiber hatları: parlak çekirdek + dengeli hale + masaüstünde zemin yansıması ---------- */
  const fiberMats = {
    core: fiberMaterial(lowPower ? 2.4 : 2.3, 1.0, false, resolution),
    halo: fiberMaterial(lowPower ? 7.5 : 10.5, 0.40, true, resolution),
    mirror: fiberMaterial(lowPower ? 4.5 : 7.0, 0.44, true, resolution),
  };
  const fiberGroup = new THREE.Group();
  world.add(fiberGroup);
  let fiberMeshes = [];

  // Kablo kanalları: profil üzerindeki konumlar (duvar alt/orta, kemer omuzları, tepe)
  const BUNDLES = [0.07, 0.17, 0.3, 0.41, 0.5, 0.59, 0.7, 0.83, 0.93];

  function buildFibers() {
    fiberMeshes.forEach((m) => { m.geometry.dispose(); fiberGroup.remove(m); });
    fiberMeshes = [];

    // Kartın Hero'daki yeri (kaydırma 0 iken), ekran koordinatında
    const card = document.querySelector('.idcard__body');
    const hr = hero.getBoundingClientRect();
    const iw = viewW(), ih = viewH();
    let cx = 0.45, cy = 0, ch = 0.6, cw = 0.25;     // varsayılan (kart bulunamazsa)
    if (card && card.getBoundingClientRect().height > 0) {
      const r = card.getBoundingClientRect();
      const stageY = window.gsap ? Number(window.gsap.getProperty('.hero__stage', 'y')) || 0 : 0;
      const top = r.top - hr.top - stageY;
      cx = ((r.left + r.width / 2) / iw) * 2 - 1;
      cy = -(((top + r.height / 2) / ih) * 2 - 1);
      ch = r.height / ih;
      cw = r.width / iw;
    }
    const hD = visH(CARD_DEPTH);
    const wD = hD * (iw / ih);
    const center = new THREE.Vector3((cx * wD) / 2, (cy * hD) / 2 - axisY, -CARD_DEPTH);   // world grubuna göre
    // Halka: kartın kenarını saran elips (yarı genişlik / yarı yükseklik, dünya biriminde)
    const halfW = (cw * wD) / 2;
    const halfH = (ch * hD) / 2;

    const rand = mulberry32(7);
    const lines = [];
    const mirrors = [];
    for (let f = 0; f < FIBERS; f++) {
      const seed = rand();
      // 1) Başlangıç: parçacık halkasında, kartın çevresinde
      // Halkada eşit aralıklı açılar (+ küçük sapma): hatlar düzenli bir demet gibi dağılır
      const ang = (f / FIBERS) * Math.PI * 2 + (rand() - 0.5) * 0.12;
      const spread = 1.04 + 0.22 * rand();
      const p0 = new THREE.Vector3(
        center.x + Math.cos(ang) * (halfW + halfH * 0.18) * spread,
        center.y + Math.sin(ang) * halfH * 0.92 * spread,
        center.z - 0.2 - rand() * 0.5
      );

      // 2) Tünelde gideceği kablo kanalı: halkanın solundaki hat sol duvara, sağındaki sağ duvara,
      //    üstündekiler kemere gider → hatlar birbirini kesmeden ağza akar
      const side = Math.cos(ang);                  // -1 sol … +1 sağ
      const up = Math.sin(ang);                    // -1 alt … +1 üst
      let sTarget = 0.5 + side * (0.42 - 0.3 * Math.max(0, up));
      let b = BUNDLES[0];
      for (const c of BUNDLES) if (Math.abs(c - sTarget) < Math.abs(b - sTarget)) b = c;
      const s = b + (rand() - 0.5) * 0.026;
      const inset = 0.06 + rand() * 0.14;
      const q = profilePoint(s, inset);

      // 3) Kontrol noktaları: kartın arkasından geç → yumuşakça aşağı kıvrıl → ağza gir → kanal boyunca devam et
      const entry = new THREE.Vector3(q.x, q.y, -MOUTH_DEPTH + 0.6);
      const behind = p0.clone().add(new THREE.Vector3((center.x - p0.x) * 0.25, -0.25, -1.4));
      const sweep = new THREE.Vector3(
        THREE.MathUtils.lerp(behind.x, entry.x, 0.5),
        THREE.MathUtils.lerp(behind.y, entry.y, 0.75) - 0.35,     // hafif sarkma: aşağı doğru kavis
        THREE.MathUtils.lerp(behind.z, entry.z, 0.55)
      );
      const pts = [p0, behind, sweep, entry];
      const steps = Math.ceil(LENGTH / 9);
      for (let k = 1; k <= steps; k++) {
        const z = -MOUTH_DEPTH - (k / steps) * (LENGTH - 2);
        const sag = Math.sin(k * 1.7 + seed * 9) * 0.03;
        pts.push(new THREE.Vector3(q.x + sag, q.y - Math.abs(sag), z));
      }
      const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      const sampled = curve.getSpacedPoints(SAMPLES);
      lines.push({ pts: sampled, seed });

      // Zemindeki yansıma: yalnızca tünelin içindeki kısım, zemine göre aynalanır
      const inside = sampled.filter((p) => p.z < -MOUTH_DEPTH - 0.5);
      if (inside.length > 2 && q.y < SPRING + 1.2) {
        const firstIdx = sampled.length - inside.length;
        let distStart = 0;
        for (let i = 1; i <= firstIdx; i++) distStart += sampled[i].distanceTo(sampled[i - 1]);
        mirrors.push({
          pts: inside.map((p) => new THREE.Vector3(p.x, 2 * FLOOR - p.y, p.z)),
          seed, distStart, uStart: firstIdx / (sampled.length - 1), uSpan: inside.length / sampled.length,
        });
      }
    }
    const g = ribbonGeometry(lines);
    const halo = new THREE.Mesh(g, fiberMats.halo);
    const core = new THREE.Mesh(g, fiberMats.core);
    core.renderOrder = 3; halo.renderOrder = 2;
    const meshes = [halo, core];
    if (!lowPower && mirrors.length) {
      const gm = ribbonGeometry(mirrors);
      const mirror = new THREE.Mesh(gm, fiberMats.mirror);
      mirror.renderOrder = 1;
      meshes.push(mirror);
    }
    meshes.forEach((m) => { m.frustumCulled = false; fiberGroup.add(m); });
    fiberMeshes = meshes;
  }

  /* ---------- Boyut ---------- */
  let lastW = 0;
  function layout() {
    const w = viewW(), h = viewH();
    measureDom();
    // Telefonda adres çubuğu açılıp kapanınca yalnızca yükseklik değişir: hatları yeniden kurma, sadece boyutla
    const rebuild = w !== lastW; lastW = w;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    resolution.set(w * dpr, h * dpr);
    // Şerit genişliği piksel cinsinden: çizim tamponu dpr ile ölçekli
    fiberMats.core.uniforms.uWidth.value = (lowPower ? 2.4 : 2.3) * dpr;
    fiberMats.halo.uniforms.uWidth.value = (lowPower ? 7.5 : 10.5) * dpr;
    fiberMats.mirror.uniforms.uWidth.value = (lowPower ? 4.5 : 7.0) * dpr;
    axisY = -(1 - PARALLAX) * heroRatio() * visH(CARD_DEPTH);
    world.position.y = axisY;
    if (rebuild) buildFibers();
  }

  /* ---------- Kaydırma → kamera (önbellekli DOM ölçüleriyle sıfır reflow) ---------- */
  const cam = { x: 0, y: 0, z: 0, lx: 0, ly: 0 };     // yumuşatılmış durum
  let mx = 0, my = 0;
  function targets() {
    const ih = metrics.ih;
    const y = window.scrollY;
    const heroH = metrics.heroH;
    const ph = THREE.MathUtils.clamp(y / heroH, 0, 1);
    const pt = THREE.MathUtils.clamp((y - metrics.tTop) / metrics.span, 0, 1);
    // Hero: kartın derinliğindeki noktalar kartla aynı hızda kaysın
    const ty = -ph * (1 - PARALLAX) * (heroH / ih) * visH(CARD_DEPTH);
    // Hero'nun son kısmında hafifçe ağza doğru yaklaş, sonra tünelde yumuşak ilerle
    const dolly = THREE.MathUtils.smoothstep(ph, 0.55, 1) * 2.6;
    // Tünel yolu iki parça:
    //  0 → 0.80  : yumuşak başla, "SAHADAN → KODA" yazısında yavaşla (okunsun)
    //  0.80 → 1  : portal açılır, kamera HIZLANARAK portala dalar (u^2.4)
    const P = 0.8;
    const travel = MOUTH_DEPTH - 2.6 + LENGTH - 9;
    let z;
    if (pt <= P) {
      const q = pt / P;
      z = (q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2) * travel;
    } else {
      const u = (pt - P) / (1 - P);
      z = travel + Math.pow(u, 2.4) * 6.5;          // tünelin ucuna (portala) doğru atılış
    }
    const tz = -dolly - z;
    // Tünelde çok hafif yalpalama: yürüyormuş gibi, mide bulandırmadan
    const tx = Math.sin(pt * Math.PI * 2.4) * 0.16 * pt;
    return { ph, pt, tx, ty, tz };
  }

  let ctaSurgeTarget = 0;
  let ctaSurge = 0;
  let surgeKick = 0;
  if (!reduce && window.matchMedia('(pointer: fine)').matches) {
    window.addEventListener('pointermove', (e) => {
      mx = e.clientX / window.innerWidth - 0.5;
      my = e.clientY / window.innerHeight - 0.5;
    }, { passive: true });
    document.addEventListener('pointerleave', () => { mx = 0; my = 0; });
    window.addEventListener('blur', () => { mx = 0; my = 0; ctaSurgeTarget = 0; });

    // "Projeler" butonunun üstüne gelince fiber hatlarda anlık enerji hızlanması + portal parlaması
    const projCta = hero.querySelector('.hero__cta .hbtn--fill');
    if (projCta) {
      const engage = () => { ctaSurgeTarget = 1; surgeKick = 1; };
      const release = () => { ctaSurgeTarget = 0; };
      projCta.addEventListener('mouseenter', engage);
      projCta.addEventListener('mouseleave', release);
      projCta.addEventListener('focus', engage);
      projCta.addEventListener('blur', release);
    }
  }

  /* ---------- Tünel HUD'u (mevcut yazılar korunur) ---------- */
  const codeEl = tunnel.querySelector('.tunnel__code');
  const zEl = tunnel.querySelector('.tunnel__z');
  const meter = tunnel.querySelector('.tunnel__meter i');
  const lines = [
    'λ = 1310 nm · SINGLE MODE',
    'L1 · L2 · L3 · N · PE → DATA',
    'SAHA SİNYALİ → ETHERNET',
    'if (sicaklik > 28) fan.start();',
    'class RMSA { control() {} }',
    'function automation() { return true; }',
  ];
  let lastLine = -1;
  let scrambleTimer = 0;
  function scrambleTo(text) {
    if (!codeEl) return;
    const chars = '01<>/{}=;_ABCDEF';
    let frame = 0;
    const total = 14;
    clearInterval(scrambleTimer);
    scrambleTimer = setInterval(() => {
      frame++;
      const done = Math.floor((frame / total) * text.length);
      codeEl.textContent = text.slice(0, done) + text.slice(done).replace(/[^\s]/g, () => chars[Math.floor(Math.random() * chars.length)]);
      if (frame >= total) { clearInterval(scrambleTimer); codeEl.textContent = text; }
    }, 28);
  }

  /* ---------- Giriş: loader bitince hatlar halkadan tünele uzar ---------- */
  const reveal = { value: reduce ? 1 : 0 };
  let introStarted = false;
  function startIntro() {
    if (introStarted || reduce) return;
    introStarted = true;
    if (window.gsap) window.gsap.to(reveal, { value: 1, duration: 4.5, delay: 0.6, ease: 'power2.inOut' });
    else reveal.value = 1;
  }
  window.addEventListener('hero:intro', startIntro);
  if (window.__heroIntroStarted) startIntro();
  // Sayfa doğrudan aşağıdan açıldıysa (giriş yok) hatlar hazır olsun
  if (window.scrollY > window.innerHeight * 0.5) { introStarted = true; reveal.value = 1; }

  /* ---------- Döngü ---------- */
  const clock = new THREE.Clock();
  let flow = 0;
  let lastScroll = window.scrollY;
  let scrollBoost = 0;
  function frame() {
    const dt = Math.min(clock.getDelta(), 1 / 30);
    const t = targets();
    const k = reduce ? 1 : 1 - Math.exp(-dt * 4.5);
    cam.x += (t.tx - cam.x) * k;
    cam.y += (t.ty - cam.y) * k;
    cam.z += (t.tz - cam.z) * k;
    const lookK = reduce ? 1 : 1 - Math.exp(-dt * 3.8);
    cam.lx += (mx - cam.lx) * lookK;
    cam.ly += (my - cam.ly) * lookK;

    // Hero'dayken fare ile gerçekçi 3B paralaks (±1.8° bakış + hafif yatay/dikey kayma);
    // tünele girildikçe duvara değmemesi için yumuşakça sönümlenir
    const heroDepth = 1 - THREE.MathUtils.smoothstep(t.ph, 0.25, 0.9);
    const px = cam.lx * 0.42 * heroDepth;
    const py = -cam.ly * 0.24 * heroDepth;
    camera.position.set(cam.x + px, cam.y + py, cam.z);
    const yawAmt = 0.045 + 0.025 * heroDepth;     // Hero'da ~±2.0°, tünelde ~±1.3°
    const pitchAmt = 0.030 + 0.018 * heroDepth;   // Hero'da ~±1.4°, tünelde ~±0.85°
    const rollAmt = -cam.lx * 0.012 * heroDepth;
    camera.rotation.set(-cam.ly * pitchAmt, -cam.lx * yawAmt, Math.sin(cam.z * 0.05) * 0.006 + rollAmt);

    // "Projeler" hover enerji hızlanması + portal ağzı canlı nefes alma parlaması
    ctaSurge += (ctaSurgeTarget - ctaSurge) * (1 - Math.exp(-dt * (ctaSurgeTarget ? 5.5 : 3.2)));
    surgeKick *= Math.exp(-dt * 4.2);
    const surgeTotal = Math.min(1.25, ctaSurge + surgeKick * 0.55);
    const breath = 0.5 + 0.5 * Math.sin(flow * 1.45);

    lights.forEach(({ l, base, off }) => {
      l.position.set(off.x, axisY + off.y, cam.z + off.z);
      l.intensity = base * (0.94 + 0.08 * breath + surgeTotal * 0.42);
    });
    if (ringMat) ringMat.opacity = 0.48 + 0.08 * breath + surgeTotal * 0.28;
    if (mouthRingMat) mouthRingMat.opacity = Math.min(1, 0.88 + 0.07 * breath + surgeTotal * 0.08);
    if (mouthHaloMat) mouthHaloMat.opacity = 0.30 + 0.07 * breath + surgeTotal * 0.30;
    mouthGlow.material.opacity = 0.36 + 0.07 * breath + surgeTotal * 0.28;
    const mgScale = 1 + 0.03 * breath + surgeTotal * 0.14;
    mouthGlow.scale.set(11 * mgScale, 9 * mgScale, 1);
    const endScale = 9.5 * (1 + 0.05 * breath + t.pt * 0.35);
    glow.scale.set(endScale, endScale, 1);

    // Işık akışı: sabit hız + kaydırma hızı + "Projeler" hover enerji hızlanması
    const sv = Math.abs(window.scrollY - lastScroll) / Math.max(1, window.innerHeight) / Math.max(dt, 1e-3);
    lastScroll = window.scrollY;
    scrollBoost += (Math.min(sv, 3) - scrollBoost) * Math.min(1, dt * 3);
    if (!reduce) {
      flow += dt * (0.32 + scrollBoost * 0.9 + surgeTotal * 1.95);
      dustMat.uniforms.uTime.value += dt * (1 + surgeTotal * 0.9);
    }
    for (const m of Object.values(fiberMats)) {
      m.uniforms.uFlow.value = flow;
      m.uniforms.uReveal.value = reveal.value;
      m.uniforms.uSurge.value = Math.min(1, surgeTotal);
    }

    // HUD
    if (meter) meter.style.width = (t.pt * 100).toFixed(1) + '%';
    if (zEl) zEl.textContent = String(Math.max(0, Math.round(-cam.z * 10))).padStart(3, '0');
    const idx = Math.min(lines.length - 1, Math.floor(t.pt * lines.length));
    if (idx !== lastLine && t.pt > 0) { lastLine = idx; scrambleTo(lines[idx]); }
    // Kod satırı, "SAHADAN → KODA" yazısı, portal, parlama ve tuvalin sönmesi
    // kaydırmaya bağlı olarak js/portal.js'te yönetilir (döngü dururken de çalışsın diye).

    renderer.render(scene, camera);
  }

  /* ---------- Yalnızca Hero veya tünel ekrandayken (ve loader kapandıktan sonra) çiz ----------
     Loader arkada 3B döngüyle CPU/GPU yarışına girmez; tünel bitince çizim durur. */
  let running = false;
  const tunnelEnd = () => metrics.tunnelEnd;
  function shouldRun() {
    const loading = document.body.classList.contains('is-loading');
    return !document.hidden && !loading && window.scrollY < tunnelEnd();
  }
  function update() {
    const on = shouldRun();
    canvas.style.visibility = window.scrollY < tunnelEnd() ? 'visible' : 'hidden';
    if (reduce) { if (on) frame(); return; }    // hareketi azalt: sadece kaydırınca tek kare
    if (on === running) return;
    running = on;
    if (on) clock.getDelta();
    renderer.setAnimationLoop(on ? frame : null);
  }
  window.addEventListener('hero:intro', () => { measureDom(); update(); });
  window.addEventListener('scroll', update, { passive: true });
  document.addEventListener('visibilitychange', update);
  if (window.ScrollTrigger) window.ScrollTrigger.addEventListener('refresh', measureDom);

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { layout(); if (!running) frame(); }, 120);
  });

  layout();
  const t0 = targets();
  cam.x = t0.tx; cam.y = t0.ty; cam.z = t0.tz;
  frame();
  update();

  // Test / hata ayıklama için küçük bir tutamak
  // snap(): kamerayı yumuşatmadan hedefe oturtur (ekran görüntüsü testleri için)
  window.fiberTunnel = {
    renderer, scene, camera, reveal, fiberMats, frame, targets,
    snap: () => { const t = targets(); cam.x = t.tx; cam.y = t.ty; cam.z = t.tz; frame(); },
  };
}

try {
  init();
} catch (err) {
  console.error('[fiber-tunnel] başlatılamadı:', err);
  if (canvas) canvas.style.display = 'none';
  document.documentElement.classList.add('no-fiber');
}
