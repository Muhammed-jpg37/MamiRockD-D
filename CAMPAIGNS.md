# Kampanyalar — kampanya-sistemi dalı

Site artık D&D Beyond / Roll20 benzeri kampanyalarla çalışıyor. Bir hesabın birden çok karakteri olabiliyor ve birden çok kampanyada bulunabiliyor. Rol (DM / oyuncu) her kampanyada ayrı.

Kodun çoğu `campaign.js` içinde. `index.html` tarafında Firebase fonksiyonları, giriş/çıkış kancaları, karakter forge'una "ek karakter" modu ve DM oyuncu listesi değişti. `vtt.js` aktif kampanyanın masasını kullanıyor.

## Kullanım

**Giriş sonrası:**
- Hatırlanan kampanya (ya da tek kampanya) otomatik açılır. Yoksa kampanya ekranı gelir.
- Kampanya ekranında üç seçenek var: listeden girmek, **yeni kampanya** açmak (açan kişi o kampanyanın DM'idir) ya da **davet koduyla katılmak**.
- `?join=KOD` linki de çalışır. Kod girişten sonra uygulanır ve adres çubuğundan silinir.

**Üst bar:**
- `🏰 Kampanya adı` kampanya değiştirir.
- `📖` kampanya günlüğünü açar. Yeni not varsa yanında nokta görünür.

**Oyuncu:**
- Kampanyada hangi karakteriyle oynadığını seçer, ya da forge ile yeni karakter yaratır (🎭).
- Karakter sayfası o karakterin sayfasıdır.

**DM (⚙ Yönet):**
- Kampanyanın adını değiştirir.
- Davet linkini kopyalar ve **yeni kod** üretir. Yeni kod üretilince eski kod ve link çalışmaz.
- **Sahip:** oyuncuyu co-DM yapar ya da geri alır, herkesi çıkarabilir, kampanyayı siler (adını yazarak onaylar).
- **Co-DM:** oyuncuları çıkarabilir.
- **Herkes** (sahip hariç) kampanyadan ayrılabilir.
- Biri çıkarılınca davet kodu otomatik yenilenir.

**Canlı tepkiler:**
- Çıkarılan ya da kampanyası silinen kullanıcı kampanya ekranına düşer ve "artık X'te değilsiniz" mesajını görür.
- Rolü değişen kullanıcının ekranı yeni role geçer.

**Günlük (📖):**
- DM not yazar, düzenler ve siler. Her not için "herkes" ya da "yalnızca işaretlenen oyuncular" seçilir.
- Oyuncular kendilerine açık notları okur.
- Kişisel Notes sekmesi değişmedi.

**Her kampanyanın ayrı bir VTT masası var.** Harita, token, fog, inisiyatif, zar logu ve şablonlar kampanyaya özel.
- Token sahibi listesi yalnızca o kampanyanın oyuncularını gösterir.
- HP çubuğu, oyuncunun o kampanyadaki karakterinden okunur.
- DM'in oyuncu açılır listesi, kampanyadaki oyuncuları karakter adlarıyla gösterir.

**DM'in oluşturduğu oyuncular** (hızlı oluşturma ya da forge) DM'in aktif kampanyasına otomatik eklenir.

## Veri yapısı

```
campaigns/<id>                       { name, owner, createdAt, inviteCode }
campaigns/<id>/members/<nick>        { role: 'dm'|'player', character, joinedAt }
campaigns/<id>/notes/<noteId>        { title, body, visibleTo: 'all'|{nick:true}, by, createdAt, updatedAt }
invites/<KOD>                        <kampanya id>
characters/<id>                      { name, owner, createdAt }
users/<nick>/campaigns/<id>          true      ← "kampanyalarım" listesi
users/<nick>/characters/<id>         true      ← "karakterlerim" listesi
inventories/<karakter id>            karakter sayfası (eski formatla aynı)
vtt/<kampanya id>/...                VTT masası
```

- **Eski karakterler:** kimliği nickname'leri olarak kaldı, bu yüzden `inventories/<nick>` hiç taşınmadı. Yeni karakterlerin kimliği `ch…` ile başlar.
- **İlk kampanya:** kimliği `main`, adı "MamiRock". Eski VTT masası (`vtt/main`) olduğu gibi duruyor.

## Geçiş (bir kez çalıştı)

Geçiş 5 Kasım 2026'da gerçek veritabanında çalıştırıldı:
- "MamiRock" kampanyası oluştu. Sahibi `ozor`.
- Co-DM'ler: `31`, `dmozor`, `ilhanozor2`.
- 22 oyuncu eklendi, her biri kendi karakteriyle.
- Hiçbir şey silinmedi ya da taşınmadı. Yalnızca 50 kayıt eklendi.
- Davet kodu o gün `CP5NCN` idi. ⚙ Yönet'ten yenilenebilir.

`campaign.js` bu geçişi bir DM'in girişinde, onay sorarak yalnızca `campaigns/main` yoksa yapar. Artık var, o yüzden bir daha çalışmaz.

## ⚠️ Güvenlik

- **Yetkiler yalnızca arayüzde.** Firebase Authentication olmadığı için "DM", "sahip", "çıkarıldı" ve "yalnızca X görebilir" kontrolleri sadece arayüzde yapılıyor. Veritabanına doğrudan erişen biri bunları atlayabilir. "Yalnızca X'e açık" notlar da veritabanından okunabilir. DM not yazarken editör bunu söylüyor.
- **Önerilen kurallar:** `firebase-rules/database.rules.json` yeni yolları içeriyor.
  - Davet kodları ve kampanyalar artık toplu listelenemiyor, yalnızca tek tek okunabiliyor.
  - VTT masaları da toplu okunamıyor ve yalnızca bütün olarak silinebiliyor.
  - Bu kurallar **uygulanmadı**. Önce Rules Playground'da denenmeli. Ayrıntı için VTT.md'deki güvenlik bölümüne bakın.
- **Kesin çözüm Firebase Authentication.** Bu ayrı bir iş.

## Test edilenler

Her adım, sonradan silinen deneme kampanyalarıyla test edildi:
- **Geçiş:** önce kuru çalıştırma, sonra gerçek çalıştırma. İkinci çalıştırmada hiçbir şey yapmıyor.
- **Kampanyaya girme:** tek kampanyada otomatik giriş, kampanya oluşturma, kodla katılma (yanlış ya da kısa kod hata verir, küçük harf kabul edilir), `?join=` linki.
- **Rol:** hesabın genel rolünden farklı olsa bile kampanya rolü uygulanıyor.
- **Karakterler:** forge ile birden çok karakter oluşturma ve karakterler arası geçiş.
- **VTT:** iki kampanya arasında masa geçişi; deneme masasına yazılan token MamiRock masasına gitmiyor.
- **HP:** HP, oyuncunun kampanyadaki karakterinden okunuyor ve karakter değişince takip ediyor.
- **Yönetim:** kod yenileme, co-DM yapma/geri alma, çıkarma (kod da yenileniyor), ad değiştirme, silme (masa da gidiyor). Co-DM'in kısıtlı yetkileri doğru çalışıyor.
- **Canlı tepkiler:** çıkarılan kullanıcı kampanya ekranına düşüyor; rolü değişen kullanıcının ekranı geçiş yapıyor.
- **Günlük:** herkese açık ve kişiye özel not, okunmamış işareti, açık günlüğün canlı güncellenmesi.
- **Gerçek veride salt-okunur kontrol:** co-DM, oyuncu ve kampanyası olmayan hesap.

**Gerçek kullanıcılarla henüz denenmeyenler:**
- Gerçek cihazlarda iki kişinin aynı anda kullanması
- Telefonda kampanya ve karakter ekranları

**Bu dalda ayrıca düzeltilen eski bir hata:** karakter sayfasında `initDefaultFeatures()`, sınıf, tür ve seviyeyi sayfada önceden görünen formdan kopyalıyordu. Bu yüzden yeni forge'lanan bir karakter (ya da DM'in oluşturup baktığı oyuncu) bir önceki sayfanın sınıfını alabiliyordu.
