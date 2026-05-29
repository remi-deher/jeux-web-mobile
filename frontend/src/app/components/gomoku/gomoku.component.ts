import { Component, computed, signal, inject } from '@angular/core';
import { GameService } from '../../services/game.service';
import { GameLayoutComponent } from '../game-layout/game-layout.component';
import { FloatingEmojisComponent } from '../floating-emojis/floating-emojis.component';
import { injectGameSession } from '../../services/game-session.helper';

@Component({
  selector: 'app-gomoku',
  standalone: true,
  imports: [GameLayoutComponent, FloatingEmojisComponent],
  template: `
    <app-game-layout
      gameTitle="Gomoku"
      [rules]="[
        'Le Gomoku se joue sur une grille de 15x15 intersections.',
        'Les joueurs posent tour à tour une pierre de leur couleur (noir ou blanc) sur une case vide.',
        'Le premier joueur à aligner exactement 5 pierres horizontalement, verticalement ou en diagonale remporte la partie.',
        'Si la grille est pleine sans alignement, la partie se termine par un match nul.'
      ]"
      [room]="room()"
      [isPlaying]="isPlaying()"
      [isMyTurn]="isMyTurn()"
      [turnAlertText]="localOrOnlineTurnText()"
      [opponentTurnText]="localOrOnlineOpponentTurnText()"
      [turnAlertClass]="room()?.isLocal ? (currentPlayerNum() === 1 ? 'local-turn-black' : 'local-turn-white') : ''"
      [winnerLabel]="winnerLabel()"
      [isWinner]="isWinner()"
      [isLoser]="isLoser()"
      [hasVotedRematch]="hasVotedRematch()"
      [disconnectedPlayerName]="disconnectedPlayerName()"
      [player1Name]="player1Name()"
      [player2Name]="player2Name()"
      [player1Active]="currentPlayerNum() === 1 && isPlaying()"
      [player2Active]="currentPlayerNum() === 2 && isPlaying()"
      player1IndicatorClass="indicator-element token-black"
      player1IndicatorSymbol=""
      player2IndicatorClass="indicator-element token-white"
      player2IndicatorSymbol=""
      (leaveRoom)="leaveRoom()"
      (requestRematch)="requestRematch()"
      (sendEmoji)="sendEmoji($event)"
      (forceEnd)="forceEnd()"
      (shareInvitation)="shareInvitationLink()"
    >
      <div game-board class="board-wrapper">
        <app-floating-emojis [emojis]="floatingEmojis()"></app-floating-emojis>

        <!-- 15x15 Wooden Board -->
        <div class="board-grid">
          @for (row of [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14]; track row) {
            @for (col of [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14]; track col) {
              <div 
                class="board-cell"
                [class.winning-cell]="isWinningCell(row, col)"
                [class.hover-row]="hoveredCell()?.row === row"
                [class.hover-col]="hoveredCell()?.col === col"
                [class.disabled]="!isMyTurn() || board()[row][col] !== 0"
                (click)="makeMove(row, col)"
                (mouseenter)="board()[row][col] === 0 ? hoveredCell.set({row, col}) : null"
                (mouseleave)="hoveredCell.set(null)"
              >
                <!-- Star point indicator (hoshi) -->
                @if (isStarPoint(row, col)) {
                  <div class="star-point"></div>
                }

                <!-- Render placed stones -->
                @if (board()[row][col] === 1) {
                  <div class="stone stone-black" [class.last-played]="isLastMove(row, col)"></div>
                } @else if (board()[row][col] === 2) {
                  <div class="stone stone-white" [class.last-played]="isLastMove(row, col)"></div>
                } @else if (isMyTurn() && hoveredCell()?.row === row && hoveredCell()?.col === col) {
                  <div 
                    class="ghost-stone" 
                    [class.stone-black]="currentPlayerNum() === 1" 
                    [class.stone-white]="currentPlayerNum() === 2"
                  ></div>
                }
              </div>
            }
          }
        </div>
      </div>
    </app-game-layout>
  `,
  styles: [`
    .board-wrapper {
      position: relative;
      height: 100%;
      margin: 0 auto;
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 0;
      width: 100%;
      padding: 10px;
    }

    .board-grid {
      display: grid;
      grid-template-columns: repeat(15, 1fr);
      grid-template-rows: repeat(15, 1fr);
      background: #D7CCC8; /* Wood background color */
      border: 8px solid #5D4037; /* Dark wood frame border */
      border-radius: var(--md-radius-lg);
      padding: 10px;
      box-shadow: 0 15px 35px rgba(0, 0, 0, 0.5);
      position: relative;
      width: 100%;
      max-width: min(min(95vw, 700px), calc(100dvh - 140px));
      aspect-ratio: 1;
    }

    .board-cell {
      position: relative;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.15s;
    }

    /* Intersecting board grid lines using pseudo elements */
    .board-cell::before {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      top: 50%;
      height: 1.5px;
      background: #5D4037;
      opacity: 0.55;
      pointer-events: none;
      transition: background-color 0.2s, opacity 0.2s;
    }

    .board-cell::after {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      left: 50%;
      width: 1.5px;
      background: #5D4037;
      opacity: 0.55;
      pointer-events: none;
      transition: background-color 0.2s, opacity 0.2s;
    }

    /* Highlight hovered crosshair lines */
    .board-cell.hover-row::before,
    .board-cell.hover-col::after {
      background: #FF5252 !important;
      opacity: 0.7;
    }

    .board-cell:hover:not(.disabled) {
      background: rgba(93, 64, 55, 0.08);
    }

    .board-cell.disabled {
      cursor: not-allowed;
    }

    /* Star point markers (Hoshi) */
    .star-point {
      position: absolute;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #5D4037;
      opacity: 0.85;
      z-index: 1;
      pointer-events: none;
    }

    /* Highlight winning stones */
    .board-cell.winning-cell .stone {
      box-shadow: 0 0 16px #10b981;
      border: 2px solid #10b981;
      transform: scale(1.05);
      animation: pulseWin 1s infinite alternate;
    }

    @keyframes pulseWin {
      0% { box-shadow: 0 0 8px #10b981; }
      100% { box-shadow: 0 0 20px #10b981; }
    }

    /* 3D Stones Styling */
    .stone {
      position: absolute;
      width: 88%;
      height: 88%;
      border-radius: 50%;
      z-index: 2;
      box-shadow: 0 3px 6px rgba(0, 0, 0, 0.45);
      animation: stonePlace 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    }

    .stone-black {
      background: radial-gradient(circle at 35% 35%, #4e4e4e 0%, #1e1e1e 60%, #0c0c0c 100%);
    }

    .stone-white {
      background: radial-gradient(circle at 35% 35%, #ffffff 0%, #f6f6f6 50%, #e5e5e5 85%, #cccccc 100%);
      border: 1px solid rgba(0, 0, 0, 0.2);
    }

    /* Last Move indicator (pulsing red center dot) */
    .stone.last-played::after {
      content: '';
      position: absolute;
      width: 8px;
      height: 8px;
      background: #FF5252;
      border-radius: 50%;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      box-shadow: 0 0 6px #FF5252;
      animation: pulseLastMove 1s infinite alternate;
      z-index: 3;
    }

    @keyframes pulseLastMove {
      0% { opacity: 0.6; transform: translate(-50%, -50%) scale(0.85); }
      100% { opacity: 1; transform: translate(-50%, -50%) scale(1.25); }
    }

    .ghost-stone {
      position: absolute;
      width: 88%;
      height: 88%;
      border-radius: 50%;
      z-index: 2;
      opacity: 0.45;
      pointer-events: none;
    }

    @keyframes stonePlace {
      0% { transform: scale(0.6); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
    }

    @media (max-width: 480px) {
      .board-grid {
        max-width: min(95vw, calc(100dvh - 130px));
        padding: 4px;
        border-width: 5px;
      }
      .star-point {
        width: 4px;
        height: 4px;
      }
      .stone.last-played::after {
        width: 6px;
        height: 6px;
      }
    }
  `]
})
export class GomokuComponent {
  private gameService = inject(GameService);
  private session = injectGameSession('gomoku');

