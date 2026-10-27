# Pagos manuales W2

Una venta pagada se confirma con una o más asignaciones manuales: `CASH`, `TRANSFER`, `CARD` o `WALLET`. Los medios pueden combinarse, pero cada método aparece como máximo una vez.

El comando backend `confirmPaidMultiLineSale` recibe las líneas y `payments: [{ method, amount }]`. El servidor recalcula precios, moneda y total; las asignaciones deben sumar exactamente el total server-side. El pago incompleto o excedente se rechaza antes de crear venta, pagos, stock o idempotencia.

Los pagos se almacenan como filas append-only, con tenant, venta, importe Decimal, método, moneda del servidor, actor y timestamp. No se almacenan datos de tarjeta ni se integra ningún PSP o banco. El replay de la misma idempotency key devuelve el resultado original; un payload distinto es conflicto.

No se implementa vuelto/overpayment: queda pendiente una decisión explícita del producto antes de soportarlo. Tampoco se implementan movimientos o cierres de caja, devoluciones, UI, offline ni cuentas corrientes en W2.
