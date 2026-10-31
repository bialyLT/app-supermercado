# Roadmap operativo

**Estado:** Épicas 0, 1, 2, 3, 4 y 5 cerradas técnicamente en los cortes
aprobados. Épica 5 queda cerrada con EAN-13 con precio, perfiles fiscales
argentinos y promociones N×M; impresión y hardware permanecen fuera de alcance.
Épica 6 queda cerrada técnicamente; Épica 7 queda planificada para completar la interfaz operativa y administrativa.
**Reglas vinculantes:** `AGENTS.md`, `DOMAIN_RULES.md`, `DECISIONS.md`,
`GATES.md`.

**Auditoría frontend:** `docs/audits/informe-auditoria-frontend.md`.
**Plan de remediación:** `odd/tasks/frontend-audit-remediation.md`. La auditoría
organiza el trabajo futuro en cuatro olas; cada ola requiere brief, decisiones
pendientes resueltas y criterios medibles antes de implementar.

**Verificación final (2026-10-26):** 111/111 tests, 5/5 E2E,
20/20 rondas de 20 ventas concurrentes, ledger con 0 divergencias y RLS en
27/27 tablas con `tenantId`. Sesiones mínimas, step-up, topes de valor y alertas
del cierre implementados; ver `.github/web-dev-loop/reports/epica-2-closure.md`.

## Ola y gates

| Ola | Responsable | Tipo | Orden |
|---|---|---|---|
| 0 | Agent-DB/Backend | escribe scaffold y contratos | primero |
| 1 | Agent-SecQA + tester-quality | read-only | paralelo |
| 2 | Agent-Frontend/UI + API/performance | puede escribir | serie por recurso |
| 3 | Orquestador | gate, documentación y cierre | último |

La base de datos, el servidor y el navegador se serializan. Todo tester que
arregle código deja primero una reproducción fallida y luego re-ejecuta las
baterías afectadas. Los gates y su umbral viven en `GATES.md`.

## Cambio de orden respecto de la versión anterior

Se separó el backend de ventas, caja y pagos de la interfaz POS y se movió
antes de ella. Motivo: no se puede construir ni probar un POS offline sin una
venta, una sesión de caja y un pago con contrato servidor definido; y
"Sales" (tickets, devoluciones, anulaciones, numeración) no pertenecía a
ninguna épica anterior.

## Épica 0 — Fundación y decisiones (cerrada)

Scaffold Next.js/TypeScript, Prisma/PostgreSQL, Zod/env, Docker, CI base,
registry de testing y briefs.

## Épica 1 — Identity, RBAC y auditoría (cerrada)

Better Auth, roles, sesiones, permisos, audit log y rate limit.

## Épica 2 — Catálogo, precios e inventario (cierre técnico entregado)

- **Objetivo:** catálogo extensible y Kardex concurrente.
- **Entregables:** variantes, códigos de barras y pesables, lotes,
  vencimientos, ubicaciones, recepciones, reservas, movimientos, ajustes
  autorizados y `UNVERIFIED_INTAKE` con su ciclo de revisión.
- **Criterios de salida:** stock nunca negativo; concurrencia sin pérdida de
  movimientos; reconciliación ledger/level en cero divergencias; RLS o
  equivalente decidido (D-004) y probado; aislamiento por tenant en todas las
  tablas nuevas.
- **Fuera:** UI POS, pagos, caja, promociones complejas, compras.

Se adelantó únicamente el ciclo mínimo de sesión de caja y step-up necesario
para controlar inventario, autorizado en `epica-2-closure.md`. No implica
entrega de movimientos de caja, pagos, arqueo ni contratos fiscales de Épica 3.

## Épica 3 — Ventas, caja y pagos (backend)

- **Objetivo:** que una venta sea un hecho íntegro, auditable y cobrable, sin
  UI final.
- **Entregables:** `sale`, `sale_line` con snapshots, `payment` y medios de
  pago, sesiones de caja con apertura/ingresos/retiros/cierre ciego,
  anulaciones y devoluciones como documentos nuevos, numeración correlativa,
  override de supervisor (D-012), reportes de cierre.
- **Prerrequisitos:** D-006, D-007 y alcance inicial de D-009 aprobados.
- **Primer avance:** perfiles MONOTRIBUTO/RESPONSABLE_INSCRIPTO por razón
  social compartidos por sucursales, contexto histórico protegido y ticket
  interno. Informe: `.github/web-dev-loop/reports/epica-3-tax-profiles.md`.
- **Criterios:** sin venta sin sesión abierta; una sesión no se cierra dos
  veces; la diferencia de arqueo queda explicada y auditada; venta confirmada
  inmutable; el servidor recalcula todo total.
- **Cierre técnico:** W1 ventas multilínea (29e560c + 30c050e), W2 pagos
  manuales exactos combinables (37f92d7), W3a movimientos y cierre ciego
  (739543c), W3b anulaciones/devoluciones append-only (b861469), W4
  numeración por sucursal y tipo con cierre documental (160f72d), más fix E2E
  del mapeo 401/400 (sin commitear). Gates: 174/174 tests, typecheck/lint 0,
  build/E2E/audit verdes, ledger 0 divergencias, RLS 34/34. Informe:
  `.github/web-dev-loop/reports/epica-3-closure.md`. Entrega (push + PR)
  pendiente por el dueño.

## Épica 4 — POS keyboard-first y offline

- **Objetivo:** cobrar con teclado/escáner y tolerar microcortes.
- **Entregables:** búsqueda, atajos F1–F12, lector, carrito, cola local en
  IndexedDB, reintentos, idempotencia (D-014), sincronización con conflictos
  marcados (no descartados), responsive.
