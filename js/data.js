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
    {
      slug: 'proje-1',
      title: 'History Brush',
      category: 'Grafik Animasyon I · Proje 01',
      status: 'Proje 01',
      summary: 'Klasik kırmızı Mustang Mach 1 fotoğrafında arka plan siyah-beyaza dönüştürülüp araç Photoshop History Brush aracıyla seçici olarak renklendirildi.',
      tags: ['Photoshop', 'History Brush', 'Seçici Renk'],
      image: 'assets/images/projeler/proje1-sonrasi.jpg',
      beforeImage: 'assets/images/projeler/proje1-oncesi.jpg',
      beforeLabel: 'Öncesi',
      imagePos: '50% 52%',
      url: 'projeler.html#proje-1',
      github: ''
    },
    {
      slug: 'proje-2',
      title: 'Ürün Tanıtımı',
      category: 'Grafik Animasyon I · Proje 02',
      status: 'Proje 02',
      summary: 'Chrono Master otomatik saat için stüdyo degrade zemin, ayna yansıması, yumuşak gölge ve tipografik ürün tanıtım afişi tasarlandı.',
      tags: ['Photoshop', 'Ürün Afişi', 'Yansıma & Tipografi'],
      image: 'assets/images/projeler/proje2-sonrasi.jpg',
      beforeImage: 'assets/images/projeler/proje2-oncesi.jpg',
      beforeLabel: 'Öncesi',
      imagePos: '50% 48%',
      url: 'projeler.html#proje-2',
      github: ''
    },
    {
      slug: 'proje-3',
      title: 'Karakalem Renklendirme',
      category: 'Grafik Animasyon I · Proje 03',
      status: 'Proje 03',
      summary: 'Siyah-beyaz samuray karakalem çizimi katmanlı boyama, kızıl zırh vurguları, gölgelendirme ve kumaş tonlamalarıyla renklendirildi.',
      tags: ['Photoshop', 'Dijital Boyama', 'Katmanlar'],
      image: 'assets/images/projeler/proje3-sonrasi.jpg',
      beforeImage: 'assets/images/projeler/proje3-oncesi.jpg',
      beforeLabel: 'Öncesi',
      imagePos: '50% 18%',
      url: 'projeler.html#proje-3',
      github: ''
    },
    {
      slug: 'proje-4',
      title: 'Smart Object',
      category: 'Grafik Animasyon I · Proje 04',
      status: 'Proje 04',
      summary: 'Kapadokya gün doğumu manzarasına bağlı Smart Object katmanlarıyla 7 sıcak hava balonu yerleştirilip tek kaynak üzerinden eşzamanlı düzenlendi.',
      tags: ['Photoshop', 'Smart Object', 'Kompozisyon'],
      image: 'assets/images/projeler/proje4-sonrasi.jpg',
      beforeImage: 'assets/images/projeler/proje4-oncesi.jpg',
      beforeLabel: 'Öncesi',
      imagePos: '50% 42%',
      url: 'projeler.html#proje-4',
      github: ''
    },
    {
      slug: 'proje-5',
      title: 'Image Stack',
      category: 'Grafik Animasyon I · Proje 05',
      status: 'Proje 05',
      summary: '30 ardışık gece trafik fotoğrafı Smart Object Image Stack moduyla birleştirilerek sağ şeritteki araçlar temizlendi ve akıcı ışık izleri elde edildi.',
      tags: ['Photoshop', 'Image Stack', '30 Kare'],
      image: 'assets/images/projeler/proje5-sonrasi.jpg',
      beforeImage: 'assets/images/projeler/proje5-oncesi.jpg',
      beforeLabel: 'Öncesi',
      imagePos: '50% 50%',
      url: 'projeler.html#proje-5',
      github: ''
    },
    {
      slug: 'proje-6',
      title: 'Web Arayüzü Hazırlama',
      category: 'Grafik Animasyon I · Proje 06',
      status: 'Proje 06',
      summary: 'Türk Hava Yolları (turkishairlines.com) ana sayfası eskizden başlayarak 3 tasarım varyasyonu ve Layer Comps yapısıyla Photoshop\'ta hazırlandı.',
      tags: ['Photoshop', 'Web UI', 'Layer Comps'],
      image: 'assets/images/projeler/proje6-sonrasi.jpg',
      beforeImage: 'assets/images/projeler/proje6-eskiz.jpg',
      beforeLabel: 'Eskiz',
      imagePos: '50% 0%',
      url: 'projeler.html#proje-6',
      github: ''
    }
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
