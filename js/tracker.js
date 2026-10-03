/* Tracker page: log today's servings */
document.addEventListener('DOMContentLoaded', function () {
  var $ = function (id) { return document.getElementById(id); };
  var carafe = App.Carafe($('carafe'), { ticks: true });
  var ICONS = [
    '<svg viewBox="0 0 30 40" aria-hidden="true"><path class="f" d="M8 26 h14 l-1.5 10 h-11 z"/><path d="M5 6 h20 l-4 30 h-12 z"/></svg>',
    '<svg viewBox="0 0 30 40" aria-hidden="true"><path class="f" d="M6.5 18 h17 l-2.4 18 h-12.2 z"/><path d="M4 4 h22 l-4 32 h-14 z"/></svg>',
    '<svg viewBox="0 0 30 40" aria-hidden="true"><path class="f" d="M6 14 h18 v20 a3 3 0 0 1 -3 3 h-12 a3 3 0 0 1 -3 -3 z"/><path d="M6 4 h18 v30 a3 3 0 0 1 -3 3 h-12 a3 3 0 0 1 -3 -3 z"/></svg>',
    '<svg viewBox="0 0 30 40" aria-hidden="true"><path class="f" d="M8 16 h14 v19 a2 2 0 0 1 -2 2 h-10 a2 2 0 0 1 -2 -2 z"/><path d="M12 2 h6 v5 c0 2 4 3 4 6 v22 a2 2 0 0 1 -2 2 h-10 a2 2 0 0 1 -2 -2 v-22 c0 -3 4 -4 4 -6 z"/></svg>'
  ];
  var TIP = 'Tip: press 1–4 on your keyboard to add a quick serving.';

  function presets() { return WaterData.presets[App.state.unit]; }

  function message(p, drunk) {
    if (drunk === 0) return 'Start with a glass. Your first serving sets the pace for the day.';
    if (p < 25) return 'A good start. Keep a glass within reach.';
    if (p < 50) return 'Building steadily. Another serving puts you near halfway.';
    if (p < 75) return 'Past halfway. Keep the rhythm going through the afternoon.';
    if (p < 100) return 'Almost there. One or two more servings will do it.';
    return "You've hit today's target. Keep sipping when you're thirsty.";
  }

  function renderQuick() {
    var q = $('quick'); q.innerHTML = '';
    presets().forEach(function (p, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'Add ' + App.amt(p.ml) + ' (' + p.name.toLowerCase() + ')');
      b.innerHTML = ICONS[i] + '<span class="amt">' + App.amt(p.ml) + '</span><span class="nm">' + p.name + '</span>';
      b.addEventListener('click', function () { add(p.ml); });
      q.appendChild(b);
    });
    document.querySelectorAll('[data-unit]').forEach(function (el) { el.textContent = App.unitLabel(); });
  }

  function render() {
    var k = App.todayKey(), d = App.day(k), drunk = App.total(d);
    var p = d.target ? drunk / d.target * 100 : 0;
    carafe.set(p / 100, d.target);
    $('vessel').classList.toggle('done', p >= 100);
    $('pct').textContent = Math.floor(p) + '%';
    $('of').textContent = App.num(drunk) + ' of ' + App.amt(d.target);
    $('message').textContent = message(p, drunk);
    $('s-target').innerHTML = App.amtHTML(d.target);
    $('s-drunk').innerHTML = App.amtHTML(drunk);
    $('s-left').innerHTML = App.amtHTML(Math.max(d.target - drunk, 0));
    $('s-count').textContent = d.entries.length;
    $('today-date').textContent = App.longDate(new Date());

    var log = $('log'); log.innerHTML = '';
    if (!d.entries.length) {
      log.innerHTML = '<li><p class="empty">No servings yet. Add one above.</p></li>';
      return;
    }
    d.entries.slice().reverse().forEach(function (e) {
      var li = document.createElement('li'), t = App.timeOf(e.t);
      li.innerHTML = '<span class="time">' + t + '</span><span class="ml">' + App.amt(e.ml) + '</span>';
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = 'Remove';
      b.setAttribute('aria-label', 'Remove ' + App.amt(e.ml) + ' serving from ' + t);
      b.addEventListener('click', function () { App.removeServing(k, e.id); });
      li.appendChild(b); log.appendChild(li);
    });
  }

  function add(ml) { App.addServing(ml); carafe.drop(); }

  $('custom-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var raw = parseFloat($('custom-amt').value), ml = App.fromUnit(raw), h = $('custom-hint');
    if (!raw || ml < 1 || ml > WaterData.MAX_SERVING) {
      h.textContent = 'Enter an amount up to ' + App.amt(WaterData.MAX_SERVING) + '.';
      h.className = 'hint err'; return;
    }
    h.textContent = TIP; h.className = 'hint';
    $('custom-amt').value = '';
    add(ml);
  });

  var armed = null;
  function disarm() { clearTimeout(armed); armed = null; $('reset-btn').textContent = 'Reset today'; $('reset-btn').classList.remove('warn'); }
  $('reset-btn').addEventListener('click', function () {
    if (!armed) {
      $('reset-btn').textContent = 'Tap again to clear today'; $('reset-btn').classList.add('warn');
      armed = setTimeout(disarm, 4000); return;
    }
    disarm();
    var d = App.day(App.todayKey()), saved = d.entries.slice();
    if (!saved.length) return;
    d.entries = []; App.save(); App.changed();
    App.toast("Today's servings cleared.", 'Undo', function () { d.entries = saved; App.save(); App.changed(); });
  });

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
    var n = parseInt(e.key, 10);
    if (n >= 1 && n <= 4) add(presets()[n - 1].ml);
  });

  App.onChange(function () { renderQuick(); render(); });
  renderQuick();
  render();
});
