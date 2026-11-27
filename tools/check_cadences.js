#!/usr/bin/env node
/*
 * Prints every cadence in every key with its four-part voicing (treble, and alto after moving it by
 * octaves) and checks the part writing: parallel 5ths and 8ves, voice crossing and overlap, upper-voice
 * leaps over an octave, the leading tone and 7th resolving, doubling, and ledger lines (at most 2).
 *   node tools/check_cadences.js [keys...]     (e.g. E:major A:minor; default: all keys)
 */
'use strict';
require('../js/theory.js');
const T = globalThis.Theory;
const keys = process.argv.length > 2 ? process.argv.slice(2).map(T.keyById) : T.KEYS;
const label = (v) => T.pretty(v.name) + v.octave;
let problems = 0, count = 0;

function check(a, b, chA, chB, dom, clef) {
  const out = [];
  [a, b].forEach((ch, ci) => {
    ch.forEach((v, k) => {
      const lines = T.ledgerLines(T.staffPosOf(v, clef));
      if (T.staffPosOf(v, clef) < -5 || T.staffPosOf(v, clef) > 13) out.push(clef + ' chord ' + (ci + 1) + ' ' + label(v) + ' has ' + lines + ' ledger lines');
      if (k && v.midi <= ch[k - 1].midi) out.push('voices cross in chord ' + (ci + 1));
    });
    for (let k = 1; k < 3; k++) if (ch[k + 1].midi - ch[k].midi > 12) out.push('more than an octave between upper voices in chord ' + (ci + 1));
  });
  for (let k = 0; k < 4; k++) {
    const d = b[k].midi - a[k].midi;
    if (k && Math.abs(d) > 12) out.push('voice ' + k + ' leaps more than an octave');
    if (k < 3 && (b[k].midi > a[k + 1].midi || b[k + 1].midi < a[k].midi)) out.push('voices ' + k + ' and ' + (k + 1) + ' overlap');
    if (dom && a[k].member === 1 && d !== 1) out.push('leading tone ' + label(a[k]) + ' goes to ' + label(b[k]));
    if (dom && chA.notes.length === 4 && a[k].member === 3 && !(d === -1 || d === -2)) out.push('7th ' + label(a[k]) + ' goes to ' + label(b[k]));
  }
  for (let x = 0; x < 4; x++) {
    for (let y = x + 1; y < 4; y++) {
      const ia = (a[y].midi - a[x].midi) % 12, ib = (b[y].midi - b[x].midi) % 12;
      const dx = b[x].midi - a[x].midi, dy = b[y].midi - a[y].midi;
      if (ia === ib && (ia === 0 || ia === 7) && dx && dy && Math.sign(dx) === Math.sign(dy)) {
        out.push('parallel ' + (ia ? '5ths' : '8ves') + ' between voices ' + x + ' and ' + y);
      }
    }
  }
  [[a, chA], [b, chB]].forEach(([ch, chord], ci) => {
    const counts = [0, 0, 0, 0];
    ch.forEach((v) => counts[v.member]++);
    if (!counts[0] || !counts[1]) out.push('chord ' + (ci + 1) + ' is missing its root or 3rd');
    if (chord.notes.length === 4 && counts[3] !== 1) out.push('chord ' + (ci + 1) + ' has ' + counts[3] + ' 7ths');
  });
  if (dom && a.filter((v) => v.member === 1).length > 1) out.push('doubled leading tone');
  return out;
}

keys.forEach((key) => {
  console.log('\n== ' + T.keyName(key) + ' ==');
  Object.keys(T.CADENCES).forEach((id) => {
    const cad = T.CADENCES[id];
    if (cad.modes && cad.modes.indexOf(key.mode) < 0) return;
    cad.variants.forEach((v) => {
      count++;
      const chA = T.kindChords(v.a[0], key)[v.a[1]], chB = T.kindChords(v.b[0], key)[v.b[1]];
      const voiced = T.voiceCadence(key, v);
      if (!voiced) { problems++; console.log('  ' + id + ': NO VOICING FOUND'); return; }
      const dom = v.a[0] === 'V' || v.a[0] === 'V7';
      const alto = T.voiceCadence(key, v, 'alto');
      const found = check(voiced.a, voiced.b, chA, chB, dom, 'treble').concat(check(alto.a, alto.b, chA, chB, dom, 'alto'));
      const pac = id === 'pac' || id === 'picardy';
      if (pac && (voiced.b[3].name !== voiced.b[0].name || v.a[2] !== 0 || v.b[2] !== 0)) found.push('a PAC needs root position and the tonic on top');
      if (id === 'iac' && voiced.b[3].name === key.tonic && v.a[2] === 0 && v.b[2] === 0) found.push('this IAC is really a PAC');
      problems += found.length;
      const show = (ch) => ch.map(label).join(' ').padEnd(16);
      const altoNote = alto.shift == null ? '  alto: ' + show(alto.a) + '→ ' + show(alto.b) : alto.shift ? '  alto ' + (alto.shift > 0 ? '+' : '') + alto.shift + ' oct' : '';
      console.log('  ' + (cad.short + ' ' + T.rnText(chA.rn) + '→' + T.rnText(chB.rn)).padEnd(22) + show(voiced.a) + '→ ' + show(voiced.b) +
        ' cost ' + voiced.cost.toFixed(1).padStart(5) + altoNote +
        (found.length ? '\n    PROBLEM: ' + found.join('\n    PROBLEM: ') : ''));
    });
  });
});
console.log('\n' + count + ' cadences, ' + (problems ? problems + ' problems' : 'no problems'));
process.exit(problems ? 1 : 0);
