/* Shared top navigation. Put <header id="topnav" class="topnav"></header> in the page. */
(function () {
  var links = [
    ['controller.html', 'SBVC'],
    ['hymnals.html', 'Hymnals'],
    ['preaching.html', 'Preaching'],
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
})();
