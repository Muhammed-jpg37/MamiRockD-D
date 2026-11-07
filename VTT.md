# VTT (Virtual Tabletop) — vtt-ozelligi dalı

Sitedeki mevcut sekme sistemine "🗺 VTT" sekmesi eklendi. Kodun neredeyse tamamı `vtt.js` içinde. `index.html` içinde yalnızca sekme butonu, container, `switchMainTab` bağlantısı ve Firebase modülüne birkaç fonksiyon (`fbSaveVtt`, `fbListenToVtt`, `fbUploadVttMap`, `fbListenToVttHp`) eklendi.

## Neler var

| Özellik | DM | Oyuncu |
|---|---|---|
| Harita yükleme (dosya veya bağlantı), ızgara boyutu/rengi/kaydırması | ✔ | – |
| Haritada çizili ızgarayı otomatik algılama (yüklemede + "🔍 Detect") | ✔ | – |
| Katalog: hazır harita ve token seçme (arama, kategori filtresi) | ✔ | – |
| Pan / zoom (fare, tekerlek, dokunmatik pinch) | ✔ | ✔ |
| Token ekleme, sürükleme, boyut, yeniden adlandırma, silme | ✔ | Yalnızca sahibi olduğu token'ı taşır |
| Token sahibi (owner) seçme, oyunculardan gizleme | ✔ | – |
| Fog of war: aç / kapat fırçası (1×1, 3×3, 5×5), sıfırlama | ✔ (yarı saydam görür) | Kapalı alan siyah; oradaki sahipsiz token'ları görmez |
| Oyuncu token'ında HP çubuğu (karakter sayfasından okunur) | ✔ | ✔ |
| Canavar HP'si (token menüsünden) | ✔ | Görmez |
| Zar atıcı (d4–d100) ve ortak log (son 20 atış) | ✔ | ✔ |
| Zar ifadesi (`1d20+5`, `2d6+3`, `4d6kh3`, `d%`; Enter ile atılır, son 10 ifade önerilir) ve Adv / Norm / Dis anahtarı. Logda her zar görünür | ✔ | ✔ |
| 🙈 Gizli zar: oyuncular yalnızca "rolled in secret" görür | ✔ | Göremez, atamaz |
| Durumlar (15 SRD durumu + yorgunluk): token'da simge; DM token menüsünden, oyuncu sayfasından değiştirir | ✔ | Görür, kendi sayfasından değiştirir |
| Token menüsünden hasar / iyileştirme (önce geçici HP); oyuncu token'ı karakter sayfasının HP'sini değiştirir | ✔ | Kendi token'ında |
| 🐉 SRD canavarı ekleme: HP, AC, inisiyatif zarı; 📜 stat blok ve tıklanınca atılan saldırılar | ✔ | – |
| ⚖ Karşılaşma kurucu: parti seviyeleri, XP bütçesi, zorluk (2014), haritaya yerleştirme | ✔ | – |
| Karakter sayfasından zar: yetenek, kurtarma, beceri, inisiyatif, ölüm kurtarma (🎲 butonları). Masa hiç açılmamış olsa da kampanyanın loguna düşer | ✔ | ✔ |
| Inisiyatif sırası: tur sayacı, sıradaki karakter, haritada sıradaki token'ın etrafında halka | ✔ Yönetir (ekleme, değer girme, NPC'lere d20, ileri/geri, gizleme, bitirme) | Görür. Gizli girişleri ve sisteki düşmanları görmez |
| Cetvel: sürükleyerek ölçüm (kare ve feet), sürüklerken herkes görür | ✔ | ✔ |
| Alan şablonları: daire, koni, çizgi, küp. Etkilenen kareler boyanır | ✔ (herkesinkini silebilir) | ✔ (yalnızca kendininkini siler) |

Tüm değişiklikler Firebase üzerinden anlık eşleşiyor.

## Veri şeması (Realtime Database)

