/**
 * SnakeComponent — Snake vs Snake
 *
 * Rendu canvas 60 fps avec interpolation entre les ticks serveur (15 Hz).
 * Input : flèches / WASD. Mode local : P1 = WASD, P2 = flèches.
 * Touch : swipe directionnel.
 */

import {
  Component, ViewChild, ElementRef, AfterViewInit, OnDestroy,
  inject, computed, effect,
} from '@angular/core';
import { GameService } from '../../services/game.service';
import { GameLayoutComponent } from '../game-layout/game-layout.component';
import { FloatingEmojisComponent } from '../floating-emojis/floating-emojis.component';
import { injectGameSession } from '../../services/game-session.helper';
import { injectWebRtcSession } from '../../services/webrtc-session.helper';

// ── Types (mirrors backend snake.ts) ─────────────────────────────────────────
type Direction = 'up' | 'down' | 'left' | 'right';

interface SnakeCell  { x: number; y: number; }
interface SnakePlayer {
  body:    SnakeCell[];
  dir:     Direction;
  nextDir: Direction;
  score:   number;
  alive:   boolean;
}
interface SnakeState {
  width:     number;
  height:    number;
  p1:        SnakePlayer;
  p2:        SnakePlayer;
  food:      SnakeCell[];
  winner:    number | null;
  tickCount: number;
  playerIds: [string, string];
  p1Ready?:  boolean;
  p2Ready?:  boolean;
  speedHz?:  number;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const CELL_SIZE = 24;     // px per grid cell (before scaling)
const P1_HEAD   = '#00E676';
const P1_BODY   = '#00BFA5';
const P2_HEAD   = '#00E5FF';
const P2_BODY   = '#0097A7';
const FOOD_COL  = '#FF5252';
const BG_COL    = '#0a0a0f';
const GRID_COL  = 'rgba(255,255,255,0.03)';

@Component({
  selector: 'app-snake',
  standalone: true,
  imports: [GameLayoutComponent, FloatingEmojisComponent],
  template: `
    <app-game-layout
      gameTitle="Snake vs"
      [rules]="rules"
      [room]="room()"
      [isPlaying]="isPlaying()"
      [isMyTurn]="isPlaying()"
      turnAlertText="Déplacez votre serpent !"
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
      <div game-board class="snake-board">
        <app-floating-emojis [emojis]="floatingEmojis()"></app-floating-emojis>
        <canvas #snakeCanvas class="snake-canvas"
          (touchstart)="onTouchStart($event)"
          (touchend)="onTouchEnd($event)">
        </canvas>
        @if (!isPlaying() && room()?.status !== 'finished') {
          <div class="waiting-overlay">En attente de l'adversaire…</div>
        }
        @if (room()?.status === 'playing' && (!snakeState()?.p1Ready || !snakeState()?.p2Ready)) {
          <div class="ready-overlay-panel">
            <div class="ready-modal-card">
              <h3 class="ready-title">Prêt à jouer ?</h3>
              <p class="ready-subtitle">Le jeu commencera quand les deux joueurs auront validé.</p>
              
              <div class="ready-indicators">
                <div class="ready-pill" [class.ready-ok]="snakeState()?.p1Ready">
                  <span class="ready-dot"></span>
                  <span class="ready-name">{{ player1Name() }}</span>
                  <span class="ready-text">{{ snakeState()?.p1Ready ? 'Prêt' : 'En attente...' }}</span>
                </div>
                <div class="ready-pill" [class.ready-ok]="snakeState()?.p2Ready">
                  <span class="ready-dot"></span>
                  <span class="ready-name">{{ player2Name() }}</span>
                  <span class="ready-text">{{ snakeState()?.p2Ready ? 'Prêt' : 'En attente...' }}</span>
                </div>
              </div>

              @if (isLocal()) {
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
    .snake-board {
      position: relative;
      width: 100%;
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: ${BG_COL};
      overflow: hidden;
    }
    .snake-canvas {
      display: block;
      image-rendering: pixelated;
    }
    .waiting-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.6);
      color: #fff;
      font-size: 1.2rem;
    }
    .ready-overlay-panel {
      position: absolute;
      inset: 0;
      background: rgba(10, 10, 15, 0.85);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
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
      box-shadow: 0 10px 30px rgba(0,0,0,0.5), 0 0 40px rgba(0,230,118,0.15);
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
      background: rgba(0, 230, 118, 0.08);
      border-color: rgba(0, 230, 118, 0.3);
    }
    .ready-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: rgba(255,255,255,0.3);
      transition: all 0.3s ease;
    }
    .ready-pill.ready-ok .ready-dot {
      background: #00E676;
      box-shadow: 0 0 8px #00E676;
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
      color: #00E676;
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
      background: #00E676;
      color: #000;
    }
    .ready-action-btn.active-ready:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(0, 230, 118, 0.4);
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
      0% { box-shadow: 0 0 0 0 rgba(0, 230, 118, 0.4); }
      70% { box-shadow: 0 0 0 10px rgba(0, 230, 118, 0); }
      100% { box-shadow: 0 0 0 0 rgba(0, 230, 118, 0); }
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
  `],
})
export class SnakeComponent implements AfterViewInit, OnDestroy {
  @ViewChild('snakeCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private gameService = inject(GameService);

  // ── Game session boilerplate ───────────────────────────────────────────────
  private session = injectGameSession('snake');
  /** Canal WebRTC P2P — relaye les directions à l'adversaire avec la latence minimale. */
  private rtc     = injectWebRtcSession('snake');
  private onResize = () => this.resizeCanvas();
  room             = this.session.room;
  floatingEmojis   = this.session.floatingEmojis;
  isPlaying        = this.session.isPlaying;
  player1Name      = this.session.player1Name;
  player2Name      = this.session.player2Name;
  disconnectedPlayerName = this.session.disconnectedPlayerName;
  hasVotedRematch  = this.session.hasVotedRematch;
  leaveRoom        = this.session.leaveRoom;
  requestRematch   = this.session.requestRematch;
  forceEnd         = this.session.forceEnd;
  sendEmoji        = this.session.sendEmoji;
  shareInvitationLink = this.session.shareInvitationLink;

  // ── Derived signals ────────────────────────────────────────────────────────
  myPlayerNum = computed(() => {
    const room = this.room();
    const socketId = this.gameService.getSocketId();
    if (!room) return 1;
    const idx = room.players.findIndex(p => p.id === socketId);
    return idx === 1 ? 2 : 1;
  });

  isLocal = computed(() => !!this.room()?.isLocal);

  amIReady = computed(() => {
    const s = this.snakeState();
    if (!s) return false;
    if (this.isLocal()) return s.p1Ready && s.p2Ready;
    return this.myPlayerNum() === 1 ? !!s.p1Ready : !!s.p2Ready;
  });

  setReady() {
    const r = this.room();
    if (r) {
      this.gameService.sendPlayerReady(r.id);
    }
  }

  winnerLabel = computed(() => {
    const s = this.snakeState();
    if (s?.winner === null || s?.winner === undefined) return '';
    if (s.winner === 0) return 'Égalité !';
    return s.winner === this.myPlayerNum() ? 'Victoire !' : `Joueur ${s.winner} gagne !`;
  });

  isWinner = computed(() => {
    const s = this.snakeState();
    return s?.winner !== null && s?.winner !== undefined && s?.winner !== 0
      && s.winner === this.myPlayerNum();
  });

  isLoser = computed(() => {
    const s = this.snakeState();
    return s?.winner !== null && s?.winner !== undefined && s?.winner !== 0
      && s.winner !== this.myPlayerNum();
  });

  scoreLabel = computed(() => {
    const s = this.snakeState();
    if (!s) return '0 - 0';
    return `${s.p1.score} - ${s.p2.score}`;
  });

  snakeState = computed<SnakeState | null>(() => {
    // liveSnakeState is set at 15 Hz; falls back to room().gameState for initial state.
    const live = this.gameService.liveSnakeState();
    if (live) return live as SnakeState;
    const room = this.room();
    return room?.gameType === 'snake' ? (room.gameState as SnakeState) : null;
  });

  rules = [
    'Deux serpents sur la même grille 25×20.',
    'Mangez les pommes pour grandir et marquer des points.',
    'Évitez les murs, votre propre corps et l\'adversaire.',
    'P1 (vert) : flèches ← → ↑ ↓',
    'P2 (cyan, mode local) : WASD',
    'Mobile : swipe pour changer de direction.',
  ];

  // ── Rendering ─────────────────────────────────────────────────────────────
  private ctx!: CanvasRenderingContext2D;
  private rafId  = 0;
  private prevState: SnakeState | null = null;
  private currState: SnakeState | null = null;
  /** Interpolation progress 0→1 between two server ticks */
  private lerpT    = 0;
  private lastTickCount = -1;
  /** Timestamp of last received server tick */
  private lastTickTime  = 0;
  private measuredTickMs = 1000 / 15;

  /** Pending direction changes queued before the component is fully init'd */
  private pendingDirs: { dir: Direction; playerIndex?: number }[] = [];

  // ── Touch ──────────────────────────────────────────────────────────────────
  private touchStartX = 0;
  private touchStartY = 0;

  // ── Angular lifecycle ──────────────────────────────────────────────────────

  constructor() {
    // React to state updates from the server
    effect(() => {
      const s = this.snakeState();
      if (!s) return;
      if (s.tickCount !== this.lastTickCount) {
        this.prevState     = this.currState ? structuredClone(this.currState) : null;
        this.currState     = s;
        this.lastTickCount = s.tickCount;
        this.lastTickTime  = performance.now();
        this.lerpT         = 0;

        if (s.speedHz) {
          this.measuredTickMs = 1000 / s.speedHz;
        }
      }
    });

    // ── Recevoir les directions de l'adversaire via WebRTC ────────────────────
    // En mode en ligne, l'adversaire envoie { type:'dir', dir, playerIndex }
    // directement en P2P → latence divisée par 2 par rapport à socket.io.
    // Le serveur reste autoritaire : la direction P2P ne fait qu'anticiper le
    // prochain tick pour l'interpolation (pas besoin de logique de prédiction
    // ici car le serveur tourne à seulement 15 Hz).
    effect(() => {
      const msg = this.rtc.lastMessage() as any;
      if (msg?.type === 'dir' && typeof msg.dir === 'string') {
        // Transmis directement au serveur pour cohérence — le canal P2P permet
        // surtout à l'adversaire de voir notre direction AVANT le prochain tick.
        // Rien à faire côté rendu : le prochain snakeUpdate du serveur intégrera
        // la direction. Ce canal sert principalement au futur affichage prédictif.
      }
    });
  }

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.resizeCanvas();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    this.loop();
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
  }

