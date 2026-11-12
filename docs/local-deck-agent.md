# Menggunakan AI Deck Agent lokal (MVP)

## Menjalankan

Dari direktori proyek, jalankan di terminal terpisah:

```sh
# Terminal 1: service dokumen lokal
npm run deck-service

# Terminal 2: editor (bila belum berjalan)
npm run dev

# Terminal 3: pilih salah satu agen
npm run deck-agent          # Codex CLI
npm run deck-agent:claude   # Claude Code CLI
```

Kedua launcher membuka Library di browser dan menjalankan agennya dengan konfigurasi MCP untuk sesi itu. Konfigurasi global Codex/Claude tidak diubah. CLI yang dipilih harus sudah terpasang dan login. Argumen tambahan diteruskan ke CLI tersebut, misalnya `npm run deck-agent:claude -- --model opus`. Alternatif konfigurasi permanen Codex tersedia di `.codex/config.toml.example`.

Launcher Claude mengizinkan semua tool `deck_builder` tanpa prompt izin per pemanggilan dan menambahkan instruksi agar Claude bekerja sebagai agen deck, bukan mengedit source code.

### Claude Desktop

Sekali saja:

```sh
npm run deck-agent:desktop-config -- --write
```

Script menyalin config Claude Desktop ke `claude_desktop_config.json.bak-<waktu>` lalu menambahkan server `deck_builder` tanpa mengubah pengaturan lain. Tanpa `--write`, script hanya mencetak potongan config. Quit lalu buka ulang Claude Desktop. Jalankan ulang script bila folder proyek dipindah.

`npm run deck-service` dan `npm run dev` tetap harus berjalan. Desktop tidak membuka Library otomatis: klik link Library yang diberikan agen setelah cover tersimpan.

### Create with AI (chat di Library)

Tanpa CLI, deck juga bisa dibuat dari tombol **Create with AI** di home:

```sh
npm run deck-service   # Terminal 1
npm run dev            # Terminal 2
npm run ai-bridge      # Terminal 3
```

Panel chat menjalankan Claude Code headless lewat AI bridge, dengan **hanya** tool `deck_builder` (tanpa akses file, shell, atau web) dan playbook yang sama dengan agen CLI. Library otomatis terhubung ke deck-service saat panel dibuka. Begitu cover tersimpan, kartu deck muncul dan chat menampilkan tombol **Open deck**. Proses build tetap berjalan meski kamu pindah ke editor. Saat kembali ke home, percakapan dimuat ulang dari bridge. Chat tersimpan di memori bridge dan hilang kalau bridge di-restart. Set `AI_BRIDGE_MODEL` untuk memilih model.

### Alur kerja: playbook

Semua agen membaca [playbook deck](agent-guide/playbook.md) melalui tool `get_deck_playbook`:

1. **Brief**: agen hanya menanyakan yang belum diketahui (maksimal 5 pertanyaan).
2. **Storyline**: daftar slide berisi pesan utama + layout. Ini satu-satunya titik persetujuan.
3. **Copy + build**: setelah disetujui, agen menulis copy dan membangun deck secara live tanpa bertanya lagi.
4. **Revisi** per slide.

Playbook juga memuat aturan storytelling dan tone copywriting WKND (sementara). Edit file tersebut untuk mengubah perilaku semua agen. File dibaca ulang setiap pemanggilan, jadi tidak perlu restart.

Cara memulai:

- **Claude Code CLI:** ketik `/deck` diikuti brief, misalnya `/deck pitch redesign aplikasi untuk [Nama Klien], 10 slide`.
- **Claude Desktop:** di mode **Chat**, cukup tulis brief, misalnya "Bantu buat deck …". Server lokal tidak tercantum di **Settings → Connectors** (halaman itu hanya menampilkan connector Web). Untuk mengecek koneksi, tanyakan "Tools deck_builder apa saja yang tersedia?". Status server juga tercatat di `~/Library/Logs/Claude/mcp-server-deck_builder.log`.
- **Codex:** tulis brief biasa; instruksi server MCP mengarahkan Codex ke playbook. Contoh prompt lengkap:

```text
Gunakan tools deck_builder untuk presentasi ini; jangan mengedit source code.
Bantu susun proposal [Nama Klien] dalam bahasa Indonesia, sekitar 10 slide.
```

