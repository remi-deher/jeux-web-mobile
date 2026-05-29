import { Component, computed, signal, inject } from '@angular/core';
import { GameService } from '../../services/game.service';
import { GameLayoutComponent } from '../game-layout/game-layout.component';
import { FloatingEmojisComponent } from '../floating-emojis/floating-emojis.component';
import { injectGameSession } from '../../services/game-session.helper';

@Component({
  selector: 'app-othello',
  standalone: true,
  imports: [GameLayoutComponent, FloatingEmojisComponent],
  template: `
    <app-game-layout
      gameTitle="Othello"
      [rules]="[
        'Chaque joueur dispose de jetons double-face (noir et blanc). Le noir commence toujours.',
        'À chaque tour, vous devez poser un jeton sur une case vide de façon à encadrer un ou plusieurs jetons adverses entre votre nouveau jeton et un autre déjà à vous.',
        'Tous les jetons adverses ainsi encadrés (horizontalement, verticalement ou diagonalement) sont retournés à votre couleur.',
        'Les cases vertes en surbrillance indiquent vos coups valides.',
        'Si un joueur n\\'a aucun coup valide, son tour est passé. Si aucun joueur ne peut jouer, la partie est finie et celui qui a le plus de jetons gagne.'
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

        <div class="othello-container">
          <!-- Scores banner -->
          <div class="score-banner glass-card">
            <div class="score-item" [class.active]="currentPlayerNum() === 1">
              <span class="score-dot black"></span>
              <span class="score-name">{{ player1Name() }}</span>
              <span class="score-value">{{ scoreP1() }}</span>
            </div>
            <div class="vs-label">VS</div>
            <div class="score-item" [class.active]="currentPlayerNum() === 2">
              <span class="score-dot white"></span>
              <span class="score-name">{{ player2Name() }}</span>
              <span class="score-value">{{ scoreP2() }}</span>
            </div>
          </div>

          <!-- 8x8 Board -->
          <div class="board-grid">
            @for (row of [0,1,2,3,4,5,6,7]; track row) {
              @for (col of [0,1,2,3,4,5,6,7]; track col) {
                <div 
                  class="board-cell"
                  [class.valid]="isValidMove(row, col)"
                  [class.disabled]="!isMyTurn() || !isValidMove(row, col)"
                  (click)="makeMove(row, col)"
                >
                  <!-- Helper indicator dot for valid moves -->
                  @if (isMyTurn() && isValidMove(row, col)) {
                    <div class="valid-dot"></div>
                  }

                  <!-- Pieces -->
                  @if (board()[row][col] === 1) {
                    <div class="disc disc-black"></div>
                  } @else if (board()[row][col] === 2) {
                    <div class="disc disc-white"></div>
                  }
                </div>
              }
            }
          </div>
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
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 0;
      width: 100%;
      padding: 10px;
      gap: 16px;
    }

    .othello-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      max-width: 100%;
    }

    /* Score banner styles */
    .score-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      padding: 12px 24px;
      border-radius: var(--md-radius-xl);
      width: 100%;
      box-sizing: border-box;
    }

    .score-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 4px 8px;
      border-radius: var(--md-radius-md);
      transition: background-color 0.2s;
    }

    .score-item.active {
      background: rgba(255, 255, 255, 0.08);
    }

    .score-dot {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }

    .score-dot.black {
      background: #111;
      border: 1px solid #444;
    }

    .score-dot.white {
      background: #fff;
      border: 1px solid #ccc;
    }

    .score-name {
      font-size: 14px;
      font-weight: 500;
      color: var(--md-on-surface);
      max-width: 100px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .score-value {
      font-size: 18px;
      font-weight: 700;
      color: var(--md-primary);
    }

    .vs-label {
      font-size: 13px;
      font-weight: 700;
      color: var(--md-on-surface-variant);
      opacity: 0.7;
    }

    /* Board styling */
    .board-grid {
      display: grid;
      grid-template-columns: repeat(8, min(min(11vw, 82px), calc((100dvh - 170px) / 8)));
      grid-template-rows: repeat(8, min(min(11vw, 82px), calc((100dvh - 170px) / 8)));
      background: #004D40; /* Forest felt green color */
      border: 6px solid #00241A;
      border-radius: var(--md-radius-lg);
      padding: 6px;
      gap: 3px;
      box-shadow: 0 15px 35px rgba(0, 0, 0, 0.5);
    }

    .board-cell {
      background: #00796B; /* Felt green color */
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      transition: background-color 0.2s;
    }

    .board-cell:hover:not(.disabled) {
      background: #00897B;
    }

    .board-cell.valid {
      /* Subtle indicator on hover */
    }

    /* Helper helper play guide dot */
    .valid-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #69F0AE;
      box-shadow: 0 0 6px #69F0AE;
      animation: pulseDot 1.2s infinite alternate;
      z-index: 1;
    }

    @keyframes pulseDot {
      0% { transform: scale(0.85); opacity: 0.5; }
      100% { transform: scale(1.15); opacity: 0.95; }
    }

    /* Discs styling */
    .disc {
      width: 86%;
      height: 86%;
      border-radius: 50%;
      box-shadow: 0 3px 6px rgba(0,0,0,0.4);
      z-index: 2;
      animation: flipIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    }

    .disc-black {
      background: radial-gradient(circle at 35% 35%, #424242 0%, #1a1a1a 65%, #000000 100%);
      border: 1.5px solid #222;
    }

    .disc-white {
      background: radial-gradient(circle at 35% 35%, #ffffff 0%, #f6f6f6 55%, #e1e1e1 80%, #cfd8dc 100%);
      border: 1.5px solid #b0bec5;
    }

    @keyframes flipIn {
      0% { transform: scale(0.5) rotateY(90deg); opacity: 0.5; }
      100% { transform: scale(1) rotateY(0deg); opacity: 1; }
    }

    .board-cell.disabled {
      cursor: not-allowed;
    }

    @media (max-width: 480px) {
      .board-grid {
        grid-template-columns: repeat(8, min(46px, 11vw, calc((100dvh - 200px) / 8)));
        grid-template-rows: repeat(8, min(46px, 11vw, calc((100dvh - 200px) / 8)));
      }
      .score-banner {
        padding: 6px 12px;
        gap: 12px;
        border-radius: var(--md-radius-lg);
      }
      .score-name {
        font-size: 12px;
        max-width: 70px;
      }
      .score-value {
        font-size: 16px;
      }
      .vs-label {
        font-size: 11px;
      }
      .score-dot {
        width: 12px;
        height: 12px;
      }
    }
  `]
})
export class OthelloComponent {
  private gameService = inject(GameService);
  private session = injectGameSession('othello');

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

  board = computed(() => this.room()?.gameState?.board || Array(8).fill(null).map(() => Array(8).fill(0)));

  scoreP1 = computed<number>(() => this.room()?.gameState?.scores?.p1 ?? 2);
  scoreP2 = computed<number>(() => this.room()?.gameState?.scores?.p2 ?? 2);

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
    return "C'est votre tour ! Jouez sur une case en surbrillance.";
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

  validMoves = computed<[number, number][]>(() => this.room()?.gameState?.validMoves || []);

  isValidMove(row: number, col: number): boolean {
    return this.validMoves().some(([vr, vc]) => vr === row && vc === col);
  }

  makeMove(row: number, col: number) {
    if (this.isMyTurn() && this.isValidMove(row, col)) {
      this.gameService.makeOthelloMove(row, col);
    }
  }
}