  // ── Canvas sizing ──────────────────────────────────────────────────────────

  private get cols() { return this.currState?.width  ?? 25; }
  private get rows() { return this.currState?.height ?? 20; }

  private cellPx = CELL_SIZE;

  private resizeCanvas(): void {
    const canvas  = this.canvasRef.nativeElement;
    const parent  = canvas.parentElement!;
    const maxW    = parent.clientWidth  - 16;
    const maxH    = parent.clientHeight - 16;
    const cellW   = Math.floor(maxW / this.cols);
    const cellH   = Math.floor(maxH / this.rows);
    this.cellPx   = Math.max(10, Math.min(cellW, cellH));
    canvas.width  = this.cellPx * this.cols;
    canvas.height = this.cellPx * this.rows;
  }

  // ── Main render loop ───────────────────────────────────────────────────────

  private loop = () => {
    this.rafId = requestAnimationFrame(this.loop);
    if (!this.currState) return;

    const now    = performance.now();
    const elapsed = now - this.lastTickTime;
    // Clamp lerp to [0,1]; once reached 1, hold until next tick
    this.lerpT    = Math.min(1, elapsed / this.measuredTickMs);

    this.render(this.lerpT);
  };

  private render(t: number): void {
    const ctx  = this.ctx;
    const cp   = this.cellPx;
    const cols = this.cols;
    const rows = this.rows;
    const s    = this.currState!;
    const prev = this.prevState;

    ctx.clearRect(0, 0, cols * cp, rows * cp);

    // Background
    ctx.fillStyle = BG_COL;
    ctx.fillRect(0, 0, cols * cp, rows * cp);

    // Grid
    ctx.strokeStyle = GRID_COL;
    ctx.lineWidth   = 1;
    for (let x = 0; x <= cols; x++) {
      ctx.beginPath(); ctx.moveTo(x * cp, 0); ctx.lineTo(x * cp, rows * cp); ctx.stroke();
    }
    for (let y = 0; y <= rows; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * cp); ctx.lineTo(cols * cp, y * cp); ctx.stroke();
    }

