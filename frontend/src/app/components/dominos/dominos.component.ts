import { Component, computed, inject, signal } from '@angular/core';
import { GameService } from '../../services/game.service';
import { GameLayoutComponent } from '../game-layout/game-layout.component';
import { FloatingEmojisComponent } from '../floating-emojis/floating-emojis.component';
import { injectGameSession } from '../../services/game-session.helper';
import { DominosGameState, PlacedTile, PlayableEndpoint } from '../../models/game.models';

@Component({
  selector: 'app-dominos',
  standalone: true,
  imports: [GameLayoutComponent, FloatingEmojisComponent],
  templateUrl: './dominos.component.html',
  styleUrls: ['./dominos.component.css']
})
export class DominosComponent {
  private gameService = inject(GameService);
  private session = injectGameSession('dominos');

  get rules(): string[] {
    const variant = this.room()?.variant ?? 'classic';
    const baseRules = [
      'Chaque joueur reçoit 7 dominos au début.',
      'Le reste des dominos forme la pioche (le talon ou boneyard).'
    ];

    if (variant === 'classic') {
      return [
        ...baseRules,
        'Variante Classique : chaîne linéaire.',
        'Jouez une tuile ayant une valeur correspondante à l\'un des deux bouts du plateau.',
        'Si aucun domino n\'est jouable, piochez jusqu\'à pouvoir jouer.',
        'Si la pioche est vide, passez votre tour.',
        'Le premier joueur à vider sa main gagne. En cas de blocage, le joueur ayant le moins de points restants l\'emporte.'
      ];
    } else if (variant === 'branches') {
      return [
        ...baseRules,
        'Variante Branches : structure en arbre.',
        'Chaque double posé ouvre une nouvelle branche perpendiculaire (haut/bas).',
        'Vous pouvez jouer sur n\'importe quel bout ouvert de cette structure.',
        'Si aucun domino n\'est jouable, piochez jusqu\'à pouvoir jouer.',
        'Si la pioche est vide, passez votre tour.',
        'Le premier joueur à vider sa main gagne. En cas de blocage, le joueur ayant le moins de points restants l\'emporte.'
      ];
    } else {
      return [
        ...baseRules,
        'Variante Grille 2D : puzzle en deux dimensions.',
        'Les dominos sont posés librement sur une grille plate.',
        'Une tuile doit toucher au moins une tuile existante.',
        'Toutes ses faces adjacentes doivent correspondre parfaitement en nombre de points.',
        'Si aucun domino n\'est jouable, piochez jusqu\'à pouvoir jouer.',
        'Si la pioche est vide, passez votre tour.',
        'Le premier joueur à vider sa main gagne. En cas de blocage, le joueur ayant le moins de points restants l\'emporte.'
      ];
    }
  }

  room = this.session.room;
  isPlaying = this.session.isPlaying;
  floatingEmojis = this.session.floatingEmojis;
  disconnectedPlayerName = this.session.disconnectedPlayerName;
  hasVotedRematch = this.session.hasVotedRematch;
  player1Name = this.session.player1Name;
  player2Name = this.session.player2Name;
  leaveRoom = this.session.leaveRoom;
  shareInvitationLink = this.session.shareInvitationLink;
  requestRematch = this.session.requestRematch;
  forceEnd = this.session.forceEnd;
  sendEmoji = this.session.sendEmoji;

  selectedTileIndex = signal<number | null>(null);
  draggedTileIndex = signal<number | null>(null);
  activeDragOverEp = signal<PlayableEndpoint | null>(null);

  private gs = computed(() => this.room()?.gameState as DominosGameState);

  placedTiles = computed(() => this.gs()?.placedTiles ?? []);
  handP1 = computed(() => this.gs()?.handP1 ?? []);
  handP2 = computed(() => this.gs()?.handP2 ?? []);
  boneyard = computed(() => this.gs()?.boneyard ?? []);
  currentPlayerNum = computed(() => this.gs()?.currentPlayer ?? 1);
  winner = computed(() => this.gs()?.winner ?? null);
  winnerReason = computed(() => this.gs()?.winnerReason ?? '');

