export interface PlacedTile {
  tile: [number, number];
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isDouble: boolean;
}

export interface DominosState {
  variant: 'classic' | 'branches' | 'grid';
  placedTiles: PlacedTile[];
  handP1: [number, number][];
  handP2: [number, number][];
  boneyard: [number, number][];
  currentPlayer: number; // 1 or 2
  winner: number | 'draw' | null;
  winnerReason?: string;
  lastMove: {
    player: number;
    domino: [number, number];
  } | null;
}

export function createInitialDominosState(variant: 'classic' | 'branches' | 'grid' = 'classic'): DominosState {
  const deck: [number, number][] = [];
  for (let i = 0; i <= 6; i++) {
    for (let j = i; j <= 6; j++) {
      deck.push([i, j]);
    }
  }

  // Shuffle deck
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  // Deal 7 cards to each player
  const handP1 = deck.splice(0, 7);
  const handP2 = deck.splice(0, 7);
  const boneyard = deck;

  return {
    variant,
    placedTiles: [],
    handP1,
    handP2,
    boneyard,
    currentPlayer: 1,
    winner: null,
    lastMove: null
  };
}

// Helper to get value of a cell on the board
function getCellValue(placedTiles: PlacedTile[], x: number, y: number): number | null {
  for (const pt of placedTiles) {
    if (pt.x1 === x && pt.y1 === y) return pt.tile[0];
    if (pt.x2 === x && pt.y2 === y) return pt.tile[1];
  }
  return null;
}

// Helper to check if a cell is occupied
function isCellOccupied(placedTiles: PlacedTile[], x: number, y: number): boolean {
  return getCellValue(placedTiles, x, y) !== null;
}

// Get all playable endpoints with their target empty coordinate and matching value
export interface PlayableEndpoint {
  xConnect: number;  // empty cell to place matching half
  yConnect: number;
  xOuter: number;    // empty cell to place outer half
  yOuter: number;
  matchValue: number;
}

