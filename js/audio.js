/*
 * audio.js — a small Web Audio drum machine and bass for the backing track.
 * Every sound is synthesized, so there are no audio files to load.
 */
(function (global) {
  'use strict';

  const Ctx = global.AudioContext || global.webkitAudioContext;

  // I – V – vi – IV in D major (violin-friendly). Bass root and triad for each bar.
  const PROGRESSION = [
    { bass: 73.42, chord: [293.66, 369.99, 440.0] },    // D
    { bass: 55.0, chord: [277.18, 329.63, 440.0] },     // A
    { bass: 61.74, chord: [293.66, 369.99, 493.88] },   // Bm
    { bass: 49.0, chord: [293.66, 392.0, 493.88] }      // G
  ];
  // Pentatonic bells for each card as it appears.
  const BELLS = [587.33, 659.25, 739.99, 880.0, 987.77, 1174.66, 1318.51, 1479.98];

  function Engine() {
    this.ctx = null;
    this.master = null;
    this.bus = null;
    this.noise = null;
    this.volume = 0.8;
    this.level = 1;          // scales the groove; lowered while the computer claps
  }

  Engine.prototype.init = function () {
    if (this.ctx) return this.ctx;
    const ctx = new Ctx();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(comp);
    const len = ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buf;
    this.ctx = ctx;
    this.newBus();
    return ctx;
  };

  // A fresh output bus. Dropping the old one silences anything already scheduled on it.
  Engine.prototype.newBus = function () {
    if (this.bus) {
      const old = this.bus;
      old.gain.setValueAtTime(old.gain.value, this.ctx.currentTime);
      old.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.03);
      setTimeout(() => { try { old.disconnect(); } catch (e) { /* already gone */ } }, 120);
    }
    this.bus = this.ctx.createGain();
    this.bus.connect(this.master);
  };

  Engine.prototype.setVolume = function (v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  };

  Engine.prototype.env = function (t, peak, attack, decay) {
    const gn = this.ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * this.level), t + attack);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    gn.connect(this.bus);
    return gn;
  };

  Engine.prototype.noiseSrc = function (t, dur) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur);
    return src;
  };

  Engine.prototype.kick = function (t, v) {
    const osc = this.ctx.createOscillator();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    osc.connect(this.env(t, v || 1, 0.003, 0.38));
    osc.start(t);
    osc.stop(t + 0.42);
    const click = this.noiseSrc(t, 0.02);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2500;
    click.connect(hp);
    hp.connect(this.env(t, 0.25 * (v || 1), 0.001, 0.015));
  };

  Engine.prototype.snare = function (t, v) {
    v = v || 0.7;
    const n = this.noiseSrc(t, 0.25);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1900;
    bp.Q.value = 0.7;
    n.connect(bp);
    bp.connect(this.env(t, v, 0.002, 0.2));
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(160, t + 0.08);
    osc.connect(this.env(t, v * 0.6, 0.002, 0.09));
    osc.start(t);
    osc.stop(t + 0.12);
  };

  Engine.prototype.hat = function (t, v, open) {
    const n = this.noiseSrc(t, open ? 0.3 : 0.06);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7500;
    n.connect(hp);
    hp.connect(this.env(t, v || 0.25, 0.001, open ? 0.25 : 0.045));
  };

  Engine.prototype.crash = function (t, v) {
    const n = this.noiseSrc(t, 1.6);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 4200;
    n.connect(hp);
    hp.connect(this.env(t, v || 0.35, 0.002, 1.4));
  };

  Engine.prototype.bass = function (t, freq, dur, v) {
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 5;
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(220, t + dur);
    osc.connect(lp);
    lp.connect(this.env(t, v || 0.35, 0.005, dur));
    osc.start(t);
    osc.stop(t + dur + 0.05);
  };

  Engine.prototype.stab = function (t, freqs, dur, v) {
    const out = this.env(t, v || 0.12, 0.004, dur);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    lp.connect(out);
    freqs.forEach((f) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = f;
      osc.connect(lp);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    });
  };

  Engine.prototype.bell = function (t, freq, v) {
    [1, 2].forEach((mult, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = i ? 'sine' : 'triangle';
      osc.frequency.value = freq * mult;
      osc.connect(this.env(t, (v || 0.3) / (i + 1), 0.003, 0.35));
      osc.start(t);
      osc.stop(t + 0.4);
    });
  };

  Engine.prototype.stick = function (t, accent) {
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = accent ? 1760 : 1320;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = accent ? 1760 : 1320;
    bp.Q.value = 6;
    osc.connect(bp);
    bp.connect(this.env(t, accent ? 0.7 : 0.5, 0.001, 0.05));
    osc.start(t);
    osc.stop(t + 0.07);
  };

  // A hand clap: quick noise bursts and a short tail, a body band plus a bright snap, loud
  // enough to stand out over the groove.
  Engine.prototype.clap = function (t, v) {
    v = (v || 1) * 2.6;
    const ctx = this.ctx;
    const body = ctx.createBiquadFilter();
    body.type = 'bandpass';
    body.frequency.value = 1400;
    body.Q.value = 0.7;
    body.connect(this.bus);
    const snap = ctx.createBiquadFilter();
    snap.type = 'highpass';
    snap.frequency.value = 2800;
    const snapGain = ctx.createGain();
    snapGain.gain.value = 0.55;
    snap.connect(snapGain);
    snapGain.connect(this.bus);
    [0, 0.008, 0.017, 0.027].forEach((dt, i) => {
      const last = i === 3;
      const n = this.noiseSrc(t + dt, last ? 0.25 : 0.03);
      const g = ctx.createGain();
      const peak = v * (last ? 1 : 0.75);
      g.gain.setValueAtTime(0.0001, t + dt);
      g.gain.exponentialRampToValueAtTime(peak, t + dt + 0.001);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dt + (last ? 0.2 : 0.014));
      n.connect(g);
      g.connect(body);
      g.connect(snap);
    });
  };

  // What each beat of the bar does, by number of beats: K = strong kick, k = kick, S = snare, s = light snare.
  const ROLES = {
    1: ['K'], 2: ['K', 'S'], 3: ['K', 's', 's'], 4: ['K', 'S', 'k', 'S'], 5: ['K', 's', 's', 'k', 'S']
  };

  /*
   * One beat of the groove.
   * b = { t, spb (seconds in this beat), barPos, meter (beats per bar), sub (2 or 3 divisions),
   *       bar, phase, fill, crash, bell, duck }
   *   phase: 'count' | 'reveal' | 'say' | 'review' | 'break' | 'end'
   *   duck: play the groove quieter so claps stand out
   */
  Engine.prototype.playBeat = function (b) {
    this.level = b.duck ? 0.45 : 1;
    try { this.playBeatInner(b); } finally { this.level = 1; }
  };

  Engine.prototype.playBeatInner = function (b) {
    const t = b.t, spb = b.spb;
    const sub = b.sub || 2, step = spb / sub;
    const chord = PROGRESSION[b.bar % PROGRESSION.length];
    const down = b.barPos === 0;
    const meter = b.meter || 4;

    if (b.phase === 'count') {
      this.stick(t, down);
      for (let j = 1; j < sub; j++) this.hat(t + j * step, 0.12);
      return;
    }
    if (b.phase === 'end') {
      this.kick(t, 1);
      this.crash(t, 0.45);
      this.bass(t, chord.bass, spb * 2.5, 0.4);
      this.stab(t, PROGRESSION[0].chord, spb * 2.5, 0.14);
      return;
    }

    const chill = b.phase === 'review' || b.phase === 'break';
    if (b.crash) this.crash(t);

    // Drums
    const role = (ROLES[meter] || ROLES[4])[b.barPos % (ROLES[meter] || ROLES[4]).length];
    const duple = meter === 2 || meter === 4;
    if (role === 'K') this.kick(t, 1);
    else if (role === 'k') this.kick(t, chill ? 0.7 : 0.85);
    else if (!chill && duple) this.kick(t, 0.6);
    else if (!chill) this.kick(t, 0.45);
    if (role === 'S') this.snare(t, chill ? 0.4 : 0.75);
    else if (role === 's') this.snare(t, chill ? 0.25 : 0.45);
    for (let j = 0; j < sub; j++) {
      const open = j === sub - 1 && b.phase === 'say' && b.barPos === meter - 1;
      this.hat(t + j * step, j === 0 ? (chill ? 0.1 : 0.16) : (chill ? 0.14 : 0.24), open);
    }

    // Bass and chords
    if (meter === 3 && sub === 2) {
      // Waltz: bass on 1, chords on 2 and 3.
      if (down) this.bass(t, chord.bass * 2, spb * 0.9, 0.38);
      else this.stab(t, chord.chord, spb * 0.35, chill ? 0.06 : 0.09);
    } else {
      this.bass(t, chord.bass * 2, step * 0.85, 0.36);
      if (!chill) this.bass(t + (sub - 1) * step, chord.bass * 4, step * 0.6, 0.22);
      if (role === 'S' || role === 's') this.stab(t + (sub - 1) * step, chord.chord, step * 0.6, chill ? 0.06 : 0.1);
    }

    if (b.bell != null) this.bell(t, BELLS[b.bell % BELLS.length]);

    // A snare fill leading into the next section.
    if (b.fill) {
      for (let i = 0; i < 4; i++) this.snare(t + (i * spb) / 4, 0.3 + i * 0.15);
    }
  };

  global.BeatEngine = Engine;
})(window);
