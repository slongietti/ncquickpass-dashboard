/** Body for `TicketManagementAPI/TracerTickets` — opens the dispute case. */
export interface TracerTicketInput {
  ticketNumber: string;
  caseTypeId: number;
  caseTopicId: number;
  caseTitle: string;
  priorityLevelID: number;
  reasonID: number;
  caseStatusId: number;
  communicationMethodID: number;
  languagePreference: number;
  ticketTypeID: number;
  sourceID: number;
  biNoticeID: number;
  accountId: string;
  notes: string;
  updateUserID: number;
  queueID: number;
}
