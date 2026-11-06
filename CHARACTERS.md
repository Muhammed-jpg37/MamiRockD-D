# Karakter oluşturucu — karakter-olusturucu dalı

Eski karakter forge'unun yerini D&D Beyond benzeri bir karakter oluşturucu aldı. Oluşturucu D&D 5e **2014** kurallarını kullanıyor, yalnızca **SRD 5.1** içeriğiyle. SRD, CC-BY-4.0 lisanslı; atıf `rules/srd5.js` başında. Eksik içerik (yeni türler, alt sınıflar, geçmişler, feat'ler) her kampanyada DM tarafından homebrew olarak eklenebiliyor.

Bu dal `kampanya-sistemi` dalından açıldı. Henüz `main`'e birleştirilmedi.

## Dosyalar

- **`rules/srd5.js`**: kural verisi (`window.RULES_SRD5`).
  - 12 sınıf, her birinin SRD'deki tek alt sınıfı.
  - 9 tür: Dwarf, Elf, Halfling, Human, Dragonborn, Gnome, Half-Elf, Half-Orc, Tiefling (alt türleriyle).
  - 1 geçmiş (Acolyte), 1 feat (Grappler).
  - Büyü slotu ve Pact Magic tabloları, yetenek puanı yöntemleri, başlangıç ekipmanı ve parası.
- **`character-engine.js`**: kural motoru (`window.CharacterEngine`). DOM kullanmıyor, tarayıcıda ve Node'da çalışıyor.
- **`character-builder.js`**: sihirbaz ve seviye atlama ekranı.
- **`homebrew-editor.js`**: kampanya homebrew editörü ve oluşturucu ayarları.
- **`campaign.js`**: "🎭 Karakterlerim" ekranı, homebrew ve ayarların takibi.
- **`index.html`**: "CHARACTER BUILDER HOOK-UP" bloğu, oluşturucuyu karakter sayfasına bağlıyor.
- **`tests/engine.test.js`**: motor testleri.

## Kullanım

### Yeni karakter

Eski forge'un açıldığı her yerde artık oluşturucu açılıyor: kayıt, kampanyada yeni karakter (🎭), DM'in yeni oyuncu oluşturması.

Sihirbazın 7 adımı var:

1. **Class**: sınıf ve başlangıç seviyesi.
2. **Origin**: tür, alt tür, türün seçimleri, geçmiş, diller.
3. **Abilities**: standart dizi, point buy (27 puan, 8–15, bütçe canlı görünür) ya da 4d6 atışı (her sonuç bir kez atanır). DM izin verdiyse elle yazma da var. Tür bonusları ve modifier'lar canlı görünür.
4. **Choices**: alt sınıf (geldiği seviyede), sınıf ve alt sınıf becerileri, expertise, fighting style, her ASI seviyesinde ASI ya da feat, HP (ortalama ya da atış).
5. **Equipment**: sınıfın ekipman seçenekleri ya da atılmış başlangıç altını.
6. **Details**: ad, alignment, görünüm, kişilik, geçmiş hikâyesi, portre (256 px kareye kırpılır).
7. **Review**: hesaplanmış karakter sayfası. Eksik ya da hatalı her şey listelenir, her maddenin yanında onu düzelten adıma giden buton var.

- Her adım sekmesinde ✓ (tamam) ya da ● (eksik) görünür.
- Karakter kurallara uygun ve adlandırılmış olunca **Create** açılır.
- **⚡ Quick Build** yalnızca tür, sınıf ve ad sorar, gerisini doldurur.

Kaydedilen sayfa eski formatla aynı. Seçimler ayrıca `state.build` içinde tutuluyor. Başlangıç ekipmanı eşya olarak eklenir: adı eski forge'daki bir eşyayla eşleşirse onun istatistikleri kullanılır. İlk zırh, kalkan ve silah kuşanılmış gelir ve AC bunlarla hesaplanır.

### Karakteri düzenleme (⚔ Forge)

Oluşturucuyla yapılmış bir sayfada ⚔ Forge aynı sihirbazı Equipment adımı olmadan açar. Buton "Save changes" olur.

Kaydederken eşyalar, büyüler, AC, notlar, oyuncunun kendi eklediği feature kartları ve özel bonuslar korunur. Mevcut HP yeni maksimumla birlikte kayar. Harcanmış büyü slotları yeni sınıra indirilir.

