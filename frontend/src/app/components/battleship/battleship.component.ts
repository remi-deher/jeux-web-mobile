import { Component, computed, signal, effect } from '@angular/core';
import { GameService } from '../../services/game.service';

@Component({
  selector: 'app-battleship',
  standalone: true,
  template: `
    <div class="bs-container">
      @if (room()) {
        <!-- Header -->
        <div class="bs-header">
          <button class="back-btn" (click)="leaveRoom()">
            <span class="material-symbols">arrow_back</span>
            <span>Quitter</span>
          </button>
          <div class="room-badge">Code salon : <strong>{{ room()?.id }}</strong></div>
        </div>

        <!-- Status Panel -->
        <div class="status-panel glass-card">
          <h2>Bataille Navale</h2>
          
          <div class="phase-indicator">
            @if (phase() === 'setup') {
              <div class="badge setup-badge">Phase de placement</div>
            } @else if (phase() === 'playing') {
              <div class="badge playing-badge">Combat en cours</div>
            } @else {
              <div class="badge finished-badge">Partie terminée</div>
            }
          </div>

          @if (hasDisconnectedPlayer()) {
            <div class="disconnect-banner">
              <span>⚠️ {{ disconnectedPlayerName() }} s'est déconnecté. En attente de reconnexion...</span>
              @if (!amIDisconnected()) {
                <button class="force-end-btn" (click)="forceEnd()">Forcer la fin (Gagner)</button>
              }
            </div>
          }

          <div class="status-message">
            @if (room()?.status === 'waiting') {
              <div class="pulse-text">En attente d'un adversaire...</div>
            } @else if (phase() === 'setup') {
              @if (myState()?.ready) {
                <div class="pulse-text">Prêt ! En attente du placement de l'adversaire...</div>
              } @else {
                <div class="setup-instructions">
                  Placez votre flotte de 5 navires. Cliquez sur une case pour poser, utilisez le bouton d'orientation.
                  <button class="orient-btn" (click)="toggleOrientation()">
                    <span class="material-symbols">sync_alt</span>
                    <span>Orientation : {{ isHorizontal() ? 'Horizontal' : 'Vertical' }}</span>
                  </button>
                </div>
              }
            } @else if (phase() === 'playing') {
              @if (isMyTurn()) {
                <div class="turn-alert my-turn">C'est votre tour de tirer ! Sélectionnez une case chez l'adversaire.</div>
              } @else {
                <div class="turn-alert opponent-turn">En attente du tir adverse...</div>
              }
            } @else if (phase() === 'finished') {
              <div class="win-banner" [class.victory]="isWinner()" [class.defeat]="isLoser()">
                @if (isWinner()) {
                  🏆 Victoire ! Vous avez détruit tous les navires adverses !
                } @else {
                  ☠️ Défaite... L'adversaire a anéanti votre flotte.
                }
              </div>
              <div class="rematch-section">
                @if (hasVotedRematch()) {
                  <div class="rematch-status">Demande de revanche envoyée... En attente de l'adversaire.</div>
                } @else {
                  <button class="primary-btn rematch-btn" (click)="requestRematch()">
                    <span class="material-symbols">replay</span>
                    <span>Rejouer / Demander Revanche</span>
                  </button>
                }
              </div>
            }
          </div>
        </div>

        <div class="game-grids">
          <!-- Setup Panel: Ships list to place -->
          @if (phase() === 'setup' && !myState()?.ready && room()?.status === 'playing') {
            <div class="glass-card ships-to-place">
              <h3>Sélectionnez un navire</h3>
              <div class="ships-list">
                @for (ship of myState()?.ships; track ship.id) {
                  <button 
                    class="ship-place-btn" 
                    [class.selected]="selectedShipId() === ship.id"
                    [class.placed]="ship.placed"
                    (click)="selectShip(ship.id)"
                  >
                    <span class="ship-name">{{ getShipFrenchName(ship.id) }}</span>
                    <span class="ship-size-dots">
                      @for (dot of [].constructor(ship.size); track $index) {
                        <span class="dot"></span>
                      }
                    </span>
                    @if (ship.placed) {
                      <span class="placed-check">✓ Posé</span>
                    }
                  </button>
                }
              </div>

              @if (allShipsPlaced()) {
                <button class="ready-btn" (click)="setReady()">Valider ma flotte et démarrer</button>
              }
            </div>
          }

          <!-- Emoji Bar (Floating Interactions) -->
          @if (isPlaying()) {
            <div class="emoji-bar glass-card">
              <span class="bar-title">Réagir :</span>
              <button (click)="sendEmoji('😂')">😂</button>
              <button (click)="sendEmoji('😢')">😢</button>
              <button (click)="sendEmoji('👍')">👍</button>
              <button (click)="sendEmoji('🔥')">🔥</button>
              <button (click)="sendEmoji('🎉')">🎉</button>
            </div>
          }

          <!-- Playing/Finished Boards -->
          @if (room()?.status === 'playing' || room()?.status === 'finished') {
            <div class="boards-wrapper-rel">
              <div class="floating-emojis-container">
                @for (item of floatingEmojis(); track item.id) {
                  <span class="floating-emoji">{{ item.emoji }}</span>
                }
              </div>
              <div class="boards-container">
              <!-- My Fleet Board (Left) -->
              <div class="board-column">
                <h3>⚓ Ma Flotte</h3>
                <div class="board-mesh">
                  @for (row of [0,1,2,3,4,5,6,7,8,9]; track row) {
                    @for (col of [0,1,2,3,4,5,6,7,8,9]; track col) {
                      <div 
                        class="cell" 
                        [class.ship]="myBoard()[row][col] === 'ship'"
                        [class.hit]="myBoard()[row][col] === 'hit'"
                        [class.miss]="myBoard()[row][col] === 'miss'"
                        [class.placement-preview]="isPlacementPreview(row, col)"
                        (click)="cellClickMyBoard(row, col)"
                      >
                        @if (myBoard()[row][col] === 'hit') { 💥 }
                        @if (myBoard()[row][col] === 'miss') { 💧 }
                      </div>
                    }
                  }
                </div>
              </div>

              <!-- Opponent Firing Board (Right) -->
              @if (phase() === 'playing' || phase() === 'finished') {
                <div class="board-column">
                  <h3>🎯 Plan de Tir (Cible)</h3>
                  <div class="board-mesh firing-mesh" [class.disabled]="!isMyTurn()">
                    @for (row of [0,1,2,3,4,5,6,7,8,9]; track row) {
                      @for (col of [0,1,2,3,4,5,6,7,8,9]; track col) {
                        <div 
                          class="cell target-cell"
                          [class.hit]="opponentBoard()[row][col] === 'hit'"
                          [class.miss]="opponentBoard()[row][col] === 'miss'"
                          (click)="fireShot(row, col)"
                        >
                          @if (opponentBoard()[row][col] === 'hit') { 💥 }
                          @if (opponentBoard()[row][col] === 'miss') { 💧 }
                        </div>
                      }
                    }
                </div>
              </div>
            }
            </div>
          </div>
        }
      </div>
    }
  </div>
  `,
  styles: [`
    .bs-container {
      max-width: 1000px;
      margin: 20px auto;
      padding: 0 20px;
    }

    .bs-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .back-btn {
      background: var(--md-secondary-container);
      border: 1px solid var(--md-outline-variant);
      color: var(--md-on-secondary-container);
      border-radius: var(--md-radius-full);
      padding: 8px 16px;
      cursor: pointer;
      font-size: 14px;
      font-family: 'Inter', sans-serif;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
    }

    .back-btn:hover {
      opacity: 0.85;
    }

    .back-btn .material-symbols {
      font-size: 18px;
    }

    .room-badge {
      background: var(--md-surface-container);
      border: 1px solid var(--md-outline-variant);
      color: var(--md-on-surface-variant);
      padding: 8px 16px;
      border-radius: var(--md-radius-full);
      font-size: 14px;
    }

    .glass-card {
      background: var(--md-surface-container);
      border: 1px solid var(--md-outline-variant);
      border-radius: var(--md-radius-xl);
      padding: 25px;
      color: var(--md-on-surface);
      margin-bottom: 30px;
    }

    .status-panel h2 {
      margin-top: 0;
      text-align: center;
      font-size: 26px;
      color: var(--md-on-surface);
      font-weight: 700;
      font-family: 'Inter', sans-serif;
    }

    .phase-indicator {
      display: flex;
      justify-content: center;
      margin-bottom: 15px;
    }

    .badge {
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
    }

    .setup-badge {
      background: rgba(245, 158, 11, 0.2);
      color: #f59e0b;
      border: 1px solid rgba(245, 158, 11, 0.4);
    }

    .playing-badge {
      background: rgba(16, 185, 129, 0.2);
      color: #10b981;
      border: 1px solid rgba(16, 185, 129, 0.4);
    }

    .finished-badge {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.4);
    }

    .status-message {
      text-align: center;
      font-size: 15px;
      color: #e2e8f0;
    }

    .setup-instructions {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 15px;
      line-height: 1.5;
    }

    .orient-btn {
      background: var(--md-secondary-container);
      color: var(--md-on-secondary-container);
      border: 1px solid var(--md-outline-variant);
      border-radius: var(--md-radius-full);
      padding: 8px 16px;
      font-weight: 500;
      font-family: 'Inter', sans-serif;
      cursor: pointer;
      transition: opacity 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .orient-btn:hover {
      opacity: 0.85;
    }

    .turn-alert {
      padding: 10px;
      border-radius: 8px;
      font-weight: 500;
    }

    .my-turn {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .opponent-turn {
      background: rgba(255, 255, 255, 0.05);
      color: #9ca3af;
    }

    .win-banner {
      padding: 12px 24px;
      border-radius: var(--md-radius-lg);
      font-weight: 700;
      font-size: 18px;
    }

    .win-banner.victory {
      background: var(--md-surface-container-high);
      color: #10b981;
      border: 1px solid var(--md-outline-variant);
    }

    .win-banner.defeat {
      background: var(--md-surface-container-high);
      color: #ef4444;
      border: 1px solid var(--md-outline-variant);
    }

    /* Ship Placement Area */
    .ships-to-place {
      margin-bottom: 30px;
    }

    .ships-to-place h3 {
      margin-top: 0;
      margin-bottom: 15px;
      color: #cbd5e1;
    }

    .ships-list {
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
      margin-bottom: 20px;
    }

    .ship-place-btn {
      flex: 1;
      min-width: 140px;
      background: var(--md-surface-container-high);
      border: 1px solid var(--md-outline-variant);
      border-radius: var(--md-radius-lg);
      padding: 12px;
      color: var(--md-on-surface);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: center;
      transition: all 0.2s;
    }

    .ship-place-btn:hover {
      opacity: 0.85;
    }

    .ship-place-btn.selected {
      background: var(--md-surface-container);
      border-color: var(--md-primary);
    }

    .ship-place-btn.placed {
      opacity: 0.6;
      border-color: #10b981;
    }

    .ship-name {
      font-weight: 500;
      font-size: 13px;
    }

    .ship-size-dots {
      display: flex;
      gap: 4px;
    }

    .dot {
      width: 8px;
      height: 8px;
      background: #9ca3af;
      border-radius: 50%;
    }

    .ship-place-btn.selected .dot {
      background: #a5b4fc;
    }

    .placed-check {
      font-size: 11px;
      color: #10b981;
    }

    .ready-btn {
      background: var(--md-primary);
      color: var(--md-on-primary);
      border: none;
      border-radius: var(--md-radius-full);
      padding: 12px 24px;
      font-weight: 600;
      font-size: 16px;
      font-family: 'Inter', sans-serif;
      cursor: pointer;
      width: 100%;
      transition: opacity 0.2s;
    }

    .ready-btn:hover {
      opacity: 0.88;
    }

    /* Grid layout */
    .boards-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
    }

    .board-column {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .board-column h3 {
      margin-top: 0;
      margin-bottom: 15px;
      color: #a5b4fc;
    }

    .board-mesh {
      display: grid;
      grid-template-columns: repeat(10, 32px);
      grid-template-rows: repeat(10, 32px);
      gap: 3px;
      background: #0f172a;
      border: 4px solid #1e293b;
      border-radius: 8px;
      padding: 5px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.4);
    }

    .cell {
      background: #1e293b;
      border-radius: 3px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: default;
      font-size: 12px;
      transition: all 0.15s;
    }

    /* Ship placement cells */
    .cell.ship {
      background: #475569;
      border: 1px solid #64748b;
    }

    .cell.hit {
      background: rgba(239, 68, 68, 0.2);
      border: 1px solid #ef4444;
      color: #ef4444;
    }

    .cell.miss {
      background: rgba(59, 130, 246, 0.15);
      border: 1px solid #3b82f6;
    }

    /* Preview style when hover placing */
    .cell.placement-preview {
      background: rgba(99, 102, 241, 0.4) !important;
      border: 1px dashed #6366f1;
      cursor: pointer;
    }

    /* Target board cells */
    .target-cell {
      cursor: pointer;
    }

    .target-cell:hover {
      background: rgba(255, 255, 255, 0.08);
      transform: scale(1.05);
    }

    .firing-mesh.disabled .target-cell {
      cursor: not-allowed;
    }

    .firing-mesh.disabled .target-cell:hover {
      background: #1e293b;
      transform: none;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }

    @media (max-width: 768px) {
      .boards-container {
        grid-template-columns: 1fr;
        gap: 30px;
      }
      .board-mesh {
        grid-template-columns: repeat(10, 28px);
        grid-template-rows: repeat(10, 28px);
      }
    }

    .disconnect-banner {
      background: rgba(239, 68, 68, 0.2);
      border: 1px solid #ef4444;
      color: #fc8181;
      padding: 12px 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 500;
      font-size: 14px;
    }
    .force-end-btn {
      background: #ef4444;
      border: none;
      color: white;
      padding: 6px 12px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      font-size: 13px;
      transition: background 0.2s;
    }
    .force-end-btn:hover {
      background: #dc2626;
    }
    .rematch-section {
      margin-top: 15px;
    }
    .rematch-btn {
      width: auto;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 18px;
      font-size: 14px;
      background: var(--md-primary);
      color: var(--md-on-primary);
      border: none;
      border-radius: var(--md-radius-full);
      cursor: pointer;
      font-family: 'Inter', sans-serif;
      font-weight: 600;
      transition: opacity 0.2s;
    }
    .rematch-btn:hover {
      opacity: 0.88;
    }
    .rematch-status {
      font-size: 14px;
      color: var(--md-on-surface-variant);
      font-style: italic;
    }

    /* Emoji Bar and Floating animations */
    .boards-wrapper-rel {
      position: relative;
      width: 100%;
    }
    .emoji-bar {
      display: flex;
      gap: 12px;
      align-items: center;
      justify-content: center;
      padding: 10px;
    }
    .bar-title {
      font-size: 13px;
      color: #cbd5e1;
      font-weight: 500;
    }
    .emoji-bar button {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      font-size: 20px;
      cursor: pointer;
      padding: 6px 12px;
      border-radius: 8px;
      transition: all 0.2s;
    }
    .emoji-bar button:hover {
      background: rgba(255, 255, 255, 0.15);
      transform: scale(1.15);
    }
    .floating-emojis-container {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      z-index: 10;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .floating-emoji {
      position: absolute;
      font-size: 64px;
      animation: floatEmoji 2.0s ease-in-out forwards;
    }
    @keyframes floatEmoji {
      0% {
        transform: translateY(100px) scale(0.5);
        opacity: 0;
      }
      20% {
        transform: translateY(0) scale(1.2);
        opacity: 1;
      }
      80% {
        transform: translateY(-80px) scale(1.0);
        opacity: 1;
      }
      100% {
        transform: translateY(-150px) scale(0.6);
        opacity: 0;
      }
    }
  `]
})
export class BattleshipComponent {
  room;
  isHorizontal = signal<boolean>(true);
  selectedShipId = signal<string | null>(null);

