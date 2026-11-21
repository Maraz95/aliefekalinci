# TASARIM.md — Ali Efe Kalinci Portfolyo · Yaratıcı Yön ve Uygulama Planı

> Bu dosya sitenin "anayasası". Her adımda önce bunu oku. Bir karar burada yazıyorsa ona uy; yazmıyorsa buradaki ruha en yakın olanı seç.
> Referans: `assets/ref/referans.mp4` (Dominik Fojcik portfolyosu). Hero hariç her şeyde o sitenin kalitesini hedefle.
> Teslim: **26 Kasım 2026**. Teknoloji: sadece HTML / CSS / JS. Kütüphaneler CDN'den: GSAP + ScrollTrigger, Lenis, Three.js (importmap). Supabase (admin + blog).

---

## 1. Büyük fikir: "Devreyi kapat"

Site tek bir **elektrik devresi**. Ziyaretçi kaydırdıkça devreye akım veriyor.
- Yükleme ekranında **yıldırım** çarpar → sisteme enerji gelir.
- Her bölüm bir **devre elemanı**: hero = kimlik/operatör, tünel = kablolar, projeler = ekranlar, panel = otomasyon, iletişim = devrenin kapanması.
- Sayfa boyunca ince mavi bir **akım çizgisi** akar; her bölüme geldiğinde o bölüm "yanar".
- Hikâye cümlesi: **"Sahadan koda."** Elektrikçilikten yazılıma geçen biri.

Her animasyon bu fikre hizmet etmeli. "Güzel ama anlamsız" efekt ekleme.

## 2. Görsel dil

| Rol | Değer |
|---|---|
| Zemin | `#050505` (bölüm bazında `#0a0f16` lacivert-siyah gradyanlar serbest) |
| Yüzey | `#141414` |
| Çizgi | `#3A3A3A` |
| İkincil metin | `#8A8A8A` |
| Ana metin | `#EDEDED` |
| Vurgu / akım | `#5CC8FF` (glow için `#00AEEF`) |
| Kıvılcım (çok az) | `#FFFFFF` + mavi glow |

- **Fontlar:** Başlık `Inter Tight 800` (sıkı harf aralığı -0.04em) · Dev ekran yazıları `Big Shoulders Display 900` · Etiketler `JetBrains Mono` (BÜYÜK HARF, 11–12px, harf aralığı .08em).
- **Doku:** Tüm sayfada çok hafif film greni (SVG noise, %4 opaklık) + ince 1px grid çizgileri bazı bölümlerde.
- **Mikro tipografi (referans videodaki gibi):** Köşelerde küçük mono bilgiler: `[ SYS.BOOT ] v1.0.0`, `41.0082° N`, `CAM-01`, saat, bölüm numarası `02 / 06`. Site "bir kontrol arayüzü" gibi hissettirmeli.
- **Piksel/oyun fontu YOK.** Glitch sadece geçiş anlarında (≤0.5 sn), sonra temiz.

## 3. Global deneyim (her yerde)

1. **Lenis** yumuşak kaydırma (lerp 0.09).
2. **İmleç = kıvılcım:** 10px mavi nokta + gecikmeli halka. Link üstünde halka büyür; hızlı hareketlerde arkasında 3–4 küçük kıvılcım parçacığı söner. Proje ekranlarının üstünde halka "SÜRÜKLE" / "AÇ" yazar.
3. **Akım çizgisi:** Sol kenarda sayfa boyu ince çizgi; kaydırdıkça mavi akım dolar, uçunda parlak bir "elektron" noktası gezer. Bölüm başlarında küçük bir düğüm yanar.
4. **Menü:** `Ali Efe Kalinci` logosu solda; `01. Ana Sayfa 02. Projeler 03. Blog 04. Hakkımda` ortada; aktif olan `[ ]` içinde + mavi alt çizgi. Sağda **şalter** şeklinde ses aç/kapa düğmesi.
5. **Ses (opsiyonel, varsayılan kapalı):** Şalter açılınca hafif trafo uğultusu (loop) + hover'da kısa "tık". Sadece kullanıcı tıklayınca başlar.
6. **Sayfa geçişleri** (blog / proje detay): Pano kapağı gibi iki panel ortadan kapanır, "tık" ile açılır (0.8 sn).
7. **Erişilebilirlik ve performans:** `prefers-reduced-motion` → 3D, flaş, parçacık kapalı; sade fade. Mobilde parçacık sayısı ¼, tünel yerine kısa video veya statik görsel. Hedef 60 fps; Three.js sahneleri görünmüyorsa render durdurulsun (IntersectionObserver). Toplam ilk yük < 3 MB.

