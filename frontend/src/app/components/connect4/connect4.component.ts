import { Component, computed, signal, effect, DestroyRef, inject } from '@angular/core';
import { GameService } from '../../services/game.service';
import { GameLayoutComponent } from '../game-layout/game-layout.component';

@Component({
  selector: 'app-connect4',
  standalone: true,
  imports: [GameLayoutComponent],
  template: `
    <app-game-layout
      gameTitle="Puissance 4"
      [rules]="[
        'Le Puissance 4 se joue sur une grille verticale de 7 colonnes et 6 rangées.',
        'Chaque joueur dispose de jetons d\\'une couleur (rouge ou jaune).',
        'Chacun leur tour, les joueurs laissent glisser un jeton dans la colonne de leur choix. Le jeton tombe au niveau le plus bas possible.',
        'Le premier joueur qui parvient à aligner 4 jetons consécutifs de sa couleur horizontalement, verticalement ou en diagonale gagne la partie.',
        'Si la grille est remplie sans aucun alignement de 4 jetons, la partie est déclarée nulle.'
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
      player1IndicatorClass="token token-red"
      player2IndicatorClass="token token-yellow"
      player1Color="#ff4b5c"
      player2Color="#ffd13b"
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
            <span class="floating-emoji material-symbols">{{ item.emoji }}</span>
          }
        </div>

        <div class="board-grid">
          <!-- Drop indicator zone above board -->
          <div class="drop-indicators">
            @for (col of [0,1,2,3,4,5,6]; track col) {
              <button 
                class="drop-arrow-btn" 
                [class.my-turn]="isMyTurn()" 
                [class.col-hovered]="hoveredColumn() === col"
                (click)="makeMove(col)"
                [disabled]="!isMyTurn()"
                (mouseenter)="hoveredColumn.set(col)"
                (mouseleave)="hoveredColumn.set(null)"
              >
                @if (isMyTurn()) {
                  <span class="material-symbols arrow-down" [class.red]="currentPlayerNum() === 1" [class.yellow]="currentPlayerNum() === 2">arrow_downward</span>
                }
              </button>
            }
          </div>

          <!-- Main board mesh -->
          <div class="board-mesh">
            @for (rowIdx of [0,1,2,3,4,5]; track rowIdx) {
              @for (colIdx of [0,1,2,3,4,5,6]; track colIdx) {
                <div 
                  class="board-cell"
                  [class.winning-cell]="isWinningCell(rowIdx, colIdx)"
                  (click)="makeMove(colIdx)"
                  (mouseenter)="hoveredColumn.set(colIdx)"
                  (mouseleave)="hoveredColumn.set(null)"
                >
                  <!-- Slot content -->
                  @if (board()[rowIdx][colIdx] === 1) {
                    <div class="token token-red animate-drop"></div>
                  } @else if (board()[rowIdx][colIdx] === 2) {
                    <div class="token token-yellow animate-drop"></div>
                  } @else if (previewRow() === rowIdx && hoveredColumn() === colIdx) {
                    <div class="token ghost-token" [class.red]="currentPlayerNum() === 1" [class.yellow]="currentPlayerNum() === 2"></div>
                  } @else {
                    <div class="token-slot-empty"></div>
                  }
                </div>
              }
            }
          </div>
        </div>
      </div>
    </app-game-layout>
  `,
  styles: [`
    .board-wrapper {
      position: relative;
      height: 100%;
      margin: 0 auto;
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 0;
      width: 100%;
    }

    .board-grid {
      display: flex;
      flex-direction: column;
      background: #1e1e38;
      border: 6px solid #2e2e54;
      border-radius: 18px;
      padding: 10px;
      box-shadow: 0 15px 35px rgba(0, 0, 0, 0.5);
    }

    .drop-indicators {
      display: grid;
      grid-template-columns: repeat(7, min(80px, calc((100dvh - 150px) / 7.5), calc((100vw - 80px) / 7)));
      gap: 8px;
      height: 40px;
      margin-bottom: 8px;
    }

    .drop-arrow-btn {
      background: none;
      border: none;
      height: 100%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .drop-arrow-btn.my-turn:hover,
    .drop-arrow-btn.col-hovered {
      opacity: 1;
    }

    .arrow-down {
      font-size: 20px;
    }
    .arrow-down.red {
      color: #ff4b5c;
    }
    .arrow-down.yellow {
      color: #ffd13b;
    }

    .board-mesh {
      display: grid;
      grid-template-columns: repeat(7, min(80px, calc((100dvh - 150px) / 7.5), calc((100vw - 80px) / 7)));
      grid-template-rows: repeat(6, min(80px, calc((100dvh - 150px) / 7.5), calc((100vw - 80px) / 7)));
      gap: 8px;
      touch-action: manipulation;
    }

    .board-cell {
      background: #1a1a30;
      border-radius: 50%;
      padding: 4px;
      cursor: pointer;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
      touch-action: manipulation;
    }

    @media (hover: hover) {
      .board-cell:hover {
        background: rgba(255, 255, 255, 0.05);
      }
    }

    .winning-cell {
      background: rgba(16, 185, 129, 0.2) !important;
      border: 2px solid #10b981;
      animation: winGlow 1s infinite alternate;
    }

    .winning-cell .token {
      box-shadow: 0 0 15px currentColor;
    }

    /* Animations */
    .animate-drop {
      animation: dropIn 0.4s cubic-bezier(0.25, 1, 0.5, 1) forwards;
      width: 100%;
      height: 100%;
    }

    @keyframes dropIn {
      0% {
        transform: translateY(-300px);
        opacity: 0;
      }
      100% {
        transform: translateY(0);
        opacity: 1;
      }
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }

    @keyframes winGlow {
      0% {
        box-shadow: 0 0 5px #10b981;
      }
      100% {
        box-shadow: 0 0 20px #10b981;
      }
    }

    
    .token {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      box-shadow: inset 0 -4px 6px rgba(0, 0, 0, 0.4),
                  0 6px 8px rgba(0, 0, 0, 0.3);
      position: relative;
    }

    .token-red {
      background: radial-gradient(circle at 35% 35%, #ff4b5c 0%, #c01a2b 70%, #800e19 100%);
      border: 1px solid #c01a2b;
    }

    .token-yellow {
      background: radial-gradient(circle at 35% 35%, #ffd13b 0%, #cfa000 70%, #8a6a00 100%);
      border: 1px solid #cfa000;
    }

    .ghost-token {
      position: absolute;
      opacity: 0.4;
      pointer-events: none;
      width: 100%;
      height: 100%;
    }

    .ghost-token.red {
      background: radial-gradient(circle at 35% 35%, #ff4b5c, #c01a2b);
    }

    .ghost-token.yellow {
      background: radial-gradient(circle at 35% 35%, #ffd13b, #cfa000);
    }

    .token-slot-empty {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      box-shadow: inset 0 3px 5px rgba(0, 0, 0, 0.6);
      background: #111122;
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

    @media (orientation: landscape) and (min-width: 768px) {
      .board-grid {
        margin: 5px auto;
      }
    }
  `],
})
export class Connect4Component {
  private readonly destroyRef = inject(DestroyRef);
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

