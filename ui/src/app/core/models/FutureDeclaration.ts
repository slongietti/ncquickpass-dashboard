/** A scheduled (materialized) NCQP declaration, as returned by the schedule API. */
export interface FutureDeclaration {
  id: string;
  transponderNumber: string;
  windowStart: string; // ISO
  windowEnd: string; // ISO
  status: string;
  ncqpDeclarationId: string | null;
}