  hoveredCell = signal<{row: number; col: number} | null>(null);

  // Session Delegates
  room = this.session.room;
  isPlaying = this.session.isPlaying;
  floatingEmojis = this.session.floatingEmojis;
  disconnectedPlayerName = this.session.disconnectedPlayerName;
  hasVotedRematch = this.session.hasVotedRematch;
  player1Name = this.session.player1Name;
  player2Name = this.session.player2Name;

  leaveRoom = this.session.leaveRoom;
  shareInvitationLink = this.session.shareInvitationLink;
  requestRematch = this.session.requestRematch;
  forceEnd = this.session.forceEnd;
  sendEmoji = this.session.sendEmoji;

  board = computed(() => this.room()?.gameState?.board || Array(15).fill(null).map(() => Array(15).fill(0)));

  myPlayerNum = computed<number | null>(() => {
    const r = this.room();
    if (!r) return null;
    const socketId = this.gameService.getSocketId();
    const idx = r.players.findIndex(p => p.id === socketId);
    return idx !== -1 ? idx + 1 : null;
  });

  currentPlayerNum = computed<number>(() => this.room()?.gameState?.currentPlayer || 1);

  isMyTurn = computed(() => {
    const r = this.room();
    if (r?.isLocal) return this.isPlaying();
    return this.isPlaying() && this.myPlayerNum() === this.currentPlayerNum();
  });

  localOrOnlineTurnText = computed(() => {
    const r = this.room();
    if (r?.isLocal) {
      const colorText = this.currentPlayerNum() === 1 ? 'Noir' : 'Blanc';
      return `Tour de : ${this.currentPlayerNum() === 1 ? this.player1Name() : this.player2Name()} (${colorText})`;
    }
    return "C'est votre tour ! Posez une pierre.";
  });

  localOrOnlineOpponentTurnText = computed(() => {
    const r = this.room();
    if (r?.isLocal) return '';
    return "En attente du coup adverse...";
  });

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

  makeMove(row: number, col: number) {
    if (this.isMyTurn() && this.board()[row][col] === 0) {
      this.gameService.makeGomokuMove(row, col);
    }
  }

  isWinningCell(row: number, col: number): boolean {
    const winLine = this.room()?.gameState?.winningLine || [];
    return winLine.some((coord: any) => coord[0] === row && coord[1] === col);
  }

  isLastMove(row: number, col: number): boolean {
    const last = this.room()?.gameState?.lastMove;
    return !!last && last[0] === row && last[1] === col;
  }

  isStarPoint(row: number, col: number): boolean {
    const points = [[3,3], [3,11], [7,7], [11,3], [11,11]];
    return points.some(([r, c]) => r === row && c === col);
  }
}
