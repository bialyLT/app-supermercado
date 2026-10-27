ALTER TABLE "UnverifiedIntakeReview" ALTER COLUMN "status" SET DEFAULT 'PENDING_REVIEW';
UPDATE "UnverifiedIntakeReview" SET "status" = 'PENDING_REVIEW' WHERE "status" = 'PENDING';
ALTER TABLE "UnverifiedIntakeReview"
  ADD COLUMN "saleId" UUID,
  ADD COLUMN "saleLineId" UUID,
  ADD COLUMN "sessionId" TEXT,
  ADD COLUMN "businessDay" TEXT;
ALTER TABLE "ProductVariant" ADD COLUMN "quantityPrecision" INTEGER NOT NULL DEFAULT 0
  CHECK ("quantityPrecision" IN (0, 3));
ALTER TABLE "Location" ADD COLUMN "timeZone" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires';
ALTER TABLE "IdempotencyCommand" ADD COLUMN "result" JSONB;

CREATE TABLE "InventoryDiscrepancy" (
  "id" UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id"),
  "reviewId" UUID NOT NULL UNIQUE REFERENCES "UnverifiedIntakeReview"("id"),
  "saleId" UUID NOT NULL REFERENCES "Sale"("id"),
  "saleLineId" UUID NOT NULL REFERENCES "SaleLine"("id"),
  "sessionId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "InventoryDiscrepancy_tenantId_idx" ON "InventoryDiscrepancy"("tenantId");

CREATE OR REPLACE FUNCTION prevent_resolved_intake_mutation() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD."status" NOT IN ('PENDING', 'PENDING_REVIEW') THEN
    RAISE EXCEPTION 'INTAKE_REVIEW_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "UnverifiedIntakeReview_immutable"
  BEFORE UPDATE OR DELETE ON "UnverifiedIntakeReview"
  FOR EACH ROW EXECUTE FUNCTION prevent_resolved_intake_mutation();
CREATE TRIGGER "InventoryDiscrepancy_append_only"
  BEFORE UPDATE OR DELETE ON "InventoryDiscrepancy"
  FOR EACH ROW EXECUTE FUNCTION prevent_inventory_movement_mutation();

-- The login is provisioned outside migrations; this group never owns tables.
ALTER ROLE supermercado_app NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOLOGIN;
GRANT USAGE ON SCHEMA public TO supermercado_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO supermercado_app;
REVOKE UPDATE, DELETE, TRUNCATE ON "InventoryMovement", "AuditLog", "InventoryDiscrepancy", "IdempotencyCommand" FROM supermercado_app;
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM supermercado_app;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'UnitOfMeasure','Product','ProductVariant','Barcode','Price','Location',
    'Lot','InventoryLevel','InventoryMovement','Reservation',
    'UnverifiedIntakeReview','Sale','SaleLine','AuditLog',
    'UnverifiedIntakePolicy','IdempotencyCommand','InventoryDiscrepancy'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', table_name);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant())', table_name);
  END LOOP;
END $$;
