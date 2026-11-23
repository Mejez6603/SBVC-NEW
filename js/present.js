/* Projector output. Re-draws whenever the controller changes localStorage. */
(function () {
  var S = window.SBVC;
  var screenEl = document.getElementById('screen');

  function render() {
    var passage = S.getJSON(S.KEYS.passage, null);
    var c = S.getCustom();
    var bg = S.getRaw(S.KEYS.bg) || '#000000';

    screenEl.style.backgroundColor = bg;
    screenEl.style.paddingLeft = screenEl.style.paddingRight = c.horizontalPadding + 'rem';
    screenEl.textContent = '';

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

  function goFullscreen() {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(function () { /* needs a user gesture on this window */ });
    }
  }

  S.onChange(function (key) {
    if (key === S.KEYS.fullscreen) { goFullscreen(); return; }
    if (key === S.KEYS.passage || key === S.KEYS.bg || key === S.KEYS.custom || key === null) render();
  });

  // The browser only allows fullscreen after a click/key in THIS window, so offer those too.
  document.addEventListener('dblclick', goFullscreen);
  document.addEventListener('keydown', function (e) {
    if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey) goFullscreen();
  });

  render();
})();
