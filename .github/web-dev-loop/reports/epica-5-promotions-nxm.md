# Epic 5 — Promotions N×M closure report

Estado: ENTREGADO: Epic 5 gates completed; browser verification and production build passed.

## Delivered

- T1: additive category/promotion model, migration, deterministic N×M domain engine.
- T2: server-side checkout evaluation for discrete units, effective single-line pricing, immutable promotion snapshot, idempotent replay, and effective reversal.
- T3: protected tenant/RLS-scoped promotion repository and admin API with validation and audit events.
- T4: admin screen for listing, creating, editing, activating, and deactivating promotions.
- Decision and roadmap records updated with D-020, which supersedes only the promotion-postponement clause of D-018.

## Files created or modified

- `prisma/schema.prisma`
- `prisma/migrations/20261030100000_category_nxm_promotions/migration.sql`
- `src/domain/promotions.ts`
- `src/domain/weighed-barcode.ts`
- `src/server/repositories/inventory.ts`
- `src/server/repositories/weighed-barcode.ts`
- `src/server/repositories/promotions.ts`
- `app/api/admin/promotions/route.ts`
- `app/api/admin/promotions/[id]/route.ts`
- `app/admin/promotions/page.tsx`
- `app/admin/promotions/promotion-manager.tsx`
- `tests/promotions-domain.test.ts`
- `tests/integration/promotions-checkout.test.ts`
- `tests/integration/promotions-admin.test.ts`
- `tests/integration/rls-boundaries.test.ts`
- `tests/e2e/promotions-admin.spec.ts`
- `DECISIONS.md`
- `ROADMAP.md`
- `odd/tasks/epic5-promotions-nxm.md`

## Verification

| Command/check | Result |
|---|---|
| Focused promotion checkout integration | 1/1 passed |
| Promotion administration integration | 3/3 passed |
| Promotion domain + admin tests | 28/28 passed |
| Full PostgreSQL suite with runtime/admin/auth roles | 31 files, 219/219 tests passed, 155.41s |
| Identity/RLS focused gates | 2 files, 6/6 tests passed |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run db:validate` | exit 0 |
| `git diff --check` | exit 0 |
| `npm run build` | exit 0 with extended timeout; production routes compiled successfully |
| Playwright browser suite | 11/11 passed after installing Chromium and WSL libraries |
| Promotions administration browser E2E | 1/1 passed: authenticated admin created and deactivated a promotion |
| Browser verification for `/admin/promotions` | Passed via `tests/e2e/promotions-admin.spec.ts` |

## Deviations and assumptions

- PostgreSQL was provided by the existing Docker Desktop container `supermercado-postgres-1`; no Windows PostgreSQL service existed to stop and no duplicate service was created.
- Runtime, admin, and auth roles were separated in `supermercado_test_gate`; disposable local role passwords were configured outside the repository.
- `settings:write` is the existing permission used to protect promotion administration routes; actor identity and tenant scope remain server-derived.
- The UI accepts category and branch UUIDs directly because no category/branch selector API was in the approved T3 scope.

## Needs your decision

- Decide whether to create the authorized work-unit commit now; no commit, push, PR, or merge was performed.
