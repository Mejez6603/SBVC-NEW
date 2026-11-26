/* Back up everything / restore (the "Backup" button in the top menu, loaded by js/nav.js).
 * The backup is one .zip file: backup.json (slides, pictures, styles, hymn list, notes, settings) plus the
 * Hymnals videos / audio in media/. What is on the projector right now is deliberately not part of it. */
(function () {
  'use strict';
  var S = window.SBVC;
  var K = S.KEYS;
  var btn = document.getElementById('backupBtn');
  if (!btn) return;

  var NAMES = ['theme', 'bg', 'custom', 'book', 'chapter', 'notes', 'hymnCustom', 'preset', 'bgImages', 'bgImage', 'bgCss',
    'hymnDesign', 'bibleDesign', 'hymnUi', 'ctrlUi', 'preachDeck', 'preachImages', 'pptDeck'];
  var KEEP = {};
  NAMES.forEach(function (n) { KEEP[K[n]] = true; });
  function wanted(k) { return KEEP[k] === true || /^sbvc-collapsed-[\w-]{1,60}$/.test(k) || k === 'sbvc-search-perpage'; }
  // these describe the screen at this moment; they are emptied after a restore so nothing stale is projected
  var SCREEN = [K.passage, K.contentType, K.preachLive, K.pptLive, K.activeMedia, K.playback];

  var MAX_ZIP = 1024 * 1024 * 1024; // 1 GB
  var DANGER = /javascript:|<\s*script|<\s*iframe|<\s*object|<\s*embed|expression\(|@import|url\(\s*(?!['"]?data:image\/(png|jpe?g|webp|gif))/i;
  var IMG_OK = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+\/=]+$/;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function dialog(title, text, buttons) {
    var old = document.getElementById('bkDlg');
    if (old) old.remove();
    var wrap = el('div', 'impdlg'); wrap.id = 'bkDlg';
    var box = el('div', 'impbox');
    box.appendChild(el('h3', '', title));
    var p = el('p', '', text); p.style.wordBreak = 'normal';
    box.appendChild(p);
    var row = el('div', 'improw');
    (buttons || []).forEach(function (b) {
      var x = el('button', 'btn sm ' + (b.ghost ? 'ghost' : ''), b.label);
      x.type = 'button';
      x.onclick = function () { wrap.remove(); if (b.run) b.run(); };
      row.appendChild(x);
    });
    box.appendChild(row);
    wrap.appendChild(box);
    document.body.appendChild(wrap);
    return wrap;
  }
  function tell(title, text) { dialog(title, text, [{ label: 'OK' }]); }

  function needZip() {
    return window.JSZip ? Promise.resolve() : S.loadScript('js/vendor/jszip.min.js');
  }

  function sizeText(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }

  /* ---------- back up ---------- */
  function makeBackup() {
    var wait = dialog('Backing up…', 'Please wait. Large videos take a little longer.', []);
    var data = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (wanted(k)) data[k] = localStorage.getItem(k);
    }
    var count = 0;
    return needZip().then(function () {
      return S.mediaLibrary.all();
    }).then(function (rows) {
      var zip = new window.JSZip();
      var media = [];
      rows.forEach(function (r, n) {
        if (!r.file) return;
        var path = 'media/' + n + '.bin';
        zip.file(path, r.file, { compression: 'STORE' }); // videos are already compressed
        media.push({ id: r.id, added: r.added, name: r.name, type: r.type, thumbnail: r.thumbnail || null, path: path });
      });
      count = media.length;
      zip.file('backup.json', JSON.stringify({ app: 'SBVC', kind: 'backup', version: 1, created: new Date().toISOString(), data: data, media: media }),
        { compression: 'DEFLATE' });
      return zip.generateAsync({ type: 'blob' });
    }).then(function (blob) {
      var d = new Date(), two = function (n) { return (n < 10 ? '0' : '') + n; };
      var name = 'SBVC-Backup-' + d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate()) + '.sbvc-backup.zip';
      var a = el('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 60000);
      wait.remove();
      tell('Backup made', name + ' (' + sizeText(blob.size) + ', ' + count + ' video / audio file(s)) is in your Downloads. Keep a copy on a USB drive or another computer.');
      return blob;
    }).catch(function (e) {
      wait.remove(); console.error(e);
      tell('Backup failed', 'The backup could not be made. ' + String((e && e.message) || ''));
    });
  }

  /* ---------- restore ---------- */
  function valueOk(k, v) {
    if (!wanted(k) || typeof v !== 'string' || v.length > 8000000) return false;
    if (k === K.notes) return true; // plain text, only ever shown inside the notes box
    // the same checks Live mode uses for anything that comes from outside
    if (S.liveValidate && (k === K.preachDeck || k === K.pptDeck || k === K.bgImages || k === K.preachImages)) return S.liveValidate(k, v);
    if (k === K.bgImages || k === K.preachImages) return false; // cannot be checked yet
    return !DANGER.test(v);
  }

  function readBackup(file) {
    if (file.size > MAX_ZIP) return Promise.reject(new Error('The file is larger than 1 GB.'));
    var zip, info;
    return needZip().then(function () {
      return window.JSZip.loadAsync(file);
    }).then(function (z) {
      zip = z;
      var j = zip.file('backup.json');
      if (!j) throw new Error('This is not an SBVC backup file.');
      return j.async('string');
    }).then(function (text) {
      if (text.length > 30000000) throw new Error('The backup list is too large.');
      info = JSON.parse(text);
      if (!info || info.app !== 'SBVC' || info.kind !== 'backup' || info.version !== 1 || !info.data || !Array.isArray(info.media)) {
        throw new Error('This is not an SBVC backup file.');
      }
      var data = {}, skipped = 0;
      Object.keys(info.data).forEach(function (k) {
        if (valueOk(k, info.data[k])) data[k] = info.data[k]; else skipped++;
      });
      var total = 0, jobs = [];
      info.media.slice(0, 200).forEach(function (m) {
        var entry = m && /^media\/\d{1,4}\.bin$/.test(m.path) && zip.file(m.path);
        if (!entry || !/^(video|audio)\/[\w.+-]+$/.test(m.type)) { skipped++; return; }
        jobs.push({ meta: m, entry: entry });
      });
      var media = [];
      return jobs.reduce(function (chain, job) {
        return chain.then(function () {
          return job.entry.async('blob').then(function (blob) {
            total += blob.size;
            if (total > MAX_ZIP) throw new Error('The videos in this backup are larger than 1 GB.');
            var m = job.meta, name = String(m.name || 'media').slice(0, 200);
            media.push({
              id: String(m.id || Math.random().toString(36).slice(2)).slice(0, 40),
              added: Number(m.added) || Date.now(), name: name, type: m.type,
              thumbnail: typeof m.thumbnail === 'string' && IMG_OK.test(m.thumbnail) ? m.thumbnail : null,
              file: new File([blob], name, { type: m.type })
            });
          });
        });
      }, Promise.resolve()).then(function () {
        return { data: data, media: media, skipped: skipped, created: String(info.created || '').slice(0, 10) };
      });
    });
  }

  function writeData(data) {
    var before = {}, keys = [], i;
    for (i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (wanted(k) || SCREEN.indexOf(k) >= 0) keys.push(k); }
    keys.forEach(function (key) { before[key] = localStorage.getItem(key); });
    try {
      keys.forEach(function (key) { localStorage.removeItem(key); });
      Object.keys(data).forEach(function (key) { localStorage.setItem(key, data[key]); });
    } catch (e) { // not enough room: put everything back as it was
      Object.keys(data).forEach(function (key) { localStorage.removeItem(key); });
      Object.keys(before).forEach(function (key) { localStorage.setItem(key, before[key]); });
      throw new Error('Browser storage is too small for this backup. Nothing was changed.');
    }
  }

  function applyBackup(b) {
    var wait = dialog('Restoring…', 'Please wait and do not close this window.', []);
    return Promise.resolve().then(function () {
      writeData(b.data);
      return S.mediaStore.clear();
    }).then(function () {
      return S.mediaLibrary.all();
    }).then(function (old) {
      return Promise.all(old.map(function (r) { return S.mediaLibrary.remove(r.id); }));
    }).then(function () {
      return b.media.reduce(function (chain, m) { return chain.then(function () { return S.mediaLibrary.put(m); }); }, Promise.resolve());
    }).then(function () {
      location.reload();
    }).catch(function (e) {
      wait.remove(); console.error(e);
      tell('Restore failed', String((e && e.message) || 'The backup could not be restored.'));
    });
  }

  function askRestore(file) {
    var wait = dialog('Reading the backup…', file.name, []);
    return readBackup(file).then(function (b) {
      wait.remove();
      var slides = function (k) { try { return JSON.parse(b.data[k]).slides.length; } catch (e) { return 0; } };
      dialog('Restore this backup?',
        'Made ' + b.created + ': ' + slides(K.preachDeck) + ' Preaching slide(s), ' + slides(K.pptDeck) + ' PowerPoint slide(s), ' +
        b.media.length + ' video / audio file(s), plus styles, hymn list, pictures and notes.' +
        (b.skipped ? ' ' + b.skipped + ' item(s) failed the safety check and will be left out.' : '') +
        ' This REPLACES what is on this computer now and clears the projector. Close other SBVC controller tabs first.',
        [{ label: 'Replace with this backup', run: function () { applyBackup(b); } }, { label: 'Cancel', ghost: true }]);
      return b;
    }).catch(function (e) {
      wait.remove(); console.error(e);
      tell('Could not read the backup', String((e && e.message) || 'This is not an SBVC backup file.').slice(0, 160));
    });
  }

  var pick = el('input');
  pick.type = 'file'; pick.accept = '.zip'; pick.hidden = true; pick.id = 'backupIn';
  document.body.appendChild(pick);
  pick.onchange = function () {
    var f = pick.files && pick.files[0];
    pick.value = '';
    if (f) askRestore(f);
  };

  btn.onclick = function () {
    dialog('Backup', 'Save everything (slides, pictures, styles, hymn list, notes, videos) to one file, or bring it back from a file.', [
      { label: 'Back up everything', run: makeBackup },
      { label: 'Restore from a file', run: function () {
        if (localStorage.getItem('sbvc-live-cfg')) { tell('Live mode is on', 'Switch back to Local before restoring a backup.'); return; }
        pick.click();
      } },
      { label: 'Cancel', ghost: true }
    ]);
  };

  S.backup = { make: makeBackup, read: readBackup, apply: applyBackup }; // also used to test
})();
