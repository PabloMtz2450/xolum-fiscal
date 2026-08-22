import { describe, expect, it } from 'vitest';
import { advancedFiscalRules } from './advanced-rules';
import type { NormalizedCfdiDocument } from './model';

const base: NormalizedCfdiDocument = {
  version: '4.0', type: 'I', issueDate: '2026-08-22T10:00:00', expeditionPostalCode: '06000', currency: 'MXN', exchangeRate: 1,
  subtotal: 100, total: 116, paymentMethod: 'PUE', paymentForm: '03', cfdiUse: 'G03', exportation: '01',
  issuer: { rfc: 'AAA010101AAA', name: 'EMISOR SA DE CV', fiscalRegime: '601', postalCode: '06000' },
  receiver: { rfc: 'BBB010101BBB', name: 'RECEPTOR SA DE CV', fiscalRegime: '601', postalCode: '01000' },
  concepts: [{ line: 1, productServiceKey: '44111500', description: 'ARTICULO', quantity: 1, unitKey: 'H87', unitPrice: 100, amount: 100, taxObject: '02', taxes: [{ kind: 'TRANSFER', tax: '002', factorType: 'Tasa', rateOrQuota: 0.16, base: 100, amount: 16 }] }],
};

function findings(doc: NormalizedCfdiDocument) {
  return advancedFiscalRules.flatMap((r) => (r.appliesTo[0] === 'ALL' || (r.appliesTo as string[]).includes(doc.type)) ? r.validate({ document: doc, now: new Date() }) : []);
}

describe('advanced SAT prestamp rules', () => {
  it('acepta ingreso base consistente', () => {
    expect(findings(base).filter(f => f.severity === 'ERROR')).toHaveLength(0);
  });

  it('bloquea PPD sin forma 99', () => {
    expect(findings({ ...base, paymentMethod: 'PPD', paymentForm: '03' }).some(f => f.code === 'XOL-ADV-002')).toBe(true);
  });

  it('bloquea USD sin TipoCambio', () => {
    expect(findings({ ...base, currency: 'USD', exchangeRate: undefined }).some(f => f.code === 'XOL-ADV-001C')).toBe(true);
  });

  it('bloquea tipo de relación fuera de 01-07', () => {
    expect(findings({ ...base, relatedCfdis: [{ relationType: '99', uuids: ['F1C18A02-8279-4130-8A09-FE4EB573CB95'] }] }).some(f => f.code === 'XOL-ADV-006')).toBe(true);
  });

  it('bloquea factura global sin InformacionGlobal', () => {
    const receiver = { ...base.receiver, rfc: 'XAXX010101000' };
    expect(findings({ ...base, receiver }).some(f => f.code === 'XOL-ADV-009')).toBe(true);
  });

  it('bloquea impuesto matemáticamente inconsistente', () => {
    const doc = structuredClone(base); doc.concepts[0].taxes![0].amount = 15;
    expect(findings(doc).some(f => f.code === 'XOL-ADV-005E')).toBe(true);
  });

  it('bloquea REP multimoneda sin EquivalenciaDR', () => {
    const doc: NormalizedCfdiDocument = {
      ...base, type: 'P', currency: 'XXX', exchangeRate: undefined, subtotal: 0, total: 0, paymentMethod: undefined, paymentForm: undefined, concepts: [], cfdiUse: 'CP01',
      payments: [{ paymentDate: '2026-08-22T10:00:00', paymentForm: '03', currency: 'MXN', amount: 100, relatedDocuments: [{ uuid: 'F1C18A02-8279-4130-8A09-FE4EB573CB95', currency: 'USD', installmentNumber: 1, previousBalance: 10, paidAmount: 5, remainingBalance: 5, taxObject: '01' }] }],
    };
    expect(findings(doc).some(f => f.code === 'XOL-PAGO-ADV-002B')).toBe(true);
  });
});
