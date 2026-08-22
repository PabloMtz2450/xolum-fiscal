# Gobierno de validación SAT — XOLUM Fiscal

## Principio

El PAC no es el validador primario de XOLUM. El PAC es la última frontera de certificación.
XOLUM debe detectar localmente los errores conocidos antes de consumir un timbre.

La política es **fail closed**: cualquier error fiscal bloquea el timbrado.

## Alcance obligatorio

Antes de declarar producción lista deben existir perfiles completos y pruebas para:

- CFDI 4.0 tipo I — Ingreso.
- CFDI 4.0 tipo E — Egreso.
- CFDI 4.0 tipo T — Traslado.
- CFDI 4.0 tipo P — Pago + Complemento para Recepción de Pagos 2.0.
- CFDI relacionados, sustituciones y cancelaciones.
- Complementos habilitados por XOLUM, cada uno con su propio estándar, XSD, catálogos y matriz/reglas publicadas.
- Addendas fuera del núcleo fiscal: se validan adicionalmente cuando el cliente contrata el módulo.

## Capas de validación

1. Entrada: tipos, obligatoriedad, formatos, precisión, longitudes y caracteres.
2. Catálogos SAT: clave vigente y válida para la fecha del documento.
3. Reglas Anexo 20: dependencias y prohibiciones entre atributos/nodos.
4. Aritmética: importes, descuentos, bases, impuestos, redondeos y totales.
5. Relaciones: UUID, TipoRelacion, sustituciones, documentos relacionados y saldos.
6. Complementos: reglas específicas antes de integrarlos al CFDI.
7. XSD: CFDI base + todos los esquemas complementarios requeridos.
8. Sello/cadena/certificado: CSD vigente, correspondencia de RFC, vigencia y criptografía.
9. Preflight PAC: payload final idéntico al que será enviado a certificación.

## Matriz de errores

No se debe mantener una lista manual incompleta como única fuente. El registro de reglas debe versionarse y registrar:

- código/regla;
- tipo de CFDI/complemento;
- condición;
- mensaje amigable al usuario;
- referencia normativa/técnica;
- fecha de vigencia;
- caso de prueba positivo;
- caso de prueba negativo;
- código PAC/SAT equivalente cuando exista.

Cada rechazo real del PAC se guarda. Si corresponde a una regla documentada que XOLUM no detectó, se considera defecto crítico y se agrega un test de regresión antes de liberar la corrección.

## Fuentes oficiales

La versión liberada debe fijar y documentar las versiones de:

- Anexo 20 / estándar técnico CFDI 4.0.
- XSD CFDI 4.0 y dependencias.
- Catálogos CFDI vigentes.
- Anexo 29 RMF vigente y modificaciones aplicables a PCCFDI/CFDI.
- Estándar, XSD, catálogos y matrices de cada complemento habilitado.
- Complemento para Recepción de Pagos 2.0.
- Reglas de cancelación vigentes.

No se actualiza una fuente en producción sin pruebas de regresión.

## Gate de liberación

No se puede marcar XOLUM Fiscal como `PRODUCTION_READY` hasta cumplir:

- 100% de reglas implementadas para los tipos/complementos declarados soportados.
- XSD local/versionado verificado contra fuentes SAT.
- Catálogos con fecha de vigencia.
- Suite positiva y negativa por regla.
- Corpus de XML válidos e inválidos.
- Pruebas de redondeo y límites.
- Pruebas sandbox PAC.
- Cero rechazos inesperados en el corpus de certificación.
- Segunda revisión independiente de reglas y pruebas.
- Bitácora de versión del ruleset.

## UX

El usuario no debe recibir solamente `CFDI40xxx`.
XOLUM mostrará:

- qué está mal;
- dónde está;
- por qué bloquea;
- cómo corregirlo en el pedido/cliente/documento origen.

La factura transformada no se modifica para saltarse una validación.
