/* Daily Water Intake Tracker – shared utilities used by every page */

var App = (function () {
  'use strict';

  var KEY = 'hydration-tracker-v2';
  var D = WaterData;

  /* ---------------- Dates ---------------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function keyOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function todayKey() { return keyOf(new Date()); }
  function dateFromKey(k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(d, n) { var c = new Date(d); c.setDate(c.getDate() + n); return c; }
  function longDate(d) { return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' }); }
  function timeOf(t) { return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

  /* ---------------- State & storage ---------------- */
  function defaults() {
    return {
      target: D.DEFAULT_TARGET,
      unit: 'ml',
      theme: 'system',
      days: {},
      unlocked: [],
      reminders: { on: false, every: 60, start: '08:00', end: '21:00', enabledAt: 0, lastNotified: 0 }
    };
  }
  var state = defaults();

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (s && typeof s === 'object') {
        if (typeof s.target === 'number') state.target = s.target;
        if (s.unit === 'oz' || s.unit === 'ml') state.unit = s.unit;
        if (['system', 'light', 'dark'].indexOf(s.theme) > -1) state.theme = s.theme;
        if (s.days && typeof s.days === 'object') state.days = s.days;
        if (Array.isArray(s.unlocked)) state.unlocked = s.unlocked;
        if (s.reminders) Object.assign(state.reminders, s.reminders);
      }
    } catch (e) { /* unavailable or corrupted storage: start fresh */ }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { }
  }
  function replaceState(s) {
    var fresh = defaults();
    Object.keys(fresh).forEach(function (k) { state[k] = fresh[k]; });
    if (s) {
      if (typeof s.target === 'number') state.target = s.target;
      state.unit = s.unit === 'oz' ? 'oz' : 'ml';
      if (['system', 'light', 'dark'].indexOf(s.theme) > -1) state.theme = s.theme;
      if (s.days && typeof s.days === 'object') state.days = s.days;
      if (Array.isArray(s.unlocked)) state.unlocked = s.unlocked;
      if (s.reminders) Object.assign(state.reminders, s.reminders);
    }
    save(); applyTheme(); changed();
  }

  function day(k) {
    if (!state.days[k]) state.days[k] = { target: state.target, entries: [] };
    return state.days[k];
  }
  function peek(k) { return state.days[k] || null; }
  function total(d) { return d ? d.entries.reduce(function (a, e) { return a + e.ml; }, 0) : 0; }
  function met(d) { return !!(d && d.entries.length && total(d) >= d.target); }

  /* ---------------- Change notifications ---------------- */
  var listeners = [];
  function onChange(fn) { listeners.push(fn); }
  function changed() {
    updateNavBadge();
    listeners.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
  }

  /* ---------------- Units ---------------- */
  function toUnit(ml) { return state.unit === 'oz' ? ml / D.ML_PER_OZ : ml; }
  function fromUnit(v) { return state.unit === 'oz' ? v * D.ML_PER_OZ : v; }
  function unitLabel() { return state.unit === 'oz' ? 'fl oz' : 'ml'; }
  function num(ml) {
    var oz = state.unit === 'oz';
    var v = oz ? Math.round(toUnit(ml) * 10) / 10 : Math.round(ml);
    return v.toLocaleString('en-US', { maximumFractionDigits: oz ? 1 : 0 });
  }
  function amt(ml) { return num(ml) + ' ' + unitLabel(); }
  function amtHTML(ml) { return num(ml) + ' <small>' + unitLabel() + '</small>'; }
  function litres(ml) {
    if (state.unit === 'oz') return amt(ml);
    return (Math.round(ml / 100) / 10).toLocaleString('en-US') + ' L';
  }

  /* ---------------- Servings ---------------- */
  function addServing(ml) {
    var k = todayKey(), d = day(k), before = total(d);
    var entry = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), ml: Math.round(ml), t: Date.now() };
    d.entries.push(entry);
    save();
    var reached = before < d.target && total(d) >= d.target;
    toast(reached ? 'Goal reached! ' + amt(total(d)) + ' today.' : 'Added ' + amt(ml) + '.', 'Undo', function () {
      removeServing(k, entry.id, true);
    });
    checkAchievements();
    changed();
    return entry;
  }
  function removeServing(k, id, silent) {
    var d = peek(k); if (!d) return;
    var idx = -1;
    d.entries.forEach(function (e, i) { if (e.id === id) idx = i; });
    if (idx < 0) return;
    var removed = d.entries.splice(idx, 1)[0];
    save(); changed();
    if (!silent) toast('Removed ' + amt(removed.ml) + '.', 'Undo', function () {
      d.entries.splice(idx, 0, removed); save(); changed();
    });
  }
  function setTarget(ml) {
    state.target = Math.round(ml);
    day(todayKey()).target = state.target;  // today follows the new target; past days keep theirs
    save(); checkAchievements(); changed();
  }

  /* ---------------- Statistics ---------------- */
  function currentStreak() {
    var d = new Date(), count = 0;
    if (!met(peek(keyOf(d)))) d = addDays(d, -1); // an unfinished today doesn't break the streak
    while (met(peek(keyOf(d)))) { count++; d = addDays(d, -1); }
    return count;
  }
  function bestStreak() {
    var keys = Object.keys(state.days).filter(function (k) { return met(state.days[k]); }).sort();
    var best = 0, run = 0, prev = null;
    keys.forEach(function (k) {
      var dt = dateFromKey(k);
      run = (prev && keyOf(addDays(prev, 1)) === k) ? run + 1 : 1;
      best = Math.max(best, run);
      prev = dt;
    });
    return best;
  }
  // Summary of the last `n` days, ending today
  function range(n) {
    var list = [], today = new Date();
    for (var i = n - 1; i >= 0; i--) {
      var dt = addDays(today, -i), k = keyOf(dt), d = peek(k);
      list.push({ key: k, date: dt, total: total(d), target: d ? d.target : state.target, has: !!(d && d.entries.length), met: met(d), entries: d ? d.entries : [] });
    }
    var logged = list.filter(function (x) { return x.has; });
    return {
      days: list,
      avg: logged.length ? logged.reduce(function (a, x) { return a + x.total; }, 0) / logged.length : 0,
      metCount: list.filter(function (x) { return x.met; }).length,
      best: list.reduce(function (b, x) { return x.total > b.total ? x : b; }, { total: 0 })
    };
  }
  function allTime() {
    var t = 0, servings = 0, goalDays = 0, maxServings = 0, early = false, spread = 0;
    Object.keys(state.days).forEach(function (k) {
      var d = state.days[k], seen = {};
      t += total(d); servings += d.entries.length;
      if (met(d)) goalDays++;
      maxServings = Math.max(maxServings, d.entries.length);
      d.entries.forEach(function (e) {
        var h = new Date(e.t).getHours();
        if (h < 8 && h >= 4) early = true;
        seen[periodOf(e.t).id] = true;
      });
      spread = Math.max(spread, ['morning', 'afternoon', 'evening'].filter(function (p) { return seen[p]; }).length);
    });
    return { total: t, servings: servings, goalDays: goalDays, maxServings: maxServings, earlyBird: early ? 1 : 0, spread: spread };
  }
  function periodOf(t) {
    var h = new Date(t).getHours(); if (h < 5) h += 24;
    for (var i = 0; i < D.periods.length; i++) {
      if (h >= D.periods[i].from && h < D.periods[i].to) return D.periods[i];
    }
    return D.periods[3];
  }

  /* ---------------- Achievements ---------------- */
  function achievementProgress() {
    var a = allTime(), best = bestStreak();
    var values = {
      servings: a.servings, goalDays: a.goalDays, maxServings: a.maxServings, earlyBird: a.earlyBird,
      spread: a.spread, streak: best, litres: a.total / 1000
    };
    return D.achievements.map(function (x) {
      var v = values[x.type] || 0;
      return { def: x, value: v, done: v >= x.count || state.unlocked.indexOf(x.id) > -1 };
    });
  }
  function checkAchievements() {
    achievementProgress().forEach(function (p) {
      if (p.done && state.unlocked.indexOf(p.def.id) < 0) {
        state.unlocked.push(p.def.id);
        save();
        setTimeout(function () { toast('Achievement unlocked: ' + p.def.title); }, 1600);
      }
    });
  }

  /* ---------------- Icons (inline SVG) ---------------- */
  var ICON_PATHS = {
    drop: '<path d="M12 3c3.5 4.6 6 8 6 11a6 6 0 0 1-12 0c0-3 2.5-6.4 6-11z"/>',
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    glass: '<path d="M5 3h14l-2 18H7z"/><path d="M6 9h12"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    settings: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    flame: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 2 1.3 3 2.5 3 0-3-1-5.5 0-8z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    left: '<path d="M15 5l-7 7 7 7"/>',
    right: '<path d="M9 5l7 7-7 7"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6v4H9z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    award: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14l-1.5 7 5-3 5 3-1.5-7"/>',
    crown: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'
  };
  function icon(name) {
    return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' + (ICON_PATHS[name] || ICON_PATHS.drop) + '</svg>';
  }
  function renderIcons(root) {
    (root || document).querySelectorAll('[data-icon]').forEach(function (el) {
      el.innerHTML = icon(el.getAttribute('data-icon'));
    });
  }

  /* ---------------- Theme ---------------- */
  function effectiveTheme() {
    if (state.theme !== 'system') return state.theme;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function applyTheme() {
    if (state.theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', state.theme);
    var btn = document.querySelector('.theme-toggle');
    if (btn) {
      var dark = effectiveTheme() === 'dark';
      btn.innerHTML = icon(dark ? 'sun' : 'moon');
      btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    }
    document.dispatchEvent(new Event('themechange'));
  }
  function setTheme(t) { state.theme = t; save(); applyTheme(); }

  /* ---------------- Toast ---------------- */
  var toastEl = null, toastTimer = null;
  function toast(msg, label, action) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite');
      toastEl.innerHTML = '<span></span><button type="button" hidden></button>';
      document.body.appendChild(toastEl);
    }
    var b = toastEl.querySelector('button');
    toastEl.querySelector('span').textContent = msg;
    if (action) {
      b.hidden = false; b.textContent = label || 'Undo';
      b.onclick = function () { action(); toastEl.classList.remove('show'); };
    } else { b.hidden = true; b.onclick = null; }
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 5000);
  }

  /* ---------------- Navbar ---------------- */
  function updateNavBadge() {
    var b = document.querySelector('.streak-badge');
    if (b) {
      var s = currentStreak();
      b.innerHTML = icon('flame') + '<b>' + s + '</b><span>' + (s === 1 ? ' day' : ' days') + '</span>';
      b.title = 'Current streak: ' + s + (s === 1 ? ' day' : ' days') + ' reaching your target';
    }
  }
  function initNav() {
    var page = document.body.getAttribute('data-page');
    document.querySelectorAll('.nav-links a').forEach(function (a) {
      if (a.getAttribute('data-page') === page) a.setAttribute('aria-current', 'page');
    });
    var toggle = document.querySelector('.theme-toggle');
    if (toggle) toggle.addEventListener('click', function () {
      setTheme(effectiveTheme() === 'dark' ? 'light' : 'dark');
    });
    var burger = document.querySelector('.hamburger'), links = document.querySelector('.nav-links');
    if (burger && links) {
      burger.innerHTML = icon('menu');
      burger.addEventListener('click', function () {
        var open = links.classList.toggle('open');
        burger.setAttribute('aria-expanded', String(open));
        burger.innerHTML = icon(open ? 'close' : 'menu');
      });
    }
    var year = document.getElementById('year');
    if (year) year.textContent = new Date().getFullYear();
    updateNavBadge();
  }

  /* ---------------- Reminders (run on every page) ---------------- */
  function toMinutes(hhmm) { var p = (hhmm || '00:00').split(':'); return +p[0] * 60 + +p[1]; }
  function inActiveHours(d) {
    var R = state.reminders, m = d.getHours() * 60 + d.getMinutes(), s = toMinutes(R.start), e = toMinutes(R.end);
    return s <= e ? (m >= s && m < e) : (m >= s || m < e);
  }
  function nextReminder() {
    var R = state.reminders, d = peek(todayKey());
    var last = d && d.entries.length ? d.entries[d.entries.length - 1].t : 0;
    return Math.max(last, R.enabledAt, R.lastNotified) + R.every * 60000;
  }
  function notify(title, body) {
    var shown = false;
    try {
      if ('Notification' in window && Notification.permission === 'granted') { new Notification(title, { body: body }); shown = true; }
    } catch (e) { }
    toast(shown ? title : title + ' ' + body);
  }
  function remindNow() {
    var d = day(todayKey());
    notify('Time for some water.', amt(Math.max(d.target - total(d), 0)) + ' to go today.');
  }
  function checkReminder() {
    var R = state.reminders, now = new Date();
    if (!R.on || !inActiveHours(now) || now.getTime() < nextReminder()) return;
    R.lastNotified = now.getTime(); save();
    var d = day(todayKey());
    if (total(d) < d.target) remindNow();
  }

  /* ---------------- Day rollover ---------------- */
  var lastKey = todayKey();
  function tick() {
    if (todayKey() !== lastKey) { lastKey = todayKey(); day(lastKey); save(); changed(); }
    checkReminder();
  }

  /* ---------------- Carafe visual ---------------- */
  var EMPTY_Y = 300, FULL_Y = 52, uid = 0;
  function Carafe(container, opts) {
    opts = opts || {};
    var id = 'carafe-clip-' + (++uid);
    var inner = 'M77 14 h46 v36 c0 18 55 30 55 70 v158 a20 20 0 0 1 -20 20 h-116 a20 20 0 0 1 -20 -20 v-158 c0 -40 55 -52 55 -70 z';
    var outer = 'M75 12 h50 v38 c0 18 55 30 55 70 v160 a20 20 0 0 1 -20 20 h-120 a20 20 0 0 1 -20 -20 v-160 c0 -40 55 -52 55 -70 z';
    container.innerHTML =
      '<svg class="carafe" viewBox="' + (opts.ticks ? '-30 -10 260 330' : '0 0 200 330') + '" role="img" aria-label="Water carafe showing today\'s progress">' +
      '<defs><clipPath id="' + id + '"><path d="' + inner + '"/></clipPath></defs>' +
      '<path class="glass" d="' + outer + '"/>' +
      '<g clip-path="url(#' + id + ')"><g class="level" style="transform:translateY(' + EMPTY_Y + 'px)">' +
      '<path class="wave back" d="M-50 4 Q-25 -4 0 4 T50 4 T100 4 T150 4 T200 4 T250 4 T300 4 T350 4 V420 H-50 Z"/>' +
      '<path class="wave front" d="M-50 0 Q-25 -8 0 0 T50 0 T100 0 T150 0 T200 0 T250 0 T300 0 T350 0 V420 H-50 Z"/>' +
      '</g><circle class="drop" cx="100" cy="30" r="6"/></g>' +
      '<path class="rim" d="M68 12 h64"/><path class="shine" d="M38 150 v100"/><g class="ticks"></g></svg>';
    var svg = container.querySelector('svg'), level = svg.querySelector('.level'), drop = svg.querySelector('.drop');
    var surface = EMPTY_Y;
    return {
      set: function (fraction, target) {
        var f = Math.max(0, Math.min(fraction, 1));
        surface = EMPTY_Y - f * (EMPTY_Y - FULL_Y);
        level.style.transform = 'translateY(' + surface + 'px)';
        svg.classList.toggle('full', fraction >= 1);
        if (opts.ticks && target) {
          var g = svg.querySelector('.ticks'), html = '';
          [0.25, 0.5, 0.75, 1].forEach(function (p) {
            var y = EMPTY_Y - p * (EMPTY_Y - FULL_Y), x = y < 60 ? 135 : 186;
            html += '<line class="tick" x1="' + x + '" x2="' + (x + 10) + '" y1="' + y + '" y2="' + y + '"/>' +
              '<text class="tick-label" x="' + (x + 14) + '" y="' + (y + 3.5) + '">' + num(target * p) + '</text>';
          });
          g.innerHTML = html;
        }
      },
      drop: function () {
        drop.style.setProperty('--to', 'translateY(' + Math.max(surface - 30, 0) + 'px)');
        drop.classList.remove('fall'); void drop.getBoundingClientRect(); drop.classList.add('fall');
      }
    };
  }

  /* ---------------- Canvas charts ---------------- */
  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function setupCanvas(canvas) {
    var ratio = window.devicePixelRatio || 1, rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, rect.width * ratio); canvas.height = Math.max(1, rect.height * ratio);
    var ctx = canvas.getContext('2d'); ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { ctx: ctx, w: rect.width, h: rect.height };
  }
  function roundRectTop(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h);
    ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y); ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h); ctx.closePath();
  }
  // items: [{label, value, met, selected}], target: number for a dashed line
  function drawBarChart(canvas, items, target, formatValue) {
    var c = setupCanvas(canvas), ctx = c.ctx, w = c.w, h = c.h;
    var pad = { top: 22, right: 8, bottom: 26, left: 44 };
    var cw = w - pad.left - pad.right, ch = h - pad.top - pad.bottom;
    var max = Math.max(target || 0, items.reduce(function (m, x) { return Math.max(m, x.value); }, 0)) * 1.12 || 1;
    var ink = cssVar('--ink'), muted = cssVar('--muted'), line = cssVar('--line');
    ctx.clearRect(0, 0, w, h);
    ctx.font = '11px ' + getComputedStyle(document.body).fontFamily;

    ctx.strokeStyle = line; ctx.fillStyle = muted; ctx.lineWidth = 1; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (var i = 0; i <= 4; i++) {
      var y = pad.top + ch - ch * i / 4;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
      ctx.fillText(formatValue(max * i / 4), pad.left - 6, y);
    }
    var slot = cw / items.length, bw = Math.max(3, slot * (items.length > 14 ? 0.7 : 0.58));
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    var every = items.length > 14 ? 5 : 1;
    items.forEach(function (x, i) {
      var bh = x.value / max * ch, bx = pad.left + slot * i + (slot - bw) / 2, by = pad.top + ch - bh;
      ctx.fillStyle = x.selected ? cssVar('--sun') : (x.met ? cssVar('--water-deep') : cssVar('--water'));
      if (bh > 0) { roundRectTop(ctx, bx, by, bw, bh, 5); ctx.fill(); }
      if ((items.length - 1 - i) % every === 0) { ctx.fillStyle = muted; ctx.fillText(x.label, bx + bw / 2, pad.top + ch + 7); }
    });
    ctx.strokeStyle = ink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(pad.left, pad.top + ch); ctx.lineTo(w - pad.right, pad.top + ch); ctx.stroke();
    if (target) {
      var ty = pad.top + ch - target / max * ch;
      ctx.setLineDash([6, 5]); ctx.strokeStyle = muted; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(pad.left, ty); ctx.lineTo(w - pad.right, ty); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = muted; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillText('Target', w - pad.right, ty - 3);
    }
    // Return bar hit areas so pages can make bars clickable
    return items.map(function (x, i) { return { x: pad.left + slot * i, w: slot, item: x }; });
  }
  // items: [{label, value, color}]
  function drawDoughnut(canvas, items, centerText, centerSub) {
    var c = setupCanvas(canvas), ctx = c.ctx, w = c.w, h = c.h;
    var r = Math.min(w, h) / 2 - 6, cx = w / 2, cy = h / 2, thick = r * 0.34;
    var sum = items.reduce(function (a, x) { return a + x.value; }, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = thick;
    if (!sum) {
      ctx.strokeStyle = cssVar('--line');
      ctx.beginPath(); ctx.arc(cx, cy, r - thick / 2, 0, Math.PI * 2); ctx.stroke();
    } else {
      var a = -Math.PI / 2;
      items.forEach(function (x) {
        if (!x.value) return;
        var span = x.value / sum * Math.PI * 2;
        ctx.strokeStyle = x.color;
        ctx.beginPath(); ctx.arc(cx, cy, r - thick / 2, a, a + span - (items.length > 1 ? 0.025 : 0)); ctx.stroke();
        a += span;
      });
    }
    var font = getComputedStyle(document.body).fontFamily;
    ctx.fillStyle = cssVar('--ink'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 ' + Math.round(r * 0.3) + 'px ' + font; ctx.fillText(centerText, cx, cy - r * 0.08);
    ctx.fillStyle = cssVar('--muted'); ctx.font = Math.round(Math.max(11, r * 0.12)) + 'px ' + font;
    ctx.fillText(centerSub, cx, cy + r * 0.2);
  }

  /* ---------------- Utilities ---------------- */
  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }
  function escapeHTML(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ---------------- Start-up ---------------- */
  load();
  applyTheme();
  day(todayKey());
  document.addEventListener('DOMContentLoaded', function () {
    renderIcons();
    initNav();
    applyTheme();
    checkAchievements();
    tick();
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });
  window.addEventListener('storage', function (e) { if (e.key === KEY) { load(); changed(); } });
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onMq = function () { if (state.theme === 'system') applyTheme(); };
    if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
  }
  setInterval(tick, 30000);

  return {
    KEY: KEY, state: state, save: save, replaceState: replaceState, onChange: onChange, changed: changed,
    keyOf: keyOf, todayKey: todayKey, dateFromKey: dateFromKey, addDays: addDays, longDate: longDate, timeOf: timeOf,
    day: day, peek: peek, total: total, met: met,
    toUnit: toUnit, fromUnit: fromUnit, unitLabel: unitLabel, num: num, amt: amt, amtHTML: amtHTML, litres: litres,
    addServing: addServing, removeServing: removeServing, setTarget: setTarget,
    currentStreak: currentStreak, bestStreak: bestStreak, range: range, allTime: allTime, periodOf: periodOf,
    achievementProgress: achievementProgress,
    icon: icon, renderIcons: renderIcons, setTheme: setTheme, toast: toast,
    inActiveHours: inActiveHours, nextReminder: nextReminder, remindNow: remindNow,
    Carafe: Carafe, drawBarChart: drawBarChart, drawDoughnut: drawDoughnut,
    debounce: debounce, escapeHTML: escapeHTML
  };
})();
