# Arayüz düzeni ve rol modeli

Dal: `arayuz-duzeni` (`karakter-olusturucu`'dan açıldı, 2026-11-07).

Bu dalda iki iş var ve sırası önemli:

1. **Rol modeli**: hesap başına DM / oyuncu ayrımı kalkar, rol yalnızca kampanyaya ait olur.
2. **Arayüz düzeni**: sayfa Kampanya / Karakter / Masa diye üç ekrana ayrılır.

Önce rol modeli yapılır, çünkü her ekranda neyin görüneceğini rol belirliyor.

Çalışma kuralı: her adım ayrı commit, adımlar arasında kullanıcının onayı beklenir. Testler canlı veritabanında değil, stub'lanmış kayıtlarla (`window.save`, `fbSaveInventory`, `fbSaveVtt`, `fbCampaignUpdate`) yapılır.

---

## 1. Bugünkü durum ve sorunlar

### Düzen

- **Kampanya görünmüyor.** Kampanya, giriş barının içinde küçük bir "🏰 Kampanya adı" düğmesi. Kampanyanın kendi sayfası yok.
- **Üst bar dört şeyi karıştırıyor:**
  - site geneli: Firebase durumu, kullanıcı, Exit
  - kampanya: kampanya düğmesi, 📖 günlük
  - karakter: HP, para, taşıma ağırlığı
  - envanter: "+ Add Item", Wallpaper
- **Ana sekmeler özelliğe göre ayrılmış**, bağlama göre değil: "Inventory System", "Spell System", "Features & Traits", "D&D Notes" ve "VTT" aynı sırada duruyor. VTT bir karakter sekmesi değil, kampanyanın masası.
- **DM paneli** ("Viewing Inventory", "Gift Loot", "+ New Player") sadece envanterle ilgili olduğu halde bütün sekmelerin üstünde duruyor.

### Rol

Veri yapısı rolü zaten kampanya başına tutuyor (`campaigns/<id>/members/<nick>`: `{ role: 'dm' | 'player', character, joinedAt }`):

- Herkes kampanya açabiliyor. Açan kişi o kampanyanın DM'i (owner) oluyor.
- Owner, oyuncuyu co-DM yapabiliyor ve geri alabiliyor.
- `activate()` (`campaign.js`), kampanyaya girince `currentUser.role` değerini o kampanyadaki rolle değiştiriyor.

Hesap rolü ise hâlâ şu yerlerde yaşıyor:

- **Kayıt ekranı** "Player / DM" seçtiriyor (`index.html`, `selectAuthRole`, `#role-card-player` / `#role-card-dm`). Player seçen doğrudan Forge'a gönderiliyor.
- **`accounts/<nick>.role`** kaydı duruyor. Giriş sonrası ve kampanya seçilmemişken bu okunuyor.
- **DM Master Vault:** DM'in kendi nick'iyle açılan bir envanter var (`getDefaultState`, "👑 DM Master Vault").
- **Üst bar** "DM / DUNGEON MASTER" etiketini hesap rolü gibi gösteriyor.
- **"+ New Player"** (DM barı), varsayılan `123` şifresiyle yeni hesap açıyor.

---

## 2. Diğer siteler (2026-11-07 aramaları)

Kaynakların çoğu forum ve topluluk wiki'si. Sitelerin bugünkü hâli farklı olabilir.

| Site | Rol modeli | Düzen |
|---|---|---|
| D&D Beyond | Hesapta DM / oyuncu ayrımı yok. Kampanyayı açan DM olur, aynı hesap başka kampanyada oyuncudur. Kampanyayı başka DM'e devretmek yok (kullanıcılar şikâyetçi). | Kampanyanın kendi sayfası var: davet linki, karakterler, herkese açık ve gizli DM notları. Karakter sayfası ayrı, kendi sekmeleriyle. |
| Roll20 | Oyunu açan Creator. Oyunculardan birini GM yapabilir; terfi eden GM'in yetkisi Creator'dan az. GM, "Launch as player" ile kendi oyununa oyuncu gibi girebilir. | Masada harita ortada. Sağdaki yan panelde sekmeler var: Chat, Art Library, Journal, Compendium, Jukebox. Oyuncu bazı sekmeleri görmez. |
| Foundry VTT | Rol dünya başına seçilir. Dört seviye var: Player, Trusted Player, Assistant GM, Gamemaster. | Üstte sahne barı, solda araçlar. Sağdaki panelde sekmeler var: Chat, Combat, Scenes, Actors, Items, Journal. |
| Owlbear Rodeo | Odayı açan kişi kimin GM olacağını seçer. GM'liği bir oturum için devredebilir. | En sade düzen. Araç çubuğu sadece sahne açıkken görünür. |

Ortak nokta: **rol hesaba değil, kampanyaya ait.** Düzen de üç bağlama ayrılıyor: kampanya merkezi, karakter sayfası, masa.

Kaynaklar:
- https://www.dndbeyond.com/forums/d-d-beyond-feedback/190534-campaigns/next
- https://www.dndbeyond.com/forums/d-d-beyond-general/d-d-beyond-feedback/208645-d-d-beyond-transfer-dms
- https://www.dndbeyond.com/forums/d-d-beyond-general/general-discussion/76260-how-to-join-a-game-or-invite-players-to-join?comment=24
- https://foundryvtt.com/article/users/
- https://asacolips.gitbook.io/toolkit13-system/getting-started
- https://blog.owlbear.rodeo/owlbear-rodeo-dev-log-7/
- https://help.roll20.net/hc/articles/29620515876375-Invite-Promote-and-Manage-Players
- https://wiki.roll20.net/GM
- https://wiki.roll20.net:443/Sidebar

---

## 3. Alınan kararlar (kullanıcıyla, 2026-11-07)

- **Rol kampanya başına.** Bir hesap bir kampanyada DM, başka birinde oyuncu olabilir. Hesapta rol yok.
- **İskelet herkes için aynı, içerik role göre değişir.** DM ve oyuncu için iki ayrı arayüz yapılmaz.
- **DM'in kişisel envanteri kalkar, yerine kampanyanın eşya deposu gelir.** DM kampanyaya özel homebrew eşya oluşturur ve oyunculara oradan verir (ayrıntı adım R3'te).
- **Oyuncu ekleme sadece davet koduyla olur.** "+ New Player" (varsayılan şifreyle hesap açma) kalkar. Davet kodu ve `?join=KOD` linki zaten çalışıyor.
  - İsimle davet (DM bir nick yazar, oyuncuya bekleyen davet düşer) daha sonra eklenebilir. Bunun için bekleyen davetler listesi ve kabul ekranı gerekir. Ayrıca nick'lerin var olup olmadığını dışarıya göstermemesi gerekir. Bu yüzden şimdilik yapılmıyor.

