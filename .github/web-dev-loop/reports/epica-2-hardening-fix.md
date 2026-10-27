# Corrección y verificación — Épica 2 hardening

Fecha: 2026-10-26. Autorización: el usuario respondió «ok avancemos» tras la revisión de traspaso.

**Continuación:** los cuatro bloqueos de esta fotografía histórica se resolvieron
en la ola autorizada siguiente. Informe vigente: [epica-2-closure.md](epica-2-closure.md).

## Estado

BLOQUEADO: las correcciones técnicas verificadas pasan sus gates, pero no se declara cerrado el alcance completo de Épica 2. Persisten sesión de caja real, aprobación step-up, topes de valor y alertas pendientes. Sin commit ni push.

## Resultado principal

- Identidad de inventario derivada de Better Auth mediante `getServerActor()` y recomprobada contra sesión vigente, usuario activo, roles y asignaciones persistidas. El comando no admite tenant, rol, actor, permisos ni sessionId como autoridad.
- Repositorios para las consultas Prisma; ESLint rechaza importaciones directas de Prisma/client fuera de esa capa y dependencias de infraestructura en dominio.
- Conexiones separadas para runtime, autenticación y migraciones; runtime de inventario rechaza superusuario, BYPASSRLS, propietario y roles de creación/administración. RLS habilitado y forzado en las 24 tablas con tenantId, más política específica del tenant raíz.
- Ledger y auditoría protegidos por triggers ya existentes y privilegios runtime sin UPDATE/DELETE/TRUNCATE. Se verifican ataques con runtime y con el propietario para distinguir permisos de triggers. Se revoca acceso runtime al historial de migraciones.
- Idempotencia obligatoria por tenant/clave con hash SHA-256 de comando normalizado, tipo y usuario, y resultado serializado persistido. Se cubren payload distinto, reenvío concurrente y renovación de sesión. Claves legacy sin hash verificable fallan cerradas.
- Descuento condicional, bloqueo ordenado de levels y advisory lock por tenant para serializar topes y comandos. Reintentos de SQLSTATE 40001/40P01 y P2034 hasta tres intentos; efectos fallidos se revierten.
- FEFO conectado a venta, con asignación entre varios lotes y rechazo de vencidos. Cantidades se validan hasta tres decimales y contra la precisión de la variante.
- Estado PENDING_REVIEW en nuevos casos y migración de pendientes previos. Casos resueltos inmutables en base; separación de funciones. CONFIRMED genera compensación neta cero; CORRECTED genera ajuste sujeto a saldos; REJECTED conserva el ledger y crea discrepancia vinculada a venta, línea y sesión autenticada. Movimientos de intake/salida comparten caseId.
- Precios sin sucursal limitados al global, prioridad correcta de precio específico y precisión fraccionaria para nuevos productos pesables.
- Inicialización diferida de base/Better Auth permite herramientas y build sin conexión. Producción exige secreto explícito al usar autenticación.
- Cuenta credential de Better Auth usa user.id, no email; migración nueva conserva hashes y corrige cuentas previas compatibles.

## Reproducciones antes del arreglo

| Reproducción | Resultado previo |
|---|---|
| Idempotencia de recepción, vencido en venta, RLS FORCE y estado contractual | 4/4 fallaron como se esperaba; luego 4/4 pasaron. |
| Aislamiento completo de metadatos de identidad | 2 fallaron y 1 pasó: Branch era visible y modificable entre tenants. |
| SQLSTATE 40001/40P01 reales, emitidos por PostgreSQL | 2/2 fallaron; después 2/2 pasaron, con máximo 3 intentos y rollback comprobado. |
| Renovación de sesión y clave legacy | 2/2 fallaron; después 2/2 pasaron. |
| Hallazgos del auditor: alcance de precios, prioridad de precio, precisión pesable, secreto de producción | 4/4 fallaron; después 4/4 pasaron. Auditor read-only volvió a revisar los cuatro deltas y los confirmó resueltos estáticamente. |
| Account.accountId conforme a Better Auth instalado | 1 fallo y 1 pasado; posteriormente toda la suite de identidad pasa y se prueba login del usuario creado vía API. |
| E2E identidad pública/sucursal ajena | 2 fallaron y 3 pasaron: sessionId expuesto y 403 donde se requiere 404. |
| Runtime leyendo _prisma_migrations | 1 fallo: lectura permitida; ahora la denegación pasa. |
| Cobertura final, primer intento | 83/84: timeout de 5 s en carga fría de ESLint. Se movió la inicialización a beforeAll con límite de 30 s; se repitió toda la batería, 84/84. No se alteró la aserción de boundary. |

Los tests de trazabilidad caseId y varias restricciones ampliadas se agregaron como verificación del contrato durante la implementación; no se afirma una ejecución previa en rojo independiente para cada línea de cambio.

