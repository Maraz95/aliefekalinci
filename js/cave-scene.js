/* =========================================================
   ANTİK AKDENİZ SÜTUNLU KIYI GALERİSİ & KAMP ATEŞİ (Three.js)
   ---------------------------------------------------------
   Hakkımda (Akdeniz taş terası) ve Projeler (6 antik traverten sütun)
   ile birebir bütünleşen denize bakan traverten kolonad galerisi:
   - Sol kenarda açık denize bakan 8 yivli antik Akdeniz traverten sütunu,
     taş saçak/tavan kirişleri ve denize uzanan kıyı kayalıkları
   - Sağdaki sıcak kesme traverten duvarında bronz çerçeveli 12 galeri fotoğrafı
     (üzerine gelince bilgi şeridi, tıklayınca tam boyut + açıklama + film şeridi)
   - Kolonadın sonunda kamera sağa dönerek taş terastaki 3B kamp ateşine bakar;
     köz ışığında seçilen iletişim kartları ateşe tıklayınca aydınlanır.
   - Workbench düğmesiyle Gündüz (Ekmeksiz Plajı güneşli turkuaz) ↔ Gece
     (yıldızlı ay ışıklı deniz + sıcak meşaleler) anlık geçiş yapar.
   ========================================================= */
import * as THREE from 'three';

