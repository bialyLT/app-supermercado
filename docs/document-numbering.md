# Numeración documental y cierre (W4)

W4 implementa la numeración atómica por sucursal y tipo exigida por S7 y el
cierre documental con continuidad más cuadre. No hay UI, offline, PSP ni
emisión fiscal; los números son internos y correlativos, sin significado fiscal
(D-009, ticket interno inicial).

## Secuencias

Una fila `DocumentSequence` por (tenant, sucursal, tipo) con tipos `SALE`,
`ANNULMENT` y `RETURN`. El número se asigna dentro de la misma transacción que
crea la venta o la reversión, bajo el lock de fila (`SELECT … FOR UPDATE`) más
el advisory lock por tenant ya existente: estrictamente creciente desde 1, sin
huecos en commits; un rollback no consume número. La respuesta del comando
expone `documentNumber`. La numeración hereda la autorización de la operación
que crea el documento (vender / `inventory.sale.approve` para reversiones).

## Backfill

Política elegida: **backfill en migración por orden de creación, con reparación
perezosa**. La migración `20261026216000` numera los documentos legacy por
`(createdAt, id)` dentro de cada partición sucursal+tipo e inicializa cada
secuencia en el máximo. Las filas rezagadas (creadas fuera del servicio, con
`documentNumber` NULL) se numeran en el mismo orden la primera vez que se crea
un documento nuevo de su partición, dentro de la misma transacción. La rama de
una venta legacy se deriva de su ubicación. No se inventa ningún significado
fiscal: solo orden de creación.

## Cierre documental

`closeBranchDocuments` (permiso `inventory.sale.approve`: supervisor/admin)
verifica, antes de escribir, por sucursal y moneda:

1. **Continuidad**: cada partición (ventas, anulaciones, devoluciones) es
   exactamente 1..max, sin huecos ni duplicados; cualquier documento sin número
   o en otra moneda rechaza el cierre (`SEQUENCE_GAP`,
   `DUPLICATE_DOCUMENT_NUMBER`, `UNNUMBERED_DOCUMENTS`, `CURRENCY_MISMATCH`).
2. **Cuadre**: neto documental (ventas − anulaciones − devoluciones) igual a
   los flujos registrados (pagos de total exacto + `CASH_IN` manual −
   `CASH_OUT`, incluido el que cada reversión crea); si difiere,
   `UNRECONCILED_CASH`. Las declaraciones de flotante (`OPENING`,
   `CLOSING_COUNT`) quedan fuera del cuadre.

Superado el gate, se registra una fila `DocumentClosure` inmutable con
conteos, totales y máximos por tipo, totales de pagos/movimientos, neto, caja,
motivo, actor e idempotencia. El replay exacto devuelve el mismo cierre; un
payload distinto con la misma clave entra en `IDEMPOTENCY_CONFLICT`. Ventas,
pagos y movimientos originales nunca se mutan.

## Base de datos

FKs compuestas por tenant, RLS forzado y grants mínimos en ambas tablas.
`DocumentClosure` es append-only por trigger y grants. `DocumentSequence`
permite `UPDATE` solo hacia adelante (trigger `DOCUMENT_SEQUENCE_PROTECTED`
rechaza reescrituras de claves, retrocesos y borrados); la ausencia de huecos
proviene de la asignación transaccional, el trigger mantiene honesto cualquier
`UPDATE` directo. Excepción única al append-only de `SaleReversal`: asignar
`documentNumber` desde NULL sin tocar ningún otro campo (una vez por fila),
para el backfill y la reparación perezosa; `SaleReversalLine` conserva el
`APPEND_ONLY` puro (corrección `20261026216200`). La reparación perezosa de
`Sale`/`SaleReversal` usa grants de `UPDATE` a nivel de columna solo sobre las
columnas de numeración.
