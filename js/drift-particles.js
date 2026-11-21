/* =========================================================
   İMLECİN IŞIK İZİ + BIRAKINCA PARÇACIKLAR (bütün sayfa)
   Three.js + GLSL + GPGPU
   ---------------------------------------------------------
   1) Parçacıklar sayfa boyunca yavaş bir akıntıyla serbestçe
      dolaşır. Kenardan çıkan karşı kenardan geri girer.
   2) İmleç hareket edince arkasından kesintisiz, yumuşak bir ışık izi
      (şerit) akar. Parçacıklar bu sırada görünmez ama izin üzerinde dizilidir.
   3) İmleç durunca ya da sayfadan çıkınca ışık izi söner ve aynı yerde
      parçacıklara dönüşür; parçacıklar yavaşça dağılıp kaybolur.
   4) Konum ve hız GPU'da iki dokuda (texture) tutulur; her karede
      GPU güncellenir, işlemciye yük binmez.
   Tuval (#heroDrift, .cursor-trail) bütün sayfayı kaplar, içeriğin ve menünün
   üstünde, özel imlecin altında durur; tıklamaları engellemez.
   ========================================================= */
import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';

const canvas = document.getElementById('heroDrift');
// Tuval bütün sayfayı kaplar (sabit, .cursor-trail); koordinatlar pencereye göredir.
// (clientWidth: kaydırma çubuğu hariç — sabit tuvalin genişliğiyle aynı, imleç kaymaz)
const viewW = () => Math.max(1, document.documentElement.clientWidth || window.innerWidth || 1);
const viewH = () => Math.max(1, document.documentElement.clientHeight || window.innerHeight || 1);

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const lowPower = window.matchMedia('(hover: none) and (pointer: coarse)').matches || window.innerWidth < 700;
const SIM = lowPower ? 32 : 48;    // doku kenarı → 1024 ya da 2304 parçacık (çizgi hâlinde az da yeterli)
const COUNT = SIM * SIM;
// İmlecin izi: son TRAIL noktası, aralarında TRAIL_STEP mesafe (dünya birimi; Hero yüksekliği = 2)
const TRAIL = 48;
const TRAIL_STEP = 0.022;
const RIB_HW = 0.075;      // ışık izinin başındaki yarı genişlik (geniş, sönük hale dahil)

/* ---------------------------------------------------------
   Koordinatlar: Hero'nun yüksekliği 2 birim (y: -1…1),
   genişliği 2 × en/boy oranı (x: -oran…oran).
   tPos: xy = konum, z = katman (0 uzak … 1 yakın), w = tohum
   tVel: xy = hız
   --------------------------------------------------------- */
const COMMON = /* glsl */ `
uniform float uTime;
uniform float uDelta;
uniform vec2  uBounds;         // yarı genişlik, yarı yükseklik

// Serbest dolaşım için yumuşak, girdaplı bir akıntı (ucuz: birkaç sin/cos)
vec2 flow(vec2 p, float seed, float t) {
  float a = sin(p.y * 1.7 + t * 0.13 + seed * 6.0) + cos(p.x * 0.9 - t * 0.07);
  float b = cos(p.x * 1.3 - t * 0.11 + seed * 4.0) - sin(p.y * 0.8 + t * 0.09);
  return vec2(a, b) * 0.055 + vec2(0.012, 0.004);   // hafif bir sağa-yukarı sürüklenme
}

// Parçacıkların ~%75'i imleci takip eder; her birinin farklı gecikmesi var
float followerOf(float seed) { return step(fract(seed * 13.7), 0.75); }
`;

