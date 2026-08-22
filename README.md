# XOLUM Fiscal

Plataforma modular para controlar el ciclo fiscal del documento sin obligar al cliente a reemplazar todos sus sistemas.

## Principios

- Si no simplifica, no sirve.
- Si no conecta, no aporta.
- Si no resuelve un problema real, no entra.
- La complejidad la resuelve el sistema, no el usuario.

## Producto base

XOLUM Fiscal funciona sin ERP y sin TMS. El núcleo contempla CFDI, notas de crédito, REP, cancelaciones, relaciones CFDI, estatus SAT, expediente fiscal, importación de XML y conciliación asistida.

## Módulos y conectores opcionales

- **XOLUM TMS**: POD, evidencias y validación logística. Se contrata por separado.
- **XOLUM Sales**: pedidos/cotizaciones para clientes sin ERP. Se contrata por separado.
- **XOLUM Connect**: ERP, PAC, correo, portales, APIs e importaciones.
- **Conciliación bancaria**: por defecto asistida; sólo puede pasar a automática cuando las referencias disponibles permiten una identificación confiable del pago.

## Arquitectura objetivo

```text
ERP / XOLUM Sales / Captura directa
              |
              v
        XOLUM Fiscal Core
  CFDI | NC | REP | SAT | Addenda
              |
       +------+------+
       |             |
       v             v
  PAC connector   XML import
       |
       v
  Estatus SAT / cancelación

XOLUM TMS (opcional) -> POD/evidencias -> elegibilidad logística
Banco (opcional)     -> movimientos -> conciliación asistida
```

## Conectores

Los proveedores externos deben implementar contratos internos para evitar acoplar el dominio a un PAC, banco, ERP o TMS específico.

### PAC

Debe cubrir como mínimo timbrado, cancelación y consulta de estatus.

### TMS

Sólo se activa si el cliente contrata la integración. Fiscal consume estado de entrega y evidencias; TMS conserva la responsabilidad logística.

### Conciliación

El motor asigna confianza según importe, referencias y datos disponibles. No se debe aplicar un pago automáticamente únicamente por coincidencia de importe.

## Estado actual

Primera base estructural e interfaz de Centro de Control creada. Los conectores reales permanecen desacoplados y pendientes de seleccionar/configurar proveedor.

## Desarrollo local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Nunca colocar credenciales reales en el repositorio.
