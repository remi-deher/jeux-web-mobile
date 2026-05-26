import { Component, computed, signal, effect } from '@angular/core';
import { GameService } from '../../services/game.service';

@Component({
  selector: 'app-tictactoe',
  standalone: true,
  template: `
    <div class="ttt-container">
      @if (room()) {
        <!-- Header -->
        <div class="ttt-header">
          <button class="back-btn" (click)="leaveRoom()">
            <span class="material-symbols">arrow_back</span>
            <span>Quitter</span>
          </button>
          <div class="room-badge">Code salon : <strong>{{ room()?.id }}</strong></div>
        </div>

        <!-- Connection Resilience Banner -->
        @if (hasDisconnectedPlayer()) {
          <div class="disconnect-banner">
            <span>⚠️ {{ disconnectedPlayerName() }} s'est déconnecté. En attente de reconnexion...</span>
            @if (!amIDisconnected()) {
              <button class="force-end-btn" (click)="forceEnd()">Forcer la fin (Gagner)</button>
            }
          </div>
        }

        <!-- Status Card -->
        <div class="status-panel glass-card">
          <h2>Morpion (Tic-Tac-Toe)</h2>
          
          <div class="players-display">
            <div class="player-slot" [class.active]="currentPlayerSign() === 'X' && isPlaying()">
              <span class="sign-icon sign-x">✕</span>
              <div class="player-info">
                <span class="player-name">{{ player1Name() }}</span>
                <span class="player-label">Joueur X (Vous)</span>
              </div>
            </div>
            
            <div class="vs-divider">VS</div>
            
            <div class="player-slot" [class.active]="currentPlayerSign() === 'O' && isPlaying()">
              <span class="sign-icon sign-o">◯</span>
              <div class="player-info">
                <span class="player-name">{{ player2Name() }}</span>
                <span class="player-label">Joueur O</span>
              </div>
            </div>
          </div>

          <div class="status-message">
            @if (room()?.status === 'waiting') {
              <div class="pulse-text">En attente d'un adversaire...</div>
            } @else if (room()?.status === 'finished') {
              <div class="win-banner" [class.victory]="isWinner()" [class.defeat]="isLoser()">
                @if (winnerLabel() === 'draw') {
                  Égalité ! Une belle partie serrée.
                } @else {
                  🏆 {{ winnerLabel() }} a gagné la partie !
                }
              </div>
              <div class="rematch-section">
                @if (hasVotedRematch()) {
                  <div class="rematch-status">Demande de revanche envoyée... En attente de l'adversaire.</div>
                } @else {
                  <button class="primary-btn rematch-btn" (click)="requestRematch()">
                    <span class="material-symbols">replay</span>
                    <span>Rejouer / Demander Revanche</span>
                  </button>
                }
              </div>
            } @else {
              @if (isMyTurn()) {
                <div class="turn-alert my-turn">C'est votre tour ! Cliquez sur une case vide.</div>
              } @else {
                <div class="turn-alert opponent-turn">En attente du coup adverse...</div>
              }
            }
          </div>
        </div>

        <!-- Emoji Bar (Floating Interactions) -->
        @if (isPlaying()) {
          <div class="emoji-bar glass-card">
            <span class="bar-title">Réagir :</span>
            <button (click)="sendEmoji('😂')">😂</button>
            <button (click)="sendEmoji('😢')">😢</button>
            <button (click)="sendEmoji('👍')">👍</button>
            <button (click)="sendEmoji('🔥')">🔥</button>
            <button (click)="sendEmoji('🎉')">🎉</button>
          </div>
        }

        <!-- Game Board -->
        @if (isPlaying() || room()?.status === 'finished') {
          <div class="board-wrapper">
            <!-- Floating Emojis Layer -->
            <div class="floating-emojis-container">
              @for (item of floatingEmojis(); track item.id) {
                <span class="floating-emoji">{{ item.emoji }}</span>
              }
            </div>

            <!-- 3x3 Grid -->
            <div class="board-grid">
              @for (cell of board(); track $index) {
                <div 
                  class="board-cell"
                  [class.winning-cell]="isWinningCell($index)"
                  [class.disabled]="!isMyTurn() || cell !== null"
                  (click)="makeMove($index)"
                >
                  @if (cell === 'X') {
                    <span class="sign sign-x">✕</span>
                  } @else if (cell === 'O') {
                    <span class="sign sign-o">◯</span>
                  }
                </div>
              }
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .ttt-container {
      max-width: 600px;
      margin: 20px auto;
      padding: 0 20px;
    }

    .ttt-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .back-btn {
      background: var(--m3-surface);
      border: var(--m3-border);
      color: #cbd5e1;
      border-radius: var(--m3-radius-medium);
      padding: 8px 16px;
      cursor: pointer;
      font-size: 14px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
    }

    .back-btn:hover {
      background: var(--m3-surface-hover);
      color: white;
    }

    .back-btn .material-symbols {
      font-size: 18px;
    }

    .room-badge {
      background: var(--m3-primary-container);
      border: 1px solid rgba(129, 140, 248, 0.2);
      color: #cbd5e1;
      padding: 8px 16px;
      border-radius: var(--m3-radius-medium);
      font-size: 14px;
    }

    .glass-card {
      background: var(--m3-surface);
      border: var(--m3-border);
      backdrop-filter: blur(12px);
      border-radius: var(--m3-radius-large);
      padding: 25px;
      box-shadow: var(--m3-shadow);
      color: white;
      margin-bottom: 20px;
    }

    .status-panel h2 {
      margin-top: 0;
      text-align: center;
      font-size: 26px;
      background: linear-gradient(135deg, #f87171, #cbd5e1);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      font-weight: 700;
    }

    .players-display {
      display: flex;
      justify-content: space-around;
      align-items: center;
      margin: 15px 0;
      background: rgba(0, 0, 0, 0.2);
      padding: 12px;
      border-radius: 12px;
    }

    .player-slot {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 14px;
      border-radius: 8px;
      border: 1px solid transparent;
      transition: all 0.2s;
    }

    .player-slot.active {
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(236, 72, 153, 0.4);
      box-shadow: 0 0 15px rgba(236, 72, 153, 0.15);
    }

    .sign-icon {
      font-size: 24px;
      font-weight: bold;
    }

    .sign-x {
      color: #f43f5e;
    }

    .sign-o {
      color: #3b82f6;
    }

    .vs-divider {
      font-size: 14px;
      font-weight: 700;
      color: #6b7280;
    }

    .player-info {
      display: flex;
      flex-direction: column;
    }

    .player-name {
      font-weight: 600;
    }

    .player-label {
      font-size: 11px;
      color: #9ca3af;
    }

    .status-message {
      text-align: center;
      font-size: 15px;
      font-weight: 500;
    }

    .pulse-text {
      color: #9ca3af;
      animation: pulse 1.5s infinite;
    }

    .turn-alert {
      padding: 10px;
      border-radius: 8px;
    }

    .my-turn {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .opponent-turn {
      background: rgba(255, 255, 255, 0.05);
      color: #9ca3af;
    }

    .win-banner {
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 18px;
    }

    .win-banner.victory {
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
    }

    .win-banner.defeat {
      background: linear-gradient(135deg, #f43f5e, #e11d48);
      color: white;
    }

    /* Emoji Bar */
    .emoji-bar {
      display: flex;
      gap: 12px;
      align-items: center;
      justify-content: center;
      padding: 10px;
    }

    .bar-title {
      font-size: 13px;
      color: #cbd5e1;
      font-weight: 500;
    }

    .emoji-bar button {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      font-size: 20px;
      cursor: pointer;
      padding: 6px 12px;
      border-radius: 8px;
      transition: all 0.2s;
    }

    .emoji-bar button:hover {
      background: rgba(255, 255, 255, 0.15);
      transform: scale(1.15);
    }

    /* Grid layout */
    .board-wrapper {
      display: flex;
      justify-content: center;
      position: relative;
      margin-bottom: 40px;
    }

    .board-grid {
      display: grid;
      grid-template-columns: repeat(3, 100px);
      grid-template-rows: repeat(3, 100px);
      gap: 8px;
      background: #1e1e38;
      border: 4px solid #2e2e54;
      border-radius: 12px;
      padding: 8px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.4);
      touch-action: manipulation;
    }

    .board-cell {
      background: #121225;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
      touch-action: manipulation;
    }

    @media (hover: hover) {
      .board-cell:not(.disabled):hover {
        background: rgba(255, 255, 255, 0.05);
      }
    }

    .board-cell.disabled {
      cursor: not-allowed;
    }

    .board-cell.winning-cell {
      background: rgba(16, 185, 129, 0.2);
      border: 2px solid #10b981;
      animation: winGlow 1s infinite alternate;
    }

    .sign {
      font-size: 40px;
      font-weight: bold;
      animation: popSign 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    }

    /* Floating Emojis Layer */
    .floating-emojis-container {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      z-index: 10;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .floating-emoji {
      position: absolute;
      font-size: 64px;
      animation: floatEmoji 2.0s ease-in-out forwards;
    }

    /* Disconnection banner styles */
    .disconnect-banner {
      background: rgba(239, 68, 68, 0.2);
      border: 1px solid #ef4444;
      color: #fc8181;
      padding: 12px 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 500;
      font-size: 14px;
    }

    .force-end-btn {
      background: #ef4444;
      border: none;
      color: white;
      padding: 6px 12px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      font-size: 13px;
      transition: background 0.2s;
    }
    .force-end-btn:hover {
      background: #dc2626;
    }

    .rematch-section {
      margin-top: 15px;
    }
    .rematch-btn {
      width: auto;
      display: inline-block;
      padding: 8px 18px;
      font-size: 14px;
    }
    .rematch-status {
      font-size: 14px;
      color: #a5b4fc;
      font-style: italic;
    }

    /* Keyframes */
    @keyframes winGlow {
      0% { box-shadow: 0 0 5px #10b981; }
      100% { box-shadow: 0 0 20px #10b981; }
    }

    @keyframes popSign {
      0% { transform: scale(0.2); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
    }

    @keyframes floatEmoji {
      0% {
        transform: translateY(100px) scale(0.5);
        opacity: 0;
      }
      20% {
        transform: translateY(0) scale(1.2);
        opacity: 1;
      }
      80% {
        transform: translateY(-80px) scale(1.0);
        opacity: 1;
      }
      100% {
        transform: translateY(-150px) scale(0.6);
        opacity: 0;
      }
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
  `]
})
export class TicTacToeComponent {
  room;

