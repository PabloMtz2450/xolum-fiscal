import type { ValidationFinding } from './prestamp-validation';
import type { NormalizedCfdiDocument } from './validation/model';

export type SatCatalogName =
  | 'c_RegimenFiscal'
  | 'c_UsoCFDI'
  | 'c_CodigoPostal'
  | 'c_Moneda'
  | 'c_FormaPago'
  | 'c_MetodoPago'
  | 'c_ClaveProdServ'
  | 'c_ClaveUnidad'
  | 'c_ObjetoImp'
  | 'c_TipoRelacion'
  | 'c_Exportacion'
  | 'c_Impuesto'
  | 'c_TipoFactor';

export type SatCatalogEntry = {
  key: string;
  validFrom?: string;
  validTo?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type SatCatalogSnapshot = {
  name: SatCatalogName;
  version: string;
  source: string;
  loadedAt: string;
  sha256?: string;
  entries: SatCatalogEntry[];
};

export interface SatCatalogStore {
  get(name: SatCatalogName): Promise<SatCatalogSnapshot | null>;
}

function active(entry: SatCatalogEntry, at: Date) {
  const fromOk = !entry.validFrom || new Date(entry.validFrom) <= at;
  const toOk = !entry.validTo || new Date(entry.validTo) >= at;
  return fromOk && toOk;
}

function catalogError(code: string, message: string, field: string): ValidationFinding {
  return { layer: 'CATALOG', severity: 'ERROR', code, field, message, satReference: 'Catálogos CFDI vigentes publicados por SAT' };
}

export function createCatalogValidator(store: SatCatalogStore) {
  return async (document: NormalizedCfdiDocument): Promise<ValidationFinding[]> => {
    const findings: ValidationFinding[] = [];
    const at = new Date(document.issueDate);

    const checks: Array<{ name: SatCatalogName; value: string | undefined; field: string }> = [
      { name: 'c_RegimenFiscal', value: document.issuer.fiscalRegime, field: 'issuer.fiscalRegime' },
      { name: 'c_RegimenFiscal', value: document.receiver.fiscalRegime, field: 'receiver.fiscalRegime' },
      { name: 'c_UsoCFDI', value: document.cfdiUse, field: 'cfdiUse' },
      { name: 'c_CodigoPostal', value: document.expeditionPostalCode, field: 'expeditionPostalCode' },
      { name: 'c_CodigoPostal', value: document.receiver.postalCode, field: 'receiver.postalCode' },
      { name: 'c_Moneda', value: document.currency, field: 'currency' },
      { name: 'c_MetodoPago', value: document.paymentMethod, field: 'paymentMethod' },
      { name: 'c_FormaPago', value: document.paymentForm, field: 'paymentForm' },
    ];

    for (const concept of document.concepts) {
      checks.push(
        { name: 'c_ClaveProdServ', value: concept.productServiceKey, field: `concepts.${concept.line}.productServiceKey` },
        { name: 'c_ClaveUnidad', value: concept.unitKey, field: `concepts.${concept.line}.unitKey` },
        { name: 'c_ObjetoImp', value: concept.taxObject, field: `concepts.${concept.line}.taxObject` },
      );
      for (const tax of concept.taxes ?? []) {
        checks.push(
          { name: 'c_Impuesto', value: tax.tax, field: `concepts.${concept.line}.taxes.tax` },
          { name: 'c_TipoFactor', value: tax.factorType, field: `concepts.${concept.line}.taxes.factorType` },
        );
      }
    }

    for (const relation of document.relatedCfdis ?? []) {
      checks.push({ name: 'c_TipoRelacion', value: relation.relationType, field: 'relatedCfdis.relationType' });
    }

    for (const payment of document.payments ?? []) {
      checks.push(
        { name: 'c_FormaPago', value: payment.paymentForm, field: 'payments.paymentForm' },
        { name: 'c_Moneda', value: payment.currency, field: 'payments.currency' },
      );
      for (const related of payment.relatedDocuments) {
        checks.push(
          { name: 'c_Moneda', value: related.currency, field: 'payments.relatedDocuments.currency' },
          { name: 'c_ObjetoImp', value: related.taxObject, field: 'payments.relatedDocuments.taxObject' },
        );
      }
    }

    const grouped = new Map<SatCatalogName, SatCatalogSnapshot | null>();
    for (const check of checks) {
      if (!check.value) continue;
      if (!grouped.has(check.name)) grouped.set(check.name, await store.get(check.name));
      const snapshot = grouped.get(check.name);
      if (!snapshot) {
        findings.push(catalogError(`XOL-CAT-${check.name}-MISSING`, `No está cargado el catálogo ${check.name}; timbrado bloqueado.`, check.field));
        continue;
      }
      const entry = snapshot.entries.find((item) => item.key === check.value);
      if (!entry || !active(entry, at)) {
        findings.push(catalogError(`XOL-CAT-${check.name}-INVALID`, `${check.value} no es una clave vigente de ${check.name} para la fecha del CFDI.`, check.field));
      }
    }

    return findings;
  };
}