---

## 4. Plan: rol modeli (önce bu)

**R1. Kayıtta rol seçimi kalkar.**
- Kayıt sadece nick ve şifre ister. `#role-card-player` / `#role-card-dm` ve `selectAuthRole` kaldırılır.
- Kayıttan sonra kampanya ekranı açılır: kampanya oluştur, kodla katıl ya da karakter yap.
- Kayıt artık Forge'a zorla göndermez.
- **Yapıldı** (`kampanya-rolleri` dalı). Yeni hesaplara yine `role: 'player'` yazılıyor. Bunun iki sebebi var: eski kod bu alanı okuyor ve önerilen veritabanı kuralları bu alanı istiyor. R2'den sonra bu alan hiçbir şeyi belirlemez.

**R2. Rolün tek kaynağı aktif kampanya olur.**
- `accounts/<nick>.role` artık okunmaz. Silinmez; eski veri olduğu gibi durur.
- Kampanya seçili değilken rol yoktur ve kampanya ekranı gösterilir.
- Üst bar kampanyadaki rolü yazar, örneğin "SA AS · DM".
- `currentUser.role` okuyan yerler (DM barı, VTT yetkileri, `getDefaultState`) kampanya rolüne bağlanır.

**R3. DM Master Vault yerine kampanyanın eşya deposu.**
- Homebrew editörüne (`homebrew-editor.js`) bir **Items** sekmesi eklenir. Diğer homebrew türleri gibi `campaigns/<id>/homebrew/items/<id>` altında saklanır.
- Alanlar: ad, kategori, nadirlik, ağırlık, değer, açıklama ve sheet'in eşya formatındaki diğer alanlar.
- Depo kampanyaya ait, hesaba değil. Bu yüzden co-DM'ler de aynı depoyu görür ve kullanır.
- "Gift Loot" penceresi elle ad yazmak yerine depodan eşya seçtirir. Elle yazma da kalabilir. Seçilen eşya, adet ve altınla birlikte oyuncunun envanterine eklenir.
- Mevcut vault verisi silinmez. Vault ekranı gösterilmez.
- İstenirse vault'taki eşyalar bir kez depoya kopyalanabilir.
- `firebase-rules/database.rules.json` dosyasına `homebrew/items` kuralı eklenir (kurallar hâlâ deploy edilmedi).

