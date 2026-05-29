import { Component, computed, signal, inject } from '@angular/core';
import { GameService } from '../../services/game.service';
import { GameLayoutComponent } from '../game-layout/game-layout.component';
import { FloatingEmojisComponent } from '../floating-emojis/floating-emojis.component';
import { injectGameSession } from '../../services/game-session.helper';

@Component({
  selector: 'app-tictactoe',
  standalone: true,
  imports: [GameLayoutComponent, FloatingEmojisComponent],
  template: `
    <app-game-layout
      gameTitle="Morpion"
      [rules]="[
        'Le Morpion (Tic-Tac-Toe) se joue sur une grille de 3x3 cases.',
        'Chaque joueur choisit son symbole : ✕ ou ◯.',
        'Les joueurs posent tour à tour leur symbole sur une case vide.',
        'Le premier à aligner 3 symboles identiques (horizontalement, verticalement ou en diagonale) remporte la partie.',
        'Si la grille est pleine sans alignement, la partie se termine par un match nul.'
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
      [player1Active]="currentPlayerNum() === 1 && isPlaying()"
      [player2Active]="currentPlayerNum() === 2 && isPlaying()"
      player1IndicatorSymbol="✕"
      player2IndicatorSymbol="◯"
      (leaveRoom)="leaveRoom()"
      (requestRematch)="requestRematch()"
      (sendEmoji)="sendEmoji($event)"
      (forceEnd)="forceEnd()"
      (shareInvitation)="shareInvitationLink()"
    >
      <div game-board class="board-wrapper">
        <!-- Floating Emojis Component -->
        <app-floating-emojis [emojis]="floatingEmojis()"></app-floating-emojis>

        <!-- 3x3 Grid -->
        <div class="board-grid">
          @for (cell of board(); track $index) {
            <div 
              class="board-cell"
              [class.winning-cell]="isWinningCell($index)"
              [class.disabled]="!isMyTurn() || cell !== null"
              (click)="makeMove($index)"
              (mouseenter)="isMyTurn() && cell === null ? hoveredCell.set($index) : null"
              (mouseleave)="hoveredCell.set(null)"
            >
              @if (cell === 'X') {
                <span class="sign sign-x">✕</span>
              } @else if (cell === 'O') {
                <span class="sign sign-o">◯</span>
              } @else if (isMyTurn() && hoveredCell() === $index) {
                <span class="sign ghost-sign" [class.sign-x]="currentPlayerSign() === 'X'" [class.sign-o]="currentPlayerSign() === 'O'">
                  {{ currentPlayerSign() === 'X' ? '✕' : '◯' }}
                </span>
              }
            </div>
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
    }

    .board-grid {
      display: grid;
      grid-template-columns: repeat(3, min(min(26vw, 160px), calc((100dvh - 150px) / 3)));
      grid-template-rows: repeat(3, min(min(26vw, 160px), calc((100dvh - 150px) / 3)));
      gap: 12px;
      background: rgba(30, 41, 59, 0.6);
      border: 4px solid var(--md-outline-variant);
      border-radius: var(--md-radius-xl);
      padding: 16px;
      box-shadow: 0 15px 35px rgba(0, 0, 0, 0.4);
    }

    .board-cell {
      background: #0f172a;
      border: 1px solid var(--md-outline-variant);
      border-radius: var(--md-radius-lg);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      box-shadow: inset 0 2px 4px rgba(0,0,0,0.5);
    }

    .board-cell:hover:not(.disabled) {
      background: #1e293b;
      transform: scale(1.02);
    }

    .board-cell.disabled {
      cursor: not-allowed;
    }

    .board-cell.winning-cell {
      animation: pulseWin 1.2s infinite alternate;
      border-color: #10b981;
    }

    @keyframes pulseWin {
      0% {
        box-shadow: inset 0 2px 4px rgba(0,0,0,0.5), 0 0 4px #10b981;
        background: #112240;
      }
      100% {
        box-shadow: inset 0 2px 4px rgba(0,0,0,0.5), 0 0 16px #10b981;
        background: #064e3b;
      }
    }

    .sign {
      font-size: min(min(8vw, 64px), calc((100dvh - 150px) / 3 * 0.5));
      font-weight: 800;
      animation: scaleIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }

    .sign-x {
      color: #ff4b5c;
      text-shadow: 0 0 12px rgba(255, 75, 92, 0.5);
    }

    .sign-o {
      color: #ffd13b;
      text-shadow: 0 0 12px rgba(255, 209, 59, 0.5);
    }

    .ghost-sign {
      opacity: 0.4;
      pointer-events: none;
    }

    @keyframes scaleIn {
      0% { transform: scale(0.5); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
    }

    @media (max-width: 480px) {
      .board-grid {
        grid-template-columns: repeat(3, min(80px, 22vw));
        grid-template-rows: repeat(3, min(80px, 22vw));
        gap: 8px;
        padding: 10px;
      }
      .sign {
        font-size: min(36px, 10vh);
      }
    }

    @media (orientation: landscape) and (min-width: 768px) {
      .board-grid {
        grid-template-columns: repeat(3, min(min(26vw, 180px), calc((100dvh - 150px) / 3)));
        grid-template-rows: repeat(3, min(min(26vw, 180px), calc((100dvh - 150px) / 3)));
        gap: 12px;
      }
    }
  `],
})
export class TicTacToeComponent {
  private gameService = inject(GameService);
  private session = injectGameSession('tictactoe');

  showRulesModal = signal<boolean>(false);
  hoveredCell = signal<number | null>(null);

  // Delegates mapping
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

  board = computed(() => this.room()?.gameState?.board || Array(9).fill(null));

  myPlayerSign = computed<'X' | 'O' | null>(() => {
    const r = this.room();
    if (!r) return null;
    const socketId = this.gameService.getSocketId();
    const idx = r.players.findIndex(p => p.id === socketId);
    return idx === 0 ? 'X' : idx === 1 ? 'O' : null;
  });

  currentPlayerSign = computed<'X' | 'O'>(() => this.room()?.gameState?.currentPlayer || 'X');

  isMyTurn = computed(() => {
    const r = this.room();
    if (r?.isLocal) return this.isPlaying();
    return this.isPlaying() && this.myPlayerSign() === this.currentPlayerSign();
  });

  localOrOnlineTurnText = computed(() => {
    const r = this.room();
    if (r?.isLocal) {
      const colorText = this.currentPlayerSign() === 'X' ? 'rouge' : 'jaune';
      return `Tour de : ${this.currentPlayerSign() === 'X' ? this.player1Name() : this.player2Name()} (${colorText})`;
    }
    return "C'est votre tour ! Cliquez sur une case vide.";
  });

  localOrOnlineOpponentTurnText = computed(() => {
    const r = this.room();
    if (r?.isLocal) {
      return '';
    }
    return "En attente du coup adverse...";
  });

  currentPlayerNum = computed(() => this.currentPlayerSign() === 'X' ? 1 : 2);

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
}
