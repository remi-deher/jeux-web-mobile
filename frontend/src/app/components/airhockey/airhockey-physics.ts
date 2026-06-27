export interface SimPuck {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

export interface SimMallet {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  radius: number;
}

export interface SimAirhockeyState {
  puck: SimPuck;
  p1Mallet: SimMallet;
  p2Mallet: SimMallet;
  scoreP1: number;
  scoreP2: number;
  winner: number | null;
  targetScore: number;
  serving: boolean;
  serveCountdown: number;
  serveTowards: 1 | 2;
  lastHit: 'p1' | 'p2' | 'wall' | 'goal' | null;
  p1Ready?: boolean;
  p2Ready?: boolean;
}

export function cloneServerState(s: any): SimAirhockeyState {
  return {
    puck: {
      x: s.puck?.x ?? 50,
      y: s.puck?.y ?? 50,
      vx: s.puck?.vx ?? 0,
      vy: s.puck?.vy ?? 0,
      radius: s.puck?.radius ?? 2.5
    },
    p1Mallet: {
      x: s.p1Mallet?.x ?? 20,
      y: s.p1Mallet?.y ?? 50,
      prevX: s.p1Mallet?.prevX ?? 20,
      prevY: s.p1Mallet?.prevY ?? 50,
      radius: s.p1Mallet?.radius ?? 4.0
    },
    p2Mallet: {
      x: s.p2Mallet?.x ?? 80,
      y: s.p2Mallet?.y ?? 50,
      prevX: s.p2Mallet?.prevX ?? 80,
      prevY: s.p2Mallet?.prevY ?? 50,
      radius: s.p2Mallet?.radius ?? 4.0
    },
    scoreP1: s.scoreP1 ?? 0,
    scoreP2: s.scoreP2 ?? 0,
    winner: s.winner ?? null,
    targetScore: s.targetScore ?? 5,
    serving: s.serving ?? false,
    serveCountdown: s.serveCountdown ?? 0,
    serveTowards: s.serveTowards ?? 1,
    lastHit: s.lastHit ?? null,
    p1Ready: s.p1Ready ?? false,
    p2Ready: s.p2Ready ?? false
  };
}

export function stepAirhockey(state: SimAirhockeyState): void {
  if (state.winner !== null) return;
  if (!state.p1Ready || !state.p2Ready) return;

  // Calcul des vitesses des mallets
  const p1Vx = state.p1Mallet.x - state.p1Mallet.prevX;
  const p1Vy = state.p1Mallet.y - state.p1Mallet.prevY;
  const p2Vx = state.p2Mallet.x - state.p2Mallet.prevX;
  const p2Vy = state.p2Mallet.y - state.p2Mallet.prevY;

  // Sauvegarde des positions actuelles
  state.p1Mallet.prevX = state.p1Mallet.x;
  state.p1Mallet.prevY = state.p1Mallet.y;
  state.p2Mallet.prevX = state.p2Mallet.x;
  state.p2Mallet.prevY = state.p2Mallet.y;

  state.lastHit = null;

  // ── Serve delay ────────────────────────────────────────────────────────────
  if (state.serving) {
    state.serveCountdown -= 1;
    if (state.serveCountdown <= 0) {
      state.serving = false;
      state.puck.x = 50;
      state.puck.y = 50;
      state.puck.vx = state.serveTowards === 1 ? -0.8 : 0.8;
      state.puck.vy = 0; // Se synchronisera avec la valeur aléatoire du serveur au tick suivant
    }
    return;
  }

  const puck = state.puck;

  // Friction
  puck.vx *= 0.994;
  puck.vy *= 0.994;

  puck.x += puck.vx;
  puck.y += puck.vy;

  const goalTop = 32;
  const goalBottom = 68;

  // ── Wall bounces (Horizontal) ───────────────────────────────────────────────
  if (puck.y - puck.radius <= 0) {
    puck.y = puck.radius;
    puck.vy = -puck.vy * 0.95;
    state.lastHit = 'wall';
  } else if (puck.y + puck.radius >= 100) {
    puck.y = 100 - puck.radius;
    puck.vy = -puck.vy * 0.95;
    state.lastHit = 'wall';
  }

  // ── Goal Check or Wall Bounce (Vertical) ────────────────────────────────────
  if (puck.x - puck.radius <= 0) {
    if (puck.y >= goalTop && puck.y <= goalBottom) {
      state.scoreP2 += 1;
      state.serving = true;
      state.serveCountdown = 30;
      state.serveTowards = 1;
      puck.x = 50; puck.y = 50; puck.vx = 0; puck.vy = 0;
      checkWinner(state);
      return;
    } else {
      puck.x = puck.radius;
      puck.vx = -puck.vx * 0.95;
      state.lastHit = 'wall';
    }
  }

  if (puck.x + puck.radius >= 100) {
    if (puck.y >= goalTop && puck.y <= goalBottom) {
      state.scoreP1 += 1;
      state.serving = true;
      state.serveCountdown = 30;
      state.serveTowards = 2;
      puck.x = 50; puck.y = 50; puck.vx = 0; puck.vy = 0;
      checkWinner(state);
      return;
    } else {
      puck.x = 100 - puck.radius;
      puck.vx = -puck.vx * 0.95;
      state.lastHit = 'wall';
    }
  }

  // ── Mallet Collisions ───────────────────────────────────────────────────────
  handleMalletCollision(state, state.p1Mallet, p1Vx, p1Vy, 'p1');
  handleMalletCollision(state, state.p2Mallet, p2Vx, p2Vy, 'p2');

  const maxSpeed = 3.0;
  const speed = Math.sqrt(puck.vx * puck.vx + puck.vy * puck.vy);
  if (speed > maxSpeed) {
    puck.vx = (puck.vx / speed) * maxSpeed;
    puck.vy = (puck.vy / speed) * maxSpeed;
  }
}

function handleMalletCollision(
  state: SimAirhockeyState,
  mallet: SimMallet,
  mVx: number,
  mVy: number,
  hitter: 'p1' | 'p2'
) {
  const puck = state.puck;
  const dx = puck.x - mallet.x;
  const dy = puck.y - mallet.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const minDist = puck.radius + mallet.radius;

  if (dist < minDist && dist > 0) {
    const nx = dx / dist;
    const ny = dy / dist;

    puck.x = mallet.x + nx * minDist;
    puck.y = mallet.y + ny * minDist;

    const capM = 2.5;
    const limitedMVx = Math.max(-capM, Math.min(capM, mVx));
    const limitedMVy = Math.max(-capM, Math.min(capM, mVy));

    const relVx = puck.vx - limitedMVx;
    const relVy = puck.vy - limitedMVy;

    const vn = relVx * nx + relVy * ny;

    if (vn < 0) {
      const e = 0.9;
      puck.vx = puck.vx - (1 + e) * vn * nx + limitedMVx * 0.4;
      puck.vy = puck.vy - (1 + e) * vn * ny + limitedMVy * 0.4;
      state.lastHit = hitter;
    }
  }
}

function checkWinner(state: SimAirhockeyState) {
  if (state.scoreP1 >= state.targetScore) state.winner = 1;
  else if (state.scoreP2 >= state.targetScore) state.winner = 2;
}
