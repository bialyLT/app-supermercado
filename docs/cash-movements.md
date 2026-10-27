# Movimientos de caja W3a

Las sesiones de caja mantienen un ledger append-only `CashMovement`, aislado por tenant y vinculado a una `CashRegisterSession`.

- `OPENING`: se crea atómicamente al abrir la sesión; `openingAmount` es opcional y por defecto cero.
- `CASH_IN` y `CASH_OUT`: se registran manualmente con importe no negativo, motivo y actor.
- `CLOSING_COUNT`: se crea atómicamente durante el cierre ciego.

`closeRegisterSessionBlind` recibe únicamente el efectivo contado. El servidor calcula el esperado como apertura + ingresos - retiros + pagos `CASH` de la sesión. Transferencias, tarjetas y billeteras no se cuentan. El cierre guarda declarado, esperado y diferencia en la sesión, junto con motivo, actor y auditoría; una diferencia no bloquea el cierre.

La moneda se toma de la sesión y no se acepta desde el comando. Las sesiones cerradas y sus movimientos son inmutables. Los pagos legacy sin `registerSessionId` se conservan; para el cálculo se consideran mediante la sesión asociada a su venta cuando existe.

W3a no implementa vuelto, sobrepago, anulaciones, devoluciones, UI, offline, PSP, deuda ni emisión fiscal.