  myPlayerNum = computed<number | null>(() => {
    const r = this.room();
    if (!r) return null;
    const socketId = this.gameService.getSocketId();
    const idx = r.players.findIndex((p: any) => p.id === socketId);
    return idx !== -1 ? idx + 1 : null;
  });

  isMyTurn = computed(() => {
    const r = this.room();
    if (r?.isLocal) return this.isPlaying();
    return this.isPlaying() && this.myPlayerNum() === this.currentPlayerNum();
  });

  scoreP1Label = computed(() => `${this.handP1().length} tuile${this.handP1().length > 1 ? 's' : ''}`);
  scoreP2Label = computed(() => `${this.handP2().length} tuile${this.handP2().length > 1 ? 's' : ''}`);

  winnerLabel = computed(() => {
    const win = this.winner();
    if (win === 'draw') return 'draw';
    if (win === 1) return this.player1Name();
    if (win === 2) return this.player2Name();
    return '';
  });

  isWinner = computed(() => {
    const win = this.winner();
    return win !== null && win !== 'draw' && win === this.myPlayerNum();
  });

  isLoser = computed(() => {
    const win = this.winner();
    return win !== null && win !== 'draw' && win !== this.myPlayerNum();
  });

  myHand = computed(() => {
    const r = this.room();
    if (r?.isLocal) {
      return this.currentPlayerNum() === 1 ? this.handP1() : this.handP2();
    }
    return this.myPlayerNum() === 1 ? this.handP1() : this.handP2();
  });

  opponentHandCount = computed(() => {
    const r = this.room();
    if (r?.isLocal) return 0;
    return this.myPlayerNum() === 1 ? this.handP2().length : this.handP1().length;
  });

  opponentHandArray = computed<number[]>(() => {
    return Array(this.opponentHandCount()).fill(0);
  });

  allEndpoints = computed(() => {
    const state = this.gs();
    if (!state) return [];
    return getPlayableEndpoints(state);
  });

  activeTile = computed<[number, number] | null>(() => {
    const idx = this.selectedTileIndex() !== null ? this.selectedTileIndex() : this.draggedTileIndex();
    if (idx === null) return null;
    const hand = this.myHand();
    if (idx < 0 || idx >= hand.length) return null;
    return hand[idx];
  });

  hasAnyPlayableTile = computed(() => {
    const hand = this.myHand();
    return hand.some(tile => this.isTilePlayable(tile));
  });

  canDraw = computed(() => {
    return this.isMyTurn() && !this.hasAnyPlayableTile() && this.boneyard().length > 0;
  });

  canPass = computed(() => {
    return this.isMyTurn() && !this.hasAnyPlayableTile() && this.boneyard().length === 0;
  });

  minX = computed(() => {
    const tiles = this.placedTiles();
    if (tiles.length === 0) return 0;
    return Math.min(...tiles.map(t => Math.min(t.x1, t.x2)), 0);
  });

  maxX = computed(() => {
    const tiles = this.placedTiles();
    if (tiles.length === 0) return 1;
    return Math.max(...tiles.map(t => Math.max(t.x1, t.x2)), 1);
  });

  minY = computed(() => {
    const tiles = this.placedTiles();
    if (tiles.length === 0) return 0;
    return Math.min(...tiles.map(t => Math.min(t.y1, t.y2)), 0);
  });

  maxY = computed(() => {
    const tiles = this.placedTiles();
    if (tiles.length === 0) return 0;
    return Math.max(...tiles.map(t => Math.max(t.y1, t.y2)), 0);
  });

  boardGridCols = computed(() => {
    const min = this.minX() - 2;
    const max = this.maxX() + 2;
    return `repeat(${max - min + 1}, 60px)`;
  });

