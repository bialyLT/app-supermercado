# Informe de desarrollo — Épica 2

## Decisiones

- Se modeló catálogo separado en producto, variante, unidad y código de barras.
- Los importes y cantidades usan `Decimal` en PostgreSQL; los servicios aceptan
  strings y los serializan sin convertir dinero a `number`.
- `InventoryLevel` mantiene `onHand` y `reserved` por tenant, ubicación,
  variante y lote. Las operaciones críticas bloquean la fila con
  `SELECT ... FOR UPDATE` y usan aislamiento `Serializable`.
- `InventoryMovement` y `AuditLog` son append-only mediante triggers SQL.
- Una venta autorizada con faltante crea `UNVERIFIED_INTAKE`, su revisión
  pendiente, auditoría y salida en la misma transacción. Confirmar, corregir o
  rechazar exige permiso y deja auditoría; una corrección que produciría stock
  negativo se rechaza sin cerrar la revisión.
- No se agregó UI POS, pagos, caja, offline ni compras a proveedores.

## Archivos

- `prisma/schema.prisma`
- `prisma/migrations/20261026021130_epic2_catalog_inventory/migration.sql`
- `src/server/catalog.ts`
- `src/server/inventory.ts`
- `tests/integration/epic2-concurrency.test.ts`

## Gates ejecutados

| Gate | Resultado |
|---|---|
| `npm.cmd run db:generate` | PASS — Prisma Client 7.10.1 generado |
| `npm.cmd run db:validate` | PASS |
| `npm.cmd run db:migrate` | PASS — 4 migraciones aplicadas |
| `npm.cmd run typecheck` | PASS |
| `npm.cmd run lint` | PASS |
| `npm.cmd test` | PASS — 4 archivos, 13 tests |
| `npm.cmd run test:coverage` | PASS — 100% sobre 13 statements incluidos (thresholds 80/80/80/70) |
| `npm.cmd run build` | PASS con `DATABASE_URL` efímera |
| `vitest run tests/integration/epic2-concurrency.test.ts` | PASS — 1 PostgreSQL concurrency test |
| `npm.cmd run test:e2e` | PASS con `DATABASE_URL` efímera — 3 tests |
| `npm.cmd audit --audit-level=high` | PASS — 0 vulnerabilidades |
| `git diff --check` | PASS |

## Riesgos y límites

- La batería existente valida aislamiento estructural de tenants y la prueba
  PostgreSQL de Épica 2 valida que el último artículo no deja nivel negativo.
- El nivel sin lote usa una búsqueda previa antes del `create`; el índice único
  y el aislamiento serializable protegen la confirmación concurrente, pero una
  futura carga extrema debería agregar retry explícito de `P2034`.
- Las correcciones de regularización no inventan costo/proveedor y fallan de
  forma segura si no pueden preservar stock no negativo.
