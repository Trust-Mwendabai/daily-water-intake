/* Dashboard page: stats, charts and achievements */
document.addEventListener('DOMContentLoaded', function () {
  var $ = function (id) { return document.getElementById(id); };
  var rangeDays = 7, hits = [];

  function daysHTML(n) { return n + ' <small>' + (n === 1 ? 'day' : 'days') + '</small>'; }

  function renderStats() {
    var week = App.range(7), all = App.allTime();
    $('d-streak').innerHTML = daysHTML(App.currentStreak());
    $('d-best').innerHTML = daysHTML(App.bestStreak());
    $('d-avg').innerHTML = week.avg ? App.amtHTML(week.avg) : '–';
    $('d-total').innerHTML = App.state.unit === 'oz' ? App.amtHTML(all.total) : App.litres(all.total);
  }

  function renderBar() {
    var r = App.range(rangeDays);
    var items = r.days.map(function (x) {
      return {
        label: rangeDays === 7 ? x.date.toLocaleDateString([], { weekday: 'short' }) : String(x.date.getDate()),
        value: x.total, met: x.met, key: x.key
      };
    });
    hits = App.drawBarChart($('bar-chart'), items, App.state.target, function (v) {
      var u = App.toUnit(v);
      return App.state.unit === 'oz' ? Math.round(u) : (u >= 1000 ? (Math.round(u / 100) / 10) + 'L' : Math.round(u));
    });
    $('bar-summary').textContent = r.metCount + ' of ' + rangeDays + ' days reached the target' +
      (r.best.total ? '. Best day: ' + App.amt(r.best.total) + ' on ' + r.best.date.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' }) + '.' : '.');
  }

  function renderDoughnut() {
    var sums = {};
    WaterData.periods.forEach(function (p) { sums[p.id] = 0; });
    App.range(30).days.forEach(function (x) {
      x.entries.forEach(function (e) { sums[App.periodOf(e.t).id] += e.ml; });
    });
    var total = Object.keys(sums).reduce(function (a, k) { return a + sums[k]; }, 0);
    var items = WaterData.periods.map(function (p) { return { label: p.name, value: sums[p.id], color: p.color }; });
    var top = items.reduce(function (b, x) { return x.value > b.value ? x : b; }, { value: 0 });
    App.drawDoughnut($('doughnut-chart'), items, total ? Math.round(top.value / total * 100) + '%' : '–', total ? top.label : 'No data yet');
    $('period-legend').innerHTML = WaterData.periods.map(function (p) {
      var pct = total ? Math.round(sums[p.id] / total * 100) : 0;
      return '<li><i style="background:' + p.color + '"></i><div><b>' + p.name + '</b> ' + pct + '%<span>' + p.hint + '</span></div></li>';
    }).join('');
  }

  function renderWeek() {
    var r = App.range(7);
    $('week-met').textContent = r.metCount + ' of 7 targets met';
    $('week-list').innerHTML = r.days.slice().reverse().map(function (x) {
      var pct = x.target ? Math.min(x.total / x.target * 100, 100) : 0;
      var name = x.key === App.todayKey() ? 'Today' : x.date.toLocaleDateString([], { weekday: 'long' });
      return '<li><span class="label">' + name + '</span>' +
        '<span class="bar-track' + (x.met ? ' met' : '') + '" role="img" aria-label="' + Math.round(pct) + ' percent of target"><span style="width:' + pct + '%"></span></span>' +
        '<span class="val">' + App.num(x.total) + ' / ' + App.amt(x.target) + '</span></li>';
    }).join('');
  }

  function renderAchievements() {
    var list = App.achievementProgress(), done = list.filter(function (x) { return x.done; }).length;
    $('ach-count').textContent = done + ' of ' + list.length + ' unlocked';
    $('achievements').innerHTML = list.map(function (x) {
      var a = x.def, prog = '';
      if (!x.done && a.count > 1) {
        var v = a.type === 'litres' ? Math.floor(x.value * 10) / 10 : Math.floor(x.value);
        prog = '<div class="ach-progress">' + v + ' / ' + a.count + (a.type === 'litres' ? ' L' : '') + '</div>';
      }
      return '<li class="' + (x.done ? 'done' : '') + '"><span class="ach-icon">' + App.icon(x.done ? a.icon : 'lock') + '</span>' +
        '<div><h3>' + a.title + '</h3><p>' + a.description + '</p>' + prog + '</div></li>';
    }).join('');
  }

  function renderCharts() { renderBar(); renderDoughnut(); }
  function renderAll() { renderStats(); renderCharts(); renderWeek(); renderAchievements(); }

  document.querySelectorAll('[data-range]').forEach(function (b) {
    b.addEventListener('click', function () {
      rangeDays = +b.getAttribute('data-range');
      document.querySelectorAll('[data-range]').forEach(function (x) { x.setAttribute('aria-checked', String(x === b)); });
      renderBar();
    });
  });

  // Hovering a bar shows its value as a tooltip
  var canvas = $('bar-chart');
  canvas.addEventListener('mousemove', function (e) {
    var x = e.clientX - canvas.getBoundingClientRect().left;
    var h = hits.filter(function (h) { return x >= h.x && x < h.x + h.w; })[0];
    canvas.title = h ? App.longDate(App.dateFromKey(h.item.key)) + ': ' + App.amt(h.item.value) : '';
  });

  window.addEventListener('resize', App.debounce(renderCharts, 200));
  document.addEventListener('themechange', function () { setTimeout(renderCharts, 50); });
  App.onChange(renderAll);
  renderAll();
});