  floatingEmojis = signal<{ id: number; emoji: string }[]>([]);
  private emojiId = 0;

  hasDisconnectedPlayer = computed(() => this.room()?.players.some(p => p.disconnected) || false);
  
  disconnectedPlayerName = computed(() => {
    const p = this.room()?.players.find(p => p.disconnected);
    return p ? p.username : '';
  });

  amIDisconnected = computed(() => {
    const socketId = this.gameService.getSocketId();
    const p = this.room()?.players.find(p => p.id === socketId);
    return p ? !!p.disconnected : false;
  });

  hasVotedRematch = computed(() => {
    const votes = this.room()?.rematchVotes || [];
    const socketId = this.gameService.getSocketId();
    return socketId ? votes.includes(socketId) : false;
  });

  constructor(private gameService: GameService) {
    this.room = this.gameService.currentRoom;

    effect(() => {
      const rx = this.gameService.emojiReaction();
      if (rx) {
        this.spawnFloatingEmoji(rx.emoji);
      }
    }, { allowSignalWrites: true });

    // Track game over to save local stats
    effect(() => {
      const status = this.room()?.status;
      if (status === 'finished') {
        this.saveStatsLocally();
      }
    });
  }

  board = computed(() => this.room()?.gameState?.board || Array(9).fill(null));

