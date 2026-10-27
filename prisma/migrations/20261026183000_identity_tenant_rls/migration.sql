-- Authentication bootstrap needs its own restricted connection: no stock or audit access.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supermercado_auth') THEN
    CREATE ROLE supermercado_auth NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO supermercado_auth;
GRANT SELECT ON "User", "Role", "UserRole", "UserBranch" TO supermercado_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON "Session", "Account", "Verification" TO supermercado_auth;
GRANT UPDATE ("name", "image", "emailVerified", "updatedAt") ON "User" TO supermercado_auth;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['Store','Branch','CashRegister','User','Role','UserRole','UserBranch'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I TO supermercado_app USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant())', table_name);
  END LOOP;
  FOREACH table_name IN ARRAY ARRAY['User','Role','UserRole','UserBranch'] LOOP
    EXECUTE format('CREATE POLICY auth_identity_read ON %I FOR SELECT TO supermercado_auth USING (true)', table_name);
  END LOOP;
END $$;
CREATE POLICY auth_identity_update ON "User" FOR UPDATE TO supermercado_auth USING (true) WITH CHECK (true);
ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tenant" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Tenant" TO supermercado_app USING ("id" = app_tenant()) WITH CHECK ("id" = app_tenant());

-- NULL-lot levels must be unique too. Never silently merge preexisting ledger data.
CREATE UNIQUE INDEX "InventoryLevel_without_lot_key" ON "InventoryLevel"("tenantId", "locationId", "variantId") WHERE "lotId" IS NULL;
CREATE UNIQUE INDEX "Sale_tenantId_id_key" ON "Sale"("tenantId", "id");
CREATE UNIQUE INDEX "SaleLine_tenantId_id_key" ON "SaleLine"("tenantId", "id");
CREATE UNIQUE INDEX "UnverifiedIntakeReview_tenantId_id_key" ON "UnverifiedIntakeReview"("tenantId", "id");
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_tenant_sale_fkey" FOREIGN KEY ("tenantId", "saleId") REFERENCES "Sale"("tenantId", "id");
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_tenant_variant_fkey" FOREIGN KEY ("tenantId", "variantId") REFERENCES "ProductVariant"("tenantId", "id");
ALTER TABLE "Location" ADD CONSTRAINT "Location_tenant_branch_fkey" FOREIGN KEY ("tenantId", "branchId") REFERENCES "Branch"("tenantId", "id");
ALTER TABLE "UnverifiedIntakeReview"
  ADD CONSTRAINT "Intake_tenant_location_fkey" FOREIGN KEY ("tenantId", "locationId") REFERENCES "Location"("tenantId", "id"),
  ADD CONSTRAINT "Intake_tenant_variant_fkey" FOREIGN KEY ("tenantId", "variantId") REFERENCES "ProductVariant"("tenantId", "id"),
  ADD CONSTRAINT "Intake_tenant_sale_fkey" FOREIGN KEY ("tenantId", "saleId") REFERENCES "Sale"("tenantId", "id"),
  ADD CONSTRAINT "Intake_tenant_line_fkey" FOREIGN KEY ("tenantId", "saleLineId") REFERENCES "SaleLine"("tenantId", "id");
ALTER TABLE "InventoryDiscrepancy"
  ADD CONSTRAINT "Discrepancy_tenant_review_fkey" FOREIGN KEY ("tenantId", "reviewId") REFERENCES "UnverifiedIntakeReview"("tenantId", "id"),
  ADD CONSTRAINT "Discrepancy_tenant_sale_fkey" FOREIGN KEY ("tenantId", "saleId") REFERENCES "Sale"("tenantId", "id"),
  ADD CONSTRAINT "Discrepancy_tenant_line_fkey" FOREIGN KEY ("tenantId", "saleLineId") REFERENCES "SaleLine"("tenantId", "id");
