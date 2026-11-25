/* =========================================================
   HAKKIMDA — CANLI 3B SAHNE (Three.js)
   ---------------------------------------------------------
   Blender'daki Akdeniz sahnesi artık önceden çekilmiş kareler değil,
   tarayıcıda her karede yeniden çizilen gerçek bir 3B sahne:

   - assets/about3d/scene.glb : Blender'dan dışa aktarılan sahne
       (kaya, taş teras, selviler, adacıklar, uzak dağlar).
       Ağır modeller web için sadeleştirildi, Draco ile sıkıştırıldı (~2,3 MB).
   - Deniz  : kendi shader'ımız. Dalgalar zamanla hareket eder,
              gökyüzünü yansıtır (Fresnel), uzakta sise karışır.
   - Gökyüzü: render'dan ölçülen renklerle degrade küre.
   - Bulut  : render'dan kesilen bulut, gökyüzünde yavaşça kayar.
   - Selviler rüzgârda hafifçe sallanır, terastaki yaprak gölgeleri kıpırdar.
   - Martılar, deniz ışıltısı ve havadaki toz: assets/about3d/camera.json
   - Kamera: kaydırmaya bağlı yol (Blender kamerasının başladığı yerden
     terasın ucuna kadar) + fareyle hafif bakınma.

   Kamera ilerlemesi js/about-scene.js'ten gelir (bölüm boyunca kaydırma)
   (window.__aboutCam). Sahne sadece görünürken çizilir (js/portal.js
   .is-on sınıfı), fiber tünel o sırada durmuş olur.
   "Hareketi azalt" açıksa hiçbir şey yüklenmez; statik render görünür.
   ========================================================= */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const sceneEl = document.querySelector('.about__scene');
const about = document.getElementById('about');
const frameBox = sceneEl && sceneEl.querySelector('.about__frame');
const posterImg = sceneEl && sceneEl.querySelector('.about__scene-img');
const seqCv = sceneEl && sceneEl.querySelector('.about__seq');
const canvas = sceneEl && sceneEl.querySelector('.about__live');

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const lowPower = window.matchMedia('(hover: none) and (pointer: coarse)').matches || window.innerWidth < 700;
const BASE = 'assets/about3d/';
const VERSION = '3';

/* Renkler render'dan ölçüldü (sRGB). THREE.Color bunları doğrusal uzaya çevirir. */
const COL = {
  zenith:  new THREE.Color('#02466C'),
  skyMid:  new THREE.Color('#0E5A82'),
  horizon: new THREE.Color('#7F98AB'),
  fog:     new THREE.Color('#5F829F'),
  deep:    new THREE.Color('#1A4C82'),
  shallow: new THREE.Color('#2C6496'),
  sun:     new THREE.Color('#FFF1DC'),
};
// Güneşe doğru yön (Blender'daki güneş lambasından hesaplandı, Three.js ekseninde)
const SUN_DIR = new THREE.Vector3(0.583, 0.657, 0.477).normalize();
// Gece sahnesindeki dolunayın yönü (gökyüzü halesi ve deniz yakamozu için ortak)
const MOON_DIR = new THREE.Vector3(170, 920, -820).normalize();

/* ---------------------------------------------------------
   Kamera yolu (Three.js koordinatı: x sağ, y yukarı, -z ileri)
   İlk nokta Blender kamerasının ilk karesiyle aynı; sonra teras
   boyunca ilerleyip denize ve adacıklara doğru hafifçe sağa döner.
   --------------------------------------------------------- */
const PATH = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 13, 65),
  new THREE.Vector3(1.5, 14, 55),
  new THREE.Vector3(3, 14.5, 45),
  new THREE.Vector3(4, 14, 36),
  new THREE.Vector3(5, 13.5, 28),
  new THREE.Vector3(5.5, 13, 22),
]);
const LOOK = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 17.4, -35),
  new THREE.Vector3(-2, 17.2, -45),
  new THREE.Vector3(-6, 16.5, -60),
  new THREE.Vector3(-10, 15.5, -80),
  new THREE.Vector3(-14, 14.5, -100),
  new THREE.Vector3(-18, 13.5, -120),
]);

/* ---------------------------------------------------------
   Ortak GLSL parçaları
   --------------------------------------------------------- */
const NOISE_GLSL = /* glsl */`
  float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1,0)), u.x), mix(hash12(i + vec2(0,1)), hash12(i + vec2(1,1)), u.x), u.y);
  }
  float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }
`;

/* Taş yüzeylere doku + terastaki kıpırdayan yaprak gölgesi (gobo) + opsiyonel ıslak deniz hattı ekler.
   Blender'daki prosedürel malzemelerin web'deki hafif karşılığı. */
function stoneMaterial(mat, uTime, { scale = 0.35, amount = 0.28, dapple = false, wetLine = false } = {}) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWPos;\nuniform float uTime;\n${NOISE_GLSL}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float n = fbm(vWPos.xz * ${scale.toFixed(3)} + vWPos.y * 0.2);
        diffuseColor.rgb *= mix(${(1 - amount).toFixed(3)}, ${(1 + amount * 0.6).toFixed(3)}, n);
        ${wetLine ? `
        // Deniz suyuyla temas eden alt taş yüzeyi koyulaşır ve ıslak görünür
        float wet = 1.0 - smoothstep(0.15, 2.8, vWPos.y);
        diffuseColor.rgb *= mix(1.0, 0.56, wet);` : ''}
        ${dapple ? `
        // Yaprak gölgesi: kameranın üstündeki görünmez ağaç örtüsünden düşen benekli gölge
        vec2 g = vWPos.xz - vec2(-17.0, 36.0);
        float m = 1.0 - smoothstep(18.0, 30.0, length(g * vec2(1.0, 0.8)));
        vec2 w = vec2(sin(uTime * 0.6), cos(uTime * 0.45)) * 0.35;      // rüzgâr
        float leaf = smoothstep(0.5, 0.58, fbm(vWPos.xz * 1.1 + w));
        diffuseColor.rgb *= mix(1.0, 0.62, leaf * m);` : ''}`);
    if (wetLine) {
      sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        float wetR = 1.0 - smoothstep(0.15, 2.6, vWPos.y);
        roughnessFactor = mix(roughnessFactor, 0.28, wetR);`);
    }
  };
  mat.customProgramCacheKey = () => 'stone' + scale + amount + dapple + wetLine;
  return mat;
}

/* Yakın sahil yamacı (WEB_Mountainside): katmanlı kireçtaşı yarıkları + Akdeniz makisi */
function cliffMaterial(mat, uTime) {
  mat.color.multiplyScalar(1.22);
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNorm;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNorm = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNorm;\nuniform float uTime;\n${NOISE_GLSL}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        // Yatay kireçtaşı tabakaları + kayalık yarık dokusu
        float strata = sin(vWPos.y * 0.85 + fbm(vWPos.xz * 0.12) * 3.4) * 0.5 + 0.5;
        float rockN = fbm(vWPos.xz * 0.22 + vWPos.y * 0.14);
        float crevice = smoothstep(0.32, 0.72, fbm(vWPos.xy * 0.35 + vWPos.z * 0.25));
        vec3 rockTint = mix(vec3(0.56, 0.53, 0.49), vec3(0.84, 0.79, 0.71), strata * 0.6 + rockN * 0.4);
        // Daha yatık yüzeylerde Akdeniz çamı / maki bitki örtüsü
        float upness = smoothstep(0.42, 0.76, vWNorm.y);
        float vegMask = upness * smoothstep(0.38, 0.68, fbm(vWPos.xz * 0.18 + 4.1)) * smoothstep(1.5, 6.0, vWPos.y);
        vec3 maquis = mix(vec3(0.16, 0.24, 0.17), vec3(0.26, 0.34, 0.22), rockN);
        diffuseColor.rgb = mix(diffuseColor.rgb * rockTint * (0.76 + 0.36 * crevice), maquis, vegMask * 0.68);`);
  };
  mat.customProgramCacheKey = () => 'cliffV1';
  return mat;
}

/* Uzak Akdeniz / Toros dağları (WEB_FarRidge & WEB_FarHaze):
   keskinleştirilmiş zirve silüeti + prosedürel vadi/yarık kabartması +
   yükseklik biyomları (maki → kireçtaşı kayalık → aydınlık zirve) +
   kıyı sisi, gün batımı kızıllığı (alpenglow) ve gece kıyı ışıkları */
function createMountainMaterial(uTime, uNight, { far = false } = {}) {
  return new THREE.ShaderMaterial({
    toneMapped: false,
    uniforms: {
      uTime, uNight,
      uSun: { value: SUN_DIR }, uSunCol: { value: COL.sun }, uMoon: { value: MOON_DIR },
      uFog: { value: COL.fog }, uHor: { value: COL.horizon },
      uFar: { value: far ? 1.0 : 0.0 },
    },
    vertexShader: /* glsl */`
      uniform float uFar;
      varying vec3 vWPos;
      varying vec3 vWNorm;
      ${NOISE_GLSL}

      // Çok katmanlı keskin sırt (ridged) profili → yumuşak tepeyi gerçekçi dağ zirvesine dönüştürür
      float ridgeNoise(vec2 p){
        float s = 0.0, a = 0.52;
        for (int i = 0; i < 3; i++){
          float n = 1.0 - abs(vnoise(p) * 2.0 - 1.0);
          s += n * n * a;
          p = p * 2.15 + vec2(3.7, 1.9);
          a *= 0.48;
        }
        return s;
      }

      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0);
        // Kıyı çizgisini bozmadan (y > 1) zirvelere organik Toros sırt kırıkları ekle
        float hMask = smoothstep(0.8, 16.0, w.y);
        float r1 = ridgeNoise(w.xz * (uFar > 0.5 ? 0.011 : 0.016) + vec2(uFar * 9.3, 2.1));
        float r2 = ridgeNoise(w.xz * 0.042 + vec2(5.4, 1.7));
        w.y += ((r1 - 0.38) * (uFar > 0.5 ? 18.0 : 14.5) + (r2 - 0.35) * 4.5) * hMask;
        vWPos = w.xyz;
        vWNorm = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uNight, uFar;
      uniform vec3 uSun, uSunCol, uMoon, uFog, uHor;
      varying vec3 vWPos;
      varying vec3 vWNorm;
      ${NOISE_GLSL}

      // Erozyon yarıkları ve kayalık sırtlar (kabartma haritası; mobilde 3, masaüstünde 4 oktav)
      float terrainHeight(vec2 p){
        float h = 0.0, a = 0.55;
        vec2 q = p;
        for (int i = 0; i < ${lowPower ? 3 : 4}; i++){
          float n = 1.0 - abs(vnoise(q) * 2.0 - 1.0);
          h += n * n * a;
          q = mat2(0.8, -0.6, 0.6, 0.8) * q * 2.08 + vec2(4.1, 2.7);
          a *= 0.48;
        }
        return h;
      }

      void main(){
        float dusk = sin(clamp(uNight, 0.0, 1.0) * 3.14159);
        float dist = length(cameraPosition - vWPos);

        // 1) Prosedürel kaya/vadi normal kabartması (güneş alan yamaç vs gölgeli kanyon)
        float sc = uFar > 0.5 ? 0.022 : 0.032;
        vec2 uv = vec2(vWPos.x * sc, vWPos.y * sc * 1.45 + vWPos.z * sc * 0.35);
        float e = 0.14;
        float h0 = terrainHeight(uv);
        float hx = terrainHeight(uv + vec2(e, 0.0)) - h0;
        float hy = terrainHeight(uv + vec2(0.0, e)) - h0;
        vec3 baseN = normalize(vWNorm);
        vec3 N = normalize(baseN + vec3(-hx * 2.2, hy * 1.6, -hx * 0.85));

        // 2) Yükseklik ve eğime göre Akdeniz biyom renkleri
        float elev = clamp(vWPos.y / (uFar > 0.5 ? 36.0 : 40.0), 0.0, 1.0);
        float detail = fbm(uv * 2.8);
        float strata = sin(vWPos.y * 0.55 + detail * 4.0) * 0.5 + 0.5;
        float gully = smoothstep(0.18, 0.72, h0); // 0 = gölgeli vadi, 1 = çıkıntılı kaya sırtı

        vec3 forestCol = mix(vec3(0.14, 0.22, 0.18), vec3(0.24, 0.32, 0.23), detail);
        vec3 rockCol   = mix(vec3(0.38, 0.37, 0.36), vec3(0.60, 0.55, 0.49), strata * 0.55 + detail * 0.45);
        vec3 peakCol   = mix(vec3(0.68, 0.65, 0.60), vec3(0.84, 0.82, 0.79), gully);

        // Alçak etekler maki/çam, dik sırtlar ve orta kesimler kireçtaşı, yüksek doruklar açık kaya
        float treeLine = 1.0 - smoothstep(0.22, 0.58, elev + (gully - 0.5) * 0.25);
        float peakMask = smoothstep(0.62, 0.94, elev + (detail - 0.45) * 0.18);
        vec3 albedo = mix(rockCol, forestCol, treeLine * 0.88);
        albedo = mix(albedo, peakCol, peakMask * 0.78);
        // Derin erozyon yarıklarında doğal ortam kapatması (AO)
        albedo *= 0.66 + 0.44 * gully;

        // 3) Gündüz güneşi / alacakaranlık kızıllığı (alpenglow) / gece ay ışığı
        float sunDiff = max(dot(N, uSun), 0.0);
        float moonDiff = max(dot(N, uMoon), 0.0);
        vec3 daySkyFill = vec3(0.28, 0.42, 0.56);
        vec3 dayLight = daySkyFill * (0.42 + 0.28 * max(N.y, 0.0)) + uSunCol * sunDiff * 1.15;

        // Gün batımında yüksek doruklara vuran sıcak pembe-kehribar ışık
        vec3 duskLight = vec3(0.14, 0.14, 0.24) + vec3(0.95, 0.46, 0.30) * sunDiff * (0.45 + 0.85 * elev);
        vec3 nightLight = vec3(0.032, 0.055, 0.105) + vec3(0.30, 0.42, 0.60) * moonDiff * (0.35 + 0.55 * elev);

        vec3 lit = albedo * mix(dayLight, nightLight, uNight);
        lit = mix(lit, albedo * duskLight, dusk * 0.62);

        // 4) Gece olunca ön dağların kıyı eteklerinde çok ince, sıcak uzak sahil kasabası ışıkları
        if (uFar < 0.5 && uNight > 0.35) {
          float coastBand = smoothstep(0.4, 2.2, vWPos.y) * (1.0 - smoothstep(4.2, 8.8, vWPos.y));
          float cluster = smoothstep(0.56, 0.78, fbm(vec2(vWPos.x * 0.025, 1.3)));
          vec2 cell = floor(vWPos.xy * vec2(0.85, 1.35));
          float spark = step(0.93, hash12(cell)) * (0.65 + 0.35 * sin(uTime * 2.5 + hash12(cell + 7.1) * 6.28));
          float nightOn = smoothstep(0.38, 0.85, uNight);
          lit += vec3(1.0, 0.76, 0.44) * spark * cluster * coastBand * nightOn * 0.95;
        }

        // 5) Atmosferik perspektif: tabanda deniz sisi + uzak dağlarda mavi derinlik pusu
        vec3 dayHaze = mix(uFog, vec3(0.68, 0.77, 0.85), 0.38);
        vec3 duskHaze = vec3(0.44, 0.27, 0.26);
        vec3 nightHaze = vec3(0.055, 0.11, 0.195);
        vec3 hazeCol = mix(dayHaze, nightHaze, uNight);
        hazeCol = mix(hazeCol, duskHaze, dusk * 0.52);

        float distHaze = (uFar > 0.5) ? 0.62 : 0.36;
        float distFactor = 1.0 - exp(-pow(dist * 0.00145, 1.45));
        float valleyMist = (1.0 - smoothstep(0.0, 12.5, vWPos.y)) * (uFar > 0.5 ? 0.52 : 0.36);
        float totalHaze = clamp(max(distFactor, distHaze) + valleyMist * (1.0 - distHaze), 0.0, 0.92);

        vec3 col = mix(lit, hazeCol, totalHaze);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`
  });
}

/* Selvi yaprakları: rüzgârda tepeye doğru artan hafif salınım */
function leafMaterial(mat, uTime) {
  mat.alphaTest = 0.45;
  mat.transparent = false;
  mat.side = THREE.DoubleSide;
  mat.color.multiplyScalar(0.8);               // render'daki koyu selvi yeşili
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float hgt = clamp((position.y + 8.0) / 16.0, 0.0, 1.0);
        float ph = modelMatrix[3].x * 0.37 + modelMatrix[3].z * 0.21;
        transformed.x += sin(uTime * 1.1 + ph) * 0.18 * hgt * hgt;
        transformed.z += cos(uTime * 0.8 + ph * 1.3) * 0.12 * hgt * hgt;`);
  };
  mat.customProgramCacheKey = () => 'leaf';
  return mat;
}

