import { AfterViewInit, Component, ElementRef, ViewChild, signal } from '@angular/core';

// A plain-language sequence of who does what with your password.
// Mermaid gotcha: avoid '#' in labels (parsed as an entity and truncates).
const CREDENTIAL_FLOW = `sequenceDiagram
  actor You
  participant App as This app
  participant Vault as AWS key vault
  participant Bot as Background Scheduler
  participant NCQP as NC Quick Pass

  You->>App: Sign in with your password
  App->>NCQP: Swap it for a short-lived pass
  Note over App: Password not saved<br/>by default

  You->>App: Turn on weekly schedule (re-enter password)
  App->>Vault: Lock your password
  Vault-->>App: Returns locked text only
  Note over App,Vault: Unlock key stays in AWS.<br/>The app never sees it.

  Bot->>Vault: Later, ask to unlock in memory
  Vault-->>Bot: Unlocks briefly (every use is logged)
  Bot->>NCQP: Sign in for a fresh pass
  Bot->>NCQP: Create your scheduled HOV declarations
  Note over Bot: Password discarded<br/>right after`;

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