export function getPlayableEndpoints(state: DominosState): PlayableEndpoint[] {
  const { placedTiles, variant } = state;
  if (placedTiles.length === 0) {
    return [];
  }

  const endpoints: PlayableEndpoint[] = [];

  if (variant === 'classic') {
    // Only the outer ends of the horizontal chain are open.
    // Find min X and max X
    let minTile = placedTiles[0];
    let maxTile = placedTiles[0];
    for (const pt of placedTiles) {
      if (Math.min(pt.x1, pt.x2) < Math.min(minTile.x1, minTile.x2)) {
        minTile = pt;
      }
      if (Math.max(pt.x1, pt.x2) > Math.max(maxTile.x1, maxTile.x2)) {
        maxTile = pt;
      }
    }

    const leftX = minTile.x1 < minTile.x2 ? minTile.x1 : minTile.x2;
    const leftVal = minTile.x1 < minTile.x2 ? minTile.tile[0] : minTile.tile[1];
    endpoints.push({
      xConnect: leftX - 1,
      yConnect: 0,
      xOuter: leftX - 2,
      yOuter: 0,
      matchValue: leftVal
    });

    const rightX = maxTile.x1 > maxTile.x2 ? maxTile.x1 : maxTile.x2;
    const rightVal = maxTile.x1 > maxTile.x2 ? maxTile.tile[0] : maxTile.tile[1];
    endpoints.push({
      xConnect: rightX + 1,
      yConnect: 0,
      xOuter: rightX + 2,
      yOuter: 0,
      matchValue: rightVal
    });

  } else if (variant === 'branches') {
    // Each tile's half is an endpoint if it has no adjacent occupied cells other than its partner.
    // However, doubles open perpendicular directions.
    const directions = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ];

    for (const pt of placedTiles) {
      // Check half 1
      const checkHalf = (hx: number, hy: number, val: number, px: number, py: number) => {
        const dx = hx - px;
        const dy = hy - py;

        if (pt.isDouble) {
          // All 4 directions are open if they are empty
          for (const [ndx, ndy] of directions) {
            const tx = hx + ndx;
            const ty = hy + ndy;
            if (!isCellOccupied(placedTiles, tx, ty)) {
              // The next cell in that direction
              const ox = tx + ndx;
              const oy = ty + ndy;
              if (!isCellOccupied(placedTiles, ox, oy)) {
                endpoints.push({
                  xConnect: tx,
                  yConnect: ty,
                  xOuter: ox,
                  yOuter: oy,
                  matchValue: val
                });
              }
            }
          }
        } else {
          // Only grows away from partner
          const tx = hx + dx;
          const ty = hy + dy;
          if (!isCellOccupied(placedTiles, tx, ty)) {
            const ox = tx + dx;
            const oy = ty + dy;
            if (!isCellOccupied(placedTiles, ox, oy)) {
              endpoints.push({
                xConnect: tx,
                yConnect: ty,
                xOuter: ox,
                yOuter: oy,
                matchValue: val
              });
            }
          }
        }
      };

      checkHalf(pt.x1, pt.y1, pt.tile[0], pt.x2, pt.y2);
      checkHalf(pt.x2, pt.y2, pt.tile[1], pt.x1, pt.y1);
    }
  } else if (variant === 'grid') {
    // Grid variant: any empty cell adjacent to any placed cell is a connector
    const directions = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ];
    const visited = new Set<string>();

    for (const pt of placedTiles) {
      const checkCoords = [[pt.x1, pt.y1, pt.tile[0]], [pt.x2, pt.y2, pt.tile[1]]];
      for (const [cx, cy, val] of checkCoords) {
        for (const [dx, dy] of directions) {
          const tx = cx + dx;
          const ty = cy + dy;
          const key = `${tx},${ty}`;
          if (!isCellOccupied(placedTiles, tx, ty) && !visited.has(key)) {
            visited.add(key);
            // From tx, ty we can go in any of the 4 directions to place the other half
            for (const [odx, ody] of directions) {
              const ox = tx + odx;
              const oy = ty + ody;
              if ((ox !== cx || oy !== cy) && !isCellOccupied(placedTiles, ox, oy)) {
                endpoints.push({
                  xConnect: tx,
                  yConnect: ty,
                  xOuter: ox,
                  yOuter: oy,
                  matchValue: val
                });
              }
            }
          }
        }
      }
    }
  }

  return endpoints;
}

