# MamiRock D&D ile diğer siteler arasındaki farklar

6 Kasım 2026'da yazıldı. Bu belge siteyi D&D Beyond (karakter sayfası, kampanyalar ve **Maps** adlı VTT), **Roll20**, **Foundry VTT** ve **Owlbear Rodeo** ile karşılaştırıyor. Yalnızca eksik özellikler değil, işlerin **nasıl çalıştığındaki** farklar da var: hesaplar, yetkiler, verinin saklanması, eşitleme, zar atma.

**Kaynaklar hakkında:**
- **(arandı)** ile işaretlenen bilgiler o gün yapılan web aramalarından geliyor. Kaynaklar en altta.
- **(genel bilgi)** ile işaretlenenler bu sitelerin genel olarak bilinen özellikleri. O gün tek tek kontrol edilmedi.
- Bu siteler sık değişiyor. Bir işe başlamadan önce ilgili maddeyi yeniden kontrol edin.

Karakter oluşturucuyla ilgili ayrıntılı plan zaten `HANDOFF.md`'de var ("Next plan", A–D aşamaları). Burada o plana yalnızca atıf var. Bu belge **sitenin geri kalanını** ve **çalışma yöntemlerini** kapsıyor. Önerilen yeni işler en sonda.

---

## 1. Özet tablo

| Alan | Bizde | Diğerlerinde |
|---|---|---|
| Hesap ve giriş | Takma ad + şifre. Şifreler veritabanında düz metin. Giriş ekranında test hesapları görünüyor. | Gerçek kimlik doğrulama: e-posta/şifre, Google vb. Şifre hash'li, sunucuda tutuluyor. (genel bilgi) |
| Yetki kontrolü | Yalnızca arayüzde. Veritabanı herkese açık. | Sunucu kontrol ediyor. Foundry'de belge başına sahiplik: bir belge varsayılan olarak yalnızca GM'e açık. (arandı) |
| Veri saklama | Firebase Realtime Database, tek ortak veritabanı. | D&D Beyond ve Roll20 kendi bulutlarında. Foundry kendi bilgisayarınızda ya da sunucunuzda. (arandı) |
| Eşitleme | Karakter sayfası her kayıtta **bir bütün olarak** üzerine yazılıyor. Son yazan kazanıyor. | Değişiklikler alan alan ya da belge belge kaydediliyor. Sunucu sırayı belirliyor. (genel bilgi) |
| Zar | Tarayıcıda `Math.random`. Tek zar (d4–d100). Ortak kayıtta son 20 atış. | Zar ifadeleri (`2d6+3`), avantaj/dezavantaj, gizli atış, sayfadan tıklayıp atma, makrolar. D&D Beyond'da sayfadan atılan zarlar ortak oyun kaydına düşüyor. (arandı) |
| Harita | Tek harita. Kare kare fog. Cetvel. Alan şablonları. | Duvarlar, kapılar, dinamik ışık, görüş (Roll20, Foundry). Owlbear'da piksel hassasiyetinde fog ve çizim araçları. Birden çok sahne/sayfa. (arandı) |
| Savaş | İnisiyatif sırası, NPC'lere d20, sıradaki token'ın etrafında halka, canavar HP'si. | Canavar istatistik blokları, encounter builder, durum etkileri, hasar uygulama. (arandı / genel bilgi) |
| İçerik | SRD 5.1/5.2 ve homebrew. SRD dışı büyüler yalnızca adıyla. | D&D Beyond satın alınan kitapların tamamı. Foundry ve Roll20'de compendium'lar. (arandı) |
| Notlar | Kişisel notlar (çizim de var). Kampanya günlüğü, notu kimlerin göreceği seçilebiliyor. | Resimli handout'lar, belge başına izin, bağlantılı journal sayfaları. Görsel "reveal" (D&D Beyond Maps'te yol haritasında). (arandı) |
| Genişletme | Yok. Her şey kodda değişiklik gerektiriyor. | Roll20 API/Mods, Foundry modülleri, Owlbear extension mağazası. (arandı) |
| Ses | Yok. | Roll20 jukebox. Foundry'de playlist'ler. (arandı / genel bilgi) |
| Taşıma ve yedek | JSON dışa/içe aktarma var (envanter, notlar, "full suite"). Otomatik yedek yok. | Roll20 Character Vault ve Transmogrifier ile oyunlar arası taşıma. Foundry dünyaları dosya olarak duruyor. (arandı) |

