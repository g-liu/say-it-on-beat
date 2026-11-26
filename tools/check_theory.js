#!/usr/bin/env node
/*
 * Prints every answer the chord, cadence and interval cards can give, so the music theory can be
 * checked by eye:   node tools/check_theory.js [keys...]     (e.g. C:major A:minor; default: all keys)
 */
'use strict';
require('../js/theory.js');
const T = globalThis.Theory;
const KINDS = ['I', 'IV', 'V', 'V7', 'ii', 'iii', 'vi', 'vii', 'cad64', 'maj7', 'min7', 'hdim7', 'dim7', 'aug',
  'add2', 'add4', 'V9', 'V11', 'it6', 'fr6', 'ger6', 'N6', 'VofV', 'secdom', 'borrowed', 'V13'];
const keys = process.argv.length > 2 ? process.argv.slice(2).map(T.keyById) : T.KEYS;
let problems = 0;
keys.forEach((key) => {
  console.log('\n== ' + T.keyName(key) + ' ==  scale: ' + T.prettyList(T.scaleOf(key).map((n) => n.name)));
  KINDS.forEach((kind) => {
    T.kindChords(kind, key).forEach((ch) => {
      const bad = !ch.notes || ch.notes.indexOf(null) >= 0;
      if (bad) problems++;
      console.log('  ' + kind.padEnd(9) + T.rnText(ch.rn).padEnd(10) + (bad ? 'NEEDS TRIPLE ACCIDENTALS' : T.prettyList(T.bassUp(ch))).padEnd(22) + ch.fn);
    });
  });
  Object.keys(T.CADENCES).forEach((id) => {
    const c = T.CADENCES[id];
    if (c.modes && c.modes.indexOf(key.mode) < 0) return;
    c.variants.forEach((v) => {
      const a = T.kindChords(v.a[0], key)[v.a[1]], b = T.kindChords(v.b[0], key)[v.b[1]];
      console.log('  cadence ' + c.short.padEnd(6) + T.rnText(a.rn) + ' → ' + T.rnText(b.rn) + '  (' + T.prettyList(a.notes) + ' → ' + T.prettyList(b.notes) + ')  ' + c.name);
    });
  });
  const iv = T.INTERVALS.map((i) => i.id + ': ' + T.intervalsInKey(key, i).map((p) => T.pretty(p.low) + '-' + T.pretty(p.high)).join(' ')).join(' | ');
  console.log('  intervals ' + iv);
});
console.log('\nQualities from every root:');
['C', 'C#', 'Db', 'F#', 'Bb', 'B', 'Ab'].forEach((r) => {
  console.log('  ' + Object.keys(T.QUALITIES).map((q) => T.chordName(r, q) + '=' + (T.chordNotes(r, q) ? T.prettyList(T.chordNotes(r, q)) : '—')).join('; '));
});
if (problems) { console.log('\n' + problems + ' chords need triple accidentals (they are left out of the cards)'); }
