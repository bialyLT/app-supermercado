# Brief — Épica 4: POS keyboard-first y offline (BORRADOR para aprobación)

## Objetivo

Cobrar con teclado/escáner y tolerar cortes de red de hasta un turno, sin
perder ventas ni inventar conciliaciones manuales.

## Alcance (D-008 APROBADA)

- Ventana offline: horas (un turno completo).
- Permitido sin red: vender, anular, alta de productos. Ajustes de stock
  PROHIBIDOS offline.
- Conflictos automáticos al reconectar:
  - A2: la venta offline siempre se acepta; solo genera discrepancia para
    revisión si el stock resultante da negativo (si alcanza, sin tarea).
  - B1: idempotencia por `(tenant, command_id)`; mismo id + payload distinto
    → 409 (ver D-014, aún PROPUESTA: este brief la ejerce).
  - C1: alta de producto con SKU existente → gana el primero en el servidor;
    el offline queda como duplicado marcado para fusión por supervisor.
  - D1: anulación idempotente si coincide con el efecto ya aplicado; si
    difiere → 409 para revisión.

## Entregables propuestos

1. UI POS keyboard-first: búsqueda, atajos F1–F12, lector, carrito, flujo
   principal sin mouse, targets táctiles ≥ 44 px, responsive.
2. Cola local en IndexedDB con reintentos y `command_id` estable por comando.
3. Sincronización con reglas A2/B1/C1/D1; conflictos marcados, nunca
   descartados en silencio.
4. Discrepancias de stock (A2) y duplicados de producto (C1) visibles como
   tareas de revisión (alcance mínimo: listar + resolver supervisor).

## Fuera de alcance

Emisión fiscal, hardware (impresora/cajón/balanza en producción), promociones,
precios por medio de pago, vuelto/sobrepago (D-016 PENDIENTE: el cobro offline
sigue exigiendo pago exacto como en Épica 3), ajustes de stock offline,
e-commerce/delivery (D-013).

## Criterios de salida propuestos

- Flujo principal sin mouse; comandos duplicados no duplican ventas (B1).
- Una venta offline nunca se pierde ni se rechaza por stock/precio distinto;
  si el stock no alcanza, queda discrepancia (A2), no error.
- Gates de `GATES.md` + E2E del flujo POS (online, offline y reconexión).

## Resoluciones del dueño (2026-10-28)

1. D-014 APROBADA formalmente con este brief.
2. Superficie POS: misma app Next, ruta `/pos`, módulos POS aislados por el
gate de boundaries (D-017; decisión delegada por el dueño con criterio de
mantenibilidad/escalabilidad, coherente con D-001).
3. D-016 (vuelto) en definición: ver propuesta abajo, pendiente de OK.
4. Corte de trabajo: keyboard-first siempre; primer corte UI keyboard-first
online contra el backend de Épica 3 (con `command_id` ya cableado), segundo
corte cola local + sincronización.

## Propuesta D-016 (pendiente de OK del dueño)

- Sobrepago permitido SOLO en CASH; TRANSFER/CARD/WALLET exigen monto exacto.
- Cambio = pagado − total, calculado íntegramente por el servidor.
- Registro: el pago guarda lo recibido (CASH_IN) y el vuelto sale como
CASH_OUT auditable con motivo CHANGE + campo `change` en la venta.
- El cuadre de caja no cambia: neto = pagos + CASH_IN − CASH_OUT (el vuelto
ya sale como CASH_OUT).
- Sin precios diferenciados por medio de pago (sigue fuera de alcance).

## Preguntas abiertas antes de implementar

1. ~~¿D-014 se aprueba formalmente con este brief?~~ APROBADA (2026-10-28).
2. ~~¿Superficie separada o misma app?~~ Misma app, `/pos` (D-017).
3. ~~¿OK a la propuesta D-016 de arriba?~~ APROBADA (2026-10-28): solo CASH
puede exceder; cambio server-side como CASH_OUT CHANGE.
4. ~~¿Corte UI o sync primero?~~ UI keyboard-first online primero, sync después.

Estado: APROBADO por el dueño — se implementa. Primer corte: UI keyboard-first
online contra backend de Épica 3 con `command_id` cableado. Segundo corte: cola
local + sincronización A2/B1/C1/D1.

Estado: BORRADOR — sin aprobación del dueño no se implementa.
