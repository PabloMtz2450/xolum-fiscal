import { describe, expect, it } from 'vitest';
import { readPacConfig } from './pac-config';

describe('PAC runtime config', () => {
  it('bloquea configuración mock/incompleta', () => {
    expect(readPacConfig({ PAC_PROVIDER: 'mock' }).ok).toBe(false);
  });

  it('acepta sandbox configurado', () => {
    const result = readPacConfig({
      PAC_PROVIDER: 'pac-ejemplo',
      PAC_ENVIRONMENT: 'SANDBOX',
      PAC_BASE_URL: 'https://sandbox.pac.example',
      PAC_API_KEY: 'key',
      PAC_API_SECRET: 'secret',
      PAC_TIMEOUT_MS: '30000',
    });
    expect(result.ok).toBe(true);
    expect(result.config?.environment).toBe('SANDBOX');
  });
});
