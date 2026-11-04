-- Additive nullable register→location assignment with immutable session snapshot.
-- Existing rows keep NULL; unassigned registers and legacy sessions fail closed
-- until naturally closed/reopened. No data backfill, no destructive change.
ALTER TABLE "CashRegister" ADD COLUMN "locationId" UUID;
ALTER TABLE "CashRegisterSession" ADD COLUMN "locationId" UUID;

ALTER TABLE "CashRegister" ADD CONSTRAINT "CashRegister_tenantId_locationId_fkey"
  FOREIGN KEY ("tenantId", "locationId") REFERENCES "Location"("tenantId", "id");
ALTER TABLE "CashRegisterSession" ADD CONSTRAINT "CashRegisterSession_tenantId_locationId_fkey"
  FOREIGN KEY ("tenantId", "locationId") REFERENCES "Location"("tenantId", "id");

-- Extend the CASH session immutability guard so the snapshot cannot change,
-- including across close (closed sessions were already fully immutable).
CREATE OR REPLACE FUNCTION protect_register_session() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD."closedAt" IS NOT NULL THEN RAISE EXCEPTION 'REGISTER_SESSION_IMMUTABLE'; END IF;
  IF NEW."closedAt" IS NULL OR ROW(NEW."id", NEW."tenantId", NEW."registerId", NEW."branchId", NEW."locationId", NEW."userId", NEW."currency", NEW."openedAt")
    IS DISTINCT FROM ROW(OLD."id", OLD."tenantId", OLD."registerId", OLD."branchId", OLD."locationId", OLD."userId", OLD."currency", OLD."openedAt") THEN
    RAISE EXCEPTION 'REGISTER_SESSION_IMMUTABLE';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- Runtime least privilege is otherwise preserved: the operational role gains
-- only the narrow assignment column on CashRegister (table-level
-- INSERT/UPDATE/DELETE remain revoked by 20261026190000).
GRANT UPDATE("locationId") ON "CashRegister" TO supermercado_app;
