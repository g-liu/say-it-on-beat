/*
 * soundtracks.js — the backing tracks, as data, and the pure functions that turn them into the
 * sounds of one beat (js/audio.js plays them).
 *
 * A soundtrack has:
 *   progression  [[root MIDI note, [chord MIDI notes]], ...], one chord per bar
 *   voices       slot name -> { voice (a synth in BeatEngine.VOICES), gain, params... }
 *                kind: 'bass' | 'chord' for pitched slots; oct transposes them
 *                chill / chillMin: level multiplier and the softest note kept during the answers
 *                only: phases the slot plays in
 *   simple       patterns for beats split in 2 (4 steps per beat: 1 e & a)
 *   compound     patterns for beats split in 3 (6 steps per beat)
 *                both keyed by the beat's role: K downbeat, S backbeat, k second strong beat,
 *                s weak beat, L extra slots on the last beat of the bar
 *   bars         whole-bar patterns for one meter, keyed 'beats x divisions' ('4x2' = 4/4)
 *   swing        0 (straight) to 1 (triplet swing) for simple beats
 *   fill, bells, end, gain (balances loudness between soundtracks)
 *
 * Pattern steps: '.' rest, '-' hold the note before. Drums: '1'-'9' level (9 is full).
 * Bass: r root, o octave, 3 / 5 / 7 chord tones, l the 5th below, n next bar's root,
 * a / b a half step below / above next bar's root, w a walking bass note. Chords: x the chord,
 * 1-9 one chord note (in the order listed, going up an octave after the last). Upper case is accented.
 */
