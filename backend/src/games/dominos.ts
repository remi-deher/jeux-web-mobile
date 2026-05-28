export interface DominosState {
  board: [number, number][]; // chain of dominos played on the board
  handP1: [number, number][]; // Player 1 hand
  handP2: [number, number][]; // Player 2 hand
  boneyard: [number, number][]; // draw pile
  currentPlayer: number; // 1 or 2
  winner: number | 'draw' | null;
  winnerReason?: string;
  lastMove: {
    player: number;
    domino: [number, number];
    side: 'left' | 'right';
  } | null;
}

export function createInitialDominosState(): DominosState {
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
  const boneyard = deck; // 14 cards left in boneyard

  return {
    board: [],
    handP1,
    handP2,
    boneyard,
    currentPlayer: 1, // Player 1 starts
    winner: null,
    lastMove: null
  };
}

export function hasValidMove(hand: [number, number][], board: [number, number][]): boolean {
  if (board.length === 0) return true;
  const leftEnd = board[0][0];
  const rightEnd = board[board.length - 1][1];
  return hand.some(([x, y]) => x === leftEnd || y === leftEnd || x === rightEnd || y === rightEnd);
}

export function makeDominosMove(state: DominosState, tileIndex: number, side: 'left' | 'right', playerNum: number): boolean {
  if (state.winner !== null) return false;
  if (state.currentPlayer !== playerNum) return false;

  const hand = playerNum === 1 ? state.handP1 : state.handP2;
  if (tileIndex < 0 || tileIndex >= hand.length) return false;

  const tile = hand[tileIndex];

  if (state.board.length === 0) {
    // Empty board: place domino directly
    state.board.push(tile);
    hand.splice(tileIndex, 1);
    state.lastMove = { player: playerNum, domino: tile, side: 'left' };
  } else if (side === 'left') {
    const leftEnd = state.board[0][0];
    if (tile[1] === leftEnd) {
      state.board.unshift(tile);
    } else if (tile[0] === leftEnd) {
      state.board.unshift([tile[1], tile[0]]);
    } else {
      return false; // Invalid move
    }
    hand.splice(tileIndex, 1);
    state.lastMove = { player: playerNum, domino: tile, side: 'left' };
  } else if (side === 'right') {
    const rightEnd = state.board[state.board.length - 1][1];
    if (tile[0] === rightEnd) {
      state.board.push(tile);
    } else if (tile[1] === rightEnd) {
      state.board.push([tile[1], tile[0]]);
    } else {
      return false; // Invalid move
    }
    hand.splice(tileIndex, 1);
    state.lastMove = { player: playerNum, domino: tile, side: 'right' };
  } else {
    return false;
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
    // Switch turn
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
  if (hasValidMove(hand, state.board)) return false;

  const tile = state.boneyard.pop();
  if (tile) {
    hand.push(tile);
    
    // Check blocked state in case the tile cannot resolve block
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
  if (hasValidMove(hand, state.board) || state.boneyard.length > 0) return false;

  // Toggle turn
  state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
  
  // Check if both players are now blocked
  checkBlockedState(state);

  return true;
}

function checkBlockedState(state: DominosState) {
  // If boneyard is not empty, it cannot be blocked since players can draw
  if (state.boneyard.length > 0) return;

  const canP1Move = hasValidMove(state.handP1, state.board);
  const canP2Move = hasValidMove(state.handP2, state.board);

  if (!canP1Move && !canP2Move) {
    // Game is blocked! Compare hand points
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
