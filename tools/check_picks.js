#!/usr/bin/env node
'use strict';
require('../js/picks.js');
const P = globalThis.Picks;
let failures = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : ': got ' + JSON.stringify(got) + ', want ' + JSON.stringify(want)));
};

const sc = { id: 'a', chips: [{ id: 'x' }, { id: 'y' }, { id: 'z' }] };
const fixed = { id: 'v', fixed: true, defaults: ['y'], chips: [{ id: 'x' }, { id: 'y' }, { id: 'z' }] };
eq('All picks everything', P.allNonePicks(sc, ['y'], ['x', 'y', 'z']), ['x', 'y', 'z']);
eq('label is All when something is missing', P.allNoneLabel(['y'], ['x', 'y', 'z']), 'all');
eq('label is None when everything is picked', P.allNoneLabel(['x', 'y', 'z'], ['x', 'y', 'z']), 'none');
eq('None clears', P.allNonePicks(sc, ['x', 'y', 'z'], ['x', 'y', 'z']), []);
eq('All keeps a greyed-out pick and ignores greyed-out chips', P.allNonePicks(sc, ['z'], ['x', 'y']), ['x', 'y', 'z']);
eq('None when every pickable chip is picked (a greyed-out one too)', P.allNoneLabel(['x', 'y', 'z'], ['x', 'y']), 'none');
eq('None on an always-on subcategory keeps its default', P.allNonePicks(fixed, ['x', 'y', 'z'], ['x', 'y', 'z']), ['y']);
eq('None on an always-on subcategory keeps the first pickable chip when the default is greyed out',
  P.allNonePicks(fixed, ['x', 'z'], ['x', 'z']), ['x']);
eq('no pickable chips: label All', P.allNoneLabel([], []), 'all');

const subs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'v', fixed: true }];
const defaultsOf = (id) => ({ a: ['a1'], b: ['b1'], c: ['c1'], v: ['v1'] }[id]);
eq('Only turns the others off and remembers their picks',
  P.onlyPicks(subs, 'a', { a: ['a2'], b: ['b1', 'b2'], c: [], v: ['v1'] }, {}, defaultsOf),
  { sel: { a: ['a2'], b: [], c: [], v: ['v1'] }, lastSel: { b: ['b1', 'b2'] } });
eq('Only on a subcategory that was off uses its last picks',
  P.onlyPicks(subs, 'c', { a: ['a1'], b: [], c: [], v: ['v1'] }, { c: ['c3'] }, defaultsOf),
  { sel: { a: [], b: [], c: ['c3'], v: ['v1'] }, lastSel: { c: ['c3'], a: ['a1'] } });
eq('Only on a subcategory that was never on uses its defaults',
  P.onlyPicks(subs, 'b', { a: [], b: [], c: [], v: ['v1'] }, {}, defaultsOf),
  { sel: { a: [], b: ['b1'], c: [], v: ['v1'] }, lastSel: {} });
eq('Only makes sense with another subcategory to switch off', P.onlyMakesSense(subs, 'a'), true);
eq('Only makes no sense in a tab with one switchable subcategory', P.onlyMakesSense([{ id: 'm' }, { id: 'v', fixed: true }], 'm'), false);
eq('already the only one on', P.isOnlyOne(subs, 'a', { a: ['a1'], b: [], c: [], v: ['v1'] }), true);
eq('not the only one on', P.isOnlyOne(subs, 'a', { a: ['a1'], b: ['b1'], c: [], v: ['v1'] }), false);
eq('off is not the only one on', P.isOnlyOne(subs, 'a', { a: [], b: [], c: [], v: ['v1'] }), false);

console.log(failures ? failures + ' failed' : 'All pick tests pass');
process.exit(failures ? 1 : 0);
