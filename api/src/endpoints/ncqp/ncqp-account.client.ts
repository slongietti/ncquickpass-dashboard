import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NcqpClient } from './ncqp-client.base';
import { NcqpAccountOverview } from '../../models/ncqp/NcqpAccountOverview';
import { NcqpCorrespondence } from '../../models/ncqp/NcqpCorrespondence';
import { NcqpTokenResponse } from '../../models/ncqp/NcqpTokenResponse';
import { NcqpVehicleTag } from '../../models/ncqp/NcqpVehicleTag';

/** Account-level NC Quick Pass calls: auth, overview, vehicles, correspondence, documents. */
@Injectable()
export class NcqpAccountClient extends NcqpClient {
  constructor(config: ConfigService) {
    super(config);
  }

  /** OAuth2 password grant. Returns the token payload (incl. stringified UserInfo). */
  async login(username: string, password: string): Promise<NcqpTokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'password',
      username,
      password,
      client_id: this.clientId,
      twoFactorAuthCode: '',
      Scope: 'undefined',
      source: 'User Login',
    });
    try {
      const res = await this.http.put<NcqpTokenResponse>('/external/token', body.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json, text/plain, */*',
        },
      });
      return res.data;
    } catch (e) {
      throw this.mapError(e, 'Invalid username or password', 'login');
    }
  }

  async getAccountOverview(token: string, from: string, to: string): Promise<NcqpAccountOverview> {
    try {
      const res = await this.http.get<NcqpAccountOverview>(
        `/external/api/v2/AccountManagementAPI/GetAccountOverviewSummary/${from}/${to}`,
        { headers: this.authHeaders(token) },
      );
      return res.data;
    } catch (e) {
      throw this.mapError(e, 'Failed to load account overview', 'getAccountOverview');
    }
  }

  async getVehicles(token: string): Promise<NcqpVehicleTag[]> {
    try {
      const res = await this.http.get<NcqpVehicleTag[]>(
        '/external/api/v2/AccountManagementAPI/CustomerVehiclesPagingSorting/search',
        {
          headers: this.authHeaders(token),
          params: { bEffectiveOnly: false, bVehiclesOnly: false, bTransponderOnly: false },
        },
      );
      return Array.isArray(res.data) ? res.data : [];
    } catch (e) {
      throw this.mapError(e, 'Failed to load vehicles', 'getVehicles');
    }
  }

  /**
   * The account's customer correspondence log (emails + web alerts). PII-heavy —
   * callers must parse and drop the raw bodies before returning anything to the SPA.
   */
  async searchCorrespondence(
    token: string,
    accountId: string,
    take = 999,
  ): Promise<NcqpCorrespondence[]> {
    try {
      const res = await this.http.get<NcqpCorrespondence[]>(
        '/external/api/v2/AccountManagementAPI/AccountsCorrespondenceSearch/search',
        { headers: this.authHeaders(token), params: { skip: 0, take, accountId } },
      );
      return Array.isArray(res.data) ? res.data : [];
    } catch (e) {
      throw this.mapError(e, 'Failed to load correspondence', 'searchCorrespondence');
    }
  }

  /** Stream a correspondence document (image or PDF) by its documentID. */
  async getDocumentStream(
    token: string,
    documentId: string,
  ): Promise<{ data: Buffer; contentType: string; filename: string }> {
    try {
      const res = await this.http.get<ArrayBuffer>(
        `/external/api/v2/AccountManagementAPI/GeneratePDFFileStream/${encodeURIComponent(documentId)}`,
        { headers: { ...this.authHeaders(token), Accept: '*/*' }, responseType: 'arraybuffer' },
      );
      const disposition = String(res.headers['content-disposition'] ?? '');
      const match = /filename=([^;]+)/i.exec(disposition);
      const filename = match && match[1] ? match[1].trim() : `document-${documentId}`;
      return {
        data: Buffer.from(res.data),
        contentType: String(res.headers['content-type'] ?? 'application/octet-stream'),
        filename,
      };
    } catch (e) {
      throw this.mapError(e, 'Failed to load document', 'getDocumentStream');
    }
  }
}
