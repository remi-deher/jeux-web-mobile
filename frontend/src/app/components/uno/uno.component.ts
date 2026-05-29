import { Component, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameService } from '../../services/game.service';
import { GameLayoutComponent } from '../game-layout/game-layout.component';
import { injectGameSession } from '../../services/game-session.helper';

type UnoColor = 'red' | 'blue' | 'green' | 'yellow' | 'wild';
type UnoValue = string;

interface UnoCard {
  id: number;
  color: UnoColor;
  value: UnoValue;
}

interface UnoState {
  deckSize: number;
  discardTop: UnoCard | null;
  hands: [UnoCard[], UnoCard[]];
  currentPlayer: 1 | 2;
  currentColor: UnoColor;
  drawPending: number;
  winner: number | null;
  playerIds: [string, string];
  lastAction: string | null;
}

const COLOR_MAP: Record<UnoColor, string> = {
  red: '#e53935',
  blue: '#1e88e5',
  green: '#43a047',
  yellow: '#fdd835',
  wild: '#424242',
};

const VALUE_LABELS: Record<string, string> = {
  skip: '⊘',
  reverse: '⇄',
  draw2: '+2',
  wild: '🌈',
  wild4: '+4',
};

@Component({
  selector: 'app-uno',
  standalone: true,
  imports: [CommonModule, GameLayoutComponent],
  template: `
<app-game-layout
  gameTitle="8 Américain"
  [rules]="[
    'Soyez le premier à vider votre main.',
    'Jouez une carte de même couleur ou même valeur que la défausse.',
    'Wild : choisissez la couleur suivante.',
    'Wild +4 : adversaire pioche 4 et vous choisissez la couleur.',
    '+2 : adversaire pioche 2 et passe son tour.',
    'Skip/Reverse : rejouez immédiatement (en 2 joueurs).',
    'Si vous ne pouvez pas jouer, piochez une carte.'
  ]"
  [room]="room()"
  [isPlaying]="isPlaying()"
  [isMyTurn]="isMyTurn()"
  [turnAlertText]="turnText()"
  [opponentTurnText]="opponentText()"
  [winnerLabel]="winnerLabel()"
  [isWinner]="isWinner()"
  [isLoser]="isLoser()"
  [hasVotedRematch]="hasVotedRematch()"
  [disconnectedPlayerName]="disconnectedPlayerName()"
  [player1Name]="player1Name()"
  [player2Name]="player2Name()"
  [player1Active]="gameState()?.currentPlayer === 1 && isPlaying()"
  [player2Active]="gameState()?.currentPlayer === 2 && isPlaying()"
  (leaveRoom)="leaveRoom()"
  (requestRematch)="requestRematch()"
  (sendEmoji)="sendEmoji($event)"
  (forceEnd)="forceEnd()"
  (shareInvitation)="shareInvitationLink()"
>
  <div game-board class="uno-table">

    <!-- Opponent hand (face-down) -->
    <div class="opponent-area">
      <div class="opp-label">{{ opponentName() }} — {{ opponentHandSize() }} cartes</div>
      <div class="opp-hand">
        @for (i of opponentCards(); track i) {
          <div class="card card-back-small"></div>
        }
      </div>
      <div class="draw-pending-badge" *ngIf="gameState()?.drawPending && gameState()!.currentPlayer !== myPlayerNum()">
        +{{ gameState()!.drawPending }} en attente
      </div>
    </div>

    <!-- Center: discard + draw pile -->
    <div class="center-area">
      <!-- Current color indicator -->
      <div class="color-dot" [style.background]="currentColorHex()"></div>

      <!-- Discard pile -->
      <div class="discard-pile" *ngIf="gameState()?.discardTop as top">
        <div class="card card-lg" [style.background]="cardColor(top)" [style.color]="textColor(top)">
          <span class="card-value">{{ cardLabel(top) }}</span>
        </div>
      </div>

      <!-- Draw pile -->
      <div class="draw-pile-wrapper">
        <div class="card card-lg card-back-lg" (click)="drawCard()">
          <span class="deck-count">{{ gameState()?.deckSize ?? 0 }}</span>
        </div>
        <div class="draw-pending-badge center-badge" *ngIf="mustDraw()">
          Piochez {{ gameState()!.drawPending }} !
        </div>
      </div>
    </div>

    <!-- My hand -->
    <div class="my-hand" *ngIf="myHand() as hand">
      <div class="hand-cards">
        @for (card of hand; track card.id) {
          <div
            class="card card-hand"
            [class.playable]="isPlayable(card)"
            [class.selected]="selectedCardId() === card.id"
            [style.background]="cardColor(card)"
            [style.color]="textColor(card)"
            (click)="selectCard(card)"
          >
            <span class="card-value">{{ cardLabel(card) }}</span>
          </div>
        }
      </div>
    </div>

    <!-- Color picker overlay (wild) -->
    <div class="color-picker-overlay" *ngIf="showColorPicker()">
      <div class="color-picker-panel">
        <p>Choisissez une couleur</p>
        <div class="color-options">
          <button class="color-btn" style="background:#e53935" (click)="pickColor('red')"></button>
          <button class="color-btn" style="background:#1e88e5" (click)="pickColor('blue')"></button>
          <button class="color-btn" style="background:#43a047" (click)="pickColor('green')"></button>
          <button class="color-btn" style="background:#fdd835" (click)="pickColor('yellow')"></button>
        </div>
      </div>
    </div>
  </div>
</app-game-layout>
  `,
  styles: [`
    .uno-table {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 12px;
      position: relative;
      min-height: 420px;
    }

    /* Opponent */
    .opponent-area {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }
    .opp-label { font-size: 13px; color: rgba(255,255,255,0.6); }
    .opp-hand { display: flex; gap: 4px; flex-wrap: wrap; justify-content: center; }
    .card-back-small {
      width: 28px; height: 42px; border-radius: 5px;
      background: linear-gradient(135deg, #1a237e, #3949ab);
      border: 2px solid rgba(255,255,255,0.3);
    }
    .draw-pending-badge {
      font-size: 12px;
      background: #f44336;
      color: #fff;
      border-radius: 10px;
      padding: 2px 8px;
    }

    /* Center */
    .center-area {
      display: flex;
      align-items: center;
      gap: 20px;
    }
    .color-dot {
      width: 24px; height: 24px;
      border-radius: 50%;
      border: 3px solid rgba(255,255,255,0.5);
      box-shadow: 0 0 8px rgba(255,255,255,0.3);
    }

    .card {
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      user-select: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    }
    .card-lg { width: 70px; height: 105px; font-size: 28px; }
    .card-back-lg {
      background: linear-gradient(135deg, #1a237e, #3949ab);
      border: 3px solid rgba(255,255,255,0.3);
      cursor: pointer;
      flex-direction: column;
      gap: 4px;
    }
    .card-back-lg:hover { transform: scale(1.04); }
    .deck-count { font-size: 16px; color: rgba(255,255,255,0.7); }

    .draw-pile-wrapper { position: relative; }
    .center-badge {
      position: absolute; top: -24px; left: 50%; transform: translateX(-50%);
      white-space: nowrap;
    }

    /* My hand */
    .my-hand { width: 100%; max-width: 600px; }
    .hand-cards {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .card-hand {
      width: 56px; height: 84px; font-size: 20px;
      cursor: not-allowed;
      transition: transform 0.15s, box-shadow 0.15s;
      border: 2px solid transparent;
    }
    .card-hand.playable { cursor: pointer; }
    .card-hand.playable:hover { transform: translateY(-8px); box-shadow: 0 8px 20px rgba(0,0,0,0.5); }
    .card-hand.selected { transform: translateY(-14px); border-color: #fff; box-shadow: 0 0 12px rgba(255,255,255,0.6); }

    .card-value { pointer-events: none; }

    /* Color picker */
    .color-picker-overlay {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.6);
      border-radius: 12px;
      z-index: 100;
    }
    .color-picker-panel {
      background: #1e1e2e;
      border-radius: 16px;
      padding: 24px;
      display: flex; flex-direction: column; align-items: center; gap: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    }
    .color-picker-panel p { margin: 0; color: #fff; font-size: 16px; }
    .color-options { display: flex; gap: 14px; }
    .color-btn {
      width: 52px; height: 52px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.4);
      cursor: pointer; transition: transform 0.15s;
    }
    .color-btn:hover { transform: scale(1.15); }
  `]
})
export class UnoComponent {
  private gameService = inject(GameService);
  private session = injectGameSession('uno');

