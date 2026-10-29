# Papan Info Masjid Baiturrahman

Aplikasi papan informasi untuk TV masjid lewat Android TV box (STB):
jam besar, jadwal sholat otomatis, hitung mundur iqomah, jadwal pengajian,
petugas Jumat, pengumuman, laporan kas, dan teks berjalan.
Semua berjalan **tanpa internet**. WiFi hanya dipakai untuk sinkron jam dan
untuk mengatur isi papan info dari HP.

## Isi folder

| Folder | Isi |
|---|---|
| `web/` | Tampilan layar (`index.html`) dan halaman pengaturan (`admin.html`). Bisa langsung dicoba di browser laptop. |
| `android/` | Proyek Android pembungkus. Menghasilkan file APK. |
| `.github/workflows/` | Resep pembuatan APK otomatis di GitHub. |

---

## 1. Coba dulu di laptop

Buka `web/index.html` dengan Chrome. Klik tombol **Buka pengaturan** di atas
layar untuk mencoba halaman pengaturan (PIN awal: **1234**).
Di mode ini pengaturan tersimpan di browser laptop saja.

Untuk melihat tampilan pada jam tertentu, tambahkan `?sim=` di alamat, contoh:

- `index.html?sim=2026-10-29T17:45` → menjelang adzan Maghrib
- `index.html?sim=2026-10-29T17:58` → hitung mundur iqomah
- `index.html?sim=2026-10-30T11:50` → layar khutbah Jumat

## 2. Membuat file APK

Pilih salah satu cara.

### Cara A — lewat GitHub (gratis, tanpa memasang apa pun)

1. Buat akun di github.com, lalu buat repository baru (boleh *Private*).
2. Unggah seluruh isi folder ini ke repository tersebut
   (tombol **Add file → Upload files**, seret semua file dan folder, termasuk folder `.github`).
   Jika folder `.github` tidak ikut terunggah, buat file baru bernama
   `.github/workflows/build-apk.yml` dan salin isinya dari folder ini.
3. Buka tab **Actions**. Proses **Build APK** berjalan otomatis (±5 menit).
4. Setelah centang hijau muncul, klik proses tersebut, lalu unduh
   **papan-info-masjid-apk** di bagian *Artifacts*. Ekstrak ZIP-nya → `papan-info-masjid.apk`.

### Cara B — lewat Android Studio

1. Pasang Android Studio, lalu **Open** folder `android`.
2. Jika diminta, pilih Gradle 8.11.1 dan JDK 17.
3. Menu **Build → Build App Bundle(s) / APK(s) → Build APK(s)**.
4. Hasilnya ada di `android/app/build/outputs/apk/`.

## 3. Memasang di box

1. Salin `papan-info-masjid.apk` ke flashdisk, colokkan ke box.
2. Di box, buka aplikasi **File Manager**, pilih file APK, lalu **Install**.
   Jika muncul peringatan, izinkan *Sumber tidak dikenal / Install unknown apps*
   untuk File Manager.
3. Buka aplikasi **Papan Info Masjid**.

Cara lain tanpa flashdisk (laptop & box satu jaringan):
`adb connect <IP-box>` lalu `adb install -r papan-info-masjid.apk`.

### Agar langsung tampil saat box menyala

Tekan tombol **Home** di remote. Box akan bertanya aplikasi layar utama mana
yang dipakai: pilih **Papan Info Masjid → Selalu (Always)**.
Setelah itu, setiap listrik menyala kembali, layar jadwal langsung tampil.

Jika box tidak bertanya, buka *Pengaturan Android → Aplikasi → Aplikasi default
→ Aplikasi layar utama (Home app)* dan pilih Papan Info Masjid.

**Keluar dari mode papan info**: tekan OK di remote → masuk PIN → bagian **Sistem**
→ **Buka pengaturan Android**. Dari sana Anda bisa mengatur WiFi atau mengganti
aplikasi layar utama.

### Pengaturan box yang disarankan

