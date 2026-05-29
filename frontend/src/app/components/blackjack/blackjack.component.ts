import { Component, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameService } from '../../services/game.service';
import { GameLayoutComponent } from '../game-layout/game-layout.component';
import { injectGameSession } from '../../services/game-session.helper';

type BjSuit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
type BjRank = string;
type BjPhase = 'betting' | 'p1turn' | 'p2turn' | 'dealerturn' | 'payout';

interface BjCard { suit: BjSuit; rank: BjRank; faceDown: boolean; }
interface BjHand { cards: BjCard[]; bust: boolean; blackjack: boolean; }
interface BjPlayerState {
  hand: BjHand; bet: number; chips: number;
  betPlaced: boolean; standing: boolean; doubled: boolean;
  result: 'win' | 'lose' | 'push' | null;
}
interface BlackjackState {
  phase: BjPhase;
  dealer: BjHand;
  p1: BjPlayerState;
  p2: BjPlayerState;
  round: number;
  maxRounds: number;
  winner: number | null;
  playerIds: [string, string];
}

const SUIT_SYMBOLS: Record<BjSuit, string> = {
  hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠'
};
const RED_SUITS: BjSuit[] = ['hearts', 'diamonds'];
const BET_OPTIONS = [10, 25, 50, 100, 200, 500];

function cardScore(cards: BjCard[]): number {
  let score = 0, aces = 0;
  for (const c of cards) {
    if (c.faceDown) continue;
    if (c.rank === 'A') { score += 11; aces++; }
    else if (['J','Q','K'].includes(c.rank)) score += 10;
    else score += parseInt(c.rank);
  }
  while (score > 21 && aces > 0) { score -= 10; aces--; }
  return score;
}

