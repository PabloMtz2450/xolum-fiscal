export type PacRuntimeConfig = {
  provider: string;
  environment: 'SANDBOX' | 'PRODUCTION';
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
  timeoutMs: number;
};

export type PacConfigValidation = {
  ok: boolean;
  config?: PacRuntimeConfig;
  errors: string[];
};

/**
 * Fail closed: jamás se inicializa un conector real si faltan credenciales
 * o si producción se habilita accidentalmente durante la fase sandbox.
 */
export function readPacConfig(env: Record<string, string | undefined> = process.env): PacConfigValidation {
  const errors: string[] = [];
  const provider = env.PAC_PROVIDER?.trim() ?? '';
  const environment = env.PAC_ENVIRONMENT === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX';
  const baseUrl = env.PAC_BASE_URL?.trim() ?? '';
  const apiKey = env.PAC_API_KEY?.trim() ?? '';
  const apiSecret = env.PAC_API_SECRET?.trim() ?? '';
  const timeoutMs = Number(env.PAC_TIMEOUT_MS ?? '30000');

  if (!provider || provider === 'mock') errors.push('PAC_PROVIDER debe seleccionar un proveedor real para pruebas sandbox.');
  if (!baseUrl || !/^https:\/\//i.test(baseUrl)) errors.push('PAC_BASE_URL debe ser una URL HTTPS válida.');
  if (!apiKey) errors.push('PAC_API_KEY es requerida.');
  if (!apiSecret) errors.push('PAC_API_SECRET es requerida.');
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120000) errors.push('PAC_TIMEOUT_MS debe estar entre 1000 y 120000 ms.');

  if (errors.length) return { ok: false, errors };
  return { ok: true, errors: [], config: { provider, environment, baseUrl, apiKey, apiSecret, timeoutMs } };
}
