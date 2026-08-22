# XOLUM Fiscal

Plataforma modular para transformar pedidos validados en CFDI sin volver a capturar la operación fiscal.

## Principios

- Si no simplifica, no sirve.
- Si no conecta, no aporta.
- Si no resuelve un problema real, no entra.
- La complejidad la resuelve el sistema, no el usuario.

## Producto base

XOLUM Fiscal funciona sin ERP y sin TMS. Incluye **Sales Lite** como origen mínimo de facturación: clientes, artículos, pedidos, partidas, precios, impuestos y OC/posición por línea.

La factura fiscal es una transformación bloqueada del pedido. El facturista puede revisar, validar y timbrar, pero no alterar conceptos, precios, impuestos o referencias fiscales en el último paso.

El núcleo contempla CFDI 4.0, notas de crédito, REP/Pagos 2.0, cancelaciones, relaciones CFDI, expediente fiscal, importación de XML y conciliación asistida.

## Módulos y conectores opcionales

- **XOLUM Addendas**: se vende por separado. Cada addenda se diseña, valida y versiona según el receptor.
- **XOLUM TMS**: POD, evidencias y validación logística. Se contrata por separado.
- **XOLUM Sales Pro**: CRM/cotizaciones/capacidades comerciales avanzadas; Sales Lite permanece incluido.
- **XOLUM Connect**: ERP, PAC, correo, portales, APIs e importaciones.
- **Conciliación bancaria**: por defecto asistida; sólo puede pasar a automática cuando las referencias permiten identificar el pago de forma confiable.

## Arquitectura

```text
ERP / Sales Lite
       |
       v
Pedido fuente de verdad
       |
       v
XOLUM Fiscal Core
       |
       +--> Reglas SAT / catálogos / complementos
       +--> XML / XSD / cadena / CSD / sello
       +--> PAC preflight
       |
       v
PAC sandbox / producción
       |
       +--> timbrado
       +--> cancelación
       +--> estado SAT

XOLUM TMS (opcional) -> POD/evidencias -> elegibilidad logística
Banco (opcional)     -> movimientos -> conciliación asistida
XOLUM Addendas       -> reglas particulares por receptor
```

## Validación fiscal

El timbrado trabaja en modo **fail closed**. Antes del PAC deben pasar:

1. Datos y formato.
2. Catálogos SAT vigentes.
3. Reglas CFDI/Anexo 20.
4. Cálculos e impuestos.
5. CFDI relacionados.
6. Complementos.
7. XSD local/versionado.
8. CSD, cadena original y sello.
9. Preflight del PAC.

Los errores se muestran de forma operativa y deben corregirse en el documento origen, no editando clandestinamente la factura final.

## PAC

El dominio no depende de un proveedor específico. El adaptador PAC contempla healthcheck, preflight, timbrado, cancelación y consulta de estado. Cada rechazo determinista debe convertirse en una prueba de regresión.

Consulta `docs/PAC_CONNECTION_READINESS.md` antes de conectar un sandbox.

## Desarrollo local

```bash
npm install
cp .env.example .env.local
npm run typecheck
npm test
npm run dev
```

Nunca colocar credenciales, CSD o llaves privadas reales en el repositorio.
