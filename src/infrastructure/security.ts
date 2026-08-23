import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export type Role = 'OWNER'|'ADMIN'|'FISCAL_MANAGER'|'BILLER'|'COLLECTIONS'|'AUDITOR'|'READ_ONLY';
export type Permission = 'fiscal:read'|'fiscal:stamp'|'fiscal:cancel'|'orders:write'|'payments:write'|'admin:users'|'audit:read';

const all = new Set<Permission>(['fiscal:read','fiscal:stamp','fiscal:cancel','orders:write','payments:write','admin:users','audit:read']);
const grants: Record<Role, ReadonlySet<Permission>> = {
  OWNER: all,
  ADMIN: all,
  FISCAL_MANAGER: new Set(['fiscal:read','fiscal:stamp','fiscal:cancel','orders:write','audit:read']),
  BILLER: new Set(['fiscal:read','fiscal:stamp','orders:write']),
  COLLECTIONS: new Set(['fiscal:read','payments:write']),
  AUDITOR: new Set(['fiscal:read','audit:read']),
  READ_ONLY: new Set(['fiscal:read']),
};

export type AuthContext = {
  userId: string;
  tenantId: string;
  role: Role;
  mfaVerified: boolean;
};

export function requirePermission(role: Role, permission: Permission): void {
  if (!grants[role].has(permission)) throw new Error('FORBIDDEN');
}

/** Acciones irreversibles/administrativas requieren MFA reciente. */
export function authorize(context: AuthContext, permission: Permission, requireMfa = false): void {
  if (!context.userId || !context.tenantId) throw new Error('UNAUTHENTICATED');
  requirePermission(context.role, permission);
  if (requireMfa && !context.mfaVerified) throw new Error('MFA_REQUIRED');
}

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export function hashPassword(password: string): string {
  if (password.length < 12) throw new Error('PASSWORD_TOO_SHORT');
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algorithm, nText, rText, pText, saltText, hashText] = stored.split('$');
  if (algorithm !== 'scrypt' || !saltText || !hashText) return false;
  const expected = Buffer.from(hashText, 'base64');
  const actual = scryptSync(password, Buffer.from(saltText, 'base64'), expected.length, {
    N: Number(nText), r: Number(rText), p: Number(pText),
  });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const newSessionToken = () => randomBytes(32).toString('base64url');
export const newCsrfToken = () => randomBytes(32).toString('base64url');

export function verifyTotp(secret: Buffer, code: string, now = Date.now()): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  for (let drift = -1; drift <= 1; drift++) {
    const counter = Math.floor(now / 30_000) + drift;
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64BE(BigInt(counter));
    const mac = createHmac('sha1', secret).update(buffer).digest();
    const offset = mac[19] & 15;
    const numeric = (mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
    const expected = Buffer.from(String(numeric).padStart(6, '0'));
    const actual = Buffer.from(code);
    if (expected.length === actual.length && timingSafeEqual(actual, expected)) return true;
  }
  return false;
}

export function assertCsrf(cookieToken?: string, headerToken?: string, storedHash = ''): void {
  if (!cookieToken || !headerToken || !storedHash) throw new Error('CSRF_REJECTED');
  const a = Buffer.from(sha256(cookieToken), 'hex');
  const b = Buffer.from(sha256(headerToken), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length || a.length !== stored.length || !timingSafeEqual(a, b) || !timingSafeEqual(a, stored)) {
    throw new Error('CSRF_REJECTED');
  }
}