@Component({
  selector: 'app-blackjack',
  standalone: true,
  imports: [CommonModule, GameLayoutComponent],
  template: `
<app-game-layout
  gameTitle="Blackjack"
  [rules]="[
    '2 joueurs + dealer (banque automatique).',
    'Chacun mise simultanément entre 10 et 500 chips.',
    'Objectif : battre le dealer sans dépasser 21.',
    'Blackjack (As + 10) paie 1,5× la mise.',
    'Doubler : double la mise et tire une seule carte.',
    'Dealer tire jusqu\\'à 17, s\\'arrête à 17 ou plus.',
    '10 manches — le joueur avec le plus de chips gagne.'
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
  (leaveRoom)="leaveRoom()"
  (requestRematch)="requestRematch()"
  (sendEmoji)="sendEmoji($event)"
  (forceEnd)="forceEnd()"
  (shareInvitation)="shareInvitationLink()"
>
  <div game-board class="bj-table" *ngIf="gameState() as gs">

    <!-- Round & chips header -->
    <div class="bj-header">
      <span class="round-badge">Manche {{ gs.round }} / {{ gs.maxRounds }}</span>
      <span class="chips-info">
        {{ player1Name() }}: <b>{{ gs.p1.chips }} 🪙</b>
        &nbsp;|&nbsp;
        {{ player2Name() }}: <b>{{ gs.p2.chips }} 🪙</b>
      </span>
    </div>

    <!-- Dealer area -->
    <div class="dealer-area">
      <div class="area-label">Dealer</div>
      <div class="bj-hand">
        @for (card of gs.dealer.cards; track $index) {
          <div class="bj-card" [class.face-down]="card.faceDown" [class.red]="isRed(card)">
            <span *ngIf="!card.faceDown">{{ card.rank }}{{ suitOf(card) }}</span>
            <span *ngIf="card.faceDown">🂠</span>
          </div>
        }
      </div>
      <div class="score-chip" *ngIf="gs.dealer.cards.length > 0">
        {{ dealerScore(gs) }}
        <span class="bust-label" *ngIf="gs.dealer.bust"> — BUST</span>
      </div>
    </div>

    <!-- Players area -->
    <div class="players-row">

      <!-- P1 -->
      <div class="player-panel" [class.active]="gs.phase === 'p1turn'" [class.payout]="gs.phase === 'payout'">
        <div class="player-label">{{ player1Name() }}</div>
        <div class="chips-row">{{ gs.p1.chips }} 🪙</div>

        <!-- Betting -->
        <div class="bet-area" *ngIf="gs.phase === 'betting' && !gs.p1.betPlaced && canControlP(1)">
          <p class="bet-prompt">Votre mise :</p>
          <div class="bet-chips">
            @for (opt of betOptions; track opt) {
              <button class="chip-btn" (click)="placeBet(1, opt)">{{ opt }}</button>
            }
          </div>
        </div>
        <div class="waiting-bet" *ngIf="gs.phase === 'betting' && gs.p1.betPlaced">
          Mise placée : {{ gs.p1.bet }} 🪙 — en attente…
        </div>

        <!-- Hand -->
        <div class="bj-hand" *ngIf="gs.phase !== 'betting' || gs.p1.betPlaced">
          @for (card of gs.p1.hand.cards; track $index) {
            <div class="bj-card" [class.red]="isRed(card)">{{ card.rank }}{{ suitOf(card) }}</div>
          }
        </div>
        <div class="score-chip" *ngIf="gs.p1.hand.cards.length > 0">
          {{ p1Score(gs) }}
          <span class="bust-label" *ngIf="gs.p1.hand.bust"> — BUST</span>
          <span class="bj-label" *ngIf="gs.p1.hand.blackjack"> — BLACKJACK!</span>
        </div>
        <div class="bet-badge" *ngIf="gs.p1.bet > 0 && gs.phase !== 'betting'">Mise : {{ gs.p1.bet }} 🪙</div>

        <!-- Action buttons P1 -->
        <div class="action-buttons" *ngIf="gs.phase === 'p1turn' && canControlP(1)">
          <button class="action-btn hit" (click)="hit(1)">Hit</button>
          <button class="action-btn stand" (click)="stand(1)">Stand</button>
          <button class="action-btn double" *ngIf="canDouble(gs.p1)" (click)="double(1)">Double</button>
        </div>

        <!-- Result -->
        <div class="result-badge" *ngIf="gs.phase === 'payout' && gs.p1.result" [class]="gs.p1.result">
          {{ resultLabel(gs.p1.result) }}
        </div>
      </div>

      <!-- P2 -->
      <div class="player-panel" [class.active]="gs.phase === 'p2turn'" [class.payout]="gs.phase === 'payout'">
        <div class="player-label">{{ player2Name() }}</div>
        <div class="chips-row">{{ gs.p2.chips }} 🪙</div>

        <!-- Betting -->
        <div class="bet-area" *ngIf="gs.phase === 'betting' && !gs.p2.betPlaced && canControlP(2)">
          <p class="bet-prompt">Votre mise :</p>
          <div class="bet-chips">
            @for (opt of betOptions; track opt) {
              <button class="chip-btn" (click)="placeBet(2, opt)">{{ opt }}</button>
            }
          </div>
        </div>
        <div class="waiting-bet" *ngIf="gs.phase === 'betting' && gs.p2.betPlaced">
          Mise placée : {{ gs.p2.bet }} 🪙 — en attente…
        </div>

        <!-- Hand -->
        <div class="bj-hand" *ngIf="gs.phase !== 'betting' || gs.p2.betPlaced">
          @for (card of gs.p2.hand.cards; track $index) {
            <div class="bj-card" [class.red]="isRed(card)">{{ card.rank }}{{ suitOf(card) }}</div>
          }
        </div>
        <div class="score-chip" *ngIf="gs.p2.hand.cards.length > 0">
          {{ p2Score(gs) }}
          <span class="bust-label" *ngIf="gs.p2.hand.bust"> — BUST</span>
          <span class="bj-label" *ngIf="gs.p2.hand.blackjack"> — BLACKJACK!</span>
        </div>
        <div class="bet-badge" *ngIf="gs.p2.bet > 0 && gs.phase !== 'betting'">Mise : {{ gs.p2.bet }} 🪙</div>

        <!-- Action buttons P2 -->
        <div class="action-buttons" *ngIf="gs.phase === 'p2turn' && canControlP(2)">
          <button class="action-btn hit" (click)="hit(2)">Hit</button>
          <button class="action-btn stand" (click)="stand(2)">Stand</button>
          <button class="action-btn double" *ngIf="canDouble(gs.p2)" (click)="double(2)">Double</button>
        </div>

        <!-- Result -->
        <div class="result-badge" *ngIf="gs.phase === 'payout' && gs.p2.result" [class]="gs.p2.result">
          {{ resultLabel(gs.p2.result) }}
        </div>
      </div>
    </div>

    <!-- Dealer turn message -->
    <div class="dealer-msg" *ngIf="gs.phase === 'dealerturn'">Le dealer joue…</div>

    <!-- Payout / Next round -->
    <div class="payout-bar" *ngIf="gs.phase === 'payout' && gs.winner === null">
      <button class="next-round-btn" (click)="nextRound()">
        Manche suivante →
      </button>
    </div>
  </div>
</app-game-layout>
  `,
  styles: [`
    .bj-table {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      padding: 14px;
    }
    .bj-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    .round-badge {
      font-size: 13px;
      background: rgba(255,255,255,0.1);
      border-radius: 20px;
      padding: 3px 12px;
      color: rgba(255,255,255,0.7);
    }
    .chips-info { font-size: 14px; color: rgba(255,255,255,0.8); }

    /* Dealer */
    .dealer-area {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      background: rgba(0,0,0,0.2);
      border-radius: 12px;
      padding: 12px 20px;
      width: 100%;
      max-width: 480px;
    }
    .area-label { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.4); }

    /* BJ Card */
    .bj-hand { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }
    .bj-card {
      width: 48px; height: 70px;
      background: #fff;
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px;
      font-weight: 700;
      color: #222;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .bj-card.red { color: #c62828; }
    .bj-card.face-down {
      background: linear-gradient(135deg, #1a237e, #3949ab);
      color: #fff;
      font-size: 22px;
    }

    .score-chip {
      font-size: 15px; font-weight: 600;
      background: rgba(255,255,255,0.12);
      border-radius: 20px; padding: 2px 12px;
      color: #fff;
    }
    .bust-label { color: #ef5350; }
    .bj-label { color: #ffd54f; }

    /* Players */
    .players-row {
      display: flex;
      gap: 16px;
      width: 100%;
      max-width: 540px;
    }
    .player-panel {
      flex: 1;
      background: rgba(255,255,255,0.05);
      border-radius: 14px;
      padding: 12px;
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      border: 2px solid transparent;
      transition: border-color 0.3s;
    }
    .player-panel.active { border-color: #7c4dff; }
    .player-panel.payout { border-color: transparent; }

    .player-label { font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.85); }
    .chips-row { font-size: 15px; color: #ffd54f; }
    .bet-badge { font-size: 12px; color: rgba(255,255,255,0.5); }

    /* Betting */
    .bet-prompt { margin: 0; font-size: 13px; color: rgba(255,255,255,0.6); }
    .bet-chips { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
    .chip-btn {
      padding: 6px 10px; border-radius: 20px;
      background: linear-gradient(135deg, #7c4dff, #448aff);
      color: #fff; font-size: 13px; font-weight: 600;
      border: none; cursor: pointer; transition: transform 0.15s;
    }
    .chip-btn:hover { transform: scale(1.08); }
    .waiting-bet { font-size: 12px; color: rgba(255,255,255,0.45); font-style: italic; text-align: center; }

    /* Action buttons */
    .action-buttons { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
    .action-btn {
      padding: 8px 16px; border-radius: 8px; border: none;
      cursor: pointer; font-size: 14px; font-weight: 700;
      transition: transform 0.15s, opacity 0.15s;
    }
    .action-btn:hover { transform: scale(1.05); }
    .action-btn.hit { background: #43a047; color: #fff; }
    .action-btn.stand { background: #e53935; color: #fff; }
    .action-btn.double { background: #fb8c00; color: #fff; }

    /* Result badges */
    .result-badge {
      font-size: 16px; font-weight: 800;
      padding: 6px 16px; border-radius: 20px;
    }
    .result-badge.win { background: #1b5e20; color: #69f0ae; }
    .result-badge.lose { background: #b71c1c; color: #ff8a80; }
    .result-badge.push { background: #37474f; color: #b0bec5; }

    /* Dealer turn / payout */
    .dealer-msg {
      font-size: 14px; color: rgba(255,255,255,0.5); font-style: italic;
    }
    .payout-bar { display: flex; justify-content: center; }
    .next-round-btn {
      padding: 10px 28px; border-radius: 24px;
      background: linear-gradient(135deg, #7c4dff, #448aff);
      color: #fff; font-size: 15px; font-weight: 700;
      border: none; cursor: pointer; transition: transform 0.15s;
    }
    .next-round-btn:hover { transform: scale(1.04); }
  `]
})
export class BlackjackComponent {
  private gameService = inject(GameService);
  private session = injectGameSession('blackjack');

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

