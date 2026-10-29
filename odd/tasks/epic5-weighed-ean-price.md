# Épica 5 — Códigos pesables EAN-13 con precio
Rama: `feat/pos-offline` (follow-up cut; branch before implementation if required by delivery policy).
Scope: first Epic 5 cut only; no physical scale, fiscal issuance, printing, or promotions implementation.

## Specs

S1. «Códigos pesables» es el primer corte de Épica 5.

S2. «EAN-13 con precio» es el formato inicial soportado.

S3. «2x1 / NxM» queda registrado como la prioridad promocional futura, pero no forma parte de este corte.

S4. El parser EAN-13 debe validar longitud, prefijo configurable por tenant, layout, dígito verificador y precio incrustado con precisión decimal; no depende de hardware físico. El layout inicial es «prefijo 20 + SKU 5 dígitos + precio 5 dígitos + dígito de control», con escala 2.

S5. El precio incrustado se usa como precio unitario y el servidor lo valida contra el precio vigente. Debe resolver una variante del catálogo dentro del tenant y producir una línea POS server-validable; el servidor conserva el precio/regla de origen y no acepta un tenant enviado por el cliente.

S6. El código inválido, prefijo no configurado, variante inexistente o precio inválido debe rechazarse sin crear venta, movimiento, pago ni comando parcial.

## Tasks

T1 | S1,S2,S4 | inline | done | Definir contrato y configuración tenant-scoped para EAN-13 con precio; commit: c0d35ff.
T2 | S4,S5,S6 | worker | done | Integrar parseo/resolución server-side con catálogo/POS; commit: 0b0c732.
T3 | S4,S5,S6 | worker/parent | done | Agregar pruebas públicas, negativas, tenant/RLS, precisión e idempotencia; actualizar docs y gates; commit: 62faa30.
T4 | S1-S6 | orchestrator | done | Ejecutar gates, documentar evidencia y cerrar el primer corte; commit: 62faa30.

T5 | S4,S5,S6 | parent | done | Diagnosticar runner Windows/WSL y RLS de forma aislada con plazo externo; commit: not applicable (diagnosis).

T6 | S1-S6 | orchestrator | done | Separar commits locales y delimitar candidato de revisión nativa; commits c0d35ff, 0b0c732, 62faa30; native assess executed, item-2 escalation independently verified, native review not due under returned plan; sin push/PR.

## Log

L1. Dueño: priorizó «Códigos pesables» como primer corte de Épica 5, eligió «EAN-13 con precio» como formato inicial y dejó «2x1 / NxM» como prioridad promocional futura.
L2. El parser puro existente (`src/domain/ean13.ts`) ya contempla modo `PRICE`; este corte agrega configuración/integración tenant-scoped sin hardware físico.
L3. Dueño: eligió layout inicial «prefijo 20 + SKU 5 dígitos + precio 5 dígitos + dígito de control», escala 2, y que el precio incrustado se use como precio unitario validado por el servidor.
L4. Retomá Épica 5 desde odd/tasks/epic5-weighed-ean-price.md y su memoria. El contrato aprobado es EAN-13 con
 │ prefijo 20, SKU de 5 dígitos, precio de 5 dígitos, control y escala 2. El importe es precio unitario validado
 │ contra el vigente. La implementación está parcial: completá checkout y POS, preservá los cambios heredados y
 │ verificá antes de cerrar. No hagas push.
L5. Resume reconciliation: T1 exists and baseline domain tests pass (12/12). T2 incomplete; checkout ignores multiline unitPrice by existing contract, POS discards scan price and intercepts ordinary EANs. Preserve legacy unmarked multiline price-hint behavior; introduce optional weighedBarcode provenance for authoritative parsing and current-price validation in the sale transaction. Persist source on SaleLine without editing applied migrations. Risk: item 2 (tenant/config permission boundaries); item 3 (shared checkout/POS contracts).
L6. Environment: use cmd.exe /d /c npm for Windows node_modules (Linux Vitest cannot load native bindings). Disposable existing database: supermercado_fiscal_gate on loopback port 55449, postgres owner and supermercado_gate_runtime / supermercado_gate_auth trust roles. Never read real .env files. Exploration subagent unavailable. No changes to dependencies needed.
L7. que paso con el agente? porque se quedo trabado en 11 millones de tokens y no vi que avance en nada mas, por eso lo detuve, podrias ver hasta donde llego y que continue?
L8. The cancelled writer left implementation and applied both additive EAN migrations, but no final evidence. Fresh bounded writer completed residual fixes (no repeated implementation): 34/34 focused tests, typecheck/lint exit0 reported. Parent observed typecheck0 and applied migration state. Full coverage, ledger and browser checks running in job-1. Native assessment unavailable due intended-untracked declaration; named item2 escalation requires independent verification. Global raw diff hygiene includes extensive inherited CRLF noise, preserved rather than normalized. No commits/push.

