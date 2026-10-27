# Arquitectura

Reglas vinculantes en `DOMAIN_RULES.md`; decisiones en `DECISIONS.md`.

## Forma del sistema

Modular monolith con límites de dominio explícitos:

1. **Identity:** usuarios, roles, sesiones y autorización.
2. **Catalog:** productos, variantes, códigos, unidades y atributos.
3. **Pricing:** listas de precios con versión, vigencias y reglas.
4. **Inventory:** ubicaciones, lotes, vencimientos, reservas, movimientos y
   casos de regularización.
5. **Sales:** tickets, líneas, impuestos, descuentos, anulaciones y
   devoluciones.
6. **Cash:** cajas, sesiones, movimientos, pagos y arqueos.
7. **Audit:** eventos sensibles, actor, terminal y valores anteriores/nuevos.
8. **Sync:** comandos offline, idempotencia, reintentos y conflictos.

Hoy existe **una superficie**: la app operativa (POS y administración). Una
superficie pública para clientes queda fuera de alcance (D-013).

## Capas y dependencias

```text
interface   (route handlers /api/v1, páginas, componentes)
   ↓
application (casos de uso: reciben Actor + input validado con Zod)
   ↓
domain      (reglas puras: dinero, impuestos, stock, estados; sin I/O)
   ↑
infrastructure (repositorios Prisma, Better Auth, reloj, ids)
```

- `domain` no importa nada de `infrastructure` ni de Next.js.
- Cada módulo expone una interfaz pública; un módulo no lee tablas de otro.
  Se impone con `eslint-plugin-boundaries` o `dependency-cruiser` en CI.
- Prisma solo se importa dentro de repositorios.

## Modelo de datos

```text
tenant
  └── store (entidad fiscal, D-006)
        ├── branch
        │     ├── location (depósito/zona)
        │     ├── cash_register
        │     └── user_assignment
        └── product / product_variant / barcode

location + product_variant (+ lote)
  └── inventory_level (on_hand, reserved; materializado)
        └── inventory_movement (append-only, quantity_delta con signo)

inventory_movement ── unverified_intake_case (estado de revisión)

cash_register + user
  └── cash_register_session
        ├── cash_movement
        └── sale
              ├── sale_line (snapshot de precio/impuesto/unidad/costo)
              └── payment

price_list ── price_list_version ── product_price
idempotency_command (tenant_id, command_id, payload_hash, resultado)
device (terminal registrada)
audit_log (append-only)
```

Todas las tablas operativas llevan `tenant_id`, y `store_id`/`branch_id` cuando
corresponde. Identificadores UUID. Importes y cantidades `Decimal`; los
importes viajan como string con moneda en contratos externos.

## Invariantes

- Un código de barras activo identifica una variante dentro del tenant.
- Una venta confirmada no se edita: se corrige con devolución, anulación
  autorizada o documento compensatorio.
- Un movimiento de inventario no se actualiza ni elimina; se impone en base.
- `on_hand >= 0` y `reserved <= on_hand` como CHECK de base.
- `level.on_hand` es igual a la suma de sus movimientos (verificable).
- Una caja tiene a lo sumo una sesión abierta (índice único parcial).
- Una sesión cerrada no recibe movimientos normales.
- Una operación sensible exige permiso explícito y genera `audit_log`.
- Todo comando offline tiene clave idempotente única por tenant.
- Ninguna consulta operativa cruza tenants.

## Perfil tributario inicial

`src/domain/fiscal.ts` valida el perfil argentino y el snapshot versionado sin
I/O. `src/server/fiscal.ts` expone configuración por Store y consulta por
sucursal asignada; su repositorio reutiliza transacción, permisos y auditoría.
`FiscalProfile` tiene RLS y FK compuesta tenant/store; no amplía privilegios de
escritura de Store. La venta configurada conserva `fiscalSnapshot` del servidor
en la misma transacción, protegido por triggers. Legacy sin perfil queda sin
snapshot. No se agrega emisión fiscal, IVA ni lógica tributaria en caja/pagos.
Contrato y límites: `docs/fiscal-profiles.md`.

## Concurrencia (decidido, D-005)

Venta y movimientos de stock corren en una transacción. El descuento usa
actualización condicional atómica sobre `inventory_level` más inserción del
movimiento; varios levels se bloquean en orden determinista; deadlocks o
fallos de serialización se reintentan con la misma clave. Las pruebas de carga
**validan** este diseño y miden contención; no lo eligen.

En el hardening actual, las escrituras también toman un advisory lock por tenant
para serializar presupuestos de intake e idempotencia. Es una opción conservadora
de corrección, no una validación de capacidad de supermercado. Las pruebas
reproducibles y límites pendientes están en `docs/inventory-gates.md`.

## Offline

El cliente guarda **comandos**, no autoridad de stock. Una venta offline es un
hecho consumado: el servidor la valida estructuralmente, la deduplica y la
acepta, marcando para revisión cualquier diferencia de stock o precio
(`DOMAIN_RULES.md` §6). Los comandos del POS son endpoints REST versionados.
Sin `localStorage` como almacén de verdad: IndexedDB con esquema versionado.

Si el stock administrativo está atrasado pero el producto físico está en caja,
la venta crea un `UNVERIFIED_INTAKE` atómico y auditado, sujeto a la política
y los topes del tenant; la regularización queda pendiente de revisión por una
persona distinta.

## Seguridad

- Better Auth; la sesión es la fuente server-side de identidad y tenant.
- Cookies HttpOnly, Secure en producción, SameSite apropiado.
- CSRF, headers seguros, CSP y rate limiting.
- Zod en entradas de API, formularios y configuración.
- RBAC en servidor + RLS de PostgreSQL con tenant por transacción (D-004).
- Rol de base de datos de aplicación separado del de migraciones, sin
  UPDATE/DELETE sobre ledger y audit.
- Override de supervisor con token de un solo uso (D-012).
- Sin secretos en repositorio, fixtures, logs ni documentación.

La implementación separa `DATABASE_URL` (grupo `supermercado_app`),
`AUTH_DATABASE_URL` (bootstrap de Better Auth, grupo `supermercado_auth`) y
`MIGRATION_DATABASE_URL` (propietario del esquema). Los grupos runtime son
NOLOGIN; sus LOGIN se provisionan fuera de migraciones. El contexto de tenant es
local a cada transacción; inventario rechaza conexiones privilegiadas o propietarias.
La autenticación se inicializa al atender requests, de modo que el build no
requiere conexiones ni secreto; runtime de producción exige un secreto explícito.

El cierre de inventario incorpora sesiones mínimas persistidas de caja,
presupuesto real de intake por turno y aprobaciones de supervisor de un uso.
Moneda y tope monetario son configuración obligatoria por tenant (D-015).
Los PIN se almacenan con scrypt; intentos y bloqueo son persistidos. Los tokens
opacos duran 90 s y se consumen junto con la venta, ligados al solicitante,
sesión de caja y comando completo. Las alertas de antigüedad se derivan al
consultar casos pendientes, con scope de sucursal y umbral configurable.

## Observabilidad mínima desde ahora

Logs estructurados con `correlation_id`, `tenant_id` y `actor_id`; endpoint de
health; errores tipados. Métricas y trazas completas llegan en Épica 6.

## Despliegue

Despliegue containerizado reproducible con PostgreSQL, migraciones
controladas, backups y rollback. El proveedor se decide antes de la Épica 6
(D-010) según presupuesto, jurisdicción fiscal, disponibilidad y necesidad de
hardware local.
