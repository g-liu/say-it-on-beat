#!/usr/bin/env node
/*
 * Prints every card's answer (what the class says, and the small print) for some subcategories,
 * with all their chips picked:   node tools/print_cards.js expressive dynamics [setting=value ...]
 */
'use strict';
globalThis.window = globalThis;
require('../js/notation.js');
require('../js/theory.js');
require('../js/content.js');
const C = globalThis.Content;
const args = process.argv.slice(2);
const settings = { instrument: 'violin', clefMode: 'alternate', cadenceKeys: ['C:major'], spellKeys: ['C:major'], degreeKeys: ['C:major'],
  intervalKeys: ['C:major'], chordLabels: 'roman', expressiveSays: 'term', noteAnswer: 'names' };
args.filter((a) => a.indexOf('=') > 0).forEach((a) => { const [k, v] = a.split('='); settings[k] = v; });
const ids = args.filter((a) => a.indexOf('=') < 0);
(ids.length ? ids : C.SUBCATS.map((sc) => sc.id)).forEach((id) => {
  const sc = C.subById(id);
  if (!sc || !sc.pool) return;
  console.log('\n== ' + sc.name + ' ==');
  sc.pool(sc.chips.map((c) => c.id), settings).forEach((it) => {
    const card = C.resolve(it, 'treble');
    console.log('  ' + String(card.say).replace(/<[^>]+>/g, '').padEnd(28) + card.detail + (card.svg ? '' : '   (NO PICTURE)'));
  });
});