- **Prerrequisitos:** D-008 y D-014 APROBADAS (ventana de horas; offline:
  vender, anular, alta de productos; conflictos automáticos A2/B1/C1/D1).
- **Criterios:** flujo principal sin mouse; targets táctiles ≥ 44 px; comandos
  duplicados no duplican ventas; venta offline preservada en IndexedDB y
  replayable; stock insuficiente genera `STOCK_DISCREPANCY`; duplicados de
  producto quedan en `SyncConflict`; anulaciones equivalentes son idempotentes.
- **Cierre técnico:** T1-T3 `49c8d5e`, T4 queue `adae76f`, conflicts
  `4df5bfd`, reconciliation `2addf18`; 178/178 tests, coverage global
  89.81% líneas / 85.83% ramas, typecheck/lint/build verdes, E2E 5 passed /
  2 skipped, ledger 0 divergencias, RLS 35/35. Informe:
  `.github/web-dev-loop/reports/epica-4-closure.md`. Replay offline
  autenticado verificado manualmente con usuario demo real; queue structural
  path sí quedó typechecked.

## Épica 5 — Fiscalidad, hardware y promociones

- **Estado:** cerrada en los cortes aprobados; impresión y hardware quedan fuera
  hasta una decisión específica de dispositivo, formato y protocolo.
- **EAN-13 D-018/D-019:** parser y configuración tenant-scoped, resolución
  server-side, validación de precio vigente, snapshot inmutable y flujo POS.
- **Fiscalidad D-006/D-009:** perfiles MONOTRIBUTO/RESPONSABLE_INSCRIPTO por
  razón social, snapshot histórico en venta y aislamiento/auditoría.
- **Promociones D-020:** N×M por categoría, motor determinista, checkout,
  API administrativa y pantalla de gestión.
- **Verificación consolidada:** EAN reporta 193/193 tests, cobertura de líneas
  93.89% y ramas 84.29%, E2E 11/11 y build exit 0; el corte promocional agrega
  suite PostgreSQL 219/219, administración 3/3, E2E específico 1/1 y build
  exit 0. `typecheck`, `lint`, Prisma validate y `git diff --check` terminan en
  0 en el corte promocional.

## Épica 6 — Escala, reportes y despliegue

**Prerequisito:** D-010 y D-021 aprobadas. PostgreSQL se prepara sobre Neon Free
São Paulo y la aplicación sobre Vercel; los backups son operados por el negocio
con `pg_dump`, copias externas cifradas y restauración cronometrada. No se
publicará producción durante esta épica.

- **Objetivo:** operar múltiples sucursales y publicar con seguridad.
- **Entregables:** compras, transferencias entre sucursales, reportes,
  observabilidad (logs estructurados con `correlation_id`, health checks,
  métricas), backups, CI/CD, staging, producción, rollback y runbook.
- **Prerrequisito:** D-010.
- **Criterios:** release reproducible; migración reversible cuando sea
  posible; **restauración de backup probada y cronometrada**; prueba de carga
  con números; revisión OWASP final.

## Épica 7 — Interfaz operativa y administración (planificada)

**Brief:** `odd/tasks/epic7-operations-ui.md`.

- **Objetivo:** completar la interfaz de las capacidades backend existentes para que el sistema sea operable desde pantallas, no sólo mediante APIs.
- **Alcance aprobado:** shell responsive para escritorio/tablets, navegación keyboard-first, compras, transferencias, reportes tabulares con CSV sin gráficos, usuarios, configuración, códigos pesables y proveedores donde exista contrato.
- **Roles aprobados:** `ADMIN` tenant-wide, `STOCK_MANAGER` para inventario, `SUPERVISOR` para turno/caja y `CASHIER` operativo. No se crea un rol `MANAGER` nuevo; la navegación por rol puede implementarse con D-025.
- **Criterios:** no mouse obligatorio, foco visible, estados de error/pending, Decimal y tenant server-side, Playwright por flujo, responsive sin scroll horizontal en acciones principales y todos los gates de `GATES.md`.
- **Fuera:** e-commerce, delivery, picking, fidelización, marketplaces y deploy productivo.

## Remediación frontend basada en auditoría

La auditoría importada identifica 79 hallazgos: 3 críticos, 27 altos, 38
medios y 11 bajos. No se implementan automáticamente: primero se confirman
los hallazgos marcados ⚠ y se resuelven las decisiones de producto/security.

| Ola | Alcance inicial | Criterio de salida |
|---|---|---|
| 0 · Bloqueantes | CSP, sesión/rol, cierre de sesión, integridad de variantes y fechas, POS ubicación/Esc, navegación rota, idempotencia y coma decimal | Cada defecto tiene reproducción RED y GREEN; E2E contra build de producción verde |
| 1 · Teclado y tablet | Modal, Combobox, Field, Tabs, foco, drawer, tablas, POS y compras responsive | axe sin violaciones serias; recorridos keyboard-only; sin scroll horizontal; controles ≥44 px |
| 2 · Estados y errores | `apiFetch`, 401, errores consistentes, loading/empty/error/retry, cola offline | Cada pantalla prueba estados; cola offline visible y recuperable |
| 3 · Consistencia | Formatos es-AR, tokens, contraste, estilos inline y copy | Contraste AA; estilos/tokens centralizados; copy consistente |

La especificación operativa y las decisiones requeridas están en
`odd/tasks/frontend-audit-remediation.md`.

## Plantilla de cierre de cualquier épica

1. Todos los gates de `GATES.md` con números.
2. Informe en `.github/web-dev-loop/reports/`.
3. `DECISIONS.md` actualizado.
4. `ROADMAP.md` con el nuevo estado.
5. Árbol sin cambios sin explicar; el orquestador decide el commit.

## Decisiones pendientes

Ver `DECISIONS.md`. No se mantiene lista duplicada aquí.
