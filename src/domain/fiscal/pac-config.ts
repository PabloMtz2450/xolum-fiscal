export type PacRuntimeConfig = {
  provider: 'finkok';
  environment: 'SANDBOX' | 'PRODUCTION';
  username: string;
  password: string;
  timeoutMs: number;
};

export type PacConfigValidation = {
  ok: boolean;
  config?: PacRuntimeConfig;
  errors: string[];
};

/** Fail closed para FINKOK. */
export function readPacConfig(env: Record<string, string | undefined> = process.env): PacConfigValidation {
  const errors: string[] = [];
  const provider = env.PAC_PROVIDER?.trim().toLowerCase() ?? '';
  const environment = env.PAC_ENVIRONMENT === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX';
  const username = env.FINKOK_USERNAME?.trim() ?? '';
  const password = env.FINKOK_PASSWORD?.trim() ?? '';
  const timeoutMs = Number(env.PAC_TIMEOUT_MS ?? '30000');

  if (provider !== 'finkok') errors.push('PAC_PROVIDER debe ser finkok.');
  if (!username) errors.push('FINKOK_USERNAME es requerido.');
  if (!password) errors.push('FINKOK_PASSWORD es requerido.');
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120000) errors.push('PAC_TIMEOUT_MS debe estar entre 1000 y 120000 ms.');

  if (errors.length) return { ok: false, errors };
  return { ok: true, errors: [], config: { provider: 'finkok', environment, username, password, timeoutMs } };
}
