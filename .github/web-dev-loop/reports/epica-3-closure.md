ENTREGADO: cierre formal de Épica 3 (backend de ventas, caja y pagos). W1 ventas multilínea, W2 pagos manuales exactos combinables, W3a movimientos y cierre ciego, W3b anulaciones/devoluciones append-only y W4 numeración por sucursal y tipo con cierre documental, más fix de E2E del mapeo 401/400. Sin UI, offline, PSP ni emisión fiscal. Pendiente de entrega: push de `feat/sales-cash_payments` + PR (el dueño los hace desde su Windows).

Cadena de commits (rama `feat/sales-cash_payments`):
- 29e560c feat(sales): ventas multilínea atómicas server-priced + 30c050e fix approved expired-lot.
- 37f92d7 feat(payments): pagos manuales exactos combinables.
- 739543c feat(cash): movimientos y cierre ciego (migración 20261026214000, CHECK legacy sin backfill).
- b861469 feat(reversals): anulaciones/devoluciones append-only (migración 20261026215000).
- 160f72d feat(numbering): numeración atómica + cierre documental (migraciones 20261026216000 y correctiva 20261026216200).
- Base fiscal previa: 490045e (perfiles AR + snapshot inmutable).
- Informes: epica-3-tax-profiles.md, epica-3-sales-w1/w2/w3a/w3b/w4.md y este cierre.

Fix E2E post-W4 (NUEVO, sin commitear — va en el próximo corte del dueño):
- `app/api/admin/settings/route.ts`: el parseo del body y el auth compartían un `try`; sin `DATABASE_URL` en el webServer de Playwright, el `ZodError` de `databaseUrl()` se mapeaba a 400 en vez de 401. Ahora la validación del body (400) está separada del auth (401/403).
- `src/auth/session.ts`: `serverContext()` atrapa backend de auth caído y devuelve `null` (anónimo) para todas las rutas.
- Ambos archivos normalizados a LF como los blobs; `git diff --check` limpio en esas superficies.

Gates finales observados (disposable PostgreSQL 127.0.0.1:55449, runner Windows cmd por binding Rolldown ausente en Linux):
- `db:generate` / `db:validate`: exit 0.
- `db:migrate` (deploy): exit 0, 19 migraciones, sin pendientes.
- `typecheck`: 0 errores. `lint`: 0 errores/warnings.
- `test:coverage`: 27 archivos, 174/174 tests, thresholds globales cumplidos (dominio 80–100 % líneas; `server/audit.ts` y `server/catalog.ts` en 0 % por ser módulos sin uso en este alcance).
- `build`: exit 0 (6 rutas, 4 dinámicas).
- `test:e2e`: 3 passed / 2 skipped / 0 failed (los 2 skips son `identity-security`, con gate de roles DB por diseño).
- `audit --audit-level=high`: 0 vulnerabilidades.
- `test:ledger`: 0 divergencias; RLS 34/34 tablas con tenantId, forzado.
- Concurrencia: 20 rondas × 20 ventas + idempotencia (22 tests) verdes.
- `git diff --check`: limpio en superficies tocadas; a nivel worktree hay ruido CRLF heredado en ~62 archivos (preexistente, fuera de alcance).

Desvíos/runtime:
- Primera corrida de cobertura: 173/174 por 1 flake en `epic2-concurrency` bajo 27 workers (275 s en ese archivo); en aislado 22/22 y en repetición limpia 174/174. Sin relación con el fix (código de Épica 2 no tocado).
- Queda un `unhandledRejection ZodError` decorativo en el log del dev-server durante el e2e (internos de better-auth contra el proxy lazy sin DB); la respuesta HTTP es correcta y el exit code verde.
- La suite requiere roles separados: `TEST_DATABASE_URL` con owner, `DATABASE_URL` con `supermercado_gate_runtime`, `AUTH_DATABASE_URL` con `supermercado_gate_auth` (vía `test:db:setup`); con superuser en `DATABASE_URL` falla `UNSAFE_DATABASE_ROLE` por diseño.
- `set VAR=v&&` sin espacio previo en cmd (el espacio contamina el valor). Sin commit/push desde este entorno (sin credenciales GitHub).

SUPUESTOS heredados: cuadre excluye OPENING/CLOSING_COUNT; moneda del cierre única (CURRENCY_MISMATCH si difiere); sin vuelto/sobrepago (D-016); allocator con UPDATE directo monotónico, endurecimiento EXECUTE-only diferido.
Decisiones requeridas: D-016 (vuelto/sobrepago) antes de cobrar en Épica 4; D-008 (offline) bloquea Épica 4; D-012 sigue PROPUESTA aunque ya se ejerce en W4 (falta aprobación formal); push + PR los hace el dueño.

Risk: item 1 (stored payment/cash/sequence data ya cubierto por RLS forzado, grants mínimos y triggers append-only en cada work unit); el fix E2E no toca datos: mapea errores a 401 sin filtrar detalle.

## Key Learnings
- No mezclar validación de entrada y auth en un mismo `try` cuando ambos pueden tirar `ZodError`: el error de config se disfraza de input inválido.
- Sin DB en el server E2E, el auth debe degradar a anónimo (401), nunca a 400/500.
- Cobertura exige roles separados owner/runtime/auth; documentarlo evitó un ciclo entero de 115 fallos `UNSAFE_DATABASE_ROLE`.
- `git diff --check` con CRLF heredado: chequear higiene solo sobre superficies tocadas hasta que se normalice el árbol.
