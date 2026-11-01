# Informe — Completitud operativa, Ola 3

Estado: ENTREGADO: se expusieron únicamente recepción, alertas y bandeja/detalle/revisión de intake respaldados por servicios existentes.

## Contratos entregados

- `GET/POST /api/admin/inventory/receipts`
- `GET /api/admin/inventory/alerts`
- `GET /api/admin/inventory/intakes`
- `GET /api/admin/inventory/intakes/:id`
- `POST /api/admin/inventory/intakes/:id/review`

Los contratos usan actor y sesión server-side, scope de tenant y sucursales
asignadas, Decimal serializado como string, permisos revalidados dentro de
la transacción, idempotencia existente, auditoría y mutaciones online.
La revisión conserva separación de funciones, estados terminales inmutables,
motivo obligatorio y respuestas 401/403/404/409 del dominio.

## BLOQUEADO

- `POST /api/admin/inventory/adjustments`: bloqueado. No existe un caso de
  uso de ajuste administrativo independiente; el único ajuste respaldado es
  la corrección de un `UNVERIFIED_INTAKE` mediante `review`, que además
  actualiza el level atómicamente e inserta movimientos append-only. Exponer
  otro payload requeriría decidir semántica, permiso y contrato de auditoría.
- UI administrativa: bloqueada para esta ola; no se agregó pantalla sobre
  contratos sin componentes/flujo de producto aprobados. Los endpoints
  entregados quedan listos para una pantalla posterior.

## Archivos

- `src/server/repositories/inventory.ts`
- `src/server/inventory.ts`
- `app/api/admin/inventory/receipts/route.ts`
- `app/api/admin/inventory/alerts/route.ts`
- `app/api/admin/inventory/intakes/route.ts`
- `app/api/admin/inventory/intakes/[id]/route.ts`
- `app/api/admin/inventory/intakes/[id]/review/route.ts`
- `tests/api/operational-inventory-contracts.test.ts`

## Gates y resultados numéricos

- Tests API focalizados: **3/3 pasaron**, 0 fallos, 3.20 s.
- Tests focalizados API + integración: **3/29 pasaron, 26 skipped, 0 fallos**;
  integración omitida porque `TEST_DATABASE_URL` no está configurado.
- Typecheck: **0 errores**, exit 0.
- Lint: **0 errores, 0 warnings**, exit 0.
- Prisma generate: **exit 0**.
- Prisma validate: **exit 0**, schema válida.
- Build: **exit 0**, compilación correcta y **27/27 páginas estáticas**;
  rutas nuevas presentes en el manifiesto.
- `git diff --check`: **exit 0**, sin salida.
- Ledger: **NO EJECUTADO**; `TEST_DATABASE_URL` requerido.
- Concurrencia: **NO EJECUTADO**; faltan `DATABASE_URL` y `TEST_DATABASE_URL`.
- E2E: **NO EJECUTADO**; ya existe servidor Next en PID 11740/puerto 3000.
- PostgreSQL real, RLS, append-only y batería de concurrencia: **NO
  EJECUTADOS** por falta de URLs de base de datos.

## Desvíos y decisiones

- No se modificaron `prisma/schema.prisma`, migraciones, roles ni decisiones.
- No se inventaron defaults para caps de intake; se reutilizó la política
  existente y su semántica de alertas.
- `SUPUESTO:` `inventory:write` es el gate de interfaz administrativo
  existente para stock managers; el servicio vuelve a verificar el permiso
  específico (`inventory.receive` o `inventory.unverified_intake.review`).
- Decisión requerida: definir contrato/permiso/auditoría para un ajuste
  administrativo independiente antes de desbloquearlo.

Sin commit ni push.

## Remediación Wave 3 — RED/GREEN (2026-11-01)

Estado: ENTREGADO: se corrigieron los hallazgos de intake, límites decimales,
permiso canónico y códigos HTTP sin agregar roles ni cambiar la semántica de
auditoría/discrepancia.

### RED

