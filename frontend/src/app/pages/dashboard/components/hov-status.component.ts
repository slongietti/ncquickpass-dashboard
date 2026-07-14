import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DeclarationView, VehicleView } from '../../../core/models';

export interface ActivateRequest {
  transponderNumber: string;
  endDateTime?: string;
}

const ACTIVE_STATUSES = ['active', 'submitted'];

@Component({
  selector: 'app-hov-status',
  standalone: true,
  imports: [DatePipe, FormsModule],
  templateUrl: './hov-status.component.html',
  styleUrl: './hov-status.component.scss',
})
export class HovStatusComponent {
  @Input() vehicles: VehicleView[] = [];
  @Input() declarations: DeclarationView[] = [];
  @Input() busyTransponder: string | null = null;

  @Output() activate = new EventEmitter<ActivateRequest>();
  @Output() cancel = new EventEmitter<string>();

  /** Chosen custom end date/time per transponder (datetime-local value). */
  endInputs: Record<string, string> = {};

  declarationFor(transponderNumber: string): DeclarationView | null {
    return (
      this.declarations.find(
        (d) =>
          d.transponderNumber === transponderNumber &&
          ACTIVE_STATUSES.includes((d.status || '').toLowerCase()),
      ) ?? null
    );
  }

  isActive(transponderNumber: string): boolean {
    return this.declarationFor(transponderNumber) !== null;
  }

  onSetEnd(transponderNumber: string): void {
    const local = this.endInputs[transponderNumber];
    // datetime-local has no timezone; convert to a full ISO string.
    const endDateTime = local ? new Date(local).toISOString() : undefined;
    this.activate.emit({ transponderNumber, endDateTime });
  }

  onCancel(declarationId: string): void {
    this.cancel.emit(declarationId);
  }
}
