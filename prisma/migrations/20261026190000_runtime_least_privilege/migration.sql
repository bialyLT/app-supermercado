-- The operational role must not read or rewrite migration bookkeeping.
REVOKE ALL PRIVILEGES ON "_prisma_migrations" FROM supermercado_app;
REVOKE INSERT, UPDATE, DELETE ON "Tenant", "Store", "Branch", "CashRegister" FROM supermercado_app;
REVOKE INSERT, UPDATE, DELETE ON "Session", "Verification" FROM supermercado_app;
-- User creation needs credential INSERT/SELECT, not credential mutation/deletion.
REVOKE UPDATE, DELETE ON "Account" FROM supermercado_app;
