import { BottomNavbarComponent } from './components/bottom-navbar/bottom-navbar.component';
import { Router } from '@angular/router';
import { Component, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GameService } from './services/game.service';
import { LobbyComponent } from './components/lobby/lobby.component';
import { Connect4Component } from './components/connect4/connect4.component';
import { BattleshipComponent } from './components/battleship/battleship.component';
import { ChatSidebarComponent } from './components/chat-sidebar/chat-sidebar.component';
import { TicTacToeComponent } from './components/tictactoe/tictactoe.component';
import { CheckersComponent } from './components/checkers/checkers.component';
import { ChessComponent } from './components/chess/chess.component';
import { FriendsPageComponent } from './components/friends-page/friends-page.component';
import { GomokuComponent } from './components/gomoku/gomoku.component';
import { OthelloComponent } from './components/othello/othello.component';

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
    ChessComponent,
    BottomNavbarComponent,
    FriendsPageComponent,
    GomokuComponent,
    OthelloComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  title = 'Playbox';

  username;
  currentRoom;
  incomingChallenges;

  activeView;
  activeGame;

  showProfileModal = signal<boolean>(false);
  newUsername = '';
  theme = signal<'dark' | 'light'>('dark');

  constructor(private gameService: GameService, private router: Router) {
    this.username = this.gameService.username;
    this.currentRoom = this.gameService.currentRoom;
    this.incomingChallenges = this.gameService.incomingChallenges;
    this.activeView = this.gameService.activeView;
    this.activeGame = this.gameService.activeGame;

    // Prompt PWA web notification permissions
    this.gameService.requestNotificationPermission();

    // Check for direct join URL parameter (e.g. ?join=ABCXYZ)
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join') || new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('join');
    if (joinCode) {
      window.history.replaceState({}, document.title, window.location.pathname);
      const joinEffect = effect(() => {
        const user = this.username();
        if (user) {
          this.gameService.joinRoom(joinCode.toUpperCase());
          joinEffect.destroy();
        }
      }, { allowSignalWrites: true });
    }

    effect(() => {
      const t = this.theme();
      if (t === 'light') {
        document.body.classList.add('light-theme');
      } else {
        document.body.classList.remove('light-theme');
      }
    });

    effect(() => {
      const active = this.activeGame() || this.currentRoom()?.gameType;
      document.body.classList.remove('theme-connect4', 'theme-battleship', 'theme-chess', 'theme-checkers', 'theme-tictactoe', 'theme-gomoku', 'theme-othello');
      if (active) {
        document.body.classList.add(`theme-${active}`);
      }
    });
  }

  navigate(destination: string) {
    switch (destination) {
      case 'games':
        this.activeGame.set(null);
        this.activeView.set('games');
        break;
      case 'messages':
        // Hide any active game room, keep chat sidebar visible.
        this.currentRoom.set(null);
        break;
      case 'friends':
        this.activeView.set('friends');
        break;
      case 'profile':
        this.openProfileModal();
        break;
    }
  }

  acceptChallenge(challengerSocketId: string, gameType: string) {
    this.gameService.acceptChallenge(challengerSocketId, gameType);
  }

  declineChallenge(challengerSocketId: string) {
    this.gameService.declineChallenge(challengerSocketId);
  }

  getGameLabel(gameType: string): string {
    const gameNames: { [key: string]: string } = {
      connect4: 'Puissance 4',
      battleship: 'Bataille Navale',
      tictactoe: 'Morpion',
      checkers: 'Jeu de Dames',
      chess: 'Échecs',
      gomoku: 'Gomoku',
      othello: 'Othello'
    };
    return gameNames[gameType] || gameType;
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
      },
      {
        name: 'Gomoku',
        color: '#FFAB40',
        wins: localStorage.getItem('stats_gomoku_wins') || '0',
        losses: localStorage.getItem('stats_gomoku_losses') || '0',
        draws: localStorage.getItem('stats_gomoku_draws') || '0'
      },
      {
        name: 'Othello',
        color: '#00B0FF',
        wins: localStorage.getItem('stats_othello_wins') || '0',
        losses: localStorage.getItem('stats_othello_losses') || '0',
        draws: localStorage.getItem('stats_othello_draws') || '0'
      }
    ];
  }
}
