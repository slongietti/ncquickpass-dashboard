/** OAuth2 token payload returned by NC Quick Pass on login. */
export interface NcqpTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  userName: string;
  /** Stringified JSON blob; see NcqpUserInfo. */
  UserInfo: string;
  [key: string]: unknown;
}
