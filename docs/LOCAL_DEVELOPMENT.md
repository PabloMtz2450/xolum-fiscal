# XOLUM Fiscal — entorno local de desarrollo

Este entorno contiene únicamente datos ficticios. No utilizar CSD, contraseñas Finkok ni datos de clientes reales.

## Requisitos

- Windows 11 / macOS / Linux
- Docker Desktop con Docker Compose
- Node.js 22+
- npm 10+
- Git

## Rama

```powershell
git checkout hardening/preproduction-security-v2
git pull
```

## Inicio rápido en Windows PowerShell

```powershell
Copy-Item .env.local.example .env.local
.\scripts\local-start.ps1
npm run dev
```

Abrir: http://localhost:3000

PostgreSQL local queda publicado sólo para desarrollo en `localhost:54329`.

## Comandos útiles

```powershell
npm run local:up
npm run local:check
npm run local:logs
npm run local:down
npm run local:reset
```

`local:reset` elimina el volumen PostgreSQL y reconstruye migraciones + seed desde cero. Úsalo cuando cambien las migraciones o quieras regresar los datos al estado inicial.

## Usuarios ficticios

| Rol | Usuario | Password |
|---|---|---|
| OWNER | owner@xolum.local | XolumLocal!2026 |
| ADMIN | admin@xolum.local | AdminLocal!2026 |
| BILLER | facturas@xolum.local | FiscalLocal!2026 |
| COLLECTIONS | cobranza@xolum.local | CobranzaLocal!2026 |
| AUDITOR | auditor@xolum.local | AuditorLocal!2026 |
| READ_ONLY | sololectura@xolum.local | LecturaLocal!2026 |
| OWNER tenant 2 | other@demo.local | TenantDos!2026 |

Los hashes son `scrypt`; MFA queda desactivado sólo para facilitar pruebas locales. Antes de producción MFA administrativo sigue siendo obligatorio.

## Empresas ficticias

1. `XOLUM DEMO INDUSTRIAL` — tenant principal con clientes, productos, pedidos y CFDI de prueba.
2. `ACME DEMO LOGISTICA` — tenant separado utilizado para verificar aislamiento RLS.

## Datos cargados

El seed crea:

- 2 empresas/tenants.
- 7 usuarios con distintos roles.
- 6 clientes.
- 6 productos.
- pedidos Sales Lite en DRAFT, VALIDATION_ERROR, READY, RELEASED e INVOICED.
- líneas con OC y posición de OC.
- CFDI ficticios I/E/T/P.
- un CFDI `UNKNOWN` para probar recuperación después de timeout PAC.
- intentos Finkok ficticios STAMPED y UNKNOWN.
- cuentas por cobrar.
- movimientos bancarios con referencia exacta, referencia faltante y pago parcial.
- eventos de auditoría.

## Qué valida `npm run local:check`

Se conecta con el usuario PostgreSQL **no-superuser** `xolum_local_app`, establece `app.tenant_id` y confirma que RLS devuelve únicamente la información del tenant seleccionado. Si tenant 1 puede ver registros del tenant 2, el comando falla.

## Credenciales PostgreSQL local

Administración local Docker:

```text
Host: localhost
Port: 54329
Database: xolum_fiscal
User: xolum
Password: xolum_local_2026
```

Prueba real de RLS:

```text
User: xolum_local_app
Password: xolum_app_local_2026
```

Estas credenciales son deliberadamente públicas dentro del repo porque **sólo sirven para el contenedor local**. No reutilizarlas en ningún servidor.

## PAC Finkok

El archivo `.env.local.example` deja vacíos `FINKOK_USERNAME`, `FINKOK_PASSWORD` y material CSD. La plataforma puede levantarse y revisar Sales Lite/base de datos sin PAC.

Cuando exista una cuenta Finkok DEMO propia, colocar únicamente las credenciales demo en `.env.local`. `.env.local` está ignorado por Git.

## Estado funcional esperado

Al levantar local se puede revisar UI actual, PostgreSQL, datos de Sales Lite, estructura multi-tenant, estados fiscales, conciliación y datos de auditoría. Todavía deben conectarse las pantallas actuales a repositorios/endpoints reales para que crear/editar/liberar pedidos desde UI persista en PostgreSQL.

El objetivo de este entorno es precisamente hacer visible ese faltante, en lugar de esconderlo detrás de una demo preciosa que no guarda nada. Humanos y sus dashboards, una historia eterna.
