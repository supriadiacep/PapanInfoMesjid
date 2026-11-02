# Panduan mengisi formulir Play Console

Jawaban di bawah ini disesuaikan dengan cara kerja aplikasi saat ini: semua data tersimpan
di perangkat, tidak ada server pengembang, iklan, analitik, atau SDK pihak ketiga. **Kalau
nanti ada fitur yang mengirim data ke internet, jawaban ini harus diperbarui.**

Semua formulir ada di **Play Console → (aplikasi) → Kebijakan dan program → Konten aplikasi**.

## 1. Kebijakan privasi

Isi dengan URL halaman `docs/kebijakan-privasi.html` setelah di-host. Sebelumnya, ganti
`[email-kontak]` di file itu dengan email yang benar.

Cara host gratis lewat GitHub Pages (repo harus **public**; untuk repo private, Pages butuh akun berbayar):
1. Repository → **Settings → Pages**.
2. *Source*: **Deploy from a branch**, branch `main`, folder **`/docs`** → **Save**.
3. Setelah ±1 menit, alamatnya menjadi
   `https://supriadiacep.github.io/PapanInfoMesjid/kebijakan-privasi.html`.

Kalau repo tetap private, buat satu repo **public** kecil khusus untuk file ini, atau pakai Google Sites.

## 2. Akses aplikasi

Pilih **Semua atau sebagian fungsi dibatasi**, lalu tambahkan petunjuk untuk reviewer:

- Nama: `Halaman pengaturan`
- Nama pengguna: kosongkan
- Sandi: `1234`
- Petunjuk lain:
  `Layar utama tampil tanpa login. Untuk membuka pengaturan, tekan OK atau Menu pada remote (atau buka alamat yang tampil di pojok kanan bawah dari browser di jaringan WiFi yang sama), lalu masukkan PIN awal 1234.`

## 3. Iklan

**Tidak, aplikasi saya tidak berisi iklan.**

## 4. Rating konten (kuesioner IARC)

1. Email: email kontak Anda.
2. Kategori: **Semua jenis aplikasi lainnya** (*All Other App Types*). Pilih ini, bukan Game atau Media sosial.
3. Jawab **Tidak** untuk semua pertanyaan: kekerasan, konten seksual, bahasa kasar, zat terlarang, perjudian, interaksi antar pengguna, berbagi lokasi, pembelian digital, dan konten buatan pengguna yang dibagikan ke orang lain.
   - Isi papan info memang diketik pengurus, tapi hanya tampil di TV masjid itu sendiri dan tidak dibagikan ke pengguna aplikasi lain. Jadi pertanyaan "pengguna bisa berinteraksi atau bertukar konten" dijawab **Tidak**.
4. Hasil yang diharapkan: **Semua Umur / 3+** (PEGI 3, ESRB Everyone).

## 5. Target audiens dan konten

- Rentang usia target: **18 tahun ke atas** saja.
  Jangan centang kelompok usia anak, supaya tidak terkena persyaratan tambahan program *Families*.
- "Apakah aplikasi bisa menarik minat anak-anak?": **Tidak**.

## 6. Keamanan data (Data safety)

| Pertanyaan | Jawaban |
|---|---|
> Sejak fitur **Sambungan ke pusat** (November 2026), jawabannya berubah dari "Tidak" menjadi "Ya".
> Fitur itu mati secara bawaan, tetapi bila dinyalakan aplikasi mengirim data perangkat ke server pusat.

| Pertanyaan | Jawaban |
|---|---|
| Apakah aplikasi mengumpulkan atau membagikan jenis data pengguna yang diwajibkan? | **Ya** |
| Apakah semua data yang dikumpulkan dienkripsi saat transit? | **Ya** (HTTPS) |
| Apakah Anda menyediakan cara bagi pengguna untuk meminta penghapusan data? | **Ya** (putus sambungan / hubungi kontak) |

Jenis data yang dicentang:

| Kategori → jenis | Dikumpulkan | Dibagikan | Wajib/opsional | Tujuan |
|---|---|---|---|---|
| ID perangkat atau ID lain → *Device or other IDs* (kunci perangkat acak) | Ya | Tidak | **Opsional** | Fungsi aplikasi |
| Info & performa aplikasi → *Other app performance data* (versi, konten yang tampil, ukuran layar, user agent) | Ya | Tidak | **Opsional** | Fungsi aplikasi |

Catatan: alamat IP yang terlihat server tidak dicentang tersendiri bila hanya dipakai untuk status layar
(lihat definisi Google tentang data yang "dikumpulkan"); sebutkan di kebijakan privasi (sudah).
Pengaturan, PIN, foto, kas, dan jadwal tetap hanya di perangkat dan **tidak** dikirim.

## 7. Deklarasi lain

| Formulir | Jawaban |
|---|---|
| Aplikasi pemerintah | Tidak |
| Fitur keuangan | Tidak ada (laporan kas hanya ditampilkan, bukan layanan keuangan) |
| Aplikasi kesehatan | Tidak |
| Aplikasi berita | Tidak |
| ID iklan (Advertising ID) | Tidak menggunakan ID iklan |

## 8. Android TV

Di **Pengaturan → Faktor bentuk perangkat (Form factors)**, tambahkan **Android TV**,
unggah banner TV dan screenshot TV, lalu ikut sertakan. Aplikasi akan melewati review kualitas
TV tersendiri. Hal yang biasanya diperiksa:

- Semua fungsi bisa dipakai dengan remote (D-pad) tanpa layar sentuh. ✔
- Ada banner dan ikon `LEANBACK_LAUNCHER`. ✔
- Tombol Kembali tidak boleh membuat pengguna "terjebak". Aplikasi ini sengaja tidak menutup
  saat Kembali ditekan di layar jadwal (supaya cocok sebagai layar utama masjid). Tombol Home
  tetap berfungsi. Kalau reviewer menolak karena hal ini, jelaskan alasannya di kolom banding,
  atau ubah perilaku tombol Kembali.

## 9. Jalur rilis

Akun developer **pribadi** yang dibuat setelah November 2023 wajib menjalankan **uji tertutup**
(*Closed testing*) dengan minimal **12 penguji** yang ikut serta selama **14 hari berturut-turut**
sebelum bisa mengajukan akses produksi. Akun organisasi tidak terkena syarat ini.
