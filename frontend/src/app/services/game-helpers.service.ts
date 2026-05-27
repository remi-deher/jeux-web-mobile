import { Injectable, signal, inject } from '@angular/core';
import { GameService } from './game.service';

@Injectable({
  providedIn: 'root'
})
export class GameHelpersService {
  private gameService = inject(GameService);
  soundEnabled = signal<boolean>(localStorage.getItem('soundEnabled') !== 'false');

  toggleSound() {
    const val = !this.soundEnabled();
    this.soundEnabled.set(val);
    localStorage.setItem('soundEnabled', val ? 'true' : 'false');
    this.triggerHaptic('click');
    if (val) {
      this.playSound('click');
    }
  }

  playSound(type: 'click' | 'success' | 'warning' | 'error') {
    if (!this.soundEnabled()) return;

    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioCtx.currentTime;
      const gameType = this.gameService.currentRoom()?.gameType || this.gameService.activeGame();

      // Custom sounds based on gameType
      if (type === 'click') {
        if (gameType === 'connect4') {
          // Connect 4 token drop (falling then hollow plasticy double bounce)
          const osc = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          osc.connect(gainNode);
          gainNode.connect(audioCtx.destination);

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(350, now);
          osc.frequency.exponentialRampToValueAtTime(150, now + 0.15);
          gainNode.gain.setValueAtTime(0.12, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
          osc.start(now);
          osc.stop(now + 0.15);

          const osc2 = audioCtx.createOscillator();
          const gain2 = audioCtx.createGain();
          osc2.connect(gain2);
          gain2.connect(audioCtx.destination);
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(130, now + 0.17);
          gain2.gain.setValueAtTime(0.08, now + 0.17);
          gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
          osc2.start(now + 0.17);
          osc2.stop(now + 0.22);
          return;
        }

        if (gameType === 'tictactoe') {
          // TicTacToe chalk writing sound (bandpass filtered white noise burst with sweep)
          const bufferSize = audioCtx.sampleRate * 0.15;
          const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
          }
          const noise = audioCtx.createBufferSource();
          noise.buffer = buffer;

          const filter = audioCtx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(2000, now);
          filter.frequency.exponentialRampToValueAtTime(800, now + 0.15);
          filter.Q.setValueAtTime(4, now);

          const gain = audioCtx.createGain();
          gain.gain.setValueAtTime(0.05, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

          noise.connect(filter);
          filter.connect(gain);
          gain.connect(audioCtx.destination);

          noise.start(now);
          noise.stop(now + 0.15);
          return;
        }

        if (gameType === 'chess' || gameType === 'checkers') {
          // Chess / Checkers piece landing on wooden board
          const osc = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          osc.connect(gainNode);
          gainNode.connect(audioCtx.destination);

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(180, now);
          osc.frequency.exponentialRampToValueAtTime(100, now + 0.08);
          gainNode.gain.setValueAtTime(0.2, now);
          gainNode.gain.exponentialRampToValueAtTime(0.005, now + 0.08);
          osc.start(now);
          osc.stop(now + 0.08);

          const oscRes = audioCtx.createOscillator();
          const gainRes = audioCtx.createGain();
          oscRes.connect(gainRes);
          gainRes.connect(audioCtx.destination);
          oscRes.type = 'sine';
          oscRes.frequency.setValueAtTime(90, now);
          gainRes.gain.setValueAtTime(0.1, now);
          gainRes.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
          oscRes.start(now);
          oscRes.stop(now + 0.12);
          return;
        }

        if (gameType === 'battleship') {
          // Battleship firing sound (noisy laser sweep launch)
          const osc = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          osc.connect(gainNode);
          gainNode.connect(audioCtx.destination);

          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(600, now);
          osc.frequency.exponentialRampToValueAtTime(120, now + 0.25);
          gainNode.gain.setValueAtTime(0.08, now);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
          osc.start(now);
          osc.stop(now + 0.25);

          const bufferSize = audioCtx.sampleRate * 0.2;
          const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
          }
          const noise = audioCtx.createBufferSource();
          noise.buffer = buffer;

          const filter = audioCtx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(400, now);
          filter.frequency.exponentialRampToValueAtTime(100, now + 0.2);

          const gainNode2 = audioCtx.createGain();
          gainNode2.gain.setValueAtTime(0.06, now);
          gainNode2.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

          noise.connect(filter);
          filter.connect(gainNode2);
          gainNode2.connect(audioCtx.destination);

          noise.start(now);
          noise.stop(now + 0.2);
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

  // Centralized local statistics increment helper
  incrementLocalStat(game: string, statType: 'wins' | 'losses' | 'draws') {
    const key = `stats_${game}_${statType}`;
    const current = parseInt(localStorage.getItem(key) || '0', 10);
    localStorage.setItem(key, (current + 1).toString());
  }

  // Trigger browser Vibration API (haptic feedback on mobile)
  triggerHaptic(type: 'click' | 'success' | 'warning' | 'error') {
    this.playSound(type);

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      switch (type) {
        case 'click':
          navigator.vibrate(15);
          break;
        case 'success':
          navigator.vibrate([40, 50, 40]);
          break;
        case 'warning':
          navigator.vibrate(30);
          break;
        case 'error':
          navigator.vibrate([60, 40, 60]);
          break;
      }
    }
  }

  // Centralized local statistics saver
  saveStatsLocally(gameKey: string, roomId: string, winnerId: string | null, isLocal: boolean, socketId: string | undefined) {
    if (!winnerId || !socketId || isLocal) return;

    const storageKey = `${gameKey}_recorded_${roomId}`;
    if (localStorage.getItem(storageKey)) return;

    if (winnerId === socketId) {
      this.incrementLocalStat(gameKey, 'wins');
    } else if (winnerId === 'draw') {
      this.incrementLocalStat(gameKey, 'draws');
    } else {
      this.incrementLocalStat(gameKey, 'losses');
    }

    localStorage.setItem(storageKey, 'true');
  }

  // Helper to manage floating emojis lifecycle
  setupFloatingEmojis(emojiReactionSignal: () => { senderId: string; emoji: string } | null) {
    const floatingEmojis = signal<{ id: number; emoji: string }[]>([]);
    let emojiId = 0;

    const spawnEmoji = (emoji: string) => {
      const id = emojiId++;
      floatingEmojis.update(list => [...list, { id, emoji }]);
      setTimeout(() => {
        floatingEmojis.update(list => list.filter(item => item.id !== id));
      }, 2000);
    };

    return {
      floatingEmojis,
      spawnEmoji
    };
  }
}
