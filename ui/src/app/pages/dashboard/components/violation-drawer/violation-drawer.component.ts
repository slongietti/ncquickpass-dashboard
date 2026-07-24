import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Trip } from '../../../../core/models/Trip';
import { TransactionView } from '../../../../core/models/TransactionView';
import { DrawerComponent } from '../../../../shared/drawer/drawer.component';

/** Read-only view of a trip's HOV occupancy violation(s). Open when a trip is set. */
@Component({
  selector: 'app-violation-drawer',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, DrawerComponent],
  templateUrl: './violation-drawer.component.html',
  styleUrl: './violation-drawer.component.scss',
})
export class ViolationDrawerComponent {
  @Input() trip: Trip | null = null;
  @Output() close = new EventEmitter<void>();

  get violations(): TransactionView[] {
    return this.trip?.transactions.filter((t) => t.hovViolation) ?? [];
  }

  /** Distinct non-empty agency comments across the violating tolls. */
  get comments(): string[] {
    const seen = new Set<string>();
    for (const violation of this.violations) {
      const comment = violation.violationComments?.trim();
      if (comment) seen.add(comment);
    }
    return Array.from(seen);
  }
}
