import type { ExecutableFiscalRule } from './model';
import type { ValidationFinding } from '../prestamp-validation';
import { D, add, mul, within } from '../fiscal-decimal';

const business = (code: string, message: string, field?: string, satReference?: string): ValidationFinding => ({
  layer: 'BUSINESS_RULE', severity: 'ERROR', code, field, message, satReference,
});
const totals = (code: string, message: string, field?: string, satReference?: string): ValidationFinding => ({
  layer: 'TOTALS', severity: 'ERROR', code, field, message, satReference,
});
const relationship = (code: string, message: string, field?: string, satReference?: string): ValidationFinding => ({
  layer: 'RELATIONSHIP', severity: 'ERROR', code, field, message, satReference,
});

const relationTypes = new Set(['01','02','03','04','05','06','07']);
const genericPublicRfc = 'XAXX010101000';
const foreignRfc = 'XEXX010101000';
const tolerance = '0.000001';

export const advancedFiscalRules: ExecutableFiscalRule[] = [
  {
    id:'XOL-ADV-001', title:'Moneda y TipoCambio', appliesTo:['ALL'], satReference:'Anexo 20 / Moneda y TipoCambio',
    validate:({ document })=>{
      const out: ValidationFinding[] = [];
      if (document.currency === 'XXX' && document.exchangeRate !== undefined) out.push(business('XOL-ADV-001A','Con Moneda XXX no debe existir TipoCambio.','exchangeRate'));
      if (document.currency === 'MXN' && document.exchangeRate !== undefined && !D(document.exchangeRate).eq(1)) out.push(business('XOL-ADV-001B','Si Moneda es MXN y se informa TipoCambio, debe ser 1.','exchangeRate'));
      if (!['MXN','XXX'].includes(document.currency) && (document.exchangeRate === undefined || D(document.exchangeRate).lt('0.000001'))) out.push(business('XOL-ADV-001C','Una moneda distinta de MXN/XXX requiere TipoCambio válido.','exchangeRate'));
      return out;
    },
  },
  {
    id:'XOL-ADV-002', title:'PPD requiere FormaPago 99', appliesTo:['I','E'], satReference:'Guía de llenado CFDI 4.0 / FormaPago y MetodoPago',
    validate:({ document })=>document.paymentMethod==='PPD'&&document.paymentForm!=='99'?[business('XOL-ADV-002','Cuando MetodoPago es PPD, FormaPago debe ser 99 (Por definir).','paymentForm')]:[],
  },
  {
    id:'XOL-ADV-003', title:'PUE no usa FormaPago 99', appliesTo:['I'], satReference:'Guía de llenado CFDI 4.0 / comprobantes de ingreso',
    validate:({ document })=>document.paymentMethod==='PUE'&&document.paymentForm==='99'?[business('XOL-ADV-003','En un ingreso PUE, FormaPago 99 no corresponde.','paymentForm')]:[],
  },
  {
    id:'XOL-ADV-004', title:'Descuento total requerido cuando hay descuentos', appliesTo:['I','E'], satReference:'Anexo 20 / Descuento',
    validate:({ document })=>{
      const conceptDiscount = add(...document.concepts.map(c=>c.discount??0));
      if (conceptDiscount.gt(0) && !within(document.discount??0,conceptDiscount,'0.01')) return [totals('XOL-ADV-004','Descuento del comprobante debe coincidir con la suma de descuentos de conceptos.','discount')];
      if (conceptDiscount.eq(0) && !D(document.discount??0).eq(0)) return [totals('XOL-ADV-004B','No debe existir descuento global si ningún concepto tiene descuento.','discount')];
      return [];
    },
  },
  {
    id:'XOL-ADV-005', title:'Cálculo de impuestos por concepto', appliesTo:['I','E','T'], satReference:'Anexo 20 / Impuestos de concepto',
    validate:({ document })=>document.concepts.flatMap(concept=>(concept.taxes??[]).flatMap((tax,ti)=>{
      const path = `concepts.${concept.line}.taxes.${ti}`;
      if (D(tax.base).lt(0)) return [totals('XOL-ADV-005A','La base de impuesto no puede ser negativa.',`${path}.base`)];
      if (tax.factorType==='Exento') return tax.amount===undefined||D(tax.amount).eq(0)?[]:[totals('XOL-ADV-005B','Un traslado Exento no debe llevar importe.',`${path}.amount`)];
      if (tax.rateOrQuota===undefined||D(tax.rateOrQuota).lt(0)) return [totals('XOL-ADV-005C','TasaOCuota es requerida para Tasa/Cuota.',`${path}.rateOrQuota`)];
      if (tax.amount===undefined) return [totals('XOL-ADV-005D','Falta el importe calculado del impuesto.',`${path}.amount`)];
      const expected = mul(tax.base,tax.rateOrQuota);
      return within(tax.amount,expected,tolerance)?[]:[totals('XOL-ADV-005E',`Importe de impuesto inconsistente; esperado ${expected.toFixed()}.`,`${path}.amount`)];
    })),
  },
  {
    id:'XOL-ADV-006', title:'Tipos de relación 01-07', appliesTo:['ALL'], satReference:'Catálogo c_TipoRelacion',
    validate:({ document })=>(document.relatedCfdis??[]).flatMap((group,index)=>relationTypes.has(group.relationType)?[]:[relationship('XOL-ADV-006',`TipoRelacion ${group.relationType} no está soportado por la matriz CFDI 4.0 vigente.`,`relatedCfdis.${index}.relationType`)]),
  },
  {
    id:'XOL-ADV-007', title:'Sustitución 04 requiere UUID', appliesTo:['I','E','T'], satReference:'Catálogo c_TipoRelacion / 04 Sustitución',
    validate:({ document })=>(document.relatedCfdis??[]).flatMap((group,index)=>group.relationType==='04'&&group.uuids.length!==1?[relationship('XOL-ADV-007','La sustitución 04 debe identificar el CFDI sustituido.',`relatedCfdis.${index}.uuids`)]:[]),
  },
  { id:'XOL-ADV-008', title:'Exportación requerida', appliesTo:['ALL'], satReference:'Anexo 20 / Exportacion', validate:({ document })=>document.exportation?[]:[business('XOL-ADV-008','El atributo Exportacion es requerido en CFDI 4.0.','exportation')] },
  { id:'XOL-ADV-009', title:'Información global para público general', appliesTo:['I'], satReference:'Anexo 20 / InformacionGlobal y RFC genérico nacional', validate:({ document })=>document.receiver.rfc===genericPublicRfc&&!document.globalInformation?[business('XOL-ADV-009','Una factura global al RFC genérico nacional requiere InformacionGlobal.','globalInformation')]:[] },
  { id:'XOL-ADV-010', title:'Receptor extranjero', appliesTo:['I','E'], satReference:'Anexo 20 / receptor residente en el extranjero', validate:({ document })=>document.receiver.rfc===foreignRfc&&document.exportation&&document.exportation!=='01'&&!document.receiver.fiscalResidenceCountry?[business('XOL-ADV-010','Para receptor extranjero en operación de exportación se requiere residencia fiscal cuando aplique.','receiver.fiscalResidenceCountry')]:[] },
  {
    id:'XOL-PAGO-ADV-001', title:'Moneda del Pago', appliesTo:['P'], satReference:'Pagos 2.0 / MonedaP y TipoCambioP',
    validate:({ document })=>(document.payments??[]).flatMap((p,pi)=>{
      const out: ValidationFinding[]=[];
      if (p.currency==='XXX') out.push(business('XOL-PAGO-ADV-001A','MonedaP no puede ser XXX.',`payments.${pi}.currency`));
      if (p.currency==='MXN'&&p.exchangeRate!==undefined&&!D(p.exchangeRate).eq(1)) out.push(business('XOL-PAGO-ADV-001B','Si MonedaP es MXN, TipoCambioP debe omitirse o ser 1.',`payments.${pi}.exchangeRate`));
      if (p.currency!=='MXN'&&(p.exchangeRate===undefined||D(p.exchangeRate).lte(0))) out.push(business('XOL-PAGO-ADV-001C','Pago en moneda distinta de MXN requiere TipoCambioP.',`payments.${pi}.exchangeRate`));
      return out;
    }),
  },
  {
    id:'XOL-PAGO-ADV-002', title:'EquivalenciaDR', appliesTo:['P'], satReference:'Pagos 2.0 / MonedaDR y EquivalenciaDR',
    validate:({ document })=>(document.payments??[]).flatMap((p,pi)=>p.relatedDocuments.flatMap((d,di)=>{
      const path=`payments.${pi}.relatedDocuments.${di}.equivalence`;
      if (d.currency===p.currency&&d.equivalence!==undefined&&!D(d.equivalence).eq(1)) return [business('XOL-PAGO-ADV-002A','Si MonedaDR y MonedaP son iguales, EquivalenciaDR debe ser 1 u omitirse según el XML final.',path)];
      if (d.currency!==p.currency&&(d.equivalence===undefined||D(d.equivalence).lte(0))) return [business('XOL-PAGO-ADV-002B','Cuando MonedaDR difiere de MonedaP se requiere EquivalenciaDR positiva.',path)];
      return [];
    })),
  },
  {
    id:'XOL-PAGO-ADV-003', title:'Monto cubre documentos relacionados', appliesTo:['P'], satReference:'Pagos 2.0 / Monto e ImpPagado',
    validate:({ document })=>(document.payments??[]).flatMap((p,pi)=>{
      let required=D(0);
      for(const d of p.relatedDocuments){
        const eq=d.currency===p.currency?D(1):D(d.equivalence??0);
        if(eq.gt(0)) required=required.plus(D(d.paidAmount).div(eq));
      }
      return D(p.amount).plus(tolerance).gte(required)?[]:[totals('XOL-PAGO-ADV-003',`Monto del pago es insuficiente para los documentos relacionados; mínimo ${required.toFixed()}.`,`payments.${pi}.amount`)];
    }),
  },
];