  room = this.session.room;
  isPlaying = this.session.isPlaying;
  hasVotedRematch = this.session.hasVotedRematch;
  disconnectedPlayerName = this.session.disconnectedPlayerName;
  player1Name = this.session.player1Name;
  player2Name = this.session.player2Name;
  leaveRoom = this.session.leaveRoom;
  requestRematch = this.session.requestRematch;
  forceEnd = this.session.forceEnd;
  shareInvitationLink = this.session.shareInvitationLink;
  sendEmoji = this.session.sendEmoji;

  selectedCardId = signal<number | null>(null);
  showColorPicker = signal(false);
  pendingCardId = signal<number | null>(null);

  gameState = computed(() => this.room()?.gameState as UnoState | null);

  myPlayerNum = computed((): 1 | 2 => {
    const room = this.room();
    if (!room || room.isLocal) {
      return this.gameState()?.currentPlayer ?? 1;
    }
    const sid = this.gameService.getSocketId();
    const idx = room.players.findIndex(p => p.id === sid);
    return idx === 0 ? 1 : 2;
  });

  isMyTurn = computed(() => {
    const room = this.room();
    if (room?.isLocal) return true;
    return this.gameState()?.currentPlayer === this.myPlayerNum();
  });

  myHandIndex = computed(() => this.myPlayerNum() - 1 as 0 | 1);
  myHand = computed(() => this.gameState()?.hands[this.myHandIndex()] ?? []);
  opponentHandSize = computed(() => this.gameState()?.hands[1 - this.myHandIndex()]?.length ?? 0);
  opponentCards = computed(() => Array(this.opponentHandSize()));
  opponentName = computed(() => this.myPlayerNum() === 1 ? this.player2Name() : this.player1Name());
  currentColorHex = computed(() => COLOR_MAP[this.gameState()?.currentColor ?? 'wild']);