/* ---------------------------------------------------------
   Gökyüzü: Rayleigh + Mie atmosfer saçılması · ince yüksek bulutlar ·
   gün batımı alacakaranlığı · Samanyolu ve ay halesi olan gece gökyüzü
   --------------------------------------------------------- */
function createSky(uTime, uNight) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
    uniforms: {
      uTime, uNight,
      uZen: { value: COL.zenith }, uMid: { value: COL.skyMid }, uHor: { value: COL.horizon },
      uSun: { value: SUN_DIR }, uSunCol: { value: COL.sun }, uMoon: { value: MOON_DIR },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uZen, uMid, uHor, uSun, uSunCol, uMoon;
      uniform float uTime, uNight;
      varying vec3 vDir;
      ${NOISE_GLSL}

      void main(){
        vec3 dir = normalize(vDir);
        float y = max(dir.y, 0.0);
        float sunAmt = max(dot(dir, uSun), 0.0);
        float moonAmt = max(dot(dir, uMoon), 0.0);

        // 1) Gündüz atmosferi: Rayleigh dikey geçişi + ufuk pus kuşağı + güneş Mie halesi
        vec3 dayC = mix(uHor, uMid, smoothstep(0.0, 0.14, y));
        dayC = mix(dayC, uZen, smoothstep(0.14, 0.68, y));
        // Ufukta sıcak Akdeniz nem/pus katmanı
        float horizonHaze = pow(1.0 - y, 7.5);
        dayC = mix(dayC, vec3(0.70, 0.78, 0.85), horizonHaze * 0.48);
        // Güneş çevresinde Mie ileri saçılması + parlak güneş çekirdeği
        float mieWide = pow(sunAmt, 6.0) * 0.28 + pow(sunAmt, 42.0) * 0.42;
        float sunDisc = smoothstep(0.9986, 0.9994, sunAmt);
        dayC += uSunCol * (mieWide + sunDisc * 1.35) * (1.0 - smoothstep(0.45, 0.85, uNight));

        // 2) Alacakaranlık / gün batımı: ufkun güneşe dönük yönünde sıcak kehribar-şeftali kuşağı
        float dusk = sin(clamp(uNight, 0.0, 1.0) * 3.14159);
        vec2 dirXZ = dir.xz / max(length(dir.xz), 0.0001);
        vec2 sunXZ = normalize(uSun.xz);
        float azGlow = 0.45 + 0.55 * pow(max(dot(dirXZ, sunXZ), 0.0), 2.0);
        vec3 duskHor = mix(vec3(0.32, 0.22, 0.28), vec3(0.68, 0.36, 0.24), azGlow);
        vec3 duskMid = vec3(0.16, 0.14, 0.27);
        vec3 duskZen = vec3(0.04, 0.07, 0.16);
        vec3 duskC = mix(duskHor, duskMid, smoothstep(0.0, 0.18, y));
        duskC = mix(duskC, duskZen, smoothstep(0.18, 0.58, y));

        // 3) Gece gökyüzü: derin lacivert + toz şeritli Samanyolu + ay atmosfer saçılması
        vec3 nHor = vec3(0.055, 0.11, 0.195);
        vec3 nMid = vec3(0.020, 0.048, 0.105);
        vec3 nZen = vec3(0.006, 0.014, 0.036);
        vec3 nightC = mix(nHor, nMid, smoothstep(0.0, 0.22, y));
        nightC = mix(nightC, nZen, smoothstep(0.22, 0.72, y));
        // Gerçekçi Samanyolu kuşağı (domain-warped nebula + karanlık toz şeritleri)
        vec2 mwUv = dir.xz / (dir.y + 0.45);
        float mwCoord = dir.x * 0.62 + dir.z * 0.48 + 0.16;
        float mwWarp = fbm(mwUv * 1.4 + 2.1) * 0.22;
        float mwBand = exp(-pow(mwCoord + mwWarp, 2.0) * 18.0) * smoothstep(0.14, 0.55, y);
        float mwDust = fbm(mwUv * 3.2 - vec2(mwWarp * 2.0, 1.3));
        float mwRift = smoothstep(0.36, 0.68, fbm(mwUv * 4.8 + 5.7));
        vec3 mwCol = mix(vec3(0.055, 0.085, 0.16), vec3(0.16, 0.15, 0.19), mwDust);
        nightC += mwCol * mwBand * (1.0 - mwRift * 0.62) * 0.85;
        // Ay çevresinde ince gümüş-mavi atmosfer dağılımı
        nightC += vec3(0.14, 0.21, 0.34) * (pow(moonAmt, 5.0) * 0.45 + pow(moonAmt, 24.0) * 0.55);

        vec3 c = mix(dayC, nightC, smoothstep(0.0, 1.0, uNight));
        c = mix(c, duskC, dusk * 0.62);

        // 4) Yüksek irtifa ince sirüs bulutları (rüzgârla yavaşça kayar; gündüz güneşli, gece ay ışıklı)
        if (y > 0.03) {
          vec2 cuv = dir.xz / (y + 0.18) * 0.52 + vec2(uTime * 0.006, -uTime * 0.0025);
          float w = fbm(cuv * 1.4);
          float cirrus = fbm(cuv * 2.2 + vec2(w * 0.85, -w * 0.55));
          float mask = smoothstep(0.50, 0.82, cirrus) * smoothstep(0.03, 0.20, y) * (1.0 - smoothstep(0.65, 0.96, y));
          vec3 cloudDay = mix(vec3(0.84, 0.89, 0.94), uSunCol * 1.08, pow(sunAmt, 3.0) * 0.65);
          vec3 cloudDusk = vec3(0.92, 0.58, 0.42);
          vec3 cloudNight = vec3(0.16, 0.23, 0.34) * (0.65 + 0.75 * pow(moonAmt, 3.0));
          vec3 cloudCol = mix(cloudDay, cloudNight, uNight);
          cloudCol = mix(cloudCol, cloudDusk, dusk * 0.65);
          c = mix(c, cloudCol, mask * mix(0.42, 0.24, uNight));
        }

        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(2000, 40, 24), mat);
  m.frustumCulled = false; m.renderOrder = -10;
  return m;
}

/* ---------------------------------------------------------
   Gece gökyüzü: kırınımlı yıldızlar + detaylı dolunay + arada kayan yıldız
   --------------------------------------------------------- */