  betOptions = BET_OPTIONS;

  gameState = computed(() => this.room()?.gameState as BlackjackState | null);

  myPlayerNum = computed((): 1 | 2 => {
    const room = this.room();
    if (!room || room.isLocal) return 1; // local: both handled
    const sid = this.gameService.getSocketId();
    const idx = room.players.findIndex(p => p.id === sid);
    return idx === 0 ? 1 : 2;
  });

  isMyTurn = computed(() => {
    const gs = this.gameState();
    if (!gs) return false;
    const room = this.room();
    if (room?.isLocal) return true;
    const pNum = this.myPlayerNum();
    if (gs.phase === 'betting') return !(pNum === 1 ? gs.p1.betPlaced : gs.p2.betPlaced);
    if (gs.phase === 'p1turn') return pNum === 1;
    if (gs.phase === 'p2turn') return pNum === 2;
    if (gs.phase === 'payout') return true;
    return false;
  });

  canControlP(playerNum: 1 | 2): boolean {
    const room = this.room();
    if (room?.isLocal) return true;
    return this.myPlayerNum() === playerNum;
  }

  canDouble(ps: BjPlayerState): boolean {
    return ps.hand.cards.length === 2 && ps.chips >= ps.bet * 2;
  }

  placeBet(playerNum: 1 | 2, amount: number) {
    const room = this.room();
    if (room?.isLocal) {
      this.gameService.sendBlackjackBet(amount, playerNum - 1);
    } else {
      this.gameService.sendBlackjackBet(amount);
    }
  }

