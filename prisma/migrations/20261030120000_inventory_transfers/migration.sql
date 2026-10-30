-- Epic 6: automatic inter-branch inventory transfers
CREATE TYPE "InventoryTransferStatus" AS ENUM ('COMPLETED');

CREATE TABLE "InventoryTransfer" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "originBranchId" UUID NOT NULL,
  "destinationBranchId" UUID NOT NULL,
  "originLocationId" UUID NOT NULL,
  "destinationLocationId" UUID NOT NULL,
  "status" "InventoryTransferStatus" NOT NULL DEFAULT 'COMPLETED',
  "reason" TEXT,
  "actorUserId" UUID NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryTransfer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InventoryTransfer_tenant_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "InventoryTransfer_origin_branch_fkey" FOREIGN KEY ("tenantId", "originBranchId") REFERENCES "Branch"("tenantId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "InventoryTransfer_destination_branch_fkey" FOREIGN KEY ("tenantId", "destinationBranchId") REFERENCES "Branch"("tenantId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "InventoryTransfer_origin_location_fkey" FOREIGN KEY ("tenantId", "originLocationId") REFERENCES "Location"("tenantId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "InventoryTransfer_destination_location_fkey" FOREIGN KEY ("tenantId", "destinationLocationId") REFERENCES "Location"("tenantId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "InventoryTransfer_actor_fkey" FOREIGN KEY ("tenantId", "actorUserId") REFERENCES "User"("tenantId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "InventoryTransfer_different_branches_check" CHECK ("originBranchId" <> "destinationBranchId")
);
CREATE UNIQUE INDEX "InventoryTransfer_tenantId_id_key" ON "InventoryTransfer"("tenantId", "id");
CREATE UNIQUE INDEX "InventoryTransfer_tenantId_idempotencyKey_key" ON "InventoryTransfer"("tenantId", "idempotencyKey");
CREATE INDEX "InventoryTransfer_origin_idx" ON "InventoryTransfer"("tenantId", "originBranchId", "createdAt");
CREATE INDEX "InventoryTransfer_destination_idx" ON "InventoryTransfer"("tenantId", "destinationBranchId", "createdAt");
GRANT SELECT, INSERT, UPDATE, DELETE ON "InventoryTransfer" TO supermercado_app;
ALTER TABLE "InventoryTransfer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventoryTransfer" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "InventoryTransfer" TO supermercado_app USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());

CREATE TABLE "InventoryTransferLine" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "transferId" UUID NOT NULL,
  "variantId" UUID NOT NULL,
  "lotId" UUID,
  "quantity" DECIMAL(18, 6) NOT NULL,
  CONSTRAINT "InventoryTransferLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InventoryTransferLine_tenant_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "InventoryTransferLine_transfer_fkey" FOREIGN KEY ("transferId") REFERENCES "InventoryTransfer"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "InventoryTransferLine_variant_fkey" FOREIGN KEY ("tenantId", "variantId") REFERENCES "ProductVariant"("tenantId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "InventoryTransferLine_lot_fkey" FOREIGN KEY ("tenantId", "lotId") REFERENCES "Lot"("tenantId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "InventoryTransferLine_quantity_check" CHECK ("quantity" > 0)
);
CREATE UNIQUE INDEX "InventoryTransferLine_tenantId_id_key" ON "InventoryTransferLine"("tenantId", "id");
CREATE INDEX "InventoryTransferLine_transfer_idx" ON "InventoryTransferLine"("tenantId", "transferId");
CREATE INDEX "InventoryTransferLine_variant_idx" ON "InventoryTransferLine"("tenantId", "variantId");
GRANT SELECT, INSERT, UPDATE, DELETE ON "InventoryTransferLine" TO supermercado_app;
ALTER TABLE "InventoryTransferLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventoryTransferLine" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "InventoryTransferLine" TO supermercado_app USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());
