/* =========================================================
   DATA — şimdilik sabit veri.
   İleride bu dosyanın yerini Supabase'den gelen veri alacak;
   admin panelinden eklenen projeler/yazılar buraya düşecek.
   "XX" yazan yerleri kendi bilgilerinle değiştir.
   ========================================================= */
window.DATA = {
  skills: {
    saha: ['Pano montajı', 'Otomasyon', 'Kablolama', 'Topraklama', 'Sensör sistemleri', 'Arıza tespiti'],
    kod:  ['HTML', 'CSS', 'JavaScript', 'GSAP', 'Supabase', 'Git', 'Oyun geliştirme']
  },

  /* Projeler: şimdilik geçici içerik. Gerçek bilgileri buraya yazman yeterli.
       title    : proje adı
       category : kategori metni          ör. 'Masaüstü uygulama'
       summary  : kısa açıklama (1-2 satır)
       tags     : teknoloji etiketleri    ör. ['Python', 'FFmpeg']
       status   : görsel alanındaki küçük durum etiketi  ör. 'Yayında', 'Geliştiriliyor'
       image    : ekran görüntüsü yolu    ör. 'assets/projects/media-converter.webp' (boşsa alan boş kalır)
       url      : "Projeyi İncele" bağlantısı (boşsa buton pasif)
       github   : GitHub deposu bağlantısı (boşsa buton pasif) */
  projects: [
    { slug: 'grafik-animasyon', title: 'Grafik Animasyon I', category: 'Ders çalışmaları', status: 'Eklenecek', summary: 'Grafik Animasyon I dersinde yaptığım çalışmalar. Görseller ve açıklamalar projeler sayfasında.', tags: ['Grafik', 'Animasyon'], image: 'assets/images/projeler/grafik-animasyon-01.svg', url: 'projeler.html', github: '' },
    { slug: 'portfolyo', title: 'Bu Portfolyo Sitesi', category: 'Web', status: 'Yayında', summary: 'Fiber optik tünel, Blender\'da modellenip Three.js ile canlı çizilen 3B Hakkımda sahnesi ve kaydırma animasyonları.', tags: ['Three.js', 'GSAP', 'Blender', 'JavaScript'], image: '', url: 'projeler.html', github: 'https://github.com/Maraz95' },
    { slug: 'kumes', title: 'Full Otomatik Kümes', category: 'Saha · Elektrik', status: '2026', summary: 'Bilecik\'te tam otomatik kümeste kablo çekimi ve elektrik tesisatı çalışmaları.', tags: ['Tesisat', 'Kablolama', 'Otomasyon'], image: '', url: 'projeler.html', github: '' },
    { slug: 'rms-a', title: 'RMS-A İstasyonu', category: 'Saha · Elektrik', status: '2025', summary: 'Doğalgaz istasyonunda pano bağlantıları, saha kablolaması ve projektör montajı.', tags: ['Pano', 'Kablolama', 'Saha'], image: '', url: 'projeler.html', github: '' },
    { slug: 'oyun', title: 'Oyun Projem', category: 'Oyun · Devlog', status: 'Geliştiriliyor', summary: 'Kendi geliştirdiğim oyun projesi. Tasarım, mekanikler ve geliştirme sürecini blogda paylaşıyorum.', tags: ['Oyun', 'Devlog', 'Kod'], image: '', url: 'projeler.html', github: 'https://github.com/Maraz95' },
    { slug: 'otomasyon', title: 'Endüstriyel Otomasyon', category: 'PLC · Yazılım', status: 'Yakında', summary: 'Sahadaki pano ve sensör mantığını Python ve PLC kontrol arayüzleriyle birleştiren sistem çalışması.', tags: ['PLC', 'Python', 'Otomasyon'], image: '', url: 'projeler.html', github: '' }
  ],

  /* Eski proje kayıtları (silinmedi, gerekirse yukarı geri taşınabilir):
    { slug: 'kumes', category: 'saha', year: '20XX', title: 'Full otomasyon kümes',
      summary: 'Sıcaklık, havalandırma ve aydınlatmanın otomatik kontrol edildiği kümes projesinde elektrik ve pano işleri.',
      tags: ['Pano', 'Sensör', 'Otomasyon'] },
    { slug: 'rms-a', category: 'saha', year: '20XX', title: 'RMS-A istasyonu',
      summary: 'Doğalgaz RMS-A istasyonunda elektrik tesisatı ve saha uygulamaları.',
      tags: ['Tesisat', 'Topraklama', 'Saha'] },
    { slug: 'oyun', category: 'kod', year: '2026', title: 'Oyun projem',
      summary: 'Kendi geliştirdiğim oyun. Geliştirme sürecini blogda devlog olarak paylaşıyorum.',
      tags: ['Oyun', 'Devlog'] },
    { slug: 'portfolyo', category: 'kod', year: '2026', title: 'Bu portfolyo',
      summary: 'Scroll animasyonları, admin paneli ve blogu olan kişisel sitem.',
      tags: ['HTML', 'CSS', 'JS', 'GSAP', 'Supabase'] }
  */

  timeline: [
    { year: '20XX', title: 'Elektrikçilik', text: 'Sahada çalışmaya başladım: tesisat, pano ve arıza işleri.' },
    { year: '20XX', title: 'Otomasyon kümes', text: 'Tam otomasyonlu bir kümesin elektrik ve kontrol tarafında çalıştım.' },
    { year: '20XX', title: 'RMS-A istasyonu', text: 'Doğalgaz istasyonu projesinde saha tecrübemi büyüttüm.' },
    { year: '20XX', title: 'Yazılıma geçiş', text: 'Sahada öğrendiğim sistem mantığını kod yazmaya taşıdım.' },
    { year: '2026', title: 'Bugün', text: 'Kendi oyunumu geliştiriyor, bu siteyi yayınlıyorum.' }
  ],

  posts: [
    { slug: 'sifirdan-projeye', date: '2026-11-21', tag: 'Yazılım', title: 'Sıfırdan Projeye: Bir Yazılım Fikri Nasıl Ürüne Dönüşür?', excerpt: 'Bir yazılım projesine başlamak çoğu zaman birkaç satır kod yazmaktan fazlasını gerektirir; fikri çalışan bir ürüne dönüştürmek için planlama, araştırma ve sabır gerekir.' },
    { slug: 'elektrik-ve-yapay-zeka', date: '2026-11-22', tag: 'Teknoloji', title: 'Elektrik ve Yapay Zekâ', excerpt: 'Elektrik sistemleri artık yalnızca enerji üretimi ve dağıtımından ibaret değil; yapay zekâ bu dönüşümün önemli parçalarından biri.' },
    { slug: 'yapay-zeka-gunluk-hayat', date: '2026-11-23', tag: 'Yapay Zekâ', title: 'Yapay Zekâ Günlük Hayatımızı Nasıl Değiştiriyor?', excerpt: 'Eskiden yalnızca bilim kurgu filmlerinde karşılaştığımız yapay zekâ teknolojileri, bugün eğitimden yazılıma günlük hayatımızın pek çok alanında aktif olarak kullanılıyor.' }
  ]
};
