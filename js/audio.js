/*
 * audio.js — a small Web Audio drum machine, bass and chords for the backing track.
 * Every sound is synthesized, so there are no audio files to load. The music itself
 * (patterns, chords, instruments) is data in js/soundtracks.js; this file has the
 * synth voices and plays one beat at a time.
 */
(function (global) {
  'use strict';

  const Ctx = global.AudioContext || global.webkitAudioContext;
  const TRACKS = global.Soundtracks;

  /*
   * Output levels. Everything goes through a compressor and then a hard ceiling at 0.99, so the
   * output never reaches full scale (1.0). The clap has its own volume, separate from the music:
   * CLAP_GAIN_FULL is the clap's gain at 100%, measured with tools/measure_audio.html so a clap
   * on its own peaks at about 0.99.
   */
  const PEAK_CEILING = 0.99;
  const CLAP_GAIN_FULL = 0.565;
  const MIN_CLAP_VOLUME = 0.1;

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function Engine() {
    this.ctx = null;
    this.master = null;
    this.bus = null;
    this.noise = null;
    this.volume = 0.8;
    this.level = 1;          // scales the groove; lowered while the computer claps
    this.clapVolume = 1;     // 0.1 to 1 (10% to 100%)
    this.track = TRACKS.byId(TRACKS.DEFAULT);
    this.waves = {};
  }

  // A hard limit: the waveshaper passes everything below the ceiling unchanged and flattens anything above it.
  function ceiling(ctx) {
    const shaper = ctx.createWaveShaper();
    const n = 4097;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.max(-PEAK_CEILING, Math.min(PEAK_CEILING, x));
    }
    shaper.curve = curve;
    shaper.oversample = 'none';
    return shaper;
  }

  // ctxOverride: an OfflineAudioContext, for measuring levels (tools/measure_audio.html).
  Engine.prototype.init = function (ctxOverride) {
    if (this.ctx) return this.ctx;
    const ctx = ctxOverride || new Ctx();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    const limit = ceiling(ctx);
    comp.connect(limit);
    limit.connect(ctx.destination);
    this.comp = comp;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(comp);
    // The clap skips the music volume and has its own.
    this.clapMaster = ctx.createGain();
    this.clapMaster.gain.value = CLAP_GAIN_FULL * this.clapVolume;
    this.clapMaster.connect(comp);
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
    [this.bus, this.clapBus].forEach((old) => {
      if (!old) return;
      old.gain.setValueAtTime(old.gain.value, this.ctx.currentTime);
      old.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.03);
      setTimeout(() => { try { old.disconnect(); } catch (e) { /* already gone */ } }, 120);
    });
    this.bus = this.ctx.createGain();
    this.bus.gain.value = this.track.gain;
    this.bus.connect(this.master);
    this.clapBus = this.ctx.createGain();
    this.clapBus.connect(this.clapMaster);
  };

  Engine.prototype.setSoundtrack = function (id) {
    this.track = TRACKS.byId(id);
    if (this.bus) this.bus.gain.setValueAtTime(this.track.gain, this.ctx.currentTime);
  };

  // Clap volume, 0.1 (10%) to 1 (100%).
  Engine.prototype.setClapVolume = function (v) {
    this.clapVolume = Math.min(1, Math.max(MIN_CLAP_VOLUME, v));
    if (this.clapMaster) this.clapMaster.gain.setTargetAtTime(CLAP_GAIN_FULL * this.clapVolume, this.ctx.currentTime, 0.02);
  };

  Engine.prototype.setVolume = function (v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  };

  /* ---------------- building blocks ---------------- */

  Engine.prototype.env = function (t, peak, attack, decay) {
    const gn = this.ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * this.level), t + attack);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    gn.connect(this.bus);
    return gn;
  };

  Engine.prototype.shape = function (t, peak, p, dur) {
    const gn = this.ctx.createGain();
    const top = Math.max(0.0002, peak * this.level);
    const attack = p.attack || 0.004, decay = p.decay || 0.3, sustain = p.sustain || 0, release = p.release || 0.05;
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.linearRampToValueAtTime(top, t + attack);
    let end;
    if (sustain > 0) {
      gn.gain.setTargetAtTime(top * sustain, t + attack, decay / 3);
      const off = Math.max(t + attack, t + dur);
      gn.gain.setTargetAtTime(0.0001, off, release / 3);
      end = off + release * 2;
    } else {
      gn.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
      end = t + attack + decay;
    }
    gn.connect(this.bus);
    return { node: gn, end: end };
  };

  Engine.prototype.noiseSrc = function (t, dur) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur);
    return src;
  };

  Engine.prototype.filter = function (type, freq, q) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    if (q != null) f.Q.value = q;
    return f;
  };

  Engine.prototype.pulseWave = function (duty) {
    const key = String(duty);
    if (this.waves[key]) return this.waves[key];
    const n = 64;
    const real = new Float32Array(n), imag = new Float32Array(n);
    for (let k = 1; k < n; k++) {
      const a = (2 / (k * Math.PI)) * Math.sin(Math.PI * k * duty);
      real[k] = a * Math.cos(Math.PI * k * duty);
      imag[k] = a * Math.sin(Math.PI * k * duty);
    }
    this.waves[key] = this.ctx.createPeriodicWave(real, imag);
    return this.waves[key];
  };

  Engine.prototype.osc = function (type, freq, t, end, duty) {
    const o = this.ctx.createOscillator();
    if (type === 'pulse') o.setPeriodicWave(this.pulseWave(duty || 0.25));
    else o.type = type;
    o.frequency.value = freq;
    o.start(t);
    o.stop(end + 0.02);
    return o;
  };

  function driveCurve(k) {
    const n = 1024, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(k * x) / Math.tanh(k);
    }
    return curve;
  }

  const VOICES = {
    kick(e, t, v, p) {
      const decay = p.decay || 0.38;
      const o = e.osc(p.type || 'sine', p.f0 || 150, t, t + decay + 0.04);
      o.frequency.setValueAtTime(p.f0 || 150, t);
      o.frequency.exponentialRampToValueAtTime(p.f1 || 42, t + (p.bend || 0.13));
      o.connect(e.env(t, v, 0.003, decay));
      const click = p.click == null ? 0.25 : p.click;
      if (click) {
        const hp = e.filter('highpass', 2500);
        e.noiseSrc(t, 0.02).connect(hp);
        hp.connect(e.env(t, click * v, 0.001, 0.015));
      }
    },

    snare(e, t, v, p) {
      const bp = e.filter(p.filter || 'bandpass', p.bp || 1900, p.q || 0.7);
      e.noiseSrc(t, (p.decay || 0.2) + 0.05).connect(bp);
      bp.connect(e.env(t, v, 0.002, p.decay || 0.2));
      const tone = p.tone == null ? 0.6 : p.tone;
      if (tone) {
        const o = e.osc('triangle', p.f0 || 220, t, t + 0.12);
        o.frequency.setValueAtTime(p.f0 || 220, t);
        o.frequency.exponentialRampToValueAtTime(p.f1 || 160, t + 0.08);
        o.connect(e.env(t, v * tone, 0.002, 0.09));
      }
    },

    hat(e, t, v, p) {
      const decay = p.decay || (p.open ? 0.25 : 0.045);
      const hp = e.filter('highpass', p.freq || 7500);
      e.noiseSrc(t, decay + 0.05).connect(hp);
      hp.connect(e.env(t, v, 0.001, decay));
    },

    cymbal(e, t, v, p) {
      const decay = p.decay || 0.05;
      const hp = e.filter('highpass', p.cutoff || 7000);
      const bp = e.filter('bandpass', p.band || 10000, 0.6);
      const out = e.env(t, v, 0.001, decay);
      [205.3, 304.4, 369.6, 522.7, 540, 800].forEach((f) => {
        e.osc('square', f * (p.mult || 1), t, t + decay + 0.05).connect(hp);
      });
      hp.connect(bp);
      bp.connect(out);
      const n = e.filter('highpass', 6000);
      e.noiseSrc(t, decay + 0.05).connect(n);
      n.connect(e.env(t, v * (p.noise == null ? 0.5 : p.noise), 0.001, decay * 0.7));
    },

    crash(e, t, v, p) {
      const hp = e.filter('highpass', p.freq || 4200);
      e.noiseSrc(t, (p.decay || 1.4) + 0.2).connect(hp);
      hp.connect(e.env(t, v, 0.002, p.decay || 1.4));
    },

    handclap(e, t, v, p) {
      const bp = e.filter('bandpass', p.freq || 1200, 0.8);
      bp.connect(e.bus);
      [0, 0.009, 0.019, 0.03].forEach((dt, i) => {
        const last = i === 3;
        const g = e.ctx.createGain();
        const peak = Math.max(0.0002, v * e.level * (last ? 1 : 0.7));
        g.gain.setValueAtTime(0.0001, t + dt);
        g.gain.exponentialRampToValueAtTime(peak, t + dt + 0.001);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dt + (last ? (p.decay || 0.16) : 0.012));
        e.noiseSrc(t + dt, last ? 0.25 : 0.03).connect(g);
        g.connect(bp);
      });
    },

    wood(e, t, v, p) {
      const decay = p.decay || 0.05;
      const o = e.osc(p.type || 'sine', p.freq || 2500, t, t + decay + 0.02);
      o.connect(e.env(t, v, 0.001, decay));
      if (p.noise) {
        const bp = e.filter('bandpass', p.freq || 2500, 2);
        e.noiseSrc(t, 0.03).connect(bp);
        bp.connect(e.env(t, v * p.noise, 0.001, 0.02));
      }
    },

    tom(e, t, v, p, x) {
      const f = (p.freq || 120) * ((x && x.mult) || 1);
      const decay = p.decay || 0.3;
      const o = e.osc('sine', f, t, t + decay + 0.04);
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * (p.drop || 0.6), t + (p.bend || 0.1));
      o.connect(e.env(t, v, 0.002, decay));
      if (p.slap) {
        const bp = e.filter('bandpass', f * 6, 1.2);
        e.noiseSrc(t, 0.05).connect(bp);
        bp.connect(e.env(t, v * p.slap, 0.001, 0.04));
      }
    },

    cowbell(e, t, v, p) {
      const k = p.mult || 1, decay = p.decay || 0.25;
      const bp = e.filter('bandpass', 900 * k, 2.5);
      bp.connect(e.env(t, v, 0.001, decay));
      [540, 800].forEach((f) => e.osc('square', f * k, t, t + decay + 0.05).connect(bp));
    },

    shaker(e, t, v, p) {
      const hp = e.filter('bandpass', p.freq || 7000, 0.9);
      e.noiseSrc(t, 0.1).connect(hp);
      const g = e.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(Math.max(0.0002, v * e.level), t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (p.decay || 0.07));
      hp.connect(g);
      g.connect(e.bus);
    },

    stick(e, t, v, p, x) {
      const accent = x && x.accent;
      const f = (p.freq || 1320) * (accent ? 4 / 3 : 1);
      const bp = e.filter('bandpass', f, 6);
      e.osc('square', f, t, t + 0.07).connect(bp);
      bp.connect(e.env(t, v * (accent ? 0.7 : 0.5), 0.001, 0.05));
    },

    tone(e, t, v, p, x) {
      const oscs = p.osc || [{ type: p.type || 'square' }];
      const env = p.decay == null && !p.sustain ? Object.assign({}, p, { decay: x.dur }) : p;
      x.freqs.forEach((freq, i) => {
        const at = t + i * (p.strum || 0);
        const sh = e.shape(at, v, env, Math.max(0.01, x.dur - i * (p.strum || 0)));
        let head = sh.node;
        if (p.cutoff) {
          const f = e.filter(p.filter || 'lowpass', p.cutoff, p.q == null ? 1 : p.q);
          if (p.sweep) {
            f.frequency.setValueAtTime(p.cutoff, at);
            f.frequency.exponentialRampToValueAtTime(p.sweep, at + (p.sweepTime || x.dur));
          }
          f.connect(head);
          head = f;
        }
        if (p.drive) {
          const ws = e.ctx.createWaveShaper();
          ws.curve = driveCurve(p.drive);
          ws.connect(head);
          head = ws;
        }
        const norm = 1 / Math.sqrt(oscs.length);
        oscs.forEach((o) => {
          const osc = e.osc(o.type, freq * (o.mult || 1), at, sh.end, o.duty);
          if (o.detune) osc.detune.value = o.detune;
          const g = e.ctx.createGain();
          g.gain.value = norm * (o.gain == null ? 1 : o.gain);
          osc.connect(g);
          g.connect(head);
        });
      });
    },

    fm(e, t, v, p, x) {
      const freqs = x && x.freqs ? x.freqs : [p.freq || 880];
      const dur = x && x.dur ? x.dur : 0.3;
      freqs.forEach((f, i) => {
        const at = t + i * (p.strum || 0);
        const sh = e.shape(at, v, { attack: p.attack || 0.002, decay: p.decay || 1, sustain: p.sustain || 0,
          release: p.release || 0.2 }, dur);
        const car = e.osc('sine', f, at, sh.end);
        const mod = e.osc('sine', f * (p.ratio || 1), at, sh.end);
        const mg = e.ctx.createGain();
        const idx = (p.index || 1) * f;
        mg.gain.setValueAtTime(idx, at);
        mg.gain.exponentialRampToValueAtTime(Math.max(0.01, idx * (p.indexEnd || 0.15)), at + (p.bright || 0.25));
        mod.connect(mg);
        mg.connect(car.frequency);
        car.connect(sh.node);
      });
    },

    metal(e, t, v, p, x) {
      const freqs = x && x.freqs ? x.freqs : [p.freq || 600];
      const partials = p.partials || [[1, 1], [2.76, 0.35], [5.4, 0.12]];
      const decay = p.decay || 1.2;
      freqs.forEach((f) => {
        partials.forEach(([mult, amp], i) => {
          const d = decay / (1 + i * 1.5);
          e.osc('sine', f * mult, t, t + d + 0.05).connect(e.env(t, v * amp, 0.002, d));
        });
        const bp = e.filter('bandpass', f * 4, 1.5);
        e.noiseSrc(t, 0.03).connect(bp);
        bp.connect(e.env(t, v * 0.25, 0.001, 0.02));
      });
    },

    gong(e, t, v, p, x) {
      const f = x && x.freqs ? x.freqs[0] : (p.freq || 55);
      const decay = p.decay || 3;
      [[1, 1], [1.006, 0.7], [2.02, 0.25], [2.97, 0.12]].forEach(([mult, amp], i) => {
        const o = e.osc('sine', f * mult, t, t + decay + 0.1);
        o.connect(e.env(t, v * amp, i ? 0.03 : 0.008, decay / (1 + i * 0.6)));
      });
    },

    coin(e, t, v, p, x) {
      const f = x && x.freqs ? x.freqs[0] : 988;
      [[0, 1, 0.07], [0.07, 4 / 3, 0.3]].forEach(([dt, mult, dur]) => {
        const o = e.osc('pulse', f * mult, t + dt, t + dt + dur, 0.5);
        o.connect(e.env(t + dt, v, 0.002, dur));
      });
    },

    bell(e, t, v, p, x) {
      const f = x && x.freqs ? x.freqs[0] : 880;
      [1, 2].forEach((mult, i) => {
        const o = e.osc(i ? 'sine' : 'triangle', f * mult, t, t + 0.4);
        o.connect(e.env(t, v / (i + 1), 0.003, 0.35));
      });
    }
  };

  Engine.prototype.hit = function (slot, t, level, extra) {
    const p = this.track.voices[slot];
    if (!p || level <= 0) return;
    VOICES[p.voice](this, t, level * (p.gain == null ? 1 : p.gain), p, extra || {});
  };

  Engine.prototype.stick = function (t, accent) { VOICES.stick(this, t, 1, {}, { accent: accent }); };

  // A hand clap: quick noise bursts and a short tail, a body band plus a bright snap, loud
  // enough to stand out over the groove.
  Engine.prototype.clap = function (t, v) {
    v = (v || 1) * 2.6;
    const ctx = this.ctx;
    const body = ctx.createBiquadFilter();
    body.type = 'bandpass';
    body.frequency.value = 1400;
    body.Q.value = 0.7;
    body.connect(this.clapBus);
    const snap = ctx.createBiquadFilter();
    snap.type = 'highpass';
    snap.frequency.value = 2800;
    const snapGain = ctx.createGain();
    snapGain.gain.value = 0.55;
    snap.connect(snapGain);
    snapGain.connect(this.clapBus);
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

  /*
   * One beat of the groove.
   * b = { t, spb (seconds in this beat), barPos, meter (beats per bar), sub (2 or 3 divisions),
   *       even (all beats in the bar the same length), bar, phase, fill, crash, bell, duck }
   *   phase: 'count' | 'reveal' | 'say' | 'review' | 'break' | 'end'
   *   duck: play the groove quieter so claps stand out
   */
  Engine.prototype.playBeat = function (b) {
    this.level = b.duck ? 0.45 : 1;
    try { this.playBeatInner(b); } finally { this.level = 1; }
  };

  Engine.prototype.playBeatInner = function (b) {
    const tr = this.track;
    const t = b.t, spb = b.spb;
    const sub = b.sub || 2;
    const meter = b.meter || 4;
    const prog = tr.progression;

    if (b.phase === 'count') {
      this.hit('count', t, 1, { accent: b.barPos === 0 });
      for (let j = 1; j < sub; j++) this.hit('countSub', t + (j * spb) / sub, 1);
      return;
    }
    if (b.phase === 'end') {
      const end = tr.end;
      const hold = spb * end.beats;
      this.hit('kick', t, end.kick);
      this.hit('crash', t, end.crash);
      const tonic = TRACKS.chordAt(tr, 0);
      TRACKS.endNotes(tr, tonic).forEach((n) => this.hit(n.slot, t, n.level, { freqs: n.midis.map(mtof), dur: hold }));
      return;
    }

    if (b.crash) this.hit('crash', t, 1);
    const chill = b.phase === 'review' || b.phase === 'break';
    const events = TRACKS.beatEvents(tr, {
      meter: meter, sub: sub, barPos: b.barPos, bar: b.bar || 0, even: b.even !== false, phase: b.phase, chill: chill,
      chord: TRACKS.chordAt(tr, b.bar || 0), next: TRACKS.chordAt(tr, (b.bar || 0) + 1)
    });
    events.forEach((ev) => {
      this.hit(ev.slot, t + ev.at * spb, ev.level, ev.midis ? { freqs: ev.midis.map(mtof), dur: ev.dur * spb } : null);
    });

    if (b.bell != null) this.hit('bell', t, 1, { freqs: [mtof(tr.bells[b.bell % tr.bells.length])], dur: spb });

    // A fill leading into the next section.
    if (b.fill) tr.fill.forEach(([at, slot, level, mult]) => this.hit(slot, t + at * spb, level, { mult: mult }));
  };

  Engine.CLAP_GAIN_FULL = CLAP_GAIN_FULL;
  Engine.PEAK_CEILING = PEAK_CEILING;
  Engine.VOICES = VOICES;
  global.BeatEngine = Engine;
})(window);
