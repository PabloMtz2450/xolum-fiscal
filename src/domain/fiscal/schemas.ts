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
    id: 'CFDI_4_0', kind: 'CFDI', namespace: 'http://www.sat.gob.mx/cfd/4',
    xsdUrl: 'http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd', version: '4.0', enabled: true,
  },
  {
    id: 'PAGOS_2_0', kind: 'COMPLEMENT', namespace: 'http://www.sat.gob.mx/Pagos20',
    xsdUrl: 'http://www.sat.gob.mx/sitio_internet/cfd/Pagos/Pagos20.xsd', version: '2.0', enabled: true,
  },
  {
    id: 'DETALLISTA', kind: 'COMPLEMENT', namespace: 'http://www.sat.gob.mx/detallista',
    xsdUrl: 'http://www.sat.gob.mx/sitio_internet/cfd/detallista/detallista.xsd', version: '1.3', enabled: true,
  },
  {
    id: 'CARTA_PORTE_3_1', kind: 'COMPLEMENT', namespace: 'http://www.sat.gob.mx/CartaPorte31',
    xsdUrl: 'http://www.sat.gob.mx/sitio_internet/cfd/CartaPorte/CartaPorte31.xsd', version: '3.1', enabled: true,
  },
  {
    id: 'COMERCIO_EXTERIOR_2_0', kind: 'COMPLEMENT', namespace: 'http://www.sat.gob.mx/ComercioExterior20',
    xsdUrl: 'http://www.sat.gob.mx/sitio_internet/cfd/ComercioExterior20/ComercioExterior20.xsd', version: '2.0', enabled: true,
  },
  {
    id: 'IMPUESTOS_LOCALES', kind: 'COMPLEMENT', namespace: 'http://www.sat.gob.mx/implocal',
    xsdUrl: 'http://www.sat.gob.mx/sitio_internet/cfd/implocal/implocal.xsd', version: '1.0', enabled: true,
  },
];

export type XmlValidationResult = {
  ok: boolean;
  schemaId: string;
  errors: Array<{ path?: string; code: string; message: string }>;
};

export interface XsdValidator {
  validate(xml: string, schemaIds: string[]): Promise<XmlValidationResult[]>;
}

export type VersionedSchemaArtifact = {
  schemaId: string;
  localPath: string;
  sha256: string;
  fetchedAt: string;
  sourceUrl: string;
};

export interface SchemaArtifactStore {
  get(schemaId: string): Promise<VersionedSchemaArtifact | null>;
}

export function schemaLocationFor(schemaIds: string[]) {
  const selected = fiscalSchemas.filter((schema) => schemaIds.includes(schema.id));
  return selected.map(({ namespace, xsdUrl }) => `${namespace} ${xsdUrl}`).join(' ');
}

export function requiredSchemasFor(input: { type: 'I'|'E'|'T'|'P'; complementIds?: string[] }) {
  const ids = new Set<string>(['CFDI_4_0']);
  if (input.type === 'P') ids.add('PAGOS_2_0');
  for (const id of input.complementIds ?? []) ids.add(id);
  return [...ids];
}
