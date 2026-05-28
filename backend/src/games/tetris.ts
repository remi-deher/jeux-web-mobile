/**
 * Tetris vs — server-side physics
 *
 * Grid     : 10 × 20 (visible) + 2 hidden spawn rows at top (index -1, -2)
 * Tick     : 60 Hz
 * Rotation : SRS (Super Rotation System) with wall-kick tables
 * Random   : Bag-7 (one complete shuffle of all 7 pieces per bag)
 */

// ── Piece definitions ─────────────────────────────────────────────────────────
// Each piece has 4 rotation states, stored as flat arrays of [col, row] offsets
// relative to a 4×4 bounding box whose top-left is at (x, y).

export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
export type TetrisAction =
  | 'left' | 'right' | 'rotateR' | 'rotateL'
  | 'softDrop' | 'hardDrop' | 'hold';

// Colour index: 0=empty, 1=I(cyan), 2=O(yellow), 3=T(purple),
//               4=S(green), 5=Z(red), 6=J(blue), 7=L(orange)
export const PIECE_COLOR: Record<PieceType, number> = {
  I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7,
};

// Piece shapes: 4 rotations × N cells [col, row] inside 4×4 box
type Shape = [number, number][][];

const PIECES: Record<PieceType, Shape> = {
  I: [
    [[0,1],[1,1],[2,1],[3,1]],
    [[2,0],[2,1],[2,2],[2,3]],
    [[0,2],[1,2],[2,2],[3,2]],
    [[1,0],[1,1],[1,2],[1,3]],
  ],
  O: [
    [[1,0],[2,0],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[2,1]],
  ],
  T: [
    [[1,0],[0,1],[1,1],[2,1]],
    [[1,0],[1,1],[2,1],[1,2]],
    [[0,1],[1,1],[2,1],[1,2]],
    [[1,0],[0,1],[1,1],[1,2]],
  ],
  S: [
    [[1,0],[2,0],[0,1],[1,1]],
    [[1,0],[1,1],[2,1],[2,2]],
    [[1,1],[2,1],[0,2],[1,2]],
    [[0,0],[0,1],[1,1],[1,2]],
  ],
  Z: [
    [[0,0],[1,0],[1,1],[2,1]],
    [[2,0],[1,1],[2,1],[1,2]],
    [[0,1],[1,1],[1,2],[2,2]],
    [[1,0],[0,1],[1,1],[0,2]],
  ],
  J: [
    [[0,0],[0,1],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[1,2]],
    [[0,1],[1,1],[2,1],[2,2]],
    [[1,0],[1,1],[0,2],[1,2]],
  ],
  L: [
    [[2,0],[0,1],[1,1],[2,1]],
    [[1,0],[1,1],[1,2],[2,2]],
    [[0,1],[1,1],[2,1],[0,2]],
    [[0,0],[1,0],[1,1],[1,2]],
  ],
};

// ── SRS wall-kick tables ───────────────────────────────────────────────────────
// kicks[fromRotation][direction] = array of [dx, dy] offsets to try
// direction: 0 = clockwise (rotateR), 1 = counter-clockwise (rotateL)

type KickTable = Record<number, [number, number][][]>;

// J, L, S, T, Z
const KICKS_JLSTZ: KickTable = {
  0: [[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]], [[0,0],[1,0],[1,1],[0,-2],[1,-2]]],
  1: [[[0,0],[1,0],[1,-1],[0,2],[1,2]],     [[0,0],[1,0],[1,-1],[0,2],[1,2]]],
  2: [[[0,0],[1,0],[1,1],[0,-2],[1,-2]],    [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]]],
  3: [[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],  [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]]],
};

