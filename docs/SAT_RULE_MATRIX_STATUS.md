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

## Ruleset actual

`2026.08.22-core-2`

## Cobertura ejecutable actual

- CFDI 4.0 obligatorio.
- RFC emisor/receptor y CP/lugar de expedición.
- Conceptos, ClaveProdServ, cantidad, importe y descuentos.
- SubTotal y Total de I/E.
- ObjetoImp e impuestos por concepto.
- Cálculo base × TasaOCuota y manejo Exento.
- Moneda / TipoCambio.
- PPD -> FormaPago 99; PUE de ingreso no usa 99.
- Traslado con Total 0 y sin FormaPago/MetodoPago.
- Pago con SubTotal/Total 0, Moneda XXX y sin FormaPago/MetodoPago a nivel comprobante.
- Pagos 2.0: Pago, DoctoRelacionado, UUID, parcialidad, saldos, Monto, MonedaP/TipoCambioP y EquivalenciaDR básica.
- CFDI relacionados, UUID, c_TipoRelacion 01–07 y sustitución 04.
- Exportacion requerida en el modelo CFDI 4.0.
- Factura global con RFC genérico nacional e InformacionGlobal.
- Receptor extranjero / residencia fiscal en escenarios de exportación modelados.
- Catálogos SAT mediante snapshots versionados con vigencia Desde/Hasta.
- CSD: parseo, vigencia, NoCertificado SAT, RFC emisor y verificación criptográfica del sello contra cadena original.
- XSD real con `xmllint-wasm`, bundles locales y dependencias precargadas.
- Cancelación SAT motivos 01–04 y FolioSustitucion para motivo 01.
- Contrato PAC: healthcheck, preflight, timbrado, cancelación y consulta de estado.
- Gate de readiness para sandbox y producción.
- XML CFDI 4.0 determinista para I/E/T/P sobre el modelo normalizado.
- Cadena original mediante XSLT oficial SAT local ejecutado con `xsltproc --nonet`.
- Firma RSA-SHA256 con llave privada CSD PEM o PKCS#8 DER cifrada.
- Inserción del sello mediante re-render final, sin mutaciones posteriores.
- Validación criptográfica sello/cadena/CSD antes del PAC.
- Validación XSD del XML FINAL exacto.
- Preflight PAC sobre el XML FINAL exacto.
- Envío al PAC del mismo XML firmado, con clave de idempotencia SHA-256.

## Esquemas registrados

- CFDI 4.0 — cfdv40.xsd
- Pagos 2.0 — Pagos20.xsd
- Detallista 1.3 — detallista.xsd
- Carta Porte 3.1 — CartaPorte31.xsd
- Comercio Exterior 2.0 — ComercioExterior20.xsd
- Impuestos Locales — implocal.xsd

## Corrección de segunda revisión

Se eliminó la regla inicial que bloqueaba **todo** CFDI de Egreso sin CFDI relacionado. Esa regla era demasiado amplia: existen escenarios fiscales válidos de egreso sin relación inmediata, como descuentos globales sobre operaciones futuras. Las relaciones de egreso deben validarse según el escenario, no imponerse indiscriminadamente.

También se corrigió la lectura de `NoCertificado`: el serial expuesto por Node puede venir codificado en hexadecimal y debe decodificarse al número SAT de 20 dígitos antes de compararlo.

## Pendientes antes del PRIMER TIMBRADO SANDBOX

- Seleccionar PAC real y cargar credenciales sandbox.
- Implementar el adaptador concreto del PAC seleccionado sobre `PacAdapter`.
- Cargar snapshots reales de catálogos SAT vigentes.
- Descargar/versionar bundles XSD oficiales y todas sus dependencias.
- Descargar/versionar el XSLT oficial de cadena original CFDI 4.0 y sus dependencias locales.
- Configurar un CSD de pruebas válido (certificado, llave privada y contraseña).
- Ejecutar `npm run typecheck` y `npm test` en un entorno con dependencias instaladas y `xsltproc` disponible.
- Mapear códigos de rechazo específicos del PAC seleccionado.

## Pendientes antes de PRODUCTION_READY

- Completar la matriz específica y corpus de cada complemento declarado soportado en producción.
- Profundizar Pagos 2.0 en Totales e impuestos DR/P para todos los escenarios tributarios soportados.
- Validar límites/tolerancias dependientes de catálogos SAT con datos reales versionados.
- Corpus XML positivo/negativo I/E/T/P y complementos habilitados.
- Cero rechazos inesperados durante certificación sandbox.
- Segunda revisión independiente final posterior a las pruebas PAC.

## Regla de regresión

Todo rechazo determinista del PAC que XOLUM pudo detectar antes de timbrar se considera defecto crítico. Debe convertirse en:

1. Caso reproducible.
2. Regla local o corrección de regla existente.
3. Test automatizado negativo.
4. Test positivo del caso corregido.
5. Registro del código SAT/PAC y versión de ruleset.

No se permite cerrar un defecto fiscal corrigiendo el XML manualmente.
