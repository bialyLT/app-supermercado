# Brief — Épica 5: promociones N×M por categoría

Estado: APROBADO por el dueño.

## Objetivo

Aplicar promociones automáticas server-side del tipo N×M (llevar N unidades y pagar M) sobre artículos discretos de una categoría, con cálculo determinista, trazabilidad inmutable y administración por tenant/sucursal.

## Alcance aprobado

- N×M exige `N > M >= 1`.
- La evaluación es automática y exclusivamente server-side.
- Participan unidades discretas de productos pertenecientes a una misma categoría.
- Cada grupo completo de N aplica el beneficio; el remanente queda a precio regular.
- Con precios diferentes, se descuentan las unidades más baratas del grupo.
- Si coinciden promociones, se aplica la de mayor beneficio para el cliente y no se acumulan.
- La configuración persiste por tenant, con alcance opcional por sucursal, vigencia y estado.
- La venta conserva una sola línea por variante con precio efectivo y snapshot inmutable del precio regular, descuento y regla aplicada.
- Incluye API administrativa protegida y pantalla de gestión.

## Invariantes

- El servidor resuelve categorías, precios, promociones y totales; el cliente no aporta autoridad.
- HALF_UP se mantiene por línea y el total de venta sigue siendo la suma exacta de líneas.
- Una venta confirmada no se edita; anulaciones y devoluciones conservan la trazabilidad original.
- El mismo `command_id` y payload produce un solo efecto; el mismo id con payload distinto produce conflicto.
- Toda lectura/escritura operacional respeta tenant, sucursal, permisos, RLS y auditoría.
- Las migraciones son nuevas, aditivas y no destructivas.

## Entregables

1. Modelo persistente de promoción con tenant, sucursal opcional, categoría, N, M, vigencia y estado.
2. Motor puro de dominio para selección determinista de grupos, unidades beneficiadas y precio efectivo.
3. Integración transaccional en checkout con snapshot de procedencia y preservación de idempotencia/reversión.
4. Repositorio y API administrativa con validación, permisos, RLS y auditoría.
5. Pantalla administrativa para listar, crear, editar/activar y desactivar promociones.
6. Documentación operativa y actualización de decisiones/roadmap.

## Criterios específicos de salida

- Precios iguales: 2×1 y N×M producen el total esperado.
- Precios distintos: dentro de cada grupo se descuentan las unidades más baratas.
- Cantidades con varios grupos aplican todos los grupos completos y cobran el remanente a precio regular.
- Una promoción de sucursal prevalece sólo dentro de esa sucursal; una promoción tenant-wide aplica donde no haya una regla más beneficiosa.
- Reglas fuera de vigencia, inactivas, de otro tenant/categoría o para cantidades fraccionarias no se aplican.
- Ante solapamiento gana una sola promoción: la de mayor beneficio, con desempate estable y documentado.
- El snapshot permite reconstruir precio regular, descuento, promoción y regla N×M de cada línea.
- Replay idempotente, conflicto por payload distinto y reversión mantienen los importes originales.
- API/UI rechazan sesión ausente, rol insuficiente, tenant ajeno y datos inválidos sin persistencia parcial.
- Gates de `GATES.md` con resultados numéricos y PostgreSQL real para integración/RLS.

## Fuera de alcance

Cupones, promociones por cliente, horarios recurrentes complejos, acumulación de promociones, combos entre categorías, pesables, precios por medio de pago, emisión fiscal, impresión y hardware físico.

## Riesgos

- Item 1: nueva configuración persistida y migración.
- Item 2: permisos, tenant y RLS en administración/evaluación.
- Item 3: pricing y checkout son contratos compartidos por POS, replay y reversión.

## Estrategia de implementación

TDD por regla observable: RED público, mínima implementación GREEN y refactor con checks enfocados. Trabajo en unidades revisables con tests y docs junto al comportamiento. Forecast: 900–1400 líneas autorales; la forma de entrega se decide antes del primer commit.
