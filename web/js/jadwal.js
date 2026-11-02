/* Jadwal sholat manual (dari tabel resmi Kemenag / MUI setempat):
   - cfg.jadwalManual = { 'YYYY-MM-DD': { imsak:'04:10', subuh:'04:20', ... } }  (boleh sebagian waktu saja)
   - tanggal yang punya jadwal manual memakai jadwal itu, sisanya dihitung otomatis
   - template CSV (dibuka Excel), unggah CSV atau Excel (.xlsx) tanpa pustaka tambahan
   ES5 agar jalan di WebView lama. */
(function (global) {
  'use strict';

  var WAKTU = ['imsak', 'subuh', 'terbit', 'dzuhur', 'ashar', 'maghrib', 'isya'];
  var JUDUL = { imsak: 'Imsak', subuh: 'Subuh', terbit: 'Terbit', dzuhur: 'Dzuhur', ashar: 'Ashar', maghrib: 'Maghrib', isya: 'Isya' };
  // nama kolom yang dikenali (huruf kecil, tanpa spasi/tanda baca)
  var ALIAS = {
    tanggal: ['tanggal', 'tgl', 'date', 'hari'],
    imsak: ['imsak', 'imsyak'],
    subuh: ['subuh', 'shubuh', 'fajr', 'fajar', 'shubh'],
    terbit: ['terbit', 'syuruq', 'syuruk', 'sunrise', 'syurug'],
    dzuhur: ['dzuhur', 'zuhur', 'dhuhur', 'dhuhr', 'zhuhur', 'duhur', 'lohor'],
    ashar: ['ashar', 'asar', 'asr', 'ashr'],
    maghrib: ['maghrib', 'magrib', 'maghreb'],
    isya: ['isya', 'isyak', 'isha', 'isyaa']
  };

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function kunci(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fmt(min) { return global.PrayTime.fmt(min); }

  /** "04:30" / "4.30" / "4:30:00" / 0.1875 (Excel) -> menit sejak tengah malam, atau null */
  function keMenit(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') {
      if (v >= 0 && v < 1) return Math.round(v * 1440);          // pecahan hari (sel waktu Excel)
      if (v >= 1 && v < 2) return Math.round((v - 1) * 1440);
      return null;
    }
    var m = /^\s*(\d{1,2})\s*[:.,h]\s*(\d{2})(?:\s*[:.]\s*\d{2})?\s*$/i.exec(String(v));
    if (!m) {
      var x = parseFloat(String(v).replace(',', '.'));
      return (!isNaN(x) && x >= 0 && x < 1 && /^\s*0?[.,]\d+\s*$/.test(String(v))) ? Math.round(x * 1440) : null;
    }
    var h = +m[1], mi = +m[2];
    if (h > 23 || mi > 59) return null;
    return h * 60 + mi;
  }

  /** "2026-11-03" / "03/11/2026" / "3-11-2026" / "03.11.2026" / nomor seri Excel -> "YYYY-MM-DD" atau null */
  function keTanggal(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number' || /^\s*\d{5}(\.0+)?\s*$/.test(String(v))) {
      var n = Math.floor(+v);
      if (n < 20000 || n > 80000) return null;
      var d = new Date(Date.UTC(1899, 11, 30) + n * 864e5);
      return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
    }
    var s = String(v).trim(), m;
    if ((m = /^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/.exec(s))) return valid(+m[1], +m[2], +m[3]);
    if ((m = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/.exec(s))) return valid(+m[3], +m[2], +m[1]); // tanggal/bulan/tahun
    return null;
  }
  function valid(y, mo, d) {
    var t = new Date(y, mo - 1, d);
    return (t.getFullYear() === y && t.getMonth() === mo - 1 && t.getDate() === d) ? kunci(t) : null;
  }

  function opsi(cfg) {
    var m = cfg.masjid, s = cfg.sholat;
    return { lat: m.lat, lng: m.lng, tz: m.tz, elev: m.elev, fajr: s.fajr, isha: s.isha, asr: s.asr, ihtiyat: s.ihtiyat, imsak: s.imsak, adjust: s.adjust };
  }
  function hitung(cfg, d) { return global.PrayTime.compute(d, opsi(cfg)); }

  /** Jadwal satu tanggal (menit): manual bila ada & diaktifkan, sisanya hitungan. */
  function jadwalHari(cfg, d) {
    var t = hitung(cfg, d), man = cfg.jadwalManual && cfg.jadwalManual[kunci(d)];
    if (!man || (cfg.sholat && cfg.sholat.manualAktif === false)) return t;
    var out = {}, k;
    for (k in t) out[k] = t[k];
    WAKTU.forEach(function (w) { var x = keMenit(man[w]); if (x != null) out[w] = x; });
    out.manual = true;
    return out;
  }

  // ---------- template ----------
  /** CSV untuk satu bulan (bulan 1-12) atau setahun (bulan = 0), terisi jadwal yang berlaku sekarang. */
  function templateCsv(cfg, tahun, bulan) {
    var baris = ['sep=;', 'Tanggal;' + WAKTU.map(function (w) { return JUDUL[w]; }).join(';')];
    var d = new Date(tahun, bulan ? bulan - 1 : 0, 1);
    while (d.getFullYear() === tahun && (!bulan || d.getMonth() === bulan - 1)) {
      var t = jadwalHari(cfg, d);
      baris.push(kunci(d) + ';' + WAKTU.map(function (w) { return fmt(t[w]); }).join(';'));
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    }
    return '﻿' + baris.join('\r\n') + '\r\n';
  }

  // ---------- membaca file ----------
  function pisahCsv(teks) {
    teks = teks.replace(/^﻿/, '');
    var baris = teks.split(/\r\n|\n|\r/).filter(function (b) { return b.trim() !== ''; });
    var sep = ';';
    if (/^sep=(.)/i.test(baris[0] || '')) { sep = baris.shift().charAt(4); }
    else {
      var h = baris[0] || '';
      sep = [';', ',', '\t'].sort(function (a, b) { return h.split(b).length - h.split(a).length; })[0];
    }
    return baris.map(function (b) {
      var out = [], cur = '', q = false;
      for (var i = 0; i < b.length; i++) {
        var c = b.charAt(i);
        if (q) { if (c === '"' && b.charAt(i + 1) === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
        else if (c === '"') q = true;
        else if (c === sep) { out.push(cur); cur = ''; }
        else cur += c;
      }
      out.push(cur);
      return out;
    });
  }

  /** baris tabel (array of array) -> { data: {tanggal: {...}}, jumlah, galat: [] } */
  function bacaTabel(rows) {
    var norm = function (s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z]/g, ''); };
    var kolom = null, hi = -1;
    for (var r = 0; r < Math.min(rows.length, 15) && !kolom; r++) {
      var peta = {};
      rows[r].forEach(function (sel, i) {
        var n = norm(sel);
        for (var k in ALIAS) if (ALIAS[k].indexOf(n) >= 0 && peta[k] == null) peta[k] = i;
      });
      if (peta.tanggal != null && WAKTU.some(function (w) { return peta[w] != null; })) { kolom = peta; hi = r; }
    }
    if (!kolom) return { data: {}, jumlah: 0, galat: ['Baris judul tidak ditemukan. Pakai template: kolom Tanggal, Imsak, Subuh, Terbit, Dzuhur, Ashar, Maghrib, Isya.'] };
    var data = {}, galat = [], jumlah = 0;
    for (var i = hi + 1; i < rows.length; i++) {
      var row = rows[i];
      if (!row || row.every(function (x) { return x === '' || x == null; })) continue;
      var tg = keTanggal(row[kolom.tanggal]);
      if (!tg) { if (galat.length < 8) galat.push('Baris ' + (i + 1) + ': tanggal "' + row[kolom.tanggal] + '" tidak dikenali'); continue; }
      var isi = {}, ada = false;
      WAKTU.forEach(function (w) {
        if (kolom[w] == null) return;
        var m = keMenit(row[kolom[w]]);
        if (m == null) { if (row[kolom[w]] !== '' && row[kolom[w]] != null && galat.length < 8) galat.push('Baris ' + (i + 1) + ': jam ' + JUDUL[w] + ' "' + row[kolom[w]] + '" tidak dikenali'); return; }
        isi[w] = fmt(m); ada = true;
      });
      if (ada) { data[tg] = isi; jumlah++; }
    }
    return { data: data, jumlah: jumlah, galat: galat };
  }

  // --- Excel .xlsx: arsip zip berisi XML. Dibuka dengan DecompressionStream (browser HP/laptop modern).
  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }
  function bukaZip(buf) {
    var b = new Uint8Array(buf), e = -1;
    for (var i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (u32(b, i) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error('File bukan Excel (.xlsx) yang valid');
    var n = u16(b, e + 10), p = u32(b, e + 16), isi = {};
    for (var k = 0; k < n; k++) {
      if (u32(b, p) !== 0x02014b50) break;
      var metode = u16(b, p + 10), ukur = u32(b, p + 20), pn = u16(b, p + 28), pe = u16(b, p + 30), pk = u16(b, p + 32), lok = u32(b, p + 42);
      var nama = new TextDecoder().decode(b.subarray(p + 46, p + 46 + pn));
      var awal = lok + 30 + u16(b, lok + 26) + u16(b, lok + 28);
      isi[nama] = { metode: metode, data: b.subarray(awal, awal + ukur) };
      p += 46 + pn + pe + pk;
    }
    return isi;
  }
  function teksZip(ent) {
    if (!ent) return Promise.resolve(null);
    if (ent.metode === 0) return Promise.resolve(new TextDecoder().decode(ent.data));
    if (typeof DecompressionStream === 'undefined') return Promise.reject(new Error('Browser ini belum bisa membaca Excel. Simpan file sebagai CSV lalu unggah lagi.'));
    var s = new Blob([ent.data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(s).text();
  }
  function kolomKe(ref) { var m = /^([A-Z]+)/.exec(ref || 'A'), n = 0; for (var i = 0; i < m[1].length; i++) n = n * 26 + m[1].charCodeAt(i) - 64; return n - 1; }
  function bacaXlsx(buf) {
    var zip = bukaZip(buf);
    var lembar = zip['xl/worksheets/sheet1.xml'] ? 'xl/worksheets/sheet1.xml'
      : Object.keys(zip).filter(function (n) { return /^xl\/worksheets\/[^/]+\.xml$/.test(n); }).sort()[0];
    if (!lembar) throw new Error('Lembar kerja tidak ditemukan di file Excel');
    return Promise.all([teksZip(zip['xl/sharedStrings.xml']), teksZip(zip[lembar])]).then(function (t) {
      var dp = new DOMParser(), str = [];
      if (t[0]) {
        var si = dp.parseFromString(t[0], 'application/xml').getElementsByTagName('si');
        for (var i = 0; i < si.length; i++) {
          var ts = si[i].getElementsByTagName('t'), s = '';
          for (var j = 0; j < ts.length; j++) s += ts[j].textContent;
          str.push(s);
        }
      }
      var rows = [], rs = dp.parseFromString(t[1], 'application/xml').getElementsByTagName('row');
      for (var r = 0; r < rs.length; r++) {
        var cs = rs[r].getElementsByTagName('c'), row = [];
        for (var c = 0; c < cs.length; c++) {
          var el = cs[c], tipe = el.getAttribute('t'), v = el.getElementsByTagName('v')[0], val = '';
          if (tipe === 's') val = str[+(v && v.textContent)] || '';
          else if (tipe === 'inlineStr') { var it = el.getElementsByTagName('t'); val = it.length ? it[0].textContent : ''; }
          else if (tipe === 'str' || tipe === 'b') val = v ? v.textContent : '';
          else val = v ? parseFloat(v.textContent) : '';
          row[kolomKe(el.getAttribute('r'))] = val;
        }
        for (var x = 0; x < row.length; x++) if (row[x] === undefined) row[x] = '';
        rows.push(row);
      }
      return rows;
    });
  }

  /** File (CSV / XLSX) -> Promise { data, jumlah, galat } */
  function bacaFile(file) {
    var nama = (file.name || '').toLowerCase();
    if (/\.xls$/.test(nama)) return Promise.reject(new Error('Format .xls lama belum didukung. Di Excel pilih Simpan Sebagai → Excel Workbook (.xlsx) atau CSV.'));
    return new Promise(function (ok, gagal) {
      var fr = new FileReader();
      fr.onerror = function () { gagal(new Error('File tidak bisa dibaca')); };
      fr.onload = function () { ok(fr.result); };
      if (/\.xlsx$/.test(nama)) fr.readAsArrayBuffer(file); else fr.readAsText(file);
    }).then(function (isi) {
      return typeof isi === 'string' ? bacaTabel(pisahCsv(isi)) : bacaXlsx(isi).then(bacaTabel);
    });
  }

  global.MasjidJadwal = {
    WAKTU: WAKTU, JUDUL: JUDUL, kunci: kunci, keMenit: keMenit, keTanggal: keTanggal,
    hitung: hitung, jadwalHari: jadwalHari, templateCsv: templateCsv,
    bacaFile: bacaFile, bacaTabel: bacaTabel, pisahCsv: pisahCsv, bacaXlsx: bacaXlsx
  };
  if (typeof module !== 'undefined') module.exports = global.MasjidJadwal;
})(typeof window !== 'undefined' ? window : globalThis);
