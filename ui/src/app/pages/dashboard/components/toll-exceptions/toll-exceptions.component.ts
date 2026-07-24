import { Component, Input, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Dispute } from '../../../../core/models/Dispute';
import { TransactionView } from '../../../../core/models/TransactionView';
import { DrawerComponent } from '../../../../shared/drawer/drawer.component';
import { SelectComponent, SelectOption } from '../../../../shared/select/select.component';
import { TollExceptionsService } from '../../../../core/services/toll-exceptions.service';

export interface RangeOption {
  label: string;
  days: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

@Component({
  selector: 'app-toll-exceptions',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, DrawerComponent, SelectComponent],
  templateUrl: './toll-exceptions.component.html',
  styleUrl: './toll-exceptions.component.scss',
})
export class TollExceptionsComponent {
  @Input() disputes: Dispute[] = [];
  @Input() violations: TransactionView[] = [];
  @Input() dayOptions: RangeOption[] = [];
  @Input() loading = false;

  /** Date range for the disputes list. Defaults to 90 days, matching the Trips card. */
  readonly days = signal(90);
  readonly selected = signal<Dispute | null>(null);
  /** The enlarged image shown in the lightbox, or null when closed. */
  readonly lightbox = signal<{ url: string; name: string } | null>(null);
  /** Placeholder rows shown while disputes load. */
  readonly skeletonRows = [1, 2, 3];

  constructor(
    private readonly tollExceptions: TollExceptionsService,
    private readonly sanitizer: DomSanitizer,
  ) {}

  private static escapeHtml(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   * Highlight the case number, currency amounts ($13.50) and dates (10/09/2024) in
   * a note so they stand out like the status chip. The source text is already
   * HTML-stripped; we re-escape then wrap matches, so the bound HTML is safe.
   */
  highlight(text: string, caseNumber?: string): SafeHtml {
    let marked = TollExceptionsComponent.escapeHtml(text);
    if (caseNumber) {
      const escaped = caseNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      marked = marked.replace(new RegExp(`\\b${escaped}\\b`, 'g'), (m) => `<span class="hl">${m}</span>`);
    }
    marked = marked
      .replace(/\$\d[\d,]*(?:\.\d{2})?/g, (m) => `<span class="hl">${m}</span>`)
      .replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, (m) => `<span class="hl">${m}</span>`);
    return this.sanitizer.bypassSecurityTrustHtml(marked);
  }

  get rangeOptions(): SelectOption[] {
    return this.dayOptions.map((o) => ({ label: o.label, value: o.days }));
  }

  /**
   * Disputes whose created date falls within the selected range. The widest option
   * ("Forever") shows everything; a dispute with no/undated created date is treated
   * as out of range for any finite window and only appears under "Forever".
   */
  get visibleDisputes(): Dispute[] {
    const maxDays = this.dayOptions.length ? Math.max(...this.dayOptions.map((o) => o.days)) : 0;
    if (this.days() >= maxDays) return this.disputes;
    const cutoff = Date.now() - this.days() * DAY_MS;
    return this.disputes.filter((dispute) => {
      if (!dispute.createdDate) return false;
      const created = new Date(dispute.createdDate).getTime();
      return !Number.isNaN(created) && created >= cutoff;
    });
  }

  onDaysChange(days: number): void {
    this.days.set(days);
  }

  badgeClass(dispute: Dispute): string {
    if (dispute.decision === 'approved') return 'badge-approved';
    if (dispute.decision === 'denied') return 'badge-denied';
    return 'badge-pending';
  }

  badgeLabel(dispute: Dispute): string {
    if (dispute.decision === 'approved') return 'Approved';
    if (dispute.decision === 'denied') return 'Denied';
    return dispute.status === 'Filed' ? 'Filed' : 'Under review';
  }

  open(dispute: Dispute): void {
    this.selected.set(dispute);
  }

  close(): void {
    this.selected.set(null);
  }

  imageUrl(documentId: string): string {
    return this.tollExceptions.documentUrl(documentId);
  }

  openLightbox(url: string, name: string): void {
    this.lightbox.set({ url, name });
  }

  closeLightbox(): void {
    this.lightbox.set(null);
  }
}
