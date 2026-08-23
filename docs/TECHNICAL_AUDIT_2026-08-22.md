# XOLUM Fiscal — Auditoría técnica de preproducción

Fecha: 2026-08-22

## Resumen ejecutivo

Estado general: **NO APTO PARA PRODUCCIÓN TODAVÍA**.

El núcleo fiscal está bien encaminado: existe generación determinista de XML CFDI 4.0, cadena original, firma CSD, validación XSD, reglas SAT, adaptador Finkok y pruebas unitarias. Sin embargo, la plataforma carece todavía de varias capas operativas obligatorias para producción: persistencia transaccional, autenticación/sesiones, RBAC, almacenamiento seguro de CFDI/PDF, auditoría durable, idempotencia persistida, recuperación ante estados ambiguos de PAC, rate limiting y observabilidad.

La principal conclusión es que el riesgo actual ya no está concentrado en el XML, sino en **quién puede ejecutar acciones, cómo se persiste el estado y qué ocurre cuando una operación externa queda en estado incierto**.

---

## Hallazgos críticos

### C-01 — No existe persistencia transaccional ni base de datos productiva

**Impacto:** no hay atomicidad entre pedido, preparación fiscal, envío PAC, respuesta, UUID y expediente. Ante caída de proceso o respuesta parcial puede perderse el estado real de una factura.

**Riesgos:** doble timbrado, documento timbrado no registrado, pedido marcado incorrectamente, imposibilidad de rollback/recuperación.

**Mitigación:** incorporar PostgreSQL + ORM/migraciones; usar transacciones; estados explícitos `DRAFT -> READY -> STAMPING -> STAMPED|FAILED|UNKNOWN`; tabla de intentos PAC; constraints únicos por tenant/serie/folio/idempotencyKey/UUID.

### C-02 — Idempotencia sólo calculada en memoria

`CfdiStampingService` calcula SHA-256 del XML, pero no existe almacenamiento durable ni bloqueo distribuido. El `idempotencyKey` tampoco es una garantía nativa de Finkok.

**Impacto:** si la red se corta después de que Finkok timbra pero antes de recibir respuesta, un reintento puede entrar sin saber si el primer intento terminó.

**Mitigación:** persistir idempotencyKey antes de llamar PAC; constraint único; lock transaccional/advisory lock; estado `UNKNOWN`; primero recuperar vía Finkok (`stamped`, `query_pending` o consulta por UUID/atributos) antes de reintentar.

### C-03 — Autenticación y RBAC no implementados

No existe middleware de sesión, usuarios, roles ni autorización backend. Las pantallas actuales son UI/maqueta y no hay una frontera de seguridad de aplicación.

**Impacto:** cuando se agreguen endpoints, cualquier omisión puede permitir timbrar, cancelar o consultar información sin autorización.

**Mitigación:** autenticación server-side; sesiones HttpOnly/Secure/SameSite; MFA para administradores; RBAC/ABAC en cada servicio y endpoint; separación tenant; roles mínimos: Admin, Fiscal, Facturación, Cobranza, Consulta, Auditor.

### C-04 — No existe almacenamiento durable/seguro de XML y PDF

Hoy se genera y devuelve XML en memoria, pero no existe repositorio inmutable del XML original, XML timbrado, acuse/cancelación y PDF.

**Impacto:** pérdida de documentos fiscales, dificultad de auditoría y recuperación.

**Mitigación:** object storage cifrado (S3-compatible), versionado, checksum SHA-256, claves por tenant/RFC/UUID, política de retención, backups y pruebas de restore. La BD guarda metadatos y hash, no blobs grandes salvo necesidad.

---

## Hallazgos altos

### A-01 — CSD y llaves dependen de rutas/variables pero falta un secret store

`.env.example` evita secretos reales, lo cual es correcto, pero producción no debe guardar contraseña CSD/PAC en archivos `.env` persistentes ni filesystem compartido.

**Mitigación:** Secret Manager/KMS/Vault; llave privada cifrada en reposo; acceso mínimo por servicio; nunca exponer llave al navegador; rotación y auditoría.

### A-02 — Falta recuperación robusta de errores PAC

Existe `query_pending`, cancelación y consulta SAT, pero el servicio de timbrado aún no implementa una state machine durable de recuperación.

**Mitigación:** clasificar errores retryable/no retryable; exponential backoff + jitter; circuit breaker; no reintentar errores fiscales deterministas; job de reconciliación de estados `STAMPING/UNKNOWN/PENDING`.

### A-03 — Finkok cancelación necesita máquina de estados

Código 201 no significa cancelado. Debe existir `CANCEL_REQUESTED`, `PENDING_ACCEPTANCE`, `CANCELLED`, `REJECTED`, `NOT_CANCELLABLE`, etc., con polling controlado y auditoría.

### A-04 — Validación fiscal avanzada todavía requiere corpus real

El motor tiene reglas I/E/T/P y XSD, pero antes de producción falta certificar escenarios completos, especialmente Pagos 2.0 con impuestos DR/P, complementos y casos límite de catálogos/tolerancias.

**Mitigación:** corpus positivo/negativo versionado; fixtures de errores SAT/Finkok; sandbox real; todo rechazo inesperado se convierte en test de regresión.

### A-05 — Validación backend aún no está conectada a endpoints porque no existen endpoints reales

Las reglas están en dominio, pero la UI de pedidos contiene datos estáticos. Cuando se creen APIs, toda validación debe ejecutarse server-side y jamás confiar en los campos enviados por UI.

### A-06 — Falta aislamiento multi-tenant explícito

