/* Live mode (button at the top right of every page).
 *
 *   Local  = nothing leaves this computer (the default).
 *   Live   = this computer can SHARE its session behind a key, or JOIN another computer's session with that key.
 *
 * Safety (the HOST is always in charge):
 *   - every helper must be ALLOWED by the host (name shown), and can be given a role:
 *       View only / Control only (change what is on the screen) / Full edit
 *   - the host can remove or block a helper, lock the session, and see an activity log
 *   - everything that arrives is checked: only known data, size limits, no outside web links, no scripts,
 *     rate limits, safe chat files; names in chat are stamped by the host (cannot be faked)
 *   - a restore point of the host's data is saved when the first helper joins ("Restore" puts it back)
 *   - the PeerJS library is kept in js/vendor (not loaded from the internet)
 *
 * How: a direct browser-to-browser (WebRTC, encrypted) link made with PeerJS. The free PeerJS broker only introduces the
 * two computers (it never sees slides or chat). The key is the name of the host's connection point.
 * Both computers need internet. Videos in the Hymnals media library are NOT sent.
 * A helper's own data is backed up when joining and put back when leaving.
 */
(function () {
  'use strict';
  var S = window.SBVC;
  if (!S) return;
  var K = S.KEYS;

  var CFG = 'sbvc-live-cfg';         // {role:'host'|'guest', key}  (absent = Local)
  var STATUS = 'sbvc-live-status';   // {state, online:[cid], msg} written by the tab that holds the connection
  var BACKUP = 'sbvc-live-backup';   // the helper's own data while joined
  var PEOPLE = 'sbvc-live-people';   // host: {list:[{cid,name,role,tok}], blocked:[cid], denied:{cid:until}, locked}
  var PENDING = 'sbvc-live-pending'; // host: [{cid,name,ts}] waiting to be allowed
  var ALOG = 'sbvc-live-log';        // host: activity log [{ts,who,what,n}]
  var RESTORE = 'sbvc-live-restore'; // host: {ts, data} saved when the first helper joins
  var CMD = 'sbvc-live-cmd';         // a decision made in another tab of the host's browser
  var ROLEK = 'sbvc-live-role';      // helper: my role
  var TOK = 'sbvc-live-tok';         // helper: the pass the host gave me (so moving between pages needs no new approval)
  var FLASH = 'sbvc-live-flash';     // a message to show after the page reloads
  var CHATLOG = 'sbvc-live-chat', CHATSEEN = 'sbvc-live-chatseen', CHATNAME = 'sbvc-live-name', OUTBOX = 'sbvc-live-outbox';
  var PEER_JS = 'js/vendor/peerjs.min.js'; // kept in this site (see js/vendor/README.txt)
  var PREFIX = 'sbvc-live-';
  var MAX_HELPERS = 5;

  var ROLES = { view: 'View only', control: 'Control only', edit: 'Full edit' };
  // what a "Control only" helper may change: what is on the screen
  var CONTROL = {};
  [K.passage, K.contentType, K.preachLive, K.pptLive, K.playback, K.activeMedia].forEach(function (k) { CONTROL[k] = true; });

  /* ------------------------------------------------------------------ *
   * What may be shared, and checking everything that arrives
   * ------------------------------------------------------------------ */
  var SHARED = {};
  Object.keys(K).forEach(function (n) {
    var v = K[n];
    if (typeof v === 'string' && v.indexOf('sbvc-') === 0 && v !== K.hymnUi && v !== K.ctrlUi && v !== K.fullscreen) SHARED[v] = true;
  });
  function syncable(k) { return SHARED[k] === true; }
  function allKeys() {
    var out = [];
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (syncable(k)) out.push(k); } } catch (e) { /* none */ }
    return out;
  }
  function collect() { var d = {}; allKeys().forEach(function (k) { d[k] = S.getRaw(k); }); return d; }

  var IMG_OK = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+\/=]+$/;
  // scripts, outside web addresses in styles, imports: never accepted
  var DANGER = /javascript:|<\s*script|<\s*iframe|<\s*object|<\s*embed|expression\(|@import|url\(\s*(?!['"]?data:image\/(png|jpe?g|webp|gif))/i;
  function safeCss(v) { return typeof v === 'string' && v.length <= 20000 && !DANGER.test(v); }
  function validDeck(o) {
    if (!o || typeof o !== 'object' || !Array.isArray(o.slides) || o.slides.length > 300) return false;
    return o.slides.every(function (s) {
      if (!s || typeof s !== 'object' || !Array.isArray(s.elements) || s.elements.length > 200) return false;
      if (s.bg && typeof s.bg === 'object' && s.bg.css && !safeCss(s.bg.css)) return false;
      return true;
    });
  }
  function validate(k, v) {
    if (!syncable(k)) return false;
    if (v === null) return true;
    if (typeof v !== 'string') return false;
    var imgKey = k === K.bgImages || k === K.preachImages;
    if (v.length > (imgKey ? 8000000 : 2500000)) return false;
    if (k === K.contentType) return /^(bible|hymnal|preaching|powerpoint)$/.test(v);
    if (k === K.preachLive || k === K.pptLive) return /^\d{0,4}$/.test(v);
    if (k === K.theme) return v === 'dark' || v === 'light';
    if (k === K.bg) return /^#[0-9a-f]{3,8}$/i.test(v) || /^(rgb|hsl)a?\([\d\s.,%]+\)$/i.test(v);
    if (k === K.bgImage) return /^[\w-]{0,40}$/.test(v);
    if (k === K.bgCss) return safeCss(v);
    var o = null;
    try { o = JSON.parse(v); } catch (e) { return !DANGER.test(v) && v.length < 200000; } // a plain text value
    if (k === K.bgImages) return Array.isArray(o) && o.length < 200 && o.every(function (x) { return x && typeof x.url === 'string' && IMG_OK.test(x.url) && String(x.id || '').length < 60; });
    if (k === K.preachImages) return o && typeof o === 'object' && Object.keys(o).length < 500 && Object.keys(o).every(function (i) { return typeof o[i] === 'string' && IMG_OK.test(o[i]); });
    if (DANGER.test(v)) return false;
    if (k === K.preachDeck || k === K.pptDeck) return validDeck(o);
    return true;
  }
  S.liveValidate = validate; // read-only helper (also used to test)

  function cleanKey(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function newKey() {
    var abc = 'abcdefghjkmnpqrstuvwxyz23456789', a = new Uint8Array(12), o = '';
    crypto.getRandomValues(a);
    for (var i = 0; i < a.length; i++) o += abc[a[i] % abc.length];
    return o;
  }
  function pretty(k) { return k.toUpperCase().replace(/(.{4})(?=.)/g, '$1-'); }
  function randId(n) { var a = new Uint8Array(n), o = ''; crypto.getRandomValues(a); for (var i = 0; i < n; i++) o += 'abcdefghijklmnopqrstuvwxyz0123456789'[a[i] % 36]; return o; }
  function cleanName(s, d) { s = String(s || '').replace(/[^\p{L}\p{N} ._'-]/gu, '').trim().slice(0, 20); return s || d; }

  function getCfg() { return S.getJSON(CFG, null); }
  function getStatus() { var s = S.getJSON(STATUS, null); return s && typeof s === 'object' ? s : { state: 'local', online: [], msg: '' }; }
  function setStatus(state, msg) {
    S.setRaw(STATUS, JSON.stringify({ state: state, online: onlineList(), msg: msg || '' }));
    render();
  }
  function getPeople() {
    var p = S.getJSON(PEOPLE, null);
    if (!p || typeof p !== 'object') p = {};
    if (!Array.isArray(p.list)) p.list = [];
    if (!Array.isArray(p.blocked)) p.blocked = [];
    if (!p.denied || typeof p.denied !== 'object') p.denied = {};
    return p;
  }
  function setPeople(p) { S.setRaw(PEOPLE, JSON.stringify(p)); }
  function getPending() { var l = S.getJSON(PENDING, []); return Array.isArray(l) ? l : []; }
  function setPending(l) { S.setRaw(PENDING, JSON.stringify(l)); }

  // helper's persistent id (stays the same between pages)
  var myId = S.getRaw('sbvc-live-me');
  if (!myId || myId.length < 12) { myId = randId(16); S.setRaw('sbvc-live-me', myId); }

  /* ------------------------------------------------------------------ *
   * Activity log (host)
   * ------------------------------------------------------------------ */
  var LABELS = {};
  LABELS[K.preachDeck] = 'the Preaching slides'; LABELS[K.pptDeck] = 'the PowerPoint slides';
  LABELS[K.passage] = 'the verse / hymn on the screen'; LABELS[K.preachLive] = 'the Preaching slide on the screen'; LABELS[K.pptLive] = 'the PowerPoint slide on the screen';
  LABELS[K.contentType] = 'what the screen shows'; LABELS[K.custom] = 'the Bible text style'; LABELS[K.hymnCustom] = 'the Hymnals text style';
  LABELS[K.bg] = 'the background'; LABELS[K.bgCss] = 'the background'; LABELS[K.bgImage] = 'the background'; LABELS[K.bgImages] = 'the background pictures';
  LABELS[K.preachImages] = 'slide pictures'; LABELS[K.bibleDesign] = 'the Bible design'; LABELS[K.hymnDesign] = 'the Hymnals design'; LABELS[K.theme] = 'the theme';
  function act(who, what) {
    var l = S.getJSON(ALOG, []); if (!Array.isArray(l)) l = [];
    var now = Date.now(), e = l[l.length - 1];
    if (e && e.who === who && e.what === what && now - e.ts < 60000) { e.ts = now; e.n = (e.n || 1) + 1; }
    else l.push({ ts: now, who: who, what: what, n: 1 });
    if (l.length > 200) l = l.slice(-200);
    S.setRaw(ALOG, JSON.stringify(l));
    render();
  }

  /* ------------------------------------------------------------------ *
   * Connection (only ONE open tab holds it; the others just show its status)
   * ------------------------------------------------------------------ */
  var peer = null, hostConn = null, ready = false, running = false, runToken = 0;
  var peers = {};        // host: cid -> {cid, name, role, conn, last, lastAct, rate:{}, viol}
  var pendConns = {};    // host: cid -> conn waiting for approval
  var myRole = S.getRaw(ROLEK) || 'edit';
  var releaseLock = null, retryTimer = null, last = {}, timers = [];

  function onlineList() { return Object.keys(peers).filter(function (c) { return peers[c].conn && peers[c].conn.open; }); }
  function broadcast(msg, except) {
    Object.keys(peers).forEach(function (c) { var p = peers[c]; if (p !== except && p.conn && p.conn.open) p.conn.send(msg); });
  }
  function send(msg) {
    if (!running) return;
    if (hostConn) { if (ready && hostConn.open) hostConn.send(msg); return; }
    broadcast(msg);
  }
  S.setLiveHook(function (k, v) {
    if (!running || !syncable(k) || last[k] === v) return;
    if (hostConn) { // a helper only sends what the role allows; anything else is put back to what the host has
      if (myRole === 'view' || (myRole === 'control' && !CONTROL[k])) {
        if (last[k] !== undefined && last[k] !== v) {
          var keep = last[k];
          setTimeout(function () { S.applyRemote(k, keep); }, 0);
          flash(myRole === 'view' ? 'View only: you cannot change this.' : 'Control only: you can change what is on the screen, not the slides or settings.');
        }
        return;
      }
    }
    last[k] = v;
    send({ t: 'set', k: k, v: v });
  });
  window.addEventListener('storage', function (e) { // a change made in another tab of this browser
    if (e.key === CFG) { cfgChanged(); return; }
    if (e.key === STATUS || e.key === PEOPLE || e.key === PENDING || e.key === ALOG || e.key === RESTORE || e.key === ROLEK) { if (e.key === ROLEK) myRole = e.newValue || 'edit'; render(); return; }
    if (e.key === OUTBOX) { if (running && e.newValue) { try { relayOwnChat(JSON.parse(e.newValue)); } catch (x) { /* bad */ } } return; }
    if (e.key === CMD) { if (running && !hostConn && e.newValue) { try { exec(JSON.parse(e.newValue)); } catch (x) { /* bad */ } } return; }
    if (e.key === CHATLOG || e.key === CHATSEEN || e.key === CHATNAME) { renderChat(); return; }
    if (running && syncable(e.key) && last[e.key] !== e.newValue) {
      if (hostConn && (myRole === 'view' || (myRole === 'control' && !CONTROL[e.key]))) return;
      last[e.key] = e.newValue; send({ t: 'set', k: e.key, v: e.newValue });
    }
  });

  /* ---- host: what a helper sends ---- */
  function allow(p, kind, limit) {
    var now = Date.now(), b = p.rate[kind] || (p.rate[kind] = { t: now, n: 0 });
    if (now - b.t > 10000) { b.t = now; b.n = 0; }
    b.n++;
    if (b.n > limit) {
      p.viol = (p.viol || 0) + 1;
      if (p.viol >= 20) { act(p.name, 'was removed: sending far too many messages'); exec({ a: 'kick', cid: p.cid }); }
      return false;
    }
    return true;
  }
  function revert(p, k) { // the helper changed something it may not: put the host's value back on its screen
    if (p.conn && p.conn.open) {
      p.conn.send({ t: 'set', k: k, v: S.getRaw(k) });
      p.conn.send({ t: 'note', text: p.role === 'view' ? 'View only: the host did not accept that change.' : 'Control only: the host did not accept that change.' });
    }
  }
  function fromHelper(p, m) {
    if (!m || typeof m !== 'object') return;
    p.last = Date.now();
    if (m.t === 'ping') return;
    if (m.t === 'set') {
      if (typeof m.k !== 'string' || !syncable(m.k)) return;
      var cur = S.getRaw(m.k);
      if ((m.v === undefined ? null : m.v) === cur) return; // nothing new
      if (!allow(p, 'set', 150)) return;
      if (p.role === 'view' || (p.role === 'control' && !CONTROL[m.k])) { act(p.name, 'tried to change ' + (LABELS[m.k] || 'settings') + ' (' + ROLES[p.role] + ', not allowed)'); revert(p, m.k); return; }
      var v = m.v === undefined ? null : m.v;
      if (!validate(m.k, v)) { act(p.name, 'sent data that was refused (' + (LABELS[m.k] || 'settings') + ')'); revert(p, m.k); return; }
      p.lastAct = Date.now();
      last[m.k] = v;
      S.applyRemote(m.k, v);
      act(p.name, 'changed ' + (LABELS[m.k] || 'settings'));
      broadcast({ t: 'set', k: m.k, v: v }, p);
    } else if (m.t === 'chat') {
      if (!allow(p, 'chat', 15)) return;
      var c = cleanChat(m, true);
      if (!c) { act(p.name, 'sent a chat message that was refused'); return; }
      c.name = p.name; c.from = p.cid; // the host stamps the name: it cannot be faked
      p.lastAct = Date.now();
      if (c.img) act(p.name, 'sent a picture'); else if (c.file) act(p.name, 'sent a file: ' + c.file.name);
      addChat(c);
      broadcast(c, p);
    }
  }

  /* ---- host: joining ---- */
  function onHello(c, m) {
    var cid = String(m.cid || '');
    if (!/^[a-z0-9]{12,40}$/.test(cid)) { c.close(); return; }
    var name = cleanName(m.name, 'Helper'), tok = typeof m.tok === 'string' ? m.tok : '';
    var ppl = getPeople(), now = Date.now();
    if (ppl.blocked.indexOf(cid) >= 0) { c.send({ t: 'denied', msg: 'The host has blocked you.' }); setTimeout(function () { c.close(); }, 300); return; }
    var rec = ppl.list.filter(function (x) { return x.cid === cid; })[0];
    if (rec && tok && tok === rec.tok) { admit(c, rec); return; } // already allowed: moving between pages
    if (ppl.denied[cid] && ppl.denied[cid] > now) { c.send({ t: 'denied', msg: 'The host did not allow you to join.' }); setTimeout(function () { c.close(); }, 300); return; }
    if (ppl.locked) { act(name, 'tried to join (session is locked)'); c.send({ t: 'denied', msg: 'The host has locked this session.' }); setTimeout(function () { c.close(); }, 300); return; }
    if (onlineList().length >= MAX_HELPERS) { c.send({ t: 'denied', msg: 'The session is full.' }); setTimeout(function () { c.close(); }, 300); return; }
    if (Object.keys(pendConns).length >= 5) { c.close(); return; }
    if (pendConns[cid]) { try { pendConns[cid].close(); } catch (e) { /* gone */ } }
    pendConns[cid] = c; c._pend = cid;
    var pend = getPending().filter(function (x) { return x.cid !== cid; });
    pend.push({ cid: cid, name: name, ts: now });
    setPending(pend);
    c.send({ t: 'wait' });
    act(name, 'asks to join');
    render();
  }
  function admit(c, rec) {
    if (peers[rec.cid] && peers[rec.cid].conn !== c) { try { peers[rec.cid].conn.close(); } catch (e) { /* gone */ } }
    if (!onlineList().length) saveRestorePoint(); // before the first helper changes anything
    var p = { cid: rec.cid, name: rec.name, role: rec.role, conn: c, last: Date.now(), lastAct: Date.now(), rate: {}, viol: 0 };
    peers[rec.cid] = p; c._rec = p; c._pend = null;
    c.send({ t: 'welcome', role: p.role, tok: rec.tok, name: p.name });
    c.send({ t: 'snap', d: collect() });
    act(p.name, 'joined (' + ROLES[p.role] + ')');
    setStatus('host', onlineList().length + ' helper(s) connected.');
  }
  function dropPeer(cid, conn) {
    if (peers[cid] && (!conn || peers[cid].conn === conn)) {
      var nm = peers[cid].name;
      delete peers[cid];
      if (running && !hostConn) { act(nm, 'left'); setStatus('host', onlineList().length ? onlineList().length + ' helper(s) connected.' : 'Sharing. Waiting for a helper to join.'); }
    }
  }
  function saveRestorePoint() {
    try { S.setRaw(RESTORE, JSON.stringify({ ts: Date.now(), data: collect() })); } catch (e) { /* too big */ }
  }

  /* ---- host: decisions (made in any tab; run by the tab that holds the connection) ---- */
  function exec(c) {
    if (!c || typeof c !== 'object' || hostConn) return;
    var ppl = getPeople(), pend = getPending(), cid = String(c.cid || '');
    var role = ROLES[c.role] ? c.role : 'control';
    function pendOne() { return pend.filter(function (x) { return x.cid === cid; })[0]; }
    function idle() { setStatus('host', onlineList().length ? onlineList().length + ' helper(s) connected.' : 'Sharing. Waiting for a helper to join.'); }
    if (c.a === 'allow') {
      var pr = pendOne(), conn = pendConns[cid];
      if (!pr || !conn || !conn.open) { setPending(pend.filter(function (x) { return x.cid !== cid; })); render(); return; }
      var rec = { cid: cid, name: pr.name, role: role, tok: randId(24) };
      ppl.list = ppl.list.filter(function (x) { return x.cid !== cid; }); ppl.list.push(rec); setPeople(ppl);
      setPending(pend.filter(function (x) { return x.cid !== cid; })); delete pendConns[cid];
      admit(conn, rec);
    } else if (c.a === 'deny' || c.a === 'block') {
      var pr2 = pendOne(), cn = pendConns[cid];
      if (c.a === 'block') { if (ppl.blocked.indexOf(cid) < 0) ppl.blocked.push(cid); ppl.list = ppl.list.filter(function (x) { return x.cid !== cid; }); }
      else ppl.denied[cid] = Date.now() + 10 * 60000;
      setPeople(ppl);
      setPending(pend.filter(function (x) { return x.cid !== cid; }));
      var peerRec = peers[cid];
      if (cn) { try { cn.send({ t: 'denied', msg: c.a === 'block' ? 'The host has blocked you.' : 'The host did not allow you to join.' }); } catch (e) { /* gone */ } setTimeout(function () { try { cn.close(); } catch (e) { /* gone */ } }, 300); delete pendConns[cid]; }
      if (peerRec) { try { peerRec.conn.send({ t: 'kick', msg: 'The host has blocked you.' }); } catch (e) { /* gone */ } setTimeout(function () { try { peerRec.conn.close(); } catch (e) { /* gone */ } }, 300); delete peers[cid]; }
      act((pr2 && pr2.name) || (peerRec && peerRec.name) || 'A helper', c.a === 'block' ? 'was blocked' : 'was not allowed');
      idle();
    } else if (c.a === 'kick') {
      var pk = peers[cid];
      ppl.list = ppl.list.filter(function (x) { return x.cid !== cid; }); setPeople(ppl);
      if (pk) { try { pk.conn.send({ t: 'kick', msg: 'The host removed you from the session.' }); } catch (e) { /* gone */ } setTimeout(function () { try { pk.conn.close(); } catch (e) { /* gone */ } }, 300); delete peers[cid]; act(pk.name, 'was removed'); }
      idle();
    } else if (c.a === 'role') {
      var li = ppl.list.filter(function (x) { return x.cid === cid; })[0];
      if (li) { li.role = role; setPeople(ppl); }
      if (peers[cid]) { peers[cid].role = role; try { peers[cid].conn.send({ t: 'role', role: role }); } catch (e) { /* gone */ } act(peers[cid].name, 'is now: ' + ROLES[role]); }
      render();
    } else if (c.a === 'lock') {
      ppl.locked = !!c.on; setPeople(ppl); act('You', ppl.locked ? 'locked the session (nobody new can join)' : 'unlocked the session'); render();
    } else if (c.a === 'unblock') {
      ppl.blocked = []; ppl.denied = {}; setPeople(ppl); act('You', 'cleared the blocked list'); render();
    } else if (c.a === 'restore') {
      restoreFromPoint();
    } else if (c.a === 'clearlog') {
      S.setRaw(ALOG, '[]'); render();
    }
  }
  function cmd(obj) { // from the panel: run here if this tab holds the connection, else hand it to the tab that does
    obj.n = Date.now() + Math.random();
    if (running && !hostConn) exec(obj); else S.setRaw(CMD, JSON.stringify(obj));
  }
  function restoreFromPoint() {
    var r = S.getJSON(RESTORE, null);
    if (!r || !r.data) return;
    Object.keys(r.data).forEach(function (k) { if (syncable(k)) S.setRaw(k, r.data[k]); });
    allKeys().forEach(function (k) { if (r.data[k] === undefined) S.setRaw(k, null); });
    act('You', 'put back the slides and settings saved before the session');
  }

  /* ---- helper: what the host sends ---- */
  function fromHost(m) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'wait') { setStatus('connecting', 'Waiting for the host to allow you…'); }
    else if (m.t === 'denied' || m.t === 'kick') { left(String(m.msg || 'The host ended your access.').slice(0, 120)); }
    else if (m.t === 'welcome') {
      myRole = ROLES[m.role] ? m.role : 'view'; S.setRaw(ROLEK, myRole);
      if (typeof m.tok === 'string') S.setRaw(TOK, m.tok);
      setStatus('connecting', 'Allowed. Loading…');
    } else if (m.t === 'role') {
      myRole = ROLES[m.role] ? m.role : 'view'; S.setRaw(ROLEK, myRole);
      flash('The host changed your role to: ' + ROLES[myRole]); render();
    } else if (m.t === 'note') { flash(String(m.text || '').slice(0, 120)); }
    else if (m.t === 'set') {
      if (validate(m.k, m.v === undefined ? null : m.v)) { last[m.k] = m.v; S.applyRemote(m.k, m.v === undefined ? null : m.v); }
    } else if (m.t === 'chat') {
      var c = cleanChat(m, false);
      if (c) { c.name = cleanName(m.name, 'Host'); c.from = String(m.from || 'x').slice(0, 40); addChat(c); }
    } else if (m.t === 'snap' && m.d && typeof m.d === 'object') applySnapshot(m.d);
  }
  function left(text) { // the host said no / removed me: go back to Local
    flash(text, true);
    var cfg = getCfg();
    release();
    try { [CFG, STATUS, CHATLOG, CHATSEEN, OUTBOX, ROLEK, TOK].forEach(function (k) { localStorage.removeItem(k); }); } catch (e) { /* none */ }
    if (cfg && cfg.role === 'guest' && restoreOwn()) { location.reload(); return; }
    render();
  }
  function applySnapshot(d) {
    var mine = S.getRaw(K.contentType), changed = 0;
    Object.keys(d).forEach(function (k) {
      if (!syncable(k) || k === K.contentType) return;
      if (!validate(k, d[k])) return;
      last[k] = d[k];
      if (S.getRaw(k) !== d[k]) { S.applyRemote(k, d[k]); changed++; }
    });
    allKeys().forEach(function (k) {
      if (k === K.contentType || d[k] !== undefined) return;
      last[k] = null; S.applyRemote(k, null); changed++;
    });
    ready = true;
    setStatus('guest', 'Connected as: ' + ROLES[myRole] + '.');
    if (mine && myRole !== 'view') send({ t: 'set', k: K.contentType, v: mine }); // the page the helper has open is what the screen shows
    if (changed) {
      var t = 0; try { t = parseInt(sessionStorage.getItem('sbvc-live-reloaded'), 10) || 0; } catch (e) { /* none */ }
      if (Date.now() - t > 4000) {
        try { sessionStorage.setItem('sbvc-live-reloaded', String(Date.now())); } catch (e) { /* none */ }
        location.reload(); // the page starts again with the host's data
      } else { S.applyRemote(null, null); }
    }
  }

  function teardown() {
    running = false; ready = false; runToken++;
    clearTimeout(retryTimer); timers.forEach(clearInterval); timers = [];
    Object.keys(peers).forEach(function (c) { try { peers[c].conn.close(); } catch (e) { /* gone */ } });
    Object.keys(pendConns).forEach(function (c) { try { pendConns[c].close(); } catch (e) { /* gone */ } });
    peers = {}; pendConns = {}; hostConn = null; last = {};
    if (peer) { try { peer.destroy(); } catch (e) { /* gone */ } peer = null; }
  }

  function loadPeerJs() {
    if (window.Peer) return Promise.resolve();
    return S.loadScript(PEER_JS);
  }

  function runHost(cfg, token, tries) {
    peer = new window.Peer(PREFIX + cfg.key);
    peer.on('open', function () {
      setStatus('host', onlineList().length ? onlineList().length + ' helper(s) connected.' : 'Sharing. Waiting for a helper to join.');
      timers.push(setInterval(function () { // clear out helpers that vanished or have done nothing for an hour
        var now = Date.now();
        Object.keys(peers).forEach(function (cid) {
          var p = peers[cid];
          if (!p.conn.open || now - p.last > 180000) { dropPeer(cid, p.conn); }
          else if (now - p.lastAct > 3600000) { act(p.name, 'was removed after an hour with no activity'); exec({ a: 'kick', cid: cid }); }
        });
      }, 30000));
    });
    peer.on('connection', function (c) {
      var helloTimer = setTimeout(function () { if (!c._rec && !c._pend) { try { c.close(); } catch (e) { /* gone */ } } }, 10000);
      c.on('data', function (m) {
        if (c._rec) { fromHelper(c._rec, m); return; }
        if (!c._pend && m && typeof m === 'object' && m.t === 'hello') onHello(c, m);
      });
      var gone = function () {
        clearTimeout(helloTimer);
        if (c._rec) dropPeer(c._rec.cid, c);
        if (c._pend && pendConns[c._pend] === c) { delete pendConns[c._pend]; setPending(getPending().filter(function (x) { return x.cid !== c._pend; })); render(); }
      };
      c.on('close', gone); c.on('error', gone);
    });
    peer.on('disconnected', function () { if (token === runToken && peer && !peer.destroyed) { try { peer.reconnect(); } catch (e) { /* retry later */ } } });
    peer.on('error', function (err) {
      if (token !== runToken) return;
      if (err && err.type === 'unavailable-id') { // the previous page's link may still be closing: try again for a while
        try { peer.destroy(); } catch (e) { /* gone */ } peer = null;
        if (tries < 12) { setStatus('connecting', 'Starting…'); retryTimer = setTimeout(function () { if (token === runToken) runHost(cfg, token, tries + 1); }, 1500); }
        else setStatus('error', 'This key is already in use. Choose another key.');
      } else if (err && err.type === 'network') {
        setStatus('error', 'No connection to the internet.');
      } else if (err && err.type !== 'peer-unavailable') {
        setStatus('error', 'Live problem: ' + (err.type || err));
      }
    });
  }

  function runGuest(cfg, token) {
    if (!peer) {
      peer = new window.Peer();
      peer.on('error', function (err) {
        if (token !== runToken) return;
        if (err && err.type === 'peer-unavailable') { setStatus('connecting', 'Host not found. Waiting for the host, or check the key…'); retryTimer = setTimeout(function () { if (token === runToken) openConn(); }, 3000); }
        else if (err && err.type === 'network') setStatus('error', 'No connection to the internet.');
        else if (err) setStatus('error', 'Live problem: ' + (err.type || err));
      });
      peer.on('disconnected', function () { if (token === runToken && peer && !peer.destroyed) { try { peer.reconnect(); } catch (e) { /* retry later */ } } });
      peer.on('open', function () { openConn(); });
    }
    function openConn() {
      if (token !== runToken || !peer || !peer.open) return;
      setStatus('connecting', 'Connecting to the host…');
      var c = peer.connect(PREFIX + cfg.key, { reliable: true });
      hostConn = c; ready = false;
      c.on('open', function () { c.send({ t: 'hello', cid: myId, name: cleanName(S.getRaw(CHATNAME), 'Helper'), tok: S.getRaw(TOK) || '' }); });
      c.on('data', function (m) { if (hostConn === c) fromHost(m); });
      var lost = function () {
        if (token !== runToken || hostConn !== c) return;
        ready = false; hostConn = null;
        setStatus('connecting', 'Connection lost. Reconnecting…');
        retryTimer = setTimeout(openConn, 2500);
      };
      c.on('close', lost); c.on('error', lost);
    }
    timers.push(setInterval(function () { if (ready && hostConn && hostConn.open) hostConn.send({ t: 'ping' }); }, 25000));
  }

  function start() {
    var cfg = getCfg();
    if (!cfg || running) return;
    running = true; ready = false; last = {};
    var token = ++runToken;
    setStatus('connecting', 'Connecting…');
    loadPeerJs().then(function () {
      if (token !== runToken) return;
      if (cfg.role === 'host') runHost(cfg, token, 0); else runGuest(cfg, token);
    }).catch(function () { if (token === runToken) setStatus('error', 'Could not load the Live connection.'); });
  }
  function hold() { // take the "one tab connects" lock, then run
    if (!getCfg() || releaseLock || running) return;
    if (navigator.locks && navigator.locks.request) {
      var p = new Promise(function (res) { releaseLock = res; });
      navigator.locks.request('sbvc-live-connection', function () { if (!getCfg()) { releaseLock = null; return; } start(); return p; });
    } else start();
  }
  function release() { teardown(); if (releaseLock) { releaseLock(); releaseLock = null; } }
  function cfgChanged() {
    if (!getCfg()) { release(); render(); } else { hold(); render(); }
  }

  /* ------------------------------------------------------------------ *
   * Actions
   * ------------------------------------------------------------------ */
  function backupOwn() {
    if (S.getRaw(BACKUP) !== null) return;
    S.setRaw(BACKUP, JSON.stringify(collect()));
  }
  function restoreOwn() {
    var b = S.getJSON(BACKUP, null);
    if (!b) return false;
    allKeys().forEach(function (k) { try { localStorage.removeItem(k); } catch (e) { /* none */ } });
    Object.keys(b).forEach(function (k) { try { localStorage.setItem(k, b[k]); } catch (e) { /* none */ } });
    try { localStorage.removeItem(BACKUP); } catch (e) { /* none */ }
    return true;
  }
  function share(key) {
    key = cleanKey(key);
    if (key.length < 12) { msg('The key needs at least 12 letters or numbers. Use "New" to make a strong one.'); return; }
    S.setJSON(CFG, { role: 'host', key: key });
    S.setRaw(PEOPLE, JSON.stringify({ list: [], blocked: S.getJSON(PEOPLE, {}).blocked || [], denied: {}, locked: false }));
    S.setRaw(PENDING, '[]'); S.setRaw(ALOG, '[]');
    S.setRaw(STATUS, JSON.stringify({ state: 'connecting', online: [], msg: 'Starting…' }));
    release(); hold(); render();
  }
  function join(key) {
    key = cleanKey(key);
    if (key.length < 12) { msg('Type the key you were given (12 or more letters or numbers).'); return; }
    backupOwn();
    S.setJSON(CFG, { role: 'guest', key: key });
    S.setRaw(STATUS, JSON.stringify({ state: 'connecting', online: [], msg: 'Connecting…' }));
    release(); hold(); render();
  }
  function goLocal() {
    var cfg = getCfg();
    release();
    try { [CFG, STATUS, CHATLOG, CHATSEEN, OUTBOX, ROLEK, TOK, PENDING, CMD].forEach(function (k) { localStorage.removeItem(k); }); } catch (e) { /* none */ }
    if (cfg && cfg.role === 'guest' && restoreOwn()) { location.reload(); return; } // your own data comes back
    render();
  }

  /* ------------------------------------------------------------------ *
   * Messages shown to the user (short banner)
   * ------------------------------------------------------------------ */
  var banner = null, bannerTimer = null;
  function flash(text, keep) {
    if (keep) { try { sessionStorage.setItem(FLASH, text); } catch (e) { /* none */ } }
    if (!document.body) return;
    if (!banner) { banner = document.createElement('div'); banner.className = 'lv-banner'; document.body.appendChild(banner); }
    banner.textContent = text; banner.hidden = false;
    clearTimeout(bannerTimer); bannerTimer = setTimeout(function () { banner.hidden = true; }, 7000);
  }

  /* ------------------------------------------------------------------ *
   * Chat (everyone in the session; text, pictures and small files)
   * ------------------------------------------------------------------ */
  var MAX_FILE = 1000000, MAX_LOG = 1500000;
  var FILE_OK = /\.(pdf|txt|csv|rtf|docx?|pptx?|xlsx?|odt|odp|ods)$/i;
  var fab = null, chat = null, chatOpen = false;
  function getLog() { var l = S.getJSON(CHATLOG, []); return Array.isArray(l) ? l : []; }
  function myName() { return cleanName(S.getRaw(CHATNAME), (getCfg() || {}).role === 'host' ? 'Host' : 'Helper'); }
  // a chat message that is safe to show (or null)
  function cleanChat(m) {
    if (!m || typeof m.id !== 'string' || m.id.length > 60) return null;
    var o = { t: 'chat', id: m.id, from: String(m.from || '').slice(0, 40), name: cleanName(m.name, 'Guest'), ts: Date.now() };
    if (typeof m.text === 'string' && m.text) o.text = m.text.slice(0, 2000);
    if (typeof m.img === 'string' && m.img) { if (!IMG_OK.test(m.img) || m.img.length > 600000) return null; o.img = m.img; }
    if (m.file && typeof m.file === 'object') {
      var f = m.file, nm = String(f.name || '').replace(/[\\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 80);
      if (!FILE_OK.test(nm) || typeof f.url !== 'string' || !/^data:[\w.+\/-]*;base64,[A-Za-z0-9+\/=]+$/.test(f.url) || f.url.length > MAX_FILE * 1.4) return null;
      o.file = { name: nm, size: Math.min(parseInt(f.size, 10) || 0, MAX_FILE), url: f.url };
    }
    return o.text || o.img || o.file ? o : null;
  }
  function addChat(m) { // kept once
    var log = getLog();
    if (log.some(function (x) { return x.id === m.id; })) return;
    log.push(m);
    if (log.length > 120) log = log.slice(-120);
    while (log.length > 1 && JSON.stringify(log).length > MAX_LOG) log.shift();
    S.setRaw(CHATLOG, JSON.stringify(log));
    renderChat();
  }
  function relayOwnChat(m) { // my own message, from this tab or another tab of this browser
    if (hostConn) { if (ready && hostConn.open) hostConn.send(m); } else broadcast(m);
  }
  function sendChat(part) {
    var m = { t: 'chat', id: Date.now().toString(36) + myId.slice(0, 6) + Math.random().toString(36).slice(2, 4), from: myId, name: myName(), ts: Date.now() };
    if (part.text) m.text = part.text;
    if (part.img) m.img = part.img;
    if (part.file) m.file = part.file;
    addChat(m);
    if (running) relayOwnChat(m); else S.setRaw(OUTBOX, JSON.stringify(m)); // another tab of this browser holds the connection
  }
  function readAsDataUrl(f) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsDataURL(f); });
  }
  function shrinkImage(f) { // pictures are made smaller before sending (also drops any hidden extras)
    return readAsDataUrl(f).then(function (url) {
      return new Promise(function (res) {
        var im = new Image();
        im.onload = function () {
          var s = Math.min(1, 900 / Math.max(im.width, im.height)), c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(im.width * s)); c.height = Math.max(1, Math.round(im.height * s));
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          res(c.toDataURL('image/jpeg', 0.72));
        };
        im.onerror = function () { res(null); };
        im.src = url;
      });
    });
  }
  function attach(files) {
    Array.prototype.forEach.call(files || [], function (f) {
      if (/^image\/(png|jpe?g|webp|gif)$/.test(f.type)) {
        shrinkImage(f).then(function (u) { if (u) sendChat({ img: u }); else chatNote('Could not read that picture.'); });
      } else if (!FILE_OK.test(f.name)) {
        chatNote('Only pictures and documents (PDF, Word, PowerPoint, Excel, text) can be sent.');
      } else if (f.size <= MAX_FILE) {
        readAsDataUrl(f).then(function (u) { sendChat({ file: { name: f.name, size: f.size, url: u } }); });
      } else { chatNote('"' + f.name + '" is too big (limit 1 MB).'); }
    });
  }
  function chatNote(t) { var n = chat && chat.querySelector('.lc-note'); if (n) { n.textContent = t; setTimeout(function () { if (n.textContent === t) n.textContent = ''; }, 4000); } }
  function unread() {
    var seen = parseInt(S.getRaw(CHATSEEN), 10) || 0;
    return getLog().filter(function (m) { return m.from !== myId && m.ts > seen; }).length;
  }
  function markSeen() { S.setRaw(CHATSEEN, String(Date.now())); }
  function kb(n) { return n < 1024 ? n + ' B' : Math.round(n / 1024) + ' KB'; }

  function renderChat() {
    var cfg = getCfg();
    if (!cfg) { if (fab) { fab.remove(); fab = null; } if (chat) { chat.remove(); chat = null; chatOpen = false; } return; }
    if (!fab) {
      fab = document.createElement('button'); fab.type = 'button'; fab.className = 'lc-fab'; fab.title = 'Chat with the other people in this Live session';
      fab.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><b class="lc-badge" hidden></b>';
      fab.onclick = function () { chatOpen = !chatOpen; if (chatOpen) markSeen(); renderChat(); if (chatOpen) { var i = chat.querySelector('.lc-in'); if (i) i.focus(); } };
      document.body.appendChild(fab);
    }
    if (chatOpen) markSeen();
    var n = chatOpen ? 0 : unread(), bd = fab.querySelector('.lc-badge');
    bd.hidden = !n; bd.textContent = n > 9 ? '9+' : String(n);
    if (!chatOpen) { if (chat) chat.hidden = true; return; }
    if (!chat) buildChat();
    chat.hidden = false;
    var list = chat.querySelector('.lc-list'), atEnd = list.scrollTop + list.clientHeight >= list.scrollHeight - 30, log = getLog();
    list.textContent = '';
    if (!log.length) { var em = document.createElement('div'); em.className = 'lc-empty'; em.textContent = 'No messages yet. Say hello, or send a picture.'; list.appendChild(em); }
    log.forEach(function (m) {
      var mine = m.from === myId, row = document.createElement('div');
      row.className = 'lc-msg' + (mine ? ' mine' : '');
      var who = document.createElement('div'); who.className = 'lc-who';
      who.textContent = (mine ? 'You' : (m.name || 'Guest')) + ' · ' + new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      row.appendChild(who);
      if (m.text) { var tx = document.createElement('div'); tx.className = 'lc-text'; tx.textContent = m.text; row.appendChild(tx); }
      if (m.img && IMG_OK.test(m.img)) {
        var im = document.createElement('img'); im.className = 'lc-img'; im.src = m.img; im.alt = 'picture';
        im.onclick = function () { im.classList.toggle('big'); };
        row.appendChild(im);
      }
      if (m.file && m.file.url && FILE_OK.test(String(m.file.name))) {
        var a = document.createElement('a'); a.className = 'lc-file'; a.href = m.file.url; a.download = String(m.file.name);
        a.textContent = '\u{1F4CE} ' + m.file.name + ' (' + kb(m.file.size || 0) + ') - open only if you trust the sender';
        row.appendChild(a);
      }
      list.appendChild(row);
    });
    if (atEnd || !list.dataset.shown) list.scrollTop = list.scrollHeight;
    list.dataset.shown = '1';
    chat.querySelector('.lc-name').value = S.getRaw(CHATNAME) || '';
  }
  function buildChat() {
    chat = document.createElement('div');
    chat.className = 'lc-win'; chat.hidden = true;
    chat.innerHTML = '<div class="lc-head"><b>Live chat</b><input class="lc-name" type="text" maxlength="20" placeholder="Your name" title="The name others see"><button type="button" class="lc-x" title="Close">&times;</button></div>' +
      '<div class="lc-list"></div><div class="lc-note"></div>' +
      '<div class="lc-bar"><button type="button" class="lc-att" title="Send a picture or a document (up to 1 MB)">\u{1F4CE}</button><input class="lc-in" type="text" placeholder="Type a message" autocomplete="off"><button type="button" class="lc-send">Send</button></div>' +
      '<input class="lc-file-in" type="file" multiple hidden>';
    document.body.appendChild(chat);
    var inp = chat.querySelector('.lc-in'), fi = chat.querySelector('.lc-file-in');
    function go() { var t = inp.value.trim(); if (!t) return; sendChat({ text: t.slice(0, 2000) }); inp.value = ''; }
    chat.querySelector('.lc-send').onclick = go;
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } e.stopPropagation(); });
    chat.addEventListener('keydown', function (e) { e.stopPropagation(); }); // typing here must not trigger page shortcuts
    chat.querySelector('.lc-x').onclick = function () { chatOpen = false; renderChat(); };
    chat.querySelector('.lc-att').onclick = function () { fi.click(); };
    fi.onchange = function () { attach(fi.files); fi.value = ''; };
    chat.querySelector('.lc-name').onchange = function (e) { S.setRaw(CHATNAME, cleanName(e.target.value, '') || null); };
    chat.addEventListener('paste', function (e) { var fs = e.clipboardData && e.clipboardData.files; if (fs && fs.length) { e.preventDefault(); attach(fs); } });
    chat.addEventListener('dragover', function (e) { e.preventDefault(); });
    chat.addEventListener('drop', function (e) { e.preventDefault(); attach(e.dataTransfer.files); });
  }

  /* ------------------------------------------------------------------ *
   * Button + panel
   * ------------------------------------------------------------------ */
  var btn = document.getElementById('liveBtn'), panel = null, tab = 'share', note = '', shownReq = {};
  function msg(t) { note = t; render(); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function roleSelect(cid, cur, id) {
    return '<select data-cid="' + esc(cid) + '"' + (id ? ' id="' + id + '"' : ' data-role="1"') + '>' + Object.keys(ROLES).map(function (r) { return '<option value="' + r + '"' + (r === cur ? ' selected' : '') + '>' + ROLES[r] + '</option>'; }).join('') + '</select>';
  }
  function hhmm(ts) { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

  function render() {
    if (!btn) return;
    var cfg = getCfg(), st = getStatus(), pend = cfg && cfg.role === 'host' ? getPending() : [];
    renderChat();
    var state = cfg ? st.state : 'local';
    if (pend.length) state = 'connecting';
    var label = !cfg ? 'Local' : pend.length ? 'Live · ' + pend.length + ' waiting' : st.state === 'error' ? 'Live problem' : st.state === 'connecting' ? 'Connecting…' : cfg.role === 'host' ? 'Live · sharing' : 'Live · joined';
    btn.querySelector('.livetxt').textContent = label;
    btn.className = 'livebtn s-' + state + (panel && !panel.hidden ? ' open' : '');
    // a new join request opens the panel so the host sees it
    if (pend.length && (!panel || panel.hidden)) {
      var fresh = pend.some(function (p) { return !shownReq[p.cid + p.ts]; });
      if (fresh) { if (!panel) build(); panel.hidden = false; btn.className = 'livebtn s-connecting open'; }
    }
    pend.forEach(function (p) { shownReq[p.cid + p.ts] = true; });
    if (!panel || panel.hidden) return;
    var ae = document.activeElement;
    if (ae && panel.contains(ae) && ae.tagName === 'INPUT' && !ae.readOnly && ae.type === 'text') return; // do not rebuild while typing
    var h = '<div class="lv-head">Local or Live</div>';
    h += '<div class="lv-seg"><button type="button" data-a="local"' + (!cfg ? ' class="on"' : '') + '>Local</button><button type="button" data-a="live"' + (cfg || tab !== 'local' ? ' class="on"' : '') + '>Live</button></div>';
    if (!cfg) {
      h += '<p class="lv-p">Local: everything stays on this computer. Choose <b>Live</b> to let another computer help from far away.</p>';
      h += '<div class="lv-tabs"><button type="button" data-t="share"' + (tab === 'share' ? ' class="on"' : '') + '>Share my session</button><button type="button" data-t="join"' + (tab === 'join' ? ' class="on"' : '') + '>Join a session</button></div>';
      if (tab === 'share') {
        var gen = S.getRaw('sbvc-live-draft') || newKey(); S.setRaw('sbvc-live-draft', gen);
        h += '<p class="lv-p">Give this key to the person who will help. You must <b>allow</b> them when they ask to join, and you choose what they may do.</p>';
        h += '<div class="lv-row"><input id="lvKey" type="text" value="' + esc(pretty(gen)) + '" spellcheck="false" autocomplete="off"><button type="button" data-a="newkey" title="Make a new key">New</button></div>';
        h += '<button type="button" class="lv-go" data-a="start">Start sharing</button>';
      } else {
        h += '<p class="lv-p">Type your name and the key from the person who is sharing. They must allow you.</p>';
        h += '<div class="lv-row"><input id="lvName" type="text" maxlength="20" placeholder="Your name" value="' + esc(S.getRaw(CHATNAME) || '') + '" autocomplete="off"></div>';
        h += '<div class="lv-row" style="margin-top:6px"><input id="lvKey" type="text" placeholder="KEY" spellcheck="false" autocomplete="off"></div>';
        h += '<button type="button" class="lv-go" data-a="join">Ask to join</button>';
        h += '<p class="lv-p lv-warn">While you are joined you work on THEIR slides and settings. Yours are kept safe and come back when you go Local.</p>';
      }
    } else if (cfg.role === 'host') {
      var ppl = getPeople(), online = st.online || [];
      h += '<div class="lv-state s-' + esc(st.state) + '"><b>Sharing your session</b><span>' + esc(st.msg || '') + '</span></div>';
      h += '<div class="lv-row"><input id="lvKey" type="text" readonly value="' + esc(pretty(cfg.key)) + '"><button type="button" data-a="copy">Copy</button></div>';
      if (pend.length) {
        h += '<div class="lv-sec">Waiting to join</div>';
        pend.forEach(function (p) {
          h += '<div class="lv-card req"><b>' + esc(p.name) + '</b> wants to join.<div class="lv-row2">' + roleSelect(p.cid, 'control', 'role-' + esc(p.cid)) +
            '<button type="button" class="ok" data-a="allow" data-cid="' + esc(p.cid) + '">Allow</button><button type="button" data-a="deny" data-cid="' + esc(p.cid) + '">Deny</button><button type="button" class="bad" data-a="block" data-cid="' + esc(p.cid) + '">Block</button></div></div>';
        });
      }
      h += '<div class="lv-sec">Helpers</div>';
      if (!ppl.list.length) h += '<p class="lv-p lv-small">Nobody yet.</p>';
      ppl.list.forEach(function (p) {
        var on = online.indexOf(p.cid) >= 0;
        h += '<div class="lv-card"><span class="lv-on ' + (on ? 'y' : '') + '" title="' + (on ? 'online' : 'not connected right now') + '"></span><b>' + esc(p.name) + '</b>' + roleSelect(p.cid, p.role) +
          '<button type="button" data-a="kick" data-cid="' + esc(p.cid) + '" title="Remove (they must ask again)">Remove</button><button type="button" class="bad" data-a="block" data-cid="' + esc(p.cid) + '" title="Block this helper">Block</button></div>';
      });
      h += '<label class="lv-lock"><input type="checkbox" data-a="lock"' + (ppl.locked ? ' checked' : '') + '> Lock session (nobody new can join)</label>';
      if (ppl.blocked.length) h += '<p class="lv-p lv-small">' + ppl.blocked.length + ' blocked. <a href="#" data-a="unblock">Clear blocked list</a></p>';
      var rp = S.getJSON(RESTORE, null);
      if (rp && rp.ts) h += '<div class="lv-sec">Restore point</div><p class="lv-p lv-small">Your slides and settings from before the first helper joined (' + hhmm(rp.ts) + ').</p><button type="button" class="lv-mini" data-a="restore">Put them back</button>';
      var lg = S.getJSON(ALOG, []); if (!Array.isArray(lg)) lg = [];
      h += '<div class="lv-sec">Activity <a href="#" data-a="clearlog" class="lv-clear">clear</a></div><div class="lv-log">' +
        (lg.length ? lg.slice(-25).reverse().map(function (e) { return '<div><i>' + hhmm(e.ts) + '</i> <b>' + esc(e.who) + '</b> ' + esc(e.what) + (e.n > 1 ? ' (' + e.n + 'x)' : '') + '</div>'; }).join('') : '<div class="lv-small">Nothing yet.</div>') + '</div>';
      h += '<button type="button" class="lv-go stop" data-a="stop">Stop sharing (back to Local)</button>';
    } else {
      h += '<div class="lv-state s-' + esc(st.state) + '"><b>Joined a session</b><span>' + esc(st.msg || '') + '</span></div>';
      h += '<p class="lv-p">Your role: <b>' + esc(ROLES[myRole] || myRole) + '</b></p>';
      h += '<p class="lv-p">Key: <b>' + esc(pretty(cfg.key)) + '</b></p>';
      h += '<button type="button" class="lv-go stop" data-a="stop">Leave (back to Local)</button>';
    }
    if (note) h += '<p class="lv-p lv-warn">' + esc(note) + '</p>';
    h += '<p class="lv-p lv-small">Needs internet on both computers. Videos in the Hymnals library are not sent. The other person can see your internet address (IP), as in any direct connection.</p>';
    var sc = panel.scrollTop;
    panel.innerHTML = h;
    panel.scrollTop = sc;
  }

  function build() {
    panel = document.createElement('div');
    panel.className = 'livepanel'; panel.hidden = true;
    document.body.appendChild(panel);
    panel.addEventListener('click', function (e) {
      var b = e.target.closest('button, a'); if (!b) return;
      var a = b.dataset.a, t = b.dataset.t, cid = b.dataset.cid, inp = panel.querySelector('#lvKey');
      if (b.tagName === 'A') e.preventDefault();
      note = '';
      if (t) { tab = t; render(); return; }
      if (a === 'local') { if (getCfg()) goLocal(); else { tab = 'local'; render(); } }
      else if (a === 'live') { if (tab === 'local') tab = 'share'; render(); }
      else if (a === 'newkey') { S.setRaw('sbvc-live-draft', newKey()); render(); }
      else if (a === 'start') { S.setRaw('sbvc-live-draft', null); share(inp.value); }
      else if (a === 'join') { var nm = panel.querySelector('#lvName'); if (nm) S.setRaw(CHATNAME, cleanName(nm.value, '') || null); join(inp.value); }
      else if (a === 'stop') goLocal();
      else if (a === 'copy') { try { navigator.clipboard.writeText(inp.value); msg('Key copied.'); } catch (x) { inp.select(); } }
      else if (a === 'allow') { var sel = panel.querySelector('#role-' + cid); cmd({ a: 'allow', cid: cid, role: sel ? sel.value : 'control' }); }
      else if (a === 'deny' || a === 'kick' || a === 'unblock' || a === 'clearlog') cmd({ a: a, cid: cid });
      else if (a === 'block') { if (confirm('Block this helper? They will not be able to ask again.')) cmd({ a: 'block', cid: cid }); }
      else if (a === 'restore') { if (confirm('Put back your slides and settings from before the first helper joined? Changes since then will be replaced.')) { cmd({ a: 'restore' }); } }
    });
    panel.addEventListener('change', function (e) {
      var s = e.target;
      if (s.dataset.role) cmd({ a: 'role', cid: s.dataset.cid, role: s.value });
      else if (s.dataset.a === 'lock') cmd({ a: 'lock', on: s.checked });
    });
    document.addEventListener('mousedown', function (e) {
      if (!panel.hidden && !panel.contains(e.target) && !btn.contains(e.target)) { panel.hidden = true; render(); }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { panel.hidden = true; render(); } });
  }
  if (btn) {
    btn.addEventListener('click', function () {
      if (!panel) build();
      panel.hidden = !panel.hidden; note = '';
      if (!getCfg() && tab === 'local') tab = 'share';
      render();
    });
  }

  // a message left by the page before it reloaded (for example "the host removed you")
  try { var fl = sessionStorage.getItem(FLASH); if (fl) { sessionStorage.removeItem(FLASH); flash(fl); } } catch (e) { /* none */ }
  // a page that was closed in the middle of a Live session starts it again
  if (getCfg()) { var s0 = getStatus(); if (s0.state !== 'error') S.setRaw(STATUS, JSON.stringify({ state: 'connecting', online: [], msg: 'Reconnecting…' })); }
  render();
  hold();
})();
