import { Directive, ElementRef, EventEmitter, OnDestroy, OnInit, Output, inject } from '@angular/core';
import flatpickr from 'flatpickr';
import type { Instance } from 'flatpickr/dist/types/instance';

/**
 * Turns a text input into a modern flatpickr date + time picker. Emits the
 * selected value as an ISO-8601 string (or undefined when cleared).
 */
@Directive({
  selector: '[appDateTimePicker]',
  standalone: true,
  exportAs: 'appDateTimePicker',
})
export class DateTimePickerDirective implements OnInit, OnDestroy {
  @Output() valueChange = new EventEmitter<string | undefined>();

  private readonly host = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private picker?: Instance;

  /** Reset the picker (fires onChange, so bound models are cleared too). */
  clear(): void {
    this.picker?.clear();
  }

  ngOnInit(): void {
    this.picker = flatpickr(this.host.nativeElement, {
      enableTime: true,
      altInput: true,
      altFormat: 'M j, Y at h:i K',
      dateFormat: 'Z',
      minDate: 'today',
      minuteIncrement: 15,
      onChange: (dates) => this.valueChange.emit(dates[0]?.toISOString()),
    });
  }

  ngOnDestroy(): void {
    this.picker?.destroy();
  }
}
