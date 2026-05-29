# Changelog

Toutes les modifications notables du projet sont documentées ici.
Format : [Catégorie] — description. Fichiers impactés.

---

## [2026-05-29] — Refactoring & Corrections de bugs

### Refactoring backend : `server.ts` (1458 → 1015 lignes, −30%)

#### Problème
Le fichier `server.ts` contenait **5 blocs `if/else` identiques** (~35 branches chacun) pour initialiser l'état d'un jeu à partir de son type. Chaque nouveau jeu nécessitait une modification dans 6+ emplacements distincts, avec un risque élevé d'oubli.

#### Solution — 4 fonctions helpers centralisées

```
backend/src/server.ts — section "Game factory helpers" (avant broadcastRoomUpdate)
```

| Helper | Rôle |
|--------|------|
| `createGameState(gameType, playerIds, variant?)` | Factory : retourne l'état initial. **Unique point de modification pour un nouveau jeu.** |
| `startGameLoop(gameType, roomId)` | Démarre la boucle physique (pong/snake/tetris) |
| `stopGameLoop(gameType, roomId)` | Arrête proprement la boucle physique |
| `setGameWinner(room, winnerNum, winnerId, leaveReason?)` | Assigne le gagnant selon la sémantique du jeu |

#### Emplacements refactorisés

| Événement socket | Avant | Après |
|-----------------|-------|-------|
| `acceptChallenge` | ~33 lignes if/else | 2 lignes |
| `createLocalRoom` | ~33 lignes if/else | 2 lignes |
| `joinRoom` | ~33 lignes if/else | 2 lignes |
| `requestRematch` (local) | ~33 lignes if/else | 2 lignes |
| `requestRematch` (online) | ~33 lignes if/else | 2 lignes |
| `forceEnd` (winner assignment) | ~88 lignes if/else | 3 lignes |
| `handlePlayerLeave` (winner) | ~85 lignes if/else | 3 lignes |

---

### Bug fix — `memoryTimeouts` orphelins

#### Problème
Quand une room était supprimée (les deux joueurs partaient simultanément), le `setTimeout` de 1,5 s du jeu Mémoire (`memoryTimeouts[roomId]`) n'était jamais annulé. Le callback pouvait s'exécuter sur une room inexistante.

#### Fix
`handlePlayerLeave` — branche `room.players.length === 0` :

```typescript
if (memoryTimeouts[roomId]) {
  clearTimeout(memoryTimeouts[roomId]);
  delete memoryTimeouts[roomId];
}
```

Fichier : `backend/src/server.ts`

---

### Bug fix — Double-emit Tetris

#### Problème
Lorsqu'un joueur gagnait au Tetris (via la boucle physique **ou** via un input), le serveur émettait :
1. `tetrisUpdate` (état brut avec winner)
2. `roomUpdate` via `broadcastRoomUpdate` (état complet de la room)

Le client recevait donc deux events distincts portant le même état final, provoquant un double rendu.

#### Fix
La boucle `startTetrisLoop` et le handler `tetrisInput` n'émettent plus `tetrisUpdate` quand un gagnant est présent. Seul `broadcastRoomUpdate` est émis dans ce cas.

```typescript
// Avant
updateTetrisPhysics(state, ...);
io.to(roomId).emit('tetrisUpdate', state);        // toujours
if (state.winner !== null) { broadcastRoomUpdate(room); }

// Après
updateTetrisPhysics(state, ...);
if (state.winner !== null) {
  broadcastRoomUpdate(room);                       // état final via roomUpdate
} else {
  io.to(roomId).emit('tetrisUpdate', state);       // frame intermédiaire seulement
}
```

Fichier : `backend/src/server.ts` — `startTetrisLoop()` et handler `tetrisInput`

---

### Fix frontend — `setTimeout` non nettoyés (chess, checkers, connect4)

#### Problème
Les composants `ChessComponent`, `CheckersComponent` et `Connect4Component` implémentent leur propre logique d'emoji flottant avec des `setTimeout` de 2 s. Ces timeouts n'étaient pas annulés si le composant était détruit avant leur expiration.

#### Fix
Injection de `DestroyRef` (Angular) + `destroyRef.onDestroy(() => clearTimeout(t))` sur chaque timeout.

```typescript
// Avant
setTimeout(() => {
  this.floatingEmojis.update(...);
}, 2000);

// Après
const t = setTimeout(() => {
  this.floatingEmojis.update(...);
}, 2000);
this.destroyRef.onDestroy(() => clearTimeout(t));
```

Fichiers modifiés :
- `frontend/src/app/components/chess/chess.component.ts`
- `frontend/src/app/components/checkers/checkers.component.ts`
- `frontend/src/app/components/connect4/connect4.component.ts`

---

## [2026-05-29] — Optimisations temps-réel (commits précédents)

### fix(pong) — guard localStorage par room.id
Empêche une boucle infinie de rechargement de page si `rt_reloaded` est défini sans room ID valide.

### refactor(canvas) — `injectRealtimeCanvas` helper commun
Extraction du boilerplate RAF + subscription raw state dans un helper réutilisable pour Pong, Snake et Tetris.

### fix(pong) — auto-reload page au démarrage d'une partie temps-réel
Résout un cas où la page ne se rechargait pas correctement lors du démarrage d'une session WebRTC.

### fix(pong) — bypass zone.js pour les boucles de jeu à 60 Hz
Utilisation de `ngZone.runOutsideAngular()` pour les boucles RAF et setInterval afin d'éviter le déclenchement de la change detection Angular à 60 Hz.

### fix(pong) — arrêt de la mise à jour de `currentRoom` à 60 Hz
Introduction de signaux dédiés (`livePongState`, `liveSnakeState`, `liveTetrisState`) pour les états bruts haute-fréquence, séparés de `currentRoom` mis à jour via Socket.io.
