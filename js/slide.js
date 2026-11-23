/* Draws one Preaching slide. Used by the editor canvas, the slide thumbnails and the projector.
 *
 * A slide is {id, bg:{color, imageId}, elements:[...]} on a fixed 1280 x 720 stage.
 * An element is {id, type:'text'|'verse', x, y, w, h, text, style:{...}}
 *   verse elements also have: ref (e.g. "John 3:16"), refStyle:{fontFamily,fontSize,color}, link:{book,chapter,from,to,version}
 *   style = {fontFamily, fontSize (px), color, bold, italic, align, lineHeight}
 *
 *   var nodes = SBVC.renderSlide(stageElement, slide);   // nodes[element.id] -> the drawn <div>
 */
(function () {
  'use strict';
  var S = window.SBVC;
  var K = S.KEYS;

  var STAGE_W = 1280, STAGE_H = 720;

  function pictureUrl(id) {
    if (!id) return null;
    var list = S.getJSON(K.bgImages, []);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i].url;
    return null;
  }

  // pictures placed on slides are kept in one list; cache it (the list can be large) until it changes
  var imgCache = null;
  S.onChange(function (key) { if (key === K.preachImages || key === null) imgCache = null; });
  function imageMap() {
    if (!imgCache) { imgCache = S.getJSON(K.preachImages, {}); if (!imgCache || typeof imgCache !== 'object') imgCache = {}; }
    return imgCache;
  }

  // outlines on a 100 x 100 box (stretched to the shape's size). rect / round / oval are drawn with CSS instead.
  var NS = 'http://www.w3.org/2000/svg';
  var SHAPE_PATHS = {
    rect: 'M0 15H100V85H0Z',
    round: 'M15 15H85A15 15 0 0 1 100 30V70A15 15 0 0 1 85 85H15A15 15 0 0 1 0 70V30A15 15 0 0 1 15 15Z',
    ellipse: 'M0 50A50 35 0 1 0 100 50A50 35 0 1 0 0 50Z',
    triangle: 'M50 0L100 100L0 100Z',
    diamond: 'M50 0L100 50L50 100L0 50Z',
    star: 'M50 2L61.8 36.5L98 36.8L69 58.6L79.7 93.2L50 72.5L20.3 93.2L31 58.6L2 36.8L38.2 36.5Z',
    arrow: 'M0 30L60 30L60 5L100 50L60 95L60 70L0 70Z',
    chevron: 'M0 0L60 0L100 50L60 100L0 100L40 50Z',
    cross: 'M35 0H65V35H100V65H65V100H35V65H0V35H35Z',
    heart: 'M50 92C8 60 0 34 20 14C35 1 50 14 50 26C50 14 65 1 80 14C100 34 92 60 50 92Z',
    line: 'M0 50L100 50'
  };

  function drawShape(n, el) {
    var kind = el.shape || 'rect', sw = el.strokeW || 0;
    n.style.overflow = 'visible';
    if (el.opacity !== undefined && el.opacity < 1) n.style.opacity = String(el.opacity);
    if (kind === 'rect' || kind === 'round' || kind === 'ellipse') {
      n.style.background = el.fill || 'transparent';
      if (el.stroke && sw) n.style.border = sw + 'px solid ' + el.stroke;
      n.style.borderRadius = kind === 'ellipse' ? '50%' : kind === 'round' ? Math.round(Math.min(el.w, el.h) * 0.18) + 'px' : '0';
      return;
    }
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.cssText = 'width:100%;height:100%;display:block;overflow:visible';
    var p = document.createElementNS(NS, 'path');
    p.setAttribute('d', SHAPE_PATHS[kind] || SHAPE_PATHS.triangle);
    p.setAttribute('fill', kind === 'line' ? 'none' : (el.fill || 'none'));
    p.setAttribute('stroke', el.stroke || 'none');
    p.setAttribute('stroke-width', String(sw));
    p.setAttribute('vector-effect', 'non-scaling-stroke');
    p.setAttribute('stroke-linejoin', 'round');
    p.setAttribute('stroke-linecap', 'round');
    svg.appendChild(p);
    n.appendChild(svg);
  }

  function drawImage(n, el) {
    if (el.opacity !== undefined && el.opacity < 1) n.style.opacity = String(el.opacity);
    var url = imageMap()[el.imageId];
    if (!url) return;
    var im = document.createElement('img');
    im.src = url; im.alt = ''; im.draggable = false;
    im.style.cssText = 'width:100%;height:100%;display:block;object-fit:fill;pointer-events:none';
    n.appendChild(im);
  }

  // ---- rich text: parts of a box can have their own size / color / font / bold / italic.
  // Stored as a small HTML string (only <span style="..."> and <br>); always cleaned before use.
  var OK_PROP = {
    'font-size': /^\d+(\.\d+)?px$/,
    'color': /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i,
    'font-family': /^["']?[A-Za-z0-9 ]{1,40}["']?(,\s*[a-z-]+)?$/i,
    'font-weight': /^(normal|bold|[1-9]00)$/,
    'font-style': /^(normal|italic)$/,
    'text-decoration-line': /^(underline|none)$/
  };
  function cleanInto(dst, src) {
    Array.prototype.slice.call(src.childNodes).forEach(function (c) {
      if (c.nodeType === 3) { dst.appendChild(document.createTextNode(c.nodeValue)); return; }
      if (c.nodeType !== 1) return;
      var t = c.tagName.toLowerCase();
      if (t === 'br') { dst.appendChild(document.createElement('br')); return; }
      if (t === 'span' || t === 'b' || t === 'strong' || t === 'i' || t === 'em' || t === 'u') {
        var sp = document.createElement('span');
        Object.keys(OK_PROP).forEach(function (p) {
          var v = c.style.getPropertyValue(p);
          if (v && OK_PROP[p].test(v.trim())) sp.style.setProperty(p, v.trim());
        });
        if (t === 'b' || t === 'strong') sp.style.fontWeight = 'bold';
        if (t === 'i' || t === 'em') sp.style.fontStyle = 'italic';
        if (t === 'u') sp.style.textDecorationLine = 'underline';
        if (!sp.getAttribute('style')) { cleanInto(dst, c); return; } // nothing we keep: just the text
        cleanInto(sp, c);
        dst.appendChild(sp);
      } else {
        cleanInto(dst, c); // any other tag: keep its text, drop the tag
      }
    });
  }
  function richInto(node, html) { // the parser here is inert: nothing in the HTML is loaded or run
    var body = new DOMParser().parseFromString(html || '', 'text/html').body;
    cleanInto(node, body);
  }
  function cleanRich(html) {
    var tmp = document.createElement('div');
    richInto(tmp, html);
    return tmp.innerHTML;
  }

  function applyTextStyle(node, st) {
    node.style.fontFamily = S.fontFamily(st.fontFamily || 'Inter');
    node.style.fontSize = (st.fontSize || 48) + 'px';
    node.style.color = st.color || '#F5EBDD';
    node.style.fontWeight = st.bold ? '700' : '400';
    node.style.fontStyle = st.italic ? 'italic' : 'normal';
    node.style.textAlign = st.align || 'left';
    node.style.lineHeight = String(st.lineHeight || 1.25);
  }

  function renderSlide(stage, slide) {
    stage.textContent = '';
    stage.classList.add('sl-stage');
    stage.style.width = STAGE_W + 'px';
    stage.style.height = STAGE_H + 'px';

    var bg = slide.bg || {};
    stage.style.backgroundColor = bg.color || '#000000';
    var url = pictureUrl(bg.imageId);
    stage.style.backgroundImage = url ? 'url("' + url + '")' : (bg.css || 'none'); // picture first, then a design's layers
    stage.style.backgroundSize = 'cover';
    stage.style.backgroundPosition = 'center';

    var nodes = {};
    (slide.elements || []).forEach(function (el) {
      var n = document.createElement('div');
      n.className = 'sl-el';
      n.dataset.id = el.id;
      n.style.left = el.x + 'px';
      n.style.top = el.y + 'px';
      n.style.width = el.w + 'px';
      n.style.height = el.h + 'px';

      if (el.type === 'shape') {
        drawShape(n, el);
      } else if (el.type === 'image') {
        drawImage(n, el);
      } else if (el.type === 'verse') {
        var r = document.createElement('div');
        r.className = 'sl-ref';
        r.textContent = el.ref || '';
        var rs = el.refStyle || {};
        r.style.fontFamily = S.fontFamily(rs.fontFamily || el.style.fontFamily || 'Inter');
        r.style.fontSize = (rs.fontSize || 40) + 'px';
        r.style.color = rs.color || '#D4A373';
        r.style.fontWeight = '700';
        r.style.textAlign = el.style.align || 'left';
        r.style.marginBottom = '8px';
        var t = document.createElement('div');
        t.className = 'sl-vt';
        if (el.html) richInto(t, el.html); else t.textContent = el.text || '';
        applyTextStyle(t, el.style);
        n.appendChild(r);
        n.appendChild(t);
      } else {
        if (el.html) richInto(n, el.html); else n.textContent = el.text || '';
        applyTextStyle(n, el.style);
      }
      nodes[el.id] = n;
      stage.appendChild(n);
    });
    return nodes;
  }

  S.STAGE_W = STAGE_W;
  S.STAGE_H = STAGE_H;
  S.renderSlide = renderSlide;
  S.SHAPE_PATHS = SHAPE_PATHS;
  S.richInto = richInto;
  S.cleanRich = cleanRich;
  S.preachImages = imageMap;
})();