function createNightSky(uTime, uPx, uNight) {
  const group = new THREE.Group();

  // 1) Üst gökyüzü kubbesinde ~1100 gerçekçi yıldız (en parlaklarda ince kırınım ışıltısı)
  const starCount = lowPower ? 360 : 1150;
  const pos = new Float32Array(starCount * 3);
  const seed = new Float32Array(starCount * 3); // faz, hız, parlaklık
  const tint = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const elev = 0.06 + Math.pow(Math.random(), 0.76) * 1.45;
    const R = 1450;
    pos[i * 3]     = Math.cos(theta) * Math.cos(elev) * R;
    pos[i * 3 + 1] = Math.sin(elev) * R;
    pos[i * 3 + 2] = Math.sin(theta) * Math.cos(elev) * R;
    const bright = Math.random() < 0.08 ? 1.85 + Math.random() * 1.1 : Math.random() < 0.28 ? 0.95 + Math.random() * 0.7 : 0.35 + Math.random() * 0.55;
    seed.set([Math.random() * 6.283, 0.7 + Math.random() * 2.6, bright], i * 3);
    const pick = Math.random();
    if (pick < 0.22) tint.set([1.0, 0.88, 0.72], i * 3);
    else if (pick < 0.55) tint.set([0.82, 0.91, 1.0], i * 3);
    else tint.set([0.99, 0.98, 0.95], i * 3);
  }
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
  sGeo.setAttribute('aTint', new THREE.BufferAttribute(tint, 3));
  const sMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, toneMapped: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime, uPx, uNight },
    vertexShader: /* glsl */`
      attribute vec3 aSeed, aTint;
      uniform float uTime, uPx, uNight;
      varying float vAlpha, vBright;
      varying vec3 vCol;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float vis = smoothstep(0.28, 0.92, uNight);
        float tw = 0.72 + 0.28 * sin(uTime * aSeed.y + aSeed.x);
        vBright = aSeed.z;
        vAlpha = vis * tw * clamp(aSeed.z * 0.72, 0.22, 1.0);
        vCol = aTint;
        gl_PointSize = clamp((1.5 + aSeed.z * 3.0) * (uPx / 1000.0), 1.4, 11.0) * vis;
      }`,
    fragmentShader: /* glsl */`
      varying float vAlpha, vBright;
      varying vec3 vCol;
      void main(){
        if (vAlpha < 0.01) discard;
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c) * 2.0;
        if (d > 1.0) discard;
        float core = exp(-d * d * 11.0);
        float halo = pow(1.0 - d, 2.8) * 0.42;
        // Parlak yıldızlarda ince 4 kollu doğal kırınım parıltısı
        float spike = 0.0;
        if (vBright > 1.7) {
          float sx = exp(-abs(c.y) * 26.0) * exp(-abs(c.x) * 4.5);
          float sy = exp(-abs(c.x) * 26.0) * exp(-abs(c.y) * 4.5);
          spike = (sx + sy) * 0.55;
        }
        gl_FragColor = vec4(vCol, clamp(core + halo + spike, 0.0, 1.0) * vAlpha);
      }`
  });
  const stars = new THREE.Points(sGeo, sMat);
  stars.frustumCulled = false; stars.renderOrder = -8;
  group.add(stars);

  // 2) Gece gökyüzünde yumuşak parlayan Akdeniz dolunayı (kamera yukarı bakınca sağ üstte)
  const moonMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, toneMapped: false, blending: THREE.AdditiveBlending,
    uniforms: { uNight },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uNight;
      varying vec2 vUv;
      ${NOISE_GLSL}
      void main(){
        float vis = smoothstep(0.32, 0.95, uNight);
        if (vis < 0.01) discard;
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        if (r > 1.0) discard;
        // Ay diski + küresel kenar kararması + çok ölçekli ay denizleri (maria) + atmosfer halesi
        float disc = smoothstep(0.23, 0.205, r);
        float limb = sqrt(max(0.0, 1.0 - min(1.0, (r / 0.225) * (r / 0.225))));
        float maria = smoothstep(0.35, 0.72, fbm(p * 8.5 + 1.9)) * 0.22;
        float micro = fbm(p * 24.0 + 4.2) * 0.06;
        float shade = (0.76 + 0.24 * limb) * (1.0 - maria + micro);
        float innerGlow = exp(-r * r * 7.5) * 0.58;
        float outerGlow = pow(max(0.0, 1.0 - r), 3.2) * 0.36;
        vec3 discCol = vec3(1.0, 0.975, 0.915) * shade;
        vec3 glowCol = vec3(0.64, 0.78, 0.96);
        vec3 col = mix(glowCol, discCol, disc);
        float alpha = (disc * 0.98 + innerGlow + outerGlow) * vis;
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
      }`
  });
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(350, 350), moonMat);
  moon.position.set(170, 920, -820);
  moon.frustumCulled = false; moon.renderOrder = -7;
  group.add(moon);

  // 3) Gece gökyüzünde arada bir süzülen ince kayan yıldız
  const meteorGeo = new THREE.BufferGeometry();
  const mPos = new Float32Array(6);
  meteorGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
  const meteorMat = new THREE.LineBasicMaterial({ color: 0xFFF7E6, transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
  const meteor = new THREE.Line(meteorGeo, meteorMat);
  meteor.frustumCulled = false; meteor.renderOrder = -6;
  group.add(meteor);

  let nextMeteor = 3.5;
  let mState = null;

  function update(camera, time = 0, nightVal = 0) {
    moon.quaternion.copy(camera.quaternion);
    if (nightVal < 0.65) { meteorMat.opacity = 0; return; }
    if (!mState && time > nextMeteor) {
      const sx = -520 + Math.random() * 520;
      const sy = 760 + Math.random() * 340;
      const sz = -720 - Math.random() * 320;
      mState = { t0: time, dur: 0.72, sx, sy, sz, vx: 210 + Math.random() * 140, vy: -95 - Math.random() * 70, vz: 30 };
      nextMeteor = time + 6.5 + Math.random() * 5.5;
    }
    if (mState) {
      const f = (time - mState.t0) / mState.dur;
      if (f >= 1) { mState = null; meteorMat.opacity = 0; }
      else {
        const head = f, tail = Math.max(0, f - 0.22);
        mPos[0] = mState.sx + mState.vx * tail; mPos[1] = mState.sy + mState.vy * tail; mPos[2] = mState.sz + mState.vz * tail;
        mPos[3] = mState.sx + mState.vx * head; mPos[4] = mState.sy + mState.vy * head; mPos[5] = mState.sz + mState.vz * head;
        meteorGeo.attributes.position.needsUpdate = true;
        meteorMat.opacity = Math.sin(f * Math.PI) * 0.85 * Math.min(1, (nightVal - 0.65) / 0.3);
      }
    }
  }
  return { group, update };
}

/* ---------------------------------------------------------
   Deniz: gerçek 3B Gerstner kabarma + 6 katmanlı dalga + kılcal çırpıntı +
   turkuaz alt-yüzey saçılması (SSS) + güneş parıltısı / gece yakamozu + köpük
   --------------------------------------------------------- */
function createSea(uTime, uNight) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime, uNight,
      uDeep: { value: COL.deep }, uShallow: { value: COL.shallow },
      uHor: { value: COL.horizon }, uZen: { value: COL.skyMid }, uFog: { value: COL.fog },
      uSun: { value: SUN_DIR }, uSunCol: { value: COL.sun }, uMoon: { value: MOON_DIR },
    },
    vertexShader: /* glsl */`
      uniform float uTime;
      varying vec3 vW;
      varying float vSwell;
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0);
        // Yakın ve orta mesafede fiziksel 3B deniz kabarması (ufukta sıfırlanır)
        float dist = length(cameraPosition.xz - w.xz);
        float nearMask = 1.0 - smoothstep(140.0, 520.0, dist);
        float h = 0.0;
        h += sin(dot(w.xz, vec2( 0.048,  0.022)) + uTime * 0.95) * 0.34;
        h += sin(dot(w.xz, vec2(-0.036,  0.064)) + uTime * 1.25) * 0.24;
        h += sin(dot(w.xz, vec2( 0.025, -0.095)) + uTime * 1.55) * 0.14;
        w.y += h * nearMask;
        vSwell = h * nearMask;
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uNight;
      uniform vec3 uDeep, uShallow, uHor, uZen, uFog, uSun, uSunCol, uMoon;
      varying vec3 vW;
      varying float vSwell;
      ${NOISE_GLSL}

      // 6 yönlü keskinleştirilmiş Akdeniz dalga spektrumu → (eğim.x, eğim.z, tepe yüksekliği)
      vec3 oceanWaves(vec2 p, float t, float detail){
        vec2 slope = vec2(0.0);
        float crest = 0.0;
        // yön(xy), frekans(z), hız(w)
        vec4 wv[6];
        wv[0] = vec4(normalize(vec2( 0.94,  0.34)), 0.048, 0.95);
        wv[1] = vec4(normalize(vec2(-0.52,  0.85)), 0.082, 1.32);
        wv[2] = vec4(normalize(vec2( 0.28, -0.96)), 0.135, 1.72);
        wv[3] = vec4(normalize(vec2( 0.82, -0.57)), 0.230, 2.25);
        wv[4] = vec4(normalize(vec2(-0.88, -0.47)), 0.390, 2.85);
        wv[5] = vec4(normalize(vec2( 0.15,  0.99)), 0.640, 3.45);
        float amps[6];
        amps[0] = 0.42; amps[1] = 0.32; amps[2] = 0.22; amps[3] = 0.14; amps[4] = 0.085; amps[5] = 0.05;

        for (int i = 0; i < 6; i++){
          float lod = (i < 3) ? 1.0 : detail;
          float ph = dot(wv[i].xy, p) * wv[i].z + t * wv[i].w;
          // Trokoidal/keskin dalga tepesi (sinüsün üssüyle doğal sivri sırtlar)
          float s = 0.5 + 0.5 * sin(ph);
          float sharp = pow(s, 1.65);
          float dSharp = 1.65 * pow(max(s, 0.001), 0.65) * 0.5 * cos(ph);
          slope += wv[i].xy * dSharp * amps[i] * lod;
          crest += sharp * amps[i] * lod;
        }

        // Çift yönlü dönen kılcal rüzgâr çırpıntısı (hızlı 2 oktav vnoise → 2.5x daha hafif GPU maliyeti, aynı canlı keskinlik)
        if (detail > 0.02) {
          float e = 0.18;
          vec2 p1 = p * 0.50 + vec2(t * 0.32, -t * 0.21);
          float n1  = vnoise(p1) * 0.65 + vnoise(p1 * 2.05 + 4.1) * 0.35;
          float n1x = (vnoise(p1 + vec2(e, 0.0)) * 0.65 + vnoise((p1 + vec2(e, 0.0)) * 2.05 + 4.1) * 0.35) - n1;
          float n1y = (vnoise(p1 + vec2(0.0, e)) * 0.65 + vnoise((p1 + vec2(0.0, e)) * 2.05 + 4.1) * 0.35) - n1;
          ${lowPower ? `
          slope += vec2(n1x, n1y) * 0.85 * detail;` : `
          vec2 p2 = vec2(p.x * 0.72 - p.y * 0.68, p.x * 0.68 + p.y * 0.72) * 0.94 + vec2(-t * 0.28, t * 0.38);
          float n2  = vnoise(p2) * 0.62 + vnoise(p2 * 2.15 + 3.7) * 0.38;
          float n2x = (vnoise(p2 + vec2(e, 0.0)) * 0.62 + vnoise((p2 + vec2(e, 0.0)) * 2.15 + 3.7) * 0.38) - n2;
          float n2y = (vnoise(p2 + vec2(0.0, e)) * 0.62 + vnoise((p2 + vec2(0.0, e)) * 2.15 + 3.7) * 0.38) - n2;
          slope += (vec2(n1x, n1y) * 0.60 + vec2(n2x, n2y) * 0.40) * detail;`}
        }

        return vec3(slope, crest);
      }

      // Yansıma için gökyüzüyle birebir uyumlu renk hesabı (gündüz → gün batımı → gece)
      vec3 sampleSkyReflect(vec3 R, float dusk){
        float ry = max(R.y, 0.0);
        vec3 dayR = mix(uHor, uZen, smoothstep(0.0, 0.38, ry));
        dayR += uSunCol * pow(max(dot(R, uSun), 0.0), 8.0) * 0.26 * (1.0 - uNight);
        vec3 nightR = mix(vec3(0.055, 0.11, 0.195), vec3(0.012, 0.032, 0.075), smoothstep(0.0, 0.42, ry));
        nightR += vec3(0.18, 0.28, 0.44) * pow(max(dot(R, uMoon), 0.0), 10.0) * 0.45;
        vec3 duskR = mix(vec3(0.56, 0.30, 0.24), vec3(0.08, 0.11, 0.22), smoothstep(0.0, 0.35, ry));
        vec3 s = mix(dayR, nightR, uNight);
        return mix(s, duskR, dusk * 0.52);
      }

      void main(){
        float dist = length(cameraPosition.xz - vW.xz);
        float detail = 1.0 - smoothstep(45.0, 420.0, dist);
        float swellFade = 1.0 - smoothstep(80.0, 950.0, dist);
        float dusk = sin(clamp(uNight, 0.0, 1.0) * 3.14159);

        vec3 wv = oceanWaves(vW.xz, uTime, detail);
        vec2 slope = wv.xy * (0.14 + 0.34 * swellFade);
        vec3 N = normalize(vec3(-slope.x, 1.0, -slope.y));
        vec3 V = normalize(cameraPosition - vW);
        float NoV = max(dot(N, V), 0.0);

        // 1) Fiziksel Schlick Fresnel (F0 = 0.02)
        float fres = 0.02 + 0.98 * pow(1.0 - NoV, 5.0);
        vec3 R = reflect(-V, N);
        vec3 skyRefl = sampleSkyReflect(R, dusk);

        // 2) Derin Akdeniz su gövdesi + canlı doğal turkuaz-kobalt akıntı derinliği
        vec3 deepCol = mix(vec3(0.06, 0.24, 0.46), vec3(0.014, 0.038, 0.082), uNight);
        vec3 shalCol = mix(vec3(0.08, 0.44, 0.54), vec3(0.03, 0.078, 0.145), uNight);
        float patchN = vnoise(vW.xz * 0.014 + vec2(uTime * 0.008, -uTime * 0.006)) * 0.65
                     + vnoise(vW.xz * 0.032 - vec2(uTime * 0.005, uTime * 0.007)) * 0.35;
        vec3 waterCol = mix(deepCol, shalCol, 0.24 + 0.48 * patchN);

        // 3) Alt-yüzey saçılması (SSS): dalga tepelerinden sızan doğal Akdeniz zümrüt-turkuaz güneş ışığı
        vec3 lightDir = normalize(mix(uSun, uMoon, smoothstep(0.45, 0.85, uNight)));
        float backLight = pow(clamp(dot(V, -lightDir + N * 0.48), 0.0, 1.0), 3.0);
        float crestFactor = smoothstep(0.28, 0.90, wv.z + vSwell * 0.45);
        vec3 sssCol = mix(vec3(0.07, 0.66, 0.62), vec3(0.04, 0.19, 0.30), uNight);
        waterCol += sssCol * (crestFactor * 0.34 + backLight * crestFactor * 0.62) * (1.0 - uNight * 0.72) * swellFade;

        vec3 c = mix(waterCol, skyRefl, clamp(fres * 0.92, 0.04, 0.95));

        // 4) Çift katmanlı güneş parıltısı / gece ay yakamozu
        float specBroad = pow(max(dot(R, lightDir), 0.0), 36.0);
        float specSharp = pow(max(dot(R, lightDir), 0.0), 540.0);
        vec3 specCol = mix(uSunCol, vec3(0.76, 0.87, 1.0), smoothstep(0.35, 0.85, uNight));
        specCol = mix(specCol, vec3(1.0, 0.66, 0.42), dusk * 0.55);
        c += specCol * (specBroad * mix(0.28, 0.14, uNight) + specSharp * mix(2.4, 1.35, uNight));

        // 5) Rüzgârlı dalga sırtlarında ince dantel deniz köpüğü (yakın/orta mesafe)
        float foamNoise = fbm(vW.xz * 0.34 + vec2(uTime * 0.18, -uTime * 0.12));
        float whitecap = smoothstep(0.76, 1.05, wv.z + foamNoise * 0.34) * detail * 0.45;
        vec3 foamCol = mix(vec3(0.92, 0.96, 0.98), vec3(0.32, 0.42, 0.54), uNight);
        c = mix(c, foamCol, clamp(whitecap, 0.0, 0.55));

        // 6) Ufuk sisi: gökyüzünün ufuk rengiyle birebir kaynaşır (çizgi bırakmaz)
        vec3 dayFog = mix(uFog, vec3(0.70, 0.78, 0.85), 0.38);
        vec3 nightFog = vec3(0.055, 0.11, 0.195);
        vec3 duskFog = vec3(0.46, 0.27, 0.25);
        vec3 fogCol = mix(dayFog, nightFog, uNight);
        fogCol = mix(fogCol, duskFog, dusk * 0.52);
        float f = 1.0 - exp(-pow(dist * 0.00145, 1.55));
        c = mix(c, fogCol, clamp(f, 0.0, 1.0));

        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
    toneMapped: false
  });
  const seg = lowPower ? 48 : 128;
  const g = new THREE.PlaneGeometry(5000, 5000, seg, seg);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.y = 0.15;
  return m;
}

