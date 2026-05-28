import { Component, computed, inject, signal } from '@angular/core';
import { GameService } from '../../services/game.service';
import { GameLayoutComponent } from '../game-layout/game-layout.component';
import { FloatingEmojisComponent } from '../floating-emojis/floating-emojis.component';
import { injectGameSession } from '../../services/game-session.helper';
import { DominosGameState } from '../../models/game.models';

@Component({
  selector: 'app-dominos',
  standalone: true,
  imports: [GameLayoutComponent, FloatingEmojisComponent],
  templateUrl: './dominos.component.html',
  styleUrls: ['./dominos.component.css']
})
export class DominosComponent {
  private gameService = inject(GameService);
  private session = injectGameSession('dominos');

  readonly rules = [
    'Chaque joueur reçoit 7 dominos au début.',
    'Le reste des dominos forme la pioche (le talon ou boneyard).',
    'À votre tour, jouez un domino de votre main ayant une extrémité correspondante avec l\'un des deux bouts du plateau.',
    'Si vous n\'avez aucun domino jouable, vous devez piocher jusqu\'à pouvoir jouer.',
    'Si le talon est vide et que vous ne pouvez pas jouer, passez votre tour.',
    'Le premier joueur à vider sa main gagne. Si le jeu est bloqué, le joueur avec le moins de pips (points) restants gagne.'
  ];

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

  selectedTileIndex = signal<number | null>(null);

  private gs = computed(() => this.room()?.gameState as DominosGameState);

  board = computed(() => this.gs()?.board ?? []);
  handP1 = computed(() => this.gs()?.handP1 ?? []);
  handP2 = computed(() => this.gs()?.handP2 ?? []);
  boneyard = computed(() => this.gs()?.boneyard ?? []);
  currentPlayerNum = computed(() => this.gs()?.currentPlayer ?? 1);
  winner = computed(() => this.gs()?.winner ?? null);
  winnerReason = computed(() => this.gs()?.winnerReason ?? '');

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

  // Label showing tiles count
  scoreP1Label = computed(() => `${this.handP1().length} tuile${this.handP1().length > 1 ? 's' : ''}`);
  scoreP2Label = computed(() => `${this.handP2().length} tuile${this.handP2().length > 1 ? 's' : ''}`);

  winnerLabel = computed(() => {
    const win = this.winner();
    if (win === 'draw') return 'draw';
    if (win === 1) return this.player1Name();
    if (win === 2) return this.player2Name();
    return '';
  });

  isWinner = computed(() => {
    const win = this.winner();
    return win !== null && win !== 'draw' && win === this.myPlayerNum();
  });

  isLoser = computed(() => {
    const win = this.winner();
    return win !== null && win !== 'draw' && win !== this.myPlayerNum();
  });

  // Current active player hand
  myHand = computed(() => {
    const r = this.room();
    if (r?.isLocal) {
      return this.currentPlayerNum() === 1 ? this.handP1() : this.handP2();
    }
    return this.myPlayerNum() === 1 ? this.handP1() : this.handP2();
  });

  // Inactive/opponent hand count
  opponentHandCount = computed(() => {
    const r = this.room();
    if (r?.isLocal) return 0; // Not applicable
    return this.myPlayerNum() === 1 ? this.handP2().length : this.handP1().length;
  });

  opponentHandArray = computed<number[]>(() => {
    return Array(this.opponentHandCount()).fill(0);
  });

  // Check if hand has a valid play on the board
  hasAnyPlayableTile = computed(() => {
    const board = this.board();
    const hand = this.myHand();
    if (board.length === 0) return hand.length > 0;
    const leftEnd = board[0][0];
    const rightEnd = board[board.length - 1][1];
    return hand.some(([x, y]) => x === leftEnd || y === leftEnd || x === rightEnd || y === rightEnd);
  });

  // Boneyard drawing condition
  canDraw = computed(() => {
    return this.isMyTurn() && !this.hasAnyPlayableTile() && this.boneyard().length > 0;
  });

  // Passing turn condition
  canPass = computed(() => {
    return this.isMyTurn() && !this.hasAnyPlayableTile() && this.boneyard().length === 0;
  });

  // Dots for grid layout
  getDots(value: number): boolean[] {
    switch (value) {
      case 0: return [
        false, false, false,
        false, false, false,
        false, false, false
      ];
      case 1: return [
        false, false, false,
        false, true,  false,
        false, false, false
      ];
      case 2: return [
        true,  false, false,
        false, false, false,
        false, false, true
      ];
      case 3: return [
        true,  false, false,
        false, true,  false,
        false, false, true
      ];
      case 4: return [
        true,  false, true,
        false, false, false,
        true,  false, true
      ];
      case 5: return [
        true,  false, true,
        false, true,  false,
        true,  false, true
      ];
      case 6: return [
        true,  false, true,
        true,  false, true,
        true,  false, true
      ];
      default: return Array(9).fill(false);
    }
  }

  // Check if a specific tile is playable on the board
  isTilePlayable(tile: [number, number]): boolean {
    if (!this.isMyTurn()) return false;
    const board = this.board();
    if (board.length === 0) return true;
    const leftEnd = board[0][0];
    const rightEnd = board[board.length - 1][1];
    return tile[0] === leftEnd || tile[1] === leftEnd || tile[0] === rightEnd || tile[1] === rightEnd;
  }

  // Get matching sides for the selected tile
  selectedTileSides = computed(() => {
    const idx = this.selectedTileIndex();
    if (idx === null) return { left: false, right: false };
    const hand = this.myHand();
    if (idx < 0 || idx >= hand.length) return { left: false, right: false };
    const tile = hand[idx];
    const board = this.board();
    if (board.length === 0) return { left: true, right: true };
    const leftEnd = board[0][0];
    const rightEnd = board[board.length - 1][1];

    return {
      left: tile[0] === leftEnd || tile[1] === leftEnd,
      right: tile[0] === rightEnd || tile[1] === rightEnd
    };
  });

  selectTile(index: number) {
    if (!this.isMyTurn()) return;
    const tile = this.myHand()[index];
    if (!this.isTilePlayable(tile)) return;

    this.selectedTileIndex.set(index);

    // If it can only go on one side, play it automatically!
    const board = this.board();
    if (board.length > 0) {
      const sides = this.selectedTileSides();
      if (sides.left && !sides.right) {
        this.playSelectedTile('left');
      } else if (!sides.left && sides.right) {
        this.playSelectedTile('right');
      }
    } else {
      // Empty board: play automatically on left (which represents center)
      this.playSelectedTile('left');
    }
  }

  playSelectedTile(side: 'left' | 'right') {
    const idx = this.selectedTileIndex();
    if (idx === null) return;
    this.gameService.makeDominosMove(idx, side);
    this.selectedTileIndex.set(null);
  }

  drawTile() {
    if (this.canDraw()) {
      this.gameService.drawDominosTile();
      this.selectedTileIndex.set(null);
    }
  }

  passTurn() {
    if (this.canPass()) {
      this.gameService.passDominosTurn();
      this.selectedTileIndex.set(null);
    }
  }
}
