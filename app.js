/* Farhanah's Green Days — app.js (vanilla JS, no build step) */
(function () {
  'use strict';

  var VERSION = '1.0.0';
  var DATA_KEY = 'fgd-data';
  var SETTINGS_KEY = 'fgd-settings';
  var MILESTONES = {
    3: "3 green days! Great start, Farhanah 🌱",
    7: "A whole week! Proud of you 🌸",
    14: "Two weeks strong 💪",
    30: "30 days! You're amazing ✨",
    60: "60 days. Unstoppable 🌿",
    100: "100 green days! Legend 🏆"
  };
  var STATUS_TEXT = {
    green: { title: 'Green day', msg: 'No added sugar today. Well done! 💚', icon: '✓' },
    yellow: { title: 'Yellow day', msg: 'A little sugar. Still a good day 🙂', icon: '~' },
    red: { title: 'Red day', msg: "That's okay. Tomorrow is a fresh start 🌱", icon: '·' },
    none: { title: 'Not logged yet', msg: 'Tick what you had, or just tap Save if it was a perfect day.', icon: '' }
  };
  var DEFAULT_SETTINGS = { theme: 'auto', waterGoal: 8, remind: false, remindTime: '21:00', welcomed: false };
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var MON_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  /* ---------- storage (always guarded) ---------- */
  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var v = JSON.parse(raw);
      return v && typeof v === 'object' ? v : fallback;
    } catch (e) { return fallback; }
  }
  function store(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { toast('Could not save — storage is full or blocked'); return false; }
  }

  /* ---------- local-date helpers (never UTC) ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function keyOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseKey(k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(k, n) { var d = parseKey(k); d.setDate(d.getDate() + n); return keyOf(d); }
  function todayKey() { return keyOf(new Date()); }
  function mondayOf(k) { var d = parseKey(k); var off = (d.getDay() + 6) % 7; d.setDate(d.getDate() - off); return keyOf(d); }
  function shortDate(k) { var d = parseKey(k); return MON_SHORT[d.getMonth()] + ' ' + d.getDate(); }
  function isValidKey(k) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return false;
    return keyOf(parseKey(k)) === k;
  }

  /* ---------- state ---------- */
  var data = load(DATA_KEY, {});
  var settings = Object.assign({}, DEFAULT_SETTINGS, load(SETTINGS_KEY, {}));
  var state = {
    today: todayKey(),
    view: todayKey(),
    tab: 'today',
    month: null,          // first-of-month key
    week: null,           // monday key
    lastStatus: null,
    celebrated: {},       // milestone@streakStart shown this session
    notifiedFor: null
  };
  state.month = state.today.slice(0, 8) + '01';
  state.week = mondayOf(state.today);

  function saveData() { return store(DATA_KEY, data); }
  function saveSettings() { return store(SETTINGS_KEY, settings); }

  function blankEntry() {
    return { sugaryDrink: false, sweetFood: false, processed: false, veggiesFruit: false, water: 0, craving: 'none', mood: null, notes: '' };
  }
  function statusOf(e) {
    if (!e) return 'none';
    var n = (e.sugaryDrink ? 1 : 0) + (e.sweetFood ? 1 : 0);
    return n === 0 ? 'green' : n === 1 ? 'yellow' : 'red';
  }

  /* ---------- streaks ---------- */
  function currentStreak() {
    var k = state.today;
    if (data[k]) { if (statusOf(data[k]) !== 'green') return 0; }
    else k = addDays(k, -1);
    var n = 0;
    while (data[k] && statusOf(data[k]) === 'green') { n++; k = addDays(k, -1); }
    return n;
  }
  function streakStart() {
    var k = data[state.today] ? state.today : addDays(state.today, -1);
    while (data[addDays(k, -1)] && statusOf(data[addDays(k, -1)]) === 'green') k = addDays(k, -1);
    return k;
  }
  function bestStreak() {
    var keys = Object.keys(data).sort(), best = 0, run = 0, prev = null;
    keys.forEach(function (k) {
      if (statusOf(data[k]) === 'green') {
        run = (prev && addDays(prev, 1) === k) ? run + 1 : 1;
        prev = k;
        if (run > best) best = run;
      } else { run = 0; prev = null; }
    });
    return best;
  }

  /* ---------- DOM helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function stat(k, v, tag) {
    return '<div class="stat"><div class="k">' + (tag ? '<i class="tag" style="background:var(--' + tag + ')"></i>' : '') + k + '</div><div class="v">' + v + '</div></div>';
  }

  var toastTimer;
  function toast(text, ms, big) {
    var t = $('toast');
    if (!t) return;
    t.textContent = text;
    t.classList.toggle('big', !!big);
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, ms || 2200);
  }

  /* ---------- theme ---------- */
  function applyTheme() {
    var root = document.documentElement;
    if (settings.theme === 'light' || settings.theme === 'dark') root.setAttribute('data-theme', settings.theme);
    else root.removeAttribute('data-theme');
    var dark = settings.theme === 'dark' || (settings.theme === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    $('meta-theme').setAttribute('content', dark ? '#000000' : '#f2f2f7');
  }

  /* ---------- tabs ---------- */
  var TABS = ['today', 'calendar', 'summary', 'settings'];
  function showTab(tab, noHash) {
    if (TABS.indexOf(tab) < 0) tab = 'today';
    state.tab = tab;
    document.querySelectorAll('.view').forEach(function (v) { v.classList.toggle('active', v.dataset.view === tab); });
    document.querySelectorAll('.tabbar button').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === tab); });
    if (!noHash && location.hash !== '#' + tab) { try { history.replaceState(null, '', '#' + tab); } catch (e) { } }
    render();
    window.scrollTo(0, 0);
  }

  /* ---------- TODAY ---------- */
  function greeting() {
    var h = new Date().getHours();
    if (h < 12) return 'Good morning, Farhanah ☀️';
    if (h < 18) return 'Good afternoon, Farhanah 🌤️';
    return 'Good evening, Farhanah 🌙';
  }
  function reminderDue() {
    if (!settings.remind || data[state.today]) return false;
    var now = new Date(), p = (settings.remindTime || '21:00').split(':');
    return now.getHours() * 60 + now.getMinutes() >= (+p[0]) * 60 + (+p[1] || 0);
  }

  function renderToday() {
    var k = state.view, d = parseKey(k), e = data[k] || blankEntry(), logged = !!data[k];
    $('day-label').textContent = DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate();
    $('day-next').disabled = k >= state.today;
    $('greeting').textContent = greeting();
    $('day-title').textContent = k === state.today ? 'Today' : k === addDays(state.today, -1) ? 'Yesterday' : 'Past Day';
    $('streak-chip').textContent = '🔥 ' + currentStreak();
    $('reminder-banner').hidden = !(k === state.today && reminderDue());

    var s = statusOf(logged ? e : null), card = $('status-card');
    card.className = 'card status-card ' + s;
    $('status-dot').textContent = STATUS_TEXT[s].icon;
    $('status-title').textContent = STATUS_TEXT[s].title;
    $('status-msg').textContent = STATUS_TEXT[s].msg;
    var popKey = k + ':' + s;
    if (state.lastStatus && state.lastStatus !== popKey && state.lastStatus.split(':')[0] === k) {
      var dot = $('status-dot');
      dot.classList.remove('pop'); void dot.offsetWidth; dot.classList.add('pop');
    }
    state.lastStatus = popKey;

    document.querySelectorAll('#view-today .switch').forEach(function (sw) { sw.checked = !!e[sw.dataset.field]; });
    var goal = settings.waterGoal;
    $('water-count').textContent = e.water;
    $('water-goal').textContent = goal;
    $('water-minus').disabled = e.water <= 0;
    var bar = $('water-bar');
    bar.style.width = Math.min(100, (e.water / goal) * 100) + '%';
    bar.classList.toggle('done', e.water >= goal);
    setSeg('seg-craving', e.craving);
    setSeg('seg-mood', e.mood);
    var notes = $('notes');
    if (document.activeElement !== notes) notes.value = e.notes || '';

    var btn = $('save-btn');
    btn.textContent = logged ? 'Saved ✓' : (k === state.today ? 'Save today' : 'Save this day');
    btn.classList.toggle('saved', logged);
  }
  function setSeg(id, val) {
    document.querySelectorAll('#' + id + ' button').forEach(function (b) { b.classList.toggle('on', b.dataset.value === val); });
  }

  // Apply a change to the day being viewed and auto-save
  function update(fn) {
    var before = currentStreak();
    var e = data[state.view] ? Object.assign(blankEntry(), data[state.view]) : blankEntry();
    fn(e);
    data[state.view] = e;
    saveData();
    afterSave(before);
  }
  function afterSave(before) {
    var after = currentStreak();
    if (after > before && MILESTONES[after]) {
      var tag = after + '@' + streakStart();
      if (!state.celebrated[tag]) {
        state.celebrated[tag] = true;
        setTimeout(function () { toast(MILESTONES[after], 4500, true); }, 250);
      }
    }
    render();
  }

  /* ---------- CALENDAR ---------- */
  function renderCalendar() {
    var first = parseKey(state.month), y = first.getFullYear(), m = first.getMonth();
    $('month-label').textContent = MONTHS[m] + ' ' + y;
    $('month-next').disabled = state.month >= state.today.slice(0, 8) + '01';
    var grid = $('cal-grid');
    grid.innerHTML = '';
    var lead = (first.getDay() + 6) % 7;
    for (var i = 0; i < lead; i++) grid.appendChild(el('span'));
    var days = new Date(y, m + 1, 0).getDate(), counts = { green: 0, yellow: 0, red: 0 };
    for (var dnum = 1; dnum <= days; dnum++) {
      var k = keyOf(new Date(y, m, dnum)), s = statusOf(data[k]);
      var b = el('button', 'cal-day' + (s !== 'none' ? ' ' + s : '') + (k === state.today ? ' today' : '') + (k === state.view ? ' selected' : ''), String(dnum));
      b.dataset.key = k;
      b.setAttribute('aria-label', shortDate(k) + (s !== 'none' ? ', ' + s : ''));
      if (k > state.today) b.disabled = true;
      if (counts[s] != null) counts[s]++;
      grid.appendChild(b);
    }
    $('month-stats').innerHTML = stat('Green', counts.green, 'green') + stat('Yellow', counts.yellow, 'yellow') + stat('Red', counts.red, 'red');
  }

  /* ---------- SUMMARY ---------- */
  function renderSummary() {
    var mon = state.week, sun = addDays(mon, 6), thisMon = mondayOf(state.today);
    var prefix = mon === thisMon ? 'This week · ' : mon === addDays(thisMon, -7) ? 'Last week · ' : '';
    $('week-label').textContent = prefix + shortDate(mon) + ' – ' + shortDate(sun);
    $('week-next').disabled = mon >= thisMon;

    var dots = $('week-dots'), letters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    var green = 0, waterSum = 0, logged = 0, resisted = 0, cravings = 0, veg = 0;
    dots.innerHTML = '';
    for (var i = 0; i < 7; i++) {
      var k = addDays(mon, i), e = data[k], s = statusOf(e);
      var cls = 'dot' + (s !== 'none' ? ' ' + s : '') + (k > state.today ? ' future' : '') + (k === state.today ? ' is-today' : '');
      var wd = el('div', 'wd', '<span class="' + cls + '" title="' + shortDate(k) + '"></span><span>' + letters[i] + '</span>');
      dots.appendChild(wd);
      if (e) {
        logged++; waterSum += e.water || 0;
        if (s === 'green') green++;
        if (e.craving === 'resisted') { resisted++; cravings++; }
        if (e.craving === 'gaveIn') cravings++;
        if (e.veggiesFruit) veg++;
      }
    }
    var avg = logged ? (Math.round(waterSum / logged * 10) / 10) : 0;
    $('week-stats').innerHTML =
      stat('Green days', green + ' <small>/ 7</small>', 'green') +
      stat('Avg. water', avg + ' <small>glasses</small>') +
      stat('Cravings resisted', resisted + ' <small>/ ' + cravings + '</small>') +
      stat('Veggies / fruit', veg + ' <small>' + (veg === 1 ? 'day' : 'days') + '</small>');

    $('chart').innerHTML = chartSVG();

    var total = 0, keys = Object.keys(data);
    keys.forEach(function (k) { if (statusOf(data[k]) === 'green') total++; });
    var cur = currentStreak();
    $('all-stats').innerHTML =
      stat('Current streak', cur + ' <small>' + (cur === 1 ? 'day' : 'days') + '</small>') +
      stat('Best streak', bestStreak() + ' <small>days</small>') +
      stat('Total green days', total, 'green') +
      stat('Days logged', keys.length);
  }

  function chartSVG() {
    var W = 320, H = 150, top = 12, bottom = 22, left = 2, right = 30, n = 30;
    var goal = settings.waterGoal, max = goal;
    var days = [];
    for (var i = n - 1; i >= 0; i--) {
      var k = addDays(state.today, -i), e = data[k];
      days.push({ k: k, e: e });
      if (e && e.water > max) max = e.water;
    }
    max = Math.max(max + 1, 4);
    var ph = H - top - bottom, slot = (W - left - right) / n, bw = Math.max(3, slot * 0.62);
    var y = function (v) { return top + ph - (v / max) * ph; };
    var out = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Water and status for the last 30 days">';
    out += '<line x1="' + left + '" x2="' + (W - right) + '" y1="' + (top + ph) + '" y2="' + (top + ph) + '" stroke="var(--sep)" stroke-width="1"/>';
    days.forEach(function (d, idx) {
      var x = left + idx * slot + (slot - bw) / 2, s = statusOf(d.e);
      if (!d.e) {
        out += '<rect x="' + x.toFixed(1) + '" y="' + (top + ph - 3) + '" width="' + bw.toFixed(1) + '" height="3" rx="1.5" fill="var(--none)"><title>' + shortDate(d.k) + ': not logged</title></rect>';
      } else {
        var h = Math.max(4, (d.e.water / max) * ph);
        out += '<rect x="' + x.toFixed(1) + '" y="' + (top + ph - h).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="' + Math.min(3, bw / 2).toFixed(1) + '" fill="var(--' + s + ')"><title>' + shortDate(d.k) + ': ' + d.e.water + ' glasses, ' + s + '</title></rect>';
      }
      if (idx === 0 || idx === 14 || idx === n - 1) {
        out += '<text x="' + (left + idx * slot + slot / 2).toFixed(1) + '" y="' + (H - 6) + '" font-size="10" fill="var(--text-2)" text-anchor="' + (idx === 0 ? 'start' : idx === n - 1 ? 'end' : 'middle') + '" font-family="inherit">' + (idx === n - 1 ? 'Today' : shortDate(d.k)) + '</text>';
      }
    });
    var gy = y(goal).toFixed(1);
    out += '<line x1="' + left + '" x2="' + (W - right) + '" y1="' + gy + '" y2="' + gy + '" stroke="var(--accent)" stroke-width="1.2" stroke-dasharray="4 3" opacity="0.8"/>';
    out += '<text x="' + (W - 1) + '" y="' + (+gy + 3.5) + '" font-size="10" fill="var(--accent)" text-anchor="end" font-family="inherit">Goal ' + goal + '</text>';
    return out + '</svg>';
  }

  /* ---------- SETTINGS ---------- */
  function renderSettings() {
    setSeg('seg-theme', settings.theme);
    $('goal-text').textContent = settings.waterGoal + (settings.waterGoal === 1 ? ' glass' : ' glasses');
    $('goal-minus').disabled = settings.waterGoal <= 1;
    $('goal-plus').disabled = settings.waterGoal >= 20;
    $('remind-toggle').checked = !!settings.remind;
    $('remind-time').value = settings.remindTime;
    $('remind-time-row').classList.toggle('off', !settings.remind);
    $('version-text').textContent = 'Version ' + VERSION;
  }

  function render() {
    if (state.tab === 'today') renderToday();
    else if (state.tab === 'calendar') renderCalendar();
    else if (state.tab === 'summary') renderSummary();
    else renderSettings();
  }

  /* ---------- export / import ---------- */
  function download(name, text, type) {
    try {
      var blob = new Blob([text], { type: type });
      var url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    } catch (e) { toast('Export failed on this device'); }
  }
  function exportJSON() {
    var payload = { app: "Farhanah's Green Days", version: VERSION, exported: new Date().toISOString(), data: data };
    download('green-days-backup-' + state.today + '.json', JSON.stringify(payload, null, 2), 'application/json');
    toast('Backup exported 📦');
  }
  function exportCSV() {
    var yn = function (b) { return b ? 'Yes' : 'No'; };
    var cr = { none: 'None', resisted: 'Resisted', gaveIn: 'Gave in' };
    var md = { bad: 'Bad', okay: 'Okay', good: 'Good' };
    var cell = function (v) { v = String(v == null ? '' : v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var rows = [['Date', 'Status', 'Sugary drink', 'Sweet food', 'Processed/fried', 'Veggies/fruit', 'Water', 'Craving', 'Mood', 'Notes']];
    Object.keys(data).sort().forEach(function (k) {
      var e = data[k], s = statusOf(e);
      rows.push([k, s.charAt(0).toUpperCase() + s.slice(1), yn(e.sugaryDrink), yn(e.sweetFood), yn(e.processed), yn(e.veggiesFruit), e.water || 0, cr[e.craving] || '', md[e.mood] || '', e.notes || '']);
    });
    var csv = '﻿' + rows.map(function (r) { return r.map(cell).join(','); }).join('\r\n');
    download('green-days-' + state.today + '.csv', csv, 'text/csv;charset=utf-8');
    toast('Exported for Excel 📊');
  }
  function sanitize(e) {
    if (!e || typeof e !== 'object') return null;
    var w = parseInt(e.water, 10);
    return {
      sugaryDrink: !!e.sugaryDrink, sweetFood: !!e.sweetFood, processed: !!e.processed, veggiesFruit: !!e.veggiesFruit,
      water: isFinite(w) ? Math.max(0, Math.min(99, w)) : 0,
      craving: ['none', 'resisted', 'gaveIn'].indexOf(e.craving) >= 0 ? e.craving : 'none',
      mood: ['bad', 'okay', 'good'].indexOf(e.mood) >= 0 ? e.mood : null,
      notes: typeof e.notes === 'string' ? e.notes.slice(0, 5000) : ''
    };
  }
  function importJSON(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        var src = parsed && parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;
        if (!src || typeof src !== 'object' || Array.isArray(src)) throw new Error('bad');
        var n = 0;
        Object.keys(src).forEach(function (k) {
          if (!isValidKey(k) || k > state.today) return;
          var e = sanitize(src[k]);
          if (e) { data[k] = e; n++; }
        });
        if (!n) { toast('No valid days found in that file'); return; }
        saveData(); render();
        toast('Imported ' + n + (n === 1 ? ' day' : ' days') + ' ✓');
      } catch (err) { toast("That file doesn't look like a Green Days backup"); }
    };
    reader.readAsText(file);
  }

  /* ---------- reminders ---------- */
  function notify() {
    var title = "Farhanah's Green Days", body = "Hi Farhanah, don't forget your green day check-in 🌿";
    var opts = { body: body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'fgd-reminder' };
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(function (reg) { reg.showNotification(title, opts); }).catch(function () { });
      } else { new Notification(title, opts); }
    } catch (e) { }
  }
  function checkReminder() {
    rolloverIfNewDay();
    if (state.tab === 'today') $('reminder-banner').hidden = !(state.view === state.today && reminderDue());
    if (!reminderDue() || state.notifiedFor === state.today) return;
    state.notifiedFor = state.today;
    if (window.Notification && Notification.permission === 'granted') notify();
    else toast("Hi Farhanah, don't forget your green day check-in 🌿", 4000);
  }

  function rolloverIfNewDay() {
    var t = todayKey();
    if (t === state.today) return false;
    var wasOnToday = state.view === state.today;
    state.today = t;
    if (wasOnToday || state.view > t) state.view = t;
    state.week = mondayOf(t);
    state.month = t.slice(0, 8) + '01';
    render();
    return true;
  }

  /* ---------- events ---------- */
  function bind() {
    document.querySelectorAll('.tabbar button').forEach(function (b) {
      b.addEventListener('click', function () { showTab(b.dataset.tab); });
    });

    $('day-prev').addEventListener('click', function () { state.view = addDays(state.view, -1); renderToday(); });
    $('day-next').addEventListener('click', function () { if (state.view < state.today) { state.view = addDays(state.view, 1); renderToday(); } });

    document.querySelectorAll('#view-today .switch').forEach(function (sw) {
      sw.addEventListener('change', function () {
        var f = sw.dataset.field, v = sw.checked;
        update(function (e) { e[f] = v; });
      });
    });
    $('water-plus').addEventListener('click', function () { update(function (e) { e.water = Math.min(99, (e.water || 0) + 1); }); });
    $('water-minus').addEventListener('click', function () { update(function (e) { e.water = Math.max(0, (e.water || 0) - 1); }); });

    ['seg-craving', 'seg-mood'].forEach(function (id) {
      var seg = $(id), field = seg.dataset.field;
      seg.addEventListener('click', function (ev) {
        var b = ev.target.closest('button'); if (!b) return;
        var v = b.dataset.value;
        update(function (e) { e[field] = (field === 'mood' && e.mood === v) ? null : v; });
      });
    });

    var notesTimer;
    $('notes').addEventListener('input', function () {
      var v = this.value;
      clearTimeout(notesTimer);
      notesTimer = setTimeout(function () { update(function (e) { e.notes = v; }); }, 400);
    });
    $('notes').addEventListener('blur', function () {
      var v = this.value; clearTimeout(notesTimer);
      var cur = data[state.view] ? data[state.view].notes : '';
      if (v !== (cur || '')) update(function (e) { e.notes = v; });
    });

    $('save-btn').addEventListener('click', function () {
      var wasLogged = !!data[state.view];
      update(function () { });
      if (!wasLogged) toast(statusOf(data[state.view]) === 'green' ? 'Saved — a green day 💚' : 'Saved ✓');
      else toast('All saved ✓');
    });

    // Calendar
    $('month-prev').addEventListener('click', function () { var d = parseKey(state.month); d.setMonth(d.getMonth() - 1); state.month = keyOf(d); renderCalendar(); });
    $('month-next').addEventListener('click', function () { var d = parseKey(state.month); d.setMonth(d.getMonth() + 1); var k = keyOf(d); if (k <= state.today) { state.month = k; renderCalendar(); } });
    $('cal-grid').addEventListener('click', function (ev) {
      var b = ev.target.closest('.cal-day'); if (!b || b.disabled) return;
      state.view = b.dataset.key; showTab('today');
    });

    // Summary
    $('week-prev').addEventListener('click', function () { state.week = addDays(state.week, -7); renderSummary(); });
    $('week-next').addEventListener('click', function () { if (state.week < mondayOf(state.today)) { state.week = addDays(state.week, 7); renderSummary(); } });

    // Settings
    $('seg-theme').addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      settings.theme = b.dataset.value; saveSettings(); applyTheme(); renderSettings();
    });
    $('goal-minus').addEventListener('click', function () { settings.waterGoal = Math.max(1, settings.waterGoal - 1); saveSettings(); renderSettings(); });
    $('goal-plus').addEventListener('click', function () { settings.waterGoal = Math.min(20, settings.waterGoal + 1); saveSettings(); renderSettings(); });
    $('remind-toggle').addEventListener('change', function () {
      settings.remind = this.checked; saveSettings(); renderSettings();
      if (settings.remind) {
        if (window.Notification && Notification.permission === 'default') {
          try {
            var p = Notification.requestPermission(function (r) { onPerm(r); });
            if (p && p.then) p.then(onPerm);
          } catch (e) { }
        } else if (!window.Notification) {
          toast("Notifications aren't available here — you'll see a banner instead", 3500);
        } else if (Notification.permission === 'denied') {
          toast('Notifications are blocked — you’ll see an in-app banner instead', 3500);
        } else toast('Reminder on 🔔');
      }
    });
    function onPerm(r) {
      if (onPerm.done) return; onPerm.done = true;
      toast(r === 'granted' ? 'Reminder on 🔔' : "OK — you'll see an in-app banner instead", 3000);
    }
    $('remind-time').addEventListener('change', function () {
      if (/^\d{2}:\d{2}$/.test(this.value)) { settings.remindTime = this.value; state.notifiedFor = null; saveSettings(); }
    });
    $('export-json').addEventListener('click', exportJSON);
    $('export-csv').addEventListener('click', exportCSV);
    $('import-json').addEventListener('click', function () { $('import-file').click(); });
    $('import-file').addEventListener('change', function () { if (this.files && this.files[0]) importJSON(this.files[0]); this.value = ''; });
    $('delete-all').addEventListener('click', function () {
      if (!Object.keys(data).length) { toast('Nothing to delete yet'); return; }
      if (confirm('Delete all your Green Days data from this device? This cannot be undone. (Tip: export a backup first.)')) {
        data = {}; saveData(); state.celebrated = {}; render(); toast('All data deleted');
      }
    });

    // Welcome
    $('welcome-start').addEventListener('click', function () {
      settings.welcomed = true; saveSettings();
      var w = $('welcome');
      w.classList.add('leaving');
      setTimeout(function () { w.hidden = true; w.classList.remove('leaving'); }, 400);
    });

    // New day / theme changes
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { if (!rolloverIfNewDay()) render(); checkReminder(); } });
    window.addEventListener('hashchange', function () { var t = location.hash.slice(1); if (t && t !== state.tab) showTab(t, true); });
    if (window.matchMedia) {
      var mq = matchMedia('(prefers-color-scheme: dark)');
      var onMq = function () { applyTheme(); };
      if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
    }
  }

  /* ---------- start ---------- */
  function init() {
    applyTheme();
    bind();
    if (!settings.welcomed) $('welcome').hidden = false;
    showTab(location.hash.slice(1) || 'today', true);
    setInterval(checkReminder, 30000);
    setTimeout(checkReminder, 1500);
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { }); });
    }
  }
  init();
})();