### Seviye atlama (⬆ Level)

Oluşturucuyla yapılmış, 20. seviyenin altındaki karakterlerin sayfasında **⬆ Level** butonu var. Tek ekranlık bir seviye atlama açar:

- Seviyeyi alacak sınıfı seçme ya da yeni bir sınıfa **multiclass**.
- HP: ortalama hit die, ekranda atış ya da gerçek atışı yazma.
- O seviyenin getirdiği seçimler: alt sınıf, ASI ya da feat, fighting style, expertise, yeni sınıfın becerileri.
- Kaydetmeden önce neyin değiştiği gösterilir.

Multiclass ön koşulları (ör. 13 STR) katı kampanyada sınıfı kilitler. DM kuralları gevşettiyse yalnızca uyarı olarak görünür. Kaydedince eşyalar, büyüler ve notlar korunur, mevcut HP kazanılan kadar artar.

### Eski karakterleri dönüştürme

Oluşturucudan önce yapılmış sayfalar (`build` yok) bozulmadı, eski forge ile açılmaya devam ediyor. ⚔ Forge ya da ⬆ Level basılınca site karakteri dönüştürmeyi **teklif eder**. Oyuncu istemezse eski forge açılır.

Dönüştürme:

- Motor, sayfadan seçimleri tahmin eder ve oluşturucu Review adımında açılır.
- Yapılan varsayımlar listelenir: tek seçenekli alt türler, ASI'lerin en yüksek puana +2 sayılması, açıklanamadığı için düşecek beceri yeterlilikleri, yeni maksimum HP.
- Sayfadaki yetenek puanları aynı kalır. Tür bonusları ve varsayılan ASI'ler taban puandan düşülür.
- Oyuncu onaylayana kadar hiçbir şey kaydedilmez.
- Eşyalar, büyüler, AC, notlar, geçmiş bilgileri, portre ve oyuncunun kendi feature kartları korunur. Aynı adlı feature iki kez eklenmez.
- SRD dışı sınıflar (ör. Artificer) ve multiclass yazılmış sayfalar dönüştürülemez. Bunlar eski forge ile kalır.

### 🎭 Karakterlerim

Kampanya ekranındaki "🎭 Karakterlerim" (My characters), hesabın karakterlerini listeler: portre, seviye/sınıf/tür ve hangi kampanyalarda oynandığı.

- **Ad değiştirme**: listede yerinde. Kayıt, sayfa başlığı ve build adı birlikte değişir.
- **Kopyalama**: bütün sayfa (eşya, büyü, not) yeni bir kimlikle, "… (copy)" adıyla.
- **Silme**: kayıt, liste girdisi, sayfa ve duvar kâğıdı silinir. Bir kampanya karakteri hâlâ kullanıyorsa silinmez. Hesabın ilk karakteri de silinmez, çünkü giriş o sayfayı açıyor.
- **Portre**: ekleme, değiştirme, kaldırma. 256 px kareye kırpılır.
- **Sınır**: hesap başına en fazla **10 karakter** (`MAX_CHARACTERS`). Sınırda oluşturma ve kopyalama reddedilir.

### Portre = VTT token'ı

- Kendi resmi olmayan bir token, sahibinin karakter portresini gösterir. Portre değişince token canlı güncellenir.
- DM'in VTT araç çubuğunda **👥 Party** butonu var: haritada token'ı olmayan, karakteri olan her oyuncu için bir token ekler.

### Homebrew ve oluşturucu ayarları (DM)

⚙ Yönet → **"Homebrew & builder settings"**. Eklenenler o kampanyadaki herkesin oluşturucusunda görünür.

- **Species**: boyut, hız, yetenek bonusları, oyuncunun seçeceği bonuslar, beceriler, duyular, diller, özellikler, seviye başına ek HP, silah/zırh/alet yeterlilikleri, dirençler.
- **Subraces**: herhangi bir türün alt türü (SRD türleri dahil).
- **Backgrounds**: beceriler, diller, aletler, feature, ekipman (başlangıç parası için "… 10 gp" yazılır).
- **Feats**: minimum puan ön koşulları, yetenek artışları, açıklama.
- **Subclasses**: herhangi bir sınıfın alt sınıfı. Seviyeye göre feature'lar `3: A, B` satırlarıyla yazılır. Ek yeterlilikler, HP ve zırhsız AC da var.

