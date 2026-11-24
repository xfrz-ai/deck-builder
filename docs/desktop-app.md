# WKND Deck desktop app (Electron)

Satu app Mac yang menjalankan editor, Library, deck service dan AI bridge (memakai Claude Code atau Codex milik user). Deck dan data tetap di laptop. Layout, template dan perbaikan sampai ke user lewat **update bundle otomatis**, tanpa download ulang.

## Struktur: cangkang + bundle

```
WKND Deck.app
├─ shell.cjs            CANGKANG (electron/shell.ts): pilih bundle, jalankan engine, cek update
└─ Resources/bundle/    BUNDLE bawaan
   ├─ manifest.json     build, versi, shellApi, SHA-256 tiap file
   ├─ manifest.sig      tanda tangan Ed25519 dari manifest.json
   ├─ engine.cjs        electron/engine.ts: static server, deck service, AI bridge, jendela
   ├─ deck-mcp.mjs      server MCP deck_builder (dijalankan Claude Code atau Codex)
   ├─ ai-bridge.mjs     chat "Create with AI", AI slide chat dan import dokumen
   ├─ wknd-deck.mjs     CLI wknd-deck untuk agen "Claude Code · CLI" (dijalankan lewat shim di PATH agen)
   ├─ skills/wknd-deck/ skill agen CLI (SKILL.md)
   ├─ playbook.md
   └─ web/              app Next.js (static export)
```

Bundle hasil download disimpan di `~/Library/Application Support/WKND Deck/bundles/<build>/`. Saat start, cangkang memakai bundle terbaru yang **tanda tangannya cocok dengan kunci publik di app dan semua file-nya tidak berubah**. Kalau tidak cocok, atau gagal start, bundle itu dibuang dan dimasukkan daftar hitam, lalu app memakai bundle bawaan.

Kalau suatu bundle butuh cangkang lebih baru (`shellApi` naik), app menawarkan halaman download. Ini hanya untuk perubahan cangkang, misalnya upgrade Electron.

## Perintah

```sh
npm run desktop                 # build lengkap lalu buka app (development)
npm run desktop:quick           # pakai build web terakhir
npm run desktop:package         # build + bungkus: dist-desktop/app/WKND Deck-<versi>-arm64.dmg
npm run desktop:release-bundle  # dari dist-desktop/bundle: zip + latest.json di dist-desktop/release/
npm run test:desktop            # test verifikasi dan pemasangan update
```

## Merilis update (misalnya layout baru)

1. `npm run desktop:build`. Bundle ditandatangani dengan kunci rahasia.
2. `npm run desktop:release-bundle`.
3. Buat GitHub release di `xfrz-ai/deck-builder` dan lampirkan `latest.json` + `wknd-deck-bundle-<build>.zip`.

App mengecek `https://github.com/xfrz-ai/deck-builder/releases/latest/download/latest.json` 10 detik setelah dibuka, lalu setiap 6 jam. Update diunduh di belakang layar, lalu user diminta restart (atau update dipakai saat app dibuka berikutnya). Untuk menguji dengan feed lain: `WKND_DECK_UPDATE_URL=http://… open "WKND Deck.app"`.

Nanti GitHub Actions menjalankan langkah 1–3 otomatis.

## Kunci tanda tangan bundle — WAJIB dibackup

- **Kunci rahasia:** `~/.wknd-deck/bundle-signing-key.pem` (tidak di-commit). Untuk CI, isi secret `WKND_DECK_SIGNING_KEY` dengan isi file ini.
- **Kunci publik:** [electron/bundle-public-key.pem](../electron/bundle-public-key.pem), tertanam di setiap app.

Kalau kunci rahasia hilang, app yang sudah terpasang tidak bisa menerima update lagi. Semua user harus download app baru dengan kunci baru. Simpan salinannya di password manager tim. Kalau kunci bocor, siapa pun bisa membuat "update" yang dijalankan di laptop user: buat kunci baru dan rilis app baru.

## Catatan

