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
  const MIN_START_BPM = 40, MAX_START_BPM = 220;
  const MAX_BPM = 400;        // the fastest a game can get with speed-up on
  const MIN_SPEED_PCT = 1, MAX_SPEED_PCT = 25;
  const LOOKAHEAD = 0.15;     // seconds of audio scheduled ahead
  const STORE_KEY = 'sayItOnBeat.settings.v1';

  const DEFAULTS = {
    // Picked chips for each subcategory (see Content.SUBCATS); a subcategory with none is off.
    sel: null,
    rhythmLevel: 'basic',
    clap: false,                 // clap the rhythm cards during "Say it!"
    bpm: 90,
    rounds: 5,
    speedUp: true,
    speedUpPct: 5,               // percent faster each round
    showAnswers: true,
    memory: false,
    volume: 0.8,
    cardOrder: 'patterns',       // 'patterns' (easy → medium → hard → random) | 'random'
    // Diatonic note names
    pitchMode: 'scale',          // 'scale' | 'chromatic' | 'pick'
    scaleType: 'major',          // 'major' | 'natural' | 'harmonic' | 'melodic'
    scaleKey: 'D',
    scaleOctaves: 1,
    rangeLow: 'G3',
    rangeHigh: 'B5',
    pitchClasses: ['C', 'D', 'E', 'F', 'G', 'A', 'B']
  };

  const SCALE_VALUES = [].concat.apply([], Content.SCALE_CHOICES.map((g) => g.options.map((o) => o.value)));
  const clamp = (v, lo, hi, dflt) => (isFinite(v) ? Math.min(hi, Math.max(lo, Number(v))) : dflt);
  const allChips = (subId) => Content.subById(subId).chips.map((c) => c.id);
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  /* ============================ settings ============================ */

  // Settings saved before subcategories existed listed whole categories; turn those into picks.
  function migrateSelection(s) {
    const cats = s.categories || ['notes'];
    const has = (id) => cats.indexOf(id) >= 0;
    const sel = {};
    if (has('notes')) sel.home = (s.strings && s.strings.length ? s.strings : ['G', 'D', 'A', 'E']).slice();
    if (has('pitches') || has('sharps') || has('flats')) sel.diatonic = ['on'];
    if (has('values')) sel.basicvalues = allChips('basicvalues');
    if (has('advvalues')) sel.advvalues = allChips('advvalues');
    if (has('keys')) sel.keysigs = ['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb', 'Ab'].map((k) => 'key-' + k);
    if (has('clefs')) sel.clefs = allChips('clefs');
    if (has('dynamics')) sel.dynamics = allChips('dynamics');
    if (has('symbols')) sel.symbols = allChips('symbols');
    const meters = [];
    if (has('r34')) meters.push('3/4');
    if (has('r44')) meters.push('4/4');
    if (meters.length) sel.meters = meters;
    return sel;
  }

  function loadSettings() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { s = {}; }
    const out = Object.assign({}, DEFAULTS, s);
    const sel = s.sel && typeof s.sel === 'object' ? s.sel : migrateSelection(s);
    out.sel = {};
    Content.SUBCATS.forEach((sc) => {
      const valid = sc.chips.map((c) => c.id);
      out.sel[sc.id] = (sel[sc.id] || []).filter((id) => valid.indexOf(id) >= 0);
    });
    delete out.categories;
    delete out.strings;
    if (['scale', 'chromatic', 'pick'].indexOf(out.pitchMode) < 0) out.pitchMode = DEFAULTS.pitchMode;
    if (SCALE_VALUES.indexOf(out.scaleKey + ':' + out.scaleType) < 0) {
      out.scaleKey = DEFAULTS.scaleKey;
      out.scaleType = DEFAULTS.scaleType;
    }
    out.bpm = clamp(out.bpm, MIN_START_BPM, MAX_START_BPM, DEFAULTS.bpm);
    out.speedUpPct = Math.round(clamp(out.speedUpPct, MIN_SPEED_PCT, MAX_SPEED_PCT, DEFAULTS.speedUpPct));
    out.scaleOctaves = out.scaleOctaves === 2 ? 2 : 1;
    if (Content.RANGE_NOTES.indexOf(out.rangeLow) < 0) out.rangeLow = DEFAULTS.rangeLow;
    if (Content.RANGE_NOTES.indexOf(out.rangeHigh) < 0) out.rangeHigh = DEFAULTS.rangeHigh;
    const allPcs = [].concat.apply([], Content.PICK_ROWS);
    out.pitchClasses = (out.pitchClasses || []).filter((p) => allPcs.indexOf(p) >= 0);
    if (!out.pitchClasses.length) out.pitchClasses = DEFAULTS.pitchClasses.slice();
    return out;
  }
  function saveSettings() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch (e) { /* storage unavailable */ }
  }
  const settings = loadSettings();

  const picked = (subId) => settings.sel[subId] || [];
  const activeSubs = () => Content.SUBCATS.filter((sc) => picked(sc.id).length > 0);

  /* ============================ setup screen ============================ */

  function chipHtml(sc, ch) {
    const inner = ch.html || esc(ch.label);
    return '<button type="button" class="ichip' + (ch.html ? ' art' : '') + (ch.cls ? ' ' + ch.cls : '') +
      '" data-sub="' + sc.id + '" data-id="' + esc(ch.id) + '" title="' + esc(ch.label) + '" aria-label="' + esc(ch.label) + '">' +
      inner + '</button>';
  }

  function renderCategories() {
    $('categoryList').innerHTML = Content.CATEGORIES.map((cat) =>
      '<details class="catgroup" open data-cat="' + cat.id + '">' +
      '<summary><span class="cat-name">' + cat.name + '</span><span class="cat-count" id="count-' + cat.id + '"></span></summary>' +
      cat.subcats.map((sc) =>
        '<div class="subcat" data-sub="' + sc.id + '">' +
        '<label class="subhead"><input type="checkbox" class="selall" data-sub="' + sc.id + '">' +
        '<span><span class="sub-name">' + sc.name + '</span>' +
        (sc.toggle ? '' : ' <span class="sub-all">Select all</span>') +
        '<span class="sub-desc">' + sc.desc + '</span></span></label>' +
        (sc.toggle ? '' : '<div class="ichips' + (sc.rhythm ? ' meter-chips' : '') + '">' + sc.chips.map((ch) => chipHtml(sc, ch)).join('') + '</div>') +
        '<div class="sub-extra" id="extra-' + sc.id + '"></div>' +
        '</div>'
      ).join('') + '</details>'
    ).join('');
    // The diatonic and rhythm settings live inside their subcategories.
    $('extra-diatonic').appendChild($('pitchOption'));
    $('extra-meters').appendChild($('rhythmOption'));

    $('pcChips').innerHTML = [].concat.apply([], Content.PICK_ROWS).map((p) =>
      '<button type="button" class="chip" data-pc="' + p + '">' + Content.pretty(p) + '</button>'
    ).join('');
    $('scalePick').innerHTML = Content.SCALE_CHOICES.map((g) =>
      '<optgroup label="' + g.label + '">' +
      g.options.map((o) => '<option value="' + o.value + '">' + o.text + '</option>').join('') + '</optgroup>'
    ).join('');
    const rangeOpts = Content.RANGE_NOTES.map((n) => '<option value="' + n + '">' + n + '</option>').join('');
    $('rangeLow').innerHTML = rangeOpts;
    $('rangeHigh').innerHTML = rangeOpts;
    updateSetupState();
  }

  function updatePitchOptions() {
    const mode = settings.pitchMode;
    document.querySelectorAll('#pitchMode button').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
    });
    $('scaleSub').classList.toggle('hidden', mode !== 'scale');
    $('pickSub').classList.toggle('hidden', mode !== 'pick');
    $('rangeSub').classList.toggle('hidden', mode === 'scale');

    $('scalePick').value = settings.scaleKey + ':' + settings.scaleType;
    document.querySelectorAll('#octaveChips .chip').forEach((b) => {
      b.setAttribute('aria-pressed', String(Number(b.dataset.oct) === settings.scaleOctaves));
    });
    document.querySelectorAll('#pcChips .chip').forEach((b) => {
      b.setAttribute('aria-pressed', String(settings.pitchClasses.indexOf(b.dataset.pc) >= 0));
    });
    $('rangeLow').value = settings.rangeLow;
    $('rangeHigh').value = settings.rangeHigh;

    const pool = Content.pitchPool(settings);
    const first = pool[0].detail.split(' · ')[0];
    const last = pool[pool.length - 1].detail.split(' · ')[0];
    $('pitchHint').textContent = pool.length + ' different cards, ' + first + ' to ' + last + '.';
    const desc = document.querySelector('.subcat[data-sub="diatonic"] .sub-desc');
    if (desc) desc.textContent = Content.pitchSummary(settings);
  }

  function updateSetupState() {
    Content.SUBCATS.forEach((sc) => {
      const n = picked(sc.id).length, total = sc.chips.length;
      const box = document.querySelector('.selall[data-sub="' + sc.id + '"]');
      if (box) {
        box.checked = sc.toggle ? n > 0 : n === total;
        box.indeterminate = !sc.toggle && n > 0 && n < total;
      }
      const el = document.querySelector('.subcat[data-sub="' + sc.id + '"]');
      if (el) el.classList.toggle('on', n > 0);
    });
    document.querySelectorAll('.ichip').forEach((el) => {
      el.setAttribute('aria-pressed', String(picked(el.dataset.sub).indexOf(el.dataset.id) >= 0));
    });
    Content.CATEGORIES.forEach((cat) => {
      const on = cat.subcats.filter((sc) => picked(sc.id).length).length;
      const el = $('count-' + cat.id);
      if (el) {
        el.textContent = on ? on + ' of ' + cat.subcats.length + ' on' : '';
        el.classList.toggle('on', on > 0);
      }
    });
    updatePitchOptions();

    const subs = activeSubs();
    $('startBtn').disabled = subs.length === 0;
    const rhythm = subs.some((sc) => sc.rhythm);
    const others = subs.filter((sc) => !sc.rhythm).length;
    let hint = '';
    if (!subs.length) hint = 'Pick at least one thing to practice to start.';
    else if (rhythm && others) hint = 'Rhythm cards are one measure each, so they get their own rounds, taking turns with the other cards.';
    else if (rhythm) hint = 'Each rhythm card is one full measure: count it, clap it, or play it on an open string.';
    else if (others === 1) hint = '1 subcategory on. Turn on more to mix them in the same round.';
    else hint = others + ' subcategories on. Each round mixes them together.';
    if (picked('degrees').length > 1) hint += ' Scale degrees in ' + picked('degrees').length + ' keys: difficult!';
    $('categoryHint').textContent = hint;
  }

  function bindSetup() {
    const changed = () => { saveSettings(); updateSetupState(); };

    $('categoryList').addEventListener('click', (e) => {
      const chip = e.target.closest('.ichip');
      if (!chip) return;
      const list = picked(chip.dataset.sub).slice();
      const i = list.indexOf(chip.dataset.id);
      if (i >= 0) list.splice(i, 1); else list.push(chip.dataset.id);
      // Keep picks in the order the chips are shown.
      const order = allChips(chip.dataset.sub);
      settings.sel[chip.dataset.sub] = list.sort((a, b) => order.indexOf(a) - order.indexOf(b));
      changed();
    });
    // "Select all" turns a whole subcategory on or off.
    $('categoryList').addEventListener('change', (e) => {
      const box = e.target.closest('.selall');
      if (!box) return;
      settings.sel[box.dataset.sub] = box.checked ? allChips(box.dataset.sub) : [];
      changed();
    });

    $('pitchMode').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      settings.pitchMode = b.dataset.mode;
      changed();
    });
    $('scalePick').addEventListener('change', () => {
      const parts = $('scalePick').value.split(':');
      settings.scaleKey = parts[0];
      settings.scaleType = parts[1];
      changed();
    });
    $('octaveChips').addEventListener('click', (e) => {
      const b = e.target.closest('.chip');
      if (!b) return;
      settings.scaleOctaves = Number(b.dataset.oct);
      changed();
    });
    $('pcChips').addEventListener('click', (e) => {
      const b = e.target.closest('.chip');
      if (!b) return;
      const i = settings.pitchClasses.indexOf(b.dataset.pc);
      if (i >= 0) { if (settings.pitchClasses.length > 1) settings.pitchClasses.splice(i, 1); }
      else settings.pitchClasses.push(b.dataset.pc);
      changed();
    });
    // Keep From at or below To.
    const order = (n) => Content.RANGE_NOTES.indexOf(n);
    $('rangeLow').addEventListener('change', () => {
      settings.rangeLow = $('rangeLow').value;
      if (order(settings.rangeLow) > order(settings.rangeHigh)) settings.rangeHigh = settings.rangeLow;
      changed();
    });
    $('rangeHigh').addEventListener('change', () => {
      settings.rangeHigh = $('rangeHigh').value;
      if (order(settings.rangeHigh) < order(settings.rangeLow)) settings.rangeLow = settings.rangeHigh;
      changed();
    });

    $('selectAll').addEventListener('click', () => {
      Content.SUBCATS.forEach((sc) => { settings.sel[sc.id] = allChips(sc.id); });
      changed();
    });
    $('selectNone').addEventListener('click', () => {
      Content.SUBCATS.forEach((sc) => { settings.sel[sc.id] = []; });
      changed();
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
    $('cardOrder').value = settings.cardOrder === 'random' ? 'random' : 'patterns';
    $('cardOrder').addEventListener('change', () => { settings.cardOrder = $('cardOrder').value; saveSettings(); });
    $('rhythmLevel').value = settings.rhythmLevel;
    $('rhythmLevel').addEventListener('change', () => { settings.rhythmLevel = $('rhythmLevel').value; saveSettings(); });

    const speed = $('speedPct');
    speed.value = settings.speedUpPct;
    speed.addEventListener('input', () => {
      settings.speedUpPct = Number(speed.value);
      saveSettings();
      updateSpeed();
    });
    $('speedUp').addEventListener('change', updateSpeed);
    $('rounds').addEventListener('change', updateSpeed);
    tempo.addEventListener('input', updateSpeed);

    ['speedUp', 'showAnswers', 'memory', 'clap'].forEach((key) => {
      const el = $(key);
      el.checked = !!settings[key];
      el.addEventListener('change', () => { settings[key] = el.checked; saveSettings(); });
    });
    updateSpeed();   // after the checkboxes show the saved settings

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
    const subs = activeSubs().length ? activeSubs() : Content.SUBCATS;
    let html = '';
    subs.forEach((sc) => {
      const cat = Content.CATEGORIES.find((c) => c.id === sc.cat);
      const title = cat.name + ' · ' + sc.name;
      if (sc.rhythm) {
        const meters = picked(sc.id).length ? picked(sc.id) : Content.METER_IDS;
        meters.forEach((m) => {
          const items = [];
          for (let i = 0; i < 4; i++) items.push(Content.rhythmItem(m, settings.rhythmLevel, Math.random));
          html += '<h3>' + title + ': ' + m + '</h3><div class="preview-grid wide">' +
            items.map((it) => '<div class="pcard">' + it.svg + '<b>' + it.say + '</b></div>').join('') + '</div>';
        });
        return;
      }
      const sel = picked(sc.id).length ? picked(sc.id) : allChips(sc.id);
      const items = sc.pool(sel, settings);
      html += '<h3>' + title + '</h3><div class="preview-grid">' +
        items.map((it) => '<div class="pcard">' + it.svg + '<b>' + it.say + '</b><span>' + it.detail + '</span></div>').join('') + '</div>';
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

  // Rhythm cards are a measure each, so they get rounds of their own.
  function buildGroups() {
    const subs = activeSubs();
    const groups = [];
    const singles = subs.filter((sc) => !sc.rhythm);
    if (singles.length) groups.push({ subs: singles });
    if (picked('meters').length) groups.push({ rhythm: true, meters: picked('meters') });
    return groups;
  }

  /*
   * Card order. Each letter stands for a different card. Early rounds follow
   * patterns that get harder, and later rounds are random.
   */
  const PATTERNS = {
    easy: ['AABBAABB', 'AAAABBBB', 'ABBBABBB', 'AABBCCCC', 'AAABAAAB'],
    medium: ['ABABBABA', 'ABABCDCD', 'ABBAABBA', 'ABACABAC'],
    hard: ['ABCABCAB', 'ABAABCBB', 'ABCDABCD', 'ABCBACBA']
  };
  const LEVEL_BY_ROUND = ['easy', 'easy', 'medium', 'hard'];   // round 5 on: random
  const LEVEL_NAMES = { easy: 'Easy pattern', medium: 'Medium pattern', hard: 'Hard pattern', random: 'Random' };

  function levelFor(roundIdx) {
    if (settings.cardOrder === 'random') return 'random';
    return LEVEL_BY_ROUND[roundIdx] || 'random';
  }

  // A function that draws one random card for a round.
  function cardPicker(group, meterId) {
    if (group.rhythm) return () => Content.rhythmItem(meterId, settings.rhythmLevel, Math.random);
    // Build each subcategory's cards once per round, then pick a subcategory, then a card.
    const pools = group.subs.map((sc) => sc.pool(picked(sc.id), settings)).filter((p) => p.length);
    return () => {
      const pool = pools[Math.floor(Math.random() * pools.length)];
      return pool[Math.floor(Math.random() * pool.length)];
    };
  }

  function randomItems(pick) {
    const items = [];
    let guard = 0;
    while (items.length < CARDS_PER_ROUND && guard++ < 200) {
      const item = pick();
      const n = items.length;
      // Repeats happen, but not three of the same card in a row.
      if (n >= 2 && items[n - 1].id === item.id && items[n - 2].id === item.id) continue;
      items.push(item);
    }
    return items;
  }

  function makeItems(pick, level) {
    if (level === 'random') return randomItems(pick);
    // A different pattern from last round when possible.
    const choices = PATTERNS[level].filter((p) => p !== game.lastPattern);
    const pattern = choices[Math.floor(Math.random() * choices.length)];
    game.lastPattern = pattern;

    const chosen = {};
    const used = new Set();
    pattern.split('').forEach((letter) => {
      if (chosen[letter]) return;
      let item = pick();
      // Each letter is a card with a different answer (G3 and G4 would both be "G"),
      // unless the pool is too small to allow it.
      for (let tries = 0; used.has(item.say) && tries < 60; tries++) item = pick();
      used.add(item.say);
      chosen[letter] = item;
    });
    return pattern.split('').map((letter) => chosen[letter]);
  }

  function isLastRound(roundIdx) { return settings.rounds > 0 && roundIdx >= settings.rounds - 1; }
  function bpmFor(roundIdx) {
    const factor = settings.speedUp ? Math.pow(1 + settings.speedUpPct / 100, roundIdx) : 1;
    return Math.min(MAX_BPM, Math.round(settings.bpm * factor));
  }

  // Shows the percent and what the first few rounds' tempos will be.
  function updateSpeed() {
    const on = $('speedUp').checked;
    settings.speedUp = on;
    $('speedOut').textContent = settings.speedUpPct + '%';
    $('speedPct').disabled = !on;
    $('speedOption').classList.toggle('off', !on);
    const n = settings.rounds > 0 ? Math.min(settings.rounds, 6) : 6;
    const list = [];
    for (let i = 0; i < n; i++) list.push(bpmFor(i));
    const more = settings.rounds === 0 || settings.rounds > n ? ' → …' : '';
    $('speedHint').textContent = on ? list.join(' → ') + more + ' BPM (tops out at ' + MAX_BPM + ')' : 'Same tempo every round';
  }

  /*
   * A round is a list of beats. Every section is a whole number of bars:
   *   count-in (first round / after a restart) → reveal (one card per beat)
   *   → say (one card per beat, or one measure per rhythm card) → answers or a short break.
   * Each beat has a length relative to the tempo's beat (7/8's last beat is 1.5) and
   * a number of divisions (2, or 3 for a dotted-quarter beat).
   */
  function buildPlan(roundIdx, countIn) {
    const group = game.groups[roundIdx % game.groups.length];
    let meterId = null, lens = [1, 1, 1, 1], subs = [2, 2, 2, 2], base = 12;
    if (group.rhythm) {
      // Several time signatures take turns, one per rhythm round.
      const nth = Math.floor(roundIdx / game.groups.length);
      meterId = group.meters[nth % group.meters.length];
      const M = Content.METERS[meterId];
      base = M.beats[0];
      lens = M.beats.map((l) => l / base);
      subs = M.beats.map((l) => (l % 18 === 0 ? 3 : 2));
    }
    const m = lens.length;
    const beats = [];
    if (countIn) for (let i = 0; i < m; i++) beats.push({ phase: 'count', n: i + 1 });

    const revealLen = Math.ceil(CARDS_PER_ROUND / m) * m;
    for (let i = 0; i < revealLen; i++) {
      beats.push({ phase: 'reveal', reveal: i < CARDS_PER_ROUND ? i : null, fill: i === revealLen - 1 });
    }
    const perCard = group.rhythm ? m : 1;
    for (let k = 0; k < CARDS_PER_ROUND; k++) {
      for (let b = 0; b < perCard; b++) beats.push({ phase: 'say', card: k, first: b === 0, crash: k === 0 && b === 0 });
    }
    const tail = settings.showAnswers ? 2 * m : m;
    for (let i = 0; i < tail; i++) beats.push({ phase: settings.showAnswers ? 'review' : 'break' });
    if (!isLastRound(roundIdx)) beats[beats.length - 1].fill = true;
    beats.forEach((b, i) => { b.barPos = i % m; b.len = lens[b.barPos]; b.sub = subs[b.barPos]; });

    const level = levelFor(roundIdx);
    return {
      roundIdx: roundIdx, group: group, rhythm: !!group.rhythm, meterId: meterId, base: base, meter: m,
      cardLen: group.rhythm ? lens.reduce((a, b) => a + b, 0) : 1,
      level: level, items: makeItems(cardPicker(group, meterId), level), beats: beats, bpm: bpmFor(roundIdx)
    };
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
      const beatDur = spb * b.len;
      engine.playBeat({
        t: t, spb: beatDur, sub: b.sub, barPos: b.barPos, meter: plan.meter, bar: game.bar, phase: b.phase,
        fill: b.fill, crash: b.crash, bell: b.reveal != null ? b.reveal : null
      });
      // Clap each note of the rhythm card as it lights up.
      if (b.phase === 'say' && b.first && plan.rhythm && settings.clap) {
        const item = plan.items[b.card];
        const perUnit = spb / plan.base;
        (item.onsets || []).forEach((u) => engine.clap(t + u * perUnit));
      }
      if (b.barPos === plan.meter - 1) game.bar++;
      queue(t, () => applyBeat(plan, b, spb));
      game.nextTime += beatDur;
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
    grid.className = 'grid' + (plan.rhythm ? ' wide' : '') + (game.forceAnswers ? ' answers' : '');
    game.inReview = false;
    grid.innerHTML = plan.items.map((it, i) =>
      '<div class="card" data-i="' + i + '"><div class="num">' + (i + 1) + '</div>' +
      '<div class="face"><div class="art">' + it.svg + '</div>' +
      '<div class="answer"><b>' + it.say + '</b><span>' + it.detail + '</span></div></div>' +
      '<div class="progress"></div></div>'
    ).join('');
    game.cards = Array.from(grid.children);

    const total = settings.rounds > 0 ? ' of ' + settings.rounds : '';
    $('roundLabel').innerHTML = 'Round ' + (plan.roundIdx + 1) + total + '<span class="level">' +
      LEVEL_NAMES[plan.level] + (plan.meterId ? ' · ' + plan.meterId : '') + '</span>';
    $('bpmLabel').textContent = plan.bpm + ' BPM';
    $('beatDots').innerHTML = plan.beats.slice(0, plan.meter).map((b, i) =>
      '<i class="' + (i === 0 ? 'down' : '') + (b.len > 1 ? ' long' : '') + '"></i>').join('');
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
        card.style.setProperty('--dur', (plan.cardLen * spb).toFixed(3) + 's');
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
    if (!activeSubs().length) return;
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
      const target = e.target || {};
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

      if (!$('preview').classList.contains('hidden')) {
        if (key === 'Escape') closePreview();
        return;
      }

      if (!game.started) {
        // Space starts, except where it already means something (menus, checkboxes).
        if (key === ' ' && target.tagName !== 'SELECT' && !(target.tagName === 'INPUT' && target.type === 'checkbox')) {
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

  // Load the music font now so the first cards don't flash blank.
  if (document.fonts && document.fonts.load) document.fonts.load('40px "SayItOnBeat Music"', '').catch(() => {});

  renderCategories();
  bindSetup();
  bindGame();
})();
