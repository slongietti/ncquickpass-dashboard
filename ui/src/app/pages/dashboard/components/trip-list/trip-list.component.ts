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

  get rangeOptions(): SelectOption[] {
    return this.dayOptions.map((o) => ({ label: o.label, value: o.days }));
  }

  selectedHighway = 'all';

  /** When on, only disputable trips are shown (independent of the highway filter). */
  disputableOnly = false;

  /** Explains what the Disputable filter means (shown on hover). */
  readonly disputableHint =
    'Filters for tolls that occurred while an HOV declaration was made within this application, ' +
    'for a roadway that permits HOV declarations.';

  private readonly expanded = new Set<number>();

  get highways(): string[] {
    return Array.from(new Set(this.trips.map((t) => t.highway)));
  }

  get hasDisputable(): boolean {
    return this.trips.some((t) => t.disputable);
  }

  get disputableCount(): number {
    return this.trips.filter((t) => t.disputable).length;
  }

  get visibleTrips(): Trip[] {
    return this.trips.filter(
      (t) =>
        (this.selectedHighway === 'all' || t.highway === this.selectedHighway) &&
        (!this.disputableOnly || t.disputable),
    );
  }

  /** Total spend across the currently visible trips (respects range + highway filter). */
  get visibleTotal(): number {
    return this.visibleTrips.reduce((sum, t) => sum + t.total, 0);
  }

  /** A $0 toll/trip (e.g. an HOV-declared I-77 trip) is shown as "No Cost". */
  isNoCost(amount: number | null | undefined): boolean {
    return !amount;
  }

  setFilter(highway: string): void {
    this.selectedHighway = highway;
    this.expanded.clear();
  }

  toggleDisputable(): void {
    this.disputableOnly = !this.disputableOnly;
    this.expanded.clear();
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
