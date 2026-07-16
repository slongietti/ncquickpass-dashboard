import { AfterViewInit, Component, ElementRef, ViewChild, signal } from '@angular/core';

// Mermaid gotcha: avoid '#' in labels (parsed as an entity and truncates).
const CREDENTIAL_FLOW = `flowchart TD
  A([You sign in]) -->|password used once| B[BFF gets a short-lived token]
  B --> C{Enable weekly schedule?}
  C -->|No| D[Password discarded<br/>nothing is stored]
  C -->|Yes, with password| E[Encrypt via AWS KMS<br/>key never leaves KMS]
  E --> F[(Ciphertext in our database<br/>key stays in AWS KMS)]
  G[[Daily background job<br/>runs as the scheduler role]] --> F
  F --> H[KMS decrypts in memory<br/>logged to CloudTrail]
  H --> I[Sign in to NC Quick Pass<br/>for a fresh token]
  I --> J[Create your scheduled<br/>HOV declarations]
  J --> K[Plaintext discarded]`;

@Component({
  selector: 'app-how-it-works',
  standalone: true,
  templateUrl: './how-it-works.component.html',
  styleUrl: './how-it-works.component.scss',
})
export class HowItWorksComponent implements AfterViewInit {
  @ViewChild('diagram') diagram!: ElementRef<HTMLDivElement>;
  readonly rendered = signal(false);

  async ngAfterViewInit(): Promise<void> {
    try {
      const mermaid = (await import('mermaid')).default;
      mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict' });
      const { svg } = await mermaid.render('credential-flow', CREDENTIAL_FLOW);
      this.diagram.nativeElement.innerHTML = svg;
      this.rendered.set(true);
    } catch {
      // The diagram is progressive enhancement; the prose below explains the same flow.
    }
  }
}
