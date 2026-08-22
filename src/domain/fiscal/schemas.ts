export type FiscalSchemaDefinition = {
  id: string;
  kind: 'CFDI' | 'COMPLEMENT';
  namespace: string;
  xsdUrl: string;
  version: string;
  enabled: boolean;
};

export const fiscalSchemas: FiscalSchemaDefinition[] = [
  {
    id: 'CFDI_4_0',
    kind: 'CFDI',
    namespace: 'http://www.sat.gob.mx/cfd/4',
    xsdUrl: 'http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd',
    version: '4.0',
    enabled: true,
  },
  {
    id: 'DETALLISTA',
    kind: 'COMPLEMENT',
    namespace: 'http://www.sat.gob.mx/detallista',
    xsdUrl: 'http://www.sat.gob.mx/sitio_internet/cfd/detallista/detallista.xsd',
    version: '1.3',
    enabled: true,
  },
];

export type XmlValidationResult = {
  ok: boolean;
  schemaId: string;
  errors: Array<{ path?: string; code: string; message: string }>;
};

/**
 * Adapter boundary. Production validation must use the SAT-published XSDs,
 * cached/versioned by deployment and periodically checked for upstream changes.
 */
export interface XsdValidator {
  validate(xml: string, schemaIds: string[]): Promise<XmlValidationResult[]>;
}

export function schemaLocationFor(schemaIds: string[]) {
  const selected = fiscalSchemas.filter((schema) => schemaIds.includes(schema.id));
  return selected.map(({ namespace, xsdUrl }) => `${namespace} ${xsdUrl}`).join(' ');
}
