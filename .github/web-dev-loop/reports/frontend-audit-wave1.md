# Frontend audit — Wave 1 slice verification

Estado: `ENTREGADO: Wave 1 keyboard/tablet scope is implemented and final gates are GREEN; no Field/Tabs/drawer/POS-responsive scope remains pending.`

## Delivered slices

### ProductCombobox

- Added shared `components/product-combobox.tsx` and `components/product-combobox.module.css`.
- Integrated it into purchase, transfer, and POS product-selection flows.
- Preserved server-backed catalog callbacks and existing tenant/branch/location authority.
- ARIA combobox/listbox semantics include ArrowUp/ArrowDown navigation, Enter selection, Escape dismissal, and live result counts.

### Field and Tabs

- Added shared `components/field.tsx` for stable label/help/error associations, `aria-invalid`/`aria-required`, and first-invalid focus; ReportFilters uses the first-invalid focus hook.
- Corrected existing TransferManager tabs with `tablist`/`tab`/`tabpanel`, roving tabindex, and ArrowLeft/ArrowRight/Home/End navigation.

### Tablet drawer behavior

- Closed AdminShell tablet/mobile navigation is visibility-hidden and pointer-inert, so its links are not keyboard-reachable while closed.
- Opening restores visibility and interaction; existing focus restoration, role-filtered navigation, and desktop sidebar behavior remain unchanged.

### POS responsive slice

- Added responsive 3/2/1-column layout, bounded card content, adaptive payment rows, and overflow protection.
- Preserved keyboard shortcuts, checkout payloads, offline queue behavior, and server-derived location authority.

### Promotions responsive view

- Added scoped responsive styling for the promotion form and list without changing API payloads, tenant/branch authority, or CRUD behavior.
- Labels now have explicit control associations; controls have 44px minimum hit areas and visible focus; the table uses intentional bounded horizontal overflow on narrow screens.

### Modal/focus

- Added shared `components/modal.tsx` and `components/modal.module.css`.
- Integrated the component into the admin-shell keyboard-shortcuts dialog, purchase `SupplierModal`, purchase receipt detail, transfer confirmation, and supplier management.
- Initial focus moves to the first control; Tab cycles within the dialog; Escape closes; focus returns to the invoking control; sibling content is inert while open.
- SupplierModal prevents Escape/backdrop closure while its server submission is in flight.
- Purchase receipt detail preserves its existing state and close actions while gaining shared focus containment and restoration.
- Transfer confirmation and supplier management preserve their existing form/CRUD behavior while gaining shared focus containment and submission-safe close behavior.
- No server contracts, authorization rules, or CSP policy were changed.

## Numeric verification

- ProductCombobox focused Vitest/UI suite: **3 files, 19/19 tests passed**, 1.79s.
- POS Playwright E2E: **7/7 passed**, 1.1m, including ArrowDown/Enter selection and existing POS flows.
- Modal/admin-shell focused Vitest suite: **2 files, 14/14 tests passed**, 1.39s.
- SupplierModal focused purchases/modal suite: **2 files, 12/12 tests passed**, 1.72s.
- Transfer confirmation focused transfers/modal suite: **2 files, 7/7 tests passed**, 1.57s.
- SupplierManager focused admin-operations/modal suite: **2 files, 8/8 tests passed**, 1.81s.
- TypeScript typecheck: **passed**, 0 errors.
- Admin-shell Playwright E2E: **4/4 passed**, 54.7s.
- Purchases Playwright E2E: **5/5 passed**, 54.4s after rerunning with the isolated Playwright server (the first attempt was blocked before test execution by the manual dev server lock).
- Admin-operations Playwright E2E: **5/5 passed**, 32.4s, including supplier modal Escape close and tablet no-horizontal-scroll coverage.
- Promotions Playwright E2E: **1/1 passed**, 20.8s, including create/deactivate behavior after the responsive markup update.
- POS Playwright E2E: **8/8 passed**, 48.2s, including the new 820×1180 no-horizontal-overflow check.
- Admin-shell drawer focused Vitest suite: **13/13 passed** after closed/open tablet coverage was added.
- Admin-shell drawer Playwright E2E: **4/4 passed**, 28.5s, including closed/open tablet drawer behavior.
- Field/reports focused tests: **14/14 passed**.
- Tabs/transfers focused tests: **18/18 passed**.
- Full Vitest gate: **32 files passed, 24 skipped; 196 tests passed, 160 skipped; 28.41s**.
- Final frontend E2E gate: **24/24 passed**, 1.6m, across shell, operations, purchases, POS, promotions, and transfer Tabs.
- Production CSP Playwright gate: **1/1 passed**, 36.2s.
- `git diff --check`: **passed**.

## RED/GREEN evidence

- ProductCombobox RED: first POS E2E run failed 5/7 because extraction initially dropped the preserved `#variant`/autofocus contract and tests still asserted pre-Wave-1 button/list markup. GREEN followed after restoring those contracts and updating tests to ARIA option/listbox semantics.
- Modal RED: initial typecheck failed because the structural test passed `children` as a separate `React.createElement` argument. GREEN followed after passing `children` inside the typed props object.

## Remaining Wave 1 scope

- None within the approved Wave 1 keyboard/tablet scope.

Future work outside this closure may include broader visual polish or additional screens, but it is not required to close Wave 1.

SUPUESTO: none added.

Decisiones requeridas: none for this Wave 1 closure; all approved keyboard/tablet criteria have numeric evidence and existing server contracts remain unchanged.
