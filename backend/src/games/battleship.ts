export interface Ship {
  id: string;
  size: number;
  row: number;
  col: number;
  horizontal: boolean;
  hits: number;
  placed: boolean;
}

export interface PlayerState {
  playerId: string;
  ships: Ship[];
  board: ('empty' | 'ship' | 'hit' | 'miss')[][]; // 10x10 board representing player's own grid
  shotsReceived: { r: number; c: number; hit: boolean }[];
  ready: boolean;
}

export interface BattleshipState {
  players: { [id: string]: PlayerState };
  currentPlayerId: string | null; // whose turn it is to fire
  phase: 'setup' | 'playing' | 'finished';
  winnerId: string | null;
}

export function createInitialBattleshipState(playerIds: string[]): BattleshipState {
  const players: { [id: string]: PlayerState } = {};
  playerIds.forEach(id => {
    players[id] = {
      playerId: id,
      ready: false,
      board: Array(10).fill(null).map(() => Array(10).fill('empty')),
      shotsReceived: [],
      ships: [
        { id: 'carrier', size: 5, row: -1, col: -1, horizontal: true, hits: 0, placed: false },
        { id: 'battleship', size: 4, row: -1, col: -1, horizontal: true, hits: 0, placed: false },
        { id: 'cruiser', size: 3, row: -1, col: -1, horizontal: true, hits: 0, placed: false },
        { id: 'submarine', size: 3, row: -1, col: -1, horizontal: true, hits: 0, placed: false },
        { id: 'destroyer', size: 2, row: -1, col: -1, horizontal: true, hits: 0, placed: false }
      ]
    };
  });

  return {
    players,
    currentPlayerId: null,
    phase: 'setup',
    winnerId: null
  };
}

export function placeShip(
  state: BattleshipState,
  playerId: string,
  shipId: string,
  row: number,
  col: number,
  horizontal: boolean
): boolean {
  if (state.phase !== 'setup') return false;
  const player = state.players[playerId];
  if (!player || player.ready) return false;

  const ship = player.ships.find(s => s.id === shipId);
  if (!ship) return false;

  // Validate bounds
  const size = ship.size;
  if (horizontal) {
    if (col < 0 || col + size > 10 || row < 0 || row >= 10) return false;
  } else {
    if (row < 0 || row + size > 10 || col < 0 || col >= 10) return false;
  }

  // Validate collisions with other ALREADY placed ships (excluding this ship's old placement)
  const tempBoard = Array(10).fill(null).map(() => Array(10).fill(false));
  for (const s of player.ships) {
    if (s.id !== shipId && s.placed) {
      for (let i = 0; i < s.size; i++) {
        const r = s.horizontal ? s.row : s.row + i;
        const c = s.horizontal ? s.col + i : s.col;
        tempBoard[r][c] = true;
      }
    }
  }

  // Check collision for new placement
  for (let i = 0; i < size; i++) {
    const r = horizontal ? row : row + i;
    const c = horizontal ? col + i : col;
    if (tempBoard[r][c]) return false; // Overlap!
  }

  // Apply placement
  ship.row = row;
  ship.col = col;
  ship.horizontal = horizontal;
  ship.placed = true;

  // Re-sync player board
  player.board = Array(10).fill(null).map(() => Array(10).fill('empty'));
  player.ships.forEach(s => {
    if (s.placed) {
      for (let i = 0; i < s.size; i++) {
        const r = s.horizontal ? s.row : s.row + i;
        const c = s.horizontal ? s.col + i : s.col;
        player.board[r][c] = 'ship';
      }
    }
  });

  return true;
}

export function setPlayerReady(state: BattleshipState, playerId: string): boolean {
  if (state.phase !== 'setup') return false;
  const player = state.players[playerId];
  if (!player) return false;

  // All ships must be placed
  const allPlaced = player.ships.every(s => s.placed);
  if (!allPlaced) return false;

  player.ready = true;

  // Check if both players are ready
  const allPlayersReady = Object.values(state.players).every(p => p.ready);
  if (allPlayersReady && Object.keys(state.players).length === 2) {
    state.phase = 'playing';
    // Random starter
    const ids = Object.keys(state.players);
    state.currentPlayerId = ids[Math.floor(Math.random() * ids.length)];
  }

  return true;
}

export function fireShot(
  state: BattleshipState,
  firingPlayerId: string,
  row: number,
  col: number
): { success: boolean; hit: boolean; sunkShipId: string | null } {
  const result = { success: false, hit: false, sunkShipId: null as string | null };
  if (state.phase !== 'playing') return result;
  if (state.currentPlayerId !== firingPlayerId) return result;
  if (row < 0 || row >= 10 || col < 0 || col >= 10) return result;

  // Get opponent
  const opponentId = Object.keys(state.players).find(id => id !== firingPlayerId);
  if (!opponentId) return result;

  const opponent = state.players[opponentId];
  const targetCell = opponent.board[row][col];

  // Already shot here?
  if (targetCell === 'hit' || targetCell === 'miss') return result;

  result.success = true;

  if (targetCell === 'ship') {
    opponent.board[row][col] = 'hit';
    result.hit = true;
    opponent.shotsReceived.push({ r: row, c: col, hit: true });

    // Find which ship was hit and increment hit counter
    for (const ship of opponent.ships) {
      for (let i = 0; i < ship.size; i++) {
        const sr = ship.horizontal ? ship.row : ship.row + i;
        const sc = ship.horizontal ? ship.col + i : ship.col;
        if (sr === row && sc === col) {
          ship.hits++;
          if (ship.hits === ship.size) {
            result.sunkShipId = ship.id;
          }
          break;
        }
      }
    }

    // Check if opponent lost all ships
    const allSunk = opponent.ships.every(s => s.hits === s.size);
    if (allSunk) {
      state.phase = 'finished';
      state.winnerId = firingPlayerId;
    }
  } else {
    opponent.board[row][col] = 'miss';
    opponent.shotsReceived.push({ r: row, c: col, hit: false });
    // Switch turn
    state.currentPlayerId = opponentId;
  }

  return result;
}

// Function to filter out secret info (opponent ship locations) before sending state to client
export function getSanitizedBattleshipState(state: BattleshipState, playerId: string) {
  const sanitizedPlayers: { [id: string]: any } = {};

  Object.keys(state.players).forEach(id => {
    const p = state.players[id];
    if (id === playerId) {
      // Full details for self
      sanitizedPlayers[id] = p;
    } else {
      // Strip ship positions for opponent
      const opponentBoard = p.board.map(row =>
        row.map(cell => (cell === 'ship' ? 'empty' : cell))
      );
      sanitizedPlayers[id] = {
        playerId: p.playerId,
        ready: p.ready,
        board: opponentBoard,
        shotsReceived: p.shotsReceived,
        ships: p.ships.map(s => ({
          id: s.id,
          size: s.size,
          placed: s.placed,
          sunk: s.hits === s.size
        }))
      };
    }
  });

  return {
    phase: state.phase,
    currentPlayerId: state.currentPlayerId,
    winnerId: state.winnerId,
    players: sanitizedPlayers
  };
}
