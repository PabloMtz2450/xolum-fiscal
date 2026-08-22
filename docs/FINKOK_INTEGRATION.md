# XOLUM Fiscal — Integración FINKOK

Fecha de revisión documental: 2026-08-22

## Decisión

FINKOK es el PAC seleccionado para XOLUM Fiscal.

## Endpoints oficiales

### Timbrado
- Demo: `https://demo-facturacion.finkok.com/servicios/soap/stamp.wsdl`
- Producción: `https://facturacion.finkok.com/servicios/soap/stamp.wsdl`

Métodos documentados: `stamp`, `quick_stamp`, `stamped`, `query_pending`, `sign_stamp`.

XOLUM usará **stamp**, porque XOLUM genera cadena original y sello localmente. `sign_stamp` no es necesario para el flujo estándar.

### Cancelación / estatus
- Demo: `https://demo-facturacion.finkok.com/servicios/soap/cancel.wsdl`
- Producción: `https://facturacion.finkok.com/servicios/soap/cancel.wsdl`

Métodos relevantes: `cancel`, `get_sat_status`, `get_related`, `get_receipt`, `query_pending_cancellation`.

### Registro de emisores
- Demo: `https://demo-facturacion.finkok.com/servicios/soap/registration.wsdl`
- Producción: `https://facturacion.finkok.com/servicios/soap/registration.wsdl`

## Timbrado

FINKOK recibe:
- XML codificado Base64.
- Username.
- Password.

La respuesta contiene XML timbrado, UUID, Fecha, CodEstatus, sello SAT, NoCertificadoSAT e Incidencias.

### Regla crítica de integración

El éxito se determina por `CodEstatus == "Comprobante timbrado satisfactoriamente"`.

FINKOK advierte que un CFDI puede haber sido timbrado correctamente y aun así existir información en Incidencias; por eso XOLUM no debe decidir éxito sólo por la ausencia/presencia de incidencias.

### Tamaño

FINKOK documenta límite de **1 MB por XML**. XOLUM bloquea localmente XML >= 1 MB.

## Pendientes de envío al SAT

FINKOK dispone de `query_pending`.

Estados relevantes:
- `S`: Stamped, timbrado pero aún no enviado al SAT.
- `F`: Finished, timbrado y enviado al SAT.

XOLUM debe conservar el CFDI como fiscalmente timbrado cuando FINKOK devuelve éxito, y registrar adicionalmente el estado de entrega al SAT.

## Cancelación

XOLUM usa motivos SAT 01–04.

Para `cancel`, FINKOK requiere adicionalmente:
- RFC emisor.
- Certificado CSD PEM/Base64.
- Llave privada PEM cifrada DES3 con el passphrase de FINKOK, Base64.
- `store_pending`.

Para motivo `01`, XOLUM exige `FolioSustitucion` antes de enviar.

### Regla crítica de estado

Código `201` = petición de cancelación realizada exitosamente. **No significa CFDI ya cancelado.**

Después de solicitar cancelación, XOLUM debe consultar `get_sat_status` hasta obtener el estado real del SAT.

FINKOK documenta en demo una espera aproximada de 2–5 minutos después del timbrado antes de cancelar; cancelar demasiado pronto puede devolver 205 UUID no existe.

## Consulta SAT

`get_sat_status` requiere:
- username/password;
- RFC emisor;
- RFC receptor;
- UUID;
- total con decimales correctos.

XOLUM debe guardar estos valores junto al CFDI para que la consulta no dependa de captura manual posterior.

## Errores FINKOK que deben mapearse

Mínimo:
- 300: usuario/contraseña inválidos o ambiente incorrecto.
- 301: XML mal formado.
- 307: CFDI contiene timbre previo.
- 308: certificado no expedido por SAT / combinación demo incorrecta.
- 401: fecha fuera de rango (más de 72h o futura).
- 402: RFC emisor no localizado / CSD/FIEL/LCO.
- 603: `stamped` sobre CFDI no timbrado.
- 701: RFC emisor suspendido.
- 702: RFC emisor no registrado en la cuenta FINKOK.
- 703: cuenta suspendida.
- 705: XML inválido / Base64 incorrecto / doble Base64.
- 719/720: problemas de certificado en `sign_stamp`.
- 738: schemaLocation/namespaces/prefijos incorrectos.
- 740: manifiesto no firmado.
- CFDI40102: sello/cadena original incorrectos.

Cancelación:
- 201: solicitud enviada correctamente; verificar estatus después.
- 202: previamente cancelado.
- 203: RFC solicitante/emisor no corresponde.
- 205: UUID no existe.
- 309: UUID inválido.
- 310: se usó FIEL en lugar de CSD.
- 311: motivo inválido.
- 312/314: relación/sustitución inválida.
- 798: ya existe solicitud previa; no reenviar compulsivamente.
- 799: máximo de peticiones excedido.

## Readiness del emisor

Antes de habilitar timbrado de un RFC:
1. RFC registrado en la cuenta FINKOK (panel o registration WS).
2. Tipo de cliente correcto (OnDemand / Prepago).
3. Si es Prepago, créditos/timbres disponibles.
4. Manifiesto firmado.
5. CSD correcto y vigente.
6. En demo, usar RFC/CSD de prueba admitidos por FINKOK.

## Ambiente DEMO

FINKOK publica RFC/CSD para pruebas. La contraseña publicada para las llaves de esos certificados es `12345678a`.

No se debe usar un RFC/CSD real en DEMO; FINKOK documenta que esto puede causar error 308/402.

## Pruebas obligatorias antes de producción

### Timbrado positivo
- I estándar PUE.
- I PPD.
- E válido.
- T válido.
- P + Pagos 2.0.
- CFDI con Detallista cuando se habilite.

### Timbrado negativo
- XML > 1 MB.
- cadena/sello alterados -> esperar CFDI40102.
- Fecha >72 horas / futura -> 401.
- RFC no registrado -> 702.
- schemaLocation incorrecto -> 738.
- XML mal formado -> 301/705.

### Recuperación / idempotencia
- reintento del mismo XML.
- `stamped`/recuperación ante timbre previo si aplica.
- `query_pending` S -> F.

### Cancelación
- motivo 02.
- motivo 01 con sustituto.
- motivo 01 sin sustituto debe bloquear localmente.
- consulta `get_sat_status` posterior.
- no reintentar ante 798.
- obtener relacionados cuando SAT responda no cancelable.

## Servicio Validate

FINKOK ofrece un web service `validation.wsdl`, pero lo documenta como servicio adicional con costo. XOLUM no depende de él para la validación pre-timbrado: mantiene sus propias capas SAT/XSD/CSD y usa `stamp` como certificación final.

## Estado

- Adaptador SOAP `stamp`: implementado.
- `query_pending`: implementado.
- `cancel`: implementado.
- `get_sat_status`: implementado.
- Preflight específico FINKOK: tamaño, XML firmado y estructura básica.
- Tests unitarios con cliente SOAP simulado: implementados.
- Prueba live contra WSDL: pendiente de credenciales DEMO y entorno con resolución DNS.
- Prueba de timbrado sandbox real: pendiente de cuenta DEMO FINKOK + RFC/CSD de prueba registrado.
