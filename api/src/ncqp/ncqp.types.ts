/** Shapes for the NC Quick Pass upstream API (secure.ncquickpass.com). */

export interface NcqpTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  userName: string;
  /** Stringified JSON blob; see NcqpUserInfo. */
  UserInfo: string;
  [key: string]: unknown;
}

export interface NcqpUserInfo {
  UserID?: string | number;
  UserName?: string;
  AccountID?: string | number;
  WebUserId?: string | number;
  AccountTypeId?: number;
  [key: string]: unknown;
}

export interface NcqpAccountOverview {
  accountNumber?: string | number;
  currentBalance?: number;
  accountStatus?: string;
  [key: string]: unknown;
}

export interface NcqpVehicleTag {
  vehicleTagNumber?: string;
  tagFriendlyName?: string;
  vehicleTagStatus?: string;
  plateNumber?: string;
  plateStateShortName?: string;
  vehicleMakeName?: string;
  vehicleModelName?: string;
  vehicleYear?: number;
  tagTypeCache?: {
    tagNumber?: string;
    friendlyName?: string;
    tagStatus?: string;
    tag?: { tagNumberValue?: string; tagDisplayNumber?: string };
  };
  [key: string]: unknown;
}

export interface NcqpDeclaration {
  declarationId?: string | number;
  accountId?: string | number;
  transponderNumber?: string;
  location?: string;
  status?: string;
  option?: string;
  nickName?: string;
  startDateTime?: string;
  endDateTime?: string;
  [key: string]: unknown;
}

export interface NcqpTransaction {
  activityType?: number;
  activityTypeName?: string;
  exitLocation?: string;
  transactionDate?: string;
  transactionDisplayDateFormatted?: string;
  tagNumber?: string;
  debitAmount?: number;
  creditAmount?: number | null;
  formatDebitAmount?: string;
  balanceAmount?: number;
  transactionType?: string;
  custTrxnTypeID?: string;
  class?: string;
  axles?: number;
  total?: number;
  [key: string]: unknown;
}

export type HovOption = 'RestOfToday' | 'NextSevenDays' | 'DateInTheFuture';

export interface ActivateHovInput {
  accountId: string | number;
  transponderNumber: string;
  location: string;
  startDateTime: string;
  endDateTime: string | null;
  createdByUserId: string | number;
  option: HovOption;
}
