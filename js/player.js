/* The video / audio controls that follow you to every controller page (loaded by js/nav.js).
 *
 * Who plays the SOUND while a Hymnals video is on the projector:
 *   - the Presentation window, when it is open (it never changes pages, so the video never pauses). The player
 *     here is then only a remote control with a silent copy of the picture.
 *   - otherwise the controller tab you are using. Changing pages then leaves a short gap in the sound. */
(function () {
  'use strict';
  var S = window.SBVC;
  var K = S.KEYS;

  var LOCK = 'sbvc-player'; // only one controller tab shows the player

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function clock(s) {
    if (!isFinite(s) || s < 0) s = 0;
    var m = Math.floor(s / 60), x = Math.floor(s % 60);
    return m + ':' + (x < 10 ? '0' : '') + x;
  }

  var host = document.getElementById('nowPlaying'); // the Hymnals page has a place for it
  var floating = !host;
  if (floating) {
    host = el('div');
    host.id = 'nowPlaying';
    document.body.appendChild(host);
  }

  var leader = false;     // is this the controller tab that shows the player?
  var current = null;     // {id, video, url, dead, apply}
  var projector = { open: false, sound: false };

  function guest() { try { return JSON.parse(localStorage.getItem('sbvc-live-cfg')).role === 'guest'; } catch (e) { return false; } }
  function wantedMedia() {
    if (S.getRaw(K.contentType) !== 'hymnal') return null;
    var m = S.getJSON(K.activeMedia, null);
    return m && m.idb && !guest() ? m : null; // a remote helper does not have the file
  }

  /* ---------- is the Presentation window open, and is it playing the sound? ---------- */
  function askProjector() {
    if (!navigator.locks || !navigator.locks.query) return Promise.resolve();
    return navigator.locks.query().then(function (all) {
      var names = (all.held || []).map(function (l) { return l.name; });
      var open = names.indexOf(S.PROJECTOR_OPEN) >= 0, sound = names.indexOf(S.PROJECTOR_SOUND) >= 0;
      if (open === projector.open && sound === projector.sound) return;
      projector = { open: open, sound: sound };
      if (current) current.apply();
    }).catch(function () { /* keep what we knew */ });
  }
  setInterval(function () { if (current) askProjector(); }, 300);

  function stopPlayer() {
    if (current) {
      current.dead = true; // removing the video must not change anything on the projector
      current.video.pause();
      current.video.removeAttribute('src');
      if (current.url) URL.revokeObjectURL(current.url);
      current = null;
    }
    host.textContent = '';
    host.className = '';
  }

  function stopEverywhere() {
    stopPlayer();
    S.setJSON(K.activeMedia, null);
    S.setJSON(K.playback, null);
    S.mediaStore.clear();
  }

  var starting = false;
  function update() {
    var m = leader ? wantedMedia() : null;
    if (!m) { if (current || host.firstChild) stopPlayer(); return; }
    if ((current && current.id === m.id) || starting) return;
    starting = true;
    askProjector().then(function () { // first find out whether this tab has to make the sound
      starting = false;
      var now = leader ? wantedMedia() : null;
      if (!now) { stopPlayer(); return; }
      if (current && current.id === now.id) return;
      stopPlayer();
      start(now);
    });
  }

  function start(media) {
    var v = el('video', 'nowvideo');
    var me = { id: media.id, video: v, url: null, dead: false, apply: function () {} };
    current = me;
    v.playsInline = true;
    v.muted = true;
    var born = Date.now();
    var blocked = false;  // the browser did not let this tab start the sound
    var seeking = false;  // the time bar is being dragged

    host.className = 'nowplaying' + (floating ? ' floating' : '');
    var head = el('div', 'np-head');
    head.appendChild(el('h3', '', 'Now Playing'));
    head.appendChild(el('span', 'np-name', media.name || ''));
    var stop = el('button', 'btn sm ghost', 'Stop');
    stop.type = 'button';
    stop.title = 'Stop the video and take it off the screen';
    stop.onclick = stopEverywhere;
    if (floating) {
      var min = el('button', 'btn sm ghost', '–');
      min.type = 'button'; min.title = 'Make smaller / bigger';
      min.onclick = function () { host.classList.toggle('mini'); min.textContent = host.classList.contains('mini') ? '+' : '–'; };
      head.appendChild(min);
    }
    head.appendChild(stop);
    host.appendChild(head);
    host.appendChild(v);

    // our own controls: they work the same whether the sound comes from here or from the Presentation window
    function button(title) { var b = el('button', 'btn sm ghost np-btn'); b.type = 'button'; b.title = title; return b; }
    function range(cls, label, max, step) {
      var r = el('input', cls); r.type = 'range'; r.min = 0; r.max = max; r.step = step; r.value = 0;
      r.setAttribute('aria-label', label); r.title = label;
      return r;
    }
    var bar = el('div', 'np-ctl');
    var playBtn = button('Play / pause');
    var seek = range('np-seek', 'Position in the video', 1000, 1);
    var time = el('span', 'np-time', '0:00');
    bar.appendChild(playBtn); bar.appendChild(seek); bar.appendChild(time);
    var vbar = el('div', 'np-ctl');
    var muteBtn = button('Sound on / off');
    var vol = range('np-vol', 'Volume', 1, 0.05);
    var where = el('span', 'np-where');
    vbar.appendChild(muteBtn); vbar.appendChild(vol); vbar.appendChild(where);
    host.appendChild(bar); host.appendChild(vbar);

    var resume = el('button', 'btn sm np-resume', '▶ Click to turn the sound back on');
    resume.type = 'button'; resume.hidden = true;
    host.appendChild(resume);

    function state() { return S.getJSON(K.playback, null) || { isPlaying: false, currentTime: 0, timestamp: Date.now() }; }
    function position() {
      var st = state();
      var at = st.isPlaying ? st.currentTime + Math.max(0, (Date.now() - st.timestamp) / 1000) : st.currentTime;
      return isFinite(v.duration) ? Math.min(at, v.duration) : at;
    }
    function command(isPlaying, at) { S.setJSON(K.playback, { isPlaying: isPlaying, currentTime: at, timestamp: Date.now() }); }

    function draw() {
      if (me.dead) return;
      var playing = state().isPlaying;
      playBtn.textContent = playing ? '❚❚' : '▶';
      var at = seeking ? seek.value / 1000 * (v.duration || 0) : position();
      if (!seeking) seek.value = v.duration > 0 && isFinite(v.duration) ? Math.round(at / v.duration * 1000) : 0;
      time.textContent = clock(at) + (isFinite(v.duration) ? ' / ' + clock(v.duration) : '');
      var p = S.soundPrefs.get();
      muteBtn.textContent = p.muted || !p.volume ? '🔇' : '🔊';
      if (document.activeElement !== vol) vol.value = p.volume;
    }

    // silent when the Presentation window has the sound (or for a moment while it is about to take it)
    function apply() {
      if (me.dead) return;
      var p = S.soundPrefs.get();
      var waiting = projector.open && !projector.sound && Date.now() - born < 700;
      var silent = projector.sound || waiting || p.muted;
      v.volume = p.volume;
      v.muted = silent || blocked;
      where.textContent = projector.sound ? 'Sound: Presentation window' : 'Sound: this page';
      where.title = projector.sound ? 'The video keeps playing while you change pages.' : 'Open the Presentation window (▶) so changing pages does not interrupt the sound.';
      if (projector.sound) { blocked = false; v.muted = true; }
      resume.hidden = !blocked;
      draw();
    }
    me.apply = apply;

    function follow() {
      if (me.dead || !v.src) return;
      var st = S.getJSON(K.playback, null);
      if (!st) return;
      if (!st.isPlaying) { if (!v.paused) v.pause(); return; }
      if (isFinite(v.duration) && position() >= v.duration) return;
      if (Math.abs(v.currentTime - position()) > 1.5) v.currentTime = position();
      if (v.paused) {
        v.play().catch(function () {
          if (me.dead || projector.sound) return;
          blocked = true; // keep the picture moving silently, and offer to turn the sound on
          apply();
          v.play().catch(function () {});
        });
      }
    }

    function unblock() { if (!blocked) return; blocked = false; apply(); follow(); }
    resume.onclick = unblock;

    playBtn.onclick = function () {
      unblock();
      var st = state();
      var ended = isFinite(v.duration) && position() >= v.duration - 0.3;
      if (st.isPlaying && !ended) command(false, position());
      else { var at = ended ? 0 : position(); v.currentTime = at; command(true, at); }
      follow(); draw();
    };
    seek.oninput = function () { seeking = true; draw(); };
    seek.onchange = function () {
      seeking = false;
      if (!isFinite(v.duration)) return;
      var at = seek.value / 1000 * v.duration;
      v.currentTime = at;
      command(state().isPlaying, at);
      follow(); draw();
    };
    muteBtn.onclick = function () {
      var p = S.soundPrefs.get();
      S.soundPrefs.set(p.volume || 1, !(p.muted || !p.volume));
      unblock(); apply();
    };
    vol.oninput = function () { S.soundPrefs.set(parseFloat(vol.value), false); apply(); };

    // when this tab has the sound it is the clock: tell the others where the video really is
    function report(limit) { if (!me.dead && !projector.sound && !v.muted) S.reportClock(v, limit); }
    v.addEventListener('playing', function () { report(0.25); });
    v.addEventListener('ended', function () { if (!me.dead && !projector.sound) S.reportEnded(v); });
    ['timeupdate', 'play', 'pause', 'durationchange'].forEach(function (t) { v.addEventListener(t, draw); });
    var tick = setInterval(function () {
      if (me.dead) { clearInterval(tick); return; }
      apply(); follow(); report(0.75); draw();
    }, 500);

    v.addEventListener('loadedmetadata', function () {
      if (me.dead) return;
      var at = position();
      if (isFinite(at) && at > 0.2) v.currentTime = at;
      apply();
      follow();
    });
    me.follow = follow;
    me.draw = draw;
    apply();

    S.mediaStore.get().then(function (blob) {
      if (me.dead) return;
      if (!blob) { stopPlayer(); return; }
      me.url = URL.createObjectURL(blob);
      v.src = me.url;
    }).catch(function (e) { console.error('Video could not be loaded', e); });
  }

  S.onChange(function (key) {
    if (key === K.playback) { if (current && current.follow) { current.follow(); current.draw(); } return; }
    if (key === K.activeMedia || key === K.contentType || key === null) setTimeout(update, 0);
  });
  window.addEventListener('storage', function (e) { if (S.soundPrefs.owns(e.key) && current) current.apply(); });
  // leaving the page: stop first, so a closing page never sends anything to the projector
  window.addEventListener('pagehide', function () { if (current) current.dead = true; });
  window.addEventListener('pageshow', function (e) { if (e.persisted && current) { stopPlayer(); update(); } });

  // ---- which controller tab shows the player: the one you are using ----
  function hold(options) {
    navigator.locks.request(LOCK, options, function () {
      leader = true;
      update();
      return new Promise(function () {}); // kept until this page closes or another tab takes over
    }).catch(function () { // taken over by another tab: stop here and wait in line
      leader = false;
      stopPlayer();
      hold({});
    });
  }
  if (navigator.locks) {
    hold(document.hasFocus() ? { steal: true } : {});
    window.addEventListener('focus', function () { if (!leader) hold({ steal: true }); });
  } else {
    leader = true;
    update();
  }
})();
