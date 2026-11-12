# DECISIONS — Registro de decisiones

Estados: **APROBADA** (vinculante), **PROPUESTA** (recomendada, a la espera de
OK del dueño del producto), **PENDIENTE** (falta información de negocio) y
**REEMPLAZADA por D-xxx** (histórica, no vinculante: se conserva solo como
rastro). Un agente solo trata como vinculantes las APROBADAS. Ante una PROPUESTA
aplica la recomendación como `SUPUESTO:` reversible.

| ID | Decisión | Estado | Necesaria antes de |
|---|---|---|---|
| D-001 | Modular monolith en Next.js App Router, sin microservicios | APROBADA | — |
| D-002 | Better Auth para autenticación | APROBADA | — |
| D-003 | `UNVERIFIED_INTAKE` atómico con revisión posterior | APROBADA | — |
| D-003b | Semántica de REJECTED y topes/política por tenant (ver `DOMAIN_RULES.md` §5) | APROBADA | — |
| D-004 | Aislamiento de tenant: repositorios + RLS de PostgreSQL | APROBADA | — |
| D-005 | Stock: ledger + `level` materializado con UPDATE condicional atómico y CHECK en base | APROBADA | — |
| D-006 | `store` = razón social del tenant; varias `branch` = sucursales físicas de esa razón social | APROBADA | — |
| D-007 | Redondeo `HALF_UP` por línea; total = suma de líneas | APROBADA | — |
| D-008 | Política offline: ventana de horas (un turno); sin red se permite vender, anular y dar de alta productos (ajustes de stock prohibidos offline). Conflictos automáticos: A2 venta aceptada siempre, discrepancia solo si el stock da negativo; B1 idempotencia por `(tenant, command_id)` + 409 ante payload distinto; C1 primer escritor gana, duplicado offline marcado para fusión; D1 anulación idempotente si coincide, 409 si difiere | APROBADA | Épica 4 |
| D-009 | Argentina; monotributista o responsable inscripto por razón social; ticket interno inicial, sin emisión fiscal | APROBADA (alcance inicial) | Fiscal e impresión cerrados por D-030 |
| D-010 | Neon Free en São Paulo para PostgreSQL y Vercel para la aplicación; subdominio del proveedor inicial; sin despliegue productivo durante esta épica | REEMPLAZADA por D-030 | — |
| D-011 | Memoria persistente externa | REEMPLAZADA por D-030 | — |
| D-012 | Override de supervisor por PIN con token de un solo uso | REEMPLAZADA por D-030 | — |
| D-013 | Fuera de alcance: e-commerce, delivery, picking, fidelización | REEMPLAZADA por D-030 | — |
| D-014 | Idempotencia por `(tenant, command_id)` + hash de payload; comandos POS como REST versionado | APROBADA | Épica 4 |
| D-015 | Moneda y tope monetario de intake obligatorios por tenant, sin valores de negocio por defecto; bloqueo hasta configurar | APROBADA | Apertura de sesión de caja |
| D-016 | Vuelto y sobrepago: solo CASH puede exceder el total; TRANSFER/CARD/WALLET exactos; cambio calculado por el servidor y registrado como CASH_OUT auditable | APROBADA | Cobro en Épica 4 |
| D-017 | POS en la misma app Next (ruta `/pos`, módulos aislados por boundaries): evita duplicar auth/tenant/validación y otro deploy; coherente con D-001 | APROBADA | Épica 4 |
| D-018 | Primer corte de Épica 5: códigos pesables EAN-13 con precio incrustado, configuración por tenant y sin hardware físico; promociones 2x1/NxM quedan para un corte posterior | APROBADA | Épica 5 |
| D-019 | Layout inicial EAN-13: prefijo 20 + SKU 5 dígitos + precio 5 dígitos + dígito de control, escala 2; el precio incrustado se usa como precio unitario validado contra el precio vigente del servidor | APROBADA | Épica 5 |
| D-020 | El corte promocional N×M por categoría aprobado en el brief de Épica 5 es el siguiente corte entregable; supersede únicamente la cláusula de D-018 que postergaba promociones, mientras D-018/D-019 siguen rigiendo el alcance EAN-13 | APROBADA | Épica 5 |
| D-021 | Backups operativos gestionados por el negocio mediante `pg_dump`, copia externa cifrada y restauración cronometrada; no se depende del backup administrado del proveedor gratuito. La retención de logs, auditoría y exportaciones es de un año. | REEMPLAZADA por D-030 | — |
| D-022 | La interfaz de la Épica 7 será responsive para escritorio y tablets, con navegación keyboard-first, foco visible, estados de carga/error y acciones rápidas. | APROBADA | Épica 7 |
| D-023 | Los reportes de la Épica 7 serán tablas filtrables con exportación CSV; no se agregan gráficos en el primer corte. | APROBADA | Épica 7 |
| D-024 | La Épica 7 completa la interfaz de las capacidades operativas existentes: shell, compras, transferencias, reportes, usuarios, configuración, códigos pesables y proveedores donde haya contrato backend; no agrega alcance público ni despliegue productivo. | APROBADA | Épica 7 |
| D-025 | Roles gerenciales: `ADMIN` como gerente tenant-wide, `STOCK_MANAGER` como gerente de inventario y `SUPERVISOR` como gerente de turno/caja; `CASHIER` queda operativo. No se crea un rol `MANAGER` nuevo. | APROBADA | Épica 7 |
| D-026 | Frontend Wave 0: migrar scripts/styles inline para mantener una CSP de producción estricta, sin resolver la violación agregando `unsafe-inline`. | APROBADA | Ola 0 de remediación frontend |
| D-027 | La interfaz debe publicar Arqueos y Turnos como pantalla operativa; no se oculta el acceso 404. La implementación debe reutilizar los contratos backend de caja existentes y no inventar capacidades. | APROBADA | Ola 0 de remediación frontend |
| D-028 | Cuando un usuario tenga varios roles, la UI usa precedencia de mayor alcance: `ADMIN` > `STOCK_MANAGER` > `SUPERVISOR` > `CASHIER`. La autorización real sigue siendo server-side. | APROBADA | Ola 0 de remediación frontend |
| D-029 | Los filtros avanzados de reportes/promociones deben alimentarse con fuentes read-only server-scoped; no se mantienen UUID crudos como interfaz final. | APROBADA | Ola 0 de remediación frontend |
| D-030 | Cierre de alcance: no hay despliegue, producción, staging, backups operativos ni CI/CD de release; la fiscalidad no se amplía (sin emisión fiscal, se mantiene el ticket interno y el modelo `FiscalProfile` queda inerte sin cambios). Cierra además D-011 (memoria persistente externa), D-012 (override por PIN, ya implementado) y D-013 (fuera de alcance e-commerce, delivery, picking, fidelización). | APROBADA | — |

