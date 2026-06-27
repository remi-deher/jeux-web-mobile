import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    // Inclure uniquement les specs "pure TypeScript" sans Angular TestBed ni Phaser.
    // Les specs Angular (app.spec.ts etc.) nécessitent @angular/core/testing
    // et Phaser Canvas — incompatibles avec jsdom sans configuration supplémentaire.
    include: ['src/**/airhockey-physics.spec.ts'],
    exclude: ['**/node_modules/**'],
  },
});