const stage = document.getElementById('caveStage');
const canvas = document.getElementById('caveCanvas');
const galleryEl = document.getElementById('galeri');
const contactEl = document.getElementById('contact');

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const desktopMq = window.matchMedia('(min-width: 900px)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const isEn = document.documentElement.lang === 'en';

/* ---------- Ortak kamp ateşi durumu (masaüstü 3B + mobil 2B ortak) ---------- */
let fireLit = false;
function applyFireUI(lit, announce = false) {
  fireLit = Boolean(lit);
  if (contactEl) contactEl.classList.toggle('is-fire-lit', fireLit);
  const promptBtn = document.getElementById('campfirePrompt');
  const mobileBtn = document.getElementById('campfireMobileBtn');
  [promptBtn, mobileBtn].forEach((b) => {
    if (!b) return;
    b.classList.toggle('is-lit', fireLit);
    b.setAttribute('aria-pressed', String(fireLit));
    const txt = b.querySelector('.cf-btn__txt');
    if (txt) {
      txt.textContent = fireLit
        ? (isEn ? 'Campfire lit · Dim to embers' : 'Kamp ateşi yanıyor · Köze al')
        : (isEn ? 'Light the campfire' : 'Kamp ateşini yak');
    }
  });
  if (announce && window.__showHudToast) {
    window.__showHudToast(
      fireLit
        ? (isEn ? 'Campfire lit · Base Camp illuminated' : 'Kamp ateşi yakıldı · Ana Kamp aydınlandı')
        : (isEn ? 'Campfire dimmed to glowing embers' : 'Kamp ateşi köz hâline alındı'),
      fireLit ? '[ 🔥 ]' : '[ .. ]'
    );
  }
}

const mobileFireBtn = document.getElementById('campfireMobileBtn');
if (mobileFireBtn) {
  mobileFireBtn.addEventListener('click', () => {
    if (window.__toggleCampfire) window.__toggleCampfire();
    else applyFireUI(!fireLit, true);
  });
}

function smoothstep(e0, e1, x) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/* ---------- 1) Tekrarsız Dünya-Uzayı Akdeniz Traverten Taş Malzemesi ----------
   Sütunlar, kesme taş duvar, tavan kirişleri ve teras zemini için sıcak, temiz,
   göz yormayan Akdeniz traverten/kireçtaşı dokusu (opsiyonel kesme taş derzli). */
function createTravertineMaterial({ blocks = false, tone = 1.0, roughness = 0.84 } = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xFFFFFF,
    roughness,
    metalness: 0.03,
  });

  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNorm;')
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         vec4 wpTrav = modelMatrix * vec4(transformed, 1.0);
         #ifdef USE_INSTANCING
           wpTrav = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
           vWNorm = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
         #else
           vWNorm = normalize(mat3(modelMatrix) * objectNormal);
         #endif
         vWPos = wpTrav.xyz;`
      );

    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vWPos;
         varying vec3 vWNorm;
         float tHash(vec3 p) {
           p = fract(p * vec3(0.1031, 0.1030, 0.0973));
           p += dot(p, p.yxz + 33.33);
           return fract((p.x + p.y) * p.z);
         }
         float tNoise(vec3 p) {
           vec3 i = floor(p), f = fract(p);
           vec3 u = f * f * (3.0 - 2.0 * f);
           return mix(
             mix(mix(tHash(i), tHash(i + vec3(1,0,0)), u.x),
                 mix(tHash(i + vec3(0,1,0)), tHash(i + vec3(1,1,0)), u.x), u.y),
             mix(mix(tHash(i + vec3(0,0,1)), tHash(i + vec3(1,0,1)), u.x),
                 mix(tHash(i + vec3(0,1,1)), tHash(i + vec3(1,1,1)), u.x), u.y),
             u.z
           );
         }
         float tFbm(vec3 p) {
           float s = 0.0, a = 0.52;
           for (int i = 0; i < 4; i++) {
             s += a * tNoise(p);
             p = p * 2.02 + vec3(7.3, 4.1, 9.7);
             a *= 0.48;
           }
           return s;
         }`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
         vec3 wp = vWPos;
         float vein = tFbm(vec3(wp.x * 0.45, wp.y * 1.9 + tFbm(wp * 0.3) * 0.85, wp.z * 0.45));
         float broad = tFbm(wp * 0.28 + vec3(1.7, 0.0, 3.2));
         float pore = tNoise(wp * 5.5) * 0.55 + tNoise(wp * 12.0) * 0.45;

         // Sıcak antik Akdeniz traverten tonları (Projeler'deki sütunlarla uyumlu)
         vec3 travDark  = vec3(0.50, 0.44, 0.36);
         vec3 travMid   = vec3(0.74, 0.67, 0.57);
         vec3 travLight = vec3(0.87, 0.81, 0.71);
         vec3 col = mix(travDark, travMid, smoothstep(0.18, 0.82, broad));
         col = mix(col, travLight, smoothstep(0.32, 0.78, vein) * 0.58);
         col *= (0.93 + 0.14 * pore) * ${tone.toFixed(2)};

         ${blocks ? `
         // Kesme traverten taş blok derzleri (duvar & teras zemini için mimari zarafet)
         float isHoriz = abs(vWNorm.y);
         vec2 bUv = isHoriz > 0.6 ? vec2(wp.z * 0.52, wp.x * 0.72) : vec2(wp.z * 0.44, wp.y * 0.88);
         float rowId = floor(bUv.y);
         bUv.x += mod(rowId, 2.0) * 0.5;
         vec2 f = fract(bUv);
         float edge = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
         float joint = smoothstep(0.012, 0.042, edge);
         // Her kesme taş blokta çok hafif doğal ton farkı
         float blkTone = 0.94 + 0.12 * tHash(vec3(floor(bUv), 1.0));
         col *= blkTone * (0.76 + 0.24 * joint);` : ''}

         // Deniz seviyesine yakın alt taşlarda hafif nemli koyuluk
         float wet = 1.0 - smoothstep(-2.45, -1.78, wp.y);
         col *= mix(1.0, 0.64, wet);
         diffuseColor.rgb *= col;`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         float wetR = 1.0 - smoothstep(-2.45, -1.80, vWPos.y);
         roughnessFactor = mix(${roughness.toFixed(2)} + (tNoise(vWPos * 2.2) - 0.5) * 0.08, 0.38, wetR);`
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
         float hT = tFbm(vec3(vWPos.x * 0.8, vWPos.y * 2.2, vWPos.z * 0.8)) * 0.7 + tNoise(vWPos * 6.5) * 0.3;
         vec3 sX = dFdx(vViewPosition);
         vec3 sY = dFdy(vViewPosition);
         vec3 r1 = cross(sY, normal);
         vec3 r2 = cross(normal, sX);
         float det = dot(sX, r1);
         vec3 sg = sign(det) * (dFdx(hT) * r1 + dFdy(hT) * r2);
         normal = normalize(abs(det) * normal - 0.092 * sg);`
      );
  };
  mat.customProgramCacheKey = () => `trav_${blocks}_${tone}_${roughness}`;
  return mat;
}

/* ---------- 2) Yivli Antik Akdeniz Traverten Sütunu Geometrisi ---------- */
function createFlutedShaftGeo(rTop, rBot, height, flutes = 16) {
  const segR = flutes * 4;
  const geo = new THREE.CylinderGeometry(rTop, rBot, height, segR, 14, false);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 0.01) continue;
    const ang = Math.atan2(z, x);
    const ny = (y + height * 0.5) / height;
    const entasis = 1.0 + Math.sin(ny * Math.PI) * 0.025;
    const fluteFade = smoothstep(0.03, 0.10, ny) * smoothstep(0.97, 0.90, ny);
    const fluteWave = Math.pow(Math.max(0, Math.cos(ang * flutes)), 1.5);
    const scale = entasis - fluteWave * 0.055 * fluteFade;
    pos.setX(i, x * scale);
    pos.setZ(i, z * scale);
  }
  geo.computeVertexNormals();
  // 0/2π dikiş normalini birleştir
  const n = geo.attributes.normal;
  const stride = segR + 1;
  for (let row = 0; row <= 14; row++) {
    const a = row * stride, b = row * stride + segR;
    if (b >= n.count) break;
    const nx = n.getX(a) + n.getX(b), ny = n.getY(a) + n.getY(b), nz = n.getZ(a) + n.getZ(b);
    const inv = 1 / (Math.hypot(nx, ny, nz) || 1);
    n.setXYZ(a, nx * inv, ny * inv, nz * inv);
    n.setXYZ(b, nx * inv, ny * inv, nz * inv);
  }
  n.needsUpdate = true;
  return geo;
}

function createColumnCapitalGeo() {
  const pts = [
    new THREE.Vector2(0.37, 0.00),
    new THREE.Vector2(0.41, 0.06),
    new THREE.Vector2(0.39, 0.12),
    new THREE.Vector2(0.47, 0.24),
    new THREE.Vector2(0.57, 0.36),
    new THREE.Vector2(0.60, 0.44),
  ];
  const geo = new THREE.LatheGeometry(pts, 32);
  geo.computeVertexNormals();
  return geo;
}

function createColumnFactory(stoneMat, bronzeMat) {
  // Tek seferde üretilen paylaşımlı sütun geometrileri (10 sütunda 10x daha az GPU belleği)
  const plinthGeo = new THREE.BoxGeometry(1.16, 0.26, 1.16);
  const torusGeo = new THREE.CylinderGeometry(0.46, 0.53, 0.20, 28);
  const shaftGeo = createFlutedShaftGeo(0.37, 0.44, 4.30, 16);
  const capGeo = createColumnCapitalGeo();
  const trimGeo = new THREE.BoxGeometry(1.24, 0.055, 1.24);
  const abacusGeo = new THREE.BoxGeometry(1.22, 0.22, 1.22);

  return function buildMediterraneanColumn() {
    const col = new THREE.Group();
    const plinth = new THREE.Mesh(plinthGeo, stoneMat); plinth.position.y = 0.13;
    const torus = new THREE.Mesh(torusGeo, stoneMat); torus.position.y = 0.36;
    const shaft = new THREE.Mesh(shaftGeo, stoneMat); shaft.position.y = 2.61;
    const cap = new THREE.Mesh(capGeo, stoneMat); cap.position.y = 4.76;
    const trim = new THREE.Mesh(trimGeo, bronzeMat); trim.position.y = 5.21;
    const abacus = new THREE.Mesh(abacusGeo, stoneMat); abacus.position.y = 5.34;
    col.add(plinth, torus, shaft, cap, trim, abacus);
    return col;
  };
}

/* ---------- 3) Gündüz / Gece Geçişli Akdeniz Gökyüzü Kubbesi ---------- */
function createGrottoSky(uTime, uNight) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
    uniforms: { uTime, uNight },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uNight;
      varying vec3 vDir;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
      float vnoise(vec2 p){
        vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);

        // Gündüz: berrak Ekmeksiz Plajı Akdeniz gökyüzü + hafif yüksek sirüs bulutları
        vec3 dayZen = vec3(0.13, 0.42, 0.77);
        vec3 dayMid = vec3(0.41, 0.69, 0.90);
        vec3 dayHor = vec3(0.76, 0.89, 0.96);
        vec3 dayCol = mix(dayHor, dayMid, smoothstep(0.0, 0.22, h));
        dayCol = mix(dayCol, dayZen, smoothstep(0.18, 0.72, h));
        vec3 sunDir = normalize(vec3(-0.56, 0.36, -0.74));
        float sd = max(0.0, dot(d, sunDir));
        dayCol += vec3(1.0, 0.96, 0.86) * (pow(sd, 10.0) * 0.26 + pow(sd, 96.0) * 0.58);
        if (d.y > 0.04 && uNight < 0.95) {
          vec2 cuv = d.xz / (d.y + 0.22) * 0.65 + vec2(uTime * 0.008, -uTime * 0.003);
          float cl = vnoise(cuv) * 0.65 + vnoise(cuv * 2.3 + 4.1) * 0.35;
          float cmask = smoothstep(0.54, 0.84, cl) * smoothstep(0.04, 0.20, d.y) * (1.0 - smoothstep(0.55, 0.92, d.y));
          dayCol = mix(dayCol, vec3(0.97, 0.98, 1.0), cmask * 0.34);
        }

        // Gece: ay ışıklı berrak gece gökyüzü + renk sıcaklıklı yıldızlar
        vec3 nightZen = vec3(0.022, 0.050, 0.108);
        vec3 nightMid = vec3(0.060, 0.138, 0.245);
        vec3 nightHor = vec3(0.15, 0.28, 0.42);
        vec3 nightCol = mix(nightHor, nightMid, smoothstep(0.0, 0.24, h));
        nightCol = mix(nightCol, nightZen, smoothstep(0.20, 0.72, h));

        vec3 moonDir = normalize(vec3(-0.62, 0.22, -0.75));
        float md = max(0.0, dot(d, moonDir));
        nightCol += vec3(0.56, 0.74, 0.95) * (pow(md, 12.0) * 0.46 + pow(md, 48.0) * 0.32);
        nightCol += vec3(0.97, 0.98, 1.0) * smoothstep(0.9992, 0.9997, md) * 1.45;
        nightCol += vec3(0.14, 0.24, 0.34) * exp(-abs(d.y) * 14.0) * 0.55;

        if (uNight > 0.15 && d.y > 0.03) {
          vec2 sg = floor(d.xz / (d.y + 0.35) * 95.0);
          float r = hash(sg);
          if (r > 0.991) {
            float tw = 0.62 + 0.38 * sin(uTime * (1.8 + fract(r * 73.0) * 3.0) + r * 60.0);
            float star = smoothstep(0.991, 0.9994, r) * tw * smoothstep(0.03, 0.22, d.y);
            vec3 sCol = mix(vec3(0.84, 0.92, 1.0), vec3(1.0, 0.90, 0.74), step(0.72, fract(r * 41.0)));
            nightCol += sCol * star * 1.35 * smoothstep(0.15, 0.85, uNight);
          }
        }

        float dusk = sin(clamp(uNight, 0.0, 1.0) * 3.14159);
        vec3 col = mix(dayCol, nightCol, uNight);
        col += vec3(0.45, 0.22, 0.14) * dusk * exp(-abs(d.y) * 9.0) * 0.45;
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  return new THREE.Mesh(new THREE.SphereGeometry(280, 32, 20), mat);
}

/* ---------- 4) Hareketli Kıyı Denizi (Gündüz Berrak Turkuaz ↔ Gece Ay Yakamozu) ---------- */
function createGrottoSea(uTime, uNight) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime, uNight },
    transparent: false, toneMapped: false,
    vertexShader: /* glsl */`
      uniform float uTime;
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float swell = sin(wp.x * 0.22 + wp.z * 0.14 + uTime * 1.1) * 0.09
                    + cos(wp.x * 0.38 - wp.z * 0.26 + uTime * 1.45) * 0.05;
        wp.y += swell;
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uNight;
      varying vec3 vWorld;
      float wave(vec2 p, float t) {
        float w = 0.0;
        w += sin(p.x * 0.55 + p.y * 0.32 + t * 1.35) * 0.42;
        w += sin(p.x * 1.15 - p.y * 0.85 + t * 1.90) * 0.24;
        w += cos(p.x * 2.40 + p.y * 1.95 - t * 2.65) * 0.14;
        w += sin(p.x * 4.80 - p.y * 3.60 + t * 3.20) * 0.07;
        return w;
      }
      void main() {
        vec2 p = vWorld.xz;
        float e = 0.18;
        float h0 = wave(p, uTime);
        float hx = wave(p + vec2(e, 0.0), uTime);
        float hz = wave(p + vec2(0.0, e), uTime);
        vec3 N = normalize(vec3((h0 - hx) * 1.25, 1.0, (h0 - hz) * 1.25));

        vec3 V = normalize(cameraPosition - vWorld);
        float dist = length(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);

        float shallow = smoothstep(-28.0, -3.6, vWorld.x);
        vec3 dayDeep = vec3(0.05, 0.34, 0.58);
        vec3 dayShallow = vec3(0.24, 0.70, 0.76);
        vec3 daySky = vec3(0.58, 0.81, 0.94);

        vec3 nightDeep = vec3(0.03, 0.10, 0.19);
        vec3 nightShallow = vec3(0.11, 0.34, 0.42);
        vec3 nightSky = vec3(0.16, 0.31, 0.46);

        vec3 deepCol = mix(dayDeep, nightDeep, uNight);
        vec3 shallowCol = mix(dayShallow, nightShallow, uNight);
        vec3 skyRefl = mix(daySky, nightSky, uNight);

        vec3 col = mix(deepCol, shallowCol, shallow * mix(0.90, 0.76, uNight));
        // Dalga tepelerinde ince Akdeniz turkuaz alt-yüzey parıltısı
        float crestGlow = smoothstep(0.12, 0.68, h0) * (1.0 - uNight * 0.75) * shallow;
        col += vec3(0.08, 0.42, 0.44) * crestGlow * 0.32;
        col = mix(col, skyRefl, fres * mix(0.55, 0.72, uNight));

        vec3 L = normalize(mix(vec3(-0.56, 0.38, -0.74), vec3(-0.62, 0.26, -0.75), uNight));
        vec3 H = normalize(L + V);
        float ndh = max(dot(N, H), 0.0);
        float specBroad = pow(ndh, 38.0);
        float specSharp = pow(ndh, 240.0);
        float specGlint = pow(ndh, 640.0);
        vec3 specCol = mix(vec3(1.0, 0.97, 0.88), vec3(0.78, 0.90, 1.0), uNight);
        col += specCol * (specBroad * 0.40 + specSharp * 1.45 + specGlint * 1.25);

        float shoreLine = smoothstep(-9.0, -3.5, vWorld.x) * (1.0 - smoothstep(-3.2, -1.6, vWorld.x));
        float foamWave = smoothstep(0.15, 0.65, sin(vWorld.z * 0.45 + uTime * 1.8 + h0 * 2.5) * 0.5 + 0.5);
        vec3 foamCol = mix(vec3(0.96, 0.98, 1.0), vec3(0.72, 0.84, 0.92), uNight);
        col = mix(col, foamCol, shoreLine * foamWave * mix(0.56, 0.42, uNight));

        vec3 fogCol = mix(vec3(0.72, 0.86, 0.95), vec3(0.15, 0.29, 0.43), uNight);
        float fogF = 1.0 - exp(-pow(dist * 0.0068, 1.55));
        col = mix(col, fogCol, clamp(fogF, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  const g = new THREE.PlaneGeometry(420, 420, 72, 72);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.set(-80, -2.55, -90);
  return m;
}

/* ---------- 5) Karşı Kıyıdaki Uzak Burun Silueti ---------- */
function createDistantHeadland() {
  const shape = new THREE.Shape();
  shape.moveTo(-75, -4);
  shape.lineTo(-75, 2.2);
  shape.quadraticCurveTo(-52, 6.5, -28, 3.2);
  shape.quadraticCurveTo(-8, 1.0, 10, 4.4);
  shape.quadraticCurveTo(34, 8.2, 65, 2.6);
  shape.lineTo(82, -4);
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape, 24);
  const mat = new THREE.MeshBasicMaterial({ color: 0x6F8799, fog: true });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(-95, -2.5, -135);
  m.rotation.y = 0.42;
  return m;
}

/* ---------- 6) Gerçekçi 3B Kamp Ateşi (Taş ocağı, 3B kor kömürler, yarık odunlar, hacimsel alev, duman, kıvılcım) ---------- */
function createCampfire(pos) {
  const group = new THREE.Group();
  group.position.copy(pos);

  // Kül & koyu ocak tabanı
  const hearth = new THREE.Mesh(
    new THREE.CylinderGeometry(1.42, 1.66, 0.20, 22),
    new THREE.MeshStandardMaterial({ color: 0x3A342E, roughness: 0.96, metalness: 0.03 })
  );
  hearth.position.y = 0.04;
  group.add(hearth);

  // Doğal nehir/kıyı taş halkası
  const stoneGeo = new THREE.DodecahedronGeometry(0.26, 2);
  const stPos = stoneGeo.attributes.position;
  for (let i = 0; i < stPos.count; i++) {
    const vx = stPos.getX(i), vy = stPos.getY(i), vz = stPos.getZ(i);
    const n = 0.88 + 0.16 * Math.sin(vx * 5 + vy * 7 + vz * 4);
    stPos.setXYZ(i, vx * n, vy * n * 0.72, vz * n);
  }
  stoneGeo.computeVertexNormals();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x847868, roughness: 0.88, metalness: 0.04 });
  const ringCount = 14;
  const ring = new THREE.InstancedMesh(stoneGeo, stoneMat, ringCount);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), eul = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i < ringCount; i++) {
    const a = (i / ringCount) * Math.PI * 2 + (i % 2) * 0.06;
    const rad = 1.08 + Math.sin(i * 3.1) * 0.06;
    p.set(Math.cos(a) * rad, 0.15, Math.sin(a) * rad);
    eul.set(Math.sin(i * 2) * 0.22, a + i, Math.cos(i) * 0.18);
    q.setFromEuler(eul);
    sc.set(0.95 + (i % 3) * 0.14, 0.80 + (i % 2) * 0.18, 0.95 + ((i + 1) % 3) * 0.12);
    m4.compose(p, q, sc);
    ring.setMatrixAt(i, m4);
  }
  group.add(ring);

  // Kül & nefes alan köz yatağı
  const emberUniforms = { uTime: { value: 0 }, uFire: { value: 0 } };
  const emberMat = new THREE.ShaderMaterial({
    uniforms: emberUniforms,
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uFire;
      varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1,0)), u.x), mix(h(i + vec2(0,1)), h(i + vec2(1,1)), u.x), u.y);
      }
      void main() {
        vec2 d = (vUv - 0.5) * 2.0;
        float r = length(d);
        if (r > 1.0) discard;
        float n1 = noise(vUv * 10.0 + vec2(uTime * 0.12, -uTime * 0.08));
        float n2 = noise(vUv * 26.0 - vec2(uTime * 0.22, uTime * 0.16));
        float pulse = 0.68 + 0.32 * sin(uTime * 2.0 + n1 * 6.0);
        float heat = smoothstep(0.26, 0.82, n1 * 0.62 + n2 * 0.48) * (1.0 - r * r * 0.92);
        float power = mix(0.85 * pulse, 2.0, uFire);
        vec3 ash = mix(vec3(0.06, 0.055, 0.055), vec3(0.22, 0.20, 0.19), smoothstep(0.55, 0.92, r));
        vec3 coal = mix(vec3(0.92, 0.16, 0.02), vec3(1.0, 0.72, 0.22), clamp(heat * power, 0.0, 1.0));
        vec3 col = mix(ash, coal, clamp(heat * power * 1.15, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  const emberBed = new THREE.Mesh(new THREE.CircleGeometry(1.0, 28), emberMat);
  emberBed.rotation.x = -Math.PI / 2;
  emberBed.position.y = 0.15;
  group.add(emberBed);

  // Taş halkanın etrafındaki traverten zeminde ateşle nefes alan sıcak yansıma halesi
  const groundGlowUniforms = { uFire: emberUniforms.uFire, uTime: emberUniforms.uTime };
  const groundGlowMat = new THREE.ShaderMaterial({
    uniforms: groundGlowUniforms,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uFire, uTime;
      varying vec2 vUv;
      void main() {
        float r = length((vUv - 0.5) * 2.0);
        if (r > 1.0) discard;
        float flick = 0.92 + 0.08 * sin(uTime * 8.4) + 0.05 * cos(uTime * 14.2);
        float falloff = pow(1.0 - r, 2.6) * smoothstep(0.18, 0.42, r);
        float a = falloff * mix(0.10, 0.42, uFire) * flick;
        vec3 col = mix(vec3(0.92, 0.24, 0.03), vec3(1.0, 0.58, 0.18), uFire * (1.0 - r));
        gl_FragColor = vec4(col, a);
      }`
  });
  const groundGlow = new THREE.Mesh(new THREE.CircleGeometry(4.2, 28), groundGlowMat);
  groundGlow.rotation.x = -Math.PI / 2;
  groundGlow.position.y = 0.015;
  group.add(groundGlow);

  // 28 adet 3B kömür / kor parçası (ocak içinde gerçek hacim)
  const coalGeo = new THREE.DodecahedronGeometry(0.11, 0);
  const coalMat = new THREE.MeshStandardMaterial({
    color: 0x1A1513, roughness: 0.95, metalness: 0.04,
    emissive: new THREE.Color(0xFF3E0A), emissiveIntensity: 0.55
  });
  const coalCount = 28;
  const coals = new THREE.InstancedMesh(coalGeo, coalMat, coalCount);
  for (let i = 0; i < coalCount; i++) {
    const a = i * 2.39996;
    const rad = Math.sqrt((i + 0.5) / coalCount) * 0.78;
    p.set(Math.cos(a) * rad, 0.17 + (1 - rad) * 0.11, Math.sin(a) * rad);
    eul.set(i * 1.1, i * 2.3, i * 0.7);
    q.setFromEuler(eul);
    sc.set(0.8 + (i % 3) * 0.45, 0.55 + (i % 2) * 0.3, 0.75 + ((i + 1) % 3) * 0.4);
    m4.compose(p, q, sc);
    coals.setMatrixAt(i, m4);
  }
  group.add(coals);

  // 9 adet doğal yarık, kabuklu, merkez ucu korlaşan odun
  const logGeo = new THREE.CylinderGeometry(0.055, 0.105, 1.48, 9, 6);
  const lp = logGeo.attributes.position;
  for (let i = 0; i < lp.count; i++) {
    const vx = lp.getX(i), vy = lp.getY(i), vz = lp.getZ(i);
    const bark = 0.86 + 0.22 * Math.sin(Math.atan2(vz, vx) * 5 + vy * 4.5);
    lp.setXYZ(i, vx * bark, vy, vz * bark);
  }
  logGeo.computeVertexNormals();
  const logMat = new THREE.MeshStandardMaterial({
    color: 0x2E2118, roughness: 0.94, metalness: 0.03,
    emissive: new THREE.Color(0xC83C08), emissiveIntensity: 0.22
  });
  // Sadece odunun ateş merkezine bakan iç kısmını korlaştır
  logMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vLogEnd;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLogEnd = smoothstep(-0.35, 0.65, position.y);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vLogEnd;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vLogEnd;');
  };
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + (i % 2) * 0.14;
    const tilt = 0.64 + (i % 3) * 0.08;
    const log = new THREE.Mesh(logGeo, logMat);
    log.position.set(Math.cos(a) * (0.34 + (i % 2) * 0.08), 0.36 + (i % 3) * 0.04, Math.sin(a) * (0.34 + (i % 2) * 0.08));
    log.rotation.set(Math.sin(a) * tilt, a, -Math.cos(a) * tilt);
    log.scale.setScalar(0.86 + (i % 3) * 0.12);
    group.add(log);
  }

  // Kameraya dönük (Y-billboard) kesişimsiz hacimsel domain-warped alev shader'ı!
  // Kesişen düzlem çizgisi olmadan gerçek alev dili, mavi-beyaz sıcak çekirdek ve kopan kıvılcım dilleri üretir.
  const flameUniforms = { uTime: { value: 0 }, uFire: { value: 0 } };
  const makeFlameMat = (seed, opacityMul) => new THREE.ShaderMaterial({
    uniforms: {
      uTime: flameUniforms.uTime,
      uFire: flameUniforms.uFire,
      uSeed: { value: seed },
      uOp: { value: opacityMul }
    },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: /* glsl */`
      uniform float uTime, uFire, uSeed;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        float bend = sin(uTime * 4.4 + uSeed + uv.y * 3.2) * 0.16 * uv.y * uv.y * uFire;
        p.x += bend;
        p.y *= (0.08 + 0.92 * uFire);
        p.x *= (0.42 + 0.58 * uFire);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uFire, uSeed, uOp;
      varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1,0)), u.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
      }
      float fbm(vec2 p){
        float v = 0.0, a = 0.52;
        for (int i = 0; i < 5; i++) { v += noise(p) * a; p = p * 2.04 + vec2(3.7, 1.9); a *= 0.48; }
        return v;
      }
      void main() {
        if (uFire < 0.01) discard;
        vec2 uv = vUv;
        float t = uTime * 2.45 + uSeed;
        // Domain-warped yükselen türbülans (gerçek alev kıvrımları)
        vec2 q = vec2(fbm(vec2(uv.x * 3.2 + uSeed, uv.y * 2.2 - t * 0.9)),
                      fbm(vec2(uv.x * 3.2 + 5.2, uv.y * 2.5 - t * 1.15)));
        float n = fbm(vec2(uv.x * 4.0, uv.y * 3.4 - t * 1.45) + (q - 0.5) * 1.35);

        float cx = (uv.x - 0.5) * 2.0;
        // Tabanda dolgun, yukarıda keskin kıvrılarak sivrilen alev gövdesi
        float sway = (q.x - 0.5) * (0.35 + uv.y * 0.72);
        float width = mix(0.76, 0.05, pow(uv.y, 0.92));
        float dist = abs(cx + sway);
        float env = smoothstep(width, width * 0.14, dist) * smoothstep(0.0, 0.12, uv.y) * (1.0 - smoothstep(0.76, 1.0, uv.y));

        float flame = env * smoothstep(0.18, 0.76, n + (1.0 - uv.y) * 0.52);
        // Yukarıda kopan küçük alev dilleri
        float wisp = smoothstep(0.62, 0.88, n) * smoothstep(0.45, 0.85, uv.y) * (1.0 - smoothstep(0.82, 0.99, uv.y)) * smoothstep(0.55, 0.0, abs(cx + sway * 1.2));
        float f = clamp(flame + wisp * 0.55, 0.0, 1.0);
        if (f < 0.02) discard;

        // Gerçekçi siyah-cisim ateş sıcaklığı skalası: kızıl uç → parlak turuncu → tereyağı altını → beyaz sıcak çekirdek
        vec3 col = mix(vec3(0.85, 0.14, 0.01), vec3(1.0, 0.46, 0.05), smoothstep(0.06, 0.42, f));
        col = mix(col, vec3(1.0, 0.82, 0.34), smoothstep(0.38, 0.74, f * (1.1 - uv.y * 0.45)));
        col = mix(col, vec3(1.0, 0.98, 0.88), smoothstep(0.68, 0.96, f * (1.2 - uv.y * 0.85)));
        // Tabanda çok hafif mavi yanma ısısı
        float baseBlue = smoothstep(0.22, 0.04, uv.y) * smoothstep(0.4, 0.85, f);
        col = mix(col, vec3(0.55, 0.72, 1.0), baseBlue * 0.18);

        gl_FragColor = vec4(col, f * uFire * uOp);
      }`
  });

  const flameBillboard = new THREE.Group();
  flameBillboard.position.y = 0.22;
  const mainFlameGeo = new THREE.PlaneGeometry(1.75, 2.35, 6, 14);
  mainFlameGeo.translate(0, 1.15, 0);
  const sideFlameGeo = new THREE.PlaneGeometry(1.15, 1.65, 4, 10);
  sideFlameGeo.translate(0, 0.80, 0);

  const flCenter = new THREE.Mesh(mainFlameGeo, makeFlameMat(0.0, 0.94));
  const flLeft = new THREE.Mesh(sideFlameGeo, makeFlameMat(2.7, 0.62));
  flLeft.position.set(-0.28, -0.02, -0.06);
  const flRight = new THREE.Mesh(sideFlameGeo, makeFlameMat(5.4, 0.62));
  flRight.position.set(0.26, -0.02, 0.06);
  [flCenter, flLeft, flRight].forEach((m) => { m.renderOrder = 4; flameBillboard.add(m); });

  // Alev üstünde çok hafif yükselen sıcak duman sütunu
  const smokeUniforms = { uTime: flameUniforms.uTime, uFire: flameUniforms.uFire };
  const smokeMat = new THREE.ShaderMaterial({
    uniforms: smokeUniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uFire;
      varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1,0)), u.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
      }
      void main() {
        vec2 uv = vUv;
        float n = noise(vec2(uv.x * 2.6, uv.y * 2.4 - uTime * 0.55)) * 0.65
                + noise(vec2(uv.x * 5.2 + 2.0, uv.y * 4.5 - uTime * 0.9)) * 0.35;
        float radial = 1.0 - smoothstep(0.05, 0.5, abs(uv.x - 0.5));
        float vert = smoothstep(0.0, 0.25, uv.y) * (1.0 - smoothstep(0.55, 1.0, uv.y));
        float a = radial * vert * smoothstep(0.32, 0.85, n) * mix(0.09, 0.14, uFire);
        vec3 col = mix(vec3(0.32, 0.30, 0.32), vec3(0.52, 0.38, 0.28), uFire * (1.0 - uv.y));
        gl_FragColor = vec4(col, a);
      }`
  });
  const smokeGeo = new THREE.PlaneGeometry(2.1, 3.2);
  smokeGeo.translate(0, 2.35, 0);
  const smokeMesh = new THREE.Mesh(smokeGeo, smokeMat);
  smokeMesh.renderOrder = 3;
  flameBillboard.add(smokeMesh);
  group.add(flameBillboard);

  // 160 adet yükselen kor & kıvılcım parçacığı
  const SPARK_N = 160;
  const spPos = new Float32Array(SPARK_N * 3);
  const spSeed = new Float32Array(SPARK_N * 3);
  for (let i = 0; i < SPARK_N; i++) {
    const a = Math.random() * Math.PI * 2;
    const rad = Math.random() * 0.56;
    spPos.set([Math.cos(a) * rad, Math.random() * 4.2, Math.sin(a) * rad], i * 3);
    spSeed.set([Math.random() * 6.283, 0.50 + Math.random() * 1.15, Math.random()], i * 3);
  }
  const spGeo = new THREE.BufferGeometry();
  spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
  spGeo.setAttribute('aSeed', new THREE.BufferAttribute(spSeed, 3));
  const sparkUniforms = { uTime: { value: 0 }, uFire: { value: 0 }, uPx: { value: 600 } };
  const spMat = new THREE.ShaderMaterial({
    uniforms: sparkUniforms,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: /* glsl */`
      attribute vec3 aSeed;
      uniform float uTime, uFire, uPx;
      varying float vA, vHeat;
      void main() {
        float active = step(aSeed.z, mix(0.14, 1.0, uFire));
        float speed = mix(0.30, 1.28, uFire) * aSeed.y;
        float life = fract(position.y / 4.2 + uTime * speed * 0.25);
        vec3 p = position;
        float maxH = mix(1.4, 4.6, uFire);
        p.y = 0.26 + life * maxH;
        float swirl = uTime * (1.2 + aSeed.y) + aSeed.x;
        p.x += sin(swirl) * (0.14 + life * 0.62);
        p.z += cos(swirl * 0.85) * (0.14 + life * 0.62);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float fade = smoothstep(0.0, 0.10, life) * (1.0 - smoothstep(0.62, 1.0, life));
        float flick = 0.55 + 0.45 * sin(uTime * 15.0 + aSeed.x * 5.0);
        vA = active * fade * flick * mix(0.55, 1.0, uFire);
        vHeat = 1.0 - life;
        gl_PointSize = clamp((0.10 + aSeed.z * 0.13) * uPx / max(2.0, -mv.z), 1.4, 6.5) * step(0.01, vA);
      }`,
    fragmentShader: /* glsl */`
      varying float vA, vHeat;
      void main() {
        if (vA < 0.01) discard;
        vec2 c = gl_PointCoord - 0.5;
        float d = dot(c, c) * 4.0;
        if (d > 1.0) discard;
        vec3 col = mix(vec3(1.0, 0.30, 0.04), vec3(1.0, 0.90, 0.52), vHeat);
        gl_FragColor = vec4(col, (1.0 - d) * vA);
      }`
  });
  const sparks = new THREE.Points(spGeo, spMat);
  sparks.frustumCulled = false; sparks.renderOrder = 5;
  group.add(sparks);

  const emberLight = new THREE.PointLight(0xFF5A1E, 10, 18, 1.4);
  emberLight.position.set(0, 0.62, 0);
  group.add(emberLight);

  const fireLight = new THREE.PointLight(0xFF8C3A, 0, 44, 1.25);
  fireLight.position.set(0, 1.65, 0);
  group.add(fireLight);

  const fireCoreLight = new THREE.PointLight(0xFFD284, 0, 16, 1.4);
  fireCoreLight.position.set(0, 0.85, 0);
  group.add(fireCoreLight);

  const hitSphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.9, 12, 10),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitSphere.position.set(0, 0.95, 0);
  hitSphere.userData.isCampfire = true;
  group.add(hitSphere);

  let fireLevel = 0;
  let igniteFlash = 0;
  function update(time, dt, lit, px, camera) {
    const target = lit ? 1 : 0;
    fireLevel += (target - fireLevel) * (1 - Math.exp(-dt * (lit ? 3.2 : 2.6)));
    igniteFlash *= Math.exp(-dt * 3.8);
    const f = Math.min(1.2, fireLevel + igniteFlash * 0.45);

    // Alev grubu yalnızca Y ekseninde kameraya döner → kesişim çizgisi olmadan tam hacim
    if (camera) {
      const dx = camera.position.x - pos.x;
      const dz = camera.position.z - pos.z;
      flameBillboard.rotation.y = Math.atan2(dx, dz);
    }

    emberUniforms.uTime.value = time;
    emberUniforms.uFire.value = Math.min(1, f);
    flameUniforms.uTime.value = time;
    flameUniforms.uFire.value = Math.min(1.15, f);
    sparkUniforms.uTime.value = time;
    sparkUniforms.uFire.value = Math.min(1, f);
    sparkUniforms.uPx.value = px;

    const flick = 1.0 + Math.sin(time * 9.3) * 0.09 + Math.sin(time * 17.1) * 0.06 + Math.cos(time * 5.7) * 0.05;
    const emberPulse = 0.82 + 0.18 * Math.sin(time * 2.1);
    emberLight.intensity = (10.5 * emberPulse) * (1 - fireLevel * 0.5);
    fireLight.intensity = f * 74.0 * flick;
    fireLight.position.x = Math.sin(time * 7.2) * 0.08 * f;
    fireLight.position.z = Math.cos(time * 6.4) * 0.08 * f;
    fireCoreLight.intensity = f * 20.0 * flick;
    logMat.emissiveIntensity = 0.22 * emberPulse + f * 1.15;
    coalMat.emissiveIntensity = 0.48 * emberPulse + f * 1.35;
  }

  return { group, hitSphere, triggerFlash: () => { igniteFlash = 1; }, getLevel: () => fireLevel, update };
}