  hit(playerNum: 1 | 2) {
    const room = this.room();
    if (room?.isLocal) {
      this.gameService.sendBlackjackHit(playerNum - 1);
    } else {
      this.gameService.sendBlackjackHit();
    }
  }

  stand(playerNum: 1 | 2) {
    const room = this.room();
    if (room?.isLocal) {
      this.gameService.sendBlackjackStand(playerNum - 1);
    } else {
      this.gameService.sendBlackjackStand();
    }
  }

  double(playerNum: 1 | 2) {
    const room = this.room();
    if (room?.isLocal) {
      this.gameService.sendBlackjackDouble(playerNum - 1);
    } else {
      this.gameService.sendBlackjackDouble();
    }
  }

  nextRound() { this.gameService.sendBlackjackNextRound(); }

  isRed(card: BjCard): boolean { return RED_SUITS.includes(card.suit); }
  suitOf(card: BjCard): string { return SUIT_SYMBOLS[card.suit] ?? ''; }
  dealerScore(gs: BlackjackState): number { return cardScore(gs.dealer.cards); }
  p1Score(gs: BlackjackState): number { return cardScore(gs.p1.hand.cards); }
  p2Score(gs: BlackjackState): number { return cardScore(gs.p2.hand.cards); }
  resultLabel(r: string): string { return r === 'win' ? 'Gagné 🎉' : r === 'lose' ? 'Perdu' : 'Égalité'; }

  turnText = computed(() => {
    const gs = this.gameState();
    if (!gs) return '';
    const room = this.room();
    if (gs.phase === 'betting') {
      if (room?.isLocal) return 'Les deux joueurs misent simultanément';
      return gs.p1.betPlaced || gs.p2.betPlaced ? 'En attente de l\'adversaire…' : 'Choisissez votre mise';
    }
    if (gs.phase === 'p1turn') {
      if (room?.isLocal) return `Tour de ${this.player1Name()}`;
      return this.myPlayerNum() === 1 ? 'Votre tour !' : '';
    }
    if (gs.phase === 'p2turn') {
      if (room?.isLocal) return `Tour de ${this.player2Name()}`;
      return this.myPlayerNum() === 2 ? 'Votre tour !' : '';
    }
    if (gs.phase === 'dealerturn') return 'Le dealer joue…';
    if (gs.phase === 'payout') return 'Résultats de la manche';
    return '';
  });

  opponentText = computed(() => {
    const gs = this.gameState();
    const room = this.room();
    if (!gs || room?.isLocal) return '';
    const oppName = this.myPlayerNum() === 1 ? this.player2Name() : this.player1Name();
    if (gs.phase === 'p1turn' && this.myPlayerNum() !== 1) return `${oppName} joue…`;
    if (gs.phase === 'p2turn' && this.myPlayerNum() !== 2) return `${oppName} joue…`;
    return '';
  });

  winnerLabel = computed(() => {
    const gs = this.gameState();
    if (!gs || gs.winner === null) return '';
    if (gs.winner === 0) return 'Égalité finale !';
    const name = gs.winner === 1 ? this.player1Name() : this.player2Name();
    return `${name} remporte la partie !`;
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
    return gs.winner !== 0 && gs.winner !== this.myPlayerNum();
  });
}
