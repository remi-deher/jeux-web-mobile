import { Component, computed, inject, ViewChild, ElementRef, AfterViewInit, OnDestroy, effect } from '@angular/core';
import { GameService } from '../../services/game.service';
import { GameLayoutComponent } from '../game-layout/game-layout.component';
import { FloatingEmojisComponent } from '../floating-emojis/floating-emojis.component';
import { injectGameSession } from '../../services/game-session.helper';
import { injectWebRtcSession } from '../../services/webrtc-session.helper';
import { injectRealtimeCanvas } from '../../services/realtime-canvas.helper';
import { SimAirhockeyState, cloneServerState, stepAirhockey } from './airhockey-physics';

// ── Visual helpers ─────────────────────────────────────────────────────────────
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; radius: number; }
interface TrailPt   { x: number; y: number; }

@Component({
  selector: 'app-airhockey',
  standalone: true,
  imports: [GameLayoutComponent, FloatingEmojisComponent],
  template: `
    <app-game-layout
      gameTitle="Air Hockey"
      [rules]="rules"
      [room]="room()"
      [isPlaying]="isPlaying()"
      [isMyTurn]="isPlaying()"
      turnAlertText="Défendez votre but !"
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
      <div game-board class="airhockey-board">
        <app-floating-emojis [emojis]="floatingEmojis()"></app-floating-emojis>
        <canvas #airhockeyCanvas class="airhockey-canvas"></canvas>
        @if (rtcStatus !== 'idle' && rtcStatus !== 'connected') {
          <div class="rtc-badge" [class.rtc-failed]="rtcStatus === 'failed'">
            {{ rtcStatus === 'connecting' ? '⚡ P2P…' : '☁ socket.io' }}
          </div>
        }
        @if (!isPlaying() && room()?.status !== 'finished') {
          <div class="waiting-overlay">En attente de l'adversaire…</div>
        }
        @if (room()?.status === 'playing' && (!airhockeyState()?.p1Ready || !airhockeyState()?.p2Ready)) {
          <div class="ready-overlay-panel">
            <div class="ready-modal-card">
              <h3 class="ready-title">Prêt à jouer ?</h3>
              <p class="ready-subtitle">Le jeu commencera quand les deux joueurs auront validé.</p>
              
              <div class="ready-indicators">
                <div class="ready-pill" [class.ready-ok]="airhockeyState()?.p1Ready">
                  <span class="ready-dot"></span>
                  <span class="ready-name">{{ player1Name() }}</span>
                  <span class="ready-text">{{ airhockeyState()?.p1Ready ? 'Prêt' : 'En attente...' }}</span>
                </div>
                <div class="ready-pill" [class.ready-ok]="airhockeyState()?.p2Ready">
                  <span class="ready-dot"></span>
                  <span class="ready-name">{{ player2Name() }}</span>
                  <span class="ready-text">{{ airhockeyState()?.p2Ready ? 'Prêt' : 'En attente...' }}</span>
                </div>
              </div>

              @if (room()?.isLocal) {
                <button class="ready-action-btn pulse-glow" (click)="setReady()">COMMENCER LA PARTIE</button>
              } @else {
                @if (amIReady()) {
                  <button class="ready-action-btn ready-done" disabled>
                    ATTENTE DE L'ADVERSAIRE
                  </button>
                } @else {
                  <button class="ready-action-btn active-ready pulse-glow" (click)="setReady()">
                    JE SUIS PRÊT <span class="key-hint">Espace</span>
                  </button>
                }
              }
            </div>
          </div>
        }
      </div>
    </app-game-layout>
  `,
  styles: [`
    .airhockey-board {
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

    .airhockey-canvas {
      display: block;
      border-radius: 16px;
      background: #0b0b12;
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
      border-radius: 16px;
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
    .ready-overlay-panel {
      position: absolute;
      inset: 8px;
      background: rgba(10, 10, 15, 0.85);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
      border-radius: 16px;
      padding: 20px;
    }
    .ready-modal-card {
      background: #14141f;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      padding: 30px;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5), 0 0 40px rgba(0,229,255,0.15);
      animation: modalFadeIn 0.3s ease-out;
    }
    @keyframes modalFadeIn {
      from { opacity: 0; transform: scale(0.95); }
      to   { opacity: 1; transform: scale(1); }
    }
    .ready-title {
      font-size: 22px;
      font-weight: 700;
      color: #fff;
      margin: 0 0 8px 0;
      letter-spacing: 0.5px;
    }
    .ready-subtitle {
      font-size: 13px;
      color: rgba(255,255,255,0.5);
      margin: 0 0 24px 0;
    }
    .ready-indicators {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 28px;
    }
    .ready-pill {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 16px;
      border-radius: 10px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.05);
      transition: all 0.3s ease;
    }
    .ready-pill.ready-ok {
      background: rgba(0, 229, 255, 0.08);
      border-color: rgba(0, 229, 255, 0.3);
    }
    .ready-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: rgba(255,255,255,0.3);
      transition: all 0.3s ease;
    }
    .ready-pill.ready-ok .ready-dot {
      background: #00E5FF;
      box-shadow: 0 0 8px #00E5FF;
    }
    .ready-name {
      font-weight: 600;
      color: rgba(255,255,255,0.85);
      flex: 1;
      text-align: left;
      font-size: 14px;
    }
    .ready-text {
      font-size: 12px;
      font-weight: 600;
      color: rgba(255,255,255,0.4);
    }
    .ready-pill.ready-ok .ready-text {
      color: #00E5FF;
    }
    .ready-action-btn {
      width: 100%;
      padding: 14px;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 700;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s ease;
    }
    .ready-action-btn.active-ready {
      background: #00E5FF;
      color: #000;
    }
    .ready-action-btn.active-ready:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(0, 229, 255, 0.4);
    }
    .ready-action-btn.ready-done {
      background: rgba(255,255,255,0.05);
      color: rgba(255,255,255,0.4);
      cursor: not-allowed;
      border: 1px solid rgba(255,255,255,0.08);
    }
    .ready-action-btn.pulse-glow {
      animation: btnPulse 2s infinite;
    }
    @keyframes btnPulse {
      0% { box-shadow: 0 0 0 0 rgba(0, 229, 255, 0.4); }
      70% { box-shadow: 0 0 0 10px rgba(0, 229, 255, 0); }
      100% { box-shadow: 0 0 0 0 rgba(0, 229, 255, 0); }
    }
    .key-hint {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(0,0,0,0.2);
      border: 1px solid rgba(0,0,0,0.15);
      margin-left: 6px;
      opacity: 0.8;
    }
  `]
})
export class AirhockeyComponent implements AfterViewInit, OnDestroy {
  @ViewChild('airhockeyCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private gameService = inject(GameService);
  private session = injectGameSession('airhockey');
  private rtc     = injectWebRtcSession('airhockey');
  private rt      = injectRealtimeCanvas(
    cb => this.gameService.subscribeAirhockeyRaw(cb),
    () => this.gameService.liveAirhockeyState(),
  );

  readonly rules = [
    'Déplacez votre poussoir avec la souris, les touches directionnelles ou le doigt.',
    'Vous ne pouvez jouer que dans votre propre moitié de terrain (J1 à gauche, J2 à droite).',
    'Le premier joueur à marquer 5 buts gagne.',
    'Frappez fort le palet pour lui donner de la vitesse !',
    'Local PC — J1 : ZQSD/WASD | J2 : ↑↓←→',
    'Local Tactile — Touchez et faites glisser sur votre moitié de terrain.'
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

  airhockeyState = computed(() => this.gameService.liveAirhockeyState() ?? (this.room()?.gameState as any));
  amIReady = computed(() => {
    const s = this.airhockeyState();
    if (!s) return false;
    if (this.room()?.isLocal) return s.p1Ready && s.p2Ready;
    return this.myPlayerNum() === 1 ? !!s.p1Ready : !!s.p2Ready;
  });

  setReady() {
    const r = this.room();
    if (r) {
      this.gameService.sendPlayerReady(r.id);
    }
  }

  scoreLabel  = computed(() => { const gs = this.airhockeyState(); return gs ? `${gs.scoreP1 ?? 0} — ${gs.scoreP2 ?? 0}` : ''; });
  winnerLabel = computed(() => { const w = this.airhockeyState()?.winner; return w === 1 ? this.player1Name() : w === 2 ? this.player2Name() : ''; });
  isWinner    = computed(() => { const w = this.airhockeyState()?.winner; return w != null && w === this.myPlayerNum(); });
  isLoser     = computed(() => { const w = this.airhockeyState()?.winner; return w != null && w !== this.myPlayerNum(); });

  // ── Canvas & loop ────────────────────────────────────────────────────────────
  private resizeObserver: ResizeObserver | null = null;
  private rafId: number | null = null;
  private visibilityHandler = () => {
    if (document.hidden) {
      if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    } else if (this.rafId === null) {
      this.lastFrameTs = 0;
      this.rt.runOutside(() => this.startLoop());
    }
  };

  // ── Client-side simulation state ─────────────────────────────────────────────
  private simState: SimAirhockeyState | null = null;
  private lastFrameTs  = 0;
  private accumulator  = 0;
  private readonly STEP_MS = 1000 / 60; // 60 Hz physics

  // ── Server state cache (for reconciliation + rendering) ──────────────────────
  private serverP1X = 20; private serverP1Y = 50;
  private serverP2X = 80; private serverP2Y = 50;

  // ── Server-side hit/score events (drives visual effects) ─────────────────────
  private prevLastHit: string | null = null;
  private prevScoreP1 = 0;
  private prevScoreP2 = 0;

  // ── WebRTC P2P (via injectWebRtcSession) ─────────────────────────────────────
  get rtcStatus() { return this.rtc.status(); }
  private rtcOppX: number | null = null;
  private rtcOppY: number | null = null;

  // ── Client-side prediction for own mallet ────────────────────────────────────
  private localP1X = 20; private localP1Y = 50;
  private localP2X = 80; private localP2Y = 50;

  // ── Keyboard (local & online mode) ───────────────────────────────────────────
  private keysDown = new Set<string>();
  private keyboardInterval: ReturnType<typeof setInterval> | null = null;
  private keydownHandler!: (e: KeyboardEvent) => void;
  private keyupHandler!:   (e: KeyboardEvent) => void;

  // ── Visual effects ────────────────────────────────────────────────────────────
  private readonly TRAIL_LEN  = 16;
  private trail: TrailPt[]    = [];
  private particles: Particle[] = [];
  private scoreFlash  = { p1: 0, p2: 0 };
  private malletFlash = { p1: 0, p2: 0 };
  private wallFlash   = 0;

  constructor() {
    effect(() => {
      const msg = this.rtc.lastMessage() as any;
      if (msg?.type === 'mallet' && typeof msg.x === 'number' && typeof msg.y === 'number') {
        this.rtcOppX = msg.x;
        this.rtcOppY = msg.y;
      }
    });
  }

  // ── Reconciliation ───────────────────────────────────────────────────────────
  private reconcile(s: any, isLocal: boolean, myNum: number | null) {
    const sim = this.simState!;

    // Snap authoritative non-physics states
    sim.scoreP1      = s.scoreP1 ?? 0;
    sim.scoreP2      = s.scoreP2 ?? 0;
    sim.winner       = s.winner  ?? null;
    sim.serving      = s.serving ?? false;
    sim.serveCountdown = s.serveCountdown ?? 0;
    sim.serveTowards = s.serveTowards ?? 1;
    sim.targetScore  = s.targetScore  ?? 5;
    sim.lastHit      = s.lastHit      ?? null;

    // Puck reconciliation
    if (sim.serving) {
      sim.puck.x = s.puck?.x ?? 50;
      sim.puck.y = s.puck?.y ?? 50;
      sim.puck.vx = 0; sim.puck.vy = 0;
    } else {
      const dx   = Math.abs(sim.puck.x - s.puck.x);
      const dy   = Math.abs(sim.puck.y - s.puck.y);
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 2.5) {
        // Latency dead-zone : pas de correction visuelle immédiate
      } else if (dist < 6.0) {
        // Correction douce
        sim.puck.x = sim.puck.x * 0.92 + s.puck.x * 0.08;
        sim.puck.y = sim.puck.y * 0.92 + s.puck.y * 0.08;
      } else {
        // Dérive importante : snap dur
        sim.puck.x = s.puck.x;
        sim.puck.y = s.puck.y;
      }
      sim.puck.vx = s.puck.vx ?? 0;
      sim.puck.vy = s.puck.vy ?? 0;
      sim.puck.radius = s.puck.radius;
    }

    // Mallets reconciliation
    if (isLocal) {
      sim.p1Mallet.x = s.p1Mallet.x; sim.p1Mallet.y = s.p1Mallet.y;
      sim.p2Mallet.x = s.p2Mallet.x; sim.p2Mallet.y = s.p2Mallet.y;
      this.localP1X = s.p1Mallet.x; this.localP1Y = s.p1Mallet.y;
      this.localP2X = s.p2Mallet.x; this.localP2Y = s.p2Mallet.y;
    } else {
      if (myNum === 1) {
        // Own mallet (J1)
        const diffX = Math.abs(this.localP1X - s.p1Mallet.x);
        const diffY = Math.abs(this.localP1Y - s.p1Mallet.y);
        if (diffX > 15 || diffY > 15) { this.localP1X = s.p1Mallet.x; this.localP1Y = s.p1Mallet.y; }
        sim.p1Mallet.x = this.localP1X; sim.p1Mallet.y = this.localP1Y;
      } else if (myNum === 2) {
        // Own mallet (J2)
        const diffX = Math.abs(this.localP2X - s.p2Mallet.x);
        const diffY = Math.abs(this.localP2Y - s.p2Mallet.y);
        if (diffX > 15 || diffY > 15) { this.localP2X = s.p2Mallet.x; this.localP2Y = s.p2Mallet.y; }
        sim.p2Mallet.x = this.localP2X; sim.p2Mallet.y = this.localP2Y;
      } else {
        // Spectator
        sim.p1Mallet.x = s.p1Mallet.x; sim.p1Mallet.y = s.p1Mallet.y;
        sim.p2Mallet.x = s.p2Mallet.x; sim.p2Mallet.y = s.p2Mallet.y;
      }
    }
  }

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    const parent = canvas.parentElement!;

    this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
    this.resizeObserver.observe(parent);
    this.resizeCanvas();

    // Event listeners
    canvas.addEventListener('touchmove',  (e: TouchEvent) => { e.preventDefault(); this.handleTouches(e.touches); }, { passive: false });
    canvas.addEventListener('touchstart', (e: TouchEvent) => { e.preventDefault(); this.handleTouches(e.touches); }, { passive: false });

    canvas.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isPlaying()) return;
      const rect = canvas.getBoundingClientRect();
      const xPct = ((e.clientX - rect.left) / rect.width) * 100;
      const yPct = ((e.clientY - rect.top) / rect.height) * 100;
      const r = this.room();

