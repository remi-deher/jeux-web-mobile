export interface CheckersPiece {
  type: 'pawn' | 'king';
  player: 1 | 2; // 1 = White/Light (moves up), 2 = Black/Dark (moves down)
}

export interface CheckersState {
  board: (CheckersPiece | null)[][]; // 8x8 board
  currentPlayer: 1 | 2;
  winner: 1 | 2 | 'draw' | null;
}

export function createInitialCheckersState(): CheckersState {
  const board: (CheckersPiece | null)[][] = Array(8)
    .fill(null)
    .map(() => Array(8).fill(null));

  // Initialize Player 2 (Black) on top rows 0, 1, 2
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) {
        board[r][c] = { type: 'pawn', player: 2 };
      }
    }
  }

  // Initialize Player 1 (White) on bottom rows 5, 6, 7
  for (let r = 5; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) {
        board[r][c] = { type: 'pawn', player: 1 };
      }
    }
  }

  return {
    board,
    currentPlayer: 1,
    winner: null
  };
}

export interface CheckerMove {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  isJump: boolean;
  jumpedPiece?: { r: number; c: number };
}

// Calculate all legal moves for a player. If any jumps are available, only jumps are legal (standard rules).
export function getLegalMovesForPlayer(state: CheckersState, player: 1 | 2): CheckerMove[] {
  const moves: CheckerMove[] = [];
  const jumps: CheckerMove[] = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = state.board[r][c];
      if (piece && piece.player === player) {
        const pieceMoves = getPieceMoves(state, r, c);
        for (const m of pieceMoves) {
          if (m.isJump) {
            jumps.push(m);
          } else {
            moves.push(m);
          }
        }
      }
    }
  }

  // Mandatory capture rule
  return jumps.length > 0 ? jumps : moves;
}

export function getPieceMoves(state: CheckersState, r: number, c: number): CheckerMove[] {
  const piece = state.board[r][c];
  if (!piece) return [];

  const moves: CheckerMove[] = [];
  const player = piece.player;
  const isKing = piece.type === 'king';

  // Directions
  // Player 1 pawns move up (-1), Player 2 pawns move down (+1). Kings move both directions.
  const rowDirs = isKing ? [-1, 1] : (player === 1 ? [-1] : [1]);
  const colDirs = [-1, 1];

  for (const rd of rowDirs) {
    for (const cd of colDirs) {
      // 1. Simple move (1 step)
      const nextR = r + rd;
      const nextC = c + cd;
      if (nextR >= 0 && nextR < 8 && nextC >= 0 && nextC < 8) {
        if (!state.board[nextR][nextC]) {
          moves.push({
            fromRow: r,
            fromCol: c,
            toRow: nextR,
            toCol: nextC,
            isJump: false
          });
        }
      }

      // 2. Jump move (2 steps)
      const jumpR = r + rd * 2;
      const jumpC = c + cd * 2;
      const midR = r + rd;
      const midC = c + cd;

      if (jumpR >= 0 && jumpR < 8 && jumpC >= 0 && jumpC < 8) {
        const midPiece = state.board[midR][midC];
        const targetCell = state.board[jumpR][jumpC];
        if (midPiece && midPiece.player !== player && !targetCell) {
          moves.push({
            fromRow: r,
            fromCol: c,
            toRow: jumpR,
            toCol: jumpC,
            isJump: true,
            jumpedPiece: { r: midR, c: midC }
          });
        }
      }
    }
  }

  return moves;
}

export function makeCheckersMove(
  state: CheckersState,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  playerNum: 1 | 2
): boolean {
  if (state.winner !== null) return false;
  if (state.currentPlayer !== playerNum) return false;

  const legalMoves = getLegalMovesForPlayer(state, playerNum);
  const matchedMove = legalMoves.find(
    m => m.fromRow === fromRow && m.fromCol === fromCol && m.toRow === toRow && m.toCol === toCol
  );

  if (!matchedMove) return false;

  // Execute move
  const piece = state.board[fromRow][fromCol];
  if (!piece) return false;

  state.board[toRow][toCol] = piece;
  state.board[fromRow][fromCol] = null;

  // If jump, remove the captured piece
  if (matchedMove.isJump && matchedMove.jumpedPiece) {
    state.board[matchedMove.jumpedPiece.r][matchedMove.jumpedPiece.c] = null;
  }

  // Promotion to King
  if (playerNum === 1 && toRow === 0) {
    piece.type = 'king';
  } else if (playerNum === 2 && toRow === 7) {
    piece.type = 'king';
  }

  // Check if player has more double jumps available (only if they just jumped)
  // To keep rules friendly and simple, if standard double-jump calculations get complex,
  // we check if the piece that just moved has *any* jump move available.
  let hasMoreJumps = false;
  if (matchedMove.isJump) {
    const nextPieceMoves = getPieceMoves(state, toRow, toCol);
    const pieceJumps = nextPieceMoves.filter(m => m.isJump);
    if (pieceJumps.length > 0) {
      hasMoreJumps = true;
    }
  }

  if (hasMoreJumps) {
    // Current player keeps turn to complete double/triple jump
    // We restrict moves for this player to only jumps from this specific piece (handled client/server side)
    // For simplicity, we just keep state.currentPlayer. The client should highlight only the double jump targets.
  } else {
    // Switch turn
    state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
  }

  // Check victory / draw conditions
  // A player wins if the opponent has no pieces left or no legal moves left
  const nextPlayerMoves = getLegalMovesForPlayer(state, state.currentPlayer);
  if (nextPlayerMoves.length === 0) {
    // Current player has no moves left -> opponent wins!
    state.winner = state.currentPlayer === 1 ? 2 : 1;
  }

  return true;
}
