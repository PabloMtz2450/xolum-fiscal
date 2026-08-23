import { describe, expect, it } from 'vitest';
import { D, add, moneyText, mul, within } from './fiscal-decimal';

describe('fiscal decimal arithmetic', () => {
  it('evita el clásico error binario 0.1 + 0.2', () => {
    expect(add('0.1','0.2').toString()).toBe('0.3');
  });

  it('multiplica cantidades y precios sin pérdida binaria', () => {
    expect(mul('4.01','2.01').toString()).toBe('8.0601');
  });

  it('serializa moneda con redondeo HALF_UP explícito', () => {
    expect(moneyText('1.005', 2)).toBe('1.01');
  });

  it('compara con tolerancia decimal explícita', () => {
    expect(within('100.0000001','100','0.000001')).toBe(true);
    expect(within('100.00001','100','0.000001')).toBe(false);
  });

  it('mantiene precisión alta para tipos de cambio', () => {
    expect(D('17.123456789').mul('100').toString()).toBe('1712.3456789');
  });
});
