import { Component, computed, signal, effect, HostListener, Signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameService } from '../../services/game.service';
import { GameLayoutComponent } from '../game-layout/game-layout.component';
import { Room, BattleshipGameState, BattleshipPlayerState, BattleshipShip } from '../../models/game.models';
import { GameHelpersService } from '../../services/game-helpers.service';
@Component({
  selector: 'app-battleship',
  standalone: true,
  imports: [CommonModule, GameLayoutComponent],
  templateUrl: './battleship.component.html',
  styleUrls: ['./battleship.component.css']
})
export class BattleshipComponent {
  private gameService = inject(GameService);
  private gameHelpersService = inject(GameHelpersService);

  room: Signal<Room<BattleshipGameState> | null>;
  showRulesModal = signal<boolean>(false);
  isHorizontal = signal<boolean>(true);
  selectedShipId = signal<string | null>(null);

  private emojiHelper = this.gameHelpersService.setupFloatingEmojis(() => this.gameService.emojiReaction());
  floatingEmojis = this.emojiHelper.floatingEmojis;

  localActivePlayerId = signal<string>('');
  showPassDeviceOverlay = signal<boolean>(false);
  passToPlayerName = signal<string>('');
  passActionCallback = signal<(() => void) | null>(null);

  previewStart = signal<{ r: number; c: number } | null>(null);

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

  constructor() {
    this.room = this.gameService.currentRoom;

    effect(() => {
      const rx = this.gameService.emojiReaction();
      if (rx) {
        this.emojiHelper.spawnEmoji(rx.emoji);
      }
    }, { allowSignalWrites: true });

    effect(() => {
      const status = this.room()?.status;
      if (status === 'finished') {
        const r = this.room();
        if (r) {
          this.gameHelpersService.triggerHaptic('success');
          this.gameHelpersService.saveStatsLocally(
            'battleship',
            r.id,
            r.gameState?.winnerId,
            !!r.isLocal,
            this.gameService.getSocketId()
          );
        }
      }
    });

    effect(() => {
      const r = this.room();
      if (r) {
        const socketId = this.gameService.getSocketId() || '';
        if (r.isLocal && !this.localActivePlayerId()) {
          this.localActivePlayerId.set(socketId);
        }
      }
    }, { allowSignalWrites: true });

    effect(() => {
      const r = this.room();
      const phase = this.phase();
      const socketId = this.gameService.getSocketId() || '';
      if (r && r.isLocal) {
        if (phase === 'setup' && this.localActivePlayerId() !== socketId) {
          const players = r.gameState?.players || {};
          const allNotReady = Object.values(players).every((p: any) => !p.ready);
          if (allNotReady) {
            this.localActivePlayerId.set(socketId);
            this.showPassDeviceOverlay.set(false);
          }
        }
      }
    }, { allowSignalWrites: true });

    effect(() => {
      const r = this.room();
      if (r?.isLocal && r.status === 'playing' && r.gameState?.phase === 'playing') {
        const turnId = r.gameState.currentPlayerId;
        const currentActive = this.localActivePlayerId();
        if (turnId && currentActive && turnId !== currentActive && !this.showPassDeviceOverlay()) {
          const targetPlayer = r.players.find(p => p.id === turnId);
          this.passToPlayerName.set(targetPlayer?.username || 'Joueur Suivant');
          this.passActionCallback.set(() => {
            this.localActivePlayerId.set(turnId);
            this.showPassDeviceOverlay.set(false);
          });
          this.showPassDeviceOverlay.set(true);
        }
      }
    }, { allowSignalWrites: true });
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    if (this.phase() !== 'setup' || !this.selectedShipId()) return;
    if (event.key === ' ' || event.key === 'r' || event.key === 'R') {
      event.preventDefault();
      this.toggleOrientation();
    }
  }

  localOrOnlineTurnText = computed(() => {
    const r = this.room();
    if (!r) return '';
    if (r.isLocal) {
      if (this.phase() === 'setup') {
        const currentPlayerName = this.localActivePlayerId() === 'local-player-2' ? 'Joueur 2' : this.player1Name();
        return `${currentPlayerName} doit placer ses bateaux`;
      }
      return `Tour de : ${r.gameState?.currentPlayerId === 'local-player-2' ? 'Joueur 2' : this.player1Name()}`;
    }
    if (this.phase() === 'setup') {
      return this.myState()?.ready 
        ? `En attente de l'adversaire (${this.player2Name()})` 
        : `${this.player1Name()} doit placer ses bateaux`;
    }
    return "Système d'armement paré. Sélectionnez une cible radar.";
  });

