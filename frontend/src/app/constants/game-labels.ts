/**
 * Single source of truth for game type → display name mapping.
 * Used in app.ts, game.service.ts, lobby.component.ts.
 */
export const GAME_LABELS: Record<string, string> = {
  connect4:   'Puissance 4',
  battleship: 'Bataille Navale',
  tictactoe:  'Morpion',
  checkers:   'Jeu de Dames',
  chess:      'Échecs',
  gomoku:     'Gomoku',
  othello:    'Othello',
  pong:       'Pong',
  pendu:      'Le Pendu',
  dominos:    'Dominos',
  snake:      'Snake vs',
};

export function gameLabel(gameType: string): string {
  return GAME_LABELS[gameType] ?? gameType;
}
