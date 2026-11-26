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

  const T = global.Theory;
  const SHARP = '♯', FLAT = '♭';
  const ACC_WORD = { '#': ' sharp', b: ' flat', x: ' double sharp', bb: ' double flat' };
  // 'F#' -> 'F♯'. Names are a letter plus an optional accidental: # b x (double sharp) bb (double flat).
  const pretty = T.pretty;
  const sayName = (name) => name[0] + (ACC_WORD[name.slice(1)] || '');

  function card(body) { return N.svg(CARD_VB, body); }
  function staff5() { return N.staff(3, 127, TOP); }

  /* =========================================================
   * Pitch helpers
   * ========================================================= */

  const keyList = (ids) => (ids || []).map(T.keyById).filter(Boolean);
  const LETTERS = 'CDEFGAB';
  const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const NATURAL_PC = { 0: 'C', 2: 'D', 4: 'E', 5: 'F', 7: 'G', 9: 'A', 11: 'B' };
  const SHARP_PC = { 1: 'C#', 3: 'D#', 6: 'F#', 8: 'G#', 10: 'A#' };
  const FLAT_PC = { 1: 'Db', 3: 'Eb', 6: 'Gb', 8: 'Ab', 10: 'Bb' };
  const accValue = T.accValue;
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
  // In alto clef the same pattern sits one step lower (F♯ in the top space, B♭ in the second space).
  const KEYSIG_SHIFT = { treble: 0, alto: -1 };
  const KEYSIG_X = 38;

  // The accidentals of a key signature after a treble or alto clef; returns { svg, end }.
  function keySignature(type, count, top, clef) {
    if (!count) return { svg: '', end: KEYSIG_X };
    const shift = KEYSIG_SHIFT[clef || 'treble'] || 0;
    const positions = (type === '#' ? SHARP_POS : FLAT_POS).map((p) => p + shift);
    const step = N.accidentalWidth(type) + 2;
    let s = '';
    for (let i = 0; i < count; i++) s += N.accidental(type, KEYSIG_X + i * step, N.posToY(positions[i], top));
    return { svg: s, end: KEYSIG_X + (count - 1) * step + N.accidentalWidth(type) };
  }

  /*
   * One note on a treble (or alto) staff. opts.key: { type, n } draws that key signature and no
   * accidental on the note (it's already in the key). opts.clef: 'treble' | 'alto'.
   */
  function noteSvg(name, octave, opts) {
    opts = opts || {};
    const clef = opts.clef || 'treble';
    const step = name[0];
    const acc = opts.key ? '' : name.slice(1);
    const pos = N.staffPos(step, octave, clef);
    // Room needed above the note head: a flat reaches highest, then a sharp.
    const clearance = acc === 'b' ? 18 : acc ? 13 : 6;
    // Very high notes: slide the staff down (up to 17) so the ledger lines fit on the card.
    const top = TOP + Math.min(17, Math.max(0, 13 - (N.posToY(pos, TOP) - clearance)));
    const y = N.posToY(pos, top);
    const sig = opts.key ? keySignature(opts.key.type, opts.key.n, top, clef) : { svg: '', end: 0 };
    const x = Math.max(88, sig.end + 18);
    const width = Math.max(130, x + 20);
    const up = pos < 4;
    // Notes far above or below the staff get stems that reach the middle line.
    const stemLen = Math.max(35, Math.abs(pos - 4) * N.HALF);
    const n = N.note(x, y, { dur: 'q', up: up, stemLen: stemLen });
    // A slightly taller frame than other cards, taller still for the very highest notes.
    const vbTop = Math.min(NOTE_VB_TOP, Math.floor(y - clearance - 1));
    // Very low notes (viola's C string in treble clef) make the frame taller at the bottom.
    const vbBottom = Math.max(NOTE_VB_BOTTOM, Math.ceil(y + (up ? 8 : stemLen + 4)));
    return N.svg('0 ' + vbTop + ' ' + width + ' ' + (vbBottom - vbTop),
      N.staff(3, width - 3, top) + N.clef(clef, 6, top) + sig.svg + N.ledgers(x, pos, top) +
      N.accidental(acc, x - N.width('noteheadBlack') / 2 - 2.5 - N.accidentalWidth(acc), y) + n.svg);
  }

  // Lowest MIDI note of a tonic at or above the lowest open string (violin G3 = 55, viola C3 = 48).
  function lowestTonic(tonic, lowest) {
    lowest = lowest || 55;
    let m = toMidi(tonic, 2);
    while (m < lowest) m += 12;
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

  // Open strings, low to high. Viola's G, D and A are the same pitches as the violin's.
  const STRINGS = [
    { id: 'C', name: 'C string', open: 48 },
    { id: 'G', name: 'G string', open: 55 },
    { id: 'D', name: 'D string', open: 62 },
    { id: 'A', name: 'A string', open: 69 },
    { id: 'E', name: 'E string', open: 76 }
  ];

  /*
   * The page-wide instrument switch. 'both' is a mixed violin and viola class: it uses the lowest
   * note of either (the viola's C), and cards that show notes can be in treble or alto clef.
   */
  const INSTRUMENTS = {
    violin: { name: 'Violin', strings: ['G', 'D', 'A', 'E'], lowest: 55, clef: 'treble' },
    viola: { name: 'Viola', strings: ['C', 'G', 'D', 'A'], lowest: 48, clef: 'alto' },
    both: { name: 'Violin & viola', strings: ['C', 'G', 'D', 'A', 'E'], lowest: 48, clef: 'treble' }
  };
  const INSTRUMENT_IDS = ['violin', 'viola', 'both'];
  const CLEF_MODES = ['alternate', 'treble', 'alto'];   // for 'both'; the first is the default
  const instrumentOf = (s) => INSTRUMENTS[(s && s.instrument) || 'violin'] || INSTRUMENTS.violin;

  // The clef for the card at position `index` in a round.
  function clefFor(s, index) {
    const inst = (s && s.instrument) || 'violin';
    if (inst !== 'both') return INSTRUMENTS[inst].clef;
    const mode = s.clefMode || CLEF_MODES[0];
    if (mode === 'alternate') return index % 2 ? 'alto' : 'treble';
    return mode;
  }

  /*
   * Cards that show notes are drawn per clef: item.draw(clef) returns the svg. resolve() gives
   * the card as shown at a position, with its svg filled in (drawings are cached).
   */
  function resolve(item, clef) {
    if (!item.draw) return item;
    item._cache = item._cache || {};
    if (!item._cache[clef]) item._cache[clef] = item.draw(clef);
    return Object.assign({}, item, { svg: item._cache[clef] }, item.variant ? item.variant(clef) : {});
  }
  // Semitones above the open string -> finger in first position.
  const FINGER = ['open', 'low 1st', '1st', 'low 2nd', 'high 2nd', '3rd', 'high 3rd', '4th'];
  // Home position, high-2 pattern: G A B C · D E F# G · A B C# D · E F# G# A B
  // The viola's C string uses the same high-2 pattern: C D E F.
  const HOME_SEMIS = { C: [0, 2, 4, 5], G: [0, 2, 4, 5], D: [0, 2, 4, 5], A: [0, 2, 4, 5], E: [0, 2, 4, 5, 7] };

  /*
   * Fingerings. First position: open, low 1, 1, low 2, high 2, 3, high 3, 4 by semitones above the
   * open string, always on the highest string that has the note (so D4 is "Open D", not 4 on G).
   * Above first position on the top string, the lowest odd position (3rd, 5th, ...) that reaches the
   * note with fingers 1-4; in position p the 1st finger is p letter-steps above the open string.
   */
  const FINGER_SAY = ['Open', 'Low 1', '1', 'Low 2', 'High 2', '3', 'High 3', '4'];
  const ordinal = (n) => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
  // Answer choices for both Note names subcategories.
  const NOTE_ANSWERS = [['names', 'Note names'], ['fingers', 'Fingerings']];

  function fingering(name, octave, inst) {
    const midi = toMidi(name, octave);
    const strings = INSTRUMENTS[inst].strings.map((id) => STRINGS.find((x) => x.id === id));
    let st = null;
    strings.forEach((x) => { if (x.open <= midi) st = x; });
    if (!st) return null;
    const semis = midi - st.open;
    const top = st === strings[strings.length - 1];
    if (semis <= 7) {
      const lower = strings[strings.indexOf(st) - 1];
      return {
        say: semis === 0 ? 'Open ' + st.id : FINGER_SAY[semis] + ' on ' + st.id,
        detail: (semis === 0 ? 'open ' + st.name : FINGER[semis] + ' finger on the ' + st.name) +
          (semis === 0 && lower ? ' (or 4th finger on the ' + lower.name + ')' : '')
      };
    }
    if (!top) return null;
    const openName = NATURAL_PC[st.open % 12];
    const steps = N.diatonic(name[0], octave) - N.diatonic(openName, Math.floor(st.open / 12) - 1);
    let pos = 3;
    while (steps - pos + 1 > 4) pos += 2;
    const finger = Math.max(1, steps - pos + 1);
    return {
      say: finger + ' in ' + ordinal(pos) + ' position on ' + st.id,
      detail: FINGER[[0, 2, 4, 5, 7][finger]] + ' finger, ' + ordinal(pos) + ' position, ' + st.name
    };
  }
  // Which instrument's fingering a card shows: in a mixed class, alto-clef cards are the viola's,
  // treble-clef cards the violin's (unless the note is below the violin's G).
  function fingerInst(s, clef, midi) {
    const inst = (s && s.instrument) || 'violin';
    if (inst !== 'both') return inst;
    return clef === 'alto' || midi < INSTRUMENTS.violin.lowest ? 'viola' : 'violin';
  }
  // Adds per-clef fingering answers to a note card when the class says fingerings.
  function withFingering(item, name, octave, s) {
    if (!s || s.noteAnswer !== 'fingers') return item;
    const midi = toMidi(name, octave);
    const at = (clef) => fingering(name, octave, fingerInst(s, clef, midi));
    const first = at(clefFor(s, 0)) || {};
    item.say = first.say || item.say;
    item.variant = (clef) => {
      const f = at(clef);
      return f ? { say: f.say, detail: label(name, octave) + ' · ' + f.detail } : {};
    };
    return item;
  }

  // Home-position notes in one-line form for the subcategory description.
  function homeSummary(s) {
    return instrumentOf(s).strings.map((id) => {
      const st = STRINGS.find((x) => x.id === id);
      return HOME_SEMIS[id].map((semi) => pretty(NATURAL_PC[(st.open + semi) % 12] || SHARP_PC[(st.open + semi) % 12])).join(' ');
    }).join(' · ') + ', on the strings you pick';
  }

  function homePool(strings, settings) {
    const out = [];
    const allowed = instrumentOf(settings).strings;
    STRINGS.filter((s) => strings.indexOf(s.id) >= 0 && allowed.indexOf(s.id) >= 0).forEach((s) => {
      HOME_SEMIS[s.id].forEach((semi) => {
        const midi = s.open + semi;
        const name = NATURAL_PC[midi % 12] || SHARP_PC[midi % 12];
        const octave = Math.floor(midi / 12) - 1;
        out.push(withFingering({
          id: 'note-home-' + midi,
          draw: (clef) => noteSvg(name, octave, { clef: clef }),
          say: sayName(name),
          detail: pretty(name) + octave + ' · ' + s.name + ', ' + FINGER[semi] + (semi === 0 ? '' : ' finger')
        }, name, octave, settings));
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

  // Note names for the range slider: the naturals from the viola's open C up to B7.
  const RANGE_TOP = 107;   // B7
  const RANGE_NOTES = [];
  for (let m = 48; m <= RANGE_TOP; m++) if (NATURAL_PC[m % 12]) RANGE_NOTES.push(NATURAL_PC[m % 12] + (Math.floor(m / 12) - 1));
  // Range presets: a number of octaves (from the lowest tonic for a scale, from the lowest open
  // string otherwise), or 'custom' (the slider's two ends).
  const RANGE_PRESETS = [1, 2, 3, 'custom'];
  const rangeMidi = (s) => toMidi(s.replace(/\d+$/, ''), Number(s.match(/\d+$/)[0]));

  // Spellings for the "pick notes" chips: naturals, then sharps, then flats.
  const PICK_ROWS = [
    ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
    ['C#', 'D#', 'E#', 'F#', 'G#', 'A#', 'B#'],
    ['Cb', 'Db', 'Eb', 'Fb', 'Gb', 'Ab', 'Bb']
  ];

  function pitchItem(name, octave, extra, s) {
    return withFingering({
      id: 'pitch-' + name + octave,
      draw: (clef) => noteSvg(name, octave, { clef: clef }),
      say: sayName(name),
      detail: label(name, octave) + (extra ? ' · ' + extra : '')
    }, name, octave, s);
  }

  // [lowest, highest] MIDI note for the diatonic cards.
  function rangeFor(s) {
    const lowest = instrumentOf(s).lowest;
    if (s.rangePreset !== 'custom') {
      const n = Number(s.rangePreset) || 1;
      const lo = s.pitchMode === 'scale' || !s.pitchMode ? lowestTonic(s.scaleKey, lowest) : lowest;
      return [lo, Math.min(RANGE_TOP, lo + 12 * n)];
    }
    let lo = rangeMidi(RANGE_NOTES.indexOf(s.rangeLow) >= 0 ? s.rangeLow : 'G3');
    let hi = rangeMidi(RANGE_NOTES.indexOf(s.rangeHigh) >= 0 ? s.rangeHigh : 'B5');
    if (lo > hi) { const t = lo; lo = hi; hi = t; }
    // Nothing below the instrument's lowest open string.
    return [Math.max(lo, lowest), Math.max(hi, lowest)];
  }

  // Every note of the scale in the range (melodic minor: both the raised and the natural 6th and 7th).
  function scaleItems(s) {
    const type = SCALE_TYPES[s.scaleType] || SCALE_TYPES.major;
    const tonic = s.scaleKey;
    const [lo, hi] = rangeFor(s);
    const forms = [{ degrees: spellScale(tonic, type.steps), note: type.down ? 'raised, going up' : '' }];
    if (type.down) forms.push({ degrees: spellScale(tonic, type.down), note: 'natural, coming down' });
    const seen = new Map();
    for (let base = lowestTonic(tonic, 0); base <= hi; base += 12) {
      forms.forEach((form) => {
        form.degrees.forEach((d) => {
          const midi = base + d.semi;
          if (midi < lo || midi > hi) return;
          const octave = octaveFor(d.name, midi);
          const key = d.name + octave;
          if (seen.has(key)) return;
          const variant = form.note && (d.degree === 6 || d.degree === 7) ? ', ' + form.note : '';
          seen.set(key, { midi: midi, item: pitchItem(d.name, octave, 'scale degree ' + d.degree + variant, s) });
        });
      });
    }
    return Array.from(seen.values()).sort((a, b) => a.midi - b.midi).map((v) => v.item);
  }

  function chromaticItems(s) {
    const [lo, hi] = rangeFor(s);
    const out = [];
    for (let m = lo; m <= hi; m++) {
      const oct = Math.floor(m / 12) - 1;
      const nat = NATURAL_PC[m % 12];
      if (nat) { out.push(pitchItem(nat, oct, '', s)); continue; }
      const sh = SHARP_PC[m % 12], fl = FLAT_PC[m % 12];
      out.push(pitchItem(sh, oct, 'same pitch as ' + label(fl, oct), s));
      out.push(pitchItem(fl, oct, 'same pitch as ' + label(sh, oct), s));
    }
    return out;
  }

  function pickedItems(s) {
    const [lo, hi] = rangeFor(s);
    const out = [];
    (s.pitchClasses || []).forEach((name) => {
      for (let oct = 2; oct <= 8; oct++) {
        const m = toMidi(name, oct);
        if (m >= lo && m <= hi) out.push({ midi: m, item: pitchItem(name, oct, '', s) });
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

  const midiLabel = (m) => { const n = NATURAL_PC[m % 12] || SHARP_PC[m % 12]; return label(n, Math.floor(m / 12) - 1); };
  // A one-line description of the current choice.
  function pitchSummary(s) {
    const [lo, hi] = rangeFor(s);
    const range = s.rangePreset === 'custom' ? midiLabel(lo) + ' to ' + midiLabel(hi)
      : s.rangePreset + (Number(s.rangePreset) > 1 ? ' octaves' : ' octave');
    const says = s.noteAnswer === 'fingers' ? ' · say fingerings' : '';
    if (s.pitchMode === 'chromatic') return 'Chromatic, ' + range + says;
    if (s.pitchMode === 'pick') {
      const names = (s.pitchClasses || []).map(pretty);
      const list = names.length > 6 ? names.length + ' notes' : names.join(' ');
      return list + ', ' + range + says;
    }
    const type = SCALE_TYPES[s.scaleType] || SCALE_TYPES.major;
    return pretty(s.scaleKey) + ' ' + type.name + ' scale, ' + range + says;
  }

  /* =========================================================
   * Note values
   * ========================================================= */

  const A4 = N.posToY(3, TOP);   // second space — stems up

  /*
   * Note values are drawn bare, without a staff, a little larger and centered on the card.
   * The notes are drawn at the A4 height (stems up), so their middle is at y = 50.
   */
  const BARE_SCALE = 1.35, BARE_WIDE_SCALE = 1.15;
  const WIDE_VALUE_CROP = { x: 4, y: 16, w: 122, h: 86 };   // buttons for beamed groups
  function bareCard(body, wide, cx, cy) {
    const k = wide ? BARE_WIDE_SCALE : BARE_SCALE;
    return card('<g transform="translate(65 62) scale(' + k + ') translate(' + -(cx || 65) + ' ' + -(cy || 50) + ')">' + body + '</g>');
  }
  function valueCard(dur, dots) {
    return bareCard(N.note(62, A4, { dur: dur, up: true, dots: dots || 0 }).svg, false, dots ? 70 : 67, dur === 'w' ? A4 : 50);
  }
  // Rests are bare too, except whole and half rests, which need a line to hang from or sit on.
  function restCard(kind) {
    const line = { w: TOP + 10, h: MID }[kind];
    return bareCard((line ? N.line(48, line, 82, line, 1.3) : '') + N.rest(kind, 65, MID), false, 65, MID - 4);
  }

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
    if (tupletLabel) s += N.tupletNum(tupletLabel, (stems[0] + stems[stems.length - 1]) / 2, top - 4);
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
    { id: 'v-ee', svg: bareCard(beamed([44, 80], ['8', '8']), false, 66), say: 'Two eighth notes', detail: '1 beat together' },
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
    { id: 'a-ssss', svg: bareCard(beamed([30, 52, 74, 96], ['16', '16', '16', '16'], [[0, 3]]), true, 68), chipCrop: WIDE_VALUE_CROP,
      say: 'Four sixteenths', detail: '1 beat · 1 e & a' },
    { id: 'a-trip', svg: bareCard(beamed([36, 62, 88], ['8', '8', '8'], null, '3'), true, 67), chipCrop: WIDE_VALUE_CROP,
      say: 'Triplet', detail: '3 eighths in 1 beat · 1-trip-let' },
    { id: 'a-d8s', svg: bareCard(dottedEighthSixteenth(), true, 68), chipCrop: WIDE_VALUE_CROP,
      say: 'Dotted eighth sixteenth', detail: '1 beat · long-short' }
  ];

  // n sixteenths (or eighths) beamed under one tuplet number, spread across the card.
  function tupletCard(n, dur, label) {
    const xs = [];
    const gap = Math.min(22, 84 / (n - 1));
    for (let i = 0; i < n; i++) xs.push(65 - (gap * (n - 1)) / 2 + i * gap);
    return bareCard(beamed(xs, xs.map(() => dur), dur === '16' ? [[0, n - 1]] : null, label), true, 68);
  }
  // Small grace notes (stem up, a size smaller) before a main note.
  const GRACE_SIZE = 30;
  function graceCard(kind) {
    const main = N.note(88, A4, { dur: 'q', up: true }).svg;
    if (kind === 'acciaccatura' || kind === 'appoggiatura') {
      const g = kind === 'acciaccatura' ? 'graceNoteAcciaccaturaStemUp' : 'graceNoteAppoggiaturaStemUp';
      const gy = N.posToY(4, TOP);   // B4, a step above the main note
      // Leland's grace-note glyphs are already cue-sized.
      return card(staff5() + N.glyph(g, 40, gy) + N.curve(46, gy + 7, 84, A4 + 7, true, 5) + main);
    }
    // Two beamed grace sixteenths (C5, B4) leading into A4.
    const k = GRACE_SIZE / 40, head = N.width('noteheadBlack') * k;
    let s = '';
    const xs = [30, 46], ys = [N.posToY(5, TOP), N.posToY(4, TOP)];
    xs.forEach((x, i) => {
      s += N.glyph('noteheadBlack', x - head / 2, ys[i], { size: GRACE_SIZE });
      s += N.line(x + head / 2 - 0.5, ys[i] - 1, x + head / 2 - 0.5, TOP - 6, 1);
    });
    s += N.rect(xs[0] + head / 2 - 1, TOP - 6, xs[1] - xs[0] + 1, 3) + N.rect(xs[0] + head / 2 - 1, TOP - 1, xs[1] - xs[0] + 1, 3);
    return card(staff5() + s + N.curve(28, ys[0] + 8, 84, A4 + 7, true, 6) + main);
  }

  const TUPLET_ITEMS = [
    { id: 'tup-duplet', svg: tupletCard(2, '8', 2), say: 'Duplet', detail: '2 eighths in the time of 3 (in 6/8, 9/8, 12/8)' },
    { id: 'tup-triplet', svg: tupletCard(3, '8', 3), say: 'Triplet', detail: '3 in the time of 2' },
    { id: 'tup-quintuplet', svg: tupletCard(5, '16', 5), say: 'Quintuplet', detail: '5 sixteenths in the time of 4' },
    { id: 'tup-sextuplet', svg: tupletCard(6, '16', 6), say: 'Sextuplet', detail: '6 sixteenths in the time of 4' },
    { id: 'tup-septuplet', svg: tupletCard(7, '16', 7), say: 'Septuplet', detail: '7 sixteenths in the time of 4' },
    { id: 'grace-notes', chip: 'Grace notes', svg: graceCard('notes'), say: 'Grace notes', detail: 'small quick notes just before the beat; they don’t count in the rhythm' },
    { id: 'grace-appoggiatura', svg: graceCard('appoggiatura'), say: 'Appoggiatura', detail: 'a “leaning” note: no slash; it takes time from the main note' },
    { id: 'grace-acciaccatura', svg: graceCard('acciaccatura'), say: 'Acciaccatura', detail: 'a “crushed” note: slash through it; as quick as possible' }
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
      draw: (clef) => card(staff5() + N.clef(clef, 6, TOP) + keySignature(k.type, k.n, TOP, clef).svg),
      say: pretty(k.major) + ' major',
      detail: accs + ' · relative minor: ' + pretty(k.minor) + ' minor'
    };
  });

  // Scale degrees are shown as a number with a circumflex accent over it (styled in CSS).
  const degreeMark = (d) => '<span class="deg">' + d + '</span>';
  const DEGREE_NAMES = ['tonic', 'supertonic', 'mediant', 'subdominant', 'dominant', 'submediant', 'leading tone'];

  const DEGREE_IDS = ['1', '2', '3', '4', '5', '6', '7'];

  // The picked degrees of each picked key's scale (one octave, tonic to tonic), with the key signature.
  // Minor keys use the natural minor scale, so their 7th degree is the subtonic.
  function degreePool(degrees, s) {
    const out = [];
    keyList(s.degreeKeys).forEach((key) => {
      const start = lowestTonic(key.tonic, 55);
      const scale = T.scaleOf(key).map((n, i) => ({ name: n.name, semi: n.semi, degree: i + 1 }));
      scale.concat([{ name: key.tonic, semi: 12, degree: 1 }]).forEach((d) => {
        if (degrees.indexOf(String(d.degree)) < 0) return;
        const midi = start + d.semi;
        const octave = octaveFor(d.name, midi);
        const role = key.mode === 'minor' && d.degree === 7 ? 'subtonic' : DEGREE_NAMES[d.degree - 1];
        out.push({
          id: 'deg-' + key.id + '-' + d.name + octave,
          draw: (clef) => noteSvg(d.name, octave, { key: key.sig, clef: clef }),
          say: degreeMark(d.degree),
          detail: label(d.name, octave) + ' in ' + T.keyName(key) + ' · ' + role
        });
      });
    });
    return out;
  }

  /* =========================================================
   * Intervals: two notes of a key, unison to a 10th
   * ========================================================= */

  const INTERVAL_STYLES = [['melodic', 'One after the other'], ['harmonic', 'Together']];

  function intervalPool(ids, s) {
    const out = [];
    const together = s.intervalStyle === 'harmonic';
    keyList(s.intervalKeys).forEach((key) => {
      T.INTERVALS.filter((iv) => ids.indexOf(iv.id) >= 0).forEach((iv) => {
        T.intervalsInKey(key, iv).forEach((p) => {
          out.push({
            id: 'interval-' + key.id + '-' + iv.id + '-' + p.low,
            draw: (clef) => {
              const lowOct = bassOctaveFor(p.low, clef, Math.round(4 - iv.steps / 2));
              const lowMidi = T.toMidi(p.low, lowOct);
              const low = { name: p.low, octave: lowOct };
              const high = { name: p.high, octave: octaveFor(p.high, lowMidi + iv.semis) };
              return chordsSvg(together ? [[low, high]] : [[low], [high]], { clef: clef, sig: key.sig });
            },
            say: iv.name,
            detail: (iv.aka ? iv.aka + ' · ' : '') + pretty(p.low) + (iv.steps ? ' up to ' : ' and ') + pretty(p.high) + ' in ' + T.keyName(key)
          });
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
    { id: 'sym-pizz', svg: textCard('pizz.', 40), say: 'Pizzicato', detail: 'pluck the string' },
    { id: 'sym-arco', svg: textCard('arco', 40), say: 'Arco', detail: 'play with the bow again' },
    { id: 'sym-sharp', svg: card(N.accidental('#', 65 - N.accidentalWidth('#', 92) / 2, 62, 92)), say: 'Sharp', detail: 'raises a note a half step' },
    { id: 'sym-flat', svg: card(N.accidental('b', 65 - N.accidentalWidth('b', 92) / 2, 74, 92)), say: 'Flat', detail: 'lowers a note a half step' },
    { id: 'sym-natural', svg: card(N.accidental('n', 65 - N.accidentalWidth('n', 92) / 2, 62, 92)), say: 'Natural', detail: 'cancels a sharp or flat' }
  ];

  /* =========================================================
   * Repeats and navigation
   * ========================================================= */

  // One ending bracket over a measure; the 1st ending ends with a repeat sign.
  function endingCard(num, repeat) {
    return card(staff5() + N.line(10, 26, 118, 26, 1.3) + N.line(10.6, 26, 10.6, 36, 1.3) +
      (repeat ? N.line(117.4, 26, 117.4, 36, 1.3) : '') + N.text(22, 37, num, 13, { italic: false }) +
      N.note(64, A4, { dur: 'h', up: true }).svg + (repeat ? N.endRepeat(124, TOP) : N.barline(124, TOP, TOP + 40)));
  }

  const REPEAT_ITEMS = [
    { id: 'sym-repeat', svg: card(staff5() + N.startRepeat(8, TOP) +
        N.note(48, A4, { dur: 'q', up: true }).svg + N.note(80, A4, { dur: 'q', up: true }).svg + N.endRepeat(124, TOP)),
      say: 'Repeat sign', detail: 'go back and play it again' },
    { id: 'sym-endings', chip: '1st & 2nd endings', svg: card(staff5() +
        N.line(6, 26, 60, 26, 1.3) + N.line(6.6, 26, 6.6, 36, 1.3) + N.text(16, 37, '1.', 13, { italic: false }) +
        N.note(34, A4, { dur: 'h', up: true }).svg + N.endRepeat(64, TOP) +
        N.line(70, 26, 124, 26, 1.3) + N.line(70.6, 26, 70.6, 36, 1.3) + N.text(80, 37, '2.', 13, { italic: false }) +
        N.note(98, A4, { dur: 'h', up: true }).svg + N.finalBarline(127, TOP)),
      say: 'First and second endings', detail: '1st time take ending 1, 2nd time skip to ending 2' },
    { id: 'rep-double', chip: 'Double repeat', svg: card(staff5() + N.note(30, A4, { dur: 'q', up: true }).svg + N.doubleRepeat(65, TOP) +
        N.note(100, A4, { dur: 'q', up: true }).svg), say: 'Double repeat sign', detail: 'repeat the part before, then the part after' },
    { id: 'rep-measure', chip: 'Measure repeat', svg: card(staff5() + N.barline(4, TOP, TOP + 40) +
        N.glyph('repeat1Bar', 65 - N.width('repeat1Bar') / 2, MID) + N.barline(126, TOP, TOP + 40)),
      say: 'Measure repeat', detail: 'play the last measure again' },
    { id: 'rep-ending1', chip: '1st ending', svg: endingCard('1.', true), say: '1st ending', detail: 'play it the first time, then repeat' },
    { id: 'rep-ending2', chip: '2nd ending', svg: endingCard('2.', false), say: '2nd ending', detail: 'skip here the second time' },
    { id: 'rep-ending3', chip: '3rd ending', svg: endingCard('3.', false), say: '3rd ending', detail: 'skip here the third time' },
    { id: 'sym-dc', svg: textCard('D.C. al Fine', 21), say: 'D.C. al Fine', detail: 'back to the beginning, stop at Fine' },
    { id: 'rep-dccoda', svg: textCard('D.C. al Coda', 20), say: 'D.C. al Coda', detail: 'back to the beginning, then jump to the coda' },
    { id: 'rep-dsfine', svg: textCard('D.S. al Fine', 21), say: 'D.S. al Fine', detail: 'back to the sign (segno), stop at Fine' },
    { id: 'rep-dscoda', svg: textCard('D.S. al Coda', 20), say: 'D.S. al Coda', detail: 'back to the sign (segno), then jump to the coda' },
    { id: 'rep-dc', svg: textCard('D.C.', 40), say: 'Da capo', detail: 'D.C.: back to the beginning' },
    { id: 'rep-ds', svg: textCard('D.S.', 40), say: 'Dal segno', detail: 'D.S.: back to the sign' },
    { id: 'rep-segno', svg: card(N.glyph('segno', 65 - N.width('segno', 64) / 2, 92, { size: 64 })), say: 'Segno', detail: '“the sign”: where D.S. goes back to' },
    { id: 'sym-fine', svg: textCard('Fine', 36), say: 'Fine', detail: '“fee-nay” · the end' },
    { id: 'sym-coda', svg: card(N.coda(65, 84, 64)), say: 'Coda', detail: 'jump to the ending section' },
    { id: 'sym-final', svg: card(staff5() + N.note(50, A4, { dur: 'h', up: true }).svg + N.finalBarline(110, TOP)),
      say: 'Final barline', detail: 'the end of the piece' }
  ];

  /* =========================================================
   * Tempo, pauses and ornaments
   * ========================================================= */

  // Words on a card, shrunk to fit. Tempo markings are bold upright; changes are italic.
  function wordCard(str, italic) {
    const size = Math.min(34, Math.floor(250 / Math.max(5, str.length)));
    return card(N.text(65, 70, str, size, { italic: !!italic }));
  }

  // [id, marking, say, detail], slowest to fastest.
  const TEMPO_TERMS = [
    ['grave', 'Grave', 'Grave', 'very slow and solemn'],
    ['largo', 'Largo', 'Largo', 'very slow and broad'],
    ['lento', 'Lento', 'Lento', 'slow'],
    ['larghetto', 'Larghetto', 'Larghetto', 'rather slow; a little faster than largo'],
    ['adagio', 'Adagio', 'Adagio', 'slow, at ease'],
    ['adagietto', 'Adagietto', 'Adagietto', 'a little faster than adagio'],
    ['andante', 'Andante', 'Andante', 'at a walking pace'],
    ['andantino', 'Andantino', 'Andantino', 'a little faster than andante'],
    ['moderato', 'Moderato', 'Moderato', 'at a moderate speed'],
    ['allegretto', 'Allegretto', 'Allegretto', 'moderately fast'],
    ['allegro', 'Allegro', 'Allegro', 'fast and lively'],
    ['vivace', 'Vivace', 'Vivace', 'lively and fast'],
    ['vivacissimo', 'Vivacissimo', 'Vivacissimo', 'very lively and fast'],
    ['presto', 'Presto', 'Presto', 'very fast'],
    ['prestissimo', 'Prestissimo', 'Prestissimo', 'as fast as possible'],
    ['prestississimo', 'Prestississimo', 'Prestississimo', 'even faster than prestissimo!']
  ];
  const DEFAULT_TEMPOS = ['andante', 'andantino', 'moderato', 'allegretto', 'allegro'];
  const TEMPO_CHANGES = [
    ['rit', 'rit.', 'Ritardando', 'gradually slower'],
    ['rall', 'rall.', 'Rallentando', 'gradually slower'],
    ['riten', 'riten.', 'Ritenuto', 'suddenly slower, held back'],
    ['accel', 'accel.', 'Accelerando', 'gradually faster'],
    ['stringendo', 'string.', 'Stringendo', 'pressing forward, faster'],
    ['allarg', 'allarg.', 'Allargando', 'broadening: slower and fuller'],
    ['meno', 'meno mosso', 'Meno mosso', 'less motion: a bit slower'],
    ['piu', 'più mosso', 'Più mosso', 'more motion: a bit faster'],
    ['atempo', 'a tempo', 'A tempo', 'back to the tempo'],
    ['tempo1', 'Tempo I', 'Tempo primo', 'back to the first tempo'],
    ['rubato', 'rubato', 'Rubato', 'flexible tempo, stretching and pushing']
  ];
  const TEMPO_ITEMS = [].concat(
    TEMPO_TERMS.map(([id, mark, say, detail]) => ({ id: 'tempo-' + id, chip: mark, group: 'Tempo markings',
      svg: wordCard(mark, false), say: say, detail: detail })),
    TEMPO_CHANGES.map(([id, mark, say, detail]) => ({ id: 'tempo-' + id, chip: mark, group: 'Tempo changes',
      svg: wordCard(mark, true), say: say, detail: detail })));

  function twoNotesWith(mid) {
    return card(staff5() + N.note(40, A4, { dur: 'q', up: true }).svg + mid + N.note(104, A4, { dur: 'q', up: true }).svg);
  }
  const PAUSE_ITEMS = [
    { id: 'sym-fermata', svg: markAboveCard('fermataAbove'), say: 'Fermata', detail: 'hold longer than written (also called a pause)' },
    { id: 'adv-fshort', svg: markAboveCard('fermataShortAbove'), say: 'Short fermata', detail: 'a brief pause' },
    { id: 'adv-flong', svg: markAboveCard('fermataLongAbove'), say: 'Long fermata', detail: 'a long pause' },
    { id: 'pause-fverylong', svg: markAboveCard('fermataVeryLongAbove'), say: 'Very long fermata', detail: 'a very long pause' },
    { id: 'pause-lunga', chip: 'Lunga', svg: card(staff5() + N.note(65, B4, { dur: 'q', up: false }).svg + N.above('fermataAbove', 65, TOP - 4) +
        N.text(80, TOP - 6, 'lunga', 13, { anchor: 'start' })), say: 'Fermata lunga', detail: 'a long hold' },
    { id: 'adv-caesura', svg: twoNotesWith(N.glyph('caesura', 70, TOP + 10)), say: 'Caesura', detail: '“railroad tracks”: a complete stop' },
    { id: 'pause-breath', svg: twoNotesWith(N.glyph('breathMarkComma', 68, TOP - 3)), say: 'Breath mark',
      detail: 'a short break: lift the bow or take a breath' },
    { id: 'pause-gp', chip: 'G.P.', svg: card(staff5() + N.rest('w', 65, MID) + N.text(65, TOP - 8, 'G.P.', 18, { italic: false })),
      say: 'General pause', detail: 'everyone is silent for the whole bar' }
  ];

  // Ornaments over a stem-down B4.
  function trillLineCard() {
    let s = staff5() + N.note(30, B4, { dur: 'h', up: false }).svg + N.glyph('ornamentTrill', 23, TOP - 5);
    for (let x = 44; x < 118; x += N.width('wiggleTrill')) s += N.glyph('wiggleTrill', x, TOP - 9);
    return card(s);
  }
  const ORNAMENT_ITEMS = [
    { id: 'orn-trill', svg: markAboveCard('ornamentTrill'), say: 'Trill', detail: 'alternate quickly with the note above' },
    { id: 'orn-trillline', chip: 'Trill with wavy line', svg: trillLineCard(), say: 'Trill', detail: 'trill for as long as the wavy line lasts' },
    { id: 'orn-mordent', svg: markAboveCard('ornamentMordent'), say: 'Mordent', detail: 'note, the note below, note: quickly' },
    { id: 'orn-invmordent', chip: 'Inverted mordent', svg: markAboveCard('ornamentShortTrill'), say: 'Inverted mordent',
      detail: 'note, the note above, note: quickly (upper mordent)' },
    { id: 'orn-turn', svg: markAboveCard('ornamentTurn'), say: 'Turn', detail: 'above, note, below, note' },
    { id: 'orn-invturn', chip: 'Inverted turn', svg: markAboveCard('ornamentTurnInverted'), say: 'Inverted turn', detail: 'below, note, above, note' },
    { id: 'orn-slashturn', chip: 'Slashed turn', svg: markAboveCard('ornamentTurnSlash'), say: 'Inverted turn', detail: 'a turn with a slash: starts below' },
    { id: 'orn-tremblement', svg: markAboveCard('ornamentTremblement'), say: 'Tremblement', detail: 'French Baroque trill, from the note above' },
    { id: 'orn-trillmordent', chip: 'Trill with mordent', svg: markAboveCard('ornamentPrecompTrillWithMordent'), say: 'Trill with mordent',
      detail: 'a trill that ends with a turn below' },
    { id: 'orn-schleifer', chip: 'Schleifer (slide)', svg: markAboveCard('ornamentSchleifer'), say: 'Schleifer', detail: 'slide: two quick notes rising into the note' }
  ];
  const DEFAULT_ORNAMENTS = ['orn-trill', 'orn-mordent', 'orn-invmordent', 'orn-turn'];

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
  // A hollow diamond notehead: where to touch the string lightly.
  function naturalHarmonicCard() {
    return card(staff5() + N.note(65, C5, { dur: 'h', up: false, head: 'noteheadDiamondHalf' }).svg);
  }
  // A stopped note (A4) with a diamond a perfect 4th above (D5) on the same stem.
  function artificialHarmonicCard() {
    const n = N.note(65, A4, { dur: 'q', up: true, stemLen: 35 + 3 * N.HALF });
    const d = N.posToY(6, TOP);
    return card(staff5() + n.svg + N.glyph('noteheadDiamondHalf', 65 - N.width('noteheadBlack') / 2, d));
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
    { id: 'adv-natharm', chip: 'Natural harmonic', svg: naturalHarmonicCard(), say: 'Natural harmonic',
      detail: 'diamond note: lightly touch the open string at that spot' },
    { id: 'adv-artharm', chip: 'Artificial harmonic', svg: artificialHarmonicCard(), say: 'Artificial harmonic',
      detail: 'press the lower note, lightly touch a 4th above with the 4th finger' },
    { id: 'adv-tremolo', svg: tremoloCard(), say: 'Tremolo', detail: 'very fast, repeated bow strokes' },
    { id: 'adv-gliss', svg: glissCard(), say: 'Glissando', detail: 'slide from one note to the next' },
    { id: 'adv-xhead', chip: 'X notehead', svg: card(staff5() + N.note(65, B4, { dur: 'q', up: false, head: 'noteheadXBlack' }).svg),
      say: 'X notehead', detail: 'a percussive sound with no clear pitch' },
    { id: 'adv-qsharp', svg: quarterToneCard('qs', 62), say: 'Quarter-tone sharp', detail: 'raise the note by a quarter step' },
    { id: 'adv-qflat', svg: quarterToneCard('qf', 74), say: 'Quarter-tone flat', detail: 'lower the note by a quarter step' },
    { id: 'adv-tqsharp', chip: 'Three-quarter-tone sharp', svg: quarterToneCard('tqs', 62), say: 'Three-quarter-tone sharp', detail: 'raise the note by three quarter steps' },
    { id: 'adv-tqflat', chip: 'Three-quarter-tone flat', svg: quarterToneCard('tqf', 74), say: 'Three-quarter-tone flat', detail: 'lower the note by three quarter steps' },
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

  // Picked when Advanced & contemporary is turned on; everything else stays available.
  const DEFAULT_ADVANCED = ['adv-marcato', 'adv-staccatissimo', 'adv-accstacc', 'adv-tenacc', 'adv-snap', 'adv-harmonic',
    'adv-natharm', 'adv-artharm', 'adv-tremolo', 'adv-gliss', 'adv-sfp', 'adv-collegno', 'adv-sultasto', 'adv-consord',
    'adv-senzasord', 'adv-senzavib'];

  /* =========================================================
   * Rhythms: one measure per card, drawn on a one-line staff
   * ========================================================= */

  // Durations are in units of 1/48 of a whole note: sixteenth 3, eighth 6, quarter 12,
  // dotted quarter 18, half 24, whole 48; an eighth-note triplet is 4, a duplet eighth in 6/8 is 9.
  // Beat lengths per meter; compound meters beat in dotted quarters, and 7/8 is 2+2+3.
  // Common and cut time work exactly like 4/4 and 2/2 (`like`) but show the C and ¢ symbols.
  const METERS = {
    '2/4': { top: 2, bottom: 4, beats: [12, 12], count: 'beat' },
    '3/4': { top: 3, bottom: 4, beats: [12, 12, 12], count: 'beat' },
    '4/4': { top: 4, bottom: 4, beats: [12, 12, 12, 12], count: 'beat' },
    'C': { top: 4, bottom: 4, beats: [12, 12, 12, 12], count: 'beat', like: '4/4', sym: 'common', name: 'Common time' },
    'cut': { top: 2, bottom: 2, beats: [24, 24], count: 'beat', like: '2/2', sym: 'cut', name: 'Cut time' },
    '3/8': { top: 3, bottom: 8, beats: [6, 6, 6], count: 'eighth' },
    '6/8': { top: 6, bottom: 8, beats: [18, 18], count: 'eighth', compound: true },
    '2/2': { top: 2, bottom: 2, beats: [24, 24], count: 'beat' },
    '3/2': { top: 3, bottom: 2, beats: [24, 24, 24], count: 'beat' },
    '5/4': { top: 5, bottom: 4, beats: [12, 12, 12, 12, 12], count: 'beat' },
    '7/8': { top: 7, bottom: 8, beats: [12, 12, 18], count: 'eighth' },
    '9/8': { top: 9, bottom: 8, beats: [18, 18, 18], count: 'eighth', compound: true },
    '12/8': { top: 12, bottom: 8, beats: [18, 18, 18, 18], count: 'eighth', compound: true }
  };
  const METER_IDS = Object.keys(METERS);
  // The two groups of time-signature buttons.
  const METER_GROUPS = { Simple: ['2/4', '3/4', '4/4', 'C', 'cut', '3/8', '6/8'], Complex: ['2/2', '3/2', '5/4', '7/8', '9/8', '12/8'] };
  const DEFAULT_METERS = ['2/4', '3/4', '4/4'];
  const meterName = (id) => METERS[id].name || id;

  /*
   * Note values for rhythms, picked with symbol buttons. Triplets only fit meters whose beat splits
   * in two (simple meters counted in beats); duplets only fit compound meters (6/8, 9/8, 12/8).
   */
  const RHYTHM_VALUES = [
    ['16', 'Sixteenths'], ['8', 'Eighths'], ['q', 'Quarters'], ['h', 'Halves'], ['w', 'Whole notes'],
    ['d8', 'Dotted eighth + sixteenth'], ['dq', 'Dotted quarters'], ['dh', 'Dotted halves'],
    ['trip', 'Triplets'], ['dup', 'Duplets'], ['rest', 'Rests']
  ];
  // "Whole (or dotted half in 3/4)": both are on, and each shows up where it fits. Rests stay on as before.
  const DEFAULT_RHYTHM_VALUES = ['8', 'q', 'h', 'w', 'dh', 'rest'];

  // One-beat cells for each beat length: [durations (negative = rest), weight, note values it uses, tuplet].
  const BEAT_CELLS = {
    12: [
      [[12], 4, ['q']], [[6, 6], 4, ['8']], [[-12], 1.4, ['q', 'rest']],
      [[3, 3, 3, 3], 1.5, ['16']], [[6, 3, 3], 1, ['8', '16']], [[3, 3, 6], 1, ['8', '16']],
      [[4, 4, 4], 1, ['trip'], 3], [[9, 3], 0.8, ['d8']], [[-6, 6], 0.8, ['8', 'rest']]
    ],
    24: [
      [[24], 4, ['h']], [[12, 12], 4, ['q']], [[-24], 1.2, ['h', 'rest']],
      [[12, 6, 6], 1.2, ['q', '8']], [[6, 6, 12], 1.2, ['q', '8']], [[6, 6, 6, 6], 1, ['8']],
      [[18, 6], 1, ['dq']], [[-12, 12], 0.8, ['q', 'rest']], [[8, 8, 8], 0.6, ['trip'], 3]
    ],
    6: [
      [[6], 4, ['8']], [[-6], 1.2, ['8', 'rest']], [[3, 3], 2, ['16']]
    ],
    18: [
      [[18], 3, ['dq']], [[12, 6], 3, ['q', '8']], [[6, 6, 6], 3, ['8']], [[-18], 0.8, ['dq', 'rest']],
      [[6, 12], 1, ['q', '8']], [[3, 3, 6, 6], 1, ['16', '8']], [[6, 3, 3, 6], 1, ['16', '8']],
      [[9, 3, 6], 1, ['d8', '8']], [[-6, 6, 6], 0.8, ['8', 'rest']], [[3, 3, 3, 3, 3, 3], 0.6, ['16']],
      [[9, 9], 1, ['dup'], 2]
    ]
  };

  // Cells longer than one beat, and the beats they may start on in each meter (C and cut use 4/4 and 2/2).
  const MULTI_CELLS = [
    { ev: [24], span: 2, beat: 12, w: 2, uses: ['h'], starts: { '2/4': [0], '3/4': [0, 1], '4/4': [0, 2], '5/4': [0, 1, 3], '7/8': [0] } },
    { ev: [-24], span: 2, beat: 12, w: 0.4, uses: ['h', 'rest'], starts: { '4/4': [0, 2] } },
    { ev: [18, 6], span: 2, beat: 12, w: 1.2, uses: ['dq'], starts: { '2/4': [0], '3/4': [0, 1], '4/4': [0, 2], '5/4': [0, 1, 3] } },
    { ev: [36], span: 3, beat: 12, w: 1.2, uses: ['dh'], starts: { '3/4': [0], '4/4': [0, 1], '5/4': [0] } },
    { ev: [48], span: 4, beat: 12, w: 0.6, uses: ['w'], starts: { '4/4': [0] } },
    { ev: [48], span: 2, beat: 24, w: 1, uses: ['w'], starts: { '2/2': [0], '3/2': [0, 1] } },
    { ev: [36, 12], span: 2, beat: 24, w: 0.8, uses: ['dh'], starts: { '2/2': [0], '3/2': [0, 1] } },
    { ev: [12], span: 2, beat: 6, w: 1.5, uses: ['q'], starts: { '3/8': [0, 1] } },
    { ev: [18], span: 3, beat: 6, w: 0.6, uses: ['dq'], starts: { '3/8': [0] } },
    { ev: [36], span: 2, beat: 18, w: 0.8, uses: ['dh'], starts: { '6/8': [0], '9/8': [0, 1], '12/8': [0, 2] } }
  ];

  // Whether a cell may be used in a meter: triplets need a beat that splits in two, duplets a compound meter.
  function cellFits(tuplet, meter) {
    if (tuplet === 3) return meter.count === 'beat';
    if (tuplet === 2) return !!meter.compound;
    return true;
  }
  const allowed = (uses, values) => uses.every((u) => values.indexOf(u) >= 0);

  // Every cell that could start on beat i of a meter, with the picked note values.
  function cellOptions(meterId, i, values) {
    const meter = METERS[meterId];
    const key = meter.like || meterId;
    const len = meter.beats[i];
    const opts = [];
    BEAT_CELLS[len].forEach((c) => {
      if (!cellFits(c[3], meter) || !allowed(c[2], values)) return;
      opts.push({ ev: c[0], w: c[1], tuplet: c[3] || 0, span: 1 });
    });
    MULTI_CELLS.forEach((m) => {
      if (m.beat !== len || !allowed(m.uses, values)) return;
      if (!m.starts[key] || m.starts[key].indexOf(i) < 0 || i + m.span > meter.beats.length) return;
      opts.push({ ev: m.ev, w: m.w, tuplet: 0, span: m.span });
    });
    return opts;
  }

  // Whether a note value can show up at all in a meter (for greying out buttons).
  function valueFits(valueId, meterId) {
    const meter = METERS[meterId];
    const key = meter.like || meterId;
    const inBeat = meter.beats.some((len) => BEAT_CELLS[len].some((c) => cellFits(c[3], meter) && c[2].indexOf(valueId) >= 0));
    const inMulti = MULTI_CELLS.some((m) => m.uses.indexOf(valueId) >= 0 && m.starts[key]);
    return inBeat || inMulti;
  }

  // Duration in units -> [note value, dots].
  const NOTE_VALUE = { 72: ['w', 1], 48: ['w', 0], 36: ['h', 1], 24: ['h', 0], 18: ['q', 1], 12: ['q', 0],
    9: ['8', 1], 6: ['8', 0], 3: ['16', 0] };
  const TUPLET_VALUE = { 4: ['8', 0], 8: ['q', 0], 9: ['8', 0] };
  const REST_VALUE = { 24: ['h', 0], 18: ['q', 1], 12: ['q', 0], 6: ['8', 0] };

  function weightedPick(options, rng) {
    let total = 0;
    options.forEach((o) => { total += o.w; });
    let x = rng() * total;
    for (let i = 0; i < options.length; i++) { x -= options[i].w; if (x <= 0) return options[i]; }
    return options[options.length - 1];
  }

  // Cells: [{ start (units), beat (index), ev: [durations], tuplet (0, 2 or 3) }]
  // `values` is the list of picked note values (see RHYTHM_VALUES).
  function makeMeasure(meterId, values, rng) {
    const meter = METERS[meterId];
    const starts = [];
    meter.beats.reduce((acc, len) => { starts.push(acc); return acc + len; }, 0);
    for (let attempt = 0; attempt < 40; attempt++) {
      const cells = [];
      let i = 0;
      while (i < meter.beats.length) {
        let opts = cellOptions(meterId, i, values);
        // If the picked values can't fill this beat, use one note for the beat.
        if (!opts.length) opts = [{ ev: [meter.beats[i]], w: 1, tuplet: 0, span: 1 }];
        const c = weightedPick(opts, rng);
        cells.push({ start: starts[i], beat: i, ev: c.ev, tuplet: c.tuplet });
        i += c.span;
      }
      let rest = 0, all = 0;
      cells.forEach((c) => c.ev.forEach((d) => { all += Math.abs(d); if (d < 0) rest += -d; }));
      if (rest <= all / 3) return cells;
    }
    return [{ start: 0, beat: 0, ev: [meter.beats.reduce((a, b) => a + b, 0)], tuplet: 0 }];
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
    const tsW = meter.sym ? N.width('timeSigCommon') : Math.max(N.timeSigNumberWidth(meter.top), N.timeSigNumberWidth(meter.bottom));
    const tsX = 8 + tsW / 2;
    const x0 = 16 + tsW, W = measureWidth(meter);
    const barX = x0 + W + 24;   // room after the last note
    let s = N.singleLine(4, barX, line) + N.barline(barX, line - 20, line + 20, 1.8) +
      (meter.sym ? N.timeSigSymbol(meter.sym, tsX, line) : N.timeSig(meter.top, meter.bottom, tsX, line));
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
          s += N.tupletNum(c.tuplet, (xs[0] + xs[xs.length - 1]) / 2, stemTop - 4);
        } else {
          // Quarter-note triplet: a bracket with a 3.
          const bx1 = xs[0] - 6, bx2 = xs[xs.length - 1] + 2, by = stemTop - 6;
          s += N.line(bx1, by + 4, bx1, by, 1.1) + N.line(bx1, by, (bx1 + bx2) / 2 - 7, by, 1.1) +
            N.line((bx1 + bx2) / 2 + 7, by, bx2, by, 1.1) + N.line(bx2, by, bx2, by + 4, 1.1) +
            N.tupletNum(c.tuplet, (bx1 + bx2) / 2, by + 6);
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
      // A note held into this beat from before: "1 & 2 – &".
      if (inBeat[0].pos > bs) {
        const holding = events.find((e) => e.pos < bs && e.pos + e.len > bs);
        if (holding && !holding.rest) tokens.push('–');
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

  function rhythmItem(meterId, values, rng) {
    const cells = makeMeasure(meterId, values, rng);
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
    const m = METERS[id] || NAMING_METERS[id];
    return '<svg class="chip-art ts" viewBox="-20 -22 40 44" aria-hidden="true">' +
      (m.sym ? N.timeSigSymbol(m.sym, 0, 0) : N.timeSig(m.top, m.bottom, 0, 0)) + '</svg>';
  }

  // Naming time signatures: just the time signature, big.
  const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  const METER_DETAIL = {
    '2/4': '2 quarter-note beats in a measure', '3/4': '3 quarter-note beats in a measure',
    '4/4': '4 quarter-note beats in a measure', 'C': '4 quarter-note beats: the same as 4/4', 'cut': '2 half-note beats: the same as 2/2',
    '3/8': '3 eighth-note beats in a measure', '6/8': '2 dotted-quarter beats (6 eighths) in a measure',
    '2/2': '2 half-note beats in a measure', '3/2': '3 half-note beats in a measure', '5/4': '5 quarter-note beats in a measure',
    '7/8': '7 eighths in a measure, grouped 2 + 2 + 3', '9/8': '3 dotted-quarter beats (9 eighths) in a measure',
    '12/8': '4 dotted-quarter beats (12 eighths) in a measure',
    '5/8': '5 eighths in a measure, grouped 2 + 3 or 3 + 2',
    '10/8': '10 eighths in a measure, grouped in 2s and 3s (often 3 + 3 + 2 + 2)',
    '11/8': '11 eighths in a measure, grouped in 2s and 3s (often 3 + 3 + 3 + 2)'
  };
  // Time signatures that are only named, not played as rhythms, and where their buttons go.
  const NAMING_METERS = {
    '5/8': { top: 5, bottom: 8, after: '5/4' }, '10/8': { top: 10, bottom: 8, after: '9/8' }, '11/8': { top: 11, bottom: 8, after: '10/8' }
  };
  const TIMESIG_GROUPS = { Simple: METER_GROUPS.Simple.slice(), Complex: METER_GROUPS.Complex.slice() };
  Object.keys(NAMING_METERS).forEach((id) => {
    const list = TIMESIG_GROUPS.Complex;
    list.splice(list.indexOf(NAMING_METERS[id].after) + 1, 0, id);
  });
  const cap = (w) => w[0].toUpperCase() + w.slice(1);
  const TIMESIG_ITEMS = [].concat.apply([], Object.keys(TIMESIG_GROUPS).map((g) => TIMESIG_GROUPS[g].map((id) => {
    const m = METERS[id] || NAMING_METERS[id];
    return {
      id: 'ts-' + id, chip: m.name || id, group: g, chipHtml: meterChip(id),
      svg: card(m.sym ? N.glyph(m.sym === 'cut' ? 'timeSigCutCommon' : 'timeSigCommon', 65, MID, { size: 64, anchor: 'middle' })
        : N.timeSigNumber(m.top, 65, MID - 16, 64) + N.timeSigNumber(m.bottom, 65, MID + 16, 64)),
      say: m.sym ? m.name : cap(NUMBER_WORDS[m.top]) + ' ' + NUMBER_WORDS[m.bottom],
      detail: METER_DETAIL[id]
    };
  })));

  // Small pictures of note values for the rhythm buttons (and the note value chips).
  function noteArt(body, x0, w) {
    return '<svg class="chip-art note-art" viewBox="' + x0 + ' -42 ' + w + ' 50" aria-hidden="true"><g>' + body + '</g></svg>';
  }
  function beamedArt(n, dur, label) {
    let s = '';
    const xs = [];
    for (let i = 0; i < n; i++) { const r = N.note(i * 16, 0, { dur: dur, up: true, noFlag: true }); s += r.svg; xs.push(r.stemX); }
    s += N.beam(xs[0], xs[n - 1], -35, 0);
    if (dur === '16') s += N.beam(xs[0], xs[n - 1], -35, 1);
    if (label) s += N.tupletNum(label, (xs[0] + xs[n - 1]) / 2, -39);
    return noteArt(s, -9, (n - 1) * 16 + 20);
  }
  const RHYTHM_VALUE_ART = {
    '16': () => noteArt(N.note(0, 0, { dur: '16', up: true }).svg, -9, 26),
    '8': () => noteArt(N.note(0, 0, { dur: '8', up: true }).svg, -9, 24),
    'q': () => noteArt(N.note(0, 0, { dur: 'q', up: true }).svg, -9, 20),
    'h': () => noteArt(N.note(0, 0, { dur: 'h', up: true }).svg, -9, 20),
    'w': () => noteArt(N.note(0, 0, { dur: 'w' }).svg, -10, 22),
    'd8': () => {
      const a = N.note(0, 0, { dur: '8', up: true, noFlag: true, dots: 1 });
      const b = N.note(24, 0, { dur: '16', up: true, noFlag: true });
      return noteArt(a.svg + b.svg + N.beam(a.stemX, b.stemX, -35, 0) + N.rect(b.stemX - 8, -27.5, 8.65, 5), -9, 42);
    },
    'dq': () => noteArt(N.note(0, 0, { dur: 'q', up: true, dots: 1 }).svg, -9, 26),
    'dh': () => noteArt(N.note(0, 0, { dur: 'h', up: true, dots: 1 }).svg, -9, 26),
    'trip': () => beamedArt(3, '8', 3),
    'dup': () => beamedArt(2, '8', 2),
    'rest': () => noteArt(N.rest('q', 0, -14), -9, 18)
  };

  /* =========================================================
   * Chords: naming, spelling, cadences
   * ========================================================= */

  const TIERS = ['Simple', 'Medium', 'Advanced', 'Uncommon'];
  const tierChips = (list) => list.map(([id, label, tier]) => ({ id: id, label: label, group: TIERS[tier] }));
  const tierDefaults = (list) => list.filter((c) => c[2] === 0).map((c) => c[0]);

  // Naming chords (no key signature). Chip id -> the qualities it adds; inv1/inv2 add inversions of triads.
  const NAMING_CHIPS = [
    ['maj', 'Major', 0], ['min', 'Minor', 0], ['dom7', 'Dominant 7th (G7)', 0],
    ['dim', 'Diminished', 1], ['inv1', '1st inversion', 1], ['inv2', '2nd inversion', 1],
    ['aug', 'Augmented', 2], ['maj7', 'Major 7th', 2], ['min7', 'Minor 7th', 2], ['hdim7', 'Half-diminished 7th', 2],
    ['dim7', 'Diminished 7th', 2], ['add2', 'add 2', 2], ['add4', 'add 4', 2], ['ninth', '9th chords', 2],
    ['eleventh', '11th chords', 2], ['sus', 'sus 2 & sus 4', 2],
    ['it6', 'Italian +6', 2], ['fr6', 'French +6', 2], ['ger6', 'German +6', 2],
    ['thirteenth', '13th chords', 3], ['mmaj7', 'Minor-major 7th', 3], ['sixth', '6th chords', 3], ['domb9', '7♭9', 3]
  ];
  const NAMING_QUALITIES = { ninth: ['dom9', 'maj9', 'min9'], eleventh: ['dom11'], sus: ['sus2', 'sus4'],
    thirteenth: ['dom13'], sixth: ['maj6', 'min6'] };
  // Roots for naming chords; chords that would need double sharps or flats are left out.
  const NAMING_ROOTS = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const TRIADS = ['maj', 'min', 'dim', 'aug'];
  const INVERSION_NAMES = ['root position', '1st inversion', '2nd inversion'];

  // Spelling chords and cadences: chip id = a kind in Theory.kindChords.
  const SPELL_CHIPS = [
    ['I', 'I · i', 0], ['IV', 'IV · iv', 0], ['V', 'V', 0], ['V7', 'V7', 0],
    ['ii', 'ii · ii°', 1], ['iii', 'iii · III', 1], ['vi', 'vi · VI', 1], ['vii', 'vii°', 1], ['cad64', 'Cadential I 6/4', 1],
    ['maj7', 'Major 7ths', 2], ['min7', 'Minor 7ths', 2], ['hdim7', 'Half-diminished 7th', 2], ['dim7', 'vii°7', 2],
    ['aug', 'Augmented', 2], ['it6', 'Italian +6', 2], ['fr6', 'French +6', 2], ['ger6', 'German +6', 2],
    ['add2', 'add 2', 2], ['add4', 'add 4', 2], ['V9', 'V9', 2], ['V11', 'V11', 2],
    ['N6', 'Neapolitan', 3], ['VofV', 'V/V', 3], ['secdom', 'Other secondary dominants', 3], ['borrowed', 'Borrowed chords', 3],
    ['V13', 'V13', 3]
  ];
  const CADENCE_CHIPS = [
    ['pac', 'Perfect authentic (PAC)', 0], ['iac', 'Imperfect authentic (IAC)', 0], ['half', 'Half', 0], ['plagal', 'Plagal', 0],
    ['deceptive', 'Deceptive', 1], ['halfii', 'Half: ii6 – V', 1], ['half64', 'Half: cadential 6/4 – V', 1],
    ['phrygian', 'Phrygian half (minor keys)', 2], ['picardy', 'Picardy third (minor keys)', 2],
    ['minplagal', 'Minor plagal (major keys)', 3], ['deceptiveb6', 'Deceptive to ♭VI (major keys)', 3]
  ];
  // How the chord is named on a spelling card: 'roman' (IV) or 'function' (Subdominant).
  const CHORD_LABELS = [['roman', 'Roman numerals'], ['function', 'Function names']];

  const LETTER_IDX = (name) => T.LETTERS.indexOf(name[0]);

  // Octaves for notes listed from the bass up: each note is the first one above the last.
  function stackUp(names, bassOctave) {
    const out = [];
    let prev = null;
    names.forEach((name) => {
      let oct = prev ? prev.octave : bassOctave;
      if (prev) {
        while (N.diatonic(name[0], oct) <= N.diatonic(prev.name[0], prev.octave)) oct++;
      }
      prev = { name: name, octave: oct };
      out.push(prev);
    });
    return out;
  }
  // The octave for a bass note so it lands closest to staff position `target` in this clef.
  function bassOctaveFor(name, clef, target) {
    let best = 4, bestD = 1e9;
    for (let o = 1; o <= 7; o++) {
      const d = Math.abs(N.staffPos(name[0], o, clef) - target);
      if (d < bestD) { best = o; bestD = d; }
    }
    return best;
  }

  /*
   * Whole-note chords on one staff. chords: [[{ name, octave }, ...], ...] (low to high).
   * opts: { clef, sig: { type, n } | null (no key signature: every accidental is shown), bar: barline between }
   */
  function chordsSvg(chords, opts) {
    const clef = opts.clef || 'treble';
    const head = N.width('noteheadWhole');
    const accW = 11;
    let minY = Infinity, maxY = -Infinity;
    const top = TOP;
    const sig = opts.sig ? keySignature(opts.sig.type, opts.sig.n, top, clef) : { svg: '', end: 30 };
    let x = sig.end + 10;
    let body = '';
    chords.forEach((notes, ci) => {
      const placed = notes.map((n) => {
        const pos = N.staffPos(n.name[0], n.octave, clef);
        const acc = opts.sig ? T.shownAcc(n.name, opts.sig) : T.accOf(n.name);
        return { pos: pos, acc: acc };
      }).sort((a, b) => a.pos - b.pos);
      // Seconds: the upper note of a second goes to the right of the stem side.
      let prev = null;
      placed.forEach((p) => {
        // (A unison also needs its second head beside the first.)
        p.shift = !!(prev && p.pos - prev.pos <= 1 && !prev.shift);
        prev = p;
      });
      // Accidentals in columns, top down, so ones within a 6th don't collide.
      const cols = [];
      placed.slice().reverse().forEach((p) => {
        if (!p.acc) return;
        let c = 0;
        while (cols[c] && cols[c].some((q) => Math.abs(q - p.pos) < 6)) c++;
        (cols[c] = cols[c] || []).push(p.pos);
        p.col = c;
      });
      const accSpace = cols.length * accW;
      const cx = x + accSpace + head / 2 + 2;
      placed.forEach((p) => {
        const y = N.posToY(p.pos, top);
        const nx = cx + (p.shift ? head : 0);
        body += N.ledgers(nx, p.pos, top) + N.notehead(nx, y, 'whole');
        if (p.acc) {
          const w = N.accidentalWidth(p.acc);
          body += N.accidental(p.acc, cx - head / 2 - 2 - p.col * accW - w, y);
        }
        minY = Math.min(minY, y - (p.acc === 'b' || p.acc === 'bb' ? 18 : 13));
        maxY = Math.max(maxY, y + 8);
      });
      const anyShift = placed.some((p) => p.shift);
      x = cx + head / 2 + (anyShift ? head : 0) + 14;
      if (opts.bar && ci < chords.length - 1) { body += N.barline(x, top, top + 40); x += 12; }
    });
    const width = Math.max(130, x + 4);
    const vbTop = Math.min(NOTE_VB_TOP + 8, Math.floor(minY));
    const vbBottom = Math.max(NOTE_VB_BOTTOM - 8, Math.ceil(maxY));
    return N.svg('0 ' + vbTop + ' ' + width + ' ' + (vbBottom - vbTop),
      N.staff(3, width - 3, top) + N.clef(clef, 6, top) + sig.svg + body);
  }

  // A chord from the bass up, centred on the staff.
  function placeChord(namesBassUp, clef, steps) {
    const span = steps != null ? steps : 2 * (namesBassUp.length - 1);
    const octave = bassOctaveFor(namesBassUp[0], clef, Math.round(4 - span / 2));
    return stackUp(namesBassUp, octave);
  }

  // Augmented sixths for naming: spelled from the bass in each major key (the same notes work in its minor).
  const AUG6_NAMES = { it6: 'Italian 6th', fr6: 'French 6th', ger6: 'German 6th' };
  function aug6NamingItems(kindId) {
    const out = [];
    T.KEYS.filter((k) => k.mode === 'major').forEach((key) => {
      const ch = T.kindChords(kindId, key)[0];
      if (!ch || ch.notes.some((n) => !n || n.length > 2)) return;   // no double sharps or flats
      const dom = T.above(key.tonic, 4, 7);
      out.push({
        id: 'chord-name-' + kindId + '-' + key.tonic,
        draw: (clef) => chordsSvg([placeChord(ch.notes, clef, 5)], { clef: clef, sig: null }),
        say: AUG6_NAMES[kindId],
        detail: T.rnText(ch.rn) + ' in ' + pretty(key.tonic) + ' major or minor · ' + T.prettyList(ch.notes) +
          ' · resolves to V (' + pretty(dom) + ')'
      });
    });
    return out;
  }

  function namingPool(sel) {
    let qualities = [];
    let aug6 = [];
    sel.forEach((id) => {
      if (id === 'inv1' || id === 'inv2') return;
      if (AUG6_NAMES[id]) { aug6 = aug6.concat(aug6NamingItems(id)); return; }
      qualities = qualities.concat(NAMING_QUALITIES[id] || [id]);
    });
    const inversions = [0].concat(sel.indexOf('inv1') >= 0 ? [1] : [], sel.indexOf('inv2') >= 0 ? [2] : []);
    // Inversions on their own: major and minor triads.
    if (!qualities.length && (!aug6.length || inversions.length > 1)) qualities = ['maj', 'min'];
    const out = aug6;
    qualities.forEach((q) => {
      NAMING_ROOTS.forEach((root) => {
        const notes = T.chordNotes(root, q);
        if (!notes || notes.some((n) => n.length > 2)) return;
        const invs = TRIADS.indexOf(q) >= 0 ? inversions : [0];
        // With inversion chips picked, triads come in those inversions (root position too only if no other).
        const useInvs = invs.length > 1 ? invs.slice(1).concat(sel.some((id) => TRIADS.indexOf(id) >= 0) ? [0] : []) : invs;
        useInvs.forEach((inv) => {
          const bassUp = notes.slice(inv).concat(notes.slice(0, inv));
          const span = TRIADS.indexOf(q) >= 0 ? 4 : T.chordSteps(q).pop();
          const name = T.chordName(root, q);
          out.push({
            id: 'chord-name-' + root + q + inv,
            draw: (clef) => chordsSvg([placeChord(bassUp, clef, span)], { clef: clef, sig: null }),
            say: name,
            detail: T.QUALITIES[q].name + (inv ? ', ' + INVERSION_NAMES[inv] : '') + ' · ' + T.prettyList(notes)
          });
        });
      });
    });
    return out;
  }

  const keyText = (key) => T.keyName(key);

  // A Roman numeral (or function name) and "in C major", as big text.
  function chordPromptSvg(ch, key, labels) {
    const fs = "'Times New Roman', Times, Georgia, serif";
    let main;
    if (labels === 'function') {
      const words = ch.fn.split(' ');
      // Long names go on two lines.
      const lines = [];
      if (ch.fn.length > 14 && words.length > 1) {
        let best = 1, bestD = 1e9;
        for (let i = 1; i < words.length; i++) {
          const d = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length);
          if (d < bestD) { best = i; bestD = d; }
        }
        lines.push(words.slice(0, best).join(' '), words.slice(best).join(' '));
      } else lines.push(ch.fn);
      const longest = Math.max.apply(null, lines.map((l) => l.length));
      const size = Math.min(26, Math.floor(230 / longest));
      main = lines.map((l, i) => N.text(65, (lines.length === 1 ? 62 : 50) + i * (size + 2), l, size, { italic: false })).join('');
    } else {
      const rn = ch.rn;
      const figs = rn.figs;
      const stacked = figs.length === 2 && /^\d$/.test(figs[0]);
      const base = esc(rn.pre + rn.base) + (rn.q ? '<tspan font-size="26">' + esc(rn.q) + '</tspan>' : '') +
        (rn.maj7 ? '<tspan font-size="24">M</tspan>' : '');
      const sup = stacked ? '' : figs.length ? '<tspan font-size="22" dy="-16">' + esc(figs.join('')) + '</tspan>' : '';
      const post = rn.post ? '<tspan font-size="36"' + (sup ? ' dy="16"' : '') + '>' + esc(rn.post) + '</tspan>' : '';
      const len = (rn.pre + rn.base + rn.q).length + (rn.post.length) + (stacked ? 1 : figs.join('').length * 0.6);
      const size = Math.min(46, Math.floor(160 / Math.max(2.2, len)));
      main = '<text x="65" y="68" font-size="' + size + '" font-family="' + fs + '" font-weight="bold" text-anchor="middle">' +
        base + sup + post + '</text>';
      if (stacked) {
        // Figured-bass 6 over 4, right of the numeral.
        const w = (rn.pre + rn.base + rn.q).length * size * 0.33;
        main += N.text(65 + w + 7, 50, figs[0], 20, { italic: false }) + N.text(65 + w + 7, 68, figs[1], 20, { italic: false });
      }
    }
    return card(main + N.text(65, 98, 'in ' + esc(keyText(key)), 15, { italic: true, weight: 'normal' }));
  }
  function esc(str) { return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  function spellingPool(sel, s) {
    const labels = s.chordLabels === 'function' ? 'function' : 'roman';
    const out = [];
    keyList(s.spellKeys).forEach((key) => {
      sel.forEach((kind) => {
        T.kindChords(kind, key).forEach((ch, i) => {
          if (!ch.notes || ch.notes.indexOf(null) >= 0) return;
          const rnText = T.rnText(ch.rn);
          out.push({
            id: 'chord-spell-' + key.id + kind + i,
            svg: chordPromptSvg(ch, key, labels),
            say: T.prettyList(T.bassUp(ch)),
            detail: (labels === 'function' ? rnText : ch.fn) + ' in ' + keyText(key) +
              (ch.inversion || ch.fixedOrder ? ' · from the bass up' : '')
          });
        });
      });
    });
    return out;
  }

  // One chord voiced for a cadence: [kind, chord index, bass member, top member]; members are
  // 0 root, 1 3rd, 2 5th, 3 7th. The upper three voices are in close position with the top member
  // highest: triads double one note, 7th chords use the other three notes.
  function voiceChord(key, spec) {
    const ch = T.kindChords(spec[0], key)[spec[1]];
    const m = ch.notes.length, bass = spec[2], topM = spec[3];
    let order = [];
    for (let i = 1; i <= m; i++) order.push((topM + i) % m);   // ends with the top member
    if (m > 3) {
      const at = order.indexOf(bass);
      if (at >= 0 && at < order.length - 1) order.splice(at, 1);
    }
    order = order.slice(-3);
    return { chord: ch, names: [ch.notes[bass]].concat(order.map((i) => ch.notes[i])) };
  }

  function cadencePool(sel, s) {
    const labels = s.chordLabels === 'function' ? 'function' : 'roman';
    const out = [];
    keyList(s.cadenceKeys).forEach((key) => {
      sel.forEach((id) => {
        const cad = T.CADENCES[id];
        if (!cad || (cad.modes && cad.modes.indexOf(key.mode) < 0)) return;
        cad.variants.forEach((v, vi) => {
          const a = voiceChord(key, v.a), b = voiceChord(key, v.b);
          const name = (c) => (labels === 'function' ? c.chord.fn : T.rnText(c.chord.rn));
          out.push({
            id: 'cadence-' + key.id + id + vi,
            draw: (clef) => {
              const first = placeChord(a.names, clef, 10);
              // The second chord's bass goes as close as it can to the first one's.
              const target = N.staffPos(first[0].name[0], first[0].octave, clef);
              const second = stackUp(b.names, bassOctaveFor(b.names[0], clef, target));
              return chordsSvg([first, second], { clef: clef, sig: key.sig, bar: true });
            },
            say: cad.name,
            detail: name(a) + ' → ' + name(b) + ' in ' + keyText(key) + ' · ' + v.note
          });
        });
      });
    });
    return out;
  }

  /* =========================================================
   * Categories and subcategories
   * ========================================================= */

  /*
   * Symbol buttons: a small copy of the card's picture. Cards that are only words (pizz., D.C. al Fine)
   * show the words in the same italic serif instead.
   */
  const CHIP_CROP = { x: 30, y: 16, w: 70, h: 80 };          // around a note in the middle of the card
  const WIDE_CHIP_CROP = { x: 2, y: 14, w: 126, h: 90 };      // whole-width cards (repeats, tuplets)
  function cardText(svgStr) {
    const m = svgStr.match(/<g fill="[^"]*" stroke="none">(<text [^>]*>([^<]*)<\/text>)<\/g><\/svg>$/);
    if (!m || /SayItOnBeat/.test(m[1])) return null;
    return { text: m[2], italic: /font-style="italic"/.test(m[1]) };
  }
  function symbolChip(it, crop) {
    if (it.chipHtml) return it.chipHtml;
    const t = cardText(it.svg);
    if (t) return '<span class="mark-text' + (t.italic ? '' : ' upright') + '">' + t.text + '</span>';
    const c = it.chipCrop || crop || CHIP_CROP;
    return it.svg.replace('class="notation"', 'class="chip-art card-art"')
      .replace(/viewBox="[^"]*"/, 'viewBox="' + [c.x, c.y, c.w, c.h].join(' ') + '"');
  }

  // Chips are the cards themselves; the pool is the picked cards. def.symbols: show symbols on the buttons.
  function itemSubcat(def, items) {
    return Object.assign(def, {
      chips: items.map((it) => ({ id: it.id, label: it.chip || it.say, group: it.group,
        html: def.symbols ? symbolChip(it, def.chipCrop) : it.chipHtml, cls: def.symbols ? 'sym-chip' : '' })),
      pool: (sel) => items.filter((it) => sel.indexOf(it.id) >= 0)
    });
  }

  /*
   * The setup screen has two tabs. Rhythm cards last a whole measure, so rhythms are
   * practiced on their own; everything else can be mixed together in one round.
   */
  const TABS = [
    { id: 'cards', name: 'Notes, reading & markings', desc: 'Everything you turn on here is mixed together in each round.' },
    { id: 'rhythms', name: 'Rhythms', desc: 'Rhythms are practiced on their own: each card is one full measure.' }
  ];

  // Chip ids that moved to another subcategory, so saved picks follow them: { chipId: [from, to] }.
  const RELOCATED_CHIPS = {
    'sym-repeat': ['symbols', 'repeats'], 'sym-endings': ['symbols', 'repeats'], 'sym-dc': ['symbols', 'repeats'],
    'sym-fine': ['symbols', 'repeats'], 'sym-coda': ['symbols', 'repeats'], 'sym-final': ['symbols', 'repeats'],
    'sym-fermata': ['symbols', 'pauses'], 'adv-fshort': ['advsymbols', 'pauses'], 'adv-flong': ['advsymbols', 'pauses'],
    'adv-caesura': ['advsymbols', 'pauses']
  };

  const CATEGORIES = [
    { id: 'notes', tab: 'cards', name: 'Note names', subcats: [
      { id: 'home', name: 'Home position', desc: 'G A B C · D E F♯ G · A B C♯ D · E F♯ G♯ A B, on the strings you pick',
        chips: STRINGS.map((s) => ({ id: s.id, label: s.name })), pool: (sel, s) => homePool(sel, s),
        // Only the strings the instrument has.
        chipState: (id, s) => (instrumentOf(s).strings.indexOf(id) < 0 ? 'hidden' : ''),
        describe: homeSummary, options: [{ setting: 'noteAnswer', label: 'Class says', choices: NOTE_ANSWERS }] },
      { id: 'diatonic', name: 'Diatonic note names', toggle: true, desc: 'A scale, chromatic in a range, or notes you pick',
        chips: [{ id: 'on', label: 'On' }], pool: (sel, s) => pitchPool(s),
        options: [{ setting: 'noteAnswer', label: 'Class says', choices: NOTE_ANSWERS }] }
    ] },
    { id: 'values', tab: 'cards', name: 'Note values', subcats: [
      itemSubcat({ id: 'basicvalues', symbols: true, name: 'Basic note values', desc: 'Eighth, quarter, half and whole notes and their rests' }, BASIC_VALUES),
      itemSubcat({ id: 'advvalues', symbols: true, name: 'Advanced note values', desc: 'Dotted notes, sixteenths, triplets' }, ADVANCED_VALUES),
      itemSubcat({ id: 'tuplets', symbols: true, chipCrop: WIDE_CHIP_CROP, name: 'Tuplets & grace notes', desc: 'Duplets to septuplets, grace notes, appoggiaturas, acciaccaturas' }, TUPLET_ITEMS),
      itemSubcat({ id: 'timesigs', name: 'Naming time signatures', desc: 'Just a time signature: name it (“Three four”, “Common time”)' }, TIMESIG_ITEMS)
    ] },
    { id: 'reading', tab: 'cards', name: 'Note reading', subcats: [
      itemSubcat({ id: 'keysigs', name: 'Key signatures', desc: 'Name the major key' }, KEY_ITEMS),
      { id: 'degrees', name: 'Scale degrees', desc: 'Name the scale degree of each note. One key is recommended; more than one is difficult!',
        chips: DEGREE_IDS.map((d) => ({ id: d, label: 'Scale degree ' + d, html: degreeMark(d), cls: 'deg-chip' })),
        pool: (sel, s) => degreePool(sel, s), keyPicker: 'degreeKeys' },
      { id: 'intervals', name: 'Intervals', desc: 'Two notes of a key, unison to a 10th: name the interval (“Major 3rd”).<span class="kbd-only"> <kbd>Shift</kbd>-click to pick a range.</span>',
        chips: T.INTERVALS.map((iv) => ({ id: iv.id, label: iv.name, html: iv.chip, cls: 'iv-chip' })),
        pool: (sel, s) => intervalPool(sel, s), keyPicker: 'intervalKeys',
        options: [{ setting: 'intervalStyle', label: 'Notes', choices: INTERVAL_STYLES }] }
    ] },
    { id: 'chords', tab: 'cards', name: 'Chords', subcats: [
      { id: 'chordnames', name: 'Naming chords', desc: 'A chord in notation, no key signature: name it (“D minor”, “G7”)',
        chips: tierChips(NAMING_CHIPS), defaults: tierDefaults(NAMING_CHIPS), pool: (sel) => namingPool(sel) },
      { id: 'chordspell', name: 'Spelling chords', desc: 'A Roman numeral in a key (“IV in C major”): spell it from the bass up (“F A C”)',
        chips: tierChips(SPELL_CHIPS), defaults: tierDefaults(SPELL_CHIPS), pool: (sel, s) => spellingPool(sel, s),
        keyPicker: 'spellKeys', options: [{ setting: 'chordLabels', label: 'Show', choices: CHORD_LABELS }] },
      { id: 'cadences', name: 'Cadences', desc: 'Two chords in a key: name the cadence',
        chips: tierChips(CADENCE_CHIPS), defaults: tierDefaults(CADENCE_CHIPS), pool: (sel, s) => cadencePool(sel, s),
        keyPicker: 'cadenceKeys', options: [{ setting: 'chordLabels', label: 'Answers use', choices: CHORD_LABELS }] }
    ] },
    { id: 'markings', tab: 'cards', name: 'Markings', subcats: [
      itemSubcat({ id: 'dynamics', symbols: true, name: 'Dynamics', desc: 'pp to ff, sfz, fp, hairpins' }, DYNAMIC_ITEMS),
      itemSubcat({ id: 'symbols', symbols: true, name: 'Bowing & articulation', desc: 'Bowings, slurs and ties, articulations, pizz. and arco, accidentals' }, SYMBOL_ITEMS),
      itemSubcat({ id: 'tempo', name: 'Tempo', desc: 'Grave to Prestississimo, and tempo changes', defaults: DEFAULT_TEMPOS }, TEMPO_ITEMS),
      itemSubcat({ id: 'pauses', symbols: true, name: 'Pauses & fermatas', desc: 'Fermatas, lunga, caesura, breath mark, general pause' }, PAUSE_ITEMS),
      itemSubcat({ id: 'repeats', symbols: true, chipCrop: WIDE_CHIP_CROP, name: 'Repeats', desc: 'Repeat signs, endings, measure repeat, D.C. and D.S., Fine, Coda, Segno' }, REPEAT_ITEMS),
      itemSubcat({ id: 'ornaments', symbols: true, name: 'Ornaments', desc: 'Trills, mordents, turns and other ornaments', defaults: DEFAULT_ORNAMENTS }, ORNAMENT_ITEMS),
      itemSubcat({ id: 'clefs', symbols: true, name: 'Clefs', desc: 'Treble, bass, alto, tenor' }, CLEF_ITEMS),
      itemSubcat({ id: 'advsymbols', symbols: true, name: 'Advanced & contemporary', desc: 'More accents, Bartók pizz, harmonics, tremolo, glissando, extended techniques',
        defaults: DEFAULT_ADVANCED }, ADVANCED_SYMBOLS)
    ] },
    { id: 'rhythms', tab: 'rhythms', name: 'Rhythms', subcats: [
      { id: 'meters', name: 'Time signatures', rhythm: true, desc: 'One measure per card. With several, each round uses the next one.',
        chips: [].concat.apply([], Object.keys(METER_GROUPS).map((g) => METER_GROUPS[g].map((id) =>
          ({ id: id, label: meterName(id), html: meterChip(id), cls: 'ts-chip', group: g })))),
        defaults: DEFAULT_METERS },
      { id: 'rhythmvalues', name: 'Note values', fixed: true,
        desc: 'The notes and rests the rhythms can use. Greyed out: they don’t fit the time signatures you picked.',
        chips: RHYTHM_VALUES.map(([id, label]) => ({ id: id, label: label, html: RHYTHM_VALUE_ART[id](), cls: 'value-chip' })),
        defaults: DEFAULT_RHYTHM_VALUES,
        // A value that fits none of the picked time signatures can't be used.
        chipState: (id, s) => {
          const meters = (s.sel && s.sel.meters) || [];
          if (!meters.length) return '';
          return meters.some((m) => METERS[m] && valueFits(id, m)) ? '' : 'disabled';
        } }
    ] }
  ];

  const SUBCATS = [];
  CATEGORIES.forEach((c) => c.subcats.forEach((sc) => { sc.cat = c.id; sc.tab = c.tab; SUBCATS.push(sc); }));
  const subById = (id) => SUBCATS.find((sc) => sc.id === id);

  global.Content = {
    INSTRUMENTS: INSTRUMENTS, INSTRUMENT_IDS: INSTRUMENT_IDS, CLEF_MODES: CLEF_MODES, clefFor: clefFor, resolve: resolve,
    KEYS: T.KEYS, DEGREE_IDS: DEGREE_IDS, CHORD_LABELS: CHORD_LABELS,
    TABS: TABS, CATEGORIES: CATEGORIES, SUBCATS: SUBCATS, subById: subById, STRINGS: STRINGS, RELOCATED_CHIPS: RELOCATED_CHIPS,
    METERS: METERS, METER_IDS: METER_IDS, meterName: meterName, rhythmItem: rhythmItem, DEFAULT_RHYTHM_VALUES: DEFAULT_RHYTHM_VALUES,
    SCALE_CHOICES: SCALE_CHOICES, RANGE_NOTES: RANGE_NOTES, PICK_ROWS: PICK_ROWS,
    pretty: pretty, pitchPool: pitchPool, pitchSummary: pitchSummary,
    RANGE_PRESETS: RANGE_PRESETS, rangeFor: rangeFor, midiLabel: midiLabel, rangeMidi: rangeMidi, fingering: fingering
  };
})(window);
