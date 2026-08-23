import type { ValidationFinding } from './prestamp-validation';

export type PacEnvironment = 'SANDBOX' | 'PRODUCTION';

export type PacRejection = {
  providerCode: string;
  message: string;
  satCode?: string;
  field?: string;
  retryable?: boolean;
};

export type PacStampRequest = {
  xml: string;
  idempotencyKey: string;
  issuerRfc: string;
};

export type PacStampResult =
  | { ok: true; uuid: string; stampedXml: string; provider: string; stampedAt: string }
  | { ok: false; provider: string; rejection: PacRejection };

export interface PacAdapter {
  readonly provider: string;
  readonly environment: PacEnvironment;
  healthcheck(): Promise<{ ok: boolean; detail?: string }>;
  preflight(xml: string): Promise<PacRejection[]>;
  stamp(request: PacStampRequest): Promise<PacStampResult>;
  cancel(input: { uuid: string; reason: '01'|'02'|'03'|'04'; replacementUuid?: string; issuerRfc: string }): Promise<{ requestId: string; status: string; rawCode?: string }>;
  status(input: { uuid: string; issuerRfc: string; receiverRfc?: string; total?: string | number }): Promise<{ satStatus: string; cancellable?: string; cancellationStatus?: string }>;
}

export function pacPreflightValidator(adapter: PacAdapter, renderXml: () => Promise<string>) {
  return async (): Promise<ValidationFinding[]> => {
    const xml = await renderXml();
    const rejections = await adapter.preflight(xml);
    return rejections.map((r) => ({
      layer: 'PAC_PREFLIGHT' as const,
      severity: 'ERROR' as const,
      code: r.satCode ?? r.providerCode,
      field: r.field,
      message: r.message,
      satReference: `Preflight ${adapter.provider}`,
    }));
  };
}

/** Todo rechazo determinista debe persistirse y convertirse en regresión. */
export function normalizePacFailure(provider: string, error: unknown): PacRejection {
  if (error instanceof Error) {
    const retryable = /timeout|timed out|ECONNRESET|socket|network|aborted|EAI_AGAIN|ENOTFOUND/i.test(error.message);
    return { providerCode: `${provider}-UNMAPPED`, message: error.message, retryable };
  }
  return { providerCode: `${provider}-UNKNOWN`, message: 'Error no identificado del PAC.', retryable: true };
}
