/* =========================================================
   PORTAL — Tünel sonu → Hakkımda sahnesi geçişi
   ---------------------------------------------------------
   Her şey KAYDIRMAYA bağlı (scrub): ileri kaydırınca oynar,
   geri kaydırınca aynı yoldan tersine döner. Zamanlayıcı yok.

   Tünel ilerlemesi pt (0 → 1), fiber-tunnel.js ile aynı formül:
     0.66–0.72  kod satırı söner
     0.70–0.78  "SAHADAN → KODA" belirir
     0.84–0.90  yazı küçülüp kaybolur, yerinde portal halkası açılır
     0.92–0.985 portal büyür: kameranın içinden geçer (kamera da hızlanır)
     0.955–0.998 tek seferlik parlama (en fazla 0.85 opaklık)
     0.968–0.978 parlamanın altında fiber sahne söner, Hakkımda sahnesi belirir
   Hakkımda bölümünden çıkarken sahne söner (siyaha döner).

   Sadece transform ve opacity değişir (sayfa yerleşimi yeniden hesaplanmaz).
   ========================================================= */
(function () {
  const tunnel = document.getElementById('tunnel');
  const about = document.getElementById('about');
  const projects = document.getElementById('projects');
  const blog = document.getElementById('blog');
  if (!tunnel || !about) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stage = document.getElementById('fiberStage');                // fiber sahnenin tuvali
  const endEl = tunnel.querySelector('.tunnel__end');
  const codeEl = tunnel.querySelector('.tunnel__code');
  const hud = tunnel.querySelector('.tunnel__hud');
  const portal = tunnel.querySelector('.tunnel__portal');
  const flash = tunnel.querySelector('.tunnel__flash');
  const scene = document.querySelector('.about__scene');              // #about'un hemen önünde, ekrana sabit
  const shade = scene && scene.querySelector('.about__shade');

  // Yardımcılar
  const clamp = (x) => Math.min(1, Math.max(0, x));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

  /* Ölçüler önbellekte: her kaydırmada offsetTop/offsetHeight/getBoundingClientRect okunmaz.
     Pencere boyutu değişince ya da ScrollTrigger yeniden hesaplayınca (pin aralığı değişir) güncellenir. */
  const L = { ih: 1, tTop: 0, span: 1, zoneStart: 0, aboutEnd: Infinity, sceneEnd: Infinity };
  function measure() {
    L.ih = window.innerHeight;
    L.tTop = tunnel.offsetTop;
    L.span = Math.max(1, tunnel.offsetHeight - L.ih);
    const pin = window.ScrollTrigger && ScrollTrigger.getById('about-pin');
    L.aboutEnd = pin ? pin.end : about.offsetTop + about.offsetHeight - L.ih;
    // Canlı 3B sahne Hakkımda (gündüz) → Projeler (deniz sütunları) → Blog (gece yıldızlı gökyüzü) boyunca açık kalır
    const lastEl = blog || projects;
    L.sceneEnd = lastEl ? lastEl.offsetTop + lastEl.offsetHeight - L.ih * 0.45 : L.aboutEnd;
    L.zoneStart = L.tTop - L.ih;                                         // tünel ekrana girmeden önce
  }

  let lastZone = null;
  function apply() {
    const y = window.scrollY;
    // Tünel, Hakkımda ve Projeler'in dışındaysak hesaplama yapma (sınırı bir kez uygulayıp dur)
    const zone = y < L.zoneStart ? 'once' : y > L.sceneEnd + L.ih ? 'sonra' : 'icinde';
    if (zone !== 'icinde' && zone === lastZone) return;
    lastZone = zone;

    const ih = L.ih;
    const pt = clamp((y - L.tTop) / L.span);

    // 1) Kod satırı ve HUD sönerek sahneyi portala bırakır
    if (codeEl) codeEl.style.opacity = String(1 - smooth(0.66, 0.72, pt));
    if (hud) hud.style.opacity = String(1 - smooth(0.86, 0.92, pt));

    // 2) "SAHADAN → KODA": belirir, sonra küçülüp kaybolur
    const textIn = smooth(0.70, 0.78, pt);
    const textOut = smooth(0.84, 0.90, pt);
    if (endEl) {
      endEl.style.opacity = String(textIn * (1 - textOut));
      endEl.style.transform = reduce ? 'none' : `scale(${1 - 0.6 * textOut})`;
    }

    // 3) Portal halkası: açılır, sonra kameranın içinden geçecek kadar büyür (GPU taşmasın diye 5.5x ile sınırlı)
    if (portal) {
      const open = smooth(0.84, 0.92, pt);
      const dive = smooth(0.92, 0.985, pt);
      const scale = reduce ? 1 : open * (1 + dive * dive * 4.5);
      portal.style.opacity = String(open * (1 - smooth(0.96, 0.985, pt)));
      portal.style.transform = `scale(${scale.toFixed(3)})`;
    }

    // 4) Parlama: tek sefer, en fazla 0.85 (hareketi azaltta hiç yok)
    if (flash) {
      const f = reduce ? 0 : smooth(0.955, 0.975, pt) * (1 - smooth(0.975, 0.998, pt)) * 0.85;
      flash.style.opacity = f.toFixed(3);
    }

    // 5) Fiber sahne parlamanın altında söner
    if (stage) stage.style.opacity = String(1 - smooth(reduce ? 0.9 : 0.95, reduce ? 1 : 0.975, pt));

    // 6) Hakkımda + Projeler deniz sahnesi: parlama sönerken görünür; Projeler bitince siyaha döner
    if (scene) {
      const exit = smooth(0, 0.75, (y - L.sceneEnd) / ih);               // Projeler bittikten sonraki 0.75 ekran
      const enter = reduce ? smooth(0.9, 1, pt) : smooth(0.968, 0.978, pt);
      const o = enter * (1 - exit);
      const on = o > 0.001;
      scene.style.opacity = o.toFixed(3);
      scene.style.visibility = on ? 'visible' : 'hidden';             // görünmüyorsa hiç çizilmesin
      scene.classList.toggle('is-on', on);                             // will-change ve canlı katman bununla açılır
      // Hakkımda'nın sağ taraf gölgesi son yazı slaytından sonraki geçiş alanında sakinçe kalkar
      if (shade) {
        const shadeFade = smooth(-0.65, 0.1, (y - L.aboutEnd) / ih);
        shade.style.opacity = (1 - shadeFade).toFixed(3);
      }
    }
  }

  // Kaydırmada kare başına en fazla bir kez hesapla
  let queued = false;
  function onScroll() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; apply(); });
  }
  function remeasure() { measure(); lastZone = null; apply(); }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', remeasure);
  if (window.ScrollTrigger) ScrollTrigger.addEventListener('refresh', remeasure);
  window.addEventListener('load', remeasure);
  // Gizli sekmede requestAnimationFrame durur; ilk durumu hemen uygula
  remeasure();

  // Test için küçük tutamak
  window.portalTransition = { apply: () => { lastZone = null; apply(); }, measure: remeasure };
})();
