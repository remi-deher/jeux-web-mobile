import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GameHelpersService {
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
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      const now = audioCtx.currentTime;

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
