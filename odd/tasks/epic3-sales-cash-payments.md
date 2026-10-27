# Épica 3 — ventas, caja y pagos backend
Objetivo: hacer ventas multilínea íntegras y cobrables, con pagos manuales combinables y caja auditable.
Rama: feat/sales-cash-payments. Estrategia: feature-branch-chain. Runner: Windows `cmd.exe` + `npm.cmd`.

## Specs
S1. «Efectivo, transferencias, tarjetas y billeteras»; medios configurables, combinables en una venta y registrados manualmente, sin PSP.
S2. «Pago completo al confirmar (recomendado)»; no fiado, cuentas corrientes ni deuda.
S3. «ok, despues continua con ventas, caja y pagos»; backend por cortes verificables, sin UI POS, offline ni emisión fiscal.
S4. Venta server-priced: el servidor recalcula precios y total; HALF_UP por línea y total suma de líneas. Venta confirmada inmutable.
S5. Mantener compatibilidad del comando single-line actual; atomicidad de stock, venta e idempotencia.

## Tasks
W1 | S3-S5 | gentle-ai-worker | in_progress | Extraer core transaccional y agregar venta multilínea sin pagos aún. Risk: item 3 (contrato compartido).
W2 | S1-S2 | pending | pending | Agregar pagos manuales combinables y pago completo.
W3 | S3-S5 | pending | pending | Movimientos y cierre ciego de caja, anulaciones/devoluciones como documentos nuevos.
W4 | S3-S5 | pending | pending | Numeración atómica, cierre documental y gates.

## Log
L1. Usuario: «ok, despues continua con ventas, caja y pagos».
L2. Usuario confirmó medios manuales combinables: efectivo, transferencias, tarjetas y billeteras; pago completo al confirmar, sin fiado.
L3. Exploración: `confirmSale` y `sale` actuales son single-line dentro de `inventoryTransaction`; extraer core parametrizado para no duplicar stock/FEFO/intake/idempotencia.
L4. No se implementarán tasas fiscales, ARCA, PSP, UI POS ni offline en esta épica backend.
