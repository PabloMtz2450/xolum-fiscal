import type { CfdiType, ValidationFinding } from '../prestamp-validation';

export type FiscalParty = {
  rfc: string;
  name: string;
  fiscalRegime: string;
  postalCode: string;
  foreignTaxId?: string;
  fiscalResidenceCountry?: string;
};

export type FiscalTax = {
  kind: 'TRANSFER' | 'WITHHOLDING';
  tax: '001' | '002' | '003';
  factorType: 'Tasa' | 'Cuota' | 'Exento';
  rateOrQuota?: number;
  base: number;
  amount?: number;
};

export type FiscalConcept = {
  line: number;
  productServiceKey: string;
  description: string;
  quantity: number;
  unitKey: string;
  unitPrice: number;
  amount: number;
  discount?: number;
  taxObject: '01' | '02' | '03' | '04';
  taxes?: FiscalTax[];
};

export type RelatedCfdi = {
  relationType: string;
  uuids: string[];
};

export type PaymentRelatedDocument = {
  uuid: string;
  currency: string;
  equivalence?: number;
  installmentNumber: number;
  previousBalance: number;
  paidAmount: number;
  remainingBalance: number;
  taxObject: '01' | '02' | '03';
};

export type PaymentEntry = {
  paymentDate: string;
  paymentForm: string;
  currency: string;
  exchangeRate?: number;
  amount: number;
  relatedDocuments: PaymentRelatedDocument[];
};

export type GlobalInformation = {
  periodicity: '01'|'02'|'03'|'04'|'05';
  months: string;
  year: number;
};

export type NormalizedCfdiDocument = {
  version: '4.0';
  type: CfdiType;
  series?: string;
  folio?: string;
  issueDate: string;
  expeditionPostalCode: string;
  currency: string;
  exchangeRate?: number;
  subtotal: number;
  discount?: number;
  total: number;
  paymentMethod?: 'PUE' | 'PPD';
  paymentForm?: string;
  cfdiUse: string;
  exportation?: '01'|'02'|'03'|'04';
  confirmation?: string;
  globalInformation?: GlobalInformation;
  issuer: FiscalParty;
  receiver: FiscalParty;
  concepts: FiscalConcept[];
  relatedCfdis?: RelatedCfdi[];
  payments?: PaymentEntry[];
  complementIds?: string[];
  certificateNumber?: string;
};

export type RuleContext = {
  document: NormalizedCfdiDocument;
  now: Date;
};

export type ExecutableFiscalRule = {
  id: string;
  title: string;
  appliesTo: CfdiType[] | ['ALL'];
  satReference: string;
  validate(context: RuleContext): ValidationFinding[];
};
