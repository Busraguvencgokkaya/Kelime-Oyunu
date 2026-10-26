# Kelime Oyunu

Yabancılara Türkçe öğretimi için Wordwall benzeri kelime ve soru oyunları platformu.
Öğretmenler set hazırlar, ödev bağlantısı paylaşır; öğrenciler hesap açmadan oynar, sonuçlar öğretmenin panelinde toplanır.

- **Arayüz:** React + Vite, `docs/` klasörüne derlenir ve GitHub Pages'ten yayınlanır.
- **Veritabanı ve giriş:** Supabase (`supabase/kurulum.sql`).
- **Deneme modu:** Adresin sonuna `?demo` eklenirse veritabanı yerine tarayıcı belleği kullanılır.

## Kurulum

1. Supabase > SQL Editor > New query: `supabase/kurulum.sql` dosyasının tamamını yapıştırıp **Run**.
2. Supabase > Authentication > Sign In / Providers > Email: **Confirm email** kapatılabilir (ücretsiz plandaki e-posta sınırı nedeniyle önerilir).
3. Supabase > Authentication > URL Configuration: **Site URL** alanına GitHub Pages adresini yaz.
4. GitHub > Settings > Pages: Source **Deploy from a branch**, Branch **main**, klasör **/docs**.
5. Uygulamayı aç, ilk hesabı aç. İlk açılan hesap otomatik olarak yönetici olur.

## Geliştirme

```bash
npm install
npm run dev      # yerel sunucu
npm run build    # docs/ klasörünü günceller
```

## Yapı

| Klasör | İçerik |
| --- | --- |
| `src/api` | Supabase ve deneme modu veri katmanı (aynı arayüz) |
| `src/pages` | Öğretmen paneli sayfaları ve öğrenci ekranı (`Play.jsx`) |
| `src/games` | Oyun türleri: Test, Quiz Show |
| `src/lib` | Soru üretimi, içe aktarma, ses, yardımcılar |
| `supabase` | Veritabanı kurulum betiği |

## Excel içe aktarma

Toplu yükleme sütunları: `Kitap | Ünite | Konu | Türkçe | İngilizce | Kırgızca | Rusça`.
Set içine yükleme: `Türkçe | İngilizce | Kırgızca | Rusça | Konu` ya da soru setleri için `Soru | Doğru cevap | Yanlış 1 | Yanlış 2 | Yanlış 3`.
