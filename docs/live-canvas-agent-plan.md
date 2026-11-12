# Live Agent dari CLI ke Library dan Canvas

Status: tahap A, B, dan C sudah diimplementasikan. Tahap D (kursor AI dan detail elemen) tetap ditunda. Alur utama mengikuti keputusan terbaru: prompt dari CLI membuat presentasi baru di Library, lalu pengguna mengklik kartu untuk melihat prosesnya. Tidak perlu membuat canvas/session terlebih dahulu atau memasukkan ID secara manual.

## 1. Alur pengguna

1. Jalankan editor dan DeckService, kemudian `npm run deck-agent`.
2. Launcher membuka Library dengan koneksi lokal terautentikasi. Tab Library yang sudah terbuka pada origin yang sama menerima koneksinya.
3. Beri prompt pembuatan presentasi di Codex CLI; agen membaca katalog layout dan brand.
4. `create_deck(live:true)` membangun satu cover dan menyimpan deck serta pekerjaan aktif dalam satu commit atomik.
5. Kartu baru langsung muncul di Library dengan status **AI sedang mengerjakan** dan jumlah slide yang sudah tersimpan.
6. Klik kartu. Editor membuka `deckId` dengan **Follow AI** aktif; slide berikutnya muncul setelah masing-masing commit builder.
7. Canvas mengikuti slide target dan memberi highlight singkat. Aktivitas berasal dari event service yang nyata.
8. Agen memanggil `finish_deck`. Library/editor menampilkan selesai, selesai sebagian, atau gagal sesuai hasil.

Pekerjaan tidak menunggu pengguna membuka kartu dan tidak diberi jeda buatan. Jika dibuka setelah selesai, editor menampilkan hasil akhir. Tidak ada replay buatan yang menampilkan deck selesai seolah masih sedang dibuat.

## 2. Arsitektur yang dipertahankan

```text
Codex CLI -> MCP stdio -> DeckService -> buildDeckFromSpec()
                              |                 |
                        repository JSON    registry/theme lama
                              |
                API loopback + event SSE terautentikasi
                         /                  \
              Library metadata          session editor
                                           |
                                    renderer yang ada
```

- Gunakan builder, 31 layout DeckSpec, komponen, renderer Konva, brand/style yang tersedia; maksimal 60 slide.
- API tetap service Node terpisah dari Next.js static export. Tidak menambahkan route server Next.
- Library menggabungkan tampilan deck IndexedDB dan deck service; penyimpanannya tetap terpisah. Deck service tidak disalin ke IndexedDB atau key localStorage lama.
- `?presentation=...` tetap untuk deck browser. `?deckId=...&follow=1` untuk deck service yang dibuka dari Library.
- Tidak ada deploy, Telegram, renderer baru, atau perubahan design system.

## 3. Milestone yang sudah dikerjakan

| Tahap | Hasil |
|---|---|
| A: live update aman | SSE, reconnect, revision, Save/draft, perlindungan input/gesture/dialog. |
| B: pekerjaan bertahap dan Library | Daftar deck service, kartu live, cover lazy, create cover lalu add per slide, kepemilikan run, finish/resume. |
| C: melihat proses | Follow AI, jeda tampilan, highlight canvas, aktivitas nyata, status dan jumlah slide tersimpan. |
| D: ditunda | Kursor bergerak, highlight elemen presisi, pemetaan field ke elemen. |

MVP dasar sudah selesai sebelum pengembangan live. Rencana lama berupa session menunggu sebelum deck ada diganti dengan kartu Library setelah cover tersimpan; deck kosong tidak dibutuhkan.

## 4. Kontrak dokumen dan pekerjaan

Dokumen JSON menambahkan `createdAt` dan metadata opsional `agentWork`, sehingga dokumen lama tetap terbaca. Metadata berisi ID run, status, rencana jumlah slide, waktu aksi terakhir, ringkasan opsional, slide terakhir, hash pemilik, dan instance service. Informasi pemilik/instance tidak masuk snapshot publik.

