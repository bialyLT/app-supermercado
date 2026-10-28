# Épica 4 — POS keyboard-first y offline (corte 1: UI online)

Rama: `feat/pos-offline` (desde `feat/sales-cash_payments`). Brief aprobado:
`.github/web-dev-loop/reports/../briefs/epica-4-pos-offline.md`. Decisiones:
D-008 APROBADA, D-014 APROBADA, D-016 APROBADA, D-017 APROBADA (misma app,
ruta `/pos`). Corte 1 = UI keyboard-first online contra backend de Épica 3 con
`command_id` cableado; corte 2 = cola IndexedDB + sync (A2/B1/C1/D1).

## Specs

S1. «si deberia ser keyboard-first siempre»: flujo principal de cobro sin
mouse; búsqueda, atajos F1–F12, lector, carrito; targets táctiles ≥ 44 px.
S2. D-016: solo CASH puede exceder el total; TRANSFER/CARD/WALLET exactos;
cambio = pagado − total calculado por el servidor, registrado como CASH_OUT
CHANGE + campo `change`; sin precios por medio de pago.
S3. Corte 1 vende online contra el backend de Épica 3 (venta multilínea +
pago exacto/vuelto) con `command_id` estable por comando ya cableado para la
idempotencia B1 del corte 2.
S4. Módulos POS aislados bajo `/pos` según gate de boundaries: nada de Prisma
fuera de repositorios existentes; el POS consume el backend, no lo duplica.

## Tasks

T1 | S1,S4 | inline | done | `/pos` keyboard-first, búsqueda de catálogo, carrito, F2/F4/F8/F10/Escape, targets >=44px; E2E POS 2/2.
T2 | S2,S3,S4 | inline | done | D-016 CASH overpay + cambio server-side como CASH_OUT CHANGE; checkout `/api/pos/checkout`; command_id estable por intento/retry; manual-payments 5/5.
T3 | S1-S3 | inline | done | `tests/e2e/pos.spec.ts` + smoke: E2E 5 passed, 2 skipped, 0 failed; typecheck/lint/build verdes.
T4 | — | orquestador | done | Corte 2 (cola + sync): solo tras T1–T3 verdes.
T5 | — | orquestador | done | Cierre Épica 4 (informe, ROADMAP/DECISIONS).

## Log

L1. Dueño: «si deberia ser keyboard-first siempre»; D-014 aprobada; POS en la
misma app por mantenibilidad/escalabilidad (D-017); «ok aprobada» a D-016 con
vuelto solo en CASH calculado por el servidor.
L2. Corte acordado: UI keyboard-first online primero (con `command_id`),
sync después. Ajustes de stock prohibidos offline (D-008).
L3. T1-T3 implementados: `/pos`, catálogo/búsqueda autenticada, checkout online,
D-016 CASH_OUT CHANGE y E2E. Focalizadas: manual-payments 5/5,
fiscal contract 15/15; E2E 5 passed/2 skipped. Typecheck/lint/build verdes.
El full suite tuvo flake de timeout en RLS bajo carga; la focalizada RLS+fiscal+payments
pasó 23/23 con timeout 60s.
L4. T4 parcial en `adae76f`: IndexedDB para comandos SALE, replay por endpoint al
reconectar, y rutas POS para product-create/reversal. Typecheck/lint/build y
unauthenticated API E2E verdes. Authenticated replay/conflict E2E no estabilizó.
L5. C1 recibió persistencia genérica `SyncConflict` (tenant/RLS/status/payload,
listado y resolución supervisor) en `4df5bfd`; migración
`20261028100000_pos_sync_conflicts` aplicada al disposable; conflicto de
producto y resolución probados 3/3, A2 discrepancy 3/3 y D1 equivalent reversal
3/3. Full suite 178/178; browser authenticated replay remains explicitly
unverified. Commit boundary: 49c8d5e (T1-T3) → adae76f (T4 queue) → 4df5bfd
(T4 conflicts) → 2addf18 (A2/D1 reconciliation) → db8822e (docs + repository).
L6. T5 verificado y cerrado: fixes finales `7faf0b5` (CSP POS), `4dd9458`
(trust local origins), `fe31a05` (replay+catalog cache), `db1dc46` (validación
UUID), `050c75e` (detalle replay), `23f6bf0` (código conflicto) + corrección
final `a58a167`. Verificación manual autenticada completada: login usuario demo
real, venta offline CASH exacta 500, replay único, A2 STOCK_DISCREPANCY,
D1 idempotencia/cambio payload, C1 PRODUCT_DUPLICATE, alta offline producto.
