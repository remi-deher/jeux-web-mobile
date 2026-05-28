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
          <div class="waiting-overlay">En attente de l'adversaire...</div>
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
        0 0 0 1px rgba(255,255,255,0.05),
        0 0 30px rgba(0,230,118,0.15),
        0 0 60px rgba(0,230,118,0.05);
    }

    .waiting-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.6);
      border-radius: 12px;
      color: rgba(255,255,255,0.7);
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
    'Local PC — J1 : touches W / S  |  J2 : flèches ↑ / ↓',
    'Local Mobile — posez le doigt sur votre moitié du terrain et faites glisser.'
  ];

  room                 = this.session.room;
  isPlaying            = this.session.isPlaying;
  floatingEmojis       = this.session.floatingEmojis;
  disconnectedPlayerName = this.session.disconnectedPlayerName;
  hasVotedRematch      = this.session.hasVotedRematch;
  player1Name          = this.session.player1Name;
  player2Name          = this.session.player2Name;
  leaveRoom            = this.session.leaveRoom;
  shareInvitationLink  = this.session.shareInvitationLink;
  requestRematch       = this.session.requestRematch;
  forceEnd             = this.session.forceEnd;
  sendEmoji            = this.session.sendEmoji;

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
    return winner !== null && winner !== undefined && winner === this.myPlayerNum();
  });

  isLoser = computed(() => {
    const winner = this.room()?.gameState?.winner;
    return winner !== null && winner !== undefined && winner !== this.myPlayerNum();
  });

  // ── Canvas & render loop ────────────────────────────────────────────────────
  private resizeObserver: ResizeObserver | null = null;
  private rafId: number | null = null;

  // ── Server-authoritative snapshot ──────────────────────────────────────────
  private lastState: any  = null;
  private serverP1Y       = 50;
  private serverP2Y       = 50;

  // ── Ball interpolation ──────────────────────────────────────────────────────
  // Server ticks at ~30 Hz. We keep two snapshots and interpolate between them
  // on every rAF frame (60 fps), then extrapolate using velocity if the next
  // packet hasn't arrived yet.
  private readonly TICK_MS = 1000 / 30;

  private prevBall    = { x: 50, y: 50, vx: 0, vy: 0 };  // ball at prev tick
  private targetBall  = { x: 50, y: 50, vx: 0, vy: 0 };  // ball at latest tick
  private lastUpdateAt = 0;                                 // performance.now() of last update

  // Current interpolated/extrapolated ball position (what gets drawn)
  private renderedBall = { x: 50, y: 50 };

  // ── Opponent paddle smoothing ───────────────────────────────────────────────
  // Lerp toward server value each frame to hide 30 Hz granularity.
  private smoothOppY = 50;

  // ── Client-side prediction ──────────────────────────────────────────────────
  // In online mode the local player's paddle is updated immediately on every
  // input event; we don't wait for the server round-trip.
  // Soft-reconciled back to server truth on each pongUpdate.
  private localP1Y = 50;
  private localP2Y = 50;

  // ── Keyboard state (local mode) ─────────────────────────────────────────────
  private keysDown = new Set<string>();
  private p1KeyY   = 50;   // keyboard position trackers used for sending to server
  private p2KeyY   = 50;
  private keyboardInterval: ReturnType<typeof setInterval> | null = null;
  private keydownHandler!: (e: KeyboardEvent) => void;
  private keyupHandler!:   (e: KeyboardEvent) => void;

  constructor() {
    effect(() => {
      const state = this.room()?.gameState as any;
      if (!state) return;

      const now     = performance.now();
      const isLocal = this.room()?.isLocal ?? false;
      const myNum   = this.myPlayerNum();

      // ── Ball buffer shift ─────────────────────────────────────────────────
      // On the very first update, snap both snapshots so we don't interpolate
      // from the 50/50 default.
      if (!this.lastUpdateAt) {
        this.prevBall  = { x: state.ball.x, y: state.ball.y, vx: state.ball.vx ?? 0, vy: state.ball.vy ?? 0 };
        this.targetBall = { ...this.prevBall };
        this.renderedBall = { x: state.ball.x, y: state.ball.y };
      } else {
        // Shift: current rendered position becomes the new "from", fresh server
        // data becomes the new "to".
        this.prevBall   = { ...this.renderedBall, vx: this.targetBall.vx, vy: this.targetBall.vy };
        this.targetBall = {
          x:  state.ball.x,
          y:  state.ball.y,
          vx: state.ball.vx ?? 0,
          vy: state.ball.vy ?? 0,
        };
      }
      this.lastUpdateAt = now;

      // ── Server paddle positions ───────────────────────────────────────────
      this.serverP1Y = state.p1Y ?? 50;
      this.serverP2Y = state.p2Y ?? 50;

      if (isLocal) {
        // Local: no network delay → keep keyboard trackers calibrated with
        // server (handles resets/rematches cleanly).
        this.p1KeyY = this.serverP1Y;
        this.p2KeyY = this.serverP2Y;
      } else {
        // Online: soft-reconcile own paddle with server truth.
        if (myNum === 1) this.reconcile(this.localP1Y, this.serverP1Y, v => { this.localP1Y = v; });
        if (myNum === 2) this.reconcile(this.localP2Y, this.serverP2Y, v => { this.localP2Y = v; });
      }

      this.lastState = state;
    });
  }

  /**
   * Soft-reconcile a client-predicted paddle value against the server truth.
   *
   * • diff < 1    → prediction is accurate, leave it untouched (prevents jitter).
   * • 1 ≤ diff ≤ 15 → blend 50/50 (smooth invisible correction).
   * • diff > 15   → hard snap (unexpected teleport / rematch reset).
   */
  private reconcile(local: number, server: number, set: (v: number) => void) {
    const diff = Math.abs(local - server);
    if (diff < 1)  return;
    if (diff > 15) { set(server); return; }
    set(local * 0.5 + server * 0.5);
  }

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    const parent = canvas.parentElement!;

    this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
    this.resizeObserver.observe(parent);
    this.resizeCanvas();

    // ── Touch ────────────────────────────────────────────────────────────────
    canvas.addEventListener('touchmove',  (e: TouchEvent) => { e.preventDefault(); this.handleTouches(e.touches); }, { passive: false });
    canvas.addEventListener('touchstart', (e: TouchEvent) => { e.preventDefault(); this.handleTouches(e.touches); }, { passive: false });

    // ── Mouse ────────────────────────────────────────────────────────────────
    canvas.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isPlaying()) return;
      const rect = canvas.getBoundingClientRect();
      const yPct = ((e.clientY - rect.top)  / rect.height) * 100;
      const r    = this.room();
      if (r?.isLocal) {
        const xPct   = ((e.clientX - rect.left) / rect.width) * 100;
        const paddle = xPct < 50 ? 1 : 2;
        this.applyInput(yPct, paddle as 1 | 2);
      } else {
        const myNum = this.myPlayerNum();
        if (myNum) this.applyInput(yPct, myNum as 1 | 2);
      }
    }, { passive: true });

    // ── Keyboard ─────────────────────────────────────────────────────────────
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (['w', 'W', 's', 'S', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        this.keysDown.add(e.key);
      }
    };
    this.keyupHandler = (e: KeyboardEvent) => this.keysDown.delete(e.key);
    document.addEventListener('keydown', this.keydownHandler);
    document.addEventListener('keyup',   this.keyupHandler);
    this.keyboardInterval = setInterval(() => this.tickKeyboard(), 1000 / 30);

    // ── 60 fps render loop ───────────────────────────────────────────────────
    const loop = () => {
      this.tickInterpolation();
      this.drawFrame();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  ngOnDestroy() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.resizeObserver?.disconnect();
    if (this.keyboardInterval) clearInterval(this.keyboardInterval);
    document.removeEventListener('keydown', this.keydownHandler);
    document.removeEventListener('keyup',   this.keyupHandler);
  }

  // ── Input helpers ───────────────────────────────────────────────────────────

  /**
   * Central input dispatcher.
   * Local mode  → updates keyboard trackers + sends with paddleIndex.
   * Online mode → updates local prediction + sends without paddleIndex
   *               (server identifies the paddle from socket ID).
   */
  private applyInput(yPct: number, paddle: 1 | 2) {
    const y = Math.max(9, Math.min(91, yPct));
    const r = this.room();
    if (r?.isLocal) {
      if (paddle === 1) this.p1KeyY = y; else this.p2KeyY = y;
      this.gameService.sendPongPaddle(y, paddle);
    } else {
      if (paddle === 1) this.localP1Y = y; else this.localP2Y = y;
      this.gameService.sendPongPaddle(y);
    }
  }

  private handleTouches(touches: TouchList) {
    if (!this.isPlaying()) return;
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const r    = this.room();

    if (r?.isLocal) {
      // Each finger independently controls the paddle on its half of the court.
      Array.from(touches).forEach(t => {
        const xPct   = ((t.clientX - rect.left) / rect.width)  * 100;
        const yPct   = ((t.clientY - rect.top)  / rect.height) * 100;
        const paddle = xPct < 50 ? 1 : 2;
        this.applyInput(yPct, paddle as 1 | 2);
      });
    } else {
      const myNum = this.myPlayerNum();
      if (!myNum) return;
      const t    = touches[0];
      const yPct = ((t.clientY - rect.top) / rect.height) * 100;
      this.applyInput(yPct, myNum as 1 | 2);
    }
  }

  private tickKeyboard() {
    if (!this.isPlaying()) return;
    const r     = this.room();
    const speed = 3.5;

    if (r?.isLocal) {
      let c1 = false, c2 = false;
      if (this.keysDown.has('w') || this.keysDown.has('W')) { this.p1KeyY = Math.max(9,  this.p1KeyY - speed); c1 = true; }
      if (this.keysDown.has('s') || this.keysDown.has('S')) { this.p1KeyY = Math.min(91, this.p1KeyY + speed); c1 = true; }
      if (this.keysDown.has('ArrowUp'))                     { this.p2KeyY = Math.max(9,  this.p2KeyY - speed); c2 = true; }
      if (this.keysDown.has('ArrowDown'))                   { this.p2KeyY = Math.min(91, this.p2KeyY + speed); c2 = true; }
      if (c1) this.gameService.sendPongPaddle(this.p1KeyY, 1);
      if (c2) this.gameService.sendPongPaddle(this.p2KeyY, 2);
    } else {
      // Online: W/S or arrows both control own paddle
      const myNum = this.myPlayerNum();
      if (!myNum) return;
      const up   = this.keysDown.has('w') || this.keysDown.has('W') || this.keysDown.has('ArrowUp');
      const down = this.keysDown.has('s') || this.keysDown.has('S') || this.keysDown.has('ArrowDown');
      if (!up && !down) return;
      if (myNum === 1) {
        if (up)   this.localP1Y = Math.max(9,  this.localP1Y - speed);
        if (down) this.localP1Y = Math.min(91, this.localP1Y + speed);
        this.gameService.sendPongPaddle(this.localP1Y);
      } else {
        if (up)   this.localP2Y = Math.max(9,  this.localP2Y - speed);
        if (down) this.localP2Y = Math.min(91, this.localP2Y + speed);
        this.gameService.sendPongPaddle(this.localP2Y);
      }
    }
  }

  // ── Interpolation tick (runs every rAF frame) ───────────────────────────────

  private tickInterpolation() {
    if (!this.lastUpdateAt) return;

    const elapsed = performance.now() - this.lastUpdateAt;
    const t       = elapsed / this.TICK_MS;   // 0 = just received, 1 = one tick later

    if (t <= 1) {
      // Interpolate: smoothly advance from prev snapshot to target snapshot.
      this.renderedBall.x = this.lerp(this.prevBall.x, this.targetBall.x, t);
      this.renderedBall.y = this.lerp(this.prevBall.y, this.targetBall.y, t);
    } else {
      // Extrapolate: next packet is late — dead-reckon using target velocity.
      // Cap at 1 extra tick to avoid wild prediction on sustained packet loss.
      const over = Math.min(t - 1, 1);
      this.renderedBall.x = Math.max(0, Math.min(100, this.targetBall.x + this.targetBall.vx * over));
      this.renderedBall.y = Math.max(0, Math.min(100, this.targetBall.y + this.targetBall.vy * over));
    }

    // Smooth opponent paddle: lerp ~25 % per frame ≈ 8 frames to converge at 60 fps.
    const isLocal = this.room()?.isLocal ?? false;
    const myNum   = this.myPlayerNum();
    if (!isLocal && myNum) {
      const serverOppY = myNum === 1 ? this.serverP2Y : this.serverP1Y;
      this.smoothOppY  = this.lerp(this.smoothOppY, serverOppY, 0.25);
    }
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  // ── Canvas resize ───────────────────────────────────────────────────────────

  private resizeCanvas() {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const availW = parent.clientWidth  - 16;
    const availH = parent.clientHeight - 16;
    const aspect = 1.65;

    let w = availW;
    let h = w / aspect;
    if (h > availH) { h = availH; w = h * aspect; }

    canvas.width  = Math.floor(w);
    canvas.height = Math.floor(h);
  }

  // ── Draw ────────────────────────────────────────────────────────────────────

  private drawFrame() {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas || !this.lastState) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const s = this.lastState;

    const isLocal = this.room()?.isLocal ?? false;
    const myNum   = this.myPlayerNum();

    // ── Select which Y values to render for each paddle ─────────────────────
    //
    // Local mode   → server is fully authoritative (zero network latency).
    // Online P1    → own paddle = localP1Y (client-predicted, instant response)
    //                opp paddle = smoothOppY (lerped server value, no jitter)
    // Online P2    → mirror of above
    // Spectator    → raw server values
    //
    let p1Y: number;
    let p2Y: number;
    if (isLocal) {
      p1Y = this.serverP1Y;
      p2Y = this.serverP2Y;
    } else if (myNum === 1) {
      p1Y = this.localP1Y;
      p2Y = this.smoothOppY;
    } else if (myNum === 2) {
      p1Y = this.smoothOppY;
      p2Y = this.localP2Y;
    } else {
      p1Y = this.serverP1Y;
      p2Y = this.serverP2Y;
    }

    // ── Background ───────────────────────────────────────────────────────────
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, W, H);

    if (isLocal) {
      ctx.fillStyle = 'rgba(0,230,118,0.025)';
      ctx.fillRect(0, 0, W / 2, H);
      ctx.fillStyle = 'rgba(0,229,255,0.025)';
      ctx.fillRect(W / 2, 0, W / 2, H);
    }

    // ── Center dashed divider ────────────────────────────────────────────────
    ctx.save();
    ctx.setLineDash([H / 28, H / 28]);
    ctx.strokeStyle = isLocal ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)';
    ctx.lineWidth   = isLocal ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
    ctx.restore();

    // ── Scores ───────────────────────────────────────────────────────────────
    ctx.font         = `bold ${Math.floor(H * 0.13)}px 'Courier New', monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle    = 'rgba(255,255,255,0.25)';
    ctx.fillText(String(s.scoreP1 ?? 0), W * 0.25, H * 0.05);
    ctx.fillText(String(s.scoreP2 ?? 0), W * 0.75, H * 0.05);

    // ── Local player labels ──────────────────────────────────────────────────
    if (isLocal) {
      ctx.font         = `${Math.max(10, Math.floor(H * 0.055))}px 'Inter', sans-serif`;
      ctx.textBaseline = 'bottom';
      ctx.fillStyle    = 'rgba(0,230,118,0.5)';
      ctx.textAlign    = 'left';
      ctx.fillText(`${this.player1Name()} · W/S`, W * 0.03, H - 8);
      ctx.fillStyle    = 'rgba(0,229,255,0.5)';
      ctx.textAlign    = 'right';
      ctx.fillText(`${this.player2Name()} · ↑/↓`, W * 0.97, H - 8);
    }

    // ── Paddles ──────────────────────────────────────────────────────────────
    const pH   = (s.paddleHeight / 100) * H;
    const pW   = Math.max(6, (s.paddleWidth / 100) * W);
    const leftX  = W * 0.025;
    const rightX = W * 0.975 - pW;

    // P1 — neon green
    const p1Top = (p1Y / 100) * H - pH / 2;
    ctx.save();
    ctx.shadowColor = '#00E676';
    ctx.shadowBlur  = 18;
    const g1 = ctx.createLinearGradient(0, p1Top, 0, p1Top + pH);
    g1.addColorStop(0,   '#00C853');
    g1.addColorStop(0.5, '#69F0AE');
    g1.addColorStop(1,   '#00C853');
    ctx.fillStyle = g1;
    ctx.beginPath();
    (ctx as any).roundRect(leftX, p1Top, pW, pH, 4);
    ctx.fill();
    ctx.restore();

    // P2 — neon cyan
    const p2Top = (p2Y / 100) * H - pH / 2;
    ctx.save();
    ctx.shadowColor = '#00E5FF';
    ctx.shadowBlur  = 18;
    const g2 = ctx.createLinearGradient(0, p2Top, 0, p2Top + pH);
    g2.addColorStop(0,   '#0091EA');
    g2.addColorStop(0.5, '#80D8FF');
    g2.addColorStop(1,   '#0091EA');
    ctx.fillStyle = g2;
    ctx.beginPath();
    (ctx as any).roundRect(rightX, p2Top, pW, pH, 4);
    ctx.fill();
    ctx.restore();

    // ── Ball (interpolated / extrapolated position) ───────────────────────────
    const bX = (this.renderedBall.x / 100) * W;
    const bY = (this.renderedBall.y / 100) * H;
    const bR = Math.max(4, (s.ball.radius / 100) * Math.min(W, H));

    ctx.save();
    ctx.shadowColor = '#FFFFFF';
    ctx.shadowBlur  = 24;
    ctx.fillStyle   = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(bX, bY, bR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