  localOrOnlineOpponentTurnText = computed(() => {
    const r = this.room();
    if (!r || r.isLocal) return '';
    if (this.phase() === 'setup') {
      return this.myState()?.ready ? "En attente de l'adversaire..." : "Déploiement en cours...";
    }
    return "Alerte : En attente du tir hostile...";
  });

  player1Name = computed(() => this.room()?.players[0]?.username || 'Joueur 1');
  player2Name = computed(() => this.room()?.players[1]?.username || 'En attente...');

  currentPlayerNum = computed(() => {
    const r = this.room();
    if (!r || !r.gameState) return 1;
    if (r.isLocal) {
      return this.localActivePlayerId() === 'local-player-2' ? 2 : 1;
    }
    const socketId = this.gameService.getSocketId();
    const idx = r.players.findIndex(p => p.id === socketId);
    if (idx !== -1) {
      const isMyTurn = this.phase() === 'playing' && r.gameState.currentPlayerId === socketId;
      if (idx === 0) {
        return isMyTurn ? 1 : 2;
      } else {
        return isMyTurn ? 2 : 1;
      }
    }
    return 1;
  });

  winnerLabel = computed(() => {
    const r = this.room();
    if (!r || !r.gameState) return '';
    const winnerId = r.gameState.winnerId;
    if (!winnerId) return '';
    if (r.isLocal) {
      return winnerId === 'local-player-2' ? 'Joueur 2' : this.player1Name();
    }
    const winnerIdx = r.players.findIndex(p => p.id === winnerId);
    return winnerIdx !== -1 ? r.players[winnerIdx].username : '';
  });

  opponentName = computed(() => {
    const num = this.currentPlayerNum();
    return num === 1 ? this.player2Name() : this.player1Name();
  });

  phase = computed(() => this.room()?.gameState?.phase || 'setup');
  isPlaying = computed(() => this.room()?.status === 'playing');

  myState = computed(() => {
    const r = this.room();
    if (!r || !r.gameState) return null;
    const activeId = r.isLocal ? this.localActivePlayerId() : (this.gameService.getSocketId() || '');
    return r.gameState.players[activeId];
  });

  opponentState = computed(() => {
    const r = this.room();
    if (!r || !r.gameState) return null;
    const activeId = r.isLocal ? this.localActivePlayerId() : (this.gameService.getSocketId() || '');
    const oppId = Object.keys(r.gameState.players).find(id => id !== activeId);
    return oppId ? r.gameState.players[oppId] : null;
  });

  myBoard = computed(() => this.myState()?.board || Array(10).fill(null).map(() => Array(10).fill('empty')));
  opponentBoard = computed(() => this.opponentState()?.board || Array(10).fill(null).map(() => Array(10).fill('empty')));

  isMyTurn = computed(() => {
    const r = this.room();
    if (!r || !r.gameState) return false;
    if (this.phase() === 'setup') {
      return !this.myState()?.ready;
    }
    const activeId = r.isLocal ? this.localActivePlayerId() : (this.gameService.getSocketId() || '');
    return this.phase() === 'playing' && r.gameState.currentPlayerId === activeId;
  });

  allShipsPlaced = computed(() => {
    return this.myState()?.ships.every((s: any) => s.placed) || false;
  });

  isWinner = computed(() => {
    const r = this.room();
    if (!r || !r.gameState) return false;
    if (r.isLocal) {
      return r.gameState.winnerId !== null;
    }
    const socketId = this.gameService.getSocketId();
    return r.gameState.winnerId === socketId;
  });

  isLoser = computed(() => {
    const r = this.room();
    if (!r || !r.gameState) return false;
    if (r.isLocal) return false;
    const socketId = this.gameService.getSocketId();
    const winnerId = r.gameState.winnerId;
    return winnerId !== null && winnerId !== socketId;
  });

  toggleOrientation() {
    this.gameHelpersService.triggerHaptic('click');
    this.isHorizontal.update(v => !v);
  }

  selectShip(shipId: string) {
    this.gameHelpersService.triggerHaptic('click');
    this.selectedShipId.set(shipId);
    this.previewStart.set(null);
  }

