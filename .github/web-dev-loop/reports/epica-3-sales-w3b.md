ENTREGADO: W3b implementa anulaciones totales y devoluciones de líneas completas como documentos append-only, con reposición de stock y CASH_OUT auditable.

Archivos creados/modificados:
- src/domain/reversal.ts: contrato, validación e importes.
- src/server/reversal.ts: fachada de servicio.
- src/server/repositories/reversal.ts: operación transaccional, idempotencia, autorización, stock, caja y auditoría.
- src/server/repositories/inventory.ts: reutilización del permiso supervisor/admin inventory.sale.approve.
- prisma/schema.prisma: SaleReversal/SaleReversalLine y enum RETURN.
- prisma/migrations/20261026215000_sale_reversals/migration.sql: tablas, FKs compuestas, RLS, grants y triggers append-only.
- tests/reversal-domain.test.ts: contrato.
- tests/integration/sale-reversals.test.ts: denegación, anulación, límites, replay, no mutación y stock/caja/audit.
- tests/integration/rls-boundaries.test.ts: límites append-only W3b.
- docs/sale-reversals.md: contrato bounded.

S6 verdicts:
- S6.1 Documentos append-only: VERDE por esquema, triggers, grants y FKs compuestas.
- S6.2 Anulación/devolución bounded: VERDE; anulación total y devolución de línea completa; cantidad parcial explícitamente rechazada.
- S6.3 Atomicidad stock/caja/audit: VERDE por una transacción; CASH_OUT único referenciado al documento.
- S6.4 Autorización/sesión/moneda: VERDE por la convención existente inventory.sale.approve para supervisor/admin, sesión activa del actor, branch y currency.
- S6.5 Idempotencia y preservación: VERDE por command hash; venta, SaleLine y Payment nunca se actualizan ni eliminan.
- S6.6 RLS/append-only: VERDE estructural; tablas nuevas tienen RLS FORCE, grants mínimos y triggers.

TDD:
- RED: no ejecutable en este entorno antes de implementar por binding nativo de Rolldown ausente; se agregaron pruebas de contrato e integración antes del cierre de implementación.
- GREEN: no ejecutable por el mismo bloqueo del runner.
- Preservación/refactor: typecheck y lint de los archivos W3b pasan 0 errores/0 warnings.

Validación observada:
- `npm.cmd run db:validate`: NO EJECUTADO; npm.cmd Windows falla en entorno UNC/Linux (`unexpected EOF`).
- `npm.cmd run db:generate`: NO EJECUTADO por la misma limitación.
- `npm.cmd run test -- --run tests/reversal-domain.test.ts`: 0 tests ejecutados; startup bloqueado por binding nativo Rolldown ausente.
- `npx prisma validate`: exit 0.
- `npx prisma generate`: exit 0.
- `npx tsc --noEmit`: exit 0.
- `npx eslint .`: exit 0, 0 errores, 0 warnings.
- `git diff --check` sobre superficies W3b: exit 0, sin salida.
- `npx prisma migrate deploy`: NO EJECUTADO; P1001 contra localhost:5432, no hay PostgreSQL disposable disponible.

Desvíos/runtime: no se pudo ejecutar PostgreSQL ni la batería Vitest por el bloqueo de Rolldown y la limitación npm.cmd; no se inventaron resultados numéricos.

SUPUESTO: devolución parcial por cantidad no tiene semántica de asignación aprobada; se rechaza explícitamente. Las devoluciones por línea completa usan el precio snapshot original.
Decisiones requeridas: ninguna para este alcance bounded.

Risk: item 1 (stored reversal, inventory, and cash data): datos de reversión, stock y caja bajo RLS/append-only; requiere verificación runtime.

## Validación final observada (orquestador, PostgreSQL disposable 127.0.0.1:55449)
- Migración `20261026215000_sale_reversals`: aplicada con `prisma migrate deploy`.
- Correcciones parent: test de cajero usa setup ADMIN + actor CASHIER para el intento de reversión; `populatedFixture` y tercer test RLS siembran una reversión ANNULMENT autorizada; clave duplicada `reversal-gate` separada en `reversal-gate-reverse`.
- Focalizada W3b+RLS: **8/8** (reversal-domain 2, sale-reversals 3, rls-boundaries 3).
- Focalizada ampliada W3b/W3a/W2/RLS: **25/25** (5 archivos).
- Suite completa: **156/156** (25 archivos).
- Typecheck: **0 errores**. Lint: **0 errores/warnings**.

## Key Learnings
- La reposición debe seguir los InventoryMovement SALE originales para conservar lote y ubicación.
- El CASH_OUT se asocia a la sesión original, mientras que la sesión activa del actor solo habilita la operación.
- La moneda del Sale es nullable por compatibilidad legacy, por lo que W3b rechaza ventas legacy sin moneda.
