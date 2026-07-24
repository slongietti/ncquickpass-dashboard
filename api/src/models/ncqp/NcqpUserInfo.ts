/** The stringified `UserInfo` blob inside NcqpTokenResponse, once parsed. */
export interface NcqpUserInfo {
  UserID?: string | number;
  UserName?: string;
  AccountID?: string | number;
  WebUserId?: string | number;
  AccountTypeId?: number;
  [key: string]: unknown;
}
