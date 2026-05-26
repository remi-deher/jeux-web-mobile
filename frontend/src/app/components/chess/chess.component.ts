import { Component, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameService } from '../../services/game.service';

interface ChessPiece {
  type: 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';
  player: 1 | 2;
}

interface ChessMove {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
}

@Component({
  selector: 'app-chess',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chess-container">
      @if (room()) {
        <!-- Header -->
        <div class="game-header">
          <button class="back-btn" (click)="leaveRoom()">
            <span class="material-symbols">arrow_back</span>
            <span>Quitter</span>
          </button>
          <div class="room-badge">Code salon : <strong>{{ room()?.id }}</strong></div>
        </div>

        <!-- Status Panel -->
        <div class="status-panel glass-card">
          <h2>Jeu d'Échecs</h2>
          
          <div class="turn-indicator">
            <span class="player-badge player1" [class.active]="currentPlayer() === 1 && isPlaying()">
              👑 {{ player1Name() }} (Blancs)
            </span>
            <span class="vs">VS</span>
            <span class="player-badge player2" [class.active]="currentPlayer() === 2 && isPlaying()">
              👑 {{ player2Name() }} (Noirs)
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
                <div class="turn-alert my-turn">C'est votre tour ! Sélectionnez une pièce.</div>
              } @else {
                <div class="turn-alert opponent-turn">En attente du coup adverse...</div>
              }
            } @else if (room()?.status === 'finished') {
              <div class="win-banner" [class.victory]="isWinner()" [class.defeat]="isLoser()">
                @if (winnerNum() === myPlayerNum()) {
                  🏆 Victoire par Échec et Mat !
                } @else if (winnerNum() === 'draw') {
                  🤝 Match nul (Pat) !
                } @else {
                  ☠️ Échec et Mat ! Défaite...
                }
              </div>
              <div class="rematch-section">
                @if (hasVotedRematch()) {
                  <div class="rematch-status">Demande de revanche envoyée...</div>
                } @else {
                  <button class="primary-btn rematch-btn" (click)="requestRematch()">
                    <span class="material-symbols">replay</span>
                    <span>Rejouer</span>
                  </button>
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

        <!-- Chess Board -->
        <div class="board-wrapper-rel">
          <!-- Floating Emojis -->
          <div class="floating-emojis-container">
            @for (item of floatingEmojis(); track item.id) {
              <span class="floating-emoji">{{ item.emoji }}</span>
            }
          </div>

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
                    <!-- Visual dot for valid moves -->
                    @if (isHighlighted(row, col)) {
                      <div class="target-dot"></div>
                    } @else if (isHoverHighlighted(row, col)) {
                      <div class="target-dot hover-target-dot"></div>
                    }

                    <!-- Chess piece Unicode icon -->
                    @if (board()[row][col]; as piece) {
                      <span 
                        class="piece-symbol"
                        [class.player1-piece]="piece.player === 1"
                        [class.player2-piece]="piece.player === 2"
                      >
                        {{ getPieceSymbol(piece) }}
                      </span>
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
    .chess-container {
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

    .status-panel {
      background: var(--m3-surface);
      border: var(--m3-border);
      backdrop-filter: blur(12px);
      border-radius: var(--m3-radius-large);
      box-shadow: var(--m3-shadow);
      color: white;
      text-align: center;
      padding: 20px;
      margin-bottom: 15px;
    }

    .status-panel h2 {
      margin: 0 0 15px 0;
      font-size: 26px;
      font-weight: 700;
      letter-spacing: 0.5px;
      background: linear-gradient(135deg, #fbbf24 0%, #cbd5e1 100%);
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
      font-size: 18px;
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
      opacity: 0.95;
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
      transition: background-color 0.2s;
      touch-action: manipulation;
    }

    .dark-cell {
      background-color: rgba(51, 65, 85, 0.55);
    }

    .light-cell {
      background-color: rgba(241, 245, 249, 0.12);
    }

    .selected-cell {
      background-color: rgba(99, 102, 241, 0.45) !important;
      box-shadow: inset 0 0 8px rgba(99, 102, 241, 0.8);
    }

    .highlighted-target {
      background-color: rgba(52, 211, 153, 0.22) !important;
      cursor: pointer;
      box-shadow: inset 0 0 6px rgba(52, 211, 153, 0.5);
    }

    .highlighted-hover-target {
      background-color: rgba(52, 211, 153, 0.1) !important;
      cursor: pointer;
      box-shadow: inset 0 0 4px rgba(52, 211, 153, 0.3);
    }

    .target-dot {
      width: 12px;
      height: 12px;
      background-color: #34d399;
      border-radius: 50%;
      opacity: 0.75;
      box-shadow: 0 0 6px #34d399;
      position: absolute;
      z-index: 2;
    }

    .hover-target-dot {
      background-color: #34d399 !important;
      opacity: 0.35 !important;
      box-shadow: 0 0 3px #34d399 !important;
      position: absolute;
      z-index: 2;
    }

    .piece-symbol {
      font-size: 38px;
      line-height: 1;
      user-select: none;
      z-index: 1;
      transition: transform 0.15s ease;
    }

    @media (hover: hover) {
      .piece-symbol:hover {
        transform: scale(1.1);
      }
    }

    .player1-piece {
      color: #fcd34d; /* Golden white for player 1 */
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4), 0 0 8px rgba(252, 211, 77, 0.3);
    }

    .player2-piece {
      color: #94a3b8; /* Slate gray/black for player 2 */
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6), 0 0 8px rgba(148, 163, 184, 0.2);
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
export class ChessComponent {
  room;
  username;
  floatingEmojis = signal<{ id: number; emoji: string }[]>([]);
  emojiIdCounter = 0;

  selectedPiece = signal<{ r: number; c: number } | null>(null);

  constructor(private gameService: GameService) {
    this.room = this.gameService.currentRoom;
    this.username = this.gameService.username;

    // Floating emojis support
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

  player1Name = computed(() => this.room()?.players[0]?.username || 'Joueur Blancs');
  player2Name = computed(() => this.room()?.players[1]?.username || 'Joueur Noirs');

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

  // Legal moves calculator on client side for highlight
  getLegalMovesForPiece = computed(() => {
    const sel = this.selectedPiece();
    if (!sel) return [];
    return this.calculateClientLegalMoves(sel.r, sel.c);
  });

  // Legal moves calculator on client side for hover preview
  getLegalMovesForHoverPiece = computed(() => {
    if (this.selectedPiece()) return [];

    const hover = this.hoveredPiece();
    if (!hover) return [];

    const piece = this.board()[hover.r][hover.c];
    if (!piece || piece.player !== this.myPlayerNum()) return [];

    return this.calculateClientLegalMoves(hover.r, hover.c);
  });

  getPieceSymbol(piece: ChessPiece): string {
    const symbols = {
      pawn: '♟',
      knight: '♞',
      bishop: '♝',
      rook: '♜',
      queen: '♛',
      king: '♚'
    };
    return symbols[piece.type] || '';
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
      this.selectedPiece.set({ r, c });
    } else if (sel) {
      const validMove = this.getLegalMovesForPiece().find(m => m.toRow === r && m.toCol === c);
      if (validMove) {
        this.gameService.makeChessMove(sel.r, sel.c, r, c);
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

    const gameKey = 'chess';
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

  // Helper method to mirror the chess check validation rules on the frontend
  private calculateClientLegalMoves(r: number, c: number): ChessMove[] {
    const piece = this.board()[r][c];
    if (!piece || piece.player !== this.myPlayerNum()) return [];

    const pseudo = this.getPseudoLegalMoves(this.board(), r, c);
    const legal: ChessMove[] = [];

    for (const m of pseudo) {
      // Simulate move
      const tempBoard = this.board().map((row: any) => [...row]);
      tempBoard[m.toRow][m.toCol] = tempBoard[m.fromRow][m.fromCol];
      tempBoard[m.fromRow][m.fromCol] = null;

      if (!this.isKingInCheck(tempBoard, this.myPlayerNum())) {
        legal.push(m);
      }
    }
    return legal;
  }

  private findKing(board: (ChessPiece | null)[][], player: 1 | 2): { r: number; c: number } | null {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.type === 'king' && piece.player === player) {
          return { r, c };
        }
      }
    }
    return null;
  }

  private isKingInCheck(board: (ChessPiece | null)[][], player: 1 | 2): boolean {
    const kingPos = this.findKing(board, player);
    if (!kingPos) return false;

    const opponent = player === 1 ? 2 : 1;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.player === opponent) {
          const moves = this.getPseudoLegalMoves(board, r, c);
          if (moves.some(m => m.toRow === kingPos.r && m.toCol === kingPos.c)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private getPseudoLegalMoves(board: (ChessPiece | null)[][], r: number, c: number): ChessMove[] {
    const piece = board[r][c];
    if (!piece) return [];

    const moves: ChessMove[] = [];
    const player = piece.player;
    const opponent = player === 1 ? 2 : 1;

    const addMove = (tr: number, tc: number): boolean => {
      if (tr < 0 || tr >= 8 || tc < 0 || tc >= 8) return false;
      const target = board[tr][tc];
      if (!target) {
        moves.push({ fromRow: r, fromCol: c, toRow: tr, toCol: tc });
        return true;
      } else {
        if (target.player === opponent) {
          moves.push({ fromRow: r, fromCol: c, toRow: tr, toCol: tc });
        }
        return false;
      }
    };

    switch (piece.type) {
      case 'pawn': {
        const dir = player === 1 ? -1 : 1;
        const startRow = player === 1 ? 6 : 1;

        const f1 = r + dir;
        if (f1 >= 0 && f1 < 8 && !board[f1][c]) {
          moves.push({ fromRow: r, fromCol: c, toRow: f1, toCol: c });
          const f2 = r + dir * 2;
          if (r === startRow && !board[f2][c]) {
            moves.push({ fromRow: r, fromCol: c, toRow: f2, toCol: c });
          }
        }

        for (const dc of [-1, 1]) {
          const tr = r + dir;
          const tc = c + dc;
          if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
            const target = board[tr][tc];
            if (target && target.player === opponent) {
              moves.push({ fromRow: r, fromCol: c, toRow: tr, toCol: tc });
            }
          }
        }
        break;
      }

      case 'knight': {
        const offsets = [
          [-2, -1], [-2, 1], [-1, -2], [-1, 2],
          [1, -2], [1, 2], [2, -1], [2, 1]
        ];
        for (const [dr, dc] of offsets) {
          const tr = r + dr;
          const tc = c + dc;
          if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
            const target = board[tr][tc];
            if (!target || target.player === opponent) {
              moves.push({ fromRow: r, fromCol: c, toRow: tr, toCol: tc });
            }
          }
        }
        break;
      }

      case 'bishop': {
        const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        for (const [dr, dc] of dirs) {
          let step = 1;
          while (true) {
            if (!addMove(r + dr * step, c + dc * step)) break;
            step++;
          }
        }
        break;
      }

      case 'rook': {
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of dirs) {
          let step = 1;
          while (true) {
            if (!addMove(r + dr * step, c + dc * step)) break;
            step++;
          }
        }
        break;
      }

      case 'queen': {
        const dirs = [
          [-1, -1], [-1, 1], [1, -1], [1, 1],
          [-1, 0], [1, 0], [0, -1], [0, 1]
        ];
        for (const [dr, dc] of dirs) {
          let step = 1;
          while (true) {
            if (!addMove(r + dr * step, c + dc * step)) break;
            step++;
          }
        }
        break;
      }

      case 'king': {
        const dirs = [
          [-1, -1], [-1, 1], [1, -1], [1, 1],
          [-1, 0], [1, 0], [0, -1], [0, 1]
        ];
        for (const [dr, dc] of dirs) {
          const tr = r + dr;
          const tc = c + dc;
          if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
            const target = board[tr][tc];
            if (!target || target.player === opponent) {
              moves.push({ fromRow: r, fromCol: c, toRow: tr, toCol: tc });
            }
          }
        }
        break;
      }
    }
    return moves;
  }
}