  floatingEmojis = signal<{ id: number; emoji: string }[]>([]);
  private emojiId = 0;

  hasDisconnectedPlayer = computed(() => this.room()?.players.some(p => p.disconnected) || false);
  
  disconnectedPlayerName = computed(() => {
    const p = this.room()?.players.find(p => p.disconnected);
    return p ? p.username : '';
  });

  amIDisconnected = computed(() => {
    const socketId = this.gameService.getSocketId();
    const p = this.room()?.players.find(p => p.id === socketId);
    return p ? !!p.disconnected : false;
  });

  hasVotedRematch = computed(() => {
    const votes = this.room()?.rematchVotes || [];
    const socketId = this.gameService.getSocketId();
    return socketId ? votes.includes(socketId) : false;
  });

  constructor(private gameService: GameService) {
    this.room = this.gameService.currentRoom;

    effect(() => {
      const rx = this.gameService.emojiReaction();
      if (rx) {
        this.spawnFloatingEmoji(rx.emoji);
      }
    }, { allowSignalWrites: true });

    effect(() => {
      const status = this.room()?.status;
      if (status === 'finished') {
        this.saveStatsLocally();
      }
    });
  }

  phase = computed(() => this.room()?.gameState?.phase || 'setup');
  isPlaying = computed(() => this.room()?.status === 'playing');