  boardGridRows = computed(() => {
    const min = this.minY() - 2;
    const max = this.maxY() + 2;
    return `repeat(${max - min + 1}, 60px)`;
  });

  getTileGridCol(pt: PlacedTile): string {
    const minX = this.minX() - 2;
    const startX = Math.min(pt.x1, pt.x2);
    return `${startX - minX + 1} / span ${pt.x1 === pt.x2 ? 1 : 2}`;
  }

  getTileGridRow(pt: PlacedTile): string {
    const minY = this.minY() - 2;
    const startY = Math.min(pt.y1, pt.y2);
    return `${startY - minY + 1} / span ${pt.y1 === pt.y2 ? 1 : 2}`;
  }

  getEpGridCol(ep: PlayableEndpoint): string {
    const minX = this.minX() - 2;
    const startX = Math.min(ep.xConnect, ep.xOuter);
    return `${startX - minX + 1} / span ${ep.xConnect === ep.xOuter ? 1 : 2}`;
  }

  getEpGridRow(ep: PlayableEndpoint): string {
    const minY = this.minY() - 2;
    const startY = Math.min(ep.yConnect, ep.yOuter);
    return `${startY - minY + 1} / span ${ep.yConnect === ep.yOuter ? 1 : 2}`;
  }

  getDots(value: number): boolean[] {
    switch (value) {
      case 0: return [
        false, false, false,
        false, false, false,
        false, false, false
      ];
      case 1: return [
        false, false, false,
        false, true,  false,
        false, false, false
      ];
      case 2: return [
        true,  false, false,
        false, false, false,
        false, false, true
      ];
      case 3: return [
        true,  false, false,
        false, true,  false,
        false, false, true
      ];
      case 4: return [
        true,  false, true,
        false, false, false,
        true,  false, true
      ];
      case 5: return [
        true,  false, true,
        false, true,  false,
        true,  false, true
      ];
      case 6: return [
        true,  false, true,
        true,  false, true,
        true,  false, true
      ];
      default: return Array(9).fill(false);
    }
  }

  isTilePlayable(tile: [number, number]): boolean {
    if (!this.isMyTurn()) return false;
    const eps = this.allEndpoints();
    if (eps.length === 0) return true;
    const variant = this.gs()?.variant ?? 'classic';
    if (variant === 'grid') {
      const placed = this.placedTiles();
      return eps.some(ep => {
        if (tile[0] === ep.matchValue) {
          if (this.validateGridNeighborPips(placed, ep.xConnect, ep.yConnect, tile[0], ep.xOuter, ep.yOuter) &&
              this.validateGridNeighborPips(placed, ep.xOuter, ep.yOuter, tile[1], ep.xConnect, ep.yConnect)) {
            return true;
          }
        }
        if (tile[1] === ep.matchValue) {
          if (this.validateGridNeighborPips(placed, ep.xConnect, ep.yConnect, tile[1], ep.xOuter, ep.yOuter) &&
              this.validateGridNeighborPips(placed, ep.xOuter, ep.yOuter, tile[0], ep.xConnect, ep.yConnect)) {
            return true;
          }
        }
        return false;
      });
    }
    return eps.some(ep => tile[0] === ep.matchValue || tile[1] === ep.matchValue);
  }

  isEndpointPlayable = (ep: PlayableEndpoint): boolean => {
    const tile = this.activeTile();
    if (!tile) return true;
    const variant = this.gs()?.variant ?? 'classic';
    if (variant === 'grid') {
      const placed = this.placedTiles();
      if (tile[0] === ep.matchValue) {
        if (this.validateGridNeighborPips(placed, ep.xConnect, ep.yConnect, tile[0], ep.xOuter, ep.yOuter) &&
            this.validateGridNeighborPips(placed, ep.xOuter, ep.yOuter, tile[1], ep.xConnect, ep.yConnect)) {
          return true;
        }
      }
      if (tile[1] === ep.matchValue) {
        if (this.validateGridNeighborPips(placed, ep.xConnect, ep.yConnect, tile[1], ep.xOuter, ep.yOuter) &&
            this.validateGridNeighborPips(placed, ep.xOuter, ep.yOuter, tile[0], ep.xConnect, ep.yConnect)) {
          return true;
        }
      }
      return false;
    }
    return tile[0] === ep.matchValue || tile[1] === ep.matchValue;
  };

