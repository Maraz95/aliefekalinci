/* =========================================================
   ANIMATIONS — tüm scroll animasyonları burada
   Kütüphaneler: GSAP + ScrollTrigger (animasyon), Lenis (yumuşak kaydırma)
   ========================================================= */
(function () {
  gsap.registerPlugin(ScrollTrigger);

  // Kullanıcı "hareketi azalt" ayarını açtıysa animasyonları sadeleştir
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  /* ---------- Yardımcılar: metni harf / kelime parçalarına böl ---------- */
  function splitChars(el) {
    const text = el.textContent.trim();
    el.setAttribute('aria-label', text);
    el.textContent = '';
    [...text].forEach((ch) => {
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

  /* ---------- 1) Lenis: yumuşak kaydırma ---------- */
  let lenis = null;
  if (!reduce && typeof Lenis !== 'undefined') {
    lenis = new Lenis({ lerp: 0.1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop(); // loader bitene kadar kaydırma kapalı
  }

  // Menü linkleri: yumuşak kaydırma ile bölüme git
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { duration: 1.4 });
      else target.scrollIntoView();
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

  /* ---------- 3) Loader: sayaç + ilerleme çubuğu + log satırları ---------- */
  function runLoader() {
    const countEl = document.getElementById('loaderCount');
    const bar = document.getElementById('loaderBar');
    const logEl = document.getElementById('loaderLog');
    const logs = ['Sistem başlatılıyor…', 'Pano kontrol ediliyor…', 'Hatlar test ediliyor…', 'Kod derleniyor…', 'Hazır.'];
    const counter = { v: 0 };

    return gsap.timeline()
      .to(counter, {
        v: 100,
        duration: reduce ? 0.2 : 2.4,
        ease: 'power2.inOut',
        onUpdate() {
          const v = Math.round(counter.v);
          countEl.textContent = v;
          bar.style.transform = `scaleX(${v / 100})`;
          logEl.textContent = logs[Math.round((v / 100) * (logs.length - 1))];
        }
      })
      .to('#loader', { yPercent: -100, duration: reduce ? 0.01 : 1, ease: 'power4.inOut' }, '+=0.25');
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

    // Menü: ekranın ortasındaki bölümün linki aktif olur (altı çizilir)
    const navLinks = [...document.querySelectorAll('.nav__links a')];
    const navSections = navLinks.map((a) => document.querySelector(a.getAttribute('href')));
    ScrollTrigger.create({
      onUpdate: () => {
        const mid = window.innerHeight * 0.5;
        let current = 0, bestTop = -Infinity;
        navSections.forEach((s, i) => {
          const top = s.getBoundingClientRect().top;
          if (top <= mid && top > bestTop) { bestTop = top; current = i; }
        });
        navLinks.forEach((a, i) => a.classList.toggle('is-active', i === current));
      }
    });

    if (!reduce) initHeroMotion();

    // Bölüm etiketleri: bölüme gelince "terminal" yanar
    document.querySelectorAll('.section-label').forEach((label) => {
      ScrollTrigger.create({ trigger: label, start: 'top 80%', toggleClass: 'is-live' });
    });

    // Sayaçlar (0'dan hedef sayıya)
    document.querySelectorAll('[data-count]').forEach((el) => {
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

    // Hakkımda: kelimeler kaydırdıkça griden beyaza dolar (scrub)
    const aboutWords = splitWords(document.querySelector('[data-words]'));
    gsap.fromTo(aboutWords, { opacity: 0.12 }, {
      opacity: 1, stagger: 0.1, ease: 'none',
      scrollTrigger: { trigger: '.about__text', start: 'top 75%', end: 'bottom 45%', scrub: true }
    });

    // Zaman çizelgesi çizgisi dolar
    gsap.to('#timelineFill', {
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

    // İletişim: dev yazı harf harf yükselir (scrub)
    const contactChars = [];
    document.querySelectorAll('[data-split-scroll]').forEach((el) => contactChars.push(...splitChars(el)));
    gsap.from(contactChars, {
      yPercent: 110, stagger: 0.03, ease: 'none',
      scrollTrigger: { trigger: '.contact', start: 'top 85%', end: 'top 25%', scrub: true }
    });

    initMarquee();
    initPointer();

    // Fontlar yüklenince ölçüleri yenile
    if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
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

  /* ---------- 8) E-postayı kopyala ---------- */
  const copyBtn = document.getElementById('copyEmail');
  const copyText = document.getElementById('copyEmailText');
  copyBtn.addEventListener('click', async () => {
    const email = copyBtn.dataset.email;
    try {
      await navigator.clipboard.writeText(email);
      copyText.textContent = 'Kopyalandı ✓';
    } catch (err) {
      copyText.textContent = email; // kopyalanamazsa adres görünür kalsın
    }
    setTimeout(() => { copyText.textContent = email; }, 1800);
  });
})();
