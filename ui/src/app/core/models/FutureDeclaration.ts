/** A scheduled (materialized) NCQP declaration, as returned by the schedule API. */
export interface FutureDeclaration {
  id: string;
  transponderNumber: string;
  windowStart: string; // ISO
  windowEnd: string; // ISO
  status: string;
  /** How it was derived: 'weekly' schedule or 'adhoc'. */
  source: string;
  ncqpDeclarationId: string | null;
}
