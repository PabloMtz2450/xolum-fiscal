# Hardening de preproducción

Se incorporan PostgreSQL multi-tenant + RLS, estados fiscales, intentos idempotentes, sesiones/auditoría, RBAC backend, scrypt, TOTP MFA, CSRF, abstracciones de KMS/Object Storage, logging con redacción, headers HTTP y rate limit local.

Regla PAC: `READY -> STAMPING -> STAMPED | REJECTED | UNKNOWN`. `UNKNOWN` nunca se reintenta a ciegas: primero consultar Finkok/SAT; UUID encontrado => STAMPED; evidencia de no timbrado => SAFE_TO_RETRY.

Antes de producción aún requieren infraestructura real: PostgreSQL administrado TLS+PITR y repositorio transaccional con `FOR UPDATE`; Secret Manager/KMS; bucket privado SSE-KMS + versionado/object-lock; rate limiting distribuido Redis/WAF; credenciales DEMO Finkok para I/E/T/P/cancelación/fallos de red; pruebas de carga aisladas. NO-GO hasta probar esos componentes.
