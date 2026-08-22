import { describe, expect, it } from 'vitest';
import { readPacConfig } from './pac-config';

describe('PAC runtime config', () => {
  it('bloquea configuración incompleta', () => {
    expect(readPacConfig({ PAC_PROVIDER: 'finkok' }).ok).toBe(false);
  });

  it('acepta Finkok sandbox configurado', () => {
    const result = readPacConfig({
      PAC_PROVIDER: 'finkok',
      PAC_ENVIRONMENT: 'SANDBOX',
      FINKOK_USERNAME: 'demo@example.com',
      FINKOK_PASSWORD: 'secret',
      PAC_TIMEOUT_MS: '30000',
    });
    expect(result.ok).toBe(true);
    expect(result.config?.provider).toBe('finkok');
    expect(result.config?.environment).toBe('SANDBOX');
  });
});
