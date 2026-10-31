# Frontend audit — Wave 0 brief
Source: `docs/audits/informe-auditoria-frontend.md`.
Plan: `odd/tasks/frontend-audit-remediation.md`.
Status: approved for implementation planning; execution remains task-by-task and test-first.

## Specs

S1. «vamos a agregar ese archivo a todo el plan de trabajo para poder ir mejorando el frontend».
S2. Wave 0 addresses confirmed blockers before tablet/polish work: SEG-01, SEG-02, SEG-03, DAT-01, DAT-02, DAT-03, DAT-06, DAT-07, POS-01, POS-03, and NAV-01.
S3. D-026 requires migrating inline scripts/styles rather than adding `unsafe-inline` to production CSP.
S4. D-027 requires implementing Arqueos y Turnos using existing cash backend contracts.
S5. D-028 requires effective-role precedence `ADMIN > STOCK_MANAGER > SUPERVISOR > CASHIER` while authorization remains server-side.
S6. D-029 requires server-scoped sources for advanced filters; raw UUIDs are not the final UI.
S7. POS must not show a location selector; the server supplies one active authorized location and blocks when zero or multiple exist.
S8. Reports and dates use fixed `America/Argentina/Buenos_Aires`; offline POS supports cached catalog plus approved unverified intake; shortcuts use one unified registry.

## Scope

1. Production CSP: remove or migrate inline scripts/styles that violate strict production policy; read the installed Next 16.4.3 security guidance before choosing nonce/dynamic rendering or another implementation detail.
2. Session and shell: remove fail-open ADMIN fallback, redirect unauthenticated users to `/`, route CASHIER appropriately, use effective-role precedence, and add visible logout through the existing endpoint.
3. Data integrity: clear stored variant IDs when search text changes; use the fixed business timezone for report presets and local datetime conversion; normalize decimal comma input; hide/regenerate idempotency internals and preserve the same key on retry.
4. POS authority and safety: replace manually typed location UUID with server-derived single-location context and block ambiguous configuration; change Escape from destructive cart clearing to a safe confirmation/recovery flow.
5. Cash shifts: add the route/UI for open, movements, blind close, and close using existing repository/server contracts; no new backend capability is implied.
6. Navigation/filter contracts: remove 404 navigation and expose only server-backed advanced filter sources.

## Acceptance criteria

- Every item in S2 has one public-interface RED test before its fix and GREEN evidence after it.
- Production build served with `next start` has no CSP violations on `/`, `/admin`, `/pos`, and the login interaction remains functional.
- Unauthenticated `/admin` and `/pos` access routes to the login entry; no client fallback presents ADMIN authority.
- Logout clears the session and returns to `/`; no new secret or tenant authority is stored in the browser.
- Purchase/transfer variant text cannot submit a stale variant ID; a changed query requires a new server-backed selection.
- Report presets and datetime fields use `America/Argentina/Buenos_Aires` and preserve the visible local time.
- Decimal comma input is accepted and normalized where the domain schema permits it; invalid formats remain rejected with a user-facing message.
- Idempotency keys are not presented as user-editable technical controls; retries reuse the same key.
- POS location is entirely server-derived and ambiguous location configuration blocks the sale with a clear action.
- Escape never silently destroys an in-progress cart.
- `/admin/cash-shifts` is a usable responsive screen for the existing cash contracts.
- Existing Epic 7 gates remain green: tests, typecheck, lint, build, E2E, RLS, ledger, concurrency, and audit.

## Tasks

T1 | S2-S3 | researching | done | Confirm CSP behavior and read Next 16.4.3 guidance; commit: 780182c.
T2 | S2 | implementation | done | Fix production CSP inline violations and add production-browser regression coverage; commit: a79c290.
T3 | S2,S5 | implementation | done | Fix session fallback, effective role, logout, and route behavior; commit: c871d7f.
T4 | S2,S7 | implementation | done | Fix server-derived POS location authority and safe Escape behavior; commit: b1f930d.
T5 | S2,S8 | implementation | done | Fix variant selection integrity, timezone/date handling, comma decimals, and idempotency UX; commits: 4ca21ac, 317fb8d, fdba315, 37c22a1.
T6 | S4,S6 | implementation | done | Implement cash-shifts UI and server-backed advanced filter sources; commits: b6ad6ca, 0472519.
T7 | S2-S8 | checking | done | Run Wave 0 focused and full gates; update audit evidence and closure report; commit: pending.

