import { Component, Input } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { TransactionView } from '../../../../core/models';

@Component({
  selector: 'app-account-summary',
  standalone: true,
  imports: [CurrencyPipe, DatePipe],
  templateUrl: './account-summary.component.html',
  styleUrl: './account-summary.component.scss',
})
export class AccountSummaryComponent {
  @Input() balance: number | null = null;
  @Input() replenishments: TransactionView[] = [];
}
