CREATE TYPE "SyncConflictKind" AS ENUM ('STOCK_DISCREPANCY', 'PRODUCT_DUPLICATE', 'REVERSAL_CONFLICT');
CREATE TYPE "SyncConflictStatus" AS ENUM ('OPEN', 'RESOLVED', 'REJECTED');

CREATE TABLE "SyncConflict" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "commandId" TEXT NOT NULL,
  "kind" "SyncConflictKind" NOT NULL,
  "status" "SyncConflictStatus" NOT NULL DEFAULT 'OPEN',
  "payload" JSONB NOT NULL,
  "existingEntityId" UUID,
  "resolution" JSONB,
  "resolvedByUserId" UUID,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMPTZ(3),
  CONSTRAINT "SyncConflict_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SyncConflict_tenant_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "SyncConflict_tenant_command_key" UNIQUE ("tenantId", "commandId")
);
CREATE UNIQUE INDEX "SyncConflict_tenant_id_key" ON "SyncConflict"("tenantId", "id");
CREATE INDEX "SyncConflict_tenant_status_created_idx" ON "SyncConflict"("tenantId", "status", "createdAt");

GRANT USAGE ON TYPE "SyncConflictKind", "SyncConflictStatus" TO supermercado_app;
GRANT SELECT, INSERT, UPDATE ON "SyncConflict" TO supermercado_app;
ALTER TABLE "SyncConflict" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SyncConflict" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "SyncConflict" TO supermercado_app
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());
