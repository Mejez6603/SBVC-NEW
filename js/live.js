/* Live mode (button at the top right of every page).
 *
 *   Local  = nothing leaves this computer (the default).
 *   Live   = this computer can SHARE its session behind a key, or JOIN another computer's session with that key.
 *            The helper can edit and control everything; changes travel both ways, so the projector at the church
 *            follows what the remote helper does.
 *
 * How: a direct browser-to-browser (WebRTC) link made with PeerJS. The free PeerJS cloud broker only introduces the two
 * computers (it never sees the slides); the key is the name of the host's connection point. Both computers need internet.
 * Videos in the Hymnals media library are NOT sent (only text, slides, designs, pictures and settings).
 *
 * The host keeps its own data. A helper's own data is backed up when joining and put back when leaving.
 */
(function () {
  'use strict';
  var S = window.SBVC;
  if (!S) return;
  var K = S.KEYS;

  var CFG = 'sbvc-live-cfg';       // {role:'host'|'guest', key}  (absent = Local)
  var STATUS = 'sbvc-live-status'; // {state, guests, msg} written by the tab that holds the connection
  var BACKUP = 'sbvc-live-backup'; // the helper's own data while joined
  var PEER_JS = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
  var PREFIX = 'sbvc-live-';
  var CHATLOG = 'sbvc-live-chat', CHATSEEN = 'sbvc-live-chatseen', CHATNAME = 'sbvc-live-name', OUTBOX = 'sbvc-live-outbox';

  // what is shared: slides, passages, designs, pictures, settings. Not: this window's own screen layout, clipboards, live settings.
  function syncable(k) {
    if (!k || k.indexOf('sbvc-') !== 0) return false;
    if (/^(sbvc-live|sbvc-collapsed-|sbvc-fullscreen)/.test(k) || /-clip$/.test(k)) return false;
    return k !== K.hymnUi && k !== K.ctrlUi;
  }
  function allKeys() {
    var out = [];
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (syncable(k)) out.push(k); } } catch (e) { /* none */ }
    return out;
  }
  function collect() { var d = {}; allKeys().forEach(function (k) { d[k] = S.getRaw(k); }); return d; }

  function cleanKey(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function newKey() {
    var abc = 'abcdefghjkmnpqrstuvwxyz23456789', a = new Uint8Array(10), o = '';
    crypto.getRandomValues(a);
    for (var i = 0; i < a.length; i++) o += abc[a[i] % abc.length];
    return o;
  }
  function pretty(k) { return k.toUpperCase().replace(/(.{5})(?=.)/g, '$1-'); }

  function getCfg() { return S.getJSON(CFG, null); }
  function getStatus() { return S.getJSON(STATUS, null) || { state: 'local', guests: 0, msg: '' }; }
  function setStatus(state, msg, guests) {
    S.setRaw(STATUS, JSON.stringify({ state: state, guests: guests || 0, msg: msg || '' }));
    render();
  }

  /* ------------------------------------------------------------------ *
   * Connection (only ONE open tab holds it; the others just show its status)
   * ------------------------------------------------------------------ */
  var peer = null, conns = [], hostConn = null, ready = false, running = false, runToken = 0;
  var releaseLock = null, retryTimer = null, last = {};

  function send(msg) {
    if (!running) return;
    if (hostConn) { if (ready && hostConn.open) hostConn.send(msg); return; }
    conns.forEach(function (c) { if (c.open) c.send(msg); });
  }
  S.setLiveHook(function (k, v) {
    if (!running || !syncable(k) || last[k] === v) return;
    last[k] = v;
    send({ t: 'set', k: k, v: v });
  });
  window.addEventListener('storage', function (e) { // a change made in another tab of this browser
    if (e.key === CFG) { cfgChanged(); return; }
    if (e.key === STATUS) { render(); return; }
    if (e.key === OUTBOX) { if (running && e.newValue) { try { send(JSON.parse(e.newValue)); } catch (x) { /* bad */ } } return; }
    if (e.key === CHATLOG || e.key === CHATSEEN || e.key === CHATNAME) { renderChat(); return; }
    if (running && syncable(e.key) && last[e.key] !== e.newValue) { last[e.key] = e.newValue; send({ t: 'set', k: e.key, v: e.newValue }); }
  });

  function onData(msg, from) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'set' && syncable(msg.k)) {
      last[msg.k] = msg.v;
      S.applyRemote(msg.k, msg.v);
      if (!hostConn) conns.forEach(function (c) { if (c !== from && c.open) c.send(msg); }); // host: pass it on to the other helpers
    } else if (msg.t === 'chat' && msg.id) {
      addChat(msg);
      if (!hostConn) conns.forEach(function (c) { if (c !== from && c.open) c.send(msg); });
    } else if (msg.t === 'snap' && msg.d && hostConn) {
      applySnapshot(msg.d);
    }
  }
  function applySnapshot(d) {
    var mine = S.getRaw(K.contentType), changed = 0;
    Object.keys(d).forEach(function (k) {
      if (!syncable(k) || k === K.contentType) return;
      last[k] = d[k];
      if (S.getRaw(k) !== d[k]) { S.applyRemote(k, d[k]); changed++; }
    });
    allKeys().forEach(function (k) {
      if (k === K.contentType || d[k] !== undefined) return;
      last[k] = null; S.applyRemote(k, null); changed++;
    });
    ready = true;
    setStatus('guest', 'Connected. You can edit and control.');
    if (mine) send({ t: 'set', k: K.contentType, v: mine }); // whichever page the helper has open is what the projector shows
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
    clearTimeout(retryTimer);
    conns.forEach(function (c) { try { c.close(); } catch (e) { /* gone */ } });
    conns = []; hostConn = null; last = {};
    if (peer) { try { peer.destroy(); } catch (e) { /* gone */ } peer = null; }
  }

  function loadPeerJs() {
    if (window.Peer) return Promise.resolve();
    return S.loadScript(PEER_JS);
  }

  function runHost(cfg, token, tries) {
    var id = PREFIX + cfg.key;
    peer = new window.Peer(id);
    peer.on('open', function () { setStatus('host', 'Sharing. Waiting for a helper to join.', conns.length); });
    peer.on('connection', function (c) {
      c.on('open', function () {
        conns.push(c);
        c.send({ t: 'snap', d: collect() });
        setStatus('host', 'A helper is connected.', conns.length);
      });
      c.on('data', function (m) { onData(m, c); });
      var gone = function () {
        conns = conns.filter(function (x) { return x !== c; });
        if (token === runToken) setStatus('host', conns.length ? 'A helper is connected.' : 'Sharing. Waiting for a helper to join.', conns.length);
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
      c.on('data', function (m) { onData(m, c); });
      var lost = function () {
        if (token !== runToken || hostConn !== c) return;
        ready = false; hostConn = null;
        setStatus('connecting', 'Connection lost. Reconnecting…');
        retryTimer = setTimeout(openConn, 2500);
      };
      c.on('close', lost); c.on('error', lost);
    }
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
    }).catch(function () { if (token === runToken) setStatus('error', 'Could not load the Live connection (needs internet).'); });
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
    if (key.length < 8) { msg('The key needs at least 8 letters or numbers.'); return; }
    S.setJSON(CFG, { role: 'host', key: key });
    S.setRaw(STATUS, JSON.stringify({ state: 'connecting', guests: 0, msg: 'Starting…' }));
    release(); hold(); render();
  }
  function join(key) {
    key = cleanKey(key);
    if (key.length < 8) { msg('Type the key you were given (at least 8 letters or numbers).'); return; }
    backupOwn();
    S.setJSON(CFG, { role: 'guest', key: key });
    S.setRaw(STATUS, JSON.stringify({ state: 'connecting', guests: 0, msg: 'Connecting…' }));
    release(); hold(); render();
  }
  function goLocal() {
    var cfg = getCfg();
    release();
    try { [CFG, STATUS, CHATLOG, CHATSEEN, OUTBOX].forEach(function (k) { localStorage.removeItem(k); }); } catch (e) { /* none */ }
    if (cfg && cfg.role === 'guest' && restoreOwn()) { location.reload(); return; } // your own data comes back
    render();
  }

  /* ------------------------------------------------------------------ *
   * Chat (everyone in the session; text, pictures and small files)
   * ------------------------------------------------------------------ */
  var MAX_FILE = 1500000, MAX_LOG = 1500000;
  var fab = null, chat = null, chatOpen = false;
  function getLog() { var l = S.getJSON(CHATLOG, []); return Array.isArray(l) ? l : []; }
  function myName() { return S.getRaw(CHATNAME) || ((getCfg() || {}).role === 'host' ? 'Host' : 'Helper'); }
  function addChat(m) { // from the other side (or my own send): kept once
    var log = getLog();
    if (log.some(function (x) { return x.id === m.id; })) return;
    log.push(m);
    if (log.length > 120) log = log.slice(-120);
    while (log.length > 1 && JSON.stringify(log).length > MAX_LOG) log.shift();
    S.setRaw(CHATLOG, JSON.stringify(log));
    renderChat();
  }
  var myId = S.getRaw('sbvc-live-me'); // stays the same when you move between pages, so your own messages stay yours
  if (!myId) { myId = Math.random().toString(36).slice(2, 8); S.setRaw('sbvc-live-me', myId); }
  function sendChat(part) {
    var m = { t: 'chat', id: Date.now().toString(36) + myId + Math.random().toString(36).slice(2, 4), from: myId, name: myName(), ts: Date.now() };
    if (part.text) m.text = part.text;
    if (part.img) m.img = part.img;
    if (part.file) m.file = part.file;
    addChat(m);
    if (running) send(m); else S.setRaw(OUTBOX, JSON.stringify(m)); // another tab of this browser holds the connection
  }
  function readAsDataUrl(f) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsDataURL(f); });
  }
  function shrinkImage(f) { // pictures are made smaller before sending
    return readAsDataUrl(f).then(function (url) {
      return new Promise(function (res) {
        var im = new Image();
        im.onload = function () {
          var s = Math.min(1, 900 / Math.max(im.width, im.height)), c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(im.width * s)); c.height = Math.max(1, Math.round(im.height * s));
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          res(c.toDataURL('image/jpeg', 0.75));
        };
        im.onerror = function () { res(null); };
        im.src = url;
      });
    });
  }
  function attach(files) {
    Array.prototype.forEach.call(files || [], function (f) {
      if (/^image\//.test(f.type)) {
        shrinkImage(f).then(function (u) { if (u) sendChat({ img: u }); else chatNote('Could not read that picture.'); });
      } else if (f.size <= MAX_FILE) {
        readAsDataUrl(f).then(function (u) { sendChat({ file: { name: f.name, size: f.size, url: u } }); });
      } else { chatNote('"' + f.name + '" is too big (limit 1.5 MB).'); }
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
      if (m.img && /^data:image\//.test(m.img)) {
        var im = document.createElement('img'); im.className = 'lc-img'; im.src = m.img; im.alt = 'picture';
        im.onclick = function () { im.classList.toggle('big'); };
        row.appendChild(im);
      }
      if (m.file && m.file.url && /^data:/.test(m.file.url)) {
        var a = document.createElement('a'); a.className = 'lc-file'; a.href = m.file.url; a.download = String(m.file.name || 'file');
        a.textContent = '\u{1F4CE} ' + m.file.name + ' (' + kb(m.file.size || 0) + ')';
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
      '<div class="lc-bar"><button type="button" class="lc-att" title="Send a picture or a small file">\u{1F4CE}</button><input class="lc-in" type="text" placeholder="Type a message" autocomplete="off"><button type="button" class="lc-send">Send</button></div>' +
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
    chat.querySelector('.lc-name').onchange = function (e) { S.setRaw(CHATNAME, e.target.value.trim().slice(0, 20) || null); };
    chat.addEventListener('paste', function (e) { var fs = e.clipboardData && e.clipboardData.files; if (fs && fs.length) { e.preventDefault(); attach(fs); } });
    chat.addEventListener('dragover', function (e) { e.preventDefault(); });
    chat.addEventListener('drop', function (e) { e.preventDefault(); attach(e.dataTransfer.files); });
  }
  /* ------------------------------------------------------------------ *
   * Button + panel
   * ------------------------------------------------------------------ */
  var btn = document.getElementById('liveBtn'), panel = null, tab = 'share', note = '';
  function msg(t) { note = t; render(); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function render() {
    if (!btn) return;
    var cfg = getCfg(), st = getStatus();
    renderChat();
    var state = cfg ? st.state : 'local';
    var label = !cfg ? 'Local' : st.state === 'error' ? 'Live problem' : st.state === 'connecting' ? 'Connecting…' : cfg.role === 'host' ? 'Live · sharing' : 'Live · joined';
    btn.querySelector('.livetxt').textContent = label;
    btn.className = 'livebtn s-' + state + (panel && !panel.hidden ? ' open' : '');
    if (!panel || panel.hidden) return;
    var h = '<div class="lv-head">Local or Live</div>';
    h += '<div class="lv-seg"><button type="button" data-a="local"' + (!cfg ? ' class="on"' : '') + '>Local</button><button type="button" data-a="live"' + (cfg || tab !== 'local' ? ' class="on"' : '') + '>Live</button></div>';
    if (!cfg) {
      h += '<p class="lv-p">Local: everything stays on this computer. Choose <b>Live</b> to let another computer help from far away.</p>';
      h += '<div class="lv-tabs"><button type="button" data-t="share"' + (tab === 'share' ? ' class="on"' : '') + '>Share my session</button><button type="button" data-t="join"' + (tab === 'join' ? ' class="on"' : '') + '>Join a session</button></div>';
      if (tab === 'share') {
        var gen = S.getRaw('sbvc-live-draft') || newKey(); S.setRaw('sbvc-live-draft', gen);
        h += '<p class="lv-p">Give this key to the person who will help. They can edit and control everything.</p>';
        h += '<div class="lv-row"><input id="lvKey" type="text" value="' + esc(pretty(gen)) + '" spellcheck="false" autocomplete="off"><button type="button" data-a="newkey" title="Make a new key">New</button></div>';
        h += '<button type="button" class="lv-go" data-a="start">Start sharing</button>';
      } else {
        h += '<p class="lv-p">Type the key from the person who is sharing.</p>';
        h += '<div class="lv-row"><input id="lvKey" type="text" placeholder="KEY" spellcheck="false" autocomplete="off"></div>';
        h += '<button type="button" class="lv-go" data-a="join">Join</button>';
        h += '<p class="lv-p lv-warn">While you are joined you work on THEIR slides and settings. Yours are kept safe and come back when you go Local.</p>';
      }
    } else {
      h += '<div class="lv-state s-' + esc(st.state) + '"><b>' + (cfg.role === 'host' ? 'Sharing your session' : 'Joined a session') + '</b><span>' + esc(st.msg || '') + '</span></div>';
      if (cfg.role === 'host') {
        h += '<div class="lv-row"><input id="lvKey" type="text" readonly value="' + esc(pretty(cfg.key)) + '"><button type="button" data-a="copy">Copy</button></div>';
        h += '<p class="lv-p">Helpers connected: <b>' + (st.guests || 0) + '</b>. Keep this page open (you can move between the pages).</p>';
        h += '<button type="button" class="lv-go stop" data-a="stop">Stop sharing (back to Local)</button>';
      } else {
        h += '<p class="lv-p">Key: <b>' + esc(pretty(cfg.key)) + '</b></p>';
        h += '<button type="button" class="lv-go stop" data-a="stop">Leave (back to Local)</button>';
      }
    }
    if (note) h += '<p class="lv-p lv-warn">' + esc(note) + '</p>';
    h += '<p class="lv-p lv-small">Needs internet on both computers. Videos in the Hymnals library are not sent.</p>';
    panel.innerHTML = h;
  }

  function build() {
    panel = document.createElement('div');
    panel.className = 'livepanel'; panel.hidden = true;
    document.body.appendChild(panel);
    panel.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var a = b.dataset.a, t = b.dataset.t, inp = panel.querySelector('#lvKey');
      note = '';
      if (t) { tab = t; render(); return; }
      if (a === 'local') { if (getCfg()) goLocal(); else { tab = 'local'; render(); } }
      else if (a === 'live') { if (tab === 'local') tab = 'share'; render(); }
      else if (a === 'newkey') { S.setRaw('sbvc-live-draft', newKey()); render(); }
      else if (a === 'start') { S.setRaw('sbvc-live-draft', null); share(inp.value); }
      else if (a === 'join') join(inp.value);
      else if (a === 'stop') goLocal();
      else if (a === 'copy') { try { navigator.clipboard.writeText(inp.value); msg('Key copied.'); } catch (x) { inp.select(); } }
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

  // a page that was closed in the middle of a Live session starts it again
  if (getCfg()) { var s0 = getStatus(); if (s0.state !== 'error') S.setRaw(STATUS, JSON.stringify({ state: 'connecting', guests: 0, msg: 'Reconnecting…' })); }
  render();
  hold();
})();
