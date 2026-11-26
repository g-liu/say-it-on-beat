/*
 * content.js — the categories and the cards in them.
 *
 * Every card is { id, svg, say, detail }:
 *   say    — what the class says out loud (shown when answers are revealed)
 *   detail — a short teaching note shown under it
 */
(function (global) {
  'use strict';

  const N = global.Notation;

  // Single-beat cards share one frame so every card in a round is drawn at the same scale.
  const CARD_VB = '0 12 130 100';
  const TOP = 40;                 // top staff line
  const MID = TOP + 20;           // middle staff line

  const SHARP = '♯', FLAT = '♭';
  const pretty = (name) => name.replace('#', SHARP).replace('b', FLAT);

  function card(body) { return N.svg(CARD_VB, body); }
  function staff5() { return N.staff(3, 127, TOP); }

  /* =========================================================
   * Note names on the violin (first / "home" position)
   * ========================================================= */

  const STRINGS = [
    { id: 'G', name: 'G string', open: 55 },
    { id: 'D', name: 'D string', open: 62 },
    { id: 'A', name: 'A string', open: 69 },
    { id: 'E', name: 'E string', open: 76 }
  ];
  // Semitones above the open string -> finger in first position.
  const FINGER = ['open', 'low 1st', '1st', 'low 2nd', 'high 2nd', '3rd', 'high 3rd', '4th'];
  const NATURAL_PC = { 0: 'C', 2: 'D', 4: 'E', 5: 'F', 7: 'G', 9: 'A', 11: 'B' };
  const SHARP_PC = { 1: 'C#', 3: 'D#', 6: 'F#', 8: 'G#', 10: 'A#' };
  const FLAT_PC = { 1: 'Db', 3: 'Eb', 6: 'Gb', 8: 'Ab', 10: 'Bb' };

  function noteSvg(name, octave) {
    const step = name[0];
    const acc = name.length > 1 ? name[1] : '';
    const pos = N.staffPos(step, octave, 'treble');
    const y = N.posToY(pos, TOP);
    const x = 88;
    const n = N.note(x, y, { dur: 'q', up: pos < 4 });
    return card(staff5() + N.clef('treble', 6, TOP) + N.ledgers(x, pos, TOP) +
      N.accidental(acc, acc === '#' ? 66 : 69, y) + n.svg);
  }

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
          say: pretty(name).replace(SHARP, ' sharp'),
          detail: pretty(name) + octave + ' · ' + s.name + ', ' + FINGER[semi] + (semi === 0 ? '' : ' finger')
        });
      });
    });
    return out;
  }

  function notePool(strings, spelling) {
    const map = spelling === 'sharp' ? SHARP_PC : spelling === 'flat' ? FLAT_PC : NATURAL_PC;
    const byMidi = new Map();
    STRINGS.filter((s) => strings.indexOf(s.id) >= 0).forEach((s) => {
      for (let semi = 0; semi <= 7; semi++) {
        const midi = s.open + semi;
        const name = map[midi % 12];
        if (!name) continue;
        const where = s.name + ', ' + FINGER[semi] + (semi === 0 ? '' : ' finger');
        if (!byMidi.has(midi)) byMidi.set(midi, { name: name, octave: Math.floor(midi / 12) - 1, where: [] });
        byMidi.get(midi).where.push(where);
      }
    });
    return Array.from(byMidi.entries()).sort((a, b) => a[0] - b[0]).map(([midi, n]) => ({
      id: 'note-' + spelling + '-' + midi,
      svg: noteSvg(n.name, n.octave),
      say: pretty(n.name).replace(SHARP, ' sharp').replace(FLAT, ' flat'),
      detail: pretty(n.name) + n.octave + ' · ' + n.where.join(' or ')
    }));
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
    if (tupletLabel) s += N.text((stems[0] + stems[stems.length - 1]) / 2, top - 5, tupletLabel, 15);
    return s;
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

  // Dotted eighth beamed to a sixteenth: full beam plus a short stub on the sixteenth.
  function dottedEighthSixteenth() {
    const a = N.note(40, A4, { dur: '8', up: true, noFlag: true, dots: 1 });
    const b = N.note(86, A4, { dur: '16', up: true, noFlag: true });
    const top = A4 - 35;
    return a.svg + b.svg + N.beam(a.stemX, b.stemX, top, 0) + N.rect(b.stemX - 9.6, top + 7.5, 10.25, 5);
  }

  /* =========================================================
   * Key signatures (treble clef)
   * ========================================================= */

  const SHARP_POS = [8, 5, 9, 6, 3, 7, 4];   // F C G D A E B
  const FLAT_POS = [4, 7, 3, 6, 2, 5, 1];    // B E A D G C F
  const KEYS = [
    { key: 'C', minor: 'A', n: 0, type: '' },
    { key: 'G', minor: 'E', n: 1, type: '#' },
    { key: 'D', minor: 'B', n: 2, type: '#' },
    { key: 'A', minor: 'F#', n: 3, type: '#' },
    { key: 'E', minor: 'C#', n: 4, type: '#' },
    { key: 'F', minor: 'D', n: 1, type: 'b' },
    { key: 'Bb', minor: 'G', n: 2, type: 'b' },
    { key: 'Eb', minor: 'C', n: 3, type: 'b' },
    { key: 'Ab', minor: 'F', n: 4, type: 'b' }
  ];

  function keySigSvg(type, count) {
    let s = staff5() + N.clef('treble', 6, TOP);
    const positions = type === '#' ? SHARP_POS : FLAT_POS;
    for (let i = 0; i < count; i++) s += N.accidental(type, 38 + i * 13, N.posToY(positions[i], TOP));
    return card(s);
  }

  const KEY_ITEMS = KEYS.map((k) => {
    const accs = k.n === 0 ? 'no sharps or flats'
      : k.n + ' ' + (k.type === '#' ? 'sharp' : 'flat') + (k.n > 1 ? 's' : '');
    return {
      id: 'key-' + k.key,
      svg: keySigSvg(k.type, k.n),
      say: pretty(k.key) + ' major',
      detail: accs + ' · relative minor: ' + pretty(k.minor) + ' minor'
    };
  });

  /* =========================================================
   * Clefs
   * ========================================================= */

  const CLEF_ITEMS = [
    { id: 'clef-treble', svg: card(staff5() + N.clef('treble', 53, TOP)), say: 'Treble clef', detail: 'G clef · violin music' },
    { id: 'clef-bass', svg: card(staff5() + N.clef('bass', 51, TOP)), say: 'Bass clef', detail: 'F clef · cello and bass' },
    { id: 'clef-alto', svg: card(staff5() + N.clef('alto', 55, TOP)), say: 'Alto clef', detail: 'C clef on the middle line · viola' },
    { id: 'clef-tenor', svg: card(staff5() + N.clef('tenor', 55, TOP)), say: 'Tenor clef', detail: 'C clef on the 4th line · high cello' }
  ];

  /* =========================================================
   * Dynamics
   * ========================================================= */

  function dynCard(str) { return card(N.dynamicText(65, 76, str, 50)); }

  const DYNAMIC_ITEMS = [
    { id: 'dyn-pp', svg: dynCard('pp'), say: 'Pianissimo', detail: 'pp · very soft' },
    { id: 'dyn-p', svg: dynCard('p'), say: 'Piano', detail: 'p · soft' },
    { id: 'dyn-mp', svg: dynCard('mp'), say: 'Mezzo piano', detail: 'mp · medium soft' },
    { id: 'dyn-mf', svg: dynCard('mf'), say: 'Mezzo forte', detail: 'mf · medium loud' },
    { id: 'dyn-f', svg: dynCard('f'), say: 'Forte', detail: 'f · loud' },
    { id: 'dyn-ff', svg: dynCard('ff'), say: 'Fortissimo', detail: 'ff · very loud' },
    { id: 'dyn-sfz', svg: dynCard('sfz'), say: 'Sforzando', detail: 'sfz · a sudden strong accent' },
    { id: 'dyn-fp', svg: dynCard('fp'), say: 'Forte piano', detail: 'fp · loud, then right away soft' },
    { id: 'dyn-cresc', svg: card(N.hairpin(22, 108, 62, true)), say: 'Crescendo', detail: 'gradually louder' },
    { id: 'dyn-decresc', svg: card(N.hairpin(22, 108, 62, false)), say: 'Decrescendo', detail: 'gradually softer · also diminuendo' }
  ];

  /* =========================================================
   * Symbols: bowing, articulation, repeats, signs
   * ========================================================= */

  const B4 = N.posToY(4, TOP), D5 = N.posToY(6, TOP), G4 = N.posToY(2, TOP);

  function articulationCard(mark) {
    const n = N.note(65, D5, { dur: 'q', up: false });
    const y = TOP - 6;
    let m = '';
    if (mark === 'staccato') m = N.staccatoDot(65, y + 1);
    if (mark === 'accent') m = N.accentMark(65, y - 2);
    if (mark === 'tenuto') m = N.tenutoMark(65, y);
    return card(staff5() + n.svg + m);
  }
  function bowCard(down) {
    const n = N.note(65, B4, { dur: 'q', up: false });
    return card(staff5() + n.svg + (down ? N.downBow(58, 22) : N.upBow(59.5, 20)));
  }

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
    { id: 'sym-fermata', svg: card(staff5() + N.note(65, B4, { dur: 'q', up: false }).svg + N.fermata(65, 34)),
      say: 'Fermata', detail: 'hold longer than written' },
    { id: 'sym-pizz', svg: card(N.text(65, 72, 'pizz.', 40)), say: 'Pizzicato', detail: 'pluck the string' },
    { id: 'sym-arco', svg: card(N.text(65, 72, 'arco', 40)), say: 'Arco', detail: 'play with the bow again' },
    { id: 'sym-repeat', svg: card(staff5() + N.startRepeat(8, TOP) +
        N.note(48, A4, { dur: 'q', up: true }).svg + N.note(80, A4, { dur: 'q', up: true }).svg + N.endRepeat(124, TOP)),
      say: 'Repeat sign', detail: 'go back and play it again' },
    { id: 'sym-endings', svg: card(staff5() +
        N.line(6, 26, 60, 26, 1.3) + N.line(6.6, 26, 6.6, 36, 1.3) + N.text(16, 37, '1.', 13, { italic: false }) +
        N.note(34, A4, { dur: 'h', up: true }).svg + N.endRepeat(64, TOP) +
        N.line(70, 26, 124, 26, 1.3) + N.line(70.6, 26, 70.6, 36, 1.3) + N.text(80, 37, '2.', 13, { italic: false }) +
        N.note(98, A4, { dur: 'h', up: true }).svg + N.finalBarline(127, TOP)),
      say: 'First and second endings', detail: '1st time take ending 1, 2nd time skip to ending 2' },
    { id: 'sym-dc', svg: card(N.text(65, 70, 'D.C. al Fine', 21)), say: 'D.C. al Fine', detail: 'back to the beginning, stop at Fine' },
    { id: 'sym-fine', svg: card(N.text(65, 72, 'Fine', 36)), say: 'Fine', detail: '“fee-nay” · the end' },
    { id: 'sym-coda', svg: card(N.g('translate(65,62) scale(1.5)', N.coda(0, 0))), say: 'Coda', detail: 'jump to the ending section' },
    { id: 'sym-sharp', svg: card(N.g('translate(65,62) scale(2.3)', N.accidental('#', -4, 0))), say: 'Sharp', detail: 'raises a note a half step' },
    { id: 'sym-flat', svg: card(N.g('translate(65,68) scale(2.3)', N.accidental('b', -4, 0))), say: 'Flat', detail: 'lowers a note a half step' },
    { id: 'sym-natural', svg: card(N.g('translate(65,62) scale(2.3)', N.accidental('n', -3.3, 0))), say: 'Natural', detail: 'cancels a sharp or flat' },
    { id: 'sym-final', svg: card(staff5() + N.note(50, A4, { dur: 'h', up: true }).svg + N.finalBarline(110, TOP)),
      say: 'Final barline', detail: 'the end of the piece' }
  ];

  /* =========================================================
   * Rhythm measures (one per card, drawn on a one-line staff)
   * ========================================================= */

  const R_VB = '0 6 320 92';
  const R_LINE = 62;
  const R_X0 = 44, R_X1 = 300;

  // len in beats; ev = events { t, dur | rest, dots }; beams: [first, last, level]; count tokens.
  const CELLS = {
    q:    { len: 1, ev: [{ t: 0, dur: 'q' }], count: (b) => [b] },
    ee:   { len: 1, ev: [{ t: 0, dur: '8' }, { t: 0.5, dur: '8' }], beams: [[0, 1, 0]], count: (b) => [b, '&'] },
    qr:   { len: 1, ev: [{ t: 0, rest: 'q' }], count: (b) => ['(' + b + ')'] },
    h:    { len: 2, ev: [{ t: 0, dur: 'h' }], count: (b) => [b, '–'] },
    hr:   { len: 2, ev: [{ t: 0, rest: 'h' }], count: (b) => ['(' + b, (b + 1) + ')'] },
    dh:   { len: 3, ev: [{ t: 0, dur: 'h', dots: 1 }], count: (b) => [b, '–', '–'] },
    w:    { len: 4, ev: [{ t: 0, dur: 'w' }], count: (b) => [b, '–', '–', '–'] },
    ssss: { len: 1, ev: [0, 0.25, 0.5, 0.75].map((t) => ({ t: t, dur: '16' })), beams: [[0, 3, 0], [0, 3, 1]],
            count: (b) => [b, 'e', '&', 'a'] },
    e_ss: { len: 1, ev: [{ t: 0, dur: '8' }, { t: 0.5, dur: '16' }, { t: 0.75, dur: '16' }], beams: [[0, 2, 0], [1, 2, 1]],
            count: (b) => [b, '&', 'a'] },
    ss_e: { len: 1, ev: [{ t: 0, dur: '16' }, { t: 0.25, dur: '16' }, { t: 0.5, dur: '8' }], beams: [[0, 2, 0], [0, 1, 1]],
            count: (b) => [b, 'e', '&'] },
    trip: { len: 1, ev: [0, 1 / 3, 2 / 3].map((t) => ({ t: t, dur: '8' })), beams: [[0, 2, 0]], tuplet: '3',
            count: (b) => [b, 'trip', 'let'] },
    dq_e: { len: 2, ev: [{ t: 0, dur: 'q', dots: 1 }, { t: 1.5, dur: '8' }], count: (b) => [b, '–', '&'] }
  };

  const BASIC_WEIGHTS = { q: 4, ee: 4, qr: 1.4, h: 2, hr: 0.5, dh: 0.7, w: 0.4 };
  const ADVANCED_WEIGHTS = Object.assign({}, BASIC_WEIGHTS, { ssss: 1.5, e_ss: 1, ss_e: 1, trip: 1, dq_e: 1.3 });

  function cellFits(name, beat, meter) {
    const c = CELLS[name];
    if (beat + c.len > meter) return false;
    if (name === 'dh') return meter === 3 && beat === 0;
    if (name === 'w') return meter === 4 && beat === 0;
    if (name === 'hr') return meter === 4 && (beat === 0 || beat === 2);
    if (c.len === 2) return meter === 4 ? beat === 0 || beat === 2 : beat <= 1;
    return true;
  }

  function weightedPick(weights, rng) {
    const names = Object.keys(weights);
    let total = 0;
    names.forEach((n) => { total += weights[n]; });
    let x = rng() * total;
    for (let i = 0; i < names.length; i++) { x -= weights[names[i]]; if (x <= 0) return names[i]; }
    return names[names.length - 1];
  }

  function makeMeasure(meter, level, rng) {
    const all = level === 'advanced' ? ADVANCED_WEIGHTS : BASIC_WEIGHTS;
    for (let attempt = 0; attempt < 30; attempt++) {
      const cells = [];
      let beat = 0;
      while (beat < meter) {
        const w = {};
        Object.keys(all).forEach((n) => { if (cellFits(n, beat, meter)) w[n] = all[n]; });
        const name = weightedPick(w, rng);
        cells.push({ name: name, beat: beat });
        beat += CELLS[name].len;
      }
      const rests = cells.filter((c) => CELLS[c.name].ev[0].rest).length;
      if (rests < cells.length && !(rests >= 2 && cells.length <= 3)) return cells;
    }
    return [{ name: meter === 3 ? 'dh' : 'w', beat: 0 }];
  }

  function rhythmSvg(cells, meter) {
    const bw = (R_X1 - R_X0) / meter;
    let s = N.singleLine(6, 312, R_LINE) + N.barline(312, R_LINE - 20, R_LINE + 20, 1.6);
    s += N.text(22, R_LINE - 4, String(meter), 30, { italic: false, weight: '900' }) +
      N.text(22, R_LINE + 26, '4', 30, { italic: false, weight: '900' });
    const stemTop = R_LINE - 35;
    cells.forEach((c) => {
      const cell = CELLS[c.name];
      const stems = [];
      cell.ev.forEach((e) => {
        const x = R_X0 + (c.beat + e.t) * bw + 12;
        if (e.rest) {
          s += N.rest(e.rest, x + 2, e.rest === 'w' ? R_LINE + 10 : R_LINE);
          return;
        }
        const n = N.note(x, R_LINE, { dur: e.dur, up: true, dots: e.dots || 0, dotUp: true, noFlag: !!cell.beams });
        s += n.svg;
        stems.push(n.stemX);
      });
      (cell.beams || []).forEach(([a, b, level]) => {
        if (a === b) return;
        s += N.beam(stems[a], stems[b], stemTop, level);
      });
      if (cell.tuplet) s += N.text((stems[0] + stems[stems.length - 1]) / 2, stemTop - 5, cell.tuplet, 16);
    });
    return N.svg(R_VB, s, 'wide');
  }

  function rhythmItem(meter, level, rng) {
    const cells = makeMeasure(meter, level, rng);
    const tokens = [];
    cells.forEach((c) => {
      const t = CELLS[c.name].count(c.beat + 1);
      for (let i = 0; i < t.length; i++) tokens.push(String(t[i]));
    });
    return {
      id: 'rhythm-' + meter + '-' + cells.map((c) => c.name).join('.'),
      svg: rhythmSvg(cells, meter),
      say: tokens.join(' '),
      detail: 'count it, then clap or play it'
    };
  }

  /* =========================================================
   * Category list
   * ========================================================= */

  const CATEGORIES = [
    { id: 'notes', name: 'Note names', desc: 'Home position: G A B C · D E F♯ G · A B C♯ D · E F♯ G♯ A B',
      kind: 'single', strings: true, pool: (s) => homePool(s.strings) },
    { id: 'values', name: 'Basic note values', desc: 'Eighth, quarter, half, whole and their rests', kind: 'single',
      pool: () => BASIC_VALUES },
    { id: 'advvalues', name: 'Advanced note values', desc: 'Dotted notes, triplets, sixteenths', kind: 'single',
      pool: () => ADVANCED_VALUES },
    { id: 'sharps', name: 'Note names with sharps', desc: 'Sharps in home position', kind: 'single', strings: true,
      pool: (s) => notePool(s.strings, 'sharp') },
    { id: 'flats', name: 'Note names with flats', desc: 'Flats in home position', kind: 'single', strings: true,
      pool: (s) => notePool(s.strings, 'flat') },
    { id: 'keys', name: 'Key signatures', desc: 'Up to 4 sharps or 4 flats', kind: 'single',
      pool: () => KEY_ITEMS },
    { id: 'clefs', name: 'Clefs', desc: 'Treble, bass, alto, tenor', kind: 'single',
      pool: () => CLEF_ITEMS },
    { id: 'r34', name: 'Triple meter rhythms', desc: 'One measure of 3/4 per card', kind: 'meter3', rhythm: true,
      make: (s, rng) => rhythmItem(3, s.rhythmLevel, rng) },
    { id: 'r44', name: 'Double meter rhythms', desc: 'One measure of 4/4 per card', kind: 'meter4', rhythm: true,
      make: (s, rng) => rhythmItem(4, s.rhythmLevel, rng) },
    { id: 'dynamics', name: 'Dynamics', desc: 'pp to ff, sfz, fp, hairpins', kind: 'single',
      pool: () => DYNAMIC_ITEMS },
    { id: 'symbols', name: 'Symbols', desc: 'Bowing, articulation, dynamics, repeats', kind: 'single',
      // Dynamics are symbols too, unless the Dynamics category is already in the mix.
      pool: (s) => (s.categories && s.categories.indexOf('dynamics') >= 0 ? SYMBOL_ITEMS : SYMBOL_ITEMS.concat(DYNAMIC_ITEMS)) }
  ];

  function byId(id) { return CATEGORIES.find((c) => c.id === id); }

  // One random card from a category.
  function pick(cat, settings, rng) {
    if (cat.make) return cat.make(settings, rng);
    const pool = cat.pool(settings);
    return pool[Math.floor(rng() * pool.length)];
  }

  global.Content = { CATEGORIES: CATEGORIES, STRINGS: STRINGS, byId: byId, pick: pick };
})(window);
