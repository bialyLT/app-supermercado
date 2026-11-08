# Informe — Reparación de CI de completitud operativa

Estado: BLOQUEADO: las correcciones están implementadas, pero no se pudo ejecutar la batería PostgreSQL y el verificador independiente no estuvo disponible; no se debe hacer commit ni push hasta resolver el riesgo de prueba o aceptar explícitamente esa falta de evidencia.

## Rama y baseline

- Rama: `feat/operational-ui-completeness`
- Commit base: `a06f8a4` (`origin/feat/operational-ui-completeness` al inicio del trabajo)
- PR: #13 hacia `main`; el estado anterior era `MERGEABLE` / `UNSTABLE` por CI fallido.
- No se hizo commit, push ni merge.

## Archivos modificados

- `src/server/repositories/inventory.ts`
- `prisma/migrations/20261103000000_regrant_intake_transition_columns/migration.sql` (nueva, aditiva)
- `tests/integration/intake-alerts.test.ts`
- `tests/integration/inventory-hardening.test.ts`
- `odd/tasks/operational-ui-ci-repair.md`

El cambio de `REJECTED` elimina la mutación de stock y el movimiento `ADJUSTMENT/OUT`; la revisión cierra el caso y registra la discrepancia, conforme a `DOMAIN_RULES.md` §5. La migración concede sólo `UPDATE` en `status`, `correctionQuantity`, `reviewedBy` y `reviewedAt`; el trigger sigue rechazando cambios de campos no permitidos. Las pruebas ya no reescriben `createdAt` en casos pendientes y el caso de corrección usa una cantidad positiva válida que intenta reducir stock por debajo del saldo.

## Comandos y resultados

- CI previo, run `41529703643`, commit `a06f8a4`: `npm test`, **385/392 pasaron, 7 fallaron**, en 3 archivos. Fallos: transición inválida al mutar `createdAt`; permiso UPDATE denegado para resolver intake; `REJECTED_WOULD_NEGATE_STOCK`; test esperaba error de dominio para cantidad cero que la validación rechaza como `INVALID_INPUT`. El error de rechazo también quebraba 2 fixtures RLS.
- Focused local `npm test -- tests/integration/intake-alerts.test.ts tests/integration/inventory-hardening.test.ts tests/integration/rls-boundaries.test.ts`: **3 archivos skipped, 30 tests skipped**, porque no hay `DATABASE_URL` ni `TEST_DATABASE_URL` configurados en el shell.
- Suite local `npm test`: **timeout a los 30 s**, sin resultado final. Se considera fallo; no se reintentó.
- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0, sin salida de errores.
- `npm run db:validate`: exit 0; schema válida.
- `git diff --check`: exit 0.
- Verificador independiente `gentle-ai-verify`: no disponible; devolvió un error genérico del runtime. No se reintentó. ASSESS requiere verificador independiente por riesgo alto (item 2); no se completó esa evidencia.
- La primera ejecución de pruebas se hizo desde el checkout padre por un error de cwd: 3 suites/28 tests skipped; no cuenta como verificación del worktree feature.

## No ejecutado / gates pendientes

- Integración PostgreSQL, RLS, estado de transición y ledger: no verificables sin URLs de DB; los 30 tests focalizados quedaron skipped.
- Cobertura, ledger, concurrencia, build y E2E: no ejecutados después de los cambios.
- No se ejecutó una nueva CI remota porque todavía no se publicó un commit.

## Desvíos, supuestos y decisión requerida

- El informe histórico `operational-ui-completeness-wave3.md` describe el comportamiento anterior de `REJECTED`; este informe registra la corrección necesaria para alinear la implementación con `DOMAIN_RULES.md`.
- No se asumió un cambio de regla de negocio: rechazo no revierte ledger; crea discrepancia y requiere que el caso conserve su contexto de venta.
- Risk: item 1 (comportamiento de stock/ledger) e item 2 (privilegios runtime de transición).
- Decisión del dueño: “Esperar verificación”. No se autoriza publicar mientras falten la verificación independiente y los tests PostgreSQL.
- El usuario conserva el merge en GitHub; no se realizó commit, push ni merge.
