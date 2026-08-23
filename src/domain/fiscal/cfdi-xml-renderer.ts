import type { FinalCfdiXmlRenderer, RenderContext } from './xml-signing-pipeline';
import type { FiscalConcept, FiscalTax, NormalizedCfdiDocument, PaymentEntry } from './validation/model';
import { schemaLocationFor } from './schemas';
import { D, add, decimalText, moneyText, mul } from './fiscal-decimal';

export interface ComplementXmlRenderer {
  id: string;
  render(document: NormalizedCfdiDocument): Promise<string> | string;
}

const esc = (value: string | number) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const attr = (name: string, value: string | number | undefined) => value === undefined || value === '' ? '' : ` ${name}="${esc(value)}"`;

function renderConceptTax(tax: FiscalTax): string {
  const node = tax.kind === 'TRANSFER' ? 'cfdi:Traslado' : 'cfdi:Retencion';
  return `<${node}${attr('Base', decimalText(tax.base, 6))}${attr('Impuesto', tax.tax)}${attr('TipoFactor', tax.factorType)}${tax.factorType === 'Exento' ? '' : attr('TasaOCuota', tax.rateOrQuota !== undefined ? decimalText(tax.rateOrQuota, 6) : undefined)}${tax.factorType === 'Exento' ? '' : attr('Importe', tax.amount !== undefined ? decimalText(tax.amount, 6) : undefined)}/>`;
}

function renderConcept(concept: FiscalConcept): string {
  const transfers = (concept.taxes ?? []).filter((tax) => tax.kind === 'TRANSFER');
  const withholdings = (concept.taxes ?? []).filter((tax) => tax.kind === 'WITHHOLDING');
  const taxes = !transfers.length && !withholdings.length ? '' : `<cfdi:Impuestos>${transfers.length ? `<cfdi:Traslados>${transfers.map(renderConceptTax).join('')}</cfdi:Traslados>` : ''}${withholdings.length ? `<cfdi:Retenciones>${withholdings.map(renderConceptTax).join('')}</cfdi:Retenciones>` : ''}</cfdi:Impuestos>`;
  return `<cfdi:Concepto${attr('ClaveProdServ', concept.productServiceKey)}${attr('Cantidad', decimalText(concept.quantity, 6))}${attr('ClaveUnidad', concept.unitKey)}${attr('Descripcion', concept.description)}${attr('ValorUnitario', decimalText(concept.unitPrice, 6))}${attr('Importe', decimalText(concept.amount, 6))}${attr('Descuento', concept.discount !== undefined ? decimalText(concept.discount, 6) : undefined)}${attr('ObjetoImp', concept.taxObject)}>${taxes}</cfdi:Concepto>`;
}

function renderPaymentConcept(): string {
  return '<cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="ACT" Descripcion="Pago" ValorUnitario="0" Importe="0" ObjetoImp="01"/>';
}

