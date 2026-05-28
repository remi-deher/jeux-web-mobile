import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-bottom-navbar',
  standalone: true,
  template: `
    <nav class="bottom-nav">
      <button [class.active]="activeView === 'games'" (click)="nav.emit('games')">
        <span class="material-symbols">sports_esports</span>
        <span>Jeux</span>
      </button>
      <button [class.active]="activeView === 'friends'" (click)="nav.emit('friends')">
        <span class="material-symbols">people</span>
        <span>Amis</span>
      </button>
      <button [class.active]="activeView === 'profile'" (click)="nav.emit('profile')">
        <span class="material-symbols">person</span>
        <span>Profil</span>
      </button>
    </nav>
  `,
  styleUrls: ['./bottom-navbar.component.css']
})
export class BottomNavbarComponent {
  @Input() activeView: string = 'games';
  @Output() nav = new EventEmitter<string>();
}
