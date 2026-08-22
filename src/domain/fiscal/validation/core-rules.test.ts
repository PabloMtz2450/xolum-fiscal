import { describe, expect, it } from 'vitest';
import { coreFiscalRules } from './core-rules';
import type { NormalizedCfdiDocument } from './model';

const base: NormalizedCfdiDocument = {
  version: '4.0', type: 'I', issueDate: '2026-08-21T12:00:00', expeditionPostalCode: '06000', currency: 'MXN',
  subtotal: 100, total: 116, paymentMethod: 'PUE', paymentForm: '03', cfdiUse: 'G03',
  issuer: { rfc: 'AAA010101AAA', name: 'EMISOR SA DE CV', fiscalRegime: '601', postalCode: '06000' },
  receiver: { rfc: 'BBB010101BBB', name: 'RECEPTOR SA DE CV', fiscalRegime: '601', postalCode: '01000' },
  concepts: [{ line: 1, productServiceKey: '44111500', description: 'ARTICULO', quantity: 1, unitKey: 'H87', unitPrice: 100, amount: 100, taxObject: '02', taxes: [{ kind: 'TRANSFER', tax: '002', factorType: 'Tasa', rateOrQuota: 0.16, base: 100, amount: 16 }] }],
};

function findings(doc: NormalizedCfdiDocument) {
  return coreFiscalRules.flatMap((r) => (r.appliesTo[0] === 'ALL' || (r.appliesTo as string[]).includes(doc.type)) ? r.validate({ document: doc, now: new Date() }) : []);
}

describe('CFDI 4.0 core prestamp rules', () => {
  it('acepta un ingreso base consistente', () => {
    expect(findings(base).filter(f => f.severity === 'ERROR')).toHaveLength(0);
  });

  it('bloquea subtotal inconsistente', () => {
    const result = findings({ ...base, subtotal: 99 });
    expect(result.some(f => f.code === 'XOL-CFDI-011')).toBe(true);
  });

  it('bloquea total inconsistente', () => {
    const result = findings({ ...base, total: 115 });
    expect(result.some(f => f.code === 'XOL-CFDI-014')).toBe(true);
  });

  it('bloquea impuestos cuando ObjetoImp es 01', () => {
    const doc = structuredClone(base); doc.concepts[0].taxObject = '01';
    expect(findings(doc).some(f => f.code === 'XOL-CFDI-012')).toBe(true);
  });

  it('bloquea traslado con total distinto de cero', () => {
    const doc = { ...base, type: 'T' as const, total: 116 };
    expect(findings(doc).some(f => f.code === 'XOL-CFDI-015')).toBe(true);
  });

  it('bloquea REP con saldos inconsistentes', () => {
    const doc: NormalizedCfdiDocument = {
      ...base, type: 'P', currency: 'XXX', subtotal: 0, total: 0, paymentMethod: undefined, paymentForm: undefined, concepts: [],
      payments: [{ paymentDate: '2026-08-21T10:00:00', paymentForm: '03', currency: 'MXN', amount: 60,
        relatedDocuments: [{ uuid: 'F1C18A02-8279-4130-8A09-FE4EB573CB95', currency: 'MXN', installmentNumber: 1, previousBalance: 100, paidAmount: 60, remainingBalance: 50, taxObject: '01' }] }],
    };
    expect(findings(doc).some(f => f.code === 'XOL-PAGO-005')).toBe(true);
  });

  it('bloquea CFDI relacionado con UUID inválido', () => {
    const doc = { ...base, relatedCfdis: [{ relationType: '01', uuids: ['NO-ES-UUID'] }] };
    expect(findings(doc).some(f => f.code === 'XOL-REL-001')).toBe(true);
  });
});
