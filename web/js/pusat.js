/* Sambungan ke server pusat LayarPintar (mis. https://tv.pintarinovasi.co.id).
   - Box meminta kode 6 angka; pengelola pusat memasangkan kode itu di panel admin.
   - Setelah tersambung: gambar/video/YouTube/teks dari pusat ikut bergilir di panel,
     pesan pusat tampil sebagai teks berjalan, sisipan, atau layar penuh.
   - Semua tetap jalan tanpa internet: pengaturan pusat terakhir & file media disimpan di box.
   - Jadwal sholat, iqomah, kas, pengajian tetap diatur pengurus dari HP seperti biasa.
   Ditulis ES5 agar jalan di WebView lama (Android 5–7). */
(function (global) {
  'use strict';

  var LS_CFG = 'masjidtv-pusat-cfg';
  var CACHE = 'masjidtv-pusat-media';
  var st = { aktif: false, server: '', key: '', code: '', name: '', paired: false, cfg: null, skew: 0, online: true, err: '', mulai: false };
  var onChange = function () {};
  var timer = null, statusTimer = null, ws = null, wsDelay = 5000, wsTimer = null;
  var blobs = {};          // url media -> blob URL dari simpanan box
  var penuhSampai = 0, penuhId = '';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function base() { return String(st.server || '').replace(/\/+$/, ''); }
  function abs(src) { return /^https?:/.test(src) ? src : base() + src; }
  function url(src) { var u = abs(src); return blobs[u] || u; }
  function sekarang() { return Date.now() + st.skew; }

  // ---------- jadwal tayang per jam (diatur di pusat: Layar TV > Ubah) ----------
  // Jam memakai zona waktu lokasi (WIB/WITA/WIT) dari jam server, tidak tergantung jam box.
  var ZONA = { WIB: 7, WITA: 8, WIT: 9 };
  function keMenit(t) { var p = String(t || '').split(':'), h = parseInt(p[0], 10), m = parseInt(p[1], 10); return isNaN(h) || isNaN(m) ? null : h * 60 + m; }
  function jamLokal() { var tz = ZONA[((st.cfg && st.cfg.location) || {}).tz] || 7; return new Date(sekarang() + tz * 3600e3); }
  // apakah jam lokal d masuk jadwal {hari, mulai, selesai}; boleh melewati tengah malam
  function cocokJam(j, d) {
    var hari = d.getUTCDay(), kemarin = (hari + 6) % 7, m = d.getUTCHours() * 60 + d.getUTCMinutes();
    var a = keMenit(j.mulai), b = keMenit(j.selesai), h = j.hari || [0, 1, 2, 3, 4, 5, 6];
    if (a == null || b == null) return false;
    return a < b ? (h.indexOf(hari) >= 0 && m >= a && m < b) : ((h.indexOf(hari) >= 0 && m >= a) || (h.indexOf(kemarin) >= 0 && m < b));
  }
  function jadwalAktif() {
    var daftar = (st.cfg && st.cfg.jadwal) || [], d = jamLokal();
    for (var n = 0; n < daftar.length; n++) if (cocokJam(daftar[n], d)) return daftar[n];
    return null;
  }
  // jadwal tanpa daftar putar (items null) hanya mengganti gambar layar
  function isiTayang() { var j = jadwalAktif(); return j && j.items ? j.items : (st.cfg && st.cfg.items) || []; }
  // gambar layar dari jadwal aktif (null = pakai Gambar layar biasa)
  function gambarJadwal() {
    if (!st.aktif || !st.paired) return null;
    var j = jadwalAktif();
    return j && j.gambar && j.gambar.length ? j.gambar.map(function (u) { return { url: abs(u) }; }) : null;
  }
  function lsGet(k) { try { return global.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) global.localStorage.removeItem(k); else global.localStorage.setItem(k, v); } catch (e) { } }

  function req(path, opt) {
    opt = opt || {};
    opt.headers = opt.headers || {};
    if (st.key) opt.headers['X-Device-Key'] = st.key;
    opt.cache = 'no-store';
    return fetch(base() + path, opt);
  }

  // ---------- mulai / berhenti (dipanggil setiap pengaturan lokal berubah) ----------
  function start(conf, cb) {
    if (cb) onChange = cb;
    var p = (conf && conf.pusat) || {};
    var aktif = !!p.aktif, server = p.server || 'https://tv.pintarinovasi.co.id';
    var diubahLama = st.lokal && st.lokal.diubah;
    st.lokal = conf; // pengaturan papan info di box (untuk sinkron dengan pusat)
    if (st.mulai && aktif === st.aktif && server === st.server) {
      // pengurus baru menyimpan dari HP: segera kirim ke pusat
      if (aktif && st.paired && conf && conf.diubah && conf.diubah !== diubahLama) muat();
      if (aktif && st.cfg) simpanMedia(); // gambar layar bisa berubah
      return;
    }
    stop();
    st.mulai = true; st.aktif = aktif; st.server = server;
    st.key = ''; st.code = ''; st.paired = false; st.cfg = null;
    if (!aktif) { onChange(); return; }
    try { var c = JSON.parse(lsGet(LS_CFG) || 'null'); if (c && c.server === server) { st.cfg = c.cfg; st.paired = true; } } catch (e) { }
    if (st.cfg) simpanMedia(); // menyala tanpa internet: pakai media yang sudah tersimpan di box
    global.MasjidStore.pusatGet().then(function (s) {
      if (s && s.server === server && s.key && s.key !== '(tersimpan)') { st.key = s.key; st.code = s.code || ''; st.name = s.name || ''; }
      muat();
    });
    statusTimer = setInterval(lapor, 60000);
    onChange();
  }

  function stop() {
    clearTimeout(timer); clearInterval(statusTimer); clearTimeout(wsTimer);
    if (ws) { ws.onclose = null; try { ws.close(); } catch (e) { } ws = null; }
  }

  function simpanKunci() {
    return global.MasjidStore.pusatSet({ server: st.server, key: st.key, code: st.code, name: st.name, paired: st.paired });
  }

  function lupakan() {
    st.key = ''; st.code = ''; st.name = ''; st.paired = false; st.cfg = null;
    lsSet(LS_CFG, null);
  }

  function mintaKode() {
    return fetch(base() + '/api/player/pair', { method: 'POST', cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('server ' + r.status); return r.json(); })
      .then(function (j) { st.key = j.key; st.code = j.code; st.paired = false; simpanKunci(); onChange(); });
  }

  // ---------- ambil pengaturan dari pusat ----------
  function muat() {
    clearTimeout(timer);
    // pengurus menekan "Putuskan" dari HP: kunci di box dihapus -> lupakan & minta kode baru
    global.MasjidStore.pusatGet().then(function (simpan) {
      if (st.key && !(simpan && simpan.key)) { lupakan(); onChange(); }
      muat2();
    }, muat2);
  }
  function muat2() {
    var jeda = 60000;
    var p;
    if (!st.key) {
      p = mintaKode().then(function () { jeda = 5000; });
    } else {
      p = req('/api/player/config').then(function (r) {
        if (r.status === 409) {
          return r.json().then(function (j) {
            if (j.status === 'menunggu') {
              jeda = 5000;
              if (st.code !== j.code || st.paired) { st.code = j.code; st.paired = false; simpanKunci(); onChange(); }
              return;
            }
            // layar dihapus di pusat / kunci tidak dikenal: minta kode baru
            lupakan();
            return mintaKode().then(function () { jeda = 5000; });
          });
        }
        if (!r.ok) throw new Error('server ' + r.status);
        return r.json().then(terima);
      });
    }
    p.then(function () { st.online = true; st.err = ''; }, function (e) { st.online = false; st.err = String((e && e.message) || e); jeda = Math.min(jeda, 30000); })
      .then(function () { timer = setTimeout(muat, jeda); });
  }

  function terima(c) {
    var lama = st.cfg && st.cfg.version;
    if (c.server_time) { var t = new Date(c.server_time).getTime(); if (!isNaN(t)) st.skew = t - Date.now(); }
    var baruTersambung = !st.paired || st.code;
    st.cfg = c;
    st.name = (c.screen && c.screen.name) || '';
    st.paired = true; st.code = '';
    if (baruTersambung) { simpanKunci(); setTimeout(lapor, 2000); }
    lsSet(LS_CFG, JSON.stringify({ server: st.server, cfg: c }));
    // layar diatur sebagai "TV promosi" di pusat: pindah ke pemutar promosi (aplikasi yang sama).
    // Hanya saat pusat terjangkau, agar box yang menyala tanpa internet tetap menampilkan papan ini.
    if (c.screen && c.screen.mode === 'promosi' && /\/index\.html$|\/$/.test(location.pathname)) {
      location.href = base() + '/putar/?kunci=' + encodeURIComponent(st.key) +
        '&kembali=' + encodeURIComponent(location.origin + '/index.html');
      return;
    }
    sambungWs();
    sinkronMasjid(c);
    if (lama !== c.version || baruTersambung) { simpanMedia(); onChange(); }
  }

  // ---------- pengaturan papan info: sama antara box dan pusat ----------
  // Yang terbaru menang: diubah dari pusat -> ditulis ke box; diubah dari HP pengurus -> dikirim ke pusat.
  // Tidak ikut disamakan: sambungan pusat, foto (file di box), dan koreksi jam box.
  var sedangKirim = false;
  function sinkronMasjid(c) {
    var loc = c.location, lokal = st.lokal;
    if (!loc || loc.kind !== 'masjid' || !lokal) return;
    var s = loc.settings || {}, P = +s.masjid_diubah || 0, L = +lokal.diubah || 0;
    var S = global.MasjidStore;
    if (s.masjid && P > L + 2000) {
      var baru = S.merge(S.clone(S.DEFAULTS), s.masjid);
      baru.pusat = lokal.pusat;
      if (lokal.tampilan && lokal.tampilan.foto) baru.tampilan.foto = lokal.tampilan.foto;
      if (lokal.sholat) baru.sholat.clockOffsetSec = lokal.sholat.clockOffsetSec || 0;
      baru.diubah = P;
      st.lokal = baru;
      S.terapkanPusat(baru); // layar memuat ulang pengaturan sendiri dalam ±10 detik
    } else if (L > 0 && (!s.masjid || L > P + 2000) && !sedangKirim) {
      // L = 0: box belum pernah diatur (masih data contoh) -> tidak dikirim ke pusat
      var kirim = S.clone(lokal);
      delete kirim.pusat; delete kirim.diubah;
      if (kirim.tampilan) delete kirim.tampilan.foto;
      if (kirim.sholat) delete kirim.sholat.clockOffsetSec;
      sedangKirim = true;
      req('/api/player/masjid', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: kirim, diubah: L || 1 }) })
        .then(function () { sedangKirim = false; }, function () { sedangKirim = false; });
      return;
    }
  }

  // ---------- perubahan langsung dari pusat ----------
  function sambungWs() {
    if (ws || !st.key || !global.WebSocket) return;
    try { ws = new WebSocket(base().replace(/^http/, 'ws') + '/api/player/ws?key=' + encodeURIComponent(st.key)); } catch (e) { return; }
    ws.onopen = function () { wsDelay = 5000; muat(); }; // perubahan saat belum tersambung tidak terlewat
    ws.onmessage = function (e) {
      if (e.data === 'ubah') muat();
      else if (e.data === 'muat_ulang') location.reload();
      else if (e.data === 'dihapus') { lupakan(); global.MasjidStore.pusatSet({}); onChange(); muat(); }
    };
    ws.onclose = function () {
      ws = null;
      clearTimeout(wsTimer);
      if (!st.aktif) return;
      wsTimer = setTimeout(sambungWs, wsDelay);
      wsDelay = Math.min(wsDelay * 2, 60000);
    };
  }

  // ---------- simpan file media di box (tetap tayang tanpa internet) ----------
  function daftarMedia() {
    var out = [];
    if (!st.cfg) return out;
    (st.cfg.items || []).forEach(function (i) { if (i.src) out.push(abs(i.src)); });
    (st.cfg.jadwal || []).forEach(function (j) {
      (j.items || []).forEach(function (i) { if (i.src) out.push(abs(i.src)); });
      (j.gambar || []).forEach(function (u) { out.push(abs(u)); });
    });
    // gambar layar pilihan (Tampilan > Gambar layar) ikut disimpan agar tampil saat offline
    var g = st.lokal && st.lokal.tampilan && st.lokal.tampilan.gambar;
    ((g && g.daftar) || []).forEach(function (x) { if (x && x.url) out.push(abs(x.url)); });
    (st.cfg.messages || []).forEach(function (m) { if (m.media && m.media.src) out.push(abs(m.media.src)); });
    return out;
  }
  function simpanMedia() {
    if (!global.caches || !global.Promise) return;
    var urls = daftarMedia();
    global.caches.open(CACHE).then(function (c) {
      return c.keys().then(function (ks) {
        return Promise.all(ks.filter(function (k) { return urls.indexOf(k.url) < 0; }).map(function (k) {
          if (blobs[k.url]) { URL.revokeObjectURL(blobs[k.url]); delete blobs[k.url]; }
          return c['delete'](k);
        }));
      }).then(function () {
        var i = 0, ada = false;
        function berikut() {
          if (i >= urls.length) { if (ada) onChange(); return; }
          var u = urls[i++];
          return c.match(u).then(function (hit) {
            if (hit) return hit;
            return fetch(u, { mode: 'cors' }).then(function (r) {
              if (!r.ok) return null;
              return c.put(u, r.clone()).then(function () { return r; });
            });
          }).then(function (r) {
            if (r && !blobs[u]) return r.blob().then(function (b) { blobs[u] = URL.createObjectURL(b); ada = true; });
          })['catch'](function () { }).then(berikut);
        }
        return berikut();
      });
    })['catch'](function () { });
  }

  // ---------- isi untuk layar ----------
  function aktifPesan(m) {
    var t = sekarang(), a = new Date(m.start).getTime(), b = m.end ? new Date(m.end).getTime() : Infinity;
    return a <= t && t < b && (!m.jadwal || cocokJam(m.jadwal, jamLokal()));
  }
  function pesan() { return st.aktif && st.cfg ? (st.cfg.messages || []).filter(aktifPesan) : []; }
  function butuhInternet(k) { return k === 'youtube' || k === 'web' || k === 'siaran'; }
  function ytHtml(id) {
    id = esc(id);
    return '<iframe src="https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&mute=1&controls=0&loop=1&playlist=' + id +
      '&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3" allow="autoplay; encrypted-media" frameborder="0"></iframe>';
  }

  function mediaHtml(it) {
    var internet = st.online && global.navigator.onLine !== false;
    if (butuhInternet(it.kind) && !internet) return null;
    if (it.kind === 'gambar') return '<figure class="pusat-media"><img src="' + esc(url(it.src)) + '" alt=""></figure>';
    if (it.kind === 'video') return '<figure class="pusat-media"><video src="' + esc(url(it.src)) + '"' + (it.poster ? ' poster="' + esc(url(it.poster)) + '"' : '') + ' autoplay muted playsinline loop></video></figure>';
    if (it.kind === 'youtube' && it.body && it.body.youtube_id) return '<figure class="pusat-media">' + ytHtml(it.body.youtube_id) + '</figure>';
    if (it.kind === 'web') return '<figure class="pusat-media"><iframe src="' + esc(it.url) + '" frameborder="0" sandbox="allow-scripts allow-same-origin"></iframe></figure>';
    if (it.kind === 'siaran') return '<figure class="pusat-media"><video src="' + esc(it.url) + '" autoplay muted playsinline></video></figure>';
    if (it.kind === 'teks') {
      var b = it.body || {};
      return '<div class="pusat-teks" style="background:' + esc(b.bg || 'transparent') + ';color:' + esc(b.color || 'inherit') + '">' +
        (b.title ? '<h3>' + esc(b.title) + '</h3>' : '') + '<p>' + esc(b.text) + '</p></div>';
    }
    return null;
  }

  function pesanHtml(m) {
    var media = m.media ? mediaHtml(m.media) : '';
    return '<div class="pusat-pesan p-' + esc(m.priority) + (media ? ' ada-media' : '') + '">' +
      (media ? '<div class="pp-media">' + media + '</div>' : '') +
      '<div class="pp-teks"><span class="pp-label">' + (m.priority === 'darurat' ? 'Pengumuman penting' : 'Pengumuman') + '</span>' +
      (m.title ? '<h3>' + esc(m.title) + '</h3>' : '') + (m.text ? '<p>' + esc(m.text) + '</p>' : '') + '</div></div>';
  }

  /** Panel tambahan dari pusat: [{html, detik, penuh, awal}] */
  function slides() {
    if (!st.aktif) return [];
    if (!st.paired && st.code) {
      return [{ awal: true, detik: 0, html: '<h3>Sambungkan ke pusat</h3><p class="announce">Kode pemasangan layar ini:</p>' +
        '<p class="pusat-kode">' + esc(st.code.slice(0, 3)) + ' ' + esc(st.code.slice(3)) + '</p>' +
        '<p class="announce">Pengelola pusat memasukkan kode ini di <b>' + esc(base().replace(/^https?:\/\//, '')) + '</b> → Layar TV → Pasangkan TV.</p>' }];
    }
    if (!st.cfg) return [];
    var out = [];
    isiTayang().forEach(function (it) {
      var h = mediaHtml(it);
      if (h) out.push({ html: h, detik: it.duration || 0, judul: it.title });
    });
    pesan().forEach(function (m) {
      if (m.display === 'sisipan' || (m.display === 'layar_penuh' && m.priority !== 'darurat')) {
        out.push({ html: pesanHtml(m), detik: m.duration || 15, penuh: m.display === 'layar_penuh' ? m.id : 0, judul: m.title || m.text });
      }
    });
    return out;
  }

  function ticker() {
    return pesan().filter(function (m) { return m.display === 'teks_berjalan' && m.text; })
      .map(function (m) { return (m.priority !== 'biasa' ? '📢 ' : '') + m.text; });
  }

  // pesan layar penuh (bukan darurat) tampil sesuai lama tampilnya saat gilirannya di panel
  function tampilPenuh(id, detik) {
    var m = pesan().filter(function (x) { return x.id === id; })[0];
    if (!m) return;
    penuhId = 'p' + id;
    penuhSampai = Date.now() + Math.max(3, detik || m.duration || 15) * 1000;
    var el = document.getElementById('pusatPenuh');
    if (el) { el.innerHTML = pesanHtml(m); el.setAttribute('data-id', penuhId); }
  }

  /** Dipanggil tiap detik oleh layar. mode = normal | pre | adzan | iqomah | sholat | jumat */
  function tick(mode) {
    var el = document.getElementById('pusatPenuh');
    if (!el) return;
    var boleh = mode === 'normal' || mode === 'pre'; // layar adzan/iqomah/sholat selalu didahulukan
    var d = pesan().filter(function (m) { return m.display === 'layar_penuh' && m.priority === 'darurat'; })[0];
    if (d && boleh) {
      if (el.getAttribute('data-id') !== 'd' + d.id) { el.innerHTML = pesanHtml(d); el.setAttribute('data-id', 'd' + d.id); }
      el.hidden = false;
      return;
    }
    if (boleh && Date.now() < penuhSampai && el.getAttribute('data-id') === penuhId) { el.hidden = false; return; }
    if (!el.hidden) { el.hidden = true; el.innerHTML = ''; el.removeAttribute('data-id'); }
  }

  var sedangTayang = '';
  function sedang(judul) { sedangTayang = String(judul || '').slice(0, 80); }

  function lapor() {
    if (!st.aktif || !st.key || !st.paired) return;
    global.MasjidStore.info().then(function (i) {
      return req('/api/player/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app: 'LayarPintar TV ' + (i.version || ''), version: st.cfg && st.cfg.version, item: (function () { var j = jadwalAktif(); return j ? '[' + (j.nama || j.mulai + '-' + j.selesai) + '] ' : ''; })() + sedangTayang,
          online: st.online, ua: String(navigator.userAgent).slice(0, 200), screen: screen.width + 'x' + screen.height,
        }),
      });
    })['catch'](function () { });
  }

  global.MasjidPusat = {
    start: start, slides: slides, ticker: ticker, tick: tick, tampilPenuh: tampilPenuh, sedang: sedang, url: url, gambarJadwal: gambarJadwal,
    status: function () { return { aktif: st.aktif, server: st.server, paired: st.paired, code: st.code, name: st.name, online: st.online, err: st.err }; },
  };
})(window);
