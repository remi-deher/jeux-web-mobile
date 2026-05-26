export interface TicTacToeState {
  board: (string | null)[]; // 9 cells (0 to 8)
  currentPlayer: 'X' | 'O';
  winner: 'X' | 'O' | 'draw' | null;
  winningLine: number[];
}

export function createInitialTicTacToeState(): TicTacToeState {
  return {
    board: Array(9).fill(null),
    currentPlayer: 'X',
    winner: null,
    winningLine: []
  };
}

export function makeTicTacToeMove(state: TicTacToeState, cellIndex: number, playerSign: 'X' | 'O'): boolean {
  if (state.winner !== null) return false;
  if (state.currentPlayer !== playerSign) return false;
  if (cellIndex < 0 || cellIndex >= 9) return false;
  if (state.board[cellIndex] !== null) return false; // Already occupied

  state.board[cellIndex] = playerSign;

  const winLines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6]             // Diagonals
  ];

  for (const line of winLines) {
    const [a, b, c] = line;
    if (state.board[a] && state.board[a] === state.board[b] && state.board[a] === state.board[c]) {
      state.winner = playerSign;
      state.winningLine = line;
      return true;
    }
  }

  // Check draw
  const isFull = state.board.every(cell => cell !== null);
  if (isFull) {
    state.winner = 'draw';
  } else {
    // Switch turn
    state.currentPlayer = state.currentPlayer === 'X' ? 'O' : 'X';
  }

  return true;
}
