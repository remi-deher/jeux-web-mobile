import { Component, computed, inject, ViewChild, ElementRef, AfterViewInit, OnDestroy, effect } from '@angular/core';
import { GameService } from '../../services/game.service';
import { GameLayoutComponent } from '../game-layout/game-layout.component';
import { FloatingEmojisComponent } from '../floating-emojis/floating-emojis.component';
import { injectGameSession } from '../../services/game-session.helper';

@Component({
  selector: 'app-pong',
  standalone: true,
  imports: [GameLayoutComponent, FloatingEmojisComponent],
  template: `
    <app-game-layout
      gameTitle="Pong"
      [rules]="rules"
      [room]="room()"
      [isPlaying]="isPlaying()"
      [isMyTurn]="isPlaying()"
      turnAlertText="Déplacez votre raquette !"
      opponentTurnText="Partie en cours..."
      [winnerLabel]="winnerLabel()"
      [isWinner]="isWinner()"
      [isLoser]="isLoser()"
      [hasVotedRematch]="hasVotedRematch()"
      [disconnectedPlayerName]="disconnectedPlayerName()"
      [player1Name]="player1Name()"
      [player2Name]="player2Name()"
      [player1Active]="isPlaying()"
      [player2Active]="isPlaying()"
      [player1IndicatorSymbol]="scoreLabel()"
      (leaveRoom)="leaveRoom()"
      (requestRematch)="requestRematch()"
      (sendEmoji)="sendEmoji($event)"
      (forceEnd)="forceEnd()"
      (shareInvitation)="shareInvitationLink()"
    >
      <div game-board class="pong-board">
        <app-floating-emojis [emojis]="floatingEmojis()"></app-floating-emojis>
        <canvas #pongCanvas class="pong-canvas"></canvas>
        @if (!isPlaying() && room()?.status !== 'finished') {
          <div class="waiting-overlay">
            <span>En attente de l'adversaire...</span>
          </div>
        }
      </div>
    </app-game-layout>
  `,
  styles: [`
    .pong-board {
      position: relative;
      width: 100%;
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 0;
      padding: 8px;
      box-sizing: border-box;
    }

    .pong-canvas {
      display: block;
      border-radius: 12px;
      background: #050505;
      touch-action: none;
      cursor: none;
      box-shadow:
        0 0 0 1px rgba(255, 255, 255, 0.05),
        0 0 30px rgba(0, 230, 118, 0.15),
        0 0 60px rgba(0, 230, 118, 0.05);
    }

    .waiting-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.6);
      border-radius: 12px;
      color: rgba(255, 255, 255, 0.7);
      font-size: 16px;
      font-weight: 500;
    }
  `]
})
export class PongComponent implements AfterViewInit, OnDestroy {
  @ViewChild('pongCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private gameService = inject(GameService);
  private session = injectGameSession('pong');

  readonly rules = [
    'Déplacez votre raquette avec la souris ou le doigt pour renvoyer la balle.',
    'Le premier joueur à marquer 5 points gagne la partie.',
    'Toucher la balle en bord de raquette lui donne un angle plus prononcé.',
    'La balle accélère légèrement à chaque échange — restez concentré !',
    'En partie locale, la moitié gauche du terrain contrôle J1 et la droite J2.'
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

  myPlayerNum = computed<number | null>(() => {
    const r = this.room();
    if (!r) return null;
    const socketId = this.gameService.getSocketId();
    const idx = r.players.findIndex((p: any) => p.id === socketId);
    return idx !== -1 ? idx + 1 : null;
  });

  scoreLabel = computed(() => {
    const gs = this.room()?.gameState as any;
    if (!gs) return '';
    return `${gs.scoreP1 ?? 0} — ${gs.scoreP2 ?? 0}`;
  });

  winnerLabel = computed(() => {
    const winner = this.room()?.gameState?.winner;
    if (winner === 1) return this.player1Name();
    if (winner === 2) return this.player2Name();
    return '';
  });

  isWinner = computed(() => {
    const winner = this.room()?.gameState?.winner;
    const me = this.myPlayerNum();
    return winner !== null && winner !== undefined && winner === me;
  });

  isLoser = computed(() => {
    const winner = this.room()?.gameState?.winner;
    const me = this.myPlayerNum();
    return winner !== null && winner !== undefined && winner !== me;
  });

  private resizeObserver: ResizeObserver | null = null;
  private lastState: any = null;

  constructor() {
    effect(() => {
      const state = this.room()?.gameState;
      if (state) {
        this.lastState = state;
        this.drawFrame();
      }
    });
  }

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    const parent = canvas.parentElement!;

    this.resizeObserver = new ResizeObserver(() => {
      this.resizeCanvas();
      this.drawFrame();
    });
    this.resizeObserver.observe(parent);
    this.resizeCanvas();

    canvas.addEventListener('mousemove', (e: MouseEvent) => this.handlePointer(e.clientX, e.clientY), { passive: true });
    canvas.addEventListener('touchmove', (e: TouchEvent) => {
      e.preventDefault();
      const r = this.room();
      const rect = canvas.getBoundingClientRect();
      if (r?.isLocal) {
        Array.from(e.touches).forEach(touch => {
          const xPct = ((touch.clientX - rect.left) / rect.width) * 100;
          const yPct = ((touch.clientY - rect.top) / rect.height) * 100;
          this.gameService.sendPongPaddle(yPct, xPct < 50 ? 1 : 2);
        });
      } else {
        const touch = e.touches[0];
        const yPct = ((touch.clientY - rect.top) / rect.height) * 100;
        this.gameService.sendPongPaddle(yPct);
      }
    }, { passive: false });

    if (this.lastState) this.drawFrame();
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
  }

  onMouseMove(event: MouseEvent) {
    // handled via addEventListener for finer control
  }

  private handlePointer(clientX: number, clientY: number) {
    if (!this.isPlaying()) return;
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const yPct = ((clientY - rect.top) / rect.height) * 100;
    const r = this.room();

    if (r?.isLocal) {
      const xPct = ((clientX - rect.left) / rect.width) * 100;
      this.gameService.sendPongPaddle(yPct, xPct < 50 ? 1 : 2);
    } else {
      this.gameService.sendPongPaddle(yPct);
    }
  }

  private resizeCanvas() {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const availW = parent.clientWidth - 16;
    const availH = parent.clientHeight - 16;
    const aspect = 1.65;

    let w = availW;
    let h = w / aspect;
    if (h > availH) {
      h = availH;
      w = h * aspect;
    }

    canvas.width = Math.floor(w);
    canvas.height = Math.floor(h);
  }

  private drawFrame() {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas || !this.lastState) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const s = this.lastState;

    // Background
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, W, H);

