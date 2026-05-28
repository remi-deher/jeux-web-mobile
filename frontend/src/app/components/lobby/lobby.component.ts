import { Component, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GameService } from '../../services/game.service';

@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="lobby-container">
      @if (!username()) {
        <!-- Username Selection -->
        <div class="surface-card username-card">
          <div class="user-hero">
            <span class="material-symbols hero-icon">account_circle</span>
          </div>
          <div class="card-text">
            <h2>Prêt à jouer ?</h2>
            <p>Choisissez un pseudonyme pour rejoindre le salon général et défier d'autres joueurs.</p>
          </div>
          <form (submit)="saveUsername(); $event.preventDefault()">
            <input
              type="text"
              [(ngModel)]="tempUsername"
              name="tempUsername"
              placeholder="Pseudonyme..."
              maxlength="15"
              required
            />
            <button type="submit" class="primary-btn">
              <span>Entrer</span>
              <span class="material-symbols">arrow_forward</span>
            </button>
          </form>
        </div>
      } @else if (selectedGame() === null) {
        <!-- Step 1: Select Game -->
        <div class="game-select-view">
          <div class="welcome-header">
            <h2>Bonjour, <strong>{{ username() }}</strong> !</h2>
            <p>Sélectionnez un jeu pour voir les salons disponibles ou en créer un nouveau.</p>
          </div>

          <div class="game-selector-grid">
            <button class="game-card" (click)="selectGame('connect4')">
              <div class="game-card-image">
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="100" height="100" rx="24" fill="#2A2438"/>
                  <rect x="15" y="15" width="70" height="70" rx="12" fill="#352F44"/>
                  <circle cx="35" cy="35" r="8" fill="#5C5470"/>
                  <circle cx="65" cy="35" r="8" fill="#5C5470"/>
                  <circle cx="35" cy="65" r="8" fill="#D0BCFF"/>
                  <circle cx="65" cy="65" r="8" fill="#F2B8B5"/>
                  <circle cx="50" cy="50" r="8" fill="#D0BCFF"/>
                </svg>
              </div>
              <div class="game-card-info">
                <span class="game-name">Puissance 4</span>
                <span class="game-tag">1v1</span>
              </div>
            </button>

            <button class="game-card" (click)="selectGame('battleship')">
              <div class="game-card-image">
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="100" height="100" rx="24" fill="#1E2A38"/>
                  <path d="M15 70 C30 65, 45 75, 60 70 C75 65, 85 70, 85 70" stroke="#3A506B" stroke-width="3" stroke-linecap="round"/>
                  <path d="M15 50 C25 45, 40 55, 55 50 C70 45, 85 50, 85 50" stroke="#3A506B" stroke-width="2" stroke-linecap="round"/>
                  <path d="M30 55 L35 43 L60 43 L65 55 Z" fill="#D0BCFF"/>
                  <rect x="42" y="32" width="12" height="12" fill="#A892EE" rx="2"/>
                  <circle cx="70" cy="30" r="12" stroke="#EFB8C8" stroke-width="2" stroke-dasharray="3 3"/>
                  <circle cx="70" cy="30" r="4" fill="#EFB8C8"/>
                </svg>
              </div>
              <div class="game-card-info">
                <span class="game-name">Bataille Navale</span>
                <span class="game-tag">Tactique</span>
              </div>
            </button>

            <button class="game-card" (click)="selectGame('tictactoe')">
              <div class="game-card-image">
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="100" height="100" rx="24" fill="#2E232F"/>
                  <line x1="40" y1="20" x2="40" y2="80" stroke="#4A394E" stroke-width="4" stroke-linecap="round"/>
                  <line x1="60" y1="20" x2="60" y2="80" stroke="#4A394E" stroke-width="4" stroke-linecap="round"/>
                  <line x1="20" y1="40" x2="80" y2="40" stroke="#4A394E" stroke-width="4" stroke-linecap="round"/>
                  <line x1="20" y1="60" x2="80" y2="60" stroke="#4A394E" stroke-width="4" stroke-linecap="round"/>
                  <path d="M25 25 L35 35 M35 25 L25 35" stroke="#D0BCFF" stroke-width="4" stroke-linecap="round"/>
                  <circle cx="50" cy="50" r="6" stroke="#EFB8C8" stroke-width="4"/>
                  <path d="M65 65 L75 75 M75 65 L65 75" stroke="#D0BCFF" stroke-width="4" stroke-linecap="round"/>
                </svg>
              </div>
              <div class="game-card-info">
                <span class="game-name">Morpion</span>
                <span class="game-tag">Rapide</span>
              </div>
            </button>

            <button class="game-card" (click)="selectGame('checkers')">
              <div class="game-card-image">
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="100" height="100" rx="24" fill="#1C2E24"/>
                  <rect x="20" y="20" width="20" height="20" fill="#2E4A3B"/>
                  <rect x="60" y="20" width="20" height="20" fill="#2E4A3B"/>
                  <rect x="40" y="40" width="20" height="20" fill="#2E4A3B"/>
                  <rect x="20" y="60" width="20" height="20" fill="#2E4A3B"/>
                  <rect x="60" y="60" width="20" height="20" fill="#2E4A3B"/>
                  <circle cx="30" cy="30" r="8" fill="#141218" stroke="#CAC4D0" stroke-width="1.5"/>
                  <circle cx="30" cy="30" r="4" fill="none" stroke="#CAC4D0" stroke-width="1"/>
                  <circle cx="50" cy="50" r="8" fill="#D0BCFF" stroke="#381E72" stroke-width="1.5"/>
                  <circle cx="50" cy="50" r="4" fill="none" stroke="#381E72" stroke-width="1"/>
                </svg>
              </div>
              <div class="game-card-info">
                <span class="game-name">Jeu de Dames</span>
                <span class="game-tag">Stratégie</span>
              </div>
            </button>

            <button class="game-card" (click)="selectGame('chess')">
              <div class="game-card-image">
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="100" height="100" rx="24" fill="#2E2B20"/>
                  <path d="M35 75 C35 75 35 60 40 50 C45 40 40 30 50 25 C60 20 65 30 60 40 C55 50 65 50 65 60 C65 70 60 75 60 75 Z" fill="#D0BCFF" stroke="#381E72" stroke-width="2"/>
                  <path d="M35 75 L65 75" stroke="#381E72" stroke-width="4" stroke-linecap="round"/>
                  <circle cx="48" cy="35" r="2" fill="#381E72"/>
                  <path d="M60 48 L53 50" stroke="#381E72" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </div>
              <div class="game-card-info">
                <span class="game-name">Échecs</span>
                <span class="game-tag">Mental</span>
              </div>
            </button>

            <button class="game-card" (click)="selectGame('gomoku')">
              <div class="game-card-image">
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="100" height="100" rx="24" fill="#8D6E63"/>
                  <line x1="20" y1="50" x2="80" y2="50" stroke="#4E342E" stroke-width="2"/>
                  <line x1="50" y1="20" x2="50" y2="80" stroke="#4E342E" stroke-width="2"/>
                  <circle cx="50" cy="50" r="12" fill="#141218" stroke="#CAC4D0" stroke-width="1.5"/>
                  <circle cx="35" cy="35" r="10" fill="#FFFFFF" stroke="#141218" stroke-width="1.5"/>
                  <circle cx="65" cy="35" r="10" fill="#141218" stroke="#CAC4D0" stroke-width="1.5"/>
                </svg>
              </div>
              <div class="game-card-info">
                <span class="game-name">Gomoku</span>
                <span class="game-tag">5 Alignés</span>
              </div>
            </button>

            <button class="game-card" (click)="selectGame('othello')">
              <div class="game-card-image">
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="100" height="100" rx="24" fill="#00796B"/>
                  <circle cx="40" cy="50" r="14" fill="#FFFFFF" stroke="#004D40" stroke-width="2"/>
                  <circle cx="60" cy="50" r="14" fill="#141218" stroke="#CAC4D0" stroke-width="2"/>
                </svg>
              </div>
              <div class="game-card-info">
                <span class="game-name">Othello</span>
                <span class="game-tag">Reversi</span>
              </div>
            </button>
          </div>
        </div>
      } @else {
        <!-- Step 2: Game Lobby View -->
        <div class="game-lobby-view">
          <div class="lobby-topbar">
            <button class="icon-btn" (click)="selectGame(null)">
              <span class="material-symbols">arrow_back</span>
            </button>
            <h2 class="lobby-title">
              @if (selectedGame() === 'connect4') { Puissance 4 }
              @else if (selectedGame() === 'battleship') { Bataille Navale }
              @else if (selectedGame() === 'tictactoe') { Morpion }
              @else if (selectedGame() === 'checkers') { Jeu de Dames }
              @else if (selectedGame() === 'chess') { Échecs }
              @else if (selectedGame() === 'gomoku') { Gomoku }
              @else if (selectedGame() === 'othello') { Othello }
            </h2>
          </div>

          <div class="lobby-content-grid">
            <!-- Actions Card -->
            <div class="surface-card actions-card">
              <h3 class="card-title">Créer ou rejoindre</h3>
              <p class="card-subtitle">Démarrez une nouvelle partie ou rejoignez une partie privée existante.</p>

              <button class="primary-btn create-btn" (click)="openCreateModal()">
                <span class="material-symbols">add</span>
                <span>Créer une partie</span>
              </button>

              <button class="outlined-btn create-btn" style="margin-top: 12px;" (click)="createLocalRoom()">
                <span class="material-symbols">phone_android</span>
                <span>Jouer en Local (Passe & Joue)</span>
              </button>

              <div class="divider">
                <span>ou</span>
              </div>

              <div class="join-private">
                <label class="input-label">
                  <span class="material-symbols">vpn_key</span>
                  Code de salon privé
                </label>
                <form (submit)="joinByCode(); $event.preventDefault()">
                  <div class="input-row">
                    <input
                      type="text"
                      [(ngModel)]="joinCode"
                      name="joinCode"
                      placeholder="Ex: ABC12"
                      required
                    />
                    <button type="submit" class="secondary-btn">Rejoindre</button>
                  </div>
                </form>
              </div>
            </div>

            <!-- Public Rooms Card -->
            <div class="surface-card rooms-card">
              <h3 class="card-title">
                <span class="material-symbols">public</span>
                Salons publics
              </h3>
              <p class="card-subtitle">Rejoignez une partie publique en attente d'un joueur.</p>

              <div class="rooms-list">
                @for (room of filteredRooms(); track room.id) {
                  <div class="room-item">
                    <div class="room-code">{{ room.id }}</div>
                    <div class="room-players">
                      <span class="material-symbols players-icon">group</span>
                      {{ room.playersCount }}/2
                    </div>
                    @if (room.status === 'waiting' && room.playersCount < 2) {
                      <button (click)="joinRoom(room.id)" class="join-chip">Rejoindre</button>
                    } @else {
                      <span class="ongoing-chip">En cours</span>
                    }
                  </div>
                } @empty {
                  <div class="empty-rooms">
                    <span class="material-symbols">sports_esports</span>
                    <p>Aucun salon public disponible.</p>
                    <span>Créez le premier !</span>
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- Rules Accordion (Expandable) -->
          <div class="surface-card rules-card">
            <button class="rules-toggle-btn" (click)="toggleRules()">
              <div class="rules-toggle-left">
                <span class="material-symbols rules-title-icon">menu_book</span>
                <span>Comment jouer & Règle du jeu</span>
              </div>
              <span class="material-symbols toggle-icon">
                {{ showRules() ? 'expand_less' : 'expand_more' }}
              </span>
            </button>
            
            @if (showRules()) {
              <div class="rules-content">
                @if (selectedGame() === 'connect4') {
                  <div class="rules-section">
                    <h4>Règles du jeu</h4>
                    <p>Le but du jeu est d'aligner une suite de 4 pions de même couleur sur une grille de 6 rangées et 7 colonnes. L'alignement peut être horizontal, vertical ou diagonal. Le premier qui réalise cet alignement l'emporte. Si la grille est pleine sans alignement, la partie est nulle.</p>
                    <h4>Comment jouer</h4>
                    <ul>
                      <li>Cliquez sur n'importe quelle colonne pour y laisser tomber un pion.</li>
                      <li>Le pion descend automatiquement jusqu'à l'emplacement libre le plus bas.</li>
                      <li>Survolez les colonnes pour visualiser en temps réel l'endroit où votre pion va tomber.</li>
                    </ul>
                  </div>
                } @else if (selectedGame() === 'battleship') {
                  <div class="rules-section">
                    <h4>Règles du jeu</h4>
                    <p>Chaque joueur dispose d'une flotte de 5 navires de longueurs différentes placés sur une grille de 10x10. À tour de rôle, les joueurs tirent sur la grille adverse pour localiser et couler les navires ennemis. Le premier qui coule tous les navires adverses a gagné.</p>
                    <h4>Comment jouer</h4>
                    <ul>
                      <li><strong>Phase de placement :</strong> Cliquez sur un bateau puis sur votre grille pour le positionner. Cliquez sur le bouton "Orientation" pour basculer horizontalement ou verticalement.</li>
                      <li><strong>Phase de combat :</strong> Cliquez sur les cases de la grille de tir (grille du haut) pour lancer une attaque. Les tirs touchés sont marqués en rouge, les tirs manqués en bleu.</li>
                    </ul>
                  </div>
                } @else if (selectedGame() === 'tictactoe') {
                  <div class="rules-section">
                    <h4>Règles du jeu</h4>
                    <p>Le morpion se joue sur une grille de 3x3. Le but est d'être le premier à aligner 3 symboles identiques (les X pour le créateur, les O pour l'invité) horizontalement, verticalement ou diagonalement.</p>
                    <h4>Comment jouer</h4>
                    <ul>
                      <li>Cliquez simplement sur une case vide de la grille pour y placer votre symbole lorsque c'est votre tour.</li>
                    </ul>
                  </div>
                } @else if (selectedGame() === 'checkers') {
                  <div class="rules-section">
                    <h4>Règles du jeu</h4>
                    <p>Le jeu se déroule sur un damier. Les pions ne se déplacent qu'en diagonale vers l'avant, d'une case à la fois. Si un pion adverse est adjacent et que la case derrière lui est vide, vous devez obligatoirement sauter par-dessus pour le capturer. Si un pion atteint le bout opposé, il devient une Dame et gagne la capacité de se déplacer et capturer en arrière.</p>
                    <h4>Comment jouer</h4>
                    <ul>
                      <li>Cliquez sur un de vos pions (ils sont entourés d'une surbrillance) pour le sélectionner.</li>
                      <li>Les cases de mouvements ou de prises valides s'affichent alors en surbrillance verte.</li>
                      <li>Cliquez sur l'une de ces cases en surbrillance pour déplacer votre pion et valider votre coup.</li>
                    </ul>
                  </div>
                } @else if (selectedGame() === 'chess') {
                  <div class="rules-section">
                    <h4>Règles du jeu</h4>
                    <p>Le but est de mettre le Roi adverse en "Échec et Mat", c'est-à-dire dans une position où il est menacé de capture et ne peut plus y échapper. Chaque type de pièce (pion, cavalier, fou, tour, dame, roi) possède ses propres restrictions de mouvement.</p>
                    <h4>Comment jouer</h4>
                    <ul>
                      <li>Cliquez sur la pièce que vous souhaitez déplacer (les pièces sélectionnables s'illuminent au survol).</li>
                      <li>Les cases autorisées pour cette pièce s'affichent en surbrillance.</li>
                      <li>Cliquez sur l'une de ces cases pour finaliser le déplacement de la pièce.</li>
                    </ul>
                  </div>
                } @else if (selectedGame() === 'gomoku') {
                  <div class="rules-section">
                    <h4>Règles du jeu</h4>
                    <p>Le Gomoku se joue sur une grille de 15x15. Le but est d'être le premier à aligner exactement 5 pierres de sa couleur (noire ou blanche) horizontalement, verticalement ou en diagonale.</p>
                    <h4>Comment jouer</h4>
                    <ul>
                      <li>Plantez votre pierre en cliquant sur une case vide de la grille à tour de rôle.</li>
                      <li>Surveillez les lignes adverses de 3 ou 4 pierres pour les bloquer avant qu'ils ne gagnent.</li>
                    </ul>
                  </div>
                } @else if (selectedGame() === 'othello') {
                  <div class="rules-section">
                    <h4>Règles du jeu</h4>
                    <p>L'Othello (Reversi) se joue sur une grille 8x8. Les joueurs placent à tour de rôle un pion de leur couleur (noir ou blanc) de sorte à piéger un ou plusieurs pions adverses en ligne droite entre le pion posé et un pion préexistant de leur propre couleur. Les pions piégés sont retournés.</p>
                    <h4>Comment jouer</h4>
                    <ul>
                      <li>Les cases jouables pour votre tour s'affichent en surbrillance verte.</li>
                      <li>Cliquez sur l'une des cases vertes pour poser un pion et retourner les pions adverses.</li>
                      <li>Si vous n'avez aucun coup valide, votre tour est automatiquement passé. Le vainqueur est celui qui possède le plus de pions à la fin.</li>
                    </ul>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      }

      <!-- Create Room Modal -->
      @if (showCreateModal()) {
        <div class="modal-overlay" (click)="closeCreateModal()">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>Nouvelle partie</h3>
              <button class="icon-btn" (click)="closeCreateModal()">
                <span class="material-symbols">close</span>
              </button>
            </div>
            <p class="modal-desc">Choisissez la visibilité de votre salon.</p>

            <div class="vis-choices">
              <label class="choice-item" [class.selected]="!isPrivateChoice()">
                <input type="radio" [value]="false" [checked]="!isPrivateChoice()" (change)="setPrivateChoice(false)" />
                <span class="material-symbols choice-icon">public</span>
                <div class="choice-text">
                  <span class="choice-title">Public</span>
                  <span class="choice-desc">Visible dans la liste — n'importe qui peut rejoindre.</span>
                </div>
              </label>

              <label class="choice-item" [class.selected]="isPrivateChoice()">
                <input type="radio" [value]="true" [checked]="isPrivateChoice()" (change)="setPrivateChoice(true)" />
                <span class="material-symbols choice-icon">lock</span>
                <div class="choice-text">
                  <span class="choice-title">Privé</span>
                  <span class="choice-desc">Accessible uniquement via le code de salon.</span>
                </div>
              </label>
            </div>

            <div class="modal-actions">
              <button class="outlined-btn" (click)="closeCreateModal()">Annuler</button>
              <button class="primary-btn" (click)="confirmCreateRoom()">Créer</button>
            </div>
          </div>
        </div>
      }

      <!-- Local Names Modal -->
      @if (showLocalNamesModal()) {
        <div class="modal-overlay" (click)="showLocalNamesModal.set(false)">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>Partie Locale</h3>
              <button class="icon-btn" (click)="showLocalNamesModal.set(false)">
                <span class="material-symbols">close</span>
              </button>
            </div>
            <p class="modal-desc">Saisissez les pseudonymes pour les deux joueurs.</p>

            <form (submit)="confirmCreateLocalRoom(); $event.preventDefault()" style="display: flex; flex-direction: column; gap: 16px; width: 100%;">
              <div class="input-col" style="display: flex; flex-direction: column; gap: 6px;">
                <label style="font-size: 13px; font-weight: 500; color: var(--md-on-surface-variant); text-align: left;">Joueur 1 (Blanc / Croix / Flotte 1)</label>
                <input
                  type="text"
                  [(ngModel)]="localPlayer1Name"
                  name="localPlayer1Name"
                  placeholder="Nom Joueur 1..."
                  maxlength="15"
                  required
                  style="width: 100%; box-sizing: border-box;"
                />
              </div>

              <div class="input-col" style="display: flex; flex-direction: column; gap: 6px;">
                <label style="font-size: 13px; font-weight: 500; color: var(--md-on-surface-variant); text-align: left;">Joueur 2 (Noir / Rond / Flotte 2)</label>
                <input
                  type="text"
                  [(ngModel)]="localPlayer2Name"
                  name="localPlayer2Name"
                  placeholder="Nom Joueur 2..."
                  maxlength="15"
                  required
                  style="width: 100%; box-sizing: border-box;"
                />
              </div>

              <div class="modal-actions" style="margin-top: 8px;">
                <button type="button" class="outlined-btn" (click)="showLocalNamesModal.set(false)">Annuler</button>
                <button type="submit" class="primary-btn">Lancer la partie</button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .lobby-container {
      max-width: 1040px;
      margin: 0 auto;
      padding: 32px 24px 64px;
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
      box-sizing: border-box;
    }

    /* -------- Shared Surface Card -------- */
    .surface-card {
      background: var(--md-surface-container);
      border-radius: var(--md-radius-xl);
      padding: 28px;
      width: 100%;
      box-sizing: border-box;
    }

    /* -------- Animations & Transitions -------- */
    @keyframes slideFadeIn {
      0% { opacity: 0; transform: translateY(14px) scale(0.98); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* -------- Username Card -------- */
    .username-card {
      max-width: 420px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      text-align: center;
      margin-top: 40px;
      animation: slideFadeIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }

    .user-hero {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: var(--md-primary-container);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .hero-icon {
      font-size: 44px;
      color: var(--md-on-primary-container);
    }

    .card-text h2 {
      margin: 0 0 6px;
      font-size: 22px;
      font-weight: 600;
      color: var(--md-on-surface);
    }

    .card-text p {
      margin: 0;
      font-size: 14px;
      color: var(--md-on-surface-variant);
      line-height: 1.6;
    }

    .username-card form {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    /* -------- Inputs -------- */
    input[type="text"] {
      width: 100%;
      box-sizing: border-box;
      background: var(--md-surface-container-high);
      border: 1px solid var(--md-outline-variant);
      color: var(--md-on-surface);
      padding: 14px 16px;
      border-radius: var(--md-radius-md);
      font-size: 14px;
      font-family: 'Inter', sans-serif;
      outline: none;
      transition: border-color 0.15s;
    }

    input[type="text"]:focus {
      border-color: var(--md-primary);
    }

    input[type="text"]::placeholder {
      color: var(--md-outline);
    }

    /* -------- Game Select View -------- */
    .game-select-view {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 24px;
      animation: slideFadeIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }

    .welcome-header h2 {
      margin: 0 0 6px;
      font-size: 26px;
      font-weight: 700;
      color: var(--md-on-surface);
    }

    .welcome-header p {
      margin: 0;
      font-size: 14px;
      color: var(--md-on-surface-variant);
    }

    /* -------- Game Cards Grid -------- */
    .game-selector-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 12px;
    }

    .game-card {
      background: var(--md-surface-container);
      border: 1px solid var(--md-outline-variant);
      border-radius: var(--md-radius-xl);
      padding: 0;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: var(--md-transition-spring);
      text-align: left;
    }

    .game-card:hover {
      background: var(--md-surface-container-high);
      border-color: var(--md-primary);
      transform: translateY(-4px) scale(1.02);
      box-shadow: var(--md-elevation-2);
    }

    .game-card-image {
      width: 100%;
      aspect-ratio: 1;
      overflow: hidden;
      border-radius: var(--md-radius-xl) var(--md-radius-xl) 0 0;
      background: var(--md-surface-container-high);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      box-sizing: border-box;
    }

    .game-card-image svg {
      width: 100%;
      height: 100%;
      display: block;
    }

    .game-card-info {
      padding: 14px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .game-name {
      font-size: 14px;
      font-weight: 600;
      color: var(--md-on-surface);
    }

    .game-tag {
      font-size: 11px;
      font-weight: 500;
      background: var(--md-secondary-container);
      color: var(--md-on-secondary-container);
      padding: 3px 10px;
      border-radius: var(--md-radius-full);
      white-space: nowrap;
    }



    /* -------- Game Lobby View -------- */
    .game-lobby-view {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 20px;
      animation: slideFadeIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }

    .lobby-topbar {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .icon-btn {
      background: var(--md-surface-container-high);
      border: none;
      color: var(--md-on-surface-variant);
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.15s, color 0.15s;
    }

    .icon-btn:hover {
      background: var(--md-surface-container-highest);
      color: var(--md-on-surface);
    }

    .icon-btn .material-symbols {
      font-size: 22px;
    }

    .lobby-title {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      color: var(--md-on-surface);
    }

    .lobby-content-grid {
      display: grid;
      grid-template-columns: 1fr 1.4fr;
      gap: 16px;
      align-items: start;
    }

    /* -------- Card shared -------- */
    .card-title {
      margin: 0 0 4px;
      font-size: 16px;
      font-weight: 600;
      color: var(--md-on-surface);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .card-title .material-symbols {
      font-size: 20px;
      color: var(--md-primary);
    }

    .card-subtitle {
      margin: 0 0 20px;
      font-size: 13px;
      color: var(--md-on-surface-variant);
      line-height: 1.5;
    }

    /* -------- Actions Card -------- */
    .actions-card {
      display: flex;
      flex-direction: column;
    }

    .create-btn {
      width: 100%;
      justify-content: center;
    }

    .divider {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 16px 0;
      color: var(--md-outline);
      font-size: 12px;
    }

    .divider::before, .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--md-outline-variant);
    }

    .join-private {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .input-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 500;
      color: var(--md-on-surface-variant);
    }

    .input-label .material-symbols {
      font-size: 16px;
    }

    .input-row {
      display: flex;
      gap: 8px;
    }

    .input-row input {
      flex: 1;
      padding: 10px 14px;
    }

    /* -------- Rooms Card -------- */
    .rooms-card {
      display: flex;
      flex-direction: column;
    }

    .rooms-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .room-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border-radius: var(--md-radius-lg);
      background: var(--md-surface-container-high);
      transition: background 0.12s;
    }

    .room-item:hover {
      background: var(--md-surface-container-highest);
    }

    .room-code {
      font-family: 'Courier New', monospace;
      font-weight: 700;
      font-size: 13px;
      color: var(--md-primary);
      background: var(--md-primary-container);
      padding: 4px 10px;
      border-radius: var(--md-radius-sm);
      flex-shrink: 0;
    }

    .room-players {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
      color: var(--md-on-surface-variant);
      flex: 1;
    }

    .players-icon {
      font-size: 16px;
    }

    .join-chip {
      background: var(--md-primary);
      color: var(--md-on-primary);
      border: none;
      border-radius: var(--md-radius-full);
      padding: 6px 16px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: filter 0.15s;
    }

    .join-chip:hover {
      filter: brightness(1.1);
    }

    .ongoing-chip {
      font-size: 12px;
      color: var(--md-outline);
      background: var(--md-surface-container-highest);
      padding: 5px 12px;
      border-radius: var(--md-radius-full);
    }

    .empty-rooms {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 40px 20px;
      color: var(--md-outline);
      text-align: center;
    }

    .empty-rooms .material-symbols {
      font-size: 40px;
      color: var(--md-outline-variant);
    }

    .empty-rooms p {
      margin: 0;
      font-size: 14px;
      font-weight: 500;
      color: var(--md-on-surface-variant);
    }

    .empty-rooms span {
      font-size: 12px;
    }

    /* -------- Modal -------- */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      z-index: 1100;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      backdrop-filter: blur(4px);
      animation: modalOverlayFadeIn 0.3s ease-out forwards;
    }

    .modal-card {
      background: var(--md-surface-container-high);
      border-radius: var(--md-radius-xl);
      padding: 28px;
      width: 100%;
      max-width: 460px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      animation: modalZoomIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .modal-header h3 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      color: var(--md-on-surface);
    }

    .modal-desc {
      margin: 0;
      font-size: 14px;
      color: var(--md-on-surface-variant);
    }

    .vis-choices {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .choice-item {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      background: var(--md-surface-container);
      border: 1px solid var(--md-outline-variant);
      border-radius: var(--md-radius-lg);
      padding: 16px;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
    }

    .choice-item:hover {
      background: var(--md-surface-container-highest);
    }

    .choice-item.selected {
      border-color: var(--md-primary);
      background: rgba(208, 188, 255, 0.08);
    }

    .choice-item input {
      display: none;
    }

    .choice-icon {
      font-size: 22px;
      color: var(--md-primary);
      margin-top: 1px;
      flex-shrink: 0;
    }

    .choice-text {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .choice-title {
      font-weight: 600;
      font-size: 14px;
      color: var(--md-on-surface);
    }

    .choice-desc {
      font-size: 12px;
      color: var(--md-on-surface-variant);
      line-height: 1.4;
    }

    .modal-actions {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }

    /* -------- Rules Card -------- */
    .rules-card {
      margin-top: 16px;
      padding: 0;
      overflow: hidden;
      background: var(--md-surface-container-low);
      border: 1px solid var(--md-outline-variant);
      transition: background 0.2s ease;
    }

    .rules-toggle-btn {
      width: 100%;
      background: transparent;
      border: none;
      padding: 20px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      color: var(--md-on-surface);
      font-size: 15px;
      font-weight: 600;
      font-family: 'Inter', sans-serif;
      text-align: left;
    }

    .rules-toggle-btn:hover {
      background: var(--md-surface-container-high);
    }

    .rules-toggle-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .rules-title-icon {
      font-size: 20px;
      color: var(--md-primary);
    }

    .toggle-icon {
      font-size: 22px;
      color: var(--md-outline);
      transition: transform 0.2s ease;
    }

    .rules-content {
      padding: 0 24px 24px;
      border-top: 1px solid var(--md-outline-variant);
      background: var(--md-surface-container);
    }

    .rules-section {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-top: 16px;
    }

    .rules-section h4 {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      color: var(--md-primary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .rules-section p {
      margin: 0;
      font-size: 13px;
      line-height: 1.6;
      color: var(--md-on-surface-variant);
    }

    .rules-section ul {
      margin: 0;
      padding-left: 20px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .rules-section li {
      font-size: 13px;
      line-height: 1.6;
      color: var(--md-on-surface-variant);
    }

    /* -------- Responsive -------- */
    @media (max-width: 768px) {
      .lobby-content-grid {
        grid-template-columns: 1fr;
      }

      .game-selector-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 480px) {
      .lobby-container {
        padding: 16px 16px 64px;
      }

      .game-selector-grid {
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }
    }
  `]
})
export class LobbyComponent {
  tempUsername = '';
  joinCode = '';

  selectedGame;
  showCreateModal = signal<boolean>(false);
  isPrivateChoice = signal<boolean>(false);
  showRules = signal<boolean>(false);

  showLocalNamesModal = signal<boolean>(false);
  localPlayer1Name = '';
  localPlayer2Name = '';

  username;
  roomsList;

  // Stats signals
  tttWins = signal<number>(0);
  tttLosses = signal<number>(0);
  tttDraws = signal<number>(0);

  c4Wins = signal<number>(0);
  c4Losses = signal<number>(0);
  c4Draws = signal<number>(0);

  bsWins = signal<number>(0);
  bsLosses = signal<number>(0);
  bsDraws = signal<number>(0);

  checkersWins = signal<number>(0);
  checkersLosses = signal<number>(0);
  checkersDraws = signal<number>(0);

  chessWins = signal<number>(0);
  chessLosses = signal<number>(0);
  chessDraws = signal<number>(0);

  gomokuWins = signal<number>(0);
  gomokuLosses = signal<number>(0);
  gomokuDraws = signal<number>(0);

  othelloWins = signal<number>(0);
  othelloLosses = signal<number>(0);
  othelloDraws = signal<number>(0);

  filteredRooms = computed(() => {
    return this.roomsList().filter(r => r.gameType === this.selectedGame());
  });

  constructor(private gameService: GameService) {
    this.selectedGame = this.gameService.activeGame;
    this.username = this.gameService.username;
    this.roomsList = this.gameService.roomsList;
    this.tempUsername = this.username();
    this.loadStats();
  }

  saveUsername() {
    if (this.tempUsername.trim()) {
      this.gameService.setUsername(this.tempUsername.trim());
    }
  }

  selectGame(game: 'connect4' | 'battleship' | 'tictactoe' | 'checkers' | 'chess' | 'gomoku' | 'othello' | null) {
    this.selectedGame.set(game);
    this.showRules.set(false);
    this.loadStats();
  }

  toggleRules() {
    this.showRules.set(!this.showRules());
  }

  joinRoom(roomId: string) {
    this.gameService.joinRoom(roomId);
  }

  joinByCode() {
    if (this.joinCode.trim()) {
      this.gameService.joinRoom(this.joinCode.trim().toUpperCase());
      this.joinCode = '';
    }
  }

  openCreateModal() {
    this.isPrivateChoice.set(false);
    this.showCreateModal.set(true);
  }

  closeCreateModal() {
    this.showCreateModal.set(false);
  }

  setPrivateChoice(val: boolean) {
    this.isPrivateChoice.set(val);
  }

  createLocalRoom() {
    this.localPlayer1Name = this.username() || 'Joueur 1';
    this.localPlayer2Name = 'Joueur 2';
    this.showLocalNamesModal.set(true);
  }

  confirmCreateLocalRoom() {
    const game = this.selectedGame();
    if (game) {
      this.gameService.createLocalRoom(game, this.localPlayer1Name, this.localPlayer2Name);
      this.showLocalNamesModal.set(false);
    }
  }

  confirmCreateRoom() {
    const game = this.selectedGame();
    if (game) {
      this.gameService.createRoom(game as any, this.isPrivateChoice());
      this.closeCreateModal();
    }
  }

  loadStats() {
    this.tttWins.set(parseInt(localStorage.getItem('stats_tictactoe_wins') || '0', 10));
    this.tttLosses.set(parseInt(localStorage.getItem('stats_tictactoe_losses') || '0', 10));
    this.tttDraws.set(parseInt(localStorage.getItem('stats_tictactoe_draws') || '0', 10));

    this.c4Wins.set(parseInt(localStorage.getItem('stats_connect4_wins') || '0', 10));
    this.c4Losses.set(parseInt(localStorage.getItem('stats_connect4_losses') || '0', 10));
    this.c4Draws.set(parseInt(localStorage.getItem('stats_connect4_draws') || '0', 10));

    this.bsWins.set(parseInt(localStorage.getItem('stats_battleship_wins') || '0', 10));
    this.bsLosses.set(parseInt(localStorage.getItem('stats_battleship_losses') || '0', 10));
    this.bsDraws.set(parseInt(localStorage.getItem('stats_battleship_draws') || '0', 10));

    this.checkersWins.set(parseInt(localStorage.getItem('stats_checkers_wins') || '0', 10));
    this.checkersLosses.set(parseInt(localStorage.getItem('stats_checkers_losses') || '0', 10));
    this.checkersDraws.set(parseInt(localStorage.getItem('stats_checkers_draws') || '0', 10));

    this.chessWins.set(parseInt(localStorage.getItem('stats_chess_wins') || '0', 10));
    this.chessLosses.set(parseInt(localStorage.getItem('stats_chess_losses') || '0', 10));
    this.chessDraws.set(parseInt(localStorage.getItem('stats_chess_draws') || '0', 10));

    this.gomokuWins.set(parseInt(localStorage.getItem('stats_gomoku_wins') || '0', 10));
    this.gomokuLosses.set(parseInt(localStorage.getItem('stats_gomoku_losses') || '0', 10));
    this.gomokuDraws.set(parseInt(localStorage.getItem('stats_gomoku_draws') || '0', 10));

    this.othelloWins.set(parseInt(localStorage.getItem('stats_othello_wins') || '0', 10));
    this.othelloLosses.set(parseInt(localStorage.getItem('stats_othello_losses') || '0', 10));
    this.othelloDraws.set(parseInt(localStorage.getItem('stats_othello_draws') || '0', 10));
  }
}