  validateGridNeighborPips(placedTiles: PlacedTile[], x: number, y: number, val: number, ignoreX: number, ignoreY: number): boolean {
    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx === ignoreX && ny === ignoreY) continue;
      const nVal = getCellValue(placedTiles, nx, ny);
      if (nVal !== null && nVal !== val) {
        return false;
      }
    }
    return true;
  }

  selectTile(index: number) {
    if (!this.isMyTurn()) return;
    const tile = this.myHand()[index];
    if (!this.isTilePlayable(tile)) return;

    const eps = this.allEndpoints();
    if (eps.length === 0) {
      this.gameService.makeDominosMove(index, 'left');
      return;
    }

    if (this.selectedTileIndex() === index) {
      this.selectedTileIndex.set(null);
    } else {
      this.selectedTileIndex.set(index);
    }
  }

  onDragStart(event: DragEvent, index: number) {
    if (!this.isMyTurn()) {
      event.preventDefault();
      return;
    }
    const tile = this.myHand()[index];
    if (!this.isTilePlayable(tile)) {
      event.preventDefault();
      return;
    }
    this.draggedTileIndex.set(index);
    event.dataTransfer?.setData('text/plain', String(index));
    event.dataTransfer!.effectAllowed = 'move';
  }

  onDragEnd() {
    this.draggedTileIndex.set(null);
    this.activeDragOverEp.set(null);
  }

  onDragOver(event: DragEvent, ep: PlayableEndpoint) {
    if (this.isEndpointPlayable(ep)) {
      event.preventDefault();
      this.activeDragOverEp.set(ep);
    }
  }

  onDragLeave() {
    this.activeDragOverEp.set(null);
  }

  onDrop(event: DragEvent, ep: PlayableEndpoint) {
    event.preventDefault();
    const idx = this.draggedTileIndex();
    if (idx !== null && this.isEndpointPlayable(ep)) {
      this.playAtEndpoint(idx, ep);
    }
    this.draggedTileIndex.set(null);
    this.activeDragOverEp.set(null);
  }

  onEpClick(ep: PlayableEndpoint) {
    const idx = this.selectedTileIndex();
    if (idx !== null && this.isEndpointPlayable(ep)) {
      this.playAtEndpoint(idx, ep);
      this.selectedTileIndex.set(null);
    }
  }

  playAtEndpoint(tileIndex: number, ep: PlayableEndpoint) {
    const variant = this.gs()?.variant ?? 'classic';
    if (variant === 'classic') {
      const side = ep.xConnect < 0 ? 'left' : 'right';
      this.gameService.makeDominosMove(tileIndex, side);
    } else {
      this.gameService.makeDominosMove(tileIndex, null, {
        x1: ep.xConnect,
        y1: ep.yConnect,
        x2: ep.xOuter,
        y2: ep.yOuter
      });
    }
  }

  drawTile() {
    if (this.canDraw()) {
      this.gameService.drawDominosTile();
      this.selectedTileIndex.set(null);
    }
  }

  passTurn() {
    if (this.canPass()) {
      this.gameService.passDominosTurn();
      this.selectedTileIndex.set(null);
    }
  }
}

// Helpers for grid layout
function getCellValue(placedTiles: PlacedTile[], x: number, y: number): number | null {
  for (const pt of placedTiles) {
    if (pt.x1 === x && pt.y1 === y) return pt.tile[0];
    if (pt.x2 === x && pt.y2 === y) return pt.tile[1];
  }
  return null;
}

function isCellOccupied(placedTiles: PlacedTile[], x: number, y: number): boolean {
  return getCellValue(placedTiles, x, y) !== null;
}