/* ---------- Ana 3B Antik Akdeniz Sütunlu Kıyı Galerisi Kurulumu ---------- */
function initCave3D() {
  if (reduce || !desktopMq.matches || !stage || !canvas || !galleryEl || !contactEl || !window.gsap) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (e) {
    document.body.classList.remove('has-cave-3d');
    galleryEl.classList.remove('is-cave-3d');
    contactEl.classList.remove('is-cave-contact');
    return;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.18;

  const scene = new THREE.Scene();
  const FOG_DAY = new THREE.Color('#9EC8E4');
  const FOG_NIGHT = new THREE.Color('#13263A');
  const HEAD_DAY = new THREE.Color('#6F8799');
  const HEAD_NIGHT = new THREE.Color('#0D1B2B');
  const HEMI_SKY_DAY = new THREE.Color(0x9FD0F2);
  const HEMI_SKY_NIGHT = new THREE.Color(0x4E7CB2);
  const HEMI_GND_DAY = new THREE.Color(0x8C7458);
  const HEMI_GND_NIGHT = new THREE.Color(0x2A1E14);
  const DIR_DAY = new THREE.Color(0xFFF3DB);
  const DIR_NIGHT = new THREE.Color(0x94BEEA);

  scene.fog = new THREE.FogExp2(FOG_DAY.clone(), 0.0082);

  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.2, 420);
  const uTime = { value: 0 };
  const uNight = { value: window.__workbenchNight ? 1 : 0 };
  let forceNight = Boolean(window.__workbenchNight);
  let smoothNight = forceNight ? 1 : 0;
  window.__setCaveNight = (on) => { forceNight = Boolean(on); };

  // Gökyüzü, hareketli kıyı denizi ve karşı burun
  scene.add(createGrottoSky(uTime, uNight));
  scene.add(createGrottoSea(uTime, uNight));
  const headland = createDistantHeadland();
  scene.add(headland);

  // Işıklar: Gündüz güneşli Akdeniz ↔ Gece ay ışığı
  const hemi = new THREE.HemisphereLight(HEMI_SKY_DAY.clone(), HEMI_GND_DAY.clone(), 1.35);
  scene.add(hemi);
  const sunDir = new THREE.DirectionalLight(DIR_DAY.clone(), 2.3);
  sunDir.position.set(-45, 26, -55);
  scene.add(sunDir);
  const walkLight = new THREE.PointLight(0xF5C382, 16, 24, 1.35);
  scene.add(walkLight);

  // ---------- Antik Akdeniz Traverten Mimarisi ----------
  const FLOOR_Y = -2.25;
  const WALL_X = 4.65;        // Sağ traverten galeri duvarı
  const COL_X = -3.15;        // Sol deniz kenarı yivli sütun sırası
  const ROOF_Y = FLOOR_Y + 5.45; // +3.20 (sütun başlıklarının tam üstü)

  const travColumnMat = createTravertineMaterial({ blocks: false, tone: 1.04, roughness: 0.80 });
  const travWallMat   = createTravertineMaterial({ blocks: true,  tone: 0.94, roughness: 0.86 });
  const travFloorMat  = createTravertineMaterial({ blocks: true,  tone: 0.88, roughness: 0.84 });
  const travRoofMat   = createTravertineMaterial({ blocks: false, tone: 0.90, roughness: 0.88 });
  const bronzeMat     = new THREE.MeshStandardMaterial({
    color: 0xC6A278, roughness: 0.48, metalness: 0.72,
    emissive: new THREE.Color(0x8A6845), emissiveIntensity: 0.08
  });

  // 1) Kesme traverten teras zemini (galeri koridoru + sağdaki geniş kamp ateşi terası)
  const mainFloor = new THREE.Mesh(new THREE.BoxGeometry(10.0, 0.7, 74), travFloorMat);
  mainFloor.position.set(1.2, FLOOR_Y - 0.35, -26);
  scene.add(mainFloor);

  // Kamp ateşi köşesi için sağa uzanan geniş taş teras uzantısı
  const campFloor = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.7, 22), travFloorMat);
  campFloor.position.set(6.8, FLOOR_Y - 0.35, -54.5);
  scene.add(campFloor);

  // Deniz kenarı alçak traverten bordür taşı (sütun kaidelerini birleştirir)
  const seaCurb = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.24, 74), travColumnMat);
  seaCurb.position.set(COL_X, FLOOR_Y + 0.12, -26);
  scene.add(seaCurb);

  // 2) Sağ tarafta kesme traverten galeri duvarı (12 fotoğrafın arkasında temiz kesintisiz duvar)
  const galleryWall = new THREE.Mesh(new THREE.BoxGeometry(1.1, 6.2, 58.5), travWallMat);
  galleryWall.position.set(WALL_X + 0.55, FLOOR_Y + 3.05, -19.25);
  scene.add(galleryWall);

  // Galeri duvarından kamp odasına geçiş L-köşe dönüş duvarı (açık kenar kalmaz)
  const cornerReturnWall = new THREE.Mesh(new THREE.BoxGeometry(5.85, 6.2, 1.1), travWallMat);
  cornerReturnWall.position.set(7.02, FLOOR_Y + 3.05, -47.95);
  scene.add(cornerReturnWall);

  // Kamp ateşi odasının sağ ve arka traverten duvarları (L-biçimli rüzgârlık sığınağı)
  const campRightWall = new THREE.Mesh(new THREE.BoxGeometry(1.1, 6.2, 16.5), travWallMat);
  campRightWall.position.set(9.4, FLOOR_Y + 3.05, -55.7);
  scene.add(campRightWall);

  const campBackWall = new THREE.Mesh(new THREE.BoxGeometry(13.6, 6.2, 1.1), travWallMat);
  campBackWall.position.set(3.1, FLOOR_Y + 3.05, -63.4);
  scene.add(campBackWall);

  // Duvar üstü antik taş korniş şeridi (mimari bitiş)
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.34, 58.5), travColumnMat);
  cornice.position.set(WALL_X - 0.12, ROOF_Y - 0.12, -19.25);
  scene.add(cornice);

  // 3) Sol deniz kenarı boyunca sıralı 10 yivli Antik Akdeniz Traverten Sütunu (paylaşımlı geometri!)
  const makeColumn = createColumnFactory(travColumnMat, bronzeMat);
  const colPositionsZ = [4, -3.5, -11, -18.5, -26, -33.5, -41, -48.5, -56, -62.2];
  colPositionsZ.forEach((cz) => {
    const c = makeColumn();
    c.position.set(COL_X, FLOOR_Y + 0.24, cz);
    scene.add(c);
  });

  // 4) Sütun başlıklarının üstünde uzanan antik traverten arşitrav (saçak) + yatay taş tavan kirişleri
  const architrave = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.72, 72), travColumnMat);
  architrave.position.set(COL_X, ROOF_Y + 0.56, -28);
  scene.add(architrave);

  // Üst kapatıcı taş tavan (güneş/ay ışığı sütunların arasından yan açıdan süzülür, tavan temiz ve mimari)
  const roofSlab = new THREE.Mesh(new THREE.BoxGeometry(14.0, 0.45, 74), travRoofMat);
  roofSlab.position.set(3.2, ROOF_Y + 0.96, -28);
  scene.add(roofSlab);

  // Her sütun hizasında sağ duvara uzanan kesme traverten tavan kirişleri
  const beamGeo = new THREE.BoxGeometry(9.2, 0.46, 0.56);
  for (let z = 4; z >= -60; z -= 3.75) {
    const beam = new THREE.Mesh(beamGeo, travColumnMat);
    beam.position.set(1.2, ROOF_Y + 0.52, z);
    scene.add(beam);
  }

  // 5) Deniz kenarında bordürün dışında suya inen birkaç doğal aşınmış Akdeniz kıyı kayası
  {
    const bGeo = new THREE.DodecahedronGeometry(0.85, 2);
    const bp = bGeo.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const vx = bp.getX(i), vy = bp.getY(i), vz = bp.getZ(i);
      const n = 0.88 + 0.14 * Math.sin(vx * 2.3 + vy * 2.9 + vz * 2.1);
      bp.setXYZ(i, vx * n * 1.25, vy * n * 0.52, vz * n);
    }
    bGeo.computeVertexNormals();
    const rockCount = 26;
    const shoreRocks = new THREE.InstancedMesh(bGeo, travFloorMat, rockCount);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    for (let i = 0; i < rockCount; i++) {
      const z = 5 - (i / rockCount) * 65;
      const x = -4.6 - (i % 3) * 1.45 + Math.sin(i * 2.7) * 0.55;
      p.set(x, FLOOR_Y - 0.35 - (i % 2) * 0.14, z);
      e.set(0.08, i * 1.5, 0.06);
      q.setFromEuler(e);
      sc.set(0.9 + (i % 3) * 0.42, 0.55 + (i % 2) * 0.22, 0.95 + ((i + 1) % 3) * 0.38);
      m4.compose(p, q, sc);
      shoreRocks.setMatrixAt(i, m4);
    }
    scene.add(shoreRocks);
  }

  // 6) Sağ traverten duvarda 3 antik bronz duvar meşalesi (çerçevelerin tam ara boşluklarında → sıfır çakışma!)
  const torchLights = [];
  const torchMat = new THREE.MeshBasicMaterial({ color: 0xFFB85C });
  const torchHolderMat = new THREE.MeshStandardMaterial({ color: 0x26201A, roughness: 0.55, metalness: 0.72 });
  [-4.12, -19.52, -34.92].forEach((tz, idx) => {
    const tx = WALL_X - 0.24;
    const ty = 2.08;
    const holder = new THREE.Group();
    holder.position.set(tx, ty, tz);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.06, 0.06), torchHolderMat);
    arm.position.x = 0.12;
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.055, 0.26, 8), torchHolderMat);
    cup.position.y = 0.08;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.10, 8, 8), torchMat);
    bulb.position.y = 0.25;
    holder.add(arm, cup, bulb);
    scene.add(holder);

    const tl = new THREE.PointLight(0xFF9C46, 18, 22, 1.4);
    tl.position.set(tx - 0.35, ty + 0.28, tz);
    scene.add(tl);
    torchLights.push({ light: tl, base: 18, phase: idx * 2.3 });
  });

  // ---------- 12 Galeri Fotoğrafı (Sağ traverten duvarından net öne çıkıntılı, bronz ayaklı, sıfır çakışma) ----------
  const domItems = [...galleryEl.querySelectorAll('.mozaik .mz-item')];
  const texLoader = new THREE.TextureLoader();
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x231E18, roughness: 0.44, metalness: 0.68 });
  const trimMatBase = new THREE.MeshStandardMaterial({
    color: 0xC49662, roughness: 0.40, metalness: 0.76,
    emissive: new THREE.Color(0xC49662), emissiveIntensity: 0.16
  });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xFFE5B8 });

  const photoFrames = [];
  const rayTargets = [];

  domItems.forEach((it, i) => {
    const imgEl = it.querySelector('img');
    const title = it.querySelector('figcaption b')?.textContent.trim() || `Fotoğraf ${i + 1}`;
    const desc = it.querySelector('figcaption span')?.textContent.trim() || '';
    const meta = it.dataset.meta || '';
    const src = imgEl ? (imgEl.getAttribute('src') || '') : '';
    const nw = Number(imgEl?.getAttribute('width')) || 4;
    const nh = Number(imgEl?.getAttribute('height')) || 3;
    const aspect = nw / nh;

    let fw, fh;
    if (aspect >= 1) {
      fw = 2.55; fh = fw / aspect;
    } else {
      fh = 2.50; fw = Math.max(1.62, fh * aspect);
    }

    const zPos = -2.2 - i * 3.85;
    // Duvar yüzeyi WALL_X = 4.65; çerçeve arkası x = 4.55'te (duvardan 10 cm önde) durur, asla duvara girmez!
    const xPos = WALL_X - 0.18;
    const yPos = 0.40;

    const holder = new THREE.Group();
    holder.position.set(xPos, yPos, zPos);
    holder.rotation.y = -Math.PI * 0.5;

    // Duvara bağlayan 2 ince bronz montaj ayağı (çerçevenin arkasında duvara net tutunur)
    const standoffGeo = new THREE.BoxGeometry(0.10, 0.10, 0.14);
    for (const sx of [-fw * 0.34, fw * 0.34]) {
      const st = new THREE.Mesh(standoffGeo, frameMat);
      st.position.set(sx, 0, -0.11);
      holder.add(st);
    }

    // Arka çerçeve kutusu
    const backBox = new THREE.Mesh(new THREE.BoxGeometry(fw + 0.24, fh + 0.24, 0.12), frameMat);
    backBox.position.z = 0.0;
    holder.add(backBox);

    // Bronz iç çerçeve (hover'da parlar)
    const trimMat = trimMatBase.clone();
    const trimBox = new THREE.Mesh(new THREE.BoxGeometry(fw + 0.09, fh + 0.09, 0.05), trimMat);
    trimBox.position.z = 0.06;
    holder.add(trimBox);

    // Fotoğraf yüzeyi: sis, AgX beyazlaşması ve parlama olmadan gerçek canlı renkler
    const tex = texLoader.load(src);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    const photoMat = new THREE.MeshBasicMaterial({
      map: tex,
      color: new THREE.Color(0xF5F5F5),
      toneMapped: false,
      fog: false
    });
    const photoMesh = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), photoMat);
    photoMesh.position.z = 0.092;
    photoMesh.userData.photoIndex = i;
    backBox.userData.photoIndex = i;
    holder.add(photoMesh);

    // Üstte zarif bronz galeri lambası
    const lampArm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.32), frameMat);
    lampArm.position.set(0, fh * 0.5 + 0.16, 0.10);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(fw * 0.48, 0.045, 0.12), lampMat);
    lamp.position.set(0, fh * 0.5 + 0.16, 0.25);
    holder.add(lampArm, lamp);

    scene.add(holder);
    rayTargets.push(photoMesh, backBox);
    photoFrames.push({
      index: i, holder, photoMat, trimMat,
      baseX: xPos, zPos, title, desc, meta, hover: 0
    });
  });

  // ---------- 3B Kamp Ateşi (Kolonad sonundaki geniş traverten terasta) ----------
  const CAMPFIRE_POS = new THREE.Vector3(3.85, FLOOR_Y, -55.8);
  const campfire = createCampfire(CAMPFIRE_POS);
  scene.add(campfire.group);
  rayTargets.push(campfire.hitSphere);

  // ---------- Kaydırma İlerlemesi & Sahne Görünürlüğü ----------
  let galProg = 0;
  let contactProg = 0;
  let stageOpacity = 0;
  let running = false;

  if (window.ScrollTrigger) {
    window.gsap.registerPlugin(window.ScrollTrigger);
    window.ScrollTrigger.create({
      trigger: galleryEl,
      start: 'top top',
      end: 'bottom bottom',
      invalidateOnRefresh: true,
      onUpdate: (self) => { galProg = self.progress; }
    });
    window.ScrollTrigger.create({
      trigger: contactEl,
      start: 'top 95%',
      end: 'top 10%',
      invalidateOnRefresh: true,
      onUpdate: (self) => { contactProg = self.progress; }
    });
  }

  document.body.classList.add('has-cave-3d');
  galleryEl.classList.add('is-cave-3d');
  contactEl.classList.add('is-cave-contact');
  if (window.ScrollTrigger) window.ScrollTrigger.refresh();
  if (window.portalTransition && window.portalTransition.measure) window.portalTransition.measure();

  const hudCount = document.getElementById('caveHudCount');
  const hudBar = document.getElementById('caveHudBar');
  const hoverTip = document.getElementById('caveHoverTip');
  const hoverNo = document.getElementById('caveHoverNo');
  const hoverTitle = document.getElementById('caveHoverTitle');
  const hoverMeta = document.getElementById('caveHoverMeta');
  const promptBtn = document.getElementById('campfirePrompt');
  const modeToggleBtn = document.getElementById('caveViewToggle');

  let mosaicOpen = false;
  if (modeToggleBtn) {
    modeToggleBtn.addEventListener('click', () => {
      mosaicOpen = !mosaicOpen;
      galleryEl.classList.toggle('is-mosaic-overlay', mosaicOpen);
      modeToggleBtn.classList.toggle('is-on', mosaicOpen);
      const sp = modeToggleBtn.querySelector('span');
      if (sp) sp.textContent = mosaicOpen ? (isEn ? '3D Gallery' : '3B Galeri') : (isEn ? 'Grid View' : 'Izgara Görünümü');
      // Yükseklik değiştiği için ScrollTrigger'ları yenile ve #galeri başına hizala
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
      if (window.portalTransition && window.portalTransition.measure) window.portalTransition.measure();
      const targetTop = galleryEl.offsetTop;
      if (window.lenis && window.lenis.scrollTo) window.lenis.scrollTo(targetTop, { immediate: true });
      else window.scrollTo(0, targetTop);
      syncVisibility();
    });
  }

  function toggleCampfire() {
    const next = !fireLit;
    applyFireUI(next, true);
    if (next) campfire.triggerFlash();
  }
  window.__toggleCampfire = toggleCampfire;
  if (promptBtn) promptBtn.addEventListener('click', toggleCampfire);

  // ---------- Raycast (sadece imleç hareket ettiğinde veya seyrek aralıkla çalışır → düşük CPU) ----------
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(-9, -9);
  let mx = 0, my = 0;
  let hoveredPhoto = -1;
  let hoveredFire = false;
  let pointerDirty = false;
  let rayTick = 0;

  const isBlockedTarget = (el) => {
    if (!el || !el.closest) return false;
    return Boolean(el.closest('a, button, dialog, .iletisim-bilgi, .nav, .wb-btn, .cave-hud__bar, .cave-mosaic-drawer'));
  };

  if (finePointer) {
    window.addEventListener('pointermove', (e) => {
      mx = e.clientX / window.innerWidth - 0.5;
      my = e.clientY / window.innerHeight - 0.5;
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
      pointerDirty = true;
    }, { passive: true });
  }

  window.addEventListener('click', (e) => {
    if (!running || stageOpacity < 0.35) return;
    if (document.documentElement.classList.contains('mz-acik')) return;
    if (isBlockedTarget(e.target)) return;

    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(rayTargets, false);
    if (!hits.length) return;

    const hit = hits[0].object;
    if (hit.userData.isCampfire && contactProg > 0.18) {
      toggleCampfire();
    } else if (!mosaicOpen && typeof hit.userData.photoIndex === 'number' && contactProg < 0.55) {
      if (window.__openGalleryPhoto) window.__openGalleryPhoto(hit.userData.photoIndex);
    }
  });

  // ---------- Boyutlandırma ----------
  let uPxVal = 600;
  function resize() {
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    uPxVal = (h * dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  }
  resize();
  window.addEventListener('resize', resize);

  // ---------- Görünürlük hesabı ----------
  function syncVisibility() {
    const gr = galleryEl.getBoundingClientRect();
    const cr = contactEl.getBoundingClientRect();
    const ih = window.innerHeight;
    // Izgara görünümü açıkken 3B sahne yalnızca #contact ekrana girerken açılır; 3B modda #galeri ile birlikte açılır
    const refTop = mosaicOpen ? cr.top : gr.top;
    const enter = THREE.MathUtils.clamp((ih * 0.92 - refTop) / (ih * 0.72), 0, 1);
    const inView = cr.bottom > -40 && refTop < ih * 1.1;
    stageOpacity = inView ? enter * enter * (3 - 2 * enter) : 0;

    const on = stageOpacity > 0.002 && !document.hidden;
    stage.style.opacity = stageOpacity.toFixed(3);
    stage.style.visibility = on ? 'visible' : 'hidden';
    running = on;
  }
  let visQueued = false;
  function onScrollVis() {
    if (visQueued) return;
    visQueued = true;
    requestAnimationFrame(() => { visQueued = false; syncVisibility(); });
  }
  window.addEventListener('scroll', onScrollVis, { passive: true });
  document.addEventListener('visibilitychange', syncVisibility);
  syncVisibility();

  // ---------- Ana Çizim Döngüsü ----------
  const camPos = new THREE.Vector3(-0.65, 0.35, 5.0);
  const camLook = new THREE.Vector3(1.15, 0.28, -4.5);
  const tgtPos = new THREE.Vector3();
  const tgtLook = new THREE.Vector3();
  const lookMouse = { x: 0, y: 0 };
  const _proj = new THREE.Vector3();
  let time = 0;

  camera.position.copy(camPos);
  camera.lookAt(camLook);

  window.gsap.ticker.add((_, deltaMs) => {
    if (!running) return;
    const dt = Math.min(deltaMs / 1000, 0.05);
    time += dt;
    uTime.value = time;

    const walkT = THREE.MathUtils.clamp(galProg / 0.88, 0, 1);
    const enterCove = smoothstep(0.84, 1.0, galProg);
    const turnRight = contactProg * contactProg * (3 - 2 * contactProg);

    // Galeri yürüyüşü: solda yivli Akdeniz sütunları + açık deniz, sağda kesme traverten duvar + 12 fotoğraf
    const walkZ = THREE.MathUtils.lerp(4.6, -45.5, walkT);
    const gPosX = THREE.MathUtils.lerp(-0.65, -1.55, enterCove);
    const gPosY = THREE.MathUtils.lerp(0.35, 0.05, enterCove);
    const gPosZ = THREE.MathUtils.lerp(walkZ, -52.2, enterCove);

    const gLookX = THREE.MathUtils.lerp(1.20, 0.35, enterCove);
    const gLookY = 0.25;
    const gLookZ = gPosZ - 9.0;

    // Sağa dönmüş Kamp Ateşi & İletişim kamera hedefi
    const cPosX = -1.70, cPosY = 0.02, cPosZ = -52.4;
    const cLookX = 5.15, cLookY = -0.62, cLookZ = -54.0;

    tgtPos.set(
      THREE.MathUtils.lerp(gPosX, cPosX, turnRight),
      THREE.MathUtils.lerp(gPosY, cPosY, turnRight) + Math.sin(time * 0.7) * 0.035,
      THREE.MathUtils.lerp(gPosZ, cPosZ, turnRight)
    );
    tgtLook.set(
      THREE.MathUtils.lerp(gLookX, cLookX, turnRight),
      THREE.MathUtils.lerp(gLookY, cLookY, turnRight),
      THREE.MathUtils.lerp(gLookZ, cLookZ, turnRight)
    );

    const sm = 1 - Math.exp(-dt * 4.5);
    camPos.lerp(tgtPos, sm);
    camLook.lerp(tgtLook, sm);

    const mk = 1 - Math.exp(-dt * 3.5);
    lookMouse.x += (mx - lookMouse.x) * mk;
    lookMouse.y += (my - lookMouse.y) * mk;

    camera.position.copy(camPos);
    camera.lookAt(camLook);
    if (finePointer && !mosaicOpen) {
      camera.rotateY(-lookMouse.x * 0.08);
      camera.rotateX(-lookMouse.y * 0.05);
    }
    camera.updateMatrixWorld();

    // Workbench Gündüz ↔ Gece geçişi
    const nightTarget = forceNight ? 1.0 : turnRight * 0.62;
    smoothNight += (nightTarget - smoothNight) * (1 - Math.exp(-dt * 2.8));
    const nEase = smoothNight * smoothNight * (3 - 2 * smoothNight);
    uNight.value = nEase;

    scene.fog.color.copy(FOG_DAY).lerp(FOG_NIGHT, nEase);
    headland.material.color.copy(HEAD_DAY).lerp(HEAD_NIGHT, nEase);
    hemi.color.copy(HEMI_SKY_DAY).lerp(HEMI_SKY_NIGHT, nEase);
    hemi.groundColor.copy(HEMI_GND_DAY).lerp(HEMI_GND_NIGHT, nEase);
    hemi.intensity = THREE.MathUtils.lerp(1.42, 0.78, nEase);
    sunDir.color.copy(DIR_DAY).lerp(DIR_NIGHT, nEase);
    sunDir.intensity = THREE.MathUtils.lerp(2.45, 1.25, nEase);
    renderer.toneMappingExposure = THREE.MathUtils.lerp(1.16, 1.22, nEase);

    walkLight.position.set(camPos.x + 2.2, camPos.y + 0.9, camPos.z - 3.4);
    walkLight.intensity = THREE.MathUtils.lerp(10.0, 22.0, nEase) * (1 - turnRight * 0.72);
    const torchScale = THREE.MathUtils.lerp(0.32, 1.0, nEase);
    for (const t of torchLights) {
      t.light.intensity = t.base * torchScale * (0.90 + 0.10 * Math.sin(time * 7.5 + t.phase) + 0.05 * Math.cos(time * 13.2 + t.phase));
    }

    // Raycast hover (imleç hareketinde veya her 4 karede bir — sıfır gereksiz CPU yükü)
    rayTick = (rayTick + 1) & 3;
    if (finePointer && !mosaicOpen && !document.documentElement.classList.contains('mz-acik')) {
      if (pointerDirty || rayTick === 0) {
        pointerDirty = false;
        hoveredPhoto = -1;
        hoveredFire = false;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(rayTargets, false);
        if (hits.length) {
          const obj = hits[0].object;
          if (obj.userData.isCampfire && turnRight > 0.2) hoveredFire = true;
          else if (typeof obj.userData.photoIndex === 'number' && turnRight < 0.55 && hits[0].distance < 24) {
            hoveredPhoto = obj.userData.photoIndex;
          }
        }
      }
    } else {
      hoveredPhoto = -1;
      hoveredFire = false;
    }
    document.body.classList.toggle('cave-pointer', hoveredPhoto >= 0 || hoveredFire);

    const hk = 1 - Math.exp(-dt * 8);
    for (let i = 0; i < photoFrames.length; i++) {
      const f = photoFrames[i];
      const on = i === hoveredPhoto ? 1 : 0;
      f.hover += (on - f.hover) * hk;
      f.holder.position.x = f.baseX - f.hover * 0.14;
      const baseBri = THREE.MathUtils.lerp(0.96, 0.88, nEase);
      const bri = Math.min(1.06, baseBri + f.hover * 0.12);
      f.photoMat.color.setRGB(bri, bri * (1 - nEase * 0.02), bri * (1 - nEase * 0.05));
      f.trimMat.emissiveIntensity = 0.16 + f.hover * 1.15;
    }

    if (hoverTip) {
      if (hoveredPhoto >= 0) {
        const f = photoFrames[hoveredPhoto];
        if (hoverNo) hoverNo.textContent = String(f.index + 1).padStart(2, '0');
        if (hoverTitle) hoverTitle.textContent = f.title;
        if (hoverMeta) hoverMeta.textContent = f.meta;
        hoverTip.classList.add('is-show');
      } else {
        hoverTip.classList.remove('is-show');
      }
    }

    if (hudCount && photoFrames.length) {
      const curIdx = Math.min(photoFrames.length, Math.max(1, Math.round(walkT * (photoFrames.length - 1)) + 1));
      hudCount.textContent = `${String(curIdx).padStart(2, '0')} / ${String(photoFrames.length).padStart(2, '0')}`;
    }
    if (hudBar) hudBar.style.transform = `scaleX(${walkT.toFixed(3)})`;

    campfire.update(time, dt, fireLit, uPxVal, camera);

    if (promptBtn) {
      const showPrompt = turnRight > 0.32;
      if (showPrompt) {
        _proj.set(CAMPFIRE_POS.x, CAMPFIRE_POS.y + 1.95, CAMPFIRE_POS.z).project(camera);
        if (_proj.z < 1) {
          const sx = (_proj.x * 0.5 + 0.5) * window.innerWidth;
          const sy = (-_proj.y * 0.5 + 0.5) * window.innerHeight;
          promptBtn.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
          promptBtn.classList.add('is-visible');
          promptBtn.classList.toggle('is-hovered', hoveredFire);
        } else {
          promptBtn.classList.remove('is-visible');
        }
      } else {
        promptBtn.classList.remove('is-visible');
      }
    }

    renderer.render(scene, camera);
  });

  applyFireUI(false, false);

  window.caveScene = {
    get fireLit() { return fireLit; },
    toggleCampfire,
    setGalProgress: (v) => { galProg = v; },
    setContactProgress: (v) => { contactProg = v; }
  };
}

