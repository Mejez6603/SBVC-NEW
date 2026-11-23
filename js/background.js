/* Shared Background picker: color swatches + your own pictures (the + tile).
 * Used by the Bible controller (Customization > Background) and the Hymnals page.
 *   var bgp = SBVC.createBackgroundPicker(hostElement);
 *   bgp.render();    // call when SBVC.KEYS.bg / bgImage / bgImages changed
 * Also provides SBVC.toast(title, text) for small messages.
 */
(function () {
  'use strict';
  var S = window.SBVC;
  var K = S.KEYS;

  var COLORS = [
    ['Black', '#000000'], ['White', '#FFFFFF'], ['Light Gray', '#F2F2F2'], ['Soft Beige', '#F5F1EB'],
    ['Muted Blue', '#E8EEF5'], ['Charcoal Gray', '#2B2B2B']
  ];
  var MAX_IMAGES = 6;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  /* ---- toast (uses #toast if the page has one, otherwise creates it) ---- */
  var toastTimer = null;
  function toast(title, text) {
    var t = document.getElementById('toast');
    if (!t) { t = el('div', 'toast'); t.id = 'toast'; t.hidden = true; document.body.appendChild(t); }
    t.textContent = '';
    t.appendChild(el('b', '', title));
    t.appendChild(el('div', '', text));
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 3500);
  }
  if (!S.toast) S.toast = toast;

  /* ---- pictures ---- */
  function images() { var l = S.getJSON(K.bgImages, []); return Array.isArray(l) ? l : []; }

  // shrink the picture to screen size (max 1920 px wide) so it fits in browser storage
  function shrinkImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, 1920 / img.naturalWidth);
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.naturalWidth * scale));
        c.height = Math.max(1, Math.round(img.naturalHeight * scale));
        var g = c.getContext('2d');
        g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
        g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('not an image')); };
      img.src = url;
    });
  }

  // Saves a picture in the shared list. Resolves with the new entry {id, name, url}; shows a message and rejects on failure.
  function saveImage(file) {
    if (!file || file.type.indexOf('image/') !== 0) {
      toast('Not a picture', 'Please choose an image file (JPG, PNG, WebP...).');
      return Promise.reject(new Error('not an image'));
    }
    return shrinkImage(file).then(function (dataUrl) {
      var entry = { id: Date.now().toString(36), name: file.name, url: dataUrl };
      var json = JSON.stringify(images().concat([entry]));
      S.setRaw(K.bgImages, json);
      if (S.getRaw(K.bgImages) !== json) { // the browser refused to store it
        toast('Picture not saved', 'Browser storage is full. Remove a picture or choose a smaller one.');
        throw new Error('storage full');
      }
      return entry;
    }, function () {
      toast('Could not read the picture', 'The file may be damaged or not an image.');
      throw new Error('unreadable');
    });
  }
  S.saveBgImage = saveImage;
  S.MAX_BG_IMAGES = MAX_IMAGES;

  function addImage(file) {
    saveImage(file).then(function (entry) { S.setRaw(K.bgImage, entry.id); }).catch(function () { /* message already shown */ });
  }

  function removeImage(id) {
    S.setJSON(K.bgImages, images().filter(function (i) { return i.id !== id; }));
    if (S.getRaw(K.bgImage) === id) S.setRaw(K.bgImage, null);
  }

  /* ---- the widget ---- */
  function createBackgroundPicker(host) {
    var fileIn = el('input'); fileIn.type = 'file'; fileIn.accept = 'image/*'; fileIn.hidden = true;
    fileIn.onchange = function () { addImage(fileIn.files[0]); fileIn.value = ''; };
    host.classList.add('bgrow');

    function render() {
      host.textContent = '';
      var cur = (S.getRaw(K.bg) || '#000000').toLowerCase();
      var curImage = S.getRaw(K.bgImage) || '';

      COLORS.forEach(function (b) {
        var btn = el('button', 'bgbtn' + (!curImage && cur === b[1].toLowerCase() ? ' on' : ''));
        btn.style.backgroundColor = b[1];
        btn.title = b[0];
        btn.setAttribute('aria-label', b[0]);
        btn.onclick = function () { S.setRaw(K.bgImage, null); S.setRaw(K.bg, b[1]); };
        host.appendChild(btn);
      });

      images().forEach(function (img) {
        var wrap = el('div', 'bgimgwrap');
        var btn = el('button', 'bgbtn bgimg' + (curImage === img.id ? ' on' : ''));
        btn.style.backgroundImage = 'url("' + img.url + '")';
        btn.title = img.name;
        btn.setAttribute('aria-label', 'Background picture ' + img.name);
        btn.onclick = function () { S.setRaw(K.bgImage, img.id); };
        var x = el('button', 'bgx', '✕');
        x.title = 'Remove this picture';
        x.setAttribute('aria-label', 'Remove picture ' + img.name);
        x.onclick = function (e) { e.stopPropagation(); removeImage(img.id); };
        wrap.appendChild(btn); wrap.appendChild(x);
        host.appendChild(wrap);
      });

      var plus = el('button', 'bgbtn bgplus', '+');
      plus.title = 'Add a background picture';
      plus.setAttribute('aria-label', 'Add a background picture');
      plus.onclick = function () {
        if (images().length >= MAX_IMAGES) {
          toast('Too many pictures', 'You can keep up to ' + MAX_IMAGES + ' pictures. Remove one first.');
          return;
        }
        fileIn.click();
      };
      host.appendChild(plus);
      host.appendChild(fileIn);
    }

    render();
    return { render: render };
  }

  S.createBackgroundPicker = createBackgroundPicker;
})();
