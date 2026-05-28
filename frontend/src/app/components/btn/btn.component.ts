import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-btn',
  standalone: true,
  template: `
    <button 
      [class]="variant + '-btn'" 
      [disabled]="disabled"
      (click)="onClick($event)"
    >
      @if (icon) {
        <span class="material-symbols">{{ icon }}</span>
      }
      <ng-content></ng-content>
    </button>
  `,
  styles: [`
    /* Base styles matching styles.css custom buttons */
    button {
      border: none;
      font-family: 'Inter', sans-serif;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      letter-spacing: 0.1px;
      user-select: none;
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }
  `]
})
export class BtnComponent {
  @Input() variant: 'primary' | 'secondary' | 'outlined' | 'tonal' | 'icon' = 'primary';
  @Input() icon: string = '';
  @Input() disabled: boolean = false;
  @Output() btnClick = new EventEmitter<MouseEvent>();

  onClick(event: MouseEvent) {
    if (!this.disabled) {
      this.btnClick.emit(event);
    }
  }
}
