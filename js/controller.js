/* SBVC controller: pick a verse, preview it, restyle it, search the Bible. */
(function () {
  'use strict';
  var S = window.SBVC;
  var K = S.KEYS;
  var BK = window.SBVC_BOOKS;

  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ------------------------------------------------------------------ *
   * Selection state (the equivalent of BibleContext)
   * ------------------------------------------------------------------ */
  var sel = {
    book: S.getRaw(K.book),
    chapter: parseInt(S.getRaw(K.chapter), 10) || null,
    verse: null,        // clicked (projected) verse number
    version: null,      // 'KJV' | 'ADB' | 'TCB' the clicked verse came from
    focus: null,        // verse jumped to from search (highlighted, not projected)
    english: 'KJV',
    tagalog: 'ADB'
  };
  if (BK.allBooks.indexOf(sel.book) < 0) { sel.book = null; sel.chapter = null; }

  function theme() { return S.getTheme(); }
  function setPassage(p) { S.setJSON(K.passage, p); }

  function selectBook(book) {
    sel.book = book; sel.chapter = 1; sel.verse = null; sel.version = null; sel.focus = null;
    S.setRaw(K.book, book); S.setRaw(K.chapter, '1');
    setPassage(null);
    renderBooks(); renderChapters(); renderVerses();
  }
  function selectChapter(ch) {
    sel.chapter = ch; sel.verse = null; sel.version = null; sel.focus = null;
    S.setRaw(K.chapter, String(ch));
    setPassage(null);
    renderChapters(); renderVerses();
  }
  function selectVerse(verse, version, text) {
    sel.verse = verse; sel.version = version; sel.focus = null;
    setPassage({ reference: sel.book + ' ' + sel.chapter + ':' + verse, text: text });
    S.setRaw(K.bg, S.bgForTheme(theme()));
    markSelectedVerses();
  }
  // used by search results: jump to a verse without projecting it
  function navigateToVerse(book, chapter, verse) {
    if (BK.allBooks.indexOf(book) < 0) return;
    sel.book = book; sel.chapter = chapter; sel.verse = null; sel.version = null; sel.focus = verse;
    S.setRaw(K.book, book); S.setRaw(K.chapter, String(chapter));
    renderBooks(); renderChapters(); renderVerses();
  }

  /* ------------------------------------------------------------------ *
   * Books / chapters
   * ------------------------------------------------------------------ */
  function renderBooks() {
    [['booksOld', BK.oldTestamentBooks], ['booksNew', BK.newTestamentBooks]].forEach(function (pair) {
      var host = $(pair[0]);
      host.textContent = '';
      var wrap = el('div', 'pad1');
      pair[1].forEach(function (book) {
        var b = el('button', 'item' + (sel.book === book ? ' sel' : ''), book);
        b.onclick = function () { selectBook(book); };
        wrap.appendChild(b);
      });
      host.appendChild(wrap);
    });
    var active = document.querySelector('.books .item.sel');
    if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
  }

  function renderChapters() {
    var host = $('chapters');
    host.textContent = '';
    if (!sel.book) {
      host.appendChild(el('p', 'empty', 'Select a book'));
      return;
    }
    host.appendChild(el('div', 'head', '#'));
    var list = el('div', 'scroll');
    list.style.flex = '1';
    var wrap = el('div', 'pad1');
    var n = BK.bookChapters[sel.book] || 0;
    for (var i = 1; i <= n; i++) {
      (function (ch) {
        var b = el('button', 'item num' + (sel.chapter === ch ? ' sel' : ''), String(ch));
        b.onclick = function () { selectChapter(ch); };
        wrap.appendChild(b);
      })(i);
    }
    list.appendChild(wrap);
    host.appendChild(list);
    var active = host.querySelector('.item.sel');
    if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
  }

  /* ------------------------------------------------------------------ *
   * Verse columns
   * ------------------------------------------------------------------ */
  var renderToken = 0;

  function renderVersionButtons() {
    var eng = $('engSel'); eng.textContent = '';
    ['KJV'].forEach(function (v) {
      var b = el('button', 'btn sm ' + (sel.english === v ? '' : 'ghost'), v);
      b.onclick = function () { sel.english = v; renderVersionButtons(); renderVerseColumn('engVerses', v); };
      eng.appendChild(b);
    });
    var tl = $('tlSel'); tl.textContent = '';
    [['ADB', 'ADB1905'], ['TCB', 'TCB2015']].forEach(function (p) {
      var b = el('button', 'btn sm ' + (sel.tagalog === p[0] ? '' : 'ghost'), p[1]);
      b.onclick = function () { sel.tagalog = p[0]; renderVersionButtons(); renderVerseColumn('tlVerses', p[0]); };
      tl.appendChild(b);
    });
  }

  function renderVerses() {
    renderVerseColumn('engVerses', sel.english);
    renderVerseColumn('tlVerses', sel.tagalog);
  }

  function renderVerseColumn(hostId, version) {
    var host = $(hostId);
    var token = (host._token = (host._token || 0) + 1);
    host.textContent = '';
    host.scrollTop = 0; // a new chapter starts at the top (a selected/focused verse scrolls itself into view)
    if (!sel.book || !sel.chapter) {
      host.appendChild(el('div', 'info', 'Select a book and chapter to view.'));
      return;
    }
    host.appendChild(el('div', 'info', 'Loading...'));
    var book = sel.book, chapter = sel.chapter;

    S.loadBook(version, book).then(function (data) {
      if (token !== host._token) return; // a newer render replaced this one
      host.textContent = '';
      var chapterData = data[String(chapter)];
      if (!chapterData) {
        host.appendChild(el('div', 'info err', 'Chapter ' + chapter + ' not found for ' + book + '.'));
        return;
      }
      var wrap = el('div');
      Object.keys(chapterData).forEach(function (vn) {
        var num = parseInt(vn, 10);
        var text = chapterData[vn];
        var b = el('button', 'verse');
        b.dataset.verse = num;
        b.dataset.version = version;
        b.appendChild(el('span', 'n', String(num)));
        b.appendChild(el('span', 't', text));
        b.onclick = function () { selectVerse(num, version, text); };
        wrap.appendChild(b);
      });
      host.appendChild(wrap);
      markSelectedVerses();
      var target = wrap.querySelector('.verse.sel') || wrap.querySelector('.verse.focus');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }).catch(function (e) {
      if (token !== host._token) return;
      host.textContent = '';
      host.appendChild(el('div', 'info err', 'Could not load ' + book + '. File not found.'));
      console.error(e);
    });
  }

  function markSelectedVerses() {
    document.querySelectorAll('.verse').forEach(function (b) {
      var n = parseInt(b.dataset.verse, 10);
      b.classList.toggle('sel', sel.verse === n && sel.version === b.dataset.version);
      b.classList.toggle('focus', sel.focus === n);
    });
  }

  /* ------------------------------------------------------------------ *
   * Live preview with draggable title/text
   * ------------------------------------------------------------------ */
  var preview = $('preview');
  var dragging = null;

  function previewScale() { return (preview.clientWidth || 1280) / 1280; }

  function renderPreview() {
    if (dragging) return;
    var passage = S.getJSON(K.passage, null);
    var c = S.getCustom();
    var scale = previewScale();

    preview.style.backgroundColor = S.getRaw(K.bg) || '#000000';
    preview.style.paddingLeft = preview.style.paddingRight = (c.horizontalPadding * scale) + 'rem';
    preview.textContent = '';

    if (!passage) {
      preview.appendChild(el('div', 'none', 'No content selected'));
      return;
    }

    var h = el('h1', '', passage.reference);
    h.style.fontFamily = S.fontFamily(c.titleFontFamily);
    h.style.fontSize = (c.titleFontSize * scale) + 'rem';
    h.style.color = c.titleColor;
    h.style.textAlign = c.textAlign;
    h.style.transform = 'translate(' + (c.positions.title.x * scale) + 'px,' + (c.positions.title.y * scale) + 'px)';

    var p = el('p', '', passage.text);
    p.style.fontFamily = S.fontFamily(c.fontFamily);
    p.style.fontSize = (c.fontSize * scale) + 'rem';
    p.style.lineHeight = c.lineHeight;
    p.style.color = c.textColor;
    p.style.textAlign = c.textAlign;
    p.style.transform = 'translate(' + (c.positions.text.x * scale) + 'px,' + (c.positions.text.y * scale) + 'px)';

    makeDraggable(h, 'title');
    makeDraggable(p, 'text');
    preview.appendChild(h);
    preview.appendChild(p);
  }

  function makeDraggable(node, which) {
    node.addEventListener('pointerdown', function (e) {
      var c = S.getCustom();
      var scale = previewScale();
      dragging = { which: which, sx: e.clientX, sy: e.clientY, ox: c.positions[which].x, oy: c.positions[which].y, scale: scale };
      node.classList.add('dragging');
      node.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    node.addEventListener('pointermove', function (e) {
      if (!dragging || dragging.which !== which) return;
      var dx = e.clientX - dragging.sx, dy = e.clientY - dragging.sy;
      node.style.transform = 'translate(' + (dragging.ox * dragging.scale + dx) + 'px,' + (dragging.oy * dragging.scale + dy) + 'px)';
    });
    function end(e) {
      if (!dragging || dragging.which !== which) return;
      var d = dragging;
      dragging = null;
      var c = S.getCustom();
      var positions = { title: c.positions.title, text: c.positions.text };
      positions[which] = {
        x: d.ox + (e.clientX - d.sx) / d.scale,
        y: d.oy + (e.clientY - d.sy) / d.scale
      };
      S.setCustom({ positions: positions }); // triggers renderPreview via onChange
    }
    node.addEventListener('pointerup', end);
    node.addEventListener('pointercancel', end);
  }

  if (window.ResizeObserver) new ResizeObserver(function () { renderPreview(); }).observe(preview);

  /* ------------------------------------------------------------------ *
   * Control buttons
   * ------------------------------------------------------------------ */
  var presentWin = null;
  $('bShow').onclick = function () {
    // same-named window is re-used, so repeated clicks do not open new tabs
    presentWin = window.open('present.html', 'present');
  };
  $('bClear').onclick = function () { setPassage(null); sel.verse = null; sel.version = null; markSelectedVerses(); };
  $('bReset').onclick = function () { S.setCustom({ positions: { title: { x: 0, y: 0 }, text: { x: 0, y: 0 } } }); };
  $('bFull').onclick = requestFullscreen;
  function requestFullscreen() { S.setRaw(K.fullscreen, String(Date.now())); }

  function renderThemeButton() { $('bTheme').textContent = theme() === 'dark' ? '☀' : '☾'; }
  $('bTheme').onclick = function () {
    var next = theme() === 'dark' ? 'light' : 'dark';
    S.setRaw(K.theme, next);
    // the screen background follows the theme right away (the original only did this on the next verse)
    S.setRaw(K.bg, S.bgForTheme(next));
    renderThemeButton();
  };

  document.addEventListener('keydown', function (e) {
    if (e.key.toLowerCase() !== 'f' || e.metaKey || e.ctrlKey) return;
    var t = e.target.tagName.toLowerCase();
    if (t === 'input' || t === 'textarea' || t === 'select') return;
    e.preventDefault();
    requestFullscreen();
  });

  /* ------------------------------------------------------------------ *
   * Customization panel
   * ------------------------------------------------------------------ */
  var FONTS = [
    ['Inter', 'Inter (Sans-serif)'], ['Literata', 'Literata (Serif)'], ['monospace', 'Monospace'],
    ['Georgia', 'Georgia'], ['Times New Roman', 'Times New Roman'], ['Roboto', 'Roboto'],
    ['Open Sans', 'Open Sans'], ['Lato', 'Lato'], ['Montserrat', 'Montserrat'], ['Oswald', 'Oswald'],
    ['Raleway', 'Raleway'], ['Merriweather', 'Merriweather'], ['Playfair Display', 'Playfair Display'],
    ['Ubuntu', 'Ubuntu'], ['Noto Sans', 'Noto Sans']
  ];
  var PRESET_COLORS = ['#D4A373', '#F5EBDD', '#FFFFFF', '#808080', '#000000'];
  var syncers = []; // functions that refresh a control from the stored customization

  function section(title) { return el('h4', '', title); }

  function fontSelect(label, key) {
    var f = el('div', 'field');
    f.appendChild(el('label', 'lbl', label));
    var s = el('select');
    FONTS.forEach(function (p) { var o = el('option', '', p[1]); o.value = p[0]; s.appendChild(o); });
    s.onchange = function () { var u = {}; u[key] = s.value; S.setCustom(u); };
    f.appendChild(s);
    syncers.push(function (c) { s.value = c[key]; });
    return f;
  }

  function slider(label, key, min, max, step, unit) {
    var f = el('div', 'field');
    var l = el('label', 'lbl');
    var r = el('input'); r.type = 'range'; r.min = min; r.max = max; r.step = step;
    r.oninput = function () { var u = {}; u[key] = parseFloat(r.value); S.setCustom(u); };
    f.appendChild(l); f.appendChild(r);
    syncers.push(function (c) { r.value = c[key]; l.textContent = label + ' (' + c[key] + unit + ')'; });
    return f;
  }

  function colorRow(label, key) {
    var f = el('div', 'field');
    f.appendChild(el('label', 'lbl', label));
    var row = el('div', 'swatches');
    var swatches = PRESET_COLORS.map(function (col) {
      var b = el('button', 'swatch'); b.style.backgroundColor = col; b.title = col;
      b.onclick = function () { var u = {}; u[key] = col; S.setCustom(u); };
      row.appendChild(b);
      return [b, col];
    });
    var pick = el('input'); pick.type = 'color'; pick.className = 'sr';
    var pb = el('button', 'btn outline icon', '🎨'); pb.title = 'Custom color';
    pb.style.width = '32px'; pb.style.height = '32px'; pb.style.borderRadius = '50%';
    pb.onclick = function () { pick.click(); };
    pick.oninput = function () { var u = {}; u[key] = pick.value; S.setCustom(u); };
    row.appendChild(pb); row.appendChild(pick);
    f.appendChild(row);
    syncers.push(function (c) {
      pick.value = c[key];
      swatches.forEach(function (s) { s[0].classList.toggle('on', c[key].toLowerCase() === s[1].toLowerCase()); });
    });
    return f;
  }

  function alignRow() {
    var f = el('div', 'field');
    f.appendChild(el('label', 'lbl', 'Text Alignment'));
    var row = el('div', 'aligns');
    var btns = [['left', 'Left'], ['center', 'Center'], ['right', 'Right'], ['justify', 'Justify']].map(function (p) {
      var b = el('button', 'btn outline', p[1]); b.style.padding = '0'; b.style.fontSize = '12px';
      b.onclick = function () { S.setCustom({ textAlign: p[0] }); };
      row.appendChild(b);
      return [b, p[0]];
    });
    f.appendChild(row);
    syncers.push(function (c) {
      btns.forEach(function (b) { b[0].className = 'btn ' + (c.textAlign === b[1] ? 'secondary' : 'outline'); });
    });
    return f;
  }

  function buildCustomPanel() {
    var host = $('custom');
    host.appendChild(section('Title'));
    host.appendChild(fontSelect('Font Family', 'titleFontFamily'));
    host.appendChild(slider('Font Size', 'titleFontSize', 1, 10, 0.25, 'rem'));
    host.appendChild(colorRow('Font Color', 'titleColor'));
    host.appendChild(el('hr', 'sep'));

    host.appendChild(section('Text'));
    host.appendChild(fontSelect('Font Family', 'fontFamily'));
    host.appendChild(slider('Font Size', 'fontSize', 1, 10, 0.25, 'rem'));
    host.appendChild(slider('Line Spacing', 'lineHeight', 1, 3, 0.1, ''));
    host.appendChild(colorRow('Font Color', 'textColor'));
    host.appendChild(alignRow());
    host.appendChild(el('hr', 'sep'));

    host.appendChild(section('Layout'));
    host.appendChild(slider('Horizontal Padding', 'horizontalPadding', 0, 10, 0.5, 'rem'));
    host.appendChild(el('hr', 'sep'));

    var pos = el('button', 'btn outline', '↻ Reset Positions');
    pos.onclick = function () { S.setCustom({ positions: { title: { x: 0, y: 0 }, text: { x: 0, y: 0 } } }); };
    host.appendChild(pos);
    host.appendChild(el('hr', 'sep'));
    var all = el('button', 'btn danger', 'Reset All Customizations');
    all.onclick = function () { S.resetCustom(); };
    host.appendChild(all);
  }

  function syncCustomPanel() {
    var c = S.getCustom();
    syncers.forEach(function (fn) { fn(c); });
  }

  /* ------------------------------------------------------------------ *
   * Search (plain text match across KJV + ADB + TCB, as in the original)
   * ------------------------------------------------------------------ */
  var searchResults = { kjv: [], adb: [], tcb: [] };
  var searchTab = 'kjv';
  var searchPage = { kjv: 1, adb: 1, tcb: 1 };
  var searching = false;
  var lastQuery = '';
  var ITEMS_PER_PAGE = 1000;

  function loadAllBooks(onProgress) {
    var jobs = [], done = 0;
    ['kjv', 'adb', 'tcb'].forEach(function (v) {
      BK.allBooks.forEach(function (b) {
        jobs.push(S.loadBook(v, b).then(function () { onProgress(++done, 198); }).catch(function () { onProgress(++done, 198); }));
      });
    });
    return Promise.all(jobs);
  }

  function runSearch() {
    var q = $('q').value.trim();
    if (!q || searching) return;
    searching = true; lastQuery = q;
    searchResults = { kjv: [], adb: [], tcb: [] };
    searchPage = { kjv: 1, adb: 1, tcb: 1 };
    $('qInfo').textContent = '';
    $('qGo').disabled = true;
    renderResults('Loading Bibles...');

    loadAllBooks(function (done, total) {
      if (done % 20 === 0 || done === total) renderResults('Loading Bibles... ' + done + '/' + total);
    }).then(function () {
      renderResults('Searching...');
      return new Promise(function (r) { setTimeout(r, 10); }); // let the UI paint
    }).then(function () {
      var term = q.toLowerCase();
      var found = []; // [bookIndex, chapter, verse]
      var seen = {};
      ['kjv', 'adb', 'tcb'].forEach(function (v) {
        BK.allBooks.forEach(function (book, bi) {
          var data = window.SBVC_BIBLE[v + '/' + book.toLowerCase().replace(/\s/g, '')];
          if (!data) return;
          for (var ch in data) for (var vs in data[ch]) {
            if (data[ch][vs].toLowerCase().indexOf(term) >= 0) {
              var key = bi + ':' + ch + ':' + vs;
              if (!seen[key]) { seen[key] = 1; found.push([bi, parseInt(ch, 10), parseInt(vs, 10)]); }
            }
          }
        });
      });
      found.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]; });
      found.forEach(function (f) {
        var book = BK.allBooks[f[0]];
        var ref = book + ' ' + f[1] + ':' + f[2];
        ['kjv', 'adb', 'tcb'].forEach(function (v) {
          var data = window.SBVC_BIBLE[v + '/' + book.toLowerCase().replace(/\s/g, '')];
          var text = data && data[f[1]] && data[f[1]][f[2]];
          searchResults[v].push({ reference: ref, book: book, chapter: f[1], verse: f[2], text: text });
        });
      });
      searching = false;
      $('qGo').disabled = false;
      var parts = [];
      if (searchResults.kjv.length) parts.push(searchResults.kjv.length + ' in KJV');
      var adbN = searchResults.adb.filter(function (x) { return x.text; }).length;
      var tcbN = searchResults.tcb.filter(function (x) { return x.text; }).length;
      if (adbN) parts.push(adbN + ' in ADB');
      if (tcbN) parts.push(tcbN + ' in TCB');
      $('qInfo').textContent = parts.length ? 'Found ' + parts.join(', ') + '.' : '';
      renderResults();
    });
  }

  function renderResults(message) {
    var host = $('results');
    host.textContent = '';
    var total = searchResults.kjv.length;
    if (message || total === 0) {
      var box = el('div', 'resbox');
      box.style.display = 'flex';
      box.appendChild(el('div', 'resmsg', message || (lastQuery ? 'No results found.' : 'Enter a term to search for in the Bible (KJV, ADB1905, TCB2015).')));
      host.appendChild(box);
      return;
    }
    var tabs = el('div', 'tabs'); tabs.style.gridTemplateColumns = '1fr 1fr 1fr';
    [['kjv', 'KJV'], ['adb', 'ADB1905'], ['tcb', 'TCB2015']].forEach(function (p) {
      var b = el('button', searchTab === p[0] ? 'on' : '', p[1]);
      b.onclick = function () { searchTab = p[0]; renderResults(); };
      tabs.appendChild(b);
    });
    host.appendChild(tabs);

    var list = searchResults[searchTab];
    var pages = Math.max(1, Math.ceil(list.length / ITEMS_PER_PAGE));
    var page = Math.min(searchPage[searchTab], pages);
    var slice = list.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    var box = el('div', 'resbox scroll');
    var re = new RegExp('(' + escapeHtml(lastQuery).replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + ')', 'gi');
    var frag = document.createDocumentFragment();
    slice.forEach(function (r) {
      var b = el('button', 'res');
      var ref = el('b', '', r.reference);
      var body = el('span');
      if (r.text) body.innerHTML = escapeHtml(r.text).replace(re, '<mark>$1</mark>');
      else { body.textContent = 'Verse not available in this version.'; body.style.fontStyle = 'italic'; }
      b.appendChild(ref); b.appendChild(body);
      b.onclick = function () { navigateToVerse(r.book, r.chapter, r.verse); };
      frag.appendChild(b);
    });
    box.appendChild(frag);
    host.appendChild(box);

    if (pages > 1) {
      var pager = el('div', 'pager');
      var prev = el('button', 'btn sm outline', 'Previous'); prev.disabled = page === 1;
      var next = el('button', 'btn sm outline', 'Next'); next.disabled = page === pages;
      prev.onclick = function () { searchPage[searchTab] = page - 1; renderResults(); };
      next.onclick = function () { searchPage[searchTab] = page + 1; renderResults(); };
      pager.appendChild(prev); pager.appendChild(el('span', '', 'Page ' + page + ' of ' + pages)); pager.appendChild(next);
      host.appendChild(pager);
    }
  }

  $('qGo').onclick = runSearch;
  $('q').addEventListener('keydown', function (e) { if (e.key === 'Enter') runSearch(); });

  // notepad: remembered between sessions
  var notes = $('notes');
  notes.value = S.getRaw(K.notes) || '';
  notes.addEventListener('input', function () { try { localStorage.setItem(K.notes, notes.value); } catch (e) {} });

  /* ------------------------------------------------------------------ *
   * Tabs + start up
   * ------------------------------------------------------------------ */
  document.querySelectorAll('#sideTabs button').forEach(function (b) {
    b.onclick = function () {
      document.querySelectorAll('#sideTabs button').forEach(function (x) { x.classList.toggle('on', x === b); });
      document.querySelectorAll('.side .tabpane').forEach(function (p) { p.classList.toggle('on', p.id === b.dataset.pane); });
    };
  });

  S.onChange(function (key) {
    if (key === K.passage || key === K.bg || key === K.custom || key === null) renderPreview();
    if (key === K.custom || key === null) syncCustomPanel();
    if (key === K.theme || key === null) renderThemeButton();
  });

  S.setRaw(K.contentType, 'bible');
  buildCustomPanel();
  syncCustomPanel();
  renderThemeButton();
  renderBooks();
  renderChapters();
  renderVersionButtons();
  renderVerses();
  renderPreview();
  renderResults();
})();
