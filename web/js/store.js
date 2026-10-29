/* Pengaturan bawaan + tempat penyimpanan.
   - Di dalam aplikasi Android: disimpan di box lewat server lokal (/api/...),
     sehingga bisa diubah dari HP yang satu WiFi.
   - Saat dibuka di browser laptop (pratinjau): disimpan di localStorage. */
(function (global) {
  'use strict';

  var DEFAULTS = {
    versi: 1,
    masjid: {
      nama: 'Masjid Baiturrahman',
      alamat: 'Tangerang Selatan, Banten',
      lat: -6.3321582,
      lng: 106.7199787,
      tz: 7,
      elev: 30
    },
    sholat: {
      fajr: 20, isha: 18, asr: 1, ihtiyat: 2, imsak: 10,
      adjust: { subuh: 0, terbit: 0, dzuhur: 1, ashar: 0, maghrib: 0, isya: 0 },
      hijriOffset: 0,
      hijriMaghrib: true,
      clockOffsetSec: 0
    },
    adzan: {
      preMin: 10,
      adzanMin: 4,
      iqomah: { subuh: 10, dzuhur: 8, ashar: 8, maghrib: 5, isya: 8 },
      sholatMin: { subuh: 12, dzuhur: 12, ashar: 12, maghrib: 12, isya: 12 },
      jumatMin: 50,
      beep: true
    },
    pengajian: [
      { hari: '1', tanggal: '', jam: 'Ba\'da Maghrib', judul: 'Kajian Tafsir Al-Qur\'an', pemateri: 'Ustadz Ahmad (contoh)' },
      { hari: '4', tanggal: '', jam: 'Ba\'da Maghrib', judul: 'Yasinan & Tahlil Bersama', pemateri: 'Jamaah Masjid' },
      { hari: '6', tanggal: '', jam: '08:00', judul: 'Pengajian Ibu-ibu Majelis Taklim', pemateri: 'Ustadzah Fatimah (contoh)' },
      { hari: '0', tanggal: '', jam: 'Ba\'da Subuh', judul: 'Kuliah Subuh: Fiqih Ibadah', pemateri: 'Ustadz Hasan (contoh)' }
    ],
    jumat: [
      { tanggal: '2026-10-30', khatib: 'Ustadz Abdullah (contoh)', imam: 'Ustadz Abdullah (contoh)', muadzin: 'Sdr. Rizki (contoh)' },
      { tanggal: '2026-11-06', khatib: 'Ustadz Yusuf (contoh)', imam: 'Ustadz Yusuf (contoh)', muadzin: 'Sdr. Fajar (contoh)' },
      { tanggal: '2026-11-13', khatib: 'Ustadz Ahmad (contoh)', imam: 'Ustadz Ahmad (contoh)', muadzin: 'Sdr. Rizki (contoh)' }
    ],
    info: {
      runningText: [
        'Selamat datang di Masjid Baiturrahman',
        'Mohon nonaktifkan nada dering HP saat berada di dalam masjid',
        'Jagalah kebersihan dan kesucian masjid',
        'Infaq dan sedekah dapat disalurkan melalui kotak amal atau pengurus DKM'
      ],
      pengumuman: [
        { judul: 'Kerja Bakti', isi: 'Kerja bakti membersihkan masjid, Ahad pagi pukul 07.00. Mohon kehadiran bapak-bapak dan remaja masjid. (contoh)' }
      ],
      pesan: [
        { teks: 'Luruskan dan rapatkan shaf, karena lurusnya shaf termasuk kesempurnaan sholat.', sumber: 'HR. Bukhari & Muslim' },
        { teks: 'Barang siapa membangun masjid karena Allah, Allah akan membangunkan baginya rumah di surga.', sumber: 'HR. Bukhari & Muslim' },
        { teks: 'Sesungguhnya sholat itu mencegah dari perbuatan keji dan mungkar.', sumber: 'QS. Al-Ankabut: 45' }
      ]
    },
    kas: {
      tampil: true,
      tanggal: '2026-10-25',
      saldoLalu: 12500000,
      pemasukan: 3250000,
      pengeluaran: 1100000,
      catatan: 'Contoh laporan — ubah angka di Pengaturan'
    },
    tampilan: {
      tema: 'zamrud',
      slideDetik: 12,
      redup: { aktif: true, mulai: '22:00', selesai: '03:30', persen: 40 },
      foto: { ada: false, versi: 0, latar: true, panel: true },
      tampilkanAlamatAdmin: true
    }
  };

  var LS_KEY = 'masjidtv-config';
  var LS_PIN = 'masjidtv-pin';
  var serverMode = null; // null = belum dicek

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // gabungkan data tersimpan di atas bawaan (array diganti utuh)
  function merge(base, over) {
    if (over == null || typeof over !== 'object' || Array.isArray(over)) return over == null ? base : over;
    var out = Array.isArray(base) ? [] : {};
    var k;
    for (k in base) out[k] = base[k];
    for (k in over) {
      if (base && typeof base[k] === 'object' && base[k] !== null && !Array.isArray(base[k])) out[k] = merge(base[k], over[k]);
      else out[k] = over[k];
    }
    return out;
  }

  function detect() {
    if (serverMode !== null) return Promise.resolve(serverMode);
    if (!/^https?:$/.test(location.protocol) || !global.fetch) { serverMode = false; return Promise.resolve(false); }
    return fetch('/api/info', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { serverMode = !!(j && j.app === 'masjid-tv'); return serverMode; })
      .catch(function () { serverMode = false; return false; });
  }

  function lsGet(key) { try { return global.localStorage.getItem(key); } catch (e) { return null; } }
  function lsSet(key, v) { try { global.localStorage.setItem(key, v); return true; } catch (e) { return false; } }

  function load() {
    return detect().then(function (server) {
      if (server) {
        return fetch('/api/config', { cache: 'no-store' })
          .then(function (r) { return r.ok ? r.text() : ''; })
          .then(function (t) { return { raw: t, server: true }; })
          .catch(function () { return { raw: '', server: true }; });
      }
      return { raw: lsGet(LS_KEY) || '', server: false };
    }).then(function (res) {
      var stored = null;
      try { stored = res.raw ? JSON.parse(res.raw) : null; } catch (e) { stored = null; }
      return { config: merge(clone(DEFAULTS), stored || {}), raw: res.raw, server: res.server };
    });
  }

  function save(config, pin) {
    var body = JSON.stringify(config);
    return detect().then(function (server) {
      if (server) {
        return fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Pin': pin || '' }, body: body })
          .then(function (r) {
            if (r.status === 403) throw new Error('PIN salah');
            if (!r.ok) throw new Error('Gagal menyimpan (' + r.status + ')');
            return true;
          });
      }
      if (!lsSet(LS_KEY, body)) throw new Error('Penyimpanan browser tidak tersedia');
      return true;
    });
  }

  function checkPin(pin) {
    return detect().then(function (server) {
      if (server) {
        return fetch('/api/check', { method: 'POST', headers: { 'X-Pin': pin || '' } }).then(function (r) { return r.ok; });
      }
      return (lsGet(LS_PIN) || '1234') === pin;
    });
  }

  function changePin(oldPin, newPin) {
    return detect().then(function (server) {
      if (server) {
        return fetch('/api/pin', { method: 'POST', headers: { 'X-Pin': oldPin || '', 'Content-Type': 'text/plain' }, body: newPin })
          .then(function (r) { if (!r.ok) throw new Error(r.status === 403 ? 'PIN lama salah' : 'Gagal mengubah PIN'); return true; });
      }
      if ((lsGet(LS_PIN) || '1234') !== oldPin) return Promise.reject(new Error('PIN lama salah'));
      lsSet(LS_PIN, newPin);
      return true;
    });
  }

  function info() {
    return detect().then(function (server) {
      if (!server) return { server: false };
      return fetch('/api/info', { cache: 'no-store' }).then(function (r) { return r.json(); })
        .then(function (j) { j.server = true; return j; }).catch(function () { return { server: true }; });
    });
  }

  // lupa PIN: hanya dari layar TV (server menolak permintaan dari HP)
  function resetPin(newPin) {
    return detect().then(function (server) {
      if (server) {
        return fetch('/api/pin-reset', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: newPin })
          .then(function (r) {
            if (r.status === 403) throw new Error('PIN hanya bisa diatur ulang langsung di layar TV, memakai remote.');
            if (!r.ok) throw new Error('PIN baru harus 4 sampai 8 angka.');
            return true;
          });
      }
      lsSet(LS_PIN, newPin);
      return true;
    });
  }

  // ---------- jam: disamakan dari HP ----------
  function clock() {
    return detect().then(function (server) {
      if (!server) return { synced: false, offset: 0 };
      var t0 = Date.now();
      return fetch('/api/clock', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
        var t1 = Date.now();
        // selisih jam yang disamakan dengan jam yang dibaca halaman ini
        return { synced: !!j.synced, offset: j.synced ? j.now - (t0 + t1) / 2 : 0, box: j.box };
      }).catch(function () { return { synced: false, offset: 0 }; });
    });
  }
  function syncClock(pin) {
    return detect().then(function (server) {
      if (!server) throw new Error('Hanya bisa dilakukan saat membuka pengaturan box dari HP');
      return fetch('/api/clock', { method: 'POST', headers: { 'X-Pin': pin || '', 'Content-Type': 'text/plain' }, body: String(Date.now()) })
        .then(function (r) { if (!r.ok) throw new Error(r.status === 403 ? 'PIN salah' : 'Gagal menyamakan jam'); return true; });
    });
  }

  // ---------- foto masjid ----------
  var LS_PHOTO = 'masjidtv-photo';
  function photoUrl(cfg) {
    var f = cfg && cfg.tampilan && cfg.tampilan.foto;
    if (!f || !f.ada) return null;
    if (serverMode) return '/foto-masjid.jpg?v=' + (f.versi || 0);
    return lsGet(LS_PHOTO);
  }
  function uploadPhoto(blob, dataUrl, pin) {
    return detect().then(function (server) {
      if (server) {
        return fetch('/api/photo', { method: 'POST', headers: { 'X-Pin': pin || '', 'Content-Type': 'image/jpeg' }, body: blob })
          .then(function (r) { if (!r.ok) throw new Error(r.status === 403 ? 'PIN salah' : 'Foto gagal diunggah (' + r.status + ')'); return true; });
      }
      if (!lsSet(LS_PHOTO, dataUrl)) throw new Error('Foto terlalu besar untuk disimpan di browser ini');
      return true;
    });
  }
  function deletePhoto(pin) {
    return detect().then(function (server) {
      if (server) {
        return fetch('/api/photo-delete', { method: 'POST', headers: { 'X-Pin': pin || '' } })
          .then(function (r) { if (!r.ok) throw new Error('Foto gagal dihapus'); return true; });
      }
      try { global.localStorage.removeItem(LS_PHOTO); } catch (e) {}
      return true;
    });
  }

  global.MasjidStore = {
    resetPin: resetPin, clock: clock, syncClock: syncClock, photoUrl: photoUrl, uploadPhoto: uploadPhoto, deletePhoto: deletePhoto, LS_PHOTO: LS_PHOTO,
    DEFAULTS: DEFAULTS, LS_KEY: LS_KEY,
    load: load, save: save, checkPin: checkPin, changePin: changePin, info: info, detect: detect,
    merge: merge, clone: clone,
    native: function () { return global.Android || null; }
  };
})(window);