  myState = computed(() => {
    const socketId = this.gameService.getSocketId();
    return this.room()?.gameState?.players[socketId || ''];
  });

  opponentState = computed(() => {
    const socketId = this.gameService.getSocketId();
    const players = this.room()?.gameState?.players || {};
    const oppId = Object.keys(players).find(id => id !== socketId);
    return oppId ? players[oppId] : null;
  });

  myBoard = computed(() => this.myState()?.board || Array(10).fill(null).map(() => Array(10).fill('empty')));
  opponentBoard = computed(() => this.opponentState()?.board || Array(10).fill(null).map(() => Array(10).fill('empty')));

  isMyTurn = computed(() => {
    const socketId = this.gameService.getSocketId();
    return this.phase() === 'playing' && this.room()?.gameState?.currentPlayerId === socketId;
  });

  allShipsPlaced = computed(() => {
    return this.myState()?.ships.every((s: any) => s.placed) || false;
  });

  isWinner = computed(() => {
    const socketId = this.gameService.getSocketId();
    return this.room()?.gameState?.winnerId === socketId;
  });

  isLoser = computed(() => {
    const socketId = this.gameService.getSocketId();
    const winnerId = this.room()?.gameState?.winnerId;
    return winnerId !== null && winnerId !== socketId;
  });

