export interface OthelloState {
  board: number[][]; // 8 rows, 8 columns (0: empty, 1: player 1 (black), 2: player 2 (white))
  currentPlayer: number; // 1 or 2
  winner: number | 'draw' | null;
  scores: { p1: number; p2: number };
  validMoves: [number, number][]; // pre-calculated valid moves for the current player
}

export function createInitialOthelloState(): OthelloState {
  const board = Array(8).fill(null).map(() => Array(8).fill(0));
  // Standard Othello starting configuration
  board[3][3] = 2; // White
  board[3][4] = 1; // Black
  board[4][3] = 1; // Black
  board[4][4] = 2; // White

  const state: OthelloState = {
    board,
    currentPlayer: 1, // Black plays first
    winner: null,
    scores: { p1: 2, p2: 2 },
    validMoves: []
  };

  state.validMoves = calculateValidMoves(board, 1);
  return state;
}

const directions = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1]
];

function getFlipsForMove(board: number[][], r: number, c: number, p: number): [number, number][] {
  if (board[r][c] !== 0) return [];
  const opponent = p === 1 ? 2 : 1;
  const flips: [number, number][] = [];

  for (const [dr, dc] of directions) {
    let nr = r + dr;
    let nc = c + dc;
    const path: [number, number][] = [];

    while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr][nc] === opponent) {
      path.push([nr, nc]);
      nr += dr;
      nc += dc;
    }

    if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr][nc] === p) {
      flips.push(...path);
    }
  }

  return flips;
}

function calculateValidMoves(board: number[][], p: number): [number, number][] {
  const moves: [number, number][] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (getFlipsForMove(board, r, c, p).length > 0) {
        moves.push([r, c]);
      }
    }
  }
  return moves;
}

function updateScoresAndStatus(state: OthelloState) {
  let p1 = 0;
  let p2 = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (state.board[r][c] === 1) p1++;
      if (state.board[r][c] === 2) p2++;
    }
  }

  state.scores = { p1, p2 };

  // Calculate valid moves for current player
  let nextMoves = calculateValidMoves(state.board, state.currentPlayer);

  if (nextMoves.length === 0) {
    // If no moves, switch to opponent
    const opponent = state.currentPlayer === 1 ? 2 : 1;
    const oppMoves = calculateValidMoves(state.board, opponent);

    if (oppMoves.length === 0) {
      // Neither player has moves -> Game over
      state.validMoves = [];
      if (p1 > p2) {
        state.winner = 1;
      } else if (p2 > p1) {
        state.winner = 2;
      } else {
        state.winner = 'draw';
      }
    } else {
      // Opponent has moves, turn switches (active player passes)
      state.currentPlayer = opponent;
      state.validMoves = oppMoves;
    }
  } else {
    state.validMoves = nextMoves;
  }
}

export function makeOthelloMove(state: OthelloState, row: number, col: number, playerNum: number): boolean {
  if (state.winner !== null) return false;
  if (state.currentPlayer !== playerNum) return false;

  const flips = getFlipsForMove(state.board, row, col, playerNum);
  if (flips.length === 0) return false;

  // Place piece
  state.board[row][col] = playerNum;

  // Flip pieces
  for (const [fr, fc] of flips) {
    state.board[fr][fc] = playerNum;
  }

  // Switch turn
  state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;

  // Re-calculate validation, turns, score, game over
  updateScoresAndStatus(state);

  return true;
}