---

## 2. Çalışma yöntemindeki farklar

### 2.1 Hesaplar ve kimlik
- **Bizde:** Hesap `accounts/<nick>` altında. Şifre düz metin. Site açılırken bütün hesap listesini her ziyaretçinin tarayıcısına indiriyor (VTT.md'deki güvenlik bölümü). DM rolü hesapta ve kampanya üyeliğinde tutuluyor, ama bunu yalnızca arayüz kontrol ediyor.
- **Diğerlerinde:** Hesap sunucu tarafında. Şifre hiçbir zaman istemciye gelmiyor. Rol ve izinleri sunucu uyguluyor. (genel bilgi)
- **Fark ne demek:** Bizde siteyi tanıyan biri tarayıcı konsolundan her şeyi okuyup yazabilir. Arkadaş grubu içinde kabul edilebilir, herkese açık bir sitede kabul edilemez.
- **Çözüm yolu:** Firebase Authentication, şifreleri veritabanından kaldırmak ve uid'e dayalı veritabanı kuralları. `HANDOFF.md`'de D aşaması.

### 2.2 Yetkiler ve sahiplik
- **Bizde:** Kampanya başına üç rol var: sahip, co-DM ve oyuncu. Token'ın bir sahibi var. Günlük notunun kimlere görüneceği seçilebiliyor. DM her oyuncunun sayfasını açıp değiştirebiliyor. Bunların hepsi yalnızca arayüzde kontrol ediliyor.
- **Foundry:** Her belgenin (karakter, eşya, journal, sahne) kendi sahiplik düzeyleri var: yok, sınırlı, gözlemci, sahip. Belgeler varsayılan olarak yalnızca GM'e açık. Bir oyuncu kendi belgesini bile silemiyor. Assistant GM rolü var, Assistant GM'ler bazı şeyleri silemiyor. Bazı işler için bir GM'in çevrimiçi olması şart. (arandı)
- **Roll20:** Her karakter ve handout için "Can Be Edited By" ve "In Player's Journals" alanları var. GM bunları teker teker ayarlıyor. (arandı)
- **Bizde olmayanlar:**
  - Bir oyuncunun başka bir oyuncunun sayfasını yalnızca **görebilmesi**.
  - Belge başına izin.
  - "Bu notu sadece okuyabilir" gibi düzeyler.
  - Silmeye karşı koruma.

### 2.3 Veri ve eşitleme
- **Bizde:**
  - Karakter sayfası `inventories/<id>` altında **tek bir nesne** ve her kayıtta `set()` ile bütün olarak yazılıyor (`index.html`, `fbSaveInventory`). DM ve oyuncu aynı anda aynı sayfayı değiştirirse son yazan diğerinin değişikliğini siler.
  - VTT verisi daha parçalı: her token ve her fog hücresi ayrı yazılıyor.
  - Ayrıca `localStorage`'da bir kopya tutuluyor.
- **Diğerlerinde:** Sunucu her değişikliği ayrı bir işlem olarak alıyor. Foundry'de değişiklikler belge ve alan düzeyinde gidiyor. (genel bilgi)
- **Kayıt geçmişi:** Bizde ne geri alma ne de sürüm geçmişi var. Notlardaki çizimin geri alması dışında hiçbir şey geri alınamıyor. D&D Beyond'da karakter sayfası için de geçmiş yok. Foundry'de dünya dosyalarının yedeği alınabiliyor. (genel bilgi)
- **Çevrimdışı:** Bizde Firebase SDK bağlantı koptuğunda yeniden bağlanıyor ve `localStorage` kopyası var, ama bağlantı yokken düzgün çalışıp çalışmadığı hiç denenmedi. D&D Beyond'un mobil uygulamasında karakter sayfaları çevrimdışı açılabiliyor. Foundry tamamen yerel çalışabiliyor. (genel bilgi)

### 2.4 Zar atma
- **Bizde:** `vtt.js` içindeki `rollDie(sides)` fonksiyonu sonucu tarayıcıda `Math.random` ile hesaplıyor ve ortak kayda yazıyor. Yani bir oyuncu konsoldan istediği sonucu yazabilir. Tek zar atılıyor, toplama ya da ek bonus yok. Kayıtta en fazla 20 atış tutuluyor.
- **D&D Beyond:** Zarlar hem Maps'ten hem karakter sayfasından atılıyor ve ortak oyun kaydına düşüyor. Sayfadan atılan her zar kayda geçiyor. Yeniden yapılan 3D zar motoru 2026 başına ertelenmişti. (arandı)
- **Roll20:** Tek tıkla karmaşık atışlar için makrolar, atış sonucunun sohbet içinde görünmesi (inline roll), fısıltı ve gizli GM atışları. (arandı / genel bilgi)
- **Bizde olmayanlar:**
  - Zar ifadesi (`1d20+5`, `4d6kh3`).
  - Avantaj/dezavantaj.
  - Gizli DM atışı.
  - Sayfadan tıklayıp atma.
  - Sohbet.

### 2.5 Kampanyalar ve karakterler
- **Bizde:**
  - Bir hesabın birden çok karakteri olabiliyor ve bir karakter birden çok kampanyada oynayabiliyor.
  - Rol her kampanyada ayrı.
  - Davet kodu ve davet bağlantısı var.
  - Homebrew kampanyaya özel.
- **D&D Beyond:** Kampanyaya katılınca içerik paylaşımı devreye giriyor: Master aboneliğiyle DM'in satın aldığı kitaplar oyunculara açılıyor. Kampanya başına oyuncu ve karakter sınırı var. Homebrew paylaşımı içerik paylaşımından ayrı çalışıyor. (arandı)
- **Roll20:** Character Vault ile karakterler oyunlar arasında taşınabiliyor. Transmogrifier ile handout, makro, tablo gibi içerikler oyunlar arasında kopyalanabiliyor, bu bir Pro özelliği. (arandı)
- **Bizde olmayanlar:**
  - Homebrew'u bir kampanyadan diğerine kopyalamak.
  - Bir haritayı ya da hazırlanmış bir karşılaşmayı başka bir kampanyaya taşımak.

### 2.6 Barındırma ve maliyet
- **Bizde:** Firebase'in ücretsiz planı kullanılıyor. Storage açık değil, çünkü yeni bir bucket Blaze planı gerektiriyor. Bu yüzden haritalar küçültülüp veritabanına yazılıyor.
- **D&D Beyond Maps:** 16 Eylül 2025'ten beri bütün kullanıcılara ücretsiz. Kendi haritanızı ve token'larınızı yüklemek Master aboneliği istiyor. (arandı)
- **Foundry:** Tek seferlik lisans. Kendi bilgisayarınızda ya da kiraladığınız bir sunucuda çalışıyor. (arandı)

---

## 3. Özelliklerdeki farklar

### 3.1 Harita (VTT)
| Özellik | Bizde | Diğerlerinde |
|---|---|---|
| Fog | Kare kare, fırçayla aç/kapat | Owlbear 2.0: piksel hassasiyetinde, her çizim fog şekli olabiliyor, sonradan düzenlenebiliyor (arandı). Owlbear 2.4: otomatik fog algılama (arandı). |
| Duvar, kapı, ışık, görüş | Yok | Roll20 ve Foundry'de dinamik ışık. Foundry'de ışık duvar ve kapılarla gerçek zamanlı etkileşiyor (arandı). Owlbear'da bir extension ile. |
| Birden çok sahne | Kampanya başına tek harita | Birden çok sahne/sayfa. DM bir sonrakini oyunculardan gizli hazırlayabiliyor. Roll20'nin turn tracker'ı birden çok sayfadaki token'ları izleyebiliyor (arandı). |
| Katmanlar | Yok | Harita, token ve yalnızca GM'in gördüğü katmanlar. (genel bilgi) |
| Çizim | Yalnızca alan şablonları ve cetvel. Haritada serbest çizim yok, notlarda var. | Owlbear: fırça, çizgi, dikdörtgen, üçgen, daire, çokgen, altıgen (arandı). |
| Token | Boyut, sahip, gizli, HP çubuğu, portre | Durum işaretleri, auralar, ışık ve görüş, token'a eklenmiş öğeler (Owlbear 2.0'da her öğeye ekleme yapılabiliyor, arandı). |
| Görsel ve handout gösterme | Yok | D&D Beyond Maps'te "Art & Handout Reveals" yol haritasında (arandı). Roll20 handout'ları. |
| Hava ve animasyon | Yok | Owlbear Weather extension'ı. D&D Beyond'un yol haritasında animasyonlu haritalar (arandı). |
| Harita kataloğu | 3 harita, 6 token (kendi çizimimiz) | Satın alınan ya da modül olarak gelen harita paketleri, duvar ve ışıkları hazır kurulu (arandı). |

