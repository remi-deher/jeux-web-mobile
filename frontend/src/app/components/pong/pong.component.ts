import { Component, computed, inject, ViewChild, ElementRef, AfterViewInit, OnDestroy, effect } from '@angular/core';
import { GameService } from '../../services/game.service';
import { GameLayoutComponent } from '../game-layout/game-layout.component';
import { FloatingEmojisComponent } from '../floating-emojis/floating-emojis.component';
import { injectGameSession } from '../../services/game-session.helper';
import { SimPongState, cloneServerState, stepPong } from './pong-physics';
import { PongWebRTC, RtcStatus } from './pong-webrtc';

// ── Visual helpers ─────────────────────────────────────────────────────────────
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; radius: number; }
interface TrailPt   { x: number; y: number; }

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
        @if (rtcStatus !== 'idle' && rtcStatus !== 'connected') {
          <div class="rtc-badge" [class.rtc-failed]="rtcStatus === 'failed'">
            {{ rtcStatus === 'connecting' ? '⚡ P2P…' : '☁ socket.io' }}
          </div>
        }
        @if (!isPlaying() && room()?.status !== 'finished') {
          <div class="waiting-overlay">En attente de l'adversaire…</div>
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

    .rtc-badge {
      position: absolute;
      top: 12px;
      right: 12px;
      padding: 3px 8px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      background: rgba(0,230,118,0.15);
      color: rgba(0,230,118,0.8);
      border: 1px solid rgba(0,230,118,0.3);
      pointer-events: none;
    }

    .rtc-badge.rtc-failed {
      background: rgba(255,80,80,0.1);
      color: rgba(255,120,120,0.8);
      border-color: rgba(255,80,80,0.2);
    }
  `]
})
export class PongComponent implements AfterViewInit, OnDestroy {
  @ViewChild('pongCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private gameService = inject(GameService);
  private session = injectGameSession('pong');

  readonly rules = [
    'Déplacez votre raquette avec la souris ou le doigt.',
    'Le premier joueur à marquer 5 points gagne la partie.',
    'Toucher la balle en bord de raquette lui donne un angle prononcé.',
    'La balle accélère légèrement à chaque échange.',
    'Local PC — J1 : W/S  |  J2 : ↑/↓',
    'Local Mobile — posez le doigt sur votre moitié et faites glisser.',
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
    const id  = this.gameService.getSocketId();
    const idx = r.players.findIndex((p: any) => p.id === id);
    return idx !== -1 ? idx + 1 : null;
  });

  scoreLabel  = computed(() => { const gs = this.room()?.gameState as any; return gs ? `${gs.scoreP1 ?? 0} — ${gs.scoreP2 ?? 0}` : ''; });
  winnerLabel = computed(() => { const w = this.room()?.gameState?.winner; return w === 1 ? this.player1Name() : w === 2 ? this.player2Name() : ''; });
  isWinner    = computed(() => { const w = this.room()?.gameState?.winner; return w != null && w === this.myPlayerNum(); });
  isLoser     = computed(() => { const w = this.room()?.gameState?.winner; return w != null && w !== this.myPlayerNum(); });

  // ── Canvas & loop ────────────────────────────────────────────────────────────
  private resizeObserver: ResizeObserver | null = null;
  private rafId: number | null = null;
  private visibilityHandler = () => {
    if (document.hidden) {
      if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    } else if (this.rafId === null) {
      this.lastFrameTs = 0;
      this.startLoop();
    }
  };

  // ── Client-side simulation state ─────────────────────────────────────────────
  // Runs at 60 Hz locally, reconciled against server on each server tick.
  private simState: SimPongState | null = null;

  /** Wall-clock accumulator for fixed-step physics. */
  private lastFrameTs  = 0;
  private accumulator  = 0;
  private readonly STEP_MS = 1000 / 60; // match 60 Hz server

  // ── Server state cache (for reconciliation + rendering) ──────────────────────
  private serverP1Y    = 50;
  private serverP2Y    = 50;

  // ── Server-side hit/score events (drives visual effects) ─────────────────────
  private prevLastHit: string | null = null;
  private prevScoreP1 = 0;
  private prevScoreP2 = 0;

  // ── WebRTC P2P ───────────────────────────────────────────────────────────────
  private webrtc = new PongWebRTC();
  rtcStatus: RtcStatus = 'idle';

  /** Last opponent-paddle Y received via WebRTC (null = use server value). */
  private rtcOppY: number | null = null;

  /** Guard: start WebRTC handshake only once per room. */
  private webrtcRoomId: string | null = null;

  // ── Client-side prediction for own paddle ────────────────────────────────────
  private localP1Y = 50;
  private localP2Y = 50;

  // ── Keyboard (local mode) ────────────────────────────────────────────────────
  private keysDown = new Set<string>();
  private p1KeyY   = 50;
  private p2KeyY   = 50;
  private keyboardInterval: ReturnType<typeof setInterval> | null = null;
  private keydownHandler!: (e: KeyboardEvent) => void;
  private keyupHandler!:   (e: KeyboardEvent) => void;

  // ── Visual effects ────────────────────────────────────────────────────────────
  private readonly TRAIL_LEN  = 12;
  private trail: TrailPt[]    = [];
  private particles: Particle[] = [];
  private scoreFlash  = { p1: 0, p2: 0 };
  private paddleFlash = { p1: 0, p2: 0 };
  private wallFlash   = { top: 0, bottom: 0 };

  constructor() {
    // ── React to server state ──────────────────────────────────────────────────
    effect(() => {
      const state = this.room()?.gameState as any;
      if (!state) return;

      const isLocal = this.room()?.isLocal ?? false;
      const myNum   = this.myPlayerNum();

      // First update: initialise sim
      if (!this.simState) {
        this.simState = cloneServerState(state);
        this.serverP1Y = state.p1Y ?? 50;
        this.serverP2Y = state.p2Y ?? 50;
        this.localP1Y  = this.serverP1Y;
        this.localP2Y  = this.serverP2Y;
        this.prevScoreP1 = state.scoreP1 ?? 0;
        this.prevScoreP2 = state.scoreP2 ?? 0;
        return;
      }

      // Cache raw server paddle positions (used as lerp targets)
      this.serverP1Y = state.p1Y ?? 50;
      this.serverP2Y = state.p2Y ?? 50;

      // Reconcile simulation against server truth
      this.reconcile(state, isLocal, myNum);

      // ── Hit / score detection (drives effects) ──────────────────────────────
      const lh = state.lastHit as string | null;
      if (lh && lh !== this.prevLastHit) this.onHit(lh, state);
      this.prevLastHit = lh;

      if (state.scoreP1 !== this.prevScoreP1) { this.scoreFlash.p1 = 1.0; this.prevScoreP1 = state.scoreP1; }
      if (state.scoreP2 !== this.prevScoreP2) { this.scoreFlash.p2 = 1.0; this.prevScoreP2 = state.scoreP2; }
    });

    // ── WebRTC signaling ───────────────────────────────────────────────────────
    effect(() => {
      const sig = this.gameService.pongRtcSignal();
      if (!sig) return;
      const room = this.room();
      if (!room || room.isLocal) return;

      switch (sig.type) {
        case 'offer':
          this.webrtc.handleOffer(
            sig.offer,
            a => this.gameService.sendPongRtcAnswer(room.id, a),
            c => this.gameService.sendPongRtcIce(room.id, c),
          );
          break;
        case 'answer':
          this.webrtc.handleAnswer(sig.answer);
          break;
        case 'ice':
          this.webrtc.addIceCandidate(sig.candidate);
          break;
      }
    });

    // ── Initiate WebRTC as host (P1) when room is full ─────────────────────────
    effect(() => {
      const room  = this.room();
      const myNum = this.myPlayerNum();
      if (!room || room.isLocal || myNum !== 1) return;
      if (room.players.length < 2)              return;
      if (this.webrtcRoomId === room.id)        return; // already started

      this.webrtcRoomId = room.id;
      this.webrtc.onStatusChange = s => { this.rtcStatus = s; };
      this.webrtc.onOpponentPaddle = y => { this.rtcOppY = y; };

      this.webrtc.initAsHost(
        offer => this.gameService.sendPongRtcOffer(room.id, offer),
        ice   => this.gameService.sendPongRtcIce(room.id, ice),
      );
    });

    // ── P2 also needs to wire callbacks (offer arrives from server) ────────────
    effect(() => {
      const room  = this.room();
      const myNum = this.myPlayerNum();
      if (!room || room.isLocal || myNum !== 2) return;
      if (this.webrtcRoomId === room.id)        return;

      this.webrtcRoomId = room.id;
      this.webrtc.onStatusChange    = s => { this.rtcStatus = s; };
      this.webrtc.onOpponentPaddle  = y => { this.rtcOppY = y; };
    });
  }

  // ── Reconciliation ───────────────────────────────────────────────────────────

  /**
   * Blend local simulation toward authoritative server state.
   *
   * Scores, winner, serve state, and paddle constants → always snapped.
   * Ball position → smooth correction if small error, hard snap if large.
   * Ball velocity → always synced (needed for continued prediction accuracy).
   * Own paddle    → kept local (client prediction).
   * Opponent paddle → lerp target is server value (or WebRTC if fresher).
   */
  private reconcile(s: any, isLocal: boolean, myNum: number | null) {
    const sim = this.simState!;

    // ── Authoritative non-physics state ────────────────────────────────────
    sim.scoreP1      = s.scoreP1 ?? 0;
    sim.scoreP2      = s.scoreP2 ?? 0;
    sim.winner       = s.winner  ?? null;
    sim.serving      = s.serving ?? false;
    sim.serveCountdown = s.serveCountdown ?? 0;
    sim.serveTowards = s.serveTowards ?? 1;
    sim.paddleHeight = s.paddleHeight ?? 18;
    sim.paddleWidth  = s.paddleWidth  ?? 2;
    sim.targetScore  = s.targetScore  ?? 5;
    sim.lastHit      = s.lastHit      ?? null;

    // ── Ball reconciliation ─────────────────────────────────────────────────
    if (sim.serving) {
      // Ball is static during serve — just snap
      sim.ball.x = s.ball.x; sim.ball.y = s.ball.y;
      sim.ball.vx = 0; sim.ball.vy = 0;
    } else {
      const dx   = Math.abs(sim.ball.x - s.ball.x);
      const dy   = Math.abs(sim.ball.y - s.ball.y);
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 0.5) {
        // Near-perfect prediction — tiny nudge
        sim.ball.x = sim.ball.x * 0.9 + s.ball.x * 0.1;
        sim.ball.y = sim.ball.y * 0.9 + s.ball.y * 0.1;
      } else if (dist < 4) {
        // Small drift — blend 50/50
        sim.ball.x = (sim.ball.x + s.ball.x) * 0.5;
        sim.ball.y = (sim.ball.y + s.ball.y) * 0.5;
      } else {
        // Large error (missed bounce, edge case) — hard snap
        sim.ball.x = s.ball.x;
        sim.ball.y = s.ball.y;
      }
      // Always sync velocity so continued prediction is accurate
      sim.ball.vx = s.ball.vx ?? 0;
      sim.ball.vy = s.ball.vy ?? 0;
      sim.ball.radius = s.ball.radius;
    }

    // ── Paddle reconciliation ───────────────────────────────────────────────
    if (isLocal) {
      // Local: server is ground truth (no network delay)
      sim.p1Y = s.p1Y; sim.p2Y = s.p2Y;
      this.p1KeyY = s.p1Y; this.p2KeyY = s.p2Y;
    } else {
      // Online: keep own paddle (client prediction), reconcile own if big drift
      if (myNum === 1) {
        const diff = Math.abs(this.localP1Y - s.p1Y);
        if (diff > 15) this.localP1Y = s.p1Y;
        else if (diff > 1) this.localP1Y = this.localP1Y * 0.5 + s.p1Y * 0.5;
        sim.p1Y = this.localP1Y;
        // Opponent (P2): WebRTC value if available (fresher), else server
        // Note: simState.p2Y is smoothed each physics step in tickSimulation
      } else if (myNum === 2) {
        const diff = Math.abs(this.localP2Y - s.p2Y);
        if (diff > 15) this.localP2Y = s.p2Y;
        else if (diff > 1) this.localP2Y = this.localP2Y * 0.5 + s.p2Y * 0.5;
        sim.p2Y = this.localP2Y;
      } else {
        // Spectator
        sim.p1Y = s.p1Y; sim.p2Y = s.p2Y;
      }
    }
  }

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    const parent = canvas.parentElement!;

    this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
    this.resizeObserver.observe(parent);
    this.resizeCanvas();

    // Touch
    canvas.addEventListener('touchmove',  (e: TouchEvent) => { e.preventDefault(); this.handleTouches(e.touches); }, { passive: false });
    canvas.addEventListener('touchstart', (e: TouchEvent) => { e.preventDefault(); this.handleTouches(e.touches); }, { passive: false });

    // Mouse
    canvas.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isPlaying()) return;
      const rect = canvas.getBoundingClientRect();
      const yPct = ((e.clientY - rect.top) / rect.height) * 100;
      const r    = this.room();
      if (r?.isLocal) {
        const xPct = ((e.clientX - rect.left) / rect.width) * 100;
        this.applyInput(yPct, xPct < 50 ? 1 : 2);
      } else {
        const myNum = this.myPlayerNum();
        if (myNum) this.applyInput(yPct, myNum as 1 | 2);
      }
    }, { passive: true });

    // Keyboard
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
    this.keyboardInterval = setInterval(() => this.tickKeyboard(), this.STEP_MS);

    this.startLoop();
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  ngOnDestroy() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.resizeObserver?.disconnect();
    if (this.keyboardInterval) clearInterval(this.keyboardInterval);
    document.removeEventListener('keydown', this.keydownHandler);
    document.removeEventListener('keyup',   this.keyupHandler);
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    this.webrtc.destroy();
  }

  // ── Input helpers ───────────────────────────────────────────────────────────

  private applyInput(yPct: number, paddle: 1 | 2) {
    const y = Math.max(9, Math.min(91, yPct));
    const r = this.room();

    // Immediately apply to sim (client prediction)
    if (this.simState) {
      if (paddle === 1) this.simState.p1Y = y;
      else              this.simState.p2Y = y;
    }

    if (r?.isLocal) {
      if (paddle === 1) this.p1KeyY = y; else this.p2KeyY = y;
      this.gameService.sendPongPaddle(y, paddle);
    } else {
      if (paddle === 1) this.localP1Y = y; else this.localP2Y = y;
      // Send via socket.io (authoritative) and WebRTC (low-latency)
      this.gameService.sendPongPaddle(y);
      this.webrtc.sendPaddle(y);
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
        const xPct = ((t.clientX - rect.left) / rect.width)  * 100;
        const yPct = ((t.clientY - rect.top)  / rect.height) * 100;
        this.applyInput(yPct, xPct < 50 ? 1 : 2);
      });
    } else {
      const myNum = this.myPlayerNum();
      if (!myNum) return;
      const yPct  = ((touches[0].clientY - rect.top) / rect.height) * 100;
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
      if (c1) { if (this.simState) this.simState.p1Y = this.p1KeyY; this.gameService.sendPongPaddle(this.p1KeyY, 1); }
      if (c2) { if (this.simState) this.simState.p2Y = this.p2KeyY; this.gameService.sendPongPaddle(this.p2KeyY, 2); }
    } else {
      const myNum = this.myPlayerNum();
      if (!myNum) return;
      const up   = this.keysDown.has('w') || this.keysDown.has('W') || this.keysDown.has('ArrowUp');
      const down = this.keysDown.has('s') || this.keysDown.has('S') || this.keysDown.has('ArrowDown');
      if (!up && !down) return;
      if (myNum === 1) {
        if (up)   this.localP1Y = Math.max(9,  this.localP1Y - speed);
        if (down) this.localP1Y = Math.min(91, this.localP1Y + speed);
        if (this.simState) this.simState.p1Y = this.localP1Y;
        this.gameService.sendPongPaddle(this.localP1Y);
        this.webrtc.sendPaddle(this.localP1Y);
      } else {
        if (up)   this.localP2Y = Math.max(9,  this.localP2Y - speed);
        if (down) this.localP2Y = Math.min(91, this.localP2Y + speed);
        if (this.simState) this.simState.p2Y = this.localP2Y;
        this.gameService.sendPongPaddle(this.localP2Y);
        this.webrtc.sendPaddle(this.localP2Y);
      }
    }
  }

  // ── Physics step (accumulator, 60 Hz) ─────────────────────────────────────

  private tickSimulation(ts: number) {
    if (!this.lastFrameTs) { this.lastFrameTs = ts; return; }

    const delta = Math.min(ts - this.lastFrameTs, 100); // cap at 100ms (tab suspend)
    this.lastFrameTs  = ts;

    if (!this.simState) return;

    this.accumulator += delta;

    while (this.accumulator >= this.STEP_MS) {
      // Smooth opponent paddle toward server (or WebRTC) value each step
      this.stepOpponentPaddle();
      stepPong(this.simState);
      this.accumulator -= this.STEP_MS;
    }
  }

  /**
   * Lerp opponent paddle toward the latest known position.
   * WebRTC value takes priority (fresher) over server broadcast.
   */
  private stepOpponentPaddle() {
    const sim    = this.simState!;
    const isLocal = this.room()?.isLocal ?? false;
    const myNum   = this.myPlayerNum();
    if (isLocal || !myNum) return;

    const LERP = 0.3; // ~10 steps to converge at 60 Hz

    if (myNum === 1) {
      const target = this.rtcOppY ?? this.serverP2Y;
      sim.p2Y      = sim.p2Y + (target - sim.p2Y) * LERP;
    } else {
      const target = this.rtcOppY ?? this.serverP1Y;
      sim.p1Y      = sim.p1Y + (target - sim.p1Y) * LERP;
    }
  }

  // ── Resize ─────────────────────────────────────────────────────────────────

  private resizeCanvas() {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const availW = parent.clientWidth  - 16;
    const availH = parent.clientHeight - 16;
    const aspect = 1.65;
    let w = availW, h = w / aspect;
    if (h > availH) { h = availH; w = h * aspect; }
    canvas.width  = Math.floor(w);
    canvas.height = Math.floor(h);
  }

  // ── rAF loop ───────────────────────────────────────────────────────────────

  private startLoop() {
    const loop = (ts: number) => {
      this.tickSimulation(ts);
      this.drawFrame();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  // ── Effects ────────────────────────────────────────────────────────────────

  private onHit(hit: string, state: any) {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const W  = canvas.width, H = canvas.height;
    const bX = (state.ball.x / 100) * W;
    const bY = (state.ball.y / 100) * H;

    if      (hit === 'p1')         { this.paddleFlash.p1 = 1.0; this.spawnParticles(bX, bY, '#00E676', 12); }
    else if (hit === 'p2')         { this.paddleFlash.p2 = 1.0; this.spawnParticles(bX, bY, '#00E5FF', 12); }
    else if (hit === 'wall_top')   { this.wallFlash.top    = 1.0; this.spawnParticles(bX, bY, 'rgba(255,255,255,0.9)', 6); }
    else if (hit === 'wall_bottom'){ this.wallFlash.bottom = 1.0; this.spawnParticles(bX, bY, 'rgba(255,255,255,0.9)', 6); }
  }

  private spawnParticles(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 1.5 + Math.random() * 3.5;
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1.0, color, radius: 1.5 + Math.random() * 2.5 });
    }
    if (this.particles.length > 200) this.particles.splice(0, this.particles.length - 200);
  }

  private lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

  // ── Draw ───────────────────────────────────────────────────────────────────

  private drawFrame() {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas || !this.simState) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W  = canvas.width,  H  = canvas.height;
    const sim = this.simState;
    const isLocal = this.room()?.isLocal ?? false;

    // ── Ball pixel coords (from local sim, always smooth) ─────────────────────
    const bX = (sim.ball.x / 100) * W;
    const bY = (sim.ball.y / 100) * H;
    const bR = Math.max(4, (sim.ball.radius / 100) * Math.min(W, H));

    // ── Speed for glow intensity ──────────────────────────────────────────────
    const speed  = Math.sqrt(sim.ball.vx ** 2 + sim.ball.vy ** 2);
    const speedT = Math.min(speed / (3.2 * Math.SQRT2), 1);

    // ── Decay timers ──────────────────────────────────────────────────────────
    this.scoreFlash.p1   = Math.max(0, this.scoreFlash.p1   - 1 / 55);
    this.scoreFlash.p2   = Math.max(0, this.scoreFlash.p2   - 1 / 55);
    this.paddleFlash.p1  = Math.max(0, this.paddleFlash.p1  - 1 / 20);
    this.paddleFlash.p2  = Math.max(0, this.paddleFlash.p2  - 1 / 20);
    this.wallFlash.top    = Math.max(0, this.wallFlash.top    - 1 / 15);
    this.wallFlash.bottom = Math.max(0, this.wallFlash.bottom - 1 / 15);

    // ── Particles ─────────────────────────────────────────────────────────────
    this.particles = this.particles.filter(p => {
      p.x += p.vx; p.y += p.vy; p.vx *= 0.92; p.vy *= 0.92; p.life -= 1 / 30;
      return p.life > 0;
    });

    // ── Trail ─────────────────────────────────────────────────────────────────
    if (!sim.serving) {
      this.trail.push({ x: bX, y: bY });
      if (this.trail.length > this.TRAIL_LEN) this.trail.shift();
    } else {
      this.trail = [];
    }

    // ── Dynamic canvas glow ───────────────────────────────────────────────────
    const ballXt = bX / W;
    const gr = 0, gg = Math.round(this.lerp(230, 229, ballXt)), gb = Math.round(this.lerp(118, 255, ballXt));
    const glowR = 20 + speedT * 40;
    canvas.style.boxShadow = [
      '0 0 0 1px rgba(255,255,255,0.05)',
      `0 0 ${glowR}px rgba(${gr},${gg},${gb},${0.3 + speedT * 0.4})`,
      `0 0 ${glowR * 2}px rgba(${gr},${gg},${gb},${0.08 + speedT * 0.12})`,
    ].join(', ');

    // ── Background ────────────────────────────────────────────────────────────
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, W, H);

    // Subtle grid
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    ctx.lineWidth = 1;
    const gs = Math.floor(H / 10);
    for (let gx = 0; gx < W; gx += gs) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
    for (let gy = 0; gy < H; gy += gs) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }
    ctx.restore();

    if (isLocal) {
      ctx.fillStyle = 'rgba(0,230,118,0.025)'; ctx.fillRect(0, 0, W / 2, H);
      ctx.fillStyle = 'rgba(0,229,255,0.025)'; ctx.fillRect(W / 2, 0, W / 2, H);
    }

    // Wall flash
    if (this.wallFlash.top > 0) {
      const g = ctx.createLinearGradient(0, 0, 0, H * 0.15);
      g.addColorStop(0, `rgba(255,255,255,${this.wallFlash.top * 0.25})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.15);
    }
    if (this.wallFlash.bottom > 0) {
      const g = ctx.createLinearGradient(0, H, 0, H * 0.85);
      g.addColorStop(0, `rgba(255,255,255,${this.wallFlash.bottom * 0.25})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, H * 0.85, W, H * 0.15);
    }

    // Vignette
    const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.85);
    vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);

    // Center line
    ctx.save();
    ctx.setLineDash([H / 28, H / 28]);
    ctx.strokeStyle = isLocal ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)';
    ctx.lineWidth   = isLocal ? 3 : 2;
    ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
    ctx.restore();

    // ── Player names ──────────────────────────────────────────────────────────
    const nameSize = Math.max(10, Math.floor(H * 0.055));
    ctx.font = `600 ${nameSize}px 'Inter', sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0,230,118,0.55)'; ctx.textAlign = 'left';  ctx.fillText(this.player1Name(), W * 0.03, H * 0.04);
    ctx.fillStyle = 'rgba(0,229,255,0.55)'; ctx.textAlign = 'right'; ctx.fillText(this.player2Name(), W * 0.97, H * 0.04);

    // ── Scores ────────────────────────────────────────────────────────────────
    const baseScoreSize = Math.floor(H * 0.13);
    const scoreY = H * 0.04 + nameSize + 4;

    const sf1 = this.scoreFlash.p1;
    ctx.font = `bold ${baseScoreSize + Math.round(sf1 * baseScoreSize * 0.6)}px 'Courier New', monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = sf1 > 0 ? `rgba(0,230,118,${0.5 + sf1 * 0.5})` : 'rgba(255,255,255,0.25)';
    ctx.fillText(String(sim.scoreP1), W * 0.25, scoreY);

    const sf2 = this.scoreFlash.p2;
    ctx.font = `bold ${baseScoreSize + Math.round(sf2 * baseScoreSize * 0.6)}px 'Courier New', monospace`;
    ctx.fillStyle = sf2 > 0 ? `rgba(0,229,255,${0.5 + sf2 * 0.5})` : 'rgba(255,255,255,0.25)';
    ctx.fillText(String(sim.scoreP2), W * 0.75, scoreY);

    // ── Serve countdown ───────────────────────────────────────────────────────
    if (sim.serving) {
      const secs  = Math.ceil(sim.serveCountdown / 60);
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 200);
      ctx.save();
      ctx.font = `bold ${Math.floor(H * 0.09)}px 'Courier New', monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = '#FFFFFF'; ctx.shadowBlur = 20;
      ctx.fillStyle   = `rgba(255,255,255,${0.4 + pulse * 0.4})`;
      ctx.fillText(secs > 0 ? String(secs) : '▶', W / 2, H / 2);
      ctx.restore();
    }

    // ── Local keyboard hints ──────────────────────────────────────────────────
    if (isLocal) {
      ctx.font = `${Math.max(9, Math.floor(H * 0.048))}px 'Inter', sans-serif`;
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = 'rgba(0,230,118,0.4)'; ctx.textAlign = 'left';  ctx.fillText('W / S',  W * 0.03, H - 8);
      ctx.fillStyle = 'rgba(0,229,255,0.4)'; ctx.textAlign = 'right'; ctx.fillText('↑ / ↓', W * 0.97, H - 8);
    }

    // ── Ball trail ────────────────────────────────────────────────────────────
    for (let i = 0; i < this.trail.length; i++) {
      const frac  = i / this.trail.length;
      const alpha = frac * frac * 0.5;
      const r     = bR * frac * 0.85;
      if (r < 0.5) continue;
      ctx.beginPath();
      ctx.arc(this.trail[i].x, this.trail[i].y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fill();
    }

    // ── Particles ─────────────────────────────────────────────────────────────
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * p.life, 0, Math.PI * 2);
      ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 6;
      ctx.fill();
      ctx.restore();
    }

    // ── Paddles ───────────────────────────────────────────────────────────────
    const pH    = (sim.paddleHeight / 100) * H;
    const pW    = Math.max(6, (sim.paddleWidth / 100) * W);
    const leftX  = W * 0.025;
    const rightX = W * 0.975 - pW;

    // P1 — green
    const p1Top = (sim.p1Y / 100) * H - pH / 2;
    ctx.save();
    const pf1 = this.paddleFlash.p1;
    ctx.shadowColor = pf1 > 0 ? `rgba(255,255,255,${pf1})` : '#00E676';
    ctx.shadowBlur  = 18 + pf1 * 30;
    const g1 = ctx.createLinearGradient(0, p1Top, 0, p1Top + pH);
    g1.addColorStop(0, '#00C853'); g1.addColorStop(0.5, pf1 > 0 ? `rgba(255,255,255,${pf1})` : '#69F0AE'); g1.addColorStop(1, '#00C853');
    ctx.fillStyle = g1;
    ctx.beginPath(); (ctx as any).roundRect(leftX, p1Top, pW, pH, 4); ctx.fill();
    ctx.restore();

    // P2 — cyan
    const p2Top = (sim.p2Y / 100) * H - pH / 2;
    ctx.save();
    const pf2 = this.paddleFlash.p2;
    ctx.shadowColor = pf2 > 0 ? `rgba(255,255,255,${pf2})` : '#00E5FF';
    ctx.shadowBlur  = 18 + pf2 * 30;
    const g2 = ctx.createLinearGradient(0, p2Top, 0, p2Top + pH);
    g2.addColorStop(0, '#0091EA'); g2.addColorStop(0.5, pf2 > 0 ? `rgba(255,255,255,${pf2})` : '#80D8FF'); g2.addColorStop(1, '#0091EA');
    ctx.fillStyle = g2;
    ctx.beginPath(); (ctx as any).roundRect(rightX, p2Top, pW, pH, 4); ctx.fill();
    ctx.restore();

    // ── Ball ──────────────────────────────────────────────────────────────────
    if (!sim.serving) {
      ctx.save();
      ctx.shadowColor = `rgba(255,255,255,${0.7 + speedT * 0.3})`;
      ctx.shadowBlur  = 20 + speedT * 30;
      ctx.fillStyle   = '#FFFFFF';
      ctx.beginPath(); ctx.arc(bX, bY, bR, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
}
