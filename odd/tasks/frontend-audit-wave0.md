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

T1 | S2-S3 | researching | done | Confirm CSP behavior and read Next 16.4.3 guidance; commit: pending.
T2 | S2 | implementation | pending | Fix production CSP inline violations and add production-browser regression coverage; commit: pending.
T3 | S2,S5 | implementation | pending | Fix session fallback, effective role, logout, and route behavior; commit: pending.
T4 | S2,S7 | implementation | pending | Fix server-derived POS location authority and safe Escape behavior; commit: pending.
T5 | S2,S8 | implementation | pending | Fix variant selection integrity, timezone/date handling, comma decimals, and idempotency UX; commit: pending.
T6 | S4,S6 | implementation | pending | Implement cash-shifts UI and server-backed advanced filter sources; commit: pending.
T7 | S2-S8 | checking | pending | Run Wave 0 focused and full gates; update audit evidence and closure report; commit: pending.

## Log

L1. The imported audit is planning input; no finding is implemented by this brief alone.
L2. Confirmed SEG-01 and the listed Wave 0 findings through repository inspection and production-mode browser verification.
L3. D-026 through D-029 and POS single-location authority were approved before this brief.
