import { TollExceptionsService } from '../../../src/endpoints/toll-exceptions/toll-exceptions.service';
import { NcqpAccountClient } from '../../../src/endpoints/ncqp/ncqp-account.client';
import { NcqpCasesClient } from '../../../src/endpoints/ncqp/ncqp-cases.client';
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
  };
  const service = new TollExceptionsService(
    account as unknown as NcqpAccountClient,
    cases as unknown as NcqpCasesClient,
  );
  return { account, cases, service };
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
});
