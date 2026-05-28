/**
 * Snake vs Snake — server-side physics
 *
 * Grid : 25 × 20
 * Tick : 15 Hz (called by startSnakeLoop every ~66 ms)
 * Each tick both snakes move one cell in their current direction.
 */

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface SnakeCell { x: number; y: number; }

export interface SnakePlayer {
  body:    SnakeCell[];   // [0] = head
  dir:     Direction;
  nextDir: Direction;     // buffered direction (applied next tick)
  score:   number;
  alive:   boolean;
}

export interface SnakeState {
  width:     number;       // 25
  height:    number;       // 20
  p1:        SnakePlayer;
  p2:        SnakePlayer;
  food:      SnakeCell[];
  winner:    number | null; // 1, 2, 0 (draw), or null
  tickCount: number;
  playerIds: [string, string];
}

// ── helpers ──────────────────────────────────────────────────────────────────

function opposite(d: Direction): Direction {
  if (d === 'up')    return 'down';
  if (d === 'down')  return 'up';
  if (d === 'left')  return 'right';
  return 'left';
}

function randomCell(state: SnakeState, exclude: SnakeCell[] = []): SnakeCell {
  const occupied = new Set<string>();
  [...state.p1.body, ...state.p2.body, ...exclude].forEach(c => occupied.add(`${c.x},${c.y}`));
  let cell: SnakeCell;
  let tries = 0;
  do {
    cell = {
      x: Math.floor(Math.random() * state.width),
      y: Math.floor(Math.random() * state.height),
    };
    tries++;
  } while (occupied.has(`${cell.x},${cell.y}`) && tries < 500);
  return cell;
}

function makeSnake(x: number, y: number, dir: Direction, len: number): SnakePlayer {
  const body: SnakeCell[] = [];
  for (let i = 0; i < len; i++) {
    if (dir === 'right') body.push({ x: x - i, y });
    else if (dir === 'left')  body.push({ x: x + i, y });
    else if (dir === 'down')  body.push({ x, y: y - i });
    else                      body.push({ x, y: y + i });
  }
  return { body, dir, nextDir: dir, score: 0, alive: true };
}

// ── public API ────────────────────────────────────────────────────────────────

export function createInitialSnakeState(playerIds: [string, string]): SnakeState {
  const state: SnakeState = {
    width:     25,
    height:    20,
    p1:        makeSnake(4,  10, 'right', 3),
    p2:        makeSnake(20, 10, 'left',  3),
    food:      [],
    winner:    null,
    tickCount: 0,
    playerIds,
  };
  // Spawn 2 initial food items
  state.food.push(randomCell(state));
  state.food.push(randomCell(state, state.food));
  return state;
}

/**
 * Queue a direction change for a player.
 * Ignores U-turns (you can't reverse directly).
 */
export function setSnakeDirection(state: SnakeState, playerIndex: 0 | 1, dir: Direction): void {
  const snake = playerIndex === 0 ? state.p1 : state.p2;
  if (!snake.alive) return;
  // Prevent 180° turn
  if (dir !== opposite(snake.dir)) {
    snake.nextDir = dir;
  }
}

/**
 * Advance the simulation by one tick.
 * Returns the updated state (mutates in-place).
 */
export function updateSnakePhysics(state: SnakeState): void {
  if (state.winner !== null) return;

  state.tickCount++;

  // Apply buffered directions
  if (state.p1.alive) state.p1.dir = state.p1.nextDir;
  if (state.p2.alive) state.p2.dir = state.p2.nextDir;

  // Compute next heads
  const nextHead = (snake: SnakePlayer): SnakeCell => {
    const head = snake.body[0];
    switch (snake.dir) {
      case 'up':    return { x: head.x, y: head.y - 1 };
      case 'down':  return { x: head.x, y: head.y + 1 };
      case 'left':  return { x: head.x - 1, y: head.y };
      case 'right': return { x: head.x + 1, y: head.y };
    }
  };

  const h1 = state.p1.alive ? nextHead(state.p1) : null;
  const h2 = state.p2.alive ? nextHead(state.p2) : null;

  const inBounds = (c: SnakeCell) =>
    c.x >= 0 && c.x < state.width && c.y >= 0 && c.y < state.height;

  const hitsBody = (head: SnakeCell, body: SnakeCell[], skipTail = true): boolean => {
    const limit = skipTail ? body.length - 1 : body.length;
    for (let i = 0; i < limit; i++) {
      if (body[i].x === head.x && body[i].y === head.y) return true;
    }
    return false;
  };

  // Collision detection
  if (h1) {
    const wallHit = !inBounds(h1);
    const selfHit = hitsBody(h1, state.p1.body);
    // Hit opponent's body (not just tail — full body is dangerous)
    const opponentHit = state.p2.alive && hitsBody(h1, state.p2.body, false);
    if (wallHit || selfHit || opponentHit) {
      state.p1.alive = false;
    }
  }

  if (h2) {
    const wallHit = !inBounds(h2);
    const selfHit = hitsBody(h2, state.p2.body);
    const opponentHit = state.p1.alive && hitsBody(h2, state.p1.body, false);
    if (wallHit || selfHit || opponentHit) {
      state.p2.alive = false;
    }
  }

  // Head-on collision (both die)
  if (h1 && h2 && state.p1.alive && state.p2.alive) {
    if (h1.x === h2.x && h1.y === h2.y) {
      state.p1.alive = false;
      state.p2.alive = false;
    }
  }

  // Move snakes (only alive ones)
  const moveSnake = (snake: SnakePlayer, head: SnakeCell) => {
    // Check if eating food
    const foodIdx = state.food.findIndex(f => f.x === head.x && f.y === head.y);
    if (foodIdx !== -1) {
      snake.score++;
      state.food.splice(foodIdx, 1);
      // Don't remove tail → snake grows
      snake.body = [head, ...snake.body];
      // Spawn replacement food if < 2 items
      while (state.food.length < 2) {
        state.food.push(randomCell(state, [...state.food]));
      }
    } else {
      snake.body = [head, ...snake.body.slice(0, -1)];
    }
  };

  if (state.p1.alive && h1) moveSnake(state.p1, h1);
  if (state.p2.alive && h2) moveSnake(state.p2, h2);

  // Determine winner
  const p1Dead = !state.p1.alive;
  const p2Dead = !state.p2.alive;

  if (p1Dead && p2Dead) {
    state.winner = 0; // draw
  } else if (p1Dead) {
    state.winner = 2;
  } else if (p2Dead) {
    state.winner = 1;
  }
}
