# Frontend audit — Wave 1 keyboard and tablet
Source: `docs/audits/informe-auditoria-frontend.md`.
Plan: `odd/tasks/frontend-audit-remediation.md`.
Status: delivered; all approved keyboard/tablet scope is closed with numeric evidence in `.github/web-dev-loop/reports/frontend-audit-wave1.md`.

## Specs

S1. The audit wave table defines Wave 1 as: `1 · Teclado y tablet | Modal, Combobox, Field, Tabs; NAV-02/05; RSP-01/03/04; POS-04/05/10 | axe sin violaciones serias en las 12 pantallas; recorridos solo con teclado; sin scroll horizontal en 820×1180 y 1180×820; controles ≥44 px`.
S2. The owner request is: «bueno vamos a hacer el 1, y avancemos un poco con la ola 1 entonces que seria lo que sigue».
S3. Existing approved UI principles require responsive desktop/tablet behavior, keyboard-first operation, visible focus, predictable tab order, Enter to commit, Escape to cancel, and no mouse-only action.
S4. Server contracts remain authoritative for tenant, branch, permission, totals, stock, audit, and idempotency; Wave 1 must not introduce client-side authority or new backend capabilities.

## Acceptance criteria

- Shared `Modal` behavior has focus capture, initial focus, focus restoration, Escape handling, background inertness, and submission-safe close behavior.
- Shared product search behavior exposes an ARIA combobox/listbox contract with `aria-expanded`, `aria-controls`, `aria-activedescendant`, keyboard ArrowUp/ArrowDown, Enter selection, Escape dismissal, and an announced result state; it serves purchases, transfers, and POS without duplicating selection rules.
- Shared `Field` behavior associates labels, help, and errors with controls through stable IDs, exposes `aria-invalid`/`aria-required` where applicable, and focuses the first invalid field after a rejected submit.
- Shared `Tabs` behavior exposes `tablist`/`tab`/`tabpanel`, selected state, roving tabindex, and arrow-key navigation where tabs are introduced or corrected.
- Closed tablet drawer content is removed from keyboard traversal; opening moves focus into the drawer and closing restores focus to the trigger.
- Primary tablet actions and controls have a measured hit area of at least 44×44 CSS pixels, with no conflicting inline minimum sizes.
- Purchases and POS primary workflows have no horizontal overflow at 820×1180 and 1180×820 viewports; responsive tables use an intentional compact/card or bounded-scroll presentation.
- Focus-visible indicators remain visible with sufficient contrast on inputs, options, buttons, tabs, and drawer controls.
- Applicable Playwright checks cover keyboard-only paths, focus behavior, responsive widths, and the protected screens; axe or an equivalent accessibility check reports zero serious/critical violations for the covered screens.
- No `unsafe-inline`, client-side tenant/branch authority, or production deployment is introduced.

## Tasks

T1 | S1-S4 | planning | done | Create this brief, link it from the roadmap/remediation plan, and record the first bounded slice; commit: pending.
T2 | S1,S3,S4 | researching | done | Map existing modal, combobox, field, tabs, shell drawer, purchase table, POS, and responsive CSS surfaces; commit: pending.
T3 | S1,S3,S4 | implementation | done | Implement the shared ProductCombobox slice for purchases, transfers, and POS with RED/GREEN tests; commit: b60da57.
T4 | S1,S3,S4 | implementation | done | Implement shared Modal focus behavior and integrate the admin-shell shortcuts dialog; commit: 99789fb.
T5 | S1,S3,S4 | implementation | done | Integrate shared Modal into the purchase SupplierModal with submission-safe close behavior; commit: c32e3dc.
T6 | S1,S3,S4 | implementation | done | Integrate corrected keyboard semantics into purchase receipt detail, transfer confirmation, and supplier-management dialogs; commit: pending.
T7 | S1,S3,S4 | implementation | done | Resolve tablet layout, touch-target, focus-visible, and responsive purchase/POS issues; closure evidence recorded.
T8 | S1-S4 | checking | done | Run keyboard/tablet/a11y gates, update the Wave 1 report, and close with numeric evidence.
T9 | S1,S3,S4 | implementation | done | Modernize the Promotions responsive view with structured fields, visible focus, 44px controls, and bounded table overflow; commit: pending.
T10 | S1,S3,S4 | implementation | done | Harden POS responsive layout with tablet no-overflow coverage while preserving keyboard, checkout, offline, and location contracts; commit: pending.
T11 | S1,S3,S4 | implementation | done | Harden the tablet AdminShell drawer so closed navigation is not keyboard-reachable while preserving desktop behavior and focus restoration; commit: pending.
T12 | S1-S4 | checking | done | Close Wave 1 with Field, Tabs, drawer, responsive, Vitest, E2E, CSP, typecheck, and diff evidence; commit: pending.

