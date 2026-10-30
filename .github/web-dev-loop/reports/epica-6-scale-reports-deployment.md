# Épica 6 — Informe de cierre

Estado: ENTREGADO: compras, transferencias, reportes JSON/CSV, preparación Neon/Vercel y backups operativos verificados; producción no fue desplegada.

## Entregado

- Compras directas con impuestos, totales Decimal, idempotencia, auditoría y alcance tenant/sucursal.
- Transferencias automáticas entre sucursales con movimientos de inventario y ledger reconciliable.
- Reporte gerencial de operaciones en JSON/CSV con filtros y alcance por sucursal.
- Runbook Neon/Vercel y scripts de backup/restore con copia local/offsite y restore fail-closed.
- Corrección de UI de promociones: la desactivación aplica la respuesta del endpoint al estado local.

## Archivos creados o modificados

- `prisma/schema.prisma`
- `prisma/migrations/20261030110000_direct_purchases/migration.sql`
- `prisma/migrations/20261030120000_inventory_transfers/migration.sql`
- `src/domain/purchases.ts`
- `src/domain/transfers.ts`
- `src/domain/reports.ts`
- `src/server/repositories/purchases.ts`
- `src/server/repositories/transfers.ts`
- `src/server/repositories/reports.ts`
- `app/api/admin/purchases/**`
- `app/api/admin/transfers/route.ts`
- `app/api/admin/reports/operations/route.ts`
- `app/admin/promotions/promotion-manager.tsx`
- `scripts/backup-postgres.sh`
- `scripts/restore-postgres-backup.sh`
- `docs/deployment.md`
- `docs/reports.md`
- `tests/purchases-domain.test.ts`
- `tests/transfers-domain.test.ts`
- `tests/reports-domain.test.ts`
- `odd/tasks/epic6-scale-reports-deployment.md`

## Verificación

| Gate/comprobación | Resultado |
|---|---|
| Compras/transferencias PostgreSQL | 39/39 y focused 15/15 |
| Reportes dominio/API | 6/6 |
| Reportes PostgreSQL | 2/2 |
| Cobertura completa | statements 89.16%, branches 83.11%, lines 93.47%; umbral de dominio cumplido |
| Typecheck | exit 0 |
| Lint | exit 0 |
| Prisma validate y diff hygiene | exit 0 / sin salida |
| Build de producción | exit 0 |
| Auditoría de dependencias | 0 vulnerabilidades high/critical |
| Ledger restaurado | 0 divergencias |
| RLS restaurado | 43/43 tablas habilitadas y forzadas |
| Backup/restore | sintaxis 2/2, seguridad fail-closed 1/1, copia local/offsite y restore observado ≤12 s |
| Concurrencia PostgreSQL | job-74: 20 rondas, 22/22 tests, 107.25 s; invariantes sin fallos |
| E2E serial | 12/12 passed en 42.8 s |
| E2E promociones focused | 1/1 passed después del fix |

## Fallos y verificadores no disponibles

- La primera cobertura falló por branches de dominio 85.42% < 90%; se agregaron casos de validación y el gate final pasó.
- Una corrida E2E sin variables de base falló por entorno; la corrida correcta serial pasó 12/12.
- Corridas E2E/concurrencia paralelas sobre la misma base disposable sufrieron timeouts por contención; se reportan como no determinantes, no como fallos funcionales.
- La preparación de una base concurrency nueva no se ejecutó porque `psql`/`createdb` no están instalados. No se simuló ese resultado.
- Vite emitió una advertencia no fatal sobre `configLoader: 'native'`.
- Revisión nativa RDD: consentimiento declinado para este candidato; ASSESS registró `nativeReviewOutcome=declined`, sin verificador independiente. Los gates funcionales anteriores permanecen aplicables.

## Desvíos, supuestos y decisiones requeridas

- No se desplegó producción, conforme a D-010 y al alcance de la épica.
- Backups quedan gestionados por el negocio mediante `pg_dump`, copia externa cifrada y restore periódico, conforme a D-021.
- No quedan decisiones de producto abiertas para esta épica.

## Entrega

- Commits previos: `6fc3be4`, `02e2494`, `e3ef226`.
- El commit de cierre contiene la corrección de UI, pruebas de cobertura y este informe.
- Push, PR, merge y despliegue productivo quedan fuera de esta ejecución.
