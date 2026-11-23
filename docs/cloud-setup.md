# Cloud decks (Supabase)

Dengan Supabase, deck tersimpan di akun masing-masing, bukan di browser. Tim WKND login dengan email kantor, bisa membuka deck dari laptop mana pun, dan bisa membagikan deck ke rekan.

## Arsitektur

```
Browser (editor, static export di Cloudflare)
   │  supabase-js + anon key
   ▼
Supabase
   ├─ Auth          login kode email, hanya domain yang diizinkan
   ├─ public.decks  satu baris per deck, isi JSON di kolom `presentation`
   ├─ deck_shares   rekan (per email) yang boleh membuka dan mengedit
   └─ Storage       bucket `deck-images` untuk foto slide
```

Tidak ada server sendiri. Browser langsung mengakses Supabase, dan hak akses dijaga oleh row level security (RLS) di database.

- **Simpan:** autosave mengirim deck setiap ada perubahan. Foto besar di-upload sekali ke Storage dan diganti URL-nya, jadi isi deck di database tetap kecil.
- **Bentrok:** setiap simpan membawa nomor revisi. Kalau rekan menyimpan deck yang sama lebih dulu, editor berhenti menyimpan dan meminta reload, supaya versi rekan tidak tertimpa diam-diam.
- **Share:** pemilik menambahkan email rekan lewat menu kartu → **Share**. Rekan tidak perlu login dulu; deck muncul di Library-nya setelah login.
- **Hapus:** pemilik menghapus deck untuk semua orang. Rekan hanya bisa **Remove** dari Library-nya sendiri.
- **Deck lama di browser:** Library menampilkan banner **Move to my account** untuk menyalin deck dari IndexedDB ke cloud. Salinan di browser tidak dihapus.

## Setup sekali (Supabase dashboard)

1. **Database.** Buka **SQL Editor**, tempel isi [supabase/migrations/20261123000000_cloud_decks.sql](../supabase/migrations/20261123000000_cloud_decks.sql), lalu **Run**. Script aman dijalankan ulang.
2. **Domain email.** Script mengizinkan `weekendinc.com`. Tambah domain lain di SQL Editor:
   ```sql
   insert into private.allowed_email_domains (domain) values ('domainlain.com');
   ```
3. **URL.** **Authentication → URL Configuration**:
   - Site URL: `https://deck-builder.xfrz-ai.workers.dev`
   - Redirect URLs: `https://deck-builder.xfrz-ai.workers.dev/**` dan `http://localhost:3000/**`
4. **Template email.** **Authentication → Emails → Templates**. Edit template **Magic Link** dan **Confirm signup** supaya memuat kode:
   ```html
   <h2>Masuk ke Deck</h2>
   <p>Kode masuk kamu: <strong>{{ .Token }}</strong></p>
   <p>Atau klik link ini: <a href="{{ .ConfirmationURL }}">Masuk ke Deck</a></p>
   ```
   User baru menerima **Confirm signup**, user lama menerima **Magic Link**.
5. **SMTP.** **Authentication → Emails → SMTP Settings**. Wajib untuk tim: pengirim bawaan Supabase hanya mengirim ke anggota tim project Supabase dan dibatasi beberapa email per jam. Pakai layanan seperti Resend, Postmark atau SMTP kantor. Setelah itu naikkan batas di **Authentication → Rate Limits** bila perlu.

## Konfigurasi app

`.env.local` (tidak di-commit):

```sh
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

Nilai ini publik (ikut ter-bundle ke browser). Keamanan data ada di RLS, bukan di kerahasiaan key. Karena di-inline saat build, `npm run deploy` harus dijalankan dari mesin yang punya `.env.local`.

Tanpa kedua variabel itu, atau dengan `NEXT_PUBLIC_DECK_STORAGE=browser`, app kembali ke mode lama: tanpa login, deck di IndexedDB. Mode ini dipakai untuk development deck agent lokal dan test e2e:

```sh
NEXT_PUBLIC_DECK_STORAGE=browser npm run dev
NEXT_PUBLIC_DECK_STORAGE=browser npm run build && npm run test:deck-agent:e2e
```

## Batasan saat ini

- Satu peran share: **edit**. Belum ada akses lihat-saja.
- Belum ada edit bersamaan secara real-time. Dua orang yang mengedit deck yang sama di waktu bersamaan: yang menyimpan belakangan diminta reload.
- Foto di bucket publik dengan nama acak (hash SHA-256 isi file). Siapa pun yang memegang URL-nya bisa membuka foto itu.
- Foto yang tidak dipakai lagi belum dihapus otomatis dari Storage.
- Deck agent (MCP) masih lokal. Versi cloud adalah fase berikutnya.