Buka Library di `http://localhost:3000`. Pastikan banner **CLI agent connected** tampil. Setelah cover berhasil tersimpan, kartu presentasi muncul otomatis dengan status **AI sedang mengerjakan** dan jumlah slide tersimpan. Klik kartu tersebut untuk melihat slide bertambah langsung di editor. Tidak perlu menyalin deck ID ke URL.

**Follow AI** menyala saat masuk dari Library: slide target terbuka dan mendapat highlight singkat ketika commit baru diterapkan. Memilih slide lain mematikan Follow AI; centang lagi untuk mengikuti perubahan berikutnya. **Jeda tampilan** menahan pembaruan pada canvas sementara agen tetap bekerja dan menyimpan file. **Aktivitas AI** menampilkan aksi nyata dari service. Pembaruan yang datang sangat cepat dapat dirangkum menjadi snapshot terbaru.

Status **Selesai** muncul setelah `finish_deck`, bukan berdasarkan timer. Jika rencana belum terpenuhi, agen harus melanjutkan atau menutup sebagai **Selesai sebagian**. Restart service atau tidak ada commit selama 10 menit menandai pekerjaan sebagai **Terhenti - dapat dilanjutkan**. Minta agen mengambil deck terbaru lalu `start_deck_run` untuk melanjutkan.

Deck dapat diedit memakai editor yang sudah ada. Tekan **Save** untuk menyimpan edit manual ke file. **Draft** mengunduh snapshot editor sebagai JSON untuk pemulihan. Deck browser lama tetap tersimpan terpisah di IndexedDB; kartu CLI hanya ditampilkan bersama dalam Library.

Jika browser belum terhubung, jalankan ulang `npm run deck-agent` (atau `deck-agent:claude`) atau buka `libraryUrl` dari hasil tool. Tab Library lain pada origin yang sama menerima koneksi melalui BroadcastChannel. Token disimpan di sessionStorage, bukan IndexedDB/localStorage. Mengunjungi localhost saja pada browser baru belum memberikan akses service.

## Menghapus presentasi

Deck hasil CLI dapat dihapus dari menu **⋯ → Delete** pada kartu Library, memakai dialog konfirmasi yang sama dengan deck browser. Penghapusan berlaku pada service lokal dan seluruh tab Library yang terhubung. Jika deck berubah sejak dialog dibuka, penghapusan ditolak; periksa versi terbaru lalu ulangi.

Isi deck dihapus melalui penyimpanan atomik. File JSON menyisakan penanda kecil tanpa slide/konten/kredensial untuk mencegah retry create dari agen memunculkannya kembali. Save atau mutasi ke ID yang sudah dihapus menghasilkan `DECK_DELETED`. Tab editor yang masih terbuka menampilkan status dihapus dan menonaktifkan Save; **Draft** tetap tersedia untuk mengunduh salinan tab tersebut. Data deck browser lain tidak terpengaruh.

Untuk revisi dari Codex, minta agen mengambil `get_deck` terkini sebelum memanggil `update_slide`. Editor deck service sekarang menerima live update tanpa reload ketika draft bersih dan tidak sedang ada input/gesture aktif. Perubahan yang belum disimpan memunculkan peringatan saat meninggalkan halaman.

## Live update dan perlindungan draft

Restart `npm run deck-service` setelah memperbarui kode service. Tunggu status **Live connected** di dekat tombol Save. Beri instruksi revisi di CLI; hasil commit muncul pada canvas dan sidebar tanpa membuka ulang halaman. `editorUrl` dari MCP juga tetap dapat dipakai sebagai tautan langsung.

Draft manual, text editor/form aktif, dan gesture canvas menahan penerapan snapshot remote. Jika versi baru tersedia, editor menampilkan revision server. Amankan draft dengan **Draft**, lalu pilih **Discard draft & load** jika memang ingin menggantinya dengan versi server. Koneksi terputus akan mencoba tersambung kembali dan membaca snapshot terkini.

Penerapan versi remote mempertahankan slide aktif yang masih ada serta zoom, membersihkan referensi selection yang sudah diganti, dan menghapus undo/redo dari basis lama. Editor memberi pemberitahuan ketika history tersebut direset. Draft tidak digabung otomatis dan expectedRevision tidak dinaikkan diam-diam.

