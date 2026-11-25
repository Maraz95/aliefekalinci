/* =========================================================
   HAKKIMDA — kamera ilerlemesi + içerik animasyonları
   ---------------------------------------------------------
   Tünelden çıkınca 3B manzara (js/about-3d.js) ekrana sabit kalır,
   Hakkımda içeriği onun üstünde normal kaydırmayla akar (pin yok).
   1) Kamera: #about ekrana girdiği andan bölüm bitene kadar 0 → 1
      (window.__aboutCam ile about-3d.js'e iletilir).
   2) Paneller ekrana girerken aşağıdan belirir.
   3) Yetenek çubukları görünür olunca 0'dan dolar, yüzde sayarak artar.
   4) Python kodu kütüphanesiz renklendirilir.
   Sahnenin görünürlüğü (portaldan giriş, çıkışta siyaha sönme): js/portal.js
   Hareketi azalt: animasyon yok, çubuklar dolu, kamera ilk karede.
   ========================================================= */
(function () {
  const about = document.getElementById('about');
  if (!about) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 4) Basit Python renklendirme: yorum, metin, sayı, anahtar kelime, fonksiyon adı */
  about.querySelectorAll('pre code.language-python').forEach((el) => {
    const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const kw = /\b(def|return|if|else|elif|for|in|while|import|from|print|True|False|None)\b/g;
    el.innerHTML = el.textContent.split('\n').map((line) => {
      const i = line.indexOf('#');
      const code = i >= 0 ? line.slice(0, i) : line, com = i >= 0 ? line.slice(i) : '';
      const parts = code.split(/("[^"]*")/);
      const out = parts.map((p) => p.startsWith('"') ? `<span class="s">${esc(p)}</span>`
        : esc(p).replace(/\b(\d+)\b/g, '<span class="n">$1</span>')
                .replace(kw, '<span class="k">$1</span>')
                .replace(/(<span class="k">def<\/span>\s+)(\w+)/, '$1<span class="f">$2</span>')).join('');
      return out + (com ? `<span class="c">${esc(com)}</span>` : '');
    }).join('\n');
  });

  if (reduce || !window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);

  /* 1) Kamera ilerlemesi:
        - Hakkımda yazıları okunurken (ab-deck-zone boyunca) kamera SABİT kalır (cam = 0).
        - Bütün yazılar bittikten sonraki geçiş alanında kamera eski sakin hızıyla
          terastan öne doğru kayar (cam: 0 → 1), sonra Projeler'de açık denize çıkar. */
  let cam = 0;
  let projCam = 0;
  let blogCam = 0;
  window.__aboutCamProgress = () => cam;
  window.__projectsCamProgress = () => projCam;
  window.__blogCamProgress = () => blogCam;
  if (window.__aboutCam) window.__aboutCam(0);

  const projects = document.getElementById('projects');
  if (projects) {
    ScrollTrigger.create({
      // Projeler ekranın yarısını geçince kamera denize süzülür; sütunlar ise Projeler tam yerleşince (p > 0.22) yükselir
      trigger: projects, start: 'top 45%', end: 'bottom bottom',
      invalidateOnRefresh: true,
      onUpdate: (self) => { projCam = self.progress; if (window.__projectsCam) window.__projectsCam(projCam); }
    });
  }

  const blog = document.getElementById('blog');
  if (blog) {
    ScrollTrigger.create({
      trigger: blog, start: 'top 98%', end: 'top 12%',
      invalidateOnRefresh: true,
      onUpdate: (self) => { blogCam = self.progress; if (window.__blogCam) window.__blogCam(blogCam); }
    });
  }

  /* 2) Yetenek çubuklarını dolduran yardımcı (hem slayt modunda hem mobilde ortak) */
  let skillsPlayed = false;
  function animateSkills() {
    if (skillsPlayed) return;
    skillsPlayed = true;
    about.querySelectorAll('.yetenek-listesi li').forEach((li) => {
      const bar = li.querySelector('.bar'), label = li.querySelector('.yuzde');
      const hedef = Number(bar.getAttribute('aria-valuenow')) || 0;
      const o = { v: 0 };
      bar.style.setProperty('--dolu', 0); label.textContent = '%0';
      gsap.to(o, {
        v: hedef, duration: 1.2, ease: 'power2.out',
        onUpdate() { bar.style.setProperty('--dolu', o.v); label.textContent = '%' + Math.round(o.v); }
      });
    });
  }

  /* 3) Masaüstünde sabit-kamera + scroll ile yenilenen slayt sahnesi; mobilde normal dikey akış */
  const desktop = window.matchMedia('(min-width: 900px)').matches;
  const panel = about.querySelector('.ab-tek');

  if (desktop && panel) {
    // Mevcut 9 bloğu ekrana rahat sığan 6 dengeli slayta grupla
    const groups = [
      ['#ab-ozgecmis'],
      ['#ab-deneyim'],
      ['#ab-egitim', '#ab-diller'],
      ['#ab-ders-programi'],
      ['#ab-ilgi-alanlari'],
      ['#ab-yetenekler', '.ab-soz'],
    ];

    const deckZone = document.createElement('div');
    deckZone.className = 'ab-deck-zone';
    const sticky = document.createElement('div');
    sticky.className = 'ab-sticky';
    panel.parentNode.insertBefore(deckZone, panel);
    deckZone.appendChild(sticky);
    sticky.appendChild(panel);

    const nav = document.createElement('div');
    nav.className = 'ab-deck-nav';
    nav.innerHTML = `
      <span class="ab-deck-step"><b id="abStepCur">01</b> / 0${groups.length}</span>
      <div class="ab-deck-dots" role="tablist" aria-label="Hakkımda bölümleri">
        ${groups.map((_, i) => `<button type="button" class="ab-deck-dot${i === 0 ? ' is-on' : ''}" data-slide="${i}" aria-label="Bölüm ${i + 1}"></button>`).join('')}
      </div>`;

    const slidesWrap = document.createElement('div');
    slidesWrap.className = 'ab-slides';

    const slides = groups.map((sels, idx) => {
      const s = document.createElement('div');
      s.className = 'ab-slide' + (idx === 0 ? ' is-active' : '');
      sels.forEach((sel) => {
        const node = panel.querySelector(sel);
        if (node) s.appendChild(node);
      });
      slidesWrap.appendChild(s);
      return s;
    });

    panel.appendChild(nav);
    panel.appendChild(slidesWrap);
    about.classList.add('is-deck');

    const stepCur = document.getElementById('abStepCur');
    const dots = [...nav.querySelectorAll('.ab-deck-dot')];
    let activeIdx = 0;

    function setSlide(idx) {
      const next = Math.max(0, Math.min(slides.length - 1, idx));
      if (next === activeIdx) return;
      activeIdx = next;
      slides.forEach((s, i) => {
        s.classList.toggle('is-active', i === activeIdx);
        s.classList.toggle('is-past', i < activeIdx);
      });
      dots.forEach((d, i) => d.classList.toggle('is-on', i === activeIdx));
      if (stepCur) stepCur.textContent = String(activeIdx + 1).padStart(2, '0');
      if (activeIdx === slides.length - 1) animateSkills();
    }

    // Scroll ilerledikçe yazılar aynı çerçevede sırayla yenilenir (bu sırada kamera tamamen sabit)
    const deckTrigger = ScrollTrigger.create({
      trigger: deckZone,
      start: 'top top',
      end: 'bottom bottom',
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const idx = Math.min(slides.length - 1, Math.floor(self.progress * slides.length * 0.999));
        setSlide(idx);
      }
    });

    // Bütün yazılar bittikten sonra (deckZone sonu → #about sonu) kamera eski sakin hızıyla terastan öne süzülür
    ScrollTrigger.create({
      trigger: about,
      start: () => deckTrigger.end,
      end: 'bottom bottom',
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        cam = self.progress;
        if (window.__aboutCam) window.__aboutCam(cam);
      }
    });

    // Adım noktalarına tıklayınca ilgili slayta yumuşakça git
    dots.forEach((d, i) => {
      d.addEventListener('click', () => {
        const targetY = deckTrigger.start + ((i + 0.5) / slides.length) * (deckTrigger.end - deckTrigger.start);
        if (window.lenis) window.lenis.scrollTo(targetY, { duration: 0.9 });
        else window.scrollTo({ top: targetY, behavior: 'smooth' });
      });
    });

    // Ölçüler değiştiği için portal.js ve diğer ScrollTrigger'ları yenile
    ScrollTrigger.refresh();
    if (window.portalTransition && window.portalTransition.measure) window.portalTransition.measure();
  } else {
    // Mobil / dar ekran: normal dikey kaydırma + belirme animasyonları + yumuşak 3B kamera ilerlemesi
    ScrollTrigger.create({
      trigger: about,
      start: 'top top',
      end: 'bottom bottom',
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        cam = self.progress;
        if (window.__aboutCam) window.__aboutCam(cam);
      }
    });
    about.querySelectorAll('.ab-bolum, .ab-soz').forEach((p) => {
      p.classList.add('ab-belir');
      gsap.to(p, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: p, start: 'top 88%', once: true } });
    });
    const skillSec = document.getElementById('ab-yetenekler');
    if (skillSec) {
      ScrollTrigger.create({ trigger: skillSec, start: 'top 88%', once: true, onEnter: animateSkills });
    }
  }
})();
