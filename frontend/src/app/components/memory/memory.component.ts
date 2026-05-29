import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameService } from '../../services/game.service';
import { GameLayoutComponent } from '../game-layout/game-layout.component';
import { injectGameSession } from '../../services/game-session.helper';

interface MemoryCard {
  id: number;
  pairId: number;
  faceUp: boolean;
  matched: boolean;
}

interface MemoryState {
  cards: MemoryCard[];
  cols: number;
  rows: number;
  currentPlayer: 1 | 2;
  scores: [number, number];
  flippedIds: number[];
  isResolving: boolean;
  totalPairs: number;
  matchedPairs: number;
  winner: number | null;
  playerIds: [string, string];
}

// Simple emoji icons for pairs (8 pairs)
const PAIR_ICONS = ['🦊','🐳','🌵','🍕','🎸','🚀','🦋','🌈'];

@Component({
  selector: 'app-memory',
  standalone: true,
  imports: [CommonModule, GameLayoutComponent],
  template: `
<app-game-layout
  gameTitle="Memory"
  [rules]="[
    'Retournez 2 cartes par tour.',
    'Si elles forment une paire, vous marquez un point et rejouez.',
    'Sinon, elles sont retournées face cachée.',
    'Le joueur avec le plus de paires à la fin gagne.',
    '4×4 = 8 paires à trouver.'
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
  <div game-board class="memory-container">
    <!-- Score board -->
    <div class="score-bar" *ngIf="gameState()">
      <div class="score-item" [class.active]="gameState()!.currentPlayer === 1">
        <span class="score-name">{{ player1Name() }}</span>
        <span class="score-value">{{ gameState()!.scores[0] }} paires</span>
      </div>
      <div class="score-divider">
        <span class="pairs-left">{{ gameState()!.totalPairs - gameState()!.matchedPairs }} restantes</span>
      </div>
      <div class="score-item" [class.active]="gameState()!.currentPlayer === 2">
        <span class="score-name">{{ player2Name() }}</span>
        <span class="score-value">{{ gameState()!.scores[1] }} paires</span>
      </div>
    </div>

    <!-- Grid -->
    <div class="memory-grid" *ngIf="gameState()">
      @for (card of gameState()!.cards; track card.id) {
        <div
          class="card-wrapper"
          [class.flipped]="card.faceUp || card.matched"
          [class.matched]="card.matched"
          [class.disabled]="isResolving() || card.faceUp || card.matched || !canFlip()"
          (click)="flip(card.id)"
        >
          <div class="card-inner">
            <div class="card-front">?</div>
            <div class="card-back">{{ iconFor(card.pairId) }}</div>
          </div>
        </div>
      }
    </div>

    <div class="resolving-msg" *ngIf="isResolving()">
      Pas de paire… retournement en cours…
    </div>
  </div>
</app-game-layout>
  `,
  styles: [`
    .memory-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 16px;
    }
    .score-bar {
      display: flex;
      align-items: center;
      gap: 16px;
      background: rgba(255,255,255,0.08);
      border-radius: 12px;
      padding: 10px 20px;
      width: 100%;
      max-width: 480px;
      justify-content: space-between;
    }
    .score-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      transition: transform 0.2s;
    }
    .score-item.active {
      transform: scale(1.1);
    }
    .score-name { font-size: 13px; color: rgba(255,255,255,0.6); }
    .score-value { font-size: 18px; font-weight: 700; color: #fff; }
    .score-divider { display: flex; flex-direction: column; align-items: center; }
    .pairs-left { font-size: 12px; color: rgba(255,255,255,0.4); }

    .memory-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      max-width: 400px;
      width: 100%;
    }

    .card-wrapper {
      perspective: 600px;
      cursor: pointer;
      aspect-ratio: 1;
    }
    .card-wrapper.disabled { cursor: not-allowed; }

    .card-inner {
      width: 100%;
      height: 100%;
      position: relative;
      transform-style: preserve-3d;
      transition: transform 0.45s ease;
      border-radius: 10px;
    }
    .card-wrapper.flipped .card-inner { transform: rotateY(180deg); }

    .card-front, .card-back {
      position: absolute;
      inset: 0;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      backface-visibility: hidden;
      font-size: 28px;
      user-select: none;
    }
    .card-front {
      background: linear-gradient(135deg, #3f51b5, #7c4dff);
      color: rgba(255,255,255,0.4);
      font-size: 22px;
      font-weight: bold;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    .card-back {
      background: linear-gradient(135deg, #fff9c4, #fff);
      transform: rotateY(180deg);
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    .card-wrapper.matched .card-back {
      background: linear-gradient(135deg, #c8e6c9, #a5d6a7);
      box-shadow: 0 0 10px rgba(76,175,80,0.6);
    }

    .resolving-msg {
      font-size: 14px;
      color: rgba(255,255,255,0.5);
      font-style: italic;
      margin-top: 4px;
    }
  `]
})
export class MemoryComponent {
  private gameService = inject(GameService);
  private session = injectGameSession('memory');

