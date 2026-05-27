import { Component, computed, signal, effect, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameService } from '../../services/game.service';
import { GameLayoutComponent } from '../game-layout/game-layout.component';

@Component({
  selector: 'app-battleship',
  standalone: true,
  imports: [CommonModule, GameLayoutComponent],
  template: `
    <app-game-layout
      gameTitle="Bataille Navale"
      [rules]="[
        'La Bataille Navale se joue sur deux grilles de 10x10.',
        'Sélectionnez un navire, puis cliquez sur la grille pour placer sa prévisualisation.',
        'Cliquez à nouveau sur la case de départ pour poser le navire. Cliquez sur le navire fantôme ou utilisez Espace/R pour pivoter.',
        'Une fois les flottes validées, tirez à tour de rôle sur la grille adverse.',
        '💥 indique un tir réussi, 💧 indique un tir manqué.',
        'Le premier joueur à couler tous les navires adverses gagne !'
      ]"
      [room]="room()"
      [isPlaying]="isPlaying()"
      [isMyTurn]="isMyTurn()"
      [turnAlertText]="localOrOnlineTurnText()"
      [opponentTurnText]="localOrOnlineOpponentTurnText()"
      [turnAlertClass]="room()?.isLocal ? (currentPlayerNum() === 1 ? 'local-turn-red' : 'local-turn-yellow') : ''"
      [winnerLabel]="winnerLabel()"
      [isWinner]="isWinner()"
      [isLoser]="isLoser()"
      [hasVotedRematch]="hasVotedRematch()"
      [disconnectedPlayerName]="disconnectedPlayerName()"
      [player1Name]="player1Name()"
      [player2Name]="player2Name()"
      [player1Active]="currentPlayerNum() === 1 && isPlaying()"
      [player2Active]="currentPlayerNum() === 2 && isPlaying()"
      player1IndicatorSymbol="⚓"
      player2IndicatorSymbol="🎯"
      (leaveRoom)="leaveRoom()"
      (requestRematch)="requestRematch()"
      (sendEmoji)="sendEmoji($event)"
      (forceEnd)="forceEnd()"
      (shareInvitation)="shareInvitationLink()"
    >
      <!-- Setup UI for ship placement -->
      @if (phase() === 'setup' && !myState()?.ready && room()?.status === 'playing') {
        <div game-setup class="glass-card ships-to-place">
          <div class="setup-header">
            <h3>Flotte Tactique</h3>
            <p class="setup-subtitle">Sélectionnez et déployez vos unités</p>
          </div>
          <div class="ships-list">
            @for (ship of myState()?.ships; track ship.id) {
              <button 
                class="ship-place-btn" 
                [class.selected]="selectedShipId() === ship.id"
                [class.placed]="ship.placed"
                (click)="selectShip(ship.id)"
              >
                <div class="ship-btn-info">
                  <span class="ship-name">{{ getShipFrenchName(ship.id) }}</span>
                  <div class="ship-svg-wrapper" [innerHTML]="getShipSvg(ship.id)"></div>
                </div>
                @if (ship.placed) {
                  <span class="placed-badge">✓ DÉPLOYÉ</span>
                } @else if (selectedShipId() === ship.id) {
                  <span class="active-badge">ACTIF</span>
                }
              </button>
            }
          </div>

          <div class="setup-controls">
            <button class="orient-btn" (click)="toggleOrientation()">
              <span class="material-symbols">rotate_right</span>
              <span>Pivoter (Espace / R)</span>
            </button>
            @if (allShipsPlaced()) {
              <button class="ready-btn pulse-glow" (click)="setReady()">LANCER LE COMBAT</button>
            }
          </div>
        </div>
      }

      <div game-board class="boards-wrapper-rel">
        <div class="floating-emojis-container">
          @for (item of floatingEmojis(); track item.id) {
            <span class="floating-emoji">{{ item.emoji }}</span>
          }
        </div>
        
        <div class="boards-container">
          <!-- My Fleet Board (Left / Owner) -->
          <div class="board-column player-fleet">
            <h3>⚓ Mon plateau</h3>
            <div class="board-mesh cyber-grid">
              <div class="sonar-sweep"></div>
              @for (row of [0,1,2,3,4,5,6,7,8,9]; track row) {
                @for (col of [0,1,2,3,4,5,6,7,8,9]; track col) {
                  <div 
                    class="cell" 
                    [class.ship]="myBoard()[row][col] === 'ship'"
                    [class.hit]="myBoard()[row][col] === 'hit'"
                    [class.miss]="myBoard()[row][col] === 'miss'"
                    [class.preview-active]="isInPreview(row, col)"
                    [class.preview-invalid]="isInPreview(row, col) && !isPreviewValid()"
                    [ngClass]="getShipSegmentClass(row, col)"
                    (mouseenter)="cellMouseEnter(row, col)"
                    (click)="cellClickMyBoard(row, col)"
                  >
                    @if (myBoard()[row][col] === 'hit') { <span class="hit-indicator">💥</span> }
                    @if (myBoard()[row][col] === 'miss') { <span class="miss-indicator">💧</span> }
                  </div>
                }
              }
            </div>
          </div>

          <!-- Opponent Firing Board (Right) -->
          @if (phase() === 'playing' || phase() === 'finished') {
            <div class="board-column enemy-radar">
              <h3>🎯 Plateau de {{ opponentName() }}</h3>
              <div class="board-mesh firing-mesh cyber-grid red-radar" [class.disabled]="!isMyTurn()">
                <div class="sonar-sweep"></div>
                @for (row of [0,1,2,3,4,5,6,7,8,9]; track row) {
                  @for (col of [0,1,2,3,4,5,6,7,8,9]; track col) {
                    <div 
                      class="cell target-cell"
                      [class.hit]="opponentBoard()[row][col] === 'hit'"
                      [class.miss]="opponentBoard()[row][col] === 'miss'"
                      (click)="fireShot(row, col)"
                    >
                      @if (opponentBoard()[row][col] === 'hit') { <span class="hit-indicator target-hit">💥</span> }
                      @if (opponentBoard()[row][col] === 'miss') { <span class="miss-indicator target-miss">💧</span> }
                    </div>
                  }
                }
              </div>
            </div>
          }
        </div>
      </div>
    </app-game-layout>

    <!-- Pass Device Overlay -->
    @if (showPassDeviceOverlay()) {
      <div class="pass-device-overlay">
        <div class="pass-card surface-card">
          <span class="material-symbols device-icon">swap_horiz</span>
          <h2>Passez l'appareil</h2>
          <p>C'est au tour de <strong>{{ passToPlayerName() }}</strong>.</p>
          <button class="primary-btn confirm-btn" (click)="passToPlayerNameConfirm()">
            <span>Transférer le commandement</span>
            <span class="material-symbols">arrow_forward</span>
          </button>
        </div>
      </div>
    }
  `,
  styles: [`
    :host ::ng-deep .projected-content-row {
      @media (orientation: landscape) and (min-width: 768px) {
        flex-direction: row !important;
        gap: 32px !important;
        align-items: flex-start !important;
        justify-content: center !important;
      }
    }

    .setup-header {
      margin-bottom: 16px;
      text-align: center;
    }
    .setup-subtitle {
      font-size: 11px;
      color: var(--md-on-surface-variant);
      margin: 2px 0 0 0;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .ships-to-place {
      margin-bottom: 12px;
      padding: 16px;
      max-width: 480px;
      width: 100%;
      box-sizing: border-box;
      background: var(--md-surface-container-high) !important;
      border: 1px solid var(--md-outline-variant);
    }
    .ships-to-place h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: var(--md-primary);
    }
    .ships-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 15px;
    }
    .ship-place-btn {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--md-outline-variant);
      color: var(--md-on-surface);
      border-radius: 12px;
      padding: 10px 16px;
      cursor: pointer;
      transition: all 0.25s ease;
      text-align: left;
      gap: 8px;
      width: 100%;
    }
    .ship-place-btn:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: var(--md-primary);
    }
    .ship-place-btn.selected {
      background: rgba(110, 68, 255, 0.15);
      border-color: var(--md-primary);
      box-shadow: 0 0 10px rgba(110, 68, 255, 0.3);
    }
    .ship-place-btn.placed {
      opacity: 0.5;
      border-color: #10b981;
    }
    .ship-btn-info {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      min-width: 0;
    }
    .ship-name {
      font-size: 13px;
      font-weight: 600;
      flex: 1;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ship-svg-wrapper {
      display: flex;
      align-items: center;
      width: 60px;
      height: 18px;
      color: var(--md-on-surface-variant);
      flex-shrink: 0;
    }
    .ship-place-btn.selected .ship-svg-wrapper {
      color: var(--md-primary);
      filter: drop-shadow(0 0 3px rgba(110, 68, 255, 0.5));
    }
    .placed-badge {
      font-size: 9px;
      font-weight: 700;
      color: #10b981;
      letter-spacing: 0.5px;
      flex-shrink: 0;
      white-space: nowrap;
      background: rgba(16, 185, 129, 0.1);
      padding: 4px 8px;
      border-radius: 6px;
      border: 1px solid rgba(16, 185, 129, 0.2);
    }
    .active-badge {
      font-size: 9px;
      font-weight: 700;
      color: var(--md-primary);
      letter-spacing: 0.5px;
      animation: pulseAlert 1.5s infinite;
      flex-shrink: 0;
      white-space: nowrap;
      background: rgba(110, 68, 255, 0.1);
      padding: 4px 8px;
      border-radius: 6px;
      border: 1px solid rgba(110, 68, 255, 0.2);
    }
    .setup-controls {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .orient-btn {
      background: var(--md-secondary-container);
      color: var(--md-on-secondary-container);
      border: 1px solid var(--md-outline-variant);
      border-radius: 24px;
      padding: 10px 16px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s;
    }
    .orient-btn:hover {
      opacity: 0.9;
    }
    .ready-btn {
      background: #10b981;
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 24px;
      cursor: pointer;
      font-weight: 700;
      font-size: 14px;
      text-align: center;
      transition: all 0.25s;
    }
    .pulse-glow {
      box-shadow: 0 0 15px rgba(16, 185, 129, 0.4);
      animation: pulseGlow 2.0s infinite alternate;
    }

    /* Sonar Grid Styles */
    .boards-container {
      display: flex;
      flex-direction: column;
      gap: 24px;
      align-items: center;
    }
    .board-column {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .board-column h3 {
      font-size: 14px;
      font-weight: 700;
      color: var(--md-on-surface-variant);
      margin-top: 0;
      margin-bottom: 12px;
      letter-spacing: 1.5px;
    }
    .cyber-grid {
      position: relative;
      display: grid;
      grid-template-columns: repeat(10, 32px);
      grid-template-rows: repeat(10, 32px);
      gap: 2px;
      background: radial-gradient(circle at center, #020c1b 0%, #01060f 100%);
      border: 3px solid var(--md-outline-variant);
      border-radius: 12px;
      padding: 6px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
      overflow: hidden;
    }
    .cyber-grid::after {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background-image: 
        linear-gradient(rgba(6, 182, 212, 0.08) 1px, transparent 1px),
        linear-gradient(90deg, rgba(6, 182, 212, 0.08) 1px, transparent 1px);
      background-size: 10% 10%;
      pointer-events: none;
      z-index: 1;
    }
    .red-radar {
      background: radial-gradient(circle at center, #1b0202 0%, #0f0101 100%);
      box-shadow: 0 8px 30px rgba(239, 68, 68, 0.15);
    }
    .red-radar::after {
      background-image: 
        linear-gradient(rgba(239, 68, 68, 0.08) 1px, transparent 1px),
        linear-gradient(90deg, rgba(239, 68, 68, 0.08) 1px, transparent 1px);
    }
    
    .sonar-sweep {
      position: absolute;
      width: 200%;
      height: 200%;
      top: -50%;
      left: -50%;
      background: conic-gradient(from 0deg at 50% 50%, rgba(6, 182, 212, 0.07) 0deg, rgba(6, 182, 212, 0.0) 90deg, transparent 360deg);
      pointer-events: none;
      z-index: 2;
      animation: spinSonar 6s linear infinite;
    }
    .red-radar .sonar-sweep {
      background: conic-gradient(from 0deg at 50% 50%, rgba(239, 68, 68, 0.07) 0deg, rgba(239, 68, 68, 0.0) 90deg, transparent 360deg);
    }

    /* Sonar animation */
    @keyframes spinSonar {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Grid Cells */
    .cell {
      position: relative;
      background: rgba(30, 41, 59, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.03);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 3;
      transition: all 0.15s ease;
      width: 100%;
      height: 100%;
    }

    /* Cyber assets Segmented Ships */
    .ship-part {
      background: linear-gradient(135deg, #475569 0%, #334155 100%) !important;
      border: 1px solid #64748b !important;
      box-shadow: inset 0 1px 3px rgba(255,255,255,0.1);
    }
    
    /* Segment curvatures based on placement orientation */
    .ship-bow-h {
      border-top-left-radius: 12px;
      border-bottom-left-radius: 12px;
      border-left: 2px solid #94a3b8 !important;
    }
    .ship-stern-h {
      border-top-right-radius: 12px;
      border-bottom-right-radius: 12px;
      border-right: 2px solid #94a3b8 !important;
      position: relative;
    }
    .ship-stern-h::after {
      content: '';
      position: absolute;
      right: 2px;
      width: 4px;
      height: 50%;
      background: #1e293b;
      border-radius: 1px;
    }
    .ship-bow-v {
      border-top-left-radius: 12px;
      border-top-right-radius: 12px;
      border-top: 2px solid #94a3b8 !important;
    }
    .ship-stern-v {
      border-bottom-left-radius: 12px;
      border-bottom-right-radius: 12px;
      border-bottom: 2px solid #94a3b8 !important;
    }
    .ship-stern-v::after {
      content: '';
      position: absolute;
      bottom: 2px;
      height: 4px;
      width: 50%;
      background: #1e293b;
      border-radius: 1px;
    }

    /* Hit & Miss */
    .cell.hit {
      background: rgba(239, 68, 68, 0.25) !important;
      border-color: #ef4444 !important;
      animation: hitShake 0.4s ease;
    }
    .cell.miss {
      background: rgba(56, 189, 248, 0.15) !important;
      border-color: #38bdf8 !important;
    }
    .hit-indicator {
      font-size: 16px;
      z-index: 5;
      animation: pulseIndicator 1s infinite alternate;
    }
    .miss-indicator {
      font-size: 14px;
      z-index: 5;
      animation: rippleMiss 1.5s infinite;
    }

    /* Placement preview fantôme */
    .cell.preview-active {
      background: rgba(6, 182, 212, 0.35) !important;
      border: 1px dashed #06b6d4 !important;
      cursor: pointer;
      box-shadow: 0 0 8px rgba(6, 182, 212, 0.4);
    }
    .cell.preview-invalid {
      background: rgba(239, 68, 68, 0.35) !important;
      border: 1px dashed #ef4444 !important;
      box-shadow: 0 0 8px rgba(239, 68, 68, 0.4);
    }

    /* Interactive segments for previews */
    .preview-bow-h { border-top-left-radius: 12px; border-bottom-left-radius: 12px; }
    .preview-stern-h { border-top-right-radius: 12px; border-bottom-right-radius: 12px; }
    .preview-bow-v { border-top-left-radius: 12px; border-top-right-radius: 12px; }
    .preview-stern-v { border-bottom-left-radius: 12px; border-bottom-right-radius: 12px; }

    /* Target grilles */
    .target-cell {
      cursor: pointer;
    }
    .target-cell:hover {
      background: rgba(239, 68, 68, 0.15);
      border-color: rgba(239, 68, 68, 0.5);
      transform: scale(1.05);
    }
    .firing-mesh.disabled .target-cell {
      cursor: not-allowed;
    }
    .firing-mesh.disabled .target-cell:hover {
      background: rgba(30, 41, 59, 0.2);
      border-color: rgba(255, 255, 255, 0.03);
      transform: none;
    }

    @keyframes pulseAlert {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    @keyframes pulseGlow {
      0% { box-shadow: 0 0 5px rgba(16, 185, 129, 0.3); }
      100% { box-shadow: 0 0 20px rgba(16, 185, 129, 0.6); }
    }
    @keyframes hitShake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-4px); }
      75% { transform: translateX(4px); }
    }
    @keyframes pulseIndicator {
      from { transform: scale(1); filter: drop-shadow(0 0 1px red); }
      to { transform: scale(1.2); filter: drop-shadow(0 0 6px red); }
    }
    @keyframes rippleMiss {
      0% { transform: scale(0.9); opacity: 1; }
      100% { transform: scale(1.2); opacity: 0.5; }
    }

    .boards-wrapper-rel {
      position: relative;
      width: 100%;
    }

    .pass-device-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(8px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 99999;
      padding: 24px;
    }
    .pass-card {
      max-width: 420px;
      width: 100%;
      text-align: center;
      padding: 32px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      border-radius: 28px;
      background: var(--md-surface-container-high);
      border: 1px solid var(--md-outline-variant);
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
      color: var(--md-on-surface);
    }
    .device-icon {
      font-size: 64px;
      color: var(--md-primary);
      animation: spinTransfer 3s ease-in-out infinite;
    }

    @keyframes spinTransfer {
      0%, 100% { transform: rotate(0deg); }
      50% { transform: rotate(180deg); }
    }

    @media (max-width: 768px) {
      .cyber-grid {
        grid-template-columns: repeat(10, 28px);
        grid-template-rows: repeat(10, 28px);
      }
    }

    @media (orientation: landscape) and (min-width: 768px) {
      .boards-container {
        flex-direction: row;
        justify-content: center;
        gap: 32px;
        min-height: 0;
        width: 100%;
      }
      .cyber-grid {
        grid-template-columns: repeat(10, min(36px, 4.8vh));
        grid-template-rows: repeat(10, min(36px, 4.8vh));
        gap: 2px;
      }
      .ships-to-place {
        padding: 16px;
        width: 280px;
        flex-shrink: 0;
      }
      .ships-list {
        gap: 6px;
      }
      .ship-place-btn {
        padding: 8px 12px;
      }
    }
  `]
})
export class BattleshipComponent {
  room;
  showRulesModal = signal<boolean>(false);
  isHorizontal = signal<boolean>(true);
  selectedShipId = signal<string | null>(null);

