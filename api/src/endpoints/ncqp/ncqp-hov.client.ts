import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NcqpClient } from './ncqp-client.base';
import { ActivateHovInput } from '../../models/ncqp/ActivateHovInput';
import { NcqpDeclaration } from '../../models/ncqp/NcqpDeclaration';

/** A browser UA — NCQP's WAF answers non-browser clients with an empty 500 on cancel. */
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36';

/** HOV declaration NC Quick Pass calls: list, activate, cancel. */
@Injectable()
export class NcqpHovClient extends NcqpClient {
  constructor(config: ConfigService) {
    super(config);
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
          'User-Agent': BROWSER_UA,
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
}
