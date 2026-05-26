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
        <span class="chat-icon">💬</span>
        @if (hasUnread && !isOpen) {
          <span class="unread-dot"></span>
        }
      </button>

      <!-- Chat Panel -->
      <div class="chat-panel">
        <div class="chat-header">
          <h3>Discussion</h3>
          <button class="close-btn" (click)="toggleChat()">×</button>
        </div>

        <!-- Chat Tabs (if in a room) -->
        @if (currentRoom()) {
          <div class="chat-tabs">
            <button [class.active]="activeTab === 'global'" (click)="activeTab = 'global'">Global</button>
            <button [class.active]="activeTab === 'room'" (click)="activeTab = 'room'">Partie</button>
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
            <div class="empty-chat">Aucun message pour l'instant.</div>
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
          <button type="submit">Envoyer</button>
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
      background: rgba(20, 20, 30, 0.95);
      border-left: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: -5px 0 25px rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(10px);
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
      left: -60px;
      top: 20px;
      width: 50px;
      height: 50px;
      border-radius: 50% 0 0 50%;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      border: none;
      color: white;
      font-size: 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: -3px 3px 10px rgba(0, 0, 0, 0.3);
      transition: all 0.2s ease;
    }

    .chat-toggle:hover {
      left: -65px;
      background: linear-gradient(135deg, #4f46e5, #4338ca);
    }

    .unread-dot {
      position: absolute;
      top: 10px;
      right: 10px;
      width: 10px;
      height: 10px;
      background: #f43f5e;
      border-radius: 50%;
      border: 2px solid white;
    }

    .chat-panel {
      display: flex;
      flex-direction: column;
      height: 100%;
      color: white;
    }

    .chat-header {
      padding: 15px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .chat-header h3 {
      margin: 0;
      font-weight: 600;
      color: #a5b4fc;
    }

    .close-btn {
      background: none;
      border: none;
      color: #9ca3af;
      font-size: 24px;
      cursor: pointer;
      line-height: 1;
      padding: 0;
    }

    .close-btn:hover {
      color: white;
    }

    .chat-tabs {
      display: flex;
      background: rgba(0, 0, 0, 0.2);
      padding: 5px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .chat-tabs button {
      flex: 1;
      background: none;
      border: none;
      color: #9ca3af;
      padding: 8px;
      font-size: 14px;
      cursor: pointer;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .chat-tabs button.active {
      background: rgba(255, 255, 255, 0.1);
      color: white;
      font-weight: 500;
    }

    .chat-messages {
      flex: 1;
      padding: 20px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 15px;
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
      color: #9ca3af;
      margin-bottom: 3px;
      display: flex;
      gap: 6px;
    }

    .message-bubble {
      background: rgba(255, 255, 255, 0.08);
      padding: 10px 14px;
      border-radius: 4px 16px 16px 16px;
      font-size: 13px;
      line-height: 1.4;
      word-break: break-word;
    }

    .message-wrapper.self .message-bubble {
      background: #4f46e5;
      color: white;
      border-radius: 16px 4px 16px 16px;
    }

    .empty-chat {
      text-align: center;
      color: #6b7280;
      margin-top: 50px;
      font-size: 13px;
    }

    .chat-input-form {
      padding: 15px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      gap: 8px;
    }

    .chat-input-form input {
      flex: 1;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 8px;
      color: white;
      padding: 10px 14px;
      font-size: 13px;
      outline: none;
      transition: border-color 0.2s;
    }

    .chat-input-form input:focus {
      border-color: #6366f1;
    }

    .chat-input-form button {
      background: #4f46e5;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 10px 16px;
      font-weight: 500;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .chat-input-form button:hover {
      background: #4338ca;
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