applyFireUI(false, false);

// Masaüstünde yerleşimi hemen rezerve et (sıfır CLS), ama 3B WebGL + 12 fotoğraf dokusunu yalnızca
// Blog/Galeri'ye yaklaşırken yükle → ilk açılış ve Fiber Tünel hiç etkilenmez!
if (!reduce && desktopMq.matches && stage && canvas && galleryEl && contactEl && window.gsap) {
  document.body.classList.add('has-cave-3d');
  galleryEl.classList.add('is-cave-3d');
  contactEl.classList.add('is-cave-contact');
  if (window.ScrollTrigger) window.ScrollTrigger.refresh();
  if (window.portalTransition && window.portalTransition.measure) window.portalTransition.measure();

  let booted = false;
  const bootCave = () => {
    if (booted) return;
    booted = true;
    initCave3D();
  };

  const io = new IntersectionObserver((ents) => {
    if (ents.some((e) => e.isIntersecting)) {
      io.disconnect();
      bootCave();
    }
  }, { rootMargin: '140% 0px 140% 0px' });

  const blogEl = document.getElementById('blog');
  if (blogEl) io.observe(blogEl);
  io.observe(galleryEl);
  io.observe(contactEl);

  // Menüden doğrudan Galeri veya İletişim'e tıklanırsa hemen başlat
  document.querySelectorAll('a[href="#galeri"], a[href="#contact"]').forEach((a) => {
    a.addEventListener('click', bootCave, { once: true });
  });
}
