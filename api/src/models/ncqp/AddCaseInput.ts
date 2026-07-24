/** Body for `CaseManagementAPI/AddCase` — attaches transactions to a case. */
export interface AddCaseInput {
  id: string;
  accountId: string;
  caseId: number;
  caseInfos: {
    createdDate: string;
    caseTabs: { name: string; data: { detailTransactionID: string }[] }[];
  };
}
