/* Logika layar papan info masjid. */
(function () {
  'use strict';

  var HARI = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var NAMA = { imsak: 'Imsak', subuh: 'Subuh', terbit: 'Terbit', dhuha: 'Dhuha', dzuhur: 'Dzuhur', ashar: 'Ashar', maghrib: 'Maghrib', isya: 'Isya', jumat: 'Jumat' };
  var ARAB = { imsak: 'الإمساك', subuh: 'الصبح', terbit: 'الشروق', dhuha: 'الضحى', dzuhur: 'الظهر', ashar: 'العصر', maghrib: 'المغرب', isya: 'العشاء', jumat: 'الجمعة' };
  var PASARAN = ['Legi', 'Pahing', 'Pon', 'Wage', 'Kliwon'];
  var ORDER = ['imsak', 'subuh', 'terbit', 'dzuhur', 'ashar', 'maghrib', 'isya'];
  var WAJIB = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'];

  var $ = function (id) { return document.getElementById(id); };
  var cfg = null, rawCfg = null, server = false;
  var simOffset = 0;      // untuk uji coba: ?sim=2026-10-30T11:35
  var syncOffset = 0;     // selisih jam bila sudah disamakan dari HP
  var synced = false;
  var simulated = false;
  var clockBad = false;
  var CLOCK_FLOOR = new Date(2026, 9, 1).getTime(); // jam sebelum tanggal ini pasti salah
  var LS_SEEN = 'masjidtv-lastseen';
  var cache = {};         // jadwal per tanggal
  var slides = [], slideIdx = 0, slideTimer = null;
  var lastDayKey = '', lastMode = '', lastTickerText = null;
  var startedAt = Date.now();

  // ---------- util ----------
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function now() { return new Date(Date.now() + simOffset + syncOffset + ((+cfg.sholat.clockOffsetSec || 0) * 1000)); }

  // ---------- pemeriksaan jam ----------
  // Box murah tanpa baterai jam bisa kembali ke tanggal lama setelah listrik padam.
  // Jika jam terlihat mundur atau terlalu lama, jadwal disembunyikan dan
  // muncul petunjuk cara membetulkannya.
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  function checkClock(d) {
    var t = d.getTime();
    if (t < CLOCK_FLOOR) return true;
    if (simulated) return false;
    // jam yang disamakan dari HP dianggap benar
    if (synced) { lsSet(LS_SEEN, String(t)); return false; }
    var seen = +lsGet(LS_SEEN) || 0;
    if (seen && t < seen - 10 * 60000) return true;
    if (t > seen + 60000) lsSet(LS_SEEN, String(t));
    return false;
  }
  function renderClockBad(d) {
    var ov = $('overlay');
    ov.hidden = false;
    ov.className = 'overlay mode-clock';
    $('ovArab').textContent = '';
    $('ovTitle').textContent = 'Jam di box belum benar';
    $('ovBig').textContent = '';
    $('ovBar').parentNode.classList.add('off');
    var nat = !!window.Android, hint = $('adminHint').textContent.replace('Pengaturan dari HP: ', '');
    $('ovSub').innerHTML = 'Box menunjukkan <b>' + tglPanjang(d) + ', ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) +
      '</b>. Jadwal sholat disembunyikan sementara agar jamaah tidak keliru.' +
      '<ol class="fix">' +
      (nat ? '<li>Tekan <b>OK</b> di remote untuk membuka pengaturan tanggal dan jam.</li>' : '<li>Atur tanggal dan jam di pengaturan perangkat.</li>') +
      '<li>Atau sambungkan box ke WiFi atau hotspot HP sebentar, jam akan menyesuaikan sendiri.</li>' +
      '<li>Atau buka pengaturan dari HP' + (hint ? ' (<b>' + esc(hint) + '</b>)' : '') + ', lalu pilih <b>Sistem → Samakan jam</b>.</li></ol>';
    $('ovClock').textContent = '';
  }
  function dayKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function parseDate(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function tglPanjang(d) { return HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear(); }
  // pasaran Jawa (Legi, Pahing, Pon, Wage, Kliwon): 22 Oktober 2025 = Rabu Pahing
  function pasaran(d) {
    var hari = Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(2025, 9, 22)) / 864e5);
    return PASARAN[(((1 + hari) % 5) + 5) % 5];
  }
  function tglPendek(d) { return d.getDate() + ' ' + BULAN[d.getMonth()].slice(0, 3); }
  function rupiah(n) { n = Math.round(+n || 0); return 'Rp ' + (n < 0 ? '-' : '') + Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function dur(sec) {
    sec = Math.max(0, Math.floor(sec));
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return (h ? h + ':' + pad(m) : m) + ':' + pad(s);
  }

  function times(d) {
    var k = dayKey(d);
    if (!cache[k]) {
      var s = cfg.sholat, m = cfg.masjid;
      // jadwal manual (dari tabel resmi) bila diisi untuk tanggal ini, selain itu dihitung
      cache[k] = MasjidJadwal.jadwalHari(cfg, d);
    }
    return cache[k];
  }

  // ---------- status (normal / menjelang / adzan / iqomah / sholat / jumat) ----------
  function status(d) {
    var t = times(d);
    var sec = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
    var a = cfg.adzan, jumat = d.getDay() === 5;
    for (var i = 0; i < WAJIB.length; i++) {
      var p = WAJIB[i], T = t[p] * 60;
      var isJumat = jumat && p === 'dzuhur';
      var pre = (+a.preMin || 0) * 60, adz = (+a.adzanMin || 0) * 60;
      var iq = (+a.iqomah[p] || 0) * 60, sh = (+a.sholatMin[p] || 0) * 60;
      if (sec >= T - pre && sec < T) return { mode: 'pre', p: isJumat ? 'jumat' : p, left: T - sec };
      if (isJumat) {
        var J = (+a.jumatMin || 0) * 60;
        if (sec >= T && sec < T + J) return { mode: 'jumat', p: 'jumat', start: T, end: T + J, sec: sec };
        continue;
      }
      if (sec >= T && sec < T + adz) return { mode: 'adzan', p: p, left: T + adz - sec };
      if (sec >= T + adz && sec < T + adz + iq) return { mode: 'iqomah', p: p, left: T + adz + iq - sec, total: iq };
      if (sec >= T + adz + iq && sec < T + adz + iq + sh) return { mode: 'sholat', p: p };
    }
    return { mode: 'normal' };
  }

  function nextPrayer(d) {
    var t = times(d), mins = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
    var list = ['imsak', 'subuh', 'terbit', 'dzuhur', 'ashar', 'maghrib', 'isya'];
    for (var i = 0; i < list.length; i++) if (t[list[i]] > mins) return { p: list[i], at: t[list[i]], tomorrow: false };
    var tm = new Date(d); tm.setDate(tm.getDate() + 1);
    return { p: 'imsak', at: times(tm).imsak + 1440, tomorrow: true };
  }

  // ---------- render bagian tetap ----------
  function renderHeader(d) {
    $('nama').textContent = cfg.masjid.nama;
    $('alamat').textContent = cfg.masjid.alamat;
    $('masehi').textContent = cfg.tampilan.pasaran
      ? HARI[d.getDay()] + ' ' + pasaran(d) + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear()
      : tglPanjang(d);
    renderAcara(d);
    var t = times(d), hd = new Date(d);
    var mins = d.getHours() * 60 + d.getMinutes();
    if (cfg.sholat.hijriMaghrib && mins >= t.maghrib) hd.setDate(hd.getDate() + 1);
    $('hijriah').textContent = Hijri.toHijri(hd, cfg.sholat.hijriOffset).text;
  }

  function renderTimes(d) {
    var t = times(d), mins = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
    var nx = nextPrayer(d), jumat = d.getDay() === 5, html = '';
    var urut = cfg.tampilan.dhuha ? ORDER.slice(0, 3).concat(['dhuha'], ORDER.slice(3)) : ORDER;
    urut.forEach(function (p) {
      var key = (p === 'dzuhur' && jumat) ? 'jumat' : p;
      var cls = 'arch w-' + p;
      if (p === 'imsak' || p === 'terbit' || p === 'dhuha') cls += ' minor';
      if (!nx.tomorrow && nx.p === p) cls += ' next';
      else if (t[p] <= mins) cls += ' past';
      if (nx.tomorrow && p === 'imsak') cls = 'arch minor next';
      html += '<div class="' + cls + '"><span class="ar">' + ARAB[key] + '</span><span class="nm">' + NAMA[key] +
        '</span><span class="tm">' + PrayTime.fmt(t[p]) + '</span></div>';
    });
    $('times').innerHTML = html;
  }

  function renderTicker() {
    var items = (cfg.info.runningText || []).filter(function (s) { return String(s).trim(); });
    if (window.MasjidPusat) items = items.concat(MasjidPusat.ticker()); // teks berjalan dari pusat
    var text = items.join('\u0000');
    if (text === lastTickerText) return;
    lastTickerText = text;
    var el = $('ticker');
    el.innerHTML = items.map(esc).join('<span class="sep">✦</span>');
    // kecepatan konstan ± 9 rem/detik, apa pun panjang teksnya
    requestAnimationFrame(function () {
      var rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 20;
      var w = el.scrollWidth / rem;
      el.style.webkitAnimationDuration = el.style.animationDuration = Math.max(20, w / 9) + 's';
    });
  }

  // ---------- panel bergilir ----------
  function upcomingPengajian(d) {
    var today = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var out = [];
    (cfg.pengajian || []).forEach(function (k) {
      if (!k || !k.judul) return;
      var when = null;
      if (k.hari === 'tgl') {
        when = parseDate(k.tanggal);
        if (!when || when < today || (when - today) / 864e5 > 14) return;
      } else {
        var h = +k.hari; if (isNaN(h)) return;
        when = new Date(today); when.setDate(today.getDate() + ((h - today.getDay() + 7) % 7));
      }
      out.push({ k: k, when: when, diff: Math.round((when - today) / 864e5) });
    });
    out.sort(function (a, b) { return a.diff - b.diff || String(a.k.jam).localeCompare(String(b.k.jam)); });
    return out.slice(0, 3);
  }

  function nextJumat(d) {
    var today = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var t = times(d), mins = d.getHours() * 60 + d.getMinutes();
    var selesai = t.dzuhur + (+cfg.adzan.jumatMin || 0);
    var list = (cfg.jumat || []).map(function (j) { return { j: j, d: parseDate(j.tanggal) }; })
      .filter(function (x) {
        if (!x.d || x.d < today) return false;
        if (x.d.getTime() === today.getTime() && mins >= selesai) return false;
        return true;
      })
      .sort(function (a, b) { return a.d - b.d; });
    return list[0] || null;
  }

  function buildSlides(d) {
    var s = [];
    var pg = upcomingPengajian(d);
    if (pg.length) {
      s.push('<h3>Jadwal pengajian</h3><ul class="list">' + pg.map(function (x) {
        var lbl = x.diff === 0 ? 'Hari ini' : x.diff === 1 ? 'Besok' : HARI[x.when.getDay()];
        return '<li' + (x.diff === 0 ? ' class="today"' : '') + '><span class="d">' + lbl + '<small>' + esc(x.k.jam) + '</small></span>' +
          '<div><div class="t">' + esc(x.k.judul) + '</div>' + (x.k.pemateri ? '<div class="p">' + esc(x.k.pemateri) + '</div>' : '') + '</div></li>';
      }).join('') + '</ul>');
    }
    var nj = nextJumat(d);
    if (nj) {
      var today = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      var isToday = nj.d.getTime() === today.getTime();
      s.push('<h3>Petugas sholat Jumat</h3><p class="when">' + (isToday ? 'Hari ini, ' : '') + tglPanjang(nj.d) + '</p><dl class="petugas">' +
        (nj.j.khatib ? '<div><dt>Khatib</dt><dd>' + esc(nj.j.khatib) + '</dd></div>' : '') +
        (nj.j.imam ? '<div><dt>Imam</dt><dd>' + esc(nj.j.imam) + '</dd></div>' : '') +
        (nj.j.muadzin ? '<div><dt>Muadzin</dt><dd>' + esc(nj.j.muadzin) + '</dd></div>' : '') + '</dl>');
    }
    (cfg.info.pengumuman || []).forEach(function (p) {
      if (p && (p.judul || p.isi)) s.push('<h3>' + esc(p.judul || 'Pengumuman') + '</h3><p class="announce">' + esc(p.isi) + '</p>');
    });
    var k = cfg.kas;
    if (k && k.tampil) {
      var saldo = (+k.saldoLalu || 0) + (+k.pemasukan || 0) - (+k.pengeluaran || 0);
      var tg = parseDate(k.tanggal);
      s.push('<h3>Laporan kas masjid</h3>' + (tg ? '<p class="when">Per ' + tglPanjang(tg) + '</p>' : '') +
        '<div class="kas"><div><span>Saldo sebelumnya</span><b>' + rupiah(k.saldoLalu) + '</b></div>' +
        '<div><span>Pemasukan</span><b>' + rupiah(k.pemasukan) + '</b></div>' +
        '<div><span>Pengeluaran</span><b>' + rupiah(k.pengeluaran) + '</b></div>' +
        '<div class="total"><span>Saldo kas</span><b>' + rupiah(saldo) + '</b></div>' +
        (k.catatan ? '<p class="note">' + esc(k.catatan) + '</p>' : '') + '</div>');
    }
    (cfg.info.pesan || []).forEach(function (q) {
      if (q && q.teks) s.push('<p class="quote">' + esc(q.teks) + '</p>' + (q.sumber ? '<p class="quote-src">' + esc(q.sumber) + '</p>' : ''));
    });
    var foto = MasjidStore.photoUrl(cfg);
    if (foto && cfg.tampilan.foto.panel) {
      s.unshift('<figure class="foto"><img src="' + esc(foto) + '" alt="Foto ' + esc(cfg.masjid.nama) + '"></figure>');
    }
    // konten & pesan dari server pusat (bila disambungkan)
    if (window.MasjidPusat) MasjidPusat.slides().forEach(function (p) {
      var h = '<div class="pusat-slide" data-durasi="' + (p.detik || 0) + '"' + (p.penuh ? ' data-penuh="' + p.penuh + '"' : '') +
        ' data-judul="' + esc(p.judul || '') + '">' + p.html + '</div>';
      if (p.awal) s.unshift(h); else s.push(h);
    });
    if (!s.length) s.push('<h3>' + esc(cfg.masjid.nama) + '</h3><p class="announce">Isi jadwal pengajian dan pengumuman lewat menu Pengaturan.</p>');
    return s;
  }

  // Bila isi slide lebih tinggi dari panel (mis. laporan kas dengan catatan,
  // pengumuman panjang, atau layar box yang bukan 16:9), perkecil seluruh isinya
  // supaya baris terakhir — seperti saldo kas — tidak terpotong.
  function scaleFit(f, s) {
    var t = s < 1 ? 'scale(' + s + ')' : '';
    f.style.width = s < 1 ? (100 / s) + '%' : '';
    f.style.webkitTransform = t;
    f.style.transform = t;
  }
  function fitSlide(el) {
    var f = el.firstChild;
    if (!f || f.className !== 'fit') return;
    scaleFit(f, 1);
    var avail = el.clientHeight, h = f.offsetHeight, s = 1;
    if (!avail || !h || h <= avail) return;
    for (var n = 0; n < 4 && h * s > avail; n++) {
      s = Math.max(0.5, avail / h);
      scaleFit(f, s);
      h = f.offsetHeight;
      if (s === 0.5) break;
    }
  }

  function showSlide(i) {
    var el = $('slide');
    slideIdx = (i + slides.length) % slides.length;
    el.classList.add('out');
    setTimeout(function () {
      el.innerHTML = '<div class="fit">' + slides[slideIdx] + '</div>';
      fitSlide(el);
      if (window.MasjidPusat) {
        var pp = /data-penuh="(\d+)"/.exec(slides[slideIdx]), jd = /data-judul="([^"]*)"/.exec(slides[slideIdx]);
        MasjidPusat.sedang(jd ? jd[1] : '');
        if (pp) MasjidPusat.tampilPenuh(+pp[1], slideSec(slideIdx));
      }
      el.classList.remove('out');
      // ulangi setelah huruf selesai dimuat (ukuran teks bisa berubah)
      setTimeout(function () { fitSlide(el); }, 1500);
    }, 600);
    $('dots').innerHTML = slides.length > 1 ? slides.map(function (_, j) { return '<i' + (j === slideIdx ? ' class="on"' : '') + '></i>'; }).join('') : '';
  }

  function refreshSlides(force) {
    var d = now(), fresh = buildSlides(d);
    var changed = force || fresh.join('|') !== slides.join('|');
    slides = fresh;
    if (changed) showSlide(Math.min(slideIdx, slides.length - 1));
  }

  // lama tampil per panel: bawaan dari pengaturan; konten pusat (mis. video) membawa lamanya sendiri
  function slideSec(i) {
    var m = /data-durasi="(\d+)"/.exec(slides[i] || '');
    var dasar = Math.max(5, +cfg.tampilan.slideDetik || 12);
    return m && +m[1] > 0 ? Math.max(3, +m[1]) : dasar;
  }
  function startSlideTimer() {
    clearTimeout(slideTimer);
    slideTimer = setTimeout(function () {
      refreshSlides(false);
      if (slides.length > 1) showSlide(slideIdx + 1);
      startSlideTimer();
    }, slideSec(slideIdx) * 1000 + 600);
  }

  // ---------- layar penuh ----------
  function overlay(st, d) {
    var ov = $('overlay');
    if (st.mode === 'normal' || st.mode === 'pre') { ov.hidden = true; ov.className = 'overlay'; return; }
    ov.hidden = false;
    var name = NAMA[st.p], bar = $('ovBar').parentNode;
    ov.className = 'overlay mode-' + st.mode;
    $('ovArab').textContent = st.mode === 'sholat' ? '' : ARAB[st.p];
    $('ovClock').textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    bar.classList.add('off');
    if (st.mode === 'adzan') {
      $('ovTitle').textContent = 'Waktunya adzan ' + name;
      $('ovBig').textContent = '';
      $('ovSub').innerHTML = 'Mari jawab adzan, lalu berdoa di antara adzan dan iqomah.';
    } else if (st.mode === 'iqomah') {
      $('ovTitle').textContent = 'Iqomah sholat ' + name;
      $('ovBig').textContent = dur(st.left);
      bar.classList.remove('off');
      $('ovBar').style.width = (100 * (1 - st.left / st.total)) + '%';
      ov.classList.toggle('final', st.left <= 30);
      $('ovSub').innerHTML = st.left <= 60 ? '<b>Luruskan dan rapatkan shaf.</b> Mohon matikan atau senyapkan HP.' : 'Silakan sholat sunnah sambil menunggu iqomah.';
      beepIqomah(st.left);
    } else if (st.mode === 'sholat') {
      $('ovTitle').textContent = 'Sholat ' + name + ' sedang berlangsung';
      $('ovBig').textContent = '';
      $('ovSub').innerHTML = 'Mohon tenang dan senyapkan HP.';
    } else if (st.mode === 'jumat') {
      var nj = nextJumat(d), sub = 'Harap tenang dan tidak berbicara selama khutbah. Mohon senyapkan HP.';
      if (nj && nj.j.khatib) sub = 'Khatib: <b>' + esc(nj.j.khatib) + '</b><br>' + sub;
      $('ovTitle').textContent = 'Khutbah dan sholat Jumat';
      $('ovBig').textContent = '';
      $('ovSub').innerHTML = sub;
    }
  }

  // bunyi "tit" 3x lalu panjang di akhir iqomah
  var audio = null, lastBeep = -1;
  function tone(ms, freq) {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      var o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = freq || 1000; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.5, audio.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + ms / 1000);
      o.connect(g); g.connect(audio.destination); o.start(); o.stop(audio.currentTime + ms / 1000 + 0.05);
    } catch (e) { /* tanpa suara */ }
  }
  function beepIqomah(left) {
    if (!cfg.adzan.beep || left === lastBeep) return;
    lastBeep = left;
    if (left <= 3 && left >= 1) tone(180, 1000);
  }
  var prevMode = '';
  function modeChanged(st) {
    var key = st.mode + ':' + (st.p || '');
    if (key === prevMode) return;
    var was = prevMode; prevMode = key;
    if (cfg.adzan.beep && was.indexOf('iqomah:') === 0 && st.mode === 'sholat') tone(900, 1000);
  }

  // ---------- hitung mundur di bawah jam ----------
  function renderCountdown(d, st) {
    var el = $('countdown');
    if (st.mode === 'pre') {
      el.className = 'countdown pre';
      el.innerHTML = (st.p === 'jumat' ? 'Menjelang sholat Jumat' : 'Menjelang adzan ' + NAMA[st.p]) + ' <b>' + dur(st.left) + '</b>';
      return;
    }
    var nx = nextPrayer(d), mins = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
    var left = (nx.at - mins) * 60;
    var nm = (nx.p === 'dzuhur' && d.getDay() === 5) ? 'Jumat' : NAMA[nx.p];
    el.className = 'countdown' + (left < 1800 ? ' soon' : '');
    el.innerHTML = nm + ' dalam <b>' + dur(left) + '</b>';
  }

  // ---------- redup malam ----------
  function toMin(s) { var m = /^(\d{1,2}):(\d{2})/.exec(s || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; }
  function renderDim(d, st) {
    var r = cfg.tampilan.redup, el = $('dim');
    if (!r || !r.aktif || st.mode !== 'normal') { el.hidden = true; return; }
    var a = toMin(r.mulai), b = toMin(r.selesai), m = d.getHours() * 60 + d.getMinutes();
    if (a == null || b == null) { el.hidden = true; return; }
    var on = a <= b ? (m >= a && m < b) : (m >= a || m < b);
    el.hidden = !on;
    el.style.opacity = on ? Math.max(0, Math.min(0.85, 1 - (+r.persen || 40) / 100)) : 0;
  }

  // ---------- detak per detik ----------
  function tick() {
    try {
      var d = now();
      clockBad = checkClock(d);
      if (clockBad) { renderClockBad(d); $('dim').hidden = true; setTimeout(tick, 1000); return; }
      $('hm').textContent = pad(d.getHours()) + ':' + pad(d.getMinutes());
      $('ss').textContent = pad(d.getSeconds());
      var k = dayKey(d) + ':' + d.getHours() + ':' + d.getMinutes();
      if (k !== lastDayKey) { lastDayKey = k; renderHeader(d); renderTimes(d); }
      var st = status(d);
      renderCountdown(d, st);
      overlay(st, d);
      renderAnalog(d);
      if (window.MasjidPusat) MasjidPusat.tick(st.mode);
      modeChanged(st);
      renderDim(d, st);
      // muat ulang halaman sekali sehari pukul 02:xx agar memori box tetap segar
      if (d.getHours() === 2 && Date.now() - startedAt > 6 * 3600e3 && st.mode === 'normal') location.reload();
    } catch (e) { if (window.console) console.error(e); }
    setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
  }

  // geser sedikit setiap 5 menit agar layar tidak "terbakar"
  function antiBurnIn() {
    var x = Math.round(Math.random() * 12 - 6), y = Math.round(Math.random() * 8 - 4);
    $('stage').style.transform = 'translate(' + x + 'px,' + y + 'px)';
  }

  // ---------- hitung mundur hari besar Islam ("86 hari lagi: Isra' Mi'raj") ----------
  var ACARA = [
    [1, 1, 'Tahun Baru Hijriah'], [1, 10, "Hari 'Asyura"], [3, 12, 'Maulid Nabi ﷺ'],
    [7, 27, "Isra' Mi'raj"], [9, 1, 'Awal Ramadhan'], [9, 17, "Nuzulul Qur'an"],
    [10, 1, 'Idul Fitri'], [12, 9, 'Hari Arafah'], [12, 10, 'Idul Adha']
  ];
  var acaraKey = '';
  function renderAcara(d) {
    var el = $('acara'); if (!el) return;
    if (!cfg.tampilan.acara) { el.hidden = true; return; }
    var k = dayKey(d) + (cfg.sholat.hijriOffset || 0);
    if (k === acaraKey) return;
    acaraKey = k;
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    for (var i = 0; i < 400; i++) {
      var h = Hijri.toHijri(x, cfg.sholat.hijriOffset);
      for (var j = 0; j < ACARA.length; j++) {
        if (ACARA[j][0] === h.month && ACARA[j][1] === h.day) {
          el.innerHTML = i === 0 ? '<b>Hari ini</b> ' + esc(ACARA[j][2]) : '<b>' + i + ' hari lagi</b> ' + esc(ACARA[j][2]);
          el.hidden = false;
          return;
        }
      }
      x.setDate(x.getDate() + 1);
    }
    el.hidden = true;
  }

  // ---------- jam analog ----------
  function siapkanAnalog() {
    var g = $('aTanda'); if (!g || g.childNodes.length) return;
    var ns = 'http://www.w3.org/2000/svg';
    for (var i = 0; i < 60; i++) {
      var l = document.createElementNS(ns, 'line'), besar = i % 5 === 0;
      l.setAttribute('x1', 100); l.setAttribute('x2', 100);
      l.setAttribute('y1', besar ? 10 : 12); l.setAttribute('y2', besar ? 24 : 17);
      l.setAttribute('class', besar ? 'a-besar' : 'a-kecil');
      l.setAttribute('transform', 'rotate(' + i * 6 + ' 100 100)');
      g.appendChild(l);
    }
  }
  function putar(id, deg) { var e = $(id); if (e) e.setAttribute('transform', 'rotate(' + deg + ' 100 100)'); }
  function renderAnalog(d) {
    if ($('analog').hidden) return;
    var s = d.getSeconds(), m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60;
    putar('aJam', h * 30); putar('aMenit', m * 6); putar('aDetik', s * 6);
  }

  // ---------- media: siaran langsung YouTube (Makkah/Madinah) / foto masjid ----------
  function ytEmbed(u, suara) {
    u = String(u || '').trim();
    var ch = /(?:channel\/|^)(UC[\w-]{22})/.exec(u), id = null, m;
    if (!ch) {
      if (/^[\w-]{11}$/.test(u)) id = u;
      else if ((m = /(?:v=|youtu\.be\/|\/live\/|\/embed\/|\/shorts\/)([\w-]{11})/.exec(u))) id = m[1];
    }
    var q = 'autoplay=1&mute=' + (suara ? 0 : 1) + '&controls=0&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3';
    if (ch) {
      var r = siaran[ch[1]];
      if (r && r.id) return 'https://www.youtube-nocookie.com/embed/' + r.id + '?' + q; // siaran yang sedang tayang (dicari server pusat)
      cariSiaran(ch[1]);
      return 'https://www.youtube-nocookie.com/embed/live_stream?channel=' + ch[1] + '&' + q;
    }
    if (id) return 'https://www.youtube-nocookie.com/embed/' + id + '?' + q + '&loop=1&playlist=' + id;
    return null;
  }
  // kanal bisa punya beberapa siaran: server pusat mencarikan video yang sedang tayang (diperbarui tiap 30 menit)
  var siaran = {};
  function cariSiaran(ch) {
    var r = siaran[ch];
    if (r && (r.sedang || Date.now() - r.t < 30 * 60000)) return;
    siaran[ch] = { t: Date.now(), id: r && r.id, sedang: true };
    var pusat = (cfg.pusat && cfg.pusat.server) || 'https://tv.pintarinovasi.co.id';
    fetch(pusat.replace(/[/]+$/, '') + '/api/player/youtube-live?channel=' + ch, { cache: 'no-store' })
      .then(function (x) { return x.json(); })
      .then(function (j) { var lama = siaran[ch].id; siaran[ch] = { t: Date.now(), id: j.video || lama }; if (siaran[ch].id !== lama) renderMedia(); },
        function () { siaran[ch].sedang = false; });
  }
  setInterval(function () { if (cfg) renderMedia(); }, 30 * 60000);
  var mediaKini = '';
  // gambar layar bergantian
  var gambarKe = 0, gambarTimer = null;
  function mulaiGambar() {
    clearInterval(gambarTimer);
    var g = cfg.tampilan.gambar || {};
    gambarTimer = setInterval(function () { gambarKe++; renderMedia(); }, Math.min(30, Math.max(5, +g.detik || 15)) * 1000);
  }
  function renderMedia() {
    var el = $('media'), stage = $('stage'), L = MasjidLayout.cari(cfg.tampilan.layout);
    var lv = cfg.tampilan.live || {}, foto = MasjidStore.photoUrl(cfg);
    var gj = window.MasjidPusat && MasjidPusat.gambarJadwal ? MasjidPusat.gambarJadwal() : null; // jadwal tayang dari pusat
    var gb = (gj || (cfg.tampilan.gambar && cfg.tampilan.gambar.daftar) || []).filter(function (x) { return x && x.url; });
    var online = navigator.onLine !== false;
    var src = L.media && lv.aktif && online ? ytEmbed(lv.url, lv.suara) : null;
    var isi, jenis;
    if (src) { jenis = 'live:' + src; isi = '<iframe src="' + esc(src) + '" allow="autoplay; encrypted-media" frameborder="0" referrerpolicy="strict-origin-when-cross-origin"></iframe>'; }
    else if (L.media && gb.length) {
      var g = gb[gambarKe % gb.length], gu = window.MasjidPusat ? MasjidPusat.url(g.url) : g.url;
      jenis = 'gambar:' + gu; isi = '<img src="' + esc(gu) + '" alt="">';
    }
    else if (L.media && foto) { jenis = 'foto:' + foto; isi = '<img src="' + esc(foto) + '" alt="">'; }
    else {
      jenis = 'hias:' + cfg.masjid.nama;
      isi = '<div class="media-hias"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 6c3 5 9 8 9 15 0 3-1 5-2 6h9v31H16V27h9c-1-1-2-3-2-6 0-7 6-10 9-15z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M26 58V44a6 6 0 0 1 12 0v14" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>' +
        '<p>' + esc(cfg.masjid.nama) + '</p></div>';
    }
    el.hidden = !L.media;
    stage.className = (src || gb.length || foto) && L.media ? 'ada-media' : 'tanpa-media';
    if (jenis !== mediaKini) { el.innerHTML = isi; mediaKini = jenis; } // siaran tidak dimuat ulang bila tidak berubah
  }
  window.addEventListener('online', function () { if (cfg) renderMedia(); });
  window.addEventListener('offline', function () { if (cfg) renderMedia(); });

  function applyConfig(conf, raw) {
    cfg = conf; rawCfg = raw; cache = {};
    document.body.setAttribute('data-tema', cfg.tampilan.tema || 'zamrud');
    MasjidLayout.terapkan(cfg.tampilan.layout || 'klasik');
    $('analog').hidden = !cfg.tampilan.analog;
    siapkanAnalog();
    acaraKey = '';
    renderMedia();
    mulaiGambar();
    lastDayKey = ''; lastTickerText = null;
    renderTicker();
    renderBackground();
    refreshSlides(true);
    startSlideTimer();
    if (window.MasjidPusat) MasjidPusat.start(cfg, function () { lastTickerText = null; renderTicker(); refreshSlides(false); renderMedia(); });
  }

  function renderBackground() {
    var bg = $('bg'), foto = MasjidStore.photoUrl(cfg);
    var on = !!(foto && cfg.tampilan.foto.latar) && cfg.tampilan.layout !== 'sinema'; // sinema: foto sudah jadi media penuh
    bg.hidden = !on;
    bg.style.backgroundImage = on ? 'url("' + foto.replace(/"/g, '%22') + '")' : 'none';
  }

  function refreshClock() {
    MasjidStore.clock().then(function (c) { synced = !!c.synced; syncOffset = c.synced ? c.offset : 0; });
  }

  function poll() {
    MasjidStore.load().then(function (r) { if (r.raw !== rawCfg) applyConfig(r.config, r.raw); })
      .catch(function () {}).then(function () { setTimeout(poll, 10000); });
  }

  function showAdminHint() {
    MasjidStore.info().then(function (i) {
      var el = $('adminHint'), risk = MasjidStore.sleepRisk(i.power);
      el.classList.toggle('warn', !!risk);
      // peringatan tetap tampil walau alamat pengaturan disembunyikan
      if (risk) el.textContent = 'Box akan tidur sendiri setelah ' + MasjidStore.fmtDuration(risk.ms) + ' — lihat Pengaturan › Sistem';
      else if (i.server && i.ip && cfg.tampilan.tampilkanAlamatAdmin) el.textContent = 'Pengaturan dari HP: ' + i.ip + ':' + (i.port || 8080);
      else el.textContent = '';
    });
  }

  // tombol OK / Menu di remote membuka pengaturan
  document.addEventListener('keydown', function (e) {
    var k = e.key, c = e.keyCode;
    if (k === 'Enter' || k === 'ContextMenu' || k === 'Menu' || c === 82 || c === 23 || c === 13 || k === 's' || k === 'S') {
      e.preventDefault();
      if (clockBad && window.Android && window.Android.openDateSettings) { window.Android.openDateSettings(); return; }
      location.href = 'admin.html';
    }
  });
  window.addEventListener('storage', function (e) {
    if (e.key === MasjidStore.LS_KEY) MasjidStore.load().then(function (r) { applyConfig(r.config, r.raw); });
  });

  // ---------- mulai ----------
  var q = /[?&]sim=([^&]+)/.exec(location.search);
  if (q) { var t = new Date(decodeURIComponent(q[1])); if (!isNaN(t)) { simOffset = t.getTime() - Date.now(); simulated = true; } }

  MasjidStore.load().then(function (r) {
    server = r.server;
    applyConfig(r.config, r.raw);
    var pratinjauPusat = !!MasjidStore.pusatAdmin;
    if (pratinjauPusat) {
      // pratinjau di panel pusat: isi berubah langsung saat pengaturan di sebelahnya diketik
      window.addEventListener('message', function (e) {
        var d = e.data;
        if (e.origin !== location.origin || !d || (d.masjidtv !== 'pratinjau' && d.masjidtv !== 'tersimpan') || !d.config) return;
        var c = MasjidStore.merge(MasjidStore.clone(MasjidStore.DEFAULTS), d.config);
        c.pusat = { aktif: false }; // pratinjau tidak menyambung ke pusat sebagai layar
        applyConfig(c, JSON.stringify(d.config));
      });
    }
    if (!server && !pratinjauPusat) {
      document.body.classList.add('preview');
      var a = document.createElement('a');
      a.className = 'preview-note'; a.href = 'admin.html'; a.textContent = 'Buka pengaturan';
      document.body.appendChild(a);
    }
    refreshClock(); setInterval(refreshClock, 60000);
    tick();
    showAdminHint(); setInterval(showAdminHint, 60000);
    setInterval(antiBurnIn, 5 * 60000);
    if (!pratinjauPusat) setTimeout(poll, 10000); // pratinjau pusat diperbarui lewat pesan dari halaman pengaturan
  });
})();
