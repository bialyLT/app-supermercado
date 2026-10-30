# Épica 7 — Interfaz operativa y administración
Branch: `feat/epic7-operations-ui` (crear desde `main` después de aprobar el brief).
Status: planning; alcance visual y asignación de roles gerenciales aprobados.

## Specs

S1. «la app puede estar preparada para tablets, me parece bien que sea responsive».

S2. «reportes sin graficos».

S3. «no priorizo nada, solo quiero que dejes completa la interfaz».

S4. «recuerda que todo esto que me escribiste estaria bueno que quede guardado si es que aun no lo esta o no lo pensabas hacer».

S5. La interfaz debe conservar el enfoque «intuitivo, keboard first, y que sea veloz».

## Scope

Complete the user-facing surface for existing backend contracts without adding e-commerce, delivery, picking, loyalty, marketplaces, or production deployment.

### Interface areas

1. Application shell: responsive navigation, role-aware menu, branch selector, breadcrumbs, loading/error/empty states, and keyboard hints.
2. Purchases: supplier/branch selection, fast variant search, multi-line receipt entry, Decimal-safe totals, validation, idempotent submit, and purchase history.
3. Transfers: origin/destination branches, locations, variants/lots, stock validation, dispatch confirmation, result movements, and recent transfers.
4. Reports: period/branch/user/variant/category filters, tabular summary/detail, accessible CSV download, and no charts in the first version.
5. Administration: users and branch assignments, tenant settings, weighed-barcode configuration, and supplier management where an existing API supports it.
6. UX hardening: desktop/tablet responsive layouts, keyboard navigation, accessibility checks, fast feedback, responsive tables, and end-to-end flows.

## Product principles

- Server contracts remain authoritative for tenant, branch, permission, totals, stock, audit, and idempotency.
- Use the existing Next.js App Router, React Server Components for reads, Client Components only for interactive forms, CSS Modules, Zod schemas, and Playwright.
- Use AI-generated UI only for wireframe exploration; adapt all generated code to repository boundaries and domain contracts.
- Do not duplicate business rules in the browser.
- Prefer keyboard navigation, visible focus, predictable tab order, Enter to commit, Escape to cancel, and no mouse-only action.
- Optimize for fast perceived response with server-side reads, debounced search, local form state only, skeletons, and explicit pending/error states.

## Role proposal

The existing roles are `ADMIN`, `STOCK_MANAGER`, `SUPERVISOR`, and `CASHIER`; do not add a new `MANAGER` role without a product decision.

- Tenant manager: `ADMIN` — tenant-wide settings, users, reports, purchases, transfers, and configuration.
- Inventory manager: `STOCK_MANAGER` — purchases, transfers, catalog/inventory, and operational reports limited to assigned branches.
- Shift/cash manager: `SUPERVISOR` — cash overrides, approvals, inventory review actions, and supervisor-only operational actions.
- Cashier: `CASHIER` — POS and cash-session actions; no administrative screens.

This mapping is approved for role-aware navigation; no new `MANAGER` role is introduced.

## Acceptance criteria

- Every existing operational API intended for staff has a corresponding usable screen or an explicit documented reason why it remains API-only.
- All interface flows work on desktop and tablet widths without horizontal scrolling for primary actions.
- Every primary action is usable without a mouse and exposes visible focus.
- Forms show server validation, authorization, idempotency conflicts, and network failures without losing entered data.
- Money and quantities display the server-provided Decimal strings; the browser never becomes the source of truth for totals or tenant scope.
- Reports render tables and export CSV; no chart library is introduced for this épica.
- Playwright covers the happy path, unauthorized access, keyboard interaction, responsive layout, and error states for each completed screen.
- The interface remains within the current modular-monolith boundaries and passes all `GATES.md` checks.

## Tasks

T1 | S1,S5 | planning | done | Approve shell, responsive, keyboard-first, and UI component conventions; commit: pending.
T2 | S1,S3,S5 | implementation | done | Build responsive role-aware application shell and navigation; commit: 81497d2.
T3 | S3,S5 | implementation | pending | Build purchases interface and end-to-end flow; commit: pending.
T4 | S3,S5 | implementation | pending | Build transfers interface and end-to-end flow; commit: pending.
T5 | S2,S3,S5 | implementation | pending | Build tabular reports and CSV export interface without charts; commit: pending.
T6 | S3,S5 | implementation | pending | Build users, settings, weighed-barcode, and supplier interfaces supported by existing APIs; commit: pending.
T7 | S1,S2,S3,S5 | checking | pending | Run responsive, accessibility, keyboard, E2E, performance, and GATES.md verification; create closure report; commit: pending.

## Log

L1. Dueño: «la app puede estar preparada para tablets, me parece bien que sea responsive, 2. reportes sin graficos, 3. decime los gerentes y decidimos, 4. no priorizo nada, solo quiero que dejes completa la interfaz, despues vemos con cual empezamos, recuerda que todo esto que me escribiste estaria bueno que quede guardado si es que aun no lo esta o no lo pensabas hacer».
L2. The existing backend roles are `ADMIN`, `STOCK_MANAGER`, `SUPERVISOR`, and `CASHIER`; the brief maps manager responsibilities to existing roles and does not create a new role implicitly.
L3. Dueño confirmed the proposed role mapping: `ADMIN` tenant-wide manager, `STOCK_MANAGER` inventory manager, `SUPERVISOR` shift/cash manager, and `CASHIER` operator.
L4. T1 approved: implementation may proceed sequentially by bounded interface unit; responsive desktop/tablet, keyboard-first, tabular reports without charts, complete existing operational interface scope, and the existing role mapping are authoritative.
L5. T2 evidence: responsive `/admin` shell, role-aware server-derived navigation, keyboard shortcuts, visible focus, tablet drawer, neutral empty branch state, and admin loading/error boundaries implemented; focused shell tests 18/18, full Vitest 120 passed with 23 integration tests skipped without gate DB, typecheck/lint/build green. Client role preview and fake branch defaults were removed during parent review.
L6. Commit boundary: `81497d2` contains the Epic 7 planning decisions and responsive admin shell slice. The next unit is purchases UI; it must remain a separate reviewable slice.