```
vtt/<kampanya>/map            { url, width, height }
vtt/<kampanya>/grid           { size, visible, color, opacity, offsetX, offsetY }   offset = haritadaki bir ızgara çizgisinin konumu (px)
vtt/<kampanya>/tokens/<id>    { id, name, x, y, size, img, color, owner, hidden, hp?, conditions?, ac?, monsterId? }   x/y = ızgara hücresi
vtt/<kampanya>/fog            { enabled, revealed: { "x_y": true } }
vtt/<kampanya>/log/<key>      { by, expr, total, text, crit, fumble, label?, at }   en yeni 20 kayıt tutulur
                              eski kayıtlar { by, die, result, at } hâlâ gösterilir; gizli zar burada { by, hidden: true, at }
vtt/<kampanya>/logHidden/<key> { by, expr, total, text, crit, fumble, label?, at }   gizli DM zarı, aynı anahtar; yalnızca DM'ler gösterir
vtt/<kampanya>/initiative     { round, turn, entries: { <id>: { name, init, tokenId, hidden, at } } }   yalnızca DM yazar
vtt/<kampanya>/shapes/<id>    { kind, ox, oy, ex, ey, by, color }   kare cinsinden; kind = circle | cone | line | square
vtt/<kampanya>/measure/<sekme> { who, ax, ay, bx, by, color, at }   yalnızca sürükleme sürerken var
```

Oyuncu HP'si ve durumları ayrıca saklanmıyor, doğrudan `inventories/<karakter>/hp` ve `inventories/<karakter>/conditions` okunuyor. Masadan değişince yalnızca o alan yazılıyor (`fbSaveSheetField`), sayfanın tamamı değil.

## Zar

