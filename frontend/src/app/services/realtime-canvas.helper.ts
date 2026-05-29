/**
 * injectRealtimeCanvas — helper pour les composants canvas haute-fréquence
 *
 * Encapsule le boilerplate commun à Pong, Snake et Tetris :
 *  - Détache le composant de la boucle de change detection Angular (cdr.detach)
 *  - Lance la boucle RAF hors de la zone Angular (pas de CD à 60 Hz)
 *  - Abonne le composant aux mises à jour physiques brutes (hors zone)
 *  - Ré-exécute detectChanges() uniquement quand l'UI signal change
 *    (score, winner, ready status… — quelques fois par partie max)
 *  - Nettoie l'abonnement automatiquement via DestroyRef
 *
 * Usage dans un composant canvas :
 *
 *   private rt = injectRealtimeCanvas(
 *     cb  => this.gameService.subscribePongRaw(cb),
 *     ()  => this.gameService.livePongState(),
 *   );
 *
 *   ngAfterViewInit() {
 *     this.rt.start(
 *       state => this.onServerState(state),  // callback physique (hors zone)
 *       ()    => this.startLoop(),           // lancé automatiquement hors zone
 *     );
 *   }
 *
 *   // Pour relancer la boucle hors zone (ex. visibilitychange) :
 *   this.rt.runOutside(() => this.startLoop());
 */

import { inject, NgZone, ChangeDetectorRef, DestroyRef, effect, untracked } from '@angular/core';

export interface RealtimeCanvasRef {
  /** Appeler depuis ngAfterViewInit une fois le canvas prêt. */
  start(onPhysics: (s: any) => void, startLoop: () => void): void;
  /** Exécuter une fonction hors de la zone Angular (ex: relancer la boucle RAF). */
  runOutside(fn: () => void): void;
}

export function injectRealtimeCanvas(
  /** Fonction qui s'abonne aux mises à jour brutes du serveur (hors zone). */
  subscribe: (cb: (s: any) => void) => () => void,
  /** Signal Angular dont le changement doit déclencher un repaint UI.
   *  N'est mis à jour que sur les évènements rares (score, winner, ready…). */
  uiSignal: () => any,
): RealtimeCanvasRef {
  const ngZone     = inject(NgZone);
  const cdr        = inject(ChangeDetectorRef);
  const destroyRef = inject(DestroyRef);

  let unsub: (() => void) | undefined;
  let started = false;

  // Réagit aux changements de uiSignal → force un repaint du composant.
  // untracked() empêche que des signaux lus dans detectChanges() soient
  // trackés par cet effet (évite les cycles ou des deps parasites).
  effect(() => {
    uiSignal();
    if (started) untracked(() => cdr.detectChanges());
  });

  destroyRef.onDestroy(() => unsub?.());

  return {
    start(onPhysics, startLoop) {
      // Décroche ce composant de la boucle automatique de change detection.
      // L'effet ci-dessus appelle detectChanges() pour les mises à jour UI.
      cdr.detach();
      started = true;

      // Abonnement physique — le callback sera appelé hors zone Angular
      // (garanti par runOutsideAngular dans game.service.ts)
      unsub = subscribe(onPhysics);

      // Boucle RAF hors zone : zone.js patche requestAnimationFrame, donc
      // un appel dans la zone déclencherait ApplicationRef.tick() à 60 Hz.
      ngZone.runOutsideAngular(() => startLoop());
    },

    runOutside(fn) {
      ngZone.runOutsideAngular(fn);
    },
  };
}
