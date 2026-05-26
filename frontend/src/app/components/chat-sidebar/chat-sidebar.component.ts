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
          <button class="close-btn" (click)="toggleChat()">
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
                <span class="username">{{ msg.username }}</span>
                <span class="time">{{ msg.timestamp | date:'HH:mm' }}</span>
              </div>
              <div class="message-bubble">
                {{ msg.text }}
              </div>
            </div>
          } @empty {
            <div class="empty-chat">
              <span class="material-symbols empty-icon">forum</span>
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
          <button type="submit" title="Envoyer">
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
      width: 340px;
      background: rgba(15, 23, 42, 0.85);
      border-left: var(--m3-border);
      box-shadow: var(--m3-shadow);
      backdrop-filter: blur(20px);
      z-index: 1000;
      transform: translateX(100%);
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      flex-direction: column;
    }

    .chat-container.open {
      transform: translateX(0);
    }

    .chat-toggle {
      position: absolute;
      left: -64px;
      top: 20px;
      width: 52px;
      height: 52px;
      border-radius: 50% 0 0 50%;
      background: linear-gradient(135deg, var(--m3-primary), var(--m3-secondary));
      border: none;
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: var(--m3-shadow);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .chat-toggle:hover {
      left: -68px;
      transform: scale(1.05);
    }

    .unread-dot {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 12px;
      height: 12px;
      background: var(--m3-error);
      border-radius: 50%;
      border: 2px solid #0f172a;
    }

    .chat-panel {
      display: flex;
      flex-direction: column;
      height: 100%;
      color: #f8fafc;
    }

    .chat-header {
      padding: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: var(--m3-border);
    }

    .chat-header h3 {
      margin: 0;
      font-weight: 600;
      font-size: 18px;
      background: linear-gradient(135deg, var(--m3-primary), var(--m3-secondary));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .close-btn {
      background: var(--m3-primary-container);
      border: none;
      color: #94a3b8;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
    }

    .close-btn .material-symbols {
      font-size: 18px;
    }

    .close-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #f8fafc;
      transform: scale(1.1);
    }

    .chat-tabs {
      display: flex;
      background: rgba(0, 0, 0, 0.2);
      padding: 6px;
      margin: 10px 20px 0 20px;
      border-radius: var(--m3-radius-medium);
      border: var(--m3-border);
    }

    .chat-tabs button {
      flex: 1;
      background: none;
      border: none;
      color: #94a3b8;
      padding: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      border-radius: var(--m3-radius-small);
      transition: all 0.2s;
    }

    .chat-tabs button.active {
      background: rgba(255, 255, 255, 0.08);
      color: #f8fafc;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }

    .chat-messages {
      flex: 1;
      padding: 20px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .message-wrapper {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      max-width: 85%;
    }

    .message-wrapper.self {
      align-self: flex-end;
      align-items: flex-end;
    }

    .message-meta {
      font-size: 11px;
      color: #64748b;
      margin-bottom: 4px;
      display: flex;
      gap: 6px;
    }

    .message-bubble {
      background: var(--m3-surface);
      border: var(--m3-border);
      padding: 10px 14px;
      border-radius: 4px 16px 16px 16px;
      font-size: 13px;
      line-height: 1.4;
      word-break: break-word;
      color: #e2e8f0;
    }

    .message-wrapper.self .message-bubble {
      background: linear-gradient(135deg, var(--m3-primary), var(--m3-secondary));
      border: none;
      color: white;
      border-radius: 16px 4px 16px 16px;
      box-shadow: 0 4px 12px rgba(129, 140, 248, 0.25);
    }

    .empty-chat {
      text-align: center;
      color: #64748b;
      margin-top: 60px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .empty-icon {
      font-size: 40px;
      color: #475569;
    }

    .empty-chat p {
      margin: 0;
      font-size: 13px;
    }

    .chat-input-form {
      padding: 20px;
      border-top: var(--m3-border);
      display: flex;
      gap: 8px;
    }

    .chat-input-form input {
      flex: 1;
      background: rgba(0, 0, 0, 0.3);
      border: var(--m3-border);
      border-radius: var(--m3-radius-medium);
      color: white;
      padding: 10px 16px;
      font-size: 13px;
      outline: none;
      transition: all 0.2s;
    }

    .chat-input-form input:focus {
      border-color: var(--m3-primary);
      box-shadow: 0 0 0 2px var(--m3-primary-container);
    }

    .chat-input-form button {
      background: var(--m3-primary);
      color: white;
      border: none;
      border-radius: var(--m3-radius-medium);
      width: 38px;
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
    }

    .chat-input-form button .material-symbols {
      font-size: 18px;
    }

    .chat-input-form button:hover {
      background: var(--m3-secondary);
      transform: scale(1.05);
    }

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
    // Monitor incoming messages to mark as unread if chat is closed
    effect(() => {
      const messages = this.currentMessages();
      if (messages.length > 0 && !this.isOpen) {
        this.hasUnread = true;
      }
    });

    // Auto-scroll on message updates
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
