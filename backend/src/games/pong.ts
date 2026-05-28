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
}

export function createInitialPongState(): PongState {
  return {
    ball: {
      x: 50,
      y: 50,
      vx: (Math.random() > 0.5 ? 1.3 : -1.3),
      vy: (Math.random() * 1.6 - 0.8),
      radius: 1.8
    },
    p1Y: 50,
    p2Y: 50,
    paddleHeight: 18,
    paddleWidth: 2,
    scoreP1: 0,
    scoreP2: 0,
    winner: null,
    targetScore: 5
  };
}

export function updatePongPhysics(state: PongState) {
  if (state.winner !== null) return;

  let ball = state.ball;
  ball.x += ball.vx;
  ball.y += ball.vy;

  // Collision with top and bottom walls
  if (ball.y - ball.radius <= 0) {
    ball.y = ball.radius;
    ball.vy = -ball.vy;
  } else if (ball.y + ball.radius >= 100) {
    ball.y = 100 - ball.radius;
    ball.vy = -ball.vy;
  }

  const paddleHalf = state.paddleHeight / 2;

  // Collision with Paddle 1 (Left)
  if (ball.vx < 0 && ball.x - ball.radius <= 4 && ball.x - ball.radius >= 1) {
    const p1Top = state.p1Y - paddleHalf;
    const p1Bottom = state.p1Y + paddleHalf;
    if (ball.y >= p1Top && ball.y <= p1Bottom) {
      ball.x = 4 + ball.radius;
      ball.vx = -ball.vx * 1.08; // slightly increase speed
      const hitPos = (ball.y - state.p1Y) / paddleHalf;
      ball.vy = hitPos * 1.6;
    }
  }

  // Collision with Paddle 2 (Right)
  if (ball.vx > 0 && ball.x + ball.radius >= 96 && ball.x + ball.radius <= 99) {
    const p2Top = state.p2Y - paddleHalf;
    const p2Bottom = state.p2Y + paddleHalf;
    if (ball.y >= p2Top && ball.y <= p2Bottom) {
      ball.x = 96 - ball.radius;
      ball.vx = -ball.vx * 1.08;
      const hitPos = (ball.y - state.p2Y) / paddleHalf;
      ball.vy = hitPos * 1.6;
    }
  }

  // Cap horizontal speed to keep it playable
  const maxVx = 3.2;
  if (Math.abs(ball.vx) > maxVx) {
    ball.vx = Math.sign(ball.vx) * maxVx;
  }

  // Point scoring bounds
  if (ball.x < 0) {
    state.scoreP2 += 1;
    resetBall(state, 1); // serve to P1
  } else if (ball.x > 100) {
    state.scoreP1 += 1;
    resetBall(state, 2); // serve to P2
  }

  // Check for game over
  if (state.scoreP1 >= state.targetScore) {
    state.winner = 1;
  } else if (state.scoreP2 >= state.targetScore) {
    state.winner = 2;
  }
}

function resetBall(state: PongState, serveTowardsPlayer: number) {
  state.ball.x = 50;
  state.ball.y = 50;
  state.ball.vx = serveTowardsPlayer === 1 ? -1.3 : 1.3;
  state.ball.vy = Math.random() * 1.6 - 0.8;
}
