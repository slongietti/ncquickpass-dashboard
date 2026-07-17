import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, signal } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { DeclarationView } from '../../../../core/models/DeclarationView';
import { VehicleView } from '../../../../core/models/VehicleView';
import { isSameDay } from '../../../../core/date-utils';
import { DateTimePickerDirective } from '../../../../core/date-time-picker.directive';

export interface ActivateRequest {
  transponderNumber: string;
  endDateTime?: string;
  /** ISO start; when present the declaration is scheduled to begin in the future. */
  startDateTime?: string;
}

const ACTIVE_STATUSES = ['active', 'submitted'];

@Component({
  selector: 'app-hov-status',
  standalone: true,
  imports: [DatePipe, NgTemplateOutlet, DateTimePickerDirective],
  templateUrl: './hov-status.component.html',
  styleUrl: './hov-status.component.scss',
})
export class HovStatusComponent implements OnInit, OnDestroy {
  @Input() vehicles: VehicleView[] = [];
  @Input() declarations: DeclarationView[] = [];
  @Input() busyTransponder: string | null = null;
  /** Count of upcoming scheduled declarations, shown as a badge on the button. */
  @Input() upcomingCount = 0;

  @Output() activate = new EventEmitter<ActivateRequest>();
  @Output() cancel = new EventEmitter<string>();
  @Output() openScheduled = new EventEmitter<void>();

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

  /** Optional future start date/time per transponder (ISO string from the picker).
   *  Blank/past → activate now; a future value → a scheduled declaration. */
  startInputs: Record<string, string> = {};

  /** Whether the add-declaration form is revealed for a transponder that already
   *  has active/pending declarations (via "Add another HOV declaration"). */
  showAdd: Record<string, boolean> = {};

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

  /** Active/submitted declarations for a transponder that are relevant *today*. */
  declarationsFor(transponderNumber: string): DeclarationView[] {
    return this.todaysDeclarations().filter((d) => d.transponderNumber === transponderNumber);
  }

  isActive(transponderNumber: string): boolean {
    return this.declarationsFor(transponderNumber).length > 0;
  }

  /**
   * Active declarations plus pending ones that start today. Future-day pending
   * declarations are intentionally excluded here — they live in the Upcoming
   * drawer — so the status card only reflects today's HOV state.
   */
  private todaysDeclarations(): DeclarationView[] {
    return this.declarations.filter(
      (d) =>
        ACTIVE_STATUSES.includes((d.status || '').toLowerCase()) && this.startsTodayOrActive(d),
    );
  }

  /** True for a declaration already active, or pending with a start later today. */
  private startsTodayOrActive(decl: DeclarationView): boolean {
    if (!this.isPending(decl) || !decl.startDateTime) return true;
    return isSameDay(decl.startDateTime, new Date(this.now()));
  }

  /** Card-head summary of the current HOV state across all vehicles. */
  get summary(): string {
    const active = this.todaysDeclarations();
    if (active.length === 0) return 'No active HOV declarations';
    const pending = active.filter((d) => this.isPending(d)).length;
    const live = active.length - pending;
    const parts: string[] = [];
    if (live > 0) parts.push(`${live} active`);
    if (pending > 0) parts.push(`${pending} pending`);
    return `${parts.join(' · ')} HOV declaration${active.length === 1 ? '' : 's'}`;
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
    // The picker directive already emits an ISO-8601 string. A start is optional:
    // the dashboard treats a future start as a scheduled declaration and a
    // blank/past start as "activate now".
    const endDateTime = this.endInputs[transponderNumber] || undefined;
    const startDateTime = this.startInputs[transponderNumber] || undefined;
    this.activate.emit({ transponderNumber, endDateTime, startDateTime });
    // Collapse the extra "add another" form back to the button after submitting.
    this.showAdd[transponderNumber] = false;
  }

  onCancel(declarationId: string): void {
    this.cancel.emit(declarationId);
  }
}
