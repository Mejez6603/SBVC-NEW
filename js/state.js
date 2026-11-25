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
    notes: 'sbvc-notes',
    hymnCustom: 'sbvc-hymnals-customization',
    preset: 'sbvc-preset',
    activeMedia: 'sbvc-active-media',
    playback: 'sbvc-media-playback-state',
    bgImages: 'sbvc-bg-images',   // list of custom background pictures [{id, name, url}] (url = small JPEG data URL)
    bgImage: 'sbvc-bg-image',     // id of the picture in use, or empty
    bgCss: 'sbvc-bg-css',         // background layers of a chosen Hymnals design (gradient / bands), or empty
    hymnDesign: 'sbvc-hymnals-design', // the Hymnals design in use {theme, colorScheme, customColors}
    bibleDesign: 'sbvc-bible-design', // the Bible controller design in use {theme, colorScheme, customColors}
    hymnUi: 'sbvc-hymnals-ui',    // what you had open on the Hymnals page (search, hymn, verse, tab)
    ctrlUi: 'sbvc-controller-ui', // what you had open on the Bible controller (version, verse, search, tab)
    preachDeck: 'sbvc-preaching-deck', // the Preaching slides {slides:[...], current, tab}
    preachLive: 'sbvc-preaching-live', // index of the slide on the projector, or empty
    preachImages: 'sbvc-preaching-images', // pictures placed on Preaching and PowerPoint slides {imageId: small data URL}
    pptDeck: 'sbvc-powerpoint-deck', // the PowerPoint page's own slides {slides:[...], current, tab}
    pptLive: 'sbvc-powerpoint-live' // index of the PowerPoint slide on the projector, or empty
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
  function getCustom(key) { return normalizeCustom(getJSON(key || KEYS.custom, {})); }
  function setCustom(partial, key) {
    var updated = getCustom(key);
    for (var k in partial) updated[k] = partial[k];
    setJSON(key || KEYS.custom, updated);
    return updated;
  }
  function resetCustom(key) {
    var d = JSON.parse(JSON.stringify(DEFAULT_CUSTOM));
    setJSON(key || KEYS.custom, d);
    return d;
  }

  function fontFamily(font) {
    return font.indexOf(' ') >= 0 ? "'" + font + "'" : font;
  }

  // ---- background: a color, optionally with a custom picture on top (Hymnals only) ----
  function getBgImageUrl() {
    var id = getRaw(KEYS.bgImage);
    if (!id) return null;
    var list = getJSON(KEYS.bgImages, []);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i].url;
    return null;
  }
  function applyBackground(node, useImage, useDesign) {
    node.style.backgroundColor = getRaw(KEYS.bg) || '#000000';
    var url = useImage ? getBgImageUrl() : null;
    var css = useDesign ? getRaw(KEYS.bgCss) : null; // a Hymnals design's gradient / bands, drawn under a picture
    node.style.backgroundImage = url ? 'url("' + url + '")' : (css || 'none');
    node.style.backgroundSize = 'cover';
    node.style.backgroundPosition = 'center';
    node.style.backgroundRepeat = 'no-repeat';
  }

  // ---- video follower: makes a (muted) <video> copy the controller's playback state ----
  function syncVideo(video) {
    var st = getJSON(KEYS.playback, null);
    if (!video || !st) return;
    // when playing, the saved time is slightly old: add the time that passed since it was saved
    var target = st.isPlaying ? st.currentTime + Math.max(0, (Date.now() - st.timestamp) / 1000) : st.currentTime;
    if (isFinite(target) && Math.abs(video.currentTime - target) > 1.5) {
      try { video.currentTime = target; } catch (e) {}
    }
    if (st.isPlaying && video.paused) video.play().catch(function () {});
    else if (!st.isPlaying && !video.paused) video.pause();
  }

  // ---- media hand-over: the controller saves the video FILE in IndexedDB and the projector window reads it.
  // (A blob: link made by one window does not work in another window when the pages are opened from disk.)
  // 'files'   = the one video currently on the projector (key 'active')
  // 'library' = the Hymnals media library, kept between visits (one record per file)
  var DB_NAME = 'sbvc-media';
  function openDb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, 2);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('files')) db.createObjectStore('files');
        if (!db.objectStoreNames.contains('library')) db.createObjectStore('library', { keyPath: 'id' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }
  function dbRun(store, mode, fn) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(store, mode);
        var result;
        var req = fn(tx.objectStore(store));
        if (req) req.onsuccess = function () { result = req.result; };
        tx.oncomplete = function () { db.close(); resolve(result); };
        tx.onerror = tx.onabort = function () { db.close(); reject(tx.error || new Error('storage failed')); };
      });
    });
  }
  var mediaStore = {
    put: function (blob) { return dbRun('files', 'readwrite', function (s) { return s.put(blob, 'active'); }); },
    get: function () { return dbRun('files', 'readonly', function (s) { return s.get('active'); }); },
    clear: function () { return dbRun('files', 'readwrite', function (s) { return s.delete('active'); }).catch(function () {}); }
  };
  var mediaLibrary = {
    all: function () { return dbRun('library', 'readonly', function (s) { return s.getAll(); }).then(function (l) { return l || []; }); },
    put: function (item) { return dbRun('library', 'readwrite', function (s) { return s.put(item); }); },
    remove: function (id) { return dbRun('library', 'readwrite', function (s) { return s.delete(id); }).catch(function () {}); }
  };

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
    syncVideo: syncVideo,
    mediaStore: mediaStore,
    mediaLibrary: mediaLibrary,
    applyBackground: applyBackground,
    loadBook: loadBook,
    loadScript: loadScript,
    getTheme: function () { return getRaw(KEYS.theme) || 'dark'; },
    bgForTheme: function (theme) { return theme === 'dark' ? '#000000' : '#FFFFFF'; }
  };
})();
