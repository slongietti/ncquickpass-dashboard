import { TollExceptionsService } from '../../../src/endpoints/toll-exceptions/toll-exceptions.service';
import { NcqpAccountClient } from '../../../src/endpoints/ncqp/ncqp-account.client';
import { NcqpCasesClient } from '../../../src/endpoints/ncqp/ncqp-cases.client';
import { NcqpTransactionsClient } from '../../../src/endpoints/ncqp/ncqp-transactions.client';
import { NcqpSession } from '../../../src/endpoints/auth/session/session';

const SESSION = { token: 't', userId: 'u', accountId: 'ACC' } as unknown as NcqpSession;

function makeMocks() {
  const account = {
    searchCorrespondence: jest.fn().mockResolvedValue([]),
    getDocumentStream: jest.fn(),
  };
  const cases = {
    getDisputeReasons: jest.fn().mockResolvedValue([
      { reasonID: 7, reason: 'IAG - MAXIMUM TOLL' },
      { reasonID: 43, reason: 'HOV Declaration' },
      { reasonID: 38, reason: 'Exempt' },
      { reasonID: 22, reason: 'Duplicate' },
    ]),
    getCaseTypeId: jest.fn().mockResolvedValue({
      id: 16,
      typeName: 'Account Dispute',
      caseTopics: [{ id: 63, topicName: 'Toll Dispute' }],
    }),
    generateTicketNumber: jest.fn().mockResolvedValue('1707135'),
    createTracerTicket: jest.fn().mockResolvedValue(1601460),
    addCase: jest.fn().mockResolvedValue(undefined),
    getCaseByTrxn: jest.fn().mockResolvedValue(null),
  };
  const transactions = { searchTransactions: jest.fn().mockResolvedValue([]) };
  const service = new TollExceptionsService(
    account as unknown as NcqpAccountClient,
    cases as unknown as NcqpCasesClient,
    transactions as unknown as NcqpTransactionsClient,
  );
  return { account, cases, transactions, service };
}

describe('TollExceptionsService.getReasons', () => {
  it('getReasons_fullReasonList_returnsCuratedSubsetDefaultFirst', async () => {
    const { service } = makeMocks();
    const reasons = await service.getReasons(SESSION);
    // Curated order keeps 43 first; internal IAG reason (7) is dropped.
    expect(reasons).toEqual([
      { reasonId: 43, label: 'HOV Declaration' },
      { reasonId: 38, label: 'Exempt' },
      { reasonId: 22, label: 'Duplicate' },
    ]);
  });
});

describe('TollExceptionsService.createDispute', () => {
  it('createDispute_selectedTransactions_opensCaseThenAttachesThem', async () => {
    const { cases, service } = makeMocks();
    const result = await service.createDispute(SESSION, {
      reasonId: 43,
      comments: 'HOV was active',
      detailTransactionIds: ['a', 'b'],
    });

    expect(cases.createTracerTicket).toHaveBeenCalledWith(
      't',
      expect.objectContaining({
        ticketNumber: '1707135',
        caseTypeId: 16,
        caseTopicId: 63,
        caseTitle: 'HOV Declaration',
        reasonID: 43,
        accountId: 'ACC',
        notes: 'Comments: HOV was active',
        queueID: 9006,
      }),
    );
    expect(cases.addCase).toHaveBeenCalledWith(
      't',
      expect.objectContaining({
        accountId: 'ACC',
        caseId: 1601460,
        caseInfos: expect.objectContaining({
          caseTabs: [
            {
              name: 'Transaction Tab',
              data: [{ detailTransactionID: 'a' }, { detailTransactionID: 'b' }],
            },
          ],
        }),
      }),
    );
    expect(result).toEqual({ caseNumber: '1707135', caseId: 1601460 });
  });

  it('createDispute_opensCaseBeforeAttaching_ordersCalls', async () => {
    const { cases, service } = makeMocks();
    const order: string[] = [];
    cases.createTracerTicket.mockImplementation(() => {
      order.push('tracer');
      return Promise.resolve(1601460);
    });
    cases.addCase.mockImplementation(() => {
      order.push('addCase');
      return Promise.resolve(undefined);
    });
    await service.createDispute(SESSION, {
      reasonId: 43,
      comments: 'x',
      detailTransactionIds: ['a'],
    });
    expect(order).toEqual(['tracer', 'addCase']);
  });
});

