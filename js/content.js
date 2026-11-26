/*
 * content.js — the categories, their subcategories, and the cards in them.
 *
 * Every card is { id, svg, say, detail }:
 *   say    — what the class says out loud (shown when answers are revealed)
 *   detail — a short teaching note shown under it
 *
 * Each subcategory has chips (the things a teacher can pick) and a pool(selectedChipIds, settings)
 * that returns the cards for the picked chips.
 */
(function (global) {
  'use strict';

  const N = global.Notation;

  // Single-beat cards share one frame so every card in a round is drawn at the same scale.
  const CARD_VB = '0 12 130 100';
  const NOTE_VB_TOP = 12, NOTE_VB_BOTTOM = 120;   // note-name cards
  const TOP = 40;                 // top staff line
  const MID = TOP + 20;           // middle staff line

  const SHARP = '♯', FLAT = '♭', DOUBLE_SHARP = '𝄪';
  const ACC_SYMBOL = { '#': SHARP, b: FLAT, x: DOUBLE_SHARP };
  const ACC_WORD = { '#': ' sharp', b: ' flat', x: ' double sharp' };
  // 'F#' -> 'F♯'. Names are a letter plus an optional accidental: # b x (double sharp).
  const pretty = (name) => name[0] + (ACC_SYMBOL[name.slice(1)] || name.slice(1));
  const sayName = (name) => name[0] + (ACC_WORD[name.slice(1)] || '');

  function card(body) { return N.svg(CARD_VB, body); }
  function staff5() { return N.staff(3, 127, TOP); }

  /* =========================================================
   * Pitch helpers
   * ========================================================= */

  const LETTERS = 'CDEFGAB';
  const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const NATURAL_PC = { 0: 'C', 2: 'D', 4: 'E', 5: 'F', 7: 'G', 9: 'A', 11: 'B' };
  const SHARP_PC = { 1: 'C#', 3: 'D#', 6: 'F#', 8: 'G#', 10: 'A#' };
  const FLAT_PC = { 1: 'Db', 3: 'Eb', 6: 'Gb', 8: 'Ab', 10: 'Bb' };
  const accValue = (name) => ({ '#': 1, b: -1, x: 2 }[name.slice(1)] || 0);
  const toMidi = (name, octave) => (octave + 1) * 12 + LETTER_PC[name[0]] + accValue(name);
  // The octave number a spelling takes for a given pitch (so B#3 = C4, Cb4 = B3).
  const octaveFor = (name, midi) => Math.round((midi - LETTER_PC[name[0]] - accValue(name)) / 12) - 1;
  const label = (name, octave) => pretty(name) + octave;

  // Key signatures, around the circle of fifths: C / A minor, then sharp keys, then flat keys.
  const KEY_PAIRS = [
    { n: 0, major: 'C', minor: 'A' },
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
  const keyChipLabel = (k) => pretty(k.major) + (k.n ? ' · ' + k.n + (k.type === '#' ? SHARP : FLAT) : '');

  const SHARP_POS = [8, 5, 9, 6, 3, 7, 4];   // F C G D A E B (treble staff positions)
  const FLAT_POS = [4, 7, 3, 6, 2, 5, 1];    // B E A D G C F
  const KEYSIG_X = 38;

  // The accidentals of a key signature after a treble clef; returns { svg, end }.
  function keySignature(type, count, top) {
    if (!count) return { svg: '', end: KEYSIG_X };
    const positions = type === '#' ? SHARP_POS : FLAT_POS;
    const step = N.accidentalWidth(type) + 2;
    let s = '';
    for (let i = 0; i < count; i++) s += N.accidental(type, KEYSIG_X + i * step, N.posToY(positions[i], top));
    return { svg: s, end: KEYSIG_X + (count - 1) * step + N.accidentalWidth(type) };
  }

  /*
   * One note on a treble staff. opts.key: { type, n } draws that key signature and no accidental
   * on the note (it's already in the key).
   */
  function noteSvg(name, octave, opts) {
    opts = opts || {};
    const step = name[0];
    const acc = opts.key ? '' : name.slice(1);
    const pos = N.staffPos(step, octave, 'treble');
    // Room needed above the note head: a flat reaches highest, then a sharp.
    const clearance = acc === 'b' ? 18 : acc ? 13 : 6;
    // Very high notes: slide the staff down (up to 17) so the ledger lines fit on the card.
    const top = TOP + Math.min(17, Math.max(0, 13 - (N.posToY(pos, TOP) - clearance)));
    const y = N.posToY(pos, top);
    const sig = opts.key ? keySignature(opts.key.type, opts.key.n, top) : { svg: '', end: 0 };
    const x = Math.max(88, sig.end + 18);
    const width = Math.max(130, x + 20);
    const up = pos < 4;
    // Notes far above or below the staff get stems that reach the middle line.
    const stemLen = Math.max(35, Math.abs(pos - 4) * N.HALF);
    const n = N.note(x, y, { dur: 'q', up: up, stemLen: stemLen });
    // A slightly taller frame than other cards, taller still for the very highest notes.
    const vbTop = Math.min(NOTE_VB_TOP, Math.floor(y - clearance - 1));
    return N.svg('0 ' + vbTop + ' ' + width + ' ' + (NOTE_VB_BOTTOM - vbTop),
      N.staff(3, width - 3, top) + N.clef('treble', 6, top) + sig.svg + N.ledgers(x, pos, top) +
      N.accidental(acc, x - N.width('noteheadBlack') / 2 - 2.5 - N.accidentalWidth(acc), y) + n.svg);
  }

  // Lowest MIDI note of a tonic at or above the violin's open G (G3 = 55).
  function lowestTonic(tonic) {
    let m = toMidi(tonic, 3);
    if (m < 55) m += 12;
    return m;
  }

  // The 7 spelled degrees of a scale: [{ name, semi, degree }] where semi counts up from the tonic.
  function spellScale(tonic, steps) {
    const li = LETTERS.indexOf(tonic[0]);
    const tonicPc = LETTER_PC[tonic[0]] + accValue(tonic);
    const out = [];
    let semi = 0;
    for (let d = 0; d < 7; d++) {
      const letter = LETTERS[(li + d) % 7];
      let diff = (((tonicPc + semi - LETTER_PC[letter]) % 12) + 12) % 12;
      if (diff > 6) diff -= 12;
      out.push({ name: letter + ({ 1: '#', '-1': 'b', 2: 'x' }[diff] || ''), semi: semi, degree: d + 1 });
      semi += steps[d];
    }
    return out;
  }

  /* =========================================================
   * Note names: home position on the violin
   * ========================================================= */

  const STRINGS = [
    { id: 'G', name: 'G string', open: 55 },
    { id: 'D', name: 'D string', open: 62 },
    { id: 'A', name: 'A string', open: 69 },
    { id: 'E', name: 'E string', open: 76 }
  ];
  // Semitones above the open string -> finger in first position.
  const FINGER = ['open', 'low 1st', '1st', 'low 2nd', 'high 2nd', '3rd', 'high 3rd', '4th'];
  // Home position, high-2 pattern: G A B C · D E F# G · A B C# D · E F# G# A B
  const HOME_SEMIS = { G: [0, 2, 4, 5], D: [0, 2, 4, 5], A: [0, 2, 4, 5], E: [0, 2, 4, 5, 7] };

  function homePool(strings) {
    const out = [];
    STRINGS.filter((s) => strings.indexOf(s.id) >= 0).forEach((s) => {
      HOME_SEMIS[s.id].forEach((semi) => {
        const midi = s.open + semi;
        const name = NATURAL_PC[midi % 12] || SHARP_PC[midi % 12];
        const octave = Math.floor(midi / 12) - 1;
        out.push({
          id: 'note-home-' + midi,
          svg: noteSvg(name, octave),
          say: sayName(name),
          detail: pretty(name) + octave + ' · ' + s.name + ', ' + FINGER[semi] + (semi === 0 ? '' : ' finger')
        });
      });
    });
    return out;
  }

  /* =========================================================
   * Note names: diatonic (a scale, chromatic in a range, or picked notes)
   * ========================================================= */

  const SCALE_TYPES = {
    major: { name: 'major', steps: [2, 2, 1, 2, 2, 2, 1] },
    natural: { name: 'natural minor', steps: [2, 1, 2, 2, 1, 2, 2] },
    harmonic: { name: 'harmonic minor', steps: [2, 1, 2, 2, 1, 3, 1] },
    melodic: { name: 'melodic minor', steps: [2, 1, 2, 2, 2, 2, 1], down: [2, 1, 2, 2, 1, 2, 2] }
  };
  const MINOR_TYPES = ['natural', 'harmonic', 'melodic'];
  // One list for the scale menu: each major key followed by its relative minors.
  const SCALE_CHOICES = KEY_PAIRS.map((k) => ({
    label: k.n === 0 ? 'No sharps or flats' : k.n + (k.type === '#' ? ' sharp' : ' flat') + (k.n > 1 ? 's' : ''),
    options: [{ key: k.major, type: 'major' }].concat(MINOR_TYPES.map((t) => ({ key: k.minor, type: t })))
      .map((o) => ({ value: o.key + ':' + o.type, key: o.key, type: o.type,
        text: pretty(o.key) + ' ' + (o.type === 'major' ? 'major' : o.type + ' minor') }))
  }));

  // Note names for the range menus: the naturals from open G up to E6.
  const RANGE_NOTES = [];
  for (let m = 55; m <= 88; m++) if (NATURAL_PC[m % 12]) RANGE_NOTES.push(NATURAL_PC[m % 12] + (Math.floor(m / 12) - 1));
  const rangeMidi = (s) => toMidi(s.replace(/\d+$/, ''), Number(s.match(/\d+$/)[0]));

  // Spellings for the "pick notes" chips: naturals, then sharps, then flats.
  const PICK_ROWS = [
    ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
    ['C#', 'D#', 'E#', 'F#', 'G#', 'A#', 'B#'],
    ['Cb', 'Db', 'Eb', 'Fb', 'Gb', 'Ab', 'Bb']
  ];

  function pitchItem(name, octave, extra) {
    return {
      id: 'pitch-' + name + octave,
      svg: noteSvg(name, octave),
      say: sayName(name),
      detail: label(name, octave) + (extra ? ' · ' + extra : '')
    };
  }

  function scaleItems(s) {
    const type = SCALE_TYPES[s.scaleType] || SCALE_TYPES.major;
    const tonic = s.scaleKey;
    const start = lowestTonic(tonic);
    const octaves = s.scaleOctaves === 2 ? 2 : 1;
    const forms = [{ degrees: spellScale(tonic, type.steps), note: type.down ? 'raised, going up' : '' }];
    if (type.down) forms.push({ degrees: spellScale(tonic, type.down), note: 'natural, coming down' });

    const seen = new Map();
    forms.forEach((form) => {
      for (let o = 0; o < octaves; o++) {
        form.degrees.forEach((d) => {
          const midi = start + o * 12 + d.semi;
          const octave = octaveFor(d.name, midi);
          const key = d.name + octave;
          if (seen.has(key)) return;
          const variant = form.note && (d.degree === 6 || d.degree === 7) ? ', ' + form.note : '';
          seen.set(key, { midi: midi, item: pitchItem(d.name, octave, 'scale degree ' + d.degree + variant) });
        });
      }
    });
    const topOct = octaveFor(tonic, start + octaves * 12);
    seen.set(tonic + topOct, { midi: start + octaves * 12, item: pitchItem(tonic, topOct, 'scale degree 1') });
    return Array.from(seen.values()).sort((a, b) => a.midi - b.midi).map((v) => v.item);
  }

  function rangeBounds(s) {
    let lo = rangeMidi(RANGE_NOTES.indexOf(s.rangeLow) >= 0 ? s.rangeLow : 'G3');
    let hi = rangeMidi(RANGE_NOTES.indexOf(s.rangeHigh) >= 0 ? s.rangeHigh : 'B5');
    if (lo > hi) { const t = lo; lo = hi; hi = t; }
    return [lo, hi];
  }

  function chromaticItems(s) {
    const [lo, hi] = rangeBounds(s);
    const out = [];
    for (let m = lo; m <= hi; m++) {
      const oct = Math.floor(m / 12) - 1;
      const nat = NATURAL_PC[m % 12];
      if (nat) { out.push(pitchItem(nat, oct)); continue; }
      const sh = SHARP_PC[m % 12], fl = FLAT_PC[m % 12];
      out.push(pitchItem(sh, oct, 'same pitch as ' + label(fl, oct)));
      out.push(pitchItem(fl, oct, 'same pitch as ' + label(sh, oct)));
    }
    return out;
  }

  function pickedItems(s) {
    const [lo, hi] = rangeBounds(s);
    const out = [];
    (s.pitchClasses || []).forEach((name) => {
      for (let oct = 2; oct <= 7; oct++) {
        const m = toMidi(name, oct);
        if (m >= lo && m <= hi) out.push({ midi: m, item: pitchItem(name, oct) });
      }
    });
    return out.sort((a, b) => a.midi - b.midi).map((v) => v.item);
  }

  function pitchPool(s) {
    let items;
    if (s.pitchMode === 'chromatic') items = chromaticItems(s);
    else if (s.pitchMode === 'pick') items = pickedItems(s);
    else items = scaleItems(s);
    return items.length ? items : chromaticItems(s);
  }

  // A one-line description of the current choice.
  function pitchSummary(s) {
    if (s.pitchMode === 'chromatic') return 'Chromatic, ' + s.rangeLow + ' to ' + s.rangeHigh;
    if (s.pitchMode === 'pick') {
      const names = (s.pitchClasses || []).map(pretty);
      const list = names.length > 6 ? names.length + ' notes' : names.join(' ');
      return list + ', ' + s.rangeLow + ' to ' + s.rangeHigh;
    }
    const type = SCALE_TYPES[s.scaleType] || SCALE_TYPES.major;
    return pretty(s.scaleKey) + ' ' + type.name + ' scale, ' + (s.scaleOctaves === 2 ? '2 octaves' : '1 octave');
  }

  /* =========================================================
   * Note values
   * ========================================================= */

  const A4 = N.posToY(3, TOP);   // second space — stems up

  function valueCard(dur, dots) {
    return card(staff5() + N.note(62, A4, { dur: dur, up: true, dots: dots || 0 }).svg);
  }
  function restCard(kind) { return card(staff5() + N.rest(kind, 65, MID)); }

  // Notes beamed together at the A4 height with stems up.
  function beamed(xs, durs, secondary, tupletLabel) {
    let s = '';
    const stems = xs.map((x, i) => {
      const n = N.note(x, A4, { dur: durs[i], up: true, noFlag: true });
      s += n.svg;
      return n.stemX;
    });
    const top = stems.length ? A4 - 35 : 0;
    s += N.beam(stems[0], stems[stems.length - 1], top, 0);
    (secondary || []).forEach(([a, b]) => { s += N.beam(stems[a], stems[b], top, 1); });
    if (tupletLabel) s += N.tuplet3((stems[0] + stems[stems.length - 1]) / 2, top - 4);
    return s;
  }

  // Dotted eighth beamed to a sixteenth: full beam plus a short stub on the sixteenth.
  function dottedEighthSixteenth() {
    const a = N.note(40, A4, { dur: '8', up: true, noFlag: true, dots: 1 });
    const b = N.note(86, A4, { dur: '16', up: true, noFlag: true });
    const top = A4 - 35;
    return a.svg + b.svg + N.beam(a.stemX, b.stemX, top, 0) + N.rect(b.stemX - 9.6, top + 7.5, 10.25, 5);
  }

  const BASIC_VALUES = [
    { id: 'v-w', svg: valueCard('w'), say: 'Whole note', detail: '4 beats' },
    { id: 'v-h', svg: valueCard('h'), say: 'Half note', detail: '2 beats' },
    { id: 'v-q', svg: valueCard('q'), say: 'Quarter note', detail: '1 beat' },
    { id: 'v-8', svg: valueCard('8'), say: 'Eighth note', detail: '½ beat' },
    { id: 'v-ee', svg: card(staff5() + beamed([44, 80], ['8', '8'])), say: 'Two eighth notes', detail: '1 beat together' },
    { id: 'r-w', svg: restCard('w'), say: 'Whole rest', detail: '4 beats of silence · hangs from the line' },
    { id: 'r-h', svg: restCard('h'), say: 'Half rest', detail: '2 beats of silence · sits on the line' },
    { id: 'r-q', svg: restCard('q'), say: 'Quarter rest', detail: '1 beat of silence' },
    { id: 'r-8', svg: restCard('8'), say: 'Eighth rest', detail: '½ beat of silence' }
  ];

  const ADVANCED_VALUES = [
    { id: 'a-dh', svg: valueCard('h', 1), say: 'Dotted half note', detail: '3 beats' },
    { id: 'a-dq', svg: valueCard('q', 1), say: 'Dotted quarter note', detail: '1½ beats' },
    { id: 'a-d8', svg: valueCard('8', 1), say: 'Dotted eighth note', detail: '¾ beat' },
    { id: 'a-16', svg: valueCard('16'), say: 'Sixteenth note', detail: '¼ beat' },
    { id: 'a-ssss', svg: card(staff5() + beamed([30, 52, 74, 96], ['16', '16', '16', '16'], [[0, 3]])),
      say: 'Four sixteenths', detail: '1 beat · 1 e & a' },
    { id: 'a-trip', svg: card(staff5() + beamed([36, 62, 88], ['8', '8', '8'], null, '3')),
      say: 'Triplet', detail: '3 eighths in 1 beat · 1-trip-let' },
    { id: 'a-d8s', svg: card(staff5() + dottedEighthSixteenth()),
      say: 'Dotted eighth sixteenth', detail: '1 beat · long-short' }
  ];

  /* =========================================================
   * Key signatures and scale degrees
   * ========================================================= */

  const KEY_ITEMS = KEY_PAIRS.map((k) => {
    const accs = k.n === 0 ? 'no sharps or flats'
      : k.n + ' ' + (k.type === '#' ? 'sharp' : 'flat') + (k.n > 1 ? 's' : '');
    return {
      id: 'key-' + k.major,
      chip: keyChipLabel(k),
      svg: card(staff5() + N.clef('treble', 6, TOP) + keySignature(k.type, k.n, TOP).svg),
      say: pretty(k.major) + ' major',
      detail: accs + ' · relative minor: ' + pretty(k.minor) + ' minor'
    };
  });

  // Scale degrees are shown as a number with a circumflex accent over it (styled in CSS).
  const degreeMark = (d) => '<span class="deg">' + d + '</span>';
  const DEGREE_NAMES = ['tonic', 'supertonic', 'mediant', 'subdominant', 'dominant', 'submediant', 'leading tone'];

  // Each note of the major scale (one octave, tonic to tonic) with the key signature.
  function degreePool(keys) {
    const out = [];
    KEY_PAIRS.filter((k) => keys.indexOf(k.major) >= 0).forEach((k) => {
      const start = lowestTonic(k.major);
      const degrees = spellScale(k.major, SCALE_TYPES.major.steps);
      degrees.concat([{ name: k.major, semi: 12, degree: 1 }]).forEach((d) => {
        const midi = start + d.semi;
        const octave = octaveFor(d.name, midi);
        out.push({
          id: 'deg-' + k.major + '-' + d.name + octave,
          svg: noteSvg(d.name, octave, { key: k }),
          say: degreeMark(d.degree),
          detail: label(d.name, octave) + ' in ' + pretty(k.major) + ' major · ' + DEGREE_NAMES[d.degree - 1]
        });
      });
    });
    return out;
  }

  /* =========================================================
   * Clefs
   * ========================================================= */

  const CLEF_ITEMS = [
    { id: 'clef-treble', svg: card(staff5() + N.clef('treble', 65 - N.clefWidth('treble') / 2, TOP)), say: 'Treble clef', detail: 'G clef · violin music' },
    { id: 'clef-bass', svg: card(staff5() + N.clef('bass', 65 - N.clefWidth('bass') / 2, TOP)), say: 'Bass clef', detail: 'F clef · cello and bass' },
    { id: 'clef-alto', svg: card(staff5() + N.clef('alto', 65 - N.clefWidth('alto') / 2, TOP)), say: 'Alto clef', detail: 'C clef on the middle line · viola' },
    { id: 'clef-tenor', svg: card(staff5() + N.clef('tenor', 65 - N.clefWidth('tenor') / 2, TOP)), say: 'Tenor clef', detail: 'C clef on the 4th line · high cello' }
  ];

  /* =========================================================
   * Dynamics
   * ========================================================= */

  function dynCard(str) { return card(N.dynamic(str, 65, 72, 80)); }
  // A small picture of a dynamic for its chip.
  function dynChip(str) {
    return '<svg class="chip-art" viewBox="-36 -24 72 34" aria-hidden="true">' + N.dynamic(str, 0, 0, 40) + '</svg>';
  }
  function hairpinChip(opening) {
    return '<svg class="chip-art" viewBox="0 -9 60 18" aria-hidden="true">' + N.hairpin(4, 56, 0, opening) + '</svg>';
  }

  const DYNAMIC_ITEMS = [
    { id: 'dyn-pp', chipHtml: dynChip('pp'), svg: dynCard('pp'), say: 'Pianissimo', detail: 'pp · very soft' },
    { id: 'dyn-p', chipHtml: dynChip('p'), svg: dynCard('p'), say: 'Piano', detail: 'p · soft' },
    { id: 'dyn-mp', chipHtml: dynChip('mp'), svg: dynCard('mp'), say: 'Mezzo piano', detail: 'mp · medium soft' },
    { id: 'dyn-mf', chipHtml: dynChip('mf'), svg: dynCard('mf'), say: 'Mezzo forte', detail: 'mf · medium loud' },
    { id: 'dyn-f', chipHtml: dynChip('f'), svg: dynCard('f'), say: 'Forte', detail: 'f · loud' },
    { id: 'dyn-ff', chipHtml: dynChip('ff'), svg: dynCard('ff'), say: 'Fortissimo', detail: 'ff · very loud' },
    { id: 'dyn-sfz', chipHtml: dynChip('sfz'), svg: dynCard('sfz'), say: 'Sforzando', detail: 'sfz · a sudden strong accent' },
    { id: 'dyn-fp', chipHtml: dynChip('fp'), svg: dynCard('fp'), say: 'Forte piano', detail: 'fp · loud, then right away soft' },
    { id: 'dyn-cresc', chipHtml: hairpinChip(true), chip: 'Crescendo', svg: card(N.hairpin(22, 108, 62, true)), say: 'Crescendo', detail: 'gradually louder' },
    { id: 'dyn-decresc', chipHtml: hairpinChip(false), chip: 'Decrescendo', svg: card(N.hairpin(22, 108, 62, false)), say: 'Decrescendo', detail: 'gradually softer · also diminuendo' }
  ];

  /* =========================================================
   * Symbols: bowing, articulation, repeats, signs
   * ========================================================= */

  const B4 = N.posToY(4, TOP), G4 = N.posToY(2, TOP), C5 = N.posToY(5, TOP), D5 = N.posToY(6, TOP);

  // C5 sits in a space, so a staccato or tenuto fits in the next space up; taller marks go above the staff.
  function articulationCard(mark) {
    const n = N.note(65, C5, { dur: 'q', up: false });
    const space = C5 - N.SP;
    let m = '';
    if (mark === 'staccato') m = N.staccato(65, space + 1.6);
    if (mark === 'accent') m = N.accent(65, TOP - 3);
    if (mark === 'tenuto') m = N.tenuto(65, space + 0.9);
    return card(staff5() + n.svg + m);
  }
  // A stem-down B4 with a symbol centred above the staff.
  function markAboveCard(glyphName) {
    return card(staff5() + N.note(65, B4, { dur: 'q', up: false }).svg + N.above(glyphName, 65, TOP - 4));
  }
  function bowCard(down) {
    const n = N.note(65, B4, { dur: 'q', up: false });
    return card(staff5() + n.svg + (down ? N.downBow(65, TOP - 5) : N.upBow(65, TOP - 5)));
  }
  const textCard = (str, size) => card(N.text(65, 72, str, size || 34));

  const SYMBOL_ITEMS = [
    { id: 'sym-down', svg: bowCard(true), say: 'Down bow', detail: 'pull the bow toward the tip' },
    { id: 'sym-up', svg: bowCard(false), say: 'Up bow', detail: 'push the bow toward the frog' },
    { id: 'sym-slur', svg: card(staff5() +
        N.note(42, G4, { dur: 'q', up: true }).svg + N.note(88, B4, { dur: 'q', up: true }).svg +
        N.curve(41, G4 + 8, 89, B4 + 8, true, 9)),
      say: 'Slur', detail: 'different notes in one bow' },
    { id: 'sym-tie', svg: card(staff5() +
        N.note(42, A4, { dur: 'q', up: true }).svg + N.note(88, A4, { dur: 'q', up: true }).svg +
        N.curve(46, A4 + 6, 84, A4 + 6, true, 7)),
      say: 'Tie', detail: 'same note, hold it through' },
    { id: 'sym-staccato', svg: articulationCard('staccato'), say: 'Staccato', detail: 'short and separated' },
    { id: 'sym-accent', svg: articulationCard('accent'), say: 'Accent', detail: 'start the note strongly' },
    { id: 'sym-tenuto', svg: articulationCard('tenuto'), say: 'Tenuto', detail: 'full length, a little weight' },
    { id: 'sym-fermata', svg: markAboveCard('fermataAbove'), say: 'Fermata', detail: 'hold longer than written' },
    { id: 'sym-pizz', svg: textCard('pizz.', 40), say: 'Pizzicato', detail: 'pluck the string' },
    { id: 'sym-arco', svg: textCard('arco', 40), say: 'Arco', detail: 'play with the bow again' },
    { id: 'sym-repeat', svg: card(staff5() + N.startRepeat(8, TOP) +
        N.note(48, A4, { dur: 'q', up: true }).svg + N.note(80, A4, { dur: 'q', up: true }).svg + N.endRepeat(124, TOP)),
      say: 'Repeat sign', detail: 'go back and play it again' },
    { id: 'sym-endings', chip: 'Endings', svg: card(staff5() +
        N.line(6, 26, 60, 26, 1.3) + N.line(6.6, 26, 6.6, 36, 1.3) + N.text(16, 37, '1.', 13, { italic: false }) +
        N.note(34, A4, { dur: 'h', up: true }).svg + N.endRepeat(64, TOP) +
        N.line(70, 26, 124, 26, 1.3) + N.line(70.6, 26, 70.6, 36, 1.3) + N.text(80, 37, '2.', 13, { italic: false }) +
        N.note(98, A4, { dur: 'h', up: true }).svg + N.finalBarline(127, TOP)),
      say: 'First and second endings', detail: '1st time take ending 1, 2nd time skip to ending 2' },
    { id: 'sym-dc', svg: textCard('D.C. al Fine', 21), say: 'D.C. al Fine', detail: 'back to the beginning, stop at Fine' },
    { id: 'sym-fine', svg: textCard('Fine', 36), say: 'Fine', detail: '“fee-nay” · the end' },
    { id: 'sym-coda', svg: card(N.coda(65, 84, 64)), say: 'Coda', detail: 'jump to the ending section' },
    { id: 'sym-sharp', svg: card(N.accidental('#', 65 - N.accidentalWidth('#', 92) / 2, 62, 92)), say: 'Sharp', detail: 'raises a note a half step' },
    { id: 'sym-flat', svg: card(N.accidental('b', 65 - N.accidentalWidth('b', 92) / 2, 74, 92)), say: 'Flat', detail: 'lowers a note a half step' },
    { id: 'sym-natural', svg: card(N.accidental('n', 65 - N.accidentalWidth('n', 92) / 2, 62, 92)), say: 'Natural', detail: 'cancels a sharp or flat' },
    { id: 'sym-final', svg: card(staff5() + N.note(50, A4, { dur: 'h', up: true }).svg + N.finalBarline(110, TOP)),
      say: 'Final barline', detail: 'the end of the piece' }
  ];

  /* =========================================================
   * Advanced and contemporary symbols
   * ========================================================= */

  function articAbove(glyphName) {
    // Stem-down C5; marks too tall for a space sit just above the staff.
    return card(staff5() + N.note(65, C5, { dur: 'q', up: false }).svg + N.above(glyphName, 65, TOP - 3));
  }
  function glissCard() {
    const a = N.note(36, G4, { dur: 'h', up: true });
    const b = N.note(96, D5, { dur: 'h', up: false });
    const x1 = 36 + 9, y1 = G4, x2 = 96 - 9, y2 = D5;
    const ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
    return card(staff5() + a.svg + b.svg + N.line(x1, y1, x2, y2, 1.4) +
      '<g transform="translate(' + ((x1 + x2) / 2) + ',' + ((y1 + y2) / 2 - 4) + ') rotate(' + ang.toFixed(1) + ')">' +
      N.text(0, 0, 'gliss.', 11) + '</g>');
  }
  function tremoloCard() {
    const n = N.note(65, B4, { dur: 'h', up: false });
    return card(staff5() + n.svg + N.tremolo(n.stemX, B4 + 24));
  }
  function nienteCard() {
    return card(N.hairpin(16, 100, 62, false) +
      '<circle cx="106" cy="62" r="5" fill="none" stroke="#111" stroke-width="1.8"/>');
  }
  function quarterToneCard(acc, y) {
    return card(N.accidental(acc, 65 - N.accidentalWidth(acc, 92) / 2, y, 92));
  }

  const ADVANCED_SYMBOLS = [
    { id: 'adv-marcato', svg: articAbove('articMarcatoAbove'), say: 'Marcato', detail: 'a strong, heavy accent' },
    { id: 'adv-staccatissimo', svg: articAbove('articStaccatissimoWedgeAbove'), say: 'Staccatissimo', detail: 'as short as possible' },
    { id: 'adv-accstacc', chip: 'Accent + staccato', svg: articAbove('articAccentStaccatoAbove'), say: 'Accent staccato', detail: 'strong and short' },
    { id: 'adv-portato', svg: articAbove('articTenutoStaccatoAbove'), say: 'Portato', detail: 'gently separated, often in one bow (louré)' },
    { id: 'adv-tenacc', chip: 'Accent + tenuto', svg: articAbove('articTenutoAccentAbove'), say: 'Accent tenuto', detail: 'strong start, full length' },
    { id: 'adv-snap', svg: markAboveCard('pluckedSnapPizzicatoAbove'), say: 'Bartók pizzicato', detail: 'snap pizz: pull the string up so it slaps the fingerboard' },
    { id: 'adv-buzz', svg: markAboveCard('pluckedBuzzPizzicato'), say: 'Buzz pizzicato', detail: 'pluck so the string buzzes against the fingerboard' },
    { id: 'adv-harmonic', svg: markAboveCard('stringsHarmonic'), say: 'Harmonic', detail: 'touch the string lightly instead of pressing down' },
    { id: 'adv-tremolo', svg: tremoloCard(), say: 'Tremolo', detail: 'very fast, repeated bow strokes' },
    { id: 'adv-gliss', svg: glissCard(), say: 'Glissando', detail: 'slide from one note to the next' },
    { id: 'adv-xhead', chip: 'X notehead', svg: card(staff5() + N.note(65, B4, { dur: 'q', up: false, head: 'noteheadXBlack' }).svg),
      say: 'X notehead', detail: 'a percussive sound with no clear pitch' },
    { id: 'adv-qsharp', svg: quarterToneCard('qs', 62), say: 'Quarter-tone sharp', detail: 'raise the note by a quarter step' },
    { id: 'adv-qflat', svg: quarterToneCard('qf', 74), say: 'Quarter-tone flat', detail: 'lower the note by a quarter step' },
    { id: 'adv-fshort', svg: markAboveCard('fermataShortAbove'), say: 'Short fermata', detail: 'a brief pause' },
    { id: 'adv-flong', svg: markAboveCard('fermataLongAbove'), say: 'Long fermata', detail: 'a long pause' },
    { id: 'adv-caesura', svg: card(staff5() + N.note(40, A4, { dur: 'q', up: true }).svg + N.glyph('caesura', 70, TOP + 10) +
        N.note(104, A4, { dur: 'q', up: true }).svg), say: 'Caesura', detail: '“railroad tracks”: a complete stop' },
    { id: 'adv-sfp', chipHtml: dynChip('sfp'), svg: dynCard('sfp'), say: 'Sforzando piano', detail: 'sfp · a strong accent, then right away soft' },
    { id: 'adv-niente', chip: 'Al niente', svg: nienteCard(), say: 'Al niente', detail: 'fade away to nothing' },
    { id: 'adv-collegno', svg: textCard('col legno', 30), say: 'Col legno', detail: 'play with the wood of the bow' },
    { id: 'adv-sulpont', svg: textCard('sul pont.', 32), say: 'Sul ponticello', detail: 'bow very near the bridge: glassy, eerie' },
    { id: 'adv-sultasto', svg: textCard('sul tasto', 32), say: 'Sul tasto', detail: 'bow over the fingerboard: soft and airy' },
    { id: 'adv-flautando', svg: textCard('flautando', 30), say: 'Flautando', detail: 'light, fast bow, like a flute' },
    { id: 'adv-consord', svg: textCard('con sord.', 32), say: 'Con sordino', detail: 'put the mute on' },
    { id: 'adv-senzasord', svg: textCard('senza sord.', 28), say: 'Senza sordino', detail: 'take the mute off' },
    { id: 'adv-senzavib', svg: textCard('senza vib.', 30), say: 'Senza vibrato', detail: 'no vibrato' }
  ];

  /* =========================================================
   * Rhythms: one measure per card, drawn on a one-line staff
   * ========================================================= */

  // Durations are in units of 1/48 of a whole note: sixteenth 3, eighth 6, quarter 12,
  // dotted quarter 18, half 24, whole 48; an eighth-note triplet is 4.
  // Beat lengths per meter; compound meters beat in dotted quarters, and 7/8 is 2+2+3.
  const METERS = {
    '2/2': { top: 2, bottom: 2, beats: [24, 24], count: 'beat' },
    '3/2': { top: 3, bottom: 2, beats: [24, 24, 24], count: 'beat' },
    '2/4': { top: 2, bottom: 4, beats: [12, 12], count: 'beat' },
    '3/4': { top: 3, bottom: 4, beats: [12, 12, 12], count: 'beat' },
    '4/4': { top: 4, bottom: 4, beats: [12, 12, 12, 12], count: 'beat' },
    '5/4': { top: 5, bottom: 4, beats: [12, 12, 12, 12, 12], count: 'beat' },
    '3/8': { top: 3, bottom: 8, beats: [6, 6, 6], count: 'eighth' },
    '6/8': { top: 6, bottom: 8, beats: [18, 18], count: 'eighth' },
    '7/8': { top: 7, bottom: 8, beats: [12, 12, 18], count: 'eighth' },
    '9/8': { top: 9, bottom: 8, beats: [18, 18, 18], count: 'eighth' },
    '12/8': { top: 12, bottom: 8, beats: [18, 18, 18, 18], count: 'eighth' }
  };
  const METER_IDS = Object.keys(METERS);

  // One-beat cells for each beat length: durations (negative = rest), weight, and an optional tuplet.
  const BEAT_CELLS = {
    12: {
      basic: { q: [[12], 4], ee: [[6, 6], 4], qr: [[-12], 1.4] },
      advanced: { ssss: [[3, 3, 3, 3], 1.5], e_ss: [[6, 3, 3], 1], ss_e: [[3, 3, 6], 1], trip: [[4, 4, 4], 1, true],
        de_s: [[9, 3], 0.8], er_e: [[-6, 6], 0.8] }
    },
    24: {
      basic: { h: [[24], 4], qq: [[12, 12], 4], hr: [[-24], 1.2] },
      advanced: { q_ee: [[12, 6, 6], 1.2], ee_q: [[6, 6, 12], 1.2], eeee: [[6, 6, 6, 6], 1], dq_e: [[18, 6], 1],
        qr_q: [[-12, 12], 0.8], qtrip: [[8, 8, 8], 0.6, true] }
    },
    6: {
      basic: { e: [[6], 4], er: [[-6], 1.2] },
      advanced: { ss: [[3, 3], 2] }
    },
    18: {
      basic: { dq: [[18], 3], q_e: [[12, 6], 3], eee: [[6, 6, 6], 3], dqr: [[-18], 0.8] },
      advanced: { e_q: [[6, 12], 1], ss_e_e: [[3, 3, 6, 6], 1], e_ss_e: [[6, 3, 3, 6], 1], de_s_e: [[9, 3, 6], 1],
        er_e_e: [[-6, 6, 6], 0.8], s6: [[3, 3, 3, 3, 3, 3], 0.6] }
    }
  };

  // Cells longer than one beat, and the beats they may start on in each meter.
  const MULTI_CELLS = [
    { ev: [24], span: 2, beat: 12, w: 2, starts: { '2/4': [0], '3/4': [0, 1], '4/4': [0, 2], '5/4': [0, 1, 3], '7/8': [0] } },
    { ev: [-24], span: 2, beat: 12, w: 0.4, starts: { '4/4': [0, 2] } },
    { ev: [18, 6], span: 2, beat: 12, w: 1.2, advanced: true, starts: { '2/4': [0], '3/4': [0, 1], '4/4': [0, 2], '5/4': [0, 1, 3] } },
    { ev: [36], span: 3, beat: 12, w: 0.7, starts: { '3/4': [0], '4/4': [0, 1], '5/4': [0] } },
    { ev: [48], span: 4, beat: 12, w: 0.4, starts: { '4/4': [0] } },
    { ev: [48], span: 2, beat: 24, w: 1, starts: { '2/2': [0], '3/2': [0, 1] } },
    { ev: [72], span: 3, beat: 24, w: 0.4, starts: { '3/2': [0] } },
    { ev: [36, 12], span: 2, beat: 24, w: 0.8, advanced: true, starts: { '2/2': [0], '3/2': [0, 1] } },
    { ev: [12], span: 2, beat: 6, w: 1.5, starts: { '3/8': [0, 1] } },
    { ev: [18], span: 3, beat: 6, w: 0.6, starts: { '3/8': [0] } },
    { ev: [36], span: 2, beat: 18, w: 0.8, starts: { '6/8': [0], '9/8': [0, 1], '12/8': [0, 2] } },
    { ev: [72], span: 4, beat: 18, w: 0.3, starts: { '12/8': [0] } }
  ];

  // Duration in units -> [note value, dots].
  const NOTE_VALUE = { 72: ['w', 1], 48: ['w', 0], 36: ['h', 1], 24: ['h', 0], 18: ['q', 1], 12: ['q', 0],
    9: ['8', 1], 6: ['8', 0], 3: ['16', 0] };
  const TUPLET_VALUE = { 4: ['8', 0], 8: ['q', 0] };
  const REST_VALUE = { 24: ['h', 0], 18: ['q', 1], 12: ['q', 0], 6: ['8', 0] };

  function weightedPick(options, rng) {
    let total = 0;
    options.forEach((o) => { total += o.w; });
    let x = rng() * total;
    for (let i = 0; i < options.length; i++) { x -= options[i].w; if (x <= 0) return options[i]; }
    return options[options.length - 1];
  }

  // Cells: [{ start (units), beat (index), ev: [durations], tuplet }]
  function makeMeasure(meterId, level, rng) {
    const meter = METERS[meterId];
    const adv = level === 'advanced';
    const starts = [];
    meter.beats.reduce((acc, len) => { starts.push(acc); return acc + len; }, 0);
    for (let attempt = 0; attempt < 40; attempt++) {
      const cells = [];
      let i = 0;
      while (i < meter.beats.length) {
        const len = meter.beats[i];
        const opts = [];
        const sets = BEAT_CELLS[len];
        [sets.basic, adv ? sets.advanced : null].forEach((set) => {
          if (!set) return;
          Object.keys(set).forEach((name) => {
            const c = set[name];
            // Triplets don't fit eighth-note counting.
            if (c[2] && meter.count === 'eighth') return;
            opts.push({ ev: c[0], w: c[1], tuplet: !!c[2], span: 1 });
          });
        });
        MULTI_CELLS.forEach((m) => {
          if (m.beat !== len || (m.advanced && !adv)) return;
          if (!m.starts[meterId] || m.starts[meterId].indexOf(i) < 0 || i + m.span > meter.beats.length) return;
          opts.push({ ev: m.ev, w: m.w, tuplet: false, span: m.span });
        });
        const c = weightedPick(opts, rng);
        cells.push({ start: starts[i], beat: i, ev: c.ev, tuplet: c.tuplet });
        i += c.span;
      }
      let rest = 0, all = 0;
      cells.forEach((c) => c.ev.forEach((d) => { all += Math.abs(d); if (d < 0) rest += -d; }));
      if (rest <= all / 3) return cells;
    }
    return [{ start: 0, beat: 0, ev: [meter.beats.reduce((a, b) => a + b, 0)], tuplet: false }];
  }

  // Measure width grows with the number of sixteenths it can hold.
  function measureWidth(meter) {
    const total = meter.beats.reduce((a, b) => a + b, 0);
    return Math.max(240, total / 3 * 15);
  }

  function rhythmSvg(cells, meterId) {
    const meter = METERS[meterId];
    const total = meter.beats.reduce((a, b) => a + b, 0);
    const line = 62;
    const tsW = Math.max(N.timeSigNumberWidth(meter.top), N.timeSigNumberWidth(meter.bottom));
    const tsX = 8 + tsW / 2;
    const x0 = 16 + tsW, W = measureWidth(meter);
    const barX = x0 + W + 24;   // room after the last note
    let s = N.singleLine(4, barX, line) + N.barline(barX, line - 20, line + 20, 1.8) + N.timeSig(meter.top, meter.bottom, tsX, line);
    const stemTop = line - 35;
    const xAt = (pos) => x0 + pos / total * W + 12;

    cells.forEach((c) => {
      let pos = c.start;
      const notes = [];   // { x, stemX, value, rest }
      c.ev.forEach((d) => {
        const len = Math.abs(d);
        const x = xAt(pos);
        if (d < 0) {
          const rv = REST_VALUE[len] || ['q', 0];
          s += N.rest(rv[0], x + 2, line, rv[1]);
          notes.push({ rest: true });
        } else {
          const v = (c.tuplet ? TUPLET_VALUE[len] : NOTE_VALUE[len]) || ['q', 0];
          notes.push({ x: x, value: v[0], dots: v[1], pos: pos });
        }
        pos += len;
      });
      // Beam runs of consecutive eighths/sixteenths within the cell; a lone one gets a flag.
      const flagged = (n) => !n.rest && (n.value === '8' || n.value === '16');
      let run = [];
      const flush = () => {
        const beamedRun = run.length > 1;
        run.forEach((n) => {
          const r = N.note(n.x, line, { dur: n.value, up: true, dots: n.dots, dotUp: true, noFlag: beamedRun });
          s += r.svg;
          n.stemX = r.stemX;
        });
        if (beamedRun) {
          s += N.beam(run[0].stemX, run[run.length - 1].stemX, stemTop, 0);
          // Secondary beams for sixteenths: across neighbours, or a short stub for a lone one.
          for (let i = 0; i < run.length; i++) {
            if (run[i].value !== '16') continue;
            const next = run[i + 1], prev = run[i - 1];
            if (next && next.value === '16') { s += N.beam(run[i].stemX, next.stemX, stemTop, 1); continue; }
            if (prev && prev.value === '16') continue;
            const stub = 9;
            if (prev) s += N.rect(run[i].stemX - stub, stemTop + 7.5, stub + 0.65, 5);
            else if (next) s += N.rect(run[i].stemX - 0.65, stemTop + 7.5, stub + 0.65, 5);
          }
        }
        run = [];
      };
      notes.forEach((n) => {
        if (flagged(n)) { run.push(n); return; }
        flush();
        if (!n.rest) {
          const r = N.note(n.x, line, { dur: n.value, up: true, dots: n.dots, dotUp: true });
          s += r.svg;
          n.stemX = r.stemX;
        }
      });
      flush();
      if (c.tuplet) {
        const xs = notes.filter((n) => !n.rest).map((n) => n.stemX);
        const beamedTuplet = notes.every((n) => flagged(n));
        if (beamedTuplet) {
          s += N.tuplet3((xs[0] + xs[xs.length - 1]) / 2, stemTop - 4);
        } else {
          // Quarter-note triplet: a bracket with a 3.
          const bx1 = xs[0] - 6, bx2 = xs[xs.length - 1] + 2, by = stemTop - 6;
          s += N.line(bx1, by + 4, bx1, by, 1.1) + N.line(bx1, by, (bx1 + bx2) / 2 - 7, by, 1.1) +
            N.line((bx1 + bx2) / 2 + 7, by, bx2, by, 1.1) + N.line(bx2, by, bx2, by + 4, 1.1) +
            N.tuplet3((bx1 + bx2) / 2, by + 6);
        }
      }
    });
    return N.svg('0 6 ' + Math.ceil(barX + 6) + ' 92', s, 'wide');
  }

  // Counting syllables for the answer.
  function countTokens(cells, meterId) {
    const meter = METERS[meterId];
    const tokens = [];
    if (meter.count === 'eighth') {
      // Count every eighth: 1 2 3 4 5 6; a sixteenth in between is "&".
      cells.forEach((c) => {
        let pos = c.start;
        c.ev.forEach((d) => {
          const t = pos % 6 === 0 ? String(pos / 6 + 1) : '&';
          tokens.push(d < 0 ? '(' + t + ')' : t);
          pos += Math.abs(d);
        });
      });
      return tokens;
    }
    // Count beats: 1 e & a, 1 trip let; a beat held over from a longer note is "–".
    const beatStarts = [];
    meter.beats.reduce((acc, len) => { beatStarts.push(acc); return acc + len; }, 0);
    const events = [];
    cells.forEach((c) => {
      let pos = c.start;
      c.ev.forEach((d) => { events.push({ pos: pos, len: Math.abs(d), rest: d < 0 }); pos += Math.abs(d); });
    });
    meter.beats.forEach((len, b) => {
      const bs = beatStarts[b];
      const inBeat = events.filter((e) => e.pos >= bs && e.pos < bs + len);
      if (!inBeat.length) {
        const holding = events.find((e) => e.pos < bs && e.pos + e.len > bs);
        if (holding && !holding.rest) tokens.push('–');
        return;
      }
      inBeat.forEach((e) => {
        const f = (e.pos - bs) / len;
        const name = f === 0 ? String(b + 1) : Math.abs(f - 0.5) < 1e-6 ? '&' : Math.abs(f - 0.25) < 1e-6 ? 'e'
          : Math.abs(f - 0.75) < 1e-6 ? 'a' : Math.abs(f - 1 / 3) < 1e-6 ? 'trip' : Math.abs(f - 2 / 3) < 1e-6 ? 'let' : '&';
        tokens.push(e.rest ? '(' + name + ')' : name);
      });
    });
    return tokens;
  }

  function rhythmItem(meterId, level, rng) {
    const cells = makeMeasure(meterId, level, rng);
    const onsets = [];
    cells.forEach((c) => {
      let pos = c.start;
      c.ev.forEach((d) => { if (d > 0) onsets.push(pos); pos += Math.abs(d); });
    });
    return {
      id: 'rhythm-' + meterId + '-' + cells.map((c) => c.ev.join(',')).join('|'),
      svg: rhythmSvg(cells, meterId),
      say: countTokens(cells, meterId).join(' '),
      detail: 'count it, then clap or play it',
      onsets: onsets
    };
  }

  // A time signature drawn with Leland, for the selection buttons.
  function meterChip(id) {
    const m = METERS[id];
    return '<svg class="chip-art ts" viewBox="-20 -22 40 44" aria-hidden="true">' + N.timeSig(m.top, m.bottom, 0, 0) + '</svg>';
  }

  /* =========================================================
   * Categories and subcategories
   * ========================================================= */

  // Chips are the cards themselves; the pool is the picked cards.
  function itemSubcat(def, items) {
    return Object.assign(def, {
      chips: items.map((it) => ({ id: it.id, label: it.chip || it.say, html: it.chipHtml })),
      pool: (sel) => items.filter((it) => sel.indexOf(it.id) >= 0)
    });
  }

  const CATEGORIES = [
    { id: 'notes', name: 'Note names', subcats: [
      { id: 'home', name: 'Home position', desc: 'G A B C · D E F♯ G · A B C♯ D · E F♯ G♯ A B, on the strings you pick',
        chips: STRINGS.map((s) => ({ id: s.id, label: s.name })), pool: (sel) => homePool(sel) },
      { id: 'diatonic', name: 'Diatonic note names', toggle: true, desc: 'A scale, chromatic in a range, or notes you pick',
        chips: [{ id: 'on', label: 'On' }], pool: (sel, s) => pitchPool(s) }
    ] },
    { id: 'values', name: 'Note values', subcats: [
      itemSubcat({ id: 'basicvalues', name: 'Basic note values', desc: 'Eighth, quarter, half and whole notes and their rests' }, BASIC_VALUES),
      itemSubcat({ id: 'advvalues', name: 'Advanced note values', desc: 'Dotted notes, sixteenths, triplets' }, ADVANCED_VALUES)
    ] },
    { id: 'keys', name: 'Key signatures', subcats: [
      itemSubcat({ id: 'keysigs', name: 'Key signatures', desc: 'Name the major key' }, KEY_ITEMS),
      { id: 'degrees', name: 'Scale degrees', desc: 'Name the scale degree of each note. One key is recommended; more than one is difficult!',
        chips: KEY_PAIRS.map((k) => ({ id: k.major, label: keyChipLabel(k) })), pool: (sel) => degreePool(sel) }
    ] },
    { id: 'rhythms', name: 'Rhythms', subcats: [
      { id: 'meters', name: 'Time signatures', rhythm: true, desc: 'One measure per card. With several, each rhythm round uses the next one.',
        chips: METER_IDS.map((id) => ({ id: id, label: id, html: meterChip(id), cls: 'ts-chip' })) }
    ] },
    { id: 'symbols', name: 'Symbols', subcats: [
      itemSubcat({ id: 'dynamics', name: 'Dynamics', desc: 'pp to ff, sfz, fp, hairpins' }, DYNAMIC_ITEMS),
      itemSubcat({ id: 'symbols', name: 'Bowing, articulation & repeats', desc: 'Bowings, slurs and ties, articulations, repeats, signs' }, SYMBOL_ITEMS),
      itemSubcat({ id: 'clefs', name: 'Clefs', desc: 'Treble, bass, alto, tenor' }, CLEF_ITEMS),
      itemSubcat({ id: 'advsymbols', name: 'Advanced & contemporary', desc: 'More accents, Bartók pizz, harmonics, tremolo, glissando, extended techniques' }, ADVANCED_SYMBOLS)
    ] }
  ];

  const SUBCATS = [];
  CATEGORIES.forEach((c) => c.subcats.forEach((sc) => { sc.cat = c.id; SUBCATS.push(sc); }));
  const subById = (id) => SUBCATS.find((sc) => sc.id === id);

  global.Content = {
    CATEGORIES: CATEGORIES, SUBCATS: SUBCATS, subById: subById, STRINGS: STRINGS,
    METERS: METERS, METER_IDS: METER_IDS, rhythmItem: rhythmItem,
    SCALE_CHOICES: SCALE_CHOICES, RANGE_NOTES: RANGE_NOTES, PICK_ROWS: PICK_ROWS,
    pretty: pretty, pitchPool: pitchPool, pitchSummary: pitchSummary
  };
})(window);
