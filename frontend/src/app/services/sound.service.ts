import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SoundService {
  soundEnabled = signal<boolean>(localStorage.getItem('soundEnabled') !== 'false');

  toggleSound() {
    const val = !this.soundEnabled();
    this.soundEnabled.set(val);
    localStorage.setItem('soundEnabled', val ? 'true' : 'false');
    this.playSound('click');
  }

  playSound(type: 'click' | 'success' | 'warning' | 'error', gameType?: string | null) {
    if (!this.soundEnabled()) return;

    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const now = audioCtx.currentTime;

      // Custom sounds based on gameType
      if (type === 'click') {
        if (gameType === 'connect4') {
          // Slide phase: rubbing sliding sound using low-amplitude high-passed noise + triangle sweep
          const slideDuration = 0.35;
          const bufferSize = audioCtx.sampleRate * slideDuration;
          const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
          }
          const slideNoise = audioCtx.createBufferSource();
          slideNoise.buffer = buffer;
          
          const slideFilter = audioCtx.createBiquadFilter();
          slideFilter.type = 'bandpass';
          slideFilter.frequency.setValueAtTime(1000, now);
          slideFilter.frequency.exponentialRampToValueAtTime(300, now + slideDuration);
          slideFilter.Q.setValueAtTime(1.5, now);

          const slideGain = audioCtx.createGain();
          slideGain.gain.setValueAtTime(0.015, now);
          slideGain.gain.linearRampToValueAtTime(0.005, now + slideDuration);

          slideNoise.connect(slideFilter);
          slideFilter.connect(slideGain);
          slideGain.connect(audioCtx.destination);
          slideNoise.start(now);
          slideNoise.stop(now + slideDuration);

          // Triangle frequency drop (weight of token falling)
          const weightOsc = audioCtx.createOscillator();
          const weightGain = audioCtx.createGain();
          weightOsc.type = 'triangle';
          weightOsc.frequency.setValueAtTime(380, now);
          weightOsc.frequency.exponentialRampToValueAtTime(180, now + slideDuration);
          weightGain.gain.setValueAtTime(0.03, now);
          weightGain.gain.exponentialRampToValueAtTime(0.005, now + slideDuration);
          
          weightOsc.connect(weightGain);
          weightGain.connect(audioCtx.destination);
          weightOsc.start(now);
          weightOsc.stop(now + slideDuration);

          // Bounce 1: Plasticy hollow impact
          const bounce1Time = now + slideDuration;
          const osc1 = audioCtx.createOscillator();
          const gain1 = audioCtx.createGain();
          osc1.type = 'triangle';
          osc1.frequency.setValueAtTime(150, bounce1Time);
          gain1.gain.setValueAtTime(0.2, bounce1Time);
          gain1.gain.exponentialRampToValueAtTime(0.01, bounce1Time + 0.08);
          
          osc1.connect(gain1);
          gain1.connect(audioCtx.destination);
          osc1.start(bounce1Time);
          osc1.stop(bounce1Time + 0.08);

          // Hollow ring overlay (plastic mesh resonance)
          const ring1 = audioCtx.createOscillator();
          const ringGain1 = audioCtx.createGain();
          ring1.type = 'sine';
          ring1.frequency.setValueAtTime(320, bounce1Time);
          ringGain1.gain.setValueAtTime(0.08, bounce1Time);
          ringGain1.gain.exponentialRampToValueAtTime(0.001, bounce1Time + 0.12);
          
          ring1.connect(ringGain1);
          ringGain1.connect(audioCtx.destination);
          ring1.start(bounce1Time);
          ring1.stop(bounce1Time + 0.12);

          // Bounce 2: Quick, softer rebound
          const bounce2Time = now + slideDuration + 0.1;
          const osc2 = audioCtx.createOscillator();
          const gain2 = audioCtx.createGain();
          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(130, bounce2Time);
          gain2.gain.setValueAtTime(0.08, bounce2Time);
          gain2.gain.exponentialRampToValueAtTime(0.01, bounce2Time + 0.06);

          osc2.connect(gain2);
          gain2.connect(audioCtx.destination);
          osc2.start(bounce2Time);
          osc2.stop(bounce2Time + 0.06);

          const ring2 = audioCtx.createOscillator();
          const ringGain2 = audioCtx.createGain();
          ring2.type = 'sine';
          ring2.frequency.setValueAtTime(300, bounce2Time);
          ringGain2.gain.setValueAtTime(0.03, bounce2Time);
          ringGain2.gain.exponentialRampToValueAtTime(0.001, bounce2Time + 0.08);
          
          ring2.connect(ringGain2);
          ringGain2.connect(audioCtx.destination);
          ring2.start(bounce2Time);
          ring2.stop(bounce2Time + 0.08);
          return;
        }

        if (gameType === 'tictactoe') {
          // Chalk writing sound: longer, scraping gesture with micro-modulations (pressure sweeps)
          const duration = 0.28;
          const bufferSize = audioCtx.sampleRate * duration;
          const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
          }
          
          const noise = audioCtx.createBufferSource();
          noise.buffer = buffer;

          // Bandpass filter to isolate chalk frequencies
          const filter = audioCtx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(1600, now);
          // Modulate frequency to mimic speed variations of the stroke
          filter.frequency.linearRampToValueAtTime(2200, now + duration * 0.3);
          filter.frequency.exponentialRampToValueAtTime(1100, now + duration);
          filter.Q.setValueAtTime(6, now);

          // Second bandpass to capture the deeper chalk screech/resonance on slate
          const resonanceFilter = audioCtx.createBiquadFilter();
          resonanceFilter.type = 'bandpass';
          resonanceFilter.frequency.setValueAtTime(800, now);
          resonanceFilter.frequency.linearRampToValueAtTime(950, now + duration * 0.5);
          resonanceFilter.frequency.exponentialRampToValueAtTime(600, now + duration);
          resonanceFilter.Q.setValueAtTime(8, now);

          const gain = audioCtx.createGain();
          gain.gain.setValueAtTime(0.03, now);
          gain.gain.linearRampToValueAtTime(0.05, now + duration * 0.2);
          gain.gain.linearRampToValueAtTime(0.04, now + duration * 0.6);
          gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

          // Connect chalk components
          const noiseNode = audioCtx.createGain();
          noiseNode.gain.setValueAtTime(0.8, now);
          
          noise.connect(noiseNode);
          noiseNode.connect(filter);
          noiseNode.connect(resonanceFilter);
          
          filter.connect(gain);
          resonanceFilter.connect(gain);
          gain.connect(audioCtx.destination);

          noise.start(now);
          noise.stop(now + duration);
          return;
        }

        if (gameType === 'chess' || gameType === 'checkers' || gameType === 'gomoku' || gameType === 'othello') {
          // Wood piece landing: Triangle wave with fast decay + deep low-frequency resonator
          const duration = 0.15;
          
          // Main impact (wood block frequency)
          const osc = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(160, now);
          osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
          gainNode.gain.setValueAtTime(0.3, now);
          gainNode.gain.exponentialRampToValueAtTime(0.005, now + 0.08);
          
          osc.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          osc.start(now);
          osc.stop(now + 0.08);

          // Body resonance (wood box sound)
          const resonance = audioCtx.createOscillator();
          const resonanceGain = audioCtx.createGain();
          resonance.type = 'sine';
          resonance.frequency.setValueAtTime(65, now); // 65Hz deep wood resonance
          resonanceGain.gain.setValueAtTime(0.25, now);
          resonanceGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

          resonance.connect(resonanceGain);
          resonanceGain.connect(audioCtx.destination);
          resonance.start(now);
          resonance.stop(now + duration);
          return;
        }

        if (gameType === 'battleship') {
          // Military cannon shot: noise detontation + whistle drop
          const duration = 0.4;
          
          // Whistling shell
          const whistle = audioCtx.createOscillator();
          const whistleGain = audioCtx.createGain();
          whistle.type = 'sine';
          whistle.frequency.setValueAtTime(800, now);
          whistle.frequency.exponentialRampToValueAtTime(150, now + 0.15);
          whistleGain.gain.setValueAtTime(0.07, now);
          whistleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
          
          whistle.connect(whistleGain);
          whistleGain.connect(audioCtx.destination);
          whistle.start(now);
          whistle.stop(now + 0.15);

          // Cannon detonation (low pass filtered noise explosion)
          const bufferSize = audioCtx.sampleRate * duration;
          const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
          }
          
          const noise = audioCtx.createBufferSource();
          noise.buffer = buffer;

          const filter = audioCtx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(250, now);
          filter.frequency.exponentialRampToValueAtTime(40, now + duration);

          const gain = audioCtx.createGain();
          gain.gain.setValueAtTime(0.4, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

          noise.connect(filter);
          filter.connect(gain);
          noise.start(now);
          noise.stop(now + duration);
          return;
        }

        if (gameType === 'pong') {
          // Retro arcade paddle bounce sound
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(660, now);
          osc.frequency.exponentialRampToValueAtTime(330, now + 0.08);
          gain.gain.setValueAtTime(0.06, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now);
          osc.stop(now + 0.08);
          return;
        }

        if (gameType === 'pendu') {
          // Chalk/pencil sketch sound using filtered short noise burst
          const duration = 0.12;
          const bufferSize = audioCtx.sampleRate * duration;
          const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
          }
          const noise = audioCtx.createBufferSource();
          noise.buffer = buffer;
          const filter = audioCtx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(1800, now);
          filter.Q.setValueAtTime(4, now);
          const gain = audioCtx.createGain();
          gain.gain.setValueAtTime(0.04, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
          noise.connect(filter);
          filter.connect(gain);
          gain.connect(audioCtx.destination);
          noise.start(now);
          noise.stop(now + duration);
          return;
        }
      }

      // Default synth fallback for clicks and other sounds (success, warning, error)
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      switch (type) {
        case 'click':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(800, now);
          osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);
          gainNode.gain.setValueAtTime(0.1, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
          osc.start(now);
          osc.stop(now + 0.05);
          break;
        case 'success':
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(523.25, now);
          osc.frequency.setValueAtTime(659.25, now + 0.08);
          osc.frequency.setValueAtTime(783.99, now + 0.16);
          osc.frequency.setValueAtTime(1046.50, now + 0.24);
          gainNode.gain.setValueAtTime(0.15, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
          osc.start(now);
          osc.stop(now + 0.4);
          break;
        case 'warning':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(600, now);
          osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
          gainNode.gain.setValueAtTime(0.08, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
          osc.start(now);
          osc.stop(now + 0.15);
          break;
        case 'error':
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(150, now);
          osc.frequency.linearRampToValueAtTime(80, now + 0.2);
          gainNode.gain.setValueAtTime(0.1, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
          osc.start(now);
          osc.stop(now + 0.2);
          break;
      }
    } catch (e) {
      console.warn('Web Audio API not supported or blocked:', e);
    }
  }
}
