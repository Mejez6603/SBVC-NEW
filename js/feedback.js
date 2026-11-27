/* The Report / Message form on the About page.
 * Messages go through Web3Forms, which emails them to whoever owns the access key
 * (data-access-key on the form in about.html). No email address is written in the site. */
(function () {
  'use strict';
  var form = document.getElementById('feedback');
  if (!form) return;

  var URL_SEND = 'https://api.web3forms.com/submit'; // also allowed in vercel.json
  var WAIT_MS = 30000; // pause between two messages
  var button = form.querySelector('button[type=submit]');
  var status = form.querySelector('.ab-status');
  var lastSent = 0, sending = false;

  function say(text, kind) { status.textContent = text; status.className = 'ab-status' + (kind ? ' ' + kind : ''); }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    var f = form.elements;
    var message = f.message.value.trim();
    if (!message) { say('Write your message first.', 'bad'); f.message.focus(); return; }
    var key = (form.getAttribute('data-access-key') || '').trim();
    if (!key) { say('Sending is not set up yet, so your message was not sent.', 'bad'); return; }
    if (Date.now() - lastSent < WAIT_MS) { say('Please wait a few seconds before sending another one.', 'bad'); return; }

    var type = f.type.value;
    var data = {
      access_key: key,
      subject: 'SBVC ' + type,
      from_name: 'SBVC website',
      type: type,
      name: f.name.value.trim() || '(not given)',
      message: message,
      browser: navigator.userAgent,
      botcheck: f.botcheck.checked // only a spam robot ticks this hidden box
    };
    var reply = f.email.value.trim();
    if (reply) data.email = reply;

    sending = true; button.disabled = true; say('Sending…');
    var stop = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (stop) stop.abort(); }, 20000);
    fetch(URL_SEND, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(data),
      signal: stop ? stop.signal : undefined
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (out) {
        if (res.status === 429) throw new Error('busy');
        if (!res.ok || out.success !== true) throw new Error('refused');
        lastSent = Date.now();
        f.message.value = '';
        say('Sent. Thank you!', 'good');
      });
    }).catch(function (err) { // what was typed stays in the box
      say(err.message === 'busy' ? 'Too many messages right now. Please try again later.'
        : err.message === 'refused' ? 'Not sent: the message service did not accept it. Please try again later.'
        : 'Not sent. Check your internet and try again.', 'bad');
    }).then(function () {
      clearTimeout(timer); sending = false; button.disabled = false;
    });
  });
})();
