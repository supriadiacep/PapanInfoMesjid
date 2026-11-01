/* Penyesuaian untuk WebView lama di box Android 5–7 (Chrome 37–55) yang
   tidak pernah diperbarui. Dimuat paling awal, sebelum skrip lain.
   Di browser/WebView baru, file ini tidak melakukan apa-apa. */
(function () {
  'use strict';

  // ---------- fetch (Chrome 42+) ----------
  // Tanpa ini halaman mengira tidak ada server box, sehingga pengaturan dari HP tidak tampil.
  if (!window.fetch && window.Promise) {
    window.fetch = function (url, opt) {
      opt = opt || {};
      return new Promise(function (resolve, reject) {
        var x = new XMLHttpRequest();
        x.open(opt.method || 'GET', url, true);
        var h = opt.headers || {};
        for (var k in h) if (Object.prototype.hasOwnProperty.call(h, k)) x.setRequestHeader(k, h[k]);
        if (opt.cache === 'no-store') x.setRequestHeader('Cache-Control', 'no-cache');
        x.onload = function () {
          var text = x.responseText;
          resolve({
            ok: x.status >= 200 && x.status < 300,
            status: x.status,
            text: function () { return Promise.resolve(text); },
            json: function () { return new Promise(function (r) { r(JSON.parse(text)); }); }
          });
        };
        x.onerror = x.ontimeout = function () { reject(new TypeError('Network request failed')); };
        x.send(opt.body == null ? null : opt.body);
      });
    };
  }

  // ---------- Element.closest (Chrome 41+) ----------
  var EP = window.Element && Element.prototype;
  if (EP && !EP.matches) EP.matches = EP.webkitMatchesSelector || EP.msMatchesSelector;
  if (EP && !EP.closest) {
    EP.closest = function (sel) {
      var el = this;
      while (el && el.nodeType === 1) { if (el.matches(sel)) return el; el = el.parentNode; }
      return null;
    };
  }

  // ---------- variabel warna CSS (Chrome 49+) ----------
  // Browser lama membuang setiap aturan yang memakai var(--...). Di sini file CSS
  // dibaca ulang, var(--...) diganti nilai sesuai tema, lalu dipasang sebagai <style>.
  var hasVars = false;
  try { hasVars = !!(window.CSS && CSS.supports && CSS.supports('--a', '0')); } catch (e) { }
  if (hasVars) return;

  var sheets = [];   // { link, text, style }
  var resolver = document.createElement('a');

  function absUrl(base, u) {
    if (/^(data:|https?:|\/|#)/.test(u)) return u;
    resolver.href = base.replace(/[^\/]*$/, '') + u;
    return resolver.href;
  }

  function readVars(css) {
    var out = { root: {} }, re = /(:root|body\[data-tema="([\w-]+)"\])\s*\{([^}]*)\}/g, m, d, vr;
    while ((m = re.exec(css))) {
      var key = m[2] || 'root';
      out[key] = out[key] || {};
      vr = /--([\w-]+)\s*:\s*([^;}]+)/g;
      while ((d = vr.exec(m[3]))) out[key][d[1]] = d[2].replace(/\/\*.*?\*\//g, '').trim();
    }
    return out;
  }

  function build(s) {
    var tema = (document.body && document.body.getAttribute('data-tema')) || '';
    var vars = {}, k, own = s.vars[tema] || {};
    for (k in s.vars.root) vars[k] = s.vars.root[k];
    for (k in own) vars[k] = own[k];
    return s.text
      .replace(/var\(--([\w-]+)\s*(?:,\s*([^)]*))?\)/g, function (_, n, fb) { return vars[n] || fb || 'initial'; })
      .replace(/url\((['"]?)([^'")]+)\1\)/g, function (_, q, u) { return 'url(' + q + absUrl(s.href, u) + q + ')'; });
  }

  function applyAll() {
    for (var i = 0; i < sheets.length; i++) sheets[i].style.textContent = build(sheets[i]);
  }

  function load(link) {
    var x = new XMLHttpRequest();
    x.open('GET', link.href, true);
    x.onload = function () {
      if (x.status && (x.status < 200 || x.status >= 300)) return;
      var text = x.responseText;
      if (text.indexOf('var(--') < 0) return;
      var s = { href: link.href, text: text, vars: readVars(text), style: document.createElement('style') };
      // diletakkan tepat setelah <link> aslinya agar urutan aturan tetap sama
      link.parentNode.insertBefore(s.style, link.nextSibling);
      sheets.push(s);
      s.style.textContent = build(s);
    };
    x.send(null);
  }

  var links = document.querySelectorAll('link[rel="stylesheet"]');
  for (var i = 0; i < links.length; i++) load(links[i]);

  // tema diganti dari pengaturan -> pasang ulang warnanya
  function watch() {
    if (!window.MutationObserver || !document.body) return;
    new MutationObserver(applyAll).observe(document.body, { attributes: true, attributeFilter: ['data-tema'] });
  }
  if (document.body) watch(); else document.addEventListener('DOMContentLoaded', watch);
})();
