import { Component, computed, signal, effect } from '@angular/core';
import { GameService } from '../../services/game.service';
import { GameLayoutComponent } from '../game-layout/game-layout.component';

@Component({
  selector: 'app-tictactoe',
  standalone: true,
  imports: [GameLayoutComponent],
  template: `
    <app-game-layout
      gameTitle="Morpion"
      [rules]="[
        'Le Morpion (Tic-Tac-Toe) se joue sur une grille de 3x3 cases.',
        'Chaque joueur choisit son symbole : ✕ ou ◯.',
        'Les joueurs posent tour à tour leur symbole sur une case vide.',
        'Le premier à aligner 3 symboles identiques (horizontalement, verticalement ou en diagonale) remporte la partie.',
        'Si la grille est pleine sans alignement, la partie se termine par un match nul.'
      ]"
      [room]="room()"
      [isPlaying]="isPlaying()"
      [isMyTurn]="isMyTurn()"
      [turnAlertText]="localOrOnlineTurnText()"
      [opponentTurnText]="localOrOnlineOpponentTurnText()"
      [turnAlertClass]="room()?.isLocal ? (currentPlayerNum() === 1 ? 'local-turn-red' : 'local-turn-yellow') : ''"
      [winnerLabel]="winnerLabel()"
      [isWinner]="isWinner()"
      [isLoser]="isLoser()"
      [hasVotedRematch]="hasVotedRematch()"
      [disconnectedPlayerName]="disconnectedPlayerName()"
      [player1Name]="player1Name()"
      [player2Name]="player2Name()"
      [player1Active]="currentPlayerNum() === 1 && isPlaying()"
      [player2Active]="currentPlayerNum() === 2 && isPlaying()"
      player1IndicatorSymbol="✕"
      player2IndicatorSymbol="◯"
      (leaveRoom)="leaveRoom()"
      (requestRematch)="requestRematch()"
      (sendEmoji)="sendEmoji($event)"
      (forceEnd)="forceEnd()"
      (shareInvitation)="shareInvitationLink()"
    >
      <div game-board class="board-wrapper">
        <!-- Floating Emojis Layer -->
        <div class="floating-emojis-container">
          @for (item of floatingEmojis(); track item.id) {
            <span class="floating-emoji">{{ item.emoji }}</span>
          }
        </div>

        <!-- 3x3 Grid -->
        <div class="board-grid">
          @for (cell of board(); track $index) {
            <div 
              class="board-cell"
              [class.winning-cell]="isWinningCell($index)"
              [class.disabled]="!isMyTurn() || cell !== null"
              (click)="makeMove($index)"
            >
              @if (cell === 'X') {
                <span class="sign sign-x">✕</span>
              } @else if (cell === 'O') {
                <span class="sign sign-o">◯</span>
              }
            </div>
          }
        </div>
      </div>
    </app-game-layout>
  `,
  styles: [`
    .board-wrapper {
      position: relative;
      margin: 0 auto;
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 0;
      width: 100%;
    }

    .board-grid {
      display: grid;
      grid-template-columns: repeat(3, min(100px, 15vh));
      grid-template-rows: repeat(3, min(100px, 15vh));
      gap: 12px;
      background: rgba(30, 41, 59, 0.6);
      border: 4px solid var(--md-outline-variant);
      border-radius: var(--md-radius-xl);
      padding: 16px;
      box-shadow: 0 15px 35px rgba(0, 0, 0, 0.4);
    }

    .board-cell {
      background: #0f172a;
      border: 1px solid var(--md-outline-variant);
      border-radius: var(--md-radius-lg);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      box-shadow: inset 0 2px 4px rgba(0,0,0,0.5);
    }

    .board-cell:hover:not(.disabled) {
      background: #1e293b;
      transform: scale(1.02);
    }

    .board-cell.disabled {
      cursor: not-allowed;
    }

    .board-cell.winning-cell {
      animation: pulseWin 1.2s infinite alternate;
      border-color: #10b981;
    }

    @keyframes pulseWin {
      0% {
        box-shadow: inset 0 2px 4px rgba(0,0,0,0.5), 0 0 4px #10b981;
        background: #112240;
      }
      100% {
        box-shadow: inset 0 2px 4px rgba(0,0,0,0.5), 0 0 16px #10b981;
        background: #064e3b;
      }
    }

    .sign {
      font-size: min(48px, 8vh);
      font-weight: 800;
      animation: scaleIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }

    .sign-x {
      color: #ff4b5c;
      text-shadow: 0 0 12px rgba(255, 75, 92, 0.5);
    }

    .sign-o {
      color: #ffd13b;
      text-shadow: 0 0 12px rgba(255, 209, 59, 0.5);
    }

    @keyframes scaleIn {
      0% { transform: scale(0.5); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
    }

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

    @media (max-width: 480px) {
      .board-grid {
        grid-template-columns: repeat(3, min(80px, 22vw));
        grid-template-rows: repeat(3, min(80px, 22vw));
        gap: 8px;
        padding: 10px;
      }
      .sign {
        font-size: min(36px, 10vh);
      }
    }

    
    @media (orientation: landscape) and (min-width: 768px) {
      .board-grid {
        grid-template-columns: repeat(3, min(100px, 20vh));
        grid-template-rows: repeat(3, min(100px, 20vh));
        gap: 12px;
      }
    }
  `],
})
export class TicTacToeComponent {
  room;
  showRulesModal = signal<boolean>(false);

  floatingEmojis = signal<{ id: number; emoji: string }[]>([]);
  private emojiId = 0;