const VELOCITY_SHADER = /* glsl */ `
${COMMON}
uniform vec2  uMouse;          // imlecin bu koordinattaki yeri
uniform float uFollow;         // 0 = takip yok, 1 = tam takip
uniform float uScatter;        // imleç bırakılınca kısa süre 1'e çıkar: küme dağılır
uniform vec2  uTrail[${TRAIL}];  // imlecin geçtiği yol (0 = imlece en yakın, sona doğru eski)

// İz üzerinde s ∈ [0,1] konumundaki nokta: s = 0 imlecin kendisi, s = 1 izin en eski ucu
vec2 trailPoint(float s) {
  float f = s * float(${TRAIL});
  float i0 = floor(f);
  vec2 a = uMouse;
  vec2 b = uTrail[0];
  for (int i = 1; i < ${TRAIL}; i++) {
    if (float(i) > i0) break;
    a = uTrail[i - 1];
    b = uTrail[i];
  }
  return mix(a, b, f - i0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 p = texture2D(texturePos, uv);
  vec2 vel = texture2D(textureVel, uv).xy;
  float seed = p.w;

  // 1) Serbest dolaşım: akıntı + her parçacığın kendi yavaşça dönen yönü.
  //    Kendi yönü olmasa yan yana duran parçacıklar hep birlikte akar, küme dağılmazdı.
  float wa = seed * 6.2831 + uTime * (0.15 + 0.2 * fract(seed * 2.9)) * (fract(seed * 6.1) > 0.5 ? 1.0 : -1.0);
  vec2 wander = vec2(cos(wa), sin(wa)) * 0.07;
  vec2 acc = ((flow(p.xy, seed, uTime) + wander) * (0.6 + 0.8 * p.z) - vel) * 1.4;

  // 2) Takip: her parçacık ışık izinin üzerindeki kendi yerine yerleşir (bu sırada
  //    görünmezler). Bırakılınca tam izin olduğu yerden parçacık olarak ortaya çıkarlar.
  float follower = followerOf(seed) * uFollow;
  float s = fract(seed * 7.31);
  vec2 onTrail = trailPoint(s);
  vec2 ahead = trailPoint(max(0.0, s - 0.02));
  vec2 tang = ahead - onTrail;
  float tl = length(tang);
  vec2 nrm = tl > 1e-5 ? vec2(-tang.y, tang.x) / tl : vec2(0.0);
  // izin kalınlığı kadar yayılırlar: başta biraz kalın, kuyruğa doğru incelir
  vec2 target = onTrail + nrm * (fract(seed * 3.3) - 0.5) * 0.06 * (1.0 - s);

  // 3) Takip etmeyenler: imleç geçerken hafifçe kenara açılır
  vec2 d = p.xy - uMouse;
  float dist = length(d);
  float push = (1.0 - smoothstep(0.0, 0.22, dist)) * uFollow * (1.0 - followerOf(seed));
  acc += (d / max(dist, 1e-4)) * push * 1.6;

  // 4) Bırakılınca: her parçacık izden yana doğru çok hafifçe açılır (her biri farklı güçte),
  //    sonra serbest akıntıya karışır
  float side = fract(seed * 3.3) - 0.5;
  acc += nrm * side * uScatter * uScatter * (0.2 + 0.4 * fract(seed * 2.7)) * followerOf(seed);

  vel += acc * uDelta;
  vel *= exp(-0.8 * uDelta);

  // Takipçiler yay yerine doğrudan hedef hıza geçer: her karede kalan mesafenin
  // (1 - e^(-dt/0.015)) kadarını kapatır → ~0.015 sn zaman sabiti, kare hızından bağımsız.
  // Başı imlece yumuşakça yaklaşan ve gevşetilen iz sayesinde hızlı olup kırılmadan akar.
  // (Eski yay + sönüm ~0.4 sn geride kalıyordu; bu yüzden imlecin arkasından gecikmeli geliyorlardı.)
  // Uzaktakiler ışınlanmasın diye hız sınırlı.
  float dt = max(uDelta, 1e-4);
  vec2 desired = (target - p.xy) * (1.0 - exp(-dt / 0.015)) / dt;
  float dl = length(desired);
  if (dl > 30.0) desired *= 30.0 / dl;
  vel = mix(vel, desired, follower);
  gl_FragColor = vec4(vel, 0.0, 1.0);
}`;

const POSITION_SHADER = /* glsl */ `
${COMMON}
void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 p = texture2D(texturePos, uv);
  vec2 vel = texture2D(textureVel, uv).xy;
  vec2 xy = p.xy + vel * uDelta;

  // Kenardan çıkan karşı kenardan girer (biraz pay bırakılır ki görünmesin)
  vec2 lim = uBounds + 0.06;
  if (xy.x >  lim.x) xy.x -= 2.0 * lim.x;
  if (xy.x < -lim.x) xy.x += 2.0 * lim.x;
  if (xy.y >  lim.y) xy.y -= 2.0 * lim.y;
  if (xy.y < -lim.y) xy.y += 2.0 * lim.y;
  gl_FragColor = vec4(xy, p.z, p.w);
}`;