## Cierre de alcance (D-030)

El producto se entrega como sistema operativo **local**. No se planifica publicar
en ningún proveedor: por eso no existe runbook de despliegue, ni backups
operativos, ni staging, ni rollback documentados como paso pendiente, y la
documentación no debe reintroducirlos.

La fiscalidad no se amplía. No hay emisión fiscal, IVA ni integración con
organismos: la venta sigue siendo ticket interno. El modelo de perfiles
tributarios ya implementado (`FiscalProfile`, `Sale.fiscalSnapshot`,
`src/domain/fiscal.ts`, `src/server/fiscal.ts`) **se conserva tal cual y se
mantiene inerte**: no se borra, no se amplía y no es requisito operativo para
vender. Un agente no debe agregar lógica fiscal nueva ni eliminar la existente
sin una decisión que reemplace a D-030.

## Decisión de continuidad de Épica 5

D-020 fija el corte promocional N×M por categoría en
`odd/tasks/epic5-promotions-nxm.md`, con evaluación server-side, snapshot
inmutable y administración protegida. La cláusula promocional de D-018 queda
supersedida; D-018/D-019 siguen fijando el alcance EAN-13, sin balanza física,
impresión ni emisión fiscal.

## Decisiones de continuidad de Épica 3

El dueño confirmó Argentina, ticket interno inicial, una razón social con varias
sucursales y HALF_UP por línea. El producto soporta tanto monotributista como
responsable inscripto: la condición se configura por razón social, no es una
elección global del sistema ni un régimen «pendiente». Las ventas conservan el
contexto tributario del momento; cambios posteriores no reescriben su historia.
Las reglas tributarias se separan de caja, pagos y stock. No se infieren tasas,
exenciones ni obligaciones de facturación a partir de un ticket interno.
Los registros legacy sin perfil se preservan sin asignación retroactiva.
Alcance verificable: `.github/web-dev-loop/briefs/epica-3-tax-profiles.md`.

## Cierre de Épica 3