## 4. Bölüm bölüm akış

### 0 · Yükleme — "Yıldırım" (≈3 sn)
- Siyah ekran, ortada `[ SYS.BOOT ]` ve dev sayaç 0→100 (Big Shoulders 900).
- %85'ten sonra kenarlarda küçük mavi kıvılcımlar, sayaç titrer.
- %100: yukarıdan dallanan **yıldırım** (canvas, midpoint displacement, ana kol beyaz kalın, dallar mavi ince, shadowBlur glow). Her yüklemede farklı şekil.
- 2–3 kısa flicker, 80ms beyaz flaş (opaklık ≤ 0.85, toplam yanıp sönme ≤ 3 — ışığa duyarlılar için sınır), 200ms hafif ekran sarsıntısı.
- Çarpma noktasından dairesel `clip-path` ile hero açılır.

### 1 · Hero — "Operatör kartı"
- Arka plan: Three.js **parçacık alanı** (mavi-beyaz tozlar), fotoğrafın arkasında videodaki gibi yavaş dönen **küre/halka** şekli belirgin. Fare yaklaşınca parçacıklar itilir.
- **Vesikalık beyaz arka planıyla kalır — dokunma.** Beyaz bir **personel kimlik kartının** içinde:
  - Kart tamamen beyaz, köşe 10px, üstte ince `#00AEEF` şerit + askı deliği.
  - Fotoğraf kartın üst kısmında, beyazı kart zeminine karışır.
  - Altında koyu yazı: `ALİ EFE KALİNCİ` · mono `SAHA → KOD` · `ID-001` · küçük barkod.
  - Kart yukarıdan ince bir **askı ipiyle** sarkar. Kaydırma hızına ve fareye göre **sarkaç gibi sallanır** (yay fiziği, basit spring). **Kart sürüklenebilir**, bırakınca sallanarak yerine döner. ← Hero'nun "vay" anı bu.
  - Fareyle 3D eğim (≤ 8°). Kartın üstünde hologram gibi ince bir parlama geçer.
- Sol: `[ SYS.BOOT ] v1.0.0`, başlık `Ali Efe` (beyaz) / `Kalinci` (mavi), Inter Tight 800, çok büyük. Açılışta harfler aşağıdan gelir, 0.4 sn glitch, sonra temiz. Sonunda `_` YOK.
- Butonlar: `→ Projeler` (dolu mavi), `Hakkımda` (çerçeveli). **Mıknatıslı**; hover'da butonun içinden soldan sağa akım geçer.
- Sol kenarda dikey `+` ızgara süsü, alt ortada fare ikonu + ok.
- Kaydırınca: kart küçülüp yukarı çekilir, parçacık küresi büyüyüp kameranın içinden geçer → tünele bağlanır.

### 2 · Manifesto — "Akım"
- Tam ekran, ortada 3 satırlık büyük metin:
  *"Yıllarca sahada kablo çektim, pano kurdum. Şimdi aynı mantığı koda taşıyorum."*
- Kaydırdıkça kelimeler griden beyaza dolar; **"kablo"**, **"pano"**, **"kod"** kelimeleri mavi yanar ve üstlerinde kısa kıvılcım çakar.
- Altında 3 sayaç (0'dan sayar): saha yılı, saha projesi, oyun projesi. (Gerçek sayılar `data.js`'te.)

