export interface ChatMessage {
  id: string;
  username: string;
  text: string;
  timestamp: number;
  roomId?: string;
}

export interface PrivateMessage {
  id: string;
  sender: string;
  recipient: string;
  text: string;
  timestamp: number;
}

export interface Player {
  id: string;
  username: string;
  disconnected?: boolean;
}

export interface RoomListEntry {
  id: string;
  gameType: 'connect4' | 'battleship' | 'tictactoe' | 'checkers' | 'chess' | 'gomoku' | 'othello' | 'pong' | 'pendu' | 'dominos';
  playersCount: number;
  status: 'waiting' | 'playing' | 'finished';
}

// Battleship Specific Interfaces
export interface BattleshipShip {
  id: string;
  size: number;
  placed: boolean;
  row: number;
  col: number;
  horizontal: boolean;
}

export interface BattleshipPlayerState {
  ready: boolean;
  board: ('empty' | 'ship' | 'hit' | 'miss')[][];
  ships: BattleshipShip[];
}

export interface BattleshipGameState {
  phase: 'setup' | 'playing' | 'finished';
  winnerId: string | null;
  currentPlayerId: string;
  players: {
    [playerId: string]: BattleshipPlayerState;
  };
}

export interface Room<T = any> {
  id: string;
  gameType: 'connect4' | 'battleship' | 'tictactoe' | 'checkers' | 'chess' | 'gomoku' | 'othello' | 'pong' | 'pendu' | 'dominos';
  players: Player[];
  status: 'waiting' | 'playing' | 'finished';
  gameState: T;
  chatMessages: ChatMessage[];
  rematchVotes?: string[];
  isLocal?: boolean;
}

export interface DominosGameState {
  board: [number, number][];
  handP1: [number, number][];
  handP2: [number, number][];
  boneyard: [number, number][];
  currentPlayer: number;
  winner: number | 'draw' | null;
  winnerReason?: string;
  lastMove: {
    player: number;
    domino: [number, number];
    side: 'left' | 'right';
  } | null;
}
