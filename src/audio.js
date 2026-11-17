/**
 * BLOODCORE // ULTRAQUAKE
 * Procedural WebAudio Synthesizer & Dynamic 168 BPM Breakcore/Industrial Music Engine
 */
window.Bloodcore = window.Bloodcore || {};

(function (B) {
  'use strict';

  B.AudioEngine = function () {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.noiseBuffer = null;

    this.sfxVolume = 0.75;
    this.musicVolume = 0.48;
    this.muted = false;

    this.combatIntensity = 0; // 0 = calm corridor, 1 = intense combat, 1.5 = boss
    this.targetIntensity = 0;
    this.stepIndex = 0;
    this.nextNoteTime = 0;
    this.musicTimer = null;
    this.lastSlideSound = 0;
  };

  B.AudioEngine.prototype.init = function () {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.85;
    this.masterGain.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxVolume;
    this.sfxGain.connect(this.masterGain);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicVolume;
    this.musicGain.connect(this.masterGain);

    // Pre-generate 1.5s white/pink noise buffer for drums, explosions & gun transients
    var len = this.ctx.sampleRate * 1.5;
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    var data = this.noiseBuffer.getChannelData(0);
    for (var i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    this.nextNoteTime = this.ctx.currentTime + 0.05;
    var self = this;
    this.musicTimer = setInterval(function () {
      self.scheduleMusic();
    }, 35);
  };

  B.AudioEngine.prototype.setVolumes = function (sfx, music) {
    this.sfxVolume = sfx;
    this.musicVolume = music;
    if (this.sfxGain) this.sfxGain.gain.value = sfx;
    if (this.musicGain) this.musicGain.gain.value = music;
  };

  B.AudioEngine.prototype.setCombatState = function (intensity) {
    this.targetIntensity = intensity;
  };

  // ==================== 168 BPM BREAKCORE / INDUSTRIAL MUSIC SEQUENCER ====================
  var BASS_NOTES = [36.71, 36.71, 43.65, 41.20, 36.71, 32.70, 38.89, 41.20]; // D1 minor phrygian riff
  var ARP_NOTES = [293.66, 311.13, 349.23, 440.0, 466.16, 349.23, 311.13, 261.63];
  // 16-step Amen-style breakcore pattern: K = kick, S = snare, G = ghost snare roll, H = hat
  var DRUM_PATTERN = [
    'K', 'H', 'G', 'H',
    'S', 'K', 'H', 'G',
    'G', 'S', 'K', 'K',
    'S', 'G', 'S', 'G'
  ];

  B.AudioEngine.prototype.scheduleMusic = function () {
    if (!this.ctx || this.ctx.state !== 'running') return;
    this.combatIntensity += (this.targetIntensity - this.combatIntensity) * 0.08;

    var bpm = this.targetIntensity > 1.2 ? 176 : 168;
    var sixteenth = (60 / bpm) / 4;

    while (this.nextNoteTime < this.ctx.currentTime + 0.12) {
      this.playMusicStep(this.stepIndex, this.nextNoteTime, sixteenth);
      this.nextNoteTime += sixteenth;
      this.stepIndex = (this.stepIndex + 1) % 32;
    }
  };

  B.AudioEngine.prototype.playMusicStep = function (step, time, dur) {
    if (this.musicVolume <= 0.01) return;
    var s16 = step % 16;
    var bar = (step / 8) | 0;

    // Ambient dark sub-pad on step 0 and 16 (always present even in corridors)
    if (s16 === 0) {
      var padOsc = this.ctx.createOscillator();
      var padGain = this.ctx.createGain();
      padOsc.type = 'sawtooth';
      padOsc.frequency.setValueAtTime(BASS_NOTES[bar % BASS_NOTES.length] * 2, time);
      var filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(140 + this.combatIntensity * 280, time);
      padGain.gain.setValueAtTime(0.001, time);
      padGain.gain.linearRampToValueAtTime(0.14, time + 0.08);
      padGain.gain.exponentialRampToValueAtTime(0.001, time + dur * 15);
      padOsc.connect(filter);
      filter.connect(padGain);
      padGain.connect(this.musicGain);
      padOsc.start(time);
      padOsc.stop(time + dur * 15.5);
    }

    if (this.combatIntensity < 0.12) return;

    var ci = Math.min(1.0, this.combatIntensity);
    var hit = DRUM_PATTERN[s16];

    // Breakcore Kick
    if (hit === 'K') {
      var kOsc = this.ctx.createOscillator();
      var kGain = this.ctx.createGain();
      kOsc.type = 'sine';
      kOsc.frequency.setValueAtTime(145, time);
      kOsc.frequency.exponentialRampToValueAtTime(36, time + 0.09);
      kGain.gain.setValueAtTime(0.32 * ci, time);
      kGain.gain.exponentialRampToValueAtTime(0.001, time + 0.11);
      kOsc.connect(kGain);
      kGain.connect(this.musicGain);
      kOsc.start(time);
      kOsc.stop(time + 0.12);
    }

    // Breakcore Snare / Ghost Roll
    if (hit === 'S' || hit === 'G') {
      var isMain = hit === 'S';
      var sSrc = this.ctx.createBufferSource();
      sSrc.buffer = this.noiseBuffer;
      var sFilter = this.ctx.createBiquadFilter();
      sFilter.type = 'bandpass';
      sFilter.frequency.setValueAtTime(isMain ? 1850 : 2600, time);
      sFilter.Q.value = 1.4;
      var sGain = this.ctx.createGain();
      var vol = (isMain ? 0.24 : 0.09) * ci;
      sGain.gain.setValueAtTime(vol, time);
      sGain.gain.exponentialRampToValueAtTime(0.001, time + (isMain ? 0.095 : 0.045));
      sSrc.connect(sFilter);
      sFilter.connect(sGain);
      sGain.connect(this.musicGain);
      sSrc.start(time);
      sSrc.stop(time + 0.1);
    }

    // Crisp Hi-Hat on every even step
    if ((s16 & 1) === 0 || hit === 'H') {
      var hSrc = this.ctx.createBufferSource();
      hSrc.buffer = this.noiseBuffer;
      var hFilter = this.ctx.createBiquadFilter();
      hFilter.type = 'highpass';
      hFilter.frequency.setValueAtTime(6500, time);
      var hGain = this.ctx.createGain();
      hGain.gain.setValueAtTime(0.06 * ci, time);
      hGain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
      hSrc.connect(hFilter);
      hFilter.connect(hGain);
      hGain.connect(this.musicGain);
      hSrc.start(time);
      hSrc.stop(time + 0.035);
    }

    // Industrial Acid Synth Arp on high combat intensity
    if (this.combatIntensity > 0.45 && (s16 % 2 === 0 || s16 === 7 || s16 === 15)) {
      var aOsc = this.ctx.createOscillator();
      var aFilter = this.ctx.createBiquadFilter();
      var aGain = this.ctx.createGain();
      aOsc.type = 'sawtooth';
      var note = ARP_NOTES[(step + bar) % ARP_NOTES.length];
      if (this.combatIntensity > 1.2 && (step & 1)) note *= 1.5;
      aOsc.frequency.setValueAtTime(note, time);
      aFilter.type = 'lowpass';
      aFilter.frequency.setValueAtTime(2200, time);
      aFilter.frequency.exponentialRampToValueAtTime(420, time + dur * 0.9);
      aFilter.Q.value = 5.0;
      aGain.gain.setValueAtTime(0.08 * ci, time);
      aGain.gain.exponentialRampToValueAtTime(0.001, time + dur * 0.95);
      aOsc.connect(aFilter);
      aFilter.connect(aGain);
      aGain.connect(this.musicGain);
      aOsc.start(time);
      aOsc.stop(time + dur);
    }
  };

  // ==================== WEAPON & COMBAT SFX ====================
  B.AudioEngine.prototype.playNoiseBurst = function (freq, q, duration, vol, filterType) {
    if (!this.ctx) return;
    var now = this.ctx.currentTime;
    var src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    var filter = this.ctx.createBiquadFilter();
    filter.type = filterType || 'bandpass';
    filter.frequency.setValueAtTime(freq, now);
    filter.Q.value = q || 1.0;
    var gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(now);
    src.stop(now + duration + 0.02);
  };

  B.AudioEngine.prototype.playTone = function (type, startFreq, endFreq, duration, vol, delay) {
    if (!this.ctx) return;
    var now = this.ctx.currentTime + (delay || 0);
    var osc = this.ctx.createOscillator();
    var gain = this.ctx.createGain();
    osc.type = type || 'sawtooth';
    osc.frequency.setValueAtTime(startFreq, now);
    if (endFreq && endFreq !== startFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  };

  B.AudioEngine.prototype.playRevolver = function () {
    this.init();
    this.playTone('sawtooth', 320, 52, 0.16, 0.36);
    this.playTone('triangle', 180, 38, 0.20, 0.35);
    this.playNoiseBurst(1600, 0.8, 0.14, 0.32, 'lowpass');
  };

  B.AudioEngine.prototype.playCoinToss = function (coinCount) {
    this.init();
    var basePitch = 1320 * Math.pow(1.12, Math.min(4, coinCount || 0));
    this.playTone('sine', basePitch, basePitch * 1.04, 0.32, 0.28);
    this.playTone('triangle', basePitch * 2.0, basePitch * 2.02, 0.24, 0.16, 0.02);
  };

  B.AudioEngine.prototype.playRicoshot = function (chainCount) {
    this.init();
    var mult = Math.pow(1.18, Math.min(5, chainCount || 1));
    this.playTone('sine', 1560 * mult, 2340 * mult, 0.42, 0.38);
    this.playTone('sawtooth', 520 * mult, 110, 0.22, 0.28);
    this.playNoiseBurst(3400, 1.5, 0.18, 0.25, 'bandpass');
  };

  B.AudioEngine.prototype.playShotgun = function () {
    this.init();
    this.playTone('sawtooth', 165, 32, 0.26, 0.44);
    this.playNoiseBurst(950, 0.6, 0.24, 0.45, 'lowpass');
    this.playTone('square', 480, 220, 0.07, 0.12, 0.22); // pump click
  };

  B.AudioEngine.prototype.playCoreEject = function () {
    this.init();
    this.playTone('triangle', 240, 68, 0.22, 0.36);
    this.playTone('sine', 620, 980, 0.18, 0.20);
  };

  B.AudioEngine.prototype.playNailgun = function (isOverheat) {
    this.init();
    var pitch = isOverheat ? 680 : 420 + Math.random() * 90;
    this.playTone('square', pitch, 140, 0.055, isOverheat ? 0.22 : 0.15);
    this.playNoiseBurst(isOverheat ? 3600 : 2400, 1.8, 0.045, 0.14, 'bandpass');
  };

  B.AudioEngine.prototype.playRocket = function () {
    this.init();
    this.playTone('sawtooth', 190, 55, 0.28, 0.32);
    this.playNoiseBurst(750, 0.9, 0.32, 0.28, 'bandpass');
  };

  B.AudioEngine.prototype.playRailcannon = function () {
    this.init();
    this.playTone('sawtooth', 980, 42, 0.55, 0.48);
    this.playTone('square', 1960, 220, 0.38, 0.32);
    this.playNoiseBurst(2800, 0.7, 0.45, 0.42, 'bandpass');
  };

  B.AudioEngine.prototype.playExplosion = function (isMega) {
    this.init();
    var dur = isMega ? 0.68 : 0.38;
    this.playTone('sine', isMega ? 130 : 95, 24, dur, isMega ? 0.52 : 0.38);
    this.playNoiseBurst(isMega ? 620 : 820, 0.5, dur, isMega ? 0.48 : 0.36, 'lowpass');
    if (isMega) {
      this.playTone('triangle', 880, 440, 0.45, 0.25);
    }
  };

  B.AudioEngine.prototype.playPunch = function () {
    this.init();
    this.playTone('triangle', 220, 65, 0.11, 0.26);
    this.playNoiseBurst(1200, 1.2, 0.08, 0.20, 'bandpass');
  };

  B.AudioEngine.prototype.playParry = function () {
    this.init();
    // Iconic ULTRAKILL parry: metallic anvil CLANG + heavy sub-bass drop
    this.playTone('sine', 140, 28, 0.52, 0.55);
    this.playTone('square', 1760, 880, 0.32, 0.34);
    this.playTone('sine', 2640, 2600, 0.38, 0.28, 0.02);
    this.playNoiseBurst(3200, 2.0, 0.22, 0.32, 'bandpass');
  };

  B.AudioEngine.prototype.playDash = function () {
    this.init();
    this.playNoiseBurst(1900, 1.1, 0.14, 0.22, 'bandpass');
    this.playTone('sine', 340, 680, 0.12, 0.16);
  };

  B.AudioEngine.prototype.playSlideTick = function () {
    if (!this.ctx) return;
    var now = performance.now();
    if (now - this.lastSlideSound < 85) return;
    this.lastSlideSound = now;
    this.playNoiseBurst(4200, 2.5, 0.05, 0.08, 'highpass');
  };

  B.AudioEngine.prototype.playWallJump = function (count) {
    this.init();
    var p = 280 + (count || 1) * 90;
    this.playTone('triangle', p, p * 1.45, 0.12, 0.24);
    this.playNoiseBurst(1500, 1.4, 0.08, 0.18, 'bandpass');
  };

  B.AudioEngine.prototype.playSlam = function () {
    this.init();
    this.playTone('sine', 120, 26, 0.38, 0.46);
    this.playNoiseBurst(520, 0.6, 0.32, 0.38, 'lowpass');
  };

  B.AudioEngine.prototype.playJumpPad = function () {
    this.init();
    this.playTone('sawtooth', 180, 740, 0.26, 0.28);
    this.playTone('sine', 360, 1120, 0.28, 0.22);
  };

  B.AudioEngine.prototype.playBloodHeal = function () {
    this.init();
    this.playTone('sine', 520, 880, 0.11, 0.14);
  };

  B.AudioEngine.prototype.playPlayerHurt = function () {
    this.init();
    this.playTone('sawtooth', 150, 48, 0.24, 0.38);
    this.playNoiseBurst(600, 0.8, 0.20, 0.32, 'lowpass');
  };

  B.AudioEngine.prototype.playEnemyDeath = function (isHeavy) {
    this.init();
    this.playTone('sawtooth', isHeavy ? 110 : 210, 35, isHeavy ? 0.36 : 0.18, 0.28);
    this.playNoiseBurst(1100, 0.9, 0.18, 0.26, 'bandpass');
  };

  B.AudioEngine.prototype.playDoorOpen = function () {
    this.init();
    this.playTone('sawtooth', 95, 145, 0.45, 0.24);
    this.playTone('sine', 660, 990, 0.25, 0.20, 0.12);
  };

  B.AudioEngine.prototype.playSentryLock = function () {
    this.init();
    this.playTone('sine', 920, 1840, 0.18, 0.18);
  };

})(window.Bloodcore);