## Entorno reproducible

- Windows/PowerShell; Node 24.19.0; PostgreSQL 16 en Docker local.
- Contenedor propio `supermercado-epic2-gate`, puerto loopback 55439.
- Base final `supermercado_cert_gate`, creada vacía para aplicar las 11 migraciones. Las bases previas `supermercado_gate` y `supermercado_final_gate` se usaron para reproducciones y upgrade incremental.
- Runtime: LOGIN miembro de supermercado_app; autenticación: otro LOGIN miembro de supermercado_auth. Ambos sin SUPERUSER/BYPASSRLS/CREATEDB/CREATEROLE. Fixtures con TEST_DATABASE_URL de propietario solo en base descartable.
- No se creó ni leyó un .env real. Las variables se pasaron al proceso. Ejemplos y comandos repetibles en `docs/inventory-gates.md`.

## Gates del árbol de código final

| Comando/gate | Resultado numérico |
|---|---|
| `npm.cmd run db:generate` sin URLs | exit 0; Prisma 7.10.1; 781 ms. |
| `npm.cmd run db:validate` sin URLs | exit 0; 0 errores. |
| `npm.cmd run db:migrate` sobre base vacía | exit 0; 11/11 migraciones aplicadas, sin SQL manual de reparación. |
| `npm.cmd run test:db:setup` | exit 0; 2 LOGIN runtime verificados sin los 4 privilegios elevados enumerados. |
| `npm.cmd run typecheck` | exit 0; 0 errores. |
| `npm.cmd run lint` | exit 0; 0 errores/warnings. |
| `npm.cmd test` sin conexiones | exit 0; 20 pasados y 64 omitidos; 6 suites pasadas y 7 omitidas; 13.30 s. Esto NO certifica integración. |
| `npm.cmd run test:coverage` con PostgreSQL/roles restringidos | exit 0; 84/84 tests, 13/13 suites, 0 omitidos; 71.06 s. Ejecuta la misma batería de test con cobertura adicional. |
| Cobertura global | líneas 98.14%, ramas 94.71%, statements 97.06%, funciones 97.59%. Inventario servidor/repositorio está incluido. |
| Cobertura dominio | líneas y ramas 100%; umbral configurado ≥90% en ambas. |
| Concurrencia incluida en batería final | 20/20 rondas ×20 ventas; cada ronda: 5 unidades registradas, 15 intakes, 20 salidas, saldo 0 y reconciliación exacta. Archivo completo: 22/22 tests, 42.596 s, incluyendo duplicados y reservas/liberaciones concurrentes. |
| `npm.cmd run test:concurrency` SIN entorno, prueba negativa del comando | exit 1 esperado; evita que una batería omitida se declare aprobada. La batería positiva ya se ejecutó bajo coverage; no se repitió innecesariamente con el wrapper. |
| `npm.cmd run test:ledger` tras integración y E2E | exit 0; 0 divergencias globales; RLS 24/24 tablas con tenantId habilitado y forzado. |
| Aislamiento por tabla | 24/24 tablas recorridas con datos propios y ajenos; 0 lecturas cruzadas; mutaciones ajenas sin efecto o denegadas e inserciones ajenas rechazadas por RLS/permisos. |
| `npx.cmd prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` | exit 0; 0 diferencias entre esquema y base final. |
| `npm.cmd run build` sin URLs ni secreto | exit 0; compilación 2.0 s; TypeScript 11.7 s; 6/6 páginas generadas; sin ZodErrors. |
| `npm.cmd run test:e2e` | exit 0; 5/5 tests Chromium, 0 omitidos; 17.4 s. Incluye login real, insuficiencia de rol, 404 de sucursal ajena/inexistente, creación de usuario, login del creado y logout. |
| `npm.cmd audit --audit-level=high` | exit 0; 0 vulnerabilidades reportadas. |
| `git diff --check` | exit 0; 0 errores de whitespace. Avisos de normalización LF/CRLF del entorno, sin cambios de configuración Git. |

## Archivos creados

- `src/domain/inventory.ts`.
- `src/server/repositories/client.ts`, `inventory.ts`, `identity.ts`, `catalog.ts`, `audit.ts`.
- Migraciones nuevas `20261026182000_inventory_review_status`, `20261026182100_inventory_runtime_boundary`, `20261026183000_identity_tenant_rls`, `20261026184500_intake_movement_trace`, `20261026185000_credential_account_identity`, `20261026190000_runtime_least_privilege`.
- `scripts/provision-gate-db.mjs`, `scripts/run-concurrency.mjs`, `scripts/check-ledger.mjs`.
- `tests/boundaries.test.ts`, `tests/config.test.ts`, `tests/inventory-domain.test.ts`.
- `tests/integration/fixtures.ts`, `hardening-reproduction.test.ts`, `inventory-hardening.test.ts`, `identity-repositories.test.ts`, `catalog-regressions.test.ts`, `rls-boundaries.test.ts`.
- `tests/e2e/identity-security.spec.ts`.
- `docs/inventory-gates.md` y este informe.

