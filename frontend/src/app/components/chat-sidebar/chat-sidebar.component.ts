import { Component, ElementRef, ViewChild, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { GameService } from '../../services/game.service';

@Component({
  selector: 'app-chat-sidebar',
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
    <div class="chat-container" [class.open]="isOpen">
      <!-- Toggle Button -->
      <button class="chat-toggle" (click)="toggleChat()" [class.has-unread]="hasUnread && !isOpen">
        <span class="material-symbols">chat_bubble</span>
        @if (hasUnread && !isOpen) {
          <span class="unread-dot"></span>
        }
      </button>

      <!-- Chat Panel -->
      <div class="chat-panel">
        <div class="chat-header">
          <h3>Discussion</h3>
          <button class="icon-btn" (click)="toggleChat()">
            <span class="material-symbols">close</span>
          </button>
        </div>

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

        <!-- Message List -->
        <div class="chat-messages" #scrollContainer>
          @for (msg of currentMessages(); track msg.id) {
            <div class="message-wrapper" [class.self]="msg.username === username()">
              <div class="message-meta">
                <span class="msg-author">{{ msg.username }}</span>
                <span class="msg-time">{{ msg.timestamp | date:'HH:mm' }}</span>
              </div>
              <div class="message-bubble">
                {{ msg.text }}
              </div>
            </div>
          } @empty {
            <div class="empty-chat">
              <span class="material-symbols">forum</span>
              <p>Aucun message pour l'instant.</p>
            </div>
          }
        </div>

        <!-- Message Input -->
        <form class="chat-input-form" (submit)="sendMessage(); $event.preventDefault()">
          <input
            type="text"
            [(ngModel)]="newMessage"
            name="message"
            placeholder="Écrire un message..."
            autocomplete="off"
            required
          />
          <button type="submit" title="Envoyer" class="send-btn">
            <span class="material-symbols">send</span>
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .chat-container {
      position: fixed;
      right: 0;
      top: 0;
      bottom: 0;
      width: 320px;
      background: var(--md-surface-container-low);
      border-left: 1px solid var(--md-outline-variant);
      box-shadow: -4px 0 20px rgba(0,0,0,0.25);
      z-index: 1000;
      transform: translateX(100%);
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      flex-direction: column;
    }

    .chat-container.open {
      transform: translateX(0);
    }

    /* ---- Toggle Button ---- */
    .chat-toggle {
      position: absolute;
      left: -52px;
      top: 20px;
      width: 44px;
      height: 44px;
      border-radius: 50% 0 0 50%;
      background: var(--md-primary-container);
      border: none;
      color: var(--md-on-primary-container);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s;
      position: absolute;
    }

    .chat-toggle:hover {
      background: var(--md-secondary-container);
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
      display: flex;
      flex-direction: column;
      height: 100%;
      color: var(--md-on-surface);
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
      flex-direction: column;
      align-items: flex-start;
      max-width: 88%;
    }

    .message-wrapper.self {
      align-self: flex-end;
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

    /* ---- Mobile ---- */
    @media (max-width: 480px) {
      .chat-container {
        width: 100%;
        left: 0;
        transform: translateX(100%);
      }
      .chat-container.open {
        transform: translateX(0);
      }
      .chat-toggle {
        left: auto;
        right: 15px;
        top: 15px;
        border-radius: 50%;
        position: fixed;
        z-index: 1010;
      }
      .chat-container.open .chat-toggle {
        display: none;
      }
    }
  `]
})
export class ChatSidebarComponent {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  isOpen = false;
  activeTab: 'global' | 'room' = 'global';
  newMessage = '';
  hasUnread = false;

  username;
  currentRoom;

  currentMessages = computed(() => {
    if (this.activeTab === 'room' && this.currentRoom()) {
      return this.currentRoom()?.chatMessages || [];
    }
    return this.gameService.globalChat();
  });

  constructor(private gameService: GameService) {
    this.username = this.gameService.username;
    this.currentRoom = this.gameService.currentRoom;
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
  }

  toggleChat() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.hasUnread = false;
      setTimeout(() => this.scrollToBottom(), 50);
    }
  }

  sendMessage() {
    if (!this.newMessage.trim()) return;
    if (this.activeTab === 'room' && this.currentRoom()) {
      this.gameService.sendRoomMessage(this.newMessage);
    } else {
      this.gameService.sendGlobalMessage(this.newMessage);
    }
    this.newMessage = '';
  }

  private scrollToBottom(): void {
    try {
      if (this.scrollContainer) {
        this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
      }
    } catch (err) {}
  }
}
