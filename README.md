# Ali Efe Kalinci — Kişisel Portfolyo Sitesi

Web Tasarımı dersi vize projesi. Elektrik sahasından yazılıma geçişimi anlatan,
3B ve kaydırma animasyonlu, mobil öncelikli, Türkçe/İngilizce kişisel site.

- **Öğrenci:** Ali Efe Kalinci — Akdeniz Üniversitesi, Bilgisayar Programcılığı
- **Çalıştırma:** `siteyi-ac.bat` dosyasına çift tıkla → http://localhost:5500
  (3B sahne modül ve `.glb` dosyası yüklediği için sayfayı doğrudan dosyadan değil, yerel sunucudan aç.)

## Sayfalar

| Sayfa | Dosya | İçerik |
|---|---|---|
| Ana Sayfa | `index.html` | Hero, fiber optik tünel, 3B Hakkımda sahnesi, proje tanıtımları, blog, galeri örnekleri, iletişim |
| Hakkımda | `hakkimda.html` | Vesikalık, özgeçmiş, ders programı (`<table>`), `<ul>`/`<ol>`, `abbr`, `code`, `pre`, `blockquote`, yüzdeli yetenekler |
| Projeler | `projeler.html` | Grafik Animasyon I çalışmaları + diğer projeler |
| Blog | `blog.html` | 3 yazı (biri kod örnekli BT yazısı) |
| Galeri | `galeri.html` | Fotoğraflar ve kısa açıklamalar |
| İletişim | `iletisim.html` | Adres, telefon, e-posta, GitHub, iletişim formu |
| 404 | `404.html` | Bulunamayan sayfa |

## Kullanılan teknolojiler

- **HTML5, CSS3, JavaScript** (çatı/framework yok)
- **Three.js 0.170** — fiber optik tünel, imleç ışık izi (GPGPU parçacıklar), Hakkımda 3B sahnesi
  (Draco sıkıştırmalı GLB, özel deniz shader'ı, rüzgârda sallanan selviler)
- **Blender** — Hakkımda sahnesinin modellenmesi, web için sadeleştirme (decimate) ve glTF/Draco dışa aktarımı
- **GSAP + ScrollTrigger** — kaydırmaya bağlı animasyonlar
- **Lenis** — yumuşak kaydırma

## SEO + GEO

- Her sayfada ayrı `<title>` ve `<meta name="description">`
- `canonical`, Open Graph etiketleri, `hreflang` yerine dil seçimi (`lang` özniteliği güncellenir)
- Ana sayfada **JSON-LD (schema.org/Person)**: ad, eğitim, konum (Bolu), diller, uzmanlık alanları —
  yapay zekâ tabanlı arama motorlarının (GEO) kişiyi doğru tanıması için
- `sitemap.xml`, `robots.txt`, `404.html`
- Anlamsal HTML: `header`, `nav`, `main`, `section`, `article`, `figure/figcaption`, `address`, `time`

> Not: `canonical`/`sitemap` adresleri `https://maraz95.github.io/` varsayılarak yazıldı.
> Site başka bir adrese yüklenirse bu adresleri değiştir.

## Erişilebilirlik ve performans

- Mobil öncelikli; telefonda 3B sahneler düşük çözünürlük ve ~30 fps ile çizilir,
  dokunmatik cihazlarda imleç efekti kapanır, ekran dışındaki sahneler hiç çizilmez
- `prefers-reduced-motion` desteği (animasyonlar durur)
- Renk paleti WCAG AA kontrastına göre seçildi; klavye odak çizgileri, "İçeriğe geç" bağlantısı
- Yetenek çubukları `role="progressbar"` ile ekran okuyuculara okunur

## Renk paleti

| Ad | Renk |
|---|---|
| Gece | `#101820` |
| Kömür | `#202522` |
| Taş | `#B8A58A` |
| Bronz | `#8A6845` |
| Deniz | `#164A70` |

## Kullanılan yapay zekâ skill'leri

Geliştirmede Claude (Anthropic) yapay zekâ asistanı ve onun skill'leri kullanıldı:

- **built-in-browser** — siteyi masaüstü ve telefon boyutlarında tarayıcıda açıp test etmek,
  konsol hatalarını ve performansı kontrol etmek için
- **Blender MCP** — Blender sahnesini inceleyip web için sadeleştirmek, havada duran ağaçları
  zemine oturtmak ve GLB olarak dışa aktarmak için

## Klasör yapısı

```
index.html, hakkimda.html, projeler.html, blog.html, galeri.html, iletisim.html, 404.html
css/      base (palet) · main · hero · tunnel · projects · about · sayfa (alt sayfalar) · blog · hakkimda
js/       i18n (TR/EN) · animations · fiber-tunnel · about-3d · about-scene · portal · drift-particles · …
assets/   images (vesikalık, galeri, projeler) · about3d (scene.glb, camera.json)
```
