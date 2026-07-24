import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Trip } from '../../../../core/models/Trip';
import { isSameDay } from '../../../../core/date-utils';
import { SelectComponent, SelectOption } from '../../../../shared/select/select.component';

export interface RangeOption {
  label: string;
  days: number;
}

@Component({
  selector: 'app-trip-list',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, SelectComponent],
  templateUrl: './trip-list.component.html',
  styleUrl: './trip-list.component.scss',
})
export class TripListComponent {
  @Input() trips: Trip[] = [];
  @Input() days = 90;
  @Input() dayOptions: RangeOption[] = [];
  @Input() loading = false;
  @Output() daysChange = new EventEmitter<number>();
  /** Emits the trip whose tolls the user wants to dispute. */
  @Output() openDispute = new EventEmitter<Trip>();
  /** Emits the trip whose HOV violation the user wants to view. */
  @Output() openViolation = new EventEmitter<Trip>();

  /** Whether the list is in "pick a trip to dispute" mode. */
  picking = false;

  get rangeOptions(): SelectOption[] {
    return this.dayOptions.map((o) => ({ label: o.label, value: o.days }));
  }

  /** Selected road-group label to filter by, or 'all'. */
  selectedGroup = 'all';

  /** When on, only disputable trips are shown (independent of the road-group filter). */
  disputableOnly = false;

  /** When on, only trips with an HOV violation are shown. */
  violationOnly = false;

  /** Explains what the Disputable filter means (shown on hover). */
  readonly disputableHint =
    'Filters for tolls that occurred while an HOV declaration was made within this application, ' +
    'for a roadway that permits HOV declarations.';

  private readonly expanded = new Set<number>();

  /** Distinct road-group labels present in the current trips, for the filter chips. */
  get groupLabels(): string[] {
    return Array.from(new Set(this.trips.map((t) => t.roadGroupLabel)));
  }

  get hasDisputable(): boolean {
    return this.trips.some((t) => t.disputable);
  }

  get disputableCount(): number {
    return this.trips.filter((t) => t.disputable).length;
  }

  get hasViolation(): boolean {
    return this.trips.some((t) => t.violation);
  }

  get violationCount(): number {
    return this.trips.filter((t) => t.violation).length;
  }

  get visibleTrips(): Trip[] {
    return this.trips.filter(
      (t) =>
        (this.selectedGroup === 'all' || t.roadGroupLabel === this.selectedGroup) &&
        (!this.disputableOnly || t.disputable) &&
        (!this.violationOnly || t.violation),
    );
  }

  /** Total spend across the currently visible trips (respects range + group filter). */
  get visibleTotal(): number {
    return this.visibleTrips.reduce((sum, t) => sum + t.total, 0);
  }

  /** A $0 toll/trip (e.g. an HOV-declared trip) is shown as "No Cost". */
  isNoCost(amount: number | null | undefined): boolean {
    return !amount;
  }

  setFilter(group: string): void {
    this.selectedGroup = group;
    this.expanded.clear();
  }

  toggleDisputable(): void {
    this.disputableOnly = !this.disputableOnly;
    this.expanded.clear();
  }

  toggleViolation(): void {
    this.violationOnly = !this.violationOnly;
    this.expanded.clear();
  }

  /** Violation-chip shortcut: open the violation view for this trip. */
  startViolation(trip: Trip, event: Event): void {
    event.stopPropagation();
    this.openViolation.emit(trip);
  }

  togglePicking(): void {
    this.picking = !this.picking;
  }

  /** In picking mode, clicking a trip starts a dispute for it. */
  pick(trip: Trip): void {
    this.openDispute.emit(trip);
    this.picking = false;
  }

  /** Disputable-chip shortcut: dispute this trip without entering picking mode. */
  startDispute(trip: Trip, event: Event): void {
    event.stopPropagation();
    this.openDispute.emit(trip);
  }

  toggle(index: number): void {
    if (this.expanded.has(index)) {
      this.expanded.delete(index);
    } else {
      this.expanded.add(index);
    }
  }

  isExpanded(index: number): boolean {
    return this.expanded.has(index);
  }

  /** Same trip within a single day shows one time span; multi-day shows both dates. */
  spansSingleDay(trip: Trip): boolean {
    return isSameDay(trip.start, trip.end);
  }
}