## Log

L1. The imported audit is planning input; no finding is implemented by this brief alone.
L2. Confirmed SEG-01 and the listed Wave 0 findings through repository inspection and production-mode browser verification.
L3. D-026 through D-029 and POS single-location authority were approved before this brief.
L4. SEG-01 RED reproduced when production HTML loaded but login hydration did not run. The fix uses Next Proxy nonce CSP, forces dynamic root rendering, and migrates admin loading styles to a CSS module. Production E2E passed 1/1; typecheck, lint, and diff checks passed. No `unsafe-inline` was added.
L5. SEG-02/03 RED reproduced for unauthenticated `/admin`, missing logout, and unordered multi-role resolution. The fix redirects missing/invalid server identity to `/`, exposes POST sign-out, and resolves roles by `ADMIN > STOCK_MANAGER > SUPERVISOR > CASHIER`. Focused unit tests passed 17/17, redirect E2E passed 1/1, typecheck/lint/diff passed. Existing smoke API checks still need the configured gate database for their 401 contract.
L6. DAT-06 RED reproduced for comma quantities (`1,5`) in purchase totals and transfer validation. Decimal normalization now occurs before Decimal calculations/validation and at purchase/transfer input handlers. Focused UI tests passed 14/14; DAT-01, DAT-02/03, and DAT-07 remain open.
L7. DAT-01 RED reproduced when a changed variant search retained the old UUID. Shared purchase/transfer helpers now clear `variantId` and `sku` when search text changes, and both form handlers use them. Focused purchase/transfer tests passed 16/16; typecheck, lint, and diff passed. DAT-02/03, DAT-07, POS-01/03, and NAV-01 remain open.
L8. DAT-02/03 RED reproduced for UTC report presets and browser-local `datetime-local` conversion. Report presets now use fixed `America/Argentina/Buenos_Aires` UTC−03:00 boundaries, and local datetime values are parsed with the same offset. Reports UI tests passed 12/12; typecheck, lint, and diff passed. DAT-07, POS-01/03, and NAV-01 remain open.
L9. DAT-07 RED reproduced because purchase and transfer forms exposed technical idempotency keys and regeneration controls. The server-generated keys remain in form state and request payloads, while both controls are removed from the operator UI. Focused tests passed 17/17; typecheck, lint, and diff passed. POS-01/03 and NAV-01 remain open.
L10. POS-01/03 policy and UI integration now resolve the single active authorized location through `/api/pos/context`; the POS page no longer accepts a manual location UUID. Escape preserves a non-empty cart and reports a recovery message instead of clearing it. Focused POS/forms tests passed 20/20; typecheck, lint, and diff passed. NAV-01 remains open.
L11. NAV-01 cash-shifts route/UI now exposes opening, cash movement, blind close, and close operations through existing server cash services. Cash-shifts UI test passed 1/1; typecheck, lint, and diff passed. Advanced server-scoped filter sources remain a separate open dependency in T6.
L12. D-029 filter sources now come from tenant/branch-scoped server queries for operators, active variants, and active categories. The reports UI consumes them as selects instead of free-form UUID fields. Reports/domain tests passed 16/16; typecheck, lint, and diff passed.
L13. Wave 0 verification report records Vitest 193/193, typecheck/lint/build/diff GREEN, production CSP E2E 1/1, and smoke E2E 3 passed/2 failed because DATABASE_URL was unavailable. Full E2E/RLS/ledger/concurrency proof remains blocked by the disposable gate environment; native review was inspected but not started by extension policy.
L14. The disposable PostgreSQL gate was provisioned as supermercado_gate with separate non-privileged runtime/auth roles. Final verification passed: Vitest 353/353, complete non-production Playwright 33/33, production CSP 1/1, ledger 0 divergences, tenant RLS 43/43 tables enabled and forced, and concurrency 22/22. Authenticated E2E setup and production CSP runner separation were added without weakening authorization or CSP.
