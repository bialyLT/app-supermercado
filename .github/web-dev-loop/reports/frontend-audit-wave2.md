# Informe Frontend Audit Wave 2

**Estado: ENTREGADO:** los hallazgos funcionales y los gates técnicos de la
ola quedaron corregidos y verificados con PostgreSQL local.

## Alcance entregado

- Agregado `src/client/api-fetch.ts` como helper compartido para errores HTTP,
  red, 401/403/409/422 y expiración de sesión.
- `AdminShell` escucha expiración de sesión, limpia la sesión visible mediante
  navegación al acceso y no inventa un rol administrativo.
- Compras, transferencias y reportes usan el helper compartido y conservan
  datos del formulario ante error.
- La cola POS publica pendientes, procesando, completados, conflictos y errores
  recuperables; los completados permanecen en IndexedDB/historial.
- El replay usa `apiFetch`, conserva `x-idempotency-key`, trata 401 como sesión
  vencida sin borrar el comando y clasifica la red como error recuperable.
- Tests RED/GREEN para replay compartido, 401, red recuperable y mapeo seguro.

## Archivos creados o modificados por esta ola

- `src/client/api-fetch.ts`
- `src/pos/offline-queue.ts`
- `app/pos/page.tsx`
- `components/admin-shell.tsx`
- `components/purchases/purchase-manager.tsx`
- `components/reports/reports-manager.tsx`
- `components/transfers/transfer-manager.tsx`
- `tests/api-fetch.test.ts`
- `tests/offline-queue.test.ts`

Cambios de esta continuación:

- `src/pos/offline-queue.ts`
- `app/pos/page.tsx`
- `tests/offline-queue.test.ts`
- `tests/api-fetch.test.ts`
- `.github/web-dev-loop/reports/frontend-audit-wave2.md`

No se tocaron `prisma/schema.prisma`, `prisma/migrations/` ni
`REUSABLE_RETAIL_SYSTEM_CONTEXT.md`.

## Gates ejecutados

| Gate | Resultado |
|---|---|
| RED antes del arreglo | **2 fallos/10**, `replayOfflineCommand is not a function` en los dos casos nuevos |
| GREEN focalizado | **10/10**, 2 archivos, 0 fallos |
| Tests completos | **367/367 passed**, 58 archivos pasaron |
| Lint | **exit 0**, sin errores ni warnings |
| Typecheck | **exit 0**, 0 errores |
| Build | **exit 0**, 20 páginas generadas |
| Cobertura con PostgreSQL | **exit 0**: 92.41% líneas, 88.07% statements, 82% ramas, 86.75% funciones |
| `git diff --check` | **exit 0**, sin salida |
| E2E | **8 passed, 28 skipped, 0 failed**; servidor temporal en 3109 |
| Ledger/RLS | **0 divergencias; RLS 43/43 tablas habilitado y forzado** |

## Invariantes y seguridad

- La autoridad de tenant, permisos, totales y stock sigue en el servidor.
- Los retries de POS reutilizan el comando persistido y su idempotency key.
- Los comandos offline no se eliminan frente a conflicto, 401, error o
  desconexión; los confirmados quedan visibles como completados.
- Los mensajes de API no exponen SQL, stack traces, secretos ni payloads.
- No se agregó `unsafe-inline`, dependencia, secreto ni dato personal.

## Desvíos y decisiones requeridas

`SUPUESTO:` ante 401 la shell navega al acceso a través del evento compartido;
el comando/formulario no se limpia antes de la navegación y la cola offline
queda persistida en IndexedDB.

Queda como decisión técnica posterior si el producto necesita un mecanismo de
restauración de formularios después de volver del login; no se inventó
persistencia adicional en esta ola.

**Reproducción funcional:** antes del arreglo el replay hacía `fetch` directo,
no enviaba la idempotency key, y ante cualquier error trataba el comando como
rechazo genérico; además borraba los completados. El checkout sólo encolaba
`TypeError`, pero `apiFetch` convierte la desconexión a `ApiError(status=0)`.
Después, `replayOfflineCommand` centraliza la llamada y clasificación, el
checkout encola `ApiError(status=0)`, y la UI muestra `Completados`.

**Desvío:** 28 escenarios E2E quedaron omitidos por guards del suite; no se
levantó producción ni se hizo deploy.

