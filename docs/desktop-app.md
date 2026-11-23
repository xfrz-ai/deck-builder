# WKND Deck desktop app (Electron)

Satu app Mac yang menjalankan editor, Library, deck service dan AI bridge (memakai Claude Code milik user). Deck dan data tetap di laptop. Layout, template dan perbaikan sampai ke user lewat **update bundle otomatis**, tanpa download ulang.

## Struktur: cangkang + bundle

```
WKND Deck.app
├─ shell.cjs            CANGKANG (electron/shell.ts): pilih bundle, jalankan engine, cek update
└─ Resources/bundle/    BUNDLE bawaan
   ├─ manifest.json     build, versi, shellApi, SHA-256 tiap file
   ├─ manifest.sig      tanda tangan Ed25519 dari manifest.json
   ├─ engine.cjs        electron/engine.ts: static server, deck service, AI bridge, jendela
   ├─ deck-mcp.mjs      server MCP deck_builder (dijalankan Claude Code)
   ├─ ai-bridge.mjs     chat "Create with AI"
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

## Tahap berikutnya

1. Layar pertama: pilih Claude Code atau Codex (cek install dan login), dan Codex di chat.
2. 12 layout untuk agent + template deck (Pitch, Timeline, QA Testing, Mockup Preview, Case Study, Comparison).
3. Lampiran gambar untuk agent.
4. GitHub Actions untuk rilis bundle dan `.dmg`, ikon app, build Windows.
