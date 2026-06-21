import * as Phaser from 'phaser';

export interface MemoryCard {
  id: number;
  pairId: number;
  faceUp: boolean;
  matched: boolean;
}

export interface MemoryState {
  cards: MemoryCard[];
  cols: number;
  rows: number;
  currentPlayer: 1 | 2;
  scores: [number, number];
  flippedIds: number[];
  isResolving: boolean;
  totalPairs: number;
  matchedPairs: number;
  winner: number | null;
  playerIds: [string, string];
}

export interface MemorySceneSnapshot {
  state: MemoryState | null;
  canFlip: boolean;
  player1Name: string;
  player2Name: string;
  statusText: string;
}

interface MemoryCardView {
  container: Phaser.GameObjects.Container;
  plate: Phaser.GameObjects.Rectangle;
  symbol: Phaser.GameObjects.Text;
  lastFaceUp: boolean;
  lastMatched: boolean;
}

interface PlayerHudView {
  container: Phaser.GameObjects.Container;
  plate: Phaser.GameObjects.Rectangle;
  name: Phaser.GameObjects.Text;
  score: Phaser.GameObjects.Text;
}

const PAIR_ICONS = [
  String.fromCodePoint(0x1f98a),
  String.fromCodePoint(0x1f433),
  String.fromCodePoint(0x1f335),
  String.fromCodePoint(0x1f355),
  String.fromCodePoint(0x1f3b8),
  String.fromCodePoint(0x1f680),
  String.fromCodePoint(0x1f98b),
  String.fromCodePoint(0x1f308),
];

const PAIR_COLORS = [
  0xffc857,
  0x64d2ff,
  0x7bed9f,
  0xff6b6b,
  0xc77dff,
  0x70e000,
  0xff9f1c,
  0x4dabf7,
];

const PLAYER_COLORS = [0x7c4dff, 0x00bcd4] as const;

export class MemoryPhaserScene extends Phaser.Scene {
  private cards = new Map<number, MemoryCardView>();
  private boardBg?: Phaser.GameObjects.Rectangle;
  private emptyText?: Phaser.GameObjects.Text;
  private p1Hud?: PlayerHudView;
  private p2Hud?: PlayerHudView;
  private pairsText?: Phaser.GameObjects.Text;
  private statusPill?: Phaser.GameObjects.Rectangle;
  private statusText?: Phaser.GameObjects.Text;
  private currentSnapshot: MemorySceneSnapshot = {
    state: null,
    canFlip: false,
    player1Name: '',
    player2Name: '',
    statusText: 'En attente de la partie...',
  };
  private sceneReady = false;

  constructor(private readonly onFlip: (cardId: number) => void) {
    super({ key: 'MemoryPhaserScene' });
  }

  create(): void {
    this.sceneReady = true;
    this.cameras.main.setBackgroundColor('#0b1020');
    this.render(this.currentSnapshot);
  }

  render(snapshot: MemorySceneSnapshot): void {
    this.currentSnapshot = snapshot;

    if (!this.sceneReady) return;

    if (!snapshot.state) {
      this.clearCards();
      this.destroyHud();
      this.boardBg?.destroy();
      this.boardBg = undefined;
      this.emptyText ??= this.add.text(0, 0, snapshot.statusText, {
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
      }).setOrigin(0.5);
      this.emptyText.setText(snapshot.statusText);
      this.emptyText.setPosition(this.scale.width / 2, this.scale.height / 2);
      return;
    }

    this.emptyText?.destroy();
    this.emptyText = undefined;
    this.layout(snapshot);
  }

  refreshSize(): void {
    if (!this.sceneReady) return;
    this.render(this.currentSnapshot);
  }

  private layout(snapshot: MemorySceneSnapshot): void {
    const state = snapshot.state;
    if (!state) return;

    const width = Math.max(this.scale.width, 320);
    const height = Math.max(this.scale.height, 360);
    const margin = Math.max(10, Math.min(18, width * 0.025));
    const hudHeight = width < 520 ? 74 : 78;
    const statusHeight = 34;
    const hudTop = margin;
    const statusY = hudTop + hudHeight + statusHeight / 2 + 8;
    const boardTop = statusY + statusHeight / 2 + 14;
    const boardAvailableHeight = height - boardTop - margin;
    const cols = state.cols;
    const rows = state.rows;
    const gap = Math.max(8, Math.min(14, width * 0.022));
    const boardSize = Math.min(width - margin * 2, boardAvailableHeight);
    const cardSize = Math.floor((boardSize - gap * (cols - 1)) / cols);
    const totalW = cardSize * cols + gap * (cols - 1);
    const totalH = cardSize * rows + gap * (rows - 1);
    const startX = (width - totalW) / 2 + cardSize / 2;
    const startY = boardTop + Math.max(0, (boardAvailableHeight - totalH) / 2) + cardSize / 2;

    this.layoutHud(snapshot, margin, hudTop, hudHeight, statusY, width);

    this.boardBg ??= this.add.rectangle(0, 0, 1, 1, 0x111827, 0.78)
      .setStrokeStyle(1, 0xffffff, 0.08);
    this.boardBg
      .setPosition(width / 2, startY + totalH / 2 - cardSize / 2)
      .setDisplaySize(totalW + 22, totalH + 22)
      .setDepth(-1);

    const visibleIds = new Set(state.cards.map(card => card.id));
    this.cards.forEach((view, id) => {
      if (!visibleIds.has(id)) {
        view.container.destroy();
        this.cards.delete(id);
      }
    });

    for (const card of state.cards) {
      const col = card.id % cols;
      const row = Math.floor(card.id / cols);
      const x = startX + col * (cardSize + gap);
      const y = startY + row * (cardSize + gap);
      this.syncCard(card, x, y, cardSize, snapshot.canFlip);
    }
  }

