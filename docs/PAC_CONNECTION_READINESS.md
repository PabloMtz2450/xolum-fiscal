# XOLUM Fiscal — Preparación para conectar PAC

## Estado

El núcleo queda preparado para integrar un PAC mediante un adaptador desacoplado. La conexión concreta requiere seleccionar proveedor y cargar credenciales de sandbox.

## Ya implementado

- Política `fail closed`: ningún ERROR permite envío al PAC.
- CFDI 4.0 tipos I, E, T y P.
- Reglas base y avanzadas de importes, descuentos, impuestos, monedas y TipoCambio.
- PPD/PUE y restricciones de FormaPago/MetodoPago.
- CFDI relacionados, tipos 01–07 y sustitución 04.
- Factura global / RFC genérico e información global.
- Exportación y receptor extranjero como parte del modelo normalizado.
- Pagos 2.0: saldos, parcialidades, MonedaP/TipoCambioP y EquivalenciaDR básica.
- Registro de XSD: CFDI 4.0, Pagos 2.0, Detallista 1.3, Carta Porte 3.1, Comercio Exterior 2.0 e Impuestos Locales.
- Validador XSD real mediante `xmllint-wasm`; requiere bundles XSD locales con dependencias.
- Catálogos SAT versionados por snapshot con vigencia Desde/Hasta y hash opcional.
- Validación CSD: parseo, vigencia, número de certificado y verificación criptográfica de sello/cadena.
- Contrato PAC: healthcheck, preflight, timbrado, cancelación y consulta de estado.
- Normalización de rechazos PAC para convertirlos en regresiones.
- Cancelación SAT motivos 01–04, incluido UUID sustituto obligatorio para motivo 01.
- Gate automático de readiness para sandbox y producción.
- Pruebas unitarias de reglas fiscales, reglas avanzadas, cancelación y configuración PAC.

## Lo que debe existir antes del primer timbrado sandbox

1. **PAC seleccionado.**
2. URL sandbox HTTPS.
3. API key / secret o mecanismo equivalente del PAC.
4. Especificación exacta de autenticación y endpoints.
5. Ejemplo válido del payload de timbrado y respuesta.
6. Especificación de cancelación y consulta de estatus.
7. Catálogo de códigos/errores del PAC para normalizarlos.
8. CSD de prueba permitido por el PAC/sandbox.
9. Generador final de XML + cadena original + sello conectado al flujo.
10. Bundles XSD oficiales descargados, versionados y con todas sus dependencias.
11. Snapshots reales de catálogos SAT vigentes.
12. Suite `npm run typecheck && npm test` en verde.

## Secuencia de certificación

```text
Sales Lite / ERP
      ↓
Documento fiscal normalizado
      ↓
Reglas SAT locales
      ↓
Catálogos SAT vigentes
      ↓
Complementos
      ↓
Generación XML final
      ↓
XSD local/versionado
      ↓
Cadena original + CSD + sello
      ↓
PAC preflight
      ↓
TIMBRADO SANDBOX
      ↓
Validación UUID / XML timbrado
      ↓
Persistencia + auditoría
```

## Política de errores

Cada rechazo determinista del PAC debe guardar:

- proveedor;
- código PAC;
- código SAT si existe;
- mensaje;
- XML/payload correlacionado de forma segura;
- ruleset XOLUM usado;
- causa;
- prueba negativa;
- prueba positiva de la corrección.

Un rechazo conocido que vuelva a llegar al PAC es un defecto crítico.

## Producción

Conectar sandbox **no** equivale a liberar producción. Producción exige adicionalmente corpus de certificación positivo/negativo, cero rechazos inesperados, complementos declarados totalmente cubiertos y segunda revisión independiente.