// I piece
const KICKS_I: KickTable = {
  0: [[[ 0,0],[-2,0],[1,0],[-2,-1],[1,2]],  [[0,0],[-1,0],[2,0],[-1,2],[2,-1]]],
  1: [[[ 0,0],[2,0],[-1,0],[2,1],[-1,-2]],  [[0,0],[1,0],[-2,0],[1,-2],[-2,1]]],
  2: [[[ 0,0],[-1,0],[2,0],[-1,2],[2,-1]],  [[0,0],[2,0],[-1,0],[2,1],[-1,-2]]],
  3: [[[ 0,0],[1,0],[-2,0],[1,-2],[-2,1]],  [[0,0],[-2,0],[1,0],[-2,-1],[1,2]]],
};

// ── Board dimensions ──────────────────────────────────────────────────────────
export const COLS = 10;
export const ROWS = 20;

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ActivePiece {
  type:     PieceType;
  x:        number;   // board column of bounding-box top-left
  y:        number;   // board row  of bounding-box top-left (can be negative)
  rotation: number;   // 0-3
}

export interface TetrisPlayerState {
  board:          number[][];     // [row][col], 0=empty, 1-7=colour
  current:        ActivePiece | null;
  bag:            PieceType[];    // remaining pieces in current bag
  nextPieces:     PieceType[];    // next 3 pieces preview
  held:           PieceType | null;
  holdUsed:       boolean;
  score:          number;
  level:          number;
  linesCleared:   number;
  gravityCounter: number;
  lockDelay:      number;         // ticks remaining before lock (−1 = not started)
  lockResets:     number;         // count of resets (max 15)
  garbageQueue:   number;         // garbage lines pending
  topOut:         boolean;
}

export interface TetrisState {
  players:   { p1: TetrisPlayerState; p2: TetrisPlayerState };
  playerIds: [string, string];
  winner:    number | null;       // 1 | 2, null = ongoing
}

// ── Bag-7 randomizer ──────────────────────────────────────────────────────────

const ALL_PIECES: PieceType[] = ['I','O','T','S','Z','J','L'];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function refillBag(ps: TetrisPlayerState): void {
  ps.bag = [...ps.bag, ...shuffle(ALL_PIECES)];
}

function nextFromBag(ps: TetrisPlayerState): PieceType {
  if (ps.bag.length === 0) refillBag(ps);
  return ps.bag.shift()!;
}

// ── Board helpers ──────────────────────────────────────────────────────────────

function emptyBoard(): number[][] {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function cells(piece: ActivePiece): [number, number][] {
  return PIECES[piece.type][piece.rotation].map(([dc, dr]) => [
    piece.x + dc,
    piece.y + dr,
  ]);
}

function isValid(board: number[][], piece: ActivePiece): boolean {
  for (const [c, r] of cells(piece)) {
    if (c < 0 || c >= COLS) return false;
    if (r >= ROWS)           return false;
    if (r >= 0 && board[r][c] !== 0) return false;
    // r < 0 is allowed (spawn zone above visible board)
  }
  return true;
}

export function ghostY(board: number[][], piece: ActivePiece): number {
  let dy = 0;
  while (isValid(board, { ...piece, y: piece.y + dy + 1 })) dy++;
  return piece.y + dy;
}

// ── Rotation (SRS) ─────────────────────────────────────────────────────────────

function tryRotate(
  board: number[][],
  piece: ActivePiece,
  dir: 0 | 1,          // 0 = clockwise, 1 = counter-clockwise
): ActivePiece | null {
  const newRot = (piece.rotation + (dir === 0 ? 1 : 3)) % 4;
  const table  = piece.type === 'I' ? KICKS_I : KICKS_JLSTZ;
  const kicks  = table[piece.rotation]?.[dir] ?? [[0, 0]];

  for (const [dx, dy] of kicks) {
    const candidate: ActivePiece = {
      ...piece,
      rotation: newRot,
      x: piece.x + dx,
      y: piece.y - dy,   // SRS uses y-up convention for kicks; board is y-down
    };
    if (isValid(board, candidate)) return candidate;
  }
  return null;
}

// ── Spawn ──────────────────────────────────────────────────────────────────────

function spawnPiece(ps: TetrisPlayerState): void {
  const type = nextFromBag(ps);

  // Maintain 3-piece preview
  while (ps.nextPieces.length < 3) {
    ps.nextPieces.push(nextFromBag(ps));
  }

  ps.current = {
    type,
    x: 3,   // centre of 10-wide board
    y: -1,  // spawn partially above visible area
    rotation: 0,
  };
  ps.gravityCounter = 0;
  ps.lockDelay      = -1;
  ps.lockResets     = 0;
  ps.holdUsed       = false;
}

// ── Lock & line clear ──────────────────────────────────────────────────────────

function lockPiece(ps: TetrisPlayerState): number {
  const piece = ps.current!;
  for (const [c, r] of cells(piece)) {
    if (r >= 0 && r < ROWS) {
      ps.board[r][c] = PIECE_COLOR[piece.type];
    }
  }
  ps.current = null;

  // Count and clear full lines
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (ps.board[r].every(cell => cell !== 0)) {
      ps.board.splice(r, 1);
      ps.board.unshift(Array(COLS).fill(0));
      cleared++;
      r++; // re-check same index
    }
  }
  return cleared;
}

