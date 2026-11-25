/* Design templates + Colors (the same ones as the Preaching page) for the Hymnals page and the Bible controller.
 * Choosing a design sets the screen background (color + its gradient / bands), the title and text
 * fonts and colors. Font sizes, spacing and alignment in the Customization panel are not touched.
 *   SBVC.createDesignPanel(hostElement, { stateKey, customKey, name, titleLabel, textLabel })
 * stateKey  = where the choice is remembered {theme, colorScheme, customColors}
 * customKey = the customization the design writes its fonts / colors into
 * name      = id for remembering which sections are minimized
 */
(function () {
  'use strict';
  var S = window.SBVC;
  var K = S.KEYS;
  var D = S.designs;

  function createDesignPanel(host, opts) {
  if (!host || !D) return;
  var stateKey = opts.stateKey, customKey = opts.customKey;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function field(label) {
    var f = el('div', 'field');
    f.appendChild(el('label', 'lbl', label));
    return f;
  }

  var st = S.getJSON(stateKey, null);
  if (!st || typeof st !== 'object') st = { theme: '', colorScheme: '', customColors: null };

  function save() { S.setJSON(stateKey, st); }
  function design() { return D.themeById(st.theme) || D.themeById('office-dark'); }
  function colorsInUse(d) { return D.colors(d, st.colorScheme, st.customColors); }

  // paint the design + colors in use onto the hymn screen
  function paint() {
    var d = design();
    var th = D.resolve(d, colorsInUse(d));
    S.setRaw(K.bgImage, null);                 // a design replaces a background picture
    S.setRaw(K.bgCss, th.css || null);
    S.setRaw(K.bg, th.bg);
    S.setCustom({ titleFontFamily: th.title.font, titleColor: th.title.color, fontFamily: th.body.font, textColor: th.body.color }, customKey);
    return d;
  }

  function applyDesign(d) {
    st.theme = d.id; st.colorScheme = ''; st.customColors = null; // a new design brings its own colors
    save(); paint(); build();
    S.toast(d.name, 'Applied to the screen.');
  }
  function applyColors(scheme, quiet) { // '' = the design's own colors, a scheme name, or 'custom'
    if (!st.theme) st.theme = 'office-dark';
    st.colorScheme = scheme;
    if (scheme !== 'custom') st.customColors = null;
    save(); paint();
    if (!quiet) { build(); S.toast(scheme || 'Design colors', 'Applied to the screen.'); }
  }

  function build() {
    host.textContent = '';
    host.appendChild(el('h4', '', 'Design'));
    var grid = el('div', 'dgrid');
    D.THEMES.forEach(function (d) {
      var th = D.resolve(d, D.colors(d, st.theme === d.id ? st.colorScheme : '', st.theme === d.id ? st.customColors : null));
      var b = el('button', 'dtheme' + (st.theme === d.id ? ' on' : '')); b.type = 'button';
      b.title = d.name;
      b.style.backgroundColor = th.bg;
      b.style.backgroundImage = th.css || 'none';
      var aa = el('span', 'dtheme-aa', 'Aa');
      aa.style.color = th.title.color; aa.style.fontFamily = S.fontFamily(th.title.font);
      var dots = el('span', 'dtheme-dots');
      [th.accent, th.title.color, th.body.color].forEach(function (c) { var i = el('i'); i.style.backgroundColor = c; dots.appendChild(i); });
      b.appendChild(aa); b.appendChild(dots);
      b.onclick = function () { applyDesign(d); };
      grid.appendChild(b);
    });
    host.appendChild(grid);

    host.appendChild(el('hr', 'sep'));
    host.appendChild(el('h4', '', 'Colors'));
    var d0 = design();
    var list = el('div', 'clist');
    function row(name, label, swatches) {
      var r = el('button', 'crow' + (st.theme && (st.colorScheme || '') === name ? ' on' : '')); r.type = 'button';
      var sw = el('span', 'csw');
      swatches.forEach(function (c) { var i = el('i'); i.style.backgroundColor = c; sw.appendChild(i); });
      r.appendChild(sw); r.appendChild(el('span', 'cname', label));
      r.onclick = function () { applyColors(name); };
      list.appendChild(r);
    }
    var own = d0.c;
    row('', 'Design colors', [own.bg, own.bg2, own.title, own.body, own.ac, own.ac2]);
    D.SCHEMES.forEach(function (sc) { row(sc.name, sc.name, sc.sw); });
    host.appendChild(list);

    var cur = colorsInUse(d0);
    host.appendChild(el('div', 'pnote', 'Or make your own colors:'));
    var cg = el('div', 'prow2');
    [['bg', 'Background'], ['bg2', 'Background 2'], ['title', opts.titleLabel || 'Title'], ['body', opts.textLabel || 'Text'], ['ac', 'Accent'], ['ac2', 'Accent 2']].forEach(function (p) {
      var f = field(p[1]);
      var inp = el('input'); inp.type = 'color'; inp.value = cur[p[0]]; inp.className = 'cpick';
      inp.oninput = function () {
        var base = Object.assign({}, colorsInUse(design()));
        base[p[0]] = inp.value;
        if (!st.theme) st.theme = d0.id;
        st.customColors = base;
        applyColors('custom', true);
      };
      inp.onchange = function () { build(); };
      f.appendChild(inp); cg.appendChild(f);
    });
    host.appendChild(cg);
    var reset = el('button', 'btn outline', 'Back to the design’s own colors');
    reset.onclick = function () { applyColors(''); };
    host.appendChild(reset);
    host.appendChild(el('hr', 'sep'));
    S.makeCollapsible(host, opts.name); // each section opens / closes
  }

  build();
  }

  S.createDesignPanel = createDesignPanel;
})();