  getShipFrenchName(id: string): string {
    const names: { [key: string]: string } = {
      carrier: 'Porte-avions',
      battleship: 'Croiseur',
      cruiser: 'Contre-torpilleur',
      submarine: 'Sous-marin',
      destroyer: 'Torpilleur'
    };
    return names[id] || id;
  }

  getShipSvg(id: string): string {
    const svgs: { [key: string]: string } = {
      carrier: `<svg viewBox="0 0 100 24" style="width:100%; height:100%;" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M5,12 L15,4 L85,4 L95,12 L85,20 L15,20 Z" fill="rgba(255,255,255,0.05)" />
        <rect x="25" y="7" width="50" height="10" fill="rgba(255,255,255,0.15)" stroke="currentColor" stroke-width="1" />
        <line x1="20" y1="12" x2="80" y2="12" stroke="currentColor" stroke-dasharray="2,2" />
      </svg>`,
      battleship: `<svg viewBox="0 0 80 24" style="width:100%; height:100%;" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M5,12 L12,5 L68,5 L75,12 L68,19 L12,19 Z" fill="rgba(255,255,255,0.05)" />
        <circle cx="24" cy="12" r="3" fill="currentColor" />
        <circle cx="56" cy="12" r="3" fill="currentColor" />
      </svg>`,
      cruiser: `<svg viewBox="0 0 60 24" style="width:100%; height:100%;" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M5,12 L10,6 L50,6 L55,12 L50,18 L10,18 Z" fill="rgba(255,255,255,0.05)" />
        <rect x="18" y="9" width="24" height="6" fill="currentColor" />
      </svg>`,
      submarine: `<svg viewBox="0 0 60 24" style="width:100%; height:100%;" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M5,12 C5,7 15,7 25,7 C30,7 35,3 37,3 L39,3 L39,7 C49,7 55,7 55,12 C55,17 49,17 39,17 L39,21 L37,21 L35,17 C25,17 15,17 5,12 Z" fill="rgba(255,255,255,0.05)" />
      </svg>`,
      destroyer: `<svg viewBox="0 0 40 24" style="width:100%; height:100%;" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M5,12 L10,7 L35,7 L35,17 L10,17 Z" fill="rgba(255,255,255,0.05)" />
        <line x1="15" y1="12" x2="30" y2="12" stroke="currentColor" />
      </svg>`
    };
    return svgs[id] || '';
  }

  // Previews coordinates
  previewCells = computed(() => {
    const start = this.previewStart();
    const shipId = this.selectedShipId();
    if (!start || !shipId) return [];
    const ship = this.myState()?.ships.find((s: any) => s.id === shipId);
    if (!ship) return [];
    
    const cells: { r: number; c: number }[] = [];
    for (let i = 0; i < ship.size; i++) {
      const r = this.isHorizontal() ? start.r : start.r + i;
      const c = this.isHorizontal() ? start.c + i : start.c;
      if (r < 10 && c < 10) {
        cells.push({ r, c });
      }
    }
    return cells;
  });

  // Verification if placement fits and doesn't overlap
  isPreviewValid = computed(() => {
    const cells = this.previewCells();
    const shipId = this.selectedShipId();
    if (cells.length === 0 || !shipId) return false;
    
    const ship = this.myState()?.ships.find((s: any) => s.id === shipId);
    if (!ship || cells.length < ship.size) return false;

    // Check overlap with other ALREADY placed ships
    const state = this.myState();
    if (!state) return false;
    
    for (const otherShip of state.ships) {
      if (otherShip.id === shipId || !otherShip.placed) continue;
      
      // Calculate other ship's active cells
      for (let i = 0; i < otherShip.size; i++) {
        const osr = otherShip.horizontal ? otherShip.row : otherShip.row + i;
        const osc = otherShip.horizontal ? otherShip.col + i : otherShip.col;
        if (cells.some(cell => cell.r === osr && cell.c === osc)) {
          return false;
        }
      }
    }
    return true;
  });

  isInPreview(row: number, col: number): boolean {
    return this.previewCells().some(cell => cell.r === row && cell.c === col);
  }

