import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-bottom-navbar',
  standalone: true,
  template: `
    <nav class="bottom-nav">
      <button (click)="nav.emit('games')">
        <span class="material-symbols">sports_esports</span>
        <span>Jeux</span>
      </button>
      <button (click)="nav.emit('friends')">
        <span class="material-symbols">people</span>
        <span>Amis</span>
      </button>
      <button (click)="nav.emit('profile')">
        <span class="material-symbols">person</span>
        <span>Profil</span>
      </button>
    </nav>
  `,
  styleUrls: ['./bottom-navbar.component.css']
})
export class BottomNavbarComponent {
  @Output() nav = new EventEmitter<string>();
}
