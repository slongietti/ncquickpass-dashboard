import { NcqpCorrespondence } from '../../models/ncqp/NcqpCorrespondence';

/** How the agency resolved a dispute, derived from the case status + notes. */
export type DisputeDecision = 'under_review' | 'denied' | 'approved';

/** One correspondence entry on a case: the creation confirmation or an agency response. */
export interface DisputeNote {
  date: string | null;
  /** Case status reported by this note, when present ("Open" | "Closed"). */
  status: string | null;
  /** The note text (HTML stripped). */
  text: string;
}

/** A toll included in a dispute (populated only when the case's tolls can be resolved). */
export interface DisputeTransaction {
  exitLocation: string;
  transactionDate: string;
  debitAmount: number;
}

/** A customer dispute, assembled from the correspondence records for one case number. */
export interface Dispute {
  /** Customer-facing case number (the ticket number shown in correspondence). */
  caseNumber: string;
  createdDate: string | null;
  /** Highest-level status across all correspondence: "Closed" outranks "Open"/"Filed". */
  status: string;
  decision: DisputeDecision;
  /** Every correspondence note on the case, oldest first. */
  notes: DisputeNote[];
  lastUpdated: string | null;
  /** documentID of the attached vehicle image, if the agency included one. */
  attachmentDocumentId: string | null;
  /** Disputed tolls, when resolvable; empty otherwise. */
  transactions: DisputeTransaction[];
  total: number;
}

const CREATED = 'Customer Case Created Confirmation';
const UPDATED = 'Case Updated';

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Pull the case number out of "...case ID is 123", "...case number is 123", "...case number: 123". */
function caseNumberFrom(text: string): string | null {
  const m = /case (?:id|number)\s*(?:is|:)?\s*#?(\d+)/i.exec(text);
  return m && m[1] ? m[1] : null;
}

function statusFrom(text: string): string | null {
  const m = /Case Status:\s*([A-Za-z]+)/i.exec(text);
  return m && m[1] ? m[1] : null;
}

/**
 * The meaningful note text: the "Case Notes:" section when present (trimmed of the
 * sign-off), otherwise the whole stripped body so nothing is dropped.
 */
function noteTextFrom(text: string): string {
  const m = /Case Notes:\s*([\s\S]*?)(?:\s*(?:Thank you for your business|Best regards|Sincerely)\b|$)/i.exec(
    text,
  );
  return (m && m[1] ? m[1] : text).trim();
}

/** Status ranking so the terminal "Closed" wins over "Open", which wins over "Filed". */
function statusRank(status: string): number {
  const s = status.toLowerCase();
  if (s.includes('closed')) return 3;
  if (s.includes('open') || s.includes('progress') || s.includes('review')) return 2;
  return 1;
}

function decisionFrom(status: string, notes: DisputeNote[]): DisputeDecision {
  if (statusRank(status) < 3) return 'under_review';
  const text = notes.map((n) => n.text).join(' ');
  return /approv|credit|waiv|remov|in your favor/i.test(text) ? 'approved' : 'denied';
}

interface Draft {
  caseNumber: string;
  createdDate: string | null;
  attachmentDocumentId: string | null;
  /** One entry per correspondence event; the richest (Email) copy wins over a Web Alert. */
  events: Map<string, { note: DisputeNote; score: number }>;
}

/**
 * Turn the raw correspondence log into disputes. NCQP has no dispute-status API;
 * each case is reconstructed from its "Customer Case Created Confirmation" (filed)
 * and "Case Updated" (agency responded) records plus any attached vehicle image,
 * grouped by the case number embedded in the message text. Every note is kept (so
 * the drawer can show the full correspondence history) and the case's status is the
 * highest level seen across them. Only derived fields are returned — never the raw
 * HTML bodies. Newest case first.
 */
export function parseDisputes(rows: NcqpCorrespondence[]): Dispute[] {
  const drafts = new Map<string, Draft>();

  const draftFor = (caseNumber: string): Draft => {
    let draft = drafts.get(caseNumber);
    if (!draft) {
      draft = { caseNumber, createdDate: null, attachmentDocumentId: null, events: new Map() };
      drafts.set(caseNumber, draft);
    }
    return draft;
  };

  for (const row of rows) {
    const displayName = row.displayName ?? '';
    const timestamp = row.timestamp ?? null;

    // Attached vehicle image: displayName like "1322705.png", stored as a tracer-ticket document.
    if (row.fileLocation === 'TracerTicketDocument' && /\.png$/i.test(displayName)) {
      const num = /(\d+)\.png$/i.exec(displayName);
      if (num && num[1] && row.documentID != null) {
        draftFor(num[1]).attachmentDocumentId = String(row.documentID);
      }
      continue;
    }

    if (displayName !== CREATED && displayName !== UPDATED) continue;

    const text = stripHtml(row.emailText ?? row.webAlertText ?? '');
    const caseNumber = caseNumberFrom(text);
    if (!caseNumber) continue;

    const draft = draftFor(caseNumber);
    if (displayName === CREATED) {
      if (!draft.createdDate || (timestamp && timestamp < draft.createdDate)) {
        draft.createdDate = timestamp;
      }
    }

    // Email and Web Alert copies of one event share a queueNotificationRequestID
    // (their sub-second timestamps differ), so key on that id and keep the richer copy.
    const eventKey =
      row.queueNotificationRequestID != null
        ? String(row.queueNotificationRequestID)
        : (timestamp ?? '');
    const note: DisputeNote = {
      date: timestamp,
      status: displayName === UPDATED ? statusFrom(text) : null,
      text: noteTextFrom(text),
    };
    const score = (row.deliveryType === 'Email' ? 1000 : 0) + note.text.length;
    const existing = draft.events.get(eventKey);
    if (!existing || score > existing.score) {
      draft.events.set(eventKey, {
        note: { ...note, status: note.status ?? existing?.note.status ?? null },
        score,
      });
    }
  }

  return Array.from(drafts.values())
    .map((draft) => {
      // Newest correspondence first (drawer shows the latest response at the top).
      const notes = Array.from(draft.events.values())
        .map((e) => e.note)
        .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));

      let status = 'Filed';
      for (const note of notes) {
        if (note.status && statusRank(note.status) > statusRank(status)) status = note.status;
      }
      if (status === 'Filed' && notes.some((n) => n.status !== null)) status = 'Open';

      const newest = notes.length ? (notes[0]?.date ?? null) : null;
      const oldest = notes.length ? (notes[notes.length - 1]?.date ?? null) : null;

      return {
        caseNumber: draft.caseNumber,
        createdDate: draft.createdDate ?? oldest,
        status,
        decision: decisionFrom(status, notes),
        notes,
        lastUpdated: newest,
        attachmentDocumentId: draft.attachmentDocumentId,
        transactions: [],
        total: 0,
      };
    })
    .sort((a, b) => (b.createdDate ?? '').localeCompare(a.createdDate ?? ''));
}
