import { createHash } from 'node:crypto';
import type { PacAdapter, PacStampResult } from './pac-adapter';
import type { PreparedCfdiXml } from './xml-signing-pipeline';

export interface StampRepository {
  /** Debe ejecutarse bajo transacción y lock del documento. */
  beginAttempt(input: {
    tenantId: string;
    documentId: string;
    idempotencyKey: string;
    provider: string;
  }): Promise<{ attemptId: string; alreadyStamped: boolean; inProgress?: boolean }>;
  markStamped(attemptId: string, result: Extract<PacStampResult, { ok: true }>): Promise<void>;
  markUnknown(attemptId: string, reason: string): Promise<void>;
  markRejected(attemptId: string, reason: string, providerCode?: string): Promise<void>;
}

const uncertainTransport = (error: unknown) =>
  !(error instanceof Error) || /timeout|timed out|ECONNRESET|socket|network|aborted|EAI_AGAIN|ENOTFOUND/i.test(error.message);

/**
 * Regla de seguridad: un fallo de transporte nunca equivale a rechazo fiscal.
 * Si el PAC pudo haber recibido el XML, el intento queda UNKNOWN y requiere
 * recuperación por Finkok/SAT antes de volver a enviar.
 */
export async function stampDurably(input: {
  tenantId: string;
  documentId: string;
  issuerRfc: string;
  prepared: PreparedCfdiXml;
  pac: PacAdapter;
  repo: StampRepository;
}) {
  const idempotencyKey = createHash('sha256').update(input.prepared.finalXml, 'utf8').digest('hex');
  const attempt = await input.repo.beginAttempt({
    tenantId: input.tenantId,
    documentId: input.documentId,
    idempotencyKey,
    provider: input.pac.provider,
  });

  if (attempt.alreadyStamped) return { status: 'STAMPED' as const, idempotencyKey, reused: true };
  if (attempt.inProgress) return { status: 'IN_PROGRESS' as const, idempotencyKey, reused: true };

  try {
    const result = await input.pac.stamp({
      xml: input.prepared.finalXml,
      idempotencyKey,
      issuerRfc: input.issuerRfc,
    });

    if (result.ok) {
      await input.repo.markStamped(attempt.attemptId, result);
      return { status: 'STAMPED' as const, idempotencyKey, result };
    }

    if (result.rejection.retryable) {
      await input.repo.markUnknown(
        attempt.attemptId,
        `${result.rejection.providerCode}: ${result.rejection.message}`,
      );
      return { status: 'UNKNOWN' as const, idempotencyKey, result };
    }

    await input.repo.markRejected(
      attempt.attemptId,
      result.rejection.message,
      result.rejection.providerCode,
    );
    return { status: 'REJECTED' as const, idempotencyKey, result };
  } catch (error) {
    if (uncertainTransport(error)) {
      await input.repo.markUnknown(
        attempt.attemptId,
        error instanceof Error ? error.message : 'PAC_UNKNOWN',
      );
      return { status: 'UNKNOWN' as const, idempotencyKey };
    }

    await input.repo.markRejected(
      attempt.attemptId,
      error instanceof Error ? error.message : 'PAC_ERROR',
      'XOLUM-PAC-LOCAL',
    );
    throw error;
  }
}
