-- Prisma writes updatedAt on every UPDATE, so the column-level grant for the
-- operational mode needs that column too. Kept as a follow-up migration because
-- the previous one was already applied.
GRANT UPDATE ("operationalMode", "updatedAt") ON "Tenant" TO supermercado_app;
