import { createHash, randomUUID } from 'node:crypto';

export interface SecretProvider {
  get(name: string): Promise<string>;
}

/** Sólo desarrollo/pruebas. Producción debe inyectar KMS/Secret Manager. */
export class EnvironmentSecretProvider implements SecretProvider {
  async get(name: string): Promise<string> {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_ENV_SECRETS !== 'true') {
      throw new Error('ENV_SECRET_PROVIDER_DISABLED_IN_PRODUCTION');
    }
    const value = process.env[name];
    if (!value) throw new Error(`SECRET_NOT_CONFIGURED:${name}`);
    return value;
  }
}

export interface StoredObjectMetadata {
  key: string;
  sha256: string;
  bytes: number;
  versionId?: string;
}

export interface EncryptedObjectStorage {
  /** Debe usar cifrado server-side y operación create-only/immutable. */
  putImmutable(key: string, body: Buffer, contentType: string): Promise<StoredObjectMetadata>;
  get(key: string, versionId?: string): Promise<Buffer>;
}

export const objectDigest = (body: Buffer) => createHash('sha256').update(body).digest('hex');

export async function verifyStoredObject(
  storage: EncryptedObjectStorage,
  metadata: Pick<StoredObjectMetadata, 'key'|'sha256'|'versionId'>,
): Promise<Buffer> {
  const body = await storage.get(metadata.key, metadata.versionId);
  if (objectDigest(body) !== metadata.sha256) throw new Error('STORED_OBJECT_INTEGRITY_FAILURE');
  return body;
}

const sensitive = /password|secret|token|authorization|certificate|private.?key|sello|xml|csrf|cookie/i;

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string,unknown>).map(([key,item]) => [key, sensitive.test(key) ? '[REDACTED]' : redact(item)]),
    );
  }
  return value;
}

export function logEvent(
  level: 'info'|'warn'|'error',
  event: string,
  data: Record<string,unknown> = {},
): string {
  const correlationId = typeof data.correlationId === 'string' ? data.correlationId : randomUUID();
  const record = JSON.stringify({ ts:new Date().toISOString(), level, event, correlationId, ...redact(data) });
  if (level === 'error') console.error(record);
  else if (level === 'warn') console.warn(record);
  else console.log(record);
  return correlationId;
}
