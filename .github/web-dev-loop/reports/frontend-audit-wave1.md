# Frontend audit — Wave 1 first-slice verification

Estado: `ENTREGADO: ProductCombobox keyboard/accessibility slice verified; remaining Wave 1 slices are still planned.`

## Scope delivered

- Added shared `components/product-combobox.tsx` and `components/product-combobox.module.css`.
- Integrated the component into purchase, transfer, and POS product-selection flows.
- Preserved server-backed catalog callbacks and existing tenant/branch/location authority.
- Kept production CSP strict; no inline policy relaxation was introduced.
- Updated POS E2E selectors to assert the public ARIA combobox/listbox/option contract.

## Numeric verification

- Focused Vitest/UI suite: **3 files, 19/19 tests passed**, 1.79s.
- TypeScript typecheck: **passed**, 0 errors.
- POS Playwright E2E: **7/7 passed**, 1.1m.
- POS E2E coverage includes keyboard-first controls, ArrowDown/Enter selection, unauthenticated mutation rejection, weighed barcode, normal catalog checkout, fallback search, and invalid barcode messaging.
- `git diff --check`: **passed**.

## RED/GREEN evidence

- RED: the first POS E2E run after extraction failed 5/7 because the shared component initially dropped the preserved `#variant`/autofocus contract and tests still asserted the pre-Wave-1 button/list markup.
- GREEN: restored the public `id` and autofocus behavior, updated assertions to ARIA option/listbox semantics, then reran POS E2E at 7/7.
- The initial structural test run was 19/20 because SSR serializes React's `autoComplete` attribute with camel-case; the assertion was corrected and the final focused suite passed 19/19.

## Remaining Wave 1 scope

- Shared Modal focus trap/restore and Escape-safe behavior.
- Shared Field error association and first-invalid focus.
- Tabs semantics and roving keyboard focus.
- Tablet drawer focus/inert behavior.
- Responsive purchases/POS layouts and measured 44×44 touch targets.
- Broader keyboard/tablet/a11y gates and final Wave 1 closure.

SUPUESTO: none added.

Decisiones requeridas: none for this first slice; the remaining shared-component interaction details will be implemented within the approved Wave 1 criteria and existing server contracts.
