export type CfdiType = 'I' | 'E' | 'T' | 'P';
export type ValidationSeverity = 'ERROR' | 'WARNING';
export type ValidationLayer =
  | 'INPUT'
  | 'CATALOG'
  | 'BUSINESS_RULE'
  | 'TOTALS'
  | 'RELATIONSHIP'
  | 'COMPLEMENT'
  | 'XSD'
  | 'SIGNATURE'
  | 'PAC_PREFLIGHT';

export type ValidationFinding = {
  layer: ValidationLayer;
  severity: ValidationSeverity;
  code: string;
  field?: string;
  message: string;
  satReference?: string;
};

export type ValidationReport = {
  cfdiType: CfdiType;
  okToStamp: boolean;
  findings: ValidationFinding[];
  ruleSetVersion: string;
  validatedAt: string;
};

/**
 * XOLUM Fiscal validation policy:
 * - FAIL CLOSED: any ERROR prevents PAC submission.
 * - Invoice UI cannot bypass fiscal validation.
 * - SAT/PAC rejection codes must be persisted and mapped back to a local rule.
 * - Rules/catalogs/XSDs are versioned and auditable.
 */
export interface PrestampValidator {
  validate(document: unknown, cfdiType: CfdiType): Promise<ValidationReport>;
}

export const REQUIRED_VALIDATION_LAYERS: ValidationLayer[] = [
  'INPUT',
  'CATALOG',
  'BUSINESS_RULE',
  'TOTALS',
  'RELATIONSHIP',
  'COMPLEMENT',
  'XSD',
  'SIGNATURE',
  'PAC_PREFLIGHT',
];

export const TYPE_PROFILES: Record<CfdiType, { label: string; checks: string[] }> = {
  I: {
    label: 'Ingreso',
    checks: [
      'Receptor y emisor CFDI 4.0',
      'Conceptos, ObjetoImp, impuestos y totales',
      'Forma/MetodoPago cuando correspondan',
      'CFDI relacionados y complementos aplicables',
    ],
  },
  E: {
    label: 'Egreso',
    checks: [
      'Documento origen y relación fiscal cuando aplique',
      'Conceptos, impuestos y totales',
      'Receptor/emisor y catálogos vigentes',
      'Reglas específicas de nota de crédito/egreso',
    ],
  },
  T: {
    label: 'Traslado',
    checks: [
      'Reglas propias de TipoDeComprobante T',
      'Totales/moneda/atributos conforme al estándar vigente',
      'Complementos obligatorios según operación, incluida Carta Porte cuando aplique',
      'Emisor/receptor, conceptos y catálogos vigentes',
    ],
  },
  P: {
    label: 'Pago',
    checks: [
      'CFDI tipo P y Complemento para Recepción de Pagos 2.0',
      'Documentos relacionados, parcialidades y saldos',
      'EquivalenciaDR/MonedaDR/ObjetoImpDR e impuestos cuando apliquen',
      'Totales del complemento y prohibiciones de atributos incompatibles',
    ],
  },
};

export function canSubmitToPac(report: ValidationReport): boolean {
  return report.okToStamp && !report.findings.some((f) => f.severity === 'ERROR');
}