/* ---------------------------------------------------------
   Bulutlar: render'dan kesilmiş bulut, gökyüzünde yavaşça kayar
   --------------------------------------------------------- */
function createClouds(tex) {
  tex.colorSpace = THREE.SRGBColorSpace;
  const aspect = 187 / 640;
  const make = (w, x, y, z, op, flip) => {
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, toneMapped: false, opacity: op });
    mat.color.setScalar(1.35);                 // render'daki bulut biraz daha parlak
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * aspect), mat);
    m.position.set(x, y, z); m.userData.x0 = x;
    if (flip) m.scale.x = -1;
    m.renderOrder = -5;
    return m;
  };
  return [
    make(120, 85, 60, -150, 1.0, false),       // render'daki bulutla aynı yer ve boy
    make(170, -170, 82, -330, 0.75, true),
    make(110, 240, 70, -380, 0.6, false),
  ];
}

/* ---------------------------------------------------------
   Martılar, deniz ışıltısı ve toz (camera.json'daki konumlarla)
   --------------------------------------------------------- */
function createLife(data, uTime, uPx) {
  const group = new THREE.Group();
  /* Deniz ışıltısı */
  {
    const src = data.glints, n = Math.floor(src.length / 3), keep = lowPower ? Math.min(n, 600) : Math.min(n, 1500);
    const pos = new Float32Array(keep * 3), seed = new Float32Array(keep * 2);
    for (let i = 0; i < keep; i++) {
      const j = Math.floor(i * n / keep);
      pos.set([src[j * 3], 0.3, src[j * 3 + 2]], i * 3);
      seed.set([Math.random() * 6.283, 0.6 + Math.random() * 1.6], i * 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 2));
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime, uPx },
      vertexShader: /* glsl */`
        attribute vec2 seed; uniform float uTime, uPx; varying float vA;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
          float tw = pow(max(0.0, sin(uTime * seed.y + seed.x)), 14.0); vA = tw;
          gl_PointSize = clamp(0.55 * uPx / -mv.z * (0.5 + tw), 1.0, 8.0);
        }`,
      fragmentShader: /* glsl */`
        varying float vA;
        void main(){ vec2 c = gl_PointCoord - 0.5; float d = dot(c, c) * 4.0; if (d > 1.0) discard;
          gl_FragColor = vec4(vec3(0.92, 0.97, 1.0), (1.0 - d) * vA * 0.45); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false
    });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; group.add(pts);
  }
  /* Toz: kameranın önünde güneşi yakalayan ince parçacıklar */
  {
    const [x0, x1, y0, y1, z0, z1] = data.dustBox;
    const count = lowPower ? 50 : 140;
    const pos = new Float32Array(count * 3), seed = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos.set([x0 + Math.random() * (x1 - x0 + 25), y0 + Math.random() * (y1 - y0), z0 - 70 + Math.random() * (z1 - z0 + 70)], i * 3);
      seed.set([Math.random() * 6.283, 0.15 + Math.random() * 0.35, 0.4 + Math.random() * 0.6], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 3));
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime, uPx },
      vertexShader: /* glsl */`
        attribute vec3 seed; uniform float uTime, uPx; varying float vA;
        void main(){
          float t = uTime * seed.y;
          vec3 p = position + vec3(sin(t + seed.x), sin(t * 1.3 + seed.x * 2.0) * 0.6 + t * 0.15, cos(t * 0.8 + seed.x)) * 0.9;
          p.y = position.y + mod(p.y - position.y + 3.0, 6.0) - 3.0;
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
          vA = seed.z * smoothstep(1.5, 4.0, -mv.z);
          gl_PointSize = clamp(0.045 * uPx / -mv.z, 1.0, 5.0);
        }`,
      fragmentShader: /* glsl */`
        varying float vA;
        void main(){ vec2 c = gl_PointCoord - 0.5; float d = dot(c, c) * 4.0; if (d > 1.0) discard;
          gl_FragColor = vec4(vec3(1.0, 0.96, 0.86), (1.0 - d) * vA * 0.5); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false
    });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; group.add(pts);
  }
  /* Martılar: süzülen, arada kanat çırpan kuşlar */
  const birds = data.gulls.map((b, i) => ({ ...b, phase: i * 1.7, flap: 5 + i * 0.7 }));
  const bPos = new Float32Array(birds.length * 4 * 9);
  const bGeo = new THREE.BufferGeometry();
  bGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
  const bMesh = new THREE.Mesh(bGeo, new THREE.MeshBasicMaterial({ color: 0x3b4650, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
  bMesh.frustumCulled = false; group.add(bMesh);
  const _c = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(0, 1, 0), _p = new THREE.Vector3();
  function update(t) {
    let o = 0;
    for (const b of birds) {
      const ang = b.phase + t * b.speed;
      _c.set(b.c[0] + Math.cos(ang) * b.r, b.c[1] + Math.sin(t * 0.5 + b.phase) * 1.2, b.c[2] + Math.sin(ang) * b.r * 0.6);
      _f.set(-Math.sin(ang), 0, Math.cos(ang) * 0.6).normalize();
      _r.crossVectors(_f, _u).normalize();
      const s = b.size, glide = 0.5 + 0.5 * Math.sin(t * 0.35 + b.phase);
      const a = Math.sin(t * b.flap + b.phase) * 0.55 * (1 - glide) + 0.12 * glide;
      const elbowY = Math.sin(a) * 0.28 * s, tipY = Math.sin(a) * 0.62 * s + elbowY * 0.4;
      const P = (fx, rx, uy) => _p.copy(_c).addScaledVector(_f, fx * s).addScaledVector(_r, rx * s).addScaledVector(_u, uy).toArray();
      const front = P(0.28, 0, 0), back = P(-0.32, 0, 0);
      for (const side of [-1, 1]) {
        const elbow = P(0.02, side * 0.45, elbowY), tip = P(-0.12, side * 0.9, tipY);
        for (const v of [front, back, elbow, elbow, back, tip]) { bPos[o++] = v[0]; bPos[o++] = v[1]; bPos[o++] = v[2]; }
      }
    }
    bGeo.attributes.position.needsUpdate = true;
  }
  return { group, update };
}

/* ---------------------------------------------------------
   Akdeniz Taş Sütunları (Projeler bölümü)
   ---------------------------------------------------------
   Terasın ve kayalıkların tamamen ilerisinde, açık denizde (z ≈ -100…-111)
   yavaşça su altından yükselen 4 büyük yivli Akdeniz kireçtaşı sütun +
   diplerinde canlı köpük/dalga halkası + hover'da doğal gün ışığı.
   --------------------------------------------------------- */
const PROJ_CAM_POS = new THREE.Vector3(-16.0, 20.0, -54.0);
const PROJ_CAM_LOOK = new THREE.Vector3(-42.0, 12.8, -156.0);
const BLOG_CAM_POS = new THREE.Vector3(-16.0, 24.0, -58.0);
const BLOG_CAM_LOOK = new THREE.Vector3(-42.0, 118.0, -144.0);

/* Silindir geometrisindeki 0/2π dikiş çizgisinin normalini birleştir */
function weldCylinderSeamNormals(geo, radialSegs, rowsCount) {
  const n = geo.attributes.normal;
  const stride = radialSegs + 1;
  for (let row = 0; row < rowsCount; row++) {
    const a = row * stride;
    const b = row * stride + radialSegs;
    if (b >= n.count) break;
    const nx = n.getX(a) + n.getX(b), ny = n.getY(a) + n.getY(b), nz = n.getZ(a) + n.getZ(b);
    const len = Math.hypot(nx, ny, nz) || 1;
    n.setXYZ(a, nx / len, ny / len, nz / len);
    n.setXYZ(b, nx / len, ny / len, nz / len);
  }
  n.needsUpdate = true;
}

/* Lathe geometrisindeki 0/2π dikiş çizgisinin normalini birleştir (dikey kırık gölgeyi yok eder) */
function weldLatheSeamNormals(geo, segs, ptCount) {
  const n = geo.attributes.normal;
  const lastCol = segs * ptCount;
  for (let j = 0; j < ptCount; j++) {
    const a = j;
    const b = lastCol + j;
    if (b >= n.count) break;
    const nx = n.getX(a) + n.getX(b), ny = n.getY(a) + n.getY(b), nz = n.getZ(a) + n.getZ(b);
    const len = Math.hypot(nx, ny, nz) || 1;
    n.setXYZ(a, nx / len, ny / len, nz / len);
    n.setXYZ(b, nx / len, ny / len, nz / len);
  }
  n.needsUpdate = true;
}

/* Prosedürel PBR Antik Akdeniz Traverten / Kireçtaşı doku üretici (dikişsiz 512×512):
   - Albedo (renk): traverten katmanları, taş tambur derzleri, gözenekler, ince çatlaklar, yağmur izleri
   - Normal Map: Sobel 3×3 ile gerçek 3B yüzey kabartması (güneş her çukura ve derze gölge düşürür)
   - Roughness Map: gözenek ve derzler mat, aşınmış kireçtaşı sırtları hafif ipeksi */
function createTravertinePBR() {
  // Mobilde 256×256 (4x daha hızlı üretim + 4x az VRAM), masaüstünde 512×512 yüksek detay
  const S = lowPower ? 256 : 512;
  const height = new Float32Array(S * S);

  // Dikişsiz periyodik değer gürültüsü (x ve y'de [0..period) sarılır)
  const h2 = (ix, iy, seed) => {
    const n = Math.sin(ix * 127.1 + iy * 311.7 + seed * 74.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const pNoise = (u, v, px, py, seed) => {
    const x = u * px, y = v * py;
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const x1 = (x0 + 1) % px, y1 = (y0 + 1) % py;
    const mx0 = ((x0 % px) + px) % px, my0 = ((y0 % py) + py) % py;
    const mx1 = ((x1 % px) + px) % px, my1 = ((y1 % py) + py) % py;
    const a = h2(mx0, my0, seed), b = h2(mx1, my0, seed);
    const c = h2(mx0, my1, seed), d = h2(mx1, my1, seed);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };
  const pFbm = (u, v, bx, by, oct, seed) => {
    let val = 0, amp = 0.5, fx = bx, fy = by;
    for (let o = 0; o < oct; o++) {
      val += pNoise(u, v, fx, fy, seed + o * 13.7) * amp;
      fx *= 2; fy *= 2; amp *= 0.5;
    }
    return val;
  };

  // Önce gözenek çukurları ve kılcal çatlak katmanını 2B tuvalde çiz
  const pitCv = document.createElement('canvas'); pitCv.width = S; pitCv.height = S;
  const pCtx = pitCv.getContext('2d');
  pCtx.fillStyle = '#000'; pCtx.fillRect(0, 0, S, S);
  // Yatay uzamış antik traverten gözenek çukurları (dikişsiz sarma ile)
  let rng = 1337;
  const rnd = () => { rng = (rng * 16807) % 2147483647; return (rng - 1) / 2147483646; };
  for (let i = 0; i < 620; i++) {
    const cx = rnd() * S, cy = rnd() * S;
    const rx = 1.6 + Math.pow(rnd(), 2.2) * 11.5;
    const ry = 0.7 + rnd() * 2.1;
    const alpha = 0.25 + rnd() * 0.65;
    pCtx.fillStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    for (const ox of [-S, 0, S]) {
      pCtx.beginPath();
      pCtx.ellipse(cx + ox, cy, rx, ry, (rnd() - 0.5) * 0.25, 0, Math.PI * 2);
      pCtx.fill();
    }
  }
  // İnce dallanan aşınma çatlakları
  pCtx.strokeStyle = 'rgba(255,255,255,0.58)';
  for (let c = 0; c < 18; c++) {
    let x = rnd() * S, y = rnd() * S;
    pCtx.lineWidth = 0.6 + rnd() * 1.1;
    pCtx.beginPath(); pCtx.moveTo(x, y);
    let ang = rnd() * Math.PI * 2;
    for (let s = 0; s < 14; s++) {
      ang += (rnd() - 0.5) * 0.9;
      x += Math.cos(ang) * (4 + rnd() * 7);
      y += Math.sin(ang) * (4 + rnd() * 7);
      pCtx.lineTo(x, y);
    }
    pCtx.stroke();
  }
  const pitData = pCtx.getImageData(0, 0, S, S).data;

  // Albedo + Roughness piksellerini ve yükseklik haritasını hesapla
  const colCv = document.createElement('canvas'); colCv.width = S; colCv.height = S;
  const colCtx = colCv.getContext('2d');
  const colImg = colCtx.createImageData(S, S);

  const roughCv = document.createElement('canvas'); roughCv.width = S; roughCv.height = S;
  const roughCtx = roughCv.getContext('2d');
  const roughImg = roughCtx.createImageData(S, S);

  // Yatay tambur blok derzleri (antik sütunlar üst üste blok taşlardan oluşur)
  const joints = [0.24, 0.51, 0.77];

  for (let y = 0; y < S; y++) {
    const v = y / S;
    // Hangi taş tambur bloğunda olduğuna göre çok hafif ton farkı
    const drumId = v < joints[0] ? 0 : v < joints[1] ? 1 : v < joints[2] ? 2 : 3;
    const drumTone = [1.02, 0.96, 1.04, 0.98][drumId];

    for (let x = 0; x < S; x++) {
      const u = x / S;
      const idx = y * S + x;
      const p4 = idx * 4;

      const broad = pFbm(u, v, 4, 4, 4, 1.1);
      // Traverten yatay tortul damarları
      const warp = pFbm(u, v, 6, 6, 3, 21.3) * 0.14;
      const vein = pFbm(u, (v + warp) % 1, 4, 18, 4, 43.7);
      const grain = pNoise(u, v, 48, 48, 88.2) * 0.55 + pNoise(u, v, 96, 96, 112.5) * 0.45;
      // Yağmur / rüzgâr dikey aşınma izleri
      const streak = pFbm(u, v, 16, 3, 3, 67.4);
      const pit = pitData[p4] / 255;

      // Tambur derz oluğu + kenar aşınması
      let jointDepth = 0;
      for (let j = 0; j < joints.length; j++) {
        const d = Math.abs(v - joints[j] - (broad - 0.5) * 0.008);
        if (d < 0.0075) {
          jointDepth = Math.max(jointDepth, (1 - d / 0.0075));
        }
      }
      jointDepth = jointDepth * jointDepth;

      // Yükseklik haritası (normal map için)
      const hVal = 0.55
        + (broad - 0.5) * 0.22
        + (vein - 0.5) * 0.26
        + (grain - 0.5) * 0.18
        - pit * 0.46
        - jointDepth * 0.62;
      height[idx] = hVal;

      // Gerçekçi sıcak Akdeniz traverten renk karışımı
      const warm = Math.min(1, Math.max(0, broad * 0.5 + vein * 0.5));
      let r = (182 + warm * 46) * drumTone;
      let g = (165 + warm * 44) * drumTone;
      let b = (138 + warm * 40) * drumTone;

      // İnce kalsit beyazı damar parlaması
      const calcite = Math.max(0, vein - 0.66) * 2.2;
      r += calcite * 36; g += calcite * 34; b += calcite * 28;

      // Dikey yağmur aşınma tonu + kum tanesi dokusu
      const weather = 0.88 + streak * 0.18 + (grain - 0.5) * 0.14;
      r *= weather; g *= weather; b *= weather;

      // Çukurlar, çatlaklar ve tambur derzleri doğal gölgeli kahve-gri olur
      const cav = Math.min(1, pit * 0.78 + jointDepth * 0.85);
      r = r * (1 - cav * 0.46) + 64 * cav * 0.46;
      g = g * (1 - cav * 0.48) + 56 * cav * 0.48;
      b = b * (1 - cav * 0.50) + 46 * cav * 0.50;

      colImg.data[p4]     = Math.max(0, Math.min(255, Math.round(r)));
      colImg.data[p4 + 1] = Math.max(0, Math.min(255, Math.round(g)));
      colImg.data[p4 + 2] = Math.max(0, Math.min(255, Math.round(b)));
      colImg.data[p4 + 3] = 255;

      // Pürüzlülük: gözenekler çok mat (245), düz aşınmış sırtlar hafif ipeksi (168)
      const rv = Math.max(150, Math.min(250, Math.round(176 + (1 - warm) * 28 + grain * 18 + cav * 48)));
      roughImg.data[p4] = roughImg.data[p4 + 1] = roughImg.data[p4 + 2] = rv;
      roughImg.data[p4 + 3] = 255;
    }
  }
  colCtx.putImageData(colImg, 0, 0);
  roughCtx.putImageData(roughImg, 0, 0);

  // Sobel 3×3 ile gerçek Tangent-Space Normal Map üret
  const normCv = document.createElement('canvas'); normCv.width = S; normCv.height = S;
  const normCtx = normCv.getContext('2d');
  const normImg = normCtx.createImageData(S, S);
  const strength = 3.4;
  const at = (x, y) => height[((y + S) % S) * S + ((x + S) % S)];

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const tl = at(x - 1, y - 1), t = at(x, y - 1), tr = at(x + 1, y - 1);
      const l  = at(x - 1, y),                        r  = at(x + 1, y);
      const bl = at(x - 1, y + 1), b = at(x, y + 1), br = at(x + 1, y + 1);
      const dx = (tr + 2 * r + br) - (tl + 2 * l + bl);
      const dy = (bl + 2 * b + br) - (tl + 2 * t + tr);
      let nx = -dx * strength, ny = -dy * strength, nz = 1.0;
      const inv = 1 / Math.hypot(nx, ny, nz);
      nx *= inv; ny *= inv; nz *= inv;
      const p4 = (y * S + x) * 4;
      normImg.data[p4]     = Math.round((nx * 0.5 + 0.5) * 255);
      normImg.data[p4 + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      normImg.data[p4 + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      normImg.data[p4 + 3] = 255;
    }
  }
  normCtx.putImageData(normImg, 0, 0);

  const setup = (cv, isColor) => {
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
  return {
    map: setup(colCv, true),
    normalMap: setup(normCv, false),
    roughnessMap: setup(roughCv, false),
  };
}

/* Eskitilmiş dövme antik bronz PBR dokusu (sütun tepesindeki bronz plaka için) */
function createBronzePBR() {
  const S = 256;
  const colCv = document.createElement('canvas'); colCv.width = S; colCv.height = S;
  const cCtx = colCv.getContext('2d');
  const cImg = cCtx.createImageData(S, S);
  const rCv = document.createElement('canvas'); rCv.width = S; rCv.height = S;
  const rCtx = rCv.getContext('2d');
  const rImg = rCtx.createImageData(S, S);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const n1 = Math.sin(x * 0.14 + Math.cos(y * 0.11) * 2.2) * 0.5 + 0.5;
      const brush = Math.sin(x * 0.9 + y * 0.05) * 0.5 + 0.5;
      const patina = Math.sin(x * 0.07 - y * 0.09) * Math.cos(x * 0.05 + y * 0.08);
      const p4 = (y * S + x) * 4;
      let r = 128 + n1 * 34 + brush * 12;
      let g = 96 + n1 * 26 + brush * 9;
      let b = 62 + n1 * 18 + brush * 6;
      // Kenarlarda ve çukurlarda çok hafif deniz tuzu oksitlenmesi (verdigris)
      if (patina > 0.58) {
        const m = (patina - 0.58) * 1.4;
        r = r * (1 - m) + 72 * m;
        g = g * (1 - m) + 114 * m;
        b = b * (1 - m) + 104 * m;
      }
      cImg.data[p4] = Math.min(255, Math.round(r));
      cImg.data[p4 + 1] = Math.min(255, Math.round(g));
      cImg.data[p4 + 2] = Math.min(255, Math.round(b));
      cImg.data[p4 + 3] = 255;

      const rv = Math.min(235, Math.max(70, Math.round(105 + (1 - n1) * 55 + (patina > 0.58 ? 65 : 0))));
      rImg.data[p4] = rImg.data[p4 + 1] = rImg.data[p4 + 2] = rv;
      rImg.data[p4 + 3] = 255;
    }
  }
  cCtx.putImageData(cImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  const map = new THREE.CanvasTexture(colCv); map.wrapS = map.wrapT = THREE.RepeatWrapping; map.colorSpace = THREE.SRGBColorSpace;
  const roughnessMap = new THREE.CanvasTexture(rCv); roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  return { map, roughnessMap };
}

/* Sütunlara dünya-uzayı deniz yosunu, tuz kabuğu ve sudan çıkarken aşağı süzülen ıslaklık ekleyen shader */
function pillarWeatherShader(mat, uTime, { wetLine = true, uWetTop = null } = {}) {
  const wetUniform = uWetTop || { value: 3.4 };
  mat.userData.uWetTop = wetUniform;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.uniforms.uWetTop = mat.userData.uWetTop;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vLPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvLPos = transformed;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWPos;\nvarying vec3 vLPos;\nuniform float uTime;\nuniform float uWetTop;\n${NOISE_GLSL}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        // Her sütunu benzersiz yapan büyük ölçekli dünya-uzayı hava aşınması
        float macro = fbm(vWPos.xz * 0.14 + vWPos.y * 0.08);
        diffuseColor.rgb *= mix(0.84, 1.12, macro);
        ${wetLine ? `
        // Deniz suyu temas hattı + sudan çıkarken yivlerden aşağı süzülen dinamik ıslaklık
        float waveLine = 0.25 + sin(vWPos.x * 0.6 + uTime * 1.4) * 0.18 + (macro - 0.5) * 0.85;
        float dripStreaks = fbm(vec2(vWPos.x * 1.15 + vWPos.z * 0.9, vWPos.y * 0.22 + uTime * 0.45));
        float wetEdge = max(waveLine + 3.2, uWetTop + (dripStreaks - 0.5) * 3.8);
        float wet = 1.0 - smoothstep(wetEdge - 2.6, wetEdge + 0.6, vWPos.y);
        float moss = (1.0 - smoothstep(waveLine, waveLine + 2.1, vWPos.y)) * smoothstep(0.32, 0.72, fbm(vWPos.xz * 0.75 + vWPos.y * 0.5));
        float salt = smoothstep(waveLine + 1.4, waveLine + 2.4, vWPos.y) * (1.0 - smoothstep(waveLine + 2.4, waveLine + 3.8, vWPos.y)) * smoothstep(0.42, 0.76, macro);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.23, 0.17), moss * 0.58);
        diffuseColor.rgb *= mix(1.0, 0.54, wet);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.84, 0.79), salt * 0.28);` : ''}`);
    if (wetLine) {
      sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        float dripR = fbm(vec2(vWPos.x * 1.15 + vWPos.z * 0.9, vWPos.y * 0.22 + uTime * 0.45));
        float wetEdgeR = max(3.2, uWetTop + (dripR - 0.5) * 3.6);
        float wetR = 1.0 - smoothstep(wetEdgeR - 2.8, wetEdgeR + 0.5, vWPos.y);
        roughnessFactor = mix(roughnessFactor, 0.16, wetR);`);
    }
  };
  mat.customProgramCacheKey = () => 'pillarWeatherV2_' + wetLine;
  return mat;
}

function createFlutedShaftGeometry(rTop, rBot, height, flutes = 18) {
  const radialSegs = flutes * 4;
  const heightSegs = 22;
  const geo = new THREE.CylinderGeometry(rTop, rBot, height, radialSegs, heightSegs, false);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 0.01) continue;
    const ang = Math.atan2(z, x);
    // Sütun gövdesinin ortasında hafif klasik entasis (şişkinlik)
    const t = (y + height * 0.5) / height;
    const entasis = 1.0 + Math.sin(t * Math.PI) * 0.036;
    // Uçlarda yumuşayan 18 derin içbükey klasik yiv (fluting)
    const endFade = Math.min(1, t * 14) * Math.min(1, (1 - t) * 14);
    const fluteWave = Math.pow(Math.max(0, Math.cos(ang * flutes)), 1.65);
    const fluteCarve = fluteWave * 0.25 * endFade;
    // Doğal antik taş aşınması (kenarlarda hafif organik kırıklık)
    const wear = (Math.sin(ang * 5 + y * 0.45) * Math.cos(y * 0.85 - ang * 3)) * 0.032;
    const newR = r * entasis - fluteCarve + wear;
    const scale = newR / r;
    pos.setX(i, x * scale);
    pos.setZ(i, z * scale);
  }
  geo.computeVertexNormals();
  weldCylinderSeamNormals(geo, radialSegs, heightSegs + 1);
  return geo;
}