Animasi menandai hasil builder yang benar-benar tersimpan: slide baru, perpindahan fokus, dan highlight. Kursor AI yang menyeret elemen bebas belum tersedia.

## Data dan backup

- `.deck-builder/decks/<deckId>.json`: dokumen dengan revision, Presentation, spec asal, receipt request, dan metadata pekerjaan agen. Status dan slide disimpan dalam commit atomik yang sama. Deck yang dihapus diganti penanda penghapusan tanpa konten dan tidak masuk daftar Library.
- `.deck-builder/backups/<hash>.json`: nilai localStorage lama yang disalin utuh ke field `raw`.
- `.deck-builder/connection.json`: alamat service dan token rahasia lokal.
- `.deck-builder/writer.lock`: PID penulis tunggal.

Folder data diabaikan Git. Simpan salinannya jika membutuhkan backup di lokasi lain.

Membuka editor/preview deck lokal menyalin nilai key `presentation-editor-storage` ke backup sebelum memuat deck, jika key tersebut tersedia pada origin browser itu. Nilai aslinya tidak diganti. Deck Library browser menggunakan `/editor?presentation=...`; deck service memakai `/editor?deckId=...`. Backup pengguna nyata baru dibuat setelah URL dibuka di browser/profil dan origin yang menyimpan deck lama; pengujian otomatis memakai profil terpisah.

Backup dapat dipulihkan dengan membaca field `raw` dari file backup lalu memasang string itu ke key yang sama melalui DevTools pada origin editor, sebelum reload. Pertahankan file backup asli selama pemulihan.

## Keamanan lokal

Service hanya bind ke `127.0.0.1`. Semua endpoint data membutuhkan bearer token. Host dan Origin diperiksa; origin editor harus cocok dengan `DECK_APP_URL`.

URL Library/editor/preview membawa token di fragment (`#...`), bukan query. Browser memindahkannya ke sessionStorage lalu membersihkan fragment. URL tersebut memberikan akses service lokal: jangan membagikannya atau file `connection.json`. Token tidak dicetak oleh service. Metadata Library dan snapshot browser tidak mengandung kredensial pemilik pekerjaan agen.

Token yang valid dipertahankan saat restart service. Untuk rotasi, hentikan service, hapus `connection.json`, lalu jalankan kembali; gunakan URL baru dari MCP. Jika proses terhenti paksa dan lock tertinggal, periksa bahwa PID dalam `writer.lock` sudah mati sebelum menghapus lock. Jangan menjalankan dua penulis untuk direktori yang sama.

## Konfigurasi opsional

| Variabel | Default | Fungsi |
|---|---|---|
| `DECK_DATA_DIR` | `.deck-builder` relatif cwd service | Direktori dokumen/token. Gunakan nilai absolut yang sama untuk service dan launcher Codex jika disesuaikan. |
| `DECK_SERVICE_PORT` | `8790` | Port loopback. |
| `DECK_APP_URL` | `http://localhost:3000` | Origin editor yang diizinkan dan dipakai pada URL hasil tool. |
| `DECK_AGENT_OPEN_LIBRARY` | aktif | Set `0` agar launcher tidak membuka tab Library otomatis. |

Contoh bila editor berjalan pada port lain:

```sh
DECK_APP_URL=http://localhost:3001 npm run deck-service
```

Service terpisah dari Next.js dan bridge Claude pada port 8787. Tidak memerlukan deploy atau perubahan mode static export.

## Tools dan aturan revisi

| Tool | Input |
|---|---|
| `list_layouts` | `category?`, `layoutId?`; gunakan filter untuk mengurangi ukuran respons. |
| `get_brand_styles` | `{}` |
| `create_deck` | `spec`, `requestId`, `live?`, `plannedSlides?`; mode live dimulai dengan tepat satu slide. |
| `get_deck` | `deckId`, `slideId?`, `includeElements?` |
| `add_slide` | `deckId`, `expectedRevision`, `requestId`, `slideSpec`, `afterSlideId?`; pekerjaan aktif memerlukan `runId` + `ownerToken`. |
| `update_slide` | `deckId`, `slideId`, `expectedRevision`, `requestId`, salah satu `contentPatch` atau `slideSpec`, dan `replaceManual?`; pekerjaan aktif memerlukan `runId` + `ownerToken`. |
| `preview_deck` | `deckId`, `revision?`; URL manual, belum ada screenshot. |
| `start_deck_run` | `deckId`, `expectedRevision`, `requestId`, `plannedSlides?`; mulai revisi bertahap atau lanjutkan pekerjaan terhenti. |
| `get_deck_playbook` | `{}`; alur kerja, aturan storytelling dan tone copy. Juga tersedia sebagai prompt MCP `plan_deck` (`brief?`). |
| `finish_deck` | `deckId`, `expectedRevision`, `requestId`, `runId`, `ownerToken`, `status` (`completed`, `partial`, `failed`), `summary?`. |

