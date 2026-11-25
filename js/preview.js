/* Shared live preview: a 16:9 copy of what is on the projector screen right now, whichever page put it there
 * (Bible verse, hymn, video, Preaching slide or PowerPoint slide). The title and text can be dragged when the
 * screen is showing this page's own kind of content.
 *   var pv = SBVC.createPreview(containerElement, { customKey: SBVC.KEYS.custom });
 *   pv.render();      // redraw (it also redraws by itself when the screen changes)
 *   pv.syncMedia();   // only follow the video playback state (does not redraw)
 */
(function () {
  'use strict';
  var S = window.SBVC;
  var K = S.KEYS;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  var mediaCache = { id: null, url: null };
  function mediaUrl(media) {
    if (!media.idb) return Promise.resolve(media.url);
    if (mediaCache.id === media.id && mediaCache.url) return Promise.resolve(mediaCache.url);
    return S.mediaStore.get().then(function (blob) {
      if (!blob) throw new Error('no video file in storage');
      if (mediaCache.url) URL.revokeObjectURL(mediaCache.url);
      mediaCache = { id: media.id, url: URL.createObjectURL(blob) };
      return mediaCache.url;
    });
  }

  function createPreview(container, opts) {
    var customKey = opts.customKey || null; // this page's own text style (Bible or Hymnals)
    var dragging = null;
    var video = null, videoId = null;

    function scale() { return (container.clientWidth || 318) / 1280; }
    function type() { return S.getRaw(K.contentType) || 'bible'; }

    function blank(text) {
      container.style.backgroundImage = 'none';
      container.style.backgroundColor = '#000000';
      container.style.paddingLeft = container.style.paddingRight = '0';
      container.appendChild(el('div', 'none', text));
    }

    function renderSlideScreen(ppt) {
      var deck = S.getJSON(ppt ? K.pptDeck : K.preachDeck, null);
      var idx = parseInt(S.getRaw(ppt ? K.pptLive : K.preachLive), 10);
      var slide = deck && deck.slides && !isNaN(idx) ? deck.slides[idx] : null;
      if (!slide || !S.renderSlide) { blank('No content selected'); return; }
      container.style.backgroundImage = 'none';
      container.style.backgroundColor = (slide.bg && slide.bg.color) || '#000000';
      container.style.paddingLeft = container.style.paddingRight = '0';
      var st = el('div');
      S.renderSlide(st, slide);
      st.style.position = 'absolute'; st.style.left = '0'; st.style.top = '0'; st.style.transformOrigin = '0 0';
      st.style.transform = 'scale(' + scale() + ')'; st.style.pointerEvents = 'none';
      container.appendChild(st);
    }

    function render() {
      if (dragging) return;
      var t = type();
      var media = t === 'hymnal' ? S.getJSON(K.activeMedia, null) : null;
      // the same video is already playing in the preview: leave it alone
      if (media && video && videoId === media.id && video.parentNode === container) { syncMedia(); return; }
      container.textContent = '';
      video = null; videoId = null;

      if (t === 'preaching' || t === 'powerpoint') { renderSlideScreen(t === 'powerpoint'); return; }

      var screenKey = t === 'hymnal' ? K.hymnCustom : K.custom;
      var passage = S.getJSON(K.passage, null);
      var c = S.getCustom(screenKey);
      var sc = scale();

      S.applyBackground(container, true, true);
      container.style.paddingLeft = container.style.paddingRight = (c.horizontalPadding * sc) + 'rem';

      if (media) {
        var v = el('video');
        video = v; videoId = media.id;
        v.muted = true;       // sound comes from the controller's own player
        v.playsInline = true;
        v.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;inset:0;pointer-events:none';
        container.appendChild(v);
        v.addEventListener('loadedmetadata', syncMedia);
        mediaUrl(media).then(function (url) {
          if (video !== v) return;
          v.src = url;
          syncMedia();
        }).catch(function (e) { console.error('Video could not be loaded', e); });
        return;
      }

      if (!passage) {
        container.appendChild(el('div', 'none', 'No content selected'));
        return;
      }

      var h = el('h1', '', passage.reference);
      h.style.fontFamily = S.fontFamily(c.titleFontFamily);
      h.style.fontSize = (c.titleFontSize * sc) + 'rem';
      h.style.color = c.titleColor;
      h.style.textAlign = c.textAlign;
      h.style.transform = 'translate(' + (c.positions.title.x * sc) + 'px,' + (c.positions.title.y * sc) + 'px)';

      var p = el('p', '', passage.text);
      p.style.fontFamily = S.fontFamily(c.fontFamily);
      p.style.fontSize = (c.fontSize * sc) + 'rem';
      p.style.lineHeight = c.lineHeight;
      p.style.color = c.textColor;
      p.style.textAlign = c.textAlign;
      p.style.transform = 'translate(' + (c.positions.text.x * sc) + 'px,' + (c.positions.text.y * sc) + 'px)';

      if (screenKey === customKey) {
        makeDraggable(h, 'title');
        makeDraggable(p, 'text');
      } else {
        h.style.cursor = p.style.cursor = 'default';
      }
      container.appendChild(h);
      container.appendChild(p);
    }

    function syncMedia() { if (video) S.syncVideo(video); }

    function makeDraggable(node, which) {
      node.addEventListener('pointerdown', function (e) {
        var c = S.getCustom(customKey);
        dragging = { which: which, sx: e.clientX, sy: e.clientY, ox: c.positions[which].x, oy: c.positions[which].y, scale: scale() };
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
        var c = S.getCustom(customKey);
        var positions = { title: c.positions.title, text: c.positions.text };
        positions[which] = {
          x: d.ox + (e.clientX - d.sx) / d.scale,
          y: d.oy + (e.clientY - d.sy) / d.scale
        };
        S.setCustom({ positions: positions }, customKey); // fires onChange -> render()
      }
      node.addEventListener('pointerup', end);
      node.addEventListener('pointercancel', end);
    }

    // redraw whenever something that is on the screen changes
    var WATCH = {};
    [K.passage, K.contentType, K.activeMedia, K.custom, K.hymnCustom, K.bg, K.bgImage, K.bgCss, K.bgImages,
      K.preachDeck, K.preachLive, K.pptDeck, K.pptLive, K.preachImages].forEach(function (k) { WATCH[k] = true; });
    var queued = false;
    S.onChange(function (key) {
      if (key === K.playback) { syncMedia(); return; }
      if (key !== null && !WATCH[key]) return;
      if (queued) return; // several keys often change together: draw once, after all of them
      queued = true;
      setTimeout(function () { queued = false; render(); }, 0);
    });

    if (window.ResizeObserver) new ResizeObserver(function () { render(); }).observe(container);

    return { render: render, syncMedia: syncMedia };
  }

  S.createPreview = createPreview;
})();
