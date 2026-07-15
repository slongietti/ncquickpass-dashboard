import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Trip } from '../../../../core/models/Trip';
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

  private readonly expanded = new Set<number>();

  get highways(): string[] {
    return Array.from(new Set(this.trips.map((t) => t.highway)));
  }

  get visibleTrips(): Trip[] {
    return this.selectedHighway === 'all'
      ? this.trips
      : this.trips.filter((t) => t.highway === this.selectedHighway);
  }

  setFilter(highway: string): void {
    this.selectedHighway = highway;
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
    return new Date(trip.start).toDateString() === new Date(trip.end).toDateString();
  }
}
