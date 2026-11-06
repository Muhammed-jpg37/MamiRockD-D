# Karakter oluşturucu — karakter-olusturucu dalı

Eski karakter forge'unun yerini D&D Beyond benzeri bir karakter oluşturucu aldı. Oluşturucu D&D 5e **2014** kurallarını kullanıyor, yalnızca **SRD 5.1** içeriğiyle. SRD, CC-BY-4.0 lisanslı; atıf `rules/srd5.js` başında. Eksik içerik (yeni türler, alt sınıflar, geçmişler, feat'ler) her kampanyada DM tarafından homebrew olarak eklenebiliyor.

Bu dal `kampanya-sistemi` dalından açıldı. Henüz `main`'e birleştirilmedi.

## Dosyalar

- **`rules/srd5.js`**: kural verisi (`window.RULES_SRD5`).
  - 12 sınıf, her birinin SRD'deki tek alt sınıfı.
  - 9 tür: Dwarf, Elf, Halfling, Human, Dragonborn, Gnome, Half-Elf, Half-Orc, Tiefling (alt türleriyle).
  - 1 geçmiş (Acolyte), 1 feat (Grappler).
  - Büyü slotu ve Pact Magic tabloları, yetenek puanı yöntemleri, başlangıç ekipmanı ve parası.
  - Sınıfların büyü tabloları (cantrip, bilinen büyü, hazırlanan büyü, büyü kitabı, Mystic Arcanum, Magical Secrets), alt sınıf büyüleri (Domain, Oath, Circle, Fiend) ve tür büyüleri (High Elf, Tiefling).
- **`rules/srd5-spells.js`**: SRD 5.1'in 319 büyüsü (`window.SPELLS_SRD5`), oluşturucunun büyü seçimleri için.
- **`rules/srd52-spells.js`**: SRD 5.2'nin (2024) 339 büyüsü, Spells sekmesinin kataloğu için.
- **`spell-catalog.js`**: Spells sekmesinin kataloğu (2014 ve 2024 büyüleri, SRD dışı büyüler yalnızca adlarıyla).
- **`spell-saved.js`**: sayfalara kaydedilmiş büyüleri katalogdan yeniler.
- **`character-engine.js`**: kural motoru (`window.CharacterEngine`). DOM kullanmıyor, tarayıcıda ve Node'da çalışıyor.
- **`character-builder.js`**: sihirbaz ve seviye atlama ekranı.
- **`homebrew-editor.js`**: kampanya homebrew editörü ve oluşturucu ayarları.
- **`campaign.js`**: "🎭 Karakterlerim" ekranı, homebrew ve ayarların takibi.
- **`index.html`**: "CHARACTER BUILDER HOOK-UP" bloğu, oluşturucuyu karakter sayfasına bağlıyor.
- **`tests/`**: motor, kural verisi ve büyü testleri. `tests/browser-runner.html` Node olmayan makinelerde testleri tarayıcıda çalıştırır.

## Kullanım

### Yeni karakter

Eski forge'un açıldığı her yerde artık oluşturucu açılıyor: kayıt, kampanyada yeni karakter (🎭), DM'in yeni oyuncu oluşturması.

Sihirbazın 8 adımı var:

1. **Class**: sınıf ve başlangıç seviyesi.
2. **Origin**: tür, alt tür, türün seçimleri, geçmiş, diller.
3. **Abilities**: standart dizi, point buy (27 puan, 8–15, bütçe canlı görünür) ya da 4d6 atışı (her sonuç bir kez atanır). DM izin verdiyse elle yazma da var. Tür bonusları ve modifier'lar canlı görünür.
4. **Choices**: alt sınıf (geldiği seviyede), sınıf ve alt sınıf becerileri, expertise, fighting style, her ASI seviyesinde ASI ya da feat, HP (ortalama ya da atış).
5. **Spells**: cantrip'ler, bilinen büyüler ya da büyü kitabı, Mystic Arcanum, Magical Secrets, Circle of the Land'in arazisi ve türün cantrip'i. Ayrıntısı aşağıda, "Büyüler" bölümünde.
6. **Equipment**: sınıfın ekipman seçenekleri ya da atılmış başlangıç altını.
7. **Details**: ad, alignment, görünüm, kişilik, geçmiş hikâyesi, portre (256 px kareye kırpılır).
8. **Review**: hesaplanmış karakter sayfası. Eksik ya da hatalı her şey listelenir, her maddenin yanında onu düzelten adıma giden buton var.

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
- O seviyenin getirdiği seçimler: alt sınıf, ASI ya da feat, fighting style, expertise, yeni sınıfın becerileri, seviyeyi alan sınıfın yeni büyüleri (bilinen bir büyüyü değiştirmek de burada).
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

