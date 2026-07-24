import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { HovService } from '../../core/services/hov.service';
import { TransactionService } from '../../core/services/transaction.service';
import { AccountService } from '../../core/services/account.service';
import { RoadGroupService } from '../../core/services/road-group.service';
import { CreateDispute, TollExceptionsService } from '../../core/services/toll-exceptions.service';
import { AccountSummary } from '../../core/models/AccountSummary';
import { DeclarationView } from '../../core/models/DeclarationView';
import { Dispute } from '../../core/models/Dispute';
import { DisputeReason } from '../../core/models/DisputeReason';
import { RoadGroup } from '../../core/models/RoadGroup';
import { TransactionView } from '../../core/models/TransactionView';
import { Trip } from '../../core/models/Trip';
import { VehicleView } from '../../core/models/VehicleView';
import { groupIntoTrips, replenishments } from '../../core/trip-grouping';
import { endOfDay } from '../../core/date-utils';
import { FutureDeclaration } from '../../core/models/FutureDeclaration';
import { ActivateRequest, HovStatusComponent } from './components/hov-status/hov-status.component';
import { TripListComponent } from './components/trip-list/trip-list.component';
import { AccountSummaryComponent } from './components/account-summary/account-summary.component';
import { ScheduledDrawerComponent } from './components/scheduled-drawer/scheduled-drawer.component';
import { TollExceptionsComponent } from './components/toll-exceptions/toll-exceptions.component';
import { DisputeDrawerComponent } from './components/dispute-drawer/dispute-drawer.component';
import { NcqpLogoComponent } from '../../shared/ncqp-logo/ncqp-logo.component';

export interface RangeOption {
  label: string;
  days: number;
}

