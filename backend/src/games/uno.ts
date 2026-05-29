/**
 * 8 Américain / Uno — 2 joueurs
 * Deck 108 cartes standard. Pas de stacking +2/+4. Pas de challenge.
 * unoDraw : pioche carte(s) obligatoire + passe le tour.
 * unoPlay : joue une carte (+ chosenColor pour wild/wild4).
 */

export type UnoColor = 'red' | 'blue' | 'green' | 'yellow' | 'wild';
export type UnoValue =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4';

export interface UnoCard {
  id:    number;
  color: UnoColor;
  value: UnoValue;
}

export interface UnoState {
  deckSize:      number;          // taille de la pioche (on n'expose pas les cartes)
  discardTop:    UnoCard | null;  // carte visible sur la défausse
  hands:         [UnoCard[], UnoCard[]]; // mains des joueurs
  currentPlayer: 1 | 2;
  currentColor:  UnoColor;       // couleur active (peut différer de la carte si wild)
  drawPending:   number;         // cartes que le joueur courant doit piocher avant de jouer
  winner:        number | null;
  playerIds:     [string, string];
  lastAction:    string | null;  // description de la dernière action (pour animation client)
}

// ── Deck ──────────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(): UnoCard[] {
  const cards: UnoCard[] = [];
  let id = 0;
  const colors: UnoColor[] = ['red', 'blue', 'green', 'yellow'];

  for (const color of colors) {
    cards.push({ id: id++, color, value: '0' });
    for (const v of ['1','2','3','4','5','6','7','8','9','skip','reverse','draw2'] as UnoValue[]) {
      cards.push({ id: id++, color, value: v });
      cards.push({ id: id++, color, value: v });
    }
  }
  for (let i = 0; i < 4; i++) {
    cards.push({ id: id++, color: 'wild', value: 'wild' });
    cards.push({ id: id++, color: 'wild', value: 'wild4' });
  }
  return shuffle(cards);
}

// ── State creation ─────────────────────────────────────────────────────────────

export function createInitialUnoState(playerIds: [string, string]): UnoState {
  const deck = buildDeck();

  const hand0: UnoCard[] = [];
  const hand1: UnoCard[] = [];
  for (let i = 0; i < 7; i++) {
    hand0.push(deck.pop()!);
    hand1.push(deck.pop()!);
  }

  // First discard card — skip wilds
  let top: UnoCard;
  do {
    top = deck.pop()!;
    if (top.value === 'wild' || top.value === 'wild4') deck.unshift(top);
    else break;
  } while (true);

  const state: UnoState = {
    deckSize:      deck.length,
    discardTop:    top,
    hands:         [hand0, hand1],
    currentPlayer: 1,
    currentColor:  top.color,
    drawPending:   0,
    winner:        null,
    playerIds,
    lastAction:    null,
  };

  // We'll store the actual deck in a closure-like way via a separate map in server.ts
  // But for simplicity, let's embed a hidden `_deck` field (not sent to clients)
  (state as any)._deck    = deck;
  (state as any)._discard = [top]; // full discard pile for reshuffling

  // Apply first card effect
  applyCardEffect(state, top, deck);

  return state;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDeck(state: UnoState): UnoCard[] { return (state as any)._deck as UnoCard[]; }
function getDiscard(state: UnoState): UnoCard[] { return (state as any)._discard as UnoCard[]; }

function drawFromDeck(state: UnoState, n: number): UnoCard[] {
  const deck = getDeck(state);
  const discard = getDiscard(state);
  const drawn: UnoCard[] = [];

  for (let i = 0; i < n; i++) {
    if (deck.length === 0) {
      // Reshuffle discard pile (keep top card)
      const top = discard.pop()!;
      const reshuffled = shuffle(discard.splice(0));
      deck.push(...reshuffled);
      discard.push(top);
    }
    if (deck.length > 0) drawn.push(deck.pop()!);
  }
  state.deckSize = deck.length;
  return drawn;
}

function canPlay(card: UnoCard, state: UnoState): boolean {
  if (state.drawPending > 0) return false; // must draw first
  if (card.value === 'wild' || card.value === 'wild4') return true;
  if (!state.discardTop) return true;
  if (card.color === state.currentColor) return true;
  if (card.value === state.discardTop.value) return true;
  return false;
}

function opponent(player: 1 | 2): 1 | 2 { return player === 1 ? 2 : 1; }

function applyCardEffect(state: UnoState, card: UnoCard, _deck: UnoCard[], chosenColor?: UnoColor): void {
  switch (card.value) {
    case 'skip':
    case 'reverse':
      // In 2P: skip = reverse = play again (don't switch turn)
      break;
    case 'draw2':
      state.currentPlayer = opponent(state.currentPlayer);
      state.drawPending   = 2;
      break;
    case 'wild':
      if (chosenColor) state.currentColor = chosenColor;
      state.currentPlayer = opponent(state.currentPlayer);
      break;
    case 'wild4':
      if (chosenColor) state.currentColor = chosenColor;
      state.currentPlayer = opponent(state.currentPlayer);
      state.drawPending   = 4;
      break;
    default:
      state.currentPlayer = opponent(state.currentPlayer);
  }
}

// ── Actions ───────────────────────────────────────────────────────────────────

export type UnoActionResult = 'ok' | 'invalid';

/** Jouer une carte depuis la main */
export function unoPlay(
  state:       UnoState,
  playerIndex: 0 | 1,
  cardId:      number,
  chosenColor: UnoColor | undefined,
): UnoActionResult {
  const playerNum: 1 | 2 = playerIndex === 0 ? 1 : 2;
  if (state.winner !== null) return 'invalid';
  if (state.currentPlayer !== playerNum) return 'invalid';
  if (state.drawPending > 0) return 'invalid';

  const hand = state.hands[playerIndex];
  const ci   = hand.findIndex(c => c.id === cardId);
  if (ci === -1) return 'invalid';
  const card = hand[ci];

  if (!canPlay(card, state)) return 'invalid';

  hand.splice(ci, 1);

  // Discard
  const discard = getDiscard(state);
  discard.push(card);
  state.discardTop   = card;
  if (card.value !== 'wild' && card.value !== 'wild4') {
    state.currentColor = card.color;
  }
  state.lastAction = `p${playerNum}:played:${card.color}:${card.value}`;

  // Win check
  if (hand.length === 0) {
    state.winner = playerNum;
    return 'ok';
  }

  applyCardEffect(state, card, getDeck(state), chosenColor);
  return 'ok';
}

/** Piocher (obligatoire si drawPending > 0, sinon 1 carte + passe tour) */
export function unoDraw(state: UnoState, playerIndex: 0 | 1): UnoActionResult {
  const playerNum: 1 | 2 = playerIndex === 0 ? 1 : 2;
  if (state.winner !== null) return 'invalid';
  if (state.currentPlayer !== playerNum) return 'invalid';

  const n = state.drawPending > 0 ? state.drawPending : 1;
  const drawn = drawFromDeck(state, n);
  state.hands[playerIndex].push(...drawn);
  state.drawPending   = 0;
  state.currentPlayer = opponent(state.currentPlayer);
  state.lastAction    = `p${playerNum}:drew:${n}`;
  return 'ok';
}