### 3 · Kablo tüneli — "Sahadan koda" (imza an #1)
- Pinlenmiş bölüm (≈300vh). Three.js: kamera iki yanında **pano modülleri** (kutu geometri, sigorta/kontaktör detayları), tavandan ve yerden geçen **renkli kablolar** (kahverengi, mavi, sarı-yeşil, gri — TubeGeometry) olan bir tünelin içinden ilerler. Kablolarda akım ışığı akar (shader'da kayan parlaklık).
- Ekranda mono yazılar akar: `L1 · L2 · L3 · N · PE` → ilerledikçe `function automation()`, `return true;` gibi kod satırlarına dönüşür.
- Tünelin sonunda kablolar bir ekrana bağlanır, ekranda dev **"SAHADAN → KODA"** yazar.
- Mobil: aynı sahnenin kısa döngü videosu veya düşük detaylı versiyon.

### 4 · Projeler — "Spotlight + galeri"
- **Yerleşim referans görselden birebir ölçüldü** (1672 px genişlikte): panel kenarı 140 px (8.4vw), başlık panelden 70 px içeride, Spotlight paneli ≈ 3.6:1, görsel alanı panelin %46'sından başlar ve %45 genişlikte, alt kenarda kırpılır. Galeri kartları 2:1, oklar panelin dışında, sayfa göstergeleri eşit genişlikte çubuklar.
- Sitenin koyu teması: siyah zemin, lacivert-siyah panel, mavi vurgu. Arka planda ince mavi ışık çizgileri ve galerinin altında zemin halkası.
- Üstte `02 / Projeler` etiketi, büyük `Projeler` başlığı (Inter Tight 700), sağda kısa açıklama.
- **Spotlight:** solda `#01` + kategori, proje adı, açıklama, teknoloji etiketleri, dolu mavi `Projeyi İncele →` ve çerçeveli `GitHub`. Sağda perspektifli görsel alanı. Görsel yoksa alan boş kalır (yazı yok).
- **Galeri:** 4 kart (görsel, ad, kategori, ↗). Aktif kart kalın mavi çerçeve + hafif ışık. Fareyle üstüne gelmek = önizleme, tıklamak = kalıcı seçim.
- Mobil: görsel üstte, galeri parmakla yatay kayar, oklar gizlenir.
- Klavye: galeri bir sekme listesi; ← → Home End ile gezilir.
- Veri `data.js` → `projects`. Şimdilik geçici içerik (Proje 01–04); gerçek bilgiler oraya yazılır.
- Menü hero'dan sonra koyu zemin alır, içerikle çakışmaz.
- Kod: `js/projects.js`, `css/projects.css`.
- **RMS-A görsellerinde konum, tabela, şema görünmesin.**

### 5 · Canlı otomasyon paneli — "Kümesi sen yönet" (imza an #3, etkileşimli)
- Koyu bölüm. SVG ile çizilmiş bir **kümes kesiti** + yanında bir **kontrol panosu** arayüzü.
- Ziyaretçi **dış sıcaklık** kaydırıcısını oynatır → sistem otomatik tepki verir: fanlar döner (hızı sıcaklığa bağlı), ısıtıcı turuncu yanar, havalandırma kapakları açılır, panoda kontaktör LED'leri yanar, grafik çizilir.
- Ek şalterler: **Aydınlatma**, **Yemleme**, **Acil stop** (her şeyi durdurur, kırmızı alarm).
- Altında tek cümle: *"Bu sistemin gerçeğini sahada kurdum."* + proje sayfasına link.
- Hoca ve işveren için sitenin en akılda kalan bölümü olmalı: hem saha bilgisini hem kod yeteneğini aynı anda gösterir.

### 6 · Yolculuk — "Tek hat şeması"
- Zaman çizelgesi bir **elektrik tek hat şeması** gibi çizilir: her durak bir sembol (şalter, trafo, pano, monitör).
- Kaydırdıkça hat çizilir (SVG stroke-dashoffset), akım geçer, sırası gelen sembol yanar ve yanında kısa metin açılır.
- Duraklar: Elektrikçilik → Otomasyon kümes → RMS-A → Yazılıma geçiş → Bugün.

### 7 · Blog — "Kayıt defteri"
- Başlık: `SON KAYITLAR`. 3 kart, sistem log'u gibi: `[2026-11-21] OYUN · Devlog #1`.
- Kartlar fareyle 3D eğilir, hover'da kapak görseli maskeyle açılır.
- `blog.html`: etiket filtresi; `post.html`: üstte **voltmetre** şeklinde okuma ilerleme göstergesi.
- **Easter egg:** Klavyede `~` basınca alttan terminal açılır; `yetenekler`, `projeler`, `iletisim`, `sudo kahve` komutlarına cevap verir.

### 8 · İletişim — "Devreyi kapat"
- Dev yazı `BİRLİKTE` / `ÇALIŞALIM` harf harf yükselir.
- Ortada büyük bir **şalter**. Ziyaretçi şalteri kaldırınca devre kapanır: sayfadaki tüm akım çizgisi bir anda yanar, ekran kısa titreşir, e-posta adresi ve form belirir. ← kapanış anı.
- Form → Supabase `messages`. E-postayı kopyala butonu. GitHub / LinkedIn.
- Footer: `© 2026 Ali Efe Kalinci · Sahadan koda` + `Sistem durumu: ● Çevrimiçi`.
- 404 sayfası: *"Sigorta attı. Bu sayfa bulunamadı."* + sigortayı geri kaldırma butonu → ana sayfa.

### 9 · Admin paneli (hocanın şartı — atlanamaz)
- `admin/login.html` (Supabase Auth) → `admin/index.html`: Projeler / Blog / Mesajlar / Ayarlar sekmeleri.
- Aynı renk ve fontlar, animasyonsuz, sade. Ekle / düzenle / sil, taslak–yayında, görsel yükleme (Supabase Storage).
- RLS: herkes yalnızca yayındakini okur; yazma sadece giriş yapmış kullanıcı; `messages` tablosuna herkes ekler, sadece admin okur.

## 5. Uygulama sırası (her adımdan sonra DUR, ekran görüntüsü al, onay iste)

| # | Adım | Öncelik |
|---|---|---|
| 1 | Yükleme (yıldırım) + Hero (kart, parçacıklar, sallanma) | Zorunlu |
| 2 | Global: Lenis, imleç, akım çizgisi, menü, gren | Zorunlu |
| 3 | Manifesto + Projeler (Spotlight + galeri) | Zorunlu |
| 4 | Blog sayfaları + Supabase bağlantısı | Zorunlu |
| 5 | Admin paneli | Zorunlu |
| 6 | İletişim (şalter) + 404 | Zorunlu |
| 7 | Canlı otomasyon paneli | Çok istenen |
| 8 | Kablo tüneli | Çok istenen |
| 9 | Tek hat şeması zaman çizelgesi, terminal easter egg, ses | Zaman kalırsa |

Zaman yetmezse **9 → 8 → 7** sırasıyla kesilir. 1–6 asla kesilmez.

## 6. Kalite kontrol (her adımın sonunda)
- [ ] Konsolda hata yok.
- [ ] 1440px, 1024px ve 375px genişlikte ekran görüntüsü alındı, taşma yok.
- [ ] `prefers-reduced-motion` ile site hâlâ kullanılabilir.
- [ ] Performans: kaydırırken takılma yok (Chrome DevTools Performance, 60 fps'e yakın).
- [ ] Türkçe yorum satırları var; kod hocaya gösterilebilir durumda.
- [ ] Referans videoyla karşılaştırıldı: "aynı kalite hissi" var mı? Yoksa neyin eksik olduğunu yaz.