    // Food — pulse animation
    const pulse = 0.85 + 0.15 * Math.sin(Date.now() / 200);
    s.food.forEach(f => {
      const cx = (f.x + 0.5) * cp;
      const cy = (f.y + 0.5) * cp;
      const r  = cp * 0.35 * pulse;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = FOOD_COL;
      ctx.fill();
      // Glow
      ctx.shadowBlur  = 10;
      ctx.shadowColor = FOOD_COL;
      ctx.fill();
      ctx.shadowBlur  = 0;
    });

    // Snakes
    this.drawSnake(ctx, s.p1, prev?.p1 ?? null, t, P1_HEAD, P1_BODY, cp);
    this.drawSnake(ctx, s.p2, prev?.p2 ?? null, t, P2_HEAD, P2_BODY, cp);

    // Score overlay
    ctx.font        = `bold ${cp * 0.8}px monospace`;
    ctx.textAlign   = 'left';
    ctx.fillStyle   = P1_HEAD;
    ctx.globalAlpha = 0.9;
    ctx.fillText(`P1: ${s.p1.score}`, cp * 0.3, cp * 1);

    ctx.textAlign   = 'right';
    ctx.fillStyle   = P2_HEAD;
    ctx.fillText(`P2: ${s.p2.score}`, (cols - 0.3) * cp, cp * 1);
    ctx.globalAlpha = 1;