export function hasValidMove(hand: [number, number][], state: DominosState): boolean {
  if (state.placedTiles.length === 0) return hand.length > 0;

  if (state.variant === 'grid') {
    // For Grid, check if any tile in hand can be placed adjacent to the board matching all adjacent pips.
    const eps = getPlayableEndpoints(state);
    for (const tile of hand) {
      for (const ep of eps) {
        if (tile[0] === ep.matchValue || tile[1] === ep.matchValue) {
          // Test placement of tile[0] at ep.xConnect and tile[1] at ep.xOuter
          if (validateGridNeighborPips(state.placedTiles, ep.xConnect, ep.yConnect, tile[0], ep.xOuter, ep.yOuter) &&
              validateGridNeighborPips(state.placedTiles, ep.xOuter, ep.yOuter, tile[1], ep.xConnect, ep.yConnect)) {
            return true;
          }
          // Test placement flipped: tile[1] at ep.xConnect and tile[0] at ep.xOuter
          if (validateGridNeighborPips(state.placedTiles, ep.xConnect, ep.yConnect, tile[1], ep.xOuter, ep.yOuter) &&
              validateGridNeighborPips(state.placedTiles, ep.xOuter, ep.yOuter, tile[0], ep.xConnect, ep.yConnect)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  const eps = getPlayableEndpoints(state);
  return hand.some(([x, y]) => eps.some(ep => ep.matchValue === x || ep.matchValue === y));
}

// Helper to validate that all neighbors of a cell matches its value (for Grid variant)
function validateGridNeighborPips(
  placedTiles: PlacedTile[],
  x: number,
  y: number,
  val: number,
  ignoreX: number,
  ignoreY: number
): boolean {
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];
  for (const [dx, dy] of directions) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx === ignoreX && ny === ignoreY) continue;
    const nVal = getCellValue(placedTiles, nx, ny);
    if (nVal !== null && nVal !== val) {
      return false; // Mismatch
    }
  }
  return true;
}

export function makeDominosMove(
  state: DominosState,
  tileIndex: number,
  side: 'left' | 'right' | null,
  coords: { x1: number; y1: number; x2: number; y2: number } | null,
  playerNum: number
): boolean {
  if (state.winner !== null) return false;
  if (state.currentPlayer !== playerNum) return false;

  const hand = playerNum === 1 ? state.handP1 : state.handP2;
  if (tileIndex < 0 || tileIndex >= hand.length) return false;

  const tile = hand[tileIndex];
  const isDouble = tile[0] === tile[1];

  if (state.placedTiles.length === 0) {
    // Place first tile at (0, 0) and (1, 0)
    state.placedTiles.push({
      tile,
      x1: 0,
      y1: 0,
      x2: 1,
      y2: 0,
      isDouble
    });
    hand.splice(tileIndex, 1);
    state.lastMove = { player: playerNum, domino: tile };
  } else if (state.variant === 'classic') {
    if (!side) return false;
    const eps = getPlayableEndpoints(state);
    const ep = eps.find(e => {
      if (side === 'left' && e.xConnect < 0) return true;
      if (side === 'right' && e.xConnect > 0) return true;
      return false;
    });

    if (!ep) return false;

    // Verify if tile matches endpoint value
    let x1 = ep.xConnect;
    let y1 = ep.yConnect;
    let x2 = ep.xOuter;
    let y2 = ep.yOuter;
    let finalTile = tile;

    if (tile[1] === ep.matchValue) {
      // tile[1] connects, tile[0] is outer
      finalTile = [tile[1], tile[0]];
    } else if (tile[0] === ep.matchValue) {
      // tile[0] connects, tile[1] is outer
      finalTile = [tile[0], tile[1]];
    } else {
      return false; // No match
    }

    state.placedTiles.push({
      tile: finalTile,
      x1,
      y1,
      x2,
      y2,
      isDouble
    });
    hand.splice(tileIndex, 1);
    state.lastMove = { player: playerNum, domino: tile };

  } else {
    // Branches or Grid variant: require coordinates from drag and drop
    if (!coords) return false;
    const { x1, y1, x2, y2 } = coords;

    // Check adjacency
    if (Math.abs(x1 - x2) + Math.abs(y1 - y2) !== 1) return false;

    // Check overlap
    if (isCellOccupied(state.placedTiles, x1, y1) || isCellOccupied(state.placedTiles, x2, y2)) {
      return false;
    }

    // Determine rotation orientation/pip matching
    let finalTile: [number, number] | null = null;

    if (state.variant === 'branches') {
      const eps = getPlayableEndpoints(state);
      const matchedEp = eps.find(ep => ep.xConnect === x1 && ep.yConnect === y1 && ep.xOuter === x2 && ep.yOuter === y2);

      if (matchedEp) {
        if (tile[0] === matchedEp.matchValue) {
          finalTile = [tile[0], tile[1]];
        } else if (tile[1] === matchedEp.matchValue) {
          finalTile = [tile[1], tile[0]];
        }
      }
    } else if (state.variant === 'grid') {
      // In grid variant, verify neighbor matches for both cells
      // Try tile[0] at x1, tile[1] at x2
      if (validateGridNeighborPips(state.placedTiles, x1, y1, tile[0], x2, y2) &&
          validateGridNeighborPips(state.placedTiles, x2, y2, tile[1], x1, y1)) {
        // Also ensure it is adjacent to at least one placed tile
        const hasNeighbor = getCellValue(state.placedTiles, x1 - 1, y1) !== null ||
                            getCellValue(state.placedTiles, x1 + 1, y1) !== null ||
                            getCellValue(state.placedTiles, x1, y1 - 1) !== null ||
                            getCellValue(state.placedTiles, x1, y1 + 1) !== null ||
                            getCellValue(state.placedTiles, x2 - 1, y2) !== null ||
                            getCellValue(state.placedTiles, x2 + 1, y2) !== null ||
                            getCellValue(state.placedTiles, x2, y2 - 1) !== null ||
                            getCellValue(state.placedTiles, x2, y2 + 1) !== null;
        if (hasNeighbor) {
          finalTile = [tile[0], tile[1]];
        }
      }
      // If that didn't match, try flipped: tile[1] at x1, tile[0] at x2
      if (!finalTile &&
          validateGridNeighborPips(state.placedTiles, x1, y1, tile[1], x2, y2) &&
          validateGridNeighborPips(state.placedTiles, x2, y2, tile[0], x1, y1)) {
        const hasNeighbor = getCellValue(state.placedTiles, x1 - 1, y1) !== null ||
                            getCellValue(state.placedTiles, x1 + 1, y1) !== null ||
                            getCellValue(state.placedTiles, x1, y1 - 1) !== null ||
                            getCellValue(state.placedTiles, x1, y1 + 1) !== null ||
                            getCellValue(state.placedTiles, x2 - 1, y2) !== null ||
                            getCellValue(state.placedTiles, x2 + 1, y2) !== null ||
                            getCellValue(state.placedTiles, x2, y2 - 1) !== null ||
                            getCellValue(state.placedTiles, x2, y2 + 1) !== null;
        if (hasNeighbor) {
          finalTile = [tile[1], tile[0]];
        }
      }
    }

    if (!finalTile) return false;

    state.placedTiles.push({
      tile: finalTile,
      x1,
      y1,
      x2,
      y2,
      isDouble
    });
    hand.splice(tileIndex, 1);
    state.lastMove = { player: playerNum, domino: tile };
  }

  // Check victory
  if (hand.length === 0) {
    state.winner = playerNum;
    state.winnerReason = "plus de dominos";
    return true;
  }

  // Check if game is blocked
  checkBlockedState(state);

  if (state.winner === null) {
    state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
  }

  return true;
}

export function drawFromBoneyard(state: DominosState, playerNum: number): boolean {
  if (state.winner !== null) return false;
  if (state.currentPlayer !== playerNum) return false;
  if (state.boneyard.length === 0) return false;

  const hand = playerNum === 1 ? state.handP1 : state.handP2;

  // Rule check: drawing is only allowed if player has no valid move
  if (hasValidMove(hand, state)) return false;

  const tile = state.boneyard.pop();
  if (tile) {
    hand.push(tile);
    checkBlockedState(state);
    return true;
  }
  return false;
}

export function passTurn(state: DominosState, playerNum: number): boolean {
  if (state.winner !== null) return false;
  if (state.currentPlayer !== playerNum) return false;

  const hand = playerNum === 1 ? state.handP1 : state.handP2;

  // Can only pass if no valid moves exist and boneyard is empty
  if (hasValidMove(hand, state) || state.boneyard.length > 0) return false;

  state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
  checkBlockedState(state);
  return true;
}

function checkBlockedState(state: DominosState) {
  if (state.boneyard.length > 0) return;

  const canP1Move = hasValidMove(state.handP1, state);
  const canP2Move = hasValidMove(state.handP2, state);

  if (!canP1Move && !canP2Move) {
    const sumPips = (hand: [number, number][]) => hand.reduce((acc, [x, y]) => acc + x + y, 0);
    const p1Points = sumPips(state.handP1);
    const p2Points = sumPips(state.handP2);

    if (p1Points < p2Points) {
      state.winner = 1;
      state.winnerReason = `bloqué (points restants - P1: ${p1Points}, P2: ${p2Points})`;
    } else if (p2Points < p1Points) {
      state.winner = 2;
      state.winnerReason = `bloqué (points restants - P1: ${p1Points}, P2: ${p2Points})`;
    } else {
      state.winner = 'draw';
      state.winnerReason = `bloqué (égalité de points: ${p1Points})`;
    }
  }
}
