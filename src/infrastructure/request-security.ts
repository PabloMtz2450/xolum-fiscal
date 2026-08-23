import { NextResponse, type NextRequest } from 'next/server';

const WINDOW_MS = 60_000;
const DEFAULT_MAX = 120;
const buckets = new Map<string, { count: number; resetAt: number }>();

export function secureResponse(response: NextResponse): NextResponse {
  const headers: Record<string,string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://demo-facturacion.finkok.com https://facturacion.finkok.com",
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Cache-Control': 'no-store',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
  };
  for (const [key,value] of Object.entries(headers)) response.headers.set(key,value);
  return response;
}

/**
 * Sólo confía en X-Forwarded-For cuando la app está detrás de un proxy controlado.
 * En producción este limiter local debe reemplazarse por Redis/WAF distribuido.
 */
export function clientKey(request: NextRequest): string {
  const trustProxy = process.env.TRUST_PROXY === 'true';
  if (trustProxy) {
    const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    if (forwarded) return forwarded;
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

export function rateLimit(request: NextRequest, max = DEFAULT_MAX): boolean {
  const key = clientKey(request);
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= max) return false;
  current.count += 1;
  return true;
}
