/** Persisted values for the HOVDeclaration model, shared by the service and its tests. */

/** Lifecycle status of a materialized declaration row. */
export enum DeclarationStatus {
  Materialized = 'materialized',
  Canceled = 'canceled',
  Superseded = 'superseded',
}

/** How a declaration was derived. */
export enum DeclarationSource {
  Weekly = 'weekly',
  Adhoc = 'adhoc',
}
