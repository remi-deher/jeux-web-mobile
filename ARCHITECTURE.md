# Architecture & Contexte Technique (ARCHITECTURE.md)

Ce document décrit l'architecture globale, les choix technologiques et les flux de données du projet **Playbox** pour guider toute intelligence artificielle intervenant sur ce dépôt.

---

## 🗺️ Structure du Projet

Le dépôt est organisé en trois grandes parties (Monorepo léger) :

```
serene-noether/
├── shared/               # Types et modèles partagés (Typescript)
├── backend/              # Serveur Node.js (Express, Socket.io)
└── frontend/             # Application Angular (Single Page Application, PWA)
```

### 1. Dossier `shared/` (Types Partagés)
* **Rôle** : Fournit la cohérence des structures de données entre le frontend et le backend.
* Contient les définitions des types de jeux (`game-types.ts`), de gestion de salon/joueur (`room.ts`), et les interfaces d'états de jeux individuels (`states/`).
* Les importations se font via l'alias `@sn/shared` défini dans les configurations TypeScript respectives.

### 2. Dossier `backend/` (Serveur Autoritaire)
* **Stack** : Node.js, Express, Socket.io, TypeScript.
* **Point d'entrée** : [backend/src/server.ts](file:///C:/Users/remi2/Documents/antigravity/serene-noether/backend/src/server.ts)
* **Logique de Jeu** : Les dossiers `backend/src/games/` contiennent les moteurs de jeux autoritaires (Chess, Checkers, Pong, Snake, Tetris, Blackjack, Uno, Dominos, Memory, TicTacToe).
* **Moteur physique / Boucle principale** :
  * Les jeux en temps réel (Pong, Tetris, Snake) ont leur propre boucle de tick initiée par `startPongLoop()`, `startSnakeLoop()`, etc.
  * Les calculs physiques sont exécutés côté serveur, puis l'état résultant est diffusé périodiquement via Socket.io à tous les joueurs du salon.

### 3. Dossier `frontend/` (Client & PWA)
* **Stack** : Angular (Standalone Components), RxJS, Socket.io-client, Vanilla CSS (Variables MD3/Modernes).
* **Composants de Jeu** : Tous situés dans [frontend/src/app/components/](file:///C:/Users/remi2/Documents/antigravity/serene-noether/frontend/src/app/components/).
* **Gestion du temps réel et de la latence (Client Prediction)** :
  * Le client maintient un état de simulation local (`simState`) synchronisé au rythme du rafraîchissement écran (`requestAnimationFrame`).
  * Il prédit les mouvements de la balle ou des éléments locaux pour une fluidité à 60 FPS sans attendre le serveur.
  * La méthode de réconciliation (ex: `reconcile()` dans Pong) corrige en douceur les dérives par rapport à la vérité serveur via une **zone morte** de latence.

---

## ⚡ Principes Clés d'Architecture

### 1. Salons de jeu (Rooms) et Cycle de vie
* Les salons sont créés avec un code unique de 6 lettres (ex: `ABCXYZ`).
* Le cycle d'une partie comporte les statuts suivants : `waiting` (attente d'adversaire), `playing` (partie en cours), `finished` (terminée).
* **Ready Check System** : Pour les jeux temps réel (Snake, Pong), le jeu reste en pause tant que les deux joueurs n'ont pas notifié leur état de préparation via l'événement socket `playerReady`.

### 2. Double Canal de Communication (WebSockets + WebRTC)
* **Signalisation & Matchmaking** : Gérés de manière fiable par les WebSockets TCP via Socket.io.
* **Données Haute Fréquence (P2P)** :
  * Pour Pong (et les futurs jeux rapides), l'application tente d'établir une connexion WebRTC directe (Peer-to-Peer) via le helper `injectWebRtcSession`.
  * Si la connexion WebRTC réussit, les coordonnées ultra-rapides (comme la position de la raquette de l'adversaire) transitent via un canal de données RTC UDP à très faible latence.
  * En cas d'échec ou de blocage NAT, le système bascule automatiquement et de façon transparente sur l'envoi classique via WebSockets TCP.

### 3. Support PWA (Progressive Web App)
* **Manifeste** : Situé dans [frontend/public/manifest.webmanifest](file:///C:/Users/remi2/Documents/antigravity/serene-noether/frontend/public/manifest.webmanifest).
* **Service Worker** : Caches applicatifs gérés par le module `@angular/service-worker` (configuré dans `ngsw-config.json`).
* **Bannière d'installation PWA** :
  * Gérée par `pwa.service.ts`.
  * Intercepte l'événement `beforeinstallprompt` pour proposer un bouton d'installation natif (Android, Chrome, Windows/macOS).
  * Détecte les plateformes iOS/Apple et affiche à la place un modal explicatif pas-à-pas pour Safari (Bouton Partager ➔ Sur l'écran d'accueil).
  * Les métadonnées iOS spécifiques sont configurées dans `index.html`.

---

## 🛠️ Règles de développement pour l'IA

* **Pas de Framework CSS Externe** : Utilisez uniquement du CSS pur (Vanilla CSS) avec les variables du thème (déclarées dans `styles.css`).
* **Types stricts** : Ne court-circuitez pas le typage TypeScript. Utilisez les modèles partagés de `@sn/shared`.
* **Physique Déterministe** : Les paramètres physiques (vitesse de la balle, taille des raquettes, accélération) doivent être identiques au pixel près entre les fichiers physiques côté backend (ex: `pong.ts`) et les constantes frontend (ex: `pong-physics.ts`).
* **Sécurité** : Ne commitez jamais d'informations en clair. Les fichiers de déploiement doivent inclure des placeholders génériques.
