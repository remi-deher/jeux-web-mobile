/**
 * Client-side mirror of backend/src/games/pong.ts physics.
 *
 * Must stay deterministically identical to the server implementation so
 * the local simulation matches server state between network ticks.
 *
 * NOTE: The only intentional divergence is on serve launch — the server picks
 * a random vy while we use 0. The client reconciles to server state on the
 * very next tick, so this difference lasts < 16 ms and is invisible.
 */

export interface SimBall {
  x: number; y: number;
  vx: number; vy: number;
  radius: number;
}

export interface SimPongState {
  ball: SimBall;
  p1Y: number;
  p2Y: number;
  paddleHeight: number;
  paddleWidth: number;
  scoreP1: number;
  scoreP2: number;
  winner: number | null;
  targetScore: number;
  serving: boolean;
  serveCountdown: number;
  lastHit: 'p1' | 'p2' | 'wall_top' | 'wall_bottom' | null;
  serveTowards: 1 | 2;
}

/** Deep-clone a server pong state into a SimPongState. */
export function cloneServerState(s: any): SimPongState {
  return {
    ball:          { x: s.ball.x, y: s.ball.y, vx: s.ball.vx ?? 0, vy: s.ball.vy ?? 0, radius: s.ball.radius },
    p1Y:           s.p1Y ?? 50,
    p2Y:           s.p2Y ?? 50,
    paddleHeight:  s.paddleHeight ?? 18,
    paddleWidth:   s.paddleWidth  ?? 2,
    scoreP1:       s.scoreP1 ?? 0,
    scoreP2:       s.scoreP2 ?? 0,
    winner:        s.winner ?? null,
    targetScore:   s.targetScore ?? 5,
    serving:       s.serving ?? false,
    serveCountdown: s.serveCountdown ?? 0,
    lastHit:       s.lastHit ?? null,
    serveTowards:  s.serveTowards ?? 1,
  };
}

/**
 * Advance the simulation by one physics step (equivalent to one server tick).
 * Call this at 60 Hz (matching the server) from the render loop.
 */
export function stepPong(state: SimPongState): void {
  if (state.winner !== null) return;

  state.lastHit = null;

  // ── Serve delay ────────────────────────────────────────────────────────────
  if (state.serving) {
    state.serveCountdown -= 1;
    if (state.serveCountdown <= 0) {
      state.serving = false;
      state.ball.x  = 50;
      state.ball.y  = 50;
      state.ball.vx = state.serveTowards === 1 ? -1.3 : 1.3;
      state.ball.vy = 0; // ← server uses Math.random(); reconciled on next tick
    }
    return;
  }

  const ball = state.ball;
  ball.x += ball.vx;
  ball.y += ball.vy;

  // ── Wall bounces ───────────────────────────────────────────────────────────
  if (ball.y - ball.radius <= 0) {
    ball.y = ball.radius;
    ball.vy = -ball.vy;
    state.lastHit = 'wall_top';
  } else if (ball.y + ball.radius >= 100) {
    ball.y = 100 - ball.radius;
    ball.vy = -ball.vy;
    state.lastHit = 'wall_bottom';
  }

  const paddleHalf = state.paddleHeight / 2;

  // ── Paddle 1 ───────────────────────────────────────────────────────────────
  if (ball.vx < 0 && ball.x - ball.radius <= 4 && ball.x - ball.radius >= 1) {
    const p1Top = state.p1Y - paddleHalf;
    const p1Bot = state.p1Y + paddleHalf;
    if (ball.y >= p1Top && ball.y <= p1Bot) {
      ball.x        = 4 + ball.radius;
      ball.vx       = -ball.vx * 1.08;
      ball.vy       = ((ball.y - state.p1Y) / paddleHalf) * 1.6;
      state.lastHit = 'p1';
    }
  }

  // ── Paddle 2 ───────────────────────────────────────────────────────────────
  if (ball.vx > 0 && ball.x + ball.radius >= 96 && ball.x + ball.radius <= 99) {
    const p2Top = state.p2Y - paddleHalf;
    const p2Bot = state.p2Y + paddleHalf;
    if (ball.y >= p2Top && ball.y <= p2Bot) {
      ball.x        = 96 - ball.radius;
      ball.vx       = -ball.vx * 1.08;
      ball.vy       = ((ball.y - state.p2Y) / paddleHalf) * 1.6;
      state.lastHit = 'p2';
    }
  }

  // ── Speed cap ──────────────────────────────────────────────────────────────
  const maxVx = 3.2;
  if (Math.abs(ball.vx) > maxVx) ball.vx = Math.sign(ball.vx) * maxVx;

  // ── Scoring ────────────────────────────────────────────────────────────────
  if (ball.x < 0) {
    state.scoreP2     += 1;
    state.serving      = true;
    state.serveCountdown = 30;
    state.serveTowards = 1;
    ball.x = 50; ball.y = 50; ball.vx = 0; ball.vy = 0;
  } else if (ball.x > 100) {
    state.scoreP1     += 1;
    state.serving      = true;
    state.serveCountdown = 30;
    state.serveTowards = 2;
    ball.x = 50; ball.y = 50; ball.vx = 0; ball.vy = 0;
  }

  // ── Win check ──────────────────────────────────────────────────────────────
  if (state.scoreP1 >= state.targetScore) state.winner = 1;
  else if (state.scoreP2 >= state.targetScore) state.winner = 2;
}
