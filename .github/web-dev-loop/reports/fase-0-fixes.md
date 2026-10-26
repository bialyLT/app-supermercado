# Fase 0 — Correcciones, upgrades y evidencia

## Alcance

Se trabajó únicamente sobre los cambios sin commit del repositorio
`supermercado`. No se modificó `REUSABLE_RETAIL_SYSTEM_CONTEXT.md` y no se
hizo commit ni push.

## Upgrades controlados

Versiones directas fijadas explícitamente en `package.json`:

- `next` y `eslint-config-next`: `16.4.3`.
- `@prisma/client`, `prisma` y `@prisma/adapter-pg`: `7.10.1`.
- `vitest` y `@vitest/coverage-v8`: `5.0.5`.
- Se agregaron `pg`, `@types/pg` y `dotenv` para el adapter PostgreSQL y
  `prisma.config.ts`.

La versión segura disponible de cada paquete se adoptó sin
`npm audit fix --force`. El entorno local usa Node `24.19.0`; los targets
adoptados son compatibles con Node 22.12+ (la CI usa Node 22 y debe resolver
una versión igual o posterior a 22.12). React `19.1.1` se conserva porque
Next 16.4.3 acepta React 19.x. No quedó vulnerabilidad reportada por `npm
audit`.

## Adaptaciones de Prisma 7

- Se eliminó `datasource.url` de `prisma/schema.prisma`, ahora configurado
  mediante `prisma.config.ts` y `DATABASE_URL`.
- Se agregó `@prisma/adapter-pg` y se actualizó el test de aislamiento para
  construir `PrismaClient` con `PrismaPg`.
- Se conservaron las FKs compuestas y la migración de aislamiento
  cross-tenant existentes.

## Configuración y código

- ESLint usa los presets flat nativos de `eslint-config-next` 16; se eliminó
  la compatibilidad legacy que provocaba una estructura circular con ESLint 9.
- Next 16 ajustó `tsconfig.json` a `react-jsx` e incorporó sus tipos de
  desarrollo generados; se mantuvo `strict: true`.
- Se cubrió también la rama de acceso válido en autorización para mantener
  los umbrales de cobertura.
- CI conserva `db:migrate`, cobertura, build, instalación de Chromium y E2E.

## Gates ejecutados

Con PostgreSQL 16 activo mediante `docker compose`:

- `npm install`: OK.
- `npm run db:generate`: OK (Prisma Client 7.10.1).
- `npm run db:validate`: OK.
- `npm run db:migrate`: OK; no había migraciones pendientes.
- `npm run typecheck`: OK.
- `npm run lint`: OK.
- `npm test`: OK — 9 tests.
- `npm run test:coverage`: OK — 100% statements, branches, functions y
  lines en el alcance configurado.
- `npm run build`: OK — Next 16.4.3/Turbopack.
- `npm run test:e2e`: OK — 1 smoke Chromium.
- `npm audit`: OK — 0 vulnerabilidades.

## Riesgos residuales

- Vitest 5 muestra una advertencia no bloqueante sobre cargar
  `vitest.config.ts` ESM como CommonJS; no afecta los gates. Puede eliminarse
  en una futura limpieza renombrando la configuración a `.mts`/`.mjs` o
  declarando el paquete como ESM, previa evaluación del impacto en Next.
- Playwright informa advertencias de filesystem lento y del origen HMR
  `127.0.0.1`; el smoke E2E pasa y no se cambió la configuración sólo para
  silenciarlas.
- `npm install` informa scripts pendientes de aprobación (`prisma`,
  `@prisma/engines`, `unrs-resolver`); la instalación y generación local
  fueron exitosas. La CI ejecuta `npm ci` en un entorno limpio.