      if (r?.isLocal) {
        // En local : J1 suit la souris si elle est à gauche, J2 si elle est à droite
        if (xPct < 50) {
          this.applyInput(xPct, yPct, 1);
        } else {
          this.applyInput(xPct, yPct, 2);
        }
      } else {
        const myNum = this.myPlayerNum();
        if (myNum) this.applyInput(xPct, yPct, myNum as 1 | 2);
      }
    }, { passive: true });

    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const s = this.airhockeyState();
      const isPlaying = this.isPlaying();
      const notReady = s && (!s.p1Ready || !s.p2Ready);

      if (isPlaying && notReady) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          this.setReady();
          return;
        }
      }

      if (['w', 'W', 's', 'S', 'a', 'A', 'd', 'D', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        this.keysDown.add(e.key);
      }
    };
    this.keyupHandler = (e: KeyboardEvent) => this.keysDown.delete(e.key);
    document.addEventListener('keydown', this.keydownHandler);
    document.addEventListener('keyup',   this.keyupHandler);
    this.keyboardInterval = setInterval(() => this.tickKeyboard(), this.STEP_MS);

    this.rt.start(
      (state: any) => {
        const isLocal = this.room()?.isLocal ?? false;
        const myNum   = this.myPlayerNum();
        if (!this.simState) {
          this.simState    = cloneServerState(state);
          this.serverP1X   = state.p1Mallet?.x ?? 20;
          this.serverP1Y   = state.p1Mallet?.y ?? 50;
          this.serverP2X   = state.p2Mallet?.x ?? 80;
          this.serverP2Y   = state.p2Mallet?.y ?? 50;
          this.localP1X    = this.serverP1X;
          this.localP1Y    = this.serverP1Y;
          this.localP2X    = this.serverP2X;
          this.localP2Y    = this.serverP2Y;
          this.prevScoreP1 = state.scoreP1 ?? 0;
          this.prevScoreP2 = state.scoreP2 ?? 0;
          return;
        }
        this.serverP1X = state.p1Mallet?.x ?? 20;
        this.serverP1Y = state.p1Mallet?.y ?? 50;
        this.serverP2X = state.p2Mallet?.x ?? 80;
        this.serverP2Y = state.p2Mallet?.y ?? 50;
        this.reconcile(state, isLocal, myNum);

        const lh = state.lastHit as string | null;
        if (lh && lh !== this.prevLastHit) this.onHit(lh, state);
        this.prevLastHit = lh;

        if (state.scoreP1 !== this.prevScoreP1) { this.scoreFlash.p1 = 1.0; this.prevScoreP1 = state.scoreP1; }
        if (state.scoreP2 !== this.prevScoreP2) { this.scoreFlash.p2 = 1.0; this.prevScoreP2 = state.scoreP2; }
      },
      () => this.startLoop(),
    );
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

  private applyInput(xPct: number, yPct: number, player: 1 | 2) {
    if (!this.simState) return;
    const r = this.room();
    const radius = player === 1 ? this.simState.p1Mallet.radius : this.simState.p2Mallet.radius;

    let x = xPct;
    let y = Math.max(radius, Math.min(100 - radius, yPct));

    if (player === 1) {
      x = Math.max(radius, Math.min(50 - radius, x));
      this.simState.p1Mallet.x = x;
      this.simState.p1Mallet.y = y;
      if (r?.isLocal) {
        this.gameService.sendAirhockeyMallet(x, y, 1);
      } else {
        this.localP1X = x; this.localP1Y = y;
        this.gameService.sendAirhockeyMallet(x, y);
        this.rtc.send({ type: 'mallet', x, y });
      }
    } else {
      x = Math.max(50 + radius, Math.min(100 - radius, x));
      this.simState.p2Mallet.x = x;
      this.simState.p2Mallet.y = y;
      if (r?.isLocal) {
        this.gameService.sendAirhockeyMallet(x, y, 2);
      } else {
        this.localP2X = x; this.localP2Y = y;
        this.gameService.sendAirhockeyMallet(x, y);
        this.rtc.send({ type: 'mallet', x, y });
      }
    }
  }

  private handleTouches(touches: TouchList) {
    if (!this.isPlaying()) return;
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const r = this.room();

    if (r?.isLocal) {
      Array.from(touches).forEach(t => {
        const xPct = ((t.clientX - rect.left) / rect.width) * 100;
        const yPct = ((t.clientY - rect.top) / rect.height) * 100;
        this.applyInput(xPct, yPct, xPct < 50 ? 1 : 2);
      });
    } else {
      const myNum = this.myPlayerNum();
      if (!myNum) return;
      const xPct = ((touches[0].clientX - rect.left) / rect.width) * 100;
      const yPct = ((touches[0].clientY - rect.top) / rect.height) * 100;
      this.applyInput(xPct, yPct, myNum as 1 | 2);
    }
  }

  private tickKeyboard() {
    if (!this.isPlaying()) return;
    const r     = this.room();
    const speed = 2.2;
    if (!this.simState) return;

    if (r?.isLocal) {
      let c1 = false, c2 = false;
      // J1 : WASD / ZQSD
      if (this.keysDown.has('w') || this.keysDown.has('W') || this.keysDown.has('z') || this.keysDown.has('Z')) { this.localP1Y = Math.max(this.simState.p1Mallet.radius, this.localP1Y - speed); c1 = true; }
      if (this.keysDown.has('s') || this.keysDown.has('S')) { this.localP1Y = Math.min(100 - this.simState.p1Mallet.radius, this.localP1Y + speed); c1 = true; }
      if (this.keysDown.has('a') || this.keysDown.has('A') || this.keysDown.has('q') || this.keysDown.has('Q')) { this.localP1X = Math.max(this.simState.p1Mallet.radius, this.localP1X - speed); c1 = true; }
      if (this.keysDown.has('d') || this.keysDown.has('D')) { this.localP1X = Math.min(50 - this.simState.p1Mallet.radius, this.localP1X + speed); c1 = true; }

      // J2 : flèches
      if (this.keysDown.has('ArrowUp'))    { this.localP2Y = Math.max(this.simState.p2Mallet.radius, this.localP2Y - speed); c2 = true; }
      if (this.keysDown.has('ArrowDown'))  { this.localP2Y = Math.min(100 - this.simState.p2Mallet.radius, this.localP2Y + speed); c2 = true; }
      if (this.keysDown.has('ArrowLeft'))  { this.localP2X = Math.max(50 + this.simState.p2Mallet.radius, this.localP2X - speed); c2 = true; }
      if (this.keysDown.has('ArrowRight')) { this.localP2X = Math.min(100 - this.simState.p2Mallet.radius, this.localP2X + speed); c2 = true; }

      if (c1) {
        this.simState.p1Mallet.x = this.localP1X;
        this.simState.p1Mallet.y = this.localP1Y;
        this.gameService.sendAirhockeyMallet(this.localP1X, this.localP1Y, 1);
      }
      if (c2) {
        this.simState.p2Mallet.x = this.localP2X;
        this.simState.p2Mallet.y = this.localP2Y;
        this.gameService.sendAirhockeyMallet(this.localP2X, this.localP2Y, 2);
      }
    } else {
      const myNum = this.myPlayerNum();
      if (!myNum) return;

      const up    = this.keysDown.has('w') || this.keysDown.has('W') || this.keysDown.has('z') || this.keysDown.has('Z') || this.keysDown.has('ArrowUp');
      const down  = this.keysDown.has('s') || this.keysDown.has('S') || this.keysDown.has('ArrowDown');
      const left  = this.keysDown.has('a') || this.keysDown.has('A') || this.keysDown.has('q') || this.keysDown.has('Q') || this.keysDown.has('ArrowLeft');
      const right = this.keysDown.has('d') || this.keysDown.has('D') || this.keysDown.has('ArrowRight');

      if (!up && !down && !left && !right) return;

      if (myNum === 1) {
        if (up)    this.localP1Y = Math.max(this.simState.p1Mallet.radius, this.localP1Y - speed);
        if (down)  this.localP1Y = Math.min(100 - this.simState.p1Mallet.radius, this.localP1Y + speed);
        if (left)  this.localP1X = Math.max(this.simState.p1Mallet.radius, this.localP1X - speed);
        if (right) this.localP1X = Math.min(50 - this.simState.p1Mallet.radius, this.localP1X + speed);
        this.simState.p1Mallet.x = this.localP1X;
        this.simState.p1Mallet.y = this.localP1Y;
        this.gameService.sendAirhockeyMallet(this.localP1X, this.localP1Y);
        this.rtc.send({ type: 'mallet', x: this.localP1X, y: this.localP1Y });
      } else {
        if (up)    this.localP2Y = Math.max(this.simState.p2Mallet.radius, this.localP2Y - speed);
        if (down)  this.localP2Y = Math.min(100 - this.simState.p2Mallet.radius, this.localP2Y + speed);
        if (left)  this.localP2X = Math.max(50 + this.simState.p2Mallet.radius, this.localP2X - speed);
        if (right) this.localP2X = Math.min(100 - this.simState.p2Mallet.radius, this.localP2X + speed);
        this.simState.p2Mallet.x = this.localP2X;
        this.simState.p2Mallet.y = this.localP2Y;
        this.gameService.sendAirhockeyMallet(this.localP2X, this.localP2Y);
        this.rtc.send({ type: 'mallet', x: this.localP2X, y: this.localP2Y });
      }
    }
  }

  private tickSimulation(ts: number) {
    if (!this.lastFrameTs) { this.lastFrameTs = ts; return; }
    const delta = Math.min(ts - this.lastFrameTs, 100);
    this.lastFrameTs = ts;

    if (!this.simState) return;
    this.accumulator += delta;

    const maxAccumulator = this.STEP_MS * 2;
    if (this.accumulator > maxAccumulator) this.accumulator = maxAccumulator;

    while (this.accumulator >= this.STEP_MS) {
      this.stepOpponentMallet();
      stepAirhockey(this.simState);
      this.accumulator -= this.STEP_MS;
    }
  }

  private stepOpponentMallet() {
    const sim = this.simState!;
    const isLocal = this.room()?.isLocal ?? false;
    const myNum = this.myPlayerNum();
    if (isLocal || !myNum) return;

    const LERP = 0.35; // Interpolation de la position de l'adversaire
    if (myNum === 1) {
      const targetX = this.rtcOppX ?? this.serverP2X;
      const targetY = this.rtcOppY ?? this.serverP2Y;
      sim.p2Mallet.x = sim.p2Mallet.x + (targetX - sim.p2Mallet.x) * LERP;
      sim.p2Mallet.y = sim.p2Mallet.y + (targetY - sim.p2Mallet.y) * LERP;
    } else {
      const targetX = this.rtcOppX ?? this.serverP1X;
      const targetY = this.rtcOppY ?? this.serverP1Y;
      sim.p1Mallet.x = sim.p1Mallet.x + (targetX - sim.p1Mallet.x) * LERP;
      sim.p1Mallet.y = sim.p1Mallet.y + (targetY - sim.p1Mallet.y) * LERP;
    }
  }

  private resizeCanvas() {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const availW = parent.clientWidth - 16;
    const availH = parent.clientHeight - 16;
    // Format carré 1:1 pour correspondre à notre espace physique
    const size = Math.min(availW, availH, 600);
    canvas.width = size;
    canvas.height = size;
  }

  private startLoop() {
    const loop = (ts: number) => {
      this.tickSimulation(ts);
      this.drawFrame();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private onHit(hit: string, state: any) {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const size = canvas.width;
    const pX = (state.puck.x / 100) * size;
    const pY = (state.puck.y / 100) * size;

    if (hit === 'p1') {
      this.malletFlash.p1 = 1.0;
      this.spawnParticles(pX, pY, '#00E676', 15);
    } else if (hit === 'p2') {
      this.malletFlash.p2 = 1.0;
      this.spawnParticles(pX, pY, '#00E5FF', 15);
    } else if (hit === 'wall') {
      this.wallFlash = 1.0;
      this.spawnParticles(pX, pY, 'rgba(255,255,255,0.8)', 8);
    }
  }

  private spawnParticles(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 1.8 + Math.random() * 4.2;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 1.0,
        color,
        radius: 1.2 + Math.random() * 2.8
      });
    }
    if (this.particles.length > 250) this.particles.splice(0, this.particles.length - 250);
  }

  private lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

  private drawFrame() {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas || !this.simState) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const S = canvas.width;
    const sim = this.simState;
    const isLocal = this.room()?.isLocal ?? false;

    // Decay timers
    this.scoreFlash.p1   = Math.max(0, this.scoreFlash.p1   - 1 / 55);
    this.scoreFlash.p2   = Math.max(0, this.scoreFlash.p2   - 1 / 55);
    this.malletFlash.p1  = Math.max(0, this.malletFlash.p1  - 1 / 20);
    this.malletFlash.p2  = Math.max(0, this.malletFlash.p2  - 1 / 20);
    this.wallFlash       = Math.max(0, this.wallFlash       - 1 / 15);

    // Filter particles
    this.particles = this.particles.filter(p => {
      p.x += p.vx; p.y += p.vy; p.vx *= 0.93; p.vy *= 0.93; p.life -= 1 / 32;
      return p.life > 0;
    });

    // Trail update
    const pX = (sim.puck.x / 100) * S;
    const pY = (sim.puck.y / 100) * S;
    const pR = (sim.puck.radius / 100) * S;

    if (!sim.serving) {
      this.trail.push({ x: pX, y: pY });
      if (this.trail.length > this.TRAIL_LEN) this.trail.shift();
    } else {
      this.trail = [];
    }

    // Dynamic neon glow
    const speed = Math.sqrt(sim.puck.vx * sim.puck.vx + sim.puck.vy * sim.puck.vy);
    const speedT = Math.min(speed / 3.0, 1);
    const glowR = 15 + speedT * 30;
    canvas.style.boxShadow = [
      '0 0 0 2px rgba(255,255,255,0.04)',
      `0 0 ${glowR}px rgba(255,46,99,${0.25 + speedT * 0.35})`,
      `0 0 ${glowR * 2}px rgba(0,229,255,${0.06 + speedT * 0.1})`
    ].join(', ');

    // 1. Fond Cyberpunk de la table
    ctx.fillStyle = '#09090f';
    ctx.fillRect(0, 0, S, S);

    // Wall flash effect on borders
    if (this.wallFlash > 0) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${this.wallFlash * 0.25})`;
      ctx.lineWidth = 6;
      ctx.strokeRect(0, 0, S, S);
    }

    // Grid neon subtile
    ctx.strokeStyle = 'rgba(255,255,255,0.015)';
    ctx.lineWidth = 1;
    const gs = S / 12;
    for (let gx = 0; gx < S; gx += gs) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, S); ctx.stroke(); }
    for (let gy = 0; gy < S; gy += gs) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(S, gy); ctx.stroke(); }

    // 2. Lignes de la table d'Air Hockey
    // Ligne centrale
    ctx.strokeStyle = 'rgba(255, 46, 99, 0.22)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(S / 2, 0); ctx.lineTo(S / 2, S); ctx.stroke();

    // Cercle central
    ctx.strokeStyle = 'rgba(255, 46, 99, 0.15)';
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S * 0.15, 0, Math.PI * 2);
    ctx.stroke();

    // Demi-cercles des zones de but
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.12)';
    ctx.beginPath(); ctx.arc(0, S / 2, S * 0.25, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(S, S / 2, S * 0.25, Math.PI / 2, -Math.PI / 2); ctx.stroke();

    // 3. Dessiner les Cages de But (Goals)
    const goalT = 0.32 * S;
    const goalB = 0.68 * S;

    // But gauche (J1)
    ctx.fillStyle = 'rgba(255, 46, 99, 0.1)';
    ctx.fillRect(0, goalT, 8, goalB - goalT);
    ctx.strokeStyle = '#FF2E63';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, goalT); ctx.lineTo(0, goalB); ctx.stroke();

    // But droit (J2)
    ctx.fillStyle = 'rgba(0, 229, 255, 0.1)';
    ctx.fillRect(S - 8, goalT, 8, goalB - goalT);
    ctx.strokeStyle = '#00E5FF';
    ctx.beginPath(); ctx.moveTo(S, goalT); ctx.lineTo(S, goalB); ctx.stroke();

    // 4. Noms des joueurs
    const nameSize = Math.max(10, Math.floor(S * 0.045));
    ctx.font = `600 ${nameSize}px 'Inter', sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0,230,118,0.55)'; ctx.textAlign = 'left';  ctx.fillText(this.player1Name(), S * 0.05, S * 0.05);
    ctx.fillStyle = 'rgba(0,229,255,0.55)'; ctx.textAlign = 'right'; ctx.fillText(this.player2Name(), S * 0.95, S * 0.05);

    // 5. Affichage des Scores
    const baseScoreSize = Math.floor(S * 0.1);
    const scoreY = S * 0.05 + nameSize + 6;

    const sf1 = this.scoreFlash.p1;
    ctx.font = `bold ${baseScoreSize + Math.round(sf1 * baseScoreSize * 0.4)}px 'Courier New', monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = sf1 > 0 ? `rgba(0,230,118,${0.5 + sf1 * 0.5})` : 'rgba(255,255,255,0.2)';
    ctx.fillText(String(sim.scoreP1), S * 0.25, scoreY);

    const sf2 = this.scoreFlash.p2;
    ctx.font = `bold ${baseScoreSize + Math.round(sf2 * baseScoreSize * 0.4)}px 'Courier New', monospace`;
    ctx.fillStyle = sf2 > 0 ? `rgba(0,229,255,${0.5 + sf2 * 0.5})` : 'rgba(255,255,255,0.2)';
    ctx.fillText(String(sim.scoreP2), S * 0.75, scoreY);

    // 6. Countdown du service
    if (sim.serving) {
      const secs = Math.ceil(sim.serveCountdown / 60);
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 200);
      ctx.save();
      ctx.font = `bold ${Math.floor(S * 0.08)}px 'Courier New', monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = `rgba(255,255,255,${0.35 + pulse * 0.45})`;
      ctx.fillText(secs > 0 ? String(secs) : '▶', S / 2, S / 2);
      ctx.restore();
    }

    // 7. Dessin de la Traînée du Palet (Trail)
    for (let i = 0; i < this.trail.length; i++) {
      const frac = i / this.trail.length;
      const alpha = frac * frac * 0.4;
      ctx.beginPath();
      ctx.arc(this.trail[i].x, this.trail[i].y, pR * frac * 0.9, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 46, 99, ${alpha})`;
      ctx.fill();
    }

    // 8. Dessin des Particules
    for (const p of this.particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // 9. Dessin des Mallets (Poussoirs)
    const drawMallet = (mX: number, mY: number, radius: number, activeGlow: number, color: string, colorGlow: string) => {
      const pxX = (mX / 100) * S;
      const pxY = (mY / 100) * S;
      const pxR = (radius / 100) * S;

      // Glow externe
      ctx.fillStyle = activeGlow > 0 ? `rgba(255, 255, 255, ${0.15 + activeGlow * 0.4})` : colorGlow;
      ctx.beginPath();
      ctx.arc(pxX, pxY, pxR + 5, 0, Math.PI * 2);
      ctx.fill();

      // Corps du poussoir
      const grad = ctx.createRadialGradient(pxX, pxY, pxR * 0.1, pxX, pxY, pxR);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, color);
      grad.addColorStop(0.9, '#1a1a24');
      grad.addColorStop(1, '#000000');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(pxX, pxY, pxR, 0, Math.PI * 2);
      ctx.fill();

      // Anneau métallique intérieur
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(pxX, pxY, pxR * 0.65, 0, Math.PI * 2);
      ctx.stroke();

      // Poignée centrale
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pxX, pxY, pxR * 0.35, 0, Math.PI * 2);
      ctx.fill();
    };

    // J1 Mallet
    drawMallet(
      sim.p1Mallet.x,
      sim.p1Mallet.y,
      sim.p1Mallet.radius,
      this.malletFlash.p1,
      '#00C853',
      'rgba(0, 230, 118, 0.16)'
    );

    // J2 Mallet
    drawMallet(
      sim.p2Mallet.x,
      sim.p2Mallet.y,
      sim.p2Mallet.radius,
      this.malletFlash.p2,
      '#0091EA',
      'rgba(0, 229, 255, 0.16)'
    );

    // 10. Dessiner le Palet (Puck)
    if (!sim.serving) {
      // Glow du palet
      ctx.fillStyle = `rgba(255, 46, 99, ${0.2 + speedT * 0.2})`;
      ctx.beginPath();
      ctx.arc(pX, pY, pR + 4, 0, Math.PI * 2);
      ctx.fill();

      // Palet lui-même (disque métallique avec bordure brillante)
      const gradPuck = ctx.createRadialGradient(pX, pY, pR * 0.1, pX, pY, pR);
      gradPuck.addColorStop(0, '#ffffff');
      gradPuck.addColorStop(0.2, '#ff5e7e');
      gradPuck.addColorStop(0.8, '#ff2e63');
      gradPuck.addColorStop(1, '#6b001a');

      ctx.fillStyle = gradPuck;
      ctx.beginPath();
      ctx.arc(pX, pY, pR, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
