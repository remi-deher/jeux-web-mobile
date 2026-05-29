/**
 * Memory — jeu de paires (4×4 = 8 paires)
 * Tour par tour. Trouver une paire = rejouer. Mismatch = cartes retournées après 1.5 s.
 */

export interface MemoryCard {
  id:      number;
  pairId:  number;
  faceUp:  boolean;
  matched: boolean;
}

export interface MemoryState {
  cards:         MemoryCard[];
  cols:          number;
  rows:          number;
  currentPlayer: 1 | 2;
  scores:        [number, number];
  flippedIds:    number[];    // ids des cartes retournées non-matchées (0, 1 ou 2)
  isResolving:   boolean;     // attente avant de retourner face cachée
  totalPairs:    number;
  matchedPairs:  number;
  winner:        number | null; // 1, 2, 0(draw), null
  playerIds:     [string, string];
}

const COLS = 4;
const ROWS = 4;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createInitialMemoryState(playerIds: [string, string]): MemoryState {
  const totalPairs = (COLS * ROWS) / 2;
  const pairArray: number[] = [];
  for (let i = 0; i < totalPairs; i++) pairArray.push(i, i);

  const cards: MemoryCard[] = shuffle(pairArray).map((pairId, id) => ({
    id, pairId, faceUp: false, matched: false,
  }));

  return {
    cards, cols: COLS, rows: ROWS,
    currentPlayer: 1,
    scores: [0, 0],
    flippedIds: [],
    isResolving: false,
    totalPairs, matchedPairs: 0,
    winner: null,
    playerIds,
  };
}

/** Retourne 'match' | 'mismatch' | 'flipped' | 'ignored' */
export function flipCard(
  state:    MemoryState,
  cardId:   number,
): 'match' | 'mismatch' | 'flipped' | 'ignored' {
  if (state.isResolving || state.winner !== null) return 'ignored';
  if (state.flippedIds.length >= 2) return 'ignored';

  const card = state.cards.find(c => c.id === cardId);
  if (!card || card.faceUp || card.matched) return 'ignored';

  card.faceUp = true;
  state.flippedIds.push(cardId);

  if (state.flippedIds.length < 2) return 'flipped';

  const [id1, id2] = state.flippedIds;
  const c1 = state.cards.find(c => c.id === id1)!;
  const c2 = state.cards.find(c => c.id === id2)!;

  if (c1.pairId === c2.pairId) {
    c1.matched = c2.matched = true;
    state.flippedIds = [];
    state.matchedPairs++;
    state.scores[state.currentPlayer - 1]++;
    // Joueur qui trouve une paire rejoue

    if (state.matchedPairs === state.totalPairs) {
      const [s1, s2] = state.scores;
      state.winner = s1 > s2 ? 1 : s2 > s1 ? 2 : 0;
    }
    return 'match';
  } else {
    state.isResolving = true;
    return 'mismatch';
  }
}

/** Appelé après le délai de 1.5 s pour retourner les cartes et changer de joueur */
export function resolveFlip(state: MemoryState): void {
  state.flippedIds.forEach(id => {
    const c = state.cards.find(c => c.id === id);
    if (c) c.faceUp = false;
  });
  state.flippedIds    = [];
  state.isResolving   = false;
  state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
}
