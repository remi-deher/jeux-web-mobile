/**
 * Blackjack — 2 joueurs vs dealer (serveur)
 * Dealer suit les règles casino : hit ≤ 16, stand ≥ 17.
 * Mise simultanée au début de chaque manche. 10 manches max.
 * Chips de départ : 1000. Mise min 10, max 500.
 */

export type BjSuit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type BjRank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface BjCard {
  suit:     BjSuit;
  rank:     BjRank;
  faceDown: boolean;
}

export interface BjHand {
  cards:    BjCard[];
  bust:     boolean;
  blackjack: boolean;
}

export type BjPhase = 'betting' | 'p1turn' | 'p2turn' | 'dealerturn' | 'payout';

export interface BjPlayerState {
  hand:       BjHand;
  bet:        number;
  chips:      number;
  betPlaced:  boolean;
  standing:   boolean;
  doubled:    boolean;
  result:     'win' | 'lose' | 'push' | null;
}

export interface BlackjackState {
  phase:        BjPhase;
  dealer:       BjHand;
  p1:           BjPlayerState;
  p2:           BjPlayerState;
  round:        number;
  maxRounds:    number;
  winner:       number | null; // game winner (not round winner)
  playerIds:    [string, string];
}

// ── Card helpers ──────────────────────────────────────────────────────────────

const SUITS: BjSuit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: BjRank[] = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

