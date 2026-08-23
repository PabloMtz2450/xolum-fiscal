import type { Pool } from 'pg';
import { sha256, type AuthContext, type Role } from './security';

export type ResolvedSession = AuthContext & {
  sessionId: string;
  csrfHash: string;
  expiresAt: Date;
};

/**
 * Primera frontera de autenticación: busca únicamente por hash de un token
 * HttpOnly aleatorio. El tenant no se acepta del cliente. active_tenant_id está
 * enlazado por FK a memberships, por lo que la sesión no puede apuntar a una
 * empresa donde el usuario no pertenezca.
 */
export async function resolveSession(
  pool: Pool,
  rawSessionToken: string | undefined,
  now = new Date(),
): Promise<ResolvedSession | null> {
  if (!rawSessionToken || rawSessionToken.length < 32) return null;
  const tokenHash = sha256(rawSessionToken);

  const result = await pool.query<{
    session_id: string;
    user_id: string;
    tenant_id: string;
    role: Role;
    csrf_hash: string;
    expires_at: Date;
    mfa_verified_at: Date | null;
  }>(
    `SELECT s.id AS session_id,
            s.user_id,
            s.active_tenant_id AS tenant_id,
            m.role,
            s.csrf_hash,
            s.expires_at,
            s.mfa_verified_at
       FROM sessions s
       JOIN users u
         ON u.id = s.user_id
       JOIN tenants t
         ON t.id = s.active_tenant_id
       JOIN memberships m
         ON m.user_id = s.user_id
        AND m.tenant_id = s.active_tenant_id
      WHERE s.token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > $2
        AND u.disabled_at IS NULL
        AND t.active = true
      LIMIT 1`,
    [tokenHash, now],
  );

  const row = result.rows[0];
  if (!row) return null;

  const mfaMaxAgeMs = Number(process.env.MFA_MAX_AGE_MS ?? 15 * 60 * 1000);
  const mfaVerified = Boolean(
    row.mfa_verified_at && now.getTime() - new Date(row.mfa_verified_at).getTime() <= mfaMaxAgeMs,
  );

  return {
    sessionId: row.session_id,
    userId: row.user_id,
    tenantId: row.tenant_id,
    role: row.role,
    csrfHash: row.csrf_hash,
    expiresAt: new Date(row.expires_at),
    mfaVerified,
  };
}

export async function revokeSession(pool: Pool, sessionId: string, userId: string): Promise<void> {
  await pool.query(
    `UPDATE sessions SET revoked_at=now() WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL`,
    [sessionId, userId],
  );
}