// ── Garbage lines ─────────────────────────────────────────────────────────────

function addGarbage(ps: TetrisPlayerState, lines: number): void {
  for (let i = 0; i < lines; i++) {
    const hole = Math.floor(Math.random() * COLS);
    const garbageLine = Array.from({ length: COLS }, (_, c) => c === hole ? 0 : 8);
    ps.board.shift();
    ps.board.push(garbageLine);
  }
}

// ── Scoring ────────────────────────────────────────────────────────────────────

const LINE_SCORE = [0, 100, 300, 500, 800];

function garbageForClears(lines: number): number {
  if (lines === 1) return 0;
  if (lines === 2) return 1;
  if (lines === 3) return 2;
  return 4; // Tetris
}

function gravityThreshold(level: number): number {
  // ticks between each 1-cell drop; faster at higher levels
  return Math.max(1, Math.floor(60 / (level * 1.5)));
}

// ── Initial state ──────────────────────────────────────────────────────────────

function createPlayerState(): TetrisPlayerState {
  const ps: TetrisPlayerState = {
    board:          emptyBoard(),
    current:        null,
    bag:            shuffle([...ALL_PIECES]),
    nextPieces:     [],
    held:           null,
    holdUsed:       false,
    score:          0,
    level:          1,
    linesCleared:   0,
    gravityCounter: 0,
    lockDelay:      -1,
    lockResets:     0,
    garbageQueue:   0,
    topOut:         false,
  };
  // Pre-fill preview
  while (ps.nextPieces.length < 3) ps.nextPieces.push(nextFromBag(ps));
  spawnPiece(ps);
  return ps;
}

export function createInitialTetrisState(playerIds: [string, string]): TetrisState {
  return {
    players:   { p1: createPlayerState(), p2: createPlayerState() },
    playerIds,
    winner:    null,
  };
}

// ── Core physics update ────────────────────────────────────────────────────────

/**
 * Called every tick (60 Hz).
 * - If playerId + action are provided: apply the player's input first.
 * - Then advance gravity for both players.
 */
export function updateTetrisPhysics(
  state:    TetrisState,
  playerId: string | null = null,
  action:   TetrisAction | null = null,
): void {
  if (state.winner !== null) return;

  // Apply player input
  if (playerId && action) {
    const idx = state.playerIds.indexOf(playerId);
    if (idx !== -1) {
      const ps = idx === 0 ? state.players.p1 : state.players.p2;
      applyAction(ps, action);
    }
  }

  // Advance physics for both players
  advancePlayer(state.players.p1);
  advancePlayer(state.players.p2);

  // Exchange garbage
  const g1 = state.players.p1.garbageQueue;
  const g2 = state.players.p2.garbageQueue;
  if (g1 > 0) { addGarbage(state.players.p2, g1); state.players.p1.garbageQueue = 0; }
  if (g2 > 0) { addGarbage(state.players.p1, g2); state.players.p2.garbageQueue = 0; }

  // Check winner
  if (state.players.p1.topOut && state.players.p2.topOut) {
    state.winner = 0; // draw (rare)
  } else if (state.players.p1.topOut) {
    state.winner = 2;
  } else if (state.players.p2.topOut) {
    state.winner = 1;
  }
}

