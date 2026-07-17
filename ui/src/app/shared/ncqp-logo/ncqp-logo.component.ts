import { Component, Input } from '@angular/core';

/** The NC Quick Pass logo, linked to the official site (opens in a new tab). */
@Component({
  selector: 'app-ncqp-logo',
  standalone: true,
  templateUrl: './ncqp-logo.component.html',
  styleUrl: './ncqp-logo.component.scss',
})
export class NcqpLogoComponent {
  /** Rendered logo height in pixels. */
  @Input() height = 30;
}
