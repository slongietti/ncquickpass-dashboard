import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <router-outlet />
    <a
      class="volare-watermark-link"
      href="https://go-volare.com"
      target="_blank"
      rel="noopener"
      aria-label="Volare — go-volare.com (opens in a new tab)"
    >
      <img class="volare-watermark" src="assets/volare-logo.png" alt="A Volare Solution" />
    </a>
  `,
})
export class AppComponent {}