- Sambungkan ke WiFi masjid dan aktifkan **Tanggal & waktu otomatis**,
  zona waktu **GMT+7 Jakarta**.
- Matikan *screensaver* / *daydream* dan *sleep* di pengaturan tampilan.
- Atur kecerahan TV sedang, agar layar awet.

## 4. Mengatur isi papan info

**Dari HP (paling mudah):** sambungkan HP ke WiFi yang sama dengan box.
Alamatnya tampil di pojok kanan bawah layar TV, misalnya `192.168.1.25:8080`.
Ketik alamat itu di Chrome HP, masukkan PIN, ubah isinya, tekan **Simpan**.
Layar TV ikut berubah dalam ±10 detik.

**Dari remote:** tekan **OK** atau **Menu** di remote saat layar jadwal tampil.
Pakai panah atas/bawah untuk pindah isian. Jika tidak disentuh 3 menit,
layar otomatis kembali ke jadwal.

PIN awal **1234**. Segera ganti di bagian **Sistem → Ganti PIN**.
Setelah 10 kali salah PIN, pengaturan dikunci 5 menit.

**Lupa PIN?** Atur ulang PIN langsung di TV: saat layar jadwal tampil, tekan **OK**
di remote → pilih **Lupa PIN?** → masukkan PIN baru dua kali → **Simpan PIN baru**.
Demi keamanan, cara ini hanya bisa dilakukan di TV, tidak dari HP, sehingga hanya
yang memegang remote di masjid yang bisa mengatur ulang PIN. Isi papan info tidak berubah.

### Bagian pengaturan

| Bagian | Isinya |
|---|---|
| Masjid | Nama, alamat, koordinat, zona waktu, foto masjid, tabel jadwal 7 hari |
| Waktu sholat | Koreksi menit per waktu, kriteria Kemenag, koreksi jam & tanggal Hijriah |
| Adzan & iqomah | Pengingat menjelang adzan, lama iqomah per waktu, layar gelap saat sholat, lama khutbah Jumat |
| Pengajian | Kajian rutin mingguan atau bertanggal |
| Petugas Jumat | Khatib, imam, muadzin per tanggal |
| Pengumuman | Teks berjalan, pengumuman, pesan/hadits |
| Kas masjid | Saldo, pemasukan, pengeluaran (saldo akhir dihitung otomatis) |
| Tampilan | Warna tema, kecepatan ganti panel, redup malam |
| Sistem | Alamat untuk HP, samakan jam box, ganti PIN, cadangan & pemulihan data |

### Foto masjid

Di bagian **Masjid → Foto masjid**, pilih foto dari galeri HP atau potret langsung.
Foto otomatis diperkecil, lalu tampil di panel bergilir dan (bila dicentang) sebagai
latar layar yang samar. Gunakan foto milik sendiri; foto dari Google Maps adalah
milik pengunggahnya dan tidak diambil otomatis oleh aplikasi.

Data contoh (nama ustadz, kas, pengumuman) bertanda *(contoh)* — ganti dengan data
masjid yang sebenarnya.

## 5. Jika box tidak tersambung WiFi

Semua fitur tetap jalan tanpa internet. Yang perlu dijaga hanya **jam box**:
box murah tanpa baterai jam bisa kembali ke tanggal lama setelah listrik padam.

Aplikasi memeriksa ini sendiri. Jika jam terlihat mundur atau tanggalnya terlalu
lama, jadwal sholat disembunyikan dan layar menampilkan **"Jam di box belum benar"**
beserta cara membetulkannya:

- tekan **OK** di remote untuk langsung membuka pengaturan tanggal & jam, atau
- sambungkan box sebentar ke WiFi atau hotspot HP (jam menyesuaikan sendiri), atau
- buka pengaturan dari HP (box tersambung ke hotspot HP tersebut), lalu
  **Sistem → Samakan jam box dengan HP ini**. Jam ini berlaku sampai box dimatikan.

Agar tidak repot, pasang **UPS kecil atau power bank** untuk box supaya box tidak
ikut mati saat listrik padam.

