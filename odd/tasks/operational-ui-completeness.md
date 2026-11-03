# Fase — Completitud de la interfaz operativa

Branch: `feat/operational-ui-completeness` (crear desde `main` después de
aprobar este brief).
Status: proposed; no habilita implementación hasta aprobación explícita del
dueño.

## Objetivo

Completar la superficie de uso interno del POS/ERP para que las capacidades
operativas existentes puedan ejecutarse desde pantallas claras, autorizadas,
responsive y keyboard-first, sin agregar nuevos dominios ni duplicar reglas de
negocio en el navegador.

Esta fase continúa la Épica 7 y las Waves 0–3 de frontend. No reemplaza ni
reabre los contratos de catálogo, inventario, ventas, caja, pagos, compras,
transferencias, promociones o reportes que ya fueron entregados.

## Alcance aprobado por esta propuesta

### A. Catálogo y productos

Agregar una superficie administrativa para consultar y mantener productos y
variantes cuando exista contrato backend suficiente.

- listado paginado o con límite explícito;
- búsqueda por SKU, nombre y código de barras;
- alta de producto/variante sólo si el contrato existente lo permite;
- edición de datos no históricos;
- activación/desactivación;
- precio y unidad mostrados como strings Decimal;
- códigos pesables visibles sin convertirlos en una responsabilidad del cliente;
- errores de duplicidad e idempotencia conservando los datos ingresados;
- permisos derivados del servidor y alcance por tenant/sucursal.

No se permite editar desde la UI snapshots históricos de ventas, movimientos
del ledger ni precios usados por documentos ya confirmados.

### B. Stock, movimientos y ajustes

Agregar una pantalla operativa para consultar el estado materializado y el
historial del ledger, y para iniciar ajustes autorizados cuando el backend ya
tenga el contrato correspondiente.

- filtros por sucursal, ubicación, variante, lote y estado;
- saldo `on_hand`, `reserved` y `available`;
- historial append-only con tipo, cantidad, referencia, actor y fecha;
- detalle de lotes y vencimientos cuando estén disponibles;
- acción de ajuste sólo online y sólo con permiso;
- motivo obligatorio para ajustes;
- confirmación previa y resultado explícito;
- estados loading, empty, error, retry y forbidden;
- enlace claro a casos de intake pendientes cuando el contrato lo exponga.

La UI no calcula stock autoritativo, no acepta `tenantId`, `branchId`,
totales ni saldos enviados por el cliente y no permite modificar o borrar
movimientos existentes.

### C. Recepciones e intake no verificado

Exponer el flujo de revisión de `UNVERIFIED_INTAKE` si las rutas o servicios
existentes permiten consultar y resolver casos.

- bandeja de casos `PENDING_REVIEW`;
- filtros por sucursal, variante, cajero, antigüedad y estado;
- detalle de la venta y del `case_id`;
- resolución `CONFIRMED`, `CORRECTED` o `REJECTED` sólo con permisos;
- motivo obligatorio cuando corresponda;
- separación de funciones: el creador no puede revisar su propio caso;
- caso resuelto presentado como inmutable;
- alerta visual para casos vencidos según el umbral del tenant;
- manejo explícito de conflictos, 401, 403, 404 y 409.

Si no existe un contrato backend verificable, se documentará como API-only y no
se inventará un endpoint desde la interfaz.

### D. Historial de ventas, anulaciones y devoluciones

Agregar una superficie de consulta y operación sobre ventas existentes.

- búsqueda por número, fecha, sucursal, caja, usuario y estado;
- detalle de venta con líneas, cantidades, precios, descuentos, impuestos y
  snapshot histórico;
- pagos separados por medio;
- acceso a reversión/anulación/devolución sólo cuando corresponda al permiso;
- confirmación de operaciones irreversibles o compensatorias;
- motivo y resultado server-side;
- estado de idempotencia y conflicto visible;
- actualización de la lista sin perder filtros ni datos de la pantalla.

Las devoluciones y anulaciones deben seguir siendo documentos nuevos y
append-only. La UI nunca recalcula el total ni muta una venta confirmada.

### E. Caja, turnos y diferencias

Completar la pantalla de arqueos y turnos más allá del acceso básico ya
publicado.

- listado de sesiones abiertas y cerradas dentro del alcance autorizado;
- apertura, movimientos, cierre ciego y cierre;
- detalle de diferencia explicada;
- permisos y step-up server-side cuando corresponda;
- historial auditable de ingresos, retiros, cambio y movimientos;
- estados de caja sin sesión, sesión abierta, pendiente de cierre y cerrada;
- protección contra doble submit e idempotencia visible;
- responsive para operación en tablet.

No se agregan nuevas semánticas de caja ni se habilita crédito, vuelto
inventado o sobrepago en medios no autorizados.

### F. Navegación y coherencia transversal

Integrar las pantallas nuevas al shell administrativo existente.