  toggleOrientation() {
    this.isHorizontal.update(v => !v);
  }

  selectShip(shipId: string) {
    const ship = this.myState()?.ships.find((s: any) => s.id === shipId);
    if (ship && !ship.placed) {
      this.selectedShipId.set(shipId);
    } else {
      // Re-place already placed ship is fine
      this.selectedShipId.set(shipId);
    }
  }

  getShipFrenchName(id: string): string {
    const names: { [key: string]: string } = {
      carrier: 'Porte-avions (5)',
      battleship: 'Croiseur (4)',
      cruiser: 'Contre-torpilleur (3)',
      submarine: 'Sous-marin (3)',
      destroyer: 'Torpilleur (2)'
    };
    return names[id] || id;
  }

  // Preview highlighting on hover (simplified: we handle preview on cell hover by setting custom preview classes)
  // Let's implement preview checking
  isPlacementPreview(row: number, col: number): boolean {
    if (this.phase() !== 'setup' || !this.selectedShipId()) return false;
    const ship = this.myState()?.ships.find((s: any) => s.id === this.selectedShipId());
    if (!ship) return false;

    // Standard check if cell falls under ship size based on starting preview
    // For simplicity, we trigger placing on click, so we don't strictly need complex reactive hover states,
    // but we can offer simple visual cues if needed. Let's make it clickable.
    return false;
  }