  floatingEmojis = signal<{ id: number; emoji: string }[]>([]);
  private emojiId = 0;

  localActivePlayerId = signal<string>('');
  showPassDeviceOverlay = signal<boolean>(false);
  passToPlayerName = signal<string>('');
  passActionCallback = signal<(() => void) | null>(null);

  previewStart = signal<{ r: number; c: number } | null>(null);

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

    effect(() => {
      const r = this.room();
      if (r) {
        const socketId = this.gameService.getSocketId() || '';
        if (r.isLocal && !this.localActivePlayerId()) {
          this.localActivePlayerId.set(socketId);
        }
      }
    }, { allowSignalWrites: true });

    effect(() => {
      const r = this.room();
      const phase = this.phase();
      const socketId = this.gameService.getSocketId() || '';
      if (r && r.isLocal) {
        if (phase === 'setup' && this.localActivePlayerId() !== socketId) {
          const players = r.gameState?.players || {};
          const allNotReady = Object.values(players).every((p: any) => !p.ready);
          if (allNotReady) {
            this.localActivePlayerId.set(socketId);
            this.showPassDeviceOverlay.set(false);
          }
        }
      }
    }, { allowSignalWrites: true });

    effect(() => {
      const r = this.room();
      if (r?.isLocal && r.status === 'playing' && r.gameState?.phase === 'playing') {
        const turnId = r.gameState.currentPlayerId;
        const currentActive = this.localActivePlayerId();
        if (turnId && currentActive && turnId !== currentActive && !this.showPassDeviceOverlay()) {
          const targetPlayer = r.players.find(p => p.id === turnId);
          this.passToPlayerName.set(targetPlayer?.username || 'Joueur Suivant');
          this.passActionCallback.set(() => {
            this.localActivePlayerId.set(turnId);
            this.showPassDeviceOverlay.set(false);
          });
          this.showPassDeviceOverlay.set(true);
        }
      }
    }, { allowSignalWrites: true });
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    if (this.phase() !== 'setup' || !this.selectedShipId()) return;
    if (event.key === ' ' || event.key === 'r' || event.key === 'R') {
      event.preventDefault();
      this.toggleOrientation();
    }
  }

  localOrOnlineTurnText = computed(() => {
    const r = this.room();
    if (!r) return '';
    if (r.isLocal) {
      if (this.phase() === 'setup') {
        const currentPlayerName = this.localActivePlayerId() === 'local-player-2' ? 'Joueur 2' : this.player1Name();
        return `${currentPlayerName} doit placer ses bateaux`;
      }
      return `Tour de : ${r.gameState?.currentPlayerId === 'local-player-2' ? 'Joueur 2' : this.player1Name()}`;
    }
    if (this.phase() === 'setup') {
      return this.myState()?.ready 
        ? `En attente de l'adversaire (${this.player2Name()})` 
        : `${this.player1Name()} doit placer ses bateaux`;
    }
    return "Système d'armement paré. Sélectionnez une cible radar.";
  });

  localOrOnlineOpponentTurnText = computed(() => {
    const r = this.room();
    if (!r || r.isLocal) return '';
    if (this.phase() === 'setup') {
      return this.myState()?.ready ? "En attente de l'adversaire..." : "Déploiement en cours...";
    }
    return "Alerte : En attente du tir hostile...";
  });

  player1Name = computed(() => this.room()?.players[0]?.username || 'Joueur 1');
  player2Name = computed(() => this.room()?.players[1]?.username || 'En attente...');

  currentPlayerNum = computed(() => {
    const r = this.room();
    if (!r || !r.gameState) return 1;
    if (r.isLocal) {
      return this.localActivePlayerId() === 'local-player-2' ? 2 : 1;
    }
    const socketId = this.gameService.getSocketId();
    const idx = r.players.findIndex(p => p.id === socketId);
    if (idx !== -1) {
      const isMyTurn = this.phase() === 'playing' && r.gameState.currentPlayerId === socketId;
      if (idx === 0) {
        return isMyTurn ? 1 : 2;
      } else {
        return isMyTurn ? 2 : 1;
      }
    }
    return 1;
  });

  winnerLabel = computed(() => {
    const r = this.room();
    if (!r || !r.gameState) return '';
    const winnerId = r.gameState.winnerId;
    if (!winnerId) return '';
    if (r.isLocal) {
      return winnerId === 'local-player-2' ? 'Joueur 2' : this.player1Name();
    }
    const winnerIdx = r.players.findIndex(p => p.id === winnerId);
    return winnerIdx !== -1 ? r.players[winnerIdx].username : '';
  });

  opponentName = computed(() => {
    const num = this.currentPlayerNum();
    return num === 1 ? this.player2Name() : this.player1Name();
  });

  phase = computed(() => this.room()?.gameState?.phase || 'setup');
  isPlaying = computed(() => this.room()?.status === 'playing');

  myState = computed(() => {
    const r = this.room();
    if (!r || !r.gameState) return null;
    const activeId = r.isLocal ? this.localActivePlayerId() : (this.gameService.getSocketId() || '');
    return r.gameState.players[activeId];
  });

  opponentState = computed(() => {
    const r = this.room();
    if (!r || !r.gameState) return null;
    const activeId = r.isLocal ? this.localActivePlayerId() : (this.gameService.getSocketId() || '');
    const oppId = Object.keys(r.gameState.players).find(id => id !== activeId);
    return oppId ? r.gameState.players[oppId] : null;
  });

  myBoard = computed(() => this.myState()?.board || Array(10).fill(null).map(() => Array(10).fill('empty')));
  opponentBoard = computed(() => this.opponentState()?.board || Array(10).fill(null).map(() => Array(10).fill('empty')));

  isMyTurn = computed(() => {
    const r = this.room();
    if (!r || !r.gameState) return false;
    if (this.phase() === 'setup') {
      return !this.myState()?.ready;
    }
    const activeId = r.isLocal ? this.localActivePlayerId() : (this.gameService.getSocketId() || '');
    return this.phase() === 'playing' && r.gameState.currentPlayerId === activeId;
  });

  allShipsPlaced = computed(() => {
    return this.myState()?.ships.every((s: any) => s.placed) || false;
  });

  isWinner = computed(() => {
    const r = this.room();
    if (!r || !r.gameState) return false;
    if (r.isLocal) {
      return r.gameState.winnerId !== null;
    }
    const socketId = this.gameService.getSocketId();
    return r.gameState.winnerId === socketId;
  });

  isLoser = computed(() => {
    const r = this.room();
    if (!r || !r.gameState) return false;
    if (r.isLocal) return false;
    const socketId = this.gameService.getSocketId();
    const winnerId = r.gameState.winnerId;
    return winnerId !== null && winnerId !== socketId;
  });

  toggleOrientation() {
    this.isHorizontal.update(v => !v);
  }

  selectShip(shipId: string) {
    this.selectedShipId.set(shipId);
    this.previewStart.set(null);
  }

  getShipFrenchName(id: string): string {
    const names: { [key: string]: string } = {
      carrier: 'Porte-avions',
      battleship: 'Croiseur',
      cruiser: 'Contre-torpilleur',
      submarine: 'Sous-marin',
      destroyer: 'Torpilleur'
    };
    return names[id] || id;
  }

  getShipSvg(id: string): string {
    const svgs: { [key: string]: string } = {
      carrier: `<svg viewBox="0 0 100 24" style="width:100%; height:100%;" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M5,12 L15,4 L85,4 L95,12 L85,20 L15,20 Z" fill="rgba(255,255,255,0.05)" />
        <rect x="25" y="7" width="50" height="10" fill="rgba(255,255,255,0.15)" stroke="currentColor" stroke-width="1" />
        <line x1="20" y1="12" x2="80" y2="12" stroke="currentColor" stroke-dasharray="2,2" />
      </svg>`,
      battleship: `<svg viewBox="0 0 80 24" style="width:100%; height:100%;" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M5,12 L12,5 L68,5 L75,12 L68,19 L12,19 Z" fill="rgba(255,255,255,0.05)" />
        <circle cx="24" cy="12" r="3" fill="currentColor" />
        <circle cx="56" cy="12" r="3" fill="currentColor" />
      </svg>`,
      cruiser: `<svg viewBox="0 0 60 24" style="width:100%; height:100%;" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M5,12 L10,6 L50,6 L55,12 L50,18 L10,18 Z" fill="rgba(255,255,255,0.05)" />
        <rect x="18" y="9" width="24" height="6" fill="currentColor" />
      </svg>`,
      submarine: `<svg viewBox="0 0 60 24" style="width:100%; height:100%;" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M5,12 C5,7 15,7 25,7 C30,7 35,3 37,3 L39,3 L39,7 C49,7 55,7 55,12 C55,17 49,17 39,17 L39,21 L37,21 L35,17 C25,17 15,17 5,12 Z" fill="rgba(255,255,255,0.05)" />
      </svg>`,
      destroyer: `<svg viewBox="0 0 40 24" style="width:100%; height:100%;" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M5,12 L10,7 L35,7 L35,17 L10,17 Z" fill="rgba(255,255,255,0.05)" />
        <line x1="15" y1="12" x2="30" y2="12" stroke="currentColor" />
      </svg>`
    };
    return svgs[id] || '';
  }

  // Previews coordinates
  previewCells = computed(() => {
    const start = this.previewStart();
    const shipId = this.selectedShipId();
    if (!start || !shipId) return [];
    const ship = this.myState()?.ships.find((s: any) => s.id === shipId);
    if (!ship) return [];
    
    const cells: { r: number; c: number }[] = [];
    for (let i = 0; i < ship.size; i++) {
      const r = this.isHorizontal() ? start.r : start.r + i;
      const c = this.isHorizontal() ? start.c + i : start.c;
      if (r < 10 && c < 10) {
        cells.push({ r, c });
      }
    }
    return cells;
  });

  // Verification if placement fits and doesn't overlap
  isPreviewValid = computed(() => {
    const cells = this.previewCells();
    const shipId = this.selectedShipId();
    if (cells.length === 0 || !shipId) return false;
    
    const ship = this.myState()?.ships.find((s: any) => s.id === shipId);
    if (!ship || cells.length < ship.size) return false;

    // Check overlap with other ALREADY placed ships
    const state = this.myState();
    if (!state) return false;
    
    for (const otherShip of state.ships) {
      if (otherShip.id === shipId || !otherShip.placed) continue;
      
      // Calculate other ship's active cells
      for (let i = 0; i < otherShip.size; i++) {
        const osr = otherShip.horizontal ? otherShip.row : otherShip.row + i;
        const osc = otherShip.horizontal ? otherShip.col + i : otherShip.col;
        if (cells.some(cell => cell.r === osr && cell.c === osc)) {
          return false;
        }
      }
    }
    return true;
  });

  isInPreview(row: number, col: number): boolean {
    return this.previewCells().some(cell => cell.r === row && cell.c === col);
  }

  getShipSegmentClass(r: number, c: number): string {
    const classes: string[] = [];

    // 1. Check actual placed ships
    const state = this.myState();
    if (state) {
      for (const ship of state.ships) {
        if (!ship.placed) continue;
        
        let isPart = false;
        let idx = -1;
        for (let i = 0; i < ship.size; i++) {
          const sr = ship.horizontal ? ship.row : ship.row + i;
          const sc = ship.horizontal ? ship.col + i : ship.col;
          if (sr === r && sc === c) {
            isPart = true;
            idx = i;
            break;
          }
        }

        if (isPart) {
          const isStart = idx === 0;
          const isEnd = idx === ship.size - 1;
          
          let segment = 'body';
          if (isStart) segment = 'bow';
          else if (isEnd) segment = 'stern';
          
          const dir = ship.horizontal ? 'h' : 'v';
          classes.push('ship-part');
          classes.push(`ship-${segment}-${dir}`);
          break;
        }
      }
    }
    
    // 2. Check preview cells
    const cells = this.previewCells();
    const idx = cells.findIndex(cell => cell.r === r && cell.c === c);
    if (idx !== -1) {
      const isStart = idx === 0;
      const isEnd = idx === cells.length - 1;
      const isH = this.isHorizontal();
      let segment = 'body';
      if (isStart) segment = 'bow';
      else if (isEnd) segment = 'stern';
      const dir = isH ? 'h' : 'v';
      classes.push('preview-part');
      classes.push(`preview-${segment}-${dir}`);
    }

    return classes.join(' ');
  }

  cellMouseEnter(row: number, col: number) {
    if (this.phase() !== 'setup' || !this.selectedShipId()) return;
    this.previewStart.set({ r: row, c: col });
  }

  cellClickMyBoard(row: number, col: number) {
    if (this.phase() !== 'setup' || !this.selectedShipId()) return;

    const start = this.previewStart();
    const isInPrev = this.isInPreview(row, col);

    // Touch support / Click mechanics:
    // Case 1: Tapping the start cell confirms (places) the ship
    if (start && start.r === row && start.c === col && isInPrev) {
      if (this.isPreviewValid()) {
        this.gameService.placeBsShip(
          this.selectedShipId()!,
          row,
          col,
          this.isHorizontal(),
          this.room()?.isLocal ? this.localActivePlayerId() : undefined
        );
        this.selectedShipId.set(null);
        this.previewStart.set(null);
      }
    }
    // Case 2: Tapping any OTHER cell inside the preview rotates it
    else if (isInPrev) {
      this.toggleOrientation();
    }
    // Case 3: Tapping outside the preview moves it there
    else {
      this.previewStart.set({ r: row, c: col });
    }
  }

  setReady() {
    const r = this.room();
    if (r?.isLocal) {
      const activeId = this.localActivePlayerId();
      const socketId = this.gameService.getSocketId() || '';
      if (activeId === socketId) {
        this.gameService.setBsReady(activeId);
        const p2 = r.players[1]?.id || 'local-player-2';
        this.passToPlayerName.set(r.players[1]?.username || 'Joueur 2');
        this.passActionCallback.set(() => {
          this.localActivePlayerId.set(p2);
          this.showPassDeviceOverlay.set(false);
          this.selectedShipId.set(null);
          this.previewStart.set(null);
        });
        this.showPassDeviceOverlay.set(true);
      } else {
        this.gameService.setBsReady(activeId);
      }
    } else {
      this.gameService.setBsReady();
    }
  }

  fireShot(row: number, col: number) {
    if (!this.isMyTurn()) return;
    const targetCell = this.opponentBoard()[row][col];
    if (targetCell === 'hit' || targetCell === 'miss') return;

    this.gameService.fireBsShot(row, col, this.room()?.isLocal ? this.localActivePlayerId() : undefined);
  }

  passToPlayerNameConfirm() {
    const callback = this.passActionCallback();
    if (callback) {
      callback();
    }
  }

  leaveRoom() {
    this.gameService.leaveRoom();
  }

  shareInvitationLink() {
    const r = this.room();
    if (r) this.gameService.shareInvitationLink(r);
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
