/* =========================================================
   GALERİ — kategori filtreleri, yükselti profili bağlantısı ve film şeritli tam boyut görüntüleyici
   Fotoğraf kırpılmadan, ekrana sığdığı sürece orijinal boyutunda açılır;
   altında başlık, rakım/konum etiketi, açıklama ve hızlı geçiş film şeridi durur.
   Gezinme: ← → tuşları, ok düğmeleri, film şeridi, telefonda sağa/sola kaydırma.
   Kapatma: × düğmesi, Esc ya da fotoğrafın dışına basmak.
   (Yerel <dialog>: odak içeride kalır, ekran okuyucular doğru duyurur.)
   ========================================================= */
(() => {
  const en = document.documentElement.lang === 'en';
  const L = en
    ? { close: 'Close', prev: 'Previous photo', next: 'Next photo', viewer: 'Photo viewer', strip: 'Gallery filmstrip' }
    : { close: 'Kapat', prev: 'Önceki fotoğraf', next: 'Sonraki fotoğraf', viewer: 'Fotoğraf görüntüleyici', strip: 'Galeri film şeridi' };

  const pad = (n) => String(n).padStart(2, '0');

  document.querySelectorAll('.mozaik').forEach((grid) => {
    const items = [...grid.querySelectorAll('.mz-item')];
    if (!items.length) return;
    const section = grid.closest('section') || document;

    // 1) Rakım / konum etiketlerini her fotoğrafın sağ üst köşesine ekle
    items.forEach((it) => {
      const meta = it.dataset.meta;
      const btn = it.querySelector('.mz-btn');
      if (meta && btn && !btn.querySelector('.mz-meta')) {
        const badge = document.createElement('span');
        badge.className = 'mz-meta mono';
        badge.setAttribute('aria-hidden', 'true');
        badge.textContent = meta;
        btn.appendChild(badge);
      }
    });

    // 2) Kategori filtreleme (yalnızca #mzFilters bulunan bölümde)
    let visible = [...items];
    const filterBar = section.querySelector('#mzFilters');
    const filterBtns = filterBar ? [...filterBar.querySelectorAll('.mz-filter')] : [];
    const countEl = filterBar ? filterBar.querySelector('#mzFilterCount') : null;

    function applyFilter(cat) {
      visible = [];
      items.forEach((it) => {
        const match = cat === 'all' || it.dataset.cat === cat;
        it.classList.toggle('is-hidden', !match);
        if (match) visible.push(it);
      });
      grid.classList.toggle('is-filtered', cat !== 'all');
      filterBtns.forEach((b) => {
        const on = b.dataset.filter === cat;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      if (countEl) countEl.textContent = `${pad(visible.length)} / ${pad(items.length)}`;
      if (window.ScrollTrigger) {
        requestAnimationFrame(() => window.ScrollTrigger.refresh());
      }
    }

    filterBtns.forEach((btn) => {
      btn.addEventListener('click', () => applyFilter(btn.dataset.filter || 'all'));
    });

    // 3) Tam boyut <dialog> görüntüleyici + alt film şeridi
    const dlg = document.createElement('dialog');
    dlg.className = 'mz-kutu';
    dlg.setAttribute('aria-label', L.viewer);
    dlg.innerHTML = `
      <figure class="mz-kutu__fig">
        <img class="mz-kutu__img" alt="">
        <figcaption class="mz-kutu__alt">
          <span class="mz-kutu__sol">
            <span class="mz-kutu__sayac mono"></span>
            <span class="mz-kutu__meta mono" hidden></span>
          </span>
          <span class="mz-kutu__metin"><b class="mz-kutu__baslik"></b><span class="mz-kutu__aciklama"></span></span>
        </figcaption>
        <div class="mz-kutu__strip" role="list" aria-label="${L.strip}"></div>
      </figure>
      <button type="button" class="mz-kutu__btn mz-kutu__kapat" aria-label="${L.close}">×</button>
      <button type="button" class="mz-kutu__btn mz-kutu__onceki" aria-label="${L.prev}">‹</button>
      <button type="button" class="mz-kutu__btn mz-kutu__sonraki" aria-label="${L.next}">›</button>`;
    document.body.appendChild(dlg);
    const $ = (s) => dlg.querySelector(s);
    const strip = $('.mz-kutu__strip');
    let cur = 0;

    function buildStrip() {
      strip.innerHTML = '';
      strip.hidden = visible.length <= 1;
      visible.forEach((it, idx) => {
        const src = it.querySelector('img');
        const title = it.querySelector('figcaption b')?.textContent || '';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mz-kutu__thumb';
        btn.setAttribute('role', 'listitem');
        btn.setAttribute('aria-label', title || `${idx + 1}`);
        btn.innerHTML = `<img src="${src.currentSrc || src.src}" alt="" loading="lazy" decoding="async">`;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          show(idx);
        });
        strip.appendChild(btn);
      });
    }

    function show(i) {
      if (!visible.length) return;
      cur = (i + visible.length) % visible.length;
      const it = visible[cur], src = it.querySelector('img'), cap = it.querySelector('figcaption');
      const img = $('.mz-kutu__img');
      img.src = src.currentSrc || src.src;
      img.alt = src.alt;
      img.width = src.naturalWidth || src.width;      // orijinal boyut (ekrana sığmazsa CSS küçültür)
      img.height = src.naturalHeight || src.height;
      $('.mz-kutu__baslik').textContent = cap.querySelector('b')?.textContent || '';
      const ac = cap.querySelector('span')?.textContent.trim() || '';
      $('.mz-kutu__aciklama').textContent = ac;
      $('.mz-kutu__aciklama').hidden = !ac;
      const meta = it.dataset.meta || '';
      const metaEl = $('.mz-kutu__meta');
      metaEl.textContent = meta;
      metaEl.hidden = !meta;
      $('.mz-kutu__sayac').textContent = `${pad(cur + 1)} / ${pad(visible.length)}`;

      const thumbs = [...strip.querySelectorAll('.mz-kutu__thumb')];
      thumbs.forEach((t, idx) => {
        const on = idx === cur;
        t.classList.toggle('is-active', on);
        if (on) t.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
      });
      const single = visible.length <= 1;
      $('.mz-kutu__onceki').hidden = single;
      $('.mz-kutu__sonraki').hidden = single;
    }

    function openByItem(it) {
      let idx = visible.indexOf(it);
      if (idx === -1) {
        applyFilter('all');
        idx = visible.indexOf(it);
      }
      if (idx === -1) return;
      buildStrip();
      show(idx);
      if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
      document.documentElement.classList.add('mz-acik');
      if (window.lenis && window.lenis.stop) window.lenis.stop();
    }

    function close() {
      if (dlg.open) dlg.close();
    }

    dlg.addEventListener('close', () => {
      document.documentElement.classList.remove('mz-acik');
      if (window.lenis && window.lenis.start) window.lenis.start();
      const activeItem = visible[cur];
      if (activeItem) activeItem.querySelector('.mz-btn').focus({ preventScroll: true });
    });

    items.forEach((it) => it.querySelector('.mz-btn').addEventListener('click', () => openByItem(it)));
    // 3B mağara duvarındaki bir fotoğrafa tıklanınca aynı tam boyut görüntüleyiciyi aç
    if (grid.id === 'galeriMozaik' || !window.__openGalleryPhoto) {
      window.__openGalleryPhoto = (idx) => {
        if (items[idx]) openByItem(items[idx]);
      };
    }
    $('.mz-kutu__kapat').addEventListener('click', close);
    $('.mz-kutu__onceki').addEventListener('click', () => show(cur - 1));
    $('.mz-kutu__sonraki').addEventListener('click', () => show(cur + 1));
    // Fotoğrafın ve yazının dışına (karanlık alana) basınca kapanır
    dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.classList.contains('mz-kutu__fig')) close(); });
    dlg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(cur - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); show(cur + 1); }
    });
    // Telefonda kaydırarak gezinme
    let x0 = null;
    dlg.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    dlg.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) show(cur + (dx < 0 ? 1 : -1));
    });

    // 4) Zirve & Yükselti Profili durakları: SVG noktalarıyla eşleşir ve ilgili fotoğrafı açar
    const elev = section.querySelector('#mzElev');
    if (elev) {
      elev.querySelectorAll('.mz-stop[data-pin]').forEach((stop) => {
        const pinId = stop.dataset.pin;
        const dot = elev.querySelector(`.mz-elev__dot[data-pin="${pinId}"]`);
        if (dot) {
          stop.addEventListener('mouseenter', () => dot.classList.add('is-hot'));
          stop.addEventListener('mouseleave', () => dot.classList.remove('is-hot'));
          stop.addEventListener('focus', () => dot.classList.add('is-hot'));
          stop.addEventListener('blur', () => dot.classList.remove('is-hot'));
        }
        if (stop.dataset.openPhoto !== undefined) {
          const targetIdx = Number(stop.dataset.openPhoto);
          stop.addEventListener('click', () => {
            if (items[targetIdx]) openByItem(items[targetIdx]);
          });
        }
      });
    }
  });
})();
