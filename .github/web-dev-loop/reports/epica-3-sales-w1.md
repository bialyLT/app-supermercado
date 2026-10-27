# Informe — Épica 3 Ventas W1

Fecha: 2026-10-26. Spec: `odd/tasks/epic3-sales-cash-payments.md`.

## Estado

ENTREGADO: W1 implementa S3-S5; no implementa pagos, movimientos/cierre de caja,
refunds/returns, numeración, UI, offline, PSP, ARCA, tasas ni crédito.
Corrección bounded posterior al verificador: el blocker de venta aprobada sobre lote vencido quedó resuelto sin ampliar alcance.

## Archivos creados/modificados

- `src/domain/inventory.ts`: contrato normalizado `multiSaleSchema`, reglas de una ubicación y variantes únicas.
- `src/server/inventory.ts`: servicio `confirmMultiLineSale`.
- `src/server/repositories/inventory.ts`: core transaccional compartido, server pricing por línea, snapshots, FEFO, intake, total HALF_UP e idempotencia multilínea; single-line delega al mismo core. Corrección: `usable` incluye lotes vencidos solo cuando existe aprobación válida.
- `src/server/repositories/approval.ts`: hash canónico multilínea y binding de aprobación preservado para single-line.
- `tests/inventory-domain.test.ts`: RED/GREEN de reglas estructurales.
- `tests/integration/multiline-sales.test.ts`: server pricing, redondeo por línea, replay, atomicidad de rechazo y contrato single-line.
- `tests/integration/supervisor-closure.test.ts`: regresión de venta de lote vencido aprobada sin intake; verifica consumo de aprobación y reconciliación.
- `prisma/schema.prisma`: sin cambio funcional intencional; cambios visibles eran preexistentes y se preservaron.
- `prisma/migrations/20261026212000_multiline_sales/migration.sql`: no creado; el modelo existente ya soporta snapshots requeridos y no se necesitó cambio de esquema.

## Evidencia TDD

- RED (corrección del verificador): `cmd.exe /d /c "npm.cmd test -- --run tests/integration/supervisor-closure.test.ts"`: 11/12 pasaron, 1 falló con `INSUFFICIENT_STOCK` en la regresión de lote vencido aprobado.
- GREEN: `cmd.exe /d /c "npm.cmd test -- --run tests/integration/supervisor-closure.test.ts tests/integration/multiline-sales.test.ts"`: 15/15 tests, 2/2 archivos, exit 0.
- PRESERVE: la misma batería conserva supervisor 11 casos previos y multiline 3 casos; 15/15.
- REFACTOR: no hubo refactor; solo se ajustó el predicado `usable`.

## Gates

Entorno: Windows `cmd.exe`; PostgreSQL descartable `127.0.0.1:55449/supermercado_fiscal_gate`; URLs sintéticas explícitas.

- `cmd.exe /d /c "npm.cmd run db:generate"`: exit 0; Prisma 7.10.1.
- `cmd.exe /d /c "npm.cmd run db:validate"`: exit 0; esquema válido.
- focused supervisor + multiline posterior a corrección: 15/15 tests, 2/2 archivos, exit 0; 19.25 s.
- `npm.cmd test` con TEST/DATABASE/AUTH_DATABASE_URL sintéticas: 139/139 tests, 21/21 archivos, exit 0; 227.63 s.
- `npm.cmd run typecheck`: exit 0; 0 errores.
- `npm.cmd run lint`: exit 0; 0 errores, 0 warnings.
- `npm.cmd run test:ledger`: exit 0; 0 divergencias; RLS 28/28 tablas habilitado y forzado.

## Compatibilidad y limitaciones

- Differential check `confirmSale`: `inventory-hardening.test.ts` pasó 23/23 en el árbol W1; no se pudo ejecutar contra una copia dirty pre-W1 independiente porque la baseline entregada contiene cambios previos no separables. La evidencia disponible es la batería de regresión contra el contrato vigente.
- E2E, cobertura y build: no ejecutados; W1 no cambia UI ni rutas HTTP y el usuario indicó que no son necesarios.
- La corrección no introdujo timeout en la batería enfocada; no se reejecutó la suite completa ni E2E por el alcance bounded solicitado.
- El árbol ya contenía modificaciones fuera de las superficies de W1; fueron preservadas.
- Risk: item 3 (shared sale contract): cubierto por el core común, 23/23 hardening, 12/12 supervisor y 3/3 pruebas multilínea; el verificador encontró y se corrigió el caso de aprobación sobre lote vencido.

## Desvíos / supuestos

- SUPUESTO: la forma multilínea acepta `unitPrice` opcional solo como dato de entrada no autoritativo; el servidor lo ignora y selecciona el precio vigente. El precio single-line conserva validación de compatibilidad.
- Sin desvíos de alcance funcional aprobados.

Sin commit ni push.

## Key Learnings

1. El modelo Sale/SaleLine existente ya soporta snapshots multilínea sin migración.
2. La idempotencia existente puede reutilizarse con un tipo de comando multilínea.
3. Las aprobaciones single-line deben consumirse antes de validar lotes expirados para preservar su contrato.
4. El total correcto es la suma de importes de línea redondeados, no el redondeo del agregado.
5. La batería completa requiere AUTH_DATABASE_URL sintética explícita para el test de repositorio de identidad.
6. Una aprobación válida debe participar tanto en el filtro de stock usable como en FEFO; de lo contrario el flujo sin intake devuelve `INSUFFICIENT_STOCK` antes de consumir correctamente la excepción.
