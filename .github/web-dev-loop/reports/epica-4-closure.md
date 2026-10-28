# Cierre formal — Épica 4

**Estado:** cierre formal entregado (T5 verificado y cerrado); push/PR quedan bajo decisión del dueño.
**Rama:** `feat/pos-offline`.
**Brief:** `.github/web-dev-loop/briefs/epica-4-pos-offline.md`.

## Alcance entregado

- POS `/pos` dentro de la misma app Next, keyboard-first: F2 búsqueda,
  F4 agregar, F8 pago, F10 confirmar, Escape limpiar; targets de acción ≥44 px.
- Búsqueda autenticada de catálogo y carrito multilínea.
- Checkout online contra Épica 3 con `command_id` estable por comando/reintento.
- Vuelto únicamente para CASH, calculado por servidor y registrado como
  `CASH_OUT` con motivo `CHANGE`; medios no-CASH no pueden sobrepagar.
- Cola local IndexedDB para ventas offline y replay por endpoint al reconectar.
- A2: replay offline habilita `UNVERIFIED_INTAKE` y registra
  `STOCK_DISCREPANCY` en `SyncConflict` si falta stock.
- C1: altas duplicadas quedan como `PRODUCT_DUPLICATE` en `SyncConflict`, con
  listado y resolución supervisor.
- D1: anulaciones equivalentes son idempotentes aun con otro command id; un
  efecto diferente conserva el rechazo existente.
- Rutas POS protegidas: catálogo, checkout, productos, reversals y conflictos.

## Commits

- `49c8d5e` — `feat(pos): add keyboard-first online checkout`
- `adae76f` — `feat(pos): queue offline sales for replay`
- `4df5bfd` — `feat(pos): persist offline sync conflicts`
- `2addf18` — `feat(pos): reconcile offline stock and reversals`
- `a58a167` — `docs(pos): record epic 4 evidence boundary`
- `7faf0b5` — `fix(pos): make CSP-compatible POS styles`
- `4dd9458` — `fix(auth): trust local POS origins`
- `fe31a05` — `fix(pos): replay queued sales and cache catalog`
- `db1dc46` — `fix(pos): reject unselected offline products`
- `050c75e` — `fix(pos): expose replay validation details`
- `23f6bf0` — `fix(pos): show conflict replay code`

## Gates observados

| Gate | Resultado |
|---|---|
| Prisma generate / validate | ✅ exit 0 |
| Migración disposable | ✅ 20 migraciones aplicadas; `20261028100000_pos_sync_conflicts` aplicada |
| Typecheck | ✅ 0 errores |
| Lint | ✅ 0 errores / warnings |
| Unit/integration suite | ✅ **178/178**, 28 archivos |
| Coverage | ✅ **89.81% líneas**, **85.83% ramas** global |
| Build | ✅ exit 0; 12 rutas, 5 dinámicas |
| E2E | ✅ **5 passed / 2 skipped / 0 failed** |
| Audit high/critical | ✅ 0 vulnerabilidades |
| Ledger | ✅ 0 divergencias |
| RLS | ✅ **35/35** tablas habilitadas y forzadas |
| Diff hygiene | ✅ limpio en superficies de Épica 4; CRLF heredado fuera de alcance |

## Evidencia específica

- Sync conflicts: **3/3** (persistencia C1, resolución, A2 discrepancy).
- Reversals: **3/3**, incluyendo equivalencia D1 con command id distinto.
- Manual payments: **5/5**, incluyendo CASH overpay/change y rechazo de
  overpay no-CASH.
- Full suite: 178/178; una corrida anterior de RLS tuvo timeout bajo carga,
  pero la corrida final con `--testTimeout=60000` pasó completa.
- Verificación manual autenticada offline (T5): login sobre usuario demo real,
  venta offline con CASH exacto (`500` para cantidad `5` @ `100`), replay único,
  discrepancia A2 `STOCK_DISCREPANCY`, resolución administrativa, anulación D1
  idempotente, alta offline de producto C1 y conflicto `PRODUCT_DUPLICATE`.
  PostgreSQL del disposable confirmó persistencia única y estado abierto controlado.

## Limitación reportada

Un E2E autenticado de navegador que fuerce caída de red, persista IndexedDB y
complete el replay autenticado no quedó estabilizado en runner. La verificación
**manual autenticada** con usuario real (`pos-admin@example.test`) se completó
durante el cierre: venta offline, replay online, discrepancia A2, resolución,
anulación D1, alta offline de producto y conflicto duplicado. No debe
presentarse como evidencia E2E automatizada; los invariantes correspondientes
pasaron en integración PostgreSQL real y la ruta manual quedó verificada.

## Decisiones

D-008, D-014, D-016 y D-017: **APROBADAS**. Ajustes de stock siguen prohibidos
offline; conflictos no se descartan silenciosamente; POS permanece en la misma
app Next. Épica 5 queda como siguiente epic probable.

**Risk:** item 1 (datos offline y conflictos persistidos): mitigado con
IndexedDB por command id, hash/idempotencia server-side, SyncConflict tenant
scoped, RLS FORCED y resolución auditable. La verificación manual autenticada
del replay quedó completada durante el cierre; la limitación E2E autenticada
sigue abierta solo como automatización runner.
