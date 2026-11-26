/*
 * theory.js — spelling notes, keys, intervals and chords. No drawing here, so it can be
 * checked in Node: `node tools/check_theory.js` prints every answer the chord and interval
 * cards can give.
 *
 * Note names are a letter plus an accidental: '' natural, '#', 'b', 'x' (double sharp), 'bb'.
 */
(function (global) {
  'use strict';

  const LETTERS = 'CDEFGAB';
  const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const ACC_VALUE = { '': 0, '#': 1, b: -1, x: 2, bb: -2 };
  const ACC_FOR = { 0: '', 1: '#', '-1': 'b', 2: 'x', '-2': 'bb' };
  const ACC_SYMBOL = { '#': '♯', b: '♭', x: '𝄪', bb: '𝄫' };

  const accOf = (name) => name.slice(1);
  const accValue = (name) => ACC_VALUE[accOf(name)] || 0;
  const pc = (name) => (((LETTER_PC[name[0]] + accValue(name)) % 12) + 12) % 12;
  const pretty = (name) => name[0] + (ACC_SYMBOL[accOf(name)] || '');
  const prettyList = (names) => names.map(pretty).join(' ');
  const toMidi = (name, octave) => (octave + 1) * 12 + LETTER_PC[name[0]] + accValue(name);

  /*
   * The note `steps` letters and `semis` semitones above `name` (e.g. a major 3rd is 2 letters,
   * 4 semitones). Returns null if it would need more than a double sharp or flat.
   */
  function above(name, steps, semis) {
    const letter = LETTERS[(LETTERS.indexOf(name[0]) + steps) % 7];
    let diff = (((pc(name) + semis - LETTER_PC[letter]) % 12) + 12) % 12;
    if (diff > 6) diff -= 12;
    return diff in ACC_FOR ? letter + ACC_FOR[diff] : null;
  }

  /* ---------------- keys ---------------- */

  // Major keys around the circle of fifths, with their relative minors.
  const KEY_PAIRS = [
    { n: 0, type: '', major: 'C', minor: 'A' },
    { n: 1, type: '#', major: 'G', minor: 'E' },
    { n: 2, type: '#', major: 'D', minor: 'B' },
    { n: 3, type: '#', major: 'A', minor: 'F#' },
    { n: 4, type: '#', major: 'E', minor: 'C#' },
    { n: 5, type: '#', major: 'B', minor: 'G#' },
    { n: 6, type: '#', major: 'F#', minor: 'D#' },
    { n: 1, type: 'b', major: 'F', minor: 'D' },
    { n: 2, type: 'b', major: 'Bb', minor: 'G' },
    { n: 3, type: 'b', major: 'Eb', minor: 'C' },
    { n: 4, type: 'b', major: 'Ab', minor: 'F' },
    { n: 5, type: 'b', major: 'Db', minor: 'Bb' },
    { n: 6, type: 'b', major: 'Gb', minor: 'Eb' }
  ];
  const SHARP_ORDER = 'FCGDAEB', FLAT_ORDER = 'BEADGCF';
  const MAJOR_STEPS = [2, 2, 1, 2, 2, 2, 1];
  const NATURAL_MINOR_STEPS = [2, 1, 2, 2, 1, 2, 2];

  // Key ids are 'C:major', 'A:minor', ...
  const KEYS = [].concat(
    KEY_PAIRS.map((k) => ({ id: k.major + ':major', tonic: k.major, mode: 'major', sig: k })),
    KEY_PAIRS.map((k) => ({ id: k.minor + ':minor', tonic: k.minor, mode: 'minor', sig: k })));
  const keyById = (id) => KEYS.find((k) => k.id === id);
  const keyName = (key) => pretty(key.tonic) + ' ' + key.mode;

  // The accidental the key signature gives a letter.
  function sigAcc(sig, letter) {
    if (!sig || !sig.n) return '';
    const order = sig.type === '#' ? SHARP_ORDER : FLAT_ORDER;
    return order.indexOf(letter) < sig.n ? sig.type : '';
  }
  // The accidental to print on a note in this key signature ('' if the signature covers it; 'n' for a natural).
  function shownAcc(name, sig) {
    const acc = accOf(name);
    if (acc === sigAcc(sig, name[0])) return '';
    return acc || 'n';
  }

  // The 7 notes of a key (natural minor for minor keys): [{ name, semi }].
  function scaleOf(key) {
    const steps = key.mode === 'minor' ? NATURAL_MINOR_STEPS : MAJOR_STEPS;
    const out = [];
    let semi = 0;
    for (let d = 0; d < 7; d++) {
      out.push({ name: above(key.tonic, d, semi), semi: semi });
      semi += steps[d];
    }
    return out;
  }

  /* ---------------- intervals ---------------- */

  // [id, name, letter steps, semitones]. Unison to tenth.
  // Button labels where the name reads better than the abbreviation, and other names for the answer.
  const INTERVAL_CHIPS = { P1: 'Unison', A4: 'Tritone', P8: 'Octave' };
  const INTERVAL_AKA = { P1: 'perfect unison', A4: 'augmented 4th', P8: 'perfect octave' };
  const INTERVALS = [
    ['P1', 'Unison', 0, 0], ['m2', 'Minor 2nd', 1, 1], ['M2', 'Major 2nd', 1, 2],
    ['m3', 'Minor 3rd', 2, 3], ['M3', 'Major 3rd', 2, 4], ['P4', 'Perfect 4th', 3, 5],
    ['A4', 'Tritone', 3, 6], ['d5', 'Diminished 5th', 4, 6], ['P5', 'Perfect 5th', 4, 7],
    ['m6', 'Minor 6th', 5, 8], ['M6', 'Major 6th', 5, 9], ['m7', 'Minor 7th', 6, 10],
    ['M7', 'Major 7th', 6, 11], ['P8', 'Octave', 7, 12], ['m9', 'Minor 9th', 8, 13],
    ['M9', 'Major 9th', 8, 14], ['m10', 'Minor 10th', 9, 15], ['M10', 'Major 10th', 9, 16]
  ].map((a) => ({ id: a[0], name: a[1], steps: a[2], semis: a[3], chip: INTERVAL_CHIPS[a[0]] || a[0], aka: INTERVAL_AKA[a[0]] }));
  const intervalById = (id) => INTERVALS.find((i) => i.id === id);

  // Every pair of notes in the key (lower note's degree 1-7) that makes this interval.
  function intervalsInKey(key, interval) {
    const scale = scaleOf(key);
    const out = [];
    scale.forEach((low, d) => {
      const hiIdx = d + interval.steps;
      const hi = scale[hiIdx % 7];
      const semis = scale[hiIdx % 7].semi + 12 * Math.floor(hiIdx / 7) - low.semi;
      if (semis === interval.semis) out.push({ low: low.name, high: hi.name, degree: d + 1 });
    });
    return out;
  }

  /* ---------------- chords ---------------- */

  /*
   * Chord qualities: the notes above the root as [letter steps, semitones], and how to say the
   * chord's name. `sym` is what follows the root when the class says it ("G7", "D minor").
   */
  const QUALITIES = {
    maj: { name: 'major triad', sym: ' major', tones: [[0, 0], [2, 4], [4, 7]] },
    min: { name: 'minor triad', sym: ' minor', tones: [[0, 0], [2, 3], [4, 7]] },
    dim: { name: 'diminished triad', sym: ' diminished', tones: [[0, 0], [2, 3], [4, 6]] },
    aug: { name: 'augmented triad', sym: ' augmented', tones: [[0, 0], [2, 4], [4, 8]] },
    dom7: { name: 'dominant 7th', sym: '7', tones: [[0, 0], [2, 4], [4, 7], [6, 10]] },
    maj7: { name: 'major 7th', sym: ' major 7', tones: [[0, 0], [2, 4], [4, 7], [6, 11]] },
    min7: { name: 'minor 7th', sym: ' minor 7', tones: [[0, 0], [2, 3], [4, 7], [6, 10]] },
    hdim7: { name: 'half-diminished 7th', sym: ' half-diminished 7', tones: [[0, 0], [2, 3], [4, 6], [6, 10]] },
    dim7: { name: 'diminished 7th', sym: ' diminished 7', tones: [[0, 0], [2, 3], [4, 6], [6, 9]] },
    mmaj7: { name: 'minor-major 7th', sym: ' minor-major 7', tones: [[0, 0], [2, 3], [4, 7], [6, 11]] },
    add2: { name: 'major add 2', sym: ' add 2', tones: [[0, 0], [1, 2], [2, 4], [4, 7]] },
    add4: { name: 'major add 4', sym: ' add 4', tones: [[0, 0], [2, 4], [3, 5], [4, 7]] },
    sus2: { name: 'suspended 2nd', sym: ' sus 2', tones: [[0, 0], [1, 2], [4, 7]] },
    sus4: { name: 'suspended 4th', sym: ' sus 4', tones: [[0, 0], [3, 5], [4, 7]] },
    maj6: { name: 'major 6th', sym: '6', tones: [[0, 0], [2, 4], [4, 7], [5, 9]] },
    min6: { name: 'minor 6th', sym: ' minor 6', tones: [[0, 0], [2, 3], [4, 7], [5, 9]] },
    dom9: { name: 'dominant 9th', sym: '9', tones: [[0, 0], [2, 4], [4, 7], [6, 10], [8, 14]] },
    maj9: { name: 'major 9th', sym: ' major 9', tones: [[0, 0], [2, 4], [4, 7], [6, 11], [8, 14]] },
    min9: { name: 'minor 9th', sym: ' minor 9', tones: [[0, 0], [2, 3], [4, 7], [6, 10], [8, 14]] },
    domb9: { name: 'dominant minor 9th', sym: '7 flat 9', tones: [[0, 0], [2, 4], [4, 7], [6, 10], [8, 13]] },
    dom11: { name: 'dominant 11th', sym: '11', tones: [[0, 0], [2, 4], [4, 7], [6, 10], [8, 14], [10, 17]] },
    dom13: { name: 'dominant 13th', sym: '13', tones: [[0, 0], [2, 4], [4, 7], [6, 10], [8, 14], [10, 17], [12, 21]] }
  };

  // The notes of a chord, root position, low to high; null if it needs triple accidentals.
  function chordNotes(root, quality) {
    const names = QUALITIES[quality].tones.map((t) => above(root, t[0], t[1]));
    return names.indexOf(null) >= 0 ? null : names;
  }
  // The chord tones as letter steps above the root (for placing them on the staff).
  const chordSteps = (quality) => QUALITIES[quality].tones.map((t) => t[0]);
  const chordName = (root, quality) => pretty(root) + QUALITIES[quality].sym;

  /*
   * Chords in a key. Each is { rn, fn, root degree (1-7, with an optional alteration),
   * quality, inversion, notes (custom spelling for augmented sixths) }:
   *   rn — Roman numeral: { base, q: '' | '°' | 'ø' | '+', figs: [], pre: '♭', post: '/V' }
   *   fn — the function name, for "show function names instead of Roman numerals"
   * Built by chordInKey(key, kindId) from KIND definitions below.
   */
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  const DEGREE_FN = ['Tonic', 'Supertonic', 'Mediant', 'Subdominant', 'Dominant', 'Submediant', 'Leading-tone'];

  // One chord in a key, from its scale degree. alter: semitones to raise (+1) or lower (-1) the root
  // from the key's note (e.g. ♭VI in major, raised leading tone in minor).
  function degreeChord(key, degree, alter, quality, extra) {
    const scale = scaleOf(key);
    let root = scale[degree - 1].name;
    if (alter) root = above(root, 0, alter);
    const notes = chordNotes(root, quality);
    return Object.assign({ root: root, quality: quality, notes: notes, inversion: 0 }, extra || {});
  }

  // A Roman numeral for a degree and quality: uppercase for major/augmented/dominant, lowercase otherwise.
  function numeral(degree, quality, opts) {
    opts = opts || {};
    const upper = ['maj', 'aug', 'dom7', 'maj7', 'dom9', 'domb9', 'dom11', 'dom13', 'add2', 'add4'].indexOf(quality) >= 0;
    const base = upper ? ROMAN[degree - 1] : ROMAN[degree - 1].toLowerCase();
    const q = { dim: '°', dim7: '°', hdim7: 'ø', aug: '+' }[quality] || '';
    const figs = opts.figs || ({ dom7: ['7'], maj7: ['7'], min7: ['7'], hdim7: ['7'], dim7: ['7'], dom9: ['9'], domb9: ['♭9'],
      dom11: ['11'], dom13: ['13'], add2: ['add2'], add4: ['add4'] }[quality] || []);
    return { base: base, q: q, figs: figs, pre: opts.pre || '', post: opts.post || '' };
  }
  // A plain-text Roman numeral, e.g. "V7", "vii°", "I⁶₄", "V/V".
  function rnText(rn) {
    const figs = rn.figs.length === 2 && /^\d$/.test(rn.figs[0]) ? rn.figs.join('/') : rn.figs.join('');
    const majSeven = rn.maj7 ? 'M' : '';
    return rn.pre + rn.base + rn.q + majSeven + figs + rn.post;
  }

  /*
   * Kinds of chords for "Spelling chords" and "Cadences", grouped in tiers. Each kind gives
   * one or more chords in a major key and in a minor key.
   */
  const MAJ = 'major', MIN = 'minor';
  function kindChords(kindId, key) {
    const k = key.mode;
    const d = (deg, q, rn, fn, alter, extra) => Object.assign(degreeChord(key, deg, alter || 0, q, extra), { rn: rn, fn: fn });
    const raisedLT = k === MIN ? 1 : 0;   // minor keys raise the leading tone for V and vii°
    switch (kindId) {
      case 'I': return [k === MAJ ? d(1, 'maj', numeral(1, 'maj'), 'Tonic') : d(1, 'min', numeral(1, 'min'), 'Tonic')];
      case 'IV': return [k === MAJ ? d(4, 'maj', numeral(4, 'maj'), 'Subdominant') : d(4, 'min', numeral(4, 'min'), 'Subdominant')];
      case 'V': return [d(5, 'maj', numeral(5, 'maj'), 'Dominant')];
      case 'V7': return [d(5, 'dom7', numeral(5, 'dom7'), 'Dominant 7th')];
      case 'ii': return [k === MAJ ? d(2, 'min', numeral(2, 'min'), 'Supertonic') : d(2, 'dim', numeral(2, 'dim'), 'Supertonic')];
      case 'iii': return [k === MAJ ? d(3, 'min', numeral(3, 'min'), 'Mediant') : d(3, 'maj', numeral(3, 'maj'), 'Mediant')];
      case 'vi': return [k === MAJ ? d(6, 'min', numeral(6, 'min'), 'Submediant') : d(6, 'maj', numeral(6, 'maj'), 'Submediant')];
      case 'vii': return [d(7, 'dim', numeral(7, 'dim'), 'Leading-tone', raisedLT)];
      case 'cad64': return [d(1, k === MAJ ? 'maj' : 'min', numeral(1, k === MAJ ? 'maj' : 'min', { figs: ['6', '4'] }),
        'Cadential 6-4', 0, { inversion: 2 })];
      case 'maj7': return k === MAJ
        ? [d(1, 'maj7', Object.assign(numeral(1, 'maj7'), { maj7: true }), 'Tonic major 7th'),
          d(4, 'maj7', Object.assign(numeral(4, 'maj7'), { maj7: true }), 'Subdominant major 7th')]
        : [d(3, 'maj7', Object.assign(numeral(3, 'maj7'), { maj7: true }), 'Mediant major 7th'),
          d(6, 'maj7', Object.assign(numeral(6, 'maj7'), { maj7: true }), 'Submediant major 7th')];
      case 'min7': return k === MAJ
        ? [d(2, 'min7', numeral(2, 'min7'), 'Supertonic 7th'), d(6, 'min7', numeral(6, 'min7'), 'Submediant 7th')]
        : [d(1, 'min7', numeral(1, 'min7'), 'Tonic 7th'), d(4, 'min7', numeral(4, 'min7'), 'Subdominant 7th')];
      case 'hdim7': return k === MAJ
        ? [d(7, 'hdim7', numeral(7, 'hdim7'), 'Leading-tone half-diminished 7th')]
        : [d(2, 'hdim7', numeral(2, 'hdim7'), 'Supertonic half-diminished 7th')];
      case 'dim7': return [d(7, 'dim7', numeral(7, 'dim7'), 'Leading-tone diminished 7th', raisedLT)];
      case 'aug': return k === MAJ
        ? [d(5, 'aug', numeral(5, 'aug'), 'Augmented dominant')]
        : [d(3, 'aug', numeral(3, 'aug'), 'Augmented mediant')];
      case 'add2': return [d(1, k === MAJ ? 'add2' : 'min', null, 'Tonic add 2')].map((c) => {
        if (k === MAJ) return Object.assign(c, { rn: numeral(1, 'add2') });
        // Minor: i add 2 (root, 2nd, minor 3rd, 5th).
        const notes = [c.root, above(c.root, 1, 2), above(c.root, 2, 3), above(c.root, 4, 7)];
        return Object.assign(c, { quality: 'minadd2', notes: notes, rn: { base: 'i', q: '', figs: ['add2'], pre: '', post: '' } });
      });
      case 'add4': return [d(1, k === MAJ ? 'add4' : 'min', null, 'Tonic add 4')].map((c) => {
        if (k === MAJ) return Object.assign(c, { rn: numeral(1, 'add4') });
        const notes = [c.root, above(c.root, 2, 3), above(c.root, 3, 5), above(c.root, 4, 7)];
        return Object.assign(c, { quality: 'minadd4', notes: notes, rn: { base: 'i', q: '', figs: ['add4'], pre: '', post: '' } });
      });
      case 'V9': return [k === MAJ ? d(5, 'dom9', numeral(5, 'dom9'), 'Dominant 9th') : d(5, 'domb9', numeral(5, 'domb9'), 'Dominant minor 9th')];
      case 'V11': return [d(5, 'dom11', numeral(5, 'dom11'), 'Dominant 11th')].map((c) => {
        // In minor the 9th is lowered (A♭ over G in C minor).
        if (k === MIN) c.notes[4] = above(c.root, 8, 13);
        return c;
      });
      case 'it6': case 'fr6': case 'ger6': {
        // Augmented sixths, spelled from the bass: ♭6, 1, (2 or ♭3), ♯4.
        const t = key.tonic;
        const b6 = above(t, 5, 8), sharp4 = above(t, 3, 6), two = above(t, 1, 2), flat3 = above(t, 2, 3);
        const notes = kindId === 'it6' ? [b6, t, sharp4] : kindId === 'fr6' ? [b6, t, two, sharp4] : [b6, t, flat3, sharp4];
        const nat = { it6: 'Italian', fr6: 'French', ger6: 'German' }[kindId];
        const abbr = { it6: 'It', fr6: 'Fr', ger6: 'Ger' }[kindId];
        return [{ root: b6, quality: kindId, notes: notes, inversion: 0, fixedOrder: true,
          rn: { base: abbr, q: '+6', figs: [], pre: '', post: '' }, fn: nat + ' augmented 6th' }];
      }
      case 'N6': {
        const root = above(key.tonic, 1, 1);   // ♭2
        return [{ root: root, quality: 'maj', notes: chordNotes(root, 'maj'), inversion: 1,
          rn: { base: 'N', q: '', figs: ['6'], pre: '', post: '' }, fn: 'Neapolitan 6th' }];
      }
      case 'VofV': {
        const root = above(key.tonic, 1, 2);   // 2̂, major chord
        return [
          { root: root, quality: 'maj', notes: chordNotes(root, 'maj'), inversion: 0,
            rn: { base: 'V', q: '', figs: [], pre: '', post: '/V' }, fn: 'Dominant of the dominant' },
          { root: root, quality: 'dom7', notes: chordNotes(root, 'dom7'), inversion: 0,
            rn: { base: 'V', q: '', figs: ['7'], pre: '', post: '/V' }, fn: 'Dominant 7th of the dominant' }];
      }
      case 'secdom': {
        // V7 of the other major or minor triads in the key.
        const targets = k === MAJ ? [[4, 'IV', 'subdominant'], [2, 'ii', 'supertonic'], [6, 'vi', 'submediant'], [3, 'iii', 'mediant']]
          : [[4, 'iv', 'subdominant'], [6, 'VI', 'submediant'], [3, 'III', 'mediant']];
        return targets.map(([deg, label, word]) => {
          const target = scaleOf(key)[deg - 1].name;
          const root = above(target, 4, 7);
          return { root: root, quality: 'dom7', notes: chordNotes(root, 'dom7'), inversion: 0,
            rn: { base: 'V', q: '', figs: ['7'], pre: '', post: '/' + label }, fn: 'Dominant 7th of the ' + word };
        });
      }
      case 'borrowed': return k === MAJ
        ? [d(4, 'min', numeral(4, 'min'), 'Borrowed subdominant (minor iv)'),
          d(6, 'maj', Object.assign(numeral(6, 'maj'), { pre: '♭' }), 'Borrowed submediant (♭VI)', -1),
          d(7, 'maj', Object.assign(numeral(7, 'maj'), { pre: '♭' }), 'Subtonic (♭VII)', -1),
          d(3, 'maj', Object.assign(numeral(3, 'maj'), { pre: '♭' }), 'Borrowed mediant (♭III)', -1)]
        : [d(1, 'maj', numeral(1, 'maj'), 'Picardy third (major tonic)'),
          d(7, 'maj', numeral(7, 'maj'), 'Subtonic'),
          d(4, 'maj', numeral(4, 'maj'), 'Borrowed subdominant (major IV)')];
      case 'V13': return [d(5, 'dom13', numeral(5, 'dom13'), 'Dominant 13th')].map((c) => {
        if (k === MIN) { c.notes[4] = above(c.root, 8, 13); c.notes[6] = above(c.root, 12, 20); }
        return c;
      });
      default: return [];
    }
  }

  // The notes of a chord from the bass up (inversions start on the 3rd or 5th).
  function bassUp(ch) {
    if (ch.fixedOrder || !ch.inversion) return ch.notes.slice();
    return ch.notes.slice(ch.inversion).concat(ch.notes.slice(0, ch.inversion));
  }

  /* ---------------- cadences ---------------- */

  /*
   * Each cadence is two chords in a key: [kind, chord index, bass member, top member] where members
   * are 0 root, 1 third, 2 fifth, 3 seventh. `modes` limits it to major or minor keys.
   */
  const CADENCES = {
    pac: { name: 'Perfect authentic cadence', short: 'PAC', variants: [
      { a: ['V', 0, 0, 1], b: ['I', 0, 0, 0], note: 'both chords in root position, tonic on top' },
      { a: ['V7', 0, 0, 1], b: ['I', 0, 0, 0], note: 'both chords in root position, tonic on top' }] },
    iac: { name: 'Imperfect authentic cadence', short: 'IAC', variants: [
      { a: ['V', 0, 0, 2], b: ['I', 0, 0, 1], note: 'the 3rd of the tonic chord is on top' },
      { a: ['V', 0, 0, 0], b: ['I', 0, 0, 2], note: 'the 5th of the tonic chord is on top' },
      { a: ['V7', 0, 0, 2], b: ['I', 0, 0, 1], note: 'the 3rd of the tonic chord is on top' }] },
    half: { name: 'Half cadence', short: 'HC', variants: [
      { a: ['I', 0, 0, 0], b: ['V', 0, 0, 1], note: 'ends on V' },
      { a: ['IV', 0, 0, 0], b: ['V', 0, 0, 2], note: 'ends on V' }] },
    plagal: { name: 'Plagal cadence', short: 'PC', variants: [
      { a: ['IV', 0, 0, 2], b: ['I', 0, 0, 0], note: 'the “Amen” cadence' }] },
    deceptive: { name: 'Deceptive cadence', short: 'DC', variants: [
      { a: ['V', 0, 0, 1], b: ['vi', 0, 0, 1], note: 'V goes to the submediant instead of the tonic' },
      { a: ['V7', 0, 0, 1], b: ['vi', 0, 0, 1], note: 'V7 goes to the submediant instead of the tonic' }] },
    halfii: { name: 'Half cadence', short: 'HC', variants: [
      { a: ['ii', 0, 1, 0], b: ['V', 0, 0, 2], note: 'the supertonic in 1st inversion, to V' }] },
    half64: { name: 'Half cadence', short: 'HC', variants: [
      { a: ['cad64', 0, 2, 0], b: ['V', 0, 0, 1], note: 'cadential 6-4 to V' }] },
    phrygian: { name: 'Phrygian half cadence', short: 'PHC', modes: [MIN], variants: [
      { a: ['IV', 0, 1, 0], b: ['V', 0, 0, 2], note: 'iv in 1st inversion to V: the bass steps down a half step' }] },
    picardy: { name: 'Picardy third', short: 'PAC with a Picardy third', modes: [MIN], variants: [
      { a: ['V', 0, 0, 1], b: ['borrowed', 0, 0, 0], note: 'a minor-key piece ends on a major tonic chord' }] },
    minplagal: { name: 'Minor plagal cadence', short: 'PC', modes: [MAJ], variants: [
      { a: ['borrowed', 0, 0, 2], b: ['I', 0, 0, 0], note: 'minor iv to I, borrowed from the minor key' }] },
    deceptiveb6: { name: 'Deceptive cadence', short: 'DC', modes: [MAJ], variants: [
      { a: ['V', 0, 0, 1], b: ['borrowed', 1, 0, 1], note: 'V to ♭VI, borrowed from the minor key' }] }
  };

  global.Theory = {
    LETTERS: LETTERS, LETTER_PC: LETTER_PC, accOf: accOf, accValue: accValue, pc: pc, pretty: pretty, prettyList: prettyList,
    toMidi: toMidi, above: above,
    KEY_PAIRS: KEY_PAIRS, KEYS: KEYS, keyById: keyById, keyName: keyName, sigAcc: sigAcc, shownAcc: shownAcc, scaleOf: scaleOf,
    INTERVALS: INTERVALS, intervalById: intervalById, intervalsInKey: intervalsInKey,
    QUALITIES: QUALITIES, chordNotes: chordNotes, chordSteps: chordSteps, chordName: chordName,
    kindChords: kindChords, bassUp: bassUp, rnText: rnText, DEGREE_FN: DEGREE_FN, CADENCES: CADENCES
  };
})(typeof window !== 'undefined' ? window : globalThis);
