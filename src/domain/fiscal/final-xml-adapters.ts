import { validateXML } from 'xmllint-wasm';
import type { FinalPacPreflight, FinalXmlValidator } from './xml-signing-pipeline';
import type { NormalizedCfdiDocument } from './validation/model';
import { requiredSchemasFor } from './schemas';
import type { XsdBundleStore } from './xsd-validator';
import type { PacAdapter } from './pac-adapter';

export class ExactFinalXmlXsdValidator implements FinalXmlValidator {
  constructor(private readonly store: XsdBundleStore) {}

  async validate(xml: string, document: NormalizedCfdiDocument): Promise<void> {
    const schemaIds = requiredSchemasFor({ type: document.type, complementIds: document.complementIds });
    for (const schemaId of schemaIds) {
      const bundle = await this.store.get(schemaId);
      if (!bundle) throw new Error(`No existe bundle XSD local/versionado para ${schemaId}.`);
      const result = await validateXML({
        xml: [{ fileName: 'cfdi-final.xml', contents: xml }],
        schema: [bundle.main],
        preload: bundle.preload ?? [],
      });
      if (!result.valid) {
        const details = (result.errors ?? []).map((error) => typeof error === 'string' ? error : JSON.stringify(error)).join(' | ');
        throw new Error(`XML final inválido contra ${schemaId}: ${details || 'sin detalle'}`);
      }
    }
  }
}

export class ExactPacPreflight implements FinalPacPreflight {
  constructor(private readonly adapter: PacAdapter) {}

  async validate(xml: string): Promise<void> {
    const rejections = await this.adapter.preflight(xml);
    if (!rejections.length) return;
    throw new Error(rejections.map((rejection) => `${rejection.satCode ?? rejection.providerCode}: ${rejection.message}`).join(' | '));
  }
}
