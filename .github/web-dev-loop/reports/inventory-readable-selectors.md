# Cierre — Selectores legibles de inventario y recepciones

Estado: ENTREGADO: controles legibles, regresiones verificadas y entorno temporal apagado. Sin push, PR, merge ni despliegue.

## Alcance y archivos
- `components/inventory/inventory-selectors.tsx`: contexto y catálogo validados, ubicación por nombre/código, variante por SKU/nombre, resultados obsoletos descartados.
- `components/inventory/inventory-ui.tsx`: recepción con selección obligatoria; conserva Decimal/string, formulario y clave de reintento.
- `components/operational-read/operational-read.tsx` y CSS: filtros de inventario, fallback sin UUID editable, selección incompleta rechazada y botones nuevos ≥44px.
- `tests/inventory-selectors.test.ts`, `tests/inventory-selector-styles.test.ts`: primitivas, errores, SSR y estilos.
- `tests/e2e/{inventory-selectors,receipts-selectors}.spec.ts`, `tests/e2e/helpers/inventory-selectors.ts`: autenticación real con datos sintéticos, mocks de datos UI, teclado, reintento, URL e hidratación.
- `tests/e2e/promotions-admin.spec.ts`: espera explícita de DELETE200 antes de afirmar estado inactivo; sin cambios de producto.
- Brief y tres informes de la cadena en `odd/tasks/` y `.github/web-dev-loop/reports/`.

## Verificación observada
| Check | Resultado |
|---|---|
| Setup local + PostgreSQL18 aislado | exit0, 88s; ninguna instalación global |
| Prisma generate / migraciones desde cero / roles | exit0, 14s; 2 roles sin superuser/BYPASSRLS/CREATEDB/CREATEROLE |
| db:validate y lint completo | exit0 |
| RED B1/B2 navegador | 3 fallos esperados, 48s |
| RED B2 unit | 1 fallo esperado / 11 omitidos por filtro |
| Focalizadas finales tras separación | 29/29, 5 archivos, 3.30s |
| E2E final `--workers=1` (job36) | 48/48, 0 omitidas, 3.3min |
| Cobertura final `--maxWorkers=1` (job36) | 413/413, 66 archivos, 161.63s |
| Cobertura global | statements88.74%, ramas82.06%, funciones88.43%, líneas92.85% |
| Cobertura dominio | líneas98%, ramas92.64% |
| Ledger y RLS tras batería final | 0 divergencias; 43/43 tablas habilitadas y forzadas |
| Concurrencia (job35) | 22/22, 43.28s |
| Build/typecheck/lint posterior a corrección (job35) | exit0 los tres; secuencia completa294s |
| Auditoría dependencias | exit0; 0 altas/críticas, 16 moderadas preexistentes |
| Diferencial SSR base/candidato | 8/8 iguales; suites hermanas27/27 en cada versión; exits0 |
| Verificador independiente y recheck | B1/B2 resueltos; evidencia browser posterior confirma ambas correcciones |
| Teardown | exit0; datos/binarios/paquetes DB retirados, puertos55449/3109 cerrados |
| git diff --check | exit0 |

El diferencial usa copia temporal de la base8d55d55 y clases CSS Vitest non-scoped para no confundir hashes dependientes de ruta con diferencias de comportamiento. No se comprometieron scripts que lean Git ni datos de DB.

## Fallos previos y correcciones
- Build inicial no resolvía Next desde node_modules del ancestro: resuelto con dependencias locales.
- Verificador inicialmente fallaba sin informe; el dueño cambió modelo y autorizó nuevo intento. La revisión posterior sí se completó.
- B1: texto de variante sin selección era ignorado; ahora alerta y no consulta. B2: botones nuevos40px; ahora44px solo en chips, sin modificar botones hermanos.
- Hidratación con ubicación URL desconocida: opción diferida hasta fin de carga; prueba navegador sin errores.
- Primera cobertura410/411: timeout en supervisor bajo ejecuciones simultáneas. Corrida serial final413/413 sin cambiar timeout ni test.
- Primer E2E completo46/48: locator de alerta ambiguo por anunciador Next y promoción aún Desactivando; se precisaron locator y espera HTTP. Corrida final48/48.
- Primer diferencial falló por directorio/raíz del runner y luego hashes CSS; resolución explícita y estrategia non-scoped produjeron8/8.

## Entrega encadenada local
Tracker `feature/inventory-readable-selectors` en8d55d55; hijo1 `feat/inventory-selector-primitives` (fd5c1b6,499 líneas); hijo2 `feat/inventory-receipt-selectors` (7812cf8,232 líneas); hijo3 `feat/inventory-readable-selectors` contiene filtros y cierre.
La primera unidad supera la referencia400 líneas porque conserva primitivas y sus pruebas juntas; no se minificó ni se quitaron tests. ASSESS nativo de las primeras dos unidades: medium, reviewDue=false; no se afirma review nativo ejecutado.

## Límites y decisiones
SUPUESTO: lote opcional e identificadores históricos quedan sin cambios; no hay búsqueda nueva de lotes.
No se alteraron API, auth, permisos, esquema ni ajustes manuales. Las dependencias npm locales permanecen instaladas, sin servicios activos.
Rendimiento con ejecución paralela no se certifica: las baterías finales se serializaron. Las16 vulnerabilidades moderadas quedan fuera de este corte.
Publicación requiere decisión del dueño.

Risk: item 3 (UI compartida con ventas/caja y otras pantallas; verificador independiente, diferencial y regresión completa realizados).
