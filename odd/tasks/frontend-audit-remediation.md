# Frontend audit remediation plan
Branch: `feat/epic7-operations-ui`; source audit imported from the owner's Downloads folder.
Status: planning; no remediation wave is authorized until its brief, measurable criteria, and product decisions are confirmed.
Source: `docs/audits/informe-auditoria-frontend.md`.

## Specs

S1. «vamos a agregar ese archivo a todo el plan de trabajo para poder ir mejorando el frontend».
S2. The imported audit reports 79 findings: 3 critical, 27 high, 38 medium, and 11 low.
S3. The audit's suggested waves are: `0 · Bloqueantes`, `1 · Teclado y tablet`, `2 · Estados y errores`, and `3 · Consistencia`.
S4. The audit explicitly requires ⚠ findings to be confirmed by execution before prioritization and requires each remediation wave to become a brief with measurable criteria before code changes.

## Tasks

T1 | S1-S4 | planning | done | Import the audit as `docs/audits/informe-auditoria-frontend.md`; commit: pending.
T2 | S1-S4 | planning | done | Create this remediation plan and link it from `ROADMAP.md`; commit: pending.
T3 | S1-S4 | deciding | pending | Resolve product/security decisions: timezone, POS location source, offline catalog policy, shortcut scheme, CSP strategy, advanced filters, cash-shifts route, and multi-role effective-role policy; commit: pending.
T4 | S2-S4 | researching | pending | Confirm ⚠ findings with production-mode execution, including CSP, tablet header, and timezone/hydration behavior; commit: pending.
T5 | S2-S4 | planning | pending | Approve a brief for remediation wave 0 with tests-first criteria for SEG-01/02/03, DAT-01/02/03/06/07, POS-01/03, and NAV-01; commit: pending.
T6 | S2-S4 | planning | pending | Approve a brief for remediation wave 1: shared Modal, Combobox, Field, Tabs, keyboard/tablet behavior, and responsive POS/purchases criteria; commit: pending.
T7 | S2-S4 | planning | pending | Approve a brief for remediation wave 2: shared apiFetch, session-expiry handling, loading/error/retry states, and offline queue visibility; commit: pending.
T8 | S2-S4 | planning | pending | Approve a brief for remediation wave 3: formatting, tokens, contrast, inline-style reduction, and copy consistency; commit: pending.

## Log

L1. Dueño: «vamos a agregar ese archivo a todo el plan de trabajo para poder ir mejorando el frontend».
L2. Source file supplied at `C:\Users\Usuario\Downloads\informe-auditoria-frontend.md`; imported through WSL as `/mnt/c/Users/Usuario/Downloads/informe-auditoria-frontend.md`.
L3. The audit is evidence and planning input, not authorization to implement every finding. Product decisions and wave briefs remain required by `AGENTS.md`.