function createCapitalGeometry() {
  // Büyük klasik Akdeniz / Dorik başlık profili (boyun halkaları + genişleyen echinus)
  const pts = [
    new THREE.Vector2(2.55, 0.0),
    new THREE.Vector2(2.82, 0.26),
    new THREE.Vector2(2.64, 0.52),
    new THREE.Vector2(2.88, 0.78),
    new THREE.Vector2(3.22, 1.32),
    new THREE.Vector2(3.72, 1.98),
    new THREE.Vector2(3.92, 2.28),
    new THREE.Vector2(3.92, 2.42),
  ];
  const segs = 44;
  const g = new THREE.LatheGeometry(pts, segs);
  g.computeVertexNormals();
  // Dikiş çizgisindeki sert kırık gölgeyi tamamen yok et
  weldLatheSeamNormals(g, segs, pts.length);
  return g;
}

function createPlinthGeometry() {
  const pts = [
    new THREE.Vector2(4.45, 0.0),
    new THREE.Vector2(4.45, 1.15),
    new THREE.Vector2(4.05, 1.55),
    new THREE.Vector2(3.82, 2.25),
    new THREE.Vector2(3.42, 2.80),
    new THREE.Vector2(3.16, 3.15),
  ];
  const segs = 36;
  const g = new THREE.LatheGeometry(pts, segs);
  g.computeVertexNormals();
  weldLatheSeamNormals(g, segs, pts.length);
  return g;
}