**R4. "+ New Player" kalkar.**
- Davet kodu ve davet linki, kampanya ekranında görünür bir yere taşınır (bkz. düzen, Kampanya ekranı).

**R5. "Oyuncu olarak gör".**
- DM kendi kampanyasında ekranı bir oyuncunun gördüğü gibi açabilir (Roll20'deki "Launch as player").
- Bu, düzenin oyuncu hâlini test etmek için de kullanılır.

**R6. Kampanyayı devretme.**
- Owner, kampanyanın sahipliğini bir co-DM'e devreder ve kendisi co-DM olarak kalır.
- Onay için kampanyanın adı yazılır, silmedeki gibi.

---

## 5. Plan: arayüz düzeni (rol modelinden sonra)

### Üst bar (her ekranda aynı, ince)

- Solda logo.
- Belirgin bir **kampanya seçici**: `🏰 Kampanya adı ▾`. Açılınca kampanya listesi, "kodla katıl" ve "yeni kampanya" çıkar.
- Üç ana sekme: **Kampanya · Karakter · Masa**.
- Sağda canlı bağlantı noktası ve kullanıcı menüsü (`👤 nick · rol ▾`). Ayarlar, Wallpaper, Karakterlerim ve Exit bu menüye girer.

Üst bardan çıkanlar: HP, para ve ağırlık Karakter ekranına; "+ Add Item" Envanter sekmesine; DM barı ilgili ekranlara dağılır.

### Ekran 1: Kampanya

```
┌───────────────────────────────────────────────────────────────┐
│ ⚔ MamiRock  [🏰 SA AS ▾]  Kampanya | Karakter | Masa   ● 👤 ▾ │
├──────────────────────────────────────┬────────────────────────┤
│ Parti                                │ ▶ Masaya git           │
│ ┌──────────┐┌──────────┐┌──────────┐ │   son harita, inisiy.  │
│ │ portre   ││ portre   ││ + karak- │ │────────────────────────│
│ │ ad, sınıf││ ad, sınıf││ terle    │ │ Davet: kod · kopyala   │
│ │ HP ▬▬▭   ││ HP ▬▬▬   ││ katıl    │ │────────────────────────│
│ └──────────┘└──────────┘└──────────┘ │ DM araçları            │
│ Günlük                               │ Yönet · Homebrew ·     │
│ son notlar · yeni not                │ Eşya deposu · Loot ver │
└──────────────────────────────────────┴────────────────────────┘
```

- Parti kartları: portre, ad, sınıf ve seviye, HP çubuğu, "Sayfayı aç".
- Günlük: oyuncu kendisine açık notları görür, DM gizli notları da görür ve yazar.
- Davet ve DM araçları sadece DM'e görünür.

### Ekran 2: Karakter

```
┌───────────────────────────────────────────────────────────────┐
│ üst bar                                                       │
├───────────────────────────────────────────────────────────────┤
│ (portre) Ad ▾          HP 38/45 −/+  AC 17  Init +2  Hız 30   │
│ İnsan Savaşçı 5        Altın 120     [Level up][Forge][Dinlen]│
├───────────────────────────────────────────────────────────────┤
│ Genel | Envanter | Büyüler | Özellikler | Notlar              │
├────────────────────┬────────────────────┬─────────────────────┤
│ Yetenekler,        │ Beceriler          │ Saldırılar,         │
│ kurtarma zarları   │                    │ buff/debuff, duyular│
└────────────────────┴────────────────────┴─────────────────────┘
```

- Karakter şeridi her sekmede görünür: HP, AC, Init, Hız, altın, taşıma ağırlığı.
- Ad yanındaki seçici: oyuncuda kendi karakterleri, DM'de kampanyadaki bütün oyuncuların karakterleri.
- Bugünkü sekmelerin karşılığı:
  - Inventory → Envanter (Equipped Items ve "+ Add Item" burada)
  - Spell System → Büyüler
  - Features & Traits → Özellikler
  - D&D Notes → Notlar
  - Character Stats & Bonuses → Genel

### Ekran 3: Masa (VTT)

```
┌───────────────────────────────────────────────────────────────┐
│ üst bar                                                       │
├────┬──────────────────────────────────────────┬───────────────┤
│ ↖  │                                          │ Zar|İnis.|Tok.│
│ 📏 │                                          │               │
│ ✏  │               Harita                     │ zar logu,     │
│ ☁  │                                          │ atış kutusu   │
│ +  │                                          │               │
├────┴──────────────────────────────────────────┴───────────────┤
│ Mini karakter barı: HP · AC · hızlı zar                       │
└───────────────────────────────────────────────────────────────┘
```

- Harita tam genişlikte.
- Solda araç çubuğu. Oyuncu sadece kendi araçlarını görür; fog, sahne, token ekleme ve parti düğmesi DM'e özel.
- Sağda sekmeli panel: Zar (log ve atış), İnisiyatif, Token.
- Altta oyuncunun karakterinin mini barı.

### Role göre farklar

| Ekran | Oyuncu | DM (ek olarak) |
|---|---|---|
| Kampanya | Parti kartları, kendisine açık günlük notları, "Masaya git", karakter seçme | Davet, Yönet, homebrew, eşya deposu, loot ver, gizli notlar |
| Karakter | Sadece kendi karakterleri | Kampanyadaki bütün karakterler; açar ve düzenler |
| Masa | Zar, inisiyatifi görür, kendi token'ını oynatır | Sol araç çubuğunun tamamı (fog, sahne, token ekle, parti), gizli zar, inisiyatifi yönetir |

### Açılış ekranı

- DM önce **Kampanya** ekranına düşer.
- Oyuncu önce **Karakter** ekranına düşer.
- Masada aktif bir oturum varsa ikisinde de "Masaya git" öne çıkar.

### Telefon

- Üç ana sekme alt navigasyona iner.
- Karakter şeridi iki satıra kırılır.
- Masada sağ panel alttan açılan bir çekmeceye dönüşür.
- Telefon genişliğinde yatay kaydırma olmaz. Bugün DM araç çubuğu 6 satıra taşıyor; bu düzelir.

### Düzen adımları (taslak, rol modeli bitince netleşir)

- **L1.** Üst bar ve kampanya seçici; Kampanya / Karakter / Masa sekme iskeleti.
- **L2.** Kampanya ekranı.
- **L3.** Karakter ekranı: karakter şeridi ve beş sekme. Mevcut panellerin taşınması.
- **L4.** Masa ekranı: tam genişlik harita, sol araçlar, sağ panel.
- **L5.** Telefon düzeni.
- **L6.** Role göre görünürlük ve açılış ekranı; "Oyuncu olarak gör" (R5) ile kontrol.
