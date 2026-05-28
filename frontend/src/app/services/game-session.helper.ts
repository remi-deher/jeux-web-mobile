import { inject, signal, computed, effect, DestroyRef } from '@angular/core';
import { GameService } from './game.service';
import { GameHelpersService } from './game-helpers.service';

export function injectGameSession(gameKey: string) {
  const gameService = inject(GameService);
  const gameHelpersService = inject(GameHelpersService);
  const destroyRef = inject(DestroyRef);

  const room = gameService.currentRoom;
  const username = gameService.username;

  const floatingEmojis = signal<{ id: number; emoji: string }[]>([]);
  let emojiIdCounter = 0;

  const isPlaying = computed(() => room()?.status === 'playing');

  const hasDisconnectedPlayer = computed(() => room()?.players.some(p => p.disconnected) || false);

  const disconnectedPlayerName = computed(() => {
    const p = room()?.players.find(p => p.disconnected);
    return p ? p.username : '';
  });

  const amIDisconnected = computed(() => {
    const socketId = gameService.getSocketId();
    const p = room()?.players.find(p => p.id === socketId);
    return p ? !!p.disconnected : false;
  });

  const hasVotedRematch = computed(() => {
    const votes = room()?.rematchVotes || [];
    const socketId = gameService.getSocketId();
    return socketId ? votes.includes(socketId) : false;
  });

  const player1Name = computed(() => room()?.players[0]?.username || 'Joueur 1');
  const player2Name = computed(() => room()?.players[1]?.username || 'En attente...');

  // Hook reactive emoji spawns
  const emojiEffect = effect(() => {
    const rx = gameService.emojiReaction();
    if (rx) {
      const id = emojiIdCounter++;
      floatingEmojis.update(list => [...list, { id, emoji: rx.emoji }]);
      const timeout = setTimeout(() => {
        floatingEmojis.update(list => list.filter(item => item.id !== id));
      }, 2000);

      destroyRef.onDestroy(() => clearTimeout(timeout));
    }
  }, { allowSignalWrites: true });

  // Hook reactive local stats saving
  const statsEffect = effect(() => {
    const status = room()?.status;
    if (status === 'finished') {
      const winner = room()?.gameState?.winner;
      const socketId = gameService.getSocketId();
      let isMyWin = false;
      let isDraw = winner === 'draw';

      if (!isDraw && winner !== null && winner !== undefined) {
        // Handle numeric player indices or X/O signs
        const players = room()?.players || [];
        const idx = players.findIndex(p => p.id === socketId);
        if (typeof winner === 'number') {
          isMyWin = (idx !== -1 && idx + 1 === winner);
        } else {
          // Morpion signs (X / O)
          const mySign = idx === 0 ? 'X' : idx === 1 ? 'O' : null;
          isMyWin = (winner === mySign);
        }
      }

      const storageKey = `${gameKey}_recorded_${room()?.id}`;
      if (room()?.id && !localStorage.getItem(storageKey)) {
        if (isDraw) {
          gameHelpersService.incrementLocalStat(gameKey, 'draws');
        } else if (isMyWin) {
          gameHelpersService.incrementLocalStat(gameKey, 'wins');
        } else {
          gameHelpersService.incrementLocalStat(gameKey, 'losses');
        }
        localStorage.setItem(storageKey, 'true');
      }
    }
  });

  function leaveRoom() {
    gameService.leaveRoom();
  }

  function shareInvitationLink() {
    const r = room();
    if (r) gameService.shareInvitationLink(r);
  }

  function requestRematch() {
    gameService.requestRematch();
  }

  function forceEnd() {
    gameService.forceEnd();
  }

  function sendEmoji(emoji: string) {
    gameService.sendEmoji(emoji);
    const id = emojiIdCounter++;
    floatingEmojis.update(list => [...list, { id, emoji }]);
    const timeout = setTimeout(() => {
      floatingEmojis.update(list => list.filter(item => item.id !== id));
    }, 2000);
    destroyRef.onDestroy(() => clearTimeout(timeout));
  }

  return {
    room,
    username,
    floatingEmojis,
    isPlaying,
    hasDisconnectedPlayer,
    disconnectedPlayerName,
    amIDisconnected,
    hasVotedRematch,
    player1Name,
    player2Name,
    leaveRoom,
    shareInvitationLink,
    requestRematch,
    forceEnd,
    sendEmoji
  };
}
