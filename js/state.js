/* SBVC shared state: localStorage as the channel between windows, plus Bible data loading. */
(function () {
  'use strict';

  var KEYS = {
    remoteStep: 'sbvc-remote-step', // a next / previous key pressed on the projector window
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
  var liveHook = null;     // js/live.js: told about every local write so it can send it to the other computer
  var fromRemote = false; // true while a change that arrived from the other computer is being written

  function getRaw(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function setRaw(key, value) {
    try {
      if (value === null || value === undefined) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch (e) { console.error('localStorage write failed', e); }
    if (liveHook && !fromRemote) { try { liveHook(key, value === undefined ? null : value); } catch (e) { console.error(e); } }
    emit(key); // storage events only reach OTHER windows, so notify this one too
  }
  function applyRemote(key, value) { // write something that came from the other computer (not sent back)
    fromRemote = true;
    try { setRaw(key, value); } finally { fromRemote = false; }
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

  // every font menu uses this one list, A to Z; the files are in fonts/ (see fonts/README.txt)
  var FONT_NAMES = ['Anton', 'Arvo', 'Barlow', 'Bebas Neue', 'Bitter', 'Caveat', 'Cinzel', 'Comfortaa', 'Cormorant Garamond',
    'Dancing Script', 'EB Garamond', 'Fredoka', 'Futura', 'Georgia', 'Great Vibes', 'Inter', 'JetBrains Mono', 'Jost', 'Lato',
    'Libre Baskerville', 'Literata', 'Merriweather', 'monospace', 'Montserrat', 'Noto Sans', 'Nunito', 'Open Sans', 'Oswald',
    'Pacifico', 'Playfair Display', 'Poppins', 'Quicksand', 'Raleway', 'Roboto', 'Roboto Mono', 'Roboto Slab',
    'Source Code Pro', 'Source Sans 3', 'Space Mono', 'Times New Roman', 'Ubuntu', 'Work Sans', 'Zilla Slab'];
  FONT_NAMES.sort(function (a, b) { return a.toLowerCase().localeCompare(b.toLowerCase()); });
  var FONT_SAMPLE = 'Grace & Peace';
  function fontLabel(name) { return name === 'monospace' ? 'Monospace' : name; }

  /* A font menu that shows each name with a sample written in that font (a normal <select> cannot do that).
   * Use it like a <select>: picker.value and picker.onchange. */
  var openFontList = null; // only one list is open at a time
  function createFontPicker(extraClass) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fontpick' + (extraClass ? ' ' + extraClass : '');
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    var nameEl = document.createElement('span'); nameEl.className = 'fp-name';
    var sampleEl = document.createElement('span'); sampleEl.className = 'fp-sample';
    btn.appendChild(nameEl); btn.appendChild(sampleEl);

    var value = '', list = null, items = [], active = -1, watch = null;

    function show() {
      nameEl.textContent = fontLabel(value);
      sampleEl.textContent = extraClass === 'fb-font' ? 'Aa' : FONT_SAMPLE; // the bar above a box is narrow
      sampleEl.style.fontFamily = value ? fontFamily(value) : '';
      btn.title = 'Font: ' + fontLabel(value);
    }
    Object.defineProperty(btn, 'value', {
      configurable: true,
      get: function () { return value; },
      set: function (v) { value = String(v || ''); show(); }
    });

    function mark(i, scroll) {
      if (items[active]) items[active].classList.remove('active');
      active = Math.max(0, Math.min(items.length - 1, i));
      items[active].classList.add('active');
      if (scroll) items[active].scrollIntoView({ block: 'nearest' });
    }
    function close() {
      if (!list) return;
      clearInterval(watch);
      document.removeEventListener('mousedown', outside, true);
      document.removeEventListener('scroll', scrolled, true);
      window.removeEventListener('resize', close);
      list.remove(); list = null; items = []; active = -1;
      if (openFontList === close) openFontList = null;
      btn.setAttribute('aria-expanded', 'false');
    }
    function outside(e) { if (list && !list.contains(e.target) && !btn.contains(e.target)) close(); }
    function scrolled(e) { if (list && e.target !== list) close(); } // the button moved away from under the list
    function choose(name) {
      var changed = name !== value;
      close();
      if (!btn.isConnected) return;
      btn.value = name;
      if (changed && btn.onchange) btn.onchange();
    }
    function open() {
      if (openFontList) openFontList();
      list = document.createElement('div');
      list.className = 'fontlist';
      list.setAttribute('role', 'listbox');
      items = FONT_NAMES.map(function (name, i) {
        var row = document.createElement('div');
        row.className = 'fp-item' + (name === value ? ' on' : '');
        row.setAttribute('role', 'option');
        row.setAttribute('aria-selected', String(name === value));
        var n = document.createElement('span'); n.className = 'fp-name'; n.textContent = fontLabel(name);
        var s = document.createElement('span'); s.className = 'fp-sample'; s.textContent = FONT_SAMPLE;
        s.style.fontFamily = fontFamily(name);
        row.appendChild(n); row.appendChild(s);
        row.onmousemove = function () { if (active !== i) mark(i, false); };
        row.onclick = function () { choose(name); };
        list.appendChild(row);
        return row;
      });
      // keeps the cursor and the selected words in the slide's text box while you pick
      list.addEventListener('mousedown', function (e) { e.preventDefault(); });
      document.body.appendChild(list);

      var r = btn.getBoundingClientRect();
      var width = Math.min(Math.max(r.width, 320), window.innerWidth - 16);
      var below = window.innerHeight - r.bottom - 12, above = r.top - 12;
      var up = below < 260 && above > below;
      var height = Math.max(140, Math.min(360, up ? above : below));
      list.style.width = width + 'px';
      list.style.maxHeight = height + 'px';
      list.style.left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8)) + 'px';
      list.style.top = (up ? Math.max(8, r.top - 4 - Math.min(height, list.offsetHeight)) : r.bottom + 4) + 'px';

      var at = Math.max(0, FONT_NAMES.indexOf(value));
      mark(at, false);
      list.scrollTop = Math.max(0, items[at].offsetTop - list.clientHeight / 2);
      document.addEventListener('mousedown', outside, true);
      document.addEventListener('scroll', scrolled, true);
      window.addEventListener('resize', close);
      watch = setInterval(function () { if (!btn.isConnected || !btn.offsetParent) close(); }, 250);
      openFontList = close;
      btn.setAttribute('aria-expanded', 'true');
    }

    // while typing in a slide box, the cursor stays there (otherwise the panel redraws before the menu can open)
    btn.addEventListener('mousedown', function (e) {
      e.preventDefault();
      if (!(document.activeElement && document.activeElement.isContentEditable)) btn.focus();
    });
    btn.onclick = function () { if (list) close(); else open(); };
    btn.onkeydown = function (e) {
      if (e.key === 'Tab') { close(); return; }
      e.stopPropagation(); // arrows here must not move the verse or slide on the projector
      var down = e.key === 'ArrowDown', upKey = e.key === 'ArrowUp';
      if (!list) {
        if (down || upKey) { e.preventDefault(); open(); }
        return;
      }
      if (down || upKey) { e.preventDefault(); mark(active + (down ? 1 : -1), true); }
      else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); mark(e.key === 'Home' ? 0 : items.length - 1, true); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(FONT_NAMES[active]); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key.length === 1) { // type a letter to jump to it
        var letter = e.key.toLowerCase();
        for (var step = 1; step <= items.length; step++) {
          var j = (active + step) % items.length;
          if (fontLabel(FONT_NAMES[j]).charAt(0).toLowerCase() === letter) { mark(j, true); break; }
        }
      }
    };
    return btn;
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
  function syncVideo(video, tolerance) {
    var st = getJSON(KEYS.playback, null);
    if (!video || !st) return;
    // when playing, the saved time is slightly old: add the time that passed since it was saved
    var target = st.isPlaying ? st.currentTime + Math.max(0, (Date.now() - st.timestamp) / 1000) : st.currentTime;
    if (isFinite(target) && Math.abs(video.currentTime - target) > (tolerance || 1.5)) {
      try { video.currentTime = target; } catch (e) {}
    }
    var over = isFinite(video.duration) && target >= video.duration; // play() on a finished video would restart it
    if (st.isPlaying && !over && video.paused) video.play().catch(function () {});
    else if (!st.isPlaying && !video.paused) video.pause();
  }

  // ---- video sound: whoever makes the sound (Presentation window or a controller tab) is also the clock ----
  // it reports where the video really is, but only when that differs from what the others expect
  function reportClock(video, limit) {
    var st = getJSON(KEYS.playback, null);
    if (!st || !st.isPlaying || video.paused || video.seeking || video.readyState < 3) return;
    var expected = st.currentTime + Math.max(0, (Date.now() - st.timestamp) / 1000);
    if (Math.abs(video.currentTime - expected) > limit) setJSON(KEYS.playback, { isPlaying: true, currentTime: video.currentTime, timestamp: Date.now() });
  }
  function reportEnded(video) {
    var st = getJSON(KEYS.playback, null);
    if (st && st.isPlaying) setJSON(KEYS.playback, { isPlaying: false, currentTime: video.duration || video.currentTime, timestamp: Date.now() });
  }
  // volume and mute, remembered on this computer only
  var soundPrefs = {
    get: function () {
      var v = 1, m = false;
      try {
        var n = parseFloat(localStorage.getItem('sbvc-player-volume'));
        if (n >= 0 && n <= 1) v = n;
        m = localStorage.getItem('sbvc-player-muted') === '1';
      } catch (e) { /* none */ }
      return { volume: v, muted: m };
    },
    set: function (volume, muted) {
      try {
        localStorage.setItem('sbvc-player-volume', String(volume));
        localStorage.setItem('sbvc-player-muted', muted ? '1' : '0');
      } catch (e) { /* none */ }
    },
    owns: function (key) { return key === 'sbvc-player-volume' || key === 'sbvc-player-muted'; }
  };

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

  // ---- Bible verse / hymn text: drawn on a fixed 1280 x 720 stage, then scaled as a whole, so the projector
  // and the small previews always look the same (line breaks, sizes, spacing, dragged positions).
  function passageStage(passage, c) {
    function line(tag, text, font, size, color, pos) {
      var n = document.createElement(tag);
      n.textContent = text;
      n.style.fontFamily = fontFamily(font);
      n.style.fontSize = size + 'rem';
      n.dataset.size = size;
      n.style.color = color;
      n.style.textAlign = c.textAlign;
      n.style.transform = 'translate(' + pos.x + 'px,' + pos.y + 'px)';
      return n;
    }
    var stage = document.createElement('div');
    stage.className = 'pstage';
    stage.style.paddingLeft = stage.style.paddingRight = c.horizontalPadding + 'rem';
    var h = line('h1', passage.reference, c.titleFontFamily, c.titleFontSize, c.titleColor, c.positions.title);
    var p = line('p', passage.text, c.fontFamily, c.fontSize, c.textColor, c.positions.text);
    p.style.lineHeight = c.lineHeight;
    stage.appendChild(h);
    stage.appendChild(p);
    return { stage: stage, title: h, text: p };
  }
  // a very long verse is made smaller until all of it is on the screen (your chosen size is not changed)
  function shrinkToFit(stage) {
    var h = stage.querySelector('h1'), p = stage.querySelector('p');
    if (!h || !p) return;
    function apply(k) { [h, p].forEach(function (n) { n.style.fontSize = (n.dataset.size * k) + 'rem'; }); }
    var k = 1;
    apply(k);
    while (k > 0.3 && h.offsetHeight + 16 + p.offsetHeight > 688) { k -= 0.03; apply(k); }
  }
  // scale a stage (already on the page) to fit a w x h box, centered; returns the scale
  function fitStage(stage, w, h) {
    shrinkToFit(stage);
    // the font may still be loading on the first draw: measure again once it has arrived
    if (document.fonts && document.fonts.status === 'loading') document.fonts.ready.then(function () { shrinkToFit(stage); });
    var s = Math.min(w / 1280, h / 720);
    stage.style.left = ((w - 1280 * s) / 2) + 'px';
    stage.style.top = ((h - 720 * s) / 2) + 'px';
    stage.style.transform = 'scale(' + s + ')';
    return s;
  }

  // ---- next / previous with the keyboard or a presentation clicker ----
  function stepOfKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') return 1;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') return -1;
    return 0;
  }
  // fn(+1 or -1) moves what is on the screen; it returns true if it did something with the key
  function onStepKey(fn) {
    document.addEventListener('keydown', function (e) {
      var d = stepOfKey(e);
      if (!d || e.defaultPrevented) return;
      var t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|VIDEO|AUDIO)$/.test(t.tagName))) return;
      if (document.querySelector('.impdlg')) return; // a question is open
      if (fn(d)) e.preventDefault();
    });
    listeners.push(function (key) {
      if (key !== KEYS.remoteStep) return;
      var m = getJSON(KEYS.remoteStep, null);
      if (m && (m.d === 1 || m.d === -1) && Date.now() - m.t < 3000) fn(m.d);
    });
  }

  window.SBVC = {
    passageStage: passageStage, fitStage: fitStage,
    stepOfKey: stepOfKey, onStepKey: onStepKey,
    KEYS: KEYS,
    DEFAULT_CUSTOM: DEFAULT_CUSTOM,
    getRaw: getRaw, setRaw: setRaw, getJSON: getJSON, setJSON: setJSON,
    onChange: onChange,
    applyRemote: applyRemote,
    setLiveHook: function (fn) { liveHook = fn; },
    getCustom: getCustom, setCustom: setCustom, resetCustom: resetCustom,
    fontFamily: fontFamily,
    createFontPicker: createFontPicker,
    syncVideo: syncVideo,
    reportClock: reportClock, reportEnded: reportEnded, soundPrefs: soundPrefs,
    PROJECTOR_OPEN: 'sbvc-projector-open', PROJECTOR_SOUND: 'sbvc-projector-sound',
    mediaStore: mediaStore,
    mediaLibrary: mediaLibrary,
    applyBackground: applyBackground,
    loadBook: loadBook,
    loadScript: loadScript,
    getTheme: function () { return getRaw(KEYS.theme) || 'dark'; },
    bgForTheme: function (theme) { return theme === 'dark' ? '#000000' : '#FFFFFF'; }
  };
})();
