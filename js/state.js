/* SBVC shared state: localStorage as the channel between windows, plus Bible data loading. */
(function () {
  'use strict';

  var KEYS = {
    theme: 'sbvc-theme',
    passage: 'sbvc-passage',
    bg: 'sbvc-background-color',
    custom: 'sbvc-customization',
    fullscreen: 'sbvc-fullscreen-request',
    contentType: 'sbvc-content-type',
    book: 'selectedBook',
    chapter: 'selectedChapter',
    notes: 'sbvc-notes'
  };

  var DEFAULT_CUSTOM = {
    fontFamily: 'Inter',
    fontSize: 5,
    lineHeight: 1.5,
    titleFontFamily: 'Inter',
    titleFontSize: 4.5,
    textAlign: 'center',
    horizontalPadding: 1,
    positions: { title: { x: 0, y: 0 }, text: { x: 0, y: 0 } },
    titleColor: '#D4A373',
    textColor: '#F5EBDD'
  };

  var listeners = [];

  function getRaw(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function setRaw(key, value) {
    try {
      if (value === null || value === undefined) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch (e) { console.error('localStorage write failed', e); }
    emit(key); // storage events only reach OTHER windows, so notify this one too
  }
  function getJSON(key, fallback) {
    var raw = getRaw(key);
    if (raw === null) return fallback;
    try { return JSON.parse(raw); } catch (e) { return fallback; }
  }
  function setJSON(key, value) {
    setRaw(key, value === null ? null : JSON.stringify(value));
  }

  function emit(key) {
    listeners.slice().forEach(function (fn) { try { fn(key); } catch (e) { console.error(e); } });
  }
  function onChange(fn) { listeners.push(fn); }
  window.addEventListener('storage', function (e) { emit(e.key); });

  // ---- customization (with the same back-compat fixes as the original) ----
  function normalizeCustom(p) {
    p = p || {};
    if (p.position) { p.positions = { title: p.position, text: p.position }; delete p.position; }
    if (!p.titleFontSize) p.titleFontSize = p.fontSize ? p.fontSize * 0.9 : DEFAULT_CUSTOM.titleFontSize;
    if (!p.titleFontFamily) p.titleFontFamily = DEFAULT_CUSTOM.titleFontFamily;
    if (p.horizontalPadding === undefined) p.horizontalPadding = DEFAULT_CUSTOM.horizontalPadding;
    if (!p.lineHeight) p.lineHeight = DEFAULT_CUSTOM.lineHeight;
    if (!p.titleColor) p.titleColor = DEFAULT_CUSTOM.titleColor;
    if (!p.textColor) p.textColor = DEFAULT_CUSTOM.textColor;
    var out = JSON.parse(JSON.stringify(DEFAULT_CUSTOM));
    for (var k in p) out[k] = p[k];
    return out;
  }
  function getCustom() { return normalizeCustom(getJSON(KEYS.custom, {})); }
  function setCustom(partial) {
    var updated = getCustom();
    for (var k in partial) updated[k] = partial[k];
    setJSON(KEYS.custom, updated);
    return updated;
  }
  function resetCustom() {
    var d = JSON.parse(JSON.stringify(DEFAULT_CUSTOM));
    setJSON(KEYS.custom, d);
    return d;
  }

  function fontFamily(font) {
    return font.indexOf(' ') >= 0 ? "'" + font + "'" : font;
  }

  // ---- Bible data: each book is a <script> that registers itself in SBVC_BIBLE ----
  var bookPromises = {};
  function fileName(book) { return book.toLowerCase().replace(/\s/g, ''); }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Could not load ' + src)); };
      document.head.appendChild(s);
    });
  }

  // version: 'kjv' | 'adb' | 'tcb' (any case); book: English name, e.g. "1 Samuel"
  function loadBook(version, book) {
    var v = version.toLowerCase();
    var key = v + '/' + fileName(book);
    if (window.SBVC_BIBLE && window.SBVC_BIBLE[key]) return Promise.resolve(window.SBVC_BIBLE[key]);
    if (!bookPromises[key]) {
      bookPromises[key] = loadScript('data/bible/' + key + '.js').then(function () {
        return window.SBVC_BIBLE[key];
      }).catch(function (e) { delete bookPromises[key]; throw e; });
    }
    return bookPromises[key];
  }

  window.SBVC = {
    KEYS: KEYS,
    DEFAULT_CUSTOM: DEFAULT_CUSTOM,
    getRaw: getRaw, setRaw: setRaw, getJSON: getJSON, setJSON: setJSON,
    onChange: onChange,
    getCustom: getCustom, setCustom: setCustom, resetCustom: resetCustom,
    fontFamily: fontFamily,
    loadBook: loadBook,
    loadScript: loadScript,
    getTheme: function () { return getRaw(KEYS.theme) || 'dark'; },
    bgForTheme: function (theme) { return theme === 'dark' ? '#000000' : '#FFFFFF'; }
  };
})();
