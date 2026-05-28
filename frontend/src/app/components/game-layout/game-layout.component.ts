import { Component, Input, Output, EventEmitter, signal, inject } from '@angular/core';
import { GameHelpersService } from '../../services/game-helpers.service';

@Component({
  selector: 'app-game-layout',
  standalone: true,
  template: `
    <div class="layout-container">
      <!-- Header -->
      <div class="game-header">
        <div class="header-left">
          <button class="back-btn" (click)="onLeaveRoom()">
            <span class="material-symbols">arrow_back</span>
            <span>Quitter</span>
          </button>
          <h1 class="game-title-desktop">{{ gameTitle }}</h1>
          <button class="help-btn" (click)="gameHelpersService.toggleSound()" [title]="gameHelpersService.soundEnabled() ? 'Couper le son' : 'Activer le son'">
            <span class="material-symbols">
              {{ gameHelpersService.soundEnabled() ? 'volume_up' : 'volume_off' }}
            </span>
          </button>
          <button class="rules-btn" (click)="showRulesModal.set(true)" title="Voir les règles du jeu">
            <span class="material-symbols">menu_book</span>
            <span class="rules-btn-label">Règles</span>
          </button>
          <button class="help-btn" (click)="toggleFullscreen()" [title]="isFullscreen() ? 'Quitter le plein écran' : 'Plein écran'">
            <span class="material-symbols">
              {{ isFullscreen() ? 'fullscreen_exit' : 'fullscreen' }}
            </span>
          </button>
        </div>
        
        <!-- PC Landscape Players Display -->
        @if (isPlaying && room?.status !== 'waiting') {
          <div class="header-players-pc">
            <div class="player-slot" [class.active]="player1Active">
              @if (player1IndicatorClass) {
                <span class="indicator-element" [class]="player1IndicatorClass">
                  {{ player1IndicatorSymbol }}
                </span>
              } @else if (player1IndicatorSymbol) {
                <span class="indicator-symbol">{{ player1IndicatorSymbol }}</span>
              }
              <span class="player-name">{{ player1Name }}</span>
            </div>
            <div class="vs-divider">VS</div>
            <div class="player-slot" [class.active]="player2Active">
              @if (player2IndicatorClass) {
                <span class="indicator-element" [class]="player2IndicatorClass">
                  {{ player2IndicatorSymbol }}
                </span>
              } @else if (player2IndicatorSymbol) {
                <span class="indicator-symbol">{{ player2IndicatorSymbol }}</span>
              }
              <span class="player-name">{{ player2Name }}</span>
            </div>
          </div>
        }

        <!-- Room code badge -->
        <div class="room-badge"><span class="room-label">Code : </span><strong>{{ room?.id }}</strong></div>
      </div>

      <!-- Main Layout Body -->
      <div class="game-layout-body">
        
        <!-- Mobile Status Panel (hidden on PC landscape) -->
        <div class="status-panel glass-card mobile-status-panel" [class.collapsed]="isStatusCollapsed()">
          <div class="status-panel-header" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <h2 style="margin: 0; font-size: 15px;">{{ gameTitle }}</h2>
            @if (room?.status !== 'waiting') {
              <button class="help-btn toggle-status-btn" (click)="toggleStatusCollapse()" [title]="isStatusCollapsed() ? 'Afficher les détails' : 'Masquer les détails'" style="padding: 2px;">
                <span class="material-symbols" style="font-size: 20px;">
                  {{ isStatusCollapsed() ? 'keyboard_arrow_down' : 'keyboard_arrow_up' }}
                </span>
              </button>
            }
          </div>
          
          @if (!isStatusCollapsed() || room?.status === 'waiting') {
            @if (room?.status !== 'waiting') {
              <div class="players-display">
                <div class="player-slot" [class.active]="player1Active">
                  @if (player1IndicatorClass) {
                    <span class="indicator-element" [class]="player1IndicatorClass">
                      {{ player1IndicatorSymbol }}
                    </span>
                  } @else if (player1IndicatorSymbol) {
                    <span class="indicator-symbol">{{ player1IndicatorSymbol }}</span>
                  }
                  <div class="player-info">
                    <span class="player-name">{{ player1Name }}</span>
                    <span class="player-label">Joueur 1</span>
                  </div>
                </div>
                
                <div class="vs-divider">VS</div>
                
                <div class="player-slot" [class.active]="player2Active">
                  @if (player2IndicatorClass) {
                    <span class="indicator-element" [class]="player2IndicatorClass">
                      {{ player2IndicatorSymbol }}
                    </span>
                  } @else if (player2IndicatorSymbol) {
                    <span class="indicator-symbol">{{ player2IndicatorSymbol }}</span>
                  }
                  <div class="player-info">
                    <span class="player-name">{{ player2Name }}</span>
                    <span class="player-label">Joueur 2</span>
                  </div>
                </div>
              </div>
            }
          }

          @if (disconnectedPlayerName) {
            <div class="disconnect-banner">
              <span style="display: inline-flex; align-items: center; gap: 6px;"><span class="material-symbols" style="font-size: 20px; color: #fc8181;">warning</span>{{ disconnectedPlayerName }} s'est déconnecté. En attente...</span>
              <button class="force-end-btn" (click)="onForceEnd()">Forcer la fin (Gagner)</button>
            </div>
          }

          <div class="status-message">
            @if (room?.status === 'waiting') {
              <div class="waiting-container" style="display: flex; flex-direction: column; align-items: center; gap: 16px; margin-top: 12px;">
                <div class="pulse-text">En attente d'un adversaire...</div>
                <button class="tonal-btn share-btn" style="display: flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 20px; font-weight: 500; font-size: 13px;" (click)="onShareInvitation()">
                  <span class="material-symbols">share</span>
                  <span>Partager l'invitation</span>
                </button>
              </div>
            } @else if (room?.status === 'finished') {
              <div class="win-banner" [class.victory]="isWinner" [class.defeat]="isLoser" style="display: inline-flex; align-items: center; justify-content: center; gap: 8px;">
                @if (winnerLabel === 'draw') {
                  <span class="material-symbols" style="font-size: 24px;">handshake</span>
                  <span>Égalité ! Bien joué aux deux joueurs.</span>
                } @else {
                  <span class="material-symbols" style="font-size: 24px; color: #fbbf24;">trophy</span>
                  <span>{{ winnerLabel }} a gagné la partie !</span>
                }
              </div>
              <div class="rematch-section">
                @if (hasVotedRematch) {
                  <div class="rematch-status" style="display: inline-flex; align-items: center; gap: 6px; justify-content: center;">
                    <span class="material-symbols" style="font-size: 16px;">hourglass_empty</span>
                    <span>En attente de l'adversaire...</span>
                  </div>
                } @else if (room?.rematchVotes?.length > 0) {
                  <div class="rematch-request-banner" style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
                    <div style="display: inline-flex; align-items: center; gap: 6px;">
                      <span class="material-symbols" style="font-size: 18px;">replay</span>
                      <span>L'adversaire veut rejouer !</span>
                    </div>
                    <button class="primary-btn rematch-btn" (click)="onRequestRematch()">
                      <span class="material-symbols">replay</span>
                      <span>Accepter</span>
                    </button>
                  </div>
                } @else {
                  <button class="primary-btn rematch-btn" (click)="onRequestRematch()">
                    <span class="material-symbols">replay</span>
                    <span>Rejouer / Revanche</span>
                  </button>
                }
              </div>
            } @else {
              <div [class]="turnAlertClass ? turnAlertClass : (isMyTurn ? 'turn-alert my-turn' : 'turn-alert opponent-turn')">
                @if (isMyTurn) {
                  <span style="display: inline-flex; align-items: center; gap: 6px; justify-content: center; width: 100%;">
                    <span class="material-symbols" style="font-size: 16px; color: #34d399;">fiber_manual_record</span>
                    <span>{{ turnAlertText }}</span>
                  </span>
                } @else {
                  <span style="display: inline-flex; align-items: center; gap: 6px; justify-content: center; width: 100%;">
                    <span class="material-symbols" style="font-size: 16px;">hourglass_empty</span>
                    <span>{{ opponentTurnText }}</span>
                  </span>
                }
              </div>
            }
          </div>
        </div>

        <!-- Board/Content Area Wrapper (PC layout centers this and stacks them vertically) -->
        <div class="board-area-wrapper">
          <!-- PC-only status alert banners above the board -->
          @if (room?.status === 'finished') {
            <div class="win-banner-pc glass-card" [class.victory]="isWinner" [class.defeat]="isLoser" style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
              <div style="display: inline-flex; align-items: center; gap: 8px;">
                @if (winnerLabel === 'draw') {
                  <span class="material-symbols" style="font-size: 24px;">handshake</span>
                  <span>Égalité ! Bien joué aux deux joueurs.</span>
                } @else {
                  <span class="material-symbols" style="font-size: 24px; color: #fbbf24;">trophy</span>
                  <span>{{ winnerLabel }} a gagné la partie !</span>
                }
              </div>
              <div class="rematch-section-pc">
                @if (hasVotedRematch) {
                  <span class="rematch-status" style="display: inline-flex; align-items: center; gap: 4px;">
                    <span class="material-symbols" style="font-size: 16px;">hourglass_empty</span>
                    <span>En attente...</span>
                  </span>
                } @else if (room?.rematchVotes?.length > 0) {
                  <button class="primary-btn rematch-btn-pc rematch-pulse" (click)="onRequestRematch()" style="display: inline-flex; align-items: center; gap: 6px;">
                    <span class="material-symbols">replay</span>
                    <span>Accepter la revanche !</span>
                  </button>
                } @else {
                  <button class="primary-btn rematch-btn-pc" (click)="onRequestRematch()">
                    <span class="material-symbols">replay</span>
                    <span>Rejouer</span>
                  </button>
                }
              </div>
            </div>
          } @else if (isPlaying && room?.status !== 'waiting') {
           <div class="turn-alert-pc glass-card" [class]="turnAlertClass ? turnAlertClass : (isMyTurn ? 'turn-alert-pc glass-card my-turn' : 'turn-alert-pc glass-card opponent-turn')">
             @if (isMyTurn) {
               <span style="display: inline-flex; align-items: center; gap: 6px; justify-content: center; width: 100%;">
                 <span class="material-symbols" style="font-size: 16px; color: #34d399;">fiber_manual_record</span>
                 <span>{{ turnAlertText }}</span>
               </span>
             } @else {
               <span style="display: inline-flex; align-items: center; gap: 6px; justify-content: center; width: 100%;">
                 <span class="material-symbols" style="font-size: 16px;">hourglass_empty</span>
                 <span>{{ opponentTurnText }}</span>
               </span>
             }
           </div>
          } @else if (room?.status === 'waiting') {
            <div class="waiting-container-pc glass-card">
              <div class="pulse-text">En attente d'un adversaire...</div>
              <button class="tonal-btn share-btn" style="display: flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 20px; font-weight: 500; font-size: 13px;" (click)="onShareInvitation()">
                <span class="material-symbols">share</span>
                <span>Partager l'invitation</span>
              </button>
            </div>
          }

          <!-- Slots for Game Setup/Placement and Main Game Board -->
          <div class="projected-content-row">
            <ng-content select="[game-setup]"></ng-content>
            <ng-content select="[game-board]"></ng-content>
          </div>

          <!-- Emoji Bar / Reactions below the board -->
          @if (isPlaying && room?.status !== 'waiting') {
            <div class="emoji-bar glass-card">
              <span class="bar-title">Réagir :</span>
              <button (click)="onSendEmoji('mood')" title="Rire"><span class="material-symbols">mood</span></button>
              <button (click)="onSendEmoji('sentiment_very_dissatisfied')" title="Triste"><span class="material-symbols">sentiment_very_dissatisfied</span></button>
              <button (click)="onSendEmoji('thumb_up')" title="Super"><span class="material-symbols">thumb_up</span></button>
              <button (click)="onSendEmoji('local_fire_department')" title="Feu"><span class="material-symbols">local_fire_department</span></button>
              <button (click)="onSendEmoji('celebration')" title="Fête"><span class="material-symbols">celebration</span></button>
            </div>
          }
        </div>

      </div>

      <!-- Rules Modal -->
      @if (showRulesModal()) {
        <div class="rules-modal-overlay" (click)="showRulesModal.set(false)">
          <div class="rules-modal-card" (click)="$event.stopPropagation()">
            <!-- Drag handle (mobile only) -->
            <div class="modal-handle-bar"></div>

            <!-- Header -->
            <div class="rules-modal-header">
              <div class="rules-modal-title">
                <span class="material-symbols rules-modal-icon">menu_book</span>
                <h3>{{ gameTitle }} — Règles</h3>
              </div>
              <button class="close-rules-btn" (click)="showRulesModal.set(false)" aria-label="Fermer">
                <span class="material-symbols">close</span>
              </button>
            </div>

            <!-- Rules list -->
            <div class="rules-modal-body">
              <ol class="rules-list">
                @for (rule of rules; track rule) {
                  <li class="rules-item">
                    <span class="rules-item-text">{{ rule }}</span>
                  </li>
                }
              </ol>
            </div>

            <!-- Footer close -->
            <div class="rules-modal-footer">
              <button class="primary-btn" (click)="showRulesModal.set(false)">
                <span class="material-symbols">check</span>
                <span>Compris !</span>
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .layout-container {
      height: 100dvh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-sizing: border-box;
      position: relative; /* anchor for position:absolute children (emoji-bar) */
      max-width: 100vw;   /* prevent horizontal bleed on iOS */
      /* Account for notch (top), home indicator (bottom), and rounded bezels (sides) */
      padding-top:    calc(10px + env(safe-area-inset-top,    0px));
      padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px));
      padding-left:   calc(10px + env(safe-area-inset-left,   0px));
      padding-right:  calc(10px + env(safe-area-inset-right,  0px));
      width: 100%;
    }

    .game-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      width: 100%;
      flex-shrink: 0;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      flex-shrink: 1;
    }

    .game-title-desktop {
      display: none;
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      color: var(--md-on-surface);
      font-family: 'Inter', sans-serif;
    }

    .header-players-pc {
      display: none;
      align-items: center;
      gap: 12px;
      background: var(--md-surface-container-high);
      padding: 6px 16px;
      border-radius: var(--md-radius-full);
      border: 1px solid var(--md-outline-variant);
    }

    .header-players-pc .player-slot {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .header-players-pc .player-slot.active {
      font-weight: 700;
    }

    .header-players-pc .player-name {
      font-size: 13px;
      color: var(--md-on-surface);
    }

    .header-players-pc .vs-divider {
      font-size: 11px;
      font-weight: bold;
      color: var(--md-on-surface-variant);
    }

    .piece-indicator {
      width: 14px;
      height: 14px;
      border-radius: 50%;
    }

    .indicator-symbol {
      font-size: 14px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .indicator-element {
      display: inline-block;
      border-radius: 50%;
    }

    /* Shared indicators rules (will be styled by container or standard styles) */
    .indicator-element.token {
      width: 16px;
      height: 16px;
      box-shadow: inset 0 -2px 3px rgba(0, 0, 0, 0.3);
    }
    .indicator-element.token-red {
      background: radial-gradient(circle at 35% 35%, #ff4b5c, #c01a2b);
    }
    .indicator-element.token-yellow {
      background: radial-gradient(circle at 35% 35%, #ffd13b, #cfa000);
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
      padding: 6px 12px;
      border-radius: var(--md-radius-full);
      font-size: 13px;
      flex-shrink: 0;
      white-space: nowrap;
    }

    /* Hide "Code salon :" label on very narrow screens, keep only the code */
    .room-badge .room-label { display: inline; }

    @media (max-width: 400px) {
      .room-badge { font-size: 11px; padding: 4px 8px; }
      .room-badge .room-label { display: none; }
    }

    .game-layout-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-height: 0;
      width: 100%;
    }

    .status-panel {
      background: var(--md-surface-container);
      border: 1px solid var(--md-outline-variant);
      border-radius: var(--md-radius-xl);
      color: var(--md-on-surface);
      text-align: center;
      padding: 20px;
      margin-bottom: 15px;
    }

    .status-panel h2 {
      margin: 0 0 15px 0;
      font-size: 26px;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: var(--md-on-surface);
      font-family: 'Inter', sans-serif;
    }

    .players-display {
      display: flex;
      justify-content: space-around;
      align-items: center;
      margin: 15px 0;
      background: var(--md-surface-container-high);
      padding: 12px;
      border-radius: var(--md-radius-lg);
      border: 1px solid var(--md-outline-variant);
    }

    .player-slot {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 14px;
      border-radius: var(--md-radius-lg);
      border: 1px solid transparent;
      transition: all 0.2s;
    }

    .player-slot.active {
      background: var(--md-surface-container);
      border-color: var(--md-outline-variant);
    }

    .player-info {
      display: flex;
      flex-direction: column;
      text-align: left;
    }

    .player-label {
      font-size: 11px;
      color: var(--md-on-surface-variant);
    }

    .status-message {
      text-align: center;
      font-size: 15px;
      font-weight: 500;
    }

    .pulse-text {
      color: #9ca3af;
      animation: pulse 1.5s infinite;
    }

    .turn-alert {
      padding: 10px;
      border-radius: 8px;
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
      color: #f43f5e;
      border: 1px solid var(--md-outline-variant);
    }

    .board-area-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 0;
      width: 100%;
    }

    .turn-alert-pc, .win-banner-pc, .waiting-container-pc {
      display: none;
      text-align: center;
      padding: 10px 20px;
      border-radius: var(--md-radius-lg);
      font-weight: 600;
      font-size: 15px;
      width: 100%;
      max-width: 480px;
      box-sizing: border-box;
      margin: 0 auto 5px auto;
    }

    .local-turn-red {
      background: rgba(255, 75, 92, 0.15) !important;
      color: #ff4b5c !important;
      border: 1px solid rgba(255, 75, 92, 0.3) !important;
    }

    .local-turn-yellow {
      background: rgba(255, 209, 59, 0.15) !important;
      color: #ffd13b !important;
      border: 1px solid rgba(255, 209, 59, 0.3) !important;
    }

    .win-banner-pc {
      justify-content: space-between;
      align-items: center;
    }

    .win-banner-pc.victory {
      color: #34d399;
      border-color: rgba(52, 211, 153, 0.3);
      background: rgba(16, 185, 129, 0.1);
    }

    .win-banner-pc.defeat {
      color: #f43f5e;
      border-color: rgba(244, 63, 94, 0.3);
      background: rgba(244, 63, 94, 0.1);
    }

    .rematch-btn-pc {
      padding: 6px 14px;
      font-size: 13px;
      font-weight: bold;
      background: var(--md-primary);
      color: var(--md-on-primary);
      border: none;
      border-radius: var(--md-radius-full);
      cursor: pointer;
    }

    .projected-content-row {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: 0;
    }

    .help-btn {
      background: none;
      border: none;
      color: var(--md-on-surface-variant);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 4px;
      border-radius: 50%;
      transition: background 0.2s;
    }
    .help-btn:hover {
      background: rgba(255, 255, 255, 0.08);
      color: var(--md-on-surface);
    }
    .help-btn .material-symbols {
      font-size: 20px;
    }

    /* ── Rules button (visible pill) ─────────────────────────────── */
    .rules-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: var(--md-surface-container);
      border: 1px solid var(--md-outline-variant);
      color: var(--md-on-surface-variant);
      border-radius: var(--md-radius-full);
      padding: 5px 12px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      font-family: 'Inter', sans-serif;
      transition: all 0.15s;
      white-space: nowrap;
    }
    .rules-btn:hover {
      background: var(--md-primary-container);
      color: var(--md-on-primary-container);
      border-color: var(--md-primary);
    }
    .rules-btn .material-symbols { font-size: 17px; }

    /* Hide label on very small screens, keep icon only */
    @media (max-width: 380px) {
      .rules-btn-label { display: none; }
      .rules-btn { padding: 5px 8px; }
    }

    /* ── Rules Modal ──────────────────────────────────────────────── */
    .rules-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.65);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      display: flex;
      justify-content: center;
      align-items: center;    /* centered on desktop */
      z-index: 10000;
      padding: 24px;
      box-sizing: border-box;
      animation: modalOverlayFadeIn 0.2s ease-out forwards;
    }

    .rules-modal-card {
      width: 100%;
      max-width: 520px;
      max-height: 80dvh;
      background: var(--md-surface-container-high);
      border-radius: var(--md-radius-xl);
      box-shadow: 0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px var(--md-outline-variant);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: modalZoomIn 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }

    /* drag handle bar (visible on mobile only) */
    .modal-handle-bar {
      display: none;
      width: 40px;
      height: 4px;
      background: var(--md-outline-variant);
      border-radius: 2px;
      margin: 12px auto 0;
      flex-shrink: 0;
    }

    .rules-modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 20px 16px;
      border-bottom: 1px solid var(--md-outline-variant);
      flex-shrink: 0;
    }
    .rules-modal-title {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .rules-modal-icon {
      font-size: 22px;
      color: var(--md-primary);
    }
    .rules-modal-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: var(--md-on-surface);
    }
    .close-rules-btn {
      background: var(--md-surface-container);
      border: 1px solid var(--md-outline-variant);
      color: var(--md-on-surface-variant);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      transition: all 0.15s;
      flex-shrink: 0;
    }
    .close-rules-btn:hover {
      background: var(--md-surface-container-highest);
      color: var(--md-on-surface);
    }
    .close-rules-btn .material-symbols { font-size: 18px; }

    .rules-modal-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px 20px;
      -webkit-overflow-scrolling: touch;
    }
    .rules-list {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 8px;
      counter-reset: rules-counter;
    }
    .rules-item {
      counter-increment: rules-counter;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 11px 14px;
      background: var(--md-surface-container);
      border-radius: var(--md-radius-md);
      border-left: 3px solid var(--md-primary);
    }
    .rules-item::before {
      content: counter(rules-counter);
      font-size: 11px;
      font-weight: 700;
      color: var(--md-on-primary);
      background: var(--md-primary);
      min-width: 20px;
      height: 20px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 1px;
    }
    .rules-item-text {
      font-size: 13px;
      line-height: 1.6;
      color: var(--md-on-surface-variant);
    }

    .rules-modal-footer {
      padding: 14px 20px;
      border-top: 1px solid var(--md-outline-variant);
      display: flex;
      justify-content: center;
      flex-shrink: 0;
    }
    .rules-modal-footer .primary-btn {
      min-width: 140px;
      justify-content: center;
    }

    /* ── Mobile: bottom sheet ─────────────────────────────────────── */
    @media (max-width: 640px) {
      .rules-modal-overlay {
        align-items: flex-end;
        padding: 0;
      }
      .rules-modal-card {
        max-width: 100%;
        border-radius: 24px 24px 0 0;
        max-height: 88dvh;
        padding-bottom: env(safe-area-inset-bottom, 0px);
        animation: slideUpModal 0.32s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        box-shadow: 0 -8px 40px rgba(0,0,0,0.5);
      }
      .modal-handle-bar { display: block; }
      .rules-modal-header { padding-top: 14px; }
    }

    @keyframes slideUpModal {
      from { transform: translateY(40px); opacity: 0; }
      to   { transform: translateY(0);   opacity: 1; }
    }

    /* Emoji Bar */
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
      color: var(--md-on-surface);
      cursor: pointer;
      padding: 6px 12px;
      border-radius: 8px;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .emoji-bar button:hover {
      background: rgba(255, 255, 255, 0.15);
      transform: scale(1.15);
    }

    .emoji-bar button .material-symbols {
      font-size: 20px;
    }

    /* Disconnection banner styles */
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
    .rematch-status {
      font-size: 14px;
      color: var(--md-on-surface-variant);
      font-style: italic;
    }
    .rematch-request-banner {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      background: rgba(208, 188, 255, 0.12);
      border: 1px solid var(--md-primary);
      border-radius: var(--md-radius-lg);
      font-size: 14px;
      font-weight: 600;
      color: var(--md-primary);
      animation: rematchPulse 1.5s ease-in-out infinite;
    }
    .rematch-pulse {
      animation: rematchPulse 1.5s ease-in-out infinite;
    }
    @keyframes rematchPulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(208, 188, 255, 0.4); }
      50%       { box-shadow: 0 0 0 6px rgba(208, 188, 255, 0); }
    }

    .mobile-status-panel {
      display: block;
    }

    @media (orientation: landscape) and (min-width: 768px) {
      .game-title-desktop {
        display: block;
      }
      .header-players-pc {
        display: flex;
      }
      .mobile-status-panel {
        display: none;
      }
      .turn-alert-pc {
        display: block;
      }
      .win-banner-pc {
        display: flex;
      }
      .waiting-container-pc {
        display: flex;
        justify-content: center;
        gap: 15px;
        align-items: center;
        max-width: 480px;
      }
      .game-layout-body {
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0;
      }
      .emoji-bar {
        margin-top: 10px;
        margin-bottom: 0;
        padding: 6px 12px;
      }
    }

    @media (max-width: 480px) {
      .layout-container {
        padding-top:    calc(6px + env(safe-area-inset-top,    0px));
        padding-bottom: calc(6px + env(safe-area-inset-bottom, 0px));
        padding-left:   calc(10px + env(safe-area-inset-left,  0px));
        padding-right:  calc(10px + env(safe-area-inset-right, 0px));
      }
      .game-header {
        margin-bottom: 8px;
      }
      .status-panel {
        padding: 6px 12px;
        margin-bottom: 6px;
        border-radius: var(--md-radius-md);
      }
      .status-panel h2 {
        font-size: 14px;
        margin-bottom: 0;
      }
      .status-panel.collapsed {
        padding: 6px 10px;
      }
      .status-panel.collapsed .players-display {
        display: none !important;
      }
      .players-display {
        margin: 6px 0;
        padding: 6px 12px;
        border-radius: var(--md-radius-md);
      }
      .player-slot {
        padding: 4px 8px;
        gap: 6px;
      }
      .player-label {
        display: none;
      }
      .player-name {
        font-size: 13px;
      }
      .vs-divider {
        font-size: 11px;
      }
      .emoji-bar {
        position: absolute;
        /* Push above home indicator on iPhone */
        bottom: calc(8px + env(safe-area-inset-bottom, 0px));
        left: 50%;
        transform: translateX(-50%);
        z-index: 100;
        background: rgba(15, 23, 42, 0.75) !important;
        backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: var(--md-radius-full);
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
        margin: 0;
        padding: 4px 10px;
        gap: 8px;
        width: auto;
        white-space: nowrap;
      }
      .emoji-bar .bar-title {
        display: none;
      }
      .emoji-bar button {
        background: transparent;
        border: none;
        padding: 4px 8px;
      }
      .emoji-bar button .material-symbols {
        font-size: 18px;
      }
      .status-message {
        font-size: 12px;
        margin-top: 4px;
      }
    }

    /* ── Large desktop (≥ 1280 px) ────────────────────────────────────────── */
    @media (min-width: 1280px) {
      .layout-container {
        padding-left:  calc(32px + env(safe-area-inset-left,  0px));
        padding-right: calc(32px + env(safe-area-inset-right, 0px));
      }
      .game-header {
        margin-bottom: 20px;
      }
      .back-btn {
        padding: 10px 20px;
        font-size: 15px;
      }
      .room-badge {
        font-size: 15px;
      }
      .status-panel {
        max-width: 640px;
        margin-left: auto;
        margin-right: auto;
      }
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
  `]
})
export class GameLayoutComponent {
  public gameHelpersService = inject(GameHelpersService);

