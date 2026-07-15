import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  inject,
} from '@angular/core';

export interface SelectOption {
  label: string;
  value: number | string;
}

/**
 * Lightweight themed dropdown (button + popover), styled with the app tokens so
 * it matches the chips, buttons, and date picker. Closes on outside-click / Esc.
 */
@Component({
  selector: 'app-select',
  standalone: true,
  templateUrl: './select.component.html',
  styleUrl: './select.component.scss',
})
export class SelectComponent {
  @Input() options: SelectOption[] = [];
  @Input() value: number | string | null = null;
  @Input() disabled = false;
  @Output() valueChange = new EventEmitter<number | string>();

  open = false;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  get selectedLabel(): string {
    return this.options.find((o) => o.value === this.value)?.label ?? 'Select…';
  }

  toggle(): void {
    if (!this.disabled) this.open = !this.open;
  }

  choose(value: number | string): void {
    this.value = value;
    this.valueChange.emit(value);
    this.open = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open && !this.host.nativeElement.contains(event.target as Node)) {
      this.open = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open = false;
  }
}
