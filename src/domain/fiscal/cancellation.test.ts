import { describe, expect, it } from 'vitest';
import { validateCancellationRequest } from './cancellation';

const uuid = 'F1C18A02-8279-4130-8A09-FE4EB573CB95';
const replacement = 'BAAA2522-3DE4-44FC-BE22-175F2DF6086B';

describe('SAT cancellation request validation', () => {
  it('acepta motivo 01 con UUID sustituto', () => {
    expect(validateCancellationRequest({ uuid, reason: '01', replacementUuid: replacement }).ok).toBe(true);
  });

  it('bloquea motivo 01 sin sustitución', () => {
    const result = validateCancellationRequest({ uuid, reason: '01' });
    expect(result.errors.some(e => e.code === 'XOL-CAN-003')).toBe(true);
  });

  it('bloquea sustitución en motivo distinto de 01', () => {
    const result = validateCancellationRequest({ uuid, reason: '02', replacementUuid: replacement });
    expect(result.errors.some(e => e.code === 'XOL-CAN-006')).toBe(true);
  });
});
