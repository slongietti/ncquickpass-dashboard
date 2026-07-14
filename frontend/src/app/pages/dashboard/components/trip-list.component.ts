import { Component, Input } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Trip } from '../../../core/models';

@Component({
  selector: 'app-trip-list',
  standalone: true,
  imports: [CurrencyPipe, DatePipe],
  templateUrl: './trip-list.component.html',
  styleUrl: './trip-list.component.scss',
})
export class TripListComponent {
  @Input() trips: Trip[] = [];

  private readonly expanded = new Set<number>();

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
