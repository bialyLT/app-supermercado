# Informe de desarrollo — Fase 0

**Estado:** ENTREGADO: hallazgos de Fase 0 implementados y verificados
localmente. No se hizo commit ni push.

## Alcance

Se corrigió exclusivamente la fundación y los hallazgos de aislamiento,
calidad y automatización de Fase 0. No se tocaron funcionalidades de ventas,
pagos, stock u offline, ni `REUSABLE_RETAIL_SYSTEM_CONTEXT.md`.

## Cambios principales

- Se agregaron FKs compuestas por `tenantId` para `Branch -> Store`,
  `CashRegister -> Branch`, `UserRole -> User/Role` y `AuditLog -> actor`.
- `UserRole` ahora persiste `tenantId` y lo incluye en su clave primaria.
- Se creó la migración `20261026011000_enforce_tenant_boundaries`, con índices
  únicos necesarios, backfill controlado y restricciones PostgreSQL.
- Se agregaron tests PostgreSQL que aceptan relaciones válidas y rechazan con
  `P2003` las cinco variantes cross-tenant, incluyendo por separado user y role
  en UserRole.
- ESLint 9 usa `FlatCompat` con los presets oficiales
  `next/core-web-vitals` y `next/typescript`; las reglas están activas.
- Vitest usa `@vitest/coverage-v8`, tiene `test:coverage`, incluye sólo
  `src/**/*.ts` y aplica umbrales 80/80/80/70 (líneas/funciones/statement/
  branches), sin incluir artefactos `.next`.
- CI instala, valida y aplica migraciones contra PostgreSQL limpio, ejecuta
  typecheck, lint, tests, coverage, build e instala Chromium antes del smoke
  Playwright.

## Comandos ejecutados y evidencia

Con PostgreSQL 16 local levantado mediante `docker compose up -d`:

- `npm.cmd install`: OK; lockfile actualizado. Audit quedó en 9 vulnerabilidades.
- `npm.cmd run db:generate`: OK; Prisma Client 6.19.3 generado.
- `npm.cmd run db:validate` (con `DATABASE_URL`): OK.
- `npm.cmd run db:migrate`: OK; 2 migraciones aplicadas desde la base local.
- `npm.cmd test` (con `DATABASE_URL`): OK; **2 archivos, 9 tests pasaron**,
  incluidos 6 tests de aislamiento PostgreSQL.
- `npm.cmd run test:coverage`: OK; **100%** en el alcance `src/**/*.ts`,
  superando 80/80/80/70.
- `npm.cmd run typecheck`: OK.
- `npm.cmd run lint`: OK, ESLint sin errores.
- `npm.cmd run build`: OK; Next compiló y prerenderizó 2 rutas.
- `npm.cmd run test:e2e`: OK; **1 smoke Chromium pasó**. Next emitió sólo el
  warning conocido de `allowedDevOrigins` del servidor de desarrollo.
- `npm.cmd audit`: ejecutado; ver residuales en `fase-0-fixes.md`.
- `npm.cmd audit fix` (sin `--force`): ejecutado; no había actualización
  compatible disponible.

## Limitaciones y riesgos

- `npm audit fix --force` no se ejecutó: propone saltos mayores a Vitest 5,
  Prisma 7 y Next 16. Los residuales deben resolverse con upgrades compatibles
  planificados, no con un cambio ciego.
- El smoke local usa `reuseExistingServer`; CI parte sin servidor y descarga
  Chromium con `npx playwright install --with-deps chromium`.
- El warning `allowedDevOrigins` no bloquea el smoke, pero debe configurarse
  antes de exponer el servidor de desarrollo fuera de localhost.
