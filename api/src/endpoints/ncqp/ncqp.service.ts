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
} from '../../models/ncqp/ncqp.types';

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

  /**
   * Cancel an HOV declaration. Response body is the bare string "Canceled".
   *
   * NCQP's cancellation endpoint rejects non-browser clients: Node's `fetch`
   * defaults to `User-Agent: node`, which the upstream WAF/handler answers with
   * an empty 500. Sending a browser User-Agent (as the real site does) returns
   * 200. We authenticate the same way the browser does for this call — the JWT
   * in the `_tz` cookie plus a matching Origin/Referer — and use native fetch so
   * the bodyless PUT carries `Content-Length: 0` and no Content-Type (axios
   * forces `application/x-www-form-urlencoded`).
   */
  private static readonly BROWSER_UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36';

  async cancelHov(token: string, declarationId: string, userId: string): Promise<string> {
    const base = this.config.get<string>('NCQP_BASE_URL', 'https://secure.ncquickpass.com');
    const url =
      `${base}/external/api/v2/AccountManagementAPI/declarations/cancellation` +
      `?declarationId=${encodeURIComponent(declarationId)}&userId=${encodeURIComponent(userId)}`;
    try {
      const resp = await fetch(url, {
        method: 'PUT',
        // Empty byte body forces `Content-Length: 0` with no Content-Type.
        body: new Uint8Array(0),
        headers: {
          Accept: 'application/json',
          'User-Agent': NcqpService.BROWSER_UA,
          Cookie: `_tz=${token}`,
          Origin: base,
          Referer: `${base}/`,
        },
      });
      const text = await resp.text();
      if (!resp.ok) {
        this.logger.warn(`NCQP cancelHov -> ${resp.status} :: ${text.slice(0, 300)}`);
        if ([400, 401, 403].includes(resp.status)) {
          throw new UnauthorizedException('Failed to cancel HOV declaration');
        }
        throw new HttpException('Failed to cancel HOV declaration', resp.status);
      }
      return text.replace(/"/g, '') || 'Canceled';
    } catch (e) {
      if (e instanceof HttpException) throw e;
      this.logger.error(`NCQP cancelHov failed: ${(e as Error).message}`);
      throw new InternalServerErrorException('Failed to cancel HOV declaration');
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
      const body =
        typeof err.response.data === 'string'
          ? err.response.data
          : JSON.stringify(err.response.data);
      this.logger.warn(`NCQP ${op} -> ${status} :: ${(body ?? '').slice(0, 300)}`);
      if (status === 400 || status === 401 || status === 403) {
        return new UnauthorizedException(message);
      }
      return new HttpException(message, status);
    }
    this.logger.error(`NCQP ${op} failed: ${err?.message ?? 'unknown error'}`);
    return new InternalServerErrorException(message);
  }
}
