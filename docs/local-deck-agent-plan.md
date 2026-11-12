# Rencana MVP AI Deck Agent Lokal

Status: Milestone 1-5 diimplementasikan dan alur MVP end-to-end sudah diverifikasi. Kelanjutan Live A-C juga sudah diimplementasikan: prompt CLI membuat kartu Library, lalu pengguna mengklik untuk mengikuti pembuatan slide. Lihat [plan Live Canvas](live-canvas-agent-plan.md). Bagian milestone di bawah mencatat urutan MVP awal; real-time yang kemudian diizinkan dijelaskan pada plan Live.

## Tujuan dan batas lingkup

Percakapan Codex CLI menghasilkan dan merevisi deck melalui fungsi builder, tanpa perubahan source code untuk setiap deck.

```text
Codex CLI -> MCP stdio -> DeckService -> Deck Builder
                              |
                        repository JSON
                              |
                  API loopback terautentikasi
                              |
                      editor dan preview
```

- Gunakan `buildDeckFromSpec()`, registry, generator komponen, renderer, dan brand WKND yang tersedia.
- Batasi agen pada 31 layout DeckSpec dan maksimal 60 slide; layout lain menghasilkan error jelas.
- Penyimpanan, service, editor, dan preview lokal. Inferensi Codex tidak otomatis offline.
- Tidak ada Telegram, deploy, renderer baru, atau perubahan design system.
- Bridge Claude dan deck localStorage lama tetap tersedia.
- MVP awal memakai save eksplisit dan reload manual. Kelanjutan Live kini memakai SSE dengan perlindungan draft; Save edit manual tetap eksplisit.
- Validasi teks Node diberi status `estimated`; validasi font asli otomatis ditunda.

## Persiapan

| Persiapan | Status/tanggung jawab |
|---|---|
| Node/npm | Saat audit: Node 22.23.3, npm 10.9.9 tersedia. |
| Codex CLI | Executable tersedia; uji login/model saat verifikasi nyata. |
| Backup deck browser | Nilai utuh `presentation-editor-storage`, termasuk gambar inline, disalin sebelum membuka deck lokal bila tersedia. |
| Brief uji | Tujuan, audiens, bahasa, 8-10 slide; fakta yang belum diketahui memakai placeholder. Contoh proposal repo cukup untuk uji teknis. |
| Browser | Lebar editor minimal 1280 px. |
| Dependensi | MCP SDK, schema validator, runtime TypeScript dipasang saat implementasi. |
| Data lokal | `.deck-builder/` diabaikan Git; file dan token dengan akses lokal terbatas. |

Font saat ini memakai `next/font/google`. Build offline memerlukan cache atau file lokal font yang sama. Jalur agen hanya menerima aset lokal/data URL. Service MCP tidak memerlukan API key model tersendiri.

## Milestone 1: baseline, backup, schema

1. Catat lint/build sebelum perubahan dan masalah yang sudah ada.
2. Baca dokumentasi Next.js terpasang sebelum mengubah route/komponen.
3. Isolasi pengujian dari profil browser dan data pengguna.
4. Sediakan backup nilai localStorage lengkap melalui service sebelum deck lokal dibuka.
5. Dokumen menyimpan `storageVersion`, `revision`, `presentation`, default theme/footer, spec asal per slide, dan hash untuk mendeteksi edit manual.

Selesai: baseline tercatat, schema tersedia, backup dapat dibuat tanpa mengganti key lama. Backup browser nyata baru dapat diambil ketika browser pengguna terhubung.

## Milestone 2: DeckService dan repository JSON

- Create/get/add/update melalui builder yang ada.
- Build satu slide memakai `buildDeckFromSpec()` dengan array satu slide; jangan menduplikasi logika desain.
- Pertahankan ID deck/slide target; jangan membangun ulang slide lain.
- Tulis JSON atomik: file sementara, flush, rename. Service menjadi penulis tunggal.
- Revision wajib pada mutasi; `requestId` mencegah duplikasi retry.
- Tolak seluruh commit jika ada error builder, termasuk hasil parsial yang lolos schema.
- Periksa batas total 60 slide pada create/add/save editor.
- Patch berdasarkan spec kedaluwarsa akibat edit manual ditolak. Penggantian eksplisit memerlukan spec lengkap.

Selesai: operasi service lolos pengujian dan dapat dibaca setelah restart; konflik/operasi invalid tidak mengubah file. Pemeriksaan teks masih perkiraan Node dan ditandai `validation: "estimated"`.

## Milestone 3: tujuh tool MCP stdio

| Tool | Hasil MVP |
|---|---|
| `list_layouts` | 31 layout, field, batas, contoh. |
| `get_brand_styles` | Theme, palette, font, grid, referensi aset yang ada. |
| `create_deck` | Deck tersimpan, ID/revision, URL editor. |
| `get_deck` | Snapshot terkini, spec asal, status edit manual. |
| `add_slide` | Slide baru pada posisi yang diminta; maksimal total 60. |
| `update_slide` | Patch konten atau penggantian spec target, revision wajib. |
| `preview_deck` | URL preview memakai renderer lama, status validasi perkiraan. Screenshot ditunda. |

Input agen hanya konten/layout/theme. Field patch yang tidak dikirim dipertahankan; array diganti utuh. Error memiliki code/path/message. Stdout khusus MCP, log ke stderr.

Selesai: client MCP menemukan tujuh tool; Codex CLI dapat create/update tanpa menulis source code.

## Milestone 4: editor minimal dan save aman

