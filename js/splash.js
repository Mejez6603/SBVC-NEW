/* The home page (index.html): the splash screen and the Open Control Panel button.
 * (Code is not written inside the pages: the security policy in vercel.json would block it.) */
(function () {
  'use strict';
  var splash = document.getElementById('splash');
  var art = document.getElementById('splashArt');
  var home = document.getElementById('home');

  // assets/splash.gif draws for about 4.3 s and holds the finished logo for 2 s before it would start over,
  // so the splash has to be gone before 6.2 s
  var SHOW_MS = 5500, FADE_MS = 500;
  var timer = null, done = false;

  function finish() {
    if (done) return;
    done = true;
    clearTimeout(timer);
    window.removeEventListener('keydown', skip, true);
    home.inert = false;
    splash.classList.add('out');
    setTimeout(function () { splash.remove(); }, FADE_MS);
  }
  function skip(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.key)) return; // leave browser shortcuts alone
    e.preventDefault();
    finish();
  }
  function startClock() { // counts from the moment the animation is really on the screen
    if (done) return;
    clearTimeout(timer);
    timer = setTimeout(finish, SHOW_MS);
  }

  document.getElementById('openPanel').addEventListener('click', function () { window.open('controller.html', '_blank'); });

  home.inert = true; // the button behind the splash cannot be reached yet
  splash.addEventListener('click', finish);
  window.addEventListener('keydown', skip, true);
  timer = setTimeout(finish, 9000); // never stay stuck if the picture is very slow
  art.addEventListener('error', finish);
  if (art.complete && art.naturalWidth) startClock();
  else if (art.complete) finish();
  else art.addEventListener('load', startClock);
})();
