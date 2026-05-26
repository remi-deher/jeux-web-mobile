import { Component, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameService } from '../../services/game.service';

interface CheckerMove {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  isJump: boolean;
  jumpedPiece?: { r: number; c: number };
}

@Component({
  selector: 'app-checkers',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="checkers-container">
      @if (room()) {
        <!-- Header -->
        <div class="game-header">
          <button class="back-btn" (click)="leaveRoom()">← Quitter</button>
          <div class="room-badge">Code salon : <strong>{{ room()?.id }}</strong></div>
        </div>

        <!-- Status Panel -->
        <div class="status-panel glass-card">
          <h2>Jeu de Dames</h2>
          
          <div class="turn-indicator">
            <span class="player-badge player1" [class.active]="currentPlayer() === 1 && isPlaying()">
              ⚪ {{ player1Name() }} (Joueur 1)
            </span>
            <span class="vs">VS</span>
            <span class="player-badge player2" [class.active]="currentPlayer() === 2 && isPlaying()">
              ⚫ {{ player2Name() }} (Joueur 2)
            </span>
          </div>

          @if (hasDisconnectedPlayer()) {
            <div class="disconnect-banner">
              <span>⚠️ {{ disconnectedPlayerName() }} s'est déconnecté. En attente...</span>
              @if (!amIDisconnected()) {
                <button class="force-end-btn" (click)="forceEnd()">Forcer la fin (Gagner)</button>
              }
            </div>
          }

          <div class="status-message">
            @if (room()?.status === 'waiting') {
              <div class="pulse-text">En attente d'un adversaire...</div>
            } @else if (isPlaying()) {
              @if (isMyTurn()) {
                <div class="turn-alert my-turn">C'est votre tour ! Sélectionnez un pion.</div>
              } @else {
                <div class="turn-alert opponent-turn">En attente du coup adverse...</div>
              }
            } @else if (room()?.status === 'finished') {
              <div class="win-banner" [class.victory]="isWinner()" [class.defeat]="isLoser()">
                @if (winnerNum() === myPlayerNum()) {
                  🏆 Victoire ! Félicitations !
                } @else if (winnerNum() === 'draw') {
                  🤝 Match nul !
                } @else {
                  ☠️ Défaite... Meilleure chance la prochaine fois !
                }
              </div>
              <div class="rematch-section">
                @if (hasVotedRematch()) {
                  <div class="rematch-status">Demande de revanche envoyée...</div>
                } @else {
                  <button class="primary-btn rematch-btn" (click)="requestRematch()">🔄 Rejouer</button>
                }
              </div>
            }
          </div>
        </div>

        <!-- Emoji Bar -->
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

        <!-- Board Game Area -->
        <div class="board-wrapper-rel">
          <!-- Floating Emoji Reactions -->
          <div class="floating-emojis-container">
            @for (item of floatingEmojis(); track item.id) {
              <span class="floating-emoji">{{ item.emoji }}</span>
            }
          </div>

          <!-- The Checkers Board -->
          <div class="board-container glass-card" [class.disabled]="!isMyTurn()">
            @for (row of [0,1,2,3,4,5,6,7]; track row) {
              <div class="board-row">
                @for (col of [0,1,2,3,4,5,6,7]; track col) {
                  <div 
                    class="board-cell"
                    [class.dark-cell]="(row + col) % 2 === 1"
                    [class.light-cell]="(row + col) % 2 === 0"
                    [class.selected-cell]="selectedPiece()?.r === row && selectedPiece()?.c === col"
                    [class.highlighted-target]="isHighlighted(row, col)"
                    [class.highlighted-hover-target]="isHoverHighlighted(row, col)"
                    (click)="cellClick(row, col)"
                    (mouseenter)="cellMouseEnter(row, col)"
                    (mouseleave)="cellMouseLeave()"
                  >
                    <!-- Visual dot for highlighted target moves -->
                    @if (isHighlighted(row, col)) {
                      <div class="target-dot"></div>
                    } @else if (isHoverHighlighted(row, col)) {
                      <div class="target-dot hover-target-dot"></div>
                    }

                    <!-- Checker piece representation -->
                    @if (board()[row][col]; as piece) {
                      <div 
                        class="piece" 
                        [class.player1-piece]="piece.player === 1"
                        [class.player2-piece]="piece.player === 2"
                        [class.king-piece]="piece.type === 'king'"
                      >
                        @if (piece.type === 'king') { 👑 }
                      </div>
                    }
                  </div>
                }
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .checkers-container {
      max-width: 600px;
      margin: 20px auto;
      padding: 0 15px;
    }

    .game-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }

    .back-btn {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: white;
      border-radius: 8px;
      padding: 8px 16px;
      cursor: pointer;
      font-size: 14px;
      transition: background 0.2s;
    }

    .back-btn:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .room-badge {
      background: rgba(99, 102, 241, 0.2);
      border: 1px solid rgba(99, 102, 241, 0.3);
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 14px;
    }

    .status-panel {
      text-align: center;
      padding: 20px;
      margin-bottom: 15px;
    }

    .status-panel h2 {
      margin: 0 0 15px 0;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 0.5px;
      background: linear-gradient(135deg, #fff 0%, #a5b4fc 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .turn-indicator {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 15px;
      margin-bottom: 15px;
    }

    .player-badge {
      padding: 6px 12px;
      border-radius: 12px;
      font-size: 14px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid transparent;
      transition: all 0.3s ease;
    }

    .player-badge.active {
      background: rgba(99, 102, 241, 0.2);
      border-color: rgba(99, 102, 241, 0.5);
      box-shadow: 0 0 10px rgba(99, 102, 241, 0.3);
      transform: scale(1.05);
    }

    .vs {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.4);
      font-weight: bold;
    }

    .turn-alert {
      font-size: 15px;
      font-weight: 500;
      padding: 8px;
      border-radius: 8px;
    }

    .my-turn {
      color: #34d399;
      background: rgba(52, 211, 153, 0.1);
    }

    .opponent-turn {
      color: rgba(255, 255, 255, 0.6);
    }

    .win-banner {
      font-size: 20px;
      font-weight: bold;
      padding: 12px;
      border-radius: 10px;
      margin-bottom: 15px;
    }

    .victory {
      background: rgba(16, 185, 129, 0.2);
      color: #10b981;
      border: 1px solid rgba(16, 185, 129, 0.4);
    }

    .defeat {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.4);
    }

    .rematch-btn {
      padding: 10px 24px;
      font-size: 16px;
    }

    .rematch-status {
      font-style: italic;
      color: rgba(255, 255, 255, 0.7);
    }

    /* Emoji Reactions */
    .emoji-bar {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 10px;
      padding: 10px;
      margin-bottom: 15px;
    }

    .bar-title {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.6);
      margin-right: 5px;
    }

    .emoji-bar button {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      transition: transform 0.15s ease;
    }

    .emoji-bar button:hover {
      transform: scale(1.3);
    }

    /* Board Area */
    .board-wrapper-rel {
      position: relative;
      width: 100%;
      aspect-ratio: 1;
      max-width: 480px;
      margin: 0 auto;
    }

    .board-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      padding: 8px;
      gap: 2px;
      touch-action: manipulation;
    }

    .board-container.disabled {
      pointer-events: none;
      opacity: 0.9;
    }

    .board-row {
      display: flex;
      flex: 1;
      gap: 2px;
    }

    .board-cell {
      position: relative;
      flex: 1;
      aspect-ratio: 1;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      transition: background-color 0.2s, box-shadow 0.2s;
      touch-action: manipulation;
    }

    .dark-cell {
      background-color: rgba(30, 41, 59, 0.6);
    }

    .light-cell {
      background-color: rgba(241, 245, 249, 0.05);
      cursor: default;
    }

    .selected-cell {
      background-color: rgba(99, 102, 241, 0.4) !important;
      box-shadow: inset 0 0 10px rgba(99, 102, 241, 0.8);
    }

    .highlighted-target {
      background-color: rgba(52, 211, 153, 0.25) !important;
      cursor: pointer;
      box-shadow: inset 0 0 8px rgba(52, 211, 153, 0.6);
    }

    .highlighted-hover-target {
      background-color: rgba(52, 211, 153, 0.12) !important;
      cursor: pointer;
      box-shadow: inset 0 0 6px rgba(52, 211, 153, 0.3);
    }

    .target-dot {
      width: 14px;
      height: 14px;
      background-color: #34d399;
      border-radius: 50%;
      opacity: 0.8;
      box-shadow: 0 0 8px #34d399;
      z-index: 2;
    }

    .hover-target-dot {
      background-color: #34d399 !important;
      opacity: 0.35 !important;
      box-shadow: 0 0 4px #34d399 !important;
    }

    .piece {
      position: relative;
      width: 76%;
      height: 76%;
      border-radius: 50%;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3), inset 0 2px 4px rgba(255, 255, 255, 0.2);
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 18px;
      transition: transform 0.2s ease;
      z-index: 1;
    }

    @media (hover: hover) {
      .piece:hover {
        transform: scale(1.05);
      }
    }

    .player1-piece {
      background: radial-gradient(circle at 30% 30%, #ffffff 0%, #e2e8f0 70%, #94a3b8 100%);
      border: 2px solid #cbd5e1;
    }

    .player2-piece {
      background: radial-gradient(circle at 30% 30%, #475569 0%, #1e293b 70%, #0f172a 100%);
      border: 2px solid #0f172a;
    }

    .king-piece {
      border: 3px double #f59e0b !important;
      box-shadow: 0 0 10px rgba(245, 158, 11, 0.5);
    }

    /* Floating Emojis Layer */
    .floating-emojis-container {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 10;
      overflow: hidden;
    }

    .floating-emoji {
      position: absolute;
      bottom: 10%;
      left: 50%;
      font-size: 40px;
      animation: floatUp 2s ease-out forwards;
      opacity: 0;
    }

    @keyframes floatUp {
      0% {
        transform: translate(-50%, 0) scale(0.5);
        opacity: 0;
      }
      10% {
        opacity: 1;
      }
      90% {
        opacity: 1;
      }
      100% {
        transform: translate(-50%, -350px) scale(1.5);
        opacity: 0;
      }
    }
  `]
})
export class CheckersComponent {
  room;
  username;
  floatingEmojis = signal<{ id: number; emoji: string }[]>([]);
  emojiIdCounter = 0;

  selectedPiece = signal<{ r: number; c: number } | null>(null);

  constructor(private gameService: GameService) {
    this.room = this.gameService.currentRoom;
    this.username = this.gameService.username;

    // React to floating emojis from opponent
    effect(() => {
      const emojiReact = this.gameService.emojiReaction();
      if (emojiReact && emojiReact.senderId !== this.gameService.getSocketId()) {
        const newId = this.emojiIdCounter++;
        this.floatingEmojis.update((list: { id: number; emoji: string }[]) => [
          ...list,
          { id: newId, emoji: emojiReact.emoji }
        ]);
        setTimeout(() => {
          this.floatingEmojis.update((list: { id: number; emoji: string }[]) => list.filter(item => item.id !== newId));
        }, 2000);
      }
    }, { allowSignalWrites: true });

    // Save statistics locally at the end of a match
    effect(() => {
      const status = this.room()?.status;
      if (status === 'finished') {
        this.saveStatsLocally();
      }
    });
  }

  isPlaying = computed(() => this.room()?.status === 'playing');

  board = computed(() => {
    return this.room()?.gameState?.board || Array(8).fill(null).map(() => Array(8).fill(null));
  });

  currentPlayer = computed(() => {
    return this.room()?.gameState?.currentPlayer || 1;
  });

  winnerNum = computed(() => {
    return this.room()?.gameState?.winner || null;
  });

  myPlayerNum = computed(() => {
    const socketId = this.gameService.getSocketId();
    const idx = this.room()?.players?.findIndex(p => p.id === socketId) ?? -1;
    return idx !== -1 ? (idx + 1) as 1 | 2 : 1;
  });

  isMyTurn = computed(() => {
    return this.isPlaying() && this.currentPlayer() === this.myPlayerNum();
  });

  player1Name = computed(() => this.room()?.players[0]?.username || 'Joueur 1');
  player2Name = computed(() => this.room()?.players[1]?.username || 'Joueur 2');

  hasDisconnectedPlayer = computed(() => {
    return this.isPlaying() && this.room()?.players.some(p => p.disconnected);
  });

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
    const socketId = this.gameService.getSocketId();
    return this.room()?.rematchVotes?.includes(socketId || '') || false;
  });

  hoveredPiece = signal<{ r: number; c: number } | null>(null);

  // Client side valid moves computation for selection highlight
  getLegalMovesForPiece = computed(() => {
    const sel = this.selectedPiece();
    if (!sel) return [];

    const moves = this.getPieceMoves(sel.r, sel.c);

    // Mandate jumps if any exist on the board for the current player
    const hasJumpsOnBoard = this.anyJumpsOnBoard();
    if (hasJumpsOnBoard) {
      return moves.filter(m => m.isJump);
    }
    return moves;
  });

  // Client side valid moves computation for hover preview
  getLegalMovesForHoverPiece = computed(() => {
    if (this.selectedPiece()) return [];

    const hover = this.hoveredPiece();
    if (!hover) return [];

    const piece = this.board()[hover.r][hover.c];
    if (!piece || piece.player !== this.myPlayerNum()) return [];

    const moves = this.getPieceMoves(hover.r, hover.c);

    const hasJumpsOnBoard = this.anyJumpsOnBoard();
    if (hasJumpsOnBoard) {
      return moves.filter(m => m.isJump);
    }
    return moves;
  });

  anyJumpsOnBoard(): boolean {
    const playerNum = this.myPlayerNum();
    const boardState = this.board();

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = boardState[r][c];
        if (piece && piece.player === playerNum) {
          const pieceMoves = this.getPieceMoves(r, c);
          if (pieceMoves.some(m => m.isJump)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  getPieceMoves(r: number, c: number): CheckerMove[] {
    const piece = this.board()[r][c];
    if (!piece) return [];

    const moves: CheckerMove[] = [];
    const player = piece.player;
    const isKing = piece.type === 'king';

    const rowDirs = isKing ? [-1, 1] : (player === 1 ? [-1] : [1]);
    const colDirs = [-1, 1];

    for (const rd of rowDirs) {
      for (const cd of colDirs) {
        // Simple step
        const nextR = r + rd;
        const nextC = c + cd;
        if (nextR >= 0 && nextR < 8 && nextC >= 0 && nextC < 8) {
          if (!this.board()[nextR][nextC]) {
            moves.push({ fromRow: r, fromCol: c, toRow: nextR, toCol: nextC, isJump: false });
          }
        }

        // Jump step
        const jumpR = r + rd * 2;
        const jumpC = c + cd * 2;
        const midR = r + rd;
        const midC = c + cd;

        if (jumpR >= 0 && jumpR < 8 && jumpC >= 0 && jumpC < 8) {
          const midPiece = this.board()[midR][midC];
          const targetCell = this.board()[jumpR][jumpC];
          if (midPiece && midPiece.player !== player && !targetCell) {
            moves.push({
              fromRow: r,
              fromCol: c,
              toRow: jumpR,
              toCol: jumpC,
              isJump: true,
              jumpedPiece: { r: midR, c: midC }
            });
          }
        }
      }
    }
    return moves;
  }

  isHighlighted(r: number, c: number): boolean {
    return this.getLegalMovesForPiece().some(m => m.toRow === r && m.toCol === c);
  }

  isHoverHighlighted(r: number, c: number): boolean {
    return this.getLegalMovesForHoverPiece().some(m => m.toRow === r && m.toCol === c);
  }

  cellMouseEnter(r: number, c: number) {
    const piece = this.board()[r][c];
    if (piece && piece.player === this.myPlayerNum()) {
      this.hoveredPiece.set({ r, c });
    }
  }

  cellMouseLeave() {
    this.hoveredPiece.set(null);
  }

  cellClick(r: number, c: number) {
    if (!this.isMyTurn()) return;

    const piece = this.board()[r][c];
    const sel = this.selectedPiece();

    if (piece && piece.player === this.myPlayerNum()) {
      // Select piece
      this.selectedPiece.set({ r, c });
    } else if (sel) {
      // Check if clicking a valid destination
      const validMove = this.getLegalMovesForPiece().find(m => m.toRow === r && m.toCol === c);
      if (validMove) {
        this.gameService.makeCheckersMove(sel.r, sel.c, r, c);
        this.selectedPiece.set(null);
      } else {
        this.selectedPiece.set(null);
      }
    }
  }

  leaveRoom() {
    this.gameService.leaveRoom();
  }

  forceEnd() {
    this.gameService.forceEnd();
  }

  requestRematch() {
    this.gameService.requestRematch();
  }

  sendEmoji(emoji: string) {
    const newId = this.emojiIdCounter++;
    this.floatingEmojis.update((list: { id: number; emoji: string }[]) => [
      ...list,
      { id: newId, emoji }
    ]);
    setTimeout(() => {
      this.floatingEmojis.update((list: { id: number; emoji: string }[]) => list.filter(item => item.id !== newId));
    }, 2000);

    this.gameService.sendEmoji(emoji);
  }

  isWinner(): boolean {
    return this.winnerNum() === this.myPlayerNum();
  }

  isLoser(): boolean {
    const w = this.winnerNum();
    return w !== null && w !== 'draw' && w !== this.myPlayerNum();
  }

  private saveStatsLocally() {
    const roomId = this.room()?.id;
    if (!roomId) return;
    const storageKey = `recorded_game_${roomId}`;
    if (localStorage.getItem(storageKey)) return;

    const gameKey = 'checkers';
    if (this.isWinner()) {
      this.incrementLocalStat(gameKey, 'wins');
    } else if (this.isLoser()) {
      this.incrementLocalStat(gameKey, 'losses');
    } else if (this.winnerNum() === 'draw') {
      this.incrementLocalStat(gameKey, 'draws');
    }

    localStorage.setItem(storageKey, 'true');
  }

  private incrementLocalStat(game: string, statType: 'wins' | 'losses' | 'draws') {
    const key = `stats_${game}_${statType}`;
    const current = parseInt(localStorage.getItem(key) || '0', 10);
    localStorage.setItem(key, (current + 1).toString());
  }
}