- Status: `working`, `completed`, `partial`, `failed`, `interrupted`.
- `create_deck` dengan `live:true` wajib tepat satu slide; `plannedSlides` berada pada rentang 1-60.
- `add_slide` dan `update_slide` pada pekerjaan aktif wajib membawa `runId` serta `ownerToken` dari create/start.
- `finish_deck` memakai revision terbaru dan kredensial pemilik. `completed` ditolak jika jumlah slide belum sama dengan rencana; gunakan `partial` jika pekerjaan memang belum lengkap.
- `start_deck_run` memulai pekerjaan baru pada deck yang ada atau melanjutkan yang terhenti. Pemilik aktif tidak dapat diganti.
- Restart service atau idle tanpa commit selama 10 menit menghasilkan status publik `interrupted`; tidak pernah otomatis mengaku selesai. Resume eksplisit mengganti kepemilikan.
- Status dan perubahan slide masuk commit atomik dokumen yang sama. Kegagalan tulis tidak menghasilkan status sukses/event commit.
- Revision, receipt requestId, batas builder, dan perlindungan spec yang kedaluwarsa tetap berlaku. Save manual boleh dilakukan, tetapi konflik revision tetap ditolak.

Tujuh tool awal tetap ada. Dua tool tambahan: `start_deck_run` dan `finish_deck`. Kredensial agen tidak diambil dari runId saja, tidak dimuat oleh Library, dan tidak disimpan di IndexedDB.

## 5. Library, koneksi dan autentikasi

- `GET /decks`: metadata ringkas, tanpa elemen/gambar; file bermasalah tidak menyembunyikan deck lain.
- `GET /decks/:id/cover`: slide cover dimuat saat kartu terlihat, lalu dirender memakai renderer thumbnail yang tersedia.
- `GET /events`: stream metadata Library; commit memicu penyegaran daftar sehingga kartu baru/status muncul otomatis.
- `GET /decks/:id/events`: stream khusus editor deck, dengan sequence/replay terbatas dan resync snapshot setelah reconnect.
- Semua endpoint data/event memakai bearer token, pemeriksaan Host/Origin, dan bind `127.0.0.1`.
- Launcher membuka Library lewat URL fragment rahasia yang segera dibersihkan browser. Koneksi berada di sessionStorage; BroadcastChannel membagikannya hanya antartab pada origin yang sama. Token tidak ada di query, log, atau penyimpanan deck browser.
- `DECK_AGENT_OPEN_LIBRARY=0` mematikan pembukaan tab otomatis. Alternatifnya buka `libraryUrl` dari hasil tool. Localhost pada profil baru tetap perlu pairing ini.

Tidak ada bootstrap endpoint tanpa autentikasi. MCP tetap stdio; SSE hanya mengirim metadata, bukan token, prompt lengkap, atau seluruh gambar.

## 6. Canvas dan kendali pengguna

Follow AI memilih slide yang benar-benar berubah setelah snapshot diterapkan. Saat pengguna memilih slide lain, Follow AI dimatikan agar navigasinya dihormati. Mematikannya tidak menghentikan pembaruan data yang aman. Jeda tampilan menahan penerapan snapshot, sedangkan agen dan penyimpanan tetap berjalan.

Draft, input aktif, dialog, dan gesture drag/resize menahan snapshot remote. Versi server ditampilkan sebagai pending; Save yang konflik tidak mengubah expectedRevision draft secara diam-diam. Pengguna dapat mengunduh Draft dan memilih Discard draft & load secara eksplisit.

Highlight adalah overlay view sementara, tidak menangkap pointer, tidak mengubah koordinat/style dokumen, dan tidak ikut ekspor. Animasi pulse mengikuti reduced motion. Status teks dan aktivitas berasal dari aksi nyata. Commit cepat dapat digabung menjadi snapshot terbaru, bukan diputar sebagai proses palsu.

Penerapan konten remote membersihkan history undo/redo dari basis lama dan memberi pemberitahuan. Perubahan metadata pekerjaan saja (misalnya finish) tidak mereset canvas/history. Tidak ada merge draft atau history lintas revision otomatis.

## 7. Peta implementasi

