/* İletişim formu: sunucu yok. Form doğrulanınca kullanıcının e-posta uygulaması
   mesaj hazır şekilde açılır (mailto). JS kapalıysa form doğrudan mailto ile gönderilir. */
(() => {
  const form = document.getElementById('iletisimFormu');
  const durum = document.getElementById('formDurum');
  if (!form) return;
  const TO = 'efekalinci4@gmail.com';
  const t = (s) => (window.I18N ? window.I18N.t(s) : s);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      durum.textContent = t('Lütfen tüm alanları doğru doldur.');
      return;
    }
    const d = Object.fromEntries(new FormData(form));
    const body = `${d.mesaj}\n\n— ${d.ad} (${d.eposta})`;
    location.href = `mailto:${TO}?subject=${encodeURIComponent(d.konu)}&body=${encodeURIComponent(body)}`;
    durum.textContent = t('E-posta uygulaman açılıyor… Açılmazsa doğrudan şu adrese yazabilirsin:') + ' ' + TO;
  });
})();
