# Epic 6 — Scale, reports and deployment
Branch: `feat/epic6-scale-reports-deployment` (create from merged `origin/main` before source implementation).
Status: planning; product answers collected and provider decision approved.

## Specs

S1. «necesito un proveedor que cumpla con los requisitos y que sea gratuito».

S2. «bien se hara eso etnonces, backups gestiona el negocio».

S3. «Sí, confirmar» — Neon Free en São Paulo + Vercel, con backups operativos gestionados por el negocio.

S4. «Kiosco pequeño».

S5. «Sólo producción».

S6. «Básico» — RPO ≤24 horas y RTO ≤24 horas.

S7. «Listo para producción» — preparar la publicación sin activarla todavía.

S8. «Compras + transferencias».

S9. «Gerenciales» — indicadores de compras y sucursales.

S10. «Sólo logs/dashboard» — sin notificaciones externas.

S11. «Brasil + Hobby» — superseded for database by S3 and business-managed backups; Vercel remains the application platform.

S12. «Subdominio proveedor».

S13. «PR obligatorio».

S14. «Proveedor gestionado» — superseded by S2; the business owns the backup process.

S15. «Recepción directa».

S16. «Despacho directo».

S17. «Compras y sucursales».

S18. «Kiosco básico» — up to 5 concurrent tills and POS p95 ≤1 second.

S19. «Cambiar proveedor» when the selected free provider cannot satisfy managed backup requirements; resolved by S3 after moving backup responsibility to the business.

S20. «Demo controlada» / «Reportes completos» — synthetic fixtures must cover the full operational and reporting flows, without personal data.

S21. «CSV» — reports require screen views plus CSV export.

S22. «Cuenta temporal» / «Transferir al dueño» — remote accounts are temporary and must be transferred before closure.

S23. «Con impuestos» — direct receipts store subtotal, total taxes and total; no fiscal invoice issuance is added.

S24. «Automática» — origin dispatch deducts origin and credits destination without a later receiving confirmation.

S25. «Período + usuario» — reports include date range, branch/product/category and operator/payment filters as applicable.

S26. «1 año» — retain logs, audit and report exports for one year. Backup retention remains an implementation assumption to be documented and made configurable; it was not separately chosen by the owner.

S27. «Neon» — free PostgreSQL in São Paulo; Vercel remains the app host; backup automation is business-managed with `pg_dump`, off-site copies and timed restore drills.

## Tasks

T1 | S1-S7 | planning | pending | Approve D-010/D-021 and define the release/backup contract; commit: pending.
T2 | S8,S15,S23 | implementation | done | Implement direct purchase receipts with server-side pricing, tax totals, stock ledger and audit; commit: 6fc3be4.
T3 | S8,S16,S24 | implementation | done | Implement automatic inter-branch transfers with idempotency, ledger movements and audit; commit: 6fc3be4.
T4 | S9,S17,S21,S25 | implementation | done | Implement management reports and authorized CSV export; commit: 02e2494.
T5 | S10,S12,S18,S20,S26 | implementation | pending | Add structured observability, synthetic demo fixtures and retention/runbook controls; commit: pending.
T6 | S3,S6,S7,S13,S22,S27 | implementation | done | Prepare Neon/Vercel release, migrations, CI PR gates, `pg_dump` automation, off-site copy and restore drill; no production deploy; commit: pending.
T7 | S1-S27 | checking | pending | Run all GATES.md checks, load/concurrency, tenant/RLS, backup restore and OWASP review; create closure report; commit: pending.

## Log

L1. Dueño: «excelente ya mergee todo, si la epica 5 esta cerrada avnzamos a la siguiente, haceme ▎ todas las preguntasn ecesarias para hacer la epica 6 completa sin interrupciones».
L2. Dueño: if deploying for testing, «lo haria en supabase con vercel»; production deployment is not to happen yet.
L3. Dueño answered the collected Epic 6 scope questions: small kiosk, production-only strategy, basic RPO/RTO, production-ready preparation, purchases plus transfers, management reports, logs/dashboard only, provider subdomain, PR-required CI, controlled demo data with complete reports, CSV export, temporary account transferred to owner, direct receipt with taxes, automatic transfers, one-year retention, and Neon as the free provider after moving backups to business operations.
L4. Research found no indefinitely free managed provider with all provider-managed backup guarantees; business-managed `pg_dump` was selected to preserve zero provider cost. This changes the backup gate from provider-managed backup to tested operational backup/restore and must be documented explicitly.
L5. T2/T3 implementation evidence: migration deploy applied all migrations successfully; focused domain tests 11/11; PostgreSQL integration purchases/API/RLS/inventory 39/39; transfer/purchase focused integration 15/15; Prisma validate, typecheck, lint and diff hygiene exit 0. No production deployment performed.
L6. Commit boundary: `6fc3be4` contains the purchase/transfer unit and 4247 authored changed lines since `origin/main`; before the next commit, keep the report implementation as a separate focused delivery slice and avoid adding unrelated release/runbook work.
L7. T4 report evidence: domain/API tests 6/6, PostgreSQL aggregation and branch-scope tests 2/2, typecheck 0, lint 0. Reports are read-only, tenant-scoped, branch-scoped for non-ADMIN actors, and export JSON/CSV. No production deployment performed.
L8. Commit boundary: `02e2494` contains only management reports, CSV export, documentation and their tests; release/backup work starts in a separate slice.
L9. T6 release evidence: backup scripts syntax 2/2 and fail-closed restore safety 1/1; dump copied to local/offsite destinations; restore completed in a disposable database within the 12-second job wall time; restored smoke 2/2; ledger 0 divergences; tenant RLS 43/43. Production deployment was not executed.
