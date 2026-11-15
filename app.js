/* Farhanah's Green Days — app.js (vanilla JS, no build step) */
(function () {
  'use strict';

  var VERSION = '1.2.0';
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
  var DEFAULT_SETTINGS = {
    theme: 'auto', waterGoal: 8, remind: false, remindTime: '21:00', welcomed: false,
    trackDiet: false, calorieGoal: null, proteinGoal: null,
    profile: { sex: 'female', age: null, heightCm: null, activity: 'light' }, weighDay: null
  };
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
  settings.profile = Object.assign({}, DEFAULT_SETTINGS.profile, settings.profile || {});
  var state = {
    chartMode: 'water',   // 'water' | 'kcal'
    flash: {},            // entry ids to highlight on next render
    checkin: null,        // { day, open } when she opened/closed the check-in by hand
    waterUndo: { day: null, stack: [] },
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
  // action (optional): { label: 'Undo', fn: function () {} }
  function toast(text, ms, big, action) {
    var t = $('toast');
    if (!t) return;
    t.textContent = text;
    if (action) {
      var b = document.createElement('button');
      b.className = 'toast-action'; b.textContent = action.label;
      b.addEventListener('click', function () { t.classList.remove('show'); clearTimeout(toastTimer); action.fn(); });
      t.appendChild(b);
    }
    t.classList.toggle('has-action', !!action);
    t.classList.toggle('big', !!big);
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, ms || (action ? 4500 : 2200));
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
    if (tab === 'meals') { openToday(state.view, 'meals'); return; }   // old links to the Meals tab
    if (TABS.indexOf(tab) < 0) tab = 'today';
    closeSwipe();
    state.tab = tab;
    document.querySelectorAll('.view').forEach(function (v) { v.classList.toggle('active', v.dataset.view === tab); });
    document.querySelectorAll('.tabbar button').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === tab); });
    if (!noHash && location.hash !== '#' + tab) { try { history.replaceState(null, '', '#' + tab); } catch (e) { } }
    render();
    window.scrollTo(0, 0);
    updateTopChip();
  }
  // Open Today for a date, then optionally scroll to 'meals', a meal id ('lunch'…) or open the add-food sheet
  function openToday(k, target) {
    state.view = k > state.today ? state.today : k;
    showTab('today');
    if (!target) return;
    if (target === 'add-food') {
      if (settings.trackDiet) setTimeout(function () { openSheet(foodSheet({})); }, 200);
      else toast('Turn on food tracking in Settings → Diet first');
      return;
    }
    // short delay so the browser's own hash/anchor scroll can't cancel ours
    setTimeout(function () { scrollToEl(target === 'meals' ? 'meals-wrap' : 'meal-' + target); }, 120);
  }
  function scrollToEl(id) {
    var el = $(id);
    if (!el || !el.offsetParent) return;
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }
  function scrollTop() {
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }
  // "↑ Top" chip: shows on Today once you scroll past the dashboard
  function updateTopChip() {
    var chip = $('top-chip'), dash = $('dashboard');
    if (!chip || !dash) return;
    var show = state.tab === 'today' && !sheet.ctl && window.scrollY > dash.offsetTop + dash.offsetHeight - 80;
    chip.classList.toggle('show', show);
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
    var causes = sugarCauses(k);
    $('status-causes').textContent = causes.text;
    $('status-causes').hidden = !causes.text;

    document.querySelectorAll('#view-today input[data-field]').forEach(function (sw) { sw.checked = !!e[sw.dataset.field]; });

    // water
    var goal = settings.waterGoal;
    $('water-count').textContent = e.water;
    $('water-goal').textContent = goal;
    $('water-ml').textContent = Math.round(e.water * 25) / 100 + ' L';
    $('water-undo').disabled = e.water <= 0;
    var bar = $('water-bar');
    bar.style.width = Math.min(100, (e.water / goal) * 100) + '%';
    bar.classList.toggle('done', e.water >= goal);

    renderHighlights(k, e);
    var tip = tipFor(k, e);
    $('tip').hidden = !tip;
    $('tip').innerHTML = tip ? '<span class="tip-icon">💡</span><span>' + tip + '</span>' : '';

    if (settings.trackDiet) { renderWeighBanners(); renderKcalCard(k); renderMealCards(k); }
    else $('weigh-banner-today').hidden = true;

    renderCheckin(k, e);

    var btn = $('save-btn');
    btn.textContent = logged ? 'Saved ✓' : (k === state.today ? 'Save today' : 'Save this day');
    btn.classList.toggle('saved', logged);
  }
  function setSeg(id, val) {
    document.querySelectorAll('#' + id + ' button').forEach(function (b) { b.classList.toggle('on', b.dataset.value === val); });
  }

  // Which foods caused today's sugar status
  function sugarCauses(k) {
    var e = data[k];
    if (!e || !(e.sugaryDrink || e.sweetFood)) return { text: '', meal: null };
    var hits = dayMeals(k).filter(function (m) { return (m.isSugaryDrink && e.sugaryDrink) || (m.isSweetFood && e.sweetFood); });
    if (!hits.length) return { text: 'Marked by you', meal: null };
    var names = [];
    hits.forEach(function (m) { if (names.indexOf(m.name) < 0) names.push(m.name); });
    var text = 'From: ' + names.slice(0, 3).join(', ') + (names.length > 3 ? ' +' + (names.length - 3) + ' more' : '');
    var flaggedBoth = (e.sugaryDrink && !hits.some(function (m) { return m.isSugaryDrink; })) || (e.sweetFood && !hits.some(function (m) { return m.isSweetFood; }));
    return { text: text + (flaggedBoth ? ' · plus marked by you' : ''), meal: hits[0].meal };
  }

  // Highlights row: veggie servings, fried/processed, protein
  function renderHighlights(k, e) {
    var meals = dayMeals(k), veg = 0, fried = 0, prot = 0;
    meals.forEach(function (m) { veg += (m.veg || 0) * (m.portion || 1); if (m.isFried) fried++; prot += m.protein || 0; });
    veg = Math.round(veg * 2) / 2;
    var vegVal = veg > 0 ? String(veg).replace('.5', '½') : (e.veggiesFruit ? '✓' : '—');
    var friedVal = fried > 0 ? String(fried) : (e.processed ? '✓' : '—');
    var html =
      '<button class="hl' + (e.veggiesFruit ? ' on good' : '') + '" data-hl="veggiesFruit" aria-pressed="' + !!e.veggiesFruit + '">' +
      '<span class="hl-icon">🥦</span><span class="hl-val">' + vegVal + '</span><span class="hl-lbl">Veggie / fruit' + (veg > 0 ? ' servings' : '') + '</span></button>' +
      '<button class="hl' + (e.processed ? ' on bad' : '') + '" data-hl="processed" aria-pressed="' + !!e.processed + '">' +
      '<span class="hl-icon">🍟</span><span class="hl-val">' + friedVal + '</span><span class="hl-lbl">Fried / processed</span></button>';
    if (settings.trackDiet) {
      var pg = settings.proteinGoal;
      html += '<button class="hl" data-hl="protein"><span class="hl-icon">💪</span><span class="hl-val">' + Math.round(prot) + '<small> g</small></span>' +
        '<span class="hl-lbl">Protein' + (pg ? ' of ' + pg + ' g' : '') + '</span></button>';
    }
    $('highlights').innerHTML = html;
    $('highlights').classList.toggle('three', !!settings.trackDiet);
  }

  // One gentle, kind tip for today
  function tipFor(k, e) {
    if (k !== state.today) return '';
    var h = new Date().getHours(), logged = !!data[k], t = totals(k), pg = settings.proteinGoal;
    var water = e.water || 0, goal = settings.waterGoal;
    if (e.sugaryDrink || e.sweetFood) return 'Craving something sweet later? Fruit or a teh O kosong can help 🍊';
    if (h >= 14 && water < goal / 2) return 'A glass of water now keeps you fresh for the afternoon 💧';
    if (h >= 17 && !e.veggiesFruit) return 'Try adding some veggies or fruit to dinner 🥦';
    if (settings.trackDiet && pg && h >= 17 && t.protein < pg * 0.5) return 'A palm of chicken, fish, egg or tauhu helps you stay full 💪';
    if (h < 11 && !logged) return 'Start the day with a glass of water and a good breakfast 🍳';
    if (logged && water >= goal) return 'Water goal done. Your body says thank you 💚';
    var tips = [
      'Small swaps count: kopi O kosong instead of kopi saves about 135 kcal ☕',
      'Eating slowly helps you notice when you’re full 🌿',
      'Half a plate of veggies makes meals more filling 🥗',
      'A short walk after meals helps with energy 🚶‍♀️',
      'Plan tomorrow’s snack tonight and sweets are easier to skip 🍎'
    ];
    return tips[parseKey(k).getDate() % tips.length];
  }

  // Evening check-in (collapsible): auto-opens after 6 pm if still empty
  function checkinEmpty(e) { return (!e.craving || e.craving === 'none') && !e.mood && !e.notes; }
  function renderCheckin(k, e) {
    var auto = k === state.today && new Date().getHours() >= 18 && checkinEmpty(e);
    var open = state.checkin && state.checkin.day === k ? state.checkin.open : auto;
    $('checkin-body').hidden = !open;
    $('checkin').classList.toggle('open', open);
    $('checkin-toggle').setAttribute('aria-expanded', String(open));
    var parts = [], cr = { resisted: 'Craving resisted', gaveIn: 'Gave in to a craving' }, md = { bad: '😞', okay: '😐', good: '😊' };
    if (cr[e.craving]) parts.push(cr[e.craving]);
    if (md[e.mood]) parts.push(md[e.mood]);
    if (e.notes) parts.push('📝 Note');
    $('checkin-sum').textContent = parts.length ? parts.join(' · ') : 'Cravings, mood & notes';
    setSeg('seg-craving', e.craving);
    setSeg('seg-mood', e.mood);
    var notes = $('notes');
    if (document.activeElement !== notes) notes.value = e.notes || '';
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

    var kcalMode = settings.trackDiet && state.chartMode === 'kcal';
    if (settings.trackDiet) {
      renderWeekDiet(mon);
      setSeg('seg-chart', kcalMode ? 'kcal' : 'water');
      renderWeightCard();
    }
    $('chart').innerHTML = kcalMode ? kcalChartSVG() : chartSVG();
    $('chart-caption').textContent = kcalMode
      ? 'Bar height = calories eaten · dashed line = daily goal'
      : 'Bar height = glasses of water · colour = day status · dashed line = goal';

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
    // Diet
    $('diet-toggle').checked = !!settings.trackDiet;
    if (document.activeElement !== $('kcal-goal')) $('kcal-goal').value = settings.calorieGoal || '';
    if (document.activeElement !== $('protein-goal')) $('protein-goal').value = settings.proteinGoal || '';
    $('weigh-day').value = settings.weighDay == null ? '' : String(settings.weighDay);
    var kg = latestWeight();
    $('protein-hint').innerHTML = kg
      ? 'Suggested protein: 1.2 g × ' + kg + ' kg ≈ <b>' + Math.round(kg * 1.2) + ' g</b> a day. ' +
        (settings.proteinGoal === Math.round(kg * 1.2) ? '' : '<button class="small-link" data-act="use-protein">Use this</button>')
      : 'Tip: a common protein target is about 1.2 g per kg of body weight. Log your weight to get a suggestion.';
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
    var payload = {
      app: "Farhanah's Green Days", version: VERSION, exported: new Date().toISOString(),
      data: data, foods: customFoods, favs: favs, weight: weights
    };
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
    var out = {
      sugaryDrink: !!e.sugaryDrink, sweetFood: !!e.sweetFood, processed: !!e.processed, veggiesFruit: !!e.veggiesFruit,
      water: isFinite(w) ? Math.max(0, Math.min(99, w)) : 0,
      craving: ['none', 'resisted', 'gaveIn'].indexOf(e.craving) >= 0 ? e.craving : 'none',
      mood: ['bad', 'okay', 'good'].indexOf(e.mood) >= 0 ? e.mood : null,
      notes: typeof e.notes === 'string' ? e.notes.slice(0, 5000) : ''
    };
    if (Array.isArray(e.meals)) out.meals = e.meals.map(sanitizeMeal).filter(Boolean).slice(0, 200);
    return out;
  }
  function importJSON(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        var src = parsed && parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;
        if (!src || typeof src !== 'object' || Array.isArray(src)) throw new Error('bad');
        var n = 0, extra = 0;
        Object.keys(src).forEach(function (k) {
          if (!isValidKey(k) || k > state.today) return;
          var e = sanitize(src[k]);
          if (e) { data[k] = e; n++; }
        });
        if (parsed && parsed.data) extra = importDietExtras(parsed);
        if (!n && !extra) { toast('No valid days found in that file'); return; }
        saveData(); render();
        toast('Imported ' + n + (n === 1 ? ' day' : ' days') + (extra ? ' + diet data' : '') + ' ✓');
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

  /* ==========================================================
     DIET (optional): meals, food sheet, barcode, calculator, weight
     ========================================================== */
  var FOODS_KEY = 'fgd-foods', FAVS_KEY = 'fgd-favs', WEIGHT_KEY = 'fgd-weight';
  var ZXING_URL = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
  var OFF_URL = 'https://world.openfoodfacts.org/api/v2/product/';
  var OFF_FIELDS = 'product_name,product_name_en,brands,nutriments,serving_size,serving_quantity,categories_tags,quantity,product_quantity_unit';
  var MEALS = [
    { id: 'breakfast', label: 'Breakfast', icon: '🍳' }, { id: 'lunch', label: 'Lunch', icon: '🍛' },
    { id: 'dinner', label: 'Dinner', icon: '🍽️' }, { id: 'snack', label: 'Snacks', icon: '🍎' }
  ];
  var MEAL_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };
  var ACTIVITY = {
    sedentary: { f: 1.2, label: 'Sedentary', hint: 'Mostly sitting, little or no exercise.' },
    light: { f: 1.375, label: 'Light', hint: 'Light exercise or walking 1–3 days a week.' },
    moderate: { f: 1.55, label: 'Moderate', hint: 'Exercise 3–5 days a week.' },
    active: { f: 1.725, label: 'Active', hint: 'Hard exercise 6–7 days a week.' }
  };
  var PORTIONS = [0.5, 0.75, 1, 1.5, 2];
  var PORTION_LABEL = { 0.5: '½', 0.75: '¾', 1: '1', 1.5: '1½', 2: '2' };

  var customFoods = load(FOODS_KEY, {}); if (Array.isArray(customFoods)) customFoods = {};
  var favs = load(FAVS_KEY, []); if (!Array.isArray(favs)) favs = [];
  var weights = load(WEIGHT_KEY, []); if (!Array.isArray(weights)) weights = [];
  var BUILTIN = {};
  (window.FGD_FOODS || []).forEach(function (f) { BUILTIN[f.id] = f; });

  function saveFoods() { store(FOODS_KEY, customFoods); }
  function saveFavs() { store(FAVS_KEY, favs); }
  function saveWeights() { store(WEIGHT_KEY, weights); }

  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
  function round1(n) { return Math.round(n * 10) / 10; }
  function round2(n) { return Math.round(n * 100) / 100; }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function str(v, max) { return typeof v === 'string' ? v.trim().slice(0, max) : ''; }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : null; }
  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function nowTime() { var d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function defaultMeal() {
    var d = new Date(), m = d.getHours() * 60 + d.getMinutes();
    if (m >= 240 && m < 630) return 'breakfast';
    if (m >= 630 && m < 900) return 'lunch';
    if (m >= 1050 && m < 1290) return 'dinner';
    return 'snack';
  }
  function latestWeight() { return weights.length ? weights[weights.length - 1].kg : null; }
  function dayMeals(k) { return data[k] && Array.isArray(data[k].meals) ? data[k].meals : []; }
  function totals(k) {
    var t = { kcal: 0, protein: 0, n: 0 };
    dayMeals(k).forEach(function (m) { t.kcal += m.kcal || 0; t.protein += m.protein || 0; t.n++; });
    return t;
  }

  function applyDiet() {
    document.body.classList.toggle('diet-on', !!settings.trackDiet);
  }

  /* ---------- food records ---------- */
  function normFood(f, source) {
    return {
      id: f.id || null, name: f.name, serving: f.serving || '1 serving', kcal: +f.kcal || 0, protein: +f.protein || 0,
      sd: !!(f.sd || f.isSugaryDrink), sf: !!(f.sf || f.isSweetFood), source: source,
      barcode: f.barcode || null, per100: !!f.per100, unit: f.unit === 'ml' ? 'ml' : 'g',
      perServing: f.perServing || null, alt: f.alt || '', fr: !!(f.fr || f.isFried), veg: +(f.veg || 0)
    };
  }
  function getFood(id) {
    if (!id) return null;
    if (BUILTIN[id]) return normFood(BUILTIN[id], 'builtin');
    if (customFoods[id]) return normFood(customFoods[id], customFoods[id].barcode ? 'barcode' : 'custom');
    return null;
  }
  function allFoods() {
    var mine = Object.keys(customFoods).map(getFood);
    return mine.concat((window.FGD_FOODS || []).map(function (f) { return normFood(f, 'builtin'); }));
  }
  // Rebuild a "food" from a logged entry (used for Recent and for editing)
  function foodFromEntry(m) {
    var p = m.portion > 0 ? m.portion : 1, g = /^100 (g|ml)$/.exec(m.serving || '');
    return {
      id: m.foodId || null, name: m.name, serving: m.serving || '1 serving', kcal: m.kcal / p, protein: (m.protein || 0) / p,
      sd: !!m.isSugaryDrink, sf: !!m.isSweetFood, source: m.source || 'custom', barcode: m.barcode || null,
      per100: !!g, unit: g ? g[1] : 'g', perServing: null, alt: '', fr: !!m.isFried, veg: +(m.veg || 0)
    };
  }
  function calcFood(f, portion, mode, amount) {
    if (f.per100) {
      if (mode === 'serv' && f.perServing) return { kcal: f.perServing.kcal * amount, protein: f.perServing.protein * amount, serving: f.perServing.label, portion: amount };
      return { kcal: f.kcal * amount / 100, protein: f.protein * amount / 100, serving: '100 ' + f.unit, portion: amount / 100 };
    }
    return { kcal: f.kcal * portion, protein: f.protein * portion, serving: f.serving, portion: portion };
  }
  function defaultAmount(f) { return f.per100 && f.perServing ? { mode: 'serv', amount: 1 } : { mode: 'g', amount: 100 }; }
  function makeEntry(f, c, meal, flags, keep) {
    return {
      id: keep ? keep.id : newId(), meal: meal, name: f.name, serving: c.serving, portion: round2(c.portion),
      kcal: Math.round(c.kcal), protein: round1(c.protein), time: keep ? keep.time : nowTime(),
      source: f.source === 'builtin' || f.source === 'barcode' ? f.source : 'custom', barcode: f.barcode || null,
      foodId: f.id || null, isSugaryDrink: !!flags.sd, isSweetFood: !!flags.sf,
      isFried: !!f.fr, veg: f.veg || 0
    };
  }
  function servingText(f) { return f.per100 ? (f.perServing ? f.perServing.label : '100 ' + f.unit) : f.serving; }
  function listKcal(f) { return f.per100 && f.perServing ? f.perServing.kcal : f.kcal; }
  function listProt(f) { return f.per100 && f.perServing ? f.perServing.protein : f.protein; }
  function entryAmountText(m) {
    var g = /^100 (g|ml)$/.exec(m.serving || '');
    if (g) return Math.round(m.portion * 100) + ' ' + g[1];
    return m.serving + (m.portion !== 1 ? ' × ' + (PORTION_LABEL[m.portion] || m.portion) : '');
  }
  function norm(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function searchFoods(q) {
    var nq = norm(q), words = nq.split(' ').filter(Boolean);
    if (!words.length) return [];
    return allFoods().map(function (f) {
      var name = norm(f.name), hay = name + ' ' + norm(f.alt) + ' ' + (f.barcode || '');
      if (!words.every(function (w) { return hay.indexOf(w) >= 0; })) return null;
      var score = name.indexOf(nq) === 0 ? 0 : name.indexOf(nq) >= 0 ? 1 : 2;
      return { f: f, s: score };
    }).filter(Boolean).sort(function (a, b) { return a.s - b.s; }).slice(0, 60).map(function (x) { return x.f; });
  }
  function recentFoods() {
    var keys = Object.keys(data).sort().reverse(), seen = {}, out = [];
    for (var i = 0; i < keys.length && out.length < 10; i++) {
      var meals = dayMeals(keys[i]).slice().sort(function (a, b) { return (b.time || '').localeCompare(a.time || ''); });
      for (var j = 0; j < meals.length && out.length < 10; j++) {
        var m = meals[j], key = m.foodId || ('q:' + norm(m.name));
        if (seen[key]) continue;
        seen[key] = true;
        out.push(getFood(m.foodId) || foodFromEntry(m));
      }
    }
    return out;
  }
  function toggleFav(id) {
    if (!id) return false;
    var i = favs.indexOf(id);
    if (i >= 0) favs.splice(i, 1); else favs.unshift(id);
    saveFavs();
    return i < 0;
  }

  /* ---------- logging (linked with the sugar toggles) ---------- */
  function sugarNote(prev, needSd, needSf) {
    var parts = [];
    if (needSd && !prev.sugaryDrink) parts.push('sugary drink 🧋');
    if (needSf && !prev.sweetFood) parts.push('sweet food 🍰');
    return parts.length ? 'Marked as ' + parts.join(' & ') : '';
  }
  function addEntries(list, okMsg) {
    var prev = data[state.view] || {};
    var needSd = list.some(function (m) { return m.isSugaryDrink; }), needSf = list.some(function (m) { return m.isSweetFood; });
    var note = sugarNote(prev, needSd, needSf);
    list.forEach(function (m) { state.flash[m.id] = true; });   // briefly highlight new entries
    update(function (e) {
      e.meals = (e.meals || []).concat(list);
      if (needSd) e.sugaryDrink = true;
      if (needSf) e.sweetFood = true;
      if (list.some(function (m) { return m.isFried; })) e.processed = true;
      if (list.some(function (m) { return m.veg > 0; })) e.veggiesFruit = true;
    });
    toast(note || okMsg, note ? 2800 : 1800);
  }
  function saveEditedEntry(entry) {
    var prev = data[state.view] || {}, note = sugarNote(prev, entry.isSugaryDrink, entry.isSweetFood);
    state.flash[entry.id] = true;
    update(function (e) {
      e.meals = (e.meals || []).map(function (m) { return m.id === entry.id ? entry : m; });
      if (entry.isSugaryDrink) e.sugaryDrink = true;
      if (entry.isSweetFood) e.sweetFood = true;
    });
    toast(note || 'Saved ✓', note ? 2800 : 1500);
  }
  function deleteEntry(id) {
    var k = state.view;
    if (!data[k]) return;
    var list = dayMeals(k), idx = -1;
    list.forEach(function (m, i) { if (m.id === id) idx = i; });
    if (idx < 0) return;
    var removed = list[idx];
    update(function (e) { e.meals = (e.meals || []).filter(function (m) { return m.id !== id; }); });
    toast('Removed ' + removed.name, 4500, false, {
      label: 'Undo',
      fn: function () {
        if (!data[k]) return;
        var ms = (data[k].meals || []).slice();
        ms.splice(Math.min(idx, ms.length), 0, removed);
        data[k].meals = ms; state.flash[removed.id] = true;
        saveData(); render();
      }
    });
  }
  function sameAsYesterday(meal) {
    var items = dayMeals(addDays(state.view, -1)).filter(function (m) { return m.meal === meal; });
    if (!items.length) { toast('Nothing logged for that meal yesterday'); return; }
    var t = nowTime();
    addEntries(items.map(function (m) { return Object.assign({}, m, { id: newId(), time: t }); }),
      'Copied yesterday’s ' + MEAL_LABEL[meal].toLowerCase() + ' ✓');
  }

  /* ---------- Meals on the Today page ---------- */
  var swipe = { el: null, openEl: null, x0: 0, y0: 0, dx: 0, base: 0, active: false, suppress: false };
  function closeSwipe() {
    if (!swipe.openEl) return;
    var el = swipe.openEl; swipe.openEl = null;
    el.style.transform = '';
    setTimeout(function () { if (swipe.openEl !== el && el.parentNode) el.parentNode.classList.remove('reveal'); }, 260);
  }

  function weighDue() {
    return settings.trackDiet && settings.weighDay != null && new Date().getDay() === settings.weighDay &&
      !weights.some(function (w) { return w.date === state.today; });
  }
  function renderWeighBanners() {
    var due = weighDue(), html = 'It’s weigh-in day ⚖️ Whenever you’re ready. <button class="small-link" data-act="logweight">Log weight</button>';
    ['weigh-banner-today', 'weigh-banner-summary'].forEach(function (id) { $(id).hidden = !due; if (due) $(id).innerHTML = html; });
  }

  function renderKcalCard(k) {
    var t = totals(k), goal = settings.calorieGoal, pg = settings.proteinGoal;
    var C = 2 * Math.PI * 52, pct = goal ? Math.min(1, t.kcal / goal) : 0;
    var info;
    if (goal) {
      var left = goal - t.kcal;
      info = (left >= 0
        ? '<div class="left-big">' + fmt(left) + ' kcal left</div>'
        : '<div class="left-big over">+' + fmt(-left) + ' over goal</div>') +
        '<div class="ring-goal">Goal ' + fmt(goal) + ' kcal</div>';
    } else {
      info = '<div class="left-big over">No daily goal yet</div><button class="small-link" data-act="calc">Set a goal</button>';
    }
    info += pg
      ? '<div class="pbar-label"><span>Protein</span><span>' + Math.round(t.protein) + ' / ' + pg + ' g</span></div>' +
        '<div class="pbar"><i style="width:' + Math.min(100, t.protein / pg * 100) + '%"></i></div>'
      : '<div class="pbar-label"><span>Protein</span><span>' + Math.round(t.protein) + ' g</span></div>';
    $('kcal-card').innerHTML =
      '<div class="ring"><svg viewBox="0 0 124 124" aria-hidden="true">' +
      '<circle class="track" cx="62" cy="62" r="52" fill="none" stroke-width="12"/>' +
      '<circle class="prog" cx="62" cy="62" r="52" fill="none" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C * (1 - pct)).toFixed(1) + '"' + (pct === 0 ? ' opacity="0"' : '') + '/></svg>' +
      '<div class="ring-center"><strong>' + fmt(t.kcal) + '</strong><span>kcal eaten</span></div></div>' +
      '<div class="ring-info">' + info + '<button class="btn btn-primary add-food-btn" data-act="addfood">+ Add food</button></div>';
  }

  function renderMealCards(k) {
    var meals = dayMeals(k), yest = dayMeals(addDays(k, -1)), html = '';
    MEALS.forEach(function (M) {
      var items = meals.filter(function (m) { return m.meal === M.id; });
      var sub = items.reduce(function (s, m) { return s + (m.kcal || 0); }, 0);
      var hasY = yest.some(function (m) { return m.meal === M.id; });
      html += '<div class="card list meal-card" id="meal-' + M.id + '">' +
        '<div class="meal-card-head"><span class="meal-name">' + M.icon + ' ' + M.label + '</span><span class="meal-sub">' + (items.length ? fmt(sub) + ' kcal' : '') + '</span></div>';
      items.forEach(function (m) {
        html += '<div class="entry' + (state.flash[m.id] ? ' flash' : '') + '"><button class="entry-del" data-act="del" data-id="' + esc(m.id) + '">Delete</button>' +
          '<button class="entry-main" data-act="edit" data-id="' + esc(m.id) + '"><div class="entry-text"><div class="entry-name">' + esc(m.name) + '</div>' +
          '<div class="entry-meta">' + esc(entryAmountText(m)) + ' · ' + round1(m.protein || 0) + ' g protein' + (m.time ? ' · ' + esc(m.time) : '') + '</div></div>' +
          '<div class="entry-kcal">' + fmt(m.kcal) + '</div></button></div>';
      });
      html += '<div class="row add-row"><button class="add-btn" data-act="add" data-meal="' + M.id + '"><span class="row-icon">＋</span>Add food</button></div>';
      if (hasY) html += '<div class="row add-row"><button class="add-btn same" data-act="same" data-meal="' + M.id + '"><span class="row-icon">↺</span>Same as yesterday</button></div>';
      html += '</div>';
    });
    swipe.openEl = null;
    $('meals-list').innerHTML = html;
    state.flash = {};
  }

  /* ---------- bottom sheet framework ---------- */
  var sheet = { ctl: null, timer: null };
  function openSheet(ctl) {
    if (sheet.ctl && sheet.ctl.close) sheet.ctl.close();
    clearTimeout(sheet.timer);
    sheet.ctl = ctl;
    var w = $('sheet-wrap');
    w.classList.remove('closing'); w.hidden = false;
    document.body.style.overflow = 'hidden';
    renderSheet();
    updateTopChip();
  }
  function renderSheet() {
    if (!sheet.ctl) return;
    var body = $('sheet-body');
    body.innerHTML = sheet.ctl.html();
    body.scrollTop = 0;
    if (sheet.ctl.mount) sheet.ctl.mount(body);
  }
  function closeSheet() {
    if (!sheet.ctl) return;
    if (sheet.ctl.close) sheet.ctl.close();
    sheet.ctl = null;
    var w = $('sheet-wrap');
    w.classList.add('closing');
    document.body.style.overflow = '';
    sheet.timer = setTimeout(function () { w.hidden = true; w.classList.remove('closing'); $('sheet-body').innerHTML = ''; updateTopChip(); }, 260);
  }
  function headHTML(left, title, right) {
    function b(x) { return x ? '<button data-act="' + x.act + '"' + (x.disabled ? ' disabled' : '') + '>' + x.label + '</button>' : '<button disabled></button>'; }
    return '<div class="sheet-head">' + b(left) + '<h2>' + title + '</h2>' + b(right) + '</div>';
  }
  function segHTML(name, options, value, cls) {
    return '<div class="segmented' + (cls ? ' ' + cls : '') + '">' + options.map(function (o) {
      return '<button data-act="seg" data-seg="' + name + '" data-value="' + o[0] + '"' + (String(o[0]) === String(value) ? ' class="on"' : '') + '>' + o[1] + '</button>';
    }).join('') + '</div>';
  }
  function flagsHTML(sd, sf) {
    return '<h2 class="section-label">Sugar</h2><div class="card list">' +
      '<label class="row"><span class="row-icon">🧋</span><span class="row-text">Sugary drink</span><input type="checkbox" class="switch bad" data-flag="sd"' + (sd ? ' checked' : '') + '></label>' +
      '<label class="row"><span class="row-icon">🍰</span><span class="row-text">Sweet food</span><input type="checkbox" class="switch bad" data-flag="sf"' + (sf ? ' checked' : '') + '></label></div>';
  }
  function mealSegHTML(v) { return '<h2 class="section-label">Meal</h2>' + segHTML('meal', MEALS.map(function (m) { return [m.id, MEAL_LABEL[m.id]]; }), v); }
  function formRow(label, id, val, unit, attrs) {
    return '<div class="row form-row"><span class="lbl">' + label + '</span><input id="' + id + '" value="' + esc(val == null ? '' : val) + '" ' + (attrs || 'type="number" inputmode="decimal"') + '>' + (unit ? '<span class="unit">' + unit + '</span>' : '') + '</div>';
  }
  function foodTags(f) {
    return (f.sd ? '<span class="tagline">🧋 sugary</span>' : '') + (f.sf ? '<span class="tagline">🍰 sweet</span>' : '') +
      (f.source === 'custom' && f.id ? '<span class="tagline">mine</span>' : '') + (f.source === 'barcode' ? '<span class="tagline">scanned</span>' : '');
  }

  /* ---------- Add food sheet ---------- */
  function foodSheet(opts) {
    opts = opts || {};
    var s = { view: 'list', meal: opts.meal || defaultMeal(), chip: null, q: '', results: [], food: null, portion: 1, mode: 'g', amount: 100, sd: false, sf: false, edit: null, product: null, status: '' };
    if (opts.editId) {
      var m = dayMeals(state.view).filter(function (x) { return x.id === opts.editId; })[0];
      if (m) {
        s.edit = m; s.meal = m.meal; s.food = foodFromEntry(m); s.sd = !!m.isSugaryDrink; s.sf = !!m.isSweetFood; s.view = 'portion';
        if (s.food.per100) { s.mode = 'g'; s.amount = Math.round(m.portion * 100); } else s.portion = m.portion;
      }
    }

    function pickFood(f) {
      s.food = f; s.sd = f.sd; s.sf = f.sf; s.portion = 1;
      var d = defaultAmount(f); s.mode = d.mode; s.amount = d.amount;
      s.view = 'portion'; renderSheet();
    }
    function current() { return calcFood(s.food, s.portion, s.mode, s.amount); }
    function updatePreview() {
      var c = current();
      if ($('p-kcal')) $('p-kcal').innerHTML = fmt(c.kcal) + ' <small>kcal</small>';
      if ($('p-prot')) $('p-prot').textContent = round1(c.protein) + ' g protein';
    }

    // ----- list view -----
    function resultsHTML() {
      var groups = [];
      if (s.q) groups.push(['', searchFoods(s.q)]);
      else if (s.chip === 'favs') groups.push(['Favourites', favs.map(getFood).filter(Boolean)]);
      else if (s.chip === 'recent') groups.push(['Recent', recentFoods()]);
      else {
        var r = recentFoods();
        if (r.length) groups.push(['Recent', r]);
        groups.push([r.length ? 'All foods' : 'Common foods', allFoods()]);
      }
      s.results = [];
      var html = '';
      groups.forEach(function (g) {
        if (g[0]) html += '<h2 class="section-label">' + g[0] + '</h2>';
        if (!g[1].length) {
          var msg = s.q ? 'No match. Try another word, or use ✏️ Quick add.' : s.chip === 'favs' ? 'Tap ☆ on any food to keep it here.' : 'Foods you log will show up here.';
          html += '<div class="card"><div class="empty">' + msg + '</div></div>';
          return;
        }
        html += '<div class="card list">' + g[1].map(function (f) {
          var i = s.results.push(f) - 1, fav = f.id && favs.indexOf(f.id) >= 0;
          return '<div class="food-row"><button class="food-pick" data-act="pick" data-i="' + i + '"><div class="food-name">' + esc(f.name) + foodTags(f) + '</div>' +
            '<div class="food-meta">' + esc(servingText(f)) + ' · ' + fmt(listKcal(f)) + ' kcal · ' + round1(listProt(f)) + ' g protein</div></button>' +
            '<button class="star' + (fav ? ' on' : '') + '" data-act="star" data-i="' + i + '" aria-label="Favourite"' + (f.id ? '' : ' disabled') + '>' + (fav ? '★' : '☆') + '</button>' +
            '<button class="round-btn quick-add" data-act="qadd" data-i="' + i + '" aria-label="Add 1 serving">+</button></div>';
        }).join('') + '</div>';
      });
      return html;
    }
    function listHTML() {
      return headHTML({ act: 'close', label: 'Cancel' }, 'Add food', { act: 'close', label: 'Done' }) +
        segHTML('meal', MEALS.map(function (m) { return [m.id, MEAL_LABEL[m.id]]; }), s.meal) +
        '<div class="chips" style="margin-top:12px">' +
        '<button class="chip-btn' + (s.chip === 'favs' ? ' on' : '') + '" data-act="chip" data-chip="favs"><span class="ci">⭐</span>Favourites</button>' +
        '<button class="chip-btn' + (s.chip === 'recent' ? ' on' : '') + '" data-act="chip" data-chip="recent"><span class="ci">🕘</span>Recent</button>' +
        '<button class="chip-btn" data-act="scan"><span class="ci">📷</span>Scan barcode</button>' +
        '<button class="chip-btn" data-act="quick"><span class="ci">✏️</span>Quick add</button></div>' +
        '<input class="search" id="food-search" type="search" placeholder="Search foods &amp; drinks" autocomplete="off" enterkeyhint="search" value="' + esc(s.q) + '">' +
        '<div id="food-results">' + resultsHTML() + '</div>' +
        '<p class="note">Calories are estimates. Shop portions vary, so consistency matters more than perfection.</p>';
    }

    // ----- portion view -----
    function portionHTML() {
      var f = s.food, c = current(), fav = f.id && favs.indexOf(f.id) >= 0;
      var body = '<div class="portion-title"><h3>' + esc(f.name) + '</h3><p>' + esc(f.per100 ? 'Per 100 ' + f.unit + ': ' + fmt(f.kcal) + ' kcal · ' + round1(f.protein) + ' g protein' : '1 = ' + f.serving) + '</p></div>' +
        '<div class="big-kcal" id="p-kcal">' + fmt(c.kcal) + ' <small>kcal</small></div><div class="big-sub" id="p-prot">' + round1(c.protein) + ' g protein</div>';
      if (f.per100) {
        body += '<h2 class="section-label">Amount eaten</h2>' +
          (f.perServing ? segHTML('mode', [['serv', 'Servings'], ['g', f.unit === 'ml' ? 'Millilitres' : 'Grams']], s.mode) + '<div style="height:10px"></div>' : '') +
          '<div class="card list">' + formRow(s.mode === 'serv' ? 'Servings' : 'Amount', 'p-amount', s.amount, s.mode === 'serv' ? '' : f.unit, 'type="number" inputmode="decimal" min="0" step="' + (s.mode === 'serv' ? '0.5' : '10') + '"') + '</div>' +
          (f.perServing ? '<p class="note">1 serving = ' + esc(f.perServing.label) + ' · ' + fmt(f.perServing.kcal) + ' kcal</p>' : '');
      } else {
        body += '<h2 class="section-label">Portion</h2>' + segHTML('portion', PORTIONS.map(function (p) { return [p, PORTION_LABEL[p]]; }), s.portion, 'portion') +
          '<h2 class="section-label">Hand-size guide</h2><div class="hands">' +
          '<div><b>✋</b><strong>Palm</strong><br>protein</div><div><b>✊</b><strong>Fist</strong><br>rice / carbs</div>' +
          '<div><b>🤲</b><strong>Cupped hand</strong><br>snacks</div><div><b>👍</b><strong>Thumb</strong><br>oil / sauce</div></div>' +
          '<p class="note">1 = the standard serving above. Compare with your hand: a fist of rice is about 1 cup.</p>';
      }
      body += flagsHTML(s.sd, s.sf) + mealSegHTML(s.meal);
      if (f.id) body += '<button class="btn-danger-plain" style="color:var(--accent)" data-act="fav-food">' + (fav ? '★ Remove from Favourites' : '☆ Add to Favourites') + '</button>';
      if (s.edit) body += '<button class="btn-danger-plain" data-act="delete">Delete entry</button>';
      return headHTML(s.edit ? { act: 'close', label: 'Cancel' } : { act: 'back', label: '‹ Back' }, s.edit ? 'Edit' : MEAL_LABEL[s.meal], { act: 'confirm', label: s.edit ? 'Save' : 'Add' }) + body;
    }

    // ----- quick add view -----
    function quickHTML() {
      return headHTML({ act: 'back', label: '‹ Back' }, 'Quick add', { act: 'confirm', label: 'Add' }) +
        '<div class="card list">' +
        formRow('Name', 'q-name', '', '', 'type="text" maxlength="80" placeholder="e.g. Mum’s curry"') +
        formRow('Calories', 'q-kcal', '', 'kcal', 'type="number" inputmode="numeric" min="0" placeholder="0"') +
        formRow('Protein <span class="muted">(optional)</span>', 'q-prot', '', 'g', 'type="number" inputmode="decimal" min="0" placeholder="0"') +
        '</div>' + flagsHTML(s.sd, s.sf) +
        '<div class="card list" style="margin-top:12px"><label class="row check-row"><span class="row-text">Save as my food</span><input type="checkbox" id="q-save" checked></label></div>' +
        mealSegHTML(s.meal);
    }

    // ----- scanner view -----
    function scanHTML() {
      return headHTML({ act: 'back', label: '‹ Back' }, 'Scan barcode', null) +
        '<div class="scanner"><video id="scan-video" playsinline muted autoplay></video><div class="scan-frame"></div></div>' +
        '<p class="scan-status" id="scan-status">' + (s.status || 'Starting camera…') + '</p>' +
        '<h2 class="section-label">Type barcode instead</h2>' +
        '<form class="inline-form" id="bc-form"><input id="bc-input" inputmode="numeric" pattern="[0-9]*" maxlength="14" autocomplete="off" placeholder="e.g. 9556001234567">' +
        '<button class="btn btn-primary" type="submit">Look up</button></form>' +
        '<p class="note">Product details come from Open Food Facts, a free community database. Only the barcode number is sent.</p>';
    }
    function setStatus(t) { s.status = t; if ($('scan-status')) $('scan-status').textContent = t; }

    function lookup(raw) {
      var code = String(raw || '').replace(/\D/g, '');
      if (!/^\d{8,14}$/.test(code)) { setStatus('Barcodes have 8 to 14 digits.'); return; }
      stopScanner();
      var saved = customFoods['bc-' + code];
      if (saved) { showProduct(productFromCustom(saved, 'saved')); return; }
      var blank = { barcode: code, name: '', kcal100: '', protein100: '', unit: 'g', serving: null, sd: false, sf: false };
      if (!navigator.onLine) { showProduct(Object.assign(blank, { status: 'offline' })); return; }
      setStatus('Looking up ' + code + '…');
      var ctrl = window.AbortController ? new AbortController() : null;
      var to = setTimeout(function () { if (ctrl) ctrl.abort(); }, 10000);
      fetch(OFF_URL + code + '.json?fields=' + OFF_FIELDS, ctrl ? { signal: ctrl.signal } : {})
        .then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function (j) {
          clearTimeout(to);
          if (!sheet.ctl || sheet.ctl !== ctl) return;
          var p = j && j.status === 1 && j.product ? parseOFF(code, j.product) : null;
          if (p) {
            customFoods['bc-' + code] = productToCustom(p); saveFoods();  // works offline next time
            showProduct(p);
          } else showProduct(Object.assign(blank, { status: 'notfound' }));
        })
        .catch(function () {
          clearTimeout(to);
          if (sheet.ctl === ctl) showProduct(Object.assign(blank, { status: navigator.onLine ? 'error' : 'offline' }));
        });
    }
    function showProduct(p) { s.product = p; s.sd = p.sd; s.sf = p.sf; var d = p.serving ? { mode: 'serv', amount: 1 } : { mode: 'g', amount: 100 }; s.mode = d.mode; s.amount = d.amount; s.view = 'product'; renderSheet(); }

    // ----- product view (found / saved / manual) -----
    function productFood() {
      var p = s.product, k = num(p.kcal100) || 0, pr = num(p.protein100) || 0, sv = null;
      if (p.serving) {
        sv = { label: p.serving.label, kcal: p.serving.qty ? k * p.serving.qty / 100 : p.serving.kcal, protein: p.serving.qty ? pr * p.serving.qty / 100 : p.serving.protein };
      }
      return { id: 'bc-' + p.barcode, name: str(p.name, 100) || 'Barcode ' + p.barcode, serving: '100 ' + p.unit, kcal: k, protein: pr, sd: s.sd, sf: s.sf, source: 'barcode', barcode: p.barcode, per100: true, unit: p.unit, perServing: sv, alt: '' };
    }
    function productHTML() {
      var p = s.product, f = productFood(), c = calcFood(f, 1, s.mode, s.amount);
      var msg = {
        found: '✓ Found on Open Food Facts. Check the numbers against the label if you can.',
        saved: '✓ Saved on this phone from an earlier scan.',
        notfound: 'Not found on Open Food Facts. Enter it from the nutrition label and it’ll be saved for next time.',
        offline: 'You’re offline. Enter it from the nutrition label and it’ll be saved for next time.',
        error: 'Couldn’t reach Open Food Facts. Enter it from the nutrition label and it’ll be saved for next time.'
      }[p.status] || '';
      return headHTML({ act: 'back', label: '‹ Back' }, 'Product', { act: 'confirm', label: 'Add' }) +
        '<p class="note" style="margin-top:0">' + msg + '</p>' +
        '<div class="card list" style="margin-top:10px">' +
        formRow('Barcode', 'pr-code', p.barcode, '', 'type="text" readonly') +
        formRow('Name', 'pr-name', p.name, '', 'type="text" maxlength="100" placeholder="Product name"') +
        formRow('kcal / 100 ' + p.unit, 'pr-kcal', p.kcal100 === '' ? '' : round1(num(p.kcal100) || 0), '', 'type="number" inputmode="decimal" min="0" placeholder="0"') +
        formRow('Protein / 100 ' + p.unit, 'pr-prot', p.protein100 === '' ? '' : round1(num(p.protein100) || 0), 'g', 'type="number" inputmode="decimal" min="0" placeholder="0"') +
        '</div>' +
        '<div style="height:10px"></div>' + segHTML('unit', [['g', 'Solid (g)'], ['ml', 'Drink (ml)']], p.unit) +
        (f.perServing ? '<p class="note">Per serving (' + esc(f.perServing.label) + '): ' + fmt(f.perServing.kcal) + ' kcal · ' + round1(f.perServing.protein) + ' g protein</p>' : '') +
        '<div class="big-kcal" id="p-kcal">' + fmt(c.kcal) + ' <small>kcal</small></div><div class="big-sub" id="p-prot">' + round1(c.protein) + ' g protein</div>' +
        '<h2 class="section-label">Amount eaten</h2>' +
        (p.serving ? segHTML('mode', [['serv', 'Servings'], ['g', p.unit === 'ml' ? 'Millilitres' : 'Grams']], s.mode) + '<div style="height:10px"></div>' : '') +
        '<div class="card list">' + formRow(s.mode === 'serv' ? 'Servings' : 'Amount', 'p-amount', s.amount, s.mode === 'serv' ? '' : p.unit, 'type="number" inputmode="decimal" min="0" step="' + (s.mode === 'serv' ? '0.5' : '10') + '"') + '</div>' +
        flagsHTML(s.sd, s.sf) +
        '<p class="note">Auto-marked when sugar is high (15 g+ per 100 g for food, 5 g+ per 100 ml for drinks). Change it if it’s wrong.</p>' +
        mealSegHTML(s.meal);
    }
    function readProductFields() {
      var p = s.product;
      if ($('pr-name')) { p.name = $('pr-name').value; p.kcal100 = $('pr-kcal').value; p.protein100 = $('pr-prot').value; }
    }

    // ----- confirm actions -----
    function confirmPortion() {
      if (s.food.per100 && !(s.amount > 0)) { toast('Enter how much you had'); return; }
      var c = current(), entry = makeEntry(s.food, c, s.meal, { sd: s.sd, sf: s.sf }, s.edit);
      if (s.edit) saveEditedEntry(entry);
      else addEntries([entry], 'Added to ' + MEAL_LABEL[s.meal].toLowerCase() + ' ✓');
      closeSheet();
    }
    function confirmQuick() {
      var name = str($('q-name').value, 80) || 'Quick add', kcal = num($('q-kcal').value), prot = num($('q-prot').value) || 0;
      if (kcal == null || kcal < 0 || kcal > 5000) { toast('Enter the calories (0–5000)'); $('q-kcal').focus(); return; }
      var f = { id: null, name: name, serving: '1 serving', kcal: Math.round(kcal), protein: round1(clamp(prot, 0, 500)), sd: s.sd, sf: s.sf, source: 'custom', barcode: null, per100: false, unit: 'g', perServing: null };
      if ($('q-save').checked) {
        f.id = 'c-' + newId();
        customFoods[f.id] = { id: f.id, name: f.name, serving: f.serving, kcal: f.kcal, protein: f.protein, isSugaryDrink: s.sd, isSweetFood: s.sf };
        saveFoods();
      }
      addEntries([makeEntry(f, calcFood(f, 1), s.meal, { sd: s.sd, sf: s.sf })], 'Added to ' + MEAL_LABEL[s.meal].toLowerCase() + ' ✓');
      closeSheet();
    }
    function confirmProduct() {
      readProductFields();
      var p = s.product, k = num(p.kcal100);
      if (!str(p.name, 100)) { toast('Add a name for this product'); $('pr-name').focus(); return; }
      if (k == null || k < 0 || k > 1000) { toast('Enter kcal per 100 ' + p.unit + ' from the label'); $('pr-kcal').focus(); return; }
      if (!(s.amount > 0)) { toast('Enter how much you had'); return; }
      p.sd = s.sd; p.sf = s.sf;
      customFoods['bc-' + p.barcode] = productToCustom(p); saveFoods();
      var f = productFood();
      addEntries([makeEntry(f, calcFood(f, 1, s.mode, s.amount), s.meal, { sd: s.sd, sf: s.sf })], 'Added to ' + MEAL_LABEL[s.meal].toLowerCase() + ' ✓');
      closeSheet();
    }

    var ctl = {
      html: function () {
        return s.view === 'portion' ? portionHTML() : s.view === 'quick' ? quickHTML() : s.view === 'scan' ? scanHTML() : s.view === 'product' ? productHTML() : listHTML();
      },
      mount: function () {
        if (s.view === 'scan') { s.status = ''; startScanner(lookup, setStatus); }
        if (s.view === 'quick') setTimeout(function () { if ($('q-name')) $('q-name').focus(); }, 350);
      },
      close: function () { stopScanner(); },
      click: function (act, b) {
        var f;
        if (act === 'seg') {
          var v = b.dataset.value, which = b.dataset.seg;
          if (which === 'meal') { s.meal = v; if (s.view === 'portion' && !s.edit) $('sheet-body').querySelector('.sheet-head h2').textContent = MEAL_LABEL[v]; }
          else if (which === 'portion') { s.portion = parseFloat(v); updatePreview(); }
          else if (which === 'mode') {
            readProductFields(); s.mode = v; s.amount = v === 'serv' ? 1 : 100; renderSheet();
          } else if (which === 'unit') { readProductFields(); s.product.unit = v; renderSheet(); }
        } else if (act === 'chip') { s.chip = s.chip === b.dataset.chip ? null : b.dataset.chip; s.q = ''; renderSheet(); }
        else if (act === 'pick') pickFood(s.results[+b.dataset.i]);
        else if (act === 'qadd') {
          f = s.results[+b.dataset.i];
          var d = defaultAmount(f);
          addEntries([makeEntry(f, calcFood(f, 1, d.mode, d.amount), s.meal, { sd: f.sd, sf: f.sf })], 'Added ' + f.name + ' ✓');
          b.textContent = '✓'; b.disabled = true;
          setTimeout(function () { if (sheet.ctl === ctl && s.view === 'list') $('food-results').innerHTML = resultsHTML(); }, 700);
        } else if (act === 'star') {
          f = s.results[+b.dataset.i];
          var on = toggleFav(f.id);
          b.classList.toggle('on', on); b.textContent = on ? '★' : '☆';
          if (s.chip === 'favs' && !on) $('food-results').innerHTML = resultsHTML();
        } else if (act === 'fav-food') {
          var on2 = toggleFav(s.food.id);
          b.textContent = on2 ? '★ Remove from Favourites' : '☆ Add to Favourites';
          toast(on2 ? 'Added to Favourites ⭐' : 'Removed from Favourites');
        } else if (act === 'scan') { s.view = 'scan'; renderSheet(); }
        else if (act === 'quick') { s.view = 'quick'; s.sd = false; s.sf = false; renderSheet(); }
        else if (act === 'back') { stopScanner(); s.view = s.view === 'product' ? 'scan' : 'list'; s.status = ''; renderSheet(); }
        else if (act === 'confirm') { if (s.view === 'portion') confirmPortion(); else if (s.view === 'quick') confirmQuick(); else if (s.view === 'product') confirmProduct(); }
        else if (act === 'delete') { deleteEntry(s.edit.id); closeSheet(); }
      },
      input: function (ev) {
        var t = ev.target;
        if (t.id === 'food-search') { s.q = t.value; if (s.q) s.chip = null; $('food-results').innerHTML = resultsHTML(); $('sheet-body').querySelectorAll('.chip-btn[data-chip]').forEach(function (c) { c.classList.toggle('on', c.dataset.chip === s.chip); }); }
        else if (t.id === 'p-amount') { s.amount = num(t.value) || 0; if (s.view === 'product') { readProductFields(); var c = calcFood(productFood(), 1, s.mode, s.amount); $('p-kcal').innerHTML = fmt(c.kcal) + ' <small>kcal</small>'; $('p-prot').textContent = round1(c.protein) + ' g protein'; } else updatePreview(); }
        else if (t.id === 'pr-kcal' || t.id === 'pr-prot' || t.id === 'pr-name') { readProductFields(); var c2 = calcFood(productFood(), 1, s.mode, s.amount); $('p-kcal').innerHTML = fmt(c2.kcal) + ' <small>kcal</small>'; $('p-prot').textContent = round1(c2.protein) + ' g protein'; }
      },
      change: function (ev) { var fl = ev.target.dataset && ev.target.dataset.flag; if (fl) s[fl] = ev.target.checked; },
      submit: function () { lookup($('bc-input').value); }
    };
    if (opts.view === 'scan') s.view = 'scan';
    return ctl;
  }

  /* ---------- Open Food Facts ---------- */
  function parseOFF(code, p) {
    var n = p.nutriments || {};
    var k = num(n['energy-kcal_100g']);
    if (k == null && num(n.energy_100g) != null) k = num(n.energy_100g) / 4.184;   // kJ → kcal
    var pr = num(n.proteins_100g), sugar = num(n.sugars_100g);
    var cats = (p.categories_tags || []).join(' ');
    var drink = /beverages|drinks/.test(cats) || p.product_quantity_unit === 'ml' || /\d\s*(ml|cl|l)\b/i.test(p.quantity || '');
    var unit = drink ? 'ml' : 'g';
    var serving = null, sq = num(p.serving_quantity), ks = num(n['energy-kcal_serving']);
    if (sq > 0 && k != null) serving = { label: p.serving_size || (sq + ' ' + unit), qty: sq, kcal: k * sq / 100, protein: (pr || 0) * sq / 100 };
    else if (ks != null) serving = { label: p.serving_size || '1 serving', qty: null, kcal: ks, protein: num(n.proteins_serving) || 0 };
    var name = str(p.product_name || p.product_name_en, 80) || str((p.brands || '').split(',')[0], 60);
    if (!name && k == null) return null;
    return {
      barcode: code, name: name, kcal100: k == null ? '' : round1(k), protein100: pr == null ? '' : round1(pr), unit: unit, serving: serving,
      sd: drink && sugar != null && sugar >= 5, sf: !drink && sugar != null && sugar >= 15, status: 'found'
    };
  }
  function productToCustom(p) {
    var k = num(p.kcal100) || 0, pr = num(p.protein100) || 0, sv = null;
    if (p.serving) sv = { label: p.serving.label, kcal: p.serving.qty ? round1(k * p.serving.qty / 100) : p.serving.kcal, protein: p.serving.qty ? round1(pr * p.serving.qty / 100) : p.serving.protein, qty: p.serving.qty || null };
    return { id: 'bc-' + p.barcode, name: str(p.name, 100) || 'Barcode ' + p.barcode, serving: '100 ' + p.unit, kcal: round1(k), protein: round1(pr), isSugaryDrink: !!p.sd, isSweetFood: !!p.sf, barcode: p.barcode, per100: true, unit: p.unit, perServing: sv };
  }
  function productFromCustom(c, status) {
    return { barcode: c.barcode, name: c.name, kcal100: c.kcal, protein100: c.protein, unit: c.unit === 'ml' ? 'ml' : 'g', serving: c.perServing ? { label: c.perServing.label, qty: c.perServing.qty || null, kcal: c.perServing.kcal, protein: c.perServing.protein } : null, sd: !!c.isSugaryDrink, sf: !!c.isSweetFood, status: status };
  }

  /* ---------- camera barcode scanner ---------- */
  var scanner = { active: false, stream: null, timer: null, reader: null };
  function loadScript(src) {
    return new Promise(function (res, rej) { var sc = document.createElement('script'); sc.src = src; sc.async = true; sc.onload = res; sc.onerror = rej; document.head.appendChild(sc); });
  }
  function camError(err, setStatus) {
    if (!scanner.active) return;
    stopScanner();
    setStatus(err && err.name === 'NotAllowedError' ? 'Camera permission was denied. Type the barcode below instead.' : 'Couldn’t start the camera. Type the barcode below instead.');
  }
  function startScanner(onCode, setStatus) {
    var video = $('scan-video');
    if (!video || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { setStatus('Camera isn’t available here. Type the barcode below.'); return; }
    scanner.active = true;
    var found = function (code) { if (!scanner.active) return; stopScanner(); if (navigator.vibrate) navigator.vibrate(40); onCode(code); };
    var useZXing = function () {
      setStatus('Loading scanner…');
      (window.ZXing ? Promise.resolve() : loadScript(ZXING_URL)).then(function () {
        if (!scanner.active) return;
        var Z = window.ZXing, hints = new Map();
        hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E]);
        scanner.reader = new Z.BrowserMultiFormatReader(hints);
        setStatus('Point the camera at the barcode');
        return scanner.reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, video, function (result) { if (result) found(result.getText()); });
      }).catch(function (e) { if (e && e.name) camError(e, setStatus); else { stopScanner(); setStatus('Scanner couldn’t load (offline?). Type the barcode below.'); } });
    };
    if ('BarcodeDetector' in window) {
      Promise.resolve(window.BarcodeDetector.getSupportedFormats ? window.BarcodeDetector.getSupportedFormats() : []).then(function (fmts) {
        var want = ['ean_13', 'ean_8', 'upc_a', 'upc_e'].filter(function (x) { return fmts.indexOf(x) >= 0; });
        if (!want.length) { useZXing(); return; }
        var det = new window.BarcodeDetector({ formats: want });
        return navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then(function (stream) {
          if (!scanner.active) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
          scanner.stream = stream; video.srcObject = stream;
          var pl = video.play(); if (pl && pl.catch) pl.catch(function () { });
          setStatus('Point the camera at the barcode');
          var tick = function () {
            if (!scanner.active) return;
            det.detect(video).then(function (codes) {
              if (codes && codes.length) found(codes[0].rawValue); else scanner.timer = setTimeout(tick, 200);
            }).catch(function () { scanner.timer = setTimeout(tick, 300); });
          };
          tick();
        });
      }).catch(function (e) { camError(e, setStatus); });
    } else useZXing();
  }
  function stopScanner() {
    scanner.active = false;
    clearTimeout(scanner.timer);
    if (scanner.reader) { try { scanner.reader.reset(); } catch (e) { } scanner.reader = null; }
    if (scanner.stream) { scanner.stream.getTracks().forEach(function (t) { t.stop(); }); scanner.stream = null; }
  }

  /* ---------- calorie goal calculator (Mifflin-St Jeor) ---------- */
  function calcSheet() {
    var pr = settings.profile || {};
    var c = { sex: pr.sex || 'female', age: pr.age || '', cm: pr.heightCm || '', kg: latestWeight() || '', activity: ACTIVITY[pr.activity] ? pr.activity : 'light' };
    function read() { c.age = num($('c-age').value); c.cm = num($('c-cm').value); c.kg = num($('c-kg').value); }
    function valid() { return c.age >= 15 && c.age <= 100 && c.cm >= 120 && c.cm <= 230 && c.kg >= 30 && c.kg <= 300; }
    function maintenance() { return (10 * c.kg + 6.25 * c.cm - 5 * c.age + (c.sex === 'male' ? 5 : -161)) * ACTIVITY[c.activity].f; }
    function results() {
      if (!valid()) return '<div class="card"><div class="empty">Fill in age, height and weight to see your options.</div></div>';
      var m = maintenance();
      return '<div class="card list">' + [['Maintain', m, 'Keep your weight steady'], ['Gentle loss', m - 300, 'About −300 kcal a day'], ['Steady loss', m - 500, 'About −500 kcal a day']].map(function (o) {
        var r = Math.round(o[1] / 50) * 50, v = Math.max(1200, r);
        return '<button class="calc-choice" data-act="choose" data-kcal="' + v + '"><span class="row-text"><b>' + o[0] + '</b><small>' + o[2] + (r < 1200 ? ' · kept at the 1,200 minimum' : '') + '</small></span><span class="kc">' + fmt(v) + '</span><span class="unit">kcal</span></button>';
      }).join('') + '</div><p class="note">Your maintenance is about ' + fmt(Math.round(m / 10) * 10) + ' kcal a day. Tap a goal to use it.</p>';
    }
    return {
      html: function () {
        return headHTML({ act: 'close', label: 'Cancel' }, 'Daily calorie goal', null) +
          '<h2 class="section-label" style="margin-top:6px">About you</h2>' + segHTML('sex', [['female', 'Female'], ['male', 'Male']], c.sex) +
          '<div class="card list" style="margin-top:10px">' +
          formRow('Age', 'c-age', c.age, 'years', 'type="number" inputmode="numeric" min="15" max="100"') +
          formRow('Height', 'c-cm', c.cm, 'cm', 'type="number" inputmode="decimal" min="120" max="230"') +
          formRow('Weight', 'c-kg', c.kg, 'kg', 'type="number" inputmode="decimal" step="0.1" min="30" max="300"') + '</div>' +
          '<h2 class="section-label">Activity</h2><div class="seg-wrap">' + segHTML('activity', Object.keys(ACTIVITY).map(function (a) { return [a, ACTIVITY[a].label]; }), c.activity) + '</div>' +
          '<p class="note" id="act-hint">' + ACTIVITY[c.activity].hint + '</p>' +
          '<h2 class="section-label">Choose a goal</h2><div id="calc-results">' + results() + '</div>' +
          '<p class="note">These are estimates (Mifflin-St Jeor equation × activity). The app never suggests less than 1,200 kcal. A doctor or dietitian can give you personalised advice.</p>';
      },
      click: function (act, b) {
        if (act === 'seg') {
          read();
          if (b.dataset.seg === 'sex') c.sex = b.dataset.value;
          else { c.activity = b.dataset.value; $('act-hint').textContent = ACTIVITY[c.activity].hint; }
          $('calc-results').innerHTML = results();
        } else if (act === 'choose') {
          read();
          var kcal = +b.dataset.kcal;
          settings.calorieGoal = kcal;
          settings.profile = { sex: c.sex, age: Math.round(c.age), heightCm: round1(c.cm), activity: c.activity };
          saveSettings();
          var kg = round1(c.kg);
          if (kg !== latestWeight()) setWeight(state.today, kg);
          closeSheet(); render();
          toast('Daily goal set to ' + fmt(kcal) + ' kcal 🎯');
        }
      },
      input: function () { read(); $('calc-results').innerHTML = results(); }
    };
  }

  /* ---------- Calendar: day summary sheet ---------- */
  function daySheet(k) {
    var e = data[k], d = parseKey(k), s = statusOf(e);
    var title = DAYS[d.getDay()] + ', ' + MON_SHORT[d.getMonth()] + ' ' + d.getDate();
    return {
      html: function () {
        var html = headHTML({ act: 'close', label: 'Close' }, title, null) +
          '<div class="card status-card ' + s + '" style="margin-top:4px"><div class="status-dot">' + STATUS_TEXT[s].icon + '</div><div class="status-text">' +
          '<div class="status-title">' + (s === 'none' ? 'Not logged' : STATUS_TEXT[s].title) + '</div>' +
          '<div class="status-msg">' + (s === 'none' ? 'Nothing was saved for this day.' : STATUS_TEXT[s].msg) + '</div>' +
          (sugarCauses(k).text ? '<div class="status-causes">' + esc(sugarCauses(k).text) + '</div>' : '') + '</div></div>';
        if (e) {
          var rows = [['💧', 'Water', (e.water || 0) + ' / ' + settings.waterGoal + ' glasses'],
            ['🥦', 'Veggies / fruit', e.veggiesFruit ? 'Yes' : 'No'], ['🍟', 'Fried / processed', e.processed ? 'Yes' : 'No']];
          var t = totals(k);
          if (settings.trackDiet && t.n) rows.push(['🍽️', 'Calories', fmt(t.kcal) + (settings.calorieGoal ? ' / ' + fmt(settings.calorieGoal) : '') + ' kcal'], ['💪', 'Protein', Math.round(t.protein) + ' g']);
          var cr = { none: 'None', resisted: 'Resisted', gaveIn: 'Gave in' }, md = { bad: '😞', okay: '😐', good: '😊' };
          rows.push(['🍬', 'Cravings', cr[e.craving] || 'None']);
          if (md[e.mood]) rows.push(['🙂', 'Mood', md[e.mood]]);
          html += '<div class="card list" style="margin-top:12px">' + rows.map(function (r) {
            return '<div class="row"><span class="row-icon">' + r[0] + '</span><span class="row-text">' + r[1] + '</span><span class="muted">' + r[2] + '</span></div>';
          }).join('') + '</div>';
          if (settings.trackDiet && t.n) {
            html += '<h2 class="section-label">Meals</h2><div class="card list">' + MEALS.map(function (M) {
              var items = dayMeals(k).filter(function (m) { return m.meal === M.id; });
              if (!items.length) return '';
              return '<div class="row day-meal"><span class="row-icon">' + M.icon + '</span><span class="row-text">' + items.map(function (m) { return esc(m.name); }).join(', ') +
                '</span><span class="muted">' + fmt(items.reduce(function (a, m) { return a + m.kcal; }, 0)) + '</span></div>';
            }).join('') + '</div>';
          }
          if (e.notes) html += '<h2 class="section-label">Notes</h2><div class="card pad day-notes">' + esc(e.notes) + '</div>';
        }
        return html + '<button class="btn btn-primary btn-block" data-act="open-day" style="margin-top:18px">Open this day</button>';
      },
      click: function (act) {
        if (act === 'open-day') { closeSheet(); openToday(k); }
      }
    };
  }

  /* ---------- weight ---------- */
  function setWeight(date, kg) {
    weights = weights.filter(function (w) { return w.date !== date; });
    weights.push({ date: date, kg: kg });
    weights.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    saveWeights();
  }
  function weightSheet() {
    function listHTML() {
      if (!weights.length) return '';
      return '<h2 class="section-label">Recent weigh-ins</h2><div class="card list">' + weights.slice(-8).reverse().map(function (w) {
        return '<div class="row"><span class="row-text">' + shortDate(w.date) + ', ' + w.date.slice(0, 4) + '</span><span>' + w.kg.toFixed(1) + ' kg</span><button class="w-del" data-act="wdel" data-date="' + w.date + '" aria-label="Remove">✕</button></div>';
      }).join('') + '</div>';
    }
    return {
      html: function () {
        return headHTML({ act: 'close', label: 'Cancel' }, 'Log weight', { act: 'confirm', label: 'Save' }) +
          '<div class="card list">' +
          formRow('Weight', 'w-kg', latestWeight() || '', 'kg', 'type="number" inputmode="decimal" step="0.1" min="25" max="300" placeholder="0.0"') +
          formRow('Date', 'w-date', state.today, '', 'type="date" max="' + state.today + '"') + '</div>' +
          '<p class="note">Weigh yourself at the same time of day, e.g. in the morning before breakfast. Day-to-day changes are normal; the trend line shows the bigger picture.</p>' +
          '<div id="w-list">' + listHTML() + '</div>';
      },
      mount: function () { setTimeout(function () { var i = $('w-kg'); if (i) { i.focus(); i.select(); } }, 350); },
      click: function (act, b) {
        if (act === 'confirm') {
          var kg = round1(num($('w-kg').value) || 0), date = $('w-date').value;
          if (!(kg >= 25 && kg <= 300)) { toast('Enter your weight in kg'); $('w-kg').focus(); return; }
          if (!isValidKey(date) || date > state.today) date = state.today;
          setWeight(date, kg); closeSheet(); render(); toast('Weight saved ✓');
        } else if (act === 'wdel') {
          var d = b.dataset.date;
          weights = weights.filter(function (w) { return w.date !== d; }); saveWeights();
          $('w-list').innerHTML = listHTML(); render();
        }
      }
    };
  }
  function signed(v, unit) { var r = round1(v); return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r).toFixed(1) + unit; }
  function renderWeightCard() {
    var html = '<div class="weight-top"><div>';
    var last = weights[weights.length - 1];
    html += last ? '<div class="weight-now">' + last.kg.toFixed(1) + ' <small>kg</small></div><div class="weight-date">' + shortDate(last.date) + '</div>'
      : '<div class="weight-now"><small>No weigh-ins yet</small></div>';
    html += '</div><button class="btn-tinted" data-act="logweight">+ Log weight</button></div>';
    if (weights.length >= 2) {
      var first = weights[0], days = (parseKey(last.date) - parseKey(first.date)) / 864e5;
      html += '<div class="weight-chart">' + weightChartSVG() + '</div><div class="weight-stats">' +
        '<div><div class="k">Change since start</div><div class="v">' + signed(last.kg - first.kg, ' kg') + '</div></div>' +
        '<div><div class="k">Average weekly change</div><div class="v">' + (days >= 7 ? signed((last.kg - first.kg) / (days / 7), ' kg') : '—') + '</div></div></div>';
    } else html += '<p class="note">Log your weight about once a week to see your trend here.</p>';
    $('weight-card').innerHTML = html;
    renderWeighBanners();
  }
  function weightChartSVG() {
    var W = 320, H = 130, L = 30, R = 8, T = 10, B = 20;
    var pts = weights.slice(-26), t0 = parseKey(pts[0].date).getTime(), t1 = parseKey(pts[pts.length - 1].date).getTime();
    var span = Math.max(t1 - t0, 864e5);
    var ks = pts.map(function (p) { return p.kg; }), lo = Math.min.apply(null, ks), hi = Math.max.apply(null, ks);
    var pad2 = Math.max(0.5, (hi - lo) * 0.15); lo -= pad2; hi += pad2;
    var x = function (d) { return L + (parseKey(d).getTime() - t0) / span * (W - L - R); };
    var y = function (v) { return T + (hi - v) / (hi - lo) * (H - T - B); };
    // smoothed trend: moving average of the last 3 weigh-ins
    var trend = pts.map(function (p, i) { var a = pts.slice(Math.max(0, i - 2), i + 1); return { d: p.date, v: a.reduce(function (s, q) { return s + q.kg; }, 0) / a.length }; });
    var out = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Weight over time with trend line">';
    [hi - pad2, lo + pad2].forEach(function (v) {
      out += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '" stroke="var(--sep)" stroke-width="1"/>' +
        '<text x="' + (L - 4) + '" y="' + (y(v) + 3.5).toFixed(1) + '" font-size="10" fill="var(--text-2)" text-anchor="end" font-family="inherit">' + v.toFixed(1) + '</text>';
    });
    out += '<polyline fill="none" stroke="var(--text-3)" stroke-width="1.5" points="' + pts.map(function (p) { return x(p.date).toFixed(1) + ',' + y(p.kg).toFixed(1); }).join(' ') + '"/>';
    out += '<polyline fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.85" points="' + trend.map(function (p) { return x(p.d).toFixed(1) + ',' + y(p.v).toFixed(1); }).join(' ') + '"/>';
    pts.forEach(function (p) { out += '<circle cx="' + x(p.date).toFixed(1) + '" cy="' + y(p.kg).toFixed(1) + '" r="3" fill="var(--card)" stroke="var(--text-2)" stroke-width="1.5"><title>' + shortDate(p.date) + ': ' + p.kg.toFixed(1) + ' kg</title></circle>'; });
    out += '<text x="' + L + '" y="' + (H - 5) + '" font-size="10" fill="var(--text-2)" font-family="inherit">' + shortDate(pts[0].date) + '</text>';
    out += '<text x="' + (W - R) + '" y="' + (H - 5) + '" font-size="10" fill="var(--text-2)" text-anchor="end" font-family="inherit">' + shortDate(pts[pts.length - 1].date) + '</text>';
    return out + '</svg>';
  }

  /* ---------- summary: diet stats + calorie chart ---------- */
  function renderWeekDiet(mon) {
    var n = 0, sumK = 0, sumP = 0, on = 0, goal = settings.calorieGoal;
    for (var i = 0; i < 7; i++) {
      var t = totals(addDays(mon, i));
      if (!t.n) continue;
      n++; sumK += t.kcal; sumP += t.protein;
      if (goal && Math.abs(t.kcal - goal) <= goal * 0.1) on++;
    }
    $('week-diet-stats').innerHTML =
      stat('Avg. calories', n ? fmt(sumK / n) : '—') +
      stat('Avg. protein', n ? Math.round(sumP / n) + ' <small>g</small>' : '—') +
      stat('Days on target', goal ? on + ' <small>/ ' + n + '</small>' : '—');
  }
  function kcalChartSVG() {
    var W = 320, H = 150, top = 12, bottom = 22, left = 2, right = 34, n = 30, goal = settings.calorieGoal || 0, max = goal * 1.2;
    var days = [];
    for (var i = n - 1; i >= 0; i--) { var k = addDays(state.today, -i), t = totals(k); days.push({ k: k, t: t }); if (t.kcal > max) max = t.kcal; }
    max = Math.max(max * 1.05, 500);
    var ph = H - top - bottom, slot = (W - left - right) / n, bw = Math.max(3, slot * 0.62);
    var out = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Calories for the last 30 days">';
    out += '<line x1="' + left + '" x2="' + (W - right) + '" y1="' + (top + ph) + '" y2="' + (top + ph) + '" stroke="var(--sep)" stroke-width="1"/>';
    days.forEach(function (d, idx) {
      var x = left + idx * slot + (slot - bw) / 2;
      if (!d.t.n) out += '<rect x="' + x.toFixed(1) + '" y="' + (top + ph - 3) + '" width="' + bw.toFixed(1) + '" height="3" rx="1.5" fill="var(--none)"><title>' + shortDate(d.k) + ': no meals logged</title></rect>';
      else {
        var h = Math.max(4, d.t.kcal / max * ph);
        out += '<rect x="' + x.toFixed(1) + '" y="' + (top + ph - h).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="' + Math.min(3, bw / 2).toFixed(1) + '" fill="var(--kcal)" opacity="0.85"><title>' + shortDate(d.k) + ': ' + fmt(d.t.kcal) + ' kcal</title></rect>';
      }
      if (idx === 0 || idx === 14 || idx === n - 1) out += '<text x="' + (left + idx * slot + slot / 2).toFixed(1) + '" y="' + (H - 6) + '" font-size="10" fill="var(--text-2)" text-anchor="' + (idx === 0 ? 'start' : idx === n - 1 ? 'end' : 'middle') + '" font-family="inherit">' + (idx === n - 1 ? 'Today' : shortDate(d.k)) + '</text>';
    });
    if (goal) {
      var gy = (top + ph - goal / max * ph).toFixed(1);
      out += '<line x1="' + left + '" x2="' + (W - right) + '" y1="' + gy + '" y2="' + gy + '" stroke="var(--text-2)" stroke-width="1.2" stroke-dasharray="4 3"/>';
      out += '<text x="' + (W - 1) + '" y="' + (+gy + 3.5) + '" font-size="10" fill="var(--text-2)" text-anchor="end" font-family="inherit">' + fmt(goal) + '</text>';
    }
    return out + '</svg>';
  }

  /* ---------- diet exports / import ---------- */
  function csvCell(v) { v = String(v == null ? '' : v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function exportMealsCSV() {
    var rows = [['Date', 'Time', 'Meal', 'Food', 'Serving', 'Portion', 'kcal', 'Protein']];
    Object.keys(data).sort().forEach(function (k) {
      dayMeals(k).slice().sort(function (a, b) { return (a.time || '').localeCompare(b.time || ''); }).forEach(function (m) {
        rows.push([k, m.time, MEAL_LABEL[m.meal] || m.meal, m.name, m.serving, m.portion, m.kcal, m.protein]);
      });
    });
    if (rows.length === 1) { toast('No meals logged yet'); return; }
    download('green-days-meals-' + state.today + '.csv', '﻿' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n'), 'text/csv;charset=utf-8');
    toast('Meals exported 🍽️');
  }
  function exportWeightCSV() {
    if (!weights.length) { toast('No weigh-ins yet'); return; }
    var rows = [['Date', 'Weight (kg)']].concat(weights.map(function (w) { return [w.date, w.kg.toFixed(1)]; }));
    download('green-days-weight-' + state.today + '.csv', '﻿' + rows.map(function (r) { return r.join(','); }).join('\r\n'), 'text/csv;charset=utf-8');
    toast('Weight exported ⚖️');
  }
  function sanitizeMeal(m) {
    if (!m || typeof m !== 'object') return null;
    var kcal = num(m.kcal), p = num(m.portion);
    if (kcal == null) return null;
    return {
      id: typeof m.id === 'string' && m.id ? m.id.slice(0, 40) : newId(), meal: MEAL_LABEL[m.meal] ? m.meal : 'snack',
      name: str(m.name, 100) || 'Food', serving: str(m.serving, 60) || '1 serving', portion: p > 0 ? Math.min(p, 50) : 1,
      kcal: clamp(Math.round(kcal), 0, 10000), protein: clamp(round1(num(m.protein) || 0), 0, 1000),
      time: /^\d{2}:\d{2}$/.test(m.time) ? m.time : '12:00',
      source: ['builtin', 'custom', 'barcode'].indexOf(m.source) >= 0 ? m.source : 'custom',
      barcode: /^\d{6,14}$/.test(m.barcode || '') ? m.barcode : null,
      foodId: typeof m.foodId === 'string' ? m.foodId.slice(0, 60) : null,
      isSugaryDrink: !!m.isSugaryDrink, isSweetFood: !!m.isSweetFood,
      isFried: !!m.isFried, veg: clamp(num(m.veg) || 0, 0, 5)
    };
  }
  function importDietExtras(parsed) {
    var n = 0;
    if (parsed.foods && typeof parsed.foods === 'object' && !Array.isArray(parsed.foods)) {
      Object.keys(parsed.foods).forEach(function (id) {
        var f = parsed.foods[id];
        if (!f || typeof f !== 'object' || !/^(c|bc)-[\w-]{1,40}$/.test(id) || num(f.kcal) == null) return;
        var bc = /^\d{6,14}$/.test(f.barcode || '') ? f.barcode : null;
        customFoods[id] = {
          id: id, name: str(f.name, 100) || 'Food', serving: str(f.serving, 60) || '1 serving', kcal: clamp(num(f.kcal), 0, 10000),
          protein: clamp(num(f.protein) || 0, 0, 1000), isSugaryDrink: !!f.isSugaryDrink, isSweetFood: !!f.isSweetFood
        };
        if (bc) {
          Object.assign(customFoods[id], { barcode: bc, per100: !!f.per100, unit: f.unit === 'ml' ? 'ml' : 'g' });
          if (f.perServing && num(f.perServing.kcal) != null) customFoods[id].perServing = { label: str(f.perServing.label, 60) || '1 serving', kcal: num(f.perServing.kcal), protein: num(f.perServing.protein) || 0, qty: num(f.perServing.qty) };
        }
        n++;
      });
      saveFoods();
    }
    if (Array.isArray(parsed.favs)) {
      parsed.favs.forEach(function (id) { if (typeof id === 'string' && (BUILTIN[id] || customFoods[id]) && favs.indexOf(id) < 0) { favs.push(id); n++; } });
      saveFavs();
    }
    if (Array.isArray(parsed.weight)) {
      parsed.weight.forEach(function (w) {
        var kg = w && num(w.kg);
        if (!w || !isValidKey(w.date) || w.date > state.today || !(kg >= 25 && kg <= 300)) return;
        weights = weights.filter(function (x) { return x.date !== w.date; });
        weights.push({ date: w.date, kg: round1(kg) }); n++;
      });
      weights.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      saveWeights();
    }
    return n;
  }

  /* ---------- diet events ---------- */
  function bindDiet() {
    // Settings
    $('diet-toggle').addEventListener('change', function () {
      settings.trackDiet = this.checked; saveSettings(); applyDiet(); renderSettings();
      if (settings.trackDiet) {
        toast('Meals added to the Today page 🍽️');
        if (!settings.calorieGoal) setTimeout(function () { openSheet(calcSheet()); }, 300);
      }
    });
    $('kcal-goal').addEventListener('change', function () {
      var v = num(this.value);
      settings.calorieGoal = v == null ? null : Math.round(clamp(v, 800, 6000));
      saveSettings(); renderSettings();
    });
    $('protein-goal').addEventListener('change', function () {
      var v = num(this.value);
      settings.proteinGoal = v == null || v <= 0 ? null : Math.round(clamp(v, 1, 400));
      saveSettings(); renderSettings();
    });
    $('weigh-day').addEventListener('change', function () {
      settings.weighDay = this.value === '' ? null : +this.value; saveSettings();
    });
    $('open-calc').addEventListener('click', function () { openSheet(calcSheet()); });
    $('protein-hint').addEventListener('click', function (ev) {
      if (!ev.target.closest('[data-act="use-protein"]')) return;
      settings.proteinGoal = Math.round(latestWeight() * 1.2); saveSettings(); renderSettings(); toast('Protein goal set ✓');
    });
    $('export-meals').addEventListener('click', exportMealsCSV);
    $('export-weight').addEventListener('click', exportWeightCSV);

    // Calorie card: buttons do their thing, tapping anywhere else jumps to the meals
    function kcalCardTap(ev) {
      var b = ev.target.closest('[data-act]');
      if (b && b.dataset.act === 'addfood') openSheet(foodSheet({}));
      else if (b && b.dataset.act === 'calc') openSheet(calcSheet());
      else scrollToEl('meals-wrap');
    }
    $('kcal-card').addEventListener('click', kcalCardTap);
    $('kcal-card').addEventListener('keydown', function (ev) { if ((ev.key === 'Enter' || ev.key === ' ') && ev.target === this) { ev.preventDefault(); scrollToEl('meals-wrap'); } });
    var list = $('meals-list');
    list.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-act]'); if (!b) return;
      var act = b.dataset.act;
      if (swipe.suppress && act === 'edit') { swipe.suppress = false; return; }
      if (act === 'edit') { if (swipe.openEl) { closeSwipe(); return; } openSheet(foodSheet({ editId: b.dataset.id })); }
      else if (act === 'del') deleteEntry(b.dataset.id);
      else if (act === 'add') { closeSwipe(); openSheet(foodSheet({ meal: b.dataset.meal })); }
      else if (act === 'same') sameAsYesterday(b.dataset.meal);
    });
    // swipe left on an entry to reveal Delete
    list.addEventListener('touchstart', function (ev) {
      var m = ev.target.closest('.entry-main'); if (!m) return;
      if (swipe.openEl && swipe.openEl !== m) closeSwipe();
      swipe.el = m; swipe.x0 = ev.touches[0].clientX; swipe.y0 = ev.touches[0].clientY; swipe.dx = 0; swipe.active = false;
      swipe.base = m === swipe.openEl ? -84 : 0;
    }, { passive: true });
    list.addEventListener('touchmove', function (ev) {
      if (!swipe.el) return;
      var dx = ev.touches[0].clientX - swipe.x0, dy = ev.touches[0].clientY - swipe.y0;
      if (!swipe.active) {
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { swipe.active = true; swipe.el.classList.add('dragging'); swipe.el.parentNode.classList.add('reveal'); }
        else if (Math.abs(dy) > 8) { swipe.el = null; return; } else return;
      }
      swipe.dx = dx;
      swipe.el.style.transform = 'translateX(' + clamp(swipe.base + dx, -120, 0) + 'px)';
    }, { passive: true });
    list.addEventListener('touchend', function () {
      var el = swipe.el; if (!el) return;
      swipe.el = null; el.classList.remove('dragging');
      if (!swipe.active) return;
      swipe.suppress = true; setTimeout(function () { swipe.suppress = false; }, 400);
      if (swipe.base + swipe.dx < -42) { el.style.transform = 'translateX(-84px)'; swipe.openEl = el; }
      else { swipe.openEl = el; closeSwipe(); }
    });

    // Summary
    $('seg-chart').addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      state.chartMode = b.dataset.value; renderSummary();
    });
    document.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-act="logweight"]') && !ev.target.closest('#sheet-body')) openSheet(weightSheet());
    });

    // Sheet plumbing
    $('sheet-backdrop').addEventListener('click', closeSheet);
    var body = $('sheet-body');
    body.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-act]'); if (!b || !sheet.ctl || b.disabled) return;
      if (b.dataset.act === 'close') { closeSheet(); return; }
      if (b.dataset.act === 'seg') b.parentNode.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
      if (sheet.ctl.click) sheet.ctl.click(b.dataset.act, b, ev);
    });
    body.addEventListener('input', function (ev) { if (sheet.ctl && sheet.ctl.input) sheet.ctl.input(ev); });
    body.addEventListener('change', function (ev) { if (sheet.ctl && sheet.ctl.change) sheet.ctl.change(ev); });
    body.addEventListener('submit', function (ev) { ev.preventDefault(); if (sheet.ctl && sheet.ctl.submit) sheet.ctl.submit(ev); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && sheet.ctl) closeSheet(); });
  }

  /* ---------- events ---------- */
  function bind() {
    document.querySelectorAll('.tabbar button').forEach(function (b) {
      b.addEventListener('click', function () {
        // iOS behaviour: tapping the tab you're already on scrolls back to the top
        if (b.dataset.tab === state.tab) { scrollTop(); return; }
        showTab(b.dataset.tab);
      });
    });
    $('top-chip').addEventListener('click', scrollTop);
    window.addEventListener('scroll', updateTopChip, { passive: true });

    $('day-prev').addEventListener('click', function () { state.view = addDays(state.view, -1); renderToday(); });
    $('day-next').addEventListener('click', function () { if (state.view < state.today) { state.view = addDays(state.view, 1); renderToday(); } });

    document.querySelectorAll('#view-today input[data-field]').forEach(function (sw) {
      sw.addEventListener('change', function () {
        var f = sw.dataset.field, v = sw.checked;
        update(function (e) { e[f] = v; });
      });
    });

    // Status card: jump to the meal that caused the sugar, if any
    function statusTap() {
      var c = sugarCauses(state.view);
      if (c.meal && settings.trackDiet) scrollToEl('meal-' + c.meal);
    }
    $('status-card').addEventListener('click', statusTap);
    $('status-card').addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); statusTap(); } });

    // Water: + Glass (250 ml), + Bottle (500 ml = 2 glasses), Undo
    function addWater(n) {
      var u = state.waterUndo;
      if (u.day !== state.view) { u.day = state.view; u.stack = []; }
      u.stack.push(n);
      update(function (e) { e.water = Math.min(99, (e.water || 0) + n); });
    }
    $('water-glass').addEventListener('click', function () { addWater(1); });
    $('water-bottle').addEventListener('click', function () { addWater(2); });
    $('water-undo').addEventListener('click', function () {
      var u = state.waterUndo, n = u.day === state.view && u.stack.length ? u.stack.pop() : 1;
      update(function (e) { e.water = Math.max(0, (e.water || 0) - n); });
    });

    // Highlights: veggies / fried toggle the day flags; protein jumps to the meals
    $('highlights').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-hl]'); if (!b) return;
      var f = b.dataset.hl;
      if (f === 'protein') { scrollToEl('meals-wrap'); return; }
      update(function (e) { e[f] = !e[f]; });
    });

    // Evening check-in
    $('checkin-toggle').addEventListener('click', function () {
      var open = $('checkin-body').hidden;
      state.checkin = { day: state.view, open: open };
      renderCheckin(state.view, data[state.view] || blankEntry());
      if (open) setTimeout(function () { $('checkin').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 50);
    });

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
      openSheet(daySheet(b.dataset.key));
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
      if (!Object.keys(data).length && !weights.length && !Object.keys(customFoods).length) { toast('Nothing to delete yet'); return; }
      if (confirm('Delete all your Green Days data (days, meals, my foods, favourites and weight) from this device? This cannot be undone. (Tip: export a backup first.)')) {
        data = {}; saveData(); state.celebrated = {};
        customFoods = {}; favs = []; weights = []; saveFoods(); saveFavs(); saveWeights();
        render(); toast('All data deleted');
      }
    });

    bindDiet();

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
    applyDiet();
    bind();
    if (!settings.welcomed) $('welcome').hidden = false;
    // Home-screen shortcut: ./?action=add-food opens Today with the Add food sheet
    var action = /[?&]action=([\w-]+)/.exec(location.search);
    if (action && action[1] === 'add-food') {
      try { history.replaceState(null, '', location.pathname + '#today'); } catch (e) { }
      openToday(state.today, 'add-food');
    } else showTab(location.hash.slice(1) || 'today', true);
    setInterval(checkReminder, 30000);
    setTimeout(checkReminder, 1500);
    if ('serviceWorker' in navigator) {
      // When a new version of the app takes over, reload once so it shows right away.
      var hadController = !!navigator.serviceWorker.controller, reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (!hadController || reloading || sheet.ctl) { hadController = true; return; }
        reloading = true;
        try { sessionStorage.setItem('fgd-updated', '1'); } catch (e) { }
        location.reload();
      });
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').then(function (reg) {
          // check for a new version whenever the app comes back to the front
          document.addEventListener('visibilitychange', function () { if (!document.hidden) reg.update().catch(function () { }); });
        }).catch(function () { });
      });
      try {
        if (sessionStorage.getItem('fgd-updated')) { sessionStorage.removeItem('fgd-updated'); setTimeout(function () { toast('App updated to version ' + VERSION + ' ✨', 3000); }, 600); }
      } catch (e) { }
    }
  }
  init();
})();
