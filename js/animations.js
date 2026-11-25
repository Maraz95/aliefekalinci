/* =========================================================
   ANIMATIONS — tüm scroll animasyonları burada
   Kütüphaneler: GSAP + ScrollTrigger (animasyon), Lenis (yumuşak kaydırma)
   ========================================================= */
(function () {
  gsap.registerPlugin(ScrollTrigger);
  // Telefonda adres çubuğu gizlenip açılınca bütün tetikleyiciler yeniden hesaplanmasın (takılmayı önler)
  ScrollTrigger.config({ ignoreMobileResize: true });

  // Kullanıcı "hareketi azalt" ayarını açtıysa animasyonları sadeleştir
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const touchOnly = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  /* ---------- Yardımcılar: metni harf / kelime parçalarına böl ---------- */
  function splitChars(el) {
    const text = el.textContent.trim();
    el.setAttribute('aria-label', text);
    // Harfler tek tek bölününce tarayıcı Türkçe büyük harf kuralını (i → İ) uygulayamıyor;
    // başlık büyük harfle gösteriliyorsa dönüşümü burada Türkçeye göre biz yapıyoruz.
    const upper = getComputedStyle(el).textTransform === 'uppercase';
    const shown = upper ? text.toLocaleUpperCase('tr-TR') : text;
    el.textContent = '';
    [...shown].forEach((ch) => {
      const s = document.createElement('span');
      s.className = 'char';
      s.setAttribute('aria-hidden', 'true');
      s.textContent = ch === ' ' ? ' ' : ch;
      el.appendChild(s);
    });
    return el.querySelectorAll('.char');
  }
  function splitWords(el) {
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    words.forEach((w, i) => {
      const s = document.createElement('span');
      s.className = 'word';
      s.textContent = w;
      el.appendChild(s);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
    return el.querySelectorAll('.word');
  }

  /* ---------- 1) Lenis: yumuşak kaydırma (masaüstünde; dokunmatik telefonda doğal iOS/Android kaydırma) ---------- */
  let lenis = null;
  if (!reduce && !touchOnly && typeof Lenis !== 'undefined') {
    // lerp 0.1: 0.08 ile karşılaştırıldı; 0.1 daha pürüzsüz ve daha çabuk duruyor (ölçüm: kaydırma oynaması 0.11 / 0.14)
    lenis = new Lenis({ lerp: 0.1 });
    window.lenis = lenis;   // galeri görüntüleyicisi açıkken kaydırmayı durdurabilsin (js/galeri.js)
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop(); // loader bitene kadar kaydırma kapalı
  }

  /* ---------- 1b) Mobil çekmece menü (≤ 768px) ---------- */
  const headerNav = document.querySelector('header.nav');
  const navBurger = document.getElementById('navBurger');
  const navLinksEl = document.getElementById('navLinks');
  let setMobileNav = () => {};
  if (headerNav && navBurger && navLinksEl) {
    let navOpen = false;
    setMobileNav = (open) => {
      navOpen = Boolean(open);
      headerNav.classList.toggle('is-open', navOpen);
      document.body.classList.toggle('nav-open', navOpen);
      navBurger.setAttribute('aria-expanded', String(navOpen));
      const isEn = document.documentElement.lang === 'en';
      navBurger.setAttribute('aria-label', navOpen
        ? (isEn ? 'Close menu' : 'Menüyü kapat')
        : (isEn ? 'Open menu' : 'Menüyü aç'));
      if (lenis) { if (navOpen) lenis.stop(); else if (!document.body.classList.contains('is-loading')) lenis.start(); }
    };
    navBurger.addEventListener('click', () => setMobileNav(!navOpen));
    navLinksEl.addEventListener('click', (e) => {
      if (e.target === navLinksEl) setMobileNav(false);
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navOpen) { setMobileNav(false); navBurger.focus(); }
    });
    window.addEventListener('resize', () => {
      if (navOpen && window.innerWidth > 768) setMobileNav(false);
    });
  }

  // Menü linkleri: yumuşak kaydırma ile bölüme git (#projects için sütunların yükseldiği konuma iner)
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href');
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      setMobileNav(false);
      let dest = target;
      if (href === '#projects' && !reduce) {
        dest = Math.max(target.offsetTop, target.offsetTop + target.offsetHeight - window.innerHeight);
      } else if (href === '#hero') {
        dest = 0;
      } else if (window.innerWidth <= 768 && headerNav) {
        dest = Math.max(0, target.getBoundingClientRect().top + window.scrollY - headerNav.offsetHeight);
      }
      if (lenis) lenis.scrollTo(dest, { duration: 1.4 });
      else if (typeof dest === 'number') window.scrollTo({ top: dest, behavior: reduce ? 'auto' : 'smooth' });
      else dest.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    });
  });

  /* ---------- 2) Hero harflerini hazırla (loader arkasında gizli bekler) ---------- */
  const heroChars = [];
  document.querySelectorAll('.hero [data-split]').forEach((el) => heroChars.push(...splitChars(el)));
  if (!reduce) {
    gsap.set(heroChars, { yPercent: 110 });                       // harfler satırın altında saklı
    gsap.set(['.hero__tag', '.hero__cta', '.hero__scroll', '.nav', '.hero__plus'], { opacity: 0, y: 20 });
    gsap.set('.idcard', { opacity: 0, y: 40 });                  // kimlik kartı aşağıdan gelecek
  }

  /* ---------- 3) Loader: Pano boot + tek hat şeması + osiloskop + yıldırım çarpması ile açılış ---------- */
  function runLoader() {
    const loader = document.getElementById('loader');
    const surface = document.getElementById('loaderSurface');
    const flashEl = document.getElementById('loaderFlash');
    const shockEl = document.getElementById('loaderShockwave');
    const countEl = document.getElementById('loaderCount');
    const countWrap = document.getElementById('loaderCountWrap');
    const bar = document.getElementById('loaderBar');
    const sparkDot = document.getElementById('loaderSpark');
    const logEl = document.getElementById('loaderLog');
    const ledEl = document.getElementById('loaderLed');
    const voltEl = document.getElementById('loaderVolt');
    const freqEl = document.getElementById('loaderFreq');
    const ampEl = document.getElementById('loaderAmp');
    const stateEl = document.getElementById('loaderState');
    const circuitPath = document.getElementById('loaderCircuitPath');
    const nodes = [...document.querySelectorAll('.lc__node')];
    const checks = [...document.querySelectorAll('#loaderChecks li')];
    const scopeCanvas = document.getElementById('loaderScope');
    const fxCanvas = document.getElementById('loaderFx');

    const logs = ['Sistem başlatılıyor…', 'Pano kontrol ediliyor…', 'Hatlar test ediliyor…', 'Kod derleniyor…', 'Hazır.'];
    const states = ['BEKLEMEDE', 'ENERJİLENİYOR', 'SENKRONİZE', 'DEVRE KAPALI'];
    const counter = { v: 0 };

    // Tek hat şeması çizgi uzunluğunu hazırla
    let circuitLen = 404;
    if (circuitPath && circuitPath.getTotalLength) {
      circuitLen = circuitPath.getTotalLength();
      circuitPath.style.strokeDasharray = circuitLen;
      circuitPath.style.strokeDashoffset = circuitLen;
    }

    // Osiloskop & yüksek gerilim yıldırım/ark canvas kurulumu (hareket azaltma açıksa devre dışı)
    let rafId = 0;
    let phase = 0;
    const sparks = [];
    const preArcs = [];     // %84–99 arası ön gerilim kıvılcım arkları
    const shockRings = [];  // çarpma noktasından genişleyen plazma şok halkaları
    let strikeState = null; // %100'de çok kollu, çift darbeli gerçekçi yıldırım durumu

    const sCtx = scopeCanvas ? scopeCanvas.getContext('2d') : null;
    const fxCtx = fxCanvas ? fxCanvas.getContext('2d') : null;
    let barRect = null;
    let scopeW = 460, scopeH = 76;

    function sizeCanvases() {
      const dpr = Math.min(window.devicePixelRatio || 1, touchOnly ? 1.25 : 1.5);
      if (scopeCanvas && sCtx) {
        const r = scopeCanvas.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          scopeW = r.width;
          scopeH = r.height;
          scopeCanvas.width = Math.round(r.width * dpr);
          scopeCanvas.height = Math.round(r.height * dpr);
          sCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
      }
      if (fxCanvas && fxCtx) {
        fxCanvas.width = Math.round(window.innerWidth * dpr);
        fxCanvas.height = Math.round(window.innerHeight * dpr);
        fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      if (bar && bar.parentElement) barRect = bar.parentElement.getBoundingClientRect();
    }

    // Doğru normale dik fraktal sapma ile gerçekçi sivri yıldırım kanalı
    function buildBolt(x1, y1, x2, y2, displace, depth) {
      if (depth === 0) return [[x1, y1], [x2, y2]];
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const offset = (Math.random() - 0.5) * displace;
      const along = (Math.random() - 0.5) * displace * 0.12;
      const mx = (x1 + x2) * 0.5 + nx * offset + (dx / len) * along;
      const my = (y1 + y2) * 0.5 + ny * offset + (dy / len) * along;
      const nextDisp = displace * 0.54;
      const left = buildBolt(x1, y1, mx, my, nextDisp, depth - 1);
      const right = buildBolt(mx, my, x2, y2, nextDisp, depth - 1);
      return left.slice(0, -1).concat(right);
    }

    // Mevcut ana kolu hafifçe yeniden iyonize ederek 2. darbe titremesi üretir
    function jitterBolt(pts, amp) {
      return pts.map(([x, y], i) => {
        if (i === 0 || i === pts.length - 1) return [x, y];
        return [x + (Math.random() - 0.5) * amp, y + (Math.random() - 0.5) * amp * 0.65];
      });
    }

    // %84–99 arası ekranın üstünden merkeze doğru kısa ön-deşarj (leader) kıvılcımları
    function emitPreArc() {
      if (!fxCtx || reduce) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const x1 = w * (0.25 + Math.random() * 0.5);
      const y1 = -10;
      const x2 = x1 + (Math.random() - 0.5) * w * 0.22;
      const y2 = h * (0.18 + Math.random() * 0.34);
      preArcs.push({
        pts: buildBolt(x1, y1, x2, y2, Math.min(w * 0.08, 70), 4),
        alpha: 0.72 + Math.random() * 0.25
      });
    }

    // Büyük, çok katmanlı, dallı budaklı gerçekçi yıldırım ağı kurar
    function buildLightningNetwork(sx, sy, w, h) {
      const spread = Math.min(w * 0.26, 340);
      const startX = sx + (Math.random() - 0.5) * spread;
      const dispMain = Math.min(w * 0.22, 240);
      const mainDepth = touchOnly ? 6 : 7;

      // 1) Gökyüzünden çarpma noktasına inen DEV ana yıldırım gövdesi
      const mainUpper = buildBolt(startX, -30, sx, sy, dispMain, mainDepth);
      // Çarpma noktasından aşağı zemine doğru yırtılarak devam eden boşalım kolu
      const groundX = sx + (Math.random() - 0.5) * Math.min(w * 0.32, 320);
      const mainLower = buildBolt(sx, sy, groundX, h + 30, dispMain * 0.72, touchOnly ? 5 : 6);

      // 2) Üst yanlardan çarpma noktasına katılan 2 ikincil güçlü besleme yıldırım kolu
      const feeders = [];
      const feederSides = [-1, 1];
      feederSides.forEach((side) => {
        const fx0 = sx + side * (w * (0.16 + Math.random() * 0.22));
        const attachIdx = Math.floor(mainUpper.length * (0.45 + Math.random() * 0.45));
        const [ax, ay] = mainUpper[attachIdx];
        feeders.push(buildBolt(fx0, -25, ax, ay, Math.min(w * 0.14, 155), touchOnly ? 5 : 6));
      });

      // 3) 3 kademeli dallanma: ana dallar + alt çatallar + ince kılcal çatlaklar
      const primaryBranches = [];
      const subBranches = [];
      const pCount = touchOnly ? 9 : 15;
      const trunkPts = mainUpper.concat(mainLower.slice(1));

      for (let i = 0; i < pCount; i++) {
        const t = 0.08 + (i / pCount) * 0.84 + (Math.random() - 0.5) * 0.04;
        const idx = Math.max(2, Math.min(trunkPts.length - 3, Math.floor(t * trunkPts.length)));
        const [bx, by] = trunkPts[idx];
        const dir = i % 2 === 0 ? -1 : 1;
        const reachX = dir * (w * (0.12 + Math.random() * 0.24));
        const reachY = (by < sy ? 1 : 0.75) * (h * (0.12 + Math.random() * 0.24));
        const branch = buildBolt(bx, by, bx + reachX, by + reachY, Math.min(w * 0.09, 95), 4);
        primaryBranches.push(branch);

        // Her ana daldan 1–2 ince alt çatal çıkar
        const subN = touchOnly ? 1 : (Math.random() < 0.7 ? 2 : 1);
        for (let s = 0; s < subN; s++) {
          const sIdx = Math.floor(branch.length * (0.25 + Math.random() * 0.5));
          const [sbx, sby] = branch[sIdx];
          const sDir = Math.random() < 0.65 ? dir : -dir;
          const sdx = sDir * (55 + Math.random() * 145);
          const sdy = 40 + Math.random() * 135;
          subBranches.push(buildBolt(sbx, sby, sbx + sdx, sby + sdy, 38, 3));
        }
      }

      // 4) Çarpma merkezinden her yöne fırlayan yüzey ark kolları (yüksek gerilim deşarjı)
      const radialN = touchOnly ? 5 : 8;
      for (let i = 0; i < radialN; i++) {
        const ang = (i / radialN) * Math.PI * 2 + (Math.random() - 0.5) * 0.45;
        const len = Math.min(w, h) * (0.18 + Math.random() * 0.22);
        const rBolt = buildBolt(sx, sy, sx + Math.cos(ang) * len, sy + Math.sin(ang) * len, 46, 4);
        primaryBranches.push(rBolt);
      }

      return { mainUpper, mainLower, feeders, primaryBranches, subBranches, impact: [sx, sy] };
    }

    function spawnImpactBurst(sx, sy, count, speedMult = 1) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (4.5 + Math.random() * 14.5) * speedMult;
        const isBlue = Math.random() < 0.35;
        sparks.push({
          x: sx,
          y: sy,
          px: sx,
          py: sy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.8,
          life: 0.75 + Math.random() * 0.65,
          size: 1.4 + Math.random() * 2.6,
          isBlue
        });
      }
    }

    function triggerLightning() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      // Çarpma noktası: ekran merkezine yakın, her açılışta doğal farklılık
      const sxPct = 46 + Math.random() * 8;
      const syPct = 45 + Math.random() * 10;
      const sx = (sxPct / 100) * w;
      const sy = (syPct / 100) * h;

      [surface, flashEl, shockEl].forEach((el) => {
        if (!el) return;
        el.style.setProperty('--sx', `${sxPct.toFixed(2)}%`);
        el.style.setProperty('--sy', `${syPct.toFixed(2)}%`);
      });

      if (!fxCtx || reduce) return;

      const net = buildLightningNetwork(sx, sy, w, h);
      strikeState = {
        net,
        age: 0,           // saniye cinsinden geçen süre
        lastTs: performance.now(),
        restruck: false,
        aftershock: false
      };

      // Çarpma noktasından 2 katmanlı plazma şok dalgası halkası
      const maxR = Math.hypot(w, h) * 0.68;
      shockRings.push(
        { x: sx, y: sy, r: 12, maxR, speed: 1.85, alpha: 0.95, color: '#9FD3FF', width: 5 },
        { x: sx, y: sy, r: 4, maxR: maxR * 0.82, speed: 1.35, alpha: 0.85, color: '#F5D6A8', width: 3.5 }
      );

      spawnImpactBurst(sx, sy, touchOnly ? 44 : 88, 1.0);
    }

    // İlerleme çubuğu ucundan küçük bakır kıvılcımları üret (önbellekli konum — layout reflow yok)
    function emitBarSpark(ratio) {
      if (!barRect || !fxCtx || reduce) return;
      const x = barRect.left + barRect.width * ratio;
      const y = barRect.top + barRect.height * 0.5;
      sparks.push({
        x, y, px: x, py: y,
        vx: (Math.random() - 0.25) * 2.6,
        vy: -0.9 - Math.random() * 2.6,
        life: 0.72 + Math.random() * 0.35,
        size: 1.1 + Math.random() * 1.5,
        isBlue: false
      });
    }

    function drawScope(p) {
      if (!scopeCanvas || !sCtx) return;
      const w = scopeW;
      const h = scopeH;
      const mid = h * 0.5;
      const step = touchOnly ? 4 : 3;
      sCtx.clearRect(0, 0, w, h);

      // İnce osiloskop ızgarası
      sCtx.strokeStyle = 'rgba(184, 165, 138, 0.08)';
      sCtx.lineWidth = 1;
      sCtx.beginPath();
      for (let x = 0; x <= w; x += 38) { sCtx.moveTo(x, 0); sCtx.lineTo(x, h); }
      sCtx.moveTo(0, mid); sCtx.lineTo(w, mid);
      sCtx.stroke();

      // Deniz mavisi harmonik hayalet dalga
      const amp = (h * 0.34) * Math.min(1, p * 1.15);
      const jitter = p > 0.82 && p < 0.99 ? (Math.random() - 0.5) * 3.5 : 0;
      sCtx.beginPath();
      sCtx.strokeStyle = 'rgba(22, 74, 112, 0.75)';
      sCtx.lineWidth = 1.2;
      for (let x = 0; x <= w; x += step) {
        const t = (x / w) * Math.PI * (3 + p * 5) - phase * 0.85;
        const env = Math.sin((x / w) * Math.PI);
        const y = mid + Math.sin(t + 0.7) * amp * 0.65 * env;
        if (x === 0) sCtx.moveTo(x, y); else sCtx.lineTo(x, y);
      }
      sCtx.stroke();

      // Ana bronz/taş AC sinüs dalgası (shadowBlur yerine çift katmanlı hızlı çizim)
      sCtx.beginPath();
      for (let x = 0; x <= w; x += step) {
        const t = (x / w) * Math.PI * (4 + p * 6) - phase;
        const env = Math.sin((x / w) * Math.PI);
        const noise = p < 0.99 ? (Math.random() - 0.5) * (1.2 + (p > 0.85 ? 2.5 : 0)) : 0;
        const y = mid + Math.sin(t) * amp * env + noise + jitter * 0.3;
        if (x === 0) sCtx.moveTo(x, y); else sCtx.lineTo(x, y);
      }
      sCtx.strokeStyle = 'rgba(138, 104, 69, 0.38)';
      sCtx.lineWidth = 5;
      sCtx.stroke();
      sCtx.strokeStyle = p >= 0.99 ? '#F5EBD6' : '#B8A58A';
      sCtx.lineWidth = 1.8;
      sCtx.stroke();
    }

    function drawFx() {
      if (!fxCtx) return;
      if (!sparks.length && !preArcs.length && !shockRings.length && !strikeState) return;
      const w = window.innerWidth, h = window.innerHeight;
      fxCtx.clearRect(0, 0, w, h);

      fxCtx.save();
      fxCtx.globalCompositeOperation = 'lighter';
      fxCtx.lineCap = 'round';
      fxCtx.lineJoin = 'round';

      const strokePoly = (pts, width, color, alpha) => {
        if (alpha <= 0.005 || !pts || pts.length < 2) return;
        fxCtx.globalAlpha = Math.min(1, alpha);
        fxCtx.strokeStyle = color;
        fxCtx.lineWidth = width;
        fxCtx.beginPath();
        fxCtx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) fxCtx.lineTo(pts[i][0], pts[i][1]);
        fxCtx.stroke();
      };

      // 1) %84–99 ön gerilim arkları
      for (let i = preArcs.length - 1; i >= 0; i--) {
        const pa = preArcs[i];
        strokePoly(pa.pts, 10, '#4FA3FF', pa.alpha * 0.25);
        strokePoly(pa.pts, 3.2, '#DDF0FF', pa.alpha * 0.72);
        strokePoly(pa.pts, 1.3, '#FFFFFF', pa.alpha);
        pa.alpha -= 0.14;
        if (pa.alpha <= 0.02) preArcs.splice(i, 1);
      }

      // 2) Hız çizgili kıvılcımlar (sıcak plazma & bakır izleri)
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.px = s.x;
        s.py = s.y;
        s.x += s.vx;
        s.y += s.vy;
        s.vx *= 0.965;
        s.vy = s.vy * 0.965 + 0.16;
        s.life -= 0.024;
        if (s.life <= 0) { sparks.splice(i, 1); continue; }
        const a = Math.max(0, Math.min(1, s.life));
        const glowCol = s.isBlue ? '#6CB8FF' : '#D89650';
        const coreCol = s.isBlue ? '#ECF7FF' : (s.life > 0.5 ? '#FFF7E2' : '#E09248');

        // Dış hale çizgisi
        fxCtx.globalAlpha = a * 0.34;
        fxCtx.strokeStyle = glowCol;
        fxCtx.lineWidth = s.size * 2.8;
        fxCtx.beginPath();
        fxCtx.moveTo(s.px, s.py);
        fxCtx.lineTo(s.x, s.y);
        fxCtx.stroke();

        // Parlak sıcak çekirdek izi
        fxCtx.globalAlpha = a;
        fxCtx.strokeStyle = coreCol;
        fxCtx.lineWidth = s.size * 1.1;
        fxCtx.beginPath();
        fxCtx.moveTo(s.px, s.py);
        fxCtx.lineTo(s.x, s.y);
        fxCtx.stroke();
      }

      // 3) Genişleyen plazma şok halkaları
      for (let i = shockRings.length - 1; i >= 0; i--) {
        const sr = shockRings[i];
        sr.r += (sr.maxR - sr.r) * 0.11 * sr.speed + 9;
        const progress = sr.r / sr.maxR;
        const a = Math.max(0, (1 - progress) * (1 - progress) * sr.alpha);
        if (progress >= 1 || a <= 0.01) { shockRings.splice(i, 1); continue; }
        fxCtx.globalAlpha = a * 0.32;
        fxCtx.strokeStyle = sr.color;
        fxCtx.lineWidth = sr.width * 4.5 * (1 - progress * 0.6);
        fxCtx.beginPath();
        fxCtx.arc(sr.x, sr.y, sr.r, 0, Math.PI * 2);
        fxCtx.stroke();

        fxCtx.globalAlpha = a;
        fxCtx.strokeStyle = '#FFFFFF';
        fxCtx.lineWidth = sr.width * (1 - progress * 0.5);
        fxCtx.beginPath();
        fxCtx.arc(sr.x, sr.y, sr.r, 0, Math.PI * 2);
        fxCtx.stroke();
      }

      // 4) %100 DEV GERÇEKÇİ YILDIRIM ÇARPMASI (3 darbeli gerçekçi titreşim + katmanlı iyonizasyon)
      if (strikeState) {
        const now = performance.now();
        const dt = Math.min(0.05, (now - strikeState.lastTs) / 1000);
        strikeState.lastTs = now;
        strikeState.age += dt;
        const t = strikeState.age;

        // 2. darbe (0.13 sn) ve 3. artçı darbe (0.28 sn): yıldırım kanalı canlı biçimde yeniden parlar
        if (!strikeState.restruck && t >= 0.13) {
          strikeState.restruck = true;
          const [ix, iy] = strikeState.net.impact;
          strikeState.net.mainUpper = jitterBolt(strikeState.net.mainUpper, 14);
          strikeState.net.mainLower = jitterBolt(strikeState.net.mainLower, 12);
          strikeState.net.primaryBranches = strikeState.net.primaryBranches.map((b) => jitterBolt(b, 8));
          spawnImpactBurst(ix, iy, touchOnly ? 20 : 42, 0.85);
        }
        if (!strikeState.aftershock && t >= 0.28) {
          strikeState.aftershock = true;
          strikeState.net.mainUpper = jitterBolt(strikeState.net.mainUpper, 9);
        }

        // Gerçek yıldırım parlaklık zarfı: 1. dev darbe → kısa çöküş → 2. güçlü restrike → 3. artçı → sönüş
        let intensity = 0;
        if (t < 0.09) {
          intensity = 1.0;
        } else if (t < 0.13) {
          intensity = 0.28;
        } else if (t < 0.23) {
          intensity = 0.96 - (t - 0.13) * 2.2;
        } else if (t < 0.28) {
          intensity = 0.22;
        } else if (t < 0.36) {
          intensity = 0.72 - (t - 0.28) * 2.5;
        } else {
          intensity = Math.max(0, 0.52 * Math.exp(-(t - 0.36) * 5.2));
        }

        if (t > 0.92 || intensity <= 0.008) {
          strikeState = null;
        } else {
          const { mainUpper, mainLower, feeders, primaryBranches, subBranches, impact } = strikeState.net;
          const [ix, iy] = impact;

          // Gökyüzü ve çarpma atmosfer parlaması (dev iyonize plazma halesi)
          const R = Math.max(w, h) * 0.52;
          const grad = fxCtx.createRadialGradient(ix, iy, 0, ix, iy, R);
          grad.addColorStop(0, `rgba(255, 255, 255, ${intensity * 0.95})`);
          grad.addColorStop(0.14, `rgba(220, 242, 255, ${intensity * 0.72})`);
          grad.addColorStop(0.36, `rgba(92, 168, 255, ${intensity * 0.36})`);
          grad.addColorStop(0.64, `rgba(196, 150, 98, ${intensity * 0.18})`);
          grad.addColorStop(1, 'rgba(16, 40, 74, 0)');
          fxCtx.globalAlpha = 1;
          fxCtx.fillStyle = grad;
          fxCtx.beginPath();
          fxCtx.arc(ix, iy, R, 0, Math.PI * 2);
          fxCtx.fill();

          // İnce alt çatallar (3. kademe)
          for (let i = 0; i < subBranches.length; i++) {
            const b = subBranches[i];
            strokePoly(b, 7, '#4A9BFF', intensity * 0.16);
            strokePoly(b, 1.5, '#E4F3FF', intensity * 0.65);
          }

          // Ana dallar & çarpma yüzey arkları (2. kademe)
          for (let i = 0; i < primaryBranches.length; i++) {
            const b = primaryBranches[i];
            strokePoly(b, 20, '#3C8CFF', intensity * 0.14);
            strokePoly(b, 9.5, '#C49662', intensity * 0.28);
            strokePoly(b, 4.2, '#D8EEFF', intensity * 0.62);
            strokePoly(b, 1.9, '#FFFFFF', intensity * 0.95);
          }

          // Üst yan besleme kolları
          for (let i = 0; i < feeders.length; i++) {
            const f = feeders[i];
            strokePoly(f, 34, '#3B8BFF', intensity * 0.16);
            strokePoly(f, 16, '#8AC2FF', intensity * 0.34);
            strokePoly(f, 6.5, '#E8F6FF', intensity * 0.72);
            strokePoly(f, 2.8, '#FFFFFF', intensity * 0.98);
          }

          // DEV ANA YILDIRIM GÖVDESİ (üst gökyüzü + alt zemin boşalımı)
          const drawMainTrunk = (pts, scale) => {
            strokePoly(pts, 84 * scale, '#2B7AFF', intensity * 0.12);
            strokePoly(pts, 44 * scale, '#68B4FF', intensity * 0.25);
            strokePoly(pts, 22 * scale, '#E2B57B', intensity * 0.38);
            strokePoly(pts, 11 * scale, '#EBF7FF', intensity * 0.80);
            strokePoly(pts, 5.2 * scale, '#FFFFFF', intensity * 1.0);
          };
          drawMainTrunk(mainUpper, 1.0);
          drawMainTrunk(mainLower, 0.78);

          // Çarpma noktasında bıçak gibi parlayan yatay mercek parlaması (anamorphic flare)
          const flareW = Math.min(w * 0.48, 420) * (0.7 + 0.3 * intensity);
          const fGrad = fxCtx.createLinearGradient(ix - flareW, iy, ix + flareW, iy);
          fGrad.addColorStop(0, 'rgba(110, 180, 255, 0)');
          fGrad.addColorStop(0.35, `rgba(180, 224, 255, ${intensity * 0.45})`);
          fGrad.addColorStop(0.5, `rgba(255, 255, 255, ${intensity * 0.95})`);
          fGrad.addColorStop(0.65, `rgba(180, 224, 255, ${intensity * 0.45})`);
          fGrad.addColorStop(1, 'rgba(110, 180, 255, 0)');
          fxCtx.globalAlpha = 1;
          fxCtx.fillStyle = fGrad;
          fxCtx.fillRect(ix - flareW, iy - 3.5, flareW * 2, 7);
        }
      }

      fxCtx.restore();
    }

    if (!reduce) {
      sizeCanvases();
      window.addEventListener('resize', sizeCanvases);
      const loop = () => {
        phase += 0.14 + (counter.v / 100) * 0.16;
        drawScope(counter.v / 100);
        drawFx();
        rafId = requestAnimationFrame(loop);
      };
      rafId = requestAnimationFrame(loop);
    }

    function stopLoaderFx() {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', sizeCanvases);
      if (loader) loader.style.display = 'none';
    }

    // Ana GSAP zaman çizelgesi (.call(stopLoaderFx) kullanılır ki dışarıdaki eventCallback('onComplete') ezmesin)
    const tl = gsap.timeline();

    tl.to(counter, {
      v: 100,
      duration: reduce ? 0.2 : (touchOnly ? 1.75 : 2.5),
      ease: 'power2.inOut',
      onUpdate() {
        const p = counter.v / 100;
        const v = Math.round(counter.v);
        countEl.textContent = v;
        bar.style.transform = `scaleX(${p})`;
        if (sparkDot) {
          sparkDot.style.left = `${p * 100}%`;
          sparkDot.style.opacity = p > 0.02 && p < 0.995 ? 1 : 0;
        }
        logEl.textContent = logs[Math.round(p * (logs.length - 1))];

        // Telemetri değerleri
        if (voltEl) voltEl.textContent = `${String(Math.round(p * 220)).padStart(3, '0')}V`;
        if (freqEl) freqEl.textContent = `${(p * 50).toFixed(1).padStart(4, '0')}Hz`;
        if (ampEl) ampEl.textContent = `${(p * 12.4).toFixed(2)} A`;
        if (stateEl) {
          const si = p >= 0.99 ? 3 : p >= 0.65 ? 2 : p >= 0.1 ? 1 : 0;
          stateEl.textContent = states[si];
        }

        // Tek hat şeması ilerlemesi ve düğümlerin yanması
        if (circuitPath) circuitPath.style.strokeDashoffset = circuitLen * (1 - p);
        nodes.forEach((n, idx) => {
          const threshold = idx / (nodes.length - 1);
          n.classList.toggle('is-on', p >= threshold * 0.94);
        });

        // Kontrol listesi satırları
        checks.forEach((li) => {
          const at = Number(li.dataset.at || 0);
          if (v >= at && !li.classList.contains('is-done')) {
            li.classList.add('is-done');
            const tag = li.querySelector('.chk__tag');
            if (tag) tag.textContent = '[ OK ]';
          }
        });

        // %60 sonrası bar ucundan kıvılcım + %84 sonrası ön gerilim arkları & voltaj titremesi
        if (!reduce && p > 0.55 && p < 0.99 && Math.random() < (p > 0.85 ? 0.55 : 0.22)) {
          emitBarSpark(p);
        }
        if (!reduce && p > 0.84 && p < 0.99 && Math.random() < (touchOnly ? 0.08 : 0.14)) {
          emitPreArc();
        }
        if (!reduce && countWrap) {
          if (p > 0.85 && p < 0.99) {
            const jx = (Math.random() - 0.5) * 4;
            const jy = (Math.random() - 0.5) * 2;
            countWrap.style.transform = `translate3d(${jx}px, ${jy}px, 0)`;
          } else {
            countWrap.style.transform = '';
          }
        }
      }
    });

    if (reduce) {
      tl.to('#loader', { opacity: 0, duration: 0.2, ease: 'power1.out' }, '+=0.1')
        .call(stopLoaderFx);
      return tl;
    }

    // %100 anı: dev çok kollu yıldırım çarpar → 2. darbe flaşı & sarsıntı → GPU hızlandırmalı açılış
    tl.addLabel('strike')
      .call(() => {
        if (ledEl) ledEl.classList.add('is-ready');
        if (countWrap) countWrap.classList.add('is-charged');
        triggerLightning();
      }, null, 'strike')
      // 1. darbe flaşı → anlık düşüş → 2. restrike flaşı → 3. artçı parıltı
      .to(flashEl, { opacity: 0.85, duration: 0.055, ease: 'power4.out' }, 'strike')
      .to(flashEl, { opacity: 0.18, duration: 0.065 })
      .to(flashEl, { opacity: 0.78, duration: 0.045, ease: 'power4.out' })
      .to(flashEl, { opacity: 0.14, duration: 0.07 })
      .to(flashEl, { opacity: 0.44, duration: 0.04 })
      .to(flashEl, { opacity: 0, duration: 0.42, ease: 'power2.out' })
      // Güçlü yüksek gerilim ekran sarsıntısı (1. ve 2. darbeyle senkron)
      .to(surface, { x: 10, y: -5, duration: 0.035, repeat: 5, yoyo: true, clearProps: 'x,y' }, 'strike')
      .call(() => {
        if (surface) surface.classList.add('is-opening');
      }, null, 'strike+=0.26')
      .fromTo(shockEl,
        { scale: 0, opacity: 0.95 },
        { scale: 1.08, opacity: 0, duration: 0.72, ease: 'power3.out' },
        'strike+=0.14'
      )
      .call(stopLoaderFx, null, 'strike+=0.92');

    return tl;
  }

  /* ---------- 4) Hero girişi (loader bittikten sonra) ---------- */
  function heroIntro() {
    document.body.classList.remove('is-loading');
    if (lenis) lenis.start();

    // Parçacıklara ve fiber tünele "giriş başlasın" haberi (drift-particles.js, fiber-tunnel.js dinler).
    // Modül geç yüklenirse bayraktan anlar.
    window.__heroIntroStarted = true;
    window.dispatchEvent(new Event('hero:intro'));
    if (reduce) return;

    gsap.timeline()
      // başlık harfleri aşağıdan kayarak gelir
      .to(heroChars, { yPercent: 0, duration: 1.1, ease: 'power4.out', stagger: 0.045 }, 0.25)
      // harfler oturunca SADECE BİR KEZ 0.5 sn glitch; sonra başlık temiz kalır
      .call(() => {
        const title = document.querySelector('.hero__title');
        title.classList.add('is-glitch');
        title.addEventListener('animationend', () => title.classList.remove('is-glitch'), { once: true });
      }, null, 1.15)
      // kimlik kartı aşağıdan yükselerek belirir
      .to('.idcard', { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out' }, 0.5)
      // menü, etiket, butonlar ve alt gösterge sırayla belirir
      .to(['.nav', '.hero__tag', '.hero__plus', '.hero__cta', '.hero__scroll'], {
        opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.08
      }, 0.7);
  }

  runLoader().eventCallback('onComplete', () => {
    heroIntro();
    initScroll();
  });

  /* ---------- 5) Scroll animasyonları ---------- */
  function initScroll() {
    // Menü: hero'dan (açık zemin) çıkınca yazı rengi açığa döner
    const nav = document.querySelector('.nav');
    ScrollTrigger.create({
      trigger: '.hero', start: 'bottom 70px',
      onEnter: () => nav.classList.add('is-dark'),
      onLeaveBack: () => nav.classList.remove('is-dark')
    });

    // Menü: ekranın ortasındaki bölümün linki aktif olur (altı çizilir) + kayan HUD seçim çerçevesi
    const navWrap = document.querySelector('.nav__links');
    const navLinks = [...document.querySelectorAll('.nav__links a')];
    const navSections = navLinks.map((a) => document.querySelector(a.getAttribute('href')));
    const navSliderApi = initNavSlider(navWrap, navLinks);

    ScrollTrigger.create({
      onUpdate: () => {
        const mid = window.innerHeight * 0.5;
        let current = 0, bestTop = -Infinity;
        navSections.forEach((s, i) => {
          if (!s) return;
          const top = s.getBoundingClientRect().top;
          if (top <= mid && top > bestTop) { bestTop = top; current = i; }
        });
        let changed = false;
        navLinks.forEach((a, i) => {
          const on = i === current;
          if (a.classList.contains('is-active') !== on) { a.classList.toggle('is-active', on); changed = true; }
        });
        if (changed && navSliderApi) navSliderApi.syncActive();
      }
    });

    if (!reduce) initHeroMotion();

    // Bölüm etiketleri: bölüme gelince "terminal" yanar
    document.querySelectorAll('.section-label').forEach((label) => {
      ScrollTrigger.create({ trigger: label, start: 'top 80%', toggleClass: 'is-live' });
    });

    // Sayaçlar (0'dan hedef sayıya). Hakkımda'dakiler js/about-scene.js timeline'ında sayar.
    document.querySelectorAll('[data-count]').forEach((el) => {
      if (el.closest('#about')) return;
      const end = Number(el.dataset.count);
      const o = { v: 0 };
      gsap.to(o, {
        v: end, duration: reduce ? 0 : 1.6, ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        onUpdate() { el.textContent = Math.round(o.v); }
      });
    });

    // Zaman çizelgesi noktaları: ortaya gelince yanar
    document.querySelectorAll('.tl-item').forEach((item) => {
      if (reduce) item.classList.add('is-active');
      else ScrollTrigger.create({ trigger: item, start: 'top 65%', toggleClass: 'is-active' });
    });

    // Projeler: Spotlight + galeri animasyonları (js/projects.js)
    if (window.Projects) window.Projects.initMotion({ reduce });

    if (reduce) return; // aşağıdakiler sadece hareket isteyenler için

    // Kablo: sayfa boyunca yukarıdan aşağı dolar
    gsap.to('#cableFill', {
      scaleY: 1, ease: 'none',
      scrollTrigger: { trigger: 'main', start: 'top top', end: 'bottom bottom', scrub: true }
    });

    // Hakkımda: metin dolma, sayaçlar ve kamera tek timeline'da → js/about-scene.js

    // Zaman çizelgesi çizgisi dolar
    if (document.getElementById('timelineFill')) gsap.to('#timelineFill', {
      scaleY: 1, ease: 'none',
      scrollTrigger: { trigger: '.timeline__wrap', start: 'top 65%', end: 'bottom 65%', scrub: true }
    });

    // Başlıklar ve blog kartları aşağıdan belirir
    gsap.utils.toArray('.section-title').forEach((t) => {
      gsap.from(t, { y: 60, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: t, start: 'top 85%' } });
    });
    gsap.set('.bcard', { opacity: 0, y: 50 });
    ScrollTrigger.batch('.bcard', {
      start: 'top 85%',
      onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.12 })
    });

    // Galeri kareleri ve iletişim kartları kaydırıldıkça canlı ama abartısız şekilde belirir
    const mzItems = document.querySelectorAll('.mz-item');
    if (mzItems.length) {
      gsap.set(mzItems, { opacity: 0, y: 34 });
      ScrollTrigger.batch(mzItems, {
        start: 'top 90%',
        once: true,
        onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.75, ease: 'power3.out', stagger: 0.06, clearProps: 'transform' })
      });
    }
    const ibItems = document.querySelectorAll('.iletisim-bilgi .ib');
    if (ibItems.length) {
      gsap.set(ibItems, { opacity: 0, y: 28 });
      ScrollTrigger.batch(ibItems, {
        start: 'top 90%',
        once: true,
        onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.75, ease: 'power3.out', stagger: 0.09, clearProps: 'transform' })
      });
    }

    // İletişim: dev yazı harf harf yükselir (scrub)
    const contactChars = [];
    document.querySelectorAll('[data-split-scroll]').forEach((el) => contactChars.push(...splitChars(el)));
    if (contactChars.length) gsap.from(contactChars, {
      yPercent: 110, stagger: 0.03, ease: 'none',
      scrollTrigger: { trigger: '.contact', start: 'top 85%', end: 'top 25%', scrub: true }
    });

    initMarquee();
    initPointer();

    // Fontlar yüklenince ölçüleri yenile
    if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
  }

  /* ---------- 5c) Menü: kayan [ ] HUD çerçevesi + mıknatıslı seçme animasyonu ---------- */
  function initNavSlider(navWrap, links) {
    if (!navWrap || !links.length) return null;
    const slider = document.createElement('span');
    slider.className = 'nav__slider';
    slider.setAttribute('aria-hidden', 'true');
    slider.innerHTML = '<i class="nav__slider-bar"></i>';
    navWrap.prepend(slider);
    navWrap.classList.add('has-slider');

    let hovered = null;
    let ready = false;

    function pulse() {
      if (reduce) return;
      slider.classList.remove('is-pulse');
      void slider.offsetWidth;
      slider.classList.add('is-pulse');
    }

    function moveTo(el, instant) {
      if (!el || window.innerWidth <= 768) return;
      const x = el.offsetLeft;
      const w = el.offsetWidth;
      if (w < 4) return;
      if (!ready) { ready = true; slider.classList.add('is-ready'); instant = true; }
      if (instant || reduce) {
        gsap.set(slider, { x, width: w });
      } else {
        gsap.to(slider, { x, width: w, duration: 0.44, ease: 'power3.out', overwrite: 'auto' });
      }
    }

    function getActive() {
      return navWrap.querySelector('a.is-active') || links[0];
    }

    function syncActive(instant) {
      if (!hovered) moveTo(getActive(), instant);
    }

    links.forEach((a) => {
      const txt = a.querySelector('.nav__txt');
      const toX = finePointer && !reduce && txt ? gsap.quickTo(txt, 'x', { duration: 0.35, ease: 'power3.out' }) : null;
      const toY = finePointer && !reduce && txt ? gsap.quickTo(txt, 'y', { duration: 0.35, ease: 'power3.out' }) : null;

      a.addEventListener('pointerenter', (e) => {
        if (e.pointerType !== 'mouse') return;
        hovered = a;
        navWrap.classList.add('is-hovering');
        links.forEach((l) => l.classList.toggle('is-hovered', l === a));
        moveTo(a, false);
        pulse();
      });

      if (toX && toY) {
        a.addEventListener('pointermove', (e) => {
          if (e.pointerType !== 'mouse') return;
          const r = a.getBoundingClientRect();
          toX(((e.clientX - r.left) / r.width - 0.5) * 6);
          toY(((e.clientY - r.top) / r.height - 0.5) * 4);
        });
        a.addEventListener('pointerleave', () => { toX(0); toY(0); });
      }

      a.addEventListener('focus', () => {
        hovered = a;
        navWrap.classList.add('is-hovering');
        links.forEach((l) => l.classList.toggle('is-hovered', l === a));
        moveTo(a, false);
      });

      a.addEventListener('click', () => { pulse(); });
    });

    navWrap.addEventListener('pointerleave', () => {
      hovered = null;
      navWrap.classList.remove('is-hovering');
      links.forEach((l) => l.classList.remove('is-hovered'));
      moveTo(getActive(), false);
    });
    navWrap.addEventListener('focusout', (e) => {
      if (navWrap.contains(e.relatedTarget)) return;
      hovered = null;
      navWrap.classList.remove('is-hovering');
      links.forEach((l) => l.classList.remove('is-hovered'));
      moveTo(getActive(), false);
    });

    window.addEventListener('resize', () => moveTo(hovered || getActive(), true));
    if (document.fonts) document.fonts.ready.then(() => moveTo(hovered || getActive(), true));
    requestAnimationFrame(() => moveTo(getActive(), true));

    return { syncActive };
  }

  /* ---------- 5b) Hero kaydırma parallax'ı ----------
     Fotoğrafın 3B eğilmesi aşağıda; parçacıklar js/drift-particles.js, tünel js/fiber-tunnel.js. */
  function initHeroMotion() {
    const hero = document.querySelector('.hero');
    const h = () => hero.offsetHeight;
    // Hepsi aynı ScrollTrigger aralığını kullanır: hero ekranın tepesinden çıkana kadar
    const scrub = { trigger: hero, start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true };

    // Sahne (sis + parçacıklar) YAVAŞ kayar: aşağı doğru itilir, sayfadan geri kalır
    gsap.to('.hero__stage', { y: () => h() * 0.35, ease: 'none', scrollTrigger: scrub });

    // Yazılar DAHA HIZLI yukarı kayar ve hafifçe söner
    gsap.to('.hero__content', { y: () => -h() * 0.35, opacity: 0.2, ease: 'none', scrollTrigger: scrub });
    gsap.to('.hero__plus', { y: () => -h() * 0.2, ease: 'none', scrollTrigger: scrub });
    gsap.to('.hero__scroll', { opacity: 0, ease: 'none', scrollTrigger: { ...scrub, end: '20% top' } });

    // Kimlik kartı fareyle 3B eğilir (her eksende en fazla 8°)
    if (!finePointer) return;
    const tilt = document.querySelector('.idcard__tilt');
    if (!tilt) return;
    const toRY = gsap.quickTo(tilt, 'rotationY', { duration: 0.9, ease: 'power3' });
    const toRX = gsap.quickTo(tilt, 'rotationX', { duration: 0.9, ease: 'power3' });
    hero.addEventListener('mousemove', (e) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;   // -1 … 1
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      toRY(nx * 8);
      toRX(-ny * 8);
    });
    hero.addEventListener('mouseleave', () => { toRY(0); toRX(0); });
  }

  /* ---------- 6) Kayan şeritler: kaydırma hızına göre hızlanır ---------- */
  function initMarquee() {
    const rows = [...document.querySelectorAll('.marquee')].map((m) => {
      const track = m.querySelector('.marquee__track');
      const dir = Number(m.dataset.dir);
      return { track, dir, x: dir < 0 ? -track.scrollWidth / 2 : 0 };
    });
    if (!rows.length) return;
    let boost = 0;

    ScrollTrigger.create({
      onUpdate: (self) => { boost = Math.min(Math.abs(self.getVelocity()) / 250, 10); }
    });

    gsap.ticker.add((time, delta) => {
      const step = (0.8 + boost) * (delta / 16.67);
      rows.forEach((r) => {
        const half = r.track.scrollWidth / 2;
        r.x -= step * r.dir;
        if (r.x <= -half) r.x += half;
        if (r.x > 0) r.x -= half;
        r.track.style.transform = `translate3d(${r.x}px,0,0)`;
      });
      boost *= 0.92;
    });
  }

  /* ---------- 8) Workbench düğmesi: Hakkımda'dan itibaren 3B sahne ve sonrasını gece moduna geçirir ---------- */
  (function initWorkbench() {
    const btn = document.getElementById('workbenchToggle');
    const stateEl = document.getElementById('workbenchState');
    if (!btn) return;
    let night = false;
    function apply() {
      window.__workbenchNight = night;
      if (window.__setWorkbenchNight) window.__setWorkbenchNight(night);
      if (window.__setCaveNight) window.__setCaveNight(night);
      btn.classList.toggle('is-night', night);
      btn.setAttribute('aria-pressed', String(night));
      document.body.classList.toggle('is-night-wb', night);
      const isEn = document.documentElement.lang === 'en';
      if (stateEl) stateEl.textContent = night ? (isEn ? 'NIGHT' : 'GECE') : (isEn ? 'DAY' : 'GÜNDÜZ');
    }
    btn.addEventListener('click', () => {
      night = !night;
      apply();
    });
    apply();
  })();

  /* ---------- 7) İmleç + mıknatıslı butonlar (sadece mouse) ---------- */
  function initPointer() {
    if (!finePointer) return;
    document.body.classList.add('has-cursor');

    const cursor = document.getElementById('cursor');
    gsap.set(cursor, { xPercent: -50, yPercent: -50 });
    const toX = gsap.quickTo(cursor, 'x', { duration: 0.25, ease: 'power3' });
    const toY = gsap.quickTo(cursor, 'y', { duration: 0.25, ease: 'power3' });
    window.addEventListener('mousemove', (e) => { toX(e.clientX); toY(e.clientY); });

    document.querySelectorAll('a, button, [data-cursor]').forEach((el) => {
      el.addEventListener('mouseenter', () => cursor.classList.add('is-hover'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('is-hover'));
    });

    document.querySelectorAll('[data-magnetic]').forEach((el) => {
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        gsap.to(el, { x: (e.clientX - r.left - r.width / 2) * 0.3, y: (e.clientY - r.top - r.height / 2) * 0.3, duration: 0.4 });
      });
      el.addEventListener('mouseleave', () => gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' }));
    });
  }

  /* ---------- 9) HUD bildirim şeridi (sol alt) ---------- */
  const hudToast = document.getElementById('hudToast');
  let toastTimer = null;
  function showHudToast(msg, tag = '[ OK ]') {
    if (!hudToast) return;
    hudToast.innerHTML = `<span class="hud-toast__tag">${tag}</span><span>${msg}</span>`;
    hudToast.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => hudToast.classList.remove('is-show'), 2600);
  }
  window.__showHudToast = showHudToast;

  /* ---------- 10) İzohips paralaksı, yükselti profili çizimi & Ana Kamp iletişim HUD ---------- */
  (function initBaseCampAndTopo() {
    const isEn = document.documentElement.lang === 'en';

    // a) Topografik izohips haritası hafif fare paralaksı (yalnızca masaüstü)
    if (finePointer && !reduce) {
      document.querySelectorAll('#galeri, #contact').forEach((sec) => {
        const topo = sec.querySelector('.topo-bg');
        if (!topo) return;
        const toX = gsap.quickTo(topo, 'x', { duration: 1.1, ease: 'power3.out' });
        const toY = gsap.quickTo(topo, 'y', { duration: 1.1, ease: 'power3.out' });
        sec.addEventListener('mousemove', (e) => {
          const r = sec.getBoundingClientRect();
          const nx = ((e.clientX - r.left) / Math.max(r.width, 1)) * 2 - 1;
          const ny = ((e.clientY - r.top) / Math.max(r.height, 1)) * 2 - 1;
          toX(-nx * 14);
          toY(-ny * 10);
        });
        sec.addEventListener('mouseleave', () => { toX(0); toY(0); });
      });
    }

    // b) Galeri yükselti profili: bölüme gelince dağ sırtı çizgisi çizilir (pathLength="1000")
    const elevPath = document.getElementById('elevPath');
    const elevWrap = document.getElementById('mzElev');
    if (elevPath && elevWrap && !reduce) {
      gsap.set(elevPath, { strokeDasharray: 1000, strokeDashoffset: 1000 });
      gsap.to(elevPath, {
        strokeDashoffset: 0,
        duration: 1.45,
        ease: 'power2.out',
        scrollTrigger: { trigger: elevWrap, start: 'top 84%', once: true }
      });
    }

    // c) Bolu canlı saati (Europe/Istanbul)
    const clockEl = document.getElementById('boluClock');
    if (clockEl) {
      const fmt = new Intl.DateTimeFormat('tr-TR', {
        timeZone: 'Europe/Istanbul',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      });
      let lastClock = '';
      const tickClock = () => {
        const now = fmt.format(new Date());
        if (now !== lastClock) {
          clockEl.textContent = now;
          lastClock = now;
        }
      };
      tickClock();
      setInterval(tickClock, 1000);
    }

    // d) Ana Kamp canlı pusulası: #contact içinde imlece yumuşakça döner
    const contactSec = document.getElementById('contact');
    const compassEl = document.getElementById('contactCompass');
    const needleEl = document.getElementById('compassNeedle');
    const degEl = document.getElementById('compassDeg');
    if (contactSec && compassEl && needleEl && degEl && finePointer && !reduce) {
      const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
      let curAng = 0;
      let targetAng = 0;
      let rafId = 0;

      function stepCompass() {
        const diff = ((targetAng - curAng + 540) % 360) - 180;
        curAng += diff * 0.14;
        const norm = ((curAng % 360) + 360) % 360;
        needleEl.setAttribute('transform', `rotate(${norm.toFixed(1)} 40 40)`);
        const rounded = Math.round(norm) % 360;
        const card = dirs[Math.round(rounded / 45) % 8];
        degEl.textContent = `${String(rounded).padStart(3, '0')}° ${card}`;
        if (Math.abs(diff) > 0.12) {
          rafId = requestAnimationFrame(stepCompass);
        } else {
          rafId = 0;
        }
      }

      contactSec.addEventListener('mousemove', (e) => {
        const r = compassEl.getBoundingClientRect();
        const cx = r.left + 34;
        const cy = r.top + r.height * 0.5;
        const rad = Math.atan2(e.clientY - cy, e.clientX - cx);
        targetAng = (rad * 180 / Math.PI + 90 + 360) % 360;
        if (!rafId) rafId = requestAnimationFrame(stepCompass);
      });
    }

    // e) Endüstriyel "Devreyi Kapat" pano anahtarı
    const sw = document.getElementById('circuitSwitch');
    const swState = document.getElementById('circuitState');
    const infoBox = document.getElementById('iletisimBilgi');
    const cableFill = document.getElementById('cableFill');
    if (sw && infoBox) {
      let energized = false;
      sw.addEventListener('click', () => {
        energized = !energized;
        sw.classList.toggle('is-on', energized);
        sw.setAttribute('aria-pressed', String(energized));
        infoBox.classList.toggle('is-energized', energized);
        if (swState) {
          swState.textContent = energized
            ? (isEn ? 'CIRCUIT CLOSED · ENERGISED' : 'DEVRE KAPALI · ENERJİLİ')
            : (isEn ? 'CIRCUIT: STANDBY' : 'DEVRE: BEKLEMEDE');
        }
        if (cableFill && energized) {
          cableFill.classList.add('is-surge');
          setTimeout(() => cableFill.classList.remove('is-surge'), 1100);
        }
        showHudToast(
          energized
            ? (isEn ? 'Circuit closed · Contact line energised' : 'Devre kapalı · İletişim hattı enerjilendi')
            : (isEn ? 'Circuit switched to standby' : 'Devre bekleme moduna alındı'),
          energized ? '[ ON ]' : '[ -- ]'
        );
      });
    }
  })();

  /* ---------- 11) E-postayı kopyala ---------- */
  const copyBtn = document.getElementById('copyEmail');
  const copyText = document.getElementById('copyEmailText');
  if (copyBtn && copyText) {
    copyBtn.addEventListener('click', async () => {
      const email = copyBtn.dataset.email;
      const isEn = document.documentElement.lang === 'en';
      try {
        await navigator.clipboard.writeText(email);
        copyText.textContent = isEn ? 'Copied ✓' : 'Kopyalandı ✓';
        showHudToast(isEn ? 'Email copied to clipboard' : 'E-posta panoya kopyalandı');
      } catch (err) {
        copyText.textContent = email; // kopyalanamazsa adres görünür kalsın
      }
      setTimeout(() => { copyText.textContent = email; }, 1800);
    });
  }
})();
