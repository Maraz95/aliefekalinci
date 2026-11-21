/* =========================================================
   PROJELER — Spotlight + yatay galeri
   - Galeriden seçim yapılınca üstteki büyük vitrin (Spotlight) güncellenir.
   - Masaüstünde fareyle üzerine gelmek = geçici önizleme, tıklamak = kalıcı seçim.
   - Dokunmatikte yalnızca dokunarak seçim var; hiçbir şey hover'a bağlı değil.
   - Klavye: galeri bir sekme listesi (tablist); ← → ↑ ↓ Home End ile gezilir.
   Veri: window.DATA.projects (js/data.js). Animasyonlar: GSAP + ScrollTrigger.
   ========================================================= */
(function () {
  const D = window.DATA;
  const list = (D && D.projects) || [];
  if (!list.length || !document.getElementById('projects')) return;

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const pad = (n) => String(n).padStart(2, '0');
  const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => reduceMq.matches;

  // Veriyi ekranda kullanılacak biçime getirir (içerik js/data.js'te)
  const view = (p, i) => ({
    num: pad(i + 1),
    title: p.title || `Proje ${pad(i + 1)}`,
    category: p.category || '',
    status: p.status || '',
    summary: p.summary || '',
    tags: Array.isArray(p.tags) ? p.tags : [],
    image: p.image || '',
    url: p.url || '',
    github: p.github || ''
  });
  const projects = list.map(view);
  const count = projects.length;

  const els = {
    spot: $('pjSpot'), text: $('pjText'), media: $('pjMedia'), tilt: $('pjTilt'),
    frame: $('pjFrame'), track: $('pjTrack'), dots: $('pjDots'),
    prev: $('pjPrev'), next: $('pjNext'), ext: $('pjExt')
  };

  const ARROW = '<svg class="pj-btn__arrow" viewBox="0 0 20 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 6h17M13 1l5 5-5 5"/></svg>';
  const GITHUB = '<svg class="pj-btn__gh" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.11.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.68.8.56A11.5 11.5 0 0 0 12 .5z"/></svg>';
  const DIAG = '<svg class="pj-card__arrow" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11L11 3M5 3h6v6"/></svg>';

  // Görsel alanı. Ekran görüntüsü varsa o gösterilir.
  // Yoksa: büyük konturlu proje numarası + küçük durum etiketi (grid çerçevede sabit durur).
  function visual(p, mini) {
    if (p.image) return `<img src="${esc(p.image)}" alt="${mini ? '' : esc(p.title)}" loading="lazy" decoding="async">`;
    if (mini) return `<span class="pj-bignum pj-bignum--mini">${p.num}</span>`;
    const status = p.status ? `<span class="pj-status mono"><i></i>${esc(p.status)}</span>` : '';
    return `<span class="pj-bignum">${p.num}</span>${status}`;
  }

  // Spotlight'ın sol tarafı (her seçimde yeniden yazılır)
  function textHtml(p) {
    const tags = p.tags.length
      ? `<ul class="pj-tags" data-spot aria-label="Teknolojiler">${p.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`
      : '';
    // Butonlar her zaman görünür; bağlantı henüz yoksa pasif durur
    const view = p.url
      ? `<a class="pj-btn pj-btn--fill" href="${esc(p.url)}">Projeyi İncele ${ARROW}</a>`
      : `<span class="pj-btn pj-btn--fill is-pending" aria-disabled="true" title="Bağlantı henüz eklenmedi">Projeyi İncele ${ARROW}</span>`;
    const gh = p.github
      ? `<a class="pj-btn pj-btn--line" href="${esc(p.github)}" target="_blank" rel="noopener">${GITHUB} GitHub<span class="sr-only"> (yeni sekmede açılır)</span></a>`
      : `<span class="pj-btn pj-btn--line is-pending" aria-disabled="true" title="Bağlantı henüz eklenmedi">${GITHUB} GitHub</span>`;
    const actions = view + gh;
    return `
      <p class="pj-meta" data-spot><span class="pj-meta__num">#${p.num}</span><span>${esc(p.category)}</span></p>
      <h3 class="pj-name" data-spot>${esc(p.title)}</h3>
      <p class="pj-desc" data-spot>${esc(p.summary)}</p>
      ${tags}
      <div class="pj-actions" data-spot>${actions}</div>`;
  }

  /* ---------- 1) HTML'i bas ---------- */
  // Katmanlar çerçevenin içine eklenir; pencere düğmeleri ve grid yerinde kalır
  els.frame.insertAdjacentHTML('afterbegin', projects.map((p, i) =>
    `<div class="pj-layer" data-i="${i}" ${i ? 'aria-hidden="true"' : ''}>${visual(p, false)}</div>`).join(''));
  els.track.innerHTML = projects.map((p, i) => `
    <button type="button" class="pj-card" role="tab" id="pj-tab-${i}" data-i="${i}"
            aria-controls="pjSpot" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">
      <span class="pj-card__in">
        <span class="pj-card__glow" aria-hidden="true"></span>
        <span class="pj-card__thumb" aria-hidden="true">${visual(p, true)}</span>
        <span class="pj-card__body">
          <span class="pj-card__title">${esc(p.title)}</span>
          <span class="pj-card__cat">${esc(p.category)}</span>
        </span>
        ${DIAG}
      </span>
    </button>`).join('');
  els.dots.innerHTML = projects.map(() => '<span class="pj-dot"></span>').join('');

  const layers = [...els.frame.querySelectorAll('.pj-layer')];
  const cards = [...els.track.querySelectorAll('.pj-card')];
  const dots = [...els.dots.children];

  /* ---------- 2) Durum ---------- */
  let selected = 0;      // kalıcı seçim (tık / klavye / oklar)
  let preview = null;    // fareyle önizleme (geçici)
  let shown = -1;        // şu an vitrinde görünen

  // Vitrini verilen projeye geçirir
  function show(i) {
    if (i === shown) return;
    const prev = shown;
    shown = i;
    const p = projects[i];
    const animate = prev !== -1 && !reduced() && typeof gsap !== 'undefined';

    // Metin
    els.text.innerHTML = textHtml(p);
    els.spot.setAttribute('aria-labelledby', `pj-tab-${i}`);
    // Sağ üstteki dış bağlantı ikonu: bağlantı varsa tıklanır, yoksa yalnızca süs
    if (p.url) { els.ext.href = p.url; els.ext.removeAttribute('aria-hidden'); els.ext.classList.remove('is-pending'); }
    else { els.ext.removeAttribute('href'); els.ext.setAttribute('aria-hidden', 'true'); els.ext.classList.add('is-pending'); }

    // Görsel katmanları: eskisi söner, yenisi hafif büyükten yerine oturarak belirir
    layers.forEach((l, k) => l.setAttribute('aria-hidden', String(k !== i)));
    if (animate) {
      gsap.to(layers[prev], { autoAlpha: 0, scale: 1, duration: 0.45, ease: 'power2.out', overwrite: true });
      gsap.fromTo(layers[i], { autoAlpha: 0, scale: 1.04 }, { autoAlpha: 1, scale: 1, duration: 0.75, ease: 'power3.out', overwrite: true });
      gsap.fromTo(els.text.querySelectorAll('[data-spot]'), { autoAlpha: 0, y: 14 },
        { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.045, ease: 'power3.out' });
    } else if (typeof gsap !== 'undefined') {
      layers.forEach((l, k) => gsap.set(l, { autoAlpha: k === i ? 1 : 0, scale: 1 }));
    } else {
      layers.forEach((l, k) => { l.style.opacity = k === i ? 1 : 0; l.style.visibility = k === i ? 'visible' : 'hidden'; });
    }

    // Galeri ve noktalar: aktif kart mavi çerçeveyle belirginleşir
    cards.forEach((c, k) => c.classList.toggle('is-shown', k === i));
    dots.forEach((d, k) => d.classList.toggle('is-active', k === i));
    // Aktif kartın çerçevesi yumuşakça aydınlanır, diğerlerininki söner
    const glows = cards.map((c) => c.querySelector('.pj-card__glow'));
    if (animate) {
      glows.forEach((g, k) => { if (k !== i) gsap.to(g, { autoAlpha: 0, duration: 0.35, overwrite: true }); });
      gsap.fromTo(glows[i], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, ease: 'power2.out', overwrite: true });
      gsap.fromTo(cards[i].querySelector('.pj-card__in'), { scale: 0.97 }, { scale: 1, duration: 0.5, ease: 'back.out(2)', clearProps: 'scale' });
    } else {
      glows.forEach((g, k) => { g.style.opacity = k === i ? 1 : 0; g.style.visibility = k === i ? 'visible' : 'hidden'; });
    }
  }

  // Kalıcı seçim
  function select(i, focus) {
    selected = (i + count) % count;
    preview = null;
    cards.forEach((c, k) => {
      c.setAttribute('aria-selected', String(k === selected));
      c.tabIndex = k === selected ? 0 : -1;
    });
    show(selected);
    if (focus) cards[selected].focus({ preventScroll: true });
    scrollCardIntoView(selected);
  }

  // Mobilde (yatay kayan galeri) seçili kartı ortaya getir; sayfayı dikeyde kaydırmaz
  function scrollCardIntoView(i) {
    const t = els.track, c = cards[i];
    if (t.scrollWidth <= t.clientWidth) return;
    t.scrollTo({ left: c.offsetLeft - (t.clientWidth - c.offsetWidth) / 2, behavior: reduced() ? 'auto' : 'smooth' });
  }

  /* ---------- 3) Olaylar ---------- */
  cards.forEach((c, i) => {
    c.addEventListener('click', () => select(i));
    // Hover önizlemesi yalnızca gerçek farede
    c.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      preview = i;
      show(i);
    });
  });
  els.track.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'mouse' || preview === null) return;
    preview = null;
    show(selected);
  });

  const KEYS = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
  els.track.addEventListener('keydown', (e) => {
    let to = null;
    if (e.key in KEYS) to = selected + KEYS[e.key];
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = count - 1;
    if (to === null) return;
    e.preventDefault();
    select(to, true);
  });

  els.prev.addEventListener('click', () => select(selected - 1));
  els.next.addEventListener('click', () => select(selected + 1));

  // Metin her seçimde yeniden yazıldığı için özel imlecin hover halkasını burada yönet
  const cursor = $('cursor');
  els.text.addEventListener('mouseover', (e) => { if (e.target.closest('a')) cursor && cursor.classList.add('is-hover'); });
  els.text.addEventListener('mouseout', (e) => { if (e.target.closest('a')) cursor && cursor.classList.remove('is-hover'); });

  show(0);

  /* ---------- 4) Animasyonlar (js/animations.js, yükleme ekranı bitince çağırır) ---------- */
  function initMotion() {
    if (typeof gsap === 'undefined') return;

    const mm = gsap.matchMedia();

    // Scroll ile giriş: açıklama, vitrin ve kartlar sırayla belirir
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.timeline({
        defaults: { ease: 'power3.out', duration: 0.9 },
        scrollTrigger: { trigger: '#projects', start: 'top 65%', once: true }
      })
        .from('.pj-index, .pj-title, .pj-intro', { autoAlpha: 0, y: 30, stagger: 0.1 })
        .from('.pj-spot-wrap', { autoAlpha: 0, y: 50 }, '-=0.5')
        .from('.pj-spot__text', { autoAlpha: 0, x: -24 }, '-=0.6')
        .from('.pj-tilt', { autoAlpha: 0, x: 60, duration: 1.2 }, '<')
        .from('.pj-card', { autoAlpha: 0, y: 40, stagger: 0.08, duration: 0.7 }, '-=0.8')
        .from('.pj-arrow, .pj-dots', { autoAlpha: 0, duration: 0.6 }, '-=0.4')
        .from('.pj-ground', { autoAlpha: 0, duration: 1.2 }, '<');

      // Arka plan süsleri çok yavaş ve hafif hareket eder (dikkat dağıtmaz)
      gsap.to('.pj-streaks-l', { x: 24, y: -8, duration: 9, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      gsap.to('.pj-streaks-r', { x: -24, y: 6, duration: 11, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      gsap.to('.pj-ground__ringset', { scale: 1.025, transformOrigin: '50% 63%', duration: 6, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      gsap.to('.pj-ground__plane', { backgroundPosition: '0px 48px', duration: 8, ease: 'none', repeat: -1 });
    });

    // Masaüstünde fare konumuna göre görsele çok hafif eğim (derinlik hissi)
    mm.add('(prefers-reduced-motion: no-preference) and (min-width: 900px) and (pointer: fine)', () => {
      const rx = gsap.quickTo(els.tilt, 'rotationX', { duration: 0.8, ease: 'power3.out' });
      const ry = gsap.quickTo(els.tilt, 'rotationY', { duration: 0.8, ease: 'power3.out' });
      const move = (e) => {
        const r = els.media.getBoundingClientRect();
        ry(((e.clientX - r.left) / r.width - 0.5) * 6);
        rx(-((e.clientY - r.top) / r.height - 0.5) * 4);
      };
      const leave = () => { rx(0); ry(0); };
      els.media.addEventListener('pointermove', move);
      els.media.addEventListener('pointerleave', leave);
      // Temizlik: koşul bozulunca (ör. ekran daralınca) dinleyiciler kaldırılır
      return () => {
        els.media.removeEventListener('pointermove', move);
        els.media.removeEventListener('pointerleave', leave);
        gsap.set(els.tilt, { rotationX: 0, rotationY: 0 });
      };
    });
  }

  window.Projects = { initMotion };
})();
