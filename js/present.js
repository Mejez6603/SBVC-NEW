/* Projector output. Re-draws whenever the controller changes localStorage. */
(function () {
  var S = window.SBVC;
  var K = S.KEYS;
  var screenEl = document.getElementById('screen');
  var video = null;

  // Preaching: draw the live slide on a 1280x720 stage, scaled to fill the screen (letterboxed in the slide's own color)
  function renderPreaching() {
    var ppt = S.getRaw(K.contentType) === 'powerpoint'; // the PowerPoint page has its own slides
    var deck = S.getJSON(ppt ? K.pptDeck : K.preachDeck, null);
    var idx = parseInt(S.getRaw(ppt ? K.pptLive : K.preachLive), 10);
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

  function isSlides() { var c = S.getRaw(K.contentType); return c === 'preaching' || c === 'powerpoint'; }

  function render() {
    if (isSlides()) { dropVideo(); renderPreaching(); return; }
    screenEl.style.position = '';
    var passage = S.getJSON(K.passage, null);
    var media = S.getRaw(K.contentType) === 'hymnal' ? S.getJSON(K.activeMedia, null) : null;
    // the same video is already playing: leave it alone
    if (media && video && video.parentNode === screenEl && video.dataset.id === String(media.id)) { syncMedia(); return; }
    // the Hymnals page has its own styling, separate from the Bible page
    var customKey = S.getRaw(K.contentType) === 'hymnal' ? K.hymnCustom : K.custom;
    var c = S.getCustom(customKey);
    // background color, or your own picture if one is chosen
    S.applyBackground(screenEl, true, true);
    screenEl.style.paddingLeft = screenEl.style.paddingRight = media ? c.horizontalPadding + 'rem' : '0';
    dropVideo();
    screenEl.textContent = '';

    if (media) {
      var v = document.createElement('video');
      video = v;
      v.dataset.id = String(media.id);
      v.muted = true;        // starts silent; startSound() turns the sound on
      v.playsInline = true;
      v.style.cssText = 'width:100%;height:100%;object-fit:cover';
      screenEl.appendChild(v);
      v.addEventListener('loadedmetadata', function () { syncMedia(); startSound(); });
      v.addEventListener('playing', function () { if (video === v && hasSound) S.reportClock(v, 0.25); });
      v.addEventListener('ended', function () { if (video === v && hasSound) S.reportEnded(v); });
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

    var made = S.passageStage(passage, c);
    screenEl.style.position = 'relative';
    screenEl.appendChild(made.stage);
    S.fitStage(made.stage, window.innerWidth, window.innerHeight);
  }

  function syncMedia() { if (video) S.syncVideo(video, hasSound ? 0.4 : 1.5); } // with the sound, small jumps are obeyed too
  function dropVideo() {
    if (video) { video.pause(); video.removeAttribute('src'); }
    video = null;
    showHint(false);
  }

  /* ---------- sound ----------
   * This window never changes pages, so when it plays the sound the video is not interrupted while the operator
   * moves between the controller pages. Browsers may ask for one click in this window before they allow it. */
  var allowed = false;  // the browser lets this window play sound
  var hasSound = false; // and this is the (only) Presentation window doing it
  var testing = false;
  var hint = null;
  if (navigator.locks) {
    navigator.locks.request(S.PROJECTOR_OPEN, { mode: 'shared' }, function () { return new Promise(function () {}); });
  }

  function showHint(on) {
    if (on && !hint) {
      hint = document.createElement('div');
      hint.className = 'soundhint';
      hint.textContent = 'Click here once so the video sound plays without breaks';
      document.body.appendChild(hint);
    } else if (!on && hint) { hint.remove(); hint = null; }
  }
  function applySound() {
    if (!video) return;
    var p = S.soundPrefs.get();
    video.volume = p.volume;
    video.muted = !hasSound || p.muted;
  }
  function takeSound() { // only one Presentation window may make the sound
    navigator.locks.request(S.PROJECTOR_SOUND, function () {
      hasSound = true;
      applySound();
      return new Promise(function () {}); // kept until this window closes
    });
  }
  function startSound() {
    var v = video;
    if (!v || !v.src || !navigator.locks) return; // old browser: the controller keeps the sound
    if (allowed) { applySound(); return; }
    if (testing) return;
    testing = true;
    // try (at volume 0) whether the browser lets us play with sound
    v.volume = 0;
    v.muted = false;
    v.play().then(function () {
      testing = false;
      v.muted = true;
      if (video !== v) { startSound(); return; }
      allowed = true;
      showHint(false);
      takeSound();
      applySound();
      syncMedia(); // pauses again if the video is meant to be paused
    }).catch(function (e) {
      testing = false;
      v.muted = true;
      if (video !== v) { startSound(); return; }
      if (e && e.name === 'NotAllowedError') showHint(true); // the controller page plays the sound meanwhile
      syncMedia();
    });
  }
  setInterval(function () {
    if (!video || !video.readyState) return;
    if (hasSound && !video.paused) S.reportClock(video, 0.75); else syncMedia();
  }, 1000);
  window.addEventListener('storage', function (e) { if (S.soundPrefs.owns(e.key)) applySound(); });
  ['pointerdown', 'keydown'].forEach(function (type) {
    document.addEventListener(type, function () { if (!allowed) startSound(); });
  });

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
    if (key === K.contentType || key === null) { queueRender(); return; }
    if (onScreen(key)) queueRender();
  });

  // Work on other pages (editing slides, choosing styles...) must not disturb what is on the screen
  function onScreen(key) {
    var c = S.getRaw(K.contentType) || 'bible';
    if (key === K.bgImages) return true;
    if (c === 'preaching') return key === K.preachDeck || key === K.preachLive || key === K.preachImages;
    if (c === 'powerpoint') return key === K.pptDeck || key === K.pptLive || key === K.preachImages;
    if (key === K.bg || key === K.bgImage || key === K.bgCss || key === K.passage) return true;
    if (c === 'hymnal') return key === K.hymnCustom || key === K.activeMedia;
    return key === K.custom;
  }
  var queued = false;
  function queueRender() { // several keys often change together: draw once, after all of them
    if (queued) return;
    queued = true;
    setTimeout(function () { queued = false; render(); }, 0);
  }
  window.addEventListener('resize', function () {
    if (isSlides()) { renderPreaching(); return; }
    var st = screenEl.querySelector('.pstage');
    if (st) S.fitStage(st, window.innerWidth, window.innerHeight);
  });

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
    // a clicker or arrow key pressed while this window is in front: pass it to the controller page
    var d = S.stepOfKey(e);
    if (d) { e.preventDefault(); S.setJSON(K.remoteStep, { d: d, t: Date.now(), n: Math.random() }); }
  });

  render();
})();
