import { Component, computed, inject } from '@angular/core';
import { GameService } from '../../services/game.service';
import { GameLayoutComponent } from '../game-layout/game-layout.component';
import { FloatingEmojisComponent } from '../floating-emojis/floating-emojis.component';
import { injectGameSession } from '../../services/game-session.helper';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

@Component({
  selector: 'app-pendu',
  standalone: true,
  imports: [GameLayoutComponent, FloatingEmojisComponent],
  template: `
    <app-game-layout
      gameTitle="Le Pendu"
      [rules]="rules"
      [room]="room()"
      [isPlaying]="isPlaying()"
      [isMyTurn]="isMyTurn()"
      turnAlertText="C'est votre tour ! Proposez une lettre."
      opponentTurnText="L'adversaire choisit une lettre..."
      [winnerLabel]="winnerLabel()"
      [isWinner]="isWinner()"
      [isLoser]="isLoser()"
      [hasVotedRematch]="hasVotedRematch()"
      [disconnectedPlayerName]="disconnectedPlayerName()"
      [player1Name]="player1Name()"
      [player2Name]="player2Name()"
      [player1Active]="currentPlayerNum() === 1 && isPlaying()"
      [player2Active]="currentPlayerNum() === 2 && isPlaying()"
      [player1IndicatorSymbol]="scoreP1Label()"
      [player2IndicatorSymbol]="scoreP2Label()"
      (leaveRoom)="leaveRoom()"
      (requestRematch)="requestRematch()"
      (sendEmoji)="sendEmoji($event)"
      (forceEnd)="forceEnd()"
      (shareInvitation)="shareInvitationLink()"
    >
      <div game-board class="pendu-board">
        <app-floating-emojis [emojis]="floatingEmojis()"></app-floating-emojis>

        <div class="pendu-content">
          <!-- Top area: gallows + word -->
          <div class="top-area">
            <!-- SVG Gallows + Hangman -->
            <div class="gallows-wrap">
              <svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg" class="gallows-svg">
                <!-- Scaffold (always visible) -->
                <line x1="10" y1="145" x2="70" y2="145" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
                <line x1="30" y1="145" x2="30" y2="10"  stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
                <line x1="30" y1="10"  x2="85" y2="10"  stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
                <line x1="85" y1="10"  x2="85" y2="28"  stroke="currentColor" stroke-width="3" stroke-linecap="round"/>

                <!-- Head (1) -->
                @if (errors() >= 1) {
                  <circle cx="85" cy="38" r="10" stroke="#EFB8C8" stroke-width="2.5" fill="none" class="body-part"/>
                }
                <!-- Body (2) -->
                @if (errors() >= 2) {
                  <line x1="85" y1="48" x2="85" y2="90" stroke="#EFB8C8" stroke-width="2.5" stroke-linecap="round" class="body-part"/>
                }
                <!-- Left arm (3) -->
                @if (errors() >= 3) {
                  <line x1="85" y1="60" x2="65" y2="76" stroke="#EFB8C8" stroke-width="2.5" stroke-linecap="round" class="body-part"/>
                }
                <!-- Right arm (4) -->
                @if (errors() >= 4) {
                  <line x1="85" y1="60" x2="105" y2="76" stroke="#EFB8C8" stroke-width="2.5" stroke-linecap="round" class="body-part"/>
                }
                <!-- Left leg (5) -->
                @if (errors() >= 5) {
                  <line x1="85" y1="90" x2="65" y2="115" stroke="#EFB8C8" stroke-width="2.5" stroke-linecap="round" class="body-part"/>
                }
                <!-- Right leg (6) -->
                @if (errors() >= 6) {
                  <line x1="85" y1="90" x2="105" y2="115" stroke="#EFB8C8" stroke-width="2.5" stroke-linecap="round" class="body-part"/>
                }
                <!-- X eyes (7 — game over) -->
                @if (errors() >= 7) {
                  <line x1="80" y1="33" x2="84" y2="37" stroke="#F2B8B5" stroke-width="2" stroke-linecap="round"/>
                  <line x1="84" y1="33" x2="80" y2="37" stroke="#F2B8B5" stroke-width="2" stroke-linecap="round"/>
                  <line x1="87" y1="33" x2="91" y2="37" stroke="#F2B8B5" stroke-width="2" stroke-linecap="round"/>
                  <line x1="91" y1="33" x2="87" y2="37" stroke="#F2B8B5" stroke-width="2" stroke-linecap="round"/>
                }
              </svg>

              <div class="error-badge" [class.danger]="errors() >= 5">
                {{ errors() }}<span class="error-max">/{{ maxErrors() }}</span>
              </div>
            </div>

            <!-- Word + meta -->
            <div class="word-side">
              <!-- Word slots -->
              <div class="word-display">
                @for (letter of wordLetters(); track $index) {
                  <div class="letter-slot" [class.revealed]="isRevealed(letter)" [class.space]="letter === ' '">
                    <span class="letter-char">{{ isRevealed(letter) ? letter : ' ' }}</span>
                    @if (letter !== ' ') {
                      <div class="letter-line"></div>
                    }
                  </div>
                }
              </div>

              <!-- Wrong letters -->
              @if (wrongLetters().length > 0) {
                <div class="wrong-letters">
                  <span class="wrong-title">Erreurs : </span>
                  @for (l of wrongLetters(); track l) {
                    <span class="wrong-chip">{{ l }}</span>
                  }
                </div>
              }

              <!-- Scores -->
              @if (isPlaying()) {
                <div class="scores-row">
                  <span class="score-pill" [class.active]="currentPlayerNum() === 1">
                    {{ player1Name() }} : <strong>{{ scoreP1() }}</strong>
                  </span>
                  <span class="score-sep">·</span>
                  <span class="score-pill" [class.active]="currentPlayerNum() === 2">
                    {{ player2Name() }} : <strong>{{ scoreP2() }}</strong>
                  </span>
                </div>
              }
            </div>
          </div>

          <!-- Virtual Keyboard -->
          @if (room()?.status === 'playing') {
            <div class="keyboard" [class.disabled]="!isMyTurn()">
              @for (letter of alphabet; track letter) {
                <button
                  class="key-btn"
                  [class.used-correct]="isCorrect(letter)"
                  [class.used-wrong]="isWrong(letter)"
                  [disabled]="isUsed(letter) || !isMyTurn()"
                  (click)="guess(letter)"
                >{{ letter }}</button>
              }
            </div>
          }
        </div>
      </div>
    </app-game-layout>
  `,
  styles: [`
    .pendu-board {
      position: relative;
      width: 100%;
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 0;
      padding: 8px;
      box-sizing: border-box;
      overflow: hidden;
    }

    .pendu-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      width: 100%;
      max-width: 680px;
      height: 100%;
      justify-content: center;
    }

    /* ---- Top row: gallows + word ---- */
    .top-area {
      display: flex;
      align-items: center;
      gap: 24px;
      width: 100%;
      flex-shrink: 0;
    }

    .gallows-wrap {
      position: relative;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }

    .gallows-svg {
      width: 120px;
      height: 150px;
      color: var(--md-on-surface-variant);
      filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.05));
    }

    .body-part {
      animation: drawIn 0.3s ease-out forwards;
    }

    @keyframes drawIn {
      from { opacity: 0; transform-origin: center; transform: scale(0.7); }
      to   { opacity: 1; transform: scale(1); }
    }

    .error-badge {
      font-size: 20px;
      font-weight: 700;
      color: var(--md-on-surface-variant);
      background: var(--md-surface-container-high);
      border-radius: var(--md-radius-full);
      padding: 2px 12px;
      transition: color 0.3s, background 0.3s;
    }

    .error-badge.danger {
      color: #F2B8B5;
      background: rgba(242, 184, 181, 0.15);
    }

    .error-max {
      font-size: 13px;
      font-weight: 400;
      color: var(--md-on-surface-variant);
      margin-left: 1px;
    }

    /* ---- Word side ---- */
    .word-side {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 14px;
      align-items: flex-start;
    }

    .word-display {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: flex-end;
    }

    .letter-slot {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 28px;
      gap: 3px;
    }

    .letter-slot.space {
      width: 16px;
    }

    .letter-char {
      font-size: 22px;
      font-weight: 700;
      color: var(--md-on-surface);
      line-height: 1;
      min-height: 28px;
      display: flex;
      align-items: flex-end;
      transition: color 0.2s;
    }

    .letter-slot.revealed .letter-char {
      color: var(--md-primary);
      animation: popIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }

    @keyframes popIn {
      from { transform: scale(0.5); opacity: 0; }
      to   { transform: scale(1);   opacity: 1; }
    }

    .letter-line {
      width: 100%;
      height: 2px;
      background: var(--md-outline);
      border-radius: 2px;
    }

    .wrong-letters {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 5px;
    }

    .wrong-title {
      font-size: 12px;
      color: var(--md-on-surface-variant);
      font-weight: 500;
    }

    .wrong-chip {
      font-size: 13px;
      font-weight: 700;
      color: #F2B8B5;
      background: rgba(242, 184, 181, 0.12);
      border: 1px solid rgba(242, 184, 181, 0.25);
      border-radius: var(--md-radius-sm);
      padding: 1px 7px;
    }

    .scores-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .score-pill {
      font-size: 13px;
      color: var(--md-on-surface-variant);
      padding: 3px 10px;
      border-radius: var(--md-radius-full);
      background: var(--md-surface-container-high);
      border: 1px solid transparent;
      transition: all 0.2s;
    }

    .score-pill.active {
      color: var(--md-primary);
      border-color: var(--md-outline-variant);
      background: var(--md-surface-container-highest);
    }

    .score-sep {
      color: var(--md-outline);
      font-size: 13px;
    }

    /* ---- Virtual Keyboard ---- */
    .keyboard {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      justify-content: center;
      width: 100%;
      max-width: 520px;
      flex-shrink: 0;
    }

    .keyboard.disabled {
      opacity: 0.5;
      pointer-events: none;
    }

    .key-btn {
      width: 36px;
      height: 36px;
      border-radius: var(--md-radius-sm);
      border: 1px solid var(--md-outline-variant);
      background: var(--md-surface-container-high);
      color: var(--md-on-surface);
      font-size: 13px;
      font-weight: 600;
      font-family: 'Inter', sans-serif;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
      flex-shrink: 0;
    }

    .key-btn:not(:disabled):hover {
      background: var(--md-primary-container);
      color: var(--md-on-primary-container);
      border-color: var(--md-primary);
      transform: translateY(-2px) scale(1.06);
    }

    .key-btn:not(:disabled):active {
      transform: translateY(0) scale(0.95);
    }

    .key-btn.used-correct {
      background: rgba(105, 240, 174, 0.15);
      color: #69F0AE;
      border-color: rgba(105, 240, 174, 0.3);
      cursor: default;
    }

    .key-btn.used-wrong {
      background: rgba(242, 184, 181, 0.1);
      color: rgba(242, 184, 181, 0.4);
      border-color: rgba(242, 184, 181, 0.15);
      cursor: default;
    }

    .key-btn:disabled:not(.used-correct):not(.used-wrong) {
      opacity: 0.4;
    }

    /* Responsive */
    @media (max-width: 480px) {
      .top-area {
        gap: 12px;
      }

      .gallows-svg {
        width: 90px;
        height: 112px;
      }

      .letter-slot {
        width: 22px;
      }

      .letter-char {
        font-size: 17px;
        min-height: 22px;
      }

      .key-btn {
        width: 30px;
        height: 30px;
        font-size: 12px;
        border-radius: 6px;
      }

      .keyboard {
        gap: 4px;
      }
    }
  `]
})
export class PenduComponent {
  private gameService = inject(GameService);
  private session = injectGameSession('pendu');

