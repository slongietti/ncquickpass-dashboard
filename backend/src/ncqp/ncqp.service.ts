import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosInstance } from 'axios';
import {
  ActivateHovInput,
  NcqpAccountOverview,
  NcqpDeclaration,
  NcqpTokenResponse,
  NcqpTransaction,
  NcqpVehicleTag,
} from './ncqp.types';

/**
 * Server-to-server client for the NC Quick Pass API. All calls run from the
 * backend so the browser never talks to secure.ncquickpass.com directly
 * (avoids CORS) and the bearer token never reaches client JavaScript.
 */
@Injectable()
export class NcqpService {
  private readonly logger = new Logger(NcqpService.name);
  private readonly http: AxiosInstance;
  private readonly clientId: string;

  constructor(private readonly config: ConfigService) {
    this.http = axios.create({
      baseURL: this.config.get<string>('NCQP_BASE_URL', 'https://secure.ncquickpass.com'),
      timeout: 20000,
    });
    this.clientId = this.config.get<string>('NCQP_CLIENT_ID', 'AMSExternalngAuthApp');
  }

  private authHeaders(token: string): Record<string, string> {
    return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
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

  async getAccountOverview(
    token: string,
    from: string,
    to: string,
  ): Promise<NcqpAccountOverview> {
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

  async getHovDeclarations(token: string, accountId: string): Promise<NcqpDeclaration[]> {
    try {
      const res = await this.http.get<NcqpDeclaration[]>(
        `/external/api/v2/AccountManagementAPI/declarations/account/statuses/${accountId}`,
        {
          headers: this.authHeaders(token),
          // statuses repeats twice: submitted + active
          params: new URLSearchParams([
            ['statuses', 'submitted'],
            ['statuses', 'active'],
            ['isUniversalTime', 'false'],
          ]),
        },
      );
      return Array.isArray(res.data) ? res.data : [];
    } catch (e) {
      throw this.mapError(e, 'Failed to load HOV declarations', 'getHovDeclarations');
    }
  }

  /** Create/activate an HOV declaration. Response body is the new declaration id. */
  async activateHov(token: string, input: ActivateHovInput): Promise<number> {
    try {
      const res = await this.http.post(
        '/external/api/v2/AccountManagementAPI/declarations/activation',
        input,
        { headers: { ...this.authHeaders(token), 'Content-Type': 'application/json' } },
      );
      const data: unknown = res.data;
      const id = typeof data === 'number' ? data : parseInt(String(data).trim(), 10);
      if (Number.isNaN(id)) {
        throw new InternalServerErrorException('HOV activation returned an unexpected response');
      }
      return id;
    } catch (e) {
      throw this.mapError(e, 'Failed to activate HOV declaration', 'activateHov');
    }
  }

  /** Cancel an HOV declaration. Response body is the bare string "Canceled". */
  async cancelHov(token: string, declarationId: string, userId: string): Promise<string> {
    try {
      const res = await this.http.put(
        '/external/api/v2/AccountManagementAPI/declarations/cancellation',
        null,
        { headers: this.authHeaders(token), params: { declarationId, userId } },
      );
      return typeof res.data === 'string' ? res.data.replace(/"/g, '') : 'Canceled';
    } catch (e) {
      throw this.mapError(e, 'Failed to cancel HOV declaration', 'cancelHov');
    }
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
          params: {
            skip,
            take,
            startDate,
            endDate,
            display: 5,
            ViewByTransactionDate: true,
          },
        },
      );
      return Array.isArray(res.data) ? res.data : [];
    } catch (e) {
      throw this.mapError(e, 'Failed to search transactions', 'searchTransactions');
    }
  }

  /**
   * Map an upstream failure to a Nest HTTP exception WITHOUT leaking secrets.
   * Only the status code and a generic message are surfaced/logged — never the
   * request body (which may contain credentials) or the bearer token.
   */
  private mapError(e: unknown, message: string, op: string): HttpException {
    const err = e as AxiosError;
    if (err?.isAxiosError && err.response) {
      const status = err.response.status;
      this.logger.warn(`NCQP ${op} -> ${status}`);
      if (status === 400 || status === 401 || status === 403) {
        return new UnauthorizedException(message);
      }
      return new HttpException(message, status);
    }
    this.logger.error(`NCQP ${op} failed: ${err?.message ?? 'unknown error'}`);
    return new InternalServerErrorException(message);
  }
}
