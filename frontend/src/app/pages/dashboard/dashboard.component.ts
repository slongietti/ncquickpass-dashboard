import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../core/auth.service';
import { HovService } from '../../core/hov.service';
import { TransactionService } from '../../core/transaction.service';
import { DeclarationView, TransactionView, VehicleView } from '../../core/models';
import { groupIntoTrips } from '../../core/trip-grouping';
import { ActivateRequest, HovStatusComponent } from './components/hov-status.component';
import { TripListComponent } from './components/trip-list.component';

const DAY_OPTIONS = [30, 90, 180];

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [FormsModule, HovStatusComponent, TripListComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly hov = inject(HovService);
  private readonly transactionSvc = inject(TransactionService);
  private readonly router = inject(Router);

  readonly dayOptions = DAY_OPTIONS;
  readonly accountId = this.auth.accountId;

  readonly vehicles = signal<VehicleView[]>([]);
  readonly declarations = signal<DeclarationView[]>([]);
  readonly transactions = signal<TransactionView[]>([]);
  readonly trips = computed(() => groupIntoTrips(this.transactions()));

  readonly days = signal(90);
  readonly loading = signal(true);
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
    }).subscribe({
      next: (res) => {
        this.vehicles.set(res.vehicles);
        this.declarations.set(res.declarations);
        this.transactions.set(res.transactions);
        this.loading.set(false);
      },
      error: (err) => this.handleError(err, 'Failed to load your dashboard.'),
    });
  }

  changeDays(days: number): void {
    this.days.set(days);
    this.loading.set(true);
    this.transactionSvc.getTransactions(days).subscribe({
      next: (txns) => {
        this.transactions.set(txns);
        this.loading.set(false);
      },
      error: (err) => this.handleError(err, 'Failed to load transactions.'),
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