(function (global) {
  'use strict';

  const BASE_VOICES = {
    count: { voice: 'stick' },
    countSub: { voice: 'hat', gain: 0.12 }
  };
  const DEFAULT_END = { kick: 1, crash: 1.3, beats: 2.5, play: [['bass', 'R', 1.1], ['chord', 'X', 1.4]] };
  const SNARE_FILL = [[0, 'snare', 0.4], [0.25, 'snare', 0.6], [0.5, 'snare', 0.8], [0.75, 'snare', 1]];
  const SLENDRO = [0, 2.4, 4.8, 7.2, 9.6];
  const slendro = (base, i) => base + 12 * Math.floor(i / 5) + SLENDRO[((i % 5) + 5) % 5];

  const LIST = [
    {
      id: 'classic', name: 'Classic', desc: 'Drums, synth bass and chords in D major',
      progression: [[38, [62, 66, 69]], [33, [61, 64, 69]], [35, [62, 66, 71]], [31, [62, 67, 71]]],
      voices: {
        kick: { voice: 'kick', chill: 0.8, chillMin: 0.8 },
        snare: { voice: 'snare', gain: 0.75, chill: 0.55, chillMin: 0.3 },
        hat: { voice: 'hat', gain: 0.24, chill: 0.6 },
        ohat: { voice: 'hat', open: true, gain: 0.24, only: ['say'] },
        crash: { voice: 'crash', gain: 0.35 },
        bass: { voice: 'tone', kind: 'bass', osc: [{ type: 'sawtooth' }], cutoff: 900, sweep: 220, q: 5, attack: 0.005,
          oct: 12, gain: 0.36, weak: 0.6, legato: 0.85, chill: 1, chillMin: 0.7 },
        chord: { voice: 'tone', kind: 'chord', osc: [{ type: 'square' }], cutoff: 2400, attack: 0.004, gain: 0.1, legato: 0.6, chill: 0.6 },
        bell: { voice: 'bell', gain: 0.3 }
      },
      simple: {
        K: { kick: '9...', hat: '6.9.', bass: 'R-o-' },
        S: { kick: '5...', snare: '9...', hat: '6.9.', bass: 'R-o-', chord: '..x-' },
        k: { kick: '8...', hat: '6.9.', bass: 'R-o-' },
        s: { kick: '4...', snare: '5...', hat: '6.9.', bass: 'R-o-', chord: '..x-' },
        L: { ohat: '..9.' }
      },
      compound: {
        K: { kick: '9.....', hat: '6.9.9.', bass: 'R-..o-' },
        S: { kick: '5.....', snare: '9.....', hat: '6.9.9.', bass: 'R-..o-', chord: '....x-' },
        k: { kick: '8.....', hat: '6.9.9.', bass: 'R-..o-' },
        s: { kick: '4.....', snare: '5.....', hat: '6.9.9.', bass: 'R-..o-', chord: '....x-' },
        L: { ohat: '....9.' }
      },
      bars: { '3x2': { bass: 'R---........', chord: '....x-..x-..' } },
      fill: SNARE_FILL,
      bells: [74, 76, 78, 81, 83, 86, 88, 90]
    },
    {
      id: 'retro', name: 'Retro 8-bit', desc: 'Chiptune: pulse-wave arpeggios, triangle bass and noise drums',
      progression: [[36, [60, 64, 67]], [43, [59, 62, 67]], [45, [60, 64, 69]], [41, [60, 65, 69]]],
      voices: {
        kick: { voice: 'kick', type: 'square', f0: 260, f1: 45, bend: 0.06, decay: 0.13, click: 0, gain: 0.55 },
        snare: { voice: 'snare', bp: 3500, q: 0.6, decay: 0.12, tone: 0.4, f0: 420, f1: 200, gain: 0.6, chillMin: 0.5 },
        hat: { voice: 'hat', freq: 9000, decay: 0.025, gain: 0.22 },
        crash: { voice: 'crash', freq: 2200, decay: 0.8, gain: 0.25 },
        bass: { voice: 'tone', kind: 'bass', osc: [{ type: 'triangle' }], oct: 12, gain: 0.5, attack: 0.002, decay: 0.2,
          sustain: 0.9, release: 0.02, legato: 0.9, weak: 0.8, chill: 1 },
        chord: { voice: 'tone', kind: 'chord', osc: [{ type: 'pulse', duty: 0.25 }], oct: 12, gain: 0.075, attack: 0.002,
          decay: 0.08, sustain: 0.6, release: 0.02, legato: 0.85, chill: 0.7 },
        bell: { voice: 'coin', gain: 0.1 }
      },
      simple: {
        K: { kick: '9...', hat: '7.7.', bass: 'R.o.', chord: '1234' },
        S: { snare: '9...', hat: '7.7.', bass: 'r.O.', chord: '3432' },
        k: { kick: '9.5.', hat: '7.7.', bass: 'R.o.', chord: '1234' },
        s: { snare: '6...', hat: '7.7.', bass: 'r.O.', chord: '3212' }
      },
      compound: {
        K: { kick: '9.....', hat: '7.7.7.', bass: 'R.o.o.', chord: '123432' },
        S: { snare: '9.....', hat: '7.7.7.', bass: 'r.O.r.', chord: '432123' },
        k: { kick: '9...5.', hat: '7.7.7.', bass: 'R.o.o.', chord: '123432' },
        s: { snare: '6.....', hat: '7.7.7.', bass: 'r.O.r.', chord: '321232' }
      },
      fill: [[0, 'snare', 0.5], [0.25, 'snare', 0.6], [0.5, 'snare', 0.8], [0.625, 'snare', 0.7], [0.75, 'snare', 1], [0.875, 'snare', 0.9]],
      bells: [72, 74, 76, 79, 81, 84, 86, 88],
      end: { kick: 1, crash: 1, beats: 2.5, play: [['bass', 'R', 1], ['chord', 'X', 1]] }
    },
    {
      id: 'funk', name: 'Funk', desc: 'Syncopated drums, slap bass and clavinet in E',
      progression: [[28, [64, 67, 71, 74]], [33, [61, 64, 67, 71]]],
      voices: {
        kick: { voice: 'kick', f0: 130, f1: 45, decay: 0.3, click: 0.3, chillMin: 0.8 },
        snare: { voice: 'snare', bp: 2200, q: 0.9, decay: 0.16, tone: 0.5, f0: 240, f1: 180, gain: 0.8, chillMin: 0.5 },
        hat: { voice: 'cymbal', decay: 0.04, gain: 0.2, chill: 0.6 },
        ohat: { voice: 'cymbal', decay: 0.22, gain: 0.18 },
        crash: { voice: 'cymbal', decay: 1.5, cutoff: 3500, gain: 0.3 },
        bass: { voice: 'tone', kind: 'bass', osc: [{ type: 'sawtooth' }, { type: 'square', detune: 5 }], cutoff: 2400, sweep: 260,
          sweepTime: 0.12, q: 6, oct: 12, gain: 0.33, attack: 0.002, decay: 0.15, sustain: 0.4, release: 0.03, legato: 0.7, weak: 0.7, chill: 1 },
        chord: { voice: 'tone', kind: 'chord', osc: [{ type: 'pulse', duty: 0.18 }], filter: 'bandpass', cutoff: 1500, q: 1.4,
          gain: 0.11, attack: 0.001, decay: 0.07, sustain: 0.3, release: 0.02, legato: 0.5, chill: 0.6 },
        bell: { voice: 'fm', ratio: 1, index: 2.2, decay: 0.9, gain: 0.22 }
      },
      simple: {
        K: { kick: '9..6', snare: '...3', hat: '7373', bass: 'R..o', chord: '.x.x' },
        S: { kick: '..6.', snare: '9..3', hat: '7373', bass: '..O.', chord: '.x..' },
        k: { kick: '9.6.', snare: '.3..', hat: '7373', bass: 'r.o.', chord: '..x.' },
        s: { kick: '..5.', snare: '7..3', hat: '7373', bass: '.ro.', chord: '.x.x' }
      },
      compound: {
        K: { kick: '9...6.', snare: '....3.', hat: '737373', bass: 'R..o..', chord: '.x..x.' },
        S: { kick: '....6.', snare: '9...3.', hat: '737373', bass: '..O.r.', chord: '..x..x' },
        k: { kick: '9...6.', snare: '....3.', hat: '737373', bass: 'R..o..', chord: '.x..x.' },
        s: { snare: '7.....', hat: '737373', bass: '.ro...', chord: '.x..x.' }
      },
      bars: { '4x2': {
        kick: '9.....9.9..6....', snare: '....9..3.3..9..3', hat: '73737373737373.3', ohat: '..............9.',
        bass: 'R-.r..O.r-.o..O.', chord: '..x..x.x..x..x.x'
      } },
      fill: [[0, 'snare', 0.5], [0.25, 'snare', 0.7], [0.5, 'snare', 0.6], [0.625, 'snare', 0.8], [0.75, 'snare', 1], [0.875, 'kick', 0.8]],
      bells: [76, 79, 81, 83, 86, 88, 91, 93]
    },
    {
      id: 'disco', name: '70s disco', desc: 'Four on the floor, octave bass, strings and handclaps',
      progression: [[33, [64, 67, 69, 72]], [38, [62, 65, 69, 72]], [31, [62, 65, 67, 71]], [36, [64, 67, 71, 72]]],
      voices: {
        kick: { voice: 'kick', f0: 160, f1: 48, decay: 0.28, click: 0.35, chill: 0.75 },
        clap: { voice: 'handclap', gain: 0.75, chill: 0.6 },
        snare: { voice: 'snare', bp: 2000, decay: 0.15, tone: 0.4, gain: 0.4 },
        hat: { voice: 'cymbal', decay: 0.035, gain: 0.13 },
        ohat: { voice: 'cymbal', decay: 0.2, gain: 0.2, chill: 0.6 },
        tom: { voice: 'tom', freq: 190, drop: 0.6, decay: 0.25, gain: 0.7 },
        crash: { voice: 'cymbal', decay: 1.6, cutoff: 3500, gain: 0.3 },
        bass: { voice: 'tone', kind: 'bass', osc: [{ type: 'sawtooth' }], cutoff: 1500, sweep: 300, sweepTime: 0.1, q: 4, oct: 12,
          gain: 0.34, attack: 0.002, decay: 0.12, sustain: 0.5, release: 0.03, legato: 0.7, weak: 0.85, chill: 1 },
        strings: { voice: 'tone', kind: 'chord', osc: [{ type: 'sawtooth', detune: -9 }, { type: 'sawtooth', detune: 9 }], cutoff: 2600,
          q: 0.5, gain: 0.04, attack: 0.08, decay: 0.3, sustain: 0.8, release: 0.3, len: 'bar', legato: 0.95, chill: 0.8 },
        chord: { voice: 'tone', kind: 'chord', osc: [{ type: 'sawtooth' }, { type: 'square', detune: 7 }], cutoff: 3000, oct: 12,
          gain: 0.05, attack: 0.003, decay: 0.1, sustain: 0.2, release: 0.05, legato: 0.5 },
        bell: { voice: 'fm', ratio: 3.5, index: 1.6, decay: 0.7, gain: 0.18 }
      },
      simple: {
        K: { kick: '9...', hat: '5..5', ohat: '..9.', bass: 'R.O.', strings: 'x...' },
        S: { kick: '9...', clap: '9...', snare: '7...', hat: '5..5', ohat: '..9.', bass: 'r.O.' },
        k: { kick: '9...', hat: '5..5', ohat: '..9.', bass: 'R.O.' },
        s: { kick: '9...', clap: '7...', hat: '5..5', ohat: '..9.', bass: 'r.O.' },
        L: { chord: '..X.' }
      },
      compound: {
        K: { kick: '9.....', hat: '5.5...', ohat: '....9.', bass: 'R.O.o.', strings: 'x.....' },
        S: { kick: '9.....', clap: '9.....', snare: '7.....', hat: '5.5...', ohat: '....9.', bass: 'r.O.o.' },
        k: { kick: '9.....', hat: '5.5...', ohat: '....9.', bass: 'R.O.o.' },
        s: { kick: '9.....', clap: '7.....', hat: '5.5...', ohat: '....9.', bass: 'r.O.o.' },
        L: { chord: '....X.' }
      },
      fill: [[0, 'snare', 0.6], [0.25, 'snare', 0.7], [0.5, 'tom', 0.9, 1.2], [0.75, 'tom', 1, 0.85]],
      bells: [76, 79, 81, 84, 86, 88, 91, 93],
      end: { kick: 1, crash: 1.2, beats: 3, play: [['bass', 'R', 1.1], ['strings', 'x', 1.5], ['chord', 'X', 1]] }
    },
    {
      id: 'jazz', name: 'Jazz swing', desc: 'Ride cymbal, walking bass and electric piano: ii–V–I in F',
      swing: 1,
      progression: [[31, [65, 69, 70, 74]], [36, [64, 69, 70, 74]], [29, [64, 67, 69, 72]], [38, [66, 69, 72, 75]]],
      voices: {
        ride: { voice: 'cymbal', decay: 0.45, cutoff: 5000, band: 7000, mult: 1.4, gain: 0.2, chill: 0.7 },
        chick: { voice: 'cymbal', decay: 0.05, gain: 0.17 },
        kick: { voice: 'kick', f0: 110, f1: 50, decay: 0.25, click: 0.1, gain: 0.55 },
        snare: { voice: 'snare', bp: 1500, decay: 0.12, tone: 0.3, gain: 0.35 },
        crash: { voice: 'cymbal', decay: 1.6, cutoff: 4000, gain: 0.3 },
        bass: { voice: 'tone', kind: 'bass', osc: [{ type: 'sawtooth' }, { type: 'sine' }], cutoff: 900, sweep: 350, sweepTime: 0.25,
          q: 1, oct: 12, gain: 0.5, attack: 0.004, decay: 0.25, sustain: 0.35, release: 0.08, legato: 0.95, chill: 1 },
        chord: { voice: 'fm', kind: 'chord', ratio: 1, index: 1.3, decay: 1.2, gain: 0.07, legato: 0.6, chill: 0.7 },
        bell: { voice: 'fm', ratio: 4, index: 0.7, decay: 1.4, gain: 0.22 }
      },
      simple: {
        K: { ride: '9...', kick: '4...', bass: 'w---' },
        S: { ride: '9.6.', chick: '9...', kick: '4...', bass: 'w---', chord: '..x.' },
        k: { ride: '9...', kick: '4...', snare: '..2.', bass: 'w---' },
        s: { ride: '9.6.', chick: '6...', kick: '3...', bass: 'w---', chord: '..x.' }
      },
      compound: {
        K: { ride: '9...6.', kick: '4.....', bass: 'w-----' },
        S: { ride: '9...6.', chick: '9.....', kick: '4.....', bass: 'w-----', chord: '..x...' },
        k: { ride: '9...6.', kick: '4.....', bass: 'w-----' },
        s: { ride: '9...6.', chick: '6.....', bass: 'w-----', chord: '....x.' }
      },
      fill: [[0, 'snare', 0.6], [1 / 3, 'snare', 0.75], [2 / 3, 'snare', 0.9], [5 / 6, 'kick', 1]],
      bells: [77, 79, 81, 84, 86, 89, 91, 93],
      end: { kick: 1, crash: 1.2, beats: 3, play: [['bass', 'R', 1.1], ['chord', 'X', 1.5]] }
    },
    {
      id: 'salsa', name: 'Salsa', desc: 'Clave, congas, cowbell, tumbao bass and piano montuno in C',
      progression: [[36, [60, 64, 67, 72]], [41, [60, 65, 69, 72]], [43, [59, 62, 65, 67]], [41, [60, 65, 69, 72]]],
      voices: {
        clave: { voice: 'wood', freq: 2500, decay: 0.06, gain: 0.45 },
        cowbell: { voice: 'cowbell', gain: 0.28, chill: 0.6 },
        conga: { voice: 'tom', freq: 200, drop: 0.92, bend: 0.05, decay: 0.2, slap: 0.35, gain: 0.55 },
        tumba: { voice: 'tom', freq: 145, drop: 0.92, bend: 0.05, decay: 0.28, gain: 0.6 },
        kick: { voice: 'kick', f0: 120, f1: 50, decay: 0.25, click: 0.1, gain: 0.7 },
        shaker: { voice: 'shaker', gain: 0.12 },
        crash: { voice: 'crash', freq: 3500, decay: 1.2, gain: 0.28 },
        bass: { voice: 'tone', kind: 'bass', osc: [{ type: 'sine' }, { type: 'triangle' }, { type: 'sawtooth', gain: 0.3 }], cutoff: 900,
          q: 1, oct: 12, gain: 0.55, attack: 0.005, decay: 0.2, sustain: 0.7, release: 0.06, legato: 0.9, chill: 1 },
        chord: { voice: 'fm', kind: 'chord', ratio: 1, index: 1.8, decay: 0.45, gain: 0.1, oct: 12, chill: 0.7 },
        bell: { voice: 'fm', ratio: 4, index: 1.2, decay: 0.45, gain: 0.22 }
      },
      simple: {
        K: { kick: '9...', cowbell: '9...', clave: '9..9', shaker: '6363', bass: 'R-..', chord: '1.2.', tumba: '9...' },
        S: { cowbell: '9.6.', clave: '..9.', shaker: '6363', bass: '..5-', chord: '.3.2', conga: '9...' },
        k: { kick: '9...', cowbell: '9...', shaker: '6363', bass: 'n---', chord: '1.3.', tumba: '9...' },
        s: { cowbell: '9...', shaker: '6363', conga: '..9.', bass: '..5.', chord: '.2.3' }
      },
      compound: {
        K: { kick: '9.....', cowbell: '9.....', clave: '9..9..', shaker: '636363', bass: 'R-....', chord: '1.2.3.', tumba: '9.....' },
        S: { cowbell: '9.....', clave: '..9...', shaker: '636363', bass: '....5-', chord: '.3..2.', conga: '9...9.' },
        k: { kick: '9.....', cowbell: '9.....', shaker: '636363', bass: 'n-----', chord: '1.2.3.', tumba: '9.....' },
        s: { cowbell: '9.....', shaker: '636363', bass: '....5-', chord: '.3..2.', conga: '9...9.' }
      },
      bars: { '4x2': {
        clave: ['9..9...9........', '....9...9.......'],
        cowbell: '9...9...9...9...', kick: '9.......8.......', shaker: '6363636363636363',
        conga: '....9.......9.9.', tumba: '9.......9.......',
        bass: '......5-....n---',
        chord: ['1.23.1.2.3.12.3.', '.1.3.12.3.1.23.1']
      } },
      fill: [[0, 'conga', 0.8], [0.25, 'conga', 0.8], [0.5, 'tumba', 0.9], [0.625, 'conga', 0.8], [0.75, 'tumba', 1], [0.875, 'tumba', 1]],
      bells: [72, 74, 76, 79, 81, 84, 86, 88]
    },
    {
      id: 'bossa', name: 'Bossa nova', desc: 'Cross-stick, soft surdo, nylon guitar and a walking-in-two bass',
      progression: [[36, [59, 64, 67]], [33, [61, 64, 67]], [38, [60, 65, 69]], [31, [59, 65, 67]]],
      voices: {
        rim: { voice: 'wood', freq: 1700, decay: 0.04, noise: 0.5, gain: 0.45, chill: 0.6 },
        kick: { voice: 'kick', f0: 90, f1: 45, decay: 0.35, click: 0.05, gain: 0.8 },
        shaker: { voice: 'shaker', gain: 0.13 },
        hat: { voice: 'cymbal', decay: 0.04, gain: 0.12 },
        crash: { voice: 'cymbal', decay: 1.6, cutoff: 4500, gain: 0.25 },
        bass: { voice: 'tone', kind: 'bass', osc: [{ type: 'sine' }, { type: 'triangle' }], cutoff: 700, oct: 12, gain: 0.6,
          attack: 0.006, decay: 0.3, sustain: 0.5, release: 0.1, legato: 0.95, chill: 1 },
        chord: { voice: 'tone', kind: 'chord', osc: [{ type: 'triangle' }, { type: 'sawtooth', gain: 0.35 }], cutoff: 1800, sweep: 700,
          sweepTime: 0.3, gain: 0.08, attack: 0.003, decay: 0.35, sustain: 0.2, release: 0.1, legato: 0.8, strum: 0.012, chill: 0.7 },
        bell: { voice: 'fm', ratio: 3, index: 0.8, decay: 1, gain: 0.2 }
      },
      simple: {
        K: { kick: '9..6', rim: '9..9', shaker: '5353', bass: 'R---', chord: 'x..x' },
        S: { rim: '..9.', shaker: '5353', hat: '9...', bass: '..5-', chord: '..x.' },
        k: { kick: '9..6', rim: '9..9', shaker: '5353', bass: 'R---', chord: 'x..x' },
        s: { rim: '..9.', shaker: '5353', hat: '9...', bass: '..5-', chord: '..x.' }
      },
      compound: {
        K: { kick: '9.....', rim: '9..9..', shaker: '535353', bass: 'R-----', chord: 'x...x.' },
        S: { rim: '..9...', shaker: '535353', hat: '9.....', bass: '....5-', chord: '..x...' },
        k: { kick: '9.....', rim: '9..9..', shaker: '535353', bass: 'R-----', chord: 'x...x.' },
        s: { rim: '..9...', shaker: '535353', hat: '9.....', bass: '....5-', chord: '..x...' }
      },
      bars: { '4x2': {
        rim: ['9..9..9...9..9..', '..9..9...9..9...'],
        chord: ['x..x..x...x..x..', '..x..x..x..x..x.'],
        kick: '9..6....9..6....',
        bass: 'R-----5-R-----5-'
      } },
      fill: [[0, 'rim', 0.7], [0.25, 'rim', 0.8], [0.5, 'rim', 0.9], [0.75, 'kick', 1]],
      bells: [72, 76, 79, 83, 84, 88, 91, 95]
    },
    {
      id: 'gamelan', name: 'Gamelan', desc: 'Javanese slendro tuning: saron, bonang, kendang drum and gongs',
      progression: [
        [slendro(38, 1), [2, 3, 2, 1].map((i) => slendro(62, i))],
        [slendro(38, 2), [3, 4, 3, 2].map((i) => slendro(62, i))],
        [slendro(38, 1), [4, 3, 2, 1].map((i) => slendro(62, i))],
        [slendro(38, 0), [3, 2, 1, 0].map((i) => slendro(62, i))]
      ],
      voices: {
        chord: { voice: 'metal', kind: 'chord', decay: 1.3, gain: 0.28, legato: 1, chill: 0.8 },
        bonang: { voice: 'metal', kind: 'chord', oct: 12, decay: 0.6, partials: [[1, 1], [2, 0.3], [3.9, 0.1]], gain: 0.14, chill: 0.6 },
        kenong: { voice: 'metal', kind: 'bass', oct: 24, decay: 1.6, partials: [[1, 1], [2.01, 0.25]], gain: 0.26 },
        kempul: { voice: 'gong', kind: 'bass', oct: 12, decay: 2.2, gain: 0.32 },
        gong: { voice: 'gong', kind: 'bass', oct: 0, decay: 4, gain: 0.55 },
        kendang: { voice: 'tom', freq: 105, drop: 0.7, bend: 0.08, decay: 0.28, gain: 0.85 },
        ken: { voice: 'tom', freq: 330, drop: 0.85, bend: 0.04, decay: 0.08, slap: 0.4, gain: 0.45 },
        ketuk: { voice: 'metal', kind: 'bass', oct: 24, decay: 0.12, partials: [[1, 1], [2.4, 0.2]], gain: 0.2 },
        kick: { voice: 'tom', freq: 105, drop: 0.7, bend: 0.08, decay: 0.3, gain: 0.9 },
        crash: { voice: 'gong', freq: 52, decay: 3.5, gain: 0.5 },
        count: { voice: 'metal', freq: 880, decay: 0.1, partials: [[1, 1], [2.4, 0.2]], gain: 0.4 },
        countSub: { voice: 'tom', freq: 330, drop: 0.85, decay: 0.06, gain: 0.2 },
        bell: { voice: 'metal', decay: 1.2, gain: 0.3 }
      },
      simple: {
        K: { kendang: '9..5', chord: '1...', bonang: '1.2.', ketuk: '..9.', kenong: '9...', gong: ['9...', '....', '....', '....'] },
        S: { kendang: '9...', ken: '...6', chord: '2...', bonang: '2.3.', ketuk: '..9.', kempul: ['....', '9...'] },
        k: { kendang: '9.5.', chord: '3...', bonang: '3.2.', ketuk: '..9.', kenong: '9...' },
        s: { kendang: '9...', ken: '..6.', chord: '3...', bonang: '3.4.', ketuk: '..9.' },
        L: { chord: '4...', bonang: '4.1.' }
      },
      compound: {
        K: { kendang: '9...5.', chord: '1.....', bonang: '1.2.3.', ketuk: '....9.', kenong: '9.....', gong: ['9.....', '......', '......', '......'] },
        S: { kendang: '9.....', ken: '....6.', chord: '2.....', bonang: '2.3.2.', ketuk: '....9.', kempul: ['......', '9.....'] },
        k: { kendang: '9...5.', chord: '3.....', bonang: '3.2.3.', ketuk: '....9.', kenong: '9.....' },
        s: { kendang: '9.....', ken: '..6...', chord: '3.....', bonang: '3.4.3.', ketuk: '....9.' },
        L: { chord: '4.....', bonang: '4.3.1.' }
      },
      bars: { '4x2': { chord: '1...2...3...4...', bonang: '1.2.2.3.3.4.4.1.' } },
      fill: [[0, 'ken', 0.7], [0.25, 'ken', 0.8], [0.5, 'kendang', 0.9], [0.625, 'ken', 0.8], [0.75, 'kendang', 1]],
      bells: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => slendro(74, i)),
      end: { kick: 1, crash: 1, beats: 3, play: [['gong', 'R', 1], ['chord', '4', 1.2], ['bonang', '4', 1]] }
    },
    {
      id: 'lofi', name: 'Lo-fi', desc: 'Laid-back swung beat, soft electric piano and sub bass',
      swing: 0.55,
      progression: [[41, [64, 67, 69, 72]], [40, [62, 64, 67, 71]], [38, [60, 64, 65, 69]], [36, [59, 62, 64, 67]]],
      voices: {
        kick: { voice: 'kick', f0: 120, f1: 42, decay: 0.4, click: 0.15, chillMin: 0.8 },
        snare: { voice: 'snare', bp: 1500, q: 0.6, decay: 0.22, tone: 0.25, gain: 0.65, chillMin: 0.8 },
        hat: { voice: 'cymbal', decay: 0.04, gain: 0.12, chill: 0.6 },
        crash: { voice: 'cymbal', decay: 1.4, cutoff: 4000, gain: 0.22 },
        bass: { voice: 'tone', kind: 'bass', osc: [{ type: 'sine' }, { type: 'sawtooth', gain: 0.25 }], cutoff: 500, oct: 12, gain: 0.55,
          attack: 0.01, decay: 0.4, sustain: 0.6, release: 0.1, legato: 0.9, chill: 1 },
        chord: { voice: 'fm', kind: 'chord', ratio: 1, index: 0.9, decay: 2.2, gain: 0.07, len: 'bar', strum: 0.02, chill: 0.9 },
        bell: { voice: 'fm', ratio: 2, index: 0.6, decay: 1.2, gain: 0.2 }
      },
      simple: {
        K: { kick: '9..4', hat: '7.4.', bass: 'R---', chord: 'x...' },
        S: { snare: '9...', hat: '7.4.', bass: '...r' },
        k: { kick: '9.6.', hat: '7.4.', bass: '..R-' },
        s: { snare: '7...', hat: '7.4.' }
      },
      compound: {
        K: { kick: '9...4.', hat: '6.4.6.', bass: 'R-----', chord: 'x.....' },
        S: { snare: '9.....', hat: '6.4.6.', bass: '....r-' },
        k: { kick: '9...6.', hat: '6.4.6.', bass: '....R-' },
        s: { snare: '7.....', hat: '6.4.6.' }
      },
      fill: [[0, 'snare', 0.5], [0.5, 'snare', 0.7], [0.75, 'kick', 0.9]],
      bells: [72, 74, 76, 79, 81, 84, 86, 88],
      end: { kick: 1, crash: 1, beats: 3, play: [['bass', 'R', 1.1], ['chord', 'X', 1.4]] }
    },
    {
      id: 'rock', name: 'Rock', desc: 'Big drums, driving bass and power chords in G',
      progression: [[31, [55, 62, 67]], [38, [50, 57, 62]], [40, [52, 59, 64]], [36, [48, 55, 60]]],
      voices: {
        kick: { voice: 'kick', f0: 140, f1: 45, decay: 0.3, click: 0.4, chillMin: 0.8 },
        snare: { voice: 'snare', bp: 1800, q: 0.7, decay: 0.22, tone: 0.7, gain: 0.9, chillMin: 0.8 },
        hat: { voice: 'cymbal', decay: 0.05, gain: 0.16, chill: 0.6 },
        tom: { voice: 'tom', freq: 150, drop: 0.6, decay: 0.3, gain: 0.75 },
        crash: { voice: 'cymbal', decay: 1.5, cutoff: 3500, gain: 0.32 },
        bass: { voice: 'tone', kind: 'bass', osc: [{ type: 'sawtooth' }], cutoff: 800, sweep: 300, q: 2, oct: 12, gain: 0.32,
          attack: 0.003, decay: 0.15, sustain: 0.6, release: 0.03, legato: 0.8, weak: 0.85, chill: 1 },
        chord: { voice: 'tone', kind: 'chord', osc: [{ type: 'sawtooth', detune: -6 }, { type: 'sawtooth', detune: 6 }], drive: 6,
          cutoff: 2400, q: 0.8, gain: 0.045, attack: 0.003, decay: 0.12, sustain: 0.5, release: 0.04, legato: 0.7, weak: 0.7, chill: 0.6 },
        bell: { voice: 'fm', ratio: 3.5, index: 1.4, decay: 0.8, gain: 0.2 }
      },
      simple: {
        K: { kick: '9...', hat: '7.7.', bass: 'R.r.', chord: 'X.x.' },
        S: { snare: '9...', hat: '7.7.', bass: 'r.r.', chord: 'x.x.' },
        k: { kick: '9.6.', hat: '7.7.', bass: 'R.r.', chord: 'X.x.' },
        s: { kick: '..6.', snare: '8...', hat: '7.7.', bass: 'r.r.', chord: 'x.x.' }
      },
      compound: {
        K: { kick: '9.....', hat: '7.7.7.', bass: 'R.r.r.', chord: 'X.x.x.' },
        S: { snare: '9.....', hat: '7.7.7.', bass: 'r.r.r.', chord: 'x.x.x.' },
        k: { kick: '9...6.', hat: '7.7.7.', bass: 'R.r.r.', chord: 'X.x.x.' },
        s: { snare: '8.....', hat: '7.7.7.', bass: 'r.r.r.', chord: 'x.x.x.' }
      },
      fill: [[0, 'snare', 0.8], [0.25, 'tom', 0.8, 1.35], [0.5, 'tom', 0.9, 1], [0.75, 'tom', 1, 0.75]],
      bells: [79, 81, 83, 86, 88, 91, 93, 95]
    },
    {
      id: 'reggae', name: 'Reggae', desc: 'Offbeat skank guitar, deep bass and a steady kick in G',
      swing: 0.25,
      progression: [[31, [62, 67, 71]], [36, [64, 67, 72]], [31, [62, 67, 71]], [38, [62, 66, 69]]],
      voices: {
        kick: { voice: 'kick', f0: 110, f1: 45, decay: 0.4, click: 0.2, chillMin: 0.8 },
        rim: { voice: 'snare', bp: 2600, q: 1.2, decay: 0.1, tone: 0.8, f0: 330, f1: 300, gain: 0.7 },
        hat: { voice: 'cymbal', decay: 0.04, gain: 0.14, chill: 0.6 },
        crash: { voice: 'cymbal', decay: 1.5, cutoff: 4000, gain: 0.26 },
        bass: { voice: 'tone', kind: 'bass', osc: [{ type: 'sine' }, { type: 'triangle' }], cutoff: 600, oct: 12, gain: 0.62,
          attack: 0.01, decay: 0.3, sustain: 0.7, release: 0.08, legato: 0.9, chill: 1 },
        chord: { voice: 'tone', kind: 'chord', osc: [{ type: 'square' }, { type: 'sawtooth' }], filter: 'bandpass', cutoff: 1800,
          q: 0.8, gain: 0.08, attack: 0.002, decay: 0.08, sustain: 0.1, release: 0.03, legato: 0.4, chill: 0.7 },
        bell: { voice: 'fm', ratio: 2, index: 1.2, decay: 0.8, gain: 0.2 }
      },
      simple: {
        K: { kick: '9...', hat: '7.5.', bass: 'R-.r', chord: '..x.' },
        S: { kick: '6...', hat: '7.5.', bass: '..5-', chord: '..x.' },
        k: { kick: '8...', rim: '9...', hat: '7.5.', bass: 'o-.5', chord: '..x.' },
        s: { kick: '6...', hat: '7.5.', bass: '..r.', chord: '..x.' },
        L: { rim: '9...' }
      },
      compound: {
        K: { kick: '9.....', hat: '7.5.5.', bass: 'R---.r', chord: '..x.x.' },
        S: { kick: '6.....', hat: '7.5.5.', bass: '....5-', chord: '..x.x.' },
        k: { kick: '8.....', rim: '9.....', hat: '7.5.5.', bass: 'o---.5', chord: '..x.x.' },
        s: { kick: '6.....', hat: '7.5.5.', bass: '....r.', chord: '..x.x.' },
        L: { rim: '9.....' }
      },
      bars: { '4x2': { rim: '........9.......' }, '4x3': { rim: '............9...........' } },
      fill: [[0, 'rim', 0.6], [0.25, 'rim', 0.7], [0.5, 'rim', 0.8], [0.75, 'kick', 1]],
      bells: [74, 76, 79, 81, 83, 86, 88, 91]
    }
  ];

  const LOUDNESS_GAIN = {
    classic: 1, retro: 0.525, funk: 0.75, disco: 0.746, jazz: 0.549, salsa: 0.447, bossa: 0.384, gamelan: 0.807,
    lofi: 0.597, rock: 0.895, reggae: 0.29
  };

  const DEFAULT = 'classic';
  const RANDOM = 'random';
  LIST.forEach((tr) => {
    tr.gain = LOUDNESS_GAIN[tr.id] || 1;
    tr.voices = Object.assign({}, BASE_VOICES, tr.voices);
    tr.fill = tr.fill || SNARE_FILL;
    tr.end = tr.end || DEFAULT_END;
    tr.swing = tr.swing || 0;
  });
  const byId = (id) => LIST.find((t) => t.id === id) || LIST.find((t) => t.id === DEFAULT);
  const CHOICES = LIST.map((t) => ({ id: t.id, name: t.name, desc: t.desc }))
    .concat([{ id: RANDOM, name: 'Random', desc: 'A different soundtrack for each game' }]);
  const isChoice = (id) => CHOICES.some((c) => c.id === id);

  function pick(choice, rng, avoid) {
    if (choice !== RANDOM) return byId(choice).id;
    const pool = LIST.filter((t) => t.id !== avoid);
    return pool[Math.floor((rng || Math.random)() * pool.length) % pool.length].id;
  }

  const ROLES = {
    1: ['K'], 2: ['K', 'S'], 3: ['K', 's', 's'], 4: ['K', 'S', 'k', 'S'], 5: ['K', 's', 's', 'k', 'S']
  };
  const FALLBACK = { K: ['K'], S: ['S', 's'], k: ['k', 'K'], s: ['s', 'S'] };
  const roleFor = (meter, barPos) => { const r = ROLES[meter] || ROLES[4]; return r[barPos % r.length]; };
  const byBar = (v, bar) => (Array.isArray(v) ? v[bar % v.length] : v);
  const stepsPerBeat = (sub) => (sub === 3 ? 6 : 4);

  function beatPatterns(tr, c) {
    const set = c.sub === 3 ? tr.compound : tr.simple;
    const res = stepsPerBeat(c.sub);
    const role = roleFor(c.meter, c.barPos);
    const out = Object.assign({}, FALLBACK[role].map((r) => set[r]).find(Boolean) || {});
    if (c.barPos === c.meter - 1 && set.L) Object.assign(out, set.L);
    Object.keys(out).forEach((slot) => { out[slot] = byBar(out[slot], c.bar) || ''; });
    const bars = c.even && tr.bars && tr.bars[c.meter + 'x' + c.sub];
    if (bars) Object.keys(bars).forEach((slot) => { out[slot] = byBar(bars[slot], c.bar).substr(c.barPos * res, res); });
    return out;
  }

  function stepAt(j, res, swing) {
    if (res !== 4 || !swing) return j / res;
    const mid = 0.5 + swing / 6;
    return [0, mid / 2, mid, mid + (1 - mid) / 2, 1][j];
  }

  function chordTones(chord) {
    const pcs = chord.notes.map((n) => (((Math.round(n) - chord.root) % 12) + 12) % 12);
    const find = (opts, dflt) => { const hit = opts.find((o) => pcs.indexOf(o) >= 0); return hit == null ? dflt : hit; };
    return { third: find([4, 3], 4), fifth: find([7, 6, 8], 7), seventh: find([10, 11, 9], 12) };
  }
  function near(target, ref) {
    let m = target;
    while (m - ref > 6) m -= 12;
    while (ref - m > 6) m += 12;
    return m;
  }

  function notesFor(ch, p, c) {
    const chord = c.chord, oct = p.oct || 0;
    const root = chord.root + oct;
    const tones = chordTones(chord);
    const k = ch.toLowerCase();
    if (p.kind === 'chord') {
      if (k === 'x') return chord.notes.map((n) => n + oct);
      const d = Number(ch);
      if (!d) return null;
      const n = chord.notes.length;
      return [chord.notes[(d - 1) % n] + 12 * Math.floor((d - 1) / n) + oct];
    }
    const nextRoot = near(c.next.root + oct, root);
    const approach = (dir) => [nextRoot + dir];
    switch (k) {
      case 'r': return [root];
      case 'o': return [root + 12];
      case '3': return [root + tones.third];
      case '5': return [root + tones.fifth];
      case '7': return [root + tones.seventh];
      case 'l': return [root + tones.fifth - 12];
      case 'n': return [nextRoot];
      case 'a': return approach(-1);
      case 'b': return approach(1);
      case 'w': {
        if (c.barPos === c.meter - 1 && c.meter > 1) return approach(c.bar % 2 ? 1 : -1);
        const walk = [0, tones.third, tones.fifth, tones.seventh];
        return [root + walk[Math.min(c.barPos, walk.length - 1)]];
      }
      default: return null;
    }
  }

  const isUpper = (ch) => ch !== ch.toLowerCase();

  function beatEvents(tr, c) {
    const pats = beatPatterns(tr, c);
    const res = stepsPerBeat(c.sub);
    const swing = c.sub === 3 ? 0 : tr.swing;
    const out = [];
    Object.keys(pats).forEach((slot) => {
      const p = tr.voices[slot];
      const str = pats[slot];
      if (!p || !str || (p.only && p.only.indexOf(c.phase) < 0)) return;
      for (let j = 0; j < res && j < str.length; j++) {
        const ch = str[j];
        if (ch === '.' || ch === '-') continue;
        let len = 1;
        while (j + len < res && str[j + len] === '-') len++;
        let level, midis = null;
        if (p.kind) {
          midis = notesFor(ch, p, c);
          if (!midis) continue;
          level = isUpper(ch) || /\d/.test(ch) ? 1 : (p.weak == null ? 1 : p.weak);
        } else {
          level = /\d/.test(ch) ? Number(ch) / 9 : 1;
        }
        if (c.chill) {
          if (level < (p.chillMin || 0)) continue;
          level *= p.chill == null ? 0.7 : p.chill;
        }
        const at = stepAt(j, res, swing);
        const dur = p.len === 'bar' ? (c.meter - c.barPos) * (p.legato || 0.95)
          : (stepAt(j + len, res, swing) - at) * (p.legato || 0.85);
        out.push({ slot: slot, at: at, level: level, midis: midis, dur: dur });
      }
    });
    return out;
  }

  const chordAt = (tr, bar) => {
    const e = tr.progression[((bar % tr.progression.length) + tr.progression.length) % tr.progression.length];
    return { root: e[0], notes: e[1] };
  };

  function endNotes(tr, chord) {
    const c = { chord: chord, next: chord, barPos: 0, meter: 4, bar: 0 };
    return tr.end.play.map(([slot, ch, level]) => {
      const p = tr.voices[slot];
      return p && p.kind ? { slot: slot, level: level, midis: notesFor(ch, p, c) } : null;
    }).filter((n) => n && n.midis);
  }

  global.Soundtracks = {
    LIST: LIST, CHOICES: CHOICES, DEFAULT: DEFAULT, RANDOM: RANDOM, byId: byId, isChoice: isChoice, pick: pick,
    roleFor: roleFor, beatPatterns: beatPatterns, beatEvents: beatEvents, stepAt: stepAt, notesFor: notesFor,
    chordTones: chordTones, chordAt: chordAt, endNotes: endNotes
  };
})(typeof window !== 'undefined' ? window : globalThis);
