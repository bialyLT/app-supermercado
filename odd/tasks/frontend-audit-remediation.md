# Frontend audit remediation plan
Branch: `feat/epic7-operations-ui`; source audit imported from the owner's Downloads folder.
Status: Wave 0, Wave 1, and Wave 2 delivered; Wave 3 requires a brief with measurable criteria before implementation.
Source: `docs/audits/informe-auditoria-frontend.md`.

## Specs

S1. «vamos a agregar ese archivo a todo el plan de trabajo para poder ir mejorando el frontend».
S2. The imported audit reports 79 findings: 3 critical, 27 high, 38 medium, and 11 low.
S3. The audit's suggested waves are: `0 · Bloqueantes`, `1 · Teclado y tablet`, `2 · Estados y errores`, and `3 · Consistencia`.
S4. The audit explicitly requires ⚠ findings to be confirmed by execution before prioritization and requires each remediation wave to become a brief with measurable criteria before code changes.

## Tasks

T1 | S1-S4 | planning | done | Import the audit as `docs/audits/informe-auditoria-frontend.md`; commit: pending.
T2 | S1-S4 | planning | done | Create this remediation plan and link it from `ROADMAP.md`; commit: pending.
T3 | S1-S4 | deciding | done | Resolve product/security decisions: timezone, POS location source, offline catalog policy, shortcut scheme, CSP strategy, advanced filters, cash-shifts route, and multi-role effective-role policy; decisions D-026 through D-029 recorded.
T4 | S2-S4 | researching | done | Confirm ⚠ findings with production-mode execution, including CSP, tablet header, and timezone/hydration behavior; evidence recorded in Wave 0 closure.
T5 | S2-S4 | planning | done | Approve and execute remediation Wave 0 with tests-first criteria for SEG-01/02/03, DAT-01/02/03/06/07, POS-01/03, and NAV-01; closure report recorded.
T6 | S2-S4 | planning | done | Approve and execute Wave 1 for shared Modal, Combobox, Field, Tabs, keyboard/tablet behavior, and responsive POS/purchases criteria; closure report recorded in `.github/web-dev-loop/reports/frontend-audit-wave1.md`.
T7 | S2-S4 | planning | done | Prepare and deliver the Wave 2 brief for shared apiFetch, session-expiry handling, loading/error/retry states, offline queue visibility, and offline idempotency; brief: `odd/tasks/frontend-audit-wave2.md`; closure: `.github/web-dev-loop/reports/frontend-audit-wave2.md`.
T8 | S2-S4 | planning | done | Prepare the Wave 3 brief for formatting, tokens, contrast, inline-style reduction, and copy consistency; brief: `odd/tasks/frontend-audit-wave3.md`. Implementation still requires explicit approval.

## Log

L1. Dueño: «vamos a agregar ese archivo a todo el plan de trabajo para poder ir mejorando el frontend».
L2. Source file supplied at `C:\Users\Usuario\Downloads\informe-auditoria-frontend.md`; imported through WSL as `/mnt/c/Users/Usuario/Downloads/informe-auditoria-frontend.md`.
L3. The audit is evidence and planning input, not authorization to implement every finding. Product decisions and wave briefs remain required by `AGENTS.md`.
L4. Wave 0 confirmation: SEG-01 reproduced in production mode with Chromium (HTTP 200 but three blocked inline scripts under `script-src 'self'`); SEG-02 confirmed by `app/admin/layout.tsx` fail-open ADMIN fallback; DAT-01 confirmed in purchases/transfers query handlers because editing the visible variant text does not clear the stored variant ID; DAT-02 confirmed in `components/reports/types.ts` because presets use UTC boundaries. No remediation code was changed during confirmation.
L5. Additional Wave 0 confirmation: SEG-03 has only a server sign-out route and no UI control; DAT-03 uses `toISOString().slice(0, 16)` for local datetime inputs; DAT-06 has decimal quantity inputs without comma normalization; DAT-07 exposes and regenerates idempotency keys in purchases/transfers; POS-01 requires a manually entered location UUID; POS-03 clears the cart on Escape; NAV-01 links `/admin/cash-shifts` without an app route. Existing backend cash repositories provide open, movement, blind-close, and close contracts for the planned screen. Owner decisions are recorded as D-026 through D-029.
L6. Wave 0 was delivered and merged with all technical gates GREEN. Wave 1 was subsequently delivered with its closure report and numeric evidence. Wave 2 is now the next planned scope; its brief and explicit approval are still required before implementation.
L7. Wave 2 brief was delivered at `odd/tasks/frontend-audit-wave2.md`. The owner selected security, quality, UI/E2E, and database testers; production/deployment remains explicitly out of scope.