/* ---------------------------------------------------------
   Çizim
   --------------------------------------------------------- */
const LINES_VERTEX = /* glsl */ `
uniform sampler2D tPos;
uniform sampler2D tVel;
uniform float uIntro;
uniform float uShow;           // 0 → 1: ışık izi ne kadar görünür
uniform float uScatter;        // bırakınca 1'e çıkar, yavaşça söner: parçacıklar kaybolur
attribute vec2 ref;
attribute float tail;          // 0 = çizginin başı (parçacığın kendisi), 1 = kuyruğu
varying vec3  vColor;
varying float vAlpha;
void main() {
  vec4 p = texture2D(tPos, ref);
  vec2 vel = texture2D(tVel, ref).xy;
  float seed = p.w;
  float layer = p.z;
  float speed = length(vel);

  // Düz çizgi: parçacıktan geriye, hareket yönünün tersine uzanır. Hızlandıkça uzar.
  vec2 dir = speed > 1e-4 ? vel / speed : vec2(1.0, 0.0);
  float len = clamp(speed * 0.09, 0.01, 0.16) * (0.6 + 0.6 * layer);
  vec2 xy = p.xy - dir * len * tail;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(xy, 0.0, 1.0);

  vec3 cyan  = vec3(0.00, 0.72, 0.96);
  vec3 white = vec3(0.90, 0.98, 1.00);
  vColor = mix(cyan, white, 0.25 + 0.5 * smoothstep(0.85, 1.0, fract(seed * 17.3)));

  // Yalnızca takipçiler ve yalnızca bırakıldıktan sonra görünür: takip sırasında yerlerini
  // ışık izi alır (uShow), iz söndükçe parçacıklar belirir ve uScatter ile yavaşça kaybolur.
  float follower = step(fract(seed * 13.7), 0.75);
  float vis = follower * uScatter * (1.0 - uShow);
  vAlpha = (0.55 + 0.45 * layer) * (1.0 - tail) * vis * uIntro;
}`;

const LINES_FRAGMENT = /* glsl */ `
varying vec3  vColor;
varying float vAlpha;
void main() {
  gl_FragColor = vec4(vColor, vAlpha);
}`;

/* Işık izi (şerit): CPU her karede izin iki kenarını hesaplar, burada yalnızca
   kesit boyunca parlak bir çekirdek + yumuşak bir hale çizilir. */
const RIBBON_VERTEX = /* glsl */ `
attribute float along;         // 0 = imleç, 1 = izin en eski ucu
attribute float across;        // -1 … 1: şeridin bir kenarından öbürüne
varying float vAlong;
varying float vAcross;
varying float vHw;             // bu noktadaki yarı genişlik (dünya birimi) — CPU'daki formülün aynısı
void main() {
  vAlong = along;
  vAcross = across;
  vHw = ${RIB_HW} * pow(1.0 - along, 0.6) + 0.003;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xy, 0.0, 1.0);
}`;

