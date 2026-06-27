import { Component, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { GameType, GameVariant } from '@sn/shared/game-types';
import { GameService } from '../../services/game.service';
import { gameLabel } from '../../constants/game-labels';

@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [FormsModule],
  styleUrls: ['./lobby.component.css'],
  template: `
    <div class="lobby-container">
      @if (!username()) {
        <!-- Username & PIN Connection Flow -->
        <div class="surface-card username-card">
          <div class="user-hero">
            <span class="material-symbols hero-icon">account_circle</span>
          </div>

          @if (loginStep() === 'username') {
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
              @if (errorMessage()) {
                <div class="form-error-msg" style="color: var(--md-error); font-size: 13px; margin-top: 4px; text-align: left; width: 100%;">
                  {{ errorMessage() }}
                </div>
              }
              <button type="submit" class="primary-btn">
                <span>Continuer</span>
                <span class="material-symbols">arrow_forward</span>
              </button>
            </form>
          } @else if (loginStep() === 'pin-login') {
            <div class="card-text">
              <h2>Compte sécurisé</h2>
              <p>Ce pseudonyme (<strong>{{ tempUsername }}</strong>) est protégé. Saisissez votre code PIN (4-6 chiffres) pour vous connecter.</p>
            </div>
            <form (submit)="confirmLogin(); $event.preventDefault()">
              <input
                type="password"
                [(ngModel)]="pinCode"
                name="pinCode"
                placeholder="Code PIN..."
                pattern="\\d{4,6}"
                inputmode="numeric"
                maxlength="6"
                style="-webkit-text-security: disc; text-align: center; font-size: 18px; letter-spacing: 4px; font-family: monospace;"
                required
                autocomplete="current-password"
              />
              @if (errorMessage()) {
                <div class="form-error-msg" style="color: var(--md-error); font-size: 13px; margin-top: 4px; text-align: left; width: 100%;">
                  {{ errorMessage() }}
                </div>
              }
              <div style="display: flex; gap: 8px; width: 100%; margin-top: 8px;">
                <button type="button" class="outlined-btn" (click)="resetStep()" style="flex: 1;">
                  <span>Retour</span>
                </button>
                <button type="submit" class="primary-btn" style="flex: 2;">
                  <span>Se connecter</span>
                  <span class="material-symbols">login</span>
                </button>
              </div>
            </form>
          } @else if (loginStep() === 'pin-create') {
            <div class="card-text">
              <h2>Sécuriser votre compte ?</h2>
              <p>Voulez-vous créer un code PIN pour enregistrer vos statistiques de victoire et progression sur le serveur ?</p>
            </div>
            <form (submit)="confirmRegisterSecured(); $event.preventDefault()">
              <div style="display: flex; flex-direction: column; gap: 6px; width: 100%; margin-bottom: 8px;">
                <label style="font-size: 12px; font-weight: 500; color: var(--md-on-surface-variant); text-align: left;">Code PIN de sécurité (4 à 6 chiffres)</label>
                <input
                  type="password"
                  [(ngModel)]="pinCode"
                  name="pinCode"
                  placeholder="Code PIN à créer..."
                  pattern="\\d{4,6}"
                  inputmode="numeric"
                  maxlength="6"
                  style="-webkit-text-security: disc; text-align: center; font-size: 18px; letter-spacing: 4px; font-family: monospace;"
                  autocomplete="new-password"
                />
              </div>
              @if (errorMessage()) {
                <div class="form-error-msg" style="color: var(--md-error); font-size: 13px; margin-top: 4px; text-align: left; width: 100%;">
                  {{ errorMessage() }}
                </div>
              }
              <div style="display: flex; flex-direction: column; gap: 8px; width: 100%; margin-top: 8px;">
                <button type="submit" class="primary-btn" [disabled]="!pinCode || pinCode.length < 4 || pinCode.length > 6">
                  <span class="material-symbols">shield</span>
                  <span>Créer mon compte sécurisé</span>
                </button>
                <button type="button" class="text-btn" (click)="confirmRegisterTemp()" style="font-size: 13px; padding: 10px; color: var(--md-secondary);">
                  <span>Continuer en compte temporaire (invité)</span>
                </button>
                <button type="button" class="outlined-btn" (click)="resetStep()" style="font-size: 13px; padding: 10px;">
                  <span>Retour au pseudo</span>
                </button>
              </div>
            </form>
          }
        </div>
      } @else if (selectedGame() === null) {
        <!-- Step 1: Select Game -->
        <div class="game-select-view">
          <div class="welcome-header">
            <h2>Bonjour, <strong>{{ username() }}</strong> !</h2>
            <p>Sélectionnez un jeu pour voir les salons disponibles ou en créer un nouveau.</p>
          </div>

          @if (activeRooms().length > 0) {
            <div class="surface-card active-rooms-card" style="text-align: left; padding: 20px; animation: slideFadeIn 0.3s ease; box-shadow: var(--md-elevation-1);">
              <h3 style="margin: 0 0 14px; font-size: 16px; font-weight: 600; color: var(--md-on-surface); display: flex; align-items: center; gap: 8px;">
                <span class="material-symbols" style="color: var(--md-primary);">sports_esports</span>
                Parties prêtes à rejoindre
              </h3>
              <div class="active-rooms-list" style="display: flex; flex-direction: column; gap: 10px;">
                @for (room of activeRooms(); track room.id) {
                  <div class="active-room-item" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-radius: var(--md-radius-md); background: var(--md-surface-container-high); border: 1px solid var(--md-outline-variant); transition: transform 0.2s, border-color 0.2s;">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                      <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span style="font-weight: 600; font-size: 14px; color: var(--md-on-surface);">{{ translateGame(room.gameType) }}</span>
                        @if (room.isPrivate) {
                          <span style="background: rgba(157, 142, 255, 0.15); color: #B0A2FF; font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 8px; display: inline-flex; align-items: center; gap: 3px;">
                            <span class="material-symbols" style="font-size: 12px;">lock</span>
                            Privé
                          </span>
                        }
                        @if (room.creator && gameService.friends().includes(room.creator)) {
                          <span style="background: rgba(0, 229, 255, 0.15); color: #00E5FF; font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 8px; display: inline-flex; align-items: center; gap: 3px;">
                            <span class="material-symbols" style="font-size: 12px;">group</span>
                            Ami
                          </span>
                        }
                      </div>
                      <div style="font-size: 12px; color: var(--md-on-surface-variant);">
                        Créé par <strong>{{ room.creator }}</strong> • {{ room.playersCount }}/2 joueurs
                      </div>
                    </div>
                    <button class="primary-btn" (click)="joinRoom(room.id)" style="padding: 8px 16px; font-size: 13px;">Rejoindre</button>
                  </div>
                }
              </div>
            </div>
          }

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

            <button class="game-card" (click)="selectGame('pong')">
              <div class="game-card-image">
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="100" height="100" rx="24" fill="#050505"/>
                  <line x1="50" y1="15" x2="50" y2="85" stroke="#1A3D2B" stroke-width="3" stroke-dasharray="6 6"/>
                  <rect x="12" y="35" width="8" height="30" rx="4" fill="#00E676"/>
                  <rect x="80" y="35" width="8" height="30" rx="4" fill="#00E5FF"/>
                  <circle cx="50" cy="50" r="7" fill="#FFFFFF"/>
                </svg>
              </div>
              <div class="game-card-info">
                <span class="game-name">Pong</span>
                <span class="game-tag">Temps réel</span>
              </div>
            </button>

            <button class="game-card" (click)="selectGame('pendu')">
              <div class="game-card-image">
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="100" height="100" rx="24" fill="#1C1A0F"/>
                  <line x1="20" y1="85" x2="55" y2="85" stroke="#5D5030" stroke-width="4" stroke-linecap="round"/>
                  <line x1="30" y1="85" x2="30" y2="20" stroke="#5D5030" stroke-width="4" stroke-linecap="round"/>
                  <line x1="30" y1="20" x2="65" y2="20" stroke="#5D5030" stroke-width="4" stroke-linecap="round"/>
                  <line x1="65" y1="20" x2="65" y2="32" stroke="#5D5030" stroke-width="3" stroke-linecap="round"/>
                  <circle cx="65" cy="40" r="8" stroke="#FFEA00" stroke-width="2" fill="none"/>
                  <line x1="65" y1="48" x2="65" y2="68" stroke="#FFEA00" stroke-width="2" stroke-linecap="round"/>
                  <line x1="65" y1="55" x2="55" y2="63" stroke="#FFEA00" stroke-width="2" stroke-linecap="round"/>
                  <line x1="65" y1="55" x2="75" y2="63" stroke="#FFEA00" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </div>
              <div class="game-card-info">
                <span class="game-name">Le Pendu</span>
                <span class="game-tag">Mots</span>
              </div>
            </button>

            <button class="game-card" (click)="selectGame('dominos')">
              <div class="game-card-image">
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="100" height="100" rx="24" fill="#3E2723"/>
                  <rect x="25" y="35" width="50" height="30" rx="6" fill="#EFEBE9" stroke="#D7CCC8" stroke-width="2"/>
                  <line x1="50" y1="35" x2="50" y2="65" stroke="#D7CCC8" stroke-width="2"/>
                  <!-- left: 3 dots -->
                  <circle cx="35" cy="42" r="3" fill="#3E2723"/>
                  <circle cx="44" cy="58" r="3" fill="#3E2723"/>
                  <circle cx="39.5" cy="50" r="3" fill="#3E2723"/>
                  <!-- right: 4 dots -->
                  <circle cx="57" cy="42" r="3" fill="#3E2723"/>
                  <circle cx="66" cy="42" r="3" fill="#3E2723"/>
                  <circle cx="57" cy="58" r="3" fill="#3E2723"/>
                  <circle cx="66" cy="58" r="3" fill="#3E2723"/>
                </svg>
              </div>
              <div class="game-card-info">
                <span class="game-name">Dominos</span>
                <span class="game-tag">Classique</span>
              </div>
            </button>

            <button class="game-card" (click)="selectGame('tetris')">
              <div class="game-card-image">
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="100" height="100" rx="24" fill="#0d0d1a"/>
                  <rect x="10" y="44" width="10" height="10" rx="2" fill="#00E5FF"/>
                  <rect x="22" y="44" width="10" height="10" rx="2" fill="#00E5FF"/>
                  <rect x="34" y="44" width="10" height="10" rx="2" fill="#00E5FF"/>
                  <rect x="46" y="44" width="10" height="10" rx="2" fill="#00E5FF"/>
                  <rect x="58" y="34" width="10" height="10" rx="2" fill="#E040FB"/>
                  <rect x="58" y="46" width="10" height="10" rx="2" fill="#E040FB"/>
                  <rect x="70" y="46" width="10" height="10" rx="2" fill="#E040FB"/>
                  <rect x="46" y="46" width="10" height="10" rx="2" fill="#E040FB"/>
                  <rect x="22" y="58" width="10" height="10" rx="2" fill="#FF9100"/>
                  <rect x="22" y="70" width="10" height="10" rx="2" fill="#FF9100"/>
                  <rect x="22" y="82" width="10" height="10" rx="2" fill="#FF9100"/>
                  <rect x="34" y="82" width="10" height="10" rx="2" fill="#FF9100"/>
                  <rect x="58" y="70" width="10" height="10" rx="2" fill="#69F0AE"/>
                  <rect x="70" y="70" width="10" height="10" rx="2" fill="#69F0AE"/>
                  <rect x="46" y="82" width="10" height="10" rx="2" fill="#69F0AE"/>
                  <rect x="58" y="82" width="10" height="10" rx="2" fill="#69F0AE"/>
                </svg>
              </div>
              <div class="game-card-info">
                <span class="game-name">Tetris vs</span>
                <span class="game-tag">Temps réel</span>
              </div>
            </button>

            <button class="game-card" (click)="selectGame('snake')">
              <div class="game-card-image">
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="100" height="100" rx="24" fill="#0a1a0f"/>
                  <!-- P1 green snake -->
                  <rect x="15" y="45" width="12" height="12" rx="3" fill="#00E676"/>
                  <rect x="27" y="45" width="12" height="12" rx="3" fill="#00BFA5"/>
                  <rect x="27" y="57" width="12" height="12" rx="3" fill="#00BFA5"/>
                  <rect x="39" y="57" width="12" height="12" rx="3" fill="#00BFA5"/>
                  <!-- P2 cyan snake -->
                  <rect x="73" y="45" width="12" height="12" rx="3" fill="#00E5FF"/>
                  <rect x="61" y="45" width="12" height="12" rx="3" fill="#0097A7"/>
                  <rect x="61" y="33" width="12" height="12" rx="3" fill="#0097A7"/>
                  <rect x="49" y="33" width="12" height="12" rx="3" fill="#0097A7"/>
                  <!-- Food -->
                  <circle cx="50" cy="63" r="6" fill="#FF5252"/>
                </svg>
              </div>
              <div class="game-card-info">
                <span class="game-name">Snake vs</span>
                <span class="game-tag">Temps réel</span>
              </div>
            </button>

            <button class="game-card" (click)="selectGame('memory')">
              <div class="game-card-image">
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="100" height="100" rx="24" fill="#1a0a2e"/>
                  <rect x="12" y="12" width="18" height="18" rx="4" fill="#3f51b5"/>
                  <rect x="34" y="12" width="18" height="18" rx="4" fill="#3f51b5"/>
                  <rect x="56" y="12" width="18" height="18" rx="4" fill="#7c4dff"/>
                  <rect x="78" y="12" width="10" height="18" rx="4" fill="#3f51b5"/>
                  <rect x="12" y="34" width="18" height="18" rx="4" fill="#7c4dff"/>
                  <rect x="34" y="34" width="18" height="18" rx="4" fill="#fff9c4"/>
                  <rect x="56" y="34" width="18" height="18" rx="4" fill="#fff9c4"/>
                  <rect x="78" y="34" width="10" height="18" rx="4" fill="#3f51b5"/>
                  <rect x="12" y="56" width="18" height="18" rx="4" fill="#3f51b5"/>
                  <rect x="34" y="56" width="18" height="18" rx="4" fill="#c8e6c9"/>
                  <rect x="56" y="56" width="18" height="18" rx="4" fill="#c8e6c9"/>
                  <rect x="78" y="56" width="10" height="18" rx="4" fill="#3f51b5"/>
                  <rect x="12" y="78" width="18" height="10" rx="4" fill="#7c4dff"/>
                  <rect x="34" y="78" width="18" height="10" rx="4" fill="#3f51b5"/>
                  <rect x="56" y="78" width="18" height="10" rx="4" fill="#3f51b5"/>
                  <rect x="78" y="78" width="10" height="10" rx="4" fill="#7c4dff"/>
                </svg>
              </div>
              <div class="game-card-info">
                <span class="game-name">Memory</span>
                <span class="game-tag">Mémoire</span>
              </div>
            </button>

            <button class="game-card" (click)="selectGame('uno')">
              <div class="game-card-image">
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="100" height="100" rx="24" fill="#1a0a0a"/>
                  <rect x="20" y="20" width="24" height="36" rx="6" fill="#e53935"/>
                  <rect x="26" y="28" width="12" height="20" rx="3" fill="rgba(255,255,255,0.2)"/>
                  <text x="32" y="42" font-size="10" fill="white" text-anchor="middle" font-weight="bold">7</text>
                  <rect x="38" y="28" width="24" height="36" rx="6" fill="#1e88e5"/>
                  <text x="50" y="50" font-size="10" fill="white" text-anchor="middle" font-weight="bold">R</text>
                  <rect x="56" y="20" width="24" height="36" rx="6" fill="#43a047"/>
                  <text x="68" y="42" font-size="10" fill="white" text-anchor="middle" font-weight="bold">+2</text>
                  <rect x="25" y="54" width="50" height="28" rx="6" fill="#fdd835"/>
                  <text x="50" y="72" font-size="14" fill="#333" text-anchor="middle" font-weight="bold">🌈</text>
                </svg>
              </div>
              <div class="game-card-info">
                <span class="game-name">8 Américain</span>
                <span class="game-tag">Cartes</span>
              </div>
            </button>

            <button class="game-card" (click)="selectGame('blackjack')">
              <div class="game-card-image">
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="100" height="100" rx="24" fill="#0a1a0a"/>
                  <rect x="15" y="20" width="28" height="40" rx="6" fill="white"/>
                  <text x="29" y="44" font-size="14" fill="#c62828" text-anchor="middle" font-weight="bold">A♥</text>
                  <rect x="30" y="30" width="28" height="40" rx="6" fill="white"/>
                  <text x="44" y="54" font-size="14" fill="#222" text-anchor="middle" font-weight="bold">K♠</text>
                  <rect x="55" y="25" width="28" height="40" rx="6" fill="#1a237e"/>
                  <text x="69" y="49" font-size="18" fill="rgba(255,255,255,0.3)" text-anchor="middle">🂠</text>
                  <circle cx="50" cy="85" r="8" fill="#ffd740" opacity="0.8"/>
                  <text x="50" y="89" font-size="9" fill="#222" text-anchor="middle" font-weight="bold">21</text>
                </svg>
              </div>
              <div class="game-card-info">
                <span class="game-name">Blackjack</span>
                <span class="game-tag">Casino</span>
              </div>
            </button>

          </div>
        </div>
      } @else {
        <!-- Step 2: Game Lobby View -->
        <div class="game-lobby-view">
          <div class="lobby-topbar">
            <button class="icon-btn" (click)="selectGame(null)" title="Retour à la sélection des jeux">
              <span class="material-symbols">arrow_back</span>
            </button>
            <nav class="lobby-breadcrumb" aria-label="Fil d'Ariane">
              <span class="breadcrumb-home" (click)="selectGame(null)" role="button" tabindex="0"
                    (keydown.enter)="selectGame(null)" (keydown.space)="selectGame(null)">Jeux</span>
              <span class="material-symbols breadcrumb-sep" aria-hidden="true">chevron_right</span>
              <span class="breadcrumb-current">{{ gameName() }}</span>
            </nav>
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
                    <div class="room-code">
                      {{ room.id }}
                      @if (room.variant) {
                        <span class="variant-badge" [class]="room.variant">
                          {{ room.variant === 'classic' ? 'Classique' : room.variant === 'branches' ? 'Branches' : 'Grille 2D' }}
                        </span>
                      }
                    </div>
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
                } @else if (selectedGame() === 'pong') {
                  <div class="rules-section">
                    <h4>Règles du jeu</h4>
                    <p>Le Pong se joue en temps réel : la physique de la balle est calculée sur le serveur à 30 Hz pour garantir une équité totale. Le premier joueur à marquer 5 points gagne la partie.</p>
                    <h4>Comment jouer</h4>
                    <ul>
                      <li>Déplacez votre raquette en bougeant la souris (ou le doigt en mode tactile) verticalement sur votre côté du terrain.</li>
                      <li>Toucher la balle en bord de raquette lui donne un angle plus prononcé — utile pour surprendre l'adversaire !</li>
                      <li>La balle accélère légèrement à chaque échange ; restez concentré.</li>
                      <li>En partie locale, la moitié gauche contrôle le Joueur 1 et la moitié droite le Joueur 2.</li>
                    </ul>
                  </div>
                } @else if (selectedGame() === 'pendu') {
                  <div class="rules-section">
                    <h4>Règles du jeu</h4>
                    <p>Le serveur sélectionne aléatoirement un mot dans un dictionnaire de mots français. Les deux joueurs s'affrontent à tour de rôle pour deviner le mot lettre par lettre avant que le pendu ne soit entièrement dessiné (7 erreurs maximum).</p>
                    <h4>Système de points</h4>
                    <ul>
                      <li>Lettre correcte : +10 points par occurrence dans le mot.</li>
                      <li>Lettre incorrecte : −5 points.</li>
                      <li>Fin de partie : le joueur avec le plus de points gagne. Si le pendu est complet, la partie se termine par une égalité (pénalité pour les deux).</li>
                    </ul>
                    <h4>Comment jouer</h4>
                    <ul>
                      <li>Cliquez sur une lettre du clavier virtuel pendant votre tour pour la proposer.</li>
                      <li>Les lettres trouvées apparaissent dans le mot en vert. Les erreurs s'affichent en rouge et complètent le dessin du pendu.</li>
                    </ul>
                  </div>
                } @else if (selectedGame() === 'tetris') {
                  <div class="rules-section">
                    <h4>Règles du jeu</h4>
                    <p>Chaque joueur a son propre plateau 10×20. Effacez des lignes pour envoyer des <em>garbage lines</em> à l'adversaire. Le premier joueur dont la pièce dépasse le sommet du plateau perd.</p>
                    <h4>Contrôles</h4>
                    <ul>
                      <li>← → : déplacer (DAS/ARR auto-repeat)</li>
                      <li>↑ / X : rotation droite | Z / Ctrl : rotation gauche</li>
                      <li>↓ : soft drop | Espace : hard drop</li>
                      <li>C / Shift : hold</li>
                      <li><b>Mode local P2</b> : A/D déplacer, W rotation, S soft drop, Q rot. gauche, E hard drop, R hold</li>
                    </ul>
                    <h4>Garbage</h4>
                    <ul>
                      <li>1 ligne effacée → 0 garbage</li>
                      <li>2 lignes → 1 garbage | 3 lignes → 2 garbage</li>
                      <li>4 lignes (Tetris) → 4 garbage</li>
                    </ul>
                  </div>
                } @else if (selectedGame() === 'snake') {
                  <div class="rules-section">
                    <h4>Règles du jeu</h4>
                    <p>Deux serpents s'affrontent sur une grille 25×20 en temps réel (15 mouvements/s). Mangez les pommes pour grandir et marquer des points. Évitez les murs, votre propre corps et celui de l'adversaire.</p>
                    <h4>Contrôles</h4>
                    <ul>
                      <li><b>Joueur 1</b> : flèches ← → ↑ ↓</li>
                      <li><b>Joueur 2 (mode local)</b> : touches WASD</li>
                      <li><b>Mobile</b> : swipe pour changer de direction</li>
                    </ul>
                    <h4>Fin de partie</h4>
                    <ul>
                      <li>Un serpent meurt s'il touche un mur, lui-même ou l'adversaire.</li>
                      <li>Si les deux serpents meurent au même tick, la partie est nulle.</li>
                    </ul>
                  </div>
                } @else if (selectedGame() === 'dominos') {
                  <div class="rules-section">
                    <h4>Règles du jeu</h4>
                    <p>Le jeu se joue avec un jeu de 28 dominos (double-six). Chaque joueur reçoit 7 dominos au début de la partie. Le reste constitue la pioche (le talon ou <i>boneyard</i>). À tour de rôle, chaque joueur pose un domino de sa main à l'une des deux extrémités de la chaîne sur le plateau en faisant correspondre le nombre de points.</p>
                    <h4>Pioche & Passer</h4>
                    <ul>
                      <li>Si vous n'avez pas de domino jouable dans votre main, vous devez piocher dans le talon (boneyard) jusqu'à ce que vous puissiez jouer ou que le talon soit vide.</li>
                      <li>Si le talon est vide et que vous n'avez aucun coup possible, vous devez passer votre tour.</li>
                    </ul>
                    <h4>Fin de partie</h4>
                    <ul>
                      <li>La partie se termine lorsqu'un joueur a posé tous ses dominos (victoire immédiate).</li>
                      <li>Elle se termine aussi si le jeu est bloqué (plus aucun joueur ne peut poser et le talon est vide). Le joueur ayant le moins de points (somme des points de ses dominos restants) gagne alors la partie. En cas d'égalité parfaite de points, la partie est nulle.</li>
                    </ul>
                  </div>
                } @else if (selectedGame() === 'memory') {
                  <div class="rules-section">
                    <h4>Règles du jeu</h4>
                    <p>Grille 4×4 = 8 paires de cartes retournées face cachée. À tour de rôle, retournez 2 cartes. Trouvez une paire : vous marquez un point et rejouez. Mismatch : les cartes sont retournées après 1,5 s. Le joueur avec le plus de paires gagne.</p>
                  </div>
                } @else if (selectedGame() === 'uno') {
                  <div class="rules-section">
                    <h4>Règles du jeu</h4>
                    <p>Soyez le premier à vider votre main. Jouez une carte de même couleur ou valeur que la défausse. Les cartes spéciales : Skip/Reverse = rejouer, +2 = adversaire pioche 2, Wild = choisissez la couleur, Wild+4 = adversaire pioche 4.</p>
                  </div>
                } @else if (selectedGame() === 'blackjack') {
                  <div class="rules-section">
                    <h4>Règles du jeu</h4>
                    <p>2 joueurs contre le dealer. Misez entre 10 et 500 chips. Approchez 21 sans dépasser. Blackjack (As + 10) paie 1,5×. Le dealer tire jusqu'à 17. 10 manches — le plus de chips gagne.</p>
                    <h4>Actions</h4>
                    <ul>
                      <li><b>Hit</b> : piocher une carte</li>
                      <li><b>Stand</b> : passer sans piocher</li>
                      <li><b>Double</b> : doubler la mise et piocher exactement 1 carte</li>
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

            @if (onlineFriends().length > 0) {
              <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 16px; text-align: left;">
                <label style="font-size: 13px; font-weight: 600; color: var(--md-on-surface-variant);">Inviter un ami en ligne (Optionnel)</label>
                <select [value]="selectedFriendToInvite()" (change)="selectedFriendToInvite.set($any($event.target).value); isPrivateChoice.set(true)" style="width: 100%; padding: 10px 12px; border-radius: var(--md-radius-md); border: 1px solid var(--md-outline-variant); background: var(--md-surface-container-high); color: var(--md-on-surface); font-size: 14px; font-family: inherit; outline: none;">
                  <option value="">-- Sélectionner un ami --</option>
                  @for (friend of onlineFriends(); track friend.id) {
                    <option [value]="friend.username">{{ friend.username }}</option>
                  }
                </select>
                <span style="font-size: 11px; color: var(--md-secondary);">Note: Inviter un ami forcera le salon en mode privé.</span>
              </div>
            }

            <div class="modal-actions" style="margin-top: 20px;">
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
      @if (showDominosVariantModal()) {
        <div class="modal-overlay">
          <div class="modal-card" style="max-width: 480px; width: 90%;">
            <div class="modal-header">
              <h3>Variante de Dominos</h3>
              <button class="icon-btn" (click)="showDominosVariantModal.set(false)">
                <span class="material-symbols">close</span>
              </button>
            </div>
            <p class="modal-desc">Choisissez la variante et découvrez ses règles.</p>

            <div class="variant-tabs" style="display: flex; gap: 8px; margin-bottom: 8px;">
              <button type="button" class="variant-tab-btn" [class.active]="dominosVariant() === 'classic'" (click)="dominosVariant.set('classic')" style="flex: 1; padding: 10px; border-radius: var(--md-radius-md); border: 1px solid var(--md-outline-variant); background: transparent; cursor: pointer; color: var(--md-on-surface); font-weight: 600; font-family: inherit;">
                Classique
              </button>
              <button type="button" class="variant-tab-btn" [class.active]="dominosVariant() === 'branches'" (click)="dominosVariant.set('branches')" style="flex: 1; padding: 10px; border-radius: var(--md-radius-md); border: 1px solid var(--md-outline-variant); background: transparent; cursor: pointer; color: var(--md-on-surface); font-weight: 600; font-family: inherit;">
                Branches
              </button>
              <button type="button" class="variant-tab-btn" [class.active]="dominosVariant() === 'grid'" (click)="dominosVariant.set('grid')" style="flex: 1; padding: 10px; border-radius: var(--md-radius-md); border: 1px solid var(--md-outline-variant); background: transparent; cursor: pointer; color: var(--md-on-surface); font-weight: 600; font-family: inherit;">
                Grille 2D
              </button>
            </div>

            <!-- Rules Explanation panel -->
            <div class="variant-rules-desc" style="padding: 14px; border-radius: var(--md-radius-md); background: var(--md-surface-container-highest); text-align: left; min-height: 120px; font-size: 13px; line-height: 1.6; color: var(--md-on-surface-variant); border: 1px solid var(--md-outline-variant);">
              @if (dominosVariant() === 'classic') {
                <strong style="color: var(--md-primary); display: block; margin-bottom: 4px; font-size: 14px;">Domino Classique :</strong>
                <span>Le jeu de domino standard. Les joueurs alignent les tuiles les unes après les autres en formant une seule chaîne linéaire. Seules les deux extrémités de la ligne sont jouables.</span>
              } @else if (dominosVariant() === 'branches') {
                <strong style="color: var(--md-primary); display: block; margin-bottom: 4px; font-size: 14px;">Branches Doubles (Junctions) :</strong>
                <span>Chaque fois qu'un domino double (ex. 6-6, 5-5) est joué, il ouvre une nouvelle branche perpendiculaire (haut et bas). Les joueurs peuvent poser leurs tuiles sur n'importe quel bout ouvert de cette structure en arbre !</span>
              } @else if (dominosVariant() === 'grid') {
                <strong style="color: var(--md-primary); display: block; margin-bottom: 4px; font-size: 14px;">Grille 2D (Puzzle) :</strong>
                <span>Les dominos sont posés librement sur une grille plate en deux dimensions. Pour poser un domino, celui-ci doit toucher au moins un domino existant, et TOUTES ses faces adjacentes doivent correspondre parfaitement en nombre de points !</span>
              }
            </div>

            <!-- Configuration (Private toggle or Player Names) -->
            @if (isLocalDominos()) {
              <form (submit)="confirmDominosCreate(); $event.preventDefault()" style="display: flex; flex-direction: column; gap: 12px; width: 100%;">
                <div class="input-col" style="display: flex; flex-direction: column; gap: 4px;">
                  <label style="font-size: 12px; font-weight: 500; color: var(--md-on-surface-variant); text-align: left;">Pseudonyme Joueur 1</label>
                  <input type="text" [(ngModel)]="localPlayer1Name" name="localPlayer1Name" required style="width: 100%; box-sizing: border-box;" />
                </div>
                <div class="input-col" style="display: flex; flex-direction: column; gap: 4px;">
                  <label style="font-size: 12px; font-weight: 500; color: var(--md-on-surface-variant); text-align: left;">Pseudonyme Joueur 2</label>
                  <input type="text" [(ngModel)]="localPlayer2Name" name="localPlayer2Name" required style="width: 100%; box-sizing: border-box;" />
                </div>
                <div class="modal-actions" style="margin-top: 8px;">
                  <button type="button" class="outlined-btn" (click)="showDominosVariantModal.set(false)">Annuler</button>
                  <button type="submit" class="primary-btn">Lancer la partie</button>
                </div>
              </form>
            } @else {
              <!-- Online game option -->
              <div style="display: flex; flex-direction: column; gap: 16px; width: 100%;">
                <label class="checkbox-row" style="display: flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer; user-select: none;">
                  <input type="checkbox" [checked]="isPrivateChoice()" (change)="isPrivateChoice.set(!isPrivateChoice())" />
                  <span>Rendre la partie privée (accessible uniquement par code)</span>
                </label>

                @if (onlineFriends().length > 0) {
                  <div style="display: flex; flex-direction: column; gap: 6px; text-align: left;">
                    <label style="font-size: 12px; font-weight: 600; color: var(--md-on-surface-variant);">Inviter un ami en ligne (Optionnel)</label>
                    <select [value]="selectedFriendToInvite()" (change)="selectedFriendToInvite.set($any($event.target).value); isPrivateChoice.set(true)" style="width: 100%; padding: 8px 10px; border-radius: var(--md-radius-md); border: 1px solid var(--md-outline-variant); background: var(--md-surface-container-high); color: var(--md-on-surface); font-size: 13px; font-family: inherit; outline: none;">
                      <option value="">-- Sélectionner un ami --</option>
                      @for (friend of onlineFriends(); track friend.id) {
                        <option [value]="friend.username">{{ friend.username }}</option>
                      }
                    </select>
                    <span style="font-size: 10px; color: var(--md-secondary);">Note: Inviter un ami forcera le salon en mode privé.</span>
                  </div>
                }

                <div class="modal-actions">
                  <button type="button" class="outlined-btn" (click)="showDominosVariantModal.set(false)">Annuler</button>
                  <button type="button" class="primary-btn" (click)="confirmDominosCreate()">Créer le salon</button>
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `
})
export class LobbyComponent {
  tempUsername = '';
  joinCode = '';
  
