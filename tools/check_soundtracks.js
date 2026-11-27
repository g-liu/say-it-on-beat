#!/usr/bin/env node
/*
 * Checks every soundtrack in js/soundtracks.js in every kind of meter: pattern lengths, slots
 * without a voice, notes out of range, and that every beat has something on it.
 *   node tools/check_soundtracks.js
 */
'use strict';
require('../js/soundtracks.js');
const S = globalThis.Soundtracks;
const METERS = {
  '2/4': [[1, 1], [2, 2]], '3/4': [[1, 1, 1], [2, 2, 2]], '4/4': [[1, 1, 1, 1], [2, 2, 2, 2]], '5/4': [[1, 1, 1, 1, 1], [2, 2, 2, 2, 2]],
  '6/8': [[1, 1], [3, 3]], '7/8': [[1, 1, 1.5], [2, 2, 3]], '9/8': [[1, 1, 1], [3, 3, 3]], '12/8': [[1, 1, 1, 1], [3, 3, 3, 3]]
};
const PULSE = ['kick', 'kendang', 'cowbell', 'ride', 'tumba', 'chord', 'bass', 'rim', 'snare', 'clap', 'hat'];
let problems = 0;
const fail = (msg) => { problems++; console.log('  PROBLEM: ' + msg); };

S.LIST.forEach((tr) => {
  console.log('\n== ' + tr.name + ' ==');
  const used = new Set();
  [].concat(Object.values(tr.simple), Object.values(tr.compound)).forEach((r) => Object.keys(r).forEach((k) => used.add(k)));
  Object.values(tr.bars || {}).forEach((b) => Object.keys(b).forEach((k) => used.add(k)));
  tr.fill.forEach((f) => used.add(f[1]));
  ['count', 'countSub', 'crash', 'bell', 'kick'].forEach((k) => used.add(k));
  used.forEach((slot) => { if (!tr.voices[slot]) fail('slot without a voice: ' + slot); });
  ['K', 'S', 'k', 's', 'L'].forEach((r) => {
    Object.entries(tr.simple[r] || {}).forEach(([slot, v]) => [].concat(v).forEach((p) => { if (p.length !== 4) fail('simple ' + r + ' ' + slot + ' has ' + p.length + ' steps'); }));
    Object.entries(tr.compound[r] || {}).forEach(([slot, v]) => [].concat(v).forEach((p) => { if (p.length !== 6) fail('compound ' + r + ' ' + slot + ' has ' + p.length + ' steps'); }));
  });
  Object.entries(tr.bars || {}).forEach(([key, b]) => {
    const [m, s] = key.split('x').map(Number);
    Object.entries(b).forEach(([slot, v]) => [].concat(v).forEach((p) => {
      if (p.length !== m * (s === 3 ? 6 : 4)) fail('bar ' + key + ' ' + slot + ' has ' + p.length + ' steps');
    }));
  });
  Object.keys(METERS).forEach((mid) => {
    const [lens, subs] = METERS[mid];
    const even = lens.every((l) => l === lens[0]);
    let line = '  ' + mid.padEnd(5);
    for (let bar = 0; bar < 4; bar++) {
      lens.forEach((len, barPos) => {
        ['say', 'review'].forEach((phase) => {
          const ev = S.beatEvents(tr, { meter: lens.length, sub: subs[barPos], barPos: barPos, bar: bar, even: even, phase: phase,
            chill: phase === 'review', chord: S.chordAt(tr, bar), next: S.chordAt(tr, bar + 1) });
          if (phase === 'say' && !ev.some((e) => e.at === 0 && PULSE.indexOf(e.slot) >= 0)) fail(mid + ' bar ' + bar + ' beat ' + (barPos + 1) + ': nothing on the beat');
          ev.forEach((e) => {
            if (e.midis && e.midis.some((m) => !isFinite(m) || m < 24 || m > 110)) fail(mid + ' ' + e.slot + ' note out of range ' + e.midis);
            if (!(e.level > 0 && e.level <= 1)) fail(mid + ' ' + e.slot + ' level ' + e.level);
            if (!(e.dur > 0)) fail(mid + ' ' + e.slot + ' duration ' + e.dur);
          });
          if (phase === 'say' && bar < 2) line += ' ' + ev.length;
        });
      });
      if (bar < 2) line += ' |';
    }
    console.log(line + ' sounds per beat');
  });
  const end = S.endNotes(tr, S.chordAt(tr, 0));
  console.log('  end: ' + end.map((n) => n.slot + ' ' + n.midis.map((m) => m.toFixed(1)).join(',')).join('; '));
  if (!end.length) fail('no end notes');
});
const picks = Array.from({ length: 12 }, () => S.pick('random', Math.random, 'classic'));
if (picks.indexOf('classic') >= 0) fail('Random picked the soundtrack it should avoid');
console.log('\nRandom picks: ' + picks.join(' '));
console.log(problems ? '\n' + problems + ' problems' : '\nAll soundtracks OK');
process.exit(problems ? 1 : 0);
