/* SBVC hymnals: pick hymns into a preset, project title / verses, play video & audio. */
(function () {
  'use strict';
  var S = window.SBVC;
  var K = S.KEYS;
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  var MAX_PRESET_ITEMS = 15;
  var HYMNS_EN = window.SBVC_HYMNS_EN || [];
  var HYMNS_TL = window.SBVC_HYMNS_TL || [];

  var state = {
    search: '',
    hymn: null,          // the preset hymn whose lyrics are shown
    verseIndex: null,    // -1 = title, 0.. = lyric group, null = nothing projected
    tab: 'paneHymnal',   // which center tab is open
    library: []          // {id, name, url, type, thumbnail, file} - the files are also kept in browser storage
  };

  var presetList = S.getJSON(K.preset, []);
  if (!Array.isArray(presetList)) presetList = [];

  function sameHymn(a, b) { return a.number === b.number && a.title === b.title; }
  function setPassage(p) { S.setJSON(K.passage, p); }
  // Only clicking lyrics or a video (or Clear) takes over the projector; opening or switching to this page does not
  function takeScreen() { S.setRaw(K.contentType, 'hymnal'); }
  function hymnOnScreen() { return S.getRaw(K.contentType) === 'hymnal'; }

  // remember what is open so a refresh or a closed tab brings you back to the same place
  function saveUi() {
    S.setJSON(K.hymnUi, {
      search: state.search,
      hymn: state.hymn ? { number: state.hymn.number, title: state.hymn.title } : null,
      verseIndex: state.verseIndex,
      tab: state.tab
    });
  }

  /* ------------------------------------------------------------------ *
   * Toast
   * ------------------------------------------------------------------ */
  var toastTimer = null;
  function toast(title, text) {
    var t = $('toast');
    t.textContent = '';
    t.appendChild(el('b', '', title));
    t.appendChild(el('div', '', text));
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 3500);
  }

  /* ------------------------------------------------------------------ *
   * Left: hymn lists
   * ------------------------------------------------------------------ */
  function renderList(hostId, hymns) {
    var host = $(hostId);
    host.textContent = '';
    var q = state.search.toLowerCase();
    var frag = document.createDocumentFragment();
    hymns.forEach(function (h) {
      if (q && h.title.toLowerCase().indexOf(q) < 0) return;
      var row = el('div', 'hrow');
      row.appendChild(el('span', '', h.number + '. ' + h.title));
      var add = el('button', 'btn sm ghost', 'Add');
      add.onclick = function () { addToPreset(h); };
      row.appendChild(add);
      frag.appendChild(row);
    });
    if (!frag.childNodes.length) frag.appendChild(el('p', 'muted', 'No hymns found.'));
    host.appendChild(frag);
  }
  function renderLists() { renderList('listEn', HYMNS_EN); renderList('listTl', HYMNS_TL); }

  $('hSearch').addEventListener('input', function () { state.search = this.value; renderLists(); saveUi(); });

  /* ------------------------------------------------------------------ *
   * Center: background, preset, lyrics
   * ------------------------------------------------------------------ */
  var bgp = S.createBackgroundPicker($('bgRow')); // color swatches + your own pictures (js/background.js)
  function addToPreset(h) {
    if (presetList.length >= MAX_PRESET_ITEMS) {
      toast('Preset is full', 'Please remove a hymn from the preset before adding a new one.');
      return;
    }
    if (!presetList.some(function (x) { return sameHymn(x, h); })) {
      presetList.push(h);
      S.setJSON(K.preset, presetList);
      renderPreset();
    }
  }

  function removeFromPreset(h) {
    presetList = presetList.filter(function (x) { return !sameHymn(x, h); });
    S.setJSON(K.preset, presetList);
    if (state.hymn && sameHymn(state.hymn, h)) {
      state.hymn = null; state.verseIndex = null;
    }
    renderPreset(); renderLyrics(); saveUi();
  }

  function renderPreset() {
    var host = $('preset');
    host.textContent = '';
    if (!presetList.length) {
      host.appendChild(el('p', 'muted', 'Add hymns from the list on the left.'));
      return;
    }
    var grid = el('div', 'presetgrid');
    presetList.forEach(function (h) {
      var cell = el('div', 'presetitem' + (state.hymn && sameHymn(state.hymn, h) ? ' on' : ''));
      cell.appendChild(el('span', '', h.number + '. ' + h.title));
      var x = el('button', 'btn ghost icon', '✕');
      x.style.width = '28px'; x.style.height = '28px'; x.title = 'Remove from preset';
      x.onclick = function (e) { e.stopPropagation(); removeFromPreset(h); };
      cell.appendChild(x);
      cell.onclick = function () { selectHymn(h); };
      grid.appendChild(cell);
    });
    host.appendChild(grid);
  }

  function selectHymn(h) {
    state.hymn = h;
    state.verseIndex = null; // the screen stays as it is until you click a line of this hymn
    renderPreset(); renderLyrics(); saveUi();
  }

  function groupLyrics(lyrics) {
    var groups = [], cur = [];
    lyrics.forEach(function (line) {
      if (line.trim() === '' && cur.length) { groups.push(cur); cur = []; }
      else if (line.trim() !== '') cur.push(line);
    });
    if (cur.length) groups.push(cur);
    return groups;
  }

  function project(index, lines) {
    state.verseIndex = index;
    S.setJSON(K.activeMedia, null); S.mediaStore.clear();
    S.setJSON(K.playback, null);
    setPassage({
      reference: index === -1 ? state.hymn.title : '',
      text: index === -1 ? '' : lines.join('\n')
    });
    takeScreen();
    renderLyrics(); renderNowPlaying(); renderMedia(); saveUi();
  }

  function renderLyrics() {
    var host = $('lyrics');
    host.textContent = '';
    if (!state.hymn) {
      host.appendChild(el('p', 'muted centertext', 'Select a hymn from the preset to see its lyrics.'));
      return;
    }
    host.appendChild(el('h3', 'hym-sub', state.hymn.title));
    var list = el('div', 'lyriclist');

    var t = el('div', 'lyric' + (state.verseIndex === -1 ? ' on' : ''));
    t.appendChild(el('p', 'lh', 'Title'));
    t.appendChild(el('p', '', state.hymn.title));
    t.onclick = function () { project(-1, [state.hymn.title]); };
    list.appendChild(t);

    groupLyrics(state.hymn.lyrics).forEach(function (lines, i) {
      var card = el('div', 'lyric' + (state.verseIndex === i ? ' on' : ''));
      card.appendChild(el('p', 'lh', 'Verse ' + (i + 1)));
      lines.forEach(function (line) { card.appendChild(el('p', '', line)); });
      card.onclick = function () { project(i, lines); };
      list.appendChild(card);
    });
    host.appendChild(list);
  }

  /* ------------------------------------------------------------------ *
   * Center (Video tab): upload, library, now playing
   * ------------------------------------------------------------------ */
  function makeThumbnail(file) {
    return new Promise(function (resolve) {
      if (file.type.indexOf('video/') !== 0) { resolve(null); return; }
      var v = document.createElement('video');
      var c = document.createElement('canvas');
      var url = URL.createObjectURL(file);
      var done = false;
      function finish(val) { if (done) return; done = true; URL.revokeObjectURL(url); resolve(val); }
      v.muted = true; v.preload = 'auto'; v.src = url;
      v.onloadeddata = function () { v.currentTime = Math.min(1, (v.duration || 1) / 2); };
      v.onseeked = function () {
        try {
          c.width = v.videoWidth; c.height = v.videoHeight;
          c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
          finish(c.toDataURL('image/jpeg', 0.7));
        } catch (e) { finish(null); }
      };
      v.onerror = function () { finish(null); };
      setTimeout(function () { finish(null); }, 5000);
    });
  }

  function addFiles(files) {
    var ok = Array.prototype.filter.call(files, function (f) {
      return f.type.indexOf('video/') === 0 || f.type.indexOf('audio/') === 0;
    });
    var stamp = Date.now(); // taken now, so the saved order is the order the files were added
    Promise.all(ok.map(function (f, i) {
      return makeThumbnail(f).then(function (thumb) {
        return {
          id: stamp.toString(36) + i + Math.random().toString(36).slice(2, 6),
          added: stamp + i,
          name: f.name, url: URL.createObjectURL(f), type: f.type, thumbnail: thumb, file: f
        };
      });
    })).then(function (items) {
      state.library = state.library.concat(items);
      renderMedia();
      // keep the files in browser storage so they are still here after a refresh
      items.forEach(function (it) {
        S.mediaLibrary.put({ id: it.id, added: it.added, name: it.name, type: it.type, thumbnail: it.thumbnail, file: it.file })
          .catch(function () {
            toast('Not saved for next time', it.name + ' is too big for browser storage. It works now, but add it again after a refresh.');
          });
      });
    });
  }

  var drop = $('drop'), fileIn = $('fileIn');
  drop.onclick = function () { fileIn.click(); };
  fileIn.onchange = function () { addFiles(fileIn.files); fileIn.value = ''; };
  ['dragenter', 'dragover'].forEach(function (t) {
    drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('over'); });
  });
  ['dragleave', 'drop'].forEach(function (t) {
    drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove('over'); });
  });
  drop.addEventListener('drop', function (e) { addFiles(e.dataTransfer.files); });

  function activeMedia() { return S.getJSON(K.activeMedia, null); }

  var mediaToken = 0;
  function selectMedia(file) {
    var token = ++mediaToken;
    state.hymn = null; state.verseIndex = null;
    renderPreset(); renderLyrics(); saveUi();
    var meta = { id: Date.now().toString(36), name: file.name, url: file.url, type: file.type };

    function show() {
      if (token !== mediaToken) return; // another video was picked in the meantime
      S.setJSON(K.playback, { isPlaying: true, currentTime: 0, timestamp: Date.now() });
      S.setJSON(K.activeMedia, meta);
      takeScreen();
      setPassage(null);
      renderMedia(); renderNowPlaying();
    }
    // First leave the file where the presentation window can read it (see SBVC.mediaStore), then announce it.
    S.mediaStore.put(file.file).then(function () {
      meta.idb = true;
      show();
    }).catch(function (e) {
      console.error('Could not hand the video to the presentation window', e);
      toast('Video may not reach the screen', 'Browser storage refused the file. The presentation window might stay blank.');
      show();
    });
  }

  function removeMedia(file) {
    state.library = state.library.filter(function (f) { return f.url !== file.url; });
    var am = activeMedia();
    if (am && am.url === file.url) { S.setJSON(K.activeMedia, null); S.mediaStore.clear(); S.setJSON(K.playback, null); }
    URL.revokeObjectURL(file.url);
    S.mediaLibrary.remove(file.id); // also forget it in browser storage
    renderMedia(); renderNowPlaying();
  }

  function renderMedia() {
    var host = $('media');
    host.textContent = '';
    if (!state.library.length) {
      host.appendChild(el('p', 'muted centertext', 'No media files added.'));
      return;
    }
    var am = activeMedia();
    state.library.forEach(function (f) {
      var row = el('div', 'mediarow' + (am && am.url === f.url ? ' on' : ''));
      var left = el('div', 'medialeft');
      if (f.thumbnail) {
        var img = el('img'); img.src = f.thumbnail; img.alt = f.name + ' thumbnail';
        left.appendChild(img);
      } else {
        left.appendChild(el('div', 'nothumb', '♫'));
      }
      left.appendChild(el('span', '', f.name));
      row.appendChild(left);
      var x = el('button', 'btn ghost icon', '✕');
      x.style.width = '28px'; x.style.height = '28px'; x.title = 'Remove';
      x.onclick = function (e) { e.stopPropagation(); removeMedia(f); };
      row.appendChild(x);
      row.onclick = function () { selectMedia(f); };
      host.appendChild(row);
    });
  }

  function renderNowPlaying() {
    var host = $('nowPlaying');
    var am = activeMedia();
    host.textContent = '';
    if (!am || !state.library.some(function (f) { return f.url === am.url; })) return;
    host.className = 'nowplaying';
    host.appendChild(el('h3', '', 'Now Playing'));
    var v = document.createElement('video');
    v.controls = true; v.src = am.url;
    v.className = 'nowvideo';
    // this player is the "master": the projector copies what it does
    function publish() {
      S.setJSON(K.playback, { isPlaying: !v.paused, currentTime: v.currentTime, timestamp: Date.now() });
    }
    // First jump to where the video already is (you may be coming back to this page). It only starts leading
    // once it really plays or you touch it, so a browser that blocks autoplay cannot pause the projector.
    var leading = false;
    function lead() {
      if (leading) return;
      leading = true;
      ['play', 'pause', 'seeked', 'timeupdate'].forEach(function (t) { v.addEventListener(t, publish); });
    }
    v.addEventListener('playing', lead);
    v.addEventListener('pointerdown', lead);
    v.addEventListener('loadedmetadata', function () { S.syncVideo(v); });
    host.appendChild(v);
  }

  /* ------------------------------------------------------------------ *
   * Right: preview, buttons, customization
   * ------------------------------------------------------------------ */
  var pv = S.createPreview($('preview'), { customKey: K.hymnCustom });
  var panel = S.createCustomPanel($('custom'), K.hymnCustom);
  S.makeCollapsible($('custom'), 'hymn-custom');
  S.createDesignPanel($('designHost'), { stateKey: K.hymnDesign, customKey: K.hymnCustom, name: 'hymn-design', titleLabel: 'Hymn title', textLabel: 'Lyrics' }); // Title / Text / Layout / Background open and close

  $('bShow').onclick = function () { window.open('present.html', 'present'); };
  $('bClear').onclick = function () {
    setPassage(null);
    S.setJSON(K.activeMedia, null); S.mediaStore.clear();
    S.setJSON(K.playback, null);
    state.verseIndex = null;
    renderLyrics(); renderMedia(); renderNowPlaying(); saveUi();
  };
  $('bReset').onclick = function () {
    S.setCustom({ positions: { title: { x: 0, y: 0 }, text: { x: 0, y: 0 } } }, K.hymnCustom);
  };
  function requestFullscreen() { S.setRaw(K.fullscreen, String(Date.now())); }
  $('bFull').onclick = requestFullscreen;
  document.addEventListener('keydown', function (e) {
    if (e.key.toLowerCase() !== 'f' || e.metaKey || e.ctrlKey) return;
    var t = e.target.tagName.toLowerCase();
    if (t === 'input' || t === 'textarea' || t === 'select' || t === 'video') return;
    e.preventDefault();
    requestFullscreen();
  });

  /* ------------------------------------------------------------------ *
   * Tabs + start up
   * ------------------------------------------------------------------ */
  document.querySelectorAll('#hTabs button').forEach(function (b) {
    b.onclick = function () { showTab(b.dataset.pane); saveUi(); };
  });
  function showTab(pane) {
    state.tab = pane;
    document.querySelectorAll('#hTabs button').forEach(function (x) { x.classList.toggle('on', x.dataset.pane === pane); });
    document.querySelectorAll('.hym-center .tabpane').forEach(function (p) { p.classList.toggle('on', p.id === pane); });
  }

  S.onChange(function (key) {
    if (key === K.playback) return;
    if (key === K.activeMedia || key === null) { renderMedia(); if (!activeMedia()) renderNowPlaying(); } // stopped from another page
    if (key === K.contentType && !hymnOnScreen() && state.verseIndex !== null) {
      state.verseIndex = null; renderLyrics(); saveUi(); // another page took the screen
    }
    if (key === K.hymnCustom || key === null) panel.sync();
    if (key === K.bg || key === K.bgImage || key === K.bgCss || key === K.bgImages || key === null) bgp.render();
    if (key === K.passage && !S.getJSON(K.passage, null) && state.verseIndex !== null) {
      state.verseIndex = null; renderLyrics(); saveUi(); // cleared from another window
    }
  });

  // ---- bring back what was open before the refresh / closed tab ----
  var ui = S.getJSON(K.hymnUi, null);
  if (ui) {
    if (typeof ui.search === 'string') { state.search = ui.search; $('hSearch').value = ui.search; }
    if (ui.tab === 'paneVideo' || ui.tab === 'paneHymnal') showTab(ui.tab);
    if (ui.hymn) {
      var found = presetList.filter(function (h) { return sameHymn(h, ui.hymn); })[0];
      if (found) {
        state.hymn = found;
        // the highlighted verse only comes back if it is still what the screen shows
        if (typeof ui.verseIndex === 'number' && hymnOnScreen() && S.getJSON(K.passage, null)) state.verseIndex = ui.verseIndex;
      }
    }
  }

  renderLists();
  bgp.render();
  renderPreset();
  renderLyrics();
  renderMedia();
  renderNowPlaying();
  panel.sync();
  pv.render();

  // the media library comes back from browser storage
  S.mediaLibrary.all().then(function (rows) {
    rows.sort(function (a, b) { return a.added - b.added; });
    var have = {};
    state.library.forEach(function (f) { have[f.id] = true; });
    rows.forEach(function (r) {
      if (have[r.id] || !r.file) return;
      state.library.push({ id: r.id, added: r.added, name: r.name, type: r.type, thumbnail: r.thumbnail, file: r.file, url: URL.createObjectURL(r.file) });
    });
    // a video that is still selected gets this page's own link to its file, so you can control it again
    var am = activeMedia();
    if (am) {
      var same = state.library.filter(function (f) { return f.name === am.name && f.type === am.type; })[0];
      if (same) { am.url = same.url; S.setJSON(K.activeMedia, am); renderNowPlaying(); }
    }
    renderMedia();
  }).catch(function (e) { console.error('Could not read the saved media library', e); });
})();