// "Forever" is modeled as ~10 years, comfortably before any toll history.
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
  imports: [
    HovStatusComponent,
    TripListComponent,
    AccountSummaryComponent,
    ScheduledDrawerComponent,
    TollExceptionsComponent,
    DisputeDrawerComponent,
    NcqpLogoComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly hov = inject(HovService);
  private readonly transactionSvc = inject(TransactionService);
  private readonly accountSvc = inject(AccountService);
  private readonly roadGroupSvc = inject(RoadGroupService);
  private readonly tollExceptionsSvc = inject(TollExceptionsService);
  private readonly router = inject(Router);

  /** Auto-dismiss timer for the action toast. */
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly TOAST_MS = 5000;

  readonly dayOptions = DAY_OPTIONS;
  readonly accountId = this.auth.accountId;

  readonly vehicles = signal<VehicleView[]>([]);
  readonly declarations = signal<DeclarationView[]>([]);
  readonly transactions = signal<TransactionView[]>([]);
  readonly roadGroups = signal<RoadGroup[]>([]);
  readonly account = signal<AccountSummary | null>(null);
  private readonly roadGroupLabels = computed(
    () => new Map(this.roadGroups().map((g) => [g.id, g.label])),
  );
  readonly trips = computed(() => groupIntoTrips(this.transactions(), this.roadGroupLabels()));
  readonly replenishments = computed(() => replenishments(this.transactions()));

  readonly disputes = signal<Dispute[]>([]);
  readonly reasons = signal<DisputeReason[]>([]);
  readonly violations = computed(() => this.transactions().filter((t) => t.hovViolation));
  readonly disputeTrip = signal<Trip | null>(null);
  readonly disputeBusy = signal(false);

  readonly days = signal(90);
  readonly loading = signal(true);
  readonly txLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly busyTransponder = signal<string | null>(null);
  readonly actionMessage = signal<string | null>(null);
  readonly scheduledDrawerOpen = signal(false);
  readonly futureDeclarations = signal<FutureDeclaration[]>([]);
  readonly futureCount = computed(() => this.futureDeclarations().length);
  readonly futureBusyId = signal<string | null>(null);
  readonly conflict = signal<{ req: ActivateRequest; declarations: FutureDeclaration[] } | null>(
    null,
  );

  ngOnInit(): void {
    this.loadAll();
    this.refreshFuture();
  }

  ngOnDestroy(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  /** Show a transient action toast that auto-dismisses after a few seconds. */
  private notify(message: string): void {
    this.actionMessage.set(message);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.actionMessage.set(null);
      this.toastTimer = null;
    }, DashboardComponent.TOAST_MS);
  }

  loadAll(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      vehicles: this.hov.getVehicles(),
      declarations: this.hov.getStatus(),
      transactions: this.transactionSvc.getTransactions(this.days()),
      account: this.accountSvc.getSummary(),
      roadGroups: this.roadGroupSvc.getRoadGroups(),
      disputes: this.tollExceptionsSvc.getDisputes(),
      reasons: this.tollExceptionsSvc.getReasons(),
    }).subscribe({
      next: (res) => {
        this.vehicles.set(res.vehicles);
        this.declarations.set(res.declarations);
        this.transactions.set(res.transactions);
        this.roadGroups.set(res.roadGroups);
        this.account.set(res.account);
        this.disputes.set(res.disputes);
        this.reasons.set(res.reasons);
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
    // Check whether this window overlaps a scheduled declaration first.
    const start = req.startDateTime ? new Date(req.startDateTime) : new Date();
    const end = req.endDateTime ? new Date(req.endDateTime) : endOfDay(start);
    this.hov
      .checkConflict({
        transponderNumber: req.transponderNumber,
        startDateTime: start.toISOString(),
        endDateTime: end.toISOString(),
      })
      .subscribe({
        next: (conflicts) => {
          if (conflicts.length > 0) {
            this.conflict.set({ req, declarations: conflicts });
            this.busyTransponder.set(null);
          } else {
            this.proceedActivate(req);
          }
        },
        error: () => this.proceedActivate(req), // conflict check is best-effort
      });
  }

  confirmConflict(): void {
    const pending = this.conflict();
    if (!pending) return;
    const ids = pending.declarations.map((d) => d.id);
    this.conflict.set(null);
    this.busyTransponder.set(pending.req.transponderNumber);
    this.hov.resolveConflict(ids).subscribe({
      next: () => this.proceedActivate(pending.req),
      error: (err) => this.handleActionError(err, 'Failed to cancel the scheduled declaration.'),
    });
  }

  cancelConflict(): void {
    this.conflict.set(null);
    this.busyTransponder.set(null);
  }

  /** A genuinely future start becomes a one-off future-dated declaration created
   *  directly with the session token; a blank or past start activates now. */
  private proceedActivate(req: ActivateRequest): void {
    const startsInFuture =
      !!req.startDateTime && new Date(req.startDateTime).getTime() > Date.now() + 60_000;
    if (startsInFuture) {
      this.doAdhoc(req);
    } else {
      this.doActivate(req);
    }
  }

  private doAdhoc(req: ActivateRequest): void {
    if (!req.startDateTime) return;
    this.busyTransponder.set(req.transponderNumber);
    const start = new Date(req.startDateTime);
    const end = req.endDateTime ? new Date(req.endDateTime) : endOfDay(start);
    this.hov
      .createAdhoc(req.transponderNumber, start.toISOString(), end.toISOString())
      .subscribe({
        next: () => this.afterHovChange('Future HOV declaration set.'),
        error: (err) => this.handleActionError(err, 'Failed to set that HOV declaration.'),
      });
  }

  private doActivate(req: ActivateRequest): void {
    this.busyTransponder.set(req.transponderNumber);
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

  openScheduled(): void {
    this.scheduledDrawerOpen.set(true);
  }

  closeScheduled(): void {
    this.scheduledDrawerOpen.set(false);
  }

  onScheduleSaved(message: string): void {
    // Weekly save/remove: reflect the message, close the drawer, and refresh the
    // upcoming list since materialization may have created or dropped declarations.
    if (message) this.notify(message);
    this.scheduledDrawerOpen.set(false);
    this.refreshFuture();
  }

  onCancelUpcoming(id: string): void {
    this.futureBusyId.set(id);
    this.hov.cancelFutureDeclaration(id).subscribe({
      next: () => {
        this.futureBusyId.set(null);
        this.futureDeclarations.update((list) => list.filter((d) => d.id !== id));
        this.notify('Scheduled declaration canceled.');
      },
      error: () => {
        this.futureBusyId.set(null);
        this.notify('Could not cancel that declaration. Please try again.');
      },
    });
  }

  /** Load upcoming scheduled declarations for the badge + Upcoming tab. Best-effort. */
  private refreshFuture(): void {
    this.hov.getFutureDeclarations().subscribe({
      next: (list) => this.futureDeclarations.set(list),
      error: () => this.futureDeclarations.set([]),
    });
  }

  openDispute(trip: Trip): void {
    this.disputeTrip.set(trip);
  }

  closeDispute(): void {
    this.disputeTrip.set(null);
  }

  onSubmitDispute(payload: CreateDispute): void {
    this.disputeBusy.set(true);
    this.tollExceptionsSvc.createDispute(payload).subscribe({
      next: (res) => {
        this.disputeBusy.set(false);
        this.disputeTrip.set(null);
        this.notify(`Dispute filed. Case ${res.caseNumber}.`);
        this.refreshDisputes();
      },
      error: (err) => {
        this.disputeBusy.set(false);
        this.handleActionError(err, 'Failed to file your dispute. Please try again.');
      },
    });
  }

  private refreshDisputes(): void {
    this.tollExceptionsSvc.getDisputes().subscribe({
      next: (list) => this.disputes.set(list),
      error: () => {},
    });
  }

  logout(): void {
    this.auth.logout().subscribe({
      next: () => void this.router.navigate(['/login']),
      error: () => void this.router.navigate(['/login']),
    });
  }

  private afterHovChange(message: string): void {
    this.notify(message);
    // Conflict resolution may have superseded scheduled declarations, so keep the
    // upcoming list/badge in sync alongside the live status.
    this.refreshFuture();
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
    this.notify(message);
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

