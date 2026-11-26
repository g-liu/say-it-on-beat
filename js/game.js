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
    lastSel: {},                 // picks remembered when a subcategory is switched off
    tab: 'cards',                // 'cards' | 'rhythms' (see Content.TABS); only the open tab is played
    // Keys for the subcategories that have a key picker (ids like 'C:major', 'A:minor')
    spellKeys: ['C:major'],
    degreeKeys: ['C:major'],
    intervalKeys: ['C:major'],
    intervalStyle: 'melodic',    // 'melodic' | 'harmonic'
    cadenceKeys: ['C:major'],
    chordLabels: 'roman',        // spelling cards and cadence answers: 'roman' | 'function'
    instrument: 'violin',        // 'violin' | 'viola' | 'both' (see Content.INSTRUMENTS)
    clefMode: Content.CLEF_MODES[0],   // for 'both': 'alternate' | 'treble' | 'alto'
    clap: false,                 // clap the rhythm cards during "Say it!"
    clapVolume: 1,               // 0.1 to 1; 1 peaks at 0.99 (see js/audio.js)
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
    rangePreset: 1,              // 1 | 2 | 3 octaves, or 'custom' (rangeLow to rangeHigh)
    rangeLow: 'G3',
    rangeHigh: 'B5',
    noteAnswer: 'names',         // Note names cards: 'names' | 'fingers'
    pitchClasses: ['C', 'D', 'E', 'F', 'G', 'A', 'B']
  };

  const SCALE_VALUES = [].concat.apply([], Content.SCALE_CHOICES.map((g) => g.options.map((o) => o.value)));
  const clamp = (v, lo, hi, dflt) => (isFinite(v) ? Math.min(hi, Math.max(lo, Number(v))) : dflt);
  const allChips = (subId) => Content.subById(subId).chips.map((c) => c.id);
  // What a subcategory picks when it's switched on for the first time.
  const defaultChips = (subId) => {
    const sc = Content.subById(subId);
    return (sc.defaults ? sc.defaults.slice() : allChips(subId));
  };
  // A chip can be hidden (e.g. the E string for viola) or disabled (e.g. whole notes in 3/4) by the other settings.
  const chipState = (sc, id) => (sc.chipState ? sc.chipState(id, settings) : '') || '';
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
    const sel = s.sel && typeof s.sel === 'object' ? Object.assign({}, s.sel) : migrateSelection(s);
    // Scale degrees used to pick major keys with its chips; now the chips are degrees 1-7 and keys have a picker.
    if (Array.isArray(sel.degrees) && sel.degrees.some((d) => !/^[1-7]$/.test(d))) {
      if (!Array.isArray(s.degreeKeys)) s.degreeKeys = sel.degrees.map((k) => k + ':major');
      out.degreeKeys = s.degreeKeys;
      sel.degrees = sel.degrees.length ? Content.DEGREE_IDS.slice() : [];
    }
    // Chips that moved to another subcategory take their saved picks with them.
    Object.keys(Content.RELOCATED_CHIPS).forEach((id) => {
      const [from, to] = Content.RELOCATED_CHIPS[id];
      const list = sel[from] || [];
      if (list.indexOf(id) < 0) return;
      sel[from] = list.filter((x) => x !== id);
      sel[to] = (sel[to] || []).concat([id]);
    });
    out.sel = {};
    out.lastSel = {};
    const saved = s.lastSel && typeof s.lastSel === 'object' ? s.lastSel : {};
    Content.SUBCATS.forEach((sc) => {
      const valid = sc.chips.map((c) => c.id);
      const order = (a, b) => valid.indexOf(a) - valid.indexOf(b);
      out.sel[sc.id] = (sel[sc.id] || []).filter((id) => valid.indexOf(id) >= 0).sort(order);
      const last = (saved[sc.id] || []).filter((id) => valid.indexOf(id) >= 0);
      if (last.length) out.lastSel[sc.id] = last;
    });
    // Before the tabs, rhythms and the other cards took turns; open the tab that has something on.
    if (Content.TABS.map((t) => t.id).indexOf(out.tab) < 0) out.tab = DEFAULTS.tab;
    if (!s.tab) {
      const onIn = (tab) => Content.SUBCATS.some((sc) => sc.tab === tab && out.sel[sc.id].length);
      out.tab = onIn('cards') || !onIn('rhythms') ? 'cards' : 'rhythms';
    }
    // The old basic / advanced rhythm menu becomes picked note values.
    if (!(s.sel && s.sel.rhythmvalues) && s.rhythmLevel === 'advanced') {
      out.sel.rhythmvalues = Content.DEFAULT_RHYTHM_VALUES.concat(['16', 'd8', 'dq', 'trip', 'dup']);
    }
    // Subcategories that are always on (rhythm note values) start with their defaults.
    Content.SUBCATS.forEach((sc) => { if (sc.fixed && !out.sel[sc.id].length) out.sel[sc.id] = defaultChips(sc.id); });
    delete out.rhythmLevel;
    delete out.categories;
    delete out.strings;
    // Key pickers keep only real keys, and at least one.
    const keyIds = Content.KEYS.map((k) => k.id);
    Content.SUBCATS.forEach((sc) => {
      if (!sc.keyPicker) return;
      const list = (Array.isArray(out[sc.keyPicker]) ? out[sc.keyPicker] : []).filter((k) => keyIds.indexOf(k) >= 0);
      out[sc.keyPicker] = list.length ? list : DEFAULTS[sc.keyPicker].slice();
    });
    // Option switches keep one of their choices.
    Content.SUBCATS.forEach((sc) => (sc.options || []).forEach((o) => {
      if (o.choices.map((c) => c[0]).indexOf(out[o.setting]) < 0) out[o.setting] = DEFAULTS[o.setting];
    }));
    if (Content.INSTRUMENT_IDS.indexOf(out.instrument) < 0) out.instrument = DEFAULTS.instrument;
    if (Content.CLEF_MODES.indexOf(out.clefMode) < 0) out.clefMode = DEFAULTS.clefMode;
    if (['scale', 'chromatic', 'pick'].indexOf(out.pitchMode) < 0) out.pitchMode = DEFAULTS.pitchMode;
    if (SCALE_VALUES.indexOf(out.scaleKey + ':' + out.scaleType) < 0) {
      out.scaleKey = DEFAULTS.scaleKey;
      out.scaleType = DEFAULTS.scaleType;
    }
    out.clapVolume = clamp(out.clapVolume, 0.1, 1, DEFAULTS.clapVolume);
    out.bpm = clamp(out.bpm, MIN_START_BPM, MAX_START_BPM, DEFAULTS.bpm);
    out.speedUpPct = Math.round(clamp(out.speedUpPct, MIN_SPEED_PCT, MAX_SPEED_PCT, DEFAULTS.speedUpPct));
    // The 1 / 2 octave buttons and the From / To menus became range presets and a custom range.
    if (s.rangePreset === undefined) {
      if ((s.pitchMode === 'chromatic' || s.pitchMode === 'pick') && s.rangeLow) out.rangePreset = 'custom';
      else out.rangePreset = s.scaleOctaves === 2 ? 2 : 1;
    }
    if (Content.RANGE_PRESETS.indexOf(out.rangePreset) < 0) out.rangePreset = DEFAULTS.rangePreset;
    delete out.scaleOctaves;
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
  // Picks that the current settings allow (hidden or disabled chips don't count).
  const usable = (subId) => {
    const sc = Content.subById(subId);
    return picked(subId).filter((id) => !chipState(sc, id));
  };
  const tabSubs = (tab) => Content.SUBCATS.filter((sc) => sc.tab === (tab || settings.tab));
  // Only the open tab is played.
  const activeSubs = () => tabSubs().filter((sc) => usable(sc.id).length > 0);

  /* ============================ setup screen ============================ */

  function chipHtml(sc, ch) {
    const inner = ch.html || esc(ch.label);
    return '<button type="button" class="ichip' + (ch.html ? ' art' : '') + (ch.cls ? ' ' + ch.cls : '') +
      '" data-sub="' + sc.id + '" data-id="' + esc(ch.id) + '" title="' + esc(ch.label) + '" aria-label="' + esc(ch.label) + '">' +
      inner + '</button>';
  }

  // Chips, with a heading wherever a new group starts (e.g. "Simple" and "Complex" time signatures).
  function chipsHtml(sc) {
    let group = null, out = '';
    sc.chips.forEach((ch) => {
      if (ch.group && ch.group !== group) {
        group = ch.group;
        out += '<span class="chip-group">' + esc(group) + '</span>';
      }
      out += chipHtml(sc, ch);
    });
    return '<div class="ichips' + (sc.chipsCls ? ' ' + sc.chipsCls : '') + '">' + out + '</div>';
  }

  // Extra settings inside a subcategory: option switches and a key picker.
  function optionsHtml(sc) {
    return (sc.options || []).map((o) =>
      '<div class="optrow"><span class="optlabel">' + esc(o.label) + '</span><div class="seg small optseg">' +
      o.choices.map((c) => '<button type="button" data-setting="' + o.setting + '" data-value="' + esc(c[0]) + '">' +
        esc(c[1]) + '</button>').join('') + '</div></div>'
    ).join('');
  }
  function keyPickerHtml(sc) {
    if (!sc.keyPicker) return '';
    const row = (mode) => '<span class="chip-group">' + (mode === 'major' ? 'Major keys' : 'Minor keys') + '</span>' +
      Content.KEYS.filter((k) => k.mode === mode).map((k) =>
        '<button type="button" class="keychip" data-setting="' + sc.keyPicker + '" data-key="' + k.id + '" title="' +
        esc(Content.pretty(k.tonic) + ' ' + k.mode) + '">' + Content.pretty(k.tonic) + (mode === 'minor' ? 'm' : '') + '</button>'
      ).join('');
    return '<div class="keypick">' + row('major') + row('minor') + '</div>';
  }

  function subcatHtml(sc) {
    return '<div class="subcat" data-sub="' + sc.id + '">' +
      '<div class="subhead"><label>' + (sc.fixed ? '' : '<input type="checkbox" class="selall" data-sub="' + sc.id + '">') +
      '<span class="sub-name">' + sc.name + '</span></label>' +
      (sc.toggle ? '' : '<button type="button" class="sub-all" data-sub="' + sc.id + '">All</button>') +
      '<span class="sub-desc">' + sc.desc + '</span></div>' +
      (sc.toggle ? '' : chipsHtml(sc)) +
      '<div class="sub-extra" id="extra-' + sc.id + '">' + optionsHtml(sc) + keyPickerHtml(sc) + '</div>' +
      '</div>';
  }

  function renderCategories() {
    $('tabBar').innerHTML = Content.TABS.map((t) =>
      '<button type="button" role="tab" class="tab" data-tab="' + t.id + '" id="tab-' + t.id + '">' +
      '<span class="tab-name">' + t.name + '</span><span class="tab-count" id="tabcount-' + t.id + '"></span></button>'
    ).join('');
    $('categoryList').innerHTML = Content.CATEGORIES.map((cat) =>
      '<details class="catgroup" open data-cat="' + cat.id + '" data-tab="' + cat.tab + '">' +
      '<summary><span class="cat-name">' + cat.name + '</span><span class="cat-count" id="count-' + cat.id + '"></span></summary>' +
      cat.subcats.map(subcatHtml).join('') + '</details>'
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
    updateSetupState();
  }

  // Slider positions are indexes into Content.RANGE_NOTES (the naturals from C3 to B7).
  const noteIdx = (midi) => {
    let i = 0;
    Content.RANGE_NOTES.forEach((n, k) => { if (Content.rangeMidi(n) <= midi) i = k; });
    return i;
  };

  function updatePitchOptions() {
    const mode = settings.pitchMode;
    document.querySelectorAll('#pitchMode button').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
    });
    $('scaleSub').classList.toggle('hidden', mode !== 'scale');
    $('pickSub').classList.toggle('hidden', mode !== 'pick');

    $('scalePick').value = settings.scaleKey + ':' + settings.scaleType;
    document.querySelectorAll('#pcChips .chip').forEach((b) => {
      b.setAttribute('aria-pressed', String(settings.pitchClasses.indexOf(b.dataset.pc) >= 0));
    });

    // Range: presets, and the two-ended slider (from the instrument's lowest note to B7).
    document.querySelectorAll('#rangePresets button').forEach((b) => {
      b.setAttribute('aria-pressed', String(String(settings.rangePreset) === b.dataset.preset));
    });
    const [lo, hi] = Content.rangeFor(settings);
    const min = noteIdx(Content.INSTRUMENTS[settings.instrument].lowest), max = Content.RANGE_NOTES.length - 1;
    const loI = noteIdx(lo), hiI = noteIdx(hi);
    [$('rangeLowSlider'), $('rangeHighSlider')].forEach((el) => { el.min = min; el.max = max; });
    $('rangeLowSlider').value = loI;
    $('rangeHighSlider').value = hiI;
    const pct = (i) => ((i - min) / (max - min)) * 100;
    $('rangeFill').style.left = pct(loI) + '%';
    $('rangeFill').style.right = (100 - pct(hiI)) + '%';
    $('rangeLowOut').textContent = Content.midiLabel(lo);
    $('rangeHighOut').textContent = Content.midiLabel(hi);
    // Labels sit under their thumbs (the track is inset by the thumb's radius).
    $('rangeLowOut').style.left = 'calc(10px + (100% - 20px) * ' + (pct(loI) / 100) + ')';
    $('rangeHighOut').style.left = 'calc(10px + (100% - 20px) * ' + (pct(hiI) / 100) + ')';

    const pool = Content.pitchPool(settings);
    const first = pool[0].detail.split(' · ')[0];
    const last = pool[pool.length - 1].detail.split(' · ')[0];
    $('pitchHint').textContent = pool.length + ' different cards, ' + first + ' to ' + last + '.';
    const desc = document.querySelector('.subcat[data-sub="diatonic"] .sub-desc');
    if (desc) desc.textContent = Content.pitchSummary(settings);
  }

  function updateSetupState() {
    // Tabs: only the open tab's categories show.
    Content.TABS.forEach((t) => {
      const on = tabSubs(t.id).filter((sc) => usable(sc.id).length).length;
      const btn = $('tab-' + t.id);
      btn.setAttribute('aria-selected', String(t.id === settings.tab));
      const count = $('tabcount-' + t.id);
      count.textContent = on ? String(on) : '';
      count.classList.toggle('on', on > 0);
    });
    $('tabDesc').textContent = Content.TABS.find((t) => t.id === settings.tab).desc;
    document.querySelectorAll('.catgroup').forEach((el) => el.classList.toggle('hidden', el.dataset.tab !== settings.tab));

    Content.SUBCATS.forEach((sc) => {
      const n = picked(sc.id).length;
      const box = document.querySelector('.selall[data-sub="' + sc.id + '"]');
      if (box) box.checked = n > 0;
      const el = document.querySelector('.subcat[data-sub="' + sc.id + '"]');
      if (el) el.classList.toggle('on', usable(sc.id).length > 0);
      const all = document.querySelector('.sub-all[data-sub="' + sc.id + '"]');
      if (all) all.disabled = sc.chips.every((c) => chipState(sc, c.id) || picked(sc.id).indexOf(c.id) >= 0);
    });
    document.querySelectorAll('.ichip').forEach((el) => {
      const sc = Content.subById(el.dataset.sub);
      const state = chipState(sc, el.dataset.id);
      el.setAttribute('aria-pressed', String(picked(el.dataset.sub).indexOf(el.dataset.id) >= 0));
      el.classList.toggle('hidden', state === 'hidden');
      el.disabled = state === 'disabled';
    });
    Content.CATEGORIES.forEach((cat) => {
      const on = cat.subcats.filter((sc) => usable(sc.id).length).length;
      const el = $('count-' + cat.id);
      if (el) {
        el.textContent = on ? on + ' of ' + cat.subcats.length + ' on' : '';
        el.classList.toggle('on', on > 0);
      }
    });
    document.querySelectorAll('.optseg button').forEach((b) => {
      b.setAttribute('aria-pressed', String(settings[b.dataset.setting] === b.dataset.value));
    });
    document.querySelectorAll('.keychip').forEach((b) => {
      b.setAttribute('aria-pressed', String(settings[b.dataset.setting].indexOf(b.dataset.key) >= 0));
    });
    updatePitchOptions();
    updateInstrument();

    const subs = activeSubs();
    // Rhythm rounds need a time signature.
    $('startBtn').disabled = settings.tab === 'rhythms' ? !usable('meters').length : subs.length === 0;
    let hint = '';
    if (settings.tab === 'rhythms') {
      hint = usable('meters').length ? 'Each rhythm card is one full measure: count it, clap it, or play it on an open string.'
        : 'Pick at least one time signature to start.';
    } else if (!subs.length) hint = 'Pick at least one thing to practice to start.';
    else if (subs.length === 1) hint = '1 subcategory on. Turn on more to mix them in the same round.';
    else hint = subs.length + ' subcategories on. Each round mixes them together.';
    if (settings.tab === 'cards' && usable('degrees').length > 1) hint += ' Scale degrees in ' + usable('degrees').length + ' keys: difficult!';
    $('categoryHint').textContent = hint;
  }

  // The page-wide instrument switch, and the clef choice for a mixed class.
  function updateInstrument() {
    document.querySelectorAll('#instrumentSwitch button').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.inst === settings.instrument));
    });
    document.querySelectorAll('#clefMode button').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.clef === settings.clefMode));
    });
    $('clefModeWrap').classList.toggle('hidden', settings.instrument !== 'both');
    $('editionLabel').textContent = Content.INSTRUMENTS[settings.instrument].name + ' class edition';
    Content.SUBCATS.forEach((sc) => {
      if (!sc.describe) return;
      const desc = document.querySelector('.subcat[data-sub="' + sc.id + '"] .sub-desc');
      if (desc) desc.textContent = sc.describe(settings);
    });
  }

  function bindSetup() {
    const changed = () => { saveSettings(); updateSetupState(); };

    $('instrumentSwitch').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.dataset.inst === settings.instrument) return;
      // If every string of the old instrument was picked, pick every string of the new one.
      const sameSet = (a, b2) => a.length === b2.length && a.every((x) => b2.indexOf(x) >= 0);
      const oldStrings = Content.INSTRUMENTS[settings.instrument].strings;
      settings.instrument = b.dataset.inst;
      if (sameSet(picked('home'), oldStrings)) settings.sel.home = Content.INSTRUMENTS[settings.instrument].strings.slice();
      changed();
    });
    $('clefMode').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      settings.clefMode = b.dataset.clef;
      changed();
    });

    $('tabBar').addEventListener('click', (e) => {
      const tab = e.target.closest('.tab');
      if (!tab) return;
      settings.tab = tab.dataset.tab;
      changed();
    });
    $('categoryList').addEventListener('click', (e) => {
      const opt = e.target.closest('.optseg button');
      if (opt) {
        settings[opt.dataset.setting] = opt.dataset.value;
        changed();
        return;
      }
      const keyChip = e.target.closest('.keychip');
      if (keyChip) {
        const list = settings[keyChip.dataset.setting];
        const i = list.indexOf(keyChip.dataset.key);
        if (i >= 0) { if (list.length > 1) list.splice(i, 1); }   // keep at least one key
        else list.push(keyChip.dataset.key);
        const order = Content.KEYS.map((k) => k.id);
        list.sort((a, b) => order.indexOf(a) - order.indexOf(b));
        changed();
        return;
      }
      const all = e.target.closest('.sub-all');
      if (all) {
        const sc = Content.subById(all.dataset.sub);
        settings.sel[sc.id] = allChips(sc.id).filter((id) => !chipState(sc, id) || picked(sc.id).indexOf(id) >= 0);
        changed();
        return;
      }
      const chip = e.target.closest('.ichip');
      if (!chip) return;
      const list = picked(chip.dataset.sub).slice();
      const i = list.indexOf(chip.dataset.id);
      const fixed = Content.subById(chip.dataset.sub).fixed;
      if (i >= 0) { if (!fixed || list.length > 1) list.splice(i, 1); }   // always-on subcategories keep one pick
      else list.push(chip.dataset.id);
      // Keep picks in the order the chips are shown.
      const order = allChips(chip.dataset.sub);
      settings.sel[chip.dataset.sub] = list.sort((a, b) => order.indexOf(a) - order.indexOf(b));
      changed();
    });
    // The checkbox turns a subcategory on (with the picks it had last time, or its defaults) or off.
    $('categoryList').addEventListener('change', (e) => {
      const box = e.target.closest('.selall');
      if (!box) return;
      const id = box.dataset.sub;
      if (box.checked) {
        const last = settings.lastSel[id];
        settings.sel[id] = last && last.length ? last.slice() : defaultChips(id);
      } else {
        if (picked(id).length) settings.lastSel[id] = picked(id).slice();
        settings.sel[id] = [];
      }
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
    $('rangePresets').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.preset === 'custom') {
        // Start the custom range where the preset was.
        const [lo, hi] = Content.rangeFor(settings);
        settings.rangeLow = Content.RANGE_NOTES[noteIdx(lo)];
        settings.rangeHigh = Content.RANGE_NOTES[noteIdx(hi)];
        settings.rangePreset = 'custom';
      } else settings.rangePreset = Number(b.dataset.preset);
      changed();
    });
    // Moving either end makes the range custom; the ends can't cross.
    const slide = (which) => () => {
      const [lo, hi] = Content.rangeFor(settings);
      let loI = noteIdx(lo);
      let hiI = noteIdx(hi);
      const v = Number($(which === 'low' ? 'rangeLowSlider' : 'rangeHighSlider').value);
      if (which === 'low') { loI = Math.min(v, hiI); } else { hiI = Math.max(v, loI); }
      settings.rangePreset = 'custom';
      settings.rangeLow = Content.RANGE_NOTES[loI];
      settings.rangeHigh = Content.RANGE_NOTES[hiI];
      changed();
    };
    $('rangeLowSlider').addEventListener('input', slide('low'));
    $('rangeHighSlider').addEventListener('input', slide('high'));
    $('pcChips').addEventListener('click', (e) => {
      const b = e.target.closest('.chip');
      if (!b) return;
      const i = settings.pitchClasses.indexOf(b.dataset.pc);
      if (i >= 0) { if (settings.pitchClasses.length > 1) settings.pitchClasses.splice(i, 1); }
      else settings.pitchClasses.push(b.dataset.pc);
      changed();
    });
    // These act on the open tab only.
    $('selectAll').addEventListener('click', () => {
      tabSubs().forEach((sc) => { settings.sel[sc.id] = allChips(sc.id).filter((id) => !chipState(sc, id)); });
      changed();
    });
    $('selectNone').addEventListener('click', () => {
      tabSubs().forEach((sc) => {
        if (sc.fixed) return;
        if (picked(sc.id).length) settings.lastSel[sc.id] = picked(sc.id).slice();
        settings.sel[sc.id] = [];
      });
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

    const clapVol = $('clapVolume');
    const showClap = () => { $('clapVolumeOut').textContent = Math.round(settings.clapVolume * 100) + '%'; };
    clapVol.value = settings.clapVolume;
    showClap();
    clapVol.addEventListener('input', () => {
      settings.clapVolume = Number(clapVol.value);
      if (engine.ctx) engine.setClapVolume(settings.clapVolume);
      showClap();
      saveSettings();
    });

    $('startBtn').addEventListener('click', startGame);
    $('previewBtn').addEventListener('click', openPreview);
    $('previewClose').addEventListener('click', closePreview);
  }

  /* ============================ card preview ============================ */

  function openPreview() {
    const subs = activeSubs().length ? activeSubs() : tabSubs();
    let html = '';
    subs.forEach((sc) => {
      if (sc.fixed && !sc.pool) return;
      const cat = Content.CATEGORIES.find((c) => c.id === sc.cat);
      const title = cat.name + ' · ' + sc.name;
      if (sc.rhythm) {
        const meters = usable(sc.id).length ? usable(sc.id) : Content.METER_IDS;
        meters.forEach((m) => {
          const items = [];
          for (let i = 0; i < 4; i++) items.push(Content.rhythmItem(m, usable('rhythmvalues'), Math.random));
          html += '<h3>' + title + ': ' + Content.meterName(m) + '</h3><div class="preview-grid wide">' +
            items.map((it) => '<div class="pcard">' + it.svg + '<b>' + it.say + '</b></div>').join('') + '</div>';
        });
        return;
      }
      const sel = usable(sc.id).length ? usable(sc.id) : allChips(sc.id).filter((id) => !chipState(sc, id));
      const items = sc.pool(sel, settings).map((it, i) => Content.resolve(it, Content.clefFor(settings, i)));
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

  // One kind of round per game: rhythms (a measure per card) or the mixed one-beat cards.
  function buildGroups() {
    if (settings.tab === 'rhythms') return [{ rhythm: true, meters: usable('meters') }];
    return [{ subs: activeSubs() }];
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
    if (group.rhythm) return () => Content.rhythmItem(meterId, usable('rhythmvalues'), Math.random);
    // Build each subcategory's cards once per round, then pick a subcategory, then a card.
    let pools = group.subs.map((sc) => sc.pool(usable(sc.id), settings)).filter((p) => p.length);
    // E.g. only minor-key cadences picked with only major keys: nothing fits.
    if (!pools.length) pools = [[{ id: 'empty', svg: '', say: '—', detail: 'Nothing matches these settings' }]];
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
      level: level, beats: beats, bpm: bpmFor(roundIdx),
      // Cards that show notes take the clef for their position (alternating in a mixed class).
      items: makeItems(cardPicker(group, meterId), level).map((it, i) => Content.resolve(it, Content.clefFor(settings, i)))
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
        fill: b.fill, crash: b.crash, bell: b.reveal != null ? b.reveal : null,
        // Quieter groove while the computer claps, so the claps are easy to hear.
        duck: b.phase === 'say' && plan.rhythm && settings.clap
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
      LEVEL_NAMES[plan.level] + (plan.meterId ? ' · ' + Content.meterName(plan.meterId) : '') + '</span>';
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
    engine.setClapVolume(settings.clapVolume);
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
