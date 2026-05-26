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
        <div class="glass-card username-card">
          <span class="material-symbols user-hero-icon">account_circle</span>
          <h2>Prêt à jouer ?</h2>
          <p>Choisissez un pseudonyme pour rejoindre le salon général et défier d'autres joueurs.</p>
          
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
        <div class="glass-card game-select-card">
          <h2>Bonjour, <strong>{{ username() }}</strong> 👋 !</h2>
          <p>Sélectionnez un jeu pour voir les salons disponibles ou en créer un nouveau.</p>
          
          <div class="game-selector-grid">
            <div class="game-card c4-card" (click)="selectGame('connect4')">
              <div class="game-icon-container">
                <span class="material-symbols game-icon">grid_view</span>
              </div>
              <h3>Puissance 4</h3>
              <span class="game-badge">1v1</span>
            </div>
            
            <div class="game-card bs-card" (click)="selectGame('battleship')">
              <div class="game-icon-container">
                <span class="material-symbols game-icon">sailing</span>
              </div>
              <h3>Bataille Navale</h3>
              <span class="game-badge">Tactique</span>
            </div>

            <div class="game-card ttt-card" (click)="selectGame('tictactoe')">
              <div class="game-icon-container">
                <span class="material-symbols game-icon">grid_3x3</span>
              </div>
              <h3>Morpion</h3>
              <span class="game-badge">Rapide</span>
            </div>

            <div class="game-card checkers-card" (click)="selectGame('checkers')">
              <div class="game-icon-container">
                <span class="material-symbols game-icon">circle</span>
              </div>
              <h3>Jeu de Dames</h3>
              <span class="game-badge">Stratégie</span>
            </div>

            <div class="game-card chess-card" (click)="selectGame('chess')">
              <div class="game-icon-container">
                <span class="material-symbols game-icon">workspace_premium</span>
              </div>
              <h3>Échecs</h3>
              <span class="game-badge">Mental</span>
            </div>
          </div>

          <!-- Local Stats Section -->
          <div class="stats-card">
            <h3>
              <span class="material-symbols section-icon">analytics</span>
              Vos Statistiques (Locales)
            </h3>
            <div class="stats-grid-container">
              <div class="stat-row c4-row">
                <span class="stat-game">
                  <span class="material-symbols inline-icon">grid_view</span>
                  Puissance 4
                </span>
                <span class="stat-val">🏆 {{ c4Wins() }} V &nbsp;/&nbsp; ☠️ {{ c4Losses() }} D &nbsp;/&nbsp; 🤝 {{ c4Draws() }} N</span>
              </div>
              <div class="stat-row bs-row">
                <span class="stat-game">
                  <span class="material-symbols inline-icon">sailing</span>
                  Bataille Navale
                </span>
                <span class="stat-val">🏆 {{ bsWins() }} V &nbsp;/&nbsp; ☠️ {{ bsLosses() }} D &nbsp;/&nbsp; 🤝 {{ bsDraws() }} N</span>
              </div>
              <div class="stat-row ttt-row">
                <span class="stat-game">
                  <span class="material-symbols inline-icon">grid_3x3</span>
                  Morpion
                </span>
                <span class="stat-val">🏆 {{ tttWins() }} V &nbsp;/&nbsp; ☠️ {{ tttLosses() }} D &nbsp;/&nbsp; 🤝 {{ tttDraws() }} N</span>
              </div>
              <div class="stat-row checkers-row">
                <span class="stat-game">
                  <span class="material-symbols inline-icon">circle</span>
                  Jeu de Dames
                </span>
                <span class="stat-val">🏆 {{ checkersWins() }} V &nbsp;/&nbsp; ☠️ {{ checkersLosses() }} D &nbsp;/&nbsp; 🤝 {{ checkersDraws() }} N</span>
              </div>
              <div class="stat-row chess-row">
                <span class="stat-game">
                  <span class="material-symbols inline-icon">workspace_premium</span>
                  Échecs
                </span>
                <span class="stat-val">🏆 {{ chessWins() }} V &nbsp;/&nbsp; ☠️ {{ chessLosses() }} D &nbsp;/&nbsp; 🤝 {{ chessDraws() }} N</span>
              </div>
            </div>
          </div>
        </div>
      } @else {
        <!-- Step 2: Game Options (Rooms List, Join Private, Create Game) -->
        <div class="game-lobby-view">
          <div class="lobby-header">
            <button class="back-btn" (click)="selectGame(null)">
              <span class="material-symbols">arrow_back</span>
              <span>Retour</span>
            </button>
            <h2>
              @if (selectedGame() === 'connect4') {
                <span class="material-symbols title-icon c4-color">grid_view</span> Puissance 4
              } @else if (selectedGame() === 'battleship') {
                <span class="material-symbols title-icon bs-color">sailing</span> Bataille Navale
              } @else if (selectedGame() === 'tictactoe') {
                <span class="material-symbols title-icon ttt-color">grid_3x3</span> Morpion
              } @else if (selectedGame() === 'checkers') {
                <span class="material-symbols title-icon checkers-color">circle</span> Jeu de Dames
              } @else if (selectedGame() === 'chess') {
                <span class="material-symbols title-icon chess-color">workspace_premium</span> Échecs
              }
            </h2>
          </div>

          <div class="lobby-grid">
            <!-- Actions Card (Create & Private) -->
            <div class="glass-card actions-card">
              <h3>Créer ou Rejoindre</h3>
              <p>Créez un nouveau salon ou rejoignez une partie privée existante.</p>

              <button class="primary-btn create-btn" (click)="openCreateModal()">
                <span class="material-symbols">add</span>
                <span>Créer une partie</span>
              </button>

              <div class="join-private-section">
                <h4>
                  <span class="material-symbols">vpn_key</span>
                  Rejoindre un salon privé
                </h4>
                <form (submit)="joinByCode(); $event.preventDefault()">
                  <div class="input-group">
                    <input 
                      type="text" 
                      [(ngModel)]="joinCode" 
                      name="joinCode" 
                      placeholder="Code..." 
                      required 
                    />
                    <button type="submit" class="secondary-btn">Rejoindre</button>
                  </div>
                </form>
              </div>
            </div>

            <!-- Public Rooms Table -->
            <div class="glass-card list-card">
              <h3>
                <span class="material-symbols">public</span>
                Salons publics en attente
              </h3>
              <p>Rejoignez une partie publique en attente de joueur.</p>
              
              <div class="rooms-list-container">
                <table class="rooms-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Joueurs</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (room of filteredRooms(); track room.id) {
                      <tr>
                        <td><span class="code-pill">{{ room.id }}</span></td>
                        <td>
                          <span class="status-indicator" [class.waiting]="room.status === 'waiting'">
                            {{ room.playersCount }}/2 Joueurs
                          </span>
                        </td>
                        <td>
                          @if (room.status === 'waiting' && room.playersCount < 2) {
                            <button (click)="joinRoom(room.id)" class="join-btn">Rejoindre</button>
                          } @else {
                            <span class="full-badge">En cours</span>
                          }
                        </td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="3" class="empty-row">
                          <span class="material-symbols empty-icon">sports_esports</span>
                          <p>Aucun salon public disponible pour ce jeu.</p>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Create Room Modal -->
      @if (showCreateModal()) {
        <div class="modal-overlay">
          <div class="modal-card">
            <h3>Configuration de la partie</h3>
            <p>Choisissez la visibilité de votre salon de jeu.</p>
            
            <div class="vis-choices">
              <label class="choice-label" [class.active]="!isPrivateChoice()">
                <input 
                  type="radio" 
                  [value]="false" 
                  [checked]="!isPrivateChoice()"
                  (change)="setPrivateChoice(false)"
                />
                <div class="choice-text">
                  <span class="choice-title">
                    <span class="material-symbols">public</span>
                    Public (par défaut)
                  </span>
                  <span class="choice-desc">Le salon s'affichera dans la liste publique et n'importe qui pourra le rejoindre.</span>
                </div>
              </label>

              <label class="choice-label" [class.active]="isPrivateChoice()">
                <input 
                  type="radio" 
                  [value]="true" 
                  [checked]="isPrivateChoice()"
                  (change)="setPrivateChoice(true)"
                />
                <div class="choice-text">
                  <span class="choice-title">
                    <span class="material-symbols">lock</span>
                    Privé
                  </span>
                  <span class="choice-desc">Le salon n'apparaîtra pas dans la liste. Les joueurs devront saisir le code pour y accéder.</span>
                </div>
              </label>
            </div>

            <div class="modal-actions">
              <button class="cancel-btn" (click)="closeCreateModal()">Annuler</button>
              <button class="primary-btn create-confirm-btn" (click)="confirmCreateRoom()">
                Créer la partie
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .lobby-container {
      max-width: 1000px;
      margin: 40px auto;
      padding: 0 24px;
      display: flex;
      justify-content: center;
      width: 100%;
      box-sizing: border-box;
    }

    .glass-card {
      background: var(--m3-surface);
      border: var(--m3-border);
      backdrop-filter: blur(16px);
      border-radius: var(--m3-radius-large);
      padding: 32px;
      box-shadow: var(--m3-shadow);
      color: #f8fafc;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .username-card {
      width: 100%;
      max-width: 450px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }

    .user-hero-icon {
      font-size: 80px;
      background: linear-gradient(135deg, var(--m3-primary), var(--m3-secondary));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .username-card h2, .game-select-card h2 {
      margin: 0;
      font-size: 26px;
      font-weight: 700;
      background: linear-gradient(135deg, var(--m3-primary), var(--m3-secondary));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .username-card p, .game-select-card p {
      color: #94a3b8;
      margin: 0;
      font-size: 15px;
      line-height: 1.6;
    }

    .username-card form {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 8px;
    }

    .username-card input, .join-private-section input {
      width: 100%;
      box-sizing: border-box;
      background: rgba(0, 0, 0, 0.3);
      border: var(--m3-border);
      color: white;
      padding: 14px 18px;
      border-radius: var(--m3-radius-medium);
      font-size: 15px;
      outline: none;
      transition: all 0.2s;
    }

    .username-card input:focus, .join-private-section input:focus {
      border-color: var(--m3-primary);
      box-shadow: 0 0 0 2px var(--m3-primary-container);
    }

    .primary-btn {
      width: 100%;
      background: linear-gradient(135deg, var(--m3-primary), var(--m3-secondary));
      color: white;
      border: none;
      border-radius: var(--m3-radius-medium);
      padding: 14px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      box-shadow: 0 4px 14px rgba(129, 140, 248, 0.25);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .primary-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(129, 140, 248, 0.4);
    }

    .primary-btn .material-symbols {
      font-size: 20px;
    }

    .game-select-card {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .game-selector-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)) !important;
      gap: 16px;
      width: 100%;
    }

    .game-card {
      background: rgba(255, 255, 255, 0.02);
      border: var(--m3-border);
      border-radius: var(--m3-radius-medium);
      padding: 24px 16px;
      text-align: center;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .game-icon-container {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: var(--m3-primary-container);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s;
    }

    .game-icon {
      font-size: 30px;
      color: var(--m3-primary);
    }

    .c4-card .game-icon-container { background: rgba(99, 102, 241, 0.15); }
    .c4-card .game-icon { color: #818cf8; }

    .bs-card .game-icon-container { background: rgba(192, 132, 252, 0.15); }
    .bs-card .game-icon { color: #c084fc; }

    .ttt-card .game-icon-container { background: rgba(248, 113, 113, 0.15); }
    .ttt-card .game-icon { color: #f87171; }

    .checkers-card .game-icon-container { background: rgba(16, 185, 129, 0.15); }
    .checkers-card .game-icon { color: #10b981; }

    .chess-card .game-icon-container { background: rgba(251, 191, 36, 0.15); }
    .chess-card .game-icon { color: #fbbf24; }

    .game-card:hover {
      background: var(--m3-surface-hover);
      transform: translateY(-4px);
    }
    
    .c4-card:hover { border-color: #818cf8; box-shadow: 0 8px 24px rgba(99, 102, 241, 0.15); }
    .bs-card:hover { border-color: #c084fc; box-shadow: 0 8px 24px rgba(192, 132, 252, 0.15); }
    .ttt-card:hover { border-color: #f87171; box-shadow: 0 8px 24px rgba(248, 113, 113, 0.15); }
    .checkers-card:hover { border-color: #10b981; box-shadow: 0 8px 24px rgba(16, 185, 129, 0.15); }
    .chess-card:hover { border-color: #fbbf24; box-shadow: 0 8px 24px rgba(251, 191, 36, 0.15); }

    .game-card h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #f1f5f9;
    }

    .game-badge {
      position: absolute;
      top: 10px;
      right: 10px;
      font-size: 10px;
      background: rgba(255, 255, 255, 0.05);
      border: var(--m3-border);
      color: #94a3b8;
      padding: 2px 8px;
      border-radius: var(--m3-radius-small);
      font-weight: 500;
    }

    /* Game Lobby View */
    .game-lobby-view {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .lobby-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .back-btn {
      background: var(--m3-surface);
      border: var(--m3-border);
      color: #cbd5e1;
      border-radius: var(--m3-radius-medium);
      padding: 10px 18px;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
    }

    .back-btn:hover {
      background: var(--m3-surface-hover);
      color: white;
    }

    .back-btn .material-symbols {
      font-size: 18px;
    }

    .lobby-header h2 {
      margin: 0;
      font-size: 24px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .title-icon {
      font-size: 28px;
    }

    .c4-color { color: #818cf8; }
    .bs-color { color: #c084fc; }
    .ttt-color { color: #f87171; }
    .checkers-color { color: #10b981; }
    .chess-color { color: #fbbf24; }

    .lobby-grid {
      display: grid;
      grid-template-columns: 1fr 1.2fr;
      gap: 24px;
      width: 100%;
    }

    .actions-card, .list-card {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .actions-card h3, .list-card h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .actions-card h3 .material-symbols, .list-card h3 .material-symbols {
      color: var(--m3-primary);
    }

    .actions-card p, .list-card p {
      color: #94a3b8;
      margin: 0 0 12px 0;
      font-size: 14px;
    }

    .create-btn {
      margin-bottom: 20px;
    }

    .join-private-section {
      border-top: var(--m3-border);
      padding-top: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .join-private-section h4 {
      margin: 0;
      font-size: 15px;
      color: #cbd5e1;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .join-private-section h4 .material-symbols {
      font-size: 18px;
      color: var(--m3-secondary);
    }

    .input-group {
      display: flex;
      gap: 10px;
    }

    .input-group input {
      margin-bottom: 0;
      flex: 1;
    }

    .secondary-btn {
      background: var(--m3-primary-container);
      color: var(--m3-primary);
      border: 1px solid rgba(129, 140, 248, 0.2);
      border-radius: var(--m3-radius-medium);
      padding: 10px 20px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .secondary-btn:hover {
      background: rgba(129, 140, 248, 0.25);
      transform: translateY(-1px);
    }

    /* Table styles */
    .rooms-list-container {
      overflow-x: auto;
      border-radius: var(--m3-radius-medium);
      border: var(--m3-border);
      background: rgba(0, 0, 0, 0.15);
    }

    .rooms-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    .rooms-table th {
      padding: 14px 18px;
      border-bottom: var(--m3-border);
      color: #64748b;
      font-weight: 600;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .rooms-table td {
      padding: 16px 18px;
      border-bottom: var(--m3-border);
      font-size: 14px;
      color: #cbd5e1;
    }

    .code-pill {
      background: var(--m3-primary-container);
      border: 1px solid rgba(129, 140, 248, 0.2);
      color: #cbd5e1;
      padding: 4px 10px;
      border-radius: var(--m3-radius-small);
      font-family: monospace;
      font-weight: 600;
      font-size: 13px;
    }

    .status-indicator {
      color: #94a3b8;
      font-weight: 500;
    }

    .status-indicator.waiting {
      color: #10b981;
    }

    .join-btn {
      background: #10b981;
      border: none;
      color: white;
      border-radius: var(--m3-radius-small);
      padding: 6px 14px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .join-btn:hover {
      background: #059669;
      transform: translateY(-1px);
    }

    .full-badge {
      font-size: 12px;
      background: rgba(255, 255, 255, 0.05);
      color: #64748b;
      padding: 4px 10px;
      border-radius: var(--m3-radius-small);
    }

    .empty-row {
      text-align: center;
      padding: 50px 20px !important;
      color: #64748b;
    }

    .empty-row .empty-icon {
      font-size: 44px;
      display: block;
      margin-bottom: 12px;
      color: #475569;
    }

    /* Modal styles */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(2, 6, 23, 0.8);
      backdrop-filter: blur(8px);
      z-index: 1100;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .modal-card {
      background: #0f172a;
      border: var(--m3-border);
      border-radius: var(--m3-radius-large);
      padding: 32px;
      width: 90%;
      max-width: 480px;
      color: white;
      box-shadow: var(--m3-shadow);
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .modal-card h3 {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      background: linear-gradient(135deg, var(--m3-primary), var(--m3-secondary));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .modal-card p {
      color: #94a3b8;
      margin: 0;
      font-size: 14px;
      line-height: 1.5;
    }

    .vis-choices {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin: 8px 0;
    }

    .choice-label {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      background: rgba(255, 255, 255, 0.02);
      border: var(--m3-border);
      border-radius: var(--m3-radius-medium);
      padding: 16px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .choice-label:hover {
      background: rgba(255, 255, 255, 0.05);
    }

    .choice-label.active {
      background: var(--m3-primary-container);
      border-color: var(--m3-primary);
    }

    .choice-label input {
      margin-top: 4px;
      accent-color: var(--m3-primary);
    }

    .choice-text {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .choice-title {
      font-weight: 600;
      font-size: 15px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .choice-title .material-symbols {
      font-size: 18px;
    }

    .choice-desc {
      font-size: 12px;
      color: #64748b;
      line-height: 1.4;
    }

    .modal-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      margin-top: 8px;
    }

    .cancel-btn {
      background: none;
      border: var(--m3-border);
      color: #cbd5e1;
      border-radius: var(--m3-radius-medium);
      padding: 12px 24px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .cancel-btn:hover {
      background: rgba(255, 255, 255, 0.05);
      color: white;
    }

    .create-confirm-btn {
      width: auto;
      padding: 12px 24px;
    }

    /* Stats Section */
    .stats-card {
      background: rgba(0, 0, 0, 0.25);
      border: var(--m3-border);
      border-radius: var(--m3-radius-medium);
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    
    .stats-card h3 {
      margin: 0;
      font-size: 16px;
      color: #cbd5e1;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .section-icon {
      font-size: 20px;
      color: var(--m3-primary);
    }

    .stats-grid-container {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .stat-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 16px;
      background: rgba(255, 255, 255, 0.01);
      border-radius: var(--m3-radius-medium);
      font-size: 14px;
      border-left: 4px solid #64748b;
      transition: all 0.2s;
    }

    .stat-row:hover {
      background: rgba(255, 255, 255, 0.03);
    }

    .c4-row { border-left-color: #818cf8; }
    .bs-row { border-left-color: #c084fc; }
    .ttt-row { border-left-color: #f87171; }
    .checkers-row { border-left-color: #10b981; }
    .chess-row { border-left-color: #fbbf24; }

    .stat-game {
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .inline-icon {
      font-size: 16px;
    }

    .c4-row .inline-icon { color: #818cf8; }
    .bs-row .inline-icon { color: #c084fc; }
    .ttt-row .inline-icon { color: #f87171; }
    .checkers-row .inline-icon { color: #10b981; }
    .chess-row .inline-icon { color: #fbbf24; }

    .stat-val {
      color: #94a3b8;
      font-weight: 500;
    }

    @media (max-width: 768px) {
      .lobby-grid {
        grid-template-columns: 1fr;
      }
      .game-selector-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class LobbyComponent {
  tempUsername = '';
  joinCode = '';

  selectedGame = signal<'connect4' | 'battleship' | 'tictactoe' | 'checkers' | 'chess' | null>(null);
  showCreateModal = signal<boolean>(false);
  isPrivateChoice = signal<boolean>(false);

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

  filteredRooms = computed(() => {
    return this.roomsList().filter(r => r.gameType === this.selectedGame());
  });

  constructor(private gameService: GameService) {
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

  selectGame(game: 'connect4' | 'battleship' | 'tictactoe' | 'checkers' | 'chess' | null) {
    this.selectedGame.set(game);
    this.loadStats(); // Reload stats when clicking back or switching
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
  }
}
