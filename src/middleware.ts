import { NextResponse, type NextRequest } from 'next/server';
import { rateLimit, secureResponse } from './infrastructure/request-security';

const sensitive = /^\/api\/(auth|fiscal\/stamp|fiscal\/cancel|xml\/import)/;

export function middleware(request: NextRequest) {
  const max = sensitive.test(request.nextUrl.pathname) ? 30 : 120;
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID();

  if (!rateLimit(request, max)) {
    const limited = NextResponse.json({ error: 'Demasiadas solicitudes.', requestId }, { status: 429 });
    limited.headers.set('Retry-After', '60');
    limited.headers.set('X-Request-Id', requestId);
    return secureResponse(limited);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('X-Request-Id', requestId);
  return secureResponse(response);
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