ENTREGADO: los tres hallazgos funcionales corregidos, con RED/GREEN y gates
técnicos verificados.

## Continuación DB Wave 2

**Hallazgo 1 (alta):** `/api/pos/products` extraía `commandId` pero la creación
de catálogo no registraba `IdempotencyCommand`. Se agregó el camino
`createCatalogItemCommand`, que reutiliza `command` y deriva el tenant del actor.
El replay idéntico devuelve el resultado persistido; un hash distinto devuelve
`409 IDEMPOTENCY_CONFLICT`.

**Hallazgo 2 (media):** `recordSyncConflict` intentaba siempre `create` y un
replay idéntico terminaba en `P2002`. Ahora busca por `(tenant, commandId)`,
compara hash de kind/payload/entity y devuelve el conflicto existente; un
payload distinto devuelve `IDEMPOTENCY_CONFLICT`.

### Verificación de esta continuación

| Gate | Resultado |
|---|---|
| Pruebas de reproducción focalizadas | **27/27 pasaron** con PostgreSQL gate |
| Lint | **exit 0**, sin errores ni warnings |
| Typecheck | **exit 0**, 0 errores |
| Prisma validate | **exit 0**, schema válido; sin cambios de schema/migrations |
| `git diff --check` | **exit 0**, sin salida |

No se tocaron `prisma/schema.prisma` ni `prisma/migrations`, no se agregaron
dependencias y los cambios fueron commiteados en `5bd4adc`.

### Verificación posterior con PostgreSQL local

| Gate | Resultado |
|---|---|
| `npm.cmd run test:ledger` | **OK**: 0 divergencias; RLS 43/43 tablas habilitado y forzado |
| `npm.cmd run test:concurrency` | **OK**: 22/22 tests |
| Integración focalizada (`inventory-hardening`, `sync-conflicts`) | **OK**: 27/27 tests |
| `npm.cmd run test:coverage` con PostgreSQL | **OK**: 367/367 tests; 92.41% líneas |
| `npm.cmd run test:e2e` | **OK**: 8/8 ejecutados pasaron; 28 omitidos por guards |

El diagnóstico de Prisma quedó corregido consultando la relación de categoría
existente; no se modificaron schema ni migraciones.

La reproducción RED quedó agregada antes del arreglo, pero el runner no pudo
ejecutarla contra PostgreSQL (los 27 tests de ambos archivos quedaron skipped);
por eso no se declara GREEN de integración en este entorno.

## Corrección del bloqueo de Prisma

La inspección confirmó que el schema y la migración promocional existente sí
declaran `Product.categoryId` y la relación compuesta `Product.category` hacia
`ProductCategory`; no se agregó ninguna columna ni se editaron migraciones.
La causa reproducida era un cliente Prisma generado desactualizado, que
diagnosticaba que `Product.categoryId` no existía. Se regeneró el cliente y se
ajustó `stockAccess` para consultar la relación existente
`Product.category { id }`, derivando el `categoryId` desde `category?.id` para
que el flujo de promociones siga siendo nullable y server-side.

### Verificación de la corrección

| Gate | Resultado |
|---|---|
| `npm.cmd run db:generate` | **exit 0**, Prisma Client 7.10.1 generado en 1.43 s |
| `npm.cmd run db:validate` | **exit 0**, schema válido |
| `npm.cmd run typecheck` | **exit 0**, 0 errores |
| `npm.cmd run lint` | **exit 0**, 0 errores/warnings |
| `npm.cmd test` | **206/206 passed**, 161 skipped sin variables de integración |
| `npm.cmd run build` | **exit 0**, compilación y generación de 20 páginas |
| Integración `promotions-checkout` | **OK** con PostgreSQL gate; incluida en 367/367 |
| `npm.cmd run test:concurrency` | **OK**: 22/22 |
| `npm.cmd run test:ledger` | **OK**: 0 divergencias; RLS 43/43 |
| `git diff --check` | **exit 0**, sin salida |

Archivos modificados: `src/server/repositories/inventory.ts` y este informe.
No se tocaron `prisma/schema.prisma`, `prisma/migrations/` ni
`REUSABLE_RETAIL_SYSTEM_CONTEXT.md`; no se hizo commit ni push.
