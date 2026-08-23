import { Pool, type PoolClient } from 'pg';
import type { StampRepository } from '../domain/fiscal/durable-stamping';
import type { PacStampResult } from '../domain/fiscal/pac-adapter';

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL_NOT_CONFIGURED');
  return url;
}

export function createFiscalPool(): Pool {
  const production = process.env.NODE_ENV === 'production';
  const sslRequired = process.env.DATABASE_SSL_REQUIRED !== 'false';
  return new Pool({
    connectionString: requireDatabaseUrl(),
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: production && sslRequired ? { rejectUnauthorized: true } : undefined,
  });
}

async function setTenant(client: PoolClient, tenantId: string): Promise<void> {
  await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);
}

async function withTransaction<T>(pool: Pool, tenantId: string, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
    await setTenant(client, tenantId);
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export class PostgresStampRepository implements StampRepository {
  constructor(private readonly pool: Pool, private readonly tenantId: string) {}

  async beginAttempt(input: { tenantId: string; documentId: string; idempotencyKey: string; provider: string }) {
    if (input.tenantId !== this.tenantId) throw new Error('TENANT_CONTEXT_MISMATCH');

    return withTransaction(this.pool, this.tenantId, async (client) => {
      const docResult = await client.query<{
        id: string;
        status: string;
        uuid: string | null;
      }>(
        `SELECT id,status,uuid
           FROM fiscal_documents
          WHERE id=$1 AND tenant_id=$2
          FOR UPDATE`,
        [input.documentId, this.tenantId],
      );
      const document = docResult.rows[0];
      if (!document) throw new Error('FISCAL_DOCUMENT_NOT_FOUND');
      if (document.status === 'STAMPED' && document.uuid) {
        return { attemptId: '', alreadyStamped: true, inProgress: false };
      }

      const prior = await client.query<{ id:string; status:string }>(
        `SELECT id,status
           FROM stamp_attempts
          WHERE tenant_id=$1 AND idempotency_key=$2
          FOR UPDATE`,
        [this.tenantId, input.idempotencyKey],
      );
      if (prior.rows[0]) {
        const state = prior.rows[0].status;
        return {
          attemptId: prior.rows[0].id,
          alreadyStamped: state === 'STAMPED',
          inProgress: ['STAMPING','UNKNOWN'].includes(state),
        };
      }

      if (!['READY','SAFE_TO_RETRY','REJECTED'].includes(document.status)) {
        throw new Error(`FISCAL_DOCUMENT_NOT_STAMPABLE:${document.status}`);
      }

      const attempt = await client.query<{ id:string }>(
        `INSERT INTO stamp_attempts(tenant_id,fiscal_document_id,idempotency_key,provider,status)
         VALUES($1,$2,$3,$4,'STAMPING')
         RETURNING id`,
        [this.tenantId, input.documentId, input.idempotencyKey, input.provider],
      );

      await client.query(
        `UPDATE fiscal_documents
            SET status='STAMPING', row_version=row_version+1, updated_at=now()
          WHERE id=$1 AND tenant_id=$2`,
        [input.documentId, this.tenantId],
      );

      return { attemptId: attempt.rows[0].id, alreadyStamped: false, inProgress: false };
    });
  }

  async markStamped(attemptId: string, result: Extract<PacStampResult, { ok:true }>): Promise<void> {
    await withTransaction(this.pool, this.tenantId, async (client) => {
      const attempt = await client.query<{ fiscal_document_id:string; status:string }>(
        `SELECT fiscal_document_id,status
           FROM stamp_attempts
          WHERE id=$1 AND tenant_id=$2
          FOR UPDATE`,
        [attemptId, this.tenantId],
      );
      const row = attempt.rows[0];
      if (!row) throw new Error('STAMP_ATTEMPT_NOT_FOUND');
      if (row.status === 'STAMPED') return;

      await client.query(
        `UPDATE stamp_attempts
            SET status='STAMPED',uuid=$3,provider_code='OK',provider_message='STAMPED',finished_at=now()
          WHERE id=$1 AND tenant_id=$2`,
        [attemptId, this.tenantId, result.uuid],
      );
      await client.query(
        `UPDATE fiscal_documents
            SET status='STAMPED',uuid=$3,row_version=row_version+1,updated_at=now()
          WHERE id=$1 AND tenant_id=$2`,
        [row.fiscal_document_id, this.tenantId, result.uuid],
      );
    });
  }

  async markUnknown(attemptId: string, reason: string): Promise<void> {
    await this.transition(attemptId, 'UNKNOWN', reason, 'PAC_TRANSPORT_UNKNOWN');
  }

  async markRejected(attemptId: string, reason: string, providerCode?: string): Promise<void> {
    await this.transition(attemptId, 'REJECTED', reason, providerCode ?? 'PAC_REJECTED');
  }

  private async transition(attemptId: string, status: 'UNKNOWN'|'REJECTED', message: string, providerCode: string): Promise<void> {
    await withTransaction(this.pool, this.tenantId, async (client) => {
      const attempt = await client.query<{ fiscal_document_id:string; status:string }>(
        `SELECT fiscal_document_id,status
           FROM stamp_attempts
          WHERE id=$1 AND tenant_id=$2
          FOR UPDATE`,
        [attemptId, this.tenantId],
      );
      const row = attempt.rows[0];
      if (!row) throw new Error('STAMP_ATTEMPT_NOT_FOUND');
      if (row.status === 'STAMPED') throw new Error('STAMPED_ATTEMPT_IS_IMMUTABLE');

      await client.query(
        `UPDATE stamp_attempts
            SET status=$3,provider_code=$4,provider_message=$5,finished_at=CASE WHEN $3='REJECTED' THEN now() ELSE finished_at END
          WHERE id=$1 AND tenant_id=$2`,
        [attemptId, this.tenantId, status, providerCode, message.slice(0, 2000)],
      );
      await client.query(
        `UPDATE fiscal_documents
            SET status=$3,row_version=row_version+1,updated_at=now()
          WHERE id=$1 AND tenant_id=$2`,
        [row.fiscal_document_id, this.tenantId, status],
      );
    });
  }
}
