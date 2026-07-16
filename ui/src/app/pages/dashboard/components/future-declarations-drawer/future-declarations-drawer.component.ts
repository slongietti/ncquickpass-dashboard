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
import { DatePipe } from '@angular/common';
import { HovService } from '../../../../core/services/hov.service';
import { FutureDeclaration } from '../../../../core/models/FutureDeclaration';
import { DrawerComponent } from '../../../../shared/drawer/drawer.component';

@Component({
  selector: 'app-future-declarations-drawer',
  standalone: true,
  imports: [DatePipe, DrawerComponent],
  templateUrl: './future-declarations-drawer.component.html',
  styleUrl: './future-declarations-drawer.component.scss',
})
export class FutureDeclarationsDrawerComponent implements OnChanges {
  private readonly hov = inject(HovService);

  @Input() open = false;
  @Output() close = new EventEmitter<void>();
  @Output() canceled = new EventEmitter<string>();

  readonly declarations = signal<FutureDeclaration[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly busyId = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) this.load();
  }

  cancel(id: string): void {
    this.busyId.set(id);
    this.hov.cancelFutureDeclaration(id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.declarations.update((list) => list.filter((d) => d.id !== id));
        this.canceled.emit('Scheduled declaration canceled.');
      },
      error: () => {
        this.busyId.set(null);
        this.error.set('Could not cancel that declaration. Please try again.');
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.hov.getFutureDeclarations().subscribe({
      next: (list) => {
        this.declarations.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Could not load scheduled declarations.');
      },
    });
  }
}
