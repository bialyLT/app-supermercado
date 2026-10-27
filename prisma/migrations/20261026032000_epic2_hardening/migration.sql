CREATE TYPE "IntakePolicyMode" AS ENUM ('DISABLED', 'ALLOW_WITH_CAPS', 'REQUIRE_SUPERVISOR');

ALTER TABLE "InventoryMovement" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "correlationId" TEXT;
ALTER TABLE "UnverifiedIntakeReview"
  ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "costStatus" TEXT NOT NULL DEFAULT 'UNKNOWN';

CREATE TABLE "UnverifiedIntakePolicy" (
  "tenantId" UUID NOT NULL,
  "mode" "IntakePolicyMode" NOT NULL DEFAULT 'ALLOW_WITH_CAPS',
  "maxLineQuantity" DECIMAL(18,3) NOT NULL DEFAULT 10,
  "maxSessionQuantity" DECIMAL(18,3) NOT NULL DEFAULT 30,
  "maxVariantDailyQuantity" DECIMAL(18,3) NOT NULL DEFAULT 20,
  CONSTRAINT "UnverifiedIntakePolicy_pkey" PRIMARY KEY ("tenantId"),
  CONSTRAINT "UnverifiedIntakePolicy_caps_check" CHECK (
    "maxLineQuantity" > 0 AND "maxSessionQuantity" > 0 AND "maxVariantDailyQuantity" > 0
  ),
  CONSTRAINT "UnverifiedIntakePolicy_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

CREATE TABLE "IdempotencyCommand" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "commandId" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "resultType" TEXT NOT NULL,
  "resultId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdempotencyCommand_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "IdempotencyCommand_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "InventoryMovement_tenantId_idempotencyKey_key"
  ON "InventoryMovement"("tenantId", "idempotencyKey");
CREATE UNIQUE INDEX "IdempotencyCommand_tenantId_commandId_key"
  ON "IdempotencyCommand"("tenantId", "commandId");

ALTER TABLE "InventoryLevel"
  ADD CONSTRAINT "InventoryLevel_balance_check"
  CHECK ("onHand" >= 0 AND "reserved" >= 0 AND "reserved" <= "onHand");
ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "InventoryMovement_quantity_check" CHECK ("quantity" > 0);

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AUDIT_LOG_APPEND_ONLY';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "AuditLog_append_only" ON "AuditLog";
CREATE TRIGGER "AuditLog_append_only"
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supermercado_app') THEN
    CREATE ROLE supermercado_app NOLOGIN;
  END IF;
END $$;
REVOKE UPDATE, DELETE ON "InventoryMovement", "AuditLog" FROM supermercado_app;
GRANT SELECT, INSERT ON "InventoryMovement", "AuditLog" TO supermercado_app;

CREATE OR REPLACE FUNCTION app_tenant() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$ LANGUAGE sql STABLE;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'UnitOfMeasure','Product','ProductVariant','Barcode','Price','Location',
    'Lot','InventoryLevel','InventoryMovement','Reservation',
    'UnverifiedIntakeReview','Sale','SaleLine','AuditLog',
    'UnverifiedIntakePolicy','IdempotencyCommand'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant())',
      table_name
    );
  END LOOP;
END $$;