  // PIN Connection Flow variables
  loginStep = signal<'username' | 'pin-create' | 'pin-login'>('username');
  pinCode = '';
  errorMessage = signal<string>('');

  // Friend direct invitation variable
  selectedFriendToInvite = signal<string>('');

  selectedGame;
  showCreateModal = signal<boolean>(false);
  isPrivateChoice = signal<boolean>(false);
  showRules = signal<boolean>(false);

  showLocalNamesModal = signal<boolean>(false);
  localPlayer1Name = '';
  localPlayer2Name = '';

  showDominosVariantModal = signal<boolean>(false);
  dominosVariant = signal<GameVariant>('classic');
  isLocalDominos = signal<boolean>(false);

  username;
  roomsList;

  filteredRooms = computed(() => {
    return this.roomsList().filter(r => r.gameType === this.selectedGame());
  });

  gameName = computed(() => gameLabel(this.selectedGame() ?? ''));

  // Friends currently online
  onlineFriends = computed(() => {
    const list = this.gameService.friends();
    return this.gameService.onlineUsers().filter(u => list.includes(u.username) && u.username !== this.username());
  });

  // Active rooms in waiting state (public rooms + friends' private rooms)
  activeRooms = computed(() => {
    const allRooms = this.roomsList();
    const list = this.gameService.friends();
    const me = this.username();

    return allRooms.filter(r => {
      // Must be waiting
      if (r.status !== 'waiting') return false;
      // Exclude our own room
      if (r.creator === me) return false;

      // Public room
      if (!r.isPrivate) return true;

      // Private room created by a friend
      if (r.isPrivate && r.creator && list.includes(r.creator)) return true;

      return false;
    });
  });

