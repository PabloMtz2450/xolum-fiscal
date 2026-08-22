import { validateXML } from 'xmllint-wasm';
import type { ValidationFinding } from './prestamp-validation';
import { requiredSchemasFor } from './schemas';
import type { NormalizedCfdiDocument } from './validation/model';

export type XsdFile = { fileName: string; contents: string | Buffer };
export type XsdBundle = { main: XsdFile; preload?: XsdFile[] };

export interface XsdBundleStore {
  get(schemaId: string): Promise<XsdBundle | null>;
}

export interface CfdiXmlRenderer {
  render(document: NormalizedCfdiDocument): Promise<string>;
}

function finding(code: string, message: string, field?: string): ValidationFinding {
  return { layer: 'XSD', severity: 'ERROR', code, field, message, satReference: 'XSD oficial SAT y dependencias versionadas' };
}

/**
 * Adaptador XSD real basado en libxml2 compilado a WASM.
 * Los XSD y sus import/include deben estar cacheados localmente; nunca se
 * permite depender de una descarga SAT en tiempo de timbrado.
 */
export function createWasmXsdValidator(store: XsdBundleStore, renderer: CfdiXmlRenderer) {
  return async (document: NormalizedCfdiDocument): Promise<ValidationFinding[]> => {
    const xml = await renderer.render(document);
    const schemaIds = requiredSchemasFor({ type: document.type, complementIds: document.complementIds });
    const findings: ValidationFinding[] = [];

    for (const schemaId of schemaIds) {
      const bundle = await store.get(schemaId);
      if (!bundle) {
        findings.push(finding('XOL-XSD-001', `No existe un bundle XSD local/versionado para ${schemaId}.`));
        continue;
      }
      try {
        const result = await validateXML({
          xml: [{ fileName: 'cfdi.xml', contents: xml }],
          schema: [bundle.main],
          preload: bundle.preload ?? [],
        });
        if (!result.valid) {
          const raw = Array.isArray(result.errors) ? result.errors : [];
          if (!raw.length) findings.push(finding('XOL-XSD-002', `El XML no cumple el XSD ${schemaId}.`));
          else for (const error of raw) findings.push(finding('XOL-XSD-002', String(error)));
        }
      } catch (error) {
        findings.push(finding('XOL-XSD-003', `Falló la validación XSD ${schemaId}: ${error instanceof Error ? error.message : 'error desconocido'}`));
      }
    }
    return findings;
  };
}
