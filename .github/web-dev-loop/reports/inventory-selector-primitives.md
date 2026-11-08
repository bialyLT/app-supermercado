# Selectores de inventario — unidad compartida

Estado: ENTREGADO: primitivas de selección sobre catálogo y contexto existentes; integración en pantallas en unidades posteriores de la cadena.

- Archivos: `components/inventory/inventory-selectors.tsx`, `tests/inventory-selectors.test.ts`.
- Reutiliza `ProductCombobox`; no cambia APIs, auth, dominio ni persistencia.
- Incluye validación de respuestas, etiquetas, selección de variante invalidable, descarte de resultados obsoletos y opción de ubicación desconocida sin diferencia de hidratación durante carga.
- RED histórico: módulo inexistente; correcciones posteriores pinneadas con unit y navegador.
- Comprobación del padre tras separación: 29/29 tests focalizados (5 archivos), 3.30 s; esta unidad contiene 11 pruebas de primitivas.
- Navegador correctivo observado antes de separar archivos: 13/13 en 92 s (incluye las integraciones posteriores y promoción).
- Límites: esta unidad no integra aún los controles en pantallas; ver brief `odd/tasks/inventory-readable-selectors.md` al cierre de la cadena.
- SUPUESTO: lote opcional sin cambios; selección basada en contratos existentes.

Risk: none (módulo nuevo todavía sin consumidores de producción en este slice).
