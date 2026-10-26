# Arquitectura inicial

## Forma del sistema

Se inicia como un modular monolith con límites de dominio explícitos:

1. **Identity:** usuarios, roles, sesiones y autorización.
2. **Catalog:** productos, variantes, códigos, unidades y atributos.
3. **Pricing:** listas de precios, vigencias, promociones y reglas.
4. **Inventory:** ubicaciones, lotes, vencimientos, reservas y movimientos.
5. **Sales:** tickets, líneas, impuestos, descuentos y devoluciones.
6. **Cash:** cajas, sesiones, movimientos y arqueos.
7. **Audit:** eventos sensibles, actor, terminal y valores anteriores/nuevos.
8. **Sync:** comandos offline, idempotencia, reintentos y conflictos.

Las interfaces pública y operativa podrán separarse como superficies de UI,
pero comparten contratos, reglas puras y acceso controlado al backend.

## Modelo de datos inicial

Entidades principales:

```text
tenant
  └── store
        ├── branch
        │     ├── warehouse
        │     ├── cash_register
        │     └── user assignment
        └── product / product_variant / barcode

warehouse + product_variant
  └── inventory_level
        └── inventory_movement (append-only)

cash_register + user
  └── cash_register_session
        ├── cash_movement
        └── sale
              ├── sale_line
              └── payment
```

Las tablas operativas reciben `tenant_id`, `store_id` y `branch_id` cuando el
dominio lo requiere. Los identificadores son UUID. Los importes se almacenan
con tipo decimal y se serializan como string en contratos externos.

## Invariantes

- Un código de barras activo identifica una variante dentro del tenant.
- Una venta confirmada no se edita: se corrige con devolución o documento
  compensatorio.
- Un movimiento de inventario no se actualiza ni elimina.
- El stock disponible se deriva de movimientos menos reservas.
- Una caja solo tiene una sesión abierta por vez.
- Una sesión cerrada no recibe movimientos normales.
- Una operación sensible exige permiso explícito y genera `audit_log`.
- Toda orden offline posee clave idempotente única.
- Ninguna consulta operativa cruza tenants.

## Concurrencia y offline

Las confirmaciones de venta y movimientos de inventario se ejecutan en una
transacción. La primera implementación elegirá bloqueo pesimista u optimista
según las pruebas de carga, documentando la decisión. El cliente offline
almacena comandos, no autoridad de stock; al reconectar, el servidor valida,
deduplica y resuelve conflictos explícitamente.

## Seguridad

- Cookies HttpOnly, Secure y SameSite=Strict para refresh/session cuando
  corresponda.
- CSRF, headers seguros, CSP y rate limiting.
- Zod en entradas de API, formularios y configuración.
- RBAC en servidor y, cuando aplique, políticas de base de datos.
- No secretos en repositorio, fixtures, logs ni documentación.

## Despliegue

El primer objetivo es un despliegue containerizado reproducible con PostgreSQL,
migraciones controladas, backups y rollback. El proveedor final se decidirá
antes de la Épica 5 según presupuesto, jurisdicción fiscal, disponibilidad y
necesidad de hardware local.
