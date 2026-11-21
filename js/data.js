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
    { slug: 'proje-01', title: 'Proje 01', category: 'Kategori', status: 'Durum', summary: 'Projenin kısa açıklaması buraya gelecek. Bu alan iki satırlık bir tanıtım metni için ayrıldı.', tags: ['Etiket', 'Etiket', 'Etiket', 'Etiket'], image: '', url: '', github: '' },
    { slug: 'proje-02', title: 'Proje 02', category: 'Kategori', status: 'Durum', summary: 'Projenin kısa açıklaması buraya gelecek. Bu alan iki satırlık bir tanıtım metni için ayrıldı.', tags: ['Etiket', 'Etiket', 'Etiket'], image: '', url: '', github: '' },
    { slug: 'proje-03', title: 'Proje 03', category: 'Kategori', status: 'Durum', summary: 'Projenin kısa açıklaması buraya gelecek. Bu alan iki satırlık bir tanıtım metni için ayrıldı.', tags: ['Etiket', 'Etiket', 'Etiket', 'Etiket'], image: '', url: '', github: '' },
    { slug: 'proje-04', title: 'Proje 04', category: 'Kategori', status: 'Durum', summary: 'Projenin kısa açıklaması buraya gelecek. Bu alan iki satırlık bir tanıtım metni için ayrıldı.', tags: ['Etiket', 'Etiket', 'Etiket'], image: '', url: '', github: '' }
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
    { slug: 'elektrikten-yazilima', date: '2026-11-20', tag: 'Kişisel', title: 'Elektrikçilikten yazılıma geçişim', excerpt: 'Sahada öğrendiklerimin kod yazarken nasıl işime yaradığı.' },
    { slug: 'devlog-1', date: '2026-11-21', tag: 'Oyun', title: 'Oyun devlog #1', excerpt: 'Oyunun ilk prototipi ve karşılaştığım sorunlar.' },
    { slug: 'scroll-animasyonlari', date: '2026-11-22', tag: 'Web', title: 'Bu sitedeki scroll animasyonlarını nasıl yaptım', excerpt: 'GSAP ScrollTrigger ile pin, scrub ve kablo efekti.' }
  ]
};
