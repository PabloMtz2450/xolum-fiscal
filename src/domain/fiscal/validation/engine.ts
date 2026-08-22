import type { ValidationReport } from '../prestamp-validation';
import { REQUIRED_VALIDATION_LAYERS } from '../prestamp-validation';
import { coreFiscalRules } from './core-rules';
import { advancedFiscalRules } from './advanced-rules';
import type { ExecutableFiscalRule, NormalizedCfdiDocument } from './model';

export type PrestampDependencies = {
  catalogValidate?: (document: NormalizedCfdiDocument) => Promise<ValidationReport['findings']>;
  complementValidate?: (document: NormalizedCfdiDocument) => Promise<ValidationReport['findings']>;
  xsdValidate?: (document: NormalizedCfdiDocument) => Promise<ValidationReport['findings']>;
  signatureValidate?: (document: NormalizedCfdiDocument) => Promise<ValidationReport['findings']>;
  pacPreflight?: (document: NormalizedCfdiDocument) => Promise<ValidationReport['findings']>;
};

const missingLayer = (layer: typeof REQUIRED_VALIDATION_LAYERS[number], message: string): ValidationReport['findings'][number] => ({
  layer,
  severity: 'ERROR',
  code: `XOL-${layer}-NOT_CONFIGURED`,
  message,
});

export class FiscalValidationEngine {
  constructor(
    private readonly rules: ExecutableFiscalRule[] = [...coreFiscalRules, ...advancedFiscalRules],
    private readonly deps: PrestampDependencies = {},
    private readonly ruleSetVersion = '2026.08.22-core-2',
  ) {}

  async validate(document: NormalizedCfdiDocument): Promise<ValidationReport> {
    const findings: ValidationReport['findings'] = [];
    const context = { document, now: new Date() };

    for (const rule of this.rules) {
      if (rule.appliesTo[0] !== 'ALL' && !(rule.appliesTo as string[]).includes(document.type)) continue;
      findings.push(...rule.validate(context).map((f) => ({ ...f, satReference: f.satReference ?? rule.satReference })));
    }

    if (this.deps.catalogValidate) findings.push(...await this.deps.catalogValidate(document));
    else findings.push(missingLayer('CATALOG', 'No existe un validador de catálogos SAT configurado. Timbrado bloqueado.'));

    if (this.deps.complementValidate) findings.push(...await this.deps.complementValidate(document));
    else if (document.complementIds?.length || document.type === 'P') findings.push(missingLayer('COMPLEMENT', 'No existe un validador de complementos configurado. Timbrado bloqueado.'));

    if (this.deps.xsdValidate) findings.push(...await this.deps.xsdValidate(document));
    else findings.push(missingLayer('XSD', 'La validación contra XSD oficial SAT no está configurada. Timbrado bloqueado.'));

    if (this.deps.signatureValidate) findings.push(...await this.deps.signatureValidate(document));
    else findings.push(missingLayer('SIGNATURE', 'La validación de CSD/cadena/sello no está configurada. Timbrado bloqueado.'));

    if (this.deps.pacPreflight) findings.push(...await this.deps.pacPreflight(document));
    else findings.push(missingLayer('PAC_PREFLIGHT', 'El preflight del PAC no está configurado. Timbrado bloqueado.'));

    return {
      cfdiType: document.type,
      okToStamp: !findings.some((finding) => finding.severity === 'ERROR'),
      findings,
      ruleSetVersion: this.ruleSetVersion,
      validatedAt: new Date().toISOString(),
    };
  }
}