function createFoamRingMaterial(uTime) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    uniforms: {
      uTime,
      uSurge: { value: 0 },     // yükselirken yoğunlaşan dalga köpüğü
      uBreach: { value: 0 },    // suyu ilk deldiğinde dışa doğru genişleyen dalga halkası (0 → 1)
      uVis: { value: 0 },       // sütun suya değince görünür
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uSurge, uBreach, uVis;
      varying vec2 vUv;
      ${NOISE_GLSL}
      void main(){
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        if (r > 1.0 || uVis < 0.01) discard;
        // Organik parçalı deniz köpüğü (düz beyaz disk yerine dantel gibi dağılan köpük dilleri)
        float n1 = fbm(p * 5.2 + vec2(uTime * 0.24, -uTime * 0.19));
        float n2 = fbm(p * 11.5 - vec2(uTime * 0.35, uTime * 0.28));
        float lace = smoothstep(0.36, 0.72, n1 * 0.65 + n2 * 0.45);
        float collar = smoothstep(0.44 + uSurge * 0.16, 0.22, r + (n1 - 0.5) * 0.22) * smoothstep(0.16, 0.24, r);
        float innerFoam = collar * (0.35 + 0.65 * lace);
        float ripple = smoothstep(0.045, 0.0, abs(fract(r * 2.4 - uTime * 0.38 + n1 * 0.18) - 0.5) - 0.44);
        float radialFade = (1.0 - smoothstep(0.32, 0.96, r)) * smoothstep(0.20, 0.28, r);
        // Suyu delme dalga halkası: 0.24'ten 0.96'ya doğru dışa yayılır ve yumuşakça sönümlenir
        float breachR = 0.24 + uBreach * 0.72;
        float breachFade = sin(clamp(uBreach, 0.0, 1.0) * 3.14159);
        float breachWave = smoothstep(0.085, 0.0, abs(r - breachR + (n1 - 0.5) * 0.09)) * breachFade * (0.55 + 0.45 * lace);
        float alpha = (innerFoam * 0.68 + ripple * radialFade * (0.24 + 0.25 * n2) + breachWave * 0.78) * uVis;
        vec3 col = mix(vec3(0.72, 0.88, 0.94), vec3(0.98, 0.99, 0.98), clamp(innerFoam + breachWave * 0.5, 0.0, 1.0));
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.84));
      }`
  });
}

function createHaloMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending,
    uniforms: { uGlow: { value: 0 } },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uGlow;
      varying vec2 vUv;
      void main(){
        if (uGlow < 0.005) discard;
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        if (r > 1.0) discard;
        // Doğal sıcak Akdeniz güneş halesi (krem-altın → yumuşak kehribar → saydam)
        float core = exp(-r * r * 5.0);
        float outer = pow(max(0.0, 1.0 - r), 2.4);
        vec3 col = mix(vec3(0.86, 0.66, 0.42), vec3(1.0, 0.95, 0.84), core);
        float a = (core * 0.65 + outer * 0.42) * uGlow;
        gl_FragColor = vec4(col, a);
      }`
  });
}