const RIBBON_FRAGMENT = /* glsl */ `
uniform float uShow;
uniform float uIntro;
uniform float uTime;
varying float vAlong;
varying float vAcross;
varying float vHw;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// Eski parçacık çizgisinin görünümü: iz boyunca dizilmiş, uzunlamasına kısa çizgicikler.
// Yalnızca görüntü; ayrı parçacık yok. Hücre ızgarası dünya biriminde (along × iz uzunluğu,
// across × yarı genişlik), her hücrede rastgele yerde bir çizgicik olabilir.
float sparks(vec2 w, float cell, float density, float seedOff) {
  vec2 g = w / cell;
  vec2 c = floor(g);
  vec2 f = fract(g);
  float h = hash(c + seedOff);
  if (h > density) return 0.0;
  vec2 ctr = vec2(hash(c + 1.7 + seedOff), 0.25 + 0.5 * hash(c + 5.3 + seedOff));
  vec2 d = (f - ctr) * vec2(0.45, 1.6);                 // uzunlamasına çizgicik
  float twinkle = 0.6 + 0.4 * sin(uTime * (2.0 + 4.0 * h) + h * 40.0);
  return (1.0 - smoothstep(0.0, 0.32, length(d))) * twinkle * (0.5 + 0.5 * hash(c + 9.1 + seedOff));
}

void main() {
  float x = abs(vAcross);
  float fade = pow(1.0 - vAlong, 1.3);             // kuyruğa doğru söner
  float tip = exp(-vAlong * 18.0);                 // imlecin ucunda parlak bir ışık noktası

  // Işık gibi görünsün diye üç katmanlı yumuşak düşüş (gauss): beyaz-sıcak ince çekirdek,
  // açık camgöbeği iç parıltı, geniş ve sönük mavi hale. Toplamalı karışımda üst üste
  // binince çekirdek doygun beyaza döner — gerçek bir ışık çizgisi gibi.
  float core  = exp(-x * x * 180.0) * 1.25;
  float inner = exp(-x * x * 22.0) * 0.55;
  float halo  = exp(-x * x * 4.5) * 0.22 * (1.0 + 2.0 * tip);

  // Boyunca hafif akan enerji dalgalanması (ışık titreşimi), çok ince
  float shimmer = 0.9 + 0.1 * sin(vAlong * 46.0 - uTime * 9.0);

  // Eski parçacık dokusu yalnızca iç parıltının içinde, hafifçe
  vec2 w = vec2(vAlong * ${(TRAIL * TRAIL_STEP).toFixed(3)}, vAcross * vHw);
  float sp = (sparks(w, 0.012, 0.5, 0.0) + sparks(w + 0.004, 0.007, 0.35, 13.0) * 0.7) * exp(-x * x * 12.0) * 0.5;

  vec3 white = vec3(1.00, 1.00, 1.00);
  vec3 ice   = vec3(0.55, 0.90, 1.00);
  vec3 cyan  = vec3(0.00, 0.62, 1.00);
  vec3 col = white * core + ice * (inner + sp) + cyan * halo;
  col *= shimmer * (1.0 + 1.3 * tip);
  float k = fade * uShow * uIntro;
  col *= k;
  // Tuval saydam ve önceden çarpılmış alfa kullanıyor: alfa = rengin en parlak kanalı,
  // böylece ışık olmayan yerler tamamen saydam kalır (altındaki sayfa kararmaz).
  gl_FragColor = vec4(col, clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0));
}`;

/* ---------------------------------------------------------
   Yardımcılar
   --------------------------------------------------------- */
