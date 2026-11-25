/* =========================================================
   HAKKIMDA SAYFASI — küçük etkileşimler
   1) Python kodunu kütüphanesiz renklendir
   2) Yetenek çubukları görünür alana girince 0'dan dolar, yüzde sayarak artar
   3) Bölümler ekrana girerken hafif yukarı kayıp belirir
   Hareketi azalt açıksa: animasyon yok, çubuklar dolu gelir.
   ========================================================= */
(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 1) Basit Python renklendirme: yorum, metin, sayı, anahtar kelime, fonksiyon adı */
  document.querySelectorAll('pre code.language-python').forEach((el) => {
    const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const kw = /\b(def|return|if|else|elif|for|in|while|import|from|print|True|False|None)\b/g;
    el.innerHTML = el.textContent.split('\n').map((line) => {
      const i = line.indexOf('#');
      const code = i >= 0 ? line.slice(0, i) : line, com = i >= 0 ? line.slice(i) : '';
      const parts = code.split(/("[^"]*")/);              // metinleri ayır, içlerine dokunma
      const out = parts.map((p) => p.startsWith('"') ? `<span class="s">${esc(p)}</span>`
        : esc(p).replace(/\b(\d+)\b/g, '<span class="n">$1</span>')
                .replace(kw, '<span class="k">$1</span>')
                .replace(/(<span class="k">def<\/span>\s+)(\w+)/, '$1<span class="f">$2</span>')).join('');
      return out + (com ? `<span class="c">${esc(com)}</span>` : '');
    }).join('\n');
  });

  if (reduce || !window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);

  /* 2) Yetenek çubukları */
  document.querySelectorAll('.yetenek-listesi li').forEach((li) => {
    const bar = li.querySelector('.bar'), label = li.querySelector('.yuzde');
    const hedef = Number(bar.getAttribute('aria-valuenow')) || 0;
    const o = { v: 0 };
    bar.style.setProperty('--dolu', 0); label.textContent = '%0';
    gsap.to(o, {
      v: hedef, duration: 1.4, ease: 'power2.out',
      scrollTrigger: { trigger: li, start: 'top 90%', once: true },
      onUpdate() { bar.style.setProperty('--dolu', o.v); label.textContent = '%' + Math.round(o.v); }
    });
  });

  /* 3) Bölümler belirir */
  document.querySelectorAll('main > section').forEach((s) => {
    s.classList.add('belir');
    gsap.to(s, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: s, start: 'top 88%', once: true } });
  });
})();
