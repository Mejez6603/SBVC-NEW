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

  // Scroll ONLY the list that holds the node (scrollIntoView can also scroll the whole page).
  function scrollWithin(node, mode) {
    var host = node.closest('.scroll');
    if (!host) return;
    var h = host.getBoundingClientRect(), n = node.getBoundingClientRect();
    if (mode === 'center') {
      var top = host.scrollTop + (n.top - h.top) - (h.height - n.height) / 2;
      host.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    } else if (n.top < h.top) {
      host.scrollTop += n.top - h.top;
    } else if (n.bottom > h.bottom) {
      host.scrollTop += n.bottom - h.bottom;
    }
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

  // remember what is open so a refresh or a closed tab brings you back to the same place
  var currentTab = 'paneMain';
  function saveUi() {
    S.setJSON(K.ctrlUi, { tagalog: sel.tagalog, verse: sel.verse, version: sel.version, tab: currentTab, query: $('q').value });
  }
  var savedUi = S.getJSON(K.ctrlUi, null);
  if (savedUi) {
    if (savedUi.tagalog === 'ADB' || savedUi.tagalog === 'TCB') sel.tagalog = savedUi.tagalog;
    // the highlighted verse only comes back if it is still what the screen shows
    var shown = S.getJSON(K.passage, null);
    if (savedUi.verse && sel.book && shown && shown.reference === sel.book + ' ' + sel.chapter + ':' + savedUi.verse &&
        ['KJV', 'ADB', 'TCB'].indexOf(savedUi.version) >= 0) {
      sel.verse = savedUi.verse; sel.version = savedUi.version;
    }
    if (typeof savedUi.query === 'string') $('q').value = savedUi.query;
  }

  function theme() { return S.getTheme(); }
  function setPassage(p) { S.setJSON(K.passage, p); }

  function selectBook(book) {
    sel.book = book; sel.chapter = 1; sel.verse = null; sel.version = null; sel.focus = null;
    S.setRaw(K.book, book); S.setRaw(K.chapter, '1');
    // the projected passage stays on screen until a new verse is clicked (or Clear is pressed)
    renderBooks(); renderChapters(); renderVerses(); saveUi();
  }
  function selectChapter(ch) {
    sel.chapter = ch; sel.verse = null; sel.version = null; sel.focus = null;
    S.setRaw(K.chapter, String(ch));
    renderChapters(); renderVerses(); saveUi();
  }
  function selectVerse(verse, version, text) {
    sel.verse = verse; sel.version = version; sel.focus = null;
    setPassage({ reference: sel.book + ' ' + sel.chapter + ':' + verse, text: text });
    markSelectedVerses();
    scrollTwinIntoView(); saveUi(); // bring the same verse of the OTHER translation into view
  }

  // The same verse number in the other column (the one that was NOT clicked)
  function scrollTwinIntoView() {
    var twin = document.querySelector('.verse.twin');
    if (twin) scrollWithin(twin, 'center');
  }
  // used by search results: jump to a verse without projecting it
  function navigateToVerse(book, chapter, verse) {
    if (BK.allBooks.indexOf(book) < 0) return;
    sel.book = book; sel.chapter = chapter; sel.verse = null; sel.version = null; sel.focus = verse;
    S.setRaw(K.book, book); S.setRaw(K.chapter, String(chapter));
    renderBooks(); renderChapters(); renderVerses(); saveUi();
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
    if (active) scrollWithin(active, 'nearest');
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
    if (active) scrollWithin(active, 'nearest');
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
      b.onclick = function () { sel.tagalog = p[0]; saveUi(); renderVersionButtons(); renderVerseColumn('tlVerses', p[0]); };
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
      var target = wrap.querySelector('.verse.sel') || wrap.querySelector('.verse.twin') || wrap.querySelector('.verse.focus');
      if (target) scrollWithin(target, 'center');
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
      // same verse number in the other translation's column: marked softly so it is easy to find
      b.classList.toggle('twin', sel.verse === n && sel.version !== null && sel.version !== b.dataset.version);
    });
  }

  // Shared widgets: live preview and customization panel (see js/preview.js, js/custompanel.js)
  var pv = S.createPreview($('preview'), { customKey: K.custom, media: false, bgImage: true });
  var panel = S.createCustomPanel($('custom'), K.custom, { background: true });
  S.makeCollapsible($('custom'), 'bible-custom'); // Title / Text / Layout / Background open and close
  S.createDesignPanel($('designHost'), { stateKey: K.bibleDesign, customKey: K.custom, name: 'bible-design', titleLabel: 'Verse reference', textLabel: 'Verse text' });

  /* ------------------------------------------------------------------ *
   * Control buttons
   * ------------------------------------------------------------------ */
  var presentWin = null;
  $('bShow').onclick = function () {
    // same-named window is re-used, so repeated clicks do not open new tabs
    presentWin = window.open('present.html', 'present');
  };
  $('bClear').onclick = function () { setPassage(null); sel.verse = null; sel.version = null; markSelectedVerses(); saveUi(); };
  $('bReset').onclick = function () { S.setCustom({ positions: { title: { x: 0, y: 0 }, text: { x: 0, y: 0 } } }); };
  $('bFull').onclick = requestFullscreen;
  function requestFullscreen() { S.setRaw(K.fullscreen, String(Date.now())); }

  function renderThemeButton() { $('bTheme').textContent = theme() === 'dark' ? '☀' : '☾'; }
  $('bTheme').onclick = function () {
    var next = theme() === 'dark' ? 'light' : 'dark';
    S.setRaw(K.theme, next);
    // the screen background follows the theme right away (the original only did this on the next verse)
    S.setRaw(K.bgImage, null);
    S.setRaw(K.bgCss, null);
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
   * Search (plain text match across KJV + ADB + TCB, as in the original)
   * ------------------------------------------------------------------ */
  var searchResults = { kjv: [], adb: [], tcb: [] };
  var searchTab = 'kjv';
  var searchPage = { kjv: 1, adb: 1, tcb: 1 };
  var searching = false;
  var lastQuery = '';
  var PER_PAGE_KEY = 'sbvc-search-perpage';
  var MAX_PER_PAGE = 50;
  var perPage = 20; // results drawn at once, 1-50 (kept between visits)
  try { var savedPP = parseInt(localStorage.getItem(PER_PAGE_KEY), 10); if (savedPP >= 1 && savedPP <= 50) perPage = savedPP; } catch (e) {}
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

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
    var pages = Math.max(1, Math.ceil(list.length / perPage));
    var page = clamp(searchPage[searchTab], 1, pages);
    searchPage[searchTab] = page;
    var from = (page - 1) * perPage;
    var slice = list.slice(from, from + perPage);

    // how many results to draw at once (1-50): fewer = lighter on memory
    var top = el('div', 'rtop');
    top.appendChild(el('span', 'muted', (from + 1) + '–' + (from + slice.length) + ' of ' + list.length));
    var pp = el('label', 'rpp');
    pp.appendChild(document.createTextNode('Per page '));
    var ppIn = el('input'); ppIn.type = 'text'; ppIn.inputMode = 'numeric'; ppIn.value = perPage; ppIn.title = 'Results shown at once (1 to 50)';
    function applyPerPage() {
      var v = parseInt(ppIn.value, 10);
      if (isNaN(v)) { ppIn.value = perPage; return; }
      v = clamp(v, 1, MAX_PER_PAGE);
      if (v !== perPage) {
        // keep the first result you were looking at on screen
        ['kjv', 'adb', 'tcb'].forEach(function (t) { searchPage[t] = Math.floor(((searchPage[t] - 1) * perPage) / v) + 1; });
        perPage = v;
        try { localStorage.setItem(PER_PAGE_KEY, String(v)); } catch (e) {}
      }
      renderResults();
    }
    ppIn.onchange = applyPerPage;
    ppIn.onkeydown = function (e) { if (e.key === 'Enter') applyPerPage(); };
    pp.appendChild(ppIn);
    top.appendChild(pp);
    host.appendChild(top);

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

    // pager: first / previous / page number / next / last
    var pager = el('div', 'pager');
    function go(p) { searchPage[searchTab] = clamp(p, 1, pages); renderResults(); }
    function pbtn(label, title, target, off) {
      var b = el('button', 'btn sm outline', label); b.title = title; b.disabled = off;
      b.onclick = function () { go(target); };
      return b;
    }
    pager.appendChild(pbtn('«', 'First page', 1, page === 1));
    pager.appendChild(pbtn('Previous', 'Previous page', page - 1, page === 1));
    var mid = el('span', 'pgmid');
    mid.appendChild(document.createTextNode('Page '));
    var pgIn = el('input'); pgIn.type = 'text'; pgIn.inputMode = 'numeric'; pgIn.value = page; pgIn.title = 'Type a page number and press Enter';
    function applyPage() { var v = parseInt(pgIn.value, 10); if (isNaN(v)) { pgIn.value = page; return; } go(v); }
    pgIn.onchange = applyPage;
    pgIn.onkeydown = function (e) { if (e.key === 'Enter') applyPage(); };
    mid.appendChild(pgIn);
    mid.appendChild(document.createTextNode(' of ' + pages));
    pager.appendChild(mid);
    pager.appendChild(pbtn('Next', 'Next page', page + 1, page === pages));
    pager.appendChild(pbtn('»', 'Last page', pages, page === pages));
    host.appendChild(pager);
  }

  $('qGo').onclick = runSearch;
  $('q').addEventListener('keydown', function (e) { if (e.key === 'Enter') runSearch(); });
  $('q').addEventListener('input', function () { saveUi(); });

  // notepad: remembered between sessions
  var notes = $('notes');
  notes.value = S.getRaw(K.notes) || '';
  notes.addEventListener('input', function () { try { localStorage.setItem(K.notes, notes.value); } catch (e) {} });

  /* ------------------------------------------------------------------ *
   * Tabs + start up
   * ------------------------------------------------------------------ */
  document.querySelectorAll('#sideTabs button').forEach(function (b) {
    b.onclick = function () { showTab(b.dataset.pane); saveUi(); };
  });
  function showTab(pane) {
    currentTab = pane;
    document.querySelectorAll('#sideTabs button').forEach(function (x) { x.classList.toggle('on', x.dataset.pane === pane); });
    document.querySelectorAll('.side .tabpane').forEach(function (p) { p.classList.toggle('on', p.id === pane); });
  }
  if (savedUi && (savedUi.tab === 'paneMain' || savedUi.tab === 'paneSearch')) showTab(savedUi.tab);

  S.onChange(function (key) {
    if (key === K.passage || key === K.bg || key === K.bgImage || key === K.bgImages || key === K.bgCss || key === K.custom || key === null) pv.render();
    if (key === K.bg || key === K.bgImage || key === K.bgCss || key === K.bgImages || key === null) panel.renderBackground();
    if (key === K.custom || key === null) panel.sync();
    if (key === K.theme || key === null) renderThemeButton();
  });

  // tells the projector window which styling to use (Bible or hymnal); re-claimed when this window gets focus
  S.setRaw(K.contentType, 'bible');
  window.addEventListener('focus', function () { if (S.getRaw(K.contentType) !== 'bible') S.setRaw(K.contentType, 'bible'); });
  panel.sync();
  renderThemeButton();
  renderBooks();
  renderChapters();
  renderVersionButtons();
  renderVerses();
  pv.render();
  renderResults();
})();
