import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Trip } from '../../../../core/models/Trip';
import { TransactionView } from '../../../../core/models/TransactionView';
import { DisputeReason } from '../../../../core/models/DisputeReason';
import { DrawerComponent } from '../../../../shared/drawer/drawer.component';
import { SelectComponent, SelectOption } from '../../../../shared/select/select.component';
import { CreateDispute } from '../../../../core/services/toll-exceptions.service';

/**
 * Files a dispute for one grouped trip. The trip's tolls are checked by default;
 * the user deselects any to exclude, picks a reason, adds comments, and submits.
 * Open state is driven by whether a trip is loaded.
 */
@Component({
  selector: 'app-dispute-drawer',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, FormsModule, DrawerComponent, SelectComponent],
  templateUrl: './dispute-drawer.component.html',
  styleUrl: './dispute-drawer.component.scss',
})
export class DisputeDrawerComponent implements OnChanges {
  @Input() trip: Trip | null = null;
  @Input() reasons: DisputeReason[] = [];
  @Input() busy = false;
  @Output() submitDispute = new EventEmitter<CreateDispute>();
  @Output() close = new EventEmitter<void>();

  reasonId: number | null = null;
  comments = '';
  private readonly excluded = new Set<string>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['trip']) {
      this.excluded.clear();
      this.comments = '';
    }
    const first = this.reasons[0];
    if (this.reasonId === null && first) this.reasonId = first.reasonId;
  }

  get reasonOptions(): SelectOption[] {
    return this.reasons.map((reason) => ({ label: reason.label, value: reason.reasonId }));
  }

  /** The trip's tolls that carry a ledger id, i.e. can be disputed. */
  get disputableTransactions(): TransactionView[] {
    return this.trip?.transactions.filter((t) => !!t.detailTransactionID) ?? [];
  }

  isSelected(id: string): boolean {
    return !this.excluded.has(id);
  }

  toggle(id: string): void {
    if (this.excluded.has(id)) this.excluded.delete(id);
    else this.excluded.add(id);
  }

  get selectedIds(): string[] {
    return this.disputableTransactions
      .map((t) => t.detailTransactionID)
      .filter((id) => !this.excluded.has(id));
  }

  get canSubmit(): boolean {
    return (
      !this.busy &&
      this.reasonId !== null &&
      this.comments.trim().length > 0 &&
      this.selectedIds.length > 0
    );
  }

  submit(): void {
    if (!this.canSubmit || this.reasonId === null) return;
    this.submitDispute.emit({
      reasonId: this.reasonId,
      comments: this.comments.trim(),
      detailTransactionIds: this.selectedIds,
    });
  }
}
