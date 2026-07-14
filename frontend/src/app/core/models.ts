export interface VehicleView {
  transponderNumber: string;
  friendlyName: string;
  status: string;
  description: string;
}

export interface DeclarationView {
  declarationId: string;
  transponderNumber: string;
  nickName: string;
  location: string;
  status: string;
  option: string;
  startDateTime: string | null;
  endDateTime: string | null;
}

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

/** A group of I-77 tolls that occurred within the grouping window of each other. */
export interface Trip {
  start: string;
  end: string;
  total: number;
  transactions: TransactionView[];
}

export interface AuthState {
  authenticated: boolean;
  accountId?: string;
}
