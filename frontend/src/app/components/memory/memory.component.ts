import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
} from '@angular/core';
import * as Phaser from 'phaser';
import { GameService } from '../../services/game.service';
import { GameLayoutComponent } from '../game-layout/game-layout.component';
import { injectGameSession } from '../../services/game-session.helper';
import { MemoryPhaserScene, MemorySceneSnapshot, MemoryState } from './memory.scene';

@Component({
  selector: 'app-memory',
  standalone: true,
  imports: [GameLayoutComponent],
  template: `
<app-game-layout
  gameTitle="Memory"
  [rules]="[
    'Retournez 2 cartes par tour.',
    'Si elles forment une paire, vous marquez un point et rejouez.',
    'Sinon, elles sont retournees face cachee.',
    'Le joueur avec le plus de paires a la fin gagne.',
    '4x4 = 8 paires a trouver.'
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
  player1Color="#7c4dff"
  player2Color="#00bcd4"
  (leaveRoom)="leaveRoom()"
  (requestRematch)="requestRematch()"
  (sendEmoji)="sendEmoji($event)"
  (forceEnd)="forceEnd()"
  (shareInvitation)="shareInvitationLink()"
>
  <div game-board class="memory-container">
    <div #phaserHost class="memory-phaser" aria-label="Plateau Memory Phaser"></div>
  </div>
</app-game-layout>
  `,
  styles: [`
    .memory-container {
      width: 100%;
      height: 100%;
      min-height: 0;
      padding: 12px;
      box-sizing: border-box;
      display: flex;
    }

    .memory-phaser {
      width: 100%;
      height: 100%;
      min-height: 420px;
      overflow: hidden;
      border-radius: 8px;
      box-shadow: 0 16px 42px rgba(0,0,0,0.3);
      touch-action: manipulation;
    }

    .memory-phaser canvas {
      display: block;
      width: 100%;
      height: 100%;
    }

    @media (max-width: 560px) {
      .memory-container {
        padding: 8px;
      }

      .memory-phaser {
        min-height: 360px;
      }
    }
  `]
})
export class MemoryComponent implements AfterViewInit, OnDestroy {
  @ViewChild('phaserHost') private phaserHost?: ElementRef<HTMLDivElement>;

  private gameService = inject(GameService);
  private session = injectGameSession('memory');
  private phaserGame?: Phaser.Game;
  private phaserScene?: MemoryPhaserScene;
  private resizeObserver?: ResizeObserver;

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

  private readonly phaserSnapshot = computed<MemorySceneSnapshot>(() => ({
    state: this.gameState(),
    canFlip: this.canFlip(),
    player1Name: this.player1Name(),
    player2Name: this.player2Name(),
    statusText: this.sceneStatusText(),
  }));

  private readonly phaserSync = effect(() => {
    this.phaserScene?.render(this.phaserSnapshot());
  });

  ngAfterViewInit(): void {
    const host = this.phaserHost?.nativeElement;
    if (!host) return;

    const width = Math.max(host.clientWidth, 320);
    const height = Math.max(host.clientHeight, 360);
    this.phaserScene = new MemoryPhaserScene(cardId => this.flip(cardId));
    this.phaserGame = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host,
      width,
      height,
      backgroundColor: '#0b1020',
      scene: this.phaserScene,
      scale: {
        mode: Phaser.Scale.NONE,
      },
    });

    this.resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry || !this.phaserGame) return;
      const nextWidth = Math.max(Math.floor(entry.contentRect.width), 320);
      const nextHeight = Math.max(Math.floor(entry.contentRect.height), 360);
      this.phaserGame.scale.resize(nextWidth, nextHeight);
      this.phaserScene?.refreshSize();
    });
    this.resizeObserver.observe(host);
    this.phaserScene.render(this.phaserSnapshot());
  }

  ngOnDestroy(): void {
    this.phaserSync.destroy();
    this.resizeObserver?.disconnect();
    this.phaserGame?.destroy(true);
  }

  turnText = computed(() => {
    const gs = this.gameState();
    if (!gs) return '';
    const room = this.room();
    if (room?.isLocal) {
      return `Tour du ${gs.currentPlayer === 1 ? this.player1Name() : this.player2Name()}`;
    }
    return 'Votre tour - retournez une carte !';
  });

  opponentText = computed(() => {
    const gs = this.gameState();
    if (!gs) return '';
    const room = this.room();
    if (room?.isLocal) return '';
    const oppName = this.myPlayerNum() === 1 ? this.player2Name() : this.player1Name();
    return `${oppName} retourne une carte...`;
  });

  sceneStatusText = computed(() => {
    const gs = this.gameState();
    if (!gs) return 'En attente de la partie...';
    if (gs.winner !== null) return this.winnerLabel();
    if (gs.isResolving) return 'Pas de paire... retournement en cours';
    const currentName = gs.currentPlayer === 1 ? this.player1Name() : this.player2Name();
    if (this.room()?.isLocal) return `Tour de ${currentName}`;
    return this.isMyTurn() ? 'Votre tour' : `Tour de ${currentName}`;
  });

  winnerLabel = computed(() => {
    const gs = this.gameState();
    if (!gs || gs.winner === null) return '';
    if (gs.winner === 0) return 'Egalite !';
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

  flip(cardId: number) {
    if (!this.canFlip()) return;
    this.gameService.sendMemoryFlip(cardId);
  }
}