## 6. Tentang waktu sholat

Dihitung di box dari koordinat masjid (−6.3321582, 106.7199787) dengan kriteria
Kemenag RI: Subuh 20°, Isya 18°, Ashar Syafi'i, ihtiyat 2 menit, Imsak 10 menit
sebelum Subuh. Sudah dicocokkan dengan jadwal Kemenag Kota Tangerang Selatan
(Oktober 2026), selisih paling banyak 1 menit. Bila pengurus ingin sama persis
dengan jadwal tertentu, atur di **Waktu sholat → Koreksi per waktu**.

## 7. Mengubah tampilan atau kode

- Tampilan & logika: `web/` (HTML, CSS, JavaScript biasa).
- Android: `android/app/src/main/java/id/masjid/papaninfo/`
  - `MainActivity.java` — layar penuh, layar selalu nyala, tombol remote.
  - `LocalServer.java` — server kecil untuk pengaturan dari HP (port 8080).
  - `BootReceiver.java` — membuka aplikasi setelah box menyala.

Setiap mengubah isi `web/`, buat ulang APK lalu pasang ulang. Pengaturan
yang sudah tersimpan di box tidak hilang saat APK diperbarui.

## 8. Mengunggah ke Google Play Store

Play Store tidak menerima APK. Yang diunggah adalah file **AAB**
(`papan-info-masjid.aab`), dan file itu harus ditandatangani dengan kunci milik sendiri.

### Langkah 1 — buat kunci tanda tangan (sekali saja)

Di Android Studio: **Build → Generate Signed App Bundle or APK → Android App Bundle →
Create new...**, lalu isi lokasi file (misalnya `upload.jks`), password, dan *alias*
(misalnya `upload`). Atau lewat perintah (keytool ikut terpasang bersama Android Studio/JDK):

```
keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

> **Simpan file `upload.jks` beserta password-nya di tempat aman dan buat cadangannya.**
> Jangan unggah ke GitHub (sudah dikecualikan lewat `.gitignore`).

### Langkah 2 — simpan kunci di GitHub

1. Ubah file kunci menjadi teks base64. Di PowerShell:
   `[Convert]::ToBase64String([IO.File]::ReadAllBytes("upload.jks")) | Set-Clipboard`
2. Buka repository → **Settings → Secrets and variables → Actions → New repository secret**,
   lalu buat empat secret berikut:

| Nama secret | Isi |
|---|---|
| `KEYSTORE_BASE64` | teks base64 dari langkah 1 |
| `KEYSTORE_PASSWORD` | password keystore |
| `KEY_ALIAS` | alias kunci (misalnya `upload`) |
| `KEY_PASSWORD` | password kunci (biasanya sama dengan password keystore) |

3. Jalankan ulang **Actions → Build APK**. Sekarang di bagian *Artifacts* muncul juga
   **papan-info-masjid-aab**. File inilah yang diunggah ke Play Console.

Nomor versi (`versionCode`) naik sendiri setiap kali workflow berjalan, jadi setiap
hasil build bisa langsung diunggah sebagai pembaruan.

Untuk Android Studio (tanpa GitHub), buat file `android/keystore.properties`:

```
storeFile=../upload.jks
storePassword=passwordAnda
keyAlias=upload
keyPassword=passwordAnda
```

### Catatan

- Setelah secret diisi, APK dari GitHub juga ikut ditandatangani kunci baru. Box yang
  sudah memasang APK lama (kunci debug) harus **uninstall** dulu sebelum memasang APK
  baru, dan pengaturan di box akan hilang. Catat pengaturannya sebelum uninstall.
- Selain file AAB, Play Console juga meminta ikon 512×512, *feature graphic* 1024×500,
  screenshot (ponsel dan TV 1920×1080), banner TV 1280×720, URL kebijakan privasi,
  formulir *Data safety*, dan kuesioner rating konten.

Huruf: Plus Jakarta Sans dan Amiri (lisensi SIL Open Font License, ada di `web/fonts/`).