Kimlikler addan üretilir ve hiçbir SRD girdisinin yerine geçmez.

**⚙ Builder settings** sekmesi:

- **Players may type in ability scores**: yetenek puanlarını elle yazmayı açar. Varsayılan: kapalı.
- **Allow rule breaks (show them as warnings)**: kural ihlalleri (point buy bütçesi, beceri listeleri, ön koşullar…) engel yerine uyarı olur. Varsayılan: kapalı. Eksik seçimler her zaman zorunlu.

## Veri yapısı

```
inventories/<karakter id>/build                       oluşturucu seçimleri (karakter sayfasının içinde)
inventories/<karakter id>/build/details/portrait      portre (data:image, en fazla 200 000 karakter)
inventories/<karakter id>/portrait                    build'i olmayan eski sayfalarda portre
campaigns/<id>/homebrew/species/<id>                  homebrew tür
campaigns/<id>/homebrew/backgrounds/<id>              homebrew geçmiş
campaigns/<id>/homebrew/feats/<id>                    homebrew feat
campaigns/<id>/homebrew/subraces/<tür id>/<id>        homebrew alt tür
campaigns/<id>/homebrew/subclasses/<sınıf id>/<id>    homebrew alt sınıf
campaigns/<id>/settings/builder                       { allowManual, strict }
```

- Karakter, **seçimleri** olarak saklanır (`state.build`). Sayfadaki sayılar (`characterStats`, HP, büyü slotları, feature'lar) motorun `derive(build, rules)` fonksiyonuyla bunlardan hesaplanır.
- Arayüz hiçbir kuralı kendisi hesaplamaz. Bütün sayılar ve kurallar `character-engine.js`'den gelir.
- `firebase-rules/database.rules.json` önerisi yeni yolları içeriyor. Kurallar hâlâ **uygulanmadı**.

## Testler

```bash
npm test
```

Motor testlerini çalıştırır (`node --test "tests/*.test.js"`). 33 test geçiyor: türetme, doğrulama, seviye atlama, multiclass ön koşulları, eski sayfa dönüştürme, homebrew birleştirme.

Arayüz için otomatik test yok. Tarayıcıda denerken gerçek veritabanına yazmamak için kayıt fonksiyonlarını (`window.save`, `fbSaveInventory`, `fbSaveVtt`) sahteleyin ya da sonradan silinecek deneme verisi kullanın.

**Henüz denenmeyenler:** gerçek oyuncu hesaplarıyla kullanım ve telefonda sihirbaz ekranları.

## Bilinen eksikler

- ⚔ Forge düzenleme ekranı yalnızca **ilk** sınıfın seçimlerini gösterir. Diğer sınıfların seçimleri seviye atlama ekranında yapılır.
- Kampanya homebrew'u ile yapılmış bir karakter yalnızca o kampanyanın içinde yeniden düzenlenebilir.
- Feature açıklamaları yalnızca ad olarak var.
- Bilinen büyü ve cantrip sayıları modellenmedi. Oyuncular büyüleri Spells sekmesinden ekliyor.
- Dönüştürme, açıklayamadığı beceri yeterliliklerini düşürür ve ASI'leri en yüksek puana +2 sayar. Review ekranı kaydetmeden önce ikisini de listeler.
- SRD'de her sınıfın yalnızca bir alt sınıfı, yalnızca bir geçmiş ve bir feat var. Gerisi homebrew ile eklenmeli. Lisansı olmayan resmi kitap içeriği (PHB vb.) siteye kopyalanmamalı.

## ⚠️ Güvenlik

VTT.md ve CAMPAIGNS.md'deki uyarılar burada da geçerli:

- **Firebase Authentication yok.** "Yalnızca DM homebrew ekler", "başkasının karakteri silinemez" ve "katı kurallar" kontrolleri yalnızca arayüzde. Veritabanına doğrudan erişen biri bunları atlayabilir.
- **Veritabanı herkese açık** ve `accounts/` düz metin şifreler içeriyor. Gerçek kullanımdan önce düzeltilmeli.
- **Firebase Storage açık değil.** Portreler küçük data URL olarak veritabanına yazılıyor.
