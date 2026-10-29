/* Tanggal Hijriah. Memakai kalender Umm al-Qura bawaan browser bila ada,
   dan rumus tabular sebagai cadangan. Bisa dikoreksi ±hari dari pengaturan. */
(function (global) {
  'use strict';
  var BULAN = ['Muharram', 'Safar', 'Rabiul Awal', 'Rabiul Akhir', 'Jumadil Awal', 'Jumadil Akhir',
    'Rajab', "Sya'ban", 'Ramadhan', 'Syawal', "Dzulqa'dah", 'Dzulhijjah'];

  function viaIntl(d) {
    try {
      var f = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric' });
      if (f.resolvedOptions().calendar !== 'islamic-umalqura') return null;
      var parts = f.formatToParts(d), o = {};
      parts.forEach(function (p) { o[p.type] = parseInt(p.value, 10); });
      if (!o.day || !o.month || !o.year) return null;
      return { day: o.day, month: o.month, year: o.year };
    } catch (e) { return null; }
  }

  function tabular(d) {
    var jd = Math.floor(d.getTime() / 86400000 + 2440587.5 + 0.5);
    var l = jd - 1948440 + 10632;
    var n = Math.floor((l - 1) / 10631);
    l = l - 10631 * n + 354;
    var j = Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) + Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
    l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
    var m = Math.floor((24 * l) / 709);
    return { day: l - Math.floor((709 * m) / 24), month: m, year: 30 * n + j - 30 };
  }

  /** @param {Date} d  @param {number} offsetDays koreksi hari */
  function toHijri(d, offsetDays) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
    x.setDate(x.getDate() + (+offsetDays || 0));
    var h = viaIntl(x) || tabular(x);
    h.monthName = BULAN[h.month - 1];
    h.text = h.day + ' ' + h.monthName + ' ' + h.year + ' H';
    return h;
  }

  global.Hijri = { toHijri: toHijri, BULAN: BULAN };
})(typeof window !== 'undefined' ? window : globalThis);