  private layoutHud(
    snapshot: MemorySceneSnapshot,
    margin: number,
    hudTop: number,
    hudHeight: number,
    statusY: number,
    width: number,
  ): void {
    const state = snapshot.state;
    if (!state) return;

    const gutter = width < 520 ? 8 : 12;
    const sideWidth = Math.max(118, Math.floor((width - margin * 2 - gutter * 2 - 112) / 2));
    const centerWidth = width - margin * 2 - gutter * 2 - sideWidth * 2;
    const leftX = margin + sideWidth / 2;
    const centerX = width / 2;
    const rightX = width - margin - sideWidth / 2;
    const hudY = hudTop + hudHeight / 2;

    this.p1Hud ??= this.createPlayerHud(PLAYER_COLORS[0]);
    this.p2Hud ??= this.createPlayerHud(PLAYER_COLORS[1]);
    this.pairsText ??= this.add.text(0, 0, '', {
      align: 'center',
      color: '#e5e7eb',
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      fontStyle: '700',
    }).setOrigin(0.5);
    this.statusPill ??= this.add.rectangle(0, 0, 1, 1, 0x0f172a, 0.86)
      .setStrokeStyle(1, 0xffffff, 0.1);
    this.statusText ??= this.add.text(0, 0, '', {
      align: 'center',
      color: '#f8fafc',
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      fontStyle: '700',
    }).setOrigin(0.5);

    this.updatePlayerHud(
      this.p1Hud,
      leftX,
      hudY,
      sideWidth,
      hudHeight,
      snapshot.player1Name,
      state.scores[0],
      state.currentPlayer === 1 && state.winner === null,
      PLAYER_COLORS[0],
    );
    this.updatePlayerHud(
      this.p2Hud,
      rightX,
      hudY,
      sideWidth,
      hudHeight,
      snapshot.player2Name,
      state.scores[1],
      state.currentPlayer === 2 && state.winner === null,
      PLAYER_COLORS[1],
    );

    const remaining = state.totalPairs - state.matchedPairs;
    this.pairsText
      .setText(`${remaining}\nrestantes`)
      .setFontSize(width < 520 ? 12 : 14)
      .setPosition(centerX, hudY);

    this.statusPill
      .setPosition(centerX, statusY)
      .setDisplaySize(Math.min(width - margin * 2, 430), 34);
    this.statusText
      .setText(this.truncate(snapshot.statusText, width < 520 ? 34 : 48))
      .setFontSize(width < 520 ? 13 : 14)
      .setPosition(centerX, statusY);

    this.pairsText.setWordWrapWidth(centerWidth);
  }

  private createPlayerHud(color: number): PlayerHudView {
    const plate = this.add.rectangle(0, 0, 1, 1, 0x111827, 0.82)
      .setStrokeStyle(2, color, 0.3);
    const name = this.add.text(0, 0, '', {
      color: '#cbd5e1',
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      fontStyle: '700',
    }).setOrigin(0.5);
    const score = this.add.text(0, 0, '', {
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      fontStyle: '700',
    }).setOrigin(0.5);
    const container = this.add.container(0, 0, [plate, name, score]);
    return { container, plate, name, score };
  }

  private updatePlayerHud(
    hud: PlayerHudView,
    x: number,
    y: number,
    width: number,
    height: number,
    playerName: string,
    score: number,
    active: boolean,
    color: number,
  ): void {
    hud.container.setPosition(x, y);
    hud.container.setScale(active ? 1.04 : 1);
    hud.plate
      .setDisplaySize(width, height)
      .setFillStyle(active ? 0x18213a : 0x111827, active ? 0.96 : 0.76)
      .setStrokeStyle(2, color, active ? 0.95 : 0.28);
    hud.name
      .setText(this.truncate(playerName || 'Joueur', width < 140 ? 10 : 16))
      .setPosition(0, -height * 0.2);
    hud.score
      .setText(`${score} paire${score > 1 ? 's' : ''}`)
      .setFontSize(width < 140 ? 15 : 18)
      .setPosition(0, height * 0.18);
  }

