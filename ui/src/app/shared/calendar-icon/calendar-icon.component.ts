import { Component, Input } from '@angular/core';

/** A small calendar glyph that inherits the surrounding text color. */
@Component({
  selector: 'app-calendar-icon',
  standalone: true,
  template: `
    <svg
      [attr.width]="size"
      [attr.height]="size"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M8 2v4M16 2v4M3 10h18" />
    </svg>
  `,
  styles: [':host { display: inline-flex; align-items: center; }'],
})
export class CalendarIconComponent {
  /** Rendered icon size in pixels (square). */
  @Input() size = 16;
}
