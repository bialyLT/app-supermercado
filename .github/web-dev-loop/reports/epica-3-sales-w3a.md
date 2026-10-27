Estado: ENTREGADO: W3a implementa movimientos manuales de caja y cierre ciego auditable; esta corrección bounded normaliza resultados de cierre y completa la población RLS; W3b permanece fuera de alcance.

## Archivos creados/modificados
- `src/domain/cash.ts`: contratos de apertura, movimientos y cierre ciego.
- `src/server/cash.ts`: servicios públicos de movimientos y cierre ciego.
- `src/server/repositories/cash.ts`: ledger, cálculo server-side, cierre atómico, auditoría e idempotencia.
- `src/server/repositories/inventory.ts`: asociación de pagos nuevos a la sesión.
- `prisma/schema.prisma`: CashMovement, cierre y `Payment.registerSessionId` nullable.
- `prisma/migrations/20261026214000_cash_movements_close/migration.sql`: esquema, RLS, grants, append-only y corrección de compatibilidad legacy en el CHECK de cierre.
- `tests/cash-domain.test.ts`, `tests/integration/cash-closure.test.ts`, `docs/cash-movements.md`.
- `odd/tasks/epic3-sales-cash-payments.md`.

## Especificaciones cubiertas
- S3: caja backend, sin UI/offline/fiscal.
- S4: pagos CASH únicamente contribuyen al esperado; no se agrega vuelto.
- S5: transacción existente, actor/tenant, idempotencia y compatibilidad de apertura/cierre.

## TDD y comandos
- RED: migración W3a en DB disposable existente falló con P3018 / SQLSTATE23514 porque sesiones CashRegisterSession legacy ya cerradas tenían `closedAt`/`closedBy` y los tres nuevos campos NULL; recuperación esperada: aplicar la migración corregida sin fabricar conteos históricos. La regresión de compatibilidad se agregó en `tests/integration/cash-closure.test.ts`.
- RED inicial: `cmd.exe /d /c "npm.cmd test -- --run tests/cash-domain.test.ts tests/integration/cash-closure.test.ts"`: 3 tests pasaron, 12 skip, 1 test nuevo falló por schemas aún inexistentes.
- GREEN: `cmd.exe /d /c "npm.cmd test -- --run tests/cash-domain.test.ts"`: 4/4 pasaron.
- `cmd.exe /d /c "npm.cmd run db:generate && npm.cmd run db:validate && npm.cmd run typecheck"`: generate OK, validate OK, typecheck 0 errores.
- `cmd.exe /d /c "npm.cmd test -- --run tests/cash-domain.test.ts tests/integration/cash-closure.test.ts tests/integration/manual-payments.test.ts tests/integration/rls-boundaries.test.ts"`: 4/4 archivos; 4 pasaron, 19 skip.
- `cmd.exe /d /c "npm.cmd test"`: 36/36 tests pasaron, 114 skip.
- `cmd.exe /d /c "npm.cmd run lint"`: 0 errores/warnings.
- `npm test -- --run tests/integration/cash-closure.test.ts`: NO EJECUTADO por binding nativo ausente de Rolldown (`@rolldown/binding-wasm32-wasi`); no se alteraron dependencias.
- `npm run typecheck`: exit 0, 0 errores.
- Migración corregida: NO EJECUTADA; el runner 127.0.0.1:55449 rechazó las credenciales sintéticas (`P1010`). La URL por defecto tampoco estaba disponible (`P1001 localhost:5432`). La recuperación queda verificada estructuralmente y requiere reintentar `db:migrate` en una DB disposable con credenciales válidas.
- Ledger: NO EJECUTADO; falta `TEST_DATABASE_URL`.

## Desvíos y riesgos
- Las pruebas de integración reales y RLS quedan pendientes por la limitación de credenciales/base disponible.
- Riesgo: item 1 (stored cash data): CashMovement y cierre tienen tenant/RLS, grants mínimos, trigger append-only y cierre inmutable.
- `Payment.registerSessionId` es nullable para preservar pagos legacy; pagos nuevos lo rellenan y el cálculo también usa la relación de la venta.

## SUPUESTO / decisiones requeridas
- SUPUESTO: un monto de apertura omitido se registra como `OPENING` cero, conservando el contrato W2/W1.
- No se requiere decisión adicional para diferencias: se almacenan y auditan sin bloquear el cierre, según W3a.

