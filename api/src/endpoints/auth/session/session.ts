export const SESSION_COOKIE = 'ncqp_session';

/**
 * The server-side session. Serialized to JSON and stored in a signed, HttpOnly
 * cookie so the browser holds it but JavaScript can never read the token.
 */
export interface NcqpSession {
  /** NCQP bearer JWT. */
  token: string;
  /** WebUserId — needed for HOV cancel / createdByUserId. */
  userId: string;
  /** Account number — needed for HOV declarations. */
  accountId: string;
  /** NCQP login name — stored so the schedule vault can re-authenticate later. */
  username: string;
  /** Absolute expiry, epoch ms. */
  exp: number;
}

export function isSessionValid(s: NcqpSession | null | undefined): s is NcqpSession {
  return !!s && typeof s.token === 'string' && s.token.length > 0 && s.exp > Date.now();
}

export function parseSession(raw: unknown): NcqpSession | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  try {
    return JSON.parse(raw) as NcqpSession;
  } catch {
    return null;
  }
}
