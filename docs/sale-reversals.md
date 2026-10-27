# Anulaciones y devoluciones (W3b)

W3b implementa documentos `SaleReversal` append-only de tipo `ANNULMENT` o
`RETURN`. Una anulación exige todas las líneas de la venta con su cantidad
original. Una devolución acepta líneas completas, no cantidades parciales; una
cantidad ya revertida no puede volver a revertirse.

El servidor recalcula el total desde el snapshot de cada `SaleLine`, conserva
la venta y sus pagos intactos, repone cada lote/ubicación mediante movimientos
`RETURN` de inventario y crea un único `CASH_OUT` por el total, referenciado al
register session original. El actor debe ser supervisor o admin, tener una
sesión activa en la sucursal y usar la moneda de la venta. Toda operación exige
motivo e idempotencia; el replay exacto devuelve el mismo documento y un
payload distinto entra en conflicto.

Los documentos y sus líneas tienen FKs compuestas por tenant, RLS forzado y
triggers append-only. No hay UI, PSP, deuda, fiscalidad, numeración ni cambio
automático del estado de la venta o cierre de caja.
