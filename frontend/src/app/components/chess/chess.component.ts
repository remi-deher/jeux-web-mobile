import { Component, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameService } from '../../services/game.service';
import { GameLayoutComponent } from '../game-layout/game-layout.component';

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
  imports: [CommonModule, GameLayoutComponent],
  template: `
    <app-game-layout
      gameTitle="Jeu d'Échecs"
      [rules]="[
        'Le jeu d\\'échecs oppose deux joueurs sur un échiquier de 8x8 cases.',
        'Pion (♟) : avance d\\'une case (ou deux au premier coup), capture en diagonale.',
        'Tour (♜) : se déplace horizontalement ou verticalement.',
        'Cavalier (♞) : se déplace en L et peut sauter par-dessus les autres pièces.',
        'Fou (♝) : se déplace en diagonale.',
        'Dame (♛) : combine les mouvements de la Tour et du Fou.',
        'Roi (♚) : se déplace d\\'une case dans toutes les directions.',
        'Le but est de mettre le Roi adverse en position de Checkmate (Échec et Mat).'
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
      player1IndicatorSymbol="♔"
      player2IndicatorSymbol="♚"
      (leaveRoom)="leaveRoom()"
      (requestRematch)="requestRematch()"
      (sendEmoji)="sendEmoji($event)"
      (forceEnd)="forceEnd()"
      (shareInvitation)="shareInvitationLink()"
    >
      <div game-board class="board-wrapper-rel">
        <!-- Floating Emojis -->
        <div class="floating-emojis-container">
          @for (item of floatingEmojis(); track item.id) {
            <span class="floating-emoji material-symbols">{{ item.emoji }}</span>
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
      max-width: min(min(92vw, 680px), calc(100dvh - 145px));
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

    .piece-symbol {
      font-size: min(min(4vw, 40px), calc((100dvh - 145px) / 8 * 0.55));
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s;
      user-select: none;
    }

    .piece-symbol:hover {
      transform: scale(1.1);
    }

    .player1-piece {
      color: #ffffff;
      text-shadow: 0 2px 4px rgba(0,0,0,0.5), 0 0 2px rgba(0,0,0,0.8);
    }

    .player2-piece {
      color: #111827;
      text-shadow: 0 2px 4px rgba(255,255,255,0.1), 0 0 2px rgba(0,0,0,0.9);
    }

    .target-dot {
      width: 12px;
      height: 12px;
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
        width: min(min(92vw, 680px), calc(100dvh - 145px));
        height: min(min(92vw, 680px), calc(100dvh - 145px));
        margin: 5px auto;
      }
    }
  `]
})
export class ChessComponent {
  room;
  username;
  showRulesModal = signal<boolean>(false);
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
    const r = this.room();
    if (r?.isLocal) return this.isPlaying();
    return this.isPlaying() && this.currentPlayer() === this.myPlayerNum();
  });

  localOrOnlineTurnText = computed(() => {
    const r = this.room();
    if (r?.isLocal) {
      const colorText = this.currentPlayer() === 1 ? 'Blancs' : 'Noirs';
      return `Tour de : ${this.currentPlayer() === 1 ? this.player1Name() : this.player2Name()} (${colorText})`;
    }
    return "C'est votre tour ! Sélectionnez une pièce.";
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