### 3.2 Savaş
- **Bizde:** İnisiyatif sırası, tur sayacı, NPC'lere d20, gizli girişler, sıradaki token'ın etrafında halka. Canavar HP'si token menüsünden giriliyor.
- **Bizde olmayanlar:**
  - **Canavar istatistik blokları ve bestiary.** SRD canavarları CC-BY lisanslı, kullanılabilir. D&D Beyond Maps'te istatistik bloklarından atılan zarlar da oyun kayda düşüyor. (arandı)
  - **Encounter builder:** CR'ye göre zorluk hesabı. (arandı)
  - **Durum etkileri:** Poisoned, Prone gibi durumların token'da ve sayfada işaretlenmesi. Bizde sayfada yalnızca ölüm kurtarma atışları var.
  - **Hasar uygulama:** Hedef seçip hasarı ya da iyileştirmeyi doğrudan HP'ye işlemek. (genel bilgi)
  - **İnisiyatifin sayfadan gelmesi:** Oyuncu inisiyatifi bizde elle giriliyor.

### 3.3 Karakter sayfası ve oluşturucu
Ayrıntılar `HANDOFF.md` → "Next plan" bölümünde. Kısaca:
- Feature metinleri ve kullanım sayıları yok.
- Saldırı bonusu ve hasarı hesaplanmıyor.
- AC zırh değişince güncellenmiyor.
- Sayfadan zar atılamıyor.
- Hazırlanan büyüler takip edilmiyor.
- Oluşturucu yalnızca 2014 kurallarıyla çalışıyor.
- Yazdırma ya da PDF yok. JSON dışa aktarma var ama bütün sayfayı kapsıyor, karakter oluşturucu biçiminde değil.