## Archivos modificados o trasladados

- `src/domain/actor.ts` y `src/server/repositories/tenant-context.ts` (existían sin trackear al iniciar).
- `src/server/inventory.ts`; `src/server/catalog.ts` y `src/server/audit.ts` quedan como interfaces hacia repositorios.
- `src/server/db.ts` trasladado/reemplazado por el cliente diferido en repositorios; se actualizaron sus consumidores.
- `src/auth/config.ts`, `session.ts`, `authorization.ts`; `src/config/env.ts`.
- `app/api/admin/users/route.ts`, `app/api/auth/[...all]/route.ts`.
- `prisma/schema.prisma`, `prisma.config.ts`, `eslint.config.mjs`, `vitest.config.ts`, `playwright.config.ts`.
- `tests/integration/epic2-concurrency.test.ts`, `tests/integration/tenant-isolation.test.ts`.
- `package.json`, `package-lock.json`: fast-check directo para propiedades decimales/EAN; scripts de gate. Se preservó decimal.js agregado previamente.
- `.env.example`, `.github/workflows/ci.yml`, `ARCHITECTURE.md`, `ROADMAP.md`, `.github/web-dev-loop/reports/epica-2-dev.md`.
- `next-env.d.ts` ya estaba modificado y Next lo regenera al alternar dev/build; no se revirtió trabajo previo.

No se editaron las migraciones recibidas, DOMAIN_RULES, DECISIONS ni el reusable. AGENTS, briefs y otros cambios previos se preservaron.

## No ejecutado / límites de la evidencia

- CI remoto no ejecutado: resultados locales, sin commit/push.
- No se ejecutaron flujos exitosos de aprobación step-up ni sesión de caja real: no están implementados; las protecciones correspondientes fallan cerradas.
- No hay test positivo de tope monetario por sesión ni alerta de antigüedad implementada.
- No se efectuó un benchmark de capacidad ni auditoría OWASP exhaustiva de toda la aplicación. La revisión adversarial de esta ola fue de alcance backend/seguridad indicado en el brief; los resultados no equivalen a certificar producción.
- No se hizo npm ci ni un clon limpio adicional: dependencias instaladas del workspace, herramientas sin variables verificadas y migración de base vacía sí ejecutadas.

## Desvíos, SUPUESTO y decisiones requeridas

1. **SUPUESTO conservador de presupuesto:** sin entidad de sesión de caja, el tope de cantidad se acumula por usuario sin reinicio automático; una sesión autenticada se registra para trazabilidad. Esto impide eludirlo cambiando sessionId, pero no implementa el ciclo de caja. Requiere decidir el alcance mínimo que se adelanta de Épica 3.
2. **Aprobaciones:** REQUIRE_SUPERVISOR y venta de vencidos se bloquean incluso con rol alto. Para habilitarlas debe implementarse el PIN/token de un uso, TTL y auditoría de dos actores de DOMAIN_RULES §7; no se sustituyó por un booleano.
3. **Topes de valor/alertas:** faltan política monetaria/configuración y alerta de casos pendientes (default 7 días). No se declara que los topes de cantidad aprobados reemplacen esos criterios.
4. **Compatibilidad interna:** los nombres de servicios se mantienen, pero las firmas pasan a `(Actor, input, clock?)`, las claves son obligatorias y el resultado idempotente es `{id,type,total?}`. No existía endpoint HTTP de inventario ni consumidores de aplicación fuera de los tests revisados. Este cambio interno se documenta; no se introduce una ruta POS anticipadamente.
5. **Legacy:** comandos sin hash y casos antiguos sin contexto de venta/línea/sesión requieren regularización explícita; no se inventa contexto ni se reejecutan. Ubicaciones sin sucursal asignada no se autorizan de manera implícita.
6. **Serialización por tenant:** prioriza corrección de topes y deduplicación. La decisión aprobada de UPDATE condicional se mantiene; se requiere medir contención antes de afirmar capacidad multi-caja de producción.

## Key Learnings:

1. En Prisma 7 adapter-pg, SQLSTATE puede estar en `meta.driverAdapterError.cause.originalCode`; mirar solo P2034/meta.code deja reintentos sin ejecutar.
2. Un build con exit 0 puede emitir errores asíncronos de inicialización. Diferir únicamente Prisma no alcanza si Better Auth se crea al importar el módulo.
3. Un test de 20 operaciones no prueba 20 rondas, y tests omitidos por falta de entorno no son evidencia de integración.
