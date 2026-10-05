(function () {
  var root = document.documentElement;

  // Theme toggle. Without JavaScript the site still follows the system setting.
  var btn = document.getElementById('theme-toggle');
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function current() {
    var t = root.getAttribute('data-theme');
    if (t === 'light' || t === 'dark') return t;
    return mq && mq.matches ? 'dark' : 'light';
  }

  function render() {
    var c = current();
    btn.textContent = 'theme: ' + c;
    btn.setAttribute('aria-label', 'Switch to ' + (c === 'dark' ? 'light' : 'dark') + ' theme');
  }

  if (btn) {
    btn.hidden = false;
    render();
    btn.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      render();
    });
    if (mq && mq.addEventListener) mq.addEventListener('change', render);
  }

  // Project filters on /projects/. Without JavaScript every project is shown.
  var bar = document.getElementById('filters');
  if (bar) {
    var buttons = bar.querySelectorAll('button[data-filter]');
    var cards = document.querySelectorAll('.case[data-area]');
    bar.hidden = false;
    Array.prototype.forEach.call(buttons, function (b) {
      b.addEventListener('click', function () {
        var f = b.getAttribute('data-filter');
        Array.prototype.forEach.call(buttons, function (o) {
          o.setAttribute('aria-pressed', o === b ? 'true' : 'false');
        });
        Array.prototype.forEach.call(cards, function (c) {
          c.hidden = !(f === 'all' || c.getAttribute('data-area') === f);
        });
      });
    });
  }
})();
