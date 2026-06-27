import { describe, it, expect, beforeEach } from 'vitest';
import {
  TicTacToeState,
  createInitialTicTacToeState,
  makeTicTacToeMove,
} from '../tictactoe';

describe('TicTacToe', () => {
  let state: TicTacToeState;

  beforeEach(() => {
    state = createInitialTicTacToeState();
  });

  // ── État initial ─────────────────────────────────────────────────────────────

  describe('createInitialTicTacToeState', () => {
    it('crée un plateau de 9 cellules nulles', () => {
      expect(state.board).toHaveLength(9);
      state.board.forEach(cell => expect(cell).toBeNull());
    });

    it("commence avec X", () => {
      expect(state.currentPlayer).toBe('X');
    });

    it("n'a pas de gagnant ni de ligne gagnante", () => {
      expect(state.winner).toBeNull();
      expect(state.winningLine).toEqual([]);
    });
  });

  // ── Coups invalides ──────────────────────────────────────────────────────────

  describe('makeTicTacToeMove — invalide', () => {
    it('refuse un index hors-limites (< 0)', () => {
      expect(makeTicTacToeMove(state, -1, 'X')).toBe(false);
    });

    it('refuse un index hors-limites (>= 9)', () => {
      expect(makeTicTacToeMove(state, 9, 'X')).toBe(false);
    });

    it("refuse si ce n'est pas le tour du joueur", () => {
      expect(makeTicTacToeMove(state, 0, 'O')).toBe(false);
    });

    it('refuse si la case est déjà occupée', () => {
      makeTicTacToeMove(state, 4, 'X');
      expect(makeTicTacToeMove(state, 4, 'O')).toBe(false);
    });

    it('refuse un coup après victoire', () => {
      // X gagne ligne du haut
      makeTicTacToeMove(state, 0, 'X'); // X
      makeTicTacToeMove(state, 3, 'O'); // O
      makeTicTacToeMove(state, 1, 'X'); // X
      makeTicTacToeMove(state, 4, 'O'); // O
      makeTicTacToeMove(state, 2, 'X'); // X gagne
      expect(state.winner).toBe('X');
      expect(makeTicTacToeMove(state, 5, 'O')).toBe(false);
    });
  });

  // ── Toutes les lignes gagnantes ──────────────────────────────────────────────

  const WIN_LINES = [
    { name: 'ligne 1 (0,1,2)', moves: [0, 1, 2] },
    { name: 'ligne 2 (3,4,5)', moves: [3, 4, 5] },
    { name: 'ligne 3 (6,7,8)', moves: [6, 7, 8] },
    { name: 'colonne 1 (0,3,6)', moves: [0, 3, 6] },
    { name: 'colonne 2 (1,4,7)', moves: [1, 4, 7] },
    { name: 'colonne 3 (2,5,8)', moves: [2, 5, 8] },
    { name: 'diagonale (0,4,8)', moves: [0, 4, 8] },
    { name: 'anti-diagonale (2,4,6)', moves: [2, 4, 6] },
  ];

  describe('détection de victoire', () => {
    WIN_LINES.forEach(({ name, moves }) => {
      it(`X gagne par ${name}`, () => {
        // O joue dans des cases hors de la ligne gagnante de X
        const oMoves = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(i => !moves.includes(i));
        for (let i = 0; i < moves.length; i++) {
          const s = createInitialTicTacToeState();
          // Reconstruire un état propre pour chaque ligne
          // Jouer X sur moves[0..i], O sur oMoves entre les deux
          const fresh = createInitialTicTacToeState();
          for (let j = 0; j < moves.length; j++) {
            makeTicTacToeMove(fresh, moves[j], 'X');
            if (j < moves.length - 1) {
              makeTicTacToeMove(fresh, oMoves[j], 'O');
            }
          }
          expect(fresh.winner).toBe('X');
          expect(fresh.winningLine).toEqual(moves);
        }
      });
    });
  });

  // ── Match nul ────────────────────────────────────────────────────────────────

  describe('match nul', () => {
    it("détecte un nul quand le plateau est plein sans gagnant", () => {
      /*
       * Séquence sans victoire :
       * X O X
       * X X O
       * O X O
       * → X:0,2,3,4,7  O:1,5,6,8
       */
      const moves: Array<[number, 'X' | 'O']> = [
        [0, 'X'], [1, 'O'], [2, 'X'],
        [4, 'X'], [3, 'O'], [5, 'X'], // attention : le 3ième coup de X ne crée pas 3 d'affilée
        [7, 'O'], [6, 'X'], [8, 'O'],
      ];
      // Recalculer une séquence valide sans victoire intermédiaire
      const s = createInitialTicTacToeState();
      // X O X | O X O | X O X → pas de gagnant
      const seq: Array<[number, 'X' | 'O']> = [
        [0, 'X'], [1, 'O'], [2, 'X'],
        [4, 'O'], [3, 'X'], [5, 'O'],
        [7, 'X'], [6, 'O'], [8, 'X'],
      ];
      for (const [idx, player] of seq) {
        makeTicTacToeMove(s, idx, player);
      }
      expect(s.winner).toBe('draw');
    });
  });
});
