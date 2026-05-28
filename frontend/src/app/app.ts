import { BottomNavbarComponent } from './components/bottom-navbar/bottom-navbar.component';
import { Router } from '@angular/router';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GameService } from './services/game.service';
import { GameHelpersService } from './services/game-helpers.service';
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
import { PongComponent } from './components/pong/pong.component';
import { PenduComponent } from './components/pendu/pendu.component';
import { DominosComponent } from './components/dominos/dominos.component';
import { SnakeComponent } from './components/snake/snake.component';
import { TetrisComponent } from './components/tetris/tetris.component';
import { gameLabel } from './constants/game-labels';

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
    OthelloComponent,
    PongComponent,
    PenduComponent,
    DominosComponent,
    SnakeComponent,
    TetrisComponent
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

  private gameHelpersService = inject(GameHelpersService);

  showProfileModal = signal<boolean>(false);
  newUsername = '';
  theme = signal<'dark' | 'light'>('dark');
  chatVisible = this.gameHelpersService.chatVisible;

  /**
   * Stats computed uniquement quand le modal profil est ouvert.
   * Évite de relire le localStorage à chaque cycle de détection de changement.
   */
  statsList = computed(() => {
    if (!this.showProfileModal()) return [];
    const read = (key: string) => localStorage.getItem(key) ?? '0';
    return [
      { name: 'Puissance 4',    color: '#9D8EFF', wins: read('stats_connect4_wins'),   losses: read('stats_connect4_losses'),   draws: read('stats_connect4_draws')   },
      { name: 'Bataille Navale',color: '#C08DFC', wins: read('stats_battleship_wins'), losses: read('stats_battleship_losses'), draws: read('stats_battleship_draws') },
      { name: 'Morpion',        color: '#FF8A80', wins: read('stats_tictactoe_wins'),  losses: read('stats_tictactoe_losses'),  draws: read('stats_tictactoe_draws')  },
      { name: 'Jeu de Dames',   color: '#69F0AE', wins: read('stats_checkers_wins'),   losses: read('stats_checkers_losses'),   draws: read('stats_checkers_draws')   },
      { name: 'Échecs',         color: '#FFD54F', wins: read('stats_chess_wins'),      losses: read('stats_chess_losses'),      draws: read('stats_chess_draws')      },
      { name: 'Gomoku',         color: '#FFAB40', wins: read('stats_gomoku_wins'),     losses: read('stats_gomoku_losses'),     draws: read('stats_gomoku_draws')     },
      { name: 'Othello',        color: '#00B0FF', wins: read('stats_othello_wins'),    losses: read('stats_othello_losses'),    draws: read('stats_othello_draws')    },
      { name: 'Pong',           color: '#00E676', wins: read('stats_pong_wins'),       losses: read('stats_pong_losses'),       draws: read('stats_pong_draws')       },
      { name: 'Pendu',          color: '#FFEA00', wins: read('stats_pendu_wins'),      losses: read('stats_pendu_losses'),      draws: read('stats_pendu_draws')      },
      { name: 'Dominos',        color: '#D7CCC8', wins: read('stats_dominos_wins'),    losses: read('stats_dominos_losses'),    draws: read('stats_dominos_draws')    },
      { name: 'Snake vs',       color: '#00E676', wins: read('stats_snake_wins'),       losses: read('stats_snake_losses'),       draws: read('stats_snake_draws')       },
      { name: 'Tetris vs',      color: '#E040FB', wins: read('stats_tetris_wins'),      losses: read('stats_tetris_losses'),      draws: read('stats_tetris_draws')      },
    ];
  });

  constructor(private gameService: GameService, private router: Router) {
    this.username = this.gameService.username;
    this.currentRoom = this.gameService.currentRoom;
    this.incomingChallenges = this.gameService.incomingChallenges;
    this.activeView = this.gameService.activeView;
    this.activeGame = this.gameService.activeGame;

    this.gameService.requestNotificationPermission();

    // Direct join via URL ?join=ABCXYZ
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
      document.body.classList.toggle('light-theme', this.theme() === 'light');
    });

    // Cache le chat à l'entrée d'un jeu, le restaure en lobby
    effect(() => {
      const inGame = !!this.currentRoom();
      this.gameHelpersService.chatVisible.set(!inGame);
    }, { allowSignalWrites: true });

    effect(() => {
      const active = this.activeGame() || this.currentRoom()?.gameType;
      document.body.classList.remove(
        'theme-connect4', 'theme-battleship', 'theme-chess', 'theme-checkers',
        'theme-tictactoe', 'theme-gomoku', 'theme-othello', 'theme-pong', 'theme-pendu', 'theme-dominos'
      );
      if (active) document.body.classList.add(`theme-${active}`);
    });
  }

  navigate(destination: string) {
    switch (destination) {
      case 'games':   this.activeGame.set(null); this.activeView.set('games');   break;
      case 'messages': this.currentRoom.set(null);                                break;
      case 'friends': this.activeView.set('friends');                             break;
      case 'profile': this.openProfileModal();                                    break;
    }
  }

  acceptChallenge(challengerSocketId: string, gameType: string) {
    this.gameService.acceptChallenge(challengerSocketId, gameType);
  }

  declineChallenge(challengerSocketId: string) {
    this.gameService.declineChallenge(challengerSocketId);
  }

  /** Utilise la constante centrale GAME_LABELS */
  getGameLabel(gameType: string): string {
    return gameLabel(gameType);
  }

  getGameType(): string {
    return this.currentRoom()?.gameType || '';
  }

  toggleTheme() {
    this.theme.set(this.theme() === 'dark' ? 'light' : 'dark');
  }

  toggleChatSidebar() {
    this.gameHelpersService.toggleChat();
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
}