  readonly rules = [
    'Le serveur choisit un mot secret au hasard dans le dictionnaire.',
    'À chaque tour, le joueur actif propose une lettre via le clavier virtuel.',
    'Chaque lettre correcte rapporte 10 points par occurrence dans le mot.',
    'Chaque erreur retire 5 points et dessine une partie du pendu.',
    'Après 7 erreurs, le pendu est complet et la partie s\'arrête.',
    'Deviner le mot entier : le joueur avec le plus de points gagne !'
  ];

  readonly alphabet = ALPHABET;

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

  private gs = computed(() => this.room()?.gameState as any);

  errors = computed<number>(() => this.gs()?.errors ?? 0);
  maxErrors = computed<number>(() => this.gs()?.maxErrors ?? 7);
  guessedLetters = computed<string[]>(() => this.gs()?.guessedLetters ?? []);
  currentPlayerNum = computed<number>(() => this.gs()?.currentPlayer ?? 1);
  scoreP1 = computed<number>(() => this.gs()?.scoreP1 ?? 0);
  scoreP2 = computed<number>(() => this.gs()?.scoreP2 ?? 0);
  scoreP1Label = computed(() => `${this.scoreP1()}pts`);
  scoreP2Label = computed(() => `${this.scoreP2()}pts`);

  wordLetters = computed<string[]>(() => {
    const word: string = this.gs()?.word ?? '';
    return word.split('');
  });

  wrongLetters = computed<string[]>(() =>
    this.guessedLetters().filter(l => !this.wordLetters().includes(l))
  );

  myPlayerNum = computed<number | null>(() => {
    const r = this.room();
    if (!r) return null;
    const socketId = this.gameService.getSocketId();
    const idx = r.players.findIndex((p: any) => p.id === socketId);
    return idx !== -1 ? idx + 1 : null;
  });

  isMyTurn = computed(() => {
    const r = this.room();
    if (r?.isLocal) return this.isPlaying();
    return this.isPlaying() && this.myPlayerNum() === this.currentPlayerNum();
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

  isRevealed(letter: string): boolean {
    return this.guessedLetters().includes(letter);
  }

  isUsed(letter: string): boolean {
    return this.guessedLetters().includes(letter);
  }

  isCorrect(letter: string): boolean {
    return this.guessedLetters().includes(letter) && this.wordLetters().includes(letter);
  }

  isWrong(letter: string): boolean {
    return this.guessedLetters().includes(letter) && !this.wordLetters().includes(letter);
  }

  guess(letter: string) {
    if (this.isMyTurn() && !this.isUsed(letter)) {
      this.gameService.sendPenduGuess(letter);
    }
  }
}
