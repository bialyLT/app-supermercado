# Informe — Épica 3 Ventas W2: pagos manuales

Fecha: 2026-10-27. Spec: `odd/tasks/epic3-sales-cash-payments.md`.

## Estado

ENTREGADO: W2 agrega pagos manuales exactos y combinables para ventas multilínea,
sin PSP, deuda, fiado ni vuelto. La suma debe coincidir exactamente con el total
server-side; cualquier diferencia se rechaza antes de mutar venta, stock, pagos o
idempotencia.

## Implementación

- Métodos soportados: `CASH`, `TRANSFER`, `CARD`, `WALLET`.
- Payment tenant-scoped con FK compuesto a Sale, RLS forzado, grants mínimos,
  auditoría y trigger append-only.
- `confirmPaidMultiLineSale` reutiliza el core transaccional de W1: precios,
  redondeo, stock, fiscal snapshot, pagos e idempotencia en una transacción.
- Replay idéntico devuelve el resultado original; payload cambiado rechaza.
- Solo se persisten método, importe, moneda server-side, actor y timestamp; no
  se almacenan datos de tarjeta ni credenciales.

## Archivos

Creados: `src/domain/payment.ts`, migración
`prisma/migrations/20261026213000_manual_payments/migration.sql`,
`tests/payment-domain.test.ts`, `tests/integration/manual-payments.test.ts`,
`docs/manual-payments.md`, este informe.

Modificados: `src/domain/inventory.ts`, `src/server/inventory.ts`,
`src/server/repositories/inventory.ts`, `prisma/schema.prisma`,
`tests/integration/rls-boundaries.test.ts` (fixture poblado con una venta y
Payment para mantener la cobertura de todas las tablas),
`odd/tasks/epic3-sales-cash-payments.md`.

## Evidencia TDD y gates

- RED: no se observó una ejecución RED previa; el worker añadió pruebas después
  de implementar. Se registra como desvío de proceso, no se inventa evidencia.
- Foco inicial con roles seguros: 44/44 tests, exit 0.
- Corrección del fixture RLS: RLS + pagos 7/7, exit 0.
- Suite final PostgreSQL real: **23 archivos, 146/146 tests**, exit 0, 223.53 s.
- `npm.cmd run typecheck`: exit 0, 0 errores.
- `npm.cmd run lint`: exit 0, 0 errores/warnings.
- `npm.cmd run test:ledger`: exit 0, 0 divergencias; RLS **29/29** tablas
  habilitadas y forzadas.
- `db:generate`, `db:validate` y migración W2: exit 0; migración aplicada.
- E2E, cobertura y build no se repitieron: W2 no agrega UI ni rutas HTTP; se
  mantienen como pendientes de la ola completa según `GATES.md`.

## Límites

No se implementaron vuelto/sobrepago, caja, reembolsos, UI, offline, PSP,
cuentas corrientes, crédito ni datos de tarjeta. El cambio/sobrepago requiere
una decisión explícita posterior.

S1-S3 cumplidas para W2. Risk: item 1 (datos de pago persistidos y frontera
append-only/RLS), verificado con integración real, roles restringidos y 29/29
RLS.

## Key Learnings

1. Una tabla nueva con tenantId debe poblarse en fixtures de aislamiento para que la prueba por catálogo no falle por ausencia de filas.
2. La validación exacta de pagos debe ocurrir antes de cualquier mutación de venta o stock.
3. El rol runtime seguro puede verificar pagos y RLS sin privilegios de migración.
