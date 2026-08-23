# XOLUM Fiscal — Remediación de hallazgos forenses

Fecha de corte: 2026-08-22

## Criterio de cierre

Un hallazgo no se considera cerrado sólo por existir un parche. Requiere: código + prueba automatizada cuando aplique + CI verde + evidencia de infraestructura/sandbox cuando dependa de servicios externos.

## EXTREMO

### EXT-01 — Aritmética fiscal con `number`
Estado: **MITIGADO EN CÓDIGO / PENDIENTE CI**.

- `decimal.js` con precisión 40 y ROUND_HALF_UP.
- Reglas core/advanced, REP, impuestos y renderer XML migrados a helpers decimales.
- Pruebas de regresión para 0.1+0.2, redondeo 1.005, tasas y tolerancias.

### EXT-02 — Idempotencia no durable / timbrado incierto
Estado: **MITIGADO EN CÓDIGO / PENDIENTE DB REAL + FINKOK DEMO**.

- `PostgresStampRepository` transaccional SERIALIZABLE + `FOR UPDATE`.
- `UNIQUE(tenant_id,idempotency_key)`.
- `UNKNOWN` para transportes inciertos y prohibición de reintento ciego.
- Ruta directa de timbrado bloqueada en producción.

### EXT-03 — Aislamiento multiempresa incompleto
Estado: **MITIGADO EN ESQUEMA / PENDIENTE PRUEBA POSTGRES REAL**.

- RLS + FORCE RLS en memberships, documentos, intentos y auditoría.
- `tenant_id` se deriva de sesión, no de payload.
- FKs compuestas impiden enlazar intento/documento o sesión/membership de tenants distintos.
- Las sesiones se resuelven por hash antes de fijar contexto tenant; después entra RLS.

## ALTO

### ALT-01 — Contrato incorrecto de `PacStampResult`
Estado: **CORREGIDO**. Se usa `result.rejection.message/providerCode`.

### ALT-02 — RBAC no conectado a acciones backend
Estado: **PARCIALMENTE CORREGIDO**.

- `AuthContext`, `authorize`, MFA y schemas server-side disponibles.
- `resolveSession` obtiene usuario/tenant/rol exclusivamente desde sesión.
- Pendiente crear endpoints productivos y aplicar el guard en todos.

### ALT-03 — Regla histórica incorrecta de Egreso
Estado: **CORREGIDO PREVIAMENTE** por commit histórico de la matriz fiscal.

### ALT-04 — CSD/NoCertificado/RFC
Estado: **CORREGIDO PREVIAMENTE** y validado criptográficamente antes de PAC.

### ALT-05 — Timeout Finkok no efectivo
Estado: **CORREGIDO EN ADAPTADOR / PENDIENTE SANDBOX**.

- Timeout configurable aplicado a métodos SOAP.
- Fallos de transporte se clasifican como retryable y pasan a UNKNOWN en flujo durable.

### ALT-06 — Precisión en consulta SAT
Estado: **CORREGIDO EN CÓDIGO** usando decimal determinista en vez de `toFixed(2)`.

## MEDIO

### MED-01 — Rate limiting local/proxy
Estado: **MITIGADO PARCIALMENTE**.

- No se confía en X-Forwarded-For salvo `TRUST_PROXY=true`.
- Límites más estrictos para rutas sensibles.
- Pendiente Redis/WAF distribuido.

### MED-02 — UI de pedidos estática
Estado: **PENDIENTE**. El backend persistente de Sales Lite se implementará antes de producción.

### MED-03 — Precisión agregada de impuestos
Estado: **CORREGIDO EN CÓDIGO** con Decimal.

### MED-04 — Dependencia de `xsltproc`
Estado: **MITIGADO** con `--nonet`, timeout y assets locales; pendiente aislamiento operativo/worker.

### MED-05 — CI/dependencias
Estado: **EN CORRECCIÓN**.

- CI ejecuta typecheck, tests, build y audit high.
- Next.js actualizado de 15.5.2 vulnerable a backport parcheado 15.5.23.
- Pendiente congelar lockfile y pasar auditoría sin HIGH/CRITICAL.

### MED-06 — Carga/concurrencia
Estado: **PENDIENTE INFRAESTRUCTURA**. Requiere PostgreSQL/Finkok demo y escenario de carga aislado.

## BAJO

### BAJ-01 — Código hardening comprimido
Estado: **MEJORADO** en archivos críticos nuevos/modificados.

### BAJ-02 — Logging sólo consola
Estado: **MITIGADO PARCIALMENTE** con JSON, correlation ID y redacción. Pendiente collector/OpenTelemetry.

### BAJ-03 — Healthcheck PAC por timbrado
Estado: **CORREGIDO** con cache de salud/cliente; producción durable no debe depender de una carga WSDL por operación.

## Bloqueos externos que no pueden declararse cerrados en código

1. PostgreSQL administrado con TLS, backups y PITR.
2. KMS/Secret Manager real.
3. Object Storage privado cifrado, versionado y con inmutabilidad.
4. Redis/WAF para rate limiting distribuido.
5. Credenciales Finkok DEMO y RFC/CSD de prueba.
6. Pruebas E2E I/E/T/P, cancelaciones y fallos de red.
7. Prueba de carga y recuperación de backups.

Mientras cualquiera de estos puntos críticos siga sin evidencia, el estado de producción permanece **NO-GO**.
