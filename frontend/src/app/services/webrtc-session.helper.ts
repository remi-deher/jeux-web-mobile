/**
 * injectWebRtcSession — helper Angular injectable
 *
 * Encapsule la mise en place complète du canal WebRTC P2P pour
 * n'importe quel jeu temps-réel, sans dupliquer les deux effect() de
 * signaling dans chaque composant.
 *
 * Usage dans un composant :
 *
 *   const rtc = injectWebRtcSession('pong');
 *   // ou
 *   const rtc = injectWebRtcSession('snake');
 *
 *   // Envoyer un message à l'adversaire via le canal P2P :
 *   rtc.send({ type: 'paddle', y: 42 });
 *
 *   // Réagir aux messages reçus :
 *   effect(() => {
 *     const msg = rtc.lastMessage() as any;
 *     if (msg?.type === 'paddle') { ... }
 *   });
 *
 *   // Afficher l'état de la connexion :
 *   rtc.status()   // 'idle' | 'connecting' | 'connected' | 'failed'
 *
 *   // Libérer les ressources :
 *   // → appelé automatiquement à la destruction du composant
 *
 * Fonctionnement interne :
 *  - P1 (joueur 1) initie le handshake dès que la room est à 2 joueurs.
 *  - P2 répond automatiquement aux signaux offer/answer/ice via GameService.
 *  - Le relai SDP+ICE transite par socket.io (serveur = simple intermédiaire).
 *  - Les credentials TURN sont récupérés dynamiquement depuis /api/rtc-config.
 *  - Après 8 s sans connexion établie, fallback silencieux sur socket.io.
 */

import { inject, effect, DestroyRef, Signal } from '@angular/core';
import { GameService } from './game.service';
import { WebRtcService, RtcStatus } from './webrtc.service';

export interface WebRtcSession {
  /** Signal réactif — état du canal P2P. */
  readonly status: Signal<RtcStatus>;

  /** Signal réactif — dernier message reçu de l'adversaire (JSON). */
  readonly lastMessage: Signal<unknown>;

  /** Envoie un payload JSON à l'adversaire via le canal P2P.
   *  No-op si le canal n'est pas encore ouvert (le message est ignoré
   *  silencieusement — pour les états critiques, utiliser aussi socket.io). */
  send(payload: unknown): void;

  /** Vrai si le canal data est ouvert et prêt à émettre. */
  readonly isOpen: boolean;
}

export function injectWebRtcSession(gameKey: string): WebRtcSession {
  const gameService   = inject(GameService);
  const webRtcService = inject(WebRtcService);
  const destroyRef    = inject(DestroyRef);

  /** Guard : on n'initie la connexion qu'une seule fois par room. */
  let hostedRoomId: string | null = null;

  // ── Effect 1 : transmettre les signaux SDP/ICE reçus du serveur ────────────
  // Déclenchée chaque fois que GameService reçoit un rtcOffer/Answer/Ice.
  // Filtrée sur gameKey pour éviter les interférences entre jeux.
  const signalEffect = effect(() => {
    const sig  = gameService.rtcSignal();
    if (!sig) return;

    const room = gameService.currentRoom();
    // Ignorer les signaux qui n'appartiennent pas à ce jeu ou aux rooms locales
    if (!room || room.isLocal || room.gameType !== gameKey) return;

    webRtcService.handleSignal(
      sig,
      answer => gameService.sendRtcAnswer(room.id, answer),
      ice    => gameService.sendRtcIce(room.id, ice),
    );
  }, { allowSignalWrites: false });

  // ── Effect 2 : P1 initie le handshake dès que la room est complète ─────────
  const hostEffect = effect(() => {
    const room = gameService.currentRoom();
    if (!room || room.isLocal || room.gameType !== gameKey) return;
    if (room.players.length < 2) return;

    // Identifier si on est P1 (index 0)
    const socketId = gameService.getSocketId();
    const myIndex  = room.players.findIndex(p => p.id === socketId);
    if (myIndex !== 0) return;           // seul P1 initie
    if (hostedRoomId === room.id) return; // déjà lancé pour cette room

    hostedRoomId = room.id;
    webRtcService.initAsHost(
      offer => gameService.sendRtcOffer(room.id, offer),
      ice   => gameService.sendRtcIce(room.id, ice),
    );
  }, { allowSignalWrites: false });

  // ── Nettoyage automatique à la destruction du composant ────────────────────
  destroyRef.onDestroy(() => {
    webRtcService.reset();
    hostedRoomId = null;
  });

  // ── Interface publique ──────────────────────────────────────────────────────
  return {
    status:      webRtcService.status,
    lastMessage: webRtcService.lastMessage,
    send:        (payload: unknown) => webRtcService.send(payload),
    get isOpen() { return webRtcService.isOpen; },
  };
}
