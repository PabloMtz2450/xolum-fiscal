# XOLUM Fiscal — Estado de matriz SAT/PAC

> Política: ningún CFDI se envía al PAC si existe un ERROR o si falta una capa obligatoria de validación.

## Tipos cubiertos por el motor

- I — Ingreso
- E — Egreso
- T — Traslado
- P — Pago / REP 2.0

## Capas obligatorias

1. INPUT
2. CATALOG
3. BUSINESS_RULE
4. TOTALS
5. RELATIONSHIP
6. COMPLEMENT
7. XSD
8. SIGNATURE
9. PAC_PREFLIGHT

## Reglas ejecutables incorporadas en core-1

- CFDI 4.0 obligatorio.
- Formato RFC emisor/receptor.
- CP receptor y lugar de expedición.
- Conceptos obligatorios en I/E/T.
- ClaveProdServ de 8 posiciones.
- Cantidad positiva.
- Importe = cantidad × valor unitario.
- Descuento no mayor al importe.
- SubTotal = suma de importes.
- Coherencia ObjetoImp 01/02 con impuestos.
- Total de I/E recalculado con descuentos, traslados y retenciones.
- CFDI T con Total 0.
- CFDI P con SubTotal/Total 0.
- CFDI P con Moneda XXX.
- CFDI P sin FormaPago/MetodoPago a nivel comprobante.
- Pago 2.0 obligatorio en tipo P.
- DoctoRelacionado obligatorio por pago.
- UUID de documentos relacionados.
- NumParcialidad entero positivo.
- ImpSaldoAnt - ImpPagado = ImpSaldoInsoluto.
- ImpPagado no puede exceder ImpSaldoAnt.
- Monto de pago mayor a cero.
- UUID válidos en CfdiRelacionados.
- Egresos sin relación fiscal quedan bloqueados para revisión.

## Esquemas SAT registrados

- CFDI 4.0 — cfdv40.xsd
- Pagos 2.0 — Pagos20.xsd
- Detallista 1.3 — detallista.xsd

## Pendientes que bloquean PRODUCTION_READY

- Implementar carga/versionado automático de catálogos SAT con vigencia Desde/Hasta.
- Incorporar matriz completa publicada para CFDI 4.0 y cada complemento.
- Completar reglas de moneda/TipoCambio y límites de decimales.
- Completar impuestos por concepto y totales con tolerancias oficiales.
- Reglas específicas de Público en General, RFC genéricos y exportación.
- Reglas completas de relaciones 01–07 y sustitución.
- Matriz completa de Egreso según escenario fiscal.
- Matriz completa de Traslado y Carta Porte cuando corresponda.
- Matriz completa Pagos 2.0: Totales, impuestos DR/P, equivalencias y monedas.
- Validación de CSD: vigencia, RFC, número de certificado, cadena original y sello.
- Validador XSD real con caché local/versionado.
- Integración sandbox con PAC elegido y mapeo de todos sus códigos de rechazo.
- Corpus XML positivo/negativo para I/E/T/P.
- Segunda revisión completa de reglas antes de producción.

## Regla de regresión

Todo rechazo determinista del PAC que XOLUM pudo detectar antes de timbrar se considera defecto crítico. Debe convertirse en:

1. Caso reproducible.
2. Regla local o corrección de regla existente.
3. Test automatizado negativo.
4. Test positivo del caso corregido.
5. Registro del código SAT/PAC y versión de reglas.

No se permite cerrar un defecto fiscal sólo corrigiendo el XML manualmente.