  cellClickMyBoard(row: number, col: number) {
    if (this.phase() !== 'setup' || !this.selectedShipId()) return;

    this.gameService.placeBsShip(
      this.selectedShipId()!,
      row,
      col,
      this.isHorizontal()
    );
  }

  setReady() {
    this.gameService.setBsReady();
  }

  fireShot(row: number, col: number) {
    if (!this.isMyTurn()) return;
    const targetCell = this.opponentBoard()[row][col];
    if (targetCell === 'hit' || targetCell === 'miss') return;

    this.gameService.fireBsShot(row, col);
  }

  leaveRoom() {
    this.gameService.leaveRoom();
  }

  spawnFloatingEmoji(emoji: string) {
    const id = this.emojiId++;
    this.floatingEmojis.update((list: { id: number; emoji: string }[]) => [...list, { id, emoji }]);
    setTimeout(() => {
      this.floatingEmojis.update((list: { id: number; emoji: string }[]) => list.filter((item: { id: number; emoji: string }) => item.id !== id));
    }, 2000);
  }

  sendEmoji(emoji: string) {
    this.gameService.sendEmoji(emoji);
    this.spawnFloatingEmoji(emoji);
  }

  requestRematch() {
    this.gameService.requestRematch();
  }

  forceEnd() {
    this.gameService.forceEnd();
  }

  private saveStatsLocally() {
    const r = this.room();
    if (!r) return;
    const winnerId = r.gameState?.winnerId;
    const socketId = this.gameService.getSocketId();
    if (!winnerId || !socketId) return;

    const storageKey = `bs_recorded_${r.id}`;
    if (localStorage.getItem(storageKey)) return;

    const gameKey = 'battleship';
    if (winnerId === socketId) {
      this.incrementLocalStat(gameKey, 'wins');
    } else {
      this.incrementLocalStat(gameKey, 'losses');
    }

    localStorage.setItem(storageKey, 'true');
  }

  private incrementLocalStat(game: string, statType: 'wins' | 'losses' | 'draws') {
    const key = `stats_${game}_${statType}`;
    const current = parseInt(localStorage.getItem(key) || '0', 10);
    localStorage.setItem(key, (current + 1).toString());
  }
}
