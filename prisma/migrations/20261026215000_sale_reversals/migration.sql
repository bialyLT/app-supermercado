CREATE TYPE "SaleReversalType" AS ENUM ('ANNULMENT', 'RETURN');
CREATE TYPE "SaleReversalStatus" AS ENUM ('COMPLETED');
ALTER TYPE "InventoryMovementType" ADD VALUE 'RETURN';

CREATE TABLE "SaleReversal" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "saleId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "registerSessionId" UUID NOT NULL,
  "type" "SaleReversalType" NOT NULL,
  "status" "SaleReversalStatus" NOT NULL DEFAULT 'COMPLETED',
  "actorUserId" UUID NOT NULL,
  "reason" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "total" DECIMAL(22,4) NOT NULL,
  "currency" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SaleReversal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SaleReversal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "SaleReversal_tenantId_saleId_fkey" FOREIGN KEY ("tenantId", "saleId") REFERENCES "Sale"("tenantId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "SaleReversal_tenantId_branchId_fkey" FOREIGN KEY ("tenantId", "branchId") REFERENCES "Branch"("tenantId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "SaleReversal_tenantId_registerSessionId_fkey" FOREIGN KEY ("tenantId", "registerSessionId") REFERENCES "CashRegisterSession"("tenantId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "SaleReversal_tenantId_actorUserId_fkey" FOREIGN KEY ("tenantId", "actorUserId") REFERENCES "User"("tenantId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX "SaleReversal_tenantId_id_key" ON "SaleReversal"("tenantId", "id");
CREATE UNIQUE INDEX "SaleReversal_tenantId_idempotencyKey_key" ON "SaleReversal"("tenantId", "idempotencyKey");
CREATE INDEX "SaleReversal_tenantId_saleId_idx" ON "SaleReversal"("tenantId", "saleId");

CREATE TABLE "SaleReversalLine" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "reversalId" UUID NOT NULL,
  "saleLineId" UUID NOT NULL,
  "quantity" DECIMAL(18,6) NOT NULL,
  "unitPrice" DECIMAL(22,4) NOT NULL,
  "total" DECIMAL(22,4) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SaleReversalLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SaleReversalLine_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "SaleReversalLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "SaleReversalLine_tenantId_reversalId_fkey" FOREIGN KEY ("tenantId", "reversalId") REFERENCES "SaleReversal"("tenantId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "SaleReversalLine_tenantId_saleLineId_fkey" FOREIGN KEY ("tenantId", "saleLineId") REFERENCES "SaleLine"("tenantId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX "SaleReversalLine_tenantId_id_key" ON "SaleReversalLine"("tenantId", "id");
CREATE UNIQUE INDEX "SaleReversalLine_tenantId_reversalId_saleLineId_key" ON "SaleReversalLine"("tenantId", "reversalId", "saleLineId");
CREATE INDEX "SaleReversalLine_tenantId_saleLineId_idx" ON "SaleReversalLine"("tenantId", "saleLineId");

CREATE OR REPLACE FUNCTION prevent_sale_reversal_mutation() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'SALE_REVERSAL_APPEND_ONLY'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "SaleReversal_append_only" BEFORE UPDATE OR DELETE ON "SaleReversal" FOR EACH ROW EXECUTE FUNCTION prevent_sale_reversal_mutation();
CREATE TRIGGER "SaleReversalLine_append_only" BEFORE UPDATE OR DELETE ON "SaleReversalLine" FOR EACH ROW EXECUTE FUNCTION prevent_sale_reversal_mutation();

GRANT USAGE ON TYPE "SaleReversalType", "SaleReversalStatus" TO supermercado_app;
GRANT SELECT, INSERT ON "SaleReversal", "SaleReversalLine" TO supermercado_app;
REVOKE UPDATE, DELETE, TRUNCATE ON "SaleReversal", "SaleReversalLine" FROM supermercado_app;
ALTER TABLE "SaleReversal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SaleReversal" FORCE ROW LEVEL SECURITY;
ALTER TABLE "SaleReversalLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SaleReversalLine" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "SaleReversal" TO supermercado_app USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());
CREATE POLICY tenant_isolation ON "SaleReversalLine" TO supermercado_app USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());