- URL berisi `deckId`; load dan Save melalui API loopback.
- API bind `127.0.0.1`, memeriksa Host/Origin dan token lokal. Token tidak dimasukkan ke query atau log.
- Store deck lokal tidak menghidrasi atau menulis key localStorage editor lama.
- Save mengirim snapshot dan `expectedRevision`.
- Konflik mempertahankan draft/file server; sediakan unduhan draft untuk pemulihan.
- Peringatkan sebelum meninggalkan draft belum disimpan.
- Reload manual untuk melihat revisi MCP; tanpa SSE/WebSocket/polling/merge otomatis.
- Undo/redo yang sudah ada tetap bekerja dalam sesi; history metadata lintas revisi ditunda.
- Normalisasi sebelum hashing sama pada service/editor agar load tidak salah dianggap edit manual.
- Preview noninteraktif memakai `ClientSlideRenderer` yang tersedia.

Selesai: deck dapat dibuka, diedit, disimpan, dibuka ulang; konflik aman dan localStorage lama tetap utuh.

## Milestone 5: uji nyata end-to-end

1. Chat Codex membaca katalog/brand dan membuat deck melalui MCP.
2. Buka URL editor, edit satu slide dan Save.
3. Ambil revision terbaru, revisi melalui MCP, buka ulang dan cek hasil.
4. Pastikan ID stabil dan slide lain tetap sama.
5. Uji revision lama, dua save bersamaan, retry, restart, autentikasi, backup, isolasi localStorage.
6. Uji layout tak didukung, item invalid, lebih dari 60 slide, dan error builder tanpa commit parsial.
7. Jalankan lint/typecheck/build; dokumentasikan startup dan keterbatasan.

Pengujian browser MVP boleh memakai tooling uji terpisah; ini tidak menambahkan fitur browser validation otomatis atau screenshot produk.

Selesai: chat -> MCP -> file -> editor -> save -> update -> buka ulang berhasil. Jika login/model menghalangi chat nyata, laporkan terpisah dari uji client MCP, jangan mengklaim chat nyata lolos.

## Milestone 6: kelanjutan setelah MVP

- Browser validation otomatis dengan font asli sebelum commit.
- Screenshot Playwright dan pemeriksaan visual otomatis.
- Live update dan alur Library bertahap telah dikerjakan sesuai permintaan lanjutan; merge draft lintas sesi tetap ditunda.
- Undo/redo metadata serta transaksi lintas revision.
- Round-trip semua edit canvas ke DeckSpec.

## Peta file

| Area | Perubahan |
|---|---|
| `lib/deck-service/` | Schema, service builder, repository, HTTP dan autentikasi. |
| `scripts/deck-service.ts` | Entry service loopback. |
| `scripts/deck-mcp.ts` | Entry MCP stdio. |
| `lib/local-deck/`, komponen editor lokal | Client HTTP, load/save, draft, preview. |
| `store/editor-store.tsx`, `app/editor/page.tsx` | Store terisolasi dan pemilihan mode. |
| `app/preview/page.tsx` | Preview dengan renderer yang ada. |
| `package.json`, lockfile, `.gitignore` | Dependensi/script dan pengecualian data. |
| `.codex/config.toml.example`, README | Konfigurasi dan petunjuk penggunaan. |
| `tests/` | Service, repository, MCP, autentikasi, alur editor. |

## Hasil verifikasi MVP (11 November 2026)

- Baseline build berhasil. Baseline lint memiliki dua error lama di `canvas-workspace.tsx` dan `panels/table-properties.tsx`, serta satu warning lama di generator timeline; file tersebut tidak diubah untuk memperbaiki lint di milestone ini.
- Delapan pengujian service/MCP berhasil, termasuk 31 contoh katalog, round-trip normalisasi editor, revision/idempotensi, save bersamaan, kegagalan tulis, batas slide, autentikasi, dan isolasi localStorage.
- Build dan typecheck berhasil; lint seluruh file implementasi/pengujian yang disentuh berhasil.
- Uji MCP + Chrome berhasil pada viewport minimum 1280 px: create 10 slide, edit/save browser, revisi satu slide, konflik save lama, reload, dan preview.
- Uji Codex CLI nyata + MCP + Chrome juga berhasil: Codex melakukan create dan update melalui tools; dokumen mencapai revision 1, 2, dan 3 tanpa perubahan source code per deck.
- Pengujian memakai folder data dan profil Chrome sementara. LocalStorage uji tidak berubah dan backup cocok persis. Backup deck pengguna nyata akan dibuat saat pengguna membuka URL deck lokal pada browser/origin yang menyimpan deck lamanya.
- Perlindungan retry juga mencakup respons Save yang hilang ketika revision lebih baru sudah tersedia; draft lama tidak boleh dianggap terkini hanya karena receipt lama ditemukan.
- Kelanjutan Live/Library: total 27 pengujian lulus. E2E client MCP dan Codex CLI nyata berhasil membuat kartu saat pekerjaan aktif, klik Library, 10 slide bertahap, Follow AI/highlight dan status selesai tanpa mengubah IndexedDB/localStorage lama. Kartu CLI kini juga memiliki Delete; pengujian Cancel/Delete/reload dan penolakan Save/retry setelah penghapusan lulus. Alur Save/conflict/restart lama tetap lulus. Rincian pada plan Live.

Petunjuk startup dan pemulihan konflik: [Menggunakan AI Deck Agent lokal](local-deck-agent.md).

## Referensi

- [README](../README.md)
- [Panduan agen](agent-guide/README.md)
- [DeckSpec](deck-spec/README.md)
- [Contoh proposal](deck-spec/example-proposal.json)
- [Dokumentasi resmi MCP untuk Codex](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
