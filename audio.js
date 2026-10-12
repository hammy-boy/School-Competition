// Fully procedural sound: no asset files. Everything is synthesized on demand.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
  }

  boot() {
    if (this.ctx) return;
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    const ctx = (this.ctx = new C());

    this.master = ctx.createGain();
    this.master.gain.value = 0.9;

    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -16;
    this.comp.knee.value = 24;
    this.comp.ratio.value = 8;
    this.comp.attack.value = 0.003;
    this.comp.release.value = 0.16;

    // cheap room reverb
    this.verb = ctx.createConvolver();
    this.verb.buffer = this._impulse(2.4, 2.6);
    this.verbGain = ctx.createGain();
    this.verbGain.gain.value = 0.3;

    this.master.connect(this.comp);
    this.comp.connect(ctx.destination);
    this.master.connect(this.verb);
    this.verb.connect(this.verbGain);
    this.verbGain.connect(ctx.destination);

    const n = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;

    this.ready = true;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  _impulse(dur, decay) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (1 - t * 0.35);
      }
    }
    return buf;
  }

  _noise({ dur = 0.2, type = 'lowpass', freq = 400, q = 1, peak = 1, attack = 0.004, sweep = 0, curve = 'exp' }) {
    if (!this.ready) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.5;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60, freq + sweep), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    if (curve === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    else g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  _tone({ type = 'sine', f0 = 120, f1 = 60, dur = 0.2, peak = 1, attack = 0.005, detune = 0 }) {
    if (!this.ready) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(f0, t0); o.detune.value = detune;
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  // ---- game sounds -------------------------------------------------------

  /** bone-on-contact: weight scaled 0..1 */
  hit(power = 1) {
    const p = Math.min(2.2, power);
    this._noise({ dur: 0.13 + p * 0.05, type: 'lowpass', freq: 260 + p * 120, peak: 0.85 * p, attack: 0.002 });
    this._tone({ type: 'sine', f0: 150 * (1 + p * 0.2), f1: 42, dur: 0.16, peak: 0.6 * p, attack: 0.002 });
    this._noise({ dur: 0.05, type: 'bandpass', freq: 2100, q: 1.6, peak: 0.34 * p, attack: 0.001 });
  }

  /** wet cracking impact — the uppercut on the jaw */
  crack() {
    this.hit(2.2);
    this._noise({ dur: 0.3, type: 'bandpass', freq: 1200, q: 0.9, peak: 0.5, attack: 0.001, sweep: -700 });
    this._tone({ type: 'triangle', f0: 900, f1: 120, dur: 0.22, peak: 0.18 });
  }

  whoosh(strength = 1) {
    this._noise({ dur: 0.26, type: 'bandpass', freq: 320, q: 0.7, peak: 0.4 * strength, attack: 0.05, sweep: 1500 });
  }

  /** baton / metal smash */
  smash() {
    this._noise({ dur: 0.24, type: 'highpass', freq: 1800, peak: 0.5, attack: 0.001 });
    this._tone({ type: 'square', f0: 420, f1: 90, dur: 0.2, peak: 0.16 });
    this._noise({ dur: 0.5, type: 'bandpass', freq: 3200, q: 3, peak: 0.2, attack: 0.003 });
  }

  /** heavy body against the tool cabinet */
  bodyHit() {
    this._noise({ dur: 0.4, type: 'lowpass', freq: 300, peak: 0.8, attack: 0.004 });
    this._tone({ type: 'sine', f0: 90, f1: 34, dur: 0.5, peak: 0.5 });
    this._noise({ dur: 0.9, type: 'bandpass', freq: 2600, q: 2, peak: 0.24, attack: 0.01 });
  }

  toolsShower() {
    for (let i = 0; i < 9; i++) {
      setTimeout(() => {
        this._noise({ dur: 0.11, type: 'bandpass', freq: 1400 + Math.random() * 3200, q: 5, peak: 0.22, attack: 0.001 });
        this._tone({ type: 'triangle', f0: 500 + Math.random() * 1600, f1: 200, dur: 0.14, peak: 0.07 });
      }, i * 55 + Math.random() * 40);
    }
  }

  creak(pitch = 1) {
    this._tone({ type: 'sawtooth', f0: 190 * pitch, f1: 150 * pitch, dur: 0.34, peak: 0.075, attack: 0.05 });
    this._noise({ dur: 0.3, type: 'bandpass', freq: 900 * pitch, q: 8, peak: 0.09, attack: 0.06 });
  }

  boltsPop() {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        this._noise({ dur: 0.09, type: 'bandpass', freq: 2400, q: 3, peak: 0.4, attack: 0.001 });
        this._tone({ type: 'square', f0: 700, f1: 180, dur: 0.1, peak: 0.1 });
      }, i * 70);
    }
  }

  snap() {
    this._noise({ dur: 0.08, type: 'highpass', freq: 3000, peak: 0.7, attack: 0.0005 });
    this._tone({ type: 'square', f0: 1500, f1: 300, dur: 0.09, peak: 0.14 });
  }

  screech(dur = 1.3) {
    if (!this.ready) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(160, t0);
    o.frequency.linearRampToValueAtTime(300, t0 + dur);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.value = 1400; f.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.14, t0 + 0.15);
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 11;
    const lg = ctx.createGain(); lg.gain.value = 22;
    lfo.connect(lg); lg.connect(o.frequency);
    o.connect(f); f.connect(g); g.connect(this.master);
    o.start(t0); lfo.start(t0); o.stop(t0 + dur); lfo.stop(t0 + dur);
  }

  clatter() {
    for (let i = 0; i < 5; i++) {
      setTimeout(() => this._noise({ dur: 0.08, type: 'bandpass', freq: 2000 + i * 500, q: 6, peak: 0.3, attack: 0.001 }), i * 85);
    }
  }

  step(heavy = 1) {
    this._noise({ dur: 0.1, type: 'lowpass', freq: 300 * heavy, peak: 0.24, attack: 0.002 });
  }

  breath(deep = 1) {
    this._noise({ dur: 0.5 * deep, type: 'bandpass', freq: 620, q: 0.6, peak: 0.075, attack: 0.14, curve: 'lin' });
  }

  heartbeat(strong = 1) {
    this._tone({ type: 'sine', f0: 74, f1: 38, dur: 0.16, peak: 0.42 * strong, attack: 0.006 });
    setTimeout(() => this._tone({ type: 'sine', f0: 62, f1: 30, dur: 0.2, peak: 0.3 * strong, attack: 0.006 }), 190);
  }

  strain() {
    this._noise({ dur: 0.42, type: 'bandpass', freq: 500, q: 4, peak: 0.16, attack: 0.08, sweep: 400, curve: 'lin' });
  }

  flood() {
    this._noise({ dur: 2.6, type: 'lowpass', freq: 1400, peak: 0.3, attack: 0.7, curve: 'lin' });
    this._tone({ type: 'sine', f0: 46, f1: 92, dur: 3.2, peak: 0.22, attack: 1.0 });
  }

  ui() {
    this._tone({ type: 'triangle', f0: 900, f1: 1400, dur: 0.07, peak: 0.08 });
  }

  // ---- Section Two: the silo ---------------------------------------------

  /** the synthetic chime that precedes any automated announcement */
  chime() {
    this._tone({ type: 'sine', f0: 1046, f1: 1046, dur: 0.5, peak: 0.3, attack: 0.004 });
    this._tone({ type: 'triangle', f0: 2093, f1: 1800, dur: 0.4, peak: 0.08, attack: 0.004 });
    setTimeout(() => this._tone({ type: 'sine', f0: 784, f1: 784, dur: 0.7, peak: 0.26, attack: 0.004 }), 420);
    setTimeout(() => this._tone({ type: 'triangle', f0: 1568, f1: 1400, dur: 0.6, peak: 0.07, attack: 0.004 }), 420);
  }

  /** the loudspeaker itself: a gated, band-limited squawk under the voice */
  pa(dur = 4.2) {
    if (!this.ready) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 3.5;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 700;
    const g = ctx.createGain(); g.gain.value = 0.0;
    // syllables: the voice is only ever implied, through the colour of the horn
    for (let i = 0; i < 16; i++) {
      const at = t0 + 0.12 + i * (dur / 17);
      const len = 0.06 + Math.random() * 0.16;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(0.05 + Math.random() * 0.05, at + 0.02);
      g.gain.linearRampToValueAtTime(0.0001, at + len);
    }
    src.connect(f); f.connect(hp); hp.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + dur + 0.3);
    setTimeout(() => this._tone({ type: 'square', f0: 1200, f1: 900, dur: 0.09, peak: 0.05 }), dur * 1000);
  }

  /** red-alert wail, two passes */
  siren(passes = 2) {
    if (!this.ready) return;
    const ctx = this.ctx;
    for (let p = 0; p < passes; p++) {
      const t0 = ctx.currentTime + p * 1.5;
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(420, t0);
      o.frequency.linearRampToValueAtTime(880, t0 + 0.6);
      o.frequency.linearRampToValueAtTime(400, t0 + 1.35);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 2.2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.14, t0 + 0.18);
      g.gain.linearRampToValueAtTime(0.0001, t0 + 1.45);
      o.connect(f); f.connect(g); g.connect(this.master);
      o.start(t0); o.stop(t0 + 1.5);
    }
  }

  /** a tonne of iron coming down a gantry */
  grind(dur = 1.6) {
    this._noise({ dur, type: 'lowpass', freq: 220, peak: 0.4, attack: 0.12, curve: 'lin' });
    this._noise({ dur: dur * 0.8, type: 'bandpass', freq: 1600, q: 1.4, peak: 0.11, attack: 0.2, sweep: -900, curve: 'lin' });
    this._tone({ type: 'square', f0: 58, f1: 44, dur: dur * 0.9, peak: 0.1, attack: 0.15 });
    setTimeout(() => {
      this._noise({ dur: 0.3, type: 'lowpass', freq: 300, peak: 0.7, attack: 0.003 });
      this._tone({ type: 'sine', f0: 120, f1: 40, dur: 0.45, peak: 0.4 });
    }, dur * 900);
  }

  /** knuckles on polycarbonate: it does not give */
  clang() {
    this._noise({ dur: 0.16, type: 'bandpass', freq: 3400, q: 1.2, peak: 0.42, attack: 0.001 });
    this._tone({ type: 'square', f0: 1750, f1: 1200, dur: 0.14, peak: 0.1 });
    this._tone({ type: 'sine', f0: 2640, f1: 2500, dur: 0.5, peak: 0.07, attack: 0.002 });
    this._noise({ dur: 0.4, type: 'highpass', freq: 4200, peak: 0.1, attack: 0.004 });
  }

  /** a fist-sized brass pipe giving way under a fist */
  brass() {
    this._tone({ type: 'triangle', f0: 660, f1: 520, dur: 0.55, peak: 0.3, attack: 0.002 });
    this._tone({ type: 'sine', f0: 1980, f1: 1500, dur: 0.7, peak: 0.12, attack: 0.002 });
    this._noise({ dur: 0.12, type: 'bandpass', freq: 2400, q: 4, peak: 0.35, attack: 0.001 });
  }

  /** the pressure let out of a line, in your face */
  steam(dur = 2.6) {
    if (!this.ready) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true; src.playbackRate.value = 1.4;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.5, t0 + 0.06);
    g.gain.setValueAtTime(0.5, t0 + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 7.3;
    const lg = ctx.createGain(); lg.gain.value = 700;
    lfo.connect(lg); lg.connect(f.frequency);
    src.connect(hp); hp.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0); lfo.start(t0); src.stop(t0 + dur + 0.1); lfo.stop(t0 + dur + 0.1);
  }

  /** boots on steel grating, at a run */
  metalStep(amp = 1) {
    this._noise({ dur: 0.13, type: 'lowpass', freq: 420, peak: 0.3 * amp, attack: 0.002 });
    this._noise({ dur: 0.09, type: 'bandpass', freq: 1900 + Math.random() * 900, q: 3, peak: 0.13 * amp, attack: 0.001 });
    this._tone({ type: 'triangle', f0: 190 + Math.random() * 40, f1: 90, dur: 0.16, peak: 0.09 * amp });
  }

  /** leather and canvas, picked up off a catwalk */
  grabBag() {
    this._noise({ dur: 0.3, type: 'bandpass', freq: 700, q: 1.1, peak: 0.24, attack: 0.05, curve: 'lin' });
    this._noise({ dur: 0.16, type: 'highpass', freq: 2600, peak: 0.12, attack: 0.01 });
  }

  /** ninety metres of nothing, all the way down */
  abyss(dur = 2.6) {
    this._tone({ type: 'sine', f0: 210, f1: 26, dur, peak: 0.4, attack: 0.05 });
    this._noise({ dur, type: 'lowpass', freq: 900, peak: 0.3, attack: 0.25, sweep: -700, curve: 'lin' });
  }

  // ---- Section Three: the turbine crossing -------------------------------

  /** the containment door: metal shrieking down its own rails, then the stop */
  ironShriek(dur = 2.4) {
    if (!this.ready) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true; src.playbackRate.value = 0.7;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3.4;
    f.frequency.setValueAtTime(2600, t0);
    f.frequency.exponentialRampToValueAtTime(620, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.4, t0 + 0.09);
    g.gain.setValueAtTime(0.4, t0 + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const lfo = ctx.createOscillator(); lfo.type = 'sawtooth'; lfo.frequency.value = 17;
    const lg = ctx.createGain(); lg.gain.value = 900;
    lfo.connect(lg); lg.connect(f.frequency);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0); lfo.start(t0); src.stop(t0 + dur + 0.1); lfo.stop(t0 + dur + 0.1);
    // the harmonic scream under it, and the whole shaft taking the final blow
    this._tone({ type: 'sawtooth', f0: 430, f1: 178, dur, peak: 0.13, attack: 0.1 });
    setTimeout(() => {
      this._noise({ dur: 0.5, type: 'lowpass', freq: 260, peak: 0.95, attack: 0.003 });
      this._tone({ type: 'sine', f0: 96, f1: 26, dur: 1.5, peak: 0.62, attack: 0.004 });
      this._noise({ dur: 1.2, type: 'bandpass', freq: 1800, q: 1.1, peak: 0.2, attack: 0.01, sweep: -1200, curve: 'lin' });
    }, dur * 940);
  }

  /** exo-boots spooling up: the half-second warning that decides the exchange */
  exoWhine(charge = 1) {
    if (!this.ready) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const dur = 0.46 * charge;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, t0);
    o.frequency.exponentialRampToValueAtTime(1500, t0 + dur);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.13 * charge, t0 + dur * 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.06);
    o.connect(f); f.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.1);
    this._tone({ type: 'square', f0: 70, f1: 132, dur, peak: 0.05, attack: 0.02 });
  }

  /** a servo-assisted footfall: pneumatic release over a steel deck */
  exoStep(amp = 1) {
    this._noise({ dur: 0.11, type: 'lowpass', freq: 340, peak: 0.34 * amp, attack: 0.002 });
    this._noise({ dur: 0.16, type: 'highpass', freq: 2600, peak: 0.1 * amp, attack: 0.006 });
    this._tone({ type: 'triangle', f0: 240, f1: 96, dur: 0.14, peak: 0.11 * amp });
  }

  /** the drop onto the platform: all of him, from eleven metres */
  scoutLand() {
    this._noise({ dur: 0.34, type: 'lowpass', freq: 220, peak: 0.85, attack: 0.003 });
    this._tone({ type: 'sine', f0: 108, f1: 30, dur: 0.7, peak: 0.55, attack: 0.004 });
    this._noise({ dur: 0.5, type: 'bandpass', freq: 2400, q: 1.6, peak: 0.16, attack: 0.004, sweep: -1400, curve: 'lin' });
    setTimeout(() => this._noise({ dur: 0.3, type: 'highpass', freq: 1800, peak: 0.1, attack: 0.02 }), 60);
  }

  /** weighted steel knuckles arriving in your ribs */
  knuckle() {
    this._noise({ dur: 0.09, type: 'bandpass', freq: 2900, q: 1.4, peak: 0.55, attack: 0.001 });
    this._tone({ type: 'square', f0: 1450, f1: 780, dur: 0.1, peak: 0.16 });
    this._tone({ type: 'sine', f0: 190, f1: 58, dur: 0.3, peak: 0.5, attack: 0.003 });
    this._noise({ dur: 0.26, type: 'lowpass', freq: 400, peak: 0.3, attack: 0.004 });
  }

  /** your fist finds nothing but a jacket: he was already elsewhere */
  slip() {
    this._noise({ dur: 0.2, type: 'highpass', freq: 1500, peak: 0.17, attack: 0.003, sweep: 1400, curve: 'lin' });
    this._noise({ dur: 0.13, type: 'bandpass', freq: 3600, q: 5, peak: 0.1, attack: 0.001 });
  }

  /** two hundred pounds going over the rail under its own momentum */
  hurl() {
    this._noise({ dur: 0.42, type: 'lowpass', freq: 700, peak: 0.4, attack: 0.004, sweep: -420, curve: 'lin' });
    this._tone({ type: 'sine', f0: 320, f1: 74, dur: 0.55, peak: 0.26, attack: 0.01 });
    this._tone({ type: 'triangle', f0: 150, f1: 44, dur: 0.4, peak: 0.2, attack: 0.006 });
    setTimeout(() => this._noise({ dur: 0.5, type: 'bandpass', freq: 900, q: 2, peak: 0.22, attack: 0.01, sweep: -500, curve: 'lin' }), 120);
  }

  /** the shaft takes something it was not designed to take */
  bladeChew() {
    if (!this.ready) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    this._noise({ dur: 0.22, type: 'lowpass', freq: 300, peak: 0.9, attack: 0.002 });
    this._tone({ type: 'sine', f0: 74, f1: 22, dur: 1.6, peak: 0.6, attack: 0.004 });
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true; src.playbackRate.value = 0.55;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.2;
    f.frequency.setValueAtTime(3200, t0);
    f.frequency.exponentialRampToValueAtTime(420, t0 + 1.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.5, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + 1.7);
    // the blade train going out of balance, one pass at a time
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        this._noise({ dur: 0.2, type: 'bandpass', freq: 2600 - i * 260, q: 3, peak: 0.4 - i * 0.05, attack: 0.002 });
        this._tone({ type: 'square', f0: 1900 - i * 220, f1: 900, dur: 0.16, peak: 0.12 });
      }, 90 + i * 165);
    }
  }

  /** the officer's way out, slamming shut behind him */
  hatchSlam() {
    this._noise({ dur: 0.2, type: 'lowpass', freq: 380, peak: 0.7, attack: 0.002 });
    this._tone({ type: 'sine', f0: 150, f1: 44, dur: 0.5, peak: 0.42, attack: 0.003 });
    this._noise({ dur: 0.4, type: 'bandpass', freq: 1500, q: 2, peak: 0.14, attack: 0.006, sweep: -800, curve: 'lin' });
  }

  /** the hydraulic breath of something unlocking behind you */
  doorHiss(dur = 0.8) {
    this._noise({ dur, type: 'bandpass', freq: 2400, q: 0.7, peak: 0.22, attack: 0.05, sweep: -900, curve: 'lin' });
    this._tone({ type: 'sine', f0: 88, f1: 62, dur: dur * 0.7, peak: 0.1, attack: 0.05 });
  }

  /** the fob: a blip whose pitch climbs the closer the answer gets */
  fobPing(rate = 0.4) {
    const r = Math.max(0, Math.min(1, rate));
    this._tone({ type: 'sine', f0: 620 + r * 900, f1: 1180 + r * 1500, dur: 0.09, peak: 0.1 + r * 0.1, attack: 0.002 });
    this._tone({ type: 'triangle', f0: 1860 + r * 2400, f1: 1500, dur: 0.07, peak: 0.035, attack: 0.002 });
  }

  /** the leap: the whole shaft rushing up past your ears */
  leapWind(dur = 2.6) {
    if (!this.ready) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true; src.playbackRate.value = 0.8;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8;
    f.frequency.setValueAtTime(300, t0);
    f.frequency.exponentialRampToValueAtTime(2600, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.42, t0 + dur * 0.65);
    g.gain.linearRampToValueAtTime(0.62, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + dur + 0.1);
    this._tone({ type: 'sine', f0: 160, f1: 34, dur, peak: 0.3, attack: 0.1 });
  }

  // ---- the anomaly: what the rift left in your hands ----------------------

  /** the meter is full: one clean two-tone so you never have to look at the HUD */
  chargeReady() {
    this._tone({ type: 'triangle', f0: 660, f1: 990, dur: 0.14, peak: 0.13, attack: 0.002 });
    setTimeout(() => this._tone({ type: 'triangle', f0: 990, f1: 1320, dur: 0.16, peak: 0.1, attack: 0.002 }), 90);
  }

  /** spending a meter you do not have */
  deny() {
    this._tone({ type: 'square', f0: 150, f1: 96, dur: 0.07, peak: 0.08, attack: 0.002 });
    this._noise({ dur: 0.05, type: 'lowpass', freq: 700, peak: 0.1, attack: 0.002 });
  }

  /** the shockwave: a chest-thump with the air leaving the room after it */
  shockwave(amt = 1) {
    const a = Math.min(1, amt);
    this._tone({ type: 'sine', f0: 120 * (1 + a), f1: 26, dur: 0.55, peak: 0.85 * a, attack: 0.003 });
    this._noise({ dur: 0.3 * (0.5 + a), type: 'lowpass', freq: 900, peak: 0.5 * a, attack: 0.004, sweep: -700, curve: 'lin' });
    this._noise({ dur: 0.16, type: 'bandpass', freq: 2600, q: 1.1, peak: 0.3 * a, attack: 0.001 });
  }

  /** the shift: your body arriving somewhere the air has not agreed to yet */
  shiftBlink() {
    this._tone({ type: 'sine', f0: 1800, f1: 420, dur: 0.16, peak: 0.15, attack: 0.002 });
    this._noise({ dur: 0.2, type: 'highpass', freq: 900, peak: 0.18, attack: 0.004, sweep: 2400, curve: 'lin' });
    setTimeout(() => this._tone({ type: 'triangle', f0: 900, f1: 1700, dur: 0.12, peak: 0.1, attack: 0.003 }), 70);
  }

  /** the anchor: something two hundred pounds forgetting which way down is */
  zeroLock() {
    this._tone({ type: 'sine', f0: 70, f1: 210, dur: 1.5, peak: 0.4, attack: 0.05 });
    this._tone({ type: 'sine', f0: 74, f1: 216, dur: 1.5, peak: 0.28, attack: 0.05, detune: 22 });
    this._noise({ dur: 1.2, type: 'bandpass', freq: 480, q: 4, peak: 0.14, attack: 0.08, sweep: 900, curve: 'lin' });
  }

  /** plasma: armour coming apart at a speed the eye refuses to follow */
  disintegrate() {
    this._noise({ dur: 0.7, type: 'highpass', freq: 1200, peak: 0.38, attack: 0.006, sweep: 5200, curve: 'lin' });
    this._tone({ type: 'sawtooth', f0: 2400, f1: 300, dur: 0.5, peak: 0.12, attack: 0.004 });
    this._tone({ type: 'sine', f0: 190, f1: 40, dur: 0.9, peak: 0.5, attack: 0.01 });
  }

  /** the pull landing: the same chord, tuned by how badly the odds went */
  catalystTake(tier = 'COMMON') {
    const k = { COMMON: 0, RARE: 1, EPIC: 2, MYTHIC: 3 }[tier] ?? 0;
    this._noise({ dur: 1.4, type: 'bandpass', freq: 300, q: 0.8, peak: 0.3, attack: 0.05, sweep: 1600 + k * 900, curve: 'lin' });
    this._tone({ type: 'sine', f0: 96, f1: 44, dur: 1.6, peak: 0.5, attack: 0.02 });
    const root = 220 * Math.pow(2, k / 4);
    [0, 7, 12].forEach((semi, i) => setTimeout(() => this._tone({
      type: i === 2 ? 'triangle' : 'sine',
      f0: root * Math.pow(2, semi / 12), f1: root * Math.pow(2, semi / 12) * 0.995,
      dur: 1.1 - i * 0.1, peak: 0.1 + k * 0.02, attack: 0.02,
    }), 120 + i * 110));
  }

  // ---- persistent ambient bed -------------------------------------------
  startAmbient() {
    if (!this.ready || this.amb) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const g = ctx.createGain(); g.gain.value = 0.0; g.connect(this.master);
    g.gain.linearRampToValueAtTime(1, t0 + 3);

    const rumble = ctx.createBufferSource();
    rumble.buffer = this.noiseBuf; rumble.loop = true; rumble.playbackRate.value = 0.35;
    const rf = ctx.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 110;
    const rg = ctx.createGain(); rg.gain.value = 0.16;
    rumble.connect(rf); rf.connect(rg); rg.connect(g); rumble.start();

    const hum = ctx.createOscillator(); hum.type = 'sine'; hum.frequency.value = 51;
    const hg = ctx.createGain(); hg.gain.value = 0.05;
    hum.connect(hg); hg.connect(g); hum.start();

    const buzz = ctx.createOscillator(); buzz.type = 'sawtooth'; buzz.frequency.value = 121;
    const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 950; bf.Q.value = 12;
    const bg = ctx.createGain(); bg.gain.value = 0.014;
    const trem = ctx.createOscillator(); trem.frequency.value = 0.23;
    const tg = ctx.createGain(); tg.gain.value = 0.012;
    trem.connect(tg); tg.connect(bg.gain);
    buzz.connect(bf); bf.connect(bg); bg.connect(g); buzz.start(); trem.start();

    this.amb = { g, nodes: [rumble, hum, buzz, trem] };
    this._level = 1;
    this._applyEnv(3);          // keep the slow swell the cell opens with
  }

  /** the silo has its own weather: a shaft that deep breathes */
  startSiloAmbient() {
    if (!this.ready || this.siloAmb) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const g = ctx.createGain(); g.gain.value = 0.0; g.connect(this.master);

    const drone = ctx.createOscillator(); drone.type = 'sine'; drone.frequency.value = 33;
    const dg = ctx.createGain(); dg.gain.value = 0.2;
    drone.connect(dg); dg.connect(g); drone.start();

    const beat = ctx.createOscillator(); beat.type = 'sine'; beat.frequency.value = 49.5;
    const bg = ctx.createGain(); bg.gain.value = 0.09;
    beat.connect(bg); bg.connect(g); beat.start();

    const wind = ctx.createBufferSource();
    wind.buffer = this.noiseBuf; wind.loop = true; wind.playbackRate.value = 0.22;
    const wf = ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 320;
    const wg = ctx.createGain(); wg.gain.value = 0.2;
    const swell = ctx.createOscillator(); swell.frequency.value = 0.07;
    const sg = ctx.createGain(); sg.gain.value = 140;
    swell.connect(sg); sg.connect(wf.frequency);
    wind.connect(wf); wf.connect(wg); wg.connect(g); wind.start(); swell.start();

    // somewhere far above, a fan that has been off-balance for years
    const whine = ctx.createOscillator(); whine.type = 'sawtooth'; whine.frequency.value = 214;
    const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 1750; bf.Q.value = 14;
    const bgn = ctx.createGain(); bgn.gain.value = 0.008;
    const wob = ctx.createOscillator(); wob.frequency.value = 0.31;
    const wog = ctx.createGain(); wog.gain.value = 0.006;
    wob.connect(wog); wog.connect(bgn.gain);
    whine.connect(bf); bf.connect(bgn); bgn.connect(g); whine.start(); wob.start();

    this.siloAmb = { g, nodes: [drone, beat, wind, swell, whine, wob] };
    this._applyEnv();
  }

  /** the shaft under the platform: three storeys of blades pulling air down.
   *  Runs under the silo bed for the whole of Section Three, and swells every
   *  time something falls into it. */
  startTurbine() {
    if (!this.ready || this.turb) return;
    const ctx = this.ctx;
    const g = ctx.createGain(); g.gain.value = 0.0; g.connect(this.master);

    const roar = ctx.createBufferSource();
    roar.buffer = this.noiseBuf; roar.loop = true; roar.playbackRate.value = 0.5;
    const rf = ctx.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 240;
    const rg = ctx.createGain(); rg.gain.value = 0.55;
    roar.connect(rf); rf.connect(rg); rg.connect(g); roar.start();

    // nine blades, a shade under four passes a second: a chop you feel in the deck
    const chop = ctx.createOscillator(); chop.type = 'sine'; chop.frequency.value = 27;
    const cg = ctx.createGain(); cg.gain.value = 0.16;
    const shaper = ctx.createOscillator(); shaper.type = 'sine'; shaper.frequency.value = 3.6;
    const sg = ctx.createGain(); sg.gain.value = 0.14;
    shaper.connect(sg); sg.connect(cg.gain);
    chop.connect(cg); cg.connect(g); chop.start(); shaper.start();

    // air accelerating through a hole the size of a room
    const suck = ctx.createBufferSource();
    suck.buffer = this.noiseBuf; suck.loop = true; suck.playbackRate.value = 1.1;
    const sf = ctx.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 900; sf.Q.value = 1.4;
    const sgn = ctx.createGain(); sgn.gain.value = 0.075;
    suck.connect(sf); sf.connect(sgn); sgn.connect(g); suck.start();

    const shaft = ctx.createOscillator(); shaft.type = 'sawtooth'; shaft.frequency.value = 62;
    const hf = ctx.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 380;
    const hg = ctx.createGain(); hg.gain.value = 0.05;
    shaft.connect(hf); hf.connect(hg); hg.connect(g); shaft.start();

    this.turb = { g, rf, cg, sf };
    this.setTurbine(0.7, 3);
  }

  /** level 0..1.6, arrived at over `dur` seconds */
  setTurbine(level, dur = 0.8) {
    if (!this.turb) return;
    const t = this.ctx.currentTime;
    const L = Math.max(0, level);
    const { g, rf, cg, sf } = this.turb;
    for (const [param, to] of [[g.gain, L], [rf.frequency, 240 + L * 230], [cg.gain, 0.16 + L * 0.2], [sf.frequency, 900 + L * 700]]) {
      param.cancelScheduledValues(t);
      param.setValueAtTime(param.value, t);
      param.linearRampToValueAtTime(to, t + dur);
    }
  }

  /** 'cell' or 'silo' — only one bed plays at a time */
  setEnv(which) {
    this.env = which;
    if (which === 'silo') this.startSiloAmbient();
    this._applyEnv(1.6);
  }

  _applyEnv(dur = 1.2) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const active = this.env === 'silo' ? this.siloAmb : this.amb;
    for (const bed of [this.amb, this.siloAmb]) {
      if (!bed) continue;
      bed.g.gain.cancelScheduledValues(t);
      bed.g.gain.setValueAtTime(bed.g.gain.value, t);
      bed.g.gain.linearRampToValueAtTime(bed === active ? (this._level ?? 1) : 0, t + dur);
    }
  }

  duckAmbient(amount = 0.4, dur = 0.6) {
    this._level = amount;
    this._applyEnv(dur);
  }
}
