import Decimal from 'decimal.js';

/**
 * Toda aritmética fiscal debe pasar por Decimal. No use operadores + - * /
 * directamente sobre importes, tasas, saldos o tipos de cambio.
 */
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export type DecimalInput = Decimal.Value;

export const D = (value: DecimalInput | undefined | null): Decimal => new Decimal(value ?? 0);
export const eq = (a: DecimalInput, b: DecimalInput) => D(a).eq(D(b));
export const gt = (a: DecimalInput, b: DecimalInput) => D(a).gt(D(b));
export const gte = (a: DecimalInput, b: DecimalInput) => D(a).gte(D(b));
export const lte = (a: DecimalInput, b: DecimalInput) => D(a).lte(D(b));
export const add = (...values: DecimalInput[]): Decimal => values.reduce<Decimal>((acc, value) => acc.plus(D(value)), new Decimal(0));
export const sub = (a: DecimalInput, b: DecimalInput): Decimal => D(a).minus(D(b));
export const mul = (a: DecimalInput, b: DecimalInput): Decimal => D(a).mul(D(b));

/** Comparación fiscal con tolerancia explícita, nunca por floating point. */
export function within(a: DecimalInput, b: DecimalInput, tolerance: DecimalInput = '0.000001'): boolean {
  return D(a).minus(D(b)).abs().lte(D(tolerance));
}

/** Serialización decimal sin notación exponencial. */
export function decimalText(value: DecimalInput, maxPlaces = 6): string {
  return D(value).toDecimalPlaces(maxPlaces, Decimal.ROUND_HALF_UP).toFixed();
}

/** Importes monetarios estándar; la moneda/catálogo puede exigir otra escala. */
export function moneyText(value: DecimalInput, places = 2): string {
  return D(value).toDecimalPlaces(places, Decimal.ROUND_HALF_UP).toFixed(places);
}