Backend de ventas, caja y pagos cerrado técnicamente en
`.github/web-dev-loop/reports/epica-3-closure.md`: venta multilínea
server-priced inmutable, pago exacto combinable CASH/TRANSFER/CARD/WALLET,
cierre ciego auditable, anulaciones/devoluciones append-only con stock + caja,
numeración por sucursal y tipo con cierre de continuidad + cuadre. D-012
(override por PIN) ya se ejerce en el cierre documental; D-030 lo cierra como
implementado. D-016 fue aprobada para Épica 4: solo CASH puede
sobrepagar y el cambio se registra server-side como CASH_OUT CHANGE; D-008 y
D-014 también quedaron aprobadas. Entrega: `feat/sales-cash_payments` está
integrada en `main`.

## Cierre de Épica 4

Épica 4 queda cerrada técnicamente en
`.github/web-dev-loop/reports/epica-4-closure.md`: POS `/pos` keyboard-first
en la misma app Next, checkout online con vuelto CASH server-side, cola
IndexedDB y replay por endpoint, `SyncConflict` para A2/C1/D1 y rutas POS
protegidas. D-008, D-014, D-016 y D-017 están APROBADAS. El replay offline autenticado
quedó verificado manualmente con usuario real durante el cierre; el camino
estructural está tipado y los invariantes de A2/C1/D1 pasaron pruebas de
integración. La verificación E2E autenticada sigue como hardening posterior.
Entrega: la rama está integrada en `main`.

## Fundamento de las propuestas

- **D-015:** El dueño eligió explícitamente «Configuración obligatoria» en la
  continuación del cierre de Épica 2. No se adopta país, moneda ni importe
  inicial implícito. El mínimo de sesiones y step-up autorizado para este
  cierre está delimitado en `.github/web-dev-loop/briefs/epica-2-closure.md`;
  no aprueba fiscalidad ni pagos.

- **D-003b:** Se aprueba `ALLOW_WITH_CAPS` como política inicial por tenant,
  con topes de 10 unidades por línea, 30 unidades por sesión de caja y 20
  unidades por variante por día. `REJECTED` no revierte el ledger: crea una
  discrepancia asociada y un ajuste posterior autorizado.
- **D-004:** Prisma no impone filtros por sí mismo; un `where` olvidado filtra
  datos entre tenants. Las tablas de Épica 2 recién se crean, es el momento
  más barato de activar RLS. El costo es envolver cada operación en una
  transacción que fije el tenant.
- **D-005:** Decidirlo ahora evita rediseñar tras pruebas de carga. Con 10
  cajas el cuello de botella son las filas calientes, y la actualización
  condicional atómica las resuelve sin bloqueos largos. Las pruebas de carga
  pasan a **validar** esta decisión, no a elegirla.
- **D-006:** En muchos países cada punto de venta fiscal cuelga de una razón
  social. Sin `store` como entidad fiscal el nivel es redundante con `tenant`.
  Si el negocio nunca tendrá más de una, se elimina el nivel.
- **D-009:** Condiciona documentos de venta, numeración, tasas e impresión.
  Deciderlo en Épica 5 obligaría a migrar el esquema de ventas.
- **D-013:** `REUSABLE_RETAIL_SYSTEM_CONTEXT.md` describe canal online y
  fulfillment; sin esta decisión un agente puede deslizarse hacia ese alcance.

## Preguntas abiertas al dueño del producto

Ya resueltas (no volver a preguntarlas): país y tributación con ticket interno
(D-009, cerrado por D-030), balanza y formato de etiqueta (D-018/D-019: EAN-13
con precio incrustado, sin balanza física), tolerancia al corte de red (D-008:
ventana de un turno), stock negativo y topes (D-003b), hardware (fuera de
alcance por D-009/D-018).

Abiertas:

1. ¿Cuántas cajas y sucursales a 12 meses? ¿Cuántos SKU aproximados?
2. ¿Hacen falta precios distintos por medio de pago, horario o cliente? Hoy
   `Price` solo tiene `branchId` y `channel`.
3. ¿Hace falta una actualización masiva de precios por inflación? No existe
   herramienta: hoy el precio se cambia por variante.

## Cómo agregar una decisión

Nueva fila con ID correlativo, estado y "necesaria antes de". Al aprobarse,
cambiar el estado y, si altera una regla, actualizar `DOMAIN_RULES.md` en el
mismo cambio. No se borran decisiones: se marcan `REEMPLAZADA por D-xxx`.
