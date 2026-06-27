import { describe, it, expect, beforeEach } from 'vitest';
import {
  SimAirhockeyState,
  stepAirhockey,
  cloneServerState,
} from './airhockey-physics';

// Utilitaire : crée un état de simulation prêt à jouer
function makeState(): SimAirhockeyState {
  return cloneServerState({
    puck: { x: 50, y: 50, vx: 0, vy: 0, radius: 2.5 },
    p1Mallet: { x: 20, y: 50, prevX: 20, prevY: 50, radius: 4.0 },
    p2Mallet: { x: 80, y: 50, prevX: 80, prevY: 50, radius: 4.0 },
    scoreP1: 0,
    scoreP2: 0,
    winner: null,
    targetScore: 5,
    serving: false,
    serveCountdown: 0,
    serveTowards: 1,
    lastHit: null,
    p1Ready: true,
    p2Ready: true,
  });
}

describe('Airhockey Physics (frontend)', () => {

  // ── cloneServerState ───────────────────────────────────────────────────────

  describe('cloneServerState', () => {
    it('crée un état valide depuis un objet serveur', () => {
      const state = makeState();
      expect(state.puck.x).toBe(50);
      expect(state.puck.y).toBe(50);
      expect(state.p1Mallet.radius).toBe(4.0);
    });

    it('utilise les valeurs par défaut si des champs manquent', () => {
      const state = cloneServerState({});
      expect(state.puck.x).toBe(50);
      expect(state.puck.radius).toBe(2.5);
      expect(state.p1Mallet.x).toBe(20);
      expect(state.p2Mallet.x).toBe(80);
    });
  });

  // ── Gardes ─────────────────────────────────────────────────────────────────

  describe('stepAirhockey — gardes', () => {
    it("ne fait rien s'il y a un gagnant", () => {
      const state = makeState();
      state.winner = 2;
      state.puck.vx = 5;
      const prevX = state.puck.x;
      stepAirhockey(state);
      expect(state.puck.x).toBe(prevX);
    });

    it("ne fait rien si P1 n'est pas prêt", () => {
      const state = makeState();
      state.p1Ready = false;
      state.puck.vx = 2;
      const prevX = state.puck.x;
      stepAirhockey(state);
      expect(state.puck.x).toBe(prevX);
    });

    it('décrémente serveCountdown pendant le service', () => {
      const state = makeState();
      state.serving = true;
      state.serveCountdown = 5;
      stepAirhockey(state);
      expect(state.serveCountdown).toBe(4);
    });

    it('arrête le service et lance le palet quand countdown = 0', () => {
      const state = makeState();
      state.serving = true;
      state.serveCountdown = 1;
      state.serveTowards = 2; // Lance vers P2 (droite)
      stepAirhockey(state);
      expect(state.serving).toBe(false);
      expect(state.puck.vx).toBeGreaterThan(0); // Vers la droite
    });
  });

  // ── Mouvement et friction ──────────────────────────────────────────────────

  describe('mouvement et friction', () => {
    it('déplace le palet selon sa vitesse', () => {
      const state = makeState();
      state.puck.vx = 2;
      state.puck.vy = 0;
      stepAirhockey(state);
      expect(state.puck.x).toBeGreaterThan(50);
    });

    it('applique la friction (vitesse diminue légèrement)', () => {
      const state = makeState();
      state.puck.vx = 2;
      state.puck.vy = 0;
      state.puck.x = 50;
      state.puck.y = 50;
      stepAirhockey(state);
      // Après déplacement, vx doit avoir diminué (0.994)
      expect(state.puck.vx).toBeLessThan(2);
      expect(state.puck.vx).toBeGreaterThan(1.98);
    });
  });

  // ── Rebonds sur les murs ───────────────────────────────────────────────────

  describe('rebonds sur les murs', () => {
    it('rebondit sur le mur supérieur (y ≤ 0)', () => {
      const state = makeState();
      state.puck.y = state.puck.radius;
      state.puck.vy = -1;
      stepAirhockey(state);
      expect(state.puck.vy).toBeGreaterThan(0);
      expect(state.lastHit).toBe('wall');
    });

    it('rebondit sur le mur inférieur (y ≥ 100)', () => {
      const state = makeState();
      state.puck.y = 100 - state.puck.radius;
      state.puck.vy = 1;
      stepAirhockey(state);
      expect(state.puck.vy).toBeLessThan(0);
      expect(state.lastHit).toBe('wall');
    });

    it('rebondit sur le mur gauche (hors zone de but)', () => {
      const state = makeState();
      state.puck.x = state.puck.radius;
      state.puck.y = 10; // Hors de goalTop..goalBottom (32..68)
      state.puck.vx = -2;
      stepAirhockey(state);
      expect(state.puck.vx).toBeGreaterThan(0);
      expect(state.lastHit).toBe('wall');
    });

    it('rebondit sur le mur droit (hors zone de but)', () => {
      const state = makeState();
      state.puck.x = 100 - state.puck.radius;
      state.puck.y = 10; // Hors but
      state.puck.vx = 2;
      stepAirhockey(state);
      expect(state.puck.vx).toBeLessThan(0);
      expect(state.lastHit).toBe('wall');
    });
  });

  // ── But ───────────────────────────────────────────────────────────────────

  describe('détection de but', () => {
    it("scoreP2 augmente quand le palet entre dans le but gauche", () => {
      const state = makeState();
      state.puck.x = state.puck.radius;
      state.puck.y = 50; // Dans la cage (32–68)
      state.puck.vx = -2;
      stepAirhockey(state);
      expect(state.scoreP2).toBe(1);
      expect(state.serving).toBe(true);
    });

    it("scoreP1 augmente quand le palet entre dans le but droit", () => {
      const state = makeState();
      state.puck.x = 100 - state.puck.radius;
      state.puck.y = 50;
      state.puck.vx = 2;
      stepAirhockey(state);
      expect(state.scoreP1).toBe(1);
      expect(state.serving).toBe(true);
    });
  });

  // ── Collision mallet ──────────────────────────────────────────────────────

  describe('collision mallet-palet', () => {
    it('repousse le palet hors du mallet P1 en collision', () => {
      const state = makeState();
      // Placer le palet sur le mallet P1 (overlap)
      state.p1Mallet.x = 30;
      state.p1Mallet.y = 50;
      state.puck.x = 32; // Overlap (radius puck=2.5, radius mallet=4.0 → minDist=6.5)
      state.puck.y = 50;
      state.puck.vx = -1; // Se dirige vers le mallet
      stepAirhockey(state);
      // Après collision, le palet doit être repoussé
      const dist = Math.sqrt(
        (state.puck.x - state.p1Mallet.x) ** 2 +
        (state.puck.y - state.p1Mallet.y) ** 2
      );
      expect(dist).toBeGreaterThanOrEqual(6.4); // Approximativement minDist
    });

    it('lastHit = "p1" après collision avec le mallet de P1', () => {
      const state = makeState();
      state.p1Mallet.x = 30;
      state.p1Mallet.y = 50;
      state.puck.x = 32;
      state.puck.y = 50;
      state.puck.vx = -1;
      stepAirhockey(state);
      expect(state.lastHit).toBe('p1');
    });

    it('plafonne la vitesse du palet à 3.0', () => {
      const state = makeState();
      state.puck.vx = 10;
      state.puck.vy = 10;
      stepAirhockey(state);
      const speed = Math.sqrt(state.puck.vx ** 2 + state.puck.vy ** 2);
      expect(speed).toBeLessThanOrEqual(3.01);
    });
  });
});
