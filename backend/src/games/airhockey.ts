export interface AirhockeyState {
  puck: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
  };
  p1Mallet: {
    x: number;
    y: number;
    prevX: number;
    prevY: number;
    radius: number;
  };
  p2Mallet: {
    x: number;
    y: number;
    prevX: number;
    prevY: number;
    radius: number;
  };
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

export function createInitialAirhockeyState(): AirhockeyState {
  return {
    puck: { x: 50, y: 50, vx: 0, vy: 0, radius: 2.5 },
    p1Mallet: { x: 20, y: 50, prevX: 20, prevY: 50, radius: 4.0 },
    p2Mallet: { x: 80, y: 50, prevX: 80, prevY: 50, radius: 4.0 },
    scoreP1: 0,
    scoreP2: 0,
    winner: null,
    targetScore: 5,
    serving: true,
    serveCountdown: 30,
    serveTowards: Math.random() > 0.5 ? 1 : 2,
    lastHit: null,
    p1Ready: false,
    p2Ready: false,
  };
}

export function updateAirhockeyPhysics(state: AirhockeyState) {
  if (state.winner !== null) return;
  if (!state.p1Ready || !state.p2Ready) return;

  // Calcul des vitesses des mallets basées sur leur déplacement depuis le tick précédent
  const p1Vx = state.p1Mallet.x - state.p1Mallet.prevX;
  const p1Vy = state.p1Mallet.y - state.p1Mallet.prevY;
  const p2Vx = state.p2Mallet.x - state.p2Mallet.prevX;
  const p2Vy = state.p2Mallet.y - state.p2Mallet.prevY;

  // Sauvegarde des positions actuelles pour le prochain tick
  state.p1Mallet.prevX = state.p1Mallet.x;
  state.p1Mallet.prevY = state.p1Mallet.y;
  state.p2Mallet.prevX = state.p2Mallet.x;
  state.p2Mallet.prevY = state.p2Mallet.y;

  // Reset du hit marker par tick
  state.lastHit = null;

  // ── Serve delay ────────────────────────────────────────────────────────────
  if (state.serving) {
    state.serveCountdown -= 1;
    if (state.serveCountdown <= 0) {
      state.serving = false;
      state.puck.x = 50;
      state.puck.y = 50;
      state.puck.vx = state.serveTowards === 1 ? -0.8 : 0.8;
      state.puck.vy = Math.random() * 0.8 - 0.4;
    }
    return;
  }

  let puck = state.puck;

  // Friction : le palet ralentit très légèrement sur la table
  puck.vx *= 0.994;
  puck.vy *= 0.994;

  puck.x += puck.vx;
  puck.y += puck.vy;

  // Cages de buts entre Y = 32 et Y = 68
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
  // Côté gauche (x <= 0)
  if (puck.x - puck.radius <= 0) {
    if (puck.y >= goalTop && puck.y <= goalBottom) {
      // BUT ! Point pour P2 (droite)
      state.scoreP2 += 1;
      state.lastHit = 'goal';
      startServe(state, 1);
      checkWinner(state);
      return;
    } else {
      // Rebond sur le mur de gauche
      puck.x = puck.radius;
      puck.vx = -puck.vx * 0.95;
      state.lastHit = 'wall';
    }
  }

  // Côté droit (x >= 100)
  if (puck.x + puck.radius >= 100) {
    if (puck.y >= goalTop && puck.y <= goalBottom) {
      // BUT ! Point pour P1 (gauche)
      state.scoreP1 += 1;
      state.lastHit = 'goal';
      startServe(state, 2);
      checkWinner(state);
      return;
    } else {
      // Rebond sur le mur de droite
      puck.x = 100 - puck.radius;
      puck.vx = -puck.vx * 0.95;
      state.lastHit = 'wall';
    }
  }

  // ── Collisions avec les mallets (cercle à cercle) ───────────────────────────
  handleMalletCollision(state, state.p1Mallet, p1Vx, p1Vy, 'p1');
  handleMalletCollision(state, state.p2Mallet, p2Vx, p2Vy, 'p2');

  // Cap de vitesse pour éviter les bugs physiques hors-limites
  const maxSpeed = 3.0;
  const speed = Math.sqrt(puck.vx * puck.vx + puck.vy * puck.vy);
  if (speed > maxSpeed) {
    puck.vx = (puck.vx / speed) * maxSpeed;
    puck.vy = (puck.vy / speed) * maxSpeed;
  }
}

function handleMalletCollision(
  state: AirhockeyState,
  mallet: AirhockeyState['p1Mallet'],
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
    // 1. Repousser le palet hors de la mallet
    const nx = dx / dist;
    const ny = dy / dist;

    puck.x = mallet.x + nx * minDist;
    puck.y = mallet.y + ny * minDist;

    // 2. Calcul du rebond élastique avec la vitesse relative
    // Cap des vitesses de mallet pour éviter d'avoir des forces infinies
    const capM = 2.5;
    const limitedMVx = Math.max(-capM, Math.min(capM, mVx));
    const limitedMVy = Math.max(-capM, Math.min(capM, mVy));

    const relVx = puck.vx - limitedMVx;
    const relVy = puck.vy - limitedMVy;

    const vn = relVx * nx + relVy * ny;

    if (vn < 0) {
      const e = 0.9; // élasticité du rebond
      // Mise à jour de la vitesse du puck en incorporant la vitesse de la mallet
      puck.vx = puck.vx - (1 + e) * vn * nx + limitedMVx * 0.4;
      puck.vy = puck.vy - (1 + e) * vn * ny + limitedMVy * 0.4;
      state.lastHit = hitter;
    }
  }
}

function startServe(state: AirhockeyState, towards: 1 | 2) {
  state.serving = true;
  state.serveCountdown = 30; // ~1 s à 30 ticks
  state.serveTowards = towards;
  state.puck.x = 50;
  state.puck.y = 50;
  state.puck.vx = 0;
  state.puck.vy = 0;
}

function checkWinner(state: AirhockeyState) {
  if (state.scoreP1 >= state.targetScore) state.winner = 1;
  else if (state.scoreP2 >= state.targetScore) state.winner = 2;
}
