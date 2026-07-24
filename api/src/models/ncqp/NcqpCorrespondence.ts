/**
 * A customer correspondence record (email / web alert). NCQP has no dispute-status
 * API; case creation and agency responses are delivered here, keyed by case number
 * inside the HTML `emailText`.
 */
export interface NcqpCorrespondence {
  documentID?: number;
  entityID?: string | number;
  displayName?: string;
  documentTypeID?: number;
  documentTypeName?: string;
  fileLocation?: string;
  fileName?: string;
  /** HTML body; carries the case number, status, and agency decision notes. */
  emailText?: string;
  webAlertText?: string;
  deliveryType?: string;
  timestamp?: string;
  /** Groups the Email and Web Alert copies of the same notification event. */
  queueNotificationRequestID?: number;
  [key: string]: unknown;
}
