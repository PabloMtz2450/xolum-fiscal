# Hardening de preproducción

El PR implementa una capa de seguridad y consistencia previa a conectar infraestructura productiva.

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
- CI: typecheck + tests + build + dependency audit.
- Next.js actualizado desde una versión vulnerable a 15.5.23.

## Requisitos externos antes de producción

1. PostgreSQL administrado TLS + backups + PITR y pruebas de restore.
2. Secret Manager/KMS real; secretos por entorno no autorizados en producción.
3. Object Storage privado con SSE-KMS, versionado y Object Lock/inmutabilidad.
4. Redis/WAF para rate limit distribuido.
5. Finkok DEMO: I/E/T/P, cancelaciones, timeout y recuperación de estados ambiguos.
6. Pruebas de carga/concurrencia y aislamiento tenant.
7. Collector de logs/metrics/traces.

**Producción sigue NO-GO hasta tener evidencia de estos componentes y CI verde.**
