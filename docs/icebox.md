# Ice box

Ide fitur yang menarik tapi sengaja ditunda. Tiap ide mencatat alasan ditunda dan apa yang perlu dipikirkan kalau suatu saat diambil.

---

## Simpan custom slide sebagai template baru

*Dicatat 2026-11-23, saat merancang CLI `wknd-deck` dan skill agen.*

**Ide.** Custom slide yang disusun agen (elemen di slot grid 24×12) bisa disimpan jadi template baru, misalnya dengan `wknd-deck layouts save <deck> <slide> --name <id>`. Setelah itu template tersebut muncul di `wknd-deck layouts` dan di layout picker editor, sehingga bisa dipakai lagi di deck lain.

**Kenapa ditunda.** Custom slide dimaksudkan untuk konten satu kali pakai, yang memang tidak perlu diulang di deck lain. Lebih baik lihat dulu bagaimana agen memakai custom slide sebelum ada jalan untuk menjadikannya template.

**Yang perlu dipikirkan kalau diambil:**

- **Elemen jadi field.** Teks mana yang menjadi field yang bisa diisi, dan berapa batas karakternya (dihitung dari ukuran slot dan style teks)?
- **Siapa yang boleh menyimpan.** Agen, user, atau hanya designer? Perlu langkah review supaya tidak setiap slide sekali pakai menjadi template.
- **Lingkup.** Template pribadi (di data dir user) atau dibagikan ke tim lewat bundle update?
- **Versi.** Bagaimana kalau template diubah setelah sudah dipakai di beberapa deck?
- **Hubungan dengan 31 template bawaan.** Template hasil simpanan harus terlihat berbeda di daftar, supaya agen tetap mengutamakan template yang sudah teruji.