function createPillars(uTime, uPx, uNight, count = 6) {
  const group = new THREE.Group();
  group.visible = false;

  // Kamera bakış eksenine dik yerleşim (projeler kameranın tam karşısında, açık denizde)
  const fwd = new THREE.Vector3().subVectors(PROJ_CAM_LOOK, PROJ_CAM_POS).normalize();
  const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();

  // Gerçekçi PBR Traverten + Normal Map + Roughness Map + dünya-uzayı deniz yosunu/süzülen ıslaklık
  const travPBR = createTravertinePBR();
  travPBR.map.repeat.set(2.5, 2.2);
  travPBR.normalMap.repeat.set(2.5, 2.2);
  travPBR.roughnessMap.repeat.set(2.5, 2.2);

  const capMap = travPBR.map.clone(); capMap.needsUpdate = true; capMap.repeat.set(2, 0.8);
  const capNorm = travPBR.normalMap.clone(); capNorm.needsUpdate = true; capNorm.repeat.set(2, 0.8);
  const capRough = travPBR.roughnessMap.clone(); capRough.needsUpdate = true; capRough.repeat.set(2, 0.8);

  const makeShaftMat = () => pillarWeatherShader(
    new THREE.MeshStandardMaterial({
      color: 0xECE4D6,
      map: travPBR.map,
      normalMap: travPBR.normalMap,
      normalScale: new THREE.Vector2(1.55, 1.55),
      roughnessMap: travPBR.roughnessMap,
      roughness: 0.96,
      metalness: 0.03,
    }),
    uTime,
    { wetLine: true, uWetTop: { value: 20.0 } }
  );
  const makeCapMat = (wetUniform) => pillarWeatherShader(
    new THREE.MeshStandardMaterial({
      color: 0xF0E8DA,
      map: capMap,
      normalMap: capNorm,
      normalScale: new THREE.Vector2(1.25, 1.25),
      roughnessMap: capRough,
      roughness: 0.92,
      metalness: 0.04,
    }),
    uTime,
    { wetLine: true, uWetTop: wetUniform }
  );

  const bronzePBR = createBronzePBR();
  bronzePBR.map.repeat.set(2, 2);
  bronzePBR.roughnessMap.repeat.set(2, 2);
  const bronzeTrimMat = new THREE.MeshStandardMaterial({
    color: 0xC6A278,
    map: bronzePBR.map,
    roughnessMap: bronzePBR.roughnessMap,
    bumpMap: bronzePBR.roughnessMap,
    bumpScale: 0.04,
    roughness: 0.58,
    metalness: 0.72,
    emissive: new THREE.Color(0x8A6845),
    emissiveIntensity: 0.08
  });

  const shaftGeo = createFlutedShaftGeometry(2.55, 3.15, 28, 18);
  const capGeo = createCapitalGeometry();
  const abacusGeo = new THREE.BoxGeometry(8.3, 1.15, 8.3);
  const trimGeo = new THREE.BoxGeometry(8.5, 0.22, 8.5);
  const plinthGeo = createPlinthGeometry();
  const foamGeo = new THREE.PlaneGeometry(30, 30);
  foamGeo.rotateX(-Math.PI / 2);
  const haloGeo = new THREE.PlaneGeometry(28, 28);

  // Ortadan dışa simetrik "Tapınak / Amfitiyatro" koreografisi:
  // Projeler tam ekrana oturana kadar (p <= 0.22) sütunlar tamamen su altında gizli kalır;
  // ardından önce ortadaki 2 ana sütun (3-4), sonra yan çiftler (2-5), en son dış sütunlar (1-6) yükselir
  const layout = [
    { lateral: -33.0, dist: 56.0, topY: 12.6, startAt: 0.48, endAt: 0.88 },
    { lateral: -19.8, dist: 61.0, topY: 16.4, startAt: 0.36, endAt: 0.76 },
    { lateral:  -6.6, dist: 64.0, topY: 13.4, startAt: 0.24, endAt: 0.62 },
    { lateral:   6.6, dist: 64.0, topY: 16.8, startAt: 0.27, endAt: 0.65 },
    { lateral:  19.8, dist: 61.0, topY: 13.2, startAt: 0.39, endAt: 0.79 },
    { lateral:  33.0, dist: 56.0, topY: 15.8, startAt: 0.51, endAt: 0.91 },
  ];

  // Tek çizim çağrılı (GPU dostu) güneşli deniz spreyi & su damlacıkları sistemi
  const SPRAY_N = lowPower ? 90 : 260;
  const sprayPos = new Float32Array(SPRAY_N * 3);
  const sprayLife = new Float32Array(SPRAY_N);
  const spraySize = new Float32Array(SPRAY_N);
  const sprayVel = Array.from({ length: SPRAY_N }, () => ({ vx: 0, vy: 0, vz: 0, maxLife: 1 }));
  for (let i = 0; i < SPRAY_N; i++) sprayPos[i * 3 + 1] = -999;
  const sprayGeo = new THREE.BufferGeometry();
  sprayGeo.setAttribute('position', new THREE.BufferAttribute(sprayPos, 3));
  sprayGeo.setAttribute('aLife', new THREE.BufferAttribute(sprayLife, 1));
  sprayGeo.setAttribute('aSize', new THREE.BufferAttribute(spraySize, 1));
  const sprayMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false,
    uniforms: { uPx, uNight },
    vertexShader: /* glsl */`
      attribute float aLife, aSize;
      uniform float uPx;
      varying float vA;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        vA = clamp(aLife, 0.0, 1.0);
        gl_PointSize = clamp((aSize * uPx) / max(4.0, -mv.z), 1.5, 9.5) * step(0.01, vA);
      }`,
    fragmentShader: /* glsl */`
      uniform float uNight;
      varying float vA;
      void main(){
        if (vA < 0.01) discard;
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c) * 2.0;
        if (d > 1.0) discard;
        float soft = pow(1.0 - d, 1.8);
        vec3 col = mix(vec3(0.98, 0.99, 1.0), vec3(0.68, 0.80, 0.94), uNight);
        gl_FragColor = vec4(col, soft * vA * 0.78);
      }`
  });
  const sprayPts = new THREE.Points(sprayGeo, sprayMat);
  sprayPts.frustumCulled = false; sprayPts.renderOrder = 4;
  group.add(sprayPts);
  let sprayCursor = 0;

  function emitSpray(cx, cz, countToEmit, intensity) {
    for (let n = 0; n < countToEmit; n++) {
      const idx = sprayCursor;
      sprayCursor = (sprayCursor + 1) % SPRAY_N;
      const ang = Math.random() * Math.PI * 2;
      const rad = 2.7 + Math.random() * 1.4;
      sprayPos[idx * 3]     = cx + Math.cos(ang) * rad;
      sprayPos[idx * 3 + 1] = 0.25 + Math.random() * 1.1;
      sprayPos[idx * 3 + 2] = cz + Math.sin(ang) * rad;
      const outSpd = (1.6 + Math.random() * 3.8) * intensity;
      sprayVel[idx].vx = Math.cos(ang) * outSpd;
      sprayVel[idx].vy = (4.2 + Math.random() * 6.8) * intensity;
      sprayVel[idx].vz = Math.sin(ang) * outSpd;
      sprayVel[idx].maxLife = 0.65 + Math.random() * 0.65;
      sprayLife[idx] = 1.0;
      spraySize[idx] = 0.22 + Math.random() * 0.34;
    }
  }

  const items = [];
  for (let i = 0; i < count; i++) {
    const cfg = layout[i] || {
      lateral: (i - (count - 1) / 2) * 17,
      dist: 56,
      topY: 15.0,
      startAt: 0.15 + i * 0.08,
      endAt: 0.65 + i * 0.08
    };
    const baseXZ = new THREE.Vector3()
      .copy(PROJ_CAM_POS)
      .addScaledVector(fwd, cfg.dist)
      .addScaledVector(right, cfg.lateral);

    const col = new THREE.Group();
    col.position.set(baseXZ.x, -22, baseXZ.z);

    // Her sütun kendi süzülen ıslaklık çizgisine sahip (aynı derlenmiş shader'ı paylaşır)
    const shaftMat = makeShaftMat();
    const capMat = makeCapMat(shaftMat.userData.uWetTop);

    // Gövde: tepe noktası lokal y = 0 olacak şekilde hizalanır (topY = abacus üst yüzeyi)
    const abacus = new THREE.Mesh(abacusGeo, capMat);
    abacus.position.y = -0.575;
    abacus.castShadow = !lowPower; abacus.receiveShadow = true;

    const trim = new THREE.Mesh(trimGeo, bronzeTrimMat.clone());
    trim.position.y = -0.08;

    const capital = new THREE.Mesh(capGeo, capMat);
    capital.position.y = -3.57;
    capital.castShadow = !lowPower; capital.receiveShadow = true;

    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.position.y = -17.55;
    shaft.castShadow = !lowPower; shaft.receiveShadow = true;

    const plinth = new THREE.Mesh(plinthGeo, shaftMat);
    plinth.position.y = -32.6;

    // Başlığın arkasında, imleç üstüne gelince yanan doğal güneş ışığı halesi
    const haloMat = createHaloMaterial();
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.set(0, 5.2, 0);
    halo.renderOrder = 3;

    col.add(abacus, trim, capital, shaft, plinth, halo);
    group.add(col);

    // Su yüzeyinde (y = 0.24) dev sütunu saran köpük & genişleyen dalga halkası
    const foamMat = createFoamRingMaterial(uTime);
    const foam = new THREE.Mesh(foamGeo, foamMat);
    foam.position.set(baseXZ.x, 0.24, baseXZ.z);
    foam.renderOrder = 2;
    group.add(foam);

    items.push({
      col, trim, halo, haloMat, foam, foamMat,
      wetUniform: shaftMat.userData.uWetTop,
      topY: cfg.topY,
      startY: -20.0,
      startAt: cfg.startAt,
      endAt: cfg.endAt,
      curY: -20.0,
      prevY: -20.0,
      breachT: 0,
      wetTop: 20.0,
      glow: 0,
      topWorld: new THREE.Vector3(baseXZ.x, cfg.topY, baseXZ.z)
    });
  }

  // Hover'da sütun tepesini doğal güneş tonuyla aydınlatan hareketli nokta ışık
  const hoverLight = new THREE.PointLight(0xFFF0D4, 0, 42, 1.4);
  group.add(hoverLight);

  const _v = new THREE.Vector3();
  let wasProjActive = false;
  let wasBelowTrigger = true;
  function resetUnderwater() {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      it.curY = it.startY;
      it.prevY = it.startY;
      it.col.position.y = it.startY;
      it.topWorld.set(it.col.position.x, it.startY, it.col.position.z);
      it.breachT = 0;
      it.wetTop = it.topY + 2.0;
      it.wetUniform.value = it.wetTop;
      it.glow = 0;
      it.haloMat.uniforms.uGlow.value = 0;
      it.foamMat.uniforms.uVis.value = 0;
      it.foamMat.uniforms.uSurge.value = 0;
      it.foamMat.uniforms.uBreach.value = 0;
      it.trim.material.emissiveIntensity = 0.08;
    }
    hoverLight.intensity = 0;
    for (let i = 0; i < SPRAY_N; i++) {
      sprayLife[i] = 0;
      sprayPos[i * 3 + 1] = -999;
    }
    sprayGeo.attributes.position.needsUpdate = true;
    sprayGeo.attributes.aLife.needsUpdate = true;
  }

  function update(projProgress, hoveredIndex, time, dt, camera, nightBlend = 0) {
    const p = THREE.MathUtils.clamp(projProgress, 0, 1);
    // Hakkımda'dan çıkış sırasında (p <= 0.22) sütunları tamamen su altında sıfırla → geri gelince asla aradan parlamaz!
    const inProjects = p > 0.22;
    if (!inProjects && !wasBelowTrigger) {
      resetUnderwater();
      wasBelowTrigger = true;
    } else if (inProjects) {
      wasBelowTrigger = false;
    }

    // Projeler'e tam girmeden veya Blog gece gökyüzüne bakarken sütun grubunu gizle → sıfır çizim maliyeti
    const groupVisible = inProjects && nightBlend < 0.88;
    group.visible = groupVisible;
    if (!groupVisible) {
      if (wasProjActive && window.__onPillarProject) {
        wasProjActive = false;
        window.__onPillarProject([], 0);
      }
      return false;
    }

    const k = 1 - Math.exp(-dt * 6.5);
    const riseSmooth = 1 - Math.exp(-dt * 3.4); // ağır, anıtsal, yavaş taş yükselme hissi
    let activeLight = null;
    let moved = false;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const localT = THREE.MathUtils.clamp((p - it.startAt) / (it.endAt - it.startAt), 0, 1);
      const eased = localT * localT * (3 - 2 * localT);
      const settleBob = localT > 0.85 ? Math.sin(time * 0.75 + i * 1.4) * 0.10 * ((localT - 0.85) / 0.15) : 0;
      const targetY = THREE.MathUtils.lerp(it.startY, it.topY, eased) + settleBob;
      it.prevY = it.curY;
      it.curY += (targetY - it.curY) * riseSmooth;
      const dy = it.curY - it.prevY;
      const vel = Math.abs(dy) / Math.max(dt, 0.008);
      if (Math.abs(targetY - it.curY) > 0.015) moved = true;

      it.col.position.y = it.curY;
      it.topWorld.set(it.col.position.x, it.curY, it.col.position.z);

      // 1) Suyu delme anında dışa yayılan dalga halkası + güneşli su spreyi damlacıkları
      const emerged = THREE.MathUtils.clamp((it.curY + 2.5) / 6.0, 0, 1);
      if (it.curY < -3.0) {
        it.breachT = 0;
        it.wetTop = it.topY + 2.0;
      } else if (dy > 0.018 && it.curY > -2.0) {
        // Sütun yükselirken su yüzeyini yarıyor: dalga halkası genişler, damlacıklar fışkırır
        it.breachT = Math.min(1, it.breachT + dt * 0.65);
        const sprayChance = Math.min(1, vel * 0.12);
        if (Math.random() < sprayChance) {
          emitSpray(it.col.position.x, it.col.position.z, lowPower ? 2 : 5, THREE.MathUtils.clamp(0.75 + vel * 0.05, 0.75, 1.35));
        }
        // Sütun hâlâ su altından çıkarken tepesine kadar ıslak parlar
        it.wetTop = Math.max(it.wetTop, Math.min(it.topY + 1.5, it.curY + 1.2));
      } else {
        // Yükselme yavaşlayıp sütun yerine oturunca ıslaklık yivlerden aşağıya doğru doğalca süzülür/kurur
        if (it.breachT > 0 && it.breachT < 1) it.breachT = Math.min(1, it.breachT + dt * 0.75);
        it.wetTop += (3.4 - it.wetTop) * (1 - Math.exp(-dt * 0.62));
      }
      it.wetUniform.value = it.wetTop;
      it.foamMat.uniforms.uVis.value = emerged * (inProjects ? 1 : 0);
      it.foamMat.uniforms.uSurge.value = THREE.MathUtils.clamp(vel * 0.10 + Math.sin(localT * Math.PI) * 0.85, 0, 1);
      it.foamMat.uniforms.uBreach.value = it.breachT;

      // Hover doğal güneş ışığı halesi
      const targetGlow = i === hoveredIndex && localT > 0.55 ? 1 : 0;
      it.glow += (targetGlow - it.glow) * k;
      it.haloMat.uniforms.uGlow.value = it.glow;
      it.halo.quaternion.copy(camera.quaternion);
      it.trim.material.emissiveIntensity = 0.08 + it.glow * 1.45;
      if (it.glow > 0.02) activeLight = it;
    }

    // Su spreyi damlacıklarını yerçekimiyle güncelle
    let sprayDirty = false;
    for (let i = 0; i < SPRAY_N; i++) {
      if (sprayLife[i] <= 0) continue;
      sprayDirty = true;
      const v = sprayVel[i];
      v.vy -= 14.5 * dt; // yerçekimi
      sprayPos[i * 3]     += v.vx * dt;
      sprayPos[i * 3 + 1] += v.vy * dt;
      sprayPos[i * 3 + 2] += v.vz * dt;
      sprayLife[i] -= dt / v.maxLife;
      if (sprayPos[i * 3 + 1] < 0.15 || sprayLife[i] <= 0) {
        sprayLife[i] = 0;
        sprayPos[i * 3 + 1] = -999;
      }
    }
    if (sprayDirty) {
      sprayGeo.attributes.position.needsUpdate = true;
      sprayGeo.attributes.aLife.needsUpdate = true;
      sprayGeo.attributes.aSize.needsUpdate = true;
    }

    if (activeLight) {
      hoverLight.position.set(activeLight.topWorld.x, activeLight.topWorld.y + 5.0, activeLight.topWorld.z + 4.0);
      hoverLight.intensity = activeLight.glow * 32;
    } else {
      hoverLight.intensity += (0 - hoverLight.intensity) * k;
    }

    // 3B sütun tepelerinin 2B ekran koordinatlarını js/projects.js'e ilet
    const active = inProjects;
    if (window.__onPillarProject && (active || wasProjActive)) {
      wasProjActive = active;
      const cr = canvas.getBoundingClientRect();
      const coords = items.map((it, idx) => {
        _v.copy(it.topWorld);
        _v.y += 0.9; // büyük başlık abaküsünün hemen üstü
        _v.project(camera);
        // Kartın görünürlüğü sütunun gerçek yükselmesine bağlı; geceye geçerken (kamera yukarı kalkarken) yumuşakça söner
        const nightFade = THREE.MathUtils.clamp(1 - (nightBlend - 0.04) / 0.28, 0, 1);
        const actualProg = THREE.MathUtils.clamp((it.curY - 1.5) / (it.topY - 1.5), 0, 1) * nightFade;
        return {
          x: cr.left + (_v.x * 0.5 + 0.5) * cr.width,
          y: cr.top + (-_v.y * 0.5 + 0.5) * cr.height,
          progress: actualProg,
          visible: _v.z < 1,
          index: idx
        };
      });
      window.__onPillarProject(coords, p);
    }
    return moved;
  }

  return { group, update };
}

/* ---------------------------------------------------------
   Kurulum
   --------------------------------------------------------- */
