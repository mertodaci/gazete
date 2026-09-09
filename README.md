# Gazete

Türkiye'ye yönelik, kişiselleştirilmiş ve tamamen otomatik çalışan yapay zekâ destekli haber bülteni.

## Özellikler

- Kullanıcılar web arayüzünden ilgilendikleri haber kategorilerini seçip e-posta ile ücretsiz abone olur.
- Sistem güvenilir RSS kaynaklarından haberleri otomatik toplar, tekrarları ayıklar, kategorilere ayırır.
- Yapay zekâ (Claude API) ile kısa Türkçe özetler üretir.
- Her abone, seçtiği kategorilere göre kişiselleştirilmiş bir bülteni her sabah 09:00'da (Europe/Istanbul) kaynak bağlantılarıyla birlikte e-posta olarak alır.
- Abonelik doğrulama (double opt-in), tercih güncelleme ve tek tıkla abonelikten çıkma desteklenir.

## Mimari

```
apps/web     — Next.js: abonelik formu, doğrulama, tercih güncelleme, çıkış sayfaları + API route'ları
apps/worker  — RSS çekme, özetleme/kategorilendirme, günlük dijest gönderimi (node-cron)
packages/db  — Paylaşılan Prisma şeması ve client
```

- **Veritabanı:** PostgreSQL
- **AI:** Claude API (özetleme, gerektiğinde kategorilendirme)
- **E-posta gönderimi:** Resend/Brevo (transactional e-posta servisi)
- **Altyapı:** VPS üzerinde uygulama servisleri için Docker Compose; TLS/reverse proxy ise VPS'te zaten çalışan host nginx + certbot (ayrı bir proxy konteyneri yok)

## Durum

Proje şu anda tasarım aşamasında. Detaylı spec `docs/superpowers/specs/` altında yayınlanacak.
