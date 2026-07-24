import { parseDisputes } from '../../../src/endpoints/toll-exceptions/dispute-correspondence';
import { NcqpCorrespondence } from '../../../src/models/ncqp/NcqpCorrespondence';

const created = (caseNumber: string, timestamp: string): NcqpCorrespondence => ({
  displayName: 'Customer Case Created Confirmation',
  timestamp,
  emailText: `Thank you for contacting us. Your case has been created and the case ID is ${caseNumber}.`,
});

const updated = (
  caseNumber: string,
  timestamp: string,
  status: string,
  notes: string,
): NcqpCorrespondence => ({
  displayName: 'Case Updated',
  timestamp,
  emailText:
    `<p>We have responded to case number: ${caseNumber}</p>` +
    `<p><b>Case Status:</b> ${status}</p><p><b>Case Topic:</b> Toll Dispute</p>` +
    `<p><b>Case Notes:</b> ${notes}</p><p>Thank you for your business.</p>`,
});

const attachment = (caseNumber: string, documentID: number): NcqpCorrespondence => ({
  displayName: `${caseNumber}.png`,
  fileLocation: 'TracerTicketDocument',
  documentID,
  timestamp: '2024-10-15T09:56:20Z',
});

describe('parseDisputes', () => {
  it('parseDisputes_createdConfirmationOnly_isFiledUnderReview', () => {
    const [dispute] = parseDisputes([created('1707135', '2026-07-23T23:05:03Z')]);
    expect(dispute.caseNumber).toBe('1707135');
    expect(dispute.status).toBe('Filed');
    expect(dispute.decision).toBe('under_review');
    expect(dispute.notes).toHaveLength(1);
    expect(dispute.createdDate).toBe('2026-07-23T23:05:03Z');
  });

  it('parseDisputes_caseUpdatedClosedWithDenial_isDenied', () => {
    const rows = [
      created('1322705', '2024-10-09T08:45:19Z'),
      updated(
        '1322705',
        '2024-10-16T15:55:04Z',
        'Closed',
        'After review we must deny your dispute. This is a final agency decision.',
      ),
    ];
    const [dispute] = parseDisputes(rows);
    expect(dispute.status).toBe('Closed');
    expect(dispute.decision).toBe('denied');
    expect(dispute.notes).toHaveLength(2);
    const text = dispute.notes.map((n) => n.text).join(' ');
    expect(text).toContain('deny your dispute');
    expect(text).not.toContain('Thank you for your business');
  });

  it('parseDisputes_caseUpdatedClosedWithCredit_isApproved', () => {
    const rows = [
      updated('900', '2024-10-16T15:55:04Z', 'Closed', 'We have issued a credit to your account.'),
    ];
    const [dispute] = parseDisputes(rows);
    expect(dispute.decision).toBe('approved');
  });

  it('parseDisputes_multipleUpdates_usesHighestStatus', () => {
    const rows = [
      created('55', '2024-10-09T08:45:19Z'),
      updated('55', '2024-10-10T09:00:00Z', 'Open', 'We are reviewing your request.'),
      updated('55', '2024-10-16T15:55:04Z', 'Closed', 'We must deny your dispute.'),
    ];
    const [dispute] = parseDisputes(rows);
    expect(dispute.status).toBe('Closed');
    expect(dispute.decision).toBe('denied');
    expect(dispute.notes).toHaveLength(3);
  });

  it('parseDisputes_emailAndWebAlertSameEvent_keepsRicherNote', () => {
    // Same notification event (shared queueNotificationRequestID), delivered twice —
    // keep the full Email body, not the short Web Alert pointer.
    const rows: NcqpCorrespondence[] = [
      {
        displayName: 'Case Updated',
        deliveryType: 'Web Alert',
        queueNotificationRequestID: 42,
        timestamp: '2024-10-16T15:55:04.21Z',
        webAlertText: 'We have responded to your recent case. View the comment section of case ID 700 for details.',
      },
      {
        displayName: 'Case Updated',
        deliveryType: 'Email',
        queueNotificationRequestID: 42,
        timestamp: '2024-10-16T15:55:04.207Z',
        emailText:
          'We have responded to case number: 700 <b>Case Status:</b> Closed ' +
          '<b>Case Notes:</b> We must deny your dispute.',
      },
    ];
    const [dispute] = parseDisputes(rows);
    expect(dispute.notes).toHaveLength(1);
    expect(dispute.notes[0].text).toContain('deny your dispute');
    expect(dispute.status).toBe('Closed');
  });

  it('parseDisputes_attachmentRow_capturesDocumentId', () => {
    const rows = [created('1322705', '2024-10-09T08:45:19Z'), attachment('1322705', 325378796)];
    const [dispute] = parseDisputes(rows);
    expect(dispute.attachmentDocumentId).toBe('325378796');
  });

  it('parseDisputes_multipleCases_returnsNewestFirst', () => {
    const rows = [
      created('100', '2024-01-01T00:00:00Z'),
      created('200', '2026-01-01T00:00:00Z'),
    ];
    const disputes = parseDisputes(rows);
    expect(disputes.map((d) => d.caseNumber)).toEqual(['200', '100']);
  });

  it('parseDisputes_nonCaseCorrespondence_isIgnored', () => {
    const rows: NcqpCorrespondence[] = [
      { displayName: 'Payment Confirmation', emailText: 'Your payment of $20.00 has been received.' },
    ];
    expect(parseDisputes(rows)).toEqual([]);
  });
});
