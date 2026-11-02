# Task — Reparación de CI de completitud operativa
Branch: `feat/operational-ui-completeness`; repair-only scope for the existing PR.
Status: authorized by the owner to fix reported CI failures and push; merge remains owner-owned.

## Specs

1. S1: “solucionar todo eso”
2. S2: “hagas el push”
3. S3: “asi hago el merge en github despues”

## Tasks

- T1 (S1) — Correct intake-review persistence/transition behavior and focused regression failures; route: inline; commit: pending.
- T2 (S1) — Correct rejected-intake and correction validation behavior without weakening domain rules; route: inline; commit: pending.
- T3 (S1-S3) — Run applicable gates, record evidence, and push the repaired branch without merging; route: inline; commit: pending.

## Log

- L1: okay, vamos a solucionar todo eso, te doy el permiso pra que soluciones eso, y hagas el push, asi hago el merge en github despues
- L2: En `41529703643`, commit `a06f8a4`, CI reportó 385/392 pruebas aprobadas y 7 fallidas en intake alerts, inventory hardening y RLS boundaries; los errores observados incluyen `INTAKE_REVIEW_STATE_TRANSITION_INVALID`, `permission denied for table UnverifiedIntakeReview`, `REJECTED_WOULD_NEGATE_STOCK` e `INVALID_INPUT` donde el test esperaba `CORRECTION_WOULD_NEGATE_STOCK`.
- L3: Se corrigió el setup de alertas para no actualizar `createdAt` de casos pendientes; el rol runtime recibe UPDATE sólo en columnas de transición; REJECTED registra discrepancia sin revertir stock/ledger según `DOMAIN_RULES.md` §5; la prueba de underflow usa cantidad positiva válida.
- L4: Typecheck, lint, Prisma validate y diff check terminaron en 0. Las 30 pruebas de DB locales quedaron skipped por falta de `DATABASE_URL` y `TEST_DATABASE_URL`; la suite completa excedió 30 s; `gentle-ai-verify` no estuvo disponible. No se hizo commit ni push.
- L5: El dueño eligió “Esperar verificación”; no hacer commit ni push hasta disponer de tests PostgreSQL y revisión independiente.
