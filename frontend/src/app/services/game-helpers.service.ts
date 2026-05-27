import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GameHelpersService {

  // Centralized local statistics increment helper
  incrementLocalStat(game: string, statType: 'wins' | 'losses' | 'draws') {
    const key = `stats_${game}_${statType}`;
    const current = parseInt(localStorage.getItem(key) || '0', 10);
    localStorage.setItem(key, (current + 1).toString());
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
