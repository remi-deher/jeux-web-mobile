import { Component } from '@angular/core';
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

  constructor(private gameService: GameService) {
    this.username = this.gameService.username;
    this.currentRoom = this.gameService.currentRoom;
  }

  getGameType(): string {
    return this.currentRoom()?.gameType || '';
  }

  resetUsername() {
    this.gameService.setUsername('');
  }
}
