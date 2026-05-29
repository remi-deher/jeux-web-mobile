/**
 * Shared type definitions — used by both backend and frontend.
 *
 * IMPORTANT: this file must contain ONLY TypeScript types/interfaces/enums.
 * No runtime values (no const, no class, no function) — so that
 * `import type { … }` from either side produces zero JS output.
 */

// ── Core union types ──────────────────────────────────────────────────────────

export type GameType =
  | 'connect4'
  | 'battleship'
  | 'tictactoe'
  | 'checkers'
  | 'chess'
  | 'gomoku'
  | 'othello'
  | 'pong'
  | 'pendu'
  | 'dominos'
  | 'snake'
  | 'tetris'
  | 'memory'
  | 'uno'
  | 'blackjack';

export type GameVariant = 'classic' | 'branches' | 'grid';

export type RoomStatus = 'waiting' | 'playing' | 'finished';

// ── Player ────────────────────────────────────────────────────────────────────

export interface SharedPlayer {
  id:            string;
  username:      string;
  disconnected?: boolean;
}

// ── Room (minimal shared shape) ───────────────────────────────────────────────

export interface SharedRoom<TState = unknown> {
  id:            string;
  gameType:      GameType;
  players:       SharedPlayer[];
  status:        RoomStatus;
  gameState:     TState;
  rematchVotes?: string[];
  isLocal?:      boolean;
  isPrivate?:    boolean;
  variant?:      GameVariant;
}

export interface SharedRoomListEntry {
  id:           string;
  gameType:     GameType;
  playersCount: number;
  status:       RoomStatus;
  variant?:     GameVariant;
}
