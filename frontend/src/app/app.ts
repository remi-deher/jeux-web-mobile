import { Component, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GameService } from './services/game.service';
import { LobbyComponent } from './components/lobby/lobby.component';
import { Connect4Component } from './components/connect4/connect4.component';
import { BattleshipComponent } from './components/battleship/battleship.component';
import { ChatSidebarComponent } from './components/chat-sidebar/chat-sidebar.component';
import { TicTacToeComponent } from './components/tictactoe/tictactoe.component';
import { CheckersComponent } from './components/checkers/checkers.component';
import { ChessComponent } from './components/chess/chess.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    FormsModule,
    LobbyComponent,
    Connect4Component,
    BattleshipComponent,
    ChatSidebarComponent,
    TicTacToeComponent,
    CheckersComponent,
    ChessComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  title = 'Retro Games Club';

  username;
  currentRoom;

  showProfileModal = signal<boolean>(false);
  newUsername = '';
  theme = signal<'dark' | 'light'>('dark');

  constructor(private gameService: GameService) {
    this.username = this.gameService.username;
    this.currentRoom = this.gameService.currentRoom;

    effect(() => {
      const t = this.theme();
      if (t === 'light') {
        document.body.classList.add('light-theme');
      } else {
        document.body.classList.remove('light-theme');
      }
    });
  }

  getGameType(): string {
    return this.currentRoom()?.gameType || '';
  }

  toggleTheme() {
    this.theme.set(this.theme() === 'dark' ? 'light' : 'dark');
  }

  resetUsername() {
    this.gameService.setUsername('');
  }

  openProfileModal() {
    this.newUsername = this.username();
    this.showProfileModal.set(true);
  }

  closeProfileModal() {
    this.showProfileModal.set(false);
  }

  saveNewUsername() {
    if (this.newUsername.trim()) {
      this.gameService.setUsername(this.newUsername.trim());
      this.closeProfileModal();
    }
  }

  getStatsList() {
    return [
      {
        name: 'Puissance 4',
        color: '#9D8EFF',
        wins: localStorage.getItem('stats_connect4_wins') || '0',
        losses: localStorage.getItem('stats_connect4_losses') || '0',
        draws: localStorage.getItem('stats_connect4_draws') || '0'
      },
      {
        name: 'Bataille Navale',
        color: '#C08DFC',
        wins: localStorage.getItem('stats_battleship_wins') || '0',
        losses: localStorage.getItem('stats_battleship_losses') || '0',
        draws: localStorage.getItem('stats_battleship_draws') || '0'
      },
      {
        name: 'Morpion',
        color: '#FF8A80',
        wins: localStorage.getItem('stats_tictactoe_wins') || '0',
        losses: localStorage.getItem('stats_tictactoe_losses') || '0',
        draws: localStorage.getItem('stats_tictactoe_draws') || '0'
      },
      {
        name: 'Jeu de Dames',
        color: '#69F0AE',
        wins: localStorage.getItem('stats_checkers_wins') || '0',
        losses: localStorage.getItem('stats_checkers_losses') || '0',
        draws: localStorage.getItem('stats_checkers_draws') || '0'
      },
      {
        name: 'Échecs',
        color: '#FFD54F',
        wins: localStorage.getItem('stats_chess_wins') || '0',
        losses: localStorage.getItem('stats_chess_losses') || '0',
        draws: localStorage.getItem('stats_chess_draws') || '0'
      }
    ];
  }
}
