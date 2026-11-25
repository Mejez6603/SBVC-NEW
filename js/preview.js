/* Shared live preview (16:9 copy of the projector screen) with draggable title and text.
 *   var pv = SBVC.createPreview(containerElement, { customKey: SBVC.KEYS.custom, media: false });
 *   pv.render();      // redraw (passage, background, customization or media changed)
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

  function createPreview(container, opts) {
    var customKey = opts.customKey;
    var withMedia = !!opts.media;
    var dragging = null;
    var video = null;

    function scale() { return (container.clientWidth || 1280) / 1280; }

    function render() {
      if (dragging) return;
      var passage = S.getJSON(K.passage, null);
      var media = withMedia ? S.getJSON(K.activeMedia, null) : null;
      var c = S.getCustom(customKey);
      var sc = scale();

      S.applyBackground(container, !!opts.bgImage, !!opts.bgImage);
      container.style.paddingLeft = container.style.paddingRight = (c.horizontalPadding * sc) + 'rem';
      container.textContent = '';
      video = null;

      if (media) {
        video = document.createElement('video');
        video.src = media.url;
        video.muted = true;       // sound comes from the controller's own player
        video.playsInline = true;
        video.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;inset:0;pointer-events:none';
        container.appendChild(video);
        video.addEventListener('loadedmetadata', syncMedia);
        syncMedia();
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

      makeDraggable(h, 'title');
      makeDraggable(p, 'text');
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

    if (window.ResizeObserver) new ResizeObserver(function () { render(); }).observe(container);

    return { render: render, syncMedia: syncMedia };
  }

  S.createPreview = createPreview;
})();
