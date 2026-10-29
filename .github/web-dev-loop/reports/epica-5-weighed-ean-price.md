# Epic 5 — Weighed EAN price verification report

BLOQUEADO: implementation and functional verification complete; local delivery slicing and scoped native review remain unresolved. The reused demo database has a separately reported ledger divergence; it was not modified to make the gate pass.

## Delivered behavior

Approved D-018/D-019 contract: EAN-13 prefix20 + SKU5 + unit-price5 + checksum, scale2. Tenant configuration and barcode resolution are server-side. Checkout reparses the original barcode inside the sale transaction, checks the resolved variant and supplied price against the current branch-prioritized price, and stores immutable source provenance. Price/tenant/stock remain server-authoritative.

POS preserves price and original barcode through suggestion selection, F4 and F10; ordinary EANs fall back to catalog only for unconfigured/mismatched prefixes. Invalid configured scans report errors. Existing unmarked multiline client-price hints remain ignored, as before. New scans cannot be resolved offline; already resolved queued payloads retain provenance. No physical scale, fiscal issuance, printing or promotions were added.

## Feature files created or modified

- `src/domain/weighed-barcode.ts`, `src/domain/inventory.ts`
- `src/server/repositories/catalog.ts`, `inventory.ts`, `weighed-barcode.ts`
- `app/api/admin/weighed-barcode/route.ts`, `app/api/pos/barcodes/price/route.ts`, `app/pos/page.tsx`
- `prisma/schema.prisma`; new migrations `20261029100000_weighed_barcode_config`, `20261029200000_weighed_sale_source`
- `tests/inventory-domain.test.ts`, `tests/integration/weighed-barcode.test.ts`, `tests/integration/rls-boundaries.test.ts`, `tests/e2e/pos.spec.ts`
- `docs/weighed-barcodes.md`, `odd/tasks/epic5-weighed-ean-price.md`, this report; inherited D-018/D-019 and roadmap edits remain preserved.

No unrelated inherited changes were reverted or normalized. Local feature commits were created on `feat/pos-offline`: `c0d35ff` configuration/parser, `0b0c732` checkout/trazabilidad, and `62faa30` POS/docs/report. No push or PR was performed.

## Verification evidence

Windows node_modules requires Windows Node; checks used `cmd.exe /d /c npm ...` or `node.exe` with the equivalent package CLI. Database runs used loopback port55449 only.

| Command / check | Observed result |
| --- | --- |
| Focused domain/EAN/multiline/manual-payment tests | 34/34 passed; exit0; writer evidence |
| `npm run typecheck` | 0 errors; exit0; parent and writer |
| `npm run lint` | exit0; 0 reported errors; writer |
| Independent domain probe | 13/13 passed; exit0; 1.95s |
| Independent verification | S1-S6 MET; 0 reported blockers; runtime gates were separately pending at review time |
| `npm run db:generate` | exit0; Prisma Client7.10.1 generated in1.17s |
| `npm run db:validate` | exit0; valid schema |
| `npm audit --audit-level=high` | exit0; 0 vulnerabilities |
| Full Vitest V8 coverage, job-7 | 193/193 passed; 29/29 files; exit0;187.85s (wrapper189051ms) |
| Coverage | Lines93.89% (738/786); branches84.29% (569/675); statements88.88% (912/1026); functions88.88% (232/261). Configured domain90% thresholds passed; no exact domain percentage is claimed. |
| Concurrency within full suite | 20/20 consecutive rounds of20 concurrent sales passed; suite22/22 tests |
| Full Playwright, job-6 | 11/11 passed; exit0;21.3s (wrapper22287ms) |
| Production Next build, job-8 | exit0;29978ms |
| Empty-database `prisma migrate deploy`, job-9 | 22/22 migrations applied; exit0 |
| Focused regressions on the new database, job-9 | 37/37 passed;6/6 files;20.07s;exit0 |
| Ledger on the new database, jobs9/10 | 0 divergences;exit0; tenant RLS36/36 enabled and forced |
| Differential public-service probe, job-10 | 3/3 passed;4.36s;exit0; baselineHEAD versus candidate single/multiline/paid sale results and identical-command replay preserved, using legacy price inputs |
| Raw `git diff --check` | exit2;12173 inherited CRLF whitespace diagnostics |
| CRLF-aware `git -c core.whitespace=cr-at-eol diff --check` | exit0;0 diagnostic lines |

The new disposable database is `supermercado_epic5_810501fd_gate`; it remains available for inspection. Differential checks used a baseline git archive in an in-project `mktemp -d` directory. Its temporary test and baseline copy were removed after the successful run; no committed test reads git history.

EAN browser tests intercept lookup/checkout responses to prove UI wiring and submitted provenance. They are not evidence of a fully authenticated EAN backend sale. Actual pricing, persistence, rollback, permissions, and idempotency were tested through public services against PostgreSQL. Authenticated identity browser tests also ran.

## Earlier failures and bounded diagnosis

- First full coverage attempt:191/193 passed,2 failed;322.92s. The generic RLS fixture lacked the new tenant config row; it was populated through the public config service.
- Focused RLS then1/3 passed,2 default5000ms timeouts;14.38s. Two exhaustive all-table probes received explicit20000ms limits without weakening assertions.
- Next full attempt:191/193 passed,2 RLS timeouts;33151.98s. Historical9h12m cause remains unknown; no claim of suspension, DB deadlock, or runner defect is justified.
- User authorized a separate bounded diagnosis: «ok te autorizo, hablame en español la proxima».
- Isolated RLS without coverage:3/3 passed in8.83s; exit0; DB connection29ms;0 initially blocked sessions.
- Isolated RLS with coverage:3/3 passed in9.56s. Exit1 was solely unchanged whole-project coverage thresholds on a deliberately partial one-file probe, not test failure or a green coverage gate.
- Subsequent passing runs used Windows process-tree watchdogs:90s diagnostic/differential,180s browser/build/isolated migration run,420s full coverage. None reached its deadline.

## Reused demo database divergence — not repaired

`supermercado_fiscal_gate` reports1 ledger divergence; RLS36/36. Read-only inspection identified known demo variant `56a1c105-6a4b-44ca-81dc-b76aa1bd7c04`: ledger balance2.000000, onHand5.000000, reserved0.000000. This variant appeared in earlier manual demo work, but that association does not prove the discrepancy's cause. No stored stock, movement, or historic document was rewritten. The isolated clean database passed migrations, affected regressions, and ledger reconciliation independently.

## Remaining decisions / deviations

- The committed candidate assessment returned `nativeRisk: medium`, `risk: medium`, `reviewDue: false` with reason `under_budget`. The explicit item-2 escalation returned the required high verification plan; the independent S1-S6 verifier already completed with no blockers. No native approved review or acknowledgement is claimed because the returned plan did not require native review. The candidate was split into three local feature-branch slices; unrelated inherited edits remain outside those commits.
- The runtime reports a large accumulated branch history and the slices are reviewable behavior units; no push, PR creation, or merge was authorized.
- Demo ledger reconciliation remains red in that reused database. Do not infer that clean-database success repairs demo data. Any data reconciliation needs its own authorized investigation and compensating procedure.
- No business requirements were changed to bypass a gate. SUPUESTO: none concerning the historical delay or demo discrepancy cause.

Risk: item2 (tenant/config authorization and RLS); item3 (shared checkout/POS contracts).
