export interface TransactionView {
  activityTypeName: string;
  exitLocation: string;
  transactionDate: string;
  transactionDisplayDate: string;
  tagNumber: string;
  debitAmount: number;
  creditAmount: number | null;
  transactionType: string;
  vehicleClass: string;
  /** Road group id for this toll's exit location, or null if unclassified. */
  roadGroup: string | null;
  /** A paid HOV-eligible toll that fell inside a recorded HOV declaration window. */
  disputable: boolean;
  /** Ledger id for this row; the key needed to attach it to a dispute. */
  detailTransactionID: string;
  /** True when this toll was charged as an HOV occupancy violation. */
  hovViolation: boolean;
  /** Agency comment on the violation, when present. */
  violationComments: string;
}
