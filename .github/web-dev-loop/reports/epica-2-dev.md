# Informe de desarrollo — Épica 2 hardening

## Estado

ENTREGADO: cierre técnico de dependencias de Épica 2 en [epica-2-closure.md](epica-2-closure.md): 111/111 tests, 5/5 E2E, 20/20 rondas concurrentes y 0 divergencias. Pendiente aceptación del orquestador; sin commit/push.

El contenido siguiente se conserva como **informe histórico recibido**, no como
certificación del árbol actual. Sus afirmaciones fueron contrastadas en
`epica-2-handoff-review.md` y reemplazadas por los informes de hardening y cierre.

## Archivos creados/modificados

- `prisma/schema.prisma`
- `prisma/migrations/20261026032000_epic2_hardening/migration.sql`
- `src/domain/actor.ts`
- `src/domain/ean13.ts`
- `src/domain/fefo.ts`
- `src/server/repositories/tenant-context.ts`
- `src/server/inventory.ts`
- `tests/ean-fefo.test.ts`
- `tests/integration/epic2-concurrency.test.ts`
- `package.json`, `package-lock.json`

No se modificó `REUSABLE_RETAIL_SYSTEM_CONTEXT.md` ni ninguna migración
existente.

## Implementación y política

- RLS con `app.tenant_id`, políticas `USING/WITH CHECK` en las tablas
  operativas nuevas y rol `supermercado_app` sin `UPDATE/DELETE` en ledger y
  auditoría.
- `InventoryLevel` tiene CHECK de saldo; la salida usa `UPDATE ... WHERE
  onHand - reserved >= quantity` y retry de `P2034` hasta 3 intentos.
- Movimientos y auditoría son append-only mediante triggers; movimientos tienen
  clave idempotente por tenant. Reenvío compatible devuelve el resultado y
  payload incompatible falla con `IDEMPOTENCY_CONFLICT`.
- `UNVERIFIED_INTAKE`: `ALLOW_WITH_CAPS` por defecto; topes 10 por línea, 30
  por sesión/cajero y 20 por variante/día, configurables por tenant. Se
  rechazan política deshabilitada, variante inactiva, exceso de topes y
  `REQUIRE_SUPERVISOR` sin supervisor. El creador no puede revisar y un caso
  cerrado no se modifica; `REJECTED` no revierte el ledger.
- Parser puro EAN-13 con checksum, prefijo y modo peso/precio configurables.
- Selector FEFO puro: lotes vencidos se omiten salvo aprobación de supervisor.
- `Actor` y helper de contexto tenant agregados como boundary de repositorio.

## Gates declarados en el informe histórico (no vigentes)

| Gate | Resultado |
|---|---|
| `npm.cmd run db:generate` | PASS — Prisma 7.10.1 |
| `npm.cmd run db:validate` | PASS |
| `npm.cmd run db:migrate` | PASS — 5 migraciones aplicadas |
| `npm.cmd run typecheck` | PASS — 0 errores |
| `npm.cmd run lint` | PASS — 0 errores/warnings |
| `npm.cmd test` | PASS — 17/17 tests, 5 archivos |
| EAN/FEFO/Actor focalizado | PASS — 4/4 tests |
| PostgreSQL concurrency focalizado | PASS — 1/1 test |
| Batería de concurrencia 20× | PASS — 20/20 ejecuciones |
| `npm.cmd run test:coverage` | PASS — 88.88% statements, 81.57% branches, 100% functions |
| `npm.cmd run build` | PASS — Next.js production build |
| `npm.cmd audit --audit-level=high` | PASS — 0 vulnerabilidades |
| `npm.cmd run test:e2e` | PASS — 3/3 tests |
| `git diff --check` | PASS — sin errores |

## No ejecutado según el informe histórico

- No quedan gates base sin ejecutar.

## Riesgos residuales / decisiones requeridas

- `sessionId` aún no es una entidad persistida de caja en Épica 2; el tope de
  sesión se aplica conservadoramente por `createdBy` y día comercial del
  servidor hasta Épica 3.
- SUPUESTO: la política ausente equivale a `ALLOW_WITH_CAPS` con los valores
  aprobados por D-003b.
- SUPUESTO: la aprobación de supervisor se representa por rol en esta épica;
  el token step-up de un solo uso queda para D-012.
