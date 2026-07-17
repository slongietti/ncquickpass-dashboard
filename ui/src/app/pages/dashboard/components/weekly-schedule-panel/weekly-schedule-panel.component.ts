import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { HovService, PutSchedule } from '../../../../core/services/hov.service';
import { serverMessage } from '../../../../core/http-utils';
import { WeeklySchedule } from '../../../../core/models/WeeklySchedule';
import { PasswordPromptComponent } from '../../../../shared/password-prompt/password-prompt.component';
import { TimePickerDirective } from '../../../../core/time-picker.directive';

interface EditRange {
  start: string; // HH:MM
  end: string; // HH:MM
}

interface DayEdit {
  dayOfWeek: number;
  label: string;
  allDay: boolean;
  ranges: EditRange[];
}

// The week in Monday-first display order (JS getDay: 0=Sun..6=Sat).
const WEEK: ReadonlyArray<{ dayOfWeek: number; label: string }> = [
  { dayOfWeek: 1, label: 'Monday' },
  { dayOfWeek: 2, label: 'Tuesday' },
  { dayOfWeek: 3, label: 'Wednesday' },
  { dayOfWeek: 4, label: 'Thursday' },
  { dayOfWeek: 5, label: 'Friday' },
  { dayOfWeek: 6, label: 'Saturday' },
  { dayOfWeek: 0, label: 'Sunday' },
];

@Component({
  selector: 'app-weekly-schedule-panel',
  standalone: true,
  imports: [FormsModule, PasswordPromptComponent, TimePickerDirective],
  templateUrl: './weekly-schedule-panel.component.html',
  styleUrl: './weekly-schedule-panel.component.scss',
})
export class WeeklySchedulePanelComponent implements OnChanges {
  private readonly hov = inject(HovService);

  /** True while the parent drawer is open on the Weekly tab; triggers a (re)load. */
  @Input() active = false;
  /** The vehicle selected in the drawer; both tabs filter on it. */
  @Input() transponder = '';
  @Output() saved = new EventEmitter<string>();

  password = '';
  scheduleExists = false;
  private timezone = 'America/New_York';

  dayEdits: DayEdit[] = WEEK.map((w) => ({ ...w, allDay: false, ranges: [] }));

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly passwordPromptOpen = signal(false);
  readonly pwError = signal<string | null>(null);
  readonly confirmingClear = signal(false);

  ngOnChanges(changes: SimpleChanges): void {
    // (Re)load whenever the drawer opens on this tab or the selected vehicle changes.
    if ((changes['active'] || changes['transponder']) && this.active && this.transponder) {
      this.load(this.transponder);
    }
  }

  toggleAllDay(day: DayEdit): void {
    if (day.allDay) day.ranges = [];
  }

  addRange(day: DayEdit): void {
    day.ranges.push({ start: '07:00', end: '09:00' });
  }

  removeRange(day: DayEdit, index: number): void {
    day.ranges.splice(index, 1);
  }

  save(): void {
    this.error.set(null);
    const days = this.buildDays();
    if (days === null) return; // validation error already set
    // An active schedule runs in the background, so we re-capture the password on
    // every save (it may have changed). Removing all days just disables it.
    if (days.length > 0) {
      this.pwError.set(null);
      this.passwordPromptOpen.set(true);
      return;
    }
    this.doSave(days);
  }

  onPasswordConfirm(password: string): void {
    this.password = password;
    const days = this.buildDays();
    if (days === null) return;
    // Keep the prompt open until the server confirms the password mints a token;
    // a wrong password comes back as an error shown inside the prompt.
    this.pwError.set(null);
    this.doSave(days);
  }

  cancelPassword(): void {
    this.passwordPromptOpen.set(false);
    this.pwError.set(null);
    this.password = '';
  }

  private doSave(days: PutSchedule['days']): void {
    this.saving.set(true);
    const body: PutSchedule = {
      transponderNumber: this.transponder,
      enabled: days.length > 0,
      timezone: this.timezone,
      days,
      ...(this.password ? { password: this.password } : {}),
    };
    this.hov.putSchedule(body).subscribe({
      next: (schedule) => {
        this.saving.set(false);
        this.password = '';
        this.passwordPromptOpen.set(false);
        this.pwError.set(null);
        this.apply(schedule);
        this.saved.emit('Weekly schedule saved.');
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        const message = serverMessage(err);
        // Bad password (or other arming failure) surfaces inside the still-open prompt;
        // anything else is a general save error on the form.
        if (this.passwordPromptOpen()) {
          this.pwError.set(message ?? 'Could not enable automatic scheduling. Please try again.');
        } else {
          this.error.set(message ?? 'Could not save the schedule. Please try again.');
        }
      },
    });
  }

  /** First step of clearing: reveal the inline confirmation (no modal). */
  startClear(): void {
    if (!this.scheduleExists) {
      this.saved.emit('');
      return;
    }
    this.confirmingClear.set(true);
  }

  cancelClear(): void {
    this.confirmingClear.set(false);
  }

  /** Confirmed clear: delete the weekly schedule for this vehicle. */
  confirmClear(): void {
    this.confirmingClear.set(false);
    this.saving.set(true);
    this.hov.deleteSchedule(this.transponder).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.emit('Weekly schedule cleared.');
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Could not clear the schedule. Please try again.');
      },
    });
  }

  private load(transponder: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.confirmingClear.set(false);
    this.hov.getSchedule(transponder).subscribe({
      next: (schedule) => {
        this.apply(schedule);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Could not load the schedule.');
      },
    });
  }

  private apply(schedule: WeeklySchedule): void {
    this.timezone = schedule.timezone;
    this.scheduleExists = schedule.days.length > 0;
    this.dayEdits = WEEK.map((w) => {
      const found = schedule.days.find((d) => d.dayOfWeek === w.dayOfWeek);
      return {
        ...w,
        allDay: found?.allDay ?? false,
        ranges: (found && !found.allDay ? found.ranges : []).map((r) => ({
          start: minutesToHHMM(r.startMinute),
          end: minutesToHHMM(r.endMinute),
        })),
      };
    });
  }

  /** Convert edits to the API shape; returns null (and sets error) if invalid. */
  private buildDays(): PutSchedule['days'] | null {
    const days: PutSchedule['days'] = [];
    for (const day of this.dayEdits) {
      if (day.allDay) {
        days.push({ dayOfWeek: day.dayOfWeek, allDay: true, ranges: [] });
        continue;
      }
      const ranges = [];
      for (const r of day.ranges) {
        const startMinute = hhmmToMinutes(r.start);
        const endMinute = hhmmToMinutes(r.end);
        if (startMinute === null || endMinute === null) {
          this.error.set(`${day.label}: enter a valid start and end time.`);
          return null;
        }
        if (endMinute <= startMinute) {
          this.error.set(`${day.label}: end time must be after start time.`);
          return null;
        }
        ranges.push({ startMinute, endMinute });
      }
      if (ranges.length > 0) days.push({ dayOfWeek: day.dayOfWeek, allDay: false, ranges });
    }
    return days;
  }
}

function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function hhmmToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value ?? '');
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}