function aggregateTaxes(document: NormalizedCfdiDocument): string {
  if (!['I', 'E'].includes(document.type)) return '';
  const all = document.concepts.flatMap((concept) => concept.taxes ?? []);
  const transfers = all.filter((tax) => tax.kind === 'TRANSFER');
  const withholdings = all.filter((tax) => tax.kind === 'WITHHOLDING');
  if (!transfers.length && !withholdings.length) return '';

  const groups = new Map<string, { tax: FiscalTax; amount: ReturnType<typeof D>; base: ReturnType<typeof D> }>();
  for (const tax of transfers) {
    const key = `${tax.tax}|${tax.factorType}|${tax.rateOrQuota ?? ''}`;
    const current = groups.get(key) ?? { tax, base: D(0), amount: D(0) };
    current.base = current.base.plus(D(tax.base));
    current.amount = current.amount.plus(D(tax.amount ?? 0));
    groups.set(key, current);
  }
  const retentionGroups = new Map<string, ReturnType<typeof D>>();
  for (const tax of withholdings) retentionGroups.set(tax.tax, (retentionGroups.get(tax.tax) ?? D(0)).plus(D(tax.amount ?? 0)));

  const totalTransferred = add(...transfers.map((tax) => tax.amount ?? 0));
  const totalWithheld = add(...withholdings.map((tax) => tax.amount ?? 0));

  return `<cfdi:Impuestos${attr('TotalImpuestosRetenidos', withholdings.length ? moneyText(totalWithheld) : undefined)}${attr('TotalImpuestosTrasladados', transfers.length ? moneyText(totalTransferred) : undefined)}>${withholdings.length ? `<cfdi:Retenciones>${[...retentionGroups].map(([tax, amount]) => `<cfdi:Retencion Impuesto="${tax}" Importe="${moneyText(amount)}"/>`).join('')}</cfdi:Retenciones>` : ''}${transfers.length ? `<cfdi:Traslados>${[...groups.values()].map(({ tax, base, amount }) => `<cfdi:Traslado${attr('Base', moneyText(base))}${attr('Impuesto', tax.tax)}${attr('TipoFactor', tax.factorType)}${tax.factorType === 'Exento' ? '' : attr('TasaOCuota', tax.rateOrQuota !== undefined ? decimalText(tax.rateOrQuota, 6) : undefined)}${tax.factorType === 'Exento' ? '' : attr('Importe', moneyText(amount))}/>`).join('')}</cfdi:Traslados>` : ''}</cfdi:Impuestos>`;
}

function paymentTotal(payment: PaymentEntry) {
  return mul(payment.amount, payment.exchangeRate ?? 1);
}

function renderPayments(document: NormalizedCfdiDocument): string {
  const payments = document.payments ?? [];
  if (!payments.length) throw new Error('CFDI tipo P requiere pagos antes de renderizar XML.');
  const total = add(...payments.map(paymentTotal));
  const paymentNodes = payments.map((payment) => `<pago20:Pago${attr('FechaPago', payment.paymentDate)}${attr('FormaDePagoP', payment.paymentForm)}${attr('MonedaP', payment.currency)}${attr('TipoCambioP', payment.currency !== 'MXN' ? decimalText(payment.exchangeRate ?? 1, 10) : undefined)}${attr('Monto', decimalText(payment.amount, 6))}>${payment.relatedDocuments.map((doc) => `<pago20:DoctoRelacionado${attr('IdDocumento', doc.uuid)}${attr('MonedaDR', doc.currency)}${attr('EquivalenciaDR', doc.currency !== payment.currency ? decimalText(doc.equivalence ?? 1, 10) : undefined)}${attr('NumParcialidad', doc.installmentNumber)}${attr('ImpSaldoAnt', decimalText(doc.previousBalance, 6))}${attr('ImpPagado', decimalText(doc.paidAmount, 6))}${attr('ImpSaldoInsoluto', decimalText(doc.remainingBalance, 6))}${attr('ObjetoImpDR', doc.taxObject)}/>`).join('')}</pago20:Pago>`).join('');
  return `<pago20:Pagos Version="2.0"><pago20:Totales MontoTotalPagos="${moneyText(total)}"/>${paymentNodes}</pago20:Pagos>`;
}

function renderRelated(document: NormalizedCfdiDocument): string {
  return (document.relatedCfdis ?? []).map((group) => `<cfdi:CfdiRelacionados${attr('TipoRelacion', group.relationType)}>${group.uuids.map((uuid) => `<cfdi:CfdiRelacionado UUID="${esc(uuid)}"/>`).join('')}</cfdi:CfdiRelacionados>`).join('');
}

function renderGlobal(document: NormalizedCfdiDocument): string {
  const g = document.globalInformation;
  return g ? `<cfdi:InformacionGlobal${attr('Periodicidad', g.periodicity)}${attr('Meses', g.months)}${attr('Año', g.year)}/>` : '';
}

