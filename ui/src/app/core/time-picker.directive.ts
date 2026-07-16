import {
  Directive,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import flatpickr from 'flatpickr';
import type { Instance } from 'flatpickr/dist/types/instance';

/**
 * Turns a text input into a flatpickr time-only picker (no calendar), for
 * recurring times of day. Two-way friendly: set [value] as a 24-hour "HH:MM"
 * string and it emits the same on change. 15-minute increments.
 */
@Directive({
  selector: '[appTimePicker]',
  standalone: true,
})
export class TimePickerDirective implements OnInit, OnChanges, OnDestroy {
  @Input() value = '';
  @Output() valueChange = new EventEmitter<string>();

  private readonly host = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private picker?: Instance;

  ngOnInit(): void {
    this.picker = flatpickr(this.host.nativeElement, {
      enableTime: true,
      noCalendar: true,
      altInput: true,
      altFormat: 'h:i K', // 12-hour display (07:00 AM)
      dateFormat: 'H:i', // 24-hour value (07:00)
      minuteIncrement: 15,
      defaultDate: this.value || undefined,
      onChange: (_dates, dateStr) => this.valueChange.emit(dateStr),
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Keep the picker in sync when the bound value changes (e.g. switching
    // vehicles reuses the input element rather than recreating the directive).
    if (this.picker && changes['value'] && !changes['value'].firstChange) {
      this.picker.setDate(this.value || '', false);
    }
  }

  ngOnDestroy(): void {
    this.picker?.destroy();
  }
}
