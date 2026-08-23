# Hardening de preproducción

El PR implementa una capa de seguridad y consistencia previa a conectar infraestructura productiva.

## Evidencia automática actual

GitHub Actions `XOLUM Fiscal CI` run #63: **GREEN**.

- typecheck: PASS
- tests: PASS — 34/34
- build de producción: PASS
- npm audit HIGH/CRITICAL: PASS

## Implementado en código

- PostgreSQL multi-tenant con RLS + FORCE RLS para datos tenant-scoped.
- Sesiones resueltas por token hash; tenant activo validado por FK a membership.
- RBAC, CSRF, scrypt, TOTP/MFA y validación Zod server-side.
- Aritmética fiscal determinista con `decimal.js`.
- Estados fiscales e intentos idempotentes persistibles.
- Repositorio PostgreSQL SERIALIZABLE + `FOR UPDATE` para timbrado.
- Regla `READY -> STAMPING -> STAMPED | REJECTED | UNKNOWN`.
- `UNKNOWN` nunca se reintenta a ciegas.
- Timbrado no durable deshabilitado en producción.
- Timeout SOAP Finkok, precisión de consulta SAT y clientes SOAP cacheados.
- Abstracciones de Secret Manager/KMS y Object Storage inmutable con checksum.
- Logging JSON con correlation ID y redacción de datos sensibles.
- Headers HTTP, CSP y rate limiting local proxy-aware.
- Next.js 16.3.2, React 19.2.8, SOAP 1.10.0 y Vitest 3.2.7.
- Proxy de Next 16 en lugar del convenio middleware deprecado.

## Requisitos externos antes de producción

1. PostgreSQL administrado TLS + backups + PITR y pruebas de restore/RLS/concurrencia.
2. Secret Manager/KMS real; secretos por entorno no autorizados en producción.
3. Object Storage privado con SSE-KMS, versionado y Object Lock/inmutabilidad.
4. Redis/WAF para rate limit distribuido.
5. Finkok DEMO: I/E/T/P, cancelaciones, timeout y recuperación de estados ambiguos.
6. Pruebas de carga/concurrencia y aislamiento tenant.
7. Collector de logs/metrics/traces.
8. Backend persistente de Sales Lite y endpoints con los guards de sesión/RBAC.
9. Lockfile reproducible y migración de CI a `npm ci`.

**Producción sigue NO-GO hasta tener evidencia de estos componentes.**
