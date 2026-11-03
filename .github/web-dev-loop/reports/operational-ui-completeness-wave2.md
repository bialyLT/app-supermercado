# Informe — Completitud de la interfaz operativa, Ola 2

Estado: ENTREGADO: remediación Ola 2 implementada sin commit ni push.

## Alcance de esta remediación

- Ventas fuera de sucursal o con `branchId` nulo: 404 indistinguible para no
  ADMIN; branch no autorizado en colecciones: 404.
- Rangos invertidos rechazados por `operationalReadQuerySchema` (400).
- Historial de caja limitado a 100 movimientos por turno; importes nulos se
  muestran como `No disponible`.
- Filtros de ventas preservados al entrar al detalle y volver; detalle con
  retry y validación Zod de respuestas.
- Fechas `datetime-local` convertidas mediante `parseDateTimeLocal`, con
  validación de fechas imposibles sin `RangeError`.
- Breadcrumb `/admin/cash-shifts/history` conserva el comportamiento esperado
  de dos niveles.

## RED/GREEN

- RED focalizado: **2 fallos/3 suites** (404 de branch devolvía 400); además
  fallaba el caso de rango invertido y el caso de importe nulo antes de los
  cambios.
- GREEN focalizado: **16/16 tests**, 2 archivos, 0 fallos, 3.11 s (más las
  regresiones de shell/caja: 29/29).
- Incluye casos de venta null-branch/out-of-branch/in-scope, 404 de branch no
  autorizado, rango invertido, breadcrumb y monto nulo.

## Gates ejecutados

- Typecheck: **exit 0**, 0 errores.
- Lint: **exit 0**, 0 errores y 0 warnings.
- Build: **exit 0**, 24/24 páginas generadas.
- `git diff --check`: **exit 0**, sin salida.
- Suite completa posterior a la corrección: **224/385 tests pasaron, 161
  skipped, 0 fallos**, 37 archivos pasaron y 24 quedaron skipped.
- E2E: **NO EJECUTADO**; Playwright no pudo iniciar porque ya había un servidor
  Next en `127.0.0.1:3000` (PID 11740).
- Cobertura, PostgreSQL, auditoría de dependencias y concurrencia:
  **NO EJECUTADOS** en esta ronda.

## Archivos modificados

- `app/api/admin/{sales,sales/[id],cash-shifts/history,inventory/levels,inventory/movements}/route.ts`
- `src/server/operational-read.ts`
- `src/server/repositories/operational-read.ts`
- `src/client/presentation.ts`
- `components/operational-read/operational-read.tsx`
- `components/admin-navigation.ts`
- `tests/api/operational-read-contracts.test.ts`
- `tests/operational-ui.test.ts`

No se tocaron roles, schema, migraciones, secretos ni estilos inline.

SUPUESTO: la etiqueta `No disponible` es la representación de presentación
aprobada para importes de caja ausentes; no altera el payload autoritativo.

Decisiones requeridas: ninguna.

Estado de cierre: BLOQUEADO: el gate E2E quedó bloqueado por servidor Next
activo en el entorno; el resto de gates ejecutados está verde.