    effect(() => {
      const status = this.room()?.status;
      if (status === 'finished') {
        this.saveStatsLocally();
      }
    });
  }

  board = computed(() => this.room()?.gameState?.board || Array(6).fill(null).map(() => Array(7).fill(0)));

  isPlaying = computed(() => this.room()?.status === 'playing');

  hoveredColumn = signal<number | null>(null);

  previewRow = computed(() => {
    const col = this.hoveredColumn();
    if (col === null || !this.isMyTurn()) return null;
    const grid = this.board();
    for (let r = 5; r >= 0; r--) {
      if (grid[r][col] === 0) {
        return r;
      }
    }
    return null;
  });

  // Logic to identify which player number you are (1 or 2)
  myPlayerNum = computed(() => {
    const r = this.room();
    if (!r) return null;
    const socketId = this.gameService.getSocketId();
    const idx = r.players.findIndex(p => p.id === socketId);
    return idx !== -1 ? idx + 1 : null;
  });

  currentPlayerNum = computed(() => this.room()?.gameState?.currentPlayer || 1);

  isMyTurn = computed(() => {
    const r = this.room();
    if (r?.isLocal) return this.isPlaying();
    return this.isPlaying() && this.myPlayerNum() === this.currentPlayerNum();
  });

  player1Name = computed(() => this.room()?.players[0]?.username || 'Joueur 1');
  player2Name = computed(() => this.room()?.players[1]?.username || 'En attente...');

  winnerLabel = computed(() => {
    const winner = this.room()?.gameState?.winner;
    if (winner === 'draw') return 'draw';
    if (winner === 1) return this.player1Name();
    if (winner === 2) return this.player2Name();
    return '';
  });

  isWinner = computed(() => {
    const winner = this.room()?.gameState?.winner;
    return winner !== null && winner !== 'draw' && winner === this.myPlayerNum();
  });

  isLoser = computed(() => {
    const winner = this.room()?.gameState?.winner;
    return winner !== null && winner !== 'draw' && winner !== this.myPlayerNum();
  });

  makeMove(column: number) {
    if (!this.isMyTurn()) return;
    
    // Tap-to-Preview + Tap-to-Commit logic for seamless touch support
    if (this.hoveredColumn() === column) {
      this.gameService.makeC4Move(column);
      this.hoveredColumn.set(null);
    } else {
      this.hoveredColumn.set(column);
    }
  }

  isWinningCell(r: number, c: number): boolean {
    const winLine = this.room()?.gameState?.winningLine || [];
    return winLine.some((coord: [number, number]) => coord[0] === r && coord[1] === c);
  }

  leaveRoom() {
    this.gameService.leaveRoom();
  }

  shareInvitationLink() {
    const r = this.room();
    if (r) this.gameService.shareInvitationLink(r);
  }

  spawnFloatingEmoji(emoji: string) {
    const id = this.emojiId++;
    this.floatingEmojis.update((list: { id: number; emoji: string }[]) => [...list, { id, emoji }]);
    const t = setTimeout(() => {
      this.floatingEmojis.update((list: { id: number; emoji: string }[]) => list.filter((item: { id: number; emoji: string }) => item.id !== id));
    }, 2000);
    this.destroyRef.onDestroy(() => clearTimeout(t));
  }

  sendEmoji(emoji: string) {
    this.gameService.sendEmoji(emoji);
    this.spawnFloatingEmoji(emoji);
  }

  requestRematch() {
    this.gameService.requestRematch();
  }

  forceEnd() {
    this.gameService.forceEnd();
  }

  localOrOnlineTurnText = computed(() => {
    const r = this.room();
    if (r?.isLocal) {
      const colorText = this.currentPlayerNum() === 1 ? 'rouge' : 'jaune';
      return `Tour de : ${this.currentPlayerNum() === 1 ? this.player1Name() : this.player2Name()} (${colorText})`;
    }
    return "C'est votre tour ! Cliquez sur une colonne.";
  });

  localOrOnlineOpponentTurnText = computed(() => {
    const r = this.room();
    if (r?.isLocal) {
      return '';
    }
    return "En attente du coup de l'adversaire...";
  });

  private saveStatsLocally() {
    const r = this.room();
    if (!r) return;
    const winner = r.gameState?.winner;
    const myNum = this.myPlayerNum();
    if (!winner || !myNum) return;

    const storageKey = `c4_recorded_${r.id}`;
    if (localStorage.getItem(storageKey)) return;

    const gameKey = 'connect4';
    if (winner === 'draw') {
      this.incrementLocalStat(gameKey, 'draws');
    } else if (winner === myNum) {
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
