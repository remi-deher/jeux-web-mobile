import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-battleship-grid',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="board-mesh cyber-grid" [class.red-radar]="theme === 'red'" [class.disabled]="disabled">
      <div class="sonar-sweep"></div>
      @for (row of [0,1,2,3,4,5,6,7,8,9]; track row) {
        @for (col of [0,1,2,3,4,5,6,7,8,9]; track col) {
          <div 
            class="cell" 
            [class.target-cell]="mode === 'radar'"
            [class.ship]="mode === 'fleet' && board[row][col] === 'ship'"
            [class.hit]="board[row][col] === 'hit'"
            [class.miss]="board[row][col] === 'miss'"
            [class.preview-active]="mode === 'fleet' && isInPreview(row, col)"
            [class.preview-invalid]="mode === 'fleet' && isInPreview(row, col) && !previewValid"
            [ngClass]="mode === 'fleet' ? getShipSegmentClass(row, col) : ''"
            (mouseenter)="onCellMouseEnter(row, col)"
            (click)="onCellClick(row, col)"
          >
            @if (board[row][col] === 'hit') { 
              <span class="hit-indicator material-symbols" [class.target-hit]="mode === 'radar'" style="color: #ef4444;">explosion</span> 
            }
            @if (board[row][col] === 'miss') { 
              <span class="miss-indicator material-symbols" [class.target-miss]="mode === 'radar'" style="color: #60a5fa;">water_drop</span> 
            }
          </div>
        }
      }
    </div>
  `,
  styles: [`
    /* Base Grid Styles */
    .board-mesh {
      display: grid;
      grid-template-columns: repeat(10, min(36px, 6.8vw));
      grid-template-rows: repeat(10, min(36px, 6.8vw));
      gap: 3px;
      padding: 10px;
      background: rgba(10, 15, 30, 0.85);
      border: 3px solid var(--board-border-color, #1e3a8a);
      border-radius: var(--md-radius-lg);
      position: relative;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    }

    .red-radar {
      --board-border-color: #7f1d1d;
    }

    .board-mesh.disabled {
      cursor: not-allowed;
      opacity: 0.85;
      pointer-events: none;
    }

    .cell {
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: min(16px, 3.5vw);
      cursor: pointer;
      position: relative;
      transition: all 0.15s;
    }

    .cell:hover {
      background: rgba(255, 255, 255, 0.1);
      transform: scale(1.05);
      z-index: 2;
    }

    /* Ship / Radar Colors */
    .ship {
      background: rgba(59, 130, 246, 0.2);
      border-color: #3b82f6;
    }

    .hit {
      background: rgba(239, 68, 68, 0.2) !important;
      border-color: #ef4444 !important;
    }

    .miss {
      background: rgba(148, 163, 184, 0.15) !important;
      border-color: rgba(148, 163, 184, 0.3) !important;
    }

    /* Sonar Animation */
    .sonar-sweep {
      position: absolute;
      width: 100%;
      height: 100%;
      background: linear-gradient(to bottom, rgba(59, 130, 246, 0) 0%, rgba(59, 130, 246, 0.03) 70%, rgba(59, 130, 246, 0.12) 100%);
      top: -100%;
      left: 0;
      pointer-events: none;
      animation: sonar 4s infinite linear;
    }

    .red-radar .sonar-sweep {
      background: linear-gradient(to bottom, rgba(239, 68, 68, 0) 0%, rgba(239, 68, 68, 0.03) 70%, rgba(239, 68, 68, 0.12) 100%);
    }

    @keyframes sonar {
      0% { top: -100%; }
      100% { top: 100%; }
    }
  `]
})
export class BattleshipGridComponent {
  @Input({ required: true }) board: string[][] = [];
  @Input() mode: 'fleet' | 'radar' = 'fleet';
  @Input() theme: 'blue' | 'red' = 'blue';
  @Input() disabled: boolean = false;
  
  // Placement details
  @Input() previewCells: { r: number; c: number }[] = [];
  @Input() previewValid: boolean = true;
  @Input() myShips: any[] = [];
  @Input() isHorizontal: boolean = true;

  @Output() cellClick = new EventEmitter<{ r: number; c: number }>();
  @Output() cellMouseEnter = new EventEmitter<{ r: number; c: number }>();

  isInPreview(row: number, col: number): boolean {
    return this.previewCells.some(cell => cell.r === row && cell.c === col);
  }

  onCellClick(r: number, c: number) {
    this.cellClick.emit({ r, c });
  }

  onCellMouseEnter(r: number, c: number) {
    this.cellMouseEnter.emit({ r, c });
  }

  getShipSegmentClass(r: number, c: number): string {
    const classes: string[] = [];

    // 1. Check actual placed ships
    for (const ship of this.myShips) {
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
    
    // 2. Check preview cells
    const idx = this.previewCells.findIndex(cell => cell.r === r && cell.c === c);
    if (idx !== -1) {
      const isStart = idx === 0;
      const isEnd = idx === this.previewCells.length - 1;
      let segment = 'body';
      if (isStart) segment = 'bow';
      else if (isEnd) segment = 'stern';
      const dir = this.isHorizontal ? 'h' : 'v';
      classes.push('preview-part');
      classes.push(`preview-${segment}-${dir}`);
    }

    return classes.join(' ');
  }
}
