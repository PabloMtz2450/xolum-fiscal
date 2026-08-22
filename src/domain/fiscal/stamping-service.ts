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
 * Envía al PAC exactamente el XML que ya pasó cadena original, sello, CSD,
 * XSD y preflight. No vuelve a renderizar ni mutar el documento después de
 * firmarlo.
 */
export class CfdiStampingService {
  constructor(
    private readonly signingPipeline: CfdiXmlSigningPipeline,
    private readonly pac: PacAdapter,
  ) {}

  async stamp(document: NormalizedCfdiDocument, csd: CfdiCertificateMaterial): Promise<StampExecution> {
    const health = await this.pac.healthcheck();
    if (!health.ok) throw new Error(`PAC ${this.pac.provider} no disponible: ${health.detail ?? 'healthcheck fallido'}`);

    const prepared = await this.signingPipeline.prepare(document, csd);
    const idempotencyKey = createHash('sha256').update(prepared.finalXml, 'utf8').digest('hex');
    const result = await this.pac.stamp({
      xml: prepared.finalXml,
      idempotencyKey,
      issuerRfc: document.issuer.rfc,
    });

    return { prepared, result, idempotencyKey };
  }
}