### Büyüler

Oluşturucu, büyü seçimlerini SRD 5.1 büyüleri ve kampanyanın homebrew büyüleri arasından yaptırır. Hangi sınıfın ne alacağını motor hesaplar:

| Sınıf | Nasıl büyü alır |
|---|---|
| Bard, Sorcerer, Warlock, Ranger | **Bilinen büyüler** (sayı sınıf tablosundan). Seviye atlarken bir büyüyü değiştirebilir. |
| Cleric, Druid, Paladin | **Hazırlanan büyüler**: her gün tüm sınıf listesinden. Sayı = yetenek modifier'ı + seviye (Paladin: seviyenin yarısı), en az 1. |
| Wizard | **Büyü kitabı**: 1. seviyede 6 büyü, her seviyede 2 büyü daha. Hazırlanan büyüler kitaptan seçilir. |

- **Cantrip'ler** sınıf tablosundan gelir. Circle of the Land 2. seviyede bir cantrip daha verir.
- **Bard, Magical Secrets** (10, 14, 18. seviye): bilinen büyülerin 2'şeri herhangi bir sınıfın listesinden olabilir. College of Lore'un 6. seviyedeki 2 ek büyüsü bilinen büyü sayısına girmez.
- **Warlock, Mystic Arcanum** (11, 13, 15, 17. seviye): 6–9. seviyeden birer büyü. Bilinen büyü sayısına girmez. The Fiend, warlock listesine kendi büyülerini ekler.
- **Her zaman hazır büyüler**: Life Domain, Oath of Devotion ve Circle of the Land (seçilen araziye göre) kendi büyülerini verir. Bunlar hazırlanan büyü sayısına girmez.
- **Tür büyüleri**: High Elf bir wizard cantrip'i seçer. Tiefling, 1. seviyede Thaumaturgy, 3. seviyede Hellish Rebuke, 5. seviyede Darkness alır (son ikisi uzun dinlenme başına bir kez).
- **Multiclass**: her sınıf, seçebileceği en yüksek büyü seviyesini kendi seviyesine göre hesaplar (2014 kuralı). Ortak slot tablosu buna karışmaz.
- **Hazırlanan büyüler** günlük seçim olduğu için oluşturucuda seçilmez. Oluşturucu yalnızca sayıyı gösterir. Seçim Spells sekmesinde yapılır.

**Spells sekmesiyle bağlantı:**

- Kaydedince oluşturucunun büyüleri Spells sekmesine eklenir (`fromBuild` işaretiyle). Karakter her yeniden kaydedildiğinde bu büyüler yenilenir. Oyuncunun kendi eklediği büyüler korunur ve iki kez eklenmez.
- Oluşturucuyla yapılmış ama henüz büyü seçimi olmayan bir karakter düzenlenirken ya da seviye atlarken, seçimler Spells sekmesindeki 2014 büyülerinden doldurulur. Böylece oyuncudan her şeyi baştan seçmesi istenmez.
- Eksik büyü seçimleri tamamlanmadan karakter kaydedilemez.

**Spells sekmesi:** katalogda 2014 ve 2024 büyüleri ayrı ayrı var, kural seti ve kitap filtresiyle. SRD dışı büyülerde yalnızca ad, seviye ve okul var ("📕 Book only"). Ayrıntılar için kitaba bakılmalı. Sayfalara kaydedilmiş büyüler her açılışta katalogdan yenilenir.

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
- **Spells**: ad, seviye (cantrip–9), okul, hangi sınıfların listesinde olduğu, süre, menzil, bileşenler, malzeme, ritüel, konsantrasyon, ne yaptığı ve yüksek seviyede ne değiştiği. Oluşturucuda o sınıflar için seçilebilir, Spells sekmesinin kataloğunda "Campaign homebrew" kitabıyla görünür. SRD'deki ya da kampanyadaki başka bir büyüyle aynı ad kabul edilmez.

Kimlikler addan üretilir ve hiçbir SRD girdisinin yerine geçmez. Açıklamaları kendi sözlerinizle yazın, kitaptan kopyalamayın.

**⚙ Builder settings** sekmesi:

- **Players may type in ability scores**: yetenek puanlarını elle yazmayı açar. Varsayılan: kapalı.
- **Allow rule breaks (show them as warnings)**: kural ihlalleri (point buy bütçesi, beceri listeleri, ön koşullar…) engel yerine uyarı olur. Varsayılan: kapalı. Eksik seçimler her zaman zorunlu.

