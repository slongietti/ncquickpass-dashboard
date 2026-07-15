import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DeclarationView } from '../../../../core/models/DeclarationView';
import { VehicleView } from '../../../../core/models/VehicleView';
import { DateTimePickerDirective } from '../../../../core/date-time-picker.directive';

export interface ActivateRequest {
  transponderNumber: string;
  endDateTime?: string;
}

const ACTIVE_STATUSES = ['active', 'submitted'];

@Component({
  selector: 'app-hov-status',
  standalone: true,
  imports: [DatePipe, DateTimePickerDirective],
  templateUrl: './hov-status.component.html',
  styleUrl: './hov-status.component.scss',
})
export class HovStatusComponent implements OnInit, OnDestroy {
  @Input() vehicles: VehicleView[] = [];
  @Input() declarations: DeclarationView[] = [];
  @Input() busyTransponder: string | null = null;

  @Output() activate = new EventEmitter<ActivateRequest>();
  @Output() cancel = new EventEmitter<string>();

  /** Ticks every second to drive the "Pending" countdown. */
  private readonly now = signal(Date.now());
  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.timer = setInterval(() => this.now.set(Date.now()), 1000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Chosen custom end date/time per transponder (ISO string from the picker). */
  endInputs: Record<string, string> = {};

  /** Whether the collapsed "retained" (non-active) transponders are shown. */
  showRetained = false;

  get activeVehicles(): VehicleView[] {
    return this.vehicles.filter((v) => HovStatusComponent.isActiveTag(v));
  }

  get retainedVehicles(): VehicleView[] {
    return this.vehicles.filter((v) => !HovStatusComponent.isActiveTag(v));
  }

  toggleRetained(): void {
    this.showRetained = !this.showRetained;
  }

  private static isActiveTag(v: VehicleView): boolean {
    return (v.status || '').toUpperCase() === 'ACTIVE';
  }

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

  /** A declaration is pending until its startDateTime (the 15-min lead time). */
  isPending(decl: DeclarationView): boolean {
    if (!decl.startDateTime) return false;
    return new Date(decl.startDateTime).getTime() > this.now();
  }

  /** mm:ss remaining until the declaration goes active. */
  countdown(decl: DeclarationView): string {
    if (!decl.startDateTime) return '';
    const ms = new Date(decl.startDateTime).getTime() - this.now();
    if (ms <= 0) return '0:00';
    const totalSec = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  onSetEnd(transponderNumber: string): void {
    // The picker directive already emits an ISO-8601 string.
    const endDateTime = this.endInputs[transponderNumber] || undefined;
    this.activate.emit({ transponderNumber, endDateTime });
  }

  onCancel(declarationId: string): void {
    this.cancel.emit(declarationId);
  }
}
