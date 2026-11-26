/* Shared top navigation. Put <header id="topnav" class="topnav"></header> in the page. */
(function () {
  var links = [
    ['controller.html', 'SBVC'],
    ['hymnals.html', 'Hymnals'],
    ['preaching.html', 'Preaching'],
    ['powerpoint.html', 'PowerPoint'],
    ['about.html', 'About']
  ];
  var here = location.pathname.split('/').pop() || 'index.html';
  var host = document.getElementById('topnav');
  if (!host) return;
  var nav = document.createElement('nav');
  links.forEach(function (l) {
    var a = document.createElement('a');
    a.href = l[0];
    a.textContent = l[1];
    if (here === l[0]) a.className = 'active';
    nav.appendChild(a);
  });
  host.appendChild(nav);

  // Live button (top right): Local or Live. Its code (js/live.js) loads after the page has started.
  if (window.SBVC) {
    var lb = document.createElement('button');
    lb.type = 'button'; lb.id = 'liveBtn'; lb.className = 'livebtn';
    lb.title = 'Local / Live: let another computer help remotely';
    lb.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19 5a10 10 0 0 1 0 14M5 19a10 10 0 0 1 0-14"/></svg><span class="livetxt">Local</span><i class="livedot2"></i>';
    var bb = document.createElement('button');
    bb.type = 'button'; bb.id = 'backupBtn'; bb.className = 'livebtn backupbtn';
    bb.title = 'Back up everything, or restore from a backup file';
    bb.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg><span>Backup</span>';
    host.appendChild(bb);
    host.appendChild(lb);
    var ls = document.createElement('script');
    ls.src = 'js/live.js';
    document.body.appendChild(ls);
    ['js/backup.js', 'js/player.js'].forEach(function (src) {
      var s = document.createElement('script');
      s.src = src;
      document.body.appendChild(s);
    });
  }
})();
