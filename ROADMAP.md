# Roadmap operativo

**Estado:** Épicas 0 y 1 cerradas; cierre técnico de Épica 2 entregado para
aceptación del orquestador. Épica 3 iniciada: perfil tributario argentino por
razón social y snapshot de ticket interno implementados; ventas/pagos/arqueos
completos todavía no entregados.
**Reglas vinculantes:** `AGENTS.md`, `DOMAIN_RULES.md`, `DECISIONS.md`,
`GATES.md`.

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

## Épica 4 — POS keyboard-first y offline

- **Objetivo:** cobrar con teclado/escáner y tolerar microcortes.
- **Entregables:** búsqueda, atajos F1–F12, lector, carrito, cola local en
  IndexedDB, reintentos, idempotencia (D-014), sincronización con conflictos
  marcados (no descartados), responsive.
- **Prerrequisitos:** D-008 resuelta.
- **Criterios:** flujo principal sin mouse; targets táctiles ≥ 44 px; comandos
  duplicados no duplican ventas; una venta offline nunca se pierde ni se
  rechaza por stock/precio distinto (se marca para revisión).

## Épica 5 — Fiscalidad, hardware y promociones

- **Objetivo:** cumplir obligaciones fiscales y conectar periféricos.
- **Entregables:** documentos fiscales según D-009, impresión de ticket,
  balanza/códigos pesables en producción, promociones server-side explicables.
- **Criterios:** cada línea guarda la regla que produjo su precio; el flujo
  fiscal tiene plan definido para modo sin conexión.

## Épica 6 — Escala, reportes y despliegue

- **Objetivo:** operar múltiples sucursales y publicar con seguridad.
- **Entregables:** compras, transferencias entre sucursales, reportes,
  observabilidad (logs estructurados con `correlation_id`, health checks,
  métricas), backups, CI/CD, staging, producción, rollback y runbook.
- **Prerrequisito:** D-010.
- **Criterios:** release reproducible; migración reversible cuando sea
  posible; **restauración de backup probada y cronometrada**; prueba de carga
  con números; revisión OWASP final.

## Plantilla de cierre de cualquier épica

1. Todos los gates de `GATES.md` con números.
2. Informe en `.github/web-dev-loop/reports/`.
3. `DECISIONS.md` actualizado.
4. `ROADMAP.md` con el nuevo estado.
5. Árbol sin cambios sin explicar; el orquestador decide el commit.

## Decisiones pendientes

Ver `DECISIONS.md`. No se mantiene lista duplicada aquí.
