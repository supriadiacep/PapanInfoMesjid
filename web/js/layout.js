/* Tata letak layar yang bisa diganti (Pengaturan > Tampilan > Tata letak).
   Bagian layar (judul, jam, media, panel info, jadwal, teks berjalan) dibuat sekali di index.html,
   lalu dipindahkan ke kerangka tata letak yang dipilih — tidak dibuat ulang, jadi jam & siaran tidak terputus.
   Kerangka hanya memakai flexbox (WebView Android 5–7 belum mendukung CSS grid). */
(function (global) {
  'use strict';

  var BAGIAN = { top: 'partTop', clock: 'partClock', media: 'media', panel: 'panel', times: 'times', ticker: 'partTicker' };
  var S = function (n) { return '<i data-slot="' + n + '"></i>'; };

  var LAYOUTS = [
    { id: 'klasik', kotak: [["h",3,3,94,11],["j",3,17,58,46],["p",64,17,33,46],["t",3,66,94,23],["r",0,92,100,8]], nama: 'Klasik', ket: 'Jam besar, panel info di kanan, jadwal berbentuk mihrab di bawah.',
      kerangka: S('top') + '<main class="middle">' + S('clock') + S('panel') + '</main>' + S('times') + S('ticker') },
    { id: 'sinema', kotak: [["m",0,0,100,92],["h",3,3,94,10],["j",3,46,28,22],["p",69,28,28,40],["t",3,72,94,16],["r",0,92,100,8]], nama: 'Sinema', media: true, ket: 'Siaran langsung / foto memenuhi layar, info di atas kartu kaca.',
      kerangka: S('media') + '<div class="L-lapis">' + S('top') + '<div class="L-isi">' + S('clock') + '<div class="L-ruang"></div>' + S('panel') + '</div>' + S('times') + '</div>' + S('ticker') },
    { id: 'kolom', kotak: [["j",2,3,30,22],["t",2,27,30,62],["h",34,3,64,10],["m",34,15,64,74],["p",72,60,24,26],["r",0,92,100,8]], nama: 'Kolom', media: true, ket: 'Jam & jadwal tegak di kiri, siaran langsung / panel info besar di kanan.',
      kerangka: '<div class="L-isi"><div class="L-kiri">' + S('clock') + S('times') + '</div><div class="L-kanan">' + S('top') + '<div class="L-layar">' + S('media') + S('panel') + '</div></div></div>' + S('ticker') },
    { id: 'galeri', kotak: [["t",2,3,21,86],["h",25,3,49,10],["m",25,15,49,74],["j",76,3,22,28],["p",76,33,22,56],["r",0,92,100,8]], nama: 'Galeri', media: true, ket: 'Jadwal di kiri, siaran / foto di tengah, jam & info di kanan.',
      kerangka: '<div class="L-isi"><div class="L-kiri">' + S('times') + '</div><div class="L-tengah">' + S('top') + '<div class="L-layar">' + S('media') + '</div></div><div class="L-kanan">' + S('clock') + S('panel') + '</div></div>' + S('ticker') },
    { id: 'fokus', kotak: [["h",3,3,94,10],["j",30,16,40,12],["t",3,32,22,27],["t",27,32,22,27],["t",51,32,22,27],["t",75,32,22,27],["t",15,62,22,27],["t",39,62,22,27],["t",63,62,22,27],["r",0,92,100,8]], nama: 'Fokus jadwal', ket: 'Kotak jadwal sholat besar-besar, paling mudah dibaca dari jauh.',
      kerangka: S('top') + '<div class="L-fokus">' + S('clock') + '</div>' + S('times') + S('ticker') },
    { id: 'minimal', kotak: [["h",3,3,94,8],["j",18,18,64,42],["t",3,70,94,15],["r",0,92,100,8]], nama: 'Minimal', ket: 'Jam raksasa dan hitung mundur ke waktu sholat berikutnya. Tenang & elegan.',
      kerangka: S('top') + '<div class="L-pusat">' + S('clock') + '</div>' + S('times') + S('ticker') },
    { id: 'tegak', kotak: [["h",6,2,88,8],["j",14,11,72,13],["m",6,26,88,26],["p",6,54,88,14],["t",6,70,42,5],["t",52,70,42,5],["t",6,76,42,5],["t",52,76,42,5],["t",6,82,42,5],["t",52,82,42,5],["r",0,95,100,5]], nama: 'Tegak (TV berdiri)', media: true, ket: 'Untuk TV yang dipasang tegak (portrait).',
      kerangka: S('top') + S('clock') + '<div class="L-layar">' + S('media') + S('panel') + '</div>' + S('times') + S('ticker') }
  ];

  var aktif = null;

  function cari(id) {
    for (var i = 0; i < LAYOUTS.length; i++) if (LAYOUTS[i].id === id) return LAYOUTS[i];
    return LAYOUTS[0];
  }

  function terapkan(id) {
    var L = cari(id);
    if (aktif === L.id) return L;
    var stage = document.getElementById('stage');
    var simpan = document.getElementById('bagianCadangan');
    if (!simpan) {
      simpan = document.createElement('div');
      simpan.id = 'bagianCadangan';
      simpan.style.display = 'none';
      document.body.appendChild(simpan);
    }
    // keluarkan semua bagian dulu, baru pasang kerangka baru
    var bag = {};
    for (var k in BAGIAN) { bag[k] = document.getElementById(BAGIAN[k]); if (bag[k]) simpan.appendChild(bag[k]); }
    stage.innerHTML = L.kerangka;
    var slots = stage.querySelectorAll('[data-slot]');
    for (var i = 0; i < slots.length; i++) {
      var s = slots[i], b = bag[s.getAttribute('data-slot')];
      if (b) s.parentNode.replaceChild(b, s); else s.parentNode.removeChild(s);
    }
    document.documentElement.setAttribute('data-layout', L.id);
    aktif = L.id;
    return L;
  }

  global.MasjidLayout = { LAYOUTS: LAYOUTS, terapkan: terapkan, cari: cari, aktif: function () { return aktif; } };
})(window);
