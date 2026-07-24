import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NcqpClient } from './ncqp-client.base';
import { NcqpTransaction } from '../../models/ncqp/NcqpTransaction';

/** Transaction/activity-history NC Quick Pass calls. */
@Injectable()
export class NcqpTransactionsClient extends NcqpClient {
  constructor(config: ConfigService) {
    super(config);
  }

  async searchTransactions(
    token: string,
    startDate: string,
    endDate: string,
    skip: number,
    take: number,
  ): Promise<NcqpTransaction[]> {
    try {
      const res = await this.http.get<NcqpTransaction[]>(
        '/external/api/v2/AccountManagementAPI/TransactionSearchAccountingPageExternal/search',
        {
          headers: this.authHeaders(token),
          params: { skip, take, startDate, endDate, display: 5, ViewByTransactionDate: true },
        },
      );
      return Array.isArray(res.data) ? res.data : [];
    } catch (e) {
      throw this.mapError(e, 'Failed to search transactions', 'searchTransactions');
    }
  }
}
