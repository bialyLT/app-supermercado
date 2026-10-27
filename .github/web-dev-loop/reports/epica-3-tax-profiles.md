# Informe — Épica 3: perfil tributario argentino (T2)

Fecha: 2026-10-26. Brief: `../briefs/epica-3-tax-profiles.md`. Spec de tarea: `../../../odd/tasks/argentina-tax-profiles.md`.

## Estado

ENTREGADO (tarea T2 acotada): configuración de perfil fiscal por Store con
snapshot de venta versionado 1, migración aditiva y pruebas RED/GREEN sobre el
alcance S2-S3 aprobado, con el lote de correcciones del padre aplicado y los controles funcionales
indicados abajo aprobados. No representa el backend completo de Épica 3. Sin commit ni push.

## Archivos creados/modificados

Creados:

- `src/domain/fiscal.ts`
- `src/server/fiscal.ts`
- `src/server/repositories/fiscal.ts`
- `tests/fiscal-domain.test.ts`
- `tests/integration/fiscal-profiles.test.ts`
- `docs/fiscal-profiles.md`
- `prisma/migrations/20261026210000_argentina_tax_profiles/migration.sql`
- `prisma/migrations/20261026211000_protect_fiscal_snapshots/migration.sql`
- `.github/web-dev-loop/reports/epica-3-tax-profiles.md`

Modificados:

- `prisma/schema.prisma` (enum `FiscalCondition`, model `FiscalProfile`, `Sale.fiscalSnapshot`)
- `src/domain/actor.ts` (permisos `fiscal.profile.manage`, `fiscal.profile.read`)
- `src/server/repositories/inventory.ts` (permisos, snapshot v1 en venta)
- `tests/integration/fixtures.ts` (fixture poblado con `FiscalProfile`)

## Correcciones aplicadas en lote acotado (T2)

1. Rama asignada: `getForBranch` verifica `verified.branchIds`; rama ajena o no
   asignada dentro del mismo tenant responde `NOT_FOUND` sin alterar el perfil.
2. `internalTicket` es literal `true` (alcance internal-ticket-only); CHECK de BD
   en migración nueva (`country = 'AR' AND internalTicket = true`).
3. Snapshot fiscal protegido en BD: trigger `UPDATE` (diferencia IS DISTINCT FROM)
   y trigger `DELETE` (solo ventas con snapshot no nulo). Runtime y owner en tests.
4. `configureFiscalProfile` mantiene setter simple (sin command id explícito);
   setter repetido no crea segunda fila.
5. Dominio endurecido: schemas estrictos, `buildFiscalContext` validación estricta,
   `httpStatus` con default 500 (sin catch-all 400). Tests de errores y status.
6. Reporte: números frescos, link de spec corregido, sin líneas duplicadas,
   lenguaje honesto y gates finales reportados.

## Implementación y política

- Perfil por `Store` con FK compuesta tenant/store; tabla dedicada
  `FiscalProfile`; sin backfill fiscal legacy.
- Solo `MONOTRIBUTO` / `RESPONSABLE_INSCRIPTO`; sin régimen «pendiente» ni default.
- País Argentina (`AR`) fijo en el snapshot.
- Snapshot v1 tipado: `version: 1`, `storeId`, `storeName`, `country`, `condition`,
  `internalTicket = true`. Se crea desde la lookup del servidor dentro de la misma
  transacción de venta; ventas legacy sin perfil conservan comportamiento.
- Comando de venta idempotente reutilizando helpers compartidos; replay no
  reescribe el snapshot; cambio de perfil posterior no altera el snapshot vendido.
- Snapshot inmutable a nivel BD (triggers de `Sale`) y venta con snapshot no nula
  no eliminable.
- Sin IVA, ARCA, CUIT, numeración ni emisión fiscal.

## Gates y resultados numéricos

Entorno: Windows/PowerShell (`cmd.exe /d /c "..."`), PostgreSQL 16 descartable en
contenedor `supermercado-fiscal-session-gate` (127.0.0.1:55449, DB
`supermercado_fiscal_gate`, trust), mismas URLs para migrate/validate/setup.

