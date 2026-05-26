export interface Connect4State {
  board: number[][]; // 6 rows, 7 columns (0: empty, 1: player 1, 2: player 2)
  currentPlayer: number; // 1 or 2
  winner: number | 'draw' | null;
  winningLine: [number, number][]; // coordinates of winning segment
}

export function createInitialConnect4State(): Connect4State {
  return {
    board: Array(6).fill(null).map(() => Array(7).fill(0)),
    currentPlayer: 1,
    winner: null,
    winningLine: []
  };
}

export function makeConnect4Move(state: Connect4State, column: number, playerNum: number): boolean {
  if (state.winner !== null) return false;
  if (state.currentPlayer !== playerNum) return false;
  if (column < 0 || column >= 7) return false;

  // Find lowest empty row in column
  let row = -1;
  for (let r = 5; r >= 0; r--) {
    if (state.board[r][column] === 0) {
      row = r;
      break;
    }
  }

  if (row === -1) return false; // Column full

  // Make move
  state.board[row][column] = playerNum;

  // Check win
  const winLine = checkWin(state.board, row, column, playerNum);
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
      while (nr >= 0 && nr < 6 && nc >= 0 && nc < 7 && board[nr][nc] === p) {
        line.push([nr, nc]);
        nr += dr;
        nc += dc;
      }
    }
    if (line.length >= 4) {
      return line;
    }
  }
  return null;
}

function checkDraw(board: number[][]): boolean {
  for (let c = 0; c < 7; c++) {
    if (board[0][c] === 0) return false;
  }
  return true;
}
