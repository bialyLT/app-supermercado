# Brief — Completitud operativa, Ola 2: consultas de stock, ventas y caja

**Repo:** `C:\Users\Usuario\Documents\trabajos\supermercado` · **Base:**
`57a11fd` · **Árbol:** congelar antes de implementar · **Único escritor:** sí

## Objetivo y alcance

Construir las primeras pantallas administrativas sobre los contratos
read-only entregados en la Ola 1:

- existencias por ubicación, variante y lote;
- movimientos del ledger;
- historial y detalle de ventas;
- historial de turnos, arqueos y movimientos de caja.

Las pantallas deben integrarse al shell existente, ser role-aware, responsive,
keyboard-first y conservar los estados de carga, vacío, error, retry y
forbidden.

Puede tocar:

- `app/admin/`
- `components/`
- `src/client/` sólo helpers de transporte o presentación
- `tests/`
- `.github/web-dev-loop/reports/`

No puede tocar:

- `prisma/schema.prisma`
- `prisma/migrations/`
- `DOMAIN_RULES.md`
- `DECISIONS.md`
- `REUSABLE_RETAIL_SYSTEM_CONTEXT.md`
- contratos backend de la Ola 1 salvo corrección bloqueante reproducida
- semántica de ventas, caja, stock, offline o reversión
- producción, despliegue o proveedores

Migraciones: no.

## Rutas esperadas

- `/admin/inventory` para existencias y movimientos.
- `/admin/sales` para listado y detalle de ventas.
- `/admin/cash-shifts/history` para turnos y movimientos históricos.

Si una ruta requiere un contrato que no existe, debe quedar documentada como
`API-only`; no se agrega endpoint desde esta ola.

## Aceptación e invariantes

1. Cada ruta tiene navegación role-aware y no aparece para roles sin permiso.
2. Los listados consumen exclusivamente las rutas server-scoped de la Ola 1.
3. La UI no acepta ni envía `tenantId` como autoridad.
4. Los filtros de sucursal, ubicación, variante y fechas se validan y
   conservan al reintentar o navegar al detalle.
5. Dinero y cantidades se muestran como strings Decimal y nunca se convierten
   en `number` de dominio.
6. La UI no muta movimientos, snapshots de venta ni cierres históricos.
7. El detalle de venta muestra líneas, pagos, total, estado y snapshot sin
   recalcular el total.
8. La caja muestra apertura, cierre, diferencia y movimientos sin inventar
   valores ausentes.
9. Cada pantalla funciona con teclado, tiene foco visible y no requiere
   mouse para su acción principal.
10. En escritorio y tablet no hay overflow horizontal para acciones primarias.
11. Se cubren loading, empty, error/retry, 401, 403, 404 y red caída.
12. No se exponen secretos, hashes, PII innecesaria ni UUIDs crudos como
   interfaz principal cuando existe una etiqueta legible.

## Ataques

- Rol CASHIER intentando acceder a rutas administrativas.
- Cambio de branch/location/variant en query y respuesta vacía o 403 sin fuga.
- Venta inexistente o de otra sucursal presentada como 404.
- Respuesta con Decimal `"0.000"` y valores negativos de movimiento mostrados
  sin pérdida de precisión.
- Fecha inválida, rango invertido y límite fuera de 1–100.
- Respuesta 401/403/404/500 y pérdida de red durante carga.
- Tablet de 768 px y navegación completa sin mouse.
- Repetir navegación y retry sin duplicar solicitudes mutantes (no hay
  mutaciones en esta ola).

## Tests y gates

El escritor debe agregar pruebas focalizadas por pantalla y reusar los helpers
existentes. Ejecutar:

| Gate | Comando | Resultado esperado |
|---|---|---|
| Tests focalizados | `npm.cmd test -- tests/*operational* tests/*inventory* tests/*reports*` | 0 fallos; informar pasados/total |
| Typecheck | `npm.cmd run typecheck` | exit 0 |
| Lint | `npm.cmd run lint` | 0 errores y 0 warnings nuevos |
| Build | `npm.cmd run build` | exit 0 |
| Higiene | `git diff --check` | sin salida |

El informe debe indicar qué gates completos quedaron para el cierre de fase.
No hacer commit, push ni reset destructivo durante la ronda.

## Entregables

- pantallas y componentes de las tres superficies;
- navegación y estados coherentes;
- pruebas focalizadas;
- `.github/web-dev-loop/reports/operational-ui-completeness-wave2.md`;
- respuesta final `ENTREGADO:` o `BLOQUEADO:`.

## Bloqueos conocidos

- Ajustes de inventario, recepción genérica, alertas e `UNVERIFIED_INTAKE`
  siguen fuera de esta ola por falta de contratos administrativos seguros.
- Anulaciones/devoluciones no se agregan a la UI hasta que exista una consulta
  administrativa de ventas suficiente para seleccionar el documento.

No hacer commit ni push. La rama y el commit quedan a cargo del orquestador
después del gate.
