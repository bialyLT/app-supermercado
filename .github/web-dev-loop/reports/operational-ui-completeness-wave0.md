# Informe — Completitud de la interfaz operativa, Ola 0

Estado: ENTREGADO: inventario de contratos terminado; la implementación queda
bloqueada por contratos administrativos faltantes identificados.

## Alcance revisado

Se inspeccionaron las rutas de `app/api/`, las páginas de `app/admin/` y
`app/pos/`, los repositorios de `src/server/repositories/`, los permisos, el
modelo Prisma y las pruebas de integración relacionadas con catálogo,
inventario, intake, ventas, reversión y caja.

## Contratos disponibles

- Catálogo POS: `GET /api/pos/catalog`, `POST /api/pos/products` y resolución
  EAN-13 pesable.
- Compras: `GET/POST /api/admin/purchases` y detalle.
- Transferencias: `GET/POST /api/admin/transfers`.
- Checkout: `POST /api/pos/checkout`.
- Reversión: `POST /api/pos/reversals` para `ANNULMENT` y `RETURN`.
- Caja: `POST /api/admin/cash-shifts` para `open`, `movement`, `blind-close` y
  `close`.
- Configuración administrativa, usuarios, proveedores, promociones y códigos
  pesables: rutas y pantallas existentes.

## Contratos faltantes

No hay rutas administrativas verificables para:

1. Listar existencias por ubicación, variante o lote.
2. Consultar movimientos del ledger.
3. Crear ajustes autorizados (`ADJUSTMENT`).
4. Consultar recepciones genéricas y alertas de inventario.
5. Listar y resolver casos `UNVERIFIED_INTAKE`.
6. Buscar y consultar historial de ventas.
7. Listar cajas, turnos, movimientos y arqueos históricos.

Los servicios de dominio/repositorio para parte de inventario e intake existen,
pero no están expuestos por contratos HTTP administrativos. Por lo tanto, la
UI correspondiente no debe implementarse todavía como si estuviera disponible.

## Hallazgos de autorización

La UI usa roles `ADMIN`, `STOCK_MANAGER`, `SUPERVISOR` y `CASHIER`. El dominio
usa permisos con forma `recurso.acción`, mientras algunos route handlers
administrativos usan `recurso:acción`. Antes de ampliar rutas debe definirse y
probarse una única convención compatible con la autorización existente.

## Orden habilitado

1. Normalizar y probar la matriz de permisos sin cambiar roles.
2. Exponer contratos read-only para catálogo administrativo, existencias,
   movimientos, ventas y caja.
3. Exponer ajustes, intake y reversión administrativa con idempotencia,
   auditoría y aislamiento.
4. Crear las pantallas administrativas sobre contratos verificados.

## Criterios de gate

- Se documentó cada capacidad como disponible, faltante o existente sólo como
  servicio interno.
- No se inventaron rutas ni se agregaron pantallas sobre contratos ausentes.
- Se preservan las reglas de `DOMAIN_RULES.md`, especialmente append-only,
  Decimal, RLS, autorización server-side e idempotencia.

## Decisiones requeridas

- `SUPUESTO:` los contratos administrativos faltantes forman parte de la
  completitud operativa y pueden implementarse sin cambiar la semántica de
  dominio.
- `DECISIÓN REQUERIDA:` aprobar una ola de contratos backend antes de las
  pantallas de stock, intake, ventas e historial de caja.
- `DECISIÓN REQUERIDA:` mantener roles existentes y normalizar permisos sin
  crear un rol `MANAGER`.

## Evidencia

- `app/api/pos/products/route.ts`
- `app/api/pos/catalog/route.ts`
- `app/api/pos/checkout/route.ts`
- `app/api/pos/reversals/route.ts`
- `app/api/admin/cash-shifts/route.ts`
- `app/api/admin/purchases/route.ts`
- `app/api/admin/transfers/route.ts`
- `src/server/repositories/inventory.ts`
- `src/server/repositories/catalog.ts`
- `src/domain/reversal.ts`
- `components/admin-navigation.ts`
- `src/auth/authorization.ts`
- `prisma/schema.prisma`
- `tests/integration/intake-alerts.test.ts`
