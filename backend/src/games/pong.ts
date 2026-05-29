export interface PongState {
  ball: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
  };
  p1Y: number;
  p2Y: number;
  paddleHeight: number;
  paddleWidth: number;
  scoreP1: number;
  scoreP2: number;
  winner: number | null;
  targetScore: number;
  /** true while we're waiting to serve (between points) */
  serving: boolean;
  /** ticks remaining before the ball is launched (30 ticks ≈ 1 s) */
  serveCountdown: number;
  /** who/what last touched the ball this tick — clients use this for effects */
  lastHit: 'p1' | 'p2' | 'wall_top' | 'wall_bottom' | null;
  /** which player the ball will be served towards */
  serveTowards: 1 | 2;
  p1Ready?: boolean;
  p2Ready?: boolean;
}

export function createInitialPongState(): PongState {
  return {
    ball: { x: 50, y: 50, vx: 0, vy: 0, radius: 1.8 },
    p1Y: 50,
    p2Y: 50,
    paddleHeight: 18,
    paddleWidth: 2,
    scoreP1: 0,
    scoreP2: 0,
    winner: null,
    targetScore: 5,
    serving: true,
    serveCountdown: 30,
    lastHit: null,
    serveTowards: Math.random() > 0.5 ? 1 : 2,
    p1Ready: false,
    p2Ready: false,
  };
}

export function updatePongPhysics(state: PongState) {
  if (state.winner !== null) return;
  if (!state.p1Ready || !state.p2Ready) return;

  // Reset per-tick hit marker
  state.lastHit = null;

  // ── Serve delay ────────────────────────────────────────────────────────────
  if (state.serving) {
    state.serveCountdown -= 1;
    if (state.serveCountdown <= 0) {
      state.serving = false;
      state.ball.x  = 50;
      state.ball.y  = 50;
      state.ball.vx = state.serveTowards === 1 ? -1.0 : 1.0;
      state.ball.vy = Math.random() * 1.2 - 0.6;
    }
    return;
  }

  let ball = state.ball;
  ball.x += ball.vx;
  ball.y += ball.vy;

  // ── Wall bounces ───────────────────────────────────────────────────────────
  if (ball.y - ball.radius <= 0) {
    ball.y   = ball.radius;
    ball.vy  = -ball.vy;
    state.lastHit = 'wall_top';
  } else if (ball.y + ball.radius >= 100) {
    ball.y   = 100 - ball.radius;
    ball.vy  = -ball.vy;
    state.lastHit = 'wall_bottom';
  }

  const paddleHalf = state.paddleHeight / 2;

  // ── Paddle 1 (left) ────────────────────────────────────────────────────────
  if (ball.vx < 0 && ball.x - ball.radius <= 4 && ball.x - ball.radius >= 1) {
    const p1Top    = state.p1Y - paddleHalf;
    const p1Bottom = state.p1Y + paddleHalf;
    if (ball.y >= p1Top && ball.y <= p1Bottom) {
      ball.x        = 4 + ball.radius;
      ball.vx       = -ball.vx * 1.05;
      const hitPos  = (ball.y - state.p1Y) / paddleHalf;
      ball.vy       = hitPos * 1.3;
      state.lastHit = 'p1';
    }
  }

  // ── Paddle 2 (right) ───────────────────────────────────────────────────────
  if (ball.vx > 0 && ball.x + ball.radius >= 96 && ball.x + ball.radius <= 99) {
    const p2Top    = state.p2Y - paddleHalf;
    const p2Bottom = state.p2Y + paddleHalf;
    if (ball.y >= p2Top && ball.y <= p2Bottom) {
      ball.x        = 96 - ball.radius;
      ball.vx       = -ball.vx * 1.05;
      const hitPos  = (ball.y - state.p2Y) / paddleHalf;
      ball.vy       = hitPos * 1.3;
      state.lastHit = 'p2';
    }
  }

  // ── Speed cap ──────────────────────────────────────────────────────────────
  const maxVx = 3.2;
  if (Math.abs(ball.vx) > maxVx) ball.vx = Math.sign(ball.vx) * maxVx;

  // ── Scoring ────────────────────────────────────────────────────────────────
  if (ball.x < 0) {
    state.scoreP2 += 1;
    startServe(state, 1);
  } else if (ball.x > 100) {
    state.scoreP1 += 1;
    startServe(state, 2);
  }

  // ── Win check ──────────────────────────────────────────────────────────────
  if (state.scoreP1 >= state.targetScore) state.winner = 1;
  else if (state.scoreP2 >= state.targetScore) state.winner = 2;
}

function startServe(state: PongState, towards: 1 | 2) {
  state.serving       = true;
  state.serveCountdown = 30; // ~1 s at 30 Hz
  state.serveTowards  = towards;
  state.ball.x        = 50;
  state.ball.y        = 50;
  state.ball.vx       = 0;
  state.ball.vy       = 0;
}