  room = this.session.room;
  isPlaying = this.session.isPlaying;
  hasVotedRematch = this.session.hasVotedRematch;
  disconnectedPlayerName = this.session.disconnectedPlayerName;
  player1Name = this.session.player1Name;
  player2Name = this.session.player2Name;
  floatingEmojis = this.session.floatingEmojis;
  leaveRoom = this.session.leaveRoom;
  requestRematch = this.session.requestRematch;
  forceEnd = this.session.forceEnd;
  shareInvitationLink = this.session.shareInvitationLink;
  sendEmoji = this.session.sendEmoji;

  gameState = computed(() => this.room()?.gameState as MemoryState | null);

  isResolving = computed(() => this.gameState()?.isResolving ?? false);

  myPlayerNum = computed(() => {
    const room = this.room();
    if (!room || room.isLocal) return null;
    const sid = this.gameService.getSocketId();
    const idx = room.players.findIndex(p => p.id === sid);
    return idx === -1 ? null : (idx + 1) as 1 | 2;
  });

  isMyTurn = computed(() => {
    const room = this.room();
    if (!room || room.isLocal) return true;
    const gs = this.gameState();
    if (!gs) return false;
    return gs.currentPlayer === this.myPlayerNum();
  });

  canFlip = computed(() => {
    if (!this.isPlaying()) return false;
    if (this.isResolving()) return false;
    const room = this.room();
    if (room?.isLocal) return true;
    return this.isMyTurn();
  });

  turnText = computed(() => {
    const gs = this.gameState();
    if (!gs) return '';
    const room = this.room();
    if (room?.isLocal) {
      return `Tour du ${gs.currentPlayer === 1 ? this.player1Name() : this.player2Name()}`;
    }
    return 'Votre tour — retournez une carte !';
  });

  opponentText = computed(() => {
    const gs = this.gameState();
    if (!gs) return '';
    const room = this.room();
    if (room?.isLocal) return '';
    const oppName = this.myPlayerNum() === 1 ? this.player2Name() : this.player1Name();
    return `${oppName} retourne une carte…`;
  });

  winnerLabel = computed(() => {
    const gs = this.gameState();
    if (!gs || gs.winner === null) return '';
    if (gs.winner === 0) return 'Égalité !';
    const name = gs.winner === 1 ? this.player1Name() : this.player2Name();
    return `${name} gagne !`;
  });

  isWinner = computed(() => {
    const gs = this.gameState();
    if (!gs || gs.winner === null) return false;
    if (gs.winner === 0) return false;
    const room = this.room();
    if (room?.isLocal) return false;
    return gs.winner === this.myPlayerNum();
  });

  isLoser = computed(() => {
    const gs = this.gameState();
    if (!gs || gs.winner === null) return false;
    if (gs.winner === 0) return false;
    const room = this.room();
    if (room?.isLocal) return false;
    return gs.winner !== this.myPlayerNum();
  });

  iconFor(pairId: number): string {
    return PAIR_ICONS[pairId % PAIR_ICONS.length];
  }

  flip(cardId: number) {
    if (!this.canFlip()) return;
    this.gameService.sendMemoryFlip(cardId);
  }
}
