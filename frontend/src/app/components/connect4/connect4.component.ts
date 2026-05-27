import { Component, computed, signal, effect } from '@angular/core';
import { GameService } from '../../services/game.service';

@Component({
  selector: 'app-connect4',
  standalone: true,
  template: `
    <div class="c4-container">
      @if (room()) {
        <!-- Header -->
        <div class="c4-header">
          <button class="back-btn" (click)="leaveRoom()">
            <span class="material-symbols">arrow_back</span>
            <span>Quitter</span>
          </button>
          <div class="room-badge">Code salon : <strong>{{ room()?.id }}</strong></div>
        </div>

        <!-- Status Panel -->
        <div class="status-panel glass-card">
          <h2>Puissance 4</h2>
          
          <div class="players-display">
            <div class="player-slot" [class.active]="currentPlayerNum() === 1 && isPlaying()">
              <span class="token token-red"></span>
              <div class="player-info">
                <span class="player-name">{{ player1Name() }}</span>
                <span class="player-label">Joueur 1 (Vous)</span>
              </div>
            </div>
            
            <div class="vs-divider">VS</div>
            
            <div class="player-slot" [class.active]="currentPlayerNum() === 2 && isPlaying()">
              <span class="token token-yellow"></span>
              <div class="player-info">
                <span class="player-name">{{ player2Name() }}</span>
                <span class="player-label">Joueur 2</span>
              </div>
            </div>
          </div>

          @if (hasDisconnectedPlayer()) {
            <div class="disconnect-banner">
              <span>⚠️ {{ disconnectedPlayerName() }} s'est déconnecté. En attente de reconnexion...</span>
              @if (!amIDisconnected()) {
                <button class="force-end-btn" (click)="forceEnd()">Forcer la fin (Gagner)</button>
              }
            </div>
          }

          <div class="status-message">
            @if (room()?.status === 'waiting') {
              <div class="waiting-container" style="display: flex; flex-direction: column; align-items: center; gap: 16px; margin-top: 12px;">
                <div class="pulse-text">En attente d'un adversaire...</div>
                <button class="tonal-btn share-btn" style="display: flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 20px; font-weight: 500; font-size: 13px;" (click)="shareInvitationLink()">
                  <span class="material-symbols">share</span>
                  <span>Partager l'invitation</span>
                </button>
              </div>
            } @else if (room()?.status === 'finished') {
              <div class="win-banner" [class.victory]="isWinner()" [class.defeat]="isLoser()">
                @if (winnerLabel() === 'draw') {
                  Égalité ! Bien joué aux deux joueurs.
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
                <div class="turn-alert my-turn">C'est votre tour ! Cliquez sur une colonne.</div>
              } @else {
                <div class="turn-alert opponent-turn">En attente du coup de l'adversaire...</div>
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

            <div class="board-grid">
              <!-- Drop indicator zone above board -->
              <div class="drop-indicators">
                @for (col of [0,1,2,3,4,5,6]; track col) {
                  <button 
                    class="drop-arrow-btn" 
                    [class.my-turn]="isMyTurn()" 
                    [class.col-hovered]="hoveredColumn() === col"
                    (click)="makeMove(col)"
                    [disabled]="!isMyTurn()"
                    (mouseenter)="hoveredColumn.set(col)"
                    (mouseleave)="hoveredColumn.set(null)"
                  >
                    @if (isMyTurn()) {
                      <span class="material-symbols arrow-down" [class.red]="myPlayerNum() === 1" [class.yellow]="myPlayerNum() === 2">arrow_downward</span>
                    }
                  </button>
                }
              </div>

              <!-- Main board mesh -->
              <div class="board-mesh">
                @for (rowIdx of [0,1,2,3,4,5]; track rowIdx) {
                  @for (colIdx of [0,1,2,3,4,5,6]; track colIdx) {
                    <div 
                      class="board-cell"
                      [class.winning-cell]="isWinningCell(rowIdx, colIdx)"
                      (click)="makeMove(colIdx)"
                      (mouseenter)="hoveredColumn.set(colIdx)"
                      (mouseleave)="hoveredColumn.set(null)"
                    >
                      <!-- Slot content -->
                      @if (board()[rowIdx][colIdx] === 1) {
                        <div class="token token-red animate-drop"></div>
                      } @else if (board()[rowIdx][colIdx] === 2) {
                        <div class="token token-yellow animate-drop"></div>
                      } @else if (previewRow() === rowIdx && hoveredColumn() === colIdx) {
                        <div class="token ghost-token" [class.red]="myPlayerNum() === 1" [class.yellow]="myPlayerNum() === 2"></div>
                      } @else {
                        <div class="token-slot-empty"></div>
                      }
                    </div>
                  }
                }
              </div>
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .c4-container {
      max-width: 800px;
      margin: 20px auto;
      padding: 0 20px;
    }

    .c4-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .back-btn {
      background: var(--md-secondary-container);
      border: 1px solid var(--md-outline-variant);
      color: var(--md-on-secondary-container);
      border-radius: var(--md-radius-full);
      padding: 8px 16px;
      cursor: pointer;
      font-size: 14px;
      font-family: 'Inter', sans-serif;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
    }

    .back-btn:hover {
      opacity: 0.85;
    }

    .back-btn .material-symbols {
      font-size: 18px;
    }

    .room-badge {
      background: var(--md-surface-container);
      border: 1px solid var(--md-outline-variant);
      color: var(--md-on-surface-variant);
      padding: 8px 16px;
      border-radius: var(--md-radius-full);
      font-size: 14px;
    }

    .glass-card {
      background: var(--md-surface-container);
      border: 1px solid var(--md-outline-variant);
      border-radius: var(--md-radius-xl);
      padding: 25px;
      color: var(--md-on-surface);
      margin-bottom: 30px;
    }

    .status-panel h2 {
      margin-top: 0;
      text-align: center;
      font-size: 26px;
      color: var(--md-on-surface);
      font-weight: 700;
      font-family: 'Inter', sans-serif;
    }

    .players-display {
      display: flex;
      justify-content: space-around;
      align-items: center;
      margin: 20px 0;
      background: var(--md-surface-container-high);
      padding: 15px;
      border-radius: var(--md-radius-lg);
      border: 1px solid var(--md-outline-variant);
    }

    .player-slot {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 16px;
      border-radius: var(--md-radius-lg);
      border: 1px solid transparent;
      transition: all 0.2s;
    }

    .player-slot.active {
      background: var(--md-surface-container);
      border-color: var(--md-outline-variant);
    }

    .vs-divider {
      font-size: 14px;
      font-weight: 700;
      color: var(--md-on-surface-variant);
    }

    .player-info {
      display: flex;
      flex-direction: column;
    }

    .player-name {
      font-weight: 600;
      color: var(--md-on-surface);
    }

    .player-label {
      font-size: 11px;
      color: var(--md-on-surface-variant);
    }

    .token {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      box-shadow: inset 0 -4px 6px rgba(0, 0, 0, 0.3), 0 3px 6px rgba(0, 0, 0, 0.2);
    }

    .token-red {
      background: radial-gradient(circle at 35% 35%, #ff4b5c, #c01a2b);
    }

    .token-yellow {
      background: radial-gradient(circle at 35% 35%, #ffd13b, #cfa000);
    }

    .token-slot-empty {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: rgba(10, 10, 15, 0.7);
      box-shadow: inset 2px 2px 5px rgba(0, 0, 0, 0.8);
    }

    .ghost-token {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 2px dashed rgba(255, 255, 255, 0.5);
      opacity: 0.5;
      animation: pulse-preview 1.5s infinite ease-in-out;
    }

    .ghost-token.red {
      background: radial-gradient(circle at 35% 35%, rgba(255, 75, 92, 0.6), rgba(192, 26, 43, 0.3));
      box-shadow: 0 0 8px rgba(255, 75, 92, 0.5);
    }

    .ghost-token.yellow {
      background: radial-gradient(circle at 35% 35%, rgba(255, 209, 59, 0.6), rgba(207, 160, 0, 0.3));
      box-shadow: 0 0 8px rgba(255, 209, 59, 0.5);
    }

    @keyframes pulse-preview {
      0%, 100% {
        transform: scale(0.92);
        opacity: 0.4;
      }
      50% {
        transform: scale(1.02);
        opacity: 0.7;
      }
    }

    .status-message {
      text-align: center;
      font-size: 16px;
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
      animation: pulse 2s infinite;
    }

    .opponent-turn {
      background: rgba(255, 255, 255, 0.05);
      color: #9ca3af;
    }

    .win-banner {
      padding: 12px 24px;
      border-radius: var(--md-radius-lg);
      font-weight: 700;
      font-size: 18px;
    }

    .win-banner.victory {
      background: var(--md-surface-container-high);
      color: #10b981;
      border: 1px solid var(--md-outline-variant);
    }

    .win-banner.defeat {
      background: var(--md-surface-container-high);
      color: #f43f5e;
      border: 1px solid var(--md-outline-variant);
    }

    /* Board Area */
    .board-wrapper {
      display: flex;
      justify-content: center;
      margin-bottom: 40px;
    }

    .board-grid {
      display: flex;
      flex-direction: column;
      background: #1e1e38;
      border: 6px solid #2e2e54;
      border-radius: 18px;
      padding: 10px;
      box-shadow: 0 15px 35px rgba(0, 0, 0, 0.5);
    }

    .drop-indicators {
      display: grid;
      grid-template-columns: repeat(7, 60px);
      gap: 8px;
      height: 40px;
      margin-bottom: 8px;
    }

    .drop-arrow-btn {
      background: none;
      border: none;
      height: 100%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .drop-arrow-btn.my-turn:hover,
    .drop-arrow-btn.col-hovered {
      opacity: 1;
    }

    .arrow-down {
      font-size: 20px;
    }
    .arrow-down.red {
      color: #ff4b5c;
    }
    .arrow-down.yellow {
      color: #ffd13b;
    }

    .board-mesh {
      display: grid;
      grid-template-columns: repeat(7, 60px);
      grid-template-rows: repeat(6, 60px);
      gap: 8px;
      touch-action: manipulation;
    }

    .board-cell {
      background: #1a1a30;
      border-radius: 50%;
      padding: 4px;
      cursor: pointer;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
      touch-action: manipulation;
    }

    @media (hover: hover) {
      .board-cell:hover {
        background: rgba(255, 255, 255, 0.05);
      }
    }

    .winning-cell {
      background: rgba(16, 185, 129, 0.2) !important;
      border: 2px solid #10b981;
      animation: winGlow 1s infinite alternate;
    }

    .winning-cell .token {
      box-shadow: 0 0 15px currentColor;
    }

    /* Animations */
    .animate-drop {
      animation: dropIn 0.4s cubic-bezier(0.25, 1, 0.5, 1) forwards;
      width: 100%;
      height: 100%;
    }

    @keyframes dropIn {
      0% {
        transform: translateY(-300px);
        opacity: 0;
      }
      100% {
        transform: translateY(0);
        opacity: 1;
      }
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }

    @keyframes winGlow {
      0% {
        box-shadow: 0 0 5px #10b981;
      }
      100% {
        box-shadow: 0 0 20px #10b981;
      }
    }

    @media (max-width: 480px) {
      .board-grid {
        border-width: 3px;
        padding: 5px;
      }
      .drop-indicators {
        grid-template-columns: repeat(7, 40px);
        gap: 4px;
        height: 30px;
      }
      .board-mesh {
        grid-template-columns: repeat(7, 40px);
        grid-template-rows: repeat(6, 40px);
        gap: 4px;
      }
      .token {
        width: 24px;
        height: 24px;
      }
    }

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
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 18px;
      font-size: 14px;
      background: var(--md-primary);
      color: var(--md-on-primary);
      border: none;
      border-radius: var(--md-radius-full);
      cursor: pointer;
      font-family: 'Inter', sans-serif;
      font-weight: 600;
      transition: opacity 0.2s;
    }
    .rematch-btn:hover {
      opacity: 0.88;
    }
    .rematch-status {
      font-size: 14px;
      color: var(--md-on-surface-variant);
      font-style: italic;
    }

    /* Emoji Bar and Floating animations */
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
  `]
})
export class Connect4Component {
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

