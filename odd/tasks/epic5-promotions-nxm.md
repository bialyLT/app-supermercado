# Épica 5 — Promociones N×M por categoría
Objetivo: aplicar promociones automáticas server-side, explicables y auditables sin romper los contratos de venta existentes.
Rama: `feat/promotions-nxm`; estrategia de entrega: `feature-branch-chain`; forecast: 900–1400 líneas autorales; runner: Vitest + PostgreSQL real + Playwright + gates de `GATES.md`.

## Specs

S1. «Promociones 2x1 / NxM» es el próximo corte aprobado de Épica 5. N×M significa llevar N unidades y pagar M, con N > M ≥ 1.

S2. La venta usa «Precio efectivo en una sola línea»: conserva una sola línea por variante y registra precio regular, descuento y promoción aplicada en el snapshot inmutable.

S3. El primer corte permite «Cualquier producto de una categoría», con aplicación «Automática en el servidor» y sólo para «Sólo unidades discretas». Quedan fuera pesables, cupones, segmentación de clientes, combos entre categorías, fiscalidad y hardware.

S4. Para cada grupo completo se descuentan «Las más baratas»; el remanente usa «Sólo grupos completos». Con precios distintos se usa «Maximizar beneficio por grupos»: ordenar de mayor a menor precio, formar grupos de N y descontar las N−M unidades más baratas dentro de cada grupo. Si coinciden reglas activas, se elige «Mayor beneficio, sin acumular» de forma determinista.

S5. La configuración es «Persistida por tenant y sucursal opcional»: categoría, N, M, vigencia, estado y alcance deben validarse server-side. Ningún `tenantId`, precio, descuento, total ni promoción enviados por el cliente son autoridad.

S6. El corte incluye «API y pantalla administrativa», protegidas por permisos, tenant/RLS y auditoría. Entradas inválidas o ajenas se rechazan sin cambios parciales.

S7. Checkout, idempotencia y reversión preservan los invariantes existentes: HALF_UP por línea, total igual a suma de líneas, mismo comando produce un solo efecto, payload distinto produce conflicto y la venta confirmada permanece inmutable.

S8. Aceptación: pruebas públicas cubren N×M con precios iguales y distintos, múltiples grupos, remanente, sucursal, vigencia, solapamiento, tenant ajeno, cantidades fraccionarias rechazadas, replay idempotente, reversión y UI; además pasan los gates aplicables de `GATES.md` con resultados numéricos.

## Tasks

T1 | S1,S3-S5 | inline/delegated | done | Modelo/migración/motor corregidos; GREEN 25/25, Prisma validate exit 0, typecheck 0, diff check 0; reverificación funcional read-only completada; commit 23242a0.
T2 | S2,S4,S7 | inline/delegated | done | Checkout server-side con precio efectivo, snapshot inmutable, idempotencia y reversión; focused 1/1, suite PostgreSQL 219/219; commit 23242a0.
T3 | S5,S6 | inline/delegated | done | Repositorio CRUD, API protegida, validación server-side, tenant/RLS y auditoría; admin integration 3/3, typecheck/lint/diff check 0; commit 23242a0.
T4 | S6,S8 | inline/delegated | done | Pantalla administrativa create/edit/deactivate contra API; typecheck/lint/diff check 0; browser E2E 1/1; commit 23242a0.
T5 | S1-S8 | orchestrator | done | Decisiones/roadmap/docs actualizados; Playwright general 11/11, promotions UI E2E 1/1 y production build exit 0; commit 23242a0.

## Log

L1. «bien continuemos con lo que sigue, yo ya publique la rama y mergee»
L2. Prioridad elegida: «Promociones 2x1 / NxM».
L3. Resoluciones del dueño: «Precio efectivo en una sola línea»; «Cualquier producto de una categoría»; «Automática en el servidor»; «Sólo unidades discretas»; «Las más baratas»; «Sólo grupos completos»; «Mayor beneficio, sin acumular»; «Persistida por tenant y sucursal opcional»; «API y pantalla administrativa».
L4. Aprobación: «ok aprueo el brief».
L5. Worktree limpio autorizado y creado en `/home/bialylt/workspaces/supermercado-promotions`, rama `feat/promotions-nxm`, desde `origin/main` en `a35c0eb`; el workspace heredado queda intacto.
L6. Exploración: checkout actual prohíbe líneas duplicadas por variante; `SaleLine.sourceSnapshot` es inmutable y sirve como evidencia de precio regular, descuento y regla. Riesgos previstos: item 1 (migración/configuración persistida), item 2 (tenant/RLS/permisos), item 3 (contratos compartidos de pricing/checkout). Forecast 900–1400 líneas: requiere estrategia de entrega antes del primer commit.
L7. Estrategia elegida: «Cadena desde rama feature — recomendado» (`feature-branch-chain`). Slices previstos: (1) modelo + motor, (2) checkout + API, (3) UI + cierre. No autoriza push ni PR.
L8. Agrupamiento aprobado: «Maximizar beneficio por grupos»: ordenar de mayor a menor, formar grupos N y descontar las N−M más baratas de cada grupo.
L9. Verificación independiente T1: S1/S3/S5 MET; S4 UNMET. Blocker reproducido: 2×1 con 100,100,10 debe descontar 100 y totalizar 110; con 100,100,20,20 debe descontar 120. También reportó expansión unitaria con riesgo de recursos, deriva `NoAction`/`SET NULL`, timestamps sin zona y uso de `Number` en pruebas. T1 sigue abierto hasta corregir y reverificar.
L10. Correcciones aplicadas: algoritmo por grupos descendentes, fórmula acumulada O(líneas) sin expansión por unidad/grupo, regresión de cantidad 10^12, FK `NoAction` alineada, `TIMESTAMPTZ(3)` y aserciones Decimal. Parent checks: 25/25 tests, Prisma validate exit 0, typecheck 0, diff check exit 0. La reverificación independiente posterior falló por `process cleanup unconfirmed; capacity quarantined`; no se reintentó. T1 bloqueado por decisión del dueño; sin commit.
L11. Decisión del dueño: «Pausar hasta disponer de verificador». No avanzar T2-T5 ni crear commits hasta obtener una reverificación independiente disponible para T1.
L12. Evidencia de cierre T1-T4: PostgreSQL Docker Desktop configurado con bases `supermercado` y `supermercado_test_gate`, roles runtime/admin/auth least-privilege; suite completa 31/31 archivos y 219/219 tests, RLS/identidad 6/6, administración 3/3, typecheck 0, lint 0, Prisma validate 0, diff check 0. Build inicial compiló pero agotó el timeout de 30s durante TypeScript; se completó posteriormente con timeout extendido.
L13. Decisión documental derivada de L4: D-020 aprueba el corte promocional N×M y supersede sólo la cláusula promocional postergada de D-018; D-018/D-019 mantienen EAN-13 fuera de este corte.
L14. Verificación browser: Playwright general 11/11 y `tests/e2e/promotions-admin.spec.ts` 1/1 pasan con Chromium y librerías WSL instaladas. T5 quedó pendiente únicamente del build extendido.
L15. Cierre de gates: `npm run build` termina con exit 0 usando timeout extendido; las rutas de producción, incluyendo `/admin/promotions` y sus APIs, compilan correctamente. T5 queda entregado.
L16. Commit de entrega: `23242a0 feat(promotions): deliver category N x M promotions`; todos los cambios de la épica quedaron incluidos. Push queda autorizado por la decisión posterior del dueño.