function getPlayableEndpoints(state: DominosGameState): PlayableEndpoint[] {
  const { placedTiles, variant } = state;
  if (!placedTiles || placedTiles.length === 0) {
    return [];
  }

  const endpoints: PlayableEndpoint[] = [];

  if (variant === 'classic') {
    let minTile = placedTiles[0];
    let maxTile = placedTiles[0];
    for (const pt of placedTiles) {
      if (Math.min(pt.x1, pt.x2) < Math.min(minTile.x1, minTile.x2)) {
        minTile = pt;
      }
      if (Math.max(pt.x1, pt.x2) > Math.max(maxTile.x1, maxTile.x2)) {
        maxTile = pt;
      }
    }

    const leftX = minTile.x1 < minTile.x2 ? minTile.x1 : minTile.x2;
    const leftVal = minTile.x1 < minTile.x2 ? minTile.tile[0] : minTile.tile[1];
    endpoints.push({
      xConnect: leftX - 1,
      yConnect: 0,
      xOuter: leftX - 2,
      yOuter: 0,
      matchValue: leftVal
    });

    const rightX = maxTile.x1 > maxTile.x2 ? maxTile.x1 : maxTile.x2;
    const rightVal = maxTile.x1 > maxTile.x2 ? maxTile.tile[0] : maxTile.tile[1];
    endpoints.push({
      xConnect: rightX + 1,
      yConnect: 0,
      xOuter: rightX + 2,
      yOuter: 0,
      matchValue: rightVal
    });

  } else if (variant === 'branches') {
    const directions = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ];

    for (const pt of placedTiles) {
      const checkHalf = (hx: number, hy: number, val: number, px: number, py: number) => {
        const dx = hx - px;
        const dy = hy - py;

        if (pt.isDouble) {
          for (const [ndx, ndy] of directions) {
            const tx = hx + ndx;
            const ty = hy + ndy;
            if (!isCellOccupied(placedTiles, tx, ty)) {
              const ox = tx + ndx;
              const oy = ty + ndy;
              if (!isCellOccupied(placedTiles, ox, oy)) {
                endpoints.push({
                  xConnect: tx,
                  yConnect: ty,
                  xOuter: ox,
                  yOuter: oy,
                  matchValue: val
                });
              }
            }
          }
        } else {
          const tx = hx + dx;
          const ty = hy + dy;
          if (!isCellOccupied(placedTiles, tx, ty)) {
            const ox = tx + dx;
            const oy = ty + dy;
            if (!isCellOccupied(placedTiles, ox, oy)) {
              endpoints.push({
                xConnect: tx,
                yConnect: ty,
                xOuter: ox,
                yOuter: oy,
                matchValue: val
              });
            }
          }
        }
      };

      checkHalf(pt.x1, pt.y1, pt.tile[0], pt.x2, pt.y2);
      checkHalf(pt.x2, pt.y2, pt.tile[1], pt.x1, pt.y1);
    }
  } else if (variant === 'grid') {
    const directions = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ];
    const visited = new Set<string>();

    for (const pt of placedTiles) {
      const checkCoords = [[pt.x1, pt.y1, pt.tile[0]], [pt.x2, pt.y2, pt.tile[1]]];
      for (const [cx, cy, val] of checkCoords) {
        for (const [dx, dy] of directions) {
          const tx = cx + dx;
          const ty = cy + dy;
          const key = `${tx},${ty}`;
          if (!isCellOccupied(placedTiles, tx, ty) && !visited.has(key)) {
            visited.add(key);
            for (const [odx, ody] of directions) {
              const ox = tx + odx;
              const oy = ty + ody;
              if ((ox !== cx || oy !== cy) && !isCellOccupied(placedTiles, ox, oy)) {
                endpoints.push({
                  xConnect: tx,
                  yConnect: ty,
                  xOuter: ox,
                  yOuter: oy,
                  matchValue: val
                });
              }
            }
          }
        }
      }
    }
  }

  return endpoints;
}