  constructor(public gameService: GameService) {
    this.selectedGame = this.gameService.activeGame;
    this.username = this.gameService.username;
    this.roomsList = this.gameService.roomsList;
    this.tempUsername = this.username();
  }

  translateGame(game: string): string {
    return gameLabel(game);
  }

  async saveUsername() {
    const name = this.tempUsername.trim();
    if (!name) return;
    this.errorMessage.set('');
    try {
      const status = await this.gameService.checkUsername(name);
      if (status.exists) {
        if (status.requiresPin) {
          this.loginStep.set('pin-login');
        } else {
          // If guest user exists on server, try to register.
          // The server will trigger 'This nickname is already taken' if it is active.
          const res = await this.gameService.registerUser(name, null);
          if (!res.success) {
            this.errorMessage.set(res.message || 'Ce pseudonyme est déjà pris.');
          }
        }
      } else {
        this.loginStep.set('pin-create');
      }
    } catch (err: any) {
      this.errorMessage.set('Une erreur est survenue lors de la vérification.');
    }
  }

  async confirmLogin() {
    const name = this.tempUsername.trim();
    const pin = this.pinCode.trim();
    if (!name || !pin) return;
    this.errorMessage.set('');
    const res = await this.gameService.loginUser(name, pin);
    if (res.success) {
      this.pinCode = '';
      this.loginStep.set('username');
    } else {
      this.errorMessage.set(res.message || 'Pseudonyme ou code PIN incorrect.');
    }
  }

