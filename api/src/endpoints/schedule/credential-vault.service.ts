import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';

export interface NcqpCredentials {
  username: string;
  password: string;
}

const ENCRYPTION_PURPOSE = 'ncqp-creds';

type Backend = 'kms' | 'local' | 'none';

interface KmsClient {
  encrypt: (keyring: unknown, plaintext: string, opts: { encryptionContext: Record<string, string> }) => Promise<{ result: Buffer }>;
  decrypt: (
    keyring: unknown,
    ciphertext: Buffer,
  ) => Promise<{ plaintext: Buffer; messageHeader: { encryptionContext: Record<string, string> } }>;
  encryptKeyring: unknown;
  decryptKeyring: unknown;
}

/**
 * Stores NCQP credentials encrypted at rest so the unattended cron can
 * re-authenticate on a tenant's behalf. Two backends, chosen by config:
 *
 * - **KMS** (CREDENTIAL_KEY_ARN set): AWS KMS envelope encryption via the AWS
 *   Encryption SDK. The key never leaves KMS; decryption is governed by the KMS
 *   key policy (grant only the job role — no human principals), and every
 *   decrypt is logged to CloudTrail with the tenant's accountId as encryption
 *   context. This is the production posture.
 * - **local** (SCHEDULE_ENCRYPTION_KEY set): AES-256-GCM with a key from the
 *   environment. For local/dev only — anyone who can read the environment can
 *   decrypt.
 *
 * Plaintext exists only transiently in memory and is never logged or returned to
 * clients. If neither backend is configured, credential storage is disabled.
 */
@Injectable()
export class CredentialVaultService {
  private readonly logger = new Logger(CredentialVaultService.name);
  private readonly keyArn: string | null;
  private readonly localKey: Buffer | null;
  private kms?: KmsClient;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.keyArn = this.config.get<string>('CREDENTIAL_KEY_ARN') || null;
    const raw = this.config.get<string>('SCHEDULE_ENCRYPTION_KEY') ?? '';
    this.localKey = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : null;

    if (this.backend === 'none') {
      this.logger.warn(
        'No credential encryption configured (CREDENTIAL_KEY_ARN or SCHEDULE_ENCRYPTION_KEY) — storage disabled',
      );
    } else {
      this.logger.log(`Credential vault backend: ${this.backend}`);
    }
  }

  get backend(): Backend {
    if (this.keyArn) return 'kms';
    if (this.localKey) return 'local';
    return 'none';
  }

  get enabled(): boolean {
    return this.backend !== 'none';
  }

  async has(accountId: string): Promise<boolean> {
    return (await this.prisma.credential.count({ where: { accountId } })) > 0;
  }

  async store(accountId: string, username: string, password: string): Promise<void> {
    const plaintext = JSON.stringify({ username, password });
    let data: { ciphertext: string; iv: string; authTag: string };

    if (this.backend === 'kms') {
      data = { ciphertext: await this.kmsEncrypt(accountId, plaintext), iv: '', authTag: '' };
    } else if (this.backend === 'local') {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', this.localKey!, iv);
      const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      data = {
        ciphertext: ciphertext.toString('base64'),
        iv: iv.toString('base64'),
        authTag: cipher.getAuthTag().toString('base64'),
      };
    } else {
      throw new Error('Credential storage is not configured');
    }

    await this.prisma.credential.upsert({
      where: { accountId },
      create: { accountId, ...data },
      update: data,
    });
  }

  async load(accountId: string): Promise<NcqpCredentials | null> {
    const row = await this.prisma.credential.findUnique({ where: { accountId } });
    if (!row) return null;

    // A local-AES row carries iv + authTag; a KMS row stores everything in the blob.
    const isLocal = row.iv !== '' && row.authTag !== '';
    let plaintext: string;
    if (isLocal) {
      if (!this.localKey) throw new Error('SCHEDULE_ENCRYPTION_KEY required to decrypt this credential');
      const decipher = createDecipheriv('aes-256-gcm', this.localKey, Buffer.from(row.iv, 'base64'));
      decipher.setAuthTag(Buffer.from(row.authTag, 'base64'));
      plaintext = Buffer.concat([
        decipher.update(Buffer.from(row.ciphertext, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } else {
      if (!this.keyArn) throw new Error('CREDENTIAL_KEY_ARN required to decrypt this credential');
      plaintext = await this.kmsDecrypt(accountId, row.ciphertext);
    }
    return JSON.parse(plaintext) as NcqpCredentials;
  }

  async remove(accountId: string): Promise<void> {
    await this.prisma.credential.deleteMany({ where: { accountId } });
  }

  private contextFor(accountId: string): Record<string, string> {
    return { accountId, purpose: ENCRYPTION_PURPOSE };
  }

  private async kmsEncrypt(accountId: string, plaintext: string): Promise<string> {
    const kms = await this.kmsClient();
    const { result } = await kms.encrypt(kms.encryptKeyring, plaintext, {
      encryptionContext: this.contextFor(accountId),
    });
    return result.toString('base64');
  }

  private async kmsDecrypt(accountId: string, blobBase64: string): Promise<string> {
    const kms = await this.kmsClient();
    const { plaintext, messageHeader } = await kms.decrypt(
      kms.decryptKeyring,
      Buffer.from(blobBase64, 'base64'),
    );
    // decrypt() returns the context but does not verify it — enforce the per-tenant
    // binding ourselves (subset check: the SDK may add its own signing-key pair).
    const expected = this.contextFor(accountId);
    for (const [key, value] of Object.entries(expected)) {
      if (messageHeader.encryptionContext[key] !== value) {
        throw new Error('Encryption context does not match the expected tenant');
      }
    }
    return plaintext.toString('utf8');
  }

  private async kmsClient(): Promise<KmsClient> {
    if (this.kms) return this.kms;
    const { KmsKeyringNode, buildClient, CommitmentPolicy } = await import('@aws-crypto/client-node');
    const { encrypt, decrypt } = buildClient(CommitmentPolicy.REQUIRE_ENCRYPT_REQUIRE_DECRYPT);
    this.kms = {
      encrypt: encrypt as unknown as KmsClient['encrypt'],
      decrypt: decrypt as unknown as KmsClient['decrypt'],
      encryptKeyring: new KmsKeyringNode({ generatorKeyId: this.keyArn! }),
      decryptKeyring: new KmsKeyringNode({ keyIds: [this.keyArn!] }),
    };
    return this.kms;
  }
}
