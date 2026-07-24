/** A case as returned by `CaseManagementAPI/GetCaseByTrxn` (keyed by a transaction). */
export interface NcqpCase {
  caseId?: number;
  caseInfos?: {
    /** When the case was created (UTC ISO); used to match a case to its dispute. */
    createdDate?: string;
    caseTabs?: { data?: { detailTransactionID?: string }[] }[];
  };
  [key: string]: unknown;
}
