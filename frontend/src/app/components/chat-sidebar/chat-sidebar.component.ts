import { Component, ElementRef, Input, OnDestroy, ViewChild, computed, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { GameService } from '../../services/game.service';
import { GameHelpersService } from '../../services/game-helpers.service';
import { GameChatComponent } from './game-chat.component';

@Component({
  selector: 'app-chat-sidebar',
  standalone: true,
  imports: [FormsModule, DatePipe, GameChatComponent],
  template: `
    <div class="chat-wrapper" [class.open]="isOpen" [class.desktop-hidden]="!desktopVisible">
      <!-- Toggle Button -->
      <button class="chat-toggle" (click)="toggleChat()" [class.has-unread]="hasUnread && !isOpen">
        <span class="material-symbols">chat_bubble</span>
        @if (hasUnread && !isOpen) {
          <span class="unread-dot"></span>
        }
      </button>

        <!-- Chat Panel -->
        <div class="chat-panel">
          <!-- Chat Header Tabs -->
          <div class="chat-header">
            <div class="header-tabs">
              <button class="tab-btn" [class.active]="sidebarTab === 'chat'" (click)="sidebarTab = 'chat'">Global</button>
              <button class="tab-btn" [class.active]="sidebarTab === 'social'" (click)="sidebarTab = 'social'">Amis</button>
            </div>
            <button class="icon-btn" (click)="toggleChat()">
              <span class="material-symbols">close</span>
            </button>
          </div>
  
          @if (sidebarTab === 'chat') {
            <!-- Chat Tabs (if in a room) -->
            @if (currentRoom()) {
              <div class="chat-tabs">
                <button [class.active]="activeTab === 'global'" (click)="activeTab = 'global'">
                  Global
                </button>
                <button [class.active]="activeTab === 'room'" (click)="activeTab = 'room'">
                  Partie
                </button>
              </div>
            }
  
            <!-- Unified Chat Component -->
            <app-game-chat
              [messages]="currentMessages()"
              [currentUser]="username()"
              (sendMessage)="onGameChatMessageSent($event)"
            ></app-game-chat>
          } @else {
            <!-- Social / Amis View -->
            @if (selectedFriendForChat()) {
              <div class="dm-chat-container">
                <div class="dm-chat-header">
                  <button class="icon-btn back-btn" (click)="selectedFriendForChat.set(null)" title="Retour aux amis">
                    <span class="material-symbols">arrow_back</span>
                  </button>
                  <div class="dm-header-title">
                    <span class="friend-status-dot" [class.online]="isUserOnline(selectedFriendForChat()!)"></span>
                    <span class="dm-friend-name">{{ selectedFriendForChat() }}</span>
                  </div>
                </div>
  
                <!-- Message list -->
                <div class="chat-messages dm-messages" #dmScrollContainer>
                  @for (msg of privateMessages(); track msg.id) {
                    <div class="message-wrapper" [class.self]="msg.sender === username()">
                      @if (msg.sender !== username()) {
                        <div class="msg-avatar" [style.background-color]="getAvatarColor(msg.sender)">
                          {{ msg.sender.charAt(0).toUpperCase() }}
                        </div>
                      }
                      <div class="msg-body-wrapper">
                        <div class="message-meta">
                          <span class="msg-author">{{ msg.sender }}</span>
                          <span class="msg-time">{{ msg.timestamp | date:'HH:mm' }}</span>
                        </div>
                        <div class="message-bubble">
                          {{ msg.text }}
                        </div>
                      </div>
                      @if (msg.sender === username()) {
                        <div class="msg-avatar self-avatar" [style.background-color]="getAvatarColor(msg.sender)">
                          {{ msg.sender.charAt(0).toUpperCase() }}
                        </div>
                      }
                    </div>
                  } @empty {
                    <div class="empty-chat">
                      <span class="material-symbols">chat_bubble</span>
                      <p>Aucun message avec {{ selectedFriendForChat() }} pour l'instant.</p>
                    </div>
                  }
                </div>
  
                <!-- Input form -->
                <form class="chat-input-form" (submit)="sendPrivateMessage(); $event.preventDefault()">
                  <input
                    type="text"
                    [(ngModel)]="privateNewMessage"
                    name="privateMessage"
                    placeholder="Écrire un message privé..."
                    autocomplete="off"
                    required
                  />
                  <button type="submit" title="Envoyer" class="send-btn">
                    <span class="material-symbols">send</span>
                  </button>
                </form>
              </div>
            } @else {
              <div class="social-panel">
                <!-- Add Friend Input -->
                <div class="social-section add-friend-section">
                  <form (submit)="addFriend(); $event.preventDefault()" class="add-friend-form">
                    <input
                      type="text"
                      [(ngModel)]="addFriendName"
                      name="addFriendName"
                      placeholder="Pseudo de l'ami..."
                      required
                    />
                    <button type="submit" class="primary-btn" title="Ajouter en ami">
                      <span class="material-symbols">person_add</span>
                    </button>
                  </form>
                </div>
  
                <!-- Friends List -->
                <div class="social-section">
                  <h4>Amis ({{ friends().length }})</h4>
                  <div class="friends-list">
                    @for (friendName of friends(); track friendName) {
                      <div class="social-item">
                        <div class="social-item-info clickable-friend" (click)="selectedFriendForChat.set(friendName)">
                          <span class="friend-status-dot" [class.online]="isUserOnline(friendName)"></span>
                          <span class="social-name">{{ friendName }}</span>
                        </div>
                        <div class="social-item-actions" style="display: flex; align-items: center; gap: 8px;">
                          <button class="icon-btn message-friend-btn" (click)="selectedFriendForChat.set(friendName)" title="Envoyer un message">
                            <span class="material-symbols">chat</span>
                          </button>
                          @if (isUserOnline(friendName)) {
                            @if (getOnlineUserByName(friendName); as onlineUser) {
                              @if (selectedUserToChallenge() === onlineUser.id) {
                                <div class="challenge-options">
                                  <button (click)="challengeUser(onlineUser.id, 'connect4')" title="Puissance 4" style="display: inline-flex; align-items: center; justify-content: center;"><span class="material-symbols" style="color: #ff4b5c; font-size: 16px;">fiber_manual_record</span></button>
                                  <button (click)="challengeUser(onlineUser.id, 'battleship')" title="Bataille Navale" style="display: inline-flex; align-items: center; justify-content: center;"><span class="material-symbols" style="color: #00f0ff; font-size: 16px;">directions_boat</span></button>
                                  <button (click)="challengeUser(onlineUser.id, 'tictactoe')" title="Morpion" style="display: inline-flex; align-items: center; justify-content: center;"><span class="material-symbols" style="color: #ff79c6; font-size: 16px;">close</span></button>
                                  <button (click)="challengeUser(onlineUser.id, 'checkers')" title="Dames" style="display: inline-flex; align-items: center; justify-content: center;"><span class="material-symbols" style="color: #d4a373; font-size: 16px;">sports_score</span></button>
                                  <button (click)="challengeUser(onlineUser.id, 'chess')" title="Échecs" style="display: inline-flex; align-items: center; justify-content: center;"><span class="material-symbols" style="color: #e0c097; font-size: 16px;">crown</span></button>
                                  <button class="cancel-btn" (click)="selectedUserToChallenge.set(null)" style="display: inline-flex; align-items: center; justify-content: center;"><span class="material-symbols" style="font-size: 12px;">close</span></button>
                                </div>
                              } @else {
                                <button class="challenge-btn" (click)="selectedUserToChallenge.set(onlineUser.id)" title="Défier">
                                  <span class="material-symbols">swords</span>
                                </button>
                              }
                            }
                          } @else {
                            <span class="offline-tag">Hors-ligne</span>
                          }
                          <button class="icon-btn remove-friend-btn" (click)="removeFriend(friendName)" title="Retirer de mes amis">
                            <span class="material-symbols">person_remove</span>
                          </button>
                        </div>
                      </div>
                    } @empty {
                      <div class="empty-list">Aucun ami ajouté.</div>
                    }
                  </div>
                </div>
  
                <!-- Other Online Users -->
                <div class="social-section">
                  <h4>Joueurs connectés ({{ otherOnlineUsers().length }})</h4>
                  <div class="online-users-list">
                    @for (user of otherOnlineUsers(); track user.id) {
                      <div class="social-item">
                        <span class="social-name">{{ user.username }}</span>
                        <div class="social-item-actions" style="display: flex; align-items: center; gap: 8px;">
                          @if (selectedUserToChallenge() === user.id) {
                            <div class="challenge-options">
                              <button (click)="challengeUser(user.id, 'connect4')" title="Puissance 4" style="display: inline-flex; align-items: center; justify-content: center;"><span class="material-symbols" style="color: #ff4b5c; font-size: 16px;">fiber_manual_record</span></button>
                              <button (click)="challengeUser(user.id, 'battleship')" title="Bataille Navale" style="display: inline-flex; align-items: center; justify-content: center;"><span class="material-symbols" style="color: #00f0ff; font-size: 16px;">directions_boat</span></button>
                              <button (click)="challengeUser(user.id, 'tictactoe')" title="Morpion" style="display: inline-flex; align-items: center; justify-content: center;"><span class="material-symbols" style="color: #ff79c6; font-size: 16px;">close</span></button>
                              <button (click)="challengeUser(user.id, 'checkers')" title="Dames" style="display: inline-flex; align-items: center; justify-content: center;"><span class="material-symbols" style="color: #d4a373; font-size: 16px;">sports_score</span></button>
                              <button (click)="challengeUser(user.id, 'chess')" title="Échecs" style="display: inline-flex; align-items: center; justify-content: center;"><span class="material-symbols" style="color: #e0c097; font-size: 16px;">crown</span></button>
                              <button class="cancel-btn" (click)="selectedUserToChallenge.set(null)" style="display: inline-flex; align-items: center; justify-content: center;"><span class="material-symbols" style="font-size: 12px;">close</span></button>
                            </div>
                          } @else {
                            <button class="challenge-btn" (click)="selectedUserToChallenge.set(user.id)" title="Défier">
                              <span class="material-symbols">swords</span>
                            </button>
                          }
                          <button class="icon-btn add-friend-btn" (click)="addFriendDirect(user.username)" title="Ajouter en ami">
                            <span class="material-symbols">person_add</span>
                          </button>
                        </div>
                      </div>
                    } @empty {
                      <div class="empty-list">Aucun autre joueur connecté.</div>
                    }
                  </div>
                </div>
              </div>
            }
          }
      </div>
    </div>
  `,
  styles: [`
    .chat-wrapper {
      position: fixed;
      inset: 0;
      z-index: 1000;
      pointer-events: none;
      display: flex;
      justify-content: flex-end;
    }

    /* ---- Toggle FAB Button ---- */
    .chat-toggle {
      position: fixed;
      /* Push above home-indicator (bottom) and away from rounded corner (right) */
      bottom: calc(24px + env(safe-area-inset-bottom, 0px));
      right: calc(24px + env(safe-area-inset-right, 0px));
      width: 56px;
      height: 56px;
      border-radius: var(--md-radius-xl);
      background: var(--md-primary-container);
      border: none;
      color: var(--md-on-primary-container);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: var(--md-elevation-3);
      transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), background 0.15s, opacity 0.2s, visibility 0.2s;
      pointer-events: auto;
    }

    .chat-toggle:hover {
      background: var(--md-primary);
      color: var(--md-on-primary);
      transform: scale(1.06);
    }

    .chat-toggle:active {
      transform: scale(0.95);
    }

    .chat-toggle .material-symbols {
      font-size: 24px;
    }

    /* Hide the button when chat is open */
    .chat-wrapper.open .chat-toggle {
      opacity: 0;
      visibility: hidden;
      transform: scale(0.5);
    }

    .unread-dot {
      position: absolute;
      top: 6px;
      right: 6px;
      width: 10px;
      height: 10px;
      background: var(--md-error);
      border-radius: 50%;
      border: 2px solid var(--md-surface-container-low);
    }

    /* ---- Panel Layout ---- */
    .chat-panel {
      width: 320px;
      height: 100%;
      background: var(--md-surface-container-low);
      border-left: 1px solid var(--md-outline-variant);
      box-shadow: -4px 0 20px rgba(0,0,0,0.25);
      display: flex;
      flex-direction: column;
      pointer-events: auto;
      transform: translateX(100%);
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      color: var(--md-on-surface);
    }

    .chat-wrapper.open .chat-panel {
      transform: translateX(0);
    }

    .chat-header {
      padding: 18px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--md-outline-variant);
    }

    .chat-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--md-on-surface);
    }

    .icon-btn {
      background: transparent;
      border: none;
      color: var(--md-on-surface-variant);
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }

    .icon-btn:hover {
      background: var(--md-surface-container-high);
      color: var(--md-on-surface);
    }

    .icon-btn .material-symbols {
      font-size: 20px;
    }

    /* ---- Tabs ---- */
    .chat-tabs {
      display: flex;
      padding: 8px 12px;
      gap: 4px;
      border-bottom: 1px solid var(--md-outline-variant);
    }

    .chat-tabs button {
      flex: 1;
      background: none;
      border: none;
      color: var(--md-on-surface-variant);
      padding: 8px 12px;
      font-size: 13px;
      font-weight: 500;
      font-family: 'Inter', sans-serif;
      cursor: pointer;
      border-radius: var(--md-radius-md);
      transition: background 0.15s, color 0.15s;
    }

    .chat-tabs button.active {
      background: var(--md-secondary-container);
      color: var(--md-on-secondary-container);
    }

    /* ---- Messages ---- */
    .chat-messages {
      flex: 1;
      padding: 16px 12px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .message-wrapper {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      max-width: 92%;
    }

    .message-wrapper.self {
      align-self: flex-end;
      flex-direction: row;
    }

    .msg-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      color: #141218;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .msg-avatar.self-avatar {
      color: #ffffff;
    }

    .msg-body-wrapper {
      display: flex;
      flex-direction: column;
      flex: 1;
    }

    .message-wrapper.self .msg-body-wrapper {
      align-items: flex-end;
    }

    .message-meta {
      font-size: 11px;
      color: var(--md-outline);
      margin-bottom: 3px;
      display: flex;
      gap: 5px;
    }

    .msg-author {
      font-weight: 500;
      color: var(--md-on-surface-variant);
    }

    .message-bubble {
      background: var(--md-surface-container-high);
      padding: 9px 13px;
      border-radius: 4px 14px 14px 14px;
      font-size: 13px;
      line-height: 1.45;
      word-break: break-word;
      color: var(--md-on-surface);
    }

    .message-wrapper.self .message-bubble {
      background: var(--md-primary-container);
      color: var(--md-on-primary-container);
      border-radius: 14px 4px 14px 14px;
    }

    .empty-chat {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      margin-top: 60px;
      color: var(--md-outline);
    }

    .empty-chat .material-symbols {
      font-size: 40px;
      color: var(--md-outline-variant);
    }

    .empty-chat p {
      margin: 0;
      font-size: 13px;
      color: var(--md-on-surface-variant);
    }

    /* ---- Input ---- */
    .chat-input-form {
      padding: 12px;
      border-top: 1px solid var(--md-outline-variant);
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .chat-input-form input {
      flex: 1;
      background: var(--md-surface-container);
      border: 1px solid var(--md-outline-variant);
      border-radius: var(--md-radius-md);
      color: var(--md-on-surface);
      padding: 10px 14px;
      font-size: 13px;
      font-family: 'Inter', sans-serif;
      outline: none;
      transition: border-color 0.15s;
    }

    .chat-input-form input:focus {
      border-color: var(--md-primary);
    }

    .chat-input-form input::placeholder {
      color: var(--md-outline);
    }

    .send-btn {
      background: var(--md-primary-container);
      color: var(--md-on-primary-container);
      border: none;
      border-radius: var(--md-radius-md);
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background 0.15s;
      flex-shrink: 0;
    }

    .send-btn .material-symbols {
      font-size: 18px;
    }

    .send-btn:hover {
      background: var(--md-secondary-container);
    }

    /* Hide FAB globally when desktop-hidden class is applied (e.g. in-game) */
    .chat-wrapper.desktop-hidden .chat-toggle {
      display: none !important;
    }

    /* ---- Mobile (≤ 768 px) ---- */
    @media (max-width: 768px) {
      /* FAB: stay above the bottom nav bar (≈ 56px) + home indicator */
      .chat-toggle {
        bottom: calc(72px + env(safe-area-inset-bottom, 0px));
        right: calc(16px + env(safe-area-inset-right, 0px));
      }

      /* Panel: full-width slide-over */
      .chat-panel {
        width: 100%;
        /* Leave room at the bottom for home indicator */
        padding-bottom: env(safe-area-inset-bottom, 0px);
      }

      /* Input row: also breathe above the home indicator */
      .chat-input-form {
        padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
      }
    }

    /* ---- Desktop: always-visible sidebar (≥ 1200px) ---- */
    @media (min-width: 1200px) {
      /* Hide the FAB — no need to toggle */
      .chat-toggle {
        display: none !important;
      }

      /* Always show the panel — override the translateX transform */
      .chat-panel {
        transform: none !important;
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      /* Hide the close button inside the panel header */
      .chat-header .icon-btn {
        display: none;
      }

      /* When parent toggles visibility off → slide panel out */
      .chat-wrapper.desktop-hidden .chat-panel {
        transform: translateX(100%) !important;
      }
    }

    /* ---- Social Header & Tabs ---- */
    .header-tabs {
      display: flex;
      gap: 16px;
    }
    .tab-btn {
      background: none;
      border: none;
      color: var(--md-on-surface-variant);
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      padding: 6px 0;
      position: relative;
      font-family: 'Inter', sans-serif;
    }
    .tab-btn.active {
      color: var(--md-primary);
    }
    .tab-btn.active::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: var(--md-primary);
      border-radius: 3px;
    }
    
    /* ---- Social Panel ---- */
    .social-panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      padding: 16px 20px;
      gap: 20px;
    }
    .social-section h4 {
      margin: 0 0 10px;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--md-primary);
    }
    .add-friend-form {
      display: flex;
      gap: 8px;
    }
    .add-friend-form input {
      flex: 1;
      background: var(--md-surface-container-high);
      border: 1px solid var(--md-outline-variant);
      border-radius: 12px;
      color: var(--md-on-surface);
      padding: 8px 12px;
      font-family: 'Inter', sans-serif;
      font-size: 13px;
    }
    .add-friend-form input:focus {
      outline: none;
      border-color: var(--md-primary);
    }
    .add-friend-form .primary-btn {
      padding: 8px 12px;
      border-radius: 12px;
    }
    
    .social-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      background: var(--md-surface-container);
      border: 1px solid var(--md-outline-variant);
      border-radius: 14px;
      margin-bottom: 8px;
    }
    .social-item-info {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .friend-status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--md-outline);
    }
    .friend-status-dot.online {
      background: #4CAF50; /* Green */
    }
    .social-name {
      font-size: 14px;
      font-weight: 500;
      color: var(--md-on-surface);
    }
    .social-item-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .offline-tag {
      font-size: 11px;
      color: var(--md-on-surface-variant);
      background: var(--md-surface-container-high);
      padding: 2px 6px;
      border-radius: 6px;
    }
    .challenge-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 6px 12px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 600;
      background: var(--md-primary-container);
      color: var(--md-on-primary-container);
      border: none;
      cursor: pointer;
    }
    .challenge-btn:hover {
      background: var(--md-primary);
      color: var(--md-on-primary);
    }
    .challenge-btn span {
      font-size: 14px;
    }
    .remove-friend-btn {
      color: var(--md-error);
    }
    .empty-list {
      font-size: 13px;
      color: var(--md-on-surface-variant);
      text-align: center;
      padding: 12px 0;
      font-style: italic;
    }
    
    .challenge-options {
      display: flex;
      align-items: center;
      gap: 4px;
      background: var(--md-surface-container-highest);
      border: 1px solid var(--md-outline-variant);
      padding: 4px;
      border-radius: 10px;
    }
    .challenge-options button {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 14px;
      padding: 2px 4px;
      border-radius: 6px;
    }
    .challenge-options button:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    .challenge-options .cancel-btn {
      font-size: 10px;
      font-weight: bold;
      color: var(--md-error);
    }
    
    .dm-chat-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }
    .dm-chat-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--md-outline-variant);
      background: var(--md-surface-container-low);
    }
    .dm-header-title {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .dm-friend-name {
      font-weight: 600;
      font-size: 15px;
      color: var(--md-on-surface);
    }
    .clickable-friend {
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
    }
    .clickable-friend:hover .social-name {
      color: var(--md-primary);
    }
    .dm-messages {
      flex: 1;
      overflow-y: auto;
    }
  `]
})
export class ChatSidebarComponent implements OnDestroy {
  @Input() desktopVisible: boolean = true;

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;
  @ViewChild('dmScrollContainer') private dmScrollContainer!: ElementRef;

  isOpen = false;
  activeTab: 'global' | 'room' = 'global';
  sidebarTab: 'chat' | 'social' = 'chat';
  newMessage = '';
  addFriendName = '';
  hasUnread = false;
  selectedUserToChallenge = signal<string | null>(null);

  selectedFriendForChat = signal<string | null>(null);
  privateNewMessage = '';

  username;
  currentRoom;
  friends;

  otherOnlineUsers = computed(() => {
    const me = this.gameService.username()?.toLowerCase() || '';
    const friendsLower = this.gameService.friends().map((f: string) => f.toLowerCase());
    return this.gameService.onlineUsers().filter(u => {
      const uLower = u.username.toLowerCase();
      return uLower !== me && !friendsLower.includes(uLower);
    });
  });

  private openFriendChatHandler = (e: Event) => {
    const friend = (e as CustomEvent).detail;
    if (friend) {
      this.sidebarTab = 'social';
      this.selectedFriendForChat.set(friend);
      this.isOpen = true;
      this.hasUnread = false;
      if (typeof window !== 'undefined' && window.innerWidth < 1200) {
        this.gameHelpersService.chatVisible.set(true);
      }
      setTimeout(() => this.scrollDmToBottom(), 50);
    }
  };

  currentMessages = computed(() => {
    if (this.activeTab === 'room' && this.currentRoom()) {
      return this.currentRoom()?.chatMessages || [];
    }
    return this.gameService.globalChat();
  });

  privateMessages = computed(() => {
    const friend = this.selectedFriendForChat();
    const me = this.username()?.toLowerCase();
    if (!friend || !me) return [];
    const friendLower = friend.toLowerCase();
    return this.gameService.privateMessages().filter(m => 
      (m.sender.toLowerCase() === me && m.recipient.toLowerCase() === friendLower) ||
      (m.sender.toLowerCase() === friendLower && m.recipient.toLowerCase() === me)
    );
  });

  constructor(
    private gameService: GameService,
    private gameHelpersService: GameHelpersService
  ) {
    this.username = this.gameService.username;
    this.currentRoom = this.gameService.currentRoom;
    this.friends = this.gameService.friends;

    // Sync isOpen with gameHelpersService.chatVisible signal on mobile/tablet
    effect(() => {
      const visible = this.gameHelpersService.chatVisible();
      if (typeof window !== 'undefined' && window.innerWidth < 1200) {
        this.isOpen = visible;
      }
    });

    effect(() => {
      const messages = this.currentMessages();
      if (messages.length > 0 && !this.isOpen) {
        this.hasUnread = true;
      }
    });
    effect(() => {
      this.currentMessages();
      setTimeout(() => this.scrollToBottom(), 50);
    });
    effect(() => {
      this.privateMessages();
      setTimeout(() => this.scrollDmToBottom(), 50);
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('open-friend-chat', this.openFriendChatHandler);
    }
  }

  ngOnDestroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('open-friend-chat', this.openFriendChatHandler);
    }
  }

  toggleChat() {
    this.isOpen = !this.isOpen;
    if (typeof window !== 'undefined' && window.innerWidth < 1200) {
      this.gameHelpersService.chatVisible.set(this.isOpen);
    }
    if (this.isOpen) {
      this.hasUnread = false;
      setTimeout(() => this.scrollToBottom(), 50);
      setTimeout(() => this.scrollDmToBottom(), 50);
    }
  }

  onGameChatMessageSent(text: string) {
    if (this.activeTab === 'room' && this.currentRoom()) {
      this.gameService.sendRoomMessage(text);
    } else {
      this.gameService.sendGlobalMessage(text);
    }
  }

  sendPrivateMessage() {
    const friend = this.selectedFriendForChat();
    if (!friend || !this.privateNewMessage.trim()) return;
    this.gameService.sendPrivateMessage(friend, this.privateNewMessage);
    this.privateNewMessage = '';
  }

  getAvatarColor(name: string): string {
    const colors = ['#9D8EFF', '#C08DFC', '#FF8A80', '#69F0AE', '#FFD54F', '#4FC3F7', '#FF8A80', '#A1887F'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }

  isUserOnline(username: string): boolean {
    return this.gameService.onlineUsers().some(u => u.username.toLowerCase() === username.toLowerCase());
  }

  getOnlineUserByName(username: string) {
    return this.gameService.onlineUsers().find(u => u.username.toLowerCase() === username.toLowerCase());
  }

  addFriend() {
    if (this.addFriendName.trim()) {
      this.gameService.addFriend(this.addFriendName.trim());
      this.addFriendName = '';
    }
  }

  addFriendDirect(name: string) {
    this.gameService.addFriend(name);
  }

  removeFriend(name: string) {
    this.gameService.removeFriend(name);
  }

  challengeUser(targetSocketId: string, gameType: string) {
    this.gameService.sendChallenge(targetSocketId, gameType);
    this.selectedUserToChallenge.set(null);
  }

  private scrollToBottom(): void {
    try {
      if (this.scrollContainer) {
        this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
      }
    } catch (err) {}
  }

  private scrollDmToBottom(): void {
    try {
      if (this.dmScrollContainer) {
        this.dmScrollContainer.nativeElement.scrollTop = this.dmScrollContainer.nativeElement.scrollHeight;
      }
    } catch (err) {}
  }
}
