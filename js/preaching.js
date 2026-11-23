/* SBVC Preaching: a small PowerPoint-style editor. Slides on the left, the big slide in the middle,
 * Format / Bible panels on the right. The slide you mark LIVE (▶ Present) appears on present.html.
 */
(function () {
  'use strict';
  var S = window.SBVC;
  var K = S.KEYS;
  var BK = window.SBVC_BOOKS;
  var W = S.STAGE_W, H = S.STAGE_H;

  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var FONTS = ['Inter', 'Literata', 'Georgia', 'Times New Roman', 'Roboto', 'Open Sans', 'Lato', 'Montserrat',
    'Oswald', 'Raleway', 'Merriweather', 'Playfair Display', 'Ubuntu', 'Noto Sans', 'monospace'];
  var COLORS = ['#D4A373', '#F5EBDD', '#FFFFFF', '#FACC15', '#60A5FA', '#808080', '#000000'];
  var BG_COLORS = ['#000000', '#FFFFFF', '#F2F2F2', '#F5F1EB', '#E8EEF5', '#2B2B2B', '#0B1D3A', '#3B0A0A'];
  var VERSIONS = [['kjv', 'KJV (English)'], ['adb', 'ADB (Tagalog)'], ['tcb', 'TCB (Tagalog)']];

  /* ------------------------------------------------------------------ *
   * Deck
   * ------------------------------------------------------------------ */
  function textStyle(size, color, bold, align) {
    return { fontFamily: 'Inter', fontSize: size, color: color, bold: !!bold, italic: false, align: align || 'center', lineHeight: 1.25 };
  }
  function newTextEl(text, y, h, size, color, bold) {
    return { id: uid(), type: 'text', x: 80, y: y, w: 1120, h: h, text: text, style: textStyle(size, color, bold) };
  }
  function newSlide(withText) {
    var s = { id: uid(), bg: { color: '#000000', imageId: '' }, elements: [] };
    if (withText) {
      s.elements.push(newTextEl('Sermon Title', 200, 150, 88, '#D4A373', true));
      s.elements.push(newTextEl('Click here and type', 380, 120, 44, '#F5EBDD', false));
    }
    var th = currentTheme();
    if (th) themeSlide(s, th);
    return s;
  }

  /* ------------------------------------------------------------------ *
   * Design templates (themes): a background, a heading font + color, a body font + color, an accent
   * id, name, base color, background layers (CSS), heading color, body color, accent, heading font, body font
   * ------------------------------------------------------------------ */
  // A design = a background shape (CSS with {bg} {bg2} {ac} {ac2} for its colors) + heading/body fonts + its own six colors.
  // Colors c = [background, background 2, heading, body text, accent, accent 2]
  function T(id, name, shape, dark, c, tf, bf) {
    return { id: id, name: name, shape: shape, dark: dark, c: { bg: c[0], bg2: c[1], title: c[2], body: c[3], ac: c[4], ac2: c[5] }, title: { font: tf }, body: { font: bf } };
  }
  function fill(shape, c) {
    return shape.replace(/\{bg2\}/g, c.bg2).replace(/\{bg\}/g, c.bg).replace(/\{ac2\}/g, c.ac2).replace(/\{ac\}/g, c.ac);
  }
  var BAND = function (at) { return 'linear-gradient(to bottom, transparent ' + at + '%, {ac} ' + at + '%)'; };
  var THEMES = [
    T('office-light', 'Office Light', '', false, ['#FFFFFF', '#FFFFFF', '#1F2937', '#374151', '#2563EB', '#F59E0B'], 'Inter', 'Inter'),
    T('office-dark', 'Office Dark (SBVC)', '', true, ['#000000', '#000000', '#D4A373', '#F5EBDD', '#D4A373', '#FACC15'], 'Inter', 'Inter'),
    T('sky-corner', 'Sky Corner', 'linear-gradient(135deg, transparent 64%, {ac} 64%, {ac} 84%, {ac2} 84%)', false, ['#FFFFFF', '#FFFFFF', '#111827', '#374151', '#38BDF8', '#F97316'], 'Montserrat', 'Montserrat'),
    T('slate-mist', 'Slate Mist', 'linear-gradient(160deg, {bg2}, {bg})', true, ['#374151', '#6B7280', '#F3F4F6', '#E5E7EB', '#FCD34D', '#F59E0B'], 'Raleway', 'Raleway'),
    T('warm-paper', 'Warm Paper', BAND(92), false, ['#FAF3E8', '#F0E2CC', '#7C2D12', '#44403C', '#C2410C', '#F59E0B'], 'Playfair Display', 'Lato'),
    T('olive-garden', 'Olive Garden', 'linear-gradient(90deg, transparent 88%, {ac2} 88%, {ac2} 94%, {ac} 94%)', false, ['#F7F7E8', '#ECECD0', '#365314', '#3F3F46', '#4D7C0F', '#84CC16'], 'Merriweather', 'Open Sans'),
    T('midnight', 'Midnight', 'radial-gradient(circle at 70% 20%, {bg2}, {bg} 70%)', true, ['#020617', '#1E3A8A', '#FFFFFF', '#CBD5E1', '#FBBF24', '#38BDF8'], 'Montserrat', 'Open Sans'),
    T('black-gold', 'Black Gold', BAND(94), true, ['#0A0A0A', '#1C1917', '#D4A373', '#F5EBDD', '#D4A373', '#FACC15'], 'Playfair Display', 'Inter'),
    T('ocean', 'Ocean', 'linear-gradient(135deg, {bg2}, {bg})', true, ['#1E3A8A', '#0EA5E9', '#FFFFFF', '#E0F2FE', '#FDE68A', '#38BDF8'], 'Ubuntu', 'Ubuntu'),
    T('teal-deep', 'Deep Teal', 'linear-gradient(160deg, {bg2}, {bg})', true, ['#134E4A', '#0F766E', '#F0FDFA', '#CCFBF1', '#FCD34D', '#2DD4BF'], 'Lato', 'Lato'),
    T('crimson', 'Crimson', 'linear-gradient(to bottom, {bg2}, {bg})', true, ['#450A0A', '#991B1B', '#FEF2F2', '#FECACA', '#FCD34D', '#F87171'], 'Playfair Display', 'Open Sans'),
    T('royal-purple', 'Royal Purple', 'linear-gradient(135deg, {bg2}, {bg})', true, ['#1E1B4B', '#6D28D9', '#FFFFFF', '#E9D5FF', '#FDE047', '#C084FC'], 'Raleway', 'Raleway'),
    T('sunrise', 'Sunrise', 'linear-gradient(180deg, {bg2}, {ac2} 55%, {bg})', true, ['#9A3412', '#FDBA74', '#FFFFFF', '#FFEDD5', '#451A03', '#F97316'], 'Oswald', 'Open Sans'),
    T('forest', 'Forest', 'linear-gradient(160deg, {bg2}, {bg})', true, ['#052E16', '#166534', '#ECFCCB', '#D9F99D', '#FDE68A', '#86EFAC'], 'Merriweather', 'Noto Sans'),
    T('red-banner', 'Red Banner', 'linear-gradient(to bottom, {ac} 8%, transparent 8%)', false, ['#FFFFFF', '#FFFFFF', '#111827', '#374151', '#B91C1C', '#F59E0B'], 'Inter', 'Inter'),
    T('bold-edge', 'Bold Edge', 'linear-gradient(90deg, transparent 94%, {ac} 94%)', false, ['#FFFFFF', '#F3F4F6', '#111827', '#404040', '#C2410C', '#F59E0B'], 'Oswald', 'Open Sans'),
    T('soft-blue', 'Soft Blue', 'linear-gradient(160deg, {bg}, {bg2})', false, ['#FFFFFF', '#DBEAFE', '#1E3A8A', '#334155', '#2563EB', '#38BDF8'], 'Lato', 'Lato'),
    T('lavender', 'Lavender', 'linear-gradient(160deg, {bg}, {bg2})', false, ['#FFFFFF', '#EDE9FE', '#5B21B6', '#3F3F46', '#7C3AED', '#C084FC'], 'Raleway', 'Open Sans'),
    T('rose', 'Rose', 'linear-gradient(160deg, {bg}, {bg2})', false, ['#FFF1F2', '#FECDD3', '#9F1239', '#44403C', '#E11D48', '#FB7185'], 'Playfair Display', 'Lato'),
    T('mint', 'Mint', 'linear-gradient(160deg, {bg}, {bg2})', false, ['#F0FDF4', '#BBF7D0', '#14532D', '#374151', '#16A34A', '#4ADE80'], 'Open Sans', 'Open Sans'),
    T('sand', 'Sand', 'linear-gradient(to bottom, {bg}, {bg2})', false, ['#F5EBDD', '#E7D3B7', '#78350F', '#57534E', '#B45309', '#D97706'], 'Georgia', 'Inter'),
    T('charcoal', 'Charcoal', 'linear-gradient(160deg, {bg2}, {bg})', true, ['#18181B', '#3F3F46', '#FFFFFF', '#D4D4D8', '#F59E0B', '#FBBF24'], 'Roboto', 'Roboto'),
    T('steel', 'Steel Blue', 'linear-gradient(135deg, {bg2}, {bg})', true, ['#0F172A', '#334155', '#E2E8F0', '#CBD5E1', '#38BDF8', '#818CF8'], 'Noto Sans', 'Noto Sans'),
    T('neon', 'Neon Night', 'linear-gradient(to bottom, transparent 94%, {ac} 94%, {ac} 97%, {ac2} 97%)', true, ['#030712', '#111827', '#FFFFFF', '#D1D5DB', '#22D3EE', '#EC4899'], 'Montserrat', 'Inter'),
    T('amber', 'Amber', 'linear-gradient(135deg, {bg2}, {bg} 70%)', true, ['#1C1917', '#78350F', '#FDE68A', '#FEF3C7', '#F59E0B', '#FBBF24'], 'Merriweather', 'Lato'),
    T('chalkboard', 'Chalkboard', 'radial-gradient(circle at 50% 40%, {bg2}, {bg})', true, ['#14281D', '#2F5D43', '#F5F5F4', '#E7E5E4', '#FDE68A', '#86EFAC'], 'Ubuntu', 'Ubuntu'),
    T('burgundy', 'Burgundy Gold', 'linear-gradient(135deg, {bg2}, {bg})', true, ['#2A0A18', '#581C34', '#F5D0A9', '#FCE7F3', '#F5D0A9', '#E9B872'], 'Playfair Display', 'Open Sans'),
    T('graphite-red', 'Graphite Red', 'linear-gradient(90deg, {ac2} 3%, {bg} 3%)', true, ['#18181B', '#27272A', '#FFFFFF', '#E4E4E7', '#F87171', '#B91C1C'], 'Oswald', 'Inter'),
    T('sky-day', 'Sky Day', 'linear-gradient(180deg, {bg2}, {bg})', false, ['#E0F2FE', '#38BDF8', '#0C4A6E', '#075985', '#0369A1', '#0EA5E9'], 'Raleway', 'Raleway'),
    T('church-gold', 'Church Gold', BAND(90), false, ['#FFFBEB', '#FEF3C7', '#78350F', '#451A03', '#B45309', '#D97706'], 'Playfair Display', 'Lato')
  ];

  // Color schemes (like PowerPoint's "Colors" list): dark 1, light 1, dark 2, light 2, then four accents.
  // They recolor whichever design is chosen. (The names follow PowerPoint's list; the colors are our own approximations.)
  var SCHEME_DATA = [
    ['Office', '#1F2937', '#FFFFFF', '#1E3A5F', '#E7ECF3', '#4F81BD', '#C0504D', '#9BBB59', '#8064A2'],
    ['Grayscale', '#000000', '#FFFFFF', '#2B2B2B', '#EDEDED', '#808080', '#A0A0A0', '#B8B8B8', '#5C5C5C'],
    ['Adjacency', '#2F2B20', '#FFFFFF', '#4B4535', '#EFEBDD', '#A9A57C', '#9CBEBD', '#D2CB6C', '#95A39D'],
    ['Angles', '#242852', '#FFFFFF', '#26263D', '#E3E3EC', '#4F6FB5', '#E36C3A', '#D4A14B', '#ACCBF9'],
    ['Apex', '#2C2C2C', '#FFFFFF', '#3B3151', '#EDE8F2', '#69676D', '#CEB966', '#9CB084', '#6BB1C9'],
    ['Apothecary', '#3D3D2E', '#FFFFFF', '#4F4A36', '#EEEBDB', '#CF543F', '#B5AE53', '#848058', '#93A299'],
    ['Aspect', '#323232', '#FFFFFF', '#5B3A29', '#F0E8E1', '#F07F09', '#9F2936', '#1B587C', '#4E8542'],
    ['Austin', '#2E2E2E', '#FFFFFF', '#46483A', '#F0EEDB', '#94C600', '#FF6700', '#71685A', '#909465'],
    ['Black Tie', '#2A2723', '#FFFFFF', '#46464A', '#EDEBE3', '#6F6F74', '#A7B789', '#BEAE98', '#92A9B9'],
    ['Civic', '#242C3A', '#FFFFFF', '#3D4A5C', '#E8EBEF', '#D16349', '#CCB400', '#8CADAE', '#8C7B70'],
    ['Clarity', '#292934', '#FFFFFF', '#3E4256', '#EBEBF2', '#93A299', '#AD8F67', '#726056', '#4C5A6A'],
    ['Composite', '#2D2D2D', '#FFFFFF', '#4C5058', '#E9EAEC', '#98C723', '#59B0B9', '#DEAE00', '#B77BB4'],
    ['Concourse', '#242424', '#FFFFFF', '#3B3F5C', '#E6E8F0', '#2DA2BF', '#DA1F28', '#EB641B', '#39639D'],
    ['Couture', '#2B2A29', '#FFFFFF', '#4B4743', '#EEEBE6', '#9E8E5C', '#A09781', '#85776D', '#AEAFA9'],
    ['Elemental', '#212D3B', '#FFFFFF', '#3A4B5E', '#E5EAF0', '#629DD1', '#297FD5', '#7F8FA9', '#4D597F'],
    ['Equity', '#3A2E2C', '#FFFFFF', '#4E3C38', '#F0E9E7', '#D34817', '#9B2D1F', '#A28E6A', '#956251'],
    ['Essential', '#262626', '#FFFFFF', '#46433B', '#EFEEE9', '#C8161D', '#E0A528', '#6E8B3D', '#2D6E9E'],
    ['Executive', '#2A2F36', '#FFFFFF', '#3B4F63', '#E8EDF2', '#6076B4', '#9C5252', '#E68422', '#846648'],
    ['Flow', '#04617B', '#FFFFFF', '#0F6FC6', '#DBF5F9', '#0F6FC6', '#009DD9', '#0BD0D9', '#10CF9B'],
    ['Foundry', '#323A33', '#FFFFFF', '#4A5C4D', '#EAF0EB', '#72A376', '#B0CCB0', '#A8B97F', '#9AB5E4'],
    ['Grid', '#3A3A3A', '#FFFFFF', '#4A4A4A', '#EEEEEE', '#C66951', '#BF974D', '#928B70', '#87706B']
  ];
  var SCHEMES = SCHEME_DATA.map(function (r) { return { name: r[0], sw: r.slice(1) }; }); // sw = the 8 colors

  function themeById(id) { for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === id) return THEMES[i]; return null; }
  function schemeByName(n) { for (var i = 0; i < SCHEMES.length; i++) if (SCHEMES[i].name === n) return SCHEMES[i]; return null; }
  function schemeColors(sc, dark) { // dark designs use the dark colors as background, light designs the light ones
    var w = sc.sw;
    return dark ? { bg: w[0], bg2: w[2], title: w[1], body: w[3], ac: w[4], ac2: w[5] }
                : { bg: w[1], bg2: w[3], title: w[0], body: w[2], ac: w[4], ac2: w[5] };
  }
  function colorsFor(d) { // the six colors in use for design d: its own, a color scheme, or your custom ones
    if (deck && deck.colorScheme === 'custom' && deck.customColors) return Object.assign({}, d.c, deck.customColors);
    if (deck && deck.colorScheme) { var sc = schemeByName(deck.colorScheme); if (sc) return schemeColors(sc, d.dark); }
    return d.c;
  }
  function resolveTheme(d) { // design + colors in use, ready to paint on a slide
    var c = colorsFor(d);
    return { id: d.id, name: d.name, bg: c.bg, css: fill(d.shape, c), title: { color: c.title, font: d.title.font }, body: { color: c.body, font: d.body.font }, accent: c.ac, accent2: c.ac2 };
  }
  function currentTheme() {
    var d = deck && deck.theme ? themeById(deck.theme) : null;
    return d ? resolveTheme(d) : null;
  }
  function themeElement(it, th) {
    if (it.type === 'image') return it;
    if (it.type === 'shape') { // shapes still on their automatic color follow the design's accent
      if (it.auto) {
        if (it.shape === 'line') it.stroke = th.accent;
        else { it.fill = th.accent; if (it.stroke) it.stroke = th.accent2 || th.accent; }
      }
      return it;
    }
    var st = it.style;
    if (it.html) stripRich(it, ['color', 'font-family']); // a design change recolors parts too (their sizes stay)
    if (it.type === 'verse') {
      st.fontFamily = th.body.font; st.color = th.body.color;
      it.refStyle = it.refStyle || { fontSize: 44 };
      it.refStyle.fontFamily = th.title.font; it.refStyle.color = th.accent;
    } else if (st.fontSize >= 64) {
      st.fontFamily = th.title.font; st.color = th.title.color;
    } else {
      st.fontFamily = th.body.font; st.color = th.body.color;
    }
    return it;
  }
  function themeSlide(s, th) {
    s.bg = { color: th.bg, imageId: '', css: th.css };
    s.elements.forEach(function (it) { themeElement(it, th); });
  }
  function themed(it) { // new boxes follow the design last chosen
    var th = currentTheme();
    return th ? themeElement(it, th) : it;
  }

  var deck = S.getJSON(K.preachDeck, null);
  if (!deck || !Array.isArray(deck.slides) || !deck.slides.length) deck = { slides: [newSlide(true)], current: 0, tab: 'paneFormat' };
  deck.current = clamp(parseInt(deck.current, 10) || 0, 0, deck.slides.length - 1);

  var selId = null;       // selected element id on the current slide
  var editing = false;    // typing directly in a box on the canvas
  var liveId = null;      // id of the slide on the projector
  var picked = {};        // slides ticked in the list with Shift / Ctrl + click {slideId: true}
  var anchor = 0;         // where a Shift + click range starts
  var clip = [];          // slides copied with Ctrl+C / Ctrl+X

  var liveRaw = S.getRaw(K.preachLive);
  if (liveRaw !== null && liveRaw !== '' && deck.slides[parseInt(liveRaw, 10)]) liveId = deck.slides[parseInt(liveRaw, 10)].id;

  function cur() { return deck.slides[deck.current]; }
  function curEl() {
    if (!selId) return null;
    var els = cur().elements;
    for (var i = 0; i < els.length; i++) if (els[i].id === selId) return els[i];
    return null;
  }

  var saveTimer = null;
  function saveNow() {
    clearTimeout(saveTimer); saveTimer = null;
    S.setJSON(K.preachDeck, deck);
  }
  function save() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 150); }
  window.addEventListener('beforeunload', function () { if (saveTimer) saveNow(); });

  function liveIndex() {
    if (!liveId) return -1;
    for (var i = 0; i < deck.slides.length; i++) if (deck.slides[i].id === liveId) return i;
    return -1;
  }
  function pushLive() {
    var i = liveIndex();
    if (i < 0) liveId = null;
    S.setRaw(K.preachLive, i < 0 ? null : String(i));
    $('liveBadge').hidden = i < 0;
    drawThumbDots();
  }

  /* ------------------------------------------------------------------ *
   * Canvas (the big slide)
   * ------------------------------------------------------------------ */
  var stage = $('stage'), box = $('canvasBox'), wrap = $('canvasWrap');
  var scale = 1;
  var nodes = {};

  function fit() {
    var cs = getComputedStyle(wrap);
    var aw = wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var ah = wrap.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    scale = Math.max(0.1, Math.min(aw / W, ah / H));
    box.style.width = Math.round(W * scale) + 'px';
    box.style.height = Math.round(H * scale) + 'px';
    stage.style.transform = 'scale(' + scale + ')';
    stage.style.setProperty('--inv', String(1 / scale));
    placeBar();
  }
  if (window.ResizeObserver) new ResizeObserver(fit).observe(wrap);
  window.addEventListener('resize', fit);

  var curPart = 'text'; // which part of a verse box was last clicked: 'text' or 'ref'
  var barTimerGuard = false;

  function drawCanvas() {
    if (editing) return;
    nodes = S.renderSlide(stage, cur());
    var sel = curEl();
    if (!sel) selId = null;
    if (sel && nodes[sel.id]) {
      nodes[sel.id].classList.add('sel');
      var rh = el('div', 'rh'); stage.appendChild(rh);
      var mh = el('div', 'mh', '✥'); mh.title = 'Drag to move this box'; stage.appendChild(mh);
      placeHandles(sel);
    }
    buildBar();
  }
  function placeHandles(it) {
    var rh = stage.querySelector('.rh'), mh = stage.querySelector('.mh');
    if (rh) { rh.style.left = (it.x + it.w) + 'px'; rh.style.top = (it.y + it.h) + 'px'; }
    if (mh) { mh.style.left = it.x + 'px'; mh.style.top = it.y + 'px'; }
  }

  // ---- mouse: select / move / resize; a plain click starts typing ----
  var drag = null;
  function barStyle() { // the style object the floating bar edits
    var it = curEl();
    if (!it) return null;
    if (it.type === 'verse' && curPart === 'ref') { it.refStyle = it.refStyle || { fontFamily: it.style.fontFamily, fontSize: 40, color: '#D4A373' }; return it.refStyle; }
    return it.style;
  }

  stage.addEventListener('pointerdown', function (e) {
    var handle = e.target.closest('.rh'), mover = e.target.closest('.mh');
    var node = e.target.closest('.sl-el');
    if (editing) {
      if (node && !handle && !mover && node.dataset.id === selId) return; // normal caret placement inside the box
      if (endEdit) endEdit();
    }
    var id = node ? node.dataset.id : ((handle || mover) ? selId : null);
    if (!id) { setSel(null); return; }
    var part = e.target.closest('.sl-ref') ? 'ref' : 'text';
    var was = selId === id;
    if (!was) { selId = id; }
    curPart = part;
    if (!was) { drawCanvas(); buildFormat(); }
    var item = curEl();
    if (!item) return;
    drag = { mode: handle ? 'resize' : 'move', sx: e.clientX, sy: e.clientY, ox: item.x, oy: item.y, ow: item.w, oh: item.h,
      item: item, moved: false, grip: !!(handle || mover), part: part, id: id };
    stage.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  stage.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var dx = (e.clientX - drag.sx) / scale, dy = (e.clientY - drag.sy) / scale;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
    drag.moved = true;
    var it = drag.item, n = nodes[it.id];
    if (drag.mode === 'move') {
      it.x = Math.round(clamp(drag.ox + dx, -it.w + 40, W - 40));
      it.y = Math.round(clamp(drag.oy + dy, -it.h + 40, H - 40));
    } else {
      it.w = Math.round(clamp(drag.ow + dx, 60, W * 2));
      it.h = Math.round(clamp(drag.oh + dy, 40, H * 2));
      if (it.type === 'image' && it.ar && !e.shiftKey) it.h = Math.round(it.w / it.ar); // pictures keep their proportions (hold Shift to stretch)
    }
    if (n) { n.style.left = it.x + 'px'; n.style.top = it.y + 'px'; n.style.width = it.w + 'px'; n.style.height = it.h + 'px'; }
    placeHandles(it); placeBar();
    save();
  });
  function endDrag(e) {
    if (!drag) return;
    var d = drag;
    drag = null;
    try { stage.releasePointerCapture(e.pointerId); } catch (x) {}
    if (d.moved) { drawThumb(deck.current); saveNow(); syncGeometry(); return; }
    // a click (no drag) on the box itself: start typing right there
    if (!d.grip && d.mode === 'move' && nodes[d.id] && (d.item.type === 'text' || d.item.type === 'verse')) startEditing(d.item, nodes[d.id], d.part, { x: e.clientX, y: e.clientY });
  }
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  wrap.addEventListener('pointerdown', function (e) { if (e.target === wrap || e.target === box) setSel(null); });

  // ---- typing straight into the box ----
  // A box keeps its text in item.text (plain). When parts of it have their own size / color / font / bold / italic
  // it also keeps item.html (cleaned: only <span style> and <br>), which is what gets drawn.
  var editPart = 'text';
  var endEdit = null;     // call to finish typing (saves the text)
  var edit = null;        // {item, target, part} while typing
  var savedRange = null;  // the last selection inside the box (the bar's selects / inputs take the focus away)

  function commitEdit() { // copy what is in the box into the slide data
    if (!edit) return;
    var item = edit.item, t = edit.target;
    var txt = t.innerText.replace(/\n$/, '');
    if (edit.part === 'ref') { item.ref = txt; return; }
    item.text = txt;
    var h = S.cleanRich(t.innerHTML);
    if (/<span/.test(h)) item.html = h; else delete item.html;
  }
  // remove some properties from every styled part (a change to the whole box wins over earlier changes to parts)
  function stripRich(item, props) {
    if (!item.html) return;
    var tmp = document.createElement('div');
    S.richInto(tmp, item.html);
    Array.prototype.forEach.call(tmp.querySelectorAll('span'), function (sp) { props.forEach(function (p) { sp.style.removeProperty(p); }); });
    Array.prototype.forEach.call(tmp.querySelectorAll('span'), function (sp) {
      if (!sp.getAttribute('style')) { while (sp.firstChild) sp.parentNode.insertBefore(sp.firstChild, sp); sp.remove(); }
    });
    var h = tmp.innerHTML;
    if (/<span/.test(h)) item.html = h; else delete item.html;
  }

  function liveRange() { // the selected part of the text, or null
    if (!edit || edit.part === 'ref') return null;
    var s = window.getSelection(), r = null;
    if (s.rangeCount) { var rr = s.getRangeAt(0); if (!rr.collapsed && edit.target.contains(rr.commonAncestorContainer)) r = rr; }
    if (!r && savedRange && !savedRange.collapsed && edit.target.contains(savedRange.commonAncestorContainer)) r = savedRange;
    return r;
  }
  function sizeAtSelection() {
    var r = liveRange();
    if (r) {
      var n = r.startContainer, e = n.nodeType === 3 ? n.parentNode : n;
      var px = parseFloat(getComputedStyle(e).fontSize);
      if (px) return Math.round(px);
    }
    return null;
  }
  function syncSizeBox() { // show the size of the selected text in the bar
    var num = fbar.querySelector('.fb-size input');
    if (!num || document.activeElement === num || !edit) return;
    var px = sizeAtSelection();
    if (px) num.value = px;
    else if (edit.item.style) num.value = Math.round(edit.item.style.fontSize);
  }
  document.addEventListener('selectionchange', function () {
    if (!edit) return;
    var s = window.getSelection();
    if (!s.rangeCount) return;
    var rr = s.getRangeAt(0);
    if (!edit.target.contains(rr.commonAncestorContainer)) return; // the focus is in the bar: keep what we had
    savedRange = rr.collapsed ? null : rr.cloneRange();
    syncSizeBox();
  });

  // run fn on the selected part of the text; false when nothing is selected (then the change is for the whole box)
  function withSelection(fn) {
    var r = liveRange();
    if (!r) return false;
    var t = edit.target, s = window.getSelection();
    t.focus(); s.removeAllRanges(); s.addRange(r);
    fn(r);
    Array.prototype.forEach.call(t.querySelectorAll('span'), function (sp) { // tidy up empty or unstyled spans
      if (!sp.firstChild) sp.remove();
      else if (!sp.getAttribute('style')) { while (sp.firstChild) sp.parentNode.insertBefore(sp.firstChild, sp); sp.remove(); }
    });
    t.normalize();
    commitEdit(); save(); drawThumb(deck.current);
    if (s.rangeCount) { var rr = s.getRangeAt(0); if (!rr.collapsed && t.contains(rr.commonAncestorContainer)) savedRange = rr.cloneRange(); }
    syncSizeBox();
    return true;
  }
  function selStyle(prop, value) { // e.g. selStyle('font-size', '90px') on the selected text only
    return withSelection(function (r) {
      var sc = r.startContainer;
      // the selection is exactly the inside of a span we made before: change that span instead of nesting another one
      if (sc === r.endContainer && sc !== edit.target && sc.nodeType === 1 && sc.tagName === 'SPAN' &&
          r.startOffset === 0 && r.endOffset === sc.childNodes.length) {
        sc.style.setProperty(prop, value);
        Array.prototype.forEach.call(sc.querySelectorAll('span'), function (x) { x.style.removeProperty(prop); });
        return;
      }
      var span = document.createElement('span');
      span.style.setProperty(prop, value);
      var frag = r.extractContents();
      Array.prototype.forEach.call(frag.querySelectorAll('span'), function (x) { x.style.removeProperty(prop); });
      span.appendChild(frag);
      r.insertNode(span);
      var s = window.getSelection(), nr = document.createRange();
      nr.selectNodeContents(span); s.removeAllRanges(); s.addRange(nr);
    });
  }
  function selExec(cmd) { // bold / italic on the selected text (toggles)
    return withSelection(function () {
      document.execCommand('styleWithCSS', false, true);
      document.execCommand(cmd, false, null);
    });
  }
  function outdent() { // Shift+Tab: remove the tab just before the cursor
    var s = window.getSelection();
    if (!s.rangeCount || !s.isCollapsed) return;
    var n = s.anchorNode, o = s.anchorOffset;
    if (n && n.nodeType === 3 && o > 0 && n.nodeValue.charAt(o - 1) === '\t') {
      var r = document.createRange();
      r.setStart(n, o - 1); r.setEnd(n, o);
      s.removeAllRanges(); s.addRange(r);
      document.execCommand('delete');
    }
  }

  function startEditing(item, node, part, where) {
    part = part === 'ref' && item.type === 'verse' ? 'ref' : 'text';
    var target = part === 'ref' ? node.querySelector('.sl-ref') : (item.type === 'verse' ? node.querySelector('.sl-vt') : node);
    if (!target) return;
    editing = true; editPart = part; curPart = part; savedRange = null;
    edit = { item: item, target: target, part: part };
    node.classList.add('editing');
    var rh = stage.querySelector('.rh'); if (rh) rh.remove();
    if (part === 'ref') {
      try { target.contentEditable = 'plaintext-only'; } catch (x) {}
      if (target.contentEditable !== 'plaintext-only') target.contentEditable = 'true';
    } else {
      target.contentEditable = 'true'; // text can have parts with their own style
    }
    target.focus();
    var s = window.getSelection(), r = null;
    if (where && where.x !== undefined) {
      if (document.caretRangeFromPoint) r = document.caretRangeFromPoint(where.x, where.y);
      else if (document.caretPositionFromPoint) { var cp = document.caretPositionFromPoint(where.x, where.y); if (cp) { r = document.createRange(); r.setStart(cp.offsetNode, cp.offset); } }
    }
    if (!r || !target.contains(r.startContainer)) { r = document.createRange(); r.selectNodeContents(target); r.collapse(false); }
    r.collapse(true);
    s.removeAllRanges(); s.addRange(r);

    target.oninput = function () { commitEdit(); save(); drawThumb(deck.current); };
    target.onpaste = function (ev) { // paste as plain text (the box's own styling stays)
      ev.preventDefault();
      var txt = (ev.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, txt);
    };
    endEdit = function (ev) {
      if (!editing) return;
      commitEdit();
      target.oninput = target.onblur = target.onkeydown = target.onpaste = null;
      editing = false; endEdit = null; edit = null; savedRange = null;
      if (ev && ev.relatedTarget && fbar.contains(ev.relatedTarget)) skipBar = true;
      saveNow(); drawCanvas(); drawThumb(deck.current); buildFormat();
    };
    // focus moving to a select / input of the format bar does not end the typing (the bar edits the selected text)
    target.onblur = function (ev) { if (ev && ev.relatedTarget && fbar.contains(ev.relatedTarget)) return; endEdit(ev); };
    target.onkeydown = function (ev) {
      ev.stopPropagation();
      if (ev.key === 'Escape') { ev.preventDefault(); endEdit(); }
      else if (ev.key === 'Tab') { // indent (a tab character), Shift+Tab takes it back
        ev.preventDefault();
        if (ev.shiftKey) outdent(); else document.execCommand('insertText', false, '\t');
      } else if (ev.key === 'Enter' && part !== 'ref') { ev.preventDefault(); document.execCommand('insertLineBreak'); }
    };
    placeBar(); syncSizeBox();
  }
  // a whole-box style button was pressed while typing: redraw the box and keep typing
  function refreshEditing() {
    if (!edit) return;
    var it = edit.item, part = edit.part, t = edit.target;
    t.oninput = t.onblur = t.onkeydown = t.onpaste = null;
    editing = false; endEdit = null; edit = null; savedRange = null;
    drawCanvas(); drawThumb(deck.current); save();
    startEditing(it, nodes[it.id], part, null);
  }
  function styleChanged() {
    if (editing) refreshEditing(); else { changed(); }
  }

  /* ------------------------------------------------------------------ *
   * Floating format bar (above the selected box)
   * ------------------------------------------------------------------ */
  var fbar = el('div', 'fbar'); fbar.hidden = true;
  wrap.appendChild(fbar);
  fbar.addEventListener('mousedown', function (e) {
    // keep the caret in the box when pressing buttons (but let selects and the color picker work)
    if (e.target.closest('select, input')) return;
    e.preventDefault();
  });
  // focus left the bar for somewhere else (not back into the box): the typing is over
  fbar.addEventListener('focusout', function (e) {
    if (!editing || !edit) return;
    var to = e.relatedTarget;
    if (to && (fbar.contains(to) || edit.target === to)) return;
    if (endEdit) endEdit();
  });

  function fbtn(label, title, fn, on) {
    var b = el('button', 'fb' + (on ? ' on' : ''));
    b.innerHTML = label; b.title = title; b.type = 'button';
    b.onclick = fn;
    return b;
  }
  var skipBar = false;
  function buildBar() {
    if (skipBar) { skipBar = false; placeBar(); return; }
    fbar.textContent = '';
    var it = curEl();
    if (!it) { fbar.hidden = true; return; }
    if (it.type === 'shape') { buildShapeBar(it); return; }
    if (it.type === 'image') { buildImageBar(it); return; }
    var st = barStyle();
    var isRef = it.type === 'verse' && curPart === 'ref';

    var sel = el('select', 'fb-font');
    FONTS.forEach(function (n) { var o = el('option', '', n); o.value = n; sel.appendChild(o); });
    sel.value = st.fontFamily || 'Inter';
    // with part of the text selected, a change applies to that part only; otherwise to the whole box
    sel.onchange = function () {
      if (!isRef && selStyle('font-family', S.fontFamily(sel.value))) return;
      st.fontFamily = sel.value; if (!isRef) stripRich(it, ['font-family']); styleChanged();
    };
    fbar.appendChild(sel);

    var size = el('div', 'fb-size');
    function curSize() { return (!isRef && sizeAtSelection()) || Math.round(st.fontSize); }
    function setSize(v) {
      v = clamp(Math.round(v), 8, 300);
      if (!isRef && selStyle('font-size', v + 'px')) { num.value = v; return; } // only the selected text
      st.fontSize = v; if (!isRef) stripRich(it, ['font-size']); styleChanged();
    }
    var minus = fbtn('&minus;', 'Smaller text', function () { var c = curSize(); setSize(c - (c > 60 ? 4 : 2)); });
    var num = el('input'); num.type = 'text'; num.value = Math.round(st.fontSize); num.title = 'Text size (select some text to change only that part)';
    num.onchange = function () { var v = parseInt(num.value, 10); if (isNaN(v)) { num.value = curSize(); return; } setSize(v); };
    num.onkeydown = function (e) { e.stopPropagation(); if (e.key === 'Enter') num.blur(); };
    var plus = fbtn('+', 'Bigger text', function () { var c = curSize(); setSize(c + (c >= 60 ? 4 : 2)); });
    size.appendChild(minus); size.appendChild(num); size.appendChild(plus);
    fbar.appendChild(size);

    var cur0 = (st.color || '').toLowerCase();
    COLORS.forEach(function (c) {
      var b = el('button', 'fb-sw' + (c.toLowerCase() === cur0 ? ' on' : '')); b.type = 'button';
      b.style.backgroundColor = c; b.title = c;
      b.onclick = function () {
        if (!isRef && selStyle('color', c)) return;
        st.color = c; if (!isRef) stripRich(it, ['color']); styleChanged();
      };
      fbar.appendChild(b);
    });
    var pick = el('input'); pick.type = 'color'; pick.className = 'fb-pick'; pick.title = 'Any color';
    try { pick.value = cur0 || '#ffffff'; } catch (x) {}
    pick.onchange = function () {
      if (!isRef && selStyle('color', pick.value)) return;
      st.color = pick.value; if (!isRef) stripRich(it, ['color']); if (endEdit) endEdit(); changed();
    };
    fbar.appendChild(pick);

    fbar.appendChild(el('span', 'fb-sep'));
    if (!isRef) {
      fbar.appendChild(fbtn('<b>B</b>', 'Bold', function () {
        if (selExec('bold')) return;
        it.style.bold = !it.style.bold; stripRich(it, ['font-weight']); styleChanged();
      }, it.style.bold));
      fbar.appendChild(fbtn('<i>I</i>', 'Italic', function () {
        if (selExec('italic')) return;
        it.style.italic = !it.style.italic; stripRich(it, ['font-style']); styleChanged();
      }, it.style.italic));
    }
    ['left', 'center', 'right'].forEach(function (a) {
      fbar.appendChild(fbtn(alignIcon(a), 'Align ' + a, function () { it.style.align = a; styleChanged(); }, it.style.align === a));
    });
    fbar.appendChild(el('span', 'fb-sep'));
    var del = fbtn('&#128465;', 'Delete this box', function () { editing = false; endEdit = null; deleteElement(); }, false);
    del.className += ' danger';
    fbar.appendChild(del);

    fbar.hidden = false;
    placeBar();
  }
  function placeBar() {
    var it = curEl();
    if (!it || fbar.hidden) return;
    var wr = wrap.getBoundingClientRect(), br = box.getBoundingClientRect();
    var left = (br.left - wr.left) + it.x * scale;
    var top = (br.top - wr.top) + it.y * scale;
    var bw = fbar.offsetWidth, bh = fbar.offsetHeight;
    var y = top - bh - 30;
    if (y < 4) y = top + it.h * scale + 14;
    if (y + bh > wrap.clientHeight - 4) y = Math.max(4, wrap.clientHeight - bh - 4);
    left = clamp(left, 4, Math.max(4, wrap.clientWidth - bw - 4));
    fbar.style.left = Math.round(left) + 'px';
    fbar.style.top = Math.round(y) + 'px';
  }
  /* ------------------------------------------------------------------ *
   * Slide list (thumbnails)
   * ------------------------------------------------------------------ */
  var slideList = $('slideList');
  var thumbNodes = [];

  function drawThumb(i) {
    var t = thumbNodes[i];
    if (!t) return;
    var st = t.querySelector('.sl-stage');
    S.renderSlide(st, deck.slides[i]);
    var w = t.querySelector('.tbox').clientWidth || 160;
    st.style.transform = 'scale(' + (w / W) + ')';
  }
  function drawThumbDots() {
    var li = liveIndex();
    thumbNodes.forEach(function (t, i) {
      var d = t.querySelector('.livedot');
      if (d) d.hidden = i !== li;
    });
  }
  function drawSlideList() {
    slideList.textContent = '';
    thumbNodes = [];
    $('slideCount').textContent = '(' + deck.slides.length + ')';
    deck.slides.forEach(function (sl, i) {
      var t = el('div', 'pthumb' + (i === deck.current ? ' on' : '') + (picked[sl.id] ? ' multi' : ''));
      t.draggable = true;
      t.appendChild(el('div', 'num', String(i + 1)));
      var tb = el('div', 'tbox');
      tb.appendChild(el('div', 'sl-stage'));
      var dot = el('div', 'livedot'); dot.title = 'This slide is on the projector'; dot.hidden = true;
      tb.appendChild(dot);
      t.appendChild(tb);
      t.onclick = function (e) { clickSlide(i, e); };
      t.ondragstart = function (e) { e.dataTransfer.setData('text/plain', String(i)); e.dataTransfer.effectAllowed = 'move'; };
      t.ondragover = function (e) { e.preventDefault(); t.classList.add('dragover'); };
      t.ondragleave = function () { t.classList.remove('dragover'); };
      t.ondrop = function (e) {
        e.preventDefault(); t.classList.remove('dragover');
        var from = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (!isNaN(from) && from !== i) moveSlide(from, i);
      };
      slideList.appendChild(t);
      thumbNodes.push(t);
    });
    thumbNodes.forEach(function (t, i) { drawThumb(i); });
    drawThumbDots();
  }
  function highlightThumbs() {
    thumbNodes.forEach(function (t, i) {
      t.classList.toggle('on', i === deck.current);
      t.classList.toggle('multi', !!picked[deck.slides[i].id]);
    });
    var t = thumbNodes[deck.current];
    if (t) {
      var host = slideList, h = host.getBoundingClientRect(), n = t.getBoundingClientRect();
      if (n.top < h.top) host.scrollTop += n.top - h.top;
      else if (n.bottom > h.bottom) host.scrollTop += n.bottom - h.bottom;
    }
  }

  /* ------------------------------------------------------------------ *
   * Slide actions
   * ------------------------------------------------------------------ */
  function setSel(id) {
    if (endEdit) endEdit();
    if (selId === id) return;
    selId = id;
    drawCanvas();
    buildFormat();
  }
  // click in the slide list: plain = go there, Shift = select a range, Ctrl = add / remove one
  function clickSlide(i, e) {
    if (e.shiftKey) {
      var a = clamp(anchor, 0, deck.slides.length - 1), lo = Math.min(a, i), hi = Math.max(a, i);
      picked = {};
      for (var k = lo; k <= hi; k++) picked[deck.slides[k].id] = true;
      gotoSlide(i, true);
    } else if (e.ctrlKey || e.metaKey) {
      var id = deck.slides[i].id;
      if (!Object.keys(picked).length) picked[cur().id] = true; // the slide you were on counts too
      if (picked[id] && Object.keys(picked).length > 1) delete picked[id]; else picked[id] = true;
      anchor = i;
      gotoSlide(i, true);
    } else {
      anchor = i;
      gotoSlide(i);
    }
    highlightThumbs();
  }
  // the slides an action applies to: the ticked ones (in order), or just the one you are on
  function pickedIndexes() {
    var r = [];
    deck.slides.forEach(function (s, i) { if (picked[s.id]) r.push(i); });
    return r.length ? r : [deck.current];
  }
  function gotoSlide(i, keepPick) {
    i = clamp(i, 0, deck.slides.length - 1);
    if (endEdit) endEdit();
    if (!keepPick) { picked = {}; anchor = i; }
    if (i === deck.current) { highlightThumbs(); return; }
    deck.current = i;
    selId = null;
    drawCanvas(); highlightThumbs(); buildFormat(); saveNow();
    if (liveId) { liveId = deck.slides[i].id; pushLive(); } // the projector follows while live
  }
  function addSlide(slide, at) {
    at = at === undefined ? deck.current + 1 : at;
    deck.slides.splice(at, 0, slide);
    deck.current = at;
    selId = null;
    saveNow(); pushLive();
    drawSlideList(); drawCanvas(); buildFormat();
  }
  function moveSlide(from, to) {
    var curSlide = cur();
    var s = deck.slides.splice(from, 1)[0];
    deck.slides.splice(to, 0, s);
    deck.current = deck.slides.indexOf(curSlide);
    saveNow(); pushLive();
    drawSlideList();
  }
  function deleteSlide() {
    var idx = pickedIndexes();
    if (idx.length > 1 && !window.confirm('Delete ' + idx.length + ' slides?')) return;
    var at = idx[0];
    var goneIds = {};
    idx.forEach(function (i) { goneIds[deck.slides[i].id] = true; });
    if (liveId && goneIds[liveId]) liveId = null;
    deck.slides = deck.slides.filter(function (s) { return !goneIds[s.id]; });
    if (!deck.slides.length) { deck.slides.push(newSlide(false)); }
    deck.current = Math.min(at, deck.slides.length - 1);
    picked = {}; anchor = deck.current;
    selId = null;
    saveNow(); pushLive();
    drawSlideList(); drawCanvas(); buildFormat();
    pruneImages();
  }
  function cloneSlide(s) {
    var c = clone(s);
    c.id = uid();
    c.elements.forEach(function (e) { e.id = uid(); });
    return c;
  }
  function copySlides() {
    clip = pickedIndexes().map(function (i) { return clone(deck.slides[i]); });
    return clip.length;
  }
  function pasteSlides() {
    if (!clip.length) return false;
    var idx = pickedIndexes();
    var at = idx[idx.length - 1] + 1;
    var copies = clip.map(cloneSlide);
    Array.prototype.splice.apply(deck.slides, [at, 0].concat(copies));
    deck.current = at;
    picked = {};
    if (copies.length > 1) copies.forEach(function (c) { picked[c.id] = true; });
    anchor = at;
    selId = null;
    saveNow(); pushLive();
    drawSlideList(); drawCanvas(); buildFormat();
    return true;
  }
  function duplicateSlide() { copySlides(); pasteSlides(); }

  function changed(opts) { // one element or the slide changed
    opts = opts || {};
    save();
    drawCanvas();
    drawThumb(deck.current);
    if (opts.rebuild) buildFormat();
  }

  function addElement(item) {
    cur().elements.push(item);
    selId = item.id;
    changed({ rebuild: true });
  }
  function deleteElement() {
    var it = curEl();
    if (!it) return;
    cur().elements = cur().elements.filter(function (e) { return e.id !== it.id; });
    selId = null;
    changed({ rebuild: true });
    if (it.type === 'image') pruneImages();
  }
  function duplicateElement() {
    var it = curEl();
    if (!it) return;
    var c = clone(it); c.id = uid(); c.x += 30; c.y += 30;
    addElement(c);
  }
  function reorderElement(front) {
    var it = curEl();
    if (!it) return;
    var els = cur().elements.filter(function (e) { return e.id !== it.id; });
    if (front) els.push(it); else els.unshift(it);
    cur().elements = els;
    changed();
  }

  /* ------------------------------------------------------------------ *
   * Format panel (right, first tab)
   * ------------------------------------------------------------------ */
  var fmtHost = $('formatHost');
  var geomSync = null;
  function syncGeometry() { if (geomSync) geomSync(); }

  function field(label) {
    var f = el('div', 'field');
    if (label) f.appendChild(el('label', 'lbl', label));
    return f;
  }
  function fontSelect(label, get, set) {
    var f = field(label), s = el('select');
    FONTS.forEach(function (n) { var o = el('option', '', n); o.value = n; s.appendChild(o); });
    s.value = get();
    s.onchange = function () { set(s.value); };
    f.appendChild(s);
    return f;
  }
  function sliderField(label, min, max, step, unit, get, set) {
    var f = field(), l = el('label', 'lbl'), r = el('input');
    r.type = 'range'; r.min = min; r.max = max; r.step = step; r.value = get();
    function lab() { l.textContent = label + ' (' + r.value + unit + ')'; }
    lab();
    r.oninput = function () { set(parseFloat(r.value)); lab(); };
    f.appendChild(l); f.appendChild(r);
    return f;
  }
  function colorField(label, list, get, set) {
    var f = field(label), row = el('div', 'swatches');
    row.style.flexWrap = 'wrap'; row.style.gap = '10px';
    var btns = list.map(function (c) {
      var b = el('button', 'swatch'); b.style.backgroundColor = c; b.title = c;
      b.onclick = function () { set(c); mark(); };
      row.appendChild(b);
      return [b, c];
    });
    var pick = el('input'); pick.type = 'color'; pick.className = 'sr';
    var pb = el('button', 'btn outline icon', '🎨'); pb.title = 'Custom color';
    pb.style.width = '28px'; pb.style.height = '28px'; pb.style.borderRadius = '50%';
    pb.onclick = function () { pick.click(); };
    pick.oninput = function () { set(pick.value); mark(); };
    row.appendChild(pb); row.appendChild(pick);
    function mark() {
      var c = (get() || '').toLowerCase();
      try { pick.value = c; } catch (x) {}
      btns.forEach(function (b) { b[0].classList.toggle('on', b[1].toLowerCase() === c); });
    }
    mark();
    f.appendChild(row);
    return f;
  }
  var ICON_LINES = {
    left: ['M21 6H3', 'M15 12H3', 'M17 18H3'], center: ['M21 6H3', 'M17 12H7', 'M19 18H5'],
    right: ['M21 6H3', 'M21 12H9', 'M21 18H7'], justify: ['M3 6h18', 'M3 12h18', 'M3 18h18']
  };
  function alignIcon(n) {
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
      ICON_LINES[n].map(function (d) { return '<path d="' + d + '"/>'; }).join('') + '</svg>';
  }
  function alignField(get, set) {
    var f = field('Text Alignment'), row = el('div', 'aligns');
    var btns = ['left', 'center', 'right', 'justify'].map(function (n) {
      var b = el('button', 'btn outline'); b.style.padding = '0';
      b.innerHTML = alignIcon(n); b.title = 'Align ' + n; b.setAttribute('aria-label', 'Align ' + n);
      b.onclick = function () { set(n); mark(); };
      row.appendChild(b);
      return [b, n];
    });
    function mark() { btns.forEach(function (b) { b[0].className = 'btn ' + (get() === b[1] ? 'secondary' : 'outline'); }); }
    mark();
    f.appendChild(row);
    return f;
  }
  function toggleRow(item) {
    var f = field('Style'), row = el('div', 'aligns');
    row.style.gridTemplateColumns = 'repeat(2,1fr)';
    var b = el('button', 'btn outline', 'B'); b.style.fontWeight = '800'; b.title = 'Bold';
    var i = el('button', 'btn outline', 'I'); i.style.fontStyle = 'italic'; i.title = 'Italic';
    function mark() {
      b.className = 'btn ' + (item.style.bold ? 'secondary' : 'outline');
      i.className = 'btn ' + (item.style.italic ? 'secondary' : 'outline');
    }
    b.onclick = function () { item.style.bold = !item.style.bold; stripRich(item, ['font-weight']); mark(); changed(); };
    i.onclick = function () { item.style.italic = !item.style.italic; stripRich(item, ['font-style']); mark(); changed(); };
    mark();
    row.appendChild(b); row.appendChild(i); f.appendChild(row);
    return f;
  }

  function buildFormat() {
    if (editing) return;
    fmtHost.textContent = '';
    geomSync = null;
    var item = curEl();
    if (!item) { buildSlideFormat(); return; }
    if (item.type === 'shape') { buildShapeFormat(item); return; }
    if (item.type === 'image') { buildImageFormat(item); return; }

    var isVerse = item.type === 'verse';
    fmtHost.appendChild(el('h4', '', isVerse ? 'Bible verse box' : 'Text box'));

    var tf = field(isVerse ? 'Verse text' : 'Text');
    var ta = el('textarea'); ta.id = 'fmtText'; ta.rows = isVerse ? 6 : 4; ta.value = item.text || '';
    ta.oninput = function () { item.text = ta.value; delete item.html; changed(); }; // typing here replaces any part-by-part styling
    ta.onkeydown = function (e) { // Tab indents instead of jumping to the next control
      if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); document.execCommand('insertText', false, '\t'); }
    };
    tf.appendChild(ta);
    fmtHost.appendChild(tf);

    if (isVerse) {
      var rf = field('Reference (shown above the verse)');
      var ri = el('input'); ri.type = 'text'; ri.value = item.ref || '';
      ri.oninput = function () { item.ref = ri.value; changed(); };
      rf.appendChild(ri);
      fmtHost.appendChild(rf);
    }

    fmtHost.appendChild(fontSelect('Font Family', function () { return item.style.fontFamily; }, function (v) { item.style.fontFamily = v; stripRich(item, ['font-family']); changed(); }));
    fmtHost.appendChild(sliderField('Font Size', 12, 160, 1, 'px', function () { return item.style.fontSize; }, function (v) { item.style.fontSize = v; stripRich(item, ['font-size']); changed(); }));
    fmtHost.appendChild(colorField('Font Color', COLORS, function () { return item.style.color; }, function (v) { item.style.color = v; stripRich(item, ['color']); changed(); }));
    fmtHost.appendChild(toggleRow(item));
    fmtHost.appendChild(alignField(function () { return item.style.align; }, function (v) { item.style.align = v; changed(); }));
    fmtHost.appendChild(sliderField('Line Spacing', 1, 2.5, 0.05, '', function () { return item.style.lineHeight; }, function (v) { item.style.lineHeight = v; changed(); }));

    if (isVerse) {
      fmtHost.appendChild(el('hr', 'sep'));
      fmtHost.appendChild(el('h4', '', 'Reference style'));
      item.refStyle = item.refStyle || { fontFamily: item.style.fontFamily, fontSize: 40, color: '#D4A373' };
      fmtHost.appendChild(sliderField('Reference Size', 12, 120, 1, 'px', function () { return item.refStyle.fontSize; }, function (v) { item.refStyle.fontSize = v; changed(); }));
      fmtHost.appendChild(colorField('Reference Color', COLORS, function () { return item.refStyle.color; }, function (v) { item.refStyle.color = v; changed(); }));
    }

    fmtHost.appendChild(el('hr', 'sep'));
    fmtHost.appendChild(el('h4', '', 'Position & size'));
    var g = el('div', 'prow2');
    var inputs = {};
    [['x', 'X'], ['y', 'Y'], ['w', 'Width'], ['h', 'Height']].forEach(function (p) {
      var f = field(p[1]), inp = el('input'); inp.type = 'text'; inp.inputMode = 'numeric'; inp.value = Math.round(item[p[0]]);
      inp.onchange = function () {
        var v = parseInt(inp.value, 10);
        if (isNaN(v)) { inp.value = Math.round(item[p[0]]); return; }
        item[p[0]] = (p[0] === 'w' || p[0] === 'h') ? clamp(v, 20, 3000) : clamp(v, -2000, 3000);
        changed();
      };
      f.appendChild(inp); g.appendChild(f); inputs[p[0]] = inp;
    });
    fmtHost.appendChild(g);
    geomSync = function () { ['x', 'y', 'w', 'h'].forEach(function (k) { inputs[k].value = Math.round(item[k]); }); };

    var r1 = el('div', 'prow2');
    var fr = el('button', 'btn outline', 'Bring to front'); fr.onclick = function () { reorderElement(true); };
    var bk = el('button', 'btn outline', 'Send to back'); bk.onclick = function () { reorderElement(false); };
    r1.appendChild(fr); r1.appendChild(bk);
    fmtHost.appendChild(r1);
    var r2 = el('div', 'prow2');
    var du = el('button', 'btn outline', 'Duplicate'); du.onclick = duplicateElement;
    var de = el('button', 'btn danger', 'Delete box'); de.onclick = deleteElement;
    r2.appendChild(du); r2.appendChild(de);
    fmtHost.appendChild(r2);
  }

  function designTargets(scope) {
    if (scope === 'all') return deck.slides;
    if (scope === 'picked') return pickedIndexes().map(function (i) { return deck.slides[i]; });
    return [cur()];
  }
  function paintTargets(scope) { // re-style the chosen slides with the design + colors now in use
    var th = currentTheme();
    if (!th) return 0;
    var t = designTargets(scope);
    t.forEach(function (s) { themeSlide(s, th); });
    return t.length;
  }
  function applyDesign(d, scope) {
    deck.theme = d.id;
    deck.colorScheme = ''; deck.customColors = null; // a new design brings its own colors
    deck.designScope = scope;
    var n = paintTargets(scope);
    saveNow();
    drawSlideList(); drawCanvas(); buildFormat();
    S.toast(d.name, n === 1 ? 'Applied to this slide.' : 'Applied to ' + n + ' slides.');
  }
  function applyColors(scope, scheme, quiet) { // scheme: '' = the design's own colors, a scheme name, or 'custom'
    if (!deck.theme) deck.theme = 'office-dark';
    deck.colorScheme = scheme;
    if (scheme !== 'custom') deck.customColors = null;
    deck.designScope = scope;
    var n = paintTargets(scope);
    saveNow();
    drawSlideList(); drawCanvas();
    if (!quiet) { buildFormat(); S.toast(scheme || 'Design colors', n === 1 ? 'Applied to this slide.' : 'Applied to ' + n + ' slides.'); }
  }

  function buildGallery() {
    fmtHost.appendChild(el('h4', '', 'Design'));
    var sf = field('Apply to');
    var ss = el('select');
    [['all', 'All slides'], ['picked', 'Picked slides (Shift / Ctrl + click)'], ['this', 'This slide only']].forEach(function (o) {
      var op = el('option', '', o[1]); op.value = o[0]; ss.appendChild(op);
    });
    ss.value = deck.designScope || 'all';
    ss.onchange = function () { deck.designScope = ss.value; save(); };
    sf.appendChild(ss);
    fmtHost.appendChild(sf);

    var grid = el('div', 'dgrid');
    THEMES.forEach(function (d) {
      var th = resolveTheme(d);
      var b = el('button', 'dtheme' + (deck.theme === d.id ? ' on' : '')); b.type = 'button';
      b.title = d.name;
      b.style.backgroundColor = th.bg;
      b.style.backgroundImage = th.css || 'none';
      var aa = el('span', 'dtheme-aa', 'Aa');
      aa.style.color = th.title.color; aa.style.fontFamily = S.fontFamily(th.title.font);
      var dots = el('span', 'dtheme-dots');
      [th.accent, th.title.color, th.body.color].forEach(function (c) {
        var i = el('i'); i.style.backgroundColor = c; dots.appendChild(i);
      });
      b.appendChild(aa); b.appendChild(dots);
      b.onclick = function () { applyDesign(d, ss.value); };
      grid.appendChild(b);
    });
    fmtHost.appendChild(grid);

    // ---- Colors: recolor the chosen design ----
    fmtHost.appendChild(el('hr', 'sep'));
    fmtHost.appendChild(el('h4', '', 'Colors'));
    var d0 = themeById(deck.theme) || themeById('office-dark');
    var list = el('div', 'clist');
    function row(name, label, swatches) {
      var r = el('button', 'crow' + ((deck.colorScheme || '') === name ? ' on' : '')); r.type = 'button';
      var sw = el('span', 'csw');
      swatches.forEach(function (c) { var i = el('i'); i.style.backgroundColor = c; sw.appendChild(i); });
      r.appendChild(sw); r.appendChild(el('span', 'cname', label));
      r.onclick = function () { applyColors(ss.value, name); };
      list.appendChild(r);
    }
    var own = d0.c;
    row('', 'Design colors', [own.bg, own.bg2, own.title, own.body, own.ac, own.ac2]);
    SCHEMES.forEach(function (sc) { row(sc.name, sc.name, sc.sw); });
    fmtHost.appendChild(list);

    var cur0 = colorsFor(d0);
    fmtHost.appendChild(el('div', 'pnote', 'Or make your own colors:'));
    var cg = el('div', 'prow2');
    [['bg', 'Background'], ['bg2', 'Background 2'], ['title', 'Heading'], ['body', 'Body text'], ['ac', 'Accent (verse reference)'], ['ac2', 'Accent 2']].forEach(function (p) {
      var f = field(p[1]);
      var inp = el('input'); inp.type = 'color'; inp.value = cur0[p[0]]; inp.className = 'cpick';
      inp.oninput = function () {
        var base = Object.assign({}, colorsFor(themeById(deck.theme) || d0));
        base[p[0]] = inp.value;
        if (!deck.theme) deck.theme = d0.id;
        deck.customColors = base;
        applyColors(ss.value, 'custom', true);
      };
      inp.onchange = function () { buildFormat(); };
      f.appendChild(inp); cg.appendChild(f);
    });
    fmtHost.appendChild(cg);
    var reset = el('button', 'btn outline', 'Back to the design’s own colors');
    reset.onclick = function () { applyColors(ss.value, ''); };
    fmtHost.appendChild(reset);
    fmtHost.appendChild(el('hr', 'sep'));
  }

  function buildSlideFormat() {
    buildGallery();
    fmtHost.appendChild(el('h4', '', 'Slide ' + (deck.current + 1) + ' background'));
    fmtHost.appendChild(el('div', 'pnote', 'Click a box on the slide to change its text, font and color. With nothing selected you are editing the slide itself.'));

    var bg = cur().bg;
    var f = field('Color');
    var row = el('div', 'bgrow'); row.style.flexWrap = 'wrap';
    f.appendChild(row);
    fmtHost.appendChild(f);

    function renderPicker() {
      row.textContent = '';
      BG_COLORS.forEach(function (c) {
        var b = el('button', 'bgbtn' + (!bg.imageId && !bg.css && (bg.color || '').toLowerCase() === c.toLowerCase() ? ' on' : ''));
        b.style.backgroundColor = c; b.title = c;
        b.onclick = function () { bg.imageId = ''; bg.css = ''; bg.color = c; changed(); renderPicker(); };
        row.appendChild(b);
      });
      var imgs = S.getJSON(K.bgImages, []);
      imgs.forEach(function (im) {
        var b = el('button', 'bgbtn bgimg' + (bg.imageId === im.id ? ' on' : ''));
        b.style.backgroundImage = 'url("' + im.url + '")'; b.title = im.name;
        b.onclick = function () { bg.imageId = im.id; changed(); renderPicker(); };
        row.appendChild(b);
      });
      var plus = el('button', 'bgbtn bgplus', '+'); plus.title = 'Add a background picture';
      var file = el('input'); file.type = 'file'; file.accept = 'image/*'; file.hidden = true;
      plus.onclick = function () {
        if (S.getJSON(K.bgImages, []).length >= S.MAX_BG_IMAGES) { S.toast('Too many pictures', 'You can keep up to ' + S.MAX_BG_IMAGES + ' pictures. Remove one in the Bible or Hymnals page first.'); return; }
        file.click();
      };
      file.onchange = function () {
        var fl = file.files[0]; file.value = '';
        S.saveBgImage(fl).then(function (entry) { bg.imageId = entry.id; changed(); renderPicker(); }).catch(function () {});
      };
      row.appendChild(plus); row.appendChild(file);
    }
    renderPicker();

    var all = el('button', 'btn outline', 'Use this background on ALL slides');
    all.onclick = function () {
      deck.slides.forEach(function (s) { s.bg = { color: bg.color, imageId: bg.imageId, css: bg.css || '' }; });
      saveNow(); drawSlideList(); S.toast('Done', 'All ' + deck.slides.length + ' slides use this background.');
    };
    fmtHost.appendChild(all);
  }

  /* ------------------------------------------------------------------ *
   * Bible panel (right, second tab)
   * ------------------------------------------------------------------ */
  var bib = {
    version: 'kjv',
    book: S.getRaw(K.book) || 'John',
    chapter: parseInt(S.getRaw(K.chapter), 10) || 3,
    from: 1, to: 1, data: null, err: ''
  };
  if (BK.allBooks.indexOf(bib.book) < 0) bib.book = 'John';

  var bibHost = $('bibleHost');
  var selV, selB, selC, selF, selT, quick, prevBox, btnAdd, btnUpd;

  function norm(s) { return s.toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function findBook(txt) {
    var n = norm(txt);
    if (!n) return null;
    var i;
    for (i = 0; i < BK.allBooks.length; i++) if (norm(BK.allBooks[i]) === n) return BK.allBooks[i];
    for (var tl in BK.tagalogToEnglishBookMap) if (norm(tl) === n) return BK.tagalogToEnglishBookMap[tl];
    for (i = 0; i < BK.allBooks.length; i++) if (norm(BK.allBooks[i]).indexOf(n) === 0) return BK.allBooks[i];
    for (var tl2 in BK.tagalogToEnglishBookMap) if (norm(tl2).indexOf(n) === 0) return BK.tagalogToEnglishBookMap[tl2];
    return null;
  }
  function parseRef(txt) {
    var m = /^\s*((?:[123]\s*)?[A-Za-z][A-Za-z .]*?)\s*(\d+)(?:\s*[:.]\s*(\d+)(?:\s*[-–—]\s*(\d+))?)?\s*$/.exec(txt);
    if (!m) return null;
    var book = findBook(m[1]);
    if (!book) return null;
    var ch = parseInt(m[2], 10);
    var f = m[3] ? parseInt(m[3], 10) : 1;
    var t = m[4] ? parseInt(m[4], 10) : (m[3] ? f : null);
    return { book: book, chapter: ch, from: f, to: t };
  }

  function fillSelect(sel, values, labelFn, value) {
    sel.textContent = '';
    values.forEach(function (v) { var o = el('option', '', labelFn ? labelFn(v) : String(v)); o.value = v; sel.appendChild(o); });
    sel.value = value;
  }
  function verseCount() { return bib.data && bib.data[bib.chapter] ? Object.keys(bib.data[bib.chapter]).length : 0; }

  function loadBible(keepRange) {
    bib.err = '';
    return S.loadBook(bib.version, bib.book).then(function (data) {
      bib.data = data;
      var chapters = Object.keys(data).map(Number).sort(function (a, b) { return a - b; });
      if (chapters.indexOf(bib.chapter) < 0) bib.chapter = chapters[0];
      fillSelect(selC, chapters, null, bib.chapter);
      var n = verseCount();
      var nums = []; for (var i = 1; i <= n; i++) nums.push(i);
      if (!keepRange) { bib.from = 1; bib.to = 1; }
      bib.from = clamp(bib.from, 1, n); bib.to = clamp(bib.to, bib.from, n);
      fillSelect(selF, nums, null, bib.from);
      fillSelect(selT, nums, null, bib.to);
      drawBiblePreview();
    }).catch(function () {
      bib.data = null; bib.err = 'Could not load this book.';
      drawBiblePreview();
    });
  }

  function composed() {
    if (!bib.data || !bib.data[bib.chapter]) return null;
    var ch = bib.data[bib.chapter], lines = [];
    for (var v = bib.from; v <= bib.to; v++) if (ch[v] !== undefined) lines.push(bib.from === bib.to ? ch[v] : v + ' ' + ch[v]);
    var ref = bib.book + ' ' + bib.chapter + ':' + bib.from + (bib.to > bib.from ? '-' + bib.to : '');
    return { ref: ref, text: lines.join('\n'), link: { book: bib.book, chapter: bib.chapter, from: bib.from, to: bib.to, version: bib.version } };
  }
  function drawBiblePreview() {
    prevBox.textContent = '';
    var c = composed();
    if (!c) { prevBox.appendChild(el('span', 'muted', bib.err || 'Loading...')); }
    else { prevBox.appendChild(el('b', '', c.ref + ' (' + bib.version.toUpperCase() + ')')); prevBox.appendChild(document.createTextNode(c.text)); }
    btnAdd.disabled = !c;
    var it = curEl();
    btnUpd.hidden = !(it && it.type === 'verse');
    btnUpd.disabled = !c;
  }

  function verseStyleFor(len) {
    var size = len > 520 ? 32 : len > 360 ? 36 : len > 240 ? 42 : len > 120 ? 48 : 56;
    return { fontFamily: 'Inter', fontSize: size, color: '#F5EBDD', bold: false, italic: false, align: 'left', lineHeight: 1.3 };
  }
  function makeVerse(c, onEmptySlide) {
    return themed({
      id: uid(), type: 'verse', x: 80, y: onEmptySlide ? 60 : 240, w: 1120, h: onEmptySlide ? 600 : 400,
      ref: c.ref, text: c.text, link: c.link, style: verseStyleFor(c.text.length),
      refStyle: { fontFamily: 'Inter', fontSize: 44, color: '#D4A373' }
    });
  }
  function addVerseToSlide() {
    var c = composed(); if (!c) return;
    addElement(makeVerse(c, cur().elements.length === 0));
    S.toast('Added', c.ref + ' is on slide ' + (deck.current + 1) + '.');
  }
  function newSlideWithVerse() {
    var c = composed(); if (!c) return;
    var s = newSlide(false);
    s.elements.push(makeVerse(c, true));
    addSlide(s);
    selId = s.elements[0].id; drawCanvas(); buildFormat();
  }
  function updateSelectedVerse() {
    var it = curEl(), c = composed();
    if (!it || it.type !== 'verse' || !c) return;
    it.ref = c.ref; it.text = c.text; it.link = c.link; delete it.html;
    it.style.fontSize = verseStyleFor(c.text.length).fontSize;
    changed({ rebuild: true });
  }

  function buildBible() {
    bibHost.appendChild(el('h4', '', 'Connect a Bible verse'));
    bibHost.appendChild(el('div', 'pnote', 'Pick a verse here and put it on any slide. No need to switch to the Bible page.'));

    var qf = field('Quick reference');
    quick = el('input'); quick.type = 'text'; quick.placeholder = 'e.g. John 3:16-18 or Juan 3:16';
    quick.onkeydown = function (e) {
      if (e.key !== 'Enter') return;
      var r = parseRef(quick.value);
      if (!r) { S.toast('Not found', 'Try a form like "John 3:16" or "Psalms 23:1-6".'); return; }
      bib.book = r.book; bib.chapter = r.chapter; bib.from = r.from; bib.to = r.to || r.from;
      selB.value = bib.book;
      loadBible(true).then(function () { quick.value = ''; });
    };
    qf.appendChild(quick);
    bibHost.appendChild(qf);

    var vf = field('Version');
    selV = el('select');
    VERSIONS.forEach(function (v) { var o = el('option', '', v[1]); o.value = v[0]; selV.appendChild(o); });
    selV.value = bib.version;
    selV.onchange = function () { bib.version = selV.value; loadBible(true); };
    vf.appendChild(selV);
    bibHost.appendChild(vf);

    var bf = field('Book');
    selB = el('select');
    BK.allBooks.forEach(function (b) { var o = el('option', '', b); o.value = b; selB.appendChild(o); });
    selB.value = bib.book;
    selB.onchange = function () { bib.book = selB.value; bib.chapter = 1; loadBible(false); };
    bf.appendChild(selB);
    bibHost.appendChild(bf);

    var row = el('div', 'prow3');
    var cf = field('Chapter'); selC = el('select'); cf.appendChild(selC);
    var ff = field('From'); selF = el('select'); ff.appendChild(selF);
    var tf = field('To'); selT = el('select'); tf.appendChild(selT);
    row.appendChild(cf); row.appendChild(ff); row.appendChild(tf);
    bibHost.appendChild(row);
    selC.onchange = function () { bib.chapter = parseInt(selC.value, 10); loadBible(false); };
    selF.onchange = function () { bib.from = parseInt(selF.value, 10); if (bib.to < bib.from) { bib.to = bib.from; selT.value = bib.to; } drawBiblePreview(); };
    selT.onchange = function () { bib.to = parseInt(selT.value, 10); if (bib.to < bib.from) { bib.from = bib.to; selF.value = bib.from; } drawBiblePreview(); };

    prevBox = el('div', 'pbib-prev');
    bibHost.appendChild(prevBox);

    btnAdd = el('button', 'btn', 'Add to this slide'); btnAdd.id = 'bibAdd'; btnAdd.onclick = addVerseToSlide;
    var btnNew = el('button', 'btn outline', 'New slide with this verse'); btnNew.id = 'bibNew'; btnNew.onclick = newSlideWithVerse;
    btnUpd = el('button', 'btn outline', 'Replace the selected verse box'); btnUpd.id = 'bibUpd'; btnUpd.onclick = updateSelectedVerse; btnUpd.hidden = true;
    bibHost.appendChild(btnAdd); bibHost.appendChild(btnNew); bibHost.appendChild(btnUpd);
    bibHost.appendChild(el('div', 'pnote', 'The verse box keeps its own text, so you can still edit, resize or restyle it on the slide.'));

    loadBible(false).then(function () {
      var ui = S.getJSON(K.preachDeck, {}).bible;
      if (ui) { /* (reserved) */ }
    });
  }

  /* ------------------------------------------------------------------ *
   * Tabs, toolbar, keys
   * ------------------------------------------------------------------ */
  function showTab(id) {
    document.querySelectorAll('#pTabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.pane === id); });
    ['paneFormat', 'paneBible'].forEach(function (p) { $(p).classList.toggle('on', p === id); });
    if (deck.tab !== id) { deck.tab = id; save(); }
    if (id === 'paneBible') drawBiblePreview();
  }
  document.querySelectorAll('#pTabs button').forEach(function (b) { b.onclick = function () { showTab(b.dataset.pane); }; });

  $('addSlide').onclick = function () { addSlide(newSlide(false)); };
  $('tDup').onclick = duplicateSlide;
  $('tDel').onclick = deleteSlide;
  $('tPrev').onclick = function () { gotoSlide(deck.current - 1); };
  $('tNext').onclick = function () { gotoSlide(deck.current + 1); };
  $('tText').onclick = function () { addElement(themed(newTextEl('New text', 260, 140, 56, '#F5EBDD', false))); };
  $('tDesign').onclick = function () {
    setSel(null);
    showTab('paneFormat');
    fmtHost.parentNode.scrollTop = 0;
  };
  $('tVerse').onclick = function () {
    showTab('paneBible');
    var c = composed();
    if (c) { addElement(makeVerse(c, cur().elements.length === 0)); }
    else S.toast('Pick a verse', 'Choose a book, chapter and verse in the Bible tab.');
  };
  $('tShow').onclick = function () {
    S.setRaw(K.contentType, 'preaching');
    liveId = cur().id;
    pushLive();
    window.open('present.html', 'present');
  };
  $('tClear').onclick = function () { liveId = null; pushLive(); };
  $('tFull').onclick = function () { S.setRaw(K.fullscreen, String(Date.now())); };

  document.addEventListener('keydown', function (e) {
    if (editing || e.altKey) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    var k = e.key;
    if (e.ctrlKey || e.metaKey) { // slide copy / cut / paste / select all / duplicate
      var lk = k.toLowerCase();
      var hasText = window.getSelection && String(window.getSelection()).length > 0;
      if (lk === 'c' && !hasText) { var n1 = copySlides(); S.toast('Copied', n1 + (n1 === 1 ? ' slide' : ' slides') + '. Press Ctrl+V to paste.'); e.preventDefault(); }
      else if (lk === 'x' && !hasText) { var n2 = copySlides(); if (n2) { deleteSlide(); S.toast('Cut', n2 + (n2 === 1 ? ' slide' : ' slides') + '. Press Ctrl+V to paste.'); } e.preventDefault(); }
      else if (lk === 'd') { duplicateSlide(); e.preventDefault(); }
      else if (lk === 'a') {
        picked = {}; deck.slides.forEach(function (s) { picked[s.id] = true; });
        highlightThumbs(); e.preventDefault();
      }
      return;
    }
    var it = curEl();
    if (k === 'PageUp') { gotoSlide(deck.current - 1); e.preventDefault(); }
    else if (k === 'PageDown') { gotoSlide(deck.current + 1); e.preventDefault(); }
    else if (k === 'Escape') { setSel(null); }
    else if ((k === 'Delete' || k === 'Backspace') && it) { deleteElement(); e.preventDefault(); }
    else if (k === 'Delete' || k === 'Backspace') { deleteSlide(); e.preventDefault(); }
    else if (e.shiftKey && !it && (k === 'ArrowUp' || k === 'ArrowDown')) {
      clickSlide(clamp(deck.current + (k === 'ArrowDown' ? 1 : -1), 0, deck.slides.length - 1), { shiftKey: true });
      e.preventDefault();
    }
    else if (k.indexOf('Arrow') === 0) {
      if (it) {
        var d = e.shiftKey ? 20 : 4;
        if (k === 'ArrowLeft') it.x -= d; else if (k === 'ArrowRight') it.x += d;
        else if (k === 'ArrowUp') it.y -= d; else it.y += d;
        changed(); syncGeometry(); e.preventDefault();
      } else {
        if (k === 'ArrowLeft' || k === 'ArrowUp') gotoSlide(deck.current - 1); else gotoSlide(deck.current + 1);
        e.preventDefault();
      }
    } else if (k.toLowerCase() === 'f') { S.setRaw(K.fullscreen, String(Date.now())); }
  });

  S.onChange(function (key) {
    if (key === K.bgImages) { drawCanvas(); drawSlideList(); if (!curEl()) buildFormat(); }
  });

  /* ------------------------------------------------------------------ *
   * Shapes
   * ------------------------------------------------------------------ */
  var SHAPES = [['rect', 'Rectangle'], ['round', 'Rounded rectangle'], ['ellipse', 'Oval'], ['triangle', 'Triangle'],
    ['diamond', 'Diamond'], ['star', 'Star'], ['arrow', 'Arrow'], ['chevron', 'Chevron'], ['cross', 'Plus'], ['heart', 'Heart'], ['line', 'Line']];
  var SHAPE_SIZE = { rect: [300, 200], round: [300, 200], ellipse: [300, 200], triangle: [260, 220], diamond: [240, 240], star: [240, 240],
    arrow: [360, 200], chevron: [320, 200], cross: [200, 200], heart: [240, 220], line: [420, 24] };

  function shapeIcon(kind) {
    var d = S.SHAPE_PATHS[kind];
    var line = kind === 'line';
    return '<svg width="30" height="30" viewBox="-6 -6 112 112" aria-hidden="true"><path d="' + d + '" fill="' + (line ? 'none' : 'currentColor') +
      '" stroke="currentColor" stroke-width="' + (line ? 9 : 0) + '" stroke-linecap="round"/></svg>';
  }
  var pop = el('div', 'shapepop'); pop.hidden = true;
  SHAPES.forEach(function (s) {
    var b = el('button', 'sp'); b.type = 'button'; b.title = s[1]; b.innerHTML = shapeIcon(s[0]);
    b.onclick = function () { pop.hidden = true; addShape(s[0]); };
    pop.appendChild(b);
  });
  $('tShape').parentNode.parentNode.appendChild(pop); // inside the center column
  $('tShape').onclick = function (e) {
    e.stopPropagation();
    if (!pop.hidden) { pop.hidden = true; return; }
    var host = pop.parentNode.getBoundingClientRect(), b = $('tShape').getBoundingClientRect();
    pop.style.left = Math.round(b.left - host.left) + 'px';
    pop.style.top = Math.round(b.bottom - host.top + 4) + 'px';
    pop.hidden = false;
  };
  document.addEventListener('click', function (e) { if (!pop.hidden && !pop.contains(e.target)) pop.hidden = true; });

  function addShape(kind) {
    if (endEdit) endEdit();
    var sz = SHAPE_SIZE[kind], line = kind === 'line';
    var off = (cur().elements.filter(function (e) { return e.type === 'shape'; }).length % 6) * 24; // a little stagger so copies don't hide each other
    var it = {
      id: uid(), type: 'shape', shape: kind, x: Math.round((W - sz[0]) / 2) + off, y: Math.round((H - sz[1]) / 2) + off, w: sz[0], h: sz[1],
      fill: line ? '' : '#3B82F6', stroke: line ? '#3B82F6' : '', strokeW: line ? 8 : 0, opacity: 1, auto: true
    };
    addElement(themed(it));
  }

  function noFillButton(item) {
    var b = el('button', 'btn outline sm', 'No fill');
    b.onclick = function () { item.fill = ''; item.auto = false; changed({ rebuild: true }); };
    return b;
  }
  function geomAndActions(item) { // position, size, order, duplicate, delete (same as for text boxes)
    fmtHost.appendChild(el('hr', 'sep'));
    fmtHost.appendChild(el('h4', '', 'Position & size'));
    var g = el('div', 'prow2'), inputs = {};
    [['x', 'X'], ['y', 'Y'], ['w', 'Width'], ['h', 'Height']].forEach(function (p) {
      var f = field(p[1]), inp = el('input'); inp.type = 'text'; inp.inputMode = 'numeric'; inp.value = Math.round(item[p[0]]);
      inp.onchange = function () {
        var v = parseInt(inp.value, 10);
        if (isNaN(v)) { inp.value = Math.round(item[p[0]]); return; }
        item[p[0]] = (p[0] === 'w' || p[0] === 'h') ? clamp(v, 4, 3000) : clamp(v, -2000, 3000);
        if (item.type === 'image' && item.ar) { if (p[0] === 'w') item.h = Math.round(item.w / item.ar); else if (p[0] === 'h') item.w = Math.round(item.h * item.ar); }
        changed({ rebuild: true });
      };
      f.appendChild(inp); g.appendChild(f); inputs[p[0]] = inp;
    });
    fmtHost.appendChild(g);
    geomSync = function () { ['x', 'y', 'w', 'h'].forEach(function (k) { inputs[k].value = Math.round(item[k]); }); };
    var r1 = el('div', 'prow2');
    var fr = el('button', 'btn outline', 'Bring to front'); fr.onclick = function () { reorderElement(true); };
    var bk = el('button', 'btn outline', 'Send to back'); bk.onclick = function () { reorderElement(false); };
    r1.appendChild(fr); r1.appendChild(bk); fmtHost.appendChild(r1);
    var r2 = el('div', 'prow2');
    var du = el('button', 'btn outline', 'Duplicate'); du.onclick = duplicateElement;
    var de = el('button', 'btn danger', 'Delete'); de.onclick = deleteElement;
    r2.appendChild(du); r2.appendChild(de); fmtHost.appendChild(r2);
  }

  function buildShapeFormat(item) {
    var name = (SHAPES.filter(function (s) { return s[0] === item.shape; })[0] || ['', 'Shape'])[1];
    fmtHost.appendChild(el('h4', '', name));
    var isLine = item.shape === 'line';
    var more = COLORS.concat(['#EF4444', '#22C55E']);
    if (!isLine) {
      fmtHost.appendChild(colorField('Fill', more, function () { return item.fill; }, function (v) { item.fill = v; item.auto = false; changed(); }));
      fmtHost.appendChild(noFillButton(item));
    }
    fmtHost.appendChild(colorField(isLine ? 'Line color' : 'Outline color', more, function () { return item.stroke; }, function (v) {
      item.stroke = v; item.auto = false; if (!item.strokeW) item.strokeW = isLine ? 8 : 4; changed();
    }));
    fmtHost.appendChild(sliderField(isLine ? 'Line thickness' : 'Outline width', 0, 40, 1, 'px', function () { return item.strokeW || 0; }, function (v) {
      item.strokeW = v; if (v && !item.stroke) item.stroke = item.fill || '#FFFFFF'; changed();
    }));
    fmtHost.appendChild(sliderField('Opacity', 10, 100, 5, '%', function () { return Math.round((item.opacity == null ? 1 : item.opacity) * 100); }, function (v) { item.opacity = v / 100; changed(); }));
    geomAndActions(item);
  }
  function buildShapeBar(it) {
    var isLine = it.shape === 'line';
    var more = COLORS.concat(['#EF4444', '#22C55E']);
    var label = el('span', 'fb-label', isLine ? 'Line' : 'Fill'); fbar.appendChild(label);
    var cur0 = ((isLine ? it.stroke : it.fill) || '').toLowerCase();
    more.forEach(function (c) {
      var b = el('button', 'fb-sw' + (c.toLowerCase() === cur0 ? ' on' : '')); b.type = 'button'; b.style.backgroundColor = c; b.title = c;
      b.onclick = function () { if (isLine) it.stroke = c; else it.fill = c; it.auto = false; changed(); };
      fbar.appendChild(b);
    });
    var pick = el('input'); pick.type = 'color'; pick.className = 'fb-pick'; pick.title = 'Any color';
    try { pick.value = cur0 || '#3b82f6'; } catch (x) {}
    pick.onchange = function () { if (isLine) it.stroke = pick.value; else it.fill = pick.value; it.auto = false; changed(); };
    fbar.appendChild(pick);
    if (!isLine) fbar.appendChild(fbtn('∅', 'No fill', function () { it.fill = ''; it.auto = false; changed(); }, !it.fill));
    fbar.appendChild(el('span', 'fb-sep'));
    if (!isLine) {
      fbar.appendChild(el('span', 'fb-label', 'Outline'));
      var op = el('input'); op.type = 'color'; op.className = 'fb-pick'; op.title = 'Outline color';
      try { op.value = it.stroke || '#ffffff'; } catch (x) {}
      op.onchange = function () { it.stroke = op.value; it.auto = false; if (!it.strokeW) it.strokeW = 4; changed(); };
      fbar.appendChild(op);
    }
    fbar.appendChild(fbtn('&minus;', 'Thinner', function () { it.strokeW = Math.max(0, (it.strokeW || 0) - 2); if (it.strokeW && !it.stroke) it.stroke = '#FFFFFF'; changed(); }, false));
    fbar.appendChild(el('span', 'fb-num', String(it.strokeW || 0)));
    fbar.appendChild(fbtn('+', 'Thicker', function () { it.strokeW = Math.min(40, (it.strokeW || 0) + 2); if (!it.stroke) it.stroke = it.fill || '#FFFFFF'; changed(); }, false));
    fbar.appendChild(el('span', 'fb-sep'));
    fbar.appendChild(fbtn('⬆', 'Bring to front', function () { reorderElement(true); }, false));
    fbar.appendChild(fbtn('⬇', 'Send to back', function () { reorderElement(false); }, false));
    var del = fbtn('&#128465;', 'Delete this shape', function () { deleteElement(); }, false); del.className += ' danger';
    fbar.appendChild(del);
    fbar.hidden = false; placeBar();
  }

  /* ------------------------------------------------------------------ *
   * Pictures: toolbar button, drag and drop, paste
   * ------------------------------------------------------------------ */
  // shrink to a sensible size so it fits in browser storage; keep transparency for PNG / GIF / WebP / SVG
  function processImage(file) {
    return new Promise(function (resolve, reject) {
      if (!file || String(file.type).indexOf('image/') !== 0) { reject(new Error('not an image')); return; }
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var keepAlpha = /png|gif|webp|svg/.test(file.type);
        var nw = img.naturalWidth || 800, nh = img.naturalHeight || 600;
        var sc = Math.min(1, (keepAlpha ? 1400 : 1600) / Math.max(nw, nh));
        var c, data;
        for (var tries = 0; tries < 6; tries++) {
          c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(nw * sc)); c.height = Math.max(1, Math.round(nh * sc));
          var g = c.getContext('2d');
          if (!keepAlpha) { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); }
          g.drawImage(img, 0, 0, c.width, c.height);
          data = keepAlpha ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.85);
          if (data.length < 1400000 || sc < 0.25) break;
          sc *= 0.75;
        }
        URL.revokeObjectURL(url);
        var map = Object.assign({}, S.preachImages()), id = uid();
        map[id] = data;
        var json = JSON.stringify(map);
        S.setRaw(K.preachImages, json);
        if (S.getRaw(K.preachImages) !== json) { // the browser refused to store it
          S.toast('Picture not saved', 'Browser storage is full. Delete a picture from your slides, or use a smaller one.');
          reject(new Error('storage full')); return;
        }
        resolve({ id: id, w: c.width, h: c.height });
      };
      img.onerror = function () { URL.revokeObjectURL(url); S.toast('Could not read the picture', 'The file may be damaged or not an image.'); reject(new Error('unreadable')); };
      img.src = url;
    });
  }

  // at = {x, y} on the slide (where it was dropped), otherwise the middle of the slide
  function addImageFiles(files, at) {
    var list = Array.prototype.filter.call(files || [], function (f) { return String(f.type).indexOf('image/') === 0; });
    if (!list.length) return;
    if (endEdit) endEdit();
    var slide = cur();
    list.reduce(function (chain, file, k) {
      return chain.then(function () {
        return processImage(file).then(function (r) {
          var w = r.w, h = r.h, f = Math.min(1, 900 / w, 560 / h);
          w = Math.round(w * f); h = Math.round(h * f);
          var cx = at ? at.x : W / 2, cy = at ? at.y : H / 2;
          var it = { id: uid(), type: 'image', imageId: r.id, ar: r.w / r.h, opacity: 1, w: w, h: h,
            x: Math.round(clamp(cx - w / 2 + k * 30, -w + 40, W - 40)), y: Math.round(clamp(cy - h / 2 + k * 30, -h + 40, H - 40)) };
          slide.elements.push(it);
          if (cur() === slide) { selId = it.id; changed({ rebuild: true }); }
          else { save(); drawThumb(deck.slides.indexOf(slide)); }
        });
      }).catch(function () { /* message already shown */ });
    }, Promise.resolve());
  }

  // forget pictures no slide uses any more (keeps storage small)
  function pruneImages() {
    var map = S.preachImages(), ids = Object.keys(map);
    if (!ids.length) return;
    var used = {};
    function scan(s) { s.elements.forEach(function (e) { if (e.imageId) used[e.imageId] = true; }); }
    deck.slides.forEach(scan); clip.forEach(scan);
    var drop = ids.filter(function (i) { return !used[i]; });
    if (!drop.length) return;
    var copy = Object.assign({}, map);
    drop.forEach(function (i) { delete copy[i]; });
    S.setJSON(K.preachImages, copy);
  }

  $('tImage').onclick = function () { $('imgIn').click(); };
  $('imgIn').onchange = function () { var f = $('imgIn').files; addImageFiles(f); $('imgIn').value = ''; };

  function hasFiles(e) { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0; }
  wrap.addEventListener('dragover', function (e) { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; wrap.classList.add('dropping'); } });
  wrap.addEventListener('dragleave', function (e) { if (!wrap.contains(e.relatedTarget)) wrap.classList.remove('dropping'); });
  wrap.addEventListener('drop', function (e) {
    if (!hasFiles(e)) return;
    e.preventDefault(); wrap.classList.remove('dropping');
    var br = box.getBoundingClientRect();
    addImageFiles(e.dataTransfer.files, { x: (e.clientX - br.left) / scale, y: (e.clientY - br.top) / scale });
  });
  // a file dropped outside the slide must not make the browser leave the page
  ['dragover', 'drop'].forEach(function (t) { document.addEventListener(t, function (e) { if (hasFiles(e)) e.preventDefault(); }); });

  // Ctrl+V: a picture from the clipboard goes on the slide; otherwise pasted slides (see Ctrl+C)
  document.addEventListener('paste', function (e) {
    var t = e.target;
    if (editing || (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable))) return;
    var cd = e.clipboardData, files = [];
    if (cd) {
      if (cd.files && cd.files.length) files = Array.prototype.slice.call(cd.files);
      else if (cd.items) Array.prototype.forEach.call(cd.items, function (i) { if (i.kind === 'file') { var f = i.getAsFile(); if (f) files.push(f); } });
    }
    files = files.filter(function (f) { return String(f.type).indexOf('image/') === 0; });
    if (files.length) { e.preventDefault(); addImageFiles(files); return; }
    if (clip.length && pasteSlides()) e.preventDefault();
  });

  function buildImageFormat(item) {
    fmtHost.appendChild(el('h4', '', 'Picture'));
    fmtHost.appendChild(el('div', 'pnote', 'Drag the corner to resize (it keeps its shape; hold Shift to stretch). You can also drop or paste more pictures onto the slide.'));
    fmtHost.appendChild(sliderField('Opacity', 10, 100, 5, '%', function () { return Math.round((item.opacity == null ? 1 : item.opacity) * 100); }, function (v) { item.opacity = v / 100; changed(); }));
    var row = el('div', 'prow2');
    var fit1 = el('button', 'btn outline', 'Fit to slide'); fit1.onclick = function () { fitImage(item); };
    var ratio = el('button', 'btn outline', 'Original shape'); ratio.onclick = function () { if (item.ar) { item.h = Math.round(item.w / item.ar); changed({ rebuild: true }); } };
    row.appendChild(fit1); row.appendChild(ratio); fmtHost.appendChild(row);
    geomAndActions(item);
  }
  function fitImage(it) { // as big as possible inside the slide, centered
    var ar = it.ar || (it.w / it.h);
    var w = Math.min(W, H * ar), h = w / ar;
    it.w = Math.round(w); it.h = Math.round(h); it.x = Math.round((W - w) / 2); it.y = Math.round((H - h) / 2);
    changed({ rebuild: true });
  }
  function buildImageBar(it) {
    fbar.appendChild(fbtn('Fit to slide', 'Make the picture as big as the slide', function () { fitImage(it); }, false));
    fbar.appendChild(fbtn('Original shape', 'Undo stretching', function () { if (it.ar) { it.h = Math.round(it.w / it.ar); changed(); } }, false));
    fbar.appendChild(el('span', 'fb-sep'));
    fbar.appendChild(fbtn('⬆', 'Bring to front', function () { reorderElement(true); }, false));
    fbar.appendChild(fbtn('⬇', 'Send to back', function () { reorderElement(false); }, false));
    var del = fbtn('&#128465;', 'Delete this picture', function () { deleteElement(); }, false); del.className += ' danger';
    fbar.appendChild(del);
    fbar.hidden = false; placeBar();
  }

  /* ------------------------------------------------------------------ *
   * Start
   * ------------------------------------------------------------------ */
  S.setRaw(K.contentType, 'preaching');
  window.addEventListener('focus', function () { if (S.getRaw(K.contentType) !== 'preaching') S.setRaw(K.contentType, 'preaching'); });

  pruneImages();
  buildBible();
  drawSlideList();
  fit();
  drawCanvas();
  buildFormat();
  showTab(deck.tab === 'paneBible' ? 'paneBible' : 'paneFormat');
  pushLive();
  // thumbnails need real widths: draw them again once the layout settled
  setTimeout(function () { thumbNodes.forEach(function (t, i) { drawThumb(i); }); fit(); }, 60);
  saveNow();
})();
