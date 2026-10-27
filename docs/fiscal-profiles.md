# Perfil tributario argentino — Épica 3

## Quick path

1. Un administrador autenticado configura el perfil del **Store** (razón social):
   `MONOTRIBUTO` o `RESPONSABLE_INSCRIPTO`, con ticket interno requerido
   (`internalTicket = true`, alcance internal-ticket-only).
2. Una venta del Store toma el snapshot fiscal versionado **1** dentro de la
   misma transacción de venta, desde el perfil persistido.
3. El resultado de la venta (`{ id, type, total, currency }`) no cambia.

## Detalles

| Tema | Decisión |
|---|---|
| Alcance país | Solo Argentina (`AR`). Sin otros países en esta épica. |
| Regímenes | `MONOTRIBUTO` y `RESPONSABLE_INSCRIPTO`. Sin régimen «pendiente» ni valor por defecto. |
| Nivel de configuración | Un perfil por `Store` (razón social), con FK compuesta tenant/store. |
| Permisos | `fiscal.profile.manage` (ADMIN) y `fiscal.profile.read` (ADMIN, STOCK_MANAGER). |
| Snapshot | Versión `1`: `storeId`, `storeName`, `country`, `condition`, `internalTicket` (literal `true`). |
| Ventas legacy | Store sin perfil: sin snapshot ni condición fabricada; comportamiento previo. |
| Límites | No se inventan tasas IVA, CUIT, ARCA, numeración ni emisión fiscal. |

## Checklist

- [x] Perfil por Store con las dos condiciones aprobadas.
- [x] Configuración ADMIN-only con auditoría y RLS.
- [x] Snapshot v1 creado en la transacción de venta.
- [x] Ventas legacy sin perfil conservan su comportamiento.
- [x] Migración nueva y aditiva; sin backfill fiscal.

## Siguiente paso

El gate de verificación (`GATES.md`) y el informe de la ola:
`.github/web-dev-loop/reports/epica-3-tax-profiles.md`.
