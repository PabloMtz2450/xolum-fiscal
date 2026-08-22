export type FiscalComplement = {
  id: string;
  label: string;
  soldSeparately: boolean;
  stampedTogetherWithCfdi: boolean;
  schemaId?: string;
  status: 'READY' | 'PLANNED';
};

export const fiscalComplements: FiscalComplement[] = [
  {
    id: 'DETALLISTA',
    label: 'Complemento Detallista',
    soldSeparately: false,
    stampedTogetherWithCfdi: true,
    schemaId: 'DETALLISTA',
    status: 'READY',
  },
  {
    id: 'COMERCIO_EXTERIOR',
    label: 'Comercio Exterior',
    soldSeparately: false,
    stampedTogetherWithCfdi: true,
    status: 'PLANNED',
  },
  {
    id: 'CARTA_PORTE',
    label: 'Carta Porte',
    soldSeparately: false,
    stampedTogetherWithCfdi: true,
    status: 'PLANNED',
  },
  {
    id: 'IMPUESTOS_LOCALES',
    label: 'Impuestos Locales',
    soldSeparately: false,
    stampedTogetherWithCfdi: true,
    status: 'PLANNED',
  },
];

export type AddendaModule = {
  customerCode: string;
  name: string;
  version: string;
  enabled: boolean;
  commercialModule: 'XOLUM_ADDENDAS';
};

/** Addendas are never assumed to be included in the Fiscal base plan. */
export function canAttachAddenda(module: AddendaModule | undefined) {
  return module?.enabled === true;
}
