import { describe, it, expect, beforeEach } from 'vitest';
import {
  BlackjackState,
  BjCard,
  createInitialBlackjackState,
  placeBet,
  bjHit,
  bjStand,
  bjDouble,
  nextRound,
  cardValue,
  handScore,
} from '../blackjack';

// Helpers ─────────────────────────────────────────────────────────────────────

function makeState(): BlackjackState {
  return createInitialBlackjackState(['p1', 'p2']);
}

function card(rank: BjCard['rank']): BjCard {
  return { suit: 'hearts', rank, faceDown: false };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('Blackjack', () => {

  // ── cardValue & handScore ──────────────────────────────────────────────────

  describe('cardValue', () => {
    it('A vaut 11', () => expect(cardValue('A')).toBe(11));
    it('J vaut 10', () => expect(cardValue('J')).toBe(10));
    it('Q vaut 10', () => expect(cardValue('Q')).toBe(10));
    it('K vaut 10', () => expect(cardValue('K')).toBe(10));
    it('7 vaut 7',  () => expect(cardValue('7')).toBe(7));
    it('10 vaut 10', () => expect(cardValue('10')).toBe(10));
  });

  describe('handScore', () => {
    it('A + K = 21 (blackjack)', () => {
      const hand = { cards: [card('A'), card('K')], bust: false, blackjack: false };
      expect(handScore(hand)).toBe(21);
    });

    it('A + K + 5 = 16 (A compte 1 pour éviter le bust)', () => {
      const hand = { cards: [card('A'), card('K'), card('5')], bust: false, blackjack: false };
      expect(handScore(hand)).toBe(16);
    });

    it('A + A = 12 (un As à 11, un à 1)', () => {
      const hand = { cards: [card('A'), card('A')], bust: false, blackjack: false };
      expect(handScore(hand)).toBe(12);
    });

    it('ignore les cartes face cachée', () => {
      const faceDown: BjCard = { suit: 'spades', rank: 'K', faceDown: true };
      const hand = { cards: [card('7'), faceDown], bust: false, blackjack: false };
      expect(handScore(hand)).toBe(7);
    });
  });

  // ── createInitialBlackjackState ────────────────────────────────────────────

  describe('createInitialBlackjackState', () => {
    it("commence en phase 'betting'", () => {
      expect(makeState().phase).toBe('betting');
    });

    it('donne 1000 chips à chaque joueur', () => {
      const s = makeState();
      expect(s.p1.chips).toBe(1000);
      expect(s.p2.chips).toBe(1000);
    });

    it("n'a pas de gagnant global", () => {
      expect(makeState().winner).toBeNull();
    });

    it('commence à la manche 1 / 10', () => {
      const s = makeState();
      expect(s.round).toBe(1);
      expect(s.maxRounds).toBe(10);
    });
  });

  // ── placeBet ───────────────────────────────────────────────────────────────

  describe('placeBet', () => {
    it('accepte une mise valide (10–500)', () => {
      const s = makeState();
      expect(placeBet(s, 0, 100)).toBe(true);
      expect(s.p1.bet).toBe(100);
      expect(s.p1.betPlaced).toBe(true);
    });

    it('refuse une mise inférieure à 10', () => {
      const s = makeState();
      expect(placeBet(s, 0, 5)).toBe(false);
    });

    it('refuse une mise supérieure à 500', () => {
      const s = makeState();
      expect(placeBet(s, 0, 501)).toBe(false);
    });

    it('refuse une mise supérieure aux chips du joueur', () => {
      const s = makeState();
      s.p1.chips = 50;
      expect(placeBet(s, 0, 100)).toBe(false);
    });

    it("refuse une double mise pour le même joueur", () => {
      const s = makeState();
      placeBet(s, 0, 100);
      expect(placeBet(s, 0, 50)).toBe(false);
    });

    it("passe en phase 'p1turn' quand les deux ont misé", () => {
      const s = makeState();
      placeBet(s, 0, 100);
      placeBet(s, 1, 100);
      expect(s.phase).toBe('p1turn');
    });

    it("refuse de miser en dehors de la phase 'betting'", () => {
      const s = makeState();
      placeBet(s, 0, 100);
      placeBet(s, 1, 100); // Phase → p1turn
      expect(placeBet(s, 0, 50)).toBe(false);
    });
  });

  // ── bjHit ─────────────────────────────────────────────────────────────────

  describe('bjHit', () => {
    function dealedState(): BlackjackState {
      const s = makeState();
      placeBet(s, 0, 50);
      placeBet(s, 1, 50);
      return s; // Phase : p1turn, les cartes ont été distribuées
    }

    it("ajoute une carte à la main du joueur actif", () => {
      const s = dealedState();
      const cardsBefore = s.p1.hand.cards.length;
      bjHit(s, 0);
      expect(s.p1.hand.cards.length).toBe(cardsBefore + 1);
    });

    it("refuse si c'est le tour de l'autre joueur", () => {
      const s = dealedState();
      expect(bjHit(s, 1)).toBe(false); // C'est le tour de P1
    });

    it('refuse si le joueur est déjà debout (standing)', () => {
      const s = dealedState();
      bjStand(s, 0); // P1 stands → phase p2turn
      expect(bjHit(s, 0)).toBe(false);
    });
  });

  // ── bjStand ────────────────────────────────────────────────────────────────

  describe('bjStand', () => {
    it("passe au tour de P2 quand P1 reste", () => {
      const s = makeState();
      placeBet(s, 0, 50);
      placeBet(s, 1, 50);
      bjStand(s, 0);
      expect(s.phase).toBe('p2turn');
    });

    it("passe en phase 'payout' quand P2 reste", () => {
      const s = makeState();
      placeBet(s, 0, 50);
      placeBet(s, 1, 50);
      bjStand(s, 0);
      bjStand(s, 1);
      // Après que P2 reste, le dealer joue → payout
      expect(s.phase).toBe('payout');
    });

    it("refuse si ce n'est pas le bon tour", () => {
      const s = makeState();
      placeBet(s, 0, 50);
      placeBet(s, 1, 50);
      expect(bjStand(s, 1)).toBe(false); // C'est le tour de P1, pas P2
    });
  });

  // ── bjDouble ───────────────────────────────────────────────────────────────

  describe('bjDouble', () => {
    it('double la mise et tire exactement une carte', () => {
      const s = makeState();
      placeBet(s, 0, 100);
      placeBet(s, 1, 100);
      // P1 a 2 cartes, peut doubler
      const betBefore = s.p1.bet;
      const cardsBefore = s.p1.hand.cards.length;
      bjDouble(s, 0);
      expect(s.p1.bet).toBe(betBefore * 2);
      expect(s.p1.hand.cards.length).toBe(cardsBefore + 1);
    });

    it('refuse si les chips sont insuffisants pour doubler', () => {
      const s = makeState();
      s.p1.chips = 50;
      placeBet(s, 0, 50); // Mise = 50, chips = 0 → ne peut pas doubler
      placeBet(s, 1, 50);
      expect(bjDouble(s, 0)).toBe(false);
    });
  });

  // ── nextRound ─────────────────────────────────────────────────────────────

  describe('nextRound', () => {
    it("passe à la manche suivante depuis 'payout'", () => {
      const s = makeState();
      placeBet(s, 0, 50);
      placeBet(s, 1, 50);
      bjStand(s, 0);
      bjStand(s, 1);
      expect(s.phase).toBe('payout');
      const roundBefore = s.round;
      nextRound(s);
      expect(s.round).toBe(roundBefore + 1);
      expect(s.phase).toBe('betting');
      expect(s.p1.betPlaced).toBe(false);
      expect(s.p2.betPlaced).toBe(false);
    });

    it("refuse si la phase n'est pas 'payout'", () => {
      const s = makeState();
      expect(nextRound(s)).toBe(false);
    });

    it("refuse si le jeu est terminé (winner !== null)", () => {
      const s = makeState();
      placeBet(s, 0, 50);
      placeBet(s, 1, 50);
      bjStand(s, 0);
      bjStand(s, 1);
      s.winner = 1; // Forcer un gagnant
      expect(nextRound(s)).toBe(false);
    });
  });
});
