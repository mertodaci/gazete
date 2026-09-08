# Gazete — Kişiselleştirilmiş AI Haber Bülteni: Tasarım

## Amaç

Türkiye'ye yönelik, tamamen otomatik çalışan, kişiselleştirilmiş yapay zekâ destekli bir e-posta haber bülteni. Kullanıcılar web arayüzünden ilgi duydukları kategorileri seçip e-posta ile ücretsiz abone olur. Sistem güvenilir kaynaklardan haberleri günlük olarak toplar, tekrarları ayıklar, kategorilere ayırır, Türkçe kısa özetler üretir ve her sabah 09:00'da (Europe/Istanbul) kişiye özel bülteni kaynak bağlantılarıyla birlikte gönderir.

## Kapsam dışı (bu spec için)

- Kullanıcı hesapları / şifre ile giriş (token-bazlı linkler yeterli)
- Ödeme/ücretli plan (tamamen ücretsiz)
- Mobil uygulama
- Çoklu dil desteği (yalnızca Türkçe)

## Varsayımlar ve kısıtlar (brainstorming sırasında netleşen kararlar)

- **Ölçek:** Başlangıçta küçük (0-1000 abone). Kuyruk sistemi (queue/message broker) gibi ek altyapı YOK — basit cron + tek sunucu yeterli.
- **Haber kaynağı:** Yalnızca RSS beslemeleri (web scraping veya üçüncü parti haber API'si kullanılmayacak).
- **Kategoriler (sabit set, v1):** Gündem, Ekonomi, Teknoloji, Spor, Dünya, Sağlık, Kültür-Sanat.
- **AI sağlayıcı:** Claude API (küçük/ucuz bir model, örn. Haiku ailesi) — özetleme ve gerektiğinde kategori sınıflandırma.
- **E-posta gönderimi:** Transactional e-posta servisi (Resend veya Brevo) — VPS'ten doğrudan SMTP kullanılmayacak (deliverability riski).
- **Altyapı:** Kullanıcının kendi VPS'i (henüz boş, Docker kurulacak). Domain henüz yok — başlangıçta IP veya geçici subdomain ile çalışılabilir, e-posta linklerindeki base URL konfigüre edilebilir olacak.
- **Gönderici e-posta (geliştirme aşaması):** Doğrulanmış bir domain olmadan Resend/Brevo, hesap sahibinin kendi (doğrulanmış) e-posta adresi dışına toplu gönderime izin vermez. Geliştirme ve test süresince gönderim yalnızca geliştiricinin kendi e-posta adresine yapılacak. **Gerçek abonelere açılmadan önce bir domain satın alınıp DNS (SPF/DKIM) kayıtları eklenmelidir** — kod, `FROM_EMAIL`/domain'i ortam değişkeninden okuyacak şekilde yazılacağı için bu geçiş kod değişikliği gerektirmez, sadece konfigürasyon + domain doğrulamasıdır.
- **Teknoloji yığını:** Node.js + TypeScript, PostgreSQL, Prisma ORM.
- **Zaman dilimi:** Europe/Istanbul = UTC+3 sabit (Türkiye'de DST yok, 2016'dan beri) — zamanlama mantığını basitleştiriyor.

## Mimari

```
┌─────────────────────────────────────────────────────────────┐
│                         VPS (Docker Compose)                 │
│                                                               │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐ │
│  │  Caddy       │──▶│  apps/web    │   │  apps/worker      │ │
│  │  (TLS/proxy) │   │  (Next.js)   │   │  (cron process)   │ │
│  └──────────────┘   └──────┬───────┘   └────────┬──────────┘ │
│                             │                     │            │
│                             ▼                     ▼            │
│                      ┌─────────────────────────────────┐      │
│                      │      PostgreSQL (Docker)         │      │
│                      └─────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
         │                                          │
         ▼                                          ▼
   ┌───────────┐                          ┌──────────────────┐
   │ Resend/   │◀─────────────────────────│  Claude API      │
   │ Brevo API │  (hoş geldin, dijest      │  (özetleme,      │
   │           │   e-postaları)           │   kategorilendirme)│
   └───────────┘                          └──────────────────┘
```

### Bileşenler

- **apps/web** (Next.js): Herkese açık abonelik formu, tercih güncelleme sayfası, tek tıkla çıkış sayfası. API route'ları bu işlemleri PostgreSQL'e yazar.
- **apps/worker**: Tek bir uzun-süreçli Node process, `node-cron` ile 3 zamanlanmış görev:
  1. RSS çekme — her saat başı
  2. Dedup + özetleme/kategorilendirme — çekmenin hemen ardından
  3. Dijest oluşturma + gönderim — her gün 08:45 Europe/Istanbul
- **packages/db**: Paylaşılan Prisma şeması ve client, hem web hem worker tarafından import edilir.
- **PostgreSQL**: Tek veritabanı, tüm durumu tutar.
- **Claude API**: Özetleme ve gerektiğinde kategori sınıflandırma.
- **Resend/Brevo**: Hoş geldin ve günlük dijest e-postalarının gönderimi + bounce webhook'u.

Web ve worker'ın ayrı process olması, biri çökse/deploy edilirken diğerinin etkilenmemesini sağlar; küçük ölçekte bile bu ayrım az bir ek karmaşıklıkla gerçek dayanıklılık kazandırır.

## Veri Modeli

```
sources                (id, name, rss_url, category, active)
articles               (id, source_id→sources, url [unique], title,
                        published_at, fetched_at, raw_description)
stories                (id, category, canonical_title, ai_summary_tr,
                        digest_date, created_at)
story_articles         (story_id→stories, article_id→articles)   -- join tablosu
subscribers            (id, email [unique], status[active|unsubscribed],
                        preferences_token, created_at)
subscriber_categories  (subscriber_id→subscribers, category)
digest_sends           (id, subscriber_id→subscribers, digest_date,
                        sent_at, status[pending|sent|failed])
```

Notlar:
- `articles` → `stories` ayrımı, aynı olayı birden fazla kaynağın haber yapması durumunda tek bir özetin altında **birden fazla kaynak linki** göstermeyi sağlar.
- Kategori ataması **kaynak bazlı** (`sources.category`) — Türk haber sitelerinin çoğu bölüm başına ayrı RSS feed'i verir. Karışık/genel bir feed varsa Claude ile sınıflandırma fallback olarak devreye girer.
- `subscribers` tek bir kalıcı `preferences_token` taşır (tercih güncelleme ve çıkış linklerinde kullanılır); ayrı bir doğrulama token'ı yok (bkz. Abonelik Akışı).
- `digest_sends`, worker yeniden başlasa bile aynı gün aynı kişiye iki kez dijest gitmesini önler (idempotency).

## Haber Toplama & İşleme Akışı

**RSS çekme (worker, her saat başı):**
- `sources` tablosundaki tüm aktif feed'ler taranır (`rss-parser`).
- Her feed öğesi `url` (guid) benzersizlik kontrolüyle veritabanına yazılır — daha önce görülmüş bir link tekrar işlenmez.
- Kategori `sources.category`'den miras alınır.
- Bir feed erişilemezse hata loglanır, o feed atlanır, diğerleri işlenmeye devam eder.

**Dedup + özetleme (fetch'in hemen ardından, yalnızca yeni makaleler için):**
- Yeni makale, aynı gün + aynı kategoride daha önce oluşturulmuş `story` başlıklarıyla token-bazlı benzerlik (Jaccard, eşik ~%50) ile karşılaştırılır.
- Eşleşme varsa makale mevcut `story`'ye bağlanır (yeni kaynak linki eklenir), yeni özet üretilmez.
- Eşleşme yoksa yeni `story` açılır; tek bir Claude API çağrısıyla 2-3 cümlelik Türkçe özet üretilir (kategori belirsizse aynı çağrıda sınıflandırma da yapılır).
- Claude çağrısı başarısız olursa: 3 deneme + exponential backoff; hâlâ başarısızsa makale özetsiz kalır, sonraki döngüde tekrar denenir.

## Abonelik ve E-posta Akışları

**Abonelik (sürtünmesiz, anlık aktif):**
1. Kullanıcı `apps/web` formunda e-posta + kategori(ler) seçer → `POST /api/subscribe`.
2. `subscribers` tablosunda **hemen `status=active`** ile kayıt oluşturulur (aynı e-posta zaten varsa tercihleri günceller, yeni satır açılmaz). Kalıcı `preferences_token` üretilir.
3. Basit bot koruması: gizli honeypot alanı + aynı IP'den kısa sürede çoklu kayıt limiti (rate limit).
4. Bir "hoş geldin" e-postası gönderilir. Bu e-posta **hard bounce** olursa (adres geçersiz), sağlayıcının webhook'u bunu bildirir ve sistem `status=unsubscribed` yapar — doğrulama kullanıcıya değil, sisteme ait bir otomatik temizlik adımıdır.

**Tercih güncelleme:**
- Her dijest/hoş geldin e-postasının altında kalıcı `preferences_token` ile imzalı bir link (`/preferences?token=...`).
- Sayfa mevcut kategori seçimlerini gösterir, kullanıcı değiştirip kaydeder.

**Tek tıkla çıkış:**
- Aynı e-postaların altında `/unsubscribe?token=...` linki — tıklanınca ekstra onay istemeden `status=unsubscribed` yapılır (RFC 8058 tek-tık standardına uygun; `List-Unsubscribe` header'ı da aynı token ile desteklenir).

**Günlük dijest gönderimi (worker, 08:45 Europe/Istanbul):**
1. `status=active` her abone için, o günün `digest_date`'ine ait, abonenin seçtiği kategorilerdeki `story`'ler çekilir.
2. Hiç yeni story yoksa o aboneye o gün e-posta gönderilmez (boş bülten yok).
3. Türkçe HTML e-posta şablonu render edilir: her story için AI özeti + kategori etiketi + kaynak link(ler)i.
4. Gönderim öncesi `digest_sends.status=pending`; başarılı olursa `sent`; hata olursa `failed` ve 09:00'a kadar 1 kez daha denenir.
5. `digest_sends` idempotency sağlar: worker yeniden başlarsa aynı gün tekrar gönderim yapılmaz.

## Hata Yönetimi (özet)

| Durum | Davranış |
|---|---|
| RSS kaynağı erişilemez | Logla, atla, sonraki saatlik döngüde tekrar dene |
| Claude API hatası (özetleme) | 3 deneme + backoff, sonra makale özetsiz kalır, sonraki döngüde tekrar denenir |
| E-posta gönderim hatası (API down/rate limit) | `digest_sends.status=failed`, 09:00'a kadar 1 kez daha denenir |
| Hard bounce (geçersiz adres) | Sağlayıcı webhook'u ile yakalanır → `status=unsubscribed` |
| Worker crash/restart | `digest_sends` idempotency sayesinde aynı gün tekrar gönderim yapılmaz |
| Aynı e-posta ile tekrar kayıt | Var olan kaydın tercihleri güncellenir, yeni satır açılmaz |

## Test Stratejisi

- **Birim testleri:** dedup benzerlik fonksiyonu, kategori miras/fallback mantığı, token üretim/doğrulama, e-posta şablonu render'ı.
- **Entegrasyon testleri:** `subscribe → (bounce simülasyonu) → preferences → unsubscribe` API akışı, test veritabanına karşı.
- **Worker dry-run modu:** Gerçek e-posta göndermeden, günlük dijest içeriğini konsola/dosyaya basan bir `--dry-run` bayrağı.
- **Manuel doğrulama:** Kendi e-postasına abone olup gerçek bir günlük dijest alarak uçtan uca kontrol.

## Uygulama Fazları (özet — detay implementation plan'da)

1. Veri modeli + `apps/web` abonelik/tercih/çıkış akışı
2. `apps/worker` RSS çekme + dedup + özetleme pipeline'ı
3. Günlük dijest oluşturma + gönderim
4. Docker Compose + VPS deployment (Caddy, Postgres, env config)
