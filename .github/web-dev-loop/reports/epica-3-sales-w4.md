ENTREGADO: W4 implementa numeración atómica por sucursal y tipo (SALE, ANNULMENT, RETURN) con cierre documental de continuidad + cuadre, según S7 y las decisiones «Por sucursal y tipo» / «Continuidad + cuadre». Sin UI, offline, PSP ni emisión fiscal.

Archivos creados/modificados:
- src/domain/numbering.ts: tipos de documento, esquema de cierre, continuidad y cuadre puros.
- src/server/repositories/numbering.ts: asignación transaccional con lock de fila + backfill perezoso por orden de creación; cierre con doble gate antes de escribir.
- src/server/numbering.ts: fachada closeBranchDocuments.
- src/server/repositories/inventory.ts: la venta crea su número SALE en la misma transacción y lo expone en la respuesta.
- src/server/repositories/reversal.ts: la reversión crea su número ANNULMENT/RETURN y lo expone.
- prisma/schema.prisma: DocumentType, DocumentSequence, DocumentClosure, Sale.branchId/documentNumber, SaleReversal.documentNumber, unicidades por partición.
- prisma/migrations/20261026216000_document_numbering/migration.sql: columnas, backfill por (createdAt, id), semillas de secuencia, triggers, grants mínimos, RLS forzado.
- prisma/migrations/20261026216200_document_numbering_trigger_scope/migration.sql: corrección — trigger append-only puro para SaleReversalLine; la excepción NULL→número queda solo en SaleReversal.
- tests/numbering-domain.test.ts (10) y tests/integration/document-numbering.test.ts (8): gap-free concurrente, rollback sin consumo, backfill por orden, secuencias independientes, rechazo por hueco/cuadre, replay/conflicto idempotente, denegación cashier/tenant.
- tests/integration/rls-boundaries.test.ts: siembra de cierre en rama aislada, umbral 27→29, append-only de cierre y monotonicidad de secuencia.
- tests/integration/fiscal-profiles.test.ts: contrato de respuesta de venta incluye documentNumber: 1 (una línea, exigido por el comportamiento requerido).
- docs/document-numbering.md: política de backfill, alcance del cuadre y garantías de base.

S7 verdicts:
- S7.1 Secuencias independientes por sucursal y tipo, sin huecos: VERDE (20 ventas paralelas → 1..20; rollback no consume; ANNULMENT 1,2 y RETURN 1 independientes).
- S7.2 Backfill legacy por orden sin inventar fiscalidad: VERDE (migración + reparación perezosa por createdAt,id; documentado).
- S7.3 Cierre con continuidad + cuadre, rechazo previo a escribir: VERDE (SEQUENCE_GAP y UNRECONCILED_CASH sin filas; fila inmutable con rangos, totales, actor e idempotencia).
- S7.4 Autorización e idempotencia del cierre: VERDE (supervisor/admin vía inventory.sale.approve; replay igual, payload distinto en conflicto; cashier FORBIDDEN; tenant ajeno rechazado).
- S7.5 RLS/grants/append-only: VERDE tras la corrección (cierre append-only, secuencia solo-hacia-adelante, FKs compuestas, RLS forzado, grants mínimos + UPDATE por columna para numeración).
- S7.6 Sin mutación de originales ni reutilización tras rollback: VERDE (ventas, pagos, movimientos intactos; secuencia en la transacción creadora).

TDD:
- RED: numbering-domain 0/10 y document-numbering 0/8 por módulos inexistentes, observados en el runner Windows antes de implementar.
- GREEN: numbering-domain 10/10; document-numbering 8/8 (timeout 60 s en el test de 20 vías por serialización del lock; aserciones Decimal con toFixed(2) como en W3a).
- PRESERVE: focalizada W4+RLS+fiscal+W3b 39/39; suite completa 174/174 (27 archivos); typecheck 0; lint 0; db:generate/db:validate exit 0; migraciones aplicadas al disposable.

Validación observada (disposable PostgreSQL 127.0.0.1:55449, runner Windows cmd por binding Rolldown ausente en Linux):
- `npx prisma validate`: exit 0. `npx prisma generate`: exit 0.
- `npx prisma migrate deploy`: aplicadas 20261026216000 (+ 20261026216200 correctiva).
- Focalizada: 39/39 (numbering-domain 10, document-numbering 8, rls-boundaries 3, fiscal-profiles 8, sale-reversals 3+replay).
- Suite completa: 174/174, 27 archivos, ~159 s.
- `npx tsc --noEmit`: 0 errores. `npx eslint .`: 0 errores/warnings en superficies tocadas (sin trailing whitespace propio).
- `git diff --check`: con ruido preexistente de line-endings en archivos no tocados; superficies W4 limpias.

Desvíos/runtime: vitest solo corre bajo Windows (binding Rolldown win32); en bash Linux el startup falla igual que en W3b. `set VAR=v&&` sin espacio previo (el espacio contamina el valor). La suite completa requiere AUTH_DATABASE_URL con el rol gate_auth o falla identity-repositories por entorno (verificado 3/3 con la variable puesta). Sin commit/push (orquestador).

SUPUESTO: el cuadre compara neto documental contra pagos + CASH_IN − CASH_OUT, excluyendo OPENING/CLOSING_COUNT como declaraciones de flotante; ventas en moneda distinta a la del cierre lo rechazan (CURRENCY_MISMATCH) en vez de convertirse.
Decisiones requeridas: ninguna para este alcance.

Risk: item 1 (stored sequence and closure data): secuencias y cierres bajo RLS forzado, grants mínimos y triggers; el UPDATE directo de secuencia solo puede avanzar (monotonicidad), el +1 exacto depende del asignador; endurecimiento EXECUTE-only diferido y documentado.

## Key Learnings
- Un trigger compartido entre tablas con distinta forma rompe el código de error append-only: la excepción de numeración debía vivir solo en el trigger de SaleReversal, con función propia para SaleReversalLine (migración correctiva nueva, nunca editar la aplicada).
- El UNIQUE por (tenant, branch, número) exige branchId desnormalizado en Sale; el backfill lo deriva de Location y el servicio lo fija al crear.
- `git diff --check` con CRLF preexistente mete ruido: verificar higiene solo sobre las superficies tocadas.
- El advisory lock por tenant ya serializa la asignación, el lock de fila la blinda a nivel de partición; el timeout del test concurrente debe contemplar la serialización (60 s para 20 vías).