### 3.4 İçerik ve kurallara erişim
- **Bizde:** SRD büyüleri tam metinleriyle var. SRD dışı büyüler yalnızca ad, seviye ve okulla. Kural metni, eşya ve canavar kataloğu yok.
- **Diğerlerinde:** D&D Beyond'da satın alınan kitapların tamamı ve içerik paylaşımı var. D&D Beyond'un "Rules Assistant"ı 2026 başına planlanmıştı (arandı). Foundry ve Roll20'de compendium'lar var.
- **Yapılabilecek:** SRD 5.1 ve 5.2'deki kural bölümleri, eşyalar ve canavarlar CC-BY lisanslı. Arama yapılabilen bir "Kurallar" sekmesi eklenebilir.

### 3.5 Notlar ve günlük
- **Bizde:** Kişisel notlar var: metin, çizim ve JSON dışa/içe aktarma. Kampanya günlüğünde notu herkesin mi yoksa seçilen oyuncuların mı göreceği seçilebiliyor. Yeni not gelince işaret çıkıyor.
- **Bizde olmayanlar:**
  - Günlükte resim.
  - Notlar arası bağlantı.
  - Notu haritadaki bir yere iliştirmek.
  - Oyuncuların ortak not yazması.
  - Handout'ları oyunculara tek tek dağıtmak.

### 3.6 Genişletme ve otomasyon
- **Diğerlerinde:**
  - Roll20: API/Mods ile özellik ekleme ve otomasyon, Pro abonelik gerekiyor (arandı).
  - Foundry: binlerce modül (arandı).
  - Owlbear: onaylı extension mağazası. İlk dalgada zar atıcı ve inisiyatif takibi vardı (arandı).
- **Bizde:** Yok. Arkadaş grubu için gerekli de değil. Ama zar ifadesi ya da durum etkisi gibi sık istenen şeyler doğrudan siteye eklenmeli.

### 3.7 Ses
- **Bizde:** Yok.
- **Roll20:** Jukebox. 2019 değişiklik kaydında ses eşitleme güncellemesi geçiyor (arandı).
- **Foundry:** Playlist'ler (genel bilgi).

