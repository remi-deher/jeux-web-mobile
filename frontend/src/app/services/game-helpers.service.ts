import { Injectable, signal, inject } from '@angular/core';
import { GameService } from './game.service';
import { SoundService } from './sound.service';

@Injectable({
  providedIn: 'root'
})
export class GameHelpersService {
  private gameService = inject(GameService);
  private soundService = inject(SoundService);

  soundEnabled = this.soundService.soundEnabled;

  toggleSound() {
    this.soundService.toggleSound();
  }

  playSound(type: 'click' | 'success' | 'warning' | 'error') {
    const gameType = this.gameService.currentRoom()?.gameType || this.gameService.activeGame();
    this.soundService.playSound(type, gameType);
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
