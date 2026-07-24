/** How the agency resolved a dispute. */
export type DisputeDecision = 'under_review' | 'denied' | 'approved';

/** One correspondence entry on a case: the creation confirmation or an agency response. */
export interface DisputeNote {
  date: string | null;
  /** Case status reported by this note, when present ("Open" | "Closed"). */
  status: string | null;
  text: string;
}

/** A toll included in a dispute. */
export interface DisputeTransaction {
  exitLocation: string;
  transactionDate: string;
  debitAmount: number;
}

/** A customer dispute with its status, full correspondence history, and agency response. */
export interface Dispute {
  caseNumber: string;
  createdDate: string | null;
  /** Highest-level status across all correspondence: "Closed" outranks "Open"/"Filed". */
  status: string;
  decision: DisputeDecision;
  /** Every correspondence note on the case, oldest first. */
  notes: DisputeNote[];
  lastUpdated: string | null;
  /** documentID of the attached vehicle image, if any. */
  attachmentDocumentId: string | null;
  transactions: DisputeTransaction[];
  total: number;
}
