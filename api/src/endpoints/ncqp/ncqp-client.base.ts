import {
  HttpException,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosInstance } from 'axios';

/**
 * Shared plumbing for the per-domain NC Quick Pass clients: one axios instance
 * (base URL + timeout), bearer-auth headers, and secret-safe error mapping. All
 * calls run server-to-server so the browser never talks to secure.ncquickpass.com
 * directly and the bearer token never reaches client JavaScript. Subclasses add
 * the domain calls.
 */
export abstract class NcqpClient {
  protected readonly logger = new Logger(this.constructor.name);
  protected readonly http: AxiosInstance;
  protected readonly clientId: string;

  protected constructor(protected readonly config: ConfigService) {
    this.http = axios.create({
      baseURL: this.config.get<string>('NCQP_BASE_URL', 'https://secure.ncquickpass.com'),
      timeout: 20000,
    });
    this.clientId = this.config.get<string>('NCQP_CLIENT_ID', 'AMSExternalngAuthApp');
  }

  protected authHeaders(token: string): Record<string, string> {
    return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  }

  /**
   * Map an upstream failure to a Nest HTTP exception WITHOUT leaking secrets.
   * Only the status code and a generic message are surfaced/logged — never the
   * request body (which may contain credentials) or the bearer token.
   */
  protected mapError(e: unknown, message: string, op: string): HttpException {
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