## Log

L1. Owner request: «bueno vamos a hacer el 1, y avancemos un poco con la ola 1 entonces que seria lo que sigue».
L2. Wave 0 is merged and its final technical evidence is GREEN: Vitest 353/353, non-production Playwright 33/33, production CSP 1/1, ledger 0 divergences, tenant RLS 43/43, and concurrency 22/22. Wave 1 starts as a separate reviewable scope; no Wave 1 source implementation is claimed by this brief.
L3. The first implementation slice must remain bounded and preserve server-side authority, strict CSP, and the existing modular-monolith boundaries.
L4. Inspection found duplicated product search patterns in `components/purchases/purchase-form.tsx`, `components/transfers/transfer-form.tsx`, and `app/pos/page.tsx`; current options expose inconsistent listbox semantics and click-first behavior. Existing dialogs use `div role="dialog"` without uniform focus capture/restoration, and the tablet drawer uses transform-only hiding without removing closed links from keyboard traversal. The first code slice is ProductCombobox because it serves three repeated product-selection flows.
L5. ProductCombobox was integrated into purchases, transfers, and POS with ARIA combobox/listbox semantics, ArrowUp/ArrowDown navigation, Enter selection, Escape dismissal, live result counts, and server-backed option callbacks. Focused unit/UI tests passed 19/19, typecheck passed, diff check passed, and POS E2E passed 7/7 including unauthenticated mutation rejection and existing weighed/catalog flows.
L6. Commit boundary: `b60da57` contains the bounded ProductCombobox slice, its tests, Wave 1 brief/evidence, and roadmap links. The next slice is Modal/focus behavior; it remains separate.
L7. Shared `Modal` focus behavior was added and integrated only into the admin-shell shortcuts dialog. Focused tests passed 14/14, typecheck and diff check passed, and admin-shell E2E passed 4/4. The component focuses the first control, traps Tab, closes on Escape, restores the invoking focus, and marks sibling content inert while open. Purchase, transfer, supplier, and detail dialogs remain outside this slice.
L8. Commit boundary: `99789fb` contains the focus-safe Modal shell slice, its tests, and updated Wave 1 evidence. The next slice remains separate: additional modal consumers or shared Field semantics.
L9. SupplierModal now uses the shared Modal and prevents Escape/backdrop closure while its POST is in flight. Focused purchases/modal tests passed 12/12, typecheck and diff check passed, and purchases E2E passed 5/5. The remaining purchase-detail, transfer-confirmation, and supplier-management dialogs remain separate.
L10. Commit boundary: `c32e3dc` contains the SupplierModal integration and updated Wave 1 evidence. The next slice remains separate: purchase-detail, transfer-confirmation, and supplier-management dialogs.
L11. PurchaseHistory receipt detail now uses the shared Modal while preserving its state, close actions, and receipt rendering. Focused purchases/modal tests passed 12/12, typecheck passed, diff check passed, and the purchases E2E passed 5/5. The transfer-confirmation and supplier-management dialogs remain separate.
L12. Transfer confirmation and SupplierManager now use the shared Modal with submission-safe close behavior. Transfer/modal tests passed 7/7, SupplierManager/modal tests passed 8/8, typecheck passed, diff check passed, transfer and supplier E2E paths passed 5/5 where applicable, and the manual server was restored at localhost:3000. Remaining Wave 1 work is Field/Tabs/drawer/responsive behavior.
L13. Promotions responsive view now uses scoped CSS modules, explicit labels, visible focus, 44px controls, and bounded table overflow without changing CRUD/API behavior. Structural/admin tests passed 23/23, typecheck and diff check passed, promotions E2E passed 1/1, and the manual server was restored at localhost:3000.
L14. POS responsive layout now adapts from three to two to one columns, protects against horizontal overflow, and keeps payment rows usable on tablet/mobile. Focused checks passed 5/5, typecheck and diff check passed, POS E2E passed 8/8 including 820×1180 overflow coverage, and the manual server was restored at localhost:3000.
L15. Closed tablet/mobile AdminShell navigation is now visibility-hidden and pointer-inert, while opening restores interaction and desktop behavior is unchanged. Admin-shell tests passed 13/13, typecheck and diff check passed, admin-shell E2E passed 4/4, and the manual server was restored at localhost:3000. Remaining Wave 1 work is shared Field and Tabs.
L16. Wave 1 final closure: Field/reports tests 14/14, Tabs/transfers tests 18/18, full Vitest 196 passed and 160 skipped, final frontend E2E 24/24, production CSP 1/1, typecheck passed, and diff check passed. No approved Wave 1 scope remains pending.
