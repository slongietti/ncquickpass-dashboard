import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { HovService } from '../../core/services/hov.service';
import { TransactionService } from '../../core/services/transaction.service';
import { AccountService } from '../../core/services/account.service';
import { AccountSummary, DeclarationView, TransactionView, VehicleView } from '../../core/models';
import { groupIntoTrips, replenishments } from '../../core/trip-grouping';
import { ActivateRequest, HovStatusComponent } from './components/hov-status/hov-status.component';
import { TripListComponent } from './components/trip-list/trip-list.component';
import { AccountSummaryComponent } from './components/account-summary/account-summary.component';

export interface RangeOption {
  label: string;
  days: number;
}

// "Forever" is modeled as ~10 years, which predates the I-77 Express Lanes.
const DAY_OPTIONS: RangeOption[] = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 60 days', days: 60 },
  { label: 'Last 90 days', days: 90 },
  { label: 'Last 180 days', days: 180 },
  { label: 'Last 365 days', days: 365 },
  { label: 'Forever', days: 3650 },
];

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [HovStatusComponent, TripListComponent, AccountSummaryComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly hov = inject(HovService);
  private readonly transactionSvc = inject(TransactionService);
  private readonly accountSvc = inject(AccountService);
  private readonly router = inject(Router);

  readonly dayOptions = DAY_OPTIONS;
  readonly accountId = this.auth.accountId;

  readonly vehicles = signal<VehicleView[]>([]);
  readonly declarations = signal<DeclarationView[]>([]);
  readonly transactions = signal<TransactionView[]>([]);
  readonly account = signal<AccountSummary | null>(null);
  readonly trips = computed(() => groupIntoTrips(this.transactions()));
  readonly replenishments = computed(() => replenishments(this.transactions()));

  readonly days = signal(90);
  readonly loading = signal(true);
  readonly txLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly busyTransponder = signal<string | null>(null);
  readonly actionMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      vehicles: this.hov.getVehicles(),
      declarations: this.hov.getStatus(),
      transactions: this.transactionSvc.getTransactions(this.days()),
      account: this.accountSvc.getSummary(),
    }).subscribe({
      next: (res) => {
        this.vehicles.set(res.vehicles);
        this.declarations.set(res.declarations);
        this.transactions.set(res.transactions);
        this.account.set(res.account);
        this.loading.set(false);
      },
      error: (err) => this.handleError(err, 'Failed to load your dashboard.'),
    });
  }

  changeDays(days: number): void {
    this.days.set(days);
    this.txLoading.set(true);
    this.transactionSvc.getTransactions(days).subscribe({
      next: (txns) => {
        this.transactions.set(txns);
        this.txLoading.set(false);
      },
      error: (err) => {
        this.txLoading.set(false);
        this.handleError(err, 'Failed to load transactions.');
      },
    });
  }

  onActivate(req: ActivateRequest): void {
    this.busyTransponder.set(req.transponderNumber);
    this.actionMessage.set(null);
    this.hov.activate(req.transponderNumber, req.endDateTime).subscribe({
      next: () => this.afterHovChange('HOV declaration set.'),
      error: (err) => this.handleActionError(err, 'Failed to set HOV declaration.'),
    });
  }

  onCancel(declarationId: string): void {
    const decl = this.declarations().find((d) => d.declarationId === declarationId);
    this.busyTransponder.set(decl?.transponderNumber ?? null);
    this.actionMessage.set(null);
    this.hov.cancel(declarationId).subscribe({
      next: () => this.afterHovChange('HOV declaration canceled.'),
      error: (err) => this.handleActionError(err, 'Failed to cancel HOV declaration.'),
    });
  }

  logout(): void {
    this.auth.logout().subscribe({
      next: () => void this.router.navigate(['/login']),
      error: () => void this.router.navigate(['/login']),
    });
  }

  private afterHovChange(message: string): void {
    this.actionMessage.set(message);
    this.hov.getStatus().subscribe({
      next: (declarations) => {
        this.declarations.set(declarations);
        this.busyTransponder.set(null);
      },
      error: () => this.busyTransponder.set(null),
    });
  }

  private handleActionError(err: HttpErrorResponse, message: string): void {
    this.busyTransponder.set(null);
    if (this.redirectIfUnauthorized(err)) return;
    this.actionMessage.set(message);
  }

  private handleError(err: HttpErrorResponse, message: string): void {
    this.loading.set(false);
    if (this.redirectIfUnauthorized(err)) return;
    this.error.set(message);
  }

  private redirectIfUnauthorized(err: HttpErrorResponse): boolean {
    if (err.status === 401) {
      void this.router.navigate(['/login']);
      return true;
    }
    return false;
  }
}