- **Motor:** `dice.js` (`window.Dice`, DOM yok, Node'da da çalışır). İfadeyi okur, atar, her zarın metnini yazar (atılan zarlar üstü çizili), doğal 20 / 1'i işaretler. Rastgele sayı `crypto.getRandomValues` ile. Log kaydının şekli (`logEntry`, `secretEntry`, `logView`) ve ölüm kurtarma kuralı (`deathSave`) da burada; testler `tests/dice.test.js`.
- **Masa:** `vtt.js` `window.VTT = { roll, postRoll, getRollMode, setRollMode }` dışa aktarır. Sitenin geri kalanı (karakter sayfası) zarları bununla atar.
- **Avantaj:** Adv / Dis, ifadedeki ilk tek d20'yi `2d20kh1` / `2d20kl1` yapar. Seçim tarayıcıda hatırlanır; masadaki ve karakter şeridindeki anahtar aynı ayarı gösterir.
- **Gizli zar:** ⚠️ Firebase Authentication olmadığı için gizlilik yalnızca uygulamada. `logHidden` her oyuncunun tarayıcısına yine de iner (masa tek dinleyiciyle okunuyor). Anahtar açılınca bu söylenir.
- **Ölüm kurtarma:** 10 ve üstü başarı, doğal 1 iki başarısızlık, doğal 20 kutuları sıfırlar ve HP'yi 1 yapar (SRD 5.1).

## ⚠️ Güvenlik — okunması gereken kısım

**1. Veritabanı şu an herkese açık.** Giriş yapmadan `https://mamirockd-d37-default-rtdb.europe-west1.firebasedatabase.app/.json` adresinden okunabiliyor. Bunu yalnızca anahtar listesiyle doğruladım, içeriği okumadım. `accounts` altındaki şifreler **düz metin** olduğu için siteyi bilen herkes tüm şifreleri görebilir. Ayrıca site açılışta `accounts` listesinin tamamını her ziyaretçinin tarayıcısına indiriyor.

**2. DM / oyuncu ayrımı yalnızca arayüzde.** Site Firebase Authentication kullanmadığı için veritabanı kuralları "bu kişi DM mi" sorusunu doğrulayamaz. Teknik bilgisi olan biri tarayıcı konsolundan istediğini yazabilir. Gerçek çözüm Firebase Authentication'a geçmek ve şifreleri veritabanından kaldırmak. Bu, VTT'den bağımsız ve ayrı bir iş.

**3. Önerilen kurallar:** `firebase-rules/` klasöründe.
- `database.rules.json`: Kök okuma/yazmayı kapatır (tüm veritabanı tek seferde silinemez veya indirilemez). Sitenin kullandığı yolları açık tutar ve `vtt/` altındaki verinin şeklini ve boyutunu doğrular. Auth olmadığı için şifre sorununu **çözmez**, yalnızca hasarı sınırlar.
- `storage.rules`: Storage açılınca kullanılacak. Haritalar herkese okunur, yeni dosya yalnızca 10 MB altı görsel olabilir.
- Uygulamadan önce: Firebase konsolu → Realtime Database → Rules → **Rules Playground** ile birkaç okuma/yazmayı deneyin, sonra yayınlayın. Kuralları emülatörde test etmedim. Mevcut kuralların yedeğini alın.

## ⚠️ Firebase Storage açık değil

Projede Storage bucket'ı yok (`mamirockd-d37.firebasestorage.app` 404 döndürüyor). Bu yüzden:
- "Load Map" önce Storage'ı deniyor (yaklaşık 8 sn), başarısız olunca haritayı küçültüp (en fazla 2048 px, ~1,5 MB altı WebP) **veritabanına** yazıyor. Aynı oturumda sonraki yüklemeler doğrudan veritabanına gidiyor.
- Bu çalışıyor ama her harita veritabanını şişiriyor.
- **Açmak için:** Firebase konsolu → Build → Storage → Get started. Yeni Storage bucket'ları **Blaze (kullandıkça öde)** planı gerektiriyor ve kart bilgisi isteniyor. Bu kullanımda ücretsiz kota büyük ihtimalle yeter. Açıldıktan sonra `storage.rules` yayınlanmalı. Kod hiçbir değişiklik gerektirmeden Storage'ı kullanmaya başlar.

## Test kontrol listesi

| Test | Sonuç |
|---|---|
| İki sekme, biri DM biri oyuncu | ✅ Token, harita, ızgara, fog ve gizleme 1 sn içinde yansıyor |
| Oyuncu başkasının token'ını taşımaya çalışıyor | ✅ Taşınmıyor (harita kayar) |
| Oyuncu araç çubuğu | ✅ Yalnızca zoom ve zar görünür |
| Sayfa yenileme | ✅ Harita, token'lar ve fog aynen geliyor |
| Izgara algılama (60 sentetik harita, 4 tohum) | ✅ 57/60. Boyut ve kaydırma ±0,5 px. 1 yanlış alarm (yoğun gürültü), 1 kaçırma (JPEG), 1 çok soluk ızgara 3 katı olarak bulundu. Tuğla/karo zemin deseni ızgara sanılabilir. Gerçek haritalarla denenmeli |
| Büyük harita (16,8 MB JPEG) | ✅ 1600×1280 / 0,7 MB'a küçültüldü, zoom akıcı |
| Eski sekmeler (Inventory, Spells, Features, Notes) | ✅ Geçişler doğru, konsolda hata yok |
| Telefon genişliği (375 px) | ✅ Yatay kaydırma yok. ⚠️ DM araç çubuğu 6 satıra sarıyor (204 px) |
| Telefonda gerçek dokunmatik (pinch, uzun basma menüsü) | ⏳ Gerçek cihazda denenmedi |
| İnternet kesilip geliyor | ⏳ Denenmedi. Firebase SDK yeniden bağlanmayı kendisi yapıyor, sürükleme sırasında kopma ayrıca denenmeli |
| Oyuncu karakter sayfasında HP değiştiriyor → haritadaki çubuk | ⏳ Okuma doğrulandı. Canlı değişiklik gerçek bir hesapla denenmeli |
| Güvenlik kuralları | ⏳ Yazıldı, Rules Playground'da denenmeli |
| Zar ifadesi, Adv/Dis, gizli zar, sayfadan zar (2026-11-07) | ✅ Yazmalar stub'lıyken DM olarak ve rol bellekte değiştirilerek oyuncu olarak; masaüstü ve 375 px. ⏳ İki gerçek kişiyle aynı anda denenmedi |

## Bilinen sınırlar / sonraki işler

- Duvar ve dinamik ışık yok. Fog hücre tabanlı.
- Her kampanyanın kendi masası var (`vtt/<kampanya id>`; MamiRock = `main`). Ayrıntı: CAMPAIGNS.md.
- Telefonda DM araç çubuğu katlanabilir yapılabilir.
- Katalog şu an örnek olarak 3 harita ve 6 token içeriyor. Hepsi bu iş için çizilmiş basit SVG'ler (`assets/`), telif sorunu yok. Yeni öğe eklemek için `vtt-catalog.js` başındaki açıklamaya bakın. Yalnızca kendi çizdiğiniz veya lisansı izin veren görselleri ekleyin. Katalog verisi Firebase'e yazılmaz, yalnızca seçilen dosyanın adresi ve `catalogId` yazılır.
- Ölçümler D&D varsayılanını kullanır: çapraz dahil her kare 5 ft. Koni, uzunluğu kadar geniştir. Çizgi 5 ft genişliğindedir. Bir kare, merkezi şablonun içindeyse etkilenmiş sayılır.
- Şablon silme: masaüstünde sağ tık, dokunmatikte 🧹 butonu (uzun basma menüsü yok).
