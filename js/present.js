/* Projector output. Re-draws whenever the controller changes localStorage. */
(function () {
  var S = window.SBVC;
  var K = S.KEYS;
  var screenEl = document.getElementById('screen');
  var video = null;

  // Preaching: draw the live slide on a 1280x720 stage, scaled to fill the screen (letterboxed in the slide's own color)
  function renderPreaching() {
    var deck = S.getJSON(K.preachDeck, null);
    var idx = parseInt(S.getRaw(K.preachLive), 10);
    var slide = deck && deck.slides && !isNaN(idx) ? deck.slides[idx] : null;
    screenEl.style.paddingLeft = screenEl.style.paddingRight = '0';
    screenEl.textContent = '';
    video = null;
    if (!slide) {
      screenEl.style.backgroundColor = '#000000';
      screenEl.style.backgroundImage = 'none';
      var idle = document.createElement('div');
      idle.className = 'idle';
      idle.textContent = 'Show Bible Verse Controller';
      screenEl.appendChild(idle);
      return;
    }
    screenEl.style.backgroundImage = 'none';
    screenEl.style.backgroundColor = (slide.bg && slide.bg.color) || '#000000';
    var stage = document.createElement('div');
    var s = Math.min(window.innerWidth / S.STAGE_W, window.innerHeight / S.STAGE_H);
    S.renderSlide(stage, slide);
    stage.style.position = 'absolute';
    stage.style.transformOrigin = '0 0';
    stage.style.transform = 'scale(' + s + ')';
    stage.style.left = Math.round((window.innerWidth - S.STAGE_W * s) / 2) + 'px';
    stage.style.top = Math.round((window.innerHeight - S.STAGE_H * s) / 2) + 'px';
    screenEl.style.position = 'relative';
    screenEl.appendChild(stage);
  }

  function render() {
    if (S.getRaw(K.contentType) === 'preaching') { renderPreaching(); return; }
    screenEl.style.position = '';
    var passage = S.getJSON(K.passage, null);
    var media = S.getJSON(K.activeMedia, null);
    // the Hymnals page has its own styling, separate from the Bible page
    var customKey = S.getRaw(K.contentType) === 'hymnal' ? K.hymnCustom : K.custom;
    var c = S.getCustom(customKey);
    // background color, or your own picture if one is chosen
    S.applyBackground(screenEl, true, true);
    screenEl.style.paddingLeft = screenEl.style.paddingRight = c.horizontalPadding + 'rem';
    screenEl.textContent = '';
    video = null;

    if (media) {
      var v = document.createElement('video');
      video = v;
      v.muted = true;        // the sound plays from the controller computer
      v.playsInline = true;
      v.style.cssText = 'width:100%;height:100%;object-fit:cover';
      screenEl.appendChild(v);
      v.addEventListener('loadedmetadata', syncMedia);
      getMediaUrl(media).then(function (url) {
        if (video !== v) return;   // the screen changed again while the file was loading
        v.src = url;
        syncMedia();
      }).catch(function (e) { console.error('Video could not be loaded', e); });
      return;
    }

    if (!passage) {
      var idle = document.createElement('div');
      idle.className = 'idle';
      idle.textContent = 'Show Bible Verse Controller';
      screenEl.appendChild(idle);
      return;
    }

    var wrap = document.createElement('div');
    wrap.className = 'wrap';

    var h = document.createElement('h1');
    h.textContent = passage.reference;
    h.style.fontFamily = S.fontFamily(c.titleFontFamily);
    h.style.fontSize = c.titleFontSize + 'rem';
    h.style.color = c.titleColor;
    h.style.textAlign = c.textAlign;
    h.style.transform = 'translate(' + c.positions.title.x + 'px,' + c.positions.title.y + 'px)';

    var p = document.createElement('p');
    p.textContent = passage.text;
    p.style.fontFamily = S.fontFamily(c.fontFamily);
    p.style.fontSize = c.fontSize + 'rem';
    p.style.lineHeight = c.lineHeight;
    p.style.color = c.textColor;
    p.style.textAlign = c.textAlign;
    p.style.transform = 'translate(' + c.positions.text.x + 'px,' + c.positions.text.y + 'px)';

    wrap.appendChild(h);
    wrap.appendChild(p);
    screenEl.appendChild(wrap);
  }

  function syncMedia() { if (video) S.syncVideo(video); }

  // The controller leaves the video FILE in IndexedDB (media.idb). We make our own link to it,
  // and keep it while the same video stays selected.
  var cache = { id: null, url: null };
  function getMediaUrl(media) {
    if (!media.idb) return Promise.resolve(media.url);
    if (cache.id === media.id && cache.url) return Promise.resolve(cache.url);
    return S.mediaStore.get().then(function (blob) {
      if (!blob) throw new Error('no video file in storage');
      if (cache.url) URL.revokeObjectURL(cache.url);
      cache = { id: media.id, url: URL.createObjectURL(blob) };
      return cache.url;
    });
  }

  function goFullscreen() {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(function () { /* needs a user gesture on this window */ });
    }
  }

  S.onChange(function (key) {
    if (key === K.fullscreen) { goFullscreen(); return; }
    if (key === K.playback) { syncMedia(); return; }
    if (key === K.passage || key === K.bg || key === K.custom || key === K.hymnCustom ||
        key === K.contentType || key === K.activeMedia || key === K.bgImage || key === K.bgCss || key === K.bgImages ||
        key === K.preachDeck || key === K.preachLive || key === K.preachImages || key === null) render();
  });
  window.addEventListener('resize', function () { if (S.getRaw(K.contentType) === 'preaching') renderPreaching(); });

  // The audience cannot select, copy, drag or right-click the text.
  ['selectstart', 'copy', 'cut', 'dragstart', 'contextmenu'].forEach(function (type) {
    document.addEventListener(type, function (e) { e.preventDefault(); });
  });
  document.addEventListener('mousedown', function (e) {
    if (e.detail > 1) e.preventDefault(); // stops double/triple-click word selection (fullscreen on dblclick still works)
  });

  // The browser only allows fullscreen after a click/key in THIS window, so offer those too.
  document.addEventListener('dblclick', goFullscreen);
  document.addEventListener('keydown', function (e) {
    if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey) goFullscreen();
  });

  render();
})();