  mustDraw = computed(() => {
    const gs = this.gameState();
    if (!gs) return false;
    return gs.drawPending > 0 && gs.currentPlayer === this.myPlayerNum();
  });

  isPlayable(card: UnoCard): boolean {
    if (!this.isMyTurn()) return false;
    if (this.mustDraw()) return false;
    const gs = this.gameState();
    if (!gs) return false;
    if (card.value === 'wild' || card.value === 'wild4') return true;
    if (!gs.discardTop) return true;
    if (card.color === gs.currentColor) return true;
    if (card.value === gs.discardTop.value) return true;
    return false;
  }

  selectCard(card: UnoCard) {
    if (!this.isPlayable(card)) return;
    if (card.value === 'wild' || card.value === 'wild4') {
      this.pendingCardId.set(card.id);
      this.showColorPicker.set(true);
      this.selectedCardId.set(card.id);
    } else {
      if (this.selectedCardId() === card.id) {
        this.playCard(card.id, undefined);
        this.selectedCardId.set(null);
      } else {
        this.selectedCardId.set(card.id);
      }
    }
  }

  playCard(cardId: number, color: UnoColor | undefined) {
    this.gameService.sendUnoPlay(cardId, color);
    this.selectedCardId.set(null);
  }

  pickColor(color: UnoColor) {
    const cid = this.pendingCardId();
    if (cid !== null) {
      this.playCard(cid, color);
      this.pendingCardId.set(null);
    }
    this.showColorPicker.set(false);
  }

  drawCard() {
    if (!this.isMyTurn()) return;
    this.selectedCardId.set(null);
    this.gameService.sendUnoDraw();
  }

  cardColor(card: UnoCard): string {
    return COLOR_MAP[card.color] ?? '#424242';
  }

  textColor(card: UnoCard): string {
    return card.color === 'yellow' ? '#333' : '#fff';
  }

  cardLabel(card: UnoCard): string {
    return VALUE_LABELS[card.value] ?? card.value;
  }

  turnText = computed(() => {
    const room = this.room();
    const gs = this.gameState();
    if (!gs) return '';
    if (room?.isLocal) {
      const name = gs.currentPlayer === 1 ? this.player1Name() : this.player2Name();
      return `Tour de ${name}`;
    }
    if (this.mustDraw()) return `Piochez ${gs.drawPending} carte(s) !`;
    return 'À vous de jouer !';
  });

  opponentText = computed(() => {
    const room = this.room();
    if (room?.isLocal) return '';
    return `${this.opponentName()} réfléchit…`;
  });

  winnerLabel = computed(() => {
    const gs = this.gameState();
    if (!gs || gs.winner === null) return '';
    const name = gs.winner === 1 ? this.player1Name() : this.player2Name();
    return `${name} a vidé sa main !`;
  });

  isWinner = computed(() => {
    const gs = this.gameState();
    if (!gs || gs.winner === null) return false;
    const room = this.room();
    if (room?.isLocal) return false;
    return gs.winner === this.myPlayerNum();
  });

  isLoser = computed(() => {
    const gs = this.gameState();
    if (!gs || gs.winner === null) return false;
    const room = this.room();
    if (room?.isLocal) return false;
    return gs.winner !== this.myPlayerNum();
  });
}
