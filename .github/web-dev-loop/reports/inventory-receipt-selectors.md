# Recepciones — ubicación y producto legibles

Estado: ENTREGADO: la recepción usa contexto operativo y búsqueda de catálogo sin entradas UUID para ubicación/variante.

- Archivos: integración en `components/inventory/inventory-ui.tsx`, `tests/e2e/receipts-selectors.spec.ts`, helper de fixtures sintéticos.
- Conserva lote opcional, Decimal/string, errores y clave de reintento; editar texto invalida variante.
- Requiere unidad compartida de selectores; inventario de lectura llega en la siguiente unidad.
- Navegador correctivo anterior a separación: 13/13 en 92 s; los cuatro casos de recepción cubren ambas orientaciones tablet, reintento y selección obsoleta. Validación posterior a separación registrada en el cierre general.
- Focalizadas tras separación: 29/29 en 3.30 s (5 archivos).
- Sin cambios de API, auth, esquema, permisos ni datos reales.
- SUPUESTO: lote opcional permanece como antes, sin catálogo nuevo.

Risk: item 3 (archivo compartido con alertas e intakes; diferencial SSR8/8 y revisión independiente realizados sobre la unidad acumulada).
