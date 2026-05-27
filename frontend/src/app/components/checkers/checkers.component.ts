import { Component, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameService } from '../../services/game.service';
import { GameLayoutComponent } from '../game-layout/game-layout.component';

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
  imports: [CommonModule, GameLayoutComponent],
  template: `
    <app-game-layout
      gameTitle="Jeu de Dames"
      [rules]="[
        'Le jeu de dames se déroule sur un plateau de 8x8 cases.',
        'Les pions se déplacent uniquement en diagonale vers l\\'avant, d\\'une case à la fois, sur les cases sombres.',
        'Prise obligatoire : Si vous pouvez capturer un pion adverse en sautant par-dessus vers une case vide située derrière lui, vous devez le faire.',
        'Lorsqu\\'un pion atteint la dernière rangée adverse, il est promu en Dame (👑).',
        'La Dame peut se déplacer et capturer en diagonale vers l\\'avant comme vers l\\'arrière, sur n\\'importe quel nombre de cases libres.',
        'Le joueur qui capture toutes les pièces adverses ou bloque toute possibilité de mouvement à son adversaire gagne la partie.'
      ]"
      [room]="room()"
      [isPlaying]="isPlaying()"
      [isMyTurn]="isMyTurn()"
      [turnAlertText]="localOrOnlineTurnText()"
      [opponentTurnText]="localOrOnlineOpponentTurnText()"
      [turnAlertClass]="room()?.isLocal ? (currentPlayerNum() === 1 ? 'local-turn-red' : 'local-turn-yellow') : ''"
      [winnerLabel]="winnerLabel()"
      [isWinner]="isWinner()"
      [isLoser]="isLoser()"
      [hasVotedRematch]="hasVotedRematch()"
      [disconnectedPlayerName]="disconnectedPlayerName()"
      [player1Name]="player1Name()"
      [player2Name]="player2Name()"
      [player1Active]="currentPlayer() === 1 && isPlaying()"
      [player2Active]="currentPlayer() === 2 && isPlaying()"
      player1IndicatorClass="piece-indicator player1-dot"
      player2IndicatorClass="piece-indicator player2-dot"
      (leaveRoom)="leaveRoom()"
      (requestRematch)="requestRematch()"
      (sendEmoji)="sendEmoji($event)"
      (forceEnd)="forceEnd()"
      (shareInvitation)="shareInvitationLink()"
    >
      <div game-board class="board-wrapper-rel">
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
    </app-game-layout>
  `,
  styles: [`
    .board-wrapper-rel {
      position: relative;
      margin: 0 auto;
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 0;
      width: 100%;
    }

    .board-container {
      display: flex;
      flex-direction: column;
      background: rgba(30, 41, 59, 0.8) !important;
      border: 4px solid var(--md-outline-variant);
      border-radius: var(--md-radius-xl);
      padding: 12px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
      width: 100%;
      max-width: min(480px, 70vh);
      box-sizing: border-box;
    }

    .board-row {
      display: flex;
      flex: 1;
    }

    .board-cell {
      flex: 1;
      aspect-ratio: 1;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .light-cell {
      background-color: #f1f5f9;
    }

    .dark-cell {
      background-color: #334155;
    }

    .selected-cell {
      background-color: #6366f1 !important;
    }

    .highlighted-target {
      background-color: #10b981 !important;
    }

    .highlighted-hover-target {
      background-color: #059669 !important;
    }

    .piece {
      width: 80%;
      height: 80%;
      border-radius: 50%;
      box-shadow: inset 0 -3px 5px rgba(0,0,0,0.4),
                  0 4px 6px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: min(20px, 4vh);
      transition: transform 0.2s;
    }

    .piece:hover {
      transform: scale(1.05);
    }

    .player1-piece {
      background: radial-gradient(circle at 35% 35%, #ffffff 0%, #d1d5db 70%, #9ca3af 100%);
      border: 1px solid #9ca3af;
    }

    .player2-piece {
      background: radial-gradient(circle at 35% 35%, #374151 0%, #111827 70%, #030712 100%);
      border: 1px solid #1f2937;
    }

    .king-piece {
      border: 2px solid #fbbf24;
    }

    .target-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background-color: #34d399;
      box-shadow: 0 0 8px rgba(52, 211, 153, 0.8);
      position: absolute;
      pointer-events: none;
    }

    .hover-target-dot {
      background-color: #fbbf24;
      box-shadow: 0 0 8px rgba(251, 191, 36, 0.8);
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
      0% { transform: translateY(100px) scale(0.5); opacity: 0; }
      20% { transform: translateY(0) scale(1.2); opacity: 1; }
      80% { transform: translateY(-80px) scale(1.0); opacity: 1; }
      100% { transform: translateY(-150px) scale(0.6); opacity: 0; }
    }

    @media (max-width: 480px) {
      .board-container {
        padding: 6px;
      }
    }
  
    @media (orientation: landscape) and (min-width: 768px) {
      .board-container {
        width: min(450px, calc(100dvh - 220px));
        height: min(450px, calc(100dvh - 220px));
        margin: 5px auto;
      }
    }
  `],
})
export class CheckersComponent {
  room;
  username;
  showRulesModal = signal<boolean>(false);
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
    const r = this.room();
    if (r?.isLocal) return this.isPlaying();
    return this.isPlaying() && this.currentPlayer() === this.myPlayerNum();
  });

  localOrOnlineTurnText = computed(() => {
    const r = this.room();
    if (r?.isLocal) {
      const colorText = this.currentPlayer() === 1 ? 'rouge' : 'jaune';
      return `Tour de : ${this.currentPlayer() === 1 ? this.player1Name() : this.player2Name()} (${colorText})`;
    }
    return "C'est votre tour ! Sélectionnez un pion.";
  });

  localOrOnlineOpponentTurnText = computed(() => {
    const r = this.room();
    if (r?.isLocal) {
      return '';
    }
    return "En attente du coup adverse...";
  });

  winnerLabel = computed(() => {
    const win = this.winnerNum();
    if (win === 'draw') return 'draw';
    if (win === 1) return this.player1Name();
    if (win === 2) return this.player2Name();
    return '';
  });

  currentPlayerNum = computed(() => this.currentPlayer());

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

  shareInvitationLink() {
    const r = this.room();
    if (r) this.gameService.shareInvitationLink(r);
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