    // Center dashed divider
    ctx.save();
    ctx.setLineDash([H / 28, H / 28]);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
    ctx.restore();

    // Scores
    ctx.font = `bold ${Math.floor(H * 0.13)}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillText(String(s.scoreP1 ?? 0), W * 0.25, H * 0.05);
    ctx.fillText(String(s.scoreP2 ?? 0), W * 0.75, H * 0.05);

    const pH = (s.paddleHeight / 100) * H;
    const pW = Math.max(6, (s.paddleWidth / 100) * W);
    const leftX = W * 0.025;
    const rightX = W * 0.975 - pW;

    // P1 paddle — neon green
    const p1Top = (s.p1Y / 100) * H - pH / 2;
    ctx.save();
    ctx.shadowColor = '#00E676';
    ctx.shadowBlur = 18;
    const g1 = ctx.createLinearGradient(0, p1Top, 0, p1Top + pH);
    g1.addColorStop(0, '#00C853');
    g1.addColorStop(0.5, '#69F0AE');
    g1.addColorStop(1, '#00C853');
    ctx.fillStyle = g1;
    ctx.beginPath();
    (ctx as any).roundRect(leftX, p1Top, pW, pH, 4);
    ctx.fill();
    ctx.restore();

    // P2 paddle — neon cyan
    const p2Top = (s.p2Y / 100) * H - pH / 2;
    ctx.save();
    ctx.shadowColor = '#00E5FF';
    ctx.shadowBlur = 18;
    const g2 = ctx.createLinearGradient(0, p2Top, 0, p2Top + pH);
    g2.addColorStop(0, '#0091EA');
    g2.addColorStop(0.5, '#80D8FF');
    g2.addColorStop(1, '#0091EA');
    ctx.fillStyle = g2;
    ctx.beginPath();
    (ctx as any).roundRect(rightX, p2Top, pW, pH, 4);
    ctx.fill();
    ctx.restore();

    // Ball
    const bX = (s.ball.x / 100) * W;
    const bY = (s.ball.y / 100) * H;
    const bR = Math.max(4, (s.ball.radius / 100) * Math.min(W, H));

    ctx.save();
    ctx.shadowColor = '#FFFFFF';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(bX, bY, bR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