function advancePlayer(ps: TetrisPlayerState): void {
  if (ps.topOut || !ps.current) return;

  // Gravity
  ps.gravityCounter++;
  const threshold = gravityThreshold(ps.level);
  if (ps.gravityCounter >= threshold) {
    ps.gravityCounter = 0;
    const moved = isValid(ps.board, { ...ps.current, y: ps.current.y + 1 });
    if (moved) {
      ps.current.y++;
      ps.lockDelay = -1; // reset lock while falling
    }
  }

  // Lock delay
  const canFallFurther = isValid(ps.board, { ...ps.current, y: ps.current.y + 1 });
  if (!canFallFurther) {
    if (ps.lockDelay < 0) {
      ps.lockDelay = 30; // start 30-tick countdown
    } else {
      ps.lockDelay--;
      if (ps.lockDelay <= 0) {
        doLock(ps);
      }
    }
  } else {
    if (ps.lockDelay >= 0) ps.lockDelay = -1; // piece is floating again
  }
}

function doLock(ps: TetrisPlayerState): void {
  const cleared = lockPiece(ps);

  if (cleared > 0) {
    ps.score       += LINE_SCORE[cleared] * ps.level;
    ps.linesCleared += cleared;
    ps.level        = Math.floor(ps.linesCleared / 10) + 1;
    ps.garbageQueue += garbageForClears(cleared);
  }

  // Spawn next piece
  spawnPiece(ps);

  // Top-out check: new piece overlaps existing blocks
  if (ps.current && !isValid(ps.board, ps.current)) {
    ps.topOut = true;
  }
}

function applyAction(ps: TetrisPlayerState, action: TetrisAction): void {
  if (ps.topOut || !ps.current) return;

  switch (action) {
    case 'left': {
      const moved = { ...ps.current, x: ps.current.x - 1 };
      if (isValid(ps.board, moved)) {
        ps.current = moved;
        resetLock(ps);
      }
      break;
    }
    case 'right': {
      const moved = { ...ps.current, x: ps.current.x + 1 };
      if (isValid(ps.board, moved)) {
        ps.current = moved;
        resetLock(ps);
      }
      break;
    }
    case 'rotateR': {
      const rotated = tryRotate(ps.board, ps.current, 0);
      if (rotated) { ps.current = rotated; resetLock(ps); }
      break;
    }
    case 'rotateL': {
      const rotated = tryRotate(ps.board, ps.current, 1);
      if (rotated) { ps.current = rotated; resetLock(ps); }
      break;
    }
    case 'softDrop': {
      const moved = { ...ps.current, y: ps.current.y + 1 };
      if (isValid(ps.board, moved)) {
        ps.current = moved;
        ps.score  += 1;
      }
      break;
    }
    case 'hardDrop': {
      const gy = ghostY(ps.board, ps.current);
      ps.score    += (gy - ps.current.y) * 2;
      ps.current.y = gy;
      doLock(ps);
      break;
    }
    case 'hold': {
      if (ps.holdUsed) break;
      ps.holdUsed = true;
      const type  = ps.current.type;
      if (ps.held) {
        // Swap held ↔ current
        const held     = ps.held;
        ps.held        = type;
        ps.current     = { type: held, x: 3, y: -1, rotation: 0 };
        ps.lockDelay   = -1;
        ps.lockResets  = 0;
      } else {
        ps.held    = type;
        ps.current = null;
        spawnPiece(ps);
      }
      break;
    }
  }
}

function resetLock(ps: TetrisPlayerState): void {
  if (ps.lockDelay >= 0 && ps.lockResets < 15) {
    ps.lockDelay  = 30;
    ps.lockResets++;
  }
}