- menú role-aware según D-025 y precedencia D-028;
- breadcrumbs y rutas consistentes;
- branch/location server-scoped;
- atajos de teclado sin mouse-only actions;
- foco visible y orden de tabulación predecible;
- tablas utilizables en escritorio y tablet sin overflow de acciones primarias;
- estados loading/error/empty/retry en cada pantalla;
- mensajes sin secretos, hashes, PII innecesaria ni UUIDs crudos como interfaz
  final cuando exista un nombre legible;
- reutilización de helpers, tokens y componentes existentes.

## Inventario actual y resultado esperado

| Superficie | Situación observada | Resultado de esta fase |
|---|---|---|
| POS y checkout | Pantalla existente | Completar accesos a historial y reversión |
| Compras | Pantalla existente | No reimplementar; conectar con stock/recepción si el contrato lo permite |
| Transferencias | Pantalla existente | No reimplementar; mostrar resultado y trazabilidad desde inventario |
| Reportes | Pantalla existente | Agregar enlaces a detalles operativos sólo si hay contrato |
| Promociones | Pantalla existente | Mantener alcance actual; no agregar gráficos ni fiscalidad |
| Proveedores | Pantalla existente | Mantener contrato actual |
| Usuarios/configuración | Pantallas existentes | Ajustar navegación y permisos sólo donde sea necesario |
| Códigos pesables | Pantalla existente | Mantener integración con POS |
| Catálogo/productos | API POS de consulta y alta offline; no hay pantalla administrativa equivalente | Crear pantalla si el contrato administrativo es suficiente; de lo contrario documentar gap backend |
| Stock/movimientos | Contratos de inventario existentes; superficie administrativa no completa | Crear consulta, detalle y ajustes autorizados |
| Intake/revisión | Reglas de dominio y backend parcial | Exponer sólo contratos verificables; no inventar API |
| Historial de ventas | Contratos de venta/reversión existentes; no hay pantalla dedicada | Crear consulta, detalle y acciones autorizadas |
| Arqueos/turnos | Ruta y manager existentes | Completar flujo operativo y diferencias |

## Límites

Fuera de esta fase:

- e-commerce, delivery, picking, fidelización y marketplaces;
- emisión fiscal, factura electrónica, impresoras o hardware;
- cambios de esquema salvo que una brecha de contrato existente lo haga
  estrictamente necesario y se apruebe en un brief separado;
- nuevos roles o permisos de negocio;
- cambio de semántica de ventas, pagos, stock, offline o promociones;
- dashboards gráficos;
- producción, despliegue, CI, backups y observabilidad;
- migración o edición de snapshots históricos;
- reemplazo de APIs o repositorios por acceso directo a Prisma desde la UI.

## Invariantes no negociables

1. El servidor es autoridad para tenant, sucursal, permisos, precios,
   cantidades, stock, totales, idempotencia y auditoría.
2. Dinero y cantidades se muestran desde Decimal/string; no se usa `number`
   para dinero o cantidades de dominio.
3. La UI nunca acepta `tenantId`, `branchId`, stock, precio o total como
   autoridad del cliente.
4. Ventas confirmadas, movimientos de ledger, auditoría y casos resueltos son
   inmutables.
5. Todo mutating flow conserva idempotencia, rechaza payload divergente con
   409 y no pierde el formulario ante errores de red.
6. Toda ruta nueva responde correctamente sin sesión, con rol insuficiente y
   con recurso de otro tenant/sucursal.
7. Todo ajuste, revisión, anulación o devolución deja motivo, actor y
   trazabilidad auditada según el contrato existente.
8. Las capacidades offline se limitan a D-008; ajustes de stock y revisiones
   administrativas no se habilitan offline.
9. La UI respeta responsive desktop/tablet, keyboard-first, foco visible y
   targets táctiles de al menos 44 px.
10. Si falta un contrato backend, el resultado es `API-only documentado`, no
    una implementación especulativa.

## Criterios de aceptación

1. Cada superficie incluida tiene una ruta navegable, permiso server-side,
   loading, empty, error, retry y forbidden state.
2. Catálogo, stock, intake, ventas y caja tienen pruebas de contrato/UI para
   happy path, sesión ausente, rol insuficiente, tenant ajeno y conflicto 409.
3. Las acciones principales se pueden completar sin mouse y tienen foco visible.
4. En desktop y tablet no existe scroll horizontal para las acciones primarias.
5. Una acción mutante repetida cinco veces produce un solo efecto cuando usa el
   mismo command/idempotency key.
6. Un mismo id con payload distinto produce 409 y conserva el formulario.
7. Los listados mantienen filtros y paginación después de una acción o error.
8. Los importes, cantidades, fechas y estados visibles coinciden con la
   respuesta server-side y no se recalculan en el navegador.
9. Las pantallas nuevas aparecen sólo para roles autorizados y no exponen
   navegación ficticia a otros roles.
10. Cada contrato faltante queda listado con ruta/API, evidencia y decisión de
    `API-only`, sin presentarlo como funcionalidad entregada.
11. Los gates de `GATES.md` pasan sin regresiones y el informe incluye números
    reales por batería.

## Plan de olas

