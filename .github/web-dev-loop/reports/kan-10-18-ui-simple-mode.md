# Informe — KAN-10 a KAN-18 (bugs de UI + modo simple para kiosco)

Fecha: 2026-11-12
Estado: ENTREGADO (con un alcance pendiente declarado en la sección final).

## Archivos creados o modificados

Correcciones de interfaz:

- `components/operational-read/operational-read.module.css` — barra de filtros en
  `flex-wrap` en lugar de grilla fija de 6 columnas; botones primarios y enlaces
  con `var(--color-primary-hover, #0369a1)`.
- `app/admin/promotions/promotion-manager.module.css` — botones y foco al token
  primario (eran `#2563eb` / `--color-primary`).
- `src/client/sign-out.ts` (nuevo) — POST con JSON y resultado sin excepciones.
- `components/admin-shell.tsx` — cierre de sesión con manejo de error visible.
- `tests/sign-out.test.ts`, `tests/design-tokens.test.ts`,
  `tests/e2e/filters-layout.spec.ts` (nuevos).

Modo simple:

- `prisma/schema.prisma` + `prisma/migrations/20261112120000_tenant_operational_mode`
  — `Tenant.operationalMode` (`SIMPLE` | `MULTI`), default `MULTI`.
- `prisma/migrations/20261112130000_branch_creation_grants` y
  `20261112130100_tenant_mode_updated_at_grant` — `INSERT` en `Branch` y
  `UPDATE` de columna en `Tenant` para el rol de aplicación.
- `src/domain/operational-mode.ts` (nuevo) — topología y error tipado.
- `src/server/repositories/context.ts` — el contexto operativo informa el modo.
- `src/server/repositories/cash.ts` + `app/api/pos/context/route.ts` — resolución
  de sucursal/caja/ubicación en modo simple.
- `src/server/repositories/branches.ts`, `src/server/branches.ts`,
  `app/api/admin/branches/route.ts` — alta de sucursal con transición a `MULTI`.
- `components/branches/create-branch-button.tsx` y su CSS (nuevos).
- `components/admin-navigation.ts`, `components/admin-shell.tsx` — navegación
  sin Transferencias ni Cajas en modo simple.
- `components/operational-read/operational-read.tsx` — filtro Sucursal oculto en
  modo simple.
- `scripts/provision-kiosco.mjs` (nuevo) — alta completa en un paso.
- `tests/operational-mode.test.ts`, `tests/integration/simple-pos-context.test.ts`,
  `tests/integration/provision-kiosco.test.ts`,
  `tests/integration/create-branch.test.ts` (nuevos).
- `tests/context.test.ts`, `tests/api/admin-context.test.ts`,
  `tests/admin-shell.test.ts` — ajustes por el nuevo campo y casos de modo.

## Comandos ejecutados y resultados

| Comando | Resultado |
|---|---|
| `npm run typecheck` | 0 errores |
| `npm run lint` | 0 errores, 0 warnings |
| `npm test` | **457/457** (76/76 archivos) |
| `npm run test:e2e` | **62/62** (incluye los 3 nuevos de layout) |
| `npm run build` | `✓ Compiled successfully in 7.7s` |
| `npm run db:migrate` (gate y test) | 2 migraciones nuevas aplicadas |
| Ledger | 0 divergencias (seed local, 38 niveles / 52 movimientos) |

Verificación en navegador (browse, Chrome real):

- `/api/auth/sign-out` → **200**; `/api/admin/context` → **401**; `/admin` → 307.
- Filtros en Ventas, Historial de cajas e Inventario: **0 solapamientos** en
  320, 768, 1024, 1440 y 2560 px (15 combinaciones medidas).
- Botón de acción de filtros: `rgb(3, 105, 161)` = `#0369a1`, igual a "Registrar
  compra".
- Tenant SIMPLE: navegación sin Transferencias ni Cajas, filtro Sucursal ausente,
  `/api/pos/context` → **200** con `registerId`, `locationId`, `sessionOpen`.
- Botón "Crear sucursal" visible y modal con aviso de cambio de modo.

## Desvíos respecto del brief

- **Alta de negocio fuera de la interfaz.** El rol de aplicación tiene revocado
  `INSERT` en `Tenant`/`Store`/`Branch`/`CashRegister` desde el hardening de
  Épica 2. Por eso el alta de un kiosco es un script privilegiado
  (`scripts/provision-kiosco.mjs`, usa `MIGRATION_DATABASE_URL`) y no un
  formulario público. Se evitó abrir un endpoint sin decisión de seguridad.
- **Permisos acotados para el botón de sucursal.** Para que "Crear sucursal"
  funcione desde la aplicación se agregó una migración que concede sólo
  `INSERT` en `Branch` y `UPDATE` de `operationalMode`/`updatedAt` en `Tenant`.
  Ambas tablas siguen protegidas por RLS (`tenantId = app_tenant()`); crear
  tenants sigue siendo privilegiado.

## SUPUESTO

- SIMPLE = 1 sucursal + 1 caja fija (definido por el dueño).
- No hay autoregistro de negocios: la provisión la ejecuta quien despliega.
- Al crear una sucursal el sistema pasa a MULTI sin volver atrás automáticamente.

## Decisiones requeridas

1. Aprobar formalmente los grants nuevos (tabla `Branch`, columna
   `operationalMode`) o reemplazarlos por un servicio de provisión separado.
2. Definir si el alta de negocio debe ser autoservicio desde la web; hoy está
   fuera de alcance por seguridad.

## Pendiente declarado

- **E2E de recorrido completo en modo simple** (alta → abrir caja → vender →
  cerrar en navegador). El modo simple está cubierto por tests de integración
  (resolución de contexto, provisión, transición) y por verificación manual con
  browse, pero no por un `spec.ts` de recorrido completo.
- Los tres archivos de test que ya estaban modificados en el árbol antes de este
  trabajo (`tests/css-module-classes.test.ts`,
  `tests/integration/supervisor-closure.test.ts`) se dejaron sin commitear.