async function build() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPower, alpha: false, powerPreference: 'high-performance' });
  const dpr = Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 1.5);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = !lowPower;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // Gölge haritasını her karede gereksiz yeniden çizme: yalnızca ilk karede ve sütunlar hareket ederken güncelle (GPU ~%35 rahatlar)
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  const scene = new THREE.Scene();
  const FOG_DAY = COL.fog.clone();
  const FOG_NIGHT = new THREE.Color('#0B1626');
  const SUN_NIGHT = new THREE.Color('#9BBEE6');
  const HEMI_SKY_DAY = new THREE.Color(0xA9CBEA);
  const HEMI_SKY_NIGHT = new THREE.Color(0x1B3152);
  const HEMI_GND_DAY = new THREE.Color(0x8A7558);
  const HEMI_GND_NIGHT = new THREE.Color(0x0E1620);

  scene.fog = new THREE.FogExp2(COL.fog, 0.0012);
  const camera = new THREE.PerspectiveCamera(47.52, 16 / 9, 0.5, 4000);
  const uTime = { value: 0 }, uPx = { value: 1 }, uNight = { value: 0 };

  // Işıklar: Blender'daki güneşle aynı yön (Blog'a geçince gece ay ışığına döner)
  const hemi = new THREE.HemisphereLight(0xA9CBEA, 0x8A7558, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(COL.sun, 3.0);
  sun.position.copy(SUN_DIR).multiplyScalar(160).add(new THREE.Vector3(-20, 0, 20));
  sun.target.position.set(-20, 0, 20);
  scene.add(sun, sun.target);
  if (!lowPower) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const s = sun.shadow.camera; s.left = -75; s.right = 75; s.top = 75; s.bottom = -75; s.near = 20; s.far = 400;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.06;
  }

  scene.add(createSky(uTime, uNight));
  const nightSky = createNightSky(uTime, uPx, uNight);
  scene.add(nightSky.group);
  scene.add(createSea(uTime, uNight));

  // Model, bulut dokusu ve camera.json'ı birlikte yükle
  const draco = new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/');
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const [gltf, cloudTex, data] = await Promise.all([
    loader.loadAsync(`${BASE}scene.glb?v=${VERSION}`),
    new THREE.TextureLoader().loadAsync(`${BASE}cloud.webp?v=${VERSION}`),
    fetch(`${BASE}camera.json?v=1`).then((r) => r.json()),
  ]);
  draco.dispose();

  const farRidgeMat = createMountainMaterial(uTime, uNight, { far: false });
  const farHazeMat = createMountainMaterial(uTime, uNight, { far: true });

  const model = gltf.scene;
  const junk = [];
  model.traverse((o) => {
    if (!o.isMesh) return;
    if (/MCP_TEST|Cube/i.test(o.name)) { junk.push(o); return; }
    // Uzak dağ sıralarına gerçekçi Toros/Akdeniz dağ shader'ı ata
    const firstMat = Array.isArray(o.material) ? o.material[0] : o.material;
    const matName = (firstMat && firstMat.name) || '';
    if (matName === 'WEB_FarRidge' || /Distant_Mountain_Range/i.test(o.name)) {
      o.material = farRidgeMat;
      o.castShadow = false; o.receiveShadow = false;
      return;
    }
    if (matName === 'WEB_FarHaze' || /Far_Haze_Ridge/i.test(o.name)) {
      o.material = farHazeMat;
      o.castShadow = false; o.receiveShadow = false;
      return;
    }
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      const n = m.name || '';
      if (n.startsWith('WEB_Limestone')) stoneMaterial(m, uTime, { scale: 0.32, amount: 0.3, dapple: true });
      else if (n === 'WEB_Bedding') stoneMaterial(m, uTime, { scale: 0.5, amount: 0.35 });
      else if (n === 'WEB_IslandRock') { m.color.setRGB(0.46, 0.38, 0.27); stoneMaterial(m, uTime, { scale: 0.18, amount: 0.4 }); }   // render'daki kumlu adacık rengi
      else if (n === 'WEB_Mountainside') cliffMaterial(m, uTime);
      else if (n === 'WEB_CypressLeaves') leafMaterial(m, uTime);
    }
    const isTree = /Cypress/i.test(o.name);
    o.castShadow = isTree || /Mountainside/i.test(o.name);
    o.receiveShadow = !/Ridge_V2|Haze|Distant/i.test(o.name);
  });
  junk.forEach((o) => o.parent.remove(o));
  scene.add(model);

  const clouds = createClouds(cloudTex);
  clouds.forEach((c) => { c.userData.op0 = c.material.opacity; scene.add(c); });

  const life = createLife(data, uTime, uPx);
  scene.add(life.group);

  const projectCount = (window.DATA && Array.isArray(window.DATA.projects) && window.DATA.projects.length) || 6;
  const pillars = createPillars(uTime, uPx, uNight, projectCount);
  const desktopMq = window.matchMedia('(min-width: 900px)');
  pillars.group.visible = false;
  desktopMq.addEventListener('change', (e) => { if (!e.matches) pillars.group.visible = false; });
  scene.add(pillars.group);

  // Görsel kutusu ekrandan geniş olabilir (telefonda dikey ekranda ~4 kat).
  // Yalnızca ekranda görünen dilimi çiz: kamera tam kareyi görür, setViewOffset görünen parçayı keser.
  let lastResizeW = 0, lastResizeH = 0;
  function resize(force = false) {
    const fw = Math.max(1, frameBox.clientWidth), h = Math.max(1, frameBox.clientHeight);
    // Telefonda adres çubuğu gizlenip açılınca küçük yükseklik değişiminde GPU tamponunu yeniden kurma
    if (!force && lowPower && fw === lastResizeW && Math.abs(h - lastResizeH) < 90) return;
    lastResizeW = fw; lastResizeH = h;
    const r = frameBox.getBoundingClientRect();
    const s = r.width / fw || 1;
    const vw = document.documentElement.clientWidth || window.innerWidth;
    let x0 = Math.max(0, Math.floor(-r.left / s - 16));
    let x1 = Math.min(fw, Math.ceil((vw - r.left) / s + 16));
    if (x1 - x0 < 2) { x0 = 0; x1 = fw; }
    const w = x1 - x0;
    canvas.style.left = x0 + 'px'; canvas.style.right = 'auto'; canvas.style.width = w + 'px';
    renderer.setSize(w, h, false);
    camera.aspect = fw / h;
    camera.setViewOffset(fw, h, x0, 0, w, h);
    camera.updateProjectionMatrix();
    uPx.value = (h * dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  }
  resize(true);

  // Fareyle hafif bakınma (en fazla ~3°)
  const look = { x: 0, y: 0, tx: 0, ty: 0 };
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    window.addEventListener('pointermove', (e) => {
      look.tx = (e.clientX / window.innerWidth - 0.5) * -0.1;
      look.ty = (e.clientY / window.innerHeight - 0.5) * -0.05;
    }, { passive: true });
  }

  const _p = new THREE.Vector3(), _l = new THREE.Vector3();
  let smoothCamT = 0;
  let smoothBlogCamT = 0;
  let smoothNightT = 0;
  function render(progress, projProgress, blogProgress, forceNight, hoveredIndex, time, dt) {
    uTime.value = time;
    const u = THREE.MathUtils.clamp(progress, 0, 1);
    const pj = THREE.MathUtils.clamp(projProgress, 0, 1);
    const bl = THREE.MathUtils.clamp(blogProgress, 0, 1);

    // 1) Projeler: kamera sakin ve ağır hızla terastan açık denize süzülür
    const camTarget = THREE.MathUtils.clamp(pj / 0.36, 0, 1);
    smoothCamT += (camTarget - smoothCamT) * (1 - Math.exp(-dt * 2.6));
    const pjEase = smoothCamT * smoothCamT * (3 - 2 * smoothCamT);

    // 2) Blog kamera açısı (yukarı yıldızlara bakış) yalnızca blogProgress'e bağlıdır
    smoothBlogCamT += (bl - smoothBlogCamT) * (1 - Math.exp(-dt * 3.8));
    const blEase = smoothBlogCamT * smoothBlogCamT * (3 - 2 * smoothBlogCamT);

    // 3) Gece atmosferi: Blog'a gelince otomatik VEYA Workbench düğmesine basınca Hakkımda ve sonrası tamamen gece olur
    const nightTarget = forceNight ? 1 : bl;
    smoothNightT += (nightTarget - smoothNightT) * (1 - Math.exp(-dt * 2.8));
    const nightEase = smoothNightT * smoothNightT * (3 - 2 * smoothNightT);
    uNight.value = nightEase;

    // Gündüz → gece ışık, sis ve bulut geçişi
    scene.fog.color.copy(FOG_DAY).lerp(FOG_NIGHT, nightEase);
    sun.color.copy(COL.sun).lerp(SUN_NIGHT, nightEase);
    sun.intensity = THREE.MathUtils.lerp(3.0, 0.72, nightEase);
    hemi.color.copy(HEMI_SKY_DAY).lerp(HEMI_SKY_NIGHT, nightEase);
    hemi.groundColor.copy(HEMI_GND_DAY).lerp(HEMI_GND_NIGHT, nightEase);
    hemi.intensity = THREE.MathUtils.lerp(1.15, 0.44, nightEase);

    PATH.getPointAt(u, _p); LOOK.getPointAt(u, _l);
    if (pjEase > 0.0001) {
      _p.lerp(PROJ_CAM_POS, pjEase);
      _l.lerp(PROJ_CAM_LOOK, pjEase);
    }
    if (blEase > 0.0001) {
      _p.lerp(BLOG_CAM_POS, blEase);
      _l.lerp(BLOG_CAM_LOOK, blEase);
    }
    // hafif nefes alma hareketi: kamera tamamen durmuş hissettirmesin
    _p.y += Math.sin(time * 0.5) * 0.12; _p.x += Math.sin(time * 0.31) * 0.1;
    camera.position.copy(_p); camera.lookAt(_l);
    const k = 1 - Math.exp(-dt * 3);
    look.x += (look.tx - look.x) * k; look.y += (look.ty - look.y) * k;
    camera.rotateY(look.x); camera.rotateX(look.y);
    camera.updateMatrixWorld();

    for (const c of clouds) {
      c.position.x = c.userData.x0 + time * 0.6;
      c.quaternion.copy(camera.quaternion);
      c.material.opacity = (c.userData.op0 ?? 1) * THREE.MathUtils.lerp(1.0, 0.24, nightEase);
      c.material.color.setScalar(THREE.MathUtils.lerp(1.35, 0.42, nightEase));
    }
    // Doğal sinematik pozlama: açık denizde (Projeler) hafif daha canlı, gece gökyüzünde dengeli
    renderer.toneMappingExposure = THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(1.25, 1.32, pjEase),
      1.20,
      nightEase
    );

    life.update(time);
    nightSky.update(camera, time, nightEase);
    // Sütunların gizlenmesi yalnızca kamera Blog gökyüzüne kalkarken (blEase) olur; mobilde 2B kaide kullanıldığı için 3B sütun çizilmez
    const pillarsMoved = desktopMq.matches ? pillars.update(pj, hoveredIndex, time, dt, camera, blEase) : false;
    if (!lowPower && pillarsMoved) renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
  }

  // Gölgeleri ve shader'ları ilk görünmeden önce derle (ilk karede takılmasın)
  render(0, 0, 0, false, -1, 0, 0.016);
  if (renderer.compileAsync) await renderer.compileAsync(scene, camera);

  return { render, resize, renderer };
}

/* ---------------------------------------------------------
   Kaydırma ↔ kamera, çizim döngüsü
   --------------------------------------------------------- */
function init() {
  if (reduce || !sceneEl || !frameBox || !canvas || !window.gsap) return;
  if (seqCv) seqCv.style.display = 'none';          // eski kare oynatıcı artık yok

  // Kamera ilerlemesi js/about-scene.js'ten gelir: Hakkımda (0→1), Projeler sütun yükselmesi (0→1), Blog gece gökyüzü (0→1).
  let progress = window.__aboutCamProgress ? window.__aboutCamProgress() : 0;
  let projProgress = window.__projectsCamProgress ? window.__projectsCamProgress() : 0;
  let blogProgress = window.__blogCamProgress ? window.__blogCamProgress() : 0;
  let forceNight = Boolean(window.__workbenchNight);
  let hoveredIndex = -1;
  window.__aboutCam = (p) => { progress = p; };
  window.__projectsCam = (p) => { projProgress = p; };
  window.__blogCam = (p) => { blogProgress = p; };
  window.__setWorkbenchNight = (on) => { forceNight = Boolean(on); };
  window.__projectsHover = (idx) => { hoveredIndex = typeof idx === 'number' ? idx : -1; };

  let app = null, loading = false;
  function load() {
    if (loading) return; loading = true;
    build().then((a) => {
      app = a;
      canvas.style.transition = 'opacity .6s ease';
      canvas.style.opacity = '1';
      if (posterImg) setTimeout(() => { posterImg.style.visibility = 'hidden'; }, 700);   // render görseli artık gerekmiyor
    }).catch((e) => {
      console.warn('[about-3d] canlı sahne yüklenemedi, statik görsel kalıyor:', e);
      if (window.__fallback2DPillars) window.__fallback2DPillars();
    });
  }
  // Tünelin sonuna ~1.1 ekran kala yüklemeye başla (tünel başında/ortasında CPU-GPU takılması yapmasın)
  const io = new IntersectionObserver((ents) => {
    if (ents.some((e) => e.isIntersecting)) { load(); io.disconnect(); }
  }, { rootMargin: '110% 0px 110% 0px' });
  io.observe(about);
  const projectsEl = document.getElementById('projects');
  if (projectsEl) io.observe(projectsEl);
  const blogEl = document.getElementById('blog');
  if (blogEl) io.observe(blogEl);

  // Çizim: gsap.ticker (Lenis ile aynı saat). Sahne görünmüyorsa (js/portal.js .is-on) çizmez.
  // Telefonda saniyede ~30 kare yeterli.
  const visible = () => sceneEl.classList.contains('is-on') && !document.hidden;
  const minStep = lowPower ? 1 / 31 : 0;
  let time = 0, acc = 0;
  gsap.ticker.add((t, deltaMs) => {
    if (!app || !visible()) return;
    const dt = Math.min(deltaMs / 1000, 0.05);
    time += dt; acc += dt;
    if (acc < minStep) return;
    app.render(progress, projProgress, blogProgress, forceNight, hoveredIndex, time, acc); acc = 0;
  });
  window.addEventListener('resize', () => { if (app) app.resize(); });

  // Test için küçük tutamak
  window.about3d = {
    get progress() { return progress; },
    setProgress(p) { progress = p; },
    get projProgress() { return projProgress; },
    setProjProgress(p) { projProgress = p; },
    get blogProgress() { return blogProgress; },
    setBlogProgress(p) { blogProgress = p; },
    get ready() { return !!app; },
    load
  };
}

init();