| Ola | Superficie | Responsable | Escritura | Dependencia |
|---|---|---|---|---|
| 0 | Inventario ejecutable de contratos, rutas y permisos | Orquestador | No | Esta aprobación |
| 1 | Catálogo, productos y consulta de stock | Dev | Único escritor | Ola 0 |
| 2 | Movimientos, ajustes, recepciones e intake | Dev | Único escritor, en serie | Ola 1 |
| 3 | Historial de ventas, anulaciones y devoluciones | Dev | Único escritor, en serie | Contratos de Ola 2 |
| 4 | Caja, turnos, diferencias y navegación transversal | Dev | Único escritor, en serie | Olas 1–3 |
| 5 | Seguridad/calidad read-only y UI/DB adversarial | Testers | Según perfil | Árbol congelado |
| 6 | Regresión, gates, informe y cierre | Orquestador | Documentación | Todas las anteriores |

La Ola 0 debe confirmar por inspección y pruebas qué APIs están realmente
disponibles antes de autorizar una pantalla. Si descubre una brecha backend,
esa brecha se registra como bloqueada y no se resuelve ampliando el alcance en
silencio.

## Fan-out y testers propuestos

- `tester-quality`: tipos, lint, duplicación, estados incompletos y límites de
  UI; read-only.
- `web-dev-loop-tester-ui`: navegación real, keyboard-first, responsive,
  overflow, estados y E2E; puede corregir sólo con autorización de la ola.
- `web-dev-loop-tester-db`: idempotencia, tenant/RLS, ledger, concurrencia y
  reconciliación; read-only salvo autorización explícita.
- `web-dev-loop-security-auditor`: autorización, tenant isolation, exposición
  de datos, CSRF, headers y mutaciones; read-only.

No se incluye performance dedicada en la primera ronda. La ausencia se
reportará como hueco de cobertura si el dueño no activa ese tester.

## Contexto obligatorio

- `AGENTS.md`
- `DOMAIN_RULES.md`
- `DECISIONS.md`
- `GATES.md`
- `ARCHITECTURE.md`
- `ROADMAP.md`
- `odd/tasks/epic7-operations-ui.md`
- `odd/tasks/frontend-audit-remediation.md`
- `odd/tasks/frontend-audit-wave2.md`
- `odd/tasks/frontend-audit-wave3.md`
- `src/server/repositories/`
- `app/api/`
- `app/admin/`
- `app/pos/`

## Gates y entregables

Cada ola que escriba código tendrá un brief derivado con paths exactos y un
informe en `.github/web-dev-loop/reports/`.

| Gate | Comando | Resultado esperado |
|---|---|---|
| Typecheck | `npm.cmd run typecheck` | exit 0 |
| Lint | `npm.cmd run lint` | 0 errores y 0 warnings nuevos |
| Tests | `npm.cmd test` | 0 fallos; pasados/total |
| Cobertura | `npm.cmd run test:coverage` con DB gate | umbrales de `GATES.md` |
| Build | `npm.cmd run build` | exit 0 |
| E2E | `npm.cmd run test:e2e` | 0 fallos; pasados/total |
| Ledger | `npm.cmd run test:ledger` | 0 divergencias |
| Concurrencia | `npm.cmd run test:concurrency` | ≥20 rondas sin fallo |
| Higiene | `git diff --check` | sin salida |

También se verifican Prisma/RLS/boundaries cuando una ola toque contratos o
repositorios. No se marcará un gate como verde sin resultado numérico.

## Archivos esperados

La fase puede crear o modificar:

- `app/admin/**`
- `app/pos/**` sólo para integrar historial/reversión con contratos existentes
- `components/**`
- `src/client/**` sólo helpers de presentación o transporte
- `tests/**`
- `odd/tasks/` para briefs derivados
- `.github/web-dev-loop/reports/` para informes

No puede modificar durante la fase base:

- `DOMAIN_RULES.md`
- `DECISIONS.md` salvo una decisión explícita del dueño
- `prisma/migrations/`
- `REUSABLE_RETAIL_SYSTEM_CONTEXT.md`
- configuración de producción o proveedores

## Supuestos y decisiones requeridas

- `SUPUESTO:` el dueño desea completar la operación interna sobre los contratos
  actuales, no ampliar el dominio funcional.
- `SUPUESTO:` la primera entrega prioriza escritorio y tablet; no se exige
  móvil telefónico como superficie primaria.
- `SUPUESTO:` las pantallas deben mostrar nombres legibles y sólo usar IDs
  técnicos en detalles o soporte.
- `DECISIÓN REQUERIDA:` aprobar el alcance de esta fase antes de crear la
  rama o escribir código.
- `DECISIÓN REQUERIDA:` confirmar testers activos para UI/E2E, DB, calidad y
  seguridad; performance queda opcional y explícitamente fuera si no se activa.
- `DECISIÓN REQUERIDA:` aceptar que una capacidad sin contrato backend
  verificable se informe como `API-only` en vez de implementarse
  especulativamente.

## Estado

Propuesta lista para revisión. No iniciar implementación, no crear migraciones,
no hacer commit ni push hasta recibir aprobación explícita del dueño y cerrar
la Ola 0 de inventario de contratos.