  @Input() gameTitle: string = '';
  @Input() rules: string[] = [];
  @Input() room: any = null;
  @Input() isPlaying: boolean = false;
  @Input() isMyTurn: boolean = false;
  @Input() turnAlertText: string = '';
  @Input() opponentTurnText: string = '';
  @Input() winnerLabel: string = '';
  @Input() isWinner: boolean = false;
  @Input() isLoser: boolean = false;
  @Input() hasVotedRematch: boolean = false;
  @Input() turnAlertClass: string = '';
  @Input() disconnectedPlayerName: string = '';
  
  @Input() player1Name: string = '';
  @Input() player2Name: string = '';
  @Input() player1Active: boolean = false;
  @Input() player2Active: boolean = false;
  
  @Input() player1IndicatorClass: string = '';
  @Input() player2IndicatorClass: string = '';
  @Input() player1IndicatorSymbol: string = '';
  @Input() player2IndicatorSymbol: string = '';

  @Output() leaveRoom = new EventEmitter<void>();
  @Output() requestRematch = new EventEmitter<void>();
  @Output() sendEmoji = new EventEmitter<string>();
  @Output() forceEnd = new EventEmitter<void>();
  @Output() shareInvitation = new EventEmitter<void>();

  showRulesModal = signal<boolean>(false);
  isFullscreen = signal<boolean>(false);
  isStatusCollapsed = signal<boolean>(true);

  constructor() {
    if (typeof window !== 'undefined') {
      document.addEventListener('fullscreenchange', () => {
        this.isFullscreen.set(!!document.fullscreenElement);
      });
    }
  }

  toggleFullscreen() {
    if (typeof document !== 'undefined') {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          console.warn(`Error attempting to enable full-screen mode: ${err.message}`);
        });
      } else {
        document.exitFullscreen();
      }
    }
  }

  toggleStatusCollapse() {
    this.isStatusCollapsed.update(v => !v);
  }

  onLeaveRoom() {
    this.leaveRoom.emit();
  }

  onRequestRematch() {
    this.requestRematch.emit();
  }

  onSendEmoji(emoji: string) {
    this.sendEmoji.emit(emoji);
  }

  onForceEnd() {
    this.forceEnd.emit();
  }

  onShareInvitation() {
    this.shareInvitation.emit();
  }
}