### 3.8 Arayüz ve cihazlar
- **Bizde:**
  - Arayüz çoğunlukla İngilizce, belgeler Türkçe.
  - Telefon genişliğinde yatay kaydırma yok, ama DM'in araç çubuğu 6 satıra taşıyor.
  - Gerçek dokunmatik cihazda denenmedi.
- **D&D Beyond:** Mobil uygulaması var (genel bilgi).
- **Roll20 ve Foundry:** Esas olarak masaüstü için tasarlanmış (genel bilgi).

---

## 4. Bizim daha iyi ya da farklı yaptıklarımız

Bunlar korunmalı:
- **Kural kontrolünü DM ayarlıyor.** Katı mod, kural ihlallerini yalnızca uyarı olarak gösterme ya da elle puan yazma. Karşılaştırılan sitelerde böyle bir kampanya ayarı görmedim (genel bilgi).
- **Her şey tek sitede ve ücretsiz:** Karakter sayfası, envanter, büyüler, notlar, kampanya günlüğü ve harita bir arada. Abonelik yok.
- **Kampanya homebrew'u oluşturucuya doğrudan giriyor:** Tür, alt tür, geçmiş, feat, alt sınıf ve büyü.
- **Bir karakter birden çok kampanyada oynayabiliyor.** Rol her kampanyada ayrı.
- **Eski karakter sayfaları oluşturucuya dönüştürülebiliyor.**
- **Portre doğrudan VTT token'ı oluyor.** Party butonu bütün grubu tek tıkla haritaya koyuyor.
- **Izgara otomatik algılanıyor:** Haritadaki çizili ızgara yüklemede bulunuyor. Owlbear 2.4'teki otomatik fog algılamaya benzer bir kolaylık.
- **Kayıtlı büyüler katalogdan kendiliğinden güncelleniyor.**

---

## 5. Önerilen işler (oluşturucu planının dışında)

Arkadaş grubu için faydasına göre sıralandı. Oluşturucunun kendi planı (A–D) `HANDOFF.md`'de.

**E. Oyun masası (VTT ve savaş)**
1. **Zar ifadesi ve gizli atış:**
   - `NdX+M` ifadesi, avantaj/dezavantaj, gizli DM atışı.
   - Kayıtta atışın ayrıntısı görünsün.
   - Karakter planındaki "tıklayıp atma" maddesiyle (A4) aynı motoru kullanmalı.
