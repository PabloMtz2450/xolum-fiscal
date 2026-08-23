import { createHash } from 'node:crypto';
import type { PacAdapter, PacStampResult } from './pac-adapter';
import type { CfdiCertificateMaterial, CfdiXmlSigningPipeline, PreparedCfdiXml } from './xml-signing-pipeline';
import type { NormalizedCfdiDocument } from './validation/model';

export type StampExecution = {
  prepared: PreparedCfdiXml;
  result: PacStampResult;
  idempotencyKey: string;
};

/**
 * Servicio directo conservado para sandbox/pruebas. Producción debe usar
 * stampDurably + PostgresStampRepository para garantizar estado/idempotencia.
 */
export class CfdiStampingService {
  private health?: { checkedAt:number; ok:boolean; detail?:string };

  constructor(
    private readonly signingPipeline: CfdiXmlSigningPipeline,
    private readonly pac: PacAdapter,
  ) {}

  private async assertPacHealthy(): Promise<void> {
    const now = Date.now();
    if (!this.health || now - this.health.checkedAt > 30_000) {
      const result = await this.pac.healthcheck();
      this.health = { checkedAt:now, ...result };
    }
    if (!this.health.ok) throw new Error(`PAC ${this.pac.provider} no disponible: ${this.health.detail ?? 'healthcheck fallido'}`);
  }

  async stamp(document: NormalizedCfdiDocument, csd: CfdiCertificateMaterial): Promise<StampExecution> {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_NON_DURABLE_STAMPING !== 'true') {
      throw new Error('NON_DURABLE_STAMPING_DISABLED_IN_PRODUCTION');
    }
    await this.assertPacHealthy();

    const prepared = await this.signingPipeline.prepare(document, csd);
    const idempotencyKey = createHash('sha256').update(prepared.finalXml, 'utf8').digest('hex');
    const result = await this.pac.stamp({ xml:prepared.finalXml, idempotencyKey, issuerRfc:document.issuer.rfc });
    return { prepared, result, idempotencyKey };
  }
}
