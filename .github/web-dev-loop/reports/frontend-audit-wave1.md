# Frontend audit — Wave 1 slice verification

Estado: `ENTREGADO: ProductCombobox and admin-shell Modal/focus slices are verified; remaining Wave 1 slices are still planned.`

## Delivered slices

### ProductCombobox

- Added shared `components/product-combobox.tsx` and `components/product-combobox.module.css`.
- Integrated it into purchase, transfer, and POS product-selection flows.
- Preserved server-backed catalog callbacks and existing tenant/branch/location authority.
- ARIA combobox/listbox semantics include ArrowUp/ArrowDown navigation, Enter selection, Escape dismissal, and live result counts.

### Modal/focus

- Added shared `components/modal.tsx` and `components/modal.module.css`.
- Integrated the component into the admin-shell keyboard-shortcuts dialog only.
- Initial focus moves to the first control; Tab cycles within the dialog; Escape closes; focus returns to the invoking control; sibling content is inert while open.
- No server contracts, authorization rules, or CSP policy were changed.

## Numeric verification

- ProductCombobox focused Vitest/UI suite: **3 files, 19/19 tests passed**, 1.79s.
- POS Playwright E2E: **7/7 passed**, 1.1m, including ArrowDown/Enter selection and existing POS flows.
- Modal/admin-shell focused Vitest suite: **2 files, 14/14 tests passed**, 1.39s.
- TypeScript typecheck: **passed**, 0 errors.
- Admin-shell Playwright E2E: **4/4 passed**, 54.7s.
- `git diff --check`: **passed**.

## RED/GREEN evidence

- ProductCombobox RED: first POS E2E run failed 5/7 because extraction initially dropped the preserved `#variant`/autofocus contract and tests still asserted pre-Wave-1 button/list markup. GREEN followed after restoring those contracts and updating tests to ARIA option/listbox semantics.
- Modal RED: initial typecheck failed because the structural test passed `children` as a separate `React.createElement` argument. GREEN followed after passing `children` inside the typed props object.

## Remaining Wave 1 scope

- Integrate focus-safe Modal behavior into purchase, transfer, supplier, and purchase-detail dialogs.
- Shared Field error association and first-invalid focus.
- Tabs semantics and roving keyboard focus.
- Tablet drawer focus/inert behavior.
- Responsive purchases/POS layouts and measured 44×44 touch targets.
- Broader keyboard/tablet/a11y gates and final Wave 1 closure.

SUPUESTO: none added.

Decisiones requeridas: none for these bounded slices; remaining work stays within approved Wave 1 criteria and existing server contracts.
