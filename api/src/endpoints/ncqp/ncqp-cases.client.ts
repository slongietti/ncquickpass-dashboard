import { HttpException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NcqpClient } from './ncqp-client.base';
import { AddCaseInput } from '../../models/ncqp/AddCaseInput';
import { NcqpCase } from '../../models/ncqp/NcqpCase';
import { NcqpCaseType } from '../../models/ncqp/NcqpCaseType';
import { NcqpDisputeReason } from '../../models/ncqp/NcqpDisputeReason';
import { TracerTicketInput } from '../../models/ncqp/TracerTicketInput';

/** Case/dispute NC Quick Pass calls: reasons, case type, ticket, open case, attach transactions. */
@Injectable()
export class NcqpCasesClient extends NcqpClient {
  constructor(config: ConfigService) {
    super(config);
  }

  /** All dispute reasons from the NCQP cache (reasonID + label). */
  async getDisputeReasons(token: string): Promise<NcqpDisputeReason[]> {
    try {
      const res = await this.http.get<NcqpDisputeReason[]>(
        '/external/api/v2/CacheManagerAPI/GetAllDisputeReasons',
        { headers: this.authHeaders(token) },
      );
      return Array.isArray(res.data) ? res.data : [];
    } catch (e) {
      throw this.mapError(e, 'Failed to load dispute reasons', 'getDisputeReasons');
    }
  }

  /** Case-type metadata (e.g. "Account Dispute"): the caseTypeId and its topics. */
  async getCaseTypeId(token: string, typeName = 'Account Dispute'): Promise<NcqpCaseType> {
    try {
      const res = await this.http.get<NcqpCaseType>(
        `/external/api/v2/AMS/CaseManagement/GetCaseTypeId/${encodeURIComponent(typeName)}`,
        { headers: this.authHeaders(token) },
      );
      return res.data;
    } catch (e) {
      throw this.mapError(e, 'Failed to load case type', 'getCaseTypeId');
    }
  }

  /** Server-generated ticket number used when opening a dispute case. */
  async generateTicketNumber(token: string): Promise<string> {
    try {
      const res = await this.http.get<string>(
        '/external/api/v2/TicketManagementAPI/GenerateTicketNumber',
        { headers: this.authHeaders(token) },
      );
      return String(res.data).replace(/"/g, '').trim();
    } catch (e) {
      throw this.mapError(e, 'Failed to generate ticket number', 'generateTicketNumber');
    }
  }

  /** Open a dispute case. Response body is the new numeric caseId. */
  async createTracerTicket(token: string, input: TracerTicketInput): Promise<number> {
    try {
      const res = await this.http.post(
        '/external/api/v2/TicketManagementAPI/TracerTickets',
        input,
        { headers: { ...this.authHeaders(token), 'Content-Type': 'application/json' } },
      );
      const data: unknown = res.data;
      const id = typeof data === 'number' ? data : parseInt(String(data).trim(), 10);
      if (Number.isNaN(id)) {
        throw new InternalServerErrorException('Dispute creation returned an unexpected response');
      }
      return id;
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw this.mapError(e, 'Failed to open dispute case', 'createTracerTicket');
    }
  }

  /**
   * The case a transaction belongs to (by its detailTransactionID), including the
   * case's other transactions and its createdDate. Returns null when the toll isn't
   * part of a case — that's an empty 200, not an error, so it never fails a batch.
   */
  async getCaseByTrxn(token: string, detailTransactionId: string): Promise<NcqpCase | null> {
    try {
      const res = await this.http.get<NcqpCase | ''>(
        `/external/api/v2/CaseManagementAPI/GetCaseByTrxn/${encodeURIComponent(detailTransactionId)}`,
        { headers: this.authHeaders(token) },
      );
      const data = res.data;
      return data && typeof data === 'object' && (data as NcqpCase).caseId != null
        ? (data as NcqpCase)
        : null;
    } catch {
      return null;
    }
  }

  /** Attach transactions to a case created by createTracerTicket. Empty 200 on success. */
  async addCase(token: string, input: AddCaseInput): Promise<void> {
    try {
      await this.http.post('/external/api/v2/CaseManagementAPI/AddCase', input, {
        headers: { ...this.authHeaders(token), 'Content-Type': 'application/json' },
      });
    } catch (e) {
      throw this.mapError(e, 'Failed to attach transactions to dispute', 'addCase');
    }
  }
}
