import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GameService } from '../../services/game.service';

@Component({
  selector: 'app-friends-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="friends-page-container">
      <div class="friends-layout">
        <!-- Social Panel Left: Add Friend + Online list -->
        <div class="friends-column">
          <!-- Add Friend Section -->
          <div class="surface-card add-friend-card">
            <h3>Ajouter un ami</h3>
            <p>Ajoutez un joueur à votre liste d'amis en entrant son pseudonyme.</p>
            <form (submit)="addFriend(); $event.preventDefault()" class="add-friend-form-page">
              <input
                type="text"
                [(ngModel)]="addFriendName"
                name="addFriendName"
                placeholder="Pseudonyme de l'ami..."
                required
              />
              <button type="submit" class="primary-btn">
                <span class="material-symbols">person_add</span>
                <span>Ajouter</span>
              </button>
            </form>
          </div>

          <!-- Connected Players list -->
          <div class="surface-card list-card">
            <h3>Joueurs connectés ({{ getOtherOnlineUsersCount() }})</h3>
            <div class="user-list">
              @for (user of getOtherOnlineUsers(); track user.id) {
                <div class="user-item">
                  <span class="user-name">{{ user.username }}</span>
                  <div class="item-actions">
                    @if (selectedUserToChallenge() === user.id) {
                      <div class="challenge-picker">
                        <button (click)="challengeUser(user.id, 'connect4')" title="Puissance 4"><span class="material-symbols" style="color: #ff4b5c; font-size: 16px;">fiber_manual_record</span></button>
                        <button (click)="challengeUser(user.id, 'battleship')" title="Bataille Navale"><span class="material-symbols" style="color: #00f0ff; font-size: 16px;">directions_boat</span></button>
                        <button (click)="challengeUser(user.id, 'tictactoe')" title="Morpion"><span class="material-symbols" style="color: #ff79c6; font-size: 16px;">close</span></button>
                        <button (click)="challengeUser(user.id, 'checkers')" title="Dames"><span class="material-symbols" style="color: #d4a373; font-size: 16px;">sports_score</span></button>
                        <button (click)="challengeUser(user.id, 'chess')" title="Échecs"><span class="material-symbols" style="color: #e0c097; font-size: 16px;">crown</span></button>
                        <button class="cancel-btn" (click)="selectedUserToChallenge.set(null)"><span class="material-symbols" style="font-size: 12px;">close</span></button>
                      </div>
                    } @else {
                      <button class="tonal-btn challenge-btn" (click)="selectedUserToChallenge.set(user.id)">
                        <span class="material-symbols">swords</span>
                        <span>Défier</span>
                      </button>
                    }
                    <button class="outlined-btn icon-btn" (click)="addFriendDirect(user.username)" title="Ajouter en ami">
                      <span class="material-symbols">person_add</span>
                    </button>
                  </div>
                </div>
              } @empty {
                <div class="empty-list-info">Aucun autre joueur connecté.</div>
              }
            </div>
          </div>
        </div>

        <!-- Friends List Right -->
        <div class="friends-column">
          <div class="surface-card list-card friends-main-card">
            <h3>Mes Amis ({{ friends().length }})</h3>
            <div class="user-list">
              @for (friendName of friends(); track friendName) {
                <div class="user-item">
                  <div class="user-info-section">
                    <span class="status-dot" [class.online]="isUserOnline(friendName)"></span>
                    <span class="user-name">{{ friendName }}</span>
                    @if (!isUserOnline(friendName)) {
                      <span class="offline-badge">Hors-ligne</span>
                    }
                  </div>
                  <div class="item-actions">
                    <button class="tonal-btn msg-btn" (click)="openChatSidebarWithFriend(friendName)">
                      <span class="material-symbols">chat</span>
                      <span>Message</span>
                    </button>

                    @if (isUserOnline(friendName)) {
                      @if (getOnlineUserByName(friendName); as onlineUser) {
                        @if (selectedUserToChallenge() === onlineUser.id) {
                          <div class="challenge-picker">
                            <button (click)="challengeUser(onlineUser.id, 'connect4')" title="Puissance 4"><span class="material-symbols" style="color: #ff4b5c; font-size: 16px;">fiber_manual_record</span></button>
                            <button (click)="challengeUser(onlineUser.id, 'battleship')" title="Bataille Navale"><span class="material-symbols" style="color: #00f0ff; font-size: 16px;">directions_boat</span></button>
                            <button (click)="challengeUser(onlineUser.id, 'tictactoe')" title="Morpion"><span class="material-symbols" style="color: #ff79c6; font-size: 16px;">close</span></button>
                            <button (click)="challengeUser(onlineUser.id, 'checkers')" title="Dames"><span class="material-symbols" style="color: #d4a373; font-size: 16px;">sports_score</span></button>
                            <button (click)="challengeUser(onlineUser.id, 'chess')" title="Échecs"><span class="material-symbols" style="color: #e0c097; font-size: 16px;">crown</span></button>
                            <button class="cancel-btn" (click)="selectedUserToChallenge.set(null)"><span class="material-symbols" style="font-size: 12px;">close</span></button>
                          </div>
                        } @else {
                          <button class="primary-btn challenge-btn" (click)="selectedUserToChallenge.set(onlineUser.id)">
                            <span class="material-symbols">swords</span>
                            <span>Défier</span>
                          </button>
                        }
                      }
                    }

                    <button class="outlined-btn icon-btn remove-btn" (click)="removeFriend(friendName)" title="Retirer">
                      <span class="material-symbols text-danger">person_remove</span>
                    </button>
                  </div>
                </div>
              } @empty {
                <div class="empty-list-info">Vous n'avez pas encore d'amis. Recherchez ou ajoutez-les depuis la liste des connectés !</div>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .friends-page-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px 16px 80px 16px;
      animation: fadeIn 0.25s ease-out;
    }

    .friends-layout {
      display: grid;
      grid-template-columns: 1fr 1.2fr;
      gap: 24px;
    }

    .friends-column {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .surface-card {
      background: var(--md-surface-container);
      border: 1px solid var(--md-outline-variant);
      border-radius: var(--md-radius-xl);
      padding: 24px;
      box-shadow: var(--md-elevation-1);
    }

    .surface-card h3 {
      margin: 0 0 8px 0;
      font-size: 18px;
      font-weight: 700;
      color: var(--md-on-surface);
    }

    .surface-card p {
      margin: 0 0 16px 0;
      font-size: 13px;
      color: var(--md-on-surface-variant);
      line-height: 1.5;
    }

    .add-friend-form-page {
      display: flex;
      gap: 12px;
    }

    .add-friend-form-page input {
      flex: 1;
      background: var(--md-surface-container-high);
      border: 1px solid var(--md-outline-variant);
      color: var(--md-on-surface);
      padding: 12px 16px;
      border-radius: var(--md-radius-lg);
      font-size: 14px;
      outline: none;
      transition: border-color 0.15s;
    }

    .add-friend-form-page input:focus {
      border-color: var(--md-primary);
    }

    .user-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 16px;
      max-height: 550px;
      overflow-y: auto;
      padding-right: 4px;
    }

    .user-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--md-surface-container-high);
      border: 1px solid var(--md-outline-variant);
      padding: 12px 18px;
      border-radius: var(--md-radius-lg);
      gap: 16px;
      transition: transform 0.15s, border-color 0.15s;
    }

    .user-item:hover {
      border-color: var(--md-primary-container);
    }

    .user-info-section {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--md-outline);
    }

    .status-dot.online {
      background: #34d399;
      box-shadow: 0 0 8px rgba(52, 211, 153, 0.4);
    }

    .user-name {
      font-weight: 600;
      color: var(--md-on-surface);
      font-size: 14px;
    }

    .offline-badge {
      font-size: 11px;
      background: var(--md-surface-container-highest);
      color: var(--md-outline);
      padding: 2px 8px;
      border-radius: var(--md-radius-full);
      font-weight: 500;
    }

    .item-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .empty-list-info {
      text-align: center;
      color: var(--md-on-surface-variant);
      font-size: 13px;
      padding: 32px 16px;
      line-height: 1.5;
    }

    /* Challenge Picker style */
    .challenge-picker {
      display: flex;
      align-items: center;
      gap: 4px;
      background: var(--md-surface-container-highest);
      padding: 4px;
      border-radius: var(--md-radius-full);
      border: 1px solid var(--md-outline-variant);
    }

    .challenge-picker button {
      background: none;
      border: none;
      font-size: 16px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 50%;
      transition: transform 0.15s;
    }

    .challenge-picker button:hover {
      transform: scale(1.2);
    }

    .challenge-picker .cancel-btn {
      color: var(--md-outline);
      font-size: 12px;
      font-weight: bold;
    }

    .text-danger {
      color: var(--md-error) !important;
    }

    @media (max-width: 768px) {
      .friends-layout {
        grid-template-columns: 1fr;
      }
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class FriendsPageComponent {
  addFriendName = '';
  selectedUserToChallenge = signal<string | null>(null);

  username;
  friends;
  onlineUsers;

  constructor(private gameService: GameService) {
    this.username = this.gameService.username;
    this.friends = this.gameService.friends;
    this.onlineUsers = this.gameService.onlineUsers;
  }

  isUserOnline(name: string): boolean {
    return this.onlineUsers().some(u => u.username === name);
  }

  getOnlineUserByName(name: string) {
    return this.onlineUsers().find(u => u.username === name);
  }

  getOtherOnlineUsersCount(): number {
    return this.getOtherOnlineUsers().length;
  }

  getOtherOnlineUsers() {
    const myName = this.username();
    return this.onlineUsers().filter(u => u.username !== myName && !this.friends().includes(u.username));
  }

  addFriend() {
    const name = this.addFriendName.trim();
    if (!name) return;

    if (name === this.username()) {
      alert("Vous ne pouvez pas vous ajouter vous-même en ami.");
      return;
    }

    if (this.friends().includes(name)) {
      alert("Ce joueur fait déjà partie de vos amis.");
      return;
    }

    this.gameService.addFriend(name);
    this.addFriendName = '';
  }

  addFriendDirect(name: string) {
    if (this.friends().includes(name)) return;
    this.gameService.addFriend(name);
  }

  removeFriend(name: string) {
    if (confirm(`Retirer ${name} de vos amis ?`)) {
      this.gameService.removeFriend(name);
    }
  }

  challengeUser(targetSocketId: string, gameType: string) {
    this.gameService.sendChallenge(targetSocketId, gameType);
    this.selectedUserToChallenge.set(null);
    alert("Défi envoyé ! En attente de la réponse de votre adversaire...");
  }

  openChatSidebarWithFriend(friendName: string) {
    // We can interact with the app component or the sidebar directly. 
    // To trigger the sidebar, we can dispatch a custom event or communicate via service.
    // Let's search if there's an easier way, or we can dispatch a CustomEvent.
    const event = new CustomEvent('open-friend-chat', { detail: friendName });
    window.dispatchEvent(event);
  }
}