export class Cfdi40XmlRenderer implements FinalCfdiXmlRenderer {
  private readonly complements = new Map<string, ComplementXmlRenderer>();

  constructor(complements: ComplementXmlRenderer[] = []) {
    for (const complement of complements) this.complements.set(complement.id, complement);
  }

  async render(document: NormalizedCfdiDocument, context: RenderContext): Promise<string> {
    const schemaIds = ['CFDI_4_0', ...(document.type === 'P' ? ['PAGOS_2_0'] : []), ...(document.complementIds ?? [])];
    const namespaces = document.type === 'P' ? ' xmlns:pago20="http://www.sat.gob.mx/Pagos20"' : '';
    const subtotal = document.type === 'P' ? '0' : decimalText(document.subtotal, 6);
    const total = document.type === 'P' ? '0' : decimalText(document.total, 6);
    const currency = document.type === 'P' ? 'XXX' : document.currency;

    const root = `<?xml version="1.0" encoding="UTF-8"?><cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"${namespaces} xsi:schemaLocation="${esc(schemaLocationFor(schemaIds))}" Version="4.0"${attr('Serie', document.series)}${attr('Folio', document.folio)}${attr('Fecha', document.issueDate)}${attr('Sello', context.seal)}${attr('FormaPago', document.type === 'P' || document.type === 'T' ? undefined : document.paymentForm)}${attr('NoCertificado', context.certificateNumber)}${attr('Certificado', context.certificateBase64)}${attr('SubTotal', subtotal)}${attr('Descuento', document.type === 'P' || document.type === 'T' || document.discount === undefined ? undefined : decimalText(document.discount, 6))}${attr('Moneda', currency)}${attr('TipoCambio', document.type !== 'P' && document.currency !== 'MXN' && document.currency !== 'XXX' ? decimalText(document.exchangeRate ?? 1, 10) : undefined)}${attr('Total', total)}${attr('TipoDeComprobante', document.type)}${attr('Exportacion', document.exportation ?? '01')}${attr('MetodoPago', document.type === 'P' || document.type === 'T' ? undefined : document.paymentMethod)}${attr('LugarExpedicion', document.expeditionPostalCode)}${attr('Confirmacion', document.confirmation)}>`;

    const issuer = `<cfdi:Emisor${attr('Rfc', document.issuer.rfc)}${attr('Nombre', document.issuer.name)}${attr('RegimenFiscal', document.issuer.fiscalRegime)}/>`;
    const receiver = `<cfdi:Receptor${attr('Rfc', document.receiver.rfc)}${attr('Nombre', document.receiver.name)}${attr('DomicilioFiscalReceptor', document.receiver.postalCode)}${attr('ResidenciaFiscal', document.receiver.fiscalResidenceCountry)}${attr('NumRegIdTrib', document.receiver.foreignTaxId)}${attr('RegimenFiscalReceptor', document.receiver.fiscalRegime)}${attr('UsoCFDI', document.cfdiUse)}/>`;
    const concepts = `<cfdi:Conceptos>${document.type === 'P' ? renderPaymentConcept() : document.concepts.map(renderConcept).join('')}</cfdi:Conceptos>`;
    const taxes = aggregateTaxes(document);

    const complementParts: string[] = [];
    if (document.type === 'P') complementParts.push(renderPayments(document));
    for (const id of document.complementIds ?? []) {
      if (id === 'PAGOS_2_0' && document.type === 'P') continue;
      const renderer = this.complements.get(id);
      if (!renderer) throw new Error(`No existe renderer XML registrado para el complemento ${id}.`);
      complementParts.push(await renderer.render(document));
    }
    const complement = complementParts.length ? `<cfdi:Complemento>${complementParts.join('')}</cfdi:Complemento>` : '';

    return `${root}${renderGlobal(document)}${renderRelated(document)}${issuer}${receiver}${concepts}${taxes}${complement}</cfdi:Comprobante>`;
  }
}