## Veri yapısı

```
inventories/<karakter id>/build                       oluşturucu seçimleri (karakter sayfasının içinde)
inventories/<karakter id>/build/choices/spells        büyü seçimleri: { <sınıf>: { cantrips, known, spellbook, arcanum, secrets, land }, species: { cantrips } }
inventories/<karakter id>/spellbook/list              Spells sekmesindeki büyüler (oluşturucudan gelenler fromBuild: true)
inventories/<karakter id>/build/details/portrait      portre (data:image, en fazla 200 000 karakter)
inventories/<karakter id>/portrait                    build'i olmayan eski sayfalarda portre
campaigns/<id>/homebrew/species/<id>                  homebrew tür
campaigns/<id>/homebrew/backgrounds/<id>              homebrew geçmiş
campaigns/<id>/homebrew/feats/<id>                    homebrew feat
campaigns/<id>/homebrew/spells/<id>                   homebrew büyü (rules/srd5-spells.js biçiminde)
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

Testleri çalıştırır (`node --test "tests/*.test.js"`). 93 test var:

- `engine.test.js`: türetme, doğrulama, seviye atlama, multiclass ön koşulları, eski sayfa dönüştürme, homebrew birleştirme.
- `spells.test.js`: SRD 5.1 ve 5.2 büyü verisi, katalog etiketleri ve birleştirme.
- `class-spells.test.js`: sınıfların büyü tabloları.
- `engine-spells.test.js`: alt sınıf ve tür büyüleri, motorun büyü sayıları, seçenekleri ve doğrulaması, homebrew büyüler.
- `saved-spells.test.js`: kayıtlı büyülerin katalogdan yenilenmesi.

Node kurulu olmayan bir makinede siteyi sunun ve `/tests/browser-runner.html` adresini açın. Aynı testleri tarayıcıda çalıştırır. Son çalıştırmada 93 testin hepsi orada geçti. `npm test` ile henüz çalıştırılmadı.

Arayüz için otomatik test yok. Tarayıcıda denerken gerçek veritabanına yazmamak için kayıt fonksiyonlarını (`window.save`, `fbSaveInventory`, `fbSaveVtt`) sahteleyin ya da sonradan silinecek deneme verisi kullanın.

**Henüz denenmeyenler:** gerçek oyuncu hesaplarıyla kullanım ve telefonda sihirbaz ekranları.

## Bilinen eksikler

- ⚔ Forge düzenleme ekranı yalnızca **ilk** sınıfın seçimlerini gösterir. Diğer sınıfların seçimleri seviye atlama ekranında yapılır.
- Kampanya homebrew'u ile yapılmış bir karakter yalnızca o kampanyanın içinde yeniden düzenlenebilir.
- Feature açıklamaları yalnızca ad olarak var.
- Oluşturucunun büyü seçimleri yalnızca 2014 (SRD 5.1) kurallarıyla. 2024 büyüleri Spells sekmesinde var ama oluşturucuda yok.
- Spells sekmesinde hazırlanan büyü sayısı kontrol edilmiyor. Oyuncu kaç büyü hazırlayabileceğini oluşturucuda görüyor.
- SRD 5.1 verisinde Warlock'un 6. seviye listesinde Arcane Gate yok. Kontrol edilmedi.
- Site herkese açılacaksa, SRD dışı büyüleri gizleyen bir lisans ayarı ve görünür bir CC-BY atfı gerekiyor. Şimdilik arkadaşlar arasında olduğu için ertelendi.
- Dönüştürme, açıklayamadığı beceri yeterliliklerini düşürür ve ASI'leri en yüksek puana +2 sayar. Review ekranı kaydetmeden önce ikisini de listeler.
- SRD'de her sınıfın yalnızca bir alt sınıfı, yalnızca bir geçmiş ve bir feat var. Gerisi homebrew ile eklenmeli. Lisansı olmayan resmi kitap içeriği (PHB vb.) siteye kopyalanmamalı.

## ⚠️ Güvenlik

VTT.md ve CAMPAIGNS.md'deki uyarılar burada da geçerli:

- **Firebase Authentication yok.** "Yalnızca DM homebrew ekler", "başkasının karakteri silinemez" ve "katı kurallar" kontrolleri yalnızca arayüzde. Veritabanına doğrudan erişen biri bunları atlayabilir.
- **Veritabanı herkese açık** ve `accounts/` düz metin şifreler içeriyor. Gerçek kullanımdan önce düzeltilmeli.
- **Firebase Storage açık değil.** Portreler küçük data URL olarak veritabanına yazılıyor.
