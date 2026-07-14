import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <router-outlet />
    <img class="volare-watermark" src="assets/volare-logo.png" alt="A Volare Solution" />
  `,
})
export class AppComponent {}
