# Informe — Épica 3 Ventas W1

Fecha: 2026-10-26. Spec: `odd/tasks/epic3-sales-cash-payments.md`.

## Estado

ENTREGADO: W1 implementa S3-S5; no implementa pagos, movimientos/cierre de caja,
refunds/returns, numeración, UI, offline, PSP, ARCA, tasas ni crédito.

## Archivos creados/modificados

- `src/domain/inventory.ts`: contrato normalizado `multiSaleSchema`, reglas de una ubicación y variantes únicas.
- `src/server/inventory.ts`: servicio `confirmMultiLineSale`.
- `src/server/repositories/inventory.ts`: core transaccional compartido, server pricing por línea, snapshots, FEFO, intake, total HALF_UP e idempotencia multilínea; single-line delega al mismo core.
- `src/server/repositories/approval.ts`: hash canónico multilínea y binding de aprobación preservado para single-line.
- `tests/inventory-domain.test.ts`: RED/GREEN de reglas estructurales.
- `tests/integration/multiline-sales.test.ts`: server pricing, redondeo por línea, replay, atomicidad de rechazo y contrato single-line.
- `prisma/schema.prisma`: sin cambio funcional intencional; cambios visibles eran preexistentes y se preservaron.
- `prisma/migrations/20261026212000_multiline_sales/migration.sql`: no creado; el modelo existente ya soporta snapshots requeridos y no se necesitó cambio de esquema.

## Evidencia TDD

- RED: `cmd.exe /d /c "npm.cmd test -- --run tests/inventory-domain.test.ts"`: 6/7 pasaron, 1 falló antes de ajustar el contrato de línea.
- GREEN: focused final: 33/33 tests, 3 archivos, exit 0.
- PRESERVE: `inventory-hardening.test.ts` 23/23 y `supervisor-closure.test.ts` 11/11; contrato single-line de W1 3/3.
- REFACTOR: lint final 0 errores/0 warnings.

## Gates

Entorno: Windows `cmd.exe`; PostgreSQL descartable `127.0.0.1:55449/supermercado_fiscal_gate`; URLs sintéticas explícitas.

- `cmd.exe /d /c "npm.cmd run db:generate"`: exit 0; Prisma 7.10.1.
- `cmd.exe /d /c "npm.cmd run db:validate"`: exit 0; esquema válido.
- focused inventory + multiline: 33/33 tests, 3/3 archivos, exit 0.
- `npm.cmd test` con TEST/DATABASE/AUTH_DATABASE_URL sintéticas: 139/139 tests, 21/21 archivos, exit 0; 227.63 s.
- `npm.cmd run typecheck`: exit 0; 0 errores.
- `npm.cmd run lint`: exit 0; 0 errores, 0 warnings.
- `npm.cmd run test:ledger`: exit 0; 0 divergencias; RLS 28/28 tablas habilitado y forzado.

## Compatibilidad y limitaciones

- Differential check `confirmSale`: `inventory-hardening.test.ts` pasó 23/23 en el árbol W1; no se pudo ejecutar contra una copia dirty pre-W1 independiente porque la baseline entregada contiene cambios previos no separables. La evidencia disponible es la batería de regresión contra el contrato vigente.
- E2E, cobertura y build: no ejecutados; W1 no cambia UI ni rutas HTTP y el usuario indicó que no son necesarios.
- El árbol ya contenía modificaciones fuera de las superficies de W1; fueron preservadas.
- Risk: item 3 (shared sale contract): cubierto por el core común, 23/23 hardening, 11/11 supervisor y 3/3 pruebas multilínea.

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
