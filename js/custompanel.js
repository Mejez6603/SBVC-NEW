/* Shared "Customization" panel (fonts, sizes, colors, alignment, padding, reset).
 * Used by the Bible controller and the Hymnals page. Each one passes its own storage key.
 *   var panel = SBVC.createCustomPanel(hostElement, SBVC.KEYS.custom);
 *   panel.sync();   // call when the stored customization changed from outside
 */
(function () {
  'use strict';
  var S = window.SBVC;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  var FONTS = [
    ['Inter', 'Inter (Sans-serif)'], ['Literata', 'Literata (Serif)'], ['monospace', 'Monospace'],
    ['Georgia', 'Georgia'], ['Times New Roman', 'Times New Roman'], ['Roboto', 'Roboto'],
    ['Open Sans', 'Open Sans'], ['Lato', 'Lato'], ['Montserrat', 'Montserrat'], ['Oswald', 'Oswald'],
    ['Raleway', 'Raleway'], ['Merriweather', 'Merriweather'], ['Playfair Display', 'Playfair Display'],
    ['Ubuntu', 'Ubuntu'], ['Noto Sans', 'Noto Sans']
  ];
  var PRESET_COLORS = ['#D4A373', '#F5EBDD', '#FFFFFF', '#808080', '#000000'];

  // line sets for the four alignment icons
  var ICON_LINES = {
    left: ['M21 6H3', 'M15 12H3', 'M17 18H3'],
    center: ['M21 6H3', 'M17 12H7', 'M19 18H5'],
    right: ['M21 6H3', 'M21 12H9', 'M21 18H7'],
    justify: ['M3 6h18', 'M3 12h18', 'M3 18h18']
  };
  function icon(name) {
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      ICON_LINES[name].map(function (d) { return '<path d="' + d + '"/>'; }).join('') + '</svg>';
  }

  // options: { background: true } adds a "Background" category (colors + your own pictures)
  function createCustomPanel(host, key, options) {
    options = options || {};
    var syncers = []; // functions that refresh one control from the stored customization

    function update(partial) { S.setCustom(partial, key); }

    function section(title) { return el('h4', '', title); }

    function fontSelect(label, prop) {
      var f = el('div', 'field');
      f.appendChild(el('label', 'lbl', label));
      var s = el('select');
      FONTS.forEach(function (p) { var o = el('option', '', p[1]); o.value = p[0]; s.appendChild(o); });
      s.onchange = function () { var u = {}; u[prop] = s.value; update(u); };
      f.appendChild(s);
      syncers.push(function (c) { s.value = c[prop]; });
      return f;
    }

    function slider(label, prop, min, max, step, unit) {
      var f = el('div', 'field');
      var l = el('label', 'lbl');
      var r = el('input'); r.type = 'range'; r.min = min; r.max = max; r.step = step;
      r.oninput = function () { var u = {}; u[prop] = parseFloat(r.value); update(u); };
      f.appendChild(l); f.appendChild(r);
      syncers.push(function (c) { r.value = c[prop]; l.textContent = label + ' (' + c[prop] + unit + ')'; });
      return f;
    }

    function colorRow(label, prop) {
      var f = el('div', 'field');
      f.appendChild(el('label', 'lbl', label));
      var row = el('div', 'swatches');
      var swatches = PRESET_COLORS.map(function (col) {
        var b = el('button', 'swatch'); b.style.backgroundColor = col; b.title = col;
        b.onclick = function () { var u = {}; u[prop] = col; update(u); };
        row.appendChild(b);
        return [b, col];
      });
      var pick = el('input'); pick.type = 'color'; pick.className = 'sr';
      var pb = el('button', 'btn outline icon', '🎨'); pb.title = 'Custom color';
      pb.style.width = '32px'; pb.style.height = '32px'; pb.style.borderRadius = '50%';
      pb.onclick = function () { pick.click(); };
      pick.oninput = function () { var u = {}; u[prop] = pick.value; update(u); };
      row.appendChild(pb); row.appendChild(pick);
      f.appendChild(row);
      syncers.push(function (c) {
        pick.value = c[prop];
        swatches.forEach(function (s) { s[0].classList.toggle('on', c[prop].toLowerCase() === s[1].toLowerCase()); });
      });
      return f;
    }

    function alignRow() {
      var f = el('div', 'field');
      f.appendChild(el('label', 'lbl', 'Text Alignment'));
      var row = el('div', 'aligns');
      var btns = [['left', 'Align left'], ['center', 'Align center'], ['right', 'Align right'], ['justify', 'Justify']].map(function (p) {
        var b = el('button', 'btn outline'); b.style.padding = '0';
        b.innerHTML = icon(p[0]); b.title = p[1]; b.setAttribute('aria-label', p[1]);
        b.onclick = function () { update({ textAlign: p[0] }); };
        row.appendChild(b);
        return [b, p[0]];
      });
      f.appendChild(row);
      syncers.push(function (c) {
        btns.forEach(function (b) { b[0].className = 'btn ' + (c.textAlign === b[1] ? 'secondary' : 'outline'); });
      });
      return f;
    }

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

    var bgp = null;
    if (options.background) {
      host.appendChild(section('Background'));
      var bgHost = el('div');
      host.appendChild(bgHost);
      bgp = S.createBackgroundPicker(bgHost);
      host.appendChild(el('hr', 'sep'));
    }

    var pos = el('button', 'btn outline', '↻ Reset Positions');
    pos.onclick = function () { update({ positions: { title: { x: 0, y: 0 }, text: { x: 0, y: 0 } } }); };
    host.appendChild(pos);
    host.appendChild(el('hr', 'sep'));
    var all = el('button', 'btn danger', 'Reset All Customizations');
    all.onclick = function () { S.resetCustom(key); };
    host.appendChild(all);

    function sync() {
      var c = S.getCustom(key);
      syncers.forEach(function (fn) { fn(c); });
    }
    sync();
    return { sync: sync, renderBackground: function () { if (bgp) bgp.render(); } };
  }

  /* Makes every section of a panel (an <h4> heading and what follows it, up to the next line or heading)
   * open and close with a click on the heading. Which ones are closed is remembered per panel name.
   *   SBVC.makeCollapsible(hostElement, 'hymn-custom');   // call again after the panel is rebuilt
   */
  function makeCollapsible(host, name) {
    var storeKey = 'sbvc-collapsed-' + name;
    function keyOf(title) { return title.replace(/\d+/g, '#'); } // 'Slide 3 background' and 'Slide 4 background' are one section
    var closed = {};
    try { closed = JSON.parse(localStorage.getItem(storeKey)) || {}; } catch (e) { closed = {}; }
    function remember() { try { localStorage.setItem(storeKey, JSON.stringify(closed)); } catch (e) {} }

    Array.prototype.slice.call(host.children).forEach(function (h) {
      if (h.tagName !== 'H4' || h.classList.contains('collapsible')) return;
      var title = h.textContent;
      var body = el('div', 'sec-body');
      var n = h.nextSibling;
      while (n && !(n.nodeType === 1 && (n.tagName === 'H4' || n.tagName === 'HR'))) {
        var next = n.nextSibling;
        body.appendChild(n);
        n = next;
      }
      h.parentNode.insertBefore(body, h.nextSibling);

      h.classList.add('collapsible');
      h.setAttribute('role', 'button');
      h.tabIndex = 0;
      h.textContent = '';
      h.appendChild(el('span', '', title));
      var chev = el('span', 'chev');
      chev.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
      h.appendChild(chev);

      function show(isClosed) {
        body.hidden = isClosed;
        h.classList.toggle('closed', isClosed);
        h.setAttribute('aria-expanded', String(!isClosed));
        h.title = isClosed ? 'Expand ' + title : 'Minimize ' + title;
      }
      var key = keyOf(title);
      function toggle() { closed[key] = !closed[key]; if (!closed[key]) delete closed[key]; remember(); show(!!closed[key]); }
      h.onclick = toggle;
      h.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } };
      show(!!closed[key]);
    });
  }

  S.createCustomPanel = createCustomPanel;
  S.makeCollapsible = makeCollapsible;
})();
