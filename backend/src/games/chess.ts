export interface ChessPiece {
  type: 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';
  player: 1 | 2; // 1 = White (bottom, moves up), 2 = Black (top, moves down)
}

export interface ChessState {
  board: (ChessPiece | null)[][]; // 8x8 board
  currentPlayer: 1 | 2;
  winner: 1 | 2 | 'draw' | null;
}

export function createInitialChessState(): ChessState {
  const board: (ChessPiece | null)[][] = Array(8)
    .fill(null)
    .map(() => Array(8).fill(null));

  const backRow: ChessPiece['type'][] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];

  // Initialize Black (Player 2)
  for (let c = 0; c < 8; c++) {
    board[0][c] = { type: backRow[c], player: 2 };
    board[1][c] = { type: 'pawn', player: 2 };
  }

  // Initialize White (Player 1)
  for (let c = 0; c < 8; c++) {
    board[6][c] = { type: 'pawn', player: 1 };
    board[7][c] = { type: backRow[c], player: 1 };
  }

  return {
    board,
    currentPlayer: 1,
    winner: null
  };
}

export interface ChessMove {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
}

// Find position of player's King
function findKing(board: (ChessPiece | null)[][], player: 1 | 2): { r: number; c: number } | null {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.type === 'king' && piece.player === player) {
        return { r, c };
      }
    }
  }
  return null;
}

// Checks if the player's King is threatened under the given board state
export function isKingInCheck(board: (ChessPiece | null)[][], player: 1 | 2): boolean {
  const kingPos = findKing(board, player);
  if (!kingPos) return false;

  const opponent = player === 1 ? 2 : 1;

  // We check if any opponent piece has a pseudo-legal move to the king's position
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.player === opponent) {
        const moves = getPseudoLegalMoves(board, r, c);
        const canCaptureKing = moves.some(m => m.toRow === kingPos.r && m.toCol === kingPos.c);
        if (canCaptureKing) return true;
      }
    }
  }

  return false;
}

// Pseudo-legal moves (not checking if king becomes checked)
export function getPseudoLegalMoves(board: (ChessPiece | null)[][], r: number, c: number): ChessMove[] {
  const piece = board[r][c];
  if (!piece) return [];

  const moves: ChessMove[] = [];
  const player = piece.player;
  const opponent = player === 1 ? 2 : 1;

  const addMoveIfValid = (tr: number, tc: number): boolean => {
    if (tr < 0 || tr >= 8 || tc < 0 || tc >= 8) return false;
    const target = board[tr][tc];
    if (!target) {
      moves.push({ fromRow: r, fromCol: c, toRow: tr, toCol: tc });
      return true; // square is empty, can continue for sliding pieces
    } else {
      if (target.player === opponent) {
        moves.push({ fromRow: r, fromCol: c, toRow: tr, toCol: tc });
      }
      return false; // occupied, stop sliding
    }
  };

  switch (piece.type) {
    case 'pawn': {
      const dir = player === 1 ? -1 : 1;
      const startRow = player === 1 ? 6 : 1;

      // Single step forward
      const f1 = r + dir;
      if (f1 >= 0 && f1 < 8 && !board[f1][c]) {
        moves.push({ fromRow: r, fromCol: c, toRow: f1, toCol: c });
        // Double step forward
        const f2 = r + dir * 2;
        if (r === startRow && !board[f2][c]) {
          moves.push({ fromRow: r, fromCol: c, toRow: f2, toCol: c });
        }
      }

      // Diagonal captures
      for (const dc of [-1, 1]) {
        const tr = r + dir;
        const tc = c + dc;
        if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
          const target = board[tr][tc];
          if (target && target.player === opponent) {
            moves.push({ fromRow: r, fromCol: c, toRow: tr, toCol: tc });
          }
        }
      }
      break;
    }

    case 'knight': {
      const offsets = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1]
      ];
      for (const [dr, dc] of offsets) {
        const tr = r + dr;
        const tc = c + dc;
        if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
          const target = board[tr][tc];
          if (!target || target.player === opponent) {
            moves.push({ fromRow: r, fromCol: c, toRow: tr, toCol: tc });
          }
        }
      }
      break;
    }

    case 'bishop': {
      const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
      for (const [dr, dc] of dirs) {
        let step = 1;
        while (true) {
          const tr = r + dr * step;
          const tc = c + dc * step;
          if (!addMoveIfValid(tr, tc)) break;
          step++;
        }
      }
      break;
    }

    case 'rook': {
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of dirs) {
        let step = 1;
        while (true) {
          const tr = r + dr * step;
          const tc = c + dc * step;
          if (!addMoveIfValid(tr, tc)) break;
          step++;
        }
      }
      break;
    }

    case 'queen': {
      const dirs = [
        [-1, -1], [-1, 1], [1, -1], [1, 1],
        [-1, 0], [1, 0], [0, -1], [0, 1]
      ];
      for (const [dr, dc] of dirs) {
        let step = 1;
        while (true) {
          const tr = r + dr * step;
          const tc = c + dc * step;
          if (!addMoveIfValid(tr, tc)) break;
          step++;
        }
      }
      break;
    }

    case 'king': {
      const dirs = [
        [-1, -1], [-1, 1], [1, -1], [1, 1],
        [-1, 0], [1, 0], [0, -1], [0, 1]
      ];
      for (const [dr, dc] of dirs) {
        const tr = r + dr;
        const tc = c + dc;
        if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
          const target = board[tr][tc];
          if (!target || target.player === opponent) {
            moves.push({ fromRow: r, fromCol: c, toRow: tr, toCol: tc });
          }
        }
      }
      break;
    }
  }

  return moves;
}

