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
  red:    '#e53935',
  blue:   '#1e88e5',
  green:  '#43a047',
  yellow: '#fdd835',
  wild:   '#7c4dff',
};

const COLOR_NAMES: Record<UnoColor, string> = {
  red:    'Rouge',
  blue:   'Bleu',
  green:  'Vert',
  yellow: 'Jaune',
  wild:   'Joker',
};

const VALUE_LABELS: Record<string, string> = {
  skip:    'SKIP',
  reverse: '↺',
  draw2:   '+2',
  wild:    'JOKER',
  wild4:   'JOKER +4',
};

const VALUE_SHORT: Record<string, string> = {
  skip:    'SKIP',
  reverse: '↺',
  draw2:   '+2',
  wild:    '★',
  wild4:   '+4★',
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
    'Si vous ne pouvez pas jouer, cliquez sur PIOCHER.'
  ]"
  [room]="room()"
  [isPlaying]="isPlaying()"
  [isMyTurn]="isMyTurn()"
  [turnAlertText]="''"
  [opponentTurnText]="''"
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
  <div game-board class="uno-table" *ngIf="gameState() as gs">

    <!-- ═══ TURN BANNER ═══ -->
    <div class="turn-banner" [class.my-turn]="isMyTurn()" [class.opp-turn]="!isMyTurn()">
      <span class="turn-icon">{{ isMyTurn() ? '🟢' : '⏳' }}</span>
      <span class="turn-text">
        @if (mustDraw()) {
          Vous devez piocher {{ gs.drawPending }} carte{{ gs.drawPending > 1 ? 's' : '' }} !
        } @else if (isMyTurn()) {
          C'est votre tour — jouez une carte ou piochez
        } @else {
          Tour de <b>{{ opponentName() }}</b>…
        }
      </span>
    </div>

    <!-- ═══ LAST ACTION ═══ -->
    <div class="last-action" *ngIf="lastActionText()">
      {{ lastActionText() }}
    </div>

    <!-- ═══ OPPONENT ═══ -->
    <div class="opponent-area">
      <div class="opp-header">
        <span class="opp-avatar">👤</span>
        <span class="opp-name">{{ opponentName() }}</span>
        <span class="opp-count-badge">{{ opponentHandSize() }} carte{{ opponentHandSize() > 1 ? 's' : '' }}</span>
        @if (opponentHandSize() === 1) {
          <span class="uno-alert">UNO !</span>
        }
      </div>
      <div class="opp-hand">
        @for (i of opponentCards(); track $index) {
          <div class="card-back-sm"></div>
        }
      </div>
    </div>

    <!-- ═══ CENTER ZONE ═══ -->
    <div class="center-zone">

      <!-- Active color -->
      <div class="color-panel" [style.border-color]="currentColorHex()">
        <div class="color-swatch" [style.background]="currentColorHex()"></div>
        <div class="color-info">
          <span class="color-label-sm">Couleur active</span>
          <span class="color-name">{{ currentColorName() }}</span>
        </div>
      </div>

      <!-- Discard pile -->
      <div class="pile-slot">
        <span class="pile-label">Défausse</span>
        <div class="card card-lg"
             *ngIf="gs.discardTop"
             [style.background]="cardBg(gs.discardTop)"
             [style.color]="cardText(gs.discardTop)"
             [style.border-color]="currentColorHex()">
          <span class="card-corner top-left">{{ cardShort(gs.discardTop) }}</span>
          <span class="card-center">{{ cardShort(gs.discardTop) }}</span>
          <span class="card-corner bottom-right">{{ cardShort(gs.discardTop) }}</span>
        </div>
      </div>

      <!-- Draw pile -->
      <div class="pile-slot">
        <span class="pile-label">Pioche ({{ gs.deckSize }})</span>
        <button class="draw-pile-btn"
                [class.must-draw]="mustDraw()"
                [disabled]="!isMyTurn()"
                (click)="drawCard()">
          <div class="card card-lg card-back-lg">
            <span class="draw-icon">🂠</span>
          </div>
          <span class="draw-cta" *ngIf="isMyTurn()">
            @if (mustDraw()) { Piocher {{ gs.drawPending }} ! }
            @else { Piocher }
          </span>
        </button>
      </div>
    </div>

    <!-- ═══ MY HAND ═══ -->
    <div class="my-area">
      <div class="my-header">
        <span class="my-label">Vos cartes ({{ myHand().length }})</span>
        @if (myHand().length === 1) {
          <span class="uno-alert">UNO !</span>
        }
        @if (playableCount() === 0 && isMyTurn() && !mustDraw()) {
          <span class="no-play-hint">Aucune carte jouable → Piochez</span>
        } @else if (isMyTurn() && !mustDraw()) {
          <span class="playable-hint">{{ playableCount() }} carte{{ playableCount() > 1 ? 's' : '' }} jouable{{ playableCount() > 1 ? 's' : '' }}</span>
        }
      </div>

      <div class="hand-cards">
        @for (card of myHand(); track card.id) {
          <div
            class="card card-hand"
            [class.playable]="isPlayable(card)"
            [class.not-playable]="!isPlayable(card)"
            [style.background]="cardBg(card)"
            [style.color]="cardText(card)"
            (click)="playCardDirect(card)"
            [title]="isPlayable(card) ? 'Cliquez pour jouer' : 'Non jouable'"
          >
            <span class="card-corner top-left">{{ cardShort(card) }}</span>
            <span class="card-center">{{ cardShort(card) }}</span>
            <span class="card-corner bottom-right">{{ cardShort(card) }}</span>
          </div>
        }
      </div>
    </div>

    <!-- ═══ COLOR PICKER ═══ -->
    @if (showColorPicker()) {
      <div class="color-picker-overlay" (click)="cancelColorPick()">
        <div class="color-picker-panel" (click)="$event.stopPropagation()">
          <p class="picker-title">Choisissez la couleur suivante</p>
          <div class="color-options">
            <button class="color-btn" style="background:#e53935" (click)="pickColor('red')">
              <span>Rouge</span>
            </button>
            <button class="color-btn" style="background:#1e88e5" (click)="pickColor('blue')">
              <span>Bleu</span>
            </button>
            <button class="color-btn" style="background:#43a047" (click)="pickColor('green')">
              <span>Vert</span>
            </button>
            <button class="color-btn" style="background:#fdd835; color:#333" (click)="pickColor('yellow')">
              <span>Jaune</span>
            </button>
          </div>
        </div>
      </div>
    }

  </div>
