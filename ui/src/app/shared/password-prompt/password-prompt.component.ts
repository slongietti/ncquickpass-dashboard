import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

/**
 * Reusable modal that collects the NCQP password to authorize background
 * automation. The parent owns `busy`/`error` (so it can show a server-side
 * "password incorrect" message and keep the modal open); this component only
 * collects the value and emits confirm/cancel.
 */
@Component({
  selector: 'app-password-prompt',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './password-prompt.component.html',
  styleUrl: './password-prompt.component.scss',
})
export class PasswordPromptComponent implements OnChanges {
  @Input() open = false;
  @Input() busy = false;
  @Input() error: string | null = null;
  @Input() title = 'Confirm your password';
  @Input() confirmLabel = 'Confirm';

  @Output() confirm = new EventEmitter<string>();
  @Output() cancel = new EventEmitter<void>();

  password = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && !this.open) this.password = '';
  }

  submit(): void {
    if (!this.password || this.busy) return;
    this.confirm.emit(this.password);
  }

  onCancel(): void {
    this.password = '';
    this.cancel.emit();
  }
}
