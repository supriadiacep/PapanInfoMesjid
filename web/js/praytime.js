/*
 * Perhitungan waktu sholat offline (tanpa internet).
 * Algoritma astronomi standar (posisi matahari), dengan parameter
 * yang dipakai Kemenag RI: Subuh 20°, Isya 18°, Ashar Syafi'i (bayangan 1x),
 * ihtiyat (pengaman) +2 menit, Imsak = Subuh - 10 menit.
 */
(function (global) {
  'use strict';

  var rad = function (d) { return d * Math.PI / 180; };
  var deg = function (r) { return r * 180 / Math.PI; };
  var sin = function (d) { return Math.sin(rad(d)); };
  var cos = function (d) { return Math.cos(rad(d)); };
  var tan = function (d) { return Math.tan(rad(d)); };
  var asin = function (x) { return deg(Math.asin(x)); };
  var acos = function (x) { return deg(Math.acos(Math.max(-1, Math.min(1, x)))); };
  var atan2 = function (y, x) { return deg(Math.atan2(y, x)); };
  var acot = function (x) { return deg(Math.atan(1 / x)); };
  var fix = function (a, b) { a = a - b * Math.floor(a / b); return a < 0 ? a + b : a; };

  function julian(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    var A = Math.floor(y / 100);
    var B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  }

  function sunPosition(jd) {
    var D = jd - 2451545.0;
    var g = fix(357.529 + 0.98560028 * D, 360);
    var q = fix(280.459 + 0.98564736 * D, 360);
    var L = fix(q + 1.915 * sin(g) + 0.020 * sin(2 * g), 360);
    var e = 23.439 - 0.00000036 * D;
    var RA = atan2(cos(e) * sin(L), cos(L)) / 15;
    return { decl: asin(sin(e) * sin(L)), eqt: q / 15 - fix(RA, 24) };
  }

  /**
   * Hitung waktu sholat untuk satu tanggal.
   * @param {Date} date  tanggal (yang dipakai hanya tahun/bulan/hari lokal)
   * @param {object} o   {lat, lng, tz, fajr, isha, asr(1|2), ihtiyat, imsak, elev}
   * @returns {object}   menit sejak 00:00 untuk tiap waktu + teks HH:MM
   */
  function compute(date, o) {
    var lat = +o.lat, lng = +o.lng, tz = +o.tz;
    var jDate = julian(date.getFullYear(), date.getMonth() + 1, date.getDate()) - lng / (15 * 24);
    var riseAngle = 0.833 + 0.0347 * Math.sqrt(Math.max(0, +o.elev || 0));

    function midDay(t) { var e = sunPosition(jDate + t).eqt; return fix(12 - e, 24); }
    function angleTime(angle, t, ccw) {
      var decl = sunPosition(jDate + t).decl;
      var noon = midDay(t);
      var T = acos((-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat))) / 15;
      return noon + (ccw ? -T : T);
    }
    function asrTime(factor, t) {
      var decl = sunPosition(jDate + t).decl;
      var angle = -acot(factor + tan(Math.abs(lat - decl)));
      return angleTime(angle, t);
    }

    // iterasi agar posisi matahari dihitung pada jam yang tepat
    var t = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, maghrib: 18, isha: 18 };
    for (var i = 0; i < 2; i++) {
      var p = {};
      for (var k in t) p[k] = t[k] / 24;
      t = {
        fajr: angleTime(+o.fajr || 20, p.fajr, true),
        sunrise: angleTime(riseAngle, p.sunrise, true),
        dhuhr: midDay(p.dhuhr),
        asr: asrTime(+o.asr || 1, p.asr),
        maghrib: angleTime(riseAngle, p.maghrib),
        isha: angleTime(+o.isha || 18, p.isha)
      };
    }

    var shift = tz - lng / 15;
    var ih = (o.ihtiyat == null ? 2 : +o.ihtiyat);
    var adj = o.adjust || {};
    function toMin(h, add, roundDown) {
      var m = (h + shift) * 60 + add;
      // pembulatan ala jadwal resmi: waktu masuk dibulatkan ke atas,
      // waktu terbit dibulatkan ke bawah (lebih aman)
      return roundDown ? Math.floor(m) : Math.ceil(m - 1e-6);
    }
    var r = {
      subuh: toMin(t.fajr, ih + (+adj.subuh || 0)),
      terbit: toMin(t.sunrise, -ih + (+adj.terbit || 0), true),
      dzuhur: toMin(t.dhuhr, ih + (+adj.dzuhur || 0)),
      ashar: toMin(t.asr, ih + (+adj.ashar || 0)),
      maghrib: toMin(t.maghrib, ih + (+adj.maghrib || 0)),
      isya: toMin(t.isha, ih + (+adj.isya || 0))
    };
    r.imsak = r.subuh - (o.imsak == null ? 10 : +o.imsak);
    return r;
  }

  function fmt(min) {
    min = ((Math.round(min) % 1440) + 1440) % 1440;
    var h = Math.floor(min / 60), m = min % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  global.PrayTime = { compute: compute, fmt: fmt };
  if (typeof module !== 'undefined') module.exports = global.PrayTime;
})(typeof window !== 'undefined' ? window : globalThis);
