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
            <button type="submit" class="primary-btn">Entrer</button>
          </form>
        </div>
      } @else if (selectedGame() === null) {
        <!-- Step 1: Select Game -->
        <div class="glass-card game-select-card">
          <h2>Bonjour, <strong>{{ username() }}</strong> 👋 !</h2>
          <p>Sélectionnez un jeu pour voir les salons disponibles ou en créer un nouveau.</p>
          
          <div class="game-selector-grid">
            <div class="game-card c4-card" (click)="selectGame('connect4')">
              <div class="game-icon">🔴</div>
              <h3>Puissance 4</h3>
              <span class="game-badge">1v1</span>
            </div>
            
            <div class="game-card bs-card" (click)="selectGame('battleship')">
              <div class="game-icon">🚢</div>
              <h3>Bataille Navale</h3>
              <span class="game-badge">Tactique</span>
            </div>

            <div class="game-card ttt-card" (click)="selectGame('tictactoe')">
              <div class="game-icon">❌</div>
              <h3>Morpion</h3>
              <span class="game-badge">Rapide</span>
            </div>

            <div class="game-card checkers-card" (click)="selectGame('checkers')">
              <div class="game-icon">⚫</div>
              <h3>Jeu de Dames</h3>
              <span class="game-badge">Stratégie</span>
            </div>

            <div class="game-card chess-card" (click)="selectGame('chess')">
              <div class="game-icon">👑</div>
              <h3>Échecs</h3>
              <span class="game-badge">Mental</span>
            </div>
          </div>

          <!-- Local Stats Section -->
          <div class="stats-card">
            <h3>📊 Vos Statistiques (Locales)</h3>
            <div class="stats-grid-container">
              <div class="stat-row">
                <span class="stat-game">🔴 Puissance 4</span>
                <span class="stat-val">🏆 {{ c4Wins() }} V / ☠️ {{ c4Losses() }} D / 🤝 {{ c4Draws() }} N</span>
              </div>
              <div class="stat-row">
                <span class="stat-game">🚢 Bataille Navale</span>
                <span class="stat-val">🏆 {{ bsWins() }} V / ☠️ {{ bsLosses() }} D / 🤝 {{ bsDraws() }} N</span>
              </div>
              <div class="stat-row">
                <span class="stat-game">❌ Morpion</span>
                <span class="stat-val">🏆 {{ tttWins() }} V / ☠️ {{ tttLosses() }} D / 🤝 {{ tttDraws() }} N</span>
              </div>
              <div class="stat-row">
                <span class="stat-game">⚫ Jeu de Dames</span>
                <span class="stat-val">🏆 {{ checkersWins() }} V / ☠️ {{ checkersLosses() }} D / 🤝 {{ checkersDraws() }} N</span>
              </div>
              <div class="stat-row">
                <span class="stat-game">👑 Échecs</span>
                <span class="stat-val">🏆 {{ chessWins() }} V / ☠️ {{ chessLosses() }} D / 🤝 {{ chessDraws() }} N</span>
              </div>
            </div>
          </div>
        </div>
      } @else {
        <!-- Step 2: Game Options (Rooms List, Join Private, Create Game) -->
        <div class="game-lobby-view">
          <div class="lobby-header">
            <button class="back-btn" (click)="selectGame(null)">← Retour aux jeux</button>
            <h2>
              @if (selectedGame() === 'connect4') { 🔴 Puissance 4 } 
              @else if (selectedGame() === 'battleship') { 🚢 Bataille Navale }
              @else if (selectedGame() === 'tictactoe') { ❌ Morpion }
              @else if (selectedGame() === 'checkers') { ⚫ Jeu de Dames }
              @else if (selectedGame() === 'chess') { 👑 Échecs }
            </h2>
          </div>

          <div class="lobby-grid">
            <!-- Actions Card (Create & Private) -->
            <div class="glass-card actions-card">
              <h3>Créer ou Rejoindre</h3>
              <p>Créez un nouveau salon ou rejoignez une partie privée existante.</p>

              <button class="primary-btn create-btn" (click)="openCreateModal()">
                ➕ Créer une partie
              </button>

              <div class="join-private-section">
                <h4>🔑 Rejoindre un salon privé</h4>
                <form (submit)="joinByCode(); $event.preventDefault()">
                  <div class="input-group">
                    <input 
                      type="text" 
                      [(ngModel)]="joinCode" 
                      name="joinCode" 
                      placeholder="Code (ex: AB12YZ)..." 
                      required 
                    />
                    <button type="submit" class="secondary-btn">Rejoindre</button>
                  </div>
                </form>
              </div>
            </div>

            <!-- Public Rooms Table -->
            <div class="glass-card list-card">
              <h3>🌐 Salons publics en attente</h3>
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
                          <span class="empty-icon">🎮</span>
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
                  <span class="choice-title">🌐 Public (par défaut)</span>
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
                  <span class="choice-title">🔒 Privé</span>
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
      padding: 0 20px;
      display: flex;
      justify-content: center;
    }

    .glass-card {
      background: rgba(30, 30, 50, 0.45);
      border: 1px solid rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(12px);
      border-radius: 16px;
      padding: 30px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      color: white;
      transition: all 0.3s ease;
    }

    .username-card {
      width: 100%;
      max-width: 450px;
      text-align: center;
    }

    .username-card h2, .game-select-card h2 {
      margin-top: 0;
      background: linear-gradient(135deg, #a5b4fc, #818cf8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .username-card p, .game-select-card p {
      color: #9ca3af;
      margin-bottom: 25px;
      line-height: 1.5;
    }

    .username-card input, .join-private-section input {
      width: 100%;
      box-sizing: border-box;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 16px;
      margin-bottom: 15px;
      outline: none;
      transition: border-color 0.2s;
    }

    .username-card input:focus, .join-private-section input:focus {
      border-color: #6366f1;
    }

    .primary-btn {
      width: 100%;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      color: white;
      border: none;
      border-radius: 8px;
      padding: 12px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
      transition: all 0.2s ease;
    }

    .primary-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
    }

    .game-select-card {
      width: 100%;
    }

    .game-selector-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }

    .game-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 30px;
      text-align: center;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      transition: all 0.3s ease;
    }

    .game-card:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: #6366f1;
      transform: translateY(-3px);
    }

    .game-icon {
      font-size: 50px;
      margin-bottom: 15px;
    }

    .game-card h3 {
      margin: 0;
      font-size: 20px;
    }

    .game-badge {
      position: absolute;
      top: 15px;
      right: 15px;
      font-size: 12px;
      background: rgba(99, 102, 241, 0.2);
      border: 1px solid rgba(99, 102, 241, 0.4);
      color: #a5b4fc;
      padding: 2px 8px;
      border-radius: 4px;
    }

    /* Game Lobby View */
    .game-lobby-view {
      width: 100%;
    }

    .lobby-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 25px;
    }

    .back-btn {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: white;
      border-radius: 8px;
      padding: 8px 16px;
      cursor: pointer;
      font-size: 14px;
      transition: background 0.2s;
    }

    .back-btn:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .lobby-header h2 {
      margin: 0;
      font-size: 24px;
    }

    .lobby-grid {
      display: grid;
      grid-template-columns: 0.9fr 1.1fr;
      gap: 30px;
      width: 100%;
    }

    .actions-card h3, .list-card h3 {
      margin-top: 0;
      margin-bottom: 8px;
    }

    .actions-card p, .list-card p {
      color: #9ca3af;
      margin-bottom: 25px;
      font-size: 14px;
    }

    .create-btn {
      margin-bottom: 30px;
    }

    .join-private-section h4 {
      margin-top: 0;
      margin-bottom: 12px;
      font-size: 15px;
      color: #cbd5e1;
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
      background: rgba(255, 255, 255, 0.1);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 8px;
      padding: 10px 20px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }

    .secondary-btn:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    /* Table styles */
    .rooms-list-container {
      overflow-x: auto;
    }

    .rooms-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    .rooms-table th {
      padding: 12px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      color: #9ca3af;
      font-weight: 500;
      font-size: 14px;
    }

    .rooms-table td {
      padding: 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      font-size: 15px;
    }

    .code-pill {
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid rgba(99, 102, 241, 0.3);
      color: #a5b4fc;
      padding: 4px 10px;
      border-radius: 6px;
      font-family: monospace;
      font-weight: 600;
    }

    .status-indicator {
      color: #9ca3af;
    }

    .status-indicator.waiting {
      color: #10b981;
    }

    .join-btn {
      background: #10b981;
      border: none;
      color: white;
      border-radius: 6px;
      padding: 6px 14px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }

    .join-btn:hover {
      background: #059669;
    }

    .full-badge {
      font-size: 12px;
      background: rgba(255, 255, 255, 0.08);
      color: #9ca3af;
      padding: 4px 10px;
      border-radius: 6px;
    }

    .empty-row {
      text-align: center;
      padding: 50px 20px !important;
      color: #9ca3af;
    }

    .empty-row .empty-icon {
      font-size: 40px;
      display: block;
      margin-bottom: 10px;
    }

    /* Modal styles */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(5px);
      z-index: 1100;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .modal-card {
      background: #1e1b4b;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 16px;
      padding: 30px;
      width: 90%;
      max-width: 480px;
      color: white;
      box-shadow: 0 20px 50px rgba(0,0,0,0.5);
    }

    .modal-card h3 {
      margin-top: 0;
      margin-bottom: 8px;
      font-size: 20px;
    }

    .modal-card p {
      color: #9ca3af;
      margin-bottom: 24px;
      font-size: 14px;
    }

    .vis-choices {
      display: flex;
      flex-direction: column;
      gap: 15px;
      margin-bottom: 30px;
    }

    .choice-label {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 14px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .choice-label:hover {
      background: rgba(255, 255, 255, 0.06);
    }

    .choice-label.active {
      background: rgba(99, 102, 241, 0.1);
      border-color: #6366f1;
    }

    .choice-label input {
      margin-top: 4px;
      accent-color: #6366f1;
    }

    .choice-text {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .choice-title {
      font-weight: 600;
      font-size: 15px;
    }

    .choice-desc {
      font-size: 12px;
      color: #9ca3af;
      line-height: 1.4;
    }

    .modal-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    .cancel-btn {
      background: none;
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: white;
      border-radius: 8px;
      padding: 12px 24px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }

    .cancel-btn:hover {
      background: rgba(255, 255, 255, 0.08);
    }

    .create-confirm-btn {
      width: auto;
      padding: 12px 24px;
    }

      @media (max-width: 768px) {
        .lobby-grid {
          grid-template-columns: 1fr;
        }
        .game-selector-grid {
          grid-template-columns: 1fr;
        }
      }

      .stats-card {
        margin-top: 30px;
        background: rgba(0, 0, 0, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        padding: 20px;
      }
      .stats-card h3 {
        margin-top: 0;
        margin-bottom: 15px;
        font-size: 16px;
        color: #cbd5e1;
      }
      .stats-grid-container {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .stat-row {
        display: flex;
        justify-content: space-between;
        padding: 8px 12px;
        background: rgba(255, 255, 255, 0.02);
        border-radius: 8px;
        border-left: 3px solid #6366f1;
        font-size: 14px;
      }
      .stat-game {
        font-weight: 500;
      }
      .stat-val {
        color: #cbd5e1;
      }
      .game-selector-grid {
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)) !important;
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