  hasDisconnectedPlayer = computed(() => this.room()?.players.some(p => p.disconnected) || false);
  
  disconnectedPlayerName = computed(() => {
    const p = this.room()?.players.find(p => p.disconnected);
    return p ? p.username : '';
  });

  amIDisconnected = computed(() => {
    const socketId = this.gameService.getSocketId();
    const p = this.room()?.players.find(p => p.id === socketId);
    return p ? !!p.disconnected : false;
  });

  hasVotedRematch = computed(() => {
    const votes = this.room()?.rematchVotes || [];
    const socketId = this.gameService.getSocketId();
    return socketId ? votes.includes(socketId) : false;
  });

  constructor(private gameService: GameService) {
    this.room = this.gameService.currentRoom;

    effect(() => {
      const rx = this.gameService.emojiReaction();
      if (rx) {
        this.spawnFloatingEmoji(rx.emoji);
      }
    }, { allowSignalWrites: true });

    // Track game over to save local stats
    effect(() => {
      const status = this.room()?.status;
      if (status === 'finished') {
        this.saveStatsLocally();
      }
    });
  }

  board = computed(() => this.room()?.gameState?.board || Array(9).fill(null));

  isPlaying = computed(() => this.room()?.status === 'playing');

  myPlayerSign = computed<'X' | 'O' | null>(() => {
    const r = this.room();
    if (!r) return null;
    const socketId = this.gameService.getSocketId();
    const idx = r.players.findIndex(p => p.id === socketId);
    return idx === 0 ? 'X' : idx === 1 ? 'O' : null;
  });

  currentPlayerSign = computed<'X' | 'O'>(() => this.room()?.gameState?.currentPlayer || 'X');

  isMyTurn = computed(() => {
    const r = this.room();
    if (r?.isLocal) return this.isPlaying();
    return this.isPlaying() && this.myPlayerSign() === this.currentPlayerSign();
  });

  localOrOnlineTurnText = computed(() => {
    const r = this.room();
    if (r?.isLocal) {
      const colorText = this.currentPlayerSign() === 'X' ? 'rouge' : 'jaune';
      return `Tour de : ${this.currentPlayerSign() === 'X' ? this.player1Name() : this.player2Name()} (${colorText})`;
    }
    return "C'est votre tour ! Cliquez sur une case vide.";
  });

  localOrOnlineOpponentTurnText = computed(() => {
    const r = this.room();
    if (r?.isLocal) {
      return '';
    }
    return "En attente du coup adverse...";
  });

  currentPlayerNum = computed(() => this.currentPlayerSign() === 'X' ? 1 : 2);

  player1Name = computed(() => this.room()?.players[0]?.username || 'Joueur X');
  player2Name = computed(() => this.room()?.players[1]?.username || 'En attente...');

  winnerLabel = computed(() => {
    const winner = this.room()?.gameState?.winner;
    if (winner === 'draw') return 'draw';
    if (winner === 'X') return this.player1Name();
    if (winner === 'O') return this.player2Name();
    return '';
  });

  isWinner = computed(() => {
    const winner = this.room()?.gameState?.winner;
    return winner !== null && winner !== 'draw' && winner === this.myPlayerSign();
  });

  isLoser = computed(() => {
    const winner = this.room()?.gameState?.winner;
    return winner !== null && winner !== 'draw' && winner !== this.myPlayerSign();
  });

  makeMove(cellIndex: number) {
    if (this.isMyTurn() && this.board()[cellIndex] === null) {
      this.gameService.makeTttMove(cellIndex);
    }
  }

  isWinningCell(cellIndex: number): boolean {
    const winLine = this.room()?.gameState?.winningLine || [];
    return winLine.includes(cellIndex);
  }

  spawnFloatingEmoji(emoji: string) {
    const id = this.emojiId++;
    this.floatingEmojis.update(list => [...list, { id, emoji }]);
    setTimeout(() => {
      this.floatingEmojis.update(list => list.filter(item => item.id !== id));
    }, 2000);
  }

  sendEmoji(emoji: string) {
    this.gameService.sendEmoji(emoji);
    this.spawnFloatingEmoji(emoji);
  }

  leaveRoom() {
    this.gameService.leaveRoom();
  }

  shareInvitationLink() {
    const r = this.room();
    if (r) this.gameService.shareInvitationLink(r);
  }

  requestRematch() {
    this.gameService.requestRematch();
  }

  forceEnd() {
    this.gameService.forceEnd();
  }

  private saveStatsLocally() {
    const r = this.room();
    if (!r) return;
    const winner = r.gameState?.winner;
    const mySign = this.myPlayerSign();
    if (!winner || !mySign) return;

    // Check if stats are already recorded for this roomId to avoid double triggers
    const storageKey = `ttt_recorded_${r.id}`;
    if (localStorage.getItem(storageKey)) return;

    const gameKey = 'tictactoe';
    if (winner === 'draw') {
      this.incrementLocalStat(gameKey, 'draws');
    } else if (winner === mySign) {
      this.incrementLocalStat(gameKey, 'wins');
    } else {
      this.incrementLocalStat(gameKey, 'losses');
    }

    localStorage.setItem(storageKey, 'true');
  }

  private incrementLocalStat(game: string, statType: 'wins' | 'losses' | 'draws') {
    const key = `stats_${game}_${statType}`;
    const current = parseInt(localStorage.getItem(key) || '0', 10);
    localStorage.setItem(key, (current + 1).toString());
  }
}
