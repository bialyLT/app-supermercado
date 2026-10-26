# Brief — Épica 2: Catálogo, precios e inventario

## Contexto

Identity/RBAC ya está implementado. El próximo límite de dominio es registrar
productos físicos y su stock por ubicación sin perder trazabilidad ni bloquear
la caja cuando la recepción administrativa quedó atrasada.

## Decisión aprobada: `UNVERIFIED_INTAKE`

Cuando un producto existe físicamente y llega a caja, pero el stock
administrativo es insuficiente:

1. el POS puede completar la venta;
2. en la misma transacción se crea un movimiento positivo
   `UNVERIFIED_INTAKE` por la cantidad faltante;
3. luego se registra la salida de la venta;
4. el stock no queda negativo;
5. la regularización queda pendiente de validación y auditada con actor,
   sucursal, caja, hora, producto y motivo;
6. un encargado confirma, corrige o rechaza la regularización desde inventario.

No es una recepción normal, no inventa costo/proveedor y no puede ocultarse como
un ajuste común.

## Objetivo

Implementar catálogo extensible, precios vigentes y Kardex por ubicación con
transacciones ACID, control de concurrencia, productos unitarios/pesables,
lotes/vencimientos básicos y regularizaciones `UNVERIFIED_INTAKE`.

## Alcance

- Productos, variantes, unidades de medida y códigos de barras.
- Precio vigente por tenant/sucursal/canal, conservando snapshot en la venta
  futura.
- Ubicaciones/depósitos y niveles de inventario.
- Ledger append-only de entradas, salidas, mermas, transferencias, ajustes y
  `UNVERIFIED_INTAKE`.
- Reservas separadas de disponible.
- Lotes y fecha de vencimiento básicos.
- Operación de venta interna mínima solo para probar la invariancia de stock;
  no construir todavía la UI POS completa.
- Revisión/confirmación/rechazo de regularizaciones con permisos.

## Fuera de alcance

- UI POS keyboard-first completa.
- Pagos, caja y fiscalidad.
- Sincronización offline completa.
- Promociones complejas y compras a proveedores.

## Invariantes

- Ninguna transacción deja stock disponible negativo.
- La salida y el `UNVERIFIED_INTAKE`, cuando aplica, son atómicos.
- Los movimientos de inventario son append-only.
- Dos ventas concurrentes no pierden movimientos ni reservan la misma unidad.
- Toda mutación filtra por tenant y ubicación autorizada.
- Un `UNVERIFIED_INTAKE` requiere revisión explícita y no puede convertirse en
  recepción confirmada sin auditoría.
- Un código activo no identifica dos variantes dentro del tenant.
- Cantidades y costos usan Decimal; contratos externos serializan importes como
  string.

## Criterios de aceptación

```gherkin
Given un producto físico con stock administrativo insuficiente
When se confirma una venta autorizada
Then se registra UNVERIFIED_INTAKE y la salida en una transacción
And el stock final no es negativo

Given dos ventas concurrentes para el último artículo
When ambas intentan confirmar
Then exactamente una consume el stock registrado
And la otra regulariza solo la diferencia física autorizada o falla de forma
controlada sin datos parciales

Given una regularización pendiente
When un STOCK_MANAGER la confirma
Then queda auditada y ya no puede modificarse silenciosamente

Given un usuario de otro tenant
When intenta leer o mutar catálogo, stock o movimientos
Then no obtiene datos ni puede crear movimientos
```

## Gates

- `npm.cmd run db:generate`
- `npm.cmd run db:validate`
- `npm.cmd run db:migrate`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd test`
- `npm.cmd run test:coverage`
- `npm.cmd run build`
- `npm.cmd run test:e2e`
- `npm.cmd audit --audit-level=high`
- `git diff --check`

## Entregables

- Modelos Prisma y migración no destructiva.
- Servicios transaccionales de catálogo/inventario.
- Tests de invariantes, tenant isolation y concurrencia.
- Informe `.github/web-dev-loop/reports/epica-2-dev.md`.
- Sin commit/push por el agente.
