import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FutureDeclaration } from '../../../../core/models/FutureDeclaration';
import { VehicleView } from '../../../../core/models/VehicleView';
import { isSameDay } from '../../../../core/date-utils';

/**
 * Presentational list of upcoming scheduled declarations with a per-item cancel.
 * The dashboard owns the data (so the "Scheduled" badge count stays in sync) and
 * performs the actual cancel; this panel only renders and emits intent.
 */
@Component({
  selector: 'app-upcoming-declarations-panel',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './upcoming-declarations-panel.component.html',
  styleUrl: './upcoming-declarations-panel.component.scss',
})
export class UpcomingDeclarationsPanelComponent {
  @Input() declarations: FutureDeclaration[] = [];
  @Input() vehicles: VehicleView[] = [];
  @Input() busyId: string | null = null;
  @Output() cancel = new EventEmitter<string>();

  /** Friendly vehicle name for a transponder (matches the HOV status card). */
  vehicleName(transponderNumber: string): string {
    const match = this.vehicles.find((v) => v.transponderNumber === transponderNumber);
    return match?.friendlyName || 'Transponder';
  }

  /** Template helper: true when both ISO timestamps are the same calendar day. */
  readonly sameDay = isSameDay;
}