function buildDeck(): BjCard[] {
  const cards: BjCard[] = [];
  for (const suit of SUITS)
    for (const rank of RANKS)
      cards.push({ suit, rank, faceDown: false });
  return cards;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function cardValue(rank: BjRank): number {
  if (rank === 'A')  return 11;
  if (['J','Q','K'].includes(rank)) return 10;
  return parseInt(rank);
}

export function handScore(hand: BjHand): number {
  let score = 0;
  let aces  = 0;
  for (const c of hand.cards) {
    if (c.faceDown) continue;
    score += cardValue(c.rank);
    if (c.rank === 'A') aces++;
  }
  while (score > 21 && aces > 0) { score -= 10; aces--; }
  return score;
}

function emptyHand(): BjHand { return { cards: [], bust: false, blackjack: false }; }

function emptyPlayer(chips: number): BjPlayerState {
  return { hand: emptyHand(), bet: 0, chips, betPlaced: false, standing: false, doubled: false, result: null };
}

// ── State creation ─────────────────────────────────────────────────────────────

export function createInitialBlackjackState(playerIds: [string, string]): BlackjackState {
  const state: BlackjackState = {
    phase: 'betting',
    dealer: emptyHand(),
    p1: emptyPlayer(1000),
    p2: emptyPlayer(1000),
    round: 1,
    maxRounds: 10,
    winner: null,
    playerIds,
  };
  (state as any)._deck = shuffle(buildDeck());
  return state;
}

function getDeck(state: BlackjackState): BjCard[] { return (state as any)._deck; }

function draw(state: BlackjackState, faceDown = false): BjCard {
  const deck = getDeck(state);
  if (deck.length < 15) {
    // Reshuffle
    (state as any)._deck = shuffle(buildDeck());
  }
  const card = deck.pop()!;
  card.faceDown = faceDown;
  return card;
}

function updateHand(hand: BjHand): void {
  const score = handScore(hand);
  hand.bust      = score > 21;
  hand.blackjack = hand.cards.length === 2 && score === 21;
}

// ── Deal ──────────────────────────────────────────────────────────────────────

function dealRound(state: BlackjackState): void {
  state.dealer = emptyHand();
  state.p1.hand = emptyHand();
  state.p2.hand = emptyHand();
  state.p1.standing = false;
  state.p2.standing = false;
  state.p1.result   = null;
  state.p2.result   = null;

  // Deal 2 cards each (dealer's second card face down)
  state.p1.hand.cards.push(draw(state), draw(state));
  state.p2.hand.cards.push(draw(state), draw(state));
  state.dealer.cards.push(draw(state), draw(state, true)); // second face down

  updateHand(state.p1.hand);
  updateHand(state.p2.hand);
  updateHand(state.dealer);

  state.phase = 'p1turn';
}

// ── Actions ───────────────────────────────────────────────────────────────────

export function placeBet(state: BlackjackState, playerIndex: 0 | 1, amount: number): boolean {
  if (state.phase !== 'betting') return false;
  const ps = playerIndex === 0 ? state.p1 : state.p2;
  if (ps.betPlaced) return false;
  if (amount < 10 || amount > 500 || amount > ps.chips) return false;

  ps.bet       = amount;
  ps.betPlaced = true;

  if (state.p1.betPlaced && state.p2.betPlaced) {
    dealRound(state);
  }
  return true;
}

export function bjHit(state: BlackjackState, playerIndex: 0 | 1): boolean {
  const ps    = playerIndex === 0 ? state.p1 : state.p2;
  const phase = playerIndex === 0 ? 'p1turn' : 'p2turn';
  if (state.phase !== phase || ps.standing || ps.hand.bust) return false;

  ps.hand.cards.push(draw(state));
  updateHand(ps.hand);

  if (ps.hand.bust) advanceTurn(state, playerIndex);
  return true;
}

export function bjStand(state: BlackjackState, playerIndex: 0 | 1): boolean {
  const ps    = playerIndex === 0 ? state.p1 : state.p2;
  const phase = playerIndex === 0 ? 'p1turn' : 'p2turn';
  if (state.phase !== phase) return false;

  ps.standing = true;
  advanceTurn(state, playerIndex);
  return true;
}

export function bjDouble(state: BlackjackState, playerIndex: 0 | 1): boolean {
  const ps    = playerIndex === 0 ? state.p1 : state.p2;
  const phase = playerIndex === 0 ? 'p1turn' : 'p2turn';
  if (state.phase !== phase || ps.hand.cards.length !== 2) return false;
  if (ps.chips < ps.bet * 2) return false;

  ps.bet     *= 2;
  ps.doubled  = true;
  ps.hand.cards.push(draw(state));
  updateHand(ps.hand);
  ps.standing = true;
  advanceTurn(state, playerIndex);
  return true;
}

function advanceTurn(state: BlackjackState, playerIndex: 0 | 1): void {
  if (playerIndex === 0) {
    state.phase = 'p2turn';
  } else {
    runDealer(state);
  }
}

function runDealer(state: BlackjackState): void {
  state.phase = 'dealerturn';

  // Reveal face-down card
  state.dealer.cards.forEach(c => c.faceDown = false);
  updateHand(state.dealer);

  // Dealer hits on ≤ 16
  while (!state.dealer.bust && handScore(state.dealer) < 17) {
    state.dealer.cards.push(draw(state));
    updateHand(state.dealer);
  }

  payout(state);
}

function payout(state: BlackjackState): void {
  state.phase = 'payout';
  const dScore = handScore(state.dealer);

  const resolve = (ps: BjPlayerState) => {
    const pScore = handScore(ps.hand);

    if (ps.hand.bust) {
      ps.result = 'lose';
      ps.chips -= ps.bet;
    } else if (state.dealer.bust) {
      ps.result = 'win';
      ps.chips += ps.bet;
    } else if (pScore > dScore) {
      ps.result = 'win';
      ps.chips += ps.hand.blackjack ? Math.floor(ps.bet * 1.5) : ps.bet;
    } else if (pScore < dScore) {
      ps.result = 'lose';
      ps.chips -= ps.bet;
    } else {
      ps.result = 'push'; // tie = push = no change
    }

    // Floor chips at 0
    if (ps.chips < 0) ps.chips = 0;
  };

  resolve(state.p1);
  resolve(state.p2);

  // Check game end
  if (state.round >= state.maxRounds || state.p1.chips < 10 || state.p2.chips < 10) {
    if (state.p1.chips > state.p2.chips) state.winner = 1;
    else if (state.p2.chips > state.p1.chips) state.winner = 2;
    else state.winner = 0;
  }
}

/** Appelé par le client pour démarrer la manche suivante (depuis payout) */
export function nextRound(state: BlackjackState): boolean {
  if (state.phase !== 'payout' || state.winner !== null) return false;
  state.round++;
  state.p1.betPlaced = false;
  state.p2.betPlaced = false;
  state.p1.bet       = 0;
  state.p2.bet       = 0;
  state.p1.doubled   = false;
  state.p2.doubled   = false;
  state.phase        = 'betting';
  return true;
}
