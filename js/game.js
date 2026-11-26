/*
 * game.js — setup screen, round planning, beat scheduling and the game screen.
 *
 * Timing: sounds are scheduled a little ahead on the Web Audio clock, and each
 * beat also queues a visual change for the same moment. Pausing suspends the
 * audio clock, so music and cards stop and resume together.
 */
(function () {
  'use strict';

  const Content = window.Content;
  const engine = new window.BeatEngine();
  const $ = (id) => document.getElementById(id);

  const CARDS_PER_ROUND = 8;
  const SPEED_STEP = 6;       // BPM added each round when "speed up" is on
  const MAX_BPM = 180;
  const LOOKAHEAD = 0.15;     // seconds of audio scheduled ahead
  const STORE_KEY = 'sayItOnBeat.settings.v1';

  const DEFAULTS = {
    categories: ['notes'],
    strings: ['G', 'D', 'A', 'E'],
    rhythmLevel: 'basic',
    bpm: 90,
    rounds: 5,
    speedUp: true,
    showAnswers: true,
    memory: false,
    volume: 0.8
  };

  /* ============================ settings ============================ */

  function loadSettings() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { s = {}; }
    const out = Object.assign({}, DEFAULTS, s);
    out.categories = (out.categories || []).filter((id) => Content.byId(id));
    out.strings = (out.strings || []).filter((id) => 'GDAE'.indexOf(id) >= 0);
    if (!out.strings.length) out.strings = DEFAULTS.strings.slice();
    return out;
  }
  function saveSettings() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch (e) { /* storage unavailable */ }
  }
  const settings = loadSettings();

  /* ============================ setup screen ============================ */

  function renderCategories() {
    $('categoryList').innerHTML = Content.CATEGORIES.map((c) =>
      '<button type="button" class="cat" data-id="' + c.id + '" aria-pressed="' + (settings.categories.indexOf(c.id) >= 0) + '">' +
      '<span class="box">✓</span><span><span class="name">' + c.name + '</span><span class="desc">' + c.desc + '</span></span></button>'
    ).join('');
    $('stringChips').innerHTML = Content.STRINGS.map((s) =>
      '<button type="button" class="chip" data-id="' + s.id + '" aria-pressed="' + (settings.strings.indexOf(s.id) >= 0) + '">' + s.id + '</button>'
    ).join('');
    updateSetupState();
  }

  function selectedCats() { return settings.categories.map(Content.byId).filter(Boolean); }

  function updateSetupState() {
    const cats = selectedCats();
    document.querySelectorAll('.cat').forEach((el) => {
      el.setAttribute('aria-pressed', String(settings.categories.indexOf(el.dataset.id) >= 0));
    });
    document.querySelectorAll('.chip').forEach((el) => {
      el.setAttribute('aria-pressed', String(settings.strings.indexOf(el.dataset.id) >= 0));
    });
    $('stringsOption').classList.toggle('hidden', !cats.some((c) => c.strings));
    $('rhythmOption').classList.toggle('hidden', !cats.some((c) => c.rhythm));
    $('startBtn').disabled = cats.length === 0;

    const singles = cats.filter((c) => c.kind === 'single').length;
    const rhythms = cats.filter((c) => c.rhythm).length;
    let hint = '';
    if (!cats.length) hint = 'Pick at least one category to start.';
    else if (rhythms && singles) hint = 'Rhythm cards are one measure each, so they get their own rounds, taking turns with the other cards.';
    else if (rhythms) hint = 'Each rhythm card is one full measure: count it, clap it, or play it on an open string.';
    else if (cats.length === 1) hint = '1 category selected. Pick more to mix them in the same round.';
    else hint = cats.length + ' categories selected. Each round mixes them together.';
    $('categoryHint').textContent = hint;
  }

  function bindSetup() {
    $('categoryList').addEventListener('click', (e) => {
      const btn = e.target.closest('.cat');
      if (!btn) return;
      const id = btn.dataset.id;
      const i = settings.categories.indexOf(id);
      if (i >= 0) settings.categories.splice(i, 1); else settings.categories.push(id);
      saveSettings();
      updateSetupState();
    });
    $('stringChips').addEventListener('click', (e) => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      const id = btn.dataset.id;
      const i = settings.strings.indexOf(id);
      if (i >= 0) { if (settings.strings.length > 1) settings.strings.splice(i, 1); } else settings.strings.push(id);
      settings.strings.sort((a, b) => 'GDAE'.indexOf(a) - 'GDAE'.indexOf(b));
      saveSettings();
      updateSetupState();
    });
    $('selectAll').addEventListener('click', () => {
      settings.categories = Content.CATEGORIES.map((c) => c.id);
      saveSettings();
      updateSetupState();
    });
    $('selectNone').addEventListener('click', () => {
      settings.categories = [];
      saveSettings();
      updateSetupState();
    });

    const tempo = $('tempo');
    tempo.value = settings.bpm;
    $('tempoOut').textContent = settings.bpm + ' BPM';
    tempo.addEventListener('input', () => {
      settings.bpm = Number(tempo.value);
      $('tempoOut').textContent = settings.bpm + ' BPM';
      saveSettings();
    });

    $('rounds').value = String(settings.rounds);
    $('rounds').addEventListener('change', () => { settings.rounds = Number($('rounds').value); saveSettings(); });
    $('rhythmLevel').value = settings.rhythmLevel;
    $('rhythmLevel').addEventListener('change', () => { settings.rhythmLevel = $('rhythmLevel').value; saveSettings(); });

    ['speedUp', 'showAnswers', 'memory'].forEach((key) => {
      const el = $(key);
      el.checked = !!settings[key];
      el.addEventListener('change', () => { settings[key] = el.checked; saveSettings(); });
    });

    const vol = $('volume');
    vol.value = settings.volume;
    vol.addEventListener('input', () => {
      settings.volume = Number(vol.value);
      engine.setVolume(settings.volume);
      saveSettings();
    });

    $('startBtn').addEventListener('click', startGame);
    $('previewBtn').addEventListener('click', openPreview);
    $('previewClose').addEventListener('click', closePreview);
  }

  /* ============================ card preview ============================ */

  function openPreview() {
    const cats = selectedCats().length ? selectedCats() : Content.CATEGORIES;
    let html = '';
    cats.forEach((cat) => {
      let items;
      if (cat.make) {
        items = [];
        for (let i = 0; i < 6; i++) items.push(cat.make(settings, Math.random));
      } else {
        items = cat.pool(settings);
      }
      html += '<h3>' + cat.name + '</h3><div class="preview-grid' + (cat.rhythm ? ' wide' : '') + '">' +
        items.map((it) => '<div class="pcard">' + it.svg + '<b>' + it.say + '</b>' +
          (cat.rhythm ? '' : '<span>' + it.detail + '</span>') + '</div>').join('') + '</div>';
    });
    $('previewBody').innerHTML = html;
    $('preview').classList.remove('hidden');
    $('previewClose').focus();
  }
  function closePreview() { $('preview').classList.add('hidden'); }

  /* ============================ rounds ============================ */

  const game = {
    started: false,      // on the game screen
    running: false,      // scheduler active (false once the last round has ended)
    paused: false,
    groups: [],
    plan: null,
    beatIdx: 0,
    nextTime: 0,
    bar: 0,
    events: [],
    cards: [],
    inReview: false,
    forceAnswers: false,
    timer: null,
    raf: null,
    wake: null
  };

  // Rhythm categories are a measure per card, so they get rounds of their own.
  function buildGroups() {
    const cats = selectedCats();
    const groups = [];
    const singles = cats.filter((c) => c.kind === 'single');
    if (singles.length) groups.push({ cats: singles, meter: 4, beats: 1 });
    cats.filter((c) => c.kind === 'meter3').forEach((c) => groups.push({ cats: [c], meter: 3, beats: 3 }));
    cats.filter((c) => c.kind === 'meter4').forEach((c) => groups.push({ cats: [c], meter: 4, beats: 4 }));
    return groups;
  }

  function makeItems(group) {
    const items = [];
    let guard = 0;
    while (items.length < CARDS_PER_ROUND && guard++ < 200) {
      const cat = group.cats[Math.floor(Math.random() * group.cats.length)];
      const item = Content.pick(cat, settings, Math.random);
      const n = items.length;
      // Repeats are part of the fun, but not three of the same card in a row.
      if (n >= 2 && items[n - 1].id === item.id && items[n - 2].id === item.id) continue;
      items.push(item);
    }
    return items;
  }

  function isLastRound(roundIdx) { return settings.rounds > 0 && roundIdx >= settings.rounds - 1; }
  function bpmFor(roundIdx) {
    return Math.min(MAX_BPM, settings.bpm + (settings.speedUp ? roundIdx * SPEED_STEP : 0));
  }

  /*
   * A round is a list of beats. Every section is a whole number of bars:
   *   count-in (first round / after a restart) → reveal (one card per beat)
   *   → say (one card per beat, or per measure for rhythms) → answers or a short break.
   */
  function buildPlan(roundIdx, countIn) {
    const group = game.groups[roundIdx % game.groups.length];
    const m = group.meter;
    const beats = [];
    if (countIn) for (let i = 0; i < m; i++) beats.push({ phase: 'count', n: i + 1 });

    const revealLen = Math.ceil(CARDS_PER_ROUND / m) * m;
    for (let i = 0; i < revealLen; i++) {
      beats.push({ phase: 'reveal', reveal: i < CARDS_PER_ROUND ? i : null, fill: i === revealLen - 1 });
    }
    for (let k = 0; k < CARDS_PER_ROUND; k++) {
      for (let b = 0; b < group.beats; b++) beats.push({ phase: 'say', card: k, first: b === 0, crash: k === 0 && b === 0 });
    }
    const tail = settings.showAnswers ? 2 * m : m;
    for (let i = 0; i < tail; i++) beats.push({ phase: settings.showAnswers ? 'review' : 'break' });
    if (!isLastRound(roundIdx)) beats[beats.length - 1].fill = true;
    beats.forEach((b, i) => { b.barPos = i % m; });

    return { roundIdx: roundIdx, group: group, meter: m, items: makeItems(group), beats: beats, bpm: bpmFor(roundIdx) };
  }

  /* ============================ scheduler ============================ */

  function queue(t, fn) { game.events.push({ t: t, fn: fn }); }

  function startPlan(plan, t) {
    game.plan = plan;
    game.beatIdx = 0;
    queue(t, () => renderRound(plan));
  }

  function schedulerTick() {
    if (!game.running || !engine.ctx) return;
    const horizon = engine.ctx.currentTime + LOOKAHEAD;
    while (game.running && game.nextTime < horizon) {
      const plan = game.plan;
      if (game.beatIdx >= plan.beats.length) {
        if (isLastRound(plan.roundIdx)) { scheduleEnd(game.nextTime, plan); return; }
        startPlan(buildPlan(plan.roundIdx + 1, false), game.nextTime);
        continue;
      }
      const b = plan.beats[game.beatIdx];
      const t = game.nextTime;
      const spb = 60 / plan.bpm;
      engine.playBeat({
        t: t, spb: spb, barPos: b.barPos, meter: plan.meter, bar: game.bar, phase: b.phase,
        fill: b.fill, crash: b.crash, bell: b.reveal != null ? b.reveal : null
      });
      if (b.barPos === plan.meter - 1) game.bar++;
      queue(t, () => applyBeat(plan, b, spb));
      game.nextTime += spb;
      game.beatIdx++;
    }
  }

  function scheduleEnd(t, plan) {
    game.running = false;
    engine.playBeat({ t: t, spb: 60 / plan.bpm, barPos: 0, meter: plan.meter, bar: 0, phase: 'end' });
    queue(t, () => {
      setPhase('Done', 'answers');
      clearActive();
      $('doneOverlay').classList.remove('hidden');
      setIdle(false);
      releaseWake();
    });
  }

  function frame() {
    game.raf = requestAnimationFrame(frame);
    if (!engine.ctx || game.paused) return;
    const lat = engine.ctx.outputLatency || engine.ctx.baseLatency || 0;
    const now = engine.ctx.currentTime - lat;
    while (game.events.length && game.events[0].t <= now) game.events.shift().fn();
  }

  /* ============================ game screen ============================ */

  function setPhase(text, cls) {
    const el = $('phaseLabel');
    el.textContent = text;
    el.className = 'phase' + (cls ? ' ' + cls : '');
  }

  function renderRound(plan) {
    const grid = $('grid');
    const wide = plan.group.beats > 1;
    grid.className = 'grid' + (wide ? ' wide' : '') + (game.forceAnswers ? ' answers' : '');
    game.inReview = false;
    grid.innerHTML = plan.items.map((it, i) =>
      '<div class="card" data-i="' + i + '"><div class="num">' + (i + 1) + '</div>' +
      '<div class="face"><div class="art">' + it.svg + '</div>' +
      '<div class="answer"><b>' + it.say + '</b><span>' + it.detail + '</span></div></div>' +
      '<div class="progress"></div></div>'
    ).join('');
    game.cards = Array.from(grid.children);

    const total = settings.rounds > 0 ? ' of ' + settings.rounds : '';
    $('roundLabel').textContent = 'Round ' + (plan.roundIdx + 1) + total;
    $('bpmLabel').textContent = plan.bpm + ' BPM';
    $('beatDots').innerHTML = Array.from({ length: plan.meter }, (_, i) => '<i' + (i === 0 ? ' class="down"' : '') + '></i>').join('');
    setPhase(plan.beats[0].phase === 'count' ? 'Get ready' : 'Watch', plan.beats[0].phase === 'count' ? '' : 'watch');
  }

  function clearActive() {
    game.cards.forEach((c) => c.classList.remove('active', 'done'));
  }

  function applyBeat(plan, b, spb) {
    const dots = $('beatDots').children;
    for (let i = 0; i < dots.length; i++) dots[i].classList.toggle('on', i === b.barPos);
    const grid = $('grid');
    const count = $('countOverlay');

    if (b.phase === 'count') {
      count.classList.remove('hidden');
      count.innerHTML = '<span>' + b.n + '</span>';
      setPhase('Get ready', '');
      return;
    }
    count.classList.add('hidden');

    if (b.phase === 'reveal') {
      setPhase('Watch', 'watch');
      if (b.reveal != null && game.cards[b.reveal]) game.cards[b.reveal].classList.add('revealed');
      return;
    }

    if (b.phase === 'say') {
      setPhase('Say it!', 'say');
      if (settings.memory) grid.classList.add('memory');
      if (!b.first) return;
      game.cards.forEach((c, i) => {
        if (i < b.card) { c.classList.remove('active'); c.classList.add('done'); }
      });
      const card = game.cards[b.card];
      if (card) {
        card.style.setProperty('--dur', (plan.group.beats * spb).toFixed(3) + 's');
        card.classList.add('revealed', 'active');
      }
      return;
    }

    if (b.phase === 'review' || b.phase === 'break') {
      if (!game.inReview) {
        game.inReview = true;
        clearActive();
        if (b.phase === 'review') grid.classList.add('answers');
      }
      const last = isLastRound(plan.roundIdx);
      if (b.phase === 'review') setPhase('Answers', 'answers');
      else setPhase(last ? 'Done' : 'Next round…', '');
    }
  }

  /* ============================ start / pause / skip ============================ */

  function showScreen(name) {
    $('setup').classList.toggle('hidden', name !== 'setup');
    $('game').classList.toggle('hidden', name !== 'game');
  }

  function startGame() {
    if (!selectedCats().length) return;
    closePreview();
    engine.init();
    engine.setVolume(settings.volume);
    engine.newBus();
    game.groups = buildGroups();
    game.started = true;
    game.forceAnswers = false;
    game.bar = 0;
    $('answersBtn').classList.remove('on');
    showScreen('game');
    beginAt(0);
    if (!game.timer) game.timer = setInterval(schedulerTick, 25);
    if (!game.raf) frame();
    requestWake();
    nudgeIdle();
  }

  // (Re)start the music at a round, with a one-bar count-in.
  function beginAt(roundIdx) {
    const go = () => {
      game.events = [];
      game.running = true;
      game.nextTime = engine.ctx.currentTime + 0.2;
      $('doneOverlay').classList.add('hidden');
      startPlan(buildPlan(roundIdx, true), game.nextTime);
      schedulerTick();
    };
    if (game.paused || engine.ctx.state !== 'running') {
      setPaused(false);
      engine.ctx.resume().then(go);
    } else {
      go();
    }
  }

  function setPaused(p) {
    game.paused = p;
    document.body.classList.toggle('paused', p);
    $('pauseOverlay').classList.toggle('hidden', !p);
    $('pauseIcon').textContent = p ? '▶' : '❚❚';
    $('pauseBtn').querySelector('.lbl').textContent = p ? 'Play' : 'Pause';
    setIdle(false);
    if (!p) nudgeIdle();
  }

  function togglePause() {
    if (!game.started) return;
    if (!$('doneOverlay').classList.contains('hidden')) { restart(0); return; }
    if (game.paused) {
      setPaused(false);
      engine.ctx.resume();
      requestWake();
    } else {
      engine.ctx.suspend();
      setPaused(true);
    }
  }

  function restart(offset) {
    if (!game.started) return;
    const done = !$('doneOverlay').classList.contains('hidden');
    let idx = done ? 0 : game.plan.roundIdx + offset;
    if (settings.rounds > 0 && idx >= settings.rounds) idx = 0;
    engine.newBus();
    game.bar = 0;
    beginAt(idx);
    requestWake();
  }

  function quit() {
    if (!game.started) return;
    game.started = false;
    game.running = false;
    game.events = [];
    engine.newBus();
    setPaused(false);
    engine.ctx.suspend();
    $('countOverlay').classList.add('hidden');
    $('doneOverlay').classList.add('hidden');
    releaseWake();
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    showScreen('setup');
  }

  function toggleAnswers() {
    if (!game.started) return;
    game.forceAnswers = !game.forceAnswers;
    $('answersBtn').classList.toggle('on', game.forceAnswers);
    $('grid').classList.toggle('answers', game.forceAnswers || (game.inReview && settings.showAnswers));
  }

  function toggleFullscreen() {
    const el = document.documentElement;
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (fsEl) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) {
        const p = req.call(el);
        if (p && p.catch) p.catch(() => {});
      }
    }
  }

  /* ============================ idle controls, wake lock ============================ */

  let idleTimer = null;
  function setIdle(on) { document.body.classList.toggle('idle', on); }
  function nudgeIdle() {
    setIdle(false);
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (game.started && !game.paused && $('doneOverlay').classList.contains('hidden')) setIdle(true);
    }, 2500);
  }

  function requestWake() {
    if (!navigator.wakeLock || game.wake) return;
    navigator.wakeLock.request('screen').then((lock) => {
      game.wake = lock;
      lock.addEventListener('release', () => { game.wake = null; });
    }).catch(() => {});
  }
  function releaseWake() {
    if (game.wake) { game.wake.release().catch(() => {}); game.wake = null; }
  }

  /* ============================ input ============================ */

  function bindGame() {
    const controls = {
      pauseBtn: togglePause,
      restartBtn: () => restart(0),
      nextBtn: () => restart(1),
      answersBtn: toggleAnswers,
      fullscreenBtn: toggleFullscreen,
      quitBtn: quit
    };
    Object.keys(controls).forEach((id) => {
      $(id).addEventListener('click', (e) => {
        controls[id]();
        e.currentTarget.blur();   // so Space keeps meaning play/pause
      });
    });
    $('againBtn').addEventListener('click', () => restart(0));
    $('backBtn').addEventListener('click', quit);

    ['mousemove', 'mousedown', 'touchstart'].forEach((ev) => {
      document.addEventListener(ev, () => { if (game.started) nudgeIdle(); }, { passive: true });
    });

    // If the tab is hidden the timers slow down, so pause rather than drift.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && game.started && game.running && !game.paused) togglePause();
    });

    document.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = e.target && e.target.tagName;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

      if (!$('preview').classList.contains('hidden')) {
        if (key === 'Escape') closePreview();
        return;
      }

      if (!game.started) {
        if (key === ' ' && tag !== 'SELECT') {
          e.preventDefault();
          startGame();
        }
        return;
      }

      nudgeIdle();
      if (key === ' ') { e.preventDefault(); togglePause(); }
      else if (key === 'r') restart(0);
      else if (key === 'n' || key === 'ArrowRight') restart(1);
      else if (key === 'a') toggleAnswers();
      else if (key === 'f') toggleFullscreen();
      else if (key === 'q') quit();
    });
  }

  renderCategories();
  bindSetup();
  bindGame();
})();