| Comando | Resultado |
|---|---|
| `cmd.exe /d /c "npm.cmd run db:generate"` | exit 0; Prisma 7.10.1 |
| `cmd.exe /d /c "npm.cmd run db:validate"` | exit 0; esquema válido |
| `cmd.exe /d /c "set MIGRATION_DATABASE_URL=... && set TEST_DATABASE_URL=... && set DATABASE_URL=... && set AUTH_DATABASE_URL=... && npm.cmd run db:migrate"` | exit 0; 14/14 migraciones aplicadas (incl. `20261026211000_protect_fiscal_snapshots`) |
| `cmd.exe /d /c "set TEST_DATABASE_URL=... && npm.cmd run test:db:setup"` | exit 0; 2 roles runtime verificados |
| `cmd.exe /d /c "npm.cmd test -- --run tests/fiscal-domain.test.ts tests/integration/fiscal-profiles.test.ts"` | exit 0; 23/23 tests (8 dominio + 15 integración), GREEN |
| `cmd.exe /d /c "npm.cmd test -- --run tests/contracts.test.ts"` | exit 0; 3/3 tests, baseline previa sin cambios |
| `cmd.exe /d /c "npm.cmd run typecheck"` | exit 0; 0 errores |
| `cmd.exe /d /c "npm.cmd run lint"` | exit 0; 0 errores/0 warnings |
| `cmd.exe /d /c "set TEST_DATABASE_URL=... && npm.cmd run test:ledger"` | exit 0; 0 divergencias; RLS 28/28 tablas con tenantId |
| `cmd.exe /d /c "npm.cmd test"` | exit 0; 20 archivos / 134 tests pasados (incluye los suites fiscales) |
| `cmd.exe /d /c "npm.cmd run build"` | exit 0; compilación y static pages OK |
| `cmd.exe /d /c "npm.cmd run test:coverage"` | exit 0; 20 archivos / 134 tests; All files 97.06% stmts / 92.39% branch / 98.63% funcs / 98.9% lines; umbrales cumplidos |

## Evidencia RED/GREEN

- RED (lote de correcciones, antes de los fixes): `fiscal-domain > requires an
  explicit internal ticket and rejects unknown keys` falló (esperaba `false`,
  recibió `true`: `internalTicket: false` era aceptado); `fiscal-profiles >
  rejects a branch outside the actor assignment within the same tenant and keeps
  the profile` falló (promise resolvió en vez de rechazar: rama no verificada);
  pruebas de tamper esperaban errores `FISCAL_SNAPSHOT_*` y fallaron pre-fix.
- GREEN: focused fiscal post-fix: **23/23 passed**, exit 0 (5 dominio + 18
  integración; suites ampliadas en este lote).

## Differential check de `confirmSale`

- Baseline (copia scratch de la baseline real con cambios previos, sin Epic2 de HEAD):
  `tests/integration/inventory-hardening.test.ts`: **23/23 passed**, exit 0.
- Cambio: mismo suite: **23/23 passed**, exit 0.
- Diferencia observada: solo timings; nombres de tests y resultados idénticos.

## No ejecutado / límites

- E2E (`npm.cmd run test:e2e`): **no aplicable** en este lote (sin cambios de UI
  ni de API HTTP; cambios server/domain solamente). No ejecutado por decisión
  acotada.

## Desvío acotado

- Ninguno en comportamiento de negocio; la protección de snapshot se materializó
  en migración nueva con triggers (corrección solicitada por el padre).

## SUPUESTO / decisiones requeridas

- No aplica: `internalTicket` queda fijo en `true` dentro del alcance
  internal-ticket-only aprobado; sin régimen pendiente ni default.
- Risk: item 2 (nuevo permiso fiscal por tenant). Verificación independiente
  completada sin bloqueos; no implica aceptación de riesgos por parte del dueño.

## Verificación de cierre T3

- Padre: focused fiscal **23/23**, exit 0, PostgreSQL real (5.96 s).
- Verificador independiente: **26/26**, exit 0 (11.24 s), incluidos RLS y
  probes SQL dentro de transacciones con rollback. S1-S3 cumplidas; 0 bloqueos.
- ASSESS nativo: `unassessable` por cambios untracked previos sin declaración
  explícita. Escalado item 2: verificador independiente requerido y completado.
  Review nativa no ejecutada; no existe aprobación ni recibo nativo para este lote.
- Higiene: `git diff --check` Linux falló por terminadores CRLF de Prisma;
  `git -c core.whitespace=cr-at-eol diff --check` sobre documentos/esquema
  pasó, exit 0; archivos fiscales nuevos sin whitespace residual y enlace válido.
- Auditoría de dependencias no repetida: no se cambiaron dependencias.
- E2E/CI remoto/despliegue no ejecutados. No se certifica facturación fiscal.
- Base descartable conserva fixtures de iteraciones previas; no es base operativa.