    // Dead markers
    if (!s.p1.alive) this.drawX(ctx, s.p1.body[0], cp, P1_HEAD);
    if (!s.p2.alive) this.drawX(ctx, s.p2.body[0], cp, P2_HEAD);
  }

  private drawSnake(
    ctx: CanvasRenderingContext2D,
    snake: SnakePlayer,
    prev: SnakePlayer | null,
    t: number,
    headColor: string,
    bodyColor: string,
    cp: number,
  ): void {
    if (!snake.alive && snake.body.length === 0) return;

    const alpha = snake.alive ? 1 : 0.35;
    ctx.globalAlpha = alpha;

    snake.body.forEach((cell, i) => {
      // Interpolate head position between prev and current
      let rx = cell.x, ry = cell.y;
      if (i === 0 && prev && prev.body.length > 0 && t < 1) {
        const ph = prev.body[0];
        // Interpolate only if the move makes sense (no teleport = wrap-around guard)
        const dx = cell.x - ph.x, dy = cell.y - ph.y;
        if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
          rx = ph.x + dx * t;
          ry = ph.y + dy * t;
        }
      }

      const margin = i === 0 ? 0.05 : 0.08;
      const x = (rx + margin) * cp;
      const y = (ry + margin) * cp;
      const s = (1 - 2 * margin) * cp;

      const ratio = i / Math.max(1, snake.body.length - 1);
      // Gradient from head colour to body colour
      ctx.fillStyle = i === 0 ? headColor : this.lerpColor(headColor, bodyColor, ratio);

      const r = cp * 0.25;
      ctx.beginPath();
      ctx.roundRect(x, y, s, s, r);
      ctx.fill();

      // Eyes on head
      if (i === 0 && snake.alive) {
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        const eyeR  = cp * 0.1;
        const offX  = cp * 0.25;
        const offY  = cp * 0.25;
        const [ex1, ey1, ex2, ey2] = this.eyePositions(snake.dir, rx * cp, ry * cp, cp, offX, offY);
        ctx.beginPath(); ctx.arc(ex1, ey1, eyeR, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(ex2, ey2, eyeR, 0, Math.PI * 2); ctx.fill();
      }
    });

    ctx.globalAlpha = 1;
  }

  private eyePositions(
    dir: Direction, hx: number, hy: number, cp: number, ox: number, oy: number,
  ): [number, number, number, number] {
    const cx = hx + cp / 2, cy = hy + cp / 2;
    if (dir === 'right') return [cx + ox, cy - oy, cx + ox, cy + oy];
    if (dir === 'left')  return [cx - ox, cy - oy, cx - ox, cy + oy];
    if (dir === 'up')    return [cx - oy, cy - ox, cx + oy, cy - ox];
    /* down */           return [cx - oy, cy + ox, cx + oy, cy + ox];
  }

  private drawX(ctx: CanvasRenderingContext2D, cell: SnakeCell, cp: number, color: string): void {
    ctx.strokeStyle = color;
    ctx.lineWidth   = 3;
    ctx.globalAlpha = 0.8;
    const x = cell.x * cp + cp * 0.15;
    const y = cell.y * cp + cp * 0.15;
    const s = cp * 0.7;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s, y + s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + s, y); ctx.lineTo(x, y + s); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private lerpColor(c1: string, c2: string, t: number): string {
    const r1 = parseInt(c1.slice(1, 3), 16);
    const g1 = parseInt(c1.slice(3, 5), 16);
    const b1 = parseInt(c1.slice(5, 7), 16);
    const r2 = parseInt(c2.slice(1, 3), 16);
    const g2 = parseInt(c2.slice(3, 5), 16);
    const b2 = parseInt(c2.slice(5, 7), 16);
    const r  = Math.round(r1 + (r2 - r1) * t);
    const g  = Math.round(g1 + (g2 - g1) * t);
    const b  = Math.round(b1 + (b2 - b1) * t);
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  private onKeyDown = (e: KeyboardEvent): void => {
    const s = this.snakeState();
    const isPlaying = this.isPlaying();
    const notReady = s && (!s.p1Ready || !s.p2Ready);

    if (isPlaying && notReady) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        this.setReady();
        return;
      }
    }

    if (!isPlaying || notReady) return;

    const isLocal = this.isLocal();
    const myNum   = this.myPlayerNum();

    // Map key to dir + playerIndex (for local mode)
    let dir: Direction | null = null;
    let playerIndex: number | undefined = undefined;

    switch (e.key) {
      // P1 arrows (or online player)
      case 'ArrowUp':    dir = 'up';    if (isLocal) playerIndex = 0; break;
      case 'ArrowDown':  dir = 'down';  if (isLocal) playerIndex = 0; break;
      case 'ArrowLeft':  dir = 'left';  if (isLocal) playerIndex = 0; break;
      case 'ArrowRight': dir = 'right'; if (isLocal) playerIndex = 0; break;
      // P2 WASD (local only)
      case 'w': case 'W': dir = 'up';    playerIndex = isLocal ? 1 : undefined; break;
      case 's': case 'S': dir = 'down';  playerIndex = isLocal ? 1 : undefined; break;
      case 'a': case 'A': dir = 'left';  playerIndex = isLocal ? 1 : undefined; break;
      case 'd': case 'D': dir = 'right'; playerIndex = isLocal ? 1 : undefined; break;
    }

    if (!dir) return;
    e.preventDefault();

    // Envoyer via socket.io (autoritaire) ET WebRTC P2P (faible latence)
    // En local, playerIndex est fourni ; en ligne, le serveur identifie via socket.id.
    this.gameService.sendSnakeDirection(dir, playerIndex);

    // Relayer en P2P uniquement en mode en ligne (en local le WebRTC n'est pas init)
    if (!isLocal) {
      this.rtc.send({ type: 'dir', dir });
    }
  };

  // ── Touch ──────────────────────────────────────────────────────────────────

  onTouchStart(e: TouchEvent): void {
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
  }

  onTouchEnd(e: TouchEvent): void {
    const s = this.snakeState();
    const isPlaying = this.isPlaying();
    const notReady = s && (!s.p1Ready || !s.p2Ready);

    if (!isPlaying || notReady) return;
    const dx = e.changedTouches[0].clientX - this.touchStartX;
    const dy = e.changedTouches[0].clientY - this.touchStartY;
    const absDx = Math.abs(dx), absDy = Math.abs(dy);
    if (Math.max(absDx, absDy) < 20) return; // ignore tap
    const dir: Direction = absDx > absDy
      ? (dx > 0 ? 'right' : 'left')
      : (dy > 0 ? 'down'  : 'up');
    // Touch controls always map to "my" snake
    this.gameService.sendSnakeDirection(dir, this.isLocal() ? 0 : undefined);
    if (!this.isLocal()) {
      this.rtc.send({ type: 'dir', dir });
    }
  }
}
