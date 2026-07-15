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
}
