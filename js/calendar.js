/* Calendar page: monthly heatmap of intake */
document.addEventListener('DOMContentLoaded', function () {
  var $ = function (id) { return document.getElementById(id); };
  var now = new Date();
  var view = new Date(now.getFullYear(), now.getMonth(), 1);
  var selected = App.todayKey();

  function level(d) {
    if (!d || !d.entries.length) return 0;
    var p = App.total(d) / d.target;
    if (p >= 1) return 4;
    if (p >= 0.66) return 3;
    if (p >= 0.33) return 2;
    return 1;
  }

  function render() {
    var y = view.getFullYear(), m = view.getMonth();
    var first = new Date(y, m, 1), daysIn = new Date(y, m + 1, 0).getDate();
    var offset = (first.getDay() + 6) % 7; // Monday first
    var todayK = App.todayKey(), grid = $('calendar-grid');
    $('month-label').textContent = first.toLocaleDateString([], { month: 'long', year: 'numeric' });
    $('next-month').disabled = y === now.getFullYear() && m === now.getMonth();
    $('this-month').hidden = $('next-month').disabled;
    grid.innerHTML = '';

    for (var i = 0; i < offset; i++) {
      var blank = document.createElement('span'); blank.className = 'cal-day blank'; grid.appendChild(blank);
    }
    var logged = 0, metDays = 0, sum = 0;
    for (var n = 1; n <= daysIn; n++) {
      (function (n) {
        var dt = new Date(y, m, n), k = App.keyOf(dt), d = App.peek(k), future = k > todayK;
        var t = App.total(d), lv = level(d);
        if (d && d.entries.length) { logged++; sum += t; if (App.met(d)) metDays++; }
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'cal-day l' + lv + (k === todayK ? ' today' : '') + (future ? ' future' : '');
        b.disabled = future;
        b.setAttribute('aria-pressed', String(k === selected));
        b.setAttribute('aria-label', App.longDate(dt) + (t ? ': ' + App.amt(t) + (App.met(d) ? ', target met' : '') : ': nothing logged'));
        b.innerHTML = '<span class="n">' + n + '</span>' + (t ? '<span class="v">' + App.num(t) + '</span>' : '');
        b.addEventListener('click', function () { selected = k; render(); });
        grid.appendChild(b);
      })(n);
    }
    $('m-logged').textContent = logged;
    $('m-met').textContent = metDays;
    $('m-avg').innerHTML = logged ? App.amtHTML(sum / logged) : '–';
    $('m-total').innerHTML = App.state.unit === 'oz' ? App.amtHTML(sum) : App.litres(sum);
    renderDetail();
  }

  function renderDetail() {
    var box = $('day-detail'), d = App.peek(selected), dt = App.dateFromKey(selected);
    var title = selected === App.todayKey() ? 'Today' : App.longDate(dt);
    if (!d || !d.entries.length) {
      box.innerHTML = '<h2>' + title + '</h2><p class="empty">No water logged on this day.</p>';
      return;
    }
    var t = App.total(d), p = Math.floor(t / d.target * 100);
    var html = '<h2>' + title + '</h2><p class="hint" style="margin:0 0 1rem">' + App.amt(t) + ' of ' + App.amt(d.target) +
      ' (' + p + '%) across ' + d.entries.length + (d.entries.length === 1 ? ' serving' : ' servings') +
      (App.met(d) ? '. Target met.' : '.') + '</p><ul class="log">';
    d.entries.forEach(function (e) {
      html += '<li><span class="time">' + App.timeOf(e.t) + '</span><span class="ml">' + App.amt(e.ml) + '</span></li>';
    });
    box.innerHTML = html + '</ul>';
  }

  $('prev-month').addEventListener('click', function () { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); render(); });
  $('next-month').addEventListener('click', function () { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); render(); });
  $('this-month').addEventListener('click', function () { view = new Date(now.getFullYear(), now.getMonth(), 1); selected = App.todayKey(); render(); });

  App.onChange(render);
  render();
});