## Key Learnings
- El resultado idempotente de cierre se reconstruye desde la sesión cerrada para conservar declarado/esperado/diferencia, porque el helper compartido normaliza resultados a su contrato base.
- La migración debe mantener nullable el vínculo de pagos para no inventar sesiones históricas.
- Los campos nuevos de cierre deben validarse como grupo independiente: legacy puede tener `closedAt`/`closedBy` sin conteos históricos; el cierre ciego nuevo sigue escribiendo los tres valores atómicamente.

## Corrección bounded W3a
- `src/server/repositories/cash.ts`: `declaredCash`, `expectedCash` y `difference` se normalizan mediante `money(value, currency)` en las ramas normal e idempotente de `closeBlind`; no se modifican los valores almacenados.
- `tests/integration/rls-boundaries.test.ts`: `populatedFixture` crea un `CashMovement` autorizado con clave idempotente única por tenant.
- `odd/tasks/epic3-sales-cash-payments.md`: se registra esta corrección sin ampliar W3a/W3b.

## TDD y validación de esta corrección
- RED: `npm test -- --run tests/integration/cash-closure.test.ts tests/integration/rls-boundaries.test.ts` falló al iniciar por binding nativo ausente de Rolldown (`@rolldown/binding-wasm32-wasi`); la base disposable tampoco está configurada (`DATABASE_URL`/`TEST_DATABASE_URL` ausentes).
- GREEN: `npm run typecheck`: exit 0, 0 errores.
- GREEN integración: NO EJECUTADO; no fue posible ejecutar Vitest ni contra PostgreSQL disposable por las limitaciones anteriores. No se modificaron dependencias.

## Risk item 1
- Stored cash data: la normalización solo afecta la representación de salida; conserva Decimal almacenado, cierre atómico, RLS y append-only. La población adicional usa el servicio autorizado y no debilita fronteras ni permisos. La corrección del test solo ajusta la expectativa al contrato existente de conflicto de idempotencia; no cambia datos almacenados ni la implementación. Revalidar en PostgreSQL disposable cuando haya credenciales válidas.

## Corrección bounded de test
- El replay de `blind-close` conserva la misma clave pero cambia `reason` (`Short count` → `Replay`), por lo que espera rechazo `IDEMPOTENCY_CONFLICT`.
- La aserción con una clave distinta conserva `REGISTER_SESSION_ALREADY_CLOSED`.

## TDD y validación de esta corrección
- RED: suite PostgreSQL enfocada observada en 22/24; los 2 fallos fueron las expectativas de replay que resolvían exitosamente pese al payload cambiado.
- GREEN: `npm test -- --run tests/integration/cash-closure.test.ts` no pudo iniciar por binding nativo ausente de Rolldown (`@rolldown/binding-wasm32-wasi`); `npm run typecheck` pasó con exit 0 y 0 errores.

## Key Learnings
- La idempotencia compara el payload completo: reutilizar `blind-close` con un `reason` distinto es `IDEMPOTENCY_CONFLICT`, no un replay válido.
- Una clave de idempotencia nueva después del cierre sigue fallando con `REGISTER_SESSION_ALREADY_CLOSED`.
- Prisma puede normalizar un `DECIMAL` persistido como `3`, aunque el contrato público lo formatee como `3.00`; las aserciones de persistencia deben usar `toFixed(2)` cuando verifican escala monetaria.

## Corrección bounded de test: escala Decimal persistida
- `tests/integration/cash-closure.test.ts`: las dos aserciones de persistencia ahora comparan `declaredCash?.toFixed(2)` y `difference?.toFixed(2)` con `3.00` y `0.00`; no cambia implementación, migración ni datos.

## TDD y validación de esta corrección
- RED: suite enfocada real de PostgreSQL observada en 23/24; el único fallo fue la expectativa `toString()` de `DECIMAL` persistido (`3` frente a `3.00`).
- GREEN: `npm test -- --run tests/integration/cash-closure.test.ts` no inició por binding nativo ausente de Rolldown (`@rolldown/binding-wasm32-wasi`), exit 1; `npm run typecheck` pasó, exit 0, 0 errores.

## Risk item 1
- Stored cash data: riesgo sin cambios; la corrección solo normaliza la representación en la aserción de test y no modifica valores almacenados, cierre atómico, RLS, grants ni append-only.

## Validación final observada
- PostgreSQL disposable: migración `20261026214000_cash_movements_close` aplicada después de `resolve --rolled-back`; no se fabricaron conteos legacy.
- Focalizada W3a/W2/RLS: **24/24** tests, 4 archivos.
- Suite completa: **36 passed, 115 skipped**, 23 archivos.
- Typecheck: **0 errores**.
- Lint: **0 errores/warnings**.
- `git diff --cached --check` reporta CRLF heredado en `prisma/schema.prisma`; no se reformateó para preservar EOL.