describe('TollExceptionsService.getDisputes', () => {
  it('getDisputes_correspondenceWithCase_returnsParsedDispute', async () => {
    const { account, service } = makeMocks();
    account.searchCorrespondence.mockResolvedValue([
      {
        displayName: 'Customer Case Created Confirmation',
        timestamp: '2026-07-23T23:05:03Z',
        emailText: 'Your case has been created and the case ID is 1707135.',
      },
    ]);
    const disputes = await service.getDisputes(SESSION);
    expect(disputes).toHaveLength(1);
    expect(disputes[0].caseNumber).toBe('1707135');
    expect(disputes[0].status).toBe('Filed');
  });

  it('getDisputes_caseCreatedWithinFiveMinutes_itemizesTollsByTxnId', async () => {
    const { account, transactions, cases, service } = makeMocks();
    account.searchCorrespondence.mockResolvedValue([
      {
        displayName: 'Customer Case Created Confirmation',
        // Zone-less Eastern: 08:45:19 EDT = 12:45:19Z.
        timestamp: '2024-10-09T08:45:19',
        emailText: 'Your case has been created and the case ID is 1322705.',
      },
    ]);
    transactions.searchTransactions.mockResolvedValue([
      { activityTypeName: 'Toll', detailTransactionID: 'A', exitLocation: 'Exit 1', transactionDate: '2024-10-08T10:00:00', debitAmount: 4.5 },
      { activityTypeName: 'Toll', detailTransactionID: 'B', exitLocation: 'Exit 2', transactionDate: '2024-10-08T10:03:00', debitAmount: 2.0 },
    ]);
    cases.getCaseByTrxn.mockResolvedValue({
      caseId: 1601460,
      caseInfos: {
        createdDate: '2024-10-09T12:45:30.000Z', // 11s from the dispute
        caseTabs: [{ data: [{ detailTransactionID: 'A' }, { detailTransactionID: 'B' }] }],
      },
    });
    const [dispute] = await service.getDisputes(SESSION);
    expect(dispute.total).toBe(6.5);
    expect(dispute.transactions).toEqual([
      { exitLocation: 'Exit 1', transactionDate: '2024-10-08T10:00:00', debitAmount: 4.5 },
      { exitLocation: 'Exit 2', transactionDate: '2024-10-08T10:03:00', debitAmount: 2.0 },
    ]);
  });

  it('getDisputes_caseOutsideFiveMinutes_leavesTollsEmpty', async () => {
    const { account, transactions, cases, service } = makeMocks();
    account.searchCorrespondence.mockResolvedValue([
      { displayName: 'Customer Case Created Confirmation', timestamp: '2024-10-09T08:45:19', emailText: 'case ID is 1322705.' },
    ]);
    transactions.searchTransactions.mockResolvedValue([
      { activityTypeName: 'Toll', detailTransactionID: 'A', exitLocation: 'Exit 1', transactionDate: '2024-10-08T10:00:00', debitAmount: 4.5 },
    ]);
    cases.getCaseByTrxn.mockResolvedValue({
      caseId: 1601460,
      // ~45 min from the dispute -> outside the window.
      caseInfos: { createdDate: '2024-10-09T13:30:00.000Z', caseTabs: [{ data: [{ detailTransactionID: 'A' }] }] },
    });
    const [dispute] = await service.getDisputes(SESSION);
    expect(dispute.transactions).toEqual([]);
    expect(dispute.total).toBe(0);
  });
});
