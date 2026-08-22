import type { ExecutableFiscalRule } from './model';
import type { ValidationFinding } from '../prestamp-validation';

const error = (code: string, message: string, field?: string, satReference?: string): ValidationFinding => ({
  layer: 'BUSINESS_RULE', severity: 'ERROR', code, field, message, satReference,
});
const totalsError = (code: string, message: string, field?: string, satReference?: string): ValidationFinding => ({
  layer: 'TOTALS', severity: 'ERROR', code, field, message, satReference,
});
const relationshipError = (code: string, message: string, field?: string, satReference?: string): ValidationFinding => ({
  layer: 'RELATIONSHIP', severity: 'ERROR', code, field, message, satReference,
});

const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const uuid = /^[0-9A-F]{8}-[0-9A-F]{4}-[1-5][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i;
const rfc = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i;
const cp = /^\d{5}$/;

export const coreFiscalRules: ExecutableFiscalRule[] = [
  {
    id: 'XOL-CFDI-001', title: 'Versión CFDI 4.0', appliesTo: ['ALL'], satReference: 'Anexo 20 / CFDI 4.0',
    validate: ({ document }) => document.version === '4.0' ? [] : [error('XOL-CFDI-001', 'La versión debe ser 4.0.', 'version')],
  },
  {
    id: 'XOL-CFDI-002', title: 'RFC emisor válido', appliesTo: ['ALL'], satReference: 'Anexo 20 / Emisor.Rfc',
    validate: ({ document }) => rfc.test(document.issuer.rfc) ? [] : [error('XOL-CFDI-002', 'RFC del emisor inválido.', 'issuer.rfc')],
  },
  {
    id: 'XOL-CFDI-003', title: 'RFC receptor válido', appliesTo: ['ALL'], satReference: 'Anexo 20 / Receptor.Rfc',
    validate: ({ document }) => rfc.test(document.receiver.rfc) ? [] : [error('XOL-CFDI-003', 'RFC del receptor inválido.', 'receiver.rfc')],
  },
  {
    id: 'XOL-CFDI-004', title: 'CP fiscal receptor', appliesTo: ['ALL'], satReference: 'Anexo 20 / Receptor.DomicilioFiscalReceptor',
    validate: ({ document }) => cp.test(document.receiver.postalCode) ? [] : [error('XOL-CFDI-004', 'El domicilio fiscal del receptor debe ser un CP de 5 dígitos.', 'receiver.postalCode')],
  },
  {
    id: 'XOL-CFDI-005', title: 'Lugar de expedición', appliesTo: ['ALL'], satReference: 'Anexo 20 / LugarExpedicion',
    validate: ({ document }) => cp.test(document.expeditionPostalCode) ? [] : [error('XOL-CFDI-005', 'LugarExpedicion debe ser un CP de 5 dígitos.', 'expeditionPostalCode')],
  },
  {
    id: 'XOL-CFDI-006', title: 'Conceptos requeridos', appliesTo: ['I','E','T'], satReference: 'Anexo 20 / Conceptos',
    validate: ({ document }) => document.concepts.length ? [] : [error('XOL-CFDI-006', 'El CFDI requiere al menos un concepto.', 'concepts')],
  },
  {
    id: 'XOL-CFDI-007', title: 'ClaveProdServ', appliesTo: ['I','E','T'], satReference: 'Anexo 20 / Concepto.ClaveProdServ',
    validate: ({ document }) => document.concepts.flatMap((c) => /^\d{8}$/.test(c.productServiceKey) ? [] : [error('XOL-CFDI-007', `ClaveProdServ inválida en línea ${c.line}.`, `concepts.${c.line}.productServiceKey`)]),
  },
  {
    id: 'XOL-CFDI-008', title: 'Cantidad positiva', appliesTo: ['I','E','T'], satReference: 'Anexo 20 / Concepto.Cantidad',
    validate: ({ document }) => document.concepts.flatMap((c) => c.quantity > 0 ? [] : [error('XOL-CFDI-008', `Cantidad debe ser mayor a cero en línea ${c.line}.`, `concepts.${c.line}.quantity`)]),
  },
  {
    id: 'XOL-CFDI-009', title: 'Importe de concepto', appliesTo: ['I','E','T'], satReference: 'Anexo 20 / Concepto.Importe',
    validate: ({ document }) => document.concepts.flatMap((c) => round(c.quantity * c.unitPrice) === round(c.amount) ? [] : [totalsError('XOL-CFDI-009', `Importe inconsistente en línea ${c.line}.`, `concepts.${c.line}.amount`)]),
  },
  {
    id: 'XOL-CFDI-010', title: 'Descuento no excede importe', appliesTo: ['I','E','T'], satReference: 'Anexo 20 / Concepto.Descuento',
    validate: ({ document }) => document.concepts.flatMap((c) => (c.discount ?? 0) <= c.amount ? [] : [totalsError('XOL-CFDI-010', `El descuento excede el importe en línea ${c.line}.`, `concepts.${c.line}.discount`)]),
  },
  {
    id: 'XOL-CFDI-011', title: 'Subtotal', appliesTo: ['I','E','T'], satReference: 'Anexo 20 / SubTotal',
    validate: ({ document }) => round(document.concepts.reduce((s,c)=>s+c.amount,0)) === round(document.subtotal) ? [] : [totalsError('XOL-CFDI-011', 'SubTotal no coincide con la suma de conceptos.', 'subtotal')],
  },
  {
    id: 'XOL-CFDI-012', title: 'ObjetoImp 01 sin impuestos', appliesTo: ['I','E','T'], satReference: 'Anexo 20 / Concepto.ObjetoImp',
    validate: ({ document }) => document.concepts.flatMap((c) => c.taxObject === '01' && (c.taxes?.length ?? 0) > 0 ? [error('XOL-CFDI-012', `La línea ${c.line} marcada como no objeto no debe llevar impuestos.`, `concepts.${c.line}.taxes`)] : []),
  },
  {
    id: 'XOL-CFDI-013', title: 'ObjetoImp 02 con impuestos', appliesTo: ['I','E'], satReference: 'Anexo 20 / Concepto.ObjetoImp',
    validate: ({ document }) => document.concepts.flatMap((c) => c.taxObject === '02' && !(c.taxes?.length) ? [error('XOL-CFDI-013', `La línea ${c.line} objeto de impuesto requiere nodos de impuestos.`, `concepts.${c.line}.taxes`)] : []),
  },
  {
    id: 'XOL-CFDI-014', title: 'Total', appliesTo: ['I','E'], satReference: 'Anexo 20 / Total',
    validate: ({ document }) => {
      const discount = document.discount ?? document.concepts.reduce((s,c)=>s+(c.discount ?? 0),0);
      const transfers = document.concepts.flatMap(c=>c.taxes ?? []).filter(t=>t.kind==='TRANSFER').reduce((s,t)=>s+(t.amount ?? 0),0);
      const withholdings = document.concepts.flatMap(c=>c.taxes ?? []).filter(t=>t.kind==='WITHHOLDING').reduce((s,t)=>s+(t.amount ?? 0),0);
      const expected = round(document.subtotal - discount + transfers - withholdings);
      return round(document.total) === expected ? [] : [totalsError('XOL-CFDI-014', `Total inconsistente. Esperado ${expected.toFixed(2)}.`, 'total')];
    },
  },
  {
    id: 'XOL-CFDI-015', title: 'Traslado total cero', appliesTo: ['T'], satReference: 'Anexo 20 / TipoDeComprobante T',
    validate: ({ document }) => round(document.total) === 0 ? [] : [totalsError('XOL-CFDI-015', 'Un CFDI de traslado debe tener Total 0.', 'total')],
  },
  {
    id: 'XOL-CFDI-015B', title: 'Traslado sin forma ni método de pago', appliesTo: ['T'], satReference: 'Anexo 20 / CFDI tipo Traslado',
    validate: ({ document }) => !document.paymentForm && !document.paymentMethod ? [] : [error('XOL-CFDI-015B', 'Un CFDI de traslado no debe incorporar FormaPago ni MetodoPago.', 'paymentForm')],
  },
  {
    id: 'XOL-CFDI-016', title: 'Pago total cero', appliesTo: ['P'], satReference: 'Anexo 20 / TipoDeComprobante P',
    validate: ({ document }) => round(document.total) === 0 && round(document.subtotal) === 0 ? [] : [totalsError('XOL-CFDI-016', 'Un CFDI tipo Pago debe tener SubTotal y Total en 0.', 'total')],
  },
  {
    id: 'XOL-CFDI-017', title: 'Pago moneda XXX', appliesTo: ['P'], satReference: 'Anexo 20 / CFDI tipo P',
    validate: ({ document }) => document.currency === 'XXX' ? [] : [error('XOL-CFDI-017', 'El CFDI tipo Pago debe usar moneda XXX.', 'currency')],
  },
  {
    id: 'XOL-CFDI-018', title: 'Pago sin FormaPago CFDI', appliesTo: ['P'], satReference: 'Anexo 20 / Complemento Pagos 2.0',
    validate: ({ document }) => !document.paymentForm ? [] : [error('XOL-CFDI-018', 'FormaPago no debe informarse en el comprobante tipo P; corresponde al nodo Pago.', 'paymentForm')],
  },
  {
    id: 'XOL-CFDI-019', title: 'Pago sin MetodoPago CFDI', appliesTo: ['P'], satReference: 'Anexo 20 / Complemento Pagos 2.0',
    validate: ({ document }) => !document.paymentMethod ? [] : [error('XOL-CFDI-019', 'MetodoPago no debe informarse en el comprobante tipo P.', 'paymentMethod')],
  },
  {
    id: 'XOL-PAGO-001', title: 'Pago 2.0 requerido', appliesTo: ['P'], satReference: 'Complemento para recepción de pagos 2.0',
    validate: ({ document }) => document.payments?.length ? [] : [error('XOL-PAGO-001', 'El CFDI tipo P requiere al menos un nodo Pago.', 'payments')],
  },
  {
    id: 'XOL-PAGO-002', title: 'Documentos relacionados', appliesTo: ['P'], satReference: 'Pagos 2.0 / DoctoRelacionado',
    validate: ({ document }) => (document.payments ?? []).flatMap((p,pi)=>p.relatedDocuments.length ? [] : [relationshipError('XOL-PAGO-002', `El pago ${pi+1} requiere al menos un documento relacionado.`, `payments.${pi}.relatedDocuments`)]),
  },
  {
    id: 'XOL-PAGO-003', title: 'UUID relacionados válidos', appliesTo: ['P'], satReference: 'Pagos 2.0 / IdDocumento',
    validate: ({ document }) => (document.payments ?? []).flatMap((p,pi)=>p.relatedDocuments.flatMap((d,di)=>uuid.test(d.uuid) ? [] : [relationshipError('XOL-PAGO-003', 'UUID relacionado inválido.', `payments.${pi}.relatedDocuments.${di}.uuid`)])),
  },
  {
    id: 'XOL-PAGO-004', title: 'Parcialidad positiva', appliesTo: ['P'], satReference: 'Pagos 2.0 / NumParcialidad',
    validate: ({ document }) => (document.payments ?? []).flatMap((p,pi)=>p.relatedDocuments.flatMap((d,di)=>Number.isInteger(d.installmentNumber) && d.installmentNumber > 0 ? [] : [error('XOL-PAGO-004', 'NumParcialidad debe ser entero positivo.', `payments.${pi}.relatedDocuments.${di}.installmentNumber`)])),
  },
  {
    id: 'XOL-PAGO-005', title: 'Saldos REP', appliesTo: ['P'], satReference: 'Pagos 2.0 / ImpSaldoAnt, ImpPagado, ImpSaldoInsoluto',
    validate: ({ document }) => (document.payments ?? []).flatMap((p,pi)=>p.relatedDocuments.flatMap((d,di)=>round(d.previousBalance - d.paidAmount) === round(d.remainingBalance) && d.paidAmount <= d.previousBalance ? [] : [totalsError('XOL-PAGO-005', 'Saldos del documento relacionado no cuadran.', `payments.${pi}.relatedDocuments.${di}`)])),
  },
  {
    id: 'XOL-PAGO-006', title: 'Monto de pago', appliesTo: ['P'], satReference: 'Pagos 2.0 / Monto',
    validate: ({ document }) => (document.payments ?? []).flatMap((p,pi)=>p.amount > 0 ? [] : [totalsError('XOL-PAGO-006', 'Monto del pago debe ser mayor a cero.', `payments.${pi}.amount`)]),
  },
  {
    id: 'XOL-REL-001', title: 'UUID CFDI relacionados', appliesTo: ['ALL'], satReference: 'Anexo 20 / CfdiRelacionados',
    validate: ({ document }) => (document.relatedCfdis ?? []).flatMap((g,gi)=>g.uuids.flatMap((id,ui)=>uuid.test(id) ? [] : [relationshipError('XOL-REL-001', 'UUID de CFDI relacionado inválido.', `relatedCfdis.${gi}.uuids.${ui}`)])),
  },
];
