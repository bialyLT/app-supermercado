# POS authentication and register-location verification

ENTREGADO: The owner authorized the final typecheck/lint runs; both passed. Post-refactor focused, E2E, full-suite, coverage, ledger, and build gates all passed (details below). Final ASSESS was high with nativeRisk unassessable because untracked paths were undeclared; the returned plan required an independent verifier, which passed with no blockers. The controller returned no reviewDue/continuation, so no native review transaction was started. Work-unit commits are recorded; the owner-authorized push remains a separate delivery step. No PR, merge, or deploy is authorized.

## Scope and files

- Authentication: `app/page.tsx`, `components/auth/login-form.tsx`, `tests/e2e/pos.spec.ts` (role-based authenticated landing).
- Register assignment: `app/admin/cash-registers/`, `app/api/admin/cash-registers/`, `components/cash-registers/`, `components/admin-navigation.ts`.
- Authorization and shift snapshot: `src/auth/authorization.ts`, `src/domain/actor.ts`, `src/server/cash.ts`, `src/server/repositories/cash.ts`, `src/server/repositories/inventory.ts`, `app/api/pos/context/route.ts`.
- Schema: `prisma/schema.prisma`, new migration `prisma/migrations/20261104000000_pos_register_location_snapshot/migration.sql`.
- Tests: `tests/integration/cash-register-location.test.ts`, `tests/integration/fixtures.ts`, `tests/integration/rls-boundaries.test.ts`, `tests/integration/supervisor-closure.test.ts`, `tests/e2e/cash-register-locations.spec.ts`.
- Tracking: `odd/tasks/pos-auth-register-location.md`.

## Observed checks

| Command/check | Result |
| --- | --- |
| Fresh `npm run db:migrate`; `npm run test:db:setup` | Both exit 0 on isolated gate DB; 2 least-privilege runtime roles provisioned |
| Branchless ADMIN regression | RED: 1 failed, 7 skipped (`NOT_FOUND`); GREEN integration file: 8 passed, 0 failed, 4.62s |
| Final `npm test` | Exit 0; 421 passed, 0 failed; 67 files; 143.54s |
| Final `npm run test:coverage` | Exit 0; statements 88.34%, branches 81.48%, functions 87.34%, lines 92.46% |
| Final `npm run test:ledger` | Exit 0; 0 divergences; RLS 43/43 enabled and forced |
| Final `npm run build` | Exit 0; 31s |
| `npm audit --audit-level=high` | Exit 0; 0 high/critical; 16 moderate; dependencies unchanged |
| Initial full E2E, 4 workers | Exit 1; 44 passed, 13 failed out of 57 |
| Focused T4 E2E, 1 worker | Exit 0; 2 passed, 0 failed; 24.7s |
| Final full `npm run test:e2e -- --workers=1` | Exit 0; 57 passed, 0 failed; 3m15s wall time |
| Authenticated landing E2E | 6 passed, 0 failed; 25.1s |
| `git diff --check` | Exit 0; 0 whitespace errors |
| Independent verification | Final static review of T4/T8: PASS, 0 blockers; verifier did not rerun tests/build/typecheck/lint; it reviewed parent evidence |
| Initial typecheck/lint attempts | Both timed out at30s; owner then authorized final runs |
| Final post-refactor `npm run typecheck` | Exit0 in10s |
| Final post-refactor `npm run lint` | Exit0 in19s;0 errors,1 warning for unused `sessionA` in generated `.cache/demo/seed-template.ts` |
| Focused UI/integration tests after loader refactor | Exit0: 13/13 tests,3 files,8.87s |
| Focused post-refactor Playwright `cash-shifts.spec.ts` + `cash-register-locations.spec.ts` | Exit0: 4/4 in30.8s (T4 location/snapshot2; T8 open/retry2) |
| Final post-refactor `npm test` | Exit0:425/425,68 files,139.39s |
| Final post-refactor `npm run test:coverage` | Exit0: statements88.38%, branches81.55%, functions87.47%, lines92.48% |
| Final post-refactor `npm run test:ledger` | Exit0: 0 divergences; RLS43/43 enabled and forced |
| Final post-refactor `npm run build` | Exit0 in20s |
| Final Gentle ASSESS | RDD on, high via item2; nativeRisk unassessable because untracked files require declaration; outcome unknown; returned plan required independentVerifier=true. `reviewDue`/continuation were omitted; no native START/capture was run. |
| Final `git diff --check` | Exit0: tracked diff clean;14 untracked text files checked (excluding generated `.cache/` data/logs) |

Evidence logs: `.cache/demo/t4-unit-tests-final.log`, `t4-coverage-final.log`, `t4-build-final.log`, `t4-e2e.log`, `t4-e2e-serial-final.log`, `t4-e2e-focused.log`, `t4-audit.log`.

## Boundaries and deviations

Tests use `supermercado_pos_t4_20261104_gate` on PostgreSQL55450, not the preserved demo database. Database isolation shares the existing cluster because Docker is unavailable; least-privilege role provisioning affects cluster roles. No reset/drop or demo schema/data mutation performed. Next3000 was restored after final build and returned HTTP200 in1s. Demo register configuration and fresh-shift setup remain unperformed; legacy NULL location snapshots deliberately fail closed.

The 57/57 serial E2E result does not establish why the earlier four-worker run failed. Its navigation/locator failures remain recorded; no test timeout or product behavior was weakened.

The blank control is Next development tooling (`nextjs-portal` / `#next-logo`), not a POS action. No business action, payment method, retry path, or shortcut was removed. T5 visual-coherence work is complete; see `.github/web-dev-loop/reports/pos-visual-coherence.md`. No business controls were removed.

## SUPUESTO and required decisions

SUPUESTO: ADMIN with no explicit persisted branch assignments is tenant-wide; ADMIN with explicit branches remains branch-scoped, matching existing list/context conventions. Broader interpretation of D-025 requires an owner decision.

The owner authorized the final typecheck/lint checks and requested push when ready. Those gates passed. The final ASSESS could not natively assess the untracked candidate; its returned plan was satisfied by the independent verifier (PASS,0 blockers), and it returned no reviewDue/continuation. No native review receipt is claimed. The POS visual task T5 is complete; see `.github/web-dev-loop/reports/pos-visual-coherence.md`. No business controls were removed. Work-unit commits are recorded, but no push, PR, merge, or deploy has occurred.

Risk: item 2 (authorization scope); item 1 (new schema and immutable session snapshots). Functional and independent static checks passed as recorded; missing proof remains explicit.