    effect(() => {
      const status = this.room()?.status;
      if (status === 'finished') {
        this.saveStatsLocally();
      }
    });
  }

  board = computed(() => this.room()?.gameState?.board || Array(6).fill(null).map(() => Array(7).fill(0)));

  isPlaying = computed(() => this.room()?.status === 'playing');

  hoveredColumn = signal<number | null>(null);

  previewRow = computed(() => {
    const col = this.hoveredColumn();
    if (col === null || !this.isMyTurn()) return null;
    const grid = this.board();
    for (let r = 5; r >= 0; r--) {
      if (grid[r][col] === 0) {
        return r;
      }
    }
    return null;
  });

  // Logic to identify which player number you are (1 or 2)
  myPlayerNum = computed(() => {
    const r = this.room();
    if (!r) return null;
    const socketId = this.gameService.getSocketId();
    const idx = r.players.findIndex(p => p.id === socketId);
    return idx !== -1 ? idx + 1 : null;
  });

  currentPlayerNum = computed(() => this.room()?.gameState?.currentPlayer || 1);

  isMyTurn = computed(() => {
    const r = this.room();
    if (r?.isLocal) return this.isPlaying();
    return this.isPlaying() && this.myPlayerNum() === this.currentPlayerNum();
  });

  player1Name = computed(() => this.room()?.players[0]?.username || 'Joueur 1');
  player2Name = computed(() => this.room()?.players[1]?.username || 'En attente...');

  winnerLabel = computed(() => {
    const winner = this.room()?.gameState?.winner;
    if (winner === 'draw') return 'draw';
    if (winner === 1) return this.player1Name();
    if (winner === 2) return this.player2Name();
    return '';
  });

  isWinner = computed(() => {
    const winner = this.room()?.gameState?.winner;
    return winner !== null && winner !== 'draw' && winner === this.myPlayerNum();
  });

  isLoser = computed(() => {
    const winner = this.room()?.gameState?.winner;
    return winner !== null && winner !== 'draw' && winner !== this.myPlayerNum();
  });

  makeMove(column: number) {
    if (!this.isMyTurn()) return;
    
    // Tap-to-Preview + Tap-to-Commit logic for seamless touch support
    if (this.hoveredColumn() === column) {
      this.gameService.makeC4Move(column);
      this.hoveredColumn.set(null);
    } else {
      this.hoveredColumn.set(column);
    }
  }

  isWinningCell(r: number, c: number): boolean {
    const winLine = this.room()?.gameState?.winningLine || [];
    return winLine.some((coord: [number, number]) => coord[0] === r && coord[1] === c);
  }

  leaveRoom() {
    this.gameService.leaveRoom();
  }

  shareInvitationLink() {
    const r = this.room();
    if (r) this.gameService.shareInvitationLink(r);
  }

  spawnFloatingEmoji(emoji: string) {
    const id = this.emojiId++;
    this.floatingEmojis.update((list: { id: number; emoji: string }[]) => [...list, { id, emoji }]);
    setTimeout(() => {
      this.floatingEmojis.update((list: { id: number; emoji: string }[]) => list.filter((item: { id: number; emoji: string }) => item.id !== id));
    }, 2000);
  }

  sendEmoji(emoji: string) {
    this.gameService.sendEmoji(emoji);
    this.spawnFloatingEmoji(emoji);
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
    const myNum = this.myPlayerNum();
    if (!winner || !myNum) return;

    const storageKey = `c4_recorded_${r.id}`;
    if (localStorage.getItem(storageKey)) return;

    const gameKey = 'connect4';
    if (winner === 'draw') {
      this.incrementLocalStat(gameKey, 'draws');
    } else if (winner === myNum) {
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
