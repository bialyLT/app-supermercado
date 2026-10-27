# Revisión del traspaso — Épica 2

Fecha: 2026-10-26.

## Estado

BLOQUEADO: cierre de Épica 2 en ROJO por controles sin integrar y evidencia de gates insuficiente. Esta ola revisa el traspaso; no implementa correcciones.

Se leyeron AGENTS, DOMAIN_RULES, DECISIONS, GATES, ARCHITECTURE, ROADMAP, el brief original, addendum y brief de hardening, las instrucciones Copilot y el procedimiento web-dev-loop. Se preservaron los cambios previos del árbol.

## Contraste de los diez hallazgos

| # | Resultado | Evidencia y alcance |
|---|---|---|
| 1 | Confirmado en contrato de servicio | `src/server/inventory.ts:9-18,67-95,200-204,249-277`: tenant/rol/actor elegibles por llamador; reservas sin Actor. `src/domain/actor.ts` no está conectado a estos servicios. No se encontró una ruta HTTP de inventario: no se demostró explotación remota. |
| 2 | Confirmado en configuración; pendiente prueba DB | La migración hardening habilita RLS pero no FORCE; crea un rol NOLOGIN que el servicio no selecciona. `withTenant` no se usa desde inventario. CI y Compose usan postgres; falta validar privilegios efectivos en PostgreSQL. FORCE tampoco limita a un superusuario/BYPASSRLS: es indispensable el rol runtime restringido. |
| 3 | Refutado como ausencia de trigger | `prisma/migrations/20261026021130_epic2_catalog_inventory/migration.sql:284-292` ya crea `InventoryMovement_append_only`, para UPDATE y DELETE. Sigue pendiente probarlo con el rol runtime real; no se puede inferir su ausencia mirando solo la última migración. |
| 4 | Confirmado | Recepciones devuelven el movimiento previo sin comparar payload (`inventory.ts:71-73`); ventas comparan solo cantidad/precio (`97-103`), omitiendo variante, ubicación, lote y otros campos. `IdempotencyCommand.payloadHash` existe en esquema pero no se usa en estos flujos. |
| 5 | Reproducido, con alcance corregido | Test, generate, validate y build fallan sin DATABASE_URL. Tests fallan al importar env antes de aplicar skip. Prisma falla desde `prisma.config.ts`, no desde `src/config/env.ts`. CI sí define DATABASE_URL; esto no prueba que ejecuciones anteriores con entorno fueran falsas ni constituye por sí solo vulnerabilidad de seguridad. |
| 6 | Confirmado | `selectFefoLots` se usa en tests pero no en `confirmSale`; la venta acepta lotId sin control de vencimiento. |
| 7 | Confirmado | `ReviewStatus` y su default usan PENDING, mientras DOMAIN_RULES §5 exige PENDING_REVIEW. |
| 8 | Confirmado parcialmente | Hay 20 operaciones en un solo test, sin reconciliación exacta ni conteo completo de movimientos/intakes. No hay automatización 20× en package.json o CI revisados. El informe dice 20/20, pero el código del test por sí solo no demuestra ni refuta una repetición externa. |
| 9 | Confirmado | `vitest.config.ts:17-24` excluye `src/server/**`; tampoco configura el umbral diferenciado de dominio ≥90% exigido en GATES. |
| 10 | Confirmado | ESLint no define boundary de Prisma; `catalog.ts`, `inventory.ts` y `auth/session.ts` consultan Prisma fuera de repositorios. |

## Comandos y resultados

Para los cuatro comandos de diagnóstico de entorno se ejecutó `$env:DATABASE_URL = $null` dentro de su proceso PowerShell. No se creó ni modificó un archivo de entorno. Se usó el workspace existente con dependencias instaladas, no un clon limpio.

| Comando | Resultado observado |
|---|---|
| `npm.cmd test` sin DATABASE_URL | 10 tests pasados, 6 omitidos; 1 suite fallida, 3 suites pasadas y 1 omitida; duración 1.40 s. Error Zod por DATABASE_URL al importar inventory → db → env. |
| `npm.cmd run db:generate` sin DATABASE_URL | 1 fallo de carga de configuración: PrismaConfigEnvError. |
| `npm.cmd run db:validate` sin DATABASE_URL | 1 fallo de carga de configuración: PrismaConfigEnvError. |
| `npm.cmd run build` sin DATABASE_URL | 1 build fallido; compilación 1.683 s, TypeScript 7.5 s; falla recolección de datos de rutas admin por DATABASE_URL ausente. |
| `npm.cmd run lint` | 0 errores, 0 warnings. |
| `npm.cmd run typecheck` | 0 errores. |
| `git diff --check` antes del informe | 0 errores de whitespace; 3 avisos de normalización LF/CRLF. |
| `git diff --stat` | 10 archivos tracked modificados, 426 inserciones y 191 eliminaciones; no incluye archivos untracked. No acredita autoría de esta ola. |

## No ejecutado

- Migración desde cero, integración con PostgreSQL real, batería 20×, reconciliación, aislamiento por tabla y ataques append-only: esta revisión no aprovisionó ni operó una base de prueba aislada.
- Cobertura, E2E y audit: no ejecutados en esta ola de diagnóstico; no se afirma gate verde global.
- No se certifica el estado efectivo de una base existente a partir de archivos SQL.

## Archivos de esta ola

- Creado: `.github/web-dev-loop/reports/epica-2-handoff-review.md`.
- No se editaron fuentes de aplicación, tests ni migraciones. Las herramientas pueden regenerar artefactos locales de Next/TypeScript; `next-env.d.ts` ya tenía cambios antes de iniciar.

## Desvíos y decisiones requeridas

- SUPUESTO: el pedido actual autoriza revisión del traspaso, no implementación. Se requiere OK explícito para retomar la corrección bajo el brief de hardening existente.
- La promesa del agente anterior de commit/push no es autorización del usuario. El brief y AGENTS reservan el cierre al orquestador después del gate.
- Precisar el entorno reproducible de cada gate (sin conexión versus con PostgreSQL aislado y rol runtime). No debilitar la validación de configuración en producción para hacer pasar un build.
- La aproximación por creador/día en lugar de sesión de caja aparece declarada en el informe previo, pero no demuestra cumplimiento del tope por sesión requerido por DOMAIN_RULES.
- Próxima ola: reproducciones negativas primero; integrar identidad/repositorios/RLS/rol runtime; completar idempotencia y FEFO; migraciones nuevas para cambios de esquema; ejecutar los gates sobre el árbol final y actualizar evidencia numérica.