No existe `tenant_id`/empresa en persistencia porque aún no hay BD. Para SaaS es obligatorio impedir cruces entre RFC/empresas.

**Mitigación:** tenantId obligatorio en cada agregado y query, policies de acceso, constraints compuestos, pruebas de IDOR.

### A-07 — Logging/observabilidad todavía inexistentes

No hay logger estructurado, correlation IDs, métricas de PAC, alertas ni redacción de secretos/XML sensibles.

**Mitigación:** JSON logs; requestId/operationId; jamás registrar CSD, contraseñas o XML completo; métricas de latencia/error/timbrado; tracing; alertas sobre tasas de rechazo y operaciones UNKNOWN.

---

## Hallazgos medios

### M-01 — Conciliación automática es demasiado permisiva como concepto de dominio

El motor permite `AUTOMATIC` con score >=95 y referencia identificada. Esto debe seguir deshabilitado por defecto y exigir además identificación inequívoca del cliente y ausencia de múltiples candidatos.

### M-02 — `xsltproc` usa archivos temporales

El uso de `shell:false`, `--nonet`, directorio temporal único y borrado es positivo. Aun así, producción debe ejecutar con usuario sin privilegios, filesystem temporal aislado, límites CPU/memoria y assets XSLT inmutables/verificados por checksum.

### M-03 — Dependencias/CI

CI ejecuta typecheck y tests, pero usa `npm install`. Para builds reproducibles debe existir `package-lock.json` y usar `npm ci`. Agregar `npm audit`/SCA, CodeQL y secret scanning.

### M-04 — Falta rate limiting y protección anti-abuso

Especialmente en login, timbrado, cancelaciones, importación XML y consulta SAT.

### M-05 — CSRF/CORS/cabeceras de seguridad no definidos

Cuando existan endpoints con cookies: CSRF tokens/origin checks; CORS deny-by-default; CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.

### M-06 — PDF aún no definido

El PDF debe generarse a partir del XML timbrado, nunca como fuente fiscal. Debe conservar UUID/QR/cadena/timbre y checksum; fallo de PDF no debe revertir un timbrado válido, sino quedar como tarea recuperable.

---

## Hallazgos bajos / mejoras

### B-01 — Healthcheck PAC en cada timbrado puede añadir latencia

Conviene healthcheck cacheado/circuit breaker y no cargar WSDL en cada operación.

### B-02 — Catálogos y XSD requieren versionado verificable

Guardar fecha de descarga, checksum y fuente; despliegue atómico de nuevos bundles.

### B-03 — Pruebas de rendimiento aún inexistentes

Crear carga con lotes de pedidos, generación XML, firma/XSLT y concurrencia PAC. Separar workers de timbrado de la UI.

---

## Seguridad por amenaza

- SQL Injection: riesgo futuro; usar ORM/prepared statements y nunca concatenar SQL.
- NoSQL Injection: no aplica hoy; validar objetos/operadores si se introduce NoSQL.
- XSS: React escapa por defecto; evitar `dangerouslySetInnerHTML` para datos de clientes/XML.
- XML/XXE: parsers deben deshabilitar entidades externas y acceso a red; XSLT ya usa `--nonet`.
- CSRF: obligatorio si autenticación usa cookies.
- IDOR: tenant/owner/role debe validarse server-side en cada recurso.
- SSRF: conectores deben usar allowlist de endpoints; no aceptar URLs PAC/TMS arbitrarias desde usuario.
- Secrets: KMS/Vault y redacción de logs.
- Concurrencia: locks/constraints únicos en timbrado, cancelación, REP y aplicación de pagos.

---

## Arquitectura recomendada antes de conectar producción

1. Web/UI Next.js sin secretos.
2. API/servicios server-side con auth/RBAC.
3. PostgreSQL para estados y transacciones.
4. Cola/worker para timbrado/cancelación/PDF/reintentos.
5. Object storage cifrado para XML/PDF/acuses.
6. Secret Manager/KMS para PAC/CSD.
7. Finkok adapter aislado.
8. Observabilidad centralizada.
9. Jobs de reconciliación de estados PAC/SAT.

### Flujo de timbrado transaccional recomendado

`READY -> crear StampAttempt + idempotencyKey -> commit -> lock -> preparar/firmar/validar -> PAC -> persistir XML/UUID -> STAMPED`

Si ocurre timeout después de enviar:

`STAMPING -> UNKNOWN -> recovery job -> consultar Finkok/SAT -> STAMPED o SAFE_TO_RETRY`

Nunca reintentar a ciegas.

---

## Go/No-Go

### Puede avanzar a sandbox Finkok

**Sí**, siempre que se use información de prueba y no datos/credenciales productivos.

### Puede avanzar a producción

**No** hasta cerrar como mínimo C-01, C-02, C-03, C-04 y A-01/A-02/A-03/A-06/A-07.

## Orden de mitigación recomendado

1. Persistencia PostgreSQL + modelo de estados + migraciones.
2. Idempotencia durable y recuperación PAC.
3. Auth + RBAC + tenant isolation.
4. Secret manager para CSD/Finkok.
5. Object storage XML/PDF/acuses.
6. Auditoría/logs/métricas.
7. Endpoints server-side validados.
8. Sandbox Finkok completo I/E/T/P.
9. Pruebas de concurrencia, fallos de red y carga.
10. Hardening HTTP/CI/dependencias.

## Dictamen

**Núcleo fiscal: sólido para seguir desarrollando y entrar a pruebas controladas. Plataforma SaaS: aún incompleta para producción.**

No se recomienda poner RFC/CSD reales ni permitir timbrado de clientes productivos hasta completar los controles críticos anteriores.