- La revisión `REJECTED` no creaba movimiento compensatorio ni actualizaba el
  `InventoryLevel`.
- La ruta de bandeja/revisión usaba `inventory:write`, por lo que `SUPERVISOR`
  no podía ejercer `inventory.unverified_intake.review`.
- Los fallos inesperados de las rutas inventory respondían 400 en lugar de
  500 `REQUEST_FAILED`.
- Cantidades con más de 12 dígitos enteros podían alcanzar la persistencia
  `DECIMAL(18,6)` y las correcciones no compartían el límite de entrada.
- El trigger aplicado permitía mutar columnas de un intake pendiente mientras
  estaba en `PENDING_REVIEW`.

### GREEN

- `REJECTED` ahora actualiza el level condicionalmente y agrega un movimiento
  `ADJUSTMENT/OUT` atómico con la discrepancia y la auditoría existentes.
- Nueva migración no destructiva
  `20261101030000_protect_pending_intake_state`: sólo permite la transición
  `PENDING_REVIEW` a estado terminal con metadatos de revisión; bloquea DELETE
  y mutaciones de columnas inmutables del caso pendiente.
- Receipt y correction comparten validación explícita de rango de almacenamiento
  y devuelven `INVALID_INPUT` (400); no se delega el error a PostgreSQL.
- Las rutas de intake usan `inventory.unverified_intake.review`; el servicio
  mantiene la verificación server-side y la separación de funciones.
- Los errores inesperados de las rutas inventory responden HTTP 500 con
  `REQUEST_FAILED`; 400/401/403/404/409 se conservan para errores conocidos.

### Gates ejecutados

| Gate | Resultado |
|---|---|
| Focused regressions | **14/14 pasaron**, 2 archivos, 4.73 s |
| Full Vitest | **230/391 pasaron, 161 skipped**, 38 archivos; skips por PostgreSQL |
| Typecheck | **exit 0**, 0 errores |
| Lint | **exit 0**, 0 errores, 0 warnings |
| Prisma generate | **exit 0** |
| Prisma validate | **exit 0** |
| Build | **exit 0**, compilación y **27/27 páginas** |
| `git diff --check` | **exit 0**, sólo warnings de conversión de fin de línea Git |
| E2E | **NO EJECUTADO**: servidor Next preexistente PID 11740/puerto 3000 impidió iniciar el webServer |
| Ledger | **NO EJECUTADO**: `TEST_DATABASE_URL` no configurado |
| Concurrencia | **NO EJECUTADO**: faltan `DATABASE_URL` y `TEST_DATABASE_URL` |
| Migración desde cero | **BLOQUEADO**: `prisma migrate deploy` devolvió P1000, credenciales PostgreSQL locales inválidas |
| PostgreSQL/RLS/append-only real | **NO EJECUTADO** por las mismas credenciales/URLs |
| Audit dependencias | **exit 1**, 0 altas/críticas y 16 moderadas preexistentes; `--force` propone downgrade incompatible de ESLint |

Desvío: no se hizo commit, push ni cambio destructivo. La batería real de
ledger/concurrencia/RLS queda pendiente de credenciales PostgreSQL válidas.

### Corrección DB-002 posterior al gate

La revisión detectó que `20261101030000_protect_pending_intake_state` sólo
redefinía la función y revocaba DELETE/TRUNCATE, sin crear el trigger ni revocar
UPDATE. Se agregó la migración no destructiva
`20261101031000_enforce_pending_intake_runtime_boundary`, que hace
`DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` y revoca UPDATE/DELETE/TRUNCATE.
También se agregó una verificación SQL de `pg_trigger` y
`has_table_privilege` al test de integración. Queda pendiente ejecutar esa
verificación contra PostgreSQL cuando existan credenciales válidas.

Checks posteriores: focused regressions **14/14 pasaron**, 2 archivos, 7.48 s;
typecheck, lint, Prisma validate/generate y `git diff --check` pasaron. La
prueba SQL de integración quedó **skipped** por `DATABASE_URL`/`TEST_DATABASE_URL`
ausentes.