function mulberry32(seed) {             // tekrarlanabilir rastgele sayı
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------------------------------------------------
   Kurulum
   --------------------------------------------------------- */
function init() {
  if (!canvas) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    canvas.style.display = 'none';      // WebGL yoksa sessizce vazgeç; site aynen çalışır
    return;
  }
  const dpr = Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 2);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
  const bounds = new THREE.Vector2(1, 1);

  /* ---------- GPGPU ---------- */
  const gpu = new GPUComputationRenderer(SIM, SIM, renderer);
  if (lowPower) gpu.setDataType(THREE.HalfFloatType);   // telefonlarda daha uyumlu
  const pos0 = gpu.createTexture();
  const vel0 = gpu.createTexture();
  const rand = mulberry32(20261120);
  const start = pos0.image.data;
  const aspect0 = viewW() / viewH();
  for (let i = 0; i < COUNT; i++) {
    start[i * 4] = (rand() * 2 - 1) * aspect0;
    start[i * 4 + 1] = rand() * 2 - 1;
    start[i * 4 + 2] = Math.pow(rand(), 1.6);   // çoğu uzak katmanda, azı yakında
    start[i * 4 + 3] = rand();
  }

  const posVar = gpu.addVariable('texturePos', POSITION_SHADER, pos0);
  const velVar = gpu.addVariable('textureVel', VELOCITY_SHADER, vel0);
  gpu.setVariableDependencies(posVar, [posVar, velVar]);
  gpu.setVariableDependencies(velVar, [posVar, velVar]);
  const shared = {
    uTime: { value: 0 }, uDelta: { value: 1 / 60 }, uBounds: { value: bounds },
  };
  const trail = Array.from({ length: TRAIL }, () => new THREE.Vector2());
  const velUniforms = {
    uMouse: { value: new THREE.Vector2(0, 0) }, uFollow: { value: 0 }, uScatter: { value: 0 },
    uTrail: { value: trail },
  };
  Object.assign(velVar.material.uniforms, shared, velUniforms);
  Object.assign(posVar.material.uniforms, shared);
  const err = gpu.init();
  if (err) {
    console.warn('[drift] GPGPU kapalı:', err);
    canvas.style.display = 'none';
    renderer.dispose();
    return;
  }

  /* ---------- Çizgiler: her parçacık için iki uç (baş + kuyruk) ---------- */
  const geo = new THREE.BufferGeometry();
  const refs = new Float32Array(COUNT * 4);
  const tails = new Float32Array(COUNT * 2);
  for (let i = 0; i < COUNT; i++) {
    const u = ((i % SIM) + 0.5) / SIM, v = (Math.floor(i / SIM) + 0.5) / SIM;
    refs.set([u, v, u, v], i * 4);
    tails[i * 2] = 0;
    tails[i * 2 + 1] = 1;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 6), 3)); // yer tutucu
  geo.setAttribute('ref', new THREE.BufferAttribute(refs, 2));
  geo.setAttribute('tail', new THREE.BufferAttribute(tails, 1));
  const uniforms = {
    tPos: { value: null }, tVel: { value: null },
    uIntro: { value: reduce ? 1 : 0 }, uShow: { value: 0 }, uScatter: velUniforms.uScatter,
  };
  const lines = new THREE.LineSegments(geo, new THREE.ShaderMaterial({
    vertexShader: LINES_VERTEX, fragmentShader: LINES_FRAGMENT, uniforms,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  }));
  lines.frustumCulled = false;           // konumlar GPU'da değişiyor
  scene.add(lines);

  /* ---------- Işık izi: TRAIL + 1 nokta × 2 kenar ---------- */
  const RIB_N = TRAIL + 1;
  const ribGeo = new THREE.BufferGeometry();
  const ribPos = new Float32Array(RIB_N * 2 * 3);
  const ribAlong = new Float32Array(RIB_N * 2);
  const ribAcross = new Float32Array(RIB_N * 2);
  const ribIndex = [];
  for (let i = 0; i < RIB_N; i++) {
    ribAlong[i * 2] = ribAlong[i * 2 + 1] = i / (RIB_N - 1);
    ribAcross[i * 2] = -1;
    ribAcross[i * 2 + 1] = 1;
    if (i < RIB_N - 1) {
      const a = i * 2;
      ribIndex.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const ribPosAttr = new THREE.BufferAttribute(ribPos, 3);
  ribPosAttr.setUsage(THREE.DynamicDrawUsage);
  ribGeo.setAttribute('position', ribPosAttr);
  ribGeo.setAttribute('along', new THREE.BufferAttribute(ribAlong, 1));
  ribGeo.setAttribute('across', new THREE.BufferAttribute(ribAcross, 1));
  ribGeo.setIndex(ribIndex);
  const ribbon = new THREE.Mesh(ribGeo, new THREE.ShaderMaterial({
    vertexShader: RIBBON_VERTEX, fragmentShader: RIBBON_FRAGMENT,
    uniforms: { uShow: uniforms.uShow, uIntro: uniforms.uIntro, uTime: shared.uTime },
    transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending,                 // önceden çarpılmış renk, toplamalı karışım
    blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
  }));
  ribbon.frustumCulled = false;
  ribbon.visible = false;
  scene.add(ribbon);

  // Şeridin kenarlarını izden hesaplar. Yarı genişlik başta ~0.024 (hale dahil), kuyrukta incelir.
  const nPrev = new THREE.Vector2(0, 1);
  const nCur = new THREE.Vector2();
  function updateRibbon() {
    const m = velUniforms.uMouse.value;
    for (let i = 0; i < RIB_N; i++) {
      const p = i === 0 ? m : trail[i - 1];
      const a = i <= 1 ? m : trail[i - 2];          // önceki nokta
      const b = i < RIB_N - 1 ? trail[i] : p;       // sonraki nokta
      nCur.set(-(a.y - b.y), a.x - b.x);
      if (nCur.lengthSq() > 1e-10) { nCur.normalize(); nPrev.copy(nCur); } else nCur.copy(nPrev);
      const t = i / (RIB_N - 1);
      const hw = RIB_HW * Math.pow(1 - t, 0.6) + 0.003;
      const k = i * 6;
      ribPos[k] = p.x - nCur.x * hw; ribPos[k + 1] = p.y - nCur.y * hw;
      ribPos[k + 3] = p.x + nCur.x * hw; ribPos[k + 4] = p.y + nCur.y * hw;
    }
    ribPosAttr.needsUpdate = true;
  }

  const syncTextures = () => {
    uniforms.tPos.value = gpu.getCurrentRenderTarget(posVar).texture;
    uniforms.tVel.value = gpu.getCurrentRenderTarget(velVar).texture;
  };
  syncTextures();

  /* ---------- Boyut ---------- */
  function layout() {
    const w = viewW(), h = viewH();
    renderer.setSize(w, h, false);
    const aspect = w / Math.max(1, h);
    bounds.set(aspect, 1);
    camera.left = -aspect; camera.right = aspect;
    camera.updateProjectionMatrix();
    if (!running) renderer.render(scene, camera);
  }

  /* ---------- İmleç / dokunma ---------- */
  let pointerInside = false;
  let lastMove = 0;
  const rawMouse = new THREE.Vector2();   // imlecin gerçek yeri; uMouse buna yumuşakça yaklaşır
  const tmpV = new THREE.Vector2();

  // Her kare: izin başı imlece yumuşakça yaklaşır, iz eşit aralıklı uzar. İmleç
  // hareket ederken iz ip gibi gevşetilir (her nokta komşularının ortasına biraz çekilir):
  // hızlı harekette oluşan sivri köşeler yuvarlanır. İmleç durunca iz olduğu yerde kalır,
  // böylece bırakıldığında parçacıklar tam izin üzerinden çıkar.
  function updateTrail(dt) {
    const m = velUniforms.uMouse.value;
    const bx = m.x, by = m.y;
    m.lerp(rawMouse, 1 - Math.exp(-dt / 0.03));
    const moving = Math.hypot(m.x - bx, m.y - by) > 1e-4;
    let guard = TRAIL;
    while (m.distanceTo(trail[0]) > TRAIL_STEP && guard-- > 0) {
      tmpV.copy(m).sub(trail[0]).setLength(TRAIL_STEP).add(trail[0]);
      for (let i = TRAIL - 1; i > 0; i--) trail[i].copy(trail[i - 1]);
      trail[0].copy(tmpV);
    }
    if (!moving) return;
    const relax = 1 - Math.exp(-dt * 10);
    for (let i = 0; i < TRAIL - 1; i++) {
      const prev = i === 0 ? m : trail[i - 1];
      const next = trail[i + 1];
      trail[i].x += ((prev.x + next.x) * 0.5 - trail[i].x) * relax;
      trail[i].y += ((prev.y + next.y) * 0.5 - trail[i].y) * relax;
    }
  }

  function onPointer(e) {
    const nx = (e.clientX / viewW()) * 2 - 1;
    const ny = -((e.clientY / viewH()) * 2 - 1);
    rawMouse.set(nx * bounds.x, ny);
    // Uzun aradan sonra iz baştan, imlecin yerinde başlar (eski yerden çizgi çekilmesin)
    if (!pointerInside || performance.now() - lastMove > 1500) {
      velUniforms.uMouse.value.copy(rawMouse);
      trail.forEach((t) => t.copy(rawMouse));
    }
    pointerInside = true;
    lastMove = performance.now();
  }
  const onLeave = () => { pointerInside = false; };
  const onUp = (e) => { if (e.pointerType !== 'mouse') pointerInside = false; };
  if (!reduce) {
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('pointerdown', onPointer, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('pointercancel', onLeave, { passive: true });
    document.addEventListener('pointerleave', onLeave);
  }

  /* ---------- Giriş: loader bitince parçacıklar belirir ---------- */
  let introStarted = false;
  function startIntro() {
    if (introStarted || reduce) return;
    introStarted = true;
    if (window.gsap) window.gsap.to(uniforms.uIntro, { value: 1, duration: 2.2, ease: 'power2.out' });
    else uniforms.uIntro.value = 1;
  }
  window.addEventListener('hero:intro', startIntro);
  if (window.__heroIntroStarted) startIntro();

  /* ---------- Döngü ---------- */
  const clock = new THREE.Clock();
  let follow = 0;
  let scatter = 0;
  let wasFollowing = false;
  let wasVisible = true;
  function frame(fixedDt) {
    // uzun kare yaylarını patlatmasın; fixedDt yalnızca test tutamağı içindir
    const dt = typeof fixedDt === 'number' ? fixedDt : Math.min(clock.getDelta(), 1 / 30);
    shared.uTime.value += dt;
    shared.uDelta.value = dt;
    updateTrail(dt);

    // Takip: imleç hareket ederken açılır; durduktan ~0.4 sn sonra ışık izi ~1 sn'de söner
    const idle = (performance.now() - lastMove) / 1000;
    const target = pointerInside ? (idle < 0.4 ? 1 : Math.max(0, 1 - (idle - 0.4) * 1.2)) : 0;
    follow += (target - follow) * Math.min(1, dt * (target > follow ? 10 : 3));
    velUniforms.uFollow.value = follow * uniforms.uIntro.value;
    uniforms.uShow.value = follow;
    // İz sönmeye başladığı anda parçacıklar belirir (uScatter = 1), sonra ~5 sn'de yavaşça kaybolur.
    // Yeniden takip başlarsa (1 - uShow) onları zaten gizler.
    if (follow > 0.9) wasFollowing = true;
    if (wasFollowing && follow < 0.85) { scatter = 1; wasFollowing = false; }
    scatter *= Math.exp(-dt * 0.5);
    velUniforms.uScatter.value = scatter;

    // Boştayken (takip yok, savrulma bitti) hiçbir şey görünmez: GPU'da hesap ve çizim yapma.
    // Görünürlük sıfıra indiği kare bir kez çizilir ki tuval temizlensin.
    const visible = Math.max(follow, scatter) > 0.002;
    if (!visible && !wasVisible) return;
    wasVisible = visible;
    gpu.compute();
    syncTextures();
    ribbon.visible = follow > 0.002;
    if (ribbon.visible) updateRibbon();
    renderer.render(scene, camera);
  }

  // Sekme arka plandaysa döngüyü durdur. (Boştayken frame zaten GPU'ya iş vermez.)
  let running = false;
  function setRunning() {
    const on = !reduce && !document.hidden;
    if (on === running) return;
    running = on;
    if (on) clock.getDelta();
    // frame'e zaman damgası geçmesin (frame'in parametresi yalnızca test için sabit adım)
    renderer.setAnimationLoop(on ? () => frame() : null);
  }
  document.addEventListener('visibilitychange', setRunning);
  // Pencere boyutu değişmese de kaydırma çubuğu (yükleme bitince) görünür/gizlenirse
  // tuval genişliği değişir; ResizeObserver ikisini de yakalar.
  if ('ResizeObserver' in window) new ResizeObserver(layout).observe(canvas);
  else window.addEventListener('resize', layout);
  layout();
  setRunning();
  if (reduce) renderer.render(scene, camera);       // hareketi azalt: tek, durağan kare

  // Test / hata ayıklama için küçük bir tutamak
  // simulate(sn): kareleri beklemeden simülasyonu sabit adımlarla ilerletir
  window.heroDrift = {
    count: COUNT, uniforms, velUniforms, renderer,
    // GPU'daki konumları okur: [x, y, katman, tohum] × COUNT
    readPositions: () => {
      const out = new Float32Array(COUNT * 4);
      renderer.readRenderTargetPixels(gpu.getCurrentRenderTarget(posVar), 0, 0, SIM, SIM, out);
      return out;
    },
    simulate: (seconds) => { for (let i = 0; i < Math.round(seconds * 60); i++) frame(1 / 60); },
  };
}

try {
  init();
} catch (err) {
  console.error('[drift] başlatılamadı:', err);
  if (canvas) canvas.style.display = 'none';
}
