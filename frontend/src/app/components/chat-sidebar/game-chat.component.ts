import { Component, Input, Output, EventEmitter, ElementRef, ViewChild, effect } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatMessage } from '../../models/game.models';

@Component({
  selector: 'app-game-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  template: `
    <div class="chat-panel">
      <!-- Message List -->
      <div class="chat-messages" #scrollContainer>
        @for (msg of messages; track msg.id) {
          <div class="message-wrapper" [class.self]="msg.username === currentUser">
            @if (msg.username !== currentUser) {
              <div class="msg-avatar" [style.background-color]="getAvatarColor(msg.username)">
                {{ msg.username.charAt(0).toUpperCase() }}
              </div>
            }
            <div class="msg-body-wrapper">
              <div class="message-meta">
                <span class="msg-author">{{ msg.username }}</span>
                <span class="msg-time">{{ msg.timestamp | date:'HH:mm' }}</span>
              </div>
              <div class="message-bubble">
                {{ msg.text }}
              </div>
            </div>
            @if (msg.username === currentUser) {
              <div class="msg-avatar self-avatar" [style.background-color]="getAvatarColor(msg.username)">
                {{ msg.username.charAt(0).toUpperCase() }}
              </div>
            }
          </div>
        } @empty {
          <div class="empty-chat">
            <span class="material-symbols">forum</span>
            <p>Aucun message pour l'instant.</p>
          </div>
        }
      </div>

      <!-- Message Input -->
      <form class="chat-input-form" (submit)="onSend(); $event.preventDefault()">
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
  `,
  styles: [`
    .chat-panel {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--md-surface-container);
    }

    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .message-wrapper {
      display: flex;
      gap: 8px;
      max-width: 85%;
      align-self: flex-start;
    }

    .message-wrapper.self {
      align-self: flex-end;
    }

    .msg-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 600;
      color: #000;
      flex-shrink: 0;
    }

    .self-avatar {
      color: #fff;
    }

    .msg-body-wrapper {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .message-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      color: var(--md-on-surface-variant);
      padding: 0 4px;
    }

    .message-wrapper.self .message-meta {
      justify-content: flex-end;
    }

    .message-bubble {
      background: var(--md-surface-container-high);
      color: var(--md-on-surface);
      padding: 8px 12px;
      border-radius: 12px;
      font-size: 13px;
      line-height: 1.4;
      word-break: break-word;
    }

    .message-wrapper.self .message-bubble {
      background: var(--md-primary-container);
      color: var(--md-on-primary-container);
    }

    .chat-input-form {
      display: flex;
      gap: 8px;
      padding: 12px 16px;
      border-top: 1px solid var(--md-outline-variant);
      background: var(--md-surface-container-low);
    }

    .chat-input-form input {
      flex: 1;
      background: var(--md-surface-container-high);
      border: 1px solid var(--md-outline-variant);
      border-radius: 20px;
      padding: 8px 16px;
      color: var(--md-on-surface);
      font-size: 13px;
    }

    .send-btn {
      background: var(--md-primary);
      color: var(--md-on-primary);
      border: none;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: opacity 0.15s;
    }

    .send-btn:hover {
      opacity: 0.9;
    }

    .empty-chat {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      height: 100%;
      color: var(--md-on-surface-variant);
      opacity: 0.5;
    }
  `]
})
export class GameChatComponent {
  @Input({ required: true }) messages: ChatMessage[] = [];
  @Input({ required: true }) currentUser: string = '';
  @Output() sendMessage = new EventEmitter<string>();

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  newMessage: string = '';

  constructor() {
    effect(() => {
      // Auto scroll to bottom when message size changes
      if (this.messages.length >= 0) {
        setTimeout(() => this.scrollToBottom(), 50);
      }
    });
  }

  onSend() {
    if (!this.newMessage.trim()) return;
    this.sendMessage.emit(this.newMessage.trim());
    this.newMessage = '';
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

  private scrollToBottom(): void {
    try {
      if (this.scrollContainer) {
        this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
      }
    } catch (err) {}
  }
}
