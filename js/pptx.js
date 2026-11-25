/* Real PowerPoint files (.pptx) for the Preaching and PowerPoint pages.
 *   SBVC.pptxExport(slides, ctx)  -> Promise<Blob>      ctx = {images:{id:dataUrl}, bgImages:[{id,url}]}
 *   SBVC.pptxImport(file)         -> Promise<{slides, images, notes}>   (best effort: see the notes it returns)
 * The two libraries (PptxGenJS, JSZip) are kept in js/vendor and loaded only when needed.
 *
 * Export: text, shapes, pictures (with crop / turn / flip / shape), backgrounds (design gradients become a picture).
 * Import: text with basic formatting, pictures, simple shapes, backgrounds, simple tables (as text).
 *         Not carried: animations, transitions, charts, SmartArt, videos, sounds, gradient / pattern fills inside shapes.
 */
(function () {
  'use strict';
  var S = window.SBVC;
  var W = 1280, H = 720;

  function lib(src, name) {
    if (window[name]) return Promise.resolve();
    return S.loadScript(src);
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function px2in(v) { return Math.round(v / 96 * 1000) / 1000; }

  /* ------------------------------------------------------------------ *
   * Colors
   * ------------------------------------------------------------------ */
  function parseColor(c) { // '#rgb' '#rrggbb' 'rgb(a)(...)' -> {hex:'RRGGBB', a:0..1} or null
    if (!c || typeof c !== 'string') return null;
    c = c.trim();
    var m = /^#([0-9a-f]{3})$/i.exec(c);
    if (m) return { hex: m[1].replace(/./g, '$&$&').toUpperCase(), a: 1 };
    m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(c);
    if (m) return { hex: m[1].toUpperCase(), a: m[2] ? parseInt(m[2], 16) / 255 : 1 };
    m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i.exec(c);
    if (m) {
      var h = [m[1], m[2], m[3]].map(function (x) { return ('0' + Math.max(0, Math.min(255, parseInt(x, 10))).toString(16)).slice(-2); }).join('').toUpperCase();
      var a = m[4] === undefined ? 1 : (/%$/.test(m[4]) ? parseFloat(m[4]) / 100 : parseFloat(m[4]));
      return { hex: h, a: a };
    }
    return null;
  }
  function lumOf(hex) { return (0.299 * parseInt(hex.substr(0, 2), 16) + 0.587 * parseInt(hex.substr(2, 2), 16) + 0.114 * parseInt(hex.substr(4, 2), 16)) / 255; }

  function loadImg(url) {
    return new Promise(function (res) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { res(null); }; im.src = url; });
  }

  /* ------------------------------------------------------------------ *
   * EXPORT
   * ------------------------------------------------------------------ */
  var SHAPE_MAP = { rect: 'rect', round: 'roundRect', ellipse: 'ellipse', triangle: 'triangle', diamond: 'diamond', star: 'star5',
    arrow: 'rightArrow', chevron: 'chevron', cross: 'plus', heart: 'heart', line: 'line' };

  function xmlEsc(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function rasterBg(css, color) { // a design's gradient / bands drawn once as a picture
    return new Promise(function (res) {
      try {
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:' + W + 'px;height:' + H + 'px;background-color:' + xmlEsc(color || '#000') + ';background-image:' + xmlEsc(css) + ';background-size:cover;background-position:center"></div></foreignObject></svg>';
        var im = new Image();
        im.onload = function () {
          try { var c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').drawImage(im, 0, 0); res(c.toDataURL('image/jpeg', 0.9)); } catch (e) { res(null); }
        };
        im.onerror = function () { res(null); };
        im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      } catch (e) { res(null); }
    });
  }

  // runs of text for PptxGenJS from a rich-text string (or plain text) and a base style
  function runsOf(html, text, st, extraOpts) {
    var box = document.createElement('div');
    if (html) S.richInto(box, html); else box.textContent = text || '';
    var runs = [];
    function opts(o) { var r = {}; Object.keys(extraOpts || {}).forEach(function (k) { r[k] = extraOpts[k]; }); Object.keys(o).forEach(function (k) { r[k] = o[k]; }); return r; }
    function walk(node, cur) {
      Array.prototype.forEach.call(node.childNodes, function (c) {
        if (c.nodeType === 3) {
          var parts = c.nodeValue.split('\n');
          parts.forEach(function (p, i) {
            if (p) runs.push({ text: p, options: opts(cur) });
            if (i < parts.length - 1) runs.push({ text: '', options: opts(Object.assign({}, cur, { breakLine: true })) });
          });
        } else if (c.nodeType === 1) {
          if (c.tagName === 'BR') { runs.push({ text: '', options: opts(Object.assign({}, cur, { breakLine: true })) }); return; }
          var n = Object.assign({}, cur), s = c.style;
          if (s.fontSize && /px$/.test(s.fontSize)) n.fontSize = Math.round(parseFloat(s.fontSize) * 0.75 * 10) / 10;
          if (s.color) { var pc = parseColor(s.color); if (pc) n.color = pc.hex; }
          if (s.fontFamily) n.fontFace = s.fontFamily.split(',')[0].replace(/["']/g, '').trim();
          if (s.fontWeight && (s.fontWeight === 'bold' || parseInt(s.fontWeight, 10) >= 600)) n.bold = true;
          if (s.fontStyle === 'italic') n.italic = true;
          if (s.textDecorationLine === 'underline') n.underline = { style: 'sng' };
          walk(c, n);
        }
      });
    }
    var base = { fontFace: (st && st.fontFamily) || 'Inter', fontSize: Math.round(((st && st.fontSize) || 48) * 0.75 * 10) / 10, bold: !!(st && st.bold), italic: !!(st && st.italic) };
    var pc0 = parseColor(st && st.color); if (pc0) base.color = pc0.hex;
    walk(box, base);
    // a break-line flag on the very last run would add an empty paragraph
    if (runs.length && runs[runs.length - 1].options.breakLine && !runs[runs.length - 1].text) runs.pop();
    if (!runs.length) runs.push({ text: ' ', options: opts(base) });
    return runs;
  }
  function lsm(st) { var lh = (st && st.lineHeight) || 1.25; return Math.max(0.5, Math.min(3, Math.round(lh / 1.2 * 100) / 100)); }
  function alignOf(a) { return a === 'center' ? 'center' : a === 'right' ? 'right' : a === 'justify' ? 'justify' : 'left'; }

  // the picture as it looks on the slide (crop, turn, flip, shape applied), or the original when nothing was changed
  function pictureData(el, url) {
    var c = el.crop || {}, plain = !(c.l || c.t || c.r || c.b) && !(el.rot % 360) && !el.fx && !el.fy && !el.mask;
    if (plain) return Promise.resolve(url);
    return loadImg(url).then(function (im) {
      if (!im) return url;
      var rot = (((el.rot || 0) % 360) + 360) % 360, odd = rot % 180 !== 0;
      var k = Math.min(2, 1800 / Math.max(el.w, el.h)), cw = Math.max(2, Math.round(el.w * k)), ch = Math.max(2, Math.round(el.h * k));
      var wrapW = (odd ? el.h : el.w) * k, wrapH = (odd ? el.w : el.h) * k;
      var l = c.l || 0, t = c.t || 0, r = c.r || 0, b = c.b || 0;
      var sw = Math.max(0.02, 1 - l - r) * im.naturalWidth, sh = Math.max(0.02, 1 - t - b) * im.naturalHeight;
      var cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
      var g = cv.getContext('2d');
      if (el.mask) {
        g.beginPath();
        if (el.mask === 'oval') g.ellipse(cw / 2, ch / 2, cw / 2, ch / 2, 0, 0, Math.PI * 2);
        else { var rr = Math.min(cw, ch) * 0.12; g.moveTo(rr, 0); g.arcTo(cw, 0, cw, ch, rr); g.arcTo(cw, ch, 0, ch, rr); g.arcTo(0, ch, 0, 0, rr); g.arcTo(0, 0, cw, 0, rr); g.closePath(); }
        g.clip();
      }
      g.translate(cw / 2, ch / 2); g.rotate(rot * Math.PI / 180); g.scale(el.fx ? -1 : 1, el.fy ? -1 : 1);
      g.drawImage(im, l * im.naturalWidth, t * im.naturalHeight, sw, sh, -wrapW / 2, -wrapH / 2, wrapW, wrapH);
      return /^data:image\/(png|gif|webp)/.test(url) || el.mask ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.9);
    });
  }

  function exportPptx(slides, ctx) {
    return Promise.all([lib('js/vendor/pptxgen.bundle.js', 'PptxGenJS')]).then(function () {
      var pptx = new window.PptxGenJS();
      pptx.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5 in = 16:9
      pptx.title = 'SBVC slides';
      var chain = Promise.resolve();
      slides.forEach(function (sl) { chain = chain.then(function () { return addSlide(pptx, sl, ctx); }); });
      return chain.then(function () { return pptx.write({ outputType: 'blob' }); });
    });
  }

  function addSlide(pptx, sl, ctx) {
    var s = pptx.addSlide(), bg = sl.bg || {}, color = parseColor(bg.color) || { hex: '000000', a: 1 };
    var bgUrl = null;
    (ctx.bgImages || []).forEach(function (b) { if (bg.imageId && b.id === bg.imageId) bgUrl = b.url; });
    var pre = bgUrl ? Promise.resolve(bgUrl) : (bg.css ? rasterBg(bg.css, bg.color) : Promise.resolve(null));
    return pre.then(function (data) {
      if (data) s.background = { data: data }; else s.background = { color: color.hex };
      var chain = Promise.resolve();
      (sl.elements || []).forEach(function (el) { chain = chain.then(function () { return addElement(pptx, s, el, bg, ctx); }); });
      return chain;
    });
  }

  function addElement(pptx, s, el, bg, ctx) {
    var x = px2in(el.x), y = px2in(el.y), w = px2in(el.w), h = px2in(el.h), st = el.style || {};
    if (el.type === 'image') {
      var url = (ctx.images || {})[el.imageId];
      if (!url) return null;
      return pictureData(el, url).then(function (data) {
        var o = { data: data, x: x, y: y, w: w, h: h };
        if (el.opacity !== undefined && el.opacity < 1) o.transparency = Math.round((1 - el.opacity) * 100);
        s.addImage(o);
      });
    }
    if (el.type === 'shape') {
      var kind = el.shape || 'rect', type = SHAPE_MAP[kind] || 'rect';
      var tr = el.opacity !== undefined && el.opacity < 1 ? Math.round((1 - el.opacity) * 100) : 0;
      var fc = parseColor(el.fill), sc = parseColor(el.stroke);
      var o2 = { x: x, y: y, w: w, h: h };
      if (kind === 'line') { o2.y = px2in(el.y + el.h / 2); o2.h = 0; o2.line = { color: (sc || { hex: '3B82F6' }).hex, width: Math.max(0.5, (el.strokeW || 4) * 0.75), transparency: tr }; s.addShape(type, o2); return null; }
      o2.fill = fc ? { color: fc.hex, transparency: Math.max(tr, Math.round((1 - fc.a) * 100)) } : { type: 'none' };
      if (sc && el.strokeW) o2.line = { color: sc.hex, width: el.strokeW * 0.75 };
      if (kind === 'round') o2.rectRadius = 0.18 * Math.min(w, h);
      var hasText = (el.html && el.html.replace(/<[^>]*>/g, '').trim()) || (el.text && el.text.trim());
      if (!hasText) { s.addShape(type, o2); return null; }
      var tcol = st.color && st.color !== 'auto' ? st.color : (function () { var base = fc ? fc.hex : (parseColor(bg.color) || { hex: '000000' }).hex; return lumOf(base) > 0.6 ? '#111827' : '#FFFFFF'; })();
      var tst = Object.assign({}, st, { color: tcol });
      o2.shape = type; o2.align = 'center'; o2.valign = 'middle'; o2.margin = 4; o2.lineSpacingMultiple = lsm(st);
      s.addText(runsOf(el.html, el.text, tst), o2);
      return null;
    }
    // text and verse boxes
    var runs;
    if (el.type === 'verse') {
      var rs = el.refStyle || {};
      runs = runsOf('', el.ref || '', { fontFamily: rs.fontFamily || st.fontFamily, fontSize: rs.fontSize || 40, color: rs.color || '#D4A373', bold: true }, { breakLine: false });
      runs.push({ text: '', options: { breakLine: true, fontSize: 6 } });
      runs = runs.concat(runsOf(el.html, el.text, st));
    } else runs = runsOf(el.html, el.text, st);
    s.addText(runs, { x: x, y: y, w: w, h: h, margin: 0, align: alignOf(st.align), valign: 'top', lineSpacingMultiple: lsm(st), fit: 'none', wrap: true });
    return null;
  }

  /* ------------------------------------------------------------------ *
   * IMPORT
   * ------------------------------------------------------------------ */
  var R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  var EMU_PX = 9525; // 914400 EMU per inch / 96 px per inch

  function kids(n, name) { return n ? Array.prototype.filter.call(n.children, function (c) { return c.localName === name; }) : []; }
  function kid(n, name) { return kids(n, name)[0] || null; }
  function desc(n, name) { return n ? Array.prototype.slice.call(n.getElementsByTagNameNS('*', name)) : []; }
  function num(n, a, d) { var v = n && n.getAttribute(a); v = v === null || v === undefined || v === '' ? NaN : parseFloat(v); return isFinite(v) ? v : d; }
  function parseXml(str) { var d = new DOMParser().parseFromString(str, 'application/xml'); return d.getElementsByTagName('parsererror').length ? null : d; }
  function dirOf(p) { var i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i + 1); }
  function resolvePath(base, target) {
    if (/^[a-z]+:/i.test(target)) return null;
    var parts = target.charAt(0) === '/' ? target.slice(1).split('/') : (dirOf(base) + target).split('/'), out = [];
    parts.forEach(function (p) { if (p === '..') out.pop(); else if (p && p !== '.') out.push(p); });
    return out.join('/');
  }

  function importPptx(file) {
    var notes = {};
    return lib('js/vendor/jszip.min.js', 'JSZip').then(function () {
      if (file.size > 60000000) throw new Error('The file is larger than 60 MB.');
      return window.JSZip.loadAsync(file);
    }).then(function (zip) {
      var total = 0, count = 0;
      zip.forEach(function (p, f) { count++; total += (f._data && f._data.uncompressedSize) || 0; });
      if (count > 4000 || total > 400000000) throw new Error('This file is too large to open safely.');
      var cache = {};
      function readXml(path) {
        if (!path) return Promise.resolve(null);
        if (cache[path] !== undefined) return Promise.resolve(cache[path]);
        var f = zip.file(path);
        if (!f) { cache[path] = null; return Promise.resolve(null); }
        return f.async('string').then(function (t) { cache[path] = parseXml(t); return cache[path]; });
      }
      function readRels(part) {
        var path = dirOf(part) + '_rels/' + part.slice(part.lastIndexOf('/') + 1) + '.rels';
        return readXml(path).then(function (d) {
          var m = {};
          desc(d, 'Relationship').forEach(function (r) { m[r.getAttribute('Id')] = { type: r.getAttribute('Type') || '', target: resolvePath(part, r.getAttribute('Target') || ''), external: r.getAttribute('TargetMode') === 'External' }; });
          return m;
        });
      }
      var images = {}, imgCount = 0;
      function pictureFrom(path, wantAlpha) { // -> Promise<{id,w,h}> or null
        var f = path && zip.file(path), ext = path && path.split('.').pop().toLowerCase();
        if (!f || ['png', 'jpg', 'jpeg', 'gif', 'webp'].indexOf(ext) < 0) { notes.skippedPictures = (notes.skippedPictures || 0) + 1; return Promise.resolve(null); }
        if (imgCount >= 250) return Promise.resolve(null);
        var mime = ext === 'jpg' ? 'jpeg' : ext;
        return f.async('base64').then(function (b64) {
          return loadImg('data:image/' + mime + ';base64,' + b64).then(function (im) {
            if (!im) return null;
            var nw = im.naturalWidth, nh = im.naturalHeight, keepAlpha = mime !== 'jpeg';
            var sc = Math.min(1, (keepAlpha ? 1400 : 1600) / Math.max(nw, nh)), cv, data;
            for (var tries = 0; tries < 6; tries++) {
              cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(nw * sc)); cv.height = Math.max(1, Math.round(nh * sc));
              var g = cv.getContext('2d');
              if (!keepAlpha) { g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); }
              g.drawImage(im, 0, 0, cv.width, cv.height);
              data = keepAlpha ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.85);
              if (data.length < 1400000 || sc < 0.25) break;
              sc *= 0.75;
            }
            var id = 'imp' + (++imgCount) + uid().slice(-5);
            images[id] = data;
            return { id: id, w: cv.width, h: cv.height };
          });
        });
      }

      return readXml('ppt/presentation.xml').then(function (pres) {
        if (!pres) throw new Error('This is not a PowerPoint file.');
        var sz = desc(pres, 'sldSz')[0], cx = num(sz, 'cx', 12192000), cy = num(sz, 'cy', 6858000);
        var scale = Math.min(W / cx, H / cy), offX = (W - cx * scale) / 2, offY = (H - cy * scale) / 2;
        if (Math.abs(cx / cy - 16 / 9) > 0.05) notes.sizeChanged = true;
        var ids = desc(pres, 'sldId').map(function (n) { return n.getAttributeNS(R_NS, 'id'); });
        return readRels('ppt/presentation.xml').then(function (prels) {
          var paths = ids.map(function (i) { return prels[i] && prels[i].target; }).filter(Boolean);
          if (!paths.length) throw new Error('The file has no slides.');
          if (paths.length > 300) { notes.cut = paths.length; paths = paths.slice(0, 300); }
          var slides = [], chain = Promise.resolve();
          paths.forEach(function (sp) { chain = chain.then(function () { return readSlide(sp).then(function (s) { if (s) slides.push(s); }); }); });
          return chain.then(function () { return { slides: slides, images: images, notes: notes }; });
        });

        /* ---- one slide ---- */
        function readSlide(sp) {
          return Promise.all([readXml(sp), readRels(sp)]).then(function (r) {
            var sdoc = r[0], srels = r[1];
            if (!sdoc) return null;
            var layoutPath = null;
            Object.keys(srels).forEach(function (k) { if (/\/slideLayout$/.test(srels[k].type)) layoutPath = srels[k].target; });
            return Promise.all([readXml(layoutPath), layoutPath ? readRels(layoutPath) : {}]).then(function (lr) {
              var ldoc = lr[0], lrels = lr[1], masterPath = null;
              Object.keys(lrels).forEach(function (k) { if (/\/slideMaster$/.test(lrels[k].type)) masterPath = lrels[k].target; });
              return Promise.all([readXml(masterPath), masterPath ? readRels(masterPath) : {}]).then(function (mr) {
                var mdoc = mr[0], mrels = mr[1], themePath = null;
                Object.keys(mrels).forEach(function (k) { if (/\/theme$/.test(mrels[k].type)) themePath = mrels[k].target; });
                return readXml(themePath).then(function (tdoc) {
                  return buildSlide({ path: sp, doc: sdoc, rels: srels }, { doc: ldoc, rels: lrels, path: layoutPath }, { doc: mdoc, rels: mrels, path: masterPath }, tdoc);
                });
              });
            });
          });
        }

        function buildSlide(slide, layout, master, theme) {
          // ---- theme colors / fonts ----
          var scheme = {}, fonts = { major: '', minor: '' };
          desc(theme, 'clrScheme').forEach(function (cs) {
            Array.prototype.forEach.call(cs.children, function (c) {
              var v = kid(c, 'srgbClr') ? kid(c, 'srgbClr').getAttribute('val') : (kid(c, 'sysClr') ? kid(c, 'sysClr').getAttribute('lastClr') : '');
              if (v) scheme[c.localName] = v.toUpperCase();
            });
          });
          desc(theme, 'fontScheme').forEach(function (fs) {
            var mj = kid(kid(fs, 'majorFont'), 'latin'), mn = kid(kid(fs, 'minorFont'), 'latin');
            if (mj) fonts.major = mj.getAttribute('typeface') || ''; if (mn) fonts.minor = mn.getAttribute('typeface') || '';
          });
          var clrMap = {}; desc(master.doc, 'clrMap').forEach(function (m) { for (var i = 0; i < m.attributes.length; i++) clrMap[m.attributes[i].name] = m.attributes[i].value; });
          function schemeHex(name) {
            var n = clrMap[name] || name;
            return scheme[n] || ({ tx1: '000000', bg1: 'FFFFFF', dk1: '000000', lt1: 'FFFFFF' }[name]) || '000000';
          }
          function adjust(hex, node) {
            var r = parseInt(hex.substr(0, 2), 16) / 255, g = parseInt(hex.substr(2, 2), 16) / 255, b = parseInt(hex.substr(4, 2), 16) / 255;
            var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn, hh = 0, ss = 0;
            if (d) { ss = d / (1 - Math.abs(2 * l - 1)); hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hh *= 60; if (hh < 0) hh += 360; }
            var lm = kid(node, 'lumMod'), lo = kid(node, 'lumOff');
            if (!lm && !lo) return hex;
            l = Math.max(0, Math.min(1, l * (lm ? num(lm, 'val', 100000) / 100000 : 1) + (lo ? num(lo, 'val', 0) / 100000 : 0)));
            var c = (1 - Math.abs(2 * l - 1)) * ss, x = c * (1 - Math.abs((hh / 60) % 2 - 1)), m = l - c / 2, rgb;
            if (hh < 60) rgb = [c, x, 0]; else if (hh < 120) rgb = [x, c, 0]; else if (hh < 180) rgb = [0, c, x]; else if (hh < 240) rgb = [0, x, c]; else if (hh < 300) rgb = [x, 0, c]; else rgb = [c, 0, x];
            return rgb.map(function (v) { return ('0' + Math.round((v + m) * 255).toString(16)).slice(-2); }).join('').toUpperCase();
          }
          function colorNode(cn) { // <a:srgbClr> / <a:schemeClr> ... -> '#RRGGBB'
            if (!cn) return null;
            var hex = null;
            if (cn.localName === 'srgbClr') hex = (cn.getAttribute('val') || '').toUpperCase();
            else if (cn.localName === 'schemeClr') hex = adjust(schemeHex(cn.getAttribute('val')), cn);
            else if (cn.localName === 'sysClr') hex = (cn.getAttribute('lastClr') || '000000').toUpperCase();
            else if (cn.localName === 'prstClr') hex = ({ black: '000000', white: 'FFFFFF', red: 'FF0000', blue: '0000FF', green: '00FF00', yellow: 'FFFF00' }[cn.getAttribute('val')]) || '000000';
            if (!/^[0-9A-F]{6}$/.test(hex || '')) return null;
            if (cn.localName === 'srgbClr') hex = adjust(hex, cn);
            return '#' + hex;
          }
          function fillColor(holder) { // solidFill / gradFill / noFill inside holder -> '#RRGGBB' | '' (no fill) | null (not stated)
            if (!holder) return null;
            if (kid(holder, 'noFill')) return '';
            var sf = kid(holder, 'solidFill');
            if (sf) return colorNode(sf.children[0]) || null;
            var gf = kid(holder, 'gradFill');
            if (gf) { var gs = desc(gf, 'gs')[0]; return gs ? colorNode(gs.children[0]) : null; }
            return null;
          }
          var defTextColor = '#' + schemeHex('tx1');

          // ---- placeholder geometry from the layout / master ----
          function phXfrm(ph) {
            var idx = ph.getAttribute('idx'), type = ph.getAttribute('type') || 'body';
            function find(doc) {
              var best = null;
              desc(doc, 'sp').forEach(function (sp) {
                var p = desc(kid(kid(sp, 'nvSpPr'), 'nvPr'), 'ph')[0];
                if (!p) return;
                var i2 = p.getAttribute('idx'), t2 = p.getAttribute('type') || 'body';
                if ((idx && i2 === idx) || (!best && t2 === type) || (!best && type === 'ctrTitle' && t2 === 'title') || (!best && type === 'subTitle' && t2 === 'body')) {
                  var xf = kid(kid(sp, 'spPr'), 'xfrm');
                  if (xf) { best = xf; }
                }
              });
              return best;
            }
            return find(layout.doc) || find(master.doc);
          }

          // ---- background ----
          var bgColor = '#' + schemeHex('bg1'), bgPic = null;
          function readBg(doc, rels) {
            var bg = doc && desc(doc, 'bg')[0];
            if (!bg) return false;
            var props = kid(bg, 'bgPr');
            if (props) {
              var c = fillColor(props); if (c) { bgColor = c; return true; }
              var bf = kid(props, 'blipFill'), bl = bf && kid(bf, 'blip');
              if (bl) { var rid = bl.getAttributeNS(R_NS, 'embed'); if (rels[rid]) { bgPic = rels[rid].target; return true; } }
            }
            var ref = kid(bg, 'bgRef');
            if (ref) { var rc = colorNode(ref.children[0]); if (rc) { bgColor = rc; return true; } }
            return false;
          }
          readBg(slide.doc, slide.rels) || readBg(layout.doc, layout.rels) || readBg(master.doc, master.rels);

          var out = { id: uid(), bg: { color: bgColor, imageId: '' }, elements: [] };
          var pending = [], slots = [];
          function queue(promise) { var slot = { el: null }; slots.push(slot); pending.push(Promise.resolve(promise).then(function (e) { slot.el = e || null; })); }
          if (bgPic) queue(pictureFrom(bgPic).then(function (p) { return p ? { id: uid(), type: 'image', imageId: p.id, ar: p.w / p.h, opacity: 1, x: 0, y: 0, w: W, h: H } : null; }));

          // ---- shapes ----
          function walk(tree, xf) {
            Array.prototype.forEach.call(tree.children, function (n) {
              if (slots.length >= 220) return;
              if (n.localName === 'sp' || n.localName === 'cxnSp') queue(buildShape(n, xf));
              else if (n.localName === 'pic') queue(buildPicture(n, xf));
              else if (n.localName === 'graphicFrame') queue(buildFrame(n, xf));
              else if (n.localName === 'grpSp') {
                var gx = kid(kid(n, 'grpSpPr'), 'xfrm');
                var nx = xf;
                if (gx) {
                  var off = kid(gx, 'off'), ext = kid(gx, 'ext'), co = kid(gx, 'chOff'), ce = kid(gx, 'chExt');
                  var ex = num(ext, 'cx', 1), ey = num(ext, 'cy', 1), cex = num(ce, 'cx', ex) || 1, cey = num(ce, 'cy', ey) || 1;
                  var sx = ex / cex, sy = ey / cey, ox = num(off, 'x', 0) - num(co, 'x', 0) * sx, oy = num(off, 'y', 0) - num(co, 'y', 0) * sy;
                  nx = { sx: xf.sx * sx, sy: xf.sy * sy, ox: xf.sx * ox + xf.ox, oy: xf.sy * oy + xf.oy };
                }
                walk(n, nx);
              }
            });
          }
          function boxOf(xfrm, xf) { // -> {x,y,w,h} in stage px
            var off = kid(xfrm, 'off'), ext = kid(xfrm, 'ext');
            var x = xf.sx * num(off, 'x', 0) + xf.ox, y = xf.sy * num(off, 'y', 0) + xf.oy, w = xf.sx * num(ext, 'cx', 0), h = xf.sy * num(ext, 'cy', 0);
            return { x: Math.round(x * scale + offX), y: Math.round(y * scale + offY), w: Math.round(w * scale), h: Math.round(h * scale) };
          }
          function fontScaleOf(body) { var na = body && kid(body, 'normAutofit'); return na ? num(na, 'fontScale', 100000) / 100000 : 1; }
          function defSize(ph) {
            var t = ph && (ph.getAttribute('type') || 'body');
            return t === 'ctrTitle' ? 60 : t === 'title' ? 44 : t === 'subTitle' ? 24 : t === 'body' ? 28 : 18;
          }
          function fontName(tf) {
            if (!tf) return '';
            if (tf === '+mj-lt') tf = fonts.major; else if (tf === '+mn-lt') tf = fonts.minor;
            tf = String(tf).replace(/[^A-Za-z0-9 ]/g, '').trim().slice(0, 40);
            return tf;
          }
          var FONTS = ['Inter', 'Literata', 'Georgia', 'Times New Roman', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Oswald', 'Raleway', 'Merriweather', 'Playfair Display', 'Ubuntu', 'Noto Sans'];
          function textOf(txBody, ph) { // -> {text, html, style, lines, plain}
            var fs = fontScaleOf(kid(txBody, 'bodyPr')), paras = kids(txBody, 'p'), html = '', plain = [], first = null, lines = 0, algn = 'left', lnSpc = 1.2, ds = defSize(ph);
            var lst = kid(txBody, 'lstStyle'), l1 = lst && kid(lst, 'lvl1pPr'), ld = l1 && kid(l1, 'defRPr');
            if (ld && ld.getAttribute('sz')) ds = num(ld, 'sz', ds * 100) / 100;
            paras.forEach(function (p, pi) {
              var ppr = kid(p, 'pPr'), line = '';
              if (pi === 0 && ppr) { var al = ppr.getAttribute('algn'); algn = al === 'ctr' ? 'center' : al === 'r' ? 'right' : al === 'just' ? 'justify' : 'left'; var ls = kid(ppr, 'lnSpc'), sp = ls && kid(ls, 'spcPct'); if (sp) lnSpc = Math.max(0.8, Math.min(3, num(sp, 'val', 100000) / 100000 * 1.2)); }
              else if (pi === 0 && ph && /ctrTitle|subTitle/.test(ph.getAttribute('type') || '')) algn = 'center';
              var maxPx = 0;
              Array.prototype.forEach.call(p.children, function (r) {
                if (r.localName === 'br') { html += '<br>'; line += '\n'; return; }
                if (r.localName !== 'r' && r.localName !== 'fld') return;
                var rp = kid(r, 'rPr'), t = kid(r, 't'), txt = t ? t.textContent : '';
                if (!txt) return;
                var sz = (rp && rp.getAttribute('sz')) ? num(rp, 'sz', ds * 100) / 100 : ds;
                var px = Math.max(8, Math.min(300, Math.round(sz * fs * scale * 12700)));
                var col = (rp && fillColor(rp)) || defTextColor; if (!/^#[0-9A-Fa-f]{6}$/.test(col)) col = defTextColor;
                var face = fontName(rp && kid(rp, 'latin') && kid(rp, 'latin').getAttribute('typeface')) || fontName(fonts.minor);
                var bold = rp && rp.getAttribute('b') === '1', ital = rp && rp.getAttribute('i') === '1', und = rp && rp.getAttribute('u') && rp.getAttribute('u') !== 'none';
                var css = 'font-size:' + px + 'px;color:' + col + ';' + (face ? 'font-family:' + face + ';' : '') + (bold ? 'font-weight:bold;' : '') + (ital ? 'font-style:italic;' : '') + (und ? 'text-decoration-line:underline;' : '');
                html += '<span style="' + css + '">' + txt.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</span>';
                line += txt; maxPx = Math.max(maxPx, px);
                if (!first) first = { px: px, col: col, face: face, bold: !!bold, ital: !!ital };
              });
              if (pi < paras.length - 1) html += '<br>';
              plain.push(line); lines += 1 + (maxPx ? 0 : 0);
            });
            var txt = plain.join('\n');
            first = first || { px: Math.round(ds * fs * scale * 12700), col: defTextColor, face: '', bold: false, ital: false };
            var fam = FONTS.indexOf(first.face) >= 0 ? first.face : (first.face || 'Inter');
            return { text: txt.slice(0, 20000), html: html.length > 60000 ? '' : html, lines: lines, firstPx: first.px,
              style: { fontFamily: fam, fontSize: first.px, color: first.col, bold: first.bold, italic: first.ital, align: algn, lineHeight: Math.round(lnSpc * 100) / 100 }, plain: txt.trim() };
          }
          var SHAPE_FROM = { rect: 'rect', roundRect: 'round', ellipse: 'ellipse', triangle: 'triangle', diamond: 'diamond', star5: 'star', rightArrow: 'arrow', chevron: 'chevron', plus: 'cross', mathPlus: 'cross', heart: 'heart', line: 'line', straightConnector1: 'line' };

          function buildShape(sp, xf) {
            var isCxn = sp.localName === 'cxnSp';
            var spPr = kid(sp, 'spPr'), nv = kid(sp, isCxn ? 'nvCxnSpPr' : 'nvSpPr'), ph = nv && desc(kid(nv, 'nvPr'), 'ph')[0];
            var xfrm = spPr && kid(spPr, 'xfrm');
            if (!xfrm && ph) xfrm = phXfrm(ph);
            if (!xfrm) return null;
            var b = boxOf(xfrm, xf);
            var prst = spPr && kid(spPr, 'prstGeom') ? kid(spPr, 'prstGeom').getAttribute('prst') : (spPr && kid(spPr, 'custGeom') ? 'rect' : 'rect');
            var kind = SHAPE_FROM[prst] || 'rect';
            var fill = fillColor(spPr), ln = spPr && kid(spPr, 'ln'), line = ln ? fillColor(ln) : null, lw = ln ? Math.round(num(ln, 'w', 12700) * scale) : 0;
            var style = kid(sp, 'style');
            if (fill === null && style) { var fr = kid(style, 'fillRef'); if (fr && fr.getAttribute('idx') !== '0') fill = colorNode(fr.children[0]); }
            if (line === null && style && ln !== null) { var lr = kid(style, 'lnRef'); if (lr && lr.getAttribute('idx') !== '0') line = colorNode(lr.children[0]); }
            if (fill === null) fill = '';
            if (line === null) line = ''; if (line && !lw) lw = 2;
            var txBody = kid(sp, 'txBody'), tx = txBody ? textOf(txBody, ph) : null, hasText = tx && tx.plain;
            var isBox = nv && kid(nv, 'cNvSpPr') && kid(nv, 'cNvSpPr').getAttribute('txBox') === '1';
            if (kind === 'line' || isCxn) {
              var ly = b.y + Math.round(b.h / 2);
              return { id: uid(), type: 'shape', shape: 'line', x: b.x, y: ly - 12, w: Math.max(b.w, 4), h: 24, fill: '', stroke: line || '#000000', strokeW: Math.max(2, lw), opacity: 1 };
            }
            if ((isBox || (!fill && !line)) && hasText) { // a plain text box
              var body = kid(txBody, 'bodyPr'), anchor = body ? body.getAttribute('anchor') : 't';
              var li = body ? num(body, 'lIns', 91440) : 91440, ri = body ? num(body, 'rIns', 91440) : 91440, ti = body ? num(body, 'tIns', 45720) : 45720;
              var padL = Math.round(li * scale), padR = Math.round(ri * scale), padT = Math.round(ti * scale);
              var el = { id: uid(), type: 'text', x: b.x + padL, y: b.y + padT, w: Math.max(40, b.w - padL - padR), h: Math.max(30, b.h - padT * 2), text: tx.text, html: tx.html, style: tx.style };
              if (anchor === 'ctr' || anchor === 'b') { // our boxes are top-aligned: move the box to where the text sits
                var charsPerLine = Math.max(8, el.w / (tx.firstPx * 0.5)), est = 0;
                tx.text.split('\n').forEach(function (l) { est += Math.max(1, Math.ceil(l.length / charsPerLine)); });
                var th = Math.min(el.h, est * tx.firstPx * tx.style.lineHeight);
                el.y = Math.round(anchor === 'ctr' ? el.y + (el.h - th) / 2 : el.y + el.h - th); el.h = Math.max(30, Math.round(th + 8));
              }
              return el;
            }
            if (fill || line || prst !== 'rect') {
              var it = { id: uid(), type: 'shape', shape: kind, x: b.x, y: b.y, w: Math.max(4, b.w), h: Math.max(4, b.h), fill: fill, stroke: line, strokeW: line ? lw : 0, opacity: 1 };
              if (hasText) { it.text = tx.text; it.html = tx.html; it.style = Object.assign({}, tx.style, { color: 'auto', align: 'center' }); }
              else it.style = { fontFamily: 'Inter', fontSize: 40, color: 'auto', bold: false, italic: false, align: 'center', lineHeight: 1.25 };
              return it;
            }
            return null;
          }
          function buildPicture(pic, xf) {
            var spPr = kid(pic, 'spPr'), xfrm = spPr && kid(spPr, 'xfrm'), bf = kid(pic, 'blipFill'), bl = bf && kid(bf, 'blip');
            if (!xfrm || !bl) return null;
            var rid = bl.getAttributeNS(R_NS, 'embed'), rel = slide.rels[rid];
            if (!rel) return null;
            var b = boxOf(xfrm, xf), rot = ((Math.round(num(xfrm, 'rot', 0) / 60000 / 90) * 90) % 360 + 360) % 360, sr = kid(bf, 'srcRect');
            return pictureFrom(rel.target).then(function (p) {
              if (!p) return null;
              var el = { id: uid(), type: 'image', imageId: p.id, ar: p.w / p.h, opacity: 1, x: b.x, y: b.y, w: Math.max(4, b.w), h: Math.max(4, b.h) };
              if (rot % 180) { var cxm = b.x + b.w / 2, cym = b.y + b.h / 2; el.w = Math.max(4, b.h); el.h = Math.max(4, b.w); el.x = Math.round(cxm - el.w / 2); el.y = Math.round(cym - el.h / 2); }
              if (rot) el.rot = rot;
              if (xfrm.getAttribute('flipH') === '1') el.fx = true;
              if (xfrm.getAttribute('flipV') === '1') el.fy = true;
              if (sr) { var cr = { l: num(sr, 'l', 0) / 100000, t: num(sr, 't', 0) / 100000, r: num(sr, 'r', 0) / 100000, b: num(sr, 'b', 0) / 100000 }; if (cr.l || cr.t || cr.r || cr.b) el.crop = cr; }
              var geom = spPr && kid(spPr, 'prstGeom'); if (geom && geom.getAttribute('prst') === 'ellipse') el.mask = 'oval'; else if (geom && geom.getAttribute('prst') === 'roundRect') el.mask = 'round';
              return el;
            });
          }
          function buildFrame(gf, xf) { // tables become plain text (one line per row)
            var xfrm = kid(gf, 'xfrm'), tbl = desc(gf, 'tbl')[0];
            if (!xfrm || !tbl) { notes.skippedObjects = (notes.skippedObjects || 0) + 1; return null; }
            var b = boxOf(xfrm, xf), rows = kids(tbl, 'tr').map(function (tr) { return kids(tr, 'tc').map(function (tc) { return desc(tc, 't').map(function (t) { return t.textContent; }).join(' '); }).join('   |   '); });
            var txt = rows.join('\n').slice(0, 20000);
            if (!txt.trim()) return null;
            notes.tables = (notes.tables || 0) + 1;
            return ({ id: uid(), type: 'text', x: b.x, y: b.y, w: Math.max(80, b.w), h: Math.max(40, b.h), text: txt, style: { fontFamily: 'Inter', fontSize: 28, color: defTextColor, bold: false, italic: false, align: 'left', lineHeight: 1.25 } });
          }

          var tree = desc(slide.doc, 'spTree')[0];
          if (tree) walk(tree, { sx: 1, sy: 1, ox: 0, oy: 0 });
          return Promise.all(pending).then(function () {
            out.elements = slots.map(function (s) { return s.el; }).filter(Boolean).slice(0, 200); // same drawing order as in the file
            return out;
          });
        }
      });
    });
  }

  S.pptxExport = exportPptx;
  S.pptxImport = importPptx;
})();
