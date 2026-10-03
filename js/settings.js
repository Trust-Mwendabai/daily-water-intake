/* Settings page: target, calculator, units, theme, reminders, data */
document.addEventListener('DOMContentLoaded', function () {
  var $ = function (id) { return document.getElementById(id); };
  var D = WaterData, calcValue = 0;

  function setSeg(id, value) {
    document.querySelectorAll('#' + id + ' button').forEach(function (b) {
      b.setAttribute('aria-checked', String(b.getAttribute('data-value') === value));
    });
  }

  function render() {
    var s = App.state;
    $('target-amt').value = Math.round(App.toUnit(s.target));
    $('target-amt').step = s.unit === 'oz' ? '1' : '50';
    document.querySelectorAll('[data-unit]').forEach(function (el) { el.textContent = App.unitLabel(); });
    if (!$('target-hint').classList.contains('err') && !$('target-hint').dataset.saved) {
      $('target-hint').textContent = 'Allowed range: ' + App.amt(D.MIN_TARGET) + ' to ' + App.amt(D.MAX_TARGET) + '.';
    }
    setSeg('unit-seg', s.unit);
    setSeg('theme-seg', s.theme);
    if (calcValue) $('calc-value').innerHTML = 'Suggested target: <strong>' + App.amt(calcValue) + ' a day</strong>';
    renderReminders();
  }

  /* ----- Target ----- */
  function saved(msg) {
    var h = $('target-hint');
    h.className = 'hint'; h.textContent = msg; h.dataset.saved = '1';
    setTimeout(function () { delete h.dataset.saved; }, 4000);
  }
  $('target-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var raw = parseFloat($('target-amt').value), ml = App.fromUnit(raw), h = $('target-hint');
    if (!raw || ml < D.MIN_TARGET - 1 || ml > D.MAX_TARGET + 1) {
      h.textContent = 'Set a target between ' + App.amt(D.MIN_TARGET) + ' and ' + App.amt(D.MAX_TARGET) + '.';
      h.className = 'hint err'; return;
    }
    App.setTarget(ml);
    saved('Target saved: ' + App.amt(App.state.target) + ' a day.');
    App.toast('Daily target set to ' + App.amt(App.state.target) + '.');
  });

  /* ----- Calculator ----- */
  $('calc-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var w = parseFloat($('c-weight').value), ex = parseFloat($('c-exercise').value) || 0;
    $('calc-result').hidden = false;
    if (!w || w < 20 || w > 250) {
      calcValue = 0;
      $('calc-value').textContent = 'Enter a body weight between 20 and 250 kg.';
      $('calc-use').hidden = true; return;
    }
    // About 33 ml per kg, plus ~350 ml per 30 minutes of exercise, plus 500 ml in hot weather
    var ml = w * 33 + (Math.max(0, Math.min(ex, 600)) / 30) * 350 + ($('c-hot').checked ? 500 : 0);
    calcValue = Math.min(D.MAX_TARGET, Math.max(D.MIN_TARGET, Math.round(ml / 50) * 50));
    $('calc-value').innerHTML = 'Suggested target: <strong>' + App.amt(calcValue) + ' a day</strong>';
    $('calc-use').hidden = false;
  });
  $('calc-use').addEventListener('click', function () {
    if (!calcValue) return;
    App.setTarget(calcValue);
    saved('Target saved: ' + App.amt(App.state.target) + ' a day.');
    App.toast('Daily target set to ' + App.amt(App.state.target) + '.');
  });

  /* ----- Units & theme ----- */
  document.querySelectorAll('#unit-seg button').forEach(function (b) {
    b.addEventListener('click', function () { App.state.unit = b.getAttribute('data-value'); App.save(); App.changed(); });
  });
  document.querySelectorAll('#theme-seg button').forEach(function (b) {
    b.addEventListener('click', function () { App.setTheme(b.getAttribute('data-value')); setSeg('theme-seg', App.state.theme); });
  });

  /* ----- Reminders ----- */
  function renderReminders() {
    var R = App.state.reminders, st = $('rem-status');
    $('rem-on').checked = R.on;
    $('rem-every').value = String(R.every);
    $('rem-start').value = R.start;
    $('rem-end').value = R.end;
    if (!R.on) { st.textContent = 'Off'; return; }
    var txt = App.inActiveHours(new Date())
      ? 'On. Next reminder around ' + App.timeOf(App.nextReminder()) + " if you haven't logged water."
      : 'On. Paused outside active hours.';
    if ('Notification' in window && Notification.permission === 'denied') txt += ' Notifications are blocked, so reminders show on the page only.';
    st.textContent = txt;
  }
  $('rem-on').addEventListener('change', function () {
    var R = App.state.reminders;
    R.on = this.checked;
    if (R.on) {
      R.enabledAt = Date.now(); R.lastNotified = 0;
      try {
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().then(renderReminders, renderReminders);
        }
      } catch (e) { }
    }
    App.save(); renderReminders();
  });
  $('rem-every').addEventListener('change', function () { App.state.reminders.every = +this.value; App.save(); renderReminders(); });
  $('rem-start').addEventListener('change', function () { if (this.value) { App.state.reminders.start = this.value; App.save(); renderReminders(); } });
  $('rem-end').addEventListener('change', function () { if (this.value) { App.state.reminders.end = this.value; App.save(); renderReminders(); } });
  $('rem-test').addEventListener('click', App.remindNow);
  setInterval(renderReminders, 30000);

  /* ----- Data ----- */
  function dataHint(msg, err) { $('data-hint').className = 'hint' + (err ? ' err' : ''); $('data-hint').textContent = msg; }

  $('export-btn').addEventListener('click', function () {
    try {
      var blob = new Blob([JSON.stringify(App.state, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'water-tracker-' + App.todayKey() + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      dataHint('Backup downloaded.');
    } catch (e) { dataHint('This browser blocked the download.', true); }
  });

  $('import-file').addEventListener('change', function () {
    var f = this.files && this.files[0], input = this;
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var s = JSON.parse(r.result);
        if (!s || typeof s !== 'object' || typeof s.days !== 'object' || typeof s.target !== 'number') throw new Error('bad');
        App.replaceState(s);
        dataHint('Data imported: ' + Object.keys(s.days).length + ' days of history.');
      } catch (e) {
        dataHint("That file isn't a backup from this site. Choose a .json file made with Export data.", true);
      }
      input.value = '';
    };
    r.readAsText(f);
  });

  var armed = null;
  function disarm() { clearTimeout(armed); armed = null; $('clear-btn').textContent = 'Delete all data'; $('clear-btn').className = 'btn ghost danger'; }
  $('clear-btn').addEventListener('click', function () {
    if (!armed) {
      $('clear-btn').textContent = 'Tap again to delete everything'; $('clear-btn').className = 'btn warn';
      dataHint('This deletes your target, history, achievements and settings from this browser.', true);
      armed = setTimeout(function () { disarm(); dataHint(''); }, 5000);
      return;
    }
    disarm();
    try { localStorage.removeItem(App.KEY); } catch (e) { }
    App.replaceState(null);
    dataHint('All data deleted.');
  });

  App.onChange(render);
  render();
});
