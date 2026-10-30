# Operations reports

`GET /api/admin/reports/operations` is a read-only, tenant-scoped management report.
It returns JSON by default and CSV when `format=csv`.

## Query

- `from`: required ISO-8601 UTC timestamp, inclusive.
- `to`: required ISO-8601 UTC timestamp, exclusive and later than `from`.
- `branchId`: optional branch filter. Non-ADMIN actors may only request assigned branches.
- `actorUserId`: optional operator filter.
- `variantId`: optional product variant filter.
- `categoryId`: optional product category filter.
- `format`: `json` (default) or `csv`.

The report includes sales, direct purchases, automatic transfers, current stock, and
branch breakdowns. Monetary totals use the configured tenant currency. The server
recalculates aggregates from tenant-scoped data; no client total is trusted.

CSV uses columns `section,metric,value,currency` and is returned as a download with
a deterministic period-based filename. The endpoint requires the existing
`inventory:write` administrative permission and never mutates data.
