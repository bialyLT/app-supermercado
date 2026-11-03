# Brief — Completitud operativa, Ola 3: ajustes, recepciones e intake

**Repo:** `C:\Users\Usuario\Documents\trabajos\supermercado` · **Base:**
`903da2e` · **Árbol:** congelar antes de implementar · **Único escritor:** sí

## Objetivo y alcance

Exponer contratos administrativos seguros para las capacidades de inventario
que ya existen en el dominio/repositorios y que fueron identificadas como
bloqueadas en la Ola 0:

- recepción de inventario;
- ajustes autorizados;
- alertas de inventario;
- bandeja y resolución de `UNVERIFIED_INTAKE`.

La ola puede incluir una pantalla mínima sólo si el contrato queda verificado
en la misma entrega. La prioridad es cerrar contratos server-side sin inventar
semántica ni permitir mutaciones no auditadas.

Puede tocar:

- `app/api/admin/inventory/**`
- `app/admin/inventory/**`
- `components/**`
- `src/server/**`
- `src/domain/**` sólo guards, contratos o validaciones necesarias
- `tests/**`
- `.github/web-dev-loop/reports/`
- `odd/tasks/` para briefs derivados

No puede tocar:

- `prisma/schema.prisma`
- `prisma/migrations/`
- `DOMAIN_RULES.md`
- `DECISIONS.md`
- `REUSABLE_RETAIL_SYSTEM_CONTEXT.md`
- roles nuevos o permisos implícitos
- semántica de ledger, stock, intake, caja u offline
- producción, despliegue o proveedores

Migraciones: no. Si una capacidad no puede exponerse sin migración o sin
contrato de dominio verificable, debe quedar `BLOQUEADA` y documentada.

## Contratos objetivo

Los nombres son objetivos de la ola y deben confirmarse contra los servicios
existentes antes de implementarse:

- `GET /api/admin/inventory/receipts`
- `POST /api/admin/inventory/receipts`
- `POST /api/admin/inventory/adjustments`
- `GET /api/admin/inventory/alerts`
- `GET /api/admin/inventory/intakes`
- `GET /api/admin/inventory/intakes/:id`
- `POST /api/admin/inventory/intakes/:id/review`

No se debe crear un endpoint sólo porque aparece en esta lista. Si el contrato
interno no permite cumplir invariantes, registrar el bloqueo y no implementarlo.

## Invariantes y autorización

1. El actor, tenant, sucursal y permisos se derivan de la sesión; nunca del
   body/query como autoridad.
2. Todo ajuste y recepción valida variante, ubicación, lote, cantidad Decimal,
   precisión de unidad y motivo server-side.
3. Los movimientos se crean append-only y el `InventoryLevel` se actualiza en
   la misma transacción; no se permite UPDATE/DELETE del ledger.
4. Stock no puede ser negativo; la operación debe respetar actualización
   atómica, orden de locks e idempotencia existente.
5. Ajustes y revisiones administrativas son sólo online.
6. Toda mutación usa command/idempotency key; repetir cinco veces con el mismo
   payload produce un solo efecto y otro payload produce 409.
7. `UNVERIFIED_INTAKE` respeta
   `PENDING_REVIEW → CONFIRMED | CORRECTED | REJECTED`, separación de funciones,
   motivo, `case_id`, auditoría y caso resuelto inmutable.
8. El creador del intake no puede revisarlo; recurso de otra sucursal/tenant
   responde como inexistente.
9. Todo permiso tiene denegación probada para sesión ausente, rol insuficiente
   y tenant/sucursal ajena.
10. Ninguna ruta devuelve secretos, datos innecesarios o errores que revelen
    existencia de recursos fuera de scope.

## Pruebas RED/GREEN obligatorias

- cantidad fraccionaria para variante discreta;
- cantidad cero, negativa, excesiva y Decimal inválido;
- variante, lote o ubicación inactiva/inexistente;
- sucursal ajena y tenant ajeno;
- doble submit con misma y distinta idempotency key;
- concurrencia de ajustes/recepciones sobre el mismo level;
- intento de UPDATE/DELETE del ledger con rol de aplicación;
- revisión por el mismo usuario que creó el intake;
- revisión de caso resuelto;
- decisión inválida o motivo ausente;
- alertas vencidas y límites configurables;
- replay offline rechazado para ajustes/revisiones;
- payload malformado y errores 400/401/403/404/409.

## Entregables

- contratos HTTP sólo donde el dominio existente los respalde;
- pruebas de integración contra PostgreSQL real para mutaciones;
- tests de aislamiento, idempotencia, append-only y concurrencia;
- pantalla administrativa sólo para contratos entregados;
- `.github/web-dev-loop/reports/operational-ui-completeness-wave3.md`;
- respuesta final `ENTREGADO:` o `BLOQUEADO:`.

## Gates

Además de los gates de `GATES.md`, ejecutar:

| Gate | Comando | Resultado esperado |
|---|---|---|
| Tests focalizados | `npm.cmd test -- tests/integration tests/api` | 0 fallos; informar pasados/total |
| Typecheck | `npm.cmd run typecheck` | exit 0 |
| Lint | `npm.cmd run lint` | 0 errores y 0 warnings nuevos |
| Ledger | `npm.cmd run test:ledger` | 0 divergencias |
| Concurrencia | `npm.cmd run test:concurrency` | ≥20 rondas sin fallo |
| Build | `npm.cmd run build` | exit 0 |
| E2E | `npm.cmd run test:e2e` | 0 fallos; informar omitidos |
| Higiene | `git diff --check` | sin salida |

No hacer commit, push ni reset destructivo durante la ronda. El orquestador
commitea sólo después del gate y del informe numérico.

## Bloqueos esperados

Si recepción, ajustes, alertas o intake requieren una migración, un permiso
nuevo o una decisión de negocio no aprobada, detener esa parte y reportar:

`BLOQUEADO: <contrato> — <invariante o decisión faltante>.`

No reemplazar el bloqueo con endpoints de prueba, defaults permisivos ni
mutaciones directas desde componentes.