  private syncCard(card: MemoryCard, x: number, y: number, size: number, canFlip: boolean): void {
    const faceUp = card.faceUp || card.matched;
    let view = this.cards.get(card.id);

    if (!view) {
      const plate = this.add.rectangle(0, 0, size, size, 0x334155)
        .setStrokeStyle(2, 0xffffff, 0.12);
      const symbol = this.add.text(0, 0, '?', {
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        fontSize: `${Math.floor(size * 0.34)}px`,
        fontStyle: '700',
      }).setOrigin(0.5);
      const container = this.add.container(x, y, [plate, symbol]);
      view = { container, plate, symbol, lastFaceUp: faceUp, lastMatched: card.matched };
      this.cards.set(card.id, view);
      this.applyFace(view, card, faceUp, size);
    }

    view.container.setPosition(x, y);
    view.plate.setDisplaySize(size, size);
    view.symbol.setFontSize(Math.max(22, Math.floor(size * (faceUp ? 0.42 : 0.32))));

    const isPlayable = canFlip && !card.faceUp && !card.matched;
    view.container.off('pointerdown');
    view.container.removeInteractive();
    if (isPlayable) {
      view.container.setInteractive(
        new Phaser.Geom.Rectangle(-size / 2, -size / 2, size, size),
        Phaser.Geom.Rectangle.Contains,
      );
      view.container.once('pointerdown', () => this.onFlip(card.id));
    }

    if (view.lastFaceUp !== faceUp) {
      this.tweens.add({
        targets: view.container,
        scaleX: 0.04,
        duration: 110,
        ease: 'Sine.easeIn',
        onComplete: () => {
          this.applyFace(view, card, faceUp, size);
          this.tweens.add({
            targets: view.container,
            scaleX: 1,
            duration: 150,
            ease: 'Back.easeOut',
          });
        },
      });
    } else {
      this.applyFace(view, card, faceUp, size);
    }

    if (!view.lastMatched && card.matched) {
      this.tweens.add({
        targets: view.container,
        scale: 1.08,
        yoyo: true,
        duration: 130,
        repeat: 1,
        ease: 'Sine.easeOut',
      });
      this.spawnMatchBurst(x, y, PAIR_COLORS[card.pairId % PAIR_COLORS.length]);
    }

    view.lastFaceUp = faceUp;
    view.lastMatched = card.matched;
    view.container.setAlpha(card.matched ? 0.84 : isPlayable || faceUp ? 1 : 0.72);
  }

  private applyFace(view: MemoryCardView, card: MemoryCard, faceUp: boolean, size: number): void {
    if (faceUp) {
      const color = PAIR_COLORS[card.pairId % PAIR_COLORS.length];
      view.plate.setFillStyle(card.matched ? 0x123524 : 0xf8fafc, card.matched ? 0.94 : 1);
      view.plate.setStrokeStyle(2, card.matched ? 0x7bed9f : color, card.matched ? 0.9 : 0.55);
      view.symbol
        .setText(PAIR_ICONS[card.pairId % PAIR_ICONS.length])
        .setColor('#111827')
        .setFontSize(Math.max(24, Math.floor(size * 0.44)));
      return;
    }

    view.plate.setFillStyle(0x2937a3, 1);
    view.plate.setStrokeStyle(2, 0xa5b4fc, 0.32);
    view.symbol
      .setText('?')
      .setColor('rgba(255,255,255,0.72)')
      .setFontSize(Math.max(22, Math.floor(size * 0.34)));
  }

  private spawnMatchBurst(x: number, y: number, color: number): void {
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const dot = this.add.circle(x, y, 3, color, 0.95);
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * 34,
        y: y + Math.sin(angle) * 34,
        alpha: 0,
        scale: 0.4,
        duration: 360,
        ease: 'Sine.easeOut',
        onComplete: () => dot.destroy(),
      });
    }
  }

  private clearCards(): void {
    this.cards.forEach(view => view.container.destroy());
    this.cards.clear();
  }

  private destroyHud(): void {
    this.p1Hud?.container.destroy();
    this.p2Hud?.container.destroy();
    this.pairsText?.destroy();
    this.statusPill?.destroy();
    this.statusText?.destroy();
    this.p1Hud = undefined;
    this.p2Hud = undefined;
    this.pairsText = undefined;
    this.statusPill = undefined;
    this.statusText = undefined;
  }

  private truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;
    return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
  }
}