Tujuh tool MVP dipertahankan dengan dua tool siklus pekerjaan. `create_deck(live:true)` dan `start_deck_run` mengembalikan `agentWork.id` serta `ownerToken`. Agen harus membawa keduanya pada mutasi pekerjaan tersebut; `runId` sendiri bukan autentikasi. Pemilik aktif tidak dapat diambil alih oleh agen lain. Setelah restart/idle, resume harus eksplisit dan memakai revision terbaru. Untuk revisi satu slide pada deck tanpa pekerjaan aktif, tujuh tool lama tetap kompatibel.

`contentPatch` mempertahankan field yang tidak dikirim; array yang dikirim mengganti array tersebut utuh. ID slide target dipertahankan, elemen slide target dibangun ulang. ID dan isi slide lain tidak diubah.

Gunakan requestId unik untuk setiap operasi. Untuk retry request yang sama, pakai requestId dan payload yang sama, termasuk expectedRevision. Receipt tersimpan di disk. Retry tidak membuat commit kedua; bila ada revision lebih baru setelah request itu berhasil, `REQUEST_ALREADY_APPLIED` meminta rekonsiliasi agar draft lama tidak dianggap terkini. Payload berbeda dengan requestId yang sama ditolak.

Jika browser dan Codex menyimpan bersamaan, `REVISION_CONFLICT` menolak penimpaan. Draft browser tetap terbuka: unduh dengan **Draft**, baca versi terbaru, lalu rekonsiliasi. Jangan sekadar mengganti nomor revision dan menimpa snapshot lama.

Edit manual pada slide dapat membuat spec asal kedaluwarsa. `SLIDE_SOURCE_STALE` menolak patch berbasis spec lama. Untuk membangun ulang slide itu secara sengaja, kirim spec lengkap dan `replaceManual: true`; isi manual slide target akan diganti. Tidak ada konversi otomatis semua edit canvas ke DeckSpec.

## Batas MVP

- 31 layout DeckSpec, maksimum 60 slide; layout lain menghasilkan `UNSUPPORTED_LAYOUT`.
- Semua mutasi menolak error builder; tidak menyimpan hasil parsial.
- Pemeriksaan teks menggunakan estimasi Node (`validation: "estimated"`). Review preview manual; kecocokan font asli otomatis belum tersedia.
- Gambar memakai `/assets/...` atau data URL raster. Gambar eksternal ditolak pada service. Link website sebagai teks tetap dapat digunakan.
- Save manual dengan live update untuk editor deck service. Preview tetap snapshot saat halaman dibuka. History lintas revision belum digabung; undo/redo lokal dibersihkan setelah penerapan snapshot remote agar versi lama tidak tersimpan kembali lewat Undo.
- Snapshot draft yang diunduh merupakan Presentation, bukan DeckSpec. Gunakan sebagai cadangan/pemulihan; jangan mengimpornya melalui dialog DeckSpec.
- Service/repository/rendering lokal tidak berarti inferensi Codex offline.

## Verifikasi

```sh
npm run test:deck-agent
npm run build
npm run test:deck-agent:e2e
# Alur prompt -> kartu Library -> klik -> slide bertambah -> selesai:
npm run test:deck-agent:e2e -- --library
# Tambahkan pengujian percakapan/model Codex nyata (memakai akun yang sedang login):
npm run test:deck-agent:e2e -- --library --codex
```

E2E menjalankan service/data sementara, menyajikan build `out`, dan memakai profil Chrome baru. Browser pengguna serta data deck asli tidak disentuh. `CHROME_PATH` dapat disetel jika executable Chrome berada di lokasi lain. Tidak ada dependensi atau fitur screenshot Playwright yang ditambahkan.
