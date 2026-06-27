import { describe, it, expect, beforeEach } from 'vitest';
import {
  AirhockeyState,
  createInitialAirhockeyState,
  updateAirhockeyPhysics,
} from '../airhockey';

// Utilitaire : crée un état prêt à jouer (les deux joueurs sont ready)
function readyState(): AirhockeyState {
  const s = createInitialAirhockeyState();
  s.p1Ready = true;
  s.p2Ready = true;
  s.serving = false; // Pas en service : la physique s'exécute directement
  return s;
}

describe('Airhockey', () => {
  // ── État initial ─────────────────────────────────────────────────────────────

  describe('createInitialAirhockeyState', () => {
    it('place le palet au centre (50, 50)', () => {
      const s = createInitialAirhockeyState();
      expect(s.puck.x).toBe(50);
      expect(s.puck.y).toBe(50);
    });

    it('initialise les scores à 0', () => {
      const s = createInitialAirhockeyState();
      expect(s.scoreP1).toBe(0);
      expect(s.scoreP2).toBe(0);
    });

    it('met targetScore à 5', () => {
      const s = createInitialAirhockeyState();
      expect(s.targetScore).toBe(5);
    });

    it("commence en mode service", () => {
      const s = createInitialAirhockeyState();
      expect(s.serving).toBe(true);
    });

    it("n'a pas de gagnant", () => {
      const s = createInitialAirhockeyState();
      expect(s.winner).toBeNull();
    });
  });

  // ── Garde-fous physique ──────────────────────────────────────────────────────

  describe('updateAirhockeyPhysics — gardes', () => {
    it("ne fait rien s'il y a déjà un gagnant", () => {
      const s = readyState();
      s.winner = 1;
      s.puck.vx = 5;
      const prevX = s.puck.x;
      updateAirhockeyPhysics(s);
      expect(s.puck.x).toBe(prevX); // Le palet n'a pas bougé
    });

    it("ne fait rien si P1 n'est pas prêt", () => {
      const s = readyState();
      s.p1Ready = false;
      s.puck.vx = 2;
      const prevX = s.puck.x;
      updateAirhockeyPhysics(s);
      expect(s.puck.x).toBe(prevX);
    });

    it("ne fait rien si P2 n'est pas prêt", () => {
      const s = readyState();
      s.p2Ready = false;
      s.puck.vx = 2;
      const prevX = s.puck.x;
      updateAirhockeyPhysics(s);
      expect(s.puck.x).toBe(prevX);
    });

    it('décrémente le serveCountdown pendant le service', () => {
      const s = createInitialAirhockeyState();
      s.p1Ready = true;
      s.p2Ready = true;
      s.serving = true;
      s.serveCountdown = 10;
      updateAirhockeyPhysics(s);
      expect(s.serveCountdown).toBe(9);
    });

    it('lance le palet quand serveCountdown atteint 0', () => {
      const s = createInitialAirhockeyState();
      s.p1Ready = true;
      s.p2Ready = true;
      s.serving = true;
      s.serveCountdown = 1;
      s.serveTowards = 1;
      updateAirhockeyPhysics(s);
      expect(s.serving).toBe(false);
      expect(s.puck.vx).toBeLessThan(0); // Vers P1 (gauche)
    });
  });

  // ── Physique du palet ────────────────────────────────────────────────────────

  describe('physique du palet', () => {
    it('déplace le palet selon sa vitesse', () => {
      const s = readyState();
      s.puck.x = 50;
      s.puck.y = 50;
      s.puck.vx = 1;
      s.puck.vy = 0;
      updateAirhockeyPhysics(s);
      // Le palet se déplace vers la droite (avec légère friction 0.994)
      expect(s.puck.x).toBeGreaterThan(50);
    });

    it('rebondit sur le mur du haut', () => {
      const s = readyState();
      s.puck.x = 50;
      s.puck.y = s.puck.radius; // Juste au bord du mur
      s.puck.vx = 0;
      s.puck.vy = -1; // Monte vers le mur
      updateAirhockeyPhysics(s);
      // Après rebond, vy doit être positif (retourne vers le bas)
      expect(s.puck.vy).toBeGreaterThan(0);
    });

    it('rebondit sur le mur du bas', () => {
      const s = readyState();
      s.puck.x = 50;
      s.puck.y = 100 - s.puck.radius;
      s.puck.vx = 0;
      s.puck.vy = 1; // Descend vers le mur
      updateAirhockeyPhysics(s);
      expect(s.puck.vy).toBeLessThan(0);
    });

    it('plafonne la vitesse à maxSpeed (3.0)', () => {
      const s = readyState();
      s.puck.x = 50;
      s.puck.y = 50;
      s.puck.vx = 10; // Bien au-delà du max
      s.puck.vy = 10;
      updateAirhockeyPhysics(s);
      const speed = Math.sqrt(s.puck.vx ** 2 + s.puck.vy ** 2);
      expect(speed).toBeLessThanOrEqual(3.01); // Tolérance flottante
    });
  });

  // ── Détection de but ─────────────────────────────────────────────────────────

  describe('détection de but', () => {
    it("incrémente scoreP2 quand le palet entre dans le but gauche (P1 side)", () => {
      const s = readyState();
      // Positionner le palet à gauche, dans la zone de but (Y entre 32 et 68)
      s.puck.x = s.puck.radius; // Juste au bord
      s.puck.y = 50; // Centre du but
      s.puck.vx = -2; // Se déplace vers la gauche
      updateAirhockeyPhysics(s);
      expect(s.scoreP2).toBe(1);
      expect(s.serving).toBe(true); // Reset service
    });

    it("incrémente scoreP1 quand le palet entre dans le but droit (P2 side)", () => {
      const s = readyState();
      s.puck.x = 100 - s.puck.radius;
      s.puck.y = 50;
      s.puck.vx = 2; // Se déplace vers la droite
      updateAirhockeyPhysics(s);
      expect(s.scoreP1).toBe(1);
      expect(s.serving).toBe(true);
    });

    it("rebondit sur le mur gauche si le palet est hors de la cage (Y < 32)", () => {
      const s = readyState();
      s.puck.x = s.puck.radius;
      s.puck.y = 10; // Hors de la zone de but (goalTop = 32)
      s.puck.vx = -2;
      const prevScoreP2 = s.scoreP2;
      updateAirhockeyPhysics(s);
      expect(s.scoreP2).toBe(prevScoreP2); // Pas de but
      expect(s.puck.vx).toBeGreaterThan(0); // Rebond : direction inversée
    });

    it("détecte le gagnant quand scoreP1 atteint targetScore", () => {
      const s = readyState();
      s.scoreP1 = s.targetScore - 1;
      // Mettre le palet dans le but droit
      s.puck.x = 100 - s.puck.radius;
      s.puck.y = 50;
      s.puck.vx = 2;
      updateAirhockeyPhysics(s);
      expect(s.winner).toBe(1);
    });
  });
});
