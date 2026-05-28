/**
 * TetrisComponent — Tetris vs (2 joueurs)
 *
 * Rendu canvas 60 fps.
 * Layout : votre board au centre, board adverse réduit sur le côté.
 * Panneaux latéraux : Hold (gauche), Next×3 + Garbage (droite).
 * Ghost piece, line-clear flash, DAS/ARR pour les déplacements latéraux.
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

// ── Types (mirrors backend tetris.ts) ────────────────────────────────────────
type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

interface ActivePiece { type: PieceType; x: number; y: number; rotation: number; }

interface TetrisPlayerState {
  board:          number[][];
  current:        ActivePiece | null;
  nextPieces:     PieceType[];
  held:           PieceType | null;
  holdUsed:       boolean;
  score:          number;
  level:          number;
  linesCleared:   number;
  garbageQueue:   number;
  topOut:         boolean;
}

interface TetrisState {
  players:   { p1: TetrisPlayerState; p2: TetrisPlayerState };
  playerIds: [string, string];
  winner:    number | null;
}

// ── Piece shape data (client-side, for ghost + rendering) ────────────────────
const PIECES: Record<PieceType, [number,number][][]> = {
  I: [[[0,1],[1,1],[2,1],[3,1]],[[2,0],[2,1],[2,2],[2,3]],[[0,2],[1,2],[2,2],[3,2]],[[1,0],[1,1],[1,2],[1,3]]],
  O: [[[1,0],[2,0],[1,1],[2,1]],[[1,0],[2,0],[1,1],[2,1]],[[1,0],[2,0],[1,1],[2,1]],[[1,0],[2,0],[1,1],[2,1]]],
  T: [[[1,0],[0,1],[1,1],[2,1]],[[1,0],[1,1],[2,1],[1,2]],[[0,1],[1,1],[2,1],[1,2]],[[1,0],[0,1],[1,1],[1,2]]],
  S: [[[1,0],[2,0],[0,1],[1,1]],[[1,0],[1,1],[2,1],[2,2]],[[1,1],[2,1],[0,2],[1,2]],[[0,0],[0,1],[1,1],[1,2]]],
  Z: [[[0,0],[1,0],[1,1],[2,1]],[[2,0],[1,1],[2,1],[1,2]],[[0,1],[1,1],[1,2],[2,2]],[[1,0],[0,1],[1,1],[0,2]]],
  J: [[[0,0],[0,1],[1,1],[2,1]],[[1,0],[2,0],[1,1],[1,2]],[[0,1],[1,1],[2,1],[2,2]],[[1,0],[1,1],[0,2],[1,2]]],
  L: [[[2,0],[0,1],[1,1],[2,1]],[[1,0],[1,1],[1,2],[2,2]],[[0,1],[1,1],[2,1],[0,2]],[[0,0],[1,0],[1,1],[1,2]]],
};

// Colour per piece index (0=empty, 8=garbage)
const COLORS: Record<number, string> = {
  0: 'transparent',
  1: '#00E5FF',  // I  cyan
  2: '#FFD600',  // O  yellow
  3: '#E040FB',  // T  purple
  4: '#69F0AE',  // S  green
  5: '#FF5252',  // Z  red
  6: '#448AFF',  // J  blue
  7: '#FF9100',  // L  orange
  8: '#607D8B',  // garbage
};
const PIECE_COLOR: Record<PieceType, number> = { I:1,O:2,T:3,S:4,Z:5,J:6,L:7 };

const COLS = 10;
const ROWS = 20;
const BG   = '#0a0a0f';

// DAS / ARR
const DAS_MS  = 150;  // ms before auto-repeat starts
const ARR_MS  = 30;   // ms between repeats

@Component({
  selector: 'app-tetris',
  standalone: true,
  imports: [GameLayoutComponent, FloatingEmojisComponent],
  template: `
    <app-game-layout
      gameTitle="Tetris vs"
      [rules]="rules"
      [room]="room()"
      [isPlaying]="isPlaying()"
      [isMyTurn]="isPlaying()"
      turnAlertText="Jouez !"
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
      <div game-board class="tetris-board">
        <app-floating-emojis [emojis]="floatingEmojis()"></app-floating-emojis>
        <canvas #tetrisCanvas class="tetris-canvas"
          (touchstart)="onTouchStart($event)"
          (touchend)="onTouchEnd($event)">
        </canvas>
        @if (!isPlaying() && room()?.status !== 'finished') {
          <div class="waiting-overlay">En attente de l'adversaire…</div>
        }
      </div>
    </app-game-layout>
  `,
  styles: [`
    .tetris-board {
      position: relative;
      width: 100%;
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: ${BG};
      overflow: hidden;
    }
    .tetris-canvas { display: block; }
    .waiting-overlay {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.6); color: #fff; font-size: 1.2rem;
    }
  `],
})
export class TetrisComponent implements AfterViewInit, OnDestroy {
  @ViewChild('tetrisCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private gameService = inject(GameService);
  private session = injectGameSession('tetris');
  private rtc     = injectWebRtcSession('tetris');

  // ── Session boilerplate ────────────────────────────────────────────────────
  room                   = this.session.room;
  floatingEmojis         = this.session.floatingEmojis;
  isPlaying              = this.session.isPlaying;
  player1Name            = this.session.player1Name;
  player2Name            = this.session.player2Name;
  disconnectedPlayerName = this.session.disconnectedPlayerName;
  hasVotedRematch        = this.session.hasVotedRematch;
  leaveRoom              = this.session.leaveRoom;
  requestRematch         = this.session.requestRematch;
  forceEnd               = this.session.forceEnd;
  sendEmoji              = this.session.sendEmoji;
  shareInvitationLink    = this.session.shareInvitationLink;

  myPlayerNum = computed<1|2>(() => {
    const r  = this.room();
    const id = this.gameService.getSocketId();
    if (!r || !id) return 1;
    return r.players.findIndex(p => p.id === id) === 1 ? 2 : 1;
  });

  isLocal = computed(() => !!this.room()?.isLocal);

  tetrisState = computed<TetrisState | null>(() => {
    const r = this.room();
    return r?.gameType === 'tetris' ? (r.gameState as TetrisState) : null;
  });

  winnerLabel = computed(() => {
    const s = this.tetrisState();
    if (!s || s.winner === null) return '';
    if (s.winner === 0) return 'Égalité !';
    return s.winner === this.myPlayerNum() ? 'Victoire !' : `Joueur ${s.winner} gagne !`;
  });
  isWinner = computed(() => { const s = this.tetrisState(); return !!s && s.winner !== null && s.winner !== 0 && s.winner === this.myPlayerNum(); });
  isLoser  = computed(() => { const s = this.tetrisState(); return !!s && s.winner !== null && s.winner !== 0 && s.winner !== this.myPlayerNum(); });

  scoreLabel = computed(() => {
    const s = this.tetrisState();
    if (!s) return '0 - 0';
    return `${s.players.p1.score} - ${s.players.p2.score}`;
  });

  rules = `
    <strong>Tetris vs</strong> — Deux boards séparés, lignes effacées → garbage pour l'adversaire.<br>
    <b>Clavier :</b> ← → déplacer | ↑/X rotation droite | Z/Ctrl rotation gauche<br>
    ↓ soft drop | Espace hard drop | C/Shift hold<br>
    <b>Mobile :</b> swipe gauche/droite/bas, tap = rotation, swipe haut = hard drop.<br>
    <b>Garbage :</b> 2L→1, 3L→2, 4L (Tetris)→4.
  `;

  // ── Canvas & layout ────────────────────────────────────────────────────────
  private ctx!:     CanvasRenderingContext2D;
  private rafId = 0;
  private cellPx   = 24;
  private state: TetrisState | null = null;

  // Line-clear flash per player: row-index → remaining frames
  private flashP1: Map<number, number> = new Map();
  private flashP2: Map<number, number> = new Map();
  private prevBoardP1: number[][] | null = null;
  private prevBoardP2: number[][] | null = null;

  // ── DAS / ARR ──────────────────────────────────────────────────────────────
  private dasLeft  = 0;  // ms held
  private dasRight = 0;
  private arrLeft  = 0;  // ms since last repeat
  private arrRight = 0;
  private keysDown = new Set<string>();
  private lastFrameTs = 0;

  // ── Touch ──────────────────────────────────────────────────────────────────
  private touchX = 0;
  private touchY = 0;

  constructor() {
    effect(() => {
      const s = this.tetrisState();
      if (!s) return;

      // Detect cleared lines (rows that were full in prev board but gone now)
      this.detectFlash(s.players.p1, this.prevBoardP1, this.flashP1);
      this.detectFlash(s.players.p2, this.prevBoardP2, this.flashP2);
      this.prevBoardP1 = s.players.p1.board.map(r => [...r]);
      this.prevBoardP2 = s.players.p2.board.map(r => [...r]);
      this.state = s;
    });
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup',   this.onKeyUp);
    this.rafId = requestAnimationFrame(this.loop);
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup',   this.onKeyUp);
  }

  // ── Sizing ─────────────────────────────────────────────────────────────────

  private onResize = () => this.resize();

  private resize(): void {
    const canvas = this.canvasRef.nativeElement;
    const parent = canvas.parentElement!;
    const availH = parent.clientHeight - 8;
    const availW = parent.clientWidth  - 8;

    // Layout: [hold(3)] [gap] [myBoard(10)] [gap] [opponent(5+gap)] [next(4)]
    // Compute cell size so everything fits
    const cpByH = Math.floor(availH / ROWS);
    const cpByW = Math.floor(availW / (3 + 1 + COLS + 1 + 5 + 1 + 4));
    this.cellPx = Math.max(12, Math.min(cpByH, cpByW));

    const cp   = this.cellPx;
    const totalW = (3 + 1 + COLS + 1 + 5 + 1 + 4) * cp;
    const totalH = ROWS * cp;
    canvas.width  = totalW;
    canvas.height = totalH;
  }

  // ── Main loop ──────────────────────────────────────────────────────────────

  private loop = (ts: number) => {
    this.rafId = requestAnimationFrame(this.loop);
    const dt = ts - this.lastFrameTs;
    this.lastFrameTs = ts;

    this.processDAS(dt);
    if (this.state) this.render();
  };

  // ── Rendering ─────────────────────────────────────────────────────────────

  private render(): void {
    const s  = this.state!;
    const cp = this.cellPx;
    const ctx = this.ctx;
    const W  = this.canvasRef.nativeElement.width;
    const H  = this.canvasRef.nativeElement.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    const my  = this.myPlayerNum() === 1 ? s.players.p1 : s.players.p2;
    const opp = this.myPlayerNum() === 1 ? s.players.p2 : s.players.p1;
    const myFlash  = this.myPlayerNum() === 1 ? this.flashP1 : this.flashP2;
    const oppFlash = this.myPlayerNum() === 1 ? this.flashP2 : this.flashP1;

    // Column layout (in cells):
    // 0–2: hold panel (3)
    // 3: gap
    // 4–13: my board (10)
    // 14: gap
    // 15–19: opp board mini (5)
    // 20: gap
    // 21–24: next panel (4)
    const holdX  = 0;
    const myX    = (3 + 1) * cp;
    const oppX   = (3 + 1 + COLS + 1) * cp;
    const nextX  = (3 + 1 + COLS + 1 + 5 + 1) * cp;

    // ── My board ────────────────────────────────────────────────────────────
    this.drawBoard(ctx, my, myX, 0, cp, 1.0, myFlash);

    // ── Ghost piece ─────────────────────────────────────────────────────────
    if (my.current) {
      const gy = this.ghostY(my.board, my.current);
      this.drawPieceCells(ctx, my.current, myX, 0, cp, gy - my.current.y, 0.25);
    }

    // ── Current piece ────────────────────────────────────────────────────────
    if (my.current) {
      this.drawPieceCells(ctx, my.current, myX, 0, cp, 0, 1.0);
    }

    // ── Hold panel ──────────────────────────────────────────────────────────
    this.drawPanel(ctx, 'HOLD', holdX * cp, 0, 3 * cp, 4 * cp);
    if (my.held) {
      const alpha = my.holdUsed ? 0.4 : 1.0;
      this.drawMiniPiece(ctx, my.held, holdX * cp + cp * 0.5, cp * 1.2, cp * 0.6, alpha);
    }

    // ── Garbage indicator ────────────────────────────────────────────────────
    if (my.garbageQueue > 0) {
      const barH = Math.min(my.garbageQueue * cp, ROWS * cp);
      ctx.fillStyle = '#FF5252';
      ctx.globalAlpha = 0.85;
      ctx.fillRect(myX - 6, (ROWS * cp) - barH, 5, barH);
      ctx.globalAlpha = 1;
    }

    // ── Opponent board (mini, half scale) ────────────────────────────────────
    const oppScale = 0.5;
    const oppCp    = cp * oppScale;
    this.drawBoard(ctx, opp, oppX, (ROWS * cp - ROWS * oppCp) / 2, oppCp, 0.8, oppFlash);
    if (opp.current) {
      const gy = this.ghostY(opp.board, opp.current);
      this.drawPieceCells(ctx, opp.current, oppX, (ROWS * cp - ROWS * oppCp) / 2, oppCp, gy - opp.current.y, 0.2);
      this.drawPieceCells(ctx, opp.current, oppX, (ROWS * cp - ROWS * oppCp) / 2, oppCp, 0, 0.8);
    }

    // ── Next pieces panel ────────────────────────────────────────────────────
    this.drawPanel(ctx, 'NEXT', nextX, 0, 4 * cp, ROWS * cp);
    my.nextPieces.slice(0, 3).forEach((type, i) => {
      this.drawMiniPiece(ctx, type, nextX + cp * 0.3, cp * (1.2 + i * 3), cp * 0.65, 1.0);
    });

    // ── Scores ──────────────────────────────────────────────────────────────
    ctx.font      = `bold ${Math.max(10, cp * 0.55)}px monospace`;
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.9;
    ctx.textAlign = 'center';
    ctx.fillText(`LVL ${my.level}`, myX + COLS * cp / 2, cp * 0.8);
    ctx.fillText(`${my.score}`, myX + COLS * cp / 2, ROWS * cp - cp * 0.2);
    ctx.globalAlpha = 0.6;
    ctx.font = `${Math.max(8, cp * 0.45)}px monospace`;
    ctx.fillText(`${opp.score}`, oppX + 5 * oppCp / 2, (ROWS * cp - ROWS * oppCp) / 2 - 4);
    ctx.globalAlpha = 1;

    // ── Top-out overlay ───────────────────────────────────────────────────────
    if (my.topOut) {
      ctx.fillStyle  = 'rgba(255,82,82,0.35)';
      ctx.fillRect(myX, 0, COLS * cp, ROWS * cp);
    }
  }

  private drawBoard(
    ctx:    CanvasRenderingContext2D,
    ps:     TetrisPlayerState,
    ox:     number,
    oy:     number,
    cp:     number,
    alpha:  number,
    flash:  Map<number, number>,
  ): void {
    // Background + border
    ctx.fillStyle   = '#111318';
    ctx.globalAlpha = alpha;
    ctx.fillRect(ox, oy, COLS * cp, ROWS * cp);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(ox, oy, COLS * cp, ROWS * cp);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath(); ctx.moveTo(ox + c * cp, oy); ctx.lineTo(ox + c * cp, oy + ROWS * cp); ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(ox, oy + r * cp); ctx.lineTo(ox + COLS * cp, oy + r * cp); ctx.stroke();
    }

    // Cells
    for (let r = 0; r < ROWS; r++) {
      const flashVal = flash.get(r) ?? 0;
      for (let c = 0; c < COLS; c++) {
        const v = ps.board[r][c];
        if (v === 0) continue;
        const x = ox + c * cp;
        const y = oy + r * cp;
        if (flashVal > 0) {
          const t = flashVal / 8;
          ctx.fillStyle   = `rgba(255,255,255,${t})`;
          ctx.globalAlpha = alpha;
          ctx.fillRect(x, y, cp, cp);
        } else {
          this.drawCell(ctx, x, y, cp, v, alpha);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawCell(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, cp: number,
    colorIdx: number,
    alpha: number,
  ): void {
    const color = COLORS[colorIdx] ?? '#888';
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = color;
    const m = Math.max(1, cp * 0.06);
    ctx.fillRect(x + m, y + m, cp - 2 * m, cp - 2 * m);
    // Light top-left bevel
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x + m, y + m, cp - 2 * m, m);
    ctx.fillRect(x + m, y + m, m, cp - 2 * m);
  }

  private drawPieceCells(
    ctx: CanvasRenderingContext2D,
    piece: ActivePiece,
    boardX: number, boardY: number,
    cp: number,
    dyOverride: number,
    alpha: number,
  ): void {
    const shape = PIECES[piece.type][piece.rotation];
    const colorIdx = dyOverride !== 0 ? 0 : PIECE_COLOR[piece.type];
    shape.forEach(([dc, dr]) => {
      const r = piece.y + dyOverride + dr;
      const c = piece.x + dc;
      if (r < 0 || r >= ROWS) return;
      const x = boardX + c * cp;
      const y = boardY + r * cp;
      if (dyOverride !== 0) {
        // Ghost: outline only
        ctx.strokeStyle = COLORS[PIECE_COLOR[piece.type]];
        ctx.lineWidth   = Math.max(1, cp * 0.08);
        ctx.globalAlpha = alpha;
        ctx.strokeRect(x + 1, y + 1, cp - 2, cp - 2);
        ctx.globalAlpha = 1;
      } else {
        this.drawCell(ctx, x, y, cp, PIECE_COLOR[piece.type], alpha);
      }
    });
  }

  private drawMiniPiece(
    ctx: CanvasRenderingContext2D,
    type: PieceType,
    ox: number, oy: number,
    cp: number,
    alpha: number,
  ): void {
    const shape  = PIECES[type][0];
    const colorIdx = PIECE_COLOR[type];
    ctx.globalAlpha = alpha;
    shape.forEach(([dc, dr]) => {
      this.drawCell(ctx, ox + dc * cp, oy + dr * cp, cp, colorIdx, alpha);
    });
    ctx.globalAlpha = 1;
  }

  private drawPanel(
    ctx: CanvasRenderingContext2D,
    label: string,
    x: number, y: number, w: number, h: number,
  ): void {
    ctx.fillStyle   = 'rgba(255,255,255,0.03)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle   = 'rgba(255,255,255,0.4)';
    ctx.font        = `bold ${Math.max(8, this.cellPx * 0.45)}px monospace`;
    ctx.textAlign   = 'center';
    ctx.fillText(label, x + w / 2, y + this.cellPx * 0.75);
  }

  // ── Ghost piece calculation ─────────────────────────────────────────────────

  private ghostY(board: number[][], piece: ActivePiece): number {
    let dy = 0;
    while (this.isValid(board, { ...piece, y: piece.y + dy + 1 })) dy++;
    return piece.y + dy;
  }

  private isValid(board: number[][], piece: ActivePiece): boolean {
    for (const [dc, dr] of PIECES[piece.type][piece.rotation]) {
      const c = piece.x + dc, r = piece.y + dr;
      if (c < 0 || c >= COLS || r >= ROWS) return false;
      if (r >= 0 && board[r][c] !== 0) return false;
    }
    return true;
  }

  // ── Flash detection ────────────────────────────────────────────────────────

  private detectFlash(
    ps:    TetrisPlayerState,
    prev:  number[][] | null,
    flash: Map<number, number>,
  ): void {
    if (!prev) return;
    // Decrement existing flashes
    for (const [row, val] of flash) {
      if (val <= 1) flash.delete(row);
      else flash.set(row, val - 1);
    }
    // Detect newly cleared rows: row was full in prev but board shifted
    // Simple heuristic: count filled cells per row in prev vs current
    const prevFilled = prev.map(row => row.filter(v => v !== 0).length);
    const currFilled = ps.board.map(row => row.filter(v => v !== 0).length);
    // If top rows gained empties (lines were removed), flash them
    let cleared = 0;
    for (let r = 0; r < ROWS; r++) {
      if (prevFilled[r] === COLS && currFilled[r] < COLS) cleared++;
    }
    if (cleared > 0) {
      // Flash the top `cleared` rows that were just added (now empty)
      for (let r = 0; r < cleared; r++) {
        flash.set(r, 8);
      }
    }
  }

  // ── DAS / ARR ──────────────────────────────────────────────────────────────

  private processDAS(dt: number): void {
    if (!this.isPlaying()) return;
    const myNum = this.myPlayerNum();

    if (this.keysDown.has('ArrowLeft')) {
      this.dasLeft += dt;
      if (this.dasLeft >= DAS_MS) {
        this.arrLeft += dt;
        if (this.arrLeft >= ARR_MS) {
          this.arrLeft = 0;
          this.sendAction('left', myNum);
        }
      }
    }
    if (this.keysDown.has('ArrowRight')) {
      this.dasRight += dt;
      if (this.dasRight >= DAS_MS) {
        this.arrRight += dt;
        if (this.arrRight >= ARR_MS) {
          this.arrRight = 0;
          this.sendAction('right', myNum);
        }
      }
    }
  }

  // ── Keyboard ───────────────────────────────────────────────────────────────

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.isPlaying()) return;
    if (this.keysDown.has(e.key)) return; // held — DAS handles repeat
    this.keysDown.add(e.key);

    const myNum   = this.myPlayerNum();
    const isLocal = this.isLocal();

    let action: string | null = null;
    let targetPlayer: 1|2 = myNum;

    switch (e.key) {
      case 'ArrowLeft':  action = 'left';    break;
      case 'ArrowRight': action = 'right';   break;
      case 'ArrowUp': case 'x': case 'X': action = 'rotateR'; break;
      case 'z': case 'Z': case 'Control':   action = 'rotateL'; break;
      case 'ArrowDown':  action = 'softDrop'; break;
      case ' ':          action = 'hardDrop'; break;
      case 'c': case 'C': case 'Shift':      action = 'hold';    break;

      // Local P2 controls (WASD-ish)
      case 'a': case 'A': if (isLocal) { action = 'left';     targetPlayer = 2; } break;
      case 'd': case 'D': if (isLocal) { action = 'right';    targetPlayer = 2; } break;
      case 'w': case 'W': if (isLocal) { action = 'rotateR';  targetPlayer = 2; } break;
      case 's': case 'S': if (isLocal) { action = 'softDrop'; targetPlayer = 2; } break;
      case 'q': case 'Q': if (isLocal) { action = 'rotateL';  targetPlayer = 2; } break;
      case 'e': case 'E': if (isLocal) { action = 'hardDrop'; targetPlayer = 2; } break;
      case 'r': case 'R': if (isLocal) { action = 'hold';     targetPlayer = 2; } break;
    }

    if (!action) return;
    e.preventDefault();
    this.sendAction(action, targetPlayer);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keysDown.delete(e.key);
    if (e.key === 'ArrowLeft')  { this.dasLeft  = 0; this.arrLeft  = 0; }
    if (e.key === 'ArrowRight') { this.dasRight = 0; this.arrRight = 0; }
  };

  // ── Touch ──────────────────────────────────────────────────────────────────

  onTouchStart(e: TouchEvent): void {
    this.touchX = e.touches[0].clientX;
    this.touchY = e.touches[0].clientY;
  }

  onTouchEnd(e: TouchEvent): void {
    if (!this.isPlaying()) return;
    const dx = e.changedTouches[0].clientX - this.touchX;
    const dy = e.changedTouches[0].clientY - this.touchY;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    const myNum = this.myPlayerNum();

    if (adx < 15 && ady < 15) {
      this.sendAction('rotateR', myNum); return;
    }
    if (ady > adx) {
      this.sendAction(dy > 0 ? 'hardDrop' : 'rotateR', myNum);
    } else {
      this.sendAction(dx > 0 ? 'right' : 'left', myNum);
    }
  }

  // ── Send action helper ─────────────────────────────────────────────────────

  private sendAction(action: string, targetPlayer: 1|2): void {
    const room = this.room();
    if (!room) return;

    let playerId: string | undefined;
    if (room.isLocal) {
      playerId = room.players[targetPlayer - 1]?.id;
    }
    // else: server uses socket.id

    this.gameService.sendTetrisInput(action, playerId);

    // Relay input via WebRTC P2P (low-latency mirror for the opponent)
    if (!room.isLocal) {
      this.rtc.send({ type: 'tetris-input', action });
    }
  }
}
