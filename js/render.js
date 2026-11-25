/* =========================================================
   RENDER — DATA içindeki bilgileri HTML'e basar
   ========================================================= */
(function () {
  const D = window.DATA;

  // Güvenlik: metinleri HTML'e koymadan önce özel karakterleri kaçır
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  /* --- Kayan şeritler: içerik 4 kez tekrarlanır, sonsuz döngü için --- */
  function renderSkills() {
    document.querySelectorAll('.marquee').forEach((m) => {
      const items = D.skills[m.dataset.row].map((s) => `<span class="marquee__item">${esc(s)}</span>`).join('');
      const half = items + items;
      m.querySelector('.marquee__track').innerHTML = half + half;
    });
  }

  /* Projeler bölümü: js/projects.js */

  /* --- Zaman çizelgesi --- */
  function renderTimeline() {
    const tl = document.getElementById('timelineList'); if (!tl) return;
    tl.innerHTML = D.timeline.map((t) => `
      <li class="tl-item">
        <span class="mono accent">${esc(t.year)}</span>
        <h3 class="tl-item__title">${esc(t.title)}</h3>
        <p class="tl-item__text">${esc(t.text)}</p>
      </li>`).join('');
  }

  /* --- Blog kartları (son 3 yazı) --- */
  function renderBlog() {
    const fmt = (d) => new Date(d).toLocaleDateString(document.documentElement.lang === 'en' ? 'en-GB' : 'tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById('blogGrid').innerHTML = D.posts.slice(0, 3).map((p) => `
      <a class="bcard" href="blog.html?v=2#${esc(p.slug)}" data-cursor>
        <div class="bcard__meta mono"><span class="accent">${esc(p.tag)}</span><span>${fmt(p.date)}</span></div>
        <h3 class="bcard__title">${esc(p.title)}</h3>
        <p class="bcard__excerpt">${esc(p.excerpt)}</p>
        <span class="bcard__more mono">Devamını oku →</span>
      </a>`).join('');
  }

  renderSkills();
  renderTimeline();
  renderBlog();
})();
