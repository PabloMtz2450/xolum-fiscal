# XOLUM Fiscal — arquitectura de producto

## Regla de origen

El pedido es la fuente de verdad del CFDI. La factura no es una segunda captura.

Flujo estándar:

Cliente → Pedido Sales Lite → Validación → Bloqueo fiscal → Composición CFDI/Complementos → Validación XSD → PAC → CFDI timbrado → REP/seguimiento.

## Sales Lite incluido

Incluye sólo lo necesario para preparar una factura:

- alta mínima de cliente;
- alta mediante QR fiscal o captura manual;
- catálogo ligero de productos/servicios;
- pedido;
- conceptos y descripciones;
- cantidades;
- unidad comercial y clave SAT;
- clave producto/servicio SAT;
- objeto de impuesto;
- impuestos;
- precio y descuento;
- orden de compra por línea;
- moneda, método y forma de pago.

No incluye inventarios, almacenes, compras, CRM ni funciones de ERP que no sean necesarias para preparar el CFDI.

## Regla de inmutabilidad fiscal

Cuando un pedido cambia a READY_FOR_FISCAL:

1. XOLUM genera el borrador fiscal desde el pedido.
2. Conceptos, cantidades, precios, impuestos, referencias y datos del receptor quedan bloqueados en la pantalla de factura.
3. El facturista puede revisar, validar y timbrar, pero no modificar esos datos.
4. Si existe un error, se corrige el documento origen y se vuelve a liberar.
5. Toda regeneración debe quedar auditada.

## CFDI 4.0 y XSD

La validación técnica usa como autoridad los esquemas publicados por SAT. El esquema base configurado es:

- namespace: `http://www.sat.gob.mx/cfd/4`
- XSD: `http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd`

Los complementos agregan su namespace y XSD oficial antes del timbrado. En producción los XSD deben almacenarse en caché controlada, registrar versión/hash y verificarse periódicamente contra la publicación oficial.

## Complementos

Los complementos forman parte del XML antes del timbrado. El motor debe permitir activar adaptadores por tipo de operación sin contaminar Sales Lite.

Primera integración preparada:

- Detallista.

Arquitectura preparada para incorporar otros complementos conforme se implementen y validen contra su estándar/XSD oficial.

## XOLUM Addendas

XOLUM Addendas es un producto comercial independiente.

Cada addenda:

- se diseña por cliente/receptor;
- tiene versión;
- define campos y reglas propias;
- se prueba contra muestras/especificación del cliente;
- se habilita sólo cuando el cliente contrata esa addenda.

Fiscal base no promete addendas incluidas.

## Integraciones opcionales

### XOLUM TMS
Se contrata por separado. Si está activo, Fiscal puede consultar POD/evidencias y utilizar la entrega como regla de elegibilidad. Sin TMS, Fiscal no promete validación logística automática.

### ERP / XOLUM Connect
Un ERP puede entregar pedidos a Sales Lite mediante un adaptador. El modelo interno del pedido sigue siendo la frontera estable para facturación.

### XML externos
La importación de XML permite relacionar CFDI/REP externos y migrar historial, pero no debe complicar el flujo principal de emisión.

## Conciliación

La conciliación es asistida por defecto. La coincidencia de importe nunca basta para aplicar automáticamente un pago. El modo automático sólo se permite cuando existe evidencia de identificación confiable, particularmente una referencia compatible con la factura/cliente/regla configurada.

## Principio XOLUM

Si no simplifica, no sirve. Si no conecta, no aporta. Si no resuelve un problema real, no entra.
