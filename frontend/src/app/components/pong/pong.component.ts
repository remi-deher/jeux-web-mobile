import { Component, computed, inject, ViewChild, ElementRef, AfterViewInit, OnDestroy, effect } from '@angular/core';
import { GameService } from '../../services/game.service';
import { GameLayoutComponent } from '../game-layout/game-layout.component';
import { FloatingEmojisComponent } from '../floating-emojis/floating-emojis.component';
import { injectGameSession } from '../../services/game-session.helper';

// ── Particle ──────────────────────────────────────────────────────────────────
interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number;   // 0→1 (1 = just born, 0 = dead)
  color: string;
  radius: number;
}

// ── Ball trail entry ──────────────────────────────────────────────────────────
interface TrailPoint { x: number; y: number; }

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
      transition: box-shadow 0.05s linear;
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

  room                   = this.session.room;
  isPlaying              = this.session.isPlaying;
  floatingEmojis         = this.session.floatingEmojis;
  disconnectedPlayerName = this.session.disconnectedPlayerName;
  hasVotedRematch        = this.session.hasVotedRematch;
  player1Name            = this.session.player1Name;
  player2Name            = this.session.player2Name;
  leaveRoom              = this.session.leaveRoom;
  shareInvitationLink    = this.session.shareInvitationLink;
  requestRematch         = this.session.requestRematch;
  forceEnd               = this.session.forceEnd;
  sendEmoji              = this.session.sendEmoji;

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
  private visibilityHandler = () => {
    if (document.hidden) {
      if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    } else if (this.rafId === null) {
      const resume = () => { this.tickInterpolation(); this.drawFrame(); this.rafId = requestAnimationFrame(resume); };
      this.rafId = requestAnimationFrame(resume);
    }
  };

  // ── Server state ────────────────────────────────────────────────────────────
  private lastState: any = null;
  private serverP1Y      = 50;
  private serverP2Y      = 50;

  // ── Ball interpolation ──────────────────────────────────────────────────────
  private readonly TICK_MS = 1000 / 30;
  private prevBall    = { x: 50, y: 50, vx: 0, vy: 0 };
  private targetBall  = { x: 50, y: 50, vx: 0, vy: 0 };
  private lastUpdateAt = 0;
  private renderedBall = { x: 50, y: 50 };

  // ── Opponent paddle smoothing ───────────────────────────────────────────────
  private smoothOppY = 50;

  // ── Client-side prediction ──────────────────────────────────────────────────
  private localP1Y = 50;
  private localP2Y = 50;

  // ── Keyboard state ──────────────────────────────────────────────────────────
  private keysDown = new Set<string>();
  private p1KeyY   = 50;
  private p2KeyY   = 50;
  private keyboardInterval: ReturnType<typeof setInterval> | null = null;
  private keydownHandler!: (e: KeyboardEvent) => void;
  private keyupHandler!:   (e: KeyboardEvent) => void;

  // ── Visual effects ──────────────────────────────────────────────────────────

  // Ball trail — ring buffer
  private readonly TRAIL_LEN = 12;
  private trail: TrailPoint[] = [];

  // Particles
  private particles: Particle[] = [];

  // Score flash: 1.0 → 0 over ~45 frames
  private scoreFlash = { p1: 0, p2: 0 };

  // Paddle flash: 1.0 → 0 over ~20 frames
  private paddleFlash = { p1: 0, p2: 0 };

  // Wall flash: 1.0 → 0 over ~15 frames
  private wallFlash = { top: 0, bottom: 0 };

  // Track lastHit to detect changes
  private prevLastHit: string | null = null;

  // Track scores to detect changes
  private prevScoreP1 = 0;
  private prevScoreP2 = 0;

  constructor() {
    effect(() => {
      const state = this.room()?.gameState as any;
      if (!state) return;

      const now     = performance.now();
      const isLocal = this.room()?.isLocal ?? false;
      const myNum   = this.myPlayerNum();

      // ── Ball buffer shift ─────────────────────────────────────────────────
      if (!this.lastUpdateAt) {
        this.prevBall     = { x: state.ball.x, y: state.ball.y, vx: state.ball.vx ?? 0, vy: state.ball.vy ?? 0 };
        this.targetBall   = { ...this.prevBall };
        this.renderedBall = { x: state.ball.x, y: state.ball.y };
      } else {
        this.prevBall   = { ...this.renderedBall, vx: this.targetBall.vx, vy: this.targetBall.vy };
        this.targetBall = { x: state.ball.x, y: state.ball.y, vx: state.ball.vx ?? 0, vy: state.ball.vy ?? 0 };
      }
      this.lastUpdateAt = now;

      // ── Paddle positions ──────────────────────────────────────────────────
      this.serverP1Y = state.p1Y ?? 50;
      this.serverP2Y = state.p2Y ?? 50;

      if (isLocal) {
        this.p1KeyY = this.serverP1Y;
        this.p2KeyY = this.serverP2Y;
      } else {
        if (myNum === 1) this.reconcile(this.localP1Y, this.serverP1Y, v => { this.localP1Y = v; });
        if (myNum === 2) this.reconcile(this.localP2Y, this.serverP2Y, v => { this.localP2Y = v; });
      }

      // ── Detect lastHit changes → spawn effects ────────────────────────────
      const lh = state.lastHit as string | null;
      if (lh && lh !== this.prevLastHit) {
        this.onHit(lh, state);
      }
      this.prevLastHit = lh;

      // ── Detect score changes → score flash ────────────────────────────────
      if (state.scoreP1 !== this.prevScoreP1) { this.scoreFlash.p1 = 1.0; this.prevScoreP1 = state.scoreP1; }
      if (state.scoreP2 !== this.prevScoreP2) { this.scoreFlash.p2 = 1.0; this.prevScoreP2 = state.scoreP2; }

      this.lastState = state;
    });
  }

  /** Spawn particles and flash effects when a hit is detected. */
  private onHit(hit: string, state: any) {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const W = canvas.width;
    const H = canvas.height;
    const bX = (state.ball.x / 100) * W;
    const bY = (state.ball.y / 100) * H;

    if (hit === 'p1') {
      this.paddleFlash.p1 = 1.0;
      this.spawnParticles(bX, bY, '#00E676', 12);
    } else if (hit === 'p2') {
      this.paddleFlash.p2 = 1.0;
      this.spawnParticles(bX, bY, '#00E5FF', 12);
    } else if (hit === 'wall_top') {
      this.wallFlash.top = 1.0;
      this.spawnParticles(bX, bY, 'rgba(255,255,255,0.9)', 6);
    } else if (hit === 'wall_bottom') {
      this.wallFlash.bottom = 1.0;
      this.spawnParticles(bX, bY, 'rgba(255,255,255,0.9)', 6);
    }
  }

  private spawnParticles(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3.5;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        color,
        radius: 1.5 + Math.random() * 2.5,
      });
    }
    // Prune old particles to cap array size
    if (this.particles.length > 200) this.particles.splice(0, this.particles.length - 200);
  }

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

    canvas.addEventListener('touchmove',  (e: TouchEvent) => { e.preventDefault(); this.handleTouches(e.touches); }, { passive: false });
    canvas.addEventListener('touchstart', (e: TouchEvent) => { e.preventDefault(); this.handleTouches(e.touches); }, { passive: false });

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

    const loop = () => {
      this.tickInterpolation();
      this.drawFrame();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);

    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  ngOnDestroy() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.resizeObserver?.disconnect();
    if (this.keyboardInterval) clearInterval(this.keyboardInterval);
    document.removeEventListener('keydown', this.keydownHandler);
    document.removeEventListener('keyup',   this.keyupHandler);
    document.removeEventListener('visibilitychange', this.visibilityHandler);
  }

  // ── Input helpers ───────────────────────────────────────────────────────────

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

  // ── Interpolation tick ──────────────────────────────────────────────────────

  private tickInterpolation() {
    if (!this.lastUpdateAt) return;

    const elapsed = performance.now() - this.lastUpdateAt;
    const t       = elapsed / this.TICK_MS;

    if (t <= 1) {
      this.renderedBall.x = this.lerp(this.prevBall.x, this.targetBall.x, t);
      this.renderedBall.y = this.lerp(this.prevBall.y, this.targetBall.y, t);
    } else {
      const over = Math.min(t - 1, 1);
      this.renderedBall.x = Math.max(0, Math.min(100, this.targetBall.x + this.targetBall.vx * over));
      this.renderedBall.y = Math.max(0, Math.min(100, this.targetBall.y + this.targetBall.vy * over));
    }

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

    // ── Resolve paddle positions ──────────────────────────────────────────────
    let p1Y: number, p2Y: number;
    if (isLocal) {
      p1Y = this.serverP1Y; p2Y = this.serverP2Y;
    } else if (myNum === 1) {
      p1Y = this.localP1Y; p2Y = this.smoothOppY;
    } else if (myNum === 2) {
      p1Y = this.smoothOppY; p2Y = this.localP2Y;
    } else {
      p1Y = this.serverP1Y; p2Y = this.serverP2Y;
    }

    // ── Ball pixel coords ─────────────────────────────────────────────────────
    const bX = (this.renderedBall.x / 100) * W;
    const bY = (this.renderedBall.y / 100) * H;
    const bR = Math.max(4, (s.ball.radius / 100) * Math.min(W, H));

    // ── Speed (used for glow intensity) ───────────────────────────────────────
    const speed    = Math.sqrt(this.targetBall.vx ** 2 + this.targetBall.vy ** 2);
    const maxSpeed = 3.2 * Math.SQRT2;
    const speedT   = Math.min(speed / maxSpeed, 1); // 0 → 1

    // ── Update decay timers ───────────────────────────────────────────────────
    const SCORE_DECAY  = 1 / 55;
    const PADDLE_DECAY = 1 / 20;
    const WALL_DECAY   = 1 / 15;
    this.scoreFlash.p1  = Math.max(0, this.scoreFlash.p1  - SCORE_DECAY);
    this.scoreFlash.p2  = Math.max(0, this.scoreFlash.p2  - SCORE_DECAY);
    this.paddleFlash.p1 = Math.max(0, this.paddleFlash.p1 - PADDLE_DECAY);
    this.paddleFlash.p2 = Math.max(0, this.paddleFlash.p2 - PADDLE_DECAY);
    this.wallFlash.top    = Math.max(0, this.wallFlash.top    - WALL_DECAY);
    this.wallFlash.bottom = Math.max(0, this.wallFlash.bottom - WALL_DECAY);

    // ── Update particles ──────────────────────────────────────────────────────
    const PARTICLE_DECAY = 1 / 30;
    this.particles = this.particles.filter(p => {
      p.x   += p.vx;
      p.y   += p.vy;
      p.vx  *= 0.92;
      p.vy  *= 0.92;
      p.life -= PARTICLE_DECAY;
      return p.life > 0;
    });

    // ── Update ball trail ─────────────────────────────────────────────────────
    this.trail.push({ x: bX, y: bY });
    if (this.trail.length > this.TRAIL_LEN) this.trail.shift();

    // ── Dynamic canvas glow based on ball x position ──────────────────────────
    const ballXt = bX / W; // 0 (left) → 1 (right)
    // Lerp between green (p1 side) and cyan (p2 side)
    const gr = Math.round(this.lerp(0, 0,   ballXt));
    const gg = Math.round(this.lerp(230, 229, ballXt));
    const gb = Math.round(this.lerp(118, 255, ballXt));
    const glowR = 20 + speedT * 40;
    canvas.style.boxShadow = [
      '0 0 0 1px rgba(255,255,255,0.05)',
      `0 0 ${glowR}px rgba(${gr},${gg},${gb},${0.3 + speedT * 0.4})`,
      `0 0 ${glowR * 2}px rgba(${gr},${gg},${gb},${0.08 + speedT * 0.12})`,
    ].join(', ');

    // ── Background ─────────────────────────────────────────────────────────────
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, W, H);

    // Subtle grid
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    ctx.lineWidth = 1;
    const gridSize = Math.floor(H / 10);
    for (let gx = 0; gx < W; gx += gridSize) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
    }
    for (let gy = 0; gy < H; gy += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
    }
    ctx.restore();

    // Half-court tint (local mode)
    if (isLocal) {
      ctx.fillStyle = 'rgba(0,230,118,0.025)';
      ctx.fillRect(0, 0, W / 2, H);
      ctx.fillStyle = 'rgba(0,229,255,0.025)';
      ctx.fillRect(W / 2, 0, W / 2, H);
    }

    // Wall flash — top
    if (this.wallFlash.top > 0) {
      const grad = ctx.createLinearGradient(0, 0, 0, H * 0.15);
      grad.addColorStop(0, `rgba(255,255,255,${this.wallFlash.top * 0.25})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H * 0.15);
    }
    // Wall flash — bottom
    if (this.wallFlash.bottom > 0) {
      const grad = ctx.createLinearGradient(0, H, 0, H * 0.85);
      grad.addColorStop(0, `rgba(255,255,255,${this.wallFlash.bottom * 0.25})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, H * 0.85, W, H * 0.15);
    }

    // Vignette
    const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.85);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // ── Center dashed divider ─────────────────────────────────────────────────
    ctx.save();
    ctx.setLineDash([H / 28, H / 28]);
    ctx.strokeStyle = isLocal ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)';
    ctx.lineWidth   = isLocal ? 3 : 2;
    ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
    ctx.restore();

    // ── Player names ──────────────────────────────────────────────────────────
    const nameSize = Math.max(10, Math.floor(H * 0.055));
    ctx.font      = `600 ${nameSize}px 'Inter', sans-serif`;
    ctx.textBaseline = 'top';
    // P1 name — green
    ctx.fillStyle = 'rgba(0,230,118,0.55)';
    ctx.textAlign = 'left';
    ctx.fillText(this.player1Name(), W * 0.03, H * 0.04);
    // P2 name — cyan
    ctx.fillStyle = 'rgba(0,229,255,0.55)';
    ctx.textAlign = 'right';
    ctx.fillText(this.player2Name(), W * 0.97, H * 0.04);

    // ── Scores ────────────────────────────────────────────────────────────────
    const baseScoreSize = Math.floor(H * 0.13);
    const scoreY = H * 0.04 + nameSize + 4;

    // P1 score
    const sf1 = this.scoreFlash.p1;
    const scoreSz1 = baseScoreSize + Math.round(sf1 * baseScoreSize * 0.6);
    ctx.font      = `bold ${scoreSz1}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = sf1 > 0
      ? `rgba(0,230,118,${0.5 + sf1 * 0.5})`
      : 'rgba(255,255,255,0.25)';
    ctx.fillText(String(s.scoreP1 ?? 0), W * 0.25, scoreY);

    // P2 score
    const sf2 = this.scoreFlash.p2;
    const scoreSz2 = baseScoreSize + Math.round(sf2 * baseScoreSize * 0.6);
    ctx.font      = `bold ${scoreSz2}px 'Courier New', monospace`;
    ctx.fillStyle = sf2 > 0
      ? `rgba(0,229,255,${0.5 + sf2 * 0.5})`
      : 'rgba(255,255,255,0.25)';
    ctx.fillText(String(s.scoreP2 ?? 0), W * 0.75, scoreY);

    // ── Serving countdown overlay ─────────────────────────────────────────────
    if (s.serving) {
      const secs = Math.ceil(s.serveCountdown / 30);
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 200);
      ctx.save();
      ctx.font      = `bold ${Math.floor(H * 0.09)}px 'Courier New', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor  = '#FFFFFF';
      ctx.shadowBlur   = 20;
      ctx.fillStyle    = `rgba(255,255,255,${0.4 + pulse * 0.4})`;
      ctx.fillText(secs > 0 ? String(secs) : '▶', W / 2, H / 2);
      ctx.restore();
    }

    // ── Local mode keyboard hints ─────────────────────────────────────────────
    if (isLocal) {
      ctx.font         = `${Math.max(9, Math.floor(H * 0.048))}px 'Inter', sans-serif`;
      ctx.textBaseline = 'bottom';
      ctx.fillStyle    = 'rgba(0,230,118,0.4)';
      ctx.textAlign    = 'left';
      ctx.fillText('W / S', W * 0.03, H - 8);
      ctx.fillStyle    = 'rgba(0,229,255,0.4)';
      ctx.textAlign    = 'right';
      ctx.fillText('↑ / ↓', W * 0.97, H - 8);
    }

    // ── Ball trail ────────────────────────────────────────────────────────────
    if (this.trail.length > 1 && !s.serving) {
      for (let i = 0; i < this.trail.length; i++) {
        const frac = i / this.trail.length; // 0 = oldest, 1 = newest
        const alpha = frac * frac * 0.5;    // quadratic fade
        const r = bR * frac * 0.85;
        if (r < 0.5) continue;
        ctx.beginPath();
        ctx.arc(this.trail[i].x, this.trail[i].y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fill();
      }
    }

    // ── Particles ─────────────────────────────────────────────────────────────
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * p.life, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.restore();
    }

    // ── Paddles ───────────────────────────────────────────────────────────────
    const pH   = (s.paddleHeight / 100) * H;
    const pW   = Math.max(6, (s.paddleWidth / 100) * W);
    const leftX  = W * 0.025;
    const rightX = W * 0.975 - pW;

    // P1 — neon green (with paddle-flash white pulse)
    const p1Top = (p1Y / 100) * H - pH / 2;
    ctx.save();
    const pf1 = this.paddleFlash.p1;
    ctx.shadowColor = pf1 > 0
      ? `rgba(255,255,255,${pf1})`
      : '#00E676';
    ctx.shadowBlur  = 18 + pf1 * 30;
    const g1 = ctx.createLinearGradient(0, p1Top, 0, p1Top + pH);
    const p1Bright = pf1 > 0 ? `rgba(255,255,255,${pf1})` : '#69F0AE';
    g1.addColorStop(0,   '#00C853');
    g1.addColorStop(0.5, p1Bright);
    g1.addColorStop(1,   '#00C853');
    ctx.fillStyle = g1;
    ctx.beginPath();
    (ctx as any).roundRect(leftX, p1Top, pW, pH, 4);
    ctx.fill();
    ctx.restore();

    // P2 — neon cyan (with paddle-flash white pulse)
    const p2Top = (p2Y / 100) * H - pH / 2;
    ctx.save();
    const pf2 = this.paddleFlash.p2;
    ctx.shadowColor = pf2 > 0
      ? `rgba(255,255,255,${pf2})`
      : '#00E5FF';
    ctx.shadowBlur  = 18 + pf2 * 30;
    const g2 = ctx.createLinearGradient(0, p2Top, 0, p2Top + pH);
    const p2Bright = pf2 > 0 ? `rgba(255,255,255,${pf2})` : '#80D8FF';
    g2.addColorStop(0,   '#0091EA');
    g2.addColorStop(0.5, p2Bright);
    g2.addColorStop(1,   '#0091EA');
    ctx.fillStyle = g2;
    ctx.beginPath();
    (ctx as any).roundRect(rightX, p2Top, pW, pH, 4);
    ctx.fill();
    ctx.restore();

    // ── Ball ──────────────────────────────────────────────────────────────────
    if (!s.serving) {
      // Glow intensity scales with speed
      const glowBase  = 20;
      const glowExtra = speedT * 30;
      ctx.save();
      ctx.shadowColor = `rgba(255,255,255,${0.7 + speedT * 0.3})`;
      ctx.shadowBlur  = glowBase + glowExtra;
      ctx.fillStyle   = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(bX, bY, bR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
