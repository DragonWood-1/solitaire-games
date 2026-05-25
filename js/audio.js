/* SolitaireRealm - Audio Engine (Web Audio API, all synthesized) */
'use strict';

class AudioEngine {
  constructor() {
    this._ctx = null;
    this._masterGain = null;
    this._enabled = true;
    this._volume = 0.7;
    this._ambientType = 'none';
    this._ambientNodes = [];
    this._ambientGain = null;
    this._initialized = false;
  }

  _init() {
    if (this._initialized) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      this._ctx = new AudioContext();
      this._masterGain = this._ctx.createGain();
      this._masterGain.gain.value = this._volume;
      this._masterGain.connect(this._ctx.destination);
      this._ambientGain = this._ctx.createGain();
      this._ambientGain.gain.value = 0.3;
      this._ambientGain.connect(this._masterGain);
      this._initialized = true;
      return true;
    } catch (e) {
      return false;
    }
  }

  _resume() {
    if (this._ctx && this._ctx.state === 'suspended') {
      this._ctx.resume();
    }
  }

  _play(fn) {
    if (!this._enabled) return;
    if (!this._init()) return;
    this._resume();
    try { fn(); } catch(e) {}
  }

  // ==========================================
  // Sound Effects
  // ==========================================

  playCardFlip() {
    this._play(() => {
      const ctx = this._ctx;
      const t = ctx.currentTime;

      // Noise burst
      const bufferSize = ctx.sampleRate * 0.04;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(3000, t);
      filter.frequency.linearRampToValueAtTime(800, t + 0.04);
      filter.Q.value = 0.5;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.6, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.05);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(this._masterGain);
      source.start(t);
    });
  }

  playCardPlace() {
    this._play(() => {
      const ctx = this._ctx;
      const t = ctx.currentTime;

      // Soft thud
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.1);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

      // Add click noise
      const bufSize = ctx.sampleRate * 0.015;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.2));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.3, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);

      osc.connect(gain);
      noise.connect(noiseGain);
      gain.connect(this._masterGain);
      noiseGain.connect(this._masterGain);
      osc.start(t);
      osc.stop(t + 0.15);
      noise.start(t);
    });
  }

  playDraw() {
    this._play(() => {
      const ctx = this._ctx;
      const t = ctx.currentTime;

      const bufSize = Math.floor(ctx.sampleRate * 0.06);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 1.5) * 0.6;
      }

      const source = ctx.createBufferSource();
      source.buffer = buf;

      const filter = ctx.createBiquadFilter();
      filter.type = 'highshelf';
      filter.frequency.value = 2000;
      filter.gain.value = 6;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.07);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(this._masterGain);
      source.start(t);
    });
  }

  playWin() {
    this._play(() => {
      const ctx = this._ctx;
      const t = ctx.currentTime;

      // Ascending arpeggio: C E G C E G (major chord up)
      const notes = [261.63, 329.63, 392.00, 523.25, 659.26, 783.99];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;

        const gain = ctx.createGain();
        const startT = t + i * 0.09;
        gain.gain.setValueAtTime(0, startT);
        gain.gain.linearRampToValueAtTime(0.4, startT + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.4);

        osc.connect(gain);
        gain.connect(this._masterGain);
        osc.start(startT);
        osc.stop(startT + 0.45);
      });

      // Fanfare chord at end
      const fanfareT = t + 0.7;
      [523.25, 659.26, 783.99, 1046.5].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.3, fanfareT);
        gain.gain.exponentialRampToValueAtTime(0.001, fanfareT + 1.5);
        osc.connect(gain);
        gain.connect(this._masterGain);
        osc.start(fanfareT);
        osc.stop(fanfareT + 1.6);
      });
    });
  }

  playError() {
    this._play(() => {
      const ctx = this._ctx;
      const t = ctx.currentTime;

      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, t);
      osc.frequency.linearRampToValueAtTime(150, t + 0.15);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

      osc.connect(gain);
      gain.connect(this._masterGain);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  }

  playAchievement() {
    this._play(() => {
      const ctx = this._ctx;
      const t = ctx.currentTime;

      // Triumphant chord: C major
      const chord = [261.63, 329.63, 392.00, 523.25];
      chord.forEach(freq => {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.setValueAtTime(0.25, t + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
        osc.connect(gain);
        gain.connect(this._masterGain);
        osc.start(t);
        osc.stop(t + 0.85);
      });

      // Rising sparkle
      [1046.5, 1318.5, 1567.98].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const startT = t + i * 0.07;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.15, startT);
        gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.3);
        osc.connect(gain);
        gain.connect(this._masterGain);
        osc.start(startT);
        osc.stop(startT + 0.3);
      });
    });
  }

  // ==========================================
  // Ambient Sounds
  // ==========================================

  startAmbient(type) {
    this.stopAmbient();
    this._ambientType = type;
    if (type === 'none') return;
    if (!this._init()) return;
    this._resume();
    try {
      if (type === 'rain') this._startRain();
      else if (type === 'fire') this._startFireplace();
      else if (type === 'lofi') this._startLofi();
    } catch(e) {}
  }

  _startRain() {
    const ctx = this._ctx;
    const nodes = [];

    // White noise source
    const bufSize = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;

    const source = ctx.createBufferSource();
    source.buffer = buf;
    source.loop = true;

    // Filter to shape as rain
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 1200;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 8000;

    const gainNode = ctx.createGain();
    gainNode.gain.value = 0.4;

    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(gainNode);
    gainNode.connect(this._ambientGain);
    source.start();
    nodes.push(source, highpass, lowpass, gainNode);

    // Occasional drops - LFO amplitude modulation
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 3;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.15;
    lfo.connect(lfoGain);
    lfoGain.connect(gainNode.gain);
    lfo.start();
    nodes.push(lfo, lfoGain);

    this._ambientNodes = nodes;
  }

  _startFireplace() {
    const ctx = this._ctx;
    const nodes = [];

    // Low frequency crackling noise
    const bufSize = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;

    const source = ctx.createBufferSource();
    source.buffer = buf;
    source.loop = true;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 600;
    lowpass.Q.value = 2;

    const peaking = ctx.createBiquadFilter();
    peaking.type = 'peaking';
    peaking.frequency.value = 200;
    peaking.gain.value = 10;
    peaking.Q.value = 0.5;

    const gainNode = ctx.createGain();
    gainNode.gain.value = 0.5;

    source.connect(lowpass);
    lowpass.connect(peaking);
    peaking.connect(gainNode);
    gainNode.connect(this._ambientGain);
    source.start();
    nodes.push(source, lowpass, peaking, gainNode);

    // Random crackle bursts via LFO
    const crackle = ctx.createOscillator();
    crackle.type = 'sawtooth';
    crackle.frequency.value = 0.4;
    const crackleGain = ctx.createGain();
    crackleGain.gain.value = 0.3;
    crackle.connect(crackleGain);
    crackleGain.connect(gainNode.gain);
    crackle.start();
    nodes.push(crackle, crackleGain);

    this._ambientNodes = nodes;
  }

  _startLofi() {
    const ctx = this._ctx;
    const nodes = [];

    // Simple chord progression: C Am F G (in whole notes)
    const progressions = [
      [261.63, 329.63, 392.00],       // C major
      [220.00, 261.63, 329.63],       // A minor
      [174.61, 220.00, 261.63],       // F major
      [196.00, 246.94, 293.66],       // G major
    ];

    const tempo = 2; // seconds per chord
    let chordIndex = 0;
    let chordNodes = [];

    const playChord = (freqs, startTime) => {
      const chordGain = ctx.createGain();
      chordGain.gain.setValueAtTime(0, startTime);
      chordGain.gain.linearRampToValueAtTime(0.12, startTime + 0.2);
      chordGain.gain.setValueAtTime(0.12, startTime + tempo - 0.3);
      chordGain.gain.linearRampToValueAtTime(0, startTime + tempo);
      chordGain.connect(this._ambientGain);
      nodes.push(chordGain);

      freqs.forEach(freq => {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        // Slight detune for warmth
        osc.detune.value = (Math.random() - 0.5) * 10;
        const oscGain = ctx.createGain();
        oscGain.gain.value = 0.33;
        osc.connect(oscGain);
        oscGain.connect(chordGain);
        osc.start(startTime);
        osc.stop(startTime + tempo);
        nodes.push(osc, oscGain);
      });
    };

    const scheduleChords = () => {
      if (!this._initialized || this._ambientType !== 'lofi') return;
      const now = ctx.currentTime;
      // Schedule next 4 chords
      for (let i = 0; i < 4; i++) {
        const idx = (chordIndex + i) % progressions.length;
        playChord(progressions[idx], now + i * tempo);
      }
      chordIndex = (chordIndex + 4) % progressions.length;
      // Schedule again before the current batch ends
      const timerId = setTimeout(() => {
        if (this._ambientType === 'lofi') scheduleChords();
      }, (4 * tempo - 0.5) * 1000);
      nodes.push({ disconnect: () => clearTimeout(timerId) });
    };

    scheduleChords();
    this._ambientNodes = nodes;
  }

  stopAmbient() {
    this._ambientType = 'none';
    for (const node of this._ambientNodes) {
      try {
        if (typeof node.stop === 'function') node.stop();
        if (typeof node.disconnect === 'function') node.disconnect();
      } catch(e) {}
    }
    this._ambientNodes = [];
  }

  setEnabled(enabled) {
    this._enabled = enabled;
    if (!enabled) this.stopAmbient();
    if (this._masterGain) {
      this._masterGain.gain.value = enabled ? this._volume : 0;
    }
  }

  setVolume(vol) {
    this._volume = Math.max(0, Math.min(1, vol));
    if (this._masterGain && this._enabled) {
      this._masterGain.gain.linearRampToValueAtTime(this._volume, this._ctx.currentTime + 0.05);
    }
  }

  getEnabled() { return this._enabled; }
  getVolume() { return this._volume; }
}

window.AudioEngine = AudioEngine;
