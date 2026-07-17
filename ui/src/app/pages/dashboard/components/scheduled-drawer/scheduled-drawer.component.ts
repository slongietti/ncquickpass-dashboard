import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  signal,
} from '@angular/core';
import { VehicleView } from '../../../../core/models/VehicleView';
import { FutureDeclaration } from '../../../../core/models/FutureDeclaration';
import { DrawerComponent } from '../../../../shared/drawer/drawer.component';
import { SelectComponent, SelectOption } from '../../../../shared/select/select.component';
import { WeeklySchedulePanelComponent } from '../weekly-schedule-panel/weekly-schedule-panel.component';
import { UpcomingDeclarationsPanelComponent } from '../upcoming-declarations-panel/upcoming-declarations-panel.component';

type Tab = 'weekly' | 'upcoming';

/**
 * The single "Scheduled" drawer: one vehicle picker filters both tabs — Weekly
 * (edit the recurring schedule) and Upcoming (that vehicle's materialized future
 * declarations, with a count badge).
 */
@Component({
  selector: 'app-scheduled-drawer',
  standalone: true,
  imports: [
    DrawerComponent,
    SelectComponent,
    WeeklySchedulePanelComponent,
    UpcomingDeclarationsPanelComponent,
  ],
  templateUrl: './scheduled-drawer.component.html',
  styleUrl: './scheduled-drawer.component.scss',
})
export class ScheduledDrawerComponent implements OnChanges {
  @Input() open = false;
  @Input() vehicles: VehicleView[] = [];
  @Input() upcoming: FutureDeclaration[] = [];
  @Input() busyId: string | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<string>();
  @Output() cancelUpcoming = new EventEmitter<string>();

  readonly tab = signal<Tab>('weekly');
  readonly selectedTransponder = signal('');

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open && !this.selectedTransponder() && this.vehicles.length > 0) {
      this.selectedTransponder.set(String(this.vehicleOptions[0].value));
    }
  }

  get vehicleOptions(): SelectOption[] {
    const isActive = (v: VehicleView) => (v.status || '').toUpperCase() === 'ACTIVE';
    // Active transponders first, retained second (stable within each group).
    return [...this.vehicles]
      .sort((a, b) => Number(isActive(b)) - Number(isActive(a)))
      .map((v) => ({
        label: v.friendlyName
          ? `${v.friendlyName} · #${v.transponderNumber}`
          : `#${v.transponderNumber}`,
        value: v.transponderNumber,
      }));
  }

  /** Upcoming declarations for the selected vehicle only. */
  get filteredUpcoming(): FutureDeclaration[] {
    const t = this.selectedTransponder();
    return t ? this.upcoming.filter((d) => d.transponderNumber === t) : this.upcoming;
  }

  onVehicleChange(value: string | number): void {
    this.selectedTransponder.set(String(value));
  }

  setTab(tab: Tab): void {
    this.tab.set(tab);
  }
}
