# Brief — Completitud operativa, Ola 4: recepción, alertas e intake

**Repo:** `C:\Users\Usuario\Documents\trabajos\supermercado` · **Base:**
`c4c1a9e` · **Árbol:** congelar antes de implementar · **Único escritor:** sí

## Objetivo y alcance

Completar la interfaz administrativa para los contratos verificados de la Ola
3:

- historial y alta de recepciones;
- alertas de inventario;
- bandeja, detalle y revisión de `UNVERIFIED_INTAKE`.

La interfaz debe reutilizar el shell, permisos y componentes existentes, sin
crear endpoints nuevos ni duplicar reglas de stock/intake en el navegador.

Puede tocar:

- `app/admin/inventory/**`
- `components/**`
- `tests/**`
- `.github/web-dev-loop/reports/`
- `components/admin-navigation.ts`

No puede tocar:

- `prisma/**`
- `app/api/**`
- `src/server/**`
- `src/domain/**`
- `DOMAIN_RULES.md`
- `DECISIONS.md`
- `REUSABLE_RETAIL_SYSTEM_CONTEXT.md`
- ajustes administrativos independientes;
- nuevos roles, permisos o semántica de negocio.

Migraciones: no.

## Rutas esperadas

- `/admin/inventory/receipts`
- `/admin/inventory/alerts`
- `/admin/inventory/intakes`
- `/admin/inventory/intakes/[id]`

Si una operación no puede completarse con las rutas de Ola 3, debe mostrarse
como no disponible/documentada; no se agrega una mutación alternativa.

## Aceptación e invariantes

1. Las pantallas sólo aparecen a roles con permisos server-side; el servidor
   continúa siendo la autoridad.
2. Recepciones muestran historial y formulario con Decimal/cantidad, ubicación,
   variante, lote y motivo; el idempotency key no se edita ni se muestra como
   requisito técnico.
3. La UI no calcula stock ni permite ajustes independientes.
4. Alertas muestran antigüedad, cantidad, umbral y cajero sin exponer secretos.
5. Intake muestra estado, venta/caja, variante, cantidad y trazabilidad.
6. Revisión exige decisión y motivo; `CORRECTED` exige cantidad; `CONFIRMED`
   exige costo o reconocimiento explícito de costo desconocido.
7. El creador ve el estado, pero no puede revisar su propio caso; el servidor
   debe rechazarlo y la UI debe conservar el formulario ante error.
8. Casos resueltos son de sólo lectura.
9. Se manejan loading, empty, error/retry, 401, 403, 404, 409 y red caída.
10. Las mutaciones no se reintentan automáticamente de forma que dupliquen
    efectos; se informa el resultado server-side.
11. Desktop/tablet, teclado, foco visible y targets táctiles ≥44 px.
12. Respuestas JSON se validan con guards/Zod suficientes para mostrar errores
    controlados.

## Pruebas adversariales

- rol sin permiso y sesión expirada;
- branch/tenant ajeno;
- cantidad fraccionaria inválida y Decimal fuera de rango;
- doble submit y conflicto 409;
- intake creado por el mismo usuario;
- intake ya resuelto;
- decisión sin motivo/cantidad/costo requerido;
- respuesta API incompleta o malformada;
- tablet de 768 px y navegación sin mouse;
- error de red durante recepción o revisión sin perder datos.

## Gates y entregables

| Gate | Comando | Resultado esperado |
|---|---|---|
| Tests focalizados | `npm.cmd test -- tests/*inventory* tests/*operational*` | 0 fallos; informar pasados/total |
| Typecheck | `npm.cmd run typecheck` | exit 0 |
| Lint | `npm.cmd run lint` | 0 errores y 0 warnings nuevos |
| Build | `npm.cmd run build` | exit 0 |
| E2E | `npm.cmd run test:e2e` | 0 fallos; informar omitidos |
| Higiene | `git diff --check` | sin salida |

Informe: `.github/web-dev-loop/reports/operational-ui-completeness-wave4.md`.

No hacer commit, push ni reset destructivo durante la ronda. El orquestador
commitea sólo después del gate y revisión adversarial.