// Full legal moves validation (cloning board and checking if king stays safe)
export function getLegalMoves(state: ChessState, r: number, c: number): ChessMove[] {
  const piece = state.board[r][c];
  if (!piece || piece.player !== state.currentPlayer) return [];

  const pseudo = getPseudoLegalMoves(state.board, r, c);
  const legal: ChessMove[] = [];

  for (const m of pseudo) {
    // Clone board
    const tempBoard = state.board.map(row => [...row]);
    // Simulate move
    tempBoard[m.toRow][m.toCol] = tempBoard[m.fromRow][m.fromCol];
    tempBoard[m.fromRow][m.fromCol] = null;

    if (!isKingInCheck(tempBoard, state.currentPlayer)) {
      legal.push(m);
    }
  }

  return legal;
}

export function makeChessMove(
  state: ChessState,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  playerNum: 1 | 2
): boolean {
  if (state.winner !== null) return false;
  if (state.currentPlayer !== playerNum) return false;

  const piece = state.board[fromRow][fromCol];
  if (!piece || piece.player !== playerNum) return false;

  const legal = getLegalMoves(state, fromRow, fromCol);
  const matched = legal.find(m => m.toRow === toRow && m.toCol === toCol);
  if (!matched) return false;

  // Execute move
  const targetPiece = state.board[toRow][toCol];
  state.board[toRow][toCol] = piece;
  state.board[fromRow][fromCol] = null;

  // Pawn Promotion (Auto-promote to Queen for simplification)
  if (piece.type === 'pawn') {
    if ((playerNum === 1 && toRow === 0) || (playerNum === 2 && toRow === 7)) {
      piece.type = 'queen';
    }
  }

  // Switch player
  state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;

  // Check checkmate / draw
  // Does next player have any legal moves?
  let hasAnyMoves = false;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (p && p.player === state.currentPlayer) {
        if (getLegalMoves(state, r, c).length > 0) {
          hasAnyMoves = true;
          break;
        }
      }
    }
    if (hasAnyMoves) break;
  }

  if (!hasAnyMoves) {
    if (isKingInCheck(state.board, state.currentPlayer)) {
      // Checkmate! The player who just moved (opponent of current) wins.
      state.winner = state.currentPlayer === 1 ? 2 : 1;
    } else {
      // Stalemate / Draw
      state.winner = 'draw';
    }
  }

  return true;
}
