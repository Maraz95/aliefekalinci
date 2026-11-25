/* =========================================================
   PROJELER — Denizden yükselen Akdeniz taş sütunları + Detay Paneli
   - Masaüstünde (≥ 900px, canlı 3B aktifken): kartlar js/about-3d.js'teki
     3B Akdeniz taş sütunlarının tepesine projeksiyonla yerleşir.
   - İmleç üzerine gelince hem kartın arkasında doğal gün ışığı parlar hem
     de 3B sütun başlığı aynı doğal ışıkla aydınlanır.
   - Tıklayınca tam detaylı Spotlight paneli (modal) açılır; ← → Esc ile gezilir.
   Veri: window.DATA.projects (js/data.js).
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
  const desktopMq = window.matchMedia('(min-width: 900px)');
  const reduced = () => reduceMq.matches;

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
    stage: $('pjSeaStage'),
    track: $('pjTrack'),
    modal: $('pjModal'),
    backdrop: $('pjBackdrop'),
    close: $('pjClose'),
    spot: $('pjSpot'),
    text: $('pjText'),
    media: $('pjMedia'),
    tilt: $('pjTilt'),
    frame: $('pjFrame'),
    dots: $('pjDots'),
    prev: $('pjPrev'),
    next: $('pjNext'),
    ext: $('pjExt')
  };

  const ARROW = '<svg class="pj-btn__arrow" viewBox="0 0 20 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 6h17M13 1l5 5-5 5"/></svg>';
  const GITHUB = '<svg class="pj-btn__gh" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.11.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.68.8.56A11.5 11.5 0 0 0 12 .5z"/></svg>';

  function visual(p, mini) {
    if (p.image) return `<img src="${esc(p.image)}" alt="${mini ? '' : esc(p.title)}" loading="lazy" decoding="async">`;
    if (mini) return `<span class="pj-bignum pj-bignum--mini">${p.num}</span>`;
    const status = p.status ? `<span class="pj-status mono"><i></i>${esc(p.status)}</span>` : '';
    return `<span class="pj-bignum">${p.num}</span>${status}`;
  }

  function textHtml(p) {
    const tags = p.tags.length
      ? `<ul class="pj-tags" data-spot aria-label="Teknolojiler">${p.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`
      : '';
    const viewBtn = p.url
      ? `<a class="pj-btn pj-btn--fill" href="${esc(p.url)}">Projeyi İncele ${ARROW}</a>`
      : `<span class="pj-btn pj-btn--fill is-pending" aria-disabled="true" title="Bağlantı henüz eklenmedi">Projeyi İncele ${ARROW}</span>`;
    const ghBtn = p.github
      ? `<a class="pj-btn pj-btn--line" href="${esc(p.github)}" target="_blank" rel="noopener">${GITHUB} GitHub<span class="sr-only"> (yeni sekmede açılır)</span></a>`
      : `<span class="pj-btn pj-btn--line is-pending" aria-disabled="true" title="Bağlantı henüz eklenmedi">${GITHUB} GitHub</span>`;
    return `
      <p class="pj-meta" data-spot><span class="pj-meta__num">#${p.num}</span><span>${esc(p.category)}</span></p>
      <h3 class="pj-name" id="pjModalTitle" data-spot>${esc(p.title)}</h3>
      <p class="pj-desc" data-spot>${esc(p.summary)}</p>
      ${tags}
      <div class="pj-actions" data-spot>${viewBtn + ghBtn}</div>`;
  }

  /* ---------- 1) HTML'i bas ---------- */
  els.frame.insertAdjacentHTML('afterbegin', projects.map((p, i) =>
    `<div class="pj-layer" data-i="${i}" ${i ? 'aria-hidden="true"' : ''}>${visual(p, false)}</div>`).join(''));

  els.track.innerHTML = projects.map((p, i) => `
    <button type="button" class="pj-card" role="listitem" data-i="${i}" aria-label="Proje ${i + 1}">
      <span class="pj-card__sunlight" aria-hidden="true"></span>
      <span class="pj-card__in pj-card__in--num">
        <span class="pj-card__digit" aria-hidden="true">${i + 1}</span>
      </span>
      <span class="pj-card__pedestal" aria-hidden="true">
        <span class="pj-ped__abacus"></span>
        <span class="pj-ped__shaft"></span>
      </span>
    </button>`).join('');

  els.dots.innerHTML = projects.map(() => '<span class="pj-dot"></span>').join('');

  const layers = [...els.frame.querySelectorAll('.pj-layer')];
  const cards = [...els.track.querySelectorAll('.pj-card')];
  const dots = [...els.dots.children];

  /* ---------- 2) 3B Sütun Projeksiyonu (about-3d.js her karede çağırır) ---------- */
  let is3DActive = false;
  let force2DFallback = false;
  function set3DMode(on) {
    if (is3DActive === on) return;
    is3DActive = on;
    els.track.classList.toggle('is-3d', on);
    if (on) {
      cards.forEach((c) => {
        c.style.opacity = '0';
        c.style.pointerEvents = 'none';
      });
    } else {
      cards.forEach((c) => {
        c.style.transform = '';
        c.style.opacity = '';
        c.style.pointerEvents = '';
      });
    }
  }
  // Hem masaüstünde hem telefonda canlı 3B sütun modunda başla (WebGL hata verirse __fallback2DPillars 2B'ye döner)
  set3DMode(!reduced());
  window.__fallback2DPillars = () => { force2DFallback = true; set3DMode(false); };

  window.__onPillarProject = (coords, sectionProgress) => {
    const use3D = !force2DFallback && !reduced();
    set3DMode(use3D);
    if (!use3D || !els.stage) return;

    const sr = els.stage.getBoundingClientRect();
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      const pt = coords[i];
      if (!pt || !pt.visible || sectionProgress <= 0.22) {
        c.style.opacity = '0';
        c.style.pointerEvents = 'none';
        continue;
      }
      const lx = pt.x - sr.left;
      const ly = pt.y - sr.top;
      // Sütun denizden yükselirken kart da onunla birlikte belirir ve yerine oturur
      const vis = Math.min(1, Math.max(0, (pt.progress - 0.18) / 0.65));
      const sc = 0.9 + 0.1 * vis;
      c.style.transform = `translate3d(${lx.toFixed(1)}px, ${ly.toFixed(1)}px, 0) translate(-50%, -100%) scale(${sc.toFixed(3)})`;
      c.style.opacity = vis.toFixed(3);
      c.style.pointerEvents = vis > 0.35 ? 'auto' : 'none';
    }
  };

  reduceMq.addEventListener('change', () => {
    set3DMode(!force2DFallback && !reduced());
  });

  /* ---------- 3) Detay Paneli (Modal) ---------- */
  let current = -1;
  let isOpen = false;
  let lastTrigger = null;

  function show(i) {
    const idx = (i + count) % count;
    if (idx === current) return;
    const prev = current;
    current = idx;
    const p = projects[idx];
    const animate = prev !== -1 && isOpen && !reduced() && typeof gsap !== 'undefined';

    els.text.innerHTML = textHtml(p);
    if (p.url) { els.ext.href = p.url; els.ext.removeAttribute('aria-hidden'); els.ext.classList.remove('is-pending'); }
    else { els.ext.removeAttribute('href'); els.ext.setAttribute('aria-hidden', 'true'); els.ext.classList.add('is-pending'); }

    layers.forEach((l, k) => l.setAttribute('aria-hidden', String(k !== idx)));
    if (animate) {
      gsap.to(layers[prev], { autoAlpha: 0, scale: 1, duration: 0.4, ease: 'power2.out', overwrite: true });
      gsap.fromTo(layers[idx], { autoAlpha: 0, scale: 1.04 }, { autoAlpha: 1, scale: 1, duration: 0.65, ease: 'power3.out', overwrite: true });
      gsap.fromTo(els.text.querySelectorAll('[data-spot]'), { autoAlpha: 0, y: 14 },
        { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.04, ease: 'power3.out' });
    } else if (typeof gsap !== 'undefined') {
      layers.forEach((l, k) => gsap.set(l, { autoAlpha: k === idx ? 1 : 0, scale: 1 }));
    } else {
      layers.forEach((l, k) => { l.style.opacity = k === idx ? 1 : 0; l.style.visibility = k === idx ? 'visible' : 'hidden'; });
    }
    dots.forEach((d, k) => d.classList.toggle('is-active', k === idx));
  }

  function openModal(i, trigger) {
    lastTrigger = trigger || cards[i];
    show(i);
    isOpen = true;
    els.modal.classList.add('is-open');
    els.modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';
    if (window.lenis) window.lenis.stop();
    if (window.__projectsHover) window.__projectsHover(i);
    els.close.focus({ preventScroll: true });
  }

  function closeModal() {
    if (!isOpen) return;
    isOpen = false;
    els.modal.classList.remove('is-open');
    els.modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    if (window.lenis) window.lenis.start();
    if (window.__projectsHover) window.__projectsHover(-1);
    if (lastTrigger) lastTrigger.focus({ preventScroll: true });
  }

  /* ---------- 4) Olaylar ---------- */
  const cursor = $('cursor');
  cards.forEach((c, i) => {
    c.addEventListener('click', () => openModal(i, c));
    c.addEventListener('pointerenter', () => {
      c.classList.add('is-lit');
      if (window.__projectsHover) window.__projectsHover(i);
      if (cursor) cursor.classList.add('is-hover');
    });
    c.addEventListener('pointerleave', () => {
      c.classList.remove('is-lit');
      if (!isOpen && window.__projectsHover) window.__projectsHover(-1);
      if (cursor) cursor.classList.remove('is-hover');
    });
    c.addEventListener('focus', () => {
      if (window.__projectsHover) window.__projectsHover(i);
    });
    c.addEventListener('blur', () => {
      if (!isOpen && window.__projectsHover) window.__projectsHover(-1);
    });
  });

  els.close.addEventListener('click', closeModal);
  els.backdrop.addEventListener('click', closeModal);
  els.prev.addEventListener('click', () => { show(current - 1); if (window.__projectsHover) window.__projectsHover(current); });
  els.next.addEventListener('click', () => { show(current + 1); if (window.__projectsHover) window.__projectsHover(current); });

  // Telefonda proje detay panelinde sağa/sola kaydırarak projeler arası geçiş
  let swipeX = null, swipeY = null;
  els.modal.addEventListener('touchstart', (e) => {
    if (!isOpen || e.touches.length !== 1) return;
    swipeX = e.touches[0].clientX;
    swipeY = e.touches[0].clientY;
  }, { passive: true });
  els.modal.addEventListener('touchend', (e) => {
    if (!isOpen || swipeX === null) return;
    const dx = e.changedTouches[0].clientX - swipeX;
    const dy = e.changedTouches[0].clientY - swipeY;
    swipeX = swipeY = null;
    if (Math.abs(dx) > 52 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      show(current + (dx < 0 ? 1 : -1));
    }
  }, { passive: true });

  window.addEventListener('keydown', (e) => {
    if (!isOpen) return;
    if (e.key === 'Escape') closeModal();
    else if (e.key === 'ArrowRight') { show(current + 1); if (window.__projectsHover) window.__projectsHover(current); }
    else if (e.key === 'ArrowLeft') { show(current - 1); if (window.__projectsHover) window.__projectsHover(current); }
  });

  els.text.addEventListener('mouseover', (e) => { if (e.target.closest('a')) cursor && cursor.classList.add('is-hover'); });
  els.text.addEventListener('mouseout', (e) => { if (e.target.closest('a')) cursor && cursor.classList.remove('is-hover'); });

  show(0);

  /* ---------- 5) Animasyonlar (js/animations.js yükleme bitince çağırır) ---------- */
  function initMotion() {
    if (typeof gsap === 'undefined') return;
    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('.pj-index, .pj-title, .pj-intro', {
        autoAlpha: 0, y: 26, stagger: 0.1, duration: 0.85, ease: 'power3.out',
        scrollTrigger: { trigger: '#projects', start: 'top 72%', once: true }
      });
    });

    // Detay panelinde fare konumuna göre görsele hafif 3B eğim
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
      return () => {
        els.media.removeEventListener('pointermove', move);
        els.media.removeEventListener('pointerleave', leave);
        gsap.set(els.tilt, { rotationX: 0, rotationY: 0 });
      };
    });
  }

  window.Projects = { initMotion, open: openModal, close: closeModal };
})();