  async confirmRegisterSecured() {
    const name = this.tempUsername.trim();
    const pin = this.pinCode.trim();
    if (!name || !pin) return;
    if (pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
      this.errorMessage.set('Le code PIN doit comporter entre 4 et 6 chiffres.');
      return;
    }
    this.errorMessage.set('');
    const res = await this.gameService.registerUser(name, pin);
    if (res.success) {
      this.pinCode = '';
      this.loginStep.set('username');
    } else {
      this.errorMessage.set(res.message || 'Erreur lors de la création du compte.');
    }
  }

  async confirmRegisterTemp() {
    const name = this.tempUsername.trim();
    if (!name) return;
    this.errorMessage.set('');
    const res = await this.gameService.registerUser(name, null);
    if (res.success) {
      this.pinCode = '';
      this.loginStep.set('username');
    } else {
      this.errorMessage.set(res.message || 'Erreur lors de la création du compte temporaire.');
    }
  }

  resetStep() {
    this.loginStep.set('username');
    this.pinCode = '';
    this.errorMessage.set('');
  }

  selectGame(game: GameType | null) {
    this.selectedGame.set(game);
    this.showRules.set(false);
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
    this.selectedFriendToInvite.set('');
    if (this.selectedGame() === 'dominos') {
      this.isLocalDominos.set(false);
      this.dominosVariant.set('classic');
      this.showDominosVariantModal.set(true);
    } else {
      this.showCreateModal.set(true);
    }
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
    if (this.selectedGame() === 'dominos') {
      this.isLocalDominos.set(true);
      this.dominosVariant.set('classic');
      this.showDominosVariantModal.set(true);
    } else {
      this.showLocalNamesModal.set(true);
    }
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
      this.gameService.createRoom(
        game as any,
        this.isPrivateChoice(),
        undefined,
        this.selectedFriendToInvite() || undefined
      );
      this.closeCreateModal();
    }
  }

  confirmDominosCreate() {
    if (this.isLocalDominos()) {
      this.gameService.createLocalRoom('dominos', this.localPlayer1Name, this.localPlayer2Name, this.dominosVariant());
    } else {
      this.gameService.createRoom(
        'dominos',
        this.isPrivateChoice(),
        this.dominosVariant(),
        this.selectedFriendToInvite() || undefined
      );
    }
    this.showDominosVariantModal.set(false);
  }
}