- **Tanda tangan app:** `.app` ditandatangani ad-hoc (gratis, cukup untuk Apple Silicon). Copy yang di-download dari internet sekali diblokir macOS: buka **System Settings → Privacy & Security → Open Anyway**. Dengan akun Apple Developer, bisa di-sign dan dinotarisasi.
- **Port tetap 4790, 8790, 8787:** tutup `npm run deck-service` dan `npm run ai-bridge` sebelum membuka app.
- **Log:** `~/Library/Logs/WKND Deck/main.log`.
- **Terminal VS Code** menyetel `ELECTRON_RUN_AS_NODE=1`. `npm run desktop` sudah menanganinya. Kalau membuka `.app` dengan `open` dari terminal itu, pakai `env -u ELECTRON_RUN_AS_NODE open …`. Dari Finder tidak masalah.
- **Ukuran:** bundle sekitar 36 MB zip, kebanyakan gambar (`assets/`). Optimasi berikutnya: aset dipisah supaya update kode cukup beberapa MB.

## Ikon app

`electron/icon.png` adalah ikon 1024 × 1024 dengan background transparan. Artwork-nya sudah dalam bentuk rounded khas macOS: 824 px di tengah, margin 100 px, plus shadow tipis. electron-builder membuat `.icns` dari file ini. `electron/icon-source.png` adalah artwork asli yang full-bleed.

Ikon adalah bagian dari `.app`, bukan bagian dari bundle update. Jadi ikon baru hanya sampai ke user lewat `.dmg` baru.

## Agen AI

User memakai CLI dan login miliknya sendiri, tanpa API key. Di panel **Create with AI**, baris di bawah judul menunjukkan agen yang aktif (titik hijau artinya siap). Klik baris itu untuk membuka kartu **AI agent**:

- Status tiap agen: terpasang atau belum, versi, dan status login. Data ini dari `claude --version`, `claude auth status`, `codex --version` dan `codex login status`. Hasilnya disimpan 30 detik; tombol **Check again** mengecek ulang.
- Switch on/off. Hanya satu agen yang aktif. Kalau dua-duanya dimatikan, AI mati dan chat dikunci. Agen yang belum terpasang atau belum login tidak bisa dinyalakan, dan kartunya menampilkan langkah yang perlu dilakukan.
- Pilihan disimpan di `<data>/agent-settings.json`. Selama user belum memilih, yang dipakai adalah agen pertama yang siap, Claude Code dulu baru Codex. Ada agen ketiga, **Claude Code · CLI (beta)**, yang tampil paling atas dan menjadi default: Claude Code yang bekerja lewat CLI `wknd-deck` dan skill-nya, bukan lewat MCP. Di checkout source CLI dijalankan dari `scripts/wknd-deck.ts`; di app desktop dari `wknd-deck.mjs` di bundle (`WKND_DECK_CLI_BUNDLE`, lihat `scripts/wknd-deck-command.mjs`).
- Agen aktif dipakai oleh semua fitur AI: chat Library, AI slide chat di editor, dan import dokumen.
- Satu chat tetap memakai agen tempat chat itu dimulai. Kalau agennya diganti, chat baru dimulai.

Batasan Codex (`scripts/agents.mjs`):
- dijalankan dengan `codex exec --json`, dan chat dilanjutkan dengan `codex exec resume`;
- tanpa config pribadi user (`--ignore-user-config`);
- shell, web, apps, plugins dan browser dimatikan;
- sandbox read-only, di folder kosong;
- tools `deck_builder` berjalan tanpa persetujuan.

Fitur dimatikan lewat `-c features.<nama>=false`, bukan `--disable`, supaya versi Codex lain tidak gagal start karena nama fitur yang tidak dikenal. Diuji dengan Codex CLI 0.167.1 dan Claude Code 2.1.330.

## Tahap berikutnya

1. Layar sambutan saat app pertama dibuka (memakai status agen di atas).
2. 12 layout untuk agent + template deck (Pitch, Timeline, QA Testing, Mockup Preview, Case Study, Comparison).
3. Lampiran gambar untuk agent.
4. GitHub Actions untuk rilis bundle dan `.dmg`, build Windows.
