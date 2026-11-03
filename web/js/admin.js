/* Halaman pengaturan papan info masjid. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var HARI = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  var BULAN3 = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var WAJIB = [['subuh', 'Subuh'], ['dzuhur', 'Dzuhur'], ['ashar', 'Ashar'], ['maghrib', 'Maghrib'], ['isya', 'Isya']];

  var cfg = null, pin = '', server = false, dirty = false, current = 'masjid';
  var jmBulan = (function () { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() < 9 ? '0' : '') + (d.getMonth() + 1); })();
  var onTv = !!window.Android || /MasjidTV/.test(navigator.userAgent);
  if (MasjidStore.pusatAdmin) document.body.classList.add('mode-pusat');
  if (onTv) document.body.classList.add('on-tv');

  // ---------- util ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function get(path) { return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, cfg); }
  function set(path, v) {
    var ks = path.split('.'), o = cfg;
    for (var i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null) o[ks[i]] = {}; o = o[ks[i]]; }
    o[ks[ks.length - 1]] = v;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function markDirty() { dirty = true; $('saveBtn').classList.add('dirty'); $('saveBtn').textContent = 'Simpan perubahan'; kabariPusat('pratinjau'); }
  // dibuka dari panel pusat (dalam bingkai): kirim isi terbaru agar pratinjau layar langsung berubah
  var PUSAT = MasjidStore.pusatAdmin;
  function kabariPusat(jenis) {
    if (!PUSAT || window.parent === window) return;
    clearTimeout(kabariPusat._t);
    kabariPusat._t = setTimeout(function () {
      try { window.parent.postMessage({ masjidtv: jenis, config: cfg }, location.origin); } catch (e) { }
    }, jenis === 'pratinjau' ? 400 : 0);
  }
  // pratinjau baru dimuat ulang (mis. ganti jam): kirim lagi isi yang sedang diketik
  if (PUSAT) window.addEventListener('message', function (e) {
    if (e.origin === location.origin && e.data && e.data.masjidtv === 'minta' && cfg) kabariPusat('pratinjau');
  });
  function toast(msg, bad) {
    var t = $('toast'); t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, bad ? 5000 : 2600);
  }

  // ---------- pembuat isian ----------
  function field(o) {
    // o: {path, label, type, help, min, max, step, options, wide}
    var id = 'f_' + o.path.replace(/\./g, '_'), v = get(o.path), input;
    if (o.type === 'check') {
      return '<label class="check"><input type="checkbox" id="' + id + '" data-path="' + o.path + '" data-type="check"' + (v ? ' checked' : '') + '> ' + esc(o.label) + '</label>';
    }
    if (o.type === 'select') {
      input = '<select id="' + id + '" data-path="' + o.path + '" data-type="' + (o.num ? 'number' : 'text') + '">' +
        o.options.map(function (op) { return '<option value="' + esc(op[0]) + '"' + (String(v) === String(op[0]) ? ' selected' : '') + '>' + esc(op[1]) + '</option>'; }).join('') + '</select>';
    } else if (o.type === 'textarea') {
      input = '<textarea id="' + id + '" data-path="' + o.path + '" data-type="text">' + esc(v) + '</textarea>';
    } else {
      var t = o.type || 'text';
      input = '<input id="' + id + '" type="' + (t === 'number' ? 'number' : t) + '" data-path="' + o.path + '" data-type="' + (t === 'number' ? 'number' : 'text') + '"' +
        (o.min != null ? ' min="' + o.min + '"' : '') + (o.max != null ? ' max="' + o.max + '"' : '') + (o.step != null ? ' step="' + o.step + '"' : '') +
        (t === 'number' ? ' inputmode="decimal"' : '') + ' value="' + esc(v) + '">';
    }
    return '<div class="field' + (o.wide ? ' wide' : '') + '"><label for="' + id + '">' + esc(o.label) + '</label>' + input + (o.help ? '<small>' + esc(o.help) + '</small>' : '') + '</div>';
  }
  function group(title, desc, inner, wide) {
    return '<div class="group"><h3>' + esc(title) + '</h3>' + (desc ? '<p>' + esc(desc) + '</p>' : '') + '<div class="grid' + (wide ? ' wide' : '') + '">' + inner + '</div></div>';
  }

  // daftar berulang: pengajian, jumat, pengumuman, pesan, teks berjalan
  function rows(listPath, title, fields, emptyText, addLabel, extraAdd) {
    var list = get(listPath) || [];
    var html = '<div class="rows" data-list="' + listPath + '">';
    if (!list.length) html += '<div class="empty">' + esc(emptyText) + '</div>';
    list.forEach(function (item, i) {
      html += '<div class="row"><div class="row-head"><strong>' + esc(title(item, i)) + '</strong><div class="row-actions">' +
        '<button type="button" class="icon-btn" data-move="' + listPath + ':' + i + ':-1" aria-label="Naikkan">↑</button>' +
        '<button type="button" class="icon-btn" data-move="' + listPath + ':' + i + ':1" aria-label="Turunkan">↓</button>' +
        '<button type="button" class="icon-btn del" data-del="' + listPath + ':' + i + '" aria-label="Hapus">✕</button></div></div>' +
        '<div class="grid' + (fields.wide ? ' wide' : '') + '">' + fields.render(listPath + '.' + i, item) + '</div></div>';
    });
    html += '</div><div class="add-row"><button type="button" class="btn" data-add="' + listPath + '">' + esc(addLabel) + '</button>' + (extraAdd || '') + '</div>';
    return html;
  }

  // ---------- bagian-bagian ----------
  var SECTIONS = [
    { id: 'masjid', label: 'Masjid', render: renderMasjid },
    { id: 'sholat', label: 'Waktu sholat', render: renderSholat },
    { id: 'iqomah', label: 'Adzan & iqomah', render: renderIqomah },
    { id: 'pengajian', label: 'Pengajian', render: renderPengajian },
    { id: 'jumat', label: 'Petugas Jumat', render: renderJumat },
    { id: 'info', label: 'Pengumuman', render: renderInfo },
    { id: 'kas', label: 'Kas masjid', render: renderKas },
    { id: 'tampilan', label: 'Tampilan', render: renderTampilan },
    { id: 'pusat', label: 'Pusat', render: renderPusat },
    { id: 'sistem', label: 'Sistem', render: renderSistem }
  ].filter(function (s) {
    // dari panel pusat: bagian khusus box (PIN, jam box, sambungan pusat) tidak ditampilkan
    return !MasjidStore.pusatAdmin || (s.id !== 'pusat' && s.id !== 'sistem');
  });

  function renderMasjid() {
    return '<h2>Data masjid</h2><p class="section-intro">Nama dan alamat tampil di bagian atas layar. Koordinat dipakai untuk menghitung waktu sholat tanpa internet.</p>' +
      group('Identitas', '', field({ path: 'masjid.nama', label: 'Nama masjid' }) + field({ path: 'masjid.alamat', label: 'Alamat singkat' }), true) +
      group('Lokasi', 'Salin dari Google Maps: tekan lama titik masjid, lalu salin angka koordinatnya.',
        field({ path: 'masjid.lat', label: 'Lintang', type: 'number', step: 'any', help: 'Contoh: -6.3321582' }) +
        field({ path: 'masjid.lng', label: 'Bujur', type: 'number', step: 'any', help: 'Contoh: 106.7199787' }) +
        field({ path: 'masjid.tz', label: 'Zona waktu', type: 'select', num: true, options: [[7, 'WIB (UTC+7)'], [8, 'WITA (UTC+8)'], [9, 'WIT (UTC+9)']] }) +
        field({ path: 'masjid.elev', label: 'Ketinggian (meter)', type: 'number', min: 0, step: 1 })) +
      photoGroup() +
      '<div class="group"><h3>Waktu sholat 7 hari ke depan</h3><p>Periksa dan bandingkan dengan jadwal Kemenag setempat. Jika berbeda, atur di bagian Waktu sholat.</p><div id="preview"></div></div>';
  }

  function photoGroup() {
    var url = MasjidStore.photoUrl(cfg);
    return '<div class="group"><h3>Foto masjid</h3><p>Pakai foto masjid milik sendiri, misalnya hasil memotret dengan HP. Foto otomatis diperkecil sebelum dikirim ke box.</p>' +
      '<div class="photo-box">' + (url ? '<img id="photoPrev" src="' + esc(url) + '" alt="Foto masjid">' : '<div class="photo-empty">Belum ada foto</div>') + '</div>' +
      '<div class="btn-row" style="margin-top:0.8rem"><label class="btn" for="photoFile" tabindex="0">' + (url ? 'Ganti foto' : 'Pilih foto') + '</label>' +
      '<input type="file" id="photoFile" accept="image/*" hidden>' +
      (url ? '<button type="button" class="btn danger" id="photoDel">Hapus foto</button>' : '') + '</div>' +
      '<div class="grid" style="margin-top:0.8rem">' +
      field({ path: 'tampilan.foto.panel', label: 'Tampilkan di panel bergilir', type: 'check' }) +
      field({ path: 'tampilan.foto.latar', label: 'Jadikan latar layar (samar)', type: 'check' }) + '</div></div>';
  }

  function renderSholat() {
    var adj = WAJIB.slice(0, 1).concat([['terbit', 'Terbit']], WAJIB.slice(1));
    return '<h2>Perhitungan waktu sholat</h2><p class="section-intro">Bawaan memakai kriteria Kemenag RI. Biasanya cukup mengatur koreksi menit bila jadwal berbeda dengan jadwal resmi.</p>' +
      group('Koreksi per waktu (menit)', 'Isi angka positif untuk memundurkan, negatif untuk memajukan.',
        adj.map(function (p) { return field({ path: 'sholat.adjust.' + p[0], label: p[1], type: 'number', step: 1 }); }).join('')) +
      group('Kriteria', '',
        field({ path: 'sholat.ihtiyat', label: 'Ihtiyat (menit)', type: 'number', min: 0, max: 5, step: 1, help: 'Kemenag: 2' }) +
        field({ path: 'sholat.imsak', label: 'Imsak sebelum Subuh', type: 'number', min: 0, max: 20, step: 1, help: 'Menit, Kemenag: 10' }) +
        field({ path: 'sholat.fajr', label: 'Sudut Subuh (°)', type: 'number', step: 0.1, help: 'Kemenag: 20' }) +
        field({ path: 'sholat.isha', label: 'Sudut Isya (°)', type: 'number', step: 0.1, help: 'Kemenag: 18' }) +
        field({ path: 'sholat.asr', label: 'Waktu Ashar', type: 'select', num: true, options: [[1, "Syafi'i (umum di Indonesia)"], [2, 'Hanafi']] })) +
      group('Jam dan tanggal', '',
        field({ path: 'sholat.clockOffsetSec', label: 'Koreksi jam layar (detik)', type: 'number', step: 1, help: 'Jika jam box selisih dengan jam yang benar' }) +
        field({ path: 'sholat.hijriOffset', label: 'Koreksi tanggal Hijriah (hari)', type: 'number', min: -2, max: 2, step: 1, help: 'Sesuaikan dengan keputusan Kemenag' }) +
        field({ path: 'sholat.hijriMaghrib', label: 'Ganti tanggal Hijriah setelah Maghrib', type: 'check' })) +
      '<div class="group" id="jadwalManual"><h3>Jadwal manual dari tabel resmi</h3>' +
      '<p>Agar sama persis dengan jadwal Kemenag/MUI setempat, isi jadwal per tanggal: langsung di tabel di bawah, atau unduh template lalu unggah kembali (CSV atau Excel). Tanggal yang tidak diisi tetap dihitung otomatis.</p>' +
      '<div class="grid wide">' + field({ path: 'sholat.manualAktif', label: 'Pakai jadwal manual untuk tanggal yang sudah diisi', type: 'check' }) + '</div>' +
      '<div class="jm-alat"><div class="field"><label for="jmBulan">Bulan yang ditampilkan</label><input type="month" id="jmBulan" value="' + jmBulan + '"></div>' +
      '<div class="btn-row">' +
      (onTv ? '' : '<button type="button" class="btn" id="jmTplBulan">Unduh template bulan ini</button><button type="button" class="btn" id="jmTplTahun">Unduh template setahun</button>') +
      '<label class="btn primary" for="jmFile">Unggah CSV / Excel</label><input type="file" id="jmFile" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>' +
      '<button type="button" class="btn danger" id="jmHapus">Hapus jadwal manual bulan ini</button></div></div>' +
      '<p class="jm-info" id="jmInfo"></p><div id="jmTabel"></div>' +
      '<p class="jm-ket"><span class="jm-c manual">00:00</span> diisi manual · <span class="jm-c auto">00:00</span> hitungan otomatis. Ubah jam di tabel lalu tekan <b>Simpan</b>; kosongkan sel untuk kembali ke hitungan.</p></div>';
  }

  // ---------- jadwal manual: tabel per bulan ----------
  function jmHari(tg) { return (cfg.jadwalManual = cfg.jadwalManual || {})[tg]; }
  function renderJadwal() {
    var el = $('jmTabel'); if (!el) return;
    var p = jmBulan.split('-'), th = +p[0], bl = +p[1] - 1, W = MasjidJadwal.WAKTU;
    var html = '<div class="table-wrap jm"><table><thead><tr><th>Tanggal</th>' + W.map(function (w) { return '<th>' + MasjidJadwal.JUDUL[w] + '</th>'; }).join('') + '<th></th></tr></thead><tbody>';
    var hariIni = ymd(new Date()), isiBulan = 0;
    for (var d = new Date(th, bl, 1); d.getMonth() === bl; d = new Date(th, bl, d.getDate() + 1)) {
      var tg = ymd(d), man = jmHari(tg) || {}, auto = MasjidJadwal.hitung(cfg, d), adaMan = false;
      var sel = W.map(function (w) {
        var m = man[w] && MasjidJadwal.keMenit(man[w]) != null;
        if (m) adaMan = true;
        // kotak teks jam 24 jam (bukan type=time: di sebagian HP tampil AM/PM dan terlalu lebar)
        return '<td><input type="text" inputmode="numeric" maxlength="5" placeholder="hh:mm" class="jm-c ' + (m ? 'manual' : 'auto') + '" data-jm="' + tg + '|' + w + '" value="' + (m ? man[w] : PrayTime.fmt(auto[w])) + '" aria-label="' + MasjidJadwal.JUDUL[w] + ' ' + tg + '"></td>';
      }).join('');
      if (adaMan) isiBulan++;
      html += '<tr' + (tg === hariIni ? ' class="today"' : '') + '><td>' + HARI[d.getDay()].slice(0, 3) + ' ' + d.getDate() + '</td>' + sel +
        '<td>' + (adaMan ? '<button type="button" class="icon-btn" data-jmreset="' + tg + '" title="Kembali ke hitungan otomatis">↺</button>' : '') + '</td></tr>';
    }
    el.innerHTML = html + '</tbody></table></div>';
    renderJmInfo();
  }
  function renderJmInfo() {
    var el = $('jmInfo'); if (!el) return;
    var semua = Object.keys(cfg.jadwalManual || {}), isiBulan = semua.filter(function (tg) { return tg.slice(0, 7) === jmBulan; }).length;
    el.innerHTML = isiBulan ? '<b>' + isiBulan + ' hari</b> di bulan ini memakai jadwal manual (seluruhnya ' + semua.length + ' hari).'
      : 'Bulan ini memakai hitungan otomatis' + (semua.length ? ' (jadwal manual tersimpan untuk ' + semua.length + ' hari di bulan lain).' : '.');
  }
  function unduh(nama, isi) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([isi], { type: 'text/csv;charset=utf-8' }));
    a.download = nama; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function bindJadwal() {
    var b = $('jmBulan'); if (!b) return;
    b.onchange = function () { if (b.value) { jmBulan = b.value; renderJadwal(); } };
    var p = function () { return jmBulan.split('-').map(Number); };
    var tb = $('jmTplBulan'); if (tb) tb.onclick = function () { var x = p(); unduh('jadwal-sholat-' + jmBulan + '.csv', MasjidJadwal.templateCsv(cfg, x[0], x[1])); };
    var tt = $('jmTplTahun'); if (tt) tt.onclick = function () { var x = p(); unduh('jadwal-sholat-' + x[0] + '.csv', MasjidJadwal.templateCsv(cfg, x[0], 0)); };
    var f = $('jmFile'); if (f) f.onchange = function () {
      var file = f.files && f.files[0]; f.value = ''; if (!file) return;
      MasjidJadwal.bacaFile(file).then(function (r) {
        if (!r.jumlah) { toast(r.galat[0] || 'Tidak ada jadwal yang terbaca dari file.', true); return; }
        cfg.jadwalManual = cfg.jadwalManual || {};
        var tgs = Object.keys(r.data).sort();
        tgs.forEach(function (tg) { cfg.jadwalManual[tg] = r.data[tg]; });
        cfg.sholat.manualAktif = true;
        jmBulan = tgs[0].slice(0, 7);
        markDirty(); rerender();
        toast(r.jumlah + ' hari dimasukkan (' + tgs[0] + ' s.d. ' + tgs[tgs.length - 1] + ')' + (r.galat.length ? ', ' + r.galat.length + ' baris dilewati' : '') + '. Tekan Simpan.', r.galat.length > 0);
      }, function (e) { toast(e.message, true); });
    };
    var h = $('jmHapus'); if (h) h.onclick = function () {
      if (!armed(h, 'Tekan lagi untuk menghapus')) return;
      Object.keys(cfg.jadwalManual || {}).forEach(function (tg) { if (tg.slice(0, 7) === jmBulan) delete cfg.jadwalManual[tg]; });
      markDirty(); renderJadwal(); renderPreview();
    };
  }
  document.addEventListener('change', function (e) {
    var el = e.target, jm = el.dataset && el.dataset.jm; if (!jm) return;
    var p = jm.split('|'), day = jmHari(p[0]) || (cfg.jadwalManual[p[0]] = {});
    var menit = el.value.trim() ? MasjidJadwal.keMenit(el.value) : null;
    if (el.value.trim() && menit == null) { // salah ketik: kembalikan
      toast('Jam "' + el.value + '" tidak dikenali. Tulis seperti 04:25.', true);
      el.value = day[p[1]] || '';
    }
    if (menit != null) { day[p[1]] = PrayTime.fmt(menit); el.value = day[p[1]]; el.className = 'jm-c manual'; } else delete day[p[1]];
    if (!Object.keys(day).length) delete cfg.jadwalManual[p[0]];
    markDirty(); renderPreview(); renderJmInfo();
    if (!el.value) { // dikosongkan: tampilkan lagi jam hitungan
      var d = p[0].split('-');
      el.value = PrayTime.fmt(MasjidJadwal.hitung(cfg, new Date(+d[0], +d[1] - 1, +d[2]))[p[1]]);
      el.className = 'jm-c auto';
    }
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-jmreset]'); if (!b) return;
    delete cfg.jadwalManual[b.dataset.jmreset]; markDirty(); renderJadwal(); renderPreview();
  });

  function renderIqomah() {
    return '<h2>Adzan, iqomah, dan sholat</h2><p class="section-intro">Urutan di layar: pengingat menjelang adzan, layar adzan, hitung mundur iqomah, lalu layar gelap selama sholat.</p>' +
      group('Umum', '',
        field({ path: 'adzan.preMin', label: 'Pengingat menjelang adzan', type: 'number', min: 0, max: 60, step: 1, help: 'Menit sebelum waktu masuk' }) +
        field({ path: 'adzan.adzanMin', label: 'Lama layar adzan', type: 'number', min: 0, max: 15, step: 1, help: 'Menit' }) +
        field({ path: 'adzan.jumatMin', label: 'Lama layar khutbah Jumat', type: 'number', min: 10, max: 120, step: 1, help: 'Menit sejak waktu Dzuhur' }) +
        field({ path: 'adzan.beep', label: 'Bunyi tanda di akhir iqomah', type: 'check' })) +
      group('Hitung mundur iqomah (menit)', '', WAJIB.map(function (p) { return field({ path: 'adzan.iqomah.' + p[0], label: p[1], type: 'number', min: 0, max: 30, step: 1 }); }).join('')) +
      group('Layar gelap saat sholat (menit)', 'Selama sholat berjamaah layar diredupkan agar tidak mengganggu.',
        WAJIB.map(function (p) { return field({ path: 'adzan.sholatMin.' + p[0], label: p[1], type: 'number', min: 0, max: 30, step: 1 }); }).join(''));
  }

  var HARI_OPTS = [['1', 'Setiap Senin'], ['2', 'Setiap Selasa'], ['3', 'Setiap Rabu'], ['4', 'Setiap Kamis'], ['5', 'Setiap Jumat'], ['6', 'Setiap Sabtu'], ['0', 'Setiap Ahad'], ['tgl', 'Tanggal tertentu']];
  function renderPengajian() {
    return '<h2>Jadwal pengajian</h2><p class="section-intro">Layar menampilkan 3 pengajian terdekat. Pengajian rutin diulang tiap pekan; pengajian bertanggal tampil hingga 14 hari sebelumnya.</p>' +
      rows('pengajian', function (it) { return it.judul || 'Pengajian baru'; }, {
        render: function (p, it) {
          return field({ path: p + '.judul', label: 'Tema / nama kajian' }) +
            field({ path: p + '.pemateri', label: 'Pemateri' }) +
            field({ path: p + '.hari', label: 'Hari', type: 'select', options: HARI_OPTS }) +
            (it.hari === 'tgl' ? field({ path: p + '.tanggal', label: 'Tanggal', type: 'date' }) : '') +
            field({ path: p + '.jam', label: 'Waktu', help: "Contoh: 19:00 atau Ba'da Maghrib" });
        }
      }, 'Belum ada jadwal pengajian.', '+ Tambah pengajian');
  }

  function fmtTgl(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); if (!m) return ''; var d = new Date(+m[1], +m[2] - 1, +m[3]); return HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN3[d.getMonth()] + ' ' + d.getFullYear(); }
  function renderJumat() {
    return '<h2>Petugas sholat Jumat</h2><p class="section-intro">Layar menampilkan petugas Jumat terdekat. Jadwal yang sudah lewat otomatis tidak ditampilkan.</p>' +
      rows('jumat', function (it) { return fmtTgl(it.tanggal) || 'Jumat baru'; }, {
        render: function (p) {
          return field({ path: p + '.tanggal', label: 'Tanggal', type: 'date' }) +
            field({ path: p + '.khatib', label: 'Khatib' }) +
            field({ path: p + '.imam', label: 'Imam' }) +
            field({ path: p + '.muadzin', label: 'Muadzin' });
        }
      }, 'Belum ada jadwal petugas Jumat.', '+ Tambah Jumat berikutnya',
      '<button type="button" class="btn ghost" id="cleanJumat">Hapus jadwal yang sudah lewat</button>');
  }

  function renderInfo() {
    return '<h2>Pengumuman dan teks berjalan</h2><p class="section-intro">Pengumuman dan pesan tampil bergiliran di panel kanan. Teks berjalan tampil di bagian paling bawah layar.</p>' +
      '<div class="group"><h3>Teks berjalan</h3><p>Satu baris untuk satu kalimat.</p><div class="grid wide"><div class="field"><label for="runningText">Isi teks berjalan</label><textarea id="runningText" rows="6">' +
      esc((cfg.info.runningText || []).join('\n')) + '</textarea></div></div></div>' +
      '<div class="group"><h3>Pengumuman</h3>' + rows('info.pengumuman', function (it) { return it.judul || 'Pengumuman baru'; }, {
        wide: true,
        render: function (p) { return field({ path: p + '.judul', label: 'Judul' }) + field({ path: p + '.isi', label: 'Isi pengumuman', type: 'textarea' }); }
      }, 'Belum ada pengumuman.', '+ Tambah pengumuman') + '</div>' +
      '<div class="group"><h3>Pesan dan kutipan</h3>' + rows('info.pesan', function (it, i) { return 'Pesan ' + (i + 1); }, {
        wide: true,
        render: function (p) { return field({ path: p + '.teks', label: 'Isi pesan', type: 'textarea' }) + field({ path: p + '.sumber', label: 'Sumber', help: 'Contoh: HR. Muslim atau QS. Al-Baqarah: 153' }); }
      }, 'Belum ada pesan.', '+ Tambah pesan') + '</div>';
  }

  function renderKas() {
    var k = cfg.kas, saldo = (+k.saldoLalu || 0) + (+k.pemasukan || 0) - (+k.pengeluaran || 0);
    return '<h2>Laporan kas masjid</h2><p class="section-intro">Saldo akhir dihitung otomatis: saldo sebelumnya + pemasukan − pengeluaran.</p>' +
      group('', '', field({ path: 'kas.tampil', label: 'Tampilkan laporan kas di layar', type: 'check' }), true) +
      group('Angka laporan', 'Tulis angka saja tanpa titik, misalnya 1500000.',
        field({ path: 'kas.tanggal', label: 'Per tanggal', type: 'date' }) +
        field({ path: 'kas.saldoLalu', label: 'Saldo sebelumnya (Rp)', type: 'number', step: 1 }) +
        field({ path: 'kas.pemasukan', label: 'Pemasukan (Rp)', type: 'number', step: 1 }) +
        field({ path: 'kas.pengeluaran', label: 'Pengeluaran (Rp)', type: 'number', step: 1 })) +
      '<div class="group"><div class="callout">Saldo kas akhir: <code id="saldoAkhir">Rp ' + saldo.toLocaleString('id-ID') + '</code></div></div>' +
      group('', '', field({ path: 'kas.catatan', label: 'Catatan kecil', help: 'Contoh: Infaq Jumat pekan ini Rp 2.150.000' }), true);
  }

  function renderTampilan() {
    var pilih = cfg.tampilan.layout || 'klasik';
    var kartu = MasjidLayout.LAYOUTS.map(function (L) {
      return '<label class="lp' + (L.id === pilih ? ' on' : '') + '"><input type="radio" name="layout" value="' + L.id + '" data-path="tampilan.layout" data-type="text"' + (L.id === pilih ? ' checked' : '') + '>' +
        '<span class="lp-mini' + (L.id === 'tegak' ? ' tegak' : '') + '">' + L.kotak.map(function (k) {
          return '<i class="k-' + k[0] + '" style="left:' + k[1] + '%;top:' + k[2] + '%;width:' + k[3] + '%;height:' + k[4] + '%"></i>';
        }).join('') + '</span><b>' + esc(L.nama) + '</b><small>' + esc(L.ket) + '</small></label>';
    }).join('');
    return '<h2>Tampilan layar</h2><p class="section-intro">Pilih tata letak dan warna, tambahan seperti jam analog, Dhuha, pasaran, hitung mundur hari besar, serta siaran langsung Makkah/Madinah.</p>' +
      '<div class="group"><h3>Tata letak</h3><p>Ketuk salah satu, lalu tekan Simpan. Hasilnya bisa dilihat lewat tombol Lihat layar' + (PUSAT ? ' atau pratinjau di sebelah' : '') + '.</p><div class="lp-daftar">' + kartu + '</div></div>' +
      group('Tambahan di layar', '',
        field({ path: 'tampilan.analog', label: 'Jam analog', type: 'check' }) +
        field({ path: 'tampilan.dhuha', label: 'Waktu Dhuha', type: 'check' }) +
        field({ path: 'tampilan.pasaran', label: 'Pasaran Jawa (Legi, Pahing, …)', type: 'check' }) +
        field({ path: 'tampilan.acara', label: 'Hitung mundur hari besar Islam', type: 'check' })) +
      '<div class="group"><h3>Siaran langsung (YouTube)</h3><p>Tampil di tata letak Sinema, Kolom, Galeri, dan Tegak. Butuh internet; bila internet putus, layar memakai foto masjid. Suara mati kecuali dinyalakan.</p>' +
      '<div class="grid wide">' +
      field({ path: 'tampilan.live.aktif', label: 'Tampilkan siaran langsung', type: 'check' }) +
      field({ path: 'tampilan.live.url', label: 'Tautan YouTube (kanal atau video siaran)', help: 'Contoh kanal: https://www.youtube.com/channel/UC… — tautan kanal lebih awet karena siaran yang berganti tetap ikut.', wide: true }) +
      '</div><div class="btn-row" style="margin-top:0.8rem">' +
      '<button type="button" class="btn" data-live="UCos52azQNBgW63_9uDJoPDA">🕋 Makkah (KSA Qur\'an TV)</button>' +
      '<button type="button" class="btn" data-live="UCROKYPep-UuODNwyipe6JMw">🕌 Madinah (Saudi Sunnah TV)</button></div>' +
      '<div class="grid" style="margin-top:0.8rem">' + field({ path: 'tampilan.live.suara', label: 'Bunyikan suara siaran', type: 'check' }) + '</div></div>' +
      renderGambarLayar() +
      group('Umum', '',
        field({ path: 'tampilan.tema', label: 'Warna tema', type: 'select', options: [['zamrud', 'Hijau toska'], ['malam', 'Biru malam'], ['kayu', 'Coklat kayu'], ['samudra', 'Biru samudra & emas'], ['terang', 'Terang (ruangan cerah)']] }) +
        field({ path: 'tampilan.slideDetik', label: 'Ganti panel tiap (detik)', type: 'number', min: 5, max: 120, step: 1 }) +
        field({ path: 'tampilan.tampilkanAlamatAdmin', label: 'Tampilkan alamat pengaturan HP di layar', type: 'check' })) +
      group('Redup malam', 'Mengurangi silau dan menjaga umur TV saat masjid sepi.',
        field({ path: 'tampilan.redup.aktif', label: 'Aktifkan redup malam', type: 'check' }) +
        field({ path: 'tampilan.redup.mulai', label: 'Mulai', type: 'time' }) +
        field({ path: 'tampilan.redup.selesai', label: 'Selesai', type: 'time' }) +
        field({ path: 'tampilan.redup.persen', label: 'Kecerahan saat redup (%)', type: 'number', min: 15, max: 100, step: 5 }));
  }

  // ---------- gambar layar (tampil di layar besar bila siaran tidak tampil / offline) ----------
  function renderGambarLayar() {
    var g = cfg.tampilan.gambar = cfg.tampilan.gambar || { daftar: [], detik: 15 };
    g.daftar = g.daftar || [];
    var dipilih = g.daftar.map(function (x, i) {
      return '<div class="gl-item"><img src="' + esc(x.url) + '" alt=""><span>' + esc(x.judul || 'Gambar ' + (i + 1)) + '</span>' +
        '<button type="button" class="icon-btn del" data-glhapus="' + i + '" aria-label="Hapus">✕</button></div>';
    }).join('');
    return '<div class="group"><h3>Gambar layar</h3><p>Tampil di layar besar (tata letak Sinema, Kolom, Galeri, Tegak) bila siaran langsung tidak dipakai atau internet putus — misalnya foto masjid. Lebih dari satu gambar akan bergantian. Gambar disimpan di box, jadi tetap tampil saat offline.</p>' +
      '<div class="gl-daftar">' + (dipilih || '<div class="empty">Belum ada gambar. ' + (MasjidStore.photoUrl(cfg) ? 'Layar memakai Foto masjid.' : '') + '</div>') + '</div>' +
      (PUSAT ? '<h3 style="margin-top:1rem;font-size:0.95rem">Pilih dari Pustaka media pusat</h3><div class="gl-pustaka" id="glPustaka">Memuat…</div>'
        : '<div class="add-row"><input id="glUrl" placeholder="https://… alamat gambar (jpg/png)" style="flex:1;min-width:220px"><button type="button" class="btn" id="glTambah">Tambah gambar</button></div>' +
          '<p style="margin-top:0.5rem">Foto dari HP: unggah di bagian <b>Masjid → Foto masjid</b>. Gambar dari pustaka pusat dipilih oleh pengelola pusat.</p>') +
      '<div class="grid" style="margin-top:0.8rem">' + field({ path: 'tampilan.gambar.detik', label: 'Ganti gambar tiap (detik)', type: 'number', min: 5, max: 600, step: 1 }) + '</div></div>';
  }
  function bindGambarLayar() {
    var g = cfg.tampilan.gambar; if (!g) return;
    var hp = document.querySelectorAll('[data-glhapus]');
    for (var i = 0; i < hp.length; i++) hp[i].onclick = function () { g.daftar.splice(+this.getAttribute('data-glhapus'), 1); markDirty(); rerender(); };
    var tb = $('glTambah');
    if (tb) tb.onclick = function () {
      var u = ($('glUrl').value || '').trim();
      if (!/^https?:\/\//.test(u)) { toast('Alamat gambar harus diawali https://', true); return; }
      g.daftar.push({ url: u, judul: u.split('/').pop() }); markDirty(); rerender();
    };
    var el = $('glPustaka'); if (!el) return;
    fetch('/api/media', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (m) {
      var gbr = (m || []).filter(function (x) { return x.kind === 'gambar' && x.status === 'siap' && x.file; });
      if (!gbr.length) { el.innerHTML = '<div class="empty">Belum ada gambar di Pustaka media. Unggah dulu di menu Pustaka media.</div>'; return; }
      el.innerHTML = gbr.map(function (x) {
        var u = location.origin + '/media/' + x.file, on = g.daftar.some(function (d) { return d.url === u; });
        return '<button type="button" class="gl-pilih' + (on ? ' on' : '') + '" data-glurl="' + esc(u) + '" data-gljudul="' + esc(x.title) + '"><img src="' + esc(u) + '" alt=""><span>' + esc(x.title) + '</span></button>';
      }).join('');
      var b = el.querySelectorAll('[data-glurl]');
      for (var k = 0; k < b.length; k++) b[k].onclick = function () {
        var u = this.getAttribute('data-glurl'), ada = -1;
        g.daftar.forEach(function (d, n) { if (d.url === u) ada = n; });
        if (ada >= 0) g.daftar.splice(ada, 1); else g.daftar.push({ url: u, judul: this.getAttribute('data-gljudul') });
        markDirty(); rerender();
      };
    }, function () { el.textContent = 'Pustaka media tidak bisa dimuat.'; });
  }

  function renderPusat() {
    return '<h2>Sambungan ke pusat</h2><p class="section-intro">Bila masjid ini dikelola sebuah organisasi, pengelola pusat bisa mengirim pengumuman, gambar, video, dan YouTube ke layar ini. ' +
      'Jadwal sholat, iqomah, pengajian, petugas Jumat, dan kas tetap diatur dari sini.</p>' +
      group('Pengaturan', '',
        field({ path: 'pusat.aktif', label: 'Sambungkan layar ini ke pusat', type: 'check' }) +
        field({ path: 'pusat.server', label: 'Alamat server pusat', help: 'Biasanya tidak perlu diubah.', wide: true })) +
      '<div class="group"><h3>Status</h3><div class="callout" id="pusatInfo">Memeriksa…</div>' +
      '<div class="btn-row" style="margin-top:0.8rem"><button type="button" class="btn danger" id="pusatReset">Putuskan &amp; minta kode baru</button></div></div>' +
      '<div class="group"><h3>Cara menyambungkan</h3><ol class="steps"><li>Centang <b>Sambungkan layar ini ke pusat</b>, lalu tekan <b>Simpan</b>.</li>' +
      '<li>Kode 6 angka muncul di layar TV (dan di bagian Status di atas).</li>' +
      '<li>Kirim kode itu ke pengelola pusat. Setelah dipasangkan, konten dari pusat ikut tampil bergiliran.</li></ol>' +
      '<p>Tanpa internet, konten pusat yang sudah tersimpan di box tetap tampil (kecuali YouTube dan halaman web).</p></div>';
  }

  function renderPusatInfo() {
    var el = $('pusatInfo'); if (!el) return;
    if (!cfg.pusat || !cfg.pusat.aktif) { el.innerHTML = 'Tidak tersambung ke pusat.'; return; }
    MasjidStore.pusatGet().then(function (p) {
      if (p && p.paired && p.name) el.innerHTML = 'Tersambung ke pusat sebagai layar <b>' + esc(p.name) + '</b>.';
      else if (p && p.code) el.innerHTML = 'Menunggu dipasangkan. Kode pemasangan: <b style="font-size:1.4em;letter-spacing:0.1em">' + esc(p.code.slice(0, 3) + ' ' + p.code.slice(3)) + '</b>';
      else el.innerHTML = 'Belum ada kode. Pastikan pengaturan sudah disimpan dan box tersambung internet, lalu tunggu sebentar.';
    });
  }

  function renderSistem() {
    var nat = window.Android;
    return '<h2>Sistem</h2><p class="section-intro">PIN, cadangan data, dan pengaturan box.</p>' +
      '<div class="group"><h3>Atur dari HP</h3><div id="netInfo" class="callout">Memeriksa jaringan…</div></div>' +
      '<div class="group"><h3>Jam box</h3><p>Jika jam di TV salah (misalnya setelah listrik padam dan box tidak tersambung internet), samakan dengan jam HP ini.</p>' +
      '<div class="callout" id="clockInfo">Memeriksa jam box…</div><div class="btn-row" style="margin-top:0.8rem">' +
      (server && !onTv ? '<button type="button" class="btn primary" id="clockSync">Samakan jam box dengan HP ini</button>' : '') +
      (nat ? '<button type="button" class="btn" id="dateSettings">Buka pengaturan tanggal & jam</button>' : '') +
      '</div></div>' +
      (server ? '<div class="group"><h3>Layar tetap menyala</h3><p>Pemeriksaan pengaturan box yang bisa membuat layar TV mati sendiri.</p>' +
        '<div class="callout" id="powerInfo">Memeriksa pengaturan daya box…</div></div>' : '') +
      '<div class="group"><h3>Ganti PIN</h3><div class="grid">' +
      '<div class="field"><label for="pinOld">PIN lama</label><input id="pinOld" type="password" inputmode="numeric" maxlength="8"></div>' +
      '<div class="field"><label for="pinNew">PIN baru</label><input id="pinNew" type="password" inputmode="numeric" maxlength="8"><small>4 sampai 8 angka</small></div>' +
      '</div><div class="add-row"><button type="button" class="btn" id="pinBtn">Ganti PIN</button></div></div>' +
      '<div class="group"><h3>Cadangan data</h3><p>Simpan semua pengaturan ke file, atau pulihkan dari file cadangan.' + (onTv ? ' Untuk mengunduh cadangan, buka pengaturan ini dari HP.' : '') + '</p><div class="btn-row">' +
      (onTv ? '' : '<button type="button" class="btn" id="exportBtn">Unduh cadangan</button>') +
      '<label class="btn" for="importFile">Pulihkan dari file</label><input type="file" id="importFile" accept=".json,application/json" hidden>' +
      '<button type="button" class="btn danger" id="resetBtn">Kembalikan ke pengaturan awal</button></div></div>' +
      (nat ? '<div class="group"><h3>Box Android</h3><p>Untuk WiFi, suara, atau keluar dari mode papan info.</p><div class="btn-row">' +
        '<button type="button" class="btn" id="sysSettings">Buka pengaturan Android</button>' +
        '<button type="button" class="btn" id="reloadBtn">Muat ulang layar</button></div></div>' : '');
  }

  // ---------- isi dinamis ----------
  function renderPreview() {
    var el = $('preview'); if (!el) return;
    var m = cfg.masjid, s = cfg.sholat, d = new Date(), html = '<div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Imsak</th><th>Subuh</th><th>Terbit</th><th>Dzuhur</th><th>Ashar</th><th>Maghrib</th><th>Isya</th></tr></thead><tbody>';
    for (var i = 0; i < 7; i++) {
      var x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
      var t = MasjidJadwal.jadwalHari(cfg, x); // termasuk jadwal manual bila ada
      html += '<tr' + (i === 0 ? ' class="today"' : '') + '><td>' + HARI[x.getDay()] + ' ' + x.getDate() + ' ' + BULAN3[x.getMonth()] + '</td>' +
        ['imsak', 'subuh', 'terbit', 'dzuhur', 'ashar', 'maghrib', 'isya'].map(function (k) { return '<td>' + PrayTime.fmt(t[k]) + '</td>'; }).join('') + '</tr>';
    }
    el.innerHTML = html + '</tbody></table></div>';
  }

  function renderNet() {
    var el = $('netInfo'); if (!el) return;
    MasjidStore.info().then(function (i) {
      if (!i.server) { el.innerHTML = 'Ini mode pratinjau di browser. Setelah aplikasi dipasang di box, alamat pengaturan untuk HP muncul di sini.'; return; }
      if (!i.ip) { el.innerHTML = 'Box belum tersambung ke WiFi. Sambungkan box ke WiFi masjid agar bisa diatur dari HP.'; return; }
      el.innerHTML = 'Sambungkan HP ke WiFi yang sama dengan box, lalu buka alamat ini di browser HP:<br><code>http://' + esc(i.ip) + ':' + (i.port || 8080) + '</code>';
    });
  }

  function renderPowerInfo() {
    if (!$('powerInfo')) return;
    MasjidStore.info().then(function (i) {
      var el = $('powerInfo'); if (!el) return;
      var p = i.power;
      if (!p) { el.innerHTML = 'Pengaturan daya tidak bisa diperiksa. Perbarui aplikasi di box ke versi terbaru.'; return; }
      var D = MasjidStore.fmtDuration, risk = MasjidStore.sleepRisk(p), html = '';
      function row(label, v) { return label + ': <b>' + (v == null ? 'tidak ada di box ini' : v > 0 ? D(v) : 'tidak pernah') + '</b>'; }
      if (risk) {
        el.className = 'callout warn';
        html += '<p class="warn-title">Box diatur untuk tidur otomatis setelah ' + D(risk.ms) + ' tanpa tombol remote ditekan.</p>' +
          (risk.sure ? '<p>Pengaturan ini mengalahkan aplikasi, jadi papan info akan hilang dari layar.</p>'
                     : '<p>Di sebagian box pengaturan ini tetap membuat box tidur walaupun aplikasi sedang tampil.</p>') +
          '<p>Cara mematikan: buka pengaturan Android, lalu cari salah satu menu ini dan ubah ke <b>Never / Tidak pernah</b>:</p><ul>' +
          '<li>System → Power &amp; Energy → <i>When inactive / Turn off display</i></li>' +
          '<li>Device Preferences → Screen saver → <i>Put device to sleep</i></li>' +
          '<li>Pengaturan → <i>Auto sleep / Sleep timer</i></li></ul>' +
          '<p>Jika menunya tidak ada, dari komputer dengan adb:<br><code>adb shell settings put secure attentive_timeout -1</code><br><code>adb shell settings put secure sleep_timeout -1</code></p>';
      } else {
        el.className = 'callout ok';
        html += '<p class="ok-title">Pengaturan box tidak membuat box tidur otomatis.</p>';
      }
      html += '<p class="hint">' + row('Batas tidak aktif Android', p.attentiveTimeout) + ' · ' + row('Tidur otomatis box', p.sleepTimeout) + '</p>';
      if (p.lastOff) {
        var d = new Date(p.lastOff);
        html += '<p>Layar box terakhir mati: <b>' + pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + '</b>' +
          (p.offCount > 1 ? ' (' + p.offCount + ' kali tercatat)' : '') + '.</p>';
      } else {
        html += '<p>Layar box belum pernah mati sejak aplikasi berjalan. Jika layar TV tetap padam sendiri, kemungkinan besar TV-nya yang mati otomatis: matikan fitur <i>Eco / Auto Power Off / Auto Standby</i> di menu TV, dan <i>HDMI-CEC</i> bila perlu.</p>';
      }
      el.innerHTML = html;
    });
  }

  function renderClockInfo() {
    var el = $('clockInfo'); if (!el) return;
    if (!server) { el.innerHTML = 'Mode pratinjau di browser: jam mengikuti perangkat ini.'; return; }
    MasjidStore.clock().then(function (c) {
      if (!$('clockInfo')) return;
      var box = new Date(c.box || Date.now()), diff = Math.round(((c.box || Date.now()) - Date.now()) / 1000);
      var txt = 'Jam sistem box: <code>' + pad(box.getDate()) + '/' + pad(box.getMonth() + 1) + '/' + box.getFullYear() + ' ' + pad(box.getHours()) + ':' + pad(box.getMinutes()) + '</code>';
      if (c.synced) txt += '<br>Layar TV memakai jam yang sudah disamakan dari HP.';
      else if (Math.abs(diff) > 90) txt += '<br>Selisih dengan perangkat ini: ' + Math.round(diff / 60) + ' menit.';
      else txt += '<br>Jam box sudah sesuai dengan perangkat ini.';
      $('clockInfo').innerHTML = txt;
    });
  }

  // perkecil foto lewat canvas lalu jadikan JPEG
  function shrinkPhoto(file, maxSide, quality) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var sc = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * sc); c.height = Math.round(img.naturalHeight * sc);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        var dataUrl = c.toDataURL('image/jpeg', quality);
        if (c.toBlob) c.toBlob(function (b) { resolve({ blob: b, dataUrl: dataUrl }); }, 'image/jpeg', quality);
        else resolve({ blob: null, dataUrl: dataUrl });
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('File ini bukan gambar yang bisa dibaca')); };
      img.src = url;
    });
  }

  function saveNow(msg) {
    return MasjidStore.save(cfg, pin).then(function () {
      dirty = false; $('saveBtn').classList.remove('dirty'); $('saveBtn').textContent = 'Simpan';
      toast(msg);
    });
  }

  function show(id) {
    current = id;
    var sec = SECTIONS.filter(function (s) { return s.id === id; })[0] || SECTIONS[0];
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) { t.setAttribute('aria-selected', t.dataset.tab === sec.id ? 'true' : 'false'); });
    $('content').innerHTML = sec.render();
    renderPreview(); renderNet(); renderClockInfo(); renderPowerInfo(); renderPusatInfo(); renderJadwal(); bindJadwal();
    bindSpecial();
  }

  function rerender() {
    var y = window.scrollY, f = document.activeElement && document.activeElement.id;
    show(current); window.scrollTo(0, y);
    if (f && $(f)) $(f).focus();
  }

  // ---------- kejadian ----------
  document.addEventListener('input', function (e) {
    var el = e.target, path = el.dataset && el.dataset.path;
    if (el.id === 'runningText') {
      cfg.info.runningText = el.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean); markDirty(); return;
    }
    if (!path) return;
    var v = el.dataset.type === 'check' ? el.checked : el.dataset.type === 'number' ? (el.value === '' ? 0 : parseFloat(el.value)) : el.value;
    if (el.dataset.type === 'number' && isNaN(v)) return;
    set(path, v); markDirty();
    if (/^(masjid|sholat)\./.test(path)) renderPreview();
    if (/^kas\./.test(path) && $('saldoAkhir')) {
      var k = cfg.kas; $('saldoAkhir').textContent = 'Rp ' + ((+k.saldoLalu || 0) + (+k.pemasukan || 0) - (+k.pengeluaran || 0)).toLocaleString('id-ID');
    }
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.dataset && el.dataset.path && /\.hari$/.test(el.dataset.path)) rerender(); // tampilkan isian tanggal
    if (el.dataset && el.dataset.path && /^jumat\.\d+\.tanggal$/.test(el.dataset.path)) rerender();
  });

  document.addEventListener('click', function (e) {
    var b = e.target.closest('button, [data-tab]'); if (!b) return;
    if (b.dataset.tab) { show(b.dataset.tab); window.scrollTo(0, 0); return; }
    if (b.dataset.add) {
      var list = get(b.dataset.add) || [];
      list.push(newItem(b.dataset.add, list)); set(b.dataset.add, list); markDirty(); rerender();
      var rowsEl = document.querySelector('[data-list="' + b.dataset.add + '"] .row:last-child input, [data-list="' + b.dataset.add + '"] .row:last-child textarea');
      if (rowsEl) { rowsEl.focus(); rowsEl.scrollIntoView({ block: 'center' }); }
      return;
    }
    if (b.dataset.del) {
      var p = b.dataset.del.split(':'), l = get(p[0]);
      if (!armed(b, 'Hapus?')) return;
      l.splice(+p[1], 1); markDirty(); rerender(); return;
    }
    if (b.dataset.move) {
      var q = b.dataset.move.split(':'), arr = get(q[0]), i = +q[1], j = i + (+q[2]);
      if (j < 0 || j >= arr.length) return;
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp; markDirty(); rerender(); return;
    }
  });

  // konfirmasi dua kali tekan (tanpa dialog, nyaman untuk remote TV)
  function armed(btn, label) {
    if (btn.dataset.armed === '1') return true;
    var old = btn.textContent; btn.dataset.armed = '1'; btn.textContent = label;
    setTimeout(function () { if (btn.isConnected !== false) { btn.dataset.armed = ''; btn.textContent = old; } }, 3500);
    return false;
  }

  function newItem(listPath, list) {
    if (listPath === 'pengajian') return { hari: '1', tanggal: '', jam: "Ba'da Maghrib", judul: '', pemateri: '' };
    if (listPath === 'jumat') {
      // Jumat berikutnya setelah jadwal terakhir (atau setelah hari ini)
      var base = new Date(); base.setHours(0, 0, 0, 0);
      list.forEach(function (j) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(j.tanggal || ''); if (m) { var d = new Date(+m[1], +m[2] - 1, +m[3]); if (d >= base) base = new Date(d.getTime() + 864e5); } });
      while (base.getDay() !== 5) base.setDate(base.getDate() + 1);
      return { tanggal: ymd(base), khatib: '', imam: '', muadzin: '' };
    }
    if (listPath === 'info.pengumuman') return { judul: '', isi: '' };
    if (listPath === 'info.pesan') return { teks: '', sumber: '' };
    return {};
  }

  function bindSpecial() {
    bindGambarLayar();
    // tombol pintas siaran Makkah / Madinah
    var lv = document.querySelectorAll('[data-live]');
    for (var li = 0; li < lv.length; li++) lv[li].onclick = function () {
      cfg.tampilan.live = cfg.tampilan.live || {};
      cfg.tampilan.live.url = 'https://www.youtube.com/channel/' + this.getAttribute('data-live');
      cfg.tampilan.live.aktif = true;
      var L = MasjidLayout.cari(cfg.tampilan.layout);
      if (!L.media) cfg.tampilan.layout = 'kolom'; // siaran butuh tata letak berlayar besar
      markDirty(); rerender();
      toast(L.media ? 'Siaran diatur. Tekan Simpan.' : 'Siaran diatur; tata letak diganti ke Kolom agar siaran tampil. Tekan Simpan.');
    };
    // pilihan tata letak: tandai kartu yang dipilih
    var lp = document.querySelectorAll('input[name=layout]');
    for (var lj = 0; lj < lp.length; lj++) lp[lj].onchange = function () {
      cfg.tampilan.layout = this.value; markDirty();
      var semua = document.querySelectorAll('.lp');
      for (var k = 0; k < semua.length; k++) semua[k].className = 'lp' + (semua[k].querySelector('input').checked ? ' on' : '');
    };
    var c = $('cleanJumat');
    if (c) c.onclick = function () {
      var today = ymd(new Date()), before = cfg.jumat.length;
      cfg.jumat = cfg.jumat.filter(function (j) { return !j.tanggal || j.tanggal >= today; });
      if (cfg.jumat.length !== before) { markDirty(); rerender(); toast((before - cfg.jumat.length) + ' jadwal lama dihapus. Tekan Simpan.'); }
      else toast('Tidak ada jadwal yang sudah lewat.');
    };
    var pb = $('pinBtn');
    if (pb) pb.onclick = function () {
      var o = $('pinOld').value, n = $('pinNew').value;
      if (!/^\d{4,8}$/.test(n)) { toast('PIN baru harus 4 sampai 8 angka.', true); return; }
      MasjidStore.changePin(o, n).then(function () { pin = n; try { sessionStorage.setItem('masjidtv-pin', n); } catch (e) {} $('pinOld').value = ''; $('pinNew').value = ''; toast('PIN berhasil diganti.'); })
        .catch(function (e) { toast(e.message, true); });
    };
    var ex = $('exportBtn');
    if (ex) ex.onclick = function () {
      var blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'cadangan-papan-info-' + ymd(new Date()) + '.json'; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    };
    var im = $('importFile');
    if (im) im.onchange = function () {
      var f = im.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try {
          var data = JSON.parse(r.result);
          if (!data || typeof data !== 'object' || !data.masjid) throw new Error();
          cfg = MasjidStore.merge(MasjidStore.clone(MasjidStore.DEFAULTS), data); markDirty(); rerender();
          toast('Cadangan dimuat. Tekan Simpan untuk menerapkan.');
        } catch (e) { toast('File ini bukan cadangan papan info yang valid.', true); }
      };
      r.readAsText(f);
    };
    var rs = $('resetBtn');
    if (rs) rs.onclick = function () {
      if (!armed(rs, 'Tekan sekali lagi untuk mengembalikan semua isi ke awal')) return;
      cfg = MasjidStore.clone(MasjidStore.DEFAULTS); markDirty(); rerender(); toast('Dikembalikan ke awal. Tekan Simpan untuk menerapkan.');
    };
    var ss = $('sysSettings');
    if (ss) ss.onclick = function () { try { window.Android.openSystemSettings(); } catch (e) { toast('Tidak bisa membuka pengaturan Android.', true); } };
    var pf = $('photoFile');
    if (pf) pf.onchange = function () {
      var f = pf.files[0]; if (!f) return;
      toast('Memproses foto…');
      shrinkPhoto(f, server ? 1600 : 1200, server ? 0.82 : 0.72).then(function (r) {
        return MasjidStore.uploadPhoto(r.blob, r.dataUrl, pin);
      }).then(function () {
        cfg.tampilan.foto.ada = true; cfg.tampilan.foto.versi = Date.now();
        return saveNow(server ? 'Foto tersimpan dan tampil di layar TV.' : 'Foto tersimpan di browser ini.');
      }).then(function () { rerender(); })
        .catch(function (e) { toast(e.message || 'Foto gagal disimpan.', true); });
    };
    var pd = $('photoDel');
    if (pd) pd.onclick = function () {
      if (!armed(pd, 'Tekan lagi untuk menghapus')) return;
      MasjidStore.deletePhoto(pin).then(function () {
        cfg.tampilan.foto.ada = false; return saveNow('Foto dihapus.');
      }).then(function () { rerender(); }).catch(function (e) { toast(e.message, true); });
    };
    var cs = $('clockSync');
    if (cs) cs.onclick = function () {
      MasjidStore.syncClock(pin).then(function () { toast('Jam layar TV disamakan dengan HP ini.'); renderClockInfo(); })
        .catch(function (e) { toast(e.message, true); });
    };
    var ds = $('dateSettings');
    if (ds) ds.onclick = function () { try { window.Android.openDateSettings(); } catch (e) { toast('Pengaturan tanggal tidak bisa dibuka.', true); } };
    var rl = $('reloadBtn');
    if (rl) rl.onclick = function () { location.href = 'index.html'; };
  }

  $('saveBtn').addEventListener('click', function () {
    var b = $('saveBtn'); b.disabled = true;
    MasjidStore.save(cfg, pin).then(function () {
      dirty = false; b.classList.remove('dirty'); b.textContent = 'Simpan';
      toast(PUSAT ? 'Tersimpan di pusat. Semua layar di masjid ini ikut berubah dalam beberapa detik.'
        : server ? 'Tersimpan. Layar TV diperbarui dalam beberapa detik.' : 'Tersimpan di browser ini.');
      kabariPusat('tersimpan');
    }).catch(function (e) { toast(e.message || 'Gagal menyimpan.', true); })
      .then(function () { b.disabled = false; });
  });

  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  // ---------- remote TV: panah atas/bawah pindah antar isian ----------
  document.addEventListener('keydown', function (e) {
    var k = e.key;
    if (k !== 'ArrowDown' && k !== 'ArrowUp') return;
    var a = document.activeElement;
    if (a && (a.tagName === 'SELECT' || a.tagName === 'TEXTAREA')) return;
    var all = Array.prototype.filter.call(document.querySelectorAll('a[href], button:not([disabled]), input:not([type=hidden]):not([hidden]), select, textarea, label.btn'),
      function (el) { return el.offsetParent !== null; });
    var i = all.indexOf(a);
    var n = all[Math.max(0, Math.min(all.length - 1, i + (k === 'ArrowDown' ? 1 : -1)))];
    if (n) { e.preventDefault(); n.focus(); n.scrollIntoView({ block: 'nearest' }); }
  });

  // di TV: kembali ke layar jadwal bila 3 menit tidak disentuh
  if (onTv) {
    var idle = Date.now();
    ['keydown', 'click', 'input', 'touchstart'].forEach(function (ev) { document.addEventListener(ev, function () { idle = Date.now(); }, true); });
    setInterval(function () { if (Date.now() - idle > 180000) { dirty = false; location.href = 'index.html'; } }, 10000);
  }

  // ---------- masuk ----------
  function start() {
    $('login').hidden = true; $('app').hidden = false;
    $('tabs').innerHTML = SECTIONS.map(function (s) { return '<button type="button" class="tab" role="tab" data-tab="' + s.id + '">' + esc(s.label) + '</button>'; }).join('');
    $('appTitle').textContent = cfg.masjid.nama;
    $('modeNote').textContent = PUSAT ? 'Diatur dari pusat: berlaku untuk semua layar di masjid ini'
      : server ? 'Pengaturan papan info' : 'Mode pratinjau: tersimpan di browser ini';
    if (onTv) $('backBtn').textContent = 'Kembali ke layar';
    if (PUSAT) $('backBtn').style.display = 'none'; // pratinjau tampil di samping halaman ini
    show('masjid');
  }

  function tryLogin(p) {
    return MasjidStore.checkPin(p).then(function (ok) {
      if (!ok) return false;
      pin = p; try { sessionStorage.setItem('masjidtv-pin', p); } catch (e) {}
      return true;
    });
  }

  MasjidStore.load().then(function (r) {
    cfg = r.config; server = r.server;
    $('loginTitle').textContent = cfg.masjid.nama;
    if (PUSAT) { start(); kabariPusat('pratinjau'); return; } // sudah masuk lewat login pusat
    MasjidStore.info().then(function (i) {
      var lsPin = null; try { lsPin = localStorage.getItem('masjidtv-pin'); } catch (e) {}
      if ((i.server && i.defaultPin) || (!i.server && !lsPin)) $('loginHint').textContent = 'PIN awal: 1234. Segera ganti di bagian Sistem.';
    });
    var saved = null; try { saved = sessionStorage.getItem('masjidtv-pin'); } catch (e) {}
    (saved ? tryLogin(saved) : Promise.resolve(false)).then(function (ok) { if (ok) start(); else $('pin').focus(); });
  })['catch'](function (e) {
    // mode pusat: belum login / tidak berhak
    $('loginTitle').textContent = 'Tidak bisa membuka pengaturan';
    $('loginErr').textContent = e.message || String(e);
    $('loginForm').querySelector('button[type=submit]').hidden = true;
  });

  // ---------- lupa PIN ----------
  function showForgot() {
    $('loginForm').hidden = true; $('resetForm').hidden = false;
    MasjidStore.info().then(function (i) {
      var local = !i.server || i.onBox;
      var body = $('resetBody');
      if (!local) {
        body.innerHTML = '<p>Demi keamanan, PIN tidak bisa diatur ulang dari HP. Lakukan langsung di TV masjid:</p>' +
          '<ol class="steps"><li>Saat layar jadwal tampil, tekan <b>OK</b> di remote.</li>' +
          '<li>Pilih <b>Lupa PIN?</b> di bawah tombol Masuk.</li>' +
          '<li>Masukkan PIN baru dua kali, lalu pilih <b>Simpan PIN baru</b>.</li></ol>' +
          '<button type="button" class="btn" id="resetBack">Kembali</button>';
      } else {
        body.innerHTML = '<p>Buat PIN baru untuk pengaturan. Data papan info tidak berubah.</p>' +
          '<label for="newPin1">PIN baru</label><input id="newPin1" type="password" inputmode="numeric" maxlength="8">' +
          '<label for="newPin2">Ulangi PIN baru</label><input id="newPin2" type="password" inputmode="numeric" maxlength="8">' +
          '<p class="err" id="resetErr" role="alert"></p>' +
          '<button type="submit" class="btn primary" id="resetSave">Simpan PIN baru</button>' +
          '<button type="button" class="btn ghost" id="resetBack">Batal</button>';
        $('newPin1').focus();
      }
      $('resetBack').onclick = function () { $('resetForm').hidden = true; $('loginForm').hidden = false; $('pin').focus(); };
    });
  }
  $('forgotBtn').addEventListener('click', showForgot);
  $('resetForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var a = $('newPin1'), b = $('newPin2'); if (!a) return;
    if (!/^\d{4,8}$/.test(a.value)) { $('resetErr').textContent = 'PIN baru harus 4 sampai 8 angka.'; return; }
    if (a.value !== b.value) { $('resetErr').textContent = 'Kedua PIN tidak sama. Ketik ulang.'; b.value = ''; b.focus(); return; }
    MasjidStore.resetPin(a.value).then(function () { return tryLogin(a.value); })
      .then(function (ok) { if (ok) { start(); toast('PIN baru tersimpan.'); } })
      .catch(function (err) { $('resetErr').textContent = err.message; });
  });

  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    tryLogin($('pin').value).then(function (ok) {
      if (ok) start();
      else { $('loginErr').textContent = 'PIN salah. Coba lagi.'; $('pin').value = ''; $('pin').focus(); }
    }).catch(function () { $('loginErr').textContent = 'Tidak bisa menghubungi box. Periksa WiFi.'; });
  });
  // tombol "Putuskan & minta kode baru" di bagian Pusat
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#pusatReset'); if (!b) return;
    if (!armed(b, 'Yakin putuskan?')) return;
    MasjidStore.pusatReset(pin).then(function () {
      toast('Sambungan diputus. Kode baru muncul di layar TV dalam beberapa detik.');
      setTimeout(renderPusatInfo, 6000);
    }, function (err) { toast(err.message, true); });
  });
})();

