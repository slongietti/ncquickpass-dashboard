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
import { HovService, PutSchedule } from '../../../../core/services/hov.service';
import { VehicleView } from '../../../../core/models/VehicleView';
import { WeeklySchedule } from '../../../../core/models/WeeklySchedule';
import { DrawerComponent } from '../../../../shared/drawer/drawer.component';
import { SelectComponent, SelectOption } from '../../../../shared/select/select.component';
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
  selector: 'app-weekly-schedule-drawer',
  standalone: true,
  imports: [FormsModule, DrawerComponent, SelectComponent, TimePickerDirective],
  templateUrl: './weekly-schedule-drawer.component.html',
  styleUrl: './weekly-schedule-drawer.component.scss',
})
export class WeeklyScheduleDrawerComponent implements OnChanges {
  private readonly hov = inject(HovService);

  @Input() open = false;
  @Input() vehicles: VehicleView[] = [];
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<string>();

  selectedTransponder = '';
  enabled = false;
  credentialOnFile = false;
  password = '';
  private timezone = 'America/New_York';
  private scheduleExists = false;

  dayEdits: DayEdit[] = WEEK.map((w) => ({ ...w, allDay: false, ranges: [] }));

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly passwordPromptOpen = signal(false);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      if (!this.selectedTransponder && this.vehicles.length > 0) {
        this.selectedTransponder = this.vehicles[0].transponderNumber;
      }
      if (this.selectedTransponder) this.load(this.selectedTransponder);
    }
  }

  get vehicleOptions(): SelectOption[] {
    return this.vehicles.map((v) => ({
      label: v.friendlyName ? `${v.friendlyName} · #${v.transponderNumber}` : `#${v.transponderNumber}`,
      value: v.transponderNumber,
    }));
  }

  onVehicleChange(value: number | string): void {
    this.selectedTransponder = String(value);
    this.load(this.selectedTransponder);
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
    // Enabling automatic scheduling for the first time needs the password to arm
    // the credential vault. Prompt for it before saving.
    if (this.enabled && !this.credentialOnFile && !this.password) {
      this.passwordPromptOpen.set(true);
      return;
    }
    this.doSave(days);
  }

  confirmPassword(): void {
    if (!this.password) {
      this.error.set('Enter your NC Quick Pass password to enable automatic scheduling.');
      return;
    }
    const days = this.buildDays();
    if (days === null) return;
    this.passwordPromptOpen.set(false);
    this.doSave(days);
  }

  cancelPassword(): void {
    this.passwordPromptOpen.set(false);
    this.password = '';
  }

  private doSave(days: PutSchedule['days']): void {
    this.saving.set(true);
    const body: PutSchedule = {
      transponderNumber: this.selectedTransponder,
      enabled: this.enabled,
      timezone: this.timezone,
      days,
      ...(this.password ? { password: this.password } : {}),
    };
    this.hov.putSchedule(body).subscribe({
      next: (schedule) => {
        this.saving.set(false);
        this.password = '';
        this.apply(schedule);
        this.saved.emit('Weekly schedule saved.');
        this.close.emit();
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Could not save the schedule. Please try again.');
      },
    });
  }

  remove(): void {
    if (!this.scheduleExists) {
      this.close.emit();
      return;
    }
    this.saving.set(true);
    this.hov.deleteSchedule(this.selectedTransponder).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.emit('Weekly schedule removed.');
        this.close.emit();
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Could not remove the schedule. Please try again.');
      },
    });
  }

  private load(transponder: string): void {
    this.loading.set(true);
    this.error.set(null);
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
    this.enabled = schedule.enabled;
    this.timezone = schedule.timezone;
    this.credentialOnFile = schedule.credentialOnFile;
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
