import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-floating-emojis',
  standalone: true,
  template: `
    <div class="floating-emojis-container">
      @for (item of emojis; track item.id) {
        <span class="floating-emoji">{{ item.emoji }}</span>
      }
    </div>
  `,
  styles: [`
    .floating-emojis-container {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      z-index: 10;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .floating-emoji {
      position: absolute;
      font-size: 64px;
      animation: floatEmoji 2.0s ease-in-out forwards;
    }

    @keyframes floatEmoji {
      0% { transform: translateY(100px) scale(0.5); opacity: 0; }
      20% { transform: translateY(0) scale(1.2); opacity: 1; }
      80% { transform: translateY(-80px) scale(1.0); opacity: 1; }
      100% { transform: translateY(-150px) scale(0.6); opacity: 0; }
    }
  `]
})
export class FloatingEmojisComponent {
  @Input({ required: true }) emojis: { id: number; emoji: string }[] = [];
}