  getShipSegmentClass(r: number, c: number): string {
    const classes: string[] = [];

    // 1. Check actual placed ships
    const state = this.myState();
    if (state) {
      for (const ship of state.ships) {
        if (!ship.placed) continue;
        
        let isPart = false;
        let idx = -1;
        for (let i = 0; i < ship.size; i++) {
          const sr = ship.horizontal ? ship.row : ship.row + i;
          const sc = ship.horizontal ? ship.col + i : ship.col;
          if (sr === r && sc === c) {
            isPart = true;
            idx = i;
            break;
          }
        }

        if (isPart) {
          const isStart = idx === 0;
          const isEnd = idx === ship.size - 1;
          
          let segment = 'body';
          if (isStart) segment = 'bow';
          else if (isEnd) segment = 'stern';
          
          const dir = ship.horizontal ? 'h' : 'v';
          classes.push('ship-part');
          classes.push(`ship-${segment}-${dir}`);
          break;
        }
      }
    }
    
    // 2. Check preview cells
    const cells = this.previewCells();
    const idx = cells.findIndex(cell => cell.r === r && cell.c === c);
    if (idx !== -1) {
      const isStart = idx === 0;
      const isEnd = idx === cells.length - 1;
      const isH = this.isHorizontal();
      let segment = 'body';
      if (isStart) segment = 'bow';
      else if (isEnd) segment = 'stern';
      const dir = isH ? 'h' : 'v';
      classes.push('preview-part');
      classes.push(`preview-${segment}-${dir}`);
    }

    return classes.join(' ');
  }

  cellMouseEnter(row: number, col: number) {
    if (this.phase() !== 'setup' || !this.selectedShipId()) return;
    this.previewStart.set({ r: row, c: col });
  }

  cellClickMyBoard(row: number, col: number) {
    if (this.phase() !== 'setup' || !this.selectedShipId()) return;

    const start = this.previewStart();
    const isInPrev = this.isInPreview(row, col);

    // Touch support / Click mechanics:
    // Case 1: Tapping the start cell confirms (places) the ship
    if (start && start.r === row && start.c === col && isInPrev) {
      if (this.isPreviewValid()) {
        this.gameHelpersService.triggerHaptic('success');
        this.gameService.placeBsShip(
          this.selectedShipId()!,
          row,
          col,
          this.isHorizontal(),
          this.room()?.isLocal ? this.localActivePlayerId() : undefined
        );
        this.selectedShipId.set(null);
        this.previewStart.set(null);
      } else {
        this.gameHelpersService.triggerHaptic('error');
      }
    }
    // Case 2: Tapping any OTHER cell inside the preview rotates it
    else if (isInPrev) {
      this.gameHelpersService.triggerHaptic('click');
      this.toggleOrientation();
    }
    // Case 3: Tapping outside the preview moves it there
    else {
      this.gameHelpersService.triggerHaptic('click');
      this.previewStart.set({ r: row, c: col });
    }
  }

  setReady() {
    const r = this.room();
    if (r?.isLocal) {
      const activeId = this.localActivePlayerId();
      const socketId = this.gameService.getSocketId() || '';
      if (activeId === socketId) {
        this.gameService.setBsReady(activeId);
        const p2 = r.players[1]?.id || 'local-player-2';
        this.passToPlayerName.set(r.players[1]?.username || 'Joueur 2');
        this.passActionCallback.set(() => {
          this.localActivePlayerId.set(p2);
          this.showPassDeviceOverlay.set(false);
          this.selectedShipId.set(null);
          this.previewStart.set(null);
        });
        this.showPassDeviceOverlay.set(true);
      } else {
        this.gameService.setBsReady(activeId);
      }
    } else {
      this.gameService.setBsReady();
    }
  }

  fireShot(row: number, col: number) {
    if (!this.isMyTurn()) return;
    const targetCell = this.opponentBoard()[row][col];
    if (targetCell === 'hit' || targetCell === 'miss') return;

    this.gameHelpersService.triggerHaptic('click');
    this.gameService.fireBsShot(row, col, this.room()?.isLocal ? this.localActivePlayerId() : undefined);
  }

  passToPlayerNameConfirm() {
    const callback = this.passActionCallback();
    if (callback) {
      callback();
    }
  }

  leaveRoom() {
    this.gameService.leaveRoom();
  }

  shareInvitationLink() {
    const r = this.room();
    if (r) this.gameService.shareInvitationLink(r);
  }

  sendEmoji(emoji: string) {
    this.gameService.sendEmoji(emoji);
    this.emojiHelper.spawnEmoji(emoji);
  }

  requestRematch() {
    this.gameService.requestRematch();
  }

  forceEnd() {
    this.gameService.forceEnd();
  }
}