</app-game-layout>
  `,
  styles: [`
    .uno-table {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 12px 8px;
      position: relative;
      width: 100%;
    }

    /* ── Turn banner ── */
    .turn-banner {
      width: 100%;
      max-width: 520px;
      padding: 10px 18px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 15px;
      font-weight: 600;
      transition: background 0.3s;
    }
    .turn-banner.my-turn  { background: rgba(76,175,80,0.2); border: 1px solid rgba(76,175,80,0.4); color: #81c784; }
    .turn-banner.opp-turn { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.5); }
    .turn-icon { font-size: 18px; }

    /* ── Last action ── */
    .last-action {
      font-size: 12px;
      color: rgba(255,255,255,0.4);
      font-style: italic;
    }

    /* ── Opponent ── */
    .opponent-area {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      width: 100%;
      max-width: 520px;
    }
    .opp-header {
      display: flex; align-items: center; gap: 8px;
    }
    .opp-avatar { font-size: 18px; }
    .opp-name { font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.8); }
    .opp-count-badge {
      font-size: 12px; background: rgba(255,255,255,0.12);
      border-radius: 20px; padding: 2px 10px; color: rgba(255,255,255,0.6);
    }
    .uno-alert {
      font-size: 13px; font-weight: 800;
      background: #f44336; color: #fff;
      border-radius: 10px; padding: 2px 10px;
      animation: pulse 0.8s infinite alternate;
    }
    @keyframes pulse { from { opacity: 1; } to { opacity: 0.6; } }

    .opp-hand { display: flex; gap: 3px; flex-wrap: wrap; justify-content: center; max-width: 400px; }
    .card-back-sm {
      width: 24px; height: 36px; border-radius: 4px;
      background: linear-gradient(135deg, #1a237e, #3949ab);
      border: 1px solid rgba(255,255,255,0.25);
    }

    /* ── Center zone ── */
    .center-zone {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      padding: 12px 16px;
      background: rgba(0,0,0,0.25);
      border-radius: 16px;
      width: 100%;
      max-width: 520px;
      justify-content: center;
    }

    /* Color panel */
    .color-panel {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border: 2px solid;
      border-radius: 12px;
      background: rgba(255,255,255,0.05);
      transition: border-color 0.3s;
    }
    .color-swatch { width: 28px; height: 28px; border-radius: 50%; transition: background 0.3s; }
    .color-info { display: flex; flex-direction: column; gap: 1px; }
    .color-label-sm { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.4); }
    .color-name { font-size: 14px; font-weight: 700; color: #fff; }

    /* Pile slots */
    .pile-slot {
      display: flex; flex-direction: column; align-items: center; gap: 6px;
    }
    .pile-label {
      font-size: 11px; text-transform: uppercase; letter-spacing: 1px;
      color: rgba(255,255,255,0.4);
    }

    /* Cards */
    .card {
      border-radius: 10px;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      font-weight: 900; user-select: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      position: relative;
      border: 2px solid rgba(255,255,255,0.2);
    }
    .card-lg { width: 64px; height: 96px; }

    .card-corner {
      position: absolute; font-size: 11px; font-weight: 800; line-height: 1;
    }
    .top-left { top: 5px; left: 6px; }
    .bottom-right { bottom: 5px; right: 6px; transform: rotate(180deg); }
    .card-center { font-size: 18px; }

    .card-back-lg {
      background: linear-gradient(135deg, #1a237e, #3949ab) !important;
      border: 2px solid rgba(255,255,255,0.3) !important;
    }
    .draw-icon { font-size: 28px; }

    /* Draw pile button */
    .draw-pile-btn {
      background: none; border: none; cursor: not-allowed;
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      padding: 0;
    }
    .draw-pile-btn:not([disabled]) { cursor: pointer; }
    .draw-pile-btn:not([disabled]):hover .card-lg { transform: scale(1.05); }
    .draw-pile-btn.must-draw .card-lg {
      box-shadow: 0 0 16px #f44336, 0 4px 12px rgba(0,0,0,0.4);
      animation: glow-red 1s infinite alternate;
    }
    @keyframes glow-red {
      from { box-shadow: 0 0 8px #f44336; }
      to   { box-shadow: 0 0 20px #f44336; }
    }
    .draw-cta {
      font-size: 13px; font-weight: 700;
      color: #81c784; background: rgba(76,175,80,0.2);
      border-radius: 20px; padding: 3px 12px;
    }
    .draw-pile-btn.must-draw .draw-cta {
      color: #ef5350; background: rgba(244,67,54,0.2);
    }

    /* ── My hand ── */
    .my-area {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      width: 100%; max-width: 560px;
    }
    .my-header {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: center;
    }
    .my-label { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.7); }
    .playable-hint { font-size: 12px; color: #81c784; }
    .no-play-hint { font-size: 12px; color: #ef5350; }

    .hand-cards {
      display: flex; gap: 6px; flex-wrap: wrap; justify-content: center;
    }

    .card-hand {
      width: 52px; height: 78px;
      transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
      cursor: default;
    }

    .card-hand.playable {
      cursor: pointer;
      border-color: rgba(255,255,255,0.5);
    }
    .card-hand.playable:hover {
      transform: translateY(-12px) scale(1.05);
      box-shadow: 0 12px 24px rgba(0,0,0,0.5), 0 0 0 2px rgba(255,255,255,0.6);
      z-index: 10;
    }

    .card-hand.not-playable {
      opacity: 0.35;
      filter: grayscale(40%);
    }

    /* ── Color picker ── */
    .color-picker-overlay {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.7);
      border-radius: 12px;
      z-index: 200;
    }
    .color-picker-panel {
      background: #1e1e2e;
      border-radius: 20px;
      padding: 28px 32px;
      display: flex; flex-direction: column; align-items: center; gap: 20px;
      box-shadow: 0 12px 48px rgba(0,0,0,0.8);
      border: 1px solid rgba(255,255,255,0.1);
    }
    .picker-title { margin: 0; color: #fff; font-size: 17px; font-weight: 600; }
    .color-options { display: flex; gap: 16px; }
    .color-btn {
      width: 64px; height: 64px; border-radius: 50%;
      border: 3px solid rgba(255,255,255,0.3);
      cursor: pointer; transition: transform 0.15s, box-shadow 0.15s;
      display: flex; align-items: flex-end; justify-content: center;
      padding-bottom: 8px;
      font-size: 11px; font-weight: 700; color: #fff;
    }
    .color-btn:hover {
      transform: scale(1.2);
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    }
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

  showColorPicker = signal(false);
  pendingCardId = signal<number | null>(null);

  gameState = computed(() => this.room()?.gameState as UnoState | null);

  myPlayerNum = computed((): 1 | 2 => {
    const room = this.room();
    if (!room || room.isLocal) return this.gameState()?.currentPlayer ?? 1;
    const sid = this.gameService.getSocketId();
    const idx = room.players.findIndex(p => p.id === sid);
    return idx === 0 ? 1 : 2;
  });

  isMyTurn = computed(() => {
    const room = this.room();
    if (room?.isLocal) return true;
    return this.gameState()?.currentPlayer === this.myPlayerNum();
  });

  myHandIndex  = computed(() => this.myPlayerNum() - 1 as 0 | 1);
  myHand       = computed(() => this.gameState()?.hands[this.myHandIndex()] ?? []);
  opponentHandSize = computed(() => this.gameState()?.hands[1 - this.myHandIndex()]?.length ?? 0);
  opponentCards    = computed(() => Array(this.opponentHandSize()));
  opponentName     = computed(() => this.myPlayerNum() === 1 ? this.player2Name() : this.player1Name());
  currentColorHex  = computed(() => COLOR_MAP[this.gameState()?.currentColor ?? 'wild']);
  currentColorName = computed(() => COLOR_NAMES[this.gameState()?.currentColor ?? 'wild']);

  mustDraw = computed(() => {
    const gs = this.gameState();
    if (!gs) return false;
    return gs.drawPending > 0 && gs.currentPlayer === this.myPlayerNum();
  });

  playableCount = computed(() => this.myHand().filter(c => this.isPlayable(c)).length);

  lastActionText = computed(() => {
    const gs = this.gameState();
    if (!gs?.lastAction) return '';
    // Format: "p1:played:red:7" or "p2:drew:2"
    const parts = gs.lastAction.split(':');
    if (parts.length < 3) return '';
    const who = parts[0] === 'p1' ? this.player1Name() : this.player2Name();
    if (parts[1] === 'drew') return `${who} a pioché ${parts[2]} carte(s)`;
    if (parts[1] === 'played') {
      const val = VALUE_LABELS[parts[3]] ?? parts[3];
      const col = COLOR_NAMES[parts[2] as UnoColor] ?? parts[2];
      return `${who} a joué ${col} ${val}`;
    }
    return '';
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

  /** Un seul clic = jouer directement. Wild → color picker d'abord. */
  playCardDirect(card: UnoCard) {
    if (!this.isPlayable(card)) return;
    if (card.value === 'wild' || card.value === 'wild4') {
      this.pendingCardId.set(card.id);
      this.showColorPicker.set(true);
    } else {
      this.gameService.sendUnoPlay(card.id, undefined);
    }
  }

  pickColor(color: UnoColor) {
    const cid = this.pendingCardId();
    if (cid !== null) {
      this.gameService.sendUnoPlay(cid, color);
      this.pendingCardId.set(null);
    }
    this.showColorPicker.set(false);
  }

  cancelColorPick() {
    this.pendingCardId.set(null);
    this.showColorPicker.set(false);
  }

  drawCard() {
    if (!this.isMyTurn()) return;
    this.gameService.sendUnoDraw();
  }

  cardBg(card: UnoCard): string { return COLOR_MAP[card.color] ?? '#424242'; }
  cardText(card: UnoCard): string { return card.color === 'yellow' ? '#333' : '#fff'; }
  cardShort(card: UnoCard): string { return VALUE_SHORT[card.value] ?? card.value; }

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