L9. Independent verifier: S1-S6 MET, no blockers; domain 13/13. Prisma validate exit0; audit 0 vulnerabilities. Full coverage first run: 191 passed / 2 failed (193 total), 322.92s; generic RLS fixture missed WeighedBarcodeConfig and hit 5s timeout. Added public config upsert to populated fixture; focused RLS then 1 passed / 2 timed out at 5s, 14.38s. Exhaustive real-PostgreSQL probes now have explicit 20s timeouts without weakening assertions. Final pipeline job-3 running coverage, ledger, E2E, build. Raw diff check inherited CRLF diagnostics 12173; CRLF-aware check exit0. No closure/commit/push while final gates pending.
L10. segui

L11. Final job-3 exited1: 191/193 tests passed, two RLS timeouts (20000ms cross-tenant insert/mutation probe; 5000ms ledger/audit append-only probe), 33151.98s elapsed. Elapsed time alone does not establish suspension or runner/database stall. Coverage percentages not established. Ledger, E2E and build never started because coverage failed before the && continuations. Report: .github/web-dev-loop/reports/epica-5-weighed-ean-price.md. T3/T4 BLOCKED awaiting explicit decision on a separate bounded runner/RLS diagnosis; no further blind reruns, no completion claim, commit or push. Risk items2 and3 remain. Implementation T2 done is not final acceptance.

L12. ok te autorizo, hablame en español la proxima
L13. Authorized bounded diagnosis: job-4 runs only rls-boundaries.test.ts using Windows Node directly, captures PostgreSQL connection/session/blocker timings and runner exit, with a 90s Windows task-tree termination watchdog. No full suite, no source changes, no dependency installation, no push. T3/T4 now wait by ordering on T5, not on human authorization.

L14. Bounded diagnosis results: job-4 exit0; RLS3/3 in8.83s, DB connection29ms,0blocking sessions at initial snapshot. Job-5 same RLS tests withcoverage3/3 in9.56s; process exits1 only because one-file diagnostic coverage does not meet whole-project thresholds (no thresholds changed). No prolonged stall reproduced and historical9h12m cause remains unknown. T5 done as bounded diagnosis, not proof of historical root cause or final gate. Resume pending browser/gates separately with explicit external process deadlines.

L15. Job-6 Playwright11/11 passed in21.3s, exit0 (Windows wrapper22287ms,180s watchdog unused). EAN checkout mocked-browser payload, suggestion selection, F4/F10, ordinary checkout provenance omission and barcode fallback passed; identity E2E also ran. No claim that mocked EAN checkout is an authenticated end-to-end backend sale. T3 done; T4 running fullcoverage with420s external watchdog (job-7), then ledger/build pending.

L16. Job-8 production build exit0 in29978ms (180s watchdog unused). Parent npm run db:generate exit0, Prisma Client7.10.1 generated in1.17s. Full coverage job-7 still pending; no polling/replay, ledger waits for suite completion.

L17. Full coverage job-7 exit0:193/193 tests,29/29 files,187.85s; lines93.89%,branches84.29%,statements/functions88.88%; configured domain thresholds pass. Concurrency20/20 rounds of20sales included. Job-9 clean DB supermercado_epic5_810501fd_gate:22/22 migrations applied,37/37 focused tests in20.07s,ledger0divergences,RLS36/36;exit0,27493ms. Reused demo DB separately reports1divergence for known demo variant56a1c105-6a4b-44ca-81dc-b76aa1bd7c04 (ledger2/onHand5/reserved0);cause not established,data untouched.
L18. Differential job-10:3/3 public single/multiline/paid sale and idempotent replay comparisons against baselineHEAD passed4.36s;exit0. Scratch copy created with in-project mktemp/gitarchive and ephemeral test removed; post-probe ledger0divergences,RLS36/36. T4 functional checks/report done. User chose recommended feature-branch chain: c0d35ff configuration/parser, 0b0c732 checkout/trazabilidad, 62faa30 POS/docs/report. Native assess on committed candidate returned medium/under_budget; item-2 escalation returned high plan with independent verifier, already satisfied by read-only S1-S6 verification. Native review was not due under the returned plan; no native approval or push/PR is claimed.
