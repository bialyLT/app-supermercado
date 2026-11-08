# Informe — Completitud de la interfaz operativa, Ola 1

Estado: ENTREGADO: contratos read-only server-scoped publicados y verificados.

## Alcance entregado

- Convención de permisos normalizada a `recurso.acción`; las llamadas legacy
  `recurso:acción` se aceptan como alias para preservar comportamiento.
- `GET /api/admin/inventory/levels`
- `GET /api/admin/inventory/movements`
- `GET /api/admin/sales` y `GET /api/admin/sales/:id`
- `GET /api/admin/cash-shifts/history`
- Todos los contratos derivan tenant y sucursales del actor autenticado,
  verifican permisos server-side dentro de la transacción con RLS y exponen
  importes/cantidades Decimal como strings. Los movimientos permanecen
  append-only y las consultas son read-only.

## Archivos creados/modificados

- `src/domain/actor.ts`
- `src/auth/authorization.ts`
- `src/domain/authorization.ts`
- `src/server/repositories/inventory.ts`
- `src/server/repositories/operational-read.ts`
- `src/server/operational-read.ts`
- `app/api/admin/inventory/levels/route.ts`
- `app/api/admin/inventory/movements/route.ts`
- `app/api/admin/sales/route.ts`
- `app/api/admin/sales/[id]/route.ts`
- `app/api/admin/cash-shifts/history/route.ts`
- `tests/api/operational-read-contracts.test.ts`

No se modificaron migraciones ni el esquema Prisma.

## Gates con resultado numérico

- Tests enfocados: **4/4 pasaron**, 0 fallos, 2.52 s.
- Regresión auth/context/contratos: **12/12 pasaron** en 3 archivos, 2.77 s.
- Typecheck (`npm.cmd run typecheck`): **0 errores**, exit 0.
- Lint (`npm.cmd run lint`): **0 errores, 0 warnings**, exit 0.
- Cobertura, build, E2E y base PostgreSQL: **NO EJECUTADOS**; no son necesarios
  para este corte enfocado y requieren un gate posterior.

## BLOQUEADO

- Ajustes de inventario, revisión de `UNVERIFIED_INTAKE` y alertas no se
  exponen: no existe un contrato administrativo seguro completo para esas
  capacidades en esta ola. No se inventaron semánticas ni endpoints.
- No se agregó paginación por cursor; el contrato usa límite explícito máximo
  de 100 para mantener el corte mínimo.

SUPUESTO: la precedencia de roles aprobada se mantiene y `ADMIN` conserva el
alcance tenant-wide únicamente cuando su identidad no tiene sucursales
asignadas; no se creó ningún rol nuevo.

Decisiones requeridas: ninguna para los contratos entregados; la revisión de
intake/ajustes requiere un brief posterior con idempotencia y auditoría.
