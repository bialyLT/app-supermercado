# Informe Frontend Audit Wave 3 — Corrección DAT-03, estilos y moneda

**Estado: ENTREGADO:** se corrigieron los tres hallazgos solicitados sin
modificar contratos server-side, Prisma, APIs, auth, dominio ni semántica
offline.

## RED/GREEN

- **DAT-03 RED:** la reproducción cubre el instant
  `2026-01-15T02:30:00.000Z`; la representación UTC con `toISOString().slice`
  no conserva `23:30` de la sucursal argentina.
- **DAT-03 GREEN:** `formatDateTimeLocal` muestra `2026-01-14T23:30` y
  `parseDateTimeLocal` devuelve el mismo ISO UTC al confirmar el input.
- **Moneda RED/GREEN:** se actualizaron las aserciones heredadas que esperaban
  `154200.50 ARS`; ahora verifican `$154.200,50` para `es-AR`, `US$10,00`
  para USD en `es-AR` y `$1,234,567.50` para USD en `en-US`. El focused test
  final pasó **9/9**.
- **Estilos:** `transfer-form.tsx` quedó sin `style={{...}}` ni hex inline;
  las reglas se trasladaron a `transfers.module.css`, conservando clases de
  foco, estados, targets y layout responsive.

## Archivos de esta corrección

- `src/client/presentation.ts`
- `components/reports/report-filters.tsx`
- `components/transfers/transfer-form.tsx`
- `components/transfers/transfers.module.css`
- `tests/presentation.test.ts`
- `tests/reports-ui.test.ts`

Los demás archivos modificados del árbol ya pertenecían a la ola Wave 3
existente y se conservaron; no se hizo commit ni push.

## Gates

| Gate | Resultado |
|---|---|
| Focused tests | **9/9 pasaron**, 2 archivos |
| `npm.cmd run typecheck` | **exit 0**, 0 errores |
| `npm.cmd run lint` | **exit 0**, 0 errores, 0 warnings |
| `npm.cmd test` | **370/370 pasaron**, 59 archivos pasaron |
| `npm.cmd run test:coverage` con PostgreSQL | **exit 0**: 92.55% líneas, 88.22% statements, 81.77% ramas, 87.32% funciones |
| PostgreSQL coverage gate | **OK**: `supermercado_gate` disponible en localhost:5432 |
| `npm.cmd run build` | **exit 0**, 20 páginas generadas |
| `npm.cmd run test:e2e` | **8 pasaron, 28 skipped, 0 fallos / 36** |
| `npm.cmd audit --audit-level=high` | **exit 0**; 0 vulnerabilidades altas/críticas, 16 moderadas preexistentes |
| `npm.cmd run db:generate` | **exit 0**, Prisma Client generado |
| `npm.cmd run db:validate` | **exit 0**, schema válido |
| `git diff --check` | **exit 0**, sin salida |

La cobertura global no alcanza el umbral de `GATES.md` porque las suites de
integración/repository quedan omitidas sin PostgreSQL; no se simula un gate
verde.

## Invariantes y decisiones

- `datetime-local` se convierte únicamente en la capa de presentación con la
  zona `America/Argentina/Buenos_Aires`; los timestamps ISO y payloads no se
  mutan fuera del contrato.
- Los importes continúan siendo `string` + `Decimal`; el agrupamiento y los
  separadores se resuelven según `locale`/`currency`, sin conversión a
  `number`.
- **SUPUESTO:** la sucursal continúa usando la zona argentina aprobada por las
  decisiones vigentes; no hay una configuración de zona por sucursal en el
  contrato actual.
- No se tocaron schema/migrations, endpoints, autorización, reglas de dominio
  ni offline.
- **Desvío documental:** no existe un brief Wave 3 separado bajo
  `.github/web-dev-loop/briefs/`; se tomó como contexto el informe Wave 3
  existente y las instrucciones obligatorias del repositorio.

**ENTREGADO:** cambios verificados con PostgreSQL y listos para commit; no se
hizo push.
