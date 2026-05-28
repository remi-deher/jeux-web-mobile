export interface GomokuState {
  board: number[][]; // 15 rows, 15 columns (0: empty, 1: player 1, 2: player 2)
  currentPlayer: number; // 1 or 2
  winner: number | 'draw' | null;
  winningLine: [number, number][]; // coordinates of winning 5-in-a-row segment
  lastMove: [number, number] | null; // last played coordinates
}

export function createInitialGomokuState(): GomokuState {
  return {
    board: Array(15).fill(null).map(() => Array(15).fill(0)),
    currentPlayer: 1,
    winner: null,
    winningLine: [],
    lastMove: null
  };
}

export function makeGomokuMove(state: GomokuState, row: number, col: number, playerNum: number): boolean {
  if (state.winner !== null) return false;
  if (state.currentPlayer !== playerNum) return false;
  if (row < 0 || row >= 15 || col < 0 || col >= 15) return false;
  if (state.board[row][col] !== 0) return false;

  // Make move
  state.board[row][col] = playerNum;
  state.lastMove = [row, col];

  // Check win
  const winLine = checkWin(state.board, row, col, playerNum);
  if (winLine) {
    state.winner = playerNum;
    state.winningLine = winLine;
  } else if (checkDraw(state.board)) {
    state.winner = 'draw';
  } else {
    // Switch turn
    state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
  }

  return true;
}

function checkWin(board: number[][], r: number, c: number, p: number): [number, number][] | null {
  const directions = [
    [[0, 1], [0, -1]],  // Horizontal
    [[1, 0], [-1, 0]],  // Vertical
    [[1, 1], [-1, -1]], // Diagonal down-right
    [[1, -1], [-1, 1]]  // Diagonal up-right
  ];

  for (const dir of directions) {
    const line: [number, number][] = [[r, c]];
    for (const [dr, dc] of dir) {
      let nr = r + dr;
      let nc = c + dc;
      while (nr >= 0 && nr < 15 && nc >= 0 && nc < 15 && board[nr][nc] === p) {
        line.push([nr, nc]);
        nr += dr;
        nc += dc;
      }
    }
    if (line.length >= 5) {
      return line;
    }
  }
  return null;
}

function checkDraw(board: number[][]): boolean {
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      if (board[r][c] === 0) return false;
    }
  }
  return true;
}
