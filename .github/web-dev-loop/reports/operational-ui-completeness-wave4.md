# Informe — Completitud operativa, Ola 4

Estado: ENTREGADO: se implementaron las cuatro rutas UI sobre los contratos de
la Ola 3, sin modificar APIs, servidor, dominio, schema ni migraciones.

## Archivos

- `app/admin/inventory/receipts/page.tsx`
- `app/admin/inventory/alerts/page.tsx`
- `app/admin/inventory/intakes/page.tsx`
- `app/admin/inventory/intakes/[id]/page.tsx`
- `components/inventory/inventory-ui.tsx`
- `components/inventory/inventory-ui.module.css`
- `components/admin-navigation.ts`

La UI genera la clave técnica de idempotencia sin mostrarla, conserva formularios
ante errores de red/servidor, muestra valores Decimal como strings del servidor,
valida la forma básica de respuestas, y representa estados de carga, vacío,
error/retry, 401, 403, 404, 409, red caída y casos resueltos de sólo lectura.
La autorización efectiva continúa en los endpoints server-side.

## Gates

- Tests focalizados (`operational-inventory-contracts` + UI):
  **7/7 pasaron**, 0 fallos, 0.92 s.
- Typecheck: **exit 0**, 0 errores.
- Lint: **exit 0**, 0 errores, 0 warnings.
- Build: **exit 0**, compilación correcta, **27/27 páginas** generadas;
  las cuatro rutas nuevas aparecen en el manifiesto.
- `git diff --check`: **exit 0**, sin salida.
- E2E: **NO EJECUTADO** en esta ronda; no se inició servidor autenticado ni se
  dispuso de una sesión/fixture de navegador utilizable.
- PostgreSQL/ledger/concurrencia/RLS: **NO EJECUTADOS**; esta ola no modifica
  persistencia y el entorno no aporta URLs válidas de base.

## Desvíos y supuestos

- No se agregó flujo de ajustes independiente: sigue bloqueado por la Ola 3.
- Los campos de ubicación y variante usan UUID ingresados por el operador,
  porque la Ola 3 no expone un endpoint de catálogo/location para esta pantalla.
- `SUPUESTO:` el servidor continúa siendo la fuente de verdad para permisos,
  nombres, cantidades, costos y conflictos; la UI no calcula stock.

Sin commit ni push. El árbol queda intencionalmente sin commit para el gate y
la revisión adversarial posteriores.

## Remediación W4-SEC-001 — idempotencia de reintento (2026-11-01)

Estado: ENTREGADO: la recepción crea su clave técnica al iniciar el formulario,
la conserva para reintentos con los mismos datos, y sólo la rota al cambiar un
dato o después de una respuesta exitosa. La clave no se renderiza ni cambia el
contrato HTTP/API o el dominio; los datos ingresados permanecen en el formulario
ante fallos de red o respuestas no exitosas.

### RED/GREEN

- RED: la regresión nueva falló **1/3 tests**, porque las funciones de ciclo de
  vida de la clave aún no existían.
- GREEN focalizado: **14/14 tests pasaron**, 2 archivos, 3.75 s.
- GREEN regresión aislada: **3/3 tests pasaron**, 0 fallos, 0.49 s.
- Typecheck: **exit 0**, 0 errores.
- Lint: **exit 0**, 0 errores, 0 warnings.
- Build: **exit 0**, compilación correcta, **27/27 páginas** generadas.
- `git diff --check`: **exit 0**, sin salida.

### Auditoría

**W4-SEC-001: VERDE.** El retry reutiliza el mismo `idempotencyKey` y no crea
una nueva orden; el cambio de datos y el reset post-éxito generan una nueva
clave. No se expone el valor técnico y no se alteraron APIs, dominio ni
persistencia. E2E, PostgreSQL, ledger y concurrencia permanecen sin ejecutar en
esta remediación por las limitaciones documentadas de la ola.

Sin commit ni push.
