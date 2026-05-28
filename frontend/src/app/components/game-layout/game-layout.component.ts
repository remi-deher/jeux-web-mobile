import { Component, Input, Output, EventEmitter, signal, inject } from '@angular/core';
import { GameHelpersService } from '../../services/game-helpers.service';

@Component({
  selector: 'app-game-layout',
  standalone: true,
  template: `
    <div class="layout-container">

      <!-- ════════════════════ HEADER (unique barre compacte) ════════════════════ -->
      <header class="game-header">

        <button class="back-btn" (click)="onLeaveRoom()" title="Quitter la partie">
          <span class="material-symbols">arrow_back</span>
          <span class="back-label">Quitter</span>
        </button>

        <!-- Centre : pill joueurs ou chip en attente -->
        <div class="header-center">
          @if (room?.status === 'waiting') {
            <span class="waiting-chip">
              <span class="material-symbols" style="font-size:14px">hourglass_empty</span>
              En attente...
            </span>
          } @else if (room?.status === 'playing' || room?.status === 'finished') {
            <div class="players-pill">
              <!-- Joueur 1 -->
              <div class="ph-slot"
                [class.ph-active]="player1Active"
                [class.ph-dim]="!player1Active && isPlaying">
                @if (player1IndicatorClass) {
                  <span class="indicator-element" [class]="player1IndicatorClass"></span>
                } @else if (player1IndicatorSymbol) {
                  <span class="ph-sym">{{ player1IndicatorSymbol }}</span>
                }
                <span class="ph-name">{{ player1Name }}</span>
              </div>
              <span class="ph-vs">VS</span>
              <!-- Joueur 2 -->
              <div class="ph-slot"
                [class.ph-active]="player2Active"
                [class.ph-dim]="!player2Active && isPlaying">
                @if (player2IndicatorClass) {
                  <span class="indicator-element" [class]="player2IndicatorClass"></span>
                } @else if (player2IndicatorSymbol) {
                  <span class="ph-sym">{{ player2IndicatorSymbol }}</span>
                }
                <span class="ph-name">{{ player2Name }}</span>
              </div>
            </div>
          }
        </div>

        <!-- Droite : icônes + code salon -->
        <div class="header-right">
          <button class="icon-btn"
            (click)="gameHelpersService.toggleSound()"
            [title]="gameHelpersService.soundEnabled() ? 'Couper le son' : 'Activer le son'">
            <span class="material-symbols">
              {{ gameHelpersService.soundEnabled() ? 'volume_up' : 'volume_off' }}
            </span>
          </button>
          <button class="icon-btn" (click)="showRulesModal.set(true)" title="Règles du jeu">
            <span class="material-symbols">menu_book</span>
          </button>
          <button class="icon-btn"
            (click)="toggleFullscreen()"
            [title]="isFullscreen() ? 'Quitter le plein écran' : 'Plein écran'">
            <span class="material-symbols">
              {{ isFullscreen() ? 'fullscreen_exit' : 'fullscreen' }}
            </span>
          </button>
          <div class="room-code">
            <span class="room-label">Code : </span>
            <strong>{{ room?.id }}</strong>
          </div>
        </div>
      </header>

      <!-- ════════════════════ BANDEAUX FINS ════════════════════ -->
      @if (room?.status === 'waiting') {
        <div class="slim-banner share-banner">
          <button class="tonal-btn" (click)="onShareInvitation()">
            <span class="material-symbols">share</span>
            <span>Partager l'invitation</span>
          </button>
        </div>
      }
      @if (disconnectedPlayerName) {
        <div class="slim-banner disconnect-banner">
          <span class="material-symbols" style="font-size:18px;color:#fc8181;flex-shrink:0">warning</span>
          <span style="flex:1;font-size:13px">{{ disconnectedPlayerName }} s'est déconnecté. En attente...</span>
          <button class="force-end-btn" (click)="onForceEnd()">Forcer la fin</button>
        </div>
      }

      <!-- ════════════════════ ZONE PLATEAU ════════════════════ -->
      <div class="board-area-wrapper">
        <div class="board-content-row">
          <ng-content select="[game-setup]"></ng-content>
          <ng-content select="[game-board]"></ng-content>
        </div>

        <!-- Barre emoji (en dessous du plateau sur desktop, flottante sur mobile) -->
        @if (isPlaying && room?.status !== 'waiting') {
          <div class="emoji-bar">
            <span class="bar-title">Réagir :</span>
            <button (click)="onSendEmoji('mood')" title="Rire">
              <span class="material-symbols">mood</span>
            </button>
            <button (click)="onSendEmoji('sentiment_very_dissatisfied')" title="Triste">
              <span class="material-symbols">sentiment_very_dissatisfied</span>
            </button>
            <button (click)="onSendEmoji('thumb_up')" title="Super">
              <span class="material-symbols">thumb_up</span>
            </button>
            <button (click)="onSendEmoji('local_fire_department')" title="Feu">
              <span class="material-symbols">local_fire_department</span>
            </button>
            <button (click)="onSendEmoji('celebration')" title="Fête">
              <span class="material-symbols">celebration</span>
            </button>
          </div>
        }
      </div>

      <!-- ════════════════════ OVERLAY RÉSULTAT (bottom-sheet) ════════════════════ -->
      @if (room?.status === 'finished') {
        <div class="result-overlay">
          <div class="result-card" [class.victory]="isWinner" [class.defeat]="isLoser">
            <div class="result-handle"></div>
            <div class="result-body">

              <!-- Message -->
              <div class="result-message">
                @if (winnerLabel === 'draw') {
                  <span class="material-symbols result-icon neutral">handshake</span>
                  <div class="result-text">
                    <span class="result-title">Égalité !</span>
                    <span class="result-sub">Bien joué aux deux joueurs.</span>
                  </div>
                } @else if (isWinner) {
                  <span class="material-symbols result-icon win">emoji_events</span>
                  <div class="result-text">
                    <span class="result-title">Victoire ! 🎉</span>
                    <span class="result-sub">Bien joué !</span>
                  </div>
                } @else if (isLoser) {
                  <span class="material-symbols result-icon lose">mood_bad</span>
                  <div class="result-text">
                    <span class="result-title">Défaite</span>
                    <span class="result-sub">{{ winnerLabel }} a gagné cette fois.</span>
                  </div>
                } @else {
                  <span class="material-symbols result-icon win">emoji_events</span>
                  <div class="result-text">
                    <span class="result-title">{{ winnerLabel }} gagne !</span>
                  </div>
                }
              </div>

              <!-- Actions revanche -->
              <div class="result-actions">
                @if (hasVotedRematch) {
                  <div class="rematch-status">
                    <span class="material-symbols" style="font-size:16px">hourglass_empty</span>
                    En attente de l'adversaire...
                  </div>
                } @else if (room?.rematchVotes?.length > 0) {
                  <button class="primary-btn rematch-pulse" (click)="onRequestRematch()">
                    <span class="material-symbols">replay</span>
                    <span>Accepter la revanche !</span>
                  </button>
                } @else {
                  <button class="primary-btn" (click)="onRequestRematch()">
                    <span class="material-symbols">replay</span>
                    <span>Rejouer</span>
                  </button>
                }
              </div>

            </div>
          </div>
        </div>
      }

      <!-- ════════════════════ MODALE RÈGLES ════════════════════ -->
      @if (showRulesModal()) {
        <div class="rules-modal-overlay" (click)="showRulesModal.set(false)">
          <div class="rules-modal-card" (click)="$event.stopPropagation()">
            <div class="modal-handle-bar"></div>
            <div class="rules-modal-header">
              <div class="rules-modal-title">
                <span class="material-symbols rules-modal-icon">menu_book</span>
                <h3>{{ gameTitle }} — Règles</h3>
              </div>
              <button class="close-rules-btn" (click)="showRulesModal.set(false)" aria-label="Fermer">
                <span class="material-symbols">close</span>
              </button>
            </div>
            <div class="rules-modal-body">
              <ol class="rules-list">
                @for (rule of rules; track rule) {
                  <li class="rules-item">
                    <span class="rules-item-text">{{ rule }}</span>
                  </li>
                }
              </ol>
            </div>
            <div class="rules-modal-footer">
              <button class="primary-btn footer-close-btn" (click)="showRulesModal.set(false)">
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
    /* ═══════════════════════════════════════════════
       LAYOUT CONTAINER
    ═══════════════════════════════════════════════ */
    .layout-container {
      height: 100dvh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-sizing: border-box;
      position: relative;       /* ancre pour les enfants position:absolute/fixed */
      max-width: 100vw;
      padding-top:    calc(8px + env(safe-area-inset-top,    0px));
      padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px));
      padding-left:   calc(10px + env(safe-area-inset-left,  0px));
      padding-right:  calc(10px + env(safe-area-inset-right, 0px));
      width: 100%;
    }

    /* ═══════════════════════════════════════════════
       HEADER
    ═══════════════════════════════════════════════ */
    .game-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 5px;
      flex-shrink: 0;
      width: 100%;
      min-width: 0;
    }

    /* Bouton retour */
    .back-btn {
      background: var(--md-secondary-container);
      border: 1px solid var(--md-outline-variant);
      color: var(--md-on-secondary-container);
      border-radius: var(--md-radius-full);
      padding: 6px 10px;
      cursor: pointer;
      font-size: 13px;
      font-family: 'Inter', sans-serif;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      transition: opacity 0.2s;
      flex-shrink: 0;
      white-space: nowrap;
    }
    .back-btn:hover { opacity: 0.8; }
    .back-btn .material-symbols { font-size: 18px; }
    .back-label { display: none; } /* affiché sur tablette/desktop via media query */

    /* Centre flexible */
    .header-center {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;
      min-width: 0;
      overflow: hidden;
    }

    /* Chip en attente */
    .waiting-chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 13px;
      color: var(--md-on-surface-variant);
      animation: pulse 1.5s infinite;
    }

    /* ── Pill joueurs ── */
    .players-pill {
      display: flex;
      align-items: center;
      gap: 4px;
      background: var(--md-surface-container-high);
      border: 1px solid var(--md-outline-variant);
      border-radius: var(--md-radius-full);
      padding: 3px 8px;
      min-width: 0;
      max-width: 100%;
      overflow: hidden;
    }

    .ph-slot {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 3px 7px;
      border-radius: var(--md-radius-full);
      border: 1px solid transparent;
      transition: all 0.25s;
      min-width: 0;
      overflow: hidden;
    }

    /* Joueur actif : glow vert */
    .ph-slot.ph-active {
      background: rgba(52, 211, 153, 0.12);
      border-color: rgba(52, 211, 153, 0.3);
    }
    .ph-slot.ph-active .ph-name { color: #34d399; }

    /* Joueur inactif pendant la partie : atténué */
    .ph-slot.ph-dim { opacity: 0.4; }

    .ph-name {
      font-size: 12px;
      font-weight: 600;
      color: var(--md-on-surface);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 80px;
    }

    .ph-vs {
      font-size: 9px;
      font-weight: 700;
      color: var(--md-on-surface-variant);
      flex-shrink: 0;
    }

    .ph-sym {
      font-size: 12px;
      flex-shrink: 0;
      line-height: 1;
    }

    /* Droite : icônes + code */
    .header-right {
      display: flex;
      align-items: center;
      gap: 2px;
      flex-shrink: 0;
    }

    .icon-btn {
      background: none;
      border: none;
      color: var(--md-on-surface-variant);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      transition: background 0.2s, color 0.2s;
      flex-shrink: 0;
    }
    .icon-btn:hover {
      background: rgba(255,255,255,0.08);
      color: var(--md-on-surface);
    }
    .icon-btn .material-symbols { font-size: 20px; }

    .room-code {
      background: var(--md-surface-container);
      border: 1px solid var(--md-outline-variant);
      color: var(--md-on-surface-variant);
      padding: 4px 9px;
      border-radius: var(--md-radius-full);
      font-size: 12px;
      flex-shrink: 0;
      white-space: nowrap;
      display: none; /* caché sur très petits écrans, affiché plus loin */
    }
    .room-label { display: none; }

    /* ═══════════════════════════════════════════════
       BANDEAUX FINS
    ═══════════════════════════════════════════════ */
    .slim-banner {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 5px 10px;
      margin-bottom: 5px;
      border-radius: var(--md-radius-lg);
      flex-shrink: 0;
    }
    .share-banner {
      background: var(--md-surface-container);
      border: 1px solid var(--md-outline-variant);
    }
    .disconnect-banner {
      background: rgba(239,68,68,0.12);
      border: 1px solid rgba(239,68,68,0.35);
      color: #fc8181;
      font-weight: 500;
    }
    .force-end-btn {
      background: #ef4444;
      border: none;
      color: white;
      padding: 4px 10px;
      border-radius: var(--md-radius-full);
      font-weight: 600;
      cursor: pointer;
      font-size: 12px;
      flex-shrink: 0;
      transition: background 0.2s;
    }
    .force-end-btn:hover { background: #dc2626; }

    /* ═══════════════════════════════════════════════
       ZONE PLATEAU — prend tout l'espace restant
    ═══════════════════════════════════════════════ */
    .board-area-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
      width: 100%;
    }

    .board-content-row {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: 0;
    }

    /* ═══════════════════════════════════════════════
       BARRE EMOJI
    ═══════════════════════════════════════════════ */
    .emoji-bar {
      display: flex;
      gap: 6px;
      align-items: center;
      justify-content: center;
      padding: 5px 8px;
      flex-shrink: 0;
      background: var(--md-surface-container);
      border: 1px solid var(--md-outline-variant);
      border-radius: var(--md-radius-full);
      margin: 4px auto 0;
      width: fit-content;
    }
    .bar-title {
      font-size: 12px;
      color: var(--md-on-surface-variant);
      font-weight: 500;
    }
    .emoji-bar button {
      background: transparent;
      border: none;
      color: var(--md-on-surface);
      cursor: pointer;
      padding: 3px 7px;
      border-radius: var(--md-radius-full);
      transition: all 0.18s;
      display: inline-flex;
      align-items: center;
    }
    .emoji-bar button:hover {
      background: rgba(255,255,255,0.1);
      transform: scale(1.2);
    }
    .emoji-bar button .material-symbols { font-size: 18px; }

    /* ═══════════════════════════════════════════════
       OVERLAY RÉSULTAT (bottom-sheet flottante)
    ═══════════════════════════════════════════════ */
    .result-overlay {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      display: flex;
      justify-content: center;
      align-items: flex-end;
      z-index: 500;
      pointer-events: none;
    }

    .result-card {
      pointer-events: auto;
      width: 100%;
      max-width: 540px;
      background: var(--md-surface-container-high);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--md-outline-variant);
      border-top-width: 2px;
      border-radius: 22px 22px 0 0;
      box-shadow: 0 -8px 32px rgba(0,0,0,0.5);
      animation: slideUpResult 0.38s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }

    .result-card.victory {
      border-top-color: #34d399;
      background: linear-gradient(180deg, rgba(16,185,129,0.14) 0%, var(--md-surface-container-high) 55%);
    }
    .result-card.defeat {
      border-top-color: #f43f5e;
      background: linear-gradient(180deg, rgba(244,63,94,0.12) 0%, var(--md-surface-container-high) 55%);
    }

    .result-handle {
      width: 40px;
      height: 4px;
      background: var(--md-outline-variant);
      border-radius: 2px;
      margin: 10px auto 0;
    }

    .result-body {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      padding: 12px 20px calc(16px + env(safe-area-inset-bottom, 0px));
    }

    .result-message {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .result-icon {
      font-size: 34px;
      flex-shrink: 0;
    }
    .result-icon.win    { color: #fbbf24; }
    .result-icon.lose   { color: #f87171; }
    .result-icon.neutral{ color: var(--md-on-surface-variant); }

    .result-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .result-title {
      font-size: 19px;
      font-weight: 700;
      color: var(--md-on-surface);
    }
    .result-sub {
      font-size: 13px;
      color: var(--md-on-surface-variant);
    }

    .result-actions {
      width: 100%;
      display: flex;
      justify-content: center;
    }

    .rematch-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: var(--md-on-surface-variant);
      font-style: italic;
    }

    /* ═══════════════════════════════════════════════
       BOUTONS COMMUNS
    ═══════════════════════════════════════════════ */
    .primary-btn {
      background: var(--md-primary);
      border: none;
      color: var(--md-on-primary);
      border-radius: var(--md-radius-full);
      padding: 9px 22px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      font-family: 'Inter', sans-serif;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: opacity 0.2s;
    }
    .primary-btn:hover { opacity: 0.85; }

    .tonal-btn {
      background: var(--md-secondary-container);
      border: 1px solid var(--md-outline-variant);
      color: var(--md-on-secondary-container);
      border-radius: var(--md-radius-full);
      padding: 6px 14px;
      cursor: pointer;
      font-size: 13px;
      font-family: 'Inter', sans-serif;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: 500;
      transition: opacity 0.2s;
    }
    .tonal-btn:hover { opacity: 0.85; }

    .rematch-pulse {
      animation: rematchPulse 1.5s ease-in-out infinite;
    }

    /* ═══════════════════════════════════════════════
       INDICATEURS DE PIÈCES
    ═══════════════════════════════════════════════ */
    .indicator-element {
      display: inline-block;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .indicator-element.token {
      width: 14px;
      height: 14px;
      box-shadow: inset 0 -2px 3px rgba(0,0,0,0.3);
    }
    .indicator-element.token-red {
      background: radial-gradient(circle at 35% 35%, #ff4b5c, #c01a2b);
    }
    .indicator-element.token-yellow {
      background: radial-gradient(circle at 35% 35%, #ffd13b, #cfa000);
    }

    /* ═══════════════════════════════════════════════
       MODALE RÈGLES
    ═══════════════════════════════════════════════ */
    .rules-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.65);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      display: flex;
      justify-content: center;
      align-items: center;
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
    .rules-modal-title { display: flex; align-items: center; gap: 10px; }
    .rules-modal-icon  { font-size: 22px; color: var(--md-primary); }
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
      margin: 0; padding: 0;
      list-style: none;
      display: flex; flex-direction: column; gap: 8px;
      counter-reset: rules-counter;
    }
    .rules-item {
      counter-increment: rules-counter;
      display: flex; align-items: flex-start; gap: 12px;
      padding: 11px 14px;
      background: var(--md-surface-container);
      border-radius: var(--md-radius-md);
      border-left: 3px solid var(--md-primary);
    }
    .rules-item::before {
      content: counter(rules-counter);
      font-size: 11px; font-weight: 700;
      color: var(--md-on-primary);
      background: var(--md-primary);
      min-width: 20px; height: 20px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; margin-top: 1px;
    }
    .rules-item-text { font-size: 13px; line-height: 1.6; color: var(--md-on-surface-variant); }

    .rules-modal-footer {
      padding: 14px 20px;
      border-top: 1px solid var(--md-outline-variant);
      display: flex; justify-content: center;
      flex-shrink: 0;
    }
    .footer-close-btn { min-width: 140px; justify-content: center; }

    /* ═══════════════════════════════════════════════
       ANIMATIONS
    ═══════════════════════════════════════════════ */
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.5; }
    }
    @keyframes slideUpResult {
      from { transform: translateY(60px); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }
    @keyframes rematchPulse {
      0%, 100% { box-shadow: 0 0 0 0   rgba(208,188,255,0.45); }
      50%       { box-shadow: 0 0 0 7px rgba(208,188,255,0);    }
    }
    @keyframes modalOverlayFadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes modalZoomIn {
      from { transform: scale(0.9); opacity: 0; }
      to   { transform: scale(1);   opacity: 1; }
    }
    @keyframes slideUpModal {
      from { transform: translateY(40px); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }

    /* ═══════════════════════════════════════════════
       RESPONSIVE — mobile large / tablette (≥ 480px)
    ═══════════════════════════════════════════════ */
    @media (min-width: 480px) {
      .back-label    { display: inline; }
      .back-btn      { padding: 6px 14px; }
      .room-code     { display: block; }
      .ph-name       { max-width: 100px; font-size: 13px; }
      .players-pill  { padding: 4px 10px; gap: 6px; }
      .ph-slot       { padding: 3px 8px; }
    }

    @media (min-width: 640px) {
      .room-label    { display: inline; }
      .room-code     { font-size: 13px; padding: 4px 12px; }
    }

    /* ═══════════════════════════════════════════════
       RESPONSIVE — desktop paysage (≥ 768px landscape)
    ═══════════════════════════════════════════════ */
    @media (orientation: landscape) and (min-width: 768px) {
      .layout-container {
        padding-top:   calc(10px + env(safe-area-inset-top,    0px));
        padding-left:  calc(20px + env(safe-area-inset-left,   0px));
        padding-right: calc(20px + env(safe-area-inset-right,  0px));
      }
      .game-header   { margin-bottom: 8px; gap: 10px; }
      .back-btn      { padding: 7px 16px; font-size: 14px; }
      .back-label    { display: inline; }
      .room-code     { display: block; font-size: 13px; padding: 5px 13px; }
      .room-label    { display: inline; }
      .ph-name       { max-width: 130px; font-size: 13px; }
      .players-pill  { padding: 5px 12px; gap: 8px; }
      .ph-slot       { padding: 4px 9px; }

      /* Résultat : card horizontale, pas pleine largeur */
      .result-card   { border-radius: 22px 22px 0 0; max-width: 600px; }
      .result-body   {
        flex-direction: row;
        justify-content: space-between;
        padding: 12px 28px calc(18px + env(safe-area-inset-bottom, 0px));
      }
      .result-handle { margin-bottom: 0; }
    }

    /* ═══════════════════════════════════════════════
       RESPONSIVE — grand desktop (≥ 1280px)
    ═══════════════════════════════════════════════ */
    @media (min-width: 1280px) {
      .layout-container {
        padding-left:  calc(32px + env(safe-area-inset-left,  0px));
        padding-right: calc(32px + env(safe-area-inset-right, 0px));
      }
      .game-header { margin-bottom: 12px; }
    }

    /* ═══════════════════════════════════════════════
       RESPONSIVE — emoji bar flottante (mobile < 640px)
    ═══════════════════════════════════════════════ */
    @media (max-width: 639px) {
      .emoji-bar {
        position: fixed;
        bottom: calc(8px + env(safe-area-inset-bottom, 0px));
        left: 50%;
        transform: translateX(-50%);
        z-index: 100;
        background: rgba(15, 23, 42, 0.8) !important;
        border: 1px solid rgba(255,255,255,0.12) !important;
        box-shadow: 0 4px 16px rgba(0,0,0,0.45);
        margin: 0;
        padding: 4px 10px;
        gap: 6px;
        border-radius: var(--md-radius-full);
        width: auto;
        white-space: nowrap;
      }
      .emoji-bar .bar-title { display: none; }
      .emoji-bar button { padding: 4px 7px; }
      .emoji-bar button .material-symbols { font-size: 18px; }
    }

    /* ═══════════════════════════════════════════════
       RESPONSIVE — modale règles (bottom-sheet mobile)
    ═══════════════════════════════════════════════ */
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
      .modal-handle-bar  { display: block; }
      .rules-modal-header{ padding-top: 14px; }
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
  @Input() turnAlertText: string = '';       // conservé pour compatibilité ascendante
  @Input() opponentTurnText: string = '';    // conservé pour compatibilité ascendante
  @Input() turnAlertClass: string = '';      // conservé pour compatibilité ascendante
  @Input() winnerLabel: string = '';
  @Input() isWinner: boolean = false;
  @Input() isLoser: boolean = false;
  @Input() hasVotedRematch: boolean = false;
  @Input() disconnectedPlayerName: string = '';

  @Input() player1Name: string = '';
  @Input() player2Name: string = '';
  @Input() player1Active: boolean = false;
  @Input() player2Active: boolean = false;

  @Input() player1IndicatorClass: string = '';
  @Input() player2IndicatorClass: string = '';
  @Input() player1IndicatorSymbol: string = '';
  @Input() player2IndicatorSymbol: string = '';

  @Output() leaveRoom       = new EventEmitter<void>();
  @Output() requestRematch  = new EventEmitter<void>();
  @Output() sendEmoji       = new EventEmitter<string>();
  @Output() forceEnd        = new EventEmitter<void>();
  @Output() shareInvitation = new EventEmitter<void>();

  showRulesModal = signal<boolean>(false);
  isFullscreen   = signal<boolean>(false);

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
        document.documentElement.requestFullscreen().catch(err =>
          console.warn(`Fullscreen error: ${err.message}`)
        );
      } else {
        document.exitFullscreen();
      }
    }
  }

  onLeaveRoom()            { this.leaveRoom.emit(); }
  onRequestRematch()       { this.requestRematch.emit(); }
  onSendEmoji(emoji: string) { this.sendEmoji.emit(emoji); }
  onForceEnd()             { this.forceEnd.emit(); }
  onShareInvitation()      { this.shareInvitation.emit(); }
}