| File/area | Peran |
|---|---|
| `lib/deck-service/work-types.ts`, `schemas.ts`, `deck-document.ts` | Kontrak pekerjaan, schema kompatibel, pemisahan metadata publik/privat. |
| `lib/deck-service/deck-service.ts`, `file-repository.ts` | Listing, kepemilikan run, start/finish, commit atomik dan revision. |
| `lib/deck-service/events.ts`, `http-server.ts` | Event Library/editor, endpoint metadata/cover, autentikasi. |
| `scripts/deck-mcp.ts`, `scripts/deck-agent.mjs` | Instruksi incremental, sembilan tools, membuka Library dan pairing lokal. |
| `lib/local-deck/client.ts`, `event-client.ts`, `service-library.ts` | Koneksi antartab, stream browser, metadata dan label status. |
| `hooks/use-service-library.ts`, `components/home/` | Menggabungkan tampilan Library, kartu status, cover lazy dan link sumber yang tepat. |
| `lib/local-deck/live-session.ts` | Follow, jeda, aktivitas, revision dan arbitrase draft. |
| `components/editor/local-deck-entry.tsx`, `local-deck-session.tsx` | Masuk melalui kartu, kontrol/status dan overlay canvas. |
| `components/editor/canvas-workspace.tsx` | Memasang overlay; renderer yang ada tetap dipakai. |
| `tests/agent-library.test.ts`, `tests/deck-agent-e2e.ts` | Lifecycle pekerjaan, Library, keamanan, dan alur browser terisolasi. |

## 8. Penerimaan dan verifikasi

1. Prompt CLI menciptakan cover; kartu muncul saat pekerjaan masih berjalan tanpa input ID manual.
2. Klik kartu dan lihat slide bertambah; Follow AI membuka target dan highlight terlihat.
3. Status selesai hanya setelah finish yang valid. Rencana belum lengkap ditolak.
4. Memilih slide sendiri, mematikan Follow, atau menjeda tampilan tetap memberi kendali pengguna.
5. Draft/input/gesture/dialog tidak tertimpa. Konflik Save mempertahankan draft.
6. Restart/idle menginterupsi pekerjaan; resume eksplisit dan pemilik lama tidak mengambil alih run baru.
7. Dua agen aktif ditolak; token dan stream tetap terautentikasi.
8. File korup/kegagalan tulis tidak menghasilkan sukses palsu atau menghilangkan deck valid lainnya.
9. Fingerprint seluruh IndexedDB deck lama serta nilai localStorage lama tetap sama setelah siklus Library/live.
10. Alur lama open/edit/Save/revisi/reconnect dan renderer tetap lulus.

```sh
npm run test:deck-agent
npm run build
npm run test:deck-agent:e2e
npm run test:deck-agent:e2e -- --library
npm run test:deck-agent:e2e -- --library --codex
```

Pengujian memakai data dan profil Chrome sementara, tanpa menyentuh browser/data pengguna. Mode `--codex` memakai CLI dan akun model yang login. Ini pengujian penerimaan, bukan fitur screenshot atau validasi browser otomatis sebelum setiap commit produk.

Hasil 11 November 2026: 27 pengujian service/MCP/live lulus, build serta typecheck lulus, dan lint area implementasi lulus. E2E Library dengan client MCP maupun Codex CLI nyata berhasil membuat 10 slide bertahap, menampilkan kartu saat pekerjaan aktif, mengikuti target, memberi highlight, lalu menampilkan selesai; IndexedDB dan localStorage lama tidak berubah. Pengujian tambahan memverifikasi pairing ke tab Library yang sudah terbuka, Cancel/Delete kartu CLI, dan deck tetap terhapus setelah reload. Penghapusan service memakai revision dan commit atomik, serta menolak Save/retry agen setelah deck dihapus. Regresi editor lama juga lulus hingga revision 6, termasuk Save manual, konflik draft, dialog, restart, dan preview. Lint seluruh proyek masih melaporkan dua error lama `set-state-in-effect` di canvas/table-properties dan satu warning timeline.

## 9. Yang perlu disiapkan

- Tiga terminal: `npm run dev`, `npm run deck-service`, `npm run deck-agent`.
- Codex CLI terpasang/login dan browser dengan lebar minimal 1280 px.
- Brief tujuan, audiens, bahasa, jumlah slide, serta fakta/aset lokal yang ingin dipakai.
- Gunakan origin yang sama, default `http://localhost:3000`; sesuaikan `DECK_APP_URL` jika port berubah.
- Backup folder `.deck-builder` bila dibutuhkan. Backup key browser lama dibuat sebelum editor service memuat deck.

Kursor AI, drag bebas, font validation otomatis, screenshot Playwright, dan undo/redo lintas revision belum menjadi bagian tahap ini. Penyimpanan, builder, dan event lokal; inferensi Codex tidak otomatis offline.

## Referensi

- [Panduan menjalankan](local-deck-agent.md)
- [Plan MVP](local-deck-agent-plan.md)
- [Format DeckSpec](deck-spec/README.md)
