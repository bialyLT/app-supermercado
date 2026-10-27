# Épica 3 — ventas, caja y pagos backend
Objetivo: hacer ventas multilínea íntegras y cobrables, con pagos manuales combinables y caja auditable.
Rama: feat/sales-cash-payments. Estrategia: feature-branch-chain. Runner: Windows `cmd.exe` + `npm.cmd`.

## Specs
S1. «Efectivo, transferencias, tarjetas y billeteras»; medios configurables, combinables en una venta y registrados manualmente, sin PSP.
S2. «Pago completo al confirmar (recomendado)»; no fiado, cuentas corrientes ni deuda.
S3. «ok, despues continua con ventas, caja y pagos»; backend por cortes verificables, sin UI POS, offline ni emisión fiscal.
S4. Venta server-priced: el servidor recalcula precios y total; HALF_UP por línea y total suma de líneas. Venta confirmada inmutable.
S5. Mantener compatibilidad del comando single-line actual; atomicidad de stock, venta e idempotencia.
S6. «Documento + stock + caja» para devoluciones; «Mismo efecto que devolución» para anulación total: documentos append-only, reposición de stock y CASH_OUT auditable; pagos originales intactos.

## Tasks
W1 | S3-S5 | gentle-ai-worker | done | Commit 29e560c + corrección 30c050e; parent focused 15/15 post-fix; writer full 139/139. Independent runtime retry hit Windows UNC limitation, but exact-tree review found blocker and parent native-path spot-check passed. Risk: item 3.
W2 | S1-S2 | gentle-ai-worker | done | Pagos manuales combinables y pago exacto completo; no PSP ni deuda. Risk: item 1 (stored payment data).
W3a | S3-S5 | gentle-ai-worker | done | Movimientos manuales de caja y cierre ciego auditable; bounded correction permits legacy closed sessions with NULL new counts; corrections documentales quedan en W3b. Risk: item 1 (stored cash data).
W3b | S6 | gentle-ai-worker | done | Anulaciones totales y devoluciones de línea completa append-only; reposición de stock y CASH_OUT auditable; pagos originales intactos. Migración 20261026215000 aplicada. Risk: item 1 (stored reversal/refund data).
W4 | S3-S5 | pending | pending | Numeración atómica, cierre documental y gates.

## Log
L8. W2 commit37f92d7 cerrado: full146/146, typecheck/lint0, ledger0, RLS29/29; reporte actualizado. Verificador independiente confirmó estructura W2; runtime aislado no pudo completar por timeout. Native review no iniciado por candidato workspace no correspondiente. Se inicia W3a sin inventar vuelto, crédito ni semántica de anulaciones.
L9. Corrección bounded W3a: `closeBlind` normaliza `declaredCash`, `expectedCash` y `difference` con `money(value, currency)` en cierre normal e idempotente; `populatedFixture` agrega un `recordCashMovement` autorizado con idempotency key única para poblar `CashMovement` en las aserciones RLS. Sin cambios de alcance ni debilitamiento de RLS/append-only. Typecheck 0 errores; integración no ejecutable por binding Rolldown ausente y sin URLs PostgreSQL disponibles.
L10. Corrección bounded de test W3a: el replay de `blind-close` con `reason` distinto ahora espera `IDEMPOTENCY_CONFLICT`; se conserva la aserción separada de `REGISTER_SESSION_ALREADY_CLOSED` para una clave diferente. Sin cambios de implementación ni debilitamiento de idempotencia.
L5. W1 correction: approved expired lot regression fixed in 30c050e; parent native Windows path run 15/15 passed. W1 is closed for this slice; native review was not started because inspect exposed unrelated workspace candidate. W2 begins with exact-total payment allocations; overpayment/change remains explicitly out of this slice until defined.
L6. W2 delivered: `confirmPaidMultiLineSale` validates CASH/TRANSFER/CARD/WALLET allocations, exact server total, duplicate methods, idempotent replay/conflict, tenant-scoped append-only Payment rows, and audit creation. Change/overpayment remains a pending product decision and is intentionally unsupported.
L1. Usuario: «ok, despues continua con ventas, caja y pagos».
L2. Usuario confirmó medios manuales combinables: efectivo, transferencias, tarjetas y billeteras; pago completo al confirmar, sin fiado.
L3. Exploración: `confirmSale` y `sale` actuales son single-line dentro de `inventoryTransaction`; extraer core parametrizado para no duplicar stock/FEFO/intake/idempotencia.
L4. No se implementarán tasas fiscales, ARCA, PSP, UI POS ni offline en esta épica backend.
L5. Verificador independiente encontró blocker en W1: el predicado `usable` omitía la aprobación para lotes vencidos y una venta aprobada sin intake devolvía `INSUFFICIENT_STOCK`. Corrección bounded aplicada solo en `src/server/repositories/inventory.ts`; regresión en `tests/integration/supervisor-closure.test.ts` pasó de RED (11/12) a GREEN junto con multiline (15/15), preservando consumo atómico de aprobación y reconciliación sin cambios de pagos/caja.
L11. Corrección bounded de test W3a: las dos aserciones de persistencia de `DECIMAL` usan `toFixed(2)` para comparar `3.00` y `0.00`; la suite real observada pasó de 23/24 por una única diferencia de representación (`toString()` devolvía `3`). Sin cambios de implementación ni migración. El focused runner local quedó bloqueado por binding nativo ausente de Rolldown; typecheck: 0 errores.
L12. Usuario decidió: «Documento + stock + caja» para devoluciones y «Mismo efecto que devolución» para anulación total. Se preservan pagos originales; se agregan documentos append-only, reposición de stock y `CASH_OUT` auditable, con autorización e idempotencia.
L13. W3b verificado: migración 20261026215000 aplicada; focalizada W3b+RLS 8/8; ampliada W3b/W3a/W2/RLS 25/25; suite completa 156/156; typecheck 0; lint 0. Correcciones parent: setup ADMIN + actor CASHIER en test de denegación; siembra de reversión autorizada en populatedFixture y tercer test RLS; clave `reversal-gate-reverse` única.