  isPlaying = computed(() => this.room()?.status === 'playing');

  myPlayerSign = computed<'X' | 'O' | null>(() => {
    const r = this.room();
    if (!r) return null;
    const socketId = this.gameService.getSocketId();
    const idx = r.players.findIndex(p => p.id === socketId);
    return idx === 0 ? 'X' : idx === 1 ? 'O' : null;
  });

  currentPlayerSign = computed<'X' | 'O'>(() => this.room()?.gameState?.currentPlayer || 'X');

  isMyTurn = computed(() => {
    return this.isPlaying() && this.myPlayerSign() === this.currentPlayerSign();
  });

  player1Name = computed(() => this.room()?.players[0]?.username || 'Joueur X');
  player2Name = computed(() => this.room()?.players[1]?.username || 'En attente...');

  winnerLabel = computed(() => {
    const winner = this.room()?.gameState?.winner;
    if (winner === 'draw') return 'draw';
    if (winner === 'X') return this.player1Name();
    if (winner === 'O') return this.player2Name();
    return '';
  });

  isWinner = computed(() => {
    const winner = this.room()?.gameState?.winner;
    return winner !== null && winner !== 'draw' && winner === this.myPlayerSign();
  });

  isLoser = computed(() => {
    const winner = this.room()?.gameState?.winner;
    return winner !== null && winner !== 'draw' && winner !== this.myPlayerSign();
  });

  makeMove(cellIndex: number) {
    if (this.isMyTurn() && this.board()[cellIndex] === null) {
      this.gameService.makeTttMove(cellIndex);
    }
  }

  isWinningCell(cellIndex: number): boolean {
    const winLine = this.room()?.gameState?.winningLine || [];
    return winLine.includes(cellIndex);
  }

  spawnFloatingEmoji(emoji: string) {
    const id = this.emojiId++;
    this.floatingEmojis.update(list => [...list, { id, emoji }]);
    setTimeout(() => {
      this.floatingEmojis.update(list => list.filter(item => item.id !== id));
    }, 2000);
  }

  sendEmoji(emoji: string) {
    this.gameService.sendEmoji(emoji);
    this.spawnFloatingEmoji(emoji);
  }

  leaveRoom() {
    this.gameService.leaveRoom();
  }

  requestRematch() {
    this.gameService.requestRematch();
  }

  forceEnd() {
    this.gameService.forceEnd();
  }

  private saveStatsLocally() {
    const r = this.room();
    if (!r) return;
    const winner = r.gameState?.winner;
    const mySign = this.myPlayerSign();
    if (!winner || !mySign) return;

    // Check if stats are already recorded for this roomId to avoid double triggers
    const storageKey = `ttt_recorded_${r.id}`;
    if (localStorage.getItem(storageKey)) return;

    const gameKey = 'tictactoe';
    if (winner === 'draw') {
      this.incrementLocalStat(gameKey, 'draws');
    } else if (winner === mySign) {
      this.incrementLocalStat(gameKey, 'wins');
    } else {
      this.incrementLocalStat(gameKey, 'losses');
    }

    localStorage.setItem(storageKey, 'true');
  }

  private incrementLocalStat(game: string, statType: 'wins' | 'losses' | 'draws') {
    const key = `stats_${game}_${statType}`;
    const current = parseInt(localStorage.getItem(key) || '0', 10);
    localStorage.setItem(key, (current + 1).toString());
  }
}