2. **Durum etkileri:** Token'da simge, karakter sayfasında liste. Önce SRD'deki 15 durum ve exhaustion seviyeleri.
3. **Hasar ve iyileştirme uygulama:** Token menüsünden "−X HP / +X HP". Oyuncu token'ında karakter sayfasındaki HP'ye yazılsın.
4. **SRD canavarları:** İstatistik blokları, token olarak ekleme, HP ve inisiyatifin bloktan gelmesi, bloktan zar atma. Basit bir encounter builder (CR'ye göre zorluk).
5. **Birden çok sahne:** Kampanya başına birden çok harita, DM'in hazırlayıp sonra oyunculara göstermesi. Bugünkü veri `vtt/<kampanya>/map` altında tek harita, yapısının değişmesi gerekiyor.
6. **Harita üzerine çizim** ve yalnızca DM'in gördüğü bir katman.
7. **Duvar ve görüş:** Basit duvar çizgileri ve token görüşü. Büyük bir iş, bir eklenti yerine kendi içinde planlanmalı.
8. **Handout ve görsel gösterme:** DM'in bir resmi ya da notu oyunculara açması.

**F. Veri ve çalışma yöntemi**
1. **Sayfayı alan alan kaydetmek:** `set()` yerine değişen yolları `update()` ile yazmak. Böylece DM ve oyuncunun aynı anda yaptığı değişiklikler birbirini silmez. **Önce bunun gerçek bir sorun olup olmadığı iki kişiyle denenmeli.**
2. **Yedek:** DM için "kampanyayı JSON olarak indir/yükle" (kampanya, günlük, homebrew, VTT). Bugünkü dışa aktarma yalnızca kişisel sayfayı kapsıyor.
3. **Geri alma:** En azından VTT'de son birkaç işlem, karakter sayfasında son kayıt.
4. **Homebrew ve harita taşıma:** Kampanyalar arası kopyalama. Roll20'nin Transmogrifier'ına benzer, ama sade bir JSON dışa/içe aktarma olarak.

**G. İçerik**
1. **"Kurallar" sekmesi:** SRD kural bölümlerinde arama (durumlar, dinlenme, savaş eylemleri vb.).
2. **SRD eşyaları ve büyülü eşyalar:** Envantere katalogdan ekleme. Karakter planındaki A3 maddesiyle birlikte yapılabilir.

**H. Herkese açılmadan önce** (`HANDOFF.md` → D aşamasıyla aynı)
Firebase Authentication, veritabanı kuralları, Storage, lisans anahtarı ve CC-BY atfı, telefon ve iki kişiyle gerçek testler.

---

## Kaynaklar (6 Kasım 2026'daki aramalar)

- D&D Beyond Maps: [The official D&D VTT](https://dndbeyond.com/games), [D&D Beyond Maps: How to Start Playing Today](https://www.dndbeyond.com/posts/1570-d-d-beyond-maps-how-to-start-playing-today), [D&D Beyond 2025 wrap up](https://www.dndbeyond.com/posts/2116-d-d-beyond-2025-wrap-up?comment=90), [Maps roadmap 2025 (forum)](https://www.dndbeyond.com/forums/d-d-beyond-general/d-d-beyond-feedback/232269-maps-roadmap-2025-off-track), [Art & Handout Reveals](https://www.dndbeyond.com/forums/d-d-beyond-general/d-d-beyond-feedback/232269-maps-roadmap-2025-off-track?comment=22), [dungeonsanddragonsfan.com: D&D Beyond Maps](https://dungeonsanddragonsfan.com/dnd-beyond-maps-vtt/)
- D&D Beyond kampanyaları: [Welcome to D&D Beyond](https://www.dndbeyond.com/en/get-started), [Nerdarchy: campaign creation walkthrough](https://nerdarchy.com/dd-beyond-campaign-creation-walkthrough/), [Homebrew content sharing in encounter builder (forum)](https://www.dndbeyond.com/forums/d-d-beyond-general/bugs-support/157347-homebrew-content-sharing-in-encounter-builder), [CBR: how to run a campaign](https://www.cbr.com/dnd-beyond-how-to-run-campaign/)
- Roll20: [roll20.net](https://roll20.net/), [Dynamic Lighting](https://pages.roll20.net/dynamic-lighting), [Old changelog](https://wiki.roll20.net/Old_Changelog), [Journal](https://wiki.roll20.net/Journal), [Handout](https://wiki.roll20.net/Handout), [Player](https://wiki.roll20.net/Player), [Char / Character Vault](https://wiki.roll20.net/Char), [Transmogrifier](https://wiki.roll20.net/Transmog), [Rugged Reroll dev blog #4](https://bloghub.roll20.net/posts/keeping-it-together-rugged-reroll-dev-blog-4)
- Foundry VTT: [Users and permissions](https://foundryvtt.com/article/users/), [Setting up players (wiki)](https://foundryvtt.wiki/en/setup/Setting-up-Players), [GM online gereksinimi (Forge forumu)](https://forums.forge-vtt.com/t/is-there-a-way-for-players-to-use-merchants-when-the-gm-is-offline/18182), [Hostinger: Foundry VTT](https://www.hostinger.com/applications/foundry-vtt), [groupfinder.eu: Foundry VTT](https://groupfinder.eu/library/foundry-virtual-tabletop-foundry-vtt), [Milby's Maps: map module](https://www.milbysmaps.com/2020/11/03/map-module-for-foundry-and-a-note-about-roll20)
- Owlbear Rodeo: [Migrating from 1.0 to 2.0](https://docs.owlbear.rodeo/docs/migration/migrate-from-1-to-2/), [Blog (2.4: automatic fog detection)](https://blog.owlbear.rodeo), [Beta Patch 7](https://blog.owlbear.rodeo/owlbear-rodeo-2-0-beta-patch-7/), [Beta Patch 9](https://blog.owlbear.rodeo/owlbear-rodeo-2-0-beta-patch-9/), [Extensions](https://extensions.owlbear.rodeo)
